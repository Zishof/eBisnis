/**
 * Situs koperasi untuk pengunjung yang belum masuk.
 *
 * Permukaan paling terbuka di seluruh modul: dipanggil tanpa sesi, oleh siapa
 * saja yang mengetahui alamatnya.
 *
 * ## Bagaimana ia tahu koperasi mana
 *
 * Dari **host permintaan**, lewat `PublicTenantResolver` (IR-005) — bukan dari
 * alamat. Nama skema tidak pernah datang dari permintaan; itulah satu-satunya
 * alasan jalur ini boleh ada sama sekali.
 *
 * ## Yang boleh dilihat pengunjung
 *
 * Hanya yang pengurus pilih untuk ditampilkan, dan bawaannya sedikit. Jumlah
 * anggota dan besar aset **tidak** tampil kecuali dinyalakan — keduanya angka
 * yang meyakinkan calon anggota sekaligus angka yang dipakai orang lain menilai
 * apakah koperasi ini layak didekati.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { PublicTenantResolver } from '../../../infrastructure/tenant/public-tenant-resolver.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { bolehMendaftarPublik } from '../cooperative-portal';
import {
  bolehMenerimaLamaran,
  normalkanTelepon,
  periksaIsian,
  sidikSumber,
  type IsianLamaran,
} from './public-intake';

/** Vertikal yang dilayani jalur ini. */
const VERTIKAL = 'cooperative';

@Injectable()
export class CooperativePublicService {
  private readonly logger = new Logger(CooperativePublicService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly resolver: PublicTenantResolver,
  ) {}

  /**
   * Isi situs, ditentukan host permintaan.
   *
   * Melempar 404 bila hostnya tidak terdaftar — dan pesannya sama untuk setiap
   * sebab, supaya pengunjung yang menebak tidak dapat membedakan "tidak
   * terdaftar" dari "terdaftar tetapi belum terbit".
   */
  async situs(host: string | undefined) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const rows = await this.tenantDb.query<Record<string, unknown> & { id: string }>(
      S,
      `SELECT c.id, c.name, c.short_name, c.slug, c.status, c.membership_scope,
              c.establishment_date, c.legal_entity_number,
              s.tagline, s.about_html, s.hero_image_url, s.logo_url, s.primary_color,
              s.contact_email, s.contact_phone, s.contact_whatsapp, s.public_address,
              s.map_embed_url, s.show_member_count, s.show_asset_total,
              s.show_board_members, s.show_saving_products, s.show_loan_products,
              s.accepts_online_application, s.application_notice_html,
              s.meta_description
         FROM "${S}".cooperative c
         JOIN "${S}".cooperative_website_setting s ON s.cooperative_id = c.id
        WHERE s.is_published = TRUE AND c.deleted_at IS NULL`,
    );

    if (rows.length === 0) {
      /*
       * Situs yang belum diterbitkan menjawab sama dengan host yang tidak
       * terdaftar. Pengurus yang sedang menyusun situsnya tidak perlu
       * pekerjaannya terlihat sebelum ia siap.
       */
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const c = rows[0];

    const halaman = await this.tenantDb.query(
      S,
      `SELECT slug, title, page_type, sort_order
         FROM "${S}".cooperative_website_page
        WHERE cooperative_id = $1 AND show_in_menu = TRUE AND published_at IS NOT NULL
        ORDER BY sort_order, title`,
      [c.id],
    );

    const pengumuman = await this.tenantDb.query(
      S,
      `SELECT id, title, body_html, category, published_at
         FROM "${S}".cooperative_announcement
        WHERE cooperative_id = $1 AND audience = 'PUBLIC'
          AND published_at IS NOT NULL AND published_at <= now()
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY is_pinned DESC, published_at DESC
        LIMIT 10`,
      [c.id],
    );

    let jumlahAnggota: number | null = null;
    if (c.show_member_count === true) {
      const r = await this.tenantDb.query<{ n: number }>(
        S,
        `SELECT COUNT(*)::int AS n FROM "${S}".cooperative_member
          WHERE cooperative_id = $1 AND status = 'ACTIVE'`,
        [c.id],
      );
      jumlahAnggota = r[0].n;
    }

    const produkSimpanan =
      c.show_saving_products === true
        ? await this.tenantDb.query(
            S,
            `SELECT name, description, saving_kind, minimum_deposit
               FROM "${S}".cooperative_saving_product
              WHERE cooperative_id = $1 AND is_active = TRUE AND deleted_at IS NULL
              ORDER BY sort_order, name`,
            [c.id],
          )
        : [];

    const produkPinjaman =
      c.show_loan_products === true
        ? await this.tenantDb.query(
            S,
            `SELECT name, description, method, max_tenor_months
               FROM "${S}".cooperative_loan_product
              WHERE cooperative_id = $1 AND is_active = TRUE AND deleted_at IS NULL
              ORDER BY name`,
            [c.id],
          )
        : [];

    return {
      koperasi: {
        name: c.name,
        shortName: c.short_name,
        slug: c.slug,
        tagline: c.tagline,
        aboutHtml: c.about_html,
        heroImageUrl: c.hero_image_url,
        logoUrl: c.logo_url,
        primaryColor: c.primary_color,
        metaDescription: c.meta_description,
        establishmentDate: c.establishment_date,
        legalEntityNumber: c.legal_entity_number,
      },
      kontak: {
        email: c.contact_email,
        phone: c.contact_phone,
        whatsapp: c.contact_whatsapp,
        address: c.public_address,
        mapEmbedUrl: c.map_embed_url,
      },
      pendaftaran: bolehMendaftarPublik({
        cooperativeStatus: String(c.status),
        membershipScope: String(c.membership_scope),
        acceptsOnlineApplication: c.accepts_online_application === true,
      }),
      noticeHtml: c.application_notice_html,
      jumlahAnggota,
      halaman,
      pengumuman,
      produkSimpanan,
      produkPinjaman,
    };
  }

