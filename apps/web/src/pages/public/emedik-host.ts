/**
 * Host publik eMedik.
 *
 * Keputusan ini hanya menentukan halaman pembuka. Otorisasi tenant, data
 * fasilitas, dan isi operasional tetap milik API.
 */

const EMEDIK_ROOT_HOSTS = ['emedik.id', 'www.emedik.id'];
const APOTIK_ROOT_HOSTS = ['apotik.emedik.id', 'www.apotik.emedik.id'];
const DEMO_APOTIK_HOST = 'demo-apotik.emedik.id';
const EMEDIK_TENANT_SUFFIX = '.emedik.id';

function normalizedHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function publicBaseFor(hostname: string, rootHost: string): { host: string; url: string; tenantName: string | null } {
  const host = normalizedHost(hostname);
  if (host === `www.${rootHost}`) return { host: rootHost, url: `https://${rootHost}`, tenantName: null };
  if (host === rootHost) return { host, url: `https://${host}`, tenantName: null };
  return { host, url: `https://${host}`, tenantName: null };
}

function emedikTenantName(hostname: string): string | null {
  const host = normalizedHost(hostname);
  if (EMEDIK_ROOT_HOSTS.includes(host) || isApotikHost(host)) return null;
  if (!host.endsWith(EMEDIK_TENANT_SUFFIX)) return null;
  const subdomain = host.slice(0, -EMEDIK_TENANT_SUFFIX.length);
  if (subdomain === 'demo') return 'Demo eMedik';
  return `${titleCaseSlug(subdomain)} eMedik`;
}

function apotikTenantName(hostname: string): string | null {
  const host = normalizedHost(hostname);
  if (APOTIK_ROOT_HOSTS.includes(host)) return null;
  if (host === DEMO_APOTIK_HOST) return 'Demo Apotik eMedik';
  if (!host.endsWith('-apotik.emedik.id')) return null;
  return `${titleCaseSlug(host.slice(0, -'-apotik.emedik.id'.length))} Apotik`;
}

export interface EmedikPublicBrand {
  kind: 'emedik' | 'apotik';
  logoText: string;
  name: string;
  homeUrl: string;
  description: string;
  headerItems: Array<{ labelKey: string; label: string; url: string; sortOrder: number }>;
  footer: Array<{
    code: string;
    title: string;
    items: Array<{ label: string; url: string }>;
  }>;
  loginTitle: string;
  loginSubtitle: string;
  demoLabel: string;
  registerLinkLabel: string;
  registerCtaLabel: string;
  registerTitle: string;
  registerSubtitle: string;
  businessNameLabel: string;
  businessTypeLabel: string;
  businessTypePlaceholder: string;
  includeSampleLabel: string;
  includeSampleHint: string;
  includeSampleAlways: string;
}

export function isEmedikHost(hostname: string = window.location.hostname): boolean {
  const host = normalizedHost(hostname);
  if (EMEDIK_ROOT_HOSTS.includes(host)) return true;
  if (isApotikHost(host)) return false;
  if (!host.endsWith(EMEDIK_TENANT_SUFFIX)) return false;

  const subdomain = host.slice(0, -EMEDIK_TENANT_SUFFIX.length);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain);
}

export function isApotikHost(hostname: string = window.location.hostname): boolean {
  const host = normalizedHost(hostname);
  return (
    APOTIK_ROOT_HOSTS.includes(host) ||
    host === DEMO_APOTIK_HOST ||
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?-apotik\.emedik\.id$/.test(host)
  );
}

