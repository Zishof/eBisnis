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

/**
 * Kode peran akun perangkat anjungan/kiosk (EP-M).
 *
 * Profil P12 (service account/perangkat) — BUKAN akun pribadi santri.
 * Santri tidak masuk dengan usernamenya sendiri di anjungan; perangkat
 * kiosk sendiri yang memegang kredensial ini, memindai nomor kartu, lalu
 * kiosk (bukan santri) yang memanggil API. Hanya memegang
 * `EPESANTREN_KIOSK` (READ murni) — TIDAK PERNAH `EPESANTREN_SANTRI` atau
 * `EPESANTREN_KARTU`, sebab kiosk yang dicuri/disusupi tidak boleh dapat
 * mengubah data ATAU menerbitkan kartu baru, hanya membaca cuplikan lewat
 * nomor kartu yang dipindai.
 */
export const ROLE_KIOSK = 'EPESANTREN_SERVICE_ACCOUNT_KIOSK';

const CATAT = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const PERIZINAN_AKSI = ['READ', 'CREATE', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT', 'EXPORT'];
const GERBANG_AKSI = ['READ', 'CREATE', 'PRINT'];
const PORTAL_WALI_AKSI = ['READ'];
const KIOSK_AKSI = ['READ'];
const PSB_AKSI = ['READ', 'CREATE', 'UPDATE', 'REVIEW', 'APPROVE', 'REJECT', 'CANCEL', 'PRINT', 'EXPORT'];
const KURIKULUM_AKSI = ['READ', 'CREATE', 'CANCEL', 'PRINT', 'EXPORT'];
const LAPORAN_AKSI = ['READ', 'PRINT', 'EXPORT'];
const PELANGGARAN_AKSI = ['READ', 'CREATE', 'UPDATE', 'CANCEL', 'PRINT', 'EXPORT'];
const GURU_AKSI = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const ABSENSI_GURU_AKSI = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const EKSTRAKURIKULER_AKSI = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const PRESTASI_AKSI = ['READ', 'CREATE', 'PRINT', 'EXPORT'];
const BUKU_PENGHUBUNG_AKSI = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const KATERING_AKSI = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'];
const PROFIL_AKSI = ['READ', 'UPDATE'];
const BERITA_AKSI = ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'CANCEL'];
const TAGIHAN_AKSI = ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'PRINT', 'EXPORT'];

/*
 * Pengelompokan menu (grup/subgrup di bawah) SENGAJA HANYA mencakup menu yang
 * satu-satunya pemegang perannya adalah EPESANTREN_ADMIN. `buildMenuModuleMap`
 * (role-expansion.ts) menghitung "modul" sebuah menu sebagai LELUHUR TERATAS
 * hasil penelusuran `parentCode` -- bukan induk langsungnya -- sehingga setiap
 * menu yang berbagi leluhur teratas yang sama otomatis berbagi SATU profil
 * hak akses yang sama pula untuk peran mana pun yang menunjuknya.
 *
 * `EPESANTREN_GERBANG`, `EPESANTREN_PORTAL_WALI`, dan `EPESANTREN_KIOSK`
 * SENGAJA TETAP TIDAK BERINDUK (root masing-masing) -- masing-masing dipegang
 * peran sempit (`EPESANTREN_PETUGAS_GERBANG`, `EPESANTREN_WALI`,
 * `EPESANTREN_SERVICE_ACCOUNT_KIOSK`) yang TIDAK BOLEH mendapat akses ke menu
 * lain. Menggabungkannya ke dalam grup "Pesantren" akan membuat profil sempit
 * peran itu berlaku untuk SELURUH isi grup, bukan hanya menu tunggal yang
 * dimaksud -- pelanggaran langsung atas docs/santri-info/13 R10 (petugas
 * gerbang tidak boleh melihat/menyetujui izin) dan atas prinsip yang sama
 * untuk wali dan kiosk. Ketiganya tampil sebagai butir menu berdiri sendiri
 * di sisi "Pesantren", bukan cacat -- itu batas hak akses yang disengaja.
 */
