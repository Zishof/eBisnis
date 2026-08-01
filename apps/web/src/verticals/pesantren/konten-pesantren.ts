/**
 * Isi materi ePesantren — satu sumber untuk empat dokumen.
 *
 * ## Mengapa terkumpul di satu berkas
 *
 * Presentasi, Proposal, Draft PKS, dan Surat Penawaran menyebut fakta yang sama:
 * delapan pilar, harga per santri, tahapan penerapan, identitas perusahaan.
 * Menuliskannya empat kali berarti tiga di antaranya suatu hari tertinggal — dan
 * yang tertinggal pada dokumen komersial adalah selisih antara apa yang
 * dipresentasikan dan apa yang ditandatangani.
 *
 * Pola ini menyalin `content/solusi.ts`, yang sudah melakukan hal yang sama
 * untuk eBisnis.
 *
 * ## Sumber
 *
 * Disusun dari dua paparan CV. Zishof: `Presentasi_ePesantren_CV_Zishof.pdf`
 * (23 halaman) dan `Presentasi_ePesantren_Kemitraan_BMT_CV_Zishof.pdf`
 * (28 halaman — memuat seluruh isi yang pertama, ditambah Open API dan
 * kemitraan BMT).
 *
 * ## Yang TIDAK boleh ditaruh di sini
 *
 * Angka penagihan. `HARGA_PER_SANTRI` di bawah adalah **penawaran bawaan** yang
 * dicetak pada dokumen, bukan sumber kebenaran tagihan. Yang menagih tetap
 * katalog harga berversi pada control plane, dan kontrak tiap pondok dapat
 * menimpanya.
 */

export interface Butir {
  judul: string;
  isi: string;
}

/** Identitas penyedia, apa adanya dari paparan. */
export const PENYEDIA = {
  nama: 'CV. Zishof',
  moto: 'Melayani Dengan Sepenuh Hati',
  berdiri: 2013,
  alamat:
    'Jl. Lembah Pinus Raya Blok A3 No. 87, Pamulang, Kota Tangerang Selatan, Banten',
  surel: 'zishof@gmail.com',
  telepon: '0818-748-187',
  faks: '(021) 7471-8187',
  portal: 'santri.info',
} as const;

export const INDIKATOR: Butir[] = [
  { judul: '150+', isi: 'Institusi pengguna aktif' },
  { judul: '10+', isi: 'Sektor industri yang ditangani' },
  { judul: '1 Sistem', isi: 'Terpadu untuk seluruh unit' },
  { judul: 'Multi-Kanal', isi: 'Anjungan, web, mobile, dan tablet' },
];

/** Enam tantangan yang dibuka paparan. */
export const MASALAH: Butir[] = [
  {
    judul: 'Data terpisah-pisah',
    isi: 'Data santri, keuangan, akademik, dan asrama tersebar di banyak buku dan berkas Excel yang tidak saling terhubung.',
  },
  {
    judul: 'Banyak unit, sulit terpantau',
    isi: 'Sekolah, diniyah, koperasi, kantin, klinik, dan BMT masing-masing berjalan sendiri tanpa laporan terpadu.',
  },
  {
    judul: 'Keuangan rawan selisih',
    isi: 'Uang saku santri, SPP, kas kegiatan, dan unit usaha sulit direkonsiliasi dan dipertanggungjawabkan.',
  },
  {
    judul: 'Layanan manual dan lambat',
    isi: 'Perizinan santri, persuratan, pengadaan, dan LPJ masih manual sehingga memakan waktu dan tenaga.',
  },
  {
    judul: 'Santri tanpa ponsel',
    isi: 'Banyak pesantren melarang santri membawa ponsel, sehingga dibutuhkan kanal alternatif yang aman untuk layanan.',
  },
  {
    judul: 'Laporan sulit dan terlambat',
    isi: 'Pimpinan kesulitan memperoleh gambaran menyeluruh secara cepat untuk mengambil keputusan.',
  },
];

