/**
 * Asrama, kamar, dan penempatan santri (EP-G) — sisi basis datanya. Pola
 * sama dengan `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanAsrama,
  MasukanKamar,
  MasukanPenempatan,
  validasiAsrama,
  validasiKamar,
  validasiPenempatan,
} from './pesantren-asrama';

export interface BarisAsrama {
  id: string;
  code: string;
  nama: string;
  jenis: string;
  alamat: string | null;
  created_at: string;
}

export interface BarisKamar {
  id: string;
  asrama_id: string;
  nomor: string;
  kapasitas: number;
  terisi: number;
  created_at: string;
}

export interface BarisPenempatan {
  id: string;
  santri_id: string;
  kamar_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  catatan: string | null;
  created_at: string;
}

@Injectable()
export class PesantrenAsramaService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarAsrama(schemaName: string): Promise<BarisAsrama[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisAsrama>(
      schemaName,
      `SELECT id::text, code, nama, jenis, alamat, created_at::text
         FROM ${S}.pesantren_asrama
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, nama ASC`,
    );
  }

  async catatAsrama(schemaName: string, masukan: MasukanAsrama, createdBy: string): Promise<BarisAsrama> {
    const galat = validasiAsrama(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisAsrama>(
        schemaName,
        `INSERT INTO ${S}.pesantren_asrama (code, nama, jenis, alamat, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, code, nama, jenis, alamat, created_at::text`,
        [masukan.code!.trim(), masukan.nama!.trim(), masukan.jenis, bersihkan(masukan.alamat), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_asrama_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode asrama "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async daftarKamar(schemaName: string, asramaId: string): Promise<BarisKamar[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKamar>(
      schemaName,
      `SELECT k.id::text, k.asrama_id::text, k.nomor, k.kapasitas, k.created_at::text,
              (SELECT COUNT(*)::int FROM ${S}.pesantren_penempatan p
                WHERE p.kamar_id = k.id AND p.tanggal_selesai IS NULL AND p.deleted_at IS NULL) AS terisi
         FROM ${S}.pesantren_kamar k
        WHERE k.asrama_id = $1 AND k.deleted_at IS NULL
        ORDER BY k.sort_order ASC, k.nomor ASC`,
      [asramaId],
    );
  }

  async catatKamar(schemaName: string, asramaId: string, masukan: MasukanKamar, createdBy: string): Promise<BarisKamar> {
    const galat = validasiKamar(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const asrama = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_asrama WHERE id = $1 AND deleted_at IS NULL`,
      [asramaId],
    );
    if (!asrama) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Asrama tidak ditemukan.');
    }
    try {
      const rows = await this.tenantDb.query<{
        id: string;
        asrama_id: string;
        nomor: string;
        kapasitas: number;
        created_at: string;
      }>(
        schemaName,
        `INSERT INTO ${S}.pesantren_kamar (asrama_id, nomor, kapasitas, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id::text, asrama_id::text, nomor, kapasitas, created_at::text`,
        [asramaId, masukan.nomor!.trim(), masukan.kapasitas, createdBy],
      );
      return { ...rows[0], terisi: 0 };
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_kamar_asrama_nomor')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Kamar nomor "${masukan.nomor}" sudah ada pada asrama ini.`,
        );
      }
      throw error;
    }
  }

  async daftarPenempatan(
    schemaName: string,
    opsi: { kamarId?: string; santriId?: string; hanyaAktif?: boolean; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPenempatan[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.kamarId) {
      params.push(opsi.kamarId);
      kondisi.push(`kamar_id = $${params.length}`);
    }
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }
    if (opsi.hanyaAktif) {
      kondisi.push('tanggal_selesai IS NULL');
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_penempatan WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPenempatan>(
      schemaName,
      `SELECT id::text, santri_id::text, kamar_id::text, tanggal_mulai::text,
              tanggal_selesai::text, catatan, created_at::text
         FROM ${S}.pesantren_penempatan
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  /**
   * Menempatkan santri ke sebuah kamar.
   *
   * Kapasitas dan "satu penempatan aktif per santri" diperiksa di dalam
   * transaksi yang sama dengan penulisannya -- keduanya bergantung hitungan
   * lintas baris yang tidak dapat dijawab CHECK constraint per baris.
   */
  async tempatkan(schemaName: string, masukan: MasukanPenempatan, createdBy: string): Promise<BarisPenempatan> {
    const galat = validasiPenempatan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne<{ status: string; jenis_kelamin: string }>(
      schemaName,
      `SELECT status, jenis_kelamin FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
    if (santri.status !== 'AKTIF') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Santri berstatus "${santri.status}" tidak dapat ditempatkan ke kamar. Hanya santri AKTIF yang dapat ditempatkan.`,
      );
    }

    const kamar = await this.tenantDb.queryOne<{ id: string; kapasitas: number; jenis: string }>(
      schemaName,
      `SELECT k.id, k.kapasitas, a.jenis
         FROM ${S}.pesantren_kamar k
         JOIN ${S}.pesantren_asrama a ON a.id = k.asrama_id
        WHERE k.id = $1 AND k.deleted_at IS NULL`,
      [masukan.kamarId],
    );
    if (!kamar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kamar tidak ditemukan.');
    }

    const jenisAsramaCocok = (kamar.jenis === 'PUTRA' && santri.jenis_kelamin === 'L') ||
      (kamar.jenis === 'PUTRI' && santri.jenis_kelamin === 'P');
    if (!jenisAsramaCocok) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Kamar ini berada di asrama ${kamar.jenis === 'PUTRA' ? 'putra' : 'putri'}, tidak sesuai dengan jenis kelamin santri. ` +
          'Pilih kamar pada asrama yang sesuai.',
      );
    }

    const terisi = await this.tenantDb.queryOne<{ n: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS n FROM ${S}.pesantren_penempatan
        WHERE kamar_id = $1 AND tanggal_selesai IS NULL AND deleted_at IS NULL`,
      [masukan.kamarId],
    );
    if (Number(terisi?.n ?? 0) >= kamar.kapasitas) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        `Kamar ini sudah penuh (kapasitas ${kamar.kapasitas} orang). Pilih kamar lain atau akhiri penempatan santri yang sudah keluar.`,
      );
    }

    try {
      const rows = await this.tenantDb.query<BarisPenempatan>(
        schemaName,
        `INSERT INTO ${S}.pesantren_penempatan (santri_id, kamar_id, catatan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id::text, santri_id::text, kamar_id::text, tanggal_mulai::text,
                   tanggal_selesai::text, catatan, created_at::text`,
        [masukan.santriId, masukan.kamarId, bersihkan(masukan.catatan), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_penempatan_satu_aktif_per_santri')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Santri ini sudah punya penempatan kamar yang masih aktif. Akhiri penempatan lama terlebih dahulu sebelum memindahkan.',
        );
      }
      throw error;
    }
  }

  /** Mengakhiri penempatan aktif (santri pindah kamar atau keluar). */
  async akhiri(schemaName: string, id: string, actorUserId: string): Promise<BarisPenempatan> {
    const S = `"${schemaName}"`;
    const penempatan = await this.tenantDb.queryOne<{ tanggal_selesai: string | null }>(
      schemaName,
      `SELECT tanggal_selesai::text FROM ${S}.pesantren_penempatan WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!penempatan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penempatan tidak ditemukan.');
    }
    if (penempatan.tanggal_selesai) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Penempatan ini sudah diakhiri sebelumnya.');
    }

    const rows = await this.tenantDb.query<BarisPenempatan>(
      schemaName,
      `UPDATE ${S}.pesantren_penempatan
          SET tanggal_selesai = CURRENT_DATE, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING id::text, santri_id::text, kamar_id::text, tanggal_mulai::text,
                  tanggal_selesai::text, catatan, created_at::text`,
      [id, actorUserId],
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
