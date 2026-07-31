/**
 * Isi naskah penawaran eBisnis — sumber tunggal untuk Beranda, Presentasi,
 * Proposal, Draft PKS, dan Draft Surat Penawaran.
 *
 * Disatukan di satu berkas dengan sengaja. Kelima halaman itu menyebutkan angka
 * yang sama (tarif POS, paket modul pusat, biaya implementasi). Bila masing-masing
 * menyimpan salinannya sendiri, cepat atau lambat satu di antaranya tertinggal
 * saat harga berubah — dan penyewa membaca dua angka berbeda untuk hal yang sama.
 *
 * Satu hal yang perlu dijaga saat menyunting berkas ini: **pisahkan yang sudah
 * berjalan dari yang masih rencana.** Setiap butir kemampuan memakai medan
 * `tahap`, dan halaman menampilkannya apa adanya. Menjanjikan yang belum ada
 * sebagai yang sudah ada merugikan penyewa yang mengambil keputusan berdasarkan
 * halaman ini, dan pada akhirnya merugikan kita sendiri.
 */

export type Tahap = 'BERJALAN' | 'DIBANGUN' | 'RENCANA';

export interface Kemampuan {
  judul: string;
  isi: string;
  tahap: Tahap;
}

export interface KelompokKemampuan {
  kode: string;
  judul: string;
  ringkas: string;
  ikon: string;
  butir: Kemampuan[];
}

// --------------------------------------------------------------- Masalah

export const MASALAH = [
  {
    judul: 'Stok tidak sinkron antar cabang',
    isi:
      'Pencatatan manual per lokasi membuat stok pusat dan cabang mudah selisih tanpa ' +
      'disadari. Selisihnya baru ketahuan saat opname — berbulan-bulan sesudah kejadiannya, ' +
      'ketika penyebabnya sudah tidak dapat ditelusuri lagi.',
  },
  {
    judul: 'Dua kasir menjual stok yang sama',
    isi:
      'Tanpa validasi stok yang ketat di sisi server, dua transaksi bersamaan di outlet ' +
      'berbeda dapat menjual barang terakhir yang sama sampai stok minus. Pembeli kedua ' +
      'sudah membayar sesuatu yang tidak ada barangnya.',
  },
  {
    judul: 'HPP ditebak, bukan dihitung',
    isi:
      'Harga pokok produk racikan sering diketik manual berdasarkan taksiran. Margin laba ' +
      'yang dilaporkan ke pimpinan pun ikut menjadi taksiran — dan keputusan harga jual ' +
      'diambil di atas angka yang tidak benar.',
  },
  {
    judul: 'Jurnal terpisah dari transaksi',
    isi:
      'Posting akuntansi disusun ulang secara manual dari rekap penjualan. Setiap penyusunan ' +
      'ulang adalah kesempatan baru untuk salah ketik, dan jurnalnya tidak dapat ditelusuri ' +
      'balik ke dokumen sumbernya.',
  },
];

export const SESUDAH = [
  'Satu basis data gudang-pusat-cabang yang terkonsolidasi, diakses sesuai hak akses masing-masing peran.',
  'Validasi stok di sisi server dengan penguncian baris, sehingga penjualan bersamaan tidak dapat melampaui stok riil.',
  'HPP produk racikan dihitung otomatis dari rollup biaya bahan baku resep, bukan angka yang diketik.',
  'Jurnal akuntansi terbentuk otomatis dari transaksi, setiap barisnya tertelusur ke dokumen sumbernya.',
];

// ------------------------------------------------------------- Kemampuan

