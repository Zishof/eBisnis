/**
 * Pelanggaran dan hukuman santri (EP-S1) — sisi basis datanya. Pola sama
 * dengan `pesantren-perizinan.service.ts`.
 *
 * Total poin santri DIHITUNG dari log pelanggaran yang masih berstatus
 * DICATAT (bukan disimpan sebagai kolom akumulator pada `pesantren_santri`)
 * -- pola yang sama dengan saldo dompet (EP-L) dan capaian tahfiz (EP-I).
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanHukuman,
  MasukanJenisPelanggaran,
  MasukanPelanggaran,
  validasiHukuman,
  validasiJenisPelanggaran,
  validasiPelanggaran,
} from './pesantren-pelanggaran';

export interface BarisJenisPelanggaran {
  id: string;
  code: string;
  nama: string;
  kategori: string;
  poin: number;
  created_at: string;
}

const KOLOM_JENIS = `id::text, code, nama, kategori, poin, created_at::text`;

export interface BarisPelanggaran {
  id: string;
  santri_id: string;
  jenis_pelanggaran_id: string;
  tanggal: string;
  keterangan: string | null;
  poin: number;
  status: string;
  alasan_pembatalan: string | null;
  created_at: string;
}

const KOLOM_PELANGGARAN = `id::text, santri_id::text, jenis_pelanggaran_id::text, tanggal::text,
  keterangan, poin, status, alasan_pembatalan, created_at::text`;

export interface BarisHukuman {
  id: string;
  pelanggaran_id: string;
  jenis_hukuman: string;
  keterangan: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  status: string;
  created_at: string;
}

const KOLOM_HUKUMAN = `id::text, pelanggaran_id::text, jenis_hukuman, keterangan, tanggal_mulai::text,
  tanggal_selesai::text, status, created_at::text`;

@Injectable()
export class PesantrenPelanggaranService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Jenis pelanggaran (katalog) ------------------------------------------

  async daftarJenis(schemaName: string): Promise<BarisJenisPelanggaran[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisJenisPelanggaran>(
      schemaName,
      `SELECT ${KOLOM_JENIS} FROM ${S}.pesantren_jenis_pelanggaran WHERE deleted_at IS NULL ORDER BY kategori, nama`,
    );
  }

  async catatJenis(schemaName: string, masukan: MasukanJenisPelanggaran, createdBy: string): Promise<BarisJenisPelanggaran> {
    const galat = validasiJenisPelanggaran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisJenisPelanggaran>(
        schemaName,
        `INSERT INTO ${S}.pesantren_jenis_pelanggaran (code, nama, kategori, poin, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING ${KOLOM_JENIS}`,
        [masukan.code!.trim(), masukan.nama!.trim(), masukan.kategori, masukan.poin, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_jenis_pelanggaran_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode jenis pelanggaran "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  // --- Pelanggaran -----------------------------------------------------------

  async daftarPelanggaran(
    schemaName: string,
    opsi: { santriId?: string; status?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPelanggaran[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_pelanggaran WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPelanggaran>(
      schemaName,
      `SELECT ${KOLOM_PELANGGARAN} FROM ${S}.pesantren_pelanggaran
        WHERE ${where}
        ORDER BY tanggal DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satuPelanggaran(schemaName: string, id: string): Promise<BarisPelanggaran | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisPelanggaran>(
      schemaName,
      `SELECT ${KOLOM_PELANGGARAN} FROM ${S}.pesantren_pelanggaran WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catatPelanggaran(schemaName: string, masukan: MasukanPelanggaran, createdBy: string): Promise<BarisPelanggaran> {
    const galat = validasiPelanggaran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
    const jenis = await this.tenantDb.queryOne<{ poin: number }>(
      schemaName,
      `SELECT poin FROM ${S}.pesantren_jenis_pelanggaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.jenisPelanggaranId],
    );
    if (!jenis) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jenis pelanggaran tidak ditemukan.');
    }

    const rows = await this.tenantDb.query<BarisPelanggaran>(
      schemaName,
      `INSERT INTO ${S}.pesantren_pelanggaran
         (santri_id, jenis_pelanggaran_id, tanggal, keterangan, poin, created_by, updated_by)
       VALUES ($1, $2, COALESCE($3, CURRENT_DATE), $4, $5, $6, $6)
       RETURNING ${KOLOM_PELANGGARAN}`,
      [
        masukan.santriId,
        masukan.jenisPelanggaranId,
        masukan.tanggal ? new Date(masukan.tanggal) : null,
        bersihkan(masukan.keterangan),
        jenis.poin,
        createdBy,
      ],
    );
    return rows[0];
  }

  async batalkanPelanggaran(schemaName: string, id: string, alasan: string | undefined, actorUserId: string): Promise<BarisPelanggaran> {
    const S = `"${schemaName}"`;
    const pelanggaran = await this.satuPelanggaran(schemaName, id);
    if (!pelanggaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pelanggaran tidak ditemukan.');
    }
    if (pelanggaran.status !== 'DICATAT') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Pelanggaran ini sudah dibatalkan.');
    }
    const rows = await this.tenantDb.query<BarisPelanggaran>(
      schemaName,
      `UPDATE ${S}.pesantren_pelanggaran
          SET status = 'DIBATALKAN', alasan_pembatalan = $2, dibatalkan_oleh = $3, dibatalkan_pada = now(),
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PELANGGARAN}`,
      [id, bersihkan(alasan), actorUserId],
    );
    return rows[0];
  }

  /** Total poin aktif (belum dibatalkan) seorang santri -- dihitung, bukan disimpan. */
  async totalPoin(schemaName: string, santriId: string): Promise<number> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ total: string }>(
      schemaName,
      `SELECT COALESCE(SUM(poin), 0)::text AS total
         FROM ${S}.pesantren_pelanggaran
        WHERE santri_id = $1 AND status = 'DICATAT' AND deleted_at IS NULL`,
      [santriId],
    );
    return Number(row?.total ?? 0);
  }

  // --- Hukuman ---------------------------------------------------------------

  async daftarHukuman(schemaName: string, pelanggaranId: string): Promise<BarisHukuman[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisHukuman>(
      schemaName,
      `SELECT ${KOLOM_HUKUMAN} FROM ${S}.pesantren_hukuman
        WHERE pelanggaran_id = $1 AND deleted_at IS NULL
        ORDER BY tanggal_mulai DESC`,
      [pelanggaranId],
    );
  }

  async catatHukuman(schemaName: string, masukan: MasukanHukuman, createdBy: string): Promise<BarisHukuman> {
    const galat = validasiHukuman(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const pelanggaran = await this.satuPelanggaran(schemaName, masukan.pelanggaranId!);
    if (!pelanggaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pelanggaran tidak ditemukan.');
    }
    if (pelanggaran.status !== 'DICATAT') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tidak dapat menjatuhkan hukuman atas pelanggaran yang sudah dibatalkan.',
      );
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisHukuman>(
      schemaName,
      `INSERT INTO ${S}.pesantren_hukuman
         (pelanggaran_id, jenis_hukuman, keterangan, tanggal_mulai, tanggal_selesai, created_by, updated_by)
       VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6, $6)
       RETURNING ${KOLOM_HUKUMAN}`,
      [
        masukan.pelanggaranId,
        masukan.jenisHukuman,
        bersihkan(masukan.keterangan),
        masukan.tanggalMulai ? new Date(masukan.tanggalMulai) : null,
        masukan.tanggalSelesai ? new Date(masukan.tanggalSelesai) : null,
        createdBy,
      ],
    );
    return rows[0];
  }

  async selesaikanHukuman(schemaName: string, id: string, actorUserId: string): Promise<BarisHukuman> {
    return this.ubahStatusHukuman(schemaName, id, ['DIJATUHKAN'], 'SELESAI', actorUserId);
  }

  async batalkanHukuman(schemaName: string, id: string, actorUserId: string): Promise<BarisHukuman> {
    return this.ubahStatusHukuman(schemaName, id, ['DIJATUHKAN'], 'DIBATALKAN', actorUserId);
  }

  private async ubahStatusHukuman(
    schemaName: string,
    id: string,
    dari: string[],
    ke: string,
    actorUserId: string,
  ): Promise<BarisHukuman> {
    const S = `"${schemaName}"`;
    const hukuman = await this.tenantDb.queryOne<BarisHukuman>(
      schemaName,
      `SELECT ${KOLOM_HUKUMAN} FROM ${S}.pesantren_hukuman WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!hukuman) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Hukuman tidak ditemukan.');
    }
    if (!dari.includes(hukuman.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Hukuman berstatus "${hukuman.status}" tidak dapat diubah ke "${ke}".`,
      );
    }
    const rows = await this.tenantDb.query<BarisHukuman>(
      schemaName,
      `UPDATE ${S}.pesantren_hukuman
          SET status = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_HUKUMAN}`,
      [id, ke, actorUserId],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
