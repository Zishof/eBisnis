/**
 * Katalog layanan, pemetaan unit, dan master data.
 *
 * Aturannya ada di `health-master-data.ts` sebagai fungsi murni.
 *
 * Yang menentukan bentuk layanan ini: **kekurangan pemetaan disimpan sebagai
 * baris, bukan sebagai angka** — pola yang sama seperti kekurangan berkas rekam
 * medis pada H-9, dan karena alasan yang sama. Pesan "pemetaan belum lengkap"
 * memaksa penggunanya menebak, dan yang menebak akan mengisi seadanya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  bolehAktifkanLayanan,
  bolehHapusDataContoh,
  bolehMengakuResmi,
  bolehPetakanKodeLokal,
  hargaContoh,
  periksaPemetaan,
  pilihDeterministik,
  type CareSetting,
  type JenisLayanan,
  type Layanan,
  type PemetaanLayanan,
  type PenerbitResmi,
  type SumberMasterData,
} from './health-master-data';

/**
 * Entitas yang dapat menahan penghapusan data contoh.
 *
 * Didaftarkan di satu tempat supaya penambahan rujukan baru kelak menjadi satu
 * baris di sini — bukan sebuah pemeriksaan yang terlupa di tempat lain.
 */
const PENAHAN_HAPUS: Array<{ table: string; column: string; label: string }> = [
  { table: 'health_encounter', column: 'facility_id', label: 'kunjungan' },
];

