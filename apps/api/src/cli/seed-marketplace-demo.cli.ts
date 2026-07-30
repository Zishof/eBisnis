/**
 * Menyiapkan penjual, toko, dan listing contoh pada tenant demo.
 *
 * Tujuannya membuktikan rantai penuh dapat berjalan: produk yang sudah ada di
 * ERP menjadi listing, lolos gerbang publikasi yang sebenarnya, dititipkan ke
 * outbox, lalu muncul pada katalog publik.
 *
 * **Gerbang publikasi tidak dilewati.** Data contoh disiapkan sampai memenuhi
 * seluruh syaratnya, lalu `publish()` yang asli dipanggil. Menerbitkan listing
 * lewat UPDATE langsung akan membuktikan tidak ada apa-apa — justru gerbanglah
 * yang perlu dibuktikan bekerja.
 *
 * Seluruh baris yang dibuat ditandai `is_sample`, sehingga dapat dibersihkan
 * dan tidak tertukar dengan data sungguhan.
 *
 *   pnpm --filter @ebisnis/api seed:marketplace-demo
 */

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MarketplaceSellerStatus,
  MarketplaceStoreStatus,
} from '@prisma/client';
import { AppModule } from '../app.module';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../infrastructure/database/tenant-connection.service';
import { OnlineListingService } from '../modules/listing/online-listing.service';
import { ListingProjectionService } from '../modules/catalog/listing-projection.service';
import { CategoryService } from '../modules/catalog/category.service';

/** Produk contoh, dipetakan ke kategori yang sudah ditanam. */
const SAMPLE_LISTINGS = [
  {
    title: 'Kaos Polos Katun Combed 30s',
    description:
      'Kaos polos berbahan katun combed 30s. Jahitan rantai, sablon tidak mudah retak, ' +
      'tersedia beberapa ukuran. Cocok untuk seragam komunitas maupun pemakaian harian.',
    categoryCode: 'FASHION_PRIA',
    price: 75000,
    stock: 40,
    weightGram: 220,
  },
  {
    title: 'Kemeja Flanel Lengan Panjang',
    description:
      'Kemeja flanel motif kotak dengan bahan tebal namun tetap lembut. Kancing kuat, ' +
      'saku dada, potongan reguler yang tidak ketat di bahu.',
    categoryCode: 'FASHION_PRIA',
    price: 165000,
    stock: 18,
    weightGram: 380,
  },
  {
    title: 'Tas Ransel Laptop 15 Inci',
    description:
      'Ransel dengan sekat laptop berlapis busa, bahan luar tahan air, dan tali bahu ' +
      'yang empuk. Terdapat lubang kabel dan kantong botol di kedua sisi.',
    categoryCode: 'FASHION_TAS',
    price: 249000,
    stock: 12,
    weightGram: 750,
  },
  {
    title: 'Kopi Arabika Gayo 200 Gram',
    description:
      'Biji kopi arabika dari dataran tinggi Gayo, sangrai medium. Dikemas dalam ' +
      'kantong berkatup satu arah agar aroma bertahan. Dapat dipesan dalam bentuk biji atau bubuk.',
    categoryCode: 'MAKANAN_KOPI',
    price: 68000,
    stock: 60,
    weightGram: 220,
  },
  {
    title: 'Powerbank 10000 mAh Fast Charging',
    description:
      'Powerbank kapasitas 10000 mAh dengan dua keluaran USB dan satu USB-C. ' +
      'Mendukung pengisian cepat, dilengkapi indikator daya empat tingkat.',
    categoryCode: 'GADGET_AKSESORIS',
    price: 189000,
    stock: 25,
    weightGram: 240,
  },
  {
    title: 'Sepatu Lari Ringan Pria',
    description:
      'Sepatu lari dengan bagian atas berbahan jaring yang lapang dan sol karet ' +
      'beralur. Ringan, tidak kaku pada tekukan depan, dan tidak licin di aspal basah.',
    categoryCode: 'FASHION_SEPATU',
    price: 320000,
    stock: 0,
    weightGram: 620,
    allowPreorder: true,
  },
];

