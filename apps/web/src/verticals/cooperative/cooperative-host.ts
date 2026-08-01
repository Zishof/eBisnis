/**
 * Mengenali kapan pengunjung datang lewat alamat koperasi.
 *
 * `koperasi.ebisnis.id` menyajikan aplikasi yang sama dengan `ebisnis.id`.
 * Yang berbeda hanya titik masuknya: orang yang mengetik alamat koperasi harus
 * langsung melihat situs koperasinya, bukan halaman perusahaan eBisnis.
 *
 * Tanpa ini, subdomainnya menjawab 200 dan tampak "berhasil dipasang" —
 * sementara satu-satunya jalan menuju situs koperasi adalah mengetik
 * `/ekoperasi/situs`, alamat yang tidak akan pernah ditebak pengunjung.
 *
 * Bentuknya mengikuti `pages/belanja/marketplace-host.ts`, yang sudah
 * menyelesaikan persoalan yang sama untuk `belanja.ebisnis.id`. Menirunya
 * disengaja: dua cara berbeda untuk hal yang sama akan berbeda pula perilakunya
 * di kemudian hari.
 *
 * ## Ini BUKAN kontrol keamanan
 *
 * Pengenalan ini hanya menentukan **tampilan**. Koperasi mana yang datanya
 * boleh dibaca diputuskan API dari host permintaan lewat
 * `platform.vertical_site_domain` (IR-005) — bukan di sini, dan bukan oleh
 * peramban. Membedakan keduanya penting: memindahkan keputusan otorisasi ke
 * peramban berarti menyerahkannya kepada siapa pun yang membuka alat
 * pengembang.
 */

/** Awalan host yang berarti "ini pintu masuk koperasi". */
const COOPERATIVE_PREFIXES = ['koperasi.', 'ekoperasi.'];

export function isCooperativeHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase();

  /*
   * Membandingkan awalan, bukan mencari di mana pun: `koperasi.jahat.com` tetap
   * dianggap alamat koperasi (memang begitu bentuknya), tetapi
   * `bukan-koperasi.ebisnis.id` dan `jual.koperasi.evil.com` tidak.
   */
  return COOPERATIVE_PREFIXES.some((prefix) => host.startsWith(prefix));
}

/**
 * Menentukan ke mana akar situs harus mengarah.
 *
 * Mengembalikan `null` bila akar sudah benar, sehingga pemanggil tidak perlu
 * membandingkan alamat dengan dirinya sendiri.
 */
export function cooperativeRootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  // Hanya akar yang dialihkan. Pengunjung yang sudah membuka halaman lain
  // sedang berada di tempat yang ia maksud.
  if (pathname !== '/') return null;
  return isCooperativeHost(hostname) ? '/ekoperasi/situs' : null;
}
