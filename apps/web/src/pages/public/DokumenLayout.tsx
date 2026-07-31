/**
 * Kerangka bersama untuk Proposal, Draft PKS, dan Surat Penawaran.
 *
 * Ketiganya adalah dokumen yang akan dicetak atau disimpan sebagai PDF, jadi
 * yang diutamakan bukan tampilan layarnya melainkan hasil cetaknya: navigasi,
 * tombol, dan latar berwarna hilang saat dicetak; isi dokumen tersisa sendirian
 * di atas kertas putih.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';

export function DokumenLayout({
  kategori,
  judul,
  ringkas,
  meta,
  children,
}: {
  kategori: string;
  judul: string;
  ringkas: string;
  meta?: Array<{ label: string; nilai: string }>;
  children: ReactNode;
}) {
  useEffect(() => {
    const sebelumnya = document.title;
    document.title = `${judul} — eBisnis.id`;
    return () => {
      document.title = sebelumnya;
    };
  }, [judul]);

  return (
    <div className="bg-slate-100 py-8 dark:bg-slate-950 print:bg-white print:py-0">
      <div className="container-page">
        {/* Batang alat — tidak ikut tercetak. */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-brand-700 dark:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Kembali ke beranda
          </Link>
          <button type="button" className="btn-primary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            Cetak / Simpan PDF
          </button>
        </div>

        <article className="mx-auto max-w-4xl rounded-xl bg-white p-6 shadow-sm sm:p-10 dark:bg-slate-900 print:max-w-none print:rounded-none print:bg-white print:p-0 print:shadow-none dark:print:bg-white">
          <header className="border-b-2 border-brand-600 pb-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-400 print:text-brand-700">
              {kategori}
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-snug text-slate-900 sm:text-3xl dark:text-white print:text-black">
              {judul}
            </h1>
            <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300 print:text-black">
              {ringkas}
            </p>
            {meta && meta.length > 0 && (
              <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                {meta.map((m) => (
                  <div
                    key={m.label}
                    className="rounded-lg border border-slate-200 p-3 dark:border-slate-700 print:border-slate-400"
                  >
                    <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 print:text-black">
                      {m.label}
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-900 dark:text-white print:text-black">
                      {m.nilai}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className="dokumen-isi mt-6">{children}</div>

          <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400 print:text-black">
            Dokumen ini bersifat konfidensial dan ditujukan untuk kebutuhan evaluasi kerja sama.
            Informasi di dalamnya tidak untuk disebarluaskan tanpa persetujuan pihak terkait.
            © {new Date().getFullYear()} eBisnis.id.
          </footer>
        </article>
      </div>
    </div>
  );
}

export function Bab({ nomor, judul, children }: { nomor: string; judul: string; children: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid first:mt-0">
      <h2 className="border-s-4 border-brand-600 ps-3 text-lg font-bold text-slate-900 dark:text-white print:text-black">
        <span className="text-brand-700 dark:text-brand-400 print:text-brand-700">{nomor}</span> {judul}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-slate-700 dark:text-slate-200 print:text-black">
        {children}
      </div>
    </section>
  );
}

export function Daftar({ butir }: { butir: Array<string | ReactNode> }) {
  return (
    <ul className="ms-5 list-disc space-y-1.5">
      {butir.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

export function Isian({ label, lebar = 'w-56' }: { label: string; lebar?: string }) {
  const [nilai, setNilai] = useState('');
  return (
    <span className="inline-flex items-baseline gap-1">
      <input
        type="text"
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        aria-label={label}
        placeholder={label}
        className={`${lebar} border-b border-dashed border-slate-400 bg-transparent px-1 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none dark:text-white print:text-black`}
      />
    </span>
  );
}
