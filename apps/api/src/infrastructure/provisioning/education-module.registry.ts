/**
 * Registri modul pendidikan: kode canonical dan pembentukan nama schema.
 *
 * ## Mengapa berkas ini murni dan berdiri sendiri
 *
 * Nama schema yang salah bersifat **permanen**. Username tenant tidak dapat
 * diubah setelah provisioning, dan schema yang sudah dibuat berisi data. Salah
 * ketik satu huruf pada kode modul menghasilkan `joniutama_escholl` yang akan
 * dibaca, ditulis, dan dicadangkan selamanya oleh sistem yang mengira itu benar.
 *
 * Karena itu seluruh keputusan penamaan dikumpulkan di sini sebagai fungsi murni
 * yang dapat dibuktikan tanpa basis data — termasuk keputusan yang paling tidak
 * nyaman dibuktikan dengan cara mencobanya.
 */

import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { RESERVED_SCHEMA_NAMES } from '../database/schema-name.util';

/** Kode modul pendidikan yang dijual sebagai vertical. */
export const EDUCATION_VERTICAL_CODES = ['ecampus', 'eschool', 'epesantren'] as const;

export type EducationVerticalCode = (typeof EDUCATION_VERTICAL_CODES)[number];

/**
 * Kernel pendidikan bersama.
 *
 * Tidak dijual terpisah (BRD §185.3) tetapi wajib ada sebelum vertical mana pun:
 * di sinilah periode akademik, kurikulum, learning unit, offering, presensi, dan
 * nilai hidup. Vertical hanya menambah yang khas.
 */
export const EDUCATION_COMMON_MODULE = 'education';

/** Modul inti tenant. Schema-nya sudah ada sejak Versi 5. */
export const CORE_MODULE_CODE = 'core';

/**
 * Batas panjang username tenant untuk pendaftaran baru.
 *
 * BRD §185.2 menetapkan 3–30 karakter. Sebelum ini yang ada hanyalah batas 48
 * karakter pada nama schema **akhir** — bukan pada usernamenya. Akibatnya
 * username 40 karakter lolos pada hari pendaftaran, lalu gagal berbulan-bulan
 * kemudian ketika vertical ketiga diprovision, pada username yang sudah tidak
 * dapat diubah.
 */
export const MAX_TENANT_USERNAME_LENGTH = 30;
export const MIN_TENANT_USERNAME_LENGTH = 3;

/**
 * Batas keras identifier PostgreSQL.
 *
 * PostgreSQL memotong identifier lebih panjang daripada ini **tanpa galat**.
 * Dua schema yang berbeda dapat terpotong menjadi nama yang sama, dan yang
 * kedua lalu menulis ke schema milik yang pertama.
 */
export const PG_IDENTIFIER_MAX_BYTES = 63;

const AUDIT_SUFFIX = '__audit';

/**
 * Salah eja yang pernah muncul pada dokumen dan **wajib ditolak**, bukan
 * diperbaiki diam-diam.
 *
 * Memperbaikinya diam-diam menyembunyikan salah ketik pada dokumen kontrak: yang
 * tertulis `escholl`, yang terbentuk `eschool`, dan tidak ada yang menyadari
 * keduanya berbeda sampai seseorang mencocokkan lampiran kontrak dengan tagihan.
 */
const SALAH_EJA_DIKENAL: Record<string, EducationVerticalCode> = {
  escholl: 'eschool',
  eschol: 'eschool',
  e_school: 'eschool',
  epeantren: 'epesantren',
  epesantrean: 'epesantren',
  e_pesantren: 'epesantren',
  ekampus: 'ecampus',
  e_campus: 'ecampus',
};

export interface HasilKodeModul {
  valid: boolean;
  code?: EducationVerticalCode;
  errorCode?: string;
  message?: string;
  /** Terisi bila masukannya salah eja yang dikenal, untuk pesan yang menolong. */
  maksudnya?: EducationVerticalCode;
}

/**
 * Membaca kode modul pendidikan.
 *
 * Menerima hanya ejaan canonical. Salah eja yang dikenal ditolak dengan
 * menyebutkan maksudnya, sehingga yang salah dapat diperbaiki di sumbernya —
 * bukan ditambal di sini.
 */
