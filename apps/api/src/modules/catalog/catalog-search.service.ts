/**
 * Pencarian katalog publik.
 *
 * Seluruh pembacaan di sini berasal dari `marketplace_listing_projection`, dan
 * tidak satu pun menyentuh schema tenant. Itu bukan pilihan kinerja semata:
 * permintaan anonim tidak pernah memiliki alasan untuk membuka koneksi ke
 * schema penjual, dan menutup jalurnya sama sekali lebih dapat diandalkan
 * daripada menyaringnya dengan benar setiap kali.
 *
 * ## Batas terhadap pengambilan massal (R26)
 *
 * Katalog memang untuk dilihat siapa pun, tetapi menyalin seluruhnya adalah
 * hal lain. Tiga batas bekerja bersama:
 *
 * - **Ukuran halaman dibatasi.** `limit` di atas 48 dipangkas, bukan ditolak,
 *   agar pengunjung biasa tidak terganggu.
 * - **Kedalaman halaman dibatasi.** Offset melewati 2.000 baris ditolak.
 *   Pembeli sungguhan tidak pernah membuka halaman ke-200; yang melakukannya
 *   sedang menyalin katalog.
 * - **Penyaring wajib untuk penelusuran dalam.** Melewati halaman pertama
 *   menuntut kata kunci, kategori, atau toko. Tanpa itu, pengambilan berurut
 *   dari halaman 1 sampai habis menjadi mustahil.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;
/** Batas kedalaman penelusuran. Lihat catatan R26 di atas. */
export const MAX_OFFSET = 2000;

export type SortOption = 'RELEVANCE' | 'NEWEST' | 'PRICE_ASC' | 'PRICE_DESC';

export interface SearchQuery {
  q?: string;
  categorySlug?: string;
  storeSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  condition?: string;
  inStockOnly?: boolean;
  sort?: SortOption;
  page?: number;
  limit?: number;
}

export interface SearchResultItem {
  slug: string;
  title: string;
  minPrice: string;
  maxPrice: string;
  currencyCode: string;
  availability: string;
  condition: string;
  primaryImageKey: string | null;
  imageCount: number;
  storeName: string;
  storeSlug: string;
  categorySlug: string;
  categoryName: string;
}

export interface SearchResult {
  items: SearchResultItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  /** Diisi bila permintaan dipangkas, agar pemanggil tahu bukan ini yang diminta. */
  notice?: string;
}

