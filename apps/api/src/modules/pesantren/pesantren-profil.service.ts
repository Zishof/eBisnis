/**
 * Pengaturan situs publik pondok — sisi basis datanya. Satu baris tunggal
 * per skema penyewa (`singleton = TRUE`), lihat migrasi
 * `20260803T010000__pesantren__situs_publik.sql`.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { TenantFileBlobService } from '../../infrastructure/files/tenant-file-blob.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { sanitizeRichText } from '../../common/security/rich-text-sanitizer';
import {
  KategoriGambarProfil,
  KODE_BERKAS_GAMBAR_PROFIL,
  lintasanGambarProfil,
  MasukanProfil,
  validasiProfil,
} from './pesantren-profil';

export interface BarisProfil {
  is_published: boolean;
  theme_code: string;
  nama_tampilan: string | null;
  tagline: string | null;
  muqodimah_html: string | null;
  sejarah_html: string | null;
  visi: string | null;
  misi: string | null;
  pengasuh: string | null;
  tahun_berdiri: number | null;
  afiliasi: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  alamat_publik: string | null;
  kontak_telepon: string | null;
  kontak_whatsapp: string | null;
  kontak_email: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
  meta_description: string | null;
}

const KOLOM_PROFIL = `is_published, theme_code, nama_tampilan, tagline, muqodimah_html, sejarah_html, visi, misi,
  pengasuh, tahun_berdiri, afiliasi, logo_url, hero_image_url, hero_image_attribution, alamat_publik,
  kontak_telepon, kontak_whatsapp, kontak_email, map_embed_url, instagram_url, meta_description`;

@Injectable()
export class PesantrenProfilService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly fileBlob: TenantFileBlobService,
  ) {}

  /**
   * Baris pengaturan situs, membuatnya bila belum ada (bawaan belum
   * diterbitkan). Dipanggil baik oleh admin (untuk formulir pengaturan)
   * maupun situs publik (yang lalu memeriksa `is_published` sendiri).
   */
  async ambil(schemaName: string): Promise<BarisProfil> {
    const S = `"${schemaName}"`;
    const ada = await this.tenantDb.queryOne<BarisProfil>(
      schemaName,
      `SELECT ${KOLOM_PROFIL} FROM ${S}.pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (ada) return ada;

    const dibuat = await this.tenantDb.query<BarisProfil>(
      schemaName,
      `INSERT INTO ${S}.pesantren_website_setting (singleton) VALUES (TRUE)
       ON CONFLICT (singleton) DO UPDATE SET singleton = TRUE
       RETURNING ${KOLOM_PROFIL}`,
    );
    return dibuat[0];
  }

  async perbarui(schemaName: string, masukan: MasukanProfil, actorUserId: string): Promise<BarisProfil> {
    const galat = validasiProfil(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    await this.ambil(schemaName); // pastikan barisnya ada

    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisProfil>(
      schemaName,
      `UPDATE ${S}.pesantren_website_setting
          SET is_published = COALESCE($1, is_published),
              theme_code = COALESCE($2, theme_code),
              nama_tampilan = COALESCE($3, nama_tampilan),
              tagline = COALESCE($4, tagline),
              muqodimah_html = COALESCE($5, muqodimah_html),
              sejarah_html = COALESCE($6, sejarah_html),
              visi = COALESCE($7, visi),
              misi = COALESCE($8, misi),
              pengasuh = COALESCE($9, pengasuh),
              tahun_berdiri = COALESCE($10, tahun_berdiri),
              afiliasi = COALESCE($11, afiliasi),
              logo_url = COALESCE($12, logo_url),
              hero_image_url = COALESCE($13, hero_image_url),
              hero_image_attribution = COALESCE($14, hero_image_attribution),
              alamat_publik = COALESCE($15, alamat_publik),
              kontak_telepon = COALESCE($16, kontak_telepon),
              kontak_whatsapp = COALESCE($17, kontak_whatsapp),
              kontak_email = COALESCE($18, kontak_email),
              map_embed_url = COALESCE($19, map_embed_url),
              instagram_url = COALESCE($20, instagram_url),
              meta_description = COALESCE($21, meta_description),
              updated_at = now(), updated_by = $22, version = version + 1
        WHERE singleton = TRUE
        RETURNING ${KOLOM_PROFIL}`,
      [
        masukan.isPublished ?? null,
        bersihkan(masukan.themeCode),
        bersihkan(masukan.namaTampilan),
        bersihkan(masukan.tagline),
        bersihkanHtml(masukan.muqodimahHtml),
        bersihkanHtml(masukan.sejarahHtml),
        bersihkan(masukan.visi),
        bersihkan(masukan.misi),
        bersihkan(masukan.pengasuh),
        masukan.tahunBerdiri ?? null,
        bersihkan(masukan.afiliasi),
        bersihkan(masukan.logoUrl),
        bersihkan(masukan.heroImageUrl),
        bersihkan(masukan.heroImageAttribution),
        bersihkan(masukan.alamatPublik),
        bersihkan(masukan.kontakTelepon),
        bersihkan(masukan.kontakWhatsapp),
        bersihkan(masukan.kontakEmail),
        bersihkan(masukan.mapEmbedUrl),
        bersihkan(masukan.instagramUrl),
        bersihkan(masukan.metaDescription),
        actorUserId,
      ],
    );
    return rows[0];
  }

  /**
   * Menyimpan logo/gambar latar SEBAGAI DATA (Large Object, lihat
   * `TenantFileBlobService`) dan menunjuk `logo_url`/`hero_image_url` ke
   * lintasan publik yang menyajikannya. Mengunggah ulang MENGGANTI gambar
   * lama pada kategori yang sama, bukan menambah lampiran baru -- logo
   * pondok hanya ada satu yang berlaku di satu waktu.
   */
  async unggahGambar(
    schemaName: string,
    kategori: KategoriGambarProfil,
    berkas: { filename: string; mimeType: string; buffer: Buffer },
    actorUserId: string,
  ): Promise<BarisProfil> {
    await this.ambil(schemaName); // pastikan barisnya ada

    await this.fileBlob.simpanTunggal(
      schemaName,
      {
        code: KODE_BERKAS_GAMBAR_PROFIL[kategori],
        name: kategori === 'LOGO' ? 'Logo pondok' : 'Gambar latar situs',
        filename: berkas.filename,
        mimeType: berkas.mimeType,
        buffer: berkas.buffer,
      },
      actorUserId,
    );

    const kolom = kategori === 'LOGO' ? 'logo_url' : 'hero_image_url';
    /*
     * Gambar latar yang BARU DIUNGGAH bukan lagi foto bawaan (Wikimedia,
     * lihat scripts/onboard-raudlatul-ulum/assets/ATTRIBUTION.md) --
     * keterangan sumber lama WAJIB ikut dikosongkan, supaya foto pengurus
     * sendiri tidak tertera "kredit" fotografer yang tidak pernah
     * memotretnya. Diam-diam benar untuk LOGO (kolom itu memang tidak
     * pernah dipakai) dan diam-diam benar pula bila belum ada atribusi
     * tersimpan sama sekali.
     */
    const kosongkanAtribusi = kategori === 'HERO' ? `, hero_image_attribution = NULL` : '';
    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisProfil>(
      schemaName,
      `UPDATE ${S}.pesantren_website_setting
          SET ${kolom} = $1, updated_at = now(), updated_by = $2, version = version + 1${kosongkanAtribusi}
        WHERE singleton = TRUE
        RETURNING ${KOLOM_PROFIL}`,
      [lintasanGambarProfil(kategori), actorUserId],
    );
    return rows[0];
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

/** Sama dengan `bersihkan()`, ditambah sanitasi HTML (XSS) sebelum disimpan. */
function bersihkanHtml(nilai?: string | null): string | null {
  const bersih = bersihkan(nilai);
  return bersih ? sanitizeRichText(bersih) : null;
}
