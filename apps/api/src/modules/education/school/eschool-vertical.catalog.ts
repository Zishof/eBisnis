/**
 * Katalog vertikal eSchool: menu, peran, dan aksi.
 *
 * ## Mengapa eSchool lebih dahulu
 *
 * Dari tiga vertical pendidikan, sekolah dipilih pertama karena tiga hal:
 * aturannya paling sederhana (tanpa SKS, KRS, maupun IPK), presedennya di
 * source legacy paling besar (240 class), dan portal orang tua menguji cakupan
 * data `GUARDIAN_CHILD` sejak awal.
 *
 * Yang terakhir yang menentukan. Portal wali adalah permukaan terluas dan
 * penggunanya paling sedikit terlatih; menundanya ke fase terakhir berarti
 * menguji risiko terbesar ketika waktu paling sedikit tersisa.
 *
 * ## Mengapa dipecah menjadi lima modul, bukan satu menu "Sekolah"
 *
 * Mesin profil Core memberi satu profil per **modul**, dan modul adalah menu
 * teratas pada pohonnya. Bila seluruh layar sekolah bernaung di bawah satu menu
 * `ESCHOOL`, satu peran hanya dapat memiliki satu profil untuk semuanya — dan
 * Guru BK akan memperoleh hak yang sama pada layar nilai dan layar tagihan.
 *
 * Pemisahannya karena itu bukan kerapian menu, melainkan satu-satunya cara
 * menyatakan bahwa wali kelas boleh menilai tetapi tidak boleh menagih, dan
 * bahwa catatan konseling tidak terbuka bagi setiap guru.
 */

import type { MenuNodeSeed } from '../../../infrastructure/provisioning/tenant-menu.seed';
import type { RoleCatalogEntry } from '../../../infrastructure/provisioning/tenant-role.seed';
import type { VerticalCatalog } from '../../../infrastructure/provisioning/vertical-catalog.registry';

/** Awalan menu dan peran eSchool. */
export const ESCHOOL_PREFIX = 'ESCHOOL';

