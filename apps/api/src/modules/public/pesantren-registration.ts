/**
 * Aturan pendaftaran pondok pesantren — bagian yang dapat dibuktikan tanpa
 * basis data.
 *
 * ## Mengapa terpisah dan murni
 *
 * Pendaftaran menghasilkan schema, host, dan credential sekaligus. Kesalahannya
 * mahal dan sebagian tidak dapat ditarik kembali: schema yang telanjur dibuat,
 * host yang telanjur diklaim. Karena itu aturannya diuji sebagai fungsi, bukan
 * lewat pendaftaran sungguhan yang menyisakan jejak.
 *
 * ## Dua nama yang tidak boleh disamakan
 *
 * `desiredUsername` menjadi **nama schema**: `^[a-z][a-z0-9_]{2,47}$` — boleh
 * garis bawah.
 * `slugSitus` menjadi **label DNS**: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$` —
 * tidak boleh garis bawah.
 *
 * Menyamakan keduanya membuat pondok bernama `ponpes_demo` memperoleh host
 * `ponpes_demo.santri.info`, yang tidak sah sebagai nama host. Situsnya
 * terdaftar, tercatat aktif, dan tidak pernah dapat dibuka siapa pun.
 */

import { LABEL_TERPESAN } from '../../infrastructure/portal/portal-host';

/** Domain tempat situs pondok berada. */
export const DOMAIN_PESANTREN = 'santri.info';

export const TIPE_PESANTREN = ['SALAFIYAH', 'KHALAFIYAH', 'KOMBINASI'] as const;
export type TipePesantren = (typeof TIPE_PESANTREN)[number];

export const SANTRI_DILAYANI = ['PUTRA', 'PUTRI', 'PUTRA_PUTRI'] as const;
export type SantriDilayani = (typeof SANTRI_DILAYANI)[number];

/** Jenjang yang boleh dipilih pondok. */
export const JENJANG_PESANTREN = [
  { code: 'DINIYAH_TAKMILIYAH', label: 'Madrasah Diniyah Takmiliyah' },
  { code: 'DINIYAH_FORMAL', label: 'Pendidikan Diniyah Formal' },
  { code: 'MUADALAH', label: 'Satuan Pendidikan Muadalah' },
  { code: 'TAHFIZ', label: 'Program Tahfiz' },
  { code: 'MI', label: 'MI / SD' },
  { code: 'MTS', label: 'MTs / SMP' },
  { code: 'MA', label: 'MA / SMA / SMK' },
  { code: 'MAHAD_ALY', label: "Ma'had Aly" },
  { code: 'PAUD_RA', label: 'PAUD / RA' },
  { code: 'KESETARAAN', label: 'Pendidikan Kesetaraan (Paket A/B/C)' },
] as const;

const KODE_JENJANG = new Set(JENJANG_PESANTREN.map((j) => j.code as string));

export const AFILIASI_PESANTREN = [
  'Nahdlatul Ulama',
  'Muhammadiyah',
  'Persis',
  'Al-Washliyah',
  'Mathlaul Anwar',
  'Independen',
  'Lainnya',
] as const;

export interface Galat {
  field: string;
  code: string;
  message: string;
}

const POLA_LABEL_DNS = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Bolehkah slug ini dipakai sebagai alamat situs pondok?
 *
 * Label terpesan dipakai ulang dari katalog portal, tidak ditulis ulang. Kalau
 * ditulis ulang, `app.santri.info` dapat diklaim seorang pondok — dan pondok itu
 * lalu menerima setiap permintaan yang ditujukan ke pintu aplikasi.
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

/**
 * Menyusun usulan slug dari nama pondok.
 *
 * Dipakai mengisi kolom lebih dahulu, bukan memutuskan. Yang dihasilkan tetap
 * melewati `slugSitusBoleh` — usulan yang tidak sah adalah usulan yang menolak
 * dirinya sendiri, dan itu lebih baik daripada diam-diam dipakai.
 */
