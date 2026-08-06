/**
 * Layar sesudah pendaftaran properti berhasil. Pola sama persis dengan
 * `DaftarPesantrenBerhasilPage.tsx` -- lihat komentar di sana untuk alasan
 * lengkap (satu-satunya kesempatan melihat kata sandi, mengapa tidak
 * langsung masuk).
 */

import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Copy, Download, ExternalLink } from 'lucide-react';
import type { HasilPendaftaranHospitality } from './MitrainapDaftarPage';

export function MitrainapDaftarBerhasilPage() {
  const location = useLocation();
  const [tersalin, setTersalin] = useState<string | null>(null);

  const hasil = (location.state as { hasil?: HasilPendaftaranHospitality } | null)?.hasil;

  if (!hasil) return <Navigate to="/mitrainap/daftar" replace />;

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
      'RINGKASAN AKUN PROPERTI MITRAINAP.ID',
      '=====================================',
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
    tautan.download = `akun-properti-${hasil.username}.txt`;
    tautan.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            Properti Anda sudah terdaftar
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Ruang kerja dan alamat situs properti sudah disiapkan.
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
            testId="hospitality-username"
          />
          {hasil.temporaryPassword && (
            <Baris
              label="Kata sandi"
              nilai={hasil.temporaryPassword}
              onSalin={() => void salin('password', hasil.temporaryPassword!)}
              tersalin={tersalin === 'password'}
              testId="hospitality-password"
              sorot
            />
          )}
          <Baris label="Alamat situs properti" nilai={hasil.siteHost} />
          <Baris label="Ruang data" nilai={hasil.schemaName} />
        </dl>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <p className="font-medium text-slate-900 dark:text-white">Yang terjadi saat Anda masuk</p>
          <ol className="mt-2 list-inside list-decimal space-y-1">
            <li>Masuk dengan nama pengguna dan kata sandi di atas.</li>
            <li>Ganti kata sandi -- ini wajib, dan hanya diminta sekali.</li>
            <li>Masuk lagi dengan kata sandi baru Anda.</li>
            <li>Tambahkan properti, tipe kamar, dan kamar lewat menu Hospitality.</li>
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
            to="/mitrainap/masuk"
            className="flex-1 rounded-lg bg-indigo-600 px-5 py-2.5 text-center font-semibold text-white hover:bg-indigo-700"
            data-testid="masuk-sekarang"
          >
            Masuk sekarang
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Situs properti:{' '}
          <a href={hasil.siteUrl} className="ltr-code text-indigo-700 hover:underline dark:text-indigo-400">
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
        <span className="ltr-code break-all text-sm font-semibold text-slate-900 dark:text-white" data-testid={testId}>
          {nilai}
        </span>
        {onSalin && (
          <button
            type="button"
            className="rounded p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-700"
            onClick={onSalin}
            aria-label={`Salin ${label}`}
          >
            {tersalin ? <span className="text-xs text-emerald-600">✓</span> : <Copy className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </dd>
    </div>
  );
}
