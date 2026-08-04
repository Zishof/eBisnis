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
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { PublicTenantResolver } from '../../infrastructure/tenant/public-tenant-resolver.service';
import { TenantFileBlobService, BerkasBlob } from '../../infrastructure/files/tenant-file-blob.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { KategoriGambarProfil, KODE_BERKAS_GAMBAR_PROFIL } from './pesantren-profil';
import { KategoriGambarUnitPendidikan, kodeBerkasGambarUnit } from './pesantren-unit-pendidikan';
import { kodeBerkasMediaPesantren } from './pesantren-media';
import { PesantrenPsbService, BarisPendaftar } from './pesantren-psb.service';
import { MasukanPendaftar } from './pesantren-psb';
import { PSB_APPLICANT_TOKEN_TYPE, PsbApplicantTokenPayload } from './psb-applicant-auth.guard';

const VERTIKAL = 'pesantren';

/** TTL sesi portal pendaftar -- lihat `PsbApplicantAuthGuard` untuk alasannya. */
const PSB_PORTAL_TTL = '45m';
const PSB_PORTAL_TTL_DETIK = 45 * 60;

@Injectable()
export class PesantrenPublicService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly resolver: PublicTenantResolver,
    private readonly fileBlob: TenantFileBlobService,
    private readonly psb: PesantrenPsbService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
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
      `SELECT id::text, code, name, jenis, website_enabled, public_slug,
              santri_subdomain, custom_domain, logo_url, hero_image_url, welcome_title
         FROM "${S}".pesantren_unit_pendidikan
        WHERE is_active = TRUE AND deleted_at IS NULL
        ORDER BY sort_order ASC, name ASC`,
    );

    const media = await this.mediaPublik(S, null);
    const kajian = await this.kajianPublik(S);
    const currentUnit = await this.unitDariHost(S, konteks.host);

    return { profil, berita, unitPendidikan, media, kajian, currentUnit };
  }

  async unit(host: string | undefined, slug: string) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const unit = await this.tenantDb.queryOne<Record<string, unknown>>(
      S,
      `SELECT id::text, code, name, jenis, website_enabled, public_slug,
              santri_subdomain, custom_domain, domain_status, logo_url, hero_image_url, welcome_title, welcome_body
         FROM "${S}".pesantren_unit_pendidikan
        WHERE is_active = TRUE
          AND deleted_at IS NULL
          AND public_slug = $1`,
      [slug.toLowerCase()],
    );
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
    }

    const profil = await this.tenantDb.queryOne<Record<string, unknown>>(
      S,
      `SELECT theme_code, nama_tampilan, logo_url, hero_image_url, alamat_publik,
              kontak_telepon, kontak_whatsapp, kontak_email
         FROM "${S}".pesantren_website_setting
        WHERE singleton = TRUE`,
    );

    const gelombang = await this.tenantDb.query(
      S,
      `SELECT id::text, kode, nama, tanggal_buka::text, tanggal_tutup::text,
              biaya_pendaftaran::text, status
         FROM "${S}".pesantren_psb_gelombang
        WHERE unit_pendidikan_id = $1 AND status != 'DRAFT' AND deleted_at IS NULL
        ORDER BY tanggal_buka DESC
        LIMIT 10`,
      [unit.id],
    );

    const media = await this.mediaPublik(S, unit.id as string);

    return { profil, unit, gelombang, media };
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

  private async unitDariHost(schemaName: string, host: string) {
    const labelSantri = host.endsWith('.santri.info') ? host.slice(0, -'.santri.info'.length) : null;
    return this.tenantDb.queryOne(
      schemaName,
      `SELECT id::text, code, name, jenis, public_slug, santri_subdomain, custom_domain
         FROM "${schemaName}".pesantren_unit_pendidikan
        WHERE is_active = TRUE
          AND deleted_at IS NULL
          AND (
            ($1::text IS NOT NULL AND santri_subdomain = $1)
            OR ($2::text IS NOT NULL AND custom_domain = $2)
          )`,
      [labelSantri, host],
    );
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

  async kajianGambar(host: string | undefined, code: string): Promise<BerkasBlob> {
    if (!code.startsWith('KAJIAN_')) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const diterbitkan = await this.tenantDb.queryOne<{ is_published: boolean }>(
      S,
      `SELECT is_published FROM "${S}".pesantren_website_setting WHERE singleton = TRUE`,
    );
    if (!diterbitkan || diterbitkan.is_published !== true) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }

    const berkas = await this.fileBlob.ambilByCode(S, code);
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    return berkas;
  }

  async unitGambar(
    host: string | undefined,
    unitId: string,
    kategori: KategoriGambarUnitPendidikan,
  ): Promise<BerkasBlob> {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const unit = await this.tenantDb.queryOne<{ id: string }>(
      S,
      `SELECT u.id::text AS id
         FROM "${S}".pesantren_unit_pendidikan u
         JOIN "${S}".pesantren_website_setting s ON s.singleton = TRUE
        WHERE u.id = $1
          AND u.is_active = TRUE
          AND u.website_enabled = TRUE
          AND u.deleted_at IS NULL
          AND s.is_published = TRUE`,
      [unitId],
    );
    if (!unit) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }

    const berkas = await this.fileBlob.ambilByCode(S, kodeBerkasGambarUnit(unitId, kategori));
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    return berkas;
  }

  async mediaGambar(host: string | undefined, id: string): Promise<BerkasBlob> {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const media = await this.tenantDb.queryOne<{ id: string; file_code: string | null }>(
      S,
      `SELECT m.id::text, m.file_code
         FROM "${S}".pesantren_media m
         JOIN "${S}".pesantren_website_setting s ON s.singleton = TRUE
        WHERE m.id = $1
          AND m.deleted_at IS NULL
          AND m.is_published = TRUE
          AND s.is_published = TRUE`,
      [id],
    );
    if (!media) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }

    const berkas = await this.fileBlob.ambilByCode(S, media.file_code || kodeBerkasMediaPesantren(id));
    if (!berkas) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gambar tidak ditemukan.');
    }
    return berkas;
  }

  /**
   * Seluruh gelombang yang layak ditampilkan pengunjung -- BUKAN hanya yang
   * sedang DIBUKA. Halaman landing PSB (`PsbGelombangPage.tsx`) sengaja
   * menampilkan gelombang yang sudah DITUTUP/SELESAI juga (dengan lencana
   * berbeda, tombol nonaktif) supaya pengunjung tahu riwayat/pola
   * penerimaan pondok -- pola sama dengan `_gelombang_ppdb.jsp` pada
   * sistem lama, yang punya filter status "Semua/Buka/Tutup".
   *
   * `DRAFT` TIDAK pernah ikut -- itu gelombang yang bahkan belum diumumkan
   * pengurus, beda dari "sudah pernah dibuka tapi kini tutup".
   *
   * Sama aturan penerbitannya dengan `situs()` -- pondok yang belum
   * menerbitkan situsnya tidak menawarkan apa pun lewat jalur publik.
   */
  async psbGelombangPublik(host: string | undefined) {
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
      `SELECT g.id::text, g.kode, g.nama, g.tanggal_buka::text, g.tanggal_tutup::text,
              g.biaya_pendaftaran::text, g.status, g.form_schema,
              g.unit_pendidikan_id::text, u.name AS unit_pendidikan_nama
         FROM "${S}".pesantren_psb_gelombang g
         LEFT JOIN "${S}".pesantren_unit_pendidikan u ON u.id = g.unit_pendidikan_id
        WHERE g.status != 'DRAFT' AND g.deleted_at IS NULL
        ORDER BY g.tanggal_buka DESC`,
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
   * Masuk ke portal pendaftar PSB -- "nama pengguna" nomor pendaftaran
   * (ditunjukkan ke pendaftar sesaat setelah mendaftar, lihat
   * `PsbPendaftaranPage.tsx`), "kata sandi" tanggal lahir yang sudah ia isi
   * sendiri saat mendaftar. TIDAK mensyaratkan situs sudah diterbitkan --
   * pendaftar yang sudah punya nomor registrasi tetap berhak melanjutkan
   * proses seleksinya walau pengurus sedang mengubah/menutup situs publik.
   *
   * Kegagalan apa pun (nomor tidak ditemukan, tanggal lahir tidak cocok,
   * ATAU tanggal lahir belum pernah diisi saat mendaftar) menjawab pesan
   * yang SAMA -- pembeda kegagalan di sini adalah kebocoran informasi bagi
   * penebak nomor pendaftaran (yang formatnya bisa ditebak, lihat
   * `bentukNomorPendaftaran`).
   */
  async psbMasuk(
    host: string | undefined,
    dto: { nomorPendaftaran: string; tanggalLahir: string },
  ): Promise<{
    accessToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
    pendaftar: { id: string; nomorPendaftaran: string; namaLengkap: string; status: string };
  }> {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const pendaftar = await this.psb.satuPendaftarByNomor(S, dto.nomorPendaftaran.trim());
    if (!pendaftar || !pendaftar.tanggal_lahir || pendaftar.tanggal_lahir !== dto.tanggalLahir) {
      throw AppError.unauthorized(
        ErrorCodes.UNAUTHORIZED,
        'Nomor pendaftaran dan tanggal lahir tidak cocok. Periksa kembali, atau hubungi pengurus pondok bila tanggal lahir Anda belum tercatat saat mendaftar.',
      );
    }

    const payload: PsbApplicantTokenPayload = {
      type: PSB_APPLICANT_TOKEN_TYPE,
      pendaftarId: pendaftar.id,
      schemaName: S,
      tenantId: konteks.tenantId,
    };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: PSB_PORTAL_TTL,
    });

    return {
      accessToken,
      expiresIn: PSB_PORTAL_TTL_DETIK,
      tokenType: 'Bearer',
      pendaftar: {
        id: pendaftar.id,
        nomorPendaftaran: pendaftar.nomor_pendaftaran,
        namaLengkap: pendaftar.nama_lengkap,
        status: pendaftar.status,
      },
    };
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

  private mediaPublik(schemaName: string, unitPendidikanId: string | null) {
    const kondisiUnit = unitPendidikanId ? 'm.unit_pendidikan_id = $1' : 'm.unit_pendidikan_id IS NULL';
    const params = unitPendidikanId ? [unitPendidikanId] : [];
    return this.tenantDb.query(
      schemaName,
      `SELECT m.id::text, m.unit_pendidikan_id::text, u.name AS unit_pendidikan_nama,
              m.kategori, m.judul, m.deskripsi, m.image_url, m.alt_text, m.attribution
         FROM "${schemaName}".pesantren_media m
         LEFT JOIN "${schemaName}".pesantren_unit_pendidikan u ON u.id = m.unit_pendidikan_id
        WHERE m.deleted_at IS NULL
          AND m.is_published = TRUE
          AND ${kondisiUnit}
        ORDER BY m.sort_order ASC, m.created_at DESC
        LIMIT 12`,
      params,
    );
  }

  private kajianPublik(schemaName: string) {
    return this.tenantDb.query(
      schemaName,
      `SELECT id::text, judul, pemateri, tanggal_mulai::text, tanggal_selesai::text,
              lokasi, ringkasan, materi_url, rekaman_url, gambar_url
         FROM "${schemaName}".pesantren_kajian_dakwah
        WHERE deleted_at IS NULL
          AND status = 'TERBIT'
        ORDER BY sort_order ASC, tanggal_mulai DESC, created_at DESC
        LIMIT 12`,
    );
  }
}