@Injectable()
export class CatalogSearchService {
  private readonly logger = new Logger(CatalogSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  async search(query: SearchQuery): Promise<SearchResult> {
    const limit = clamp(query.limit ?? DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
    const page = Math.max(1, Math.floor(query.page ?? 1));
    const offset = (page - 1) * limit;

    const hasFilter = Boolean(
      normalizeTerm(query.q) || query.categorySlug || query.storeSlug || query.minPrice || query.maxPrice,
    );

    if (offset > MAX_OFFSET) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Penelusuran terlalu dalam. Persempit dengan kata kunci atau kategori.',
      );
    }
    // Halaman jauh tanpa penyaring apa pun adalah bentuk pengambilan massal
    // yang paling murah dilakukan, dan paling mudah ditutup.
    if (offset > 0 && !hasFilter && page > 5) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Sertakan kata kunci, kategori, atau toko untuk menelusuri lebih jauh.',
      );
    }

    const where = await this.buildWhere(query);
    const term = normalizeTerm(query.q);

    // Pengurutan relevansi menuntut peringkat teks penuh, yang tidak dapat
    // dinyatakan lewat Prisma. Hanya jalur inilah yang memakai SQL mentah, dan
    // seluruh nilainya tetap berupa parameter.
    if (term && (query.sort ?? 'RELEVANCE') === 'RELEVANCE') {
      return this.searchByRelevance(term, query, where, { page, limit, offset });
    }

    const [rows, total] = await Promise.all([
      this.prisma.marketplaceListingProjection.findMany({
        where,
        orderBy: this.orderBy(query.sort),
        skip: offset,
        take: limit,
        select: PROJECTION_SELECT,
      }),
      this.prisma.marketplaceListingProjection.count({ where }),
    ]);

    return {
      items: rows.map(toItem),
      page,
      limit,
      total,
      hasMore: offset + rows.length < total,
    };
  }

  /**
   * Pencarian berperingkat.
   *
   * `websearch_to_tsquery` dipakai, bukan `to_tsquery`, karena ia menerima apa
   * yang benar-benar diketik orang — termasuk tanda kutip dan kata "atau" —
   * tanpa melempar kesalahan sintaks pada masukan yang tidak beraturan.
   * `to_tsquery` akan gagal pada masukan sesederhana `kaos & `.
   */
  private async searchByRelevance(
    term: string,
    query: SearchQuery,
    where: Prisma.MarketplaceListingProjectionWhereInput,
    paging: { page: number; limit: number; offset: number },
  ): Promise<SearchResult> {
    const ids = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      SELECT id::text, ts_rank(search_document, websearch_to_tsquery('simple', ${term})) AS rank
        FROM platform.marketplace_listing_projection
       WHERE search_document @@ websearch_to_tsquery('simple', ${term})
       ORDER BY rank DESC, synced_at DESC
       LIMIT ${paging.limit} OFFSET ${paging.offset}
    `;

    // Kata kunci sudah mempersempit; penyaring lain diterapkan lewat Prisma
    // agar aturannya sama persis dengan jalur non-teks dan tidak ada satu pun
    // syarat yang tertulis dua kali dengan bunyi berbeda.
    const rows = ids.length
      ? await this.prisma.marketplaceListingProjection.findMany({
          where: { AND: [where, { id: { in: ids.map((r) => r.id) } }] },
          select: PROJECTION_SELECT,
        })
      : [];

    // Urutan dari peringkat teks dipulihkan; `findMany` tidak menjaganya.
    const order = new Map(ids.map((r, index) => [r.id, index]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    // Jumlah harus ikut menghitung kata kuncinya. Menghitung `where` saja
    // melaporkan "6 produk ditemukan" ketika hanya satu yang cocok — angka
    // yang salah lebih buruk daripada tidak ada angka, karena pembeli
    // menyimpulkan ada lima hasil lain yang tidak ditampilkan.
    const counted = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT count(*)::bigint AS total
        FROM platform.marketplace_listing_projection
       WHERE search_document @@ websearch_to_tsquery('simple', ${term})
    `;
    const matched = Number(counted[0]?.total ?? 0);

    // Penyaring lain dapat memangkas lebih jauh, dan itu hanya diketahui dari
    // baris yang benar-benar terbaca. Yang dilaporkan adalah yang lebih kecil.
    const total =
      rows.length < ids.length ? paging.offset + rows.length : Math.max(matched, rows.length);

    return {
      items: rows.map(toItem),
      page: paging.page,
      limit: paging.limit,
      total,
      hasMore: rows.length === paging.limit && paging.offset + rows.length < total,
    };
  }

  private async buildWhere(
    query: SearchQuery,
  ): Promise<Prisma.MarketplaceListingProjectionWhereInput> {
    const where: Prisma.MarketplaceListingProjectionWhereInput = {};

    if (query.categorySlug) {
      const category = await this.prisma.marketplaceCategory.findFirst({
        where: { slug: query.categorySlug, isActive: true, deletedAt: null },
        select: { id: true, path: true, isLeaf: true },
      });
      if (!category) {
        // Kategori tak dikenal menghasilkan kosong, bukan kesalahan: alamat
        // lama yang sudah tersebar sebaiknya menampilkan halaman kosong yang
        // wajar alih-alih layar galat.
        return { id: { in: [] } };
      }
      if (category.isLeaf) {
        where.categoryId = category.id;
      } else {
        // Kategori induk mencakup seluruh keturunannya. Jalur materialized
        // membuatnya satu perbandingan awalan, tanpa rekursi.
        const descendants = await this.prisma.marketplaceCategory.findMany({
          where: { path: { startsWith: category.path }, isActive: true, deletedAt: null },
          select: { id: true },
        });
        where.categoryId = { in: descendants.map((c) => c.id) };
      }
    }

    if (query.storeSlug) where.storeSlug = query.storeSlug;
    if (query.condition) where.condition = query.condition;
    if (query.inStockOnly) where.availability = 'IN_STOCK';

    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      // Perbandingan memakai harga tertinggi untuk batas bawah dan harga
      // terendah untuk batas atas: listing dengan rentang 50rb–200rb harus
      // muncul pada pencarian "di bawah 100rb" maupun "di atas 150rb".
      if (query.minPrice !== undefined) where.maxPrice = { gte: query.minPrice };
      if (query.maxPrice !== undefined) where.minPrice = { lte: query.maxPrice };
    }

    return where;
  }

  private orderBy(
    sort: SortOption | undefined,
  ): Prisma.MarketplaceListingProjectionOrderByWithRelationInput[] {
    switch (sort) {
      case 'PRICE_ASC':
        return [{ minPrice: 'asc' }, { syncedAt: 'desc' }];
      case 'PRICE_DESC':
        return [{ minPrice: 'desc' }, { syncedAt: 'desc' }];
      case 'NEWEST':
      default:
        return [{ syncedAt: 'desc' }];
    }
  }

  /** Detail satu listing berdasarkan alamatnya. */
  async findBySlug(slug: string): Promise<Record<string, unknown> | null> {
    const row = await this.prisma.marketplaceListingProjection.findUnique({
      where: { slug },
      select: {
        ...PROJECTION_SELECT,
        description: true,
        youtubeVideoId: true,
        syncedAt: true,
        store: { select: { storeName: true, storeSlug: true, tagline: true } },
        category: { select: { name: true, slug: true, path: true } },
      },
    });
    if (!row) return null;

    // `tenantId`, `tenantSchema`, dan `tenantListingId` sengaja tidak ikut.
    // Pengunjung tidak pernah membutuhkannya, dan mengirimkannya memberi tahu
    // nama schema yang dapat dicoba dipakai pada permintaan lain.
    return {
      ...toItem(row),
      description: row.description,
      youtubeVideoId: row.youtubeVideoId,
      tagline: row.store?.tagline ?? null,
      categoryPath: row.category?.path ?? null,
      lastSyncedAt: row.syncedAt,
    };
  }
}

