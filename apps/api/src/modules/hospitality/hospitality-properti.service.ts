/**
 * Properti, tipe kamar, dan kamar (MI-5) — sisi basis datanya. Pola sama
 * dengan `pesantren-asrama.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanKamar,
  MasukanProperti,
  MasukanTipeKamar,
  validasiKamar,
  validasiProperti,
  validasiTipeKamar,
} from './hospitality-properti';

export interface BarisProperti {
  id: string;
  code: string;
  nama: string;
  timezone: string;
  business_date: string;
  alamat: string | null;
  status: string;
  created_at: string;
}

export interface BarisTipeKamar {
  id: string;
  property_id: string;
  code: string;
  nama: string;
  okupansi_maks: number;
  deskripsi: string | null;
  created_at: string;
}

export interface BarisKamar {
  id: string;
  property_id: string;
  room_type_id: string;
  nomor_kamar: string;
  lantai: string | null;
  status: string;
  created_at: string;
}

@Injectable()
export class HospitalityPropertiService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftarProperti(schemaName: string): Promise<BarisProperti[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisProperti>(
      schemaName,
      `SELECT id::text, code, name AS nama, timezone, business_date::text,
              address AS alamat, status, created_at::text
         FROM ${S}.hospitality_property
        WHERE deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
    );
  }

  async catatProperti(schemaName: string, masukan: MasukanProperti, createdBy: string): Promise<BarisProperti> {
    const galat = validasiProperti(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisProperti>(
        schemaName,
        `INSERT INTO ${S}.hospitality_property (code, name, timezone, address, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, code, name AS nama, timezone, business_date::text,
                   address AS alamat, status, created_at::text`,
        [
          masukan.code!.trim(),
          masukan.nama!.trim(),
          bersihkan(masukan.timezone) ?? 'Asia/Jakarta',
          bersihkan(masukan.alamat),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_hospitality_property_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode properti "${masukan.code}" sudah dipakai.`);
      }
      throw error;
    }
  }

  async daftarTipeKamar(schemaName: string, propertyId: string): Promise<BarisTipeKamar[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisTipeKamar>(
      schemaName,
      `SELECT id::text, property_id::text, code, name AS nama, max_occupancy AS okupansi_maks,
              description AS deskripsi, created_at::text
         FROM ${S}.hospitality_room_type
        WHERE property_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
      [propertyId],
    );
  }

  async catatTipeKamar(
    schemaName: string,
    propertyId: string,
    masukan: MasukanTipeKamar,
    createdBy: string,
  ): Promise<BarisTipeKamar> {
    const galat = validasiTipeKamar(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const properti = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.hospitality_property WHERE id = $1 AND deleted_at IS NULL`,
      [propertyId],
    );
    if (!properti) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    }
    try {
      const rows = await this.tenantDb.query<BarisTipeKamar>(
        schemaName,
        `INSERT INTO ${S}.hospitality_room_type
           (property_id, code, name, max_occupancy, description, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6)
         RETURNING id::text, property_id::text, code, name AS nama, max_occupancy AS okupansi_maks,
                   description AS deskripsi, created_at::text`,
        [
          propertyId,
          masukan.code!.trim(),
          masukan.nama!.trim(),
          masukan.okupansiMaks,
          bersihkan(masukan.deskripsi),
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_hospitality_room_type_code')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Kode tipe kamar "${masukan.code}" sudah ada pada properti ini.`);
      }
      throw error;
    }
  }

  async daftarKamar(schemaName: string, propertyId: string): Promise<BarisKamar[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKamar>(
      schemaName,
      `SELECT id::text, property_id::text, room_type_id::text, room_number AS nomor_kamar,
              floor AS lantai, status, created_at::text
         FROM ${S}.hospitality_room
        WHERE property_id = $1 AND deleted_at IS NULL
        ORDER BY sort_order ASC, room_number ASC`,
      [propertyId],
    );
  }

  async catatKamar(
    schemaName: string,
    propertyId: string,
    masukan: MasukanKamar,
    createdBy: string,
  ): Promise<BarisKamar> {
    const galat = validasiKamar(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const tipeKamar = await this.tenantDb.queryOne<{ id: string; property_id: string }>(
      schemaName,
      `SELECT id, property_id::text FROM ${S}.hospitality_room_type WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.roomTypeId],
    );
    if (!tipeKamar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tipe kamar tidak ditemukan.');
    }
    if (tipeKamar.property_id !== propertyId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tipe kamar ini bukan milik properti yang dipilih.',
      );
    }
    try {
      const rows = await this.tenantDb.query<BarisKamar>(
        schemaName,
        `INSERT INTO ${S}.hospitality_room
           (property_id, room_type_id, room_number, floor, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $5)
         RETURNING id::text, property_id::text, room_type_id::text, room_number AS nomor_kamar,
                   floor AS lantai, status, created_at::text`,
        [propertyId, masukan.roomTypeId, masukan.nomorKamar!.trim(), bersihkan(masukan.lantai), createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_hospitality_room_nomor')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Kamar nomor "${masukan.nomorKamar}" sudah ada pada properti ini.`,
        );
      }
      throw error;
    }
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
