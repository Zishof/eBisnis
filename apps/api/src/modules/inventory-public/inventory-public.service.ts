import { Injectable } from '@nestjs/common';
import { ProductMediaService, type ProductMediaFile } from '../../infrastructure/files/product-media.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { quoteIdentifier } from '../../infrastructure/database/schema-name.util';
import { PublicTenantResolver } from '../../infrastructure/tenant/public-tenant-resolver.service';

interface CatalogRow {
  id: string;
  code: string;
  sku: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category: string;
  uom: string;
  available_qty: string;
  total_count: string;
}

@Injectable()
export class InventoryPublicService {
  constructor(
    private readonly resolver: PublicTenantResolver,
    private readonly db: TenantConnectionService,
    private readonly media: ProductMediaService,
  ) {}

  async catalog(host: string | undefined, input: { q?: string; category?: string; page: number; limit: number }) {
    const tenant = await this.resolver.resolve(host, 'inventory');
    const S = quoteIdentifier(tenant.schemaName);
    const q = input.q?.trim().slice(0, 100) || null;
    const category = input.category?.trim().slice(0, 100) || null;
    const offset = (input.page - 1) * input.limit;

    const [rows, categories, summary] = await Promise.all([
      this.db.query<CatalogRow>(
        tenant.schemaName,
        `SELECT p.id::text, p.code, p.sku, p.barcode, p.name, p.description,
                pc.name AS category, u.code AS uom,
                COALESCE(stock.available_qty, 0)::text AS available_qty,
                count(*) OVER()::text AS total_count
           FROM ${S}.product p
           JOIN ${S}.product_category pc ON pc.id = p.category_id
           JOIN ${S}.uom u ON u.id = p.base_uom_id
           LEFT JOIN LATERAL (
             SELECT sum(sb.available_qty) AS available_qty
               FROM ${S}.stock_balance sb WHERE sb.product_id = p.id
           ) stock ON TRUE
          WHERE p.deleted_at IS NULL AND p.is_active AND p.is_sellable
            AND ($1::text IS NULL OR p.name ILIKE '%' || $1 || '%'
              OR p.code ILIKE '%' || $1 || '%' OR p.sku ILIKE '%' || $1 || '%'
              OR COALESCE(p.barcode, '') ILIKE '%' || $1 || '%')
            AND ($2::text IS NULL OR pc.name = $2)
          ORDER BY CASE WHEN COALESCE(stock.available_qty, 0) > 0 THEN 0 ELSE 1 END,
                   p.sort_order, p.name
          LIMIT $3 OFFSET $4`,
        [q, category, input.limit, offset],
      ),
      this.db.query<{ name: string; count: string }>(
        tenant.schemaName,
        `SELECT pc.name, count(*)::text AS count
           FROM ${S}.product p JOIN ${S}.product_category pc ON pc.id = p.category_id
          WHERE p.deleted_at IS NULL AND p.is_active AND p.is_sellable
          GROUP BY pc.id, pc.name ORDER BY pc.name`,
      ),
      this.db.queryOne<{ products: string; available: string }>(
        tenant.schemaName,
        `SELECT count(*)::text AS products,
                count(*) FILTER (WHERE COALESCE(stock.available_qty, 0) > 0)::text AS available
           FROM ${S}.product p
           LEFT JOIN LATERAL (
             SELECT sum(sb.available_qty) AS available_qty
               FROM ${S}.stock_balance sb WHERE sb.product_id = p.id
           ) stock ON TRUE
          WHERE p.deleted_at IS NULL AND p.is_active AND p.is_sellable`,
      ),
    ]);

    const total = Number(rows[0]?.total_count ?? 0);
    return {
      tenant: { host: tenant.host },
      products: rows.map(({ total_count: _total, available_qty, ...row }) => ({
        ...row,
        available: Number(available_qty) > 0,
        imageUrl: `/api/v1/inventory/public/products/${row.id}/image`,
      })),
      categories: categories.map((item) => ({ name: item.name, count: Number(item.count) })),
      summary: { products: Number(summary?.products ?? 0), available: Number(summary?.available ?? 0) },
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.limit)),
      },
    };
  }

  async image(host: string | undefined, productId: string): Promise<ProductMediaFile> {
    const tenant = await this.resolver.resolve(host, 'inventory');
    return this.media.getProductImage(tenant.schemaName, productId);
  }
}
