/**
 * Kerangka BPJS/JKN: akun, gerbang adapter, kepesertaan, SEP, dan klaim paket.
 *
 * Aturannya ada di `health-bpjs.ts` sebagai fungsi murni.
 *
 * **Tidak ada satu pun panggilan jaringan ke BPJS pada berkas ini.**
 *
 * Yang ada adalah seluruh siklus klaim di dalam rumah sakit — yang justru
 * bagian terbesarnya, dan yang tidak menuntut kredensial siapa pun. Yang
 * terhalang hanya dua ujungnya: menanyakan kepesertaan, dan mengirimkan
 * klaimnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  ADAPTER_BPJS,
  MASA_BERLAKU_KEPESERTAAN_JAM,
  METODE_BAYAR,
  bolehPanggil,
  hitungSelisihKelas,
  kepesertaanMasihBerlaku,
  periksaItemKlaim,
  periksaNomorSep,
  ringkasKesiapan,
  statusPenjaminan,
  tujuanDataPerItem,
  type StatusAdapter,
} from './health-bpjs';

@Injectable()
export class HealthBpjsService {
  private readonly logger = new Logger(HealthBpjsService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  katalog() {
    return {
      adapters: ADAPTER_BPJS,
      paymentMethods: METODE_BAYAR,
      itemDataPurpose: tujuanDataPerItem(),
      note:
        'Seluruh adapter BLOCKED — dan itu tidak menghentikan apa pun yang penting. Seluruh ' +
        'siklus klaim di dalam rumah sakit berjalan penuh; yang terhalang hanya dua ujungnya.',
    };
  }

  // --- Akun dan gerbang ------------------------------------------------------

  async daftarkanAkun(
    schema: string,
    input: {
      facilityId: string;
      providerCode: string;
      serviceLevel: 'FKTP' | 'FKRTL';
      environment?: 'SANDBOX' | 'PRODUCTION';
      credentialSecretRef?: string | null;
      credentialRawValue?: string | null;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    if (input.credentialRawValue) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Kredensial BPJS tidak boleh disimpan sebagai nilai. Consumer secret dan user key yang ' +
          'bocor membuka jalan mengajukan klaim atas nama fasilitas ini, dan yang menerima tidak ' +
          'punya cara membedakannya.',
      );
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".bpjs_provider_account
         (facility_id, provider_code, service_level, environment, credential_secret_ref,
          note, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (facility_id, service_level, environment) DO UPDATE
         SET provider_code = EXCLUDED.provider_code,
             credential_secret_ref = COALESCE(EXCLUDED.credential_secret_ref,
                                              "${schema}".bpjs_provider_account.credential_secret_ref),
             note = EXCLUDED.note,
             updated_at = now(),
             version = "${schema}".bpjs_provider_account.version + 1
       RETURNING id`,
      [
        input.facilityId,
        input.providerCode,
        input.serviceLevel,
        input.environment ?? 'SANDBOX',
        input.credentialSecretRef ?? null,
        input.note ?? null,
        actorUserId,
      ],
    );

    return {
      id: baris[0].id,
      isActive: false,
      note:
        'Akun terdaftar tetapi TIDAK aktif, dan akun aktif pun tidak membuka pemanggilan — ' +
        'gerbangnya adalah status adapter.',
    };
  }

  async daftarAkun(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, provider_code, service_level, environment, is_active,
              credential_secret_ref IS NOT NULL AS has_credential, activated_at, note
         FROM "${schema}".bpjs_provider_account
        WHERE facility_id = $1
        ORDER BY service_level, environment`,
      [facilityId],
    );
  }

  async aktifkanAkun(schema: string, accountId: string, actorUserId: string) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".bpjs_provider_account
          SET is_active = TRUE, activated_by = $2, activated_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1 AND credential_secret_ref IS NOT NULL
        RETURNING id`,
      [accountId, actorUserId],
    );
    if (baris.length === 0) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Akun tidak ditemukan atau belum punya rujukan kredensial.',
      );
    }
    return {
      id: accountId,
      isActive: true,
      note: 'Akun aktif TIDAK membuka pemanggilan adapter. Gerbangnya adalah status adapter.',
    };
  }

  async daftarKemampuan(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query<{
      id: string;
      adapter_code: string;
      status: StatusAdapter;
      blocker: string | null;
      verified_at: string | null;
    }>(
      schema,
      `SELECT id, adapter_code, status, blocker, verified_at
         FROM "${schema}".bpjs_adapter_capability
        WHERE facility_id = $1
        ORDER BY adapter_code`,
      [facilityId],
    );
    return {
      items: baris.map((b) => ({
        id: b.id,
        adapterCode: b.adapter_code,
        status: b.status,
        blocker: b.blocker,
        verifiedAt: b.verified_at,
        scope: ADAPTER_BPJS.find((a) => a.kode === b.adapter_code)?.cakupan ?? null,
      })),
      summary: ringkasKesiapan(baris.map((b) => ({ adapter: b.adapter_code, status: b.status }))),
    };
  }

  async ubahStatusAdapter(
    schema: string,
    capabilityId: string,
    input: { status: StatusAdapter; note?: string | null },
    actorUserId: string,
  ) {
    if (input.status === 'VERIFIED' && (input.note ?? '').trim().length < 20) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'VERIFIED wajib berketerangan sekurangnya 20 huruf: apa yang dipanggil, terhadap ' +
          'lingkungan mana, dan apa yang dijawabnya. Keterangan sepatah kata tidak dapat ' +
          'ditelaah siapa pun setahun kemudian.',
      );
    }
    const verified = input.status === 'VERIFIED';
    const baris = await this.tenantDb.query<{ id: string; adapter_code: string }>(
      schema,
      `UPDATE "${schema}".bpjs_adapter_capability
          SET status = $2,
              verified_by = CASE WHEN $3 THEN $4::uuid ELSE verified_by END,
              verified_at = CASE WHEN $3 THEN now() ELSE verified_at END,
              verification_note = COALESCE($5, verification_note),
              updated_at = now(), version = version + 1
        WHERE id = $1
        RETURNING id, adapter_code`,
      [capabilityId, input.status, verified, actorUserId, input.note ?? null],
    );
    if (baris.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kemampuan adapter tidak ditemukan.');
    }
    return { id: capabilityId, adapterCode: baris[0].adapter_code, status: input.status };
  }

  /**
   * Memanggil adapter.
   *
   * **Tidak memanggil apa pun.** Ia memeriksa gerbangnya dan menolak — beserta
   * penjelasan tentang apa yang **masih dapat dikerjakan** tanpa adapter itu.
   * Penolakan yang tidak menyebutkannya akan dibaca sebagai "seluruh klaim
   * berhenti", dan itu keliru.
   */
  async panggilAdapter(
    schema: string,
    input: { facilityId: string; adapterCode: string },
  ) {
    const akun = await this.tenantDb.query<{ credential_secret_ref: string | null }>(
      schema,
      `SELECT credential_secret_ref FROM "${schema}".bpjs_provider_account
        WHERE facility_id = $1 AND is_active = TRUE LIMIT 1`,
      [input.facilityId],
    );
    const kemampuan = await this.tenantDb.query<{ status: StatusAdapter }>(
      schema,
      `SELECT status FROM "${schema}".bpjs_adapter_capability
        WHERE facility_id = $1 AND adapter_code = $2`,
      [input.facilityId, input.adapterCode],
    );

    const gerbang = bolehPanggil({
      adapter: input.adapterCode,
      status: kemampuan[0]?.status ?? 'BLOCKED',
      adaAkun: akun.length > 0,
      adaRujukanKredensial: Boolean(akun[0]?.credential_secret_ref),
    });

    return {
      adapterCode: input.adapterCode,
      called: false,
      gateOpen: gerbang.boleh,
      reason: gerbang.alasan,
      stillPossible: gerbang.yangMasihBisa,
      note:
        'TIDAK ADA PANGGILAN JARINGAN yang dilakukan. Bentuk, penandatanganan, dan enkripsi ' +
        'permintaan BPJS harus diverifikasi terhadap dokumentasi berversi — mengarangnya akan ' +
        'menghasilkan adapter yang harus dibuang seluruhnya.',
    };
  }

  // --- Kepesertaan -----------------------------------------------------------

  async catatKepesertaan(
    schema: string,
    input: {
      facilityId: string;
      patientId: string;
      membershipNumber?: string | null;
      participantStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'UNKNOWN';
      benefitClass?: number | null;
      registeredFktp?: string | null;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    const kedaluwarsa = new Date(
      Date.now() + MASA_BERLAKU_KEPESERTAAN_JAM * 3_600_000,
    ).toISOString();

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".bpjs_participant_eligibility
         (facility_id, patient_id, membership_number, participant_status, benefit_class,
          registered_fktp, checked_at, expires_at, source, checked_by, raw_note)
       VALUES ($1,$2,$3,$4,$5,$6,now(),$7,'MANUAL',$8,$9)
       ON CONFLICT (facility_id, patient_id) DO UPDATE
         SET membership_number = EXCLUDED.membership_number,
             participant_status = EXCLUDED.participant_status,
             benefit_class = EXCLUDED.benefit_class,
             registered_fktp = EXCLUDED.registered_fktp,
             checked_at = now(), expires_at = EXCLUDED.expires_at,
             source = EXCLUDED.source, checked_by = EXCLUDED.checked_by,
             raw_note = EXCLUDED.raw_note,
             updated_at = now(),
             version = "${schema}".bpjs_participant_eligibility.version + 1
       RETURNING id`,
      [
        input.facilityId,
        input.patientId,
        input.membershipNumber ?? null,
        input.participantStatus,
        input.benefitClass ?? null,
        input.registeredFktp ?? null,
        kedaluwarsa,
        actorUserId,
        input.note ?? null,
      ],
    );

    return {
      id: baris[0].id,
      source: 'MANUAL',
      expiresAt: kedaluwarsa,
      note:
        'Dicatat sebagai MANUAL, bukan ADAPTER — ia diketik petugas dari kartu peserta, bukan ' +
        'jawaban BPJS. Keduanya sah, tetapi keduanya tidak sama, dan yang membedakannya adalah ' +
        `kolom sumbernya. Berlaku ${MASA_BERLAKU_KEPESERTAAN_JAM} jam.`,
    };
  }

  async bacaKepesertaan(schema: string, facilityId: string, patientId: string) {
    const baris = await this.tenantDb.query<{
      membership_number: string | null;
      participant_status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'UNKNOWN';
      benefit_class: number | null;
      checked_at: string | null;
      source: string;
    }>(
      schema,
      `SELECT membership_number, participant_status, benefit_class,
              checked_at, source
         FROM "${schema}".bpjs_participant_eligibility
        WHERE facility_id = $1 AND patient_id = $2`,
      [facilityId, patientId],
    );

    const sekarang = new Date().toISOString();
    const b = baris[0];
    const berlaku = kepesertaanMasihBerlaku(
      b?.checked_at ? new Date(b.checked_at).toISOString() : null,
      sekarang,
    );
    const penjaminan = statusPenjaminan({
      kepesertaanBerlaku: berlaku.berlaku,
      statusPeserta: b?.participant_status ?? 'UNKNOWN',
    });

    return {
      patientId,
      membershipNumber: b?.membership_number ?? null,
      participantStatus: b?.participant_status ?? 'UNKNOWN',
      benefitClass: b?.benefit_class ?? null,
      source: b?.source ?? null,
      validity: berlaku,
      coverage: penjaminan,
    };
  }

  // --- SEP -------------------------------------------------------------------

  async catatSep(
    schema: string,
    input: {
      facilityId: string;
      patientId: string;
      encounterId?: string | null;
      sepNumber: string;
      sepDate: string;
      serviceType: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY';
      referralNumber?: string | null;
      diagnosisCode?: string | null;
      benefitClass?: number | null;
      occupiedClass?: number | null;
    },
    actorUserId: string,
  ) {
    const izin = periksaNomorSep(input.sepNumber);
    if (!izin.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }

    let selisih = null;
    if (input.benefitClass && input.occupiedClass) {
      selisih = hitungSelisihKelas({
        kelasHak: input.benefitClass,
        kelasDitempati: input.occupiedClass,
        // Tarif belum tersedia sampai impornya ada; selisihnya dihitung nol.
        tarifKelasHak: 0,
        tarifKelasDitempati: 0,
        atasPermintaanPasien: true,
      });
    }

    try {
      const baris = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".bpjs_sep
           (facility_id, patient_id, encounter_id, sep_number, sep_date, service_type,
            referral_number, diagnosis_code, benefit_class, occupied_class, recorded_by)
         VALUES ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          input.facilityId,
          input.patientId,
          input.encounterId ?? null,
          input.sepNumber,
          input.sepDate,
          input.serviceType,
          input.referralNumber ?? null,
          input.diagnosisCode ?? null,
          input.benefitClass ?? null,
          input.occupiedClass ?? null,
          actorUserId,
        ],
      );
      return {
        id: baris[0].id,
        sepNumber: input.sepNumber,
        classDifference: selisih,
        note:
          'Nomor SEP dicatat apa adanya. Yang berwenang menyatakan ia sah adalah BPJS, bukan ' +
          'perangkat lunak ini — yang ditolak di sini hanyalah nomor yang jelas dibuat sendiri.',
      };
    } catch (e) {
      if (String((e as { message?: string }).message ?? '').includes('ux_bpjs_sep_number')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Nomor SEP ${input.sepNumber} sudah tercatat. Satu nomor SEP menunjuk satu pelayanan; ` +
            'nomor yang dipakai dua kali membuat salah satu klaimnya ditolak, dan yang ditolak ' +
            'belum tentu yang keliru.',
        );
      }
      throw e;
    }
  }

  async daftarSep(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT s.id, s.sep_number, s.sep_date::text AS sep_date, s.service_type,
              s.benefit_class, s.occupied_class, s.status, p.full_name AS patient_name
         FROM "${schema}".bpjs_sep s
         JOIN "${schema}".patient p ON p.id = s.patient_id
        WHERE s.facility_id = $1
        ORDER BY s.sep_date DESC, s.created_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  // --- Klaim paket -----------------------------------------------------------

  /**
   * Menambahkan baris item klaim.
   *
   * **Menolak masukan yang memuat nilai penggantian BPJS per item.** Tabelnya
   * memang tidak punya kolomnya, tetapi penolakan di sini menjelaskan
   * ALASANNYA — dan alasan itulah yang mencegah orang berikutnya menambahkan
   * kolomnya.
   */
  async tambahItemKlaim(
    schema: string,
    bpjsClaimId: string,
    input: Record<string, unknown> & {
      itemType: string;
      itemCode: string;
      itemName?: string;
      quantity?: number;
      actualCost?: number;
      patientCharge?: number;
    },
  ) {
    const izin = periksaItemKlaim(input);
    if (!izin.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".bpjs_claim_item
         (bpjs_claim_id, item_type, item_code, item_name, quantity, actual_cost, patient_charge)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        bpjsClaimId,
        input.itemType,
        input.itemCode,
        input.itemName ?? null,
        input.quantity ?? 1,
        input.actualCost ?? null,
        input.patientCharge ?? null,
      ],
    );
    return {
      id: baris[0].id,
      note:
        'Biaya aktual dan tagihan pasien tersimpan. Nilai penggantian BPJS TIDAK — ia berada ' +
        'pada tingkat paket, sebab INA-CBG membayar paket kasus dan bukan item.',
    };
  }
}
