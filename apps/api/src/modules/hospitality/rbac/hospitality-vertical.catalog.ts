/**
 * Katalog vertikal Hospitality (MitraInap.id) — menu dan peran, mengikuti
 * pola IR-004 yang sudah dipakai `pesantren-vertical.catalog.ts`.
 *
 * ## Mengapa hanya SATU menu untuk tiap fase
 *
 * Perintah master §14/§Struktur Menu Role Permission meminta puluhan menu
 * hospitality (reservasi, front office, housekeeping, folio, dst).
 * Mendaftarkannya sekarang berarti menu untuk layar yang belum ada --
 * pelanggaran §6 ("jangan mengklaim fitur selesai hanya karena menu sudah
 * tampil"), pola yang sama dijaga `pesantren-vertical.catalog.ts`. Menu dan
 * peran ditambahkan satu per satu, hanya ketika modul yang menjadi
 * dasarnya benar-benar selesai.
 */

import type { MenuNodeSeed } from '../../../infrastructure/provisioning/tenant-menu.seed';
import type { RoleCatalogEntry } from '../../../infrastructure/provisioning/tenant-role.seed';
import type { VerticalCatalog } from '../../../infrastructure/provisioning/vertical-catalog.registry';

export const HOSPITALITY_PREFIX = 'HOSPITALITY';

/** Kode peran yang diberikan kepada pemilik properti saat provisioning. */
export const ROLE_ADMIN_HOSPITALITY = 'HOSPITALITY_ADMIN';
export const ROLE_FRONT_DESK_HOSPITALITY = 'HOSPITALITY_FRONT_DESK_AGENT';
export const ROLE_HOUSEKEEPING_SUPERVISOR = 'HOSPITALITY_HOUSEKEEPING_SUPERVISOR';
export const ROLE_ROOM_ATTENDANT = 'HOSPITALITY_ROOM_ATTENDANT';
export const ROLE_ENGINEERING_MANAGER = 'HOSPITALITY_ENGINEERING_MANAGER';
export const ROLE_ENGINEER = 'HOSPITALITY_ENGINEER';
export const ROLE_HOSPITALITY_CASHIER = 'HOSPITALITY_CASHIER';

const DASAR = { HOME: 'P1', SUPPORT: 'P1' } as const;

export const HOSPITALITY_MENUS: MenuNodeSeed[] = [
  {
    code: 'HOSPITALITY_GROUP',
    label: 'Hospitality',
    translationKey: 'menu.hospitality.group',
    icon: 'BedDouble',
    moduleCode: HOSPITALITY_PREFIX,
    sortOrder: 600,
    actions: ['READ'],
  },
  {
    code: 'HOSPITALITY_PROPERTI',
    parentCode: 'HOSPITALITY_GROUP',
    label: 'Properti dan Kamar',
    translationKey: 'menu.hospitality.properti',
    route: '/app/hospitality/properti',
    icon: 'Building2',
    moduleCode: HOSPITALITY_PREFIX,
    sortOrder: 1,
    actions: ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'],
  },
  {
    code: 'HOSPITALITY_TAMU',
    parentCode: 'HOSPITALITY_GROUP',
    label: 'Tamu (CRM)',
    translationKey: 'menu.hospitality.tamu',
    route: '/app/hospitality/tamu',
    icon: 'UsersRound',
    moduleCode: HOSPITALITY_PREFIX,
    sortOrder: 2,
    actions: ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'],
  },
  {
    code: 'HOSPITALITY_RESERVASI',
    parentCode: 'HOSPITALITY_GROUP',
    label: 'Reservasi',
    translationKey: 'menu.hospitality.reservasi',
    route: '/app/hospitality/reservasi',
    icon: 'CalendarRange',
    moduleCode: HOSPITALITY_PREFIX,
    sortOrder: 3,
    actions: ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'],
  },
  {
    code: 'HOSPITALITY_FRONTDESK',
    parentCode: 'HOSPITALITY_GROUP',
    label: 'Front Office',
    translationKey: 'menu.hospitality.frontdesk',
    route: '/app/hospitality/frontdesk',
    icon: 'ConciergeBell',
    moduleCode: HOSPITALITY_PREFIX,
    sortOrder: 4,
    actions: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'REVIEW'],
  },
  {
    code: 'HOSPITALITY_HOUSEKEEPING', parentCode: 'HOSPITALITY_GROUP', label: 'Housekeeping',
    translationKey: 'menu.hospitality.housekeeping', route: '/app/hospitality/housekeeping', icon: 'Sparkles',
    moduleCode: HOSPITALITY_PREFIX, sortOrder: 5,
    actions: ['READ','CREATE','UPDATE','REVIEW','IMPORT','EXPORT','ASSIGN'],
  },
  {
    code: 'HOSPITALITY_MAINTENANCE', parentCode: 'HOSPITALITY_GROUP', label: 'Maintenance',
    translationKey: 'menu.hospitality.maintenance', route: '/app/hospitality/maintenance', icon: 'Wrench',
    moduleCode: HOSPITALITY_PREFIX, sortOrder: 6, actions: ['READ','CREATE','UPDATE','APPROVE','EXPORT'],
  },
  {
    code: 'HOSPITALITY_FOLIO', parentCode: 'HOSPITALITY_GROUP', label: 'Folio & Cashiering',
    translationKey: 'menu.hospitality.folio', route: '/app/hospitality/folio', icon: 'ReceiptText',
    moduleCode: HOSPITALITY_PREFIX, sortOrder: 7,
    actions: ['READ','CREATE','UPDATE','POST','REVERSE','PRINT','VIEW_AMOUNT'],
  },
];

