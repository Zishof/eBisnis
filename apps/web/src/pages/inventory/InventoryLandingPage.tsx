import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Download,
  FileSpreadsheet,
  MapPin,
  Landmark,
  PackageSearch,
  Pill,
  ReceiptText,
  Route,
  Settings2,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import { inventoryTenantLabelFromHost, isCmnInventoryHost } from './inventory-host';

const photos = {
  hero: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1600&q=82',
  warehouse:
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=82',
  sales: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1200&q=82',
  owner: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=82',
  route:
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82',
  pharmacy:
    'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1200&q=82',
};

const legacyMetrics = [
  ['626', 'master barang obat'],
  ['94.072', 'baris penjualan lama'],
  ['60.269', 'baris pembelian lama'],
  ['2.875', 'batch dan expiry'],
  ['334', 'customer aktif'],
  ['101', 'supplier'],
];

const personaAccounts = [
  {
    icon: Route,
    title: 'Sales Obat',
    username: 'sales.inventory',
    password: 'InventoryDemo#2026',
    body: 'Entry order lapangan, cek stok per batch, pilih customer, cetak invoice, dan pantau piutang customer.',
  },
  {
    icon: ClipboardList,
    title: 'Manajemen Inventory',
    username: 'manajemen.inventory',
    password: 'InventoryDemo#2026',
    body: 'Kelola barang, satuan, supplier, pembelian, stok opname, minimum stock, harga, batch, dan expired date.',
  },
  {
    icon: Landmark,
    title: 'Pemilik / Investor',
    username: 'pemilik.inventory',
    password: 'InventoryDemo#2026',
    body: 'Monitor omzet, laba kotor, perputaran stok, aging piutang, hutang supplier, top sales, dan tren produk.',
  },
];

const cmnAccounts = [
  ['Pemilik', 'muklis', 'muklis123!!'],
  ['Sales Masrukin', 'masrukin', 'masrukin123!!'],
  ['Sales Tohirin', 'tohirin', 'tohirin123!!'],
  ['Sales Nofal', 'nofal', 'nofal123!!'],
  ['Sales Agung', 'agung', 'agung123!!'],
  ['Admin', 'cmnmedika', 'cmnmedika123!!'],
] as const;

const flows = [
  {
    icon: Smartphone,
    title: 'Sales mobile dan desktop',
    body: 'Sales dapat mencatat penjualan obat dari lapangan, memilih customer, melihat harga jual, stok tersedia, dan status piutang.',
  },
  {
    icon: Boxes,
    title: 'Inventory batch-aware',
    body: 'Setiap obat bisa dilacak berdasarkan nomor batch, tanggal expired, stok awal, masuk, keluar, harga beli, dan harga jual.',
  },
  {
    icon: ReceiptText,
    title: 'Piutang dan hutang',
    body: 'Invoice penjualan, pembayaran customer, pembelian supplier, dan hutang dagang disiapkan sebagai satu alur operasional.',
  },
  {
    icon: BarChart3,
    title: 'Dashboard pemilik',
    body: 'Pemilik melihat ringkasan omzet, margin, produk laris, pelanggan terbesar, sales terbaik, dan risiko stok dead-stock.',
  },
];

const dashboards = [
  ['Omzet harian', 'Grafik penjualan obat per sales, outlet, customer, dan kategori.'],
  ['Laba kotor', 'Perbandingan harga beli rata-rata dan harga jual per transaksi.'],
  ['Expiry risk', 'Daftar batch yang mendekati tanggal kedaluwarsa agar cepat diprioritaskan.'],
  ['Aging piutang', 'Piutang customer dikelompokkan 0-30, 31-60, 61-90, dan lebih dari 90 hari.'],
  ['Restock planner', 'Saran pembelian berdasarkan stok minimum dan pergerakan barang.'],
  ['Investor view', 'Ringkasan modal barang, omzet, laba, arus kas, dan bagi hasil.'],
];

const dailyWorkflow = [
  {
    icon: MapPin,
    title: 'Rute dan kunjungan sales',
    body: 'Sales membuka daftar customer prioritas, melihat histori order, piutang, titik kunjungan, dan target harian sebelum berangkat.',
  },
  {
    icon: PackageSearch,
    title: 'Katalog obat dan stok tersedia',
    body: 'Produk ditampilkan dengan harga, batch, expiry, stok gudang, stok sales, dan catatan substitusi agar order tidak salah barang.',
  },
  {
    icon: ClipboardCheck,
    title: 'Order, validasi, dan invoice',
    body: 'Draft order masuk ke admin untuk validasi stok dan limit piutang, lalu menjadi invoice yang dapat dipantau pemilik.',
  },
  {
    icon: WalletCards,
    title: 'Tagihan dan pembayaran',
    body: 'Pembayaran tunai, transfer, tempo, retur, dan aging piutang menjadi satu jejak audit per customer dan per sales.',
  },
];

