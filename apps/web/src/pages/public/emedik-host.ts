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
  return hostname.toLowerCase().replace(/\.$/, '');
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
    return {
      kind: 'apotik',
      logoText: 'Rx',
      name: 'Apotik eMedik',
      homeUrl: 'https://apotik.emedik.id',
      description:
        'Landing dan akses apotik eMedik untuk pelayanan farmasi, stok obat, resep, pembelian, dan penjualan obat yang terhubung dengan operasional fasilitas kesehatan.',
      headerItems: [
        { labelKey: 'apotik.home', label: 'Beranda', url: 'https://apotik.emedik.id', sortOrder: 1 },
        { labelKey: 'apotik.features', label: 'Farmasi', url: 'https://apotik.emedik.id/#Farmasi', sortOrder: 2 },
        { labelKey: 'apotik.pos', label: 'POS Apotik', url: 'https://apotik.emedik.id/#POS-Apotik', sortOrder: 3 },
        { labelKey: 'apotik.documents', label: 'Dokumen', url: 'https://apotik.emedik.id/#Dokumen', sortOrder: 4 },
        { labelKey: 'apotik.proposal', label: 'Proposal', url: 'https://apotik.emedik.id/proposal', sortOrder: 5 },
      ],
      footer: [
        {
          code: 'APOTIK',
          title: 'Apotik',
          items: [
            { label: 'Landing apotik', url: 'https://apotik.emedik.id' },
            { label: 'Demo apotik', url: 'https://demo-apotik.emedik.id' },
            { label: 'Masuk apotik', url: 'https://apotik.emedik.id/masuk' },
          ],
        },
        {
          code: 'DOKUMEN',
          title: 'Dokumen',
          items: [
            { label: 'Proposal Penawaran', url: 'https://apotik.emedik.id/proposal' },
            { label: 'Surat Penawaran', url: 'https://apotik.emedik.id/penawaran' },
            { label: 'Presentasi', url: 'https://apotik.emedik.id/presentasi' },
            { label: 'Draft PKS', url: 'https://apotik.emedik.id/pks' },
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
    return {
      kind: 'emedik',
      logoText: 'eM',
      name: 'eMedik.id',
      homeUrl: 'https://emedik.id',
      description:
        'Sistem operasional terpadu untuk rumah sakit, klinik, puskesmas, posyandu, dan apotik: mulai dari pendaftaran, pelayanan klinis, farmasi, billing, hingga laporan.',
      headerItems: [
        { labelKey: 'emedik.home', label: 'Beranda', url: 'https://emedik.id', sortOrder: 1 },
        { labelKey: 'emedik.solutions', label: 'Solusi', url: 'https://emedik.id/#Solusi', sortOrder: 2 },
        { labelKey: 'emedik.flow', label: 'Alur', url: 'https://emedik.id/#Alur', sortOrder: 3 },
        { labelKey: 'emedik.security', label: 'Keamanan', url: 'https://emedik.id/#Keamanan', sortOrder: 4 },
        { labelKey: 'emedik.documents', label: 'Dokumen', url: 'https://emedik.id/#Dokumen', sortOrder: 5 },
      ],
      footer: [
        {
          code: 'EMEDIK',
          title: 'eMedik',
          items: [
            { label: 'Rumah Sakit', url: 'https://emedik.id/#rumah-sakit' },
            { label: 'Klinik', url: 'https://emedik.id/#klinik' },
            { label: 'Puskesmas', url: 'https://emedik.id/#puskesmas' },
            { label: 'Posyandu', url: 'https://emedik.id/#posyandu' },
          ],
        },
        {
          code: 'DOKUMEN',
          title: 'Dokumen',
          items: [
            { label: 'Proposal Penawaran', url: 'https://emedik.id/proposal' },
            { label: 'Surat Penawaran', url: 'https://emedik.id/penawaran' },
            { label: 'Presentasi', url: 'https://emedik.id/presentasi' },
            { label: 'Draft PKS', url: 'https://emedik.id/pks' },
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