/** Empat sifat yang dijanjikan solusi. */
export const SIFAT_SOLUSI: Butir[] = [
  { judul: 'Terpadu', isi: 'Semua unit dan modul saling terhubung dalam satu sistem.' },
  { judul: 'Satu data', isi: 'Dicatat sekali, dipakai bersama — tanpa selisih laporan.' },
  { judul: 'Multi-kanal', isi: 'Anjungan, web, mobile, tablet, hingga desktop.' },
  {
    judul: 'Sesuai kultur',
    isi: 'Diniyah, tahfiz, keuangan syariah, dan BMT terwadahi.',
  },
];

export interface Pilar {
  nomor: number;
  nama: string;
  ringkas: string;
  butir: Butir[];
}

/**
 * Delapan pilar, dengan nomor sesuai paparan.
 *
 * Nomor pilar pada paparan tidak berurutan dengan urutan halamannya — Pilar 8
 * (kanal) muncul sebelum Pilar 3 (kesehatan). Nomor aslinya dipertahankan supaya
 * dokumen ini dapat dicocokkan dengan paparan yang sudah beredar; urutan
 * tampilnya diatur pemakai, bukan oleh nomor.
 */
export const PILAR: Pilar[] = [
  {
    nomor: 1,
    nama: 'Pendidikan Multi-Jenjang & Pembelajaran',
    ringkas:
      'Seluruh jenjang dan jenis pendidikan di pesantren dikelola dalam satu sistem akademik yang terhubung — dari perguruan tinggi hingga madrasah diniyah dan kursus.',
    butir: [
      {
        judul: 'Perguruan Tinggi (eCampus)',
        isi: 'Akademik dan KRS, kurikulum OBE, e-Learning, PMB, keuangan, penelitian, Neo Feeder/SISTER, akreditasi.',
      },
      {
        judul: 'Sekolah Umum (Daycare–SMK)',
        isi: 'Daycare, PAUD/TK, SD/MI, SMP/MTs, SMA/SMK: PPDB, presensi, nilai dan rapor, SPP, portal wali.',
      },
      {
        judul: 'Madrasah Diniyah / Sekolah Pondok',
        isi: 'Kurikulum diniyah, halaqah, kajian kitab, jenjang marhalah, dan rapor diniyah tersendiri.',
      },
      {
        judul: "Tahfiz & Pengajian Al-Qur'an",
        isi: "Setoran dan muraja'ah hafalan, capaian juz, penilaian tajwid, dan laporan kepada wali.",
      },
      {
        judul: 'Unit Kursus & Pelajaran Tambahan',
        isi: 'Bahasa, keterampilan, komputer, dan les tambahan: pendaftaran, jadwal, penilaian, dan sertifikat.',
      },
      {
        judul: 'Pelatihan & Bimtek (LMS)',
        isi: 'Konten disusun sendiri oleh asatidz maupun pemateri luar; kelas daring, kuis, dan sertifikat.',
      },
    ],
  },
  {
    nomor: 2,
    nama: 'Kesantrian & Layanan Kehidupan Santri',
    ringkas:
      'Mengelola keseharian santri secara menyeluruh — data, asrama, perizinan, keuangan pribadi, hingga komunikasi dengan wali.',
    butir: [
      {
        judul: 'Data Santri & Asrama',
        isi: 'Biodata lengkap, penempatan kamar dan asrama, kesehatan, prestasi, serta riwayat perkembangan santri.',
      },
      {
        judul: 'Perizinan Keluar–Masuk',
        isi: 'Pengajuan izin, persetujuan berjenjang, pencatatan kepulangan dan kedatangan, notifikasi otomatis ke wali.',
      },
      {
        judul: 'Tabungan & Uang Saku Nontunai',
        isi: 'Saldo santri, setor dan tarik, belanja di seluruh unit usaha — mengurangi uang tunai di lingkungan pondok.',
      },
      {
        judul: 'Buku Tamu Online',
        isi: 'Pendaftaran kunjungan dan jadwal besuk daring, pencatatan tamu, serta notifikasi kepada santri dan pengasuh.',
      },
      {
        judul: 'Antar–Jemput & Ekspedisi',
        isi: 'Penjadwalan armada antar-jemput, rute, konfirmasi wali, serta pencatatan ekspedisi barang santri.',
      },
      {
        judul: 'Komunikasi Wali Santri',
        isi: 'Pengumuman, laporan perkembangan, tagihan, dan pemberitahuan penting langsung ke wali.',
      },
    ],
  },
  {
    nomor: 3,
    nama: 'Layanan Kesehatan & Klinik Pesantren',
    ringkas:
      'Menjaga kesehatan santri melalui klinik pondok yang tercatat rapi, terhubung dengan wali, dan siap merujuk ke rumah sakit bila diperlukan.',
    butir: [
      {
        judul: 'Rekam Medis Santri (eMedik)',
        isi: 'Riwayat kesehatan, pemeriksaan, diagnosis, dan tindakan tercatat dalam rekam medis elektronik.',
      },
      {
        judul: 'Klinik & Farmasi Pondok',
        isi: 'Antrian dan kunjungan, resep, stok dan pemakaian obat, serta laporan kunjungan poliklinik pesantren.',
      },
      {
        judul: 'Rujukan ke Rumah Sakit',
        isi: 'Penerbitan surat rujukan, riwayat medis terbawa, dan koordinasi rujukan bila butuh penanganan lanjut.',
      },
      {
        judul: 'Notifikasi & Riwayat Wali',
        isi: 'Pemberitahuan kepada wali saat santri sakit atau dirujuk, beserta rekap riwayat kesehatannya.',
      },
      {
        judul: 'Poskestren & Pemeriksaan Berkala',
        isi: 'Pemeriksaan kesehatan rutin, imunisasi, dan program kesehatan santri terjadwal.',
      },
      {
        judul: 'Integrasi BPJS / SATUSEHAT',
        isi: 'Opsi keterhubungan dengan layanan kesehatan nasional sesuai kebutuhan pesantren.',
      },
    ],
  },
  {
    nomor: 4,
    nama: 'Keuangan, BMT & Koperasi Simpan Pinjam',
    ringkas:
      'Mengelola keuangan santri dan lembaga keuangan pesantren berbasis prinsip syariah — dari anggota, untuk anggota.',
    butir: [
      {
        judul: 'BMT (Baitul Maal wat Tamwil)',
        isi: 'Simpanan dan pembiayaan berbasis akad syariah, bagi hasil, serta pengelolaan ZIS (zakat, infak, sedekah).',
      },
      {
        judul: 'Koperasi Simpan Pinjam',
        isi: 'Dari anggota untuk anggota: simpanan pokok, wajib, dan sukarela; pinjaman, angsuran, dan SHU.',
      },
      {
        judul: 'Tabungan Santri & Wali',
        isi: 'Setor dan tarik, mutasi, serta saldo nontunai yang terhubung ke seluruh unit usaha pesantren.',
      },
      {
        judul: 'Pembiayaan & Angsuran',
        isi: 'Pengajuan, persetujuan berjenjang, jadwal angsuran, dan pengendalian tunggakan otomatis.',
      },
      {
        judul: 'e-Wallet Pesantren',
        isi: 'Dompet digital santri untuk pembayaran SPP, kantin, toko, dan layanan lain dalam satu saldo.',
      },
      {
        judul: 'Laporan & Tata Kelola',
        isi: 'Neraca, laba/SHU, laporan RAT, serta jejak audit untuk transparansi dan akuntabilitas.',
      },
    ],
  },
  {
    nomor: 5,
    nama: 'Unit Usaha & Marketplace Pesantren',
    ringkas:
      'Menyatukan seluruh gerai usaha pesantren dalam satu sistem kasir dan stok, sekaligus membuka pasar daring untuk produk dan jasa hasil pesantren.',
    butir: [
      {
        judul: 'Kasir (POS) Multi-Gerai',
        isi: 'Kantin, kafe, resto, toko, food court, dan gerai — satu sistem kasir untuk semua titik penjualan.',
      },
      {
        judul: 'Toko & Koperasi Pesantren',
        isi: 'Manajemen produk, harga, member, dan diskon, terhubung dengan tabungan atau e-wallet santri.',
      },
      {
        judul: 'Gudang & Stok Pusat–Cabang',
        isi: 'Persediaan antar-gerai, transfer stok, HPP otomatis, dan pengendalian minimum stok.',
      },
      {
        judul: 'Pembayaran Nontunai',
        isi: 'Saldo santri, kartu, dan QRIS — mengurangi peredaran uang tunai di lingkungan pondok.',
      },
      {
        judul: 'Marketplace Pesantren Online',
        isi: 'Menjual produk dan jasa hasil pesantren secara daring: pesan, bayar, dan antar dalam satu aplikasi.',
      },
      {
        judul: 'Laporan Penjualan & Laba',
        isi: 'Omzet, laba per unit usaha, produk terlaris, dan analisis penjualan untuk pengambilan keputusan.',
      },
    ],
  },
  {
    nomor: 6,
    nama: 'Back-Office & Tata Kelola',
    ringkas:
      'SDM, pengadaan, keuangan operasional, akuntansi, aset, persuratan, dan pengawasan internal — tertib, berjenjang, dan tertelusur.',
    butir: [
      {
        judul: 'SDM & Kepegawaian',
        isi: 'Biodata, absensi, cuti dan izin, payroll, rekrutmen, karier, kedisiplinan, serta asuransi dan BPJS.',
      },
      {
        judul: 'Pengadaan & Vendor',
        isi: 'Permintaan, seleksi vendor, purchase order, penerimaan barang, tagihan, hingga pembayaran vendor.',
      },
      {
        judul: 'Keuangan Operasional',
        isi: 'Uang muka dan kasbon, persetujuan berjenjang, LPJ dan penggantian, kas besar, serta kas kecil per unit.',
      },
      {
        judul: 'Akuntansi & Laporan',
        isi: 'Draf jurnal otomatis, posting, buku besar, laporan keuangan, hingga tutup buku.',
      },
      {
        judul: 'Aset & Inventaris',
        isi: 'Master aset, label QR, penyusutan, persediaan, pemeliharaan, peminjaman, opname, dan penghapusan.',
      },
      {
        judul: 'Persuratan & Arsip',
        isi: 'Surat masuk dan keluar, disposisi berjenjang, penomoran terpusat anti-ganda, broadcast, dan arsip digital.',
      },
      {
        judul: 'Audit & Pengawasan',
        isi: 'Perencanaan audit, temuan dan bukti, tindak lanjut, SPI, kanal pengaduan, serta dasbor kepatuhan dan risiko.',
      },
    ],
  },
  {
    nomor: 7,
    nama: 'Perpustakaan Manual & Digital',
    ringkas:
      'Mengelola koleksi pustaka pesantren — buku, kitab, dan jurnal — secara fisik maupun digital, dengan layanan mandiri melalui anjungan.',
    butir: [
      {
        judul: 'Katalog & Koleksi',
        isi: 'Pendataan buku, kitab, jurnal, dan bahan pustaka lengkap dengan klasifikasi serta pencarian.',
      },
      {
        judul: 'Sirkulasi Peminjaman',
        isi: 'Peminjaman dan pengembalian, perpanjangan, denda keterlambatan, serta kartu anggota.',
      },
      {
        judul: 'Perpustakaan Digital (e-Library)',
        isi: 'E-book dan kitab digital yang dapat dibaca daring oleh santri dan asatidz kapan saja.',
      },
      {
        judul: 'Keanggotaan Santri & SDM',
        isi: 'Pengelolaan anggota, hak pinjam, dan riwayat baca santri maupun pegawai.',
      },
      {
        judul: 'Statistik & Laporan',
        isi: 'Statistik kunjungan, buku terpopuler, dan laporan pemanfaatan perpustakaan.',
      },
      {
        judul: 'Layanan Mandiri Anjungan',
        isi: 'Penelusuran katalog dan peminjaman mandiri melalui anjungan perpustakaan.',
      },
    ],
  },
  {
    nomor: 8,
    nama: 'Anjungan Mandiri & Layanan Multi-Kanal',
    ringkas:
      'Setiap layanan dapat diakses dari kanal yang paling sesuai — termasuk anjungan mandiri yang aman bagi santri yang tidak diperkenankan membawa ponsel.',
    butir: [
      {
        judul: 'Anjungan Santri (Tanpa Ponsel)',
        isi: 'Cek saldo dan tabungan, nilai dan absensi, pengumuman, izin keluar–masuk, hingga pendaftaran santri baru — cukup dengan kartu santri atau RFID.',
      },
      {
        judul: 'Layanan Mandiri Santri',
        isi: 'Saldo, nilai, jadwal, izin, dan pengumuman melalui kartu atau RFID.',
      },
      {
        judul: 'Pendaftaran Santri Baru',
        isi: 'Anjungan PSB mandiri di lokasi, lengkap dengan cetak bukti pendaftaran.',
      },
      {
        judul: 'Izin & Absensi Gerbang',
        isi: 'Pencatatan keluar–masuk pondok secara otomatis dan terekam.',
      },
    ],
  },
];

