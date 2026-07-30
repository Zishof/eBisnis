/**
 * Pembacaan katalog publik.
 *
 * Seluruh permintaan di sini anonim. Bila kelak marketplace punya login
 * pembeli, halaman katalog tetap tidak boleh menuntutnya — orang harus dapat
 * melihat barang sebelum memutuskan mendaftar.
 */

import { api } from '../../lib/api';

export interface CatalogItem {
  slug: string;
  title: string;
  minPrice: string;
  maxPrice: string;
  currencyCode: string;
  availability: 'IN_STOCK' | 'PREORDER' | 'OUT_OF_STOCK';
  condition: string;
  primaryImageKey: string | null;
  imageCount: number;
  storeName: string;
  storeSlug: string;
  categorySlug: string;
  categoryName: string;
}

export interface CatalogSearchResponse {
  items: CatalogItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface CatalogCategory {
  id: string;
  code: string;
  name: string;
  slug: string;
  iconName: string | null;
  isLeaf: boolean;
  isRestricted: boolean;
  children: CatalogCategory[];
}

export interface CatalogDetail extends CatalogItem {
  description: string | null;
  youtubeVideoId: string | null;
  tagline: string | null;
  categoryPath: string | null;
  lastSyncedAt: string;
}

export interface CatalogQuery {
  q?: string;
  kategori?: string;
  toko?: string;
  urut?: string;
  halaman?: number;
  stok?: boolean;
}

export function catalogSearch(query: CatalogQuery): Promise<CatalogSearchResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.kategori) params.set('kategori', query.kategori);
  if (query.toko) params.set('toko', query.toko);
  if (query.urut) params.set('urut', query.urut);
  if (query.halaman && query.halaman > 1) params.set('halaman', String(query.halaman));
  if (query.stok) params.set('stok', '1');
  const suffix = params.toString();
  return api.get<CatalogSearchResponse>(`/public/catalog/search${suffix ? `?${suffix}` : ''}`);
}

export function catalogCategories(): Promise<CatalogCategory[]> {
  return api.get<CatalogCategory[]>('/public/catalog/categories');
}

export function catalogDetail(storeSlug: string, productSlug: string): Promise<CatalogDetail> {
  return api.get<CatalogDetail>(
    `/public/catalog/produk/${encodeURIComponent(storeSlug)}/${encodeURIComponent(productSlug)}`,
  );
}

/**
 * Menampilkan harga sebagai rentang bila varian berbeda harga.
 *
 * Menampilkan harga terendah saja membuat pembeli merasa ditipu saat sampai di
 * halaman produk dan menemukan varian yang diinginkannya jauh lebih mahal.
 */
export function formatPriceRange(item: {
  minPrice: string;
  maxPrice: string;
  currencyCode: string;
}): string {
  const min = Number(item.minPrice);
  const max = Number(item.maxPrice);
  const format = (value: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: item.currencyCode || 'IDR',
      maximumFractionDigits: 0,
    }).format(value);
  return min === max ? format(min) : `${format(min)} – ${format(max)}`;
}

export const AVAILABILITY_LABEL: Record<string, { text: string; tone: string }> = {
  IN_STOCK: { text: 'Tersedia', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  PREORDER: { text: 'Pesan dahulu', tone: 'text-amber-700 bg-amber-50 border-amber-200' },
  OUT_OF_STOCK: { text: 'Stok habis', tone: 'text-slate-600 bg-slate-100 border-slate-200' },
};

export const CONDITION_LABEL: Record<string, string> = {
  NEW: 'Baru',
  USED: 'Bekas',
  REFURBISHED: 'Rekondisi',
};
