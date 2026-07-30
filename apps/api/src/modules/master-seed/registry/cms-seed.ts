/**
 * Konten awal website publik eBisnis.id.
 *
 * Konsep dan copy diturunkan dari `docs/input/ebisnis.jsp`, tetapi seluruh teks
 * disimpan sebagai DATA pada schema `platform` sehingga Platform Super Admin
 * dapat mengubah homepage TANPA mengubah source dan tanpa rebuild.
 */

export const WEBSITE_SEED = {
  code: 'EBISNIS_ID',
  name: 'eBisnis.id',
  primaryDomain: 'ebisnis.id',
  defaultLocaleCode: 'id',
  themeCode: 'default',
};

export const HERO_SLIDE_SEED = [
  {
    code: 'HERO_MAIN',
    eyebrowKey: 'web.hero.eyebrow',
    defaultEyebrow: 'Platform SaaS POS & ERP Terintegrasi',
    titleKey: 'web.hero.title',
    defaultTitle: 'Satu Aplikasi untuk Kasir, Toko, dan Seluruh Bisnis Anda',
    subtitleKey: 'web.hero.subtitle',
    defaultSubtitle:
      'Dari gerai pertama sampai banyak brand. Kelola kasir, persediaan, pembelian, keuangan, SDM, dan bagi hasil investor dalam satu platform yang tumbuh mengikuti bisnis Anda.',
    primaryCtaLabelKey: 'web.hero.ctaPrimary',
    primaryCtaLabel: 'Daftar Gratis Sekarang',
    primaryCtaUrl: '/daftar',
    secondaryCtaLabelKey: 'web.hero.ctaSecondary',
    secondaryCtaLabel: 'Coba Demo',
    secondaryCtaUrl: '/demo',
    sortOrder: 1,
  },
];

