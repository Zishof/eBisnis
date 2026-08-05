import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
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
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { inventoryTenantLabelFromHost, isCmnInventoryHost } from './inventory-host';

const photos = {
  hero: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=82',
  warehouse:
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=82',
  sales: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?auto=format&fit=crop&w=1200&q=82',
  owner: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=82',
  route:
    'https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1200&q=82',
  pharmacy:
    'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1200&q=82',
  delivery:
    'https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=1200&q=82',
};

const productCapabilities = [
  ['Multi-industri', 'barang dagang dan distribusi'],
  ['3 platform', 'web, Android, dan Windows'],
  ['Per sales', 'order, tagihan, dan kinerja'],
  ['Per gudang', 'stok, mutasi, dan opname'],
  ['Per pelanggan', 'harga, limit, dan piutang'],
  ['Terintegrasi', 'pembelian sampai laporan pemilik'],
];

const personaAccounts = [
  {
    icon: Route,
    title: 'Sales Lapangan',
    username: 'sales.inventory',
    password: 'InventoryDemo#2026',
    body: 'Catat kunjungan dan order toko, cek stok, pilih harga pelanggan, kirim invoice, serta pantau tagihan.',
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

const flows = [
  {
    icon: Smartphone,
    title: 'Sales mobile dan desktop',
    body: 'Sales mencatat kunjungan dan penjualan dari lapangan, memilih toko, melihat harga berlaku, stok tersedia, dan status piutang.',
  },
  {
    icon: Boxes,
    title: 'Inventory lintas produk',
    body: 'Barang dilacak menurut SKU, satuan, gudang, stok awal, barang masuk-keluar, harga beli-jual, serta batch atau serial bila diperlukan.',
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
  ['Omzet harian', 'Grafik penjualan per sales, wilayah, toko pelanggan, kategori, dan kanal order.'],
  ['Laba kotor', 'Perbandingan harga beli rata-rata dan harga jual per transaksi.'],
  ['Risiko persediaan', 'Daftar stok lambat, stok minimum, batch kedaluwarsa, atau serial yang perlu ditindaklanjuti.'],
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
    title: 'Katalog barang dan stok tersedia',
    body: 'Produk ditampilkan dengan harga pelanggan, satuan, stok gudang, stok sales, promo, serta batch atau serial bila digunakan.',
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
  ['Isolasi data', 'Schema tenant', 'Setiap perusahaan memakai schema sendiri agar transaksi tidak bercampur dengan tenant lain.'],
  ['Peran pengguna', 'Role-based', 'Menu sales, admin, supervisor, pemilik, gudang, dan penagihan mengikuti tanggung jawab.'],
  ['Migrasi data', 'Import-ready', 'Master barang, toko, supplier, harga, stok, transaksi, piutang, dan hutang dapat dipetakan dari sistem lama.'],
  ['Dashboard', 'Owner-ready', 'KPI omzet, margin, sales ranking, customer ranking, stok, piutang, dan arus kas siap dipantau.'],
];

const editableAssets = [
  {
    icon: Camera,
    title: 'Gambar hero dan kartu industri',
    body: 'Admin dapat mengganti foto produk, gudang, sales, armada, atau aktivitas toko agar sesuai industri dan brand tenant.',
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

interface PublicCatalogProduct {
  id: string;
  code: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string;
  uom: string;
  available: boolean;
  imageUrl: string;
}

interface PublicCatalogResponse {
  products: PublicCatalogProduct[];
  categories: Array<{ name: string; count: number }>;
  summary: { products: number; available: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

function CmnProductCatalog() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<PublicCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '24' });
    if (search) params.set('q', search);
    if (category) params.set('category', category);
    setLoading(true);
    setError('');
    apiRequest<PublicCatalogResponse>(`/inventory/public/catalog?${params}`, {
      signal: controller.signal,
      skipRefresh: true,
    })
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(reason instanceof Error ? reason.message : 'Katalog belum dapat dimuat.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [category, page, search]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <section id="katalog" className="container-page py-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="section-eyebrow">Katalog produk nyata</p>
          <h2 className="text-3xl font-black text-slate-950 dark:text-white">
            Produk yang dipasarkan Caruban Medika Nusantara.
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            Cari berdasarkan nama, kode, SKU, atau barcode. Katalog ini bersifat informasi; harga khusus dan
            pemesanan tersedia setelah pelanggan login melalui aplikasi.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:w-auto">
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase text-slate-500">Produk aktif</p>
            <p className="mt-1 text-xl font-black">{catalog?.summary.products.toLocaleString('id-ID') ?? '-'}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase text-slate-500">Tersedia</p>
            <p className="mt-1 text-xl font-black text-emerald-700 dark:text-emerald-300">
              {catalog?.summary.available.toLocaleString('id-ID') ?? '-'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submitSearch} className="mt-7 flex max-w-3xl gap-2" role="search">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Cari produk</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Cari Bodrex, Paramex, kode, atau barcode..."
            className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-12 pr-4 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-900 dark:focus:ring-emerald-950"
          />
        </label>
        <button type="submit" className="btn-primary h-12 shrink-0 px-5">Cari</button>
      </form>

      {catalog?.categories.length ? (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filter kategori produk">
          <button
            type="button"
            onClick={() => { setCategory(''); setPage(1); }}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${category === '' ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
          >
            Semua ({catalog.summary.products.toLocaleString('id-ID')})
          </button>
          {catalog.categories.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => { setCategory(item.name); setPage(1); }}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${category === item.name ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'}`}
            >
              {item.name} ({item.count})
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="mt-7 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
          {error} Muat ulang halaman untuk mencoba kembali.
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy={loading}>
        {loading && !catalog
          ? Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="h-80 animate-pulse rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
            ))
          : catalog?.products.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-700">
                <div className="relative aspect-[4/3] overflow-hidden border-b border-slate-100 bg-white p-4 dark:border-slate-800">
                  <img
                    src={product.imageUrl}
                    alt={`Foto produk ${product.name}`}
                    loading="lazy"
                    className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.03]"
                  />
                  <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold ${product.available ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {product.available ? 'Tersedia' : 'Konfirmasi stok'}
                  </span>
                </div>
                <div className="p-5">
                  <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-300">{product.category}</p>
                  <h3 className="mt-2 min-h-12 text-base font-extrabold leading-6 text-slate-950 dark:text-white">{product.name}</h3>
                  <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate font-mono">{product.code}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-2 py-1 font-bold dark:bg-slate-800">{product.uom}</span>
                  </div>
                </div>
              </article>
            ))}
      </div>

      {!loading && catalog?.products.length === 0 ? (
        <div className="mt-7 rounded-lg border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
          <PackageSearch className="mx-auto h-9 w-9 text-slate-400" aria-hidden />
          <p className="mt-3 font-bold">Produk tidak ditemukan</p>
          <p className="mt-1 text-sm text-slate-500">Coba nama yang lebih singkat atau pilih Semua kategori.</p>
        </div>
      ) : null}

      {catalog && catalog.pagination.totalPages > 1 ? (
        <nav className="mt-8 flex items-center justify-center gap-3" aria-label="Halaman katalog">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
            Sebelumnya
          </button>
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Halaman {catalog.pagination.page} dari {catalog.pagination.totalPages}
          </span>
          <button type="button" className="btn-secondary" disabled={page >= catalog.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>
            Berikutnya
          </button>
        </nav>
      ) : null}
    </section>
  );
}

export function InventoryLandingPage() {
  const tenantName = inventoryTenantLabelFromHost();
  const cmnHost = isCmnInventoryHost();

  if (cmnHost) return <CmnCompanyProfile />;

  return (
    <div className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Route className="h-3.5 w-3.5" aria-hidden />
              Sales keliling dan distribusi lintas industri
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl dark:text-white">
              {tenantName}: satu alur dari kunjungan sales, order toko, stok, penagihan, sampai dashboard pemilik.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              Cocok untuk distributor sembako, FMCG, kosmetik, alat teknik, bahan bangunan, perlengkapan usaha,
              produk pertanian, suku cadang, dan barang dagang lainnya. Sales bekerja dari Android, admin memakai
              web atau Windows, sementara pemilik memantau usaha secara terpusat.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/masuk?produk=inventory" className="btn-primary px-5 py-3">
                Coba demo Sales & Inventory
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#download" className="btn-outline px-5 py-3">
                Download aplikasi
              </a>
              <Link to="/panduan/inventory-sales" className="btn-outline px-5 py-3">
                <BookOpen className="h-4 w-4" aria-hidden /> Panduan pengguna
              </Link>
              <a href="#kesiapan" className="btn-outline px-5 py-3">
                Cek kesiapan data
              </a>
            </div>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {productCapabilities.map(([value, label]) => (
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
              alt="Gudang distribusi untuk mendukung sales keliling dan pengelolaan persediaan"
              className="h-72 w-full object-cover sm:h-80"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[
                ['Sales', 'kunjungan dan order'],
                ['Inventory', 'stok lintas gudang'],
                ['Owner', 'omzet dan margin'],
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

      <section id="cara-pesan" className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
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
              <p className="section-eyebrow">Alur kerja sales keliling</p>
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
            <p className="section-eyebrow">Siap untuk beragam usaha distribusi</p>
            <h2 className="text-3xl font-black text-slate-950 dark:text-white">
              Konfigurasi mengikuti cara kerja bisnis Anda, bukan memaksa semua industri memakai proses yang sama.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Data, peran, harga, wilayah, gudang, metode penagihan, dan laporan dipisahkan per tenant. Fitur batch,
              tanggal kedaluwarsa, nomor serial, ukuran, warna, atau varian dapat digunakan hanya ketika relevan.
            </p>
            <img
              src={photos.delivery}
              alt="Aktivitas pengiriman barang dari distributor ke toko pelanggan"
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
                    src={account.title === 'Sales Lapangan' ? photos.sales : account.title === 'Manajemen Inventory' ? photos.warehouse : photos.owner}
                    alt={`${account.title} pada aplikasi Sales dan Inventory`}
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
            [PackageSearch, 'Migrasi sistem lama', 'Master barang, stok, penjualan, pembelian, pelanggan, supplier, sales, piutang, dan hutang dapat dipetakan sebagai data awal.'],
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

function CmnCompanyProfile() {
  return (
    <div className="bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-white">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="container-page grid gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_520px] lg:items-center lg:py-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <Pill className="h-3.5 w-3.5" aria-hidden />
              Sales obat wilayah Cirebon dan sekitarnya
            </p>
            <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl dark:text-white">
              Caruban Medika Nusantara, mitra pasokan obat untuk apotek, toko obat, dan fasilitas kesehatan.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600 dark:text-slate-300">
              Caruban Medika Nusantara melayani kebutuhan produk farmasi dan alat kesehatan untuk wilayah Cirebon,
              Kuningan, Indramayu, Majalengka, dan area sekitar. Halaman ini menampilkan profil perusahaan dan katalog
              display; pemesanan online hanya tersedia untuk pelanggan terdaftar melalui aplikasi.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#katalog" className="btn-primary px-5 py-3">
                Lihat katalog display
                <ArrowRight className="h-4 w-4" aria-hidden />
              </a>
              <a href="#download" className="btn-outline px-5 py-3">
                Download aplikasi pelanggan
              </a>
              <Link to="/panduan/inventory-sales" className="btn-outline px-5 py-3">
                <BookOpen className="h-4 w-4" aria-hidden /> Panduan pengguna
              </Link>
              <Link to="/masuk?produk=inventory&role=PELANGGAN" className="btn-outline px-5 py-3">
                Login pelanggan
              </Link>
            </div>
            <dl className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['Cirebon Raya', 'wilayah layanan utama'],
                ['626+', 'item obat terdata'],
                ['B2B', 'khusus pelanggan terdaftar'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="mt-1 text-2xl font-black">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-xl dark:border-slate-800">
            <img
              src={photos.pharmacy}
              alt="Produk farmasi dan obat yang dipasarkan Caruban Medika Nusantara"
              className="h-72 w-full object-cover sm:h-80"
            />
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[
                ['Stok obat', 'display katalog'],
                ['Sales', 'kunjungan outlet'],
                ['Pelanggan', 'order via aplikasi'],
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

      <section className="container-page py-12">
        <div className="grid gap-5 lg:grid-cols-4">
          {[
            [MapPin, 'Fokus area lokal', 'Sales diarahkan untuk melayani outlet farmasi di Cirebon dan kota sekitar dengan ritme kunjungan yang teratur.'],
            [Boxes, 'Katalog terstruktur', 'Produk dikelompokkan menurut kebutuhan apotek: obat umum, suplemen, alat kesehatan, dan personal care.'],
            [CalendarClock, 'Kontrol batch dan expiry', 'Pengelolaan stok memperhatikan nomor batch dan tanggal kedaluwarsa agar kualitas barang tetap terjaga.'],
            [WalletCards, 'Pelanggan terdaftar', 'Harga, order, dan riwayat transaksi hanya dibuka untuk pelanggan yang sudah diverifikasi.'],
          ].map(([Icon, title, body]) => (
            <article key={String(title)} className="card p-5">
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-lg font-bold text-slate-950 dark:text-white">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{body as string}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page grid gap-8 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-center">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
            <img src={photos.delivery} alt="Distribusi produk kesehatan ke pelanggan wilayah Cirebon" className="h-72 w-full object-cover opacity-90" />
          </div>
          <div>
            <p className="section-eyebrow">Cara pemesanan</p>
            <h2 className="text-3xl font-black text-slate-950 dark:text-white">
              Website ini hanya katalog publik. Order online dilakukan dari aplikasi pelanggan.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Pengunjung umum dapat melihat kelompok produk dan profil layanan. Tombol order tidak ditampilkan di web
              publik. Setelah menjadi pelanggan Caruban Medika Nusantara, pengguna dapat login di APK atau aplikasi
              desktop untuk melihat harga yang berlaku, membuat pesanan, dan memantau status transaksi.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {['Daftar/verifikasi pelanggan', 'Login aplikasi pelanggan', 'Pesan dan pantau transaksi'].map((step, index) => (
                <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">0{index + 1}</p>
                  <p className="mt-2 text-sm font-bold">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CmnProductCatalog />

      <section id="download" className="border-t border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="container-page grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)]">
          <div>
            <p className="section-eyebrow">Aplikasi pelanggan</p>
            <h2 className="text-3xl font-black text-slate-950 dark:text-white">
              Pelanggan terdaftar dapat memakai APK atau aplikasi desktop untuk order online.
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Aplikasi ini dipakai sebagai akses pelanggan Caruban Medika Nusantara: login, lihat katalog lengkap,
              membuat pesanan, dan memantau transaksi. Versi web publik tetap hanya profil dan katalog display.
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
      </section>
    </div>
  );
}
