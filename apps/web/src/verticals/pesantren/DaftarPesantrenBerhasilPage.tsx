/**
 * Layar sesudah pendaftaran pondok berhasil.
 *
 * ## Satu-satunya kesempatan
 *
 * Kata sandi di halaman ini **tidak tersimpan di mana pun** — tidak di basis
 * data (yang disimpan hanya hash Argon2), tidak di penyimpanan peramban, dan
 * tidak pada alamat. Ia hanya ada di memori navigasi, dan hilang begitu halaman
 * ini ditinggalkan.
 *
 * Karena itu halaman ini menyatakannya dengan jelas dan menyediakan unduhan.
 * Yang tidak dikatakan akan diketahui pengurus pondok saat ia menutup tab.
 *
 * ## Mengapa tidak langsung masuk
 *
 * Menekan tombol tidak memasukkan pengguna secara otomatis. Kata sandi yang
 * dibuat peladen wajib diganti saat masuk pertama, dan mengetiknya sekali
 * adalah cara paling sederhana memastikan ia benar-benar tercatat — bukan hanya
 * terbaca sekilas.
 */

import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink } from 'lucide-react';
import type { HasilPendaftaranPesantren } from './DaftarPesantrenPage';

export function DaftarPesantrenBerhasilPage() {
  const location = useLocation();
  const [tersalin, setTersalin] = useState<string | null>(null);

  const hasil = (location.state as { hasil?: HasilPendaftaranPesantren } | null)?.hasil;

  /*
   * Judul tab tidak diatur di sini. `SantriLayout` sudah mengaturnya, dan efek
   * induk berjalan SESUDAH efek anak — judul apa pun yang ditulis halaman ini
   * akan ditimpa induknya, lalu dipulihkan ke nilai yang keliru saat dilepas.
   */

  // Halaman ini hanya bermakna tepat sesudah pendaftaran.
  if (!hasil) return <Navigate to="/daftar-pesantren" replace />;

  const salin = async (label: string, nilai: string) => {
    try {
      await navigator.clipboard.writeText(nilai);
      setTersalin(label);
      setTimeout(() => setTersalin(null), 2000);
    } catch {
      /* Peramban menolak papan klip. Nilainya tetap terbaca di layar. */
    }
  };

  const unduh = () => {
    const baris = [
      'RINGKASAN AKUN PONDOK PESANTREN',
      '================================',
      `Nama pengguna    : ${hasil.username}`,
      hasil.temporaryPassword ? `Kata sandi awal  : ${hasil.temporaryPassword}` : '',
      `Alamat situs     : ${hasil.siteUrl}`,
      `Ruang data       : ${hasil.schemaName}`,
      '',
      'Kata sandi di atas wajib diganti saat masuk pertama kali.',
      'Simpan berkas ini di tempat yang aman dan jangan dibagikan.',
    ].filter(Boolean);

    const blob = new Blob([baris.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const tautan = document.createElement('a');
    tautan.href = url;
    tautan.download = `akun-pondok-${hasil.username}.txt`;
    tautan.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            Pondok Anda sudah terdaftar
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ruang kerja dan alamat situs pondok sudah disiapkan.
          </p>
        </div>

        {hasil.temporaryPassword && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Kata sandi ini hanya ditampilkan sekali dan tidak tersimpan di mana pun.
              Salin atau unduh sebelum menutup halaman.
            </p>
          </div>
        )}

        <dl className="mt-6 space-y-3">
          <Baris
            label="Nama pengguna"
            nilai={hasil.username}
            onSalin={() => void salin('username', hasil.username)}
            tersalin={tersalin === 'username'}
            testId="pesantren-username"
          />
          {hasil.temporaryPassword && (
            <Baris
              label="Kata sandi"
              nilai={hasil.temporaryPassword}
              onSalin={() => void salin('password', hasil.temporaryPassword!)}
              tersalin={tersalin === 'password'}
              testId="pesantren-password"
              sorot
            />
          )}
          <Baris label="Alamat situs pondok" nilai={hasil.siteHost} />
          <Baris label="Ruang data" nilai={hasil.schemaName} />
        </dl>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-white">Yang terjadi saat Anda masuk</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Masuk dengan nama pengguna dan kata sandi di atas.</li>
            <li>Ganti kata sandi — ini wajib, dan hanya diminta sekali.</li>
            <li>Masuk lagi dengan kata sandi baru Anda.</li>
            <li>Anda mendarat di beranda pondok, bukan beranda eBisnis.</li>
          </ol>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            className="flex-1 rounded-lg border border-slate-300 px-5 py-2.5 font-semibold dark:border-slate-700"
            onClick={unduh}
          >
            <Download className="mr-2 inline h-4 w-4" aria-hidden />
            Unduh ringkasan
          </button>
          <Link
            to="/masuk"
            className="flex-1 rounded-lg bg-emerald-700 px-5 py-2.5 text-center font-semibold text-white hover:bg-emerald-800"
            data-testid="masuk-sekarang"
          >
            Masuk sekarang
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Situs pondok:{' '}
          <a
            href={hasil.siteUrl}
            className="ltr-code text-emerald-700 hover:underline dark:text-emerald-400"
          >
            {hasil.siteHost}
            <ExternalLink className="ms-1 inline h-3 w-3" aria-hidden />
          </a>
        </p>
      </div>
    </div>
  );
}

function Baris({
  label,
  nilai,
  onSalin,
  tersalin,
  testId,
  sorot,
}: {
  label: string;
  nilai: string;
  onSalin?: () => void;
  tersalin?: boolean;
  testId?: string;
  sorot?: boolean;
}) {
  return (
    <div
      className={
        sorot
          ? 'flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950/40'
          : 'flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800'
      }
    >
      <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="flex items-center gap-2">
        <span
          className="ltr-code break-all text-sm font-semibold text-slate-900 dark:text-white"
          data-testid={testId}
        >
          {nilai}
        </span>
        {onSalin && (
          <button
            type="button"
            className="rounded p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-700"
            onClick={onSalin}
            aria-label={`Salin ${label}`}
          >
            {tersalin ? (
              <span className="text-xs text-emerald-600">✓</span>
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}
