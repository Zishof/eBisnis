/**
 * Simpanan anggota.
 *
 * Satu hal yang sengaja ditampilkan: simpanan pokok dan wajib diberi tanda
 * bahwa keduanya TIDAK dapat ditarik selama keanggotaan berjalan. Anggota yang
 * mengira seluruh simpanannya dapat diambil sewaktu-waktu akan kecewa pada saat
 * yang paling tidak tepat — dan koperasi yang tidak menjelaskannya lebih dahulu
 * ikut menanggung kekecewaan itu.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Lock } from 'lucide-react';
import { portalApi } from './portal-api';
import { LABEL_JENIS_SIMPANAN, formatRupiah, formatTanggal } from './portal-menu';

function Mutasi({ rekeningId }: { rekeningId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'savings', rekeningId, 'tx'],
    queryFn: () => portalApi.mutasi(rekeningId),
    retry: false,
  });

  if (isLoading) return <p className="p-4 text-sm text-slate-500">Memuat mutasi…</p>;
  if (!data || data.length === 0) {
    return <p className="p-4 text-sm text-slate-500">Belum ada mutasi pada rekening ini.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Tanggal</th>
            <th className="px-4 py-2">Keterangan</th>
            <th className="px-4 py-2 text-right">Jumlah</th>
            <th className="px-4 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.map((m) => (
            <tr key={m.id}>
              <td className="whitespace-nowrap px-4 py-2">{formatTanggal(m.transaction_date)}</td>
              <td className="px-4 py-2">{m.description ?? m.transaction_type}</td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">
                {formatRupiah(m.amount)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-slate-500">
                {formatRupiah(m.balance_after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PortalSimpanan() {
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'savings'],
    queryFn: portalApi.simpanan,
    retry: false,
  });

  if (isLoading) return <p className="text-sm text-slate-500">Memuat simpanan…</p>;

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        Anda belum memiliki rekening simpanan. Hubungi pengurus koperasi untuk membukanya.
      </div>
    );
  }

  const total = data.reduce((s, r) => s + Number(r.balance ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-xs uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Total Simpanan
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
          {formatRupiah(total)}
        </p>
      </div>

      <ul className="space-y-3">
        {data.map((r) => (
          <li
            key={r.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setTerbuka(terbuka === r.id ? null : r.id)}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-medium">
                  {LABEL_JENIS_SIMPANAN[r.saving_type] ?? r.product_name}
                  {!r.is_withdrawable && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      title="Tidak dapat ditarik selama keanggotaan berjalan"
                    >
                      <Lock className="h-3 w-3" aria-hidden />
                      tidak dapat ditarik
                    </span>
                  )}
                </p>
                {/* Nomor rekening sengaja disamarkan sebagian, sama seperti pada
                    aplikasi perbankan. Layar portal sering terlihat orang lain. */}
                <p className="mt-0.5 text-xs text-slate-500">
                  {r.account_number ?? '—'} · dibuka {formatTanggal(r.opened_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold tabular-nums">{formatRupiah(r.balance)}</p>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition ${
                  terbuka === r.id ? 'rotate-180' : ''
                }`}
                aria-hidden
              />
            </button>
            {terbuka === r.id && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                <Mutasi rekeningId={r.id} />
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-slate-500">
        Simpanan pokok dan simpanan wajib merupakan modal keanggotaan Anda dan tidak dapat ditarik
        selama Anda masih menjadi anggota. Keduanya diperhitungkan dalam pembagian SHU.
      </p>
    </div>
  );
}
