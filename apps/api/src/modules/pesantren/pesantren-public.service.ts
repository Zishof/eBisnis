/**
 * Situs pondok untuk pengunjung yang belum masuk.
 *
 * Pola sama dengan `CooperativePublicService`: pondok mana yang dilayani
 * ditentukan HOST PERMINTAAN lewat `PublicTenantResolver` (IR-005), bukan
 * dari alamat. Situs yang belum diterbitkan (`is_published = FALSE`)
 * menjawab sama dengan host yang tidak terdaftar -- pengurus yang sedang
 * menyiapkan profilnya tidak perlu pekerjaannya terlihat sebelum siap.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { PublicTenantResolver } from '../../infrastructure/tenant/public-tenant-resolver.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

const VERTIKAL = 'pesantren';

@Injectable()
export class PesantrenPublicService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly resolver: PublicTenantResolver,
  ) {}

  async situs(host: string | undefined) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const profil = await this.tenantDb.queryOne<Record<string, unknown>>(
      S,
      `SELECT is_published, theme_code, nama_tampilan, tagline, muqodimah_html, sejarah_html, visi, misi,
              pengasuh, tahun_berdiri, afiliasi, logo_url, hero_image_url, alamat_publik,
              kontak_telepon, kontak_whatsapp, kontak_email, map_embed_url, instagram_url,
              meta_description
         FROM "${S}".pesantren_website_setting
        WHERE singleton = TRUE`,
    );

    if (!profil || profil.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const berita = await this.tenantDb.query(
      S,
      `SELECT id::text, judul, ringkasan, gambar_url, sumber_url, tanggal_terbit::text
         FROM "${S}".pesantren_berita
        WHERE status = 'TERBIT' AND deleted_at IS NULL
        ORDER BY tanggal_terbit DESC
        LIMIT 30`,
    );

    const unitPendidikan = await this.tenantDb.query(
      S,
      `SELECT code, name, jenis
         FROM "${S}".pesantren_unit_pendidikan
        WHERE is_active = TRUE AND deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
    );

    return { profil, berita, unitPendidikan };
  }

  async beritaSatu(host: string | undefined, id: string) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const row = await this.tenantDb.queryOne(
      S,
      `SELECT b.id::text, b.judul, b.ringkasan, b.isi_html, b.gambar_url, b.sumber_url,
              b.tanggal_terbit::text
         FROM "${S}".pesantren_berita b
         JOIN "${S}".pesantren_website_setting s ON s.singleton = TRUE
        WHERE b.id = $1 AND b.status = 'TERBIT' AND b.deleted_at IS NULL AND s.is_published = TRUE`,
      [id],
    );
    if (!row) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');
    }
    return row;
  }
}