export function bacaKodeVertical(input: string): HasilKodeModul {
  const bersih = (input ?? '').trim().toLowerCase();

  if (!bersih) {
    return {
      valid: false,
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message: 'Kode modul pendidikan wajib diisi.',
    };
  }

  if ((EDUCATION_VERTICAL_CODES as readonly string[]).includes(bersih)) {
    return { valid: true, code: bersih as EducationVerticalCode };
  }

  const maksudnya = SALAH_EJA_DIKENAL[bersih];
  if (maksudnya) {
    return {
      valid: false,
      maksudnya,
      errorCode: ErrorCodes.VALIDATION_FAILED,
      message:
        `Kode modul "${bersih}" tidak dikenal. Ejaan resminya "${maksudnya}". ` +
        'Perbaiki di sumbernya — kode ini membentuk nama schema yang tidak dapat diubah.',
    };
  }

  return {
    valid: false,
    errorCode: ErrorCodes.VALIDATION_FAILED,
    message:
      `Kode modul "${bersih}" tidak dikenal. Yang tersedia: ` +
      `${EDUCATION_VERTICAL_CODES.join(', ')}.`,
  };
}

export interface HasilNamaSchema {
  valid: boolean;
  schemaName?: string;
  auditSchemaName?: string;
  errorCode?: string;
  message?: string;
}

/**
 * Membentuk nama schema untuk sebuah (username, modul).
 *
 * ## Mengapa `core` memakai username apa adanya
 *
 * BRD §185.1 menuliskan `{tenantUsername}_core`. Schema inti tenant yang sudah
 * berjalan bernama `{tenantUsername}` saja — begitu sejak Versi 5.
 *
 * Mengubahnya berarti mengganti nama schema yang berisi data pada setiap tenant
 * yang hidup. Itu bukan migration additive, dan kegagalannya di tengah jalan
 * meninggalkan tenant tanpa schema yang dapat ditemukan.
 *
 * Maksud BRD adalah schema terpisah per modul, dan maksud itu tercapai penuh
 * tanpa menyentuh yang sudah ada: modul baru memakai akhiran, modul inti tetap
 * pada namanya. Yang diperoleh sama; yang dihindari adalah pemindahan data yang
 * tidak diminta siapa pun.
 */
export function bangunNamaSchema(username: string, moduleCode: string): HasilNamaSchema {
  const u = (username ?? '').trim().toLowerCase();
  const m = (moduleCode ?? '').trim().toLowerCase();

  if (!u) {
    return {
      valid: false,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message: 'Username tenant kosong.',
    };
  }

  const schemaName = m === CORE_MODULE_CODE ? u : `${u}_${m}`;
  const auditSchemaName = `${schemaName}${AUDIT_SUFFIX}`;

  if (!/^[a-z][a-z0-9_]*$/.test(schemaName)) {
    return {
      valid: false,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message: `Nama schema "${schemaName}" tidak sah.`,
    };
  }

  if (RESERVED_SCHEMA_NAMES.has(schemaName) || RESERVED_SCHEMA_NAMES.has(auditSchemaName)) {
    return {
      valid: false,
      errorCode: ErrorCodes.RESERVED_SCHEMA_NAME,
      message: `Nama schema "${schemaName}" dicadangkan sistem.`,
    };
  }

  /*
   * Nama AUDIT yang diperiksa, bukan nama schema-nya.
   *
   * Nama audit selalu tujuh karakter lebih panjang, sehingga ialah yang lebih
   * dahulu menabrak batas. Memeriksa nama schema saja meloloskan pasangan yang
   * schema-nya muat tetapi audit-nya terpotong — dan schema audit yang terpotong
   * dapat bertabrakan dengan milik tenant lain.
   */
  if (Buffer.byteLength(auditSchemaName, 'utf8') > PG_IDENTIFIER_MAX_BYTES) {
    return {
      valid: false,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message:
        `Nama schema audit "${auditSchemaName}" melebihi ${PG_IDENTIFIER_MAX_BYTES} karakter. ` +
        'PostgreSQL memotongnya tanpa galat, dan dua tenant dapat berakhir pada schema yang sama.',
    };
  }

  return { valid: true, schemaName, auditSchemaName };
}

