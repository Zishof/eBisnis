/**
 * Buku besar kasir lokal — aturan murni, tanpa penyimpanan.
 *
 * Berkas ini menjawab dua pertanyaan yang muncul begitu kasir boleh berjualan
 * tanpa internet:
 *
 * 1. **Apakah catatan lokal masih utuh?** Data uang yang disimpan di peramban
 *    dapat disunting siapa pun yang membuka alat pengembang. Rantai hash
 *    membuat penyuntingan itu *terlihat* — tidak mencegahnya, tetapi
 *    catatan yang diam-diam berubah tidak lagi mungkin.
 *
 * 2. **Apa bedanya catatan lokal dengan catatan server?** Rekonsiliasi
 *    membandingkan keduanya dan menyebutkan selisihnya satu per satu, alih-alih
 *    hanya mengatakan "tidak cocok".
 *
 * ## Mengapa rantai hash, bukan tanda tangan
 *
 * Tanda tangan menuntut kunci rahasia, dan kunci rahasia yang disimpan di
 * peramban bukan rahasia. Rantai hash tidak menuntut rahasia apa pun: ia hanya
 * membuat setiap baris bergantung pada seluruh baris sebelumnya, sehingga satu
 * baris yang diubah memutus rantainya dan ketahuan saat diperiksa.
 *
 * Ini bukan pengganti audit server. Yang ditegakkan server tetap kebenaran
 * terakhir; yang ini menjawab pertanyaan berbeda — apakah yang tersimpan di
 * mesin kasir masih sama dengan yang dicatatnya dahulu.
 */

/** Satu catatan penjualan pada buku besar lokal. */
export interface CatatanLokal {
  /** Identitas yang dibuat mesin kasir, bukan server. Dipakai mencocokkan. */
  offlineId: string;
  /** Nomor urut dalam buku besar mesin ini. Selalu bertambah satu. */
  sequence: number;
  outletId: string;
  terminalId: string;
  shiftId: string;
  businessDate: string;
  /** Nilai akhir yang dibayar pembeli, sebagai string desimal. */
  grandTotal: string;
  itemCount: number;
  /** Saat transaksi terjadi menurut mesin kasir. */
  occurredAt: string;
  /** Nomor struk dari jatah yang dialokasikan saat masih daring. */
  receiptNumber: string | null;
  status: StatusLokal;
  /** Id penjualan di server, terisi setelah tersinkron. */
  serverSaleId: string | null;
  /**
   * Rincian yang diperlukan peladen untuk memutar ulang transaksi ini.
   *
   * Semula buku besar hanya menyimpan `grandTotal` dan `itemCount` — cukup untuk
   * membuktikan bahwa transaksinya ada dan nilainya berapa, tetapi tidak cukup
   * untuk mencatatnya di peladen. Tanpa rinciannya, transaksi luring hanya dapat
   * dilaporkan, tidak dapat dibukukan.
   */
  payload?: MuatanTransaksi | null;
  /**
   * Hash dari `payload`, ikut masuk ke rantai.
   *
   * Rinciannya sendiri tidak ikut dirangkai langsung supaya bahan hash tetap
   * berupa daftar medan yang tertulis tegas dan berurut. Yang dirangkai adalah
   * hash-nya, jadi mengubah satu baris barang tetap memutus rantai.
   *
   * Keduanya opsional, dan itu bukan kelonggaran melainkan keterangan: baris
   * yang ditulis versi sebelumnya — ketika buku besar hanya menyimpan total —
   * memang tidak memilikinya, dan tipe yang mewajibkannya akan berbohong tentang
   * apa yang benar-benar ada di mesin kasir.
   */
  payloadHash?: string | null;
  /** Hash baris ini; menutup seluruh medan di atas beserta hash sebelumnya. */
  hash: string;
  previousHash: string;
}

/** Satu baris barang sebagaimana tercetak pada struk pembeli. */
export interface BarisMuatan {
  productId: string;
  uomId: string | null;
  quantity: number;
  /** Harga satuan yang benar-benar ditagihkan, dari salinan katalog. */
  unitPrice: string;
  lineSubtotal: string;
  taxAmount: string;
  lineTotal: string;
  taxRateId: string | null;
}

/** Satu pembayaran sebagaimana diterima kasir. */
export interface PembayaranMuatan {
  paymentMethodId: string;
  amount: string;
  tenderedAmount: string | null;
  reference: string | null;
}

