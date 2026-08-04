/**
 * Rekam medis, pengkodean, mutu, dan keselamatan pasien.
 *
 * Aturannya ada di `health-him.ts` sebagai fungsi murni.
 *
 * Yang menentukan bentuk layanan ini: **kekurangan berkas disimpan sebagai
 * baris, bukan sebagai angka.** Kekurangan yang hanya berupa hitungan tidak
 * dapat ditugaskan kepada siapa pun, tidak dapat dilacak penyelesaiannya, dan
 * tidak dapat dihitung polanya. Angka "kelengkapan 82%" berguna bagi manajemen
 * yang membandingkan bulan; ia tidak berguna sama sekali bagi dokter yang harus
 * memperbaiki berkasnya sore ini.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  bolehKode,
  bolehLepasInformasi,
  bolehPakaiKode,
  bolehTutupInsiden,
  bolehUbahSaatDitahan,
  bolehVerifikasiKoding,
  hitungIndikator,
  klasifikasiInsiden,
  periksaKelengkapan,
  skorKelengkapan,
  urutkanInsiden,
  type BerkasRekamMedis,
  type KodeTerminologi,
  type PemintaInformasi,
  type TingkatBahaya,
} from './health-him';

@Injectable()
export class HealthHimService {
  private readonly logger = new Logger(HealthHimService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Kelengkapan dan pengkodean --------------------------------------------

  /**
   * Memeriksa kelengkapan satu kunjungan dan menyimpan kekurangannya.
   *
   * Kekurangan yang **sudah tidak ada lagi** ditutup, bukan dibiarkan
   * menggantung. Daftar kekurangan yang memuat hal-hal yang sudah diperbaiki
   * akan diabaikan seluruhnya — termasuk yang belum diperbaiki.
   */
  async periksaBerkas(
    schema: string,
    input: { encounterId?: string | null; admissionId?: string | null },
    ctx: KonteksAkses,
  ) {
    const konteks = await this.konteksBerkas(schema, input);
    const hasil = periksaKelengkapan(konteks.berkas);

    /*
     * Indeks uniknya PARSIAL — satu berkas ditandai kunjungan atau perawatan,
     * tidak keduanya. PostgreSQL hanya mengenali indeks parsial pada ON CONFLICT
     * bila predikatnya ikut disebutkan; tanpa itu ia menolak seluruh pernyataan.
     */
    const kunci = input.encounterId
      ? '(encounter_id) WHERE encounter_id IS NOT NULL'
      : '(admission_id) WHERE admission_id IS NOT NULL';

    return this.tenantDb.transaction(schema, async (client) => {
      const coding = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".him_coding
           (encounter_id, admission_id, patient_id, facility_id, service_date,
            encounter_type, deficiency_count, blocking_count, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
         ON CONFLICT ${kunci} DO UPDATE SET
           deficiency_count = EXCLUDED.deficiency_count,
           blocking_count = EXCLUDED.blocking_count,
           checked_at = now(),
           updated_at = now(),
           version = "${schema}".him_coding.version + 1
         RETURNING id::text AS id`,
        [
          input.encounterId ?? null,
          input.admissionId ?? null,
          konteks.patientId,
          konteks.facilityId,
          konteks.serviceDate,
          konteks.berkas.encounterType,
          hasil.deficiencies.length,
          hasil.blockingCount,
        ],
      );
      const codingId = coding.rows[0].id;

      /*
       * Kekurangan yang sudah tidak muncul lagi ditutup dengan waktu
       * penyelesaiannya. Menghapusnya akan menghilangkan jejak bahwa ia pernah
       * ada — dan laporan mutu yang tidak dapat menghitung berapa lama sebuah
       * kekurangan menggantung tidak dapat memperbaiki sebabnya.
       */
      const jenisSekarang = hasil.deficiencies.map((d) => d.type);
      await client.query(
        `UPDATE "${schema}".him_deficiency
            SET resolved_at = now()
          WHERE coding_id = $1 AND resolved_at IS NULL
            AND NOT (deficiency_type = ANY($2::varchar[]))`,
        [codingId, jenisSekarang.length ? jenisSekarang : ['__none__']],
      );

      for (const d of hasil.deficiencies) {
        await client.query(
          // Tipe tiap parameter disebutkan: $1 dan $2 dipakai dua kali, dan
          // PostgreSQL menyimpulkan tipe yang berbeda pada kedua tempatnya.
          `INSERT INTO "${schema}".him_deficiency
             (coding_id, deficiency_type, message, responsible_role, blocks_coding)
           SELECT $1::uuid, $2::varchar, $3::text, $4::varchar, $5::boolean
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schema}".him_deficiency
               WHERE coding_id = $1 AND deficiency_type = $2 AND resolved_at IS NULL
            )`,
          [codingId, d.type, d.message, d.responsibleRole, d.blocksCoding],
        );
      }

      await this.audit.recordAccess(schema, {
        patientId: konteks.patientId,
        facilityId: konteks.facilityId,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'him_coding',
        entityId: codingId,
      });

      return {
        id: codingId,
        complete: hasil.complete,
        deficiencies: hasil.deficiencies,
        blockingCount: hasil.blockingCount,
      };
    });
  }

  /**
   * Mengode satu kunjungan.
   *
   * Setiap kode diperiksa terhadap terminologi yang berlaku **pada tanggal
   * layanannya**, dan versinya disalin ke barisnya. Tanpa salinan itu, kode
   * lama tidak dapat ditafsirkan setelah terminologinya berganti dua kali.
   */
  async kode(
    schema: string,
    codingId: string,
    input: {
      items: Array<{
        itemType: 'DIAGNOSIS' | 'PROCEDURE';
        code: string;
        codeSystem: string;
        isPrincipal?: boolean;
        sequenceNo?: number;
      }>;
    },
    ctx: KonteksAkses,
  ) {
    const coding = await this.tenantDb.query<{
      status: string;
      blocking_count: number;
      service_date: string;
      patient_id: string;
      facility_id: string;
    }>(
      schema,
      `SELECT status, blocking_count, service_date::text AS service_date,
              patient_id::text AS patient_id, facility_id::text AS facility_id
         FROM "${schema}".him_coding WHERE id = $1`,
      [codingId],
    );
    if (!coding.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas pengkodean tidak ditemukan.');

    const kekurangan = await this.tenantDb.query<{
      deficiency_type: string;
      message: string;
      responsible_role: string;
      blocks_coding: boolean;
    }>(
      schema,
      `SELECT deficiency_type, message, responsible_role, blocks_coding
         FROM "${schema}".him_deficiency WHERE coding_id = $1 AND resolved_at IS NULL`,
      [codingId],
    );

    const izin = bolehKode({
      kelengkapan: {
        blockingCount: kekurangan.filter((k) => k.blocks_coding).length,
        deficiencies: kekurangan.map((k) => ({
          type: k.deficiency_type as never,
          message: k.message,
          responsibleRole: k.responsible_role,
          blocksCoding: k.blocks_coding,
        })),
      },
      status: coding[0].status,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Berkas belum dapat dikode.',
        { blockers: izin.blockers },
      );
    }

    const utama = input.items.filter((i) => i.itemType === 'DIAGNOSIS' && i.isPrincipal);
    if (utama.length !== 1) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Harus ada tepat satu diagnosis utama; diterima ${utama.length}. Pengelompokan casemix ` +
          'memilih satu, dan urutan baris bukan keputusan klinis.',
      );
    }

    // Setiap kode diperiksa terhadap terminologi pada tanggal layanannya.
    const diperiksa: Array<{ item: (typeof input.items)[number]; kode: KodeTerminologi }> = [];
    for (const item of input.items) {
      const kode = await this.cariKode(schema, item.codeSystem, item.code);
      if (!kode) {
        throw AppError.notFound(
          ErrorCodes.NOT_FOUND,
          `Kode ${item.code} tidak ada pada terminologi ${item.codeSystem} yang aktif.`,
        );
      }
      const boleh = bolehPakaiKode({ kode, serviceDate: coding[0].service_date });
      if (!boleh.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          boleh.message ?? `Kode ${item.code} tidak dapat dipakai.`,
          { code: item.code, replacedBy: boleh.replacedBy },
        );
      }
      diperiksa.push({ item, kode });
    }

    return this.tenantDb.transaction(schema, async (client) => {
      await client.query(`DELETE FROM "${schema}".him_coded_item WHERE coding_id = $1`, [codingId]);

      for (const [i, d] of diperiksa.entries()) {
        await client.query(
          `INSERT INTO "${schema}".him_coded_item
             (coding_id, item_type, code, code_system, code_version, display,
              sequence_no, is_principal)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            codingId,
            d.item.itemType,
            d.item.code,
            d.item.codeSystem,
            d.kode.version,
            d.kode.display,
            d.item.sequenceNo ?? i + 1,
            d.item.isPrincipal ?? false,
          ],
        );
      }

      await client.query(
        `UPDATE "${schema}".him_coding
            SET status = 'CODED', coded_by = $2, coded_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [codingId, ctx.actorUserId],
      );

      await this.audit.recordAccess(schema, {
        patientId: coding[0].patient_id,
        facilityId: coding[0].facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'him_coding',
        entityId: codingId,
      });

      return { id: codingId, status: 'CODED', itemCount: diperiksa.length };
    });
  }

  /** Verifikasi pengkodean oleh orang kedua. */
  async verifikasiKoding(
    schema: string,
    codingId: string,
    input: { approve: boolean; note?: string | null; requireSeparation?: boolean },
    ctx: KonteksAkses,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{ status: string; coded_by: string | null }>(
        `SELECT status, coded_by::text AS coded_by FROM "${schema}".him_coding
          WHERE id = $1 FOR UPDATE`,
        [codingId],
      );
      if (!rows.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas tidak ditemukan.');
      if (rows.rows[0].status !== 'CODED') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Verifikasi memerlukan berkas berstatus CODED, saat ini ${rows.rows[0].status}.`,
        );
      }

      const izin = bolehVerifikasiKoding({
        codedBy: rows.rows[0].coded_by,
        verifierId: ctx.actorUserId,
        requireSeparation: input.requireSeparation ?? true,
      });
      if (!izin.allowed) {
        throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.message ?? 'Verifikasi ditolak.');
      }

      if (!input.approve && !input.note?.trim()) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Pengembalian berkas wajib menyebutkan apa yang harus diperbaiki.',
        );
      }

      await client.query(
        `UPDATE "${schema}".him_coding
            SET status = $2, verified_by = $3, verified_at = now(),
                verification_note = $4, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [codingId, input.approve ? 'VERIFIED' : 'RETURNED', ctx.actorUserId, input.note ?? null],
      );

      return { id: codingId, status: input.approve ? 'VERIFIED' : 'RETURNED' };
    });
  }

  /** Daftar kerja pengkodean. */
  async daftarKerjaKoding(schema: string, facilityId: string, status?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT c.id::text AS id, c.status, c.service_date::text AS service_date,
              c.encounter_type, c.deficiency_count, c.blocking_count,
              c.checked_at::text AS checked_at,
              p.full_name AS patient_name,
              count(d.id) FILTER (WHERE d.resolved_at IS NULL)::int AS open_deficiencies
         FROM "${schema}".him_coding c
         JOIN "${schema}".patient p ON p.id = c.patient_id
         LEFT JOIN "${schema}".him_deficiency d ON d.coding_id = c.id
        WHERE c.facility_id = $1
          AND ($2::text IS NULL OR c.status = $2)
          AND c.status IN ('PENDING','IN_CODING','CODED','RETURNED')
        GROUP BY c.id, p.full_name
        ORDER BY c.blocking_count DESC, c.service_date
        LIMIT 200`,
      [facilityId, status ?? null],
    );
  }

  /** Kekurangan yang ditugaskan kepada satu peran, untuk layar dokter. */
  async kekuranganPerPeran(schema: string, facilityId: string, role: string) {
    return this.tenantDb.query(
      schema,
      `SELECT d.id::text AS id, d.deficiency_type, d.message, d.blocks_coding,
              d.detected_at::text AS detected_at,
              c.id::text AS coding_id, c.service_date::text AS service_date,
              p.full_name AS patient_name
         FROM "${schema}".him_deficiency d
         JOIN "${schema}".him_coding c ON c.id = d.coding_id
         JOIN "${schema}".patient p ON p.id = c.patient_id
        WHERE c.facility_id = $1 AND d.responsible_role = $2 AND d.resolved_at IS NULL
        ORDER BY d.blocks_coding DESC, d.detected_at
        LIMIT 200`,
      [facilityId, role],
    );
  }

  // --- Penahanan hukum -------------------------------------------------------

  async tahanHukum(
    schema: string,
    input: {
      patientId: string;
      encounterId?: string | null;
      reason: string;
      caseReference?: string | null;
      requestedBy?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".him_legal_hold
         (patient_id, encounter_id, reason, case_reference, requested_by, placed_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id::text AS id`,
      [
        input.patientId,
        input.encounterId ?? null,
        input.reason,
        input.caseReference ?? null,
        input.requestedBy ?? null,
        ctx.actorUserId,
      ],
    );

    this.logger.warn(
      `Penahanan hukum dipasang pada rekam medis pasien ${input.patientId}: ${input.reason}`,
    );

    return { id: rows[0].id, patientId: input.patientId };
  }

  async cabutPenahanan(
    schema: string,
    holdId: string,
    input: { reason: string },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".him_legal_hold
          SET released_at = now(), released_by = $2, release_reason = $3, version = version + 1
        WHERE id = $1 AND released_at IS NULL AND placed_by <> $2::uuid
        RETURNING id::text AS id`,
      [holdId, ctx.actorUserId, input.reason],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Penahanan tidak ditemukan, sudah dicabut, atau hendak dicabut oleh yang memasangnya ' +
          'sendiri. Yang memasang penahanan tidak mencabutnya sendiri.',
      );
    }
    return { id: holdId, released: true };
  }

  /** Penahanan aktif pada satu pasien, beserta keterangan apa yang tertahan. */
  async statusPenahanan(schema: string, patientId: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      reason: string;
      case_reference: string | null;
      placed_at: string;
      released_at: string | null;
    }>(
      schema,
      `SELECT id::text AS id, reason, case_reference, placed_at::text AS placed_at,
              released_at::text AS released_at
         FROM "${schema}".him_legal_hold WHERE patient_id = $1
        ORDER BY placed_at DESC`,
      [patientId],
    );

    const putusan = bolehUbahSaatDitahan({
      legalHolds: rows.map((r) => ({ id: r.id, reason: r.reason, releasedAt: r.released_at })),
      action: 'AMEND',
    });

    return { holds: rows, canAmend: putusan.allowed, message: putusan.message ?? null };
  }

  // --- Pelepasan informasi ---------------------------------------------------

  async mintaInformasi(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      requesterType: PemintaInformasi;
      requesterName: string;
      purpose: string;
      requestedScope: string[];
      hasPatientConsent?: boolean;
      consentReference?: string | null;
      hasLegalBasis?: boolean;
      legalBasisDocument?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const putusan = bolehLepasInformasi({
      requester: input.requesterType,
      hasPatientConsent: input.hasPatientConsent ?? false,
      hasLegalBasis: input.hasLegalBasis ?? false,
      legalBasisDocument: input.legalBasisDocument ?? null,
      scope: input.requestedScope,
    });

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".him_information_release
         (patient_id, facility_id, requester_type, requester_name, purpose, requested_scope,
          has_patient_consent, consent_reference, has_legal_basis, legal_basis_document,
          decision, decided_by, decided_at, decision_reason, requires_redaction)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),$13,$14)
       RETURNING id::text AS id`,
      [
        input.patientId,
        input.facilityId,
        input.requesterType,
        input.requesterName,
        input.purpose,
        input.requestedScope,
        input.hasPatientConsent ?? false,
        input.consentReference ?? null,
        input.hasLegalBasis ?? false,
        input.legalBasisDocument ?? null,
        putusan.allowed ? 'APPROVED' : 'REJECTED',
        ctx.actorUserId,
        putusan.message ?? null,
        putusan.requiresRedaction ?? false,
      ],
    );

    await this.audit.recordAccess(schema, {
      patientId: input.patientId,
      facilityId: input.facilityId,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'EXPORT',
      entityType: 'him_information_release',
      entityId: rows[0].id,
    });

    return {
      id: rows[0].id,
      decision: putusan.allowed ? 'APPROVED' : 'REJECTED',
      message: putusan.message ?? null,
      requiresRedaction: putusan.requiresRedaction ?? false,
    };
  }

  /**
   * Mencatat apa yang BENAR-BENAR dilepas.
   *
   * Sering berbeda dari yang diminta, dan yang penting bagi audit adalah yang
   * kedua. Permintaan mencatat niat; pelepasan mencatat perbuatan.
   */
  async lepaskanInformasi(
    schema: string,
    releaseId: string,
    input: { releasedScope: string[] },
    ctx: KonteksAkses,
  ) {
    if (!input.releasedScope?.length) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Bagian yang benar-benar dilepas harus disebutkan.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string; patient_id: string }>(
      schema,
      `UPDATE "${schema}".him_information_release
          SET released_at = now(), released_by = $2, released_scope = $3, version = version + 1
        WHERE id = $1 AND decision = 'APPROVED' AND released_at IS NULL
        RETURNING id::text AS id, patient_id::text AS patient_id`,
      [releaseId, ctx.actorUserId, input.releasedScope],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Permintaan tidak ditemukan, belum disetujui, atau sudah dilepas.',
      );
    }

    return { id: releaseId, released: true };
  }

  // --- Insiden keselamatan ---------------------------------------------------

  /**
   * Melaporkan insiden keselamatan pasien.
   *
   * Pelapor boleh anonim. Program keselamatan pasien bergantung pada orang yang
   * mau melapor, dan sebagian tidak akan melapor bila namanya tercatat —
   * terutama ketika yang keliru adalah atasannya.
   */
  async laporkanInsiden(
    schema: string,
    input: {
      facilityId: string;
      patientId?: string | null;
      encounterId?: string | null;
      serviceUnitId?: string | null;
      incidentType: string;
      occurredAt: string;
      description: string;
      immediateAction?: string | null;
      harmLevel: TingkatBahaya;
      reachedPatient: boolean;
      isSentinel?: boolean;
      anonymous?: boolean;
    },
    ctx: KonteksAkses,
  ) {
    const klasifikasi = klasifikasiInsiden({
      harmLevel: input.harmLevel,
      reachedPatient: input.reachedPatient,
      isSentinel: input.isSentinel,
    });

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorInsiden(client, schema, input.facilityId);

      const rows = await client.query<{ id: string; incident_number: string }>(
        `INSERT INTO "${schema}".safety_incident
           (incident_number, facility_id, patient_id, encounter_id, service_unit_id,
            incident_type, occurred_at, description, immediate_action,
            harm_level, reached_patient, is_sentinel, grade,
            review_due_at, requires_rca, requires_external_report,
            reported_by, is_anonymous)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
                 now() + ($14 || ' hours')::interval, $15, $16, $17, $18)
         RETURNING id::text AS id, incident_number`,
        [
          nomor,
          input.facilityId,
          input.patientId ?? null,
          input.encounterId ?? null,
          input.serviceUnitId ?? null,
          input.incidentType,
          input.occurredAt,
          input.description,
          input.immediateAction ?? null,
          input.harmLevel,
          input.reachedPatient,
          input.isSentinel ?? false,
          klasifikasi.grade,
          String(klasifikasi.reviewDueHours),
          klasifikasi.requiresRootCauseAnalysis,
          klasifikasi.requiresExternalReport,
          input.anonymous ? null : ctx.actorUserId,
          input.anonymous ?? false,
        ],
      );

      if (klasifikasi.grade === 'RED') {
        this.logger.warn(
          `Kejadian sentinel ${rows.rows[0].incident_number}: ${input.harmLevel}. ` +
            'Telaah akar masalah wajib dalam 24 jam.',
        );
      }

      return {
        id: rows.rows[0].id,
        incidentNumber: rows.rows[0].incident_number,
        ...klasifikasi,
      };
    });
  }

  async tambahTindakanPerbaikan(
    schema: string,
    incidentId: string,
    input: {
      action: string;
      actionType?: string | null;
      assignedTo?: string | null;
      dueAt?: string | null;
    },
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".safety_corrective_action
         (incident_id, action, action_type, assigned_to, due_at)
       VALUES ($1,$2,$3,$4,$5) RETURNING id::text AS id`,
      [incidentId, input.action, input.actionType ?? null, input.assignedTo ?? null, input.dueAt ?? null],
    );
    return { id: rows[0].id };
  }

  async tutupInsiden(
    schema: string,
    incidentId: string,
    input: { closureNote?: string | null; rcaSummary?: string | null },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{
      grade: 'BLUE' | 'GREEN' | 'YELLOW' | 'RED';
      requires_rca: boolean;
      rca_completed_at: string | null;
      reported_by: string | null;
      closed_at: string | null;
      action_count: string;
    }>(
      schema,
      `SELECT i.grade, i.requires_rca, i.rca_completed_at::text AS rca_completed_at,
              i.reported_by::text AS reported_by, i.closed_at::text AS closed_at,
              count(a.id)::text AS action_count
         FROM "${schema}".safety_incident i
         LEFT JOIN "${schema}".safety_corrective_action a ON a.incident_id = i.id
        WHERE i.id = $1
        GROUP BY i.id`,
      [incidentId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Insiden tidak ditemukan.');
    if (rows[0].closed_at) {
      throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Insiden ini sudah ditutup.');
    }

    const izin = bolehTutupInsiden({
      grade: rows[0].grade,
      requiresRootCauseAnalysis: rows[0].requires_rca,
      hasRootCauseAnalysis: Boolean(rows[0].rca_completed_at) || Boolean(input.rcaSummary?.trim()),
      correctiveActionCount: Number(rows[0].action_count),
      closedBy: ctx.actorUserId,
      reportedBy: rows[0].reported_by ?? '',
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Insiden belum dapat ditutup.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".safety_incident
          SET closed_at = now(), closed_by = $2, closure_note = $3,
              rca_summary = COALESCE($4, rca_summary),
              rca_completed_at = CASE WHEN $4::text IS NOT NULL THEN now() ELSE rca_completed_at END,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [incidentId, ctx.actorUserId, input.closureNote ?? null, input.rcaSummary ?? null],
    );

    return { id: incidentId, closed: true };
  }

  /** Papan insiden, diurutkan menurut kemendesakannya. */
  async papanInsiden(schema: string, facilityId: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      incident_number: string;
      incident_type: string;
      grade: string;
      harm_level: string;
      occurred_at: string;
      review_due_at: string | null;
      closed_at: string | null;
      is_anonymous: boolean;
      action_count: number;
    }>(
      schema,
      `SELECT i.id::text AS id, i.incident_number, i.incident_type, i.grade, i.harm_level,
              i.occurred_at::text AS occurred_at, i.review_due_at::text AS review_due_at,
              i.closed_at::text AS closed_at, i.is_anonymous,
              count(a.id)::int AS action_count
         FROM "${schema}".safety_incident i
         LEFT JOIN "${schema}".safety_corrective_action a ON a.incident_id = i.id
        WHERE i.facility_id = $1
        GROUP BY i.id
        ORDER BY i.occurred_at DESC
        LIMIT 300`,
      [facilityId],
    );

    return urutkanInsiden(
      rows.map((r) => ({ ...r, reviewDueAt: r.review_due_at, closedAt: r.closed_at })),
      new Date().toISOString(),
    );
  }

  // --- Mutu ------------------------------------------------------------------

  async catatIndikator(
    schema: string,
    input: {
      indicatorId: string;
      periodYear: number;
      periodMonth?: number | null;
      numerator: number;
      denominator: number;
      note?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const indikator = await this.tenantDb.query<{
      direction: 'HIGHER_IS_BETTER' | 'LOWER_IS_BETTER';
      target_value: string | null;
      name: string;
    }>(
      schema,
      `SELECT direction, target_value::text, name FROM "${schema}".quality_indicator
        WHERE id = $1 AND is_active = TRUE`,
      [input.indicatorId],
    );
    if (!indikator.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Indikator mutu tidak ditemukan atau tidak aktif.');
    }

    const hasil = hitungIndikator({
      numerator: input.numerator,
      denominator: input.denominator,
      direction: indikator[0].direction,
      target: indikator[0].target_value === null ? null : Number(indikator[0].target_value),
    });

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".quality_measurement
         (indicator_id, period_year, period_month, numerator, denominator,
          value, meets_target, note, measured_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (indicator_id, period_year, COALESCE(period_month, 0)) DO UPDATE SET
         numerator = EXCLUDED.numerator, denominator = EXCLUDED.denominator,
         value = EXCLUDED.value, meets_target = EXCLUDED.meets_target,
         note = EXCLUDED.note, measured_by = EXCLUDED.measured_by, measured_at = now()
       RETURNING id::text AS id`,
      [
        input.indicatorId,
        input.periodYear,
        input.periodMonth ?? null,
        input.numerator,
        input.denominator,
        hasil.value,
        hasil.meetsTarget,
        input.note ?? null,
        ctx.actorUserId,
      ],
    );

    return { id: rows[0].id, name: indikator[0].name, ...hasil };
  }

  async papanMutu(schema: string, facilityId: string, year: number) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT i.id::text AS id, i.code, i.name, i.category, i.direction,
              i.target_value::float8 AS target_value,
              m.period_month, m.numerator, m.denominator,
              m.value::float8 AS value, m.meets_target
         FROM "${schema}".quality_indicator i
         LEFT JOIN "${schema}".quality_measurement m
           ON m.indicator_id = i.id AND m.period_year = $2
        WHERE i.facility_id = $1 AND i.is_active = TRUE
        ORDER BY i.category NULLS LAST, i.code, m.period_month NULLS FIRST`,
      [facilityId, year],
    );

    const berkas = await this.tenantDb.query<{ total: string; complete: string }>(
      schema,
      `SELECT count(*)::text AS total,
              count(*) FILTER (WHERE blocking_count = 0)::text AS complete
         FROM "${schema}".him_coding
        WHERE facility_id = $1 AND EXTRACT(YEAR FROM service_date) = $2`,
      [facilityId, year],
    );

    return {
      indicators: rows,
      recordCompleteness: skorKelengkapan({
        total: Number(berkas[0].total),
        complete: Number(berkas[0].complete),
      }),
    };
  }

  // --- Bagian dalam ----------------------------------------------------------

  /**
   * Menyusun gambaran berkas satu kunjungan.
   *
   * Seluruhnya dibaca dari tabel yang sudah ada sejak H-3 sampai H-7. Tidak ada
   * data baru yang diminta petugas — kelengkapan diperiksa dari apa yang sudah
   * mereka kerjakan.
   */
  private async konteksBerkas(
    schema: string,
    input: { encounterId?: string | null; admissionId?: string | null },
  ): Promise<{
    berkas: BerkasRekamMedis;
    patientId: string;
    facilityId: string;
    serviceDate: string;
  }> {
    if (!input.encounterId && !input.admissionId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Salah satu dari encounterId atau admissionId wajib diisi.',
      );
    }

    if (input.admissionId) {
      const rows = await this.tenantDb.query<{
        patient_id: string;
        facility_id: string;
        admitted_at: string;
        encounter_id: string | null;
        attending_provider_id: string | null;
        summary_count: string;
        summary_signed: string;
        critical_count: string;
      }>(
        schema,
        `SELECT a.patient_id::text AS patient_id, a.facility_id::text AS facility_id,
                a.admitted_at::text AS admitted_at, a.encounter_id::text AS encounter_id,
                a.attending_provider_id::text AS attending_provider_id,
                count(s.id)::text AS summary_count,
                count(s.id) FILTER (WHERE s.signed_at IS NOT NULL)::text AS summary_signed,
                (SELECT count(*) FROM "${schema}".lab_critical_notification c
                  WHERE c.patient_id = a.patient_id AND c.acknowledged_at IS NULL)::text
                  AS critical_count
           FROM "${schema}".health_admission a
           LEFT JOIN "${schema}".health_discharge_summary s ON s.admission_id = a.id
          WHERE a.id = $1
          GROUP BY a.id`,
        [input.admissionId],
      );
      if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');
      const a = rows[0];

      const klinis = a.encounter_id
        ? await this.ringkasanKlinis(schema, a.encounter_id)
        : { diagnosisCount: 0, principalCount: 0, unsignedNotes: 0, procedureCount: 0 };
      const berkode = await this.jumlahBerkode(schema, 'admission_id', input.admissionId);

      return {
        patientId: a.patient_id,
        facilityId: a.facility_id,
        serviceDate: a.admitted_at.slice(0, 10),
        berkas: {
          encounterType: 'INPATIENT',
          hasPrincipalDiagnosis: klinis.principalCount > 0,
          principalDiagnosisCount: klinis.principalCount,
          diagnosisCount: klinis.diagnosisCount,
          codedDiagnosisCount: berkode.diagnosis,
          procedureCount: klinis.procedureCount,
          codedProcedureCount: berkode.procedure,
          unsignedNoteCount: klinis.unsignedNotes,
          hasDischargeSummary: Number(a.summary_count) > 0,
          dischargeSummarySigned: Number(a.summary_signed) > 0,
          hasConsent: true,
          hasOperativeNote: false,
          hasAnaesthesiaRecord: false,
          unacknowledgedCriticalCount: Number(a.critical_count),
          hasAttendingProvider: Boolean(a.attending_provider_id),
        },
      };
    }

    const rows = await this.tenantDb.query<{
      patient_id: string;
      facility_id: string;
      started_at: string;
      encounter_type: string;
      provider_id: string | null;
      critical_count: string;
    }>(
      schema,
      `SELECT e.patient_id::text AS patient_id, e.facility_id::text AS facility_id,
              e.started_at::text AS started_at, e.encounter_type,
              e.provider_id::text AS provider_id,
              (SELECT count(*) FROM "${schema}".lab_critical_notification c
                WHERE c.patient_id = e.patient_id AND c.acknowledged_at IS NULL)::text
                AS critical_count
         FROM "${schema}".health_encounter e WHERE e.id = $1`,
      [input.encounterId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');
    const e = rows[0];
    const klinis = await this.ringkasanKlinis(schema, input.encounterId as string);
    const berkode = await this.jumlahBerkode(schema, 'encounter_id', input.encounterId);

    return {
      patientId: e.patient_id,
      facilityId: e.facility_id,
      serviceDate: e.started_at.slice(0, 10),
      berkas: {
        encounterType: (e.encounter_type === 'EMERGENCY' ? 'EMERGENCY' : 'OUTPATIENT') as
          | 'OUTPATIENT'
          | 'EMERGENCY',
        hasPrincipalDiagnosis: klinis.principalCount > 0,
        principalDiagnosisCount: klinis.principalCount,
        diagnosisCount: klinis.diagnosisCount,
        codedDiagnosisCount: berkode.diagnosis,
        procedureCount: klinis.procedureCount,
        codedProcedureCount: berkode.procedure,
        unsignedNoteCount: klinis.unsignedNotes,
        hasDischargeSummary: false,
        dischargeSummarySigned: false,
        hasConsent: true,
        hasOperativeNote: false,
        hasAnaesthesiaRecord: false,
        unacknowledgedCriticalCount: Number(e.critical_count),
        hasAttendingProvider: Boolean(e.provider_id),
      },
    };
  }

  private async ringkasanKlinis(schema: string, encounterId: string) {
    const rows = await this.tenantDb.query<{
      diagnosis_count: string;
      principal_count: string;
      unsigned_notes: string;
    }>(
      schema,
      `SELECT
         (SELECT count(*) FROM "${schema}".encounter_diagnosis d
           WHERE d.encounter_id = $1)::text AS diagnosis_count,
         (SELECT count(*) FROM "${schema}".encounter_diagnosis d
           WHERE d.encounter_id = $1 AND d.diagnosis_role = 'PRIMARY')::text AS principal_count,
         (SELECT count(*) FROM "${schema}".clinical_note n
           WHERE n.encounter_id = $1 AND n.signed_at IS NULL)::text AS unsigned_notes`,
      [encounterId],
    );
    return {
      diagnosisCount: Number(rows[0]?.diagnosis_count ?? 0),
      principalCount: Number(rows[0]?.principal_count ?? 0),
      unsignedNotes: Number(rows[0]?.unsigned_notes ?? 0),
      procedureCount: 0,
    };
  }

  /**
   * Berapa banyak diagnosis dan tindakan yang sudah berkode pada berkas ini.
   *
   * Dibaca dari hasil pengkodean, bukan diasumsikan nol. Tanpa ini, kekurangan
   * "1 diagnosis belum berkode" tidak akan pernah tertutup — sekalipun kodenya
   * sudah diisi — dan daftar kekurangan yang memuat hal yang sudah dikerjakan
   * akan diabaikan seluruhnya, termasuk yang belum.
   */
  private async jumlahBerkode(
    schema: string,
    kolom: 'encounter_id' | 'admission_id',
    nilai: string | null | undefined,
  ): Promise<{ diagnosis: number; procedure: number }> {
    if (!nilai) return { diagnosis: 0, procedure: 0 };
    const rows = await this.tenantDb.query<{ diagnosis: string; procedure: string }>(
      schema,
      `SELECT count(*) FILTER (WHERE i.item_type = 'DIAGNOSIS')::text AS diagnosis,
              count(*) FILTER (WHERE i.item_type = 'PROCEDURE')::text AS procedure
         FROM "${schema}".him_coding c
         LEFT JOIN "${schema}".him_coded_item i ON i.coding_id = c.id
        WHERE c.${kolom} = $1`,
      [nilai],
    );
    return {
      diagnosis: Number(rows[0]?.diagnosis ?? 0),
      procedure: Number(rows[0]?.procedure ?? 0),
    };
  }

  private async cariKode(
    schema: string,
    system: string,
    code: string,
  ): Promise<KodeTerminologi | null> {
    const rows = await this.tenantDb.query<{
      code: string;
      system: string;
      version: string;
      display: string;
      deprecated_at: string | null;
      replaced_by: string | null;
    }>(
      schema,
      `SELECT c.code, c.system, s.version, c.display,
              c.deprecated_at::text AS deprecated_at, c.replaced_by
         FROM "${schema}".terminology_code c
         JOIN "${schema}".terminology_snapshot s ON s.id = c.snapshot_id
        WHERE c.system = $1 AND c.code = $2 AND s.is_active = TRUE
        LIMIT 1`,
      [system, code],
    );
    if (!rows.length) return null;
    return {
      code: rows[0].code,
      system: rows[0].system as KodeTerminologi['system'],
      version: rows[0].version,
      display: rows[0].display,
      deprecatedAt: rows[0].deprecated_at,
      replacedBy: rows[0].replaced_by,
    };
  }

  private async nomorInsiden(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    /*
     * Kode fasilitas disertakan. Nomornya dihitung PER fasilitas, sedangkan
     * keunikannya ditegakkan per tenant — tanpa kode fasilitas, dua rumah sakit
     * yang melapor pada hari yang sama akan berebut nomor yang sama, dan yang
     * kedua gagal melapor sama sekali.
     */
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';

    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".safety_incident
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `IKP-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
