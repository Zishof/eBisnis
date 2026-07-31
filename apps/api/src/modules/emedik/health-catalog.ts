/**
 * Katalog menu, peran, dan hak akses kesehatan.
 *
 * Berkas tersendiri sesuai panduan koordinasi §9: *"Jangan menambahkan ratusan
 * entry langsung ke satu file global dari tiga branch."* Registri global
 * mengimpornya lewat kontrak plugin yang dikelola Core — kontrak itu belum ada,
 * dan permintaannya sudah dicatat pada docs/emedik/08-integration-requests.md.
 *
 * Sampai kontraknya tersedia, katalog ini berdiri sendiri dan dipakai layanan
 * kesehatan langsung. Bentuknya sengaja dibuat serupa katalog Core supaya
 * penggabungannya kelak menjadi pemindahan, bukan penulisan ulang.
 */

// --- Aksi hak akses ----------------------------------------------------------

/**
 * Aksi yang BELUM ada pada 40 aksi milik Core.
 *
 * Sisanya (READ, CREATE, UPDATE, DELETE, APPROVE, PRINT, EXPORT, …) dipakai
 * apa adanya. Yang di sini adalah tindakan yang tidak punya padanan di
 * perdagangan, dan menyamakannya dengan aksi umum akan menghilangkan artinya —
 * "menyetujui" resep berbeda dari "menyetujui" pesanan pembelian.
 */
export const HEALTH_PERMISSION_ACTIONS = [
  {
    code: 'PRESCRIBE',
    name: 'Meresepkan',
    reason: 'Hanya pemberi layanan berkewenangan klinis; berbeda dari CREATE biasa.',
  },
  {
    code: 'DISPENSE',
    name: 'Menyerahkan Obat',
    reason: 'Terpisah dari PRESCRIBE supaya peresep tidak menyerahkan obatnya sendiri.',
  },
  {
    code: 'VERIFY_RESULT',
    name: 'Memverifikasi Hasil',
    reason: 'Hasil laboratorium dan radiologi butuh verifikasi orang berwenang sebelum dibaca klinisi.',
  },
  {
    code: 'ACKNOWLEDGE_CRITICAL',
    name: 'Menerima Hasil Kritis',
    reason: 'Hasil kritis yang terkirim tetapi tidak pernah dibaca adalah kegagalan sistem.',
  },
  {
    code: 'ADMIT',
    name: 'Menerima Rawat Inap',
    reason: 'Memutuskan pasien dirawat inap; berbeda dari sekadar membuat data.',
  },
  {
    code: 'DISCHARGE',
    name: 'Memulangkan',
    reason: 'Memulangkan pasien adalah keputusan klinis, bukan penutupan berkas.',
  },
  {
    code: 'BREAK_GLASS',
    name: 'Akses Darurat',
    reason:
      'Membuka rekam medis di luar hubungan perawatan. Diizinkan — menolaknya akan membunuh ' +
      'orang di IGD — tetapi wajib beralasan, tercatat, dan ditelaah.',
  },
  {
    code: 'MERGE_PATIENT',
    name: 'Menggabungkan Rekam Medis',
    reason:
      'Penggabungan yang salah menempelkan riwayat orang lain. Wewenangnya dipisahkan dari ' +
      'penyuntingan data pasien biasa.',
  },
] as const;

// --- Menu --------------------------------------------------------------------

export interface HealthMenuNode {
  code: string;
  parentCode?: string;
  label: string;
  route?: string;
  icon?: string;
  actions: string[];
  sortOrder: number;
  comingSoon?: boolean;
}

/**
 * Menu kesehatan.
 *
 * `comingSoon` dipakai jujur: menu yang rutenya belum ada ditandai, bukan
 * disembunyikan. Penyewa yang melihat daftar modul berhak tahu apa yang sedang
 * dibangun — dan menu yang diklik lalu tidak menampilkan apa pun jauh lebih
 * buruk daripada menu yang mengatakan "sedang dibangun".
 */