/** Kanal tempat layanan dapat diakses. */
export const KANAL = ['Anjungan', 'Web', 'Desktop', 'Mobile', 'Tablet'] as const;

export const KECERDASAN_BUATAN: Butir[] = [
  {
    judul: 'Bantu susun perangkat ajar',
    isi: 'Membantu menyusun kurikulum, RPS atau silabus, soal, serta mengoreksi jawaban dengan umpan balik.',
  },
  {
    judul: 'Ringkas laporan & rekomendasi',
    isi: 'Membaca data lintas unit dan menyajikan ringkasan serta rekomendasi bagi pimpinan pesantren.',
  },
  {
    judul: 'Draf surat & pengumuman',
    isi: 'Menyusun draf surat, pengumuman, dan notulen secara cepat untuk kemudian disempurnakan.',
  },
  {
    judul: 'Kedaulatan data terjaga',
    isi: 'Model dapat berjalan di peladen pesantren; setiap keluaran berstatus usulan yang ditinjau manusia.',
  },
];

export const OPEN_API: Butir[] = [
  {
    judul: 'API terbuka & terdokumentasi',
    isi: 'Antarmuka RESTful berformat JSON yang terdokumentasi (OpenAPI/Swagger) dan siap diintegrasikan mitra mana pun.',
  },
  {
    judul: 'Keamanan standar industri',
    isi: 'OAuth 2.0, token JWT, kunci API, enkripsi TLS, tanda tangan digital, serta jejak audit pada setiap pertukaran data.',
  },
  {
    judul: 'Standar pembayaran & keuangan',
    isi: 'ISO 8583, ISO 20022, SNAP BI, dan QRIS untuk transaksi antar-lembaga.',
  },
  {
    judul: 'Standar nasional sektoral',
    isi: 'SATUSEHAT (HL7 FHIR) untuk kesehatan, Neo Feeder/SISTER untuk pendidikan, serta CEISA untuk kepabeanan.',
  },
  {
    judul: 'Pertukaran waktu-nyata',
    isi: 'Notifikasi berbasis peristiwa (webhook) menjaga sistem mitra selalu mutakhir tanpa penarikan data manual.',
  },
  {
    judul: 'Interoperabilitas luas',
    isi: 'Terhubung dengan perbankan, BMT dan koperasi syariah, fintech, e-commerce, serta instansi pemerintah.',
  },
];