const BACA = ['READ', 'PRINT'];
const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT', 'SUBMIT'];
const SETUJUI = [...CATAT, 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL'];
/** Layar yang menyentuh uang sekolah. */
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
  // --- Modul 1: penerimaan murid baru --------------------------------------
  //
  // Terpisah dari modul kesiswaan karena pelakunya berbeda dan berlangsung
  // musiman. Operator SPMB bekerja beberapa bulan setahun, dan haknya tidak
  // perlu berlanjut ke data murid yang sudah aktif.
  { code: 'ESCHOOL_ADMISSION', label: 'Penerimaan Murid', route: '/app/sekolah/spmb', icon: 'UserPlus', order: 500, actions: [...SETUJUI] },
  { code: 'ESCHOOL_ADMISSION_PERIOD', parent: 'ESCHOOL_ADMISSION', label: 'Gelombang & Jalur', route: '/app/sekolah/spmb/gelombang', icon: 'CalendarRange', order: 1, actions: [...SETUJUI] },
  { code: 'ESCHOOL_ADMISSION_APPLICANT', parent: 'ESCHOOL_ADMISSION', label: 'Pendaftar', route: '/app/sekolah/spmb/pendaftar', icon: 'ClipboardList', order: 2, actions: [...SETUJUI] },
  { code: 'ESCHOOL_ADMISSION_DECISION', parent: 'ESCHOOL_ADMISSION', label: 'Kelulusan & Daftar Ulang', route: '/app/sekolah/spmb/kelulusan', icon: 'BadgeCheck', order: 3, actions: [...SETUJUI] },

  // --- Modul 2: kesiswaan dan organisasi sekolah ---------------------------
  { code: 'ESCHOOL_STUDENT', label: 'Kesiswaan', route: '/app/sekolah/siswa', icon: 'Users', order: 510, actions: [...SETUJUI] },
  { code: 'ESCHOOL_STUDENT_PROFILE', parent: 'ESCHOOL_STUDENT', label: 'Data Murid', route: '/app/sekolah/siswa/data', icon: 'IdCard', order: 1, actions: [...SETUJUI] },
  { code: 'ESCHOOL_GUARDIAN', parent: 'ESCHOOL_STUDENT', label: 'Orang Tua & Wali', route: '/app/sekolah/siswa/wali', icon: 'UsersRound', order: 2, actions: [...CATAT] },
  { code: 'ESCHOOL_GRADE_LEVEL', parent: 'ESCHOOL_STUDENT', label: 'Fase & Tingkat', route: '/app/sekolah/tingkat', icon: 'Layers', order: 10, actions: [...SETUJUI] },
  { code: 'ESCHOOL_CLASS', parent: 'ESCHOOL_STUDENT', label: 'Rombel & Wali Kelas', route: '/app/sekolah/rombel', icon: 'School', order: 11, actions: [...SETUJUI] },
  { code: 'ESCHOOL_PLACEMENT', parent: 'ESCHOOL_STUDENT', label: 'Penempatan & Mutasi', route: '/app/sekolah/penempatan', icon: 'ArrowLeftRight', order: 12, actions: [...SETUJUI] },
  { code: 'ESCHOOL_PROMOTION', parent: 'ESCHOOL_STUDENT', label: 'Kenaikan & Kelulusan', route: '/app/sekolah/kenaikan', icon: 'TrendingUp', order: 20, actions: [...SETUJUI] },

  // --- Modul 3: pembelajaran ----------------------------------------------
  { code: 'ESCHOOL_LEARNING', label: 'Pembelajaran', route: '/app/sekolah/pembelajaran', icon: 'BookOpen', order: 520, actions: [...SETUJUI] },
  { code: 'ESCHOOL_CURRICULUM', parent: 'ESCHOOL_LEARNING', label: 'Kurikulum & Mapel', route: '/app/sekolah/kurikulum', icon: 'Library', order: 1, actions: [...SETUJUI] },
  { code: 'ESCHOOL_SCHEDULE', parent: 'ESCHOOL_LEARNING', label: 'Jadwal & Pengampu', route: '/app/sekolah/jadwal', icon: 'CalendarClock', order: 2, actions: [...SETUJUI] },
  { code: 'ESCHOOL_ATTENDANCE', parent: 'ESCHOOL_LEARNING', label: 'Presensi', route: '/app/sekolah/presensi', icon: 'CalendarCheck', order: 3, actions: [...CATAT] },
  { code: 'ESCHOOL_ASSESSMENT', parent: 'ESCHOOL_LEARNING', label: 'Asesmen & Nilai', route: '/app/sekolah/asesmen', icon: 'PenLine', order: 10, actions: [...SETUJUI] },
  // `APPROVE` di sini berarti menerbitkan rapor. Sesudah terbit, koreksi
  // menghasilkan versi baru — bukan menimpa nilai yang sudah dibaca wali.
  { code: 'ESCHOOL_REPORT_CARD', parent: 'ESCHOOL_LEARNING', label: 'Rapor', route: '/app/sekolah/rapor', icon: 'FileText', order: 11, actions: [...SETUJUI] },
  { code: 'ESCHOOL_PROJECT', parent: 'ESCHOOL_LEARNING', label: 'Projek & Ekstrakurikuler', route: '/app/sekolah/projek', icon: 'Sparkles', order: 20, actions: [...CATAT] },

  // --- Modul 4: bimbingan, kedisiplinan, dan inklusi -----------------------
  //
  // Modul tersendiri, dan itu keputusan keamanan.
  //
  // Catatan konseling menyangkut keluarga dan sering memuat hal yang tidak
  // boleh dibaca setiap guru — apalagi diekspor. Menaruhnya di bawah modul
  // Pembelajaran akan memberi setiap pemegang profil pembelajaran hak yang sama
  // atasnya, sebab profil diberikan per modul.
  { code: 'ESCHOOL_GUIDANCE', label: 'Bimbingan & Kedisiplinan', route: '/app/sekolah/bimbingan', icon: 'HeartHandshake', order: 530, actions: [...CATAT] },
  { code: 'ESCHOOL_COUNSELING', parent: 'ESCHOOL_GUIDANCE', label: 'Konseling', route: '/app/sekolah/bimbingan/konseling', icon: 'MessageCircleHeart', order: 1, actions: [...CATAT] },
  { code: 'ESCHOOL_DISCIPLINE', parent: 'ESCHOOL_GUIDANCE', label: 'Kedisiplinan', route: '/app/sekolah/bimbingan/kedisiplinan', icon: 'ShieldAlert', order: 2, actions: [...CATAT] },
  { code: 'ESCHOOL_INCLUSION', parent: 'ESCHOOL_GUIDANCE', label: 'Layanan Inklusi', route: '/app/sekolah/bimbingan/inklusi', icon: 'Accessibility', order: 3, actions: [...CATAT] },

  // --- Modul 5: keuangan sekolah ------------------------------------------
  { code: 'ESCHOOL_FINANCE', label: 'Keuangan Sekolah', route: '/app/sekolah/keuangan', icon: 'Wallet', order: 540, actions: [...KEUANGAN] },
  { code: 'ESCHOOL_FEE', parent: 'ESCHOOL_FINANCE', label: 'Jenis & Tarif Biaya', route: '/app/sekolah/keuangan/biaya', icon: 'ReceiptText', order: 1, actions: [...KEUANGAN] },
  { code: 'ESCHOOL_INVOICE', parent: 'ESCHOOL_FINANCE', label: 'Tagihan Murid', route: '/app/sekolah/keuangan/tagihan', icon: 'FileSpreadsheet', order: 2, actions: [...KEUANGAN] },
  { code: 'ESCHOOL_SCHOLARSHIP', parent: 'ESCHOOL_FINANCE', label: 'Beasiswa & Keringanan', route: '/app/sekolah/keuangan/beasiswa', icon: 'HandCoins', order: 3, actions: [...KEUANGAN] },

  // --- Modul 6: pelaporan nasional -----------------------------------------
  { code: 'ESCHOOL_REPORTING', label: 'Pelaporan Sekolah', route: '/app/sekolah/pelaporan', icon: 'Send', order: 550, actions: [...SETUJUI] },
  { code: 'ESCHOOL_DAPODIK', parent: 'ESCHOOL_REPORTING', label: 'Dapodik', route: '/app/sekolah/pelaporan/dapodik', icon: 'Database', order: 1, actions: [...SETUJUI] },
  { code: 'ESCHOOL_EMIS', parent: 'ESCHOOL_REPORTING', label: 'EMIS Madrasah', route: '/app/sekolah/pelaporan/emis', icon: 'Database', order: 2, actions: [...SETUJUI] },

  // --- Modul 7: portal orang tua -------------------------------------------
  //
  // Modul terpisah, dan satu-satunya yang dipegang peran wali. Wali tidak
  // memegang modul sekolah mana pun — termasuk yang hanya "lihat".
  { code: 'ESCHOOL_PARENT_PORTAL', label: 'Portal Orang Tua', route: '/portal/wali', icon: 'Home', order: 560, actions: [...BACA] },
];

