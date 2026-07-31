/**
 * Katalog vertikal koperasi dalam bentuk yang dikenali registri Core.
 *
 * `cooperative-rbac.catalog.ts` ditulis sesi eKoperasi ketika registrinya belum
 * ada, memakai bentuknya sendiri: daftar izin eksplisit per peran. Berkas ini
 * menerjemahkannya ke bentuk yang Core semai — dan penerjemahan itu **bukan
 * sekadar perubahan bentuk.**
 *
 * ## Mengapa peta profil, bukan daftar izin
 *
 * `RoleTemplateSeed` — bentuk yang semula diusulkan IR-004 — adalah **hasil**
 * dari `expandTenantRoles()`, yang menurunkan izin dari profil dan peta modul.
 * Menyerahkan bentuk yang sudah diperluas berarti melewati mesin profil
 * sepenuhnya, dan izin yang tidak melewati mesin profil tidak tunduk pada
 * aturan pemisahan tugas yang dibangun di atasnya.
 *
 * Konsekuensinya menguntungkan: pemisahan wewenang yang semula dijaga daftar
 * `KONFLIK_WEWENANG` kini dijaga bentuk profilnya sendiri — `C1` tidak memiliki
 * `APPROVE`, dan `C2` tidak memiliki `CREATE`. Tidak ada cara menyusun peran
 * yang melanggarnya tanpa mengubah profilnya.
 *
 * `KONFLIK_WEWENANG` tetap dipertahankan sebagai pemeriksaan kedua, sebab
 * seorang pengguna dapat diberi **dua peran** sekaligus — dan gabungan dua
 * peran yang masing-masing sah dapat menghasilkan wewenang yang tidak sah.
 */

import type { MenuNodeSeed } from '../../../infrastructure/provisioning/tenant-menu.seed';
import type { RoleCatalogEntry } from '../../../infrastructure/provisioning/tenant-role.seed';
import type { VerticalCatalog } from '../../../infrastructure/provisioning/vertical-catalog.registry';

/** Awalan menu dan peran koperasi. */
export const COOPERATIVE_PREFIX = 'COOPERATIVE';

/**
 * Menu koperasi, disusun menjadi ENAM modul.
 *
 * ## Mengapa tidak satu modul "Koperasi" saja
 *
 * Mesin profil Core memberi satu profil per **modul**, dan modul adalah menu
 * teratas pada pohonnya. Bila seluruh layar koperasi bernaung di bawah satu
 * menu `COOPERATIVE`, satu peran hanya dapat memiliki satu profil untuk
 * semuanya — dan Petugas Simpanan akan memperoleh hak mencatat pada layar
 * pinjaman, sebab keduanya satu modul.
 *
 * Itu menghapus pemisahan yang paling menentukan pada koperasi simpan pinjam.
 *
 * Jadi batas modul dibuat mengikuti **batas pemisahan wewenang**, bukan
 * mengikuti kerapian menu. Perubahan dari susunan yang digambar sesi eKoperasi,
 * dan disengaja: susunan itu benar sebagai peta layar, tetapi sebagai peta
 * wewenang ia terlalu kasar.
 *
 * ## Aksi yang ditawarkan tiap menu
 *
 * `resolveMenuActions()` mengambil irisan antara aksi yang diberikan profil dan
 * aksi yang ditawarkan menu. Menu yang tidak menyebutkan aksinya hanya
 * menawarkan `READ` — jadi menyebutkannya bukan kerapian melainkan syarat.
 */

