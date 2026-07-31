/**
 * Profil, legalitas, dan kebijakan koperasi — sisi basis datanya.
 *
 * Aturannya ada pada `cooperative-profile.ts` sebagai fungsi murni; berkas ini
 * mengambil keadaan, memanggil aturan itu, lalu menuliskan hasilnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehPindahStatus,
  periksaKesiapan,
  slugSah,
  susunSlug,
  type CooperativeStatus,
  type Kekurangan,
} from './cooperative-profile';

export interface BarisKoperasi {
  id: string;
  code: string;
  name: string;
  slug: string;
  status: string;
  cooperative_type_id: string | null;
  legal_entity_number: string | null;
  legal_entity_date: string | null;
  [k: string]: unknown;
}

@Injectable()
export class CooperativeProfileService {
  private readonly logger = new Logger(CooperativeProfileService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Profil koperasi tenant ini.
   *
   * Mengembalikan `null` bila belum ada, bukan melempar. Ruang kerja yang baru
   * disiapkan memang belum punya profil koperasi, dan antarmuka perlu
   * membedakan "belum diisi" dari "gagal dibaca".
   */
  async profil(schemaName: string): Promise<BarisKoperasi | null> {
    const rows = await this.tenantDb.query<BarisKoperasi>(
      schemaName,
      `SELECT c.*, t.code AS type_code, t.name AS type_name,
              t.allows_lending, t.allows_retail, t.is_sharia
         FROM "${schemaName}".cooperative c
    LEFT JOIN "${schemaName}".cooperative_type t ON t.id = c.cooperative_type_id
        WHERE c.deleted_at IS NULL
        LIMIT 1`,
    );
    return rows[0] ?? null;
  }

  private async wajibAda(schemaName: string): Promise<BarisKoperasi> {
    const k = await this.profil(schemaName);
    if (!k) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Profil koperasi belum dibuat. Lengkapi profil terlebih dahulu sebelum melanjutkan.',
      );
    }
    return k;
  }

  async buat(
    schemaName: string,
    input: {
      name: string;
      shortName?: string;
      slug?: string;
      cooperativeTypeId?: string;
      level?: string;
      membershipScope?: string;
      phone?: string;
      email?: string;
    },
    userId: string,
  ) {
    const ada = await this.profil(schemaName);
    if (ada) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Ruang kerja ini sudah memiliki profil koperasi. Satu ruang kerja hanya untuk satu koperasi.',
      );
    }

    const slug = input.slug?.trim() || susunSlug(input.name);
    const v = slugSah(slug);
    if (!v.allowed) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.message ?? 'Slug tidak sah.');
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".cooperative
         (code, name, short_name, slug, cooperative_type_id, level, membership_scope,
          phone, email, status, created_by)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'PRIMARY'), COALESCE($7, 'OPEN'),
               $8, $9, 'DRAFT', $10)
       RETURNING id`,
      [
        slug.toUpperCase().slice(0, 48),
        input.name,
        input.shortName ?? null,
        slug,
        input.cooperativeTypeId ?? null,
        input.level ?? null,
        input.membershipScope ?? null,
        input.phone ?? null,
        input.email ?? null,
        userId,
      ],
    );

    // Subdomain dibuat sekaligus: koperasi tanpa alamat daring tidak dapat
    // menerima pengajuan calon anggota, dan itu langkah pertama setelah profil.
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO "${schemaName}".cooperative_domain
         (cooperative_id, domain, domain_type, is_primary, verified_at, created_by)
       VALUES ($1, $2, 'SUBDOMAIN', TRUE, now(), $3)
       ON CONFLICT DO NOTHING`,
      [rows[0].id, `${slug}.ekoperasi.id`, userId],
    );

    return this.profil(schemaName);
  }

  async perbarui(
    schemaName: string,
    input: Record<string, unknown>,
    userId: string,
  ) {
    const k = await this.wajibAda(schemaName);

    const bolehDiubah = [
      'name', 'short_name', 'description', 'cooperative_type_id', 'level',
      'membership_scope', 'establishment_date', 'legal_entity_number',
      'legal_entity_date', 'tax_number', 'phone', 'email', 'website', 'logo_file_id',
    ];
    const set: string[] = [];
    const nilai: unknown[] = [k.id];
    for (const [kunci, isi] of Object.entries(input)) {
      const kolom = kunci.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
      if (!bolehDiubah.includes(kolom)) continue;
      nilai.push(isi === '' ? null : isi);
      set.push(`${kolom} = $${nilai.length}`);
    }
    if (!set.length) return this.profil(schemaName);

    nilai.push(userId);
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".cooperative
          SET ${set.join(', ')}, updated_at = now(), updated_by = $${nilai.length},
              version = version + 1
        WHERE id = $1`,
      nilai,
    );
    return this.profil(schemaName);
  }

  /**
   * Apa yang masih kurang sebelum koperasi dapat melayani anggota.
   *
   * Dipanggil antarmuka sebagai daftar periksa, dan dipanggil `goLive()`
   * sebagai penjaga. Satu sumber kebenaran untuk keduanya — daftar periksa yang
   * berbeda dari penjaganya akan membuat pengguna melihat "lengkap" lalu
   * ditolak.
   */
  async kesiapan(schemaName: string): Promise<{ ready: boolean; missing: Kekurangan[] }> {
    const k = await this.wajibAda(schemaName);

    const [alamat, wilayah, kebijakan, dokumen] = await Promise.all([
      this.tenantDb.query<{ n: string }>(
        schemaName,
        `SELECT count(*)::text AS n FROM "${schemaName}".cooperative_address
          WHERE cooperative_id = $1 AND is_primary = TRUE AND deleted_at IS NULL`,
        [k.id],
      ),
      this.tenantDb.query<{ n: string }>(
        schemaName,
        `SELECT count(*)::text AS n FROM "${schemaName}".cooperative_service_area
          WHERE cooperative_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [k.id],
      ),
      this.tenantDb.query<{ policy_type: string }>(
        schemaName,
        `SELECT DISTINCT policy_type FROM "${schemaName}".cooperative_policy
          WHERE cooperative_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [k.id],
      ),
      this.tenantDb.query<{ document_type: string }>(
        schemaName,
        `SELECT DISTINCT document_type FROM "${schemaName}".cooperative_legal_document
          WHERE cooperative_id = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [k.id],
      ),
    ]);

    const missing = periksaKesiapan({
      legalEntityNumber: k.legal_entity_number,
      legalEntityDate: k.legal_entity_date,
      cooperativeTypeId: k.cooperative_type_id,
      hasPrimaryAddress: Number(alamat[0].n) > 0,
      hasServiceArea: Number(wilayah[0].n) > 0,
      activePolicyCodes: kebijakan.map((r) => r.policy_type),
      documentTypes: dokumen.map((r) => r.document_type),
    });

    return { ready: missing.length === 0, missing };
  }

  /** Mengubah status koperasi, dengan penjagaan kesiapan saat menuju ACTIVE. */
  async pindahStatus(
    schemaName: string,
    ke: CooperativeStatus,
    alasan: string,
    userId: string,
  ) {
    const k = await this.wajibAda(schemaName);
    const v = bolehPindahStatus(k.status as CooperativeStatus, ke);
    if (!v.allowed) {
      throw AppError.conflict(ErrorCodes.CONFLICT, v.message ?? 'Perpindahan status tidak sah.');
    }

    if (ke === 'ACTIVE') {
      const { ready, missing } = await this.kesiapan(schemaName);
      if (!ready) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Koperasi belum dapat diaktifkan. ${missing.length} hal masih perlu dilengkapi.`,
          { missing },
        );
      }
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".cooperative
          SET status = $2::varchar,
              went_live_at = CASE WHEN $2::varchar = 'ACTIVE' AND went_live_at IS NULL
                                  THEN now() ELSE went_live_at END,
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1`,
      [k.id, ke, userId],
    );
    this.logger.log(`Koperasi ${k.slug} berpindah ${k.status} -> ${ke}: ${alasan}`);
    return this.profil(schemaName);
  }

  // --- Legalitas, wilayah, kebijakan ----------------------------------------

  async daftarDokumen(schemaName: string) {
    const k = await this.wajibAda(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, document_type, document_number, document_date::text, issued_by,
              valid_from::text, valid_until::text, file_id, note,
              (valid_until IS NOT NULL AND valid_until < CURRENT_DATE) AS expired
         FROM "${schemaName}".cooperative_legal_document
        WHERE cooperative_id = $1 AND deleted_at IS NULL
        ORDER BY document_type, document_date DESC NULLS LAST`,
      [k.id],
    );
  }

  async tambahDokumen(schemaName: string, input: Record<string, unknown>, userId: string) {
    const k = await this.wajibAda(schemaName);
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".cooperative_legal_document
         (cooperative_id, document_type, document_number, document_date, issued_by,
          valid_from, valid_until, file_id, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        k.id,
        input.documentType,
        input.documentNumber,
        input.documentDate ?? null,
        input.issuedBy ?? null,
        input.validFrom ?? null,
        input.validUntil ?? null,
        input.fileId ?? null,
        input.note ?? null,
        userId,
      ],
    );
    return { id: rows[0].id };
  }

  async daftarWilayah(schemaName: string) {
    const k = await this.wajibAda(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, area_type, area_code, area_name, note
         FROM "${schemaName}".cooperative_service_area
        WHERE cooperative_id = $1 AND deleted_at IS NULL
        ORDER BY area_type, area_name`,
      [k.id],
    );
  }

  async tambahWilayah(schemaName: string, input: Record<string, unknown>, userId: string) {
    const k = await this.wajibAda(schemaName);
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".cooperative_service_area
         (cooperative_id, area_type, area_code, area_name, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [k.id, input.areaType, input.areaCode ?? null, input.areaName, input.note ?? null, userId],
    );
    return { id: rows[0].id };
  }

  async daftarKebijakan(schemaName: string) {
    const k = await this.wajibAda(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, policy_type, code, name, version_no, status,
              effective_from::text, effective_until::text, approved_at,
              approved_by_meeting_id, content
         FROM "${schemaName}".cooperative_policy
        WHERE cooperative_id = $1 AND deleted_at IS NULL
        ORDER BY policy_type, code, version_no DESC`,
      [k.id],
    );
  }

  /**
   * Menetapkan kebijakan baru.
   *
   * Versi baru, bukan penyuntingan versi lama. SHU dihitung menurut kebijakan
   * yang berlaku pada periode bukunya; kebijakan yang disunting di tempat akan
   * membuat perhitungan tahun lalu tidak dapat diulang.
   */
  async tetapkanKebijakan(schemaName: string, input: Record<string, unknown>, userId: string) {
    const k = await this.wajibAda(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const versi = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(version_no), 0) + 1 AS n
           FROM "${schemaName}".cooperative_policy
          WHERE cooperative_id = $1 AND code = $2`,
        [k.id, input.code],
      );

      // Versi lama yang masih aktif ditandai digantikan, bukan dihapus.
      await client.query(
        `UPDATE "${schemaName}".cooperative_policy
            SET status = 'SUPERSEDED',
                effective_until = COALESCE(effective_until, ($3::date - 1)),
                updated_at = now(), updated_by = $4, version = version + 1
          WHERE cooperative_id = $1 AND code = $2 AND status = 'ACTIVE' AND deleted_at IS NULL`,
        [k.id, input.code, input.effectiveFrom, userId],
      );

      const disisipkan = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".cooperative_policy
           (cooperative_id, policy_type, code, name, version_no, content,
            document_file_id, effective_from, effective_until, status, created_by)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), $7, $8, $9, 'DRAFT', $10)
         RETURNING id`,
        [
          k.id,
          input.policyType,
          input.code,
          input.name,
          Number(versi.rows[0].n),
          input.content ? JSON.stringify(input.content) : null,
          input.documentFileId ?? null,
          input.effectiveFrom,
          input.effectiveUntil ?? null,
          userId,
        ],
      );
      return { id: disisipkan.rows[0].id, versionNo: Number(versi.rows[0].n) };
    });
  }

  /**
   * Mengesahkan kebijakan.
   *
   * Kebijakan yang mengubah hak anggota — AD/ART, aturan keanggotaan, rumus SHU
   * — sah hanya setelah diputuskan RAT. Tautan keputusannya wajib disertakan
   * untuk ketiga jenis itu; K-5 yang akan mengisi keputusannya.
   */
  async sahkanKebijakan(
    schemaName: string,
    policyId: string,
    meetingDecisionId: string | null,
    userId: string,
  ) {
    const k = await this.wajibAda(schemaName);
    const rows = await this.tenantDb.query<{ policy_type: string; status: string }>(
      schemaName,
      `SELECT policy_type, status FROM "${schemaName}".cooperative_policy
        WHERE id = $1 AND cooperative_id = $2 AND deleted_at IS NULL`,
      [policyId, k.id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kebijakan tidak ditemukan.');
    if (rows[0].status === 'ACTIVE') {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Kebijakan ini sudah berlaku.');
    }

    const perluRat = ['BYLAW', 'MEMBERSHIP_RULE', 'SHU_POLICY'];
    if (perluRat.includes(rows[0].policy_type) && !meetingDecisionId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Kebijakan ini mengubah hak anggota dan hanya sah setelah diputuskan Rapat Anggota. Sertakan keputusan RAT-nya.',
      );
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".cooperative_policy
          SET status = 'ACTIVE', approved_at = now(), approved_by_meeting_id = $2,
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1`,
      [policyId, meetingDecisionId, userId],
    );
    return { id: policyId, status: 'ACTIVE' };
  }

  async daftarJenis(schemaName: string) {
    return this.tenantDb.query(
      schemaName,
      `SELECT id, code, name, description, allows_lending, allows_retail, is_sharia
         FROM "${schemaName}".cooperative_type
        WHERE deleted_at IS NULL AND is_active = TRUE
        ORDER BY sort_order, name`,
    );
  }
}
