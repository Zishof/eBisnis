/**
 * PPID, transparansi, dan laporan.
 *
 * ## Setiap agregat publik melewati penekanan
 *
 * Tidak ada jalan keluar lain. Metode yang menghasilkan angka per wilayah di
 * berkas ini seluruhnya berakhir pada `sajikan()` lalu `sajikanPublik()`, dan
 * yang kedua membuang alasan penekanan — sel bertanda `DI_BAWAH_AMBANG` sudah
 * memberi tahu pembacanya bahwa isinya kurang dari ambang.
 *
 * ## Ambang dicuplik ke laporan, bukan dirujuk
 *
 * Laporan yang merujuk kebijakan yang berlaku sekarang akan berubah artinya
 * setiap kali kebijakannya diubah, dan laporan yang berubah artinya bukan
 * laporan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  AMBANG_BAWAAN,
  bolehKecualikan,
  bolehPerpanjang,
  bolehPindahPermohonan,
  bolehTolak,
  bolehUbahAmbang,
  dapatDibongkar,
  hitungTenggat,
  keterlambatan,
  sajikan,
  sajikanPublik,
  tambahHariKerja,
  HARI_KEBERATAN,
  type GolonganInformasi,
  type SelAgregat,
  type StatusPermohonan,
} from './village-disclosure';

@Injectable()
export class VillageTransparencyService {
  private readonly logger = new Logger(VillageTransparencyService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Kebijakan penyajian --------------------------------------------------

  private async kebijakan(schemaName: string, unitId: string) {
    const rows = await this.tenantDb.query<{ threshold: number; published_threshold_floor: number }>(
      schemaName,
      `SELECT threshold, published_threshold_floor
         FROM "${schemaName}".village_disclosure_policy WHERE village_unit_id = $1`,
      [unitId],
    );
    if (rows.length) {
      return {
        ambang: Number(rows[0].threshold),
        lantai: Number(rows[0].published_threshold_floor),
      };
    }
    await this.tenantDb.query(
      schemaName,
      `INSERT INTO "${schemaName}".village_disclosure_policy (village_unit_id, threshold)
       VALUES ($1, $2) ON CONFLICT (village_unit_id) DO NOTHING`,
      [unitId, AMBANG_BAWAAN],
    );
    return { ambang: AMBANG_BAWAAN, lantai: 0 };
  }

  async lihatKebijakan(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.LAPORAN');
    const k = await this.kebijakan(schemaName, u.id);
    return {
      threshold: k.ambang,
      publishedThresholdFloor: k.lantai,
      note:
        `Angka agregat yang mewakili kurang dari ${k.ambang} orang tidak ditampilkan. ` +
        (k.lantai > 0
          ? `Ambang tidak dapat diturunkan di bawah ${k.lantai} karena sudah ada laporan yang terbit dengannya.`
          : 'Belum ada laporan yang terbit, sehingga ambang masih dapat diturunkan.'),
    };
  }

  /**
   * Mengubah ambang penyajian.
   *
   * Menaikkan selalu boleh. Menurunkan ditolak layanan bila sudah ada laporan
   * terbit — dan ditolak lagi oleh constraint, sehingga jalur impor maupun
   * penyuntingan langsung sama-sama tertahan.
   */
  async ubahAmbang(schemaName: string, ambangBaru: number, user: AuthenticatedUser, note?: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.LAPORAN');
    const k = await this.kebijakan(schemaName, u.id);

    const v = bolehUbahAmbang(k.ambang, ambangBaru, k.lantai > 0);
    if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

    await this.tenantDb
      .query(
        schemaName,
        `UPDATE "${schemaName}".village_disclosure_policy
            SET threshold = $2, note = $3, updated_by = $4, updated_at = now(),
                version = version + 1
          WHERE village_unit_id = $1`,
        [u.id, ambangBaru, note ?? null, user.userId],
      )
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === '23514') {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Ambang tidak dapat diturunkan di bawah yang pernah dipakai laporan yang sudah terbit.',
          );
        }
        throw e;
      });

    return { threshold: ambangBaru };
  }

  // --- Laporan agregat ------------------------------------------------------

  /** Penduduk per RT, sudah melewati penekanan. */
  async pendudukPerRt(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.LAPORAN');
    const k = await this.kebijakan(schemaName, u.id);

    const rows = await this.tenantDb.query<{ kunci: string; cacah: string }>(
      schemaName,
      `SELECT COALESCE(w.number || '/' || t.number, 'Tanpa RT') AS kunci,
              count(r.id)::text AS cacah
         FROM "${schemaName}".village_resident r
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE r.village_unit_id = $1 AND r.deleted_at IS NULL AND r.resident_status = 'TETAP'
        GROUP BY 1 ORDER BY 1`,
      [u.id],
    );

    const sel: SelAgregat[] = rows.map((r) => ({ kunci: r.kunci, cacah: Number(r.cacah) }));
    return sajikanPublik(sajikan(sel, { ambang: k.ambang }));
  }

  /** Penerima bantuan per RT — jenis agregat yang paling mudah membongkar orang. */
  async penerimaBantuanPerRt(schemaName: string, aidCategory?: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.LAPORAN');
    const k = await this.kebijakan(schemaName, u.id);

    const rows = await this.tenantDb.query<{ kunci: string; cacah: string }>(
      schemaName,
      `SELECT COALESCE(w.number || '/' || t.number, 'Tanpa RT') AS kunci,
              count(b.id)::text AS cacah
         FROM "${schemaName}".village_aid_beneficiary b
         JOIN "${schemaName}".village_resident r ON r.id = b.resident_id
    LEFT JOIN "${schemaName}".village_rt t ON t.id = r.village_rt_id
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
        WHERE b.village_unit_id = $1 AND b.status = 'AKTIF'
          AND ($2::varchar IS NULL OR b.aid_category = $2::varchar)
        GROUP BY 1 ORDER BY 1`,
      [u.id, aidCategory ?? null],
    );

    const sel: SelAgregat[] = rows.map((r) => ({ kunci: r.kunci, cacah: Number(r.cacah) }));
    return sajikanPublik(sajikan(sel, { ambang: k.ambang }));
  }

  /**
   * Menerbitkan laporan.
   *
   * Ambang yang dipakai **dicuplik** ke barisnya, dan pemicu basis data
   * menaikkan lantai ambang unit ini. Sejak itu, ambang tidak dapat diturunkan
   * di bawahnya.
   */
  async terbitkanLaporan(
    schemaName: string,
    input: { reportCode: string; title: string; period: string; cells: SelAgregat[] },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.LAPORAN');
    const k = await this.kebijakan(schemaName, u.id);

    const hasil = sajikan(input.cells, { ambang: k.ambang });

    // Diperiksa sebelum disimpan. Constraint menahannya juga, tetapi pesan
    // constraint tidak menjelaskan apa pun kepada petugas yang menyusunnya.
    if (dapatDibongkar(hasil)) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Laporan ini masih dapat dibongkar dengan pengurangan dari totalnya. Naikkan ambang ' +
          'penyajian atau gabungkan wilayah yang cacahnya sedikit.',
      );
    }

    const publik = sajikanPublik(hasil);
    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_report_publication
           (village_unit_id, report_code, title, period, threshold_used, suppressed_cells,
            hidden_count, total_shown, payload, published_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) RETURNING id`,
        [
          u.id,
          input.reportCode,
          input.title,
          input.period,
          hasil.ambang,
          hasil.jumlahDitekan,
          hasil.sisaTersembunyi,
          hasil.totalAman,
          JSON.stringify(publik),
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Laporan dengan kode dan periode ini sudah terbit.'));

    this.logger.log(
      `Laporan ${input.reportCode} ${input.period} terbit dengan ambang ${hasil.ambang}; ` +
        `${hasil.jumlahDitekan} sel ditekan`,
    );
    return { id: rows[0].id, ...publik, suppressedCells: hasil.jumlahDitekan };
  }

  async daftarLaporan(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, report_code AS "reportCode", title, period, threshold_used AS "thresholdUsed",
              suppressed_cells AS "suppressedCells", published_at AS "publishedAt", payload
         FROM "${schemaName}".village_report_publication
        WHERE village_unit_id = $1 AND withdrawn_at IS NULL
        ORDER BY published_at DESC LIMIT 100`,
      [u.id],
    );
  }

  // --- Daftar Informasi Publik ----------------------------------------------

  async catatInformasi(
    schemaName: string,
    input: {
      code: string;
      title: string;
      classification?: GolonganInformasi;
      description?: string;
      responsibleUnit?: string;
      format?: string;
      retentionPeriod?: string;
      publicationUrl?: string;
      exemptionBasis?: string;
      exemptionConsequence?: string;
      exemptionUntil?: string;
      isPublished?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const golongan = input.classification ?? 'SETIAP_SAAT';

    if (golongan === 'DIKECUALIKAN') {
      const v = bolehKecualikan({
        dasarHukum: input.exemptionBasis ?? '',
        konsekuensi: input.exemptionConsequence ?? '',
        berlakuSampai: input.exemptionUntil ?? null,
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);
    }

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_information_item
           (village_unit_id, code, title, description, classification, responsible_unit, format,
            retention_period, publication_url, exemption_basis, exemption_consequence,
            exemption_until, is_published, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [
          u.id,
          input.code,
          input.title,
          input.description ?? null,
          golongan,
          input.responsibleUnit ?? null,
          input.format ?? null,
          input.retentionPeriod ?? null,
          input.publicationUrl ?? null,
          golongan === 'DIKECUALIKAN' ? (input.exemptionBasis ?? null) : null,
          golongan === 'DIKECUALIKAN' ? (input.exemptionConsequence ?? null) : null,
          golongan === 'DIKECUALIKAN' ? (input.exemptionUntil ?? null) : null,
          golongan === 'DIKECUALIKAN' ? false : (input.isPublished ?? false),
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode informasi sudah dipakai.'));

    return { id: rows[0].id, classification: golongan };
  }

  /** Daftar Informasi Publik, beserta pengecualian yang sudah lewat masanya. */
  async daftarInformasi(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schemaName,
      `SELECT id, code, title, description, classification,
              responsible_unit AS "responsibleUnit", format, publication_url AS "publicationUrl",
              exemption_basis AS "exemptionBasis", exemption_consequence AS "exemptionConsequence",
              exemption_until::text AS "exemptionUntil", is_published AS "isPublished"
         FROM "${schemaName}".village_information_item
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY classification, code`,
      [u.id],
    );

    const hariIni = new Date().toISOString().slice(0, 10);
    return rows.map((r) => ({
      ...r,
      // Pengecualian yang lewat masanya disebutkan, bukan dibiarkan. Tidak ada
      // yang akan meninjaunya kembali bila tidak ada yang menyebutkannya.
      exemptionExpired:
        r.classification === 'DIKECUALIKAN' &&
        typeof r.exemptionUntil === 'string' &&
        r.exemptionUntil < hariIni,
    }));
  }

  // --- Permohonan informasi -------------------------------------------------

  private async hariLibur(schemaName: string, unitId: string): Promise<Set<string>> {
    const rows = await this.tenantDb.query<{ holiday_date: string }>(
      schemaName,
      `SELECT holiday_date::text FROM "${schemaName}".village_holiday WHERE village_unit_id = $1`,
      [unitId],
    );
    return new Set(rows.map((r) => r.holiday_date));
  }

  async terimaPermohonan(
    schemaName: string,
    input: {
      requestNumber: string;
      applicantName: string;
      requestedInformation: string;
      applicantContact?: string;
      applicantAddress?: string;
      purpose?: string;
      informationItemId?: string;
      deliveryMethod?: string;
      receivedAt?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const libur = await this.hariLibur(schemaName, u.id);
    const diterima = input.receivedAt ?? new Date().toISOString().slice(0, 10);
    const t = hitungTenggat(diterima, libur);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_information_request
           (village_unit_id, request_number, applicant_name, applicant_contact, applicant_address,
            purpose, requested_information, information_item_id, delivery_method,
            received_at, due_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
        [
          u.id,
          input.requestNumber,
          input.applicantName,
          input.applicantContact ?? null,
          input.applicantAddress ?? null,
          // Tidak diwajibkan. Hak atas informasi publik tidak bergantung pada
          // keperluan pemohon, dan mewajibkannya membuat petugas menilai
          // keperluan itu — penilaian yang bukan kewenangannya.
          input.purpose ?? null,
          input.requestedInformation,
          input.informationItemId ?? null,
          input.deliveryMethod ?? null,
          diterima,
          t.tenggat,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Nomor permohonan sudah dipakai.'));

    return { id: rows[0].id, dueAt: t.tenggat };
  }

  async perpanjangPermohonan(
    schemaName: string,
    requestId: string,
    alasan: string,
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const libur = await this.hariLibur(schemaName, u.id);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const r = await client.query<Record<string, string | boolean>>(
        `SELECT status, extended, due_at::text FROM "${schemaName}".village_information_request
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [requestId, u.id],
      );
      if (!r.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Permohonan tidak ditemukan.');

      const v = bolehPerpanjang(Boolean(r.rows[0].extended), alasan);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const pindah = bolehPindahPermohonan(r.rows[0].status as StatusPermohonan, 'DIPERPANJANG');
      if (!pindah.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, pindah.alasan!);

      const baru = tambahHariKerja(String(r.rows[0].due_at), 7, libur);
      await client.query(
        `UPDATE "${schemaName}".village_information_request
            SET status = 'DIPERPANJANG', extended = TRUE, extension_reason = $2, due_at = $3,
                handled_by = $4, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [requestId, alasan, baru, user.userId],
      );
      return { id: requestId, dueAt: baru };
    });
  }

  /**
   * Menjawab permohonan.
   *
   * Penolakan wajib menyebut cara mengajukan keberatan — diperiksa layanan agar
   * pesannya terbaca, dan ditegakkan constraint agar tidak dapat dilewati.
   */
  async jawabPermohonan(
    schemaName: string,
    requestId: string,
    input: {
      status: 'DIPENUHI' | 'DIPENUHI_SEBAGIAN' | 'DITOLAK';
      responseNote?: string;
      refusalBasis?: string;
      refusalDetail?: string;
      objectionGuidance?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');

    if (input.status === 'DITOLAK') {
      const v = bolehTolak({
        dasarHukum: input.refusalBasis ?? '',
        uraian: input.refusalDetail ?? '',
        caraKeberatan: input.objectionGuidance ?? '',
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const r = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_information_request
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [requestId, u.id],
      );
      if (!r.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Permohonan tidak ditemukan.');

      const pindah = bolehPindahPermohonan(r.rows[0].status as StatusPermohonan, input.status);
      if (!pindah.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, pindah.alasan!);

      await client.query(
        `UPDATE "${schemaName}".village_information_request
            SET status = $2, response_note = $3, refusal_basis = $4, refusal_detail = $5,
                objection_guidance = $6, answered_at = CURRENT_DATE, handled_by = $7,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          requestId,
          input.status,
          input.responseNote ?? null,
          input.status === 'DITOLAK' ? (input.refusalBasis ?? null) : null,
          input.status === 'DITOLAK' ? (input.refusalDetail ?? null) : null,
          input.status === 'DITOLAK' ? (input.objectionGuidance ?? null) : null,
          user.userId,
        ],
      );
      return { id: requestId, status: input.status };
    });
  }

  /** Permohonan yang lewat tenggat dan belum dijawab. */
  async permohonanTerlambat(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const libur = await this.hariLibur(schemaName, u.id);
    const hariIni = new Date().toISOString().slice(0, 10);

    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT id, request_number AS "requestNumber", applicant_name AS "applicantName",
              received_at::text AS "receivedAt", due_at::text AS "dueAt", status, extended
         FROM "${schemaName}".village_information_request
        WHERE village_unit_id = $1 AND status IN ('DITERIMA','DIPROSES','DIPERPANJANG')
          AND due_at < CURRENT_DATE
        ORDER BY due_at`,
      [u.id],
    );

    return rows.map((r) => ({
      ...r,
      // Terlambat berapa hari kerja, bukan hari kalender. Angka hari kalender
      // menyalahkan kantor desa atas akhir pekan.
      lateWorkingDays: keterlambatan(String(r.dueAt), hariIni, libur),
    }));
  }

  // --- Keberatan ------------------------------------------------------------

  async ajukanKeberatan(
    schemaName: string,
    input: { requestId: string; objectionNumber: string; reason: string; filedAt?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const libur = await this.hariLibur(schemaName, u.id);
    const diajukan = input.filedAt ?? new Date().toISOString().slice(0, 10);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_information_objection
           (village_unit_id, information_request_id, objection_number, reason, filed_at, due_at,
            created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          u.id,
          input.requestId,
          input.objectionNumber,
          input.reason,
          diajukan,
          tambahHariKerja(diajukan, HARI_KEBERATAN, libur),
          user.userId,
        ],
      )
      .catch(
        terjemahkanBentrok(
          'Nomor keberatan sudah dipakai, atau permohonan ini sudah memiliki keberatan yang berjalan.',
        ),
      );

    return { id: rows[0].id };
  }

  async putuskanKeberatan(
    schemaName: string,
    objectionId: string,
    input: { decision: 'DIKABULKAN' | 'DIKABULKAN_SEBAGIAN' | 'DITOLAK'; decisionNote: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');

    if ((input.decisionNote ?? '').trim().length < 20) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Pertimbangan putusan keberatan wajib diuraikan, sekurang-kurangnya dua puluh huruf. ' +
          'Putusan tanpa pertimbangan tidak dapat diuji siapa pun.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_information_objection
          SET decision = $3, decision_note = $4, decided_at = CURRENT_DATE, decided_by = $5,
              updated_at = now(), version = version + 1
        WHERE id = $1 AND village_unit_id = $2 AND decided_at IS NULL
        RETURNING id`,
      [objectionId, u.id, input.decision, input.decisionNote, user.userId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Keberatan tidak ditemukan atau sudah diputus.');
    }
    return { id: rows[0].id, decision: input.decision };
  }

  /** Ringkasan PPID untuk laporan tahunan. */
  async ringkasanPpid(schemaName: string, tahun: number) {
    const u = await this.unit.pastikanLayak(schemaName, 'TRANSPARANSI.PPID');
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE status = 'DIPENUHI')::int AS "fulfilled",
         count(*) FILTER (WHERE status = 'DIPENUHI_SEBAGIAN')::int AS "partial",
         count(*) FILTER (WHERE status = 'DITOLAK')::int AS "refused",
         count(*) FILTER (WHERE status IN ('DITERIMA','DIPROSES','DIPERPANJANG'))::int AS "pending",
         count(*) FILTER (WHERE extended)::int AS "extended",
         count(*) FILTER (WHERE answered_at IS NOT NULL AND answered_at > due_at)::int AS "answeredLate",
         (SELECT count(*)::int FROM "${schemaName}".village_information_objection o
           WHERE o.village_unit_id = $1
             AND EXTRACT(YEAR FROM o.filed_at) = $2) AS "objections"
         FROM "${schemaName}".village_information_request
        WHERE village_unit_id = $1 AND EXTRACT(YEAR FROM received_at) = $2`,
      [u.id, tahun],
    );
    return { year: tahun, ...rows[0] };
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
