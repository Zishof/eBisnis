/**
 * Rombongan belajar/kelas (EP-O3) — sisi basis datanya. Pola sama dengan
 * `pesantren-asrama.service.ts` (penempatan santri ke kamar) -- di sini
 * penempatan santri ke kelas, dengan aturan yang sama: satu keanggotaan
 * AKTIF per santri per tahun ajaran, ditegakkan indeks unik parsial dan
 * dijaga pesan galatnya di sini, bukan SQL mentah yang bocor ke pengguna.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanAnggota, MasukanRombongan, validasiAnggota, validasiRombongan } from './pesantren-rombongan';

export interface BarisRombongan {
  id: string;
  unit_pendidikan_id: string;
  tahun_ajaran_id: string;
  tingkat: string;
  nama: string;
  wali_kelas_user_id: string | null;
  kapasitas: number | null;
  created_at: string;
}

const KOLOM_ROMBONGAN = `id::text, unit_pendidikan_id::text, tahun_ajaran_id::text, tingkat, nama,
  wali_kelas_user_id::text, kapasitas, created_at::text`;

export interface BarisAnggota {
  id: string;
  rombongan_id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  status: string;
  nama_lengkap?: string;
  nis?: string;
}

const KOLOM_ANGGOTA_POLOS = `id::text, rombongan_id::text, santri_id::text, tahun_ajaran_id::text,
  tanggal_masuk::text, tanggal_keluar::text, status`;
const KOLOM_ANGGOTA = `a.id::text, a.rombongan_id::text, a.santri_id::text, a.tahun_ajaran_id::text,
  a.tanggal_masuk::text, a.tanggal_keluar::text, a.status`;

@Injectable()
export class PesantrenRombonganService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { unitPendidikanId?: string; tahunAjaranId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisRombongan[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.unitPendidikanId) {
      params.push(opsi.unitPendidikanId);
      kondisi.push(`unit_pendidikan_id = $${params.length}`);
    }
    if (opsi.tahunAjaranId) {
      params.push(opsi.tahunAjaranId);
      kondisi.push(`tahun_ajaran_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_rombongan_belajar WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisRombongan>(
      schemaName,
      `SELECT ${KOLOM_ROMBONGAN} FROM ${S}.pesantren_rombongan_belajar
        WHERE ${where}
        ORDER BY tingkat ASC, nama ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisRombongan | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisRombongan>(
      schemaName,
      `SELECT ${KOLOM_ROMBONGAN} FROM ${S}.pesantren_rombongan_belajar WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catat(schemaName: string, masukan: MasukanRombongan, createdBy: string): Promise<BarisRombongan> {
    const galat = validasiRombongan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const unit = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.unitPendidikanId],
    );
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }
    const tahunAjaran = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.tahunAjaranId],
    );
    if (!tahunAjaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisRombongan>(
        schemaName,
        `INSERT INTO ${S}.pesantren_rombongan_belajar
           (unit_pendidikan_id, tahun_ajaran_id, tingkat, nama, wali_kelas_user_id, kapasitas, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING ${KOLOM_ROMBONGAN}`,
        [
          masukan.unitPendidikanId,
          masukan.tahunAjaranId,
          masukan.tingkat!.trim(),
          masukan.nama!.trim(),
          masukan.waliKelasUserId || null,
          masukan.kapasitas ?? null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_rombongan_belajar_nama')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Nama rombongan "${masukan.nama}" sudah dipakai pada unit pendidikan dan tahun ajaran ini.`,
        );
      }
      throw error;
    }
  }

  async daftarAnggota(schemaName: string, rombonganId: string): Promise<BarisAnggota[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisAnggota>(
      schemaName,
      `SELECT ${KOLOM_ANGGOTA}, s.nama_lengkap, s.nis
         FROM ${S}.pesantren_rombongan_anggota a
         JOIN ${S}.pesantren_santri s ON s.id = a.santri_id
        WHERE a.rombongan_id = $1 AND a.deleted_at IS NULL
        ORDER BY s.nama_lengkap ASC`,
      [rombonganId],
    );
  }

  /**
   * Menempatkan santri ke rombongan. Menolak bila santri sudah punya
   * keanggotaan AKTIF pada tahun ajaran yang sama (indeks unik parsial
   * `ux_pesantren_rombongan_anggota_aktif`) atau bila kapasitas rombongan
   * (jika diisi) sudah penuh.
   */
  async tempatkan(schemaName: string, masukan: MasukanAnggota, createdBy: string): Promise<BarisAnggota> {
    const galat = validasiAnggota(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const rombongan = await this.satu(schemaName, masukan.rombonganId!);
    if (!rombongan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Rombongan belajar tidak ditemukan.');
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
        `Santri berstatus "${santri.status}" tidak dapat ditempatkan ke rombongan. Hanya santri AKTIF yang dapat ditempatkan.`,
      );
    }

    if (rombongan.kapasitas != null) {
      const terisi = await this.tenantDb.queryOne<{ jumlah: string }>(
        schemaName,
        `SELECT COUNT(*)::text AS jumlah FROM ${S}.pesantren_rombongan_anggota
          WHERE rombongan_id = $1 AND status = 'AKTIF' AND deleted_at IS NULL`,
        [masukan.rombonganId],
      );
      if (Number(terisi?.jumlah ?? 0) >= rombongan.kapasitas) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Kapasitas rombongan "${rombongan.nama}" (${rombongan.kapasitas}) sudah penuh.`,
        );
      }
    }

    try {
      const rows = await this.tenantDb.query<BarisAnggota>(
        schemaName,
        `INSERT INTO ${S}.pesantren_rombongan_anggota
           (rombongan_id, santri_id, tahun_ajaran_id, tanggal_masuk, created_by, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $5)
         RETURNING ${KOLOM_ANGGOTA_POLOS}`,
        [
          masukan.rombonganId,
          masukan.santriId,
          masukan.tahunAjaranId,
          masukan.tanggalMasuk ? new Date(masukan.tanggalMasuk) : null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_rombongan_anggota_aktif')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Santri ini sudah memiliki keanggotaan aktif pada rombongan lain di tahun ajaran yang sama. Pindahkan dari rombongan lama terlebih dahulu.',
        );
      }
      throw error;
    }
  }

  /**
   * Memindahkan santri ke rombongan lain: menutup keanggotaan lama
   * (status PINDAH) dan membuka keanggotaan baru dalam satu transaksi,
   * supaya tidak pernah ada jeda di mana santri tidak tercatat di
   * rombongan mana pun ATAU tercatat di dua rombongan sekaligus.
   */
  async pindahkan(schemaName: string, anggotaLamaId: string, rombonganBaruId: string, actorUserId: string): Promise<BarisAnggota> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const lama = await client.query<BarisAnggota>(
        `SELECT ${KOLOM_ANGGOTA_POLOS} FROM ${S}.pesantren_rombongan_anggota
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [anggotaLamaId],
      );
      const anggotaLama = lama.rows[0];
      if (!anggotaLama) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keanggotaan rombongan tidak ditemukan.');
      }
      if (anggotaLama.status !== 'AKTIF') {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Keanggotaan berstatus "${anggotaLama.status}" tidak dapat dipindahkan. Hanya keanggotaan AKTIF yang dapat dipindahkan.`,
        );
      }

      await client.query(
        `UPDATE ${S}.pesantren_rombongan_anggota
            SET status = 'PINDAH', tanggal_keluar = CURRENT_DATE, updated_at = now(), updated_by = $2, version = version + 1
          WHERE id = $1`,
        [anggotaLamaId, actorUserId],
      );

      const baru = await client.query<BarisAnggota>(
        `INSERT INTO ${S}.pesantren_rombongan_anggota
           (rombongan_id, santri_id, tahun_ajaran_id, tanggal_masuk, created_by, updated_by)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $4)
         RETURNING ${KOLOM_ANGGOTA_POLOS}`,
        [rombonganBaruId, anggotaLama.santri_id, anggotaLama.tahun_ajaran_id, actorUserId],
      );
      return baru.rows[0];
    });
  }

  async keluarkan(schemaName: string, anggotaId: string, actorUserId: string): Promise<BarisAnggota> {
    const S = `"${schemaName}"`;
    const anggota = await this.tenantDb.queryOne<BarisAnggota>(
      schemaName,
      `SELECT ${KOLOM_ANGGOTA_POLOS} FROM ${S}.pesantren_rombongan_anggota WHERE id = $1 AND deleted_at IS NULL`,
      [anggotaId],
    );
    if (!anggota) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keanggotaan rombongan tidak ditemukan.');
    }
    if (anggota.status !== 'AKTIF') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Keanggotaan berstatus "${anggota.status}" tidak dapat dikeluarkan. Hanya keanggotaan AKTIF yang dapat dikeluarkan.`,
      );
    }
    const rows = await this.tenantDb.query<BarisAnggota>(
      schemaName,
      `UPDATE ${S}.pesantren_rombongan_anggota
          SET status = 'KELUAR', tanggal_keluar = CURRENT_DATE, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_ANGGOTA_POLOS}`,
      [anggotaId, actorUserId],
    );
    return rows[0];
  }
}

function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
