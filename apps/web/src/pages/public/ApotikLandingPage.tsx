import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Barcode,
  Beaker,
  ClipboardCheck,
  Clock3,
  Factory,
  Layers3,
  MapPin,
  PackageCheck,
  Pill,
  ScanLine,
  Search,
  ShieldAlert,
  ShoppingCart,
  Star,
  Truck,
} from 'lucide-react';
import { LandingHeader, LandingCta, LandingImage, OfferDocumentSection } from './EmedikLandingPage';
import { emedikPublicBrandFor } from './emedik-host';

const photo = {
  scan:
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1400&q=80',
  shelf:
    'https://images.unsplash.com/photo-1576671081837-49000212a370?auto=format&fit=crop&w=900&q=80',
  lab:
    'https://images.unsplash.com/photo-1582719471384-894fbb16e074?auto=format&fit=crop&w=900&q=80',
};

const pharmacyFlows = [
  {
    icon: ClipboardCheck,
    title: 'Resep dokter',
    body: 'Telaah alergi, interaksi, dosis, substitusi, obat terkendali, dan status penyerahan.',
  },
  {
    icon: ShoppingCart,
    title: 'POS Apotik',
    body: 'Kasir farmasi terpisah dari POS retail biasa, tetapi tetap memakai mesin harga, stok, dan pembayaran yang sama.',
  },
  {
    icon: Beaker,
    title: 'Racikan obat',
    body: 'Racikan diperlakukan sebagai pekerjaan farmasi: bahan, takaran, etiket, HPP, dan jejak penyiapan.',
  },
  {
    icon: Factory,
    title: 'Produksi farmasi',
    body: 'BOM dan work order produksi terhubung ke gudang bahan, hasil jadi, batch, expiry, dan biaya.',
  },
  {
    icon: PackageCheck,
    title: 'Dispensing',
    body: 'Penyerahan obat mengikuti sisa resep, status telaah, batch, dan stok dari adapter inventory.',
  },
  {
    icon: ShieldAlert,
    title: 'High-alert safety',
    body: 'Obat risiko tinggi, LASA, dan controlled medication dinaikkan ke daftar sebelum transaksi selesai.',
  },
];

const metrics = [
  ['POS khusus', 'apotik dipisah dari retail umum'],
  ['6 benar', 'pemberian obat eMAR'],
  ['Batch', 'expiry dan recall siap ditelusuri'],
  ['Audit', 'akses pasien membawa purpose'],
];

const posSteps = [
  ['01', 'Ambil resep', 'Dari dokter, unggah manual, atau penjualan OTC tanpa resep.'],
  ['02', 'Telaah apoteker', 'Cek alergi, interaksi, dosis, substitusi, dan high-alert.'],
  ['03', 'Siapkan atau racik', 'Picking, compounding, produksi kecil, etiket, batch, dan expiry.'],
  ['04', 'Bayar di POS Apotik', 'Pembayaran memakai mesin POS, tetapi guardrail farmasi tetap terlihat.'],
];

const tenantProducts = [
  {
    category: 'Obat bebas',
    name: 'Paracetamol 500 mg',
    detail: 'Tablet, 10 strip tersedia',
    price: 'Rp 12.500',
    badge: 'Stok aman',
    unit: 'per strip',
    availability: '120 strip',
    channel: 'OTC dan checkout POS',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=700&q=80',
  },
  {
    category: 'Vitamin',
    name: 'Vitamin B Complex',
    detail: 'Tablet, 24 botol tersedia',
    price: 'Rp 28.000',
    badge: 'Populer',
    unit: 'per botol',
    availability: '24 botol',
    channel: 'Bisa dipesan publik',
    image: 'https://images.unsplash.com/photo-1577174881658-0f30ed549adc?auto=format&fit=crop&w=700&q=80',
  },
  {
    category: 'Alat kesehatan',
    name: 'Masker medis 3 ply',
    detail: 'Box 50 pcs, siap antar',
    price: 'Rp 35.000',
    badge: 'Siap kirim',
    unit: 'per box',
    availability: '36 box',
    channel: 'Ambil di apotik',
    image: 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=700&q=80',
  },
  {
    category: 'Resep dokter',
    name: 'Antibiotik sesuai resep',
    detail: 'Wajib telaah apoteker',
    price: 'Per resep',
    badge: 'Resep wajib',
    unit: 'validasi resep',
    availability: 'apoteker aktif',
    channel: 'Resep ditelaah',
    image: 'https://images.unsplash.com/photo-1628771065518-0d82f1938462?auto=format&fit=crop&w=700&q=80',
  },
  {
    category: 'Racikan',
    name: 'Racikan puyer anak',
    detail: 'Dosis mengikuti resep',
    price: 'Dihitung otomatis',
    badge: 'Racikan',
    unit: 'per resep',
    availability: 'siap racik',
    channel: 'Dihitung di POS Apotik',
    image: 'https://images.unsplash.com/photo-1583912267550-d44c1f008e84?auto=format&fit=crop&w=700&q=80',
  },
  {
    category: 'Perawatan',
    name: 'Salep antiseptik',
    detail: 'Tube, batch-expiry tercatat',
    price: 'Rp 18.500',
    badge: 'Expiry aman',
    unit: 'per tube',
    availability: '42 tube',
    channel: 'Katalog publik',
    image: 'https://images.unsplash.com/photo-1550572017-edd951aa8f72?auto=format&fit=crop&w=700&q=80',
  },
];

