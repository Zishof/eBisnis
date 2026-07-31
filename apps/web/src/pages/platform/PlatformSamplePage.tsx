/**
 * Kendali produk contoh marketplace.
 *
 * Produk contoh ada agar katalog dapat dicoba sebelum ada penjual sungguhan.
 * Begitu penjual asli mulai berjualan, contoh harus dapat disingkirkan dengan
 * satu tindakan — bukan dihapus satu per satu, dan bukan pula dibiarkan
 * bercampur dengan barang yang benar-benar dijual.
 *
 * "Sembunyikan" berarti menarik dari publikasi. Datanya tetap ada, sehingga
 * dapat ditampilkan lagi kapan saja tanpa menanam ulang.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Eye, EyeOff, Loader2, PackagePlus } from 'lucide-react';
import { api } from '../../lib/api';
import { ErrorState, LoadingState, useToast } from '../../components/ui';

interface SampleRow {
  listingId: string;
  code: string;
  title: string;
  status: string;
  categoryName: string | null;
  price: string | null;
  visible: boolean;
}

interface ActionResult {
  affected: number;
  skipped: number;
  reasons: string[];
}

interface SeedResult {
  listingsCreated: number;
  published: number;
  skipped: number;
  projected: number;
}

const formatPrice = (value: string | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(Number(value));

export function PlatformSamplePage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const samples = useQuery({
    queryKey: ['platform', 'sample'],
    queryFn: () => api.get<SampleRow[]>('/platform/catalog/sample'),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['platform', 'sample'] });

  const seed = useMutation({
    mutationFn: () => api.post<SeedResult>('/platform/catalog/sample/seed', {}),
    onSuccess: (result) => {
      toast.push(
        `${result.listingsCreated} produk dibuat, ${result.published} terbit, ` +
          `${result.projected} masuk katalog publik.`,
        'success',
      );
      void refresh();
    },
    onError: () => toast.push('Penanaman produk contoh gagal.', 'error'),
  });

  const bulk = useMutation({
    mutationFn: (action: 'hide' | 'show') =>
      api.post<ActionResult>(`/platform/catalog/sample/${action}`, {}),
    onSuccess: (result, action) => {
      const verb = action === 'hide' ? 'disembunyikan' : 'ditampilkan';
      toast.push(
        `${result.affected} produk ${verb}` +
          (result.skipped ? `, ${result.skipped} dilewati.` : '.'),
        'success',
      );
      // Alasan penolakan gerbang ditampilkan terpisah. Tanpa ini, "12 dilewati"
      // tidak memberi tahu apa pun tentang apa yang perlu diperbaiki.
      for (const reason of result.reasons.slice(0, 3)) toast.push(reason, 'error');
      void refresh();
    },
    onError: () => toast.push('Tindakan gagal dijalankan.', 'error'),
  });

  const toggle = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      api.post<SampleRow>(`/platform/catalog/sample/${id}/visibility`, { visible }),
    onMutate: ({ id }) => setBusyId(id),
    onSettled: () => setBusyId(null),
    onSuccess: (row) => {
      toast.push(
        `${row?.title ?? 'Produk'} ${row?.visible ? 'ditampilkan' : 'disembunyikan'}.`,
        'success',
      );
      void refresh();
    },
    onError: () => toast.push('Perubahan gagal disimpan.', 'error'),
  });

  if (samples.isLoading) return <LoadingState label="Memuat produk contoh" />;
  if (samples.isError) {
    return (
      <ErrorState message="Produk contoh belum dapat dimuat." onRetry={() => void samples.refetch()} />
    );
  }

  const rows = samples.data ?? [];
  const visibleCount = rows.filter((r) => r.visible).length;
  const busy = bulk.isPending || seed.isPending;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Produk contoh marketplace
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Produk ini ada agar katalog <code>belanja.ebisnis.id</code> dapat dicoba sebelum ada
          penjual sungguhan. Menyembunyikannya menarik produk dari katalog publik tanpa
          menghapus datanya, sehingga dapat ditampilkan kembali kapan saja.
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
          <p className="font-medium text-slate-900 dark:text-slate-100">
            Belum ada produk contoh.
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Menanamnya membuat 25 produk pada toko contoh, melewati gerbang publikasi yang sama
            dengan produk penjual sungguhan.
          </p>
          <button
            type="button"
            disabled={seed.isPending}
            onClick={() => seed.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {seed.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
            )}
            Tanam produk contoh
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <strong>{visibleCount}</strong> dari <strong>{rows.length}</strong> produk contoh
              terlihat di katalog publik.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || visibleCount === 0}
                onClick={() => bulk.mutate('hide')}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
              >
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Sembunyikan semua
              </button>
              <button
                type="button"
                disabled={busy || visibleCount === rows.length}
                onClick={() => bulk.mutate('show')}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
                Tampilkan semua
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[42rem] text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-800">
                <tr>
                  <th className="px-4 py-2 font-medium">Produk</th>
                  <th className="px-4 py-2 font-medium">Kategori</th>
                  <th className="px-4 py-2 text-right font-medium">Harga</th>
                  <th className="px-4 py-2 font-medium">Katalog publik</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
                {rows.map((row) => (
                  <tr key={row.listingId}>
                    <td className="px-4 py-2">
                      <span className="block font-medium text-slate-900 dark:text-slate-100">
                        {row.title}
                      </span>
                      <span className="text-xs text-slate-500">{row.code}</span>
                    </td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-400">
                      {row.categoryName ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatPrice(row.price)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          row.visible
                            ? 'rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800'
                            : 'rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs text-slate-600'
                        }
                      >
                        {row.visible ? 'Terlihat' : 'Tersembunyi'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        disabled={busyId === row.listingId}
                        onClick={() =>
                          toggle.mutate({ id: row.listingId, visible: !row.visible })
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                      >
                        {busyId === row.listingId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        ) : row.visible ? (
                          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                        {row.visible ? 'Sembunyikan' : 'Tampilkan'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan kembali menjalankan gerbang publikasi yang sama dengan produk penjual
            sungguhan. Produk yang stoknya habis atau datanya sudah tidak lengkap akan tetap
            tersembunyi, dan alasannya dilaporkan.
          </p>
        </>
      )}
    </div>
  );
}
