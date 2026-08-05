import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanKeputusanAkademik,
  StatusKeputusanAkademik,
  validasiAlasanPembatalanKeputusan,
  validasiKeputusanAkademik,
} from './pesantren-akademik';

export interface BarisKeputusanAkademik {
  id: string;
  santri_id: string;
  nama_lengkap?: string;
  nis?: string;
  tahun_ajaran_asal_id: string;
  tahun_ajaran_asal?: string;
  rombongan_asal_id: string | null;
  rombongan_asal?: string | null;
  jenis: 'NAIK_KELAS' | 'TINGGAL_KELAS' | 'LULUS' | 'KELUAR';
  status: StatusKeputusanAkademik;
  rombongan_tujuan_id: string | null;
  rombongan_tujuan?: string | null;
  tanggal_keputusan: string;
  tanggal_efektif: string;
  catatan: string | null;
  rapor_finalisasi_id: string | null;
  finalized_at: string | null;
  executed_at: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

const KOLOM_KEPUTUSAN = `k.id::text, k.santri_id::text, s.nama_lengkap, s.nis,
  k.tahun_ajaran_asal_id::text, ta.name AS tahun_ajaran_asal,
  k.rombongan_asal_id::text, ra.nama AS rombongan_asal,
  k.jenis, k.status, k.rombongan_tujuan_id::text, rt.nama AS rombongan_tujuan,
  k.tanggal_keputusan::text, k.tanggal_efektif::text, k.catatan, k.rapor_finalisasi_id::text,
  k.finalized_at::text, k.executed_at::text, k.canceled_at::text, k.cancel_reason,
  k.created_at::text`;

@Injectable()
export class PesantrenAkademikService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string, opsi: { tahunAjaranId?: string; status?: string; halaman: number; ukuranHalaman: number }) {
    const S = `"${schemaName}"`;
    const kondisi = ['k.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.tahunAjaranId) {
      params.push(opsi.tahunAjaranId);
      kondisi.push(`k.tahun_ajaran_asal_id = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`k.status = $${params.length}`);
    }
    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total
         FROM ${S}.pesantren_keputusan_akademik k
        WHERE ${where}`,
      params,
    );
    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisKeputusanAkademik>(
      schemaName,
      `SELECT ${KOLOM_KEPUTUSAN}
         FROM ${S}.pesantren_keputusan_akademik k
         JOIN ${S}.pesantren_santri s ON s.id = k.santri_id
         JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = k.tahun_ajaran_asal_id
         LEFT JOIN ${S}.pesantren_rombongan_belajar ra ON ra.id = k.rombongan_asal_id
         LEFT JOIN ${S}.pesantren_rombongan_belajar rt ON rt.id = k.rombongan_tujuan_id
        WHERE ${where}
        ORDER BY k.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async buat(schemaName: string, masukan: MasukanKeputusanAkademik, actorUserId: string): Promise<BarisKeputusanAkademik> {
    const galat = validasiKeputusanAkademik(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    if (santri.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Santri berstatus "${santri.status}" tidak dapat diproses akademiknya.`);
    }
    await this.pastikanTahunAjaran(schemaName, masukan.tahunAjaranAsalId!);
    const rombonganAsal = await this.rombonganAktifSantri(schemaName, masukan.santriId!, masukan.tahunAjaranAsalId!);
    if (masukan.rombonganTujuanId) {
      await this.pastikanRombonganTujuan(schemaName, masukan.rombonganTujuanId);
    }

