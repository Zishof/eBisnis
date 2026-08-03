/**
 * Kerangka SATUSEHAT: lingkungan, gerbang kemampuan, dan jejak percobaan.
 *
 * Aturannya ada di `health-satusehat.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak melakukan satu pun panggilan jaringan.**
 *
 * Bukan karena belum sempat: ia memang tidak boleh, dan tidak akan boleh sampai
 * kemampuannya `VERIFIED`. Jalan `kirim` di bawah ada supaya penolakannya punya
 * tempat yang jelas — dan supaya orang yang mencari "di mana pengirimannya"
 * menemukan penjelasan alih-alih ketiadaan. Ketiadaan akan ditafsirkan sebagai
 * kelalaian, dan orang yang menafsirkannya begitu akan menuliskannya sendiri.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  KEMAMPUAN_SATUSEHAT,
  SYARAT_VERIFIKASI,
  bolehKirim,
  bolehNaikkanStatus,
  bolehSimpanKredensial,
  bolehUlangi,
  kunciIdempotensi,
  rekonsiliasi,
  ringkasKesiapan,
  type StatusKemampuan,
} from './health-satusehat';

@Injectable()
export class HealthSatusehatService {
  private readonly logger = new Logger(HealthSatusehatService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  katalog() {
    return {
      capabilities: KEMAMPUAN_SATUSEHAT,
      requirements: SYARAT_VERIFIKASI,
      note:
        'Seluruhnya BLOCKED, dan itu bukan nilai bawaan yang menunggu diisi melainkan keadaan ' +
        'yang sesungguhnya hari ini. Kolom sumber lokal menyatakan hal yang menggembirakan: ' +
        'datanya sudah ada di sisi kami — penghalangnya benar-benar hanya pada lapisan ' +
        'pertukaran.',
    };
  }

  // --- Lingkungan ------------------------------------------------------------

  async daftarkanLingkungan(
    schema: string,
    input: {
      facilityId: string;
      environment: 'SANDBOX' | 'PRODUCTION';
      organizationId?: string | null;
      baseUrl?: string | null;
      credentialSecretRef?: string | null;
      credentialRawValue?: string | null;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    if (input.credentialSecretRef || input.credentialRawValue) {
      const izin = bolehSimpanKredensial({
        secretRef: input.credentialSecretRef ?? null,
        rawValue: input.credentialRawValue ?? null,
      });
      if (!izin.boleh) {
        throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
      }
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".satusehat_environment
         (facility_id, environment, organization_id, base_url, credential_secret_ref,
          note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (facility_id, environment) DO UPDATE
         SET organization_id = EXCLUDED.organization_id,
             base_url = EXCLUDED.base_url,
             credential_secret_ref = COALESCE(EXCLUDED.credential_secret_ref,
                                              "${schema}".satusehat_environment.credential_secret_ref),
             note = EXCLUDED.note,
             updated_at = now(),
             version = "${schema}".satusehat_environment.version + 1
       RETURNING id`,
      [
        input.facilityId,
        input.environment,
        input.organizationId ?? null,
        input.baseUrl ?? null,
        input.credentialSecretRef ?? null,
        input.note ?? null,
        actorUserId,
      ],
    );

    return {
      id: baris[0].id,
      environment: input.environment,
      isActive: false,
      note:
        'Lingkungan terdaftar tetapi TIDAK aktif. Mengaktifkannya adalah tindakan tersendiri, ' +
        'dan mengaktifkannya pun tidak membuka pengiriman — gerbangnya adalah status kemampuan, ' +
        'bukan status lingkungan. Rujukan kredensialnya tidak dapat dibaca kembali dari sini.',
    };
  }

  async aktifkanLingkungan(schema: string, environmentId: string, actorUserId: string) {
    return this.tenantDb.transaction(schema, async (client) => {
      const env = await client.query<{
        facility_id: string;
        environment: string;
        organization_id: string | null;
        credential_secret_ref: string | null;
      }>(
        `SELECT facility_id, environment, organization_id, credential_secret_ref
           FROM "${schema}".satusehat_environment WHERE id = $1 FOR UPDATE`,
        [environmentId],
      );
      if (env.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Lingkungan tidak ditemukan.');
      }
      if (!env.rows[0].credential_secret_ref || !env.rows[0].organization_id) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Lingkungan yang aktif wajib punya rujukan kredensial dan ID organisasi. Lingkungan ' +
            'aktif tanpa keduanya adalah tombol yang menyala tanpa kabel.',
        );
      }

      // Satu lingkungan aktif per fasilitas: dua yang aktif berarti tidak ada
      // yang tahu ke mana data pasien dikirimkan.
      await client.query(
        `UPDATE "${schema}".satusehat_environment
            SET is_active = FALSE, updated_at = now(), version = version + 1
          WHERE facility_id = $1 AND is_active = TRUE AND id <> $2`,
        [env.rows[0].facility_id, environmentId],
      );
      await client.query(
        `UPDATE "${schema}".satusehat_environment
            SET is_active = TRUE, activated_by = $2, activated_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [environmentId, actorUserId],
      );

      this.logger.log(`Lingkungan SATUSEHAT ${environmentId} diaktifkan oleh ${actorUserId}`);
      return {
        id: environmentId,
        isActive: true,
        note:
          'Lingkungan aktif TIDAK membuka pengiriman. Gerbangnya adalah status kemampuan per ' +
          'sumber daya, dan seluruhnya masih BLOCKED sampai ada manusia yang menjalankan ' +
          'panggilannya terhadap sandbox.',
      };
    });
  }

  async daftarLingkungan(schema: string, facilityId: string) {
    // Rujukan kredensialnya TIDAK dikembalikan — hanya keterangan bahwa ia ada.
    return this.tenantDb.query(
      schema,
      `SELECT id, environment, organization_id, base_url, is_active,
              credential_secret_ref IS NOT NULL AS has_credential,
              activated_at, note
         FROM "${schema}".satusehat_environment
        WHERE facility_id = $1
        ORDER BY environment`,
      [facilityId],
    );
  }

  // --- Kemampuan -------------------------------------------------------------

  async daftarKemampuan(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{
      id: string;
      resource_type: string;
      status: StatusKemampuan;
      blocker: string | null;
      evidence_codes: string[];
      verified_at: string | null;
    }>(
      schema,
      `SELECT id, resource_type, status, blocker, evidence_codes, verified_at
         FROM "${schema}".satusehat_capability
        WHERE facility_id = $1
        ORDER BY resource_type`,
      [facilityId],
    );

    const ringkas = ringkasKesiapan(
      baris.map((b) => ({ resource: b.resource_type, status: b.status })),
    );

    return {
      items: baris.map((b) => ({
        id: b.id,
        resourceType: b.resource_type,
        status: b.status,
        blocker: b.blocker,
        evidenceCodes: b.evidence_codes,
        verifiedAt: b.verified_at,
        localSource:
          KEMAMPUAN_SATUSEHAT.find((k) => k.resource === b.resource_type)?.sumberLokal ?? null,
      })),
      summary: ringkas,
    };
  }

  async ubahStatusKemampuan(
    schema: string,
    capabilityId: string,
    input: { status: StatusKemampuan; evidenceCodes?: string[]; note?: string | null },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const c = await client.query<{ status: StatusKemampuan; resource_type: string }>(
        `SELECT status, resource_type FROM "${schema}".satusehat_capability
          WHERE id = $1 FOR UPDATE`,
        [capabilityId],
      );
      if (c.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kemampuan tidak ditemukan.');
      }

      const izin = bolehNaikkanStatus({
        dari: c.rows[0].status,
        ke: input.status,
        /*
         * Selalu true di sini, dan itu bukan pelonggaran: jalan ini hanya
         * dapat dipanggil pengguna yang sudah masuk dengan hak VERIFY. Yang
         * dijaga fungsi murninya adalah pemanggilan dari naskah penyemaian dan
         * pekerjaan latar, yang tidak melewati jalan ini.
         */
        olehManusia: true,
        buktiSyarat: input.evidenceCodes ?? [],
      });
      if (!izin.boleh) {
        throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
      }

      const verified = input.status === 'VERIFIED';
      await client.query(
        `UPDATE "${schema}".satusehat_capability
            SET status = $2,
                evidence_codes = $3::varchar[],
                verified_by = CASE WHEN $4 THEN $5::uuid ELSE verified_by END,
                verified_at = CASE WHEN $4 THEN now() ELSE verified_at END,
                verification_note = COALESCE($6, verification_note),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          capabilityId,
          input.status,
          input.evidenceCodes ?? [],
          verified,
          actorUserId,
          input.note ?? null,
        ],
      );

      return {
        id: capabilityId,
        resourceType: c.rows[0].resource_type,
        status: input.status,
        note: verified
          ? 'Kemampuan terverifikasi. Pengiriman untuk sumber daya ini kini terbuka — dan ' +
            'pengiriman data pasien ke sistem nasional tidak dapat ditarik kembali.'
          : izin.alasan,
      };
    });
  }

  // --- Pengiriman ------------------------------------------------------------

  /**
   * Menyiapkan pengiriman satu sumber daya.
   *
   * **Tidak mengirim apa pun.** Ia memeriksa gerbangnya, mencatat percobaannya,
   * dan menolak — sebab payload FHIR-nya memang belum dapat disusun.
   *
   * Jalan ini ada supaya penolakannya punya tempat yang jelas dan tercatat.
   * Percobaan yang ditolak pun dicatat: ia menunjukkan bahwa seseorang mencoba,
   * dan kapan.
   */
  async siapkanPengiriman(
    schema: string,
    input: { facilityId: string; resourceType: string; localId: string; localVersion?: number },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const fasilitas = await client.query<{ code: string }>(
        `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
        [input.facilityId],
      );
      if (fasilitas.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');
      }

      const env = await client.query<{ id: string; credential_secret_ref: string | null }>(
        `SELECT id, credential_secret_ref FROM "${schema}".satusehat_environment
          WHERE facility_id = $1 AND is_active = TRUE`,
        [input.facilityId],
      );
      const kemampuan = await client.query<{ status: StatusKemampuan }>(
        `SELECT status FROM "${schema}".satusehat_capability
          WHERE facility_id = $1 AND resource_type = $2`,
        [input.facilityId, input.resourceType],
      );

      const gerbang = bolehKirim({
        resource: input.resourceType,
        status: kemampuan.rows[0]?.status ?? 'BLOCKED',
        lingkunganAktif: (env.rowCount ?? 0) > 0,
        adaRujukanKredensial: Boolean(env.rows[0]?.credential_secret_ref),
      });

      const kunci = kunciIdempotensi({
        facilityCode: fasilitas.rows[0].code,
        resource: input.resourceType,
        localId: input.localId,
        versi: input.localVersion ?? 1,
      });

      const txn = await client.query<{ id: string; attempt_count: number; status: string }>(
        `INSERT INTO "${schema}".satusehat_transaction
           (facility_id, environment_id, resource_type, local_id, local_version,
            idempotency_key, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,'PENDING',$7)
         ON CONFLICT (facility_id, idempotency_key) DO UPDATE
           SET updated_at = now()
         RETURNING id, attempt_count, status`,
        [
          input.facilityId,
          env.rows[0]?.id ?? null,
          input.resourceType,
          input.localId,
          input.localVersion ?? 1,
          kunci,
          actorUserId,
        ],
      );

      const ulang = bolehUlangi({
        statusTerakhir: txn.rows[0].status as 'PENDING' | 'SUCCESS' | 'FAILED' | 'REJECTED',
        jumlahPercobaan: Number(txn.rows[0].attempt_count),
        batasPercobaan: 5,
      });

      // Percobaan dicatat apa pun hasilnya — termasuk yang tertahan gerbang.
      const nomor = Number(txn.rows[0].attempt_count) + 1;
      await client.query(
        `INSERT INTO "${schema}".satusehat_attempt
           (transaction_id, attempt_number, outcome, error_code, error_message, attempted_by)
         VALUES ($1,$2,'BLOCKED','CAPABILITY_NOT_VERIFIED',$3,$4)
         ON CONFLICT (transaction_id, attempt_number) DO NOTHING`,
        [txn.rows[0].id, nomor, gerbang.alasan, actorUserId],
      );
      await client.query(
        `UPDATE "${schema}".satusehat_transaction
            SET attempt_count = attempt_count + 1,
                first_attempt_at = COALESCE(first_attempt_at, now()),
                last_attempt_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [txn.rows[0].id],
      );

      return {
        transactionId: txn.rows[0].id,
        idempotencyKey: kunci,
        /*
         * SELALU false pada keadaan hari ini, dan itu bukan cacat.
         *
         * Kerangka yang menolak berjalan adalah yang diminta perintah R2 §5.
         * Yang berpura-pura bekerja akan mengirimkan data pasien ke tempat
         * yang salah pada hari pertama produksi.
         */
        sent: false,
        gateOpen: gerbang.boleh,
        reason: gerbang.alasan,
        requirements: gerbang.yangDibutuhkan,
        retryAllowed: ulang.boleh,
        retryReason: ulang.alasan,
        note:
          'TIDAK ADA PANGGILAN JARINGAN yang dilakukan. Percobaannya dicatat — percobaan yang ' +
          'tertahan gerbang pun berharga: ia menunjukkan bahwa seseorang mencoba, dan kapan. ' +
          'Payload FHIR tidak disusun di sini dan tidak akan disusun sampai dokumentasi profil ' +
          'berversinya ada.',
      };
    });
  }

  async jejakPengiriman(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT t.id, t.resource_type, t.local_id, t.idempotency_key, t.status,
              t.attempt_count, t.max_attempts, t.remote_resource_id,
              t.last_error_code, t.last_error_message, t.last_attempt_at
         FROM "${schema}".satusehat_transaction t
        WHERE t.facility_id = $1
        ORDER BY t.updated_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  async rekonsiliasiPengiriman(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{ status: string; n: string }>(
      schema,
      `SELECT status, count(*)::text AS n FROM "${schema}".satusehat_transaction
        WHERE facility_id = $1 GROUP BY status`,
      [facilityId],
    );
    const hitung = (s: string) => Number(baris.find((b) => b.status === s)?.n ?? 0);
    const dikirim = baris.reduce((t, b) => t + Number(b.n), 0);
    return {
      ...rekonsiliasi({
        dikirim,
        diterima: hitung('SUCCESS'),
        gagal: hitung('FAILED') + hitung('REJECTED'),
      }),
      pending: hitung('PENDING'),
    };
  }
}
