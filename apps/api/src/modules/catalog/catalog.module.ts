/**
 * Katalog marketplace publik.
 *
 * Tiga jenis pemakai, tiga tingkat hak yang berbeda:
 *
 * - **Publik** (belanja.ebisnis.id) — membaca katalog tanpa masuk sama sekali.
 * - **Penjual** — membaca daftar kategori yang boleh dipilih listingnya.
 * - **Platform** — menanam kategori dan menjalankan worker projection.
 */

import {
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { Permissions, PlatformPermissions, Public } from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { CategoryService } from './category.service';
import { CatalogSearchService, MAX_PAGE_SIZE, type SortOption } from './catalog-search.service';
import { ListingProjectionService } from './listing-projection.service';

const SORT_OPTIONS: SortOption[] = ['RELEVANCE', 'NEWEST', 'PRICE_ASC', 'PRICE_DESC'];

/** Membaca angka dari query string tanpa mempercayai bentuknya. */
function readNumber(raw: string | undefined): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const value = Number(raw);
  // `Number('')` bernilai 0 dan `Number('abc')` bernilai NaN; keduanya bukan
  // angka yang dimaksud pengguna, jadi diperlakukan sebagai tidak diisi.
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

// ---------------------------------------------------------------------------
// Publik
// ---------------------------------------------------------------------------

@ApiTags('katalog-publik')
@Controller('public/catalog')
export class PublicCatalogController {
  constructor(
    private readonly categories: CategoryService,
    private readonly search: CatalogSearchService,
  ) {}

  @Get('categories')
  @Public()
  @ApiOperation({ summary: 'Pohon kategori marketplace' })
  tree() {
    return this.categories.tree();
  }

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Mencari produk pada katalog publik',
    description:
      'Hanya membaca projection. Listing yang belum terbit dan penjual yang ' +
      'ditangguhkan tidak pernah ada di sana, bukan disaring saat dibaca.',
  })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'kategori', required: false })
  @ApiQuery({ name: 'toko', required: false })
  @ApiQuery({ name: 'urut', required: false, enum: SORT_OPTIONS })
  @ApiQuery({ name: 'halaman', required: false, type: Number })
  @ApiQuery({ name: 'jumlah', required: false, type: Number, description: `Maksimum ${MAX_PAGE_SIZE}.` })
  async searchCatalog(
    @Query('q') q?: string,
    @Query('kategori') categorySlug?: string,
    @Query('toko') storeSlug?: string,
    @Query('hargaMin') minPrice?: string,
    @Query('hargaMax') maxPrice?: string,
    @Query('kondisi') condition?: string,
    @Query('stok') inStock?: string,
    @Query('urut') sort?: string,
    @Query('halaman') page?: string,
    @Query('jumlah') limit?: string,
  ) {
    return this.search.search({
      q,
      categorySlug,
      storeSlug,
      minPrice: readNumber(minPrice),
      maxPrice: readNumber(maxPrice),
      condition: condition && ['NEW', 'USED', 'REFURBISHED'].includes(condition) ? condition : undefined,
      inStockOnly: inStock === '1' || inStock === 'true',
      sort: SORT_OPTIONS.includes(sort as SortOption) ? (sort as SortOption) : undefined,
      page: readNumber(page),
      limit: readNumber(limit),
    });
  }

  @Get('produk/:storeSlug/:productSlug')
  @Public()
  @ApiOperation({ summary: 'Detail produk pada katalog publik' })
  async detail(
    @Param('storeSlug') storeSlug: string,
    @Param('productSlug') productSlug: string,
  ) {
    const listing = await this.search.findBySlug(`${storeSlug}/${productSlug}`);
    if (!listing) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Produk tidak ditemukan.');
    }
    return listing;
  }
}

// ---------------------------------------------------------------------------
// Penjual
// ---------------------------------------------------------------------------

@ApiTags('katalog-publik')
@ApiBearerAuth('access-token')
@Controller('seller/catalog')
export class SellerCatalogController {
  constructor(private readonly categories: CategoryService) {}

  @Get('categories')
  @Permissions('ONLINE_LISTING.READ')
  @ApiOperation({
    summary: 'Kategori yang dapat dipilih listing',
    description: 'Hanya kategori daun. Kategori induk ada untuk menavigasi, bukan untuk produk.',
  })
  selectable() {
    return this.categories.selectable();
  }
}

// ---------------------------------------------------------------------------
// Platform
// ---------------------------------------------------------------------------

@ApiTags('katalog-publik')
@ApiBearerAuth('access-token')
@Controller('platform/catalog')
export class PlatformCatalogController {
  constructor(
    private readonly categories: CategoryService,
    private readonly projection: ListingProjectionService,
  ) {}

  @Post('categories/seed')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menanam katalog kategori',
    description: 'Idempoten. Baris yang sudah sama tidak ditulis ulang sehingga audit tetap bersih.',
  })
  seed() {
    return this.categories.seed();
  }

  @Post('projection/run')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menjalankan satu putaran projection katalog',
    description:
      'Membaca sync_outbox tiap tenant yang punya toko, lalu menyegarkan katalog publik.',
  })
  async run() {
    const outcomes = await this.projection.runAll();
    return {
      tenants: outcomes.length,
      read: outcomes.reduce((sum, o) => sum + o.read, 0),
      applied: outcomes.reduce((sum, o) => sum + o.applied, 0),
      skipped: outcomes.reduce((sum, o) => sum + o.skipped, 0),
      failed: outcomes.reduce((sum, o) => sum + o.failed, 0),
      outcomes,
    };
  }
}

@Module({
  imports: [InfrastructureModule],
  controllers: [PublicCatalogController, SellerCatalogController, PlatformCatalogController],
  providers: [CategoryService, CatalogSearchService, ListingProjectionService],
  exports: [CategoryService, CatalogSearchService, ListingProjectionService],
})
export class CatalogModule {}