const BACA = ['READ', 'PRINT'];
const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT', 'SUBMIT'];
const SETUJUI = [...CATAT, 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL'];
const AUDIT = [...BACA, 'EXPORT', 'AUDIT_READ'];
/** Aksi lengkap untuk layar yang menyentuh uang. */
const KEUANGAN = [...SETUJUI, 'AUDIT_READ', 'VIEW_AMOUNT'];

interface Simpul {
  code: string;
  parent?: string;
  label: string;
  route: string;
  icon: string;
  order: number;
  actions: string[];
}

const SIMPUL: Simpul[] = [
  // --- Modul 1: koperasi, keanggotaan, situs -------------------------------
  { code: 'COOPERATIVE', label: 'Koperasi', route: '/app/koperasi', icon: 'Building2', order: 400, actions: [...SETUJUI, 'AUDIT_READ'] },
  { code: 'COOPERATIVE_PROFILE', parent: 'COOPERATIVE', label: 'Profil Koperasi', route: '/app/koperasi/profil', icon: 'FileBadge', order: 1, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_POLICY', parent: 'COOPERATIVE', label: 'Kebijakan & AD/ART', route: '/app/koperasi/kebijakan', icon: 'Scale', order: 2, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_MEMBER', parent: 'COOPERATIVE', label: 'Anggota', route: '/app/koperasi/anggota', icon: 'Users', order: 10, actions: [...SETUJUI, 'AUDIT_READ'] },
  { code: 'COOPERATIVE_APPLICATION', parent: 'COOPERATIVE', label: 'Calon Anggota', route: '/app/koperasi/calon-anggota', icon: 'UserPlus', order: 11, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_ORGANIZATION', parent: 'COOPERATIVE', label: 'Kepengurusan', route: '/app/koperasi/pengurus', icon: 'Network', order: 12, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_WEBSITE', parent: 'COOPERATIVE', label: 'Situs Koperasi', route: '/app/koperasi/situs', icon: 'Globe', order: 80, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_COMPLAINT', parent: 'COOPERATIVE', label: 'Pengaduan Anggota', route: '/app/koperasi/pengaduan', icon: 'MessageSquareWarning', order: 81, actions: [...SETUJUI, 'AUDIT_READ'] },

  // --- Modul 2: simpanan ---------------------------------------------------
  { code: 'COOPERATIVE_SAVING', label: 'Simpanan', route: '/app/koperasi/simpanan', icon: 'PiggyBank', order: 420, actions: [...KEUANGAN] },
  { code: 'COOPERATIVE_SAVING_PRODUCT', parent: 'COOPERATIVE_SAVING', label: 'Produk Simpanan', route: '/app/koperasi/produk-simpanan', icon: 'Package', order: 1, actions: [...SETUJUI] },

  // --- Modul 3: pinjaman ---------------------------------------------------
  //
  // `DISBURSE` dan `WRITE_OFF` hanya ditawarkan di sini. Menawarkannya pada
  // menu lain berarti profil yang memuatnya memperolehnya di tempat yang tidak
  // ada hubungannya dengan pencairan.
  { code: 'COOPERATIVE_LOAN', label: 'Pinjaman', route: '/app/koperasi/pinjaman', icon: 'HandCoins', order: 430, actions: [...KEUANGAN, 'DISBURSE', 'WRITE_OFF'] },
  { code: 'COOPERATIVE_LOAN_PRODUCT', parent: 'COOPERATIVE_LOAN', label: 'Produk Pinjaman', route: '/app/koperasi/produk-pinjaman', icon: 'Package', order: 1, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_CREDIT_ANALYSIS', parent: 'COOPERATIVE_LOAN', label: 'Analisis Kredit', route: '/app/koperasi/analisis-kredit', icon: 'ClipboardCheck', order: 2, actions: [...CATAT, 'ANALYZE', 'REVIEW'] },
  { code: 'COOPERATIVE_COLLECTION', parent: 'COOPERATIVE_LOAN', label: 'Penagihan', route: '/app/koperasi/penagihan', icon: 'PhoneCall', order: 3, actions: [...CATAT, 'AUDIT_READ'] },

  // --- Modul 4: tata kelola ------------------------------------------------
  { code: 'COOPERATIVE_GOVERNANCE', label: 'Rapat & SHU', route: '/app/koperasi/rapat', icon: 'Vote', order: 440, actions: [...KEUANGAN] },
  { code: 'COOPERATIVE_MEETING', parent: 'COOPERATIVE_GOVERNANCE', label: 'Rapat Anggota', route: '/app/koperasi/rapat', icon: 'Vote', order: 1, actions: [...SETUJUI, 'AUDIT_READ'] },
  { code: 'COOPERATIVE_SHU', parent: 'COOPERATIVE_GOVERNANCE', label: 'SHU', route: '/app/koperasi/shu', icon: 'Coins', order: 2, actions: [...KEUANGAN] },

  // --- Modul 5: usaha dan pembukuan ---------------------------------------
  { code: 'COOPERATIVE_BUSINESS', label: 'Unit Usaha & Pembukuan', route: '/app/koperasi/unit-usaha', icon: 'Store', order: 450, actions: [...KEUANGAN, 'POST', 'REVERSE'] },
  { code: 'COOPERATIVE_UNIT', parent: 'COOPERATIVE_BUSINESS', label: 'Unit Usaha', route: '/app/koperasi/unit-usaha', icon: 'Store', order: 1, actions: [...SETUJUI] },
  { code: 'COOPERATIVE_ACCOUNTING', parent: 'COOPERATIVE_BUSINESS', label: 'Akuntansi Koperasi', route: '/app/koperasi/akuntansi', icon: 'BookOpen', order: 2, actions: [...KEUANGAN, 'POST', 'REVERSE'] },
  { code: 'COOPERATIVE_REPORT', parent: 'COOPERATIVE_BUSINESS', label: 'Laporan Koperasi', route: '/app/koperasi/laporan', icon: 'FileBarChart', order: 3, actions: AUDIT },

  /*
   * --- Modul 6: portal anggota --------------------------------------------
   *
   * Modulnya sendiri, dan itu menentukan. Portal yang bernaung di bawah menu
   * pengurus akan mewarisi profilnya, dan ratusan anggota akan memperoleh apa
   * pun yang dimiliki peran pengurus pada modul itu.
   */
  { code: 'COOPERATIVE_PORTAL', label: 'Portal Anggota', route: '/ekoperasi/portal', icon: 'UserCircle', order: 460, actions: ['READ', 'CREATE', 'SUBMIT', 'PRINT'] },
];

export const COOPERATIVE_MENUS: MenuNodeSeed[] = SIMPUL.map((n) => ({
  code: n.code,
  parentCode: n.parent,
  label: n.label,
  translationKey: `menu.${n.code.toLowerCase().replace(/_/g, '.')}`,
  route: n.route,
  icon: n.icon,
  moduleCode: COOPERATIVE_PREFIX,
  sortOrder: n.order,
  actions: n.actions,
}));

/** Enam modul koperasi, yaitu menu yang tidak berinduk. */
export const COOPERATIVE_MODULES = SIMPUL.filter((n) => !n.parent).map((n) => n.code);

/** Modul dasar yang dimiliki setiap peran. */
const DASAR = { HOME: 'P1', SUPPORT: 'P1' } as const;

/** Modul pengurus — seluruh modul koperasi kecuali portal anggota. */
const MODUL_PENGURUS = COOPERATIVE_MODULES.filter((c) => c !== 'COOPERATIVE_PORTAL');

const semuaModul = (profil: string): Record<string, string> =>
  Object.fromEntries(MODUL_PENGURUS.map((c) => [c, profil]));

const peran = (
  code: string,
  name: string,
  profile: RoleCatalogEntry['profile'],
  modules: Record<string, string>,
  dataScope: RoleCatalogEntry['dataScope'],
  description: string,
  extra: Partial<RoleCatalogEntry> = {},
): RoleCatalogEntry => ({
  code,
  name,
  family: 'Koperasi',
  profile,
  modules: { ...DASAR, ...modules } as RoleCatalogEntry['modules'],
  dataScope,
  description,
  core: false,
  ...extra,
});

/**
 * Mengapa hanya SATU kelompok pemisahan tugas.
 *
 * Model peran Core memberi satu `sodGroup` per peran. Manajer Koperasi
 * menyetujui pinjaman **dan** simpanan, tetapi hanya dapat berada pada satu
 * kelompok — sehingga kelompok "simpanan" akan berisi pencatatnya saja, tanpa
 * satu pun pihak penyetuju.
 *
 * Kelompok yang hanya berisi satu sisi tidak pernah dapat bertentangan. Ia
 * muncul pada layar aturan sebagai pemeriksaan yang tampak berjalan padahal
 * tidak pernah menyala, dan itu lebih buruk daripada tidak ada — orang
 * mengandalkannya.
 *
 * Jadi yang dinyatakan hanya `COOPERATIVE_LOAN`, pasangan yang paling sering
 * dipakai menyalurkan pinjaman fiktif. Pemisahan pada simpanan dan pembukuan
 * tetap ditegakkan **dua lapis lain** yang tidak bergantung pada kelompok ini:
 *
 *   · bentuk profil — `C1` tidak memuat `APPROVE` maupun `POST`;
 *   · constraint basis data K-3 dan K-8 — pencatat tidak boleh sama dengan
 *     pengesah, ditolak pada barisnya sendiri.
 *
 * Bila kelak Core mengizinkan sebuah peran berada pada beberapa kelompok,
 * keduanya layak dinyatakan di sini.
 */
export const COOPERATIVE_ROLES: RoleCatalogEntry[] = [
  /*
   * Ketua: menyetujui di mana-mana, mencatat di mana pun tidak. Satu-satunya
   * yang memegang C3, dan karena itu satu-satunya yang memegang WRITE_OFF.
   */
  peran(
    'COOPERATIVE_CHAIRMAN',
    'Ketua Pengurus Koperasi',
    'C3',
    { ...semuaModul('C2'), COOPERATIVE_LOAN: 'C3' },
    'TENANT',
    'Memimpin koperasi dan menandatangani perjanjian. Menyetujui, tetapi tidak mencatat — pemisahan itulah yang membuat persetujuannya berarti.',
    { sodGroup: 'COOPERATIVE_LOAN', sodSide: 'APPROVER' },
  ),

  peran(
    'COOPERATIVE_SECRETARY',
    'Sekretaris Koperasi',
    'C1',
    { COOPERATIVE: 'C1', COOPERATIVE_GOVERNANCE: 'C1', COOPERATIVE_BUSINESS: 'P1' },
    'TENANT',
    'Mengurus keanggotaan, rapat, notulen, dan situs. Tidak menyentuh modul simpanan maupun pinjaman sama sekali.',
  ),

  peran(
    'COOPERATIVE_TREASURER',
    'Bendahara Koperasi',
    'C1',
    {
      COOPERATIVE_BUSINESS: 'C1',
      COOPERATIVE_GOVERNANCE: 'C1',
      COOPERATIVE_SAVING: 'P1',
      COOPERATIVE_LOAN: 'P1',
      COOPERATIVE: 'P1',
    },
    'TENANT',
    'Bertanggung jawab atas kas dan pembukuan. Menyusun jurnal, tetapi tidak memostingnya sendiri.',
  ),

  /*
   * Pengawas memakai P9 pada seluruh modul: READ, EXPORT, PRINT, AUDIT_READ,
   * tanpa satu pun hak menulis. Pengawas yang dapat mengubah data tidak lagi
   * dapat mengawasinya; ia menjadi pihak yang perlu diawasi.
   */
  peran(
    'COOPERATIVE_SUPERVISOR',
    'Pengawas Koperasi',
    'P9',
    semuaModul('P9'),
    'TENANT',
    'Mengawasi jalannya koperasi. HANYA membaca, mengekspor, dan membaca jejak audit.',
    { sodGroup: 'COOPERATIVE_LOAN', sodSide: 'APPROVER' },
  ),

  peran(
    'COOPERATIVE_MANAGER',
    'Manajer Koperasi',
    'C2',
    {
      ...semuaModul('P1'),
      COOPERATIVE: 'C2',
      COOPERATIVE_SAVING: 'C2',
      COOPERATIVE_LOAN: 'C2',
    },
    'TENANT',
    'Menjalankan kegiatan sehari-hari. Menyetujui dan mencairkan pinjaman dalam batas kewenangannya, tetapi tidak menganalisisnya sendiri.',
    { sodGroup: 'COOPERATIVE_LOAN', sodSide: 'APPROVER' },
  ),

  peran(
    'COOPERATIVE_SAVING_OFFICER',
    'Petugas Simpanan',
    'C1',
    { COOPERATIVE_SAVING: 'C1', COOPERATIVE: 'P1' },
    'OUTLET',
    'Mencatat setoran dan penarikan simpanan. Tidak menyentuh modul pinjaman, dan tidak mengesahkan catatannya sendiri.',
  ),

  /*
   * Peran yang paling menentukan di koperasi simpan pinjam.
   *
   * `C1` memberi `ANALYZE` dan tidak memberi `APPROVE` maupun `DISBURSE`.
   * Bukan karena daftar izinnya disusun demikian, melainkan karena profilnya
   * memang tidak memuatnya — tidak ada cara memberinya hak menyetujui tanpa
   * mengubah profil C1 itu sendiri.
   */
  peran(
    'COOPERATIVE_LOAN_OFFICER',
    'Petugas Pinjaman',
    'C1',
    { COOPERATIVE_LOAN: 'C1', COOPERATIVE_SAVING: 'P1', COOPERATIVE: 'P1' },
    'OUTLET',
    'Menerima permohonan dan menyusun analisis kredit. TIDAK menyetujui dan TIDAK mencairkan.',
    { sodGroup: 'COOPERATIVE_LOAN', sodSide: 'PREPARER' },
  ),

  peran(
    'COOPERATIVE_COLLECTOR',
    'Petugas Penagihan',
    'C1',
    { COOPERATIVE_LOAN: 'C1', COOPERATIVE: 'P1' },
    'OUTLET',
    'Menangani tunggakan. Mencatat kunjungan dan janji bayar.',
  ),

  /*
   * Peran anggota. Satu-satunya yang memegang modul portal, dan satu-satunya
   * yang tidak memegang modul pengurus mana pun.
   *
   * `dataScope: 'SELF'` menegaskan hal yang sama pada lapisan berbeda. Cakupan
   * sesungguhnya tetap ditegakkan `cooperative-portal.ts` di sisi peladen —
   * ini lapis tambahan, bukan penggantinya.
   */
  peran(
    'COOPERATIVE_MEMBER_PORTAL',
    'Anggota Koperasi',
    'C4',
    { COOPERATIVE_PORTAL: 'C4' },
    'SELF',
    'Melihat simpanan, pinjaman, SHU, rapat, dan pengaduannya sendiri. Tidak melihat data anggota lain.',
  ),
];

export const COOPERATIVE_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'cooperative',
  prefix: COOPERATIVE_PREFIX,
  menus: COOPERATIVE_MENUS,
  roles: COOPERATIVE_ROLES,
};
