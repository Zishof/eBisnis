/**
 * Data contoh, pembersihannya, laporan, dan penghalang yang dicatat.
 *
 * Aturannya ada di `health-sample.ts` sebagai fungsi murni.
 *
 * ## Yang harus diperhatikan pada pembersihan
 *
 * **Tidak satu pun kueri di bawah menjalankan `DELETE` pada tabel klinis.**
 * Pembersihan adalah `UPDATE` yang mengubah penanda, dan setiap kuerinya
 * menyertakan syarat penanda contoh yang **dibaca dari `health_sample_table`**
 * — bukan dari daftar yang ditulis di berkas ini.
 *
 * Perbedaannya menentukan: daftar di berkas ini dapat diubah seseorang
 * bersamaan dengan mengubah kuerinya, dan keduanya akan lolos telaah sebagai
 * satu perubahan yang tampak wajar.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  LAPORAN,
  PENGHALANG,
  PROFIL_CONTOH,
  bolehBersihkan,
  laporanDikenal,
  periksaBenih,
  periksaHasilPembersihan,
  periksaJumlahBaris,
  periksaPenghalang,
  periksaRentang,
  seluruhnyaAgregat,
  type BarisTerhitung,
  type JenisLaporan,
  type ProfilContoh,
} from './health-sample';

/** Batas rentang laporan. Setahun lebih satu hari, supaya "satu tahun penuh" muat. */
const BATAS_HARI_LAPORAN = 366;

