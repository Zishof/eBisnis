/**
 * Subdomain contoh usaha salon.
 *
 * `salon.ebisnis.id` masuk ke halaman contoh salon. Pemeriksaan ini hanya
 * menentukan tampilan awal di browser; saat contoh ini menjadi tenant sungguhan,
 * otorisasi dan pemilihan data tetap harus terjadi di server.
 */

function hostBersih(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function isSalonDemoHost(hostname: string = window.location.hostname): boolean {
  const host = hostBersih(hostname);
  return host === 'salon.ebisnis.id' || host === 'salon.ebisinis.id';
}

export function salonRootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  if (pathname !== '/') return null;
  return isSalonDemoHost(hostname) ? '/contoh/salon' : null;
}
