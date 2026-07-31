/**
 * Penangan pembayaran memakai saldo simpanan anggota.
 *
 * Sisi koperasi dari IR-002, dan **satu-satunya tempat modul koperasi
 * menyentuh alur kasir.** Ia mengimplementasikan kontrak milik Core dan
 * didaftarkan ke registrinya; POS tidak mengetahui apa pun tentang simpanan,
 * dan koperasi tidak menyentuh satu baris pun milik POS.
 *
 * Panduan koordinasi §3 menyebutnya tegas: sesi koperasi hanya membuat
 * adapter, tidak mengubah perilaku POS.
 *
 * ## Alurnya
 *
 *   1. Anggota membuka portal di ponselnya, memasukkan PIN, menyetujui sebuah
 *      jumlah. Portal menerbitkan **bukti sekali pakai** berumur pendek.
 *   2. Kasir memasukkan bukti itu. POS memanggil `authorize()` — dana ditahan,
 *      belum berpindah.
 *   3. Penjualan diselesaikan. POS memanggil `capture()` di dalam transaksinya
 *      sendiri — saldo benar-benar berkurang dan mutasinya tercatat.
 *   4. Bila penjualan dibatalkan, POS memanggil `reverse()` — penahanan
 *      dilepaskan, saldo tidak pernah tersentuh.
 *
 * PIN tidak pernah melewati kasir pada satu langkah pun. Yang melewati kasir
 * hanyalah bukti bahwa PIN sudah dimasukkan di tempat lain.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { CooperativePosAdapter } from '../adapters/pos.adapter';
import { CooperativeAccountingEventService } from '../accounting/cooperative-accounting-event.service';
import type {
  ExternalPaymentAuthorization,
  ExternalPaymentContext,
  ExternalPaymentHandler,
} from '../../pos/external-payment.registry';
import {
  bolehDipakaiMembayar,
  bolehMembayar,
  bolehMemakaiBukti,
  bolehMenahan,
  keteranganMutasi,
  sudahSelesai,
} from './member-balance';

/** Kode penangan pada `payment_method.external_handler`. */
export const MEMBER_BALANCE_HANDLER = 'COOPERATIVE_MEMBER_BALANCE';

/**
 * Menyidik bukti persetujuan.
 *
 * SHA-256 tanpa garam, dan itu disengaja berbeda dari kata sandi. Bukti ini
 * berumur tiga menit, sekali pakai, dan bernilai acak 256 bit — tidak ada
 * kamus yang dapat menebaknya, sehingga yang diperlukan hanyalah pencarian
 * yang cepat dan setara. Argon2 di sini justru merugikan: ia lambat dengan
 * sengaja, dan kasir menunggu di depan pelanggan.
 */
