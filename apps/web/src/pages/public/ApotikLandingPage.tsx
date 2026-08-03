import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Barcode,
  ClipboardCheck,
  Layers3,
  PackageCheck,
  Pill,
  ScanLine,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import { LandingHeader, LandingCta, OfferDocumentSection } from './EmedikLandingPage';

const pharmacyFlows = [
  { icon: ClipboardCheck, title: 'Telaah resep', body: 'Apoteker melihat resep, alergi, interaksi, obat terkendali, LASA, dan catatan dokter.' },
  { icon: PackageCheck, title: 'Dispensing', body: 'Penyerahan obat mengikuti sisa item, status telaah, dan stok yang berasal dari adapter inventory.' },
  { icon: ShieldAlert, title: 'High-alert safety', body: 'Obat risiko tinggi dan obat terkendali terlihat sejak daftar antrean, bukan hanya di rincian.' },
  { icon: Truck, title: 'Stok dan retur', body: 'Pembelian, penerimaan, mutasi, waste, retur, dan batch expiry disiapkan untuk alur apotik.' },
];

const metrics = [
  ['15 dtk', 'refresh antrean resep'],
  ['6 benar', 'pemberian obat eMAR'],
  ['0 hard-delete', 'sample data disembunyikan'],
  ['100%', 'akses pasien diaudit'],
];

export function ApotikLandingPage({ demo = false }: { demo?: boolean }) {
  const host = demo ? 'demo-apotik.emedik.id' : 'apotik.emedik.id';
  const title = demo ? 'Demo Apotik eMedik' : 'Apotik eMedik';

  return (
    <div className="min-h-screen bg-emerald-50 text-slate-950">
      <LandingHeader brand={title} links={['Farmasi', 'Operasional', 'Keamanan', 'Dokumen', 'Demo']} />

      <main>
        <section className="overflow-hidden bg-[#f8fffb]">
          <div className="container-page grid min-h-[calc(100vh-4rem)] gap-10 py-14 lg:grid-cols-[0.94fr_1.06fr] lg:items-center lg:py-20">
            <div>
              <p className="section-eyebrow bg-emerald-100 text-emerald-800">
                Landing khusus apotik dan kefarmasian
              </p>
              <h1 className="max-w-3xl text-4xl font-black leading-tight text-slate-950 sm:text-5xl lg:text-6xl">
                {demo ? 'Demo apotik siap dicoba.' : 'Apotik modern untuk resep, stok, dan keselamatan obat.'}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
                eMedik menempatkan farmasi sebagai alur klinis, bukan sekadar gudang.
                Resep ditelaah, obat berisiko ditandai, penyerahan tercatat, dan stok
                tetap lewat kontrak inventory yang aman.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={demo ? '/demo' : '/daftar'} className="btn-primary bg-emerald-700 px-6 py-3 text-base hover:bg-emerald-800">
                  {demo ? 'Masuk demo apotik' : 'Daftarkan apotik'}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link to="/masuk" className="btn-outline px-6 py-3 text-base">
                  Masuk dashboard
                </Link>
              </div>
              <p className="mt-6 font-mono text-sm text-emerald-800">{host}</p>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-white p-4 shadow-2xl">
              <div className="rounded-lg bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-emerald-200">Antrean farmasi</p>
                    <h2 className="mt-1 text-xl font-black">Resep menunggu telaah</h2>
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
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                {metrics.map(([value, label]) => (
                  <div key={label} className="rounded-lg bg-emerald-50 p-3 text-center">
                    <p className="text-xl font-black text-emerald-800">{value}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="Farmasi" className="bg-white py-16">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="section-eyebrow bg-emerald-50 text-emerald-800">Farmasi klinis</p>
              <h2 className="section-heading text-slate-950">Dibuat untuk apoteker yang sedang melayani antrean nyata.</h2>
              <p className="section-lead">
                Informasi yang berbahaya bila terlambat terlihat dinaikkan ke daftar:
                obat terkendali, obat risiko tinggi, LASA, dan peringatan blocking.
              </p>
            </div>
            <div className="mt-8 grid gap-4 lg:grid-cols-4">
              {pharmacyFlows.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5">
                    <Icon className="h-6 w-6 text-emerald-700" aria-hidden />
                    <h3 className="mt-4 font-bold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.body}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="Operasional" className="bg-emerald-950 py-16 text-white">
          <div className="container-page grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <div>
              <p className="section-eyebrow bg-white/10 text-emerald-200">Operasional apotik</p>
              <h2 className="text-3xl font-black">Dari barcode sampai laporan stok.</h2>
              <p className="mt-4 leading-7 text-emerald-50">
                Halaman apotik tenant dapat memakai pola subdomain
                <span className="font-mono"> {'{tenant}-apotik.emedik.id'}</span>, dengan
                <span className="font-mono"> demo-apotik.emedik.id</span> sebagai contoh publik.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [Barcode, 'Barcode dan batch', 'Batch, expiry, dan nomor seri dibaca sebagai bagian dari penyerahan dan stok.'],
                [Layers3, 'Formularium', 'Katalog obat, formularium, substitusi, dan pemetaan KFA dipisahkan dari stok fisik.'],
                [ScanLine, 'Penerimaan stok', 'Penerimaan barang, mutasi, retur, dan waste tetap melalui adapter inventory.'],
                [BadgeCheck, 'Kewenangan', 'Yang meresepkan bukan yang menelaah; yang memvalidasi bukan yang menerapkan.'],
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
        </section>

        <section id="Keamanan" className="bg-white py-16">
          <div className="container-page grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <p className="section-eyebrow bg-emerald-50 text-emerald-800">Keselamatan obat</p>
              <h2 className="section-heading text-slate-950">Peringatan tidak dibuat sama kerasnya.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              {['Blocking alert menahan proses, bukan sekadar memberi warna.', 'Omitted administration menuntut alasan.', 'Controlled medication dan high-alert terlihat sebelum resep dibuka.', 'Semua akses data pasien tetap membawa purpose of use.'].map((item) => (
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
