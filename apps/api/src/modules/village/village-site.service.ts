/**
 * Situs desa, portal warga, kiosk, dan siaran.
 *
 * ## Bacaan publik selalu melewati proyeksi
 *
 * Setiap keluaran publik disaring `proyeksikan()` dengan daftar izin, tanpa
 * kecuali. Menyaring "hanya yang perlu" berarti mengandalkan ingatan penulis
 * kode berikutnya, dan ingatan itulah yang paling sering gagal ketika sebuah
 * kolom baru ditambahkan seminggu kemudian.
 *
 * ## Portal berangkat dari sesi, bukan dari permintaan
 *
 * Tidak satu pun metode portal di bawah ini menerima pengenal penduduk dari
 * luar. Yang ditampilkan ditentukan `tautanPortal()` dari `userId` sesinya.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import { BROADCAST_PORT, type BroadcastPort } from './ports/broadcast.port';
import { HEALTH_PORT, type HealthAggregatePort } from './ports/external.ports';
import { VillageKioskService } from './village-kiosk.service';
import {
  bolehLihatDiPortal,
  bolehPindahTayang,
  bolehSiarkan,
  bolehTandaiTerkirim,
  bolehTayang,
  hapusJejakKiosk,
  keadaanKiosk,
  proyeksikan,
  type KanalSiaran,
  type StatusTayang,
} from './village-site';

@Injectable()
export class VillageSiteService {
  private readonly logger = new Logger(VillageSiteService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
    @Inject(BROADCAST_PORT) private readonly siaran: BroadcastPort,
    @Inject(HEALTH_PORT) private readonly kesehatan: HealthAggregatePort,
    private readonly anjungan: VillageKioskService,
  ) {}

  // --- Situs publik (hanya membaca) -----------------------------------------

  /**
   * Profil desa untuk situs publik.
   *
   * Disaring proyeksi. Kolom pada `village_unit` bertambah seiring tahap, dan
   * yang tidak didaftarkan tidak tampil — itulah yang dikehendaki.
   */
  async profilPublik(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT name, profile_type AS "profileType", administrative_code AS "administrativeCode",
              address, motto, phone, email, province_name AS "provinceName",
              regency_name AS "regencyName", district_name AS "districtName",
              area_km2::text AS "areaKm2", established_year AS "establishedYear"
         FROM "${schemaName}".village_unit WHERE id = $1`,
      [u.id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Profil desa tidak ditemukan.');
    return proyeksikan('PROFIL', rows[0]);
  }

  async beritaPublik(schemaName: string, limit = 10, offset = 0) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, slug, title, summary, body, cover_path AS "coverPath",
              published_at AS "publishedAt", author_name AS "authorName", category
         FROM "${schemaName}".village_news
        WHERE village_unit_id = $1 AND status = 'TAYANG' AND deleted_at IS NULL
          AND published_at <= now()
        ORDER BY published_at DESC
        LIMIT $2 OFFSET $3`,
      [u.id, Math.min(limit, 50), offset],
    );
    return rows.map((r) => proyeksikan('BERITA', r));
  }

  async beritaPublikSatu(schemaName: string, slug: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, slug, title, summary, body, cover_path AS "coverPath",
              published_at AS "publishedAt", author_name AS "authorName", category
         FROM "${schemaName}".village_news
        WHERE village_unit_id = $1 AND slug = $2 AND status = 'TAYANG' AND deleted_at IS NULL
          AND published_at <= now()`,
      [u.id, slug],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');
    return proyeksikan('BERITA', rows[0]);
  }

  async halamanPublik(schemaName: string, slug: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, slug, title, body, updated_at AS "updatedAt"
         FROM "${schemaName}".village_page
        WHERE village_unit_id = $1 AND slug = $2 AND status = 'TAYANG' AND deleted_at IS NULL`,
      [u.id, slug],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Halaman tidak ditemukan.');
    return proyeksikan('HALAMAN', rows[0]);
  }

  async menuPublik(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT slug, COALESCE(menu_label, title) AS label, sort_order AS "sortOrder"
         FROM "${schemaName}".village_page
        WHERE village_unit_id = $1 AND status = 'TAYANG' AND show_in_menu = TRUE
          AND deleted_at IS NULL
        ORDER BY sort_order, title`,
      [u.id],
    );
  }

  /** Agenda publik. Yang bertanda internal tidak pernah keluar dari sini. */
  async agendaPublik(schemaName: string, limit = 20) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, title, description, start_at AS "startAt", end_at AS "endAt", location,
              is_public AS "isPublic"
         FROM "${schemaName}".village_agenda
        WHERE village_unit_id = $1 AND is_public = TRUE AND deleted_at IS NULL
          AND (end_at IS NULL OR end_at >= now() - interval '1 day')
        ORDER BY start_at
        LIMIT $2`,
      [u.id, Math.min(limit, 50)],
    );
    return rows.map((r) => proyeksikan('AGENDA', r));
  }

  async wisataPublik(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, name, category, description, address, open_hours AS "openHours",
              entry_fee::text AS "entryFee", is_free AS "isFree",
              manager_name AS "managerName", manager_contact AS "managerContact", facilities
         FROM "${schemaName}".village_tourism_site
        WHERE village_unit_id = $1 AND is_published = TRUE AND deleted_at IS NULL
        ORDER BY name`,
      [u.id],
    );
    return rows.map((r) => proyeksikan('WISATA', r));
  }

  async umkmPublik(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, business_name AS "businessName", business_sector AS "businessSector",
              description, phone, address
         FROM "${schemaName}".village_umkm
        WHERE village_unit_id = $1 AND is_published = TRUE AND status = 'AKTIF'
          AND deleted_at IS NULL
        ORDER BY business_name`,
      [u.id],
    );
    return rows.map((r) => proyeksikan('UMKM', r));
  }

  /**
   * Ringkasan APBDes untuk transparansi publik.
   *
   * Hanya total, dan hanya yang sudah ditetapkan. Rincian per baris anggaran
   * bukan rahasia, tetapi ia disajikan D-11 bersama ambang penyajiannya —
   * menayangkannya di sini tanpa ambang itu akan mendahului keputusan yang
   * belum diambil.
   */
  async apbdesPublik(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT fiscal_year AS "fiscalYear", total_revenue::text AS "totalRevenue",
              total_expenditure::text AS "totalExpenditure",
              regulation_number AS "regulationNumber", established_at AS "establishedAt"
         FROM "${schemaName}".village_budget
        WHERE village_unit_id = $1 AND status IN ('DITETAPKAN','DITUTUP')
        ORDER BY fiscal_year DESC LIMIT 5`,
      [u.id],
    );
    return rows.map((r) => proyeksikan('APBDES', r));
  }

  // --- Pengelolaan isi ------------------------------------------------------

  async simpanBerita(
    schemaName: string,
    input: {
      slug: string;
      title: string;
      body: string;
      summary?: string;
      category?: string;
      coverPath?: string;
      authorName?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'SITUS.BERITA');

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_news
           (village_unit_id, slug, title, summary, body, category, cover_path, author_name,
            created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          u.id,
          input.slug,
          input.title,
          input.summary ?? null,
          input.body,
          input.category ?? null,
          input.coverPath ?? null,
          input.authorName ?? null,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Slug berita sudah dipakai.'));

    return { id: rows[0].id, status: 'DRAF' };
  }

  async ubahStatusBerita(
    schemaName: string,
    newsId: string,
    status: StatusTayang,
    user: AuthenticatedUser,
    tayangPada?: string,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'SITUS.BERITA');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const n = await client.query<Record<string, string>>(
        `SELECT status, title, body FROM "${schemaName}".village_news
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [newsId, u.id],
      );
      if (!n.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berita tidak ditemukan.');

      const pindah = bolehPindahTayang(n.rows[0].status as StatusTayang, status);
      if (!pindah.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, pindah.alasan!);

      if (status === 'TAYANG' || status === 'TERJADWAL') {
        const isi = bolehTayang({
          judul: n.rows[0].title,
          isi: n.rows[0].body,
          status,
          tayangPada: tayangPada ?? (status === 'TAYANG' ? new Date().toISOString() : null),
        });
        if (!isi.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, isi.alasan!);
      }

      await client.query(
        `UPDATE "${schemaName}".village_news
            SET status = $2,
                published_at = CASE
                  WHEN $2 = 'TAYANG' THEN COALESCE($3::timestamptz, now())
                  WHEN $2 = 'TERJADWAL' THEN $3::timestamptz
                  ELSE published_at END,
                published_by = CASE WHEN $2 IN ('TAYANG','TERJADWAL') THEN $4 ELSE published_by END,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [newsId, status, tayangPada ?? null, user.userId],
      );
      return { id: newsId, status };
    });
  }

  // --- Portal warga ---------------------------------------------------------

  /**
   * Tautan akun ke data kependudukan.
   *
   * Satu-satunya sumber pengenal penduduk pada seluruh portal. Tidak ada metode
   * di bawah ini yang menerimanya dari permintaan.
   */
  private async tautanPortal(schemaName: string, userId: string) {
    const rows = await this.tenantDb.query<{ resident_id: string; family_id: string | null }>(
      schemaName,
      `SELECT l.resident_id, r.village_family_id AS family_id
         FROM "${schemaName}".village_portal_link l
         JOIN "${schemaName}".village_resident r ON r.id = l.resident_id
        WHERE l.user_id = $1 AND l.is_active = TRUE`,
      [userId],
    );
    return rows.length
      ? { residentId: rows[0].resident_id, familyId: rows[0].family_id }
      : { residentId: null, familyId: null };
  }

  /** Data diri pemilik akun. */
  async portalDiri(schemaName: string, user: AuthenticatedUser) {
    const t = await this.tautanPortal(schemaName, user.userId);
    const v = bolehLihatDiPortal({
      residentIdSesi: t.residentId,
      familyIdSesi: t.familyId,
      residentIdDiminta: t.residentId ?? '',
      familyIdDiminta: t.familyId,
    });
    if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);

    const rows = await this.tenantDb.query(
      schemaName,
      `SELECT r.id, r.full_name, r.national_id, r.birth_place, r.birth_date, r.gender,
              r.religion, r.marital_status, r.education, r.occupation, r.address,
              r.resident_status, t.number AS rt_number, w.number AS rw_number
         FROM "${schemaName}".village_resident r
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE r.id = $1 AND r.deleted_at IS NULL`,
      [t.residentId],
    );
    return rows[0] ?? null;
  }

  /** Anggota keluarga dalam satu kartu keluarga. Tidak ada pencarian. */
  async portalKeluarga(schemaName: string, user: AuthenticatedUser) {
    const t = await this.tautanPortal(schemaName, user.userId);
    const v = bolehLihatDiPortal({
      residentIdSesi: t.residentId,
      familyIdSesi: t.familyId,
      residentIdDiminta: t.residentId ?? '',
      familyIdDiminta: t.familyId,
    });
    if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);

    if (!t.familyId) return { familyCardNo: null, members: [] };

    const [kk, anggota] = await Promise.all([
      this.tenantDb.query<{ family_card_no: string }>(
        schemaName,
        `SELECT family_card_no FROM "${schemaName}".village_family WHERE id = $1`,
        [t.familyId],
      ),
      this.tenantDb.query(
        schemaName,
        `SELECT id, full_name, family_relation, gender, birth_date, resident_status
           FROM "${schemaName}".village_resident
          WHERE village_family_id = $1 AND deleted_at IS NULL
          ORDER BY CASE WHEN family_relation = 'KEPALA_KELUARGA' THEN 0 ELSE 1 END, full_name`,
        [t.familyId],
      ),
    ]);
    return { familyCardNo: kk[0]?.family_card_no ?? null, members: anggota };
  }

  /** Permohonan layanan milik pemilik akun. */
  async portalPermohonan(schemaName: string, user: AuthenticatedUser) {
    const t = await this.tautanPortal(schemaName, user.userId);
    if (!t.residentId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun ini belum tertaut ke data kependudukan.',
      );
    }
    return this.tenantDb.query(
      schemaName,
      `SELECT id, request_number, status, submitted_at
         FROM "${schemaName}".village_service_request
        WHERE village_resident_id = $1
        ORDER BY submitted_at DESC NULLS LAST LIMIT 50`,
      [t.residentId],
    );
  }

  /** Jenis layanan yang dapat diajukan warga dari aplikasi. */
  async portalJenisLayanan(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.KATALOG');
    return this.tenantDb.query(
      schemaName,
      `SELECT id, code, name FROM "${schemaName}".village_service_catalog
        WHERE village_unit_id = $1 AND is_active = TRUE AND deleted_at IS NULL
        ORDER BY name`,
      [u.id],
    );
  }

  /**
   * Mengajukan surat sebagai diri sendiri.
   *
   * Tidak ada parameter pemohon. Pemohonnya adalah pemilik akun, ditentukan
   * dari tautan sesinya — endpoint yang menerima `residentId` akan dicoba
   * dengan nilai lain oleh orang pertama yang menyadarinya.
   */
  async portalAjukanSurat(
    schemaName: string,
    input: { serviceCatalogId: string; purpose?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');
    const t = await this.tautanPortal(schemaName, user.userId);
    if (!t.residentId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun Anda belum tertaut ke data kependudukan desa. Datang sekali ke kantor desa ' +
          'dengan membawa KTP; petugas akan menautkannya.',
      );
    }

    const w = await this.tenantDb.query<{ full_name: string; phone: string | null }>(
      schemaName,
      `SELECT full_name, phone FROM "${schemaName}".village_resident WHERE id = $1`,
      [t.residentId],
    );
    if (!w.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Data penduduk tidak ditemukan.');

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_service_request
         (village_unit_id, service_catalog_id, village_resident_id, applicant_name,
          applicant_phone, applicant_user_id, purpose, status, submitted_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'DIAJUKAN', now(), $6) RETURNING id`,
      [
        u.id,
        input.serviceCatalogId,
        t.residentId,
        w[0].full_name,
        w[0].phone,
        user.userId,
        input.purpose ?? null,
      ],
    );

    // Kode ambil diterbitkan sekalian. Inilah yang menyambungkan "ajukan dari
    // rumah" dengan "cetak sendiri di anjungan": warga yang mengajukan lewat
    // aplikasi tidak perlu mengantre dua kali.
    const kode = await this.anjungan.terbitkanKode(
      schemaName,
      { serviceRequestId: rows[0].id },
      user,
    );

    return {
      id: rows[0].id,
      status: 'DIAJUKAN',
      claimCode: kode.claimCode,
      claimDisplay: kode.display,
      note:
        'Permohonan Anda sudah masuk. Simpan kode ambil ini — setelah surat terbit, Anda ' +
        'dapat mencetaknya sendiri di anjungan kantor desa tanpa mengantre.',
    };
  }

  /**
   * Menyampaikan pengaduan dari aplikasi.
   *
   * `showReporterName` menentukan apakah nama pelapor muncul pada daftar yang
   * dilihat warga lain. Ia **bukan** anonim, dan tidak boleh disebut begitu:
   * aplikasi memakai akun, sehingga peladen selalu tahu siapa yang mengirim.
   * Yang benar-benar tanpa identitas adalah jalur anjungan di kantor desa, yang
   * tidak menyimpan identitas sama sekali.
   *
   * Menyebut ini "anonim" berarti menjanjikan sesuatu yang tidak dapat ditepati
   * aplikasi mana pun yang memakai akun — dan warga yang mengadukan perangkat
   * desa mempercayai janji itu.
   */
  async portalLapor(
    schemaName: string,
    input: {
      title: string;
      description: string;
      showReporterName?: boolean;
      locationNote?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');
    const t = await this.tautanPortal(schemaName, user.userId);

    if ((input.description ?? '').trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ceritakan laporan Anda sedikit lebih panjang agar dapat ditindaklanjuti.',
      );
    }

    const tampilkanNama = input.showReporterName !== false;
    let nama: string | null = null;
    if (tampilkanNama && t.residentId) {
      const w = await this.tenantDb.query<{ full_name: string }>(
        schemaName,
        `SELECT full_name FROM "${schemaName}".village_resident WHERE id = $1`,
        [t.residentId],
      );
      nama = w[0]?.full_name ?? null;
    }

    const nomor = `ADU/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_complaint
         (village_unit_id, ticket_number, title, description, location_note,
          reporter_mode, reporter_resident_id, reporter_user_id, reporter_name,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,'TERBUKA',$6,$7,$8,'DITERIMA',$7) RETURNING id`,
      [
        u.id,
        nomor,
        input.title?.trim() || input.description.trim().slice(0, 80),
        input.description.trim(),
        input.locationNote ?? null,
        // Tautan penduduk dan pengguna TETAP disimpan meskipun namanya tidak
        // ditampilkan. Menghapusnya akan membuat aplikasi seolah-olah anonim
        // padahal peladen mencatat pemanggilnya pada jejak audit — janji
        // setengah yang lebih buruk daripada tidak berjanji.
        t.residentId,
        user.userId,
        nama,
      ],
    );

    return {
      id: rows[0].id,
      ticketNumber: nomor,
      nameShown: tampilkanNama,
      note: tampilkanNama
        ? 'Laporan Anda tersimpan. Petugas dapat menghubungi Anda untuk keterangan tambahan.'
        : 'Laporan Anda tersimpan tanpa menampilkan nama kepada warga lain. Petugas desa ' +
          'tetap dapat melihatnya — untuk pelaporan yang benar-benar tanpa identitas, ' +
          'gunakan anjungan di kantor desa.',
    };
  }

  /**
   * Jadwal Posyandu.
   *
   * Diteruskan apa adanya dari `HealthAggregatePort`. Sampai eMedik tersambung,
   * ia menyatakan "belum tersambung" — dan aplikasi menampilkan itu, bukan
   * jadwal karangan. Jadwal palsu pada aplikasi warga berarti ibu-ibu datang ke
   * Posyandu yang tidak ada.
   */
  async portalPosyandu(schemaName: string, from?: string, to?: string) {
    const u = await this.unit.unit(schemaName);
    const hariIni = new Date().toISOString().slice(0, 10);
    const hasil = await this.kesehatan.jadwalPosyandu({
      villageUnitId: u.id,
      from: from ?? hariIni,
      to: to ?? hariIni,
    });
    return { available: hasil.tersedia, note: hasil.keterangan ?? null, data: hasil.data };
  }

  /**
   * Pengumuman, agenda, dan program bantuan untuk aplikasi warga.
   *
   * Memakai skema dari **sesinya**, bukan slug pada alamat. Aplikasi yang
   * membawa slug pada tiap pemanggilan akan menampilkan desa lain begitu
   * slugnya salah ketik sekali — dan warga tidak akan menyadarinya, sebab
   * pengumuman desa tetangga terlihat sama masuk akalnya.
   *
   * Program bantuan ditampilkan; penerimanya tidak. Aturan yang sama dengan
   * anjungan dan situs publik.
   */
  async portalPengumuman(schemaName: string) {
    const u = await this.unit.unit(schemaName);

    const [berita, agenda, bantuan] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT title, summary, published_at AS "publishedAt"
           FROM "${schemaName}".village_news
          WHERE village_unit_id = $1 AND status = 'TAYANG' AND deleted_at IS NULL
            AND published_at <= now()
          ORDER BY published_at DESC LIMIT 20`,
        [u.id],
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT title, description, start_at AS "startAt", end_at AS "endAt", location,
                is_public AS "isPublic"
           FROM "${schemaName}".village_agenda
          WHERE village_unit_id = $1 AND is_public = TRUE AND deleted_at IS NULL
            AND (end_at IS NULL OR end_at >= now() - interval '1 day')
          ORDER BY start_at LIMIT 20`,
        [u.id],
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT name AS "programName", aid_category AS "aidCategory",
                period_start AS "periodStart", period_end AS "periodEnd", quota
           FROM "${schemaName}".village_aid_program
          WHERE village_unit_id = $1 AND is_published = TRUE AND deleted_at IS NULL
            AND status IN ('DIBUKA','DISALURKAN')
          ORDER BY period_start DESC LIMIT 20`,
        [u.id],
      ),
    ]);

    return {
      unitName: u.name,
      news: berita.map((b) => proyeksikan('BERITA', b)),
      agenda: agenda.map((a) => proyeksikan('AGENDA', a)),
      aidPrograms: bantuan.map((b) => proyeksikan('BANTUAN', b)),
    };
  }

  /**
   * Status bantuan **milik sendiri**.
   *
   * Yang dikembalikan hanya keadaan pemilik akun terhadap tiap program:
   * penerima, sedang dinilai, atau belum terdaftar. Tidak ada daftar penerima
   * lain, dan tidak akan pernah ada — daftar penerima pada aplikasi yang
   * dipegang seluruh warga adalah pengumuman siapa yang miskin di desa ini.
   *
   * **Alasan penolakan tidak ikut dikembalikan**, meskipun ia tersimpan pada
   * `village_aid_candidate.rejection_reason`. D-7 menetapkan bahwa warga yang
   * tidak menerima bantuan berhak mendapat jawaban *dari seseorang* — dan layar
   * ponsel bukan seseorang. Kalimat "penghasilan Anda terlalu tinggi" yang
   * muncul sendirian di layar, tanpa ada yang dapat ditanyai balik, lebih
   * melukai daripada menjelaskan.
   */
  async portalStatusBantuan(schemaName: string, user: AuthenticatedUser) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PROGRAM');
    const t = await this.tautanPortal(schemaName, user.userId);
    if (!t.residentId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun Anda belum tertaut ke data kependudukan desa. Datang sekali ke kantor desa ' +
          'dengan membawa KTP; petugas akan menautkannya.',
      );
    }

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT p.id AS "programId", p.name AS "programName", p.aid_category AS "aidCategory",
              p.period_start AS "periodStart", p.period_end AS "periodEnd",
              b.id AS "beneficiaryId", b.status AS "beneficiaryStatus",
              b.entitlement_amount::text AS "entitlementAmount",
              c.status AS "candidateStatus"
         FROM "${schemaName}".village_aid_program p
    LEFT JOIN "${schemaName}".village_aid_beneficiary b
           ON b.aid_program_id = p.id AND b.resident_id = $2
    LEFT JOIN "${schemaName}".village_aid_candidate c
           ON c.aid_program_id = p.id AND c.resident_id = $2
        WHERE p.village_unit_id = $1 AND p.deleted_at IS NULL
          AND p.status IN ('DIBUKA','DISALURKAN','SELESAI')
        ORDER BY p.period_start DESC LIMIT 20`,
      [u.id, t.residentId],
    );

    const daftar = await Promise.all(
      rows.map(async (r) => {
        const penerima = r.beneficiaryStatus === 'AKTIF';
        const calon = r.candidateStatus === 'DIUSULKAN' || r.candidateStatus === 'DIVERIFIKASI';

        // Riwayat penyaluran hanya diambil bila ia memang penerima. Warga yang
        // bukan penerima tidak perlu tahu bahwa tabelnya ada.
        const penyaluran = penerima
          ? await this.tenantDb.query(
              schemaName,
              `SELECT installment_no AS "installmentNo", distributed_at AS "distributedAt",
                      amount::text AS amount, aid_form AS "aidForm"
                 FROM "${schemaName}".village_aid_distribution
                WHERE beneficiary_id = $1 ORDER BY installment_no`,
              [r.beneficiaryId],
            )
          : [];

        return {
          ...proyeksikan('BANTUAN', r),
          status: penerima ? 'PENERIMA' : calon ? 'SEDANG_DINILAI' : 'BUKAN_PENERIMA',
          entitlementAmount: penerima ? r.entitlementAmount : null,
          distributions: penyaluran,
        };
      }),
    );

    return { programs: daftar };
  }

  /** Menautkan akun ke penduduk. Dilakukan petugas, bukan pemilik akun. */
  async tautkanAkun(
    schemaName: string,
    input: { userId: string; residentId: string; verificationNote: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.WARGA');

    if ((input.verificationNote ?? '').trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Cara identitasnya dipastikan wajib dicatat. Penautan tanpa keterangan tidak dapat ' +
          'dibedakan dari penautan yang keliru, dan yang keliru membuka seluruh data satu ' +
          'keluarga kepada orang lain.',
      );
    }
    if (input.userId === user.userId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Petugas tidak menautkan akunnya sendiri. Mintakan kepada petugas lain.',
      );
    }

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_portal_link
           (village_unit_id, user_id, resident_id, linked_by, verification_note)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [u.id, input.userId, input.residentId, user.userId, input.verificationNote],
      )
      .catch(
        terjemahkanBentrok(
          'Akun atau penduduk ini sudah tertaut. Cabut tautan sebelumnya terlebih dahulu.',
        ),
      );

    return { id: rows[0].id };
  }

  // --- Kiosk ----------------------------------------------------------------

  async mulaiSesiKiosk(schemaName: string, kioskCode: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.KIOSK');

    // Sesi lama pada kiosk yang sama ditutup lebih dahulu beserta jejaknya.
    // Kiosk yang meninggalkan sesi menganggur berarti layar berikutnya
    // melanjutkan yang sebelumnya.
    await this.tutupSesiTerbuka(schemaName, u.id, kioskCode, 'DITUTUP_PENGGUNA');

    const rows = await this.tenantDb.query<{ id: string; started_at: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_kiosk_session (village_unit_id, kiosk_code)
       VALUES ($1,$2) RETURNING id, started_at`,
      [u.id, kioskCode],
    );
    return { id: rows[0].id, startedAt: rows[0].started_at };
  }

  /**
   * Menyentuh sesi, dan menutupnya bila sudah waktunya.
   *
   * Ambangnya dihitung fungsi murni; yang dilakukan di sini hanyalah menuliskan
   * hasilnya. Penutupan **menghapus** jejak layar — dan constraint basis data
   * menolak sesi berakhir yang masih menyimpannya.
   */
  async sentuhSesiKiosk(
    schemaName: string,
    sessionId: string,
    jejak: { residentId?: string | null; searchTerm?: string | null; lastViewPayload?: unknown } = {},
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.KIOSK');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const s = await client.query<Record<string, string | null>>(
        `SELECT started_at, last_touch_at, ended_at FROM "${schemaName}".village_kiosk_session
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [sessionId, u.id],
      );
      if (!s.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Sesi kiosk tidak ditemukan.');

      const k = keadaanKiosk(
        {
          mulaiPada: Date.parse(String(s.rows[0].started_at)),
          sentuhanTerakhir: Date.parse(String(s.rows[0].last_touch_at)),
          berakhirPada: s.rows[0].ended_at ? Date.parse(String(s.rows[0].ended_at)) : null,
        },
        Date.now(),
      );

      if (k.berakhir) {
        const bersih = hapusJejakKiosk({});
        await client.query(
          `UPDATE "${schemaName}".village_kiosk_session
              SET ended_at = COALESCE(ended_at, now()), end_reason = COALESCE(end_reason, $2),
                  resident_id = $3, search_term = $3, last_view_payload = $3, request_id = $3,
                  version = version + 1
            WHERE id = $1`,
          [sessionId, k.sebab === 'MASIH_BERJALAN' ? 'DITUTUP_PENGGUNA' : k.sebab, bersih.residentId],
        );
        return { ended: true, reason: k.sebab, message: k.keterangan, remainingSeconds: 0 };
      }

      await client.query(
        `UPDATE "${schemaName}".village_kiosk_session
            SET last_touch_at = now(), resident_id = $2, search_term = $3,
                last_view_payload = $4::jsonb, version = version + 1
          WHERE id = $1`,
        [
          sessionId,
          jejak.residentId ?? null,
          jejak.searchTerm ?? null,
          jejak.lastViewPayload === undefined ? null : JSON.stringify(jejak.lastViewPayload),
        ],
      );
      return { ended: false, reason: k.sebab, message: k.keterangan, remainingSeconds: k.sisaDetik };
    });
  }

  async tutupSesiKiosk(schemaName: string, sessionId: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.KIOSK');
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_kiosk_session
          SET ended_at = now(), end_reason = 'DITUTUP_PENGGUNA',
              resident_id = NULL, search_term = NULL, last_view_payload = NULL, request_id = NULL,
              version = version + 1
        WHERE id = $1 AND village_unit_id = $2 AND ended_at IS NULL
        RETURNING id`,
      [sessionId, u.id],
    );
    return { id: rows[0]?.id ?? sessionId, ended: true, traceCleared: true };
  }

  /** Menutup sesi kiosk yang menganggur. Dipanggil terjadwal. */
  async sapuSesiKiosk(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_kiosk_session
          SET ended_at = now(),
              end_reason = CASE
                WHEN now() - started_at >= interval '900 seconds' THEN 'UMUR_MAKSIMAL'
                ELSE 'MENGANGGUR' END,
              resident_id = NULL, search_term = NULL, last_view_payload = NULL, request_id = NULL,
              version = version + 1
        WHERE village_unit_id = $1 AND ended_at IS NULL
          AND (now() - last_touch_at >= interval '120 seconds'
               OR now() - started_at >= interval '900 seconds')
        RETURNING id`,
      [u.id],
    );
    if (rows.length) this.logger.log(`${rows.length} sesi kiosk ditutup beserta jejaknya`);
    return { closed: rows.length };
  }

  private async tutupSesiTerbuka(
    schemaName: string,
    unitId: string,
    kioskCode: string,
    reason: string,
  ) {
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_kiosk_session
          SET ended_at = now(), end_reason = $3,
              resident_id = NULL, search_term = NULL, last_view_payload = NULL, request_id = NULL,
              version = version + 1
        WHERE village_unit_id = $1 AND kiosk_code = $2 AND ended_at IS NULL`,
      [unitId, kioskCode, reason],
    );
  }

  // --- Siaran ---------------------------------------------------------------

  /**
   * Menyusun dan mengirim siaran.
   *
   * Kanal tanpa kredensial menghasilkan `TERHALANG` beserta alasannya — bukan
   * `GAGAL` yang mengundang percobaan ulang tak berujung, dan bukan `TERKIRIM`
   * yang akan diulang pemerintah desa kepada warganya.
   */
  async siarkan(
    schemaName: string,
    input: {
      title: string;
      message: string;
      channel: KanalSiaran;
      audience?: string;
      recipients?: string[];
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.SIARAN');

    const siap = await this.siaran.siap(input.channel);
    const izin = bolehSiarkan({ kanal: input.channel, adaKredensial: siap });

    const b = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_broadcast
         (village_unit_id, title, message, channel, audience, status, blocked_reason,
          queued_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7, now(), $8) RETURNING id`,
      [
        u.id,
        input.title,
        input.message,
        input.channel,
        input.audience ?? 'SEMUA_WARGA',
        izin.boleh ? 'ANTRE' : 'TERHALANG',
        izin.boleh ? null : izin.alasan,
        user.userId,
      ],
    );

    if (!izin.boleh) {
      return {
        id: b[0].id,
        status: 'TERHALANG',
        blockedReason: izin.alasan,
        // Dinyatakan sejelas mungkin supaya tidak ada yang menyimpulkan
        // sebaliknya dari status kode 2xx.
        note: 'Tidak ada pesan yang terkirim. Jangan memberi tahu warga bahwa pesannya sudah sampai.',
      };
    }

    const hasil = await this.siaran.kirim({
      channel: input.channel,
      title: input.title,
      message: input.message,
      recipients: input.recipients ?? [],
    });

    const tandai = bolehTandaiTerkirim(hasil.providerReference);
    if (!hasil.terkirim || !tandai.boleh) {
      await this.tenantDb.query(
        schemaName,
        `UPDATE "${schemaName}".village_broadcast
            SET status = $2,
                blocked_reason = $3, failure_reason = $4,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          b[0].id,
          hasil.blockedReason ? 'TERHALANG' : 'GAGAL',
          hasil.blockedReason ?? null,
          hasil.blockedReason ? null : (hasil.failureReason ?? tandai.alasan ?? 'Penyedia tidak mengembalikan rujukan.'),
        ],
      );
      return {
        id: b[0].id,
        status: hasil.blockedReason ? 'TERHALANG' : 'GAGAL',
        blockedReason: hasil.blockedReason ?? null,
        failureReason: hasil.failureReason ?? tandai.alasan ?? null,
      };
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_broadcast
          SET status = 'TERKIRIM', provider_reference = $2, sent_at = now(),
              recipient_count = $3, updated_at = now(), version = version + 1
        WHERE id = $1`,
      [b[0].id, hasil.providerReference, hasil.recipientCount],
    );
    return {
      id: b[0].id,
      status: 'TERKIRIM',
      providerReference: hasil.providerReference,
      recipientCount: hasil.recipientCount,
    };
  }

  async daftarSiaran(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'PORTAL.SIARAN');
    return this.tenantDb.query(
      schemaName,
      `SELECT id, title, channel, audience, status, blocked_reason AS "blockedReason",
              failure_reason AS "failureReason", provider_reference AS "providerReference",
              recipient_count AS "recipientCount", queued_at AS "queuedAt", sent_at AS "sentAt"
         FROM "${schemaName}".village_broadcast
        WHERE village_unit_id = $1
        ORDER BY created_at DESC LIMIT 100`,
      [u.id],
    );
  }
}

// --- Bagian dalam ------------------------------------------------------------

function terjemahkanBentrok(pesan: string) {
  return (error: unknown): never => {
    if ((error as { code?: string })?.code === '23505') {
      throw AppError.conflict(ErrorCodes.CONFLICT, pesan);
    }
    throw error;
  };
}
