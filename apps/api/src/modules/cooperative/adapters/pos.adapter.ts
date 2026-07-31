/**
 * Adapter POS — satu-satunya berkas koperasi yang menyentuh tabel `pos_*`.
 *
 * **Hanya membaca.** Tidak ada satu pun `INSERT`, `UPDATE`, maupun `DELETE` di
 * sini, dan pengujian memeriksanya terhadap isi berkas ini sendiri.
 *
 * Alasannya bukan kehati-hatian berlebih. Penjualan di unit toko sudah
 * menghasilkan pergerakan stok dan jurnal lewat mesin POS. Koperasi yang ikut
 * menulis ke sana akan menggandakan pendapatan dan membelah persediaan menjadi
 * dua angka yang tidak pernah cocok saat opname — dan yang menemukannya
 * biasanya petugas gudang, berbulan-bulan kemudian, tanpa cara mengetahui mana
 * yang benar.
 *
 * Kasir unit toko memakai layar kasir Core sebagaimana kasir mana pun. Koperasi
 * membaca hasilnya untuk menghitung patronage; ia tidak menjual lewat POS.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import type { OutletRef, PosPort, SaleSummary } from '../ports';
import { STATUS_DIHITUNG } from '../cooperative-unit';

@Injectable()
export class CooperativePosAdapter implements PosPort {
  private readonly logger = new Logger(CooperativePosAdapter.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Keterangan penjualan kasir, untuk dicantumkan pada mutasi simpanan.
   *
   * HANYA membaca. Diletakkan di sini, bukan pada penangan pembayaran, karena
   * adapter inilah satu-satunya batas modul koperasi terhadap POS — dan
   * pengujian `pos-adapter-readonly.spec.ts` menegakkannya dengan memeriksa
   * berkas mana saja yang menyebut tabel POS.
   *
   * Kegagalan mengembalikan nilai kosong, bukan melempar. Nomor struk bersifat
   * menyenangkan, bukan menentukan: mutasi simpanan tetap harus terbentuk pada
   * penyewa yang tidak memasang POS.
   */
  async saleDescription(
    schemaName: string,
    saleId: string | null,
    outletId: string | null,
  ): Promise<{ receiptNumber: string | null; outletName: string | null }> {
    let receiptNumber: string | null = null;
    let outletName: string | null = null;

    if (saleId) {
      try {
        const rows = await this.tenantDb.query<{ receipt_number: string | null }>(
          schemaName,
          `SELECT receipt_number FROM "${schemaName}".pos_sale WHERE id = $1`,
          [saleId],
        );
        receiptNumber = rows[0]?.receipt_number ?? null;
      } catch {
        receiptNumber = null;
      }
    }

    if (outletId) {
      try {
        const rows = await this.tenantDb.query<{ name: string | null }>(
          schemaName,
          `SELECT name FROM "${schemaName}".outlet WHERE id = $1`,
          [outletId],
        );
        outletName = rows[0]?.name ?? null;
      } catch {
        outletName = null;
      }
    }

    return { receiptNumber, outletName };
  }

  /** Outlet yang dimiliki sebuah unit usaha. */
  async outletsOfUnit(schemaName: string, unitBusinessId: string): Promise<OutletRef[]> {
    const rows = await this.tenantDb.query<{ id: string; code: string; name: string }>(
      schemaName,
      `SELECT o.id, o.code, o.name
         FROM "${schemaName}".cooperative_unit_pos_link l
         JOIN "${schemaName}".outlet o ON o.id = l.outlet_id
        WHERE l.unit_business_id = $1
          AND l.unlinked_at IS NULL
          AND o.deleted_at IS NULL
        ORDER BY o.code`,
      [unitBusinessId],
    );
    return rows.map((r) => ({ outletId: r.id, code: r.code, name: r.name }));
  }

  /**
   * Penjualan selesai pada rentang tanggal.
   *
   * Disaring pada `business_date`, bukan pada `created_at`. Penjualan yang
   * diselesaikan lewat tengah malam tetap milik hari usaha tempat ia terjadi,
   * dan memakai `created_at` akan memindahkannya ke periode berikutnya —
   * sesudah patronage periode ini dihitung.
   */
  async completedSales(
    schemaName: string,
    filter: { outletIds: string[]; from: string; to: string; customerIds?: string[] },
  ): Promise<SaleSummary[]> {
    if (!filter.outletIds.length) return [];

    const rows = await this.tenantDb.query<{
      id: string;
      outlet_id: string;
      customer_id: string | null;
      business_date: string;
      grand_total: string;
      status: string;
    }>(
      schemaName,
      `SELECT id, outlet_id, customer_id, business_date::text AS business_date,
              grand_total::text AS grand_total, status
         FROM "${schemaName}".pos_sale
        WHERE outlet_id = ANY($1::uuid[])
          AND business_date BETWEEN $2::date AND $3::date
          AND status = ANY($4::varchar[])
          ${filter.customerIds?.length ? 'AND customer_id = ANY($5::uuid[])' : ''}
        ORDER BY business_date, id`,
      filter.customerIds?.length
        ? [filter.outletIds, filter.from, filter.to, STATUS_DIHITUNG, filter.customerIds]
        : [filter.outletIds, filter.from, filter.to, STATUS_DIHITUNG],
    );

    return rows.map((r) => ({
      saleId: r.id,
      outletId: r.outlet_id,
      customerId: r.customer_id,
      businessDate: r.business_date,
      grandTotal: r.grand_total,
      status: r.status,
    }));
  }

  /**
   * Peta `customer_id` POS ke `member_id` koperasi.
   *
   * Anggota yang belum tertaut ke pelanggan POS tidak muncul di sini, dan
   * penjualannya akan terhitung sebagai tidak teratribusi — keadaan yang
   * dilaporkan, bukan disembunyikan.
   */
  async petaAnggota(schemaName: string, cooperativeId: string): Promise<Map<string, string>> {
    const rows = await this.tenantDb.query<{ customer_id: string; id: string }>(
      schemaName,
      `SELECT customer_id, id
         FROM "${schemaName}".cooperative_member
        WHERE cooperative_id = $1 AND customer_id IS NOT NULL AND deleted_at IS NULL`,
      [cooperativeId],
    );
    const peta = new Map<string, string>();
    for (const r of rows) peta.set(r.customer_id, r.id);
    return peta;
  }
}
