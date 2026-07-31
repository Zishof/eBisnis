/**
 * Katalog menu, hak akses, dan peran koperasi.
 *
 * Ditulis penuh di sini, **belum disemai ke basis data** — menunggu
 * [IR-004](../../../../../docs/integration-requests/cooperative/004-katalog-menu-peran-hak-akses-koperasi.md)
 * yang mengusulkan registri katalog per modul. Bentuknya mengikuti usulan pada
 * IR itu, sehingga saat disetujui yang diperlukan hanya mendaftarkan berkas ini.
 *
 * ## Dua hal yang membedakan katalog ini dari daftar izin biasa
 *
 * **Pertama: pemisahan wewenang dinyatakan sebagai data, bukan sebagai
 * kebiasaan.** Koperasi mengelola uang anggotanya sendiri, sering dengan
 * petugas yang sedikit dan saling mengenal. Justru di sana pemisahan wewenang
 * paling mudah luntur — "sementara saja, orangnya sedang cuti" adalah kalimat
 * yang mendahului sebagian besar penyimpangan koperasi. Karena itu pasangan
 * izin yang tidak boleh dipegang satu orang dinyatakan di `KONFLIK_WEWENANG`
 * dan diperiksa pengujian, bukan diserahkan pada ingatan orang yang menyusun
 * peran.
 *
 * **Kedua: peran anggota terpisah sama sekali dari peran petugas.** Portal
 * anggota dibuka kepada ratusan orang. Bila `ANGGOTA` mewarisi satu saja izin
 * pengurus, ratusan orang memperolehnya sekaligus. Pengujian memeriksa bahwa
 * peran anggota tidak memuat satu pun izin di luar `COOPERATIVE_PORTAL.*`.
 */

export interface MenuKoperasi {
  code: string;
  label: string;
  path: string;
  icon: string;
  parent: string | null;
  order: number;
  /** Fase yang membuatnya, untuk penelusuran. */
  phase: string;
}

export interface PeranKoperasi {
  code: string;
  name: string;
  description: string;
  permissions: string[];
  /** Peran ini melayani anggota, bukan petugas koperasi. */
  isMemberRole: boolean;
}

