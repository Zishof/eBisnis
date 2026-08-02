/**
 * Laporan ePesantren (EP-P) — sisi basis datanya. Pola sama dengan
 * `pos-report.service.ts`: seluruhnya kueri agregasi baca-saja terhadap
 * tabel yang sudah ada di modul-modul sebelumnya (EP-A s.d. EP-O4) --
 * TIDAK ADA tabel baru, tidak ada data yang disimpan berduplikasi.
 * Nilai akhir/huruf mutu (EP-O), saldo dompet (EP-L), dan status tagihan
 * (EP-F) semuanya dibaca dari sumber yang sudah menjadi kebenaran modul
 * masing-masing, bukan dihitung ulang dengan rumus berbeda di sini.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { KodeLaporan, LAPORAN_PESANTREN, laporanDikenal, periksaRentang } from './pesantren-laporan';

export interface PermintaanLaporan {
  from?: string;
  to?: string;
  tahunAjaranId?: string;
  gelombangId?: string;
}

@Injectable()
export class PesantrenLaporanService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  daftarLaporan() {
    return LAPORAN_PESANTREN;
  }

  private async tahunAjaranAktif(schemaName: string): Promise<string | null> {
    const S = `"${schemaName}"`;
    const row = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id::text FROM ${S}.pesantren_tahun_ajaran WHERE status = 'ACTIVE' AND deleted_at IS NULL`,
    );
    return row?.id ?? null;
  }

  async jalankan(schemaName: string, code: string, req: PermintaanLaporan): Promise<unknown> {
    if (!laporanDikenal(code)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Kode laporan "${code}" tidak dikenali.`, {
        tersedia: LAPORAN_PESANTREN.map((l) => l.code),
      });
    }
    const S = `"${schemaName}"`;

    switch (code as KodeLaporan) {
      case 'SANTRI_RINGKASAN':
        return this.tenantDb.query(
          schemaName,
          `SELECT status, jenis_kelamin, status_tinggal, COUNT(*)::int AS jumlah
             FROM ${S}.pesantren_santri
            WHERE deleted_at IS NULL
            GROUP BY status, jenis_kelamin, status_tinggal
            ORDER BY status, jenis_kelamin, status_tinggal`,
        );

      case 'PRESENSI_REKAP': {
        const rentang = this.rentangWajib(req);
        return this.tenantDb.query(
          schemaName,
          `SELECT jenis, status, COUNT(*)::int AS jumlah
             FROM ${S}.pesantren_presensi
            WHERE tanggal BETWEEN $1 AND $2 AND deleted_at IS NULL
            GROUP BY jenis, status
            ORDER BY jenis, status`,
          [rentang.from, rentang.to],
        );
      }

      case 'TAGIHAN_REKAP': {
        const rows = await this.tenantDb.query<{
          periode: string;
          status: string;
          jumlah: number;
          total: string;
        }>(
          schemaName,
          `SELECT periode, status, COUNT(*)::int AS jumlah, COALESCE(SUM(total_tagihan), 0)::text AS total
             FROM ${S}.pesantren_tagihan
            WHERE deleted_at IS NULL
            GROUP BY periode, status
            ORDER BY periode DESC, status`,
        );
        return rows;
      }

      case 'DOMPET_ARUS': {
        const rentang = this.rentangWajib(req);
        return this.tenantDb.query(
          schemaName,
          `SELECT jenis, COUNT(*)::int AS jumlah_transaksi, COALESCE(SUM(jumlah), 0)::text AS total
             FROM ${S}.pesantren_dompet_transaksi
            WHERE created_at::date BETWEEN $1 AND $2
            GROUP BY jenis
            ORDER BY jenis`,
          [rentang.from, rentang.to],
        );
      }

      case 'NILAI_RATA': {
        const tahunAjaranId = req.tahunAjaranId || (await this.tahunAjaranAktif(schemaName));
        if (!tahunAjaranId) {
          throw AppError.badRequest(
            ErrorCodes.VALIDATION_FAILED,
            'Tidak ada tahun ajaran ACTIVE dan tahunAjaranId tidak diisi.',
          );
        }
        return this.tenantDb.query(
          schemaName,
          `SELECT mp.nama AS mata_pelajaran, kn.nama AS komponen,
                  COUNT(n.id)::int AS jumlah_nilai, ROUND(AVG(n.nilai_angka), 2) AS rata_rata
             FROM ${S}.pesantren_komponen_nilai kn
             JOIN ${S}.pesantren_mata_pelajaran mp ON mp.id = kn.mata_pelajaran_id
             LEFT JOIN ${S}.pesantren_nilai n
               ON n.komponen_id = kn.id AND n.tahun_ajaran_id = $1 AND n.deleted_at IS NULL
            WHERE kn.deleted_at IS NULL AND mp.deleted_at IS NULL
            GROUP BY mp.nama, kn.nama
            ORDER BY mp.nama, kn.nama`,
          [tahunAjaranId],
        );
      }

      case 'PSB_FUNNEL':
        return this.tenantDb.query(
          schemaName,
          `SELECT g.id::text AS gelombang_id, g.nama AS gelombang, pd.status, COUNT(*)::int AS jumlah
             FROM ${S}.pesantren_psb_pendaftar pd
             JOIN ${S}.pesantren_psb_gelombang g ON g.id = pd.gelombang_id
            WHERE pd.deleted_at IS NULL
              AND ($1::uuid IS NULL OR pd.gelombang_id = $1)
            GROUP BY g.id, g.nama, pd.status
            ORDER BY g.nama, pd.status`,
          [req.gelombangId || null],
        );

      case 'ASRAMA_HUNIAN':
        return this.tenantDb.query(
          schemaName,
          `SELECT a.nama AS asrama, a.jenis, k.nomor, k.kapasitas,
                  COUNT(p.id) FILTER (WHERE p.tanggal_selesai IS NULL AND p.deleted_at IS NULL)::int AS terisi
             FROM ${S}.pesantren_kamar k
             JOIN ${S}.pesantren_asrama a ON a.id = k.asrama_id
             LEFT JOIN ${S}.pesantren_penempatan p ON p.kamar_id = k.id
            WHERE k.deleted_at IS NULL AND a.deleted_at IS NULL
            GROUP BY a.nama, a.jenis, k.nomor, k.kapasitas
            ORDER BY a.nama, k.nomor`,
        );

      case 'ROMBONGAN_HUNIAN': {
        const tahunAjaranId = req.tahunAjaranId || (await this.tahunAjaranAktif(schemaName));
        return this.tenantDb.query(
          schemaName,
          `SELECT r.nama AS rombongan, r.tingkat, r.kapasitas,
                  COUNT(ra.id) FILTER (WHERE ra.status = 'AKTIF' AND ra.deleted_at IS NULL)::int AS terisi
             FROM ${S}.pesantren_rombongan_belajar r
             LEFT JOIN ${S}.pesantren_rombongan_anggota ra ON ra.rombongan_id = r.id
            WHERE r.deleted_at IS NULL
              AND ($1::uuid IS NULL OR r.tahun_ajaran_id = $1)
            GROUP BY r.id, r.nama, r.tingkat, r.kapasitas
            ORDER BY r.tingkat, r.nama`,
          [tahunAjaranId || null],
        );
      }
    }
  }

  /**
   * Dasbor ringkas: memanggil beberapa laporan sekaligus secara paralel dan
   * menggabungkannya menjadi satu respons -- pola yang sama dengan
   * `PosReportService.dasbor()`.
   */
  async dasbor(schemaName: string): Promise<Record<string, unknown>> {
    const [santri, tagihan, asrama, rombongan, psb] = await Promise.all([
      this.jalankan(schemaName, 'SANTRI_RINGKASAN', {}),
      this.jalankan(schemaName, 'TAGIHAN_REKAP', {}),
      this.jalankan(schemaName, 'ASRAMA_HUNIAN', {}),
      this.jalankan(schemaName, 'ROMBONGAN_HUNIAN', {}),
      this.jalankan(schemaName, 'PSB_FUNNEL', {}),
    ]);
    return { santri, tagihan, asrama, rombongan, psb };
  }

  private rentangWajib(req: PermintaanLaporan) {
    const hasil = periksaRentang(req.from, req.to);
    if (!hasil.ok || !hasil.range) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, hasil.message ?? 'Rentang tanggal tidak sah.');
    }
    return hasil.range;
  }
}
