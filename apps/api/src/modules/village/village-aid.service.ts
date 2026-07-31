/**
 * Program bantuan: kriteria, penyaringan, penetapan, dan penyaluran.
 *
 * ## Batas kecerdasan buatan ada pada bentuk berkas ini, bukan pada niat
 *
 * Penyaringan otomatis berhenti pada `village_aid_candidate`. Tidak ada jalan
 * kode dari penyaringan menuju `village_aid_beneficiary`: penetapan menuntut
 * `decided_session_id`, dan pemanggilan otomatis dari dalam sistem tidak
 * memiliki sesi. Jalan kode yang kelak mencoba menetapkan penerima tanpa
 * manusia yang masuk tidak akan gagal pada tinjauan kode — ia gagal pada
 * `NOT NULL`.
 *
 * ## Kriteria tidak pernah dieksekusi
 *
 * `criteria` diperiksa bentuknya sebelum disimpan dan dinilai oleh penafsir
 * yang hanya mengenali daftar ruas dan daftar pembanding yang tertutup. Tidak
 * ada `eval`, tidak ada `new Function`, dan tidak ada potongan kriteria yang
 * pernah menyentuh SQL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  bolehSalurkan,
  bolehTetapkanPenerima,
  deteksiTumpangTindih,
  evaluasi,
  periksaBentuk,
  ringkasJejak,
  type BentukBantuan,
  type Fakta,
  type Kondisi,
  type PenerimaanLain,
  type StatusCalon,
  type SumberUsulan,
} from './village-aid';

/** Data pendataan yang lebih tua dari ini disebutkan sebagai peringatan. */
const UMUR_DATA_PERINGATAN_HARI = 730;

