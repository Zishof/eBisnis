/**
 * Pemeliharaan biomedis, kalibrasi, dan keamanan siber alat.
 *
 * Aturannya ada di `health-device-maintenance.ts` sebagai fungsi murni.
 *
 * **Tidak ada satu pun jalan pada layanan ini yang mengubah status alat menjadi
 * DOWNTIME.** Bukan kelalaian: ia ditiadakan dengan sengaja. Penilaian risiko
 * yang dapat mematikan alat akan mematikan alat pada suatu malam ketika
 * seseorang salah mengisi kotak centang — dan yang tahu apakah alat itu sedang
 * menopang seseorang bukan layanan ini, melainkan orang yang berdiri di
 * sebelahnya.
 *
 * Yang dilakukan layanan ini adalah menyatakan temuannya, menamai akibatnya,
 * dan menuntut keputusan manusia yang tercatat, bertenggat, dan bertanda
 * tangan.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  FAKTOR_RISIKO,
  PENAHAN_PENGGANTI,
  bolehKembaliMelayani,
  keputusanWajib,
  langkahPenahanan,
  nilaiRisikoSiber,
  penerimaanMasihBerlaku,
  periksaPemeliharaan,
  periksaPenerimaanRisiko,
  urutkanPerhatian,
  wajibLaporKeselamatan,
  wajibTautInsiden,
  type HasilInspeksi,
  type JenisInsidenSiber,
  type JenisPekerjaan,
  type Keputusan,
  type KodeFaktor,
  type KodePenahan,
  type TingkatRisiko,
} from './health-device-maintenance';

const HARI = () => new Date().toISOString().slice(0, 10);

@Injectable()
export class HealthDeviceMaintenanceService {
  private readonly logger = new Logger(HealthDeviceMaintenanceService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Pekerjaan pemeliharaan ------------------------------------------------

  async bukaPekerjaan(
    schema: string,
    input: {
      facilityId: string;
      deviceId: string;
      workType: JenisPekerjaan;
      description: string;
      priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
      assignedTo?: string | null;
      affectedPatient?: boolean;
      safetyIncidentId?: string | null;
    },
    actorUserId: string,
  ) {
    /*
     * Tautan insiden diperiksa SEBELUM barisnya dibuat. Constraint basis data
     * menegakkan hal yang sama, tetapi pesannya tidak menjelaskan apa pun
     * kepada teknisi yang sedang berdiri di sebelah alat yang rusak.
     */
    const taut = wajibTautInsiden({
      jenis: input.workType,
      mengenaiPasien: input.affectedPatient === true,
      safetyIncidentId: input.safetyIncidentId ?? null,
    });
    if (!taut.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, taut.alasan);
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const alat = await client.query<{ code: string; status: string }>(
        `SELECT code, status FROM "${schema}".medical_device WHERE id = $1`,
        [input.deviceId],
      );
      if (alat.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alat tidak ditemukan.');
      }

      const nomor = await this.nomorPekerjaan(client, schema, input.facilityId);
      const baris = await client.query<{ id: string; work_order_number: string }>(
        `INSERT INTO "${schema}".device_work_order
           (facility_id, device_id, work_order_number, work_type, status, priority,
            description, requested_by, assigned_to, affected_patient, safety_incident_id,
            created_by)
         VALUES ($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9,$10,$7)
         RETURNING id, work_order_number`,
        [
          input.facilityId,
          input.deviceId,
          nomor,
          input.workType,
          input.priority ?? 'NORMAL',
          input.description,
          actorUserId,
          input.assignedTo ?? null,
          input.affectedPatient === true,
          input.safetyIncidentId ?? null,
        ],
      );

      return {
        id: baris.rows[0].id,
        workOrderNumber: baris.rows[0].work_order_number,
        deviceStatus: alat.rows[0].status,
        /*
         * Status alat TIDAK diubah oleh pembukaan pekerjaan.
         *
         * Membuka pekerjaan tidak berarti alatnya berhenti. Teknisi yang
         * mencatat "perlu diganti selangnya bulan depan" tidak bermaksud
         * menghentikan pelayanan hari ini, dan perangkat lunak yang
         * menghentikannya akan membuat teknisi berhenti mencatat.
         */
        note:
          'Status alat tidak berubah. Membuka pekerjaan tidak menghentikan alat; ' +
          'penghentian dicatat tersendiri oleh yang tahu ada pasien memakainya atau tidak.',
      };
    });
  }

  async tutupPekerjaan(
    schema: string,
    workOrderId: string,
    input: {
      completionNote: string;
      inspectionResult?: HasilInspeksi | null;
      measuredValues?: string | null;
      referenceStandard?: string | null;
      downtimeMinutes?: number | null;
      partsNote?: string | null;
      validUntil?: string | null;
    },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const wo = await client.query<{
        id: string;
        device_id: string;
        work_type: JenisPekerjaan;
        status: string;
      }>(
        `SELECT id, device_id, work_type, status FROM "${schema}".device_work_order
          WHERE id = $1 FOR UPDATE`,
        [workOrderId],
      );
      if (wo.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pekerjaan tidak ditemukan.');
      }
      const p = wo.rows[0];
      if (p.status === 'COMPLETED' || p.status === 'CANCELLED') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Pekerjaan sudah ${p.status === 'COMPLETED' ? 'selesai' : 'dibatalkan'}.`,
        );
      }

      const perluHasil = p.work_type === 'CALIBRATION' || p.work_type === 'SAFETY_INSPECTION';
      if (perluHasil && !input.inspectionResult) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Kalibrasi dan inspeksi keselamatan wajib menyebut hasilnya. Pekerjaan yang ' +
            'ditutup tanpa hasil adalah pekerjaan yang tidak dapat dipertanyakan kemudian.',
        );
      }
      if (
        p.work_type === 'CALIBRATION' &&
        input.inspectionResult !== 'FAIL' &&
        !input.referenceStandard?.trim()
      ) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Kalibrasi wajib menyebut standar acuannya. "Sudah dikalibrasi" tanpa menyebut ' +
            'terhadap apa hanya berarti seseorang menekan tombol.',
        );
      }

      await client.query(
        `UPDATE "${schema}".device_work_order
            SET status = 'COMPLETED', completed_at = now(), completed_by = $2,
                completion_note = $3, inspection_result = $4, measured_values = $5,
                reference_standard = $6, downtime_minutes = $7, parts_note = $8,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          workOrderId,
          actorUserId,
          input.completionNote,
          input.inspectionResult ?? null,
          input.measuredValues ?? null,
          input.referenceStandard ?? null,
          input.downtimeMinutes ?? null,
          input.partsNote ?? null,
        ],
      );

      const peringatan: string[] = [];

      // Kalibrasi menambah riwayatnya, bukan sekadar memperbarui satu kolom.
      if (p.work_type === 'CALIBRATION' && input.inspectionResult) {
        const berlaku = input.validUntil ?? this.tambahHari(HARI(), 365);
        await client.query(
          `INSERT INTO "${schema}".device_calibration_record
             (device_id, work_order_id, performed_on, valid_until, result,
              reference_standard, performed_by, created_by)
           VALUES ($1,$2,CURRENT_DATE,$3,$4,$5,$6,$6)`,
          [
            p.device_id,
            workOrderId,
            berlaku,
            input.inspectionResult,
            input.referenceStandard ?? null,
            actorUserId,
          ],
        );
        if (input.inspectionResult !== 'FAIL') {
          await client.query(
            `UPDATE "${schema}".medical_device
                SET calibrated_at = CURRENT_DATE, calibration_due_at = $2,
                    updated_at = now(), version = version + 1
              WHERE id = $1`,
            [p.device_id, berlaku],
          );
        } else {
          peringatan.push(
            'Kalibrasi GAGAL. Alat tetap boleh melayani — hasilnya ditandai, tidak dibuang. ' +
              'Alat yang kalibrasinya menyimpang mungkin masih benar; hasil yang dibuang pasti hilang.',
          );
        }
      }

      /*
       * UJI KESELAMATAN LISTRIK YANG GAGAL — satu-satunya penahan keras.
       *
       * Perhatikan bahwa yang ditandai adalah alatnya, bukan statusnya: bila
       * alat sedang ACTIVE dan dipakai pasien, ia tetap ACTIVE. Penanda inilah
       * yang menahannya KEMBALI ke pelayanan sesudah dikeluarkan.
       */
      if (p.work_type === 'SAFETY_INSPECTION') {
        const gagal = input.inspectionResult === 'FAIL';
        await client.query(
          `UPDATE "${schema}".medical_device
              SET safety_inspection_failed = $2, updated_at = now(), version = version + 1
            WHERE id = $1`,
          [p.device_id, gagal],
        );
        if (gagal) {
          peringatan.push(
            'UJI KESELAMATAN LISTRIK GAGAL. Alat tidak boleh dikembalikan ke pelayanan. Ini ' +
              'satu-satunya temuan pada modul ini yang benar-benar menahan alat, dan sebabnya ' +
              'berbeda dari yang lain: kalibrasi yang lewat berarti hasilnya mungkin menyimpang, ' +
              'sedangkan uji listrik yang gagal berarti alatnya mungkin menyetrum orang yang ' +
              'menyentuhnya.',
          );
        }
      }

      // Pemeliharaan yang selesai memajukan jadwal berikutnya.
      if (p.work_type === 'PREVENTIVE') {
        await client.query(
          `UPDATE "${schema}".medical_device
              SET last_maintenance_at = CURRENT_DATE,
                  next_maintenance_at = CASE
                    WHEN maintenance_interval_days IS NULL THEN next_maintenance_at
                    ELSE CURRENT_DATE + maintenance_interval_days
                  END,
                  updated_at = now(), version = version + 1
            WHERE id = $1`,
          [p.device_id],
        );
      }

      return { id: workOrderId, status: 'COMPLETED', warnings: peringatan };
    });
  }

  /**
   * Mengembalikan alat ke pelayanan.
   *
   * Sengaja dijadikan jalan tersendiri, bukan efek samping penutupan pekerjaan.
   * Yang menutup pekerjaan menyatakan pekerjaannya selesai; yang mengembalikan
   * alat menyatakan alatnya layak dipakai pasien. Dua pernyataan yang berbeda,
   * dan yang kedua sering dibuat orang yang berbeda pula.
   */
  async kembalikanMelayani(schema: string, deviceId: string, actorUserId: string) {
    return this.tenantDb.transaction(schema, async (client) => {
      const alat = await client.query<{ safety_inspection_failed: boolean; status: string }>(
        `SELECT safety_inspection_failed, status FROM "${schema}".medical_device
          WHERE id = $1 FOR UPDATE`,
        [deviceId],
      );
      if (alat.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alat tidak ditemukan.');
      }

      const terbuka = await client.query<{
        id: string;
        work_order_number: string;
        work_type: JenisPekerjaan;
        status: 'OPEN' | 'IN_PROGRESS';
      }>(
        `SELECT id, work_order_number, work_type, status FROM "${schema}".device_work_order
          WHERE device_id = $1 AND status IN ('OPEN','IN_PROGRESS')
          ORDER BY requested_at LIMIT 1`,
        [deviceId],
      );
      if ((terbuka.rowCount ?? 0) > 0) {
        const izin = bolehKembaliMelayani({
          status: terbuka.rows[0].status,
          jenis: terbuka.rows[0].work_type,
        });
        throw AppError.unprocessable(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `${izin.alasan} Pekerjaan ${terbuka.rows[0].work_order_number} masih terbuka.`,
        );
      }

      if (alat.rows[0].safety_inspection_failed) {
        const izin = bolehKembaliMelayani({
          status: 'COMPLETED',
          jenis: 'SAFETY_INSPECTION',
          hasilInspeksi: 'FAIL',
        });
        throw AppError.unprocessable(ErrorCodes.INVALID_STATE_TRANSITION, izin.alasan);
      }

      await client.query(
        `UPDATE "${schema}".medical_device
            SET status = 'ACTIVE', out_of_service_reason = NULL,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [deviceId],
      );
      this.logger.log(`Alat ${deviceId} kembali melayani oleh ${actorUserId}`);
      return { id: deviceId, status: 'ACTIVE' };
    });
  }

  async daftarPekerjaan(
    schema: string,
    filter: { facilityId: string; deviceId?: string; status?: string },
  ) {
    const syarat = ['w.facility_id = $1'];
    const nilai: unknown[] = [filter.facilityId];
    if (filter.deviceId) {
      nilai.push(filter.deviceId);
      syarat.push(`w.device_id = $${nilai.length}`);
    }
    if (filter.status) {
      nilai.push(filter.status);
      syarat.push(`w.status = $${nilai.length}`);
    }
    return this.tenantDb.query(
      schema,
      `SELECT w.id, w.work_order_number, w.work_type, w.status, w.priority,
              w.description, w.requested_at, w.completed_at, w.inspection_result,
              w.downtime_minutes, w.affected_patient,
              w.safety_incident_id IS NOT NULL AS linked_to_safety,
              d.code AS device_code, d.name AS device_name
         FROM "${schema}".device_work_order w
         JOIN "${schema}".medical_device d ON d.id = w.device_id
        WHERE ${syarat.join(' AND ')}
        ORDER BY w.requested_at DESC
        LIMIT 200`,
      nilai,
    );
  }

  /** Papan jadwal pemeliharaan. Menandai, tidak menghentikan. */
  async papanPemeliharaan(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{
      id: string;
      code: string;
      name: string;
      status: string;
      maintenance_interval_days: number | null;
      last_maintenance_at: string | null;
      calibration_due_at: string | null;
      safety_inspection_failed: boolean;
    }>(
      schema,
      /*
       * Kolom DATE dicor ke teks OLEH PostgreSQL.
       *
       * Driver pg mengembalikan DATE sebagai objek Date JavaScript pada tengah
       * malam waktu LOKAL. Mengubahnya menjadi teks di sisi JavaScript salah
       * dua kali: String(Date) menghasilkan "Fri Feb 12 2027" yang tidak dapat
       * dibandingkan, dan toISOString() menggeser tanggalnya sehari mundur pada
       * zona waktu Indonesia. Yang benar adalah tidak pernah membuatnya menjadi
       * objek Date sama sekali.
       */
      `SELECT id, code, name, status, maintenance_interval_days,
              last_maintenance_at::text AS last_maintenance_at,
              calibration_due_at::text AS calibration_due_at,
              safety_inspection_failed
         FROM "${schema}".medical_device
        WHERE facility_id = $1 AND status <> 'RETIRED'
        ORDER BY code`,
      [facilityId],
    );

    const hariIni = HARI();
    const isi = baris.map((d) => {
      const jadwal = d.maintenance_interval_days
        ? periksaPemeliharaan(
            {
              intervalHari: d.maintenance_interval_days,
              terakhirDikerjakan: d.last_maintenance_at,
            },
            hariIni,
          )
        : null;
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        status: d.status,
        maintenance: jadwal,
        calibrationOverdue: d.calibration_due_at ? d.calibration_due_at < hariIni : false,
        safetyInspectionFailed: d.safety_inspection_failed,
      };
    });

    return {
      items: isi,
      overdueCount: isi.filter((d) => d.maintenance?.terlambat).length,
      /*
       * Dinyatakan tegas pada keluarannya, bukan hanya pada dokumentasinya.
       * Layar yang menampilkan "12 alat terlambat" tanpa kalimat ini akan
       * mendorong seseorang mematikan kedua belasnya sekaligus.
       */
      note:
        'Keterlambatan pemeliharaan MENANDAI, tidak menghentikan alat. Alat yang ' +
        'dihentikan penjadwal berhenti pada saat yang dipilih kalender, bukan pada saat ' +
        'yang dipilih orang yang tahu ada pasien memakainya atau tidak.',
    };
  }

  // --- Penilaian risiko siber ------------------------------------------------

  async nilaiRisiko(
    schema: string,
    input: {
      facilityId: string;
      deviceId: string;
      faktor: Partial<Record<KodeFaktor, boolean>>;
      penahan: { kode: KodePenahan; buktiRef: string | null }[];
    },
    actorUserId: string,
  ) {
    const hasil = nilaiRisikoSiber({ faktor: input.faktor, penahan: input.penahan });
    const tuntutan = keputusanWajib(hasil.tingkat);
    const tenggat = tuntutan.tenggatHari ? this.tambahHari(HARI(), tuntutan.tenggatHari) : null;

    return this.tenantDb.transaction(schema, async (client) => {
      const alat = await client.query(
        `SELECT id FROM "${schema}".medical_device WHERE id = $1 AND facility_id = $2`,
        [input.deviceId, input.facilityId],
      );
      if (alat.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Alat tidak ditemukan pada fasilitas ini.');
      }

      const baris = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".device_risk_assessment
           (facility_id, device_id, assessed_by,
            os_end_of_life, vendor_support_ended, default_credentials, internet_reachable,
            removable_media, remote_control, patient_connected, stores_phi,
            inherent_score, mitigation_score, residual_score, risk_level, decision_due_on)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [
          input.facilityId,
          input.deviceId,
          actorUserId,
          input.faktor.OS_END_OF_LIFE === true,
          input.faktor.VENDOR_SUPPORT_ENDED === true,
          input.faktor.DEFAULT_CREDENTIALS === true,
          input.faktor.INTERNET_REACHABLE === true,
          input.faktor.REMOVABLE_MEDIA === true,
          input.faktor.REMOTE_CONTROL === true,
          input.faktor.PATIENT_CONNECTED === true,
          input.faktor.STORES_PHI === true,
          hasil.skorBawaan,
          hasil.pengurang,
          hasil.skorSisa,
          hasil.tingkat,
          tenggat,
        ],
      );

      for (const p of hasil.penahan) {
        const bukti = input.penahan.find((x) => x.kode === p.kode)?.buktiRef ?? '';
        await client.query(
          `INSERT INTO "${schema}".device_risk_control
             (assessment_id, control_code, mitigation_weight, evidence_ref)
           VALUES ($1,$2,$3,$4)`,
          [baris.rows[0].id, p.kode, p.pengurang, bukti],
        );
      }

      return {
        id: baris.rows[0].id,
        ...hasil,
        decisionDueOn: tenggat,
        decisionRequired: tuntutan.wajibKeputusan,
        decisionGuidance: tuntutan.keterangan,
        /*
         * DINYATAKAN TEGAS PADA SETIAP JAWABAN.
         *
         * Bukan basa-basi. Layar yang menampilkan "CRITICAL" berwarna merah
         * tanpa kalimat ini mengundang orang pertama yang melihatnya untuk
         * mencabut alatnya — dan orang pertama yang melihatnya jarang orang
         * yang berdiri di sebelah pasiennya.
         */
        deviceDisabled: false,
        note:
          'Penilaian ini TIDAK mengubah status alat dan tidak memutus alat dari pasien. ' +
          'Yang dituntut adalah keputusan manusia yang tercatat: terima dengan alasan ' +
          'bernama dan tanggal tinjau, kurangi dengan rencana bertanggal, atau pensiunkan ' +
          'dengan rencana pengganti.',
      };
    });
  }

  async putuskanRisiko(
    schema: string,
    assessmentId: string,
    input: {
      decision: Keputusan;
      reason: string;
      reviewDueOn?: string | null;
      planRef?: string | null;
    },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const a = await client.query<{
        id: string;
        assessed_by: string | null;
        decision: string | null;
        risk_level: TingkatRisiko;
      }>(
        `SELECT id, assessed_by, decision, risk_level FROM "${schema}".device_risk_assessment
          WHERE id = $1 FOR UPDATE`,
        [assessmentId],
      );
      if (a.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penilaian risiko tidak ditemukan.');
      }
      if (a.rows[0].decision) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Penilaian ini sudah berkeputusan. Perubahan pendirian dicatat sebagai penilaian ' +
            'baru, bukan sebagai penggantian yang lama — supaya yang membacanya setahun ' +
            'kemudian melihat bahwa pendiriannya memang berubah.',
        );
      }

      const sah = periksaPenerimaanRisiko({
        keputusan: input.decision,
        alasan: input.reason,
        tinjauUlangPada: input.reviewDueOn ?? null,
        rencanaRef: input.planRef ?? null,
        diputuskanOleh: actorUserId,
        dinilaiOleh: a.rows[0].assessed_by,
      });
      if (!sah.sah) {
        const status = sah.alasan.includes('tidak memutuskan penerimaannya sendiri') ? 403 : 422;
        if (status === 403) {
          throw AppError.forbidden(ErrorCodes.FORBIDDEN, sah.alasan);
        }
        throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, sah.alasan);
      }

      await client.query(
        `UPDATE "${schema}".device_risk_assessment
            SET decision = $2, decision_reason = $3, decision_by = $4, decision_at = now(),
                review_due_on = $5, plan_ref = $6, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          assessmentId,
          input.decision,
          input.reason,
          actorUserId,
          input.reviewDueOn ?? null,
          input.planRef ?? null,
        ],
      );

      return {
        id: assessmentId,
        decision: input.decision,
        reviewDueOn: input.reviewDueOn ?? null,
        deviceDisabled: false,
        note:
          input.decision === 'ACCEPT'
            ? `Risiko diterima sampai ${input.reviewDueOn}. Sesudah tanggal itu penerimaannya ` +
              'tidak lagi berlaku dan alat kembali ke daftar yang menunggu keputusan — bukan ' +
              'ke daftar yang harus dimatikan.'
            : 'Keputusan tercatat beserta rencananya.',
      };
    });
  }

  /** Papan alat yang menuntut perhatian. */
  async papanRisiko(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{
      id: string;
      device_id: string;
      device_code: string;
      device_name: string;
      risk_level: TingkatRisiko;
      residual_score: number;
      decision: string | null;
      decision_due_on: string | null;
      review_due_on: string | null;
      assessed_on: string;
    }>(
      schema,
      `SELECT DISTINCT ON (r.device_id)
              r.id, r.device_id, d.code AS device_code, d.name AS device_name,
              r.risk_level, r.residual_score, r.decision,
              r.decision_due_on::text AS decision_due_on,
              r.review_due_on::text AS review_due_on,
              r.assessed_on::text AS assessed_on
         FROM "${schema}".device_risk_assessment r
         JOIN "${schema}".medical_device d ON d.id = r.device_id
        WHERE r.facility_id = $1
        ORDER BY r.device_id, r.assessed_on DESC, r.created_at DESC`,
      [facilityId],
    );

    const hariIni = HARI();
    const isi = baris.map((r) => {
      const berlaku =
        r.decision === 'ACCEPT'
          ? penerimaanMasihBerlaku(r.review_due_on, hariIni)
          : { berlaku: r.decision !== null, keterangan: r.decision ? 'Berkeputusan.' : 'Belum berkeputusan.' };
      return {
        assessmentId: r.id,
        deviceId: r.device_id,
        deviceCode: r.device_code,
        deviceName: r.device_name,
        tingkat: r.risk_level,
        skorSisa: Number(r.residual_score),
        decision: r.decision,
        tenggatKeputusan: r.decision_due_on,
        adaKeputusanBerlaku: berlaku.berlaku,
        keterangan: berlaku.keterangan,
      };
    });

    return {
      items: urutkanPerhatian(isi, hariIni),
      note:
        'Yang tenggat keputusannya sudah lewat didahulukan atas yang skornya lebih tinggi. ' +
        'Daftar yang diurut skor saja akan menaruh alat yang sudah dua tahun tanpa keputusan ' +
        'di bawah alat yang baru dinilai kemarin.',
    };
  }

  /** Katalog faktor risiko dan penahannya, beserta alasan masing-masing. */
  katalogRisiko() {
    return {
      faktor: Object.entries(FAKTOR_RISIKO).map(([kode, f]) => ({ kode, ...f })),
      penahan: Object.entries(PENAHAN_PENGGANTI).map(([kode, p]) => ({ kode, ...p })),
      catatan:
        'Penahan pengganti mengurangi risiko; ia tidak pernah menghilangkannya. Risiko sisa ' +
        'tidak turun di bawah sepertiga risiko bawaannya — segmentasi yang sempurna pun tidak ' +
        'membuat alat ber-OS kedaluwarsa menjadi alat yang aman, ia membuatnya menjadi alat ' +
        'yang risikonya dapat ditanggung, dan kedua hal itu berbeda.',
    };
  }

  // --- Insiden keamanan siber -----------------------------------------------

  async laporkanInsidenSiber(
    schema: string,
    input: {
      facilityId: string;
      deviceId?: string | null;
      gatewayId?: string | null;
      incidentType: JenisInsidenSiber;
      severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      detectedAt: string;
      description: string;
      affectedPatientCare?: boolean;
      safetyIncidentId?: string | null;
      containmentNote?: string | null;
    },
    actorUserId: string,
  ) {
    const taut = wajibLaporKeselamatan({
      jenis: input.incidentType,
      mempengaruhiPerawatan: input.affectedPatientCare === true,
      safetyIncidentId: input.safetyIncidentId ?? null,
    });
    if (!taut.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, taut.alasan);
    }

    return this.tenantDb.transaction(schema, async (client) => {
      let terhubungPasien = false;
      if (input.deviceId) {
        const d = await client.query<{ patient_connected: boolean }>(
          `SELECT patient_connected FROM "${schema}".medical_device WHERE id = $1`,
          [input.deviceId],
        );
        terhubungPasien = d.rows[0]?.patient_connected === true;
      }

      const nomor = await this.nomorInsidenSiber(client, schema, input.facilityId);
      const baris = await client.query<{ id: string; incident_number: string }>(
        `INSERT INTO "${schema}".device_security_incident
           (facility_id, device_id, gateway_id, incident_number, incident_type, severity,
            detected_at, description, affected_patient_care, safety_incident_id,
            containment_note, reported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, incident_number`,
        [
          input.facilityId,
          input.deviceId ?? null,
          input.gatewayId ?? null,
          nomor,
          input.incidentType,
          input.severity,
          input.detectedAt,
          input.description,
          input.affectedPatientCare === true,
          input.safetyIncidentId ?? null,
          input.containmentNote ?? null,
          actorUserId,
        ],
      );

      const penahanan = langkahPenahanan({
        terhubungPasien,
        adaPenggantiTersedia: false,
      });

      return {
        id: baris.rows[0].id,
        incidentNumber: baris.rows[0].incident_number,
        containmentSteps: penahanan.langkah,
        /*
         * Alat TIDAK diisolasi oleh pencatatan insiden.
         *
         * Isolasi jaringan adalah tindakan fisik yang dilakukan orang, dan
         * pencatatannya menyusul. Perangkat lunak yang mengisolasi alat begitu
         * seseorang mengetik "dugaan malware" akan memutuskan monitor pasien
         * dari perawat yang sedang memandanginya.
         */
        deviceIsolated: false,
        note:
          'Pencatatan insiden TIDAK mengisolasi alat dan tidak memutus dayanya. Isolasi ' +
          'jaringan dilakukan orang, dan pencatatannya menyusul. Alat yang tersusupi tetapi ' +
          'masih menopang pasien lebih baik daripada alat yang mati.',
      };
    });
  }

  async catatIsolasi(
    schema: string,
    incidentId: string,
    input: { containmentNote: string },
    actorUserId: string,
  ) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".device_security_incident
          SET device_isolated = TRUE, isolated_at = now(),
              containment_note = $2, updated_at = now(), version = version + 1
        WHERE id = $1 AND device_isolated = FALSE
        RETURNING id`,
      [incidentId, input.containmentNote],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Insiden tidak ditemukan atau isolasinya sudah tercatat.',
      );
    }
    this.logger.log(`Isolasi alat tercatat pada insiden ${incidentId} oleh ${actorUserId}`);
    return {
      id: incidentId,
      deviceIsolated: true,
      note:
        'Yang dicatat adalah isolasi JARINGAN yang sudah dilakukan orang, bukan perintah ' +
        'kepada alat untuk memutuskan dirinya.',
    };
  }

  async daftarInsidenSiber(
    schema: string,
    filter: { facilityId: string; openOnly?: boolean },
  ) {
    const syarat = ['i.facility_id = $1'];
    if (filter.openOnly) syarat.push('i.resolved_at IS NULL');
    return this.tenantDb.query(
      schema,
      `SELECT i.id, i.incident_number, i.incident_type, i.severity, i.detected_at,
              i.affected_patient_care, i.safety_incident_id IS NOT NULL AS linked_to_safety,
              i.device_isolated, i.resolved_at, d.code AS device_code
         FROM "${schema}".device_security_incident i
         LEFT JOIN "${schema}".medical_device d ON d.id = i.device_id
        WHERE ${syarat.join(' AND ')}
        ORDER BY i.detected_at DESC
        LIMIT 200`,
      [filter.facilityId],
    );
  }

  // --- Riwayat kalibrasi -----------------------------------------------------

  async riwayatKalibrasi(schema: string, deviceId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, performed_on::text AS performed_on, valid_until::text AS valid_until,
              result, reference_standard, certificate_ref, performed_by_vendor
         FROM "${schema}".device_calibration_record
        WHERE device_id = $1
        ORDER BY performed_on DESC`,
      [deviceId],
    );
  }

  /**
   * Apakah alat terkalibrasi pada tanggal tertentu?
   *
   * Pertanyaan yang muncul ketika hasil laboratorium dipersengketakan, dan yang
   * tidak dapat dijawab kolom `calibrated_at` — kolom itu hanya tahu yang
   * TERAKHIR.
   */
  async terkalibrasiPada(schema: string, deviceId: string, tanggal: string) {
    const baris = await this.tenantDb.query<{
      performed_on: string;
      valid_until: string;
      result: string;
      reference_standard: string | null;
    }>(
      schema,
      `SELECT performed_on::text AS performed_on, valid_until::text AS valid_until,
              result, reference_standard
         FROM "${schema}".device_calibration_record
        WHERE device_id = $1 AND result <> 'FAIL'
          AND performed_on <= $2::date AND valid_until >= $2::date
        ORDER BY performed_on DESC LIMIT 1`,
      [deviceId, tanggal],
    );
    return {
      deviceId,
      date: tanggal,
      calibrated: baris.length > 0,
      record: baris[0] ?? null,
      note:
        baris.length > 0
          ? 'Alat terkalibrasi pada tanggal itu menurut riwayatnya.'
          : 'Tidak ada catatan kalibrasi yang menutupi tanggal itu. Ini bukan berarti hasilnya ' +
            'salah; ia berarti tidak ada yang dapat menyatakan hasilnya benar.',
    };
  }

  // --- Pembantu --------------------------------------------------------------

  private tambahHari(dari: string, hari: number): string {
    const t = new Date(`${dari}T00:00:00Z`);
    t.setUTCDate(t.getUTCDate() + hari);
    return t.toISOString().slice(0, 10);
  }

  private async nomorPekerjaan(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    return this.nomorBerkodeFasilitas(client, schema, facilityId, 'WO', 'device_work_order');
  }

  private async nomorInsidenSiber(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    return this.nomorBerkodeFasilitas(client, schema, facilityId, 'ICS', 'device_security_incident');
  }

  /*
   * Kode fasilitas disertakan — kelas kekeliruan yang sudah dua kali muncul
   * (H-9 nomor insiden, H-9L kode kumpulan contoh): pengenal yang dihitung per
   * lingkup sempit di bawah batasan unik yang lebih luas. Tanpa kode fasilitas,
   * dua rumah sakit yang membuka pekerjaan pada hari yang sama berebut nomor
   * yang sama, dan yang kedua gagal seluruhnya.
   */
  private async nomorBerkodeFasilitas(
    client: PoolClient,
    schema: string,
    facilityId: string,
    awalan: string,
    tabel: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}"."${tabel}"
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `${awalan}-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
