/**
 * Mengenali subdomain halaman pelanggan toko.
 *
 * Bentuk publik yang diminta adalah `pelanggan-{slug}.ebisnis.id`, misalnya
 * `pelanggan-demo.ebisnis.id`. Pemeriksaan ini hanya memilih tampilan awal di
 * peramban. Tenant mana yang boleh dilayani tetap harus diputuskan API/server
 * saat data sungguhan sudah tersambung.
 */

const AKAR_EBISNIS = 'ebisnis.id';
const AWALAN = 'pelanggan-';

function hostBersih(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function slugPelangganDariHost(hostname: string = window.location.hostname): string | null {
  const host = hostBersih(hostname);
  const suffix = `.${AKAR_EBISNIS}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain.startsWith(AWALAN)) return null;

  const slug = subdomain.slice(AWALAN.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/.test(slug)) return null;
  return slug;
}

export function isPelangganHost(hostname: string = window.location.hostname): boolean {
  return slugPelangganDariHost(hostname) !== null;
}

export function pelangganRootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  if (pathname !== '/') return null;
  const slug = slugPelangganDariHost(hostname);
  return slug ? `/pelanggan/${slug}` : null;
}
