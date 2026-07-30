/**
 * Katalog role default Indonesia — blueprint Versi 8 Revisi 1 bagian C.
 *
 * Setiap role menyatakan profil hak per MODUL, bukan per menu. Seeder yang
 * menurunkannya ke menu, sehingga menu baru otomatis terwarisi tanpa mengubah
 * berkas ini.
 *
 * Role dengan `platformOnly: true` tidak disemai pada schema tenant — tempatnya
 * di control plane. Ia tetap dicantumkan agar katalognya utuh dan dapat dirujuk
 * dokumentasi maupun pengujian.
 */
import type { DataScopeCode, ProfileCode } from './role-profile';

export interface RoleCatalogEntry {
  code: string;
  name: string;
  family: string;
  /**
   * Profil utama role. Dipakai untuk tampilan, dan — hanya bila `allModules`
   * bernilai true — sebagai profil setiap modul yang tidak disebut `modules`.
   */
  profile: ProfileCode;
  /**
   * Profil per kode modul (kode menu root). Modul yang TIDAK disebut di sini
   * berarti tanpa akses, kecuali `allModules` bernilai true.
   */
  modules: Record<string, ProfileCode>;
  /**
   * Berlaku untuk seluruh modul. Hanya untuk role yang memang menyeluruh:
   * administrator tenant, auditor, dan pemilik. Tanpa penanda ini, role sempit
   * tidak dapat merembes ke modul yang tidak disebutkan.
   */
  allModules?: boolean;
  dataScope: DataScopeCode;
  /**
   * Kelompok pemisahan tugas. Dua role dalam kelompok yang sama dengan sisi
   * berlawanan tidak boleh dipegang satu orang.
   */
  sodGroup?: string;
  sodSide?: 'PREPARER' | 'APPROVER' | 'EXECUTOR' | 'CUSTODIAN';
  /** Hanya untuk control plane; tidak disemai pada schema tenant. */
  platformOnly?: boolean;
  /** Role inti disemai untuk seluruh tenant baru; sisanya opsional. */
  core?: boolean;
  /** Padanan role lama Versi 5 agar penugasan yang ada tidak putus. */
  legacyCode?: string;
  description: string;
}

/** Modul akses dasar yang dimiliki hampir setiap pengguna. */
const BASE: Record<string, ProfileCode> = { HOME: 'P1', SUPPORT: 'P1' };

const r = (
  code: string,
  name: string,
  family: string,
  profile: ProfileCode,
  modules: Record<string, ProfileCode>,
  dataScope: DataScopeCode,
  description: string,
  extra: Partial<RoleCatalogEntry> = {},
): RoleCatalogEntry => ({
  code, name, family, profile,
  modules: { ...BASE, ...modules },
  dataScope, description, ...extra,
});

