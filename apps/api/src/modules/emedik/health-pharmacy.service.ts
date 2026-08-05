/**
 * Farmasi: resep, telaah apoteker, penyerahan, dan pemberian obat.
 *
 * Aturan keselamatannya tidak ada di sini — ia ada di `health-medication.ts`
 * sebagai fungsi murni yang dapat diuji tanpa basis data. Berkas ini yang
 * mengambil data, memanggil aturan itu, lalu menuliskan hasilnya.
 *
 * Pemisahan itu penting untuk hal yang sangat konkret: aturan enam benar dan
 * pemeriksaan alergi harus dapat diuji dalam hitungan milidetik dan dalam
 * puluhan kombinasi. Aturan yang hanya dapat diuji lewat basis data akan diuji
 * tiga kali, bukan enam puluh.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, INVENTORY_PORT, type AuditPort, type InventoryPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  bolehLewati,
  bolehSerahkan,
  periksaEnamBenar,
  periksaResep,
  type AlergiPasien,
  type Interaksi,
  type Obat,
} from './health-medication';

@Injectable()
export class HealthPharmacyService {
  private readonly logger = new Logger(HealthPharmacyService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
    @Inject(INVENTORY_PORT) private readonly inventory: InventoryPort,
  ) {}

  // --- Peresepan -------------------------------------------------------------

  /**
   * Memeriksa satu calon baris resep tanpa menyimpannya.
   *
   * Dipanggil layar peresepan saat dokter memilih obat, supaya peringatannya
   * muncul **sebelum** resepnya jadi. Peringatan yang baru muncul setelah
   * disimpan akan dibaca sebagai gangguan, bukan sebagai bantuan.
   */
  async periksaCalonResep(
    schema: string,
    input: {
      patientId: string;
      drugId: string;
      doseValue: number;
      doseUnit: string;
      frequencyPerDay?: number | null;
      prescriptionId?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const obat = await this.ambilObat(schema, input.drugId);
    const alergi = await this.ambilAlergi(schema, input.patientId);
    const zatDipakai = await this.zatSedangDipakai(schema, input.patientId, input.prescriptionId ?? null);
    const zatDiResep = input.prescriptionId
      ? await this.zatPadaResep(schema, input.prescriptionId, null)
      : [];
    const katalog = await this.ambilInteraksi(schema, [obat.activeIngredient, ...zatDipakai, ...zatDiResep]);

    const hasil = periksaResep({
      obat,
      alergiPasien: alergi,
      zatLainDipakai: zatDipakai,
      zatLainDiResep: zatDiResep,
      katalogInteraksi: katalog,
      dosis: { value: input.doseValue, unit: input.doseUnit, perDay: input.frequencyPerDay ?? undefined },
    });

    /*
     * Pemeriksaan ini membaca alergi dan riwayat obat pasien, dan itu data rekam
     * medis. Ia dicatat sebagai akses seperti pembacaan lainnya — pembacaan
     * yang tidak berujung pada penyimpanan tetap pembacaan.
     */
    await this.audit.recordAccess(schema, {
      patientId: input.patientId,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'rx_drug_master',
      entityId: input.drugId,
    });

    return hasil;
  }

  /** Membuat resep beserta barisnya. */
  async buatResep(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      encounterId?: string | null;
      providerId?: string | null;
      note?: string | null;
      lines: Array<{
        drugId: string;
        doseValue: number;
        doseUnit: string;
        route: string;
        frequencyCode: string;
        frequencyPerDay?: number | null;
        durationDays?: number | null;
        quantity: number;
        quantityUnit?: string | null;
        instruction?: string | null;
        isPrn?: boolean;
        /** Alasan meneruskan meski ada peringatan. Wajib bila ada yang memblokir. */
        overrideReason?: string | null;
      }>;
    },
    ctx: KonteksAkses,
  ) {
    if (!input.lines?.length) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, 'Resep tanpa obat tidak dapat disimpan.');
    }

    const fasilitas = await this.tenantDb.query<{ code: string }>(
      schema,
      `SELECT code FROM "${schema}".health_facility WHERE id = $1 AND deleted_at IS NULL`,
      [input.facilityId],
    );
    if (!fasilitas.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Fasilitas tidak ditemukan.');

    const alergi = await this.ambilAlergi(schema, input.patientId);
    const zatDipakai = await this.zatSedangDipakai(schema, input.patientId, null);

    // Seluruh obat pada resep ini, supaya terapi ganda antarbaris terlihat.
    const obatPerBaris: Obat[] = [];
    for (const l of input.lines) obatPerBaris.push(await this.ambilObat(schema, l.drugId));

    const katalog = await this.ambilInteraksi(schema, [
      ...obatPerBaris.map((o) => o.activeIngredient),
      ...zatDipakai,
    ]);

    const peringatanPerBaris = input.lines.map((l, i) => {
      const lain = obatPerBaris.filter((_, j) => j !== i).map((o) => o.activeIngredient);
      return periksaResep({
        obat: obatPerBaris[i],
        alergiPasien: alergi,
        zatLainDipakai: zatDipakai,
        zatLainDiResep: lain,
        katalogInteraksi: katalog,
        dosis: { value: l.doseValue, unit: l.doseUnit, perDay: l.frequencyPerDay ?? undefined },
      });
    });

    /*
     * Peringatan pemblokir boleh dilewati, tetapi hanya dengan alasan tertulis.
     * Menolak seluruhnya akan membuat dokter mencari jalan lain — meresepkan di
     * kertas, di luar sistem, tanpa jejak sama sekali. Yang dicapai bukan
     * keselamatan, melainkan kebutaan.
     */
    peringatanPerBaris.forEach((h, i) => {
      if (h.blocked && !input.lines[i].overrideReason?.trim()) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          `Baris ${i + 1} (${obatPerBaris[i].genericName}) memicu peringatan yang menahan ` +
            'peresepan. Tuliskan alasan bila tetap diteruskan.',
          { line: i + 1, alerts: h.alerts },
        );
      }
    });

    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorResep(client, schema, input.facilityId, fasilitas[0].code);

      const resep = await client.query<{ id: string; prescription_number: string }>(
        `INSERT INTO "${schema}".rx_prescription
           (encounter_id, patient_id, facility_id, prescription_number,
            prescribed_by_provider_id, prescribed_by, status, note)
         VALUES ($1,$2,$3,$4,$5,$6,'PRESCRIBED',$7)
         RETURNING id::text AS id, prescription_number`,
        [
          input.encounterId ?? null,
          input.patientId,
          input.facilityId,
          nomor,
          input.providerId ?? null,
          ctx.actorUserId,
          input.note ?? null,
        ],
      );

      for (const [i, l] of input.lines.entries()) {
        const h = peringatanPerBaris[i];
        await client.query(
          `INSERT INTO "${schema}".rx_prescription_line
             (prescription_id, drug_id, line_no, dose_value, dose_unit, route,
              frequency_code, frequency_per_day, duration_days, quantity, quantity_unit,
              instruction, is_prn, override_alerts)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            resep.rows[0].id,
            l.drugId,
            i + 1,
            l.doseValue,
            l.doseUnit,
            l.route,
            l.frequencyCode,
            l.frequencyPerDay ?? null,
            l.durationDays ?? null,
            l.quantity,
            l.quantityUnit ?? null,
            l.instruction ?? null,
            l.isPrn ?? false,
            // Yang dilewati disimpan bersama alasannya. Bila kelak ada kejadian
            // tidak diharapkan, pertanyaannya "apakah sistem memperingatkan?"
            // harus terjawab dari catatan, bukan disimpulkan.
            h.alerts.length
              ? JSON.stringify({ alerts: h.alerts, overrideReason: l.overrideReason ?? null })
              : null,
          ],
        );
      }

      await this.audit.recordAccess(schema, {
        patientId: input.patientId,
        facilityId: input.facilityId,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'rx_prescription',
        entityId: resep.rows[0].id,
      });

      return {
        id: resep.rows[0].id,
        prescriptionNumber: resep.rows[0].prescription_number,
        alerts: peringatanPerBaris.map((h, i) => ({ line: i + 1, ...h })),
      };
    });
  }

  // --- Telaah apoteker -------------------------------------------------------

  /**
   * Telaah apoteker.
   *
   * Penolakannya membutuhkan alasan; persetujuannya tidak. Bukan karena
   * persetujuan kurang penting, melainkan karena menuntut catatan pada langkah
   * yang dijalankan ratusan kali sehari akan menghasilkan ratusan catatan
   * bertuliskan "ok" — dan catatan semacam itu justru mengubur yang bermakna.
   */
  async telaah(
    schema: string,
    prescriptionId: string,
    input: { approve: boolean; note?: string | null },
    ctx: KonteksAkses,
  ) {
    if (!input.approve && !input.note?.trim()) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penolakan telaah harus menyebutkan alasannya agar dokter dapat menindaklanjuti.',
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      const resep = await client.query<{
        status: string;
        patient_id: string;
        facility_id: string;
        prescribed_by: string | null;
      }>(
        `SELECT status, patient_id::text AS patient_id, facility_id::text AS facility_id,
                prescribed_by::text AS prescribed_by
           FROM "${schema}".rx_prescription WHERE id = $1 FOR UPDATE`,
        [prescriptionId],
      );
      if (!resep.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Resep tidak ditemukan.');

      if (!['PRESCRIBED', 'UNDER_REVIEW'].includes(resep.rows[0].status)) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Telaah memerlukan resep berstatus PRESCRIBED, saat ini ${resep.rows[0].status}.`,
        );
      }

      /*
       * Pemisahan wewenang. Basis data menegakkannya pula lewat
       * `rx_prescription_review_not_self`; diperiksa di sini supaya pesannya
       * dapat dibaca manusia, bukan berupa galat constraint.
       */
      if (resep.rows[0].prescribed_by && resep.rows[0].prescribed_by === ctx.actorUserId) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Resep tidak dapat ditelaah oleh penulisnya sendiri. Pemeriksaan oleh orang ' +
            'kedua adalah inti dari telaah ini.',
        );
      }

      await client.query(
        `UPDATE "${schema}".rx_prescription
            SET status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [prescriptionId, input.approve ? 'REVIEWED' : 'REJECTED', ctx.actorUserId, input.note ?? null],
      );

      await this.audit.recordAccess(schema, {
        patientId: resep.rows[0].patient_id,
        facilityId: resep.rows[0].facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'rx_prescription',
        entityId: prescriptionId,
      });

      return { id: prescriptionId, status: input.approve ? 'REVIEWED' : 'REJECTED' };
    });
  }

  // --- Penyerahan ------------------------------------------------------------

  /**
   * Menyerahkan obat kepada pasien dan mengurangi stok lewat adapter.
   *
   * Idempoten terhadap `idempotencyKey`. Penyerahan yang terulang karena jaringan
   * terputus tidak mengurangi stok dua kali dan tidak menambah jumlah yang
   * tercatat diserahkan.
   */
  async serahkan(
    schema: string,
    input: {
      prescriptionLineId: string;
      quantity: number;
      warehouseId: string;
      lotId?: string | null;
      dispensedDrugId?: string | null;
      substitutionReason?: string | null;
      doubleCheckedBy?: string | null;
      unitCost?: number;
      idempotencyKey: string;
    },
    ctx: KonteksAkses,
  ) {
    if (!input.idempotencyKey?.trim()) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Penyerahan obat memerlukan kunci idempotensi agar tidak tercatat dua kali.',
      );
    }

    const sudah = await this.tenantDb.query<{ id: string }>(
      schema,
      `SELECT id::text AS id FROM "${schema}".rx_dispensing WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (sudah.length) {
      this.logger.debug(`Penyerahan ${input.idempotencyKey} sudah tercatat; dikembalikan apa adanya.`);
      return { id: sudah[0].id, replayed: true };
    }

    const baris = await this.tenantDb.query<{
      prescription_id: string;
      drug_id: string;
      quantity: string;
      dispensed_qty: string;
      patient_id: string;
      facility_id: string;
      status: string;
      reviewed_at: string | null;
      prescribed_by: string | null;
    }>(
      schema,
      `SELECT l.prescription_id::text AS prescription_id, l.drug_id::text AS drug_id,
              l.quantity::text AS quantity, l.dispensed_qty::text AS dispensed_qty,
              p.patient_id::text AS patient_id, p.facility_id::text AS facility_id,
              p.status, p.reviewed_at::text AS reviewed_at, p.prescribed_by::text AS prescribed_by
         FROM "${schema}".rx_prescription_line l
         JOIN "${schema}".rx_prescription p ON p.id = l.prescription_id
        WHERE l.id = $1`,
      [input.prescriptionLineId],
    );
    if (!baris.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris resep tidak ditemukan.');
    const b = baris[0];

    const drugId = input.dispensedDrugId ?? b.drug_id;
    const obat = await this.ambilObat(schema, drugId);
    const lot = await this.lotTerpilih(schema, input.warehouseId, obat.productId, input.lotId ?? null);

    const putusan = bolehSerahkan({
      obat,
      expiryDate: lot?.expiryDate ?? null,
      today: new Date().toISOString().slice(0, 10),
      quantityRequested: input.quantity,
      quantityRemaining: Number(b.quantity) - Number(b.dispensed_qty),
      prescriptionStatus: b.status,
      reviewed: Boolean(b.reviewed_at),
    });
    if (!putusan.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, putusan.message ?? 'Penyerahan ditolak.');
    }

    if (putusan.requiresDoubleCheck && !input.doubleCheckedBy) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `${obat.genericName} menuntut pemeriksaan oleh orang kedua sebelum diserahkan.`,
      );
    }
    if (input.doubleCheckedBy && input.doubleCheckedBy === ctx.actorUserId) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Pemeriksaan ganda oleh orang yang sama bukan pemeriksaan ganda.',
      );
    }

    // Stok dikurangi lewat adapter, bukan dari sini. Itu satu-satunya jalan.
    const gerak = await this.inventory.issue(
      schema,
      {
        warehouseId: input.warehouseId,
        itemId: obat.productId,
        quantity: input.quantity,
        lotId: input.lotId ?? null,
        unitCost: input.unitCost ?? 0,
        referenceType: 'rx_dispensing',
        referenceId: b.prescription_id,
        idempotencyKey: input.idempotencyKey,
      },
      ctx.actorUserId,
    );

    return this.tenantDb.transaction(schema, async (client) => {
      const dispensing = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".rx_dispensing
           (prescription_id, prescription_line_id, patient_id, drug_id, dispensed_drug_id,
            substitution_reason, quantity, batch_no, expiry_date, warehouse_id,
            dispensed_by, double_checked_by, double_checked_at, idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
                 CASE WHEN $12::uuid IS NULL THEN NULL ELSE now() END, $13)
         RETURNING id::text AS id`,
        [
          b.prescription_id,
          input.prescriptionLineId,
          b.patient_id,
          b.drug_id,
          input.dispensedDrugId ?? null,
          input.substitutionReason ?? null,
          input.quantity,
          lot?.lotNumber ?? null,
          lot?.expiryDate ?? null,
          input.warehouseId,
          ctx.actorUserId,
          input.doubleCheckedBy ?? null,
          input.idempotencyKey,
        ],
      );

      /*
       * Penambahan `dispensed_qty` dilakukan basis data, bukan dihitung layanan
       * lalu ditulis. Constraint `rx_line_dispensed_bounded` yang menahannya
       * bila melewati batas — dan itu tetap benar walau dua penyerahan atas
       * resep yang sama diproses bersamaan.
       */
      await client.query(
        `UPDATE "${schema}".rx_prescription_line
            SET dispensed_qty = dispensed_qty + $2, version = version + 1
          WHERE id = $1`,
        [input.prescriptionLineId, input.quantity],
      );

      await this.perbaruiStatusResep(client, schema, b.prescription_id);

      await this.audit.recordAccess(schema, {
        patientId: b.patient_id,
        facilityId: b.facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'rx_dispensing',
        entityId: dispensing.rows[0].id,
      });

      return {
        id: dispensing.rows[0].id,
        movementId: gerak.movementId,
        replayed: false,
        substitution: Boolean(input.dispensedDrugId && input.dispensedDrugId !== b.drug_id),
      };
    });
  }

  // --- Pemberian obat (eMAR) -------------------------------------------------

  /**
   * Mencatat pemberian obat kepada pasien setelah enam benar terpenuhi.
   *
   * Yang dipindai dibandingkan dengan yang diresepkan di peladen, bukan di
   * peramban. Pemeriksaan yang hanya ada di layar dapat dilewati siapa pun yang
   * memanggil jalur ini langsung, dan justru pemberian obatlah tempat yang
   * paling tidak boleh punya jalan pintas.
   */
  async berikan(
    schema: string,
    input: {
      administrationId: string;
      scanPatientId?: string | null;
      scanDrugId?: string | null;
      doseValue: number;
      route: string;
      witnessedBy?: string | null;
      wastedAmount?: number | null;
      note?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    /*
     * Enam benar diperiksa DI LUAR transaksi penulisan, dan itu bukan
     * kelalaian.
     *
     * Semula pemeriksaannya berada di dalam transaksi bersama pencatatan
     * kejadian nyaris cedera, lalu galat dilemparkan — dan lemparan itu
     * membatalkan transaksinya, sehingga catatan nyaris cederanya ikut terhapus.
     * Yang tersisa hanya penolakan di layar perawat: kejadiannya terjadi, tetapi
     * tidak ada jejaknya sama sekali. Tertangkap naskah bukti H-4.
     *
     * Justru catatan itulah yang paling berharga dalam keselamatan obat: ia
     * menunjukkan celah sebelum ada yang terluka.
     */
    const jadwal = await this.tenantDb.query<{
      patient_id: string;
      drug_id: string;
      dose_value: string;
      route: string;
      scheduled_at: string | null;
      status: string;
    }>(
      schema,
      `SELECT patient_id::text AS patient_id, drug_id::text AS drug_id,
              dose_value::text AS dose_value, route, scheduled_at::text AS scheduled_at, status
         FROM "${schema}".rx_administration WHERE id = $1`,
      [input.administrationId],
    );
    if (!jadwal.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jadwal pemberian obat tidak ditemukan.');
    }
    const j = jadwal[0];

    if (j.status !== 'SCHEDULED') {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Pemberian ini sudah berstatus ${j.status} dan tidak dapat dicatat ulang.`,
      );
    }

    const enamBenar = periksaEnamBenar({
      scanPatientId: input.scanPatientId ?? null,
      prescriptionPatientId: j.patient_id,
      scanDrugId: input.scanDrugId ?? null,
      prescriptionDrugId: j.drug_id,
      doseValue: input.doseValue,
      prescriptionDose: Number(j.dose_value),
      route: input.route,
      prescriptionRoute: j.route,
      scheduledAt: j.scheduled_at,
      administeredAt: new Date().toISOString(),
      administeredBy: ctx.actorUserId,
    });

    if (!enamBenar.ok) {
      await this.tenantDb.query(
        schema,
        `INSERT INTO "${schema}".rx_incident
           (patient_id, administration_id, incident_type, severity, description,
            reached_patient, reported_by)
         VALUES ($1,$2,$3,'NEAR_MISS',$4,FALSE,$5)`,
        [
          j.patient_id,
          input.administrationId,
          JENIS_KEJADIAN[enamBenar.failed[0]] ?? 'NEAR_MISS',
          `Enam benar tidak terpenuhi: ${enamBenar.failed.join(', ')}.`,
          ctx.actorUserId,
        ],
      );
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        enamBenar.message ?? 'Enam benar tidak terpenuhi.',
        { failed: enamBenar.failed },
      );
    }

    return this.tenantDb.transaction(schema, async (client) => {
      /*
       * Status dibaca ulang dengan penguncian di dalam transaksi. Pemeriksaan di
       * atas dilakukan tanpa kunci, sehingga dua perawat yang menekan tombol
       * bersamaan sama-sama melihat SCHEDULED — yang kedua harus berhenti di
       * sini, bukan menimpa catatan yang pertama.
       */
      const kunci = await client.query<{ status: string }>(
        `SELECT status FROM "${schema}".rx_administration WHERE id = $1 FOR UPDATE`,
        [input.administrationId],
      );
      if (kunci.rows[0]?.status !== 'SCHEDULED') {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Pemberian ini sudah berstatus ${kunci.rows[0]?.status} dan tidak dapat dicatat ulang.`,
        );
      }

      if (input.witnessedBy && input.witnessedBy === ctx.actorUserId) {
        throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Saksi tidak boleh sama dengan pemberi obat.');
      }

      await client.query(
        `UPDATE "${schema}".rx_administration
            SET status = 'ADMINISTERED', administered_at = now(), administered_by = $2,
                witnessed_by = $3, wasted_amount = $4, note = $5, version = version + 1
          WHERE id = $1`,
        [
          input.administrationId,
          ctx.actorUserId,
          input.witnessedBy ?? null,
          input.wastedAmount ?? null,
          input.note ?? null,
        ],
      );

      await this.audit.recordAccess(schema, {
        patientId: j.patient_id,
        facilityId: ctx.facilityId ?? null,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'rx_administration',
        entityId: input.administrationId,
      });

      return { id: input.administrationId, status: 'ADMINISTERED' };
    });
  }

  /** Mencatat obat yang tidak jadi diberikan, beserta sebabnya. */
  async lewati(
    schema: string,
    input: { administrationId: string; status: 'OMITTED' | 'REFUSED' | 'HELD'; reason: string; note?: string | null },
    ctx: KonteksAkses,
  ) {
    const izin = bolehLewati(input.reason);
    if (!izin.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message ?? 'Alasan wajib diisi.');
    }

    const rows = await this.tenantDb.query<{ patient_id: string; status: string }>(
      schema,
      `UPDATE "${schema}".rx_administration
          SET status = $2, omission_reason = $3, omission_note = $4, version = version + 1
        WHERE id = $1 AND status = 'SCHEDULED'
        RETURNING patient_id::text AS patient_id, status`,
      [input.administrationId, input.status, input.reason.slice(0, 48), input.note ?? null],
    );
    if (!rows.length) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Jadwal tidak ditemukan atau sudah tidak berstatus terjadwal.',
      );
    }

    await this.audit.recordAccess(schema, {
      patientId: rows[0].patient_id,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'rx_administration',
      entityId: input.administrationId,
    });

    return { id: input.administrationId, status: input.status };
  }

  // --- Daftar kerja ----------------------------------------------------------

  /** Jadwal pemberian obat yang masih menuntut keputusan perawat/farmasi klinis. */
  async daftarPemberian(schema: string, facilityId: string, status?: string) {
    return this.tenantDb.query(
      schema,
      /*
       * Daftar eMAR diurutkan menurut bahaya operasional: yang terlambat dan
       * obat risiko tinggi terlihat dulu. Layar tidak boleh mengurutkan ulang
       * menurut nama pasien karena itu menyembunyikan obat yang sudah lewat.
       */
      `SELECT a.id::text AS id, a.status, a.scheduled_at::text AS scheduled_at,
              a.administered_at::text AS administered_at,
              a.dose_value::float8 AS dose_value, a.dose_unit, a.route,
              a.omission_reason, a.omission_note,
              p.id::text AS prescription_id, p.prescription_number,
              l.id::text AS prescription_line_id, l.line_no, l.frequency_code,
              pt.id::text AS patient_id, pt.full_name AS patient_name,
              pt.birth_date::text AS birth_date,
              mrn.identifier_value AS medical_record_number,
              d.id::text AS drug_id, d.generic_name, d.brand_name, d.active_ingredient,
              d.drug_class, d.is_controlled, d.is_high_alert, d.is_lasa,
              CASE
                WHEN a.status = 'SCHEDULED' AND a.scheduled_at < now() THEN TRUE
                ELSE FALSE
              END AS overdue,
              CASE
                WHEN a.scheduled_at IS NULL THEN NULL
                ELSE floor(extract(epoch FROM (now() - a.scheduled_at)) / 60)::int
              END AS minutes_from_schedule
         FROM "${schema}".rx_administration a
         JOIN "${schema}".rx_prescription_line l ON l.id = a.prescription_line_id
         JOIN "${schema}".rx_prescription p ON p.id = l.prescription_id
         JOIN "${schema}".patient pt ON pt.id = a.patient_id
         JOIN "${schema}".rx_drug_master d ON d.id = a.drug_id
         LEFT JOIN "${schema}".patient_identifier mrn
           ON mrn.patient_id = a.patient_id AND mrn.facility_id = p.facility_id
          AND mrn.identifier_type = 'MRN' AND mrn.deleted_at IS NULL
        WHERE p.facility_id = $1
          AND ($2::text IS NULL OR a.status = $2)
          AND a.status IN ('SCHEDULED','HELD','REFUSED','OMITTED')
        ORDER BY
          (a.status = 'SCHEDULED' AND a.scheduled_at < now()) DESC,
          d.is_high_alert DESC,
          d.is_controlled DESC,
          a.scheduled_at NULLS LAST
        LIMIT 200`,
      [facilityId, status ?? null],
    );
  }

  /** Resep yang menunggu telaah atau penyerahan. */
  async antrianFarmasi(schema: string, facilityId: string, status?: string) {
    return this.tenantDb.query(
      schema,
      /*
       * Nomor rekam medis diambil dari `patient_identifier` yang cocok dengan
       * fasilitas resep ini, bukan dari kolom pada pasien. Nomor rekam medis
       * memang milik fasilitas, bukan milik pasien: satu orang punya nomor
       * berbeda di puskesmas dan di rumah sakit rujukannya.
       */
      `SELECT p.id::text AS id, p.prescription_number, p.status, p.prescribed_at,
              pt.full_name AS patient_name, mrn.identifier_value AS medical_record_number,
              count(l.id)::int AS line_count,
              bool_or(d.is_controlled) AS has_controlled,
              bool_or(d.is_high_alert) AS has_high_alert
         FROM "${schema}".rx_prescription p
         JOIN "${schema}".patient pt ON pt.id = p.patient_id
         LEFT JOIN "${schema}".patient_identifier mrn
           ON mrn.patient_id = p.patient_id AND mrn.facility_id = p.facility_id
          AND mrn.identifier_type = 'MRN' AND mrn.deleted_at IS NULL
         LEFT JOIN "${schema}".rx_prescription_line l ON l.prescription_id = p.id
         LEFT JOIN "${schema}".rx_drug_master d ON d.id = l.drug_id
        WHERE p.facility_id = $1
          AND ($2::text IS NULL OR p.status = $2)
          AND p.status IN ('PRESCRIBED','UNDER_REVIEW','REVIEWED','PARTIALLY_DISPENSED')
        GROUP BY p.id, pt.full_name, mrn.identifier_value
        -- Obat terkendali didahulukan: penundaannya menuntut penjelasan tertulis.
        ORDER BY bool_or(d.is_controlled) DESC NULLS LAST, p.prescribed_at
        LIMIT 200`,
      [facilityId, status ?? null],
    );
  }

  /** Rincian satu resep beserta baris dan peringatannya. */
  async resep(schema: string, id: string, ctx: KonteksAkses) {
    const header = await this.tenantDb.query<{ patient_id: string; facility_id: string }>(
      schema,
      `SELECT patient_id::text AS patient_id, facility_id::text AS facility_id
         FROM "${schema}".rx_prescription WHERE id = $1`,
      [id],
    );
    if (!header.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Resep tidak ditemukan.');

    const [detail] = await this.tenantDb.query(
      schema,
      `SELECT p.id::text AS id, p.prescription_number, p.status, p.prescribed_at,
              p.reviewed_at, p.review_note, p.note,
              pt.full_name AS patient_name, mrn.identifier_value AS medical_record_number,
              pt.birth_date::text AS birth_date
         FROM "${schema}".rx_prescription p
         JOIN "${schema}".patient pt ON pt.id = p.patient_id
         LEFT JOIN "${schema}".patient_identifier mrn
           ON mrn.patient_id = p.patient_id AND mrn.facility_id = p.facility_id
          AND mrn.identifier_type = 'MRN' AND mrn.deleted_at IS NULL
        WHERE p.id = $1`,
      [id],
    );

    const lines = await this.tenantDb.query(
      schema,
      `SELECT l.id::text AS id, l.line_no, l.dose_value::float8 AS dose_value, l.dose_unit,
              l.route, l.frequency_code, l.frequency_per_day::float8 AS frequency_per_day,
              l.duration_days, l.quantity::float8 AS quantity, l.dispensed_qty::float8 AS dispensed_qty,
              l.instruction, l.is_prn, l.override_alerts,
              d.id::text AS drug_id, d.generic_name, d.brand_name, d.active_ingredient,
              d.drug_class, d.is_controlled, d.is_high_alert, d.is_lasa
         FROM "${schema}".rx_prescription_line l
         JOIN "${schema}".rx_drug_master d ON d.id = l.drug_id
        WHERE l.prescription_id = $1
        ORDER BY l.line_no`,
      [id],
    );

    await this.audit.recordAccess(schema, {
      patientId: header[0].patient_id,
      facilityId: header[0].facility_id,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'rx_prescription',
      entityId: id,
    });

    return { ...detail, lines };
  }

  // --- Perdagangan apotik ---------------------------------------------------

  async daftarTransaksiPos(schema: string, mode?: string, limit = 100) {
    const batas = Math.min(Math.max(limit, 1), 250);
    return this.tenantDb.query(
      schema,
      `SELECT c.pos_sale_id::text, c.transaction_mode, c.reference_number,
              c.formula_name, c.dosage_form, c.label_instruction,
              c.workflow_status, c.validated_at::text, c.completed_at::text,
              c.updated_at::text, p.prescription_number,
              s.status AS sale_status, s.receipt_number, s.business_date::text,
              s.grand_total::text, s.currency_code, count(l.id)::int AS line_count
         FROM "${schema}".rx_pos_sale_context c
         JOIN "${schema}".pos_sale s ON s.id = c.pos_sale_id
         LEFT JOIN "${schema}".rx_prescription p ON p.id = c.prescription_id
         LEFT JOIN "${schema}".pos_sale_line l ON l.pos_sale_id = s.id
        WHERE ($1::text IS NULL OR c.transaction_mode = $1)
        GROUP BY c.pos_sale_id, p.prescription_number, s.id
        ORDER BY c.updated_at DESC LIMIT ${batas}`,
      [mode?.trim() || null],
    );
  }

  async konteksTransaksiPos(schema: string, saleId: string) {
    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT c.pos_sale_id::text, c.transaction_mode, c.reference_number,
              c.formula_name, c.dosage_form, c.label_instruction,
              c.workflow_status, c.validated_at::text, c.completed_at::text,
              p.id::text AS prescription_id, p.prescription_number,
              p.status AS prescription_status
         FROM "${schema}".rx_pos_sale_context c
         LEFT JOIN "${schema}".rx_prescription p ON p.id = c.prescription_id
        WHERE c.pos_sale_id = $1`,
      [saleId],
    );
    return rows[0] ?? null;
  }

  async simpanKonteksTransaksiPos(
    schema: string,
    saleId: string,
    input: {
      mode: 'OTC' | 'PRESCRIPTION' | 'COMPOUND' | 'PRODUCTION';
      prescriptionNumber?: string | null;
      referenceNumber?: string | null;
      formulaName?: string | null;
      dosageForm?: string | null;
      labelInstruction?: string | null;
    },
    actorUserId: string,
  ) {
    const sale = await this.tenantDb.query<{ status: string }>(
      schema,
      `SELECT status FROM "${schema}".pos_sale WHERE id = $1`,
      [saleId],
    );
    if (!sale.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi POS tidak ditemukan.');
    if (!['DRAFT', 'HELD'].includes(sale[0].status)) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        `Konteks farmasi tidak dapat diubah saat transaksi berstatus ${sale[0].status}.`,
      );
    }

    let prescriptionId: string | null = null;
    if (input.mode === 'PRESCRIPTION' || input.mode === 'COMPOUND') {
      if (!input.prescriptionNumber?.trim()) {
        throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nomor resep wajib diisi.');
      }
      const resep = await this.tenantDb.query<{ id: string; status: string }>(
        schema,
        `SELECT id::text, status FROM "${schema}".rx_prescription
          WHERE upper(prescription_number) = upper($1)`,
        [input.prescriptionNumber.trim()],
      );
      if (!resep.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Nomor resep tidak ditemukan.');
      if (!['REVIEWED', 'PARTIALLY_DISPENSED'].includes(resep[0].status)) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          `Resep berstatus ${resep[0].status}; gunakan resep yang sudah ditelaah.`,
        );
      }
      prescriptionId = resep[0].id;
    }

    const rows = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `INSERT INTO "${schema}".rx_pos_sale_context
         (pos_sale_id, transaction_mode, prescription_id, reference_number,
          formula_name, dosage_form, label_instruction, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)
       ON CONFLICT (pos_sale_id) DO UPDATE SET
         transaction_mode = EXCLUDED.transaction_mode,
         prescription_id = EXCLUDED.prescription_id,
         reference_number = EXCLUDED.reference_number,
         formula_name = EXCLUDED.formula_name,
         dosage_form = EXCLUDED.dosage_form,
         label_instruction = EXCLUDED.label_instruction,
         workflow_status = 'DRAFT', validated_at = NULL,
         updated_by = EXCLUDED.updated_by, updated_at = now(),
         version = rx_pos_sale_context.version + 1
       RETURNING pos_sale_id::text, transaction_mode, workflow_status`,
      [saleId, input.mode, prescriptionId, input.referenceNumber?.trim() || null,
       input.formulaName?.trim() || null, input.dosageForm?.trim() || null,
       input.labelInstruction?.trim() || null, actorUserId],
    );
    return rows[0];
  }

  async validasiTransaksiPos(schema: string, saleId: string) {
    return this.tenantDb.transaction(schema, async (client) => {
      const konteks = await client.query<{
        transaction_mode: string;
        prescription_id: string | null;
        prescription_status: string | null;
      }>(
        `SELECT c.transaction_mode, c.prescription_id::text,
                p.status AS prescription_status
           FROM "${schema}".rx_pos_sale_context c
           LEFT JOIN "${schema}".rx_prescription p ON p.id = c.prescription_id
          WHERE c.pos_sale_id = $1 FOR UPDATE OF c`,
        [saleId],
      );
      if (!konteks.rows.length) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Konteks POS Apotik belum disimpan.',
        );
      }
      const c = konteks.rows[0];
      if (['PRESCRIPTION', 'COMPOUND'].includes(c.transaction_mode) &&
          !['REVIEWED', 'PARTIALLY_DISPENSED'].includes(c.prescription_status ?? '')) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Resep belum ditelaah atau sudah tidak dapat digunakan.',
        );
      }

      const tanpaResep = await client.query<{ product_name: string }>(
        `SELECT p.name AS product_name
           FROM "${schema}".pos_sale_line l
           JOIN "${schema}".product p ON p.id = l.product_id
           JOIN "${schema}".rx_drug_master d ON d.product_id = l.product_id AND d.deleted_at IS NULL
          WHERE l.pos_sale_id = $1 AND d.requires_prescription = TRUE
            AND $2::uuid IS NULL LIMIT 1`,
        [saleId, c.prescription_id],
      );
      if (tanpaResep.rows.length) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          `${tanpaResep.rows[0].product_name} memerlukan resep yang sudah ditelaah.`,
        );
      }

      if (c.prescription_id) {
        const tidakSesuai = await client.query<{ product_name: string }>(
          `SELECT p.name AS product_name
             FROM "${schema}".pos_sale_line sl
             JOIN "${schema}".product p ON p.id = sl.product_id
             JOIN "${schema}".rx_drug_master d ON d.product_id = sl.product_id AND d.deleted_at IS NULL
            WHERE sl.pos_sale_id = $1 AND d.requires_prescription = TRUE
              AND NOT EXISTS (
                SELECT 1 FROM "${schema}".rx_prescription_line rl
                 WHERE rl.prescription_id = $2 AND rl.drug_id = d.id
              ) LIMIT 1`,
          [saleId, c.prescription_id],
        );
        if (tidakSesuai.rows.length) {
          throw AppError.unprocessable(
            ErrorCodes.VALIDATION_FAILED,
            `${tidakSesuai.rows[0].product_name} tidak tercantum pada resep yang dipilih.`,
          );
        }
      }

      if (c.transaction_mode === 'COMPOUND' || c.transaction_mode === 'PRODUCTION') {
        await client.query(
          `INSERT INTO "${schema}".rx_pos_compound_component
             (pos_sale_id, pos_sale_line_id, product_id, quantity, uom_id, unit_cost_snapshot)
           SELECT $1, l.id, l.product_id, l.quantity, l.uom_id, COALESCE(l.cost_snapshot, 0)
             FROM "${schema}".pos_sale_line l WHERE l.pos_sale_id = $1
           ON CONFLICT (pos_sale_id, pos_sale_line_id) DO UPDATE SET
             quantity = EXCLUDED.quantity, uom_id = EXCLUDED.uom_id,
             unit_cost_snapshot = EXCLUDED.unit_cost_snapshot`,
          [saleId],
        );
      }

      await client.query(
        `UPDATE "${schema}".rx_pos_sale_context
            SET workflow_status = 'VALIDATED', validated_at = now(),
                updated_at = now(), version = version + 1
          WHERE pos_sale_id = $1`,
        [saleId],
      );
      return { saleId, validated: true };
    });
  }

  async tandaiTransaksiPosSelesai(schema: string, saleId: string) {
    await this.tenantDb.query(
      schema,
      `UPDATE "${schema}".rx_pos_sale_context
          SET workflow_status = 'COMPLETED', completed_at = now(),
              updated_at = now(), version = version + 1
        WHERE pos_sale_id = $1 AND workflow_status = 'VALIDATED'`,
      [saleId],
    );
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilObat(schema: string, drugId: string): Promise<Obat & { productId: string }> {
    const rows = await this.tenantDb.query<{
      id: string;
      product_id: string;
      code: string;
      generic_name: string;
      brand_name: string | null;
      active_ingredient: string;
      drug_class: string;
      is_controlled: boolean;
      is_high_alert: boolean;
      is_lasa: boolean;
      min_single_dose: string | null;
      max_single_dose: string | null;
      max_daily_dose: string | null;
      dose_unit: string | null;
    }>(
      schema,
      `SELECT id::text AS id, product_id::text AS product_id, code, generic_name, brand_name,
              active_ingredient, drug_class, is_controlled, is_high_alert, is_lasa,
              min_single_dose::text, max_single_dose::text, max_daily_dose::text, dose_unit
         FROM "${schema}".rx_drug_master WHERE id = $1 AND deleted_at IS NULL`,
      [drugId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Obat tidak ditemukan pada formularium.');
    const r = rows[0];
    return {
      id: r.id,
      productId: r.product_id,
      code: r.code,
      genericName: r.generic_name,
      brandName: r.brand_name,
      activeIngredient: r.active_ingredient,
      drugClass: r.drug_class as Obat['drugClass'],
      isControlled: r.is_controlled,
      isHighAlert: r.is_high_alert,
      isLasa: r.is_lasa,
      minSingleDose: r.min_single_dose === null ? null : Number(r.min_single_dose),
      maxSingleDose: r.max_single_dose === null ? null : Number(r.max_single_dose),
      maxDailyDose: r.max_daily_dose === null ? null : Number(r.max_daily_dose),
      doseUnit: r.dose_unit,
    };
  }

  private async ambilAlergi(schema: string, patientId: string): Promise<AlergiPasien[]> {
    const rows = await this.tenantDb.query<{
      allergen_name: string;
      allergen_type: string;
      severity: string;
      certainty: string;
    }>(
      schema,
      /*
       * `refuted_at IS NULL`, bukan penanda status. Alergi tidak pernah dihapus
       * di sini — ia dinyatakan tidak berlaku lagi beserta alasannya. Yang sudah
       * dibantah tidak boleh ikut memblokir peresepan; yang belum dibantah harus.
       */
      `SELECT allergen_name, allergen_type, severity, certainty
         FROM "${schema}".patient_allergy
        WHERE patient_id = $1 AND refuted_at IS NULL`,
      [patientId],
    );
    return rows.map((r) => ({
      allergenName: r.allergen_name,
      allergenType: r.allergen_type as AlergiPasien['allergenType'],
      severity: r.severity as AlergiPasien['severity'],
      certainty: r.certainty as AlergiPasien['certainty'],
    }));
  }

  /** Zat aktif yang sedang dipakai pasien dari resep aktif lainnya. */
  private async zatSedangDipakai(
    schema: string,
    patientId: string,
    kecualiResepId: string | null,
  ): Promise<string[]> {
    const rows = await this.tenantDb.query<{ active_ingredient: string }>(
      schema,
      `SELECT DISTINCT d.active_ingredient
         FROM "${schema}".rx_prescription p
         JOIN "${schema}".rx_prescription_line l ON l.prescription_id = p.id
         JOIN "${schema}".rx_drug_master d ON d.id = l.drug_id
        WHERE p.patient_id = $1
          AND ($2::uuid IS NULL OR p.id <> $2::uuid)
          AND p.status IN ('PRESCRIBED','UNDER_REVIEW','REVIEWED','PARTIALLY_DISPENSED','DISPENSED')
          -- Resep lama tidak lagi menggambarkan apa yang sedang dipakai. Batas
          -- 90 hari dipilih supaya obat kronis tetap terlihat tanpa membanjiri
          -- pemeriksaan dengan antibiotik dari tahun lalu.
          AND p.prescribed_at > now() - interval '90 days'`,
      [patientId, kecualiResepId],
    );
    return rows.map((r) => r.active_ingredient);
  }

  private async zatPadaResep(
    schema: string,
    prescriptionId: string,
    kecualiLineId: string | null,
  ): Promise<string[]> {
    const rows = await this.tenantDb.query<{ active_ingredient: string }>(
      schema,
      `SELECT d.active_ingredient
         FROM "${schema}".rx_prescription_line l
         JOIN "${schema}".rx_drug_master d ON d.id = l.drug_id
        WHERE l.prescription_id = $1 AND ($2::uuid IS NULL OR l.id <> $2::uuid)`,
      [prescriptionId, kecualiLineId],
    );
    return rows.map((r) => r.active_ingredient);
  }

  /**
   * Interaksi yang mungkin mengenai zat-zat ini.
   *
   * Disaring di basis data, bukan diambil seluruhnya lalu disaring di memori:
   * katalog interaksi berukuran puluhan ribu baris, dan memuat semuanya pada
   * setiap peresepan akan membuat layar peresepan terasa lambat justru pada
   * saat dokter sedang menunggu.
   */
  private async ambilInteraksi(schema: string, zat: string[]): Promise<Interaksi[]> {
    const unik = [...new Set(zat.filter(Boolean).map((z) => z.toLowerCase()))];
    if (unik.length < 2) return [];

    const rows = await this.tenantDb.query<{
      ingredient_a: string;
      ingredient_b: string;
      severity: string;
      description: string;
      management: string | null;
    }>(
      schema,
      `SELECT ingredient_a, ingredient_b, severity, description, management
         FROM "${schema}".rx_interaction
        WHERE is_active = TRUE
          AND lower(ingredient_a) = ANY($1) AND lower(ingredient_b) = ANY($1)`,
      [unik],
    );
    return rows.map((r) => ({
      ingredientA: r.ingredient_a,
      ingredientB: r.ingredient_b,
      severity: r.severity as Interaksi['severity'],
      description: r.description,
      management: r.management,
    }));
  }

  /**
   * Lot mana yang akan benar-benar diserahkan.
   *
   * Dua perilaku yang berbeda, dan perbedaannya penting:
   *
   * - **Lot disebut** — kembalikan lot itu apa adanya, sekalipun kedaluwarsa.
   *   `bolehSerahkan` yang kemudian menolaknya, dengan pesan yang menyebut
   *   tanggalnya. Menyembunyikan lot itu di sini akan membuat apoteker yang
   *   memindai kotak kedaluwarsa mendapat pesan "stok tidak cukup" — keliru,
   *   membingungkan, dan mendorongnya mencari jalan memutar.
   *
   * - **Lot tidak disebut** — pilih di antara yang LAYAK saja, FEFO.
   *   Mengurutkan seluruh lot dengan FEFO tanpa menyaring lebih dahulu akan
   *   menempatkan lot yang sudah kedaluwarsa di urutan paling depan, dan
   *   penyerahan yang sah pun akan ditolak karenanya. Kekeliruan ini sempat
   *   terjadi di sini dan tertangkap naskah bukti.
   */
  private async lotTerpilih(
    schema: string,
    warehouseId: string,
    productId: string,
    lotId: string | null,
  ): Promise<{ lotNumber: string; expiryDate: string | null } | null> {
    const syaratLayak = lotId
      ? ''
      : `AND l.quality_status = 'GOOD'
         AND (l.expiry_date IS NULL OR l.expiry_date > CURRENT_DATE)`;

    const rows = await this.tenantDb.query<{ lot_number: string; expiry_date: string | null }>(
      schema,
      `SELECT l.lot_number, l.expiry_date::text AS expiry_date
         FROM "${schema}".stock_balance b
         JOIN "${schema}".inventory_lot l ON l.id = b.lot_id
        WHERE b.warehouse_id = $1 AND b.product_id = $2 AND b.available_qty > 0
          AND ($3::uuid IS NULL OR b.lot_id = $3::uuid)
          AND l.deleted_at IS NULL AND l.is_active = TRUE
          ${syaratLayak}
        ORDER BY l.expiry_date NULLS LAST
        LIMIT 1`,
      [warehouseId, productId, lotId],
    );
    return rows.length ? { lotNumber: rows[0].lot_number, expiryDate: rows[0].expiry_date } : null;
  }

  /**
   * Status resep mengikuti barisnya, bukan sebaliknya.
   *
   * Dihitung dari `dispensed_qty` yang sudah tersimpan, bukan ditambahkan
   * layanan. Dua penyerahan bersamaan atas resep yang sama akan menghasilkan
   * status yang sama-sama benar.
   */
  private async perbaruiStatusResep(client: PoolClient, schema: string, prescriptionId: string) {
    await client.query(
      `UPDATE "${schema}".rx_prescription p
          SET status = CASE
                WHEN s.sisa = 0 THEN 'DISPENSED'
                WHEN s.terserah > 0 THEN 'PARTIALLY_DISPENSED'
                ELSE p.status
              END,
              updated_at = now(), version = p.version + 1
         FROM (
           SELECT sum(quantity - dispensed_qty) AS sisa, sum(dispensed_qty) AS terserah
             FROM "${schema}".rx_prescription_line WHERE prescription_id = $1
         ) s
        WHERE p.id = $1 AND p.status NOT IN ('CANCELLED','REJECTED')`,
      [prescriptionId],
    );
  }

  /**
   * Nomor resep memuat kode fasilitas.
   *
   * Tanpa itu, dua fasilitas yang mendaftar pada tenant yang sama akan
   * memperebutkan nomor yang sama begitu keduanya melayani pada hari yang sama.
   */
  private async nomorResep(
    client: PoolClient,
    schema: string,
    facilityId: string,
    facilityCode: string,
  ): Promise<string> {
    const hari = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".rx_prescription
        WHERE facility_id = $1 AND prescribed_at::date = CURRENT_DATE`,
      [facilityId],
    );
    return `RX-${facilityCode}-${hari}-${String(urutan.rows[0].n).padStart(4, '0')}`;
  }
}

/** Kegagalan enam benar dipetakan ke jenis kejadian yang setara. */
const JENIS_KEJADIAN: Record<string, string> = {
  patient: 'WRONG_PATIENT',
  medication: 'WRONG_DRUG',
  dose: 'WRONG_DOSE',
  route: 'WRONG_ROUTE',
  time: 'WRONG_TIME',
  documentation: 'OMISSION',
};
