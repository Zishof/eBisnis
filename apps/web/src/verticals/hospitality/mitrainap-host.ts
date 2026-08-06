/**
 * Mengenali kapan pengunjung datang lewat alamat mitrainap.id.
 *
 * Bentuknya mengikuti `santri-host.ts` (santri.info), yang menyelesaikan
 * persoalan yang sama: satu domain melayani DUA hal berbeda --
 *
 *   mitrainap.id                 → halaman portal MitraInap
 *   www.mitrainap.id             → halaman portal MitraInap
 *   <slug>.mitrainap.id          → situs PROPERTI (hotel/homestay), bukan portal
 *
 * Memperlakukan keduanya sama berarti setiap properti yang mendaftar
 * kehilangan situsnya sendiri dan hanya melihat halaman jualan platform.
 *
 * `slugPropertiDariHost` belum punya pemanggil -- belum ada penyewa
 * hospitality yang bisa didaftarkan (menyusul MI-5 Property Foundation).
 * Ditulis sekarang, bersamaan dengan pengenalan portalnya, supaya perilaku
 * host untuk MitraInap punya SATU tempat sejak awal alih-alih ditambal
 * terpisah saat properti pertama benar-benar didaftarkan.
 *
 * ## Ini BUKAN kontrol keamanan
 *
 * Pengenalan ini hanya menentukan tampilan. Properti mana yang datanya boleh
 * dibaca diputuskan API dari host permintaan lewat
 * `platform.vertical_site_domain` -- bukan di sini, dan bukan oleh peramban.
 */

/** Domain portal MitraInap. */
export const DOMAIN_MITRAINAP = 'mitrainap.id';

/**
 * Label yang dipesan platform dan karena itu tidak pernah menjadi slug properti.
 *
 * Sama dengan `LABEL_TERPESAN` pada
 * `apps/api/src/infrastructure/portal/portal-host.ts` -- diikat oleh
 * `mitrainap-host.test.ts`, yang menuntut kedua daftar tidak berselisih.
 */
export const LABEL_TERPESAN_MITRAINAP = new Set([
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
  'static',
  'media',
  'login',
  'register',
  'demo',
  'sandbox',
]);

/** Benar hanya untuk apex dan `www` -- yaitu halaman portal itu sendiri. */
export function isMitrainapPortalHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0];
  return host === DOMAIN_MITRAINAP || host === `www.${DOMAIN_MITRAINAP}`;
}

/**
 * Benar untuk seluruh host ekosistem mitrainap.id (portal maupun
 * `app.mitrainap.id`, pintu aplikasi bersama).
 *
 * Dipakai `AppLayout` untuk menukar lambang dan nama merek pada cangkang
 * aplikasi terautentikasi -- pola yang sama dengan `emedikPublicBrandFor()`.
 * BUKAN kontrol keamanan, sama seperti fungsi host lain pada berkas ini.
 */
export function isMitrainapAppHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0];
  return host === `app.${DOMAIN_MITRAINAP}`;
}

/**
 * Slug properti bila host berbentuk `<slug>.mitrainap.id`, atau null.
 *
 * Mengembalikan null untuk apex, untuk label terpesan platform, dan untuk
 * subdomain bertingkat -- pola sama dengan `slugPondokDariHost`.
 */
export function slugPropertiDariHost(hostname: string = window.location.hostname): string | null {
  const host = hostname.toLowerCase().replace(/\.$/, '').split(':')[0];
  const akhiran = `.${DOMAIN_MITRAINAP}`;

  if (!host.endsWith(akhiran)) return null;

  const slug = host.slice(0, -akhiran.length);
  if (!slug) return null;
  if (LABEL_TERPESAN_MITRAINAP.has(slug)) return null;
  if (slug.includes('.')) return null;
  if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return null;

  return slug;
}
