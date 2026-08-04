/**
 * Kebijakan pembagian jasa dan kontributor.
 *
 * Aturannya ada di `health-fee.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak menetapkan satu pun persentase.** Ia menyimpan kebijakan
 * yang disusun fasilitas, memeriksa bentuknya, dan membagi menurutnya. Angka
 * yang dipakai selalu datang dari data — dan setiap perhitungan mencatat versi
 * kebijakan mana yang dipakainya, supaya pertanyaan "mengapa jasa saya bulan
 * lalu segini" dapat dijawab dengan aturan bulan lalu.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bagiJasa,
  bagiKepadaKontributor,
  bolehAktifkanFeeBerkontrak,
  bolehJadikanFinal,
  bolehPakaiDiProduksi,
  bolehSetujuiKebijakan,
  periksaKebijakan,
  saringKontributor,
  type BarisKebijakan,
  type CaraBagi,
  type DasarPerhitungan,
  type Kontributor,
  type PenerimaJasa,
} from './health-fee';

@Injectable()
export class HealthFeeService {
  private readonly logger = new Logger(HealthFeeService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Kebijakan -------------------------------------------------------------

  async buatKebijakan(
    schema: string,
    input: {
      facilityId: string;
      code: string;
      name: string;
      description?: string | null;
      basis?: DasarPerhitungan;
      serviceId?: string | null;
      serviceType?: string | null;
      payerType?: string | null;
      effectiveFrom?: string | null;
      isSampleData?: boolean;
      lines: BarisKebijakan[];
    },
    actorUserId: string,
  ) {
    const bentuk = periksaKebijakan({
      basis: input.basis ?? 'PAID_CLAIM',
      lines: input.lines,
    });
    if (!bentuk.valid) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        bentuk.problems.join(' '),
        { problems: bentuk.problems },
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".fee_policy
           (facility_id, code, name, description, basis, service_id, service_type,
            payer_type, effective_from, is_sample_data, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,COALESCE($9::date, CURRENT_DATE),$10,$11)
         RETURNING id::text AS id`,
        [
          input.facilityId,
          input.code,
          input.name,
          input.description ?? null,
          input.basis ?? 'PAID_CLAIM',
          input.serviceId ?? null,
          input.serviceType ?? null,
          input.payerType ?? null,
          input.effectiveFrom ?? null,
          input.isSampleData ?? false,
          actorUserId,
        ],
      );
      const policyId = rows.rows[0].id;

      for (const [i, l] of input.lines.entries()) {
        await client.query(
          `INSERT INTO "${schema}".fee_policy_line
             (policy_id, recipient, method, value, provider_id, contributor_role, note, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            policyId,
            l.recipient,
            l.method,
            l.value,
            l.providerId ?? null,
            l.contributorRole ?? null,
            l.note ?? null,
            i,
          ],
        );
      }

      return {
        id: policyId,
        code: input.code,
        active: false,
        lineCount: input.lines.length,
        note:
          'Kebijakan dibuat dalam keadaan TIDAK aktif. Ia baru berlaku setelah disetujui orang ' +
          'lain — persentase pembagian jasa adalah kesepakatan dua pihak.',
      };
    });
  }

  /**
   * Menyetujui dan mengaktifkan kebijakan.
   *
   * Dua penjagaan, dan yang kedua diperiksa **pada tingkat baris**: penyetuju
   * yang tertaut pada pemberi layanan yang tersebut di dalam kebijakannya
   * ditolak, sekalipun hak aksesnya lengkap. Hak akses menjaga siapa yang boleh
   * membuka pintu; pemeriksaan ini menjaga siapa yang boleh melewatinya kali
   * ini.
   */
  async setujuiKebijakan(
    schema: string,
    policyId: string,
    note: string,
    approverId: string,
  ) {
    const kebijakan = await this.ambilKebijakan(schema, policyId);
    if (kebijakan.active) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Kebijakan ini sudah aktif.',
      );
    }

    const produksi = bolehPakaiDiProduksi({
      isSampleData: kebijakan.isSampleData,
      productionApproved: kebijakan.productionApproved,
    });
    if (!produksi.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        produksi.message ?? 'Kebijakan contoh belum dapat dipakai.',
      );
    }

    // Pemberi layanan yang tertaut pada akun penyetuju, bila ada.
    const penyetujuProvider = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT p.id::text AS id
         FROM "${schema}".health_provider p
        WHERE p.user_subject_id = $1 AND p.deleted_at IS NULL
        LIMIT 1`,
      [approverId],
    );

    const izin = bolehSetujuiKebijakan({
      createdBy: kebijakan.createdBy,
      approverId,
      approverProviderId: penyetujuProvider[0]?.id ?? null,
      lines: kebijakan.lines,
    });
    if (!izin.allowed) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.message ?? 'Persetujuan ditolak.');
    }

    // Fee berkontrak tidak dapat aktif tanpa syaratnya; H-9G memeriksanya penuh.
    for (const l of kebijakan.lines) {
      const gerbang = bolehAktifkanFeeBerkontrak({
        recipient: l.recipient,
        syarat: {
          hasContract: false,
          hasLegalReview: false,
          hasManagementApproval: false,
          hasTaxTreatment: false,
        },
      });
      if (!gerbang.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          gerbang.message ?? 'Fee berkontrak belum dapat diaktifkan.',
          { recipient: l.recipient, missing: gerbang.missing },
        );
      }
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".fee_policy
          SET active = TRUE, approved_by = $2, approved_at = now(), approval_note = $3,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [policyId, approverId, note],
    );

    this.logger.log(`Kebijakan jasa ${kebijakan.code} diaktifkan.`);
    return { id: policyId, code: kebijakan.code, active: true };
  }

  async daftarKebijakan(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT p.id::text AS id, p.code, p.name, p.basis, p.effective_from::text AS effective_from,
              p.effective_to::text AS effective_to, p.active, p.is_sample_data,
              p.production_approved, p.approved_at::text AS approved_at,
              count(l.id)::int AS line_count,
              COALESCE(sum(l.value) FILTER (WHERE l.method = 'PERCENTAGE'), 0)::float8
                AS total_percent
         FROM "${schema}".fee_policy p
         LEFT JOIN "${schema}".fee_policy_line l ON l.policy_id = p.id
        WHERE p.facility_id = $1
        GROUP BY p.id
        ORDER BY p.active DESC, p.effective_from DESC
        LIMIT 300`,
      [facilityId],
    );
  }

  async bacaKebijakan(schema: string, policyId: string) {
    const kebijakan = await this.ambilKebijakan(schema, policyId);
    return {
      id: policyId,
      ...kebijakan,
      note:
        'Persentase pada kebijakan ini datang dari kesepakatan fasilitas, bukan dari bawaan ' +
        'sistem. Tidak ada satu pun angka pembagian jasa yang ditanam di dalam kode.',
    };
  }

  // --- Kontributor -----------------------------------------------------------

  async catatKontributor(
    schema: string,
    input: {
      facilityId: string;
      encounterId?: string | null;
      admissionId?: string | null;
      otCaseId?: string | null;
      providerId: string;
      contributorRole: string;
      attendanceEvidence?: string | null;
      percentage?: number | null;
      point?: number | null;
      fixedAmount?: number | null;
      durationMinutes?: number | null;
      complexityWeight?: number | null;
      clinicalResponsibility?: string | null;
    },
    actorUserId: string,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".fee_contributor
         (facility_id, encounter_id, admission_id, ot_case_id, provider_id, contributor_role,
          attendance_evidence, percentage, point, fixed_amount, duration_minutes,
          complexity_weight, clinical_responsibility, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.encounterId ?? null,
        input.admissionId ?? null,
        input.otCaseId ?? null,
        input.providerId,
        input.contributorRole,
        input.attendanceEvidence ?? null,
        input.percentage ?? null,
        input.point ?? null,
        input.fixedAmount ?? null,
        input.durationMinutes ?? null,
        input.complexityWeight ?? null,
        input.clinicalResponsibility ?? null,
        actorUserId,
      ],
    );

    return {
      id: rows[0].id,
      hasEvidence: Boolean(input.attendanceEvidence?.trim()),
      note: input.attendanceEvidence?.trim()
        ? null
        : 'Kontributor ini belum memiliki bukti kehadiran, dan tidak akan ikut dibayar sampai ' +
          'buktinya ada. Sumbernya sudah ada dari H-7: daftar periksa bedah, hitungan kasa, ' +
          'atau penugasan operasi.',
    };
  }

  async daftarKontributor(schema: string, otCaseId: string) {
    const rows = await this.tenantDb.query<{
      id: string;
      provider_id: string;
      provider_name: string;
      contributor_role: string;
      attendance_evidence: string | null;
      percentage: string | null;
      point: string | null;
      duration_minutes: number | null;
      complexity_weight: string | null;
    }>(
      schema,
      `SELECT c.id::text AS id, c.provider_id::text AS provider_id, p.full_name AS provider_name,
              c.contributor_role, c.attendance_evidence,
              c.percentage::text, c.point::text, c.duration_minutes,
              c.complexity_weight::text
         FROM "${schema}".fee_contributor c
         JOIN "${schema}".health_provider p ON p.id = c.provider_id
        WHERE c.ot_case_id = $1
        ORDER BY c.contributor_role, p.full_name`,
      [otCaseId],
    );

    const kontributor: Kontributor[] = rows.map((r) => ({
      providerId: r.provider_id,
      contributorRole: r.contributor_role,
      attendanceEvidence: r.attendance_evidence,
      percentage: r.percentage === null ? null : Number(r.percentage),
      point: r.point === null ? null : Number(r.point),
      durationMinutes: r.duration_minutes,
      complexityWeight: r.complexity_weight === null ? null : Number(r.complexity_weight),
    }));

    const saring = saringKontributor(kontributor);
    const nama = new Map(rows.map((r) => [r.provider_id, r.provider_name]));

    return {
      eligible: saring.eligible.map((k) => ({ ...k, providerName: nama.get(k.providerId) })),
      rejected: saring.rejected.map((r) => ({
        ...r,
        contributor: { ...r.contributor, providerName: nama.get(r.contributor.providerId) },
      })),
      note:
        'Yang tersaring dikembalikan, bukan dihapus diam-diam. Menghapus diam-diam akan ' +
        'menghasilkan pertanyaan "mengapa jasa saya tidak ada" yang tidak dapat dijawab siapa pun.',
    };
  }

  // --- Perhitungan -----------------------------------------------------------

  /**
   * Menghitung pembagian jasa menurut satu kebijakan.
   *
   * Menolak memakai dasar taksiran untuk perhitungan final pada penjamin yang
   * membayar lewat klaim. Simulasi diizinkan — dan perbedaan itu satu-satunya
   * yang mencegah rumah sakit membayarkan uang yang tidak pernah diterimanya.
   */
  async hitung(
    schema: string,
    input: {
      policyId: string;
      basisAmount: number;
      payerPaysByClaim?: boolean;
      isSimulation?: boolean;
      otCaseId?: string | null;
    },
  ) {
    const kebijakan = await this.ambilKebijakan(schema, input.policyId);

    if (!kebijakan.active && !input.isSimulation) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Kebijakan ini belum aktif. Perhitungan final hanya memakai kebijakan yang sudah ' +
          'disetujui; untuk mencobanya, jalankan sebagai simulasi.',
      );
    }

    const dasar = bolehJadikanFinal({
      basis: kebijakan.basis,
      payerPaysByClaim: input.payerPaysByClaim ?? false,
      isSimulation: input.isSimulation ?? false,
    });
    if (!dasar.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        dasar.message ?? 'Dasar perhitungan tidak boleh dipakai untuk perhitungan final.',
      );
    }

    let kontributor: Kontributor[] = [];
    if (input.otCaseId) {
      const daftar = await this.daftarKontributor(schema, input.otCaseId);
      kontributor = daftar.eligible;
    }

    const hasil = bagiJasa({
      basisAmount: input.basisAmount,
      lines: kebijakan.lines,
      contributors: kontributor,
    });

    return {
      policyId: input.policyId,
      policyCode: kebijakan.code,
      basis: kebijakan.basis,
      isSimulation: input.isSimulation ?? false,
      contributorCount: kontributor.length,
      ...hasil,
      /*
       * Versi kebijakan DISALIN ke hasilnya. Pertanyaan "mengapa jasa saya bulan
       * lalu segini" dijawab dengan aturan bulan lalu, bukan dengan aturan hari
       * ini.
       */
      policyVersion: kebijakan.version,
    };
  }

  /** Membagi satu kumpulan jasa kepada kontributor satu tindakan. */
  async bagiKumpulan(
    schema: string,
    input: { otCaseId: string; poolAmount: number; method: CaraBagi },
  ) {
    const daftar = await this.daftarKontributor(schema, input.otCaseId);
    const hasil = bagiKepadaKontributor({
      poolAmount: input.poolAmount,
      contributors: daftar.eligible,
      method: input.method,
    });

    const nama = new Map(daftar.eligible.map((k) => [k.providerId, k.providerName]));
    return {
      otCaseId: input.otCaseId,
      shares: hasil.shares.map((s) => ({ ...s, providerName: nama.get(s.providerId) })),
      excluded: daftar.rejected.length,
      message: hasil.message,
    };
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilKebijakan(schema: string, policyId: string) {
    const kepala = await this.tenantDb.query<{
      code: string;
      name: string;
      basis: DasarPerhitungan;
      created_by: string | null;
      active: boolean;
      is_sample_data: boolean;
      production_approved: boolean;
      version: number;
    }>(
      schema,
      `SELECT code, name, basis, created_by::text AS created_by, active,
              is_sample_data, production_approved, version
         FROM "${schema}".fee_policy WHERE id = $1`,
      [policyId],
    );
    if (!kepala.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kebijakan jasa tidak ditemukan.');
    }

    const baris = await this.tenantDb.query<{
      recipient: PenerimaJasa;
      method: CaraBagi;
      value: string;
      provider_id: string | null;
      contributor_role: string | null;
      note: string | null;
    }>(
      schema,
      `SELECT recipient, method, value::text, provider_id::text AS provider_id,
              contributor_role, note
         FROM "${schema}".fee_policy_line WHERE policy_id = $1 ORDER BY sort_order`,
      [policyId],
    );

    return {
      code: kepala[0].code,
      name: kepala[0].name,
      basis: kepala[0].basis,
      createdBy: kepala[0].created_by,
      active: kepala[0].active,
      isSampleData: kepala[0].is_sample_data,
      productionApproved: kepala[0].production_approved,
      version: kepala[0].version,
      lines: baris.map((b) => ({
        recipient: b.recipient,
        method: b.method,
        value: Number(b.value),
        providerId: b.provider_id,
        contributorRole: b.contributor_role,
        note: b.note,
      })) as BarisKebijakan[],
    };
  }
}
