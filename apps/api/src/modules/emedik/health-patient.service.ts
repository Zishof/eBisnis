/**
 * Identitas pasien.
 *
 * Dua hal membedakan layanan ini dari layanan master mana pun di inti:
 *
 * 1. **Setiap pembacaan dicatat.** Bukan hanya perubahan. Ancaman tersering
 *    pada sistem kesehatan bukan peretasan dari luar, melainkan tenaga
 *    kesehatan yang membuka rekam medis orang yang tidak dirawatnya — dan hak
 *    akses berbasis peran tidak menahannya, sebab perawat memang berhak
 *    membaca rekam medis. Pertanyaannya rekam medis siapa.
 *
 * 2. **Penggandaan diperiksa sebelum menyimpan, bukan sesudah.** Rekam medis
 *    ganda menjalar ke setiap konteks lain, dan membersihkannya kemudian
 *    menuntut penggabungan ribuan baris di belasan tabel.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort, type PurposeOfUse } from './ports';
import {
  AMBANG_DUGAAN,
  bolehGabung,
  keyakinanIdentitas,
  nikSahBentuknya,
  normalkanNama,
  normalkanTelepon,
  skorPenggandaan,
  susunNomorRekamMedis,
  type CalonPasien,
} from './health-patient-identity';

export interface KonteksAkses {
  actorUserId: string;
  activeRoleId?: string | null;
  purposeOfUse: PurposeOfUse;
  facilityId?: string | null;
  breakGlass?: boolean;
  breakGlassReason?: string | null;
  requestId?: string | null;
}

export interface DaftarPasienInput {
  fullName: string;
  birthDate?: string | null;
  birthDateEstimated?: boolean;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' | null;
  nik?: string | null;
  phone?: string | null;
  email?: string | null;
  addressText?: string | null;
  motherName?: string | null;
  facilityId: string;
  selfRegistered?: boolean;
  /** Menegaskan bahwa dugaan penggandaan sudah ditelaah dan memang orang berbeda. */
  confirmedNotDuplicate?: boolean;
}

