/**
 * Layanan portal anggota.
 *
 * Satu keputusan rancangan menentukan keamanan seluruh berkas ini:
 *
 *   **`memberId` tidak pernah datang dari permintaan.**
 *
 * Tidak dari badan permintaan, tidak dari query, tidak dari parameter jalur,
 * dan tidak dari header. Ia selalu diturunkan dari sesi yang sudah diperiksa —
 * `user.userId` → `cooperative_member_portal_account.user_subject_id` →
 * `member_id` — lewat satu fungsi, `memberDiriSendiri()`.
 *
 * Sebabnya sederhana: portal dibuka kepada ratusan orang, dan endpoint yang
 * menerima `?memberId=` adalah endpoint yang dapat diubah angkanya oleh siapa
 * pun yang sudah masuk. Menyaring setelahnya membantu, tetapi tidak menerima
 * angkanya sama sekali jauh lebih sulit dilanggar tanpa sengaja.
 *
 * Aturan cakupannya sendiri ada di `cooperative-portal.ts` sebagai fungsi
 * murni, dan diuji di sana.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bersihkan,
  bolehMembaca,
  bolehMendaftarPublik,
  bolehPindahStatusPengaduan,
  samarkanRekening,
  type ComplaintStatus,
  type PortalResource,
} from './cooperative-portal';

export interface KonteksAnggota {
  cooperativeId: string;
  memberId: string;
  memberNumber: string | null;
  fullName: string;
  status: string;
  portalAccountId: string;
}

interface BarisMilik {
  id?: string;
  member_id?: string | null;
  cooperative_id?: string | null;
}

@Injectable()
export class CooperativePortalService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  // ------------------------------------------------------------------ Identitas

  /**
   * Menemukan anggota yang bersesuaian dengan sesi yang sedang berjalan.
   *
   * Ini satu-satunya jalan `memberId` masuk ke layanan ini. Setiap metode di
   * bawah memanggilnya lebih dahulu dan tidak menerima `memberId` sebagai
   * argumen dari pemanggilnya.
   */
  async memberDiriSendiri(schema: string, userSubjectId: string): Promise<KonteksAnggota> {
    const rows = await this.tenantDb.query<{
      portal_account_id: string;
      portal_status: string;
      member_id: string;
      member_number: string | null;
      full_name: string;
      member_status: string;
      cooperative_id: string;
    }>(
      schema,
      `SELECT pa.id AS portal_account_id, pa.status AS portal_status,
              m.id AS member_id, m.member_number, m.full_name,
              m.status AS member_status, m.cooperative_id
         FROM "${schema}".cooperative_member_portal_account pa
         JOIN "${schema}".cooperative_member m ON m.id = pa.member_id
        WHERE pa.user_subject_id = $1`,
      [userSubjectId],
    );

    if (rows.length === 0) {
      /*
       * Pengguna yang masuk tetapi bukan anggota — misalnya petugas koperasi
       * yang membuka alamat portal. Bukan galat, tetapi juga bukan sesuatu
       * yang boleh dijawab dengan data siapa pun.
       */
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun Anda belum tertaut ke keanggotaan koperasi mana pun.',
      );
    }

    const r = rows[0];
    if (r.portal_status !== 'ACTIVE') {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Akun portal Anda belum aktif. Hubungi pengurus koperasi.',
      );
    }

    return {
      cooperativeId: r.cooperative_id,
      memberId: r.member_id,
      memberNumber: r.member_number,
      fullName: r.full_name,
      status: r.member_status,
      portalAccountId: r.portal_account_id,
    };
  }

  /**
   * Menegakkan aturan cakupan atas satu baris, lalu mencatat hasilnya.
   *
   * Penolakan dicatat lengkap dengan kodenya. Jejak yang hanya mengatakan
   * "ditolak" tidak dapat membedakan salah ketik dari percobaan membaca data
   * orang lain — dan perbedaan itulah yang dicari saat ada dugaan kebocoran.
   */
  private async tegakkan(
    schema: string,
    konteks: KonteksAnggota,
    resource: PortalResource,
    row: BarisMilik | null,
  ): Promise<void> {
    const vonis = bolehMembaca({
      resource,
      viewerMemberId: konteks.memberId,
      ownerMemberId: row?.member_id ?? null,
      viewerStatus: konteks.status,
      cooperativeIdOfViewer: konteks.cooperativeId,
      cooperativeIdOfRow: row?.cooperative_id ?? konteks.cooperativeId,
    });

    if (vonis.allowed) return;

    await this.catat(schema, konteks, 'READ', resource, row?.id ?? null, 'DENIED', vonis.code);
    throw AppError.notFound(ErrorCodes.NOT_FOUND, vonis.message ?? 'Data tidak ditemukan.');
  }

  private async catat(
    schema: string,
    konteks: KonteksAnggota,
    action: string,
    resource: PortalResource | null,
    resourceId: string | null,
    outcome: 'ALLOWED' | 'DENIED' | 'ERROR',
    denyCode?: string,
  ): Promise<void> {
    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".cooperative_portal_activity
         (cooperative_id, member_id, action, resource, resource_id, outcome, deny_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        konteks.cooperativeId,
        konteks.memberId,
        action,
        resource,
        resourceId,
        outcome,
        denyCode ?? null,
      ],
    );
  }

  // ------------------------------------------------------------------ Ringkasan

  async ringkasan(schema: string, konteks: KonteksAnggota) {
    const [simpanan, pinjaman, shu, belumDibaca, aduanTerbuka] = await Promise.all([
      this.tenantDb.query<{ total: string; jumlah: number }>(
        schema,
        `SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*)::int AS jumlah
           FROM "${schema}".cooperative_saving_account
          WHERE member_id = $1 AND status = 'ACTIVE'`,
        [konteks.memberId],
      ),
      this.tenantDb.query<{ sisa: string; jumlah: number }>(
        schema,
        `SELECT COALESCE(SUM(outstanding_principal), 0) AS sisa, COUNT(*)::int AS jumlah
           FROM "${schema}".cooperative_loan
          WHERE member_id = $1 AND status IN ('ACTIVE', 'OVERDUE')`,
        [konteks.memberId],
      ),
      this.tenantDb.query<{ total: string }>(
        schema,
        `SELECT COALESCE(SUM(net_amount), 0) AS total
           FROM "${schema}".cooperative_shu_allocation WHERE member_id = $1`,
        [konteks.memberId],
      ),
      this.tenantDb.query<{ n: number }>(
        schema,
        `SELECT COUNT(*)::int AS n FROM "${schema}".cooperative_notification
          WHERE member_id = $1 AND read_at IS NULL`,
        [konteks.memberId],
      ),
      this.tenantDb.query<{ n: number }>(
        schema,
        `SELECT COUNT(*)::int AS n FROM "${schema}".cooperative_complaint
          WHERE member_id = $1 AND status NOT IN ('CLOSED', 'REJECTED')`,
        [konteks.memberId],
      ),
    ]);

    return {
      memberNumber: konteks.memberNumber,
      fullName: konteks.fullName,
      status: konteks.status,
      totalSimpanan: String(simpanan[0].total),
      jumlahRekening: simpanan[0].jumlah,
      sisaPinjaman: String(pinjaman[0].sisa),
      jumlahPinjaman: pinjaman[0].jumlah,
      totalShu: String(shu[0].total),
      pemberitahuanBelumDibaca: belumDibaca[0].n,
      pengaduanTerbuka: aduanTerbuka[0].n,
    };
  }

  // ------------------------------------------------------------------ Simpanan

  async simpanan(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT a.id, a.account_number, a.balance, a.status, a.opened_at,
              p.name AS product_name, p.saving_type, p.is_withdrawable,
              a.member_id, a.cooperative_id
         FROM "${schema}".cooperative_saving_account a
         JOIN "${schema}".cooperative_saving_product p ON p.id = a.product_id
        WHERE a.member_id = $1
        ORDER BY p.saving_type, a.opened_at`,
      [konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'SAVING_ACCOUNT', r);
    return rows.map((r) => ({
      ...bersihkan(r),
      account_number: samarkanRekening(r.account_number as string | null),
    }));
  }

  async mutasiSimpanan(schema: string, konteks: KonteksAnggota, accountId: string) {
    const akun = await this.tenantDb.query(
      schema,
      `SELECT id, member_id, cooperative_id
         FROM "${schema}".cooperative_saving_account WHERE id = $1`,
      [accountId],
    );
    await this.tegakkan(schema, konteks, 'SAVING_ACCOUNT', akun[0] ?? null);

    return this.tenantDb.query(
      schema,
      `SELECT id, transaction_date, transaction_type, amount, balance_after, description
         FROM "${schema}".cooperative_saving_transaction
        WHERE account_id = $1
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT 200`,
      [accountId],
    );
  }

  // ------------------------------------------------------------------ Pinjaman

  async pinjaman(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT l.id, l.loan_number, l.principal_amount, l.outstanding_principal,
              l.status, l.disbursed_at, l.tenor_months, l.method,
              p.name AS product_name, l.member_id, l.cooperative_id
         FROM "${schema}".cooperative_loan l
         JOIN "${schema}".cooperative_loan_product p ON p.id = l.product_id
        WHERE l.member_id = $1
        ORDER BY l.disbursed_at DESC NULLS LAST`,
      [konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'LOAN', r);
    return rows.map((r) => bersihkan(r));
  }

  async jadwalAngsuran(schema: string, konteks: KonteksAnggota, loanId: string) {
    const pinjaman = await this.tenantDb.query(
      schema,
      `SELECT id, member_id, cooperative_id FROM "${schema}".cooperative_loan WHERE id = $1`,
      [loanId],
    );
    await this.tegakkan(schema, konteks, 'LOAN', pinjaman[0] ?? null);

    return this.tenantDb.query(
      schema,
      `SELECT installment_no, due_date, principal_amount, interest_amount,
              total_amount, paid_amount, status
         FROM "${schema}".cooperative_installment_schedule
        WHERE loan_id = $1
        ORDER BY installment_no`,
      [loanId],
    );
  }

  // ----------------------------------------------------------------------- SHU

  async shu(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT a.id, a.fiscal_year, a.capital_service_amount, a.patronage_service_amount,
              a.gross_amount, a.deduction_amount, a.net_amount, a.status,
              a.member_id, a.cooperative_id
         FROM "${schema}".cooperative_shu_allocation a
        WHERE a.member_id = $1
        ORDER BY a.fiscal_year DESC`,
      [konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'SHU', r);
    return rows.map((r) => bersihkan(r));
  }

  // ---------------------------------------------------------------------- RAT

  /**
   * Rapat anggota — sumber daya bersama.
   *
   * Setiap anggota berhak membaca agenda, kuorum, dan keputusannya; itu bagian
   * dari hak mengawasi jalannya koperasi. Yang tetap milik perorangan adalah
   * suaranya, dan itu dilayani metode terpisah di bawah.
   */
  async rapat(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT id, meeting_number, meeting_type, title, scheduled_at, location,
              status, quorum_reached, cooperative_id
         FROM "${schema}".cooperative_meeting
        WHERE cooperative_id = $1
        ORDER BY scheduled_at DESC
        LIMIT 50`,
      [konteks.cooperativeId],
    );
    for (const r of rows) {
      await this.tegakkan(schema, konteks, 'MEETING', { ...r, member_id: null });
    }
    return rows;
  }

  async suaraSaya(schema: string, konteks: KonteksAnggota, meetingId: string) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT v.id, v.agenda_id, v.choice, v.voted_at, v.member_id, m.cooperative_id
         FROM "${schema}".cooperative_meeting_vote v
         JOIN "${schema}".cooperative_meeting m ON m.id = v.meeting_id
        WHERE v.meeting_id = $1 AND v.member_id = $2`,
      [meetingId, konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'VOTE', r);
    return rows;
  }

  // ----------------------------------------------------------------- Pengaduan

  async pengaduan(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT id, complaint_number, category, subject, body, severity, status,
              resolution, submitted_at, resolved_at, member_id, cooperative_id
         FROM "${schema}".cooperative_complaint
        WHERE member_id = $1
        ORDER BY submitted_at DESC`,
      [konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'COMPLAINT', r);
    return rows.map((r) => bersihkan(r));
  }

  async tanggapanPengaduan(schema: string, konteks: KonteksAnggota, complaintId: string) {
    const aduan = await this.tenantDb.query(
      schema,
      `SELECT id, member_id, cooperative_id FROM "${schema}".cooperative_complaint WHERE id = $1`,
      [complaintId],
    );
    await this.tegakkan(schema, konteks, 'COMPLAINT', aduan[0] ?? null);

    // Catatan internal pengurus tidak pernah tampil di portal.
    return this.tenantDb.query(
      schema,
      `SELECT id, author_type, body, created_at
         FROM "${schema}".cooperative_complaint_response
        WHERE complaint_id = $1 AND is_internal = false
        ORDER BY created_at`,
      [complaintId],
    );
  }

  async ajukanPengaduan(
    schema: string,
    konteks: KonteksAnggota,
    input: { category: string; subject: string; body: string; isAnonymous: boolean },
  ) {
    const nomor = await this.nomorBerikutnya(schema, konteks.cooperativeId, 'ADU');
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".cooperative_complaint
         (cooperative_id, member_id, complaint_number, category, subject, body, is_anonymous)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, complaint_number, status, submitted_at`,
      [
        konteks.cooperativeId,
        konteks.memberId, // dari sesi, bukan dari badan permintaan
        nomor,
        input.category,
        input.subject,
        input.body,
        input.isAnonymous,
      ],
    );
    await this.catat(schema, konteks, 'CREATE', 'COMPLAINT', rows[0].id, 'ALLOWED');
    return rows[0];
  }

  async tanggapiPengaduan(
    schema: string,
    konteks: KonteksAnggota,
    complaintId: string,
    body: string,
  ) {
    const aduan = await this.tenantDb.query<BarisMilik & { status: string }>(
      schema,
      `SELECT id, member_id, cooperative_id, status
         FROM "${schema}".cooperative_complaint WHERE id = $1`,
      [complaintId],
    );
    await this.tegakkan(schema, konteks, 'COMPLAINT', aduan[0] ?? null);

    const status = aduan[0].status as ComplaintStatus;
    if (status === 'CLOSED') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Pengaduan ini sudah ditutup. Ajukan pengaduan baru bila masih ada keberatan.',
      );
    }

    // Tanggapan anggota tidak pernah internal; ditegakkan di sini dan pada
    // constraint basis data.
    const rows = await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".cooperative_complaint_response
         (complaint_id, author_type, author_id, body, is_internal)
       VALUES ($1, 'MEMBER', $2, $3, false)
       RETURNING id, created_at`,
      [complaintId, konteks.memberId, body],
    );

    // Tanggapan anggota atas pengaduan yang sudah dinyatakan selesai
    // membukanya kembali — bukan menutupnya lebih rapat.
    if (status === 'RESOLVED' && bolehPindahStatusPengaduan('RESOLVED', 'IN_PROGRESS').allowed) {
      await this.tenantDb.query(
        schema,
        `UPDATE "${schema}".cooperative_complaint
            SET status = 'IN_PROGRESS', updated_at = now()
          WHERE id = $1`,
        [complaintId],
      );
    }
    return rows[0];
  }

  // ------------------------------------------------------------ Pemberitahuan

  async pemberitahuan(schema: string, konteks: KonteksAnggota) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT id, kind, title, body, link_path, read_at, created_at,
              member_id, cooperative_id
         FROM "${schema}".cooperative_notification
        WHERE member_id = $1
        ORDER BY created_at DESC
        LIMIT 100`,
      [konteks.memberId],
    );
    for (const r of rows) await this.tegakkan(schema, konteks, 'NOTIFICATION', r);
    return rows.map((r) => bersihkan(r));
  }

  async tandaiDibaca(schema: string, konteks: KonteksAnggota, id: string) {
    const n = await this.tenantDb.query(
      schema,
      `SELECT id, member_id, cooperative_id
         FROM "${schema}".cooperative_notification WHERE id = $1`,
      [id],
    );
    await this.tegakkan(schema, konteks, 'NOTIFICATION', n[0] ?? null);
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".cooperative_notification
          SET read_at = now() WHERE id = $1 AND read_at IS NULL`,
      [id],
    );
    return { id, read: true };
  }

  // ----------------------------------------------------------- Situs publik

  /**
   * Isi situs koperasi untuk pengunjung yang belum masuk.
   *
   * Hanya membaca dari tabel situs, tidak pernah dari tabel anggota. Angka
   * jumlah anggota disertakan hanya bila pengurus memilih menampilkannya.
   */
  async situsPublik(schema: string, slug: string) {
    const rows = await this.tenantDb.query<Record<string, never> & { id: string }>(
      schema,
      `SELECT c.id, c.name, c.slug, c.status, c.membership_scope,
              s.tagline, s.about_html, s.hero_image_url, s.logo_url, s.primary_color,
              s.contact_email, s.contact_phone, s.contact_whatsapp, s.public_address,
              s.map_embed_url, s.show_member_count, s.show_asset_total,
              s.show_board_members, s.show_saving_products, s.show_loan_products,
              s.accepts_online_application, s.application_notice_html,
              s.meta_description, s.is_published
         FROM "${schema}".cooperative c
         JOIN "${schema}".cooperative_website_setting s ON s.cooperative_id = c.id
        WHERE c.slug = $1 AND s.is_published = true`,
      [slug],
    );
    if (rows.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs koperasi tidak ditemukan.');
    }
    const situs = rows[0] as unknown as Record<string, unknown>;
    const kopId = rows[0].id;

    const halaman = await this.tenantDb.query(
      schema,
      `SELECT slug, title, page_type, sort_order
         FROM "${schema}".cooperative_website_page
        WHERE cooperative_id = $1 AND show_in_menu = true AND published_at IS NOT NULL
        ORDER BY sort_order, title`,
      [kopId],
    );

    const pengumuman = await this.tenantDb.query(
      schema,
      `SELECT id, title, body_html, category, published_at
         FROM "${schema}".cooperative_announcement
        WHERE cooperative_id = $1 AND audience = 'PUBLIC'
          AND published_at IS NOT NULL AND published_at <= now()
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY is_pinned DESC, published_at DESC
        LIMIT 10`,
      [kopId],
    );

    let jumlahAnggota: number | null = null;
    if (situs.show_member_count === true) {
      const r = await this.tenantDb.query<{ n: number }>(
        schema,
        `SELECT COUNT(*)::int AS n FROM "${schema}".cooperative_member
          WHERE cooperative_id = $1 AND status = 'ACTIVE'`,
        [kopId],
      );
      jumlahAnggota = r[0].n;
    }

    return {
      koperasi: {
        name: situs.name,
        slug: situs.slug,
        tagline: situs.tagline,
        aboutHtml: situs.about_html,
        heroImageUrl: situs.hero_image_url,
        logoUrl: situs.logo_url,
        primaryColor: situs.primary_color,
        metaDescription: situs.meta_description,
      },
      kontak: {
        email: situs.contact_email,
        phone: situs.contact_phone,
        whatsapp: situs.contact_whatsapp,
        address: situs.public_address,
        mapEmbedUrl: situs.map_embed_url,
      },
      tampilkan: {
        boardMembers: situs.show_board_members,
        savingProducts: situs.show_saving_products,
        loanProducts: situs.show_loan_products,
      },
      pendaftaran: {
        dibuka: bolehMendaftarPublik({
          cooperativeStatus: String(situs.status),
          membershipScope: String(situs.membership_scope),
          acceptsOnlineApplication: situs.accepts_online_application === true,
        }),
        noticeHtml: situs.application_notice_html,
      },
      jumlahAnggota,
      halaman,
      pengumuman,
    };
  }

  /**
   * Menerima lamaran calon anggota dari situs.
   *
   * Berhenti pada tabel karantina. Tidak pernah membentuk baris
   * `cooperative_member` — pengurus yang menerbitkannya setelah memeriksa.
   */
  async terimaLamaran(
    schema: string,
    slug: string,
    input: {
      fullName: string;
      phone: string;
      email?: string | null;
      occupation?: string | null;
      address?: string | null;
      motivation?: string | null;
      consentGiven: boolean;
      consentTextHash?: string | null;
    },
    sourceIpHash: string | null,
  ) {
    const kop = await this.tenantDb.query<{
      id: string;
      status: string;
      membership_scope: string;
      accepts_online_application: boolean;
    }>(
      schema,
      `SELECT c.id, c.status, c.membership_scope, s.accepts_online_application
         FROM "${schema}".cooperative c
         JOIN "${schema}".cooperative_website_setting s ON s.cooperative_id = c.id
        WHERE c.slug = $1 AND s.is_published = true`,
      [slug],
    );
    if (kop.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Situs koperasi tidak ditemukan.');
    }

    const vonis = bolehMendaftarPublik({
      cooperativeStatus: kop[0].status,
      membershipScope: kop[0].membership_scope,
      acceptsOnlineApplication: kop[0].accepts_online_application,
    });
    if (!vonis.allowed) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        vonis.message ?? 'Pendaftaran ditutup.',
      );
    }

    if (!input.consentGiven) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Persetujuan pengolahan data pribadi diperlukan untuk melanjutkan.',
      );
    }

    const nomor = await this.nomorBerikutnya(schema, kop[0].id, 'APP');
    const rows = await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".cooperative_public_application
         (cooperative_id, application_number, full_name, phone, email, occupation,
          address, motivation, consent_given, consent_at, consent_text_hash, source_ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now(), $9, $10)
       RETURNING id, application_number, status, submitted_at`,
      [
        kop[0].id,
        nomor,
        input.fullName,
        input.phone,
        input.email ?? null,
        input.occupation ?? null,
        input.address ?? null,
        input.motivation ?? null,
        input.consentTextHash ?? null,
        sourceIpHash,
      ],
    );
    return rows[0];
  }

  // ------------------------------------------------------------------ Bantuan

  private async nomorBerikutnya(
    schema: string,
    cooperativeId: string,
    awalan: 'ADU' | 'APP',
  ): Promise<string> {
    const tabel = awalan === 'ADU' ? 'cooperative_complaint' : 'cooperative_public_application';
    const rows = await this.tenantDb.query<{ n: number }>(
      schema,
      `SELECT COUNT(*)::int AS n FROM "${schema}".${tabel} WHERE cooperative_id = $1`,
      [cooperativeId],
    );
    const tahun = new Date().getUTCFullYear();
    return `${awalan}-${tahun}-${String(rows[0].n + 1).padStart(5, '0')}`;
  }
}
