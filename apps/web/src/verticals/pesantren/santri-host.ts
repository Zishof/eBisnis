/**
 * Mengenali kapan pengunjung datang lewat alamat santri.info.
 *
 * `santri.info` menyajikan aplikasi yang sama dengan `ebisnis.id`. Yang berbeda
 * hanya titik masuknya: orang yang mengetik `santri.info` harus langsung melihat
 * halaman ePesantren, bukan halaman perusahaan eBisnis.
 *
 * Bentuknya mengikuti `cooperative-host.ts` dan `marketplace-host.ts`, yang
 * sudah menyelesaikan persoalan yang sama. Menirunya disengaja: dua cara berbeda
 * untuk hal yang sama akan berbeda pula perilakunya di kemudian hari.
 *
 * ## Perbedaan penting dari koperasi
 *
 * Koperasi dikenali dari **awalan** (`koperasi.ebisnis.id`). santri.info tidak
 * dapat begitu, sebab di sini ada DUA hal yang berbeda pada domain yang sama:
 *
 *   santri.info                  → halaman portal ePesantren
 *   www.santri.info              → halaman portal ePesantren
 *   ponpes-demo.santri.info   → situs PONDOK, bukan portal
 *
 * Memperlakukan keduanya sama berarti setiap pondok yang mendaftar kehilangan
 * situsnya sendiri dan hanya melihat halaman jualan platform.
 *
 * ## Ini BUKAN kontrol keamanan
 *
 * Pengenalan ini hanya menentukan **tampilan**. Pondok mana yang datanya boleh
 * dibaca diputuskan API dari host permintaan lewat
 * `platform.vertical_site_domain` — bukan di sini, dan bukan oleh peramban.
 * Memindahkan keputusan otorisasi ke peramban berarti menyerahkannya kepada
 * siapa pun yang membuka alat pengembang.
 */

/** Domain portal ePesantren. */
export const DOMAIN_SANTRI = 'santri.info';

/**
 * Label yang dipesan platform dan karena itu tidak pernah menjadi slug pondok.
 *
 * `app.santri.info` adalah pintu aplikasi yang benar-benar terdaftar. Tanpa
 * daftar ini, peramban yang membukanya akan menyimpulkan ada pondok bernama
 * "app" dan mencarinya — pencarian yang tidak akan pernah ketemu, pada halaman
 * yang seharusnya menampilkan aplikasi.
 *
 * Isinya sengaja sama dengan `LABEL_TERPESAN` pada
 * `apps/api/src/infrastructure/portal/portal-host.ts`. Penyalinan ini disengaja:
 * yang mengikat keduanya adalah `santri-host.test.ts`, yang membaca berkas API
 * itu dan menuntut kedua daftar tidak berselisih. Yang menegakkan larangannya
 * tetap sisi API — di sini ia hanya mencegah salah tampil.
 */
export const LABEL_TERPESAN_SANTRI = new Set([
  'www',
  'app',
  'auth',
  'api',
  'admin',
  'console',
  'support',
  'status',
  'docs',
  'assets',
  'cdn',
  'mail',
]);

/**
 * Benar hanya untuk apex dan `www` — yaitu halaman portal itu sendiri.
 */
export function isSantriPortalHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0];
  return host === DOMAIN_SANTRI || host === `www.${DOMAIN_SANTRI}`;
}

/**
 * Slug pondok bila host berbentuk `<slug>.santri.info`, atau null.
 *
 * Mengembalikan null untuk apex, untuk label terpesan platform, dan untuk
 * subdomain bertingkat (`a.b.santri.info`). Yang bertingkat ditolak dengan
 * sengaja: ia tidak pernah dibuat pendaftaran, jadi kemunculannya berarti
 * seseorang sedang mencoba sesuatu.
 */
export function slugPondokDariHost(hostname: string = window.location.hostname): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0];
  const akhiran = `.${DOMAIN_SANTRI}`;

  if (!host.endsWith(akhiran)) return null;

  const slug = host.slice(0, -akhiran.length);
  if (!slug) return null;
  if (LABEL_TERPESAN_SANTRI.has(slug)) return null;
  // Hanya satu tingkat.
  if (slug.includes('.')) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return null;

  return slug;
}

/**
 * Benar bila host ini milik ekosistem santri.info — portal maupun pondok.
 *
 * Dipakai memilih merek dan tautan; bukan untuk memutuskan data siapa yang
 * boleh dibaca.
 */
export function isSantriHost(hostname: string = window.location.hostname): boolean {
  return isSantriPortalHost(hostname) || slugPondokDariHost(hostname) !== null;
}
