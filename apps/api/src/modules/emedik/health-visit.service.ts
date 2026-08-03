/**
 * Pendaftaran, antrean, kunjungan, dan dokumentasi klinis.
 *
 * Satu layanan untuk keduanya karena alurnya memang satu: pasien mendaftar,
 * memperoleh nomor antrean, dipanggil, lalu kunjungannya didokumentasikan.
 * Memisahkannya menjadi dua layanan hanya akan membuat keduanya saling
 * memanggil.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  labelAntrean,
  prioritasDariUmur,
  susunNomorPendaftaran,
  tanggalUsaha,
  tentukanTagihan,
  tingkatPrioritas,
  urutkanAntrean,
  type AlasanPrioritas,
  type AntreanBaris,
} from './health-front-office';

@Injectable()
export class HealthVisitService {
  private readonly logger = new Logger(HealthVisitService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Pendaftaran -----------------------------------------------------------

  /**
   * Mendaftarkan pasien untuk satu kunjungan.
   *
   * Status tagihan ditentukan **sekali di sini** lalu disimpan. Tidak dihitung
   * ulang saat laporan dibuka, supaya tagihan bulan lalu tetap dapat dijelaskan
   * dengan aturan bulan lalu ketika aturannya kelak disesuaikan.
   */
  async daftarkanKunjungan(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      serviceUnitId?: string | null;
      providerId?: string | null;
      appointmentId?: string | null;
      visitType?: string;
      channel?: string;
      payerType?: string;
      chiefComplaint?: string | null;
      priorityReason?: AlasanPrioritas;
      isTestPatient?: boolean;
    },
    ctx: KonteksAkses,
  ) {
    const fasilitas = await this.tenantDb.query<{
      code: string;
      timezone: string;
      is_sample: boolean;
    }>(
      schema,
      `SELECT code, timezone, is_sample FROM "${schema}".health_facility
        WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');
    }

    const profil = await this.tenantDb.query<{ is_training: boolean }>(
      schema,
      `SELECT is_training FROM "${schema}".health_tenant_profile
        WHERE deleted_at IS NULL LIMIT 1`,
    );

    const pasien = await this.tenantDb.query<{
      birth_date: string | null;
      is_sample: boolean;
      merged_into_id: string | null;
      deceased_at: string | null;
    }>(
      schema,
      `SELECT birth_date::text, is_sample, merged_into_id, deceased_at::text
         FROM "${schema}".patient WHERE id = $1 AND deleted_at IS NULL`,
      [input.patientId],
    );
    if (!pasien.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');

    /*
     * Rekam medis yang sudah digabungkan tidak boleh menerima pendaftaran baru.
     * Membiarkannya akan menumpuk riwayat pada rekam yang seharusnya sudah
     * tidak dipakai, dan penggabungan berikutnya harus mengulang pekerjaannya.
     */
    if (pasien[0].merged_into_id) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Rekam medis ini sudah digabungkan ke rekam medis lain. Daftarkan pada rekam medis induknya.',
      );
    }

    const businessDate = tanggalUsaha(new Date(), fasilitas[0].timezone ?? 'Asia/Jakarta');

    const tagihan = tentukanTagihan({
      isSampleData: pasien[0].is_sample || fasilitas[0].is_sample,
      isTrainingTenant: profil[0]?.is_training ?? false,
      isTestPatient: input.isTestPatient ?? false,
      cancelledBeforeService: false,
      supersededByCorrection: false,
    });

    return this.tenantDb.transaction(schema, async (client) => {
      const urutan = await client.query<{ n: string }>(
        `SELECT COUNT(*) + 1 AS n FROM "${schema}".health_registration
          WHERE facility_id = $1 AND business_date = $2`,
        [input.facilityId, businessDate],
      );
      const nomor = susunNomorPendaftaran(
        fasilitas[0].code,
        businessDate,
        Number(urutan.rows[0].n),
      );

      const reg = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".health_registration
           (patient_id, facility_id, service_unit_id, provider_id, appointment_id,
            registration_number, business_date, visit_type, channel, payer_type,
            chief_complaint, is_test_patient, is_billable, non_billable_reason,
            is_sample, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'OUTPATIENT'),COALESCE($9,'WALK_IN'),
                 COALESCE($10,'SELF_PAY'),$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          input.patientId,
          input.facilityId,
          input.serviceUnitId ?? null,
          input.providerId ?? null,
          input.appointmentId ?? null,
          nomor,
          businessDate,
          input.visitType ?? null,
          input.channel ?? null,
          input.payerType ?? null,
          input.chiefComplaint ?? null,
          input.isTestPatient ?? false,
          tagihan.isBillable,
          tagihan.nonBillableReason,
          pasien[0].is_sample,
          ctx.actorUserId,
        ],
      );
      const registrationId = reg.rows[0].id;

      // --- Antrean -----------------------------------------------------------
      const umur = pasien[0].birth_date
        ? (Date.now() - new Date(pasien[0].birth_date).getTime()) / (365.25 * 24 * 3600 * 1000)
        : null;
      const alasan = input.priorityReason ?? prioritasDariUmur(umur);
      const prioritas = tingkatPrioritas(alasan);

      const prefix = (
        await client.query<{ code: string }>(
          `SELECT COALESCE(LEFT(code, 1), 'A') AS code FROM "${schema}".health_service_unit
            WHERE id = $1`,
          [input.serviceUnitId ?? null],
        )
      ).rows[0]?.code ?? 'A';

      /*
       * Nomor antrean diambil di dalam transaksi yang sama, dan keunikannya
       * dijaga indeks unik. Dua petugas yang mendaftarkan bersamaan akan
       * menghasilkan nomor yang sama bila hanya perhitungan ini yang menjaganya.
       */
      const nomorAntre = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(queue_number), 0) + 1 AS n FROM "${schema}".health_queue
          WHERE facility_id = $1
            AND service_unit_id IS NOT DISTINCT FROM $2::uuid
            AND business_date = $3 AND queue_prefix = $4`,
        [input.facilityId, input.serviceUnitId ?? null, businessDate, prefix],
      );
      const nomorAntrean = Number(nomorAntre.rows[0].n);

      await client.query(
        `INSERT INTO "${schema}".health_queue
           (registration_id, facility_id, service_unit_id, business_date,
            queue_prefix, queue_number, queue_label, priority, priority_reason, is_sample)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          registrationId,
          input.facilityId,
          input.serviceUnitId ?? null,
          businessDate,
          prefix,
          nomorAntrean,
          labelAntrean(prefix, nomorAntrean),
          prioritas,
          alasan === 'NONE' ? null : alasan,
          pasien[0].is_sample,
        ],
      );

      return {
        registrationId,
        registrationNumber: nomor,
        businessDate,
        queueLabel: labelAntrean(prefix, nomorAntrean),
        priority: prioritas,
        priorityReason: alasan,
        isBillable: tagihan.isBillable,
        nonBillableReason: tagihan.nonBillableReason,
      };
    });
  }

  /** Antrean yang sedang menunggu pada satu unit. */
  async antrean(schema: string, facilityId: string, serviceUnitId?: string | null) {
    const businessDate = tanggalUsaha(new Date(), 'Asia/Jakarta');
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT q.id, q.queue_prefix, q.queue_number, q.queue_label, q.priority,
              q.priority_reason, q.status, q.created_at, q.called_at,
              p.full_name AS patient_name, r.registration_number
         FROM "${schema}".health_queue q
         JOIN "${schema}".health_registration r ON r.id = q.registration_id
         JOIN "${schema}".patient p ON p.id = r.patient_id
        WHERE q.facility_id = $1
          AND q.service_unit_id IS NOT DISTINCT FROM $2::uuid
          AND q.business_date = $3
          AND q.status IN ('WAITING','CALLED')`,
      [facilityId, serviceUnitId ?? null, businessDate],
    );

    const baris: AntreanBaris[] = rows.map((r) => ({
      id: String(r.id),
      queuePrefix: String(r.queue_prefix),
      queueNumber: Number(r.queue_number),
      priority: Number(r.priority),
      status: String(r.status),
      createdAt: String(r.created_at),
    }));

    const urut = urutkanAntrean(baris);
    const peta = new Map(rows.map((r) => [String(r.id), r]));

    return {
      businessDate,
      waiting: urut.length,
      queue: urut.map((b) => peta.get(b.id)),
      next: urut.length ? peta.get(urut[0].id) : null,
    };
  }

  /** Memanggil antrean berikutnya. */
  async panggilBerikutnya(
    schema: string,
    facilityId: string,
    serviceUnitId: string | null,
    counterCode: string | null,
    ctx: KonteksAkses,
  ) {
    const antre = await this.antrean(schema, facilityId, serviceUnitId);
    if (!antre.next) {
      return { called: null, message: 'Tidak ada pasien yang menunggu.' };
    }
    const id = String((antre.next as Record<string, unknown>).id);

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_queue
          SET status = 'CALLED', called_at = now(), called_by = $2,
              call_count = call_count + 1, counter_code = COALESCE($3, counter_code),
              version = version + 1
        WHERE id = $1`,
      [id, ctx.actorUserId, counterCode],
    );

    return { called: antre.next, message: null };
  }

  // --- Kunjungan klinis ------------------------------------------------------

  async mulaiKunjungan(
    schema: string,
    input: {
      registrationId: string;
      providerId?: string | null;
      sensitivity?: string;
    },
    ctx: KonteksAkses,
  ) {
    const reg = await this.tenantDb.query<{
      patient_id: string;
      facility_id: string;
      service_unit_id: string | null;
      business_date: string;
      visit_type: string;
      status: string;
      facility_code: string;
    }>(
      schema,
      `SELECT r.patient_id, r.facility_id, r.service_unit_id, r.business_date::text,
              r.visit_type, r.status, f.code AS facility_code
         FROM "${schema}".health_registration r
         JOIN "${schema}".health_facility f ON f.id = r.facility_id
        WHERE r.id = $1`,
      [input.registrationId],
    );
    if (!reg.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftaran tidak ditemukan.');
    if (reg[0].status === 'CANCELLED') {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Pendaftaran ini sudah dibatalkan; kunjungan tidak dapat dimulai.',
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      /*
       * Nomor kunjungan harus unik SE-TENANT, bukan se-fasilitas.
       *
       * `ux_health_encounter_number` adalah indeks unik pada `encounter_number`
       * saja. Penomoran yang hanya urut per fasilitas per hari karena itu
       * bertabrakan begitu fasilitas kedua memulai kunjungan pertamanya pada
       * hari yang sama — dan satu fasilitas saja tidak pernah menunjukkannya.
       *
       * Kode fasilitas disertakan supaya nomornya unik sekaligus terbaca:
       * yang membaca "ENC-KLN01-20260801-0001" tahu fasilitas mana yang
       * dimaksud tanpa membuka basis data.
       */
      const urutan = await client.query<{ n: string }>(
        `SELECT COUNT(*) + 1 AS n FROM "${schema}".health_encounter
          WHERE facility_id = $1 AND started_at::date = CURRENT_DATE`,
        [reg[0].facility_id],
      );
      const kodeFasilitas =
        (reg[0].facility_code ?? 'FAC').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 10) ||
        'FAC';
      const nomor = `ENC-${kodeFasilitas}-${reg[0].business_date.replace(/-/g, '')}-${String(
        Number(urutan.rows[0].n),
      ).padStart(4, '0')}`;

      const enc = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".health_encounter
           (patient_id, registration_id, facility_id, service_unit_id, provider_id,
            encounter_number, encounter_type, sensitivity, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8,'NORMAL'),$9)
         RETURNING id`,
        [
          reg[0].patient_id,
          input.registrationId,
          reg[0].facility_id,
          reg[0].service_unit_id,
          input.providerId ?? null,
          nomor,
          reg[0].visit_type,
          input.sensitivity ?? null,
          ctx.actorUserId,
        ],
      );

      await client.query(
        `UPDATE "${schema}".health_registration
            SET status = 'IN_SERVICE', served_at = COALESCE(served_at, now()), version = version + 1
          WHERE id = $1`,
        [input.registrationId],
      );
      await client.query(
        `UPDATE "${schema}".health_queue
            SET status = 'IN_SERVICE', served_at = now(), version = version + 1
          WHERE registration_id = $1`,
        [input.registrationId],
      );

      await this.audit.recordAccess(schema, {
        patientId: reg[0].patient_id,
        facilityId: reg[0].facility_id,
        actorUserId: ctx.actorUserId,
        activeRoleId: ctx.activeRoleId ?? null,
        purposeOfUse: 'TREATMENT',
        entityType: 'health_encounter',
        entityId: enc.rows[0].id,
        action: 'READ',
        requestId: ctx.requestId ?? null,
      });

      return { encounterId: enc.rows[0].id, encounterNumber: nomor };
    });
  }

  /**
   * Menyimpan catatan klinis.
   *
   * Catatan yang ditandatangani langsung tidak dapat diubah lagi sesudahnya —
   * penjaganya ada di basis data. Karena itu `sign: true` diperlakukan sebagai
   * keputusan sadar, bukan bawaan.
   */
  async catatKlinis(
    schema: string,
    input: {
      encounterId: string;
      noteType?: string;
      subjective?: string | null;
      objective?: string | null;
      assessment?: string | null;
      plan?: string | null;
      freeText?: string | null;
      sign?: boolean;
      signedByProviderId?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const enc = await this.tenantDb.query<{ patient_id: string; status: string; sensitivity: string }>(
      schema,
      `SELECT patient_id, status, sensitivity FROM "${schema}".health_encounter WHERE id = $1`,
      [input.encounterId],
    );
    if (!enc.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".clinical_note
         (encounter_id, patient_id, note_type, subjective, objective, assessment, plan,
          free_text, sensitivity, signed_at, signed_by, signed_by_provider_id, created_by)
       VALUES ($1,$2,COALESCE($3,'SOAP'),$4,$5,$6,$7,$8,$9,
               CASE WHEN $10 THEN now() ELSE NULL END,
               CASE WHEN $10 THEN $11::uuid ELSE NULL END,
               $12,$11)
       RETURNING id`,
      [
        input.encounterId,
        enc[0].patient_id,
        input.noteType ?? null,
        input.subjective ?? null,
        input.objective ?? null,
        input.assessment ?? null,
        input.plan ?? null,
        input.freeText ?? null,
        enc[0].sensitivity,
        input.sign ?? false,
        ctx.actorUserId,
        input.signedByProviderId ?? null,
      ],
    );
    return { noteId: rows[0].id, signed: input.sign ?? false };
  }

  /** Membuat amandemen atas catatan yang sudah ditandatangani. */
  async amandemenCatatan(
    schema: string,
    noteId: string,
    input: {
      subjective?: string | null;
      objective?: string | null;
      assessment?: string | null;
      plan?: string | null;
      reason: string;
      sign?: boolean;
    },
    ctx: KonteksAkses,
  ) {
    const asli = await this.tenantDb.query<{
      encounter_id: string;
      patient_id: string;
      note_type: string;
      signed_at: string | null;
      sensitivity: string;
    }>(
      schema,
      `SELECT encounter_id, patient_id, note_type, signed_at::text, sensitivity
         FROM "${schema}".clinical_note WHERE id = $1`,
      [noteId],
    );
    if (!asli.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Catatan tidak ditemukan.');

    if (!asli[0].signed_at) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Catatan ini belum ditandatangani, sehingga masih dapat disunting langsung. ' +
          'Amandemen hanya untuk catatan yang sudah ditandatangani.',
      );
    }
    if (input.reason.trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Amandemen catatan medis wajib beralasan sekurang-kurangnya sepuluh huruf.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".clinical_note
         (encounter_id, patient_id, note_type, subjective, objective, assessment, plan,
          sensitivity, amended_from_id, amendment_reason,
          signed_at, signed_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
               CASE WHEN $11 THEN now() ELSE NULL END,
               CASE WHEN $11 THEN $12::uuid ELSE NULL END,
               $12)
       RETURNING id`,
      [
        asli[0].encounter_id,
        asli[0].patient_id,
        asli[0].note_type,
        input.subjective ?? null,
        input.objective ?? null,
        input.assessment ?? null,
        input.plan ?? null,
        asli[0].sensitivity,
        noteId,
        input.reason.trim(),
        input.sign ?? true,
        ctx.actorUserId,
      ],
    );
    return { noteId: rows[0].id, amendedFrom: noteId };
  }

  async catatTandaVital(
    schema: string,
    input: Record<string, unknown> & { encounterId: string },
    ctx: KonteksAkses,
  ) {
    const enc = await this.tenantDb.query<{ patient_id: string }>(
      schema,
      `SELECT patient_id FROM "${schema}".health_encounter WHERE id = $1`,
      [input.encounterId],
    );
    if (!enc.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".vital_sign
         (encounter_id, patient_id, measured_by, systolic_mmhg, diastolic_mmhg, pulse_bpm,
          respiratory_rate, temperature_c, spo2_percent, weight_kg, height_cm,
          head_circum_cm, muac_cm, pain_score, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING id`,
      [
        input.encounterId,
        enc[0].patient_id,
        ctx.actorUserId,
        input.systolicMmhg ?? null,
        input.diastolicMmhg ?? null,
        input.pulseBpm ?? null,
        input.respiratoryRate ?? null,
        input.temperatureC ?? null,
        input.spo2Percent ?? null,
        input.weightKg ?? null,
        input.heightCm ?? null,
        input.headCircumCm ?? null,
        input.muacCm ?? null,
        input.painScore ?? null,
        input.note ?? null,
      ],
    );
    return rows[0];
  }

  async catatDiagnosis(
    schema: string,
    input: {
      encounterId: string;
      code?: string | null;
      codeSystem?: string;
      description: string;
      diagnosisRole?: string;
      certainty?: string;
    },
    ctx: KonteksAkses,
  ) {
    const enc = await this.tenantDb.query<{ patient_id: string }>(
      schema,
      `SELECT patient_id FROM "${schema}".health_encounter WHERE id = $1`,
      [input.encounterId],
    );
    if (!enc.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');

    try {
      const rows = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".encounter_diagnosis
           (encounter_id, patient_id, code_system, code, description, diagnosis_role,
            certainty, recorded_by)
         VALUES ($1,$2,COALESCE($3,'ICD10'),$4,$5,COALESCE($6,'SECONDARY'),
                 COALESCE($7,'CONFIRMED'),$8)
         RETURNING id`,
        [
          input.encounterId,
          enc[0].patient_id,
          input.codeSystem ?? null,
          input.code ?? null,
          input.description,
          input.diagnosisRole ?? null,
          input.certainty ?? null,
          ctx.actorUserId,
        ],
      );
      return rows[0];
    } catch (e) {
      // Indeks unik menolak diagnosis utama kedua. Pesannya diterjemahkan
      // supaya petugas tahu apa yang harus dilakukan, bukan membaca nama indeks.
      if (String((e as Error).message).includes('ux_encounter_diagnosis_primary')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Kunjungan ini sudah memiliki diagnosis utama. Ubah yang lama menjadi sekunder ' +
            'lebih dahulu, atau catat yang ini sebagai sekunder.',
        );
      }
      throw e;
    }
  }

  async buatOrder(
    schema: string,
    input: {
      encounterId: string;
      orderType: string;
      orderName: string;
      orderCode?: string | null;
      priority?: string;
      targetUnitId?: string | null;
      instruction?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const enc = await this.tenantDb.query<{ patient_id: string; facility_id: string }>(
      schema,
      `SELECT patient_id, facility_id FROM "${schema}".health_encounter WHERE id = $1`,
      [input.encounterId],
    );
    if (!enc.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');

    const urutan = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".clinical_order
        WHERE created_at::date = CURRENT_DATE`,
    );
    const nomor = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(
      Number(urutan[0].n),
    ).padStart(4, '0')}`;

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".clinical_order
         (encounter_id, patient_id, order_number, order_type, order_code, order_name,
          priority, status, target_unit_id, instruction, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,'ROUTINE'),'ORDERED',$8,$9,$10)
       RETURNING id`,
      [
        input.encounterId,
        enc[0].patient_id,
        nomor,
        input.orderType,
        input.orderCode ?? null,
        input.orderName,
        input.priority ?? null,
        input.targetUnitId ?? null,
        input.instruction ?? null,
        ctx.actorUserId,
      ],
    );
    return { orderId: rows[0].id, orderNumber: nomor };
  }

  /** Ringkasan satu kunjungan beserta catatan, diagnosis, dan ordernya. */
  async ringkasanKunjungan(schema: string, encounterId: string, ctx: KonteksAkses) {
    const enc = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT * FROM "${schema}".health_encounter WHERE id = $1`,
      [encounterId],
    );
    if (!enc.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kunjungan tidak ditemukan.');

    const [notes, diagnoses, vitals, orders] = await Promise.all([
      this.tenantDb.query(
        schema,
        `SELECT id, note_type, subjective, objective, assessment, plan,
                signed_at, amended_from_id, amendment_reason, created_at
           FROM "${schema}".clinical_note WHERE encounter_id = $1 ORDER BY created_at`,
        [encounterId],
      ),
      this.tenantDb.query(
        schema,
        `SELECT id, code, description, diagnosis_role, certainty
           FROM "${schema}".encounter_diagnosis WHERE encounter_id = $1
          ORDER BY diagnosis_role`,
        [encounterId],
      ),
      this.tenantDb.query(
        schema,
        `SELECT * FROM "${schema}".vital_sign WHERE encounter_id = $1 ORDER BY measured_at`,
        [encounterId],
      ),
      this.tenantDb.query(
        schema,
        `SELECT id, order_number, order_type, order_name, priority, status, ordered_at
           FROM "${schema}".clinical_order WHERE encounter_id = $1 ORDER BY ordered_at`,
        [encounterId],
      ),
    ]);

    await this.audit.recordAccess(schema, {
      patientId: String(enc[0].patient_id),
      facilityId: String(enc[0].facility_id),
      actorUserId: ctx.actorUserId,
      activeRoleId: ctx.activeRoleId ?? null,
      purposeOfUse: ctx.purposeOfUse,
      entityType: 'health_encounter',
      entityId: encounterId,
      action: 'READ',
      breakGlass: ctx.breakGlass ?? false,
      breakGlassReason: ctx.breakGlassReason ?? null,
      requestId: ctx.requestId ?? null,
    });

    return { encounter: enc[0], notes, diagnoses, vitals, orders };
  }

  /** Menyelesaikan kunjungan. */
  async selesaikanKunjungan(schema: string, encounterId: string, disposition: string | null) {
    await this.tenantDb.transaction(schema, async (client) => {
      const enc = await client.query<{ registration_id: string | null }>(
        `UPDATE "${schema}".health_encounter
            SET status = 'COMPLETED', ended_at = now(), disposition = $2, version = version + 1
          WHERE id = $1 AND status = 'IN_PROGRESS'
          RETURNING registration_id`,
        [encounterId, disposition],
      );
      if (!enc.rows.length) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Kunjungan tidak ditemukan atau sudah selesai.',
        );
      }
      if (enc.rows[0].registration_id) {
        await client.query(
          `UPDATE "${schema}".health_registration
              SET status = 'COMPLETED', completed_at = now(), version = version + 1
            WHERE id = $1`,
          [enc.rows[0].registration_id],
        );
        await client.query(
          `UPDATE "${schema}".health_queue
              SET status = 'SERVED', finished_at = now(), version = version + 1
            WHERE registration_id = $1`,
          [enc.rows[0].registration_id],
        );
      }
    });
    return { encounterId, status: 'COMPLETED' };
  }

  /** Rekap penagihan harian. */
  async rekapPenagihan(schema: string, facilityId: string, businessDate: string) {
    const rows = await this.tenantDb.query<{
      billable: string;
      total: string;
      reason: string | null;
      n: string;
    }>(
      schema,
      `SELECT
         (SELECT COUNT(*)::text FROM "${schema}".health_registration
           WHERE facility_id = $1 AND business_date = $2 AND is_billable = TRUE) AS billable,
         (SELECT COUNT(*)::text FROM "${schema}".health_registration
           WHERE facility_id = $1 AND business_date = $2) AS total,
         non_billable_reason AS reason,
         COUNT(*)::text AS n
       FROM "${schema}".health_registration
      WHERE facility_id = $1 AND business_date = $2 AND is_billable = FALSE
      GROUP BY non_billable_reason`,
      [facilityId, businessDate],
    );

    const total = await this.tenantDb.query<{ billable: string; total: string }>(
      schema,
      `SELECT
         COUNT(*) FILTER (WHERE is_billable = TRUE)::text AS billable,
         COUNT(*)::text AS total
         FROM "${schema}".health_registration
        WHERE facility_id = $1 AND business_date = $2`,
      [facilityId, businessDate],
    );

    return {
      businessDate,
      billable: Number(total[0]?.billable ?? '0'),
      total: Number(total[0]?.total ?? '0'),
      excludedByReason: Object.fromEntries(rows.map((r) => [r.reason ?? 'UNKNOWN', Number(r.n)])),
    };
  }
}
