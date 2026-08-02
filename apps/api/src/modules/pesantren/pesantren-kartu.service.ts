/**
 * Kartu RFID/QR santri (EP-M) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanKartu, validasiKartu } from './pesantren-kartu';

export interface BarisKartu {
  id: string;
  santri_id: string;
  nomor_kartu: string;
  jenis: string;
  status: string;
  diterbitkan_pada: string;
}

@Injectable()
export class PesantrenKartuService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string): Promise<BarisKartu[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKartu>(
      schemaName,
      `SELECT id::text, santri_id::text, nomor_kartu, jenis, status, diterbitkan_pada::text
         FROM ${S}.pesantren_kartu
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`,
    );
  }

  /**
   * Menerbitkan kartu baru untuk satu santri.
   *
   * Satu kartu aktif per santri dan satu nomor kartu aktif secara global
   * ditegakkan basis data lewat indeks unik parsial; pelanggaran
   * diterjemahkan ke pesan yang dapat dipahami.
   */
  async terbitkan(schemaName: string, masukan: MasukanKartu, createdBy: string): Promise<BarisKartu> {
    const galat = validasiKartu(masukan);
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

    try {
      const rows = await this.tenantDb.query<BarisKartu>(
        schemaName,
        `INSERT INTO ${S}.pesantren_kartu (santri_id, nomor_kartu, jenis, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING id::text, santri_id::text, nomor_kartu, jenis, status, diterbitkan_pada::text`,
        [masukan.santriId, masukan.nomorKartu!.trim(), masukan.jenis, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_kartu_nomor_aktif')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Nomor kartu "${masukan.nomorKartu}" sudah dipakai kartu aktif lain.`);
      }
      if (isUniqueViolation(error, 'ux_pesantren_kartu_satu_aktif_per_santri')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Santri ini sudah punya kartu aktif. Nonaktifkan kartu lama terlebih dahulu sebelum menerbitkan kartu pengganti.',
        );
      }
      throw error;
    }
  }

  /** Menonaktifkan kartu (hilang, rusak, atau diganti). */
  async nonaktifkan(schemaName: string, id: string, alasan: string, actorUserId: string): Promise<BarisKartu> {
    const S = `"${schemaName}"`;
    const kartu = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_kartu WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!kartu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kartu tidak ditemukan.');
    }
    if (kartu.status !== 'AKTIF') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Kartu berstatus "${kartu.status}" sudah tidak aktif.`);
    }

    const rows = await this.tenantDb.query<BarisKartu>(
      schemaName,
      `UPDATE ${S}.pesantren_kartu
          SET status = 'HILANG', dinonaktifkan_pada = now(), catatan = $2,
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING id::text, santri_id::text, nomor_kartu, jenis, status, diterbitkan_pada::text`,
      [id, bersihkan(alasan), actorUserId],
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
