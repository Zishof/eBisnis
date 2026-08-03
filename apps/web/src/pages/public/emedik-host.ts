/**
 * Host publik eMedik.
 *
 * Keputusan ini hanya menentukan halaman pembuka. Otorisasi tenant, data
 * fasilitas, dan isi operasional tetap milik API.
 */

const EMEDIK_ROOT_HOSTS = ['emedik.id', 'www.emedik.id'];
const APOTIK_ROOT_HOSTS = ['apotik.emedik.id', 'www.apotik.emedik.id'];
const DEMO_APOTIK_HOST = 'demo-apotik.emedik.id';

export function isEmedikHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase();
  return EMEDIK_ROOT_HOSTS.includes(host);
}

export function isApotikHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase();
  return (
    APOTIK_ROOT_HOSTS.includes(host) ||
    host === DEMO_APOTIK_HOST ||
    host.endsWith('-apotik.emedik.id')
  );
}

export function isDemoApotikHost(hostname: string = window.location.hostname): boolean {
  return hostname.toLowerCase() === DEMO_APOTIK_HOST;
}

export function rootExperienceFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): 'emedik' | 'apotik' | 'demo-apotik' | null {
  if (pathname !== '/') return null;
  if (isDemoApotikHost(hostname)) return 'demo-apotik';
  if (isApotikHost(hostname)) return 'apotik';
  if (isEmedikHost(hostname)) return 'emedik';
  return null;
}
