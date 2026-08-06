import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, PackageCheck, X } from 'lucide-react';
import { api } from '../../lib/api';
import type { ProdukPos } from './pos-types';

export interface LotPosApotik {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  qualityStatus: string;
  availableQty: string;
  locationName: string | null;
  eligible: boolean;
  recommended: boolean;
}

export function PharmacyLotDialog({ saleId, product, onClose, onSelect }: {
  saleId: string;
  product: ProdukPos;
  onClose: () => void;
  onSelect: (lotId: string | null) => void;
}) {
  const lots = useQuery({
    queryKey: ['pharmacy-pos', 'lots', saleId, product.productId],
    queryFn: () => api.get<LotPosApotik[]>(`/health/pharmacy/pos-sales/${saleId}/products/${product.productId}/lots`),
  });
  const recommended = useMemo(() => lots.data?.find((lot) => lot.recommended)?.id ?? null, [lots.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const active = selected ?? recommended;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={`Pilih batch ${product.name}`}>
      <div className="w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-2xl dark:bg-slate-900">
        <header className="flex items-start justify-between border-b border-slate-200 p-5 dark:border-slate-800">
          <div>
            <p className="text-xs font-bold uppercase text-emerald-700">Pilih batch dan FEFO</p>
            <h2 className="mt-1 text-xl font-black">{product.name}</h2>
            <p className="mt-1 text-sm text-slate-500">Batch layak dengan tanggal kedaluwarsa terdekat direkomendasikan lebih dahulu.</p>
          </div>
          <button type="button" className="rounded p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5" /></button>
        </header>

        <div className="max-h-[60vh] overflow-auto p-5">
          {lots.isLoading && <div className="grid min-h-40 place-items-center"><Loader2 className="h-7 w-7 animate-spin text-emerald-700" /></div>}
          {lots.isError && <p className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">Daftar batch tidak dapat dibaca. Produk belum ditambahkan agar stok tidak keluar dari batch yang salah.</p>}
          {lots.data?.length === 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" />Belum ada saldo per batch</p>
              <p className="mt-1 text-sm">Produk dapat memakai saldo umum, tetapi nomor batch tidak akan tercatat pada transaksi ini.</p>
            </div>
          )}
          {Boolean(lots.data?.length) && (
            <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[42rem] text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
                  <tr><th className="p-3">Pilih</th><th className="p-3">Batch</th><th className="p-3">Kedaluwarsa</th><th className="p-3">Lokasi</th><th className="p-3 text-right">Tersedia</th><th className="p-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lots.data?.map((lot) => (
                    <tr key={lot.id} className={active === lot.id ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}>
                      <td className="p-3"><input type="radio" name="lot" checked={active === lot.id} disabled={!lot.eligible} onChange={() => setSelected(lot.id)} aria-label={`Pilih batch ${lot.lotNumber}`} /></td>
                      <td className="p-3 font-bold">{lot.lotNumber}{lot.recommended && <span className="ms-2 rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800">FEFO</span>}</td>
                      <td className="p-3 tabular-nums">{lot.expiryDate ?? 'Tidak dibatasi'}</td>
                      <td className="p-3">{lot.locationName ?? 'Rak utama'}</td>
                      <td className="p-3 text-right tabular-nums">{Number(lot.availableQty)}</td>
                      <td className="p-3">{lot.eligible ? <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-4 w-4" />Layak</span> : <span className="inline-flex items-center gap-1 text-rose-700"><AlertTriangle className="h-4 w-4" />{lot.qualityStatus}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <footer className="flex justify-between gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <button type="button" className="btn-outline" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary bg-[#007c75]" disabled={lots.isLoading || lots.isError || (Boolean(lots.data?.length) && !active)} onClick={() => onSelect(lots.data?.length ? active : null)}>
            <PackageCheck className="h-4 w-4" />Gunakan batch
          </button>
        </footer>
      </div>
    </div>
  );
}
