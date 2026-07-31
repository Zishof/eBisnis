/**
 * Pemetaan akuntansi kesehatan.
 *
 * Aturannya ada di `health-accounting.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak pernah membuat jurnal.** Ia menyimpan pemetaan, memeriksa
 * kelengkapannya, dan melaporkan kesiapannya. Jurnalnya milik mesin akuntansi
 * bersama; membangun buku besar kedua akan menghasilkan dua neraca yang tidak
 * pernah cocok, dan dua-duanya akan tampak benar.
 *
 * Yang menentukan bentuknya: **laporan kesiapan memisahkan pekerjaan kami dari
 * yang menunggu Core.** Laporan yang menyatukan keduanya akan membuat orang
 * menghabiskan pekan mencoba mengerjakan hal yang memang tidak dapat
 * dikerjakannya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  GOLONGAN_PERAN,
  PERISTIWA,
  bolehPasangAturan,
  bolehTautkanAkun,
  hitungSelisihKlaim,
  kesiapanMenjurnal,
  periksaProfilAkun,
  type PeranAkun,
  type PeristiwaKesehatan,
} from './health-accounting';

/**
 * Kode peristiwa `HEALTH_*` yang sudah diterima mesin akuntansi bersama.
 *
 * Kosong, dan itu memang keadaannya. Permintaannya sudah diajukan lewat
 * `docs/integration-requests/health/001` dan belum terjawab. Mengisinya dengan
 * tebakan akan membuat laporan kesiapan berkata siap sementara jurnalnya tidak
 * akan pernah terbentuk.
 */
const PERISTIWA_DITERIMA_CORE: string[] = [];

@Injectable()
export class HealthAccountingService {
  private readonly logger = new Logger(HealthAccountingService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Profil ----------------------------------------------------------------

  async buatProfil(
    schema: string,
    input: {
      facilityId: string;
      name: string;
      legalEntityId?: string | null;
      enabledEvents?: PeristiwaKesehatan[];
    },
    actorUserId: string,
  ) {
    const dikenal = new Set(PERISTIWA.map((p) => p.event));
    const tidakDikenal = (input.enabledEvents ?? []).filter((e) => !dikenal.has(e));
    if (tidakDikenal.length) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Peristiwa tidak dikenal: ${tidakDikenal.join(', ')}.`,
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_accounting_profile
         (facility_id, legal_entity_id, name, enabled_events, created_by)
       VALUES ($1,$2,$3,$4::varchar[],$5)
       RETURNING id::text AS id`,
      [
        input.facilityId,
        input.legalEntityId ?? null,
        input.name,
        input.enabledEvents ?? [],
        actorUserId,
      ],
    );
    return { id: rows[0].id, facilityId: input.facilityId };
  }

