/**
 * Kependudukan: penduduk, keluarga, dan peristiwa.
 *
 * Dua hal yang membedakan layanan ini dari layanan CRUD biasa:
 *
 * 1. **Cakupan data ditegakkan pada kueri.** Ketua RT memperoleh warganya saja
 *    karena `WHERE`-nya menyaring — bukan karena antarmuka menyembunyikan
 *    sisanya. Penyaringan di antarmuka dapat dilewati dengan memanggil endpoint
 *    langsung.
 *
 * 2. **Setiap pembacaan dicatat.** Menyimpang dari kebiasaan modul lain, dan
 *    disengaja: pada kependudukan penyalahgunaan berbentuk pembacaan — membuka
 *    data tetangga, menyalin daftar penerima bantuan menjelang pemilihan. Audit
 *    yang hanya mencatat perubahan tidak akan pernah melihatnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  bolehSimpanNik,
  bolehSuntingPenduduk,
  cariDuplikat,
  normalkanNama,
  periksaNik,
  periksaSusunanKeluarga,
  statusSesudahPeristiwa,
  type PeristiwaKependudukan,
  type StatusPenduduk,
} from './village-resident';

/** Cakupan wilayah seorang pengguna. */
export interface CakupanWilayah {
  level: 'UNIT' | 'SUB_AREA' | 'RW' | 'RT' | 'SELF' | 'AGGREGATE_ONLY' | 'NONE';
  subAreaId?: string | null;
  rwId?: string | null;
  rtId?: string | null;
  /** Untuk cakupan SELF: penduduk yang bersangkutan. */
  residentId?: string | null;
}