export const MARKETING_FEATURE_SEED = [
  // group FEATURE — ringkasan platform
  { code: 'FEAT_QR_ACTIVATION', group: 'FEATURE', icon: 'qr-code', titleKey: 'web.feature.qrActivation.title', defaultTitle: 'Aktivasi via QR Code', descriptionKey: 'web.feature.qrActivation.desc', defaultDescription: 'Pasang mesin kasir baru cukup pindai QR/kode instalasi sekali, langsung terhubung ke toko Anda.', sortOrder: 1 },
  { code: 'FEAT_OFFLINE_FIRST', group: 'FEATURE', icon: 'wifi-off', titleKey: 'web.feature.offlineFirst.title', defaultTitle: 'Offline-First', descriptionKey: 'web.feature.offlineFirst.desc', defaultDescription: 'Penjualan tidak berhenti saat internet putus. Transaksi tersinkron aman begitu koneksi kembali.', sortOrder: 2 },
  { code: 'FEAT_MULTI_BRAND', group: 'FEATURE', icon: 'layers', titleKey: 'web.feature.multiBrand.title', defaultTitle: 'Multi-Brand & Multi-Toko', descriptionKey: 'web.feature.multiBrand.desc', defaultDescription: 'Satu pendaftar dapat memiliki banyak brand, dan tiap brand memiliki banyak toko, gerai, atau kafe.', sortOrder: 3 },
  { code: 'FEAT_INVESTOR', group: 'FEATURE', icon: 'handshake', titleKey: 'web.feature.investor.title', defaultTitle: 'Investor & Bagi Hasil', descriptionKey: 'web.feature.investor.desc', defaultDescription: 'Kelola kepemilikan banyak investor lintas toko dan brand, dengan bagi hasil otomatis setelah biaya operasional.', sortOrder: 4 },
  { code: 'FEAT_MULTI_TENANT', group: 'FEATURE', icon: 'shield-check', titleKey: 'web.feature.multiTenant.title', defaultTitle: 'Isolasi Data per Pendaftar', descriptionKey: 'web.feature.multiTenant.desc', defaultDescription: 'Setiap pendaftar memperoleh schema database sendiri beserta schema audit terpisah.', sortOrder: 5 },
  { code: 'FEAT_API_FIRST', group: 'FEATURE', icon: 'plug', titleKey: 'web.feature.apiFirst.title', defaultTitle: 'API-First', descriptionKey: 'web.feature.apiFirst.desc', defaultDescription: 'Seluruh fungsi tersedia melalui REST API terdokumentasi OpenAPI untuk integrasi Anda.', sortOrder: 6 },
  { code: 'FEAT_CONFIGURABLE', group: 'FEATURE', icon: 'sliders', titleKey: 'web.feature.configurable.title', defaultTitle: 'Configurable, Bukan Hard-Coded', descriptionKey: 'web.feature.configurable.desc', defaultDescription: 'Paket, harga, modul, menu, dan hak akses dikonfigurasi dari panel admin, bukan ditulis di kode.', sortOrder: 7 },
  { code: 'FEAT_MULTI_LANGUAGE', group: 'FEATURE', icon: 'languages', titleKey: 'web.feature.multiLanguage.title', defaultTitle: 'Multi-Bahasa', descriptionKey: 'web.feature.multiLanguage.desc', defaultDescription: 'Bahasa Indonesia, English, العربية dengan tata letak RTL, dan 简体中文.', sortOrder: 8 },
  { code: 'FEAT_AUDIT_TRAIL', group: 'FEATURE', icon: 'scroll-text', titleKey: 'web.feature.auditTrail.title', defaultTitle: 'Jejak Audit Lengkap', descriptionKey: 'web.feature.auditTrail.desc', defaultDescription: 'Setiap perubahan data tercatat append-only pada schema audit terpisah dan tidak dapat dihapus.', sortOrder: 9 },
  { code: 'FEAT_REALTIME_STOCK', group: 'FEATURE', icon: 'network', titleKey: 'web.feature.realtimeStock.title', defaultTitle: 'Monitoring Stok Berjenjang', descriptionKey: 'web.feature.realtimeStock.desc', defaultDescription: 'Pantau stok per wilayah, gudang parent, hingga tiap toko dalam satu tampilan pohon.', sortOrder: 10 },

  // group MODULE — showcase modul ERP
  { code: 'MOD_POS', group: 'MODULE', moduleCode: 'POS', icon: 'shopping-cart', titleKey: 'web.module.pos.title', defaultTitle: 'Kasir / POS', descriptionKey: 'web.module.pos.desc', defaultDescription: 'Transaksi cepat, shift kasir, retur, cetak struk, dan mode offline.', sortOrder: 1 },
  { code: 'MOD_SALES', group: 'MODULE', moduleCode: 'SALES', icon: 'trending-up', titleKey: 'web.module.sales.title', defaultTitle: 'Penjualan', descriptionKey: 'web.module.sales.desc', defaultDescription: 'Penawaran, pesanan, invoice, retur, dan komisi penjualan.', sortOrder: 2 },
  { code: 'MOD_PRODUCT', group: 'MODULE', moduleCode: 'PRODUCT_PRICING', icon: 'package', titleKey: 'web.module.product.title', defaultTitle: 'Produk dan Harga', descriptionKey: 'web.module.product.desc', defaultDescription: 'Katalog, varian, barcode, satuan, buku harga, promosi, dan pajak.', sortOrder: 3 },
  { code: 'MOD_CRM', group: 'MODULE', moduleCode: 'CRM', icon: 'users', titleKey: 'web.module.crm.title', defaultTitle: 'Pelanggan dan CRM', descriptionKey: 'web.module.crm.desc', defaultDescription: 'Master pelanggan, segmentasi, loyalitas, kampanye, dan tiket layanan.', sortOrder: 4 },
  { code: 'MOD_PURCHASING', group: 'MODULE', moduleCode: 'PURCHASING', icon: 'shopping-bag', titleKey: 'web.module.purchasing.title', defaultTitle: 'Pembelian', descriptionKey: 'web.module.purchasing.desc', defaultDescription: 'Request Order otomatis, PO, penerimaan bervalidasi, dan backorder.', sortOrder: 5 },
  { code: 'MOD_INVENTORY', group: 'MODULE', moduleCode: 'INVENTORY', icon: 'warehouse', titleKey: 'web.module.inventory.title', defaultTitle: 'Gudang dan Persediaan', descriptionKey: 'web.module.inventory.desc', defaultDescription: 'Ledger stok immutable, minimum stok, transfer internal, dan stock opname.', sortOrder: 6 },
  { code: 'MOD_MANUFACTURING', group: 'MODULE', moduleCode: 'MANUFACTURING', icon: 'factory', titleKey: 'web.module.manufacturing.title', defaultTitle: 'Produksi', descriptionKey: 'web.module.manufacturing.desc', defaultDescription: 'BOM berversi, work order, pengeluaran bahan, dan biaya produksi.', sortOrder: 7 },
  { code: 'MOD_FINANCE', group: 'MODULE', moduleCode: 'ACCOUNTING', icon: 'wallet', titleKey: 'web.module.finance.title', defaultTitle: 'Keuangan dan Akuntansi', descriptionKey: 'web.module.finance.desc', defaultDescription: 'Bagan akun, jurnal immutable, kas dan bank, piutang, utang, serta tutup buku.', sortOrder: 8 },
  { code: 'MOD_INVESTOR', group: 'MODULE', moduleCode: 'INVESTOR_REVENUE_SHARE', icon: 'handshake', titleKey: 'web.module.investor.title', defaultTitle: 'Investor dan Bagi Hasil', descriptionKey: 'web.module.investor.desc', defaultDescription: 'Kontrak bagi hasil berversi, perhitungan tersnapshot, dan settlement tercatat.', sortOrder: 9 },
  { code: 'MOD_HR', group: 'MODULE', moduleCode: 'HUMAN_RESOURCES', icon: 'id-card', titleKey: 'web.module.hr.title', defaultTitle: 'SDM dan Payroll', descriptionKey: 'web.module.hr.desc', defaultDescription: 'Pegawai, kontrak, jadwal, presensi, cuti, penilaian, dan payroll.', sortOrder: 10 },
  { code: 'MOD_ASSET', group: 'MODULE', moduleCode: 'ASSET', icon: 'wrench', titleKey: 'web.module.asset.title', defaultTitle: 'Aset dan Pemeliharaan', descriptionKey: 'web.module.asset.desc', defaultDescription: 'Master aset, penyusutan, perawatan preventif, dan penghapusan aset.', sortOrder: 11 },
  { code: 'MOD_REPORTING', group: 'MODULE', moduleCode: 'REPORTING_ANALYTICS', icon: 'bar-chart-3', titleKey: 'web.module.reporting.title', defaultTitle: 'Laporan dan Analitik', descriptionKey: 'web.module.reporting.desc', defaultDescription: 'Dashboard per peran, laporan terjadwal, KPI, dan saved view.', sortOrder: 12 },

  // group STEP — cara kerja
  { code: 'STEP_1', group: 'STEP', icon: 'user-plus', titleKey: 'web.step.1.title', defaultTitle: '1. Daftar Akun Pendaftar', descriptionKey: 'web.step.1.desc', defaultDescription: 'Isi formulir pendaftaran: nama bisnis, wilayah, kontak, dan email untuk masuk kembali kapan saja.', sortOrder: 1 },
  { code: 'STEP_2', group: 'STEP', icon: 'layers', titleKey: 'web.step.2.title', defaultTitle: '2. Buat Brand dan Toko', descriptionKey: 'web.step.2.desc', defaultDescription: 'Tambahkan brand atau sub-brand Anda, lalu buat toko, gerai, atau kafe pertama di bawah brand tersebut.', sortOrder: 2 },
  { code: 'STEP_3', group: 'STEP', icon: 'monitor', titleKey: 'web.step.3.title', defaultTitle: '3. Tentukan Jumlah Mesin POS', descriptionKey: 'web.step.3.desc', defaultDescription: 'Sebutkan berapa mesin kasir yang dibutuhkan tiap toko — boleh satu, boleh lebih.', sortOrder: 3 },
  { code: 'STEP_4', group: 'STEP', icon: 'qr-code', titleKey: 'web.step.4.title', defaultTitle: '4. Aktivasi Mesin Kasir', descriptionKey: 'web.step.4.desc', defaultDescription: 'Pasang aplikasi kasir di perangkat, pindai QR sekali, dan mesin langsung terhubung ke toko Anda.', sortOrder: 4 },
  { code: 'STEP_5', group: 'STEP', icon: 'calendar-clock', titleKey: 'web.step.5.title', defaultTitle: '5. Uji Coba 30 Hari', descriptionKey: 'web.step.5.desc', defaultDescription: 'Jalankan kasir seperti biasa tanpa kewajiban bayar sampai 30 hari kalender sejak aktivasi pertama.', sortOrder: 5 },
  { code: 'STEP_6', group: 'STEP', icon: 'credit-card', titleKey: 'web.step.6.title', defaultTitle: '6. Berlangganan via Esmartlink', descriptionKey: 'web.step.6.desc', defaultDescription: 'Setelah masa uji coba, perpanjang tiap mesin melalui Esmartlink sesuai paket yang dipilih.', sortOrder: 6 },

  // group ADVANTAGE — keunggulan
  { code: 'ADV_ONE_DATA', group: 'ADVANTAGE', icon: 'database', titleKey: 'web.advantage.oneData.title', defaultTitle: 'Satu Data, Banyak Layanan', descriptionKey: 'web.advantage.oneData.desc', defaultDescription: 'Semua toko dan brand berbagi satu pusat data yang tetap terisolasi rapi dari pengguna lain.', sortOrder: 1 },
  { code: 'ADV_FASTER', group: 'ADVANTAGE', icon: 'zap', titleKey: 'web.advantage.faster.title', defaultTitle: 'Layanan Lebih Cepat', descriptionKey: 'web.advantage.faster.desc', defaultDescription: 'Antrean kasir lebih singkat dengan pencarian produk, barcode, dan pembayaran terpadu.', sortOrder: 2 },
  { code: 'ADV_DASHBOARD', group: 'ADVANTAGE', icon: 'gauge', titleKey: 'web.advantage.dashboard.title', defaultTitle: 'Keputusan Berbasis Dashboard', descriptionKey: 'web.advantage.dashboard.desc', defaultDescription: 'Pemilik dan investor memantau performa lintas toko dan brand kapan saja, bukan menunggu laporan bulanan.', sortOrder: 3 },
  { code: 'ADV_TRACEABLE', group: 'ADVANTAGE', icon: 'search-check', titleKey: 'web.advantage.traceable.title', defaultTitle: 'Bagi Hasil yang Dapat Ditelusuri', descriptionKey: 'web.advantage.traceable.desc', defaultDescription: 'Perhitungan bagi hasil menyimpan versi formula sehingga dapat direproduksi ulang kapan pun.', sortOrder: 4 },
];