    try {
      const rows = await this.tenantDb.query<BarisKeputusanAkademik>(
        schemaName,
        `WITH inserted AS (
          INSERT INTO ${S}.pesantren_keputusan_akademik (
            santri_id, tahun_ajaran_asal_id, rombongan_asal_id, jenis, rombongan_tujuan_id,
            tanggal_keputusan, tanggal_efektif, catatan, created_by, updated_by
          )
          VALUES ($1, $2, $3, $4, $5, COALESCE($6::date, CURRENT_DATE), COALESCE($7::date, CURRENT_DATE), $8, $9, $9)
          RETURNING *
        )
        SELECT ${KOLOM_KEPUTUSAN}
          FROM inserted k
          JOIN ${S}.pesantren_santri s ON s.id = k.santri_id
          JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = k.tahun_ajaran_asal_id
          LEFT JOIN ${S}.pesantren_rombongan_belajar ra ON ra.id = k.rombongan_asal_id
          LEFT JOIN ${S}.pesantren_rombongan_belajar rt ON rt.id = k.rombongan_tujuan_id`,
        [
          masukan.santriId,
          masukan.tahunAjaranAsalId,
          rombonganAsal?.rombongan_id ?? null,
          masukan.jenis,
          bersihkan(masukan.rombonganTujuanId),
          masukan.tanggalKeputusan ? new Date(masukan.tanggalKeputusan) : null,
          masukan.tanggalEfektif ? new Date(masukan.tanggalEfektif) : null,
          bersihkan(masukan.catatan),
          actorUserId,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_keputusan_akademik_aktif')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Santri ini sudah memiliki keputusan akademik draft/final pada tahun ajaran tersebut.');
      }
      throw error;
    }
  }

  async finalisasi(schemaName: string, id: string, actorUserId: string): Promise<BarisKeputusanAkademik> {
    const S = `"${schemaName}"`;
    const keputusan = await this.keputusanPolo(schemaName, id);
    if (!keputusan) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keputusan akademik tidak ditemukan.');
    if (keputusan.status !== 'DRAFT') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Keputusan berstatus "${keputusan.status}" tidak dapat difinalisasi.`);
    }
    const rapor = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.pesantren_rapor_finalisasi
        WHERE santri_id = $1 AND tahun_ajaran_id = $2 AND status = 'FINALIZED' AND deleted_at IS NULL
        ORDER BY finalized_at DESC LIMIT 1`,
      [keputusan.santri_id, keputusan.tahun_ajaran_asal_id],
    );
    if (!rapor) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Rapor santri pada tahun ajaran asal harus difinalisasi sebelum keputusan akademik difinalisasi.',
      );
    }
    return this.updateStatus(schemaName, id, 'FINALIZED', actorUserId, { raporFinalisasiId: rapor.id });
  }

  async eksekusi(schemaName: string, id: string, actorUserId: string): Promise<BarisKeputusanAkademik> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const keputusanRows = await client.query<BarisKeputusanAkademik>(
        `SELECT id::text, santri_id::text, tahun_ajaran_asal_id::text, rombongan_asal_id::text,
                jenis, status, rombongan_tujuan_id::text, tanggal_efektif::text
           FROM ${S}.pesantren_keputusan_akademik
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [id],
      );
      const keputusan = keputusanRows.rows[0];
      if (!keputusan) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keputusan akademik tidak ditemukan.');
      if (keputusan.status !== 'FINALIZED') {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Keputusan berstatus "${keputusan.status}" tidak dapat dieksekusi.`);
      }

      await client.query(
        `UPDATE ${S}.pesantren_rombongan_anggota
            SET status = $3, tanggal_keluar = $4, updated_at = now(), updated_by = $5, version = version + 1
          WHERE santri_id = $1 AND tahun_ajaran_id = $2 AND status = 'AKTIF' AND deleted_at IS NULL`,
        [
          keputusan.santri_id,
          keputusan.tahun_ajaran_asal_id,
          keputusan.jenis === 'NAIK_KELAS' || keputusan.jenis === 'TINGGAL_KELAS' ? 'PINDAH' : 'KELUAR',
          keputusan.tanggal_efektif,
          actorUserId,
        ],
      );

      if (keputusan.jenis === 'NAIK_KELAS' || keputusan.jenis === 'TINGGAL_KELAS') {
        const targetRows = await client.query<{ tahun_ajaran_id: string }>(
          `SELECT tahun_ajaran_id::text FROM ${S}.pesantren_rombongan_belajar
            WHERE id = $1 AND deleted_at IS NULL`,
          [keputusan.rombongan_tujuan_id],
        );
        const target = targetRows.rows[0];
        if (!target) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan tujuan tidak ditemukan.');
        await client.query(
          `INSERT INTO ${S}.pesantren_rombongan_anggota
             (rombongan_id, santri_id, tahun_ajaran_id, tanggal_masuk, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $5)`,
          [keputusan.rombongan_tujuan_id, keputusan.santri_id, target.tahun_ajaran_id, keputusan.tanggal_efektif, actorUserId],
        );
      } else {
        await client.query(
          `UPDATE ${S}.pesantren_santri
              SET status = $2, tanggal_keluar = $3, alasan_keluar = COALESCE($4, alasan_keluar),
                  updated_at = now(), updated_by = $5, version = version + 1
            WHERE id = $1 AND deleted_at IS NULL`,
          [
            keputusan.santri_id,
            keputusan.jenis === 'LULUS' ? 'LULUS' : 'KELUAR',
            keputusan.tanggal_efektif,
            keputusan.jenis === 'LULUS' ? 'Lulus berdasarkan keputusan akademik.' : 'Keluar berdasarkan keputusan akademik.',
            actorUserId,
          ],
        );
      }

      await client.query(
        `UPDATE ${S}.pesantren_keputusan_akademik
            SET status = 'EXECUTED', executed_at = now(), executed_by = $2,
                updated_at = now(), updated_by = $2, version = version + 1
          WHERE id = $1`,
        [id, actorUserId],
      );
      const rows = await client.query<BarisKeputusanAkademik>(this.detailSql(S), [id]);
      return rows.rows[0];
    });
  }

  async batalkan(schemaName: string, id: string, reason: string, actorUserId: string): Promise<BarisKeputusanAkademik> {
    const galat = validasiAlasanPembatalanKeputusan(reason);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const keputusan = await this.keputusanPolo(schemaName, id);
    if (!keputusan) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keputusan akademik tidak ditemukan.');
    if (keputusan.status === 'EXECUTED') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Keputusan yang sudah dieksekusi tidak dapat dibatalkan otomatis.');
    }
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_keputusan_akademik
          SET status = 'CANCELED', canceled_at = now(), canceled_by = $2, cancel_reason = $3,
              updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1 AND status IN ('DRAFT', 'FINALIZED') AND deleted_at IS NULL`,
      [id, actorUserId, reason.trim()],
    );
    return this.detail(schemaName, id);
  }

  async detail(schemaName: string, id: string): Promise<BarisKeputusanAkademik> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<BarisKeputusanAkademik>(schemaName, this.detailSql(S), [id]);
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keputusan akademik tidak ditemukan.');
    return row;
  }

  private detailSql(S: string): string {
    return `SELECT ${KOLOM_KEPUTUSAN}
      FROM ${S}.pesantren_keputusan_akademik k
      JOIN ${S}.pesantren_santri s ON s.id = k.santri_id
      JOIN ${S}.pesantren_tahun_ajaran ta ON ta.id = k.tahun_ajaran_asal_id
      LEFT JOIN ${S}.pesantren_rombongan_belajar ra ON ra.id = k.rombongan_asal_id
      LEFT JOIN ${S}.pesantren_rombongan_belajar rt ON rt.id = k.rombongan_tujuan_id
      WHERE k.id = $1 AND k.deleted_at IS NULL`;
  }

  private async keputusanPolo(schemaName: string, id: string): Promise<BarisKeputusanAkademik | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisKeputusanAkademik>(
      schemaName,
      `SELECT id::text, santri_id::text, tahun_ajaran_asal_id::text, rombongan_asal_id::text,
              jenis, status, rombongan_tujuan_id::text, tanggal_efektif::text
         FROM ${S}.pesantren_keputusan_akademik
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  private async updateStatus(
    schemaName: string,
    id: string,
    status: StatusKeputusanAkademik,
    actorUserId: string,
    opsi: { raporFinalisasiId?: string } = {},
  ): Promise<BarisKeputusanAkademik> {
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_keputusan_akademik
          SET status = $2, rapor_finalisasi_id = COALESCE($3, rapor_finalisasi_id),
              finalized_at = CASE WHEN $2 = 'FINALIZED' THEN now() ELSE finalized_at END,
              finalized_by = CASE WHEN $2 = 'FINALIZED' THEN $4 ELSE finalized_by END,
              updated_at = now(), updated_by = $4, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, status, opsi.raporFinalisasiId ?? null, actorUserId],
    );
    return this.detail(schemaName, id);
  }

  private async pastikanTahunAjaran(schemaName: string, id: string): Promise<void> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne(schemaName, `SELECT id FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');
  }

  private async pastikanRombonganTujuan(schemaName: string, id: string): Promise<void> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne(schemaName, `SELECT id FROM ${S}.pesantren_rombongan_belajar WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan tujuan tidak ditemukan.');
  }

  private async rombonganAktifSantri(schemaName: string, santriId: string, tahunAjaranId: string): Promise<{ rombongan_id: string } | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<{ rombongan_id: string }>(
      schemaName,
      `SELECT rombongan_id::text
         FROM ${S}.pesantren_rombongan_anggota
        WHERE santri_id = $1 AND tahun_ajaran_id = $2 AND status = 'AKTIF' AND deleted_at IS NULL
        LIMIT 1`,
      [santriId, tahunAjaranId],
    );
  }
}

function bersihkan(nilai?: string | null): string | null {
  const value = nilai?.trim();
  return value ? value : null;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
