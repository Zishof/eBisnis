/**
 * Dapur dan katering (EP-S6) — sisi basis datanya.
 *
 * Stok bahan mengikuti pola yang SAMA dengan saldo dompet santri
 * (`pesantren-dompet.service.ts`, EP-L): `stok_saat_ini` HANYA berubah
 * bersamaan dengan baris log pada transaksi yang sama (`SELECT ... FOR
 * UPDATE`), dan dua permintaan pengurangan stok bersamaan tidak pernah
 * membuat stok negatif tanpa ketahuan.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasukanBahan,
  MasukanKonsumsi,
  MasukanMenu,
  MasukanTransaksiStok,
  validasiBahan,
  validasiKonsumsi,
  validasiMenu,
  validasiTransaksiStok,
} from './pesantren-katering';

export interface BarisMenu {
  id: string;
  tanggal: string;
  waktu_makan: string;
  nama_menu: string;
  deskripsi: string | null;
  jumlah_porsi_disiapkan: number | null;
  status: string;
  created_at: string;
}

const KOLOM_MENU = `id::text, tanggal::text, waktu_makan, nama_menu, deskripsi, jumlah_porsi_disiapkan,
  status, created_at::text`;

export interface BarisKonsumsi {
  id: string;
  menu_id: string;
  asrama_id: string | null;
  jumlah_porsi: number;
  catatan: string | null;
  created_at: string;
}

const KOLOM_KONSUMSI = `id::text, menu_id::text, asrama_id::text, jumlah_porsi, catatan, created_at::text`;

export interface BarisBahan {
  id: string;
  nama_bahan: string;
  satuan: string;
  stok_saat_ini: string;
  stok_minimum: string | null;
  is_active: boolean;
  created_at: string;
}

const KOLOM_BAHAN = `id::text, nama_bahan, satuan, stok_saat_ini::text, stok_minimum::text, is_active, created_at::text`;

export interface BarisTransaksiStok {
  id: string;
  bahan_id: string;
  jenis: string;
  jumlah: string;
  stok_sesudah: string;
  keterangan: string | null;
  created_at: string;
}

const KOLOM_TRANSAKSI_STOK = `id::text, bahan_id::text, jenis, jumlah::text, stok_sesudah::text, keterangan, created_at::text`;

@Injectable()
export class PesantrenKateringService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Menu makan ------------------------------------------------------------

  async daftarMenu(schemaName: string, opsi: { dari?: string; sampai?: string }): Promise<BarisMenu[]> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (opsi.dari) {
      params.push(opsi.dari);
      kondisi.push(`tanggal >= $${params.length}`);
    }
    if (opsi.sampai) {
      params.push(opsi.sampai);
      kondisi.push(`tanggal <= $${params.length}`);
    }
    return this.tenantDb.query<BarisMenu>(
      schemaName,
      `SELECT ${KOLOM_MENU} FROM ${S}.pesantren_menu_makan
        WHERE ${kondisi.join(' AND ')}
        ORDER BY tanggal DESC, waktu_makan`,
      params,
    );
  }

  async catatMenu(schemaName: string, masukan: MasukanMenu, createdBy: string): Promise<BarisMenu> {
    const galat = validasiMenu(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisMenu>(
        schemaName,
        `INSERT INTO ${S}.pesantren_menu_makan (tanggal, waktu_makan, nama_menu, deskripsi, jumlah_porsi_disiapkan, created_by, updated_by)
         VALUES (COALESCE($1, CURRENT_DATE), $2, $3, $4, $5, $6, $6)
         RETURNING ${KOLOM_MENU}`,
        [
          masukan.tanggal ? new Date(masukan.tanggal) : null,
          masukan.waktuMakan,
          masukan.namaMenu!.trim(),
          bersihkan(masukan.deskripsi),
          masukan.jumlahPorsiDisiapkan ?? null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_menu_makan_slot')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Sudah ada menu untuk tanggal dan waktu makan ini.');
      }
      throw error;
    }
  }

  async ubahStatusMenu(schemaName: string, id: string, status: string, actorUserId: string): Promise<BarisMenu> {
    const S = `"${schemaName}"`;
    const menu = await this.tenantDb.queryOne<BarisMenu>(
      schemaName,
      `SELECT ${KOLOM_MENU} FROM ${S}.pesantren_menu_makan WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!menu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Menu tidak ditemukan.');
    }
    const rows = await this.tenantDb.query<BarisMenu>(
      schemaName,
      `UPDATE ${S}.pesantren_menu_makan
          SET status = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_MENU}`,
      [id, status, actorUserId],
    );
    return rows[0];
  }

  // --- Konsumsi ----------------------------------------------------------

  async daftarKonsumsi(schemaName: string, menuId: string): Promise<BarisKonsumsi[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisKonsumsi>(
      schemaName,
      `SELECT ${KOLOM_KONSUMSI} FROM ${S}.pesantren_konsumsi WHERE menu_id = $1 AND deleted_at IS NULL ORDER BY created_at`,
      [menuId],
    );
  }

  async catatKonsumsi(schemaName: string, masukan: MasukanKonsumsi, createdBy: string): Promise<BarisKonsumsi> {
    const galat = validasiKonsumsi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const menu = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_menu_makan WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.menuId],
    );
    if (!menu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Menu tidak ditemukan.');
    }
    if (masukan.asramaId) {
      const asrama = await this.tenantDb.queryOne(
        schemaName,
        `SELECT id FROM ${S}.pesantren_asrama WHERE id = $1 AND deleted_at IS NULL`,
        [masukan.asramaId],
      );
      if (!asrama) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Asrama tidak ditemukan.');
      }
    }
    const rows = await this.tenantDb.query<BarisKonsumsi>(
      schemaName,
      `INSERT INTO ${S}.pesantren_konsumsi (menu_id, asrama_id, jumlah_porsi, catatan, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5)
       RETURNING ${KOLOM_KONSUMSI}`,
      [masukan.menuId, masukan.asramaId || null, masukan.jumlahPorsi, bersihkan(masukan.catatan), createdBy],
    );
    return rows[0];
  }

  // --- Stok bahan --------------------------------------------------------

  async daftarBahan(schemaName: string): Promise<BarisBahan[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisBahan>(
      schemaName,
      `SELECT ${KOLOM_BAHAN} FROM ${S}.pesantren_stok_dapur WHERE deleted_at IS NULL ORDER BY nama_bahan`,
    );
  }

  /** Bahan dengan stok di bawah ambang minimum -- dihitung langsung dari cache stok. */
  async bahanStokMenipis(schemaName: string): Promise<BarisBahan[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisBahan>(
      schemaName,
      `SELECT ${KOLOM_BAHAN} FROM ${S}.pesantren_stok_dapur
        WHERE deleted_at IS NULL AND stok_minimum IS NOT NULL AND stok_saat_ini < stok_minimum
        ORDER BY nama_bahan`,
    );
  }

  async catatBahan(schemaName: string, masukan: MasukanBahan, createdBy: string): Promise<BarisBahan> {
    const galat = validasiBahan(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    try {
      const rows = await this.tenantDb.query<BarisBahan>(
        schemaName,
        `INSERT INTO ${S}.pesantren_stok_dapur (nama_bahan, satuan, stok_minimum, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4)
         RETURNING ${KOLOM_BAHAN}`,
        [masukan.namaBahan!.trim(), masukan.satuan!.trim(), masukan.stokMinimum ?? null, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_stok_dapur_nama')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, `Bahan "${masukan.namaBahan}" sudah terdaftar.`);
      }
      throw error;
    }
  }

  async daftarTransaksiStok(schemaName: string, bahanId: string): Promise<BarisTransaksiStok[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisTransaksiStok>(
      schemaName,
      `SELECT ${KOLOM_TRANSAKSI_STOK} FROM ${S}.pesantren_stok_dapur_transaksi
        WHERE bahan_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [bahanId],
    );
  }

  /**
   * Mencatat pergerakan stok. MASUK menambah, KELUAR mengurangi (ditolak
   * bila membuat stok negatif), PENYESUAIAN menimpa langsung ke nilai
   * `jumlah` (stok opname) -- ketiganya dalam satu transaksi terkunci baris
   * yang sama dengan `pesantren-dompet.service.ts`.
   */
  async catatTransaksiStok(schemaName: string, masukan: MasukanTransaksiStok, createdBy: string): Promise<BarisTransaksiStok> {
    const galat = validasiTransaksiStok(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    return this.tenantDb.transaction(schemaName, async (client) => {
      const bahanRes = await client.query<{ id: string; stok_saat_ini: string }>(
        `SELECT id, stok_saat_ini::text FROM ${S}.pesantren_stok_dapur WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [masukan.bahanId],
      );
      const bahan = bahanRes.rows[0];
      if (!bahan) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Bahan tidak ditemukan.');
      }

      const stokSekarang = Number(bahan.stok_saat_ini);
      const jumlah = masukan.jumlah!;
      let stokBaru: number;
      if (masukan.jenis === 'MASUK') {
        stokBaru = stokSekarang + jumlah;
      } else if (masukan.jenis === 'KELUAR') {
        if (jumlah > stokSekarang) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Stok tidak cukup. Stok saat ini ${stokSekarang}, diminta keluar ${jumlah}.`,
          );
        }
        stokBaru = stokSekarang - jumlah;
      } else {
        stokBaru = jumlah;
      }

      await client.query(
        `UPDATE ${S}.pesantren_stok_dapur
            SET stok_saat_ini = $2, updated_at = now(), updated_by = $3, version = version + 1
          WHERE id = $1`,
        [masukan.bahanId, stokBaru, createdBy],
      );

      const hasil = await client.query<BarisTransaksiStok>(
        `INSERT INTO ${S}.pesantren_stok_dapur_transaksi (bahan_id, jenis, jumlah, stok_sesudah, keterangan, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING ${KOLOM_TRANSAKSI_STOK}`,
        [masukan.bahanId, masukan.jenis, jumlah, stokBaru, bersihkan(masukan.keterangan), createdBy],
      );
      return hasil.rows[0];
    });
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
