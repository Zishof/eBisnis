/**
 * Presentasi ePesantren — dapat dijalankan langsung di layar rapat.
 *
 * Bentuknya mengikuti `pages/public/PresentasiPage.tsx`, yang sudah
 * menyelesaikan persoalan yang sama untuk eBisnis: panah kiri-kanan berpindah
 * slide, F membuka layar penuh, nomor slide terlihat, dan tidak ada yang perlu
 * diunduh lebih dahulu.
 *
 * Isinya dari `konten-pesantren.ts` — sumber yang sama dengan Proposal, Draft
 * PKS, dan Surat Penawaran. Empat dokumen yang menyebut fakta berbeda tentang
 * hal yang sama adalah selisih yang ditemukan pondok, bukan oleh kita.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import {
  HARGA_PER_SANTRI,
  INDIKATOR,
  KANAL,
  KECERDASAN_BUATAN,
  KESIAPAN_BERTAHAP,
  KESIAPAN_SEKARANG,
  KETENTUAN_HARGA,
  KEUNGGULAN,
  KOLABORASI_BMT,
  MASALAH,
  MITRA_BMT,
  OPEN_API,
  PENYEDIA,
  PILAR,
  SIFAT_SOLUSI,
  TAHAPAN,
} from './konten-pesantren';

interface Slide {
  judul: string;
  sub?: string;
  isi: ReactNode;
}

function Kartu({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
      <h3 className="font-semibold text-white">{judul}</h3>
      <div className="mt-1 text-sm leading-relaxed text-emerald-50">{children}</div>
    </div>
  );
}

function Kisi({ children, kolom = 3 }: { children: ReactNode; kolom?: 2 | 3 }) {
  return (
    <div className={`grid gap-4 ${kolom === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
      {children}
    </div>
  );
}

function Daftar({ butir }: { butir: readonly string[] }) {
  return (
    <ul className="grid gap-2 text-sm text-emerald-50 sm:grid-cols-2">
      {butir.map((b) => (
        <li key={b} className="flex gap-2">
          <span aria-hidden className="text-emerald-300">
            •
          </span>
          <span>{b}</span>
        </li>
      ))}
    </ul>
  );
}

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export function PresentasiPesantrenPage() {
  const [indeks, setIndeks] = useState(0);
  const [layarPenuh, setLayarPenuh] = useState(false);
  const wadah = useRef<HTMLDivElement>(null);

  const slides = useMemo<Slide[]>(() => {
    const daftar: Slide[] = [
      {
        judul: 'ePESANTREN',
        sub: 'Satu Pesantren · Satu Sistem · Satu Data',
        isi: (
          <div className="space-y-6">
            <p className="text-lg text-emerald-50">
              Ekosistem digital terpadu untuk pondok pesantren — pendidikan, kesantrian,
              kesehatan, keuangan dan BMT, unit usaha, tata kelola, serta perpustakaan.
            </p>
            <Kisi>
              {INDIKATOR.map((i) => (
                <Kartu key={i.judul} judul={i.judul}>
                  {i.isi}
                </Kartu>
              ))}
            </Kisi>
            <p className="text-sm text-emerald-200">
              Dipersembahkan oleh {PENYEDIA.nama} · {PENYEDIA.moto}
            </p>
          </div>
        ),
      },
      {
        judul: 'Tentang Kami',
        sub: `${PENYEDIA.nama} — mitra digitalisasi pesantren`,
        isi: (
          <div className="space-y-4">
            <p className="text-emerald-50">
              Perusahaan teknologi informasi dan pengembang perangkat lunak nasional, berdiri{' '}
              {PENYEDIA.berdiri} di Tangerang Selatan. Pengembang di balik ekosistem eCampus,
              eSchool, ePesantren, eMedik, dan eBisnis.
            </p>
            <p className="text-emerald-50">
              Pesantren memiliki keunikan tersendiri — perpaduan pendidikan umum, diniyah,
              tahfiz, kehidupan asrama, ekonomi syariah, dan pengabdian. Sistem ini dirancang
              untuk merangkul semuanya.
            </p>
          </div>
        ),
      },
      {
        judul: 'Tantangan Pengelolaan Pesantren Modern',
        sub: 'Enam hal yang paling sering kami temui',
        isi: (
          <Kisi>
            {MASALAH.map((m) => (
              <Kartu key={m.judul} judul={m.judul}>
                {m.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Satu Ekosistem ePesantren yang Utuh',
        sub: 'Cukup satu kali masuk, seluruh unit terhubung, setiap data dicatat sekali',
        isi: (
          <Kisi kolom={2}>
            {SIFAT_SOLUSI.map((s) => (
              <Kartu key={s.judul} judul={s.judul}>
                {s.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Peta Solusi Digital Pondok Pesantren',
        sub: 'Delapan pilar yang mencakup hampir seluruh aktivitas pesantren',
        isi: (
          <Kisi>
            {PILAR.map((p) => (
              <Kartu key={p.nomor} judul={`${p.nomor}. ${p.nama}`}>
                {p.ringkas}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
    ];

    // Satu slide per pilar, dengan butirnya.
    for (const p of PILAR) {
      daftar.push({
        judul: p.nama,
        sub: `Pilar ${p.nomor}`,
        isi: (
          <Kisi>
            {p.butir.map((b) => (
              <Kartu key={b.judul} judul={b.judul}>
                {b.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      });
    }

    daftar.push(
      {
        judul: 'Tersedia di Seluruh Kanal',
        sub: 'Termasuk anjungan mandiri yang aman bagi santri tanpa ponsel',
        isi: (
          <div className="flex flex-wrap gap-3">
            {KANAL.map((k) => (
              <span
                key={k}
                className="rounded-lg border border-white/25 bg-white/10 px-5 py-3 text-lg font-semibold text-white"
              >
                {k}
              </span>
            ))}
          </div>
        ),
      },
      {
        judul: 'Kecerdasan Buatan untuk Pesantren',
        sub: 'Meringankan pekerjaan asatidz, dengan hasil yang tetap ditinjau manusia',
        isi: (
          <Kisi kolom={2}>
            {KECERDASAN_BUATAN.map((a) => (
              <Kartu key={a.judul} judul={a.judul}>
                {a.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Open API & Interoperabilitas Data',
        sub: 'Terbuka bagi bank, lembaga keuangan syariah, fintech, pemerintah, dan e-commerce',
        isi: (
          <Kisi>
            {OPEN_API.map((o) => (
              <Kartu key={o.judul} judul={o.judul}>
                {o.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Kemitraan Strategis',
        sub: MITRA_BMT.nama,
        isi: (
          <div className="space-y-4">
            <p className="text-emerald-50">
              Koperasi simpan pinjam dan pembiayaan syariah yang lahir di lingkungan{' '}
              {MITRA_BMT.asal} — mengusung semangat &ldquo;{MITRA_BMT.semboyan}&rdquo;.
            </p>
            <div className="grid gap-5 sm:grid-cols-3">
              <div>
                <h3 className="font-semibold text-white">Profil</h3>
                <Daftar butir={MITRA_BMT.profil} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Produk Syariah</h3>
                <Daftar butir={MITRA_BMT.produk} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Unit Usaha Riil</h3>
                <Daftar butir={MITRA_BMT.unitUsaha} />
              </div>
            </div>
          </div>
        ),
      },
      {
        judul: 'Yang Dapat Dikerjasamakan',
        sub: 'Memadukan teknologi dan layanan keuangan syariah',
        isi: (
          <Kisi>
            {KOLABORASI_BMT.map((k) => (
              <Kartu key={k.judul} judul={k.judul}>
                {k.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Keunggulan Solusi Kami',
        isi: (
          <Kisi>
            {KEUNGGULAN.map((k) => (
              <Kartu key={k.judul} judul={k.judul}>
                {k.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        judul: 'Implementasi Bertahap & Terukur',
        sub: 'Dimulai dari unit prioritas, lalu diperluas ke seluruh lingkungan pondok',
        isi: (
          <Kisi>
            {TAHAPAN.map((t) => (
              <Kartu key={t.nomor} judul={`${t.nomor}. ${t.nama}`}>
                {t.isi}
              </Kartu>
            ))}
          </Kisi>
        ),
      },
      {
        /*
         * Slide ini tidak ada pada paparan aslinya, dan sengaja ditambahkan.
         *
         * Paparan menggambarkan tujuan akhir. Presentasi yang tidak membedakannya
         * dari keadaan hari ini menjanjikan hal yang ditemukan pondok pada minggu
         * pertama — bukan saat menandatangani.
         */
        judul: 'Yang Siap Hari Ini, dan Yang Bertahap',
        sub: 'Disampaikan di depan, bukan ditemukan belakangan',
        isi: (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-white">Siap dipakai sejak awal</h3>
              <Daftar butir={KESIAPAN_SEKARANG} />
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">Diserahkan bertahap</h3>
              <Daftar butir={KESIAPAN_BERTAHAP} />
            </div>
          </div>
        ),
      },
      {
        judul: 'Biaya',
        sub: `${rupiah(HARGA_PER_SANTRI)} per santri aktif per bulan`,
        isi: (
          <div className="space-y-5">
            <p className="text-4xl font-bold text-white">
              {rupiah(HARGA_PER_SANTRI)}
              <span className="ms-2 text-lg font-normal text-emerald-200">
                / santri / bulan
              </span>
            </p>
            <Daftar butir={KETENTUAN_HARGA} />
          </div>
        ),
      },
      {
        judul: 'Mari Digitalkan Pesantren Anda',
        sub: PENYEDIA.moto,
        isi: (
          <div className="space-y-4">
            <p className="text-lg text-emerald-50">
              {PENYEDIA.nama} siap mendampingi pondok pesantren Anda mewujudkan tata kelola
              yang modern, terpadu, dan amanah — dari perencanaan hingga operasional
              berkelanjutan.
            </p>
            <p className="text-emerald-100">
              {PENYEDIA.alamat}
              <br />
              {PENYEDIA.surel} · {PENYEDIA.telepon} · Faks. {PENYEDIA.faks}
            </p>
          </div>
        ),
      },
    );

    return daftar;
  }, []);

  const jumlah = slides.length;
  const maju = useCallback(() => setIndeks((i) => Math.min(i + 1, jumlah - 1)), [jumlah]);
  const mundur = useCallback(() => setIndeks((i) => Math.max(i - 1, 0)), []);

  const ganti = useCallback(() => {
    if (!document.fullscreenElement) {
      void wadah.current?.requestFullscreen?.();
    } else {
      void document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const pada = () => setLayarPenuh(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', pada);
    return () => document.removeEventListener('fullscreenchange', pada);
  }, []);

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = 'Presentasi ePesantren — santri.info';
    return () => {
      document.title = sebelumnya;
    };
  }, []);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      // Tidak mengambil alih tombol saat pengguna sedang mengetik di suatu kolom.
      const aktif = document.activeElement?.tagName;
      if (aktif === 'INPUT' || aktif === 'TEXTAREA') return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault();
        maju();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        mundur();
      } else if (e.key.toLowerCase() === 'f') {
        ganti();
      } else if (e.key === 'Home') {
        setIndeks(0);
      } else if (e.key === 'End') {
        setIndeks(jumlah - 1);
      }
    };
    window.addEventListener('keydown', tekan);
    return () => window.removeEventListener('keydown', tekan);
  }, [maju, mundur, ganti, jumlah]);

  const slide = slides[indeks];

  return (
    <div ref={wadah} className="flex min-h-screen flex-col bg-emerald-950 text-white">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/santri"
          className="inline-flex items-center gap-1.5 text-sm text-emerald-200 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-emerald-300" data-testid="nomor-slide">
            {indeks + 1} / {jumlah}
          </span>
          <button
            type="button"
            className="rounded-lg border border-white/25 p-2 hover:bg-white/10"
            onClick={ganti}
            aria-label={layarPenuh ? 'Keluar layar penuh' : 'Layar penuh'}
          >
            {layarPenuh ? (
              <Minimize2 className="h-4 w-4" aria-hidden />
            ) : (
              <Maximize2 className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-6">
        <h1 className="text-2xl font-bold leading-tight sm:text-4xl">{slide.judul}</h1>
        {slide.sub && <p className="mt-2 text-emerald-200 sm:text-lg">{slide.sub}</p>}
        <div className="mt-8">{slide.isi}</div>
      </main>

      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-4 py-2 disabled:opacity-30"
          onClick={mundur}
          disabled={indeks === 0}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          Sebelumnya
        </button>
        <p className="hidden text-xs text-emerald-300 sm:block">
          Panah kiri/kanan berpindah slide · F layar penuh
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:opacity-30"
          onClick={maju}
          disabled={indeks === jumlah - 1}
        >
          Berikutnya
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
