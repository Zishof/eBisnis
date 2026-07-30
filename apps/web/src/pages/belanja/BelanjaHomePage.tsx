/**
 * Beranda marketplace.
 *
 * Menampilkan kategori dan produk terbaru. Bila katalog masih kosong, halaman
 * ini mengatakannya dengan jelas alih-alih menampilkan kerangka kosong yang
 * terlihat seperti kegagalan memuat — pada tahap awal marketplace, katalog
 * kosong adalah keadaan yang wajar dan harus terbaca sebagai keadaan, bukan
 * sebagai galat.
 */

import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState } from '../../components/ui';
import { ProductCard } from './ProductCard';
import { catalogCategories, catalogSearch } from './catalog';

export function BelanjaHomePage() {
  const categories = useQuery({
    queryKey: ['belanja', 'categories'],
    queryFn: catalogCategories,
    staleTime: 5 * 60 * 1000,
  });

  const latest = useQuery({
    queryKey: ['belanja', 'latest'],
    queryFn: () => catalogSearch({ urut: 'NEWEST' }),
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-xl font-semibold text-slate-900">Kategori</h1>
        {categories.isLoading ? (
          <LoadingState label="Memuat kategori" />
        ) : categories.isError ? (
          <ErrorState
            message="Kategori belum dapat dimuat."
            onRetry={() => void categories.refetch()}
          />
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(categories.data ?? []).map((category) => (
              <li key={category.id}>
                <Link
                  to={`/belanja/cari?kategori=${encodeURIComponent(category.slug)}`}
                  className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-emerald-300 hover:shadow-sm"
                >
                  <span className="block font-medium text-slate-900">{category.name}</span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {category.children.length} subkategori
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Produk terbaru</h2>
          <Link to="/belanja/cari?urut=NEWEST" className="text-sm text-emerald-700 hover:underline">
            Lihat semua
          </Link>
        </div>

        {latest.isLoading ? (
          <LoadingState label="Memuat produk" />
        ) : latest.isError ? (
          <ErrorState message="Produk belum dapat dimuat." onRetry={() => void latest.refetch()} />
        ) : (latest.data?.items.length ?? 0) === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <p className="font-medium text-slate-900">Belum ada produk yang terbit.</p>
            <p className="mt-1 text-sm text-slate-600">
              Katalog terisi setelah penjual menerbitkan produknya dan penerbitan itu
              diproyeksikan ke katalog publik.
            </p>
            <Link
              to="/daftar"
              className="mt-4 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Mulai berjualan
            </Link>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {latest.data!.items.map((item) => (
              <ProductCard key={item.slug} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