export const AKSI = ['READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'EXPORT'] as const;
export type Aksi = (typeof AKSI)[number];

// ------------------------------------------------------------------- Menu

export const MENU_KOPERASI: MenuKoperasi[] = [
  { code: 'COOPERATIVE', label: 'Koperasi', path: '/app/koperasi', icon: 'Building2', parent: null, order: 400, phase: 'K-1' },

  { code: 'COOPERATIVE_PROFILE', label: 'Profil Koperasi', path: '/app/koperasi/profil', icon: 'FileBadge', parent: 'COOPERATIVE', order: 1, phase: 'K-1' },
  { code: 'COOPERATIVE_POLICY', label: 'Kebijakan & AD/ART', path: '/app/koperasi/kebijakan', icon: 'Scale', parent: 'COOPERATIVE', order: 2, phase: 'K-1' },

  { code: 'COOPERATIVE_MEMBER', label: 'Anggota', path: '/app/koperasi/anggota', icon: 'Users', parent: 'COOPERATIVE', order: 10, phase: 'K-2' },
  { code: 'COOPERATIVE_APPLICATION', label: 'Calon Anggota', path: '/app/koperasi/calon-anggota', icon: 'UserPlus', parent: 'COOPERATIVE', order: 11, phase: 'K-9' },
  { code: 'COOPERATIVE_ORGANIZATION', label: 'Kepengurusan', path: '/app/koperasi/pengurus', icon: 'Network', parent: 'COOPERATIVE', order: 12, phase: 'K-2' },

  { code: 'COOPERATIVE_SAVING', label: 'Simpanan', path: '/app/koperasi/simpanan', icon: 'PiggyBank', parent: 'COOPERATIVE', order: 20, phase: 'K-3' },
  { code: 'COOPERATIVE_SAVING_PRODUCT', label: 'Produk Simpanan', path: '/app/koperasi/produk-simpanan', icon: 'Package', parent: 'COOPERATIVE', order: 21, phase: 'K-3' },

  { code: 'COOPERATIVE_LOAN', label: 'Pinjaman', path: '/app/koperasi/pinjaman', icon: 'HandCoins', parent: 'COOPERATIVE', order: 30, phase: 'K-4' },
  { code: 'COOPERATIVE_LOAN_PRODUCT', label: 'Produk Pinjaman', path: '/app/koperasi/produk-pinjaman', icon: 'Package', parent: 'COOPERATIVE', order: 31, phase: 'K-4' },
  { code: 'COOPERATIVE_CREDIT_ANALYSIS', label: 'Analisis Kredit', path: '/app/koperasi/analisis-kredit', icon: 'ClipboardCheck', parent: 'COOPERATIVE', order: 32, phase: 'K-4' },
  { code: 'COOPERATIVE_COLLECTION', label: 'Penagihan', path: '/app/koperasi/penagihan', icon: 'PhoneCall', parent: 'COOPERATIVE', order: 33, phase: 'K-4' },

  { code: 'COOPERATIVE_MEETING', label: 'Rapat Anggota', path: '/app/koperasi/rapat', icon: 'Vote', parent: 'COOPERATIVE', order: 40, phase: 'K-5' },
  { code: 'COOPERATIVE_SHU', label: 'SHU', path: '/app/koperasi/shu', icon: 'Coins', parent: 'COOPERATIVE', order: 50, phase: 'K-6' },
  { code: 'COOPERATIVE_UNIT', label: 'Unit Usaha', path: '/app/koperasi/unit-usaha', icon: 'Store', parent: 'COOPERATIVE', order: 60, phase: 'K-7' },
  { code: 'COOPERATIVE_ACCOUNTING', label: 'Akuntansi Koperasi', path: '/app/koperasi/akuntansi', icon: 'BookOpen', parent: 'COOPERATIVE', order: 70, phase: 'K-8' },
  { code: 'COOPERATIVE_REPORT', label: 'Laporan Koperasi', path: '/app/koperasi/laporan', icon: 'FileBarChart', parent: 'COOPERATIVE', order: 71, phase: 'K-8' },

  { code: 'COOPERATIVE_WEBSITE', label: 'Situs Koperasi', path: '/app/koperasi/situs', icon: 'Globe', parent: 'COOPERATIVE', order: 80, phase: 'K-9' },
  { code: 'COOPERATIVE_COMPLAINT', label: 'Pengaduan Anggota', path: '/app/koperasi/pengaduan', icon: 'MessageSquareWarning', parent: 'COOPERATIVE', order: 81, phase: 'K-9' },

  /*
   * Portal anggota TIDAK berada di bawah menu COOPERATIVE. Ia bukan submenu
   * dari layar pengurus melainkan permukaan tersendiri dengan pembaca yang
   * berbeda. Menempatkannya sebagai anak menu pengurus adalah langkah pertama
   * menuju peran yang tanpa sengaja mewarisi keduanya.
   */
  { code: 'COOPERATIVE_PORTAL', label: 'Portal Anggota', path: '/ekoperasi/portal', icon: 'UserCircle', parent: null, order: 401, phase: 'K-9' },
];

// -------------------------------------------------------------- Hak akses

/** Aksi yang tersedia pada tiap menu. */
export const AKSI_PER_MENU: Record<string, Aksi[]> = {
  COOPERATIVE_PROFILE: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_POLICY: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_MEMBER: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_APPLICATION: ['READ', 'UPDATE', 'APPROVE'],
  COOPERATIVE_ORGANIZATION: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_SAVING: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_SAVING_PRODUCT: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_LOAN: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_LOAN_PRODUCT: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_CREDIT_ANALYSIS: ['READ', 'CREATE', 'UPDATE'],
  COOPERATIVE_COLLECTION: ['READ', 'CREATE', 'UPDATE'],
  COOPERATIVE_MEETING: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_SHU: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_UNIT: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_ACCOUNTING: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'EXPORT'],
  COOPERATIVE_REPORT: ['READ', 'EXPORT'],
  COOPERATIVE_WEBSITE: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
  COOPERATIVE_COMPLAINT: ['READ', 'UPDATE', 'APPROVE'],
  COOPERATIVE_PORTAL: ['READ', 'UPDATE'],
};

/**
 * Seluruh kode hak akses koperasi, `MENU.AKSI`.
 *
 * Perhatikan bahwa **DELETE tidak muncul di mana pun.** Bukan kelalaian:
 * tidak ada satu pun catatan koperasi yang boleh dihapus. Anggota berhenti,
 * pinjaman dihapusbukukan, pengaduan ditutup, kebijakan diganti versinya —
 * semuanya perubahan status, dan semuanya menyisakan barisnya. Menyediakan
 * izin DELETE berarti menyediakan cara menghilangkan jejak, dan koperasi
 * adalah tempat yang jejaknya paling perlu bertahan.
 */
