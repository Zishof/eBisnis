/**
 * Ke mana pengguna diantar sesudah masuk.
 *
 * ## Mengapa fungsi tersendiri
 *
 * Keputusannya punya tiga aturan yang tidak terbaca dari kodenya bila ditulis
 * sebagai rantai syarat di dalam penangan formulir: tujuan yang tadinya diminta
 * menang atas segalanya, staf platform menang atas vertikal, dan vertikal yang
 * belum punya beranda jatuh ke bawaan alih-alih ke alamat yang belum ada.
 * Ketiganya diuji di sini, bukan lewat menggambar halaman masuk.
 *
 * ## Mengapa lewat sesi, bukan lewat alamat
 *
 * Kata sandi buatan peladen **wajib** diganti saat masuk pertama — dan
 * pendaftar pesantren selalu memperoleh kata sandi buatan peladen. Masuk
 * pertama karena itu selalu berbelok ke halaman ganti kata sandi, yang berakhir
 * dengan masuk sekali lagi.
 *
 * Tujuan yang dititipkan pada alamat (`?lanjut=`) tidak selamat melewati
 * belokan itu. Vertikal pada sesi selamat, sebab ia dibaca ulang setiap kali
 * masuk.
 */

export const VERTIKAL_PESANTREN = 'PESANTREN';

/** Beranda tiap vertikal. Yang tidak terdaftar memakai beranda bawaan. */
const BERANDA: Record<string, string> = {
  [VERTIKAL_PESANTREN]: '/pesantren',
};

export const BERANDA_BAWAAN = '/app';
export const BERANDA_STAF_PLATFORM = '/platform';

export interface SesiRingkas {
  isPlatformStaff: boolean;
  tenant: { verticalCode: string | null } | null;
}

/**
 * Alamat beranda untuk sesi ini.
 *
 * `tujuanDiminta` adalah halaman yang tadinya hendak dibuka sebelum diminta
 * masuk. Ia menang atas beranda vertikal: orang yang menekan tautan menuju
 * halaman tertentu bermaksud membukanya, bukan berandanya.
 */
export function berandaSesudahMasuk(sesi: SesiRingkas, tujuanDiminta?: string | null): string {
  if (tujuanDiminta) return tujuanDiminta;

  /*
   * Staf platform diperiksa lebih dahulu.
   *
   * Staf yang kebetulan juga anggota sebuah penyewa tetap harus mendarat di
   * konsol platform. Kalau vertikal menang, staf yang menolong satu pondok
   * kehilangan konsolnya sampai keanggotaan itu dicabut.
   */
  if (sesi.isPlatformStaff) return BERANDA_STAF_PLATFORM;

  const vertikal = sesi.tenant?.verticalCode ?? null;
  if (!vertikal) return BERANDA_BAWAAN;

  return BERANDA[vertikal] ?? BERANDA_BAWAAN;
}
