/**
 * Anjungan mandiri (EP-M) — cuplikan data diri lewat pindai kartu.
 *
 * Kelas ini SENGAJA hanya berisi satu metode baca. Akun perangkat kiosk
 * (`EPESANTREN_SERVICE_ACCOUNT_KIOSK`, profil P12) memanggilnya, bukan
 * santri yang masuk dengan akunnya sendiri — santri tidak pernah punya
 * akun login pribadi di sesi ini. Tidak ada satu pun metode tulis di sini;
 * kiosk yang disusupi karena itu tidak dapat mengubah apa pun, hanya
 * membaca cuplikan milik nomor kartu yang benar-benar dipindai.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface CuplikanKiosk {
  namaLengkap: string;
  nis: string;
  status: string;
  presensiHariIni: { jenis: string; status: string }[];
  saldoDompet: string | null;
}

@Injectable()
export class PesantrenKioskService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  async pindaiKartu(schemaName: string, nomorKartu: string): Promise<CuplikanKiosk> {
    const S = `"${schemaName}"`;
    const kartu = await this.tenantDb.queryOne<{ santri_id: string }>(
      schemaName,
      `SELECT santri_id::text FROM ${S}.pesantren_kartu
        WHERE nomor_kartu = $1 AND status = 'AKTIF' AND deleted_at IS NULL`,
      [nomorKartu],
    );
    if (!kartu) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kartu tidak dikenali atau sudah tidak aktif.');
    }

    const santri = await this.tenantDb.queryOne<{ nama_lengkap: string; nis: string; status: string }>(
      schemaName,
      `SELECT nama_lengkap, nis, status FROM ${S}.pesantren_santri WHERE id = $1 AND deleted_at IS NULL`,
      [kartu.santri_id],
    );
    if (!santri) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Data santri pemegang kartu ini tidak ditemukan.');
    }

    const presensi = await this.tenantDb.query<{ jenis: string; status: string }>(
      schemaName,
      `SELECT jenis, status FROM ${S}.pesantren_presensi
        WHERE santri_id = $1 AND tanggal = CURRENT_DATE AND deleted_at IS NULL`,
      [kartu.santri_id],
    );

    const dompet = await this.tenantDb.queryOne<{ saldo: string }>(
      schemaName,
      `SELECT saldo::text FROM ${S}.pesantren_dompet WHERE santri_id = $1 AND deleted_at IS NULL`,
      [kartu.santri_id],
    );

    return {
      namaLengkap: santri.nama_lengkap,
      nis: santri.nis,
      status: santri.status,
      presensiHariIni: presensi,
      saldoDompet: dompet?.saldo ?? null,
    };
  }
}
