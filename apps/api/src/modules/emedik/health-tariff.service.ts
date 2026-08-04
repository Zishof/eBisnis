/**
 * Tarif berversi dan cakupan penjamin.
 *
 * Aturannya ada di `health-tariff.ts` sebagai fungsi murni.
 *
 * Yang menentukan bentuk layanan ini: **tarif yang tidak ada tidak pernah
 * ditaksir.** Setiap jalan yang menghitung tarif dapat mengembalikan "belum
 * tersedia", dan pemanggilnya harus menanganinya. Mengembalikan nol akan
 * menghasilkan tagihan nol yang tampak sah; mengembalikan taksiran akan
 * menghasilkan angka yang tampak resmi lalu dipakai menagih orang.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehAktifkanVersi,
  hitungTanggungan,
  periksaTumpangTindih,
  pilihTarif,
  type BarisTarif,
  type JenisPenjamin,
  type KelasFasilitas,
  type KelasLayanan,
  type KunciTarif,
  type MetodePembayaran,
} from './health-tariff';

@Injectable()
export class HealthTariffService {
  private readonly logger = new Logger(HealthTariffService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Peraturan -------------------------------------------------------------

  async catatPeraturan(
    schema: string,
    input: {
      reference: string;
      year: number;
      title: string;
      scope: 'FKTP' | 'FKRTL' | 'BOTH';
      effectiveFrom: string;
      revokesReference?: string | null;
      sourceFile?: string | null;
      sourceHash?: string | null;
    },
    actorUserId: string,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".jkn_regulation
         (reference, year, title, scope, effective_from, revokes_reference,
          source_file, source_hash, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id::text AS id`,
      [
        input.reference,
        input.year,
        input.title,
        input.scope,
        input.effectiveFrom,
        input.revokesReference ?? null,
        input.sourceFile ?? null,
        input.sourceHash ?? null,
        actorUserId,
      ],
    );
    return { id: rows[0].id, reference: input.reference };
  }

  async daftarPeraturan(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, reference, year, title, scope,
              effective_from::text AS effective_from, revoked_at::text AS revoked_at,
              revokes_reference, source_file, source_hash
         FROM "${schema}".jkn_regulation
        ORDER BY year DESC, reference
        LIMIT 300`,
    );
  }

  // --- Versi tarif -----------------------------------------------------------

  async buatVersi(
    schema: string,
    input: {
      code: string;
      name: string;
      regulationReference?: string | null;
      sourceFile?: string | null;
      sourceHash?: string | null;
    },
    actorUserId: string,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".jkn_tariff_version
         (code, name, regulation_reference, source_file, source_hash, imported_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id::text AS id`,
      [
        input.code,
        input.name,
        input.regulationReference ?? null,
        input.sourceFile ?? null,
        input.sourceHash ?? null,
        actorUserId,
      ],
    );
    return { id: rows[0].id, code: input.code, isActive: false };
  }

  /**
   * Mengimpor baris tarif ke satu versi.
   *
   * Menolak seluruhnya bila ada satu baris yang bertumpang tindih, bukan
   * mengimpor sebagiannya. Impor separuh menghasilkan versi yang tampak lengkap
   * dan sebenarnya bolong — dan yang bolong baru ketahuan ketika satu pasien
   * kebetulan jatuh pada baris yang hilang.
   */
  async imporBaris(
    schema: string,
    versionId: string,
    baris: Array<{
      paymentMethod: MetodePembayaran;
      regionCode: string;
      facilityClass: KelasFasilitas;
      serviceClass?: KelasLayanan | null;
      casemixGroup?: string | null;
      casemixSeverity?: string | null;
      amount: number;
      effectiveFrom: string;
      effectiveTo?: string | null;
    }>,
  ) {
    if (!baris.length) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tidak ada baris tarif untuk diimpor.',
      );
    }

    const versi = await this.ambilVersi(schema, versionId);
    if (versi.isActive) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Versi ini sudah aktif dan tidak dapat ditambahi baris. Klaim yang sudah dihitung ' +
          'memakainya harus tetap dapat dijelaskan — buat versi baru.',
      );
    }

    // Tumpang tindih di dalam kiriman itu sendiri diperiksa lebih dahulu.
    const terkumpul: BarisTarif[] = [];
    for (const [i, b] of baris.entries()) {
      const cek = periksaTumpangTindih({ baru: b, existing: terkumpul });
      if (!cek.allowed) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          `Baris ke-${i + 1}: ${cek.message}`,
          { row: i + 1 },
        );
      }
      terkumpul.push({ ...b, id: `sementara-${i}`, versionId });
    }

    return this.tenantDb.transaction(schema, async (client) => {
      let dibuat = 0;
      for (const b of baris) {
        await client.query(
          /*
           * `effectiveTo` yang diberikan pengguna adalah hari TERAKHIR yang
           * masih berlaku — batas tertutup. `daterange` memakai batas atas
           * terbuka, jadi ia ditambah satu hari.
           *
           * Tanpa penambahan itu, hari terakhir setiap masa berlaku tidak
           * tertutupi tarif mana pun. Hari terakhir justru hari yang paling
           * sering dipersoalkan: ia hari terakhir sebelum tarif baru berlaku,
           * dan pasien yang pulang hari itu akan menerima tagihan yang tidak
           * dapat dijelaskan siapa pun.
           */
          `INSERT INTO "${schema}".jkn_tariff
             (version_id, payment_method, region_code, facility_class, service_class,
              casemix_group, casemix_severity, amount, effective_range)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
                   daterange($9::date, ($10::date + 1), '[)'))`,
          [
            versionId,
            b.paymentMethod,
            b.regionCode,
            b.facilityClass,
            b.serviceClass ?? null,
            b.casemixGroup ?? null,
            b.casemixSeverity ?? null,
            b.amount,
            b.effectiveFrom,
            b.effectiveTo ?? null,
          ],
        );
        dibuat += 1;
      }

      await client.query(
        `UPDATE "${schema}".jkn_tariff_version
            SET row_count = (SELECT count(*) FROM "${schema}".jkn_tariff WHERE version_id = $1),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [versionId],
      );

      return { versionId, imported: dibuat };
    });
  }

  /** Menyetujui dan mengaktifkan satu versi tarif. */
  async aktifkanVersi(schema: string, versionId: string, note: string, approverId: string) {
    const versi = await this.ambilVersi(schema, versionId);

    const izin = bolehAktifkanVersi({
      versi: {
        id: versionId,
        code: versi.code,
        regulationReference: versi.regulationReference,
        sourceFile: versi.sourceFile,
        sourceHash: versi.sourceHash,
        importedBy: versi.importedBy,
        approvedBy: null,
        rowCount: versi.rowCount,
      },
      approverId,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Versi tarif belum dapat diaktifkan.',
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".jkn_tariff_version
          SET is_active = TRUE, approved_by = $2, approved_at = now(), approval_note = $3,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [versionId, approverId, note],
    );

    this.logger.warn(
      `Versi tarif ${versi.code} diaktifkan; ${versi.rowCount} baris kini menentukan tagihan.`,
    );
    return { id: versionId, code: versi.code, isActive: true, rowCount: versi.rowCount };
  }

  async daftarVersi(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, code, name, regulation_reference, source_file, source_hash,
              row_count, is_active, imported_at::text AS imported_at,
              approved_at::text AS approved_at, retired_at::text AS retired_at
         FROM "${schema}".jkn_tariff_version
        ORDER BY imported_at DESC
        LIMIT 200`,
    );
  }

  // --- Pemilihan tarif -------------------------------------------------------

  /**
   * Mencari tarif yang berlaku bagi satu kunci.
   *
   * Hanya versi yang **aktif** yang dibaca. Versi yang belum disetujui tidak
   * boleh menentukan tagihan siapa pun.
   */
  async cariTarif(schema: string, kunci: KunciTarif) {
    const rows = await this.tenantDb.query<{
      id: string;
      payment_method: string;
      region_code: string;
      facility_class: string;
      service_class: string | null;
      casemix_group: string | null;
      casemix_severity: string | null;
      amount: string;
      effective_from: string;
      effective_to: string | null;
      version_id: string;
      regulation_reference: string | null;
    }>(
      schema,
      `SELECT t.id::text AS id, t.payment_method, t.region_code, t.facility_class,
              t.service_class, t.casemix_group, t.casemix_severity,
              t.amount::text AS amount,
              lower(t.effective_range)::text AS effective_from,
              upper(t.effective_range)::text AS effective_to,
              t.version_id::text AS version_id,
              v.regulation_reference
         FROM "${schema}".jkn_tariff t
         JOIN "${schema}".jkn_tariff_version v ON v.id = t.version_id
        WHERE v.is_active = TRUE AND v.retired_at IS NULL
          AND t.payment_method = $1 AND t.region_code = $2 AND t.facility_class = $3`,
      [kunci.paymentMethod, kunci.regionCode, kunci.facilityClass],
    );

    /*
     * Batas atas daterange TERBUKA: [mulai, selesai). Dikurangi satu hari saat
     * dibandingkan, supaya aturan murni yang memakai batas tertutup tetap
     * memberi jawaban yang sama. Tanpa penyesuaian ini, hari terakhir masa
     * berlaku akan tertolak — dan hari terakhir adalah hari yang paling sering
     * dipersoalkan.
     */
    const daftar: BarisTarif[] = rows.map((r) => ({
      id: r.id,
      paymentMethod: r.payment_method as MetodePembayaran,
      regionCode: r.region_code,
      facilityClass: r.facility_class as KelasFasilitas,
      serviceClass: r.service_class,
      casemixGroup: r.casemix_group,
      casemixSeverity: r.casemix_severity,
      amount: Number(r.amount),
      effectiveFrom: r.effective_from,
      effectiveTo: r.effective_to ? mundurSehari(r.effective_to) : null,
      versionId: r.version_id,
      regulationReference: r.regulation_reference,
    }));

    const hasil = pilihTarif(daftar, kunci);
    return {
      ...hasil,
      candidateCount: daftar.length,
    };
  }

  // --- Penjamin --------------------------------------------------------------

  async catatPenjamin(
    schema: string,
    input: {
      facilityId: string;
      payerType: JenisPenjamin;
      payerName: string;
      contractReference?: string | null;
      coveragePercent?: number;
      ceilingAmount?: number | null;
      deductibleAmount?: number | null;
      requiresReferral?: boolean;
      requiresPreAuthorization?: boolean;
      effectiveFrom?: string;
    },
    actorUserId: string,
  ) {
    if (input.payerType !== 'SELF_PAY' && !input.contractReference?.trim()) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penjamin selain pasien sendiri wajib menyebut kontraknya. Tanggungan tanpa kontrak ' +
          'yang tercatat tidak dapat ditagihkan kepada siapa pun.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_payer_coverage
         (facility_id, payer_type, payer_name, contract_reference, coverage_percent,
          ceiling_amount, deductible_amount, requires_referral,
          requires_pre_authorization, effective_from, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::date, CURRENT_DATE),$11)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.payerType,
        input.payerName,
        input.contractReference ?? null,
        input.coveragePercent ?? 100,
        input.ceilingAmount ?? null,
        input.deductibleAmount ?? null,
        input.requiresReferral ?? false,
        input.requiresPreAuthorization ?? false,
        input.effectiveFrom ?? null,
        actorUserId,
      ],
    );
    return { id: rows[0].id, payerName: input.payerName };
  }

  async daftarPenjamin(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, payer_type, payer_name, contract_reference,
              coverage_percent::float8 AS coverage_percent,
              ceiling_amount::float8 AS ceiling_amount,
              deductible_amount::float8 AS deductible_amount,
              requires_referral, requires_pre_authorization,
              effective_from::text AS effective_from, is_active
         FROM "${schema}".health_payer_coverage
        WHERE facility_id = $1
        ORDER BY is_active DESC, payer_type, payer_name
        LIMIT 300`,
      [facilityId],
    );
  }

  /**
   * Menghitung tanggungan penjamin dan pasien.
   *
   * Bila tarifnya belum tersedia, perhitungan berhenti di sana — tidak
   * dilanjutkan dengan nilai nol.
   */
  async hitungBagian(
    schema: string,
    input: { coverageId: string; totalAmount: number; hasValidReferral?: boolean; hasPreAuthorization?: boolean },
  ) {
    const rows = await this.tenantDb.query<{
      payer_type: JenisPenjamin;
      coverage_percent: string;
      ceiling_amount: string | null;
      deductible_amount: string | null;
      requires_referral: boolean;
      requires_pre_authorization: boolean;
      is_active: boolean;
    }>(
      schema,
      `SELECT payer_type, coverage_percent::text, ceiling_amount::text,
              deductible_amount::text, requires_referral, requires_pre_authorization, is_active
         FROM "${schema}".health_payer_coverage WHERE id = $1`,
      [input.coverageId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penjamin tidak ditemukan.');
    if (!rows[0].is_active) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Cakupan penjamin ini sudah tidak berlaku.',
      );
    }

    return hitungTanggungan({
      totalAmount: input.totalAmount,
      coverage: {
        payerType: rows[0].payer_type,
        coveragePercent: Number(rows[0].coverage_percent),
        ceilingAmount: rows[0].ceiling_amount === null ? null : Number(rows[0].ceiling_amount),
        deductibleAmount:
          rows[0].deductible_amount === null ? null : Number(rows[0].deductible_amount),
        requiresReferral: rows[0].requires_referral,
        requiresPreAuthorization: rows[0].requires_pre_authorization,
      },
      hasValidReferral: input.hasValidReferral,
      hasPreAuthorization: input.hasPreAuthorization,
    });
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilVersi(schema: string, versionId: string) {
    const rows = await this.tenantDb.query<{
      code: string;
      regulation_reference: string | null;
      source_file: string | null;
      source_hash: string | null;
      imported_by: string | null;
      row_count: number;
      is_active: boolean;
    }>(
      schema,
      `SELECT code, regulation_reference, source_file, source_hash,
              imported_by::text AS imported_by, row_count, is_active
         FROM "${schema}".jkn_tariff_version WHERE id = $1`,
      [versionId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Versi tarif tidak ditemukan.');
    }
    return {
      code: rows[0].code,
      regulationReference: rows[0].regulation_reference,
      sourceFile: rows[0].source_file,
      sourceHash: rows[0].source_hash,
      importedBy: rows[0].imported_by,
      rowCount: rows[0].row_count,
      isActive: rows[0].is_active,
    };
  }
}

/** Mundur satu hari, untuk mengubah batas terbuka menjadi batas tertutup. */
function mundurSehari(tanggal: string): string {
  const t = new Date(`${tanggal}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}
