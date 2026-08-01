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
  {
    code: 'ADMINISTER',
    name: 'Memberikan Obat',
    reason:
      'Menyerahkan obat dan memberikannya kepada pasien adalah dua perbuatan berbeda, dan yang ' +
      'kedua dilakukan di samping tempat tidur oleh orang lain.',
  },
  {
    code: 'RECEIVE',
    name: 'Menerima Spesimen',
    reason:
      'Penerimaan spesimen menandai perpindahan tanggung jawab atas tabung itu. Tanpa aksi ' +
      'tersendiri, spesimen yang hilang di perjalanan tidak dapat ditelusuri kepada siapa pun.',
  },
  {
    code: 'AMEND',
    name: 'Mengamandemen Hasil',
    reason:
      'Hasil yang sudah diverifikasi tidak disunting, melainkan diamandemen — dan amandemen ' +
      'menuntut wewenang tersendiri karena klinisi mungkin sudah bertindak atas angka lamanya.',
  },
  {
    code: 'TRIAGE',
    name: 'Menriase',
    reason:
      'Menentukan urutan pelayanan gawat darurat. Dipisahkan dari disposisi supaya tekanan ' +
      'antrean tidak berpindah langsung menjadi keputusan memulangkan.',
  },
  {
    code: 'CHECKLIST',
    name: 'Mengisi Daftar Periksa Bedah',
    reason:
      'Jeda sebelum sayatan adalah percakapan tim, bukan centang satu orang. Dipisahkan dari ' +
      'INCISE supaya yang mengisinya bukan yang memulai sayatan.',
  },
  {
    code: 'INCISE',
    name: 'Memulai Sayatan',
    reason:
      'Menandai saat pisau menyentuh kulit — titik yang tidak dapat ditarik kembali. Menuntut ' +
      'penegasan ulang identitas, dan tidak melekat pada wewenang bedah biasa.',
  },
  {
    code: 'IMMUNIZE',
    name: 'Memberikan Imunisasi',
    reason:
      'Mencatat jadwal dan benar-benar menyuntikkan adalah dua perbuatan berbeda. Kader mencatat ' +
      'pertumbuhan tanpa pernah memegang jarum.',
  },
  {
    code: 'VERIFY',
    name: 'Memverifikasi',
    reason:
      'Pemeriksaan oleh orang kedua atas pekerjaan orang pertama. Dipisahkan dari APPROVE karena ' +
      'yang diperiksa di sini adalah ketepatan pekerjaannya, bukan kelayakan keputusannya.',
  },
  {
    code: 'ACTIVATE',
    name: 'Mengaktifkan',
    reason:
      'Membuat layanan dapat dipesan, ditagihkan, dan dibagi jasanya. Dipisahkan dari UPDATE ' +
      'supaya yang sedang mengetik baris keseratus tidak mengaktifkan layanan yang belum pernah ' +
      'dilihat siapa pun.',
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
    // UPDATE dipakai menyatakan tempat tidur sudah bersih — langkah tersendiri,
    // dan itu inti dari keseluruhannya.
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

  // Laboratorium dan radiologi — H-5.
  //
  // Nilai kritis punya menunya sendiri, terpisah dari hasil. Bukan kerapian:
  // yang menerima nilai kritis adalah dokter yang merawat, bukan analis yang
  // memasukkan hasilnya, dan keduanya tidak boleh saling menggantikan.
  {
    code: 'HEALTH_LAB_ORDER',
    parentCode: 'HEALTH',
    label: 'Pesanan Pemeriksaan',
    route: '/app/emedik/lab/pesanan',
    icon: 'flask-conical',
    actions: ['READ', 'CREATE', 'CANCEL'],
    sortOrder: 40,
  },
  {
    code: 'HEALTH_LAB_SPECIMEN',
    parentCode: 'HEALTH',
    label: 'Spesimen',
    route: '/app/emedik/lab/spesimen',
    icon: 'test-tube',
    actions: ['READ', 'CREATE', 'RECEIVE'],
    sortOrder: 41,
  },
  {
    code: 'HEALTH_LAB_RESULT',
    parentCode: 'HEALTH',
    label: 'Hasil Pemeriksaan',
    route: '/app/emedik/lab/hasil',
    icon: 'file-check',
    actions: ['READ', 'CREATE', 'VERIFY_RESULT', 'AMEND'],
    sortOrder: 42,
  },
  {
    code: 'HEALTH_LAB_CRITICAL',
    parentCode: 'HEALTH',
    label: 'Nilai Kritis',
    route: '/app/emedik/lab/kritis',
    icon: 'alert-octagon',
    actions: ['READ', 'CREATE', 'ACKNOWLEDGE_CRITICAL'],
    sortOrder: 43,
  },
  {
    code: 'HEALTH_LAB_CATALOG',
    parentCode: 'HEALTH',
    label: 'Katalog Pemeriksaan',
    route: '/app/emedik/lab/katalog',
    icon: 'list-checks',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 44,
  },

  // Fase berikutnya — ditandai jujur
  { code: 'HEALTH_APPOINTMENT', parentCode: 'HEALTH', label: 'Janji Temu', icon: 'calendar', actions: ['READ'], sortOrder: 10, comingSoon: true },
  { code: 'HEALTH_REGISTRATION', parentCode: 'HEALTH', label: 'Pendaftaran', icon: 'clipboard-list', actions: ['READ'], sortOrder: 11, comingSoon: true },
  { code: 'HEALTH_QUEUE', parentCode: 'HEALTH', label: 'Antrean', icon: 'list-ordered', actions: ['READ'], sortOrder: 12, comingSoon: true },
  { code: 'HEALTH_OUTPATIENT', parentCode: 'HEALTH', label: 'Rawat Jalan', icon: 'activity', actions: ['READ'], sortOrder: 20, comingSoon: true },
  // Rawat inap — H-6. ADMIT dan DISCHARGE terpisah dari CREATE dan UPDATE:
  // memutuskan pasien dirawat dan memutuskan pasien boleh pulang adalah
  // keputusan klinis, bukan penutupan berkas.
  {
    code: 'HEALTH_ADMISSION',
    parentCode: 'HEALTH',
    label: 'Rawat Inap',
    route: '/app/emedik/rawat-inap',
    icon: 'bed-double',
    actions: ['READ', 'ADMIT', 'DISCHARGE', 'UPDATE'],
    sortOrder: 50,
  },
  {
    code: 'HEALTH_NURSING',
    parentCode: 'HEALTH',
    label: 'Asuhan Keperawatan',
    route: '/app/emedik/keperawatan',
    icon: 'heart-pulse',
    actions: ['READ', 'CREATE'],
    sortOrder: 51,
  },
  // Gawat darurat, bedah, intensif — H-7.
  //
  // Dua pemisahan yang menentukan: yang menriase bukan yang menetapkan
  // disposisi, dan yang mengisi daftar periksa bukan yang menyayat.
  {
    code: 'HEALTH_EMERGENCY',
    parentCode: 'HEALTH',
    label: 'IGD',
    route: '/app/emedik/igd',
    icon: 'siren',
    actions: ['READ', 'TRIAGE', 'UPDATE', 'DISCHARGE'],
    sortOrder: 60,
  },
  {
    code: 'HEALTH_SURGERY',
    parentCode: 'HEALTH',
    label: 'Kamar Operasi',
    route: '/app/emedik/operasi',
    icon: 'scissors',
    actions: ['READ', 'CREATE', 'UPDATE', 'CHECKLIST', 'INCISE', 'CANCEL'],
    sortOrder: 61,
  },
  {
    code: 'HEALTH_ICU',
    parentCode: 'HEALTH',
    label: 'Perawatan Intensif',
    route: '/app/emedik/intensif',
    icon: 'activity',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 62,
  },
  // Puskesmas dan Posyandu — H-8.
  //
  // Lima menu, dan pemisahannya bekerja lewat HEALTH_FAMILY: kader melihat
  // anak-anak pada folder keluarganya, bukan lewat pencarian pasien seluruh
  // fasilitas. Yang pertama menampilkan empat puluh anak di desanya; yang kedua
  // menampilkan seluruh rekam medis kabupaten.
  {
    code: 'HEALTH_FAMILY',
    parentCode: 'HEALTH',
    label: 'Folder Keluarga',
    route: '/app/emedik/keluarga',
    icon: 'house',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 70,
  },
  {
    code: 'HEALTH_GROWTH',
    parentCode: 'HEALTH',
    label: 'Pertumbuhan Anak',
    route: '/app/emedik/pertumbuhan',
    icon: 'trending-up',
    actions: ['READ', 'CREATE'],
    sortOrder: 71,
  },
  {
    code: 'HEALTH_IMMUNIZATION',
    parentCode: 'HEALTH',
    label: 'Imunisasi',
    route: '/app/emedik/imunisasi',
    icon: 'syringe',
    actions: ['READ', 'CREATE', 'IMMUNIZE'],
    sortOrder: 72,
  },
  {
    code: 'HEALTH_HOME_VISIT',
    parentCode: 'HEALTH',
    label: 'Kunjungan Rumah',
    route: '/app/emedik/kunjungan',
    icon: 'map-pin',
    actions: ['READ', 'CREATE'],
    sortOrder: 73,
  },
  {
    code: 'HEALTH_PROGRAM',
    parentCode: 'HEALTH',
    label: 'Cakupan Program',
    route: '/app/emedik/cakupan',
    icon: 'target',
    actions: ['READ', 'UPDATE', 'EXPORT'],
    sortOrder: 74,
  },
  // Rekam medis, pengkodean, mutu, dan keselamatan — H-9.
  //
  // Dua keputusan hak akses yang berlawanan arah, dan keduanya disengaja:
  // pelaporan insiden diberikan kepada hampir seluruh peran klinis, sedangkan
  // penahanan hukum hanya kepada satu peran. Yang pertama karena program
  // keselamatan pasien mati tanpa orang yang mau melapor; yang kedua karena
  // menahan seluruh rekam medis seorang pasien adalah wewenang yang tidak boleh
  // melekat pada peran yang dipegang puluhan orang.
  {
    code: 'HEALTH_HIM_CODING',
    parentCode: 'HEALTH',
    label: 'Pengkodean Rekam Medis',
    route: '/app/emedik/koding',
    icon: 'file-code',
    actions: ['READ', 'CREATE', 'VERIFY'],
    sortOrder: 90,
  },
  {
    code: 'HEALTH_LEGAL_HOLD',
    parentCode: 'HEALTH',
    label: 'Penahanan Hukum',
    route: '/app/emedik/penahanan',
    icon: 'gavel',
    actions: ['READ', 'CREATE', 'DELETE'],
    sortOrder: 91,
  },
  {
    code: 'HEALTH_INFO_RELEASE',
    parentCode: 'HEALTH',
    label: 'Pelepasan Informasi',
    route: '/app/emedik/pelepasan',
    icon: 'share-2',
    actions: ['READ', 'CREATE', 'EXPORT'],
    sortOrder: 92,
  },
  {
    code: 'HEALTH_SAFETY',
    parentCode: 'HEALTH',
    label: 'Keselamatan Pasien',
    route: '/app/emedik/keselamatan',
    icon: 'shield-alert',
    actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
    sortOrder: 93,
  },
  {
    code: 'HEALTH_QUALITY',
    parentCode: 'HEALTH',
    label: 'Indikator Mutu',
    route: '/app/emedik/mutu',
    icon: 'gauge',
    actions: ['READ', 'CREATE', 'UPDATE', 'EXPORT'],
    sortOrder: 94,
  },
  {
    code: 'HEALTH_TERMINOLOGY',
    parentCode: 'HEALTH',
    label: 'Terminologi',
    route: '/app/emedik/terminologi',
    icon: 'book-open',
    actions: ['READ', 'IMPORT', 'APPROVE'],
    sortOrder: 95,
  },
  // Katalog layanan dan master data — H-9L.
  //
  // Pemisahannya: yang memetakan bukan yang mengaktifkan. Pemetaan adalah
  // pekerjaan harian — ratusan baris, sering keliru, sering diperbaiki.
  // Aktivasi adalah keputusan yang membuat layanan itu dapat dipesan,
  // ditagihkan, dan dibagi jasanya.
  {
    code: 'HEALTH_SERVICE_CATALOG',
    parentCode: 'HEALTH',
    label: 'Katalog Layanan',
    route: '/app/emedik/layanan',
    icon: 'list-checks',
    actions: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    sortOrder: 96,
  },
  {
    code: 'HEALTH_MASTER_DATA',
    parentCode: 'HEALTH',
    label: 'Master Data',
    route: '/app/emedik/master-data',
    icon: 'database',
    actions: ['READ', 'CREATE', 'IMPORT', 'DELETE'],
    sortOrder: 97,
  },
  {
    code: 'HEALTH_CODE_MAPPING',
    parentCode: 'HEALTH',
    label: 'Pemetaan Kode',
    route: '/app/emedik/pemetaan',
    icon: 'git-compare',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 98,
  },
  // Pemetaan akuntansi — H-9N.
  //
  // Bukan buku besar kedua. Menu ini menyimpan pemetaan peristiwa klinis ke
  // akun; jurnalnya milik mesin akuntansi bersama.
  {
    code: 'HEALTH_ACCOUNTING_MAP',
    parentCode: 'HEALTH',
    label: 'Pemetaan Akuntansi',
    route: '/app/emedik/akuntansi',
    icon: 'calculator',
    actions: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE'],
    sortOrder: 99,
  },
  // Tarif dan penjamin — H-9D.
  //
  // Strukturnya ada; isinya menunggu terbitan resmi. Pemisahannya: yang
  // mengimpor tarif tidak menyetujuinya.
  {
    code: 'HEALTH_TARIFF',
    parentCode: 'HEALTH',
    label: 'Tarif JKN',
    route: '/app/emedik/tarif',
    icon: 'receipt-text',
    actions: ['READ', 'IMPORT', 'APPROVE', 'ACTIVATE'],
    sortOrder: 100,
  },
  {
    code: 'HEALTH_PAYER',
    parentCode: 'HEALTH',
    label: 'Penjamin',
    route: '/app/emedik/penjamin',
    icon: 'handshake',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 101,
  },
  // Kebijakan jasa — H-9E.
  //
  // Tidak ada satu pun persentase bawaan di mana pun. Persentase pembagian jasa
  // adalah kesepakatan antara rumah sakit dan tenaga medisnya.
  {
    code: 'HEALTH_FEE_POLICY',
    parentCode: 'HEALTH',
    label: 'Kebijakan Jasa',
    route: '/app/emedik/kebijakan-jasa',
    icon: 'percent',
    actions: ['READ', 'CREATE', 'UPDATE', 'APPROVE', 'ACTIVATE'],
    sortOrder: 102,
  },
  {
    code: 'HEALTH_FEE_CONTRIBUTOR',
    parentCode: 'HEALTH',
    label: 'Kontributor Tindakan',
    route: '/app/emedik/kontributor',
    icon: 'users-round',
    actions: ['READ', 'CREATE', 'UPDATE'],
    sortOrder: 103,
  },
  // Settlement jasa — H-9F.
  //
  // Empat wewenang, empat pemegang: CREATE menghitung, APPROVE menyetujui,
  // POST mengunci dan membayar, REVERSE mengoreksi. Tidak ada satu pun aksi
  // yang menghapus.
  {
    code: 'HEALTH_FEE_SETTLEMENT',
    parentCode: 'HEALTH',
    label: 'Settlement Jasa',
    route: '/app/emedik/settlement',
    icon: 'wallet',
    actions: ['READ', 'CREATE', 'APPROVE', 'POST', 'REVERSE'],
    sortOrder: 104,
  },
  {
    code: 'HEALTH_FEE_STATEMENT',
    parentCode: 'HEALTH',
    label: 'Pernyataan Jasa',
    route: '/app/emedik/pernyataan',
    icon: 'file-text',
    actions: ['READ', 'CREATE', 'EXPORT'],
    sortOrder: 105,
  },
  // Kontrak fee — H-9G.
  //
  // Tiga wewenang, tiga orang: CREATE menyusun, REVIEW menelaah hukum,
  // APPROVE dan ACTIVATE menyetujui manajemen. Tanpa kontrak yang aktif, fee
  // sistem dan bagian investor bernilai nol.
  {
    code: 'HEALTH_FEE_CONTRACT',
    parentCode: 'HEALTH',
    label: 'Kontrak Fee',
    route: '/app/emedik/kontrak-fee',
    icon: 'file-signature',
    actions: ['READ', 'CREATE', 'UPDATE', 'REVIEW', 'APPROVE', 'ACTIVATE', 'CANCEL'],
    sortOrder: 106,
  },
  // Klaim — H-9C.
  //
  // Menu HEALTH_CLAIM dulunya penampung bertanda "sedang dibangun", lalu
  // ditutup H017 ketika ternyata masih lama. Ia dibuka kembali di sini dengan
  // aksinya yang sesungguhnya. VERIFY memeriksa berkas; SUBMIT mengajukan.
  {
    code: 'HEALTH_CLAIM',
    parentCode: 'HEALTH',
    label: 'Klaim',
    route: '/app/emedik/klaim',
    icon: 'file-check',
    actions: ['READ', 'CREATE', 'UPDATE', 'VERIFY', 'SUBMIT', 'CANCEL'],
    sortOrder: 107,
  },
  {
    code: 'HEALTH_CLAIM_REVIEW',
    parentCode: 'HEALTH',
    label: 'Telaah Klaim',
    route: '/app/emedik/telaah-klaim',
    icon: 'search-check',
    actions: ['READ', 'REVIEW'],
    sortOrder: 108,
  },
  {
    code: 'HEALTH_CLAIM_RECON',
    parentCode: 'HEALTH',
    label: 'Rekonsiliasi Klaim',
    route: '/app/emedik/rekonsiliasi',
    icon: 'scale',
    actions: ['READ', 'CREATE', 'CLOSE_PERIOD'],
    sortOrder: 109,
  },
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
 * Melapor insiden keselamatan pasien, dan melihat papan laporannya.
 *
 * Sengaja dibagikan luas. Yang paling sering melihat kejadian bukan petugas
 * mutu, melainkan perawat malam, apoteker yang menerima resep aneh, dan analis
 * yang menerima spesimen tanpa label. Membatasi pelaporan kepada peran tertentu
 * akan menghentikan laporan dari orang yang justru paling banyak melihat.
 */
const LAPOR_DAN_LIHAT_INSIDEN = ['HEALTH_SAFETY.READ', 'HEALTH_SAFETY.CREATE'];

/** Melapor saja. Papan insiden bukan bacaan harian setiap peran. */
const LAPOR_INSIDEN = ['HEALTH_SAFETY.CREATE'];

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
      // Mengaktifkan layanan dan mengelola master data; ia TIDAK menyusun
      // katalognya sendiri. Penghapusan data contoh diberikan kepadanya karena
      // penghapusannya menolak bila ada data nyata yang merujuknya, dan
      // keputusan atas penolakan itu harus diambil orang yang dapat menilai
      // akibatnya.
      'HEALTH_SERVICE_CATALOG.READ', 'HEALTH_SERVICE_CATALOG.ACTIVATE',
      'HEALTH_MASTER_DATA.READ', 'HEALTH_MASTER_DATA.CREATE',
      'HEALTH_MASTER_DATA.IMPORT', 'HEALTH_MASTER_DATA.DELETE',
      'HEALTH_CODE_MAPPING.READ',
      // Meninjau dan mengaktifkan profil akuntansi; ia tidak memetakannya.
      'HEALTH_ACCOUNTING_MAP.READ', 'HEALTH_ACCOUNTING_MAP.ACTIVATE',
      // Menyetujui dan mengaktifkan tarif; ia tidak mengimpornya.
      'HEALTH_TARIFF.READ', 'HEALTH_TARIFF.APPROVE', 'HEALTH_TARIFF.ACTIVATE',
      'HEALTH_PAYER.READ',
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
      // Melihat insiden dan mutu, tetapi TIDAK menutup laporan dan TIDAK
      // melapor. Direktur yang dapat menutup laporan tentang fasilitasnya
      // sendiri adalah pihak yang paling berkepentingan agar angkanya bagus.
      'HEALTH_SAFETY.READ',
      'HEALTH_QUALITY.READ',
      'HEALTH_QUALITY.EXPORT',
      'HEALTH_HIM_CODING.READ',
      'HEALTH_SERVICE_CATALOG.READ',
      'HEALTH_MASTER_DATA.READ',
      'HEALTH_ACCOUNTING_MAP.READ',
      'HEALTH_TARIFF.READ',
      'HEALTH_PAYER.READ',
      'HEALTH_FEE_POLICY.READ',
      'HEALTH_FEE_CONTRIBUTOR.READ',
      'HEALTH_FEE_SETTLEMENT.READ',
      'HEALTH_FEE_STATEMENT.READ',
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_CLAIM.READ',
      'HEALTH_CLAIM_REVIEW.READ',
      'HEALTH_CLAIM_RECON.READ',
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
      // Tanggungan penjamin perlu diketahui saat pasien datang, bukan saat
      // tagihannya dicetak.
      'HEALTH_PAYER.READ',
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
      // Kelengkapan berkas, terminologi, dan penyerahan berkas yang sudah
      // diputuskan petugas hukum. Ia MENYERAHKAN; ia tidak memutuskan.
      'HEALTH_HIM_CODING.READ',
      'HEALTH_INFO_RELEASE.READ',
      'HEALTH_INFO_RELEASE.EXPORT',
      'HEALTH_TERMINOLOGY.READ',
      'HEALTH_TERMINOLOGY.IMPORT',
      'HEALTH_LEGAL_HOLD.READ',
      // Memetakan kode lokal ke kode resmi. Ia sudah memegang terminologinya.
      'HEALTH_CODE_MAPPING.READ',
      'HEALTH_CODE_MAPPING.CREATE',
      'HEALTH_CODE_MAPPING.UPDATE',
      'HEALTH_SERVICE_CATALOG.READ',
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
      // Memutuskan pasien dirawat inap dan memutuskan pasien boleh pulang.
      // Keduanya keputusan klinis, bukan penutupan berkas.
      'HEALTH_ADMISSION.READ',
      'HEALTH_ADMISSION.ADMIT',
      'HEALTH_ADMISSION.DISCHARGE',
      'HEALTH_ADMISSION.UPDATE',
      'HEALTH_NURSING.READ',
      'HEALTH_BED.READ',
      'HEALTH_LAB_ORDER.READ',
      'HEALTH_LAB_ORDER.CREATE',
      'HEALTH_LAB_RESULT.READ',
      'HEALTH_LAB_CRITICAL.READ',
      'HEALTH_LAB_CRITICAL.ACKNOWLEDGE_CRITICAL',
      'HEALTH_LAB_CATALOG.READ',
      ...LAPOR_DAN_LIHAT_INSIDEN,
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
      // Rawat inap: mencatat pengamatan dan memindahkan tempat tidur, tetapi
      // TIDAK memutuskan penerimaan maupun pemulangan.
      'HEALTH_ADMISSION.READ',
      'HEALTH_ADMISSION.UPDATE',
      'HEALTH_NURSING.READ',
      'HEALTH_NURSING.CREATE',
      'HEALTH_BED.READ',
      'HEALTH_BED.UPDATE',
      ...LAPOR_DAN_LIHAT_INSIDEN,
    ],
    sortOrder: 6,
  },
  {
    code: 'HEALTH_TRIAGE_NURSE',
    name: 'Perawat Triase',
    description: 'Menriase pasien gawat darurat. TIDAK menetapkan disposisi.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_EMERGENCY.READ',
      'HEALTH_EMERGENCY.TRIAGE',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 13,
  },
  {
    code: 'HEALTH_SURGEON',
    name: 'Dokter Bedah',
    description: 'Menjadwalkan dan mengerjakan operasi. TIDAK mengisi daftar periksa.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_SURGERY.READ',
      'HEALTH_SURGERY.CREATE',
      'HEALTH_SURGERY.UPDATE',
      'HEALTH_SURGERY.INCISE',
      'HEALTH_SURGERY.CANCEL',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 14,
  },
  {
    code: 'HEALTH_SCRUB_NURSE',
    name: 'Perawat Instrumen',
    description: 'Mengisi daftar periksa bedah dan menghitung kasa. TIDAK memulai sayatan.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_SURGERY.READ',
      'HEALTH_SURGERY.CHECKLIST',
      'HEALTH_SURGERY.UPDATE',
      ...LAPOR_INSIDEN,
      // Merekalah yang melihat siapa yang hadir di kamar operasi, bukan bagian
      // keuangan.
      'HEALTH_FEE_CONTRIBUTOR.READ',
      'HEALTH_FEE_CONTRIBUTOR.CREATE',
    ],
    sortOrder: 15,
  },
  {
    code: 'HEALTH_INTENSIVIST',
    name: 'Dokter Intensif',
    description: 'Mengelola perawatan intensif.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_ICU.READ',
      'HEALTH_ICU.CREATE',
      'HEALTH_ICU.UPDATE',
      'HEALTH_ADMISSION.READ',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 16,
  },
  {
    code: 'HEALTH_WARD_CLERK',
    name: 'Petugas Bangsal',
    description: 'Mengelola tempat tidur dan pembersihannya.',
    // Termasuk melapor insiden. Yang melihat pasien jatuh dari tempat tidur
    // sering justru orang yang sedang merapikan tempat tidur sebelahnya.
    permissions: [
      'HEALTH.READ',
      'HEALTH_BED.READ',
      'HEALTH_BED.UPDATE',
      'HEALTH_ADMISSION.READ',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 12,
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
      ...LAPOR_DAN_LIHAT_INSIDEN,
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
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 8,
  },
  {
    code: 'HEALTH_LAB_ANALYST',
    name: 'Analis Laboratorium',
    description: 'Menerima spesimen dan memasukkan hasil pemeriksaan. Tidak memverifikasi.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_LAB_ORDER.READ',
      'HEALTH_LAB_SPECIMEN.READ',
      'HEALTH_LAB_SPECIMEN.RECEIVE',
      'HEALTH_LAB_RESULT.READ',
      'HEALTH_LAB_RESULT.CREATE',
      'HEALTH_LAB_CATALOG.READ',
      // Menyampaikan nilai kritis, tetapi tidak menerimanya. Yang menerima
      // adalah dokter yang merawat — penerimaan oleh penyampainya sendiri
      // hanya mencatat bahwa telepon berdering.
      'HEALTH_LAB_CRITICAL.READ',
      'HEALTH_LAB_CRITICAL.CREATE',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 9,
  },
  {
    code: 'HEALTH_LAB_SUPERVISOR',
    name: 'Penanggung Jawab Laboratorium',
    description: 'Memverifikasi dan melepas hasil, serta mengelola katalog dan rentang rujukan.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_LAB_ORDER.READ',
      'HEALTH_LAB_SPECIMEN.READ',
      'HEALTH_LAB_RESULT.READ',
      'HEALTH_LAB_RESULT.VERIFY_RESULT',
      'HEALTH_LAB_RESULT.AMEND',
      'HEALTH_LAB_CATALOG.READ',
      'HEALTH_LAB_CATALOG.CREATE',
      'HEALTH_LAB_CATALOG.UPDATE',
      'HEALTH_LAB_CRITICAL.READ',
      'HEALTH_LAB_CRITICAL.CREATE',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 10,
  },
  {
    code: 'HEALTH_RADIOGRAPHER',
    name: 'Radiografer',
    description: 'Mengerjakan pemeriksaan radiologi dan mengunggah rujukan citra.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_LAB_ORDER.READ',
      'HEALTH_LAB_RESULT.READ',
      'HEALTH_LAB_RESULT.CREATE',
      'HEALTH_LAB_CATALOG.READ',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 11,
  },
  {
    code: 'HEALTH_CADRE',
    name: 'Kader Posyandu',
    description:
      'Menimbang, mengukur, dan mencatat pertumbuhan anak. TIDAK membaca rekam medis lengkap ' +
      'dan TIDAK memberikan imunisasi.',
    // Sengaja TANPA HEALTH_PATIENT.READ. Ia melihat anak-anak lewat folder
    // keluarganya, bukan lewat pencarian pasien seluruh fasilitas.
    permissions: [
      'HEALTH.READ',
      'HEALTH_FAMILY.READ',
      'HEALTH_GROWTH.READ',
      'HEALTH_GROWTH.CREATE',
      'HEALTH_IMMUNIZATION.READ',
      'HEALTH_HOME_VISIT.READ',
      'HEALTH_HOME_VISIT.CREATE',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 17,
  },
  {
    code: 'HEALTH_PHC_OFFICER',
    name: 'Petugas Puskesmas',
    description: 'Mengelola folder keluarga, imunisasi, kunjungan rumah, dan cakupan program.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_PATIENT.CREATE',
      'HEALTH_FAMILY.READ',
      'HEALTH_FAMILY.CREATE',
      'HEALTH_FAMILY.UPDATE',
      'HEALTH_GROWTH.READ',
      'HEALTH_GROWTH.CREATE',
      'HEALTH_IMMUNIZATION.READ',
      'HEALTH_IMMUNIZATION.CREATE',
      'HEALTH_IMMUNIZATION.IMMUNIZE',
      'HEALTH_HOME_VISIT.READ',
      'HEALTH_HOME_VISIT.CREATE',
      'HEALTH_PROGRAM.READ',
      'HEALTH_PROGRAM.UPDATE',
      ...LAPOR_INSIDEN,
    ],
    sortOrder: 18,
  },
  {
    code: 'HEALTH_NUTRITIONIST',
    name: 'Tenaga Gizi',
    description: 'Menilai status gizi dan menindaklanjuti anak berisiko.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_FAMILY.READ',
      'HEALTH_GROWTH.READ',
      'HEALTH_GROWTH.CREATE',
      'HEALTH_HOME_VISIT.READ',
      'HEALTH_HOME_VISIT.CREATE',
      'HEALTH_PROGRAM.READ',
    ],
    sortOrder: 19,
  },
  {
    code: 'HEALTH_QUALITY_MANAGER',
    name: 'Manajer Mutu',
    description: 'Menelaah akses darurat, insiden keselamatan, dan indikator mutu.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_ACCESS_LOG.READ',
      'HEALTH_ACCESS_LOG.EXPORT',
      'HEALTH_PATIENT_DUPLICATE.READ',
      'HEALTH_SAFETY.READ',
      'HEALTH_SAFETY.UPDATE',
      'HEALTH_SAFETY.APPROVE',
      'HEALTH_QUALITY.READ',
      'HEALTH_QUALITY.CREATE',
      'HEALTH_QUALITY.UPDATE',
      'HEALTH_QUALITY.EXPORT',
      'HEALTH_HIM_CODING.READ',
      'HEALTH_CLAIM_REVIEW.READ',
    ],
    sortOrder: 7,
  },
  {
    code: 'HEALTH_CODER',
    name: 'Koder Rekam Medis',
    description:
      'Mengode diagnosis dan tindakan menurut terminologi yang berlaku pada tanggal layanannya. ' +
      'TIDAK memverifikasi pengkodeannya sendiri.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_HIM_CODING.READ',
      'HEALTH_HIM_CODING.CREATE',
      'HEALTH_TERMINOLOGY.READ',
      // Membaca klaim yang memakai pengkodeannya; ia TIDAK memverifikasinya.
      'HEALTH_CLAIM.READ',
    ],
    sortOrder: 20,
  },
  {
    code: 'HEALTH_CODING_VERIFIER',
    name: 'Verifikator Koding',
    description:
      'Memeriksa pengkodean orang lain sebelum berkasnya diajukan. TIDAK mengode, supaya yang ' +
      'diperiksanya bukan pekerjaannya sendiri.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_HIM_CODING.READ',
      'HEALTH_HIM_CODING.VERIFY',
      'HEALTH_TERMINOLOGY.READ',
    ],
    sortOrder: 21,
  },
  {
    code: 'HEALTH_PATIENT_SAFETY_OFFICER',
    name: 'Petugas Keselamatan Pasien',
    description:
      'Menelaah dan menutup laporan insiden, menyusun tindakan perbaikan, serta mencatat ' +
      'indikator mutu.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_SAFETY.READ',
      'HEALTH_SAFETY.CREATE',
      'HEALTH_SAFETY.UPDATE',
      'HEALTH_SAFETY.APPROVE',
      'HEALTH_QUALITY.READ',
      'HEALTH_QUALITY.CREATE',
      'HEALTH_QUALITY.UPDATE',
      'HEALTH_HIM_CODING.READ',
    ],
    sortOrder: 22,
  },
  {
    code: 'HEALTH_SERVICE_CATALOGUER',
    name: 'Petugas Katalog Layanan',
    description:
      'Menyusun katalog layanan dan pemetaannya ke unit, peran, tarif, dan akun. TIDAK ' +
      'mengaktifkan layanan — itu keputusan orang lain.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_SERVICE_CATALOG.READ',
      'HEALTH_SERVICE_CATALOG.CREATE',
      'HEALTH_SERVICE_CATALOG.UPDATE',
      'HEALTH_CODE_MAPPING.READ',
      'HEALTH_CODE_MAPPING.CREATE',
      'HEALTH_CODE_MAPPING.UPDATE',
      'HEALTH_MASTER_DATA.READ',
    ],
    sortOrder: 24,
  },
  {
    code: 'HEALTH_FEE_ADMINISTRATOR',
    name: 'Petugas Kebijakan Jasa',
    description:
      'Menyusun kebijakan pembagian jasa dan mencatat kontributor tindakan. TIDAK menyetujui ' +
      'kebijakan — persentase pembagian jasa adalah kesepakatan dua pihak.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_POLICY.READ',
      'HEALTH_FEE_POLICY.CREATE',
      'HEALTH_FEE_POLICY.UPDATE',
      'HEALTH_FEE_CONTRIBUTOR.READ',
      'HEALTH_FEE_CONTRIBUTOR.CREATE',
      'HEALTH_FEE_CONTRIBUTOR.UPDATE',
      'HEALTH_SERVICE_CATALOG.READ',
    ],
    sortOrder: 27,
  },
  {
    code: 'HEALTH_FEE_APPROVER',
    name: 'Penyetuju Kebijakan Jasa',
    description:
      'Menyetujui dan mengaktifkan kebijakan pembagian jasa. TIDAK menyusunnya, dan tidak ' +
      'boleh menjadi penerima pada kebijakan yang disetujuinya.',
    // Yang terakhir tidak dapat ditegakkan hak akses saja — dokter yang juga
    // administrator memegang dua peran yang sah masing-masing — sehingga ia
    // diperiksa pada tingkat baris saat persetujuan.
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_POLICY.READ',
      'HEALTH_FEE_POLICY.APPROVE',
      'HEALTH_FEE_POLICY.ACTIVATE',
      'HEALTH_FEE_CONTRIBUTOR.READ',
      // Menyetujui settlement dan koreksinya pula; ia tidak menghitung dan
      // tidak membayar.
      'HEALTH_FEE_SETTLEMENT.READ',
      'HEALTH_FEE_SETTLEMENT.APPROVE',
    ],
    sortOrder: 28,
  },
  {
    code: 'HEALTH_CLAIM_OFFICER',
    name: 'Petugas Klaim',
    description:
      'Menyusun dan mengajukan klaim, serta mencatat keputusan penjamin. TIDAK memverifikasi ' +
      'berkas dan TIDAK menelaah penanda.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_CLAIM.READ',
      'HEALTH_CLAIM.CREATE',
      'HEALTH_CLAIM.UPDATE',
      'HEALTH_CLAIM.SUBMIT',
      'HEALTH_CLAIM.CANCEL',
      'HEALTH_CLAIM_RECON.READ',
      'HEALTH_HIM_CODING.READ',
      'HEALTH_TARIFF.READ',
      'HEALTH_PAYER.READ',
    ],
    sortOrder: 34,
  },
  {
    code: 'HEALTH_CLAIM_VERIFIER',
    name: 'Verifikator Klaim Internal',
    description:
      'Memverifikasi kelengkapan berkas klaim sebelum diajukan, dan menelaah penanda. TIDAK ' +
      'mengode dan TIDAK mengajukan.',
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_CLAIM.READ',
      'HEALTH_CLAIM.VERIFY',
      'HEALTH_CLAIM_REVIEW.READ',
      'HEALTH_CLAIM_REVIEW.REVIEW',
      'HEALTH_HIM_CODING.READ',
    ],
    sortOrder: 35,
  },
  {
    code: 'HEALTH_CONTRACT_DRAFTER',
    name: 'Penyusun Kontrak Fee',
    description:
      'Menyusun kontrak fee sistem dan fee investor. TIDAK menelaah hukum, TIDAK menyetujui, ' +
      'dan TIDAK mengaktifkan.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_FEE_CONTRACT.CREATE',
      'HEALTH_FEE_CONTRACT.UPDATE',
      'HEALTH_SERVICE_CATALOG.READ',
    ],
    sortOrder: 31,
  },
  {
    code: 'HEALTH_CONTRACT_APPROVER',
    name: 'Penyetuju Kontrak Fee',
    description:
      'Menyetujui kontrak fee atas nama manajemen dan mengaktifkannya. TIDAK menyusun dan ' +
      'TIDAK menelaah hukum — ketiganya harus tiga orang yang berbeda.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_FEE_CONTRACT.APPROVE',
      'HEALTH_FEE_CONTRACT.ACTIVATE',
      'HEALTH_FEE_CONTRACT.CANCEL',
    ],
    sortOrder: 32,
  },
  {
    code: 'HEALTH_INVESTOR_VIEWER',
    name: 'Pemegang Kontrak Investor',
    description:
      'Melihat ringkasan hasil usaha menurut kontraknya. TIDAK memperoleh satu pun hak atas ' +
      'data pasien.',
    /*
     * Sengaja HANYA dua hak, dan keduanya bukan data pasien.
     *
     * Perannya dibuat lebih awal daripada dasbornya justru supaya batasnya
     * tercatat sejak sekarang — sebelum ada layar yang menggodanya. Yang
     * membedakan pembagian hasil dari pembukaan rekam medis bukan niat,
     * melainkan hak akses mana yang pernah diberikan; dan hak yang pernah
     * diberikan jarang ditarik kembali, sebab menariknya menuntut seseorang
     * menyadari bahwa ia pernah diberikan.
     */
    permissions: ['HEALTH.READ', 'HEALTH_FEE_CONTRACT.READ'],
    sortOrder: 33,
  },
  {
    code: 'HEALTH_SETTLEMENT_CLERK',
    name: 'Petugas Kalkulasi Jasa',
    description:
      'Menghitung dan menyimulasikan settlement jasa. TIDAK menyetujui, TIDAK membayar, dan ' +
      'TIDAK mengoreksi — ketiganya dipegang orang lain.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_SETTLEMENT.READ',
      'HEALTH_FEE_SETTLEMENT.CREATE',
      'HEALTH_FEE_POLICY.READ',
      'HEALTH_FEE_CONTRIBUTOR.READ',
    ],
    sortOrder: 29,
  },
  {
    code: 'HEALTH_SETTLEMENT_PAYER',
    name: 'Petugas Pembayaran Jasa',
    description:
      'Mengunci settlement yang sudah disetujui, mencatat pembayarannya, dan menerbitkan ' +
      'pernyataan. TIDAK menghitung dan TIDAK menyetujui.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_FEE_SETTLEMENT.READ',
      'HEALTH_FEE_SETTLEMENT.POST',
      'HEALTH_FEE_STATEMENT.READ',
      'HEALTH_FEE_STATEMENT.CREATE',
      'HEALTH_FEE_STATEMENT.EXPORT',
    ],
    sortOrder: 30,
  },
  {
    code: 'HEALTH_TARIFF_OFFICER',
    name: 'Petugas Tarif',
    description:
      'Mengimpor tarif dari terbitan resmi dan mengelola cakupan penjamin. TIDAK menyetujui ' +
      'tarif — persetujuan mengubah seluruh tagihan rumah sakit.',
    permissions: [
      'HEALTH.READ',
      'HEALTH_TARIFF.READ',
      'HEALTH_TARIFF.IMPORT',
      'HEALTH_PAYER.READ',
      'HEALTH_PAYER.CREATE',
      'HEALTH_PAYER.UPDATE',
      'HEALTH_SERVICE_CATALOG.READ',
    ],
    sortOrder: 26,
  },
  {
    code: 'HEALTH_FINANCE_OFFICER',
    name: 'Petugas Keuangan Rumah Sakit',
    description:
      'Memetakan peristiwa kesehatan ke akun pada bagan akun bersama. TIDAK membaca rekam ' +
      'medis pasien dan TIDAK membuat jurnal.',
    /*
     * Sengaja TANPA HEALTH_PATIENT.READ.
     *
     * Ia perlu tahu bahwa pendapatan laboratorium masuk ke akun 4160; ia tidak
     * perlu tahu siapa yang diperiksa. Menggabungkan wewenang keuangan dengan
     * pembacaan rekam medis adalah cara paling sunyi untuk membocorkan seluruh
     * riwayat pasien — jejaknya tenggelam di antara ribuan pembacaan yang sah.
     */
    permissions: [
      'HEALTH.READ',
      'HEALTH_ACCOUNTING_MAP.READ',
      'HEALTH_ACCOUNTING_MAP.CREATE',
      'HEALTH_ACCOUNTING_MAP.UPDATE',
      'HEALTH_SERVICE_CATALOG.READ',
      // Membaca tarif; ia memetakan akunnya, bukan mengubah tarifnya.
      'HEALTH_TARIFF.READ',
      'HEALTH_PAYER.READ',
      'HEALTH_FEE_POLICY.READ',
      // Membuat penyesuaian dan pembalikan. Ia tidak menghitung maupun
      // membayar, sehingga koreksinya diperiksa orang keempat.
      'HEALTH_FEE_SETTLEMENT.READ',
      'HEALTH_FEE_SETTLEMENT.REVERSE',
      'HEALTH_FEE_STATEMENT.READ',
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_CLAIM.READ',
      'HEALTH_CLAIM_RECON.READ',
      'HEALTH_CLAIM_RECON.CREATE',
      'HEALTH_CLAIM_RECON.CLOSE_PERIOD',
    ],
    sortOrder: 25,
  },
  {
    code: 'HEALTH_LEGAL_OFFICER',
    name: 'Petugas Hukum Rumah Sakit',
    description:
      'Memasang penahanan hukum atas rekam medis dan memutuskan permintaan pelepasan informasi. ' +
      'Sengaja sempit — ia tidak merawat siapa pun.',
    // Sengaja TANPA HEALTH_INFO_RELEASE.EXPORT. Yang memutuskan pelepasan bukan
    // yang menyerahkan berkasnya; itu pekerjaan petugas rekam medis.
    permissions: [
      ...BACA_PASIEN,
      'HEALTH_LEGAL_HOLD.READ',
      'HEALTH_LEGAL_HOLD.CREATE',
      'HEALTH_LEGAL_HOLD.DELETE',
      'HEALTH_INFO_RELEASE.READ',
      'HEALTH_INFO_RELEASE.CREATE',
      // Menelaah hukum kontrak fee. Ia memang orang yang menelaah kontrak —
      // dan ia TIDAK menyetujuinya, sebab telaah hukum menyatakan kontraknya
      // sah sedangkan persetujuan menyatakan kontraknya dikehendaki.
      'HEALTH_FEE_CONTRACT.READ',
      'HEALTH_FEE_CONTRACT.REVIEW',
    ],
    sortOrder: 23,
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
  {
    code: 'HEALTH_SOD_RESULT_VERIFY',
    name: 'Pemasuk hasil tidak memverifikasi hasilnya sendiri',
    description:
      'Alasan yang sama seperti telaah apoteker: orang yang mengetik angkanya adalah orang ' +
      'yang paling sulit melihat kekeliruannya. Basis data menegakkannya pula lewat constraint ' +
      'lab_result_verify_not_self, dengan pengecualian verifikasi otomatis — di sana yang ' +
      'memasukkan hasilnya adalah alat, bukan orang.',
    conflictingPermissions: ['HEALTH_LAB_RESULT.CREATE', 'HEALTH_LAB_RESULT.VERIFY_RESULT'],
  },
  {
    code: 'HEALTH_SOD_CRITICAL_ACK',
    name: 'Penyampai nilai kritis tidak menerimanya sendiri',
    description:
      'Penerimaan nilai kritis membuktikan bahwa dokter yang merawat benar-benar mendengar ' +
      'angkanya. Bila analis yang menyampaikan juga yang mencatat penerimaannya, catatan itu ' +
      'hanya membuktikan bahwa ia menekan dua tombol.',
    conflictingPermissions: [
      'HEALTH_LAB_CRITICAL.CREATE',
      'HEALTH_LAB_CRITICAL.ACKNOWLEDGE_CRITICAL',
    ],
  },
  {
    code: 'HEALTH_SOD_CHECKLIST_INCISE',
    name: 'Pengisi daftar periksa bukan yang menyayat',
    description:
      'Jeda sebelum sayatan adalah percakapan tim, bukan centang satu orang. Bila yang mengisi ' +
      'daftar periksa juga yang memulai sayatan, seluruh gunanya hilang: ia hanya mengonfirmasi ' +
      'kepada dirinya sendiri apa yang sudah diyakininya. Basis data menegakkan sisi lain dari ' +
      'aturan yang sama lewat ot_case_timeout_before_incision — daftar periksa tidak dapat ' +
      'dicentang setelah pisau menyentuh kulit.',
    conflictingPermissions: ['HEALTH_SURGERY.CHECKLIST', 'HEALTH_SURGERY.INCISE'],
  },
  {
    code: 'HEALTH_SOD_TRIAGE_DISPOSITION',
    name: 'Penriase bukan yang menetapkan disposisi',
    description:
      'Yang menriase adalah perawat di depan pintu; yang memutuskan pasien boleh pulang adalah ' +
      'dokter. Menyatukannya membuat tekanan antrean berpindah langsung menjadi keputusan ' +
      'memulangkan.',
    conflictingPermissions: ['HEALTH_EMERGENCY.TRIAGE', 'HEALTH_EMERGENCY.DISCHARGE'],
  },
  {
    code: 'HEALTH_SOD_CODE_VERIFY',
    name: 'Koder tidak memverifikasi pengkodeannya sendiri',
    description:
      'Pengkodean menentukan nilai klaim. Koder yang memverifikasi pengkodeannya sendiri tidak ' +
      'memeriksa apa pun — ia hanya menekan tombol kedua. Fasilitas yang benar-benar hanya ' +
      'memiliki satu koder dapat mematikan pemisahan ini secara sah dan tercatat lewat ' +
      'kebijakan; yang dilarang adalah menyiasatinya dengan akun kedua.',
    conflictingPermissions: ['HEALTH_HIM_CODING.CREATE', 'HEALTH_HIM_CODING.VERIFY'],
  },
  {
    code: 'HEALTH_SOD_MAP_ACTIVATE',
    name: 'Yang memetakan layanan tidak mengaktifkannya',
    description:
      'Pemetaan adalah pekerjaan harian: ratusan baris, sering keliru, sering diperbaiki. ' +
      'Aktivasi adalah keputusan yang membuat layanan dapat dipesan, ditagihkan, dan dibagi ' +
      'jasanya. Menyatukan keduanya berarti orang yang sedang mengetik baris keseratus akan ' +
      'mengaktifkan layanan yang belum pernah dilihat siapa pun — dan yang pertama menyadarinya ' +
      'adalah pasien yang menerima tagihan atas layanan yang tarifnya salah ketik.',
    conflictingPermissions: ['HEALTH_SERVICE_CATALOG.UPDATE', 'HEALTH_SERVICE_CATALOG.ACTIVATE'],
  },
  {
    code: 'HEALTH_SOD_FEE_POLICY_APPROVE',
    name: 'Penyusun kebijakan jasa tidak menyetujuinya',
    description:
      'Persentase pembagian jasa adalah kesepakatan antara rumah sakit dan tenaga medisnya. ' +
      'Disetujui satu pihak saja, ia bukan kesepakatan melainkan keputusan sepihak yang kelak ' +
      'menjadi pokok sengketa — dan sengketanya akan menyangkut uang yang sudah terlanjur ' +
      'dibayarkan. Ditegakkan constraint fee_policy_approval_not_self pada basis data pula.',
    conflictingPermissions: ['HEALTH_FEE_POLICY.CREATE', 'HEALTH_FEE_POLICY.APPROVE'],
  },
  {
    code: 'HEALTH_SOD_SETTLEMENT_APPROVE',
    name: 'Petugas kalkulasi tidak menyetujui settlement sendiri',
    description:
      'Perhitungan yang diperiksa oleh yang menghitungnya bukan pemeriksaan. Settlement ' +
      'menentukan berapa uang yang berpindah dari kas rumah sakit ke rekening tenaga medisnya, ' +
      'dan angka yang keliru pada tahap ini akan ditemukan berbulan-bulan kemudian — bila ' +
      'ditemukan sama sekali. Ditegakkan constraint fee_settlement_approval_not_self pula.',
    conflictingPermissions: ['HEALTH_FEE_SETTLEMENT.CREATE', 'HEALTH_FEE_SETTLEMENT.APPROVE'],
  },
  {
    code: 'HEALTH_SOD_SETTLEMENT_PAY',
    name: 'Penyetuju settlement tidak membayarkannya',
    description:
      'Persetujuan yang langsung menjadi transfer menghilangkan jeda terakhir sebelum uang ' +
      'berpindah. Jeda itu bukan birokrasi: ia satu-satunya kesempatan bagi orang ketiga untuk ' +
      'melihat angkanya sebelum ia tidak dapat ditarik kembali.',
    conflictingPermissions: ['HEALTH_FEE_SETTLEMENT.APPROVE', 'HEALTH_FEE_SETTLEMENT.POST'],
  },
  {
    code: 'HEALTH_SOD_SETTLEMENT_CORRECT',
    name: 'Pembuat koreksi tidak menghitung settlement yang dikoreksinya',
    description:
      'Koreksi adalah tempat paling mudah untuk memindahkan uang tanpa ada yang melihat, sebab ' +
      'ia terlihat seperti pembetulan. Penyesuaian yang dibuat oleh orang yang juga menghitung ' +
      'settlement aslinya tidak dapat dibedakan dari pembetulan atas kekeliruan yang disengaja. ' +
      'Ditegakkan constraint fee_correction_approval_not_self pula.',
    conflictingPermissions: ['HEALTH_FEE_SETTLEMENT.CREATE', 'HEALTH_FEE_SETTLEMENT.REVERSE'],
  },
  {
    code: 'HEALTH_SOD_CONTRACT_DRAFT_REVIEW',
    name: 'Penyusun kontrak fee tidak menelaah hukumnya',
    description:
      'Telaah hukum yang dilakukan penyusunnya sendiri hanya membaca ulang kalimat yang baru ' +
      'saja ditulisnya. Kontrak fee mengambil bagian dari kumpulan yang sama dengan jasa tenaga ' +
      'medis, dan yang dirugikannya tidak duduk di ruangan itu — satu-satunya pengganti ' +
      'kehadirannya adalah jumlah mata yang melihat. Ditegakkan constraint ' +
      'fee_contract_prepare_review_differ pada basis data pula.',
    conflictingPermissions: ['HEALTH_FEE_CONTRACT.CREATE', 'HEALTH_FEE_CONTRACT.REVIEW'],
  },
  {
    code: 'HEALTH_SOD_CONTRACT_REVIEW_APPROVE',
    name: 'Pemeriksa hukum tidak menyetujui kontraknya',
    description:
      'Telaah hukum menyatakan kontraknya sah; persetujuan manajemen menyatakan kontraknya ' +
      'dikehendaki. Dua pertanyaan yang berbeda, dan menyatukan penjawabnya membuat pertanyaan ' +
      'kedua tidak pernah benar-benar ditanyakan. Ditegakkan constraint ' +
      'fee_contract_review_approve_differ pula.',
    conflictingPermissions: ['HEALTH_FEE_CONTRACT.REVIEW', 'HEALTH_FEE_CONTRACT.APPROVE'],
  },
  {
    code: 'HEALTH_SOD_CLAIM_SUBMIT_REVIEW',
    name: 'Pengaju klaim tidak menelaah penandanya',
    description:
      'Penanda anti-fraud memasukkan klaim ke antrean telaah, dan telaah oleh orang yang sedang ' +
      'dikejar tenggat pengajuan akan selalu berkesimpulan tidak ada masalah. Bukan karena ia ' +
      'tidak jujur, melainkan karena ia satu-satunya orang yang biayanya ditanggung sendiri bila ' +
      'telaahnya memperlambat.',
    conflictingPermissions: ['HEALTH_CLAIM.SUBMIT', 'HEALTH_CLAIM_REVIEW.REVIEW'],
  },
  /*
   * HEALTH_SOD_CLAIM_CODE_VERIFY sengaja TIDAK ada di sini sebagai pasangan
   * hak akses.
   *
   * "Pengode tidak memverifikasi klaimnya sendiri" adalah hubungan antara satu
   * orang dan satu KLAIM, bukan antara dua hak akses. Verifikator yang
   * kebetulan juga koder tetap boleh memverifikasi klaim yang dikode orang
   * lain — dan melarangnya akan menghentikan rumah sakit kecil yang koder dan
   * verifikatornya memang bergantian.
   *
   * Diperiksa pada tingkat baris, dan ditegakkan constraint
   * health_claim_verify_not_self pada basis data.
   */
  /*
   * HEALTH_SOD_FEE_RECIPIENT_APPROVE sengaja TIDAK ada di sini.
   *
   * "Penerima jasa tidak menyetujui aturan yang membayar dirinya" bukan
   * pasangan hak akses yang bertentangan — ia hubungan antara satu orang dan
   * satu baris kebijakan. Dokter yang juga administrator memegang dua peran
   * yang sah masing-masing; yang dilarang hanyalah menyetujui kebijakan yang
   * menyebut namanya. Mendaftarkannya sebagai pasangan hak akses akan melarang
   * pekerjaan yang sah dan tetap membiarkan yang dilarangnya lewat.
   *
   * Diperiksa pada tingkat baris saat persetujuan, dan didaftarkan pada mesin
   * SoD tenant lewat H025.
   */
  /*
   * HEALTH_SOD_HOLD_RELEASE sengaja TIDAK ada di sini.
   *
   * "Pemasang penahanan tidak mencabutnya sendiri" adalah aturan PER BARIS,
   * bukan per hak akses. Petugas hukum memang perlu memasang penahanan sekaligus
   * mencabut penahanan yang dipasang rekannya; yang dilarang hanyalah mencabut
   * yang dipasangnya sendiri. Mendaftarkannya sebagai pasangan hak akses yang
   * bertentangan akan melarang pekerjaan yang sah, dan aturan yang melarang
   * pekerjaan yang sah adalah aturan yang akan dimatikan seluruhnya.
   *
   * Ditegakkan constraint him_hold_release_not_self pada basis data, dan
   * didaftarkan pada mesin SoD tenant lewat H017 dengan sisi PREPARER.
   */
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
