/**
 * Manfaat sistem bagi tiap bagian di pondok pesantren.
 *
 * ## Mengapa disusun per peran, bukan per modul
 *
 * Daftar modul menjawab pertanyaan "sistem ini punya apa". Yang ditanyakan
 * pengasuh, bendahara, dan wali santri berbeda: "apa yang berubah bagi saya".
 * Halaman yang hanya menjawab pertanyaan pertama membuat setiap pembaca harus
 * menerjemahkan sendiri — dan sebagian besar tidak melakukannya.
 *
 * ## Nada
 *
 * Ditulis dengan bahasa pesantren, bukan bahasa perangkat lunak. Tidak ada
 * "dashboard", "real-time", atau "integrasi". Yang ada: amanah, tertib,
 * tercatat, dapat dipertanggungjawabkan.
 *
 * ## Tentang kutipan
 *
 * Rujukan Al-Qur'an dan hadis yang dipakai hanya yang masyhur dan langsung
 * berkaitan dengan pencatatan, amanah, dan itqan. Tidak ada rujukan yang
 * dikarang, dan tidak ada nomor ayat yang ditulis tanpa yakin. Bila suatu
 * rujukan diragukan, ia dihapus — bukan diperkirakan.
 */

export interface Keutamaan {
  /** Kalimat pendek bernuansa keislaman yang membingkai manfaatnya. */
  nilai: string;
  /** Rujukan masyhur. Kosong bila tidak ada yang benar-benar pas. */
  rujukan?: string;
}

export interface ManfaatPeran {
  kode: string;
  /** Nama bagian sebagaimana disebut di pondok. */
  peran: string;
  /** Siapa saja yang termasuk. */
  untuk: string;
  /** Yang dirasakan berat hari ini. */
  keresahan: string;
  /** Yang berubah, dalam kalimat yang dapat dibayangkan. */
  manfaat: string[];
  keutamaan: Keutamaan;
}

export interface KelompokPeran {
  kode: string;
  nama: string;
  ringkas: string;
  peran: ManfaatPeran[];
}

/** Pembuka bernuansa keislaman untuk seluruh bagian ini. */
export const MUKADIMAH = {
  judul: 'Menjaga Amanah dengan Tertib',
  paragraf: [
    'Pondok pesantren adalah tempat amanah bertumpuk: amanah ilmu dari para guru, ' +
      'amanah anak dari wali santri, amanah harta dari umat, dan amanah nama baik ' +
      'yang dibangun bertahun-tahun. Semua itu dijaga bukan dengan niat baik saja, ' +
      'melainkan dengan catatan yang rapi dan dapat dipertanggungjawabkan.',
    'Al-Qur’an memerintahkan pencatatan bahkan untuk urusan utang-piutang antar dua ' +
      'orang. Apalagi urusan ratusan santri, puluhan asatidz, banyak unit usaha, dan ' +
      'dana umat yang dititipkan. Sistem ini tidak menggantikan keikhlasan; ia menjaga ' +
      'agar keikhlasan itu tidak tercoreng oleh selisih yang sebenarnya dapat dihindari.',
    'Yang kami bangun sederhana maksudnya: satu kali dicatat, dipakai bersama, ' +
      'dan setiap perubahan meninggalkan jejak. Dari situ lahir ketenangan — ' +
      'pengasuh tenang karena tahu keadaan, wali tenang karena mendapat kabar, ' +
      'dan pengurus tenang karena pekerjaannya dapat dibuktikan.',
  ],
  ayat: {
    teks:
      'Hai orang-orang yang beriman, apabila kamu bermuamalah tidak secara tunai ' +
      'untuk waktu yang ditentukan, hendaklah kamu menuliskannya.',
    rujukan: 'QS. Al-Baqarah: 282',
  },
} as const;

const ITQAN: Keutamaan = {
  nilai:
    'Pekerjaan yang dikerjakan dengan sungguh-sungguh dan rapi adalah pekerjaan yang dicintai.',
  rujukan: 'Makna hadis tentang itqan',
};