const tenantServices = [
  ['Telaah resep', 'Resep diperiksa alergi, interaksi, dosis, dan substitusi.'],
  ['Pesan dan ambil', 'Produk dapat disiapkan lebih dulu sebelum pasien datang.'],
  ['Pengantaran lokal', 'Pengiriman sekitar area layanan apotik sesuai jam operasional.'],
  ['Konsultasi apoteker', 'Edukasi penggunaan obat dan pengingat kepatuhan terapi.'],
];

function isTenantApotikProfile(title: string, demo: boolean): boolean {
  return demo || title !== 'Apotik eMedik';
}

export function ApotikLandingPage({ demo = false }: { demo?: boolean }) {
  const brand = emedikPublicBrandFor();
  const title = demo ? 'Demo Apotik eMedik' : brand?.kind === 'apotik' ? brand.name : 'Apotik eMedik';
  const tenantProfile = isTenantApotikProfile(title, demo);
  const host =
    brand?.kind === 'apotik'
      ? brand.homeUrl.replace(/^https?:\/\//, '')
      : demo
        ? 'demo-apotik.emedik.id'
        : 'apotik.emedik.id';

  return (
    <div className="min-h-screen bg-[#f6fbf8] text-slate-950">
      <LandingHeader
        brand={title}
        logoText={brand?.logoText ?? 'Rx'}
        tone="emerald"
        links={
          tenantProfile
            ? ['Profil', 'Katalog', 'Layanan', 'Keamanan', 'Dokumen']
            : ['Farmasi', 'POS Apotik', 'Racikan', 'Keamanan', 'Dokumen', 'Demo']
        }
      />

      <main>
        <section className="overflow-hidden bg-white">
          <div className="container-page grid min-h-[calc(100vh-4rem)] gap-10 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:py-16">
            <div>
              <p className="section-eyebrow bg-emerald-100 text-emerald-800">
                {tenantProfile
                  ? 'Profil apotik, katalog produk, dan layanan kefarmasian'
                  : 'Landing khusus apotik, farmasi klinis, dan POS obat'}
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                {tenantProfile
                  ? `${title}: profil, stok, dan produk apotik yang siap dilayani.`
                  : 'Apotik modern untuk resep, racikan, stok, dan POS obat.'}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                {tenantProfile
                  ? 'Halaman ini menampilkan identitas tenant, layanan apotik, dan etalase produk yang dijual tenant. Produk resep tetap melewati telaah apoteker; stok, batch, expiry, dan transaksi terhubung ke POS Apotik.'
                  : 'eMedik memisahkan POS Apotik dari POS penjualan biasa karena obat bukan barang retail biasa. Kasir tetap cepat, tetapi resep dokter, batch-expiry, racikan, obat terkendali, dan audit pasien ikut terlihat.'}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={tenantProfile ? '/masuk' : '/daftar'} className="btn-primary bg-emerald-700 px-6 py-3 text-base hover:bg-emerald-800">
                  {tenantProfile ? 'Masuk tenant' : 'Daftarkan apotik'}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to={tenantProfile ? '#Katalog' : '/app/apotik/pos'} className="btn-outline px-6 py-3 text-base">
                  {tenantProfile ? 'Lihat katalog' : 'Buka POS Apotik'}
                </Link>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 text-sm text-emerald-900">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono ring-1 ring-emerald-100">{host}</span>
                {tenantProfile && (
                  <>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
                      <MapPin className="h-4 w-4" aria-hidden /> Area layanan lokal
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 ring-1 ring-emerald-100">
                      <Clock3 className="h-4 w-4" aria-hidden /> 08.00-21.00
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.72fr_0.28fr]">
              <div className="overflow-hidden rounded-lg border border-emerald-200 bg-slate-950 shadow-2xl">
                <LandingImage
                  src={photo.scan}
                  alt="Apoteker memindai dan menyiapkan obat di area farmasi"
                  className="h-64 w-full object-cover sm:h-80"
                  fallbackLabel="POS Apotik"
                  tone="emerald"
                />
                <div className="p-5 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-emerald-200">Antrean resep dan POS</p>
                      <h2 className="mt-1 text-2xl font-black">Resep menunggu telaah</h2>
                    </div>
                    <Pill className="h-8 w-8 text-emerald-300" aria-hidden />
                  </div>
                  <div className="mt-5 space-y-3">
                    {[
                      ['RSP-0826-0142', 'Amoxicillin, Paracetamol, Cetirizine', 'Alergi diperiksa'],
                      ['RSP-0826-0143', 'Insulin glargine, Needle pen', 'High-alert'],
                      ['RSP-0826-0144', 'Diazepam, Vitamin B complex', 'Obat terkendali'],
                    ].map(([code, drug, note], index) => (
                      <div key={code} className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-mono text-xs text-slate-400">{code}</p>
                            <p className="mt-1 text-sm font-semibold">{drug}</p>
                          </div>
                          <span className={index === 0 ? 'rounded bg-emerald-300 px-2 py-1 text-xs font-bold text-slate-950' : 'rounded bg-amber-300 px-2 py-1 text-xs font-bold text-slate-950'}>
                            {note}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-4 lg:grid-cols-1">
                {metrics.map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-emerald-50 p-4 text-center ring-1 ring-emerald-100">
                    <p className="text-xl font-black text-emerald-800">{value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {tenantProfile && (
          <TenantApotikProfile title={title} host={host} />
        )}

        <section id="Farmasi" className="bg-[#f6fbf8] py-16">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="section-eyebrow bg-emerald-100 text-emerald-800">Farmasi klinis</p>
              <h2 className="section-heading text-slate-950">Dibuat untuk apoteker yang melayani antrean nyata.</h2>
              <p className="section-lead">
                Informasi berbahaya bila terlambat terlihat dinaikkan ke daftar:
                obat terkendali, high-alert, LASA, expiry, dan peringatan blocking.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {pharmacyFlows.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <Icon className="h-6 w-6 text-emerald-700" aria-hidden />
                    <h3 className="mt-4 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="POS-Apotik" className="bg-white py-16">
          <div className="container-page grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="overflow-hidden rounded-lg">
              <LandingImage
                src={photo.shelf}
                alt="Rak obat apotik modern"
                className="h-full min-h-80 w-full object-cover"
                fallbackLabel="Rak obat"
                tone="emerald"
              />
            </div>
            <div>
              <p className="section-eyebrow bg-emerald-50 text-emerald-800">POS Apotik terpisah</p>
              <h2 className="section-heading text-slate-950">Mesin POS sama, workflow farmasinya berbeda.</h2>
              <div className="mt-6 grid gap-3">
                {posSteps.map(([no, titleStep, body]) => (
                  <div key={no} className="grid grid-cols-[3.5rem_1fr] gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <span className="font-mono text-lg font-black text-emerald-700">{no}</span>
                    <div>
                      <h3 className="font-bold">{titleStep}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/app/apotik/pos" className="btn-primary bg-emerald-700 hover:bg-emerald-800">
                  Buka POS Apotik
                </Link>
                <Link to="/app/pos/kasir" className="btn-outline">
                  Bandingkan POS biasa
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="Racikan" className="bg-emerald-950 py-16 text-white">
          <div className="container-page grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <p className="section-eyebrow bg-white/10 text-emerald-200">Racikan dan produksi farmasi</p>
              <h2 className="text-3xl font-black sm:text-4xl">Racikan bukan item manual di kasir.</h2>
              <p className="mt-4 max-w-2xl leading-7 text-emerald-50">
                Produk racikan seharusnya lahir dari resep/BOM: bahan baku berkurang,
                hasil jadi punya batch, expiry, etiket, HPP, dan jejak siapa yang menyiapkan.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {[
                  [Barcode, 'Barcode dan batch', 'Setiap obat dan bahan racikan dapat ditelusuri hingga batch dan expiry.'],
                  [Layers3, 'Formularium', 'Katalog obat, formularium, substitusi, dan KFA dipisahkan dari stok fisik.'],
                  [ScanLine, 'Gudang farmasi', 'Penerimaan, mutasi, retur, waste, dan recall tetap melalui inventory.'],
                  [BadgeCheck, 'Pemisahan wewenang', 'Yang meresepkan, menelaah, menyiapkan, dan menyerahkan tidak dilebur.'],
                ].map(([Icon, heading, body]) => {
                  const IconComponent = Icon as typeof Barcode;
                  return (
                    <article key={heading as string} className="rounded-lg bg-white/10 p-5 ring-1 ring-white/10">
                      <IconComponent className="h-6 w-6 text-emerald-200" aria-hidden />
                      <h3 className="mt-4 font-bold">{heading as string}</h3>
                      <p className="mt-2 text-sm leading-6 text-emerald-50">{body as string}</p>
                    </article>
                  );
                })}
              </div>
            </div>
            <LandingImage
              src={photo.lab}
              alt="Laboratorium racikan farmasi"
              className="h-full min-h-96 rounded-lg object-cover shadow-2xl"
              fallbackLabel="Racikan farmasi"
              tone="emerald"
            />
          </div>
        </section>

        <section id="Keamanan" className="bg-white py-16">
          <div className="container-page grid gap-8 lg:grid-cols-3">
            <div>
              <p className="section-eyebrow bg-emerald-50 text-emerald-800">Keselamatan obat</p>
              <h2 className="section-heading text-slate-950">Peringatan tidak dibuat sama kerasnya.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              {[
                'Blocking alert menahan proses, bukan sekadar memberi warna.',
                'Obat terkendali dan high-alert terlihat sebelum pembayaran.',
                'Racikan punya bahan, takaran, etiket, HPP, dan jejak penyiapan.',
                'Semua akses data pasien tetap membawa purpose of use.',
              ].map((item) => (
                <p key={item} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  {item}
                </p>
              ))}
            </div>
          </div>
        </section>

        <OfferDocumentSection tone="emerald" />

        <LandingCta
          title={tenantProfile ? `Kelola katalog dan POS ${title}` : `Bangun kanal apotik di ${title}`}
          primary={tenantProfile ? 'Masuk tenant' : 'Mulai daftar'}
          secondary={tenantProfile ? 'Lihat katalog' : 'Hubungi tim'}
          primaryTo={tenantProfile ? '/masuk' : '/daftar'}
          secondaryTo={tenantProfile ? '#Katalog' : '/demo'}
          tone="emerald"
        />
      </main>
    </div>
  );
}

function TenantApotikProfile({ title, host }: { title: string; host: string }) {
  return (
    <>
      <section id="Profil" className="bg-emerald-950 py-14 text-white sm:py-16">
        <div className="container-page grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="section-eyebrow bg-white/10 text-emerald-200">Profil tenant apotik</p>
            <h2 className="text-3xl font-black leading-tight sm:text-4xl">
              {title} menampilkan layanan, jam operasional, dan produk yang dapat dibeli.
            </h2>
            <p className="mt-4 max-w-2xl leading-7 text-emerald-50">
              Subdomain tenant dipakai sebagai etalase apotik: pasien dapat melihat
              kategori produk, status stok ringkas, layanan resep, pengantaran lokal,
              dan kanal masuk untuk transaksi di POS Apotik.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ['4.8/5', 'rating layanan'],
                ['120+', 'produk aktif'],
                ['2 jam', 'estimasi siap ambil'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-lg bg-white/10 p-4 ring-1 ring-white/10">
                  <p className="text-2xl font-black">{value}</p>
                  <p className="mt-1 text-xs text-emerald-100">{label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 text-slate-950 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-emerald-700">Etalase aktif</p>
                <h3 className="mt-1 text-2xl font-black">{host}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Produk resep, OTC, alat kesehatan, vitamin, dan racikan tampil sebagai katalog publik,
                  sedangkan transaksi penuh tetap lewat akun tenant.
                </p>
              </div>
              <Star className="h-7 w-7 text-amber-500" aria-hidden />
            </div>
            <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-800">Dikelola admin tenant</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Nama produk, harga, foto, kategori, dan status tampil dari etalase tenant
                yang disiapkan untuk sinkron ke master produk, buku harga, dan POS Apotik.
              </p>
              <Link to="/app/products" className="mt-3 inline-flex items-center gap-2 text-sm font-black text-emerald-800">
                Kelola katalog produk
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {tenantServices.map(([service, body]) => (
                <article key={service} className="rounded-lg bg-emerald-50 p-4 ring-1 ring-emerald-100">
                  <h4 className="font-bold text-emerald-950">{service}</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="Katalog" className="bg-white py-14 sm:py-16">
        <div className="container-page">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="section-eyebrow bg-emerald-50 text-emerald-800">Katalog produk tenant</p>
              <h2 className="section-heading text-slate-950">Produk yang dijual terlihat jelas sebelum pasien datang.</h2>
              <p className="mt-3 text-base leading-8 text-slate-700">
                Etalase tenant memakai kategori yang mudah dipahami, kartu produk bergambar,
                harga, satuan, status stok, dan penanda resep agar pengunjung cepat mengambil keputusan.
              </p>
            </div>
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
              <Search className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">Cari obat, vitamin, alat kesehatan, atau racikan</span>
            </div>
          </div>

          <div className="mt-7 flex gap-2 overflow-x-auto pb-2">
            {['Semua', 'Obat bebas', 'Resep dokter', 'Vitamin', 'Alat kesehatan', 'Racikan'].map((category, index) => (
              <span
                key={category}
                className={
                  index === 0
                    ? 'whitespace-nowrap rounded-full bg-emerald-700 px-4 py-2 text-sm font-bold text-white'
                    : 'whitespace-nowrap rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700'
                }
              >
                {category}
              </span>
            ))}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tenantProducts.map((product) => (
              <article key={product.name} className="flex min-h-[27rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative h-44 bg-emerald-50">
                  <LandingImage
                    src={product.image}
                    alt={`Produk ${product.name} di katalog tenant apotik`}
                    className="h-full w-full object-cover"
                    fallbackLabel={product.category}
                    tone="emerald"
                  />
                  <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-800 shadow-sm">
                    {product.category}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black text-slate-950">{product.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{product.detail}</p>
                    </div>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Pill className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-slate-500">Satuan</dt>
                      <dd className="mt-1 font-bold text-slate-900">{product.unit}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <dt className="text-slate-500">Tersedia</dt>
                      <dd className="mt-1 font-bold text-slate-900">{product.availability}</dd>
                    </div>
                    <div className="col-span-2 rounded-lg bg-emerald-50 p-3">
                      <dt className="text-emerald-700">Layanan</dt>
                      <dd className="mt-1 font-bold text-emerald-950">{product.channel}</dd>
                    </div>
                  </dl>
                </div>
                <div className="mt-auto flex items-end justify-between gap-3 border-t border-slate-100 p-5 pt-4">
                  <div>
                    <p className="text-xs text-slate-500">Harga</p>
                    <p className="text-lg font-black text-slate-950">{product.price}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-100">
                    {product.badge}
                  </span>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-900">
            Produk resep dan obat tertentu tidak dijual bebas dari halaman publik. Katalog
            menampilkan ketersediaan dan kanal layanan; validasi resep, telaah apoteker,
            dan pembayaran tetap dilakukan di POS Apotik tenant.
          </div>
        </div>
      </section>

      <section id="Layanan" className="bg-[#f6fbf8] py-14 sm:py-16">
        <div className="container-page grid gap-6 lg:grid-cols-3">
          {[
            [Truck, 'Ambil di apotik', 'Pesanan disiapkan dan dikonfirmasi sebelum pasien datang.'],
            [ClipboardCheck, 'Resep dan racikan', 'Resep dokter, racikan, dan etiket diproses sebagai pekerjaan farmasi.'],
            [ShieldAlert, 'Keselamatan obat', 'High-alert, LASA, expiry, controlled drug, dan alergi dinaikkan ke prioritas.'],
          ].map(([Icon, heading, body]) => {
            const IconComponent = Icon as typeof Truck;
            return (
              <article key={heading as string} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <IconComponent className="h-6 w-6 text-emerald-700" aria-hidden />
                <h3 className="mt-4 font-black text-slate-950">{heading as string}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{body as string}</p>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

export default ApotikLandingPage;
