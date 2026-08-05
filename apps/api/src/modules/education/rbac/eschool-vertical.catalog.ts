import type { MenuNodeSeed } from '../../../infrastructure/provisioning/tenant-menu.seed';
import type { RoleCatalogEntry } from '../../../infrastructure/provisioning/tenant-role.seed';
import type { VerticalCatalog } from '../../../infrastructure/provisioning/vertical-catalog.registry';

export const ESCHOOL_PREFIX = 'ESCHOOL';
export const ROLE_ADMIN_ESCHOOL = 'ESCHOOL_ADMIN';
export const ROLE_OPERATOR_DAPODIK = 'ESCHOOL_OPERATOR_DAPODIK';
export const ROLE_WALI_KELAS = 'ESCHOOL_WALI_KELAS';
export const ROLE_AUDITOR_ESCHOOL = 'ESCHOOL_AUDITOR';

const BACA = ['READ', 'PRINT', 'EXPORT'];
const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const IMPOR = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'PRINT', 'EXPORT'];
const RAPOR = ['READ', 'CREATE', 'UPDATE', 'REVIEW', 'APPROVE', 'REJECT', 'PRINT', 'EXPORT'];
const LAPORAN = ['READ', 'PRINT', 'EXPORT', 'AUDIT_READ'];

interface EschoolMenu {
  code: string;
  parent?: string;
  label: string;
  route?: string;
  icon: string;
  order: number;
  actions: string[];
}

const MENU: EschoolMenu[] = [
  {
    code: 'ESCHOOL_DASHBOARD',
    label: 'Dashboard Sekolah',
    route: '/app/eschool',
    icon: 'LayoutDashboard',
    order: 560,
    actions: BACA,
  },
  {
    code: 'ESCHOOL_MASTER',
    label: 'Master eSchool',
    route: '/app/eschool/siswa',
    icon: 'GraduationCap',
    order: 561,
    actions: BACA,
  },
  {
    code: 'ESCHOOL_SISWA',
    parent: 'ESCHOOL_MASTER',
    label: 'Siswa',
    route: '/app/eschool/siswa',
    icon: 'Users',
    order: 10,
    actions: IMPOR,
  },
  {
    code: 'ESCHOOL_GURU',
    parent: 'ESCHOOL_MASTER',
    label: 'Guru dan Tendik',
    route: '/app/eschool/guru',
    icon: 'UserRoundCog',
    order: 11,
    actions: IMPOR,
  },
  {
    code: 'ESCHOOL_KELAS',
    parent: 'ESCHOOL_MASTER',
    label: 'Kelas dan Rombel',
    route: '/app/eschool/kelas',
    icon: 'School',
    order: 13,
    actions: IMPOR,
  },
  {
    code: 'ESCHOOL_AKADEMIK',
    label: 'Akademik dan Rapor',
    route: '/app/eschool/akademik',
    icon: 'BookOpenCheck',
    order: 562,
    actions: RAPOR,
  },
  {
    code: 'ESCHOOL_PPDB',
    parent: 'ESCHOOL_AKADEMIK',
    label: 'PPDB',
    route: '/app/eschool/ppdb',
    icon: 'UserPlus',
    order: 12,
    actions: RAPOR,
  },
  {
    code: 'ESCHOOL_RAPOR',
    parent: 'ESCHOOL_AKADEMIK',
    label: 'Rapor dan Leger',
    route: '/app/eschool/akademik',
    icon: 'FileCheck2',
    order: 20,
    actions: RAPOR,
  },
  {
    code: 'ESCHOOL_PRESENSI',
    parent: 'ESCHOOL_AKADEMIK',
    label: 'Presensi',
    route: '/app/eschool/presensi',
    icon: 'CalendarCheck',
    order: 21,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_BK',
    parent: 'ESCHOOL_AKADEMIK',
    label: 'BK dan Kesiswaan',
    route: '/app/eschool/bk',
    icon: 'HeartHandshake',
    order: 22,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_DAPODIK',
    label: 'DAPODIK',
    route: '/app/eschool/dapodik',
    icon: 'DatabaseZap',
    order: 563,
    actions: IMPOR,
  },
  {
    code: 'ESCHOOL_LAYANAN',
    label: 'Layanan Sekolah',
    route: '/app/eschool/perpustakaan',
    icon: 'Landmark',
    order: 564,
    actions: BACA,
  },
  {
    code: 'ESCHOOL_PERPUSTAKAAN',
    parent: 'ESCHOOL_LAYANAN',
    label: 'Perpustakaan',
    route: '/app/eschool/perpustakaan',
    icon: 'LibraryBig',
    order: 40,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_SARPRAS',
    parent: 'ESCHOOL_LAYANAN',
    label: 'Sarpras',
    route: '/app/eschool/sarpras',
    icon: 'Boxes',
    order: 41,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_AKREDITASI',
    parent: 'ESCHOOL_LAYANAN',
    label: 'Akreditasi',
    route: '/app/eschool/akreditasi',
    icon: 'BadgeCheck',
    order: 42,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_ALUMNI',
    parent: 'ESCHOOL_LAYANAN',
    label: 'Alumni',
    route: '/app/eschool/alumni',
    icon: 'UsersRound',
    order: 50,
    actions: CATAT,
  },
  {
    code: 'ESCHOOL_LAPORAN',
    label: 'Laporan Sekolah',
    route: '/app/eschool/laporan',
    icon: 'FileBarChart',
    order: 565,
    actions: LAPORAN,
  },
];

