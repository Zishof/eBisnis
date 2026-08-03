/**
 * Pengelolaan aturan diskon kasir.
 *
 * ## Mengapa layar ini ada
 *
 * Mesin promosinya sudah bekerja sejak lama — dimuat `pos-catalog.service.ts`,
 * dipakai jalur penjualan, dan potongannya tampil di layar kasir. Yang tidak ada
 * adalah cara membuat aturannya: sampai sebelum berkas ini, satu-satunya jalan
 * adalah SQL langsung atau data contoh.
 *
 * Mesin yang bekerja tetapi tidak dapat diisi sama saja dengan mesin yang tidak
 * ada.
 *
 * ## Yang dijaga di sini, dan yang dijaga di tempat lain
 *
 * Aturan benar-salahnya ada di `pos-promotion-validasi.ts` yang murni dan
 * teruji. Berkas ini hanya menyimpan dan membaca — supaya aturan yang menentukan
 * berapa uang dilepas gerai tidak perlu basis data untuk dibuktikan.
 *
 * Jejak audit tidak dipasang di sini: pemicunya sudah terpasang otomatis pada
 * setiap tabel tenant yang punya kolom `id` (V008), termasuk `pos_promotion`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import type { AuthenticatedUser } from '../../common/decorators';
import {
  validasiAturanDiskon,
  type AturanDiskonBersih,
  type MasukanAturanDiskon,
} from './pos-promotion-validasi';

export interface RingkasanAturanDiskon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  benefitType: string;
  benefitValue: string;
  maxDiscountAmount: string | null;
  minimumPurchase: string | null;
  minimumQuantity: string | null;
  scopeType: string;
  scopeId: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
  validDays: number[] | null;
  validTimeFrom: string | null;
  validTimeTo: string | null;
  usageLimit: number | null;
  usageCount: number;
  requiresApproval: boolean;
  priority: number;
  isActive: boolean;
  targets: { productId: string | null; productCategoryId: string | null; isExclusion: boolean }[];
}

const KOLOM = `pr.id, pr.code, pr.name, pr.description, pr.benefit_type, pr.benefit_value::text,
        pr.max_discount_amount::text, pr.minimum_purchase::text, pr.minimum_quantity::text,
        pr.scope_type, pr.scope_id, pr.valid_from, pr.valid_until, pr.valid_days,
        pr.valid_time_from::text, pr.valid_time_to::text,
        pr.usage_limit, pr.usage_count, pr.requires_approval, pr.priority, pr.is_active`;

@Injectable()
export class PosPromotionService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    filter: { includeInactive?: boolean } = {},
  ): Promise<RingkasanAturanDiskon[]> {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT ${KOLOM},
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                          'productId', pp.product_id,
                          'productCategoryId', pp.product_category_id,
                          'isExclusion', pp.is_exclusion))
                   FROM "${schemaName}".pos_promotion_product pp
                  WHERE pp.pos_promotion_id = pr.id),
                '[]'::jsonb) AS targets
         FROM "${schemaName}".pos_promotion pr
        WHERE pr.deleted_at IS NULL
          AND ($1::boolean IS TRUE OR pr.is_active = TRUE)
        ORDER BY pr.is_active DESC, pr.priority, pr.code`,
      [filter.includeInactive === true],
    );
    return rows.map((r) => this.keRingkasan(r));
  }

  async satu(schemaName: string, id: string): Promise<RingkasanAturanDiskon> {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT ${KOLOM},
              COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                          'productId', pp.product_id,
                          'productCategoryId', pp.product_category_id,
                          'isExclusion', pp.is_exclusion))
                   FROM "${schemaName}".pos_promotion_product pp
                  WHERE pp.pos_promotion_id = pr.id),
                '[]'::jsonb) AS targets
         FROM "${schemaName}".pos_promotion pr
        WHERE pr.id = $1 AND pr.deleted_at IS NULL`,
      [id],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Aturan diskon tidak ditemukan.');
    }
    return this.keRingkasan(rows[0]);
  }

  async buat(
    schemaName: string,
    dto: MasukanAturanDiskon,
    user: AuthenticatedUser,
  ): Promise<RingkasanAturanDiskon> {
    const bersih = this.periksa(dto);

    const id = await this.tenantDb.transaction(
      schemaName,
      async (client) => {
        const rows = await client.query<{ id: string }>(
          `INSERT INTO "${schemaName}".pos_promotion
             (code, name, description, benefit_type, benefit_value, max_discount_amount,
              minimum_purchase, minimum_quantity, scope_type, scope_id,
              valid_from, valid_until, valid_days, valid_time_from, valid_time_to,
              usage_limit, requires_approval, priority, is_active, created_by)
           SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::uuid,
                  $11::timestamptz, $12::timestamptz, $13::smallint[], $14::time, $15::time,
                  $16, $17, $18, $19, $20::uuid
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schemaName}".pos_promotion
               WHERE code = $1 AND deleted_at IS NULL)
           RETURNING id`,
          this.nilai(bersih, user),
        );
        if (!rows.rows.length) {
          /*
           * Kode kembar ditolak lewat `WHERE NOT EXISTS`, bukan dengan menangkap
           * galat indeks unik: indeksnya parsial (`WHERE deleted_at IS NULL`),
           * sehingga aturan yang sudah dihapus tidak menghalangi pemakaian
           * ulang kodenya — dan pesan galat basis data tidak dapat dibaca
           * penyuntingnya.
           */
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Kode aturan "${bersih.code}" sudah dipakai aturan lain yang masih aktif.`,
          );
        }
        const baru = rows.rows[0].id;
        await this.tulisTarget(client, schemaName, baru, bersih);
        return baru;
      },
      { userId: user.userId },
    );

    return this.satu(schemaName, id);
  }

  async ubah(
    schemaName: string,
    id: string,
    dto: MasukanAturanDiskon,
    user: AuthenticatedUser,
  ): Promise<RingkasanAturanDiskon> {
    await this.satu(schemaName, id); // memastikan ada, dan memberi pesan yang benar bila tidak
    const bersih = this.periksa(dto);

    await this.tenantDb.transaction(
      schemaName,
      async (client) => {
        const rows = await client.query(
          `UPDATE "${schemaName}".pos_promotion
              SET code = $1, name = $2, description = $3, benefit_type = $4,
                  benefit_value = $5, max_discount_amount = $6,
                  minimum_purchase = $7, minimum_quantity = $8,
                  scope_type = $9, scope_id = $10::uuid,
                  valid_from = $11::timestamptz, valid_until = $12::timestamptz,
                  valid_days = $13::smallint[], valid_time_from = $14::time,
                  valid_time_to = $15::time, usage_limit = $16,
                  requires_approval = $17, priority = $18, is_active = $19,
                  updated_by = $20::uuid, updated_at = now(), version = version + 1
            WHERE id = $21 AND deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM "${schemaName}".pos_promotion lain
                 WHERE lain.code = $1 AND lain.deleted_at IS NULL AND lain.id <> $21)`,
          [...this.nilai(bersih, user), id],
        );
        if (rows.rowCount === 0) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Kode aturan "${bersih.code}" sudah dipakai aturan lain yang masih aktif.`,
          );
        }

        /*
         * Target ditulis ulang seluruhnya, bukan disisipkan sebagiannya.
         *
         * Menyatukan daftar lama dan baru menuntut mengetahui baris mana yang
         * "sama" — dan dua baris yang menunjuk produk yang sama dengan penanda
         * pengecualian berbeda bukan hal yang sama. Menulis ulang menghilangkan
         * seluruh pertanyaan itu; jumlah barisnya kecil.
         */
        await client.query(
          `DELETE FROM "${schemaName}".pos_promotion_product WHERE pos_promotion_id = $1`,
          [id],
        );
        await this.tulisTarget(client, schemaName, id, bersih);
      },
      { userId: user.userId },
    );

    return this.satu(schemaName, id);
  }

  /**
   * Menonaktifkan, bukan menghapus.
   *
   * Transaksi yang sudah terjadi menunjuk aturan ini lewat `pos_sale_discount`.
   * Menghapusnya membuat laporan "dampak per aturan diskon" kehilangan namanya,
   * dan struk lama tidak dapat dijelaskan lagi.
   */
  async nonaktifkan(
    schemaName: string,
    id: string,
    user: AuthenticatedUser,
  ): Promise<RingkasanAturanDiskon> {
    await this.satu(schemaName, id);
    await this.tenantDb.transaction(
      schemaName,
      async (client) => {
        await client.query(
          `UPDATE "${schemaName}".pos_promotion
              SET is_active = FALSE, deactivated_at = now(), deactivated_by = $2::uuid,
                  updated_by = $2::uuid, updated_at = now(), version = version + 1
            WHERE id = $1 AND deleted_at IS NULL`,
          [id, user.userId],
        );
      },
      { userId: user.userId },
    );
    return this.satu(schemaName, id);
  }

  // --- Pembantu -------------------------------------------------------------

  private periksa(dto: MasukanAturanDiskon): AturanDiskonBersih {
    const { galat, bersih } = validasiAturanDiskon(dto);
    if (!bersih) {
      // Seluruh masalah dilaporkan sekaligus: penyunting yang memperbaiki satu
      // galat lalu menemukan galat berikutnya akan menyerah pada percobaan
      // ketiga, dan aturan yang tidak jadi disimpan berarti promosi yang tidak
      // jadi berjalan.
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, galat.join(' '));
    }
    return bersih;
  }

  private nilai(b: AturanDiskonBersih, user: AuthenticatedUser): unknown[] {
    return [
      b.code,
      b.name,
      b.description,
      b.benefitType,
      b.benefitValue,
      b.maxDiscountAmount,
      b.minimumPurchase,
      b.minimumQuantity,
      b.scopeType,
      b.scopeId,
      b.validFrom,
      b.validUntil,
      b.validDays,
      b.validTimeFrom,
      b.validTimeTo,
      b.usageLimit,
      b.requiresApproval,
      b.priority,
      b.isActive,
      user.userId,
    ];
  }

  private async tulisTarget(
    client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
    schemaName: string,
    promotionId: string,
    b: AturanDiskonBersih,
  ): Promise<void> {
    for (const t of b.targets) {
      await client.query(
        `INSERT INTO "${schemaName}".pos_promotion_product
           (pos_promotion_id, product_id, product_category_id, is_exclusion)
         VALUES ($1, $2::uuid, $3::uuid, $4)`,
        [promotionId, t.productId, t.productCategoryId, t.isExclusion],
      );
    }
  }

  private keRingkasan(r: Record<string, unknown>): RingkasanAturanDiskon {
    return {
      id: String(r.id),
      code: String(r.code),
      name: String(r.name),
      description: (r.description as string | null) ?? null,
      benefitType: String(r.benefit_type),
      benefitValue: String(r.benefit_value),
      maxDiscountAmount: (r.max_discount_amount as string | null) ?? null,
      minimumPurchase: (r.minimum_purchase as string | null) ?? null,
      minimumQuantity: (r.minimum_quantity as string | null) ?? null,
      scopeType: String(r.scope_type),
      scopeId: (r.scope_id as string | null) ?? null,
      validFrom: (r.valid_from as Date | null) ?? null,
      validUntil: (r.valid_until as Date | null) ?? null,
      validDays: (r.valid_days as number[] | null) ?? null,
      validTimeFrom: (r.valid_time_from as string | null) ?? null,
      validTimeTo: (r.valid_time_to as string | null) ?? null,
      usageLimit: (r.usage_limit as number | null) ?? null,
      usageCount: Number(r.usage_count ?? 0),
      requiresApproval: r.requires_approval === true,
      priority: Number(r.priority ?? 100),
      isActive: r.is_active === true,
      targets:
        (r.targets as {
          productId: string | null;
          productCategoryId: string | null;
          isExclusion: boolean;
        }[]) ?? [],
    };
  }
}
