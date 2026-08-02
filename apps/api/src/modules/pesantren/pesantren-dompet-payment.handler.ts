/**
 * Dompet santri sebagai metode bayar kasir (EP-N) — implementasi
 * `ExternalPaymentHandler` milik POS (IR-002).
 *
 * Ini ADAPTER ke POS yang sudah ada, bukan kasir kedua — §6 perintah
 * master melarang keras membuat POS/inventory/accounting kedua di dalam
 * ePesantren. Pola meniru persis
 * `cooperative/payment/member-balance-payment.handler.ts` (diriset lebih
 * dulu supaya tidak membangun mekanisme kedua): `authorize()` MENAHAN,
 * tidak memotong; `capture()` mewujudkan di dalam transaksinya sendiri;
 * `reverse()` melepaskan penahanan yang belum diwujudkan.
 *
 * ## Perbedaan sengaja dari koperasi: `authToken` adalah nomor kartu
 *
 * Koperasi menuntut anggota menyetujui pembayaran lebih dulu di layar
 * portalnya sendiri, menerbitkan bukti sekali pakai yang KEMUDIAN
 * dimasukkan kasir — sesuai untuk transaksi bernilai besar (simpanan/
 * pinjaman). Santri tidak (dan sengaja belum) punya akun portal sendiri;
 * wali tidak berada di kantin saat anaknya jajan. Untuk transaksi kantin
 * bernilai kecil, memindai KARTU itu sendiri (EP-M) sebagai bukti hadir
 * adalah kesetaraan yang wajar dengan kartu prabayar kantin fisik —
 * didokumentasikan secara eksplisit sebagai keputusan desain, bukan
 * kelalaian meniru pola koperasi apa adanya.
 *
 * Pemeriksaan saldo/batas harian yang SEBENARNYA hanya terjadi satu kali,
 * di `PesantrenDompetService.belanja()` saat `capture()` memanggilnya --
 * bukan diduplikasi di sini. Pemeriksaan pada `authorize()` hanya pratinjau
 * supaya kasir tahu lebih awal; sumber kebenarannya tetap satu.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import {
  ExternalPaymentAuthorization,
  ExternalPaymentContext,
  ExternalPaymentHandler,
} from '../pos/external-payment.registry';
import { PesantrenDompetService } from './pesantren-dompet.service';

export const DOMPET_SANTRI_HANDLER = 'EPESANTREN_DOMPET_SANTRI';

@Injectable()
export class PesantrenDompetPaymentHandler implements ExternalPaymentHandler {
  readonly handlerCode = DOMPET_SANTRI_HANDLER;

  private readonly logger = new Logger(PesantrenDompetPaymentHandler.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly dompet: PesantrenDompetService,
  ) {}

  /** Menahan dana. TIDAK memotongnya — lihat catatan berkas. */
  async authorize(ctx: ExternalPaymentContext): Promise<ExternalPaymentAuthorization> {
    const S = ctx.schemaName;
    const jumlah = Number(ctx.amount);

    if (!ctx.authToken?.trim()) {
      return { authorized: false, reference: '', message: 'Kartu santri belum dipindai.' };
    }

    // Pemanggilan ulang dengan kunci idempotensi yang sama mengembalikan
    // penahanan yang SAMA, bukan menahan dana dua kali untuk satu niat
    // bayar yang sama (kasir mengklik dua kali, jaringan mengulang).
    const existing = await this.tenantDb.queryOne<{ id: string; status: string }>(
      S,
      `SELECT id, status FROM "${S}".pesantren_dompet_hold WHERE idempotency_key = $1`,
      [ctx.idempotencyKey],
    );
    if (existing) {
      return { authorized: existing.status !== 'REVERSED', reference: existing.id };
    }

    const kartu = await this.tenantDb.queryOne<{ santri_id: string }>(
      S,
      `SELECT santri_id::text FROM "${S}".pesantren_kartu WHERE nomor_kartu = $1 AND status = 'AKTIF' AND deleted_at IS NULL`,
      [ctx.authToken.trim()],
    );
    if (!kartu) {
      return { authorized: false, reference: '', message: 'Kartu tidak dikenali atau sudah tidak aktif.' };
    }

    const dompetRow = await this.tenantDb.queryOne<{ id: string; saldo: string; batas_harian: string | null; is_active: boolean }>(
      S,
      `SELECT id::text, saldo::text, batas_harian::text, is_active
         FROM "${S}".pesantren_dompet WHERE santri_id = $1 AND deleted_at IS NULL`,
      [kartu.santri_id],
    );
    if (!dompetRow || !dompetRow.is_active) {
      return { authorized: false, reference: '', message: 'Santri ini belum punya dompet aktif.' };
    }

    // Pratinjau saja -- pemeriksaan sesungguhnya (dan satu-satunya yang
    // menegakkan) ada di `PesantrenDompetService.belanja()`, dipanggil dari
    // `capture()`. Pratinjau ini TIDAK memperhitungkan penahanan lain yang
    // masih AUTHORIZED pada dompet yang sama -- keterbatasan yang sama
    // dengan kapasitas kamar EP-G, diterima untuk skala transaksi kantin.
    if (jumlah > Number(dompetRow.saldo)) {
      return { authorized: false, reference: '', message: 'Saldo dompet tidak mencukupi.' };
    }
    if (dompetRow.batas_harian) {
      const sudahHariIni = await this.tenantDb.queryOne<{ total: string }>(
        S,
        `SELECT COALESCE(SUM(jumlah), 0)::text AS total FROM "${S}".pesantren_dompet_transaksi
          WHERE dompet_id = $1 AND jenis = 'BELANJA' AND created_at::date = CURRENT_DATE`,
        [dompetRow.id],
      );
      if (Number(sudahHariIni?.total ?? 0) + jumlah > Number(dompetRow.batas_harian)) {
        return { authorized: false, reference: '', message: 'Melebihi batas belanja harian dompet.' };
      }
    }

    const hold = await this.tenantDb.queryOne<{ id: string }>(
      S,
      `INSERT INTO "${S}".pesantren_dompet_hold (dompet_id, idempotency_key, jumlah, sale_reference)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text`,
      [dompetRow.id, ctx.idempotencyKey, jumlah, ctx.saleId],
    );

    return { authorized: true, reference: hold!.id };
  }

  /**
   * Mewujudkan penahanan lewat `PesantrenDompetService.belanja()` — bukan
   * menuliskan ulang pemeriksaan saldo/batas harian di sini. Dipanggil POS
   * di dalam transaksi penyelesaiannya; bila melempar, penyelesaian
   * penjualan digulung balik dan penahanan tetap AUTHORIZED untuk
   * dilepaskan saat penjualannya dibatalkan.
   */
  async capture(ctx: { schemaName: string; reference: string }): Promise<void> {
    const S = ctx.schemaName;
    const hold = await this.tenantDb.queryOne<{ id: string; status: string; dompet_id: string; jumlah: string }>(
      S,
      `SELECT id, status, dompet_id::text, jumlah::text FROM "${S}".pesantren_dompet_hold WHERE id = $1`,
      [ctx.reference],
    );
    if (!hold) {
      throw new Error(`Penahanan dompet ${ctx.reference} tidak ditemukan.`);
    }
    // Pemanggilan ulang berakhir tenang -- lihat catatan pada capture()
    // koperasi untuk alasan yang sama persis.
    if (hold.status === 'CAPTURED') return;
    if (hold.status !== 'AUTHORIZED') {
      throw new Error(`Penahanan dompet ${ctx.reference} berstatus ${hold.status}; tidak dapat diwujudkan.`);
    }

    const transaksi = await this.dompet.belanja(S, hold.dompet_id, {
      jumlah: Number(hold.jumlah),
      keterangan: `Pembayaran POS (penahanan ${hold.id})`,
    });

    await this.tenantDb.query(
      S,
      `UPDATE "${S}".pesantren_dompet_hold
          SET status = 'CAPTURED', captured_at = now(), transaksi_id = $2, version = version + 1
        WHERE id = $1 AND status = 'AUTHORIZED'`,
      [hold.id, transaksi.id],
    );
  }

  /**
   * Melepaskan penahanan. Saldo tidak pernah tersentuh di sini.
   *
   * Penahanan yang sudah diwujudkan TIDAK dilepaskan -- dana yang sudah
   * berpindah memerlukan alur retur/refund tersendiri, yang belum ada
   * untuk dompet santri. Dicatat sebagai keterbatasan, bukan didiamkan.
   */
  async reverse(ctx: { schemaName: string; reference: string; reason: string }): Promise<void> {
    const S = ctx.schemaName;
    const hold = await this.tenantDb.queryOne<{ status: string }>(
      S,
      `SELECT status FROM "${S}".pesantren_dompet_hold WHERE id = $1`,
      [ctx.reference],
    );
    if (!hold) {
      this.logger.warn(`Penahanan dompet ${ctx.reference} tidak ditemukan saat dilepaskan.`);
      return;
    }
    if (hold.status !== 'AUTHORIZED') return;

    await this.tenantDb.query(
      S,
      `UPDATE "${S}".pesantren_dompet_hold
          SET status = 'REVERSED', reversed_at = now(), reversed_reason = $2, version = version + 1
        WHERE id = $1 AND status = 'AUTHORIZED'`,
      [ctx.reference, ctx.reason],
    );
  }
}