export const KELOMPOK_KEMAMPUAN: KelompokKemampuan[] = [
  {
    kode: 'POS',
    judul: 'Kasir (POS) multi-outlet',
    ringkas: 'Satu sistem kasir untuk banyak outlet, dengan katalog, diskon, dan pajak yang konsisten.',
    ikon: 'store',
    butir: [
      {
        judul: 'Struktur data penjualan dan shift',
        isi:
          'Tabel penjualan, baris penjualan, pembayaran, shift kasir, dan pergerakan kas ' +
          'sudah ada di dalam skema setiap penyewa.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Layar kasir web',
        isi:
          'Pencarian produk, pemindaian barcode, keranjang, pembayaran, dan cetak struk. ' +
          'Sedang dikerjakan sebagai jalur kritis — ini pekerjaan utama kami saat ini.',
        tahap: 'DIBANGUN',
      },
      {
        judul: 'Validasi stok anti-jual-ganda',
        isi:
          'Pengecekan ketersediaan dilakukan di sisi server dengan penguncian baris data, ' +
          'sehingga dua kasir yang bertransaksi bersamaan tidak dapat menjual stok terakhir ' +
          'yang sama.',
        tahap: 'DIBANGUN',
      },
      {
        judul: 'Shift kasir dan rekonsiliasi kas',
        isi:
          'Buka/tutup kas per shift, pencatatan kas masuk-keluar, penghitungan kas akhir, ' +
          'dan pencatatan selisih beserta alasannya.',
        tahap: 'DIBANGUN',
      },
      {
        judul: 'Mode luring (offline-first)',
        isi:
          'Kasir tetap melayani saat internet terputus, transaksi diantre di perangkat dan ' +
          'tersinkron otomatis begitu koneksi pulih.',
        tahap: 'RENCANA',
      },
    ],
  },
  {
    kode: 'GUDANG',
    judul: 'Gudang dan persediaan',
    ringkas: 'Hierarki pusat-cabang dengan buku besar pergerakan stok yang dapat diaudit.',
    ikon: 'warehouse',
    butir: [
      {
        judul: 'Hierarki gudang pusat-cabang',
        isi:
          'Struktur induk-anak antar gudang, dengan pemantauan stok per lokasi fisik dan ' +
          'laporan yang dapat digulung (rollup) ke seluruh hierarki.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Buku besar pergerakan stok',
        isi:
          'Setiap stok masuk, keluar, transfer, dan penyesuaian tercatat. Tidak ada ' +
          'perubahan stok yang senyap — setiap perubahan tertelusur ke dokumen sumbernya.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Permintaan barang sampai penerimaan',
        isi:
          'Alur Permintaan Barang → Pesanan Pembelian → Penerimaan Barang → Backorder → ' +
          'Transfer Antar Gudang sudah berjalan penuh, lengkap dengan pohon stok.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Stok opname',
        isi: 'Rekonsiliasi hasil hitung fisik terhadap catatan sistem, dengan penyesuaian yang tervalidasi.',
        tahap: 'DIBANGUN',
      },
    ],
  },
  {
    kode: 'AKUNTANSI',
    judul: 'HPP dan akuntansi',
    ringkas: 'Jurnal terbentuk dari transaksi, bukan disusun ulang secara manual.',
    ikon: 'calculator',
    butir: [
      {
        judul: 'Bagan akun yang dapat dikonfigurasi',
        isi:
          'Kode akun tidak dikunci baku di dalam program. Setiap penyewa menyesuaikannya ' +
          'dengan struktur akuntansinya sendiri.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Accounting event dari dokumen',
        isi:
          'Setiap dokumen transaksi membentuk peristiwa akuntansi yang tertelusur balik ke ' +
          'dokumen sumbernya — tidak ada jurnal tanpa asal-usul.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'HPP otomatis dari resep',
        isi:
          'Harga pokok produk racikan dihitung dengan menggulung (rollup) harga seluruh ' +
          'bahan baku penyusunnya, bukan angka yang diketik manual.',
        tahap: 'DIBANGUN',
      },
    ],
  },
  {
    kode: 'TOKO_ONLINE',
    judul: 'Toko online dan marketplace',
    ringkas: 'Etalase daring dengan domain sendiri, dari katalog sampai pembayaran.',
    ikon: 'shopping-cart',
    butir: [
      {
        judul: 'Toko online berdomain sendiri',
        isi:
          'Setiap penyewa memperoleh etalase daring yang dapat memakai domainnya sendiri ' +
          'setelah domain itu diverifikasi kepemilikannya.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Listing produk dan gerbang tiga gambar',
        isi:
          'Produk tidak dapat diterbitkan sebelum memiliki sekurang-kurangnya tiga gambar. ' +
          'Aturan ini menjaga mutu etalase, bukan sekadar anjuran.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Keranjang dan checkout',
        isi: 'Pembeli, keranjang, dan checkout per kelompok penjual sudah berjalan.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Pembayaran daring',
        isi:
          'Terhubung ke penyedia pembayaran resmi. Checkout hanya aktif setelah akun ' +
          'pembayaran penyewa berstatus aktif — tidak ada checkout yang menampung uang ke ' +
          'rekening yang belum jelas.',
        tahap: 'BERJALAN',
      },
    ],
  },
  {
    kode: 'TATA_KELOLA',
    judul: 'Tata kelola, audit, dan hak akses',
    ringkas: 'Siapa boleh melihat apa, dan apa yang terjadi pada setiap data.',
    ikon: 'shield',
    butir: [
      {
        judul: 'Hak akses berjenjang dan pemisahan wewenang',
        isi:
          '133 menu dengan hak akses per aksi, cakupan data per pengguna, dan aturan ' +
          'pemisahan wewenang yang mencegah satu orang menyetujui pekerjaannya sendiri.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Jejak audit yang hanya bisa bertambah',
        isi:
          'Setiap perubahan data tercatat: siapa, kapan, dari peran mana, dan apa yang ' +
          'berubah. Catatan audit tidak dapat disunting maupun dihapus, termasuk oleh ' +
          'administrator penyewa.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Pemisahan data antar penyewa',
        isi:
          'Setiap penyewa menempati skema basis datanya sendiri. Pemisahannya berada di ' +
          'lapisan basis data, bukan sekadar penyaringan pada kueri.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Tata kelola surat',
        isi:
          'Penomoran surat resmi yang dijamin tidak kembar bahkan di bawah permintaan ' +
          'bersamaan, dengan alur terbit dan pembatalan yang terekam.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Pemantauan galat dan kinerja',
        isi:
          'Catatan galat, kinerja, aktivitas menu, dan riwayat masuk terkumpul terpusat ' +
          'untuk pengelola platform.',
        tahap: 'BERJALAN',
      },
    ],
  },
  {
    kode: 'AI',
    judul: 'Asisten AI yang tahu batasnya',
    ringkas: 'Membantu membaca data dan menyusun konsep — tidak pernah memutuskan.',
    ikon: 'sparkles',
    butir: [
      {
        judul: 'Copilot dengan bukti',
        isi:
          'Setiap jawaban disertai potongan data yang menjadi dasarnya, sehingga dapat ' +
          'diperiksa. Jawaban tanpa bukti ditandai sebagai jawaban tanpa bukti.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Delapan belas keperluan per modul',
        isi:
          'Ringkasan kinerja, analisis penjualan, konsep balasan pelanggan, perbandingan ' +
          'penawaran pemasok, analisis stok, dan lainnya — masing-masing terikat pada menu ' +
          'dan hak akses yang sesuai.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Data tidak keluar dari server',
        isi:
          'Model bahasa dijalankan pada server milik sendiri. Data penyewa tidak dikirim ke ' +
          'layanan AI pihak ketiga mana pun.',
        tahap: 'BERJALAN',
      },
      {
        judul: 'Batas kewenangan yang tegas',
        isi:
          'AI tidak dapat melakukan pembayaran, memposting jurnal, menyetujui apa pun, ' +
          'menghapus data, maupun mengubah hak akses. Keluarannya konsep dan analisis; ' +
          'keputusan tetap pada manusia.',
        tahap: 'BERJALAN',
      },
    ],
  },
];

