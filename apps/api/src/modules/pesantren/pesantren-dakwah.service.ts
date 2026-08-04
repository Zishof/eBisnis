import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface BarisKajianDakwah {
  id: string;
  judul: string;
  pemateri: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  lokasi: string | null;
  ringkasan: string | null;
  materi_url: string | null;
  rekaman_url: string | null;
  gambar_url: string | null;
  status: string;
  sort_order: number;
  created_at: string;
}

export interface MasukanKajianDakwah {
  judul?: string;
  pemateri?: string | null;
  tanggalMulai?: string;
  tanggalSelesai?: string | null;
  lokasi?: string | null;
  ringkasan?: string | null;
  materiUrl?: string | null;
  rekamanUrl?: string | null;
  gambarUrl?: string | null;
  status?: string;
  sortOrder?: number | null;
}

const STATUS = ['DRAFT', 'TERBIT', 'ARSIP'] as const;
const KOLOM = `id::text, judul, pemateri, tanggal_mulai::text, tanggal_selesai::text,
  lokasi, ringkasan, materi_url, rekaman_url, gambar_url, status, sort_order, created_at::text`;

@Injectable()
export class PesantrenDakwahService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string, opsi: { status?: string; publik?: boolean } = {}): Promise<BarisKajianDakwah[]> {
    const S = `"${schemaName}"`;
    const kondisi = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    const status = opsi.publik ? 'TERBIT' : opsi.status;
    if (status) {
      params.push(this.status(status));
      kondisi.push(`status = $${params.length}`);
    }
    return this.tenantDb.query<BarisKajianDakwah>(
      schemaName,
      `SELECT ${KOLOM}
         FROM ${S}.pesantren_kajian_dakwah
        WHERE ${kondisi.join(' AND ')}
        ORDER BY sort_order ASC, tanggal_mulai DESC, created_at DESC
        LIMIT 100`,
      params,
    );
  }

  async catat(schemaName: string, masukan: MasukanKajianDakwah, actorUserId: string): Promise<BarisKajianDakwah> {
    const judul = (masukan.judul ?? '').trim();
    if (!judul) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Judul kajian wajib diisi.');
    }
    if (!masukan.tanggalMulai) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tanggal mulai kajian wajib diisi.');
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisKajianDakwah>(
      schemaName,
      `INSERT INTO ${S}.pesantren_kajian_dakwah
         (judul, pemateri, tanggal_mulai, tanggal_selesai, lokasi, ringkasan, materi_url,
          rekaman_url, gambar_url, status, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)
       RETURNING ${KOLOM}`,
      [
        judul,
        bersihkan(masukan.pemateri),
        new Date(masukan.tanggalMulai),
        masukan.tanggalSelesai ? new Date(masukan.tanggalSelesai) : null,
        bersihkan(masukan.lokasi),
        bersihkan(masukan.ringkasan),
        bersihkan(masukan.materiUrl),
        bersihkan(masukan.rekamanUrl),
        bersihkan(masukan.gambarUrl),
        this.status(masukan.status ?? 'DRAFT'),
        masukan.sortOrder ?? 0,
        actorUserId,
      ],
    );
    return rows[0];
  }

  async ubah(schemaName: string, id: string, masukan: MasukanKajianDakwah, actorUserId: string): Promise<BarisKajianDakwah> {
    const lama = await this.satu(schemaName, id);
    if (!lama) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kajian tidak ditemukan.');
    }
    const judul = (masukan.judul ?? lama.judul).trim();
    if (!judul) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Judul kajian wajib diisi.');
    }
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisKajianDakwah>(
      schemaName,
      `UPDATE ${S}.pesantren_kajian_dakwah
          SET judul = $2,
              pemateri = $3,
              tanggal_mulai = $4,
              tanggal_selesai = $5,
              lokasi = $6,
              ringkasan = $7,
              materi_url = $8,
              rekaman_url = $9,
              gambar_url = $10,
              status = $11,
              sort_order = $12,
              updated_at = now(),
              updated_by = $13,
              version = version + 1
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING ${KOLOM}`,
      [
        id,
        judul,
        bersihkan(masukan.pemateri),
        new Date(masukan.tanggalMulai ?? lama.tanggal_mulai),
        masukan.tanggalSelesai ? new Date(masukan.tanggalSelesai) : null,
        bersihkan(masukan.lokasi),
        bersihkan(masukan.ringkasan),
        bersihkan(masukan.materiUrl),
        bersihkan(masukan.rekamanUrl),
        bersihkan(masukan.gambarUrl),
        this.status(masukan.status ?? lama.status),
        masukan.sortOrder ?? lama.sort_order,
        actorUserId,
      ],
    );
    return rows[0];
  }

  async hapus(schemaName: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_kajian_dakwah
          SET deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, actorUserId],
    );
    return { id };
  }

  async satu(schemaName: string, id: string): Promise<BarisKajianDakwah | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisKajianDakwah>(
      schemaName,
      `SELECT ${KOLOM} FROM ${S}.pesantren_kajian_dakwah WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  private status(nilai: string): string {
    const status = nilai.toUpperCase();
    if (!STATUS.includes(status as (typeof STATUS)[number])) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Status kajian tidak dikenali.');
    }
    return status;
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
