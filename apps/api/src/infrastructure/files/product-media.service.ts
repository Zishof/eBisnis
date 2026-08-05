import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { quoteIdentifier } from '../database/schema-name.util';
import { TenantFileBlobService } from './tenant-file-blob.service';

export interface ProductMediaFile {
  mimeType: string;
  buffer: Buffer;
  etag: string;
  altText: string;
}

interface ProductRow {
  id: string;
  code: string;
  name: string;
  barcode: string | null;
  override_file_code: string | null;
  alt_text: string | null;
}

interface SharedMediaRow {
  identity_id: string;
  mime_type: string;
  content: Buffer;
  content_hash: string;
}

interface CuratedImage {
  matches: string[];
  url: string;
  attribution: string;
}

// Hanya URL produsen resmi yang boleh diunduh oleh peladen. Daftar tetap ini
// menghindari SSRF dan memberi packshot asli untuk produk fast-moving CMN.
const CURATED_IMAGES: CuratedImage[] = [
  {
    matches: ['BODREX EXTRA'],
    url: 'https://www.bodrex.com/public/images/product/1225-product-bodrex-extra.png',
    attribution: 'Tempo Scan - bodrex.com',
  },
  {
    matches: ['BODREX'],
    url: 'https://www.bodrex.com/public/images/product/1225-product-bodrex-rev.png',
    attribution: 'Tempo Scan - bodrex.com',
  },
  {
    matches: ['PARAMEX'],
    url: 'https://www.konimex.com/0_repository/images/20200811022726packshot-paramex-sakitkepala-web-10082020.png',
    attribution: 'Konimex - konimex.com',
  },
  {
    matches: ['KONIDIN'],
    url: 'https://www.konimex.com/0_repository/images/20210901043138packshot-konidin-saset.png',
    attribution: 'Konimex - konimex.com',
  },
  {
    matches: ['MIXAGRIP FLU BATUK'],
    url: 'https://kalbeconsumerhealth-web.s3.ap-southeast-1.amazonaws.com/assets/media/1639548786887-155639284-mixagrip-flu-batuk-packshot.png',
    attribution: 'Kalbe Consumer Health',
  },
  {
    matches: ['MIXAGRIP'],
    url: 'https://kalbeconsumerhealth-web.s3.ap-southeast-1.amazonaws.com/assets/media/1639548608308-587943379-mixagrip-flu-packshot.png',
    attribution: 'Kalbe Consumer Health',
  },
  {
    matches: ['TOLAK ANGIN'],
    url: 'https://www.sidomuncul.co.id/assets/images/product/produk-tolak-angin.png',
    attribution: 'Sido Muncul - sidomuncul.co.id',
  },
];

export function normalizeProductIdentity(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function identityFor(product: Pick<ProductRow, 'barcode' | 'code' | 'name'>) {
  const barcode = normalizeProductIdentity(product.barcode).replace(/\s/g, '');
  const code = normalizeProductIdentity(product.code).replace(/\s/g, '');
  const name = normalizeProductIdentity(product.name);
  if (barcode.length >= 6) return { key: `BARCODE:${barcode}`, basis: 'BARCODE', barcode, code, name };
  if (name) return { key: `NAME:${name}`, basis: 'NAME', barcode: null, code, name };
  return { key: `CODE:${code}`, basis: 'CODE', barcode: null, code, name: code };
}

function xml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}

export function productPlaceholder(name: string, code: string): Buffer {
  const safeName = xml(name.slice(0, 38));
  const safeCode = xml(code.slice(0, 28));
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="540" viewBox="0 0 720 540">` +
      `<rect width="720" height="540" fill="#f8fafc"/>` +
      `<rect x="46" y="46" width="628" height="448" rx="22" fill="#ffffff" stroke="#dbe4ea" stroke-width="3"/>` +
      `<circle cx="360" cy="205" r="86" fill="#dff7f1"/>` +
      `<path d="M320 205h80M360 165v80" stroke="#087f72" stroke-width="22" stroke-linecap="round"/>` +
      `<text x="360" y="345" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#10213a">${safeName}</text>` +
      `<text x="360" y="392" text-anchor="middle" font-family="Arial,sans-serif" font-size="21" fill="#52647a">${safeCode}</text>` +
      `<text x="360" y="448" text-anchor="middle" font-family="Arial,sans-serif" font-size="17" fill="#087f72">Caruban Medika Nusantara</text>` +
      `</svg>`,
    'utf8',
  );
}

