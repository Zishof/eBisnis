/**
 * Izin santri (EP-J) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 *
 * Kelas ini TIDAK diberi kemampuan mencatat lintasan gerbang, dan
 * `PesantrenGerbangService` (berkas terpisah) TIDAK diberi kemampuan
 * mengubah `status` di sini — pemisahan berkas ini bukan kerapian, melainkan
 * cara docs/santri-info/13 R10 (petugas gerbang mengubah persetujuan izin)
 * dibuat mustahil dari sisi kode, bukan hanya dari sisi permission.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanIzin, validasiIzin } from './pesantren-perizinan';

export interface BarisIzin {
  id: string;
  santri_id: string;
  jenis: string;
  alasan: string;
  tanggal_mulai: string;
  tanggal_selesai_rencana: string;
  status: string;
  disetujui_oleh: string | null;
  disetujui_pada: string | null;
  catatan_penyetuju: string | null;
  created_at: string;
}

const KOLOM = `id::text, santri_id::text, jenis, alasan, tanggal_mulai::text,
               tanggal_selesai_rencana::text, status, disetujui_oleh::text,
               disetujui_pada::text, catatan_penyetuju, created_at::text`;

@Injectable()
export class PesantrenPerizinanService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { status?: string; santriId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisIzin[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_izin WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisIzin>(
      schemaName,
      `SELECT ${KOLOM} FROM ${S}.pesantren_izin
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisIzin | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisIzin>(
      schemaName,
      `SELECT ${KOLOM} FROM ${S}.pesantren_izin WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async ajukan(schemaName: string, masukan: MasukanIzin, createdBy: string): Promise<BarisIzin> {
    const galat = validasiIzin(masukan);
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
    if (santri.status !== 'AKTIF') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Santri berstatus "${santri.status}" tidak dapat mengajukan izin. Hanya santri AKTIF yang dapat mengajukan.`,
      );
    }

    const rows = await this.tenantDb.query<BarisIzin>(
      schemaName,
      `INSERT INTO ${S}.pesantren_izin
         (santri_id, jenis, alasan, tanggal_mulai, tanggal_selesai_rencana, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       RETURNING ${KOLOM}`,
      [
        masukan.santriId,
        masukan.jenis,
        masukan.alasan!.trim(),
        masukan.tanggalMulai,
        masukan.tanggalSelesaiRencana,
        createdBy,
      ],
    );
    return rows[0];
  }

  private async ubahKeputusan(
    schemaName: string,
    id: string,
    statusBaru: 'DISETUJUI' | 'DITOLAK',
    catatan: string | undefined,
    actorUserId: string,
  ): Promise<BarisIzin> {
    const S = `"${schemaName}"`;
    const izin = await this.satu(schemaName, id);
    if (!izin) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Izin tidak ditemukan.');
    }
    if (izin.status !== 'MENUNGGU') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Izin berstatus "${izin.status}" tidak dapat diputuskan lagi. Hanya izin berstatus MENUNGGU yang dapat disetujui atau ditolak.`,
      );
    }

    const rows = await this.tenantDb.query<BarisIzin>(
      schemaName,
      `UPDATE ${S}.pesantren_izin
          SET status = $2, disetujui_oleh = $3, disetujui_pada = now(), catatan_penyetuju = $4,
              updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM}`,
      [id, statusBaru, actorUserId, bersihkan(catatan)],
    );
    return rows[0];
  }

  async setujui(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisIzin> {
    return this.ubahKeputusan(schemaName, id, 'DISETUJUI', catatan, actorUserId);
  }

  async tolak(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisIzin> {
    return this.ubahKeputusan(schemaName, id, 'DITOLAK', catatan, actorUserId);
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