export const ROLE_CATALOG: RoleCatalogEntry[] = [
  // ---------------------------------------------------------------- Platform
  r('SUPER_ADMIN_PLATFORM', 'Super Administrator Platform', 'Platform', 'P8',
    { ADMIN: 'P8', SUBSCRIPTION: 'P8' }, 'PLATFORM',
    'Seluruh hak platform. Tidak menjadi pengguna transaksi tenant secara bawaan.',
    { platformOnly: true, allModules: true }),
  r('ADMIN_PLATFORM', 'Administrator Platform', 'Platform', 'P7',
    { ADMIN: 'P7', SUBSCRIPTION: 'P7' }, 'PLATFORM',
    'Tenant, paket, billing, CMS, dan monitoring. Tidak melihat data bisnis tenant tanpa sesi dukungan.',
    { platformOnly: true }),
  r('IMPLEMENTOR_TENANT', 'Implementor dan Onboarding Tenant', 'Platform', 'P7',
    { ADMIN: 'P7', MASTER_DATA: 'P7' }, 'TENANT',
    'Provisioning, master seed, dan konfigurasi tenant. Akses dukungan wajib beralasan dan diaudit.',
    { platformOnly: true }),
  r('SUPPORT_L1', 'Petugas Dukungan Tingkat 1', 'Platform Support', 'P2',
    { SUPPORT: 'P2' }, 'ASSIGNED_QUEUE',
    'Antrean tingkat 1. Tidak melihat data keuangan maupun gaji.', { platformOnly: true }),
  r('SUPPORT_L2', 'Petugas Dukungan Tingkat 2', 'Platform Support', 'P5',
    { SUPPORT: 'P5', INTEGRATION: 'P1' }, 'ASSIGNED_QUEUE',
    'Diagnostik integrasi dan konfigurasi baca. Perubahan produksi menuntut persetujuan.',
    { platformOnly: true }),
  r('SUPPORT_L3', 'Petugas Dukungan Tingkat 3', 'Platform Support', 'P6',
    { SUPPORT: 'P6', INTEGRATION: 'P5', ADMIN: 'P1' }, 'ASSIGNED_QUEUE',
    'Diagnostik teknis dan tampilan migration. Perubahan sensitif lewat alur perubahan.',
    { platformOnly: true }),
  r('ADMIN_BILLING_PLATFORM', 'Administrator Billing Platform', 'Platform', 'P7',
    { SUBSCRIPTION: 'P7' }, 'PLATFORM',
    'Paket, langganan, tagihan, pembayaran, dan rekonsiliasi. Tidak mengubah role tenant.',
    { platformOnly: true }),
  r('ADMIN_CMS_PLATFORM', 'Administrator Website Platform', 'Platform', 'P7',
    { ADMIN: 'P1' }, 'PLATFORM',
    'CMS platform dan penerbitan bantuan. Tidak mengakses transaksi tenant.', { platformOnly: true }),
  r('AUDITOR_PLATFORM', 'Auditor Platform', 'Platform', 'P9', {}, 'PLATFORM',
    'Hanya baca. Audit, laporan keamanan, dan billing.',
    { platformOnly: true, allModules: true }),
  r('DEVOPS_RELEASE', 'Administrator DevOps dan Rilis', 'Platform', 'P7',
    { ADMIN: 'P7', INTEGRATION: 'P7' }, 'PLATFORM',
    'Rilis, kesehatan sistem, status migration, dan pekerjaan latar belakang. Tanpa hak transaksi bisnis.',
    { platformOnly: true }),
  r('PETUGAS_KEAMANAN_PLATFORM', 'Petugas Keamanan Platform', 'Platform', 'P7',
    { ADMIN: 'P7' }, 'PLATFORM',
    'Peristiwa keamanan, tata kelola role, MFA, dan audit. Tidak memproses transaksi bisnis.',
    { platformOnly: true }),

  // ------------------------------------------------------------------- Umum
  r('ADMIN_TENANT', 'Administrator Tenant', 'Umum', 'P8', {}, 'TENANT',
    'Seluruh menu tenant. Hapus permanen dan posting sensitif menuntut step-up atau persetujuan.',
    { core: true, allModules: true }),
  r('PEMILIK_USAHA', 'Pemilik Usaha', 'Manajemen', 'P11',
    { INVESTOR: 'P11', REPORTING: 'P11' }, 'TENANT',
    'Dashboard, laporan, investor, dan persetujuan strategis. Tidak melakukan transaksi kas harian.',
    { core: true, legacyCode: 'OWNER', allModules: true }),
  r('DIREKTUR', 'Direktur / Pimpinan', 'Manajemen', 'P11',
    { REPORTING: 'P11', FINANCE: 'P11' }, 'LEGAL_ENTITY',
    'Dashboard, persetujuan, laporan, anggaran, dan investor. Tidak mengubah master teknis.',
    { allModules: true }),
  r('MANAJER_OPERASIONAL', 'Manajer Operasional', 'Manajemen', 'P6',
    { POS: 'P6', SALES: 'P6', INVENTORY: 'P6', SHIPPING: 'P6', MANUFACTURING: 'P6', HR: 'P1' }, 'BRAND',
    'Operasional harian lintas modul. Payroll rinci tidak termasuk kecuali diberikan.',
    { core: true, legacyCode: 'MANAGER' }),
  r('AUDITOR_INTERNAL', 'Auditor Internal', 'Audit', 'P9', {}, 'TENANT',
    'Hanya baca atas seluruh laporan dan audit.', { allModules: true }),
  r('AUDITOR_EKSTERNAL', 'Auditor Eksternal', 'Audit', 'P9',
    { FINANCE: 'P9', REPORTING: 'P9' }, 'LEGAL_ENTITY',
    'Hanya baca, terbatas periode dan entitas yang ditugaskan.'),
  r('PENGGUNA_BACA_SAJA', 'Pengguna Baca Saja', 'Umum', 'P1', {}, 'TENANT',
    'Melihat menu sesuai penugasan tanpa perubahan apa pun.',
    { core: true, allModules: true }),
  r('KARYAWAN', 'Karyawan / Pengguna Dasar', 'Self Service', 'P10',
    { HR: 'P10', SUPPORT: 'P10' }, 'SELF',
    'Layanan mandiri, tiket, bantuan, biaya, dan timesheet. Tidak melihat data rekan.',
    { core: true }),
  r('ATASAN_LANGSUNG', 'Atasan Langsung', 'Self Service', 'P4',
    { HR: 'P4', WORKFLOW: 'P4' }, 'TEAM',
    'Persetujuan, kehadiran, dan kinerja tim langsung. Tidak mengubah payroll.'),

  // ------------------------------------------------------------------- Data
  r('ADMIN_MASTER_DATA', 'Administrator Master Data', 'Data', 'P7',
    { MASTER_DATA: 'P7', CATALOG: 'P7', CRM: 'P5', PURCHASING: 'P5' }, 'TENANT',
    'Master data, katalog, dan pihak. Tidak melakukan posting transaksi.', { core: true }),
  r('ANALIS_BISNIS', 'Analis Bisnis', 'Analitik', 'P1',
    { REPORTING: 'P1' }, 'TENANT', 'Laporan dan analitik. Tidak mengubah transaksi.'),
  r('DESAINER_LAPORAN', 'Desainer Laporan', 'Analitik', 'P7',
    { REPORTING: 'P7' }, 'TENANT',
    'Perancang laporan dan dashboard. Tidak memperoleh data di luar izin sumbernya.'),
  r('ADMIN_IMPOR_DATA', 'Administrator Impor Data', 'Data', 'P3',
    { MASTER_DATA: 'P3', CATALOG: 'P3', CRM: 'P3', PURCHASING: 'P3' }, 'TENANT',
    'Pusat impor dan ekspor. Tidak boleh menghapus permanen; seluruh impor diaudit.'),

  // -------------------------------------------------------------------- POS
  r('KASIR_POS', 'Kasir POS', 'POS', 'P2',
    { POS: 'P2', CATALOG: 'P1', CRM: 'P2' }, 'OUTLET_TERMINAL',
    'Transaksi dan shift pada satu outlet dan terminal. Void serta refund menuntut supervisor.',
    { core: true, legacyCode: 'CASHIER', sodGroup: 'POS_VOID', sodSide: 'PREPARER' }),
  r('SUPERVISOR_KASIR', 'Supervisor Kasir', 'POS', 'P6',
    { POS: 'P6', SALES: 'P2', FINANCE: 'P1' }, 'OUTLET',
    'Shift, void, refund, dan rekonsiliasi. Tidak mengubah setelan akuntansi.',
    { core: true, sodGroup: 'POS_VOID', sodSide: 'APPROVER' }),
  r('KEPALA_TOKO', 'Kepala Toko', 'Retail', 'P6',
    { POS: 'P6', SALES: 'P6', INVENTORY: 'P5', HR: 'P2', REPORTING: 'P1' }, 'OUTLET',
    'Satu atau lebih outlet. Pembayaran dan penyesuaian stok dibatasi ambang.'),
  r('PRAMUNIAGA', 'Pramuniaga', 'Retail', 'P2',
    { CATALOG: 'P1', CRM: 'P2', SALES: 'P2', INVENTORY: 'P1' }, 'OUTLET',
    'Produk, pelanggan, dan pesanan. Penerimaan pembayaran akhir tetap pada kasir.'),

  // ------------------------------------------------------------------ Sales
  r('ADMIN_PENJUALAN', 'Administrator Penjualan', 'Sales', 'P5',
    { SALES: 'P5', CRM: 'P5', CATALOG: 'P1' }, 'BRAND',
    'Pesanan dan draf tagihan. Nota kredit dan refund menuntut persetujuan.'),
  r('SALES', 'Tenaga Penjualan', 'Sales', 'P2',
    { CRM: 'P2', SALES: 'P2', CATALOG: 'P1' }, 'SELF',
    'Prospek, peluang, penawaran, dan pesanan. Tidak mengubah harga pokok maupun margin.'),
  r('SUPERVISOR_PENJUALAN', 'Supervisor Penjualan', 'Sales', 'P6',
    { SALES: 'P6', CRM: 'P6', CATALOG: 'P1' }, 'TEAM',
    'CRM, penjualan, target, dan persetujuan diskon dalam ambang.'),
  r('MANAJER_PENJUALAN', 'Manajer Penjualan', 'Sales', 'P6',
    { SALES: 'P6', CRM: 'P6', CATALOG: 'P5', REPORTING: 'P1' }, 'BRAND',
    'Seluruh penjualan, CRM, dan laporan harga. Tidak mengubah aturan akuntansi.'),
  r('LAYANAN_PELANGGAN', 'Petugas Layanan Pelanggan', 'Customer Service', 'P2',
    { CRM: 'P2', SALES: 'P1', SUPPORT: 'P2' }, 'ASSIGNED_QUEUE',
    'CRM, tiket, status pesanan, dan permintaan retur. Refund menuntut persetujuan.'),
  r('MANAJER_CRM', 'Manajer CRM', 'CRM', 'P7',
    { CRM: 'P7', SALES: 'P1', REPORTING: 'P1' }, 'TENANT',
    'CRM, loyalitas, kampanye, dan analitik. Tidak melihat kredensial pembayaran.'),

  // ------------------------------------------------------------- E-commerce
  r('ADMIN_ECOMMERCE', 'Administrator E-commerce', 'E-commerce', 'P7',
    { CATALOG: 'P7', SALES: 'P6', CRM: 'P5' }, 'BRAND',
    'Katalog daring, pesanan, promo, dan konektor. Settlement keuangan terbatas baca.'),
  r('OPERATOR_MARKETPLACE', 'Operator Marketplace', 'E-commerce', 'P2',
    { SALES: 'P2', CATALOG: 'P1', INTEGRATION: 'P1' }, 'BRAND',
    'Pesanan marketplace, sinkronisasi, dan pemenuhan. Harga dasar tidak diubah tanpa persetujuan.'),
  r('MANAJER_HARGA_PROMO', 'Manajer Harga dan Promosi', 'Pricing', 'P6',
    { CATALOG: 'P6', SALES: 'P1' }, 'BRAND',
    'Price book, diskon, promo, dan kupon. Perubahan aktif menuntut persetujuan bila melewati ambang.'),
  r('PETUGAS_KREDIT_PENAGIHAN', 'Petugas Kredit dan Penagihan', 'AR', 'P2',
    { FINANCE: 'P2', CRM: 'P1', SALES: 'P1' }, 'LEGAL_ENTITY',
    'Batas kredit, penagihan, dan pengingat. Tidak menerima pembayaran tunai.',
    { sodGroup: 'AR_CASH', sodSide: 'PREPARER' }),

  // ------------------------------------------------------------- Purchasing
  r('PEMOHON_PEMBELIAN', 'Pemohon Pembelian', 'Purchasing', 'P10',
    { PURCHASING: 'P10' }, 'DEPARTMENT',
    'Mengajukan permintaan pembelian. Tidak menyetujui pengajuan sendiri.',
    { sodGroup: 'PR_APPROVAL', sodSide: 'PREPARER' }),
  r('PENYETUJU_PR', 'Penyetuju Permintaan Pembelian', 'Purchasing', 'P4',
    { PURCHASING: 'P4' }, 'DEPARTMENT',
    'Kotak masuk permintaan dan tampilan anggaran. Tidak menyetujui pengajuan sendiri.',
    { sodGroup: 'PR_APPROVAL', sodSide: 'APPROVER' }),
  r('STAF_PURCHASING', 'Staf Purchasing', 'Purchasing', 'P5',
    { PURCHASING: 'P5', CATALOG: 'P1', INVENTORY: 'P1' }, 'LEGAL_ENTITY',
    'RFQ, perbandingan, PO, dan pemasok. Tidak menerima barang sekaligus membayar tagihannya.',
    { core: true, legacyCode: 'PURCHASING_STAFF', sodGroup: 'PO_RECEIPT_PAY', sodSide: 'PREPARER' }),
  r('BUYER', 'Buyer / Pembeli', 'Purchasing', 'P2',
    { PURCHASING: 'P2', CATALOG: 'P1' }, 'LEGAL_ENTITY',
    'RFQ, negosiasi, dan PO. Perubahan master pemasok terpisah.'),
  r('MANAJER_PURCHASING', 'Manajer Purchasing', 'Purchasing', 'P6',
    { PURCHASING: 'P6', CATALOG: 'P1', REPORTING: 'P1' }, 'LEGAL_ENTITY',
    'Permintaan, RFQ, PO, persetujuan, dan kinerja pemasok. Pembayaran tidak termasuk.'),
  r('MANAJER_VENDOR', 'Manajer Pemasok', 'Vendor', 'P7',
    { PURCHASING: 'P7', MASTER_DATA: 'P5' }, 'TENANT',
    'Onboarding, kualifikasi, dan kontrak pemasok. Tidak memproses pembayaran.',
    { sodGroup: 'VENDOR_PAYMENT', sodSide: 'CUSTODIAN' }),
  r('MANAJER_KONTRAK', 'Manajer Kontrak', 'Contract', 'P6',
    { PURCHASING: 'P6', SALES: 'P5' }, 'LEGAL_ENTITY',
    'Siklus hidup kontrak, perpanjangan, dan kewajiban. Tidak membuat pembayaran langsung.'),

  // -------------------------------------------------------------- Warehouse
  r('KEPALA_GUDANG', 'Kepala Gudang', 'Warehouse', 'P6',
    { INVENTORY: 'P6', PURCHASING: 'P5', SHIPPING: 'P2' }, 'WAREHOUSE',
    'Persediaan, penerimaan, transfer, dan pencacahan. Penyesuaian disetujui pihak berbeda dari pembuatnya.',
    { core: true, sodGroup: 'STOCK_ADJUSTMENT', sodSide: 'APPROVER' }),
  r('ADMIN_GUDANG', 'Administrator Gudang', 'Warehouse', 'P5',
    { INVENTORY: 'P5', PURCHASING: 'P2', CATALOG: 'P1' }, 'WAREHOUSE',
    'Operasi persediaan, penerimaan, dan transfer. Tidak menyetujui penyesuaian buatannya sendiri.',
    { core: true, legacyCode: 'WAREHOUSE_STAFF', sodGroup: 'STOCK_ADJUSTMENT', sodSide: 'PREPARER' }),
  r('PETUGAS_PENERIMAAN', 'Petugas Penerimaan Barang', 'Warehouse', 'P2',
    { INVENTORY: 'P2', PURCHASING: 'P2' }, 'WAREHOUSE',
    'Penerimaan barang dan dokumennya. Tidak membuat maupun menyetujui PO.',
    { sodGroup: 'PO_RECEIPT_PAY', sodSide: 'CUSTODIAN' }),
  r('PETUGAS_PUTAWAY', 'Petugas Penempatan Barang', 'Warehouse', 'P2',
    { INVENTORY: 'P2' }, 'WAREHOUSE', 'Penempatan dan perpindahan bin. Tidak menyesuaikan kuantitas.'),
  r('PICKER', 'Petugas Pengambilan Barang', 'Warehouse', 'P2',
    { INVENTORY: 'P2', SALES: 'P1' }, 'WAREHOUSE',
    'Tugas pengambilan dan pemindaian. Tidak mengubah sumber pesanan.'),
  r('PACKER', 'Petugas Pengemasan', 'Warehouse', 'P2',
    { INVENTORY: 'P2', SHIPPING: 'P2' }, 'WAREHOUSE',
    'Pengemasan, label, dan persiapan manifest. Perubahan kuantitas hanya lewat discrepancy.'),
  r('PENGENDALI_STOK', 'Pengendali Persediaan', 'Inventory', 'P5',
    { INVENTORY: 'P5', PURCHASING: 'P2', REPORTING: 'P1' }, 'WAREHOUSE',
    'Saldo, transfer, replenishment, dan pencacahan. Posting penyesuaian dibatasi ambang.'),
  r('AUDITOR_STOK', 'Auditor Persediaan', 'Inventory Audit', 'P9',
    { INVENTORY: 'P9' }, 'WAREHOUSE',
    'Pencacahan, laporan selisih, dan audit. Tidak melakukan posting penyesuaian.'),
  r('PENGELOLA_BATCH_SERIAL', 'Pengelola Batch dan Serial', 'Inventory', 'P5',
    { INVENTORY: 'P5', QUALITY: 'P2' }, 'WAREHOUSE',
    'Batch, serial, kedaluwarsa, dan penarikan. Tidak mengubah valuasi keuangan.'),

  // -------------------------------------------------------------- Logistics
  r('MANAJER_LOGISTIK', 'Manajer Logistik', 'Logistics', 'P6',
    { SHIPPING: 'P6', INVENTORY: 'P2', REPORTING: 'P1' }, 'TENANT',
    'Ekspedisi, armada, rute, dan laporan. Persetujuan settlement perjalanan terpisah.'),
  r('DISPATCHER', 'Dispatcher Ekspedisi', 'Logistics', 'P5',
    { SHIPPING: 'P5' }, 'WAREHOUSE',
    'Perencanaan perjalanan, penugasan, peta, dan peringatan. Tidak mengubah payroll sopir.'),
  r('SOPIR', 'Sopir', 'Driver', 'P10', { SHIPPING: 'P10' }, 'ASSIGNED_TRIP',
    'Aplikasi sopir, perjalanan, bukti pengiriman, biaya, dan insiden. Hanya data perjalanan sendiri.'),
  r('KENEK', 'Kenek / Asisten Sopir', 'Driver', 'P10', { SHIPPING: 'P10' }, 'ASSIGNED_TRIP',
    'Checklist, pemindaian, dan bantuan bukti pengiriman. Tidak menutup settlement.'),
  r('MANAJER_ARMADA', 'Manajer Armada', 'Fleet', 'P7',
    { SHIPPING: 'P7', ASSET: 'P5' }, 'TENANT',
    'Kendaraan, dokumen, pemeliharaan, dan utilisasi. Tidak melakukan pembayaran langsung.'),
  r('MONITOR_GPS', 'Petugas Monitor GPS', 'GPS', 'P1', { SHIPPING: 'P1' }, 'TENANT',
    'Peta langsung, peringatan, geofence, dan insiden. Tidak mengubah data keuangan perjalanan.'),
  r('VERIFIKATOR_POD', 'Verifikator Bukti Pengiriman', 'Logistics', 'P4',
    { SHIPPING: 'P4', INVENTORY: 'P1' }, 'OUTLET',
    'Bukti pengiriman, selisih, dan validasi retur. Tidak membuat perjalanan.'),
  r('PETUGAS_SETTLEMENT_TRIP', 'Petugas Settlement Perjalanan', 'Logistics Finance', 'P5',
    { SHIPPING: 'P5', FINANCE: 'P2' }, 'LEGAL_ENTITY',
    'Biaya, bahan bakar, tol, dan settlement. Persetujuan pembayaran terpisah.'),

  // ------------------------------------------------------------ Manufacture
  r('MANAJER_PRODUKSI', 'Manajer Produksi', 'Manufacturing', 'P6',
    { MANUFACTURING: 'P6', INVENTORY: 'P2', REPORTING: 'P1' }, 'LEGAL_ENTITY',
    'Perencanaan, MRP, produksi, dan laporan biaya. Perubahan BOM mengikuti persetujuan.'),
  r('PERENCANA_PRODUKSI', 'Perencana Produksi', 'Manufacturing', 'P5',
    { MANUFACTURING: 'P5', INVENTORY: 'P1' }, 'LEGAL_ENTITY',
    'Permintaan, jadwal induk, MRP, dan perintah produksi. Tidak melakukan posting biaya akhir.'),
  r('SUPERVISOR_PRODUKSI', 'Supervisor Produksi', 'Manufacturing', 'P6',
    { MANUFACTURING: 'P6' }, 'LEGAL_ENTITY',
    'Perintah produksi dan konfirmasi operasi. Tidak mengubah BOM yang sudah dirilis.'),
  r('OPERATOR_PRODUKSI', 'Operator Produksi', 'Manufacturing', 'P2',
    { MANUFACTURING: 'P2' }, 'LEGAL_ENTITY',
    'Instruksi kerja, pemakaian bahan, dan konfirmasi. Tidak mengubah perencanaan maupun master.'),
  r('ENGINEER_BOM_ROUTING', 'Engineer BOM dan Routing', 'Manufacturing Engineering', 'P7',
    { MANUFACTURING: 'P7', CATALOG: 'P5' }, 'LEGAL_ENTITY',
    'BOM, routing, dan work center. Perilisan menuntut persetujuan.'),
  r('PERENCANA_MATERIAL', 'Perencana Material', 'MRP', 'P5',
    { MANUFACTURING: 'P5', INVENTORY: 'P2', PURCHASING: 'P1' }, 'LEGAL_ENTITY',
    'MRP, planned order, dan kekurangan bahan. Tidak menyetujui pembayaran pembelian.'),

  // ---------------------------------------------------------------- Quality
  r('MANAJER_KUALITAS', 'Manajer Kualitas', 'Quality', 'P7',
    { QUALITY: 'P7', INVENTORY: 'P2', MANUFACTURING: 'P1' }, 'LEGAL_ENTITY',
    'Spesifikasi, inspeksi, tindakan korektif, dan pelepasan. Tidak menerima PO maupun pembayaran.'),
  r('INSPEKTUR_KUALITAS', 'Inspektur Kualitas', 'Quality', 'P2',
    { QUALITY: 'P2', INVENTORY: 'P1' }, 'WAREHOUSE',
    'Inspeksi, ketidaksesuaian, dan hasil. Pelepasan akhir menuntut kewenangan tersendiri.'),

  // ------------------------------------------------------------ Maintenance
  r('MANAJER_MAINTENANCE', 'Manajer Pemeliharaan', 'Maintenance', 'P6',
    { ASSET: 'P6', INVENTORY: 'P2' }, 'LEGAL_ENTITY',
    'Rencana, perintah kerja, suku cadang, dan laporan. Pembelian dan pembayaran terpisah.'),
  r('TEKNISI_MAINTENANCE', 'Teknisi Pemeliharaan', 'Maintenance', 'P2',
    { ASSET: 'P2' }, 'SELF',
    'Perintah kerja yang ditugaskan, checklist, dan suku cadang. Tidak menyetujui pekerjaannya sendiri.'),

  // ---------------------------------------------------------------- Finance
  r('DIREKTUR_KEUANGAN', 'Direktur Keuangan', 'Finance', 'P11',
    { FINANCE: 'P11', REPORTING: 'P11' }, 'LEGAL_ENTITY',
    'Dashboard, treasury, anggaran, laporan keuangan, dan persetujuan. Tidak melakukan entri rutin.'),
  r('CONTROLLER_KEUANGAN', 'Financial Controller', 'Accounting', 'P6',
    { FINANCE: 'P6', REPORTING: 'P1' }, 'LEGAL_ENTITY',
    'Buku besar, tutup buku, rekonsiliasi, dan kontrol. Penyetuju jurnal berbeda dari penyiapnya.',
    { sodGroup: 'JOURNAL', sodSide: 'APPROVER' }),
  r('MANAJER_AKUNTANSI', 'Manajer Akuntansi', 'Accounting', 'P7',
    { FINANCE: 'P7', REPORTING: 'P1' }, 'LEGAL_ENTITY',
    'Buku besar, hutang, piutang, aset, pajak, dan tutup buku. Tidak mengubah keamanan role.'),
  r('AKUNTAN_BUKU_BESAR', 'Akuntan Buku Besar', 'GL', 'P5',
    { FINANCE: 'P5' }, 'LEGAL_ENTITY',
    'Jurnal, rekonsiliasi, dan tugas tutup buku. Tidak menyetujui jurnal buatannya sendiri.',
    { sodGroup: 'JOURNAL', sodSide: 'PREPARER' }),
  r('PENYETUJU_JURNAL', 'Penyetuju Jurnal', 'GL Approval', 'P4',
    { FINANCE: 'P4' }, 'LEGAL_ENTITY',
    'Menyetujui, menolak, dan membalik jurnal. Tidak menyiapkan jurnal yang sama.',
    { sodGroup: 'JOURNAL', sodSide: 'APPROVER' }),
  r('MANAJER_HUTANG', 'Manajer Hutang Usaha', 'AP', 'P6',
    { FINANCE: 'P6', PURCHASING: 'P1' }, 'LEGAL_ENTITY',
    'Tagihan pemasok, hutang, dan usulan pembayaran. Pembuatan vendor dan persetujuan pembayaran terpisah.',
    { sodGroup: 'VENDOR_PAYMENT', sodSide: 'APPROVER' }),
  r('STAF_HUTANG', 'Staf Hutang Usaha', 'AP', 'P2',
    { FINANCE: 'P2', PURCHASING: 'P1' }, 'LEGAL_ENTITY',
    'Tagihan pemasok, pencocokan, dan umur hutang. Tidak menyetujui pembayaran.',
    { sodGroup: 'PO_RECEIPT_PAY', sodSide: 'EXECUTOR' }),
  r('MANAJER_PIUTANG', 'Manajer Piutang Usaha', 'AR', 'P6',
    { FINANCE: 'P6', SALES: 'P1', CRM: 'P1' }, 'LEGAL_ENTITY',
    'Tagihan pelanggan, penerimaan, dan penagihan. Penghapusan kredit dibatasi ambang.'),
  r('STAF_PIUTANG', 'Staf Piutang Usaha', 'AR', 'P2',
    { FINANCE: 'P2', SALES: 'P1' }, 'LEGAL_ENTITY',
    'Tagihan, alokasi penerimaan, dan statement. Penghapusan menuntut persetujuan.'),
  r('BENDAHARA', 'Bendahara / Treasury', 'Finance', 'P6',
    { FINANCE: 'P6' }, 'LEGAL_ENTITY',
    'Kas, bank, eksekusi pembayaran, dan rekonsiliasi. Tidak membuat vendor maupun tagihan.',
    { sodGroup: 'VENDOR_PAYMENT', sodSide: 'EXECUTOR' }),
  r('KASIR_KEUANGAN', 'Kasir Keuangan', 'Finance', 'P2',
    { FINANCE: 'P2' }, 'LEGAL_ENTITY',
    'Penerimaan, pembayaran, dan kas kecil dalam batas dan persetujuan.',
    { sodGroup: 'AR_CASH', sodSide: 'CUSTODIAN' }),
  r('MANAJER_PAJAK', 'Manajer Pajak', 'Tax', 'P7',
    { FINANCE: 'P7' }, 'LEGAL_ENTITY',
    'Setelan pajak, tinjauan perhitungan, dan pelaporan. Penyesuaian pajak menuntut persetujuan.'),
  r('STAF_PAJAK', 'Staf Pajak', 'Tax', 'P2',
    { FINANCE: 'P2' }, 'LEGAL_ENTITY',
    'Dokumen pajak, rekonsiliasi, dan laporan. Tidak mengubah aturan pajak yang sudah dirilis.'),
  r('PETUGAS_ASET_TETAP', 'Petugas Aset Tetap', 'Fixed Asset', 'P5',
    { ASSET: 'P5', FINANCE: 'P2' }, 'LEGAL_ENTITY',
    'Kapitalisasi, pemindahan, dan penyusutan aset. Pelepasan menuntut persetujuan.'),
  r('MANAJER_ANGGARAN', 'Manajer Anggaran', 'Budget', 'P6',
    { FINANCE: 'P6', REPORTING: 'P1' }, 'LEGAL_ENTITY',
    'Model anggaran, persetujuan, dan pengendalian. Tidak melakukan pembayaran vendor.',
    { sodGroup: 'BUDGET', sodSide: 'APPROVER' }),
  r('PENYUSUN_ANGGARAN', 'Penyusun Anggaran', 'Budget', 'P2',
    { FINANCE: 'P2' }, 'DEPARTMENT',
    'Input anggaran dan perkiraan. Tidak menyetujui usulannya sendiri.',
    { sodGroup: 'BUDGET', sodSide: 'PREPARER' }),
  r('AKUNTAN_BIAYA', 'Akuntan Biaya', 'Costing', 'P5',
    { FINANCE: 'P5', MANUFACTURING: 'P1', INVENTORY: 'P1' }, 'LEGAL_ENTITY',
    'Biaya persediaan, produksi, dan proyek. Tidak mengubah kuantitas operasional.'),
  r('AKUNTAN_KONSOLIDASI', 'Akuntan Konsolidasi', 'Consolidation', 'P6',
    { FINANCE: 'P6', REPORTING: 'P1' }, 'TENANT',
    'Antarperusahaan, eliminasi, dan konsolidasi. Buku sumber hanya baca.'),
  r('AKUNTAN_PROYEK', 'Akuntan Proyek', 'Project Accounting', 'P5',
    { FINANCE: 'P5' }, 'LEGAL_ENTITY',
    'Biaya, pendapatan, dan penagihan proyek. Persetujuan proyek terpisah.'),

  // --------------------------------------------------------------------- HR
  r('MANAJER_HRD', 'Manajer HRD', 'HR', 'P7',
    { HR: 'P7', REPORTING: 'P1' }, 'TENANT',
    'Organisasi, karyawan, talenta, dan laporan SDM. Akses nilai payroll mengikuti kebijakan.'),
  r('ADMIN_HRD', 'Administrator HRD', 'HR', 'P5',
    { HR: 'P5' }, 'DEPARTMENT',
    'Master karyawan, kontrak, dan dokumen. Tidak menyetujui payroll.'),
  r('REKRUTER', 'Petugas Rekrutmen', 'Recruitment', 'P2',
    { HR: 'P2' }, 'DEPARTMENT',
    'Lowongan, kandidat, dan wawancara. Tidak mengakses payroll.'),
  r('ADMIN_ABSENSI', 'Administrator Kehadiran', 'Attendance', 'P5',
    { HR: 'P5' }, 'DEPARTMENT',
    'Shift, kehadiran, dan koreksi. Persetujuan koreksi terpisah.'),
  r('MANAJER_PAYROLL', 'Manajer Payroll', 'Payroll', 'P6',
    { HR: 'P6', FINANCE: 'P1' }, 'LEGAL_ENTITY',
    'Setelan, proses, tinjauan, dan laporan payroll. Eksekusi pembayaran terpisah.',
    { sodGroup: 'PAYROLL', sodSide: 'APPROVER' }),
  r('PETUGAS_PAYROLL', 'Petugas Payroll', 'Payroll', 'P5',
    { HR: 'P5' }, 'LEGAL_ENTITY',
    'Perhitungan, slip, dan draf rekonsiliasi. Tidak menyetujui maupun membayar proses buatannya sendiri.',
    { sodGroup: 'PAYROLL', sodSide: 'PREPARER' }),
  r('PENYETUJU_PAYROLL', 'Penyetuju Payroll', 'Payroll Approval', 'P4',
    { HR: 'P4' }, 'LEGAL_ENTITY',
    'Meninjau, menyetujui, dan menolak payroll. Tidak menyiapkan proses yang sama.',
    { sodGroup: 'PAYROLL', sodSide: 'APPROVER' }),
  r('PETUGAS_PELATIHAN', 'Petugas Pelatihan dan Pengembangan', 'Learning', 'P5',
    { HR: 'P5' }, 'TENANT', 'Pelatihan, pendaftaran, dan sertifikasi. Tidak mengakses payroll.'),
  r('MANAJER_KINERJA', 'Manajer Kinerja dan Talenta', 'Performance', 'P6',
    { HR: 'P6' }, 'TENANT', 'Sasaran, tinjauan, suksesi, dan kompetensi.'),
  r('PETUGAS_K3_EHS', 'Petugas K3 / EHS', 'EHS', 'P5',
    { HR: 'P5', ASSET: 'P2' }, 'LEGAL_ENTITY',
    'Insiden, inspeksi, bahaya, dan izin kerja. Tidak mengubah payroll.'),

  // ---------------------------------------------------------------- Project
  r('MANAJER_PROYEK', 'Manajer Proyek', 'Project', 'P6',
    { REPORTING: 'P1', FINANCE: 'P2', HR: 'P1' }, 'TENANT',
    'Proyek, WBS, sumber daya, anggaran, dan progres. Persetujuan penagihan proyek terpisah.'),
  r('ANGGOTA_PROYEK', 'Anggota Tim Proyek', 'Project', 'P10', {}, 'SELF',
    'Tugas, timesheet, dan biaya. Tidak mengubah anggaran.'),
  r('PENGAJU_BIAYA', 'Pengaju Biaya Perjalanan', 'Expense', 'P10',
    { FINANCE: 'P10' }, 'SELF',
    'Mengajukan biaya dan perjalanan. Tidak menyetujui pengajuannya sendiri.',
    { sodGroup: 'EXPENSE', sodSide: 'PREPARER' }),
  r('PENYETUJU_BIAYA', 'Penyetuju Biaya Perjalanan', 'Expense Approval', 'P4',
    { FINANCE: 'P4' }, 'TEAM',
    'Meninjau dan menyetujui biaya. Tidak menyetujui pengajuannya sendiri.',
    { sodGroup: 'EXPENSE', sodSide: 'APPROVER' }),

  // --------------------------------------------------------------- Investor
  r('INVESTOR', 'Investor', 'Investor', 'P11',
    { INVESTOR: 'P11', REPORTING: 'P1' }, 'OWNERSHIP',
    'Portal investor, statement, dashboard, dan voting. Tidak mengubah operasi bisnis.'),
  r('PERWAKILAN_INVESTOR', 'Perwakilan Investor', 'Investor', 'P11',
    { INVESTOR: 'P11' }, 'OWNERSHIP',
    'Portal, dokumen, dan voting yang didelegasikan. Tidak mengubah buku modal.'),
  r('ADMIN_MODAL_INVESTOR', 'Administrator Modal dan Investor', 'Investor', 'P7',
    { INVESTOR: 'P7', FINANCE: 'P2' }, 'TENANT',
    'Kepemilikan, modal, kontrak, dan statement. Persetujuan settlement terpisah.'),
  r('MANAJER_BAGI_HASIL', 'Manajer Bagi Hasil', 'Investor', 'P6',
    { INVESTOR: 'P6', FINANCE: 'P2' }, 'TENANT',
    'Bagi hasil, settlement, dan usulan pembayaran. Eksekusi pembayaran terpisah.'),

  // --------------------------------------------------------------- Referral
  r('PARTNER_REFERRAL', 'Partner Referral', 'Referral', 'P10', {}, 'SELF',
    'Portal partner, tautan, atribusi, dan statement. Tidak mengubah tarif komisi.'),
  r('ADMIN_REFERRAL', 'Administrator Referral', 'Referral', 'P7',
    { SUBSCRIPTION: 'P5' }, 'TENANT',
    'Partner, rencana komisi, kampanye, dan atribusi. Persetujuan pembayaran terpisah.'),
  r('PETUGAS_KOMISI_REFERRAL', 'Petugas Komisi Referral', 'Referral', 'P5',
    { SUBSCRIPTION: 'P2', FINANCE: 'P1' }, 'TENANT',
    'Proses komisi, penyesuaian, dan statement. Persetujuan pembayaran terpisah.'),

  // --------------------------------------------------------------- Workflow
  r('ADMIN_WORKFLOW', 'Administrator Workflow', 'Workflow', 'P7',
    { WORKFLOW: 'P7' }, 'TENANT',
    'Definisi, versi, kebijakan, dan pemantauan. Tidak menyetujui transaksi bisnis secara otomatis.'),
  r('DESAINER_SOP', 'Desainer SOP dan Alur', 'Workflow', 'P7',
    { WORKFLOW: 'P7' }, 'TENANT',
    'SOP, langkah, transisi, dan formulir. Penerbitan menuntut persetujuan.'),
  r('PENGAJU_WORKFLOW', 'Pengaju Workflow', 'Workflow', 'P10',
    { WORKFLOW: 'P10' }, 'SELF',
    'Pengajuan, tugas sendiri, dan lampiran. Tidak menyetujui pengajuannya sendiri.',
    { sodGroup: 'WORKFLOW_APPROVAL', sodSide: 'PREPARER' }),
  r('PENYETUJU_WORKFLOW', 'Penyetuju Workflow', 'Workflow', 'P4',
    { WORKFLOW: 'P4' }, 'DEPARTMENT',
    'Menyetujui, menolak, dan mengembalikan tugas. Tidak menyetujui pengajuannya sendiri.',
    { sodGroup: 'WORKFLOW_APPROVAL', sodSide: 'APPROVER' }),
  r('REVIEWER_WORKFLOW', 'Reviewer Workflow', 'Workflow', 'P4',
    { WORKFLOW: 'P4' }, 'DEPARTMENT',
    'Tinjauan, komentar, dan rekomendasi. Tidak melakukan persetujuan akhir kecuali diberikan.'),

  // -------------------------------------------------------------- Ticketing
  r('PELAPOR_TIKET', 'Pelapor Tiket', 'Ticketing', 'P10',
    { SUPPORT: 'P10' }, 'SELF',
    'Membuat tiket dan melihat tiket sendiri. Tidak melihat catatan internal.', { core: true }),
  r('AGEN_SUPPORT_L1_TENANT', 'Agen Dukungan Tenant Tingkat 1', 'Ticketing', 'P2',
    { SUPPORT: 'P2' }, 'ASSIGNED_QUEUE',
    'Antrean, tiket, catatan publik, dan basis pengetahuan. Data sensitif tersamar.'),
  r('AGEN_SUPPORT_L2_TENANT', 'Agen Dukungan Tenant Tingkat 2', 'Ticketing', 'P5',
    { SUPPORT: 'P5', INTEGRATION: 'P1' }, 'ASSIGNED_QUEUE',
    'Antrean, eskalasi, dan diagnostik. Tidak mengubah role keamanan.'),
  r('SUPERVISOR_TIKET', 'Supervisor Ticketing', 'Ticketing', 'P6',
    { SUPPORT: 'P6' }, 'TENANT',
    'Penugasan, SLA, eskalasi, dan laporan. Tidak mengakses modul lain tanpa izin.'),
  r('EDITOR_KNOWLEDGE_BASE', 'Editor Knowledge Base', 'Knowledge', 'P5',
    { SUPPORT: 'P5' }, 'TENANT',
    'Artikel, versi, dan umpan balik. Penerbitan menuntut persetujuan.'),
  r('MANAJER_SLA', 'Manajer SLA', 'Ticketing', 'P7',
    { SUPPORT: 'P7' }, 'TENANT',
    'Kebijakan SLA, kalender, dan eskalasi. Tidak mengubah isi tiket operasional.'),

  // ---------------------------------------------------------------- Website
  r('ADMIN_WEBSITE', 'Administrator Website Tenant', 'Website', 'P7', {}, 'BRAND',
    'Website, tema, domain, dan penerbitan. Perubahan DNS dan TLS menuntut step-up.'),
  r('EDITOR_KONTEN', 'Editor Konten', 'Website', 'P2', {}, 'BRAND',
    'Draf halaman, berita, dan media. Tidak menerbitkan tanpa role penerbit.',
    { sodGroup: 'CONTENT_PUBLISH', sodSide: 'PREPARER' }),
  r('REVIEWER_KONTEN', 'Reviewer dan Penerbit Konten', 'Website', 'P4', {}, 'BRAND',
    'Meninjau, menyetujui, dan menerbitkan. Tidak mengubah domain.',
    { sodGroup: 'CONTENT_PUBLISH', sodSide: 'APPROVER' }),
  r('SPESIALIS_SEO', 'Spesialis SEO', 'Website', 'P5', {}, 'BRAND',
    'SEO, sitemap, pengalihan, dan analitik. Tidak mengubah pesanan maupun pembayaran.'),

  // ------------------------------------------------------------ Integration
  r('ADMIN_INTEGRASI', 'Administrator Integrasi dan API', 'Integration', 'P7',
    { INTEGRATION: 'P7' }, 'TENANT',
    'Konektor, klien API, webhook, dan eksekusi. Rahasia menuntut step-up dan tidak dapat dibaca ulang.'),
  r('MONITOR_INTEGRASI', 'Petugas Monitor Integrasi', 'Integration', 'P5',
    { INTEGRATION: 'P5' }, 'TENANT',
    'Eksekusi, percobaan ulang, dead letter, dan log. Tidak mengubah data bisnis langsung.'),
  r('ADMIN_PERANGKAT', 'Administrator Perangkat', 'Device', 'P7',
    { SUBSCRIPTION: 'P7', POS: 'P5', SHIPPING: 'P2' }, 'TENANT',
    'Perangkat POS, GPS, absensi, dan printer. Penautan dan pencabutan diaudit.'),
  r('SERVICE_ACCOUNT_API', 'Akun Layanan API', 'Service', 'P12',
    { INTEGRATION: 'P12' }, 'API_SCOPE',
    'Scope API tertentu. Tidak dapat masuk lewat antarmuka; kredensial dirotasi berkala.'),

  // ------------------------------------------------------------------- Help
  r('ADMIN_BANTUAN', 'Administrator Pusat Bantuan', 'Help', 'P7',
    { SUPPORT: 'P7' }, 'TENANT',
    'Topik bantuan, pemetaan, diagram, dan cakupan. Penerbitan mengikuti alur kerja.'),
  r('EDITOR_BANTUAN', 'Editor Panduan', 'Help', 'P2',
    { SUPPORT: 'P2' }, 'TENANT',
    'Draf bantuan, langkah, dan kamus field. Tidak menerbitkan sendiri.',
    { sodGroup: 'HELP_PUBLISH', sodSide: 'PREPARER' }),
  r('REVIEWER_BANTUAN', 'Reviewer Panduan', 'Help', 'P4',
    { SUPPORT: 'P4' }, 'TENANT',
    'Meninjau, menyetujui, dan menerbitkan bantuan. Tidak mengubah transaksi.',
    { sodGroup: 'HELP_PUBLISH', sodSide: 'APPROVER' }),

  // ------------------------------------------------------------------- Demo
  r('DEMO_USER', 'Pengguna Demo', 'Demo', 'P2', {}, 'TENANT',
    'Sandbox demo. Aksi sensitif dinonaktifkan pada lapisan terpisah.',
    { core: true, legacyCode: 'DEMO_USER', allModules: true }),
];

