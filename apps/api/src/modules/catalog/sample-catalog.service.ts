/**
 * Produk contoh marketplace: penanaman, penyembunyian, dan penampilan kembali.
 *
 * ## Menyembunyikan memakai jalur yang sudah ada
 *
 * "Sembunyikan" berarti **menarik dari publikasi**, bukan menyetel penanda
 * tampil/tidak yang baru. Penarikan sudah menghapus baris dari projection, dan
 * itu tepat: baris pada katalog publik berarti "boleh dilihat siapa pun".
 *
 * Menambah penanda visibilitas tersendiri akan menghasilkan tempat kedua yang
 * menentukan apakah produk terlihat — dan dua tempat yang menentukan hal yang
 * sama pada akhirnya akan berbeda pendapat.
 *
 * Menampilkan kembali menjalankan **gerbang publikasi yang sebenarnya**. Produk
 * contoh tidak diistimewakan: bila stoknya habis atau tokonya ditangguhkan
 * sejak disembunyikan, ia memang tidak boleh tampil lagi.
 *
 * ## Seluruh operasi terbatas pada baris `is_sample`
 *
 * Setiap kueri di sini menyaring `is_sample = TRUE`. Perintah "sembunyikan
 * semua contoh" tidak boleh dapat menyentuh produk penjual sungguhan, dan
 * satu-satunya cara memastikannya adalah menuliskan syarat itu pada setiap
 * kueri, bukan mengandalkan pemanggil mengirim daftar yang benar.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MarketplaceSellerStatus,
  MarketplaceStoreStatus,
} from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { OnlineListingService } from '../listing/online-listing.service';
import { ListingProjectionService } from './listing-projection.service';
import { CategoryService } from './category.service';
import { SAMPLE_PRODUCTS, type SampleProduct } from './sample-catalog.data';

/** Penanda toko contoh. Dipakai mengenalinya kembali tanpa menebak. */
const SAMPLE_STORE_SLUG = 'toko-demo';

export interface SampleListingRow {
  listingId: string;
  code: string;
  title: string;
  status: string;
  categoryName: string | null;
  price: string | null;
  visible: boolean;
}

export interface SampleActionResult {
  affected: number;
  skipped: number;
  reasons: string[];
}

export interface SampleSeedResult {
  productsCreated: number;
  listingsCreated: number;
  published: number;
  skipped: number;
  projected: number;
}

interface SampleActor {
  userId: string;
  username: string;
  requestId?: string;
}

@Injectable()
export class SampleCatalogService {
  private readonly logger = new Logger(SampleCatalogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
    private readonly listings: OnlineListingService,
    private readonly projection: ListingProjectionService,
    private readonly categories: CategoryService,
  ) {}

  // -------------------------------------------------------------------------
  // Membaca
  // -------------------------------------------------------------------------

  /** Seluruh listing contoh beserta status tampilnya. */
  async list(): Promise<SampleListingRow[]> {
    const target = await this.resolveTarget();
    if (!target) return [];

    const rows = await this.tenantDb.query<{
      id: string;
      code: string;
      title: string | null;
      status: string;
      category_ref: string | null;
      price: string | null;
    }>(
      target.schemaName,
      `SELECT l.id::text, l.code, l.title, l.status,
              l.marketplace_category_ref::text AS category_ref,
              MIN(v.price_minor)::text AS price
         FROM "${target.schemaName}".online_listing l
         LEFT JOIN "${target.schemaName}".online_listing_variant v
                ON v.listing_id = l.id AND v.is_active AND v.deleted_at IS NULL
        WHERE l.is_sample AND l.deleted_at IS NULL
        GROUP BY l.id
        ORDER BY l.code`,
    );

    const categoryIds = [...new Set(rows.map((r) => r.category_ref).filter(Boolean))] as string[];
    const categories = categoryIds.length
      ? await this.prisma.marketplaceCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameOf = new Map(categories.map((c) => [c.id, c.name]));

    // Terlihat atau tidak ditentukan oleh keberadaannya di katalog publik,
    // bukan oleh status pada tenant. Status `PUBLISHED` yang belum sempat
    // diproyeksikan berarti belum terlihat, dan itulah yang perlu dilaporkan.
    const projected = await this.prisma.marketplaceListingProjection.findMany({
      where: { tenantId: target.tenantId, tenantListingId: { in: rows.map((r) => r.id) } },
      select: { tenantListingId: true },
    });
    const visible = new Set(projected.map((p) => p.tenantListingId));

    return rows.map((row) => ({
      listingId: row.id,
      code: row.code,
      title: row.title ?? '(tanpa judul)',
      status: row.status,
      categoryName: row.category_ref ? (nameOf.get(row.category_ref) ?? null) : null,
      price: row.price,
      visible: visible.has(row.id),
    }));
  }