export const HAK_AKSES_KOPERASI: string[] = Object.entries(AKSI_PER_MENU).flatMap(
  ([menu, aksi]) => aksi.map((a) => `${menu}.${a}`),
);

export function menuDariHakAkses(kode: string): string {
  return kode.slice(0, kode.lastIndexOf('.'));
}

// ------------------------------------------------------- Konflik wewenang

export interface KonflikWewenang {
  a: string;
  b: string;
  alasan: string;
}

/**
 * Pasangan hak akses yang tidak boleh dipegang satu orang.
 *
 * Diperiksa saat peran disusun DAN saat peran diberikan kepada seseorang.
 * Bukan sekadar peringatan: koperasi mengelola uang anggotanya sendiri,
 * sering dengan petugas yang sedikit dan saling mengenal, sehingga
 * pemisahannya paling mudah luntur justru di sini.
 */
export const KONFLIK_WEWENANG: KonflikWewenang[] = [
  {
    a: 'COOPERATIVE_CREDIT_ANALYSIS.CREATE',
    b: 'COOPERATIVE_LOAN.APPROVE',
    alasan:
      'Orang yang menganalisis kelayakan pinjaman tidak boleh menyetujuinya sendiri — analisisnya kehilangan seluruh gunanya bila ia sekaligus yang memutuskan.',
  },
  {
    a: 'COOPERATIVE_SAVING.CREATE',
    b: 'COOPERATIVE_SAVING.APPROVE',
    alasan:
      'Petugas yang mencatat setoran tidak boleh mengesahkan catatannya sendiri.',
  },
  {
    a: 'COOPERATIVE_LOAN.CREATE',
    b: 'COOPERATIVE_LOAN.APPROVE',
    alasan:
      'Pengaju pencairan tidak boleh menyetujui pencairannya sendiri. Ini pasangan yang paling sering dipakai menyalurkan pinjaman fiktif.',
  },
  {
    a: 'COOPERATIVE_SHU.CREATE',
    b: 'COOPERATIVE_SHU.APPROVE',
    alasan:
      'Penghitung SHU tidak boleh mengesahkan angkanya sendiri; pengesahannya ada pada RAT.',
  },
  {
    a: 'COOPERATIVE_ACCOUNTING.CREATE',
    b: 'COOPERATIVE_ACCOUNTING.APPROVE',
    alasan: 'Penyusun jurnal tidak boleh memposting jurnalnya sendiri.',
  },
  {
    a: 'COOPERATIVE_MEMBER.CREATE',
    b: 'COOPERATIVE_MEMBER.APPROVE',
    alasan:
      'Pencatat anggota baru tidak boleh mengesahkan keanggotaannya sendiri — anggota fiktif adalah pintu masuk ke simpanan dan pinjaman fiktif.',
  },
];

export interface HasilPeriksaKonflik {
  ok: boolean;
  konflik: KonflikWewenang[];
}

/** Memeriksa sekumpulan hak akses terhadap seluruh pasangan terlarang. */
export function periksaKonflik(hakAkses: string[]): HasilPeriksaKonflik {
  const punya = new Set(hakAkses);
  const konflik = KONFLIK_WEWENANG.filter((k) => punya.has(k.a) && punya.has(k.b));
  return { ok: konflik.length === 0, konflik };
}

// ------------------------------------------------------------------- Peran

const semua = (menu: string): string[] =>
  (AKSI_PER_MENU[menu] ?? []).map((a) => `${menu}.${a}`);

const baca = (...menu: string[]): string[] => menu.map((m) => `${m}.READ`);

