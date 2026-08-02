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
import { TenantFileBlobService, BerkasBlob } from '../../infrastructure/files/tenant-file-blob.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { KategoriGambarProfil, KODE_BERKAS_GAMBAR_PROFIL } from './pesantren-profil';
import { PesantrenPsbService, BarisPendaftar } from './pesantren-psb.service';
import { MasukanPendaftar } from './pesantren-psb';

const VERTIKAL = 'pesantren';

@Injectable()
export class PesantrenPublicService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly resolver: PublicTenantResolver,
    private readonly fileBlob: TenantFileBlobService,
    private readonly psb: PesantrenPsbService,
  ) {}

  async situs(host: string | undefined) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const profil = await this.tenantDb.queryOne<Record<string, unknown>>(
      S,
      `SELECT is_published, theme_code, nama_tampilan, tagline, muqodimah_html, sejarah_html, visi, misi,
              pengasuh, tahun_berdiri, afiliasi, logo_url, hero_image_url, hero_image_attribution, alamat_publik,
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

  /**
   * Isi logo/gambar latar situs pondok. Sama aturan penerbitannya dengan
   * `situs()` -- pondok yang belum menerbitkan situsnya tidak menyajikan
   * gambar apa pun lewat jalur publik ini, walau gambarnya sudah diunggah.
   */
  async gambar(host: string | undefined, kategori: KategoriGambarProfil): Promise<BerkasBlob> {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const berkas = await this.fileBlob.ambilByCode(S, KODE_BERKAS_GAMBAR_PROFIL[kategori]);
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    return berkas;
  }

  /**
   * Gambar sampul satu berita, disimpan lewat mekanisme BLOB yang sama
   * dengan logo/hero (lihat `TenantFileBlobService`) -- bedanya kodenya
   * bukan dari daftar tetap seperti profil, melainkan bebas per berita
   * (mis. `BERITA_SPMB_2026`). Awalan `BERITA_` diwajibkan supaya jalur
   * publik ini tidak dapat dipakai menebak/membaca kode `file_object`
   * kategori lain (logo/hero) lewat parameter yang sama.
   */
  async beritaGambar(host: string | undefined, code: string): Promise<BerkasBlob> {
    if (!code.startsWith('BERITA_')) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const berkas = await this.fileBlob.ambilByCode(S, code);
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    return berkas;
  }

  /**
   * Gelombang yang sedang DIBUKA -- satu-satunya yang boleh dipilih pada
   * formulir pendaftaran publik. Sama aturan penerbitannya dengan
   * `situs()` -- pondok yang belum menerbitkan situsnya tidak menawarkan
   * pendaftaran lewat jalur publik, walau gelombangnya sudah dibuka
   * pengurus untuk dipakai lewat panel admin.
   */
  async psbGelombangDibuka(host: string | undefined) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    return this.tenantDb.query(
      S,
      `SELECT id::text, kode, nama, tanggal_buka::text, tanggal_tutup::text, biaya_pendaftaran::text
         FROM "${S}".pesantren_psb_gelombang
        WHERE status = 'DIBUKA' AND deleted_at IS NULL
        ORDER BY tanggal_buka ASC`,
    );
  }

  /**
   * Pendaftaran calon santri lewat situs publik -- TANPA aktor staf sama
   * sekali (`createdBy: null`, lihat `PesantrenPsbService.daftarkan`).
   * Aturan gelombang harus DIBUKA sudah ditegakkan `daftarkan()` sendiri;
   * di sini HANYA ditambahkan syarat situsnya sudah diterbitkan, supaya
   * pondok yang belum menerbitkan situsnya tidak diam-diam menerima
   * pendaftaran dari alamat yang belum ia umumkan ke siapa pun.
   */
  async psbDaftar(host: string | undefined, masukan: MasukanPendaftar): Promise<BarisPendaftar> {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    return this.psb.daftarkan(S, masukan, null);
  }

  /**
   * Daftar agama -- combobox formulir PSB publik. Lihat migrasi
   * `20260803T060000__pesantren__agama.sql`: tabel referensi, BUKAN diikat
   * FK ke kolom `agama` bertipe teks bebas yang sudah ada.
   */
  async daftarAgama(host: string | undefined) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;
    return this.tenantDb.query(
      S,
      `SELECT code, nama FROM "${S}".pesantren_agama WHERE is_active = TRUE ORDER BY sort_order ASC`,
    );
  }
}
