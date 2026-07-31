/**
 * Penyimpanan buku besar kasir pada mesin kasir.
 *
 * ## Apa yang membuat data selamat saat komputer mati
 *
 * Tiga hal, dan ketiganya harus ada bersamaan:
 *
 * 1. **IndexedDB, bukan memori.** `sessionStorage` hilang saat tab ditutup dan
 *    `localStorage` tidak punya transaksi — tulisan yang terputus di tengah
 *    dapat meninggalkan separuh data. IndexedDB menulis secara transaksional:
 *    satu penjualan masuk seluruhnya atau tidak sama sekali.
 *
 * 2. **Izin penyimpanan permanen.** Inilah yang paling sering terlewat.
 *    Tanpa `navigator.storage.persist()`, peramban BOLEH menghapus IndexedDB
 *    diam-diam ketika ruang menipis — dan penjualan yang belum terkirim ikut
 *    lenyap tanpa ada yang tahu. Izin ini diminta saat awal, dan bila ditolak
 *    keadaannya dilaporkan apa adanya alih-alih dianggap aman.
 *
 * 3. **Ditulis SEBELUM dikirim.** Setiap penjualan masuk buku besar lokal lebih
 *    dahulu, baru dicoba dikirim. Bila listrik padam tepat setelah pembeli
 *    membayar, catatannya sudah ada di mesin.
 *
 * ## Yang tidak dijanjikan berkas ini
 *
 * Penyimpanan peramban bukan tempat yang aman bagi satu-satunya salinan data
 * uang. Ia tetap dapat hilang bila pengguna membersihkan data situs, profil
 * peramban diganti, atau sistem dipasang ulang. Karena itu buku besar ini
 * **dapat diekspor** sebagai berkas, dan kebenaran terakhir tetap ada di
 * server. Yang dijanjikan di sini: tidak hilang karena komputer dimatikan, dan
 * dapat diadu dengan server kapan saja.
 */

import {
  HASH_AWAL,
  hashMuatan,
  hitungHash,
  periksaRantai,
  rekonsiliasi,
  ringkasanAntrean,
  type CatatanLokal,
  type CatatanServer,
  type HasilRekonsiliasi,
  type MuatanTransaksi,
  type StatusLokal,
  type TemuanRusak,
} from './ledger';

const NAMA_DB = 'ebisnis-pos';
const VERSI_DB = 1;
const TOKO_CATATAN = 'ledger';
const TOKO_META = 'meta';

export interface KeadaanPenyimpanan {
  /** Benar bila peramban berjanji tidak menghapus data ini sendiri. */
  persistent: boolean;
  /** Perkiraan ruang terpakai dan tersedia, dalam byte. */
  usage: number | null;
  quota: number | null;
  /** Alasan yang dapat dibaca pengguna bila tidak permanen. */
  warning: string | null;
}

export interface BukaBuku {
  outletId: string;
  terminalId: string;
  shiftId: string;
  businessDate: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function bukaDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TOKO_CATATAN)) {
        const toko = db.createObjectStore(TOKO_CATATAN, { keyPath: 'offlineId' });
        // Indeks pada sequence dipakai membaca berurut dan mencari baris
        // terakhir tanpa memuat seluruh buku besar ke memori.
        toko.createIndex('sequence', 'sequence', { unique: true });
        toko.createIndex('status', 'status', { unique: false });
        toko.createIndex('businessDate', 'businessDate', { unique: false });
      }
      if (!db.objectStoreNames.contains(TOKO_META)) {
        db.createObjectStore(TOKO_META, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB tidak dapat dibuka.'));
  });
  return dbPromise;
}

/**
 * Meminta izin penyimpanan permanen, lalu melaporkan keadaannya apa adanya.
 *
 * Sengaja TIDAK melemparkan galat bila ditolak. Kasir tetap harus dapat
 * berjualan; yang berubah adalah peringatan yang ditampilkan kepadanya — dan
 * peringatan yang jujur lebih berguna daripada layar yang menolak terbuka.
 */
