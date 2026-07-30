import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { NumberSequenceService } from '../../infrastructure/sequence/number-sequence.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { enqueueListingEvent } from '../catalog/listing-event';
import { validateImage } from './media-validation';
import { parseYoutubeUrl } from './youtube.util';
import {
  DEFAULT_MINIMUM_IMAGES,
  evaluatePublicationGate,
  type GateResult,
  type ListingSnapshot,
} from './publication-gate';

export interface ListingActor {
  userId: string;
  username: string;
  tenantId: string;
  schemaName: string;
  requestId?: string;
}

/** Status listing yang boleh menerima perubahan isi. */
const EDITABLE_STATUSES = new Set([
  'DRAFT',
  'INCOMPLETE',
  'VALIDATION_FAILED',
  'REJECTED',
  'PAUSED',
]);

@Injectable()
export class OnlineListingService {
  private readonly logger = new Logger(OnlineListingService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly prisma: PrismaService,
    private readonly sequences: NumberSequenceService,
    private readonly audit: AuditService,
  ) {}

  /** Membuat listing untuk satu produk. Idempoten lewat batasan unik produk. */
  async create(
    actor: ListingActor,
    input: { productId: string; title?: string; description?: string; condition?: string },
  ) {
    const S = `"${actor.schemaName}"`;

    const existing = await this.tenantDb.queryOne<{ id: string }>(
      actor.schemaName,
      `SELECT id::text AS id FROM online_listing WHERE product_id = $1 AND deleted_at IS NULL`,
      [input.productId],
    );
    if (existing) return this.load(actor, existing.id);

    const product = await this.tenantDb.queryOne<{ name: string; is_active: boolean }>(
      actor.schemaName,
      `SELECT name, is_active FROM product WHERE id = $1 AND deleted_at IS NULL`,
      [input.productId],
    );
    if (!product) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Produk tidak ditemukan.');
    }