export const KEUNGGULAN: Butir[] = [
  {
    judul: 'Satu ekosistem terpadu',
    isi: 'Semua unit dalam satu sistem dan satu data — tanpa aplikasi terpisah yang saling lepas.',
  },
  {
    judul: 'Teruji di 150+ institusi',
    isi: 'Bukan sekadar konsep; sudah dipakai luas di dunia pendidikan dan pesantren.',
  },
  {
    judul: 'Sesuai kultur pesantren',
    isi: 'Diniyah, tahfiz, keuangan syariah, dan kehidupan asrama terwadahi utuh.',
  },
  {
    judul: 'Multi-kanal & anjungan',
    isi: 'Termasuk anjungan mandiri yang aman bagi santri tanpa ponsel.',
  },
  {
    judul: 'Aman & berdaulat data',
    isi: 'Opsi peladen mandiri, hak akses berjenjang, dan jejak audit ketat.',
  },
  {
    judul: 'Pendampingan penuh',
    isi: 'Penerapan bertahap, pelatihan, dan dukungan berkelanjutan berbasis tiket.',
  },
];

export interface Tahap {
  nomor: number;
  nama: string;
  isi: string;
}

export const TAHAPAN: Tahap[] = [
  { nomor: 1, nama: 'Analisis', isi: 'Kajian kebutuhan dan proses pesantren.' },
  { nomor: 2, nama: 'Perancangan', isi: 'Konfigurasi dan rancangan sistem.' },
  { nomor: 3, nama: 'Penerapan', isi: 'Instalasi, migrasi data, dan uji coba.' },
  { nomor: 4, nama: 'Pelatihan', isi: 'Alih pengetahuan asatidz dan pengurus.' },
  { nomor: 5, nama: 'Go-Live', isi: 'Operasional dan pendampingan awal.' },
  { nomor: 6, nama: 'Pemeliharaan', isi: 'Dukungan dan pembaruan berkala.' },
];

