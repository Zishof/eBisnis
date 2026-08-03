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
  santri_id?: string;
  nis?: string;
  nama_lengkap?: string;
  jenis_izin?: string;
  arah: string;
  waktu: string;
  catatan: string | null;
}

export interface IzinGerbangAktif {
  id: string;
  jenis: string;
  alasan: string;
  tanggal_mulai: string;
  tanggal_selesai_rencana: string;
  status: string;
  lintasan_terakhir: string | null;
}

export interface HasilPindaiGerbang {
  santri: {
    id: string;
    nis: string;
    nama_lengkap: string;
    status: string;
  };
  kartu: {
    id: string;
    nomor_kartu: string;
    jenis: string;
    status: string;
  };
  izinAktif: IzinGerbangAktif[];
  lintasanTerakhir: BarisLintasan | null;
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
      `SELECT gl.id::text, gl.izin_id::text, i.santri_id::text, s.nis, s.nama_lengkap,
              i.jenis AS jenis_izin, gl.arah, gl.waktu::text, gl.catatan
         FROM ${S}.pesantren_gerbang_log gl
         JOIN ${S}.pesantren_izin i ON i.id = gl.izin_id
         JOIN ${S}.pesantren_santri s ON s.id = i.santri_id
        WHERE ${where.replaceAll('izin_id', 'gl.izin_id')}
        ORDER BY gl.waktu DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async pindaiKartu(schemaName: string, nomorKartu: string): Promise<HasilPindaiGerbang> {
    const nomorBersih = nomorKartu.trim();
    if (!nomorBersih) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nomor kartu wajib diisi.');
    }

    const S = `"${schemaName}"`;
    const kartu = await this.tenantDb.queryOne<{
      id: string;
      santri_id: string;
      nomor_kartu: string;
      jenis: string;
      status: string;
    }>(
      schemaName,
      `SELECT id::text, santri_id::text, nomor_kartu, jenis, status
         FROM ${S}.pesantren_kartu
        WHERE nomor_kartu = $1 AND status = 'AKTIF' AND deleted_at IS NULL`,
      [nomorBersih],
    );
    if (!kartu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kartu tidak dikenali atau sudah tidak aktif.');
    }

    const santri = await this.tenantDb.queryOne<{
      id: string;
      nis: string;
      nama_lengkap: string;
      status: string;
    }>(
      schemaName,
      `SELECT id::text, nis, nama_lengkap, status
         FROM ${S}.pesantren_santri
        WHERE id = $1 AND deleted_at IS NULL`,
      [kartu.santri_id],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Data santri pemegang kartu ini tidak ditemukan.');
    }

    const izinAktif = await this.tenantDb.query<IzinGerbangAktif>(
      schemaName,
      `SELECT i.id::text, i.jenis, i.alasan, i.tanggal_mulai::text, i.tanggal_selesai_rencana::text,
              i.status,
              (
                SELECT gl.arah
                  FROM ${S}.pesantren_gerbang_log gl
                 WHERE gl.izin_id = i.id
                 ORDER BY gl.waktu DESC
                 LIMIT 1
              ) AS lintasan_terakhir
         FROM ${S}.pesantren_izin i
        WHERE i.santri_id = $1
          AND i.status = 'DISETUJUI'
          AND i.deleted_at IS NULL
          AND CURRENT_DATE BETWEEN i.tanggal_mulai AND i.tanggal_selesai_rencana
        ORDER BY i.tanggal_mulai DESC, i.created_at DESC`,
      [santri.id],
    );

    const lintasanTerakhir = await this.tenantDb.queryOne<BarisLintasan>(
      schemaName,
      `SELECT gl.id::text, gl.izin_id::text, i.santri_id::text, s.nis, s.nama_lengkap,
              i.jenis AS jenis_izin, gl.arah, gl.waktu::text, gl.catatan
         FROM ${S}.pesantren_gerbang_log gl
         JOIN ${S}.pesantren_izin i ON i.id = gl.izin_id
         JOIN ${S}.pesantren_santri s ON s.id = i.santri_id
        WHERE i.santri_id = $1
        ORDER BY gl.waktu DESC
        LIMIT 1`,
      [santri.id],
    );

    return {
      santri,
      kartu: {
        id: kartu.id,
        nomor_kartu: kartu.nomor_kartu,
        jenis: kartu.jenis,
        status: kartu.status,
      },
      izinAktif,
      lintasanTerakhir,
    };
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
      `WITH inserted AS (
         INSERT INTO ${S}.pesantren_gerbang_log (izin_id, arah, dicatat_oleh, catatan)
         VALUES ($1, $2, $3, $4)
         RETURNING id, izin_id, arah, waktu, catatan
       )
       SELECT inserted.id::text, inserted.izin_id::text, i.santri_id::text, s.nis, s.nama_lengkap,
              i.jenis AS jenis_izin, inserted.arah, inserted.waktu::text, inserted.catatan
         FROM inserted
         JOIN ${S}.pesantren_izin i ON i.id = inserted.izin_id
         JOIN ${S}.pesantren_santri s ON s.id = i.santri_id`,
      [masukan.izinId, masukan.arah, dicatatOleh, bersihkan(masukan.catatan)],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