export const FAQ_CATEGORY_SEED = [
  { code: 'FAQ_REGISTRATION', name: 'Pendaftaran', sortOrder: 1 },
  { code: 'FAQ_DEMO', name: 'Demo', sortOrder: 2 },
  { code: 'FAQ_PACKAGE', name: 'Paket', sortOrder: 3 },
  { code: 'FAQ_PAYMENT', name: 'Pembayaran', sortOrder: 4 },
  { code: 'FAQ_POS', name: 'Kasir / POS', sortOrder: 5 },
  { code: 'FAQ_INVENTORY', name: 'Persediaan', sortOrder: 6 },
  { code: 'FAQ_ACCOUNTING', name: 'Akuntansi', sortOrder: 7 },
  { code: 'FAQ_HR', name: 'SDM', sortOrder: 8 },
  { code: 'FAQ_SECURITY', name: 'Keamanan', sortOrder: 9 },
  { code: 'FAQ_SUPPORT', name: 'Dukungan', sortOrder: 10 },
];

export const FAQ_ITEM_SEED = [
  { code: 'FAQ_REG_1', categoryCode: 'FAQ_REGISTRATION', question: 'Apakah pendaftaran memerlukan kartu kredit?', answer: 'Tidak. Pendaftaran gratis dan tidak memerlukan kartu kredit. Anda memperoleh masa uji coba 30 hari per mesin kasir sebelum berlangganan.', sortOrder: 1 },
  { code: 'FAQ_REG_2', categoryCode: 'FAQ_REGISTRATION', question: 'Berapa lama proses aktivasi akun?', answer: 'Setelah formulir dikirim, sistem membuat schema database khusus untuk bisnis Anda beserta schema audit dan data awal. Proses ini umumnya selesai dalam hitungan detik.', sortOrder: 2 },
  { code: 'FAQ_DEMO_1', categoryCode: 'FAQ_DEMO', question: 'Apakah saya dapat mencoba tanpa mendaftar?', answer: 'Bisa. Tombol Coba Demo membuat sesi sandbox berumur pendek pada schema demo bersama, tanpa perlu username dan password.', sortOrder: 3 },
  { code: 'FAQ_DEMO_2', categoryCode: 'FAQ_DEMO', question: 'Apakah data demo saya aman?', answer: 'Sandbox demo dipakai bersama dan di-reset secara terjadwal. Jangan memasukkan data pribadi atau rahasia ke dalam demo.', sortOrder: 4 },
  { code: 'FAQ_PKG_1', categoryCode: 'FAQ_PACKAGE', question: 'Bagaimana cara menghitung biaya langganan?', answer: 'Biaya dihitung per mesin kasir per bulan sesuai paket yang dipilih. Anda dapat memilih paket berbeda untuk outlet atau perangkat yang berbeda.', sortOrder: 5 },
  { code: 'FAQ_PKG_2', categoryCode: 'FAQ_PACKAGE', question: 'Apakah paket dapat diubah di kemudian hari?', answer: 'Bisa. Perubahan paket berlaku pada periode penagihan berikutnya dan tidak mengubah invoice yang sudah diterbitkan.', sortOrder: 6 },
  { code: 'FAQ_PAY_1', categoryCode: 'FAQ_PAYMENT', question: 'Metode pembayaran apa saja yang tersedia?', answer: 'Pembayaran langganan diproses melalui Esmartlink dengan pilihan virtual account bank, QRIS, dompet digital, dan gerai ritel.', sortOrder: 7 },
  { code: 'FAQ_PAY_2', categoryCode: 'FAQ_PAYMENT', question: 'Apakah bisa membayar satu mesin saja?', answer: 'Bisa. Tersedia mode pembayaran per perangkat, beberapa perangkat terpilih, atau satu invoice gabungan untuk seluruh perangkat.', sortOrder: 8 },
  { code: 'FAQ_POS_1', categoryCode: 'FAQ_POS', question: 'Apakah kasir tetap jalan saat internet putus?', answer: 'Ya. Aplikasi kasir bersifat offline-first. Transaksi tersimpan lokal dan tersinkron otomatis begitu koneksi kembali.', sortOrder: 9 },
  { code: 'FAQ_INV_1', categoryCode: 'FAQ_INVENTORY', question: 'Kapan stok bertambah setelah barang datang?', answer: 'Stok hanya bertambah setelah penerimaan barang divalidasi oleh pengguna berwenang. Registrasi kedatangan dan pemeriksaan fisik belum menambah stok.', sortOrder: 10 },
  { code: 'FAQ_INV_2', categoryCode: 'FAQ_INVENTORY', question: 'Bagaimana jika barang yang datang kurang?', answer: 'Sistem membuat Backorder atas kekurangan tersebut. Backorder dapat tetap ditujukan ke pemasok awal atau dialihkan ke pemasok pengganti dengan jejak dokumen yang tetap tertelusur.', sortOrder: 11 },
  { code: 'FAQ_ACC_1', categoryCode: 'FAQ_ACCOUNTING', question: 'Apakah jurnal dapat diedit setelah diposting?', answer: 'Tidak. Jurnal yang telah diposting bersifat immutable. Koreksi dilakukan melalui jurnal pembalik (reversal) sehingga riwayat tetap utuh.', sortOrder: 12 },
  { code: 'FAQ_HR_1', categoryCode: 'FAQ_HR', question: 'Apakah Payroll termasuk dalam paket SDM?', answer: 'Tidak otomatis. Pada paket POS Professional, modul SDM dan Kehadiran termasuk, sedangkan Payroll tersedia sebagai add-on. Paket POS Complete sudah mencakup Payroll.', sortOrder: 13 },
  { code: 'FAQ_SEC_1', categoryCode: 'FAQ_SECURITY', question: 'Bagaimana data saya dipisahkan dari pengguna lain?', answer: 'Setiap pendaftar memperoleh schema PostgreSQL sendiri beserta schema audit terpisah. Aplikasi hanya memakai nama schema dari registry internal, tidak pernah dari input pengguna.', sortOrder: 14 },
  { code: 'FAQ_SEC_2', categoryCode: 'FAQ_SECURITY', question: 'Apakah administrator platform dapat melihat data saya?', answer: 'Akses dukungan bersifat eksplisit, terbatas waktu, memerlukan alasan dan verifikasi ulang, serta tercatat pada dua schema audit sekaligus.', sortOrder: 15 },
  { code: 'FAQ_SUP_1', categoryCode: 'FAQ_SUPPORT', question: 'Bagaimana cara menghubungi dukungan?', answer: 'Gunakan formulir kontak pada halaman ini atau surel dukungan yang tertera pada bagian Kontak.', sortOrder: 16 },
];