  // -------------------------------------------------------------------------
  // Menyembunyikan dan menampilkan
  // -------------------------------------------------------------------------

  /** Menarik seluruh listing contoh dari katalog publik. */
  async hideAll(actor: SampleActor): Promise<SampleActionResult> {
    return this.applyToAll(actor, 'HIDE');
  }

  /** Menerbitkan kembali seluruh listing contoh yang lolos gerbang. */
  async showAll(actor: SampleActor): Promise<SampleActionResult> {
    return this.applyToAll(actor, 'SHOW');
  }

  /** Menyembunyikan atau menampilkan satu listing contoh. */
  async setVisibility(
    listingId: string,
    visible: boolean,
    actor: SampleActor,
  ): Promise<SampleListingRow | null> {
    const target = await this.resolveTarget();
    if (!target) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Belum ada toko contoh.');
    }

    // Memastikan listing benar-benar contoh sebelum menyentuhnya. Tanpa ini,
    // id listing penjual sungguhan yang dikirim ke endpoint ini akan diproses.
    const owned = await this.tenantDb.query<{ id: string }>(
      target.schemaName,
      `SELECT id::text FROM "${target.schemaName}".online_listing
        WHERE id = $1 AND is_sample AND deleted_at IS NULL`,
      [listingId],
    );
    if (!owned[0]) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Listing contoh tidak ditemukan.');
    }

    const listingActor = { ...target, ...actor };
    if (visible) {
      await this.listings.publish(listingActor, listingId);
    } else {
      await this.listings.unpublish(
        listingActor,
        listingId,
        'Disembunyikan oleh administrator platform.',
      );
    }

    await this.projection.runForTenant(target.tenantId, target.schemaName);
    const rows = await this.list();
    return rows.find((r) => r.listingId === listingId) ?? null;
  }

  private async applyToAll(
    actor: SampleActor,
    action: 'HIDE' | 'SHOW',
  ): Promise<SampleActionResult> {
    const target = await this.resolveTarget();
    if (!target) return { affected: 0, skipped: 0, reasons: ['Belum ada toko contoh.'] };

    const rows = await this.tenantDb.query<{ id: string; code: string; status: string }>(
      target.schemaName,
      `SELECT id::text, code, status FROM "${target.schemaName}".online_listing
        WHERE is_sample AND deleted_at IS NULL ORDER BY code`,
    );

    const listingActor = { ...target, ...actor };
    const result: SampleActionResult = { affected: 0, skipped: 0, reasons: [] };

    for (const row of rows) {
      // Yang sudah berada pada keadaan yang diminta dilewati. Menerbitkan ulang
      // listing yang sudah terbit hanya menambah baris riwayat dan catatan
      // audit tanpa mengubah apa pun.
      const alreadyThere =
        action === 'HIDE' ? row.status !== 'PUBLISHED' : row.status === 'PUBLISHED';
      if (alreadyThere) {
        result.skipped += 1;
        continue;
      }

      try {
        if (action === 'HIDE') {
          await this.listings.unpublish(
            listingActor,
            row.id,
            'Disembunyikan oleh administrator platform.',
          );
        } else {
          await this.listings.publish(listingActor, row.id);
        }
        result.affected += 1;
      } catch (error) {
        result.skipped += 1;
        // Alasan penolakan gerbang ikut dilaporkan. Tanpanya, "12 dilewati"
        // tidak memberi tahu apa pun tentang apa yang perlu diperbaiki.
        result.reasons.push(`${row.code}: ${(error as Error).message}`);
      }
    }

    await this.projection.runForTenant(target.tenantId, target.schemaName);
    this.logger.log(
      `${action}: ${result.affected} diproses, ${result.skipped} dilewati.`,
    );
    return result;
  }

  // -------------------------------------------------------------------------
  // Penanaman
  // -------------------------------------------------------------------------

  /**
   * Menanam produk contoh beserta listingnya.
   *
   * Idempoten: dijalankan berulang tidak menggandakan apa pun, karena setiap
   * produk dikenali dari kodenya yang tetap.
   */
  async seed(actor: SampleActor): Promise<SampleSeedResult> {
    await this.categories.seed();

    const target = await this.ensureSellerAndStore();
    const result: SampleSeedResult = {
      productsCreated: 0,
      listingsCreated: 0,
      published: 0,
      skipped: 0,
      projected: 0,
    };

    const S = `"${target.schemaName}"`;
    const [uom] = await this.tenantDb.query<{ id: string }>(
      target.schemaName,
      `SELECT id::text FROM ${S}.uom WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );
    const [productCategory] = await this.tenantDb.query<{ id: string }>(
      target.schemaName,
      `SELECT id::text FROM ${S}.product_category WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );
    const [taxCategory] = await this.tenantDb.query<{ id: string }>(
      target.schemaName,
      `SELECT id::text FROM ${S}.tax_category WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );
    if (!uom || !productCategory) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tenant contoh belum memiliki satuan atau kategori produk. Jalankan seed tenant lebih dahulu.',
      );
    }

    for (const sample of SAMPLE_PRODUCTS) {
      const marketplaceCategory = await this.prisma.marketplaceCategory.findUnique({
        where: { code: sample.categoryCode },
        select: { id: true },
      });
      if (!marketplaceCategory) {
        result.skipped += 1;
        this.logger.warn(`Kategori ${sample.categoryCode} tidak ada; ${sample.code} dilewati.`);
        continue;
      }

      const listingCode = `SAMPLE-${sample.code}`;
      const [existing] = await this.tenantDb.query<{ id: string; status: string }>(
        target.schemaName,
        `SELECT id::text, status FROM ${S}.online_listing WHERE code = $1 AND deleted_at IS NULL`,
        [listingCode],
      );

      let listingId = existing?.id;
      if (!listingId) {
        listingId = await this.createListing(target.schemaName, sample, {
          uomId: uom.id,
          productCategoryId: productCategory.id,
          taxCategoryId: taxCategory?.id ?? null,
          marketplaceCategoryId: marketplaceCategory.id,
          listingCode,
        });
        result.productsCreated += 1;
        result.listingsCreated += 1;
      }

      if (existing?.status === 'PUBLISHED') {
        result.skipped += 1;
        continue;
      }

      const listingActor = { ...target, ...actor };
      const gate = await this.listings.evaluateGate(listingActor, listingId);
      if (!gate.canPublish) {
        result.skipped += 1;
        this.logger.warn(
          `${listingCode} belum lolos gerbang: ${gate.blocking.map((b) => b.detail).join('; ')}`,
        );
        continue;
      }
      await this.listings.publish(listingActor, listingId);
      result.published += 1;
    }

    const outcome = await this.projection.runForTenant(target.tenantId, target.schemaName);
    result.projected = outcome.applied;
    this.logger.log(
      `Contoh: ${result.listingsCreated} listing dibuat, ${result.published} terbit, ` +
        `${result.projected} masuk katalog.`,
    );
    return result;
  }

  /** Membuat produk ERP beserta listing, varian, dan medianya. */
  private async createListing(
    schemaName: string,
    sample: SampleProduct,
    refs: {
      uomId: string;
      productCategoryId: string;
      taxCategoryId: string | null;
      marketplaceCategoryId: string;
      listingCode: string;
    },
  ): Promise<string> {
    const S = `"${schemaName}"`;
    const productId = randomUUID();
    const listingId = randomUUID();

    await this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(
        `INSERT INTO ${S}.product (id, code, name, sku, category_id, base_uom_id, is_sample)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)`,
        [
          productId,
          `SMP-${sample.code}`,
          sample.title,
          `SKU-${sample.code}`,
          refs.productCategoryId,
          refs.uomId,
        ],
      );

      await client.query(
        `INSERT INTO ${S}.online_listing
           (id, code, product_id, title, description, condition,
            marketplace_category_ref, tax_category_id, compliance_status,
            compliance_checked_at, status, is_sample)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PASSED', now(), 'DRAFT', TRUE)`,
        [
          listingId,
          refs.listingCode,
          productId,
          sample.title,
          sample.description,
          sample.condition ?? 'NEW',
          refs.marketplaceCategoryId,
          refs.taxCategoryId,
        ],
      );

      const variants: { suffix: string; name: string; price: number }[] = [
        { suffix: 'STD', name: 'Standar', price: sample.price },
      ];
      if (sample.priceHigh) {
        variants.push({ suffix: 'PLS', name: 'Varian lain', price: sample.priceHigh });
      }

      for (const variant of variants) {
        await client.query(
          `INSERT INTO ${S}.online_listing_variant
             (listing_id, sku, variant_name, uom_id, price_minor, currency_code,
              stock_qty, allow_preorder, weight_gram, length_mm, width_mm, height_mm)
           VALUES ($1, $2, $3, $4, $5, 'IDR', $6, $7, $8, 300, 200, 100)`,
          [
            listingId,
            `${refs.listingCode}-${variant.suffix}`,
            variant.name,
            refs.uomId,
            variant.price,
            sample.stock,
            sample.allowPreorder ?? false,
            sample.weightGram,
          ],
        );
      }

      // Tiga gambar: syarat gerbang yang paling sering disebut. Berkasnya belum
      // ada karena endpoint unggah menyusul bersama keputusan penyimpanan
      // objek; yang dibuat di sini catatannya, agar gerbang benar-benar diuji
      // terhadap jumlah yang disyaratkan.
      for (let n = 1; n <= 3; n += 1) {
        const fileId = randomUUID();
        await client.query(
          `INSERT INTO ${S}.file_object
             (id, code, name, storage_key, filename, mime_type, size_bytes, checksum, is_sample)
           VALUES ($1, $2, $3, $4, $5, 'image/jpeg', 120000, $6, TRUE)`,
          [
            fileId,
            `${refs.listingCode}-IMG-${n}`,
            `${sample.title} foto ${n}`,
            `sample/listing/${listingId}/${n}.jpg`,
            `${refs.listingCode}-${n}.jpg`,
            `sample-${listingId}-${n}`,
          ],
        );
        await client.query(
          `INSERT INTO ${S}.online_listing_media
             (listing_id, file_object_id, image_format, width_px, height_px,
              content_hash, alt_text, is_primary, sort_order, moderation_status)
           VALUES ($1, $2, 'JPEG', 1200, 1200, $3, $4, $5, $6, 'APPROVED')`,
          [
            listingId,
            fileId,
            `sample-${listingId}-${n}`,
            `${sample.title} foto ${n}`,
            n === 1,
            n,
          ],
        );
      }
    });

    return listingId;
  }

  // -------------------------------------------------------------------------
  // Penjual dan toko contoh
  // -------------------------------------------------------------------------

  private async ensureSellerAndStore(): Promise<{ tenantId: string; schemaName: string }> {
    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { schemaName: 'demo' },
      select: { tenantId: true, schemaName: true },
    });
    if (!registry) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tenant "demo" tidak ditemukan. Produk contoh memerlukannya.',
      );
    }

    const program = await this.prisma.marketplaceProgram.findFirst({ where: { isActive: true } });
    if (!program) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Belum ada program marketplace yang aktif.',
      );
    }

    let seller = await this.prisma.marketplaceSeller.findFirst({
      where: { tenantId: registry.tenantId, deletedAt: null },
    });
    if (!seller) {
      seller = await this.prisma.marketplaceSeller.create({
        data: {
          tenantId: registry.tenantId,
          programId: program.id,
          sellerCode: 'DEMO-SAMPLE',
          displayName: 'Toko Demo',
          status: MarketplaceSellerStatus.ACTIVE,
          approvedAt: new Date(),
          isSample: true,
        },
      });
    } else if (seller.status !== MarketplaceSellerStatus.ACTIVE) {
      seller = await this.prisma.marketplaceSeller.update({
        where: { id: seller.id },
        data: { status: MarketplaceSellerStatus.ACTIVE, approvedAt: new Date() },
      });
    }

    let store = await this.prisma.marketplaceStore.findFirst({
      where: { sellerId: seller.id, deletedAt: null },
    });
    if (!store) {
      store = await this.prisma.marketplaceStore.create({
        data: {
          sellerId: seller.id,
          storeSlug: SAMPLE_STORE_SLUG,
          storeName: 'Toko Demo eBisnis',
          tagline: 'Contoh toko untuk mencoba marketplace eBisnis.id',
          status: MarketplaceStoreStatus.PUBLISHED,
          shippingOriginRef: randomUUID(),
        },
      });
    } else {
      store = await this.prisma.marketplaceStore.update({
        where: { id: store.id },
        data: {
          status: MarketplaceStoreStatus.PUBLISHED,
          shippingOriginRef: store.shippingOriginRef ?? randomUUID(),
        },
      });
    }

    const returnPolicy = await this.prisma.marketplaceStorePolicy.findFirst({
      where: { storeId: store.id, policyType: 'RETURN', deletedAt: null },
    });
    if (!returnPolicy) {
      await this.prisma.marketplaceStorePolicy.create({
        data: {
          storeId: store.id,
          policyType: 'RETURN',
          title: 'Kebijakan pengembalian',
          bodyHtml:
            'Pengembalian diterima dalam 7 hari sejak barang sampai, untuk barang yang ' +
            'belum dipakai dan masih lengkap dengan kemasannya. Ongkos kirim pengembalian ' +
            'ditanggung pembeli kecuali barang yang dikirim keliru atau rusak.',
          publishedAt: new Date(),
        },
      });
    }

    return { tenantId: registry.tenantId, schemaName: registry.schemaName };
  }

  /** Menemukan tenant contoh bila sudah ada; `null` bila belum pernah ditanam. */
  private async resolveTarget(): Promise<{ tenantId: string; schemaName: string } | null> {
    const store = await this.prisma.marketplaceStore.findFirst({
      where: { storeSlug: SAMPLE_STORE_SLUG, deletedAt: null },
      select: { seller: { select: { tenantId: true } } },
    });
    if (!store) return null;

    const registry = await this.prisma.tenantSchemaRegistry.findFirst({
      where: { tenantId: store.seller.tenantId },
      select: { tenantId: true, schemaName: true },
    });
    return registry ?? null;
  }
}