/** Role yang disemai pada schema tenant — seluruhnya kecuali khusus platform. */
export const TENANT_ROLE_CATALOG = ROLE_CATALOG.filter((role) => !role.platformOnly);

/** Role yang disemai untuk setiap tenant baru tanpa perlu diminta. */
export const CORE_TENANT_ROLES = TENANT_ROLE_CATALOG.filter((role) => role.core);

export interface SodGroup {
  group: string;
  members: Array<{ code: string; side: NonNullable<RoleCatalogEntry['sodSide']> }>;
}

/**
 * Kelompok pemisahan tugas, diturunkan dari katalog — bukan ditulis terpisah,
 * supaya aturan tidak mungkin menyimpang dari role yang benar-benar ada.
 *
 * Aturannya: dua role dalam satu kelompok dengan SISI BERBEDA tidak boleh
 * dipegang satu orang. Dinyatakan sebagai sisi, bukan sebagai pasangan
 * penyiap-penyetuju, karena pemisahan yang paling penting justru berkaki tiga:
 * pemesan barang, penerima barang, dan pembayar tagihan.
 *
 * Kelompok bersisi tunggal dibuang. Ia tidak melarang apa pun, dan
 * menyemainya hanya menghasilkan aturan yang tidak pernah berlaku.
 */
export function buildSodGroups(): SodGroup[] {
  const groups = new Map<string, SodGroup['members']>();
  for (const role of ROLE_CATALOG) {
    if (!role.sodGroup || !role.sodSide) continue;
    const members = groups.get(role.sodGroup) ?? [];
    members.push({ code: role.code, side: role.sodSide });
    groups.set(role.sodGroup, members);
  }
  return [...groups.entries()]
    .map(([group, members]) => ({ group, members }))
    .filter((g) => new Set(g.members.map((m) => m.side)).size >= 2);
}