@Injectable()
export class VillageAidService {
  private readonly logger = new Logger(VillageAidService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Program --------------------------------------------------------------

  async susunProgram(
    schemaName: string,
    input: {
      code: string;
      name: string;
      aidCategory: string;
      fiscalYear: number;
      periodStart: string;
      periodEnd: string;
      description?: string;
      aidForm?: BentukBantuan;
      fundingSource?: string;
      quota?: number;
      amountPerBeneficiary?: number;
      budgetLineId?: string;
      allowStacking?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PROGRAM');

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_aid_program
           (village_unit_id, code, name, description, aid_category, aid_form, funding_source,
            fiscal_year, period_start, period_end, quota, amount_per_beneficiary,
            budget_line_id, allow_stacking, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          u.id,
          input.code,
          input.name,
          input.description ?? null,
          input.aidCategory,
          input.aidForm ?? 'UANG',
          input.fundingSource ?? 'APBDES',
          input.fiscalYear,
          input.periodStart,
          input.periodEnd,
          input.quota ?? null,
          input.amountPerBeneficiary ?? null,
          input.budgetLineId ?? null,
          input.allowStacking ?? false,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode program bantuan sudah dipakai.'));

    return { id: rows[0].id, status: 'DRAF' };
  }

  /**
   * Menyimpan kriteria kelayakan.
   *
   * Bentuknya diperiksa **sebelum** disimpan. Memeriksanya saat penyaringan
   * sudah terlambat: kriteria yang cacat sudah tersimpan, dan kegagalannya
   * muncul satu per satu pada tiap calon — jauh dari layar tempat kesalahannya
   * dibuat, dan tanpa petunjuk bahwa kriterianyalah yang salah.
   */
  async simpanKriteria(
    schemaName: string,
    programId: string,
    input: { name: string; criteria: unknown; note?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PROGRAM');

    const bentuk = periksaBentuk(input.criteria);
    if (!bentuk.sah) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Kriteria tidak sah: ${bentuk.kesalahan.join(' ')}`,
        { errors: bentuk.kesalahan, nodeCount: bentuk.simpul, depth: bentuk.kedalaman },
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_aid_criteria
         (village_unit_id, aid_program_id, name, criteria, node_count, depth, note, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8) RETURNING id`,
      [
        u.id,
        programId,
        input.name,
        JSON.stringify(input.criteria),
        bentuk.simpul,
        bentuk.kedalaman,
        input.note ?? null,
        user.userId,
      ],
    );

    // Kriteria lama dinonaktifkan, tidak dihapus. Pertanyaan "kriteria mana
    // yang berlaku saat penetapan tahun lalu" akan muncul, dan kriteria yang
    // dihapus tidak dapat menjawabnya.
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_aid_criteria
          SET is_active = FALSE, updated_at = now(), version = version + 1
        WHERE aid_program_id = $1 AND id <> $2 AND is_active = TRUE`,
      [programId, rows[0].id],
    );

    return { id: rows[0].id, nodeCount: bentuk.simpul, depth: bentuk.kedalaman };
  }

  // --- Penyaringan ----------------------------------------------------------

  /**
   * Menyaring calon penerima menurut kriteria yang berlaku.
   *
   * Hasilnya adalah **dugaan**, bukan temuan. Setiap calon menyimpan jejak
   * penilaiannya: ruas mana yang lulus, mana yang tidak, dan berapa nilainya.
   * Warga yang tidak masuk daftar akan bertanya mengapa, dan petugas yang tidak
   * dapat menjawabnya akan dituduh pilih kasih — di desa, tuduhan itu melekat
   * jauh lebih lama daripada bantuannya sendiri.
   */
  async saring(
    schemaName: string,
    programId: string,
    opsi: { sumber?: SumberUsulan; surveyYear?: number } = {},
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENERIMA');
    const sumber: SumberUsulan = opsi.sumber ?? 'ATURAN';

    const k = await this.tenantDb.query<{ id: string; criteria: unknown }>(
      schemaName,
      `SELECT id, criteria FROM "${schemaName}".village_aid_criteria
        WHERE aid_program_id = $1 AND is_active = TRUE
        ORDER BY created_at DESC LIMIT 1`,
      [programId],
    );
    if (!k.length) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Program ini belum memiliki kriteria kelayakan yang aktif.',
      );
    }

    // Diperiksa lagi meskipun sudah diperiksa saat disimpan. Kriteria yang
    // tersimpan sebelum pemeriksaan ini ada, atau yang masuk lewat jalan lain,
    // tidak boleh dinilai begitu saja.
    const bentuk = periksaBentuk(k[0].criteria);
    if (!bentuk.sah) {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        `Kriteria tersimpan tidak sah: ${bentuk.kesalahan.join(' ')}`,
      );
    }
    const kondisi = k[0].criteria as Kondisi;

    const tahun = opsi.surveyYear ?? new Date().getFullYear();
    const keluarga = await this.tenantDb.query<Record<string, string | null>>(
      schemaName,
      `SELECT r.id AS resident_id, f.id AS family_id, r.full_name,
              EXTRACT(YEAR FROM age(r.birth_date))::int AS usia,
              r.gender, r.marital_status, r.education, r.occupation, r.disability_type,
              t.number AS rt_number, w.number AS rw_number, a.name AS sub_area_name,
              (SELECT count(*)::int FROM "${schemaName}".village_resident m
                WHERE m.village_family_id = f.id AND m.deleted_at IS NULL) AS anggota,
              s.monthly_income::text, s.dependent_count, s.house_status, s.floor_type,
              s.floor_area_m2::text, s.water_source, s.electricity_va, s.has_motor_vehicle,
              s.has_pregnant_member, s.has_toddler, s.is_dtks_registered,
              s.surveyed_at::text,
              f.house_ownership
         FROM "${schemaName}".village_resident r
         JOIN "${schemaName}".village_family f ON f.id = r.village_family_id
    LEFT JOIN "${schemaName}".village_household_survey s
           ON s.village_family_id = f.id AND s.survey_year = $2
    LEFT JOIN "${schemaName}".village_rt t ON t.id = COALESCE(r.village_rt_id, f.village_rt_id)
    LEFT JOIN "${schemaName}".village_rw w ON w.id = t.village_rw_id
    LEFT JOIN "${schemaName}".village_sub_area a ON a.id = w.sub_area_id
        WHERE r.village_unit_id = $1 AND r.deleted_at IS NULL
          AND r.resident_status = 'TETAP'
          AND r.family_relation = 'KEPALA_KELUARGA'
          AND f.deleted_at IS NULL`,
      [u.id, tahun],
    );

    const lolos: Array<{ residentId: string; familyId: string; name: string }> = [];
    const ditolak: Array<{ name: string; sebab: string[] }> = [];
    let dataUsang = 0;
    let tanpaPendataan = 0;

    for (const baris of keluarga) {
      const fakta = susunFakta(baris);
      const hasil = evaluasi(kondisi, fakta);

      if (!baris.surveyed_at) tanpaPendataan += 1;
      else if (umurHari(baris.surveyed_at) > UMUR_DATA_PERINGATAN_HARI) dataUsang += 1;

      if (hasil.layak) {
        lolos.push({
          residentId: String(baris.resident_id),
          familyId: String(baris.family_id),
          name: String(baris.full_name),
        });
        await this.tenantDb.query(
          schemaName,
          `INSERT INTO "${schemaName}".village_aid_candidate
             (village_unit_id, aid_program_id, resident_id, family_id, source, proposed_by,
              evaluation_trace, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$6)
           ON CONFLICT (aid_program_id, resident_id) DO UPDATE
             SET evaluation_trace = EXCLUDED.evaluation_trace,
                 updated_at = now(),
                 version = village_aid_candidate.version + 1
           WHERE village_aid_candidate.status = 'DIUSULKAN'`,
          [
            u.id,
            programId,
            baris.resident_id,
            baris.family_id,
            sumber,
            // Usulan penyaringan tidak berpengusul manusia. Dikosongkan supaya
            // pemeriksaan "pengusul bukan penetap" tidak menghalangi petugas
            // yang menjalankan penyaringan lalu menetapkan hasilnya — yang
            // memeriksa bukan dia, melainkan verifikasi lapangan.
            sumber === 'MANUAL' ? user.userId : null,
            JSON.stringify({ jejak: hasil.jejak, ruasKosong: hasil.ruasKosong }),
          ],
        );
      } else {
        ditolak.push({ name: String(baris.full_name), sebab: ringkasJejak(hasil) });
      }
    }

    this.logger.log(
      `Penyaringan program ${programId} pada ${schemaName}: ${lolos.length} lolos dari ${keluarga.length} keluarga`,
    );

    return {
      screened: keluarga.length,
      eligible: lolos.length,
      rejected: ditolak.length,
      source: sumber,
      criteriaId: k[0].id,
      // Umur data disajikan bersama hasilnya, bukan disimpan diam-diam.
      // Penetapan atas data pendataan tiga tahun lalu adalah penetapan atas
      // desa yang sudah tidak ada.
      warnings: {
        withoutSurvey: tanpaPendataan,
        staleSurvey: dataUsang,
        surveyYear: tahun,
      },
      // Daftar penolakan tidak disimpan, hanya dikembalikan: ia bahan
      // pemeriksaan petugas, bukan catatan tentang warga.
      rejectedSample: ditolak.slice(0, 20),
    };
  }

  async daftarCalon(schemaName: string, programId: string, status?: StatusCalon) {
    await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENERIMA');
    return this.tenantDb.query(
      schemaName,
      `SELECT c.id, c.status, c.source, c.score, c.proposed_at, c.verified_at,
              c.verification_note, c.rejection_reason, c.evaluation_trace,
              r.full_name, r.national_id
         FROM "${schemaName}".village_aid_candidate c
         JOIN "${schemaName}".village_resident r ON r.id = c.resident_id
        WHERE c.aid_program_id = $1
          AND ($2::varchar IS NULL OR c.status = $2::varchar)
        ORDER BY c.status, r.full_name`,
      [programId, status ?? null],
    );
  }

  async verifikasi(
    schemaName: string,
    candidateId: string,
    input: { note: string; hasil: 'LAYAK' | 'TIDAK_LAYAK' },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENERIMA');

    if (!input.note?.trim() || input.note.trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Catatan verifikasi wajib diuraikan. Kunjungan yang tidak meninggalkan catatan tidak ' +
          'dapat dibedakan dari kunjungan yang tidak pernah terjadi.',
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const c = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_aid_candidate
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [candidateId, u.id],
      );
      if (!c.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Calon tidak ditemukan.');
      if (c.rows[0].status !== 'DIUSULKAN') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Calon berstatus ${c.rows[0].status} dan tidak dapat diverifikasi lagi.`,
        );
      }

      const status = input.hasil === 'LAYAK' ? 'DIVERIFIKASI' : 'DITOLAK';
      await client.query(
        `UPDATE "${schemaName}".village_aid_candidate
            SET status = $2, verified_by = $3, verified_at = now(),
                verification_note = $4,
                rejection_reason = CASE WHEN $2 = 'DITOLAK' THEN $4 ELSE rejection_reason END,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [candidateId, status, user.userId, input.note],
      );

      return { id: candidateId, status };
    });
  }

  // --- Penetapan ------------------------------------------------------------

  /**
   * Menetapkan calon menjadi penerima.
   *
   * Lima hal ditahan di sini, dan seluruhnya berasal dari cara bantuan desa
   * benar-benar disalahgunakan: penetapan oleh sistem, pengusul yang menetapkan
   * usulannya sendiri, penetapan tanpa verifikasi lapangan, penetapan tanpa
   * dasar yang diuraikan, dan bantuan sejenis yang berganda.
   *
   * Yang terakhir juga ditahan indeks unik parsial: dua petugas yang menetapkan
   * warga yang sama pada dua program secara bersamaan akan sama-sama lolos
   * pemeriksaan layanan.
   */
  async tetapkan(
    schemaName: string,
    candidateId: string,
    input: { decisionBasis: string; decisionNumber?: string; entitlementAmount?: number },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENERIMA');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const c = await client.query<Record<string, string | boolean | number | null>>(
        `SELECT c.id, c.status, c.source, c.proposed_by, c.resident_id, c.aid_program_id,
                p.aid_category, p.fiscal_year, p.allow_stacking, p.period_start::text,
                p.period_end::text, p.amount_per_beneficiary::text, p.quota, p.status AS program_status
           FROM "${schemaName}".village_aid_candidate c
           JOIN "${schemaName}".village_aid_program p ON p.id = c.aid_program_id
          WHERE c.id = $1 AND c.village_unit_id = $2
          FOR UPDATE OF c`,
        [candidateId, u.id],
      );
      if (!c.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Calon tidak ditemukan.');
      const row = c.rows[0];

      if (row.program_status === 'DIBATALKAN') {
        throw AppError.conflict(ErrorCodes.CONFLICT, 'Program bantuan ini sudah dibatalkan.');
      }

      const v = bolehTetapkanPenerima({
        status: row.status as StatusCalon,
        sumber: row.source as SumberUsulan,
        diusulkanOleh: (row.proposed_by as string | null) ?? null,
        // Selalu MANUSIA: endpoint ini menuntut sesi pengguna, dan
        // `decided_session_id` di bawah tidak dapat diisi tanpa sesi.
        // Cabang AI pada aturannya tetap ada sebagai penjaga — jalan kode yang
        // kelak menetapkan penerima secara otomatis harus menyatakannya, dan
        // pengujian memberitahunya apa yang terjadi.
        penetap: { userId: user.userId, jenis: 'MANUSIA' },
        dasarPenetapan: input.decisionBasis,
      });
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      // Bantuan sejenis dari jalur lain.
      const lain = await client.query<Record<string, string>>(
        `SELECT b.aid_program_id AS "programId", p.name AS "programName",
                b.aid_category AS "aidCategory",
                p.period_start::text AS "periodStart", p.period_end::text AS "periodEnd"
           FROM "${schemaName}".village_aid_beneficiary b
           JOIN "${schemaName}".village_aid_program p ON p.id = b.aid_program_id
          WHERE b.resident_id = $1 AND b.status = 'AKTIF'`,
        [row.resident_id],
      );
      const tumpang = deteksiTumpangTindih(
        {
          id: String(row.aid_program_id),
          aidCategory: String(row.aid_category),
          periodStart: String(row.period_start),
          periodEnd: String(row.period_end),
          bolehBertumpuk: Boolean(row.allow_stacking),
        },
        lain.rows as unknown as PenerimaanLain[],
      );
      if (tumpang.bentrok) {
        throw AppError.conflict(ErrorCodes.CONFLICT, tumpang.alasan!, {
          conflicts: tumpang.penerimaanBentrok.map((b) => b.programName),
        });
      }

      if (row.quota != null) {
        const n = await client.query<{ n: string }>(
          `SELECT count(*)::text AS n FROM "${schemaName}".village_aid_beneficiary
            WHERE aid_program_id = $1 AND status = 'AKTIF'`,
          [row.aid_program_id],
        );
        if (Number(n.rows[0].n) >= Number(row.quota)) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Kuota program sudah penuh (${row.quota} penerima). Tambah kuotanya melalui ` +
              'perubahan program, agar penambahan penerima tetap ada dasarnya.',
          );
        }
      }

