/**
 * Puskesmas dan Posyandu: folder keluarga, pertumbuhan anak, imunisasi,
 * cakupan program, dan kunjungan rumah.
 *
 * Aturannya ada di `health-community.ts` sebagai fungsi murni.
 *
 * Yang paling dijaga di sini: **tidak ada angka rujukan yang dikarang.** Tabel
 * WHO dimuat dari basis data; bila barisnya tidak ada, hasilnya dinyatakan
 * belum dapat dinilai. Klasifikasi stunting dipakai menentukan siapa menerima
 * bantuan pangan, dan klasifikasi karangan akan mengirim bantuan itu kepada
 * anak yang keliru sekaligus melewatkan anak yang membutuhkannya.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AUDIT_PORT, type AuditPort } from './ports';
import type { KonteksAkses } from './health-patient.service';
import {
  beratTidakNaik,
  betulkanTinggi,
  bolehImunisasi,
  caraUkurTinggi,
  hitungCakupan,
  hitungZ,
  imunisasiTertunggak,
  nilaiPertumbuhan,
  pilihRujukan,
  urutkanKunjunganRumah,
  type JadwalImunisasi,
  type JenisKelamin,
  type RujukanLms,
} from './health-community';

@Injectable()
export class HealthCommunityService {
  private readonly logger = new Logger(HealthCommunityService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    @Inject(AUDIT_PORT) private readonly audit: AuditPort,
  ) {}

  // --- Folder keluarga -------------------------------------------------------

  async buatFolder(
    schema: string,
    input: {
      facilityId: string;
      headPatientId?: string | null;
      familyCardNumber?: string | null;
      addressText?: string | null;
      rt?: string | null;
      rw?: string | null;
      village?: string | null;
      posyanduName?: string | null;
      memberPatientIds?: string[];
    },
    ctx: KonteksAkses,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const nomor = await this.nomorFolder(client, schema, input.facilityId);

      const folder = await client.query<{ id: string; folder_number: string }>(
        `INSERT INTO "${schema}".family_folder
           (facility_id, folder_number, head_patient_id, family_card_number, address_text,
            rt, rw, village, posyandu_name, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id::text AS id, folder_number`,
        [
          input.facilityId,
          nomor,
          input.headPatientId ?? null,
          input.familyCardNumber ?? null,
          input.addressText ?? null,
          input.rt ?? null,
          input.rw ?? null,
          input.village ?? null,
          input.posyanduName ?? null,
          ctx.actorUserId,
        ],
      );

      const anggota = [
        ...new Set([
          ...(input.headPatientId ? [input.headPatientId] : []),
          ...(input.memberPatientIds ?? []),
        ]),
      ];
      const gagal: string[] = [];
      for (const p of anggota) {
        try {
          await client.query(
            `INSERT INTO "${schema}".family_member
               (family_folder_id, patient_id, relationship, joined_at)
             VALUES ($1,$2,$3,CURRENT_DATE)`,
            [folder.rows[0].id, p, p === input.headPatientId ? 'HEAD' : 'OTHER'],
          );
        } catch (e) {
          /*
           * Indeks unik menahan satu orang menjadi anggota aktif pada dua
           * folder. Yang gagal dilaporkan namanya, bukan menggagalkan seluruh
           * pembuatan folder — petugas yang folder keluarganya batal karena
           * satu anggota sudah terdaftar di tempat lain akan mengetik ulang
           * semuanya.
           */
          if ((e as { code?: string }).code === '23505') gagal.push(p);
          else throw e;
        }
      }

      return {
        id: folder.rows[0].id,
        folderNumber: folder.rows[0].folder_number,
        memberCount: anggota.length - gagal.length,
        alreadyInAnotherFolder: gagal,
      };
    });
  }

  /** Anggota folder beserta keadaan gizi dan imunisasi terakhirnya. */
  async isiFolder(schema: string, folderId: string, ctx: KonteksAkses) {
    const folder = await this.tenantDb.query<{ facility_id: string }>(
      schema,
      `SELECT facility_id::text AS facility_id FROM "${schema}".family_folder
        WHERE id = $1 AND deleted_at IS NULL`,
      [folderId],
    );
    if (!folder.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Folder keluarga tidak ditemukan.');

    const anggota = await this.tenantDb.query(
      schema,
      `SELECT m.id::text AS id, m.relationship, m.joined_at::text AS joined_at,
              p.id::text AS patient_id, p.full_name, p.birth_date::text AS birth_date, p.gender,
              g.haz_status, g.whz_status, g.waz_status,
              g.measured_at::text AS last_measured_at, g.weight_flat_count
         FROM "${schema}".family_member m
         JOIN "${schema}".patient p ON p.id = m.patient_id
         LEFT JOIN LATERAL (
           SELECT haz_status, whz_status, waz_status, measured_at, weight_flat_count
             FROM "${schema}".growth_measurement
            WHERE patient_id = m.patient_id ORDER BY measured_at DESC LIMIT 1
         ) g ON TRUE
        WHERE m.family_folder_id = $1 AND m.left_at IS NULL
        ORDER BY m.relationship, p.birth_date`,
      [folderId],
    );

    for (const a of anggota as Array<{ patient_id: string }>) {
      await this.audit.recordAccess(schema, {
        patientId: a.patient_id,
        facilityId: folder[0].facility_id,
        actorUserId: ctx.actorUserId,
        purposeOfUse: ctx.purposeOfUse,
        action: 'READ',
        entityType: 'family_folder',
        entityId: folderId,
      });
    }

    return { id: folderId, members: anggota };
  }

  // --- Pertumbuhan -----------------------------------------------------------

  /**
   * Mencatat pengukuran pertumbuhan dan menilainya.
   *
   * Penilaiannya dilakukan di sini dan **disimpan**. Tabel rujukan akan
   * diperbarui ketika WHO menerbitkan versi baru; pengukuran tahun lalu harus
   * tetap dapat dijelaskan dengan rujukan tahun lalu.
   */
  async catatPertumbuhan(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      familyFolderId?: string | null;
      weightKg?: number | null;
      heightCm?: number | null;
      heightMeasuredAs?: 'RECUMBENT' | 'STANDING' | null;
      headCircumferenceCm?: number | null;
      muacCm?: number | null;
      posyanduName?: string | null;
      note?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const pasien = await this.tenantDb.query<{ birth_date: string | null; gender: string | null }>(
      schema,
      `SELECT birth_date::text, gender FROM "${schema}".patient
        WHERE id = $1 AND deleted_at IS NULL`,
      [input.patientId],
    );
    if (!pasien.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');

    if (!pasien[0].birth_date) {
      /*
       * Tanpa tanggal lahir, umur tidak diketahui — dan seluruh penilaian
       * pertumbuhan bergantung umur. Menaksirnya akan menghasilkan klasifikasi
       * stunting yang salah pada anak yang justru paling sulit diidentifikasi.
       */
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tanggal lahir anak belum tercatat. Seluruh penilaian pertumbuhan bergantung umur; ' +
          'menaksirnya akan menghasilkan klasifikasi yang salah.',
      );
    }

    const sex = pasien[0].gender as JenisKelamin | null;
    const lahir = Date.parse(pasien[0].birth_date);
    const umurBulan = (Date.now() - lahir) / (30.4375 * 86_400_000);

    // Pembetulan cara pengukuran tinggi, bila perlu.
    let tinggi = input.heightCm ?? null;
    const tinggiAsli = input.heightCm ?? null;
    let dibetulkan = false;
    let catatanTinggi: string | undefined;
    if (tinggi != null) {
      if (!input.heightMeasuredAs) {
        throw AppError.unprocessable(
          ErrorCodes.VALIDATION_FAILED,
          'Cara pengukuran tinggi wajib disebutkan: berbaring atau berdiri. Keduanya ' +
            `berselisih sekitar 0,7 cm, dan pada umur ${umurBulan.toFixed(0)} bulan seharusnya ` +
            `${caraUkurTinggi(umurBulan) === 'RECUMBENT' ? 'berbaring' : 'berdiri'}.`,
        );
      }
      const betul = betulkanTinggi({
        value: tinggi,
        measuredAs: input.heightMeasuredAs,
        ageMonths: umurBulan,
      });
      tinggi = betul.value;
      dibetulkan = betul.adjusted;
      catatanTinggi = betul.note;
    }

    const rujukan = await this.muatRujukan(schema);
    const sumber = rujukan[0]?.source ?? null;

    const nilai = (
      indicator: RujukanLms['indicator'],
      value: number | null,
      x: number | null,
    ) => {
      if (value == null || x == null || !sex) return nilaiPertumbuhan(indicator, null);
      const r = pilihRujukan(rujukan.map((x2) => x2.lms), { indicator, sex, x });
      return nilaiPertumbuhan(indicator, r ? hitungZ(value, r) : null);
    };

    const waz = nilai('WEIGHT_FOR_AGE', input.weightKg ?? null, umurBulan);
    const haz = nilai('HEIGHT_FOR_AGE', tinggi, umurBulan);
    const whz = nilai('WEIGHT_FOR_HEIGHT', input.weightKg ?? null, tinggi);

    // Riwayat penimbangan untuk penanda "berat tidak naik".
    const riwayat = await this.tenantDb.query<{ measured_at: string; weight_kg: string | null }>(
      schema,
      `SELECT measured_at::text AS measured_at, weight_kg::text AS weight_kg
         FROM "${schema}".growth_measurement
        WHERE patient_id = $1 AND weight_kg IS NOT NULL
        ORDER BY measured_at DESC LIMIT 5`,
      [input.patientId],
    );
    const timbangan = [
      ...riwayat.map((r) => ({ measuredAt: r.measured_at, weightKg: Number(r.weight_kg) })),
      ...(input.weightKg != null
        ? [{ measuredAt: new Date().toISOString(), weightKg: input.weightKg }]
        : []),
    ];
    const datar = beratTidakNaik(timbangan);

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".growth_measurement
         (patient_id, facility_id, family_folder_id, measured_by, posyandu_name, age_months,
          weight_kg, height_cm, height_measured_as, height_raw_cm, height_adjusted,
          head_circumference_cm, muac_cm, waz, haz, whz,
          waz_status, haz_status, whz_status, reference_source, weight_flat_count, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING id::text AS id`,
      [
        input.patientId,
        input.facilityId,
        input.familyFolderId ?? null,
        ctx.actorUserId,
        input.posyanduName ?? null,
        Number(umurBulan.toFixed(2)),
        input.weightKg ?? null,
        tinggi,
        input.heightMeasuredAs ?? null,
        tinggiAsli,
        dibetulkan,
        input.headCircumferenceCm ?? null,
        input.muacCm ?? null,
        waz.z,
        haz.z,
        whz.z,
        waz.status,
        haz.status,
        whz.status,
        sumber,
        datar.consecutive,
        input.note ?? null,
      ],
    );

    if (haz.actionable || whz.actionable || datar.flat) {
      this.logger.warn(
        `Pengukuran ${rows[0].id}: ${haz.status}/${whz.status}` +
          (datar.flat ? `, berat tidak naik ${datar.consecutive} kali` : ''),
      );
    }

    await this.audit.recordAccess(schema, {
      patientId: input.patientId,
      facilityId: input.facilityId,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'growth_measurement',
      entityId: rows[0].id,
    });

    return {
      id: rows[0].id,
      ageMonths: Number(umurBulan.toFixed(2)),
      heightAdjusted: dibetulkan,
      heightNote: catatanTinggi ?? null,
      weightForAge: waz,
      heightForAge: haz,
      weightForHeight: whz,
      weightFlat: datar,
      referenceSource: sumber,
      /*
       * Bila tabel rujukannya belum disemai, ia disebutkan dengan jelas. Layar
       * yang menampilkan "belum dapat dinilai" tanpa menyebut sebabnya akan
       * dianggap rusak, dan kader akan berhenti memakainya.
       */
      referenceMissing: !rujukan.length,
    };
  }

  /** Riwayat pertumbuhan seorang anak. */
  async riwayatPertumbuhan(schema: string, patientId: string, ctx: KonteksAkses) {
    const rows = await this.tenantDb.query(
      schema,
      `SELECT id::text AS id, measured_at::text AS measured_at, age_months::float8 AS age_months,
              weight_kg::float8 AS weight_kg, height_cm::float8 AS height_cm,
              height_measured_as, height_adjusted,
              waz::float8 AS waz, haz::float8 AS haz, whz::float8 AS whz,
              waz_status, haz_status, whz_status, weight_flat_count, posyandu_name
         FROM "${schema}".growth_measurement
        WHERE patient_id = $1
        ORDER BY measured_at
        LIMIT 200`,
      [patientId],
    );

    await this.audit.recordAccess(schema, {
      patientId,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'growth_measurement',
      entityId: null,
    });

    return rows;
  }

  // --- Imunisasi -------------------------------------------------------------

  /** Jadwal imunisasi seorang anak: yang sudah, yang boleh, dan yang tertunggak. */
  async statusImunisasi(schema: string, patientId: string, ctx: KonteksAkses) {
    const pasien = await this.tenantDb.query<{ birth_date: string | null }>(
      schema,
      `SELECT birth_date::text FROM "${schema}".patient WHERE id = $1 AND deleted_at IS NULL`,
      [patientId],
    );
    if (!pasien.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');
    if (!pasien[0].birth_date) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tanggal lahir belum tercatat; jadwal imunisasi tidak dapat dihitung.',
      );
    }

    const jadwal = await this.muatJadwal(schema);
    const diberikan = await this.tenantDb.query<{
      vaccine_code: string;
      dose_number: number;
      given_at: string;
      batch_number: string | null;
    }>(
      schema,
      `SELECT vaccine_code, dose_number, given_at::text AS given_at, batch_number
         FROM "${schema}".immunization_record WHERE patient_id = $1
        ORDER BY given_at`,
      [patientId],
    );

    const hariIni = new Date().toISOString().slice(0, 10);
    const tertunggak = imunisasiTertunggak({
      jadwal,
      birthDate: pasien[0].birth_date,
      today: hariIni,
      given: diberikan.map((d) => ({ vaccineCode: d.vaccine_code, doseNumber: d.dose_number })),
    });

    const berikutnya = jadwal
      .filter(
        (j) =>
          !diberikan.some((d) => d.vaccine_code === j.vaccineCode && d.dose_number === j.doseNumber),
      )
      .map((j) => ({
        ...j,
        verdict: bolehImunisasi({
          jadwal: j,
          birthDate: pasien[0].birth_date as string,
          today: hariIni,
          previousDoses: diberikan
            .filter((d) => d.vaccine_code === j.vaccineCode)
            .map((d) => ({ doseNumber: d.dose_number, givenAt: d.given_at })),
        }),
      }));

    await this.audit.recordAccess(schema, {
      patientId,
      facilityId: ctx.facilityId ?? null,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'immunization_record',
      entityId: null,
    });

    return {
      given: diberikan,
      overdue: tertunggak,
      upcoming: berikutnya,
      /** Yang boleh diberikan hari ini. Layar Posyandu memakai ini langsung. */
      dueToday: berikutnya.filter((b) => b.verdict.allowed),
    };
  }

  /**
   * Mencatat pemberian imunisasi.
   *
   * Yang terlalu cepat DITOLAK, bukan diperingatkan. Vaksin sebelum umur
   * minimum tidak membentuk kekebalan yang cukup, dan yang lebih berbahaya, ia
   * akan tercatat sebagai diberikan — anak itu lalu tampak lengkap di laporan
   * cakupan dan tidak akan dikejar siapa pun.
   */
  async catatImunisasi(
    schema: string,
    input: {
      patientId: string;
      facilityId: string;
      vaccineCode: string;
      doseNumber: number;
      batchNumber?: string | null;
      expiryDate?: string | null;
      site?: string | null;
      posyanduName?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const pasien = await this.tenantDb.query<{ birth_date: string | null }>(
      schema,
      `SELECT birth_date::text FROM "${schema}".patient WHERE id = $1 AND deleted_at IS NULL`,
      [input.patientId],
    );
    if (!pasien.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pasien tidak ditemukan.');
    if (!pasien[0].birth_date) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Tanggal lahir belum tercatat; umur minimum vaksin tidak dapat diperiksa.',
      );
    }

    const jadwal = (await this.muatJadwal(schema)).find(
      (j) => j.vaccineCode === input.vaccineCode && j.doseNumber === input.doseNumber,
    );
    if (!jadwal) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        `${input.vaccineCode} dosis ke-${input.doseNumber} tidak ada pada jadwal imunisasi.`,
      );
    }

    const sebelumnya = await this.tenantDb.query<{ dose_number: number; given_at: string }>(
      schema,
      `SELECT dose_number, given_at::text AS given_at FROM "${schema}".immunization_record
        WHERE patient_id = $1 AND vaccine_code = $2`,
      [input.patientId, input.vaccineCode],
    );

    const hariIni = new Date().toISOString().slice(0, 10);
    const izin = bolehImunisasi({
      jadwal,
      birthDate: pasien[0].birth_date,
      today: hariIni,
      previousDoses: sebelumnya.map((d) => ({ doseNumber: d.dose_number, givenAt: d.given_at })),
    });
    if (!izin.allowed) {
      const status = izin.reason === 'ALREADY_GIVEN' ? 'conflict' : 'unprocessable';
      const galat =
        status === 'conflict'
          ? AppError.conflict(ErrorCodes.CONFLICT, izin.message ?? 'Sudah diberikan.')
          : AppError.unprocessable(
              ErrorCodes.VALIDATION_FAILED,
              izin.message ?? 'Imunisasi ditolak.',
              { reason: izin.reason, earliestDate: izin.earliestDate },
            );
      throw galat;
    }

    const umurHari = Math.floor(
      (Date.parse(hariIni) - Date.parse(pasien[0].birth_date)) / 86_400_000,
    );

    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".immunization_record
         (patient_id, facility_id, vaccine_code, dose_number, given_by, age_days_at_dose,
          batch_number, expiry_date, site, route, posyandu_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id::text AS id`,
      [
        input.patientId,
        input.facilityId,
        input.vaccineCode,
        input.doseNumber,
        ctx.actorUserId,
        umurHari,
        input.batchNumber ?? null,
        input.expiryDate ?? null,
        input.site ?? jadwal.vaccineCode,
        null,
        input.posyanduName ?? null,
      ],
    );

    await this.audit.recordAccess(schema, {
      patientId: input.patientId,
      facilityId: input.facilityId,
      actorUserId: ctx.actorUserId,
      purposeOfUse: ctx.purposeOfUse,
      action: 'READ',
      entityType: 'immunization_record',
      entityId: rows[0].id,
    });

    return { id: rows[0].id, vaccineCode: input.vaccineCode, doseNumber: input.doseNumber };
  }

  // --- Cakupan dan kunjungan rumah -------------------------------------------

  /** Cakupan program beserta kekurangannya. */
  async cakupan(schema: string, facilityId: string, year: number, month?: number) {
    const rows = await this.tenantDb.query<{
      id: string;
      program_code: string;
      program_name: string;
      village: string | null;
      target_count: number;
      achieved_count: number;
      period_year: number;
      period_month: number | null;
    }>(
      schema,
      `SELECT id::text AS id, program_code, program_name, village,
              target_count, achieved_count, period_year, period_month
         FROM "${schema}".community_program_target
        WHERE facility_id = $1 AND period_year = $2
          AND ($3::int IS NULL OR period_month = $3)
        ORDER BY program_code, village NULLS FIRST`,
      [facilityId, year, month ?? null],
    );

    return rows.map((r) => ({
      ...r,
      ...hitungCakupan({ target: r.target_count, achieved: r.achieved_count }),
    }));
  }

  /**
   * Daftar anak yang perlu dikunjungi ke rumah.
   *
   * Diurutkan menurut apa yang paling mendesak. Kader yang punya waktu untuk
   * lima kunjungan hari ini harus tahu lima siapa — daftar seratus nama yang
   * tidak berurutan sama saja dengan tidak ada daftar.
   */
  async daftarKunjungan(schema: string, facilityId: string, limit = 50) {
    const rows = await this.tenantDb.query<{
      patient_id: string;
      full_name: string;
      birth_date: string | null;
      family_folder_id: string | null;
      folder_number: string | null;
      village: string | null;
      rt: string | null;
      rw: string | null;
      haz_status: string | null;
      whz_status: string | null;
      weight_flat_count: number | null;
      last_measured_at: string | null;
    }>(
      schema,
      `SELECT DISTINCT ON (g.patient_id)
              g.patient_id::text AS patient_id, p.full_name, p.birth_date::text AS birth_date,
              g.family_folder_id::text AS family_folder_id, f.folder_number, f.village, f.rt, f.rw,
              g.haz_status, g.whz_status, g.weight_flat_count,
              g.measured_at::text AS last_measured_at
         FROM "${schema}".growth_measurement g
         JOIN "${schema}".patient p ON p.id = g.patient_id
         LEFT JOIN "${schema}".family_folder f ON f.id = g.family_folder_id
        WHERE g.facility_id = $1
        ORDER BY g.patient_id, g.measured_at DESC`,
      [facilityId],
    );

    const jadwal = await this.muatJadwal(schema);
    const hariIni = new Date().toISOString().slice(0, 10);

    const diperkaya = await Promise.all(
      rows.map(async (r) => {
        let tertunggak = 0;
        if (r.birth_date) {
          const diberikan = await this.tenantDb.query<{ vaccine_code: string; dose_number: number }>(
            schema,
            `SELECT vaccine_code, dose_number FROM "${schema}".immunization_record
              WHERE patient_id = $1`,
            [r.patient_id],
          );
          const daftar = imunisasiTertunggak({
            jadwal,
            birthDate: r.birth_date,
            today: hariIni,
            given: diberikan.map((d) => ({
              vaccineCode: d.vaccine_code,
              doseNumber: d.dose_number,
            })),
          });
          tertunggak = daftar[0]?.overdueDays ?? 0;
        }
        return {
          ...r,
          severelyWasted: r.whz_status === 'SEVERELY_WASTED',
          wasted: r.whz_status === 'WASTED',
          stunted: r.haz_status === 'STUNTED' || r.haz_status === 'SEVERELY_STUNTED',
          weightFlat: (r.weight_flat_count ?? 0) >= 2,
          overdueDays: tertunggak,
        };
      }),
    );

    return urutkanKunjunganRumah(diperkaya)
      .filter((r) => r.severelyWasted || r.wasted || r.stunted || r.weightFlat || r.overdueDays > 0)
      .slice(0, limit);
  }

  /** Mencatat kunjungan rumah. */
  async catatKunjungan(
    schema: string,
    input: {
      familyFolderId: string;
      facilityId: string;
      patientId?: string | null;
      reason: string;
      findings?: string | null;
      actionTaken?: string | null;
      referredTo?: string | null;
    },
    ctx: KonteksAkses,
  ) {
    const rows = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".home_visit
         (family_folder_id, patient_id, facility_id, visited_by, reason, findings,
          action_taken, referred, referred_to)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id::text AS id`,
      [
        input.familyFolderId,
        input.patientId ?? null,
        input.facilityId,
        ctx.actorUserId,
        input.reason,
        input.findings ?? null,
        input.actionTaken ?? null,
        Boolean(input.referredTo),
        input.referredTo ?? null,
      ],
    );
    return { id: rows[0].id };
  }

  // --- Bagian dalam ----------------------------------------------------------

  /**
   * Memuat tabel rujukan WHO dari basis data.
   *
   * Dimuat seluruhnya sekali per pengukuran. Tabel lengkapnya beberapa ribu
   * baris — kecil untuk memori, dan memuat ulang per indikator akan menghasilkan
   * tiga perjalanan ke basis data untuk satu penimbangan bayi.
   */
  private async muatRujukan(
    schema: string,
  ): Promise<Array<{ lms: RujukanLms; source: string }>> {
    const rows = await this.tenantDb.query<{
      indicator: string;
      sex: string;
      x_value: string;
      l_value: string;
      m_value: string;
      s_value: string;
      source: string;
    }>(
      schema,
      `SELECT indicator, sex, x_value::text, l_value::text, m_value::text, s_value::text, source
         FROM "${schema}".growth_reference WHERE is_active = TRUE`,
    );

    return rows.map((r) => ({
      source: r.source,
      lms: {
        indicator: r.indicator as RujukanLms['indicator'],
        sex: r.sex as JenisKelamin,
        x: Number(r.x_value),
        l: Number(r.l_value),
        m: Number(r.m_value),
        s: Number(r.s_value),
      },
    }));
  }

  private async muatJadwal(schema: string): Promise<JadwalImunisasi[]> {
    const rows = await this.tenantDb.query<{
      vaccine_code: string;
      dose_number: number;
      min_age_days: number;
      min_interval_days: number | null;
      recommended_age_days: number | null;
    }>(
      schema,
      `SELECT vaccine_code, dose_number, min_age_days, min_interval_days, recommended_age_days
         FROM "${schema}".immunization_schedule WHERE is_active = TRUE
        ORDER BY recommended_age_days NULLS LAST, vaccine_code, dose_number`,
    );

    return rows.map((r) => ({
      vaccineCode: r.vaccine_code,
      doseNumber: r.dose_number,
      minAgeDays: r.min_age_days,
      minIntervalDays: r.min_interval_days,
      recommendedAgeDays: r.recommended_age_days,
    }));
  }

  private async nomorFolder(
    client: PoolClient,
    schema: string,
    facilityId: string,
  ): Promise<string> {
    const urutan = await client.query<{ n: string }>(
      `SELECT COUNT(*) + 1 AS n FROM "${schema}".family_folder WHERE facility_id = $1`,
      [facilityId],
    );
    return `KK-${String(urutan.rows[0].n).padStart(6, '0')}`;
  }
}
