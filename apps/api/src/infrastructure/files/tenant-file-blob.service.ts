/**
 * Berkas biner (logo, gambar latar, dst.) disimpan SEBAGAI DATA di dalam
 * basis data skema penyewa -- PostgreSQL Large Object -- bukan di folder
 * server atau storage awan eksternal.
 *
 * ## Mengapa begini, bukan `storage_key` (rujukan eksternal) yang sudah ada
 *
 * `file_object.storage_key` (V001) sudah dipakai listing marketplace untuk
 * menunjuk berkas EKSTERNAL. Diminta langsung oleh pengguna (pola
 * `LampiranLain` pada sistem lama Java): berkas dan datanya tidak pernah
 * terpisah, dan tidak berisiko terhapus dari folder tanpa tercatat di basis
 * data. Trade off-nya (basis data membengkak, replikasi/backup lebih berat)
 * diterima sadar -- lihat migrasi V038.
 *
 * Baris yang sama TIDAK memakai kedua metode sekaligus: `storage_key` pada
 * baris berbasis BLOB diisi `blob:<id>` (rujukan tampilan, BUKAN alamat
 * fisik) supaya kode lama yang membaca `storage_key` tanpa pemeriksaan NULL
 * tetap aman menerima string, bukan NULL.
 *
 * ## Aturan Large Object
 *
 * `lo_from_bytea`/`lo_get`/`lo_unlink` WAJIB di dalam transaksi -- aturan
 * PostgreSQL sendiri, bukan pilihan di sini. Setiap pemanggil metode di
 * kelas ini karena itu tidak perlu membungkus transaksi sendiri; kelas ini
 * yang melakukannya.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../database/tenant-connection.service';

export interface BerkasBlob {
  id: string;
  namaFile: string;
  mimeType: string;
  ukuranBytes: number;
  buffer: Buffer;
}

@Injectable()
export class TenantFileBlobService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Menyimpan/mengganti satu berkas bernama `code` (unik per skema, lihat
   * `ux_file_object_code`). Dipakai untuk berkas yang HANYA ADA SATU per
   * kategori pada satu penyewa (logo pondok, gambar latar situs) --
   * mengunggah ulang mengganti isinya, bukan menambah baris baru.
   *
   * Large Object LAMA (bila ada) di-`lo_unlink` di TRANSAKSI YANG SAMA
   * dengan penulisan yang baru -- tanpa ini, setiap pergantian logo
   * meninggalkan objek biner yatim yang tidak pernah dihapus.
   */
  async simpanTunggal(
    schemaName: string,
    data: { code: string; name: string; filename: string; mimeType: string; buffer: Buffer },
    actorUserId: string,
  ): Promise<string> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;

      const lama = await client.query<{ oid: string | null }>(
        `SELECT oid::text AS oid FROM ${S}.file_object WHERE code = $1 AND deleted_at IS NULL`,
        [data.code],
      );
      if (lama.rows[0]?.oid) {
        await client.query(`SELECT lo_unlink($1::oid)`, [lama.rows[0].oid]);
      }

      const lo = await client.query<{ oid: string }>(`SELECT lo_from_bytea(0, $1::bytea) AS oid`, [data.buffer]);
      const oid = lo.rows[0].oid;

      const rows = await client.query<{ id: string }>(
        `INSERT INTO ${S}.file_object (code, name, storage_key, filename, mime_type, size_bytes, oid, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7::oid, $8, $8)
         ON CONFLICT (code) WHERE deleted_at IS NULL DO UPDATE SET
           name = EXCLUDED.name,
           filename = EXCLUDED.filename,
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           oid = EXCLUDED.oid,
           updated_at = now(),
           updated_by = $8,
           version = ${S}.file_object.version + 1
         RETURNING id::text AS id`,
        [
          data.code,
          data.name,
          `blob:${data.code}`,
          data.filename,
          data.mimeType,
          data.buffer.length,
          oid,
          actorUserId,
        ],
      );
      return rows.rows[0].id;
    });
  }

  /** Baris berbasis BLOB dicari lewat `code` -- lihat `simpanTunggal`. */
  async ambilByCode(schemaName: string, code: string): Promise<BerkasBlob | null> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{
      id: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      content: Buffer | null;
    }>(
      schemaName,
      `SELECT id::text AS id, filename, mime_type, size_bytes, lo_get(oid) AS content
         FROM ${S}.file_object
        WHERE code = $1 AND oid IS NOT NULL AND deleted_at IS NULL`,
      [code],
    );
    if (!row || !row.content) return null;
    return {
      id: row.id,
      namaFile: row.filename,
      mimeType: row.mime_type,
      ukuranBytes: row.size_bytes,
      buffer: row.content,
    };
  }
}