@Injectable()
export class HealthSampleService {
  private readonly logger = new Logger(HealthSampleService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  katalog() {
    return {
      profiles: Object.entries(PROFIL_CONTOH).map(([kode, p]) => ({ kode, ...p })),
      reports: LAPORAN,
      blockers: PENGHALANG,
      allReportsAggregate: seluruhnyaAgregat(),
      note:
        'Data contoh DISEMBUNYIKAN saat dibersihkan, tidak dihapus — dan pembersihannya tidak ' +
        'pernah menyentuh baris yang tidak bertanda contoh.',
    };
  }

  // --- Daftar izin tabel -----------------------------------------------------

  /**
   * Membaca daftar tabel yang boleh disentuh pembersihan, **dari basis data**.
   *
   * Bukan dari tetapan pada berkas ini. Itulah seluruh maksudnya.
   */
  private async daftarIzin(
    schema: string,
  ): Promise<{ tabel: string; kolom: string; urutan: number }[]> {
    /*
     * Dibaca dari TAMPILAN yang sudah menyaring, bukan dari tabelnya.
     *
     * Membersihkan berarti menyembunyikan, dan menyembunyikan menuntut kolom
     * `deleted_at` — yang hanya dimiliki sebagian tabel. Pembersihan pada
     * tabel tanpa `deleted_at` akan berjalan, melaporkan keberhasilan, dan
     * tidak menyembunyikan apa pun: laporan yang berkata "selesai" dengan
     * keadaan yang tidak berubah.
     */
    const baris = await this.tenantDb.query<{
      table_name: string;
      sample_flag_column: string;
      clean_order: number;
    }>(
      schema,
      `SELECT table_name, sample_flag_column, clean_order
         FROM "${schema}".health_sample_table_cleanable
        ORDER BY clean_order`,
    );
    return baris.map((b) => ({
      tabel: b.table_name,
      kolom: b.sample_flag_column,
      urutan: Number(b.clean_order),
    }));
  }

  async tabelDiizinkan(schema: string) {
    const izin = await this.daftarIzin(schema);
    const takDapat = await this.tenantDb.query<{
      table_name: string;
      not_hideable_reason: string;
    }>(
      schema,
      `SELECT table_name, not_hideable_reason FROM "${schema}".health_sample_table
        WHERE hideable = FALSE ORDER BY table_name`,
    );
    return {
      items: izin,
      /*
       * KETERBATASAN YANG DINYATAKAN, bukan kemampuan yang berpura-pura ada.
       *
       * Data contoh pada tabel ini tetap bertanda dan tetap dapat disaring
       * kueri mana pun yang memeriksa penandanya — yang tidak dapat dilakukan
       * hanyalah menyembunyikannya.
       */
      notCleanable: takDapat.map((t) => ({
        table: t.table_name,
        reason: t.not_hideable_reason,
      })),
      note:
        'Daftar ini dibaca dari basis data, bukan dari tetapan pada kode. Daftar yang ada di ' +
        'kode dapat diubah seseorang bersamaan dengan mengubah kueri pembersihnya, dan keduanya ' +
        'akan lolos telaah sebagai satu perubahan yang tampak wajar.',
    };
  }

  /**
   * Menghitung baris contoh dan baris sungguhan pada tiap tabel.
   *
   * Nama tabel dan nama kolomnya berasal dari `health_sample_table` — dan
   * keduanya diperiksa terhadap `information_schema` sebelum dipakai menyusun
   * kueri, sebab nama yang datang dari basis data pun tetap nama yang
   * disisipkan ke dalam SQL.
   */
  private async hitung(
    schema: string,
    tabel: { tabel: string; kolom: string }[],
  ): Promise<BarisTerhitung[]> {
    const sah = await this.tenantDb.query<{ table_name: string; column_name: string }>(
      schema,
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = $1 AND column_name IN ('is_sample', 'is_sample_data')`,
      [schema],
    );
    const pasangan = new Set(sah.map((s) => `${s.table_name}.${s.column_name}`));

    const hasil: BarisTerhitung[] = [];
    for (const t of tabel) {
      if (!pasangan.has(`${t.tabel}.${t.kolom}`)) {
        throw AppError.internal(
          ErrorCodes.INTERNAL_ERROR,
          `Tabel ${t.tabel} tidak punya kolom penanda ${t.kolom}. Daftar izin dan basis data ` +
            'berbeda, dan pembersihan tidak dijalankan sampai keduanya sepakat.',
        );
      }
      /*
       * Yang dihitung adalah baris yang MASIH TAMPAK.
       *
       * Baris contoh yang sudah disembunyikan tidak dihitung lagi sebagai
       * contoh — bila dihitung, jalan pembersihan kedua akan melaporkan
       * ratusan baris yang sesungguhnya sudah tersembunyi sejak jalan pertama.
       */
      const baris = await this.tenantDb.query<{ contoh: string; sungguhan: string }>(
        schema,
        `SELECT count(*) FILTER (WHERE "${t.kolom}" = TRUE)::text AS contoh,
                count(*) FILTER (WHERE "${t.kolom}" = FALSE OR "${t.kolom}" IS NULL)::text AS sungguhan
           FROM "${schema}"."${t.tabel}"
          WHERE deleted_at IS NULL`,
      );
      hasil.push({
        tabel: t.tabel,
        contoh: Number(baris[0].contoh),
        sungguhan: Number(baris[0].sungguhan),
      });
    }
    return hasil;
  }

  // --- Penyemaian ------------------------------------------------------------

  async catatPenyemaian(
    schema: string,
    input: {
      facilityId?: string | null;
      runCode: string;
      profile: ProfilContoh;
      seed: string;
      rowsPerTable: number;
      tableCount: number;
    },
    actorUserId: string,
  ) {
    const benih = periksaBenih(input.seed);
    if (!benih.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, benih.alasan);
    }
    const jumlah = periksaJumlahBaris(input.profile, input.rowsPerTable);
    if (!jumlah.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, jumlah.alasan);
    }

    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `INSERT INTO "${schema}".health_sample_run
         (facility_id, run_code, profile, seed, row_total, table_count, seeded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        input.facilityId ?? null,
        input.runCode,
        input.profile,
        input.seed,
        input.rowsPerTable * input.tableCount,
        input.tableCount,
        actorUserId,
      ],
    );

    return {
      id: baris[0].id,
      runCode: input.runCode,
      profile: input.profile,
      note:
        'Kumpulan penyemaian tercatat. Pembersihannya hanya dapat dijalankan atas kumpulan ' +
        'yang tercatat — pembersihan tanpa kumpulan berarti "hapus semua yang tampak seperti ' +
        'contoh", dan yang tampak seperti contoh bagi program tidak sama dengan yang memang ' +
        'contoh.',
    };
  }

  async daftarPenyemaian(schema: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, run_code, profile, seed, row_total, table_count,
              seeded_at, hidden_at, hide_reason, hidden_row_count
         FROM "${schema}".health_sample_run
        ORDER BY seeded_at DESC
        LIMIT 100`,
    );
  }

  // --- Pembersihan -----------------------------------------------------------

  /**
   * Menjalankan pembersihan.
   *
   * Empat langkah, dan urutannya adalah keamanannya:
   *
   * 1. hitung baris contoh **dan baris sungguhan** sebelum apa pun berubah;
   * 2. putuskan apakah boleh, dengan daftar izin yang dibaca dari basis data;
   * 3. jalankan `UPDATE` — bukan `DELETE` — dengan syarat penanda contoh;
   * 4. hitung ulang, dan **tolak seluruh transaksinya** bila satu baris
   *    sungguhan berubah.
   *
   * Langkah keempat itu yang paling penting. Tanpanya, ketiga langkah pertama
   * hanyalah niat baik.
   */
  async bersihkan(
    schema: string,
    input: { sampleRunId: string; tables?: string[]; reason: string },
    actorUserId: string,
  ) {
    if (input.reason.trim().length < 10) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        'Pembersihan wajib beralasan sekurangnya 10 huruf.',
      );
    }

    const izin = await this.daftarIzin(schema);
    const diminta = input.tables?.length ? input.tables : izin.map((i) => i.tabel);
    const petaKolom = new Map(izin.map((i) => [i.tabel, i.kolom]));

    return this.tenantDb.transaction(schema, async (client) => {
      const run = await client.query<{ id: string; hidden_at: string | null }>(
        `SELECT id, hidden_at FROM "${schema}".health_sample_run WHERE id = $1 FOR UPDATE`,
        [input.sampleRunId],
      );
      if (run.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kumpulan penyemaian tidak ditemukan.');
      }
      if (run.rows[0].hidden_at) {
        throw AppError.conflict(
          ErrorCodes.INVALID_STATE_TRANSITION,
          'Kumpulan ini sudah dibersihkan.',
        );
      }

      /*
       * 1. PUTUSKAN LEBIH DAHULU — sebelum satu nama tabel pun dipakai
       *    menyusun kueri.
       *
       * Urutan ini adalah keamanannya. Menghitung lebih dahulu berarti nama
       * tabel yang belum disahkan sudah disisipkan ke dalam SQL, dan yang
       * membedakan "belum disahkan" dari "berbahaya" hanyalah keberuntungan
       * tentang nama apa yang dikirimkan.
       *
       * Ia pula yang menghasilkan penolakan yang benar: tabel di luar daftar
       * izin ditolak 422 beserta sebabnya, bukan 500 karena kuerinya gagal.
       */
      const keputusan = bolehBersihkan({
        tabelDiminta: diminta,
        tabelDiizinkan: izin.map((i) => i.tabel),
        // Hitungannya belum ada di sini, dan memang tidak dibutuhkan untuk
        // memutuskan boleh atau tidak.
        hitungan: [],
        batchTercatat: true,
      });
      if (!keputusan.boleh) {
        throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, keputusan.alasan);
      }

      // 2. Baru hitung, atas tabel yang sudah disahkan.
      const sebelum = await this.hitung(
        schema,
        diminta.map((t) => ({ tabel: t, kolom: petaKolom.get(t) ?? 'is_sample' })),
      );

      // 3. Jalankan — UPDATE, bukan DELETE.
      let disembunyikan = 0;
      for (const t of diminta) {
        const kolom = petaKolom.get(t);
        if (!kolom) continue;
        /*
         * Syarat penanda contoh ADA PADA KUERINYA, bukan hanya pada
         * pemeriksaan sebelumnya. Pemeriksaan yang tidak terbawa ke kuerinya
         * adalah pemeriksaan yang dilewati oleh baris yang berubah di antara
         * keduanya.
         */
        const hasil = await client.query(
          `UPDATE "${schema}"."${t}"
              SET deleted_at = now()
            WHERE "${kolom}" = TRUE AND deleted_at IS NULL`,
        );
        disembunyikan += hasil.rowCount ?? 0;
      }

      // 4. Hitung ulang, dan tolak seluruhnya bila ada yang berubah.
      const sesudah = await this.hitung(
        schema,
        diminta.map((t) => ({ tabel: t, kolom: petaKolom.get(t) ?? 'is_sample' })),
      );
      const aman = periksaHasilPembersihan(sebelum, sesudah);
      if (!aman.aman) {
        this.logger.error(`Pembersihan menyentuh data sungguhan: ${aman.pelanggaran.join('; ')}`);
        throw AppError.internal(
          ErrorCodes.INTERNAL_ERROR,
          `${aman.alasan} Pelanggaran: ${aman.pelanggaran.join('; ')}. Seluruh transaksinya ` +
            'dibatalkan.',
        );
      }

      for (const s of sebelum) {
        const t = sesudah.find((x) => x.tabel === s.tabel);
        await client.query(
          `INSERT INTO "${schema}".health_sample_row_count
             (sample_run_id, table_name, sample_rows, real_rows_before, real_rows_after)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (sample_run_id, table_name) DO UPDATE
             SET sample_rows = EXCLUDED.sample_rows,
                 real_rows_before = EXCLUDED.real_rows_before,
                 real_rows_after = EXCLUDED.real_rows_after`,
          [input.sampleRunId, s.tabel, s.contoh, s.sungguhan, t?.sungguhan ?? s.sungguhan],
        );
      }

      await client.query(
        `UPDATE "${schema}".health_sample_run
            SET hidden_at = now(), hidden_by = $2, hide_reason = $3,
                hidden_row_count = $4, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.sampleRunId, actorUserId, input.reason, disembunyikan],
      );