@Injectable()
export class HealthMasterDataService {
  private readonly logger = new Logger(HealthMasterDataService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Katalog layanan -------------------------------------------------------

  async buatLayanan(
    schema: string,
    input: {
      facilityId: string;
      code: string;
      name: string;
      serviceType: JenisLayanan;
      careSetting: CareSetting;
      description?: string | null;
      usesInventory?: boolean;
      hasFeeSharing?: boolean;
      source?: SumberMasterData;
      issuer?: PenerbitResmi | null;
      issuerReference?: string | null;
    },
    actorUserId: string,
  ) {
    const source = input.source ?? 'FACILITY_IMPORT';
    const izin = bolehMengakuResmi({
      source,
      issuer: input.issuer ?? null,
      issuerReference: input.issuerReference ?? null,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Sumber master data tidak sah.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_service
         (facility_id, code, name, service_type, care_setting, description,
          uses_inventory, has_fee_sharing, source, issuer, issuer_reference, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.code,
        input.name,
        input.serviceType,
        input.careSetting,
        input.description ?? null,
        input.usesInventory ?? false,
        input.hasFeeSharing ?? false,
        source,
        input.issuer ?? null,
        input.issuerReference ?? null,
        actorUserId,
      ],
    );

    return { id: rows[0].id, code: input.code, isActive: false };
  }

  /**
   * Menyimpan pemetaan dan memeriksa kelengkapannya.
   *
   * Kekurangan yang sudah tidak ada lagi ditutup, bukan dibiarkan menggantung —
   * daftar yang masih memuat hal yang sudah dikerjakan akan diabaikan
   * seluruhnya, termasuk yang belum.
   */
  async petakan(schema: string, serviceId: string, input: PemetaanLayanan) {
    const layanan = await this.ambilLayanan(schema, serviceId);

    return this.tenantDb.transaction(schema, async (client) => {
      const hasil = periksaPemetaan(layanan, input);

      const mapping = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".health_service_mapping
           (service_id, department_id, service_unit_id, location_id, performer_role,
            verifier_role, specimen_type, clinical_order_type, clinical_form_id,
            equipment_id, tariff_id, payer_coverage_id, fee_rule_id,
            revenue_account_id, cogs_account_id,
            missing_count, blocking_count, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
         ON CONFLICT (service_id) DO UPDATE SET
           department_id = EXCLUDED.department_id,
           service_unit_id = EXCLUDED.service_unit_id,
           location_id = EXCLUDED.location_id,
           performer_role = EXCLUDED.performer_role,
           verifier_role = EXCLUDED.verifier_role,
           specimen_type = EXCLUDED.specimen_type,
           clinical_order_type = EXCLUDED.clinical_order_type,
           clinical_form_id = EXCLUDED.clinical_form_id,
           equipment_id = EXCLUDED.equipment_id,
           tariff_id = EXCLUDED.tariff_id,
           payer_coverage_id = EXCLUDED.payer_coverage_id,
           fee_rule_id = EXCLUDED.fee_rule_id,
           revenue_account_id = EXCLUDED.revenue_account_id,
           cogs_account_id = EXCLUDED.cogs_account_id,
           missing_count = EXCLUDED.missing_count,
           blocking_count = EXCLUDED.blocking_count,
           checked_at = now(),
           updated_at = now(),
           version = "${schema}".health_service_mapping.version + 1
         RETURNING id::text AS id`,
        [
          serviceId,
          input.departmentId ?? null,
          input.serviceUnitId ?? null,
          input.locationId ?? null,
          input.performerRole ?? null,
          input.verifierRole ?? null,
          input.specimenTypeId ?? null,
          input.clinicalOrderType ?? null,
          input.clinicalFormId ?? null,
          input.equipmentId ?? null,
          input.tariffId ?? null,
          input.payerCoverageId ?? null,
          input.feeRuleId ?? null,
          input.revenueAccountId ?? null,
          input.cogsAccountId ?? null,
          hasil.missing.length,
          hasil.blockingCount,
        ],
      );
      const mappingId = mapping.rows[0].id;

      const slotSekarang = hasil.missing.map((m) => m.slot);
      await client.query(
        `UPDATE "${schema}".health_service_mapping_gap
            SET resolved_at = now()
          WHERE mapping_id = $1 AND resolved_at IS NULL
            AND NOT (slot = ANY($2::varchar[]))`,
        [mappingId, slotSekarang.length ? slotSekarang : ['__none__']],
      );

      for (const m of hasil.missing) {
        await client.query(
          // Tipe tiap parameter disebutkan: $1 dan $2 dipakai dua kali, dan
          // PostgreSQL menyimpulkan tipe yang berbeda pada kedua tempatnya.
          `INSERT INTO "${schema}".health_service_mapping_gap
             (mapping_id, slot, message, blocks_activation, awaiting_phase)
           SELECT $1::uuid, $2::varchar, $3::text, $4::boolean, $5::varchar
            WHERE NOT EXISTS (
              SELECT 1 FROM "${schema}".health_service_mapping_gap
               WHERE mapping_id = $1 AND slot = $2 AND resolved_at IS NULL
            )`,
          [mappingId, m.slot, m.message, m.blocksActivation, m.awaitingPhase ?? null],
        );
      }

      return {
        id: mappingId,
        serviceId,
        complete: hasil.complete,
        missing: hasil.missing,
        blockingCount: hasil.blockingCount,
      };
    });
  }

  /**
   * Mengaktifkan satu layanan.
   *
   * Ditolak bila pemetaannya belum lengkap. Basis data menolaknya pula lewat
   * trigger — layanan ini hanya memberi pesan yang dapat dikerjakan.
   */
  async aktifkan(schema: string, serviceId: string, actorUserId: string) {
    const layanan = await this.ambilLayanan(schema, serviceId);
    const pemetaan = await this.ambilPemetaan(schema, serviceId);
    if (!pemetaan) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Layanan ${layanan.code} belum dipetakan sama sekali. Layanan yang tidak terpetakan ` +
          'tidak sampai ke unit mana pun ketika dipesan.',
      );
    }

    const hasil = periksaPemetaan(layanan, pemetaan);
    const izin = bolehAktifkanLayanan({ kelengkapan: hasil });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Layanan belum dapat diaktifkan.',
        { missing: izin.missing, awaiting: izin.awaiting },
      );
    }

    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_service
          SET is_active = TRUE, activated_at = now(), activated_by = $2,
              deactivated_at = NULL, deactivate_reason = NULL,
              updated_at = now(), version = version + 1
        WHERE id = $1`,
      [serviceId, actorUserId],
    );

    this.logger.log(`Layanan ${layanan.code} diaktifkan.`);
    return { id: serviceId, code: layanan.code, isActive: true };
  }

  async nonaktifkan(schema: string, serviceId: string, reason: string) {
    if (reason.trim().length < 5) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penonaktifan layanan wajib menyebutkan alasannya.',
      );
    }
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".health_service
          SET is_active = FALSE, deactivated_at = now(), deactivate_reason = $2,
              updated_at = now(), version = version + 1
        WHERE id = $1 AND is_active = TRUE
        RETURNING id::text AS id`,
      [serviceId, reason],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Layanan tidak ditemukan atau memang sudah tidak aktif.',
      );
    }
    return { id: serviceId, isActive: false };
  }

  /** Katalog layanan beserta keadaan pemetaannya. */
  async daftarLayanan(schema: string, facilityId: string, activeOnly: boolean) {
    return this.tenantDb.query(
      schema,
      `SELECT s.id::text AS id, s.code, s.name, s.service_type, s.care_setting,
              s.uses_inventory, s.has_fee_sharing, s.source, s.issuer,
              s.is_active, s.activated_at::text AS activated_at,
              COALESCE(m.blocking_count, -1) AS blocking_count,
              COALESCE(m.missing_count, -1) AS missing_count
         FROM "${schema}".health_service s
         LEFT JOIN "${schema}".health_service_mapping m ON m.service_id = s.id
        WHERE s.facility_id = $1 AND s.deleted_at IS NULL
          AND ($2::boolean = FALSE OR s.is_active = TRUE)
        ORDER BY s.service_type, s.code
        LIMIT 500`,
      [facilityId, activeOnly],
    );
  }

  /**
   * Kekurangan pemetaan seluruh katalog, dikelompokkan menurut slotnya.
   *
   * Yang paling berguna bukan daftar layanan yang belum lengkap, melainkan
   * daftar SLOT yang paling sering kosong — sebab satu penyebab biasanya
   * menjelaskan puluhan layanan sekaligus.
   */
  async kekuranganKatalog(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT g.slot, g.awaiting_phase,
              bool_or(g.blocks_activation) AS blocks_activation,
              count(*)::int AS service_count,
              min(g.message) AS message
         FROM "${schema}".health_service_mapping_gap g
         JOIN "${schema}".health_service_mapping m ON m.id = g.mapping_id
         JOIN "${schema}".health_service s ON s.id = m.service_id
        WHERE s.facility_id = $1 AND s.deleted_at IS NULL AND g.resolved_at IS NULL
        GROUP BY g.slot, g.awaiting_phase
        ORDER BY bool_or(g.blocks_activation) DESC, count(*) DESC`,
      [facilityId],
    );
  }

  // --- Pemetaan kode lokal ---------------------------------------------------

  async petakanKode(
    schema: string,
    input: {
      localSystem: string;
      localCode: string;
      localDisplay?: string | null;
      targetSystem: string;
      targetCode: string;
      targetDisplay?: string | null;
      confidence?: string;
    },
    actorUserId: string,
  ) {
    const existing = await this.tenantDb.query<{
      target_system: string;
      target_code: string;
      retired_at: string | null;
    }>(
      schema,
      `SELECT target_system, target_code, retired_at::text AS retired_at
         FROM "${schema}".local_code_mapping
        WHERE local_system = $1 AND local_code = $2`,
      [input.localSystem, input.localCode],
    );

    const izin = bolehPetakanKodeLokal({
      localCode: input.localCode,
      targetSystem: input.targetSystem,
      targetCode: input.targetCode,
      existing: existing.map((e) => ({
        targetSystem: e.target_system,
        targetCode: e.target_code,
        retiredAt: e.retired_at,
      })),
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Pemetaan kode ditolak.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".local_code_mapping
         (local_system, local_code, local_display, target_system, target_code,
          target_display, confidence, mapped_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (local_system, local_code, target_system) WHERE retired_at IS NULL
       DO UPDATE SET target_display = EXCLUDED.target_display,
                     confidence = EXCLUDED.confidence,
                     mapped_by = EXCLUDED.mapped_by,
                     mapped_at = now(),
                     version = "${schema}".local_code_mapping.version + 1
       RETURNING id::text AS id`,
      [
        input.localSystem,
        input.localCode,
        input.localDisplay ?? null,
        input.targetSystem,
        input.targetCode,
        input.targetDisplay ?? null,
        input.confidence ?? 'EXACT',
        actorUserId,
      ],
    );
    return { id: rows[0].id };
  }

  /** Memensiunkan pemetaan, bukan menghapusnya. */
  async pensiunkanPemetaanKode(
    schema: string,
    mappingId: string,
    reason: string,
    actorUserId: string,
  ) {
    if (reason.trim().length < 5) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Pemensiunan pemetaan wajib menyebutkan alasannya — rekam lama yang dikirim memakai ' +
          'pemetaan ini harus tetap dapat dijelaskan.',
      );
    }
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".local_code_mapping
          SET retired_at = now(), retired_by = $2, retire_reason = $3,
              version = version + 1
        WHERE id = $1 AND retired_at IS NULL
        RETURNING id::text AS id`,
      [mappingId, actorUserId, reason],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Pemetaan tidak ditemukan atau sudah dipensiunkan.',
      );
    }
    return { id: mappingId, retired: true };
  }

  async daftarPemetaanKode(schema: string, targetSystem?: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, local_system, local_code, local_display,
              target_system, target_code, target_display, confidence,
              mapped_at::text AS mapped_at, retired_at::text AS retired_at
         FROM "${schema}".local_code_mapping
        WHERE ($1::text IS NULL OR target_system = $1)
        ORDER BY retired_at NULLS FIRST, local_system, local_code
        LIMIT 500`,
      [targetSystem ?? null],
    );
  }

  // --- Data contoh -----------------------------------------------------------

  /**
   * Menyemai katalog layanan contoh secara deterministik.
   *
   * Benih yang sama menghasilkan katalog yang sama, dan benihnya disimpan. Tanpa
   * itu, dua penyewa demo akan melihat isi yang berbeda dan salah satunya akan
   * melaporkan kerusakan yang tidak dapat ditirukan siapa pun.
   *
   * Seluruh barisnya bertanda `SYNTHETIC_DEMO`, dan tandanya tidak dapat
   * dilepas: constraint basis data menolak baris contoh yang menyebut penerbit
   * resmi.
   */
  async semaiLayananContoh(
    schema: string,
    input: { facilityId: string; count: number; seed: string; profile?: string },
    actorUserId: string,
  ) {
    if (input.count < 1 || input.count > 2000) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Jumlah layanan contoh harus antara 1 dan 2000.',
      );
    }

    const JENIS: Array<{ type: JenisLayanan; setting: CareSetting; nama: string[] }> = [
      { type: 'CONSULTATION', setting: 'OUTPATIENT', nama: ['Konsultasi Umum', 'Konsultasi Spesialis', 'Konsultasi Gizi'] },
      { type: 'LABORATORY', setting: 'LABORATORY', nama: ['Darah Lengkap', 'Kimia Darah', 'Urinalisis'] },
      { type: 'RADIOLOGY', setting: 'RADIOLOGY', nama: ['Rontgen Toraks', 'USG Abdomen', 'CT Kepala'] },
      { type: 'PROCEDURE', setting: 'OUTPATIENT', nama: ['Perawatan Luka', 'Nebulisasi', 'Pemasangan Kateter'] },
      { type: 'NURSING', setting: 'INPATIENT', nama: ['Asuhan Keperawatan Harian', 'Observasi Intensif'] },
    ];

    return this.tenantDb.transaction(schema, async (client) => {
      /*
       * Kode kumpulan menyertakan kode fasilitas.
       *
       * Benih yang sama memang HARUS dapat dipakai di beberapa fasilitas —
       * itulah gunanya deterministik. Tanpa kode fasilitas, penyemaian kedua
       * gagal seluruhnya dan yang menjalankannya akan menyimpulkan benihnya
       * yang rusak.
       */
      const fasilitas = await client.query<{ code: string }>(
        `SELECT code FROM "${schema}".health_facility WHERE id = $1`,
        [input.facilityId],
      );
      if (!fasilitas.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');
      }

      const kodeBatch = `SAMPLE-SERVICE-${fasilitas.rows[0].code}-${input.seed}`;
      const sudahAda = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM "${schema}".master_data_batch WHERE code = $1`,
        [kodeBatch],
      );
      if (sudahAda.rows.length) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Fasilitas ini sudah pernah disemai dengan benih ${input.seed}, dan hasilnya akan ` +
            'sama persis. Pakai benih lain bila memang menginginkan katalog yang berbeda, atau ' +
            'sembunyikan kumpulan yang lama lebih dahulu.',
          { batchId: sudahAda.rows[0].id, code: kodeBatch },
        );
      }

      const batch = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".master_data_batch
           (code, name, source, profile, seed, row_count, generated_by)
         VALUES ($1,$2,'SYNTHETIC_DEMO',$3,$4,$5,$6)
         RETURNING id::text AS id`,
        [
          kodeBatch,
          `Katalog layanan contoh (benih ${input.seed})`,
          input.profile ?? 'STANDARD',
          input.seed,
          input.count,
          actorUserId,
        ],
      );
      const batchId = batch.rows[0].id;

      let dibuat = 0;
      for (let i = 0; i < input.count; i += 1) {
        const golongan = pilihDeterministik(JENIS, input.seed, i);
        const nama = pilihDeterministik(golongan.nama, `${input.seed}-nama`, i);
        const harga = hargaContoh({ seed: input.seed, index: i, min: 25000, max: 1500000 });

        const hasil = await client.query(
          `INSERT INTO "${schema}".health_service
             (facility_id, code, name, service_type, care_setting, description,
              uses_inventory, has_fee_sharing, source, is_sample, sample_batch_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'SYNTHETIC_DEMO',TRUE,$9,$10)
           ON CONFLICT DO NOTHING`,
          [
            input.facilityId,
            `CONTOH-${String(i + 1).padStart(4, '0')}`,
            `${nama} ${i + 1}`,
            golongan.type,
            golongan.setting,
            `${harga.disclaimer} Perkiraan ${harga.amount}.`,
            golongan.type === 'LABORATORY',
            false,
            batchId,
            actorUserId,
          ],
        );
        dibuat += hasil.rowCount ?? 0;
      }

      await client.query(
        `UPDATE "${schema}".master_data_batch SET row_count = $2 WHERE id = $1`,
        [batchId, dibuat],
      );

      /*
       * Baris yang tidak jadi dibuat DISEBUTKAN, bukan didiamkan.
       *
       * Kodenya deterministik — CONTOH-0001 dan seterusnya — supaya katalog di
       * dua fasilitas dapat dibandingkan baris demi baris. Akibatnya, menyemai
       * dua kali pada fasilitas yang sama akan bertabrakan pada kodenya. Itu
       * memang benar, tetapi penyemaian yang berkata "berhasil" sambil membuat
       * nol baris adalah kebohongan yang akan dicari sebabnya berjam-jam.
       */
      const terlewat = input.count - dibuat;
      return {
        batchId,
        seed: input.seed,
        created: dibuat,
        skipped: terlewat,
        source: 'SYNTHETIC_DEMO',
        note:
          'Seluruh baris bertanda data contoh dan TIDAK boleh dipakai menagih pasien. ' +
          'Benih tersimpan; katalog yang sama dapat dibangun ulang persis.' +
          (terlewat > 0
            ? ` ${terlewat} baris dilewati karena kodenya sudah dipakai pada fasilitas ini — ` +
              'fasilitas ini agaknya sudah pernah disemai.'
            : ''),
      };
    });
  }

  /**
   * Menyembunyikan satu kumpulan data contoh.
   *
   * Menolak bila ada data nyata yang merujuknya, **menyebutkan apa yang
   * merujuknya**, dan menyerahkan keputusannya kepada manusia. Penghapusannya
   * pun hanya penyembunyian: data contoh yang benar-benar hilang tidak dapat
   * dijelaskan kepada siapa pun yang bertanya mengapa nomornya melompat.
   */
  async sembunyikanDataContoh(
    schema: string,
    batchId: string,
    reason: string,
    actorUserId: string,
  ) {
    if (reason.trim().length < 5) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penyembunyian data contoh wajib menyebutkan alasannya.',
      );
    }

    const references: Array<{ entity: string; count: number }> = [];
    for (const p of PENAHAN_HAPUS) {
      const rows = await this.tenantDb.query<{ n: string }>(
        schema,
        `SELECT count(*)::text AS n
           FROM "${schema}".${p.table} r
          WHERE r.${p.column} IN (
            SELECT s.facility_id FROM "${schema}".health_service s
             WHERE s.sample_batch_id = $1
          )
            AND r.is_sample = FALSE`,
        [batchId],
      );
      const n = Number(rows[0]?.n ?? 0);
      if (n > 0) references.push({ entity: p.label, count: n });
    }

    const izin = bolehHapusDataContoh({ batchId, references });
    if (!izin.allowed) {
      throw AppError.conflict(ErrorCodes.CONFLICT, izin.message ?? 'Tidak dapat disembunyikan.', {
        blockedBy: izin.blockedBy,
      });
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".master_data_batch
          SET hidden_at = now(), hidden_by = $2, hide_reason = $3, version = version + 1
        WHERE id = $1 AND hidden_at IS NULL
        RETURNING id::text AS id`,
      [batchId, actorUserId, reason],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Kumpulan tidak ditemukan atau sudah disembunyikan.',
      );
    }

    /*
     * Layanan contohnya dinonaktifkan, bukan dihapus. Menghapusnya akan
     * memutus rujukan mana pun yang terlanjur menunjuknya — dan yang menunjuk
     * belum tentu terdaftar pada PENAHAN_HAPUS hari ini.
     */
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".health_service
          SET is_active = FALSE, deactivated_at = now(),
              deactivate_reason = 'Kumpulan data contoh disembunyikan.',
              updated_at = now(), version = version + 1
        WHERE sample_batch_id = $1 AND is_active = TRUE`,
      [batchId],
    );

    return { id: batchId, hidden: true };
  }

  async daftarDataContoh(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id::text AS id, code, name, source, profile, seed, row_count,
              generated_at::text AS generated_at, hidden_at::text AS hidden_at
         FROM "${schema}".master_data_batch
        ORDER BY generated_at DESC
        LIMIT 200`,
    );
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilLayanan(schema: string, serviceId: string): Promise<Layanan> {
    const rows = await this.tenantDb.query<{
      code: string;
      name: string;
      service_type: string;
      care_setting: string;
      uses_inventory: boolean;
      has_fee_sharing: boolean;
    }>(
      schema,
      `SELECT code, name, service_type, care_setting, uses_inventory, has_fee_sharing
         FROM "${schema}".health_service WHERE id = $1 AND deleted_at IS NULL`,
      [serviceId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Layanan tidak ditemukan.');
    return {
      code: rows[0].code,
      name: rows[0].name,
      serviceType: rows[0].service_type as JenisLayanan,
      careSetting: rows[0].care_setting as CareSetting,
      usesInventory: rows[0].uses_inventory,
      hasFeeSharing: rows[0].has_fee_sharing,
    };
  }

  private async ambilPemetaan(
    schema: string,
    serviceId: string,
  ): Promise<PemetaanLayanan | null> {
    const rows = await this.tenantDb.query<Record<string, string | null>>(
      schema,
      `SELECT department_id::text, service_unit_id::text, location_id::text,
              performer_role, verifier_role, specimen_type, clinical_order_type,
              clinical_form_id::text, equipment_id::text, tariff_id::text,
              payer_coverage_id::text, fee_rule_id::text,
              revenue_account_id::text, cogs_account_id::text
         FROM "${schema}".health_service_mapping WHERE service_id = $1`,
      [serviceId],
    );
    if (!rows.length) return null;
    const r = rows[0];
    return {
      departmentId: r.department_id,
      serviceUnitId: r.service_unit_id,
      locationId: r.location_id,
      performerRole: r.performer_role,
      verifierRole: r.verifier_role,
      specimenTypeId: r.specimen_type,
      clinicalOrderType: r.clinical_order_type,
      clinicalFormId: r.clinical_form_id,
      equipmentId: r.equipment_id,
      tariffId: r.tariff_id,
      payerCoverageId: r.payer_coverage_id,
      feeRuleId: r.fee_rule_id,
      revenueAccountId: r.revenue_account_id,
      cogsAccountId: r.cogs_account_id,
    };
  }
}