  /** Satu halaman statis, ditentukan slugnya. */
  async halaman(host: string | undefined, slug: string) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    const rows = await this.tenantDb.query(
      S,
      `SELECT p.slug, p.title, p.content_html, p.page_type, p.published_at
         FROM "${S}".cooperative_website_page p
         JOIN "${S}".cooperative_website_setting s ON s.cooperative_id = p.cooperative_id
        WHERE p.slug = $1 AND p.published_at IS NOT NULL AND s.is_published = TRUE`,
      [slug],
    );
    if (rows.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Halaman tidak ditemukan.');
    }
    return rows[0];
  }

  /**
   * Menerima lamaran calon anggota dari internet.
   *
   * Berhenti pada tabel karantina. **Tidak pernah** membentuk baris
   * `cooperative_member` — tanpa itu siapa pun di internet dapat menumbuhkan
   * daftar anggota koperasi orang lain dengan nama orang yang tidak pernah
   * mendaftar.
   */
  async terimaLamaran(
    host: string | undefined,
    isian: IsianLamaran & { occupation?: string | null; address?: string | null; consentGiven: boolean },
    ip: string | undefined,
  ) {
    const konteks = await this.resolver.resolve(host, VERTIKAL);
    const S = konteks.schemaName;

    // --- Mutu isian, sebelum menyentuh basis data ------------------------
    const mutu = periksaIsian(isian);
    if (!mutu.allowed) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, mutu.message!);
    }

    const telepon = normalkanTelepon(isian.phone)!;

    if (!isian.consentGiven) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Persetujuan pengolahan data pribadi diperlukan untuk melanjutkan.',
      );
    }

    const kop = await this.tenantDb.query<{
      id: string;
      status: string;
      membership_scope: string;
      accepts_online_application: boolean;
    }>(
      S,
      `SELECT c.id, c.status, c.membership_scope, s.accepts_online_application
         FROM "${S}".cooperative c
         JOIN "${S}".cooperative_website_setting s ON s.cooperative_id = c.id
        WHERE s.is_published = TRUE AND c.deleted_at IS NULL`,
    );
    if (kop.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs tidak ditemukan.');
    }

    const gerbang = bolehMendaftarPublik({
      cooperativeStatus: kop[0].status,
      membershipScope: kop[0].membership_scope,
      acceptsOnlineApplication: kop[0].accepts_online_application,
    });
    if (!gerbang.allowed) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, gerbang.message!);
    }

    // --- Keadaan antrean -------------------------------------------------
    const keadaan = await this.tenantDb.query<{
      hari_ini: number;
      detik_terakhir: number | null;
      menunggu: boolean;
    }>(
      S,
      `SELECT
         (SELECT COUNT(*)::int FROM "${S}".cooperative_public_application
           WHERE cooperative_id = $1 AND submitted_at > now() - interval '24 hours')
           AS hari_ini,
         (SELECT EXTRACT(EPOCH FROM (now() - MAX(submitted_at)))::int
            FROM "${S}".cooperative_public_application
           WHERE cooperative_id = $1 AND phone = $2)
           AS detik_terakhir,
         (SELECT EXISTS(SELECT 1 FROM "${S}".cooperative_public_application
           WHERE cooperative_id = $1 AND phone = $2
             AND status IN ('SUBMITTED', 'UNDER_REVIEW', 'NEED_DOCUMENT')))
           AS menunggu`,
      [kop[0].id, telepon],
    );

    const antrean = bolehMenerimaLamaran({
      lamaranHariIni: Number(keadaan[0].hari_ini),
      detikSejakNomorTerakhir:
        keadaan[0].detik_terakhir === null ? null : Number(keadaan[0].detik_terakhir),
      adaYangMasihMenunggu: keadaan[0].menunggu === true,
    });

    if (!antrean.allowed) {
      this.logger.warn(`Lamaran ditolak pada ${konteks.host}: ${antrean.code}`);
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, antrean.message!, {
        retryAfter: antrean.retryAfter,
      });
    }

    // --- Menyimpan ke karantina -----------------------------------------
    const nomor = await this.nomorLamaran(S, kop[0].id);
    const rows = await this.tenantDb.query(
      S,
      `INSERT INTO "${S}".cooperative_public_application
         (cooperative_id, application_number, full_name, phone, email, occupation,
          address, motivation, consent_given, consent_at, source_ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, now(), $9)
       RETURNING id, application_number, status, submitted_at`,
      [
        kop[0].id,
        nomor,
        isian.fullName.trim(),
        telepon,
        isian.email?.trim() || null,
        isian.occupation?.trim() || null,
        isian.address?.trim() || null,
        isian.motivation?.trim() || null,
        sidikSumber(ip, konteks.tenantId),
      ],
    );

    return {
      ...rows[0],
      pesan:
        'Pendaftaran Anda sudah kami terima. Pengurus koperasi akan memeriksanya dan ' +
        'menghubungi Anda lewat nomor yang Anda cantumkan.',
    };
  }

  private async nomorLamaran(schema: string, cooperativeId: string): Promise<string> {
    const rows = await this.tenantDb.query<{ n: number }>(
      schema,
      `SELECT COUNT(*)::int AS n FROM "${schema}".cooperative_public_application
        WHERE cooperative_id = $1`,
      [cooperativeId],
    );
    const tahun = new Date().getUTCFullYear();
    return `APP-${tahun}-${String(rows[0].n + 1).padStart(5, '0')}`;
  }
}