// ------------------------------------------------------- Aplikasi pendamping

export const APLIKASI_KLIEN = [
  {
    nama: 'POS Kasir Desktop (Windows)',
    isi:
      'Kasir andal di meja kasir utama, tetap melayani pembeli walau internet putus. ' +
      'Layar Pelanggan kedua (dual monitor) menampilkan rincian belanja langsung ke pembeli, ' +
      'pembayaran saldo member dengan verifikasi PIN, top-up saldo dari kasir, lebih dari ' +
      '150 laporan siap pakai, dan pembaruan aplikasi otomatis.',
    repo: 'ais-pos-kasir-desktop',
  },
  {
    nama: 'POS Kasir Android (tablet & HP)',
    isi:
      'Mesin kasir dalam genggaman — satu aplikasi yang tampilannya menyesuaikan otomatis, ' +
      'cocok untuk tablet sebagai kasir tetap maupun HP biasa untuk kasir keliling. Mencetak ' +
      'struk ke printer thermal Bluetooth portable dan tetap dapat berjualan tanpa sinyal.',
    repo: 'ais-pos-kasir-android',
  },
  {
    nama: 'Stok Opname Android',
    isi:
      'Perhitungan stok fisik ala supermarket — memindai barcode via pemindai/PDT genggam ' +
      '(plug-and-play) atau kamera HP bila alat pemindai tidak tersedia, hasil langsung ' +
      'tersinkron. Sengaja fokus pada satu tugas saja agar tim lapangan cepat mahir.',
    repo: 'ais-stok-opname-android',
  },
];

