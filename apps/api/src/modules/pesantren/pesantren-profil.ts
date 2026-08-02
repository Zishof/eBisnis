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

export const KATEGORI_GAMBAR_PROFIL = ['LOGO', 'HERO'] as const;
export type KategoriGambarProfil = (typeof KATEGORI_GAMBAR_PROFIL)[number];

/**
 * `code` `file_object` per kategori -- lihat `TenantFileBlobService.simpanTunggal`
 * (satu baris per code, mengunggah ulang mengganti isinya). Dipakai baik oleh
 * `PesantrenProfilService` (menulis) maupun `PesantrenPublicService` (membaca)
 * -- ditaruh di sini, bukan di salah satu service, supaya keduanya tidak
 * saling bergantung satu sama lain hanya demi satu konstanta.
 */
export const KODE_BERKAS_GAMBAR_PROFIL: Record<KategoriGambarProfil, string> = {
  LOGO: 'PESANTREN_LOGO',
  HERO: 'PESANTREN_HERO_BACKGROUND',
};

/**
 * Lintasan publik yang menyajikan gambar ini -- lihat
 * `PesantrenPublicController.gambar()`. Relatif (bukan URL penuh) supaya
 * benar pada domain mana pun `<pondok>.santri.info` dilayani.
 */
export function lintasanGambarProfil(kategori: KategoriGambarProfil): string {
  return `/api/v1/pesantren/public/gambar/${kategori.toLowerCase()}`;
}

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
  muqodimahHtml?: string | null;
  sejarahHtml?: string | null;
  visi?: string | null;
  misi?: string | null;
  pengasuh?: string | null;
  tahunBerdiri?: number | null;
  afiliasi?: string | null;
  logoUrl?: string | null;
  heroImageUrl?: string | null;
  heroImageAttribution?: string | null;
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
