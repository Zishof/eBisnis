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
  pilihHarga,
  type BarisBukuHarga,
  type DiskonTerpakai,
  type HasilKuotasi,
  type TarifPajak,
} from './pos-pricing';
import { pilihPromosi, type BarisPromosi } from './pos-promotion';
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

/**
 * Berapa produk paling banyak yang disalin ke satu mesin kasir.
 *
 * Bukan batas basis data, melainkan batas yang wajar bagi peramban: lima ribu
 * baris muat dengan nyaman di IndexedDB dan dapat dicari seketika. Tenant yang
 * melewatinya tetap dilayani — jawabannya menandai `truncated`, dan layar wajib
 * mengatakannya kepada kasir.
 */
export const BATAS_SNAPSHOT_PRODUK = 5_000;

export interface ProdukSnapshot extends ProdukKasir {
  /** Barcode utama dan alternatif sekaligus. */
  barcodes: string[];
}

export interface SnapshotLuring {
  generatedAt: string;
  /**
   * Apakah tenant ini mengizinkan penjualan saat luring.
   *
   * Ikut ke dalam salinan, bukan hanya tersedia lewat jalan tersendiri: yang
   * membutuhkannya adalah mesin kasir yang justru sedang tidak dapat bertanya.
   */
  offlineSaleEnabled: boolean;
  currency: string;
  timezone: string;
  productCount: number;
  productTotal: number;
  /** Benar bila katalog lebih besar daripada yang muat disalin. */
  truncated: boolean;
  products: ProdukSnapshot[];
  taxRates: Array<{
    taxCategoryId: string;
    taxRateId: string;
    code: string;
    rate: number;
    isInclusive: boolean;
    effectiveFrom: string | null;
    effectiveUntil: string | null;
  }>;
  paymentMethods: Array<Record<string, unknown>>;
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
      // Dipakai memilih promosi yang menyasar kategori, bukan produk tunggal.
      category_id: string | null;
      default_sale_price: string | null;
    }>(
      schemaName,
      `SELECT id, name, base_uom_id, tax_category_id, category_id, default_sale_price::text
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
    /*
     * Nilai baris sebelum diskon, dihitung dari harga yang SAMA dengan yang akan
     * dipakai `hitungBaris` — lewat `pilihHarga` yang sama, bukan perhitungan
     * kedua yang cepat atau lambat akan berbeda darinya.
     *
     * Diperlukan untuk memeriksa `minimum_purchase`, yang sebelumnya tidak
     * pernah diperiksa sama sekali.
     */
    const hargaTerpilih = pilihHarga(priceBookLines, req.quantity, businessDate);
    const nilaiBaris = (hargaTerpilih?.price ?? 0) * req.quantity;

    discounts.push(
      ...(await this.promosiTerpakai(schemaName, {
        saat,
        timezone: setelan.timezone,
        outletId: req.outletId,
        brandId: req.brandId ?? outlet[0].brand_id,
        productId: req.productId,
        productCategoryId: p.category_id ?? null,
        quantity: req.quantity,
        lineSubtotal: nilaiBaris,
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

  /**
   * Promosi yang berlaku untuk satu baris.
   *
   * SQL-nya hanya MENGAMBIL kandidat; yang memutuskan berlaku atau tidak adalah
   * `pos-promotion.ts` yang murni dan teruji. Aturan yang memutuskan berapa uang
   * dilepas gerai tidak boleh hidup sebagai klausa WHERE yang hanya dapat
   * dibuktikan dengan menyiapkan basis data — sebab pada praktiknya ia lalu
   * tidak pernah dibuktikan sama sekali.
   */
  private async promosiTerpakai(
    schemaName: string,
    ctx: {
      saat: Date;
      timezone: string;
      outletId: string;
      brandId: string | null;
      productId: string;
      productCategoryId: string | null;
      quantity: number;
      lineSubtotal: number;
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
      minimum_purchase: string | null;
      minimum_quantity: string | null;
      scope_type: string;
      scope_id: string | null;
      valid_from: Date | null;
      valid_until: Date | null;
      valid_days: number[] | null;
      valid_time_from: string | null;
      valid_time_to: string | null;
      usage_limit: number | null;
      usage_count: number;
      requires_approval: boolean;
      priority: number;
      created_at: Date;
      target: { productId: string | null; productCategoryId: string | null; isExclusion: boolean }[] | null;
    }>(
      schemaName,
      `SELECT pr.id, pr.name, pr.benefit_type, pr.benefit_value::text,
              pr.max_discount_amount::text, pr.minimum_purchase::text,
              pr.minimum_quantity::text, pr.scope_type, pr.scope_id,
              pr.valid_from, pr.valid_until, pr.valid_days,
              pr.valid_time_from::text, pr.valid_time_to::text,
              pr.usage_limit, pr.usage_count, pr.requires_approval,
              pr.priority, pr.created_at,
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                          'productId', pp.product_id,
                          'productCategoryId', pp.product_category_id,
                          'isExclusion', pp.is_exclusion))
                   FROM "${schemaName}".pos_promotion_product pp
                  WHERE pp.pos_promotion_id = pr.id),
                '[]'::jsonb) AS target
         FROM "${schemaName}".pos_promotion pr
        WHERE pr.deleted_at IS NULL
          AND pr.is_active = TRUE`,
      [],
    );

    const baris: BarisPromosi[] = rows.map((r) => ({
      id: r.id,
      name: r.name,
      benefitType: r.benefit_type as 'PERCENT' | 'AMOUNT',
      benefitValue: Number(r.benefit_value),
      maxDiscountAmount: r.max_discount_amount === null ? null : Number(r.max_discount_amount),
      minimumPurchase: r.minimum_purchase === null ? null : Number(r.minimum_purchase),
      minimumQuantity: r.minimum_quantity === null ? null : Number(r.minimum_quantity),
      scopeType: r.scope_type,
      scopeId: r.scope_id,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      validDays: r.valid_days,
      validTimeFrom: r.valid_time_from,
      validTimeTo: r.valid_time_to,
      usageLimit: r.usage_limit,
      usageCount: r.usage_count,
      requiresApproval: r.requires_approval,
      priority: r.priority,
      createdAt: r.created_at,
      target: r.target ?? [],
    }));

    return pilihPromosi(baris, ctx);
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

  /**
   * Metode pembayaran yang aktif beserta perilakunya.
   *
   * `requiresReference` dan `allowsChange` dikirim ke layar kasir supaya
   * antarmuka tidak perlu menebak: kartu menuntut nomor rujukan, tunai memberi
   * kembalian. Menebaknya di peramban berarti aturannya tertulis dua kali dan
   * cepat atau lambat berbeda.
   */
  async metodePembayaran(schemaName: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, code, name, method_type AS "methodType",
              requires_reference AS "requiresReference",
              allows_change AS "allowsChange"
         FROM "${schemaName}".payment_method
        WHERE deleted_at IS NULL AND is_active = TRUE
        ORDER BY (method_type = 'CASH') DESC, sort_order, name`,
    );
    return rows;
  }

  /**
   * Salinan katalog untuk mesin kasir yang harus tetap melayani saat peladen
   * tidak terjangkau.
   *
   * ## Mengapa satu jalan, bukan menggabungkan jalan yang sudah ada
   *
   * `cariProduk` mengembalikan satu barcode utama per produk. Pemindai tidak
   * tahu bedanya antara barcode utama dan alternatif, jadi salinan lokal yang
   * hanya memuat yang utama akan menolak barang yang di peladen dikenali — dan
   * kasir tidak akan pernah tahu bahwa penyebabnya salinan, bukan barangnya.
   *
   * ## Batas, dan mengapa pemotongan diam-diam tidak boleh
   *
   * Katalog besar tidak dikirim seluruhnya. Tetapi memotongnya tanpa memberi
   * tahu jauh lebih buruk daripada menolak: kasir memindai, barangnya "tidak
   * ada", dan tidak ada apa pun pada layar yang menjelaskan bahwa katalognya
   * memang tidak lengkap. Karena itu jawaban selalu menyebutkan berapa yang
   * disalin dari berapa, dan layar wajib mengatakannya.
   */
  async snapshotLuring(
    schemaName: string,
    opsi: { limit?: number } = {},
  ): Promise<SnapshotLuring> {
    const limit = Math.min(Math.max(opsi.limit ?? BATAS_SNAPSHOT_PRODUK, 1), BATAS_SNAPSHOT_PRODUK);

    const [{ n }] = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT count(*)::text AS n
         FROM "${schemaName}".product
        WHERE deleted_at IS NULL AND is_active = TRUE AND is_sellable = TRUE`,
    );
    const total = Number(n ?? '0');

    const produk = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT p.id, p.code, p.name, p.sku,
              p.base_uom_id AS uom_id, u.code AS uom_code,
              p.category_id, c.name AS category_name,
              p.tax_category_id, p.tracking_type, p.allow_negative_stock,
              p.default_sale_price::text AS default_sale_price,
              -- Barcode utama dan alternatif digabung menjadi satu larik supaya
              -- pencarian luring memakai satu tempat, sebagaimana peladen.
              COALESCE(
                ARRAY(
                  SELECT DISTINCT b FROM unnest(
                    ARRAY[p.barcode] || COALESCE(
                      ARRAY(
                        SELECT pb.barcode FROM "${schemaName}".product_barcode pb
                         WHERE pb.product_id = p.id
                           AND pb.deleted_at IS NULL AND pb.is_active = TRUE
                      ), '{}'::text[]
                    )
                  ) AS b
                   WHERE b IS NOT NULL AND b <> ''
                ), '{}'::text[]
              ) AS barcodes
         FROM "${schemaName}".product p
         JOIN "${schemaName}".uom u ON u.id = p.base_uom_id
    LEFT JOIN "${schemaName}".product_category c ON c.id = p.category_id
        WHERE p.deleted_at IS NULL AND p.is_active = TRUE AND p.is_sellable = TRUE
        ORDER BY p.name
        LIMIT $1`,
      [limit],
    );

    const pajak = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT tax_category_id, id AS tax_rate_id, code, rate::text, is_inclusive,
              to_char(effective_from, 'YYYY-MM-DD') AS effective_from,
              to_char(effective_until, 'YYYY-MM-DD') AS effective_until
         FROM "${schemaName}".tax_rate
        WHERE deleted_at IS NULL AND is_active = TRUE
        ORDER BY tax_category_id, sort_order, code`,
    );

    const metode = await this.metodePembayaran(schemaName);
    const setelan = await this.setelanPos(schemaName);

    const saklar = await this.tenantDb.query<{ value_json: unknown }>(
      schemaName,
      `SELECT value_json FROM "${schemaName}".app_setting
        WHERE code = 'POS_OFFLINE_SALE_ENABLED' AND deleted_at IS NULL`,
    );

    return {
      generatedAt: new Date().toISOString(),
      // Hanya `true` yang menyalakan; setelan yang hilang berarti mati.
      offlineSaleEnabled:
        (saklar[0]?.value_json as { value?: unknown } | undefined)?.value === true,
      currency: setelan.currency,
      timezone: setelan.timezone,
      productCount: produk.length,
      productTotal: total,
      truncated: produk.length < total,
      products: produk.map((r) => ({
        ...this.petakanProduk(r),
        barcodes: ((r.barcodes as string[] | null) ?? []).filter(Boolean),
      })),
      taxRates: pajak.map((r) => ({
        taxCategoryId: String(r.tax_category_id),
        taxRateId: String(r.tax_rate_id),
        code: String(r.code),
        rate: Number(r.rate),
        isInclusive: Boolean(r.is_inclusive),
        effectiveFrom: (r.effective_from as string) ?? null,
        effectiveUntil: (r.effective_until as string) ?? null,
      })),
      paymentMethods: metode,
    };
  }
}