export const TESTIMONIAL_SEED = [
  { code: 'TESTI_01', personName: 'Rina Wijaya', organization: 'Kopi Senja', roleTitle: 'Pemilik', quote: 'Sejak memakai eBisnis.id, laporan penjualan tiga gerai kami tersedia setiap pagi tanpa rekap manual.', rating: 5, sortOrder: 1 },
  { code: 'TESTI_02', personName: 'Bagus Prakoso', organization: 'Toko Sumber Rejeki', roleTitle: 'Manajer Operasional', quote: 'Request Order otomatis membuat stok minimum tidak lagi terlewat. Gudang parent langsung tahu apa yang harus dikirim.', rating: 5, sortOrder: 2 },
  { code: 'TESTI_03', personName: 'Maya Kusuma', organization: 'Dapur Nusantara', roleTitle: 'Direktur', quote: 'Validasi penerimaan barang menyelamatkan kami dari selisih stok yang dulu sering terjadi.', rating: 5, sortOrder: 3 },
  { code: 'TESTI_04', personName: 'Hendra Saputra', organization: 'Mitra Retail Group', roleTitle: 'Investor', quote: 'Perhitungan bagi hasil tersimpan lengkap dengan formulanya, jadi mudah ditelusuri ulang saat rapat.', rating: 5, sortOrder: 4 },
  { code: 'TESTI_05', personName: 'Dewi Lestari', organization: 'Warung Bu Dewi', roleTitle: 'Pemilik', quote: 'Kasir tetap jalan waktu internet mati. Itu yang paling saya butuhkan.', rating: 5, sortOrder: 5 },
  { code: 'TESTI_06', personName: 'Arif Rahman', organization: 'Distribusi Jaya', roleTitle: 'Kepala Gudang', quote: 'Monitoring stok berbentuk pohon memudahkan melihat posisi barang per wilayah sampai per toko.', rating: 4, sortOrder: 6 },
  { code: 'TESTI_07', personName: 'Sinta Maharani', organization: 'Bakery Manis', roleTitle: 'Manajer Keuangan', quote: 'Jurnal tidak bisa diubah setelah posting. Auditor kami sangat menghargai itu.', rating: 5, sortOrder: 7 },
  { code: 'TESTI_08', personName: 'Yusuf Ananda', organization: 'Kios Berkah', roleTitle: 'Pemilik', quote: 'Mulai dari satu mesin kasir, sekarang lima. Biayanya jelas per mesin, tidak ada kejutan.', rating: 5, sortOrder: 8 },
  { code: 'TESTI_09', personName: 'Laila Rahmawati', organization: 'Restoran Selera', roleTitle: 'Supervisor', quote: 'Backorder ke pemasok lain bisa dilakukan tanpa kehilangan jejak PO awal.', rating: 4, sortOrder: 9 },
  { code: 'TESTI_10', personName: 'Fajar Nugroho', organization: 'Grup Usaha Mandiri', roleTitle: 'CEO', quote: 'Satu akun, banyak brand, banyak toko. Struktur yang kami butuhkan sudah tersedia sejak awal.', rating: 5, sortOrder: 10 },
];

export const PARTNER_LOGO_SEED = Array.from({ length: 10 }, (_, i) => ({
  code: `PARTNER_${String(i + 1).padStart(2, '0')}`,
  name: [
    'Bank Mitra Nusantara',
    'Esmartlink Payment',
    'Asosiasi Retail Indonesia',
    'Koperasi Digital Bersama',
    'Cloud Infra Indonesia',
    'Kamar Dagang Daerah',
    'Politeknik Bisnis Digital',
    'Asosiasi UMKM Maju',
    'Penyedia Perangkat POS',
    'Konsultan Implementasi ERP',
  ][i],
  websiteUrl: null,
  sortOrder: i + 1,
}));

export const NEWS_CATEGORY_SEED = [
  { code: 'NEWS_PRODUCT', name: 'Produk', slug: 'produk', sortOrder: 1 },
  { code: 'NEWS_COMPANY', name: 'Perusahaan', slug: 'perusahaan', sortOrder: 2 },
  { code: 'NEWS_UPDATE', name: 'Pembaruan', slug: 'pembaruan', sortOrder: 3 },
  { code: 'NEWS_PROMOTION', name: 'Promosi', slug: 'promosi', sortOrder: 4 },
  { code: 'NEWS_EDUCATION', name: 'Edukasi', slug: 'edukasi', sortOrder: 5 },
  { code: 'NEWS_TECHNOLOGY', name: 'Teknologi', slug: 'teknologi', sortOrder: 6 },
  { code: 'NEWS_EVENT', name: 'Acara', slug: 'acara', sortOrder: 7 },
  { code: 'NEWS_PARTNERSHIP', name: 'Kemitraan', slug: 'kemitraan', sortOrder: 8 },
  { code: 'NEWS_SECURITY', name: 'Keamanan', slug: 'keamanan', sortOrder: 9 },
  { code: 'NEWS_OTHER', name: 'Lainnya', slug: 'lainnya', sortOrder: 10 },
];

export const NEWS_TAG_SEED = [
  { code: 'TAG_POS', name: 'POS', slug: 'pos' },
  { code: 'TAG_ERP', name: 'ERP', slug: 'erp' },
  { code: 'TAG_UMKM', name: 'UMKM', slug: 'umkm' },
  { code: 'TAG_RETAIL', name: 'Retail', slug: 'retail' },
  { code: 'TAG_FNB', name: 'F&B', slug: 'fnb' },
  { code: 'TAG_INVENTORY', name: 'Persediaan', slug: 'persediaan' },
  { code: 'TAG_FINANCE', name: 'Keuangan', slug: 'keuangan' },
  { code: 'TAG_INTEGRATION', name: 'Integrasi', slug: 'integrasi' },
  { code: 'TAG_SECURITY', name: 'Keamanan', slug: 'keamanan-tag' },
  { code: 'TAG_RELEASE', name: 'Rilis', slug: 'rilis' },
];

