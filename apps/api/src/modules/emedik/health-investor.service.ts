/**
 * Dasbor investor agregat, waterfall, dan distribusi.
 *
 * Aturannya ada di `health-investor.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak pernah membaca satu baris pun dari tabel pasien.**
 *
 * Yang dibacanya adalah `investor_projection` dan `investor_projection_cell` —
 * tabel yang tidak berkolom pasien sama sekali. Perhitungan agregatnya
 * dilakukan jalan tersendiri (`hitungProyeksi`) yang membaca sumbernya,
 * menyamarkan yang kohortnya kecil, lalu **membuang sumbernya**; jalan yang
 * dipanggil investor tidak menyentuh sumber itu.
 *
 * Perbedaannya bukan kerapian: penyaring dapat dilewati siapa pun yang
 * memanggil jalur di bawahnya, sedangkan tabel yang tidak berkolom tidak dapat.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  AMBANG_KOHORT_BAWAAN,
  MEDAN_INVESTOR,
  bagianInvestor,
  bolehBayarDistribusi,
  bolehLihatProyeksi,
  bolehTampilkanTotal,
  hitungWaterfall,
  periksaAmbang,
  periksaMedanTerlarang,
  ringkasPenyamaran,
  samarkan,
  type LapisanWaterfall,
  type SelAgregat,
  type StatusDistribusi,
} from './health-investor';

@Injectable()
export class HealthInvestorService {
  private readonly logger = new Logger(HealthInvestorService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Kebijakan penyamaran --------------------------------------------------

  async bacaKebijakan(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{
      id: string;
      minimum_cohort: number;
      complement_suppression: boolean;
    }>(
      schema,
      `SELECT id, minimum_cohort, complement_suppression
         FROM "${schema}".investor_disclosure_policy WHERE facility_id = $1`,
      [facilityId],
    );
    const p = baris[0];
    return {
      facilityId,
      minimumCohort: p ? Number(p.minimum_cohort) : AMBANG_KOHORT_BAWAAN,
      complementSuppression: p ? p.complement_suppression : true,
      seeded: Boolean(p),
      note:
        'Ambang kohort tidak boleh nol. "Satu pasien HIV pada bulan Maret di Poliklinik Kulit" ' +
        'adalah kalimat agregat yang menyebut seseorang.',
    };
  }

  async ubahKebijakan(
    schema: string,
    facilityId: string,
    input: { minimumCohort: number; complementSuppression?: boolean },
    actorUserId: string,
  ) {
    const izin = periksaAmbang(input.minimumCohort);
    if (!izin.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".investor_disclosure_policy
         (facility_id, minimum_cohort, complement_suppression, updated_by)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (facility_id) DO UPDATE
         SET minimum_cohort = EXCLUDED.minimum_cohort,
             complement_suppression = EXCLUDED.complement_suppression,
             updated_by = EXCLUDED.updated_by,
             updated_at = now(),
             version = "${schema}".investor_disclosure_policy.version + 1
       RETURNING id`,
      [facilityId, input.minimumCohort, input.complementSuppression ?? true, actorUserId],
    );
    return { id: baris[0].id, minimumCohort: input.minimumCohort };
  }

  // --- Perhitungan proyeksi --------------------------------------------------

  /**
   * Menghitung proyeksi agregat untuk satu periode.
   *
   * **Jalan ini membaca sumbernya; jalan yang dipanggil investor tidak.**
   * Sumbernya dibaca di sini, disamarkan di sini, dan tidak pernah keluar dari
   * sini — yang tersimpan hanyalah angka gabungan yang sudah lolos ambang.
   */
  async hitungProyeksi(
    schema: string,
    input: {
      facilityId: string;
      periodStart: string;
      periodEnd: string;
      synthetic?: boolean;
    },
    actorUserId: string,
  ) {
    const kebijakan = await this.bacaKebijakan(schema, input.facilityId);
    const ambang = kebijakan.minimumCohort;

    return this.tenantDb.transaction(schema, async (client) => {
      const hasil: {
        metricCode: string;
        totalValue: number | null;
        totalCohort: number | null;
        suppressed: number;
        visible: number;
      }[] = [];

      for (const metrik of ['encounterCount', 'grossRevenue', 'payerMix'] as const) {
        const sel = await this.kumpulkanSel(client, schema, metrik, input);
        const tersamar = samarkan(sel, ambang);
        const ringkas = ringkasPenyamaran(tersamar);

        const kohortTotal = sel.reduce((s, x) => s + x.kohort, 0);
        const nilaiTotal = sel.reduce((s, x) => s + (x.nilai ?? 0), 0);
        const totalBoleh = bolehTampilkanTotal(kohortTotal, ambang);

        const proj = await client.query<{ id: string }>(
          `INSERT INTO "${schema}".investor_projection
             (facility_id, period_start, period_end, metric_code,
              total_value, total_cohort, total_suppressed,
              minimum_cohort_applied, suppressed_cell_count, visible_cell_count,
              is_synthetic, computed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           ON CONFLICT (facility_id, period_start, period_end, metric_code) DO UPDATE
             SET total_value = EXCLUDED.total_value,
                 total_cohort = EXCLUDED.total_cohort,
                 total_suppressed = EXCLUDED.total_suppressed,
                 minimum_cohort_applied = EXCLUDED.minimum_cohort_applied,
                 suppressed_cell_count = EXCLUDED.suppressed_cell_count,
                 visible_cell_count = EXCLUDED.visible_cell_count,
                 computed_at = now(), computed_by = EXCLUDED.computed_by
           RETURNING id`,
          [
            input.facilityId,
            input.periodStart,
            input.periodEnd,
            metrik,
            totalBoleh ? nilaiTotal : null,
            totalBoleh ? kohortTotal : null,
            !totalBoleh,
            ambang,
            ringkas.tersamar,
            ringkas.ditampilkan,
            input.synthetic === true,
            actorUserId,
          ],
        );

        await client.query(
          `DELETE FROM "${schema}".investor_projection_cell WHERE projection_id = $1`,
          [proj.rows[0].id],
        );
        for (const s of tersamar) {
          await client.query(
            `INSERT INTO "${schema}".investor_projection_cell
               (projection_id, breakdown_key, cell_value, cell_cohort, suppressed, suppression_reason)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [proj.rows[0].id, s.kunci, s.nilai, s.kohort, s.tersamar, s.alasan],
          );
        }

        hasil.push({
          metricCode: metrik,
          totalValue: totalBoleh ? nilaiTotal : null,
          totalCohort: totalBoleh ? kohortTotal : null,
          suppressed: ringkas.tersamar,
          visible: ringkas.ditampilkan,
        });
      }

      return {
        facilityId: input.facilityId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        minimumCohortApplied: ambang,
        metrics: hasil,
        note:
          'Sumbernya dibaca di sini, disamarkan di sini, dan tidak pernah keluar dari sini. ' +
          'Yang tersimpan hanyalah angka gabungan yang sudah lolos ambang.',
      };
    });
  }

  /**
   * Mengumpulkan sel agregat dari tabel sumber.
   *
   * **Private, dan sengaja.** Ia satu-satunya tempat pada modul ini yang
   * membaca tabel klinis, dan tidak ada satu pun jalan HTTP yang sampai
   * kepadanya tanpa melewati penyamaran.
   */
  private async kumpulkanSel(
    client: PoolClient,
    schema: string,
    metrik: string,
    input: { facilityId: string; periodStart: string; periodEnd: string },
  ): Promise<SelAgregat[]> {
    if (metrik === 'payerMix') {
      /*
       * Bauran pembayar dibaca lewat KLAIMnya, bukan lewat kunjungannya.
       *
       * `health_encounter` tidak menyimpan penjamin — dan itu benar: penjamin
       * satu kunjungan baru tertentu ketika klaimnya disusun, sebab pasien
       * dapat datang sebagai peserta JKN lalu ditagihkan sebagai umum karena
       * rujukannya tidak lengkap. Membacanya dari kunjungan akan melaporkan
       * bauran yang direncanakan, bukan yang terjadi.
       */
      const r = await client.query<{ kunci: string; kohort: string; nilai: string }>(
        `SELECT COALESCE(pc.payer_name, 'Tanpa Penjamin') AS kunci,
                count(DISTINCT c.patient_id)::text AS kohort,
                count(*)::text AS nilai
           FROM "${schema}".health_claim c
           LEFT JOIN "${schema}".health_payer_coverage pc ON pc.id = c.payer_coverage_id
          WHERE c.facility_id = $1 AND c.created_at::date BETWEEN $2::date AND $3::date
          GROUP BY 1`,
        [input.facilityId, input.periodStart, input.periodEnd],
      );
      return r.rows.map((x) => ({
        kunci: x.kunci,
        kohort: Number(x.kohort),
        nilai: Number(x.nilai),
      }));
    }

    if (metrik === 'grossRevenue') {
      const r = await client.query<{ kunci: string; kohort: string; nilai: string }>(
        `SELECT COALESCE(u.name, 'Tanpa Unit') AS kunci,
                count(DISTINCT e.patient_id)::text AS kohort,
                COALESCE(sum(c.submitted_amount), 0)::text AS nilai
           FROM "${schema}".health_encounter e
           LEFT JOIN "${schema}".health_service_unit u ON u.id = e.service_unit_id
           LEFT JOIN "${schema}".health_claim c ON c.encounter_id = e.id
          WHERE e.facility_id = $1 AND e.started_at::date BETWEEN $2::date AND $3::date
          GROUP BY 1`,
        [input.facilityId, input.periodStart, input.periodEnd],
      );
      return r.rows.map((x) => ({
        kunci: x.kunci,
        kohort: Number(x.kohort),
        nilai: Number(x.nilai),
      }));
    }

    const r = await client.query<{ kunci: string; kohort: string; nilai: string }>(
      `SELECT COALESCE(u.name, 'Tanpa Unit') AS kunci,
              count(DISTINCT e.patient_id)::text AS kohort,
              count(*)::text AS nilai
         FROM "${schema}".health_encounter e
         LEFT JOIN "${schema}".health_service_unit u ON u.id = e.service_unit_id
        WHERE e.facility_id = $1 AND e.started_at::date BETWEEN $2::date AND $3::date
        GROUP BY 1`,
      [input.facilityId, input.periodStart, input.periodEnd],
    );
    return r.rows.map((x) => ({
      kunci: x.kunci,
      kohort: Number(x.kohort),
      nilai: Number(x.nilai),
    }));
  }

  /**
   * Membaca proyeksi — jalan yang dipanggil investor.
   *
   * Perhatikan kuerinya: ia menyentuh `investor_projection` dan
   * `investor_projection_cell` saja. Tidak ada `JOIN` ke tabel pasien, dan
   * tidak mungkin ada — tabelnya tidak punya kolom yang dapat dipakai
   * menyambungnya.
   */
  async bacaProyeksi(
    schema: string,
    input: {
      facilityId: string;
      periodStart: string;
      periodEnd: string;
      akunContoh?: boolean;
    },
  ) {
    const proyeksi = await this.tenantDb.query<{
      id: string;
      metric_code: string;
      total_value: string | null;
      total_cohort: number | null;
      total_suppressed: boolean;
      minimum_cohort_applied: number;
      suppressed_cell_count: number;
      visible_cell_count: number;
      is_synthetic: boolean;
    }>(
      schema,
      `SELECT id, metric_code, total_value, total_cohort, total_suppressed,
              minimum_cohort_applied, suppressed_cell_count, visible_cell_count, is_synthetic
         FROM "${schema}".investor_projection
        WHERE facility_id = $1 AND period_start = $2::date AND period_end = $3::date
        ORDER BY metric_code`,
      [input.facilityId, input.periodStart, input.periodEnd],
    );

    if (proyeksi.length === 0) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Belum ada proyeksi untuk periode ini. Proyeksi dihitung tersendiri oleh analis — ' +
          'dasbor tidak menghitungnya sendiri saat dibuka.',
      );
    }

    for (const p of proyeksi) {
      const izin = bolehLihatProyeksi({
        akunContoh: input.akunContoh === true,
        proyeksiSintetis: p.is_synthetic,
      });
      if (!izin.boleh) {
        throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.alasan);
      }
    }

    const metrics = [];
    for (const p of proyeksi) {
      const sel = await this.tenantDb.query<{
        breakdown_key: string;
        cell_value: string | null;
        cell_cohort: number | null;
        suppressed: boolean;
        suppression_reason: string | null;
      }>(
        schema,
        `SELECT breakdown_key, cell_value, cell_cohort, suppressed, suppression_reason
           FROM "${schema}".investor_projection_cell
          WHERE projection_id = $1 ORDER BY breakdown_key`,
        [p.id],
      );

      metrics.push({
        metricCode: p.metric_code,
        totalValue: p.total_suppressed ? null : p.total_value ? Number(p.total_value) : null,
        totalCohort: p.total_suppressed ? null : p.total_cohort,
        totalSuppressed: p.total_suppressed,
        minimumCohortApplied: p.minimum_cohort_applied,
        breakdown: sel.map((s) => ({
          key: s.breakdown_key,
          value: s.suppressed ? null : s.cell_value ? Number(s.cell_value) : null,
          cohort: s.suppressed ? null : s.cell_cohort,
          suppressed: s.suppressed,
          suppressionReason: s.suppression_reason,
          // Sebabnya ditampilkan, tidak disembunyikan.
          note: s.suppressed
            ? 'Disembunyikan karena kohortnya terlalu kecil. Angkanya BUKAN nol.'
            : null,
        })),
        suppressedCells: p.suppressed_cell_count,
        visibleCells: p.visible_cell_count,
        isSynthetic: p.is_synthetic,
      });
    }

    const hasil = {
      facilityId: input.facilityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      metrics,
      allowedFields: MEDAN_INVESTOR,
      note:
        'Yang disembunyikan disebutkan sebabnya. Dasbor yang menyembunyikan tanpa mengatakan ' +
        'bahwa ia menyembunyikan akan dipercaya sebagai gambaran lengkap, dan kesimpulan yang ' +
        'ditarik darinya keliru dengan cara yang tidak disadari siapa pun.',
    };

    /*
     * PEMERIKSAAN TERAKHIR SEBELUM DIKIRIM.
     *
     * Berlebihan menurut kuerinya — tabelnya memang tidak berkolom pasien.
     * Justru karena itu ia murah, dan ia menangkap hal yang tidak dapat
     * ditangkap kuerinya: medan yang ditambahkan seseorang kelak pada jalan
     * ini, dengan niat baik, tanpa membaca migrasinya.
     */
    const bersih = periksaMedanTerlarang(hasil as unknown as Record<string, unknown>);
    if (!bersih.bersih) {
      this.logger.error(`Proyeksi investor memuat medan pasien: ${bersih.ditemukan.join(', ')}`);
      throw AppError.internal(ErrorCodes.INTERNAL_ERROR, bersih.pesan);
    }

    return hasil;
  }

  // --- Waterfall -------------------------------------------------------------

  async simpanWaterfall(
    schema: string,
    input: {
      facilityId: string;
      feeContractId: string;
      name: string;
      effectiveFrom?: string | null;
      effectiveTo?: string | null;
      tiers: { order: number; type: LapisanWaterfall; amount?: number | null; percent?: number | null }[];
    },
    actorUserId: string,
  ) {
    if (input.tiers.length === 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Waterfall tanpa lapisan tidak membagi apa pun.',
      );
    }
    for (const t of input.tiers) {
      const punyaJumlah = t.amount != null;
      const punyaPersen = t.percent != null;
      if (punyaJumlah === punyaPersen) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          `Lapisan ${t.order} harus berupa jumlah ATAU persentase, tidak keduanya dan tidak ` +
            'satu pun. Lapisan yang keduanya kosong tidak pernah menerima apa pun, dan tidak ' +
            'ada yang menyadarinya sampai distribusinya dihitung.',
        );
      }
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const kontrak = await client.query<{ contract_type: string; status: string }>(
        `SELECT contract_type, status FROM "${schema}".fee_contract WHERE id = $1`,
        [input.feeContractId],
      );
      if (kontrak.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kontrak tidak ditemukan.');
      }
      if (kontrak.rows[0].contract_type !== 'INVESTOR_SHARE') {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Waterfall investor hanya dapat menunjuk kontrak bertipe INVESTOR_SHARE. Kontrak fee ' +
            'sistem dan bagian investor adalah dua hal yang berbeda, dan menyatukannya membuat ' +
            'salah satu di antaranya dibayarkan menurut aturan yang bukan miliknya.',
        );
      }

      const p = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".investor_waterfall_policy
           (facility_id, fee_contract_id, name, effective_from, effective_to, status, created_by)
         VALUES ($1,$2,$3,$4,$5,'DRAFT',$6) RETURNING id`,
        [
          input.facilityId,
          input.feeContractId,
          input.name,
          input.effectiveFrom ?? null,
          input.effectiveTo ?? null,
          actorUserId,
        ],
      );
      for (const t of input.tiers) {
        await client.query(
          `INSERT INTO "${schema}".investor_waterfall_tier
             (policy_id, tier_order, tier_type, fixed_amount, percent_of_remaining)
           VALUES ($1,$2,$3,$4,$5)`,
          [p.rows[0].id, t.order, t.type, t.amount ?? null, t.percent ?? null],
        );
      }
      return { id: p.rows[0].id, status: 'DRAFT', tiers: input.tiers.length };
    });
  }

  async aktifkanWaterfall(schema: string, policyId: string, actorUserId: string) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".investor_waterfall_policy
          SET status = 'ACTIVE', updated_at = now(), version = version + 1
        WHERE id = $1 AND status = 'DRAFT'
        RETURNING id`,
      [policyId],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Waterfall tidak ditemukan atau bukan lagi DRAFT.',
      );
    }
    this.logger.log(`Waterfall ${policyId} diaktifkan oleh ${actorUserId}`);
    return { id: policyId, status: 'ACTIVE' };
  }

  /** Simulasi waterfall. Tidak menyimpan apa pun. */
  async simulasikan(schema: string, policyId: string, dana: number) {
    const lapisan = await this.tenantDb.query<{
      tier_order: number;
      tier_type: LapisanWaterfall;
      fixed_amount: string | null;
      percent_of_remaining: string | null;
    }>(
      schema,
      `SELECT tier_order, tier_type, fixed_amount, percent_of_remaining
         FROM "${schema}".investor_waterfall_tier
        WHERE policy_id = $1 ORDER BY tier_order`,
      [policyId],
    );
    if (lapisan.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Waterfall tidak ditemukan atau tanpa lapisan.');
    }
    const hasil = hitungWaterfall(
      dana,
      lapisan.map((l) => ({
        jenis: l.tier_type,
        urutan: l.tier_order,
        jumlah: l.fixed_amount != null ? Number(l.fixed_amount) : null,
        persen: l.percent_of_remaining != null ? Number(l.percent_of_remaining) : null,
      })),
    );
    return {
      policyId,
      distributable: dana,
      ...hasil,
      simulationOnly: true,
      note: 'Simulasi tidak menyimpan apa pun dan tidak memindahkan uang.',
    };
  }

  // --- Distribusi ------------------------------------------------------------

  async hitungDistribusi(
    schema: string,
    input: {
      facilityId: string;
      feeContractId: string;
      policyId?: string | null;
      periodStart: string;
      periodEnd: string;
      distributableAmount: number;
      requestedPercent?: number | null;
    },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const kontrak = await client.query<{
        contract_type: string;
        status: string;
        maximum_percent: string | null;
      }>(
        `SELECT contract_type, status, maximum_percent FROM "${schema}".fee_contract
          WHERE id = $1 AND facility_id = $2`,
        [input.feeContractId, input.facilityId],
      );
      if (kontrak.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kontrak tidak ditemukan pada fasilitas ini.');
      }

      const aktif = kontrak.rows[0].status === 'ACTIVE';
      const bagian = bagianInvestor({
        adaKontrakAktif: aktif,
        persenKontrak: input.requestedPercent ?? null,
        batasMaksimum:
          kontrak.rows[0].maximum_percent != null ? Number(kontrak.rows[0].maximum_percent) : null,
      });

      const jumlah = Math.round(((input.distributableAmount * bagian.persen) / 100) * 100) / 100;

      const nomor = await this.nomorDistribusi(client, schema, input.facilityId);
      const baris = await client.query<{ id: string; distribution_number: string }>(
        `INSERT INTO "${schema}".investor_distribution
           (facility_id, fee_contract_id, policy_id, distribution_number,
            period_start, period_end, distributable_amount, investor_amount,
            investor_percent, was_capped, status, calculated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'CALCULATED',$11)
         RETURNING id, distribution_number`,
        [
          input.facilityId,
          input.feeContractId,
          input.policyId ?? null,
          nomor,
          input.periodStart,
          input.periodEnd,
          input.distributableAmount,
          jumlah,
          bagian.persen,
          bagian.dibatasi,
          actorUserId,
        ],
      );

      return {
        id: baris.rows[0].id,
        distributionNumber: baris.rows[0].distribution_number,
        distributableAmount: input.distributableAmount,
        investorAmount: jumlah,
        investorPercent: bagian.persen,
        wasCapped: bagian.dibatasi,
        contractActive: aktif,
        reason: bagian.alasan,
        status: 'CALCULATED',
        note:
          'Perhitungan TIDAK memindahkan uang. Setiap distribusi menuntut persetujuan manusia, ' +
          'dan yang menghitung tidak menyetujui.',
      };
    });
  }

  async setujuiDistribusi(
    schema: string,
    distributionId: string,
    input: { note: string },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const d = await client.query<{
        status: StatusDistribusi;
        calculated_by: string | null;
        fee_contract_id: string;
      }>(
        `SELECT status, calculated_by, fee_contract_id FROM "${schema}".investor_distribution
          WHERE id = $1 FOR UPDATE`,
        [distributionId],
      );
      if (d.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Distribusi tidak ditemukan.');
      }
      if (d.rows[0].status !== 'CALCULATED' && d.rows[0].status !== 'PENDING_APPROVAL') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Distribusi berstatus ${d.rows[0].status}; hanya yang belum disetujui dapat disetujui.`,
        );
      }
      if (d.rows[0].calculated_by && d.rows[0].calculated_by === actorUserId) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Yang menghitung distribusi tidak menyetujuinya sendiri. Persetujuan oleh ' +
            'penghitungnya hanya membaca ulang angkanya sendiri — dan angka yang keliru masih ' +
            'tampak benar baginya, sebab ia yang membuatnya.',
        );
      }

      await client.query(
        `UPDATE "${schema}".investor_distribution
            SET status = 'APPROVED', approved_by = $2, approved_at = now(),
                approval_note = $3, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [distributionId, actorUserId, input.note],
      );
      return { id: distributionId, status: 'APPROVED' };
    });
  }

  async bayarDistribusi(
    schema: string,
    distributionId: string,
    input: { paymentReference: string },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const d = await client.query<{
        status: StatusDistribusi;
        calculated_by: string | null;
        approved_by: string | null;
        fee_contract_id: string;
      }>(
        `SELECT status, calculated_by, approved_by, fee_contract_id
           FROM "${schema}".investor_distribution WHERE id = $1 FOR UPDATE`,
        [distributionId],
      );
      if (d.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Distribusi tidak ditemukan.');
      }
      const kontrak = await client.query<{ status: string }>(
        `SELECT status FROM "${schema}".fee_contract WHERE id = $1`,
        [d.rows[0].fee_contract_id],
      );

      const izin = bolehBayarDistribusi({
        status: d.rows[0].status,
        dihitungOleh: d.rows[0].calculated_by,
        disetujuiOleh: d.rows[0].approved_by,
        dibayarOleh: actorUserId,
        adaKontrakAktif: kontrak.rows[0]?.status === 'ACTIVE',
      });
      if (!izin.boleh) {
        const status403 =
          izin.alasan.includes('tidak menyetujuinya sendiri') ||
          izin.alasan.includes('tidak membayarkannya sendiri');
        if (status403) throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.alasan);
        throw AppError.unprocessable(ErrorCodes.INVALID_STATE_TRANSITION, izin.alasan);
      }

      await client.query(
        `UPDATE "${schema}".investor_distribution
            SET status = 'PAID', paid_by = $2, paid_at = now(),
                payment_reference = $3, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [distributionId, actorUserId, input.paymentReference],
      );
      this.logger.log(`Distribusi ${distributionId} dibayarkan oleh ${actorUserId}`);
      return {
        id: distributionId,
        status: 'PAID',
        note:
          'Nilainya tidak dapat diubah lagi. Yang sudah berpindah adalah angka itu; mengubahnya ' +
          'kemudian membuat catatan di sini berbeda dari mutasi rekening.',
      };
    });
  }

  async daftarDistribusi(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT d.id, d.distribution_number, d.period_start::text AS period_start,
              d.period_end::text AS period_end, d.distributable_amount, d.investor_amount,
              d.investor_percent, d.was_capped, d.status,
              d.calculated_by IS NOT NULL AS has_calculator,
              d.approved_by IS NOT NULL AS has_approver,
              d.paid_by IS NOT NULL AS has_payer,
              c.counterparty_name, c.status AS contract_status
         FROM "${schema}".investor_distribution d
         JOIN "${schema}".fee_contract c ON c.id = d.fee_contract_id
        WHERE d.facility_id = $1
        ORDER BY d.period_start DESC, d.created_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  // --- Pembantu --------------------------------------------------------------

  private async nomorDistribusi(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fasilitas = await client.query<{ code: string }>(
      `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
      [facilityId],
    );
    const kode = fasilitas.rows[0]?.code ?? 'XX';
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".investor_distribution
        WHERE facility_id = $1 AND created_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `DIS-${kode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}
