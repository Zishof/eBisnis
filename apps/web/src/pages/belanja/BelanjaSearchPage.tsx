/**
 * Hasil pencarian katalog.
 *
 * Seluruh keadaan pencarian tinggal di alamat URL, bukan di state komponen.
 * Itu membuat hasil pencarian dapat dibagikan, dapat ditandai, dan tombol
 * kembali bekerja sebagaimana mestinya.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui';
import { ProductCard } from './ProductCard';
import { catalogCategories, catalogSearch } from './catalog';

const SORTS = [
  { value: 'RELEVANCE', label: 'Paling sesuai' },
  { value: 'NEWEST', label: 'Terbaru' },
  { value: 'PRICE_ASC', label: 'Harga termurah' },
  { value: 'PRICE_DESC', label: 'Harga termahal' },
];

export function BelanjaSearchPage() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? undefined;
  const kategori = params.get('kategori') ?? undefined;
  const toko = params.get('toko') ?? undefined;
  const urut = params.get('urut') ?? undefined;
  const stok = params.get('stok') === '1';
  const halaman = Math.max(1, Number(params.get('halaman') ?? '1') || 1);

  const results = useQuery({
    queryKey: ['belanja', 'search', { q, kategori, toko, urut, stok, halaman }],
    queryFn: () => catalogSearch({ q, kategori, toko, urut, stok, halaman }),
  });

  const categories = useQuery({
    queryKey: ['belanja', 'categories'],
    queryFn: catalogCategories,
    staleTime: 5 * 60 * 1000,
  });

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Mengubah penyaring selalu mengembalikan ke halaman satu. Tanpa ini,
    // menyaring dari halaman 5 sering menghasilkan daftar kosong yang
    // terlihat seperti "tidak ada hasil".
    next.delete('halaman');
    setParams(next);
  }

  function goToPage(page: number) {
    const next = new URLSearchParams(params);
    if (page <= 1) next.delete('halaman');
    else next.set('halaman', String(page));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const heading = q
    ? `Hasil untuk "${q}"`
    : kategori
      ? (categories.data ?? [])
          .flatMap((c) => [c, ...c.children])
          .find((c) => c.slug === kategori)?.name ?? 'Kategori'
      : 'Semua produk';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{heading}</h1>
          {results.data && (
            <p className="mt-1 text-sm text-slate-500">{results.data.total} produk ditemukan</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={stok}
              onChange={(event) => update('stok', event.target.checked ? '1' : null)}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Hanya yang tersedia
          </label>

          <label className="sr-only" htmlFor="urutkan">
            Urutkan
          </label>
          <select
            id="urutkan"
            value={urut ?? (q ? 'RELEVANCE' : 'NEWEST')}
            onChange={(event) => update('urut', event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-emerald-500"
          >
            {SORTS.map((sort) => (
              <option key={sort.value} value={sort.value}>
                {sort.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(kategori || toko) && (
        <div className="flex flex-wrap gap-2">
          {kategori && (
            <button
              type="button"
              onClick={() => update('kategori', null)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              Kategori: {kategori} ×
            </button>
          )}
          {toko && (
            <button
              type="button"
              onClick={() => update('toko', null)}
              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800 hover:bg-emerald-100"
            >
              Toko: {toko} ×
            </button>
          )}
        </div>
      )}

      {results.isLoading ? (
        <LoadingState label="Mencari produk" />
      ) : results.isError ? (
        <ErrorState
          message={
            (results.error as { message?: string })?.message ?? 'Pencarian belum dapat dijalankan.'
          }
          onRetry={() => void results.refetch()}
        />
      ) : results.data!.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-900">Tidak ada produk yang cocok.</p>
          <p className="mt-1 text-sm text-slate-600">
            Coba kata kunci lain atau lepaskan sebagian penyaring.
          </p>
          <Link to="/belanja" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
            Kembali ke beranda
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {results.data!.items.map((item) => (
              <ProductCard key={item.slug} item={item} />
            ))}
          </div>

          <nav className="flex items-center justify-center gap-3 pt-4" aria-label="Halaman hasil">
            <button
              type="button"
              disabled={halaman <= 1}
              onClick={() => goToPage(halaman - 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="text-sm text-slate-600">Halaman {halaman}</span>
            <button
              type="button"
              disabled={!results.data!.hasMore}
              onClick={() => goToPage(halaman + 1)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Berikutnya
            </button>
          </nav>
        </>
      )}
    </div>
  );
}
