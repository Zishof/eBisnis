/**
 * Siklus klaim internal.
 *
 * Aturannya ada di `health-claim.ts` sebagai fungsi murni.
 *
 * Yang menentukan bentuk layanan ini: **tiga angka tidak pernah dipertukarkan.**
 * Tidak ada satu pun jalan yang menyalin nilai diajukan ke nilai dibayar, atau
 * sebaliknya. Setiap kolom diisi oleh peristiwanya sendiri, dan selisih di
 * antaranya dihitung — tidak diasumsikan nol.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  bandingkanTigaAngka,
  bolehAjukan,
  bolehCatatKeputusan,
  bolehPindahStatusKlaim,
  rekonsiliasi,
  tandaiUntukTelaah,
  verifikasiInternal,
  type BerkasKlaim,
  type SebabPenolakan,
  type StatusKlaim,
} from './health-claim';

@Injectable()
export class HealthClaimService {
  private readonly logger = new Logger(HealthClaimService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Penyusunan ------------------------------------------------------------

  async buat(
    schema: string,
    input: {
      facilityId: string;
      encounterId?: string | null;
      admissionId?: string | null;
      payerCoverageId?: string | null;
      sepNumber?: string | null;
      membershipNumber?: string | null;
      billedClass?: string | null;
      entitledClass?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const konteks = await this.konteksKlaim(schema, input);

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorKlaim(client, schema, input.facilityId);

      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".health_claim
           (claim_number, facility_id, patient_id, encounter_id, admission_id, coding_id,
            payer_coverage_id, sep_number, membership_number, service_date,
            admitted_at, discharged_at, billed_class, entitled_class, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'DRAFT')
         RETURNING id::text AS id`,
        [
          nomor,
          input.facilityId,
          konteks.patientId,
          input.encounterId ?? null,
          input.admissionId ?? null,
          konteks.codingId,
          input.payerCoverageId ?? null,
          input.sepNumber ?? null,
          input.membershipNumber ?? null,
          konteks.serviceDate,
          konteks.admittedAt,
          konteks.dischargedAt,
          input.billedClass ?? null,
          input.entitledClass ?? null,
        ],
      );

      await this.audit.recordAccess(schema, {
        patientId: konteks.patientId,
        facilityId: input.facilityId,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'health_claim',
        entityId: rows.rows[0].id,
      });

      return { id: rows.rows[0].id, claimNumber: nomor, status: 'DRAFT' };
    });
  }

  /**
   * Verifikasi internal.
   *
   * Menemukan kekurangan **sebelum** penjamin menemukannya — bagian yang paling
   * sepele secara teknis dan paling berharga secara nyata. Klaim yang
   * dikembalikan karena berkasnya kurang menghabiskan waktu berminggu-minggu,
   * sedangkan seluruh kekurangannya dapat diperiksa mesin dalam hitungan detik.
   */
  async verifikasi(schema: string, claimId: string, ctx: KonteksAkses) {
    const klaim = await this.ambil(schema, claimId);

    if (klaim.codedBy && klaim.codedBy === ctx.actorUserId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Yang mengode tidak memverifikasi klaimnya sendiri. Verifikasi oleh yang mengodenya ' +
          'hanya membaca ulang pilihannya sendiri — ia akan menemukan salah ketik, tetapi tidak ' +
          'akan menemukan pilihan kode yang keliru, sebab pilihan itu masih tampak benar baginya.',
      );
    }

    const berkas = await this.berkasKlaim(schema, klaim);
    const hasil = verifikasiInternal(berkas);
    const penanda = await this.hitungPenanda(schema, claimId, klaim);

    return this.tenantDb.transaction(schema, async (client) => {
      const jenisSekarang = hasil.findings.map((t) => t.type);
      await client.query(
        `UPDATE "${schema}".health_claim_finding
            SET resolved_at = now()
          WHERE claim_id = $1 AND resolved_at IS NULL
            AND NOT (finding_type = ANY($2::varchar[]))`,
        [claimId, jenisSekarang.length ? jenisSekarang : ['__none__']],
      );

      for (const t of hasil.findings) {
        await client.query(
          `INSERT INTO "${schema}".health_claim_finding
             (claim_id, finding_type, message, blocks_submission, responsible_role)
           SELECT $1::uuid, $2::varchar, $3::text, $4::boolean, $5::varchar
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schema}".health_claim_finding
               WHERE claim_id = $1 AND finding_type = $2 AND resolved_at IS NULL
            )`,
          [claimId, t.type, t.message, t.blocksSubmission, t.responsibleRole],
        );
      }

      for (const f of penanda.flags) {
        await client.query(
          `INSERT INTO "${schema}".health_claim_flag (claim_id, flag_type, message)
           SELECT $1::uuid, $2::varchar, $3::text
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schema}".health_claim_flag
               WHERE claim_id = $1 AND flag_type = $2 AND reviewed_at IS NULL
            )`,
          [claimId, f.type, f.message],
        );
      }

      /*
       * Status berpindah ke INTERNALLY_VERIFIED hanya bila tidak ada yang
       * menahan. Penanda TIDAK menahan — ia hanya menyalakan needs_review.
       */
      if (hasil.blockingCount === 0) {
        await client.query(
          `UPDATE "${schema}".health_claim
              SET status = 'INTERNALLY_VERIFIED', verified_by = $2, verified_at = now(),
                  needs_review = $3, updated_at = now(), version = version + 1
            WHERE id = $1 AND status IN ('DRAFT','CODED','INTERNALLY_VERIFIED')`,
          [claimId, ctx.actorUserId, penanda.needsReview],
        );
      } else {
        await client.query(
          `UPDATE "${schema}".health_claim
              SET needs_review = $2, updated_at = now(), version = version + 1
            WHERE id = $1`,
          [claimId, penanda.needsReview],
        );
      }

      return {
        id: claimId,
        clean: hasil.clean,
        findings: hasil.findings,
        blockingCount: hasil.blockingCount,
        flags: penanda.flags,
        needsReview: penanda.needsReview,
        status: hasil.blockingCount === 0 ? 'INTERNALLY_VERIFIED' : klaim.status,
        flagNote: penanda.message,
      };
    });
  }

  /**
   * Mengajukan klaim.
   *
   * Penanda anti-fraud **tidak menahan** pengajuan. Ia sudah tercatat, dan
   * telaahnya berjalan sendiri.
   */
  async ajukan(
    schema: string,
    claimId: string,
    input: { submittedAmount: number },
    ctx: KonteksAkses,
  ) {
    const klaim = await this.ambil(schema, claimId);
    const temuan = await this.tenantDb.query<{
      finding_type: string;
      message: string;
      blocks_submission: boolean;
      responsible_role: string;
    }>(
      schema,
      `SELECT finding_type, message, blocks_submission, responsible_role
         FROM "${schema}".health_claim_finding
        WHERE claim_id = $1 AND resolved_at IS NULL`,
      [claimId],
    );

    const izin = bolehAjukan({
      verifikasi: {
        blockingCount: temuan.filter((t) => t.blocks_submission).length,
        findings: temuan.map((t) => ({
          type: t.finding_type as never,
          message: t.message,
          blocksSubmission: t.blocks_submission,
          responsibleRole: t.responsible_role,
        })),
      },
      status: klaim.status,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Klaim belum dapat diajukan.',
        { blockers: izin.blockers },
      );
    }

    if (input.submittedAmount < 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Nilai yang diajukan tidak boleh negatif.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_claim
          SET status = 'SUBMITTED', submitted_amount = $2, submitted_by = $3,
              submitted_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1`,
      [claimId, input.submittedAmount, ctx.actorUserId],
    );

    return {
      id: claimId,
      status: 'SUBMITTED',
      submittedAmount: input.submittedAmount,
      note: klaim.needsReview
        ? 'Klaim ini bertanda perlu ditelaah, dan penandanya TIDAK menahan pengajuan. Telaahnya ' +
          'berjalan sendiri — ia bukan tuduhan.'
        : null,
    };
  }

  // --- Keputusan penjamin ----------------------------------------------------

  /**
   * Mencatat keputusan penjamin.
   *
   * Yang disetujui adalah angka **kedua**, bukan pengganti angka pertama. Kolom
   * yang diajukan tidak tersentuh — dan basis data menolak setiap upaya
   * mengubahnya.
   */
  async catatKeputusan(
    schema: string,
    claimId: string,
    input: {
      approvedAmount: number;
      rejectionReason?: SebabPenolakan | null;
      rejectionNote?: string | null;
    },
  ) {
    const klaim = await this.ambil(schema, claimId);
    if (klaim.submittedAmount === null) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Klaim ini belum diajukan; belum ada keputusan yang dapat dicatat.',
      );
    }

    const izin = bolehCatatKeputusan({
      submittedAmount: klaim.submittedAmount,
      approvedAmount: input.approvedAmount,
      rejectionReason: input.rejectionReason ?? null,
      reasonNote: input.rejectionNote ?? null,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Keputusan tidak dapat dicatat.',
      );
    }

    const status: StatusKlaim =
      input.approvedAmount === 0
        ? 'REJECTED'
        : input.approvedAmount < klaim.submittedAmount
          ? 'PARTIALLY_APPROVED'
          : 'APPROVED';

    const pindah = bolehPindahStatusKlaim({ from: klaim.status, to: status });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_claim
          SET status = $2, approved_amount = $3, rejection_reason = $4, rejection_note = $5,
              decided_at = now(), updated_at = now(), version = version + 1
        WHERE id = $1`,
      [
        claimId,
        status,
        input.approvedAmount,
        input.rejectionReason ?? null,
        input.rejectionNote ?? null,
      ],
    );

    const banding = bandingkanTigaAngka({
      submittedAmount: klaim.submittedAmount,
      approvedAmount: input.approvedAmount,
    });

    if (banding.needsReview) {
      this.logger.warn(
        `Klaim ${klaim.claimNumber}: disetujui lebih besar daripada diajukan. Perlu telaah.`,
      );
    }

    return { id: claimId, status, ...banding };
  }

  async catatPembayaran(schema: string, claimId: string, paidAmount: number) {
    const klaim = await this.ambil(schema, claimId);
    const pindah = bolehPindahStatusKlaim({ from: klaim.status, to: 'PAID' });
    if (!pindah.allowed) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        pindah.message ?? 'Perpindahan status ditolak.',
      );
    }
    if (paidAmount < 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Nilai yang dibayar tidak boleh negatif.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_claim
          SET status = 'PAID', paid_amount = $2, paid_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [claimId, paidAmount],
    );

    return {
      id: claimId,
      status: 'PAID',
      ...bandingkanTigaAngka({
        submittedAmount: klaim.submittedAmount ?? 0,
        approvedAmount: klaim.approvedAmount,
        paidAmount,
        rejectionReason: klaim.rejectionReason,
      }),
    };
  }

  // --- Telaah penanda --------------------------------------------------------

  async telaahPenanda(
    schema: string,
    flagId: string,
    input: { outcome: string; note: string },
    ctx: KonteksAkses,
  ) {
    if (input.note.trim().length < 5) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Telaah wajib berketerangan. Penanda yang ditutup tanpa keterangan sama saja dengan ' +
          'penanda yang tidak pernah ada.',
      );
    }

    const rows = await this.tenantDb.query<{ claim_id: string }>(
      schema,
      `UPDATE "${schema}".health_claim_flag
          SET reviewed_by = $2, reviewed_at = now(), review_outcome = $3, review_note = $4
        WHERE id = $1 AND reviewed_at IS NULL
        RETURNING claim_id::text AS claim_id`,
      [flagId, ctx.actorUserId, input.outcome, input.note],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Penanda tidak ditemukan atau sudah ditelaah.',
      );
    }

    // Bila seluruh penandanya sudah ditelaah, needs_review padam sendiri.
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_claim
          SET needs_review = EXISTS (
                SELECT 1 FROM "${schema}".health_claim_flag
                 WHERE claim_id = $1 AND reviewed_at IS NULL
              ),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [rows[0].claim_id],
    );

    return { id: flagId, reviewed: true };
  }

  // --- Rekonsiliasi ----------------------------------------------------------

  async rekonsiliasi(
    schema: string,
    claimId: string,
    input: {
      payerStatedAmount: number;
      bankCreditedAmount: number;
      bankReference?: string | null;
      explanation?: string | null;
      close?: boolean;
    },
    ctx: KonteksAkses,
  ) {
    const klaim = await this.ambil(schema, claimId);
    if (klaim.paidAmount === null) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Klaim ini belum tercatat dibayar; belum ada yang dapat direkonsiliasi.',
      );
    }

    const hasil = rekonsiliasi({
      ourPaidAmount: klaim.paidAmount,
      payerStatedAmount: input.payerStatedAmount,
      bankCreditedAmount: input.bankCreditedAmount,
      explanation: input.explanation ?? null,
    });

    if (input.close && !hasil.canClose) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        hasil.message,
        { payerGap: hasil.payerGap, bankGap: hasil.bankGap },
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_claim_reconciliation
         (claim_id, our_paid_amount, payer_stated_amount, bank_credited_amount,
          payer_gap, bank_gap, bank_reference, explanation, closed_at, closed_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
               CASE WHEN $9::boolean THEN now() ELSE NULL END,
               CASE WHEN $9::boolean THEN $10::uuid ELSE NULL END, $10)
       RETURNING id::text AS id`,
      [
        claimId,
        klaim.paidAmount,
        input.payerStatedAmount,
        input.bankCreditedAmount,
        hasil.payerGap,
        hasil.bankGap,
        input.bankReference ?? null,
        input.explanation ?? null,
        input.close ?? false,
        ctx.actorUserId,
      ],
    );

    if (input.close && hasil.canClose) {
      await this.tenantDb.query(
        schema,
        `UPDATE "${schema}".health_claim
            SET status = 'RECONCILED', reconciled_by = $2, reconciled_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1 AND status = 'PAID'`,
        [claimId, ctx.actorUserId],
      );
    }

    return { id: rows[0].id, claimId, ...hasil };
  }

  // --- Pembacaan -------------------------------------------------------------

  async daftarKerja(schema: string, facilityId: string, status?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT c.id::text AS id, c.claim_number, c.status, c.service_date::text AS service_date,
              c.submitted_amount::float8 AS submitted_amount,
              c.approved_amount::float8 AS approved_amount,
              c.paid_amount::float8 AS paid_amount,
              c.rejection_reason, c.needs_review,
              p.full_name AS patient_name,
              count(f.id) FILTER (WHERE f.resolved_at IS NULL AND f.blocks_submission)::int
                AS blocking_findings,
              count(g.id) FILTER (WHERE g.reviewed_at IS NULL)::int AS open_flags
         FROM "${schema}".health_claim c
         JOIN "${schema}".patient p ON p.id = c.patient_id
         LEFT JOIN "${schema}".health_claim_finding f ON f.claim_id = c.id
         LEFT JOIN "${schema}".health_claim_flag g ON g.claim_id = c.id
        WHERE c.facility_id = $1
          AND ($2::text IS NULL OR c.status = $2)
        GROUP BY c.id, p.full_name
        ORDER BY c.needs_review DESC, c.service_date DESC
        LIMIT 300`,
      [facilityId, status ?? null],
    );
  }

  async baca(schema: string, claimId: string) {
    const klaim = await this.ambil(schema, claimId);
    const temuan = await this.tenantDb.query(
      schema,
      `SELECT finding_type, message, blocks_submission, responsible_role,
              detected_at::text AS detected_at, resolved_at::text AS resolved_at
         FROM "${schema}".health_claim_finding WHERE claim_id = $1
        ORDER BY blocks_submission DESC, detected_at`,
      [claimId],
    );
    const penanda = await this.tenantDb.query(
      schema,
      `SELECT id::text AS id, flag_type, message, raised_at::text AS raised_at,
              reviewed_at::text AS reviewed_at, review_outcome, review_note
         FROM "${schema}".health_claim_flag WHERE claim_id = $1 ORDER BY raised_at`,
      [claimId],
    );

    return {
      id: claimId,
      ...klaim,
      ...bandingkanTigaAngka({
        submittedAmount: klaim.submittedAmount ?? 0,
        approvedAmount: klaim.approvedAmount,
        paidAmount: klaim.paidAmount,
        rejectionReason: klaim.rejectionReason,
      }),
      findings: temuan,
      flags: penanda,
    };
  }

  /**
   * Laporan sebab penolakan.
   *
   * Inilah yang membuat sebab penolakan harus berupa kode tertutup: laporan ini
   * tidak dapat disusun dari teks bebas.
   */
  async laporanPenolakan(schema: string, facilityId: string, year: number) {
    return this.tenantDb.query(
      schema,
      `SELECT rejection_reason,
              count(*)::int AS claim_count,
              COALESCE(sum(submitted_amount - approved_amount), 0)::float8 AS total_gap
         FROM "${schema}".health_claim
        WHERE facility_id = $1
          AND EXTRACT(YEAR FROM service_date) = $2
          AND rejection_reason IS NOT NULL
        GROUP BY rejection_reason
        ORDER BY sum(submitted_amount - approved_amount) DESC NULLS LAST`,
      [facilityId, year],
    );
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambil(schema: string, claimId: string) {
    const rows = await this.tenantDb.query<{
      claim_number: string;
      status: StatusKlaim;
      patient_id: string;
      facility_id: string;
      encounter_id: string | null;
      admission_id: string | null;
      coding_id: string | null;
      sep_number: string | null;
      service_date: string;
      admitted_at: string | null;
      discharged_at: string | null;
      billed_class: string | null;
      entitled_class: string | null;
      submitted_amount: string | null;
      approved_amount: string | null;
      paid_amount: string | null;
      rejection_reason: SebabPenolakan | null;
      needs_review: boolean;
      coded_by: string | null;
    }>(
      schema,
      `SELECT claim_number, status, patient_id::text AS patient_id,
              facility_id::text AS facility_id, encounter_id::text AS encounter_id,
              admission_id::text AS admission_id, coding_id::text AS coding_id,
              sep_number, service_date::text AS service_date,
              admitted_at::text AS admitted_at, discharged_at::text AS discharged_at,
              billed_class, entitled_class,
              submitted_amount::text, approved_amount::text, paid_amount::text,
              rejection_reason, needs_review, coded_by::text AS coded_by
         FROM "${schema}".health_claim WHERE id = $1`,
      [claimId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Klaim tidak ditemukan.');
    const r = rows[0];
    return {
      claimNumber: r.claim_number,
      status: r.status,
      patientId: r.patient_id,
      facilityId: r.facility_id,
      encounterId: r.encounter_id,
      admissionId: r.admission_id,
      codingId: r.coding_id,
      sepNumber: r.sep_number,
      serviceDate: r.service_date,
      admittedAt: r.admitted_at,
      dischargedAt: r.discharged_at,
      billedClass: r.billed_class,
      entitledClass: r.entitled_class,
      submittedAmount: r.submitted_amount === null ? null : Number(r.submitted_amount),
      approvedAmount: r.approved_amount === null ? null : Number(r.approved_amount),
      paidAmount: r.paid_amount === null ? null : Number(r.paid_amount),
      rejectionReason: r.rejection_reason,
      needsReview: r.needs_review,
      codedBy: r.coded_by,
    };
  }

  /** Menyusun gambaran berkas klaim dari apa yang sudah dikerjakan H-3..H-9. */
  private async berkasKlaim(
    schema: string,
    klaim: Awaited<ReturnType<HealthClaimService['ambil']>>,
  ): Promise<BerkasKlaim> {
    const rows = await this.tenantDb.query<{
      principal_count: string;
      invalid_codes: string;
      procedure_count: string;
      coded_procedures: string;
      has_summary: boolean;
      summary_signed: boolean;
      unsigned_notes: string;
      has_attending: boolean;
    }>(
      schema,
      `SELECT
         (SELECT count(*) FROM "${schema}".him_coded_item i
           WHERE i.coding_id = $1 AND i.is_principal = TRUE AND i.item_type = 'DIAGNOSIS')::text
           AS principal_count,
         (SELECT count(*) FROM "${schema}".him_coded_item i
           LEFT JOIN "${schema}".terminology_code tc
             ON tc.code = i.code AND tc.system = i.code_system
          WHERE i.coding_id = $1 AND tc.id IS NULL)::text AS invalid_codes,
         (SELECT count(*) FROM "${schema}".him_coded_item i
           WHERE i.coding_id = $1 AND i.item_type = 'PROCEDURE')::text AS procedure_count,
         (SELECT count(*) FROM "${schema}".him_coded_item i
           WHERE i.coding_id = $1 AND i.item_type = 'PROCEDURE')::text AS coded_procedures,
         COALESCE((SELECT count(*) > 0 FROM "${schema}".health_discharge_summary s
           WHERE s.admission_id = $2), FALSE) AS has_summary,
         COALESCE((SELECT count(*) > 0 FROM "${schema}".health_discharge_summary s
           WHERE s.admission_id = $2 AND s.signed_at IS NOT NULL), FALSE) AS summary_signed,
         (SELECT count(*) FROM "${schema}".clinical_note n
           WHERE n.encounter_id = $3 AND n.signed_at IS NULL)::text AS unsigned_notes,
         COALESCE((SELECT e.provider_id IS NOT NULL FROM "${schema}".health_encounter e
           WHERE e.id = $3), TRUE) AS has_attending`,
      [klaim.codingId, klaim.admissionId, klaim.encounterId],
    );
    const r = rows[0];

    return {
      principalDiagnosisCount: Number(r.principal_count),
      invalidCodeCount: Number(r.invalid_codes),
      procedureCount: Number(r.procedure_count),
      codedProcedureCount: Number(r.coded_procedures),
      hasDischargeSummary: r.has_summary,
      dischargeSummarySigned: r.summary_signed,
      referencedResultCount: 0,
      availableResultCount: 0,
      sepNumber: klaim.sepNumber,
      sepEncounterMatches: true,
      admittedAt: klaim.admittedAt,
      dischargedAt: klaim.dischargedAt,
      billedClass: klaim.billedClass,
      entitledClass: klaim.entitledClass,
      hasAttendingSignature: r.has_attending && Number(r.unsigned_notes) === 0,
      isInpatient: Boolean(klaim.admissionId),
    };
  }

  private async hitungPenanda(
    schema: string,
    claimId: string,
    klaim: Awaited<ReturnType<HealthClaimService['ambil']>>,
  ) {
    const rows = await this.tenantDb.query<{ duplicate: boolean; days_since: string | null }>(
      schema,
      `SELECT
         EXISTS (
           SELECT 1 FROM "${schema}".health_claim c2
            WHERE c2.patient_id = $1 AND c2.service_date = $2::date
              AND c2.id <> $3 AND c2.status <> 'CANCELLED'
         ) AS duplicate,
         (SELECT ($2::date - max(a.discharged_at)::date)::text
            FROM "${schema}".health_admission a
           WHERE a.patient_id = $1 AND a.discharged_at IS NOT NULL
             AND a.discharged_at::date < $2::date) AS days_since`,
      [klaim.patientId, klaim.serviceDate, claimId],
    );

    const lama =
      klaim.admittedAt && klaim.dischargedAt
        ? Math.max(
            0,
            Math.round(
              (Date.parse(klaim.dischargedAt) - Date.parse(klaim.admittedAt)) / 86400000,
            ),
          )
        : null;

    return tandaiUntukTelaah({
      duplicateOnSameMemberAndDate: rows[0]?.duplicate ?? false,
      lengthOfStayDays: lama,
      typicalLengthOfStayDays: lama === null ? null : 4,
      procedureUnusualForDiagnosis: false,
      daysSincePreviousDischarge:
        rows[0]?.days_since === null || rows[0]?.days_since === undefined
          ? null
          : Number(rows[0].days_since),
    });
  }

  private async konteksKlaim(
    schema: string,
    input: { encounterId?: string | null; admissionId?: string | null },
  ) {
    if (!input.encounterId && !input.admissionId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Salah satu dari encounterId atau admissionId wajib diisi.',
      );
    }

    if (input.admissionId) {
      const rows = await this.tenantDb.query<{
        patient_id: string;
        admitted_at: string;
        discharged_at: string | null;
        coding_id: string | null;
      }>(
        schema,
        `SELECT a.patient_id::text AS patient_id, a.admitted_at::text AS admitted_at,
                a.discharged_at::text AS discharged_at,
                (SELECT c.id::text FROM "${schema}".him_coding c
                  WHERE c.admission_id = a.id LIMIT 1) AS coding_id
           FROM "${schema}".health_admission a WHERE a.id = $1`,
        [input.admissionId],
      );
      if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');
      return {
        patientId: rows[0].patient_id,
        serviceDate: rows[0].admitted_at.slice(0, 10),
        admittedAt: rows[0].admitted_at,
        dischargedAt: rows[0].discharged_at,
        codingId: rows[0].coding_id,
      };
    }

    const rows = await this.tenantDb.query<{
      patient_id: string;
      started_at: string;
      coding_id: string | null;
    }>(
      schema,
      `SELECT e.patient_id::text AS patient_id, e.started_at::text AS started_at,
              (SELECT c.id::text FROM "${schema}".him_coding c
                WHERE c.encounter_id = e.id LIMIT 1) AS coding_id
         FROM "${schema}".health_encounter e WHERE e.id = $1`,
      [input.encounterId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');
    return {
      patientId: rows[0].patient_id,
      serviceDate: rows[0].started_at.slice(0, 10),
      admittedAt: null,
      dischargedAt: null,
      codingId: rows[0].coding_id,
    };
  }

  private async nomorKlaim(
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
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".health_claim
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `KLM-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
