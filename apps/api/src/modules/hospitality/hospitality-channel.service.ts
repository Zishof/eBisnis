import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  JENIS_PEKERJAAN_DISTRIBUSI,
  hashPayload,
  sanitasiPayload,
  type JenisPekerjaanDistribusi,
} from './hospitality-channel';

export interface MasukanAkunChannel {
  code: string;
  providerKey: string;
  displayName: string;
  channelType: string;
}

export interface MasukanPekerjaanDistribusi {
  type: JenisPekerjaanDistribusi;
  sourceVersion: string;
  idempotencyKey: string;
  correlationId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class HospitalityChannelService {
  constructor(private readonly tenantDb: TenantConnectionService) {}

  daftarAkun(schemaName: string, propertyId: string) {
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT id::text, property_id::text, code, provider_key, display_name, channel_type,
              adapter_version, status, last_success_at, last_failure_at
         FROM ${S}.hospitality_channel_account
        WHERE property_id = $1 AND deleted_at IS NULL ORDER BY display_name`,
      [propertyId],
    );
  }

  async catatAkun(schemaName: string, propertyId: string, input: MasukanAkunChannel, actorId: string) {
    for (const [field, value] of Object.entries(input)) {
      if (!value?.trim()) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, `${field} wajib diisi.`);
    }
    const S = `"${schemaName}"`;
    const property = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.hospitality_property WHERE id = $1 AND deleted_at IS NULL`,
      [propertyId],
    );
    if (!property) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    const status = input.providerKey.trim().toUpperCase() === 'TEST' ? 'TEST_READY' : 'BLOCKED_PROVIDER_INPUT';
    const rows = await this.tenantDb.query(
      schemaName,
      `INSERT INTO ${S}.hospitality_channel_account
         (property_id, code, provider_key, display_name, channel_type, status, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7)
       RETURNING id::text, property_id::text, code, provider_key, display_name, channel_type, status`,
      [propertyId, input.code.trim(), input.providerKey.trim(), input.displayName.trim(), input.channelType, status, actorId],
    );
    return rows[0];
  }

  async aturMapping(
    schemaName: string,
    propertyId: string,
    accountId: string,
    input: { resourceType: string; localId: string; providerCode: string; providerParentCode?: string },
  ) {
    const S = `"${schemaName}"`;
    const sumber =
      input.resourceType === 'PROPERTY'
        ? `SELECT id FROM ${S}.hospitality_property WHERE id=$3 AND id=$2 AND deleted_at IS NULL`
        : input.resourceType === 'ROOM_TYPE'
          ? `SELECT id FROM ${S}.hospitality_room_type WHERE id=$3 AND property_id=$2 AND deleted_at IS NULL`
          : `SELECT rp.id FROM ${S}.hospitality_rate_plan rp
               JOIN ${S}.hospitality_room_type rt ON rt.id=rp.room_type_id
              WHERE rp.id=$3 AND rt.property_id=$2 AND rp.deleted_at IS NULL AND rt.deleted_at IS NULL`;
    const valid = await this.tenantDb.queryOne(
      schemaName,
      `SELECT 1 FROM ${S}.hospitality_channel_account ca
        WHERE ca.id=$1 AND ca.property_id=$2 AND ca.deleted_at IS NULL
          AND EXISTS (${sumber})`,
      [accountId, propertyId, input.localId],
    );
    if (!valid) {
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Akun channel dan resource mapping tidak ditemukan pada properti yang sama.',
      );
    }
    const rows = await this.tenantDb.query(
      schemaName,
      `INSERT INTO ${S}.hospitality_channel_mapping
         (channel_account_id, resource_type, local_id, provider_code, provider_parent_code)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (channel_account_id, resource_type, local_id)
       DO UPDATE SET provider_code=EXCLUDED.provider_code,
                     provider_parent_code=EXCLUDED.provider_parent_code,
                     updated_at=now(), version=${S}.hospitality_channel_mapping.version+1
       RETURNING id::text, channel_account_id::text, resource_type, local_id::text,
                 provider_code, provider_parent_code, status`,
      [accountId, input.resourceType, input.localId, input.providerCode.trim(), input.providerParentCode?.trim() || null],
    );
    return rows[0];
  }

  async antrekan(
    schemaName: string,
    propertyId: string,
    accountId: string,
    input: MasukanPekerjaanDistribusi,
  ) {
    if (!JENIS_PEKERJAAN_DISTRIBUSI.includes(input.type)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jenis pekerjaan distribusi tidak dikenal.');
    }
    if (!input.sourceVersion?.trim() || !input.idempotencyKey?.trim() || !input.correlationId?.trim()) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'sourceVersion, idempotencyKey, dan correlationId wajib diisi.');
    }
    const S = `"${schemaName}"`;
    const payload = sanitasiPayload(input.payload);
    const payloadHash = hashPayload(payload);
    const rows = await this.tenantDb.query<{ id: string; payload_hash: string; status: string }>(
      schemaName,
      `INSERT INTO ${S}.hospitality_distribution_job
         (property_id, channel_account_id, job_type, source_version, idempotency_key,
          correlation_id, payload_sanitized, payload_hash)
       SELECT $1,$2,$3,$4,$5,$6,$7::jsonb,$8
        WHERE EXISTS (
          SELECT 1 FROM ${S}.hospitality_channel_account
           WHERE id=$2 AND property_id=$1 AND deleted_at IS NULL
        )
       ON CONFLICT (channel_account_id, idempotency_key)
       DO UPDATE SET updated_at=${S}.hospitality_distribution_job.updated_at
       RETURNING id::text, payload_hash, status`,
      [propertyId, accountId, input.type, input.sourceVersion, input.idempotencyKey, input.correlationId, JSON.stringify(payload), payloadHash],
    );
    if (!rows[0]) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Akun channel tidak ditemukan pada properti ini.');
    if (rows[0].payload_hash !== payloadHash) {
      throw AppError.conflict(ErrorCodes.CONFLICT, 'Idempotency key sudah dipakai dengan payload berbeda.');
    }
    return rows[0];
  }

  daftarPekerjaan(schemaName: string, propertyId: string, status?: string) {
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT id::text, channel_account_id::text, job_type, source_version, correlation_id,
              payload_hash, status, retry_count, max_retry, next_attempt_at,
              provider_message_id, acknowledged_at, error_code, error_message, created_at
         FROM ${S}.hospitality_distribution_job
        WHERE property_id=$1 AND ($2::varchar IS NULL OR status=$2)
        ORDER BY created_at DESC LIMIT 200`,
      [propertyId, status || null],
    );
  }

  daftarRekonsiliasi(schemaName: string, propertyId: string, status = 'OPEN') {
    const S = `"${schemaName}"`;
    return this.tenantDb.query(
      schemaName,
      `SELECT id::text, channel_account_id::text, distribution_job_id::text,
              exception_type, severity, status, summary, created_at
         FROM ${S}.hospitality_channel_reconciliation_exception
        WHERE property_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT 200`,
      [propertyId, status],
    );
  }
}
