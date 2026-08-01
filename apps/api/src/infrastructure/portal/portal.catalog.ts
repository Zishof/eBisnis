/**
 * Katalog lima portal ekosistem.
 *
 * ## Mengapa ini data, bukan lima penyebaran
 *
 * Kelima merek dilayani satu aplikasi (§54). Yang membedakan jawaban untuk
 * `ebisnis.id` dan `emedik.id` adalah baris yang diseed dari sini — bukan lima
 * salinan kode, lima basis data, atau lima berkas konfigurasi.
 *
 * ## Mengapa host ditulis lengkap di sini
 *
 * Host tidak disusun dari kode portal (`EMEDIK` → `emedik.id`). Dua di
 * antaranya tidak mengikuti pola itu — `enterprise-education.id` memakai tanda
 * hubung, `info-desa.id` juga — dan aturan yang benar untuk tiga dari lima
 * adalah aturan yang salah.
 *
 * Host `auth` sengaja **satu untuk seluruh portal**: §521 menuntut hanya ada
 * satu penerbit identitas yang berwenang. Lima penerbit berarti lima sumber
 * kebenaran tentang siapa yang sedang masuk.
 */

export type PeranHostKatalog = 'PUBLIC' | 'APP' | 'AUTH';

export interface DomainKatalog {
  host: string;
  kind: PeranHostKatalog;
  isCanonical: boolean;
}

export interface PortalKatalog {
  code: string;
  name: string;
  tagline: string;
  verticalCode: string;
  brandPrimary: string;
  brandAccent: string;
  sortOrder: number;
  domains: DomainKatalog[];
  /** Keterangan singkat yang dipakai portal LAIN saat menautkannya (§487). */
  crossLinkDescription: string;
}

/** Satu penerbit identitas untuk seluruh ekosistem (§521). */
export const HOST_AUTH_KANONIK = 'auth.ebisnis.id';

export const KATALOG_PORTAL: PortalKatalog[] = [
  {
    code: 'EBISNIS',
    name: 'eBisnis.id',
    tagline: 'ERP, POS, Finance, HR, dan Marketplace dalam satu platform.',
    verticalCode: 'CORE_ERP',
    brandPrimary: '#0F172A',
    brandAccent: '#2563EB',
    sortOrder: 1,
    crossLinkDescription: 'ERP, POS, Finance, HR, Marketplace',
    domains: [
      { host: 'ebisnis.id', kind: 'PUBLIC', isCanonical: true },
      { host: 'www.ebisnis.id', kind: 'PUBLIC', isCanonical: false },
      { host: 'app.ebisnis.id', kind: 'APP', isCanonical: true },
      { host: HOST_AUTH_KANONIK, kind: 'AUTH', isCanonical: true },
    ],
  },
  {
    code: 'ENTERPRISE_EDUCATION',
    name: 'Enterprise Education',
    tagline: 'eCampus, eSchool, dan ePesantren di atas core yang sama.',
    verticalCode: 'ENTERPRISE_EDUCATION',
    brandPrimary: '#1E3A5F',
    brandAccent: '#0891B2',
    sortOrder: 2,
    crossLinkDescription: 'eCampus, eSchool, ePesantren',
    domains: [
      { host: 'enterprise-education.id', kind: 'PUBLIC', isCanonical: true },
      { host: 'www.enterprise-education.id', kind: 'PUBLIC', isCanonical: false },
      { host: 'app.enterprise-education.id', kind: 'APP', isCanonical: true },
    ],
  },
  {
    code: 'EMEDIK',
    name: 'eMedik.id',
    tagline: 'Rumah sakit, klinik, puskesmas, dan posyandu.',
    verticalCode: 'HEALTH',
    brandPrimary: '#134E4A',
    brandAccent: '#14B8A6',
    sortOrder: 3,
    crossLinkDescription: 'Rumah Sakit, Klinik, Puskesmas, Posyandu',
    domains: [
      { host: 'emedik.id', kind: 'PUBLIC', isCanonical: true },
      { host: 'www.emedik.id', kind: 'PUBLIC', isCanonical: false },
      { host: 'app.emedik.id', kind: 'APP', isCanonical: true },
    ],
  },
  {
    code: 'EKOPERASI',
    name: 'eKoperasi.id',
    tagline: 'Keanggotaan, simpan pinjam, RAT, dan SHU.',
    verticalCode: 'COOPERATIVE',
    brandPrimary: '#14532D',
    brandAccent: '#16A34A',
    sortOrder: 4,
    crossLinkDescription: 'Keanggotaan, Simpan Pinjam, RAT, SHU',
    domains: [
      { host: 'ekoperasi.id', kind: 'PUBLIC', isCanonical: true },
      { host: 'www.ekoperasi.id', kind: 'PUBLIC', isCanonical: false },
      { host: 'app.ekoperasi.id', kind: 'APP', isCanonical: true },
    ],
  },
  {
    code: 'INFO_DESA',
    name: 'info-desa.id',
    tagline: 'Penduduk, layanan warga, APBDes, dan BUMDes.',
    verticalCode: 'VILLAGE_GOVERNMENT',
    brandPrimary: '#78350F',
    brandAccent: '#D97706',
    sortOrder: 5,
    crossLinkDescription: 'Penduduk, Layanan Warga, APBDes, BUMDes',
    domains: [
      { host: 'info-desa.id', kind: 'PUBLIC', isCanonical: true },
      { host: 'www.info-desa.id', kind: 'PUBLIC', isCanonical: false },
      { host: 'app.info-desa.id', kind: 'APP', isCanonical: true },
    ],
  },
];

/** Seluruh host yang dipakai katalog, untuk dipakai konfigurasi penyebaran. */
export function seluruhHost(peran?: PeranHostKatalog): string[] {
  const hasil = new Set<string>();
  for (const p of KATALOG_PORTAL) {
    for (const d of p.domains) {
      if (!peran || d.kind === peran) hasil.add(d.host);
    }
  }
  return [...hasil].sort();
}