function sidik(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

@Injectable()
export class MemberBalancePaymentHandler implements ExternalPaymentHandler {
  readonly handlerCode = MEMBER_BALANCE_HANDLER;

  private readonly logger = new Logger(MemberBalancePaymentHandler.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    /*
     * Satu-satunya jalan modul koperasi membaca POS. Lihat catatan pada
     * `saleDescription()`.
     */
    private readonly pos: CooperativePosAdapter,
    private readonly peristiwa: CooperativeAccountingEventService,
  ) {}

  /**
   * Menahan dana. TIDAK memotongnya.
   *
   * Seluruhnya di dalam satu transaksi: bukti ditandai terpakai dan penahanan
   * terbentuk bersama-sama, atau tidak satu pun terjadi. Bila keduanya
   * terpisah, bukti dapat tertandai terpakai tanpa penahanan yang menyertainya
   * — dan anggota kehilangan persetujuannya tanpa memperoleh apa pun.
   */
  async authorize(ctx: ExternalPaymentContext): Promise<ExternalPaymentAuthorization> {
    const nilai = Number(ctx.amount);
    const S = ctx.schemaName;

    if (!ctx.authToken?.trim()) {
      return {
        authorized: false,
        reference: '',
        message: 'Minta anggota menyetujui pembayaran lewat portal terlebih dahulu.',
      };
    }

    try {
      return await this.tenantDb.transaction(S, async (client) => {
        /*
         * Penahanan yang sudah ada untuk kunci idempotensi ini dikembalikan
         * apa adanya. Klik ganda pada layar kasir yang lambat pasti terjadi;
         * tanpa ini, saldo anggota berkurang dua kali untuk satu transaksi.
         */
        const ada = await client.query<{ id: string; state: string }>(
          `SELECT id, state FROM "${S}".cooperative_payment_hold WHERE idempotency_key = $1`,
          [ctx.idempotencyKey],
        );
        if (ada.rows.length) {
          return { authorized: ada.rows[0].state !== 'REVERSED', reference: ada.rows[0].id };
        }

        // --- Bukti persetujuan anggota ---------------------------------
        const tokenHash = sidik(ctx.authToken!.trim());
        const bukti = await client.query<{
          id: string;
          member_id: string;
          max_amount: string;
          expires_at: Date;
          used_at: Date | null;
          outlet_id: string | null;
          cooperative_id: string;
        }>(
          `SELECT id, member_id, max_amount, expires_at, used_at, outlet_id, cooperative_id
             FROM "${S}".cooperative_payment_token
            WHERE token_hash = $1
            FOR UPDATE`,
          [tokenHash],
        );

        const b = bukti.rows[0];
        const vonisBukti = bolehMemakaiBukti(
          b
            ? {
                memberId: b.member_id,
                maxAmount: b.max_amount,
                expiresAt: b.expires_at.toISOString(),
                usedAt: b.used_at?.toISOString() ?? null,
                outletId: b.outlet_id,
                now: new Date().toISOString(),
              }
            : null,
          nilai,
          ctx.outletId,
        );
        if (!vonisBukti.allowed) {
          this.logger.warn(`Bukti pembayaran ditolak: ${vonisBukti.code}`);
          return { authorized: false, reference: '', message: vonisBukti.message };
        }

        // --- Keanggotaan ------------------------------------------------
        const anggota = await client.query<{ status: string; cooperative_id: string }>(
          `SELECT status, cooperative_id FROM "${S}".cooperative_member WHERE id = $1`,
          [b.member_id],
        );
        const vonisAnggota = bolehMembayar(
          anggota.rows[0]
            ? { status: anggota.rows[0].status, cooperativeId: anggota.rows[0].cooperative_id }
            : null,
          b.cooperative_id,
        );
        if (!vonisAnggota.allowed) {
          return { authorized: false, reference: '', message: vonisAnggota.message };
        }

        /*
         * --- Rekening sumber -------------------------------------------
         *
         * SATU rekening, dipilih deterministik: simpanan yang boleh ditarik,
         * bukan ekuitas, aktif, tertua lebih dahulu, dan dikunci.
         *
         * Menyebar pembayaran ke beberapa rekening akan membuat pelepasannya
         * tidak dapat dijelaskan bila salah satunya berubah di antara
         * penahanan dan pewujudan.
         */
        const rekening = await client.query<{
          id: string;
          status: string;
          balance: string;
          minimum_balance: string;
          allows_withdrawal: boolean;
          is_equity: boolean;
          product_name: string;
        }>(
          `SELECT a.id, a.status, a.balance, p.minimum_balance,
                  p.allows_withdrawal, p.is_equity, p.name AS product_name
             FROM "${S}".cooperative_saving_account a
             JOIN "${S}".cooperative_saving_product p ON p.id = a.product_id
            WHERE a.member_id = $1
              AND a.status = 'ACTIVE'
              AND p.is_equity = FALSE
              AND p.allows_withdrawal = TRUE
            ORDER BY a.opened_at, a.id
            FOR UPDATE OF a`,
          [b.member_id],
        );

        if (!rekening.rows.length) {
          return {
            authorized: false,
            reference: '',
            message: 'Anggota belum memiliki simpanan yang dapat dibelanjakan.',
          };
        }

        const r = rekening.rows[0];

        // Diperiksa sekali lagi meski kueri sudah menyaringnya. Penyaring pada
        // kueri dapat berubah; aturannya tidak.
        const vonisProduk = bolehDipakaiMembayar({
          savingKind: '',
          allowsWithdrawal: r.allows_withdrawal,
          isEquity: r.is_equity,
          name: r.product_name,
        });
        if (!vonisProduk.allowed) {
          return { authorized: false, reference: '', message: vonisProduk.message };
        }

        const tertahan = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(amount), 0) AS total
             FROM "${S}".cooperative_payment_hold
            WHERE saving_account_id = $1 AND state = 'AUTHORIZED'`,
          [r.id],
        );

        const vonisSaldo = bolehMenahan(
          {
            status: r.status,
            balance: r.balance,
            heldAmount: tertahan.rows[0].total,
            minimumBalance: r.minimum_balance ?? '0',
          },
          nilai,
        );
        if (!vonisSaldo.allowed) {
          return { authorized: false, reference: '', message: vonisSaldo.message };
        }

        // --- Penahanan --------------------------------------------------
        const hold = await client.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_payment_hold
             (cooperative_id, member_id, saving_account_id, amount,
              pos_sale_id, outlet_id, idempotency_key, state)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'AUTHORIZED')
           RETURNING id`,
          [
            b.cooperative_id,
            b.member_id,
            r.id,
            nilai,
            ctx.saleId,
            ctx.outletId,
            ctx.idempotencyKey,
          ],
        );

        await client.query(
          `UPDATE "${S}".cooperative_payment_token
              SET used_at = now(), used_by_hold_id = $2
            WHERE id = $1`,
          [b.id, hold.rows[0].id],
        );

        return { authorized: true, reference: hold.rows[0].id };
      });
    } catch (error) {
      /*
       * Kegagalan tak terduga TIDAK ditampilkan apa adanya kepada kasir.
       * Kasir tidak dapat berbuat apa pun dengan jejak tumpukan, dan pelanggan
       * di depannya ikut membacanya.
       */
      const pesan = error instanceof Error ? error.message : String(error);
      this.logger.error(`Penahanan saldo gagal untuk penjualan ${ctx.saleId}: ${pesan}`);
      return {
        authorized: false,
        reference: '',
        message: 'Pembayaran dengan saldo simpanan sedang tidak dapat diproses.',
      };
    }
  }

  /**
   * Mewujudkan penahanan: saldo benar-benar berkurang.
   *
   * Dipanggil POS **di dalam transaksi penyelesaiannya**. Bila metode ini
   * melempar, seluruh penyelesaian penjualan digulung balik — stok kembali,
   * struk tidak terbit. Itulah yang membuat "saldo terpotong tanpa penjualan"
   * tidak mungkin terjadi.
   */
  async capture(ctx: { schemaName: string; reference: string }): Promise<void> {
    const S = ctx.schemaName;

    await this.tenantDb.transaction(S, async (client) => {
      const hold = await client.query<{
        id: string;
        state: string;
        member_id: string;
        saving_account_id: string;
        amount: string;
        cooperative_id: string;
        outlet_id: string | null;
        pos_sale_id: string | null;
      }>(
        `SELECT id, state, member_id, saving_account_id, amount, cooperative_id,
                outlet_id, pos_sale_id
           FROM "${S}".cooperative_payment_hold WHERE id = $1 FOR UPDATE`,
        [ctx.reference],
      );

      if (!hold.rows.length) {
        throw new Error(`Penahanan ${ctx.reference} tidak ditemukan.`);
      }
      const h = hold.rows[0];

      /*
       * Pemanggilan ulang berakhir tenang.
       *
       * POS dapat memanggil `capture()` dua kali bila jaringan putus setelah
       * panggilan pertama berhasil. Melempar di sini akan menggulung balik
       * penyelesaian penjualan yang sebenarnya sudah benar.
       */
      if (sudahSelesai(h.state, 'CAPTURED')) return;

      if (h.state !== 'AUTHORIZED') {
        throw new Error(`Penahanan ${ctx.reference} berstatus ${h.state}; tidak dapat diwujudkan.`);
      }

      const rekening = await client.query<{ balance: string }>(
        `SELECT balance FROM "${S}".cooperative_saving_account WHERE id = $1 FOR UPDATE`,
        [h.saving_account_id],
      );
      const saldoSesudah = Number(rekening.rows[0].balance) - Number(h.amount);

      /*
       * Saldo tidak pernah negatif — simpanan bukan pinjaman. Ditegakkan pula
       * oleh constraint K-3; diperiksa di sini supaya pesannya dapat
       * dijelaskan, bukan berupa pelanggaran constraint.
       */
      if (saldoSesudah < 0) {
        throw new Error(
          `Saldo rekening ${h.saving_account_id} tidak mencukupi saat pewujudan penahanan.`,
        );
      }

      /*
       * Keterangan penjualan dibaca lewat ADAPTER, bukan langsung.
       *
       * Adapter adalah satu-satunya batas modul koperasi terhadap POS, dan
       * `pos-adapter-readonly.spec.ts` menegakkannya dengan memeriksa berkas
       * mana saja yang menyebut tabel POS. Membaca langsung dari sini akan
       * lolos hari ini dan menjadi kebiasaan besok.
       */
      const { receiptNumber, outletName } = await this.pos.saleDescription(
        S,
        h.pos_sale_id,
        h.outlet_id,
      );

      const mutasi = await client.query<{ id: string }>(
        `INSERT INTO "${S}".cooperative_saving_transaction
           (account_id, member_id, transaction_date, transaction_type,
            amount, balance_after, note, reference, idempotency_key)
         VALUES ($1, $2, CURRENT_DATE, 'WITHDRAWAL', $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          h.saving_account_id,
          h.member_id,
          h.amount,
          saldoSesudah,
          keteranganMutasi(receiptNumber, outletName),
          receiptNumber ?? h.pos_sale_id,
          /*
           * Kunci idempotensi mutasi diturunkan dari penahanannya. Bila
           * `capture()` terpanggil dua kali karena jaringan putus, mutasi
           * kedua ditolak indeks — bukan tercatat sebagai penarikan kedua.
           */
          `hold:${h.id}`,
        ],
      );

      await client.query(
        `UPDATE "${S}".cooperative_saving_account
            SET balance = $2, last_movement_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1`,
        [h.saving_account_id, saldoSesudah],
      );

      await client.query(
        `UPDATE "${S}".cooperative_payment_hold
            SET state = 'CAPTURED', captured_at = now(), saving_transaction_id = $2,
                updated_at = now(), version = version + 1
          WHERE id = $1 AND state = 'AUTHORIZED'`,
        [h.id, mutasi.rows[0].id],
      );

      /*
       * Peristiwa akuntansi, di dalam transaksi yang sama (IR-003).
       *
       * `COOPERATIVE_WALLET_PAYMENT` sengaja TIDAK menjurnal penjualannya.
       * Penjualan di unit toko sudah dijurnal mesin POS lewat `POS_SALE`; yang
       * dicatat di sini hanya perpindahan dari kewajiban simpanan ke kas —
       * hal yang tidak diketahui POS. Bila keduanya sama-sama menjurnal
       * penjualan, pendapatan koperasi tercatat dua kali.
       *
       * Terbit di dalam transaksi ini supaya tidak dapat bertahan bila
       * penyelesaian penjualannya digulung balik. Peristiwa keuangan atas
       * kejadian yang tidak jadi adalah catatan yang tidak dapat dijelaskan.
       */
      await this.peristiwa.terbitkan(client, S, {
        eventCode: 'COOPERATIVE_WALLET_PAYMENT',
        sourceType: 'COOPERATIVE_PAYMENT_HOLD',
        sourceId: h.id,
        sourceNumber: receiptNumber,
        amounts: { amount: Number(h.amount) },
      });
    });
  }

  /**
   * Melepaskan penahanan. Saldo tidak pernah tersentuh.
   *
   * Penahanan yang sudah diwujudkan **tidak** dilepaskan di sini — dana yang
   * sudah berpindah dikembalikan lewat retur, yang punya jejaknya sendiri.
   */
  async reverse(ctx: { schemaName: string; reference: string; reason: string }): Promise<void> {
    const S = ctx.schemaName;

    await this.tenantDb.transaction(S, async (client) => {
      const hold = await client.query<{ id: string; state: string }>(
        `SELECT id, state FROM "${S}".cooperative_payment_hold WHERE id = $1 FOR UPDATE`,
        [ctx.reference],
      );
      if (!hold.rows.length) {
        throw new Error(`Penahanan ${ctx.reference} tidak ditemukan.`);
      }

      const state = hold.rows[0].state;
      if (sudahSelesai(state, 'REVERSED')) return;

      if (state === 'CAPTURED') {
        /*
         * Tidak melempar. POS memanggil `reverse()` saat penjualan dibatalkan,
         * dan pembatalan penjualan yang pembayarannya sudah diwujudkan adalah
         * keadaan yang sah — pengembaliannya lewat retur. Melempar di sini
         * akan mencatat galat pada setiap pembatalan semacam itu.
         */
        this.logger.log(
          `Penahanan ${ctx.reference} sudah diwujudkan; pelepasan dilewati. ` +
            'Pengembalian dana berjalan lewat retur.',
        );
        return;
      }

      await client.query(
        `UPDATE "${S}".cooperative_payment_hold
            SET state = 'REVERSED', reversed_at = now(), reverse_reason = $2,
                updated_at = now(), version = version + 1
          WHERE id = $1 AND state = 'AUTHORIZED'`,
        [ctx.reference, ctx.reason],
      );
    });
  }

}