    return this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        const code = await this.sequences.next(client, actor.schemaName, 'ONLINE_LISTING');
        const created = await client.query<{ id: string }>(
          `INSERT INTO ${S}.online_listing
             (code, product_id, title, description, condition, status, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, 'DRAFT', $6, $6)
           RETURNING id::text AS id`,
          [
            code,
            input.productId,
            input.title ?? product.name,
            input.description ?? null,
            input.condition ?? 'NEW',
            actor.userId,
          ],
        );
        return this.loadInTransaction(client, actor.schemaName, created.rows[0].id);
      },
      { requestId: actor.requestId, moduleCode: 'MARKETPLACE', actionCode: 'LISTING_CREATED' },
    );
  }

  /**
   * Menyimpan URL YouTube.
   *
   * Yang disimpan adalah id video, bukan URL yang dikirim. Alamat embed dibangun
   * sistem saat penyajian, sehingga apa pun yang dikirim penjual tidak pernah
   * menjadi bagian dari HTML.
   */
  async setYoutubeUrl(actor: ListingActor, listingId: string, rawUrl: string | null) {
    if (rawUrl === null || rawUrl.trim().length === 0) {
      await this.tenantDb.query(
        actor.schemaName,
        `UPDATE online_listing SET youtube_video_id = NULL, updated_at = now(), updated_by = $2
          WHERE id = $1`,
        [listingId, actor.userId],
      );
      return this.load(actor, listingId);
    }

    const parsed = parseYoutubeUrl(rawUrl);
    if (!parsed.ok) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `URL YouTube tidak dapat dipakai: ${parsed.reason}`,
      );
    }

    await this.tenantDb.query(
      actor.schemaName,
      `UPDATE online_listing SET youtube_video_id = $2, updated_at = now(), updated_by = $3
        WHERE id = $1 AND deleted_at IS NULL`,
      [listingId, parsed.videoId, actor.userId],
    );
    return this.load(actor, listingId);
  }

  /**
   * Menambahkan gambar.
   *
   * Berkas diperiksa sebelum disimpan: tipe ditentukan dari isinya, dimensi
   * dibaca dari header tanpa mendekode, dan gambar yang sama tidak dapat
   * diunggah dua kali pada satu listing.
   */
  async addImage(
    actor: ListingActor,
    listingId: string,
    file: { buffer: Buffer; filename: string; storageKey: string },
    options: { altText?: string; isPrimary?: boolean } = {},
  ) {
    const validation = validateImage(file.buffer, file.filename);
    if (!validation.ok) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, validation.message!, {
        code: validation.code,
      });
    }
    const probe = validation.probe!;
    const contentHash = createHash('sha256').update(file.buffer).digest('hex');

    const S = `"${actor.schemaName}"`;
    return this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        const listing = await client.query<{ status: string }>(
          `SELECT status FROM ${S}.online_listing WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [listingId],
        );
        if (!listing.rows[0]) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Listing tidak ditemukan.');
        }

        const duplicate = await client.query<{ id: string }>(
          `SELECT id::text AS id FROM ${S}.online_listing_media
            WHERE listing_id = $1 AND content_hash = $2 AND deleted_at IS NULL`,
          [listingId, contentHash],
        );
        if (duplicate.rows[0]) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Gambar yang sama sudah diunggah pada listing ini.',
          );
        }

        // Berkas disimpan pada file_object yang sudah ada sejak V001. Tidak ada
        // tabel penyimpanan berkas kedua yang dibuat.
        const fileRow = await client.query<{ id: string }>(
          `INSERT INTO ${S}.file_object
             (code, name, storage_key, filename, mime_type, size_bytes, checksum, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
           RETURNING id::text AS id`,
          [
            `LISTING-${contentHash.slice(0, 16)}`,
            file.filename,
            file.storageKey,
            file.filename,
            probe.mimeType,
            file.buffer.length,
            contentHash,
            actor.userId,
          ],
        );

        const count = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM ${S}.online_listing_media
            WHERE listing_id = $1 AND is_active AND deleted_at IS NULL`,
          [listingId],
        );
        // Gambar pertama otomatis menjadi utama; tanpa ini penjual harus
        // menekan satu tombol tambahan untuk sesuatu yang selalu benar.
        const isPrimary = options.isPrimary ?? Number(count.rows[0].n) === 0;
        if (isPrimary) {
          await client.query(
            `UPDATE ${S}.online_listing_media SET is_primary = FALSE
              WHERE listing_id = $1 AND is_primary`,
            [listingId],
          );
        }

        await client.query(
          `INSERT INTO ${S}.online_listing_media
             (listing_id, file_object_id, image_format, width_px, height_px, content_hash,
              alt_text, is_primary, sort_order, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
          [
            listingId,
            fileRow.rows[0].id,
            probe.format,
            probe.width,
            probe.height,
            contentHash,
            options.altText ?? null,
            isPrimary,
            Number(count.rows[0].n),
            actor.userId,
          ],
        );

        return this.loadInTransaction(client, actor.schemaName, listingId);
      },
      { requestId: actor.requestId, moduleCode: 'MARKETPLACE', actionCode: 'LISTING_MEDIA_ADDED' },
    );
  }

  /** Menjalankan gerbang publikasi dan menyimpan hasilnya. */
  async evaluateGate(actor: ListingActor, listingId: string): Promise<GateResult> {
    const snapshot = await this.buildSnapshot(actor, listingId);
    const program = await this.prisma.marketplaceProgram.findFirst({
      where: { deletedAt: null },
      select: { minimumListingImages: true },
    });
    const result = evaluatePublicationGate(snapshot, {
      minimumImages: program?.minimumListingImages ?? DEFAULT_MINIMUM_IMAGES,
    });

    await this.tenantDb.query(
      actor.schemaName,
      `UPDATE online_listing
          SET gate_snapshot = $2::jsonb, gate_checked_at = now(), updated_by = $3
        WHERE id = $1`,
      [listingId, JSON.stringify(result), actor.userId],
    );

    return result;
  }

  /**
   * Menerbitkan listing.
   *
   * Gerbang dijalankan ulang di sini, tidak mengandalkan hasil tersimpan.
   * Hasil lama dapat sudah usang — gambar dihapus, stok habis, atau penjual
   * ditangguhkan sejak pemeriksaan terakhir.
   */
  async publish(actor: ListingActor, listingId: string) {
    const gate = await this.evaluateGate(actor, listingId);
    if (!gate.canPublish) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Listing belum dapat diterbitkan. Belum terpenuhi: ${gate.blocking
          .map((c) => c.detail)
          .join('; ')}`,
        { blocking: gate.blocking },
      );
    }

    const S = `"${actor.schemaName}"`;
    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        const current = await client.query<{ status: string }>(
          `SELECT status FROM ${S}.online_listing WHERE id = $1 FOR UPDATE`,
          [listingId],
        );
        const from = current.rows[0]?.status ?? null;

        await client.query(
          `UPDATE ${S}.online_listing
              SET status = 'PUBLISHED', published_at = now(), published_by = $2,
                  unpublished_at = NULL, updated_at = now(), updated_by = $2
            WHERE id = $1`,
          [listingId, actor.userId],
        );
        await client.query(
          `INSERT INTO ${S}.online_listing_publication
             (listing_id, from_status, to_status, reason, gate_snapshot, actor_id, request_id)
           VALUES ($1, $2, 'PUBLISHED', $3, $4::jsonb, $5, $6)`,
          [
            listingId,
            from,
            'Diterbitkan oleh penjual.',
            JSON.stringify(gate),
            actor.userId,
            actor.requestId ?? null,
          ],
        );

        // Dititipkan dalam transaksi yang sama. Bila penerbitan gagal, peristiwa
        // ini ikut dibatalkan; bila berhasil, katalog publik pasti mendapatnya.
        await enqueueListingEvent(client, actor.schemaName, 'PUBLISH', { listingId });
      },
      { requestId: actor.requestId, moduleCode: 'MARKETPLACE', actionCode: 'LISTING_PUBLISHED' },
    );

    await this.audit.record({
      moduleCode: 'MARKETPLACE',
      actionCode: 'LISTING_PUBLISHED',
      entityType: 'online_listing',
      entityId: listingId,
      tenantId: actor.tenantId,
      tenantSchema: actor.schemaName,
      actorUserId: actor.userId,
      actorUsername: actor.username,
      requestId: actor.requestId,
    });

    this.logger.log(`Listing ${listingId} diterbitkan.`);
    return this.load(actor, listingId);
  }

  /** Menarik listing dari publikasi. */
  async unpublish(actor: ListingActor, listingId: string, reason: string) {
    const S = `"${actor.schemaName}"`;
    await this.tenantDb.transaction(
      actor.schemaName,
      async (client) => {
        const current = await client.query<{ status: string }>(
          `SELECT status FROM ${S}.online_listing WHERE id = $1 FOR UPDATE`,
          [listingId],
        );
        if (!current.rows[0]) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Listing tidak ditemukan.');
        }
        await client.query(
          `UPDATE ${S}.online_listing
              SET status = 'PAUSED', unpublished_at = now(), updated_at = now(), updated_by = $2
            WHERE id = $1`,
          [listingId, actor.userId],
        );
        await client.query(
          `INSERT INTO ${S}.online_listing_publication
             (listing_id, from_status, to_status, reason, actor_id, request_id)
           VALUES ($1, $2, 'PAUSED', $3, $4, $5)`,
          [listingId, current.rows[0].status, reason, actor.userId, actor.requestId ?? null],
        );

        // Penarikan juga dititipkan. Tanpa ini listing tetap terlihat publik
        // meski penjual sudah menghentikannya — kegagalan yang paling merugikan.
        await enqueueListingEvent(client, actor.schemaName, 'UNPUBLISH', { listingId, reason });
      },
      { requestId: actor.requestId, moduleCode: 'MARKETPLACE', actionCode: 'LISTING_UNPUBLISHED' },
    );
    return this.load(actor, listingId);
  }

  /** Menyusun bentuk yang dibutuhkan gerbang publikasi. */
  private async buildSnapshot(actor: ListingActor, listingId: string): Promise<ListingSnapshot> {
    const listing = await this.tenantDb.queryOne<Record<string, unknown>>(
      actor.schemaName,
      `SELECT l.title, l.description, l.condition, l.marketplace_category_ref::text AS category,
              l.tax_category_id::text AS tax_category, l.compliance_status, l.youtube_video_id,
              p.is_active AS product_active
         FROM online_listing l
         JOIN product p ON p.id = l.product_id
        WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [listingId],
    );
    if (!listing) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Listing tidak ditemukan.');
    }

    const variants = await this.tenantDb.query<Record<string, unknown>>(
      actor.schemaName,
      `SELECT sku, price_minor::text AS price_minor, stock_qty::float8 AS stock_qty,
              allow_preorder, weight_gram, length_mm, width_mm, height_mm
         FROM online_listing_variant
        WHERE listing_id = $1 AND is_active AND deleted_at IS NULL`,
      [listingId],
    );

    const media = await this.tenantDb.query<Record<string, unknown>>(
      actor.schemaName,
      `SELECT id::text AS id, is_active, is_primary, moderation_status
         FROM online_listing_media
        WHERE listing_id = $1 AND deleted_at IS NULL`,
      [listingId],
    );

    // Status penjual, alamat asal, dan kebijakan retur tinggal di schema
    // platform; keduanya dibaca dari sana, bukan disalin ke tenant.
    const seller = await this.prisma.marketplaceSeller.findFirst({
      where: { tenantId: actor.tenantId, deletedAt: null },
      include: {
        stores: {
          where: { deletedAt: null },
          take: 1,
          include: {
            policies: {
              where: { policyType: 'RETURN', publishedAt: { not: null }, deletedAt: null },
              take: 1,
            },
          },
        },
      },
    });
    const store = seller?.stores[0];

    return {
      sellerStatus: seller?.status ?? 'PROSPECT',
      productIsActive: Boolean(listing.product_active),
      title: (listing.title as string) ?? null,
      description: (listing.description as string) ?? null,
      marketplaceCategoryId: (listing.category as string) ?? null,
      condition: (listing.condition as string) ?? null,
      variants: variants.map((v) => ({
        sku: (v.sku as string) ?? null,
        priceMinor: (v.price_minor as string) ?? null,
        stockQty: (v.stock_qty as number) ?? null,
        allowPreorder: Boolean(v.allow_preorder),
        weightGram: (v.weight_gram as number) ?? null,
        lengthMm: (v.length_mm as number) ?? null,
        widthMm: (v.width_mm as number) ?? null,
        heightMm: (v.height_mm as number) ?? null,
      })),
      media: media.map((m) => ({
        id: m.id as string,
        isActive: Boolean(m.is_active),
        isPrimary: Boolean(m.is_primary),
        moderationStatus: (m.moderation_status as string) ?? 'PENDING',
      })),
      shippingOriginRef: store?.shippingOriginRef ?? null,
      returnPolicyPublished: Boolean(store?.policies.length),
      taxCategoryId: (listing.tax_category as string) ?? null,
      complianceStatus: (listing.compliance_status as string) ?? null,
      youtubeVideoId: (listing.youtube_video_id as string) ?? null,
    };
  }

  async load(actor: ListingActor, listingId: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      actor.schemaName,
      `SELECT l.id::text, l.code, l.title, l.description, l.status, l.condition,
              l.youtube_video_id, l.published_at, l.gate_checked_at, l.gate_snapshot,
              p.code AS product_code, p.name AS product_name
         FROM online_listing l
         JOIN product p ON p.id = l.product_id
        WHERE l.id = $1 AND l.deleted_at IS NULL`,
      [listingId],
    );
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Listing tidak ditemukan.');
    return this.attachChildren(actor.schemaName, rows[0]);
  }

  async list(actor: ListingActor, status?: string) {
    return this.tenantDb.query<Record<string, unknown>>(
      actor.schemaName,
      `SELECT l.id::text, l.code, l.title, l.status, l.published_at,
              p.code AS product_code, p.name AS product_name,
              (SELECT count(*) FROM online_listing_media m
                WHERE m.listing_id = l.id AND m.is_active AND m.deleted_at IS NULL) AS image_count
         FROM online_listing l
         JOIN product p ON p.id = l.product_id
        WHERE l.deleted_at IS NULL ${status ? 'AND l.status = $1' : ''}
        ORDER BY l.updated_at DESC LIMIT 200`,
      status ? [status] : [],
    );
  }

  private async attachChildren(schemaName: string, listing: Record<string, unknown>) {
    const listingId = listing.id as string;
    const [variants, media] = await Promise.all([
      this.tenantDb.query(
        schemaName,
        `SELECT id::text, sku, variant_name, price_minor::text AS price_minor,
                stock_qty::text AS stock_qty, allow_preorder, weight_gram,
                length_mm, width_mm, height_mm
           FROM online_listing_variant
          WHERE listing_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
        [listingId],
      ),
      this.tenantDb.query(
        schemaName,
        `SELECT m.id::text, m.image_format, m.width_px, m.height_px, m.alt_text,
                m.is_primary, m.is_active, m.moderation_status, m.sort_order,
                f.storage_key, f.mime_type, f.size_bytes::text AS size_bytes
           FROM online_listing_media m
           JOIN file_object f ON f.id = m.file_object_id
          WHERE m.listing_id = $1 AND m.deleted_at IS NULL ORDER BY m.sort_order`,
        [listingId],
      ),
    ]);
    return { ...listing, variants, media };
  }

  private async loadInTransaction(
    client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
    schemaName: string,
    listingId: string,
  ) {
    const result = await client.query(
      `SELECT id::text, code, title, status FROM "${schemaName}".online_listing WHERE id = $1`,
      [listingId],
    );
    return result.rows[0];
  }

  /** Benar bila listing masih boleh diubah isinya. */
  static isEditable(status: string): boolean {
    return EDITABLE_STATUSES.has(status);
  }
}