// ------------------------------------------------------------- Pembanding

/**
 * Perbandingan dengan produk sejenis.
 *
 * Ditulis sebagai perbedaan pendekatan, bukan sebagai serangan kepada produk
 * tertentu. Setiap baris harus dapat kita pertanggungjawabkan bila ditanya
 * "buktinya mana?" — karena penyewa yang membandingkan biasanya juga sedang
 * membaca halaman pesaing.
 */
export const PEMBANDING = [
  {
    aspek: 'Perhitungan HPP',
    umum: 'Diketik manual sebagai satu angka per produk.',
    kami: 'Digulung otomatis dari harga bahan baku resep, ikut berubah saat harga bahan berubah.',
    mengapa:
      'HPP yang diketik akan tertinggal begitu harga bahan naik, dan margin yang dilaporkan ' +
      'ke pimpinan menjadi angka yang tidak benar tanpa ada yang menyadarinya.',
  },
  {
    aspek: 'Bagi hasil investor',
    umum: 'Dihitung dari omzet kotor, dengan persentase yang dikunci di dalam program.',
    kami: 'Dihitung dari laba bersih setelah HPP, biaya operasional, penyusutan, dan pajak; persentase dikonfigurasi per perjanjian.',
    mengapa:
      'Bagi hasil dari omzet kotor membagi uang yang belum tentu ada. Karena itulah fondasi ' +
      'HPP dan akuntansi dibangun lebih dahulu — angka yang benar dulu, baru distribusinya.',
  },
  {
    aspek: 'Pemisahan data antar penyewa',
    umum: 'Satu tabel bersama, dipisahkan oleh kolom penyewa pada setiap kueri.',
    kami: 'Satu skema basis data per penyewa; nama skema hanya berasal dari daftar resmi, tidak pernah dari permintaan pengguna.',
    mengapa:
      'Pada model satu tabel bersama, satu kueri yang lupa menyaring sudah cukup untuk ' +
      'membocorkan data penyewa lain. Pemisahan di lapisan basis data tidak bergantung pada ' +
      'ketelitian setiap kueri.',
  },
  {
    aspek: 'Jejak audit',
    umum: 'Tabel log yang dapat disunting atau dihapus administrator.',
    kami: 'Catatan audit hanya dapat bertambah, dipasang di lapisan basis data, tidak dapat disunting siapa pun.',
    mengapa:
      'Jejak audit yang dapat disunting oleh pihak yang diaudit tidak membuktikan apa-apa ' +
      'ketika benar-benar dibutuhkan.',
  },
  {
    aspek: 'Asisten AI',
    umum: 'Dikirim ke layanan AI pihak ketiga; jawaban tampil tanpa dasar yang dapat diperiksa.',
    kami: 'Model dijalankan di server sendiri; setiap jawaban disertai bukti data, dan AI tidak berwenang mengambil tindakan apa pun.',
    mengapa:
      'Data penjualan dan pelanggan adalah aset penyewa. Dan jawaban AI yang tidak dapat ' +
      'diperiksa asal-usulnya lebih berbahaya daripada tidak ada jawaban sama sekali.',
  },
  {
    aspek: 'Data saat berhenti berlangganan',
    umum: 'Sering tidak diatur, atau ekspor dikenai biaya tersendiri.',
    kami: 'Seluruh basis data diserahkan dalam format standar (SQL/CSV/Excel) sebelum akses ditutup — diatur dalam perjanjian.',
    mengapa:
      'Penyewa yang tidak dapat membawa datanya pergi sebenarnya tidak pernah benar-benar ' +
      'memiliki data itu.',
  },
  {
    aspek: 'Bahasa antarmuka',
    umum: 'Umumnya satu atau dua bahasa.',
    kami: 'Indonesia, Inggris, Arab (kanan-ke-kiri), dan Mandarin — termasuk arah teks yang menyesuaikan.',
    mengapa: 'Unit usaha pesantren dan usaha dengan staf lintas negara tidak perlu berkompromi soal bahasa.',
  },
];