export interface MuatanTransaksi {
  lines: BarisMuatan[];
  payments: PembayaranMuatan[];
  subtotal: string;
  taxTotal: string;
  changeTotal: string;
  currencyCode: string;
  /**
   * Kapan salinan katalog yang dipakai menetapkan harga ini diambil.
   *
   * Dicatat supaya ketika peladen menghitung angka yang berbeda, pertanyaan
   * "harga versi kapan yang dipakai" punya jawaban — bukan dugaan.
   */
  catalogSyncedAt: string;
}

export type StatusLokal = 'PENDING' | 'SYNCED' | 'REJECTED';

/** Hash awal rantai; menandai bahwa tidak ada baris sebelum yang pertama. */
export const HASH_AWAL = '0'.repeat(64);

/**
 * Medan yang ikut dihitung ke dalam hash, berurut dan tetap.
 *
 * `payload` tidak termasuk — yang termasuk adalah `payloadHash`, yang menutupinya.
 */
type MedanTertutup = Omit<CatatanLokal, 'hash' | 'status' | 'serverSaleId' | 'payload'>;

/**
 * Menyusun teks kanonik dari rincian transaksi, untuk dihash.
 *
 * Ditulis medan per medan dengan urutan tetap, bukan `JSON.stringify(payload)`.
 * Urutan kunci pada JSON mengikuti urutan penyisipan, dan objek yang sama isinya
 * tetapi disusun berbeda menghasilkan teks berbeda — sehingga rantai tampak
 * putus padahal datanya utuh.
 */
export function bahanMuatan(m: MuatanTransaksi): string {
  const baris = m.lines
    .map((b) =>
      [
        b.productId,
        b.uomId ?? '',
        b.quantity,
        b.unitPrice,
        b.lineSubtotal,
        b.taxAmount,
        b.lineTotal,
        b.taxRateId ?? '',
      ].join('|'),
    )
    .join(';');
  const bayar = m.payments
    .map((p) => [p.paymentMethodId, p.amount, p.tenderedAmount ?? '', p.reference ?? ''].join('|'))
    .join(';');
  return [baris, bayar, m.subtotal, m.taxTotal, m.changeTotal, m.currencyCode, m.catalogSyncedAt].join(
    '#',
  );
}

export async function hashMuatan(m: MuatanTransaksi): Promise<string> {
  return hashSha256(bahanMuatan(m));
}

/**
 * Menyusun teks yang dihash.
 *
 * Urutan medannya tetap dan ditulis tegas, bukan hasil `Object.keys` — urutan
 * kunci objek dapat berbeda antar mesin, dan rantai yang bergantung padanya
 * akan tampak putus padahal datanya utuh.
 *
 * `status` dan `serverSaleId` sengaja TIDAK ikut: keduanya memang berubah
 * setelah baris dibuat (PENDING menjadi SYNCED). Yang tidak boleh berubah
 * adalah isi transaksinya.
 */
/**
 * Pemisah antar-medan pada bahan hash.
 *
 * Ditulis sebagai escape `\u001F`, BUKAN sebagai karakter harfiah.
 *
 * Semula ia memang karakter U+001F yang diketik langsung di dalam tanda kutip.
 * Karena tidak dapat dicetak, barisnya terbaca `.join('')` pada editor, diff,
 * dan tinjauan kode mana pun — sehingga siapa pun yang merapikan tanda kutip itu
 * akan mengubah SETIAP hash dan membatalkan seluruh rantai yang sudah tercatat,
 * dengan diff yang tampak tidak berubah sama sekali.
 *
 * Pemisahnya sendiri memang diperlukan. Tanpa pemisah, dua baris yang berbeda
 * dapat menghasilkan teks yang sama: outlet "AB" dengan terminal "C" tidak
 * dapat dibedakan dari outlet "A" dengan terminal "BC", dan keduanya lalu
 * menghasilkan hash yang identik. U+001F dipilih karena ia tidak mungkin muncul
 * di dalam id, tanggal, maupun nilai uang.
 *
 * Nilainya TIDAK boleh diubah: mengubahnya membatalkan seluruh buku besar yang
 * sudah tercatat pada mesin kasir mana pun.
 */
const PEMISAH_MEDAN = '\u001F';

export function bahanHash(c: MedanTertutup): string {
  return [
    c.sequence,
    c.offlineId,
    c.outletId,
    c.terminalId,
    c.shiftId,
    c.businessDate,
    c.grandTotal,
    c.itemCount,
    c.occurredAt,
    c.receiptNumber ?? '',
    c.previousHash,
    /*
     * Ditambahkan di ujung, dengan cadangan string kosong.
     *
     * Baris yang dicatat ketika buku besar baru menyimpan total — tanpa rincian
     * barang — menghasilkan teks yang persis sama seperti dahulu, sehingga hash
     * lamanya tetap sah dan rantainya tidak perlu dibangun ulang. Membangun ulang
     * rantai berarti menghitung ulang bukti keutuhan dari data yang justru sedang
     * dipertanyakan keutuhannya.
     */
    c.payloadHash ?? '',
  ].join(PEMISAH_MEDAN);
}

