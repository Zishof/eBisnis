/**
 * Lintasan gerbang keluar-masuk (EP-J) — sisi basis datanya.
 *
 * Perhatikan: kelas ini TIDAK PERNAH menulis ke `pesantren_izin.status`.
 * Satu-satunya query yang menyentuh tabel itu adalah SELECT untuk memeriksa
 * bahwa izin sudah `DISETUJUI` sebelum lintasan boleh dicatat. Ini bukan
 * kelalaian menambahkan fitur approve/reject di sini — itu memang dilarang
 * (docs/santri-info/13 R10; lihat catatan pada `pesantren-perizinan.service.ts`).
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanLintasan, validasiLintasan } from './pesantren-perizinan';

export interface BarisLintasan {
  id: string;
  izin_id: string;
  arah: string;
  waktu: string;
  catatan: string | null;
}

@Injectable()
export class PesantrenGerbangService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { izinId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisLintasan[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['1=1'];
    const params: unknown[] = [];

    if (opsi.izinId) {
      params.push(opsi.izinId);
      kondisi.push(`izin_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_gerbang_log WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisLintasan>(
      schemaName,
      `SELECT id::text, izin_id::text, arah, waktu::text, catatan
         FROM ${S}.pesantren_gerbang_log
        WHERE ${where}
        ORDER BY waktu DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  /**
   * Mencatat satu lintasan keluar/masuk.
   *
   * Hanya izin berstatus DISETUJUI yang boleh dijadikan dasar lintasan —
   * inilah satu-satunya pemeriksaan yang menghubungkan gerbang dengan izin,
   * dan ia hanya MEMBACA status, tidak pernah menulisnya.
   */
  async catat(schemaName: string, masukan: MasukanLintasan, dicatatOleh: string): Promise<BarisLintasan> {
    const galat = validasiLintasan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const izin = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_izin WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.izinId],
    );
    if (!izin) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Izin tidak ditemukan.');
    }
    if (izin.status !== 'DISETUJUI') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Izin ini berstatus "${izin.status}", bukan DISETUJUI. Santri tidak boleh melewati gerbang tanpa izin yang sudah disetujui.`,
      );
    }

    const rows = await this.tenantDb.query<BarisLintasan>(
      schemaName,
      `INSERT INTO ${S}.pesantren_gerbang_log (izin_id, arah, dicatat_oleh, catatan)
       VALUES ($1, $2, $3, $4)
       RETURNING id::text, izin_id::text, arah, waktu::text, catatan`,
      [masukan.izinId, masukan.arah, dicatatOleh, bersihkan(masukan.catatan)],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