export const HEALTH_MENU: HealthMenuNode[] = [
  // Root
  { code: 'HEALTH', label: 'eMedik', icon: 'stethoscope', actions: ['READ'], sortOrder: 60 },

  // Fasilitas — H-1
  {
    code: 'HEALTH_FACILITY',
    parentCode: 'HEALTH',
    label: 'Fasilitas',
    route: '/app/emedik/fasilitas',
    icon: 'hospital',
    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    sortOrder: 1,
  },
  {
    code: 'HEALTH_SERVICE_UNIT',
    parentCode: 'HEALTH',
    label: 'Unit Layanan',
    route: '/app/emedik/unit',
    icon: 'layout-grid',
    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    sortOrder: 2,
  },
  {
    code: 'HEALTH_BED',
    parentCode: 'HEALTH',
    label: 'Kamar dan Tempat Tidur',
    route: '/app/emedik/tempat-tidur',
    icon: 'bed',
    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
    sortOrder: 3,
  },
  {
    code: 'HEALTH_PROVIDER',
    parentCode: 'HEALTH',
    label: 'Pemberi Layanan',
    route: '/app/emedik/pemberi-layanan',
    icon: 'user-round',
    actions: ['READ', 'CREATE', 'UPDATE', 'DELETE', 'ASSIGN'],
    sortOrder: 4,
  },

  // Pasien — H-1 sebagian, H-2 selebihnya
  {
    code: 'HEALTH_PATIENT',
    parentCode: 'HEALTH',
    label: 'Pasien',
    route: '/app/emedik/pasien',
    icon: 'users',
    actions: ['READ', 'CREATE', 'UPDATE', 'EXPORT', 'MERGE_PATIENT', 'BREAK_GLASS'],
    sortOrder: 5,
  },
  {
    code: 'HEALTH_PATIENT_DUPLICATE',
    parentCode: 'HEALTH',
    label: 'Dugaan Rekam Medis Ganda',
    route: '/app/emedik/pasien/ganda',
    icon: 'copy',
    actions: ['READ', 'REVIEW', 'MERGE_PATIENT'],
    sortOrder: 6,
  },
  {
    code: 'HEALTH_ACCESS_LOG',
    parentCode: 'HEALTH',
    label: 'Jejak Pembacaan Rekam Medis',
    route: '/app/emedik/jejak-akses',
    icon: 'eye',
    // Hanya baca dan ekspor. Jejak yang dapat disunting pihak yang diaudit
    // tidak membuktikan apa pun.
    actions: ['READ', 'EXPORT'],
    sortOrder: 7,
  },

  // Penagihan langganan — H-1
  {
    code: 'HEALTH_BILLING_TIER',
    parentCode: 'HEALTH',
    label: 'Jenjang Tarif Pendaftaran',
    route: '/app/emedik/tarif',
    icon: 'receipt',
    actions: ['READ', 'UPDATE'],
    sortOrder: 8,
  },

  // Farmasi — H-4. Empat menu, bukan satu, karena hak aksesnya memang berbeda.
  //
  // Yang meresepkan bukan yang menelaah, dan yang menelaah bukan yang
  // menyerahkan. Menyatukannya menjadi satu menu "Farmasi" dengan satu hak akses
  // akan menghapus pemisahan itu pada hari pertama seseorang memberikan peran
  // kepada stafnya — dan pemisahan yang hanya ada di dalam kode, tidak di dalam
  // daftar hak akses, tidak menahan siapa pun.
  {
    code: 'HEALTH_PRESCRIPTION',
    parentCode: 'HEALTH',
    label: 'Resep',
    route: '/app/emedik/resep',
    icon: 'pill',
    actions: ['READ', 'CREATE', 'REVIEW'],
    sortOrder: 30,
  },
  {
    code: 'HEALTH_DISPENSING',
    parentCode: 'HEALTH',
    label: 'Penyerahan Obat',
    route: '/app/emedik/penyerahan',
    icon: 'package-check',
    actions: ['READ', 'CREATE'],
    sortOrder: 31,
  },
  {
    code: 'HEALTH_ADMINISTRATION',
    parentCode: 'HEALTH',
    label: 'Pemberian Obat',
    route: '/app/emedik/pemberian',
    icon: 'syringe',
    actions: ['READ', 'CREATE'],
    sortOrder: 32,
  },
  {
    code: 'HEALTH_DRUG_MASTER',
    parentCode: 'HEALTH',
    label: 'Formularium',
    route: '/app/emedik/formularium',
    icon: 'book-marked',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 33,
  },

  // Fase berikutnya — ditandai jujur
  { code: 'HEALTH_APPOINTMENT', parentCode: 'HEALTH', label: 'Janji Temu', icon: 'calendar', actions: ['READ'], sortOrder: 10, comingSoon: true },
  { code: 'HEALTH_REGISTRATION', parentCode: 'HEALTH', label: 'Pendaftaran', icon: 'clipboard-list', actions: ['READ'], sortOrder: 11, comingSoon: true },
  { code: 'HEALTH_QUEUE', parentCode: 'HEALTH', label: 'Antrean', icon: 'list-ordered', actions: ['READ'], sortOrder: 12, comingSoon: true },
  { code: 'HEALTH_OUTPATIENT', parentCode: 'HEALTH', label: 'Rawat Jalan', icon: 'activity', actions: ['READ'], sortOrder: 20, comingSoon: true },
  { code: 'HEALTH_LABORATORY', parentCode: 'HEALTH', label: 'Laboratorium', icon: 'flask-conical', actions: ['READ'], sortOrder: 40, comingSoon: true },
  { code: 'HEALTH_RADIOLOGY', parentCode: 'HEALTH', label: 'Radiologi', icon: 'scan', actions: ['READ'], sortOrder: 41, comingSoon: true },
  { code: 'HEALTH_INPATIENT', parentCode: 'HEALTH', label: 'Rawat Inap', icon: 'bed-double', actions: ['READ'], sortOrder: 50, comingSoon: true },
  { code: 'HEALTH_EMERGENCY', parentCode: 'HEALTH', label: 'IGD', icon: 'siren', actions: ['READ'], sortOrder: 60, comingSoon: true },
  { code: 'HEALTH_PUSKESMAS', parentCode: 'HEALTH', label: 'Puskesmas', icon: 'building-2', actions: ['READ'], sortOrder: 70, comingSoon: true },
  { code: 'HEALTH_POSYANDU', parentCode: 'HEALTH', label: 'Posyandu', icon: 'baby', actions: ['READ'], sortOrder: 71, comingSoon: true },
  { code: 'HEALTH_CLAIM', parentCode: 'HEALTH', label: 'Klaim', icon: 'file-text', actions: ['READ'], sortOrder: 80, comingSoon: true },
];