// ---------------------------------------------------------------- Harga

export const TARIF_POS = [
  { jenjang: '1 – 5 outlet', pertama: 249_000, tambahan: 99_000 },
  { jenjang: '6 – 20 outlet', pertama: 225_000, tambahan: 85_000 },
  { jenjang: '21 – 50 outlet', pertama: 199_000, tambahan: 75_000 },
  { jenjang: 'Lebih dari 50 outlet', pertama: 175_000, tambahan: 60_000, mulai: true },
];

export const TERMASUK_POS = [
  'transaksi penjualan',
  'pembayaran tunai & nontunai',
  'shift kasir',
  'stok outlet',
  'harga & diskon',
  'data pelanggan',
  'retur & pembatalan',
  'laporan penjualan',
  'pengguna & hak akses',
  'sinkronisasi transaksi',
  'backup cloud standar',
];

export const BELUM_TERMASUK_POS =
  'Belum termasuk perangkat keras (perangkat kasir, printer, pemindai barcode, laci kasir) ' +
  'dan biaya jaringan internet di lokasi outlet.';

export const PAKET_PUSAT = [
  {
    kode: 'NONE',
    nama: 'Tanpa Paket Pusat',
    label: 'Per outlet saja',
    harga: 0,
    isi: ['Modul POS dan manajemen stok per outlet', 'Tanpa konsolidasi pusat'],
    cocok: 'Usaha satu atau dua outlet yang belum perlu konsolidasi.',
  },
  {
    kode: 'BASIC',
    nama: 'Central Basic',
    label: 'Konsolidasi dasar',
    harga: 750_000,
    isi: ['Dasbor pusat', 'Stok konsolidasi', 'Transfer antar-outlet', 'Pembelian sederhana'],
    cocok: 'Unit usaha yang baru mulai mengonsolidasikan banyak outlet.',
  },
  {
    kode: 'PRO',
    nama: 'Central Professional',
    label: 'Rantai pasok & produksi',
    harga: 1_500_000,
    isi: ['Gudang pusat', 'Pengadaan (PR/PO)', 'Distribusi & pengiriman', 'Produksi & HPP'],
    cocok: 'Unit usaha dengan rantai pasok atau produksi yang aktif.',
  },
  {
    kode: 'FULL',
    nama: 'Full Integrated Suite',
    label: 'End-to-end',
    harga: 2_500_000,
    unggulan: true,
    isi: [
      'Seluruh cakupan Central Professional',
      'Akuntansi',
      'Kepegawaian',
      'Investor & BEP',
      'Audit & analitik',
    ],
    cocok: 'Unit usaha yang ingin satu sistem end-to-end dalam satu atap.',
  },
];

export const SIMULASI = [
  { outlet: 5, pos: 1_740_000, pusat: 2_500_000, total: 4_240_000 },
  { outlet: 10, pos: 3_100_000, pusat: 2_500_000, total: 5_600_000 },
  { outlet: 30, pos: 8_220_000, pusat: 2_500_000, total: 10_720_000 },
];

export const BIAYA_IMPLEMENTASI = [
  { lingkup: '1 outlet', nilai: 'Rp 1,5 – 3 juta' },
  { lingkup: '2 – 5 outlet', nilai: 'Rp 5 – 10 juta' },
  { lingkup: '6 – 20 outlet', nilai: 'Rp 15 – 25 juta' },
  { lingkup: '21 – 50 outlet', nilai: 'Rp 30 – 50 juta' },
  { lingkup: 'Modul pusat tambahan', nilai: 'Rp 10 – 30 juta' },
];

export const OPSI_PEMBAYARAN = [
  {
    judul: 'Tahunan prabayar',
    isi: 'Penghematan setara kurang lebih dua bulan biaya berlangganan dibandingkan pembayaran bulanan.',
  },
  {
    judul: 'Implementasi gratis',
    isi: 'Biaya implementasi awal dibebaskan sepenuhnya untuk kontrak dua tahun dengan pembayaran tahunan di muka.',
  },
  {
    judul: 'Bagi hasil per transaksi',
    isi:
      'Bagi yang ingin memulai tanpa biaya implementasi di muka: Rp 50 – Rp 100 per transaksi ' +
      'kasir, dengan tagihan bulanan minimum setara langganan POS reguler.',
  },
];

