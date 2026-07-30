/**
 * Mengenali kapan pengunjung datang lewat alamat marketplace.
 *
 * `belanja.ebisnis.id` dan `ebisnis.id/belanja` menyajikan aplikasi yang sama.
 * Yang berbeda hanya titik masuknya: pengunjung yang mengetik alamat
 * marketplace harus langsung melihat katalog, bukan halaman perusahaan.
 *
 * Pengenalan dilakukan di sisi peramban dan **hanya menentukan tampilan**.
 * Ia bukan kontrol keamanan: host yang menentukan data mana yang boleh dibaca
 * diputuskan API lewat `platform.marketplace_store_domain`, bukan di sini.
 * Membedakan keduanya penting — memindahkan keputusan otorisasi ke peramban
 * berarti menyerahkannya kepada siapa pun yang membuka alat pengembang.
 */

/** Awalan host yang berarti "ini pintu masuk marketplace". */
const MARKETPLACE_PREFIXES = ['belanja.', 'shop.', 'toko.'];

export function isMarketplaceHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase();

  // Membandingkan awalan, bukan mencari di mana pun: `jual.belanja.evil.com`
  // tidak boleh dianggap sebagai alamat marketplace.
  return MARKETPLACE_PREFIXES.some((prefix) => host.startsWith(prefix));
}

/**
 * Menentukan ke mana akar situs harus mengarah.
 *
 * Mengembalikan `null` bila akar sudah benar, sehingga pemanggil tidak perlu
 * membandingkan alamat dengan dirinya sendiri.
 */
export function rootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  if (pathname !== '/') return null;
  return isMarketplaceHost(hostname) ? '/belanja' : null;
}