export function usulanSlugDariNama(nama: string): string {
  const dasar = nama
    .toLowerCase()
    .normalize('NFD')
    /*
     * Membuang tanda gabung hasil NFD, supaya nama beraksen tidak menyisakan
     * karakter yang tidak sah pada host.
     *
     * Urutannya penting: bila baris ini ditaruh SESUDAH penggantian di bawahnya,
     * tanda gabung sudah berubah menjadi tanda hubung dan "Ma'arif" beraksen
     * menjadi "ma-a-rif" alih-alih "maarif".
     *
     * Dipakai properti Unicode `\p{M}`, bukan jangkauan karakter harfiah.
     * Jangkauan harfiah berisi tanda gabung yang tidak tampak di penyunting mana
     * pun — dan pola yang tidak terlihat adalah pola yang tidak dapat diperiksa
     * saat ditinjau.
     */
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '');

  return dasar;
}

/** Host penuh situs pondok. */
export function hostSitus(slug: string): string {
  return `${slug.trim().toLowerCase()}.${DOMAIN_PESANTREN}`;
}

/**
 * Menyusun usulan nama pengguna dari nama pondok.
 *
 * Bentuknya berbeda dari slug situs, dan perbedaannya bukan gaya: nama pengguna
 * menjadi **nama schema PostgreSQL**, yang tidak boleh diawali angka dan tidak
 * boleh memakai tanda hubung. Karena itu pemisahnya garis bawah, dan awalannya
 * dipastikan huruf.
 *
 * Pondok bernama "3 Muhammadiyah" menghasilkan `p3_muhammadiyah`, bukan
 * `3_muhammadiyah` — yang terakhir adalah nama schema yang ditolak PostgreSQL,
 * dan penolakannya baru terjadi saat schema hendak dibuat, yaitu sesudah
 * pendaftar mengisi seluruh formulir.
 *
 * Mengembalikan string kosong bila tidak ada yang tersisa untuk dipakai.
 * Kosong lebih baik daripada tebakan: yang kosong ditolak pemeriksanya, dan
 * pendaftar diminta mengisinya sendiri.
 */
export function usulanUsernameDariNama(nama: string): string {
  const dasar = nama
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!dasar) return '';

  // Nama schema tidak boleh diawali angka. Diberi awalan huruf, bukan dibuang:
  // membuang angkanya mengubah nama pondok menjadi nama pondok lain.
  const berhuruf = /^[a-z]/.test(dasar) ? dasar : `p${dasar}`;

  const dipotong = berhuruf.slice(0, 48).replace(/_+$/, '');
  return dipotong.length >= 3 ? dipotong : '';
}

export interface MasukanPesantren {
  namaPondok?: string;
  email?: string;
  desiredUsername?: string;
  slugSitus?: string;
  tipePesantren?: string;
  santriDilayani?: string;
  jenjang?: unknown;
  tahunBerdiri?: number | null;
  jumlahSantriMukim?: number | null;
  jumlahSantriNonmukim?: number | null;
  jumlahUstaz?: number | null;
  kodePos?: string | null;
  whatsapp?: string | null;
  situsWeb?: string | null;
  acceptTerms?: boolean;
  acceptPrivacy?: boolean;
}

const POLA_SUREL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Memeriksa seluruh masukan sekaligus.
 *
 * Mengembalikan **semua** galat, bukan yang pertama. Formulir ini panjang;
 * memulangkan satu galat per kiriman berarti pengurus pondok mengirim ulang
 * belasan kali dan memperbaiki satu hal setiap kali.
 */
