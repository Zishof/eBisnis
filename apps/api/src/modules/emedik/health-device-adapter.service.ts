/**
 * Adapter protokol alat: penerimaan pesan, penguraian, dan pemetaan istilah.
 *
 * Aturannya ada di `health-device-adapter.ts` sebagai fungsi murni.
 *
 * **Pesan disimpan LEBIH DAHULU, diurai kemudian.**
 *
 * Urutan itu disengaja dan ia yang paling penting pada berkas ini. Menyimpan
 * sesudah berhasil diurai berarti pesan yang gagal diurai tidak pernah ada —
 * dan pesan yang gagal diurai justru satu-satunya petunjuk tentang alat yang
 * firmware-nya baru diperbarui. Alat itu akan terus mengirim pesan cacat sampai
 * ada yang melihatnya, dan tidak akan ada yang melihatnya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  PROTOKOL_ADAPTER,
  bolehUrai,
  petakanKode,
  punyaPengurai,
  susunAck,
  uraiAstm,
  uraiHl7,
  type HasilUrai,
  type PetaKode,
} from './health-device-adapter';

@Injectable()
export class HealthDeviceAdapterService {
  private readonly logger = new Logger(HealthDeviceAdapterService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  daftarProtokol() {
    return {
      protocols: Object.entries(PROTOKOL_ADAPTER).map(([code, p]) => ({
        code,
        ready: p.siap,
        hasParser: punyaPengurai(code),
        blockedBy: p.penghalang,
      })),
      note:
        'Yang terhalang menyebutkan penghalangnya. Adapter yang hanya berkata "tidak didukung" ' +
        'akan ditanyakan ulang setiap tiga bulan oleh orang yang berbeda, dan salah satu di ' +
        'antaranya akan menuliskannya sendiri.',
    };
  }

  /**
   * Menerima satu pesan dari gateway.
   *
   * Menyimpan lebih dahulu, mengurai kemudian, dan **membalas ACK apa pun
   * hasilnya**. Alat yang tidak menerima balasan akan mengirim ulang.
   */
  async terimaPesan(
    schema: string,
    input: {
      facilityId: string;
      deviceId?: string | null;
      gatewayId?: string | null;
      sourceProtocol: string;
      rawMessage: string;
    },
    actorUserId: string,
  ) {
    const izin = bolehUrai(input.sourceProtocol);
    if (!izin.boleh) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.pesan);
    }
    if (!punyaPengurai(input.sourceProtocol)) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Protokol ${input.sourceProtocol} boleh dipakai alat, tetapi jalur ini hanya mengurai ` +
          'HL7 v2 dan ASTM. Pesan protokol lain masuk lewat adapternya sendiri, dan adapter ' +
          'itu belum ada.',
      );
    }

    const sidik = `sha256:${createHash('sha256').update(input.rawMessage).digest('hex')}`;
    const hasil: HasilUrai =
      input.sourceProtocol === 'HL7V2' ? uraiHl7(input.rawMessage) : uraiAstm(input.rawMessage);
    const ack = susunAck({
      messageControlId: hasil.messageControlId,
      diterima: hasil.valid,
      temuan: hasil.temuan,
    });

    return this.tenantDb.transaction(schema, async (client) => {
      let baris;
      try {
        baris = await client.query<{ id: string }>(
          `INSERT INTO "${schema}".device_inbound_message
             (facility_id, device_id, gateway_id, source_protocol, raw_message, raw_message_hash,
              message_control_id, message_type, parse_status, parse_findings,
              order_identifier, patient_identifier, device_identifier, observation_count,
              ack_code, ack_message)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16)
           RETURNING id`,
          [
            input.facilityId,
            input.deviceId ?? null,
            input.gatewayId ?? null,
            input.sourceProtocol,
            input.rawMessage,
            sidik,
            hasil.messageControlId,
            hasil.messageType,
            hasil.valid ? 'PARSED' : 'FAILED',
            JSON.stringify(hasil.temuan),
            hasil.orderId,
            hasil.patientIdentifier,
            hasil.deviceIdentifier,
            hasil.observations.length,
            ack.kode,
            ack.teks,
          ],
        );
      } catch (e) {
        if (String((e as { message?: string }).message ?? '').includes('ux_device_msg_hash')) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Pesan yang sama sudah pernah diterima dari alat ini. Alat yang menyimpan hasil ' +
              'selama jaringan terputus akan mengirim ulang seluruh simpanannya begitu ' +
              'tersambung; yang dikenali adalah sidik jari isinya, bukan waktunya.',
          );
        }
        throw e;
      }

      const messageId = baris.rows[0].id;

      // Kode yang belum terpeta dicatat pada antrean — tidak ditebak.
      const peta = input.deviceId
        ? await this.bacaPeta(client, schema, input.facilityId, input.deviceId)
        : [];
      const belumTerpeta: string[] = [];
      for (const o of hasil.observations) {
        if (!o.observationCode) continue;
        const hasilPeta = petakanKode(o.observationCode, peta, o.observationUnit);
        if (!hasilPeta.terpetakan) {
          belumTerpeta.push(o.observationCode);
          await client.query(
            `INSERT INTO "${schema}".device_code_pending
               (facility_id, device_id, device_code, device_unit, sample_value)
             VALUES ($1,$2,$3,$4,$5)
             ON CONFLICT (facility_id, COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid), upper(device_code))
               WHERE resolved_at IS NULL
             DO UPDATE SET occurrence_count = "${schema}".device_code_pending.occurrence_count + 1,
                           last_seen_at = now()`,
            [
              input.facilityId,
              input.deviceId ?? null,
              o.observationCode,
              o.observationUnit,
              o.observationValue,
            ],
          );
        }
      }

      await client.query(
        `UPDATE "${schema}".device_inbound_message SET processed_at = now() WHERE id = $1`,
        [messageId],
      );

      this.logger.log(
        `Pesan ${input.sourceProtocol} diterima (${hasil.valid ? 'terurai' : 'gagal'}) oleh ${actorUserId}`,
      );

      return {
        id: messageId,
        parseStatus: hasil.valid ? 'PARSED' : 'FAILED',
        /*
         * Pesan yang GAGAL diurai tetap mengembalikan 201.
         *
         * Ia memang tersimpan, dan itulah yang dimaksudkan. Mengembalikan galat
         * akan membuat gateway menganggapnya tidak terkirim lalu mengirim
         * ulang — dan pesan yang cacat karena isinya akan tetap cacat berapa
         * kali pun dikirim ulang.
         */
        stored: true,
        findings: hasil.temuan,
        messageControlId: hasil.messageControlId,
        messageType: hasil.messageType,
        orderId: hasil.orderId,
        patientIdentifier: hasil.patientIdentifier,
        observationCount: hasil.observations.length,
        unmappedCodes: belumTerpeta,
        ack: ack.teks,
        ackCode: ack.kode,
        note:
          'Pesan disimpan apa adanya sebelum diurai. Yang gagal diurai tetap tersimpan beserta ' +
          'sebabnya — pesan cacat yang dibuang menghilangkan satu-satunya petunjuk tentang alat ' +
          'yang firmware-nya baru diperbarui.',
      };
    });
  }

  /** Menguraikan satu pesan tanpa menyimpannya. Untuk memeriksa sebelum memasang. */
  uraiSaja(input: { sourceProtocol: string; rawMessage: string }) {
    const izin = bolehUrai(input.sourceProtocol);
    if (!izin.boleh) {
      throw AppError.unprocessable(ErrorCodes.VALIDATION_FAILED, izin.pesan);
    }
    if (!punyaPengurai(input.sourceProtocol)) {
      throw AppError.unprocessable(
        ErrorCodes.VALIDATION_FAILED,
        `Jalur ini hanya mengurai HL7 v2 dan ASTM; ${input.sourceProtocol} belum berpengurai.`,
      );
    }
    const hasil =
      input.sourceProtocol === 'HL7V2' ? uraiHl7(input.rawMessage) : uraiAstm(input.rawMessage);
    return {
      ...hasil,
      dryRun: true,
      note: 'Tidak menyimpan apa pun. Dipakai untuk memeriksa bentuk pesan sebelum alat dipasang.',
    };
  }

  async daftarPesan(
    schema: string,
    filter: { facilityId: string; failedOnly?: boolean },
  ) {
    const syarat = ['facility_id = $1'];
    if (filter.failedOnly) syarat.push("parse_status <> 'PARSED'");
    return this.tenantDb.query(
      schema,
      `SELECT id, source_protocol, message_control_id, message_type, parse_status,
              parse_findings, order_identifier, patient_identifier, device_identifier,
              observation_count, ack_code, received_at, processed_at,
              length(raw_message) AS raw_length
         FROM "${schema}".device_inbound_message
        WHERE ${syarat.join(' AND ')}
        ORDER BY received_at DESC
        LIMIT 200`,
      [filter.facilityId],
    );
  }

  /**
   * Membaca satu pesan beserta isinya apa adanya.
   *
   * Inilah yang dibuka ketika hasilnya dipersengketakan.
   */
  async bacaPesan(schema: string, messageId: string) {
    const baris = await this.tenantDb.query<Record<string, unknown>>(
      schema,
      `SELECT id, source_protocol, raw_message, raw_message_hash, message_control_id,
              message_type, parse_status, parse_findings, ack_code, ack_message,
              received_at, processed_at
         FROM "${schema}".device_inbound_message WHERE id = $1`,
      [messageId],
    );
    if (baris.length === 0) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pesan tidak ditemukan.');
    }
    return {
      ...baris[0],
      note:
        'Pesan asli, apa adanya. Sidik jarinya menjawab pertanyaan yang muncul ketika hasilnya ' +
        'dipersengketakan: apakah yang tersimpan sama dengan yang dikirim alat.',
    };
  }

  // --- Pemetaan kode ---------------------------------------------------------

  async petakan(
    schema: string,
    input: {
      facilityId: string;
      deviceId?: string | null;
      deviceCode: string;
      localCode: string;
      deviceUnit?: string | null;
      localUnit?: string | null;
      note?: string | null;
    },
    actorUserId: string,
  ) {
    return this.tenantDb.transaction(schema, async (client) => {
      const ada = await client.query<{ id: string; local_code: string }>(
        `SELECT id, local_code FROM "${schema}".device_code_map
          WHERE facility_id = $1
            AND COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid)
                = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
            AND upper(device_code) = upper($3) AND is_active = TRUE`,
        [input.facilityId, input.deviceId ?? null, input.deviceCode],
      );
      if ((ada.rowCount ?? 0) > 0) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Kode "${input.deviceCode}" sudah dipetakan ke ${ada.rows[0].local_code}. Pemetaan ` +
            'lama dinonaktifkan lebih dahulu, bukan ditimpa — pertanyaan "kode ini dulu ' +
            'dipetakan ke mana" muncul persis ketika ada hasil lama yang dipersengketakan.',
        );
      }

      const baris = await client.query<{ id: string }>(
        `INSERT INTO "${schema}".device_code_map
           (facility_id, device_id, device_code, local_code, device_unit, local_unit,
            mapped_by, note)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
        [
          input.facilityId,
          input.deviceId ?? null,
          input.deviceCode,
          input.localCode,
          input.deviceUnit ?? null,
          input.localUnit ?? null,
          actorUserId,
          input.note ?? null,
        ],
      );

      const selesai = await client.query(
        `UPDATE "${schema}".device_code_pending
            SET resolved_at = now(), resolved_by = $4, resolved_map_id = $5
          WHERE facility_id = $1
            AND COALESCE(device_id, '00000000-0000-0000-0000-000000000000'::uuid)
                = COALESCE($2::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
            AND upper(device_code) = upper($3) AND resolved_at IS NULL`,
        [
          input.facilityId,
          input.deviceId ?? null,
          input.deviceCode,
          actorUserId,
          baris.rows[0].id,
        ],
      );

      return {
        id: baris.rows[0].id,
        deviceCode: input.deviceCode,
        localCode: input.localCode,
        resolvedPending: selesai.rowCount ?? 0,
      };
    });
  }

  async nonaktifkanPemetaan(schema: string, mapId: string, actorUserId: string) {
    const baris = await this.tenantDb.query<{ id: string }>(
      schema,
      `UPDATE "${schema}".device_code_map
          SET is_active = FALSE, updated_at = now(), version = version + 1
        WHERE id = $1 AND is_active = TRUE RETURNING id`,
      [mapId],
    );
    if (baris.length === 0) {
      throw AppError.conflict(
        ErrorCodes.INVALID_STATE_TRANSITION,
        'Pemetaan tidak ditemukan atau sudah tidak aktif.',
      );
    }
    this.logger.log(`Pemetaan ${mapId} dinonaktifkan oleh ${actorUserId}`);
    return {
      id: mapId,
      active: false,
      note:
        'Barisnya tetap tersimpan sebagai riwayat. Pemetaan yang dihapus membuat hasil lama ' +
        'tidak dapat dijelaskan lagi.',
    };
  }

  async daftarPemetaan(schema: string, facilityId: string) {
    return this.tenantDb.query(
      schema,
      `SELECT m.id, m.device_code, m.local_code, m.device_unit, m.local_unit,
              m.is_active, m.mapped_at, m.note, d.code AS device_code_ref
         FROM "${schema}".device_code_map m
         LEFT JOIN "${schema}".medical_device d ON d.id = m.device_id
        WHERE m.facility_id = $1
        ORDER BY m.is_active DESC, m.device_code`,
      [facilityId],
    );
  }

  /** Antrean kode yang belum terpeta, terurut menurut yang paling sering muncul. */
  async antreanPemetaan(schema: string, facilityId: string) {
    const baris = await this.tenantDb.query(
      schema,
      `SELECT p.id, p.device_code, p.device_unit, p.sample_value, p.occurrence_count,
              p.first_seen_at, p.last_seen_at, d.code AS device_code_ref
         FROM "${schema}".device_code_pending p
         LEFT JOIN "${schema}".medical_device d ON d.id = p.device_id
        WHERE p.facility_id = $1 AND p.resolved_at IS NULL
        ORDER BY p.occurrence_count DESC, p.first_seen_at
        LIMIT 200`,
      [facilityId],
    );
    return {
      items: baris,
      note:
        'Terurut menurut yang paling sering muncul, bukan menurut yang paling baru. Kode yang ' +
        'muncul tiga ratus kali sehari menahan tiga ratus hasil; kode yang muncul sekali ' +
        'mungkin salah ketik pada alatnya.',
    };
  }

  private async bacaPeta(
    client: PoolClient,
    schema: string,
    facilityId: string,
    deviceId: string,
  ): Promise<PetaKode[]> {
    const baris = await client.query<{
      device_code: string;
      local_code: string;
      device_unit: string | null;
      local_unit: string | null;
    }>(
      `SELECT device_code, local_code, device_unit, local_unit
         FROM "${schema}".device_code_map
        WHERE facility_id = $1 AND is_active = TRUE
          AND (device_id IS NULL OR device_id = $2)`,
      [facilityId, deviceId],
    );
    return baris.rows.map((b) => ({
      kodeAlat: b.device_code,
      kodeLokal: b.local_code,
      satuanAlat: b.device_unit,
      satuanLokal: b.local_unit,
    }));
  }
}
