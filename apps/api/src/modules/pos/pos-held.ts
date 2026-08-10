/**
 * Aturan penyaring dan penyajian daftar transaksi tertahan.
 *
 * ## Mengapa murni
 *
 * Yang diputuskan di sini menentukan keranjang siapa yang terlihat oleh siapa.
 * Kasir yang tidak menemukan keranjangnya akan memindai ulang seluruh barang di
 * depan antrean; kasir yang melihat keranjang milik gerai lain akan
 * melanjutkannya, dan transaksi itu tercatat pada outlet yang salah.
 *
 * Keduanya tidak menghasilkan galat. Karena itu aturannya dipisahkan supaya
 * dapat dibuktikan tanpa basis data — sama seperti `pos-pricing.ts` dan
 * `pos-promotion.ts`.
 */

/** Batas jumlah baris yang boleh diminta sekali jalan. */
export const BATAS_BARIS_MAKS = 200;
export const BATAS_BARIS_BAWAAN = 50;

export interface PenyaringTertahan {
  /** `YYYY-MM-DD`. */
  dariTanggal: string | null;
  sampaiTanggal: string | null;
  /** Cocok pada nomor struk atau nama pelanggan. */
  kunci: string | null;
  outletId: string | null;
  terminalId: string | null;
  batas: number;
}

const POLA_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Membersihkan penyaring yang datang dari query string.
 *
 * Nilai yang tidak dapat dibaca **diabaikan**, bukan ditolak dengan galat.
 * Layar ini dibuka kasir yang sedang dikejar antrean; menolak seluruh halaman
 * karena satu tanggal salah ketik lebih buruk daripada menampilkan daftar penuh.
 * Satu-satunya yang tidak boleh longgar adalah id — lihat di bawah.
 */
export function bersihkanPenyaring(mentah: {
  from?: unknown;
  to?: unknown;
  q?: unknown;
  outletId?: unknown;
  terminalId?: unknown;
  limit?: unknown;
}): PenyaringTertahan {
  const tanggal = (nilai: unknown): string | null => {
    if (typeof nilai !== 'string') return null;
    const t = nilai.trim();
    if (!POLA_TANGGAL.test(t)) return null;
    // Tanggal yang bentuknya benar tetapi tidak ada (31 Februari) ditolak juga.
    const d = new Date(`${t}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || !d.toISOString().startsWith(t) ? null : t;
  };

  /*
   * Id yang tidak berbentuk UUID menjadi null, dan pemanggilnya memperlakukan
   * null sebagai "tanpa penyaring outlet".
   *
   * Itu TIDAK melonggarkan keamanan: pembatasan outlet yang sebenarnya
   * ditegakkan lapisan data scope pada layanan, bukan oleh penyaring ini.
   * Penyaring ini hanya mempersempit apa yang sudah boleh dilihat pengguna.
   */
  const id = (nilai: unknown): string | null => {
    if (typeof nilai !== 'string') return null;
    const t = nilai.trim();
    return POLA_UUID.test(t) ? t : null;
  };

  let dariTanggal = tanggal(mentah.from);
  let sampaiTanggal = tanggal(mentah.to);
  // Rentang terbalik ditukar, bukan dikosongkan: yang dimaksud jelas, dan
  // mengosongkannya diam-diam menampilkan seluruh riwayat tanpa ada yang tahu.
  if (dariTanggal && sampaiTanggal && dariTanggal > sampaiTanggal) {
    [dariTanggal, sampaiTanggal] = [sampaiTanggal, dariTanggal];
  }

  const kunciMentah = typeof mentah.q === 'string' ? mentah.q.trim() : '';

  const batasAngka = Number(mentah.limit);
  const batas = Number.isFinite(batasAngka)
    ? Math.min(Math.max(Math.trunc(batasAngka), 1), BATAS_BARIS_MAKS)
    : BATAS_BARIS_BAWAAN;

  return {
    dariTanggal,
    sampaiTanggal,
    kunci: kunciMentah.length > 0 ? kunciMentah : null,
    outletId: id(mentah.outletId),
    terminalId: id(mentah.terminalId),
    batas,
  };
}

export interface BarisTertahan {
  id: string;
  receiptNumber: string;
  businessDate: string;
  heldAt: string | null;
  outletId: string;
  outletName: string | null;
  terminalId: string | null;
  /** Nama mesin POS. Dipakai badge pada daftar (spesifikasi AIS §5, §12). */
  terminalName: string | null;
  customerName: string | null;
  currencyCode: string;
  grandTotal: string;
  itemCount: number;
  /** Benar bila baris ini ditahan pada terminal yang sedang dipakai. */
  dariMesinIni: boolean;
}

/**
 * Menandai baris yang berasal dari mesin yang sedang dipakai.
 *
 * Spesifikasi §5 menyorot badge mesin sendiri, dan alasannya praktis: gerai
 * dengan beberapa terminal menahan keranjang di mesin yang berbeda-beda, dan
 * kasir hampir selalu mencari keranjang yang ia sendiri tahan beberapa menit
 * lalu. Tanpa tanda itu ia membaca seluruh daftar satu per satu.
 */
export function tandaiMesinIni(
  baris: Omit<BarisTertahan, 'dariMesinIni'>[],
  terminalIni: string | null,
): BarisTertahan[] {
  return baris.map((b) => ({
    ...b,
    dariMesinIni: terminalIni !== null && b.terminalId === terminalIni,
  }));
}

/**
 * Mengurutkan: milik mesin ini lebih dahulu, lalu yang paling baru ditahan.
 *
 * Bukan sekadar kenyamanan. Keranjang yang paling mungkin dicari adalah yang
 * baru saja ditahan pada mesin yang sama — pembeli yang pergi mengambil satu
 * barang lagi biasanya kembali dalam hitungan menit.
 */
export function urutkanTertahan(baris: BarisTertahan[]): BarisTertahan[] {
  return [...baris].sort((a, b) => {
    if (a.dariMesinIni !== b.dariMesinIni) return a.dariMesinIni ? -1 : 1;
    const wa = a.heldAt ?? '';
    const wb = b.heldAt ?? '';
    if (wa !== wb) return wa < wb ? 1 : -1;
    return a.receiptNumber.localeCompare(b.receiptNumber);
  });
}
