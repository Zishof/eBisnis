/**
 * Zona data, telaah break-glass, dan penjaga AI.
 *
 * Aturannya ada di `health-security.ts` sebagai fungsi murni.
 *
 * ## Yang membuat berkas ini berbeda dari layanan lain pada modul ini
 *
 * Sebelas fase sebelumnya menambahkan kemampuan. Fase ini **memeriksa bahwa
 * penjaga kesebelasnya berdiri**, dan karena itu sebagian besar isinya
 * membaca — bukan menulis.
 *
 * Hanya ada satu jalan yang menulis kepada tabel klinis mana pun di berkas
 * ini, dan ia menulis kepada tabel telaah, bukan kepada rekam medis.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  AWALAN_TABEL_KESEHATAN,
  TINDAKAN_TERLARANG_AI,
  TUJUAN_PENGGUNAAN,
  ZONA,
  ZONA_TERLARANG_AI,
  antreanTelaah,
  bolehAiMelakukan,
  bolehKirimKeAi,
  periksaBreakGlass,
  periksaIsolasi,
  periksaTujuan,
  samarkanNilai,
  syaratTambahanTujuan,
  tabelMilikKesehatan,
  type TujuanPenggunaan,
  type ZonaData,
} from './health-security';

/** Jam kerja yang dipakai menilai kewajaran waktu akses. */
const JAM_KERJA_MULAI = 7;
const JAM_KERJA_SELESAI = 19;