export const PERAN_KOPERASI: PeranKoperasi[] = [
  {
    code: 'COOPERATIVE_CHAIRMAN',
    name: 'Ketua Pengurus',
    description:
      'Memimpin koperasi dan menandatangani perjanjian. Menyetujui, tetapi tidak mencatat — pemisahan itu yang membuat persetujuannya berarti.',
    isMemberRole: false,
    permissions: [
      ...baca(
        'COOPERATIVE_PROFILE', 'COOPERATIVE_POLICY', 'COOPERATIVE_MEMBER',
        'COOPERATIVE_APPLICATION', 'COOPERATIVE_ORGANIZATION', 'COOPERATIVE_SAVING',
        'COOPERATIVE_LOAN', 'COOPERATIVE_CREDIT_ANALYSIS', 'COOPERATIVE_COLLECTION',
        'COOPERATIVE_MEETING', 'COOPERATIVE_SHU', 'COOPERATIVE_UNIT',
        'COOPERATIVE_ACCOUNTING', 'COOPERATIVE_REPORT', 'COOPERATIVE_WEBSITE',
        'COOPERATIVE_COMPLAINT', 'COOPERATIVE_SAVING_PRODUCT', 'COOPERATIVE_LOAN_PRODUCT',
      ),
      'COOPERATIVE_PROFILE.APPROVE',
      'COOPERATIVE_POLICY.APPROVE',
      'COOPERATIVE_MEMBER.APPROVE',
      'COOPERATIVE_APPLICATION.APPROVE',
      'COOPERATIVE_ORGANIZATION.APPROVE',
      'COOPERATIVE_LOAN.APPROVE',
      'COOPERATIVE_MEETING.APPROVE',
      'COOPERATIVE_SHU.APPROVE',
      'COOPERATIVE_UNIT.APPROVE',
      'COOPERATIVE_COMPLAINT.APPROVE',
      'COOPERATIVE_REPORT.EXPORT',
    ],
  },
  {
    code: 'COOPERATIVE_SECRETARY',
    name: 'Sekretaris',
    description:
      'Mengurus keanggotaan, rapat, notulen, dan situs. Tidak menyentuh uang sama sekali.',
    isMemberRole: false,
    permissions: [
      ...semua('COOPERATIVE_MEMBER').filter((p) => !p.endsWith('.APPROVE')),
      ...semua('COOPERATIVE_APPLICATION').filter((p) => !p.endsWith('.APPROVE')),
      ...semua('COOPERATIVE_ORGANIZATION').filter((p) => !p.endsWith('.APPROVE')),
      ...semua('COOPERATIVE_MEETING').filter((p) => !p.endsWith('.APPROVE')),
      ...semua('COOPERATIVE_WEBSITE').filter((p) => !p.endsWith('.APPROVE')),
      ...semua('COOPERATIVE_COMPLAINT').filter((p) => !p.endsWith('.APPROVE')),
      ...baca('COOPERATIVE_PROFILE', 'COOPERATIVE_POLICY', 'COOPERATIVE_REPORT'),
    ],
  },
  {
    code: 'COOPERATIVE_TREASURER',
    name: 'Bendahara',
    description:
      'Bertanggung jawab atas kas dan pembukuan. Menyusun jurnal, tetapi tidak memostingnya sendiri.',
    isMemberRole: false,
    permissions: [
      'COOPERATIVE_ACCOUNTING.READ',
      'COOPERATIVE_ACCOUNTING.CREATE',
      'COOPERATIVE_ACCOUNTING.UPDATE',
      'COOPERATIVE_ACCOUNTING.EXPORT',
      'COOPERATIVE_SHU.READ',
      'COOPERATIVE_SHU.CREATE',
      'COOPERATIVE_SHU.UPDATE',
      'COOPERATIVE_SHU.EXPORT',
      ...baca(
        'COOPERATIVE_SAVING', 'COOPERATIVE_LOAN', 'COOPERATIVE_MEMBER',
        'COOPERATIVE_UNIT', 'COOPERATIVE_REPORT', 'COOPERATIVE_PROFILE',
      ),
      'COOPERATIVE_REPORT.EXPORT',
      'COOPERATIVE_SAVING.EXPORT',
      'COOPERATIVE_LOAN.EXPORT',
    ],
  },
  {
    code: 'COOPERATIVE_SUPERVISOR',
    name: 'Pengawas',
    description:
      'Mengawasi jalannya koperasi. HANYA membaca dan mengekspor — pengawas yang dapat mengubah data tidak lagi dapat mengawasinya.',
    isMemberRole: false,
    permissions: [
      ...baca(
        'COOPERATIVE_PROFILE', 'COOPERATIVE_POLICY', 'COOPERATIVE_MEMBER',
        'COOPERATIVE_APPLICATION', 'COOPERATIVE_ORGANIZATION', 'COOPERATIVE_SAVING',
        'COOPERATIVE_SAVING_PRODUCT', 'COOPERATIVE_LOAN', 'COOPERATIVE_LOAN_PRODUCT',
        'COOPERATIVE_CREDIT_ANALYSIS', 'COOPERATIVE_COLLECTION', 'COOPERATIVE_MEETING',
        'COOPERATIVE_SHU', 'COOPERATIVE_UNIT', 'COOPERATIVE_ACCOUNTING',
        'COOPERATIVE_REPORT', 'COOPERATIVE_COMPLAINT', 'COOPERATIVE_WEBSITE',
      ),
      'COOPERATIVE_REPORT.EXPORT',
      'COOPERATIVE_ACCOUNTING.EXPORT',
      'COOPERATIVE_SHU.EXPORT',
      'COOPERATIVE_MEMBER.EXPORT',
      'COOPERATIVE_SAVING.EXPORT',
      'COOPERATIVE_LOAN.EXPORT',
    ],
  },
  {
    code: 'COOPERATIVE_MANAGER',
    name: 'Manajer Koperasi',
    description:
      'Menjalankan kegiatan sehari-hari. Menyetujui pinjaman dalam batas kewenangannya, tetapi tidak menganalisisnya sendiri.',
    isMemberRole: false,
    permissions: [
      ...baca(
        'COOPERATIVE_PROFILE', 'COOPERATIVE_POLICY', 'COOPERATIVE_MEMBER',
        'COOPERATIVE_APPLICATION', 'COOPERATIVE_SAVING', 'COOPERATIVE_LOAN',
        'COOPERATIVE_CREDIT_ANALYSIS', 'COOPERATIVE_COLLECTION', 'COOPERATIVE_MEETING',
        'COOPERATIVE_SHU', 'COOPERATIVE_UNIT', 'COOPERATIVE_ACCOUNTING',
        'COOPERATIVE_REPORT', 'COOPERATIVE_COMPLAINT',
      ),
      'COOPERATIVE_LOAN.APPROVE',
      'COOPERATIVE_SAVING.APPROVE',
      'COOPERATIVE_COMPLAINT.UPDATE',
      'COOPERATIVE_COMPLAINT.APPROVE',
      'COOPERATIVE_UNIT.UPDATE',
      'COOPERATIVE_REPORT.EXPORT',
    ],
  },
  {
    code: 'COOPERATIVE_SAVING_OFFICER',
    name: 'Petugas Simpanan',
    description: 'Mencatat setoran dan penarikan simpanan. Tidak mengesahkan catatannya sendiri.',
    isMemberRole: false,
    permissions: [
      'COOPERATIVE_SAVING.READ',
      'COOPERATIVE_SAVING.CREATE',
      'COOPERATIVE_SAVING.UPDATE',
      ...baca('COOPERATIVE_MEMBER', 'COOPERATIVE_SAVING_PRODUCT'),
    ],
  },
  {
    code: 'COOPERATIVE_LOAN_OFFICER',
    name: 'Petugas Pinjaman',
    description:
      'Menerima permohonan dan menyusun analisis kredit. TIDAK menyetujui — itu pemisahan yang paling menentukan di koperasi simpan pinjam.',
    isMemberRole: false,
    permissions: [
      'COOPERATIVE_LOAN.READ',
      'COOPERATIVE_LOAN.CREATE',
      'COOPERATIVE_LOAN.UPDATE',
      ...semua('COOPERATIVE_CREDIT_ANALYSIS'),
      ...baca('COOPERATIVE_MEMBER', 'COOPERATIVE_LOAN_PRODUCT', 'COOPERATIVE_SAVING'),
    ],
  },
  {
    code: 'COOPERATIVE_COLLECTOR',
    name: 'Petugas Penagihan',
    description: 'Menangani tunggakan. Mencatat kunjungan dan janji bayar, tidak mengubah pinjamannya.',
    isMemberRole: false,
    permissions: [
      ...semua('COOPERATIVE_COLLECTION'),
      ...baca('COOPERATIVE_LOAN', 'COOPERATIVE_MEMBER'),
    ],
  },
  {
    /*
     * Peran anggota. Terpisah sama sekali dari peran petugas, dan pengujian
     * memeriksa bahwa isinya tidak pernah keluar dari COOPERATIVE_PORTAL.*.
     * Portal dibuka kepada ratusan orang; satu izin pengurus yang bocor ke
     * sini bocor kepada mereka semua sekaligus.
     */
    code: 'COOPERATIVE_MEMBER_PORTAL',
    name: 'Anggota',
    description:
      'Melihat simpanan, pinjaman, SHU, rapat, dan pengaduannya sendiri. Tidak melihat data anggota lain.',
    isMemberRole: true,
    permissions: ['COOPERATIVE_PORTAL.READ', 'COOPERATIVE_PORTAL.UPDATE'],
  },
];

export const CATALOG_RBAC_KOPERASI = {
  module: 'cooperative',
  menus: MENU_KOPERASI,
  permissions: HAK_AKSES_KOPERASI,
  roles: PERAN_KOPERASI,
  separationOfDuties: KONFLIK_WEWENANG,
} as const;