@Injectable()
export class ProductMediaService {
  private readonly logger = new Logger(ProductMediaService.name);

  constructor(
    private readonly db: TenantConnectionService,
    private readonly tenantBlob: TenantFileBlobService,
  ) {}

  async getProductImage(schemaName: string, productId: string): Promise<ProductMediaFile> {
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw this.notFound();
    const S = quoteIdentifier(schemaName);
    const product = await this.db.queryOne<ProductRow>(
      schemaName,
      `SELECT p.id::text, p.code, p.name, p.barcode,
              b.override_file_code, b.alt_text
         FROM ${S}.product p
         LEFT JOIN ${S}.product_media_binding b ON b.product_id = p.id
        WHERE p.id = $1::uuid AND p.deleted_at IS NULL AND p.is_active`,
      [productId],
    );
    if (!product) throw this.notFound();

    if (product.override_file_code) {
      const override = await this.tenantBlob.ambilByCode(schemaName, product.override_file_code);
      if (override) {
        return {
          mimeType: override.mimeType,
          buffer: override.buffer,
          etag: createHash('sha256').update(override.buffer).digest('hex'),
          altText: product.alt_text ?? product.name,
        };
      }
    }

    const shared = await this.ensureSharedMedia(schemaName, product);
    return {
      mimeType: shared.mime_type,
      buffer: shared.content,
      etag: shared.content_hash,
      altText: product.alt_text ?? product.name,
    };
  }

  async saveTenantOverride(
    schemaName: string,
    productId: string,
    file: { filename: string; mimeType: string; buffer: Buffer },
    actorUserId: string,
  ): Promise<{ productId: string; imageUrl: string }> {
    if (!/^[0-9a-f-]{36}$/i.test(productId)) throw this.notFound();
    const S = quoteIdentifier(schemaName);
    const product = await this.db.queryOne<{ id: string; name: string }>(
      schemaName,
      `SELECT id::text, name FROM ${S}.product WHERE id = $1::uuid AND deleted_at IS NULL`,
      [productId],
    );
    if (!product) throw this.notFound();
    const fileCode = `PRODUCT_IMAGE_${productId}`;
    await this.tenantBlob.simpanTunggal(
      schemaName,
      {
        code: fileCode,
        name: `Gambar produk ${product.name}`,
        filename: file.filename,
        mimeType: file.mimeType,
        buffer: file.buffer,
      },
      actorUserId,
    );
    await this.db.query(
      schemaName,
      `INSERT INTO ${S}.product_media_binding
         (product_id, override_file_code, alt_text, is_manual_override, updated_by)
       VALUES ($1::uuid, $2, $3, TRUE, $4::uuid)
       ON CONFLICT (product_id) DO UPDATE SET
         override_file_code = EXCLUDED.override_file_code,
         alt_text = EXCLUDED.alt_text,
         is_manual_override = TRUE,
         updated_at = now(),
         updated_by = EXCLUDED.updated_by`,
      [productId, fileCode, product.name, actorUserId],
    );
    return { productId, imageUrl: `/api/v1/inventory/public/products/${productId}/image` };
  }

