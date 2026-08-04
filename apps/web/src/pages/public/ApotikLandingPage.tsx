import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Barcode,
  Beaker,
  ClipboardCheck,
  Factory,
  Layers3,
  PackageCheck,
  Pill,
  ScanLine,
  ShieldAlert,
  ShoppingCart,
} from 'lucide-react';
import { LandingHeader, LandingCta, OfferDocumentSection } from './EmedikLandingPage';

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

export function ApotikLandingPage({ demo = false }: { demo?: boolean }) {
  const host = demo ? 'demo-apotik.emedik.id' : 'apotik.emedik.id';
  const title = demo ? 'Demo Apotik eMedik' : 'Apotik eMedik';

  return (
    <div className="min-h-screen bg-[#f6fbf8] text-slate-950">
      <LandingHeader brand={title} links={['Farmasi', 'POS Apotik', 'Racikan', 'Keamanan', 'Dokumen', 'Demo']} />

      <main>
        <section className="overflow-hidden bg-white">
          <div className="container-page grid min-h-[calc(100vh-4rem)] gap-10 py-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:py-16">
            <div>
              <p className="section-eyebrow bg-emerald-100 text-emerald-800">
                Landing khusus apotik, farmasi klinis, dan POS obat
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                {demo ? 'Demo apotik modern siap dicoba.' : 'Apotik modern untuk resep, racikan, stok, dan POS obat.'}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                eMedik memisahkan POS Apotik dari POS penjualan biasa karena obat
                bukan barang retail biasa. Kasir tetap cepat, tetapi resep dokter,
                batch-expiry, racikan, obat terkendali, dan audit pasien ikut terlihat.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={demo ? '/demo' : '/daftar'} className="btn-primary bg-emerald-700 px-6 py-3 text-base hover:bg-emerald-800">
                  {demo ? 'Masuk demo apotik' : 'Daftarkan apotik'}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/app/apotik/pos" className="btn-outline px-6 py-3 text-base">
                  Buka POS Apotik
                </Link>
              </div>
              <p className="mt-6 font-mono text-sm text-emerald-800">{host}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.72fr_0.28fr]">
              <div className="overflow-hidden rounded-lg border border-emerald-200 bg-slate-950 shadow-2xl">
                <img
                  src={photo.scan}
                  alt="Apoteker memindai dan menyiapkan obat di area farmasi"
                  className="h-64 w-full object-cover sm:h-80"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
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
              <img
                src={photo.shelf}
                alt="Rak obat apotik modern"
                className="h-full min-h-80 w-full object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
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
            <img
              src={photo.lab}
              alt="Laboratorium racikan farmasi"
              className="h-full min-h-96 rounded-lg object-cover shadow-2xl"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
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
          title={demo ? 'Buka demo apotik sekarang' : 'Bangun kanal apotik di eMedik.id'}
          primary={demo ? 'Masuk demo' : 'Mulai daftar'}
          secondary="Hubungi tim"
        />
      </main>
    </div>
  );
}

export default ApotikLandingPage;
