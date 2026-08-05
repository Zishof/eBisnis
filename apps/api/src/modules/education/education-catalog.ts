export type EducationProduct = 'epesantren' | 'eschool' | 'ecampus';
export type EducationModuleStatus = 'TERIMPLEMENTASI' | 'SEBAGIAN' | 'FONDASI' | 'BELUM';
export type EducationPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type EducationNationalStandard = 'DAPODIK' | 'EMIS' | 'FEEDER';

export interface EducationGapModule {
  code: string;
  name: string;
  product: EducationProduct;
  status: EducationModuleStatus;
  priority: EducationPriority;
  summary: string;
  implementedBy: string;
  nextAction: string;
  href?: string;
}

export interface EducationDataset {
  code: string;
  name: string;
  standard: EducationNationalStandard;
  owner: EducationProduct[];
  status: EducationModuleStatus;
  requiredFields: string[];
  importEndpoint?: string;
  exportEndpoint?: string;
  templateEndpoint?: string;
}

export interface EducationRoadmapItem {
  priority: EducationPriority;
  title: string;
  items: string[];
}

export interface EschoolNavigationItem {
  code: string;
  name: string;
  description: string;
  href: string;
  status: EducationModuleStatus;
  priority: EducationPriority;
  metricLabel: string;
  metricValue: string;
  foundation: string;
}

export interface EschoolDashboard {
  title: string;
  subtitle: string;
  readiness: Array<{ label: string; value: string; status: EducationModuleStatus }>;
  quickActions: Array<{ label: string; href: string; description: string }>;
  modules: EschoolNavigationItem[];
}