export async function pastikanPermanen(): Promise<KeadaanPenyimpanan> {
  if (!('storage' in navigator) || !navigator.storage?.persist) {
    return {
      persistent: false,
      usage: null,
      quota: null,
      warning:
        'Peramban ini tidak mendukung penyimpanan permanen. Transaksi luring dapat hilang bila ' +
        'ruang penyimpanan menipis. Pakai Chrome atau Edge versi terbaru pada mesin kasir.',
    };
  }

  let permanen = await navigator.storage.persisted();
  if (!permanen) permanen = await navigator.storage.persist();

  const perkiraan = navigator.storage.estimate
    ? await navigator.storage.estimate().catch(() => null)
    : null;

  return {
    persistent: permanen,
    usage: perkiraan?.usage ?? null,
    quota: perkiraan?.quota ?? null,
    warning: permanen
      ? null
      : 'Peramban belum memberi izin penyimpanan permanen. Transaksi luring MASIH tersimpan dan ' +
        'tetap selamat saat komputer dimatikan, tetapi dapat terhapus bila ruang penyimpanan ' +
        'menipis. Pasang halaman ini sebagai aplikasi agar izin diberikan otomatis.',
  };
}

/**
 * Mencatat satu penjualan ke buku besar lokal.
 *
 * Seluruhnya dalam satu transaksi IndexedDB: membaca baris terakhir, menyusun
 * hash, dan menulis baris baru. Bila mesin mati di tengah, tidak ada baris
 * setengah jadi — yang ada hanyalah keadaan sebelum atau sesudah.
 */
export async function catat(
  konteks: BukaBuku,
  penjualan: {
    offlineId: string;
    grandTotal: string;
    itemCount: number;
    occurredAt: string;
    receiptNumber: string | null;
    /** Rincian barang dan pembayaran; tanpanya transaksi tidak dapat dibukukan. */
    payload?: MuatanTransaksi | null;
  },
): Promise<CatatanLokal> {
  const db = await bukaDb();
  const terakhir = await barisTerakhir(db);

  const muatan = penjualan.payload ?? null;
  const calon: Omit<CatatanLokal, 'hash'> = {
    offlineId: penjualan.offlineId,
    sequence: (terakhir?.sequence ?? 0) + 1,
    outletId: konteks.outletId,
    terminalId: konteks.terminalId,
    shiftId: konteks.shiftId,
    businessDate: konteks.businessDate,
    grandTotal: penjualan.grandTotal,
    itemCount: penjualan.itemCount,
    occurredAt: penjualan.occurredAt,
    receiptNumber: penjualan.receiptNumber,
    status: 'PENDING',
    serverSaleId: null,
    payload: muatan,
    payloadHash: muatan ? await hashMuatan(muatan) : null,
    previousHash: terakhir?.hash ?? HASH_AWAL,
  };

  const baris: CatatanLokal = { ...calon, hash: await hitungHash(calon) };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKO_CATATAN, 'readwrite');
    // `add`, bukan `put`: penjualan dengan offlineId yang sama tidak boleh
    // menimpa yang sudah ada. Bila terjadi, itu tanda ada yang salah pada
    // pembuatan identitasnya, dan menimpanya akan menghapus transaksi nyata.
    tx.objectStore(TOKO_CATATAN).add(baris);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal menulis buku besar lokal.'));
  });

  return baris;
}

/** Menandai satu baris sudah tersinkron. Isi transaksinya tidak disentuh. */
export async function tandaiTersinkron(offlineId: string, serverSaleId: string): Promise<void> {
  await ubahStatus(offlineId, 'SYNCED', serverSaleId);
}

/** Menandai satu baris ditolak server, beserta alasannya pada meta. */
export async function tandaiDitolak(offlineId: string, alasan: string): Promise<void> {
  await ubahStatus(offlineId, 'REJECTED', null);
  await simpanMeta(`reject:${offlineId}`, alasan);
}