/**
 * Harga penawaran bawaan.
 *
 * Bukan sumber kebenaran penagihan. Lihat catatan di kepala berkas ini.
 */
export const HARGA_PER_SANTRI = 2000;

export const KETENTUAN_HARGA: string[] = [
  'Dihitung dari santri berstatus aktif pada bulan berjalan. Santri yang sudah lulus atau keluar tidak dihitung.',
  'Ditagihkan satu tagihan per pondok, bukan per santri satu per satu.',
  'Sudah termasuk seluruh modul yang diaktifkan, pembaruan sistem, penyimpanan data, alamat situs pondok, dukungan tiket, dan pelatihan daring.',
  'Data contoh tidak pernah ditagihkan.',
  'Santri yang terdaftar pada lebih dari satu layanan tidak ditagihkan dua kali.',
  'Dapat berubah sesuai kesepakatan yang dituangkan pada perjanjian kerja sama.',
];

export const DI_LUAR_BIAYA: string[] = [
  'Perangkat keras: anjungan mandiri, mesin kasir, pemindai kartu atau RFID, printer, dan jaringan.',
  'Peladen mandiri (on-premise) bila pondok memilih tidak memakai layanan terkelola.',
  'Migrasi data dari sistem lama yang memerlukan penulisan ulang atau pembersihan besar.',
  'Pengembangan khusus di luar cakupan modul standar.',
  'Perjalanan dan akomodasi untuk pendampingan tatap muka di luar Jabodetabek.',
];

