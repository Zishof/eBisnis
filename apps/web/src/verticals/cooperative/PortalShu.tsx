/**
 * SHU anggota.
 *
 * Rinciannya ditampilkan terbelah menjadi jasa modal dan jasa usaha, bukan
 * hanya totalnya. Itu bukan hiasan: pembelahan itulah yang membedakan koperasi
 * dari perseroan — sebagian SHU dibagi menurut besar simpanan, sebagian lagi
 * menurut seberapa banyak anggota BERTRANSAKSI dengan koperasinya. Anggota
 * yang melihat keduanya dapat mengerti mengapa angkanya berbeda dari tetangganya
 * tanpa harus curiga.
 */

import { useQuery } from '@tanstack/react-query';
import { portalApi } from './portal-api';
import { formatRupiah } from './portal-menu';

const LABEL_STATUS: Record<string, string> = {
  DRAFT: 'Perhitungan sementara',
  APPROVED: 'Disahkan RAT',
  DISTRIBUTED: 'Sudah dibagikan',
  PAID: 'Sudah dibayarkan',
};

export function PortalShu() {
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'shu'],
    queryFn: portalApi.shu,
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat SHU…</p>;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Belum ada SHU yang dialokasikan untuk Anda. SHU dihitung setelah tahun buku ditutup dan
        disahkan dalam Rapat Anggota Tahunan.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((a) => (
        <div
          key={a.id}
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Tahun Buku {a.fiscal_year}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {LABEL_STATUS[a.status] ?? a.status}
            </span>
          </div>

          <p className="mt-3 text-3xl font-semibold tabular-nums text-sky-600">
            {formatRupiah(a.net_amount)}
          </p>
          <p className="text-xs text-slate-500">yang menjadi hak Anda</p>

          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600 dark:text-slate-400">
                Jasa modal
                <span className="block text-xs text-slate-500">menurut besar simpanan Anda</span>
              </dt>
              <dd className="tabular-nums">{formatRupiah(a.capital_service_amount)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600 dark:text-slate-400">
                Jasa usaha
                <span className="block text-xs text-slate-500">
                  menurut transaksi Anda dengan koperasi
                </span>
              </dt>
              <dd className="tabular-nums">{formatRupiah(a.patronage_service_amount)}</dd>
            </div>
            <div className="flex justify-between gap-4 border-t border-slate-100 pt-2 dark:border-slate-800">
              <dt className="text-slate-600 dark:text-slate-400">Jumlah kotor</dt>
              <dd className="tabular-nums">{formatRupiah(a.gross_amount)}</dd>
            </div>
            {Number(a.deduction_amount) > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-600 dark:text-slate-400">
                  Pemotongan
                  <span className="block text-xs text-slate-500">
                    misalnya tunggakan angsuran — hubungi pengurus untuk rinciannya
                  </span>
                </dt>
                <dd className="tabular-nums text-rose-600">
                  −{formatRupiah(a.deduction_amount)}
                </dd>
              </div>
            )}
          </dl>
        </div>
      ))}

      <p className="text-xs text-slate-500">
        SHU dibagi menurut dua hal sekaligus: besar simpanan Anda (jasa modal) dan seberapa banyak
        Anda bertransaksi dengan koperasi (jasa usaha). Itulah sebabnya anggota dengan simpanan
        sama dapat menerima SHU berbeda.
      </p>
    </div>
  );
}