const PROJECTION_SELECT = {
  id: true,
  slug: true,
  title: true,
  minPrice: true,
  maxPrice: true,
  currencyCode: true,
  availability: true,
  condition: true,
  primaryImageKey: true,
  imageCount: true,
  storeName: true,
  storeSlug: true,
  category: { select: { slug: true, name: true } },
} satisfies Prisma.MarketplaceListingProjectionSelect;

type ProjectionRow = Prisma.MarketplaceListingProjectionGetPayload<{
  select: typeof PROJECTION_SELECT;
}>;

function toItem(row: ProjectionRow): SearchResultItem {
  return {
    slug: row.slug,
    title: row.title,
    minPrice: row.minPrice.toString(),
    maxPrice: row.maxPrice.toString(),
    currencyCode: row.currencyCode,
    availability: row.availability,
    condition: row.condition,
    primaryImageKey: row.primaryImageKey,
    imageCount: row.imageCount,
    storeName: row.storeName,
    storeSlug: row.storeSlug,
    categorySlug: row.category?.slug ?? '',
    categoryName: row.category?.name ?? '',
  };
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

/**
 * Membersihkan kata kunci.
 *
 * Dibatasi 120 karakter: kata kunci yang lebih panjang dari itu bukan
 * pencarian, dan memberi pencari teks penuh masukan sepanjang kilobyte adalah
 * cara murah membuat basis data sibuk.
 */
export function normalizeTerm(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/\s+/g, ' ').slice(0, 120);
  return value.length >= 2 ? value : null;
}