/** Kemitraan yang dicontohkan pada paparan kedua. */
export const MITRA_BMT = {
  nama: 'KSPPS BMT Nahdliyin Raudlatul Ulum (NyRU)',
  asal: 'Pondok Pesantren Raudlatul Ulum, Bojonegoro',
  semboyan: 'Solusi Keuangan Syariah untuk Umat',
  profil: [
    'Berbadan hukum koperasi (2025), berbasis pesantren.',
    'Visi: kemandirian ekonomi umat berbasis pesantren.',
    'Amanah, profesional, dan berkah — bebas riba.',
    'Aset ± Rp1,4 miliar dengan 362 anggota.',
    'Sasaran: santri, alumni, wali, dan usaha mikro.',
  ],
  produk: [
    'Simpanan Anggota',
    'Simpanan Haji & Umroh',
    'Simpanan Keluarga Nahdliyin Sejahtera (KNS)',
    'Tabungan Pendidikan, Idul Fitri & Qurban',
    'Pembiayaan syariah (mudharabah, murabahah)',
  ],
  unitUsaha: [
    'NyRU Mini Market',
    'NyRU Cafe Mini Bar (Coffee & Juice)',
    'NyRU Angkringan',
    'NyRU Siomay & Pentol',
  ],
} as const;

export const KOLABORASI_BMT: Butir[] = [
  {
    judul: 'Digitalisasi penuh BMT',
    isi: 'Core system koperasi syariah: simpanan, pembiayaan, angsuran, SHU, akuntansi, dan laporan RAT — beserta aplikasi anggota dan anjungan.',
  },
  {
    judul: 'Tabungan santri terhubung BMT',
    isi: 'Saldo dan uang saku santri ditopang rekening simpanan BMT; setor, tarik, dan mutasi tercatat rapi.',
  },
  {
    judul: 'Pembayaran SPP & kegiatan via BMT',
    isi: 'SPP, tagihan, dan iuran dibayar melalui BMT; rekonsiliasi berjalan otomatis tanpa entri ganda.',
  },
  {
    judul: 'Ekonomi nontunai unit usaha',
    isi: 'Santri berbelanja di kantin dan minimarket dengan saldo BMT; unit usaha masuk POS dan marketplace pesantren.',
  },
  {
    judul: 'Pembiayaan syariah ekosistem',
    isi: 'Pembiayaan usaha mikro santri, alumni, dan wali serta pembiayaan pendidikan, diajukan dan dipantau secara digital.',
  },
  {
    judul: 'Inklusi & literasi keuangan',
    isi: 'Pendaftaran anggota santri dan wali otomatis dari data ePesantren, disertai edukasi menabung sejak dini.',
  },
];

