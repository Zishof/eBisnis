/**
 * Laporan operasional kasir.
 *
 * Satu halaman untuk seluruh laporan alih-alih lima belas halaman, karena yang
 * berbeda di antaranya hanyalah kolomnya — dan lima belas halaman berarti lima
 * belas tempat yang harus diingat ketika penyaringan tanggalnya berubah.
 *
 * Dua hal yang ditampilkan dengan sengaja meski tidak diminta:
 *
 * - **Ketika angka biaya disembunyikan, halaman mengatakannya.** Pembaca yang
 *   tidak melihat kolom margin perlu tahu bahwa itu karena haknya, bukan karena
 *   usahanya tidak untung.
 * - **Ketika laporan disaring ke dirinya sendiri, halaman mengatakannya.**
 *   Kasir yang melihat angka kecil perlu tahu itu angkanya sendiri, bukan angka
 *   seluruh toko.
 */

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BarChart3, Eye, EyeOff, RefreshCw, UserRound } from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { DataGrid, PageHeader, type GridColumn } from '../../components/ui';

interface DefinisiLaporan {
  code: string;
  name: string;
}

interface HasilLaporan {
  code: string;
  name: string;
  range: { from: string; to: string; days: number };
  rowCount: number;
  rows: Array<Record<string, unknown>>;
  costHidden: boolean;
  scopedToSelf: boolean;
}

/** Kolom yang ditampilkan sebagai uang. */
const KOLOM_UANG = new Set([
  'grossSales',
  'netSales',
  'revenue',
  'cost',
  'margin',
  'discountValue',
  'taxValue',
  'taxAmount',
  'taxableBase',
  'amount',
  'returnValue',
  'refundAmount',
  'voidValue',
  'cashVariance',
  'openingCash',
  'expectedCash',
  'countedCash',
]);

function judulKolom(kunci: string): string {
  // Nama kolom datang dari peladen dalam camelCase; diubah menjadi kata yang
  // terbaca alih-alih dipetakan satu per satu — lima belas laporan berarti
  // ratusan kolom, dan peta sebesar itu akan tertinggal lebih dahulu daripada
  // dipakai.
  const kata = kunci.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return kata.trim();
}

export function PosReportPage() {
  const { t } = useTranslation();
  const pesanGalat = useErrorMessage();

  const hariIni = new Date().toISOString().slice(0, 10);
  const tujuhHari = new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10);

  const [kode, setKode] = useState('SALES_SUMMARY');
  const [dari, setDari] = useState(tujuhHari);
  const [sampai, setSampai] = useState(hariIni);

  const daftar = useQuery({
    queryKey: ['pos', 'reports'],
    queryFn: () => api.get<DefinisiLaporan[]>('/pos/reports'),
  });

  const hasil = useQuery({
    queryKey: ['pos', 'report', kode, dari, sampai],
    queryFn: () =>
      api.get<HasilLaporan>(`/pos/reports/${kode}?from=${dari}&to=${sampai}&limit=500`),
  });

  const kolom = useMemo<Array<GridColumn<Record<string, unknown>>>>(() => {
    const baris = hasil.data?.rows ?? [];
    if (!baris.length) return [];
    return Object.keys(baris[0]).map((k) => ({
      key: k,
      header: judulKolom(k),
      className: KOLOM_UANG.has(k) ? 'text-end tabular-nums' : undefined,
      render: (r: Record<string, unknown>) => {
        const v = r[k];
        if (v === null || v === undefined) return '—';
        if (KOLOM_UANG.has(k)) return formatMoney(Number(v), 'IDR');
        if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
        return String(v);
      },
    }));
  }, [hasil.data]);

  return (
    <>
      <PageHeader
        title="Laporan Kasir"
        description="Rentang tanggal memakai tanggal usaha, bukan jam dinding — shift yang melewati tengah malam tetap terhitung pada satu hari."
        breadcrumbs={[
          { label: t('app.dashboard'), href: '/app' },
          { label: 'Kasir', href: '/app/pos' },
          { label: 'Laporan' },
        ]}
        actions={
          <button
            type="button"
            className="btn-outline"
            onClick={() => void hasil.refetch()}
            disabled={hasil.isFetching}
          >
            <RefreshCw className={hasil.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            Muat ulang
          </button>
        }
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <label className="field-label" htmlFor="laporan">
            Laporan
          </label>
          <select
            id="laporan"
            className="field-input"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
          >
            {(daftar.data ?? []).map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="dari">
            Dari
          </label>
          <input
            id="dari"
            type="date"
            className="field-input"
            value={dari}
            max={sampai}
            onChange={(e) => setDari(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="sampai">
            Sampai
          </label>
          <input
            id="sampai"
            type="date"
            className="field-input"
            value={sampai}
            min={dari}
            onChange={(e) => setSampai(e.target.value)}
          />
        </div>
      </div>

      {/*
        Keterangan tentang apa yang TIDAK terlihat. Pembaca yang tidak diberitahu
        akan menyimpulkan yang salah dari kolom yang hilang.
      */}
      {(hasil.data?.costHidden || hasil.data?.scopedToSelf) && (
        <div className="mb-4 space-y-2">
          {hasil.data?.costHidden && (
            <p className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Angka harga pokok dan margin disembunyikan karena hak akses Anda. Angka penjualan yang
              tampil tetap lengkap.
            </p>
          )}
          {hasil.data?.scopedToSelf && (
            <p className="flex items-start gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800/50">
              <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Laporan ini hanya memuat transaksi Anda sendiri, bukan seluruh toko.
            </p>
          )}
        </div>
      )}

      {hasil.data && (
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <BarChart3 className="h-4 w-4" aria-hidden />
          <strong>{hasil.data.name}</strong> · {hasil.data.range.from} sampai {hasil.data.range.to} (
          {hasil.data.range.days} hari) · {hasil.data.rowCount} baris
        </p>
      )}

      <DataGrid
        columns={kolom}
        rows={hasil.data?.rows ?? []}
        loading={hasil.isLoading}
        error={hasil.isError ? pesanGalat(hasil.error, (k, f) => t(k, f ?? k)) : undefined}
        // Baris laporan adalah hasil agregasi dan tidak punya id. Kuncinya
        // dirakit dari isinya — dua baris berisi persis sama tidak akan pernah
        // muncul karena setiap laporan mengelompokkan pada kolom yang berbeda.
        rowKey={(r) => JSON.stringify(r)}
        onRetry={() => void hasil.refetch()}
      />

      {hasil.data && hasil.data.rowCount === 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-8 text-sm text-slate-500 dark:border-slate-700">
          <Eye className="h-4 w-4" aria-hidden />
          Tidak ada transaksi pada rentang ini.
        </p>
      )}
    </>
  );
}
