/**
 * Registri alat kesehatan, gateway, dan penerimaan hasil alat.
 *
 * Aturannya ada di `health-device.ts` sebagai fungsi murni.
 *
 * **Layanan ini adalah lapisan yang dapat menolak.** Alat tidak dapat menolak:
 * bila datanya rusak, ia tetap mengirim. Yang dapat menolak adalah lapisan di
 * antaranya — dan lapisan itu di sini.
 *
 * Tidak ada satu pun jalan yang menerima kredensial alat, dan tidak ada satu pun
 * yang menebak pasien.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  PROTOKOL_STATUS,
  bolehKirimPerintah,
  bolehNyalakanKendaliJauh,
  bolehPakaiProtokol,
  bolehSimpanKredensial,
  bolehTerimaPesanan,
  kaitkanPasien,
  periksaProvenance,
  periksaWaktu,
  type CaraPengaitan,
  type Protokol,
  type StatusAlat,
} from './health-device';

@Injectable()
export class HealthDeviceService {
  private readonly logger = new Logger(HealthDeviceService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Gateway ---------------------------------------------------------------

  async daftarkanGateway(
    schema: string,
    input: {
      facilityId: string;
      code: string;
      name: string;
      vendor?: string | null;
      networkSegment?: string | null;
      credentialSecretRef?: string | null;
      credentialRawValue?: string | null;
    },
    actorUserId: string,
  ) {
    /*
     * Nilai mentah ditolak lebih dahulu, sebelum apa pun tersimpan. Kredensial
     * yang sempat masuk basis data sudah bocor sekalipun barisnya dihapus
     * kemudian — jejak audit dan cadangan menyimpannya pula.
     */
    if (input.credentialSecretRef || input.credentialRawValue) {
      const izin = bolehSimpanKredensial({
        secretRef: input.credentialSecretRef ?? null,
        rawValue: input.credentialRawValue ?? null,
      });
      if (!izin.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          izin.message ?? 'Kredensial tidak dapat disimpan.',
        );
      }
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".device_gateway
         (facility_id, code, name, vendor, network_segment, credential_secret_ref, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.code,
        input.name,
        input.vendor ?? null,
        input.networkSegment ?? null,
        input.credentialSecretRef ?? null,
        actorUserId,
      ],
    );

    return {
      id: rows[0].id,
      code: input.code,
      note:
        'Kredensial disimpan sebagai rujukan brankas, bukan sebagai nilai. Anda dapat ' +
        'menggantinya; Anda tidak dapat membacanya kembali.',
    };
  }

  async daftarGateway(schema: string, facilityId: string) {
    /*
     * Rujukan brankas TIDAK ikut dikembalikan. Yang mengelolanya tidak
     * membacanya, dan rujukan yang tampil di layar akan tersalin ke tiket
     * dukungan.
     */
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, code, name, vendor, network_segment, status,
              credential_secret_ref IS NOT NULL AS has_credential,
              last_seen_at::text AS last_seen_at,
              (SELECT count(*) FROM "${schema}".medical_device d WHERE d.gateway_id = g.id)::int
                AS device_count
         FROM "${schema}".device_gateway g
        WHERE g.facility_id = $1
        ORDER BY g.code
        LIMIT 200`,
      [facilityId],
    );
  }

  // --- Alat ------------------------------------------------------------------

  async daftarkanAlat(
    schema: string,
    input: {
      facilityId: string;
      gatewayId?: string | null;
      serviceUnitId?: string | null;
      code: string;
      name: string;
      deviceCategory: string;
      manufacturer?: string | null;
      model?: string | null;
      serialNumber?: string | null;
      softwareVersion?: string | null;
      sourceProtocol: Protokol;
      calibratedAt?: string | null;
      calibrationDueAt?: string | null;
    },
    actorUserId: string,
  ) {
    const protokol = bolehPakaiProtokol(input.sourceProtocol);
    if (!protokol.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        protokol.message ?? 'Protokol belum dapat dipakai.',
      );
    }

    if (input.sourceProtocol !== 'MANUAL_ENTRY' && !input.gatewayId) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Alat wajib menunjuk gateway-nya. Alat berbicara kepada gateway; gateway berbicara ' +
          'kepada integration engine. Tidak ada jalan langsung dari alat ke basis data.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".medical_device
         (facility_id, gateway_id, service_unit_id, code, name, device_category,
          manufacturer, model, serial_number, software_version, source_protocol,
          calibrated_at, calibration_due_at, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'REGISTERED',$14)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.gatewayId ?? null,
        input.serviceUnitId ?? null,
        input.code,
        input.name,
        input.deviceCategory,
        input.manufacturer ?? null,
        input.model ?? null,
        input.serialNumber ?? null,
        input.softwareVersion ?? null,
        input.sourceProtocol,
        input.calibratedAt ?? null,
        input.calibrationDueAt ?? null,
        actorUserId,
      ],
    );

    return {
      id: rows[0].id,
      code: input.code,
      status: 'REGISTERED',
      remoteControlEnabled: false,
      note:
        'Alat terdaftar dengan kendali jarak jauh MATI. Bawaannya memang mati, untuk seluruh ' +
        'alat, tanpa kecuali.',
    };
  }

  async ubahStatus(schema: string, deviceId: string, status: StatusAlat, reason?: string | null) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".medical_device
          SET status = $2, updated_at = now(), version = version + 1
        WHERE id = $1
        RETURNING id::text AS id`,
      [deviceId, status],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alat tidak ditemukan.');

    if (status === 'DOWNTIME') {
      this.logger.warn(`Alat ${deviceId} masuk DOWNTIME: ${reason ?? 'tanpa keterangan'}.`);
    }
    return { id: deviceId, status };
  }

  /**
   * Menyalakan kendali jarak jauh.
   *
   * Menuntut keenam syaratnya sekaligus. Basis data menegakkannya pula — layanan
   * ini hanya memberi pesan yang dapat dikerjakan.
   */
  async nyalakanKendaliJauh(
    schema: string,
    deviceId: string,
    input: {
      writtenApprovalRef: string;
      riskReviewRef: string;
      allowedCommands: string[];
      minValue?: number | null;
      maxValue: number;
      commandLogging: boolean;
      emergencyStop: boolean;
    },
    actorUserId: string,
  ) {
    const alat = await this.ambilAlat(schema, deviceId);

    const izin = bolehNyalakanKendaliJauh({
      deviceCategory: alat.deviceCategory,
      syarat: {
        hasWrittenApproval: Boolean(input.writtenApprovalRef?.trim()),
        hasClinicalRiskReview: Boolean(input.riskReviewRef?.trim()),
        allowedCommands: input.allowedCommands ?? [],
        hasValueLimits: input.maxValue != null,
        hasCommandLogging: input.commandLogging === true,
        hasEmergencyStop: input.emergencyStop === true,
      },
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message, {
        missing: izin.missing,
      });
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".medical_device
          SET remote_control_enabled = TRUE,
              remote_written_approval_ref = $2, remote_risk_review_ref = $3,
              remote_allowed_commands = $4::varchar[],
              remote_min_value = $5, remote_max_value = $6,
              remote_command_logging = TRUE, remote_emergency_stop = TRUE,
              remote_enabled_by = $7, remote_enabled_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [
        deviceId,
        input.writtenApprovalRef,
        input.riskReviewRef,
        input.allowedCommands,
        input.minValue ?? null,
        input.maxValue,
        actorUserId,
      ],
    );

    this.logger.warn(
      `Kendali jarak jauh DINYALAKAN pada ${alat.code} (${alat.deviceCategory}); ` +
        `perintah yang diizinkan: ${input.allowedCommands.join(', ')}.`,
    );
    return { id: deviceId, remoteControlEnabled: true, allowedCommands: input.allowedCommands };
  }

  async matikanKendaliJauh(schema: string, deviceId: string) {
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".medical_device
          SET remote_control_enabled = FALSE, updated_at = now(), version = version + 1
        WHERE id = $1`,
      [deviceId],
    );
    return { id: deviceId, remoteControlEnabled: false };
  }

  /**
   * Mengirim perintah kepada alat.
   *
   * Setiap perintah dicatat, **termasuk yang ditolak** — perintah yang ditolak
   * justru yang paling berharga: ia menunjukkan ada yang mencoba.
   */
  async kirimPerintah(
    schema: string,
    deviceId: string,
    input: { command: string; value?: number | null },
    actorUserId: string,
  ) {
    const alat = await this.ambilAlat(schema, deviceId);

    const izin = bolehKirimPerintah({
      remoteControlEnabled: alat.remoteControlEnabled,
      command: input.command,
      allowedCommands: alat.allowedCommands,
      value: input.value ?? null,
      minValue: alat.minValue,
      maxValue: alat.maxValue,
    });

    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".device_command_log
         (device_id, command, command_value, accepted, rejection_reason, issued_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        deviceId,
        input.command,
        input.value ?? null,
        izin.allowed,
        izin.allowed ? null : izin.message,
        actorUserId,
      ],
    );

    if (!izin.allowed) {
      this.logger.warn(
        `Perintah "${input.command}" kepada ${alat.code} DITOLAK: ${izin.message}`,
      );
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.message);
    }

    return { deviceId, command: input.command, accepted: true, note: izin.message };
  }

  // --- Penerimaan hasil ------------------------------------------------------

  /**
   * Menerima satu hasil dari gateway.
   *
   * Sepuluh langkah alurnya, dan yang paling sering digoda untuk dilewati adalah
   * **telaah manusia** — karena itu setiap hasil masuk dengan
   * `review_status = PENDING_REVIEW` atau `PENDING_LINK`, tidak pernah langsung
   * `REVIEWED`.
   */
  async terimaHasil(
    schema: string,
    input: {
      facilityId: string;
      deviceId: string;
      rawMessage?: string | null;
      rawMessageHash?: string | null;
      observationCode?: string | null;
      observationValue?: string | null;
      observationUnit?: string | null;
      capturedAt: string;
      orderId?: string | null;
      scannedPatientId?: string | null;
      operatorId?: string | null;
    },
  ) {
    const alat = await this.ambilAlat(schema, input.deviceId);
    const hariIni = new Date().toISOString().slice(0, 10);

    const kelayakan = bolehTerimaPesanan({
      status: alat.status,
      calibrationDueAt: alat.calibrationDueAt,
      today: hariIni,
    });
    if (!kelayakan.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, kelayakan.message);
    }

    const sidikJari =
      input.rawMessageHash ??
      (input.rawMessage ? `sha256:${createHash('sha256').update(input.rawMessage).digest('hex')}` : null);

    const diterima = new Date().toISOString();
    const waktu = periksaWaktu({ capturedAt: input.capturedAt, receivedAt: diterima });

    const provenance = periksaProvenance({
      deviceId: input.deviceId,
      gatewayId: alat.gatewayId,
      sourceProtocol: alat.sourceProtocol,
      rawMessageHash: sidikJari,
      capturedAt: input.capturedAt,
      receivedAt: diterima,
    });
    if (!provenance.complete) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, provenance.message, {
        missing: provenance.missing,
      });
    }

    /*
     * Pengaitan pasien. Yang tanpa identitas TIDAK ditebak — ia masuk antrean
     * PENDING_LINK.
     */
    let patientId: string | null = null;
    let encounterId: string | null = null;
    if (input.orderId) {
      const pesanan = await this.tenantDb.query<{ patient_id: string; encounter_id: string | null }>(
        schema,
        `SELECT patient_id::text AS patient_id, encounter_id::text AS encounter_id
           FROM "${schema}".lab_order WHERE id = $1`,
        [input.orderId],
      );
      if (!pesanan.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesanan tidak ditemukan.');
      }
      patientId = pesanan[0].patient_id;
      encounterId = pesanan[0].encounter_id;
    }

    const pengaitan = kaitkanPasien({
      orderId: input.orderId ?? null,
      scannedPatientId: input.scannedPatientId ?? null,
    });
    if (pengaitan.method === 'WRISTBAND_SCAN') patientId = pengaitan.patientId ?? null;

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".device_observation
         (facility_id, device_id, gateway_id, patient_id, encounter_id, order_id,
          link_method, linked_at, observation_code, observation_value, observation_unit,
          captured_at, received_at, clock_drift_minutes, source_protocol, raw_message_hash,
          operator_id, validation_status, review_status, calibration_warning, provenance_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,
               CASE WHEN $7::varchar IS NULL THEN NULL ELSE now() END,
               $8,$9,$10,$11,$12,$13,$14,$15,$16,'VALID',$17,$18,$19)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.deviceId,
        alat.gatewayId,
        patientId,
        encounterId,
        input.orderId ?? null,
        pengaitan.method ?? null,
        input.observationCode ?? null,
        input.observationValue ?? null,
        input.observationUnit ?? null,
        input.capturedAt,
        diterima,
        waktu.driftMinutes,
        alat.sourceProtocol,
        sidikJari,
        input.operatorId ?? null,
        patientId ? 'PENDING_REVIEW' : 'PENDING_LINK',
        Boolean(kelayakan.warning),
        [waktu.drifted ? waktu.message : null, kelayakan.warning ?? null]
          .filter(Boolean)
          .join(' ') || null,
      ],
    );

    return {
      id: rows[0].id,
      linked: pengaitan.linked,
      linkMethod: pengaitan.method ?? null,
      reviewStatus: patientId ? 'PENDING_REVIEW' : 'PENDING_LINK',
      clockDriftMinutes: waktu.driftMinutes,
      clockDrifted: waktu.drifted,
      calibrationWarning: Boolean(kelayakan.warning),
      message: pengaitan.message,
      warnings: [waktu.drifted ? waktu.message : null, kelayakan.warning ?? null].filter(Boolean),
    };
  }

  /** Mengaitkan hasil yang tiba tanpa identitas, oleh manusia yang namanya tercatat. */
  async kaitkanManual(
    schema: string,
    observationId: string,
    input: { patientId: string; encounterId?: string | null },
    actorUserId: string,
  ) {
    const pengaitan = kaitkanPasien({
      manualPatientId: input.patientId,
      manualLinkedBy: actorUserId,
    });
    if (!pengaitan.linked) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, pengaitan.message);
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".device_observation
          SET patient_id = $2, encounter_id = $3, link_method = 'MANUAL',
              linked_by = $4, linked_at = now(), review_status = 'PENDING_REVIEW',
              version = version + 1
        WHERE id = $1 AND patient_id IS NULL
        RETURNING id::text AS id`,
      [observationId, input.patientId, input.encounterId ?? null, actorUserId],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Hasil tidak ditemukan atau sudah terkait pasien. Pengaitan yang sudah ada tidak ' +
          'ditimpa — bila ia keliru, itu peristiwa tersendiri yang menuntut jejaknya sendiri.',
      );
    }

    return { id: observationId, linked: true, method: 'MANUAL' as CaraPengaitan };
  }

  async telaahHasil(
    schema: string,
    observationId: string,
    input: { accept: boolean; note?: string | null },
    actorUserId: string,
  ) {
    const rows = await this.tenantDb.query<{ linked_by: string | null }>(
      schema,
      `SELECT linked_by::text AS linked_by FROM "${schema}".device_observation WHERE id = $1`,
      [observationId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hasil tidak ditemukan.');

    /*
     * Yang mengaitkan tidak menelaahnya sendiri. Pengaitan adalah tempat
     * kekeliruan yang paling sulit ditemukan sesudahnya: hasilnya benar secara
     * analitis, dilaporkan dengan percaya diri, dan tertempel pada orang yang
     * keliru.
     */
    if (rows[0].linked_by && rows[0].linked_by === actorUserId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Yang mengaitkan hasil ini kepada pasien tidak menelaahnya sendiri. Telaah oleh yang ' +
          'mengaitkannya hanya membaca ulang keyakinannya sendiri.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".device_observation
          SET review_status = $2, reviewed_by = $3, reviewed_at = now(),
              provenance_note = COALESCE(provenance_note, '') || COALESCE($4, ''),
              version = version + 1
        WHERE id = $1`,
      [
        observationId,
        input.accept ? 'REVIEWED' : 'REJECTED',
        actorUserId,
        input.note ? ` [telaah] ${input.note}` : null,
      ],
    );

    return { id: observationId, reviewStatus: input.accept ? 'REVIEWED' : 'REJECTED' };
  }

  // --- Pembacaan -------------------------------------------------------------

  async daftarAlat(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, code, name, device_category, manufacturer, model,
              source_protocol, status, software_version,
              software_version_changed_at::text AS software_version_changed_at,
              calibration_due_at::text AS calibration_due_at,
              (calibration_due_at IS NOT NULL AND calibration_due_at < CURRENT_DATE)
                AS calibration_overdue,
              remote_control_enabled, remote_allowed_commands
         FROM "${schema}".medical_device
        WHERE facility_id = $1
        ORDER BY status, code
        LIMIT 300`,
      [facilityId],
    );
  }

  /** Antrean hasil yang menunggu manusia mengaitkannya. */
  async antreanPengaitan(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT o.id::text AS id, o.observation_code, o.observation_value, o.observation_unit,
              o.captured_at::text AS captured_at, o.received_at::text AS received_at,
              o.clock_drift_minutes, o.calibration_warning, o.provenance_note,
              d.code AS device_code, d.name AS device_name
         FROM "${schema}".device_observation o
         LEFT JOIN "${schema}".medical_device d ON d.id = o.device_id
        WHERE o.facility_id = $1 AND o.review_status = 'PENDING_LINK'
        ORDER BY o.received_at
        LIMIT 300`,
      [facilityId],
    );
  }

  async jejakPerintah(schema: string, deviceId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, command, command_value::float8 AS command_value,
              accepted, rejection_reason, issued_at::text AS issued_at
         FROM "${schema}".device_command_log
        WHERE device_id = $1
        ORDER BY issued_at DESC
        LIMIT 300`,
      [deviceId],
    );
  }

  /**
   * Katalog protokol beserta status dan penghalangnya.
   *
   * Diambil dari aturan murni supaya tidak ada daftar kedua. Daftar kedua akan
   * berselisih dengan yang pertama, dan yang berselisih akan diselesaikan
   * dengan memilih yang lebih longgar.
   */
  daftarProtokol() {
    return Object.entries(PROTOKOL_STATUS).map(([code, s]) => ({
      code,
      usable: s.usable,
      blockedBy: s.blockedBy ?? null,
    }));
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilAlat(schema: string, deviceId: string) {
    const rows = await this.tenantDb.query<{
      code: string;
      device_category: string;
      status: StatusAlat;
      gateway_id: string | null;
      source_protocol: Protokol;
      calibration_due_at: string | null;
      remote_control_enabled: boolean;
      remote_allowed_commands: string[];
      remote_min_value: string | null;
      remote_max_value: string | null;
    }>(
      schema,
      `SELECT code, device_category, status, gateway_id::text AS gateway_id, source_protocol,
              calibration_due_at::text AS calibration_due_at,
              remote_control_enabled, remote_allowed_commands,
              remote_min_value::text, remote_max_value::text
         FROM "${schema}".medical_device WHERE id = $1`,
      [deviceId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alat tidak ditemukan.');
    const r = rows[0];
    return {
      code: r.code,
      deviceCategory: r.device_category,
      status: r.status,
      gatewayId: r.gateway_id,
      sourceProtocol: r.source_protocol,
      calibrationDueAt: r.calibration_due_at,
      remoteControlEnabled: r.remote_control_enabled,
      allowedCommands: r.remote_allowed_commands ?? [],
      minValue: r.remote_min_value === null ? null : Number(r.remote_min_value),
      maxValue: r.remote_max_value === null ? null : Number(r.remote_max_value),
    };
  }
}