/**
 * Yang sudah dapat dipakai hari ini, dan yang belum.
 *
 * Dipisahkan dengan sengaja. Paparan menggambarkan tujuan akhir; dokumen
 * komersial yang tidak membedakan keduanya menjanjikan hal yang belum ada, dan
 * itu ditemukan pondok pada minggu pertama — bukan pada saat menandatangani.
 */
export const KESIAPAN_SEKARANG: string[] = [
  'Pendaftaran pondok mandiri beserta penyiapan alamat situs.',
  'Pengelolaan pengguna, peran, dan hak akses berjenjang.',
  'Kasir (POS) multi-gerai, gudang, dan stok.',
  'Keuangan dan akuntansi: jurnal, buku besar, dan laporan keuangan.',
  'Persuratan dengan penomoran terpusat.',
  'Koperasi simpan pinjam beserta RAT dan SHU.',
  'Marketplace dan katalog produk.',
];

export const KESIAPAN_BERTAHAP: string[] = [
  'Santri dan asrama, diniyah, tahfiz, serta perizinan keluar–masuk.',
  'Tagihan SPP, tabungan santri, dan e-wallet pesantren.',
  'Anjungan mandiri dan kartu RFID santri.',
  'Klinik pesantren dan rekam medis santri.',
  'Situs pondok yang dapat disunting sendiri beserta beritanya.',
  'Perpustakaan manual dan digital.',
];