export const ESCHOOL_NAVIGATION: EschoolNavigationItem[] = [
  {
    code: 'dashboard',
    name: 'Dashboard Sekolah',
    description: 'Ringkasan siswa, guru, rombel, presensi, PPDB, nilai, DAPODIK, dan pekerjaan harian kepala sekolah.',
    href: '/app/eschool',
    status: 'SEBAGIAN',
    priority: 'P1',
    metricLabel: 'Panel',
    metricValue: 'Aktif',
    foundation: 'Education catalog dan dashboard eSchool.',
  },
  {
    code: 'siswa',
    name: 'Siswa',
    description: 'Biodata siswa, NIS/NISN/NIK, orang tua/wali, status aktif, mutasi, alumni, dan validasi DAPODIK.',
    href: '/app/eschool/siswa',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Dataset',
    metricValue: 'DAPODIK',
    foundation: 'pesantren_santri sebagai education-core peserta didik.',
  },
  {
    code: 'guru',
    name: 'Guru dan GTK',
    description: 'Data guru/tenaga kependidikan, NUPTK/NIP, penugasan mengajar, kontak, dan status aktif.',
    href: '/app/eschool/guru',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Dataset',
    metricValue: 'GTK',
    foundation: 'pesantren_guru dan penugasan mengajar.',
  },
  {
    code: 'ppdb',
    name: 'PPDB',
    description: 'Gelombang penerimaan, formulir pendaftar, verifikasi, seleksi, daftar ulang, dan kartu peserta.',
    href: '/app/eschool/ppdb',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Alur',
    metricValue: 'PSB',
    foundation: 'pesantren_psb_gelombang dan pendaftar.',
  },
  {
    code: 'kelas',
    name: 'Kelas dan Rombel',
    description: 'Kelas, rombongan belajar, anggota rombel, wali kelas, kapasitas, dan tahun ajaran.',
    href: '/app/eschool/kelas',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Struktur',
    metricValue: 'Rombel',
    foundation: 'pesantren_rombongan_belajar.',
  },
  {
    code: 'akademik',
    name: 'Mapel, Jadwal, Nilai/Rapor',
    description: 'Mata pelajaran, kurikulum, jadwal, komponen nilai, skala, input nilai, leger, dan rapor.',
    href: '/app/eschool/akademik',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Akademik',
    metricValue: 'Siap fondasi',
    foundation: 'pesantren_mata_pelajaran, kurikulum, jadwal, nilai.',
  },
  {
    code: 'presensi',
    name: 'Presensi',
    description: 'Kehadiran siswa, presensi kelas, rekap harian, izin, dan export laporan ke wali kelas.',
    href: '/app/eschool/presensi',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Absensi',
    metricValue: 'Harian',
    foundation: 'pesantren_presensi dan izin.',
  },
  {
    code: 'bk',
    name: 'BK dan Pembinaan',
    description: 'Catatan konseling, pelanggaran, prestasi, tindak lanjut, dan buku penghubung orang tua.',
    href: '/app/eschool/bk',
    status: 'FONDASI',
    priority: 'P2',
    metricLabel: 'Layanan',
    metricValue: 'BK',
    foundation: 'pembinaan, pelanggaran, prestasi, buku penghubung.',
  },
  {
    code: 'dapodik',
    name: 'DAPODIK',
    description: 'Import, export, template, diff per field, log batch, dan rollback aman untuk data nasional.',
    href: '/app/eschool/dapodik',
    status: 'SEBAGIAN',
    priority: 'P0',
    metricLabel: 'Audit',
    metricValue: 'Batch',
    foundation: 'EschoolDapodikController.',
  },
  {
    code: 'perpustakaan',
    name: 'Perpustakaan',
    description: 'Katalog buku, anggota, peminjaman, pengembalian, denda, dan statistik literasi.',
    href: '/app/eschool/perpustakaan',
    status: 'BELUM',
    priority: 'P2',
    metricLabel: 'Roadmap',
    metricValue: 'P2',
    foundation: 'Belum ada entity khusus.',
  },
  {
    code: 'sarpras',
    name: 'Sarpras',
    description: 'Ruang, aset pendidikan, kondisi, inventaris, perawatan, dan bukti kelayakan sarana.',
    href: '/app/eschool/sarpras',
    status: 'BELUM',
    priority: 'P2',
    metricLabel: 'Roadmap',
    metricValue: 'P2',
    foundation: 'Bisa memakai inventory/core asset sebagai referensi.',
  },
  {
    code: 'akreditasi',
    name: 'Akreditasi dan Mutu',
    description: 'Evidence center, indikator mutu, dokumen pendukung, visitasi, dan riwayat akreditasi.',
    href: '/app/eschool/akreditasi',
    status: 'BELUM',
    priority: 'P2',
    metricLabel: 'Roadmap',
    metricValue: 'P2',
    foundation: 'Surat, CMS, audit, dan dokumen dapat menjadi fondasi.',
  },
  {
    code: 'alumni',
    name: 'Alumni',
    description: 'Data lulusan, tracer study, kontak alumni, riwayat lanjut studi/kerja, dan komunitas.',
    href: '/app/eschool/alumni',
    status: 'FONDASI',
    priority: 'P2',
    metricLabel: 'Status',
    metricValue: 'Mutasi',
    foundation: 'Status santri/siswa keluar/lulus.',
  },
  {
    code: 'laporan',
    name: 'Laporan',
    description: 'Laporan siswa, guru, rombel, presensi, PPDB, nilai, DAPODIK, dan manajemen sekolah.',
    href: '/app/eschool/laporan',
    status: 'FONDASI',
    priority: 'P1',
    metricLabel: 'Output',
    metricValue: 'PDF/Excel',
    foundation: 'CRUD tools, laporan pesantren, dan DAPODIK export.',
  },
];

export const ESCHOOL_DASHBOARD: EschoolDashboard = {
  title: 'Dashboard eSchool',
  subtitle: 'Ruang kerja sekolah formal untuk kepala sekolah, operator, wali kelas, guru, BK, dan tata usaha.',
  readiness: [
    { label: 'DAPODIK', value: 'Log batch, diff, rollback', status: 'SEBAGIAN' },
    { label: 'Siswa/GTK', value: 'Fondasi import/export', status: 'FONDASI' },
    { label: 'Akademik', value: 'Rombel, mapel, jadwal, nilai', status: 'FONDASI' },
    { label: 'Layanan sekolah', value: 'BK, perpustakaan, sarpras', status: 'BELUM' },
  ],
  quickActions: [
    { label: 'Import DAPODIK', href: '/app/eschool/dapodik', description: 'Validasi, preview diff, import final, dan rollback batch.' },
    { label: 'Kelola siswa', href: '/app/eschool/siswa', description: 'Buka facade siswa dengan kosakata sekolah formal.' },
    { label: 'Akademik', href: '/app/eschool/akademik', description: 'Rombel, mapel, jadwal, nilai, rapor, dan leger.' },
  ],
  modules: ESCHOOL_NAVIGATION,
};