export const NEWS_ARTICLE_SEED = [
  { code: 'NEWS_001', categoryCode: 'NEWS_PRODUCT', slug: 'eBisnis-id-resmi-meluncurkan-platform-pos-erp', title: 'eBisnis.id Resmi Meluncurkan Platform POS dan ERP Terintegrasi', summary: 'Platform SaaS multi-tenant untuk kasir, persediaan, keuangan, dan bagi hasil investor kini tersedia untuk pendaftaran umum.', isFeatured: true, isPinned: true, tags: ['TAG_POS', 'TAG_ERP'], daysAgo: 1 },
  { code: 'NEWS_002', categoryCode: 'NEWS_UPDATE', slug: 'request-order-otomatis-dari-stok-minimum', title: 'Request Order Otomatis dari Stok Minimum Kini Tersedia', summary: 'Sistem memantau proyeksi stok tiap lokasi dan membuat draft Request Order ketika menyentuh titik pemesanan ulang.', isFeatured: true, tags: ['TAG_INVENTORY'], daysAgo: 5 },
  { code: 'NEWS_003', categoryCode: 'NEWS_PRODUCT', slug: 'validasi-penerimaan-barang-dan-backorder', title: 'Validasi Penerimaan Barang dan Alur Backorder', summary: 'Stok hanya bertambah setelah penerimaan divalidasi, dan kekurangan kiriman otomatis menjadi Backorder yang tertelusur.', tags: ['TAG_INVENTORY', 'TAG_RETAIL'], daysAgo: 9 },
  { code: 'NEWS_004', categoryCode: 'NEWS_TECHNOLOGY', slug: 'isolasi-data-schema-per-pendaftar', title: 'Isolasi Data: Satu Schema PostgreSQL untuk Setiap Pendaftar', summary: 'Arsitektur control plane dan schema-per-tenant memastikan data tiap pendaftar terpisah beserta schema audit tersendiri.', tags: ['TAG_SECURITY'], daysAgo: 14 },
  { code: 'NEWS_005', categoryCode: 'NEWS_PRODUCT', slug: 'paket-berlangganan-fleksibel-per-mesin-kasir', title: 'Paket Berlangganan Fleksibel per Mesin Kasir', summary: 'Empat paket awal tersedia dengan modul berbeda, lengkap dengan tier volume dan add-on opsional.', tags: ['TAG_POS'], daysAgo: 18 },
  { code: 'NEWS_006', categoryCode: 'NEWS_PARTNERSHIP', slug: 'integrasi-pembayaran-esmartlink', title: 'Integrasi Pembayaran Langganan melalui Esmartlink', summary: 'Pembayaran langganan dapat dilakukan melalui virtual account bank, QRIS, dompet digital, dan gerai ritel.', tags: ['TAG_INTEGRATION', 'TAG_FINANCE'], daysAgo: 23 },
  { code: 'NEWS_007', categoryCode: 'NEWS_EDUCATION', slug: 'panduan-menyusun-minimum-stok', title: 'Panduan Menyusun Minimum Stok yang Realistis', summary: 'Menentukan reorder point, safety stock, dan lead time agar pemesanan tidak terlalu cepat maupun terlambat.', tags: ['TAG_INVENTORY', 'TAG_UMKM'], daysAgo: 27 },
  { code: 'NEWS_008', categoryCode: 'NEWS_SECURITY', slug: 'jejak-audit-append-only', title: 'Jejak Audit Append-Only pada Setiap Perubahan Data', summary: 'Setiap INSERT, UPDATE, dan DELETE tercatat pada schema audit terpisah yang tidak dapat diubah oleh aplikasi.', tags: ['TAG_SECURITY'], daysAgo: 32 },
  { code: 'NEWS_009', categoryCode: 'NEWS_EVENT', slug: 'webinar-digitalisasi-umkm-retail', title: 'Webinar: Digitalisasi Operasional UMKM Retail', summary: 'Sesi daring membahas langkah praktis memindahkan pencatatan manual ke sistem terintegrasi.', tags: ['TAG_UMKM', 'TAG_RETAIL'], daysAgo: 38 },
  { code: 'NEWS_010', categoryCode: 'NEWS_UPDATE', slug: 'dukungan-empat-bahasa-termasuk-rtl', title: 'Dukungan Empat Bahasa Termasuk Tata Letak RTL', summary: 'Antarmuka tersedia dalam Bahasa Indonesia, English, العربية dengan arah kanan-ke-kiri, dan 简体中文.', tags: ['TAG_RELEASE'], daysAgo: 44 },
  { code: 'NEWS_011', categoryCode: 'NEWS_EDUCATION', slug: 'mengapa-jurnal-posted-tidak-boleh-diedit', title: 'Mengapa Jurnal yang Sudah Diposting Tidak Boleh Diedit', summary: 'Prinsip immutability pada akuntansi dan bagaimana reversal menjaga integritas laporan keuangan.', tags: ['TAG_FINANCE'], daysAgo: 51 },
  { code: 'NEWS_012', categoryCode: 'NEWS_COMPANY', slug: 'peta-jalan-pengembangan-berikutnya', title: 'Peta Jalan Pengembangan Berikutnya', summary: 'Modul produksi, quality control, dan distribusi memasuki tahap pengembangan lanjutan.', tags: ['TAG_ERP', 'TAG_RELEASE'], daysAgo: 58 },
];

export const ANNOUNCEMENT_SEED = [
  { code: 'ANN_WELCOME', title: 'Selamat datang di eBisnis.id', body: 'Daftar sekarang dan nikmati masa uji coba 30 hari untuk setiap mesin kasir.', severity: 'INFO' as const, audience: 'PUBLIC' as const, sortOrder: 1 },
  { code: 'ANN_DEMO', title: 'Coba tanpa mendaftar', body: 'Gunakan tombol Coba Demo untuk menjelajah sandbox tanpa membuat akun.', severity: 'SUCCESS' as const, audience: 'PUBLIC' as const, sortOrder: 2 },
  { code: 'ANN_TRIAL', title: 'Uji coba 30 hari per mesin', body: 'Masa uji coba dihitung per mesin kasir sejak aktivasi pertama dan tidak berulang saat instal ulang.', severity: 'INFO' as const, audience: 'PUBLIC' as const, sortOrder: 3 },
  { code: 'ANN_PAYMENT', title: 'Pembayaran melalui Esmartlink', body: 'Tersedia virtual account bank, QRIS, dompet digital, dan gerai ritel.', severity: 'INFO' as const, audience: 'PUBLIC' as const, sortOrder: 4 },
  { code: 'ANN_SECURITY', title: 'Keamanan data pendaftar', body: 'Setiap pendaftar memperoleh schema database dan schema audit terpisah.', severity: 'SUCCESS' as const, audience: 'PUBLIC' as const, sortOrder: 5 },
  { code: 'ANN_SANDBOX', title: 'Sandbox demo dipakai bersama', body: 'Jangan memasukkan data pribadi atau rahasia. Data demo di-reset terjadwal.', severity: 'WARNING' as const, audience: 'PUBLIC' as const, sortOrder: 6 },
  { code: 'ANN_MULTILANG', title: 'Antarmuka multi-bahasa', body: 'Tersedia Bahasa Indonesia, English, العربية, dan 简体中文.', severity: 'INFO' as const, audience: 'PUBLIC' as const, sortOrder: 7 },
  { code: 'ANN_ROADMAP', title: 'Modul baru sedang dikembangkan', body: 'Produksi, quality control, dan distribusi akan menyusul pada rilis berikutnya.', severity: 'INFO' as const, audience: 'PUBLIC' as const, sortOrder: 8 },
  { code: 'ANN_ADMIN_PASSWORD', title: 'Ganti password administrator', body: 'Akun administrator development wajib mengganti password pada login pertama.', severity: 'CRITICAL' as const, audience: 'PLATFORM_ADMIN' as const, sortOrder: 9 },
  { code: 'ANN_TENANT_ONBOARDING', title: 'Selesaikan onboarding bisnis Anda', body: 'Lengkapi data perusahaan, brand, outlet, dan gudang agar seluruh modul dapat digunakan.', severity: 'INFO' as const, audience: 'TENANT' as const, sortOrder: 10 },
];

