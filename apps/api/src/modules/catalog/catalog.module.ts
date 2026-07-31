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
  Body,
  Controller,
  Get,
  HttpCode,
  Module,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiQuery, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { ListingModule } from '../listing/listing.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import {
  AuthenticatedUser,
  CurrentUser,
  Permissions,
  PlatformPermissions,
  Public,
  RequestContext,
  RequestMeta,
} from '../../common/decorators';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { CategoryService } from './category.service';
import { CatalogSearchService, MAX_PAGE_SIZE, type SortOption } from './catalog-search.service';
import { ListingProjectionService } from './listing-projection.service';
import { SampleCatalogService } from './sample-catalog.service';

class SetVisibilityDto {
  @ApiProperty({ description: 'True menampilkan, false menyembunyikan.' })
  @IsBoolean()
  visible!: boolean;
}

const SORT_OPTIONS: SortOption[] = ['RELEVANCE', 'NEWEST', 'PRICE_ASC', 'PRICE_DESC'];

const actorOf = (user: AuthenticatedUser, meta: RequestMeta) => ({
  userId: user.userId,
  username: user.username,
  requestId: meta.requestId,
});

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
    private readonly samples: SampleCatalogService,
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

  @Get('sample')
  @PlatformPermissions('PLATFORM.MARKETPLACE.READ')
  @ApiOperation({
    summary: 'Produk contoh beserta status tampilnya',
    description:
      'Terlihat atau tidak ditentukan dari keberadaannya di katalog publik, ' +
      'bukan dari status pada tenant.',
  })
  listSample() {
    return this.samples.list();
  }

  @Post('sample/seed')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menanam produk contoh',
    description:
      'Idempoten. Gerbang publikasi tetap dijalankan — produk contoh tidak diistimewakan.',
  })
  seedSample(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    return this.samples.seed(actorOf(user, meta));
  }

  @Post('sample/hide')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menyembunyikan seluruh produk contoh dari katalog publik',
    description: 'Hanya menyentuh baris bertanda contoh; produk penjual tidak terpengaruh.',
  })
  hideSample(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    return this.samples.hideAll(actorOf(user, meta));
  }

  @Post('sample/show')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Menampilkan kembali seluruh produk contoh',
    description: 'Gerbang publikasi dijalankan ulang; yang tidak lagi memenuhi syarat tetap tersembunyi.',
  })
  showSample(@CurrentUser() user: AuthenticatedUser, @RequestContext() meta: RequestMeta) {
    return this.samples.showAll(actorOf(user, meta));
  }

  @Post('sample/:id/visibility')
  @PlatformPermissions('PLATFORM.MARKETPLACE.MODERATE')
  @HttpCode(200)
  @ApiOperation({ summary: 'Menyembunyikan atau menampilkan satu produk contoh' })
  setSampleVisibility(
    @Param('id') id: string,
    @Body() dto: SetVisibilityDto,
    @CurrentUser() user: AuthenticatedUser,
    @RequestContext() meta: RequestMeta,
  ) {
    return this.samples.setVisibility(id, dto.visible, actorOf(user, meta));
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
  imports: [InfrastructureModule, ListingModule],
  controllers: [PublicCatalogController, SellerCatalogController, PlatformCatalogController],
  providers: [
    CategoryService,
    CatalogSearchService,
    ListingProjectionService,
    SampleCatalogService,
  ],
  exports: [CategoryService, CatalogSearchService, ListingProjectionService, SampleCatalogService],
})
export class CatalogModule {}
