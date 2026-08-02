/**
 * Katalog vertikal ePesantren — menu dan peran, mengikuti pola IR-004 yang
 * sudah dipakai `cooperative-vertical.catalog.ts`.
 *
 * ## Mengapa tidak seluruh 41 peran §14.6
 *
 * Perintah master §14.6 meminta 41 peran tenant ePesantren; mendaftarkannya
 * sekarang berarti menyemai peran untuk layar yang belum ada — persis
 * larangan §6 "mengklaim fitur selesai hanya karena menu sudah tampil",
 * hanya dipindahkan dari menu ke peran. Peran ditambahkan satu per satu,
 * hanya ketika modul yang menjadi dasarnya benar-benar selesai — kecuali
 * `EPESANTREN_PETUGAS_GERBANG` (EP-J), yang ditambahkan lebih awal dari
 * modulnya sendiri sebab satu-satunya cara docs/santri-info/13 R10 (petugas
 * gerbang tidak boleh mengubah persetujuan izin) dapat diuji adalah dengan
 * ADANYA peran yang benar-benar terpisah dari `EPESANTREN_ADMIN`.
 *
 * ## Mengapa OWNER saja tidak cukup
 *
 * Peran `OWNER` (kode tenant `PEMILIK_USAHA`) memegang `allModules: true` pada
 * profil `P11` — READ, PRINT, EXPORT, APPROVE, tanpa CREATE/UPDATE. Pengurus
 * yang baru mendaftar dan mendapat peran itu TIDAK dapat menambahkan satu pun
 * santri. Karena itu peran `EPESANTREN_ADMIN` dibuat, dan
 * `PesantrenRegistrationService` memberikannya kepada pemilik pondok sebagai
 * peran KEDUA — bukan pengganti OWNER, sebab `TenantPermissionService.resolve()`
 * menggabungkan izin dari SELURUH peran yang dipegang satu pengguna.
 */

import type { MenuNodeSeed } from '../../../infrastructure/provisioning/tenant-menu.seed';
import type { RoleCatalogEntry } from '../../../infrastructure/provisioning/tenant-role.seed';
import type { VerticalCatalog } from '../../../infrastructure/provisioning/vertical-catalog.registry';

export const PESANTREN_PREFIX = 'EPESANTREN';

/** Kode peran yang diberikan kepada pemilik pondok saat pendaftaran. */
export const ROLE_ADMIN_EPESANTREN = 'EPESANTREN_ADMIN';

/**
 * Kode peran petugas gerbang (EP-J).
 *
 * Peran TERPISAH dari `EPESANTREN_ADMIN`, sengaja hanya memegang menu
 * `EPESANTREN_GERBANG` — TIDAK PERNAH `EPESANTREN_PERIZINAN`. Ini menegakkan
 * docs/santri-info/13 R10 ("petugas gerbang mengubah persetujuan izin") dan
 * §14.8 perintah master ("petugas gerbang != pengubah persetujuan izin")
 * sebagai pemisahan PERAN yang benar-benar dapat diuji, bukan sekadar janji
 * di dokumentasi.
 */
export const ROLE_PETUGAS_GERBANG = 'EPESANTREN_PETUGAS_GERBANG';

/**
 * Kode peran wali santri (EP-K).
 *
 * Peran self-service, hanya memegang `EPESANTREN_PORTAL_WALI` — menu yang
 * hanya READ dan disaring bespoke per baris di service (lihat
 * `pesantren-portal-wali.service.ts`), bukan `EPESANTREN_SANTRI` yang
 * memberi akses lintas seluruh santri pondok. Peran ini, sama dengan
 * `EPESANTREN_PETUGAS_GERBANG`, ditambahkan bersama modulnya sendiri
 * (bukan mendahului) sebab portal wali memang selesai pada EP-K ini.
 */
export const ROLE_WALI = 'EPESANTREN_WALI';

