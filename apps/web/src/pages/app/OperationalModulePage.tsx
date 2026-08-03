import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import {
  ArrowRight,
  Banknote,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileText,
  HandCoins,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
  UsersRound,
  Wrench,
} from 'lucide-react';
import { PageHeader, StatusBadge } from '../../components/ui';

interface ModuleConfig {
  title: string;
  group: string;
  description: string;
  icon: typeof ClipboardList;
  stats: Array<{ label: string; value: string; note: string }>;
  tasks: Array<{ title: string; owner: string; status: string; tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }>;
  actions: Array<{ label: string; href: string }>;
}

interface DemoRow {
  id: string;
  tanggal: string;
  referensi: string;
  pekerjaan: string;
  owner: string;
  nominal: string;
  status: string;
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

const DEMO_ROW_COUNT = 50;

const MODULES: Array<{ match: RegExp; config: ModuleConfig }> = [
  {
    match: /^\/app\/pos\/ditahan/,
    config: {
      title: 'Transaksi Ditahan',
      group: 'Kasir / POS',
      description: 'Pantau keranjang yang disimpan sementara, lanjutkan pembayaran, atau batalkan transaksi yang sudah tidak dipakai.',
      icon: ClipboardList,
      stats: [
        { label: 'Keranjang aktif', value: '8', note: '3 menunggu pelanggan' },
        { label: 'Nilai tertahan', value: 'Rp 1,84 jt', note: 'Dari shift hari ini' },
        { label: 'Rata-rata umur', value: '18 menit', note: 'Target di bawah 30 menit' },
      ],
      tasks: [
        { title: 'Meja 04 menunggu tambah item', owner: 'Kasir demo', status: 'DRAFT', tone: 'warning' },
        { title: 'Order pelanggan umum siap bayar', owner: 'Kasir demo', status: 'READY', tone: 'success' },
        { title: 'Keranjang lama perlu ditinjau', owner: 'Supervisor', status: 'WAITING_APPROVAL', tone: 'warning' },
      ],
      actions: [
        { label: 'Buka kasir', href: '/app/pos/kasir' },
        { label: 'Lihat laporan POS', href: '/app/pos/laporan' },
      ],
    },
  },
  {
    match: /^\/app\/pos\/shifts/,
    config: {
      title: 'Shift Kasir',
      group: 'Kasir / POS',
      description: 'Kelola pembukaan shift, penutupan shift, setoran kas, dan persetujuan selisih kas harian.',
      icon: CalendarClock,
      stats: [
        { label: 'Shift terbuka', value: '2', note: 'Outlet utama dan salon' },
        { label: 'Kas di laci', value: 'Rp 3,25 jt', note: 'Termasuk modal awal' },
        { label: 'Selisih belum final', value: 'Rp 0', note: 'Tidak ada anomali' },
      ],
      tasks: [
        { title: 'Shift pagi siap ditutup', owner: 'Manajemen Salon', status: 'READY', tone: 'success' },
        { title: 'Setoran tunai menunggu hitung fisik', owner: 'Kasir demo', status: 'PENDING', tone: 'warning' },
        { title: 'Rekap QRIS sudah tersinkron', owner: 'Sistem', status: 'OK', tone: 'success' },
      ],
      actions: [
        { label: 'Mulai transaksi', href: '/app/pos/kasir' },
        { label: 'Kas dan rekonsiliasi', href: '/app/pos/kas' },
      ],
    },
  },
  {
    match: /^\/app\/pos\/kas/,
    config: {
      title: 'Kas dan Rekonsiliasi',
      group: 'Kasir / POS',
      description: 'Cocokkan tunai, kartu, transfer, dan QRIS dengan penjualan serta mutasi kas internal.',
      icon: Banknote,
      stats: [
        { label: 'Tunai hari ini', value: 'Rp 4,72 jt', note: '69% dari pembayaran' },
        { label: 'Non-tunai', value: 'Rp 2,12 jt', note: 'QRIS, kartu, transfer' },
        { label: 'Rekonsiliasi', value: '96%', note: '4 item perlu cek' },
      ],
      tasks: [
        { title: 'Cocokkan settlement QRIS', owner: 'Keuangan', status: 'PENDING', tone: 'warning' },
        { title: 'Setoran tunai outlet salon', owner: 'Pemilik', status: 'WAITING_APPROVAL', tone: 'warning' },
        { title: 'Biaya admin kartu tercatat', owner: 'Sistem', status: 'POSTED', tone: 'success' },
      ],
      actions: [
        { label: 'Laporan POS', href: '/app/pos/laporan' },
        { label: 'Jurnal', href: '/app/journal-entries' },
      ],
    },
  },
  {
    match: /^\/app\/pos\/retur/,
    config: {
      title: 'Retur dan Refund',
      group: 'Kasir / POS',
      description: 'Daftarkan retur barang atau pembatalan layanan, lalu catat metode refund dan alasan audit.',
      icon: RotateCcw,
      stats: [
        { label: 'Retur bulan ini', value: '11', note: '0,7% dari transaksi' },
        { label: 'Nilai refund', value: 'Rp 386 rb', note: 'Tunai dan transfer' },
        { label: 'Butuh persetujuan', value: '2', note: 'Di atas limit kasir' },
      ],
      tasks: [
        { title: 'Refund transfer pelanggan membership', owner: 'Supervisor', status: 'WAITING_APPROVAL', tone: 'warning' },
        { title: 'Retur produk rusak diterima gudang', owner: 'Gudang', status: 'RECEIVED', tone: 'success' },
        { title: 'Koreksi pajak nota layanan', owner: 'Keuangan', status: 'PENDING', tone: 'warning' },
      ],
      actions: [
        { label: 'Kasir', href: '/app/pos/kasir' },
        { label: 'Kartu stok', href: '/app/stock-movements' },
      ],
    },
  },
  {
    match: /^\/app\/pos\/terminals/,
    config: {
      title: 'Terminal POS',
      group: 'Kasir / POS',
      description: 'Pantau perangkat kasir, printer, scanner, laci kas, dan status sinkronisasi setiap terminal.',
      icon: Wrench,
      stats: [
        { label: 'Terminal aktif', value: '4', note: 'Windows dan Android' },
        { label: 'Printer siap', value: '3/4', note: '1 belum terpasang' },
        { label: 'Sinkron online', value: '100%', note: 'Tidak ada antrean' },
      ],
      tasks: [
        { title: 'Pasang printer kasir salon', owner: 'Teknisi', status: 'PENDING', tone: 'warning' },
        { title: 'Terminal Android sudah update', owner: 'Sistem', status: 'OK', tone: 'success' },
        { title: 'Laci kas perlu uji buka', owner: 'Manajemen', status: 'READY', tone: 'info' },
      ],
      actions: [
        { label: 'Cek pembaruan', href: '/app/devices' },
        { label: 'Kasir', href: '/app/pos/kasir' },
      ],
    },
  },
  {
    match: /^\/app\/pos\/penugasan/,
    config: {
      title: 'Penugasan Register',
      group: 'Kasir / POS',
      description: 'Atur kasir, outlet, terminal, dan hak buka shift untuk setiap register yang dipakai operasional.',
      icon: UserCheck,
      stats: [
        { label: 'Kasir terjadwal', value: '6', note: '3 shift aktif' },
        { label: 'Register siap', value: '5', note: '1 cadangan' },
        { label: 'Konflik jadwal', value: '0', note: 'Semua valid' },
      ],
      tasks: [
        { title: 'Kasir sore ditugaskan ke terminal salon', owner: 'Manajemen', status: 'APPROVED', tone: 'success' },
        { title: 'Akses supervisor untuk refund', owner: 'Pemilik', status: 'WAITING_APPROVAL', tone: 'warning' },
        { title: 'Rotasi kasir akhir pekan', owner: 'HR', status: 'DRAFT', tone: 'neutral' },
      ],
      actions: [
        { label: 'Pengguna', href: '/app/users' },
        { label: 'Role dan izin', href: '/app/role-permissions' },
      ],
    },
  },
  {
    match: /^\/app\/sales\/orders/,
    config: {
      title: 'Pesanan Penjualan',
      group: 'Penjualan',
      description: 'Kelola quotation, sales order, alokasi stok, pengiriman, invoice, dan status pembayaran pelanggan.',
      icon: ClipboardList,
      stats: [
        { label: 'Order terbuka', value: '24', note: '8 siap diproses' },
        { label: 'Nilai pipeline', value: 'Rp 28,6 jt', note: 'Bulan berjalan' },
        { label: 'Terkirim tepat waktu', value: '94%', note: '7 hari terakhir' },
      ],
      tasks: [
        { title: 'SO-2608-014 menunggu konfirmasi stok', owner: 'Sales', status: 'PENDING', tone: 'warning' },
        { title: 'Invoice pelanggan salon sudah dibuat', owner: 'Keuangan', status: 'ISSUED', tone: 'info' },
        { title: 'Order marketplace siap dikirim', owner: 'Gudang', status: 'READY', tone: 'success' },
      ],
      actions: [
        { label: 'Produk', href: '/app/products' },
        { label: 'Pelanggan', href: '/app/customers' },
      ],
    },
  },
  {
    match: /^\/app\/sales\/reports/,
    config: {
      title: 'Laporan Penjualan',
      group: 'Penjualan',
      description: 'Ringkas performa omzet, margin, pajak, channel penjualan, produk teratas, dan pelanggan terbaik.',
      icon: FileText,
      stats: [
        { label: 'Omzet bulan ini', value: 'Rp 125,9 jt', note: 'Naik 18%' },
        { label: 'Margin kotor', value: '42%', note: 'Simulasi salon demo' },
        { label: 'Transaksi', value: '1.000', note: 'Dataset demo' },
      ],
      tasks: [
        { title: 'Analisis promo hair treatment', owner: 'Pemilik', status: 'READY', tone: 'success' },
        { title: 'Laporan pajak harian', owner: 'Keuangan', status: 'POSTED', tone: 'success' },
        { title: 'Produk lambat bergerak', owner: 'Manajemen', status: 'REVIEW', tone: 'info' },
      ],
      actions: [
        { label: 'Laporan POS', href: '/app/pos/laporan' },
        { label: 'Dashboard', href: '/app' },
      ],
    },
  },
  {
    match: /^\/app\/stock-counts/,
    config: {
      title: 'Stock Opname',
      group: 'Gudang dan Persediaan',
      description: 'Buat sesi hitung stok, cocokkan hasil fisik dengan sistem, lalu posting penyesuaian persediaan.',
      icon: ClipboardCheck,
      stats: [
        { label: 'Sesi aktif', value: '3', note: 'Gudang salon dan retail' },
        { label: 'SKU dihitung', value: '428', note: '86% selesai' },
        { label: 'Selisih nilai', value: 'Rp 142 rb', note: 'Perlu review' },
      ],
      tasks: [
        { title: 'Hitung ulang rak hair color', owner: 'Gudang', status: 'PENDING', tone: 'warning' },
        { title: 'Opname produk facial lengkap', owner: 'Manajemen', status: 'VALIDATED', tone: 'success' },
        { title: 'Posting koreksi serum', owner: 'Pemilik', status: 'WAITING_APPROVAL', tone: 'warning' },
      ],
      actions: [
        { label: 'Monitoring stok', href: '/app/stock-tree' },
        { label: 'Kartu stok', href: '/app/stock-movements' },
      ],
    },
  },
  {
    match: /^\/app\/boms|^\/app\/manufacturing/,
    config: {
      title: 'Produksi',
      group: 'Produksi',
      description: 'Susun resep, biaya bahan, proses produksi, dan hasil jadi untuk usaha makanan, salon, atau manufaktur ringan.',
      icon: Factory,
      stats: [
        { label: 'Resep aktif', value: '18', note: 'Produk dan paket layanan' },
        { label: 'Batch berjalan', value: '4', note: 'Menunggu selesai' },
        { label: 'Estimasi HPP', value: 'Rp 8,4 jt', note: 'Minggu ini' },
      ],
      tasks: [
        { title: 'Racikan paket facial perlu validasi HPP', owner: 'Manajemen', status: 'REVIEW', tone: 'info' },
        { title: 'Batch produk retail selesai', owner: 'Produksi', status: 'READY', tone: 'success' },
        { title: 'Bahan baku mendekati minimum', owner: 'Gudang', status: 'PENDING', tone: 'warning' },
      ],
      actions: [
        { label: 'Produk', href: '/app/products' },
        { label: 'Minimum stok', href: '/app/stock-policies' },
      ],
    },
  },
  {
    match: /^\/app\/carriers|^\/app\/pengiriman|^\/app\/marketplace\/(fulfillment|picking|packing|reservasi|routing)/,
    config: {
      title: 'Distribusi dan Pengiriman',
      group: 'Operasional',
      description: 'Kelola ekspedisi, booking kiriman, picking, packing, label, dan pelacakan sampai diterima pelanggan.',
      icon: Truck,
      stats: [
        { label: 'Paket siap kirim', value: '31', note: '12 prioritas hari ini' },
        { label: 'Dalam perjalanan', value: '87', note: '3 perlu pantau' },
        { label: 'SLA terpenuhi', value: '97%', note: '30 hari terakhir' },
      ],
      tasks: [
        { title: 'Cetak ulang label pesanan online', owner: 'Gudang', status: 'READY', tone: 'success' },
        { title: 'Booking kurir belum mendapat resi', owner: 'Admin', status: 'PENDING', tone: 'warning' },
        { title: 'Pengiriman terlambat perlu follow up', owner: 'CS', status: 'REVIEW', tone: 'info' },
      ],
      actions: [
        { label: 'Pesanan online', href: '/app/marketplace/pesanan' },
        { label: 'Pelanggan', href: '/app/customers' },
      ],
    },
  },
  {
    match: /^\/app\/employees|^\/app\/hr/,
    config: {
      title: 'SDM dan Payroll',
      group: 'SDM',
      description: 'Kelola pegawai, jabatan, jadwal kerja, presensi, payroll, komisi, dan akses operasional.',
      icon: UsersRound,
      stats: [
        { label: 'Pegawai aktif', value: '22', note: '8 stylist, 6 kasir' },
        { label: 'Presensi hari ini', value: '96%', note: '1 izin' },
        { label: 'Komisi berjalan', value: 'Rp 7,8 jt', note: 'Bulan ini' },
      ],
      tasks: [
        { title: 'Komisi treatment akhir pekan', owner: 'Manajemen', status: 'PENDING', tone: 'warning' },
        { title: 'Jadwal stylist minggu depan', owner: 'HR', status: 'DRAFT', tone: 'neutral' },
        { title: 'Akses kasir baru aktif', owner: 'Admin', status: 'ACTIVE', tone: 'success' },
      ],
      actions: [
        { label: 'Departemen', href: '/app/departments' },
        { label: 'Jabatan', href: '/app/job-positions' },
      ],
    },
  },
  {
    match: /^\/app\/marketplace|^\/app\/online/,
    config: {
      title: 'Marketplace dan Toko Online',
      group: 'Marketplace',
      description: 'Kelola katalog online, pesanan, pembayaran, voucher, chat, ulasan, dan performa toko lintas channel.',
      icon: PackageCheck,
      stats: [
        { label: 'Listing aktif', value: '120+', note: 'Sinkron dari produk' },
        { label: 'Order online', value: '48', note: 'Hari ini' },
        { label: 'Rating toko', value: '4,8', note: 'Dari 312 ulasan' },
      ],
      tasks: [
        { title: 'Voucher salon akhir bulan', owner: 'Marketing', status: 'READY', tone: 'success' },
        { title: 'Ulasan pelanggan perlu dibalas', owner: 'CS', status: 'PENDING', tone: 'warning' },
        { title: 'Katalog layanan menunggu publikasi', owner: 'Admin', status: 'REVIEW', tone: 'info' },
      ],
      actions: [
        { label: 'Portal pelanggan', href: '/app/portal-pelanggan' },
        { label: 'Produk', href: '/app/products' },
      ],
    },
  },
  {
    match: /^\/app\/quality|^\/app\/asset|^\/app\/workflow|^\/app\/reporting|^\/app\/integration|^\/app\/investor|^\/app\/finance/,
    config: {
      title: 'Ruang Kerja Manajemen',
      group: 'Manajemen',
      description: 'Panel kerja untuk kontrol kualitas, aset, persetujuan, integrasi, analitik, dan keputusan pemilik usaha.',
      icon: ShieldCheck,
      stats: [
        { label: 'Item perlu review', value: '14', note: 'Prioritas operasional' },
        { label: 'SLA tugas', value: '91%', note: 'Minggu berjalan' },
        { label: 'Dampak nilai', value: 'Rp 16,2 jt', note: 'Estimasi keputusan' },
      ],
      tasks: [
        { title: 'Persetujuan perubahan harga', owner: 'Pemilik', status: 'WAITING_APPROVAL', tone: 'warning' },
        { title: 'Audit aset terminal kasir', owner: 'Manajemen', status: 'READY', tone: 'success' },
        { title: 'Integrasi pembayaran perlu kredensial', owner: 'Admin', status: 'PENDING', tone: 'warning' },
      ],
      actions: [
        { label: 'Dashboard', href: '/app' },
        { label: 'Audit', href: '/app/audit' },
      ],
    },
  },
];

const DEFAULT_CONFIG: ModuleConfig = {
  title: 'Ruang Kerja Modul',
  group: 'Operasional',
  description: 'Halaman demo siap navigasi untuk modul yang belum memiliki layar transaksi khusus. Data ringkasnya membantu calon tenant memahami alur kerja sebelum modul penuh diaktifkan.',
  icon: HandCoins,
  stats: [
    { label: 'Aktivitas terbuka', value: '12', note: 'Perlu tindak lanjut' },
    { label: 'Dokumen bulan ini', value: '86', note: 'Tersinkron' },
    { label: 'Status operasional', value: 'Normal', note: 'Tidak ada hambatan' },
  ],
  tasks: [
    { title: 'Data master siap dipakai', owner: 'Sistem', status: 'OK', tone: 'success' },
    { title: 'Hak akses dapat diatur admin', owner: 'Admin', status: 'ACTIVE', tone: 'success' },
    { title: 'Workflow demo menunggu transaksi berikutnya', owner: 'Manajemen', status: 'PENDING', tone: 'warning' },
  ],
  actions: [
    { label: 'Dashboard', href: '/app' },
    { label: 'Bantuan', href: '/app/support' },
  ],
};

const STATUS_POOL: Array<{ status: string; tone: DemoRow['tone'] }> = [
  { status: 'READY', tone: 'success' },
  { status: 'PENDING', tone: 'warning' },
  { status: 'REVIEW', tone: 'info' },
  { status: 'APPROVED', tone: 'success' },
  { status: 'WAITING_APPROVAL', tone: 'warning' },
  { status: 'POSTED', tone: 'success' },
];

const OWNER_POOL = [
  'Kasir demo',
  'Manajemen Salon',
  'Pemilik',
  'Gudang',
  'Keuangan',
  'Admin',
  'Supervisor',
  'Marketing',
  'CS',
  'Sistem',
];

function buildDemoRows(config: ModuleConfig, path: string): DemoRow[] {
  const base = Date.now();
  const prefix = config.title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 12) || 'MODUL';