  /** Templat bagan akun kesehatan beserta peran dan saldo normalnya. */
  async templatCoa(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT role, suggested_code, name, account_group, normal_balance, note
         FROM "${schema}".health_coa_template
        ORDER BY sort_order, role`,
    );
  }

  // --- Penautan akun ---------------------------------------------------------

  /**
   * Menautkan satu peran akun ke akun sungguhan milik Core.
   *
   * Saldo normalnya diperiksa lebih dahulu. Basis data memeriksanya pula lewat
   * trigger — layanan ini hanya memberi pesan yang dapat dikerjakan.
   */
  async tautkanAkun(
    schema: string,
    profileId: string,
    input: { role: PeranAkun; accountId: string; note?: string | null },
    actorUserId: string,
  ) {
    const akun = await this.tenantDb.query<{
      code: string;
      normal_balance: 'DEBIT' | 'CREDIT';
      allow_posting: boolean;
      is_active: boolean;
    }>(
      schema,
      `SELECT code, normal_balance, allow_posting, is_active
         FROM "${schema}".chart_of_account
        WHERE id = $1 AND deleted_at IS NULL`,
      [input.accountId],
    );
    if (!akun.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun tidak ditemukan.');

    const izin = bolehTautkanAkun({
      role: input.role,
      accountNormalBalance: akun[0].normal_balance,
      accountAllowsPosting: akun[0].allow_posting,
      accountIsActive: akun[0].is_active,
    });
    if (!izin.allowed) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        izin.message ?? 'Penautan akun ditolak.',
        { role: input.role, accountCode: akun[0].code },
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_account_link (profile_id, role, account_id, note, linked_by)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (profile_id, role) DO UPDATE SET
         account_id = EXCLUDED.account_id, note = EXCLUDED.note,
         linked_by = EXCLUDED.linked_by, linked_at = now(),
         version = "${schema}".health_account_link.version + 1
       RETURNING id::text AS id`,
      [profileId, input.role, input.accountId, input.note ?? null, actorUserId],
    );
    return { id: rows[0].id, role: input.role, accountCode: akun[0].code };
  }

  // --- Aturan ----------------------------------------------------------------

  async pasangAturan(
    schema: string,
    profileId: string,
    input: {
      eventCode: PeristiwaKesehatan;
      debitRole?: PeranAkun | 'BY_SERVICE';
      creditRole?: PeranAkun | 'BY_SERVICE';
      amountKey?: string;
    },
    actorUserId: string,
  ) {
    const bawaan = PERISTIWA.find((p) => p.event === input.eventCode);
    if (!bawaan) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Peristiwa ${input.eventCode} tidak dikenal.`,
      );
    }

    const debit = input.debitRole ?? bawaan.debit;
    const kredit = input.creditRole ?? bawaan.credit;
    const izin = bolehPasangAturan({ event: input.eventCode, debitRole: debit, creditRole: kredit });
    if (!izin.allowed) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.message ?? 'Aturan ditolak.');
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_accounting_rule
         (profile_id, event_code, debit_role, credit_role, amount_key, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (profile_id, event_code) WHERE effective_to IS NULL
       DO UPDATE SET debit_role = EXCLUDED.debit_role,
                     credit_role = EXCLUDED.credit_role,
                     amount_key = EXCLUDED.amount_key,
                     created_by = EXCLUDED.created_by,
                     version = "${schema}".health_accounting_rule.version + 1
       RETURNING id::text AS id`,
      [profileId, input.eventCode, debit, kredit, input.amountKey ?? bawaan.amountKey, actorUserId],
    );
    return { id: rows[0].id, eventCode: input.eventCode, debitRole: debit, creditRole: kredit };
  }

  /**
   * Menyemai seluruh aturan bawaan sekaligus.
   *
   * Bawaannya benar untuk sebagian besar rumah sakit, dan yang membiarkan peta
   * kosong karena mengisinya satu per satu terlalu lama akan berakhir dengan
   * peta kosong.
   */
  async semaiAturanBawaan(schema: string, profileId: string, actorUserId: string) {
    const profil = await this.ambilProfil(schema, profileId);
    let dibuat = 0;

    for (const p of PERISTIWA) {
      if (!profil.enabledEvents.includes(p.event)) continue;
      await this.pasangAturan(
        schema,
        profileId,
        { eventCode: p.event, debitRole: p.debit, creditRole: p.credit, amountKey: p.amountKey },
        actorUserId,
      );
      dibuat += 1;
    }

    return {
      profileId,
      created: dibuat,
      note:
        'Aturan bawaan disemai hanya bagi peristiwa yang memang dipakai fasilitas ini. ' +
        'Periksalah sebelum dipakai — bawaan yang benar bagi sebagian besar rumah sakit belum ' +
        'tentu benar bagi yang ini.',
    };
  }

  // --- Kelengkapan dan kesiapan ----------------------------------------------

  /**
   * Kelengkapan profil, beserta kesiapan menjurnal.
   *
   * Memisahkan yang **belum kami kerjakan** dari yang **menunggu Core**. Sampai
   * kode peristiwa `HEALTH_*` diterima mesin akuntansi bersama, tidak satu pun
   * peristiwa dapat dijurnal — dan itu bukan sesuatu yang dapat diselesaikan
   * sesi eMedik sendiri.
   */
  async kesiapan(schema: string, profileId: string) {
    const profil = await this.ambilProfil(schema, profileId);

    const taut = await this.tenantDb.query<{ role: string; account_id: string }>(
      schema,
      `SELECT role, account_id::text AS account_id
         FROM "${schema}".health_account_link WHERE profile_id = $1`,
      [profileId],
    );
    const linked: Partial<Record<PeranAkun, string>> = {};
    for (const t of taut) linked[t.role as PeranAkun] = t.account_id;

    const kelengkapan = periksaProfilAkun({
      linked,
      enabledEvents: profil.enabledEvents,
    });

    const siap = kesiapanMenjurnal({
      profile: kelengkapan,
      coreAcceptedEvents: PERISTIWA_DITERIMA_CORE,
      enabledEvents: profil.enabledEvents,
    });

    if (siap.waitingOnCore.length) {
      this.logger.warn(
        `Profil akuntansi ${profileId}: ${siap.waitingOnCore.length} peristiwa menunggu kode ` +
          'peristiwa HEALTH_* dari mesin akuntansi bersama.',
      );
    }

    return {
      profileId,
      linkedCount: taut.length,
      complete: kelengkapan.complete,
      missing: kelengkapan.missing,
      ...siap,
    };
  }

  /** Peta lengkap: peristiwa, peran, dan akun yang tertaut. */
  async peta(schema: string, profileId: string) {
    const baris = await this.tenantDb.query(
      schema,
      `SELECT r.event_code, r.debit_role, r.credit_role, r.amount_key,
              r.effective_from::text AS effective_from,
              d.code AS debit_account_code, d.name AS debit_account_name,
              c.code AS credit_account_code, c.name AS credit_account_name
         FROM "${schema}".health_accounting_rule r
         LEFT JOIN "${schema}".health_account_link ld
           ON ld.profile_id = r.profile_id AND ld.role = r.debit_role
         LEFT JOIN "${schema}".chart_of_account d ON d.id = ld.account_id
         LEFT JOIN "${schema}".health_account_link lc
           ON lc.profile_id = r.profile_id AND lc.role = r.credit_role
         LEFT JOIN "${schema}".chart_of_account c ON c.id = lc.account_id
        WHERE r.profile_id = $1 AND r.effective_to IS NULL
        ORDER BY r.event_code`,
      [profileId],
    );

    return {
      profileId,
      rules: baris,
      note:
        'Peta ini TIDAK menghasilkan jurnal. Ia menyatakan peristiwa apa menjadi jurnal apa; ' +
        'jurnalnya dibuat mesin akuntansi bersama.',
    };
  }

  /** Daftar peran akun beserta golongan dan saldo normalnya. */
  daftarPeran() {
    return Object.entries(GOLONGAN_PERAN).map(([role, g]) => ({
      role,
      group: g.golongan,
      normalBalance: g.normal,
    }));
  }

  /** Katalog peristiwa kesehatan beserta pemetaan bawaannya. */
  daftarPeristiwa() {
    return PERISTIWA;
  }

  // --- Selisih klaim ---------------------------------------------------------

  /**
   * Menghitung selisih klaim.
   *
   * Tidak menjurnal apa pun — ia menyatakan peristiwa apa yang **seharusnya**
   * terbentuk. Sampai kode peristiwanya diterima Core, hasilnya hanya dapat
   * dibaca manusia.
   */
  hitungSelisih(input: { submittedAmount: number; approvedAmount: number }) {
    const hasil = hitungSelisihKlaim(input);
    return {
      ...hasil,
      posted: false,
      postingNote:
        'Belum dijurnal. Kode peristiwa HEALTH_* belum diterima mesin akuntansi bersama, dan ' +
        'membuat buku besar kedua bukan jalan keluarnya.',
    };
  }

  // --- Bagian dalam ----------------------------------------------------------

  private async ambilProfil(schema: string, profileId: string) {
    const rows = await this.tenantDb.query<{
      facility_id: string;
      name: string;
      enabled_events: string[];
    }>(
      schema,
      `SELECT facility_id::text AS facility_id, name, enabled_events
         FROM "${schema}".health_accounting_profile WHERE id = $1`,
      [profileId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Profil akuntansi tidak ditemukan.');
    }
    return {
      facilityId: rows[0].facility_id,
      name: rows[0].name,
      enabledEvents: (rows[0].enabled_events ?? []) as PeristiwaKesehatan[],
    };
  }
}