// ------------------------------------------------------------- Pelaksanaan

export const TAHAPAN = [
  {
    nomor: '01',
    judul: 'Asesmen kebutuhan & pemetaan alur',
    isi: 'Memetakan alur kasir-gudang-pengadaan-akuntansi, kebutuhan modul, dan prioritas implementasi.',
  },
  {
    nomor: '02',
    judul: 'Konfigurasi sistem & migrasi awal',
    isi: 'Menyiapkan master produk, harga, resep, hierarki gudang, akun akuntansi, dan hak akses pengguna.',
  },
  {
    nomor: '03',
    judul: 'Pelatihan & uji coba terbatas',
    isi: 'Melatih kasir, petugas gudang, dan tim akuntansi; menyimulasikan alur transaksi dari ujung ke ujung.',
  },
  {
    nomor: '04',
    judul: 'Go-live bertahap & pemantauan',
    isi: 'Mengaktifkan modul prioritas lebih dahulu, memantau pemakaian, dan mendampingi penyelesaian kendala.',
  },
  {
    nomor: '05',
    judul: 'Evaluasi & optimalisasi',
    isi: 'Mengevaluasi pemanfaatan, menyempurnakan konfigurasi, dan menyusun rekomendasi pengembangan lanjutan.',
  },
];

export const PETA_JALAN = [
  {
    fase: 'Fase 1 — berjalan',
    judul: 'Gudang, pengadaan, toko online, tata kelola',
    isi:
      'Hierarki gudang, alur permintaan sampai penerimaan barang, transfer antar gudang, ' +
      'toko online berdomain sendiri, hak akses berjenjang, jejak audit, dan asisten AI — ' +
      'sudah dibangun, diuji, dan berjalan.',
    tahap: 'BERJALAN' as Tahap,
  },
  {
    fase: 'Fase 2 — sedang dikerjakan',
    judul: 'POS Web untuk kasir',
    isi:
      'Layar kasir, pemindaian barcode, penetapan harga dan pajak dari server, shift dan ' +
      'rekonsiliasi kas, struk, pengurangan stok, dan peristiwa akuntansi. Ini jalur kritis ' +
      'kami saat ini.',
    tahap: 'DIBANGUN' as Tahap,
  },
  {
    fase: 'Fase 3 — rencana',
    judul: 'Ekspedisi (distribusi)',
    isi:
      'Rute pengiriman multi-titik dalam satu perjalanan, manifest pengiriman, bukti serah ' +
      'terima, dan pelacakan kendaraan.',
    tahap: 'RENCANA' as Tahap,
  },
  {
    fase: 'Fase 4 — rencana',
    judul: 'Portal bagi hasil investor',
    isi:
      'Skema bagi hasil tiga fase yang dikonfigurasi per perjanjian, dihitung dari laba ' +
      'bersih riil, dengan portal investor yang menampilkan modal, fase berjalan, dan jarak ' +
      'menuju titik impas berikutnya.',
    tahap: 'RENCANA' as Tahap,
  },
  {
    fase: 'Fase 5 — rencana',
    judul: 'Kepegawaian outlet',
    isi: 'Penggajian dan presensi staf ritel/gudang di atas mesin penggajian yang sudah ada.',
    tahap: 'RENCANA' as Tahap,
  },
];

export const INDIKATOR = [
  {
    judul: 'Kecepatan transaksi kasir',
    isi: 'Waktu layanan dan panjang antrean dapat dipantau dari data sistem.',
  },
  {
    judul: 'Akurasi stok',
    isi: 'Selisih antara catatan sistem dan hitungan fisik terukur lewat hasil stok opname berkala.',
  },
  {
    judul: 'Kontrol keuangan',
    isi: 'HPP, jurnal, dan selisih kas terpantau oleh kasir, akuntansi, dan pimpinan.',
  },
  {
    judul: 'Akuntabilitas proses',
    isi: 'Alur persetujuan, perubahan stok, dan histori transaksi tersimpan untuk kebutuhan audit.',
  },
];

