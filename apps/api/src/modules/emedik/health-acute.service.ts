/**
 * Gawat darurat, kamar operasi, dan perawatan intensif.
 *
 * Aturannya ada di `health-acute.ts` sebagai fungsi murni.
 *
 * Tiga hal dijaga berlapis di sini: triase tidak dapat diturunkan diam-diam,
 * jeda sebelum sayatan tidak dapat dilewati, dan hitungan kasa yang tidak cocok
 * menahan pasien di kamar operasi. Ketiganya juga ditegakkan basis data — bukan
 * karena layanan ini tidak dipercaya, melainkan karena pada tabel-tabel ini
 * selalu ada jalan kedua.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  BATAS_TUNGGU_TRIASE,
  bolehDisposisi,
  bolehJadwalkan,
  bolehKeluarKamarOperasi,
  bolehMulaiSayatan,
  bolehTurunkanTriase,
  lewatBatasTunggu,
  periksaDaftarPeriksa,
  skorIntensif,
  tentukanTriase,
  urutkanTriase,
  type Disposisi,
  type TahapDaftarPeriksa,
  type TandaVitalTriase,
  type TingkatTriase,
} from './health-acute';

@Injectable()
export class HealthAcuteService {
  private readonly logger = new Logger(HealthAcuteService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Gawat darurat ---------------------------------------------------------

  /**
   * Mendaftarkan kedatangan pasien di gawat darurat dan menriasenya.
   *
   * Keduanya sekaligus. Pasien yang terdaftar tetapi belum ditriase adalah
   * pasien yang tidak ada di antrean mana pun — dan pasien yang tidak ada di
   * antrean mana pun akan menunggu sampai ada yang kebetulan melihatnya.
   */
  async terimaGawatDarurat(
    schema: string,
    input: {
      facilityId: string;
      patientId?: string | null;
      arrivalMode?: string | null;
      chiefComplaint?: string | null;
      requestedLevel: TingkatTriase;
      vitals?: TandaVitalTriase;
      redFlagComplaints?: string[];
    },
    ctx: KonteksAkses,
  ) {
    const fasilitas = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');

    const triase = tentukanTriase({
      requestedLevel: input.requestedLevel,
      vitals: input.vitals ?? {},
      redFlagComplaints: input.redFlagComplaints,
    });

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomor(client, schema, 'ed_visit', 'visit_number', 'IGD', input.facilityId, fasilitas[0].code);

      const kunjungan = await client.query<{ id: string; visit_number: string }>(
        `INSERT INTO "${schema}".ed_visit
           (visit_number, patient_id, facility_id, arrival_mode, chief_complaint,
            requested_level, triage_level, triage_red_flags, triaged_at, triaged_by,
            max_wait_minutes, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9,$10,'WAITING')
         RETURNING id::text AS id, visit_number`,
        [
          nomor,
          input.patientId ?? null,
          input.facilityId,
          input.arrivalMode ?? null,
          input.chiefComplaint ?? null,
          triase.requestedLevel,
          triase.level,
          triase.redFlags,
          ctx.actorUserId,
          triase.maxWaitMinutes,
        ],
      );

      await client.query(
        `INSERT INTO "${schema}".ed_triage_change (ed_visit_id, from_level, to_level, reason, changed_by)
         VALUES ($1, NULL, $2, $3, $4)`,
        [kunjungan.rows[0].id, triase.level, triase.escalated ? triase.message : null, ctx.actorUserId],
      );

      if (triase.escalated) {
        this.logger.warn(
          `Triase ${kunjungan.rows[0].visit_number} dinaikkan ke tingkat ${triase.level}: ` +
            triase.redFlags.join('; '),
        );
      }

      if (input.patientId) {
        await this.audit.recordAccess(schema, {
          patientId: input.patientId,
          facilityId: input.facilityId,
          actorUserId: ctx.actorUserId,
          purposeOfUse: ctx.purposeOfUse,
          action: 'READ',
          entityType: 'ed_visit',
          entityId: kunjungan.rows[0].id,
        });
      }

      return {
        id: kunjungan.rows[0].id,
        visitNumber: kunjungan.rows[0].visit_number,
        ...triase,
      };
    });
  }

  /**
   * Mengubah tingkat triase.
   *
   * Menaikkan selalu boleh — keadaan pasien memang dapat memburuk sambil
   * menunggu. Menurunkan menuntut alasan, dan alasannya tersimpan pada barisnya
   * sendiri: yang perlu diketahui kelak bukan tingkat terakhirnya, melainkan
   * siapa mengubahnya kapan dan mengapa.
   */
  async ubahTriase(
    schema: string,
    visitId: string,
    input: { level: TingkatTriase; reason?: string | null },
    ctx: KonteksAkses,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{ triage_level: number; status: string }>(
        `SELECT triage_level, status FROM "${schema}".ed_visit WHERE id = $1 FOR UPDATE`,
        [visitId],
      );
      if (!rows.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan gawat darurat tidak ditemukan.');
      }
      if (rows.rows[0].status === 'CLOSED') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Kunjungan sudah ditutup; tingkat triasenya tidak dapat diubah.',
        );
      }

      const dari = rows.rows[0].triage_level as TingkatTriase;
      const izin = bolehTurunkanTriase({ from: dari, to: input.level, reason: input.reason ?? null });
      if (!izin.allowed) {
        throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message ?? 'Perubahan ditolak.');
      }

      await client.query(
        `INSERT INTO "${schema}".ed_triage_change
           (ed_visit_id, from_level, to_level, reason, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [visitId, dari, input.level, input.reason ?? null, ctx.actorUserId],
      );

      /*
       * `requested_level` ikut diturunkan bersama tingkat akhirnya.
       *
       * Constraint `ed_visit_level_not_softened` menuntut tingkat akhir tidak
       * lebih ringan daripada yang diusulkan. Pada penurunan yang sah — dengan
       * alasan tertulis — keduanya memang berpindah bersama; membiarkan
       * `requested_level` tertinggal akan membuat constraint menolak perubahan
       * yang justru sudah ditelaah manusia.
       */
      await client.query(
        `UPDATE "${schema}".ed_visit
            SET triage_level = $2,
                requested_level = GREATEST(requested_level, $2),
                max_wait_minutes = $3, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [visitId, input.level, BATAS_TUNGGU_TRIASE[input.level]],
      );

      return { id: visitId, level: input.level, from: dari };
    });
  }

  /** Mencatat bahwa pasien sudah dilihat dokter. */
  async dilihatDokter(schema: string, visitId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".ed_visit
          SET seen_by_doctor_at = now(), seen_by = $2, status = 'IN_TREATMENT',
              updated_at = now(), version = version + 1
        WHERE id = $1 AND seen_by_doctor_at IS NULL AND status <> 'CLOSED'
        RETURNING id::text AS id`,
      [visitId, ctx.actorUserId],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Kunjungan tidak ditemukan, sudah dilihat dokter, atau sudah ditutup.',
      );
    }
    return { id: visitId, seen: true };
  }

  /** Menetapkan disposisi kunjungan gawat darurat. */
  async tetapkanDisposisi(
    schema: string,
    visitId: string,
    input: { disposition: Disposisi; reason?: string | null; admissionId?: string | null },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{
      seen_by_doctor_at: string | null;
      triage_level: number;
      status: string;
      patient_id: string | null;
      facility_id: string;
    }>(
      schema,
      `SELECT seen_by_doctor_at::text AS seen_by_doctor_at, triage_level, status,
              patient_id::text AS patient_id, facility_id::text AS facility_id
         FROM "${schema}".ed_visit WHERE id = $1`,
      [visitId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');
    if (rows[0].status === 'CLOSED') {
      throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Kunjungan sudah ditutup.');
    }

    const izin = bolehDisposisi({
      disposition: input.disposition,
      seenByDoctorAt: rows[0].seen_by_doctor_at,
      triageLevel: rows[0].triage_level as TingkatTriase,
      reason: input.reason ?? null,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message ?? 'Disposisi ditolak.');
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".ed_visit
          SET disposition = $2, disposition_at = now(), disposition_by = $3,
              disposition_reason = $4, admission_id = $5, status = 'CLOSED',
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [visitId, input.disposition, ctx.actorUserId, input.reason ?? null, input.admissionId ?? null],
    );

    if (rows[0].patient_id) {
      await this.audit.recordAccess(schema, {
        patientId: rows[0].patient_id,
        facilityId: rows[0].facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'ed_visit',
        entityId: visitId,
      });
    }

    return { id: visitId, disposition: input.disposition };
  }

  /**
   * Papan gawat darurat.
   *
   * Diurutkan mesin, bukan `ORDER BY`: pasien tingkat 1 yang baru tiba
   * mendahului pasien tingkat 4 yang sudah menunggu dua jam.
   */
  async papanGawatDarurat(schema: string, facilityId: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      visit_number: string;
      patient_name: string | null;
      chief_complaint: string | null;
      triage_level: number;
      requested_level: number | null;
      triage_red_flags: string[] | null;
      arrived_at: string;
      seen_by_doctor_at: string | null;
      max_wait_minutes: number;
      status: string;
    }>(
      schema,
      `SELECT v.id::text AS id, v.visit_number, p.full_name AS patient_name,
              v.chief_complaint, v.triage_level, v.requested_level, v.triage_red_flags,
              v.arrived_at::text AS arrived_at, v.seen_by_doctor_at::text AS seen_by_doctor_at,
              v.max_wait_minutes, v.status
         FROM "${schema}".ed_visit v
         LEFT JOIN "${schema}".patient p ON p.id = v.patient_id
        WHERE v.facility_id = $1 AND v.status <> 'CLOSED'
        LIMIT 300`,
      [facilityId],
    );

    const sekarang = new Date().toISOString();
    return urutkanTriase(
      rows.map((r) => ({
        ...r,
        level: r.triage_level as TingkatTriase,
        arrivedAt: r.arrived_at,
        seenAt: r.seen_by_doctor_at,
      })),
    ).map((r) => ({
      ...r,
      wait: lewatBatasTunggu({
        level: r.level,
        arrivedAt: r.arrived_at,
        seenAt: r.seen_by_doctor_at,
        now: sekarang,
      }),
    }));
  }

  // --- Kamar operasi ---------------------------------------------------------

  /**
   * Menjadwalkan operasi.
   *
   * Bentroknya diperiksa dua kali: di sini agar pesannya dapat dibaca manusia,
   * dan oleh constraint pengecualian agar dua penjadwalan bersamaan tidak
   * sama-sama lolos.
   */
  async jadwalkanOperasi(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      theatreId?: string | null;
      admissionId?: string | null;
      procedureName: string;
      procedureCode?: string | null;
      requiresSiteMarking?: boolean;
      consentSite?: string | null;
      surgeonId?: string | null;
      anaesthetistId?: string | null;
      anaesthesiaType?: string | null;
      urgency?: 'ELECTIVE' | 'URGENT' | 'EMERGENCY';
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const fasilitas = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');

    if (input.requiresSiteMarking && !input.consentSite) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Prosedur bersisi wajib menyebut sisi pada persetujuan tindakan sejak dijadwalkan. ' +
          'Menambahkannya di kamar operasi berarti menambahkannya ketika pasien sudah terbius.',
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      if (input.theatreId && input.scheduledStart && input.scheduledEnd) {
        const lain = await client.query<{
          theatre_id: string;
          scheduled_start: string;
          scheduled_end: string;
          status: string;
          case_number: string;
        }>(
          `SELECT theatre_id::text AS theatre_id, scheduled_start::text AS scheduled_start,
                  scheduled_end::text AS scheduled_end, status, case_number
             FROM "${schema}".ot_case
            WHERE theatre_id = $1 AND status <> 'CANCELLED'
              AND scheduled_start IS NOT NULL AND scheduled_end IS NOT NULL
            FOR UPDATE`,
          [input.theatreId],
        );

        const izin = bolehJadwalkan(
          {
            theatreId: input.theatreId,
            startAt: input.scheduledStart,
            endAt: input.scheduledEnd,
          },
          lain.rows.map((r) => ({
            theatreId: r.theatre_id,
            startAt: r.scheduled_start,
            endAt: r.scheduled_end,
            status: r.status,
          })),
        );
        if (!izin.allowed) {
          throw AppError.conflict(ErrorCodes.CONFLICT, izin.message ?? 'Jadwal bentrok.');
        }
      }

      const nomor = await this.nomor(client, schema, 'ot_case', 'case_number', 'OK', input.facilityId, fasilitas[0].code);

      const kasus = await client.query<{ id: string; case_number: string }>(
        `INSERT INTO "${schema}".ot_case
           (case_number, patient_id, facility_id, theatre_id, admission_id,
            procedure_name, procedure_code, requires_site_marking, consent_site,
            surgeon_id, anaesthetist_id, anaesthesia_type, urgency,
            scheduled_start, scheduled_end, scheduled_range, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                 CASE WHEN $14::timestamptz IS NULL OR $15::timestamptz IS NULL THEN NULL
                      ELSE tstzrange($14::timestamptz, $15::timestamptz, '[)') END,
                 'SCHEDULED', $16)
         RETURNING id::text AS id, case_number`,
        [
          nomor,
          input.patientId,
          input.facilityId,
          input.theatreId ?? null,
          input.admissionId ?? null,
          input.procedureName,
          input.procedureCode ?? null,
          input.requiresSiteMarking ?? false,
          input.consentSite ?? null,
          input.surgeonId ?? null,
          input.anaesthetistId ?? null,
          input.anaesthesiaType ?? null,
          input.urgency ?? 'ELECTIVE',
          input.scheduledStart ?? null,
          input.scheduledEnd ?? null,
          ctx.actorUserId,
        ],
      );

      return { id: kasus.rows[0].id, caseNumber: kasus.rows[0].case_number };
    });
  }

  /** Menandai sisi operasi pada tubuh pasien. */
  async tandaiSisi(schema: string, caseId: string, site: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query<{ consent_site: string | null; incision_at: string | null }>(
      schema,
      `UPDATE "${schema}".ot_case
          SET marked_site = $2, marked_by = $3, marked_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1 AND incision_at IS NULL
        RETURNING consent_site, incision_at::text AS incision_at`,
      [caseId, site.trim().toUpperCase(), ctx.actorUserId],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Operasi tidak ditemukan atau sayatannya sudah dimulai.',
      );
    }

    const cocok =
      !rows[0].consent_site ||
      rows[0].consent_site.trim().toUpperCase() === site.trim().toUpperCase();

    if (!cocok) {
      this.logger.warn(
        `Penandaan sisi pada operasi ${caseId} berbeda dari persetujuan tindakan.`,
      );
    }

    return { id: caseId, markedSite: site.trim().toUpperCase(), matchesConsent: cocok };
  }

  /**
   * Menyelesaikan satu tahap daftar periksa keselamatan bedah.
   *
   * Kelengkapannya diperiksa **sebelum** disimpan. Tahap yang tersimpan setengah
   * lengkap akan terbaca kelak sebagai tahap yang dilakukan, dan tidak ada yang
   * dapat membedakannya dari yang benar-benar lengkap.
   */
  async selesaikanDaftarPeriksa(
    schema: string,
    caseId: string,
    input: { phase: TahapDaftarPeriksa; items: string[]; note?: string | null },
    ctx: KonteksAkses,
  ) {
    const kelengkapan = periksaDaftarPeriksa(input.phase, input.items);
    if (!kelengkapan.complete) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Tahap ${input.phase} belum lengkap: ${kelengkapan.missing.join(', ')}.`,
        { missing: kelengkapan.missing },
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const kasus = await client.query<{ status: string; incision_at: string | null }>(
        `SELECT status, incision_at::text AS incision_at FROM "${schema}".ot_case
          WHERE id = $1 FOR UPDATE`,
        [caseId],
      );
      if (!kasus.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Operasi tidak ditemukan.');

      /*
       * Jeda sebelum sayatan tidak dapat dicatat setelah sayatan dimulai.
       * Basis data menegakkannya pula lewat `ot_case_timeout_before_incision`;
       * diperiksa di sini supaya pesannya dapat dibaca manusia.
       */
      if (input.phase === 'TIME_OUT' && kasus.rows[0].incision_at) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Sayatan sudah dimulai. Jeda sebelum sayatan tidak dapat dicatat sesudahnya — ' +
            'daftar periksa yang diisi belakangan tidak menahan apa pun.',
        );
      }

      await client.query(
        `INSERT INTO "${schema}".ot_checklist (ot_case_id, phase, items, completed_by, note)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (ot_case_id, phase) DO UPDATE SET
           items = EXCLUDED.items, completed_at = now(),
           completed_by = EXCLUDED.completed_by, note = EXCLUDED.note`,
        [caseId, input.phase, input.items, ctx.actorUserId, input.note ?? null],
      );

      const kolom =
        input.phase === 'SIGN_IN' ? 'sign_in_at' : input.phase === 'TIME_OUT' ? 'time_out_at' : 'sign_out_at';
      await client.query(
        `UPDATE "${schema}".ot_case
            SET ${kolom} = now(), updated_at = now(), version = version + 1
          WHERE id = $1`,
        [caseId],
      );

      return { id: caseId, phase: input.phase, complete: true };
    });
  }

  /** Mencatat hitungan kasa, jarum, atau instrumen. */
  async catatHitungan(
    schema: string,
    caseId: string,
    input: {
      itemType: string;
      countedIn?: number;
      countedOut?: number | null;
      verifiedBy?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    if (input.verifiedBy && input.verifiedBy === ctx.actorUserId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Penghitung kedua tidak boleh sama dengan penghitung pertama. Hitungan oleh satu ' +
          'orang bukan hitungan ganda, dan benda yang tertinggal hampir selalu lolos justru ' +
          'pada hitungan tunggal.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".ot_count
         (ot_case_id, item_type, counted_in, counted_out, counted_in_by, counted_out_by, verified_by)
       VALUES ($1,$2,COALESCE($3,0),$4,$5,
               CASE WHEN $4::int IS NULL THEN NULL ELSE $5::uuid END, $6)
       ON CONFLICT (ot_case_id, item_type) DO UPDATE SET
         counted_in = COALESCE($3, "${schema}".ot_count.counted_in),
         counted_out = COALESCE($4, "${schema}".ot_count.counted_out),
         counted_out_by = CASE WHEN $4::int IS NULL THEN "${schema}".ot_count.counted_out_by
                               ELSE $5::uuid END,
         verified_by = COALESCE($6, "${schema}".ot_count.verified_by),
         counted_at = now(),
         version = "${schema}".ot_count.version + 1
       RETURNING id::text AS id`,
      [
        caseId,
        input.itemType,
        input.countedIn ?? null,
        input.countedOut ?? null,
        ctx.actorUserId,
        input.verifiedBy ?? null,
      ],
    );

    return { id: rows[0].id, itemType: input.itemType };
  }

  /**
   * Memulai sayatan.
   *
   * Inilah titik yang seluruh daftar periksa ada untuknya. Bila salah satu
   * penahan belum terpenuhi, jawabannya bukan peringatan melainkan penolakan.
   */
  async mulaiSayatan(schema: string, caseId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query<{
      sign_in_at: string | null;
      time_out_at: string | null;
      marked_site: string | null;
      consent_site: string | null;
      requires_site_marking: boolean;
      incision_at: string | null;
      items: string[] | null;
      patient_id: string;
      facility_id: string;
    }>(
      schema,
      `SELECT c.sign_in_at::text AS sign_in_at, c.time_out_at::text AS time_out_at,
              c.marked_site, c.consent_site, c.requires_site_marking,
              c.incision_at::text AS incision_at, k.items,
              c.patient_id::text AS patient_id, c.facility_id::text AS facility_id
         FROM "${schema}".ot_case c
         LEFT JOIN "${schema}".ot_checklist k ON k.ot_case_id = c.id AND k.phase = 'TIME_OUT'
        WHERE c.id = $1`,
      [caseId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Operasi tidak ditemukan.');
    if (rows[0].incision_at) {
      throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Sayatan sudah dimulai.');
    }

    const izin = bolehMulaiSayatan({
      signInCompletedAt: rows[0].sign_in_at,
      timeOutCompletedAt: rows[0].time_out_at,
      timeOutItems: rows[0].items ?? [],
      markedSite: rows[0].marked_site,
      consentSite: rows[0].consent_site,
      requiresSiteMarking: rows[0].requires_site_marking,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Sayatan tidak dapat dimulai.',
        { reason: izin.reason },
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".ot_case
          SET incision_at = now(), status = 'IN_PROGRESS', updated_at = now(),
              version = version + 1
        WHERE id = $1`,
      [caseId],
    );

    /*
     * Sayatan dicatat sebagai akses rekam medis, bukan hanya sebagai perubahan
     * baris. Pertanyaan "siapa yang menyayat pukul berapa" harus terjawab dari
     * jejak yang sama dengan pertanyaan klinis lainnya, bukan dari tabel yang
     * berbeda dengan aturan retensi yang berbeda.
     */
    await this.audit.recordAccess(schema, {
      patientId: rows[0].patient_id,
      facilityId: rows[0].facility_id,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'ot_case',
      entityId: caseId,
    });

    return { id: caseId, incisionAt: new Date().toISOString() };
  }

  /**
   * Menyatakan pasien boleh meninggalkan kamar operasi.
   *
   * Hitungan yang tidak cocok menahan, kecuali ada keterangan pencarian.
   */
  async keluarKamarOperasi(
    schema: string,
    caseId: string,
    input: { discrepancyResolution?: string | null; operativeNote?: string | null },
    ctx: KonteksAkses,
  ) {
    const kasus = await this.tenantDb.query<{
      status: string;
      left_theatre_at: string | null;
      items: string[] | null;
      patient_id: string;
      facility_id: string;
    }>(
      schema,
      `SELECT c.status, c.left_theatre_at::text AS left_theatre_at, k.items,
              c.patient_id::text AS patient_id, c.facility_id::text AS facility_id
         FROM "${schema}".ot_case c
         LEFT JOIN "${schema}".ot_checklist k ON k.ot_case_id = c.id AND k.phase = 'SIGN_OUT'
        WHERE c.id = $1`,
      [caseId],
    );
    if (!kasus.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Operasi tidak ditemukan.');
    if (kasus[0].left_theatre_at) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Pasien sudah tercatat meninggalkan kamar operasi.',
      );
    }

    const hitungan = await this.tenantDb.query<{
      item_type: string;
      counted_in: number;
      counted_out: number | null;
    }>(
      schema,
      `SELECT item_type, counted_in, counted_out FROM "${schema}".ot_count WHERE ot_case_id = $1`,
      [caseId],
    );

    const izin = bolehKeluarKamarOperasi({
      signOutItems: kasus[0].items ?? [],
      // Benda yang belum dihitung keluar dianggap `0`, bukan dianggap cocok.
      // Menganggapnya cocok berarti kasa yang lupa dihitung tidak pernah
      // menahan siapa pun.
      counts: hitungan.map((h) => ({
        itemType: h.item_type,
        countedIn: h.counted_in,
        countedOut: h.counted_out ?? 0,
      })),
      discrepancyResolution: input.discrepancyResolution ?? null,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Pasien belum boleh meninggalkan kamar operasi.',
        { reason: izin.reason, discrepancies: izin.discrepancies },
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".ot_case
          SET left_theatre_at = now(), status = 'RECOVERY',
              count_discrepancy_resolution = COALESCE($2, count_discrepancy_resolution),
              operative_note = COALESCE($3, operative_note),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [caseId, input.discrepancyResolution ?? null, input.operativeNote ?? null],
    );

    await this.audit.recordAccess(schema, {
      patientId: kasus[0].patient_id,
      facilityId: kasus[0].facility_id,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'ot_case',
      entityId: caseId,
    });

    return { id: caseId, status: 'RECOVERY' };
  }

  /** Jadwal operasi hari ini beserta tahapan daftar periksanya. */
  async jadwalOperasi(schema: string, facilityId: string, tanggal?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT c.id::text AS id, c.case_number, c.procedure_name, c.urgency, c.status,
              c.scheduled_start::text AS scheduled_start, c.scheduled_end::text AS scheduled_end,
              c.requires_site_marking, c.consent_site, c.marked_site,
              c.sign_in_at::text AS sign_in_at, c.time_out_at::text AS time_out_at,
              c.incision_at::text AS incision_at, c.left_theatre_at::text AS left_theatre_at,
              p.full_name AS patient_name, t.name AS theatre_name
         FROM "${schema}".ot_case c
         JOIN "${schema}".patient p ON p.id = c.patient_id
         LEFT JOIN "${schema}".ot_theatre t ON t.id = c.theatre_id
        WHERE c.facility_id = $1
          AND ($2::date IS NULL OR c.scheduled_start::date = $2::date)
          AND c.status <> 'CANCELLED'
        ORDER BY c.scheduled_start NULLS LAST
        LIMIT 200`,
      [facilityId, tanggal ?? null],
    );
  }

  // --- Perawatan intensif ----------------------------------------------------

  /** Mencatat asesmen perawatan intensif beserta skor keparahannya. */
  async catatAsesmenIntensif(
    schema: string,
    input: {
      icuStayId: string;
      vitals?: TandaVitalTriase;
      onVentilator?: boolean;
      onVasopressor?: boolean;
      onDialysis?: boolean;
      note?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const stay = await this.tenantDb.query<{ patient_id: string; ended_at: string | null }>(
      schema,
      `SELECT patient_id::text AS patient_id, ended_at::text AS ended_at
         FROM "${schema}".icu_stay WHERE id = $1`,
      [input.icuStayId],
    );
    if (!stay.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan intensif tidak ditemukan.');
    if (stay[0].ended_at) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Perawatan intensif sudah berakhir.',
      );
    }

    const v = input.vitals ?? {};
    const skor = skorIntensif({
      vitals: v,
      onVentilator: input.onVentilator,
      onVasopressor: input.onVasopressor,
      onDialysis: input.onDialysis,
    });

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".icu_assessment
         (icu_stay_id, patient_id, assessed_by, respiratory_rate, spo2, systolic_bp,
          heart_rate, temperature, consciousness, on_ventilator, on_vasopressor,
          on_dialysis, severity_score, organ_support, risk_level, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id::text AS id`,
      [
        input.icuStayId,
        stay[0].patient_id,
        ctx.actorUserId,
        v.respiratoryRate ?? null,
        v.spo2 ?? null,
        v.systolicBp ?? null,
        v.heartRate ?? null,
        v.temperature ?? null,
        v.consciousness ?? null,
        input.onVentilator ?? false,
        input.onVasopressor ?? false,
        input.onDialysis ?? false,
        skor.score,
        skor.organSupport,
        skor.risk,
        input.note ?? null,
      ],
    );

    if (skor.risk === 'CRITICAL') {
      this.logger.warn(
        `Asesmen intensif ${rows[0].id} berisiko kritis: skor ${skor.score}, ` +
          `dukungan organ ${skor.organSupport}.`,
      );
    }

    return { id: rows[0].id, ...skor };
  }

  /** Papan perawatan intensif. */
  async papanIntensif(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT s.id::text AS id, s.started_at::text AS started_at, s.admission_reason,
              p.full_name AS patient_name, a.admission_number,
              a2.severity_score, a2.organ_support, a2.risk_level,
              a2.assessed_at::text AS last_assessed_at,
              a2.on_ventilator, a2.on_vasopressor, a2.on_dialysis
         FROM "${schema}".icu_stay s
         JOIN "${schema}".patient p ON p.id = s.patient_id
         JOIN "${schema}".health_admission a ON a.id = s.admission_id
         LEFT JOIN LATERAL (
           SELECT severity_score, organ_support, risk_level, assessed_at,
                  on_ventilator, on_vasopressor, on_dialysis
             FROM "${schema}".icu_assessment
            WHERE icu_stay_id = s.id ORDER BY assessed_at DESC LIMIT 1
         ) a2 ON TRUE
        WHERE a.facility_id = $1 AND s.ended_at IS NULL
        ORDER BY a2.severity_score DESC NULLS LAST
        LIMIT 200`,
      [facilityId],
    );
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async nomor(
    client: PoolClient,
    schema: string,
    tabel: string,
    kolom: string,
    awalan: string,
    facilityId: string,
    facilityCode: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".${tabel}
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    void kolom;
    return `${awalan}-${facilityCode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
