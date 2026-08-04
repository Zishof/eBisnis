/**
 * Kontrak fee sistem dan fee investor.
 *
 * Aturannya ada di `health-fee-contract.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak pernah mengembalikan fee tanpa kontrak.** Setiap
 * perhitungan melewati `hitungFeeKontrak`, dan tanpa kontrak yang aktif
 * jawabannya nol beserta sebabnya. Mengembalikan nilai bawaan yang kecil akan
 * membuat fee muncul pada tagihan yang tidak pernah disepakati siapa pun.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehAktifkanKontrak,
  bolehPindahStatusKontrak,
  hitungFeeKontrak,
  periksaRantai,
  saringUntukInvestor,
  type JenisKontrakFee,
  type StatusKontrak,
} from './health-fee-contract';

@Injectable()
export class HealthFeeContractService {
  private readonly logger = new Logger(HealthFeeContractService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Penyusunan ------------------------------------------------------------

  async susun(
    schema: string,
    input: {
      facilityId: string;
      contractType: JenisKontrakFee;
      counterpartyName: string;
      contractReference?: string | null;
      taxTreatment?: string | null;
      maximumPercent?: number | null;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      isSampleData?: boolean;
    },
    actorUserId: string,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".fee_contract
         (facility_id, contract_type, counterparty_name, contract_reference,
          tax_treatment, maximum_percent, effective_from, effective_to,
          status, prepared_by, prepared_at, is_sample_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DRAFT',$9,now(),$10)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.contractType,
        input.counterpartyName,
        input.contractReference ?? null,
        input.taxTreatment ?? null,
        input.maximumPercent ?? null,
        input.effectiveFrom ?? null,
        input.effectiveTo ?? null,
        actorUserId,
        input.isSampleData ?? false,
      ],
    );

    return {
      id: rows[0].id,
      status: 'DRAFT',
      note:
        'Kontrak disusun sebagai DRAFT. Sampai ia aktif, fee-nya nol — dan aktivasinya menuntut ' +
        'telaah hukum serta persetujuan manajemen oleh dua orang lain.',
    };
  }

  /** Menelaah hukum. Pemeriksa harus berbeda dari penyusunnya. */
  async telaah(schema: string, contractId: string, note: string, reviewerId: string) {
    const k = await this.ambil(schema, contractId);

    const pindah = bolehPindahStatusKontrak({ from: k.status, to: 'LEGAL_REVIEW' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }
    if (k.preparedBy && k.preparedBy === reviewerId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Penyusun kontrak tidak menelaah hukumnya sendiri. Telaah yang dilakukan penyusunnya ' +
          'hanya membaca ulang kalimat yang baru saja ditulisnya.',
      );
    }
    if (note.trim().length < 10) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Telaah hukum wajib menyebutkan apa yang diperiksa. Catatan, bukan kotak centang — ' +
          'kotak centang dapat dicentang siapa saja, dan yang membacanya kelak menuntut ' +
          'alasannya.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_contract
          SET status = 'LEGAL_REVIEW', legal_review_note = $2,
              legal_reviewed_by = $3, legal_reviewed_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [contractId, note, reviewerId],
    );

    return { id: contractId, status: 'LEGAL_REVIEW' };
  }

  /** Menyetujui atas nama manajemen. Penyetuju harus berbeda dari keduanya. */
  async setujui(schema: string, contractId: string, note: string, approverId: string) {
    const k = await this.ambil(schema, contractId);

    const pindah = bolehPindahStatusKontrak({ from: k.status, to: 'MANAGEMENT_APPROVAL' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }

    const rantai = periksaRantai({
      preparedBy: k.preparedBy,
      reviewedBy: k.legalReviewedBy,
      approvedBy: approverId,
    });
    if (!rantai.valid) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, rantai.message ?? 'Rantai tidak sah.');
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_contract
          SET status = 'MANAGEMENT_APPROVAL', approved_by = $2, approved_at = now(),
              approval_note = $3, updated_at = now(), version = version + 1
        WHERE id = $1`,
      [contractId, approverId, note],
    );

    return { id: contractId, status: 'MANAGEMENT_APPROVAL' };
  }

  /**
   * Mengaktifkan kontrak.
   *
   * Menuntut seluruh syaratnya — dan yang kurang disebutkan satu per satu.
   */
  async aktifkan(schema: string, contractId: string) {
    const k = await this.ambil(schema, contractId);

    const pindah = bolehPindahStatusKontrak({ from: k.status, to: 'ACTIVE' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }

    const izin = bolehAktifkanKontrak({
      contractType: k.contractType,
      contractReference: k.contractReference,
      legalReviewNote: k.legalReviewNote,
      taxTreatment: k.taxTreatment,
      maximumPercent: k.maximumPercent,
      effectiveFrom: k.effectiveFrom,
      effectiveTo: k.effectiveTo,
      legalReviewedAt: k.legalReviewedAt,
      chain: {
        preparedBy: k.preparedBy,
        reviewedBy: k.legalReviewedBy,
        approvedBy: k.approvedBy,
      },
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message,
        { missing: izin.missing },
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_contract
          SET status = 'ACTIVE', updated_at = now(), version = version + 1
        WHERE id = $1`,
      [contractId],
    );

    this.logger.warn(
      `Kontrak ${k.contractType} ${k.contractReference} diaktifkan pada batas ` +
        `${k.maximumPercent}%; sejak ini fee-nya diambil dari kumpulan jasa.`,
    );
    return { id: contractId, status: 'ACTIVE', maximumPercent: k.maximumPercent };
  }

  async akhiri(schema: string, contractId: string, reason: string) {
    const k = await this.ambil(schema, contractId);
    const pindah = bolehPindahStatusKontrak({ from: k.status, to: 'TERMINATED' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }
    if (reason.trim().length < 5) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Pengakhiran kontrak wajib menyebutkan sebabnya.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_contract
          SET status = 'TERMINATED', terminated_at = now(), terminate_reason = $2,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [contractId, reason],
    );
    return {
      id: contractId,
      status: 'TERMINATED',
      note:
        'Kontrak yang sudah diakhiri tidak dihidupkan kembali. Yang hendak melanjutkannya ' +
        'membuat kontrak baru, dan kontrak baru menuntut telaah hukum baru.',
    };
  }

  // --- Pengecualian ----------------------------------------------------------

  async kecualikanLayanan(
    schema: string,
    contractId: string,
    input: { serviceId?: string | null; serviceType?: string | null; reason: string },
    actorUserId: string,
  ) {
    if (!input.serviceId && !input.serviceType) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Salah satu dari serviceId atau serviceType wajib diisi.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".fee_contract_exclusion
         (contract_id, service_id, service_type, reason, created_by)
       VALUES ($1,$2,$3,$4,$5) RETURNING id::text AS id`,
      [contractId, input.serviceId ?? null, input.serviceType ?? null, input.reason, actorUserId],
    );
    return { id: rows[0].id, contractId };
  }

  // --- Penerapan -------------------------------------------------------------

  /**
   * Menghitung fee kontrak, dan **mencatat penerapannya**.
   *
   * Tanpa jejak ini, pertanyaan "mengapa fee bulan lalu segini" hanya dapat
   * dijawab dengan menghitung ulang memakai kontrak hari ini — dan kontrak hari
   * ini mungkin sudah berbeda.
   */
  async terapkan(
    schema: string,
    input: {
      facilityId: string;
      contractType: JenisKontrakFee;
      requestedPercent: number;
      baseAmount: number;
      serviceId?: string | null;
      settlementId?: string | null;
      onDate?: string;
      record?: boolean;
    },
    actorUserId: string,
  ) {
    const tanggal = input.onDate ?? new Date().toISOString().slice(0, 10);

    const rows = await this.tenantDb.query<{
      id: string;
      status: StatusKontrak;
      maximum_percent: string | null;
      effective_from: string | null;
      effective_to: string | null;
    }>(
      schema,
      `SELECT id::text AS id, status, maximum_percent::text,
              effective_from::text, effective_to::text
         FROM "${schema}".fee_contract
        WHERE facility_id = $1 AND contract_type = $2 AND status = 'ACTIVE'
        LIMIT 1`,
      [input.facilityId, input.contractType],
    );

    let kontrak = null;
    let dikecualikan: string[] = [];
    if (rows.length) {
      const pengecualian = await this.tenantDb.query<{ service_id: string }>(
        schema,
        `SELECT service_id::text AS service_id FROM "${schema}".fee_contract_exclusion
          WHERE contract_id = $1 AND service_id IS NOT NULL`,
        [rows[0].id],
      );
      dikecualikan = pengecualian.map((p) => p.service_id);

      kontrak = {
        contractType: input.contractType,
        status: rows[0].status,
        maximumPercent: Number(rows[0].maximum_percent ?? 0),
        effectiveFrom: rows[0].effective_from ?? '1970-01-01',
        effectiveTo: rows[0].effective_to,
        excludedServiceIds: dikecualikan,
      };
    }

    const hasil = hitungFeeKontrak({
      contract: kontrak,
      requestedPercent: input.requestedPercent,
      baseAmount: input.baseAmount,
      serviceId: input.serviceId ?? null,
      onDate: tanggal,
    });

    if (input.record !== false) {
      await this.tenantDb.query(
        schema,
        `INSERT INTO "${schema}".fee_contract_application
           (contract_id, settlement_id, facility_id, contract_type, base_amount,
            requested_percent, applied_percent, fee_amount, was_capped, reason,
            applied_on, applied_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          rows[0]?.id ?? null,
          input.settlementId ?? null,
          input.facilityId,
          input.contractType,
          input.baseAmount,
          input.requestedPercent,
          hasil.appliedPercent,
          hasil.feeAmount,
          hasil.capped,
          hasil.message,
          tanggal,
          actorUserId,
        ],
      );
    }

    return { ...hasil, contractId: rows[0]?.id ?? null, hasContract: rows.length > 0 };
  }

  // --- Pembacaan -------------------------------------------------------------

  async daftar(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT c.id::text AS id, c.contract_type, c.contract_reference, c.counterparty_name,
              c.status, c.maximum_percent::float8 AS maximum_percent,
              c.effective_from::text AS effective_from, c.effective_to::text AS effective_to,
              c.legal_reviewed_at::text AS legal_reviewed_at,
              c.approved_at::text AS approved_at, c.is_sample_data,
              count(e.id)::int AS exclusion_count
         FROM "${schema}".fee_contract c
         LEFT JOIN "${schema}".fee_contract_exclusion e ON e.contract_id = c.id
        WHERE c.facility_id = $1
        GROUP BY c.id
        ORDER BY c.status, c.created_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  async jejakPenerapan(schema: string, contractId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, base_amount::float8 AS base_amount,
              requested_percent::float8 AS requested_percent,
              applied_percent::float8 AS applied_percent,
              fee_amount::float8 AS fee_amount, was_capped, reason,
              applied_on::text AS applied_on
         FROM "${schema}".fee_contract_application
        WHERE contract_id = $1
        ORDER BY applied_on DESC, created_at DESC
        LIMIT 300`,
      [contractId],
    );
  }

  /**
   * Ringkasan bagi pemegang kontrak investor.
   *
   * Disaring lewat daftar putih, dan yang tersaring **dilaporkan jumlahnya**.
   * Penyaringan yang tidak terlihat akan dianggap tidak ada, lalu seseorang
   * akan menambahkan medan baru tanpa memeriksanya.
   */
  async ringkasanInvestor(schema: string, facilityId: string, year: number) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT $2::int AS "periodYear",
              count(DISTINCT s.facility_id)::int AS "facilityCount",
              COALESCE(sum(s.basis_amount), 0)::float8 AS "grossRevenue",
              COALESCE(sum(a.fee_amount), 0)::float8 AS "distributionAmount",
              max(c.contract_reference) AS "contractReference"
         FROM "${schema}".fee_settlement s
         LEFT JOIN "${schema}".fee_contract_application a
           ON a.settlement_id = s.id AND a.contract_type = 'INVESTOR_SHARE'
         LEFT JOIN "${schema}".fee_contract c ON c.id = a.contract_id
        WHERE s.facility_id = $1 AND s.period_year = $2 AND s.is_simulation = FALSE`,
      [facilityId, year],
    );

    const saring = saringUntukInvestor(rows[0] ?? {});
    return {
      ...saring.visible,
      _filtered: saring.removedCount,
      note:
        'Ringkasan ini disaring lewat daftar PUTIH medan yang boleh dilihat pemegang kontrak ' +
        'investor. Tidak ada satu pun medan pasien di dalamnya, dan medan baru yang ditambahkan ' +
        'kelak tertolak sampai ia sengaja dimasukkan ke daftar itu.',
    };
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambil(schema: string, contractId: string) {
    const rows = await this.tenantDb.query<{
      contract_type: JenisKontrakFee;
      contract_reference: string | null;
      status: StatusKontrak;
      legal_review_note: string | null;
      legal_reviewed_by: string | null;
      legal_reviewed_at: string | null;
      tax_treatment: string | null;
      maximum_percent: string | null;
      effective_from: string | null;
      effective_to: string | null;
      prepared_by: string | null;
      approved_by: string | null;
      is_sample_data: boolean;
    }>(
      schema,
      `SELECT contract_type, contract_reference, status, legal_review_note,
              legal_reviewed_by::text AS legal_reviewed_by,
              legal_reviewed_at::text AS legal_reviewed_at,
              tax_treatment, maximum_percent::text,
              effective_from::text, effective_to::text,
              prepared_by::text AS prepared_by, approved_by::text AS approved_by,
              is_sample_data
         FROM "${schema}".fee_contract WHERE id = $1`,
      [contractId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kontrak fee tidak ditemukan.');
    }
    const r = rows[0];
    return {
      contractType: r.contract_type,
      contractReference: r.contract_reference,
      status: r.status,
      legalReviewNote: r.legal_review_note,
      legalReviewedBy: r.legal_reviewed_by,
      legalReviewedAt: r.legal_reviewed_at,
      taxTreatment: r.tax_treatment,
      maximumPercent: r.maximum_percent === null ? null : Number(r.maximum_percent),
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to,
      preparedBy: r.prepared_by,
      approvedBy: r.approved_by,
      isSampleData: r.is_sample_data,
    };
  }
}