@Injectable()
export class HealthPatientService {
  private readonly logger = new Logger(HealthPatientService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Pencarian -------------------------------------------------------------

  /**
   * Mencari pasien.
   *
   * Jawabannya menyebutkan `scope: 'FACILITY_LOCAL'` dengan sengaja. Selama
   * indeks pasien lintas fasilitas belum ada (integration request 003),
   * pencarian ini HANYA mencakup skema fasilitas ini — dan membiarkannya tampak
   * lebih luas akan membuat seseorang menyimpulkan bahwa pasien tidak punya
   * riwayat di tempat lain, padahal yang benar adalah kita belum melihatnya.
   */
  async cari(
    schema: string,
    kueri: { q?: string; nik?: string; phone?: string; limit?: number },
    ctx: KonteksAkses,
  ) {
    const batas = Math.min(Math.max(kueri.limit ?? 20, 1), 100);
    const syarat: string[] = ['p.deleted_at IS NULL', 'p.merged_into_id IS NULL'];
    const params: unknown[] = [];

    if (kueri.nik) {
      params.push(kueri.nik);
      syarat.push(
        `EXISTS (SELECT 1 FROM "${schema}".patient_identifier i
                  WHERE i.patient_id = p.id AND i.identifier_type = 'NIK'
                    AND i.identifier_value = $${params.length} AND i.deleted_at IS NULL)`,
      );
    }
    if (kueri.phone) {
      params.push(normalkanTelepon(kueri.phone));
      syarat.push(`regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g') LIKE '%' || $${params.length} || '%'`);
    }
    if (kueri.q) {
      params.push(`%${normalkanNama(kueri.q)}%`);
      syarat.push(`lower(p.full_name) LIKE $${params.length}`);
    }

    params.push(batas);

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT p.id, p.enterprise_patient_id, p.full_name, p.birth_date, p.gender,
              p.phone, p.identity_confidence, p.safety_alert, p.deceased_at,
              (SELECT i.identifier_value FROM "${schema}".patient_identifier i
                WHERE i.patient_id = p.id AND i.identifier_type = 'MRN'
                  AND i.deleted_at IS NULL ORDER BY i.created_at LIMIT 1) AS mrn
         FROM "${schema}".patient p
        WHERE ${syarat.join(' AND ')}
        ORDER BY p.full_name
        LIMIT $${params.length}`,
      params,
    );

    // Pencarian pun dicatat. Menelusuri nama seseorang tanpa membuka rekamnya
    // tetap merupakan pembacaan data pasien.
    for (const r of rows) {
      await this.audit.recordAccess(schema, {
        patientId: String(r.id),
        facilityId: ctx.facilityId ?? null,
        actorUserId: ctx.actorUserId,
        activeRoleId: ctx.activeRoleId ?? null,
        purposeOfUse: ctx.purposeOfUse,
        entityType: 'patient',
        entityId: String(r.id),
        action: 'SEARCH',
        requestId: ctx.requestId ?? null,
      });
    }

    return {
      scope: 'FACILITY_LOCAL' as const,
      scopeNote:
        'Pencarian ini hanya mencakup fasilitas ini. Riwayat pasien pada fasilitas lain belum ' +
        'terlihat sampai indeks pasien lintas fasilitas tersedia.',
      total: rows.length,
      results: rows,
    };
  }

  /** Membaca satu pasien. Selalu tercatat. */
  async ambil(schema: string, patientId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT p.*,
              (SELECT json_agg(json_build_object(
                 'type', i.identifier_type, 'value', i.identifier_value,
                 'facilityId', i.facility_id, 'verified', i.is_verified))
                 FROM "${schema}".patient_identifier i
                WHERE i.patient_id = p.id AND i.deleted_at IS NULL) AS identifiers,
              (SELECT json_agg(json_build_object(
                 'id', a.id, 'type', a.allergen_type, 'name', a.allergen_name,
                 'severity', a.severity, 'certainty', a.certainty, 'reaction', a.reaction))
                 FROM "${schema}".patient_allergy a
                WHERE a.patient_id = p.id AND a.refuted_at IS NULL) AS allergies
         FROM "${schema}".patient p
        WHERE p.id = $1 AND p.deleted_at IS NULL`,
      [patientId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');

    await this.audit.recordAccess(schema, {
      patientId,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      activeRoleId: ctx.activeRoleId ?? null,
      purposeOfUse: ctx.purposeOfUse,
      entityType: 'patient',
      entityId: patientId,
      action: 'READ',
      breakGlass: ctx.breakGlass ?? false,
      breakGlassReason: ctx.breakGlassReason ?? null,
      requestId: ctx.requestId ?? null,
    });

    return rows[0];
  }

  // --- Pendaftaran pasien baru -----------------------------------------------

  /**
   * Mendaftarkan pasien baru.
   *
   * Memeriksa penggandaan LEBIH DAHULU, dan menolak bila keyakinannya tinggi
   * kecuali petugas menegaskan bahwa keduanya memang orang berbeda. Petugas
   * yang ditanya kehilangan sepuluh detik; petugas yang tidak ditanya membuat
   * rekam medis kedua yang alerginya tidak terlihat selamanya.
   */
  async daftarkan(schema: string, input: DaftarPasienInput, ctx: KonteksAkses) {
    if (input.nik && !nikSahBentuknya(input.nik)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'NIK harus 16 angka dengan tanggal lahir yang masuk akal. Periksa kembali ketikannya.',
      );
    }

    const calon: CalonPasien = {
      fullName: input.fullName,
      birthDate: input.birthDate ?? null,
      gender: input.gender ?? null,
      nik: input.nik ?? null,
      phone: input.phone ?? null,
      motherName: input.motherName ?? null,
    };

    const dugaan = await this.cariDugaanGanda(schema, calon);
    const menahan = dugaan.filter((d) => d.blocking);

    if (menahan.length && !input.confirmedNotDuplicate) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Pasien ini kemungkinan besar sudah terdaftar.', {
        candidates: menahan.map((d) => ({
          patientId: d.patientId,
          fullName: d.fullName,
          birthDate: d.birthDate,
          mrn: d.mrn,
          score: d.score,
          reasons: d.reasons,
        })),
        hint:
          'Bila ini benar-benar orang yang berbeda, ulangi dengan confirmedNotDuplicate: true. ' +
          'Bila orang yang sama, pakai rekam medis yang sudah ada.',
      });
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const enterpriseId = `EP-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        Math.random() * 1e6,
      )
        .toString(36)
        .toUpperCase()}`;