  return Array.from({ length: DEMO_ROW_COUNT }, (_, index) => {
    const template = config.tasks[index % config.tasks.length];
    const status = STATUS_POOL[(index + path.length) % STATUS_POOL.length];
    const tanggal = new Date(base - index * 86_400_000).toISOString().slice(0, 10);
    const nominal = (125_000 + ((index * 73_000 + path.length * 11_000) % 8_750_000)).toLocaleString(
      'id-ID',
      { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 },
    );

    return {
      id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
      tanggal,
      referensi: `${prefix}-${new Date().getFullYear()}-${String(index + 1).padStart(4, '0')}`,
      pekerjaan: `${template.title} #${String(index + 1).padStart(2, '0')}`,
      owner: OWNER_POOL[(index + config.group.length) % OWNER_POOL.length] ?? template.owner,
      nominal,
      status: status.status,
      tone: status.tone,
    };
  });
}

export function OperationalModulePage() {
  const location = useLocation();
  const config = MODULES.find((module) => module.match.test(location.pathname))?.config ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const demoRows = useMemo(() => buildDemoRows(config, location.pathname), [config, location.pathname]);

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app' },
          { label: config.group },
          { label: config.title },
        ]}
        actions={
          <button type="button" className="btn-outline">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Sinkronkan
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="card p-5">
          <div className="mb-5 flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-semibold text-slate-900 dark:text-white">Ringkasan kerja</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Halaman ini menampilkan {DEMO_ROW_COUNT} baris data demo, cukup padat untuk uji operasional tanpa melewati batas 1000 record per modul.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {config.stats.map((stat) => (
              <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{stat.value}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-slate-900 dark:text-white">Aksi cepat</h2>
          <div className="mt-4 space-y-2">
            {config.actions.map((action) => (
              <Link key={action.href} to={action.href} className="btn-outline w-full justify-between">
                {action.label}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-slate-900 dark:text-white">Daftar pekerjaan demo</h2>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
              {demoRows.length} data contoh
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 text-start font-semibold">Tanggal</th>
                <th className="px-5 py-3 text-start font-semibold">Referensi</th>
                <th className="px-5 py-3 text-start font-semibold">Pekerjaan</th>
                <th className="px-5 py-3 text-start font-semibold">Penanggung jawab</th>
                <th className="px-5 py-3 text-end font-semibold">Nominal</th>
                <th className="px-5 py-3 text-start font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
              {demoRows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">{row.tanggal}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{row.referensi}</td>
                  <td className="px-5 py-4 font-medium text-slate-900 dark:text-white">{row.pekerjaan}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{row.owner}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-end font-semibold tabular-nums text-slate-900 dark:text-white">{row.nominal}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={row.status} tone={row.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
