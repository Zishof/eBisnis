/**
 * Buku penghubung santri: catatan guru/pengurus/wali yang belum terwakili
 * oleh presensi, nilai, atau pelanggaran.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanBukuPenghubung,
  MasukanTindakLanjutBukuPenghubung,
  validasiBukuPenghubung,
} from './pesantren-buku-penghubung';

export interface BarisBukuPenghubung {
  id: string;
  santri_id: string;
  nis: string | null;
  nama_lengkap: string | null;
  tanggal: string;
  jenis: string;
  visibilitas: string;
  judul: string;
  isi: string;
  tindak_lanjut: string | null;
  status: string;
  ditulis_oleh_guru_id: string | null;
  nama_guru: string | null;
  created_at: string;
}

const KOLOM = `b.id::text, b.santri_id::text, s.nis, s.nama_lengkap, b.tanggal::text, b.jenis,
  b.visibilitas, b.judul, b.isi, b.tindak_lanjut, b.status, b.ditulis_oleh_guru_id::text,
  g.nama AS nama_guru, b.created_at::text`;

@Injectable()
export class PesantrenBukuPenghubungService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { santriId?: string; jenis?: string; status?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisBukuPenghubung[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['b.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`b.santri_id = $${params.length}`);
    }
    if (opsi.jenis) {
      params.push(opsi.jenis);
      kondisi.push(`b.jenis = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`b.status = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total
         FROM ${S}.pesantren_buku_penghubung b
        WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisBukuPenghubung>(
      schemaName,
      `SELECT ${KOLOM}
         FROM ${S}.pesantren_buku_penghubung b
         JOIN ${S}.pesantren_santri s ON s.id = b.santri_id
         LEFT JOIN ${S}.pesantren_guru g ON g.id = b.ditulis_oleh_guru_id
        WHERE ${where}
        ORDER BY b.tanggal DESC, b.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisBukuPenghubung | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisBukuPenghubung>(
      schemaName,
      `SELECT ${KOLOM}
         FROM ${S}.pesantren_buku_penghubung b
         JOIN ${S}.pesantren_santri s ON s.id = b.santri_id
         LEFT JOIN ${S}.pesantren_guru g ON g.id = b.ditulis_oleh_guru_id
        WHERE b.id = $1 AND b.deleted_at IS NULL`,
      [id],
    );
  }

  async catat(schemaName: string, masukan: MasukanBukuPenghubung, createdBy: string): Promise<BarisBukuPenghubung> {
    const galat = validasiBukuPenghubung(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }

    if (masukan.ditulisOlehGuruId) {
      const guru = await this.tenantDb.queryOne(
        schemaName,
        `SELECT id FROM ${S}.pesantren_guru WHERE id = $1 AND deleted_at IS NULL`,
        [masukan.ditulisOlehGuruId],
      );
      if (!guru) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Guru penulis tidak ditemukan.');
      }
    }

    const rows = await this.tenantDb.query<BarisBukuPenghubung>(
      schemaName,
      `WITH inserted AS (
         INSERT INTO ${S}.pesantren_buku_penghubung
           (santri_id, tanggal, jenis, visibilitas, judul, isi, tindak_lanjut,
            ditulis_oleh_guru_id, ditulis_oleh_user_id, created_by, updated_by)
         VALUES ($1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6, $7, $8, $9, $9, $9)
         RETURNING *
       )
       SELECT ${KOLOM}
         FROM inserted b
         JOIN ${S}.pesantren_santri s ON s.id = b.santri_id
         LEFT JOIN ${S}.pesantren_guru g ON g.id = b.ditulis_oleh_guru_id`,
      [
        masukan.santriId,
        masukan.tanggal ? new Date(masukan.tanggal) : null,
        masukan.jenis,
        masukan.visibilitas,
        masukan.judul!.trim(),
        masukan.isi!.trim(),
        bersihkan(masukan.tindakLanjut),
        bersihkan(masukan.ditulisOlehGuruId),
        createdBy,
      ],
    );
    return rows[0];
  }

  async selesaikan(
    schemaName: string,
    id: string,
    masukan: MasukanTindakLanjutBukuPenghubung,
    updatedBy: string,
  ): Promise<BarisBukuPenghubung> {
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisBukuPenghubung>(
      schemaName,
      `WITH updated AS (
         UPDATE ${S}.pesantren_buku_penghubung
            SET status = 'SELESAI',
                tindak_lanjut = COALESCE($2, tindak_lanjut),
                updated_at = now(),
                updated_by = $3,
                version = version + 1
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING *
       )
       SELECT ${KOLOM}
         FROM updated b
         JOIN ${S}.pesantren_santri s ON s.id = b.santri_id
         LEFT JOIN ${S}.pesantren_guru g ON g.id = b.ditulis_oleh_guru_id`,
      [id, bersihkan(masukan.tindakLanjut), updatedBy],
    );
    if (!rows[0]) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Catatan buku penghubung tidak ditemukan.');
    }
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