export const INFRASTRUKTUR = [
  {
    judul: 'Awan (disarankan)',
    isi: 'Sistem berjalan di server kami. Tidak perlu membeli server, cukup koneksi internet di setiap outlet.',
  },
  {
    judul: 'Di tempat sendiri (on-premise)',
    isi: 'Sistem dipasang pada server internal unit usaha. Cocok bagi yang kebijakan datanya tertutup.',
  },
  {
    judul: 'Gabungan (hybrid)',
    isi: 'Arsip transaksi disimpan di server lokal, sementara antarmukanya tetap dapat diakses dari cabang.',
  },
];

export const PENDAMPINGAN = [
  {
    judul: 'Tim infrastruktur',
    isi: 'Menjaga keandalan server, keamanan data transaksi, dan pemeliharaan sistem.',
  },
  {
    judul: 'Pelatih & implementator',
    isi: 'Mendampingi migrasi data dan memberi pelatihan gratis, daring maupun tatap muka.',
  },
  {
    judul: 'Konsultan alur bisnis',
    isi: 'Memastikan alur kasir, gudang, pengadaan, dan akuntansi sesuai kebutuhan operasional.',
  },
  {
    judul: 'Layanan bantuan',
    isi: 'Tim dukungan teknis untuk kendala operasional harian, dengan kategori Kritis / Tinggi / Normal.',
  },
];

/** Kategori dukungan sesuai draf PKS. */
export const KATEGORI_DUKUNGAN = [
  {
    tingkat: 'Kritis',
    keadaan: 'Sistem utama tidak dapat diakses, atau layanan kasir/gudang inti berhenti.',
    penanganan: 'Diprioritaskan untuk investigasi dan pemulihan layanan secepat mungkin.',
  },
  {
    tingkat: 'Tinggi',
    keadaan: 'Fungsi penting terganggu namun masih tersedia alternatif proses sementara.',
    penanganan: 'Ditangani secara prioritas berdasarkan dampak operasional dan jadwal layanan.',
  },
  {
    tingkat: 'Normal',
    keadaan: 'Pertanyaan penggunaan, penyesuaian minor, atau dukungan operasional rutin.',
    penanganan: 'Ditangani melalui kanal dukungan resmi sesuai antrean dan kesepakatan.',
  },
];

export const POLA_PEMANFAATAN = [
  {
    judul: 'Berdiri sendiri',
    isi:
      'Ritel, kafe, koperasi, gudang, distribusi, atau usaha berbasis investor yang tidak ' +
      'bernaung di bawah lembaga mana pun. Daftar sendiri, ruang kerja siap dalam hitungan menit.',
  },
  {
    judul: 'Unit usaha lembaga pendidikan',
    isi:
      'Kantin, koperasi, toko kampus, atau gudang milik universitas, sekolah, dan pesantren. ' +
      'Dapat terhubung dengan data mahasiswa, siswa, santri, dan pegawai yang sudah ada — ' +
      'tanpa membangun sistem terpisah atau login ganda.',
  },
];

export const RUPIAH = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const LABEL_TAHAP: Record<Tahap, { teks: string; kelas: string }> = {
  BERJALAN: {
    teks: 'Sudah berjalan',
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  DIBANGUN: {
    teks: 'Sedang dibangun',
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  RENCANA: {
    teks: 'Rencana',
    kelas: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
};

/** Tautan ke empat dokumen penawaran. */
export const DOKUMEN = [
  {
    url: '/presentasi',
    judul: 'Presentasi',
    isi: 'Dua puluh slide, dapat dijalankan langsung di layar rapat.',
    ikon: 'presentation',
  },
  {
    url: '/proposal',
    judul: 'Proposal',
    isi: 'Delapan bab: latar belakang, modul, peta jalan, metodologi, sampai skema harga.',
    ikon: 'file-text',
  },
  {
    url: '/pks',
    judul: 'Draft PKS',
    isi: 'Sebelas pasal perjanjian kerja sama, siap dibahas tim legal.',
    ikon: 'file-signature',
  },
  {
    url: '/penawaran',
    judul: 'Surat Penawaran',
    isi: 'Surat penawaran resmi satu halaman, siap dicetak.',
    ikon: 'mail',
  },
];