export const PESANTREN_MENUS: MenuNodeSeed[] = [
  // Grup akar -- satu-satunya pemegang peran atas grup ini adalah
  // EPESANTREN_ADMIN, jadi seluruh isinya aman dikelompokkan sedalam apa pun.
  {
    code: 'EPESANTREN_GROUP',
    label: 'Pesantren',
    translationKey: 'menu.epesantren.group',
    icon: 'School',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 500,
    actions: ['READ'],
  },

  // -- Setup dan Konfigurasi -----------------------------------------------
  {
    code: 'EPESANTREN_GRP_SETUP',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Setup dan Konfigurasi',
    translationKey: 'menu.epesantren.grpSetup',
    icon: 'Settings2',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: ['READ'],
  },
  {
    code: 'EPESANTREN_UNIT_PENDIDIKAN',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Unit Pendidikan',
    translationKey: 'menu.epesantren.unitPendidikan',
    route: '/app/pesantren/unit-pendidikan',
    icon: 'School',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_ROMBONGAN',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Rombongan Belajar',
    translationKey: 'menu.epesantren.rombongan',
    route: '/app/pesantren/rombongan',
    icon: 'Users2',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_KURIKULUM',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Kurikulum dan Jadwal',
    translationKey: 'menu.epesantren.kurikulum',
    route: '/app/pesantren/kurikulum',
    icon: 'CalendarClock',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 3,
    actions: KURIKULUM_AKSI,
  },
  {
    code: 'EPESANTREN_ASRAMA',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Asrama dan Kamar',
    translationKey: 'menu.epesantren.asrama',
    route: '/app/pesantren/asrama',
    icon: 'Building2',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 4,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_DINIYAH',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Diniyah dan Halaqah',
    translationKey: 'menu.epesantren.diniyah',
    route: '/app/pesantren/diniyah',
    icon: 'BookOpen',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 5,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_KATERING',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Dapur dan Katering',
    translationKey: 'menu.epesantren.katering',
    route: '/app/pesantren/katering',
    icon: 'CookingPot',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 6,
    actions: KATERING_AKSI,
  },
  {
    code: 'EPESANTREN_PROFIL',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Profil dan Tema Situs',
    translationKey: 'menu.epesantren.profil',
    route: '/app/pesantren/profil',
    icon: 'Palette',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 7,
    actions: PROFIL_AKSI,
  },
  {
    code: 'EPESANTREN_BERITA',
    parentCode: 'EPESANTREN_GRP_SETUP',
    label: 'Berita Pondok',
    translationKey: 'menu.epesantren.berita',
    route: '/app/pesantren/berita',
    icon: 'Newspaper',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 8,
    actions: BERITA_AKSI,
  },

  // -- Data Master -----------------------------------------------------------
  {
    code: 'EPESANTREN_GRP_MASTER',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Data Master',
    translationKey: 'menu.epesantren.grpMaster',
    icon: 'Database',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: ['READ'],
  },
  {
    code: 'EPESANTREN_SANTRI',
    parentCode: 'EPESANTREN_GRP_MASTER',
    label: 'Data Santri',
    translationKey: 'menu.epesantren.santri',
    route: '/app/pesantren/santri',
    icon: 'Users',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_GURU',
    parentCode: 'EPESANTREN_GRP_MASTER',
    label: 'Guru dan Penugasan Mengajar',
    translationKey: 'menu.epesantren.guru',
    route: '/app/pesantren/guru',
    icon: 'UserCog',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: GURU_AKSI,
  },
  {
    code: 'EPESANTREN_KARTU',
    parentCode: 'EPESANTREN_GRP_MASTER',
    label: 'Kartu Santri',
    translationKey: 'menu.epesantren.kartu',
    route: '/app/pesantren/kartu',
    icon: 'CreditCard',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 3,
    actions: CATAT,
  },

  // -- Akademik dan Kesantrian ------------------------------------------------
  {
    code: 'EPESANTREN_GRP_AKADEMIK',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Akademik dan Kesantrian',
    translationKey: 'menu.epesantren.grpAkademik',
    icon: 'GraduationCap',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 3,
    actions: ['READ'],
  },
  {
    code: 'EPESANTREN_PRESENSI',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Presensi Santri',
    translationKey: 'menu.epesantren.presensi',
    route: '/app/pesantren/presensi',
    icon: 'CalendarCheck',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_TAHFIZ',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Tahfiz',
    translationKey: 'menu.epesantren.tahfiz',
    route: '/app/pesantren/tahfiz',
    icon: 'BookMarked',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_NILAI',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Nilai dan Rapor',
    translationKey: 'menu.epesantren.nilai',
    route: '/app/pesantren/nilai',
    icon: 'GraduationCap',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 3,
    actions: CATAT,
  },
  {
    code: 'EPESANTREN_ABSENSI_GURU',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Absensi Guru dan Piket',
    translationKey: 'menu.epesantren.absensiGuru',
    route: '/app/pesantren/absensi-guru',
    icon: 'ClipboardCheck',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 4,
    actions: ABSENSI_GURU_AKSI,
  },
  {
    code: 'EPESANTREN_EKSTRAKURIKULER',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Ekstrakurikuler dan Organisasi Siswa',
    translationKey: 'menu.epesantren.ekstrakurikuler',
    route: '/app/pesantren/ekstrakurikuler',
    icon: 'Flag',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 5,
    actions: EKSTRAKURIKULER_AKSI,
  },
  {
    code: 'EPESANTREN_PRESTASI',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Prestasi dan Penghargaan',
    translationKey: 'menu.epesantren.prestasi',
    route: '/app/pesantren/prestasi',
    icon: 'Award',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 6,
    actions: PRESTASI_AKSI,
  },
  {
    code: 'EPESANTREN_BUKU_PENGHUBUNG',
    parentCode: 'EPESANTREN_GRP_AKADEMIK',
    label: 'Buku Penghubung',
    translationKey: 'menu.epesantren.bukuPenghubung',
    route: '/app/pesantren/buku-penghubung',
    icon: 'MessagesSquare',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 7,
    actions: BUKU_PENGHUBUNG_AKSI,
  },

  // -- Kedisiplinan dan Perizinan ----------------------------------------------
  // TIDAK memuat EPESANTREN_GERBANG -- lihat catatan besar di atas array ini.
  {
    code: 'EPESANTREN_GRP_KEDISIPLINAN',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Kedisiplinan dan Perizinan',
    translationKey: 'menu.epesantren.grpKedisiplinan',
    icon: 'ShieldAlert',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 4,
    actions: ['READ'],
  },
  {
    code: 'EPESANTREN_PERIZINAN',
    parentCode: 'EPESANTREN_GRP_KEDISIPLINAN',
    label: 'Perizinan Santri',
    translationKey: 'menu.epesantren.perizinan',
    route: '/app/pesantren/perizinan',
    icon: 'FileCheck',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: PERIZINAN_AKSI,
  },
  {
    code: 'EPESANTREN_PELANGGARAN',
    parentCode: 'EPESANTREN_GRP_KEDISIPLINAN',
    label: 'Pelanggaran dan Hukuman',
    translationKey: 'menu.epesantren.pelanggaran',
    route: '/app/pesantren/pelanggaran',
    icon: 'ShieldAlert',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: PELANGGARAN_AKSI,
  },

  // -- Pembayaran dan Keuangan --------------------------------------------
  {
    code: 'EPESANTREN_GRP_KEUANGAN',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Pembayaran dan Keuangan',
    translationKey: 'menu.epesantren.grpKeuangan',
    icon: 'Wallet',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 5,
    actions: ['READ'],
  },
  {
    code: 'EPESANTREN_TAGIHAN',
    parentCode: 'EPESANTREN_GRP_KEUANGAN',
    label: 'Tagihan SPP',
    translationKey: 'menu.epesantren.tagihan',
    route: '/app/pesantren/tagihan',
    icon: 'Receipt',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 1,
    actions: TAGIHAN_AKSI,
  },
  {
    code: 'EPESANTREN_DOMPET',
    parentCode: 'EPESANTREN_GRP_KEUANGAN',
    label: 'Dompet Santri',
    translationKey: 'menu.epesantren.dompet',
    route: '/app/pesantren/dompet',
    icon: 'Wallet',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 2,
    actions: CATAT,
  },

  // -- Penerimaan Santri Baru dan Laporan -- langsung di bawah grup akar,
  // sebab masing-masing baru satu butir dan belum perlu subgrup sendiri.
  {
    code: 'EPESANTREN_PSB',
    parentCode: 'EPESANTREN_GROUP',
    label: 'PSB/PPDB',
    translationKey: 'menu.epesantren.psb',
    route: '/app/pesantren/psb',
    icon: 'ClipboardList',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 6,
    actions: PSB_AKSI,
  },
  {
    code: 'EPESANTREN_LAPORAN',
    parentCode: 'EPESANTREN_GROUP',
    label: 'Laporan',
    translationKey: 'menu.epesantren.laporan',
    route: '/app/pesantren/laporan',
    icon: 'BarChart3',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 7,
    actions: LAPORAN_AKSI,
  },

  // -- Berdiri sendiri (lihat catatan besar di atas array ini) --------------
  {
    code: 'EPESANTREN_GERBANG',
    label: 'Gerbang Keluar-Masuk',
    translationKey: 'menu.epesantren.gerbang',
    route: '/app/pesantren/gerbang',
    icon: 'DoorOpen',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 501,
    actions: GERBANG_AKSI,
  },
  {
    code: 'EPESANTREN_PORTAL_WALI',
    label: 'Portal Wali',
    translationKey: 'menu.epesantren.portalWali',
    route: '/app/pesantren/portal-wali',
    icon: 'HeartHandshake',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 502,
    actions: PORTAL_WALI_AKSI,
  },
  {
    code: 'EPESANTREN_KIOSK',
    label: 'Anjungan Mandiri',
    translationKey: 'menu.epesantren.kiosk',
    route: '/app/pesantren/kiosk',
    icon: 'MonitorSmartphone',
    moduleCode: PESANTREN_PREFIX,
    sortOrder: 503,
    actions: KIOSK_AKSI,
  },
];