export const EDUCATION_GAP_MODULES: EducationGapModule[] = [
  {
    code: 'EP-DASH',
    name: 'Dashboard pondok',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P1',
    summary: 'KPI santri, PSB, tagihan, asrama, rombel, dan ringkasan operasional pondok.',
    implementedBy: 'PesantrenDashboardPage dan /pesantren/laporan/dasbor.',
    nextAction: 'Tambahkan drilldown tren presensi, pembinaan, dompet, dan alarm harian.',
    href: '/app',
  },
  {
    code: 'EP-MASTER',
    name: 'Profil, unit, situs, dan CMS',
    product: 'epesantren',
    status: 'TERIMPLEMENTASI',
    priority: 'P0',
    summary: 'Profil pondok, unit pendidikan, media, berita, situs pondok, situs unit, dan subdomain.',
    implementedBy: 'Profil, media, berita, unit pendidikan, SitusPondokPage, dan SitusUnitPage.',
    nextAction: 'Samakan seluruh section agar gambar bisa diganti admin dan tidak ada header ganda.',
    href: '/app/pesantren/profil',
  },
  {
    code: 'EP-SANTRI',
    name: 'Santri, wali, alumni, dan DAPODIK',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Biodata santri/wali, status akhir, referensi nasional, dan integrasi DAPODIK.',
    implementedBy: 'PesantrenSantriPage dan PesantrenDapodikPage.',
    nextAction: 'Lengkapi riwayat mutasi/alumni dan dokumen legal per santri.',
    href: '/app/pesantren/santri',
  },
  {
    code: 'EP-PSB',
    name: 'PSB/PPDB online',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Gelombang, pendaftar, jadwal, portal pendaftar, dan status seleksi.',
    implementedBy: 'PesantrenPsbPage dan portal PSB publik.',
    nextAction: 'Tambah kartu peserta, matriks verifikasi dokumen, dan form builder lanjutan.',
    href: '/app/pesantren/psb',
  },
  {
    code: 'EP-AKADEMIK',
    name: 'Kurikulum, rombel, jadwal, nilai, rapor',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Rombel, kurikulum, jadwal, komponen nilai, skala huruf, input nilai, rapor, dan finalisasi snapshot.',
    implementedBy: 'PesantrenKelasKurikulumPage, PesantrenJadwalPage, PesantrenNilaiPage, pesantren_rapor_finalisasi.',
    nextAction: 'Cetak rapor PDF resmi, leger, ranking, kenaikan kelas, kelulusan, dan validasi bentrok jadwal lanjutan.',
    href: '/app/pesantren/nilai',
  },
  {
    code: 'EP-ASRAMA',
    name: 'Asrama, izin, gerbang, kiosk',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Asrama/kamar, perizinan, log keluar-masuk, kiosk, kartu, dan portal wali.',
    implementedBy: 'PesantrenAsramaPage, PesantrenPerizinanPage, PesantrenGerbangPage, PesantrenKioskPage.',
    nextAction: 'Tambah scanner tablet/PC, kunjungan wali, paket, penjemputan, dan mode offline ringan.',
    href: '/app/pesantren/gerbang',
  },
  {
    code: 'EP-PEMBINAAN',
    name: 'Diniyah, tahfiz, BK, pelanggaran, prestasi',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P1',
    summary: 'Kajian, halaqah, tahfiz, pelanggaran, prestasi, ekskul, dan buku penghubung.',
    implementedBy: 'PesantrenDakwahPage dan PesantrenPembinaanPage.',
    nextAction: 'Tambah workflow BK, konseling, target tahfiz personal, dan rapor diniyah.',
    href: '/app/pesantren/dakwah',
  },
  {
    code: 'EP-KEUANGAN',
    name: 'Tagihan, pembayaran, dompet, POS, koperasi',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Tagihan SPP, pembayaran, dompet santri, batas harian, serta koneksi POS.',
    implementedBy: 'PesantrenTagihanPage, PesantrenDompetPage, POS, payment, billing, accounting.',
    nextAction: 'Rekonsiliasi payment gateway, settlement dompet-POS, dan posting jurnal otomatis.',
    href: '/app/pesantren/tagihan',
  },
  {
    code: 'ES-MASTER',
    name: 'Master sekolah dan unit formal',
    product: 'eschool',
    status: 'SEBAGIAN',
    priority: 'P1',
    summary: 'Profil sekolah, NPSN, jenjang, tahun ajaran, semester, kelas, rombel, dan alamat.',
    implementedBy: 'ESCHOOL_VERTICAL_CATALOG, EschoolDashboardPage, EschoolOperationalPage, unit pendidikan, rombel, kurikulum, tenant, dan profil.',
    nextAction: 'Pisahkan entity sekolah formal murni dari unit pendidikan pesantren tanpa memutus data yang sudah ada.',
    href: '/app/eschool/siswa',
  },
  {
    code: 'ES-SISWA',
    name: 'Siswa, orang tua, dan DAPODIK',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P1',
    summary: 'Biodata siswa, NISN, NIK, wali, mutasi, alumni, dan referensi nasional.',
    implementedBy: 'Facade DAPODIK eSchool, navigasi eSchool, dan shell operasional siswa memakai education-core sebagai fondasi.',
    nextAction: 'Tambahkan endpoint CRUD siswa eSchool dengan filter unit formal, mutasi, wali, dan validasi NISN/NIK.',
    href: '/app/eschool/siswa',
  },
  {
    code: 'ES-AKADEMIK',
    name: 'Akademik sekolah, rapor, PPDB',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P1',
    summary: 'Mapel, kurikulum, jadwal, nilai, rapor, ujian, kelulusan, dan PPDB sekolah.',
    implementedBy: 'Shell eSchool akademik, pola rombel, kurikulum, jadwal, nilai, PSB, dan finalisasi rapor tersedia di ePesantren.',
    nextAction: 'Tambah rapor sekolah resmi, leger, kenaikan/kelulusan, kartu PPDB sekolah, dan finalisasi export DAPODIK khusus sekolah formal.',
    href: '/app/eschool/akademik',
  },
  {
    code: 'ES-LAYANAN',
    name: 'BK, perpustakaan, sarpras, akreditasi, alumni',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P2',
    summary: 'Layanan pendukung sekolah untuk mutu, aset, literasi, konseling, dan jejaring alumni.',
    implementedBy: 'ESCHOOL_VERTICAL_CATALOG dan EschoolOperationalPage menyiapkan shell menu layanan; sebagian bisa memakai surat, CMS, inventory, dan pembinaan.',
    nextAction: 'Buat modul BK sekolah terlebih dahulu, lalu perpustakaan, sarpras, akreditasi, dan alumni.',
    href: '/app/eschool/perpustakaan',
  },
  {
    code: 'EC-MASTER',
    name: 'Master PT, fakultas, prodi',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P2',
    summary: 'Identitas perguruan tinggi, fakultas, prodi, jenjang, akreditasi, dan struktur organisasi.',
    implementedBy: 'Belum ada domain kampus; platform tenant dapat menjadi fondasi.',
    nextAction: 'Buat entity PT/fakultas/prodi sebagai inti eCampus MVP.',
  },
  {
    code: 'EC-AKADEMIK',
    name: 'Mahasiswa, dosen, PMB, KRS/KHS',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P2',
    summary: 'Mahasiswa, dosen, PMB, kurikulum, kelas kuliah, KRS, KHS, transkrip, dan wisuda.',
    implementedBy: 'Belum ada; pola santri/guru/PSB/nilai bisa menjadi referensi implementasi.',
    nextAction: 'Implementasi MVP dimulai dari mahasiswa, dosen, PMB, kelas kuliah, KRS, dan nilai.',
  },
  {
    code: 'EC-MUTU',
    name: 'OBE, MBKM, Feeder, SPMI, SPI, akreditasi',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P3',
    summary: 'Pelaporan nasional dan mutu perguruan tinggi: CPL/CPMK, PD-Dikti, SAPTO, PPEPP, dan AMI.',
    implementedBy: 'Belum ada; governance, surat, dan AI dapat mendukung evidence center.',
    nextAction: 'Buat mapping Feeder dan repository evidence setelah master akademik kampus selesai.',
  },
];