export function validasiPendaftaranPesantren(masukan: MasukanPesantren): Galat[] {
  const galat: Galat[] = [];

  const nama = (masukan.namaPondok ?? '').trim();
  if (!nama) {
    galat.push({ field: 'namaPondok', code: 'WAJIB', message: 'Nama pondok wajib diisi.' });
  } else if (nama.length > 255) {
    galat.push({
      field: 'namaPondok',
      code: 'TERLALU_PANJANG',
      message: 'Nama pondok maksimal 255 karakter.',
    });
  }

  const email = (masukan.email ?? '').trim();
  if (!email) {
    galat.push({ field: 'email', code: 'WAJIB', message: 'Surel wajib diisi.' });
  } else if (!POLA_SUREL.test(email)) {
    galat.push({ field: 'email', code: 'TIDAK_SAH', message: 'Bentuk surel tidak sah.' });
  }

  const slugGalat = slugSitusBoleh(masukan.slugSitus ?? '');
  if (slugGalat) galat.push(slugGalat);

  if (!TIPE_PESANTREN.includes(masukan.tipePesantren as TipePesantren)) {
    galat.push({
      field: 'tipePesantren',
      code: 'TIDAK_DIKENALI',
      message: 'Tipe pesantren wajib dipilih.',
    });
  }

  if (!SANTRI_DILAYANI.includes(masukan.santriDilayani as SantriDilayani)) {
    galat.push({
      field: 'santriDilayani',
      code: 'TIDAK_DIKENALI',
      message: 'Santri yang dilayani wajib dipilih.',
    });
  }

  /*
   * Jenjang wajib larik. Nilai bukan larik ditolak sebagai bentuk, bukan
   * dipaksa menjadi larik: memaksanya berarti menerima kiriman yang tidak
   * pernah dimaksudkan formulir ini.
   */
  const jenjang = masukan.jenjang;
  if (!Array.isArray(jenjang)) {
    galat.push({
      field: 'jenjang',
      code: 'BUKAN_LARIK',
      message: 'Jenjang harus berupa daftar.',
    });
  } else if (jenjang.length === 0) {
    galat.push({
      field: 'jenjang',
      code: 'WAJIB',
      message: 'Pilih sedikitnya satu jenjang yang diselenggarakan.',
    });
  } else {
    const takDikenali = jenjang.filter((j) => typeof j !== 'string' || !KODE_JENJANG.has(j));
    if (takDikenali.length) {
      galat.push({
        field: 'jenjang',
        code: 'TIDAK_DIKENALI',
        message: `Jenjang tidak dikenali: ${takDikenali.map(String).join(', ')}`,
      });
    }
  }

  if (masukan.tahunBerdiri != null) {
    const th = masukan.tahunBerdiri;
    if (!Number.isInteger(th) || th < 1200 || th > 2100) {
      galat.push({
        field: 'tahunBerdiri',
        code: 'DI_LUAR_JANGKAUAN',
        message: 'Tahun berdiri tidak masuk akal.',
      });
    }
  }

  for (const [field, nilai] of [
    ['jumlahSantriMukim', masukan.jumlahSantriMukim],
    ['jumlahSantriNonmukim', masukan.jumlahSantriNonmukim],
    ['jumlahUstaz', masukan.jumlahUstaz],
  ] as const) {
    if (nilai == null) continue;
    if (!Number.isInteger(nilai) || nilai < 0) {
      galat.push({
        field,
        code: 'TIDAK_WAJAR',
        message: 'Jumlah harus bilangan bulat tidak negatif.',
      });
    }
  }

  if (masukan.kodePos != null && masukan.kodePos.trim() && !/^\d{5}$/.test(masukan.kodePos.trim())) {
    galat.push({ field: 'kodePos', code: 'TIDAK_SAH', message: 'Kode pos terdiri dari 5 angka.' });
  }

  /*
   * Situs web lama pondok. Hanya http/https yang diterima.
   *
   * Tanpa batasan ini, `javascript:` atau `data:` dapat tersimpan dan kelak
   * ditampilkan sebagai tautan pada halaman yang dibuka orang lain.
   */
  const situs = (masukan.situsWeb ?? '').trim();
  if (situs) {
    let sah = false;
    try {
      const u = new URL(situs);
      sah = u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      sah = false;
    }
    if (!sah) {
      galat.push({
        field: 'situsWeb',
        code: 'TIDAK_SAH',
        message: 'Alamat situs lama harus diawali http:// atau https://.',
      });
    }
  }

  if (!masukan.acceptTerms) {
    galat.push({
      field: 'acceptTerms',
      code: 'WAJIB',
      message: 'Persetujuan syarat penggunaan wajib diberikan.',
    });
  }
  if (!masukan.acceptPrivacy) {
    galat.push({
      field: 'acceptPrivacy',
      code: 'WAJIB',
      message: 'Persetujuan kebijakan privasi wajib diberikan.',
    });
  }

  return galat;
}