  private async ensureSharedMedia(schemaName: string, product: ProductRow): Promise<SharedMediaRow> {
    const identity = identityFor(product);
    const existing = await this.db.queryAdmin<SharedMediaRow>(
      `SELECT i.id::text AS identity_id, b.mime_type, b.content, b.content_hash
         FROM platform.product_media_identity i
         JOIN platform.product_media_blob b ON b.id = i.media_blob_id
        WHERE i.canonical_key = $1
           OR ($2::text IS NOT NULL AND i.normalized_barcode = $2)
           OR i.normalized_name = $3
           OR ($4::text IS NOT NULL AND i.normalized_code = $4)
        ORDER BY CASE
          WHEN i.canonical_key = $1 THEN 0
          WHEN $2::text IS NOT NULL AND i.normalized_barcode = $2 THEN 1
          WHEN i.normalized_name = $3 THEN 2
          ELSE 3
        END
        LIMIT 1`,
      [identity.key, identity.barcode, identity.name, identity.code || null],
    );
    if (existing[0]) {
      await this.bind(schemaName, product.id, existing[0].identity_id, identity.basis, product.name);
      return existing[0];
    }

    const downloaded = await this.downloadCurated(identity.name);
    const buffer = downloaded?.buffer ?? productPlaceholder(product.name, product.code);
    const mimeType = downloaded?.mimeType ?? 'image/svg+xml';
    const hash = createHash('sha256').update(buffer).digest('hex');
    const rows = await this.db.queryAdmin<SharedMediaRow>(
      `WITH media AS (
         INSERT INTO platform.product_media_blob
           (content_hash, mime_type, content, size_bytes, width, height, source_url, source_attribution)
         VALUES ($1, $2, $3::bytea, $4, $5, $6, $7, $8)
         ON CONFLICT (content_hash) DO UPDATE SET updated_at = now()
         RETURNING id, mime_type, content, content_hash
       ), identity AS (
         INSERT INTO platform.product_media_identity
           (canonical_key, normalized_barcode, normalized_code, normalized_name, media_blob_id, match_basis)
         SELECT $9, $10, $11, $12, id, $13 FROM media
         ON CONFLICT (canonical_key) DO UPDATE SET updated_at = now()
         RETURNING id, media_blob_id
       )
       SELECT i.id::text AS identity_id, b.mime_type, b.content, b.content_hash
         FROM identity i JOIN platform.product_media_blob b ON b.id = i.media_blob_id`,
      [
        hash,
        mimeType,
        buffer,
        buffer.length,
        downloaded ? null : 720,
        downloaded ? null : 540,
        downloaded?.source.url ?? null,
        downloaded?.source.attribution ?? 'Generated catalog placeholder',
        identity.key,
        identity.barcode,
        identity.code || null,
        identity.name,
        identity.basis,
      ],
    );
    await this.bind(schemaName, product.id, rows[0].identity_id, identity.basis, product.name);
    return rows[0];
  }

  private async bind(schemaName: string, productId: string, identityId: string, basis: string, name: string) {
    const S = quoteIdentifier(schemaName);
    await this.db.query(
      schemaName,
      `INSERT INTO ${S}.product_media_binding
         (product_id, shared_media_identity_id, alt_text, match_basis)
       VALUES ($1::uuid, $2::uuid, $3, $4)
       ON CONFLICT (product_id) DO UPDATE SET
         shared_media_identity_id = CASE WHEN ${S}.product_media_binding.is_manual_override
           THEN ${S}.product_media_binding.shared_media_identity_id ELSE EXCLUDED.shared_media_identity_id END,
         alt_text = COALESCE(${S}.product_media_binding.alt_text, EXCLUDED.alt_text),
         match_basis = CASE WHEN ${S}.product_media_binding.is_manual_override
           THEN ${S}.product_media_binding.match_basis ELSE EXCLUDED.match_basis END,
         updated_at = now()`,
      [productId, identityId, name, basis],
    );
  }

  private async downloadCurated(normalizedName: string) {
    const source = CURATED_IMAGES.find((candidate) => candidate.matches.includes(normalizedName));
    if (!source) return null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      const response = await globalThis.fetch(source.url, { signal: controller.signal });
      clearTimeout(timeout);
      const mimeType = response.headers.get('content-type')?.split(';')[0] ?? '';
      if (!response.ok || !mimeType.startsWith('image/')) return null;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
      return { source, mimeType, buffer };
    } catch (error) {
      this.logger.warn(`Packshot resmi gagal diambil untuk ${normalizedName}: ${String(error)}`);
      return null;
    }
  }

  private notFound() {
    return AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar produk tidak ditemukan.');
  }
}
