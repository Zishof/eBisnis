/**
 * Katalog vertikal ePesantren (EP-A) — menu dan peran, mengikuti pola IR-004
 * yang sudah dipakai `cooperative-vertical.catalog.ts`.
 *
 * ## Mengapa hanya satu menu
 *
 * Audit EP-0 mencatat hanya fondasi (santri, wali, unit, tahun ajaran) yang
 * benar-benar dibangun. Perintah master §14.6 meminta 41 peran tenant
 * ePesantren; mendaftarkannya sekarang berarti menyemai peran untuk layar yang
 * belum ada — persis larangan §6 "mengklaim fitur selesai hanya karena menu
 * sudah tampil", hanya dipindahkan dari menu ke peran.
 *
 * Menu dan peran lain ditambahkan satu per satu, setiap kali modulnya
 * benar-benar selesai.
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

const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];

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
    },
    dataScope: 'TENANT',
    core: false,
    description:
      'Mencatat dan mengubah data santri. Diberikan kepada pemilik pondok saat ' +
      'pendaftaran sebagai peran tambahan di samping OWNER — bukan pengganti, ' +
      'sebab izin dari kedua peran digabungkan.',
  },
];

export const PESANTREN_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'pesantren',
  prefix: PESANTREN_PREFIX,
  menus: PESANTREN_MENUS,
  roles: PESANTREN_ROLES,
};
