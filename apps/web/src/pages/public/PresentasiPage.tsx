/**
 * Presentasi daring — dua puluh slide yang dapat dijalankan langsung di layar rapat.
 *
 * Dirancang untuk dipakai sambil berbicara di depan orang, jadi yang diutamakan
 * adalah hal-hal yang terasa saat itu: panah kiri-kanan berpindah slide, F
 * membuka layar penuh, angka slide terlihat, dan tidak ada yang perlu diunduh
 * lebih dahulu. Isinya bersumber dari `content/solusi.ts` yang sama dengan
 * Beranda dan Proposal.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  APLIKASI_KLIEN,
  BIAYA_IMPLEMENTASI,
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
} from '../../content/solusi';

interface Slide {
  judul: string;
  sub?: string;
  isi: ReactNode;
}

function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
      <h3 className="font-semibold text-white">{judul}</h3>
      <div className="mt-1 text-sm leading-relaxed text-slate-200">{children}</div>
    </div>
  );
}

export function PresentasiPage() {
  const [indeks, setIndeks] = useState(0);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);

  const slides = useMemo<Slide[]>(
    () => [
      {
        judul: 'Transformasi Digital Gudang, Kasir & Bisnis Ritel Terpadu',
        sub: 'eBisnis.id — satu platform untuk kasir, gudang, HPP, akuntansi, pengadaan, dan toko online',
        isi: (
          <div className="grid gap-4 sm:grid-cols-3">
            <Kartu judul="Satu data terpadu">
              Kasir, gudang, pengadaan, dan akuntansi berjalan di atas basis data yang sama.
            </Kartu>
            <Kartu judul="Stok & kas selalu terlacak">
              Setiap perubahan tercatat dan tertelusur ke dokumen sumbernya.
            </Kartu>
            <Kartu judul="Kontrol, audit, transparansi">
              Hak akses berjenjang dan catatan audit yang tidak dapat disunting siapa pun.
            </Kartu>
          </div>
        ),
      },
      {
        judul: 'Ringkasan eksekutif',
        sub: 'Satu platform untuk menggerakkan seluruh rantai nilai ritel dan distribusi',
        isi: (
          <div className="grid gap-4 sm:grid-cols-3">
            <Kartu judul="Integrasi operasional">
              Kasir, gudang, pengadaan, dan akuntansi berjalan dalam satu alur kerja yang saling
              terhubung — bukan empat aplikasi yang datanya disalin manual.
            </Kartu>
            <Kartu judul="Angka yang dapat dipercaya">
              HPP digulung dari komposisi resep dan jurnal terbentuk dari dokumen, sehingga margin
              yang dilaporkan bukan hasil taksiran.
            </Kartu>
            <Kartu judul="Kontrol manajemen">
              Pimpinan memperoleh dasbor, jejak audit, dan laporan yang dapat ditelusuri sampai ke
              transaksi aslinya.
            </Kartu>
          </div>
        ),
      },
      {
        judul: 'Masalah yang perlu diselesaikan',
        sub: 'Empat keadaan yang membuat pemilik usaha kehilangan uang tanpa menyadarinya',
        isi: (
          <div className="grid gap-3 sm:grid-cols-2">
            {MASALAH.map((m) => (
              <Kartu key={m.judul} judul={m.judul}>
                {m.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      {
        judul: 'Transformasi yang dihasilkan',
        sub: 'Dari pencatatan manual menjadi satu ekosistem yang terhubung',
        isi: (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-rose-400/40 bg-rose-950/30 p-4">
              <h3 className="font-semibold text-rose-200">Sebelum</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                {MASALAH.map((m) => (
                  <li key={m.judul}>• {m.judul}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-emerald-400/40 bg-emerald-950/30 p-4">
              <h3 className="font-semibold text-emerald-200">Sesudah</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-200">
                {SESUDAH.map((s) => (
                  <li key={s}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        ),
      },
      {
        judul: 'Dua pola pemanfaatan',
        sub: 'Berdiri sendiri, atau menyatu dengan lembaga pendidikan',
        isi: (
          <div className="grid gap-4 sm:grid-cols-2">
            {POLA_PEMANFAATAN.map((p) => (
              <Kartu key={p.judul} judul={p.judul}>
                {p.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      {
        judul: 'Nilai strategis',
        sub: 'Manfaat yang langsung terasa oleh pimpinan, kasir, dan investor',
        isi: (
          <div className="grid gap-3 sm:grid-cols-3">
            <Kartu judul="Transaksi lebih cepat">
              Stok, harga, dan diskon tervalidasi otomatis oleh sistem.
            </Kartu>
            <Kartu judul="Stok lebih akurat">
              Validasi di sisi server dengan penguncian baris mencegah dua kasir menjual stok yang
              sama.
            </Kartu>
            <Kartu judul="Data lebih tertib">
              Setiap pergerakan stok dan jurnal tersimpan rapi, tertelusur ke dokumen sumbernya.
            </Kartu>
            <Kartu judul="Laporan siap pakai">
              Rekap operasional dan status posting tersedia untuk rapat pimpinan.
            </Kartu>
            <Kartu judul="Citra lebih profesional">
              Kasir modern, pembayaran non-tunai, dan toko online berdomain sendiri.
            </Kartu>
            <Kartu judul="Siap bertumbuh">
              Diterapkan bertahap, dari satu outlet sampai jaringan multi-cabang.
            </Kartu>
          </div>
        ),
      },
      {
        judul: 'Fleksibilitas infrastruktur',
        sub: 'Tiga skema pemasangan, disesuaikan kebijakan data Anda',
        isi: (
          <div className="grid gap-3 sm:grid-cols-3">
            {INFRASTRUKTUR.map((i) => (
              <Kartu key={i.judul} judul={i.judul}>
                {i.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      ...KELOMPOK_KEMAMPUAN.map((k, i) => ({
        judul: `${i + 1}. ${k.judul}`,
        sub: k.ringkas,
        isi: (
          <div className="grid gap-3 sm:grid-cols-2">
            {k.butir.map((b) => (
              <div key={b.judul} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="font-semibold text-white">{b.judul}</h3>
                  <span className={`badge ${LABEL_TAHAP[b.tahap].kelas}`}>
                    {LABEL_TAHAP[b.tahap].teks}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">{b.isi}</p>
              </div>
            ))}
          </div>
        ),
      })),
      {
        judul: 'Aplikasi pendamping yang sudah dirilis',
        sub: 'Bukan rencana — ketiganya dapat diunduh dan dipasang hari ini juga',
        isi: (
          <div className="grid gap-3 sm:grid-cols-3">
            {APLIKASI_KLIEN.map((a) => (
              <Kartu key={a.repo} judul={a.nama}>
                {a.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      {
        judul: 'Di mana kami memilih jalan berbeda',
        sub: 'Perbedaan pendekatan, beserta alasan mengapa perbedaannya berarti',
        isi: (
          <div className="max-h-full overflow-y-auto">
            <table className="w-full border-collapse text-start text-sm">
              <thead>
                <tr className="border-b border-white/30 text-white">
                  <th className="p-2 text-start">Aspek</th>
                  <th className="p-2 text-start">Umum</th>
                  <th className="p-2 text-start">Kami</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {PEMBANDING.map((p) => (
                  <tr key={p.aspek} className="border-b border-white/10 align-top">
                    <td className="p-2 font-medium text-white">{p.aspek}</td>
                    <td className="p-2">{p.umum}</td>
                    <td className="p-2">{p.kami}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ),
      },
      {
        judul: 'Peta jalan pengembangan',
        sub: 'Angka yang benar dibangun lebih dahulu, distribusi bagi hasil di atasnya',
        isi: (
          <div className="grid gap-3 sm:grid-cols-2">
            {PETA_JALAN.map((f) => (
              <div key={f.judul} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs uppercase tracking-wide text-slate-300">{f.fase}</span>
                  <span className={`badge ${LABEL_TAHAP[f.tahap].kelas}`}>
                    {LABEL_TAHAP[f.tahap].teks}
                  </span>
                </div>
                <h3 className="mt-1 font-semibold text-white">{f.judul}</h3>
                <p className="mt-1 text-sm text-slate-200">{f.isi}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        judul: 'Metodologi implementasi',
        sub: 'Lima tahap, terukur, minim gangguan operasional',
        isi: (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TAHAPAN.map((t) => (
              <div key={t.nomor} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
                <p className="text-2xl font-bold text-white/40">{t.nomor}</p>
                <h3 className="mt-1 text-sm font-semibold text-white">{t.judul}</h3>
                <p className="mt-1 text-xs text-slate-200">{t.isi}</p>
              </div>
            ))}
          </div>
        ),
      },
      {
        judul: 'Skema harga: kasir (POS) per outlet',
        sub: 'Makin banyak outlet, makin hemat per unitnya',
        isi: (
          <table className="w-full border-collapse text-start">
            <thead>
              <tr className="border-b border-white/30 text-white">
                <th className="p-3 text-start">Jumlah outlet</th>
                <th className="p-3 text-end">POS pertama / bulan</th>
                <th className="p-3 text-end">POS tambahan / bulan</th>
              </tr>
            </thead>
            <tbody className="text-slate-100">
              {TARIF_POS.map((t) => (
                <tr key={t.jenjang} className="border-b border-white/10">
                  <td className="p-3">{t.jenjang}</td>
                  <td className="p-3 text-end tabular-nums">
                    {t.mulai && 'mulai '}
                    {RUPIAH.format(t.pertama)}
                  </td>
                  <td className="p-3 text-end tabular-nums">
                    {t.mulai && 'mulai '}
                    {RUPIAH.format(t.tambahan)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ),
      },
      {
        judul: 'Skema harga: paket modul pusat',
        sub: 'Satu biaya untuk seluruh perusahaan, bukan per outlet',
        isi: (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PAKET_PUSAT.map((p) => (
              <div
                key={p.kode}
                className={
                  p.unggulan
                    ? 'rounded-lg border-2 border-amber-400 bg-white/15 p-4 backdrop-blur'
                    : 'rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur'
                }
              >
                <p className="text-xs uppercase tracking-wide text-slate-300">{p.label}</p>
                <h3 className="font-semibold text-white">{p.nama}</h3>
                <p className="mt-1 text-xl font-bold tabular-nums text-amber-300">
                  {p.harga === 0 ? 'Rp 0' : RUPIAH.format(p.harga)}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-200">
                  {p.isi.map((i) => (
                    <li key={i}>• {i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ),
      },
      {
        judul: 'Simulasi & biaya implementasi',
        sub: 'Asumsi 2 unit POS per outlet dan paket Full Integrated Suite',
        isi: (
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/30 text-white">
                    <th className="p-2 text-start">Skala</th>
                    <th className="p-2 text-end">POS</th>
                    <th className="p-2 text-end">Pusat</th>
                    <th className="p-2 text-end">Total</th>
                  </tr>
                </thead>
                <tbody className="text-slate-100">
                  {SIMULASI.map((s) => (
                    <tr key={s.outlet} className="border-b border-white/10">
                      <td className="p-2">{s.outlet} outlet</td>
                      <td className="p-2 text-end tabular-nums">{RUPIAH.format(s.pos)}</td>
                      <td className="p-2 text-end tabular-nums">{RUPIAH.format(s.pusat)}</td>
                      <td className="p-2 text-end font-semibold tabular-nums text-amber-300">
                        {RUPIAH.format(s.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 rounded-lg border border-white/20 bg-white/10 p-3 text-sm text-slate-200">
                <p className="font-semibold text-white">Biaya implementasi awal</p>
                {BIAYA_IMPLEMENTASI.map((b) => (
                  <p key={b.lingkup}>
                    {b.lingkup}: {b.nilai}
                  </p>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {OPSI_PEMBAYARAN.map((o) => (
                <Kartu key={o.judul} judul={o.judul}>
                  {o.isi}
                </Kartu>
              ))}
              <p className="text-sm text-amber-200">
                Seluruh angka bersifat acuan dan terbuka untuk dinegosiasikan sesuai kebutuhan dan
                skala jaringan usaha.
              </p>
            </div>
          </div>
        ),
      },
      {
        judul: 'Dukungan & pendampingan',
        sub: 'Pelatihan daring gratis; tatap muka pun jasa instrukturnya gratis',
        isi: (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PENDAMPINGAN.map((p) => (
              <Kartu key={p.judul} judul={p.judul}>
                {p.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      {
        judul: 'Indikator keberhasilan',
        sub: 'Yang dapat diukur bersama setelah sistem berjalan',
        isi: (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INDIKATOR.map((i) => (
              <Kartu key={i.judul} judul={i.judul}>
                {i.isi}
              </Kartu>
            ))}
          </div>
        ),
      },
      {
        judul: 'Siap mendigitalkan gudang, kasir, dan unit usaha Anda?',
        sub: 'Coba sendiri lebih dahulu — tidak perlu menunggu dihubungi sales',
        isi: (
          <div className="space-y-5 text-center">
            <p className="mx-auto max-w-2xl text-slate-200">
              Daftarkan bisnis Anda dan ruang kerja siap dalam hitungan menit — lengkap dengan data
              contoh bila Anda menginginkannya, atau kosong bila Anda sudah punya data sendiri.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/daftar" className="btn bg-white px-5 py-2.5 font-semibold text-slate-900 hover:bg-slate-100">
                Daftarkan bisnis Anda
              </Link>
              <Link to="/proposal" className="btn border border-white/40 px-5 py-2.5 text-white hover:bg-white/10">
                Baca proposal
              </Link>
              <Link to="/penawaran" className="btn border border-white/40 px-5 py-2.5 text-white hover:bg-white/10">
                Surat penawaran
              </Link>
              <Link to="/pks" className="btn border border-white/40 px-5 py-2.5 text-white hover:bg-white/10">
                Draft PKS
              </Link>
              <Link to="/kontak" className="btn border border-white/40 px-5 py-2.5 text-white hover:bg-white/10">
                Bicara dengan kami
              </Link>
            </div>
          </div>
        ),
      },
    ],
    [],
  );

  const total = slides.length;
  const maju = useCallback(() => setIndeks((i) => Math.min(i + 1, total - 1)), [total]);
  const mundur = useCallback(() => setIndeks((i) => Math.max(i - 1, 0)), []);

  const alihLayarPenuh = useCallback(() => {
    if (!document.fullscreenElement) {
      void wadah.current?.requestFullscreen?.().then(() => setLayarPenuh(true));
    } else {
      void document.exitFullscreen?.().then(() => setLayarPenuh(false));
    }
  }, []);

  useEffect(() => {
    const padaTombol = (e: KeyboardEvent) => {
      // Jangan bajak papan ketik saat pengguna sedang mengetik di suatu isian.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        maju();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        mundur();
      } else if (e.key === 'Home') {
        setIndeks(0);
      } else if (e.key === 'End') {
        setIndeks(total - 1);
      } else if (e.key.toLowerCase() === 'f') {
        alihLayarPenuh();
      }
    };
    window.addEventListener('keydown', padaTombol);
    return () => window.removeEventListener('keydown', padaTombol);
  }, [maju, mundur, total, alihLayarPenuh]);

  useEffect(() => {
    const padaUbah = () => setLayarPenuh(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', padaUbah);
    return () => document.removeEventListener('fullscreenchange', padaUbah);
  }, []);

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'Presentasi — eBisnis.id';
    return () => {
      document.title = sebelumnya;
    };
  }, []);

  const slide = slides[indeks];

  return (
    <div
      ref={wadah}
      className="flex min-h-[calc(100vh-4rem)] flex-col bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Beranda
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm tabular-nums text-slate-300">
            {indeks + 1} / {total}
          </span>
          <button
            type="button"
            onClick={alihLayarPenuh}
            className="rounded-lg border border-white/30 p-2 text-white hover:bg-white/10"
            aria-label={layarPenuh ? 'Keluar dari layar penuh' : 'Layar penuh'}
          >
            {layarPenuh ? (
              <Minimize2 className="h-4 w-4" aria-hidden />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <section
        className="flex flex-1 flex-col justify-center px-4 py-6 sm:px-10"
        aria-live="polite"
        aria-label={`Slide ${indeks + 1} dari ${total}: ${slide.judul}`}
      >
        <div className="mx-auto w-full max-w-6xl">
          <h1 className="text-2xl font-bold leading-tight text-white sm:text-4xl">{slide.judul}</h1>
          {slide.sub && <p className="mt-2 text-base text-slate-300 sm:text-lg">{slide.sub}</p>}
          <div className="mt-6">{slide.isi}</div>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={mundur}
          disabled={indeks === 0}
          className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Sebelumnya
        </button>

        {/* Penunjuk slide; juga dapat diklik untuk melompat. */}
        <div className="hidden flex-1 items-center justify-center gap-1.5 sm:flex">
          {slides.map((s, i) => (
            <button
              key={s.judul}
              type="button"
              onClick={() => setIndeks(i)}
              aria-label={`Ke slide ${i + 1}: ${s.judul}`}
              aria-current={i === indeks ? 'true' : undefined}
              className={
                i === indeks
                  ? 'h-2 w-6 rounded-full bg-white transition-all'
                  : 'h-2 w-2 rounded-full bg-white/30 transition-all hover:bg-white/60'
              }
            />
          ))}
        </div>

        <button
          type="button"
          onClick={maju}
          disabled={indeks === total - 1}
          className="inline-flex items-center gap-1 rounded-lg border border-white/30 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-30"
        >
          Selanjutnya
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <p className="pb-3 text-center text-xs text-slate-400">
        Gunakan tombol panah ← → untuk berpindah slide, dan F untuk layar penuh.
      </p>
    </div>
  );
}
