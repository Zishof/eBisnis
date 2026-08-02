/**
 * Kitab, halaqah, dan keanggotaan santri (EP-H) — sisi basis datanya. Pola
 * sama dengan `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanHalaqah,
  MasukanKeanggotaan,
  MasukanKitab,
  validasiHalaqah,
  validasiKeanggotaan,
  validasiKitab,
} from './pesantren-diniyah';

export interface BarisKitab {
  id: string;
  code: string;
  judul: string;
  pengarang: string | null;
  keterangan: string | null;
  created_at: string;
}

export interface BarisHalaqah {
  id: string;
  code: string;
  nama: string;
  kitab_id: string | null;
  ustadz_id: string | null;
  jumlah_anggota: number;
  created_at: string;
}

export interface BarisAnggota {
  id: string;
  santri_id: string;
  tanggal_gabung: string;
  tanggal_keluar: string | null;
}

@Injectable()
export class PesantrenDiniyahService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarKitab(schemaName: string): Promise<BarisKitab[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKitab>(
      schemaName,
      `SELECT id::text, code, judul, pengarang, keterangan, created_at::text
         FROM ${S}.pesantren_kitab
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, judul ASC`,
    );
  }

  async catatKitab(schemaName: string, masukan: MasukanKitab, createdBy: string): Promise<BarisKitab> {
    const galat = validasiKitab(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisKitab>(
        schemaName,
        `INSERT INTO ${S}.pesantren_kitab (code, judul, pengarang, keterangan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, code, judul, pengarang, keterangan, created_at::text`,
        [
          masukan.code!.trim(),
          masukan.judul!.trim(),
          bersihkan(masukan.pengarang),
          bersihkan(masukan.keterangan),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_kitab_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode kitab "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async daftarHalaqah(schemaName: string): Promise<BarisHalaqah[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisHalaqah>(
      schemaName,
      `SELECT h.id::text, h.code, h.nama, h.kitab_id::text, h.ustadz_id::text, h.created_at::text,
              (SELECT COUNT(*)::int FROM ${S}.pesantren_halaqah_santri a
                WHERE a.halaqah_id = h.id AND a.tanggal_keluar IS NULL AND a.deleted_at IS NULL) AS jumlah_anggota
         FROM ${S}.pesantren_halaqah h
        WHERE h.deleted_at IS NULL
        ORDER BY h.sort_order ASC, h.nama ASC`,
    );
  }

  async catatHalaqah(schemaName: string, masukan: MasukanHalaqah, createdBy: string): Promise<BarisHalaqah> {
    const galat = validasiHalaqah(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;

    if (masukan.kitabId) {
      const kitab = await this.tenantDb.queryOne(
        schemaName,
        `SELECT id FROM ${S}.pesantren_kitab WHERE id = $1 AND deleted_at IS NULL`,
        [masukan.kitabId],
      );
      if (!kitab) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kitab tidak ditemukan.');
      }
    }

    try {
      const rows = await this.tenantDb.query<{
        id: string;
        code: string;
        nama: string;
        kitab_id: string | null;
        ustadz_id: string | null;
        created_at: string;
      }>(
        schemaName,
        `INSERT INTO ${S}.pesantren_halaqah (code, nama, kitab_id, ustadz_id, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, code, nama, kitab_id::text, ustadz_id::text, created_at::text`,
        [masukan.code!.trim(), masukan.nama!.trim(), masukan.kitabId || null, masukan.ustadzId || null, createdBy],
      );
      return { ...rows[0], jumlah_anggota: 0 };
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_halaqah_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode halaqah "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async daftarAnggota(schemaName: string, halaqahId: string): Promise<BarisAnggota[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisAnggota>(
      schemaName,
      `SELECT id::text, santri_id::text, tanggal_gabung::text, tanggal_keluar::text
         FROM ${S}.pesantren_halaqah_santri
        WHERE halaqah_id = $1 AND deleted_at IS NULL
        ORDER BY tanggal_gabung ASC`,
      [halaqahId],
    );
  }

  /** Menggabungkan santri ke sebuah halaqah. */
  async gabungkan(schemaName: string, halaqahId: string, masukan: MasukanKeanggotaan, createdBy: string): Promise<BarisAnggota> {
    const galat = validasiKeanggotaan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;

    const halaqah = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_halaqah WHERE id = $1 AND deleted_at IS NULL`,
      [halaqahId],
    );
    if (!halaqah) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Halaqah tidak ditemukan.');
    }

    const santri = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }
    if (santri.status !== 'AKTIF') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Santri berstatus "${santri.status}" tidak dapat digabungkan ke halaqah. Hanya santri AKTIF yang dapat digabungkan.`,
      );
    }

    try {
      const rows = await this.tenantDb.query<BarisAnggota>(
        schemaName,
        `INSERT INTO ${S}.pesantren_halaqah_santri (halaqah_id, santri_id, created_by, updated_by)
         VALUES ($1, $2, $3, $3)
         RETURNING id::text, santri_id::text, tanggal_gabung::text, tanggal_keluar::text`,
        [halaqahId, masukan.santriId, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_halaqah_santri_aktif')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Santri ini sudah menjadi anggota aktif halaqah ini.');
      }
      throw error;
    }
  }

  /** Mengeluarkan santri dari halaqah (keanggotaan berakhir, bukan dihapus). */
  async keluarkan(schemaName: string, id: string, actorUserId: string): Promise<BarisAnggota> {
    const S = `"${schemaName}"`;
    const anggota = await this.tenantDb.queryOne<{ tanggal_keluar: string | null }>(
      schemaName,
      `SELECT tanggal_keluar::text FROM ${S}.pesantren_halaqah_santri WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!anggota) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keanggotaan tidak ditemukan.');
    }
    if (anggota.tanggal_keluar) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Keanggotaan ini sudah berakhir sebelumnya.');
    }

    const rows = await this.tenantDb.query<BarisAnggota>(
      schemaName,
      `UPDATE ${S}.pesantren_halaqah_santri
          SET tanggal_keluar = CURRENT_DATE, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING id::text, santri_id::text, tanggal_gabung::text, tanggal_keluar::text`,
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