// --- Peran -------------------------------------------------------------------

export interface HealthRoleTemplate {
  code: string;
  name: string;
  description: string;
  /** `MENU.ACTION` */
  permissions: string[];
  sortOrder: number;
}

const BACA_PASIEN = ['HEALTH.READ', 'HEALTH_PATIENT.READ'];

/**
 * Peran bawaan kesehatan.
 *
 * Dua puluh sembilan peran disebut spesifikasi §26. Yang didefinisikan penuh di
 * sini adalah yang haknya sudah ada pada H-1; sisanya menyusul bersama fase
 * yang memberinya wewenang, supaya tidak ada peran yang memiliki hak atas menu
 * yang belum dibangun.
 */
export const HEALTH_ROLES: HealthRoleTemplate[] = [
  {
    code: 'HEALTH_ADMIN',
    name: 'Administrator eMedik',
    description: 'Mengelola fasilitas, unit layanan, pemberi layanan, dan konfigurasi tarif.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FACILITY.READ', 'HEALTH_FACILITY.CREATE', 'HEALTH_FACILITY.UPDATE', 'HEALTH_FACILITY.DELETE',
      'HEALTH_SERVICE_UNIT.READ', 'HEALTH_SERVICE_UNIT.CREATE', 'HEALTH_SERVICE_UNIT.UPDATE', 'HEALTH_SERVICE_UNIT.DELETE',
      'HEALTH_BED.READ', 'HEALTH_BED.CREATE', 'HEALTH_BED.UPDATE', 'HEALTH_BED.DELETE',
      'HEALTH_PROVIDER.READ', 'HEALTH_PROVIDER.CREATE', 'HEALTH_PROVIDER.UPDATE', 'HEALTH_PROVIDER.ASSIGN',
      'HEALTH_BILLING_TIER.READ', 'HEALTH_BILLING_TIER.UPDATE',
      // Administrator TIDAK diberi hak membaca rekam medis pasien. Mengelola
      // sistem tidak menuntut membaca diagnosis siapa pun, dan hak yang tidak
      // dibutuhkan adalah hak yang akan disalahgunakan.
    ],
    sortOrder: 1,
  },
  {
    code: 'HEALTH_DIRECTOR',
    name: 'Direktur / Kepala Fasilitas',
    description: 'Memantau fasilitas dan menelaah akses darurat.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FACILITY.READ',
      'HEALTH_SERVICE_UNIT.READ',
      'HEALTH_BED.READ',
      'HEALTH_PROVIDER.READ',
      'HEALTH_ACCESS_LOG.READ', 'HEALTH_ACCESS_LOG.EXPORT',
      'HEALTH_BILLING_TIER.READ',
    ],
    sortOrder: 2,
  },
  {
    code: 'HEALTH_REGISTRATION_CLERK',
    name: 'Petugas Pendaftaran',
    description: 'Mendaftarkan pasien dan mengelola identitasnya.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PATIENT.CREATE',
      'HEALTH_PATIENT.UPDATE',
      'HEALTH_PATIENT_DUPLICATE.READ',
      'HEALTH_PATIENT_DUPLICATE.REVIEW',
      // TIDAK diberi MERGE_PATIENT. Menandai dugaan ganda dan menggabungkannya
      // adalah dua wewenang berbeda: yang pertama pekerjaan harian, yang kedua
      // menempelkan riwayat medis dan tidak boleh dilakukan sendirian.
    ],
    sortOrder: 3,
  },
  {
    code: 'HEALTH_MEDICAL_RECORD_OFFICER',
    name: 'Petugas Rekam Medis',
    description: 'Menjaga mutu identitas pasien dan menggabungkan rekam medis ganda.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PATIENT.UPDATE',
      'HEALTH_PATIENT.EXPORT',
      'HEALTH_PATIENT_DUPLICATE.READ',
      'HEALTH_PATIENT_DUPLICATE.REVIEW',
      'HEALTH_PATIENT_DUPLICATE.MERGE_PATIENT',
      'HEALTH_PATIENT.MERGE_PATIENT',
      'HEALTH_ACCESS_LOG.READ',
    ],
    sortOrder: 4,
  },
  {
    code: 'HEALTH_DOCTOR',
    name: 'Dokter',
    description: 'Memberi layanan klinis kepada pasien yang dirawatnya.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PATIENT.BREAK_GLASS',
      // Meresepkan, ya. Menelaah dan menyerahkan, tidak — telaah apoteker
      // kehilangan seluruh gunanya bila peresepnya boleh menelaah sendiri.
      'HEALTH_PRESCRIPTION.READ',
      'HEALTH_PRESCRIPTION.CREATE',
      'HEALTH_DRUG_MASTER.READ',
    ],
    sortOrder: 5,
  },
  {
    code: 'HEALTH_NURSE',
    name: 'Perawat',
    description: 'Memberi asuhan keperawatan kepada pasien yang dirawatnya.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PRESCRIPTION.READ',
      // Memberikan obat, bukan menyerahkannya dari apotek. Keduanya berbeda:
      // yang satu memindahkan obat dari rak ke pasien, yang lain memasukkannya
      // ke tubuh pasien — dan kekeliruannya berbeda pula.
      'HEALTH_ADMINISTRATION.READ',
      'HEALTH_ADMINISTRATION.CREATE',
      'HEALTH_DRUG_MASTER.READ',
    ],
    sortOrder: 6,
  },
  {
    code: 'HEALTH_PHARMACIST',
    name: 'Apoteker',
    description: 'Menelaah resep, menyerahkan obat, dan mengelola formularium.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PRESCRIPTION.READ',
      'HEALTH_PRESCRIPTION.REVIEW',
      'HEALTH_DISPENSING.READ',
      'HEALTH_DISPENSING.CREATE',
      'HEALTH_DRUG_MASTER.READ',
      'HEALTH_DRUG_MASTER.CREATE',
      'HEALTH_DRUG_MASTER.UPDATE',
    ],
    sortOrder: 7,
  },
  {
    code: 'HEALTH_PHARMACY_TECHNICIAN',
    name: 'Tenaga Teknis Kefarmasian',
    description: 'Menyerahkan obat yang sudah ditelaah apoteker.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PRESCRIPTION.READ',
      'HEALTH_DISPENSING.READ',
      'HEALTH_DISPENSING.CREATE',
      'HEALTH_DRUG_MASTER.READ',
    ],
    sortOrder: 8,
  },
  {
    code: 'HEALTH_QUALITY_MANAGER',
    name: 'Manajer Mutu',
    description: 'Menelaah akses darurat dan indikator mutu.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_ACCESS_LOG.READ',
      'HEALTH_ACCESS_LOG.EXPORT',
      'HEALTH_PATIENT_DUPLICATE.READ',
    ],
    sortOrder: 7,
  },
];