export const ESCHOOL_MENUS: MenuNodeSeed[] = MENU.map((menu) => ({
  code: menu.code,
  parentCode: menu.parent,
  label: menu.label,
  translationKey: `menu.${menu.code.toLowerCase().replace(/_/g, '.')}`,
  route: menu.route,
  icon: menu.icon,
  moduleCode: ESCHOOL_PREFIX,
  sortOrder: menu.order,
  actions: menu.actions,
}));

const DASAR = { HOME: 'P1', SUPPORT: 'P1' } as const;

const peran = (
  code: string,
  name: string,
  profile: RoleCatalogEntry['profile'],
  modules: Record<string, RoleCatalogEntry['profile']>,
  dataScope: RoleCatalogEntry['dataScope'],
  description: string,
  extra: Partial<RoleCatalogEntry> = {},
): RoleCatalogEntry => ({
  code,
  name,
  family: 'eSchool',
  profile,
  modules: { ...DASAR, ...modules } as RoleCatalogEntry['modules'],
  dataScope,
  description,
  core: false,
  ...extra,
});

export const ESCHOOL_ROLES: RoleCatalogEntry[] = [
  peran(
    ROLE_ADMIN_ESCHOOL,
    'Administrator eSchool',
    'P7',
    {
      ESCHOOL_DASHBOARD: 'P7',
      ESCHOOL_MASTER: 'P7',
      ESCHOOL_AKADEMIK: 'P7',
      ESCHOOL_DAPODIK: 'P7',
      ESCHOOL_LAYANAN: 'P7',
      ESCHOOL_LAPORAN: 'P7',
    },
    'TENANT',
    'Mengelola modul sekolah formal: siswa, guru, rombel, akademik, DAPODIK, aset, akreditasi, alumni, dan laporan.',
  ),
  peran(
    ROLE_OPERATOR_DAPODIK,
    'Operator DAPODIK',
    'P3',
    { ESCHOOL_DAPODIK: 'P3', ESCHOOL_MASTER: 'P3' },
    'TENANT',
    'Menyiapkan impor, ekspor, validasi, diff, dan rollback data DAPODIK untuk sekolah formal.',
  ),
  peran(
    ROLE_WALI_KELAS,
    'Wali Kelas',
    'P2',
    {
      ESCHOOL_DASHBOARD: 'P1',
      ESCHOOL_MASTER: 'P1',
      ESCHOOL_AKADEMIK: 'P2',
      ESCHOOL_LAPORAN: 'P1',
    },
    'DEPARTMENT',
    'Mengelola data kelas, presensi, catatan kesiswaan, dan nilai/rapor pada rombel yang ditugaskan.',
    { sodGroup: 'ESCHOOL_RAPOR_FINALISASI', sodSide: 'PREPARER' },
  ),
  peran(
    ROLE_AUDITOR_ESCHOOL,
    'Auditor eSchool',
    'P9',
    {
      ESCHOOL_DASHBOARD: 'P9',
      ESCHOOL_MASTER: 'P9',
      ESCHOOL_AKADEMIK: 'P9',
      ESCHOOL_DAPODIK: 'P9',
      ESCHOOL_LAYANAN: 'P9',
      ESCHOOL_LAPORAN: 'P9',
    },
    'TENANT',
    'Membaca laporan, ekspor, dan jejak audit sekolah tanpa hak mengubah data.',
    { sodGroup: 'ESCHOOL_RAPOR_FINALISASI', sodSide: 'APPROVER' },
  ),
];

export const ESCHOOL_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'eschool',
  prefix: ESCHOOL_PREFIX,
  menus: ESCHOOL_MENUS,
  roles: ESCHOOL_ROLES,
};