export const CALL_TO_ACTION_SEED = [
  { code: 'CTA_REGISTER', title: 'Siap memulai?', body: 'Daftarkan bisnis Anda hari ini dan aktifkan mesin kasir pertama dalam hitungan menit.', button: 'Daftar Gratis', url: '/daftar', style: 'primary', sortOrder: 1 },
  { code: 'CTA_DEMO', title: 'Ingin melihat dulu?', body: 'Jelajahi seluruh modul melalui sandbox demo tanpa perlu membuat akun.', button: 'Coba Demo', url: '/demo', style: 'secondary', sortOrder: 2 },
  { code: 'CTA_PRICING', title: 'Bandingkan paket', body: 'Pilih paket yang paling sesuai dengan kebutuhan modul dan jumlah mesin kasir Anda.', button: 'Lihat Harga', url: '/harga', style: 'outline', sortOrder: 3 },
  { code: 'CTA_CONTACT', title: 'Butuh bantuan implementasi?', body: 'Tim kami siap membantu memetakan kebutuhan bisnis Anda ke dalam sistem.', button: 'Hubungi Kami', url: '/kontak', style: 'outline', sortOrder: 4 },
];

export const CONTACT_OFFICE_SEED = [
  { code: 'OFFICE_HQ', name: 'Kantor Pusat eBisnis.id', address: 'Jalan Contoh Nomor 1, Jakarta Selatan, DKI Jakarta 12190', phone: '+62 21 0000 0000', email: 'halo@ebisnis.id', openingHours: 'Senin–Jumat, 09.00–17.00 WIB', isPrimary: true, sortOrder: 1 },
  { code: 'OFFICE_SUPPORT', name: 'Pusat Dukungan Pelanggan', address: 'Layanan daring 24/7 melalui portal dukungan', phone: '+62 811 0000 0000', email: 'dukungan@ebisnis.id', openingHours: 'Setiap hari, 24 jam', isPrimary: false, sortOrder: 2 },
];

export const MEDIA_FOLDER_SEED = [
  { code: 'MEDIA_ROOT', name: 'Media', path: '/MEDIA_ROOT', sortOrder: 1 },
  { code: 'MEDIA_BRAND', name: 'Brand', path: '/MEDIA_ROOT/MEDIA_BRAND', parentCode: 'MEDIA_ROOT', sortOrder: 2 },
  { code: 'MEDIA_HERO', name: 'Hero', path: '/MEDIA_ROOT/MEDIA_HERO', parentCode: 'MEDIA_ROOT', sortOrder: 3 },
  { code: 'MEDIA_MODULE', name: 'Modul', path: '/MEDIA_ROOT/MEDIA_MODULE', parentCode: 'MEDIA_ROOT', sortOrder: 4 },
  { code: 'MEDIA_NEWS', name: 'Berita', path: '/MEDIA_ROOT/MEDIA_NEWS', parentCode: 'MEDIA_ROOT', sortOrder: 5 },
  { code: 'MEDIA_TESTIMONIAL', name: 'Testimoni', path: '/MEDIA_ROOT/MEDIA_TESTIMONIAL', parentCode: 'MEDIA_ROOT', sortOrder: 6 },
  { code: 'MEDIA_PARTNER', name: 'Mitra', path: '/MEDIA_ROOT/MEDIA_PARTNER', parentCode: 'MEDIA_ROOT', sortOrder: 7 },
  { code: 'MEDIA_DOCUMENT', name: 'Dokumen', path: '/MEDIA_ROOT/MEDIA_DOCUMENT', parentCode: 'MEDIA_ROOT', sortOrder: 8 },
  { code: 'MEDIA_ICON', name: 'Ikon', path: '/MEDIA_ROOT/MEDIA_ICON', parentCode: 'MEDIA_ROOT', sortOrder: 9 },
  { code: 'MEDIA_MISC', name: 'Lainnya', path: '/MEDIA_ROOT/MEDIA_MISC', parentCode: 'MEDIA_ROOT', sortOrder: 10 },
];

export const NAVIGATION_SEED = {
  header: [
    { code: 'NAV_HOME', label: 'Beranda', url: '/', sortOrder: 1 },
    { code: 'NAV_FEATURES', label: 'Fitur', url: '/#fitur', sortOrder: 2 },
    { code: 'NAV_MODULES', label: 'Modul', url: '/#modul', sortOrder: 3 },
    { code: 'NAV_PRICING', label: 'Harga', url: '/harga', sortOrder: 4 },
    { code: 'NAV_NEWS', label: 'Berita', url: '/berita', sortOrder: 5 },
    { code: 'NAV_FAQ', label: 'FAQ', url: '/#faq', sortOrder: 6 },
    { code: 'NAV_CONTACT', label: 'Kontak', url: '/kontak', sortOrder: 7 },
  ],
  footer: [
    {
      code: 'FOOT_PRODUCT',
      title: 'Produk',
      items: [
        { code: 'FOOT_PRODUCT_POS', label: 'Kasir / POS', url: '/#modul' },
        { code: 'FOOT_PRODUCT_INVENTORY', label: 'Persediaan', url: '/#modul' },
        { code: 'FOOT_PRODUCT_FINANCE', label: 'Keuangan', url: '/#modul' },
        { code: 'FOOT_PRODUCT_PRICING', label: 'Harga', url: '/harga' },
      ],
    },
    {
      code: 'FOOT_COMPANY',
      title: 'Perusahaan',
      items: [
        { code: 'FOOT_COMPANY_ABOUT', label: 'Tentang', url: '/tentang' },
        { code: 'FOOT_COMPANY_NEWS', label: 'Berita', url: '/berita' },
        { code: 'FOOT_COMPANY_CONTACT', label: 'Kontak', url: '/kontak' },
      ],
    },
    {
      code: 'FOOT_LEGAL',
      title: 'Legal',
      items: [
        { code: 'FOOT_LEGAL_TERMS', label: 'Syarat Penggunaan', url: '/syarat' },
        { code: 'FOOT_LEGAL_PRIVACY', label: 'Kebijakan Privasi', url: '/privasi' },
      ],
    },
    {
      code: 'FOOT_SUPPORT',
      title: 'Dukungan',
      items: [
        { code: 'FOOT_SUPPORT_FAQ', label: 'FAQ', url: '/#faq' },
        { code: 'FOOT_SUPPORT_DEMO', label: 'Coba Demo', url: '/demo' },
        { code: 'FOOT_SUPPORT_LOGIN', label: 'Masuk', url: '/masuk' },
      ],
    },
  ],
};