export interface HasilUsername {
  valid: boolean;
  errorCode?: string;
  message?: string;
}

/**
 * Memeriksa username tenant **pada saat dibuat**.
 *
 * Diperiksa di sini, bukan saat schema dibentuk. Username tidak dapat diubah
 * setelah provisioning; penolakan yang datang belakangan tidak menyisakan jalan
 * keluar selain membuat tenant baru.
 */
export function periksaUsernameTenant(username: string): HasilUsername {
  const u = (username ?? '').trim();

  if (u.length < MIN_TENANT_USERNAME_LENGTH || u.length > MAX_TENANT_USERNAME_LENGTH) {
    return {
      valid: false,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message:
        `Username tenant harus ${MIN_TENANT_USERNAME_LENGTH}–${MAX_TENANT_USERNAME_LENGTH} ` +
        'karakter. Batas ini menjaga agar nama schema setiap modul pendidikan tetap muat, ' +
        'dan username tidak dapat diubah setelah tenant dibuat.',
    };
  }

  if (!/^[a-z][a-z0-9_]*$/.test(u)) {
    return {
      valid: false,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message:
        'Username tenant hanya boleh huruf kecil, angka, dan garis bawah, diawali huruf.',
    };
  }

  // Username yang sama dengan kode modul membuat `ecampus_ecampus` sah tetapi
  // `ecampus` (schema inti) bertabrakan dengan konvensi penamaan modul.
  if ((EDUCATION_VERTICAL_CODES as readonly string[]).includes(u) || u === EDUCATION_COMMON_MODULE) {
    return {
      valid: false,
      errorCode: ErrorCodes.RESERVED_SCHEMA_NAME,
      message: `Username "${u}" dicadangkan sebagai kode modul pendidikan.`,
    };
  }

  if (RESERVED_SCHEMA_NAMES.has(u)) {
    return {
      valid: false,
      errorCode: ErrorCodes.RESERVED_SCHEMA_NAME,
      message: `Username "${u}" dicadangkan sistem.`,
    };
  }

  return { valid: true };
}

export function pastikanUsernameTenant(username: string): string {
  const hasil = periksaUsernameTenant(username);
  if (!hasil.valid) {
    throw AppError.badRequest(
      hasil.errorCode ?? ErrorCodes.INVALID_SCHEMA_NAME,
      hasil.message ?? 'Username tenant tidak sah.',
    );
  }
  return username.trim();
}

/**
 * Paket produk pendidikan yang dapat dipilih tenant (BRD §186.1).
 *
 * Kombinasinya dituliskan tegas, bukan dihitung dari himpunan bagian: paket yang
 * dijual adalah keputusan komersial, dan himpunan bagian yang dihitung otomatis
 * akan memunculkan paket yang tidak pernah disepakati siapa pun — termasuk paket
 * kosong.
 */
export const PAKET_PENDIDIKAN: Record<string, readonly EducationVerticalCode[]> = {
  ECAMPUS_ONLY: ['ecampus'],
  ESCHOOL_ONLY: ['eschool'],
  EPESANTREN_ONLY: ['epesantren'],
  ECAMPUS_ESCHOOL: ['ecampus', 'eschool'],
  ECAMPUS_EPESANTREN: ['ecampus', 'epesantren'],
  ESCHOOL_EPESANTREN: ['eschool', 'epesantren'],
  ALL_EDUCATION_VERTICALS: ['ecampus', 'eschool', 'epesantren'],
};

/**
 * Modul yang harus terprovision untuk sebuah paket, **berurutan**.
 *
 * Kernel bersama selalu lebih dahulu: vertical merujuk tabelnya, dan urutan
 * terbalik membuat migration vertical gagal pada foreign key yang belum ada.
 */
export function modulUntukPaket(paket: string): readonly string[] {
  const vertical = PAKET_PENDIDIKAN[paket];
  if (!vertical) {
    throw AppError.badRequest(
      ErrorCodes.VALIDATION_FAILED,
      `Paket pendidikan "${paket}" tidak dikenal. Yang tersedia: ` +
        `${Object.keys(PAKET_PENDIDIKAN).join(', ')}.`,
    );
  }
  return [EDUCATION_COMMON_MODULE, ...vertical];
}