export const EDUCATION_DATASETS: EducationDataset[] = [
  {
    code: 'dapodik-siswa',
    name: 'Siswa/Santri',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['NISN', 'NIK', 'nama', 'tanggal lahir', 'jenis kelamin', 'wali', 'alamat'],
    importEndpoint: '/pesantren/dapodik/santri/import',
    exportEndpoint: '/pesantren/dapodik/santri/export',
    templateEndpoint: '/pesantren/dapodik/santri/template',
  },
  {
    code: 'dapodik-guru',
    name: 'Guru dan tenaga pendidik',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['NUPTK/NIP', 'nama', 'jenis PTK', 'mapel', 'status aktif'],
    importEndpoint: '/pesantren/dapodik/guru/import',
    exportEndpoint: '/pesantren/dapodik/guru/export',
    templateEndpoint: '/pesantren/dapodik/guru/template',
  },
  {
    code: 'dapodik-rombel',
    name: 'Rombel, anggota rombel, mapel, jadwal',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['tahun ajaran', 'semester', 'tingkat', 'rombongan', 'anggota', 'mapel'],
    importEndpoint: '/pesantren/dapodik/rombongan/import',
    exportEndpoint: '/pesantren/dapodik/rombongan/export',
    templateEndpoint: '/pesantren/dapodik/rombongan/template',
  },
  {
    code: 'dapodik-nilai',
    name: 'Nilai dan rapor',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['komponen nilai', 'nilai angka', 'predikat', 'deskripsi', 'semester'],
    importEndpoint: '/pesantren/dapodik/nilai/import',
    exportEndpoint: '/pesantren/dapodik/nilai/export',
    templateEndpoint: '/pesantren/dapodik/nilai/template',
  },
  {
    code: 'emis-pesantren',
    name: 'EMIS pesantren/madrasah',
    standard: 'EMIS',
    owner: ['epesantren'],
    status: 'BELUM',
    requiredFields: ['NSM/NPSN', 'santri', 'ustadz', 'rombel', 'lembaga', 'sarana'],
  },
  {
    code: 'feeder-kampus',
    name: 'Feeder/PD-Dikti',
    standard: 'FEEDER',
    owner: ['ecampus'],
    status: 'BELUM',
    requiredFields: ['mahasiswa', 'dosen', 'prodi', 'kelas kuliah', 'KRS', 'nilai', 'aktivitas'],
  },
];

