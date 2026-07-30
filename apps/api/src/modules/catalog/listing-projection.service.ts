/**
 * Worker yang menyalin listing terbit dari schema tenant ke katalog publik.
 *
 * Mengapa disalin, bukan dibaca langsung: marketplace publik yang membaca
 * schema tenant pada setiap permintaan harus membuka koneksi ke ratusan schema
 * dari permintaan anonim. Selain lambat, satu kesalahan penyaringan di jalur
 * itu membocorkan data penjual lain. Projection membalik risikonya — yang
 * dibaca publik hanya berisi apa yang memang boleh dilihat publik.
 *
 * ## Empat aturan yang menentukan isi projection
 *
 * 1. **Hanya listing berstatus `PUBLISHED`.** Bukan disalin lalu disaring saat
 *    dibaca: data yang belum terbit tidak pernah sampai ke tabel yang dibaca
 *    publik.
 * 2. **Hanya penjual berstatus aktif.** Penjual yang ditangguhkan kehilangan
 *    seluruh listingnya dari katalog, bukan hanya kehilangan hak menerbitkan
 *    yang baru.
 * 3. **Penarikan menghapus baris, tidak menandainya.** Baris yang ada di sini
 *    berarti "boleh dilihat siapa pun". Penanda visibilitas hanya menambah satu
 *    tempat lagi yang bisa lupa disaring.
 * 4. **Nama schema hanya dari `platform.tenant_schema_registry`.** Tidak pernah
 *    dari payload peristiwa, dan tidak pernah dari permintaan.
 *
 * ## Mengapa tanpa Redis
 *
 * `SELECT ... FOR UPDATE SKIP LOCKED` pada tabel outbox sudah memberi antrean
 * yang aman dijalankan beberapa proses sekaligus. Menambah Redis berarti
 * menambah satu layanan yang harus dipasang, dipantau, dan dipulihkan pada
 * server produksi — untuk keuntungan yang belum terbukti dibutuhkan pada
 * volume saat ini. Keputusan ini tercatat pada
 * docs/upgrade-v9/09-implementation-plan.md.
 */

import { Injectable, Logger } from '@nestjs/common';
import { MarketplaceSellerStatus, MarketplaceStoreStatus } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { validateSchemaName } from '../../infrastructure/database/schema-name.util';
import type { ListingEventOperation } from './listing-event';

/** Berapa peristiwa yang diambil satu tenant dalam satu putaran. */
const BATCH_SIZE = 100;

/**
 * Setelah berapa lama peristiwa `PROCESSING` dianggap terbengkalai.
 *
 * Proses yang mati setelah mengklaim peristiwa tetapi sebelum menyelesaikannya
 * meninggalkannya berstatus `PROCESSING` selamanya. Tanpa pemulihan ini,
 * listing yang sudah terbit tidak akan pernah muncul di katalog dan tidak ada
 * yang memberi tahu — kegagalan paling berbahaya justru yang senyap.
 *
 * Lima menit cukup longgar untuk putaran terlambat, dan cukup pendek agar
 * pemulihan tidak menunggu lama.
 */
const STALE_PROCESSING_MINUTES = 5;

/** Status penjual yang listingnya boleh tampil. */
const SELLER_VISIBLE_STATUSES = [MarketplaceSellerStatus.ACTIVE];

/**
 * Status toko yang listingnya boleh tampil.
 *
 * Hanya `PUBLISHED`. Toko yang baru `VERIFIED` sudah terbukti kepemilikannya
 * tetapi belum dinyatakan siap berjualan oleh pemiliknya sendiri, dan
 * menampilkan produknya berarti memutuskan hal itu untuknya.
 */
const STORE_VISIBLE_STATUSES = [MarketplaceStoreStatus.PUBLISHED];

export interface ProjectionOutcome {
  tenantId: string;
  tenantSchema: string;
  read: number;
  applied: number;
  skipped: number;
  failed: number;
  durationMs: number;
  error?: string;
}

