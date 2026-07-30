/**
 * Kartu produk pada daftar dan hasil pencarian.
 *
 * Gambar belum punya endpoint penyajian — V9-4 menunda unggah dan turunan
 * gambar sampai penyimpanan objek diputuskan. Sampai itu ada, kartu
 * menampilkan bingkai berisi inisial produk, bukan gambar rusak. Bingkai yang
 * disengaja terbaca sebagai "belum ada foto"; gambar rusak terbaca sebagai
 * "situs ini rusak".
 */

import { Link } from 'react-router-dom';
import { ImageOff } from 'lucide-react';
import {
  AVAILABILITY_LABEL,
  CONDITION_LABEL,
  formatPriceRange,
  type CatalogItem,
} from './catalog';

export function ProductCard({ item }: { item: CatalogItem }) {
  const availability = AVAILABILITY_LABEL[item.availability] ?? AVAILABILITY_LABEL.OUT_OF_STOCK;

  return (
    <Link
      to={`/belanja/${encodeURIComponent(item.slug)}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white transition hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex aspect-square items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-1 text-slate-400">
          <ImageOff className="h-8 w-8" aria-hidden="true" />
          <span className="text-xs">{item.imageCount} foto</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-emerald-700">
          {item.title}
        </h3>
        <p className="mt-2 font-semibold text-slate-900">{formatPriceRange(item)}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[11px] ${availability.tone}`}>
            {availability.text}
          </span>
          {item.condition !== 'NEW' && (
            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600">
              {CONDITION_LABEL[item.condition] ?? item.condition}
            </span>
          )}
        </div>

        <p className="mt-auto pt-2 text-xs text-slate-500">{item.storeName}</p>
      </div>
    </Link>
  );
}
