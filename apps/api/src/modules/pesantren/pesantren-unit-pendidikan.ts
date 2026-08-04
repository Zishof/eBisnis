/**
 * Aturan unit pendidikan pesantren. Unit adalah fondasi untuk PSB, rombongan
 * belajar, kurikulum, dan kelak subdomain per unit.
 */

export const JENIS_UNIT_PENDIDIKAN = ['SEKOLAH_FORMAL', 'DINIYAH', 'TAHFIZ', 'LAINNYA'] as const;
export type JenisUnitPendidikan = (typeof JENIS_UNIT_PENDIDIKAN)[number];

export const KATEGORI_GAMBAR_UNIT_PENDIDIKAN = ['LOGO', 'HERO'] as const;
export type KategoriGambarUnitPendidikan = (typeof KATEGORI_GAMBAR_UNIT_PENDIDIKAN)[number];

export function kodeBerkasGambarUnit(unitId: string, kategori: KategoriGambarUnitPendidikan): string {
  return `PESANTREN_UNIT_${unitId}_${kategori}`;
}

export function lintasanGambarUnit(unitId: string, kategori: KategoriGambarUnitPendidikan): string {
  return `/api/v1/pesantren/public/unit-gambar/${unitId}/${kategori.toLowerCase()}`;
}

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanUnitPendidikan {
  code?: string;
  name?: string;
  jenis?: string;
  sortOrder?: number | null;
  isActive?: boolean;
  websiteEnabled?: boolean;
  publicSlug?: string | null;
  santriSubdomain?: string | null;
  customDomain?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  welcomeTitle?: string | null;
  welcomeBody?: string | null;
}

export function validasiUnitPendidikan(masukan: MasukanUnitPendidikan): Galat[] {
  const galat: Galat[] = [];
  const code = (masukan.code ?? '').trim();
  const name = (masukan.name ?? '').trim();

  if (!code) {
    galat.push({ field: 'code', code: 'WAJIB', message: 'Kode unit pendidikan wajib diisi.' });
  } else if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    galat.push({
      field: 'code',
      code: 'FORMAT_TIDAK_SAH',
      message: 'Kode hanya boleh huruf besar, angka, garis bawah, atau tanda hubung; 2-32 karakter.',
    });
  }

  if (!name) {
    galat.push({ field: 'name', code: 'WAJIB', message: 'Nama unit pendidikan wajib diisi.' });
  } else if (name.length > 160) {
    galat.push({ field: 'name', code: 'TERLALU_PANJANG', message: 'Nama unit pendidikan maksimal 160 karakter.' });
  }

  if (!JENIS_UNIT_PENDIDIKAN.includes(masukan.jenis as JenisUnitPendidikan)) {
    galat.push({ field: 'jenis', code: 'TIDAK_SAH', message: 'Jenis unit pendidikan tidak dikenal.' });
  }

  if (masukan.sortOrder != null && (!Number.isInteger(masukan.sortOrder) || masukan.sortOrder < 0)) {
    galat.push({ field: 'sortOrder', code: 'TIDAK_SAH', message: 'Urutan harus berupa bilangan bulat nol atau lebih.' });
  }

  if (masukan.publicSlug && !/^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$/.test(masukan.publicSlug)) {
    galat.push({ field: 'publicSlug', code: 'FORMAT_TIDAK_SAH', message: 'Slug halaman unit tidak sah.' });
  }
  if (masukan.santriSubdomain && !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(masukan.santriSubdomain)) {
    galat.push({ field: 'santriSubdomain', code: 'FORMAT_TIDAK_SAH', message: 'Subdomain santri.info tidak sah.' });
  }
  if (masukan.customDomain && !/^[a-z0-9.-]+$/.test(masukan.customDomain)) {
    galat.push({ field: 'customDomain', code: 'FORMAT_TIDAK_SAH', message: 'Domain kustom tidak sah.' });
  }
  if (masukan.logoUrl && masukan.logoUrl.length > 500) {
    galat.push({ field: 'logoUrl', code: 'TERLALU_PANJANG', message: 'URL logo unit maksimal 500 karakter.' });
  }
  if (masukan.heroImageUrl && masukan.heroImageUrl.length > 500) {
    galat.push({ field: 'heroImageUrl', code: 'TERLALU_PANJANG', message: 'URL gambar hero unit maksimal 500 karakter.' });
  }
  if (masukan.welcomeTitle && masukan.welcomeTitle.length > 180) {
    galat.push({ field: 'welcomeTitle', code: 'TERLALU_PANJANG', message: 'Judul sambutan maksimal 180 karakter.' });
  }

  return galat;
}
