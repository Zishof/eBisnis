/**
 * Laboratorium dan radiologi: pesanan, spesimen, hasil, dan nilai kritis.
 *
 * Aturannya ada di `health-lab.ts` sebagai fungsi murni. Berkas ini mengambil
 * data, memanggil aturan itu, lalu menuliskan hasilnya.
 *
 * Yang paling dijaga di sini bukan ketepatan angkanya — alat yang mengukur.
 * Yang dijaga adalah rantai penyampaiannya: siapa memasukkan, siapa
 * memverifikasi, kapan dilepas, siapa menerima nilai kritis, dan apakah ia
 * benar-benar mendengar angka yang sama.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  bolehAmandemenHasil,
  bolehLepasHasil,
  bolehTerimaKritis,
  bolehTerimaSpesimen,
  bolehVerifikasiOtomatis,
  lewatTenggat,
  nilaiHasil,
  periksaDelta,
  statusPenyampaianKritis,
  urutkanKerja,
  type PemeriksaanLab,
  type StatusSpesimen,
} from './health-lab';

@Injectable()
export class HealthLabService {
  private readonly logger = new Logger(HealthLabService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Katalog ---------------------------------------------------------------

  async katalog(schema: string, department?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT t.id::text AS id, t.code, t.name, t.short_name, t.department, t.category,
              t.result_type, t.unit, t.specimen_type, t.container_type,
              t.turnaround_minutes, t.requires_fasting, t.price::float8 AS price,
              count(r.id)::int AS range_count
         FROM "${schema}".lab_test_catalog t
         LEFT JOIN "${schema}".lab_reference_range r ON r.test_id = t.id AND r.is_active = TRUE
        WHERE t.deleted_at IS NULL AND t.is_active = TRUE
          AND ($1::text IS NULL OR t.department = $1)
        GROUP BY t.id
        ORDER BY t.department, t.name`,
      [department ?? null],
    );
  }

  // --- Pesanan ---------------------------------------------------------------

  /**
   * Memesan pemeriksaan.
   *
   * Spesimen dibuat sekaligus di sini, satu per jenis spesimen — bukan satu per
   * pemeriksaan. Tiga pemeriksaan dari satu tabung darah memang satu spesimen,
   * dan membuatnya tiga akan menuntut petugas menusuk pasien tiga kali.
   */
  async buatPesanan(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      encounterId?: string | null;
      department?: string;
      priority?: 'STAT' | 'URGENT' | 'ROUTINE';
      providerId?: string | null;
      clinicalInfo?: string | null;
      testIds: string[];
    },
    ctx: KonteksAkses,
  ) {
    if (!input.testIds?.length) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Pesanan tanpa pemeriksaan tidak dapat disimpan.',
      );
    }

    const fasilitas = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');

    const tests = await this.tenantDb.query<{
      id: string;
      code: string;
      name: string;
      department: string;
      specimen_type: string | null;
      container_type: string | null;
      min_volume_ml: string | null;
    }>(
      schema,
      `SELECT id::text AS id, code, name, department, specimen_type, container_type,
              min_volume_ml::text
         FROM "${schema}".lab_test_catalog
        WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL AND is_active = TRUE`,
      [input.testIds],
    );
    if (tests.length !== input.testIds.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Sebagian pemeriksaan yang dipesan tidak ada pada katalog atau sudah tidak aktif.',
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorPesanan(client, schema, input.facilityId, fasilitas[0].code);

      const pesanan = await client.query<{ id: string; order_number: string }>(
        `INSERT INTO "${schema}".lab_order
           (order_number, patient_id, encounter_id, facility_id, department, priority,
            ordered_by, ordered_by_provider_id, clinical_info, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'ORDERED')
         RETURNING id::text AS id, order_number`,
        [
          nomor,
          input.patientId,
          input.encounterId ?? null,
          input.facilityId,
          input.department ?? tests[0].department,
          input.priority ?? 'ROUTINE',
          ctx.actorUserId,
          input.providerId ?? null,
          input.clinicalInfo ?? null,
        ],
      );
      const orderId = pesanan.rows[0].id;

      for (const [i, t] of tests.entries()) {
        await client.query(
          `INSERT INTO "${schema}".lab_order_item (order_id, test_id, line_no, status)
           VALUES ($1,$2,$3,'ORDERED')`,
          [orderId, t.id, i + 1],
        );
      }

      // Satu spesimen per jenis, bukan per pemeriksaan.
      const jenis = [...new Set(tests.map((t) => t.specimen_type).filter(Boolean))] as string[];
      const spesimen: Array<{ id: string; specimenNumber: string; specimenType: string }> = [];
      for (const [i, j] of jenis.entries()) {
        const contoh = tests.find((t) => t.specimen_type === j);
        const baris = await client.query<{ id: string; specimen_number: string }>(
          `INSERT INTO "${schema}".lab_specimen
             (order_id, specimen_number, specimen_type, container_type, status)
           VALUES ($1,$2,$3,$4,'ORDERED')
           RETURNING id::text AS id, specimen_number`,
          [orderId, `${nomor}-S${i + 1}`, j, contoh?.container_type ?? null],
        );
        spesimen.push({
          id: baris.rows[0].id,
          specimenNumber: baris.rows[0].specimen_number,
          specimenType: j,
        });
      }

      await this.audit.recordAccess(schema, {
        patientId: input.patientId,
        facilityId: input.facilityId,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'lab_order',
        entityId: orderId,
      });

      return { id: orderId, orderNumber: pesanan.rows[0].order_number, specimens: spesimen };
    });
  }

  /**
   * Daftar kerja laboratorium.
   *
   * Diurutkan mesin, bukan diserahkan ke `ORDER BY`. Nilai kritis yang belum
   * diterima klinisi berada di atas STAT sekalipun — pemeriksaan STAT yang
   * belum dikerjakan masih menunggu; nilai kritis yang belum tersampaikan sudah
   * menjadi bahaya.
   */
  async daftarKerja(schema: string, facilityId: string, department?: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      order_number: string;
      priority: 'STAT' | 'URGENT' | 'ROUTINE';
      ordered_at: string;
      status: string;
      patient_name: string;
      department: string;
      item_count: number;
      resulted_count: number;
      has_critical: boolean | null;
      specimen_status: string | null;
    }>(
      schema,
      `SELECT o.id::text AS id, o.order_number, o.priority, o.ordered_at, o.status,
              o.department, p.full_name AS patient_name,
              count(i.id)::int AS item_count,
              count(r.id) FILTER (WHERE r.status <> 'PENDING')::int AS resulted_count,
              bool_or(r.is_critical AND c.acknowledged_at IS NULL) AS has_critical,
              min(s.status) AS specimen_status
         FROM "${schema}".lab_order o
         JOIN "${schema}".patient p ON p.id = o.patient_id
         LEFT JOIN "${schema}".lab_order_item i ON i.order_id = o.id
         LEFT JOIN "${schema}".lab_result r ON r.order_item_id = i.id
         LEFT JOIN "${schema}".lab_critical_notification c ON c.result_id = r.id
         LEFT JOIN "${schema}".lab_specimen s ON s.order_id = o.id
        WHERE o.facility_id = $1
          AND ($2::text IS NULL OR o.department = $2)
          AND o.status IN ('ORDERED','COLLECTED','RECEIVED','IN_PROCESS','PARTIAL')
        GROUP BY o.id, p.full_name
        LIMIT 300`,
      [facilityId, department ?? null],
    );

    const sekarang = new Date().toISOString();
    return urutkanKerja(
      rows.map((r) => ({ ...r, orderedAt: r.ordered_at, isCritical: Boolean(r.has_critical) })),
    ).map((r) => ({ ...r, overdue: lewatTenggat(r, sekarang) }));
  }

  // --- Spesimen --------------------------------------------------------------

  async ambilSpesimen(
    schema: string,
    specimenId: string,
    input: { volumeMl?: number | null; collectedAt?: string | null },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ order_id: string; status: string }>(
      schema,
      `UPDATE "${schema}".lab_specimen
          SET status = 'COLLECTED', collected_at = COALESCE($2::timestamptz, now()),
              collected_by = $3, volume_ml = COALESCE($4, volume_ml), version = version + 1
        WHERE id = $1 AND status = 'ORDERED'
        RETURNING order_id::text AS order_id, status`,
      [specimenId, input.collectedAt ?? null, ctx.actorUserId, input.volumeMl ?? null],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Spesimen tidak ditemukan atau sudah tidak berstatus dipesan.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".lab_order SET status = 'COLLECTED', updated_at = now(),
              version = version + 1
        WHERE id = $1 AND status = 'ORDERED'`,
      [rows[0].order_id],
    );

    return { id: specimenId, status: 'COLLECTED' };
  }

  /**
   * Menerima atau menolak spesimen di laboratorium.
   *
   * Penolakannya dijalankan aturan, bukan penilaian saat itu. Spesimen tanpa
   * label tidak pernah dapat diterima — sekalipun petugas yang mengantarnya
   * yakin betul itu milik siapa.
   */
  async terimaSpesimen(
    schema: string,
    specimenId: string,
    input: {
      labelled: boolean;
      labelMatchesRequest: boolean;
      volumeSufficient?: boolean;
      containerCorrect?: boolean;
      /** Sebab penolakan yang hanya dapat dilihat mata, misalnya hemolisis. */
      manualRejectReason?: string | null;
      manualRejectNote?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{
      order_id: string;
      status: string;
      collected_at: string | null;
      max_transport_minutes: number | null;
      patient_id: string;
      facility_id: string;
    }>(
      schema,
      `SELECT s.order_id::text AS order_id, s.status, s.collected_at::text AS collected_at,
              min(t.max_transport_minutes) AS max_transport_minutes,
              o.patient_id::text AS patient_id, o.facility_id::text AS facility_id
         FROM "${schema}".lab_specimen s
         JOIN "${schema}".lab_order o ON o.id = s.order_id
         LEFT JOIN "${schema}".lab_order_item i ON i.order_id = o.id
         LEFT JOIN "${schema}".lab_test_catalog t ON t.id = i.test_id
        WHERE s.id = $1
        GROUP BY s.order_id, s.status, s.collected_at, o.patient_id, o.facility_id`,
      [specimenId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Spesimen tidak ditemukan.');
    const s = rows[0];

    if (!['COLLECTED', 'ORDERED'].includes(s.status)) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Spesimen sudah berstatus ${s.status}.`,
      );
    }

    const now = new Date().toISOString();
    const putusan = input.manualRejectReason
      ? { accepted: false, reason: input.manualRejectReason, message: input.manualRejectNote ?? null }
      : bolehTerimaSpesimen({
          labelled: input.labelled,
          labelMatchesRequest: input.labelMatchesRequest,
          collectedAt: s.collected_at,
          receivedAt: now,
          maxTransportMinutes: s.max_transport_minutes,
          volumeSufficient: input.volumeSufficient,
          containerCorrect: input.containerCorrect,
        });

    if (!putusan.accepted) {
      await this.tenantDb.transaction(schema, async (client) => {
        await client.query(
          `UPDATE "${schema}".lab_specimen
              SET status = 'REJECTED', reject_reason = $2, reject_note = $3,
                  rejected_at = now(), rejected_by = $4, version = version + 1
            WHERE id = $1`,
          [specimenId, putusan.reason, putusan.message ?? null, ctx.actorUserId],
        );
        /*
         * Pesanannya ikut ditolak, dan itu disengaja. Spesimen yang ditolak
         * berarti tidak ada yang dapat diperiksa; membiarkan pesanannya menunggu
         * akan membuatnya duduk di daftar kerja selamanya tanpa ada yang tahu
         * bahwa pasiennya harus diambil ulang.
         */
        await client.query(
          `UPDATE "${schema}".lab_order
              SET status = 'REJECTED', updated_at = now(), version = version + 1
            WHERE id = $1`,
          [s.order_id],
        );
      });

      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        putusan.message ?? 'Spesimen ditolak.',
        { reason: putusan.reason },
      );
    }

    await this.tenantDb.transaction(schema, async (client) => {
      await client.query(
        `UPDATE "${schema}".lab_specimen
            SET status = 'RECEIVED', received_at = now(), received_by = $2, version = version + 1
          WHERE id = $1`,
        [specimenId, ctx.actorUserId],
      );
      await client.query(
        `UPDATE "${schema}".lab_order
            SET status = 'RECEIVED', updated_at = now(), version = version + 1
          WHERE id = $1 AND status IN ('ORDERED','COLLECTED')`,
        [s.order_id],
      );
    });

    return { id: specimenId, status: 'RECEIVED' };
  }

  // --- Hasil -----------------------------------------------------------------

  /**
   * Memasukkan hasil satu pemeriksaan.
   *
   * Penilaiannya dilakukan di sini, bukan di layar: nilai kritis yang hanya
   * ditandai peramban dapat dilewati siapa pun yang memanggil jalur ini
   * langsung. Nilai kritis yang terdeteksi langsung membuka catatan penyampaian
   * — bukan menunggu seseorang menekan tombol "sampaikan".
   */
  async masukkanHasil(
    schema: string,
    input: {
      orderItemId: string;
      valueNumeric?: number | null;
      valueText?: string | null;
      method?: string | null;
      instrument?: string | null;
      imageReference?: string | null;
      impression?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const konteks = await this.konteksHasil(schema, input.orderItemId);
    const pemeriksaan = konteks.pemeriksaan;

    const penilaian = nilaiHasil(pemeriksaan, konteks.pasien, input.valueNumeric ?? null);
    const sebelumnya = await this.hasilSebelumnya(schema, konteks.patientId, konteks.testId);
    const delta =
      input.valueNumeric == null
        ? { suspicious: false, changePercent: null }
        : periksaDelta(pemeriksaan, input.valueNumeric, sebelumnya);

    const otomatis = bolehVerifikasiOtomatis({ pemeriksaan, penilaian, delta });

    return this.tenantDb.transaction(schema, async (client) => {
      const hasil = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".lab_result
           (order_id, order_item_id, specimen_id, patient_id, test_id,
            value_numeric, value_text, unit, range_low, range_high, flag, is_critical,
            delta_percent, method, instrument, image_reference, impression,
            entered_by, entered_at, verified_by, verified_at, auto_verified, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,now(),
                 NULL, CASE WHEN $19 THEN now() ELSE NULL END, $19,
                 CASE WHEN $19 THEN 'VERIFIED' ELSE 'RESULTED' END)
         ON CONFLICT (order_item_id) DO UPDATE SET
           value_numeric = EXCLUDED.value_numeric,
           value_text = EXCLUDED.value_text,
           flag = EXCLUDED.flag,
           is_critical = EXCLUDED.is_critical,
           delta_percent = EXCLUDED.delta_percent,
           entered_by = EXCLUDED.entered_by,
           entered_at = now(),
           status = EXCLUDED.status,
           updated_at = now(),
           version = "${schema}".lab_result.version + 1
         WHERE "${schema}".lab_result.released_at IS NULL
         RETURNING id::text AS id`,
        [
          konteks.orderId,
          input.orderItemId,
          konteks.specimenId,
          konteks.patientId,
          konteks.testId,
          input.valueNumeric ?? null,
          input.valueText ?? null,
          penilaian.range?.unit ?? pemeriksaan.unit ?? null,
          penilaian.range?.low ?? null,
          penilaian.range?.high ?? null,
          penilaian.flag,
          penilaian.critical,
          delta.changePercent,
          input.method ?? null,
          input.instrument ?? null,
          input.imageReference ?? null,
          input.impression ?? null,
          ctx.actorUserId,
          otomatis.allowed,
        ],
      );

      if (!hasil.rows.length) {
        /*
         * `ON CONFLICT ... WHERE released_at IS NULL` tidak mengembalikan baris
         * bila hasilnya sudah dilepas. Itu bukan kegagalan diam-diam: hasil yang
         * sudah dilepas harus melalui amandemen, supaya yang salah tetap
         * terlihat beserta penggantinya.
         */
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Hasil ini sudah dilepas. Perbaikannya harus lewat amandemen, bukan penimpaan.',
        );
      }
      const resultId = hasil.rows[0].id;

      await client.query(
        `UPDATE "${schema}".lab_order_item SET status = $2, version = version + 1 WHERE id = $1`,
        [input.orderItemId, otomatis.allowed ? 'VERIFIED' : 'RESULTED'],
      );

      /*
       * Nilai kritis langsung membuka catatan penyampaian. Menunggu seseorang
       * menekan tombol "sampaikan" berarti nilai kritis yang terlupa tidak
       * meninggalkan jejak bahwa ia pernah ada.
       */
      if (penilaian.critical) {
        const sudah = await client.query(
          `SELECT 1 FROM "${schema}".lab_critical_notification WHERE result_id = $1`,
          [resultId],
        );
        if (!sudah.rows.length) {
          await client.query(
            `INSERT INTO "${schema}".lab_critical_notification (result_id, patient_id, critical_at)
             VALUES ($1,$2,now())`,
            [resultId, konteks.patientId],
          );
        }
        this.logger.warn(
          `Nilai kritis pada hasil ${resultId}: ${penilaian.flag}. Menunggu penerimaan klinisi.`,
        );
      }

      return {
        id: resultId,
        flag: penilaian.flag,
        critical: penilaian.critical,
        message: penilaian.message,
        delta,
        autoVerified: otomatis.allowed,
        autoVerifyBlockedBecause: otomatis.allowed ? null : otomatis.reason,
      };
    });
  }

  /**
   * Verifikasi hasil oleh analis kedua.
   *
   * Pemisahannya ditegakkan basis data pula lewat `lab_result_verify_not_self`;
   * diperiksa di sini supaya pesannya dapat dibaca manusia.
   */
  async verifikasi(schema: string, resultId: string, ctx: KonteksAkses) {
    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{
        entered_by: string | null;
        status: string;
        patient_id: string;
      }>(
        `SELECT entered_by::text AS entered_by, status, patient_id::text AS patient_id
           FROM "${schema}".lab_result WHERE id = $1 FOR UPDATE`,
        [resultId],
      );
      if (!rows.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hasil tidak ditemukan.');

      if (rows.rows[0].status !== 'RESULTED') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Verifikasi memerlukan hasil berstatus RESULTED, saat ini ${rows.rows[0].status}.`,
        );
      }
      if (rows.rows[0].entered_by && rows.rows[0].entered_by === ctx.actorUserId) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Verifikator tidak boleh sama dengan yang memasukkan hasil. Orang yang mengetik ' +
            'angkanya adalah orang yang paling sulit melihat kekeliruannya.',
        );
      }

      await client.query(
        `UPDATE "${schema}".lab_result
            SET status = 'VERIFIED', verified_by = $2, verified_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [resultId, ctx.actorUserId],
      );
      await client.query(
        `UPDATE "${schema}".lab_order_item i
            SET status = 'VERIFIED', version = i.version + 1
           FROM "${schema}".lab_result r
          WHERE r.id = $1 AND i.id = r.order_item_id`,
        [resultId],
      );

      return { id: resultId, status: 'VERIFIED' };
    });
  }

  /** Melepas hasil kepada klinisi. */
  async lepasHasil(schema: string, resultId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query<{
      status: string;
      entered_by: string | null;
      verified_by: string | null;
      auto_verified: boolean;
      specimen_status: string | null;
      order_id: string;
      patient_id: string;
      is_critical: boolean;
    }>(
      schema,
      `SELECT r.status, r.entered_by::text AS entered_by, r.verified_by::text AS verified_by,
              r.auto_verified, s.status AS specimen_status, r.order_id::text AS order_id,
              r.patient_id::text AS patient_id, r.is_critical
         FROM "${schema}".lab_result r
         LEFT JOIN "${schema}".lab_specimen s ON s.id = r.specimen_id
        WHERE r.id = $1`,
      [resultId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hasil tidak ditemukan.');
    const r = rows[0];

    const putusan = bolehLepasHasil({
      status: r.status,
      // Verifikasi otomatis tidak punya verifikator berupa orang, dan memang
      // tidak perlu: yang memasukkan hasilnya adalah alat.
      enteredBy: r.auto_verified ? null : r.entered_by,
      verifiedBy: r.auto_verified ? 'AUTO' : r.verified_by,
      specimenStatus: (r.specimen_status ?? 'COMPLETED') as StatusSpesimen,
    });
    if (!putusan.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, putusan.message ?? 'Hasil tidak dapat dilepas.');
    }

    await this.tenantDb.transaction(schema, async (client) => {
      await client.query(
        `UPDATE "${schema}".lab_result
            SET status = 'RELEASED', released_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1 AND released_at IS NULL`,
        [resultId],
      );
      await client.query(
        `UPDATE "${schema}".lab_order_item i
            SET status = 'RELEASED', version = i.version + 1
           FROM "${schema}".lab_result res
          WHERE res.id = $1 AND i.id = res.order_item_id`,
        [resultId],
      );
      await this.perbaruiStatusPesanan(client, schema, r.order_id);
    });

    await this.audit.recordAccess(schema, {
      patientId: r.patient_id,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'lab_result',
      entityId: resultId,
    });

    return { id: resultId, status: 'RELEASED', critical: r.is_critical };
  }

  /** Amandemen hasil yang sudah dilepas. */
  async amandemen(
    schema: string,
    resultId: string,
    input: { valueNumeric?: number | null; valueText?: string | null; reason: string },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{
      released_at: string | null;
      value_numeric: string | null;
      value_text: string | null;
      flag: string;
      patient_id: string;
      test_id: string;
    }>(
      schema,
      `SELECT released_at::text AS released_at, value_numeric::text, value_text, flag,
              patient_id::text AS patient_id, test_id::text AS test_id
         FROM "${schema}".lab_result WHERE id = $1`,
      [resultId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hasil tidak ditemukan.');

    const izin = bolehAmandemenHasil({
      released: Boolean(rows[0].released_at),
      reason: input.reason,
      amendedBy: ctx.actorUserId,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message ?? 'Amandemen ditolak.');
    }

    const konteks = await this.pemeriksaanDenganRentang(schema, rows[0].test_id);
    const pasien = await this.pasienUntukRentang(schema, rows[0].patient_id);
    const penilaian = nilaiHasil(konteks, pasien, input.valueNumeric ?? null);

    return this.tenantDb.transaction(schema, async (client) => {
      await client.query(
        `INSERT INTO "${schema}".lab_result_amendment
           (result_id, previous_value_numeric, previous_value_text, previous_flag,
            new_value_numeric, new_value_text, new_flag, reason, amended_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          resultId,
          rows[0].value_numeric,
          rows[0].value_text,
          rows[0].flag,
          input.valueNumeric ?? null,
          input.valueText ?? null,
          penilaian.flag,
          input.reason,
          ctx.actorUserId,
        ],
      );

      await client.query(
        `UPDATE "${schema}".lab_result
            SET value_numeric = $2, value_text = $3, flag = $4, is_critical = $5,
                status = 'AMENDED', updated_at = now(), version = version + 1
          WHERE id = $1`,
        [resultId, input.valueNumeric ?? null, input.valueText ?? null, penilaian.flag, penilaian.critical],
      );

      // Amandemen yang menghasilkan nilai kritis membuka rantai penyampaian
      // yang baru. Hasil yang semula wajar dan ternyata kritis adalah justru
      // keadaan yang paling mudah terlewat.
      if (penilaian.critical) {
        await client.query(
          `INSERT INTO "${schema}".lab_critical_notification (result_id, patient_id, critical_at)
           VALUES ($1,$2,now())`,
          [resultId, rows[0].patient_id],
        );
      }

      return { id: resultId, status: 'AMENDED', flag: penilaian.flag, critical: penilaian.critical };
    });
  }

  // --- Nilai kritis ----------------------------------------------------------

  /** Nilai kritis yang belum diterima klinisi, beserta status tenggatnya. */
  async kritisTertunda(schema: string, facilityId?: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      result_id: string;
      critical_at: string;
      acknowledged_at: string | null;
      notified_at: string | null;
      escalated_at: string | null;
      patient_name: string;
      test_name: string;
      value_numeric: string | null;
      value_text: string | null;
      unit: string | null;
      flag: string;
      order_number: string;
    }>(
      schema,
      `SELECT c.id::text AS id, c.result_id::text AS result_id,
              c.critical_at::text AS critical_at, c.acknowledged_at::text AS acknowledged_at,
              c.notified_at::text AS notified_at, c.escalated_at::text AS escalated_at,
              p.full_name AS patient_name, t.name AS test_name,
              r.value_numeric::text, r.value_text, r.unit, r.flag, o.order_number
         FROM "${schema}".lab_critical_notification c
         JOIN "${schema}".lab_result r ON r.id = c.result_id
         JOIN "${schema}".lab_order o ON o.id = r.order_id
         JOIN "${schema}".patient p ON p.id = c.patient_id
         JOIN "${schema}".lab_test_catalog t ON t.id = r.test_id
        WHERE c.acknowledged_at IS NULL
          AND ($1::uuid IS NULL OR o.facility_id = $1::uuid)
        ORDER BY c.critical_at
        LIMIT 200`,
      [facilityId ?? null],
    );

    const sekarang = new Date().toISOString();
    return rows.map((r) => ({
      ...r,
      delivery: statusPenyampaianKritis({
        criticalAt: r.critical_at,
        acknowledgedAt: r.acknowledged_at,
        now: sekarang,
      }),
    }));
  }

  /** Mencatat percobaan penyampaian nilai kritis. */
  async sampaikanKritis(
    schema: string,
    notificationId: string,
    input: { channel: string; notifiedTo: string },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".lab_critical_notification
          SET notified_at = now(), notified_by = $2, notify_channel = $3, notified_to = $4,
              version = version + 1
        WHERE id = $1 AND acknowledged_at IS NULL
        RETURNING id::text AS id`,
      [notificationId, ctx.actorUserId, input.channel, input.notifiedTo],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Catatan nilai kritis tidak ditemukan atau sudah diterima klinisi.',
      );
    }
    return { id: notificationId, notified: true };
  }

  /**
   * Penerimaan nilai kritis oleh klinisi, dengan bacaan ulang.
   *
   * Bacaan ulang dibandingkan dengan nilai hasilnya di peladen. Membandingkannya
   * di peramban berarti siapa pun yang memanggil jalur ini langsung dapat
   * mengetik apa saja — dan catatan penerimaan yang dapat diisi apa saja tidak
   * membuktikan bahwa angkanya benar-benar terdengar.
   */
  async terimaKritis(
    schema: string,
    notificationId: string,
    input: { readBackValue: string },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{
      value_numeric: string | null;
      value_text: string | null;
      acknowledged_at: string | null;
      patient_id: string;
    }>(
      schema,
      `SELECT r.value_numeric::text, r.value_text, c.acknowledged_at::text AS acknowledged_at,
              c.patient_id::text AS patient_id
         FROM "${schema}".lab_critical_notification c
         JOIN "${schema}".lab_result r ON r.id = c.result_id
        WHERE c.id = $1`,
      [notificationId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Catatan nilai kritis tidak ditemukan.');
    if (rows[0].acknowledged_at) {
      throw AppError.conflict(ErrorCodes.INVALID_STATE_TRANSITION, 'Nilai kritis ini sudah diterima.');
    }

    const nilai = rows[0].value_numeric ?? rows[0].value_text ?? '';
    const putusan = bolehTerimaKritis({
      acknowledgedBy: ctx.actorUserId,
      readBackValue: input.readBackValue,
      actualValue: nilai,
    });
    if (!putusan.accepted) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        putusan.message ?? 'Penerimaan nilai kritis ditolak.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".lab_critical_notification
          SET acknowledged_at = now(), acknowledged_by = $2, read_back_value = $3,
              version = version + 1
        WHERE id = $1`,
      [notificationId, ctx.actorUserId, input.readBackValue],
    );

    await this.audit.recordAccess(schema, {
      patientId: rows[0].patient_id,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'lab_critical_notification',
      entityId: notificationId,
    });

    return { id: notificationId, acknowledged: true };
  }

  // --- Pembacaan -------------------------------------------------------------

  /** Hasil pemeriksaan seorang pasien yang sudah dilepas. */
  async hasilPasien(schema: string, patientId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT r.id::text AS id, r.value_numeric::float8 AS value_numeric, r.value_text,
              r.unit, r.range_low::float8 AS range_low, r.range_high::float8 AS range_high,
              r.flag, r.is_critical, r.status, r.released_at, r.impression, r.image_reference,
              t.name AS test_name, t.code AS test_code, t.department,
              o.order_number, o.ordered_at,
              count(a.id)::int AS amendment_count
         FROM "${schema}".lab_result r
         JOIN "${schema}".lab_test_catalog t ON t.id = r.test_id
         JOIN "${schema}".lab_order o ON o.id = r.order_id
         LEFT JOIN "${schema}".lab_result_amendment a ON a.result_id = r.id
        WHERE r.patient_id = $1 AND r.status IN ('RELEASED','AMENDED')
        GROUP BY r.id, t.name, t.code, t.department, o.order_number, o.ordered_at
        ORDER BY o.ordered_at DESC, t.name
        LIMIT 300`,
      [patientId],
    );

    await this.audit.recordAccess(schema, {
      patientId,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'lab_result',
      entityId: null,
    });

    return rows;
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async konteksHasil(schema: string, orderItemId: string) {
    const rows = await this.tenantDb.query<{
      order_id: string;
      test_id: string;
      patient_id: string;
      specimen_id: string | null;
      specimen_status: string | null;
      item_status: string;
    }>(
      schema,
      `SELECT i.order_id::text AS order_id, i.test_id::text AS test_id,
              o.patient_id::text AS patient_id, s.id::text AS specimen_id,
              s.status AS specimen_status, i.status AS item_status
         FROM "${schema}".lab_order_item i
         JOIN "${schema}".lab_order o ON o.id = i.order_id
         LEFT JOIN "${schema}".lab_specimen s ON s.order_id = o.id AND s.status <> 'REJECTED'
        WHERE i.id = $1
        LIMIT 1`,
      [orderItemId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris pesanan tidak ditemukan.');

    if (rows[0].item_status === 'CANCELLED' || rows[0].item_status === 'REJECTED') {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Baris pesanan berstatus ${rows[0].item_status}; hasilnya tidak dapat dimasukkan.`,
      );
    }

    return {
      orderId: rows[0].order_id,
      testId: rows[0].test_id,
      patientId: rows[0].patient_id,
      specimenId: rows[0].specimen_id,
      pemeriksaan: await this.pemeriksaanDenganRentang(schema, rows[0].test_id),
      pasien: await this.pasienUntukRentang(schema, rows[0].patient_id),
    };
  }

  private async pemeriksaanDenganRentang(schema: string, testId: string): Promise<PemeriksaanLab> {
    const t = await this.tenantDb.query<{
      code: string;
      name: string;
      result_type: string;
      unit: string | null;
      allow_auto_verify: boolean;
      delta_check_percent: string | null;
    }>(
      schema,
      `SELECT code, name, result_type, unit, allow_auto_verify, delta_check_percent::text
         FROM "${schema}".lab_test_catalog WHERE id = $1 AND deleted_at IS NULL`,
      [testId],
    );
    if (!t.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pemeriksaan tidak ada pada katalog.');

    const r = await this.tenantDb.query<{
      min_age_years: string | null;
      max_age_years: string | null;
      sex: string | null;
      low_value: string | null;
      high_value: string | null;
      critical_low: string | null;
      critical_high: string | null;
      unit: string;
    }>(
      schema,
      `SELECT min_age_years::text, max_age_years::text, sex, low_value::text, high_value::text,
              critical_low::text, critical_high::text, unit
         FROM "${schema}".lab_reference_range WHERE test_id = $1 AND is_active = TRUE`,
      [testId],
    );

    const angka = (v: string | null) => (v === null ? null : Number(v));

    return {
      code: t[0].code,
      name: t[0].name,
      resultType: t[0].result_type as PemeriksaanLab['resultType'],
      unit: t[0].unit,
      allowAutoVerify: t[0].allow_auto_verify,
      deltaCheckPercent: angka(t[0].delta_check_percent),
      ranges: r.map((x) => ({
        minAge: angka(x.min_age_years),
        maxAge: angka(x.max_age_years),
        sex: x.sex as 'MALE' | 'FEMALE' | null,
        low: angka(x.low_value),
        high: angka(x.high_value),
        criticalLow: angka(x.critical_low),
        criticalHigh: angka(x.critical_high),
        unit: x.unit,
      })),
    };
  }

  private async pasienUntukRentang(schema: string, patientId: string) {
    const rows = await this.tenantDb.query<{ birth_date: string | null; gender: string | null }>(
      schema,
      `SELECT birth_date::text, gender FROM "${schema}".patient WHERE id = $1`,
      [patientId],
    );
    const lahir = rows[0]?.birth_date ? Date.parse(rows[0].birth_date) : NaN;
    return {
      ageYears: Number.isNaN(lahir) ? null : (Date.now() - lahir) / (365.25 * 24 * 3600 * 1000),
      sex: (rows[0]?.gender as 'MALE' | 'FEMALE' | null) ?? null,
    };
  }

  private async hasilSebelumnya(
    schema: string,
    patientId: string,
    testId: string,
  ): Promise<number | null> {
    const rows = await this.tenantDb.query<{ value_numeric: string | null }>(
      schema,
      `SELECT value_numeric::text FROM "${schema}".lab_result
        WHERE patient_id = $1 AND test_id = $2 AND value_numeric IS NOT NULL
          AND status IN ('VERIFIED','RELEASED','AMENDED')
        ORDER BY created_at DESC LIMIT 1`,
      [patientId, testId],
    );
    return rows[0]?.value_numeric == null ? null : Number(rows[0].value_numeric);
  }

  /** Status pesanan mengikuti barisnya, dihitung basis data. */
  private async perbaruiStatusPesanan(client: PoolClient, schema: string, orderId: string) {
    await client.query(
      `UPDATE "${schema}".lab_order o
          SET status = CASE
                WHEN s.belum = 0 THEN 'COMPLETED'
                WHEN s.selesai > 0 THEN 'PARTIAL'
                ELSE o.status
              END,
              updated_at = now(), version = o.version + 1
         FROM (
           SELECT count(*) FILTER (WHERE status NOT IN ('RELEASED','CANCELLED')) AS belum,
                  count(*) FILTER (WHERE status = 'RELEASED') AS selesai
             FROM "${schema}".lab_order_item WHERE order_id = $1
         ) s
        WHERE o.id = $1 AND o.status NOT IN ('CANCELLED','REJECTED')`,
      [orderId],
    );
  }

  private async nomorPesanan(
    client: PoolClient,
    schema: string,
    facilityId: string,
    facilityCode: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".lab_order
        WHERE facility_id = $1 AND ordered_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `LAB-${facilityCode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