const menu = (s: Simpul): MenuNodeSeed => ({
  code: s.code,
  parentCode: s.parent,
  label: s.label,
  translationKey: `menu.${s.code.toLowerCase()}`,
  route: s.route,
  icon: s.icon,
  moduleCode: 'eschool',
  sortOrder: s.order,
  actions: s.actions,
});

export const ESCHOOL_MENUS: MenuNodeSeed[] = SIMPUL.map(menu);

/** Modul yang setiap peran sekolah lihat, sekadar untuk berorientasi. */
const DASAR: Record<string, string> = {
  ESCHOOL_STUDENT: 'P1',
};

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
  family: 'Sekolah',
  profile,
  modules: { ...DASAR, ...modules } as RoleCatalogEntry['modules'],
  dataScope,
  description,
  core: false,
  ...extra,
});

export const ESCHOOL_ROLES: RoleCatalogEntry[] = [
  peran(
    'ESCHOOL_PRINCIPAL',
    'Kepala Sekolah',
    'P5',
    {
      ESCHOOL_ADMISSION: 'P4',
      ESCHOOL_STUDENT: 'P4',
      ESCHOOL_LEARNING: 'P4',
      ESCHOOL_GUIDANCE: 'P1',
      ESCHOOL_FINANCE: 'P4',
      ESCHOOL_REPORTING: 'P4',
    },
    'TENANT',
    'Menyetujui penerimaan, rapor, dan pelaporan. Menyetujui, tetapi tidak mencatat — pemisahan itulah yang membuat persetujuannya berarti.',
    { sodGroup: 'ESCHOOL_REPORT_CARD', sodSide: 'APPROVER' },
  ),

  peran(
    'ESCHOOL_ADMIN',
    'Administrator Sekolah',
    'P6',
    {
      ESCHOOL_ADMISSION: 'P2',
      ESCHOOL_STUDENT: 'P6',
      ESCHOOL_LEARNING: 'P6',
      ESCHOOL_REPORTING: 'P2',
    },
    'TENANT',
    'Mengelola data murid, rombel, kurikulum, dan jadwal. Tidak menyentuh keuangan maupun bimbingan konseling.',
  ),

  peran(
    'ESCHOOL_ADMISSION_OFFICER',
    'Operator SPMB',
    'P2',
    { ESCHOOL_ADMISSION: 'P2' },
    'TENANT',
    'Mencatat pendaftar dan berkasnya selama musim penerimaan. Tidak memutuskan kelulusan, dan tidak berlanjut ke data murid yang sudah aktif.',
  ),

  peran(
    'ESCHOOL_TEACHER',
    'Guru',
    'P2',
    { ESCHOOL_LEARNING: 'P2' },
    'CLASS_GROUP',
    'Mencatat presensi dan nilai pada kelas yang diampunya. Tidak melihat catatan konseling, tidak melihat tagihan.',
    { sodGroup: 'ESCHOOL_REPORT_CARD', sodSide: 'PREPARER' },
  ),

  peran(
    'ESCHOOL_HOMEROOM_TEACHER',
    'Wali Kelas',
    'P2',
    { ESCHOOL_LEARNING: 'P2', ESCHOOL_STUDENT: 'P2', ESCHOOL_GUIDANCE: 'P1' },
    'CLASS_GROUP',
    'Menyusun rapor rombelnya dan melihat perkembangan muridnya. Melihat ringkasan bimbingan, bukan isi catatan konselingnya.',
    { sodGroup: 'ESCHOOL_REPORT_CARD', sodSide: 'PREPARER' },
  ),

  /*
   * Guru BK memegang modul bimbingan penuh dan modul pembelajaran hanya lihat.
   *
   * Kebalikan dari guru: yang satu menilai tanpa membaca konseling, yang lain
   * membaca konseling tanpa menilai. Keduanya tidak dapat ditulis sebagai satu
   * profil, dan itulah alasan bimbingan menjadi modul tersendiri.
   */
  peran(
    'ESCHOOL_COUNSELOR',
    'Guru BK',
    'P2',
    { ESCHOOL_GUIDANCE: 'P2', ESCHOOL_LEARNING: 'P1' },
    'TENANT',
    'Mencatat konseling, kedisiplinan, dan layanan inklusi. Tidak memasukkan nilai dan tidak menerbitkan rapor.',
  ),

  peran(
    'ESCHOOL_FINANCE_OFFICER',
    'Petugas Keuangan Sekolah',
    'P2',
    { ESCHOOL_FINANCE: 'P2' },
    'TENANT',
    'Menerbitkan tagihan dan mencatat keringanan. Tidak menyetujui — persetujuan ada pada kepala sekolah.',
  ),

  peran(
    'ESCHOOL_DAPODIK_OPERATOR',
    'Operator Dapodik',
    'P2',
    { ESCHOOL_REPORTING: 'P2', ESCHOOL_STUDENT: 'P1', ESCHOOL_LEARNING: 'P1' },
    'TENANT',
    'Menyiapkan dan mengirim data ke Dapodik/EMIS. Membaca data murid dan pembelajaran, tidak mengubahnya.',
  ),

  /*
   * Peran wali. Satu-satunya yang memegang modul portal, dan satu-satunya yang
   * tidak memegang satu pun modul sekolah — termasuk yang hanya "lihat".
   *
   * `dataScope: 'GUARDIAN_CHILD'` menegaskan hal yang sama pada lapisan berbeda.
   * Cakupan sesungguhnya tetap ditegakkan di sisi peladen; ini lapis tambahan,
   * bukan penggantinya.
   */
  peran(
    'ESCHOOL_PARENT',
    'Orang Tua / Wali Murid',
    'P10',
    { ESCHOOL_PARENT_PORTAL: 'P10' },
    'GUARDIAN_CHILD',
    'Melihat presensi, nilai, rapor, dan tagihan anaknya sendiri. Tidak melihat murid lain, dan tidak melihat catatan konseling.',
    { modules: { ESCHOOL_PARENT_PORTAL: 'P10' } as RoleCatalogEntry['modules'] },
  ),
];

export const ESCHOOL_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'eschool',
  prefix: ESCHOOL_PREFIX,
  menus: ESCHOOL_MENUS,
  roles: ESCHOOL_ROLES,
};
