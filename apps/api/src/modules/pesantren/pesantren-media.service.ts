import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantFileBlobService } from '../../infrastructure/files/tenant-file-blob.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { KATEGORI_MEDIA_PESANTREN, KategoriMediaPesantren, kodeBerkasMediaPesantren, lintasanMediaPesantren } from './pesantren-media';

export interface BarisMediaPesantren {
  id: string;
  unit_pendidikan_id: string | null;
  unit_pendidikan_nama?: string | null;
  kategori: string;
  judul: string;
  deskripsi: string | null;
  image_url: string | null;
  alt_text: string | null;
  attribution: string | null;
  sort_order: number;
  is_published: boolean;
  file_code: string | null;
  created_at: string;
}

export interface MasukanMediaPesantren {
  unitPendidikanId?: string | null;
  kategori?: string;
  judul?: string;
  deskripsi?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
  attribution?: string | null;
  sortOrder?: number | null;
  isPublished?: boolean;
}

const KOLOM_MEDIA = `m.id::text, m.unit_pendidikan_id::text, u.name AS unit_pendidikan_nama,
  m.kategori, m.judul, m.deskripsi, m.image_url, m.alt_text, m.attribution,
  m.sort_order, m.is_published, m.file_code, m.created_at::text`;

@Injectable()
export class PesantrenMediaService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly fileBlob: TenantFileBlobService,
  ) {}

  async daftar(
    schemaName: string,
    opsi: { unitPendidikanId?: string; hanyaPublik?: boolean },
  ): Promise<BarisMediaPesantren[]> {
    const S = `"${schemaName}"`;
    const kondisi = ['m.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.unitPendidikanId) {
      params.push(opsi.unitPendidikanId);
      kondisi.push(`m.unit_pendidikan_id = $${params.length}`);
    }
    if (opsi.hanyaPublik) {
      kondisi.push('m.is_published = TRUE');
    }
    return this.tenantDb.query<BarisMediaPesantren>(
      schemaName,
      `SELECT ${KOLOM_MEDIA}
         FROM ${S}.pesantren_media m
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = m.unit_pendidikan_id
        WHERE ${kondisi.join(' AND ')}
        ORDER BY m.sort_order ASC, m.created_at DESC`,
      params,
    );
  }

  async catat(schemaName: string, masukan: MasukanMediaPesantren, actorUserId: string): Promise<BarisMediaPesantren> {
    const kategori = this.kategori(masukan.kategori);
    const judul = (masukan.judul ?? '').trim();
    if (!judul) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Judul media wajib diisi.');
    }
    await this.pastikanUnit(schemaName, masukan.unitPendidikanId);

    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisMediaPesantren>(
      schemaName,
      `WITH inserted AS (
         INSERT INTO ${S}.pesantren_media
           (unit_pendidikan_id, kategori, judul, deskripsi, image_url, alt_text, attribution, sort_order, is_published, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, TRUE), $10, $10)
         RETURNING *
       )
       SELECT inserted.id::text, inserted.unit_pendidikan_id::text, u.name AS unit_pendidikan_nama,
              inserted.kategori, inserted.judul, inserted.deskripsi, inserted.image_url, inserted.alt_text,
              inserted.attribution, inserted.sort_order, inserted.is_published, inserted.file_code, inserted.created_at::text
         FROM inserted
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = inserted.unit_pendidikan_id`,
      [
        masukan.unitPendidikanId || null,
        kategori,
        judul,
        bersihkan(masukan.deskripsi),
        bersihkan(masukan.imageUrl),
        bersihkan(masukan.altText),
        bersihkan(masukan.attribution),
        masukan.sortOrder ?? 0,
        masukan.isPublished ?? true,
        actorUserId,
      ],
    );
    return rows[0];
  }

  async ubah(schemaName: string, id: string, masukan: MasukanMediaPesantren, actorUserId: string): Promise<BarisMediaPesantren> {
    const media = await this.satu(schemaName, id);
    if (!media) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Media tidak ditemukan.');
    }
    await this.pastikanUnit(schemaName, masukan.unitPendidikanId);
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisMediaPesantren>(
      schemaName,
      `WITH updated AS (
         UPDATE ${S}.pesantren_media
            SET unit_pendidikan_id = $2,
                kategori = $3,
                judul = $4,
                deskripsi = $5,
                image_url = $6,
                alt_text = $7,
                attribution = $8,
                sort_order = $9,
                is_published = $10,
                updated_at = now(),
                updated_by = $11,
                version = version + 1
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING *
       )
       SELECT ${KOLOM_MEDIA}
         FROM updated m
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = m.unit_pendidikan_id`,
      [
        id,
        masukan.unitPendidikanId || null,
        this.kategori(masukan.kategori ?? media.kategori),
        (masukan.judul ?? media.judul).trim(),
        bersihkan(masukan.deskripsi),
        bersihkan(masukan.imageUrl),
        bersihkan(masukan.altText),
        bersihkan(masukan.attribution),
        masukan.sortOrder ?? media.sort_order,
        masukan.isPublished ?? media.is_published,
        actorUserId,
      ],
    );
    return rows[0];
  }

  async unggahGambar(
    schemaName: string,
    id: string,
    berkas: { filename: string; mimeType: string; buffer: Buffer },
    actorUserId: string,
  ): Promise<BarisMediaPesantren> {
    const media = await this.satu(schemaName, id);
    if (!media) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Media tidak ditemukan.');
    }
    const fileCode = kodeBerkasMediaPesantren(id);
    await this.fileBlob.simpanTunggal(
      schemaName,
      {
        code: fileCode,
        name: `Media pesantren ${media.judul}`,
        filename: berkas.filename,
        mimeType: berkas.mimeType,
        buffer: berkas.buffer,
      },
      actorUserId,
    );
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisMediaPesantren>(
      schemaName,
      `WITH updated AS (
         UPDATE ${S}.pesantren_media
            SET image_url = $2, file_code = $3, updated_at = now(), updated_by = $4, version = version + 1
          WHERE id = $1 AND deleted_at IS NULL
          RETURNING *
       )
       SELECT ${KOLOM_MEDIA}
         FROM updated m
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = m.unit_pendidikan_id`,
      [id, lintasanMediaPesantren(id), fileCode, actorUserId],
    );
    return rows[0];
  }

  async hapus(schemaName: string, id: string, actorUserId: string): Promise<{ id: string }> {
    const S = `"${schemaName}"`;
    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_media
          SET deleted_at = now(), deleted_by = $2, updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1 AND deleted_at IS NULL`,
      [id, actorUserId],
    );
    return { id };
  }

  async satu(schemaName: string, id: string): Promise<BarisMediaPesantren | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisMediaPesantren>(
      schemaName,
      `SELECT ${KOLOM_MEDIA}
         FROM ${S}.pesantren_media m
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = m.unit_pendidikan_id
        WHERE m.id = $1 AND m.deleted_at IS NULL`,
      [id],
    );
  }

  private kategori(nilai?: string | null): KategoriMediaPesantren {
    const kategori = (nilai || 'GALERI').toUpperCase();
    if (!KATEGORI_MEDIA_PESANTREN.includes(kategori as KategoriMediaPesantren)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Kategori media tidak dikenali.');
    }
    return kategori as KategoriMediaPesantren;
  }

  private async pastikanUnit(schemaName: string, unitId?: string | null): Promise<void> {
    if (!unitId) return;
    const S = `"${schemaName}"`;
    const unit = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
      [unitId],
    );
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