const readinessChecks = [
  ['Schema tenant sendiri', 'cmnmedika_inventory', 'Data CMN tidak bercampur dengan tenant lain.'],
  ['Akun kerja awal', '6 akun', 'Pemilik, admin, dan empat sales sudah didefinisikan untuk uji.'],
  ['Data legacy', '222.944+ baris', 'DBF lama dipetakan ke produk, transaksi, pembelian, piutang, hutang, dan harga.'],
  ['Dashboard', 'Owner-ready', 'KPI, sales ranking, customer ranking, expiry risk, dan rekonsiliasi impor.'],
];

const editableAssets = [
  {
    icon: Camera,
    title: 'Gambar hero dan kartu industri',
    body: 'Admin dapat mengganti foto obat, gudang, sales, armada, atau aktivitas toko agar sesuai brand tenant.',
  },
  {
    icon: Settings2,
    title: 'Teks promosi dan CTA',
    body: 'Headline, pengumuman, tombol download, dan konten landing disiapkan sebagai konten yang bisa dibawa ke CMS.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Template impor dan ekspor',
    body: 'Format master barang, customer, supplier, harga, batch, dan transaksi diarahkan mengikuti data lapangan tenant.',
  },
];

const downloads = [
  {
    icon: Smartphone,
    title: 'APK Sales Android',
    body: 'Aplikasi untuk sales dan pelanggan lapangan. File release ditempatkan di endpoint update server.',
    href: '/update/ebisnis-inventory-sales.apk',
    label: 'Download APK',
  },
  {
    icon: Download,
    title: 'EXE Desktop Windows',
    body: 'Aplikasi desktop untuk gudang, admin pembelian, kasir distribusi, dan supervisor inventory.',
    href: '/update/ebisnis-inventory-sales.exe',
    label: 'Download EXE',
  },
];

