/**
 * Penyelesai cakupan data.
 *
 * Menutup celah yang disebut terbuka pada D-2: `cakupan()` di controller
 * mengembalikan `UNIT` bagi semua orang, sehingga Ketua RT masih melihat
 * seluruh desa.
 *
 * ## Bawaannya menutup, bukan membuka
 *
 * Bila cakupan seseorang tidak dapat ditentukan — penugasannya belum diisi,
 * perannya tidak dikenal, atau identitas tenant-nya tidak ditemukan — ia
 * memperoleh `NONE`. Bukan `UNIT`.
 *
 * Bawaan yang longgar pada data kependudukan berarti pengguna yang penugasannya
 * belum sempat diisi melihat seluruh warga desa, dan tidak ada yang menyadarinya
 * karena tidak ada yang error. Bawaan yang ketat menghasilkan keluhan pada hari
 * pertama — dan keluhan jauh lebih baik daripada kebocoran yang senyap.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AuthenticatedUser } from '../../common/decorators';
import { VILLAGE_ROLES } from './catalog/village-role.catalog';
import {
  cakupanEfektif,
  keteranganCakupan,
  type CakupanEfektif,
  type PenugasanCakupan,
  type TingkatCakupan,
} from './village-officer';
import type { CakupanWilayah } from './village-resident.service';

@Injectable()
export class VillageScopeService {
  private readonly logger = new Logger(VillageScopeService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Identitas tenant dari identitas control plane.
   *
   * Diselesaikan di satu tempat. Cacat yang pernah ditemukan pada POS berawal
   * dari dua tempat memakai id berbeda tanpa ada yang menyadarinya: kuerinya
   * berhasil dan mengembalikan nol baris.
   */
  private async subjectId(schemaName: string, platformUserId: string): Promise<string | null> {
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `SELECT id FROM "${schemaName}".user_subject
        WHERE platform_user_id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
        LIMIT 1`,
      [platformUserId],
    );
    return rows[0]?.id ?? null;
  }

  /**
   * Cakupan bawaan dari peran aktif pengguna.
   *
   * Hanya peran village yang diperhitungkan. Peran Core — misalnya OWNER —
   * tidak memberi cakupan kependudukan: memiliki bisnis tidak sama dengan
   * berwenang membaca data penduduk.
   */
  private async bawaanPeran(
    schemaName: string,
    subjectId: string,
    activeRoleId: string | null,
  ): Promise<TingkatCakupan | null> {
    const rows = await this.tenantDb.query<{ code: string }>(
      schemaName,
      `SELECT r.code
         FROM "${schemaName}".user_role_assignment a
         JOIN "${schemaName}".role r ON r.id = a.role_id
        WHERE a.user_subject_id = $1
          AND a.revoked_at IS NULL
          AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
          AND ($2::uuid IS NULL OR a.role_id = $2::uuid)`,
      [subjectId, activeRoleId],
    );

    const kode = new Set(rows.map((r) => r.code));
    const cocok = VILLAGE_ROLES.filter((r) => kode.has(r.code));
    if (!cocok.length) return null;

    // Bila pengguna memegang beberapa peran village, yang terluas berlaku.
    const urutan: TingkatCakupan[] = ['UNIT', 'SUB_AREA', 'RW', 'RT', 'SELF', 'AGGREGATE_ONLY', 'NONE'];
    for (const tingkat of urutan) {
      if (cocok.some((r) => r.defaultScope === tingkat)) return tingkat;
    }
    return null;
  }

  /**
   * Cakupan efektif pengguna pada tanggal hari ini.
   *
   * Mengembalikan bentuk yang dipakai `VillageResidentService`, beserta
   * keterangan yang dapat ditampilkan kepada pengguna. Pengguna yang tidak
   * melihat data perlu tahu sebabnya — "tidak ada data" dan "Anda tidak
   * berwenang" adalah dua hal yang sangat berbeda.
   */
  async cakupanUntuk(
    schemaName: string,
    user: AuthenticatedUser,
  ): Promise<CakupanWilayah & { keterangan: string; sumber: CakupanEfektif['sumber'] }> {
    const subject = await this.subjectId(schemaName, user.userId);
    if (!subject) {
      /*
       * Pengguna control plane yang belum punya identitas pada tenant ini.
       * Terjadi pada staf platform yang membuka tenant untuk keperluan
       * dukungan. Ia tidak memperoleh data kependudukan sama sekali — dan itu
       * benar: keperluan dukungan teknis tidak menuntut membaca data warga.
       */
      this.logger.debug(`Pengguna ${user.userId} tidak punya identitas pada ${schemaName}`);
      const c: CakupanEfektif = { level: 'NONE', sumber: 'BAWAAN_TERKUNCI' };
      return { level: 'NONE', keterangan: keteranganCakupan(c), sumber: c.sumber };
    }

    const penugasan = await this.tenantDb.query<{
      scope_type: string;
      scope_id: string | null;
      valid_from: string;
      valid_until: string | null;
      revoked_at: string | null;
    }>(
      schemaName,
      `SELECT scope_type, scope_id, valid_from::text, valid_until::text, revoked_at::text
         FROM "${schemaName}".village_scope_assignment
        WHERE user_subject_id = $1`,
      [subject],
    );

    const bawaan = await this.bawaanPeran(schemaName, subject, user.activeRoleId ?? null);
    const hariIni = new Date().toISOString().slice(0, 10);

    const efektif = cakupanEfektif(
      penugasan.map(
        (p): PenugasanCakupan => ({
          scopeType: p.scope_type as PenugasanCakupan['scopeType'],
          scopeId: p.scope_id,
          validFrom: p.valid_from,
          validUntil: p.valid_until,
          revokedAt: p.revoked_at,
        }),
      ),
      bawaan,
      hariIni,
    );

    return {
      level: efektif.level,
      subAreaId: efektif.subAreaId ?? null,
      rwId: efektif.rwId ?? null,
      rtId: efektif.rtId ?? null,
      residentId: efektif.residentId ?? null,
      keterangan: keteranganCakupan(efektif),
      sumber: efektif.sumber,
    };
  }

  /**
   * Menugaskan cakupan wilayah kepada seorang pengguna.
   *
   * Penugasan yang sama diperbarui, bukan digandakan — indeks unik parsial
   * menegakkannya, dan tanpa `ON CONFLICT` penugasan kedua akan gagal dengan
   * pesan basis data yang tidak berguna bagi administrator desa.
   */
  async tugaskan(
    schemaName: string,
    input: {
      userSubjectId: string;
      scopeType: PenugasanCakupan['scopeType'];
      scopeId?: string | null;
      validUntil?: string | null;
      note?: string;
    },
    userId: string,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_scope_assignment
         (user_subject_id, scope_type, scope_id, valid_until, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_subject_id, scope_type,
                    COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
         WHERE revoked_at IS NULL
       DO UPDATE SET valid_until = EXCLUDED.valid_until,
                     note = EXCLUDED.note,
                     version = village_scope_assignment.version + 1
       RETURNING id`,
      [
        input.userSubjectId,
        input.scopeType,
        input.scopeId ?? null,
        input.validUntil ?? null,
        input.note ?? null,
        userId,
      ],
    );
    return { id: rows[0].id };
  }

  /** Mencabut penugasan. Dicabut, bukan dihapus — riwayatnya bagian dari audit. */
  async cabut(schemaName: string, id: string, alasan: string, userId: string) {
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_scope_assignment
          SET revoked_at = now(), revoked_by = $2, revoke_reason = $3, version = version + 1
        WHERE id = $1 AND revoked_at IS NULL`,
      [id, userId, alasan],
    );
    return { id, revoked: true };
  }
}