@Injectable()
export class VillageResidentService {
  private readonly logger = new Logger(VillageResidentService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  /**
   * Potongan `WHERE` yang menegakkan cakupan.
   *
   * Mengembalikan SQL beserta parameternya, bukan menyaring hasil. Perbedaannya
   * menentukan: penyaringan hasil masih membaca seluruh baris dari basis data,
   * dan satu `console.log` yang tertinggal akan membocorkan yang seharusnya
   * tidak terlihat.
   */
  private penyaringCakupan(
    alias: string,
    cakupan: CakupanWilayah,
    mulaiParam: number,
  ): { sql: string; params: unknown[] } {
    switch (cakupan.level) {
      case 'UNIT':
        return { sql: '', params: [] };
      case 'RT':
        if (!cakupan.rtId) return { sql: ' AND FALSE', params: [] };
        return { sql: ` AND ${alias}.village_rt_id = $${mulaiParam}`, params: [cakupan.rtId] };
      case 'RW':
        if (!cakupan.rwId) return { sql: ' AND FALSE', params: [] };
        return {
          sql: ` AND ${alias}.village_rt_id IN (SELECT id FROM village_rt WHERE village_rw_id = $${mulaiParam})`,
          params: [cakupan.rwId],
        };
      case 'SUB_AREA':
        if (!cakupan.subAreaId) return { sql: ' AND FALSE', params: [] };
        return {
          sql:
            ` AND ${alias}.village_rt_id IN (SELECT t.id FROM village_rt t ` +
            `JOIN village_rw w ON w.id = t.village_rw_id WHERE w.sub_area_id = $${mulaiParam})`,
          params: [cakupan.subAreaId],
        };
      case 'SELF':
        // Dirinya dan seluruh anggota kartu keluarganya.
        if (!cakupan.residentId) return { sql: ' AND FALSE', params: [] };
        return {
          sql:
            ` AND (${alias}.id = $${mulaiParam} OR ${alias}.village_family_id = ` +
            `(SELECT village_family_id FROM village_resident WHERE id = $${mulaiParam}))`,
          params: [cakupan.residentId],
        };
      case 'AGGREGATE_ONLY':
      case 'NONE':
      default:
        // BPD mengawasi, tidak menyelidiki. Linmas menjaga ketertiban, tidak
        // mendata. Keduanya tidak memperoleh baris perorangan sama sekali.
        return { sql: ' AND FALSE', params: [] };
    }
  }

  /** Mencatat pembacaan. Gagal mencatat tidak menggagalkan pembacaannya. */
  private async catatAkses(
    schemaName: string,
    input: {
      residentId?: string | null;
      actorUserId: string;
      activeRoleId?: string | null;
      accessType: 'DETAIL' | 'LIST' | 'SEARCH' | 'EXPORT' | 'PRINT';
      surface?: string;
      recordCount?: number;
      purpose?: string;
    },
  ): Promise<void> {
    try {
      await this.tenantDb.query(
        schemaName,
        `INSERT INTO "${schemaName}".village_resident_access_log
           (village_resident_id, actor_user_id, active_role_id, access_type,
            surface, record_count, purpose)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          input.residentId ?? null,
          input.actorUserId,
          input.activeRoleId ?? null,
          input.accessType,
          input.surface ?? null,
          input.recordCount ?? 1,
          input.purpose ?? null,
        ],
      );
    } catch (e) {
      /*
       * Gagal mencatat tidak boleh menghalangi petugas melayani warga yang
       * sedang berdiri di depannya. Dicatat sebagai peringatan supaya
       * kegagalannya tetap terlihat.
       */
      this.logger.warn(`Jejak akses penduduk gagal dicatat pada ${schemaName}: ${(e as Error).message}`);
    }
  }

  // --- Membaca --------------------------------------------------------------

  async daftar(
    schemaName: string,
    filter: { q?: string; rtId?: string; status?: StatusPenduduk; limit?: number; offset?: number },
    cakupan: CakupanWilayah,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.WARGA');
    const u = await this.unit.unit(schemaName);

    const params: unknown[] = [u.id];
    let sql =
      `SELECT r.id, r.national_id, r.national_id_flagged, r.full_name, r.gender,
              r.birth_date::text, r.resident_status, r.family_relation,
              r.village_rt_id, t.number AS rt_number, w.number AS rw_number
         FROM "${schemaName}".village_resident r
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE r.village_unit_id = $1 AND r.deleted_at IS NULL`;

    const c = this.penyaringCakupan('r', cakupan, params.length + 1);
    sql += c.sql.replace(/village_rt/g, `"${schemaName}".village_rt`)
                .replace(/village_rw/g, `"${schemaName}".village_rw`)
                .replace(/village_resident/g, `"${schemaName}".village_resident`);
    params.push(...c.params);

    if (filter.q) {
      params.push(`%${normalkanNama(filter.q)}%`, `%${filter.q}%`);
      sql += ` AND (r.normalized_name LIKE $${params.length - 1} OR r.national_id LIKE $${params.length})`;
    }
    if (filter.rtId) {
      params.push(filter.rtId);
      sql += ` AND r.village_rt_id = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      sql += ` AND r.resident_status = $${params.length}`;
    }

    params.push(Math.min(filter.limit ?? 50, 200), filter.offset ?? 0);
    sql += ` ORDER BY r.full_name LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaName, sql, params);

    await this.catatAkses(schemaName, {
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId,
      accessType: filter.q ? 'SEARCH' : 'LIST',
      surface: 'village/residents',
      recordCount: rows.length,
    });

    return rows;
  }

  async detail(
    schemaName: string,
    id: string,
    cakupan: CakupanWilayah,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.WARGA');
    const u = await this.unit.unit(schemaName);

    const params: unknown[] = [u.id, id];
    const c = this.penyaringCakupan('r', cakupan, 3);
    const sql =
      `SELECT r.* FROM "${schemaName}".village_resident r
        WHERE r.village_unit_id = $1 AND r.id = $2 AND r.deleted_at IS NULL` +
      c.sql
        .replace(/village_rt/g, `"${schemaName}".village_rt`)
        .replace(/village_rw/g, `"${schemaName}".village_rw`)
        .replace(/village_resident/g, `"${schemaName}".village_resident`);
    params.push(...c.params);

    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaName, sql, params);
    if (!rows.length) {
      // Pesan yang sama untuk "tidak ada" dan "di luar cakupan". Membedakannya
      // akan memberi tahu bahwa penduduk itu ADA di RT lain — dan itu sendiri
      // sudah kebocoran.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penduduk tidak ditemukan.');
    }

    await this.catatAkses(schemaName, {
      residentId: id,
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId,
      accessType: 'DETAIL',
      surface: 'village/residents/:id',
    });

    return rows[0];
  }

  // --- Menulis --------------------------------------------------------------

  async buat(
    schemaName: string,
    input: {
      nationalId?: string;
      fullName: string;
      birthPlace?: string;
      birthDate?: string;
      gender?: 'L' | 'P';
      familyId?: string;
      familyRelation?: string;
      rtId?: string;
      maritalStatus?: string;
    },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.WARGA');
    const u = await this.unit.unit(schemaName);

    let ditandai = false;
    let catatanNik: string | null = null;
    if (input.nationalId) {
      const boleh = bolehSimpanNik(input.nationalId);
      if (!boleh.boleh) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, boleh.alasan!);
      }
      const p = periksaNik(input.nationalId);
      ditandai = !p.valid;
      catatanNik = p.peringatan.length ? p.peringatan.join(' ') : null;
    }

    const nik = input.nationalId?.replace(/\s/g, '') ?? null;
    const normal = normalkanNama(input.fullName);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_resident
         (village_unit_id, village_family_id, family_relation, national_id,
          national_id_flagged, national_id_notes, full_name, normalized_name,
          birth_place, birth_date, gender, marital_status, village_rt_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        u.id,
        input.familyId ?? null,
        input.familyRelation ?? null,
        nik,
        ditandai,
        catatanNik,
        input.fullName,
        normal,
        input.birthPlace ?? null,
        input.birthDate ?? null,
        input.gender ?? null,
        input.maritalStatus ?? null,
        input.rtId ?? null,
        user.userId,
      ],
    );
    const id = rows[0].id;

    // Penandaan duplikat dijalankan sesudah penyimpanan, bukan sebelumnya.
    // Menolak lebih dahulu akan menghalangi pendataan warga yang datanya memang
    // bermasalah — padahal justru merekalah yang paling perlu dibantu.
    await this.tandaiDuplikat(schemaName, u.id, {
      id,
      nik: nik ?? '',
      nama: input.fullName,
      tanggalLahir: input.birthDate ?? null,
    });

    return { id, nationalIdFlagged: ditandai, nationalIdNotes: catatanNik };
  }

  private async tandaiDuplikat(
    schemaName: string,
    unitId: string,
    baru: { id: string; nik: string; nama: string; tanggalLahir: string | null },
  ) {
    const yangAda = await this.tenantDb.query<{
      id: string;
      national_id: string | null;
      full_name: string;
      birth_date: string | null;
    }>(
      schemaName,
      `SELECT id, national_id, full_name, birth_date::text
         FROM "${schemaName}".village_resident
        WHERE village_unit_id = $1 AND id <> $2 AND deleted_at IS NULL
          AND (national_id = $3 OR normalized_name = $4)`,
      [unitId, baru.id, baru.nik || null, normalkanNama(baru.nama)],
    );

    const temuan = cariDuplikat(
      { nik: baru.nik, nama: baru.nama, tanggalLahir: baru.tanggalLahir },
      yangAda.map((r) => ({
        id: r.id,
        nik: r.national_id ?? '',
        nama: r.full_name,
        tanggalLahir: r.birth_date,
      })),
    );

    for (const t of temuan) {
      await this.tenantDb.query(
        schemaName,
        `INSERT INTO "${schemaName}".village_resident_duplicate
           (village_resident_id, matched_resident_id, reason, confidence)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [baru.id, t.residentId, t.alasan, t.keyakinan],
      );
    }
    if (temuan.length) {
      this.logger.log(`${temuan.length} kemungkinan duplikat ditandai untuk penduduk ${baru.id}`);
    }
  }

