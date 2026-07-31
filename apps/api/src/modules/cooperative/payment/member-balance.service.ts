/**
 * Penerbitan bukti persetujuan pembayaran, dari portal anggota.
 *
 * Ini sisi anggota dari IR-002 — langkah pertama pada alurnya. Anggota membuka
 * portal di ponselnya, memasukkan PIN, menyetujui sebuah jumlah, dan menerima
 * bukti sekali pakai yang ditunjukkan kepada kasir.
 *
 * ## Mengapa buktinya dan bukan PIN-nya
 *
 * Spesifikasi eKoperasi §14: PIN anggota tidak boleh terlihat kasir. Sesuatu
 * yang melewati layar kasir adalah sesuatu yang terlihat kasir — jadi PIN
 * tidak pernah melewatinya. Yang melewatinya hanyalah bukti bahwa PIN sudah
 * dimasukkan pada perangkat anggota sendiri.
 *
 * Bukti itu tetap berbahaya: siapa pun yang memegangnya dapat membelanjakan
 * saldo anggota sampai batas nilainya. Karena itu ia berumur tiga menit,
 * berbatas nilai, sekali pakai, dan hanya sidiknya yang disimpan.
 */

import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { UMUR_BUKTI_DETIK, bolehMembayar, saldoTersedia } from './member-balance';
import type { KonteksAnggota } from '../cooperative-portal.service';

export interface BuktiTerbit {
  /** Ditampilkan sekali kepada anggota, tidak pernah dapat dibaca lagi. */
  token: string;
  expiresAt: string;
  maxAmount: string;
}

@Injectable()
export class MemberBalanceService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Saldo yang dapat dibelanjakan anggota di kasir.
   *
   * Hanya simpanan yang boleh ditarik dan bukan ekuitas. Simpanan pokok dan
   * wajib sengaja tidak ikut dihitung — menampilkannya sebagai "saldo belanja"
   * akan membuat anggota mengira modal keanggotaannya dapat dipakai berbelanja.
   */
  async saldoBelanja(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query<{
      id: string;
      balance: string;
      minimum_balance: string;
      product_name: string;
      held: string;
    }>(
      schema,
      `SELECT a.id, a.balance, COALESCE(p.minimum_balance, 0) AS minimum_balance,
              p.name AS product_name,
              COALESCE((SELECT SUM(h.amount) FROM "${schema}".cooperative_payment_hold h
                         WHERE h.saving_account_id = a.id AND h.state = 'AUTHORIZED'), 0) AS held
         FROM "${schema}".cooperative_saving_account a
         JOIN "${schema}".cooperative_saving_product p ON p.id = a.product_id
        WHERE a.member_id = $1 AND a.status = 'ACTIVE'
          AND p.is_equity = FALSE AND p.allows_withdrawal = TRUE
        ORDER BY a.opened_at, a.id`,
      [konteks.memberId],
    );

    const rekening = rows.map((r) => ({
      accountId: r.id,
      productName: r.product_name,
      available: saldoTersedia({
        status: 'ACTIVE',
        balance: r.balance,
        heldAmount: r.held,
        minimumBalance: r.minimum_balance,
      }),
    }));

    return {
      /*
       * Rekening pertama sajalah yang dipakai membayar — penangan memilih
       * secara deterministik dengan urutan yang sama. Menampilkan jumlah
       * seluruh rekening akan menjanjikan angka yang tidak dapat dibelanjakan
       * sekaligus.
       */
      belanjaMaksimum: rekening[0]?.available ?? 0,
      rekening,
    };
  }

  /**
   * Menerbitkan bukti persetujuan.
   *
   * Nilai acak 256 bit, dikembalikan **sekali** kepada anggota. Yang disimpan
   * hanya sidiknya; bila anggota kehilangan buktinya, ia membuat yang baru —
   * tidak ada jalan membacanya kembali, dan itu memang yang diinginkan.
   */
  async terbitkanBukti(
    schema: string,
    konteks: KonteksAnggota,
    input: { maxAmount: number; outletId?: string | null },
  ): Promise<BuktiTerbit> {
    const vonis = bolehMembayar(
      { status: konteks.status, cooperativeId: konteks.cooperativeId },
      konteks.cooperativeId,
    );
    if (!vonis.allowed) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, vonis.message!);
    }

    if (!(input.maxAmount > 0)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nilai persetujuan harus lebih dari nol.');
    }

    const tersedia = await this.saldoBelanja(schema, konteks);
    if (input.maxAmount > tersedia.belanjaMaksimum) {
      /*
       * Ditolak di sini, bukan nanti di kasir. Anggota yang menyetujui jumlah
       * melebihi saldonya akan berdiri di depan kasir dengan bukti yang pasti
       * gagal — dan tidak mengerti mengapa.
       */
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Nilai persetujuan melebihi saldo simpanan yang dapat dibelanjakan.',
      );
    }

    const token = randomBytes(32).toString('base64url');
    const hash = createHash('sha256').update(token, 'utf8').digest('hex');
    const expiresAt = new Date(Date.now() + UMUR_BUKTI_DETIK * 1000);

    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".cooperative_payment_token
         (cooperative_id, member_id, token_hash, max_amount, outlet_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        konteks.cooperativeId,
        konteks.memberId,
        hash,
        input.maxAmount,
        input.outletId ?? null,
        expiresAt,
      ],
    );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
      maxAmount: String(input.maxAmount),
    };
  }

  /**
   * Riwayat pembayaran anggota di kasir.
   *
   * Hanya miliknya sendiri — cakupannya sama dengan seluruh portal.
   */
  async riwayat(schema: string, konteks: KonteksAnggota) {
    return this.tenantDb.query(
      schema,
      `SELECT h.id, h.amount, h.state, h.authorized_at, h.captured_at, h.reversed_at,
              t.description
         FROM "${schema}".cooperative_payment_hold h
    LEFT JOIN "${schema}".cooperative_saving_transaction t ON t.id = h.saving_transaction_id
        WHERE h.member_id = $1
        ORDER BY h.authorized_at DESC
        LIMIT 50`,
      [konteks.memberId],
    );
  }
}
