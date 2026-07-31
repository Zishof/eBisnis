/**
 * Menerjemahkan host permintaan menjadi konteks penyewa, tanpa sesi (IR-005).
 *
 * Dipakai rute publik vertikal: situs koperasi, klinik, dan desa. Setiap
 * pemanggilan datang dari internet, dari pengunjung yang belum masuk.
 *
 * ## Yang membuatnya aman
 *
 * Nama skema **tidak pernah** datang dari permintaan. Yang datang dari
 * permintaan hanyalah host, dan host itu dicocokkan ke baris terdaftar di
 * control plane. Tidak ada jalur cadangan: host yang tidak cocok menghasilkan
 * 404, bukan skema bawaan dan bukan `public`.
 *
 * Aturan kelayakannya ada di `public-host.ts` sebagai fungsi murni, dan diuji
 * di sana. Berkas ini hanya menyediakan pembacaannya — dan menyimpan hasil
 * sebentar, sebab pemetaan ini dipanggil pada setiap permintaan publik.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehDipakaiMencari,
  bolehMelayaniVertikal,
  bolehMemakaiPencocokan,
  normalkanHost,
} from './public-host';

export interface KonteksPublik {
  tenantId: string;
  schemaName: string;
  auditSchemaName: string;
  vertical: string;
  host: string;
}

/**
 * Umur singgahan.
 *
 * Sengaja pendek. Pemetaan ini menentukan penyewa mana yang dilayani; sebuah
 * domain yang dicabut harus benar-benar berhenti melayani dalam hitungan
 * menit, bukan jam.
 */
const UMUR_SINGGAHAN_MS = 60_000;

interface Singgahan {
  konteks: KonteksPublik | null;
  kedaluwarsa: number;
}

@Injectable()
export class PublicTenantResolver {
  private readonly logger = new Logger(PublicTenantResolver.name);
  private readonly singgahan = new Map<string, Singgahan>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Menemukan penyewa dari host, untuk satu vertikal tertentu.
   *
   * Melempar 404 pada setiap kegagalan, dengan pesan yang selalu sama.
   * Pengunjung yang menebak tidak boleh dapat membedakan "host tidak
   * terdaftar" dari "host terdaftar tetapi penyewanya nonaktif" — perbedaan
   * itu sendiri sudah merupakan keterangan.
   */
  async resolve(rawHost: string | undefined, vertical: string): Promise<KonteksPublik> {
    const host = normalkanHost(rawHost);
    const gerbang = bolehDipakaiMencari(host);
    if (!gerbang.allowed || !host) {
      // Tidak menyentuh basis data sama sekali. Yang ditolak di sini tidak
      // pernah menjadi kueri, sehingga tidak ada yang dapat disimpulkan dari
      // lama jawabannya.
      throw this.tidakDitemukan(gerbang.code ?? 'HOST_INVALID');
    }

    const kunci = `${host}|${vertical}`;
    const tersimpan = this.singgahan.get(kunci);
    if (tersimpan && tersimpan.kedaluwarsa > Date.now()) {
      if (!tersimpan.konteks) throw this.tidakDitemukan('CACHED_MISS');
      return tersimpan.konteks;
    }

    const konteks = await this.cari(host, vertical);
    this.singgahan.set(kunci, {
      konteks,
      kedaluwarsa: Date.now() + UMUR_SINGGAHAN_MS,
    });

    if (!konteks) throw this.tidakDitemukan('NOT_MATCHED');
    return konteks;
  }

  private async cari(host: string, vertical: string): Promise<KonteksPublik | null> {
    const domain = await this.prisma.verticalSiteDomain.findUnique({
      where: { host },
      select: {
        host: true,
        tenantId: true,
        vertical: true,
        status: true,
        verifiedAt: true,
      },
    });

    if (!domain) return null;

    /*
     * Kecocokan vertikal diperiksa sebelum penyewanya dibaca. Situs koperasi
     * tidak boleh melayani permintaan klinik hanya karena penyewanya sama.
     */
    if (!bolehMelayaniVertikal({ ...domain, verifiedAt: domain.verifiedAt?.toISOString() ?? null }, vertical).allowed) {
      return null;
    }

    const registry = await this.prisma.tenantSchemaRegistry.findUnique({
      where: { tenantId: domain.tenantId },
      select: { tenantId: true, schemaName: true, auditSchemaName: true, status: true },
    });

    const vonis = bolehMemakaiPencocokan(
      { ...domain, verifiedAt: domain.verifiedAt?.toISOString() ?? null },
      registry
        ? { tenantId: registry.tenantId, schemaName: registry.schemaName, status: registry.status }
        : null,
    );

    if (!vonis.allowed) {
      /*
       * Dicatat pada log peladen, bukan dikirim kepada pemanggil. Alasan
       * penolakan berguna bagi yang mengelola sistem dan berguna pula bagi
       * yang sedang mencoba menembusnya.
       */
      this.logger.warn(`Host ${host} ditolak untuk vertikal ${vertical}: ${vonis.code}`);
      return null;
    }

    return {
      tenantId: registry!.tenantId,
      schemaName: registry!.schemaName,
      auditSchemaName: registry!.auditSchemaName,
      vertical,
      host,
    };
  }

  private tidakDitemukan(code: string): AppError {
    this.logger.debug(`Resolusi host publik gagal: ${code}`);
    return AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
  }

  /** Dipanggil setelah domain diubah, supaya perubahan berlaku segera. */
  invalidate(host?: string): void {
    if (!host) {
      this.singgahan.clear();
      return;
    }
    const normal = normalkanHost(host);
    for (const kunci of [...this.singgahan.keys()]) {
      if (kunci.startsWith(`${normal}|`)) this.singgahan.delete(kunci);
    }
  }
}