      const confidence = keyakinanIdentitas({
        nikVerified: false,
        hasNik: Boolean(input.nik),
        hasBirthDate: Boolean(input.birthDate),
        selfRegistered: input.selfRegistered ?? false,
      });

      const pasien = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".patient
           (enterprise_patient_id, full_name, birth_date, birth_date_estimated, gender,
            phone, email, address_text, identity_confidence, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          enterpriseId,
          input.fullName.trim(),
          input.birthDate ?? null,
          input.birthDateEstimated ?? false,
          input.gender ?? null,
          input.phone ?? null,
          input.email ?? null,
          input.addressText ?? null,
          confidence,
          ctx.actorUserId,
        ],
      );
      const patientId = pasien.rows[0].id;

      // Nomor rekam medis per fasilitas.
      const fasilitas = await client.query<{ code: string }>(
        `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
        [input.facilityId],
      );
      const urutan = await client.query<{ n: string }>(
        `SELECT COUNT(*) + 1 AS n FROM "${schema}".patient_identifier
          WHERE facility_id = $1 AND identifier_type = 'MRN'`,
        [input.facilityId],
      );
      const mrn = susunNomorRekamMedis(
        fasilitas.rows[0]?.code ?? 'MRN',
        Number(urutan.rows[0].n),
      );

      await client.query(
        `INSERT INTO "${schema}".patient_identifier
           (patient_id, facility_id, identifier_type, identifier_value, created_by)
         VALUES ($1, $2, 'MRN', $3, $4)`,
        [patientId, input.facilityId, mrn, ctx.actorUserId],
      );

      if (input.nik) {
        await client.query(
          `INSERT INTO "${schema}".patient_identifier
             (patient_id, identifier_type, identifier_value, created_by)
           VALUES ($1, 'NIK', $2, $3)`,
          [patientId, input.nik, ctx.actorUserId],
        );
      }

      await client.query(
        `INSERT INTO "${schema}".patient_name_history (patient_id, full_name, changed_by)
         VALUES ($1, $2, $3)`,
        [patientId, input.fullName.trim(), ctx.actorUserId],
      );

      // Dugaan yang tidak menahan tetap dicatat untuk ditelaah petugas rekam
      // medis. Membuangnya berarti membuang satu-satunya petunjuk yang ada.
      for (const d of dugaan.filter((x) => x.score >= AMBANG_DUGAAN)) {
        await client.query(
          `INSERT INTO "${schema}".patient_potential_duplicate
             (patient_id, candidate_id, match_score, match_reason)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT DO NOTHING`,
          [patientId, d.patientId, d.score, JSON.stringify(d.reasons)],
        );
      }

      return { patientId, medicalRecordNumber: mrn, enterprisePatientId: enterpriseId };
    });
  }

  /** Mencari calon rekam medis ganda. */
  async cariDugaanGanda(schema: string, calon: CalonPasien) {
    /*
     * Penyaringan awal sengaja longgar: nama mirip ATAU tanggal lahir sama ATAU
     * telepon sama. Penilaian sesungguhnya dilakukan di memori oleh fungsi murni
     * yang dapat diuji. Menyaring terlalu ketat di SQL berarti penggandaan yang
     * nyata tidak pernah sampai ke penilainya.
     */
    const params: unknown[] = [normalkanNama(calon.fullName).split(' ')[0] ?? ''];
    const syarat = [`lower(p.full_name) LIKE '%' || $1 || '%'`];

    if (calon.birthDate) {
      params.push(calon.birthDate);
      syarat.push(`p.birth_date = $${params.length}`);
    }
    if (calon.phone) {
      params.push(normalkanTelepon(calon.phone));
      syarat.push(`regexp_replace(COALESCE(p.phone, ''), '\\D', '', 'g') = $${params.length}`);
    }
    if (calon.nik) {
      params.push(calon.nik);
      syarat.push(
        `EXISTS (SELECT 1 FROM "${schema}".patient_identifier i
                  WHERE i.patient_id = p.id AND i.identifier_type = 'NIK'
                    AND i.identifier_value = $${params.length})`,
      );
    }

    const kandidat = await this.tenantDb.query<{
      id: string;
      full_name: string;
      birth_date: string | null;
      gender: string | null;
      phone: string | null;
      nik: string | null;
      mrn: string | null;
    }>(
      schema,
      `SELECT p.id, p.full_name, p.birth_date::text, p.gender, p.phone,
              (SELECT i.identifier_value FROM "${schema}".patient_identifier i
                WHERE i.patient_id = p.id AND i.identifier_type = 'NIK' LIMIT 1) AS nik,
              (SELECT i.identifier_value FROM "${schema}".patient_identifier i
                WHERE i.patient_id = p.id AND i.identifier_type = 'MRN' LIMIT 1) AS mrn
         FROM "${schema}".patient p
        WHERE p.deleted_at IS NULL AND p.merged_into_id IS NULL
          AND (${syarat.join(' OR ')})
        LIMIT 50`,
      params,
    );

    return kandidat
      .map((k) => {
        const skor = skorPenggandaan(calon, {
          fullName: k.full_name,
          birthDate: k.birth_date,
          gender: (k.gender as CalonPasien['gender']) ?? null,
          nik: k.nik,
          phone: k.phone,
        });
        return {
          patientId: k.id,
          fullName: k.full_name,
          birthDate: k.birth_date,
          mrn: k.mrn,
          score: skor.score,
          reasons: skor.reasons,
          blocking: skor.blocking,
        };
      })
      .filter((d) => d.score >= AMBANG_DUGAAN)
      .sort((a, b) => b.score - a.score);
  }

  // --- Penggabungan ----------------------------------------------------------

  /**
   * Menggabungkan dua rekam medis.
   *
   * Tidak menghapus apa pun. Rekam sumber ditandai menunjuk induknya, sehingga
   * rujukan lama tetap dapat diikuti dan penggabungannya dapat dibatalkan.
   */
  async gabungkan(
    schema: string,
    input: { sourceId: string; targetId: string; reason: string },
    ctx: KonteksAkses,
  ) {
    const ambil = async (id: string) => {
      const rows = await this.tenantDb.query<{
        id: string;
        merged_into_id: string | null;
        deceased_at: string | null;
        nik: string | null;
      }>(
        schema,
        `SELECT p.id, p.merged_into_id, p.deceased_at::text,
                (SELECT i.identifier_value FROM "${schema}".patient_identifier i
                  WHERE i.patient_id = p.id AND i.identifier_type = 'NIK'
                    AND i.deleted_at IS NULL LIMIT 1) AS nik
           FROM "${schema}".patient p WHERE p.id = $1 AND p.deleted_at IS NULL`,
        [id],
      );
      if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, `Pasien ${id} tidak ditemukan.`);
      return rows[0];
    };

    const sumber = await ambil(input.sourceId);
    const tujuan = await ambil(input.targetId);

    const v = bolehGabung({
      sourceId: sumber.id,
      targetId: tujuan.id,
      sourceMergedInto: sumber.merged_into_id,
      targetMergedInto: tujuan.merged_into_id,
      sourceDeceasedAt: sumber.deceased_at,
      targetDeceasedAt: tujuan.deceased_at,
      sourceNik: sumber.nik,
      targetNik: tujuan.nik,
      reason: input.reason,
    });
    if (!v.allowed) {
      throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Penggabungan tidak diizinkan.');
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const dipindah: Record<string, number> = {};

      // Yang dipindahkan disimpan jumlahnya, supaya pembatalan tahu apa yang
      // harus dikembalikan.
      for (const tabel of [
        'patient_identifier',
        'health_registration',
        'health_appointment',
        'health_encounter',
        'patient_allergy',
        'vital_sign',
        'clinical_note',
        'encounter_diagnosis',
        'clinical_order',
      ]) {
        const ada = await client.query(
          `SELECT 1 FROM information_schema.tables
            WHERE table_schema = $1 AND table_name = $2`,
          [schema, tabel],
        );
        if (!ada.rowCount) continue;

        const hasil = await client.query(
          `UPDATE "${schema}"."${tabel}" SET patient_id = $2 WHERE patient_id = $1`,
          [input.sourceId, input.targetId],
        );
        if (hasil.rowCount) dipindah[tabel] = hasil.rowCount;
      }

      await client.query(
        `UPDATE "${schema}".patient
            SET merged_into_id = $2, merged_at = now(), is_active = FALSE,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.sourceId, input.targetId],
      );

      const merge = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".patient_merge
           (source_patient_id, target_patient_id, reason, moved_summary, merged_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [input.sourceId, input.targetId, input.reason, JSON.stringify(dipindah), ctx.actorUserId],
      );

      await client.query(
        `UPDATE "${schema}".patient_potential_duplicate
            SET status = 'MERGED', reviewed_at = now(), reviewed_by = $3
          WHERE (patient_id = $1 AND candidate_id = $2) OR (patient_id = $2 AND candidate_id = $1)`,
        [input.sourceId, input.targetId, ctx.actorUserId],
      );

      this.logger.log(
        `Rekam medis ${input.sourceId} digabungkan ke ${input.targetId} pada ${schema}`,
      );
      return { mergeId: merge.rows[0].id, moved: dipindah };
    });
  }

  /** Daftar dugaan penggandaan yang menunggu telaah. */
  async dugaanGanda(schema: string, limit = 50) {
    return this.tenantDb.query(
      schema,
      `SELECT d.id, d.match_score, d.match_reason, d.status, d.created_at,
              a.id AS patient_id, a.full_name AS patient_name, a.birth_date AS patient_birth,
              b.id AS candidate_id, b.full_name AS candidate_name, b.birth_date AS candidate_birth
         FROM "${schema}".patient_potential_duplicate d
         JOIN "${schema}".patient a ON a.id = d.patient_id
         JOIN "${schema}".patient b ON b.id = d.candidate_id
        WHERE d.status = 'OPEN'
        ORDER BY d.match_score DESC, d.created_at
        LIMIT $1`,
      [Math.min(Math.max(limit, 1), 200)],
    );
  }

  /** Menyatakan dua rekam medis BUKAN orang yang sama. */
  async tandaiBukanGanda(schema: string, id: string, note: string, ctx: KonteksAkses) {
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".patient_potential_duplicate
          SET status = 'NOT_DUPLICATE', reviewed_at = now(), reviewed_by = $2, review_note = $3
        WHERE id = $1 AND status = 'OPEN'`,
      [id, ctx.actorUserId, note],
    );
    return { id, status: 'NOT_DUPLICATE' };
  }

  // --- Alergi ----------------------------------------------------------------

  async catatAlergi(
    schema: string,
    patientId: string,
    input: {
      allergenType: string;
      allergenName: string;
      severity?: string;
      certainty?: string;
      reaction?: string;
    },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".patient_allergy
         (patient_id, allergen_type, allergen_name, severity, certainty, reaction, recorded_by)
       VALUES ($1, $2, $3, COALESCE($4,'UNKNOWN'), COALESCE($5,'REPORTED'), $6, $7)
       RETURNING id`,
      [
        patientId,
        input.allergenType,
        input.allergenName,
        input.severity ?? null,
        input.certainty ?? null,
        input.reaction ?? null,
        ctx.actorUserId,
      ],
    );
    return rows[0];
  }

  /** Jejak pembacaan rekam medis seorang pasien. */
  async jejakAkses(schema: string, patientId: string, limit = 100) {
    return this.tenantDb.query(
      schema,
      `SELECT id, actor_user_id, purpose_of_use, entity_type, action,
              break_glass, break_glass_reason, occurred_at
         FROM "${schema}".health_access_log
        WHERE patient_id = $1
        ORDER BY occurred_at DESC
        LIMIT $2`,
      [patientId, Math.min(Math.max(limit, 1), 500)],
    );
  }
}
