/**
 * Portal pasien dan website fasilitas.
 *
 * Aturannya ada di `health-portal.ts` sebagai fungsi murni.
 *
 * ## Satu hal yang harus diperhatikan pada setiap jalan portal
 *
 * **Tidak satu pun metode portal di bawah menerima `patientId` sebagai
 * parameter.** Yang diterimanya adalah `platformUserId` — yang datang dari
 * token — dan pasien mana yang dibaca ditentukan di dalam, dengan membaca
 * `patient_portal_account` dan `patient_proxy`.
 *
 * Metode yang menerima `patientId` akan bekerja sempurna pada pengujian, sebab
 * yang mengujinya mengirim id-nya sendiri. Ia membocorkan seluruh rekam medis
 * rumah sakit pada hari pertama seseorang mengganti satu angka pada bilah
 * alamat.
 *
 * `subjectPatientId` yang muncul pada beberapa metode adalah **pilihan di
 * antara yang sudah dimiliki tokennya**, bukan jawabannya: ia dicocokkan
 * dengan daftar perwalian sebelum dipakai, dan tidak pernah dipakai apa adanya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehBatalkanJanji,
  bolehBuatJanji,
  bolehTampilKonten,
  bolehTautkanAkun,
  periksaKontenPublik,
  putuskanAkses,
  ringkasAntrean,
  saringHasil,
  type IdentitasPortal,
  type JenisData,
  type JenisKonten,
  type StatusJanji,
  type TingkatAksesWali,
} from './health-portal';

/** Berapa hari ke depan janji temu boleh dibuat lewat portal. */
const BATAS_HARI_JANJI = 90;