async function main(): Promise<void> {
  const logger = new Logger('seed-marketplace-demo');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const prisma = app.get(PrismaService);
  const tenantDb = app.get(TenantConnectionService);
  const listings = app.get(OnlineListingService);
  const projection = app.get(ListingProjectionService);

  try {
    await app.get(CategoryService).seed();

    // -- Tenant demo ------------------------------------------------------
    const registry = await prisma.tenantSchemaRegistry.findFirst({
      where: { schemaName: 'demo' },
      select: { tenantId: true, schemaName: true },
    });
    if (!registry) throw new Error('Tenant "demo" tidak ditemukan pada registry.');
    const { tenantId, schemaName } = registry;
    logger.log(`Tenant demo: ${tenantId} (schema ${schemaName})`);

    const program = await prisma.marketplaceProgram.findFirst({ where: { isActive: true } });
    if (!program) throw new Error('Belum ada MarketplaceProgram aktif.');

    // -- Penjual ----------------------------------------------------------
    let seller = await prisma.marketplaceSeller.findFirst({ where: { tenantId, deletedAt: null } });
    if (!seller) {
      seller = await prisma.marketplaceSeller.create({
        data: {
          tenantId,
          programId: program.id,
          sellerCode: `DEMO-${Date.now().toString(36).toUpperCase()}`,
          displayName: 'Toko Demo',
          status: MarketplaceSellerStatus.ACTIVE,
          approvedAt: new Date(),
          isSample: true,
        },
      });
      logger.log(`Penjual dibuat: ${seller.displayName}`);
    } else if (seller.status !== MarketplaceSellerStatus.ACTIVE) {
      seller = await prisma.marketplaceSeller.update({
        where: { id: seller.id },
        data: { status: MarketplaceSellerStatus.ACTIVE, approvedAt: new Date() },
      });
      logger.log('Penjual diaktifkan.');
    }

    // -- Toko -------------------------------------------------------------
    let store = await prisma.marketplaceStore.findFirst({
      where: { sellerId: seller.id, deletedAt: null },
    });
    if (!store) {
      store = await prisma.marketplaceStore.create({
        data: {
          sellerId: seller.id,
          storeSlug: 'toko-demo',
          storeName: 'Toko Demo eBisnis',
          tagline: 'Contoh toko untuk mencoba marketplace eBisnis.id',
          status: MarketplaceStoreStatus.PUBLISHED,
          // Alamat asal wajib bagi gerbang: tanpa titik kirim, ongkos tidak
          // dapat dihitung dan pembeli akan tahu setelah membayar.
          shippingOriginRef: randomUUID(),
        },
      });
      logger.log(`Toko dibuat: ${store.storeSlug}`);
    } else {
      store = await prisma.marketplaceStore.update({
        where: { id: store.id },
        data: {
          status: MarketplaceStoreStatus.PUBLISHED,
          shippingOriginRef: store.shippingOriginRef ?? randomUUID(),
        },
      });
    }

    // -- Kebijakan retur --------------------------------------------------
    const returnPolicy = await prisma.marketplaceStorePolicy.findFirst({
      where: { storeId: store.id, policyType: 'RETURN', deletedAt: null },
    });
    if (!returnPolicy) {
      await prisma.marketplaceStorePolicy.create({
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
      logger.log('Kebijakan retur diterbitkan.');
    }

    // -- Listing pada schema tenant ---------------------------------------
    const S = `"${schemaName}"`;
    const taxCategory = await tenantDb.query<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.tax_category WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );
    const uom = await tenantDb.query<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.uom WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`,
    );

    let published = 0;
    let skipped = 0;

    for (const [index, sample] of SAMPLE_LISTINGS.entries()) {
      const category = await prisma.marketplaceCategory.findUnique({
        where: { code: sample.categoryCode },
        select: { id: true },
      });
      if (!category) {
        logger.warn(`Kategori ${sample.categoryCode} tidak ada; ${sample.title} dilewati.`);
        skipped += 1;
        continue;
      }

      // Produk ERP yang menjadi sumbernya. Listing menunjuk produk, tidak
      // menggandakannya — nama dan harga dasar tetap milik produk.
      const product = await tenantDb.query<{ id: string }>(
        schemaName,
        `SELECT id::text FROM ${S}.product
          WHERE deleted_at IS NULL AND is_active
            AND NOT EXISTS (
              SELECT 1 FROM ${S}.online_listing l
               WHERE l.product_id = ${S}.product.id AND l.deleted_at IS NULL)
          ORDER BY created_at LIMIT 1`,
      );
      if (!product[0]) {
        logger.warn(`Tidak ada produk tanpa listing tersisa; ${sample.title} dilewati.`);
        skipped += 1;
        continue;
      }

      const code = `SAMPLE-LST-${String(index + 1).padStart(3, '0')}`;
      const existing = await tenantDb.query<{ id: string }>(
        schemaName,
        `SELECT id::text FROM ${S}.online_listing WHERE code = $1 AND deleted_at IS NULL`,
        [code],
      );
      if (existing[0]) {
        logger.log(`${code} sudah ada; dilewati.`);
        skipped += 1;
        continue;
      }

      const listingId = randomUUID();
      await tenantDb.transaction(schemaName, async (client) => {
        await client.query(
          `INSERT INTO ${S}.online_listing
             (id, code, product_id, title, description, condition,
              marketplace_category_ref, tax_category_id, compliance_status,
              compliance_checked_at, status, is_sample)
           VALUES ($1, $2, $3, $4, $5, 'NEW', $6, $7, 'PASSED', now(), 'DRAFT', TRUE)`,
          [
            listingId,
            code,
            product[0].id,
            sample.title,
            sample.description,
            category.id,
            taxCategory[0]?.id ?? null,
          ],
        );

        await client.query(
          `INSERT INTO ${S}.online_listing_variant
             (listing_id, sku, variant_name, uom_id, price_minor, currency_code,
              stock_qty, allow_preorder, weight_gram, length_mm, width_mm, height_mm)
           VALUES ($1, $2, 'Standar', $3, $4, 'IDR', $5, $6, $7, 300, 200, 100)`,
          [
            listingId,
            `${code}-STD`,
            uom[0]?.id ?? null,
            sample.price,
            sample.stock,
            sample.allowPreorder ?? false,
            sample.weightGram,
          ],
        );

        // Tiga gambar: syarat yang paling sering disebut pada blueprint.
        // Berkasnya belum ada karena endpoint unggah menyusul bersama
        // keputusan penyimpanan objek; yang dibuat di sini catatannya, agar
        // gerbang benar-benar diuji terhadap jumlah yang disyaratkan.
        for (let n = 1; n <= 3; n += 1) {
          const fileId = randomUUID();
          await client.query(
            `INSERT INTO ${S}.file_object
               (id, code, name, storage_key, filename, mime_type, size_bytes, checksum, is_sample)
             VALUES ($1, $2, $3, $4, $5, 'image/jpeg', 120000, $6, TRUE)`,
            [
              fileId,
              `${code}-IMG-${n}`,
              `${sample.title} foto ${n}`,
              `sample/listing/${listingId}/${n}.jpg`,
              `${code}-${n}.jpg`,
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

      // Gerbang yang sebenarnya dijalankan di sini.
      const actor = {
        tenantId,
        schemaName,
        userId: null as unknown as string,
        username: 'seed-marketplace-demo',
        requestId: randomUUID(),
      };

      const gate = await listings.evaluateGate(actor, listingId);
      if (!gate.canPublish) {
        logger.warn(
          `${code} belum lolos gerbang: ${gate.blocking.map((b) => b.detail).join('; ')}`,
        );
        skipped += 1;
        continue;
      }

      await listings.publish(actor, listingId);
      published += 1;
      logger.log(`${code} terbit: ${sample.title}`);
    }

    logger.log(`Listing terbit: ${published}, dilewati: ${skipped}`);

    // -- Projection -------------------------------------------------------
    const outcomes = await projection.runAll();
    for (const outcome of outcomes) {
      logger.log(
        `Projection ${outcome.tenantSchema}: dibaca ${outcome.read}, diterapkan ` +
          `${outcome.applied}, dilewati ${outcome.skipped}, gagal ${outcome.failed}`,
      );
    }

    const total = await prisma.marketplaceListingProjection.count();
    logger.log(`Katalog publik kini berisi ${total} produk.`);
  } finally {
    await app.close();
  }
}

main().catch((error: Error) => {
  console.error(error.stack ?? error.message);
  process.exit(1);
});
