/**
 * Pengaturan situs publik pondok (profil, tema tampilan) — bagian yang dapat
 * dibuktikan tanpa basis data. Pola sama dengan `pesantren-santri.ts`.
 */

export const TEMA_SITUS = [
  'HIJAU_ISLAMI',
  'EMAS_KHATULISTIWA',
  'BIRU_LANGIT',
  'COKLAT_KAYU',
  'UNGU_LEMBUT',
] as const;
export type TemaSitus = (typeof TEMA_SITUS)[number];

export interface Galat {
  field: string;
  code: string;
  message: string;
}

export interface MasukanProfil {
  isPublished?: boolean;
  themeCode?: string;
  namaTampilan?: string | null;
  tagline?: string | null;
  sejarahHtml?: string | null;
  visi?: string | null;
  misi?: string | null;
  pengasuh?: string | null;
  tahunBerdiri?: number | null;
  afiliasi?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  alamatPublik?: string | null;
  kontakTelepon?: string | null;
  kontakWhatsapp?: string | null;
  kontakEmail?: string | null;
  mapEmbedUrl?: string | null;
  instagramUrl?: string | null;
  metaDescription?: string | null;
}

export function validasiProfil(masukan: MasukanProfil): Galat[] {
  const galat: Galat[] = [];

  if (masukan.themeCode && !TEMA_SITUS.includes(masukan.themeCode as TemaSitus)) {
    galat.push({
      field: 'themeCode',
      code: 'TIDAK_DIKENALI',
      message: `Tema tidak dikenali. Pilih salah satu: ${TEMA_SITUS.join(', ')}.`,
    });
  }

  if (
    masukan.tahunBerdiri != null &&
    (masukan.tahunBerdiri < 1900 || masukan.tahunBerdiri > new Date().getFullYear())
  ) {
    galat.push({ field: 'tahunBerdiri', code: 'TIDAK_SAH', message: 'Tahun berdiri tidak masuk akal.' });
  }

  if (masukan.kontakEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(masukan.kontakEmail)) {
    galat.push({ field: 'kontakEmail', code: 'TIDAK_SAH', message: 'Alamat surel tidak sah.' });
  }

  if (masukan.isPublished) {
    const nama = (masukan.namaTampilan ?? '').trim();
    if (!nama) {
      galat.push({
        field: 'namaTampilan',
        code: 'WAJIB',
        message: 'Nama tampilan wajib diisi sebelum situs diterbitkan.',
      });
    }
  }

  return galat;
}
