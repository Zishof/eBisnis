/**
 * Perencanaan dan APBDes.
 *
 * ## Pagu ditegakkan dua kali, dan itu disengaja
 *
 * Layanan memeriksa lebih dahulu supaya pesannya dapat dibaca petugas —
 * menyebutkan pagu, yang sudah diikat, dan sisanya. Basis data memeriksa lagi
 * lewat constraint supaya pemeriksaan layanan tidak dapat dilewati oleh jalan
 * kode berikutnya, maupun oleh dua permintaan yang berjalan bersamaan.
 *
 * Baris anggaran **dikunci** sebelum diperiksa. Tanpa itu, dua SPP yang diproses
 * pada saat yang sama sama-sama membaca sisa pagu yang sama, sama-sama
 * menyimpulkan cukup, dan keduanya lolos pemeriksaan layanan. Constraint akan
 * menangkap yang kedua, tetapi dengan pesan basis data yang tidak berguna bagi
 * bendahara desa.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  bolehMasukRkp,
  bolehMengikat,
  bolehMerealisasi,
  bolehPindahAnggaran,
  bolehUbahPagu,
  periksaKeseimbangan,
  periksaNilaiWajib,
  serapan,
  tahunDalamPeriode,
  type PaguKegiatan,
  type StatusAnggaran,
  type VillageEventCode,
} from './village-budget';

@Injectable()
export class VillageBudgetService {
  private readonly logger = new Logger(VillageBudgetService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Perencanaan ----------------------------------------------------------

  async susunRkp(
    schemaName: string,
    input: { fiscalYear: number; title: string; rpjmId?: string },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PERENCANAAN.RKPDES');
    const u = await this.unit.unit(schemaName);

    if (input.rpjmId) {
      const p = await this.tenantDb.query<{ start_year: number; end_year: number }>(
        schemaName,
        `SELECT start_year, end_year FROM "${schemaName}".village_rpjm WHERE id = $1`,
        [input.rpjmId],
      );
      if (!p.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'RPJM Desa tidak ditemukan.');

      const v = tahunDalamPeriode(input.fiscalYear, {
        startYear: Number(p[0].start_year),
        endYear: Number(p[0].end_year),
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_rkp
         (village_unit_id, village_rpjm_id, fiscal_year, title, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [u.id, input.rpjmId ?? null, input.fiscalYear, input.title, user.userId],
    );
    return { id: rows[0].id };
  }

  /**
   * Menarik usulan Musrenbang yang disepakati menjadi kegiatan RKP.
   *
   * Tautannya eksplisit: kegiatan menunjuk usulannya, dan usulan berubah status
   * menjadi `MASUK_RKP`. Warga yang bertanya "usulan saya jadi apa" dapat
   * dijawab tanpa menebak.
   */
  async tarikUsulan(
    schemaName: string,
    rkpId: string,
    proposalId: string,
    input: { code: string; sector?: string },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PERENCANAAN.RKPDES');
    const u = await this.unit.unit(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<Record<string, string>>(
        `SELECT id, title, description, status, estimated_cost::text, beneficiary_count,
                location_note, village_rt_id
           FROM "${schemaName}".village_proposal WHERE id = $1 FOR UPDATE`,
        [proposalId],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Usulan tidak ditemukan.');

      const v = bolehMasukRkp(p.rows[0].status);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const keg = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_activity
           (village_unit_id, village_rkp_id, code, name, level, sector, description,
            location_note, beneficiary_count, village_proposal_id, created_by)
         VALUES ($1,$2,$3,$4,'KEGIATAN',$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          u.id,
          rkpId,
          input.code,
          p.rows[0].title,
          input.sector ?? null,
          p.rows[0].description,
          p.rows[0].location_note,
          Number(p.rows[0].beneficiary_count),
          proposalId,
          user.userId,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".village_proposal
            SET status = 'MASUK_RKP', rkp_activity_id = $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [proposalId, keg.rows[0].id],
      );

      return { activityId: keg.rows[0].id, proposalId, estimatedCost: p.rows[0].estimated_cost };
    });
  }

  // --- APBDes ---------------------------------------------------------------

  async susunApbdes(
    schemaName: string,
    input: { fiscalYear: number; rkpId?: string },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.APBDES');
    const u = await this.unit.unit(schemaName);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_budget
         (village_unit_id, village_rkp_id, fiscal_year, created_by)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [u.id, input.rkpId ?? null, input.fiscalYear, user.userId],
    );
    return { id: rows[0].id, status: 'DRAF' };
  }

  /** Menambah atau mengubah baris anggaran. */
  async tetapkanPagu(
    schemaName: string,
    budgetId: string,
    input: {
      accountCode: string;
      accountName: string;
      budgetType: 'PENDAPATAN' | 'BELANJA' | 'PEMBIAYAAN_PENERIMAAN' | 'PEMBIAYAAN_PENGELUARAN';
      ceilingAmount: number;
      activityId?: string;
    },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.APBDES');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_budget WHERE id = $1 FOR UPDATE`,
        [budgetId],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'APBDes tidak ditemukan.');

      const v = bolehUbahPagu(b.rows[0].status as StatusAnggaran);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_budget_line
           (village_budget_id, village_activity_id, budget_type, account_code, account_name,
            ceiling_amount, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (village_budget_id, account_code,
                      COALESCE(village_activity_id, '00000000-0000-0000-0000-000000000000'::uuid))
         DO UPDATE SET ceiling_amount = EXCLUDED.ceiling_amount,
                       account_name = EXCLUDED.account_name,
                       updated_at = now(),
                       version = village_budget_line.version + 1
         RETURNING id`,
        [
          budgetId,
          input.activityId ?? null,
          input.budgetType,
          input.accountCode,
          input.accountName,
          input.ceilingAmount,
          user.userId,
        ],
      );

      await this.hitungUlangRingkasan(client, schemaName, budgetId);
      return { id: rows.rows[0].id };
    });
  }

  /**
   * Menetapkan APBDes.
   *
   * Menolak bila tidak seimbang. APBDes yang tidak seimbang tidak dapat
   * ditetapkan — bukan karena aturan sistem, melainkan karena begitulah
   * anggaran disusun.
   */
  async tetapkanApbdes(
    schemaName: string,
    budgetId: string,
    regulationNumber: string,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.APBDES');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<Record<string, string>>(
        `SELECT status, total_revenue::text, total_expenditure::text,
                total_financing_in::text, total_financing_out::text
           FROM "${schemaName}".village_budget WHERE id = $1 FOR UPDATE`,
        [budgetId],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'APBDes tidak ditemukan.');

      const v = bolehPindahAnggaran(b.rows[0].status as StatusAnggaran, 'DITETAPKAN');
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const k = periksaKeseimbangan({
        pendapatan: Number(b.rows[0].total_revenue),
        belanja: Number(b.rows[0].total_expenditure),
        pembiayaanPenerimaan: Number(b.rows[0].total_financing_in),
        pembiayaanPengeluaran: Number(b.rows[0].total_financing_out),
      });
      if (!k.seimbang) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `APBDes belum seimbang. ${k.keterangan}`,
        );
      }

      if (!regulationNumber?.trim()) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Nomor peraturan desa wajib disebutkan. Anggaran tanpa dasar hukum bukan anggaran ' +
            'yang dapat dipertanggungjawabkan.',
        );
      }

      await client.query(
        `UPDATE "${schemaName}".village_budget
            SET status = 'DITETAPKAN', regulation_number = $2, established_at = CURRENT_DATE,
                approved_by = $3, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [budgetId, regulationNumber, user.userId],
      );

      await this.terbitkanPeristiwa(client, schemaName, {
        eventCode: 'VILLAGE_BUDGET_APPROVED',
        sourceType: 'VILLAGE_BUDGET',
        sourceId: budgetId,
        amounts: {
          totalRevenue: Number(b.rows[0].total_revenue),
          totalExpenditure: Number(b.rows[0].total_expenditure),
        },
        userId: user.userId,
      });

      return { id: budgetId, status: 'DITETAPKAN', balance: k };
    });
  }

  // --- Ikatan dan realisasi -------------------------------------------------

  /**
   * Mengikat belanja.
   *
   * Baris anggaran dikunci sebelum diperiksa. Dua SPP yang diproses bersamaan
   * tanpa kunci akan sama-sama membaca sisa pagu yang sama dan keduanya lolos.
   */
  async ikat(
    schemaName: string,
    input: {
      budgetLineId: string;
      amount: number;
      description: string;
      counterparty?: string;
      documentReference?: string;
      transactionDate?: string;
    },
    idempotencyKey: string,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.REALISASI');
    const u = await this.unit.unit(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_budget_transaction WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (sudah.rows.length) return { id: sudah.rows[0].id, duplicate: true };

      const p = await this.paguTerkunci(client, schemaName, input.budgetLineId);
      const v = bolehMengikat(p.pagu, input.amount);
      if (!v.boleh) {
        throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!, {
          reason: v.reason,
          ceiling: p.pagu.ceiling,
          committed: p.pagu.committed,
          remaining: sisaAman(v.sisaPagu),
        });
      }

      const tgl = input.transactionDate ?? new Date().toISOString().slice(0, 10);
      const t = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_budget_transaction
           (village_unit_id, budget_line_id, transaction_type, transaction_date, amount,
            description, counterparty, document_reference, idempotency_key, created_by)
         VALUES ($1,$2,'IKATAN',$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          u.id,
          input.budgetLineId,
          tgl,
          input.amount,
          input.description,
          input.counterparty ?? null,
          input.documentReference ?? null,
          idempotencyKey,
          user.userId,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".village_budget_line
            SET committed_amount = committed_amount + $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.budgetLineId, input.amount],
      );

      await this.terbitkanPeristiwa(client, schemaName, {
        eventCode: 'VILLAGE_EXPENDITURE_COMMITTED',
        sourceType: 'VILLAGE_BUDGET_TRANSACTION',
        sourceId: t.rows[0].id,
        amounts: { amount: input.amount },
        userId: user.userId,
      });

      return {
        id: t.rows[0].id,
        duplicate: false,
        remainingCeiling: v.sisaPagu,
        outstandingCommitment: v.sisaIkatan,
      };
    });
  }

  /**
   * Merealisasi belanja yang sudah diikat.
   *
   * Menuntut ikatan induknya. Realisasi tanpa ikatan tidak dapat dijelaskan
   * asal wewenangnya, dan pengeluaran tanpa dasar adalah temuan pemeriksaan.
   */
  async realisasikan(
    schemaName: string,
    input: {
      budgetLineId: string;
      parentTransactionId: string;
      amount: number;
      description: string;
      paymentMethod?: string;
      documentReference?: string;
      transactionDate?: string;
    },
    idempotencyKey: string,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.REALISASI');
    const u = await this.unit.unit(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_budget_transaction WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (sudah.rows.length) return { id: sudah.rows[0].id, duplicate: true };

      const induk = await client.query<{ id: string; transaction_type: string }>(
        `SELECT id, transaction_type FROM "${schemaName}".village_budget_transaction
          WHERE id = $1 AND budget_line_id = $2 AND is_reversed = FALSE`,
        [input.parentTransactionId, input.budgetLineId],
      );
      if (!induk.rows.length || induk.rows[0].transaction_type !== 'IKATAN') {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Realisasi harus menunjuk ikatan yang sah pada baris anggaran yang sama.',
        );
      }

      const p = await this.paguTerkunci(client, schemaName, input.budgetLineId);
      const v = bolehMerealisasi(p.pagu, input.amount);
      if (!v.boleh) {
        throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!, {
          reason: v.reason,
          committed: p.pagu.committed,
          realized: p.pagu.realized,
        });
      }

      const tgl = input.transactionDate ?? new Date().toISOString().slice(0, 10);
      const t = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_budget_transaction
           (village_unit_id, budget_line_id, transaction_type, transaction_date, amount,
            description, payment_method, document_reference, parent_transaction_id,
            idempotency_key, created_by)
         VALUES ($1,$2,'REALISASI',$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          u.id,
          input.budgetLineId,
          tgl,
          input.amount,
          input.description,
          input.paymentMethod ?? null,
          input.documentReference ?? null,
          input.parentTransactionId,
          idempotencyKey,
          user.userId,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".village_budget_line
            SET realized_amount = realized_amount + $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.budgetLineId, input.amount],
      );

      await this.catatBukuKas(client, schemaName, {
        unitId: u.id,
        transactionId: t.rows[0].id,
        date: tgl,
        description: input.description,
        credit: input.amount,
      });

      await this.terbitkanPeristiwa(client, schemaName, {
        eventCode: 'VILLAGE_EXPENDITURE_REALIZED',
        sourceType: 'VILLAGE_BUDGET_TRANSACTION',
        sourceId: t.rows[0].id,
        amounts: { amount: input.amount },
        userId: user.userId,
      });

      return { id: t.rows[0].id, duplicate: false, outstandingCommitment: v.sisaIkatan };
    });
  }

  /** Ringkasan serapan per baris anggaran. */
  async serapanApbdes(schemaName: string, budgetId: string) {
    await this.unit.pastikanLayak(schemaName, 'KEUANGAN.REALISASI');

    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT l.id, l.account_code, l.account_name, l.budget_type,
              l.ceiling_amount::text, l.committed_amount::text, l.realized_amount::text,
              a.name AS activity_name
         FROM "${schemaName}".village_budget_line l
    LEFT JOIN "${schemaName}".village_activity a ON a.id = l.village_activity_id
        WHERE l.village_budget_id = $1
        ORDER BY l.budget_type, l.account_code`,
      [budgetId],
    );

    return rows.map((r) => {
      const p: PaguKegiatan = {
        ceiling: Number(r.ceiling_amount),
        committed: Number(r.committed_amount),
        realized: Number(r.realized_amount),
      };
      return {
        id: r.id,
        accountCode: r.account_code,
        accountName: r.account_name,
        budgetType: r.budget_type,
        activityName: r.activity_name,
        ceiling: p.ceiling,
        committed: p.committed,
        realized: p.realized,
        remainingCeiling: p.ceiling - p.committed,
        outstandingCommitment: p.committed - p.realized,
        absorption: serapan(p),
      };
    });
  }

  // --- Bagian dalam ---------------------------------------------------------

  private async paguTerkunci(
    client: PoolClient,
    schemaName: string,
    lineId: string,
  ): Promise<{ pagu: PaguKegiatan; budgetId: string }> {
    const rows = await client.query<Record<string, string>>(
      `SELECT l.village_budget_id, l.ceiling_amount::text, l.committed_amount::text,
              l.realized_amount::text, b.status
         FROM "${schemaName}".village_budget_line l
         JOIN "${schemaName}".village_budget b ON b.id = l.village_budget_id
        WHERE l.id = $1
        FOR UPDATE OF l`,
      [lineId],
    );
    if (!rows.rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris anggaran tidak ditemukan.');
    }
    if (rows.rows[0].status !== 'DITETAPKAN') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `APBDes berstatus ${rows.rows[0].status}. Transaksi hanya dapat dicatat pada anggaran yang sudah ditetapkan.`,
      );
    }
    return {
      budgetId: rows.rows[0].village_budget_id,
      pagu: {
        ceiling: Number(rows.rows[0].ceiling_amount),
        committed: Number(rows.rows[0].committed_amount),
        realized: Number(rows.rows[0].realized_amount),
      },
    };
  }

  private async hitungUlangRingkasan(client: PoolClient, schemaName: string, budgetId: string) {
    await client.query(
      `UPDATE "${schemaName}".village_budget b
          SET total_revenue = COALESCE(t.pendapatan, 0),
              total_expenditure = COALESCE(t.belanja, 0),
              total_financing_in = COALESCE(t.masuk, 0),
              total_financing_out = COALESCE(t.keluar, 0),
              updated_at = now()
         FROM (
           SELECT
             SUM(ceiling_amount) FILTER (WHERE budget_type = 'PENDAPATAN') AS pendapatan,
             SUM(ceiling_amount) FILTER (WHERE budget_type = 'BELANJA') AS belanja,
             SUM(ceiling_amount) FILTER (WHERE budget_type = 'PEMBIAYAAN_PENERIMAAN') AS masuk,
             SUM(ceiling_amount) FILTER (WHERE budget_type = 'PEMBIAYAAN_PENGELUARAN') AS keluar
           FROM "${schemaName}".village_budget_line WHERE village_budget_id = $1
         ) t
        WHERE b.id = $1`,
      [budgetId],
    );
  }

  private async catatBukuKas(
    client: PoolClient,
    schemaName: string,
    input: {
      unitId: string;
      transactionId: string;
      date: string;
      description: string;
      debit?: number;
      credit?: number;
    },
  ) {
    const tahun = Number(input.date.slice(0, 4));
    const urut = await client.query<{ n: string; saldo: string }>(
      `SELECT COALESCE(MAX(sequence_no), 0)::text AS n,
              COALESCE((SELECT running_balance FROM "${schemaName}".village_cash_book
                         WHERE village_unit_id = $1 AND fiscal_year = $2 AND book_type = 'KAS_UMUM'
                         ORDER BY sequence_no DESC LIMIT 1), 0)::text AS saldo
         FROM "${schemaName}".village_cash_book
        WHERE village_unit_id = $1 AND fiscal_year = $2 AND book_type = 'KAS_UMUM'`,
      [input.unitId, tahun],
    );

    const debit = input.debit ?? 0;
    const kredit = input.credit ?? 0;
    const saldo = Number(urut.rows[0].saldo) + debit - kredit;

    await client.query(
      `INSERT INTO "${schemaName}".village_cash_book
         (village_unit_id, fiscal_year, book_type, entry_date, sequence_no, description,
          debit_amount, credit_amount, running_balance, budget_transaction_id)
       VALUES ($1,$2,'KAS_UMUM',$3,$4,$5,$6,$7,$8,$9)`,
      [
        input.unitId,
        tahun,
        input.date,
        Number(urut.rows[0].n) + 1,
        input.description,
        debit,
        kredit,
        saldo,
        input.transactionId,
      ],
    );
  }

  /**
   * Menerbitkan peristiwa akuntansi lewat `accounting_event` milik Core.
   *
   * Village tidak membangun buku besar kedua. Yang dipakai adalah mesin
   * peristiwa yang sudah ada; yang milik village hanyalah kode peristiwanya dan
   * bagan akun APBDes-nya.
   */
  private async terbitkanPeristiwa(
    client: PoolClient,
    schemaName: string,
    input: {
      eventCode: VillageEventCode;
      sourceType: string;
      sourceId: string;
      amounts: Record<string, number>;
      userId: string;
    },
  ) {
    const v = periksaNilaiWajib(input.eventCode, input.amounts);
    if (!v.ok) {
      // Ditolak saat dibuat, ketika konteksnya masih ada. Peristiwa yang kurang
      // nilainya akan gagal saat dijurnal — jauh kemudian, dan tanpa petunjuk
      // dari mana ia berasal.
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        `Peristiwa ${input.eventCode} kurang nilai: ${v.missing.join(', ')}.`,
      );
    }

    await client.query(
      `INSERT INTO "${schemaName}".accounting_event
         (event_code, source_type, source_id, occurred_at, amounts, currency_code,
          status, idempotency_key, created_by)
       VALUES ($1,$2,$3, now(), $4, 'IDR', 'PENDING', $5, $6)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        input.eventCode,
        input.sourceType,
        input.sourceId,
        JSON.stringify(input.amounts),
        `${input.eventCode}:${input.sourceType}:${input.sourceId}`,
        input.userId,
      ],
    );
  }
}

/** Sisa yang tidak pernah negatif, untuk ditampilkan. */
function sisaAman(n: number): number {
  return n < 0 ? 0 : n;
}
