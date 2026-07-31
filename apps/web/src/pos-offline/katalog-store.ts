/**
 * Penyimpanan katalog luring di IndexedDB.
 *
 * ## Mengapa basis data terpisah dari buku transaksi
 *
 * Katalog ini **boleh hilang**. Bila terhapus, mesin kasir tinggal menyalinnya
 * lagi dari peladen dan tidak ada yang berkurang. Buku transaksi lokal justru
 * sebaliknya: ia satu-satunya bukti bahwa penjualan pernah terjadi ketika
 * peladen tidak terjangkau.
 *
 * Menaruh keduanya pada satu basis data berarti setiap tindakan "bersihkan
 * cache" — milik kita sendiri maupun milik peramban — mengancam yang tidak
 * tergantikan demi membereskan yang tergantikan. Karena itu katalog memakai
 * basis datanya sendiri, dan menghapusnya selalu aman.
 *
 * ## Mengapa satu catatan, bukan satu baris per produk
 *
 * Pencarian luring memuat seluruh katalog ke memori — lima ribu produk hanya
 * beberapa megabita, dan mencari di memori jauh lebih cepat daripada menyusuri
 * indeks IndexedDB untuk pencocokan sebagian. Karena selalu dibaca utuh,
 * memecahnya menjadi ribuan baris tidak memberi apa pun dan justru menambah
 * penyusuran kursor pada setiap pencarian.
 *
 * ## Batas tenant
 *
 * Setiap salinan membawa `tenantId`. Bila mesin yang sama dipakai masuk ke
 * tenant lain, salinan lama dibuang sebelum apa pun dibaca darinya. Menyajikan
 * katalog tenant A kepada tenant B bukan sekadar salah tampil — itu kebocoran
 * data lintas tenant, dan tidak boleh bergantung pada ingatan pemanggilnya.
 */

import type { JenisKatalog, ProdukLokal } from './katalog';

const NAMA_DB = 'ebisnis-pos-katalog';
const VERSI_DB = 1;
const TOKO = 'snapshot';
const KUNCI = 'aktif';

export interface TarifLokal {
  taxCategoryId: string;
  taxRateId: string;
  code: string;
  rate: number;
  isInclusive: boolean;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
}

export interface MetodeLokal {
  id: string;
  code: string;
  name: string;
  methodType: string;
  requiresReference: boolean;
  allowsChange: boolean;
}

export interface SalinanKatalog {
  tenantId: string;
  /** Waktu mesin ini menerima salinan; dasar seluruh perhitungan umur. */
  syncedAt: number;
  /** Waktu peladen menyusunnya. Disimpan untuk penelusuran, bukan untuk umur. */
  generatedAt: string;
  currency: string;
  timezone: string;
  productTotal: number;
  truncated: boolean;
  /** Tenant mengizinkan penjualan luring. Disalin supaya terbaca saat luring. */
  offlineSaleEnabled: boolean;
  produk: ProdukLokal[];
  taxRates: TarifLokal[];
  paymentMethods: MetodeLokal[];
}

/** Jenis katalog yang dicakup satu salinan; dipakai menilai kesegarannya. */
export const JENIS_DALAM_SALINAN: JenisKatalog[] = [
  'PRODUK',
  'BARCODE',
  'HARGA',
  'PAJAK',
  'METODE_BAYAR',
];

export function indexedDbTersedia(): boolean {
  return typeof indexedDB !== 'undefined';
}

function buka(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAMA_DB, VERSI_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(TOKO)) db.createObjectStore(TOKO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB tidak dapat dibuka'));
    req.onblocked = () =>
      reject(new Error('IndexedDB terkunci oleh tab lain. Tutup tab kasir yang lain.'));
  });
}

function selesai<T>(tx: IDBTransaction, hasil: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(hasil());
    tx.onerror = () => reject(tx.error ?? new Error('Transaksi IndexedDB gagal'));
    tx.onabort = () => reject(tx.error ?? new Error('Transaksi IndexedDB dibatalkan'));
  });
}

/** Menyimpan salinan katalog, menimpa yang lama seluruhnya. */
export async function simpanSalinan(s: SalinanKatalog): Promise<void> {
  const db = await buka();
  try {
    const tx = db.transaction(TOKO, 'readwrite');
    tx.objectStore(TOKO).put(s, KUNCI);
    await selesai(tx, () => undefined);
  } finally {
    db.close();
  }
}

/**
 * Membaca salinan milik tenant yang sedang masuk.
 *
 * Salinan milik tenant lain tidak dikembalikan dan langsung dibuang, bukan
 * sekadar diabaikan — membiarkannya berarti data tenant lain tetap ada di mesin
 * ini tanpa alasan.
 */
export async function bacaSalinan(tenantId: string): Promise<SalinanKatalog | null> {
  const db = await buka();
  try {
    const tx = db.transaction(TOKO, 'readonly');
    const req = tx.objectStore(TOKO).get(KUNCI);
    const isi = await selesai(tx, () => req.result as SalinanKatalog | undefined);
    if (!isi) return null;
    if (isi.tenantId !== tenantId) {
      db.close();
      await hapusSalinan();
      return null;
    }
    return isi;
  } finally {
    try {
      db.close();
    } catch {
      /* sudah tertutup pada jalur tenant tidak cocok */
    }
  }
}

export async function hapusSalinan(): Promise<void> {
  const db = await buka();
  try {
    const tx = db.transaction(TOKO, 'readwrite');
    tx.objectStore(TOKO).delete(KUNCI);
    await selesai(tx, () => undefined);
  } finally {
    db.close();
  }
}

/**
 * Meminta peramban tidak membuang penyimpanan ini saat ruang menipis.
 *
 * Tanpa ini, penyimpanan bersifat "best effort": peramban boleh membuangnya
 * kapan saja. Untuk katalog akibatnya ringan — tinggal disalin ulang — tetapi
 * permintaannya tetap diajukan supaya mesin kasir yang baru dinyalakan pagi
 * hari tidak menemukan katalognya lenyap justru ketika peladen sedang mati.
 *
 * Peramban boleh menolak, dan penolakannya bukan galat.
 */
export async function pastikanPermanen(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