async function ubahStatus(
  offlineId: string,
  status: StatusLokal,
  serverSaleId: string | null,
): Promise<void> {
  const db = await bukaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKO_CATATAN, 'readwrite');
    const toko = tx.objectStore(TOKO_CATATAN);
    const baca = toko.get(offlineId);
    baca.onsuccess = () => {
      const baris = baca.result as CatatanLokal | undefined;
      if (!baris) {
        reject(new Error(`Baris ${offlineId} tidak ada pada buku besar lokal.`));
        return;
      }
      // Hanya status dan serverSaleId yang berubah; keduanya sengaja tidak ikut
      // dihash justru supaya perubahan ini tidak memutus rantai.
      toko.put({ ...baris, status, serverSaleId });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Gagal memperbarui buku besar lokal.'));
  });
}

/** Seluruh baris, berurut menurut nomor urut. */
export async function semua(): Promise<CatatanLokal[]> {
  const db = await bukaDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOKO_CATATAN, 'readonly');
    const req = tx.objectStore(TOKO_CATATAN).index('sequence').getAll();
    req.onsuccess = () => resolve(req.result as CatatanLokal[]);
    req.onerror = () => reject(req.error ?? new Error('Gagal membaca buku besar lokal.'));
  });
}

/** Baris yang belum terkirim, berurut — dikirim menurut urutan terjadinya. */
export async function tertunda(): Promise<CatatanLokal[]> {
  return (await semua()).filter((c) => c.status === 'PENDING');
}

async function barisTerakhir(db: IDBDatabase): Promise<CatatanLokal | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TOKO_CATATAN, 'readonly');
    const req = tx.objectStore(TOKO_CATATAN).index('sequence').openCursor(null, 'prev');
    req.onsuccess = () => resolve((req.result?.value as CatatanLokal | undefined) ?? null);
    req.onerror = () => reject(req.error ?? new Error('Gagal membaca baris terakhir.'));
  });
}

async function simpanMeta(key: string, value: unknown): Promise<void> {
  const db = await bukaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(TOKO_META, 'readwrite');
    tx.objectStore(TOKO_META).put({ key, value, at: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Ringkasan antrean untuk batang status kasir. */
export async function ringkasan() {
  return ringkasanAntrean(await semua());
}

/** Memeriksa keutuhan seluruh buku besar. */
export async function periksaKeutuhan(): Promise<TemuanRusak[]> {
  return periksaRantai(await semua());
}

/** Mengadu buku besar lokal dengan catatan server. */
export async function adu(server: CatatanServer[]): Promise<HasilRekonsiliasi> {
  return rekonsiliasi(await semua(), server);
}

/**
 * Mengekspor buku besar sebagai JSON.
 *
 * Ada karena penyimpanan peramban tetap dapat hilang di luar kendali kita —
 * profil diganti, data situs dibersihkan, sistem dipasang ulang. Berkas hasil
 * ekspor dapat disimpan di tempat lain, dan hashnya tetap dapat diperiksa
 * karena rantainya ikut terbawa.
 */
export async function ekspor(): Promise<string> {
  const baris = await semua();
  const temuan = await periksaRantai(baris);
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      database: NAMA_DB,
      recordCount: baris.length,
      // Hasil pemeriksaan ikut diekspor supaya penerima berkas ini tahu apakah
      // isinya masih utuh pada saat diekspor, tanpa harus memercayai kata-kata.
      integrity: temuan.length === 0 ? 'UTUH' : 'ADA TEMUAN',
      findings: temuan,
      records: baris,
    },
    null,
    2,
  );
}

/**
 * Menghapus buku besar. Hanya untuk pengujian dan pemasangan ulang.
 *
 * Tidak dipanggil dari antarmuka mana pun. Buku besar kasir tidak boleh punya
 * tombol hapus: yang ingin dihapus penyewa adalah data contoh, dan itu urusan
 * server, bukan mesin kasir.
 */
export async function _kosongkanUntukUji(): Promise<void> {
  const db = await bukaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([TOKO_CATATAN, TOKO_META], 'readwrite');
    tx.objectStore(TOKO_CATATAN).clear();
    tx.objectStore(TOKO_META).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
