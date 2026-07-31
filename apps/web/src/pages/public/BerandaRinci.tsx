/**
 * Bagian rinci Beranda.
 *
 * Dipisahkan dari `HomePage` karena keduanya menjawab pertanyaan yang berbeda.
 * `HomePage` menampilkan blok CMS yang dapat disunting pengelola sewaktu-waktu;
 * berkas ini menerangkan APA yang sesungguhnya kami kerjakan — masalah yang
 * diselesaikan, kemampuan per modul, harga, dan perbandingannya dengan
 * pendekatan lain. Isinya bersumber dari `content/solusi.ts` supaya angka pada
 * Beranda, Presentasi, Proposal, PKS, dan Surat Penawaran tidak dapat berbeda.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  Download,
  FileSignature,
  FileText,
  Mail,
  MonitorPlay,
  Package,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Store,
  Warehouse,
  XCircle,
} from 'lucide-react';
import {
  APLIKASI_KLIEN,
  BELUM_TERMASUK_POS,
  BIAYA_IMPLEMENTASI,
  DOKUMEN,
  INDIKATOR,
  INFRASTRUKTUR,
  KELOMPOK_KEMAMPUAN,
  LABEL_TAHAP,
  MASALAH,
  OPSI_PEMBAYARAN,
  PAKET_PUSAT,
  PEMBANDING,
  PENDAMPINGAN,
  PETA_JALAN,
  POLA_PEMANFAATAN,
  RUPIAH,
  SESUDAH,
  SIMULASI,
  TAHAPAN,
  TARIF_POS,
  TERMASUK_POS,
} from '../../content/solusi';

const IKON: Record<string, typeof Store> = {
  store: Store,
  warehouse: Warehouse,
  calculator: Calculator,
  'shopping-cart': ShoppingCart,
  shield: ShieldCheck,
  sparkles: Sparkles,
  presentation: MonitorPlay,
  'file-text': FileText,
  'file-signature': FileSignature,
  mail: Mail,
};

function Judul({ eyebrow, judul, lead }: { eyebrow: string; judul: string; lead?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="section-eyebrow">{eyebrow}</p>
      <h2 className="section-heading">{judul}</h2>
      {lead && <p className="section-lead mx-auto">{lead}</p>}
    </div>
  );
}

function Lencana({ tahap }: { tahap: keyof typeof LABEL_TAHAP }) {
  const l = LABEL_TAHAP[tahap];
  return <span className={`badge ${l.kelas}`}>{l.teks}</span>;
}

export function BerandaRinci() {
  const [kelompokAktif, setKelompokAktif] = useState(KELOMPOK_KEMAMPUAN[0].kode);
  const kelompok = KELOMPOK_KEMAMPUAN.find((k) => k.kode === kelompokAktif) ?? KELOMPOK_KEMAMPUAN[0];

  return (
    <>
      {/* ------------------------------------------------ Empat dokumen */}
      <section className="border-b border-slate-200 bg-slate-50 py-12 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-page">
          <Judul
            eyebrow="Dokumen penawaran"
            judul="Semuanya terbuka untuk dibaca sekarang"
            lead="Tidak perlu mengisi formulir atau menunggu dihubungi sales. Presentasi, proposal, draf perjanjian, dan surat penawaran dapat dibaca, dicetak, dan dibawa ke rapat internal Anda hari ini juga."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DOKUMEN.map((d) => {
              const Ikon = IKON[d.ikon] ?? FileText;
              return (
                <Link
                  key={d.url}
                  to={d.url}
                  className="card group flex flex-col p-5 transition hover:border-brand-400 hover:shadow-md"
                >
                  <Ikon className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
                  <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{d.judul}</h3>
                  <p className="mt-1 flex-1 text-sm text-slate-600 dark:text-slate-300">{d.isi}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 dark:text-brand-300">
                    Buka
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- Masalah */}
      <section className="py-14">
        <div className="container-page">
          <Judul
            eyebrow="Yang perlu diselesaikan"
            judul="Empat masalah yang hampir selalu kami temui"
            lead="Bukan daftar fitur — ini keadaan nyata yang membuat pemilik usaha kehilangan uang tanpa menyadarinya."
          />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {MASALAH.map((m) => (
              <article
                key={m.judul}
                className="card border-l-4 border-l-rose-400 p-5 dark:border-l-rose-700"
              >
                <h3 className="flex items-start gap-2 font-semibold text-slate-900 dark:text-white">
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden />
                  {m.judul}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{m.isi}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-emerald-300 bg-emerald-50 p-6 dark:border-emerald-800 dark:bg-emerald-950/30">
            <h3 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
              Keadaan yang kami tuju
            </h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {SESUDAH.map((s) => (
                <li key={s} className="flex items-start gap-2 text-sm text-emerald-900 dark:text-emerald-100">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Kemampuan */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-page">
          <Judul
            eyebrow="Kemampuan sistem"
            judul="Apa yang Anda peroleh, per bagian"
            lead="Setiap butir diberi keterangan tahap: sudah berjalan, sedang dibangun, atau masih rencana. Kami memilih menyebutkannya apa adanya daripada membiarkan Anda mengetahuinya setelah kontrak ditandatangani."
          />

          <div className="mt-8 flex flex-wrap justify-center gap-2" role="tablist" aria-label="Kelompok kemampuan">
            {KELOMPOK_KEMAMPUAN.map((k) => {
              const Ikon = IKON[k.ikon] ?? Package;
              const aktif = k.kode === kelompokAktif;
              return (
                <button
                  key={k.kode}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => setKelompokAktif(k.kode)}
                  className={
                    aktif
                      ? 'inline-flex items-center gap-2 rounded-full bg-brand-700 px-4 py-2 text-sm font-medium text-white'
                      : 'inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                  }
                >
                  <Ikon className="h-4 w-4" aria-hidden />
                  {k.judul}
                </button>
              );
            })}
          </div>

          <div className="mt-6">
            <p className="mx-auto max-w-2xl text-center text-slate-600 dark:text-slate-300">{kelompok.ringkas}</p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {kelompok.butir.map((b) => (
                <article key={b.judul} className="card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{b.judul}</h3>
                    <Lencana tahap={b.tahap} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{b.isi}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------- Aplikasi pendamping */}
      <section className="py-14">
        <div className="container-page">
          <Judul
            eyebrow="Aplikasi pendamping"
            judul="Tiga aplikasi yang sudah dirilis dan dapat diunduh hari ini"
            lead="Berbeda dari sebagian modul yang masih dalam pengerjaan, ketiganya sudah selesai dan dirilis resmi. Semuanya terhubung ke server yang sama, tanpa server tambahan."
          />
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {APLIKASI_KLIEN.map((a) => (
              <article key={a.repo} className="card flex flex-col p-5">
                <Download className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
                <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{a.nama}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{a.isi}</p>
                <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  Dirilis gratis melalui GitHub Releases · <code className="ltr-code">{a.repo}</code>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- Pembanding */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-page">
          <Judul
            eyebrow="Perbandingan"
            judul="Di mana kami memilih jalan yang berbeda"
            lead="Bukan daftar keunggulan tanpa alasan. Setiap baris menyebutkan pendekatan yang umum dipakai, pilihan kami, dan mengapa perbedaannya berarti bagi Anda."
          />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700">
                  <th className="p-3 text-start font-semibold">Aspek</th>
                  <th className="p-3 text-start font-semibold text-slate-500 dark:text-slate-400">
                    Pendekatan yang umum
                  </th>
                  <th className="p-3 text-start font-semibold text-brand-700 dark:text-brand-300">
                    Pilihan kami
                  </th>
                </tr>
              </thead>
              <tbody>
                {PEMBANDING.map((p) => (
                  <tr key={p.aspek} className="border-b border-slate-200 align-top dark:border-slate-800">
                    <td className="p-3 font-medium text-slate-900 dark:text-white">{p.aspek}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{p.umum}</td>
                    <td className="p-3">
                      <p className="font-medium text-slate-900 dark:text-white">{p.kami}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        <strong>Mengapa ini berarti:</strong> {p.mengapa}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- Harga */}
      <section className="py-14" id="harga-rinci">
        <div className="container-page">
          <Judul
            eyebrow="Skema harga"
            judul="Dua komponen, dijumlahkan setiap bulan"
            lead="Biaya bulanan = Paket Modul Pusat + biaya POS pertama tiap outlet + biaya POS tambahan. Makin banyak outlet, makin rendah tarif per unitnya."
          />

          <h3 className="mt-10 text-lg font-semibold text-slate-900 dark:text-white">
            A. Tarif POS per terminal (per outlet)
          </h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700">
                  <th className="p-3 text-start font-semibold">Jumlah outlet</th>
                  <th className="p-3 text-end font-semibold">POS pertama / bulan</th>
                  <th className="p-3 text-end font-semibold">POS tambahan / bulan</th>
                </tr>
              </thead>
              <tbody>
                {TARIF_POS.map((t) => (
                  <tr key={t.jenjang} className="border-b border-slate-200 dark:border-slate-800">
                    <td className="p-3 font-medium">{t.jenjang}</td>
                    <td className="p-3 text-end tabular-nums">
                      {t.mulai && <span className="text-slate-500">mulai </span>}
                      {RUPIAH.format(t.pertama)}
                    </td>
                    <td className="p-3 text-end tabular-nums">
                      {t.mulai && <span className="text-slate-500">mulai </span>}
                      {RUPIAH.format(t.tambahan)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
            <p className="font-medium text-slate-900 dark:text-white">Sudah termasuk pada POS pertama:</p>
            <p className="mt-1 text-slate-600 dark:text-slate-300">{TERMASUK_POS.join(', ')}.</p>
            <p className="mt-2 text-slate-500 dark:text-slate-400">{BELUM_TERMASUK_POS}</p>
          </div>

          <h3 className="mt-10 text-lg font-semibold text-slate-900 dark:text-white">
            B. Paket Modul Pusat (per perusahaan, bukan per outlet)
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PAKET_PUSAT.map((p) => (
              <article
                key={p.kode}
                className={
                  p.unggulan
                    ? 'card relative border-2 border-brand-500 p-5'
                    : 'card p-5'
                }
              >
                {p.unggulan && (
                  <span className="absolute -top-3 start-4 rounded-full bg-brand-700 px-3 py-0.5 text-xs font-medium text-white">
                    Paling lengkap
                  </span>
                )}
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{p.label}</p>
                <h4 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{p.nama}</h4>
                <p className="mt-2 text-2xl font-bold tabular-nums text-brand-700 dark:text-brand-300">
                  {p.harga === 0 ? 'Rp 0' : RUPIAH.format(p.harga)}
                  <span className="text-sm font-normal text-slate-500"> / bulan</span>
                </p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {p.isi.map((i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      {i}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {p.cocok}
                </p>
              </article>
            ))}
          </div>

          <h3 className="mt-10 text-lg font-semibold text-slate-900 dark:text-white">
            C. Simulasi biaya bulanan
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Mengasumsikan rata-rata 2 unit POS per outlet dan paket Full Integrated Suite.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 dark:border-slate-700">
                  <th className="p-3 text-start font-semibold">Skala</th>
                  <th className="p-3 text-end font-semibold">POS</th>
                  <th className="p-3 text-end font-semibold">Modul pusat</th>
                  <th className="p-3 text-end font-semibold">Total / bulan</th>
                </tr>
              </thead>
              <tbody>
                {SIMULASI.map((s) => (
                  <tr key={s.outlet} className="border-b border-slate-200 dark:border-slate-800">
                    <td className="p-3 font-medium">{s.outlet} outlet</td>
                    <td className="p-3 text-end tabular-nums">{RUPIAH.format(s.pos)}</td>
                    <td className="p-3 text-end tabular-nums">{RUPIAH.format(s.pusat)}</td>
                    <td className="p-3 text-end font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                      {RUPIAH.format(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="card p-5">
              <h4 className="font-semibold text-slate-900 dark:text-white">
                Biaya implementasi awal (sekali bayar)
              </h4>
              <dl className="mt-3 space-y-2 text-sm">
                {BIAYA_IMPLEMENTASI.map((b) => (
                  <div key={b.lingkup} className="flex justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-800">
                    <dt className="text-slate-600 dark:text-slate-300">{b.lingkup}</dt>
                    <dd className="font-medium tabular-nums text-slate-900 dark:text-white">{b.nilai}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="card p-5">
              <h4 className="font-semibold text-slate-900 dark:text-white">Opsi pembayaran lain</h4>
              <ul className="mt-3 space-y-3 text-sm">
                {OPSI_PEMBAYARAN.map((o) => (
                  <li key={o.judul}>
                    <p className="font-medium text-slate-900 dark:text-white">{o.judul}</p>
                    <p className="text-slate-600 dark:text-slate-300">{o.isi}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
            <strong>Terbuka untuk dinegosiasikan.</strong> Seluruh angka di atas adalah acuan
            standar. Skala jaringan, kompleksitas kebutuhan, dan kesepakatan akhir dapat
            mengubahnya — silakan bicarakan dengan kami sebelum memutuskan.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------- Pola pemanfaatan */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-page">
          <Judul eyebrow="Dua pola pemanfaatan" judul="Berdiri sendiri, atau menyatu dengan lembaga" />
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {POLA_PEMANFAATAN.map((p) => (
              <article key={p.judul} className="card p-6">
                <Building2 className="h-6 w-6 text-brand-600 dark:text-brand-400" aria-hidden />
                <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{p.judul}</h3>
                <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">{p.isi}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-10 text-center text-lg font-semibold text-slate-900 dark:text-white">
            Tiga pilihan pemasangan
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {INFRASTRUKTUR.map((i) => (
              <article key={i.judul} className="card p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white">{i.judul}</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{i.isi}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ Peta jalan */}
      <section className="py-14">
        <div className="container-page">
          <Judul
            eyebrow="Peta jalan"
            judul="Urutan pengerjaan, dan mengapa urutannya begitu"
            lead="Angka yang benar dibangun lebih dahulu, distribusi bagi hasil dibangun di atasnya. Membalik urutan ini berarti membagi uang yang belum tentu ada."
          />
          <ol className="mt-8 space-y-4">
            {PETA_JALAN.map((f, i) => (
              <li key={f.judul} className="card flex gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{f.fase}</p>
                    <Lencana tahap={f.tahap} />
                  </div>
                  <h3 className="mt-0.5 font-semibold text-slate-900 dark:text-white">{f.judul}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{f.isi}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------- Pelaksanaan */}
      <section className="border-y border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="container-page">
          <Judul eyebrow="Cara kami melaksanakan" judul="Lima tahap, terukur, minim gangguan operasional" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {TAHAPAN.map((t) => (
              <article key={t.nomor} className="card p-5">
                <p className="text-2xl font-bold text-brand-200 dark:text-brand-800">{t.nomor}</p>
                <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{t.judul}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.isi}</p>
              </article>
            ))}
          </div>

          <h3 className="mt-10 text-center text-lg font-semibold text-slate-900 dark:text-white">
            Yang mendampingi Anda
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PENDAMPINGAN.map((p) => (
              <article key={p.judul} className="card p-5">
                <h4 className="font-semibold text-slate-900 dark:text-white">{p.judul}</h4>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{p.isi}</p>
              </article>
            ))}
          </div>
          <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
            Pelatihan daring <strong>gratis</strong>. Untuk pelatihan tatap muka, jasa instruktur
            tetap gratis — Anda hanya menanggung transportasi dan akomodasi tim di lokasi.
          </p>
        </div>
      </section>

      {/* ------------------------------------------------------ Indikator */}
      <section className="py-14">
        <div className="container-page">
          <Judul
            eyebrow="Indikator keberhasilan"
            judul="Yang dapat Anda ukur setelah sistem berjalan"
            lead="Supaya keberhasilan implementasi tidak bergantung pada kesan, melainkan pada angka yang dapat dilihat bersama."
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {INDIKATOR.map((i) => (
              <article key={i.judul} className="card p-5">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{i.judul}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{i.isi}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-brand-300 bg-brand-50 p-6 text-center dark:border-brand-800 dark:bg-brand-950/30">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Coba sendiri sebelum memutuskan
            </h3>
            <p className="mx-auto mt-2 max-w-2xl text-slate-700 dark:text-slate-300">
              Daftarkan bisnis Anda dan ruang kerja siap dalam hitungan menit — lengkap dengan
              data contoh bila Anda menginginkannya, atau kosong bila Anda sudah punya data
              sendiri. Data contoh dapat dihapus kapan saja tanpa menyentuh peran, hak akses,
              satuan, maupun bagan akun.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link to="/daftar" className="btn-primary">
                Daftarkan bisnis Anda
              </Link>
              <Link to="/presentasi" className="btn-outline">
                Lihat presentasi
              </Link>
              <Link to="/kontak" className="btn-ghost">
                Bicara dengan kami
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
