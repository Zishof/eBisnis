/**
 * Pengaduan, aspirasi, dan Musrenbang.
 *
 * ## Anonimitas dijaga di sini pula, bukan hanya di basis data
 *
 * Constraint basis data menolak baris anonim yang membawa identitas. Layanan
 * ini memastikan identitasnya tidak pernah sampai ke sana sejak awal —
 * `saringIdentitas()` dipanggil sebelum penyisipan, bukan sesudahnya.
 *
 * Dua lapisan untuk satu aturan terdengar berlebihan sampai seseorang menambah
 * jalan ketiga menuju tabel itu. Yang di basis data menahan jalan yang belum
 * ada; yang di layanan memberi pesan yang dapat dibaca.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  bagiMenurutPagu,
  bolehMenangani,
  bolehPindahPengaduan,
  bolehPindahUsulan,
  kuorumTerpenuhi,
  saringIdentitas,
  tingkatPerhatian,
  urutkanUsulan,
  type ModePelapor,
  type StatusPengaduan,
  type StatusUsulan,
} from './village-complaint';

@Injectable()
export class VillageParticipationService {
  private readonly logger = new Logger(VillageParticipationService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Pengaduan ------------------------------------------------------------

  /**
   * Menerima pengaduan.
   *
   * Untuk mode anonim, identitas disaring **sebelum** menyentuh basis data.
   * Token pelacakan dikembalikan kepada pelapor — untuk pengaduan anonim inilah
   * satu-satunya cara ia menengok kembali aduannya, dan token itu tidak
   * menunjuk kepada siapa pun.
   */
  async adukan(
    schemaName: string,
    input: {
      categoryCode?: string;
      mode: ModePelapor;
      title: string;
      description: string;
      locationNote?: string;
      rtId?: string;
      concernsOfficerId?: string;
      reporterResidentId?: string;
      reporterName?: string;
      reporterPhone?: string;
    },
    user: AuthenticatedUser | null,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');
    const u = await this.unit.unit(schemaName);

    let kategoriId: string | null = null;
    let modeEfektif = input.mode;
    if (input.categoryCode) {
      const k = await this.tenantDb.query<{ id: string; concerns_officer: boolean }>(
        schemaName,
        `SELECT id, concerns_officer FROM "${schemaName}".village_complaint_category
          WHERE village_unit_id = $1 AND code = $2 AND is_active = TRUE AND deleted_at IS NULL`,
        [u.id, input.categoryCode],
      );
      if (!k.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kategori pengaduan tidak dikenal.');
      }
      kategoriId = k[0].id;
      /*
       * Kategori yang menyangkut aparatur bawaannya anonim. Warga yang memilih
       * kategori itu lalu lupa mencentang "sembunyikan nama saya" tidak boleh
       * tanpa sengaja mengungkapkan dirinya kepada orang yang ia adukan.
       */
      if (k[0].concerns_officer) modeEfektif = 'ANONIM';
    }

    const pelapor = saringIdentitas(modeEfektif, {
      residentId: input.reporterResidentId,
      userId: user?.userId,
      name: input.reporterName,
      phone: input.reporterPhone,
    });

    const token = randomBytes(16).toString('base64url');
    const nomor = await this.nomorTiket(schemaName, u.id);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_complaint
         (village_unit_id, category_id, ticket_number, reporter_mode,
          reporter_resident_id, reporter_user_id, reporter_name, reporter_phone,
          tracking_token, title, description, location_note, village_rt_id,
          concerns_officer_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id`,
      [
        u.id,
        kategoriId,
        nomor,
        modeEfektif,
        pelapor.residentId,
        pelapor.userId,
        pelapor.name,
        pelapor.phone,
        token,
        input.title,
        input.description,
        input.locationNote ?? null,
        input.rtId ?? null,
        input.concernsOfficerId ?? null,
      ],
    );

    return {
      id: rows[0].id,
      ticketNumber: nomor,
      trackingToken: token,
      reporterMode: modeEfektif,
      note:
        modeEfektif === 'ANONIM'
          ? 'Identitas Anda tidak disimpan. Simpan kode pelacakan ini — tanpa kode itu, aduan Anda tidak dapat ditemukan kembali.'
          : undefined,
    };
  }

  /** Menugaskan pengaduan kepada petugas. */
  async tugaskan(
    schemaName: string,
    complaintId: string,
    officerId: string,
    user: AuthenticatedUser,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<Record<string, string>>(
        `SELECT id, status, concerns_officer_id FROM "${schemaName}".village_complaint
          WHERE id = $1 FOR UPDATE`,
        [complaintId],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pengaduan tidak ditemukan.');

      const v = bolehMenangani(p.rows[0].concerns_officer_id ?? null, officerId);
      if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);

      const t = bolehPindahPengaduan(p.rows[0].status as StatusPengaduan, 'DITUGASKAN');
      if (!t.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, t.alasan!);

      await client.query(
        `UPDATE "${schemaName}".village_complaint
            SET status = 'DITUGASKAN', assigned_officer_id = $2, assigned_at = now(),
                last_action_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1`,
        [complaintId, officerId],
      );
      await client.query(
        `INSERT INTO "${schemaName}".village_complaint_followup
           (complaint_id, from_status, to_status, note, actor_user_id, active_role_id)
         VALUES ($1, $2, 'DITUGASKAN', 'Pengaduan ditugaskan kepada petugas', $3, $4)`,
        [complaintId, p.rows[0].status, user.userId, user.activeRoleId ?? null],
      );

      return { id: complaintId, status: 'DITUGASKAN' };
    });
  }

  /** Memindahkan status pengaduan beserta catatan tindak lanjutnya. */
  async tindaklanjuti(
    schemaName: string,
    complaintId: string,
    ke: StatusPengaduan,
    catatan: string,
    user: AuthenticatedUser,
    terlihatPelapor = true,
  ) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<Record<string, string>>(
        `SELECT id, status FROM "${schemaName}".village_complaint WHERE id = $1 FOR UPDATE`,
        [complaintId],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pengaduan tidak ditemukan.');

      const v = bolehPindahPengaduan(p.rows[0].status as StatusPengaduan, ke);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);
      if (v.wajibBeralasan && !catatan?.trim()) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Perubahan ini wajib menyertakan alasan yang dapat dibaca pelapor. ' +
            'Aduan yang berhenti tanpa keterangan akan ditanyakan kembali.',
        );
      }

      const kolomAlasan =
        ke === 'DITUTUP' || ke === 'BUKAN_KEWENANGAN'
          ? 'close_reason'
          : ke === 'SELESAI'
            ? 'resolution_note'
            : null;

      await client.query(
        `UPDATE "${schemaName}".village_complaint
            SET status = $2${kolomAlasan ? `, ${kolomAlasan} = $3` : ''},
                ${ke === 'SELESAI' ? 'resolved_at = now(),' : ''}
                last_action_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1`,
        kolomAlasan ? [complaintId, ke, catatan] : [complaintId, ke],
      );
      await client.query(
        `INSERT INTO "${schemaName}".village_complaint_followup
           (complaint_id, from_status, to_status, note, actor_user_id, active_role_id, visible_to_reporter)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          complaintId,
          p.rows[0].status,
          ke,
          catatan,
          user.userId,
          user.activeRoleId ?? null,
          terlihatPelapor,
        ],
      );

      return { id: complaintId, status: ke };
    });
  }

  /**
   * Melacak pengaduan dari token.
   *
   * Untuk pelapor, termasuk yang anonim. Tidak mengembalikan identitas siapa
   * pun — tidak ada yang tersimpan untuk dikembalikan.
   */
  async lacakPengaduan(schemaName: string, token: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT ticket_number, title, status, created_at::text, resolved_at::text,
              resolution_note, close_reason
         FROM "${schemaName}".village_complaint WHERE tracking_token = $1`,
      [token],
    );
    if (!rows.length) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Kode pelacakan tidak dikenali. Pastikan kode disalin lengkap.',
      );
    }

    const riwayat = await this.tenantDb.query(
      schemaName,
      `SELECT to_status, note, occurred_at::text
         FROM "${schemaName}".village_complaint_followup f
         JOIN "${schemaName}".village_complaint c ON c.id = f.complaint_id
        WHERE c.tracking_token = $1 AND f.visible_to_reporter = TRUE
        ORDER BY f.occurred_at`,
      [token],
    );

    return { ...rows[0], history: riwayat };
  }

  /** Pengaduan yang perlu diangkat. */
  async perluPerhatian(schemaName: string) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');
    const u = await this.unit.unit(schemaName);

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, ticket_number, title, status,
              GREATEST(0, (CURRENT_DATE - last_action_at::date))::int AS hari_diam
         FROM "${schemaName}".village_complaint
        WHERE village_unit_id = $1 AND status NOT IN ('SELESAI', 'DITUTUP', 'BUKAN_KEWENANGAN')
        ORDER BY last_action_at`,
      [u.id],
    );

    return rows
      .map((r) => {
        const t = tingkatPerhatian(Number(r.hari_diam), r.status as StatusPengaduan);
        return { ...r, attention: t.tingkat, note: t.keterangan };
      })
      .filter((r) => r.attention !== 'NORMAL');
  }

  // --- Musrenbang -----------------------------------------------------------

  /**
   * Membuka forum Musrenbang.
   *
   * Jenis forumnya ditentukan profil penyewa, bukan permintaan: desa
   * menyelenggarakan Musdes, kelurahan menyelenggarakan Muskel, dan keduanya
   * berbeda bentuk maupun jenjangnya.
   */
  async bukaMusrenbang(
    schemaName: string,
    input: { fiscalYear: number; title: string; heldAt?: string; quorumMinimum?: number; budgetCeiling?: number },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.unit(schemaName);
    const kode = u.profileType === 'DESA' ? 'PARTISIPASI.MUSRENBANG_DESA' : 'PARTISIPASI.MUSRENBANG_KELURAHAN';
    await this.unit.pastikanLayak(schemaName, kode);

    const jenis = u.profileType === 'DESA' ? 'MUSDES' : 'MUSKEL';
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_musrenbang
         (village_unit_id, forum_type, fiscal_year, title, held_at, quorum_minimum,
          budget_ceiling, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        u.id,
        jenis,
        input.fiscalYear,
        input.title,
        input.heldAt ?? null,
        input.quorumMinimum ?? 30,
        input.budgetCeiling ?? 0,
        user.userId,
      ],
    );
    return { id: rows[0].id, forumType: jenis };
  }

  /**
   * Menetapkan hasil musyawarah.
   *
   * Menolak bila kuorum tidak terpenuhi. Musyawarah yang dihadiri lima orang
   * bukan musyawarah desa, dan hasilnya tidak dapat ditetapkan sebagai
   * keputusan.
   */
  async tetapkanHasil(schemaName: string, musrenbangId: string, user: AuthenticatedUser) {
    const u = await this.unit.unit(schemaName);
    const kode = u.profileType === 'DESA' ? 'PARTISIPASI.MUSRENBANG_DESA' : 'PARTISIPASI.MUSRENBANG_KELURAHAN';
    await this.unit.pastikanLayak(schemaName, kode);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const m = await client.query<Record<string, string>>(
        `SELECT id, status, quorum_minimum, budget_ceiling::text FROM "${schemaName}".village_musrenbang
          WHERE id = $1 FOR UPDATE`,
        [musrenbangId],
      );
      if (!m.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Musrenbang tidak ditemukan.');
      if (m.rows[0].status === 'SELESAI') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Hasil Musrenbang ini sudah ditetapkan.');
      }

      const hadir = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${schemaName}".village_musrenbang_attendee
          WHERE musrenbang_id = $1`,
        [musrenbangId],
      );
      const k = kuorumTerpenuhi(Number(hadir.rows[0].n), Number(m.rows[0].quorum_minimum));
      if (!k.sah) throw AppError.conflict(ErrorCodes.CONFLICT, k.keterangan);

      const usulan = await client.query<Record<string, string>>(
        `SELECT id, title, estimated_cost::text, beneficiary_count, priority_score, status
           FROM "${schemaName}".village_proposal
          WHERE musrenbang_id = $1 AND status IN ('DIUSULKAN', 'DIBAHAS')`,
        [musrenbangId],
      );

      const bagi = bagiMenurutPagu(
        usulan.rows.map((r) => ({
          id: r.id,
          title: r.title,
          estimatedCost: Number(r.estimated_cost),
          beneficiaryCount: Number(r.beneficiary_count),
          priorityScore: Number(r.priority_score),
          status: r.status as StatusUsulan,
        })),
        Number(m.rows[0].budget_ceiling),
      );

      for (const s of bagi.masuk) {
        await client.query(
          `UPDATE "${schemaName}".village_proposal
              SET status = 'DISEPAKATI', updated_at = now(), version = version + 1 WHERE id = $1`,
          [s.id],
        );
      }
      /*
       * Usulan yang tidak tertampung DITUNDA, bukan ditolak. Menolaknya
       * menghapus jejak bahwa warga pernah mengusulkannya, dan tahun depan
       * pengusulnya harus mulai dari nol.
       */
      for (const s of bagi.luar) {
        await client.query(
          `UPDATE "${schemaName}".village_proposal
              SET status = 'DITUNDA',
                  decision_note = 'Belum tertampung pagu tahun ini; dibahas kembali pada Musrenbang berikutnya.',
                  updated_at = now(), version = version + 1
            WHERE id = $1`,
          [s.id],
        );
      }

      await client.query(
        `UPDATE "${schemaName}".village_musrenbang
            SET status = 'SELESAI', attendee_count = $2,
                finalized_by = $3, finalized_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [musrenbangId, Number(hadir.rows[0].n), user.userId],
      );

      this.logger.log(
        `Musrenbang ${musrenbangId}: ${bagi.masuk.length} usulan disepakati, ${bagi.luar.length} ditunda`,
      );

      return {
        quorum: k,
        accepted: bagi.masuk.map((s) => ({ id: s.id, title: s.title, cost: s.estimatedCost })),
        deferred: bagi.luar.map((s) => ({ id: s.id, title: s.title, cost: s.estimatedCost })),
        budgetUsed: bagi.terpakai,
        budgetRemaining: bagi.sisa,
      };
    });
  }

  /** Usulan terurut menurut prioritas musyawarah. */
  async usulanTerurut(schemaName: string, musrenbangId: string) {
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, title, estimated_cost::text, beneficiary_count, priority_score, status
         FROM "${schemaName}".village_proposal WHERE musrenbang_id = $1`,
      [musrenbangId],
    );
    return urutkanUsulan(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        estimatedCost: Number(r.estimated_cost),
        beneficiaryCount: Number(r.beneficiary_count),
        priorityScore: Number(r.priority_score),
        status: r.status as StatusUsulan,
      })),
    );
  }

  /** Memutuskan satu usulan. */
  async putuskanUsulan(
    schemaName: string,
    proposalId: string,
    ke: StatusUsulan,
    catatan: string | undefined,
    _user: AuthenticatedUser,
  ) {
    const p = await this.tenantDb.query<{ status: string }>(
      schemaName,
      `SELECT status FROM "${schemaName}".village_proposal WHERE id = $1`,
      [proposalId],
    );
    if (!p.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Usulan tidak ditemukan.');

    const v = bolehPindahUsulan(p[0].status as StatusUsulan, ke);
    if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);
    if (v.wajibBeralasan && !catatan?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Penolakan dan penundaan usulan wajib beralasan. Warga yang usulannya ditolak tanpa ' +
          'keterangan tidak akan mengusulkan lagi tahun depan.',
      );
    }

    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_proposal
          SET status = $2, decision_note = COALESCE($3, decision_note),
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [proposalId, ke, catatan ?? null],
    );
    return { id: proposalId, status: ke };
  }

  // --- Aspirasi -------------------------------------------------------------

  async sampaikanAspirasi(
    schemaName: string,
    input: {
      mode: ModePelapor;
      title: string;
      description: string;
      category?: string;
      reporterResidentId?: string;
      reporterName?: string;
    },
  ) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.ASPIRASI');
    const u = await this.unit.unit(schemaName);

    const pelapor = saringIdentitas(input.mode, {
      residentId: input.reporterResidentId,
      name: input.reporterName,
    });

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_aspiration
         (village_unit_id, reporter_mode, reporter_resident_id, reporter_name,
          title, description, category)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        u.id,
        input.mode,
        pelapor.residentId,
        pelapor.name,
        input.title,
        input.description,
        input.category ?? null,
      ],
    );
    return { id: rows[0].id, reporterMode: input.mode };
  }

  // --- Bagian dalam ---------------------------------------------------------

  private async nomorTiket(schemaName: string, unitId: string): Promise<string> {
    const rows = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT count(*)::text AS n FROM "${schemaName}".village_complaint
        WHERE village_unit_id = $1 AND date_part('year', created_at) = date_part('year', now())`,
      [unitId],
    );
    return `ADU-${new Date().getFullYear()}-${String(Number(rows[0].n) + 1).padStart(5, '0')}`;
  }
}
