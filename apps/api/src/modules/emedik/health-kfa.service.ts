/**
 * Kerangka impor KFA dan terminologi resmi.
 *
 * Aturannya ada di `health-kfa.ts` sebagai fungsi murni.
 *
 * **Layanan ini tidak mengunduh apa pun.** Berkas datang dari orang yang
 * mengunduhnya dari terbitan resmi, dan yang disimpan di sini adalah berkas itu
 * beserta sidik jarinya — sebab ketika satu harga dipersengketakan, yang
 * ditanyakan adalah apa yang tertulis pada terbitannya, bukan apa yang berhasil
 * dibaca pengimpor kami.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  SUMBER_DATA,
  TERMINOLOGI,
  bolehKlaimResmi,
  bolehPakaiTanpaKfa,
  bolehTerapkan,
  nilaiTanpaKatalog,
  periksaBerkasImpor,
  periksaPemetaanKfa,
  ringkasKatalog,
  type JenisPemetaanKfa,
  type StatusImpor,
  type SumberData,
} from './health-kfa';

@Injectable()
export class HealthKfaService {
  private readonly logger = new Logger(HealthKfaService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  katalog() {
    return {
      terminologies: TERMINOLOGI,
      dataSources: SUMBER_DATA,
      withoutKfa: bolehPakaiTanpaKfa(),
      note:
        'Strukturnya ada, isinya menunggu — dan tanpa isinya sistem berkata "belum dapat ' +
        'dinilai" alih-alih menebak.',
    };
  }

  async kesiapan(schema: string) {
    const baris = await this.tenantDb.query<{
      catalog_code: string;
      catalog_name: string;
      data_source: SumberData;
      edition_ref: string | null;
      edition_date: string | null;
      row_count: number;
      blocker: string | null;
    }>(
      schema,
      `SELECT catalog_code, catalog_name, data_source, edition_ref,
              edition_date::text AS edition_date, row_count, blocker
         FROM "${schema}".terminology_catalog
        WHERE facility_id IS NULL
        ORDER BY catalog_code`,
    );

    return {
      items: baris.map((b) => ({
        code: b.catalog_code,
        name: b.catalog_name,
        dataSource: b.data_source,
        editionRef: b.edition_ref,
        editionDate: b.edition_date,
        rowCount: Number(b.row_count),
        blocker: b.blocker,
        /*
         * Dinyatakan pada setiap baris, bukan hanya pada ringkasannya.
         * Layar yang menampilkan "0 baris" tanpa kalimat ini akan dibaca
         * sebagai "katalognya rusak".
         */
        assessment: Number(b.row_count) === 0 ? nilaiTanpaKatalog(b.catalog_code) : null,
      })),
      summary: ringkasKatalog(
        baris.map((b) => ({ kode: b.catalog_code, jumlahBaris: Number(b.row_count) })),
      ),
    };
  }

  // --- Impor -----------------------------------------------------------------

  async terimaBerkas(
    schema: string,
    input: {
      facilityId: string;
      catalogCode: string;
      fileName: string;
      fileContent: string;
      dataSource: SumberData;
      editionRef?: string | null;
      editionDate?: string | null;
    },
    actorUserId: string,
  ) {
    const sidik = `sha256:${createHash('sha256').update(input.fileContent).digest('hex')}`;
    const izin = periksaBerkasImpor({
      namaBerkas: input.fileName,
      sidikJari: sidik,
      sumber: input.dataSource,
      terbitanRef: input.editionRef ?? null,
      terbitanTanggal: input.editionDate ?? null,
    });
    if (!izin.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }

    const baris = input.fileContent.split(/\r?\n/).filter((b) => b.trim().length > 0);

    try {
      const hasil = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".terminology_import
           (facility_id, catalog_code, file_name, file_hash, file_size_bytes,
            data_source, edition_ref, edition_date, status, row_total, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,'RECEIVED',$9,$10)
         RETURNING id`,
        [
          input.facilityId,
          input.catalogCode,
          input.fileName,
          sidik,
          Buffer.byteLength(input.fileContent),
          input.dataSource,
          input.editionRef ?? null,
          input.editionDate ?? null,
          baris.length,
          actorUserId,
        ],
      );
      return {
        id: hasil[0].id,
        fileHash: sidik,
        rowTotal: baris.length,
        status: 'RECEIVED',
        note:
          'Berkas tersimpan beserta sidik jarinya. Ia BELUM diterapkan — memvalidasi dan ' +
          'menerapkan adalah dua tindakan yang dipegang dua orang.',
      };
    } catch (e) {
      if (String((e as { message?: string }).message ?? '').includes('ux_terminology_import_hash')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Berkas dengan isi yang sama sudah pernah diterima untuk katalog ini. Yang dikenali ' +
            'adalah sidik jari isinya, bukan namanya — berkas yang sama dengan nama berbeda ' +
            'tetap berkas yang sama.',
        );
      }
      throw e;
    }
  }

  async validasi(
    schema: string,
    importId: string,
    input: { rowError: number; errorNote?: string | null },
    actorUserId: string,
  ) {
    const status: StatusImpor = input.rowError > 0 ? 'REJECTED' : 'VALIDATED';
    const baris = await this.tenantDb.query<{ id: string; row_total: number }>(
      schema,
      `UPDATE "${schema}".terminology_import
          SET status = $2, row_error = $3, error_note = $4,
              validated_by = $5, validated_at = now(),
              updated_at = now(), version = version + 1
        WHERE id = $1 AND status = 'RECEIVED'
        RETURNING id, row_total`,
      [importId, status, input.rowError, input.errorNote ?? null, actorUserId],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Impor tidak ditemukan atau bukan lagi berstatus RECEIVED.',
      );
    }
    return {
      id: importId,
      status,
      rowTotal: Number(baris[0].row_total),
      rowError: input.rowError,
      note:
        status === 'REJECTED'
          ? 'DITOLAK. Impor sebagian akan menghasilkan katalog yang separuhnya baru dan ' +
            'separuhnya lama, dan tidak ada yang tahu baris mana yang mana.'
          : 'Divalidasi. Penerapannya dipegang orang lain.',
    };
  }

  async terapkan(schema: string, importId: string, actorUserId: string) {
    return this.tenantDb.transaction(schema, async (client) => {
      const imp = await client.query<{
        status: StatusImpor;
        row_total: number;
        row_error: number;
        validated_by: string | null;
        catalog_code: string;
        data_source: SumberData;
        edition_ref: string | null;
        edition_date: string | null;
      }>(
        `SELECT status, row_total, row_error, validated_by, catalog_code,
                data_source, edition_ref, edition_date::text AS edition_date
           FROM "${schema}".terminology_import WHERE id = $1 FOR UPDATE`,
        [importId],
      );
      if (imp.rowCount === 0) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Impor tidak ditemukan.');
      }
      const i = imp.rows[0];

      const izin = bolehTerapkan({
        status: i.status,
        jumlahBaris: Number(i.row_total),
        jumlahGalat: Number(i.row_error),
        divalidasiOleh: i.validated_by,
        diterapkanOleh: actorUserId,
      });
      if (!izin.boleh) {
        const status403 = izin.alasan.includes('tidak menerapkannya sendiri');
        if (status403) throw AppError.forbidden(ErrorCodes.FORBIDDEN, izin.alasan);
        throw AppError.unprocessable(ErrorCodes.INVALID_STATE_TRANSITION, izin.alasan);
      }

      await client.query(
        `UPDATE "${schema}".terminology_import
            SET status = 'APPLIED', applied_by = $2, applied_at = now(),
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [importId, actorUserId],
      );

      await client.query(
        `UPDATE "${schema}".terminology_catalog
            SET row_count = $2, data_source = $3, edition_ref = $4, edition_date = $5::date,
                last_imported_at = now(), updated_at = now(), version = version + 1
          WHERE facility_id IS NULL AND catalog_code = $1`,
        [i.catalog_code, i.row_total, i.data_source, i.edition_ref, i.edition_date],
      );

      return {
        id: importId,
        status: 'APPLIED',
        catalogCode: i.catalog_code,
        rowCount: Number(i.row_total),
        dataSource: i.data_source,
        note:
          i.data_source === 'OFFICIAL_REFERENCE'
            ? `Katalog ${i.catalog_code} kini bersumber terbitan resmi ${i.edition_ref}.`
            : `Katalog ${i.catalog_code} bersumber ${i.data_source} — ia TIDAK boleh diklaim ` +
              'sebagai rujukan resmi, dan penandanya tidak dapat dilepas.',
      };
    });
  }

  async daftarImpor(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, catalog_code, file_name, file_hash, data_source, edition_ref,
              edition_date::text AS edition_date, status, row_total, row_error,
              received_at, validated_at, applied_at
         FROM "${schema}".terminology_import
        WHERE facility_id = $1
        ORDER BY received_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  // --- Pemetaan KFA ----------------------------------------------------------

  async petakan(
    schema: string,
    input: {
      facilityId: string;
      mappingKind: JenisPemetaanKfa;
      kfaCode: string;
      kfaName?: string | null;
      localKind: string;
      localId: string;
      localName?: string | null;
      mappingMethod: 'MANUAL' | 'IMPORTED' | 'NAME_SIMILARITY';
      note?: string | null;
    },
    actorUserId: string,
  ) {
    const izin = periksaPemetaanKfa({
      jenis: input.mappingKind,
      kodeKfa: input.kfaCode,
      produkLokalId: input.localId,
      dipetakanOleh: actorUserId,
      caraPemetaan: input.mappingMethod,
    });
    if (!izin.sah) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.alasan);
    }

    try {
      const baris = await this.tenantDb.query<{ id: string }>(
        schema,
        `INSERT INTO "${schema}".kfa_mapping
           (facility_id, mapping_kind, kfa_code, kfa_name, local_kind, local_id, local_name,
            mapping_method, mapped_by, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          input.facilityId,
          input.mappingKind,
          input.kfaCode,
          input.kfaName ?? null,
          input.localKind,
          input.localId,
          input.localName ?? null,
          input.mappingMethod,
          actorUserId,
          input.note ?? null,
        ],
      );
      return { id: baris[0].id, kfaCode: input.kfaCode, method: input.mappingMethod };
    } catch (e) {
      if (String((e as { message?: string }).message ?? '').includes('ux_kfa_mapping_local')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Produk ini sudah dipetakan. Pemetaan lama dinonaktifkan lebih dahulu, bukan ' +
            'ditimpa — pertanyaan "obat ini dulu dipetakan ke kode mana" muncul persis ketika ' +
            'ada kiriman lama yang dipersengketakan.',
        );
      }
      throw e;
    }
  }

  async daftarPemetaan(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT id, mapping_kind, kfa_code, kfa_name, local_kind, local_name,
              mapping_method, mapped_at, is_active
         FROM "${schema}".kfa_mapping
        WHERE facility_id = $1
        ORDER BY is_active DESC, mapped_at DESC
        LIMIT 200`,
      [facilityId],
    );
  }

  /**
   * Apakah satu produk dapat dikirim ke SATUSEHAT?
   *
   * Jawabannya membedakan **dapat dipakai** dari **dapat dikirim**, dan
   * perbedaan itulah seluruh isi fase ini.
   */
  async kesiapanKirim(schema: string, facilityId: string, localId: string) {
    const baris = await this.tenantDb.query<{ kfa_code: string }>(
      schema,
      `SELECT kfa_code FROM "${schema}".kfa_mapping
        WHERE facility_id = $1 AND local_id = $2 AND is_active = TRUE`,
      [facilityId, localId],
    );
    const terpeta = baris.length > 0;
    const tanpa = bolehPakaiTanpaKfa();
    return {
      localId,
      mapped: terpeta,
      kfaCode: baris[0]?.kfa_code ?? null,
      usableInHospital: true,
      sendableToSatusehat: terpeta,
      note: terpeta
        ? `Terpetakan ke ${baris[0].kfa_code}; dapat dipakai dan dapat dikirim.`
        : tanpa.keterangan,
    };
  }

  /** Katalog yang boleh diklaim resmi, beserta alasannya. */
  periksaKlaimResmi(input: {
    dataSource: SumberData;
    editionRef?: string | null;
    editionDate?: string | null;
  }) {
    return bolehKlaimResmi({
      sumber: input.dataSource,
      terbitanRef: input.editionRef ?? null,
      terbitanTanggal: input.editionDate ?? null,
    });
  }
}