export const HOSPITALITY_ROLES: RoleCatalogEntry[] = [
  {
    code: ROLE_ADMIN_HOSPITALITY,
    name: 'Admin Properti',
    family: 'Hospitality',
    profile: 'P7',
    /*
     * `HOSPITALITY_GROUP` satu baris ini mencakup SELURUH menu di bawah grup
     * "Hospitality" -- AMAN karena `HOSPITALITY_ADMIN` adalah SATU-SATUNYA
     * peran yang menunjuk grup ini hari ini (persis pola `EPESANTREN_ADMIN`
     * pada `pesantren-vertical.catalog.ts`). Peran sempit (petugas front
     * office, housekeeping, dst) menyusul bersama modulnya masing-masing.
     */
    modules: { ...DASAR, HOSPITALITY_GROUP: 'P7' },
    dataScope: 'TENANT',
    core: false,
    description:
      'Mencatat dan mengubah data properti, tipe kamar, dan kamar. Diberikan ' +
      'kepada pemilik properti saat provisioning sebagai peran tambahan di ' +
      'samping OWNER — bukan pengganti, sebab izin dari kedua peran digabungkan.',
  },
  {
    code: ROLE_FRONT_DESK_HOSPITALITY,
    name: 'Petugas Front Desk',
    family: 'Hospitality',
    profile: 'P5',
    modules: { HOME: 'P1', SUPPORT: 'P1', HOSPITALITY_RESERVASI: 'P5', HOSPITALITY_FRONTDESK: 'P5' },
    dataScope: 'TENANT',
    core: false,
    description: 'Menangani arrival, room assignment, check-in, room move, check-out, dan handover tanpa akses administrasi properti.',
  },
  {
    code: ROLE_HOUSEKEEPING_SUPERVISOR, name: 'Housekeeping Supervisor', family: 'Hospitality', profile: 'P6',
    modules: { HOME:'P1',SUPPORT:'P1',HOSPITALITY_HOUSEKEEPING:'P6' }, dataScope:'TENANT', core:false,
    description:'Mengelola board, assignment, inspeksi, linen, minibar, dan lost-and-found.',
  },
  {
    code: ROLE_ROOM_ATTENDANT, name: 'Room Attendant', family: 'Hospitality', profile: 'P2',
    modules: { HOME:'P1',SUPPORT:'P1',HOSPITALITY_HOUSEKEEPING:'P2' }, dataScope:'SELF', core:false,
    description:'Menjalankan tugas kamar yang ditugaskan dan sinkronisasi operasi mobile idempoten.',
  },
  {
    code: ROLE_ENGINEERING_MANAGER, name: 'Engineering Manager', family: 'Hospitality', profile: 'P6',
    modules: { HOME:'P1',SUPPORT:'P1',HOSPITALITY_MAINTENANCE:'P6' }, dataScope:'TENANT', core:false,
    description:'Mengelola SLA, work order, preventive plan, asset, dan approval room downtime.',
  },
  {
    code: ROLE_ENGINEER, name: 'Engineer', family: 'Hospitality', profile: 'P2',
    modules: { HOME:'P1',SUPPORT:'P1',HOSPITALITY_MAINTENANCE:'P2' }, dataScope:'SELF', core:false,
    description:'Menjalankan work order yang ditugaskan melalui operasi mobile idempoten.',
  },
  {
    code: ROLE_HOSPITALITY_CASHIER, name: 'Hospitality Cashier', family: 'Hospitality', profile: 'P6',
    modules: { HOME:'P1',SUPPORT:'P1',HOSPITALITY_FOLIO:'P6' }, dataScope:'TENANT', core:false,
    description:'Mengelola folio, pembayaran tokenized, deposit, reversal, invoice, dan cashiering.',
  },
];

export const HOSPITALITY_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'hospitality',
  prefix: HOSPITALITY_PREFIX,
  menus: HOSPITALITY_MENUS,
  roles: HOSPITALITY_ROLES,
};
