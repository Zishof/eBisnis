/**
 * Pinjaman anggota dan jadwal angsurannya.
 *
 * Jadwal ditampilkan lengkap dengan pemisahan pokok dan jasa pada setiap
 * baris. Anggota yang hanya melihat angka total tidak dapat memeriksa apakah
 * yang ditagihkan kepadanya sesuai akad — dan hak memeriksa itu adalah bagian
 * dari menjadi anggota, bukan pelanggan.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { portalApi } from './portal-api';
import { formatRupiah, formatTanggal } from './portal-menu';

const LABEL_STATUS: Record<string, string> = {
  ACTIVE: 'Berjalan',
  OVERDUE: 'Menunggak',
  PAID_OFF: 'Lunas',
  WRITTEN_OFF: 'Dihapusbukukan',
  RESTRUCTURED: 'Direstrukturisasi',
};

const LABEL_ANGSURAN: Record<string, string> = {
  PENDING: 'Belum jatuh tempo',
  DUE: 'Jatuh tempo',
  PARTIAL: 'Dibayar sebagian',
  PAID: 'Lunas',
  OVERDUE: 'Menunggak',
};

function Jadwal({ pinjamanId }: { pinjamanId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'loans', pinjamanId, 'schedule'],
    queryFn: () => portalApi.jadwal(pinjamanId),
    retry: false,
  });

  if (isLoading) return <p className="p-4 text-sm text-slate-500">Memuat jadwal…</p>;
  if (!data || data.length === 0) {
    return <p className="p-4 text-sm text-slate-500">Jadwal angsuran belum tersusun.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Ke-</th>
            <th className="px-4 py-2">Jatuh tempo</th>
            <th className="px-4 py-2 text-right">Pokok</th>
            <th className="px-4 py-2 text-right">Jasa</th>
            <th className="px-4 py-2 text-right">Total</th>
            <th className="px-4 py-2 text-right">Dibayar</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((b) => (
            <tr
              key={b.installment_no}
              className={b.status === 'OVERDUE' ? 'bg-rose-50 dark:bg-rose-950/30' : undefined}
            >
              <td className="px-4 py-2 tabular-nums">{b.installment_no}</td>
              <td className="whitespace-nowrap px-4 py-2">{formatTanggal(b.due_date)}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                {formatRupiah(b.principal_amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                {formatRupiah(b.interest_amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums">
                {formatRupiah(b.total_amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-500">
                {formatRupiah(b.paid_amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-xs">
                {LABEL_ANGSURAN[b.status] ?? b.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalPinjaman() {
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'loans'],
    queryFn: portalApi.pinjaman,
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat pinjaman…</p>;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Anda tidak memiliki pinjaman. Hubungi pengurus koperasi bila hendak mengajukan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((p) => (
        <div
          key={p.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
        >
          <button
            type="button"
            onClick={() => setTerbuka(terbuka === p.id ? null : p.id)}
            className="w-full p-4 text-left"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{p.product_name}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.loan_number} · {p.tenor_months} bulan · cair{' '}
                  {formatTanggal(p.disbursed_at)}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  p.status === 'OVERDUE'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {LABEL_STATUS[p.status] ?? p.status}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Pokok pinjaman</dt>
                <dd className="tabular-nums">{formatRupiah(p.principal_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Sisa pokok</dt>
                <dd className="font-semibold tabular-nums">
                  {formatRupiah(p.outstanding_principal)}
                </dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
              {terbuka === p.id ? 'Sembunyikan jadwal angsuran' : 'Lihat jadwal angsuran'}
            </p>
          </button>
          {terbuka === p.id && (
            <div className="border-t border-slate-100 dark:border-slate-800">
              <Jadwal pinjamanId={p.id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