// --- Pemisahan wewenang ------------------------------------------------------

export interface HealthSodRule {
  code: string;
  name: string;
  description: string;
  conflictingPermissions: [string, string];
}

/**
 * Aturan pemisahan wewenang kesehatan.
 *
 * Didaftarkan pada mesin SoD yang sudah ada — tidak ada mesin kedua.
 */
export const HEALTH_SOD_RULES: HealthSodRule[] = [
  {
    code: 'HEALTH_SOD_REGISTER_MERGE',
    name: 'Pendaftar tidak menggabungkan rekam medis',
    description:
      'Petugas yang membuat rekam medis tidak menggabungkannya sendiri. Penggabungan yang salah ' +
      'menempelkan riwayat orang lain — alergi dan golongan darah yang bukan miliknya — dan ' +
      'orang yang membuat kekeliruannya adalah orang yang paling sulit melihatnya.',
    conflictingPermissions: ['HEALTH_PATIENT.CREATE', 'HEALTH_PATIENT.MERGE_PATIENT'],
  },
  {
    code: 'HEALTH_SOD_BREAKGLASS_REVIEW',
    name: 'Pemakai akses darurat tidak menelaah akses darurat',
    description:
      'Yang menelaah break-glass tidak boleh sama dengan yang memakainya. Telaah oleh pelakunya ' +
      'sendiri bukan telaah.',
    conflictingPermissions: ['HEALTH_PATIENT.BREAK_GLASS', 'HEALTH_ACCESS_LOG.EXPORT'],
  },
  {
    code: 'HEALTH_SOD_PRESCRIBE_REVIEW',
    name: 'Peresep tidak menelaah resepnya sendiri',
    description:
      'Telaah apoteker adalah pemeriksaan oleh orang kedua, dan itulah satu-satunya penahan yang ' +
      'benar-benar bekerja ketika dosisnya salah ketik. Orang yang menulis angkanya adalah orang ' +
      'yang paling sulit melihat kekeliruannya. Basis data menegakkannya pula lewat constraint ' +
      'rx_prescription_review_not_self — aturan yang hanya ada di satu lapisan berhenti berlaku ' +
      'begitu ada jalan kedua menuju tabelnya.',
    conflictingPermissions: ['HEALTH_PRESCRIPTION.CREATE', 'HEALTH_PRESCRIPTION.REVIEW'],
  },
  {
    code: 'HEALTH_SOD_PRESCRIBE_DISPENSE',
    name: 'Peresep tidak menyerahkan obatnya sendiri',
    description:
      'Pemisahan yang paling tua dalam keselamatan obat. Yang menulis resep tidak mengambilkan ' +
      'obatnya dari rak: keliru memilih tempat obat pada rak tidak akan tertangkap oleh orang ' +
      'yang sejak awal sudah yakin obat apa yang dimaksudnya.',
    conflictingPermissions: ['HEALTH_PRESCRIPTION.CREATE', 'HEALTH_DISPENSING.CREATE'],
  },
];

// --- Pemeriksaan mandiri -----------------------------------------------------

/** Seluruh kode hak akses yang sah menurut katalog ini. */
export function daftarHakAkses(): Set<string> {
  const hasil = new Set<string>();
  for (const m of HEALTH_MENU) {
    for (const a of m.actions) hasil.add(`${m.code}.${a}`);
  }
  return hasil;
}