export function isDemoApotikHost(hostname: string = window.location.hostname): boolean {
  return normalizedHost(hostname) === DEMO_APOTIK_HOST;
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

export function emedikPublicBrandFor(
  hostname: string = window.location.hostname,
): EmedikPublicBrand | null {
  if (isApotikHost(hostname)) {
    const base = publicBaseFor(hostname, 'apotik.emedik.id');
    const tenantName = apotikTenantName(hostname);
    return {
      kind: 'apotik',
      logoText: 'Rx',
      name: tenantName ?? 'Apotik eMedik',
      homeUrl: base.url,
      description:
        'Landing dan akses apotik eMedik untuk pelayanan farmasi, stok obat, resep, pembelian, dan penjualan obat yang terhubung dengan operasional fasilitas kesehatan.',
      headerItems: [
        { labelKey: 'apotik.home', label: 'Beranda', url: base.url, sortOrder: 1 },
        { labelKey: 'apotik.features', label: 'Farmasi', url: `${base.url}/#Farmasi`, sortOrder: 2 },
        { labelKey: 'apotik.pos', label: 'POS Apotik', url: `${base.url}/#POS-Apotik`, sortOrder: 3 },
        { labelKey: 'apotik.documents', label: 'Dokumen', url: `${base.url}/#Dokumen`, sortOrder: 4 },
        { labelKey: 'apotik.proposal', label: 'Proposal', url: `${base.url}/proposal`, sortOrder: 5 },
      ],
      footer: [
        {
          code: 'APOTIK',
          title: 'Apotik',
          items: [
            { label: 'Landing apotik', url: base.url },
            { label: 'Demo apotik', url: 'https://demo-apotik.emedik.id' },
            { label: 'Masuk apotik', url: `${base.url}/masuk` },
          ],
        },
        {
          code: 'DOKUMEN',
          title: 'Dokumen',
          items: [
            { label: 'Proposal Penawaran', url: `${base.url}/proposal` },
            { label: 'Surat Penawaran', url: `${base.url}/penawaran` },
            { label: 'Presentasi', url: `${base.url}/presentasi` },
            { label: 'Draft PKS', url: `${base.url}/pks` },
          ],
        },
      ],
      loginTitle: 'Masuk ke Apotik eMedik',
      loginSubtitle:
        'Gunakan akun apoteker, asisten apoteker, kasir farmasi, atau pemilik apotik yang terdaftar.',
      demoLabel: 'Coba Demo Apotik',
      registerLinkLabel: 'Daftarkan apotik Anda',
      registerCtaLabel: 'Daftar Apotik',
      registerTitle: 'Daftarkan Apotik',
      registerSubtitle:
        'Siapkan ruang kerja apotik, stok awal, contoh obat, dan akun pengelola farmasi secara otomatis.',
      businessNameLabel: 'Nama apotik',
      businessTypeLabel: 'Jenis layanan farmasi',
      businessTypePlaceholder: 'mis. Apotek umum, apotek klinik, instalasi farmasi',
      includeSampleLabel: 'Sertakan data contoh apotik',
      includeSampleHint:
        'Ruang kerja diisi contoh obat, supplier, pelanggan, satuan, dan alur transaksi farmasi agar demo langsung bisa dicoba.',
      includeSampleAlways:
        'Tetap dibuat walau data contoh dimatikan: satuan, bagan akun, pajak, metode pembayaran, nomor dokumen, peran, dan hak akses dasar.',
    };
  }

  if (isEmedikHost(hostname)) {
    const base = publicBaseFor(hostname, 'emedik.id');
    const tenantName = emedikTenantName(hostname);
    return {
      kind: 'emedik',
      logoText: 'eM',
      name: tenantName ?? 'eMedik.id',
      homeUrl: base.url,
      description:
        'Sistem operasional terpadu untuk rumah sakit, klinik, puskesmas, posyandu, dan apotik: mulai dari pendaftaran, pelayanan klinis, farmasi, billing, hingga laporan.',
      headerItems: [
        { labelKey: 'emedik.home', label: 'Beranda', url: base.url, sortOrder: 1 },
        { labelKey: 'emedik.solutions', label: 'Solusi', url: `${base.url}/#Solusi`, sortOrder: 2 },
        { labelKey: 'emedik.flow', label: 'Alur', url: `${base.url}/#Alur`, sortOrder: 3 },
        { labelKey: 'emedik.security', label: 'Keamanan', url: `${base.url}/#Keamanan`, sortOrder: 4 },
        { labelKey: 'emedik.documents', label: 'Dokumen', url: `${base.url}/#Dokumen`, sortOrder: 5 },
      ],
      footer: [
        {
          code: 'EMEDIK',
          title: 'eMedik',
          items: [
            { label: 'Rumah Sakit', url: `${base.url}/#rumah-sakit` },
            { label: 'Klinik', url: `${base.url}/#klinik` },
            { label: 'Puskesmas', url: `${base.url}/#puskesmas` },
            { label: 'Posyandu', url: `${base.url}/#posyandu` },
          ],
        },
        {
          code: 'DOKUMEN',
          title: 'Dokumen',
          items: [
            { label: 'Proposal Penawaran', url: `${base.url}/proposal` },
            { label: 'Surat Penawaran', url: `${base.url}/penawaran` },
            { label: 'Presentasi', url: `${base.url}/presentasi` },
            { label: 'Draft PKS', url: `${base.url}/pks` },
          ],
        },
      ],
      loginTitle: 'Masuk ke eMedik.id',
      loginSubtitle:
        'Gunakan akun dokter, perawat, farmasi, kasir, admin fasilitas, atau manajemen yang terdaftar.',
      demoLabel: 'Coba Demo eMedik',
      registerLinkLabel: 'Daftarkan fasilitas kesehatan',
      registerCtaLabel: 'Daftar Fasilitas',
      registerTitle: 'Daftarkan Fasilitas Kesehatan',
      registerSubtitle:
        'Siapkan ruang kerja rumah sakit, klinik, puskesmas, posyandu, atau apotik dengan data awal yang siap diuji.',
      businessNameLabel: 'Nama fasilitas kesehatan',
      businessTypeLabel: 'Jenis fasilitas',
      businessTypePlaceholder: 'mis. Klinik pratama, puskesmas, rumah sakit, posyandu',
      includeSampleLabel: 'Sertakan data contoh layanan kesehatan',
      includeSampleHint:
        'Ruang kerja diisi contoh pasien, layanan, obat, supplier, dan alur transaksi agar demo langsung bisa dicoba.',
      includeSampleAlways:
        'Tetap dibuat walau data contoh dimatikan: satuan, bagan akun, pajak, metode pembayaran, nomor dokumen, peran, dan hak akses dasar.',
    };
  }

  return null;
}
