/**
 * Berita/kabar pondok — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantFileBlobService } from '../../infrastructure/files/tenant-file-blob.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { kodeBerkasGambarBerita, lintasanGambarBerita, MasukanBerita, validasiBerita } from './pesantren-berita';

export interface BarisBerita {
  id: string;
  judul: string;
  ringkasan: string | null;
  isi_html: string | null;
  gambar_url: string | null;
  sumber_url: string | null;
  status: string;
  tanggal_terbit: string | null;
  created_at: string;
}

const KOLOM_BERITA = `id::text, judul, ringkasan, isi_html, gambar_url, sumber_url, status,
  tanggal_terbit::text, created_at::text`;

@Injectable()
export class PesantrenBeritaService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly fileBlob: TenantFileBlobService,
  ) {}

  async daftar(
    schemaName: string,
    opsi: { status?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisBerita[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_berita WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisBerita>(
      schemaName,
      `SELECT ${KOLOM_BERITA} FROM ${S}.pesantren_berita
        WHERE ${where}
        ORDER BY COALESCE(tanggal_terbit, created_at::date) DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisBerita | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisBerita>(
      schemaName,
      `SELECT ${KOLOM_BERITA} FROM ${S}.pesantren_berita WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catat(schemaName: string, masukan: MasukanBerita, createdBy: string): Promise<BarisBerita> {
    const galat = validasiBerita(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisBerita>(
      schemaName,
      `INSERT INTO ${S}.pesantren_berita
         (judul, ringkasan, isi_html, gambar_url, sumber_url, tanggal_terbit, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING ${KOLOM_BERITA}`,
      [
        masukan.judul!.trim(),
        bersihkan(masukan.ringkasan),
        bersihkan(masukan.isiHtml),
        bersihkan(masukan.gambarUrl),
        bersihkan(masukan.sumberUrl),
        masukan.tanggalTerbit ? new Date(masukan.tanggalTerbit) : null,
        createdBy,
      ],
    );
    return rows[0];
  }

  /** Menerbitkan berita DRAFT. Tanggal terbit diisi hari ini bila belum diisi. */
  async terbitkan(schemaName: string, id: string, actorUserId: string): Promise<BarisBerita> {
    const berita = await this.satu(schemaName, id);
    if (!berita) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');
    }
    if (berita.status === 'TERBIT') {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Berita ini sudah terbit.');
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisBerita>(
      schemaName,
      `UPDATE ${S}.pesantren_berita
          SET status = 'TERBIT', tanggal_terbit = COALESCE(tanggal_terbit, CURRENT_DATE),
              updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_BERITA}`,
      [id, actorUserId],
    );
    return rows[0];
  }

  async unggahGambar(
    schemaName: string,
    id: string,
    berkas: { filename: string; mimeType: string; buffer: Buffer },
    actorUserId: string,
  ): Promise<BarisBerita> {
    const berita = await this.satu(schemaName, id);
    if (!berita) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');
    }

    await this.fileBlob.simpanTunggal(
      schemaName,
      {
        code: kodeBerkasGambarBerita(id),
        name: `Sampul berita ${berita.judul}`,
        filename: berkas.filename,
        mimeType: berkas.mimeType,
        buffer: berkas.buffer,
      },
      actorUserId,
    );

    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisBerita>(
      schemaName,
      `UPDATE ${S}.pesantren_berita
          SET gambar_url = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${KOLOM_BERITA}`,
      [id, lintasanGambarBerita(id), actorUserId],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