      const b = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_aid_beneficiary
             (village_unit_id, aid_program_id, candidate_id, resident_id, aid_category,
              fiscal_year, allow_stacking, decided_by, decided_session_id, decision_basis,
              decision_number, entitlement_amount, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$8) RETURNING id`,
          [
            u.id,
            row.aid_program_id,
            candidateId,
            row.resident_id,
            row.aid_category,
            row.fiscal_year,
            row.allow_stacking,
            user.userId,
            user.sessionId,
            input.decisionBasis,
            input.decisionNumber ?? null,
            input.entitlementAmount ?? row.amount_per_beneficiary ?? null,
          ],
        )
        .catch(
          terjemahkanBentrok(
            'Warga ini sudah ditetapkan menerima bantuan sejenis pada tahun anggaran ini. ' +
              'Bila penumpukan memang dikehendaki, nyatakan pada rancangan programnya.',
          ),
        );

      await client.query(
        `UPDATE "${schemaName}".village_aid_candidate
            SET status = 'DITETAPKAN', updated_at = now(), version = version + 1
          WHERE id = $1`,
        [candidateId],
      );

      return { id: b.rows[0].id, status: 'AKTIF' };
    });
  }

  // --- Penyaluran -----------------------------------------------------------

  async salurkan(
    schemaName: string,
    input: {
      beneficiaryId: string;
      installmentNo?: number;
      amount: number;
      distributedAt?: string;
      receivedBy?: 'PENERIMA' | 'KUASA';
      proxyName?: string;
      proxyRelation?: string;
      receiptReference?: string;
      itemDescription?: string;
      note?: string;
    },
    idempotencyKey: string,
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENYALURAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const sudah = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_aid_distribution WHERE idempotency_key = $1`,
        [idempotencyKey],
      );
      if (sudah.rows.length) return { id: sudah.rows[0].id, duplicate: true };

      const b = await client.query<Record<string, string>>(
        `SELECT b.id, b.status, b.aid_program_id, p.aid_form
           FROM "${schemaName}".village_aid_beneficiary b
           JOIN "${schemaName}".village_aid_program p ON p.id = b.aid_program_id
          WHERE b.id = $1 AND b.village_unit_id = $2 FOR UPDATE OF b`,
        [input.beneficiaryId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Penerima tidak ditemukan.');
      if (b.rows[0].status !== 'AKTIF') {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          b.rows[0].status === 'DICABUT'
            ? 'Penetapan penerima ini sudah dicabut; penyaluran tidak dapat dilanjutkan.'
            : 'Penerima ini sudah selesai menerima bantuan programnya.',
        );
      }

      const bentuk = b.rows[0].aid_form as BentukBantuan;
      const v = bolehSalurkan({
        statusPenerima: 'DITETAPKAN',
        bentuk,
        nilai: input.amount,
        diterimaOleh: input.receivedBy ?? 'PENERIMA',
        namaPenerimaKuasa: input.proxyName,
        buktiTerima: input.receiptReference,
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

      const d = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_aid_distribution
             (village_unit_id, aid_program_id, beneficiary_id, installment_no, distributed_at,
              aid_form, amount, item_description, received_by, proxy_name, proxy_relation,
              receipt_reference, distributed_by, idempotency_key, note, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$13) RETURNING id`,
          [
            u.id,
            b.rows[0].aid_program_id,
            input.beneficiaryId,
            input.installmentNo ?? 1,
            input.distributedAt ?? new Date().toISOString().slice(0, 10),
            bentuk,
            input.amount,
            input.itemDescription ?? null,
            input.receivedBy ?? 'PENERIMA',
            input.proxyName ?? null,
            input.proxyRelation ?? null,
            input.receiptReference ?? null,
            user.userId,
            idempotencyKey,
            input.note ?? null,
          ],
        )
        .catch(
          terjemahkanBentrok(
            'Termin ini sudah disalurkan kepada penerima tersebut. Penyaluran ganda pada termin ' +
              'yang sama adalah pembayaran kedua, bukan pencatatan kedua.',
          ),
        );

      return { id: d.rows[0].id, duplicate: false };
    });
  }

  /** Ringkasan penyaluran satu program. */
  async ringkasanProgram(schemaName: string, programId: string) {
    await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENYALURAN');
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT p.name, p.aid_category, p.quota,
              (SELECT count(*)::int FROM "${schemaName}".village_aid_candidate c
                WHERE c.aid_program_id = p.id) AS candidate_count,
              (SELECT count(*)::int FROM "${schemaName}".village_aid_beneficiary b
                WHERE b.aid_program_id = p.id AND b.status = 'AKTIF') AS beneficiary_count,
              (SELECT count(*)::int FROM "${schemaName}".village_aid_candidate c
                WHERE c.aid_program_id = p.id AND c.source = 'AI') AS ai_sourced_count,
              (SELECT coalesce(sum(d.amount), 0)::text FROM "${schemaName}".village_aid_distribution d
                WHERE d.aid_program_id = p.id) AS distributed_total
         FROM "${schemaName}".village_aid_program p
        WHERE p.id = $1`,
      [programId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Program tidak ditemukan.');
    return rows[0];
  }

  // --- Pendataan ------------------------------------------------------------

  async catatPendataan(
    schemaName: string,
    input: {
      familyId: string;
      surveyYear: number;
      surveyedAt: string;
      monthlyIncome?: number;
      dependentCount?: number;
      houseStatus?: string;
      floorType?: string;
      floorAreaM2?: number;
      waterSource?: string;
      electricityVa?: number;
      hasMotorVehicle?: boolean;
      hasPregnantMember?: boolean;
      hasToddler?: boolean;
      isDtksRegistered?: boolean;
      note?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BANTUAN.PENERIMA');

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_household_survey
         (village_unit_id, village_family_id, survey_year, monthly_income, dependent_count,
          house_status, floor_type, floor_area_m2, water_source, electricity_va,
          has_motor_vehicle, has_pregnant_member, has_toddler, is_dtks_registered,
          note, surveyed_at, surveyed_by, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17)
       ON CONFLICT (village_family_id, survey_year) DO UPDATE
         SET monthly_income = EXCLUDED.monthly_income,
             dependent_count = EXCLUDED.dependent_count,
             house_status = EXCLUDED.house_status,
             floor_type = EXCLUDED.floor_type,
             floor_area_m2 = EXCLUDED.floor_area_m2,
             water_source = EXCLUDED.water_source,
             electricity_va = EXCLUDED.electricity_va,
             has_motor_vehicle = EXCLUDED.has_motor_vehicle,
             has_pregnant_member = EXCLUDED.has_pregnant_member,
             has_toddler = EXCLUDED.has_toddler,
             is_dtks_registered = EXCLUDED.is_dtks_registered,
             note = EXCLUDED.note,
             surveyed_at = EXCLUDED.surveyed_at,
             surveyed_by = EXCLUDED.surveyed_by,
             updated_at = now(),
             version = village_household_survey.version + 1
       RETURNING id`,
      [
        u.id,
        input.familyId,
        input.surveyYear,
        input.monthlyIncome ?? null,
        input.dependentCount ?? null,
        input.houseStatus ?? null,
        input.floorType ?? null,
        input.floorAreaM2 ?? null,
        input.waterSource ?? null,
        input.electricityVa ?? null,
        input.hasMotorVehicle ?? null,
        input.hasPregnantMember ?? null,
        input.hasToddler ?? null,
        input.isDtksRegistered ?? null,
        input.note ?? null,
        input.surveyedAt,
        user.userId,
      ],
    );
    return { id: rows[0].id };
  }
}

// --- Bagian dalam ------------------------------------------------------------

/**
 * Menyusun fakta satu keluarga dari baris kueri.
 *
 * Pemetaannya ditulis di sini, satu per satu. Bukan pemetaan yang disusun dari
 * masukan: nama ruas yang datang dari kriteria tidak pernah menjadi nama kolom
 * maupun penelusuran properti — ia hanya dicocokkan dengan objek yang disusun
 * fungsi ini.
 */
function susunFakta(r: Record<string, unknown>): Fakta {
  const angka = (v: unknown): number | undefined =>
    v === null || v === undefined ? undefined : Number(v);
  const teks = (v: unknown): string | undefined =>
    v === null || v === undefined ? undefined : String(v);
  const benar = (v: unknown): boolean | undefined =>
    v === null || v === undefined ? undefined : Boolean(v);

  const usia = angka(r.usia);

  return {
    penghasilanBulanan: angka(r.monthly_income),
    jumlahAnggotaKeluarga: angka(r.anggota),
    usia,
    luasLantaiM2: angka(r.floor_area_m2),
    dayaListrikVa: angka(r.electricity_va),
    jumlahTanggungan: angka(r.dependent_count),

    statusRumah: teks(r.house_status ?? r.house_ownership),
    jenisLantai: teks(r.floor_type),
    sumberAirMinum: teks(r.water_source),
    pendidikanTerakhir: teks(r.education),
    pekerjaan: teks(r.occupation),
    statusPerkawinan: teks(r.marital_status),
    dusun: teks(r.sub_area_name),
    rw: teks(r.rw_number),
    rt: teks(r.rt_number),

    disabilitas: r.disability_type ? true : undefined,
    lansia: usia === undefined ? undefined : usia >= 60,
    ibuHamil: benar(r.has_pregnant_member),
    balita: benar(r.has_toddler),
    kepalaKeluargaPerempuan: r.gender === null || r.gender === undefined ? undefined : r.gender === 'P',
    terdaftarDtks: benar(r.is_dtks_registered),
    memilikiKendaraanBermotor: benar(r.has_motor_vehicle),
  };
}

function umurHari(tanggal: string): number {
  return Math.floor((Date.now() - Date.parse(`${tanggal}T00:00:00Z`)) / 86_400_000);
}

function terjemahkanBentrok(pesan: string) {
  return (error: unknown): never => {
    if ((error as { code?: string })?.code === '23505') {
      throw AppError.conflict(ErrorCodes.CONFLICT, pesan);
    }
    throw error;
  };
}
