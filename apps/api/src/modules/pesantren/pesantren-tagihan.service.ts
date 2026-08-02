/**
 * Tagihan pendidikan/SPP (EP-F) — sisi basis datanya. Pola sama dengan
 * `pesantren-santri.service.ts` dan `pesantren-presensi.service.ts`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { MasukanPembayaran, MasukanTagihan, totalTagihan, validasiPembayaran, validasiTagihan } from './pesantren-tagihan';

export interface BarisItemTagihan {
  id: string;
  kode: string;
  deskripsi: string;
  jumlah: string;
}

export interface BarisPembayaran {
  id: string;
  tagihan_id: string;
  jumlah_bayar: string;
  metode: string;
  tanggal_bayar: string;
  catatan: string | null;
  created_at: string;
}

export interface BarisTagihan {
  id: string;
  santri_id: string;
  periode: string;
  status: string;
  jatuh_tempo: string;
  total_tagihan: string;
  catatan: string | null;
  diterbitkan_pada: string | null;
  created_at: string;
  items?: BarisItemTagihan[];
  pembayaran?: BarisPembayaran[];
}

const STATUS_SANTRI_BOLEH_DITAGIH = ['AKTIF'];
const STATUS_BOLEH_DIBAYAR = ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'];

@Injectable()
export class PesantrenTagihanService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async daftar(
    schemaName: string,
    opsi: { status?: string; periode?: string; santriId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisTagihan[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.periode) {
      params.push(opsi.periode);
      kondisi.push(`periode = $${params.length}`);
    }
    if (opsi.santriId) {
      params.push(opsi.santriId);
      kondisi.push(`santri_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_tagihan WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisTagihan>(
      schemaName,
      `SELECT id::text, santri_id::text, periode, status, jatuh_tempo::text,
              total_tagihan::text, catatan, diterbitkan_pada::text, created_at::text
         FROM ${S}.pesantren_tagihan
        WHERE ${where}
        ORDER BY periode DESC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satu(schemaName: string, id: string): Promise<BarisTagihan | null> {
    const S = `"${schemaName}"`;
    const tagihan = await this.tenantDb.queryOne<BarisTagihan>(
      schemaName,
      `SELECT id::text, santri_id::text, periode, status, jatuh_tempo::text,
              total_tagihan::text, catatan, diterbitkan_pada::text, created_at::text
         FROM ${S}.pesantren_tagihan
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!tagihan) return null;

    const items = await this.tenantDb.query<BarisItemTagihan>(
      schemaName,
      `SELECT id::text, kode, deskripsi, jumlah::text
         FROM ${S}.pesantren_tagihan_item
        WHERE tagihan_id = $1
        ORDER BY sort_order ASC`,
      [id],
    );
    const pembayaran = await this.tenantDb.query<BarisPembayaran>(
      schemaName,
      `SELECT id::text, tagihan_id::text, jumlah_bayar::text, metode, tanggal_bayar::text, catatan, created_at::text
         FROM ${S}.pesantren_tagihan_pembayaran
        WHERE tagihan_id = $1
        ORDER BY tanggal_bayar ASC, created_at ASC`,
      [id],
    );
    return { ...tagihan, items, pembayaran };
  }

  /**
   * Membuat tagihan baru berstatus DRAFT beserta rinciannya.
   *
   * Hanya santri berstatus AKTIF yang dapat ditagih — §6 perintah master
   * melarang keras menagihkan santri yang sudah efektif keluar. Satu tagihan
   * per santri per periode ditegakkan basis data lewat indeks parsial;
   * pelanggaran diterjemahkan ke pesan yang dapat dipahami.
   */
  async catat(schemaName: string, masukan: MasukanTagihan, createdBy: string): Promise<BarisTagihan> {
    const galat = validasiTagihan(masukan);
    if (galat.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ada isian yang belum benar. Periksa kembali formulir.',
        { errors: galat },
      );
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
    if (!STATUS_SANTRI_BOLEH_DITAGIH.includes(santri.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Santri berstatus "${santri.status}" tidak dapat ditagih. Hanya santri AKTIF yang dapat menerima tagihan baru.`,
      );
    }

    const total = totalTagihan(masukan.items!);

    try {
      return await this.tenantDb.transaction(schemaName, async (client) => {
        const hasil = await client.query<{
          id: string;
          santri_id: string;
          periode: string;
          status: string;
          jatuh_tempo: string;
          total_tagihan: string;
          catatan: string | null;
          diterbitkan_pada: string | null;
          created_at: string;
        }>(
          `INSERT INTO ${S}.pesantren_tagihan
             (santri_id, periode, jatuh_tempo, total_tagihan, catatan, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $6)
           RETURNING id::text, santri_id::text, periode, status, jatuh_tempo::text,
                     total_tagihan::text, catatan, diterbitkan_pada::text, created_at::text`,
          [masukan.santriId, masukan.periode, masukan.jatuhTempo, total, bersihkan(masukan.catatan), createdBy],
        );
        const tagihan = hasil.rows[0];

        const items: BarisItemTagihan[] = [];
        for (const [index, item] of masukan.items!.entries()) {
          const hasilItem = await client.query<BarisItemTagihan>(
            `INSERT INTO ${S}.pesantren_tagihan_item (tagihan_id, kode, deskripsi, jumlah, sort_order)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id::text, kode, deskripsi, jumlah::text`,
            [tagihan.id, item.kode!.trim(), item.deskripsi!.trim(), item.jumlah, index],
          );
          items.push(hasilItem.rows[0]);
        }

        return { ...tagihan, items };
      });
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_tagihan_satu_per_periode')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Santri ini sudah punya tagihan untuk periode ${masukan.periode}. ` +
            'Batalkan (VOID) tagihan lama terlebih dahulu bila memang perlu dibuat ulang.',
        );
      }
      throw error;
    }
  }

  /** Menerbitkan tagihan DRAFT sehingga terlihat wali sebagai tagihan resmi. */
  async terbitkan(schemaName: string, id: string, actorUserId: string): Promise<BarisTagihan> {
    const S = `"${schemaName}"`;
    const tagihan = await this.tenantDb.queryOne<{ status: string }>(
      schemaName,
      `SELECT status FROM ${S}.pesantren_tagihan WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!tagihan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tagihan tidak ditemukan.');
    }
    if (tagihan.status !== 'DRAFT') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Tagihan berstatus "${tagihan.status}" tidak dapat diterbitkan. Hanya tagihan berstatus DRAFT yang dapat diterbitkan.`,
      );
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE ${S}.pesantren_tagihan
          SET status = 'ISSUED', diterbitkan_pada = now(), diterbitkan_oleh = $2,
              updated_at = now(), updated_by = $2, version = version + 1
        WHERE id = $1`,
      [id, actorUserId],
    );

    return (await this.satu(schemaName, id))!;
  }

  /**
   * Mencatat satu setoran pembayaran atas tagihan yang sudah diterbitkan.
   *
   * Status tagihan DIHITUNG ULANG dari jumlah seluruh baris pembayaran yang
   * tercatat (termasuk yang baru ini) dibandingkan `total_tagihan` -- bukan
   * ditulis manual terpisah, supaya status tidak pernah menyimpang dari
   * jumlah yang benar-benar tercatat. Pembayaran boleh dicatat bertahap
   * (cicilan): setoran pertama yang belum mencapai total membuat status
   * PARTIALLY_PAID, dan hanya berubah PAID ketika akumulasinya mencukupi.
   */
  async bayar(schemaName: string, id: string, masukan: MasukanPembayaran, actorUserId: string): Promise<BarisTagihan> {
    const galat = validasiPembayaran(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const S = `"${schemaName}"`;
    const tagihan = await this.tenantDb.queryOne<{ status: string; total_tagihan: string }>(
      schemaName,
      `SELECT status, total_tagihan::text FROM ${S}.pesantren_tagihan WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (!tagihan) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tagihan tidak ditemukan.');
    }
    if (!STATUS_BOLEH_DIBAYAR.includes(tagihan.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Tagihan berstatus "${tagihan.status}" tidak dapat menerima pembayaran. ` +
          `Status saat ini harus salah satu dari: ${STATUS_BOLEH_DIBAYAR.join(', ')}.`,
      );
    }

    await this.tenantDb.transaction(schemaName, async (client) => {
      await client.query(
        `INSERT INTO ${S}.pesantren_tagihan_pembayaran
           (tagihan_id, jumlah_bayar, metode, tanggal_bayar, catatan, dicatat_oleh)
         VALUES ($1, $2, $3, COALESCE($4, CURRENT_DATE), $5, $6)`,
        [id, masukan.jumlahBayar, masukan.metode, masukan.tanggalBayar ?? null, bersihkan(masukan.catatan), actorUserId],
      );

      const total = await client.query<{ terbayar: string }>(
        `SELECT COALESCE(SUM(jumlah_bayar), 0)::text AS terbayar
           FROM ${S}.pesantren_tagihan_pembayaran WHERE tagihan_id = $1`,
        [id],
      );
      const terbayar = Number(total.rows[0].terbayar);
      const statusBaru = terbayar >= Number(tagihan.total_tagihan) ? 'PAID' : 'PARTIALLY_PAID';

      await client.query(
        `UPDATE ${S}.pesantren_tagihan
            SET status = $2, updated_at = now(), updated_by = $3, version = version + 1
          WHERE id = $1`,
        [id, statusBaru, actorUserId],
      );
    });

    return (await this.satu(schemaName, id))!;
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

/** Kode error PostgreSQL 23505 = unique_violation. */
function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