export function InventoryLandingPage() {
  const tenantName = inventoryTenantLabelFromHost();
  const cmnHost = isCmnInventoryHost();

  return (
    <div className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Pill className="h-3.5 w-3.5" aria-hidden />
              Produk baru eBisnis untuk sales dan inventory obat
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl dark:text-white">
              {tenantName}: inventory obat terintegrasi dari sales lapangan sampai pemilik.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              Dibangun dari pola aplikasi inventory lama berbasis DBF: master obat, customer, supplier, pembelian,
              penjualan sales, batch, expiry, piutang, hutang, dan jurnal. Versi baru disiapkan untuk web, Android,
              dan desktop Windows.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={cmnHost ? '/masuk?produk=inventory&role=PEMILIK_USAHA' : '/masuk?produk=inventory&role=SALES_OBAT'} className="btn-primary px-5 py-3">
                {cmnHost ? 'Masuk Caruban Medika Nusantara' : 'Masuk demo inventory'}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#download" className="btn-outline px-5 py-3">
                Download aplikasi
              </a>
              <a href="#kesiapan" className="btn-outline px-5 py-3">
                Cek kesiapan data
              </a>
            </div>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {legacyMetrics.map(([value, label]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="mt-1 text-2xl font-black">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
            <img
              src={photos.hero}
              alt="Rak obat apotek dan proses pengelolaan inventory farmasi"
              className="h-72 w-full object-cover sm:h-80"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[
                ['Batch', 'expiry tracked'],
                ['Sales', 'order lapangan'],
                ['Owner', 'monitor laba'],
              ].map(([title, body]) => (
                <div key={title} className="rounded-lg bg-white/10 p-3 text-white">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-1 text-xs text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="alur" className="container-page py-12">
        <div className="grid gap-5 lg:grid-cols-4">
          {flows.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="card p-5">
                <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
              <img
                src={photos.route}
                alt="Sales lapangan meninjau customer dan order"
                className="h-64 w-full object-cover opacity-90 sm:h-80"
              />
              <div className="grid grid-cols-2 gap-3 p-4">
                <div className="rounded-lg bg-white/10 p-3 text-white">
                  <p className="text-xs text-slate-300">Siklus kerja</p>
                  <p className="mt-1 text-lg font-black">Kunjungan - Order - Tagih</p>
                </div>
                <div className="rounded-lg bg-white/10 p-3 text-white">
                  <p className="text-xs text-slate-300">Kontrol pemilik</p>
                  <p className="mt-1 text-lg font-black">Real-time audit</p>
                </div>
              </div>
            </div>
            <div>
              <p className="section-eyebrow">Alur kerja sales obat</p>
              <h2 className="text-3xl font-black text-slate-950 dark:text-white">
                Dibuat mengikuti ritme lapangan: sales cepat entry, admin tetap bisa mengontrol, pemilik melihat hasil.
              </h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {dailyWorkflow.map((item) => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                      <Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
                      <h3 className="mt-4 font-bold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="dashboard" className="py-12">
        <div className="container-page grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-center">
          <div>
            <p className="section-eyebrow">Dashboard real lapangan</p>
            <h2 className="text-3xl font-black text-slate-950 dark:text-white">
              Pemilik dan investor melihat kondisi usaha tanpa menunggu laporan manual.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Data demo akan dibuat selalu hidup saat deploy: minimal 50 data per master penting dan sampai 1000
              transaksi contoh agar dashboard terasa seperti usaha berjalan.
            </p>
            <img
              src={photos.owner}
              alt="Dashboard bisnis untuk pemilik dan investor"
              className="mt-6 h-52 w-full rounded-xl object-cover"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {dashboards.map(([title, body]) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="kesiapan" className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="section-eyebrow">Kesiapan CMN</p>
            <h2 className="text-3xl font-black text-slate-950 dark:text-white">
              Caruban Medika Nusantara ditampilkan lengkap, nama perusahaan tidak disingkat.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Domain tetap ringkas sebagai <strong>cmnmedika-inventory.ebisnis.id</strong>, tetapi seluruh identitas
              publik dan dashboard memakai nama lengkap Caruban Medika Nusantara.
            </p>
            <img
              src={photos.pharmacy}
              alt="Layanan farmasi dan obat-obatan Caruban Medika Nusantara"
              className="mt-6 h-52 w-full rounded-xl object-cover"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {readinessChecks.map(([title, value, body]) => (
              <article key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{title}</p>
                <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="persona" className="container-page py-12">
        <div className="max-w-3xl">
          <p className="section-eyebrow">Akun demo</p>
          <h2 className="text-3xl font-black text-slate-950 dark:text-white">
            Tiga persona untuk mencoba alur sales, manajemen, dan pemilik.
          </h2>
        </div>
        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          {personaAccounts.map((account) => {
            const Icon = account.icon;
            return (
              <article key={account.username} className="card overflow-hidden">
                <div className="h-36 bg-slate-900">
                  <img
                    src={account.title === 'Sales Obat' ? photos.sales : account.title === 'Manajemen Inventory' ? photos.warehouse : photos.owner}
                    alt={`${account.title} inventory obat`}
                    className="h-full w-full object-cover opacity-85"
                  />
                </div>
                <div className="p-5">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-lg font-bold">{account.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{account.body}</p>
                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
                    <p className="font-semibold text-slate-700 dark:text-slate-100">{account.username}</p>
                    <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-300">{account.password}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        {cmnHost && (
          <div className="mt-7 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <h3 className="font-bold text-emerald-950 dark:text-emerald-100">
              Akun awal Caruban Medika Nusantara
            </h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cmnAccounts.map(([label, username, password]) => (
                <div key={username} className="rounded-lg bg-white p-3 text-sm shadow-sm dark:bg-slate-900">
                  <p className="font-semibold">{label}</p>
                  <p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">
                    {username} / {password}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="download" className="border-t border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page">
          <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
            <div>
              <p className="section-eyebrow">Download aplikasi</p>
              <h2 className="text-3xl font-black text-slate-950 dark:text-white">
                APK dan EXE tersedia dari server update eBisnis.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                Source code tetap private. Pengguna hanya mengambil artefak rilis dari endpoint update, sementara admin
                bisa mengganti gambar landing, konten promosi, dan paket download melalui CMS toko.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              {downloads.map((download) => {
                const Icon = download.icon;
                return (
                  <a
                    key={download.href}
                    href={download.href}
                    className="group rounded-xl border border-slate-200 bg-slate-50 p-5 transition hover:border-emerald-300 hover:bg-emerald-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30"
                  >
                    <Icon className="h-7 w-7 text-emerald-700 dark:text-emerald-300" aria-hidden />
                    <h3 className="mt-4 text-lg font-bold">{download.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{download.body}</p>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
                      {download.label}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" aria-hidden />
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            <div>
              <p className="section-eyebrow">Editable oleh admin</p>
              <h2 className="text-3xl font-black text-slate-950 dark:text-white">
                Visual dan konten tenant tidak dikunci di kode.
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
                Best practice landing SaaS yang saya pakai di sini: pesan utama spesifik, CTA jelas, visual nyata,
                bukti data, dan konten yang bisa diperbarui admin tanpa deploy ulang.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {editableAssets.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950">
                    <Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
                    <h3 className="mt-4 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page pb-12">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            [PackageSearch, 'Migrasi DBF lama', 'STOK, JUAL, BELI, CUSTOMER, SUPPLIER, SALES, batch, piutang, dan hutang dipetakan sebagai data awal.'],
            [CalendarClock, 'Data demo selalu segar', 'Transaksi contoh akan digeser mengikuti tanggal deploy supaya dashboard tidak tampak basi.'],
            [ShieldCheck, 'Private code, public release', 'Kode tetap di GitHub private; update aplikasi diambil dari server release eBisnis atau GitHub Release privat.'],
          ].map(([Icon, title, body]) => (
            <article key={String(title)} className="card p-5">
              <Icon className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
              <h3 className="mt-4 font-bold">{title as string}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body as string}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <FileSpreadsheet className="h-6 w-6 text-emerald-700 dark:text-emerald-300" aria-hidden />
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Catatan implementasi: aplikasi Flutter khusus inventory akan memakai artefak download di halaman ini.
            Endpoint download sudah disiapkan, lalu build APK/EXE dapat ditempatkan di folder update server saat pipeline rilis selesai.
          </p>
        </div>
      </section>
    </div>
  );
}
