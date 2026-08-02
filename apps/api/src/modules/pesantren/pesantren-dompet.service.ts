/**
 * Dompet santri (EP-L) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts`.
 *
 * Berbeda dari kapasitas kamar EP-G (yang mendokumentasikan keterbatasan
 * tanpa penguncian baris), transaksi dompet menyangkut uang -- pemeriksaan
 * saldo dan penulisan baris baru berada dalam SATU transaksi dengan
 * `SELECT ... FOR UPDATE` pada baris dompetnya, sehingga dua permintaan
 * belanja bersamaan pada dompet yang sama tidak dapat keduanya lolos
 * pemeriksaan saldo sebelum salah satu menuliskan hasilnya.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanDompet, MasukanTransaksi, validasiDompet, validasiTransaksi } from './pesantren-dompet';

export interface BarisDompet {
  id: string;
  santri_id: string;
  saldo: string;
  batas_harian: string | null;
  is_active: boolean;
}

export interface BarisTransaksi {
  id: string;
  jenis: string;
  jumlah: string;
  saldo_sesudah: string;
  keterangan: string | null;
  created_at: string;
}

@Injectable()
export class PesantrenDompetService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(schemaName: string): Promise<BarisDompet[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisDompet>(
      schemaName,
      `SELECT id::text, santri_id::text, saldo::text, batas_harian::text, is_active
         FROM ${S}.pesantren_dompet
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC`,
    );
  }

  async satuOlehSantri(schemaName: string, santriId: string): Promise<BarisDompet | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisDompet>(
      schemaName,
      `SELECT id::text, santri_id::text, saldo::text, batas_harian::text, is_active
         FROM ${S}.pesantren_dompet
        WHERE santri_id = $1 AND deleted_at IS NULL`,
      [santriId],
    );
  }

  async riwayat(schemaName: string, dompetId: string, opsi: { halaman: number; ukuranHalaman: number }) {
    const S = `"${schemaName}"`;
    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_dompet_transaksi WHERE dompet_id = $1`,
      [dompetId],
    );
    const items = await this.tenantDb.query<BarisTransaksi>(
      schemaName,
      `SELECT id::text, jenis, jumlah::text, saldo_sesudah::text, keterangan, created_at::text
         FROM ${S}.pesantren_dompet_transaksi
        WHERE dompet_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
      [dompetId, opsi.ukuranHalaman, offset],
    );
    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async buat(schemaName: string, masukan: MasukanDompet, createdBy: string): Promise<BarisDompet> {
    const galat = validasiDompet(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const santri = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.santriId],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Santri tidak ditemukan.');
    }

    try {
      const rows = await this.tenantDb.query<BarisDompet>(
        schemaName,
        `INSERT INTO ${S}.pesantren_dompet (santri_id, batas_harian, created_by, updated_by)
         VALUES ($1, $2, $3, $3)
         RETURNING id::text, santri_id::text, saldo::text, batas_harian::text, is_active`,
        [masukan.santriId, masukan.batasHarian ?? null, createdBy],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_dompet_santri')) {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Santri ini sudah punya dompet.');
      }
      throw error;
    }
  }

  async topup(schemaName: string, dompetId: string, masukan: MasukanTransaksi, dicatatOleh: string): Promise<BarisTransaksi> {
    return this.transaksi(schemaName, dompetId, 'TOPUP', masukan, dicatatOleh);
  }

  /**
   * Mencatat belanja. Ditolak bila melebihi saldo atau batas harian.
   *
   * `dicatatOleh` opsional -- EP-N memanggil ini dari `capture()` milik
   * `PesantrenDompetPaymentHandler`, yang tidak punya pengguna platform yang
   * bertindak (kasir mengoperasikan POS, bukan dompet ini secara langsung).
   */
  async belanja(schemaName: string, dompetId: string, masukan: MasukanTransaksi, dicatatOleh?: string): Promise<BarisTransaksi> {
    return this.transaksi(schemaName, dompetId, 'BELANJA', masukan, dicatatOleh);
  }

  private async transaksi(
    schemaName: string,
    dompetId: string,
    jenis: 'TOPUP' | 'BELANJA',
    masukan: MasukanTransaksi,
    dicatatOleh?: string,
  ): Promise<BarisTransaksi> {
    const galat = validasiTransaksi(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    return this.tenantDb.transaction(schemaName, async (client) => {
      const dompetRes = await client.query<{ id: string; saldo: string; batas_harian: string | null; is_active: boolean }>(
        `SELECT id, saldo::text, batas_harian::text, is_active
           FROM ${S}.pesantren_dompet
          WHERE id = $1 AND deleted_at IS NULL
          FOR UPDATE`,
        [dompetId],
      );
      const dompet = dompetRes.rows[0];
      if (!dompet) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Dompet tidak ditemukan.');
      }
      if (!dompet.is_active) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Dompet ini tidak aktif.');
      }

      const saldoSekarang = Number(dompet.saldo);
      const jumlah = masukan.jumlah!;
      let saldoBaru: number;

      if (jenis === 'TOPUP') {
        saldoBaru = saldoSekarang + jumlah;
      } else {
        if (jumlah > saldoSekarang) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Saldo tidak cukup. Saldo saat ini Rp${saldoSekarang.toLocaleString('id-ID')}, belanja Rp${jumlah.toLocaleString('id-ID')}.`,
          );
        }
        if (dompet.batas_harian) {
          const batas = Number(dompet.batas_harian);
          const belanjaHariIniRes = await client.query<{ total: string }>(
            `SELECT COALESCE(SUM(jumlah), 0)::text AS total
               FROM ${S}.pesantren_dompet_transaksi
              WHERE dompet_id = $1 AND jenis = 'BELANJA' AND created_at::date = CURRENT_DATE`,
            [dompetId],
          );
          const sudahBelanja = Number(belanjaHariIniRes.rows[0]?.total ?? 0);
          if (sudahBelanja + jumlah > batas) {
            throw AppError.conflict(
              ErrorCodes.CONFLICT,
              `Melebihi batas belanja harian Rp${batas.toLocaleString('id-ID')}. Sudah dibelanjakan hari ini Rp${sudahBelanja.toLocaleString('id-ID')}.`,
            );
          }
        }
        saldoBaru = saldoSekarang - jumlah;
      }

      await client.query(
        `UPDATE ${S}.pesantren_dompet
            SET saldo = $2, updated_at = now(), updated_by = $3, version = version + 1
          WHERE id = $1`,
        [dompetId, saldoBaru, dicatatOleh ?? null],
      );

      const hasil = await client.query<BarisTransaksi>(
        `INSERT INTO ${S}.pesantren_dompet_transaksi (dompet_id, jenis, jumlah, saldo_sesudah, keterangan, dicatat_oleh)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id::text, jenis, jumlah::text, saldo_sesudah::text, keterangan, created_at::text`,
        [dompetId, jenis, jumlah, saldoBaru, bersihkan(masukan.keterangan), dicatatOleh ?? null],
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