export const EDUCATION_ROADMAP: EducationRoadmapItem[] = [
  {
    priority: 'P0',
    title: 'Sempurnakan ePesantren yang sudah paling dekat produksi',
    items: [
      'Rapor PDF resmi, leger nilai, ranking, kenaikan kelas, dan kelulusan di atas snapshot finalisasi.',
      'PSB/PPDB: form dinamis, kartu peserta, verifikasi dokumen, hasil seleksi, ekspor.',
      'Gerbang: QR scanner tablet/PC, log kunjungan, penjemput, paket, mode offline ringan.',
      'Keuangan: rekonsiliasi pembayaran, export tagihan/piutang, posting jurnal.',
      'DAPODIK: export/import lengkap dengan dry-run, diff, dan rollback batch.',
    ],
  },
  {
    priority: 'P1',
    title: 'Jadikan eSchool vertical nyata',
    items: [
      'Namespace backend eSchool atau education-school.',
      'Master sekolah, siswa, guru, rombel, mapel, jadwal, nilai, PPDB, DAPODIK.',
      'Portal orang tua/siswa dan dashboard sekolah.',
      'BK, presensi, keuangan, perpustakaan, sarpras, akreditasi, alumni.',
    ],
  },
  {
    priority: 'P2',
    title: 'Buat eCampus MVP',
    items: [
      'Master PT, fakultas, prodi, mahasiswa, dosen.',
      'PMB, KRS, KHS, transkrip, kelas kuliah, tagihan UKT.',
      'Kurikulum OBE/MBKM dan mapping Feeder awal.',
    ],
  },
  {
    priority: 'P3',
    title: 'Modul diferensiasi dan otomasi',
    items: [
      'AI assistant education.',
      'Akreditasi evidence center.',
      'SPMI/SPI, alumni/tracer, mobile apps, offline device mode, advanced analytics.',
    ],
  },
];