  /**
   * Menyunting data penduduk.
   *
   * Setiap medan yang berubah menghasilkan satu baris riwayat beserta alasan
   * dan rujukan dokumennya. Pertanyaan "sejak kapan alamatnya begini, dan atas
   * dasar surat apa" adalah pertanyaan yang pasti muncul di kantor desa.
   */
  async sunting(
    schemaName: string,
    id: string,
    perubahan: Record<string, string | null>,
    konteks: { reason: string; documentReference?: string; effectiveDate?: string },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.WARGA');

    const lama = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT * FROM "${schemaName}".village_resident WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!lama.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penduduk tidak ditemukan.');

    const boleh = bolehSuntingPenduduk(lama[0].resident_status as StatusPenduduk);
    if (!boleh.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, boleh.alasan!);

    if (!konteks.reason?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Perubahan data kependudukan wajib menyertakan alasannya.',
      );
    }

    const medanSah = new Set([
      'full_name',
      'birth_place',
      'birth_date',
      'gender',
      'religion',
      'marital_status',
      'education',
      'occupation',
      'address',
      'phone',
      'village_rt_id',
      'family_relation',
    ]);

    const diubah: string[] = [];
    await this.tenantDb.transaction(schemaName, async (client) => {
      for (const [medan, nilai] of Object.entries(perubahan)) {
        if (!medanSah.has(medan)) continue;
        const sebelum = lama[0][medan];
        if (String(sebelum ?? '') === String(nilai ?? '')) continue;

        await client.query(
          `UPDATE "${schemaName}".village_resident
              SET ${medan} = $2, updated_at = now(), updated_by = $3, version = version + 1
            WHERE id = $1`,
          [id, nilai, user.userId],
        );
        if (medan === 'full_name' && nilai) {
          await client.query(
            `UPDATE "${schemaName}".village_resident SET normalized_name = $2 WHERE id = $1`,
            [id, normalkanNama(nilai)],
          );
        }
        await client.query(
          `INSERT INTO "${schemaName}".village_resident_history
             (village_resident_id, changed_field, old_value, new_value, reason,
              document_reference, effective_date, actor_user_id, active_role_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            id,
            medan,
            sebelum === null || sebelum === undefined ? null : String(sebelum),
            nilai,
            konteks.reason,
            konteks.documentReference ?? null,
            konteks.effectiveDate ?? null,
            user.userId,
            user.activeRoleId ?? null,
          ],
        );
        diubah.push(medan);
      }
    });

    return { id, changedFields: diubah };
  }

  // --- Keluarga -------------------------------------------------------------

  /**
   * Daftar kartu keluarga.
   *
   * **Tidak** dilayani daftar umum (`village-listing.ts`), dan itu disengaja:
   * kartu keluarga adalah kumpulan orang, sehingga pembacaannya wajib
   * menghormati cakupan wilayah petugas dan wajib tercatat pada log akses.
   * Daftar umum tidak mengetahui keduanya.
   *
   * Nomor kartu keluarga **tidak** ikut ditampilkan. Ia dipakai sebagai
   * pengenal pada banyak layanan luar, sehingga daftar yang menampilkannya
   * berbaris-baris di layar loket adalah daftar nomor identitas yang terbaca
   * dari antrean.
   */
  async daftarKeluarga(
    schemaName: string,
    filter: { q?: string; rtId?: string; limit?: number; offset?: number },
    cakupan: CakupanWilayah,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.KELUARGA');
    const u = await this.unit.unit(schemaName);

    const params: unknown[] = [u.id];
    let sql =
      `SELECT f.id, f.address, f.welfare_status, f.house_ownership, f.is_active,
              t.number AS rt_number, w.number AS rw_number,
              (SELECT COUNT(*) FROM "${schemaName}".village_resident m
                WHERE m.village_family_id = f.id AND m.deleted_at IS NULL) AS member_count,
              (SELECT m.full_name FROM "${schemaName}".village_resident m
                WHERE m.village_family_id = f.id AND m.deleted_at IS NULL
                  AND m.family_relation = 'KEPALA_KELUARGA' LIMIT 1) AS head_name
         FROM "${schemaName}".village_family f
    LEFT JOIN "${schemaName}".village_rt t ON t.id = f.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE f.village_unit_id = $1 AND f.deleted_at IS NULL`;

    // Cakupan disaring lewat RT keluarganya. Petugas RT 03 melihat kartu
    // keluarga RT 03, bukan seluruh desa.
    const c = this.penyaringCakupan('f', cakupan, params.length + 1);
    sql += c.sql
      .replace(/village_rt/g, `"${schemaName}".village_rt`)
      .replace(/village_rw/g, `"${schemaName}".village_rw`)
      .replace(/village_resident/g, `"${schemaName}".village_resident`);
    params.push(...c.params);

    if (filter.q) {
      params.push(`%${filter.q}%`);
      sql += ` AND f.address ILIKE $${params.length}`;
    }
    if (filter.rtId) {
      params.push(filter.rtId);
      sql += ` AND f.village_rt_id = $${params.length}`;
    }

    params.push(Math.min(filter.limit ?? 50, 200), filter.offset ?? 0);
    sql += ` ORDER BY w.number, t.number, f.address
             LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaName, sql, params);

    await this.catatAkses(schemaName, {
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId,
      accessType: filter.q ? 'SEARCH' : 'LIST',
      surface: 'village/families',
      recordCount: rows.length,
    });

    return rows;
  }

  /**
   * Daftar peristiwa penting: kelahiran, kematian, pindah, datang.
   *
   * Sebab kematian (`cause_note`) **tidak** ikut. Ia keterangan medis yang
   * masuk ke sini lewat surat keterangan, dan daftar yang menampilkannya
   * membuat riwayat penyakit satu keluarga terbaca siapa pun yang membuka layar
   * peristiwa.
   */
  async daftarPeristiwa(
    schemaName: string,
    filter: { jenis?: string; status?: string; limit?: number; offset?: number },
    cakupan: CakupanWilayah,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.MUTASI');
    const u = await this.unit.unit(schemaName);

    const params: unknown[] = [u.id];
    let sql =
      `SELECT e.id, e.event_type, e.event_date::text, e.event_place,
              e.child_name, e.status, e.created_at,
              r.full_name AS resident_name,
              t.number AS rt_number, w.number AS rw_number
         FROM "${schemaName}".village_vital_event e
         JOIN "${schemaName}".village_resident r ON r.id = e.village_resident_id
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE e.village_unit_id = $1`;

    const c = this.penyaringCakupan('r', cakupan, params.length + 1);
    sql += c.sql
      .replace(/village_rt/g, `"${schemaName}".village_rt`)
      .replace(/village_rw/g, `"${schemaName}".village_rw`)
      .replace(/village_resident/g, `"${schemaName}".village_resident`);
    params.push(...c.params);

    if (filter.jenis) {
      params.push(filter.jenis);
      sql += ` AND e.event_type = $${params.length}`;
    }
    if (filter.status) {
      params.push(filter.status);
      sql += ` AND e.status = $${params.length}`;
    }

    params.push(Math.min(filter.limit ?? 50, 200), filter.offset ?? 0);
    sql += ` ORDER BY e.event_date DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaName, sql, params);

    await this.catatAkses(schemaName, {
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId,
      accessType: 'LIST',
      surface: 'village/vital-events',
      recordCount: rows.length,
    });

    return rows;
  }

  /**
   * Daftar penduduk rentan.
   *
   * Layar ini yang paling perlu dijaga di seluruh D-2. Isinya penyandang
   * disabilitas, lanjut usia yang tinggal sendiri, dan keluarga yang keadaannya
   * sulit — persis daftar yang paling ingin dipegang orang untuk keperluan yang
   * bukan pelayanan.
   *
   * Karena itu ia memakai penyaring cakupan yang sama dengan daftar penduduk,
   * tercatat pada log akses dengan permukaan **tersendiri** supaya dapat
   * ditelusuri terpisah, dan tidak menampilkan alamat maupun nomor telepon:
   * yang dibutuhkan dari layar ini adalah siapa dan di RT mana. Petugas yang
   * memang perlu mendatangi membuka rinciannya seorang demi seorang, dan
   * pembukaan itu tercatat satu per satu.
   */
  async daftarRentan(
    schemaName: string,
    filter: { jenis?: string; rtId?: string; limit?: number; offset?: number },
    cakupan: CakupanWilayah,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.RENTAN');
    const u = await this.unit.unit(schemaName);

    const params: unknown[] = [u.id];
    let sql =
      `SELECT r.id, r.full_name, r.gender, r.birth_date::text, r.disability_type,
              r.social_condition, r.resident_status,
              t.number AS rt_number, w.number AS rw_number
         FROM "${schemaName}".village_resident r
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE r.village_unit_id = $1 AND r.deleted_at IS NULL AND r.is_vulnerable = TRUE`;

    const c = this.penyaringCakupan('r', cakupan, params.length + 1);
    sql += c.sql
      .replace(/village_rt/g, `"${schemaName}".village_rt`)
      .replace(/village_rw/g, `"${schemaName}".village_rw`)
      .replace(/village_resident/g, `"${schemaName}".village_resident`);
    params.push(...c.params);

    if (filter.jenis) {
      params.push(filter.jenis);
      sql += ` AND r.disability_type = $${params.length}`;
    }
    if (filter.rtId) {
      params.push(filter.rtId);
      sql += ` AND r.village_rt_id = $${params.length}`;
    }

    params.push(Math.min(filter.limit ?? 50, 200), filter.offset ?? 0);
    sql += ` ORDER BY r.full_name LIMIT $${params.length - 1} OFFSET $${params.length}`;

    const rows = await this.tenantDb.query<Record<string, unknown>>(schemaName, sql, params);

    await this.catatAkses(schemaName, {
      actorUserId: user.userId,
      activeRoleId: user.activeRoleId,
      accessType: 'LIST',
      // Permukaan tersendiri, bukan `village/residents`. Pertanyaan "siapa yang
      // membuka daftar penduduk rentan bulan lalu" harus dapat dijawab tanpa
      // menyaring seluruh pembacaan data penduduk.
      surface: 'village/vulnerable',
      recordCount: rows.length,
    });

    return rows;
  }

  async periksaKeluarga(schemaName: string, familyId: string) {
    const anggota = await this.tenantDb.query<{ id: string; family_relation: string }>(
      schemaName,
      `SELECT id, family_relation FROM "${schemaName}".village_resident
        WHERE village_family_id = $1 AND deleted_at IS NULL`,
      [familyId],
    );
    return periksaSusunanKeluarga(
      anggota.map((a) => ({ id: a.id, hubungan: (a.family_relation ?? 'LAINNYA') as never })),
    );
  }

  // --- Peristiwa ------------------------------------------------------------

  async catatPeristiwa(
    schemaName: string,
    input: {
      eventType: PeristiwaKependudukan;
      residentId?: string;
      eventDate: string;
      eventPlace?: string;
      childName?: string;
      documentReference?: string;
      note?: string;
    },
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.MUTASI');
    const u = await this.unit.unit(schemaName);

    if (input.residentId) {
      const r = await this.tenantDb.query<{ resident_status: string }>(
        schemaName,
        `SELECT resident_status FROM "${schemaName}".village_resident
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL`,
        [input.residentId, u.id],
      );
      if (!r.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penduduk tidak ditemukan.');

      const h = statusSesudahPeristiwa(r[0].resident_status as StatusPenduduk, input.eventType);
      if (!h.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, h.alasan!);
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_vital_event
         (village_unit_id, village_resident_id, event_type, event_date, event_place,
          child_name, document_reference, cause_note, reported_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        u.id,
        input.residentId ?? null,
        input.eventType,
        input.eventDate,
        input.eventPlace ?? null,
        input.childName ?? null,
        input.documentReference ?? null,
        input.note ?? null,
        user.userId,
      ],
    );
    return { id: rows[0].id, status: 'DILAPORKAN' };
  }

  /**
   * Menyetujui peristiwa, dan menerapkan akibatnya pada status penduduk.
   *
   * Keduanya dalam satu transaksi: peristiwa yang disetujui tanpa status yang
   * ikut berubah akan membuat penduduk yang sudah meninggal tetap tampak hidup
   * pada daftar.
   */
  async setujuiPeristiwa(schemaName: string, eventId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'PENDUDUK.MUTASI');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const ev = await client.query<Record<string, string>>(
        `SELECT id, event_type, village_resident_id, status, reported_by
           FROM "${schemaName}".village_vital_event WHERE id = $1 FOR UPDATE`,
        [eventId],
      );
      if (!ev.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Peristiwa tidak ditemukan.');
      const e = ev.rows[0];
      if (e.status !== 'DILAPORKAN') {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Peristiwa sudah berstatus ${e.status}.`);
      }

      await client.query(
        `UPDATE "${schemaName}".village_vital_event
            SET status = 'DISETUJUI', approved_by = $2, approved_at = now(), version = version + 1
          WHERE id = $1`,
        [eventId, user.userId],
      );

      if (e.village_resident_id) {
        const r = await client.query<{ resident_status: string }>(
          `SELECT resident_status FROM "${schemaName}".village_resident WHERE id = $1 FOR UPDATE`,
          [e.village_resident_id],
        );
        const h = statusSesudahPeristiwa(
          r.rows[0].resident_status as StatusPenduduk,
          e.event_type as PeristiwaKependudukan,
        );
        if (h.boleh && h.status !== r.rows[0].resident_status) {
          await client.query(
            `UPDATE "${schemaName}".village_resident
                SET resident_status = $2, updated_at = now(), version = version + 1
              WHERE id = $1`,
            [e.village_resident_id, h.status],
          );
          await client.query(
            `INSERT INTO "${schemaName}".village_resident_history
               (village_resident_id, changed_field, old_value, new_value, reason,
                actor_user_id, active_role_id)
             VALUES ($1, 'resident_status', $2, $3, $4, $5, $6)`,
            [
              e.village_resident_id,
              r.rows[0].resident_status,
              h.status,
              `Peristiwa ${e.event_type} disetujui`,
              user.userId,
              user.activeRoleId ?? null,
            ],
          );
        }
      }

      return { id: eventId, status: 'DISETUJUI' };
    });
  }
}