interface OutboxRow {
  id: string;
  event_id: string;
  entity_id: string | null;
  operation: string;
  payload: Record<string, unknown>;
}

interface ListingRow {
  id: string;
  title: string | null;
  description: string | null;
  condition: string | null;
  status: string;
  category_ref: string | null;
  youtube_video_id: string | null;
  updated_at: Date;
  product_active: boolean;
  min_price: string | null;
  max_price: string | null;
  currency_code: string | null;
  total_stock: string | null;
  allows_preorder: boolean;
  image_count: number;
  primary_image_key: string | null;
}

@Injectable()
export class ListingProjectionService {
  private readonly logger = new Logger(ListingProjectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  /**
   * Menjalankan satu putaran untuk seluruh tenant yang punya toko marketplace.
   *
   * Tenant tanpa toko dilewati sebelum koneksi dibuka — pada instalasi dengan
   * ratusan tenant, sebagian besar tidak berjualan online, dan membuka koneksi
   * ke schema mereka setiap putaran hanya membuang sumber daya.
   */
  async runAll(): Promise<ProjectionOutcome[]> {
    const sellers = await this.prisma.marketplaceSeller.findMany({
      where: { deletedAt: null },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    if (sellers.length === 0) return [];

    const registry = await this.prisma.tenantSchemaRegistry.findMany({
      where: { tenantId: { in: sellers.map((s) => s.tenantId) } },
      select: { tenantId: true, schemaName: true },
    });

    const outcomes: ProjectionOutcome[] = [];
    for (const entry of registry) {
      outcomes.push(await this.runForTenant(entry.tenantId, entry.schemaName));
    }
    return outcomes;
  }

  /** Menjalankan satu putaran untuk satu tenant. */
  async runForTenant(tenantId: string, schemaName: string): Promise<ProjectionOutcome> {
    const startedAt = Date.now();

    // Pemeriksaan ini bukan formalitas. Nama schema masuk ke SQL sebagai
    // pengenal yang tidak dapat diparameterkan, jadi satu-satunya pertahanan
    // adalah memastikan bentuknya sebelum dipakai.
    //
    // `allowReserved` diisi nama yang sedang diperiksa karena daftar nama
    // cadangan ada untuk mencegah tenant baru **mengklaim** nama seperti
    // `demo` — bukan untuk menolak schema yang sudah terdaftar dan sudah
    // berjalan. Nama ini datang dari `platform.tenant_schema_registry`, bukan
    // dari permintaan, sehingga yang tersisa untuk diperiksa hanyalah
    // bentuknya.
    const verdict = validateSchemaName(schemaName, { allowReserved: [schemaName] });
    if (!verdict.valid) {
      throw new Error(`Nama schema "${schemaName}" ditolak: ${verdict.message ?? 'bentuk tidak aman'}`);
    }
    if (verdict.normalized !== schemaName) {
      // Nama yang berubah saat dinormalisasi bukan bentuk kanonik, dan
      // memakainya apa adanya berarti menuliskan sesuatu yang belum diperiksa.
      throw new Error(`Nama schema "${schemaName}" bukan bentuk kanonik.`);
    }

    const outcome: ProjectionOutcome = {
      tenantId,
      tenantSchema: schemaName,
      read: 0,
      applied: 0,
      skipped: 0,
      failed: 0,
      durationMs: 0,
    };

    try {
      const events = await this.claimEvents(schemaName);
      outcome.read = events.length;

      for (const event of events) {
        try {
          const applied = await this.applyEvent(tenantId, schemaName, event);
          if (applied) outcome.applied += 1;
          else outcome.skipped += 1;
          await this.markEvent(schemaName, event.id, 'DISPATCHED');
        } catch (error) {
          outcome.failed += 1;
          // Peristiwa yang gagal dikembalikan ke PENDING agar dicoba lagi.
          // Menandainya selesai akan menyembunyikan listing yang seharusnya
          // tampil, tanpa jejak bahwa ada yang hilang.
          await this.markEvent(schemaName, event.id, 'PENDING').catch(() => undefined);
          this.logger.warn(
            `Peristiwa ${event.event_id} pada ${schemaName} gagal: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      outcome.error = (error as Error).message;
      this.logger.error(`Projection ${schemaName} gagal: ${outcome.error}`);
    }

    outcome.durationMs = Date.now() - startedAt;
    await this.recordRun(outcome);
    return outcome;
  }

  /**
   * Mengambil peristiwa yang belum diproses.
   *
   * `SKIP LOCKED` membuat dua proses yang berjalan bersamaan mengambil
   * peristiwa yang berbeda alih-alih saling menunggu. Tanpanya, menjalankan
   * dua salinan worker justru memperlambat keduanya.
   */
  private async claimEvents(schemaName: string): Promise<OutboxRow[]> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const result = await client.query<OutboxRow>(
        `SELECT id::text, event_id, entity_id::text, operation, payload
           FROM "${schemaName}".sync_outbox
          WHERE entity_type = 'online_listing'
            AND (
              status = 'PENDING'
              -- Peristiwa yang ditinggalkan proses yang mati diambil kembali.
              OR (status = 'PROCESSING'
                  AND created_at < now() - interval '${STALE_PROCESSING_MINUTES} minutes')
            )
          ORDER BY sequence_no
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED`,
      );

      if (result.rows.length > 0) {
        // Ditandai PROCESSING selagi baris masih terkunci, sehingga putaran
        // berikutnya tidak mengambil peristiwa yang sama.
        await client.query(
          `UPDATE "${schemaName}".sync_outbox SET status = 'PROCESSING'
            WHERE id = ANY($1::uuid[])`,
          [result.rows.map((r) => r.id)],
        );
      }
      return result.rows;
    });
  }

  private async markEvent(schemaName: string, id: string, status: string): Promise<void> {
    await this.tenantDb.query(
      schemaName,
      // `$2` dipakai dua kali dengan peran berbeda; tanpa cast eksplisit
      // PostgreSQL menyimpulkan dua tipe yang bertentangan dan menolak kueri.
      `UPDATE "${schemaName}".sync_outbox
          SET status = $2::varchar,
              dispatched_at = CASE WHEN $2::text = 'DISPATCHED' THEN now() ELSE NULL END
        WHERE id = $1::uuid`,
      [id, status],
    );
  }

  /**
   * Menerapkan satu peristiwa.
   *
   * Mengembalikan `true` bila katalog berubah, `false` bila peristiwa sengaja
   * dilewati (listing sudah tidak terbit, penjual tidak aktif, kategori tidak
   * dikenal). Dilewati bukan gagal — ia hasil yang benar dari aturan.
   */
  private async applyEvent(
    tenantId: string,
    schemaName: string,
    event: OutboxRow,
  ): Promise<boolean> {
    const operation = event.operation as ListingEventOperation;
    const listingId = event.entity_id ?? (event.payload?.listingId as string | undefined);
    if (!listingId) return false;

    if (operation === 'UNPUBLISH') {
      return this.removeProjection(tenantId, listingId);
    }

    const listing = await this.loadListing(schemaName, listingId);

    // Peristiwa PUBLISH untuk listing yang sudah tidak berstatus PUBLISHED
    // berarti keadaan berubah setelah peristiwa dititipkan. Yang berlaku
    // adalah keadaan sekarang, bukan niat saat itu.
    if (!listing || listing.status !== 'PUBLISHED' || !listing.product_active) {
      return this.removeProjection(tenantId, listingId);
    }

    return this.upsertProjection(tenantId, schemaName, listing);
  }

  /**
   * Membaca listing beserta ringkasan varian dan medianya.
   *
   * Harga dan ketersediaan diringkas di basis data, bukan di aplikasi, agar
   * satu listing dengan puluhan varian tidak menarik seluruh barisnya hanya
   * untuk menghitung harga terendah.
   */
  private async loadListing(schemaName: string, listingId: string): Promise<ListingRow | null> {
    const rows = await this.tenantDb.query<ListingRow>(
      schemaName,
      `SELECT l.id::text, l.title, l.description, l.condition, l.status,
              l.marketplace_category_ref::text AS category_ref, l.youtube_video_id,
              l.updated_at, p.is_active AS product_active,
              v.min_price::text, v.max_price::text, v.currency_code,
              v.total_stock::text, v.allows_preorder,
              COALESCE(m.image_count, 0)::int AS image_count, m.primary_image_key
         FROM "${schemaName}".online_listing l
         JOIN "${schemaName}".product p ON p.id = l.product_id
         LEFT JOIN LATERAL (
           SELECT MIN(price_minor) AS min_price, MAX(price_minor) AS max_price,
                  MIN(currency_code) AS currency_code,
                  SUM(stock_qty) AS total_stock,
                  bool_or(allow_preorder) AS allows_preorder
             FROM "${schemaName}".online_listing_variant
            WHERE listing_id = l.id AND is_active AND deleted_at IS NULL
         ) v ON TRUE
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS image_count,
                  MAX(f.storage_key) FILTER (WHERE om.is_primary) AS primary_image_key
             FROM "${schemaName}".online_listing_media om
             JOIN "${schemaName}".file_object f ON f.id = om.file_object_id
            WHERE om.listing_id = l.id AND om.is_active AND om.deleted_at IS NULL
              AND om.moderation_status <> 'REJECTED'
         ) m ON TRUE
        WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [listingId],
    );
    return rows[0] ?? null;
  }

  /** Menghapus listing dari katalog publik. Aman dipanggil berulang. */
  private async removeProjection(tenantId: string, tenantListingId: string): Promise<boolean> {
    const deleted = await this.prisma.marketplaceListingProjection.deleteMany({
      where: { tenantId, tenantListingId },
    });
    return deleted.count > 0;
  }

  /**
   * Menulis atau memperbarui baris katalog.
   *
   * Seluruh syarat kelayakan tampil diperiksa di sini, dan yang tidak memenuhi
   * dihapus alih-alih ditulis. Menuliskannya dengan penanda "jangan tampilkan"
   * berarti data yang belum layak tampil tetap berada di tabel yang dibaca
   * publik, dan hanya terpisah oleh satu klausa WHERE yang bisa lupa ditulis.
   */
  private async upsertProjection(
    tenantId: string,
    schemaName: string,
    listing: ListingRow,
  ): Promise<boolean> {
    // Aturan 2: penjual dan toko harus aktif. Diperiksa saat menulis, bukan
    // saat membaca, agar penangguhan langsung berarti hilang dari katalog.
    const store = await this.prisma.marketplaceStore.findFirst({
      where: {
        seller: { tenantId, status: { in: SELLER_VISIBLE_STATUSES }, deletedAt: null },
        status: { in: STORE_VISIBLE_STATUSES },
        deletedAt: null,
      },
      select: {
        id: true,
        sellerId: true,
        storeName: true,
        storeSlug: true,
        seller: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!store) {
      await this.removeProjection(tenantId, listing.id);
      return false;
    }

    // Kategori wajib dan harus dikenal platform. Kategori yang tidak dikenal
    // biasanya berarti kategori dihapus setelah listing terbit.
    if (!listing.category_ref) {
      await this.removeProjection(tenantId, listing.id);
      return false;
    }
    const category = await this.prisma.marketplaceCategory.findFirst({
      where: { id: listing.category_ref, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!category) {
      await this.removeProjection(tenantId, listing.id);
      return false;
    }

    const minPrice = listing.min_price ? Number(listing.min_price) : 0;
    const maxPrice = listing.max_price ? Number(listing.max_price) : 0;
    if (minPrice <= 0) {
      // Harga nol memungkinkan pemesanan tanpa pembayaran.
      await this.removeProjection(tenantId, listing.id);
      return false;
    }

    const stock = listing.total_stock ? Number(listing.total_stock) : 0;
    const availability = stock > 0 ? 'IN_STOCK' : listing.allows_preorder ? 'PREORDER' : 'OUT_OF_STOCK';

    const slug = await this.reserveSlug(tenantId, listing, store.storeSlug);

    const data = {
      sellerId: store.sellerId,
      storeId: store.id,
      tenantSchema: schemaName,
      categoryId: category.id,
      slug,
      title: listing.title ?? 'Tanpa judul',
      description: listing.description,
      condition: listing.condition ?? 'NEW',
      minPrice,
      maxPrice: maxPrice || minPrice,
      currencyCode: listing.currency_code ?? 'IDR',
      availability,
      primaryImageKey: listing.primary_image_key,
      imageCount: listing.image_count,
      youtubeVideoId: listing.youtube_video_id,
      storeName: store.storeName,
      storeSlug: store.storeSlug,
      sourceUpdatedAt: listing.updated_at,
      syncedAt: new Date(),
    };

    await this.prisma.marketplaceListingProjection.upsert({
      where: { tenantId_tenantListingId: { tenantId, tenantListingId: listing.id } },
      create: { ...data, tenantId, tenantListingId: listing.id },
      update: data,
    });
    return true;
  }

  /**
   * Menentukan alamat listing yang tidak bertabrakan antar penjual.
   *
   * Judul yang sama dari dua toko berbeda sangat lazim ("Kaos Polos Hitam").
   * Slug toko disertakan agar keduanya dapat hidup berdampingan tanpa satu
   * pun harus diberi akhiran angka yang tidak berarti bagi pembeli.
   */
  private async reserveSlug(
    tenantId: string,
    listing: ListingRow,
    storeSlug: string,
  ): Promise<string> {
    const existing = await this.prisma.marketplaceListingProjection.findUnique({
      where: { tenantId_tenantListingId: { tenantId, tenantListingId: listing.id } },
      select: { slug: true },
    });
    // Alamat yang sudah pernah dibagikan tidak diubah meski judulnya berubah;
    // tautan yang pernah disebar harus tetap sampai.
    if (existing) return existing.slug;

    const base = slugify(listing.title ?? 'produk');
    let candidate = `${storeSlug}/${base}`.slice(0, 150);

    for (let attempt = 2; attempt <= 50; attempt += 1) {
      const taken = await this.prisma.marketplaceListingProjection.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
      candidate = `${storeSlug}/${base}-${attempt}`.slice(0, 150);
    }
    // Setelah lima puluh percobaan, id listing dipakai: jelek tetapi pasti unik,
    // dan itu lebih baik daripada gagal menerbitkan.
    return `${storeSlug}/${base}-${listing.id.slice(0, 8)}`.slice(0, 150);
  }

  private async recordRun(outcome: ProjectionOutcome): Promise<void> {
    await this.prisma.marketplaceProjectionRun
      .create({
        data: {
          tenantId: outcome.tenantId,
          tenantSchema: outcome.tenantSchema,
          eventsRead: outcome.read,
          eventsApplied: outcome.applied,
          eventsSkipped: outcome.skipped,
          eventsFailed: outcome.failed,
          finishedAt: new Date(),
          durationMs: outcome.durationMs,
          lastError: outcome.error ?? null,
        },
      })
      // Kegagalan mencatat riwayat tidak boleh membatalkan pekerjaan yang
      // sudah berhasil diterapkan.
      .catch((error: Error) => {
        this.logger.warn(`Riwayat projection gagal dicatat: ${error.message}`);
      });
  }
}

/** Mengubah judul menjadi bagian alamat yang aman. */
export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFD')
      // Membuang tanda diakritik agar "kopi árabika" dan "kopi arabika" satu bentuk.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'produk'
  );
}
