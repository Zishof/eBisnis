/**
 * Rawat inap: penerimaan, penempatan tempat tidur, perpindahan, pemulangan,
 * dan pengamatan keperawatan.
 *
 * Aturannya ada di `health-inpatient.ts` sebagai fungsi murni.
 *
 * Yang dijaga paling ketat di sini adalah **satu tempat tidur satu pasien**, dan
 * ia dijaga tiga kali: oleh aturan murni, oleh penguncian baris di layanan ini,
 * dan oleh indeks unik parsial pada basis data. Terdengar berlebihan sampai
 * seseorang menempatkan pasien kedua di tempat tidur yang menurut layar kosong.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  bolehPindah,
  bolehPulangkan,
  bolehTempati,
  bolehUbahStatusTempatTidur,
  lamaRawat,
  pengamatanTerlambat,
  pilihTempatTidur,
  skorPeringatanDini,
  type CaraPulang,
  type JenisIsolasi,
  type KebutuhanPasien,
  type StatusRawatInap,
  type StatusTempatTidur,
  type TempatTidur,
} from './health-inpatient';

@Injectable()
export class HealthInpatientService {
  private readonly logger = new Logger(HealthInpatientService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Penerimaan ------------------------------------------------------------

  /**
   * Menerima pasien rawat inap dan menempatkannya pada satu tempat tidur.
   *
   * Keduanya dalam satu transaksi. Penerimaan tanpa tempat tidur menghasilkan
   * pasien yang tercatat dirawat tetapi tidak berada di mana pun — dan perawat
   * yang mencarinya akan menemukannya di lorong.
   */
  async terima(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      encounterId?: string | null;
      serviceUnitId?: string | null;
      providerId?: string | null;
      admissionReason?: string | null;
      isolationType?: JenisIsolasi;
      classCode?: string | null;
      /** Bila kosong, tempat tidur dipilihkan. */
      bedId?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const fasilitas = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');

    const pasien = await this.kebutuhanPasien(schema, input.patientId, {
      isolation: input.isolationType ?? 'NONE',
      classCode: input.classCode ?? null,
    });

    return this.tenantDb.transaction(schema, async (client) => {
      /*
       * Perawatan aktif diperiksa lebih dahulu. Basis data menegakkannya pula
       * lewat `ux_health_admission_one_active`; diperiksa di sini supaya
       * pesannya dapat dibaca manusia, bukan berupa galat indeks unik.
       */
      const aktif = await client.query<{ admission_number: string }>(
        `SELECT admission_number FROM "${schema}".health_admission
          WHERE patient_id = $1 AND status IN ('ADMITTED','DISCHARGE_PLANNED')`,
        [input.patientId],
      );
      if (aktif.rows.length) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Pasien ini masih dirawat pada perawatan ${aktif.rows[0].admission_number}. ` +
            'Pulangkan atau pindahkan lebih dahulu.',
        );
      }

      const kandidat = await this.tempatTidurTersedia(client, schema, input.facilityId, input.bedId ?? null);
      const pilihan = input.bedId
        ? { bed: kandidat[0] ?? null, rejected: [] as Array<{ bed: TempatTidur; reason: string }> }
        : pilihTempatTidur(kandidat, pasien);

      if (!pilihan.bed) {
        /*
         * Sebab tiap penolakan ikut dilaporkan. Perawat yang melihat "tidak ada
         * tempat tidur" tanpa tahu mengapa akan menyimpulkan rumah sakitnya
         * penuh, padahal mungkin semuanya hanya belum dibersihkan.
         */
        const ringkas = pilihan.rejected.reduce<Record<string, number>>((a, r) => {
          a[r.reason] = (a[r.reason] ?? 0) + 1;
          return a;
        }, {});
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Tidak ada tempat tidur yang dapat ditempati pasien ini.',
          { rejected: ringkas },
        );
      }

      // Bila tempat tidurnya disebut pemanggil, aturannya tetap berlaku.
      if (input.bedId) {
        const izin = bolehTempati(pilihan.bed, pasien);
        if (!izin.allowed) {
          throw AppError.unprocessable(
            ErrorCodes.VALIDATION_FAILED,
            izin.message ?? 'Tempat tidur tidak dapat ditempati.',
            { reason: izin.reason },
          );
        }
      }

      const nomor = await this.nomorPerawatan(client, schema, input.facilityId, fasilitas[0].code);

      const perawatan = await client.query<{ id: string; admission_number: string }>(
        `INSERT INTO "${schema}".health_admission
           (admission_number, patient_id, facility_id, encounter_id, service_unit_id,
            admitted_by, attending_provider_id, admission_reason, isolation_type,
            class_code, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ADMITTED')
         RETURNING id::text AS id, admission_number`,
        [
          nomor,
          input.patientId,
          input.facilityId,
          input.encounterId ?? null,
          input.serviceUnitId ?? null,
          ctx.actorUserId,
          input.providerId ?? null,
          input.admissionReason ?? null,
          input.isolationType ?? 'NONE',
          input.classCode ?? null,
        ],
      );
      const admissionId = perawatan.rows[0].id;

      await this.tempati(client, schema, {
        admissionId,
        bedId: pilihan.bed.id,
        patientId: input.patientId,
        sex: pasien.sex,
        userId: ctx.actorUserId,
      });

      await this.audit.recordAccess(schema, {
        patientId: input.patientId,
        facilityId: input.facilityId,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'health_admission',
        entityId: admissionId,
      });

      return {
        id: admissionId,
        admissionNumber: perawatan.rows[0].admission_number,
        bedId: pilihan.bed.id,
        bedCode: pilihan.bed.code,
      };
    });
  }

  /**
   * Memindahkan pasien ke tempat tidur lain.
   *
   * Dua peristiwa yang harus terjadi bersamaan: yang lama ditinggalkan, yang
   * baru ditempati. Bila hanya salah satunya tercatat, ada tempat tidur yang
   * tampak terisi pasien hantu, atau pasien yang tampak berada di dua tempat.
   */
  async pindah(
    schema: string,
    admissionId: string,
    input: { bedId: string; note?: string | null },
    ctx: KonteksAkses,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const perawatan = await client.query<{
        status: StatusRawatInap;
        patient_id: string;
        facility_id: string;
        isolation_type: JenisIsolasi;
        class_code: string | null;
      }>(
        `SELECT status, patient_id::text AS patient_id, facility_id::text AS facility_id,
                isolation_type, class_code
           FROM "${schema}".health_admission WHERE id = $1 FOR UPDATE`,
        [admissionId],
      );
      if (!perawatan.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');
      }
      const a = perawatan.rows[0];

      const pasien = await this.kebutuhanPasien(schema, a.patient_id, {
        isolation: a.isolation_type,
        classCode: a.class_code,
      });

      const kandidat = await this.tempatTidurTersedia(client, schema, a.facility_id, input.bedId);
      if (!kandidat.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tempat tidur tujuan tidak ditemukan.');
      }

      const sekarang = await client.query<{ id: string; bed_id: string }>(
        `SELECT id::text AS id, bed_id::text AS bed_id FROM "${schema}".health_bed_assignment
          WHERE admission_id = $1 AND released_at IS NULL FOR UPDATE`,
        [admissionId],
      );

      const izin = bolehPindah({
        status: a.status,
        bedTujuan: kandidat[0],
        pasien,
        bedAsalId: sekarang.rows[0]?.bed_id ?? null,
      });
      if (!izin.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          izin.message ?? 'Perpindahan ditolak.',
          { reason: izin.reason },
        );
      }

      if (sekarang.rows[0]) {
        await this.lepaskan(client, schema, {
          assignmentId: sekarang.rows[0].id,
          bedId: sekarang.rows[0].bed_id,
          reason: 'TRANSFER',
          userId: ctx.actorUserId,
        });
      }

      await this.tempati(client, schema, {
        admissionId,
        bedId: input.bedId,
        patientId: a.patient_id,
        sex: pasien.sex,
        userId: ctx.actorUserId,
        note: input.note ?? null,
      });

      return { id: admissionId, bedId: input.bedId, bedCode: kandidat[0].code };
    });
  }

  // --- Pemulangan ------------------------------------------------------------

  /**
   * Memulangkan pasien.
   *
   * Nilai kritis yang belum diterima klinisi menahan pemulangan — kecuali pada
   * kematian. Pasien yang pulang membawa kalium 7,2 yang belum pernah dibaca
   * adalah kejadian yang berakhir di ruang gawat darurat pada malam yang sama.
   */
  async pulangkan(
    schema: string,
    admissionId: string,
    input: { disposition: CaraPulang; reason?: string | null; deathAt?: string | null },
    ctx: KonteksAkses,
  ) {
    const perawatan = await this.tenantDb.query<{
      status: StatusRawatInap;
      patient_id: string;
      facility_id: string;
      admitted_at: string;
    }>(
      schema,
      `SELECT status, patient_id::text AS patient_id, facility_id::text AS facility_id,
              admitted_at::text AS admitted_at
         FROM "${schema}".health_admission WHERE id = $1`,
      [admissionId],
    );
    if (!perawatan.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');
    const a = perawatan[0];

    const kritis = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT count(*)::text AS n
         FROM "${schema}".lab_critical_notification c
         JOIN "${schema}".lab_result r ON r.id = c.result_id
        WHERE c.patient_id = $1 AND c.acknowledged_at IS NULL`,
      [a.patient_id],
    );

    const ringkasan = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT count(*)::text AS n FROM "${schema}".health_discharge_summary WHERE admission_id = $1`,
      [admissionId],
    );

    const izin = bolehPulangkan({
      status: a.status,
      disposition: input.disposition,
      unacknowledgedCriticalCount: Number(kritis[0].n),
      hasDischargeSummary: Number(ringkasan[0].n) > 0,
      reason: input.reason ?? null,
      deathAt: input.deathAt ?? null,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Pemulangan ditolak.',
        { reason: izin.reason },
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const keluar = new Date().toISOString();
      const hari = lamaRawat(a.admitted_at, keluar);

      await client.query(
        `UPDATE "${schema}".health_admission
            SET status = $2, discharged_at = now(), discharged_by = $3, disposition = $4,
                discharge_reason = $5, death_at = $6, length_of_stay = $7,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          admissionId,
          input.disposition === 'DECEASED' ? 'DECEASED' : 'DISCHARGED',
          ctx.actorUserId,
          input.disposition,
          input.reason ?? null,
          input.deathAt ?? null,
          hari,
        ],
      );

      const penempatan = await client.query<{ id: string; bed_id: string }>(
        `SELECT id::text AS id, bed_id::text AS bed_id FROM "${schema}".health_bed_assignment
          WHERE admission_id = $1 AND released_at IS NULL FOR UPDATE`,
        [admissionId],
      );
      for (const p of penempatan.rows) {
        await this.lepaskan(client, schema, {
          assignmentId: p.id,
          bedId: p.bed_id,
          reason: input.disposition === 'DECEASED' ? 'DEATH' : 'DISCHARGE',
          userId: ctx.actorUserId,
        });
      }

      await this.audit.recordAccess(schema, {
        patientId: a.patient_id,
        facilityId: a.facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'health_admission',
        entityId: admissionId,
      });

      return { id: admissionId, disposition: input.disposition, lengthOfStay: hari };
    });
  }

  /** Menulis ringkasan pulang. */
  async tulisRingkasan(
    schema: string,
    admissionId: string,
    input: {
      dischargeDiagnosis: string;
      admissionDiagnosis?: string | null;
      hospitalCourse?: string | null;
      procedures?: string | null;
      dischargeMedications?: string | null;
      followUpPlan?: string | null;
      diet?: string | null;
      activity?: string | null;
      warningSigns?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const perawatan = await this.tenantDb.query<{ patient_id: string; facility_id: string }>(
      schema,
      `SELECT patient_id::text AS patient_id, facility_id::text AS facility_id
         FROM "${schema}".health_admission WHERE id = $1`,
      [admissionId],
    );
    if (!perawatan.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_discharge_summary
         (admission_id, patient_id, admission_diagnosis, discharge_diagnosis, hospital_course,
          procedures, discharge_medications, follow_up_plan, diet, activity, warning_signs,
          written_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (admission_id) DO UPDATE SET
         admission_diagnosis = EXCLUDED.admission_diagnosis,
         discharge_diagnosis = EXCLUDED.discharge_diagnosis,
         hospital_course = EXCLUDED.hospital_course,
         procedures = EXCLUDED.procedures,
         discharge_medications = EXCLUDED.discharge_medications,
         follow_up_plan = EXCLUDED.follow_up_plan,
         diet = EXCLUDED.diet,
         activity = EXCLUDED.activity,
         warning_signs = EXCLUDED.warning_signs,
         updated_at = now(),
         version = "${schema}".health_discharge_summary.version + 1
       RETURNING id::text AS id`,
      [
        admissionId,
        perawatan[0].patient_id,
        input.admissionDiagnosis ?? null,
        input.dischargeDiagnosis,
        input.hospitalCourse ?? null,
        input.procedures ?? null,
        input.dischargeMedications ?? null,
        input.followUpPlan ?? null,
        input.diet ?? null,
        input.activity ?? null,
        input.warningSigns ?? null,
        ctx.actorUserId,
      ],
    );

    return { id: rows[0].id, admissionId };
  }

  // --- Keperawatan -----------------------------------------------------------

  /**
   * Mencatat pengamatan keperawatan.
   *
   * Skor peringatan dini dihitung peladen dan **disimpan**, bukan dihitung ulang
   * saat dibaca. Rumusnya kelak akan disesuaikan, dan pengamatan bulan lalu
   * harus tetap dapat dijelaskan dengan rumus bulan lalu.
   */
  async catatPengamatan(
    schema: string,
    input: {
      admissionId: string;
      respiratoryRate?: number | null;
      spo2?: number | null;
      systolicBp?: number | null;
      diastolicBp?: number | null;
      heartRate?: number | null;
      temperature?: number | null;
      consciousness?: 'ALERT' | 'VOICE' | 'PAIN' | 'UNRESPONSIVE' | null;
      painScore?: number | null;
      note?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const perawatan = await this.tenantDb.query<{
      patient_id: string;
      facility_id: string;
      status: StatusRawatInap;
    }>(
      schema,
      `SELECT patient_id::text AS patient_id, facility_id::text AS facility_id, status
         FROM "${schema}".health_admission WHERE id = $1`,
      [input.admissionId],
    );
    if (!perawatan.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Perawatan tidak ditemukan.');
    if (!['ADMITTED', 'DISCHARGE_PLANNED'].includes(perawatan[0].status)) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Pengamatan hanya dapat dicatat pada pasien yang sedang dirawat, saat ini ${perawatan[0].status}.`,
      );
    }

    const skor = skorPeringatanDini({
      respiratoryRate: input.respiratoryRate,
      spo2: input.spo2,
      systolicBp: input.systolicBp,
      heartRate: input.heartRate,
      temperature: input.temperature,
      consciousness: input.consciousness,
    });

    const rows = await this.tenantDb.query<{ id: string; next_due_at: string }>(
      schema,
      `INSERT INTO "${schema}".health_nursing_observation
         (admission_id, patient_id, observed_by, respiratory_rate, spo2, systolic_bp,
          diastolic_bp, heart_rate, temperature, consciousness, pain_score,
          early_warning_score, risk_level, next_due_at, missing_vitals, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               now() + ($14 || ' minutes')::interval, $15, $16)
       RETURNING id::text AS id, next_due_at::text AS next_due_at`,
      [
        input.admissionId,
        perawatan[0].patient_id,
        ctx.actorUserId,
        input.respiratoryRate ?? null,
        input.spo2 ?? null,
        input.systolicBp ?? null,
        input.diastolicBp ?? null,
        input.heartRate ?? null,
        input.temperature ?? null,
        input.consciousness ?? null,
        input.painScore ?? null,
        skor.score,
        skor.risk,
        String(skor.observationMinutes),
        skor.missing,
        input.note ?? null,
      ],
    );

    if (skor.risk === 'HIGH') {
      this.logger.warn(
        `Skor peringatan dini ${skor.score} pada perawatan ${input.admissionId}. ` +
          `Pengamatan berikutnya dalam ${skor.observationMinutes} menit.`,
      );
    }

    return {
      id: rows[0].id,
      score: skor.score,
      risk: skor.risk,
      observationMinutes: skor.observationMinutes,
      nextDueAt: rows[0].next_due_at,
      missing: skor.missing,
    };
  }

  // --- Pembacaan -------------------------------------------------------------

  /** Papan bangsal: siapa di tempat tidur mana, dan siapa yang menunggu dilihat. */
  async papanBangsal(schema: string, facilityId: string) {
    const rows = await this.tenantDb.query<{
      admission_id: string;
      admission_number: string;
      patient_name: string;
      bed_code: string;
      room_name: string;
      admitted_at: string;
      isolation_type: string;
      status: string;
      early_warning_score: number | null;
      risk_level: string | null;
      last_observed_at: string | null;
      next_due_at: string | null;
    }>(
      schema,
      `SELECT a.id::text AS admission_id, a.admission_number, p.full_name AS patient_name,
              b.code AS bed_code, r.name AS room_name, a.admitted_at::text AS admitted_at,
              a.isolation_type, a.status,
              o.early_warning_score, o.risk_level,
              o.observed_at::text AS last_observed_at, o.next_due_at::text AS next_due_at
         FROM "${schema}".health_admission a
         JOIN "${schema}".patient p ON p.id = a.patient_id
         LEFT JOIN "${schema}".health_bed_assignment asg
           ON asg.admission_id = a.id AND asg.released_at IS NULL
         LEFT JOIN "${schema}".health_bed b ON b.id = asg.bed_id
         LEFT JOIN "${schema}".health_room r ON r.id = b.room_id
         LEFT JOIN LATERAL (
           SELECT early_warning_score, risk_level, observed_at, next_due_at
             FROM "${schema}".health_nursing_observation
            WHERE admission_id = a.id
            ORDER BY observed_at DESC LIMIT 1
         ) o ON TRUE
        WHERE a.facility_id = $1 AND a.status IN ('ADMITTED','DISCHARGE_PLANNED')
        ORDER BY r.name NULLS LAST, b.code NULLS LAST
        LIMIT 300`,
      [facilityId],
    );

    const sekarang = new Date().toISOString();
    return rows.map((r) => {
      const jarak = r.risk_level === 'HIGH' ? 30 : r.risk_level === 'MEDIUM' ? 60 : 240;
      return {
        ...r,
        observation: pengamatanTerlambat({
          lastObservationAt: r.last_observed_at,
          observationMinutes: jarak,
          now: sekarang,
        }),
      };
    });
  }

  /** Tempat tidur beserta keadaannya, untuk papan penempatan. */
  async daftarTempatTidur(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT b.id::text AS id, b.code, b.bed_status AS status, b.care_class,
              b.last_cleaned_at::text AS last_cleaned_at,
              r.id::text AS room_id, r.name AS room_name, r.capacity,
              r.isolation_capability, r.current_sex,
              p.full_name AS patient_name, a.admission_number
         FROM "${schema}".health_bed b
         JOIN "${schema}".health_room r ON r.id = b.room_id
         JOIN "${schema}".health_service_unit u ON u.id = r.service_unit_id
         LEFT JOIN "${schema}".health_bed_assignment asg
           ON asg.bed_id = b.id AND asg.released_at IS NULL
         LEFT JOIN "${schema}".health_admission a ON a.id = asg.admission_id
         LEFT JOIN "${schema}".patient p ON p.id = asg.patient_id
        WHERE u.facility_id = $1 AND b.deleted_at IS NULL
        ORDER BY r.name, b.code
        LIMIT 500`,
      [facilityId],
    );
  }

  /**
   * Menyatakan tempat tidur sudah dibersihkan.
   *
   * Langkah tersendiri, dan itu inti dari keseluruhannya: tempat tidur yang baru
   * ditinggalkan tidak dapat langsung ditempati orang lain.
   */
  async ubahStatusTempatTidur(
    schema: string,
    bedId: string,
    status: StatusTempatTidur,
    ctx: KonteksAkses,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{ bed_status: StatusTempatTidur; code: string }>(
        `SELECT bed_status, code FROM "${schema}".health_bed WHERE id = $1 FOR UPDATE`,
        [bedId],
      );
      if (!rows.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tempat tidur tidak ditemukan.');

      const izin = bolehUbahStatusTempatTidur(rows.rows[0].bed_status, status);
      if (!izin.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          izin.message ?? 'Perubahan status ditolak.',
          { reason: izin.reason },
        );
      }

      /*
       * `$2` diberi tipe tegas. Tanpa itu Postgres menolak dengan "inconsistent
       * types deduced for parameter $2": ia dipakai sebagai nilai kolom sekaligus
       * sebagai pembanding di dalam CASE, dan penyimpulan tipenya berbenturan.
       * Tertangkap naskah bukti H-6.
       */
      await client.query(
        `UPDATE "${schema}".health_bed
            SET bed_status = $2::varchar,
                last_cleaned_at = CASE WHEN $2::varchar = 'AVAILABLE' THEN now() ELSE last_cleaned_at END,
                last_cleaned_by = CASE WHEN $2::varchar = 'AVAILABLE' THEN $3::uuid ELSE last_cleaned_by END,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [bedId, status, ctx.actorUserId],
      );

      return { id: bedId, code: rows.rows[0].code, status };
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  /** Menempati satu tempat tidur; memperbarui tempat tidur dan kamarnya. */
  private async tempati(
    client: PoolClient,
    schema: string,
    input: {
      admissionId: string;
      bedId: string;
      patientId: string;
      sex: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
      userId: string;
      note?: string | null;
    },
  ) {
    /*
     * Indeks unik parsial `ux_health_bed_one_patient` menahan penempatan kedua
     * pada tempat tidur yang sama. Galatnya ditangkap di sini supaya pesannya
     * dapat dibaca perawat, bukan berupa galat basis data.
     */
    try {
      await client.query(
        `INSERT INTO "${schema}".health_bed_assignment
           (admission_id, bed_id, patient_id, assigned_by, note)
         VALUES ($1,$2,$3,$4,$5)`,
        [input.admissionId, input.bedId, input.patientId, input.userId, input.note ?? null],
      );
    } catch (e) {
      const kode = (e as { code?: string }).code;
      if (kode === '23505') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Tempat tidur itu baru saja ditempati pasien lain. Pilih tempat tidur lain.',
        );
      }
      throw e;
    }

    await client.query(
      `UPDATE "${schema}".health_bed
          SET bed_status = 'OCCUPIED', current_admission_id = $2, updated_at = now(),
              version = version + 1
        WHERE id = $1`,
      [input.bedId, input.admissionId],
    );

    // Jenis kelamin kamar diperbarui supaya penempatan berikutnya tahu.
    if (input.sex === 'MALE' || input.sex === 'FEMALE') {
      await client.query(
        `UPDATE "${schema}".health_room r
            SET current_sex = $2, updated_at = now(), version = r.version + 1
           FROM "${schema}".health_bed b
          WHERE b.id = $1 AND r.id = b.room_id AND r.current_sex IS NULL`,
        [input.bedId, input.sex],
      );
    }
  }

  /**
   * Melepaskan penempatan; tempat tidurnya menjadi MENUNGGU PEMBERSIHAN.
   *
   * Bukan langsung kosong. Itu satu-satunya jalan keluar dari OCCUPIED yang
   * disediakan aturan, dan sengaja.
   */
  private async lepaskan(
    client: PoolClient,
    schema: string,
    input: { assignmentId: string; bedId: string; reason: string; userId: string },
  ) {
    await client.query(
      `UPDATE "${schema}".health_bed_assignment
          SET released_at = now(), released_by = $2, release_reason = $3, version = version + 1
        WHERE id = $1`,
      [input.assignmentId, input.userId, input.reason],
    );

    await client.query(
      `UPDATE "${schema}".health_bed
          SET bed_status = 'CLEANING', current_admission_id = NULL, updated_at = now(),
              version = version + 1
        WHERE id = $1`,
      [input.bedId],
    );

    // Kamar yang tidak lagi berpenghuni kehilangan penandaan jenis kelaminnya,
    // supaya pasien berikutnya tidak ditolak karena penghuni yang sudah pulang.
    await client.query(
      `UPDATE "${schema}".health_room r
          SET current_sex = NULL, updated_at = now(), version = r.version + 1
         FROM "${schema}".health_bed b
        WHERE b.id = $1 AND r.id = b.room_id
          AND NOT EXISTS (
            SELECT 1 FROM "${schema}".health_bed_assignment asg
              JOIN "${schema}".health_bed bb ON bb.id = asg.bed_id
             WHERE bb.room_id = r.id AND asg.released_at IS NULL
          )`,
      [input.bedId],
    );
  }

  private async kebutuhanPasien(
    schema: string,
    patientId: string,
    over: { isolation: JenisIsolasi; classCode: string | null },
  ): Promise<KebutuhanPasien> {
    const rows = await this.tenantDb.query<{ gender: string | null; birth_date: string | null }>(
      schema,
      `SELECT gender, birth_date::text FROM "${schema}".patient
        WHERE id = $1 AND deleted_at IS NULL`,
      [patientId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');

    const lahir = rows[0].birth_date ? Date.parse(rows[0].birth_date) : NaN;
    return {
      sex: (rows[0].gender as 'MALE' | 'FEMALE' | null) ?? null,
      isolation: over.isolation,
      classCode: over.classCode,
      ageYears: Number.isNaN(lahir) ? null : (Date.now() - lahir) / (365.25 * 24 * 3600 * 1000),
    };
  }

  /**
   * Tempat tidur yang mungkin dipakai, beserta keadaan kamarnya.
   *
   * Baris tempat tidurnya DIKUNCI. Tanpa itu, dua penerimaan bersamaan
   * sama-sama melihat tempat tidur yang sama kosong — dan yang kedua baru gagal
   * pada indeks unik, setelah perawatannya terlanjur dibuat.
   */
  private async tempatTidurTersedia(
    client: PoolClient,
    schema: string,
    facilityId: string,
    bedId: string | null,
  ): Promise<TempatTidur[]> {
    const rows = await client.query<{
      id: string;
      code: string;
      room_id: string;
      bed_status: StatusTempatTidur;
      care_class: string | null;
      room_capacity: number;
      room_occupied: number;
      current_sex: string | null;
      isolation_capability: string[];
    }>(
      `SELECT b.id::text AS id, b.code, b.room_id::text AS room_id, b.bed_status,
              b.care_class, r.capacity AS room_capacity, r.current_sex,
              r.isolation_capability,
              (SELECT count(*)::int FROM "${schema}".health_bed_assignment asg
                 JOIN "${schema}".health_bed bb ON bb.id = asg.bed_id
                WHERE bb.room_id = r.id AND asg.released_at IS NULL) AS room_occupied
         FROM "${schema}".health_bed b
         JOIN "${schema}".health_room r ON r.id = b.room_id
         JOIN "${schema}".health_service_unit u ON u.id = r.service_unit_id
        WHERE u.facility_id = $1 AND b.deleted_at IS NULL AND b.is_active = TRUE
          AND ($2::uuid IS NULL OR b.id = $2::uuid)
        ORDER BY r.name, b.code
        FOR UPDATE OF b`,
      [facilityId, bedId],
    );

    return rows.rows.map((r) => ({
      id: r.id,
      code: r.code,
      roomId: r.room_id,
      status: r.bed_status,
      roomSex: (r.current_sex as 'MALE' | 'FEMALE' | null) ?? null,
      roomCapacity: r.room_capacity,
      roomOccupied: r.room_occupied,
      isolationCapability: (r.isolation_capability ?? []) as JenisIsolasi[],
      classCode: r.care_class,
    }));
  }

  private async nomorPerawatan(
    client: PoolClient,
    schema: string,
    facilityId: string,
    facilityCode: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".health_admission
        WHERE facility_id = $1 AND admitted_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `INP-${facilityCode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