/** Menu yang tidak berinduk: grup akar "Pesantren" ditambah tiga menu berdiri sendiri (lihat catatan di atas). */
export const PESANTREN_MODULES = PESANTREN_MENUS.filter((m) => !m.parentCode).map((m) => m.code);

const DASAR = { HOME: 'P1', SUPPORT: 'P1' } as const;

export const PESANTREN_ROLES: RoleCatalogEntry[] = [
  {
    code: ROLE_ADMIN_EPESANTREN,
    name: 'Administrator ePesantren',
    family: 'ePesantren',
    profile: 'P7',
    /*
     * `EPESANTREN_GROUP` satu baris ini mencakup SELURUH menu di bawah grup
     * "Pesantren" (semua subgrup dan isinya) -- `buildMenuModuleMap` memetakan
     * setiap menu ke leluhur teratasnya, dan grup akar itulah leluhur teratas
     * bagi semuanya. Ini AMAN karena EPESANTREN_ADMIN adalah SATU-SATUNYA
     * peran yang menunjuk grup ini (lihat catatan besar di atas
     * `PESANTREN_MENUS`). `EPESANTREN_GERBANG` tetap baris terpisah sebab ia
     * sengaja tidak berinduk (dipakai bersama ROLE_PETUGAS_GERBANG yang
     * profilnya jauh lebih sempit) -- lihat catatan yang sama.
     */
    modules: {
      ...DASAR,
      EPESANTREN_GROUP: 'P7',
      EPESANTREN_GERBANG: 'P7',
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
  {
    code: ROLE_KIOSK,
    name: 'Akun Perangkat Anjungan',
    family: 'ePesantren',
    profile: 'P12',
    modules: { ...DASAR, EPESANTREN_KIOSK: 'P12' },
    dataScope: 'SELF',
    core: false,
    description:
      'Akun perangkat (bukan akun pribadi santri) yang dipegang mesin ' +
      'anjungan/kiosk untuk memindai kartu dan menampilkan cuplikan data ' +
      'diri pemegang kartu. Sengaja TIDAK memegang EPESANTREN_SANTRI atau ' +
      'EPESANTREN_KARTU — kiosk yang disusupi tidak boleh dapat mengubah ' +
      'data ataupun menerbitkan kartu baru.',
  },
];

export const PESANTREN_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'pesantren',
  prefix: PESANTREN_PREFIX,
  menus: PESANTREN_MENUS,
  roles: PESANTREN_ROLES,
};