@Injectable()
export class HealthSecurityService {
  private readonly logger = new Logger(HealthSecurityService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  // --- Zona dan penggolongan medan -------------------------------------------

  /**
   * Zona beserta jumlah medan pada masing-masing, **dibaca dari basis data**.
   *
   * Bukan dari `ZONA` pada berkas aturan. Keduanya memang harus sama, dan
   * naskah bukti memeriksanya — tetapi yang menentukan perlakuan sebuah medan
   * adalah barisnya, bukan tetapannya.
   */
  async zona(schema: string) {
    const baris = await this.tenantDb.query<{
      code: string;
      name: string;
      breach_impact: string;
      allowed_to_ai: boolean;
      requires_purpose: boolean;
      masked_on_export: boolean;
      field_count: string;
    }>(
      schema,
      `SELECT z.code, z.name, z.breach_impact, z.allowed_to_ai,
              z.requires_purpose, z.masked_on_export,
              count(f.id) AS field_count
         FROM "${schema}".health_data_zone z
         LEFT JOIN "${schema}".health_field_classification f
           ON f.zone_id = z.id AND f.deleted_at IS NULL
        WHERE z.deleted_at IS NULL
        GROUP BY z.id, z.code, z.name, z.breach_impact, z.allowed_to_ai,
                 z.requires_purpose, z.masked_on_export
        ORDER BY z.code`,
    );

    return {
      zones: baris.map((b) => ({
        code: b.code,
        name: b.name,
        breachImpact: b.breach_impact,
        allowedToAi: b.allowed_to_ai,
        requiresPurpose: b.requires_purpose,
        maskedOnExport: b.masked_on_export,
        fieldCount: Number(b.field_count),
      })),
      forbiddenToAi: ZONA_TERLARANG_AI,
      note:
        'Zona digolongkan menurut AKIBAT KEBOCORANNYA, bukan menurut tingkat rendah/sedang/' +
        'tinggi — tingkat bernomor ditafsirkan sendiri oleh setiap orang yang membacanya.',
    };
  }

  async penggolongan(schema: string, tabel?: string) {
    const syarat = tabel ? 'AND f.table_name = $1' : '';
    const params = tabel ? [tabel] : [];

    const baris = await this.tenantDb.query<{
      table_name: string;
      column_name: string;
      zone_code: string;
      masked_on_export: boolean;
      allowed_to_ai: boolean;
      note: string | null;
    }>(
      schema,
      `SELECT f.table_name, f.column_name, z.code AS zone_code,
              z.masked_on_export, z.allowed_to_ai, f.note
         FROM "${schema}".health_field_classification f
         JOIN "${schema}".health_data_zone z ON z.id = f.zone_id
        WHERE f.deleted_at IS NULL ${syarat}
        ORDER BY f.table_name, f.column_name`,
      params,
    );

    return {
      fields: baris.map((b) => ({
        table: b.table_name,
        column: b.column_name,
        zone: b.zone_code,
        maskedOnExport: b.masked_on_export,
        allowedToAi: b.allowed_to_ai,
        note: b.note,
      })),
      total: baris.length,
      /*
       * KETERBATASAN YANG DINYATAKAN, bukan kemampuan yang berpura-pura ada.
       *
       * Daftar ini bekerja per KOLOM. Kepekaan sesungguhnya sebuah catatan
       * klinis ditentukan pula oleh `clinical_note.sensitivity`, yang bekerja
       * per BARIS — dan tidak ada penggolongan kolom yang dapat menyatakannya.
       */
      limitation:
        'Penggolongan ini bekerja per KOLOM. Kepekaan per BARIS (clinical_note.sensitivity: ' +
        'NORMAL/RESTRICTED/VERY_RESTRICTED) tidak dapat dinyatakan di sini. Kepekaan ' +
        'sesungguhnya sebuah catatan adalah YANG TERTINGGI antara zona kolomnya dan nilai ' +
        'kolom itu.',
    };
  }

  /**
   * Menyamarkan sekumpulan nilai menurut penggolongan yang tercatat.
   *
   * Medan yang **tidak** tergolong dikembalikan apa adanya, dan disebutkan
   * pada `unclassified`. Menyamarkannya diam-diam akan menyembunyikan bahwa
   * daftar penggolongannya belum lengkap — dan daftar yang belum lengkap yang
   * tidak diketahui siapa pun adalah keadaan yang paling berbahaya.
   */
  async samarkan(schema: string, tabel: string, nilai: Record<string, string | null>) {
    const { fields } = await this.penggolongan(schema, tabel);
    const petaZona = new Map(fields.map((f) => [f.column, f.zone as ZonaData]));

    const hasil: Record<string, string | null> = {};
    const disamarkan: string[] = [];
    const takTergolong: string[] = [];

    for (const [kolom, isi] of Object.entries(nilai)) {
      const zona = petaZona.get(kolom);
      if (!zona) {
        hasil[kolom] = isi;
        takTergolong.push(kolom);
        continue;
      }
      const sesudah = samarkanNilai(isi, zona);
      hasil[kolom] = sesudah;
      if (sesudah !== isi) disamarkan.push(kolom);
    }

    return {
      table: tabel,
      values: hasil,
      maskedColumns: disamarkan,
      unclassifiedColumns: takTergolong,
      note:
        takTergolong.length > 0
          ? `${takTergolong.length} kolom belum tergolong dan dikembalikan apa adanya. ` +
            'Disebutkan di sini dengan sengaja: penyamaran diam-diam akan menyembunyikan bahwa ' +
            'daftar penggolongannya belum lengkap.'
          : 'Seluruh kolom yang diminta sudah tergolong.',
    };
  }

  // --- Tujuan penggunaan -----------------------------------------------------

  periksaTujuanPenggunaan(tujuan: string | null, ethicsApprovalRef?: string, breakGlass = false) {
    const dasar = periksaTujuan(tujuan);
    if (!dasar.sah) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, dasar.alasan);
    }
    const tambahan = syaratTambahanTujuan({
      tujuan: tujuan as TujuanPenggunaan,
      ethicsApprovalRef: ethicsApprovalRef ?? null,
      breakGlass,
    });
    if (!tambahan.sah) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, tambahan.alasan);
    }
    return { purpose: tujuan, ...tambahan };
  }

  katalogTujuan() {
    return {
      purposes: TUJUAN_PENGGUNAAN,
      closed: true,
      note:
        'Daftar TERTUTUP. Tujuan bebas-teks akan diisi "kerja" atau "cek", dan jejak akses yang ' +
        'tujuannya "cek" tidak dapat ditelaah siapa pun.',
      extra: {
        RESEARCH: 'menuntut rujukan persetujuan etik',
        EMERGENCY: 'hanya sah bersama break-glass yang tercatat',
      },
    };
  }

  // --- Telaah break-glass ----------------------------------------------------

  /**
   * Antrean telaah, terurut menurut yang paling mencurigakan.
   *
   * Urutannya BUKAN menurut waktu. Antrean yang diurut waktu akan membuat yang
   * paling mencurigakan tenggelam di bawah ratusan akses yang wajar.
   */
  async antrean(schema: string, batas = 50) {
    const baris = await this.tenantDb.query<{
      id: string;
      break_glass_reason: string | null;
      umur_jam: string;
      dirawatnya: boolean;
      di_luar_jam: boolean;
      patient_id: string | null;
      actor_user_id: string | null;
      purpose_of_use: string | null;
      occurred_at: Date;
    }>(
      schema,
      `SELECT a.id::text AS id,
              a.break_glass_reason,
              EXTRACT(EPOCH FROM (now() - a.occurred_at)) / 3600 AS umur_jam,
              /*
               * "Merawatnya" = ada kunjungan pasien itu yang penanggung
               * jawabnya aktor ini. Bukan tebakan; baris yang dapat ditunjuk.
               *
               * a.provider_id boleh NULL — aktor yang bukan tenaga medis
               * (petugas pendaftaran, administrator) tidak punya baris
               * provider. Perbandingan dengan NULL menghasilkan NULL, dan
               * EXISTS atas nol baris menghasilkan FALSE: tepat yang
               * diinginkan, sebab yang bukan tenaga medis memang tidak
               * merawat siapa pun.
               */
              EXISTS (
                SELECT 1 FROM "${schema}".health_encounter e
                 WHERE e.patient_id = a.patient_id
                   AND e.provider_id = a.provider_id
              ) AS dirawatnya,
              (EXTRACT(HOUR FROM a.occurred_at) < $2
               OR EXTRACT(HOUR FROM a.occurred_at) >= $3) AS di_luar_jam,
              a.patient_id, a.actor_user_id, a.purpose_of_use, a.occurred_at
         FROM "${schema}".health_access_log a
        WHERE a.break_glass = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM "${schema}".health_break_glass_review r
             WHERE r.access_log_id = a.id
          )
        ORDER BY a.occurred_at DESC
        LIMIT $1`,
      [batas, JAM_KERJA_MULAI, JAM_KERJA_SELESAI],
    );

    const peta = new Map(baris.map((b) => [b.id, b]));
    const antre = antreanTelaah(
      baris.map((b) => ({
        id: b.id,
        alasan: b.break_glass_reason,
        umurJam: Math.floor(Number(b.umur_jam)),
        aktorMerawatPasien: b.dirawatnya,
        diLuarJamKerja: b.di_luar_jam,
      })),
    );

    return {
      queue: antre.map((t) => {
        const asal = peta.get(t.accessLogId);
        return {
          ...t,
          patientId: asal?.patient_id ?? null,
          actorUserId: asal?.actor_user_id ?? null,
          purposeOfUse: asal?.purpose_of_use ?? null,
          occurredAt: asal?.occurred_at ?? null,
          breakGlassReason: asal?.break_glass_reason ?? null,
        };
      }),
      total: antre.length,
      note:
        'Diurut menurut yang paling mencurigakan, BUKAN menurut waktu. Antrean yang diurut ' +
        'waktu akan membuat yang paling mencurigakan tenggelam di bawah ratusan akses yang ' +
        'wajar — dan yang menelaahnya berhenti pada halaman kedua.',
    };
  }

  /**
   * Mencatat telaah.
   *
   * Perhatikan apa yang TIDAK diperiksa di sini: apakah aksesnya boleh. Ia
   * sudah terjadi. Telaah tidak menyetujui apa pun — ia menilai sesudahnya.
   *
   * Larangan menelaah akses sendiri **tidak ditegakkan di berkas ini**,
   * melainkan trigger `check_break_glass_review` pada basis data. Penegakan
   * yang hanya ada di lapisan aplikasi akan terlewat oleh setiap jalan yang
   * tidak melewati layanan ini.
   */
  async catatTelaah(
    schema: string,
    input: {
      accessLogId: string;
      verdict: string;
      notes: string;
      followUp?: string;
    },
    penelaahId: string,
  ) {
    try {
      const baris = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".health_break_glass_review
           (access_log_id, reviewed_by, verdict, notes, follow_up)
         VALUES ($1::bigint, $2, $3, $4, $5)
         RETURNING id`,
        [
          input.accessLogId,
          penelaahId,
          input.verdict,
          input.notes,
          input.followUp ?? null,
        ],
      );
      return { id: baris[0].id, reviewed: true };
    } catch (error) {
      const pesan = error instanceof Error ? error.message : String(error);

      if (pesan.includes('REVIEW_SELF_FORBIDDEN')) {
        throw AppError.forbidden(
          ErrorCodes.FORBIDDEN,
          'Tidak seorang pun menelaah akses daruratnya sendiri. Telaah yang dilakukan pelakunya ' +
            'sendiri selalu berbunyi wajar.',
        );
      }
      if (pesan.includes('REVIEW_NOT_BREAK_GLASS')) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Baris akses ini bukan akses darurat. Menelaah akses biasa satu per satu akan ' +
            'menenggelamkan yang darurat di antara ribuan yang wajar.',
        );
      }
      if (pesan.includes('REVIEW_LOG_NOT_FOUND')) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Baris akses tidak ditemukan.');
      }
      if (pesan.includes('ux_bg_review_access')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Akses ini sudah ditelaah. Satu akses, satu telaah: tanpa itu, akses yang putusannya ' +
            'tidak disukai dapat ditelaah ulang sampai putusannya berubah.',
        );
      }
      throw error;
    }
  }

  async riwayatTelaah(schema: string, batas = 50) {
    const baris = await this.tenantDb.query(
      schema,
      `SELECT r.id, r.access_log_id::text AS access_log_id, r.reviewed_by,
              r.reviewed_at, r.verdict, r.notes, r.follow_up,
              a.patient_id, a.actor_user_id, a.occurred_at, a.break_glass_reason
         FROM "${schema}".health_break_glass_review r
         JOIN "${schema}".health_access_log a ON a.id = r.access_log_id
        ORDER BY r.reviewed_at DESC
        LIMIT $1`,
      [batas],
    );
    return {
      reviews: baris,
      note:
        'Telaah bersifat tambah-saja: tidak dapat diubah dan tidak dapat dihapus. Ditegakkan ' +
        'trigger forbid_review_mutation pada basis data.',
    };
  }

  /** Ringkasan yang menjawab satu pertanyaan: berapa yang belum ditelaah. */
  async ringkasanBreakGlass(schema: string) {
    const baris = await this.tenantDb.query<{
      total: string;
      ditelaah: string;
      belum: string;
      tak_wajar: string;
    }>(
      schema,
      `SELECT count(*) AS total,
              count(r.id) AS ditelaah,
              count(*) - count(r.id) AS belum,
              count(*) FILTER (WHERE r.verdict IN ('NOT_JUSTIFIED', 'NEEDS_INVESTIGATION'))
                AS tak_wajar
         FROM "${schema}".health_access_log a
         LEFT JOIN "${schema}".health_break_glass_review r ON r.access_log_id = a.id
        WHERE a.break_glass = TRUE`,
    );
    const b = baris[0];
    return {
      total: Number(b.total),
      reviewed: Number(b.ditelaah),
      pending: Number(b.belum),
      adverse: Number(b.tak_wajar),
      note:
        'Break-glass TIDAK PERNAH ditolak dan SELALU ditelaah. Angka pending yang terus naik ' +
        'berarti sifat kedua sudah berhenti berlaku — dan yang pertama tanpa yang kedua adalah ' +
        'pintu belakang.',
    };
  }

  // --- Penjaga AI ------------------------------------------------------------

  /**
   * Memeriksa apakah suatu permintaan boleh sampai ke AI, dan **mencatat
   * penolakannya**.
   *
   * Yang dicatat adalah keputusannya, bukan teksnya. Log yang menyimpan teks
   * permintaan yang ditolak akan menyimpan persis data yang penolakannya
   * bermaksud melindungi.
   */
  async periksaAi(
    schema: string,
    input: { zone: string; text: string; tenantIds: string[]; feature: string },
    aktorId: string | null,
  ) {
    const hasil = bolehKirimKeAi({
      zona: input.zone as ZonaData,
      teks: input.text,
      tenantIds: input.tenantIds,
    });

    const jumlahRedaksi = hasil.hasilRedaksi.disamarkan.reduce((n, d) => n + d.jumlah, 0);

    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".health_ai_guard_log
         (actor_user_id, zone_code, feature, outcome, reason, redaction_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        aktorId,
        input.zone,
        input.feature,
        hasil.boleh ? 'ALLOWED' : 'BLOCKED',
        hasil.alasan,
        jumlahRedaksi,
      ],
    );

    return {
      allowed: hasil.boleh,
      reason: hasil.alasan,
      redactedText: hasil.hasilRedaksi.teks,
      redactions: hasil.hasilRedaksi.disamarkan,
      note:
        'Teks permintaan TIDAK disimpan pada log penjaga — hanya keputusannya dan jumlah pola ' +
        'yang disamarkan. Log yang menyimpan teks yang ditolak akan menyimpan persis data yang ' +
        'penolakannya bermaksud melindungi.',
    };
  }

  async riwayatPenjagaAi(schema: string, batas = 50) {
    const baris = await this.tenantDb.query(
      schema,
      `SELECT id, actor_user_id, zone_code, feature, outcome, reason,
              redaction_count, occurred_at
         FROM "${schema}".health_ai_guard_log
        ORDER BY occurred_at DESC
        LIMIT $1`,
      [batas],
    );
    return {
      entries: baris,
      note:
        'Yang dicatat di sini adalah permintaan yang TIDAK PERNAH sampai ke AI Gateway bersama. ' +
        'Seorang petugas yang tiga puluh kali mencoba mengirim rekam medis ke model bahasa ' +
        'tidak muncul sama sekali pada log gateway, dan tampak sebagai pengguna yang tidak ' +
        'pernah memakai AI.',
    };
  }

  katalogLaranganAi() {
    return {
      forbidden: TINDAKAN_TERLARANG_AI,
      note:
        'Daftar TERTUTUP, dan setiap barisnya punya sebab yang sama: akibatnya tidak dapat ' +
        'ditarik kembali oleh orang yang menyadarinya kemudian. Yang dapat dilakukan AI adalah ' +
        'menyiapkan, menjelaskan, dan mengusulkan — dan ketiganya menunggu seseorang menekan ' +
        'tombolnya.',
    };
  }

  periksaTindakanAi(tindakan: string) {
    const hasil = bolehAiMelakukan(tindakan);
    if (!hasil.boleh) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, hasil.alasan);
    }
    return hasil;
  }

  // --- Isolasi ---------------------------------------------------------------

  /**
   * Memeriksa isolasi antar-tenant.
   *
   * Perhatikan bahwa ini **bukan** penjaga utamanya. Penjaga utamanya adalah
   * resolver tenant milik Core, yang menetapkan `search_path` dari token
   * sebelum satu kueri pun berjalan. Yang di sini adalah pemeriksaan yang
   * dapat DIPERLIHATKAN — supaya naskah bukti dapat menunjukkan penolakannya,
   * bukan sekadar mempercayai bahwa lapisan bawah bekerja.
   */
  periksaRuangKerja(schemaDiminta: string | null, schemaToken: string | null) {
    const hasil = periksaIsolasi({ schemaDiminta, schemaToken });
    if (!hasil.sah) {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, hasil.alasan);
    }
    return hasil;
  }

  /**
   * Memeriksa isolasi antar-vertical: berapa tabel kesehatan ada pada skema,
   * dan apakah ada tabel kesehatan yang bocor ke `public`.
   *
   * Pemeriksaan kedua itu yang penting. `public` tidak pernah menjadi cadangan
   * `search_path`, dan tabel kesehatan yang muncul di sana berarti sebuah
   * migrasi berjalan tanpa skema tenant — kegagalan yang tidak menimbulkan
   * galat dan membuat satu tabel dapat dibaca setiap tenant.
   */
  async isolasiVertical(schema: string) {
    const milik = await this.tenantDb.query<{ table_name: string }>(
      schema,
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
      [schema],
    );

    const kesehatan = milik.map((m) => m.table_name).filter((t) => tabelMilikKesehatan(t));

    const bocor = await this.tenantDb.query<{ table_name: string }>(
      schema,
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
    );
    const bocorKesehatan = bocor.map((b) => b.table_name).filter((t) => tabelMilikKesehatan(t));

    return {
      schema,
      healthTableCount: kesehatan.length,
      otherTableCount: milik.length - kesehatan.length,
      prefixes: AWALAN_TABEL_KESEHATAN,
      leakedToPublic: bocorKesehatan,
      isolated: bocorKesehatan.length === 0,
      note:
        bocorKesehatan.length === 0
          ? 'Tidak ada tabel kesehatan pada skema public. public tidak pernah menjadi cadangan ' +
            'search_path.'
          : `${bocorKesehatan.length} tabel kesehatan ada pada skema public — sebuah migrasi ` +
            'berjalan tanpa skema tenant, dan tabelnya kini dapat dibaca setiap tenant.',
    };
  }

  // --- Ringkasan sikap keamanan ----------------------------------------------

  /**
   * Satu jawaban atas pertanyaan "apakah pertahanannya berdiri".
   *
   * Seluruh angkanya dibaca dari basis data. Tidak satu pun dihitung dari
   * tetapan pada kode — ringkasan yang membaca tetapannya sendiri akan selalu
   * berkata semuanya baik.
   */
  async sikapKeamanan(schema: string) {
    const [zona, penggolongan, bg, ai] = await Promise.all([
      this.tenantDb.query<{ n: string }>(
        schema,
        `SELECT count(*) n FROM "${schema}".health_data_zone WHERE deleted_at IS NULL`,
      ),
      this.tenantDb.query<{ n: string }>(
        schema,
        `SELECT count(*) n FROM "${schema}".health_field_classification WHERE deleted_at IS NULL`,
      ),
      this.ringkasanBreakGlass(schema),
      this.tenantDb.query<{ diblokir: string; total: string }>(
        schema,
        `SELECT count(*) FILTER (WHERE outcome = 'BLOCKED') AS diblokir,
                count(*) AS total
           FROM "${schema}".health_ai_guard_log`,
      ),
    ]);

    const isolasi = await this.isolasiVertical(schema);

    return {
      zones: Number(zona[0].n),
      classifiedFields: Number(penggolongan[0].n),
      breakGlass: bg,
      aiGuard: {
        total: Number(ai[0].total),
        blocked: Number(ai[0].diblokir),
      },
      isolation: {
        healthTables: isolasi.healthTableCount,
        leakedToPublic: isolasi.leakedToPublic,
        isolated: isolasi.isolated,
      },
      zoneDefinitions: Object.values(ZONA).map((z) => ({
        zone: z.zona,
        allowedToAi: z.bolehKeAi,
      })),
    };
  }

  /**
   * Break-glass diizinkan, dan keputusannya dikembalikan supaya pemanggilnya
   * tahu bahwa ia akan ditelaah.
   *
   * Tidak melempar galat pada keadaan mana pun. Itu disengaja — lihat
   * `periksaBreakGlass` pada berkas aturan.
   */
  nilaiBreakGlass(alasan: string | null, patientTerdaftarPadaAktor: boolean) {
    const hasil = periksaBreakGlass({ alasan, patientTerdaftarPadaAktor });
    if (hasil.wajibTelaah) {
      this.logger.warn(
        `Break-glass dicatat dan menunggu telaah: ${hasil.alasan.slice(0, 120)}`,
      );
    }
    return hasil;
  }
}
