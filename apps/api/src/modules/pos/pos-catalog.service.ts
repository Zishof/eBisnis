/**
 * Katalog kasir: pencarian produk, pemindaian barcode, dan kuotasi harga.
 *
 * Layanan ini hanya mengambil data dan menyerahkannya kepada `pos-pricing.ts`.
 * Perhitungannya sendiri tidak ada di sini dengan sengaja — supaya aturan harga
 * dapat diuji tanpa basis data, dan supaya tidak ada dua tempat yang menghitung
 * hal yang sama dengan cara yang sedikit berbeda.
 *
 * **Harga selalu ditentukan peladen.** Tidak ada satu pun jalan pada modul ini
 * yang menerima harga dari peramban lalu memakainya apa adanya; `priceOverride`
 * pun tetap melalui perhitungan, tetap dibulatkan, dan selalu menandai transaksi
 * sebagai memerlukan persetujuan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  cariBarcode,
  hitungBaris,
  type BarisBukuHarga,
  type DiskonTerpakai,
  type HasilKuotasi,
  type TarifPajak,
} from './pos-pricing';
import { tanggalUsaha } from './pos-context';

export interface ProdukKasir {
  productId: string;
  code: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  uomId: string;
  uomCode: string;
  categoryId: string | null;
  categoryName: string | null;
  taxCategoryId: string | null;
  trackingType: string;
  allowNegativeStock: boolean;
  defaultSalePrice: string | null;
  imageFileId: string | null;
}

export interface PermintaanKuotasiApi {
  outletId: string;
  productId: string;
  uomId?: string;
  quantity: number;
  customerId?: string | null;
  brandId?: string | null;
  priceOverride?: number | null;
  manualDiscount?: { type: 'PERCENT' | 'AMOUNT'; value: number; label?: string } | null;
  at?: string;
}

@Injectable()
export class PosCatalogService {
  private readonly logger = new Logger(PosCatalogService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Pencarian produk untuk layar kasir.
   *
   * Mencari pada nama, kode, SKU, dan barcode sekaligus. Kasir mengetik apa saja
   * yang diingatnya, dan tidak seharusnya perlu memilih dahulu "cari menurut apa".
   */
  async cariProduk(
    schemaName: string,
    kueri: string,
    opsi: { categoryId?: string; limit?: number } = {},
  ): Promise<ProdukKasir[]> {
    const limit = Math.min(Math.max(opsi.limit ?? 30, 1), 100);
    const teks = kueri.trim();

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT p.id, p.code, p.name, p.sku, p.barcode, p.category_id, p.tax_category_id,
              p.tracking_type, p.allow_negative_stock, p.default_sale_price::text AS default_sale_price,
              p.base_uom_id AS uom_id, u.code AS uom_code,
              c.name AS category_name
         FROM "${schemaName}".product p
         JOIN "${schemaName}".uom u ON u.id = p.base_uom_id
    LEFT JOIN "${schemaName}".product_category c ON c.id = p.category_id
        WHERE p.deleted_at IS NULL
          AND p.is_active = TRUE
          AND p.is_sellable = TRUE
          AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
          AND (
            $1::text = ''
            OR p.name ILIKE '%' || $1::text || '%'
            OR p.code ILIKE $1::text || '%'
            OR p.sku ILIKE $1::text || '%'
            OR p.barcode = $1::text
            OR EXISTS (
              SELECT 1 FROM "${schemaName}".product_barcode b
               WHERE b.product_id = p.id AND b.barcode = $1::text
                 AND b.deleted_at IS NULL AND b.is_active = TRUE
            )
          )
        ORDER BY
          -- Kecocokan persis didahulukan: kasir yang mengetik kode lengkap
          -- ingin barang itu, bukan daftar barang yang namanya mirip.
          (p.code = $1::text OR p.sku = $1::text OR p.barcode = $1::text) DESC,
          p.name
        LIMIT $3`,
      [teks, opsi.categoryId ?? null, limit],
    );

    return rows.map((r) => this.petakanProduk(r));
  }

  /** Pencarian menurut barcode; utama maupun alternatif. */
  async produkDariBarcode(schemaName: string, barcode: string): Promise<ProdukKasir | null> {
    const bersih = barcode.trim();
    if (!bersih) return null;

    const rows = await this.tenantDb.query<{
      product_id: string;
      uom_id: string;
      barcode: string;
      is_primary: boolean;
      is_active: boolean;
    }>(
      schemaName,
      `SELECT product_id, uom_id, barcode, is_primary, is_active
         FROM "${schemaName}".product_barcode
        WHERE barcode = $1 AND deleted_at IS NULL
        UNION ALL
       SELECT id AS product_id, base_uom_id AS uom_id, barcode, TRUE AS is_primary, is_active
         FROM "${schemaName}".product
        WHERE barcode = $1 AND deleted_at IS NULL`,
      [bersih],
    );

    const cocok = cariBarcode(
      rows.map((r) => ({
        productId: r.product_id,
        uomId: r.uom_id,
        barcode: r.barcode,
        isPrimary: r.is_primary,
        isActive: r.is_active,
      })),
      bersih,
    );
    if (!cocok) return null;

    const produk = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT p.id, p.code, p.name, p.sku, p.barcode, p.category_id, p.tax_category_id,
              p.tracking_type, p.allow_negative_stock, p.default_sale_price::text AS default_sale_price,
              $2::uuid AS uom_id, u.code AS uom_code, c.name AS category_name
         FROM "${schemaName}".product p
         JOIN "${schemaName}".uom u ON u.id = $2::uuid
    LEFT JOIN "${schemaName}".product_category c ON c.id = p.category_id
        WHERE p.id = $1 AND p.deleted_at IS NULL AND p.is_active = TRUE AND p.is_sellable = TRUE`,
      [cocok.productId, cocok.uomId],
    );

    return produk.length ? this.petakanProduk(produk[0]) : null;
  }

  /**
   * Kuotasi harga otoritatif.
   *
   * Inilah satu-satunya sumber harga yang sah pada jalur kasir. Peramban boleh
   * menampilkan hasilnya; peramban tidak pernah menentukannya.
   */
  async kuotasi(
    schemaName: string,
    req: PermintaanKuotasiApi,
  ): Promise<HasilKuotasi & { productName: string }> {
    if (!Number.isFinite(req.quantity) || req.quantity <= 0) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jumlah harus lebih besar dari nol.');
    }

    const produk = await this.tenantDb.query<{
      id: string;
      name: string;
      base_uom_id: string;
      tax_category_id: string | null;
      default_sale_price: string | null;
    }>(
      schemaName,
      `SELECT id, name, base_uom_id, tax_category_id, default_sale_price::text
         FROM "${schemaName}".product
        WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE AND is_sellable = TRUE`,
      [req.productId],
    );
    if (!produk.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Produk tidak ditemukan, sudah nonaktif, atau tidak untuk dijual.',
      );
    }
    const p = produk[0];
    const uomId = req.uomId ?? p.base_uom_id;

    const outlet = await this.tenantDb.query<{ timezone: string | null; brand_id: string | null }>(
      schemaName,
      `SELECT timezone, brand_id FROM "${schemaName}".outlet
        WHERE id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [req.outletId],
    );
    if (!outlet.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Outlet tidak ditemukan atau tidak aktif.');
    }

    const setelan = await this.setelanPos(schemaName);
    const saat = req.at ? new Date(req.at) : new Date();
    const businessDate = tanggalUsaha(
      saat,
      outlet[0].timezone ?? setelan.timezone,
      setelan.cutoverHour,
    );

    const [priceBookLines, taxRates] = await Promise.all([
      this.bukuHarga(schemaName, {
        productId: req.productId,
        uomId,
        outletId: req.outletId,
        brandId: req.brandId ?? outlet[0].brand_id,
        customerId: req.customerId ?? null,
        businessDate,
      }),
      this.tarifPajak(schemaName, p.tax_category_id),
    ]);

    // Harga jual bawaan produk dipakai sebagai jaring pengaman terakhir, dengan
    // prioritas paling rendah, supaya produk yang belum masuk buku harga tetap
    // dapat dijual alih-alih menghentikan antrean kasir.
    /*
     * `Number(...) > 0`, bukan sekadar kebenaran nilainya. `default_sale_price`
     * dikembalikan sebagai teks, dan teks "0" bernilai benar dalam JavaScript —
     * sehingga produk berharga nol akan terbaca sebagai produk yang berharga,
     * peringatan NO_PRICE tidak muncul, dan barang terjual gratis tanpa satu pun
     * tanda pada layar kasir.
     */
    if (!priceBookLines.length && Number(p.default_sale_price ?? 0) > 0) {
      priceBookLines.push({
        priceBookId: 'DEFAULT_SALE_PRICE',
        priceBookItemId: 'DEFAULT',
        productId: req.productId,
        uomId,
        price: Number(p.default_sale_price),
        minimumQty: 1,
        validFrom: null,
        validUntil: null,
        priority: 9999,
        scopeType: 'TENANT',
      });
    }

    const discounts: DiskonTerpakai[] = [];
    if (req.manualDiscount && req.manualDiscount.value > 0) {
      discounts.push({
        sourceType: 'MANUAL_LINE',
        sourceId: null,
        label: req.manualDiscount.label ?? 'Diskon manual',
        discountType: req.manualDiscount.type,
        discountValue: req.manualDiscount.value,
      });
    }
    discounts.push(
      ...(await this.promosiBerlaku(schemaName, {
        productId: req.productId,
        outletId: req.outletId,
        brandId: req.brandId ?? outlet[0].brand_id,
        quantity: req.quantity,
        saat,
      })),
    );

    const hasil = hitungBaris({
      productId: req.productId,
      uomId,
      quantity: req.quantity,
      currencyCode: setelan.currency,
      businessDate,
      priceBookLines,
      taxRates,
      discounts,
      priceOverride: req.priceOverride ?? null,
      discountApprovalPct: setelan.discountApprovalPct,
    });

    return { ...hasil, productName: p.name };
  }

  // --- Pengambilan data ------------------------------------------------------

  private async bukuHarga(
    schemaName: string,
    ctx: {
      productId: string;
      uomId: string;
      outletId: string;
      brandId: string | null;
      customerId: string | null;
      businessDate: string;
    },
  ): Promise<BarisBukuHarga[]> {
    const rows = await this.tenantDb.query<{
      price_book_id: string;
      price_book_item_id: string;
      product_id: string;
      uom_id: string;
      price: string;
      minimum_qty: string;
      valid_from: string | null;
      valid_until: string | null;
      priority: number;
      scope_type: string;
    }>(
      schemaName,
      `SELECT pb.id AS price_book_id,
              pbi.id AS price_book_item_id,
              pbi.product_id,
              pbi.uom_id,
              pbi.price::text,
              pbi.minimum_qty::text,
              to_char(GREATEST(
                COALESCE(pbi.valid_from, DATE '1900-01-01'),
                COALESCE(pb.valid_from, DATE '1900-01-01'),
                COALESCE(a.valid_from, DATE '1900-01-01')
              ), 'YYYY-MM-DD') AS valid_from,
              to_char(LEAST(
                COALESCE(pbi.valid_until, DATE '9999-12-31'),
                COALESCE(pb.valid_until, DATE '9999-12-31'),
                COALESCE(a.valid_until, DATE '9999-12-31')
              ), 'YYYY-MM-DD') AS valid_until,
              COALESCE(a.priority, 1000) AS priority,
              COALESCE(a.scope_type, 'TENANT') AS scope_type
         FROM "${schemaName}".price_book_item pbi
         JOIN "${schemaName}".price_book pb ON pb.id = pbi.price_book_id
    LEFT JOIN "${schemaName}".pos_price_book_assignment a
           ON a.price_book_id = pb.id
          AND a.deleted_at IS NULL
          AND a.is_active = TRUE
          AND (
            a.scope_type = 'TENANT'
            OR (a.scope_type = 'OUTLET' AND a.scope_id = $3::uuid)
            OR (a.scope_type = 'BRAND' AND a.scope_id = $4::uuid)
          )
        WHERE pbi.product_id = $1
          AND pbi.uom_id = $2
          AND pbi.deleted_at IS NULL
          AND pbi.is_active = TRUE
          AND pb.deleted_at IS NULL
          AND pb.is_active = TRUE`,
      [ctx.productId, ctx.uomId, ctx.outletId, ctx.brandId],
    );

    return rows.map((r) => ({
      priceBookId: r.price_book_id,
      priceBookItemId: r.price_book_item_id,
      productId: r.product_id,
      uomId: r.uom_id,
      price: Number(r.price),
      minimumQty: Number(r.minimum_qty),
      validFrom: r.valid_from === '1900-01-01' ? null : r.valid_from,
      validUntil: r.valid_until === '9999-12-31' ? null : r.valid_until,
      priority: Number(r.priority),
      scopeType: r.scope_type as BarisBukuHarga['scopeType'],
    }));
  }

  private async tarifPajak(
    schemaName: string,
    taxCategoryId: string | null,
  ): Promise<TarifPajak[]> {
    if (!taxCategoryId) return [];
    const rows = await this.tenantDb.query<{
      id: string;
      code: string;
      rate: string;
      is_inclusive: boolean;
      effective_from: string | null;
      effective_until: string | null;
    }>(
      schemaName,
      `SELECT id, code, rate::text, is_inclusive,
              to_char(effective_from, 'YYYY-MM-DD') AS effective_from,
              to_char(effective_until, 'YYYY-MM-DD') AS effective_until
         FROM "${schemaName}".tax_rate
        WHERE tax_category_id = $1 AND deleted_at IS NULL AND is_active = TRUE
        ORDER BY sort_order, code`,
      [taxCategoryId],
    );
    return rows.map((r) => ({
      taxRateId: r.id,
      code: r.code,
      rate: Number(r.rate),
      isInclusive: r.is_inclusive,
      effectiveFrom: r.effective_from,
      effectiveUntil: r.effective_until,
    }));
  }

  private async promosiBerlaku(
    schemaName: string,
    ctx: {
      productId: string;
      outletId: string;
      brandId: string | null;
      quantity: number;
      saat: Date;
    },
  ): Promise<DiskonTerpakai[]> {
    const ada = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT count(*)::text AS n FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = 'pos_promotion'`,
      [schemaName],
    );
    if (Number(ada[0]?.n ?? '0') === 0) return [];

    const rows = await this.tenantDb.query<{
      id: string;
      name: string;
      benefit_type: string;
      benefit_value: string;
      max_discount_amount: string | null;
      requires_approval: boolean;
    }>(
      schemaName,
      `SELECT pr.id, pr.name, pr.benefit_type, pr.benefit_value::text,
              pr.max_discount_amount::text, pr.requires_approval
         FROM "${schemaName}".pos_promotion pr
        WHERE pr.deleted_at IS NULL
          AND pr.is_active = TRUE
          AND (pr.valid_from IS NULL OR pr.valid_from <= $1)
          AND (pr.valid_until IS NULL OR pr.valid_until >= $1)
          AND (pr.valid_time_from IS NULL OR pr.valid_time_from <= $1::time)
          AND (pr.valid_time_to IS NULL OR pr.valid_time_to >= $1::time)
          AND (pr.valid_days IS NULL OR EXTRACT(ISODOW FROM $1::timestamptz)::smallint = ANY(pr.valid_days))
          AND (pr.usage_limit IS NULL OR pr.usage_count < pr.usage_limit)
          AND (pr.minimum_quantity IS NULL OR pr.minimum_quantity <= $4)
          AND (
            pr.scope_type = 'TENANT'
            OR (pr.scope_type = 'OUTLET' AND pr.scope_id = $2::uuid)
            OR (pr.scope_type = 'BRAND' AND pr.scope_id = $3::uuid)
          )
          -- Promosi tanpa daftar produk berlaku untuk semua; yang punya daftar
          -- hanya berlaku bila produk ini termasuk dan tidak dikecualikan.
          AND (
            NOT EXISTS (SELECT 1 FROM "${schemaName}".pos_promotion_product pp
                         WHERE pp.pos_promotion_id = pr.id AND pp.is_exclusion = FALSE)
            OR EXISTS (
              SELECT 1 FROM "${schemaName}".pos_promotion_product pp
               LEFT JOIN "${schemaName}".product prod ON prod.id = $5::uuid
               WHERE pp.pos_promotion_id = pr.id
                 AND pp.is_exclusion = FALSE
                 AND (pp.product_id = $5::uuid OR pp.product_category_id = prod.category_id)
            )
          )
          AND NOT EXISTS (
            SELECT 1 FROM "${schemaName}".pos_promotion_product pp
             LEFT JOIN "${schemaName}".product prod ON prod.id = $5::uuid
             WHERE pp.pos_promotion_id = pr.id
               AND pp.is_exclusion = TRUE
               AND (pp.product_id = $5::uuid OR pp.product_category_id = prod.category_id)
          )
        ORDER BY pr.priority, pr.created_at`,
      [ctx.saat.toISOString(), ctx.outletId, ctx.brandId, ctx.quantity, ctx.productId],
    );

    return rows.map((r) => ({
      sourceType: 'PROMOTION' as const,
      sourceId: r.id,
      label: r.name,
      discountType: r.benefit_type as 'PERCENT' | 'AMOUNT',
      discountValue: Number(r.benefit_value),
      maxAmount: r.max_discount_amount ? Number(r.max_discount_amount) : null,
      requiresApproval: r.requires_approval,
    }));
  }

  /** Setelan kasir tingkat tenant, dengan bawaan yang aman bila belum diatur. */
  async setelanPos(schemaName: string): Promise<{
    currency: string;
    timezone: string;
    discountApprovalPct: number;
    voidApprovalAmount: number;
    cashVarianceThreshold: number;
    allowNegativeStock: boolean;
    cutoverHour: number;
  }> {
    const rows = await this.tenantDb.query<{ code: string; value_json: unknown }>(
      schemaName,
      `SELECT code, value_json FROM "${schemaName}".app_setting
        WHERE code IN ('DEFAULT_CURRENCY','DEFAULT_TIMEZONE','POS_DISCOUNT_APPROVAL_PCT',
                       'POS_VOID_APPROVAL_AMOUNT','POS_CASH_VARIANCE_THRESHOLD',
                       'POS_ALLOW_NEGATIVE_STOCK','POS_BUSINESS_DAY_CUTOVER_HOUR')
          AND deleted_at IS NULL`,
    );
    const map = new Map<string, unknown>();
    for (const r of rows) {
      const v = r.value_json as { value?: unknown } | null;
      map.set(r.code, v?.value);
    }
    const angka = (k: string, bawaan: number) => {
      const v = Number(map.get(k));
      return Number.isFinite(v) ? v : bawaan;
    };
    return {
      currency: String(map.get('DEFAULT_CURRENCY') ?? 'IDR'),
      timezone: String(map.get('DEFAULT_TIMEZONE') ?? 'Asia/Jakarta'),
      discountApprovalPct: angka('POS_DISCOUNT_APPROVAL_PCT', 10),
      voidApprovalAmount: angka('POS_VOID_APPROVAL_AMOUNT', 0),
      cashVarianceThreshold: angka('POS_CASH_VARIANCE_THRESHOLD', 10000),
      allowNegativeStock: map.get('POS_ALLOW_NEGATIVE_STOCK') === true,
      cutoverHour: angka('POS_BUSINESS_DAY_CUTOVER_HOUR', 0),
    };
  }

  private petakanProduk(r: Record<string, unknown>): ProdukKasir {
    return {
      productId: String(r.id),
      code: String(r.code),
      name: String(r.name),
      sku: (r.sku as string) ?? null,
      barcode: (r.barcode as string) ?? null,
      uomId: String(r.uom_id),
      uomCode: String(r.uom_code),
      categoryId: (r.category_id as string) ?? null,
      categoryName: (r.category_name as string) ?? null,
      taxCategoryId: (r.tax_category_id as string) ?? null,
      trackingType: String(r.tracking_type ?? 'NONE'),
      allowNegativeStock: Boolean(r.allow_negative_stock),
      defaultSalePrice: (r.default_sale_price as string) ?? null,
      imageFileId: null,
    };
  }
}
