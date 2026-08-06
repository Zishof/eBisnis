import { useQuery } from '@tanstack/react-query';
import { Clock3, Loader2, Play, X } from 'lucide-react';
import { api, formatMoney } from '../../lib/api';

export interface TransaksiPosApotik {
  pos_sale_id: string;
  transaction_mode: 'OTC' | 'PRESCRIPTION' | 'COMPOUND' | 'PRODUCTION';
  reference_number: string | null;
  formula_name: string | null;
  dosage_form: string | null;
  label_instruction: string | null;
  workflow_status: string;
  updated_at: string;
  prescription_number: string | null;
  sale_status: string;
  grand_total: string;
  currency_code: string;
  line_count: number;
}

export function PharmacyHeldDrawer({ onClose, onResume }: {
  onClose: () => void;
  onResume: (row: TransaksiPosApotik) => Promise<void>;
}) {
  const rows = useQuery({
    queryKey: ['pharmacy-pos', 'held'],
    queryFn: () => api.get<TransaksiPosApotik[]>('/health/pharmacy/pos-sales?limit=250'),
  });
  const held = (rows.data ?? []).filter((row) => row.sale_status === 'HELD');

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Transaksi apotik ditahan">
      <section className="ms-auto flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div><p className="text-xs font-bold uppercase text-emerald-700">Daftar kerja kasir</p><h2 className="mt-1 text-xl font-black">Transaksi ditahan</h2><p className="mt-1 text-sm text-slate-500">Lanjutkan resep, racikan, atau transaksi OTC tanpa kehilangan konteks farmasi.</p></div>
          <button type="button" className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </header>
        <div className="flex-1 overflow-auto p-4">
          {rows.isLoading && <div className="grid min-h-48 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div>}
          {!rows.isLoading && held.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Tidak ada transaksi yang sedang ditahan.</p>}
          <div className="space-y-3">
            {held.map((row) => (
              <article key={row.pos_sale_id} className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_auto] dark:border-slate-700">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><span className="rounded bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">{row.transaction_mode}</span><strong>{row.prescription_number ?? row.formula_name ?? row.reference_number ?? 'Penjualan OTC'}</strong></div>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{new Date(row.updated_at).toLocaleString('id-ID')} · {row.line_count} item</p>
                  <p className="mt-2 font-black tabular-nums text-emerald-800">{formatMoney(Number(row.grand_total), row.currency_code)}</p>
                </div>
                <button type="button" className="btn-primary self-center bg-[#007c75]" onClick={() => void onResume(row)}><Play className="h-4 w-4" />Lanjutkan</button>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