const AMANAH: Keutamaan = {
  nilai: 'Menyampaikan amanat kepada yang berhak menerimanya adalah perintah.',
  rujukan: 'QS. An-Nisa: 58',
};

const MENCATAT: Keutamaan = {
  nilai: 'Perintah menuliskan muamalah menjadi dasar tertib administrasi pondok.',
  rujukan: 'QS. Al-Baqarah: 282',
};

export const KELOMPOK_PERAN: KelompokPeran[] = [
  {
    kode: 'KEPEMIMPINAN',
    nama: 'Pimpinan dan Pengurus',
    ringkas:
      'Yang memikul tanggung jawab akhir atas seluruh pondok, dan yang menjalankan roda hariannya.',
    peran: [
      {
        kode: 'PIMPINAN',
        peran: 'Pengasuh dan Pimpinan Pondok',
        untuk: 'Pengasuh, wakil pengasuh, ketua yayasan, dan majelis pimpinan',
        keresahan:
          'Untuk mengetahui keadaan pondok, pimpinan harus menunggu laporan yang disusun berhari-hari, dan angkanya sering berbeda antara satu unit dengan unit lain.',
        manfaat: [
          'Keadaan pondok terbaca kapan saja: jumlah santri aktif, kehadiran, tunggakan, dan kegiatan yang sedang berjalan — tanpa perlu meminta rekap lebih dahulu.',
          'Angka yang dilihat pimpinan sama dengan angka yang dipakai bendahara dan kepala sekolah, sebab keduanya membaca catatan yang sama.',
          'Keputusan besar — menambah asrama, menaikkan biaya, membuka unit usaha — bersandar pada riwayat yang benar-benar tercatat, bukan pada perkiraan.',
          'Setiap persetujuan yang pimpinan berikan tersimpan beserta waktunya, sehingga tidak ada yang dapat dipersoalkan di kemudian hari.',
          'Amanah harta umat dapat dipertanggungjawabkan kepada pewakaf, donatur, dan wali santri dengan bukti, bukan dengan penjelasan lisan.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'PENGURUS',
        peran: 'Pengurus Harian',
        untuk: 'Ketua, sekretaris, bidang-bidang, dan kepala bagian',
        keresahan:
          'Pekerjaan menumpuk pada beberapa orang yang menguasai berkas, dan bila mereka berhalangan, urusan berhenti.',
        manfaat: [
          'Tugas dan wewenang tiap bagian jelas tertulis di dalam sistem, sehingga pekerjaan tidak bergantung pada satu orang yang hafal caranya.',
          'Persetujuan berjenjang berjalan di dalam sistem: yang mengajukan, yang memeriksa, dan yang menyetujui terpisah dan tercatat.',
          'Serah terima pengurus tidak lagi berarti memindahkan tumpukan map — pengurus baru langsung melihat riwayat lengkapnya.',
          'Rapat membahas keputusan, bukan mencocokkan angka, karena angkanya sudah sama sejak awal.',
          'Program kerja, anggaran, dan pertanggungjawabannya tersambung satu sama lain.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'YAYASAN',
        peran: 'Yayasan dan Pengawas',
        untuk: 'Pembina, pengawas, dan pengurus yayasan',
        keresahan:
          'Pengawasan dilakukan berkala dengan meminta berkas, dan yang diperiksa hanyalah yang sempat disiapkan.',
        manfaat: [
          'Pengawas dapat membaca laporan sendiri tanpa meminta disiapkan, dengan hak akses yang hanya membaca.',
          'Temuan pemeriksaan beserta tindak lanjutnya tercatat sampai tuntas, tidak berhenti pada catatan rapat.',
          'Perbandingan antarperiode dan antarunit tersedia tanpa menyusun ulang.',
          'Aset dan wakaf tercatat beserta lokasi, penanggung jawab, dan kondisinya.',
        ],
        keutamaan: AMANAH,
      },
    ],
  },
  {
    kode: 'OPERASIONAL',
    nama: 'Operasional Pondok',
    ringkas: 'Yang menjaga agar keseharian pondok berjalan tertib dari subuh hingga malam.',
    peran: [
      {
        kode: 'OPS_PONDOK',
        peran: 'Bagian Operasional Pondok',
        untuk: 'Kepala bagian rumah tangga, sarana prasarana, dan koordinator harian',
        keresahan:
          'Jadwal kegiatan, pemakaian ruang, dan permintaan perbaikan tersebar di banyak pesan dan kertas, sehingga sering bentrok atau terlupa.',
        manfaat: [
          'Jadwal kegiatan pondok tersusun di satu tempat, sehingga bentrok ruang dan waktu terlihat sebelum terjadi.',
          'Permintaan perbaikan tercatat beserta siapa yang menangani dan kapan selesai — tidak lagi hilang di tengah jalan.',
          'Kebutuhan barang habis pakai terpantau, sehingga tidak diketahui habis pada saat dibutuhkan.',
          'Aset pondok tercatat lengkap dengan lokasi dan penanggung jawabnya.',
          'Data santri, kamar, dan kegiatan berasal dari sumber yang sama dengan bagian lain.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'ASRAMA',
        peran: 'Kesantrian dan Pengasuhan Asrama',
        untuk: 'Koordinator asrama, musyrif, dan musyrifah',
        keresahan:
          'Penempatan kamar, catatan pembinaan, dan perkembangan santri tersimpan di buku tulis masing-masing pembina.',
        manfaat: [
          'Penempatan kamar dan asrama tercatat, sehingga mencari seorang santri tidak perlu bertanya berkeliling.',
          'Catatan pembinaan, pelanggaran, dan prestasi tersimpan rapi dan hanya dibaca yang berhak.',
          'Kehadiran pada kegiatan asrama dan ibadah tercatat, sehingga pembinaan berpijak pada kenyataan.',
          'Pergantian pembina tidak memutus riwayat santri yang dibinanya.',
          'Wali dapat diberi kabar perkembangan tanpa pembina menulis ulang satu per satu.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'DAPUR',
        peran: 'Dapur dan Konsumsi',
        untuk: 'Kepala dapur, juru masak, dan petugas konsumsi',
        keresahan:
          'Jumlah porsi ditaksir, bahan sering berlebih atau kurang, dan biayanya sulit dipertanggungjawabkan.',
        manfaat: [
          'Jumlah santri mukim yang benar-benar ada menjadi dasar perhitungan porsi.',
          'Pembelian bahan, pemakaian, dan sisanya tercatat sehingga biaya per santri dapat diketahui.',
          'Catatan alergi dan pantangan santri tersedia bagi yang berhak.',
          'Permintaan dan penerimaan bahan mengikuti alur pengadaan yang sama dengan unit lain.',
        ],
        keutamaan: MENCATAT,
      },
    ],
  },
  {
    kode: 'PENDIDIKAN',
    nama: 'Pendidikan',
    ringkas:
      'Sekolah formal, madrasah diniyah, tahfiz, dan kajian kitab — masing-masing dengan caranya sendiri.',
    peran: [
      {
        kode: 'SEKOLAH_FORMAL',
        peran: 'Operasional Sekolah Formal',
        untuk: 'Kepala sekolah, wakil kepala, tata usaha, dan panitia PPDB',
        keresahan:
          'Pendaftaran, presensi, nilai, dan tagihan dikerjakan di berkas yang berbeda-beda, dan menyusun rapor menjadi pekerjaan berminggu-minggu.',
        manfaat: [
          'Penerimaan santri baru berjalan daring: pendaftar mengisi sendiri, berkasnya masuk ke data sekolah tanpa diketik ulang.',
          'Kelas, rombongan belajar, jadwal, dan penugasan guru tersusun di satu tempat.',
          'Presensi tercatat harian dan langsung terlihat wali kelas.',
          'Nilai dikumpulkan dari guru masing-masing, lalu rapor tersusun tanpa disalin ulang.',
          'Tagihan SPP terbit massal, tunggakan terpantau, dan pembayarannya masuk sendiri.',
          'Laporan untuk dinas dan yayasan disusun dari data yang sama.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'DINIYAH',
        peran: 'Operasional Madrasah Diniyah dan Sekolah Pondok',
        untuk: 'Kepala madrasah diniyah, ustadz pengampu kitab, dan bagian kurikulum diniyah',
        keresahan:
          'Sistem sekolah umum tidak mengenal marhalah, halaqah, dan kajian kitab, sehingga diniyah selalu dicatat manual di luar sistem.',
        manfaat: [
          'Jenjang marhalah, halaqah, dan kelas diniyah dikelola tersendiri — tidak dipaksakan mengikuti bentuk sekolah umum.',
          'Kitab yang dikaji, capaian bab, dan penilaiannya tercatat sebagaimana kebiasaan pondok.',
          'Rapor diniyah terpisah dari rapor formal, dengan penilaian yang sesuai.',
          'Kehadiran pada pengajian bakda subuh dan bakda maghrib tercatat tanpa menambah pekerjaan ustadz.',
          'Santri yang bersekolah formal di luar pondok tetap terdata pada diniyahnya.',
        ],
        keutamaan: MENCATAT,
      },
      {
        kode: 'TAHFIZ',
        peran: 'Bagian Tahfiz dan Al-Qur’an',
        untuk: 'Koordinator tahfiz, ustadz dan ustadzah pembimbing hafalan',
        keresahan:
          'Setoran dan muraja’ah dicatat di buku mutaba’ah masing-masing santri, yang mudah hilang dan sulit direkap.',
        manfaat: [
          'Setoran dan muraja’ah tercatat per santri, lengkap dengan halaman, juz, dan penilaian tajwidnya.',
          'Capaian hafalan terlihat perkembangannya dari waktu ke waktu, bukan hanya angka terakhir.',
          'Wali menerima laporan hafalan anaknya tanpa perlu menunggu pertemuan.',
          'Pembimbing yang berganti tetap melihat riwayat lengkap santri yang diampunya.',
          'Ujian kenaikan juz dan wisuda hafalan tersusun dari catatan yang sudah ada.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'USTADZ',
        peran: 'Ustadz, Ustadzah, dan Guru',
        untuk: 'Pengajar formal, diniyah, tahfiz, dan pembimbing kegiatan',
        keresahan:
          'Waktu mengajar tersita pekerjaan tulis-menulis: absensi, nilai, rekap, dan laporan yang diminta berkali-kali dalam bentuk berbeda.',
        manfaat: [
          'Mengisi presensi dan nilai cukup sekali; rekap, rapor, dan laporan tersusun sendiri dari situ.',
          'Jadwal mengajar, kelas, dan santri binaan terlihat jelas tanpa bertanya ke tata usaha.',
          'Catatan perkembangan santri dapat ditulis singkat dan langsung sampai kepada yang berkepentingan.',
          'Honor mengajar dihitung dari kehadiran dan jam yang benar-benar tercatat.',
          'Waktu yang dahulu habis untuk menyalin kembali dapat dikembalikan kepada mengajar dan membina.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'PERPUSTAKAAN',
        peran: 'Perpustakaan',
        untuk: 'Pustakawan dan petugas perpustakaan pondok',
        keresahan:
          'Kitab dan buku dipinjam tanpa tercatat rapi, sehingga banyak yang tidak kembali dan tidak diketahui di mana.',
        manfaat: [
          'Katalog kitab, buku, dan jurnal tersusun beserta klasifikasinya.',
          'Peminjaman dan pengembalian tercatat, termasuk perpanjangan dan keterlambatan.',
          'Santri dapat menelusuri koleksi sendiri melalui anjungan, tanpa mengantre.',
          'Koleksi digital dapat dibaca santri dan asatidz kapan saja.',
          'Terlihat kitab mana yang paling dibaca, sebagai dasar penambahan koleksi.',
        ],
        keutamaan: MENCATAT,
      },
    ],
  },
  {
    kode: 'KESANTRIAN',
    nama: 'Santri dan Wali',
    ringkas: 'Yang menjadi tujuan seluruh pekerjaan ini.',
    peran: [
      {
        kode: 'WALI',
        peran: 'Wali Santri',
        untuk: 'Orang tua dan wali dari santri mukim maupun nonmukim',
        keresahan:
          'Kabar tentang anak datang sepotong-sepotong, dan untuk bertanya harus menghubungi pengurus yang belum tentu sempat menjawab.',
        manfaat: [
          'Perkembangan anak — kehadiran, nilai, hafalan, kesehatan, dan pembinaan — dapat dilihat sendiri kapan saja.',
          'Tagihan dan riwayat pembayaran jelas, tidak perlu bertanya berulang kali kepada bendahara.',
          'Pemberitahuan penting sampai langsung: izin pulang, sakit, kegiatan, dan pengumuman pondok.',
          'Uang saku dapat dikirim tanpa membawa tunai, dan pemakaiannya terlihat.',
          'Batas belanja harian anak dapat diatur wali, sehingga tidak berlebihan.',
          'Wali hanya melihat data anaknya sendiri, bukan data santri lain.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'SANTRI_MUKIM',
        peran: 'Santri Mukim',
        untuk: 'Santri yang tinggal di asrama pondok',
        keresahan:
          'Untuk mengetahui saldo, nilai, atau jadwal, santri harus mengantre bertanya kepada pengurus — sementara ponsel tidak diperkenankan.',
        manfaat: [
          'Anjungan mandiri di pondok dapat dibuka dengan kartu santri: saldo, nilai, jadwal, dan pengumuman.',
          'Mengajukan izin pulang atau keluar dapat dilakukan sendiri, dan santri tahu di tahap mana persetujuannya.',
          'Belanja di kantin dan koperasi memakai saldo, sehingga tidak perlu membawa uang tunai.',
          'Capaian hafalan dan nilai dapat dilihat sendiri, menjadi dorongan memperbaiki.',
          'Menelusuri kitab di perpustakaan dan meminjam sendiri lewat anjungan.',
          'Semua itu tanpa ponsel — sesuai aturan pondok.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'SANTRI_KALONG',
        peran: 'Santri Nonmukim (Kalong)',
        untuk: 'Santri yang tinggal di rumah dan datang mengaji ke pondok',
        keresahan:
          'Santri yang tidak menginap sering terlewat dari pendataan, padahal kewajiban mengaji dan biayanya sama.',
        manfaat: [
          'Terdata sebagaimana santri mukim, dengan pembeda pada status tinggal dan komponen biayanya.',
          'Kehadiran pada pengajian tercatat, sehingga tidak dianggap tidak ikut hanya karena tidak menginap.',
          'Nilai, hafalan, dan pembinaan tercatat sama lengkapnya.',
          'Tagihan disesuaikan komponennya — tanpa biaya asrama dan konsumsi bila memang tidak dipakai.',
          'Wali tetap menerima kabar perkembangan yang sama.',
          'Kedatangan dan kepulangan harian tercatat di gerbang, menjadi ketenangan bagi wali.',
        ],
        keutamaan: MENCATAT,
      },
      {
        kode: 'ALUMNI',
        peran: 'Alumni dan Ikatan Alumni',
        untuk: 'Pengurus ikatan alumni dan bagian hubungan alumni',
        keresahan:
          'Setelah lulus, jejak santri terputus; data alumni hanya tersimpan di ingatan beberapa pengurus.',
        manfaat: [
          'Riwayat santri tetap tersimpan setelah lulus, menjadi data alumni yang sah.',
          'Penelusuran alumni per angkatan, daerah, dan bidang menjadi mungkin.',
          'Undangan haul, reuni, dan penggalangan dana dapat disampaikan tanpa menyusun daftar dari awal.',
          'Alumni dapat menjadi donatur, pembina, atau mitra unit usaha dengan riwayat yang jelas.',
        ],
        keutamaan: AMANAH,
      },
    ],
  },
  {
    kode: 'KEUANGAN',
    nama: 'Keuangan dan Usaha',
    ringkas:
      'Yang memegang harta pondok — bagian paling sering dipertanyakan, dan paling perlu bukti.',
    peran: [
      {
        kode: 'BENDAHARA',
        peran: 'Bendahara dan Bagian Keuangan',
        untuk: 'Bendahara pondok, bendahara unit, kasir, dan staf keuangan',
        keresahan:
          'Uang masuk dari banyak pintu — SPP, kantin, koperasi, sumbangan — dan mencocokkannya di akhir bulan memakan waktu berhari-hari, kadang tetap selisih.',
        manfaat: [
          'Setiap penerimaan tercatat pada saat terjadi, beserta siapa yang menerimanya.',
          'Tagihan SPP dan iuran terbit massal; pembayaran yang masuk mencocokkan dirinya sendiri.',
          'Kas besar dan kas kecil tiap unit terpisah dan terpantau saldonya.',
          'Uang muka kegiatan, pertanggungjawaban, dan penggantiannya berjalan berjenjang dan tercatat.',
          'Jurnal terbentuk dari transaksi yang sudah ada, bukan diketik ulang di akhir periode.',
          'Laporan keuangan, neraca, dan arus kas tersusun tepat waktu — siap dipertanggungjawabkan kepada pimpinan dan umat.',
          'Yang mencatat, yang menyetujui, dan yang merekonsiliasi adalah orang berbeda, sehingga tidak ada yang menanggung curiga sendirian.',
        ],
        keutamaan: MENCATAT,
      },
      {
        kode: 'UNIT_USAHA',
        peran: 'Unit Usaha Pondok dan UMKM',
        untuk: 'Pengelola kantin, minimarket, koperasi, kafe, laundry, dan usaha binaan santri',
        keresahan:
          'Tiap gerai mencatat sendiri dengan cara sendiri, sehingga untung ruginya tidak pernah benar-benar diketahui.',
        manfaat: [
          'Satu sistem kasir untuk seluruh gerai — kantin, toko, kafe, hingga koperasi.',
          'Stok terpantau antar gerai dan gudang pusat, termasuk pemindahannya.',
          'Santri membayar dengan saldo, sehingga uang tunai berkurang di lingkungan pondok.',
          'Laba per gerai terlihat, begitu pula barang yang paling laku dan yang tidak bergerak.',
          'Penjualan langsung masuk pembukuan pondok tanpa dicatat dua kali.',
          'Produk hasil pondok dan UMKM binaan dapat dijual daring, memperluas pasar di luar pondok.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'BMT',
        peran: 'BMT dan Koperasi Syariah',
        untuk: 'Pengurus BMT, koperasi simpan pinjam, dan bagian ZIS',
        keresahan:
          'Simpanan, pembiayaan, dan bagi hasil dicatat manual, sementara anggota bertambah dan RAT menuntut laporan yang rapi.',
        manfaat: [
          'Simpanan dan pembiayaan berakad syariah tercatat beserta perhitungan bagi hasilnya.',
          'Angsuran terjadwal dan tunggakan terpantau tanpa menelusuri buku satu per satu.',
          'Zakat, infak, dan sedekah tercatat terpisah, dapat dipertanggungjawabkan kepada pemberinya.',
          'Laporan RAT dan pembagian SHU tersusun dari catatan yang sudah ada.',
          'Tabungan santri dapat ditopang rekening di BMT, sehingga dana berputar di dalam lingkungan pondok sendiri.',
        ],
        keutamaan: MENCATAT,
      },
      {
        kode: 'PENGADAAN',
        peran: 'Pengadaan dan Perlengkapan',
        untuk: 'Bagian pengadaan, logistik, dan gudang',
        keresahan:
          'Pembelian dilakukan berdasarkan permintaan lisan, harga tidak dibandingkan, dan bukti sering tidak lengkap saat diperiksa.',
        manfaat: [
          'Permintaan dari tiap unit masuk tertulis, lengkap dengan alasan dan anggarannya.',
          'Perbandingan penawaran dan pemilihan penyedia tercatat, bukan diputuskan tanpa jejak.',
          'Penerimaan barang diperiksa mutu dan jumlahnya sebelum masuk gudang.',
          'Tagihan penyedia dicocokkan dengan pesanan dan bukti penerimaan.',
          'Riwayat harga dan kinerja penyedia tersimpan untuk pembelian berikutnya.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'SDM',
        peran: 'Kepegawaian dan Penggajian',
        untuk: 'Bagian SDM, kepegawaian, dan penggajian',
        keresahan:
          'Data asatidz dan pegawai tersebar, kehadiran dicatat manual, dan penghitungan honor memakan waktu setiap bulan.',
        manfaat: [
          'Data pegawai, kontrak, dan dokumennya tersimpan dalam satu berkas digital.',
          'Kehadiran, keterlambatan, cuti, dan izin tercatat dan terekap sendiri.',
          'Honor mengajar dihitung dari jam yang benar-benar tercatat, bukan dari ingatan.',
          'Slip gaji digital dapat diterima masing-masing tanpa dibagikan satu per satu.',
          'Kenaikan jenjang, pembinaan, dan data BPJS tersimpan rapi.',
        ],
        keutamaan: ITQAN,
      },
    ],
  },
  {
    kode: 'LAYANAN',
    nama: 'Layanan dan Keamanan',
    ringkas: 'Yang berjaga di pintu, di klinik, dan di jalur keluar-masuknya santri.',
    peran: [
      {
        kode: 'PERIZINAN',
        peran: 'Perizinan, Gerbang, dan Keamanan',
        untuk: 'Petugas perizinan, penyetuju izin, petugas gerbang, dan satuan keamanan',
        keresahan:
          'Izin keluar ditulis di buku, mudah dipalsukan, dan tidak ada yang benar-benar tahu berapa santri sedang berada di luar.',
        manfaat: [
          'Pengajuan izin berjalan berjenjang: wali kelas, pembina asrama, hingga penyetuju — masing-masing tercatat.',
          'Petugas gerbang cukup memeriksa: santri ini berizin atau tidak, sampai kapan, dan siapa penjemputnya.',
          'Kepulangan dan kedatangan tercatat otomatis, sehingga selalu diketahui siapa yang sedang di luar.',
          'Wali menerima pemberitahuan saat anaknya keluar dan saat kembali — ketenangan yang selama ini sulit diberikan.',
          'Buku tamu daring: kunjungan dan jadwal besuk terdaftar sebelum hari H, tidak menumpuk di akhir pekan.',
          'Petugas gerbang tidak dapat mengubah persetujuan izin — kewenangannya terpisah, sehingga tidak ada yang dapat menekan mereka.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'KESEHATAN',
        peran: 'Klinik dan Poskestren',
        untuk: 'Perawat pondok, dokter, petugas poskestren, dan bagian kesehatan santri',
        keresahan:
          'Riwayat sakit santri tidak tersimpan, sehingga penanganan berulang dimulai dari nol dan wali sering terlambat diberi tahu.',
        manfaat: [
          'Riwayat kesehatan tiap santri tersimpan: keluhan, pemeriksaan, dan tindakan.',
          'Stok dan pemakaian obat terpantau, sehingga tidak diketahui habis saat dibutuhkan.',
          'Wali diberi tahu ketika anaknya sakit atau dirujuk, beserta perkembangannya.',
          'Surat rujukan ke rumah sakit terbit lengkap dengan riwayat yang perlu dibawa.',
          'Pemeriksaan berkala dan imunisasi terjadwal, tidak menunggu ada yang sakit.',
          'Data kesehatan hanya dibaca petugas kesehatan — bukan seluruh pengurus.',
        ],
        keutamaan: AMANAH,
      },
      {
        kode: 'DAKWAH',
        peran: 'Bagian Dakwah dan Kemasyarakatan',
        untuk: 'Bagian dakwah, pengajian umum, majelis taklim, dan pengabdian masyarakat',
        keresahan:
          'Jadwal penceramah, undangan, dan jangkauan dakwah dikelola manual, sehingga sulit menilai apa yang sudah dicapai.',
        manfaat: [
          'Jadwal pengajian, penceramah, dan tempatnya tersusun rapi dan tidak bentrok.',
          'Undangan dan pengumuman dapat disebar sekaligus ke wali, alumni, dan jamaah.',
          'Kegiatan pengabdian santri di masyarakat tercatat sebagai bagian dari pembinaan.',
          'Situs pondok menjadi kanal dakwah: berita, kajian, dan agenda dapat ditulis sendiri tanpa bergantung pihak lain.',
          'Materi kajian dan rekamannya terarsip, dapat dibaca kembali kapan saja.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'HUMAS',
        peran: 'Humas, Media, dan Penerimaan Santri Baru',
        untuk: 'Bagian humas, pengelola media sosial, dan panitia PSB',
        keresahan:
          'Calon wali bertanya lewat banyak jalur, jawabannya berbeda-beda, dan pendaftar yang sudah menghubungi sering terlewat.',
        manfaat: [
          'Situs pondok menjadi sumber keterangan resmi: profil, program, biaya, dan alur pendaftaran.',
          'Pendaftar dari situs langsung masuk ke data pondok, bukan ke kotak surel yang harus disalin ulang.',
          'Berita dan galeri kegiatan ditulis dan diterbitkan pengurus sendiri, tanpa menunggu siapa pun.',
          'Naskah diperiksa sebelum terbit — penulis dan penerbit adalah peran yang terpisah.',
          'Pertanyaan calon wali tercatat dan dapat ditindaklanjuti, tidak hilang di antara pesan masuk.',
        ],
        keutamaan: ITQAN,
      },
      {
        kode: 'PERSURATAN',
        peran: 'Tata Usaha dan Persuratan',
        untuk: 'Kepala tata usaha, petugas arsip, dan sekretariat',
        keresahan:
          'Nomor surat mudah ganda, disposisi berhenti di meja, dan arsip lama sulit ditemukan saat dibutuhkan.',
        manfaat: [
          'Penomoran surat terpusat dan tidak mungkin ganda.',
          'Surat masuk terdistribusi ke unit terkait beserta disposisinya, dan tindak lanjutnya terpantau.',
          'Surat keluar disusun dari template dan melewati persetujuan sebelum dikirim.',
          'Arsip digital dapat dicari dalam hitungan detik, termasuk surat bertahun-tahun lalu.',
          'Surat keterangan santri dapat diterbitkan cepat karena datanya sudah ada.',
        ],
        keutamaan: MENCATAT,
      },
      {
        kode: 'KONSELING',
        peran: 'Bimbingan dan Konseling Santri',
        untuk: 'Konselor, guru BK, dan pembina kedisiplinan',
        keresahan:
          'Catatan pendampingan bersifat pribadi dan tidak berkesinambungan, sehingga santri yang perlu perhatian sering terlambat diketahui.',
        manfaat: [
          'Catatan pendampingan tersimpan berkesinambungan, hanya dibaca yang berhak.',
          'Tanda-tanda yang perlu perhatian — kehadiran menurun, pelanggaran berulang — terlihat lebih awal.',
          'Riwayat pembinaan menjadi dasar keputusan yang adil, bukan keputusan berdasarkan kejadian terakhir saja.',
          'Koordinasi dengan wali, pembina asrama, dan wali kelas berjalan di atas catatan yang sama.',
        ],
        keutamaan: AMANAH,
      },
    ],
  },
];

/** Seluruh peran, mendatar. Dipakai menghitung dan menguji. */
export const SELURUH_PERAN: ManfaatPeran[] = KELOMPOK_PERAN.flatMap((k) => k.peran);