@Injectable()
export class HealthPortalService {
  private readonly logger = new Logger(HealthPortalService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Identitas -------------------------------------------------------------

  /**
   * Menyusun identitas portal dari `platformUserId` yang berasal dari token.
   *
   * Inilah satu-satunya tempat `selfPatientId` ditentukan, dan ia ditentukan
   * dari basis data — bukan dari apa pun yang dikirim pemanggilnya.
   */
  private async identitas(schema: string, platformUserId: string): Promise<IdentitasPortal> {
    const akun = await this.tenantDb.query<{ id: string; patient_id: string; status: string }>(
      schema,
      `SELECT id, patient_id, status FROM "${schema}".patient_portal_account
        WHERE platform_user_id = $1 AND status <> 'CLOSED'`,
      [platformUserId],
    );
    if (akun.length === 0) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun ini tidak tertaut satu pun pasien. Portal pasien hanya dapat dibuka akun yang ' +
          'sudah diverifikasi petugas tatap muka.',
      );
    }
    if (akun[0].status !== 'ACTIVE') {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        `Akun portal berstatus ${akun[0].status}. Hubungi petugas pendaftaran.`,
      );
    }

    const wali = await this.tenantDb.query<{ patient_id: string; access_level: TingkatAksesWali }>(
      schema,
      `SELECT patient_id, access_level FROM "${schema}".patient_proxy
        WHERE proxy_patient_id = $1
          AND revoked_at IS NULL
          AND valid_from <= CURRENT_DATE
          AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)`,
      [akun[0].patient_id],
    );

    return {
      selfPatientId: akun[0].patient_id,
      proxies: wali.map((w) => ({ patientId: w.patient_id, accessLevel: w.access_level })),
    };
  }

  private async akunId(schema: string, platformUserId: string): Promise<string> {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT id FROM "${schema}".patient_portal_account
        WHERE platform_user_id = $1 AND status <> 'CLOSED'`,
      [platformUserId],
    );
    return baris[0]?.id;
  }

  /**
   * Memutuskan akses lalu mencatatnya — termasuk ketika ditolak.
   *
   * Penolakan yang tidak dicatat tidak dapat dihitung, dan penolakan beruntun
   * dari satu akun adalah tanda seseorang sedang mencoba nomor pasien lain.
   */
  private async akses(
    schema: string,
    platformUserId: string,
    diminta: string | null,
    jenis: JenisData,
    ipHash?: string | null,
  ): Promise<{ patientId: string; sebagai: 'SELF' | 'PROXY' }> {
    const id = await this.identitas(schema, platformUserId);
    const keputusan = putuskanAkses(id, diminta, jenis);
    const akun = await this.akunId(schema, platformUserId);

    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".patient_portal_access_log
         (portal_account_id, subject_patient_id, accessed_as, data_kind, outcome,
          deny_reason, ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        akun,
        keputusan.patientId ?? id.selfPatientId,
        keputusan.sebagai ?? 'SELF',
        jenis,
        keputusan.boleh ? 'ALLOWED' : 'DENIED',
        keputusan.boleh ? null : keputusan.alasan,
        ipHash ?? null,
      ],
    );

    if (!keputusan.boleh || !keputusan.patientId) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, keputusan.alasan);
    }
    return { patientId: keputusan.patientId, sebagai: keputusan.sebagai as 'SELF' | 'PROXY' };
  }

  // --- Jalur portal ----------------------------------------------------------

  async janjiSaya(
    schema: string,
    platformUserId: string,
    subjectPatientId: string | null,
    ipHash?: string | null,
  ) {
    const { patientId, sebagai } = await this.akses(
      schema,
      platformUserId,
      subjectPatientId,
      'APPOINTMENT',
      ipHash,
    );
    const baris = await this.tenantDb.query(
      schema,
      `SELECT a.id, a.appointment_number, a.scheduled_at, a.status, a.chief_complaint,
              u.name AS unit_name, p.full_name AS provider_name
         FROM "${schema}".health_appointment a
         LEFT JOIN "${schema}".health_service_unit u ON u.id = a.service_unit_id
         LEFT JOIN "${schema}".health_provider p ON p.id = a.provider_id
        WHERE a.patient_id = $1
        ORDER BY a.scheduled_at DESC
        LIMIT 100`,
      [patientId],
    );
    return { accessedAs: sebagai, items: baris };
  }

  async buatJanji(
    schema: string,
    platformUserId: string,
    input: {
      subjectPatientId?: string | null;
      facilityId: string;
      serviceUnitId?: string | null;
      providerId?: string | null;
      scheduledAt: string;
      chiefComplaint?: string | null;
    },
    ipHash?: string | null,
  ) {
    const { patientId } = await this.akses(
      schema,
      platformUserId,
      input.subjectPatientId ?? null,
      'APPOINTMENT',
      ipHash,
    );

    const izin = bolehBuatJanji({
      jadwalPada: input.scheduledAt,
      sekarang: new Date().toISOString(),
      batasHariKeDepan: BATAS_HARI_JANJI,
    });
    if (!izin.boleh) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorJanji(client, schema, input.facilityId);
      const baris = await client.query<{ id: string; appointment_number: string }>(
        `INSERT INTO "${schema}".health_appointment
           (patient_id, facility_id, service_unit_id, provider_id, appointment_number,
            scheduled_at, channel, status, chief_complaint)
         VALUES ($1,$2,$3,$4,$5,$6::timestamptz,'ONLINE','BOOKED',$7)
         RETURNING id, appointment_number`,
        [
          patientId,
          input.facilityId,
          input.serviceUnitId ?? null,
          input.providerId ?? null,
          nomor,
          input.scheduledAt,
          input.chiefComplaint ?? null,
        ],
      );
      return {
        id: baris.rows[0].id,
        appointmentNumber: baris.rows[0].appointment_number,
        status: 'BOOKED',
      };
    });
  }

  async batalkanJanji(
    schema: string,
    platformUserId: string,
    appointmentId: string,
    reason: string,
    ipHash?: string | null,
  ) {
    const id = await this.identitas(schema, platformUserId);

    return this.tenantDb.transaction(schema, async (client) => {
      const janji = await client.query<{
        patient_id: string;
        status: StatusJanji;
        scheduled_at: string;
      }>(
        `SELECT patient_id, status, scheduled_at FROM "${schema}".health_appointment
          WHERE id = $1 FOR UPDATE`,
        [appointmentId],
      );
      if (janji.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Janji temu tidak ditemukan.');
      }

      /*
       * Pemilik janjinya diperiksa terhadap identitas tokennya — bukan
       * sebaliknya. Yang dibaca dari basis data adalah patient_id janji itu,
       * lalu ia dicocokkan; ia tidak pernah dipakai untuk menentukan siapa
       * pemanggilnya.
       */
      const keputusan = putuskanAkses(id, janji.rows[0].patient_id, 'APPOINTMENT');
      const akun = await this.akunId(schema, platformUserId);
      await client.query(
        `INSERT INTO "${schema}".patient_portal_access_log
           (portal_account_id, subject_patient_id, accessed_as, data_kind, outcome, deny_reason, ip_hash)
         VALUES ($1,$2,$3,'APPOINTMENT',$4,$5,$6)`,
        [
          akun,
          janji.rows[0].patient_id,
          keputusan.sebagai ?? 'SELF',
          keputusan.boleh ? 'ALLOWED' : 'DENIED',
          keputusan.boleh ? null : keputusan.alasan,
          ipHash ?? null,
        ],
      );
      if (!keputusan.boleh) {
        throw AppError.forbidden(ErrorCodes.FORBIDDEN, keputusan.alasan);
      }

      const izin = bolehBatalkanJanji({
        status: janji.rows[0].status,
        jadwalPada: String(janji.rows[0].scheduled_at),
        sekarang: new Date().toISOString(),
      });
      if (!izin.boleh) {
        throw AppError.unprocessable(ErrorCodes.INVALID_STATE_TRANSITION, izin.alasan);
      }

      await client.query(
        `UPDATE "${schema}".health_appointment
            SET status = 'CANCELLED', cancelled_at = now(), cancel_reason = $2,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [appointmentId, reason],
      );
      return { id: appointmentId, status: 'CANCELLED', note: izin.alasan };
    });
  }

  async antreanSaya(
    schema: string,
    platformUserId: string,
    subjectPatientId: string | null,
    ipHash?: string | null,
  ) {
    const { patientId, sebagai } = await this.akses(
      schema,
      platformUserId,
      subjectPatientId,
      'QUEUE',
      ipHash,
    );
    /*
     * Antrean tertaut pasien lewat PENDAFTARANNYA, bukan langsung.
     *
     * Itu benar: satu pasien dapat mendaftar dua kali dalam sehari — pagi ke
     * poliklinik, sore ke laboratorium — dan nomor antreannya berbeda. Tabel
     * antrean yang menunjuk pasien langsung akan memaksa salah satu di
     * antaranya hilang.
     *
     * `business_date` dipakai, bukan `created_at::date`: antrean yang dibuat
     * pukul 23.55 untuk hari berikutnya adalah antrean hari berikutnya.
     */
    const saya = await this.tenantDb.query<{ queue_number: number; service_unit_id: string }>(
      schema,
      `SELECT q.queue_number, q.service_unit_id
         FROM "${schema}".health_queue q
         JOIN "${schema}".health_registration r ON r.id = q.registration_id
        WHERE r.patient_id = $1 AND q.business_date = CURRENT_DATE
        ORDER BY q.created_at DESC LIMIT 1`,
      [patientId],
    );
    if (saya.length === 0) {
      return {
        accessedAs: sebagai,
        ...ringkasAntrean({
          nomorSaya: null,
          nomorDipanggil: null,
          jumlahMenunggu: 0,
          rerataMenitPerPasien: null,
        }),
      };
    }

    const unit = await this.tenantDb.query<{ dipanggil: number | null; menunggu: string }>(
      schema,
      `SELECT max(queue_number) FILTER (WHERE status = 'CALLED') AS dipanggil,
              count(*) FILTER (WHERE status = 'WAITING')::text AS menunggu
         FROM "${schema}".health_queue
        WHERE service_unit_id = $1 AND business_date = CURRENT_DATE`,
      [saya[0].service_unit_id],
    );

    return {
      accessedAs: sebagai,
      ...ringkasAntrean({
        nomorSaya: Number(saya[0].queue_number),
        nomorDipanggil: unit[0]?.dipanggil != null ? Number(unit[0].dipanggil) : null,
        jumlahMenunggu: Number(unit[0]?.menunggu ?? 0),
        rerataMenitPerPasien: 6,
      }),
    };
  }

  async hasilSaya(
    schema: string,
    platformUserId: string,
    subjectPatientId: string | null,
    ipHash?: string | null,
  ) {
    const { patientId, sebagai } = await this.akses(
      schema,
      platformUserId,
      subjectPatientId,
      'LAB_RESULT',
      ipHash,
    );
    const baris = await this.tenantDb.query<{
      id: string;
      status: string;
      released_at: string | null;
      verified_at: string | null;
      is_critical: boolean;
      flag: string | null;
      value_numeric: string | null;
      value_text: string | null;
      unit: string | null;
      test_name: string | null;
      entered_at: string | null;
    }>(
      schema,
      `SELECT r.id, r.status, r.released_at, r.verified_at, r.is_critical, r.flag,
              r.value_numeric, r.value_text, r.unit, t.name AS test_name, r.entered_at
         FROM "${schema}".lab_result r
         LEFT JOIN "${schema}".lab_test_catalog t ON t.id = r.test_id
        WHERE r.patient_id = $1
        ORDER BY r.entered_at DESC NULLS LAST
        LIMIT 200`,
      [patientId],
    );

    const hasil = saringHasil(
      baris.map((b) => ({
        id: b.id,
        status: b.status,
        releasedAt: b.released_at ? String(b.released_at) : null,
        verifiedAt: b.verified_at ? String(b.verified_at) : null,
        isCritical: b.is_critical,
        flag: b.flag,
      })),
    );

    return {
      accessedAs: sebagai,
      shown: hasil.ditampilkan,
      withheld: hasil.ditahan,
      /*
       * ANGKANYA HANYA DISERTAKAN PADA YANG BOLEH TAMPIL.
       *
       * Bukan disertakan lalu disembunyikan di layar. Yang terkirim ke telepon
       * genggam sudah keluar dari kendali kami, dan penyaring di layar dapat
       * dilewati siapa pun yang membuka alat pengembang peramban.
       */
      items: hasil.items.map((h, i) => ({
        id: h.id,
        testName: baris[i].test_name,
        enteredAt: baris[i].entered_at,
        shown: h.tampil,
        value: h.tampil ? (baris[i].value_numeric ?? baris[i].value_text) : null,
        unit: h.tampil ? baris[i].unit : null,
        flag: h.tampil ? h.flag : null,
        message: h.pesan,
      })),
    };
  }

  async ringkasanKunjunganSaya(
    schema: string,
    platformUserId: string,
    subjectPatientId: string | null,
    ipHash?: string | null,
  ) {
    const { patientId, sebagai } = await this.akses(
      schema,
      platformUserId,
      subjectPatientId,
      'VISIT_SUMMARY',
      ipHash,
    );
    const baris = await this.tenantDb.query(
      schema,
      `SELECT e.id, e.encounter_number, e.encounter_type, e.started_at, e.ended_at, e.status,
              u.name AS unit_name, f.name AS facility_name
         FROM "${schema}".health_encounter e
         LEFT JOIN "${schema}".health_service_unit u ON u.id = e.service_unit_id
         LEFT JOIN "${schema}".health_facility f ON f.id = e.facility_id
        WHERE e.patient_id = $1
        ORDER BY e.started_at DESC
        LIMIT 100`,
      [patientId],
    );
    return { accessedAs: sebagai, items: baris };
  }

  async resepSaya(
    schema: string,
    platformUserId: string,
    subjectPatientId: string | null,
    ipHash?: string | null,
  ) {
    const { patientId, sebagai } = await this.akses(
      schema,
      platformUserId,
      subjectPatientId,
      'PRESCRIPTION',
      ipHash,
    );
    const baris = await this.tenantDb.query(
      schema,
      `SELECT p.id, p.prescription_number, p.prescribed_at, p.status
         FROM "${schema}".rx_prescription p
        WHERE p.patient_id = $1
        ORDER BY p.prescribed_at DESC
        LIMIT 100`,
      [patientId],
    );
    return { accessedAs: sebagai, items: baris };
  }

  /** Daftar pasien yang boleh dilihat akun ini, beserta batasnya. */
  async siapaSaja(schema: string, platformUserId: string) {
    const id = await this.identitas(schema, platformUserId);
    const nama = await this.tenantDb.query<{ id: string; full_name: string }>(
      schema,
      `SELECT id, full_name FROM "${schema}".patient WHERE id = ANY($1::uuid[])`,
      [[id.selfPatientId, ...id.proxies.map((p) => p.patientId)]],
    );
    const peta = new Map(nama.map((n) => [n.id, n.full_name]));
    return {
      self: { patientId: id.selfPatientId, name: peta.get(id.selfPatientId) ?? null },
      proxies: id.proxies.map((p) => ({
        patientId: p.patientId,
        name: peta.get(p.patientId) ?? null,
        accessLevel: p.accessLevel,
      })),
      note:
        'Daftar ini datang dari token Anda. Pasien di luar daftar ini tidak dapat dibuka akun ' +
        'ini, berapa pun nomor yang dikirimkan.',
    };
  }

  // --- Sisi petugas ----------------------------------------------------------

  async buatAkun(
    schema: string,
    input: { patientId: string; platformUserId: string },
    actorUserId: string,
  ) {
    const akunAda = await this.tenantDb.query(
      schema,
      `SELECT 1 FROM "${schema}".patient_portal_account
        WHERE platform_user_id = $1 AND status <> 'CLOSED'`,
      [input.platformUserId],
    );
    const pasienAda = await this.tenantDb.query(
      schema,
      `SELECT 1 FROM "${schema}".patient_portal_account
        WHERE patient_id = $1 AND status <> 'CLOSED'`,
      [input.patientId],
    );

    const izin = bolehTautkanAkun({
      akunSudahTertaut: akunAda.length > 0,
      pasienSudahPunyaAkun: pasienAda.length > 0,
      // Verifikasi tatap muka adalah tindakan tersendiri; akun lahir PENDING.
      identitasTerverifikasi: true,
    });
    if (!izin.boleh) {
      throw AppError.conflict(ErrorCodes.CONFLICT, izin.alasan);
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".patient_portal_account
         (patient_id, platform_user_id, status, created_by)
       VALUES ($1,$2,'PENDING',$3) RETURNING id`,
      [input.patientId, input.platformUserId, actorUserId],
    );
    return {
      id: baris[0].id,
      status: 'PENDING',
      note:
        'Akun lahir PENDING. Ia belum dapat membuka apa pun sampai identitas pemohonnya ' +
        'diverifikasi tatap muka — akun portal yang dibuat tanpa verifikasi adalah rekam medis ' +
        'yang diserahkan kepada siapa pun yang mengetahui tanggal lahir seseorang.',
    };
  }

  async verifikasiAkun(
    schema: string,
    accountId: string,
    input: { method: string },
    actorUserId: string,
  ) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".patient_portal_account
          SET status = 'ACTIVE', identity_verified_by = $2, identity_verified_at = now(),
              verification_method = $3, activated_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1 AND status = 'PENDING'
        RETURNING id`,
      [accountId, actorUserId, input.method],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Akun tidak ditemukan atau bukan lagi berstatus PENDING.',
      );
    }
    this.logger.log(`Akun portal ${accountId} diverifikasi oleh ${actorUserId}`);
    return { id: accountId, status: 'ACTIVE' };
  }

  async lepasHasil(
    schema: string,
    labResultId: string,
    input: { patientContacted?: boolean; contactNote?: string | null },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const hasil = await client.query<{ is_critical: boolean; verified_at: string | null }>(
        `SELECT is_critical, verified_at FROM "${schema}".lab_result WHERE id = $1 FOR UPDATE`,
        [labResultId],
      );
      if (hasil.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hasil tidak ditemukan.');
      }
      if (!hasil.rows[0].verified_at) {
        throw AppError.unprocessable(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Hasil belum diverifikasi. Hasil yang belum diverifikasi masih dapat berubah — dan ' +
            'angka yang berubah sesudah dibaca pasien lebih buruk daripada angka yang datang ' +
            'terlambat.',
        );
      }

      const kritis = hasil.rows[0].is_critical;
      if (kritis && input.patientContacted !== true) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Hasil bertanda KRITIS hanya dilepas sesudah pasiennya dihubungi. Melepasnya ke ' +
            'portal tanpa menghubungi lebih dahulu adalah menyerahkan kabar buruk kepada layar ' +
            'telepon — dan layar telepon tidak dapat menjawab pertanyaan.',
        );
      }

      await client.query(
        `INSERT INTO "${schema}".portal_result_release
           (lab_result_id, released_by, was_critical, patient_contacted, contact_note)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (lab_result_id) DO NOTHING`,
        [
          labResultId,
          actorUserId,
          kritis,
          input.patientContacted === true,
          input.contactNote ?? null,
        ],
      );
      await client.query(
        `UPDATE "${schema}".lab_result
            SET released_at = COALESCE(released_at, now()), updated_at = now(),
                version = version + 1
          WHERE id = $1`,
        [labResultId],
      );

      return {
        id: labResultId,
        released: true,
        wasCritical: kritis,
        note: kritis
          ? 'Hasil kritis dilepas sesudah pasiennya dihubungi.'
          : 'Hasil dilepas ke portal.',
      };
    });
  }

  // --- Website ---------------------------------------------------------------

  async simpanKonten(
    schema: string,
    input: {
      facilityId: string;
      contentKind: JenisKonten;
      slug: string;
      title: string;
      summary?: string | null;
      body?: string | null;
      providerId?: string | null;
      serviceUnitId?: string | null;
      sortOrder?: number;
    },
    actorUserId: string,
  ) {
    /*
     * Diperiksa dua kali, dan keduanya perlu.
     *
     * Yang pertama memeriksa NAMA MEDANNYA — menangkap pemanggil yang
     * mengirimkan `patientName` sebagai medan tersendiri. Yang kedua memeriksa
     * ISI TEKSNYA — sebab `body` berupa teks bebas, dan teks bebas dapat memuat
     * apa saja, termasuk nomor rekam medis yang disalin seseorang dari layar
     * sebelah.
     */
    const bersih = periksaKontenPublik(input as unknown as Record<string, unknown>);
    if (!bersih.bersih) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, bersih.alasan);
    }

    const teks = `${input.title} ${input.summary ?? ''} ${input.body ?? ''}`;
    const pola = [
      { nama: 'NIK', re: /\b\d{16}\b/ },
      { nama: 'nomor rekam medis', re: /\bRM[-\s]?\d{4,}\b/i },
      { nama: 'nomor SEP', re: /\bSEP[-\s]?\d{4,}\b/i },
    ];
    const tertangkap = pola.filter((p) => p.re.test(teks)).map((p) => p.nama);
    if (tertangkap.length > 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Teks konten memuat ${tertangkap.join(' dan ')}. Website dibaca tanpa masuk sama ` +
          'sekali; satu nomor yang lolos adalah pelanggaran kerahasiaan medis yang tidak dapat ' +
          'ditarik kembali — mesin pencari sudah menyalinnya sebelum ada yang menyadarinya.',
      );
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".facility_web_content
         (facility_id, content_kind, slug, title, summary, body, provider_id,
          service_unit_id, sort_order, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (facility_id, slug) DO UPDATE
         SET title = EXCLUDED.title, summary = EXCLUDED.summary, body = EXCLUDED.body,
             provider_id = EXCLUDED.provider_id, service_unit_id = EXCLUDED.service_unit_id,
             sort_order = EXCLUDED.sort_order, updated_at = now(),
             version = "${schema}".facility_web_content.version + 1
       RETURNING id`,
      [
        input.facilityId,
        input.contentKind,
        input.slug,
        input.title,
        input.summary ?? null,
        input.body ?? null,
        input.providerId ?? null,
        input.serviceUnitId ?? null,
        input.sortOrder ?? 0,
        actorUserId,
      ],
    );
    return { id: baris[0].id, status: 'DRAFT' };
  }

  async terbitkanKonten(schema: string, contentId: string, actorUserId: string) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".facility_web_content
          SET status = 'PUBLISHED', published_by = $2,
              published_from = COALESCE(published_from, now()),
              updated_at = now(), version = version + 1
        WHERE id = $1 AND status <> 'PUBLISHED'
        RETURNING id`,
      [contentId, actorUserId],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Konten tidak ditemukan atau sudah terbit.',
      );
    }
    return { id: contentId, status: 'PUBLISHED' };
  }

  async tarikKonten(schema: string, contentId: string, reason: string, actorUserId: string) {
    if (reason.trim().length < 10) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penarikan wajib beralasan. Yang menariknya sedang tergesa, dan yang bertanya kemudian ' +
          'tidak akan menemukan siapa pun yang ingat.',
      );
    }
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".facility_web_content
          SET status = 'UNPUBLISHED', unpublished_by = $2, unpublish_reason = $3,
              updated_at = now(), version = version + 1
        WHERE id = $1 AND status = 'PUBLISHED'
        RETURNING id`,
      [contentId, actorUserId, reason],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Konten tidak ditemukan atau belum terbit.',
      );
    }
    return { id: contentId, status: 'UNPUBLISHED' };
  }

  /**
   * Website publik: dibaca tanpa masuk sama sekali.
   *
   * Karena itu ia hanya membaca `facility_web_content` — tabel yang tidak punya
   * satu pun kolom pasien maupun kunci asing ke tabel klinis.
   */
  async websitePublik(schema: string, facilityId: string, kind?: string) {
    const syarat = ['facility_id = $1', "status = 'PUBLISHED'"];
    const nilai: unknown[] = [facilityId];
    if (kind) {
      nilai.push(kind);
      syarat.push(`content_kind = $${nilai.length}`);
    }
    const baris = await this.tenantDb.query<{
      id: string;
      content_kind: string;
      slug: string;
      title: string;
      summary: string | null;
      body: string | null;
      published_from: string | null;
      published_until: string | null;
      sort_order: number;
    }>(
      schema,
      `SELECT id, content_kind, slug, title, summary, body,
              published_from, published_until, sort_order
         FROM "${schema}".facility_web_content
        WHERE ${syarat.join(' AND ')}
        ORDER BY content_kind, sort_order, title`,
      nilai,
    );

    const sekarang = new Date().toISOString();
    return {
      items: baris
        .filter(
          (b) =>
            bolehTampilKonten({
              status: 'PUBLISHED',
              publishedFrom: b.published_from ? String(b.published_from) : null,
              publishedUntil: b.published_until ? String(b.published_until) : null,
              sekarang,
            }).tampil,
        )
        .map((b) => ({
          kind: b.content_kind,
          slug: b.slug,
          title: b.title,
          summary: b.summary,
          body: b.body,
        })),
      note:
        'Halaman ini dibaca tanpa masuk sama sekali, dan ia hanya membaca tabel konten — tabel ' +
        'yang tidak punya satu pun kolom pasien.',
    };
  }

  // --- Pembantu --------------------------------------------------------------

  hashIp(ip: string | null | undefined): string | null {
    if (!ip) return null;
    // Disidik, bukan disimpan. Alamat IP adalah data pribadi; sidik jarinya
    // cukup untuk mengenali penolakan beruntun dari sumber yang sama.
    return `sha256:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
  }

  private async nomorJanji(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".health_appointment
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `APT-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
