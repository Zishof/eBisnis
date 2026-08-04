/**
 * Settlement jasa: perhitungan, simulasi, penguncian, pembayaran, koreksi, dan
 * pernyataan.
 *
 * Aturannya ada di `health-settlement.ts` dan `health-fee.ts` sebagai fungsi
 * murni.
 *
 * Yang menentukan bentuk layanan ini: **tidak ada satu pun jalan yang
 * menghapus.** Settlement yang keliru dikoreksi; pernyataan yang keliru
 * dikoreksi dengan pernyataan kedua. Menghapusnya akan membuat kertas yang
 * sudah dipegang penerimanya tidak lagi cocok dengan apa pun — dan yang
 * dipegangnya tidak dapat ditarik kembali.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bagiJasa,
  bolehJadikanFinal,
  bolehPindahStatus,
  bolehSetujuiSettlement,
  type BarisKebijakan,
  type CaraBagi,
  type DasarPerhitungan,
  type PenerimaJasa,
  type StatusSettlement,
} from './health-fee';
import {
  bolehBayar,
  bolehKoreksi,
  bolehSetujuiKoreksi,
  bolehTerbitkanPernyataan,
  hitungPotonganPajak,
  periksaJumlahBaris,
  susunPernyataan,
  type BarisSettlement,
  type JenisKoreksi,
} from './health-settlement';

@Injectable()
export class HealthSettlementService {
  private readonly logger = new Logger(HealthSettlementService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Perhitungan -----------------------------------------------------------

  /**
   * Menghitung settlement dari satu kebijakan.
   *
   * Simulasi dan settlement sungguhan dihitung dengan jalan yang **sama** —
   * yang membedakan hanya tandanya, dan tanda itu tidak dapat diubah kemudian.
   * Menghitungnya dengan dua jalan berbeda akan membuat simulasi memberi angka
   * yang tidak pernah benar-benar terjadi.
   */
  async hitung(
    schema: string,
    input: {
      facilityId: string;
      policyId: string;
      periodYear: number;
      periodMonth?: number | null;
      basisAmount: number;
      taxRatePercent?: number;
      payerPaysByClaim?: boolean;
      isSimulation?: boolean;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    const kebijakan = await this.ambilKebijakan(schema, input.policyId);
    const simulasi = input.isSimulation ?? false;

    if (!kebijakan.active && !simulasi) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Kebijakan ini belum aktif. Settlement sungguhan hanya memakai kebijakan yang sudah ' +
          'disetujui; untuk mencobanya, jalankan sebagai simulasi.',
      );
    }

    const dasar = bolehJadikanFinal({
      basis: kebijakan.basis,
      payerPaysByClaim: input.payerPaysByClaim ?? false,
      isSimulation: simulasi,
    });
    if (!dasar.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        dasar.message ?? 'Dasar perhitungan tidak boleh dipakai untuk settlement final.',
      );
    }

    const bagian = bagiJasa({ basisAmount: input.basisAmount, lines: kebijakan.lines });

    const tarifPajak = input.taxRatePercent ?? 0;
    const baris: BarisSettlement[] = bagian.shares.map((s) => {
      const pajak = hitungPotonganPajak({
        grossAmount: s.amount,
        // Pajak hanya dipotong dari jasa perorangan; bagian fasilitas dan
        // kumpulan bukan penghasilan seseorang.
        taxRatePercent: s.providerId ? tarifPajak : 0,
      });
      return {
        recipient: s.recipient,
        providerId: s.providerId,
        grossAmount: s.amount,
        taxAmount: pajak.taxAmount,
        netAmount: pajak.netAmount,
      };
    });

    /*
     * Sisa yang tidak terbagi dijadikan baris bagian fasilitas, bukan dibuang.
     * Membuangnya berarti jumlah baris tidak sama dengan dasarnya, dan
     * pemeriksaan berikutnya akan menolak seluruh settlement tanpa ada yang
     * tahu ke mana sisanya pergi.
     */
    if (bagian.remainder > 0) {
      baris.push({
        recipient: 'FACILITY_FEE',
        providerId: null,
        grossAmount: bagian.remainder,
        taxAmount: 0,
        netAmount: bagian.remainder,
      });
    }

    const cocok = periksaJumlahBaris({ settledAmount: input.basisAmount, lines: baris });
    if (!cocok.valid) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        cocok.message ?? 'Jumlah baris settlement tidak cocok.',
        { difference: cocok.difference },
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorSettlement(client, schema, input.facilityId, simulasi);

      const kepala = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".fee_settlement
           (settlement_number, facility_id, policy_id, policy_version, basis,
            period_year, period_month, basis_amount, is_simulation, status,
            calculated_by, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id::text AS id`,
        [
          nomor,
          input.facilityId,
          input.policyId,
          kebijakan.version,
          kebijakan.basis,
          input.periodYear,
          input.periodMonth ?? null,
          input.basisAmount,
          simulasi,
          simulasi ? 'SIMULATED' : 'CALCULATED',
          actorUserId,
          input.note ?? null,
        ],
      );
      const settlementId = kepala.rows[0].id;

      for (const [i, b] of baris.entries()) {
        await client.query(
          `INSERT INTO "${schema}".fee_settlement_line
             (settlement_id, recipient, provider_id, gross_amount, tax_amount, net_amount,
              tax_rate_percent, method, basis_value)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            settlementId,
            b.recipient,
            b.providerId ?? null,
            b.grossAmount,
            b.taxAmount,
            b.netAmount,
            b.providerId ? tarifPajak : 0,
            bagian.shares[i]?.method ?? 'PERCENTAGE',
            bagian.shares[i]?.basisValue ?? null,
          ],
        );
      }

      return {
        id: settlementId,
        settlementNumber: nomor,
        isSimulation: simulasi,
        status: simulasi ? 'SIMULATED' : 'CALCULATED',
        policyVersion: kebijakan.version,
        lineCount: baris.length,
        note: simulasi
          ? 'Ini SIMULASI. Ia tidak akan pernah dapat dibayarkan; untuk membayarkannya, hitung ' +
            'ulang sebagai settlement sungguhan.'
          : null,
      };
    });
  }

  // --- Perpindahan status ----------------------------------------------------

  async setujui(schema: string, settlementId: string, note: string, approverId: string) {
    const s = await this.ambilSettlement(schema, settlementId);

    const pindah = bolehPindahStatus({ from: s.status, to: 'APPROVED' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }

    const izin = bolehSetujuiSettlement({ calculatedBy: s.calculatedBy, approverId });
    if (!izin.allowed) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.message ?? 'Persetujuan ditolak.');
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_settlement
          SET status = 'APPROVED', approved_by = $2, approved_at = now(),
              note = COALESCE(note, '') || $3, updated_at = now(), version = version + 1
        WHERE id = $1`,
      [settlementId, approverId, `\n[disetujui] ${note}`],
    );

    return { id: settlementId, status: 'APPROVED' };
  }

  async kunci(schema: string, settlementId: string) {
    const s = await this.ambilSettlement(schema, settlementId);
    const pindah = bolehPindahStatus({ from: s.status, to: 'LOCKED' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_settlement
          SET status = 'LOCKED', locked_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1`,
      [settlementId],
    );

    this.logger.log(
      `Settlement ${s.settlementNumber} dikunci; sejak ini kekeliruan diperbaiki lewat koreksi.`,
    );
    return {
      id: settlementId,
      status: 'LOCKED',
      note:
        'Sejak dikunci, settlement ini tidak dapat diubah maupun dihapus. Kekeliruan diperbaiki ' +
        'lewat penyesuaian atau pembalikan, yang keduanya meninggalkan barisnya sendiri.',
    };
  }

  async bayar(schema: string, settlementId: string, reference: string) {
    const s = await this.ambilSettlement(schema, settlementId);

    const izin = bolehBayar({ isSimulation: s.isSimulation, status: s.status });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Settlement belum dapat dibayarkan.',
      );
    }
    if (!reference.trim()) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Pembayaran wajib menyebutkan rujukan transaksinya. Pembayaran tanpa rujukan tidak ' +
          'dapat dicocokkan dengan rekening koran, dan yang tidak dapat dicocokkan akan ' +
          'dibayarkan dua kali.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_settlement
          SET status = 'PAID', paid_at = now(), paid_reference = $2,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [settlementId, reference],
    );

    return { id: settlementId, status: 'PAID', paidReference: reference };
  }

  // --- Koreksi ---------------------------------------------------------------

  async koreksi(
    schema: string,
    settlementId: string,
    input: { type: JenisKoreksi; amount: number; reason: string },
    actorUserId: string,
  ) {
    const s = await this.ambilSettlement(schema, settlementId);

    const sudah = await this.tenantDb.query<{ total: string }>(
      schema,
      `SELECT COALESCE(sum(amount), 0)::text AS total
         FROM "${schema}".fee_settlement_correction WHERE settlement_id = $1`,
      [settlementId],
    );

    const izin = bolehKoreksi({
      type: input.type,
      originalAmount: s.basisAmount,
      alreadyCorrected: Number(sudah[0].total),
      correctionAmount: input.amount,
      reason: input.reason,
      status: s.status,
      createdBy: actorUserId,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Koreksi ditolak.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".fee_settlement_correction
         (settlement_id, correction_type, amount, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id::text AS id`,
      [settlementId, input.type, input.amount, input.reason, actorUserId],
    );

    this.logger.warn(
      `Koreksi ${input.type} sebesar ${input.amount} atas settlement ${s.settlementNumber}.`,
    );
    return {
      id: rows[0].id,
      settlementId,
      type: input.type,
      amount: input.amount,
      resultingAmount: izin.resultingAmount,
      note: 'Koreksi ini belum berlaku sampai disetujui orang lain.',
    };
  }

  async setujuiKoreksi(schema: string, correctionId: string, approverId: string) {
    const rows = await this.tenantDb.query<{ created_by: string | null; approved_by: string | null }>(
      schema,
      `SELECT created_by::text AS created_by, approved_by::text AS approved_by
         FROM "${schema}".fee_settlement_correction WHERE id = $1`,
      [correctionId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Koreksi tidak ditemukan.');
    if (rows[0].approved_by) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Koreksi ini sudah disetujui.');
    }

    const izin = bolehSetujuiKoreksi({ createdBy: rows[0].created_by, approverId });
    if (!izin.allowed) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.message ?? 'Persetujuan ditolak.');
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_settlement_correction
          SET approved_by = $2, approved_at = now(), version = version + 1
        WHERE id = $1`,
      [correctionId, approverId],
    );
    return { id: correctionId, approved: true };
  }

  // --- Pernyataan ------------------------------------------------------------

  /**
   * Menerbitkan pernyataan bagi satu penerima.
   *
   * Hanya settlement yang **benar-benar dibayarkan** yang masuk. Pernyataan
   * yang memuat angka yang belum tentu dibayarkan akan dibaca sebagai janji —
   * dan janji yang tercetak lebih sulit ditarik daripada janji yang diucapkan.
   */
  async terbitkanPernyataan(
    schema: string,
    input: {
      facilityId: string;
      providerId: string;
      periodYear: number;
      periodMonth?: number | null;
      isCorrection?: boolean;
      correctsStatementId?: string | null;
    },
    actorUserId: string,
  ) {
    const baris = await this.tenantDb.query<{
      gross_amount: string;
      tax_amount: string;
      net_amount: string;
      is_simulation: boolean;
      status: StatusSettlement;
    }>(
      schema,
      `SELECT l.gross_amount::text, l.tax_amount::text, l.net_amount::text,
              s.is_simulation, s.status
         FROM "${schema}".fee_settlement_line l
         JOIN "${schema}".fee_settlement s ON s.id = l.settlement_id
        WHERE l.provider_id = $1 AND s.facility_id = $2
          AND s.period_year = $3
          AND ($4::int IS NULL OR s.period_month = $4)`,
      [input.providerId, input.facilityId, input.periodYear, input.periodMonth ?? null],
    );

    const koreksi = await this.tenantDb.query<{ amount: string }>(
      schema,
      `SELECT c.amount::text
         FROM "${schema}".fee_settlement_correction c
         JOIN "${schema}".fee_settlement s ON s.id = c.settlement_id
        WHERE s.facility_id = $1 AND s.period_year = $2
          AND ($3::int IS NULL OR s.period_month = $3)
          AND c.approved_by IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM "${schema}".fee_settlement_line l
             WHERE l.settlement_id = s.id AND l.provider_id = $4
          )`,
      [input.facilityId, input.periodYear, input.periodMonth ?? null, input.providerId],
    );

    const ringkas = susunPernyataan({
      providerId: input.providerId,
      settlements: baris.map((b) => ({
        grossAmount: Number(b.gross_amount),
        taxAmount: Number(b.tax_amount),
        netAmount: Number(b.net_amount),
        isSimulation: b.is_simulation,
        status: b.status,
      })),
      corrections: koreksi.map((c) => ({ amount: Number(c.amount) })),
    });

    const sebelumnya = await this.tenantDb.query<{ id: string; net_amount: string }>(
      schema,
      `SELECT id::text AS id, net_amount::text
         FROM "${schema}".fee_statement
        WHERE provider_id = $1 AND period_year = $2
          AND COALESCE(period_month, 0) = COALESCE($3::int, 0)
          AND is_correction = FALSE
        LIMIT 1`,
      [input.providerId, input.periodYear, input.periodMonth ?? null],
    );

    const izin = bolehTerbitkanPernyataan({
      alreadyIssued: sebelumnya.length > 0,
      previousNetAmount: sebelumnya.length ? Number(sebelumnya[0].net_amount) : null,
      netAmount: ringkas.statement.netAmount,
      isCorrection: input.isCorrection ?? false,
      correctsStatementId:
        input.correctsStatementId ?? (input.isCorrection ? sebelumnya[0]?.id : null),
    });
    if (!izin.allowed) {
      throw AppError.conflict(ErrorCodes.CONFLICT, izin.message ?? 'Pernyataan tidak diterbitkan.');
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorPernyataan(client, schema, input.facilityId);
      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".fee_statement
           (statement_number, facility_id, provider_id, period_year, period_month,
            gross_amount, tax_amount, adjustment_amount, net_amount, settlement_count,
            is_correction, corrects_statement_id, issued_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id::text AS id`,
        [
          nomor,
          input.facilityId,
          input.providerId,
          input.periodYear,
          input.periodMonth ?? null,
          ringkas.statement.grossAmount,
          ringkas.statement.taxAmount,
          ringkas.statement.adjustmentAmount,
          ringkas.statement.netAmount,
          ringkas.statement.settlementCount,
          input.isCorrection ?? false,
          input.correctsStatementId ?? (input.isCorrection ? sebelumnya[0]?.id : null),
          actorUserId,
        ],
      );

      return {
        id: rows.rows[0].id,
        statementNumber: nomor,
        ...ringkas.statement,
        excluded: ringkas.excluded,
        message: ringkas.message,
      };
    });
  }

  // --- Pembacaan -------------------------------------------------------------

  async daftar(schema: string, facilityId: string, year: number) {
    return this.tenantDb.query(
      schema,
      `SELECT s.id::text AS id, s.settlement_number, s.status, s.is_simulation,
              s.period_year, s.period_month, s.basis, s.basis_amount::float8 AS basis_amount,
              s.policy_version, p.code AS policy_code,
              s.calculated_at::text AS calculated_at, s.paid_at::text AS paid_at,
              count(l.id)::int AS line_count,
              COALESCE(sum(c.amount), 0)::float8 AS corrected_amount
         FROM "${schema}".fee_settlement s
         JOIN "${schema}".fee_policy p ON p.id = s.policy_id
         LEFT JOIN "${schema}".fee_settlement_line l ON l.settlement_id = s.id
         LEFT JOIN "${schema}".fee_settlement_correction c ON c.settlement_id = s.id
        WHERE s.facility_id = $1 AND s.period_year = $2
        GROUP BY s.id, p.code
        ORDER BY s.is_simulation, s.calculated_at DESC
        LIMIT 300`,
      [facilityId, year],
    );
  }

  async baca(schema: string, settlementId: string) {
    const s = await this.ambilSettlement(schema, settlementId);
    const baris = await this.tenantDb.query(
      schema,
      `SELECT l.recipient, l.provider_id::text AS provider_id, p.full_name AS provider_name,
              l.gross_amount::float8 AS gross_amount, l.tax_amount::float8 AS tax_amount,
              l.net_amount::float8 AS net_amount, l.method
         FROM "${schema}".fee_settlement_line l
         LEFT JOIN "${schema}".health_provider p ON p.id = l.provider_id
        WHERE l.settlement_id = $1
        ORDER BY l.gross_amount DESC`,
      [settlementId],
    );
    const koreksi = await this.tenantDb.query(
      schema,
      `SELECT id::text AS id, correction_type, amount::float8 AS amount, reason,
              created_at::text AS created_at, approved_at::text AS approved_at
         FROM "${schema}".fee_settlement_correction
        WHERE settlement_id = $1 ORDER BY created_at`,
      [settlementId],
    );

    return { id: settlementId, ...s, lines: baris, corrections: koreksi };
  }

  async daftarPernyataan(schema: string, providerId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, statement_number, period_year, period_month,
              gross_amount::float8 AS gross_amount, tax_amount::float8 AS tax_amount,
              adjustment_amount::float8 AS adjustment_amount,
              net_amount::float8 AS net_amount, settlement_count,
              is_correction, corrects_statement_id::text AS corrects_statement_id,
              issued_at::text AS issued_at
         FROM "${schema}".fee_statement
        WHERE provider_id = $1
        ORDER BY period_year DESC, period_month DESC NULLS LAST, issued_at DESC
        LIMIT 200`,
      [providerId],
    );
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilSettlement(schema: string, settlementId: string) {
    const rows = await this.tenantDb.query<{
      settlement_number: string;
      status: StatusSettlement;
      is_simulation: boolean;
      basis_amount: string;
      basis: DasarPerhitungan;
      policy_version: number;
      calculated_by: string | null;
      period_year: number;
      period_month: number | null;
    }>(
      schema,
      `SELECT settlement_number, status, is_simulation, basis_amount::text, basis,
              policy_version, calculated_by::text AS calculated_by, period_year, period_month
         FROM "${schema}".fee_settlement WHERE id = $1`,
      [settlementId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Settlement tidak ditemukan.');
    }
    return {
      settlementNumber: rows[0].settlement_number,
      status: rows[0].status,
      isSimulation: rows[0].is_simulation,
      basisAmount: Number(rows[0].basis_amount),
      basis: rows[0].basis,
      policyVersion: rows[0].policy_version,
      calculatedBy: rows[0].calculated_by,
      periodYear: rows[0].period_year,
      periodMonth: rows[0].period_month,
    };
  }

  private async ambilKebijakan(schema: string, policyId: string) {
    const kepala = await this.tenantDb.query<{
      code: string;
      basis: DasarPerhitungan;
      active: boolean;
      version: number;
    }>(
      schema,
      `SELECT code, basis, active, version FROM "${schema}".fee_policy WHERE id = $1`,
      [policyId],
    );
    if (!kepala.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kebijakan jasa tidak ditemukan.');
    }

    const baris = await this.tenantDb.query<{
      recipient: PenerimaJasa;
      method: CaraBagi;
      value: string;
      provider_id: string | null;
    }>(
      schema,
      `SELECT recipient, method, value::text, provider_id::text AS provider_id
         FROM "${schema}".fee_policy_line WHERE policy_id = $1 ORDER BY sort_order`,
      [policyId],
    );

    return {
      code: kepala[0].code,
      basis: kepala[0].basis,
      active: kepala[0].active,
      version: kepala[0].version,
      lines: baris.map((b) => ({
        recipient: b.recipient,
        method: b.method,
        value: Number(b.value),
        providerId: b.provider_id,
      })) as BarisKebijakan[],
    };
  }

  /**
   * Nomor settlement.
   *
   * Simulasi memakai awalan yang BERBEDA. Nomor yang tidak dapat dibedakan
   * antara simulasi dan settlement sungguhan akan tertukar pada percakapan
   * lisan — dan percakapan lisan adalah tempat sebagian besar kekeliruan
   * pembayaran bermula.
   */
  private async nomorSettlement(
    client: PoolClient,
    schema: string,
    facilityId: string,
    simulasi: boolean,
  ): Promise<string> {
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const awalan = simulasi ? 'SIM' : 'STL';

    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".fee_settlement
        WHERE facility_id = $1 AND is_simulation = $2 AND created_at::date = CURRENT_DATE`,
      [facilityId, simulasi],
    );
    return `${awalan}-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }

  private async nomorPernyataan(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".fee_statement
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `PJ-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
