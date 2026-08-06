/**
 * Resolusi properti dari subdomain (MI-3) -- `<slug>.mitrainap.id` ->
 * schemaName + properti aktif, dipakai booking engine publik (MI-9) untuk
 * berhenti menerima `schemaName` eksplisit di jalur URL.
 *
 * ## Kenapa berkas tersendiri, bukan menambah metode pada
 * `HospitalityBookingEngineService`
 *
 * Yang dijawab di sini murni "properti mana", ditentukan HOST PERMINTAAN
 * lewat `PublicTenantResolver` (IR-005) -- pola sama dengan
 * `PesantrenPublicService.situs()`. Mekanisme pencarian/pemesanan itu
 * SENDIRI (MI-9) tidak disalin ulang: begitu konteks (schemaName +
 * propertyId) diketahui, pemanggil tetap memakai
 * `HospitalityBookingEngineService`/`HospitalityBookingEngineController`
 * yang sudah ada dan sudah teruji -- "ganti sumber, bukan mekanisme", pola
 * yang sama dipakai berulang sepanjang modul hospitality (MI-6/MI-8/MI-9/
 * MI-10).
 *
 * ## Properti aktif implisit, bukan pemilih multi-properti
 *
 * Subdomain mewakili PENYEWA, dan satu penyewa dapat punya lebih dari satu
 * `hospitality_property`. Untuk fase ini, properti yang diambil adalah
 * yang PALING AWAL dibuat (bukan pemilih) -- sama seperti "properti
 * implisit aktif untuk tenant satu-properti" yang sudah dicatat sebagai
 * keterbatasan MI-5 pada requirement ledger. Pemilih multi-properti
 * sungguhan menyusul saat benar-benar dibutuhkan.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { PublicTenantResolver } from '../../infrastructure/tenant/public-tenant-resolver.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

const VERTIKAL = 'hospitality';

export interface KonteksSitusProperti {
  schemaName: string;
  propertyId: string;
  propertyName: string;
  timezone: string;
}

@Injectable()
export class HospitalityPublicSiteService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly resolver: PublicTenantResolver,
  ) {}

  async konteks(host: string | undefined): Promise<KonteksSitusProperti> {
    const domain = await this.resolver.resolve(host, VERTIKAL);
    const S = domain.schemaName;

    const properti = await this.tenantDb.queryOne<{ id: string; name: string; timezone: string }>(
      S,
      `SELECT id::text, name, timezone
         FROM "${S}".hospitality_property
        WHERE deleted_at IS NULL AND status = 'ACTIVE'
        ORDER BY created_at ASC
        LIMIT 1`,
    );

    if (!properti) {
      // Penyewa sudah terdaftar dan situsnya aktif, tetapi belum
      // menambahkan satu pun properti lewat halaman staf (MI-5) --
      // jawaban yang sama dengan host yang tidak terdaftar, sebab dari
      // sudut pandang pengunjung publik keduanya sama-sama "belum ada apa
      // pun untuk ditampilkan".
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    return {
      schemaName: S,
      propertyId: properti.id,
      propertyName: properti.name,
      timezone: properti.timezone,
    };
  }
}