      return {
        id: input.sampleRunId,
        tablesTouched: diminta.length,
        sampleRowsHidden: disembunyikan,
        /*
         * SELALU nol, dan ia diperiksa — bukan dinyatakan.
         */
        realRowsTouched: 0,
        method: 'HIDE' as const,
        verification: aman,
        note:
          `${disembunyikan} baris contoh DISEMBUNYIKAN, bukan dihapus. Penghapusan keras ` +
          'menghilangkan pula jejak audit yang menunjuknya, dan ketika seseorang bertanya dari ' +
          'mana angka ini datang enam bulan kemudian, yang tersisa hanyalah baris audit yang ' +
          'menunjuk ketiadaan.',
      };
    });
  }

  // --- Laporan ---------------------------------------------------------------

  async laporan(
    schema: string,
    input: { kode: JenisLaporan; facilityId: string; dari: string; sampai: string },
  ) {
    if (!laporanDikenal(input.kode)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Laporan "${input.kode}" tidak ada pada katalog. Katalognya daftar TERTUTUP.`,
      );
    }
    const rentang = periksaRentang({
      dari: input.dari,
      sampai: input.sampai,
      batasHari: BATAS_HARI_LAPORAN,
    });
    if (!rentang.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, rentang.alasan);
    }

    const p = [input.facilityId, input.dari, input.sampai];
    let baris: Record<string, unknown>[] = [];

    switch (input.kode) {
      case 'VISIT_VOLUME':
        baris = await this.tenantDb.query(
          schema,
          `SELECT e.started_at::date::text AS tanggal, count(*)::int AS jumlah
             FROM "${schema}".health_encounter e
            WHERE e.facility_id = $1 AND e.started_at::date BETWEEN $2::date AND $3::date
            GROUP BY 1 ORDER BY 1`,
          p,
        );
        break;
      case 'PAYER_MIX':
        baris = await this.tenantDb.query(
          schema,
          `SELECT COALESCE(pc.payer_name, 'Tanpa Penjamin') AS penjamin, count(*)::int AS jumlah
             FROM "${schema}".health_claim c
             LEFT JOIN "${schema}".health_payer_coverage pc ON pc.id = c.payer_coverage_id
            WHERE c.facility_id = $1 AND c.created_at::date BETWEEN $2::date AND $3::date
            GROUP BY 1 ORDER BY 2 DESC`,
          p,
        );
        break;
      case 'SAFETY_INCIDENT':
        baris = await this.tenantDb.query(
          schema,
          `SELECT grade, harm_level, count(*)::int AS jumlah
             FROM "${schema}".safety_incident
            WHERE facility_id = $1 AND occurred_at::date BETWEEN $2::date AND $3::date
            GROUP BY 1,2 ORDER BY 1,2`,
          p,
        );
        break;
      case 'CLAIM_STATUS':
        baris = await this.tenantDb.query(
          schema,
          `SELECT status, count(*)::int AS jumlah
             FROM "${schema}".health_claim
            WHERE facility_id = $1 AND created_at::date BETWEEN $2::date AND $3::date
            GROUP BY 1 ORDER BY 2 DESC`,
          p,
        );
        break;
      case 'PRESCRIPTION_VOLUME':
        baris = await this.tenantDb.query(
          schema,
          `SELECT p.prescribed_at::date::text AS tanggal, count(*)::int AS jumlah
             FROM "${schema}".rx_prescription p
             JOIN "${schema}".patient pt ON pt.id = p.patient_id
            WHERE p.prescribed_at::date BETWEEN $2::date AND $3::date
              AND $1 IS NOT NULL
            GROUP BY 1 ORDER BY 1`,
          p,
        );
        break;
      case 'DEVICE_UTILIZATION':
        baris = await this.tenantDb.query(
          schema,
          `SELECT d.code, d.name, count(o.id)::int AS jumlah_hasil
             FROM "${schema}".medical_device d
             LEFT JOIN "${schema}".device_observation o
               ON o.device_id = d.id AND o.captured_at::date BETWEEN $2::date AND $3::date
            WHERE d.facility_id = $1
            GROUP BY 1,2 ORDER BY 3 DESC`,
          p,
        );
        break;
      case 'BED_OCCUPANCY':
        baris = await this.tenantDb.query(
          schema,
          `SELECT b.bed_code, b.status, count(*)::int AS jumlah
             FROM "${schema}".health_bed b
             JOIN "${schema}".health_room r ON r.id = b.room_id
            WHERE r.facility_id = $1 AND $2::date <= $3::date
            GROUP BY 1,2 ORDER BY 1`,
          p,
        );
        break;
      case 'LAB_TURNAROUND':
        baris = await this.tenantDb.query(
          schema,
          `SELECT t.name AS pemeriksaan,
                  round(avg(EXTRACT(EPOCH FROM (r.verified_at - o.ordered_at)) / 60))::int
                    AS rerata_menit,
                  count(*)::int AS jumlah
             FROM "${schema}".lab_result r
             JOIN "${schema}".lab_order o ON o.id = r.order_id
             LEFT JOIN "${schema}".lab_test_catalog t ON t.id = r.test_id
            WHERE o.facility_id = $1 AND r.verified_at IS NOT NULL
              AND o.ordered_at::date BETWEEN $2::date AND $3::date
            GROUP BY 1 ORDER BY 2 DESC NULLS LAST`,
          p,
        );
        break;
      default:
        baris = [];
    }

    const definisi = LAPORAN.find((l) => l.kode === input.kode);
    return {
      report: input.kode,
      name: definisi?.nama,
      /*
       * DINYATAKAN PADA SETIAP JAWABAN.
       *
       * Laporan yang tidak menyatakan dirinya agregat akan disangka memuat
       * data pasien oleh orang yang berhati-hati — dan orang yang berhati-hati
       * akan berhenti memakainya.
       */
      patientLevel: definisi?.tingkatPasien ?? false,
      range: { from: input.dari, to: input.sampai, note: rentang.alasan },
      rows: baris,
      export: this.penghalangEkspor(),
    };
  }

  /** Penghalang ekspor, disertakan pada setiap laporan. */
  private penghalangEkspor() {
    const excel = periksaPenghalang('Ekspor');
    const pdf = periksaPenghalang('Cetak PDF');
    return {
      excel: excel ? { blocked: true, ...excel } : { blocked: false },
      pdf: pdf ? { blocked: true, ...pdf } : { blocked: false },
    };
  }

  /**
   * Mencoba mengekspor.
   *
   * Menolak — dan penolakannya menyebutkan **sebab dan jalan keluarnya**, bukan
   * sekadar "belum tersedia". Sistem yang diam tentang apa yang tidak dapat
   * dilakukannya akan ditanyakan berulang kali oleh orang yang berbeda, dan
   * salah satu di antaranya akan membangunnya sendiri.
   */
  ekspor(format: string) {
    const p = periksaPenghalang(format === 'PDF' ? 'Cetak PDF' : 'Ekspor');
    if (!p) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `Format ${format} tidak dikenal.`);
    }
    throw AppError.unprocessable(
      ErrorCodes.VALIDATION_FAILED,
      `${p.kemampuan} terhalang. Sebab: ${p.sebab} Akibat: ${p.akibat} Jalan keluar: ${p.jalanKeluar}`,
    );
  }

  /** Daftar penghalang, apa adanya. */
  penghalang() {
    return {
      items: PENGHALANG,
      note:
        'Dicatat, bukan disembunyikan. Sistem yang diam tentang apa yang tidak dapat ' +
        'dilakukannya akan ditanyakan berulang kali oleh orang yang berbeda — dan salah satu di ' +
        'antaranya akan membangunnya sendiri dengan cara yang tidak dapat dipelihara siapa pun.',
    };
  }

  // --- Peran -----------------------------------------------------------------

  /**
   * Ringkasan peran kesehatan yang benar-benar ada pada tenant ini.
   *
   * Dibaca dari basis data, bukan dari katalog pada kode: yang menentukan siapa
   * boleh apa adalah barisnya, dan katalog yang berbeda dari barisnya adalah
   * katalog yang menyesatkan pembacanya.
   */
  async ringkasanPeran(schema: string) {
    const baris = await this.tenantDb.query<{
      code: string;
      name: string;
      izin: string;
      punya_hak_pasien: boolean;
    }>(
      schema,
      `SELECT r.code, r.name,
              count(rmp.id)::text AS izin,
              bool_or(m.code LIKE 'HEALTH_PATIENT%') AS punya_hak_pasien
         FROM "${schema}".role r
         LEFT JOIN "${schema}".role_menu_permission rmp ON rmp.role_id = r.id
         LEFT JOIN "${schema}".menu m ON m.id = rmp.menu_id
        WHERE r.code LIKE 'HEALTH\\_%' AND r.deleted_at IS NULL
        GROUP BY r.code, r.name
        ORDER BY r.code`,
    );
    return {
      total: baris.length,
      items: baris.map((b) => ({
        code: b.code,
        name: b.name,
        permissionCount: Number(b.izin),
        hasPatientAccess: b.punya_hak_pasien === true,
      })),
      withoutPatientAccess: baris.filter((b) => b.punya_hak_pasien !== true).length,
      note:
        'Dibaca dari basis data, bukan dari katalog pada kode. Yang menentukan siapa boleh apa ' +
        'adalah barisnya, dan katalog yang berbeda dari barisnya menyesatkan pembacanya.',
    };
  }
}