export interface CmsBlockSeed {
  key: string;
  type: string;
  sortOrder: number;
  eyebrow?: string;
  heading?: string;
  subheading?: string;
  body?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface CmsPageSeed {
  code: string;
  slug: string;
  pageType: 'LANDING' | 'STANDARD' | 'LEGAL' | 'PRICING' | 'CONTACT' | 'NEWS_INDEX' | 'FAQ';
  title: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  showInNavigation: boolean;
  sortOrder: number;
  blocks: CmsBlockSeed[];
}

/**
 * Halaman CMS. Homepage disusun dari blok sehingga setiap bagian dapat
 * diaktifkan, diurutkan ulang, dan diubah teksnya melalui CMS admin.
 */
export const CMS_PAGE_SEED: CmsPageSeed[] = [
  {
    code: 'PAGE_HOME',
    slug: 'beranda',
    pageType: 'LANDING' as const,
    title: 'eBisnis.id — Platform SaaS POS & ERP Terintegrasi',
    summary:
      'Satu aplikasi untuk kasir, toko, dan seluruh bisnis Anda. Kelola POS, persediaan, pembelian, keuangan, SDM, dan bagi hasil investor dalam satu platform.',
    seoTitle: 'eBisnis.id — Platform SaaS POS & ERP Retail Terintegrasi',
    seoDescription:
      'Platform SaaS POS dan ERP untuk retail, F&B, distribusi, dan manufaktur. Multi-brand, multi-toko, offline-first, dengan bagi hasil investor.',
    showInNavigation: true,
    sortOrder: 1,
    blocks: [
      { key: 'hero', type: 'HERO', sortOrder: 1, heading: 'Satu Aplikasi untuk Kasir, Toko, dan Seluruh Bisnis Anda', subheading: 'Dari gerai pertama sampai banyak brand.' },
      { key: 'partners', type: 'PARTNER_LOGOS', sortOrder: 2, heading: 'Dipercaya oleh mitra dan pelaku usaha' },
      { key: 'features', type: 'FEATURE_GRID', sortOrder: 3, eyebrow: 'Ringkasan Platform', heading: 'Bukan Sekadar Aplikasi Kasir, Tetapi Pusat Data Bisnis Anda', subheading: 'Seluruh proses operasional terhubung dalam satu sumber data yang konsisten.' },
      { key: 'modules', type: 'MODULE_SHOWCASE', sortOrder: 4, eyebrow: 'Modul', heading: 'Modul Manajemen Lengkap untuk Setiap Pendaftar', subheading: 'Aktifkan modul sesuai kebutuhan melalui paket berlangganan.' },
      { key: 'advantages', type: 'ADVANTAGE_GRID', sortOrder: 5, eyebrow: 'Keunggulan', heading: 'Dari Kasir Tradisional Menjadi Pusat Data Bisnis' },
      { key: 'how-it-works', type: 'STEP_LIST', sortOrder: 6, eyebrow: 'Cara Memulai', heading: 'Dari Daftar Sampai Kasir Pertama Berjualan', subheading: 'Enam langkah sederhana yang dapat diselesaikan sendiri.' },
      { key: 'demo-cta', type: 'CALL_TO_ACTION', sortOrder: 7, heading: 'Ingin melihat dulu?', body: 'Jelajahi seluruh modul melalui sandbox demo tanpa perlu membuat akun.', buttonLabel: 'Coba Demo', buttonUrl: '/demo' },
      { key: 'pricing', type: 'PRICING_CARDS', sortOrder: 8, eyebrow: 'Harga Berlangganan', heading: 'Bayar per Mesin Kasir, Pilih Paket Modul Sesuai Kebutuhan', subheading: 'Harga dasar sebelum pajak dan biaya administrasi yang berlaku.' },
      { key: 'news', type: 'NEWS_LATEST', sortOrder: 9, eyebrow: 'Berita', heading: 'Kabar Terbaru' },
      { key: 'announcements', type: 'ANNOUNCEMENTS', sortOrder: 10, heading: 'Pengumuman' },
      { key: 'testimonials', type: 'TESTIMONIALS', sortOrder: 11, eyebrow: 'Testimoni', heading: 'Apa Kata Pengguna Kami' },
      { key: 'faq', type: 'FAQ', sortOrder: 12, eyebrow: 'FAQ', heading: 'Pertanyaan yang Sering Diajukan' },
      { key: 'register-cta', type: 'CALL_TO_ACTION', sortOrder: 13, heading: 'Siap memulai?', body: 'Daftarkan bisnis Anda hari ini dan aktifkan mesin kasir pertama dalam hitungan menit.', buttonLabel: 'Daftar Gratis', buttonUrl: '/daftar' },
      { key: 'contact', type: 'CONTACT', sortOrder: 14, eyebrow: 'Kontak', heading: 'Hubungi Kami' },
    ],
  },
  {
    code: 'PAGE_PRICING',
    slug: 'harga',
    pageType: 'PRICING' as const,
    title: 'Harga dan Paket Berlangganan',
    summary: 'Bandingkan paket berlangganan eBisnis.id berdasarkan modul dan jumlah mesin kasir.',
    seoTitle: 'Harga Berlangganan eBisnis.id',
    seoDescription: 'Paket POS Starter, Business, Professional, dan Complete dengan harga per mesin kasir per bulan.',
    showInNavigation: true,
    sortOrder: 2,
    blocks: [
      { key: 'pricing-hero', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Harga Berlangganan', subheading: 'Bayar per mesin kasir. Pilih modul sesuai kebutuhan bisnis Anda.' },
      { key: 'pricing-cards', type: 'PRICING_CARDS', sortOrder: 2, heading: 'Pilih Paket Anda' },
      { key: 'pricing-faq', type: 'FAQ', sortOrder: 3, heading: 'Pertanyaan Seputar Harga' },
    ],
  },
  {
    code: 'PAGE_ABOUT',
    slug: 'tentang',
    pageType: 'STANDARD' as const,
    title: 'Tentang eBisnis.id',
    summary: 'Platform SaaS POS dan ERP yang dibangun untuk pelaku usaha Indonesia.',
    seoTitle: 'Tentang eBisnis.id',
    seoDescription: 'Mengenal eBisnis.id, platform SaaS POS dan ERP multi-tenant untuk retail, F&B, distribusi, dan manufaktur.',
    showInNavigation: true,
    sortOrder: 3,
    blocks: [
      { key: 'about-header', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Tentang eBisnis.id', subheading: 'Membantu pelaku usaha tumbuh dari satu gerai menjadi banyak brand.' },
      { key: 'about-body', type: 'RICH_TEXT', sortOrder: 2, body: '<p>eBisnis.id adalah platform SaaS yang menyatukan kasir, penjualan, pembelian, persediaan, produksi, keuangan, sumber daya manusia, dan bagi hasil investor dalam satu sistem terintegrasi.</p><p>Setiap pendaftar memperoleh ruang data sendiri berupa schema PostgreSQL terpisah beserta schema audit, sehingga data operasional tidak bercampur dengan pengguna lain.</p><p>Kami merancang platform ini agar dapat dikonfigurasi, bukan ditulis ulang. Paket, harga, modul, menu, dan hak akses dikelola melalui panel administrasi.</p>' },
      { key: 'about-features', type: 'FEATURE_GRID', sortOrder: 3, heading: 'Prinsip Produk Kami' },
    ],
  },
  {
    code: 'PAGE_TERMS',
    slug: 'syarat',
    pageType: 'LEGAL' as const,
    title: 'Syarat Penggunaan',
    summary: 'Ketentuan penggunaan layanan eBisnis.id.',
    seoTitle: 'Syarat Penggunaan eBisnis.id',
    seoDescription: 'Ketentuan penggunaan layanan platform eBisnis.id.',
    showInNavigation: false,
    sortOrder: 4,
    blocks: [
      { key: 'terms-header', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Syarat Penggunaan' },
      { key: 'terms-body', type: 'RICH_TEXT', sortOrder: 2, body: '<h2>1. Penerimaan Ketentuan</h2><p>Dengan mendaftar dan menggunakan layanan eBisnis.id, Anda menyatakan telah membaca, memahami, dan menyetujui ketentuan ini.</p><h2>2. Akun dan Keamanan</h2><p>Anda bertanggung jawab menjaga kerahasiaan kredensial akun dan seluruh aktivitas yang terjadi pada akun tersebut.</p><h2>3. Penggunaan yang Diperbolehkan</h2><p>Layanan hanya boleh digunakan untuk keperluan bisnis yang sah dan tidak melanggar peraturan perundang-undangan yang berlaku.</p><h2>4. Data Pelanggan</h2><p>Data operasional yang Anda masukkan tetap menjadi milik Anda. Kami memprosesnya semata-mata untuk menyediakan layanan.</p><h2>5. Langganan dan Pembayaran</h2><p>Biaya langganan dihitung per mesin kasir per periode sesuai paket yang dipilih. Invoice yang telah diterbitkan bersifat final dan koreksi dilakukan melalui nota kredit.</p><h2>6. Sandbox Demo</h2><p>Sandbox demo digunakan bersama dan di-reset secara berkala. Jangan memasukkan data pribadi atau rahasia ke dalam sandbox.</p><h2>7. Perubahan Ketentuan</h2><p>Kami dapat memperbarui ketentuan ini dan akan memberitahukan perubahan material melalui kanal resmi.</p>' },
    ],
  },
  {
    code: 'PAGE_PRIVACY',
    slug: 'privasi',
    pageType: 'LEGAL' as const,
    title: 'Kebijakan Privasi',
    summary: 'Bagaimana eBisnis.id mengumpulkan, memakai, dan melindungi data Anda.',
    seoTitle: 'Kebijakan Privasi eBisnis.id',
    seoDescription: 'Kebijakan privasi dan perlindungan data pengguna platform eBisnis.id.',
    showInNavigation: false,
    sortOrder: 5,
    blocks: [
      { key: 'privacy-header', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Kebijakan Privasi' },
      { key: 'privacy-body', type: 'RICH_TEXT', sortOrder: 2, body: '<h2>1. Data yang Kami Kumpulkan</h2><p>Kami mengumpulkan data pendaftaran bisnis, identitas kontak, serta data operasional yang Anda masukkan ke dalam sistem.</p><h2>2. Tujuan Pemrosesan</h2><p>Data diproses untuk menyediakan layanan, menagih langganan, memberikan dukungan teknis, dan memenuhi kewajiban hukum.</p><h2>3. Isolasi Data</h2><p>Setiap pendaftar memperoleh schema basis data terpisah beserta schema audit tersendiri.</p><h2>4. Akses Dukungan</h2><p>Akses tim dukungan ke data tenant bersifat eksplisit, terbatas waktu, memerlukan alasan tertulis, dan tercatat pada jejak audit ganda.</p><h2>5. Retensi</h2><p>Data audit disimpan sesuai kebijakan retensi dan hanya diarsipkan melalui proses terotorisasi.</p><h2>6. Hak Anda</h2><p>Anda dapat meminta akses, koreksi, atau penghapusan data pribadi sesuai peraturan yang berlaku.</p><h2>7. Kontak</h2><p>Pertanyaan mengenai privasi dapat dikirimkan melalui halaman Kontak.</p>' },
    ],
  },
  {
    code: 'PAGE_CONTACT',
    slug: 'kontak',
    pageType: 'CONTACT' as const,
    title: 'Hubungi Kami',
    summary: 'Kirim pertanyaan atau permintaan demo kepada tim eBisnis.id.',
    seoTitle: 'Kontak eBisnis.id',
    seoDescription: 'Hubungi tim eBisnis.id untuk pertanyaan produk, harga, atau implementasi.',
    showInNavigation: true,
    sortOrder: 6,
    blocks: [
      { key: 'contact-header', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Hubungi Kami', subheading: 'Tim kami siap membantu memetakan kebutuhan bisnis Anda.' },
      { key: 'contact-form', type: 'CONTACT', sortOrder: 2 },
    ],
  },
  {
    code: 'PAGE_NEWS',
    slug: 'berita',
    pageType: 'NEWS_INDEX' as const,
    title: 'Berita dan Pembaruan',
    summary: 'Kabar terbaru mengenai produk, pembaruan, dan kegiatan eBisnis.id.',
    seoTitle: 'Berita eBisnis.id',
    seoDescription: 'Berita, pembaruan produk, dan kegiatan terbaru dari eBisnis.id.',
    showInNavigation: true,
    sortOrder: 7,
    blocks: [
      { key: 'news-header', type: 'PAGE_HEADER', sortOrder: 1, heading: 'Berita dan Pembaruan' },
      { key: 'news-list', type: 'NEWS_LIST', sortOrder: 2 },
    ],
  },
];

export const PRICING_SECTION_SEED = {
  code: 'PRICING_MAIN',
  title: 'Harga Berlangganan',
  description: 'Bayar per mesin kasir per bulan. Pilih paket sesuai modul yang dibutuhkan.',
  displayMode: 'CARDS',
  footnote: 'Harga dasar sebelum pajak dan biaya administrasi yang berlaku. Harga dapat berubah sesuai versi paket yang dipublikasikan.',
};