const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const PERIZINAN_AKSI = ['READ', 'CREATE', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT', 'EXPORT'];
const GERBANG_AKSI = ['READ', 'CREATE', 'PRINT'];
const PORTAL_WALI_AKSI = ['READ'];

export const PESANTREN_MENUS: MenuNodeSeed[] = [
  {
    code: 'EPESANTREN_SANTRI',
    label: 'Data Santri',
    translationKey: 'menu.epesantren.santri',
    route: '/app/pesantren/santri',
    icon: 'Users',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 500,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_PRESENSI',
    label: 'Presensi Santri',
    translationKey: 'menu.epesantren.presensi',
    route: '/app/pesantren/presensi',
    icon: 'CalendarCheck',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 510,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_TAGIHAN',
    label: 'Tagihan SPP',
    translationKey: 'menu.epesantren.tagihan',
    route: '/app/pesantren/tagihan',
    icon: 'Receipt',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 520,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_ASRAMA',
    label: 'Asrama dan Kamar',
    translationKey: 'menu.epesantren.asrama',
    route: '/app/pesantren/asrama',
    icon: 'Building2',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 530,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_DINIYAH',
    label: 'Diniyah dan Halaqah',
    translationKey: 'menu.epesantren.diniyah',
    route: '/app/pesantren/diniyah',
    icon: 'BookOpen',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 540,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_TAHFIZ',
    label: 'Tahfiz',
    translationKey: 'menu.epesantren.tahfiz',
    route: '/app/pesantren/tahfiz',
    icon: 'BookMarked',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 550,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_PERIZINAN',
    label: 'Perizinan Santri',
    translationKey: 'menu.epesantren.perizinan',
    route: '/app/pesantren/perizinan',
    icon: 'FileCheck',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 560,
    actions: PERIZINAN_AKSI,
  },
  {
    code: 'EPESANTREN_GERBANG',
    label: 'Gerbang Keluar-Masuk',
    translationKey: 'menu.epesantren.gerbang',
    route: '/app/pesantren/gerbang',
    icon: 'DoorOpen',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 570,
    actions: GERBANG_AKSI,
  },
  {
    code: 'EPESANTREN_DOMPET',
    label: 'Dompet Santri',
    translationKey: 'menu.epesantren.dompet',
    route: '/app/pesantren/dompet',
    icon: 'Wallet',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 590,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_PORTAL_WALI',
    label: 'Portal Wali',
    translationKey: 'menu.epesantren.portalWali',
    route: '/app/pesantren/portal-wali',
    icon: 'HeartHandshake',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 580,
    actions: PORTAL_WALI_AKSI,
  },
];

/** Menu yang tidak berinduk — satu-satunya modul ePesantren yang ada saat ini. */
export const PESANTREN_MODULES = PESANTREN_MENUS.filter((m) => !m.parentCode).map((m) => m.code);

const DASAR = { HOME: 'P1', SUPPORT: 'P1' } as const;

export const PESANTREN_ROLES: RoleCatalogEntry[] = [
  {
    code: ROLE_ADMIN_EPESANTREN,
    name: 'Administrator ePesantren',
    family: 'ePesantren',
    profile: 'P7',
    modules: {
      ...DASAR,
      EPESANTREN_SANTRI: 'P7',
      EPESANTREN_PRESENSI: 'P7',
      EPESANTREN_TAGIHAN: 'P7',
      EPESANTREN_ASRAMA: 'P7',
      EPESANTREN_DINIYAH: 'P7',
      EPESANTREN_TAHFIZ: 'P7',
      EPESANTREN_PERIZINAN: 'P7',
      EPESANTREN_GERBANG: 'P7',
      EPESANTREN_DOMPET: 'P7',
    },
    dataScope: 'TENANT',
    core: false,
    description:
      'Mencatat dan mengubah data santri. Diberikan kepada pemilik pondok saat ' +
      'pendaftaran sebagai peran tambahan di samping OWNER — bukan pengganti, ' +
      'sebab izin dari kedua peran digabungkan.',
  },
  {
    code: ROLE_PETUGAS_GERBANG,
    name: 'Petugas Gerbang',
    family: 'ePesantren',
    profile: 'P2',
    modules: { ...DASAR, EPESANTREN_GERBANG: 'P2' },
    dataScope: 'TENANT',
    core: false,
    description:
      'Mencatat lintasan keluar-masuk santri pada izin yang SUDAH disetujui. ' +
      'Sengaja TIDAK memegang EPESANTREN_PERIZINAN — tidak dapat menyetujui, ' +
      'menolak, atau mengubah izin apa pun (docs/santri-info/13 R10).',
  },
  {
    code: ROLE_WALI,
    name: 'Wali Santri',
    family: 'ePesantren',
    profile: 'P10',
    modules: { ...DASAR, EPESANTREN_PORTAL_WALI: 'P10' },
    // `DataScopeCode` platform belum punya nilai DEPENDENT_CHILD (lihat
    // §14.7 perintah master) -- `DataScopeResolver` hanya mengenal SELF dan
    // cakupan hierarkis satu kolom, tidak relasi wali-ke-anak lewat tabel
    // penghubung. `SELF` dipakai sebagai label terdekat; penyaringan
    // sesungguhnya bespoke di service, bukan lewat resolver generik.
    dataScope: 'SELF',
    core: false,
    description:
      'Hanya dapat melihat data anaknya sendiri (profil, presensi, tahfiz, ' +
      'izin) lewat portal wali — tidak pernah data santri lain. Penyaringan ' +
      'ditegakkan di service lewat pesantren_santri_wali, bukan oleh profil ' +
      'hak akses ini semata.',
  },
];

export const PESANTREN_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'pesantren',
  prefix: PESANTREN_PREFIX,
  menus: PESANTREN_MENUS,
  roles: PESANTREN_ROLES,
};