/** SHA-256 sebagai heksadesimal. Memakai WebCrypto yang ada di peramban. */
export async function hashSha256(teks: string): Promise<string> {
  const data = new TextEncoder().encode(teks);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Menghitung hash sebuah baris. */
export async function hitungHash(c: MedanTertutup): Promise<string> {
  return hashSha256(bahanHash(c));
}

export type AlasanRusak =
  | 'SEQUENCE_LOMPAT'
  | 'RANTAI_PUTUS'
  | 'HASH_TIDAK_COCOK'
  | 'MUATAN_TIDAK_COCOK'
  | 'AWAL_SALAH';

export interface TemuanRusak {
  sequence: number;
  offlineId: string;
  reason: AlasanRusak;
  message: string;
}

/**
 * Memeriksa keutuhan seluruh rantai.
 *
 * Mengembalikan SELURUH temuan, bukan berhenti pada yang pertama. Ketika buku
 * besar dipersoalkan, yang ditanyakan adalah "berapa banyak dan yang mana" —
 * dan jawaban yang berhenti pada baris pertama yang rusak tidak menjawabnya.
 */
export async function periksaRantai(baris: CatatanLokal[]): Promise<TemuanRusak[]> {
  const temuan: TemuanRusak[] = [];
  const urut = [...baris].sort((a, b) => a.sequence - b.sequence);

  let sebelumnya = HASH_AWAL;
  let harusnya = urut.length ? urut[0].sequence : 1;

  for (const c of urut) {
    if (c.sequence !== harusnya) {
      temuan.push({
        sequence: c.sequence,
        offlineId: c.offlineId,
        reason: 'SEQUENCE_LOMPAT',
        // Nomor yang melompat berarti ada baris yang hilang — kemungkinan
        // dihapus. Itu justru yang paling perlu diketahui.
        message: `Nomor urut melompat: diharapkan ${harusnya}, ditemukan ${c.sequence}. Ada baris yang hilang.`,
      });
      harusnya = c.sequence;
    }

    if (c.previousHash !== sebelumnya) {
      temuan.push({
        sequence: c.sequence,
        offlineId: c.offlineId,
        reason: 'RANTAI_PUTUS',
        message: 'Rantai putus: baris ini tidak menunjuk hash baris sebelumnya.',
      });
    }

    const seharusnya = await hitungHash(c);
    if (seharusnya !== c.hash) {
      temuan.push({
        sequence: c.sequence,
        offlineId: c.offlineId,
        reason: 'HASH_TIDAK_COCOK',
        message: 'Isi baris ini berubah setelah dicatat.',
      });
    }

    /*
     * Rincian barang diperiksa terpisah.
     *
     * `payloadHash` sudah ikut ke dalam rantai, jadi mengubahnya ketahuan. Tetapi
     * mengubah `payload` **tanpa** menyentuh `payloadHash` tidak akan memutus
     * rantai apa pun — dan itu justru penyuntingan yang paling menggoda: mengubah
     * jumlah barang pada satu transaksi sambil membiarkan totalnya tetap.
     */
    if (c.payload) {
      const muatan = await hashMuatan(c.payload);
      if (muatan !== c.payloadHash) {
        temuan.push({
          sequence: c.sequence,
          offlineId: c.offlineId,
          reason: 'MUATAN_TIDAK_COCOK',
          message: 'Rincian barang pada baris ini berubah setelah dicatat.',
        });
      }
    }

    sebelumnya = c.hash;
    harusnya += 1;
  }

  if (urut.length && urut[0].previousHash !== HASH_AWAL && urut[0].sequence === 1) {
    temuan.push({
      sequence: urut[0].sequence,
      offlineId: urut[0].offlineId,
      reason: 'AWAL_SALAH',
      message: 'Baris pertama tidak menunjuk awal rantai.',
    });
  }

  return temuan;
}

// --- Rekonsiliasi -----------------------------------------------------------

/** Bentuk ringkas catatan server, secukupnya untuk diadu. */
export interface CatatanServer {
  offlineId: string | null;
  saleId: string;
  receiptNumber: string | null;
  grandTotal: string;
  status: string;
}

export type JenisSelisih =
  | 'BELUM_TERSINKRON'
  | 'HANYA_DI_SERVER'
  | 'NILAI_BERBEDA'
  | 'DITOLAK_SERVER';

export interface Selisih {
  kind: JenisSelisih;
  offlineId: string | null;
  saleId: string | null;
  receiptNumber: string | null;
  localTotal: string | null;
  serverTotal: string | null;
  message: string;
}

export interface HasilRekonsiliasi {
  localCount: number;
  serverCount: number;
  matched: number;
  differences: Selisih[];
  /** Benar hanya bila tidak ada satu pun selisih. */
  balanced: boolean;
}

/**
 * Mengadu buku besar lokal dengan catatan server.
 *
 * Dicocokkan lewat `offlineId`, bukan nomor struk — nomor struk dapat kosong
 * pada transaksi yang belum tersinkron, dan mencocokkan dengan medan yang bisa
 * kosong akan memasangkan baris yang tidak berhubungan.
 *
 * Empat jenis selisih dibedakan karena tindak lanjutnya berbeda: yang belum
 * tersinkron perlu dikirim, yang hanya ada di server perlu ditanyakan asalnya,
 * yang nilainya berbeda perlu diperiksa manusia, dan yang ditolak server perlu
 * diketahui sebabnya.
 */
export function rekonsiliasi(
  lokal: CatatanLokal[],
  server: CatatanServer[],
): HasilRekonsiliasi {
  const petaServer = new Map<string, CatatanServer>();
  const serverTanpaOfflineId: CatatanServer[] = [];
  for (const s of server) {
    if (s.offlineId) petaServer.set(s.offlineId, s);
    else serverTanpaOfflineId.push(s);
  }

  const selisih: Selisih[] = [];
  let cocok = 0;

  for (const l of lokal) {
    const s = petaServer.get(l.offlineId);

    if (!s) {
      if (l.status === 'REJECTED') {
        selisih.push({
          kind: 'DITOLAK_SERVER',
          offlineId: l.offlineId,
          saleId: null,
          receiptNumber: l.receiptNumber,
          localTotal: l.grandTotal,
          serverTotal: null,
          message: 'Ditolak server dan tidak tercatat di sana. Perlu diperiksa sebabnya.',
        });
      } else {
        selisih.push({
          kind: 'BELUM_TERSINKRON',
          offlineId: l.offlineId,
          saleId: null,
          receiptNumber: l.receiptNumber,
          localTotal: l.grandTotal,
          serverTotal: null,
          message: 'Ada di mesin kasir, belum ada di server. Perlu dikirim.',
        });
      }
      continue;
    }

    petaServer.delete(l.offlineId);

    // Perbandingan nilai memakai Number, bukan teks: "50000" dan "50000.0000"
    // adalah nilai yang sama, dan melaporkannya sebagai selisih akan membuat
    // seluruh laporan ini tidak dipercaya.
    if (Number(l.grandTotal) !== Number(s.grandTotal)) {
      selisih.push({
        kind: 'NILAI_BERBEDA',
        offlineId: l.offlineId,
        saleId: s.saleId,
        receiptNumber: s.receiptNumber ?? l.receiptNumber,
        localTotal: l.grandTotal,
        serverTotal: s.grandTotal,
        message: `Nilai berbeda: mesin kasir ${l.grandTotal}, server ${s.grandTotal}.`,
      });
      continue;
    }

    cocok += 1;
  }

  // Sisa pada peta adalah baris server yang tidak punya pasangan lokal.
  for (const s of petaServer.values()) {
    selisih.push({
      kind: 'HANYA_DI_SERVER',
      offlineId: s.offlineId,
      saleId: s.saleId,
      receiptNumber: s.receiptNumber,
      localTotal: null,
      serverTotal: s.grandTotal,
      message: 'Ada di server, tidak ada di mesin kasir ini. Kemungkinan dari register lain.',
    });
  }

  return {
    localCount: lokal.length,
    // Penjualan daring biasa tidak punya offlineId dan memang tidak diharapkan
    // ada di buku besar mesin ini; ia dihitung tetapi tidak dilaporkan sebagai
    // selisih.
    serverCount: server.length,
    matched: cocok,
    differences: selisih,
    balanced: selisih.length === 0,
  };
}

/** Ringkasan sesingkat mungkin untuk ditampilkan pada batang status. */
export function ringkasanAntrean(baris: CatatanLokal[]): {
  pending: number;
  rejected: number;
  synced: number;
  pendingValue: string;
} {
  let pending = 0;
  let rejected = 0;
  let synced = 0;
  let nilai = 0;
  for (const c of baris) {
    if (c.status === 'PENDING') {
      pending += 1;
      nilai += Number(c.grandTotal);
    } else if (c.status === 'REJECTED') rejected += 1;
    else synced += 1;
  }
  return { pending, rejected, synced, pendingValue: String(nilai) };
}
