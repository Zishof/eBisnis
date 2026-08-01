/**
 * Menentukan modul pendidikan dari jalur permintaan.
 *
 * ## Mengapa dari jalur, bukan dari header atau badan permintaan
 *
 * Modul menentukan schema mana yang dibaca dan ditulis. Menerimanya dari header
 * atau badan permintaan berarti pemanggil memilih sendiri schema tujuannya —
 * dan sekali itu mungkin, seluruh pemisahan antarvertical hilang: satu
 * permintaan dari portal wali dapat menyebut `ecampus` dan membaca data
 * mahasiswa.
 *
 * Jalur ditentukan rute yang terdaftar pada aplikasi, bukan oleh pemanggil.
 * Itulah satu-satunya sumber yang tidak dapat dipilih dari luar.
 *
 * Aturannya murni supaya dapat dibuktikan tanpa peladen — termasuk kasus yang
 * paling menentukan: jalur yang tidak dikenal **tidak** menghasilkan modul
 * bawaan.
 */

import {
  CORE_MODULE_CODE,
  EDUCATION_COMMON_MODULE,
  type EducationVerticalCode,
} from '../provisioning/education-module.registry';

/** Modul yang dapat menjadi tujuan sebuah permintaan pendidikan. */
export type EducationRouteModule =
  | EducationVerticalCode
  | typeof EDUCATION_COMMON_MODULE
  | typeof CORE_MODULE_CODE;

/**
 * Segmen jalur setelah `/api/v1/education/` dan modul yang dituju.
 *
 * Dituliskan tegas, bukan diturunkan dari nama modul. Segmen `school` tidak
 * sama dengan kode modul `eschool`, dan menurunkan yang satu dari yang lain
 * berarti mengubah alamat publik setiap kali kode modul disesuaikan.
 */
const SEGMEN: Record<string, EducationRouteModule> = {
  common: EDUCATION_COMMON_MODULE,
  campus: 'ecampus',
  school: 'eschool',
  pesantren: 'epesantren',
};

/**
 * Awalan yang ditangani, tanpa modul pendidikan.
 *
 * `billing` dan `integrations` hidup di control plane dan schema inti: yang
 * pertama menghitung langganan lintas vertical, yang kedua menyimpan kredensial
 * dan riwayat pengiriman. Keduanya tidak boleh berada di schema vertical mana
 * pun — data lintas vertical yang disimpan di dalam salah satunya membuat
 * penonaktifan vertical itu menghapus riwayat milik vertical lain.
 */
const SEGMEN_INTI = new Set(['billing', 'integrations']);

const AWALAN = '/api/v1/education/';

export interface HasilRute {
  /** Benar bila jalurnya memang milik namespace pendidikan. */
  pendidikan: boolean;
  module?: EducationRouteModule;
  /** Terisi bila jalurnya milik pendidikan tetapi segmennya tidak dikenal. */
  alasanTolak?: string;
}

/**
 * Membaca modul dari jalur permintaan.
 *
 * Jalur di luar namespace pendidikan mengembalikan `pendidikan: false` — bukan
 * penolakan. Rute lain tidak berurusan dengan berkas ini.
 */
export function modulDariJalur(path: string): HasilRute {
  const bersih = (path ?? '').split('?')[0];

  if (!bersih.startsWith(AWALAN)) {
    return { pendidikan: false };
  }

  const sisa = bersih.slice(AWALAN.length);
  const segmen = sisa.split('/')[0] ?? '';

  if (!segmen) {
    return {
      pendidikan: true,
      alasanTolak: 'Jalur pendidikan tanpa segmen modul.',
    };
  }

  if (SEGMEN_INTI.has(segmen)) {
    return { pendidikan: true, module: CORE_MODULE_CODE };
  }

  const module = SEGMEN[segmen];
  if (!module) {
    /*
     * Segmen asing DITOLAK, bukan dianggap inti.
     *
     * Menganggapnya inti membuat rute yang salah ketik diam-diam membaca schema
     * inti — dan yang salah ketik biasanya rute pendidikan yang baru
     * ditambahkan, sehingga kesalahannya justru mengenai data pendidikan.
     */
    return {
      pendidikan: true,
      alasanTolak:
        `Segmen "${segmen}" bukan modul pendidikan yang dikenal. ` +
        `Yang tersedia: ${[...Object.keys(SEGMEN), ...SEGMEN_INTI].join(', ')}.`,
    };
  }

  return { pendidikan: true, module };
}

/** Benar bila modulnya memerlukan schema tersendiri, bukan schema inti. */
export function perluSchemaSendiri(module: EducationRouteModule): boolean {
  return module !== CORE_MODULE_CODE;
}
