/**
 * Endpoint yang tetap boleh diakses saat pengguna wajib mengganti kata sandi.
 *
 * ## Cacat yang diperbaiki berkas ini
 *
 * Daftar ini semula hanya ada di `JwtAuthGuard`. `PermissionGuard`, yang
 * berjalan sesudahnya, menolak setiap pengguna ber-`mustChangePassword` **tanpa
 * pengecualian apa pun** — termasuk pada `/auth/change-password`.
 *
 * Akibatnya kebuntuan: kata sandi wajib diganti sebelum apa pun boleh diakses,
 * dan satu-satunya endpoint yang dapat menggantinya ikut terblokir. Setiap
 * penyewa yang baru mendaftar terjebak pada layar ganti kata sandi, menekan
 * tombol, dan menerima 403 tanpa keterangan yang berarti baginya.
 *
 * Cacatnya lolos karena aturannya ada di satu tempat dan penegakannya di dua
 * tempat. Karena itu daftarnya dipindahkan ke sini, dan kedua penjaga
 * memakainya — bukan menyalinnya.
 *
 * ## Mengapa daftar ini pendek
 *
 * Setiap entri adalah lubang pada pagar. Yang boleh masuk hanyalah yang
 * benar-benar dibutuhkan untuk keluar dari keadaan ini:
 *
 *   - mengganti kata sandinya (tujuan seluruh aturan ini);
 *   - keluar, bagi yang memilih tidak melanjutkan;
 *   - membaca identitas dirinya sendiri, supaya layarnya dapat digambar.
 *
 * Tidak ada endpoint yang mengubah data penyewa di sini, dan tidak boleh ada.
 */

export const PASSWORD_CHANGE_ALLOWLIST = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
  '/me/context',
] as const;

/**
 * Benar bila path ini boleh diakses meski kata sandi wajib diganti.
 *
 * Dicocokkan dengan akhiran karena path yang sampai ke penjaga membawa awalan
 * global (`/api/v1/...`), dan awalan itu dapat diatur lewat konfigurasi.
 * Mencocokkan seluruh path berarti mengunci daftar ini pada satu nilai awalan.
 */
export function bolehSaatWajibGantiKataSandi(path: string | undefined | null): boolean {
  /*
   * Path yang tidak terbaca berarti TIDAK diizinkan.
   *
   * Gagal-tertutup, bukan gagal-terbuka. Permintaan yang tidak dapat dikenali
   * alamatnya tidak boleh memperoleh keringanan yang hanya diperuntukkan bagi
   * empat alamat tertentu.
   */
  if (typeof path !== 'string' || !path) return false;

  // Query string dibuang lebih dahulu. `request.path` pada Express memang sudah
  // tanpa query, tetapi penjaga lain dapat memberi `originalUrl` — dan yang
  // membawa `?` tidak akan pernah cocok dengan akhiran mana pun.
  const bersih = path.split('?')[0].replace(/\/+$/, '');
  return PASSWORD_CHANGE_ALLOWLIST.some((diizinkan) => bersih.endsWith(diizinkan));
}
