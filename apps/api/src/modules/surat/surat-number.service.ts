/**
 * Penerbitan nomor surat.
 *
 * ## Nomor kembar adalah cacat yang keluar dari organisasi
 *
 * Dua surat berbeda dengan nomor sama tidak dapat dibedakan lagi oleh
 * penerimanya, dan kesalahannya tidak dapat diperbaiki setelah suratnya
 * dikirim. Karena itu penomoran di sini dirancang supaya keadaan kembar
 * **tidak mungkin terjadi**, bukan supaya dapat diperbaiki belakangan.
 *
 * Sistem lama punya `SinkronNomorSuratHelper` — sebuah penolong untuk
 * menyelaraskan nomor. Penolong seperti itu hanya dibutuhkan bila nomornya
 * pernah tidak selaras.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { periodKeyFor, renderPattern, validatePattern } from './number-pattern';

interface SchemeRow {
  id: string;
  code: string;
  pattern: string;
  number_padding: number;
  start_number: number;
  reset_period: string;
  is_active: boolean;
}

@Injectable()
export class SuratNumberService {
  private readonly logger = new Logger(SuratNumberService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Mengambil satu nomor berikutnya.
   *
   * ## Bagaimana kembar dicegah
   *
   * Penghitungnya baris tersendiri berkunci unik `(scheme_id, period_key)`.
   * Kenaikannya dilakukan dengan satu pernyataan `UPDATE ... RETURNING`, yang
   * mengunci baris itu selama pernyataan berjalan. Dua permintaan bersamaan
   * karena itu menerima dua angka berbeda — yang kedua menunggu yang pertama
   * selesai, lalu membaca nilai yang sudah naik.
   *
   * `MAX(nomor) + 1` tidak dapat melakukannya: dua permintaan membaca MAX yang
   * sama sebelum salah satunya menulis.
   *
   * Baris penghitung dibuat lebih dulu dengan `ON CONFLICT DO NOTHING`,
   * sehingga dua permintaan yang sama-sama menemukan periode baru tidak
   * menghasilkan dua baris penghitung.
   */
  async allocate(
    schema: string,
    schemeId: string,
    options: { classificationCode?: string | null; unitCode?: string | null; at?: Date } = {},
  ): Promise<{ number: string; sequence: number; periodKey: string }> {
    const scheme = await this.schemeOf(schema, schemeId);
    const saat = options.at ?? new Date();
    const periodKey = periodKeyFor(scheme.reset_period, saat);

    // Baris penghitung dipastikan ada. `DO NOTHING` membuat dua permintaan
    // bersamaan pada periode baru tidak saling menggagalkan.
    await this.tenantDb.query(
      schema,
      `INSERT INTO "${schema}".surat_number_counter (scheme_id, period_key, last_number)
       VALUES ($1, $2, $3)
       ON CONFLICT (scheme_id, period_key) DO NOTHING`,
      [schemeId, periodKey, Math.max(scheme.start_number - 1, 0)],
    );

    // Inilah satu-satunya tempat angka naik. Satu pernyataan, satu baris
    // terkunci, satu angka keluar.
    const rows = await this.tenantDb.query<{ last_number: number }>(
      schema,
      `UPDATE "${schema}".surat_number_counter
          SET last_number = last_number + 1, updated_at = now()
        WHERE scheme_id = $1 AND period_key = $2
        RETURNING last_number`,
      [schemeId, periodKey],
    );

    const sequence = rows[0]?.last_number;
    if (sequence === undefined) {
      throw AppError.internal(
        ErrorCodes.INTERNAL_ERROR,
        'Penghitung nomor surat tidak ditemukan setelah dibuat.',
      );
    }

    const number = renderPattern(scheme.pattern, {
      number: sequence,
      padding: scheme.number_padding,
      date: saat,
      classificationCode: options.classificationCode,
      unitCode: options.unitCode,
    });

    return { number, sequence, periodKey };
  }

  /**
   * Pratinjau nomor berikutnya TANPA mengambilnya.
   *
   * Dibedakan tegas dari `allocate`. Pratinjau yang diam-diam mengambil nomor
   * akan meninggalkan lubang pada penomoran setiap kali seseorang membuka
   * formulir lalu membatalkannya — dan lubang pada nomor surat resmi menimbulkan
   * pertanyaan yang tidak dapat dijawab saat diaudit.
   */
  async preview(
    schema: string,
    schemeId: string,
    options: { classificationCode?: string | null; unitCode?: string | null; at?: Date } = {},
  ): Promise<{ number: string; sequence: number; periodKey: string; isPreview: true }> {
    const scheme = await this.schemeOf(schema, schemeId);
    const saat = options.at ?? new Date();
    const periodKey = periodKeyFor(scheme.reset_period, saat);

    const rows = await this.tenantDb.query<{ last_number: number }>(
      schema,
      `SELECT last_number FROM "${schema}".surat_number_counter
        WHERE scheme_id = $1 AND period_key = $2`,
      [schemeId, periodKey],
    );

    const sequence = rows.length ? rows[0].last_number + 1 : Math.max(scheme.start_number, 1);

    return {
      number: renderPattern(scheme.pattern, {
        number: sequence,
        padding: scheme.number_padding,
        date: saat,
        classificationCode: options.classificationCode,
        unitCode: options.unitCode,
      }),
      sequence,
      periodKey,
      // Ditandai supaya pemanggilnya tidak keliru menyimpannya sebagai nomor
      // resmi. Angka ini dapat berubah bila orang lain menerbitkan surat lebih
      // dulu.
      isPreview: true,
    };
  }

  /**
   * Memeriksa pola sebelum skema disimpan.
   *
   * Dijalankan saat skema dibuat atau diubah — bukan saat surat diterbitkan.
   * Menolak pola yang salah pada saat penerbitan berarti menghentikan pekerjaan
   * orang yang sedang menunggu nomornya.
   */
  validate(pattern: string): { valid: boolean; errors: string[] } {
    return validatePattern(pattern);
  }

  private async schemeOf(schema: string, schemeId: string): Promise<SchemeRow> {
    const rows = await this.tenantDb.query<SchemeRow>(
      schema,
      `SELECT id::text, code, pattern, number_padding, start_number, reset_period, is_active
         FROM "${schema}".surat_number_scheme
        WHERE id = $1 AND deleted_at IS NULL`,
      [schemeId],
    );

    const scheme = rows[0];
    if (!scheme) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Skema penomoran tidak ditemukan.');
    }
    if (!scheme.is_active) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Skema penomoran ${scheme.code} sudah tidak aktif.`,
      );
    }
    return scheme;
  }
}
