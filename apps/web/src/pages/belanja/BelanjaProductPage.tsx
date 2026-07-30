/**
 * Halaman produk pada katalog publik.
 *
 * Tombol beli belum ada, dan itu disengaja: keranjang dan checkout dibangun
 * pada V9-6. Menampilkan tombol yang tidak berfungsi lebih buruk daripada
 * tidak menampilkannya — pembeli yang menekannya dan tidak terjadi apa-apa
 * akan menyimpulkan situsnya rusak.
 */

import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ImageOff, Store } from 'lucide-react';
import { LoadingState } from '../../components/ui';
import {
  AVAILABILITY_LABEL,
  CONDITION_LABEL,
  catalogDetail,
  formatPriceRange,
} from './catalog';

export function BelanjaProductPage() {
  const { storeSlug = '', productSlug = '' } = useParams();

  const product = useQuery({
    queryKey: ['belanja', 'produk', storeSlug, productSlug],
    queryFn: () => catalogDetail(storeSlug, productSlug),
    enabled: Boolean(storeSlug && productSlug),
    retry: false,
  });

  if (product.isLoading) return <LoadingState label="Memuat produk" />;
  if (product.isError) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-900">Produk tidak ditemukan.</p>
        <p className="mt-1 text-sm text-slate-600">
          Produk mungkin sudah ditarik penjualnya atau alamatnya keliru.
        </p>
        <Link to="/belanja" className="mt-4 inline-block text-sm text-emerald-700 hover:underline">
          Kembali ke katalog
        </Link>
      </div>
    );
  }

  const item = product.data!;
  const availability = AVAILABILITY_LABEL[item.availability] ?? AVAILABILITY_LABEL.OUT_OF_STOCK;

  return (
    <article className="space-y-6">
      <nav className="text-sm text-slate-500" aria-label="Remah roti">
        <Link to="/belanja" className="hover:text-slate-900">
          Katalog
        </Link>
        {item.categoryName && (
          <>
            <span className="mx-2">/</span>
            <Link
              to={`/belanja/cari?kategori=${encodeURIComponent(item.categorySlug)}`}
              className="hover:text-slate-900"
            >
              {item.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex aspect-square items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <ImageOff className="h-12 w-12" aria-hidden="true" />
            <span className="text-sm">{item.imageCount} foto terdaftar</span>
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{item.title}</h1>

          <p className="mt-3 text-2xl font-semibold text-slate-900">{formatPriceRange(item)}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`rounded border px-2 py-1 text-xs ${availability.tone}`}>
              {availability.text}
            </span>
            <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {CONDITION_LABEL[item.condition] ?? item.condition}
            </span>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <Link
                to={`/belanja/cari?toko=${encodeURIComponent(item.storeSlug)}`}
                className="font-medium text-slate-900 hover:text-emerald-700"
              >
                {item.storeName}
              </Link>
            </div>
            {item.tagline && <p className="mt-1 text-sm text-slate-600">{item.tagline}</p>}
          </div>

          <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            Pemesanan lewat marketplace belum dibuka. Hubungi penjual untuk membeli produk ini.
          </div>
        </div>
      </div>

      {item.description && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Deskripsi</h2>
          {/* Deskripsi ditampilkan sebagai teks, bukan HTML. Penjual dapat
              menulis apa saja, dan menyajikannya sebagai HTML berarti setiap
              penjual dapat menjalankan skrip di halaman marketplace. */}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {item.description}
          </p>
        </section>
      )}

      {item.youtubeVideoId && (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Video produk</h2>
          <div className="mt-2 aspect-video overflow-hidden rounded-lg border border-slate-200">
            {/* Alamat dibangun dari id yang tersimpan, bukan dari URL yang
                dikirim penjual. Lihat youtube.util.ts pada API. */}
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${item.youtubeVideoId}`}
              title={`Video ${item.title}`}
              className="h-full w-full"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
            />
          </div>
        </section>
      )}
    </article>
  );
}
