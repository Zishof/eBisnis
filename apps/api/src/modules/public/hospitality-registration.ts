/**
 * Aturan pendaftaran properti hospitality (MI-3) — bagian yang dapat
 * dibuktikan tanpa basis data.
 *
 * Pola sama persis dengan `pesantren-registration.ts`: dua nama yang tidak
 * boleh disamakan (`desiredUsername` menjadi nama schema PostgreSQL,
 * `slugSitus` menjadi label DNS), dan validasi bentuk dipisah dari
 * pendaftaran sungguhan supaya diuji sebagai fungsi murni.
 */

import { LABEL_TERPESAN } from '../../infrastructure/portal/portal-host';

/** Domain tempat situs properti berada. */
export const DOMAIN_MITRAINAP = 'mitrainap.id';

export interface Galat {
  field: string;
  code: string;
  message: string;
}

const POLA_LABEL_DNS = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Bolehkah slug ini dipakai sebagai alamat situs properti?
 *
 * `LABEL_TERPESAN` dipakai ulang dari katalog portal (satu sumber untuk
 * seluruh vertikal) -- lihat alasan yang sama pada
 * `pesantren-registration.ts`.
 */
export function slugSitusBoleh(slug: string): Galat | null {
  const bersih = slug.trim().toLowerCase();

  if (!bersih) {
    return { field: 'slugSitus', code: 'SLUG_KOSONG', message: 'Alamat situs wajib diisi.' };
  }
  if (LABEL_TERPESAN.has(bersih)) {
    return {
      field: 'slugSitus',
      code: 'SLUG_TERPESAN',
      message: `"${bersih}" dipesan platform dan tidak dapat dipakai.`,
    };
  }
  if (bersih.length < 3) {
    return {
      field: 'slugSitus',
      code: 'SLUG_TERLALU_PENDEK',
      message: 'Alamat situs minimal 3 karakter.',
    };
  }
  if (!POLA_LABEL_DNS.test(bersih)) {
    return {
      field: 'slugSitus',
      code: 'SLUG_TIDAK_SAH',
      message:
        'Alamat situs hanya boleh huruf kecil, angka, dan tanda hubung di tengah. ' +
        'Garis bawah tidak dapat dipakai pada alamat situs.',
    };
  }
  return null;
}

/** Menyusun usulan slug dari nama properti. Tetap melewati `slugSitusBoleh`. */
export function usulanSlugDariNama(nama: string): string {
  return nama
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');
}

/** Host penuh situs properti. */
export function hostSitus(slug: string): string {
  return `${slug.trim().toLowerCase()}.${DOMAIN_MITRAINAP}`;
}

/**
 * Menyusun usulan nama pengguna dari nama properti -- bentuk BERBEDA dari
 * slug situs (garis bawah, bukan tanda hubung; tidak boleh diawali angka)
 * sebab menjadi nama schema PostgreSQL. Lihat penjelasan penuh pada
 * `pesantren-registration.ts::usulanUsernameDariNama`, pola yang sama
 * diterapkan di sini tanpa disalin ulang perilakunya.
 */
export function usulanUsernameDariNama(nama: string): string {
  const dasar = nama
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!dasar) return '';

  const berhuruf = /^[a-z]/.test(dasar) ? dasar : `h${dasar}`;
  const dipotong = berhuruf.slice(0, 48).replace(/_+$/, '');
  return dipotong.length >= 3 ? dipotong : '';
}

export interface MasukanHospitality {
  namaProperti?: string;
  email?: string;
  desiredUsername?: string;
  slugSitus?: string;
  teleponPenanggungJawab?: string;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
}

const POLA_SUREL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Memeriksa seluruh masukan sekaligus, mengembalikan SEMUA galat (bukan
 * yang pertama) -- pola sama dengan `validasiPendaftaranPesantren`.
 */
export function validasiPendaftaranHospitality(masukan: MasukanHospitality): Galat[] {
  const galat: Galat[] = [];

  const nama = (masukan.namaProperti ?? '').trim();
  if (!nama) {
    galat.push({ field: 'namaProperti', code: 'WAJIB', message: 'Nama properti wajib diisi.' });
  } else if (nama.length > 255) {
    galat.push({ field: 'namaProperti', code: 'TERLALU_PANJANG', message: 'Nama properti maksimal 255 karakter.' });
  }

  const email = (masukan.email ?? '').trim();
  if (!email) {
    galat.push({ field: 'email', code: 'WAJIB', message: 'Surel wajib diisi.' });
  } else if (!POLA_SUREL.test(email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Bentuk surel tidak sah.' });
  }

  const slugGalat = slugSitusBoleh(masukan.slugSitus ?? '');
  if (slugGalat) galat.push(slugGalat);

  if (masukan.teleponPenanggungJawab != null && masukan.teleponPenanggungJawab.trim().length > 32) {
    galat.push({
      field: 'teleponPenanggungJawab',
      code: 'TERLALU_PANJANG',
      message: 'Nomor telepon maksimal 32 karakter.',
    });
  }

  if (!masukan.acceptTerms) {
    galat.push({ field: 'acceptTerms', code: 'WAJIB', message: 'Persetujuan syarat penggunaan wajib diberikan.' });
  }
  if (!masukan.acceptPrivacy) {
    galat.push({ field: 'acceptPrivacy', code: 'WAJIB', message: 'Persetujuan kebijakan privasi wajib diberikan.' });
  }

  return galat;
}
