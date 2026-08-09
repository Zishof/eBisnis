import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TenantConnectionService, AuditContext } from '../../infrastructure/database/tenant-connection.service';
import { AuditService } from '../../infrastructure/audit/audit.service';
import { TenantPermissionService } from '../auth/tenant-permission.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { BaseQueryDto, PagedResult, paged } from '../../common/dto/base-query.dto';
import { findMasterResource, MasterResourceDefinition } from './master-resource.registry';

const IDENT = /^[a-z_][a-z0-9_]*$/;

/** Ditulis ke field sensitif yang disamarkan. Bukan `null`: pemanggil tanpa
 * hak lihat tetap tahu datanya ADA, hanya tidak boleh melihat isinya --
 * membedakan "kosong" dari "disembunyikan" berarti kolom yang benar-benar
 * kosong tidak mengarahkan orang mencari data yang memang tidak pernah ada. */
export const NILAI_DISAMARKAN = '••• disembunyikan •••';

/**
 * Transformasi murni: menyamarkan `fields` pada setiap baris bila `revealed`
 * salah. Dipisah dari `MasterLifecycleService.samarkan()` (yang melakukan
 * pemeriksaan hak akses sungguhan lewat basis data) supaya aturan
 * "kosong tetap kosong, terisi menjadi disamarkan" dapat diuji tanpa basis
 * data maupun mock permission service.
 */
export function maskFields<T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
  revealed: boolean,
): T[] {
  if (revealed || !fields.length) return rows;
  return rows.map((row) => {
    const masked = { ...row };
    for (const field of fields) {
      if (masked[field] !== null && masked[field] !== undefined && masked[field] !== '') {
        (masked as Record<string, unknown>)[field] = NILAI_DISAMARKAN;
      }
    }
    return masked;
  });
}

/**
 * Sama seperti [maskFields], tetapi untuk baris riwayat audit: nilai sensitif
 * hidup DI DALAM `old_data`/`new_data` (snapshot JSONB baris penuh yang
 * ditulis trigger basis data), bukan sebagai kolom pada baris itu sendiri.
 * `list()`/`findById()` sudah menyamarkan lewat [maskFields]; audit trail
 * TIDAK -- ditemukan lewat audit langsung: siapa pun dengan AUDIT_READ bisa
 * membaca nomor rekening penuh dari riwayat perubahan walau tidak punya
 * VIEW_BANK_DETAILS.
 */
export function maskAuditRows<T extends Record<string, unknown>>(
  rows: T[],
  fields: readonly string[],
  revealed: boolean,
): T[] {
  if (revealed || !fields.length) return rows;
  const maskSnapshot = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    const [masked] = maskFields([value as Record<string, unknown>], fields, false);
    return masked;
  };
  return rows.map((row) => ({
    ...row,
    old_data: maskSnapshot(row.old_data),
    new_data: maskSnapshot(row.new_data),
  }));
}

/**
 * Nilai yang dicocokkan pada reference check sebelum purge. Referensi
 * langsung (mis. `pos_sale.customer_id`) dicocokkan terhadap `id` record
 * yang akan dihapus. Referensi TIDAK langsung (`viaColumn` diisi, mis.
 * salesperson: transaksi menunjuk `user_subject_id` milik salesperson,
 * bukan id profil salesperson-nya sendiri) dicocokkan terhadap
 * `record[viaColumn]`. Mengembalikan `null`/`undefined` berarti reference
 * tsb harus dilewati (kolom via belum terisi pada record ini, sehingga
 * tidak ada apa pun yang bisa direferensikan lewatnya).
 */
export function resolveReferenceMatchValue(
  record: Record<string, unknown>,
  id: string,
  viaColumn?: string,
): unknown {
  return viaColumn ? record[viaColumn] : id;
}

export interface LifecycleContext {
  schemaName: string;
  tenantId?: string;
  userId: string;
  username: string;
  isDemo: boolean;
  activeRoleId: string | null;
  audit: AuditContext;
}

export interface ReferenceReport {
  resourceCode: string;
  recordId: string;
  canPurge: boolean;
  policy: string;
  references: Array<{ table: string; column: string; label: string; count: number; isTransactional: boolean }>;
}

/**
 * Lifecycle master Versi 5:
 *   isActive=false  → mekanisme nonaktif utama
 *   deletedAt       → soft delete, audit dan referensi tetap terjaga
 *   purge           → hard delete, butuh permission HARD_DELETE + step-up +
 *                     alasan + reference check + audit
 *
 * Query normal HANYA menampilkan is_active = TRUE AND deleted_at IS NULL.
 */
@Injectable()
export class MasterLifecycleService {
  private readonly logger = new Logger(MasterLifecycleService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly audit: AuditService,
    private readonly izin: TenantPermissionService,
  ) {}

  /**
   * Menyamarkan `definition.sensitiveFields` pada baris yang dikembalikan,
   * kecuali pemanggil punya `<menuCode>.VIEW_BANK_DETAILS`.
   *
   * Dipanggil pada `list()`/`findById()` -- jalan baca umum. TIDAK dipanggil
   * pada `create()`/`update()`: nilai yang baru saja ditulis pemanggil
   * sendiri sudah diketahuinya, menyamarkannya di sana hanya membuat formulir
   * sunting terlihat kehilangan data yang baru saja diisi.
   */
  private async samarkan(
    ctx: LifecycleContext,
    definition: MasterResourceDefinition,
    rows: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    if (!definition.sensitiveFields?.length || !rows.length) return rows;
    const permission = `${definition.menuCode}.VIEW_BANK_DETAILS`;
    const kurang = await this.izin.findMissing(ctx.schemaName, ctx.userId, [permission], {
      isDemo: ctx.isDemo,
      activeRoleId: ctx.activeRoleId,
    });
    return maskFields(rows, definition.sensitiveFields, kurang.length === 0);
  }

  resource(resourceCode: string): MasterResourceDefinition {
    const definition = findMasterResource(resourceCode);
    if (!definition) {
      throw AppError.notFound(
        ErrorCodes.RESOURCE_NOT_CONFIGURED,
        `Resource master "${resourceCode}" tidak terdaftar.`,
      );
    }
    return definition;
  }

  async list(
    ctx: LifecycleContext,
    resourceCode: string,
    query: BaseQueryDto,
    extraFilters: Record<string, string> = {},
  ): Promise<PagedResult<Record<string, unknown>>> {
    const definition = this.resource(resourceCode);
    const table = ident(definition.table);
    const S = `"${ctx.schemaName}"`;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!query.includeDeleted) conditions.push('deleted_at IS NULL');
    if (!query.includeInactive) conditions.push('is_active = TRUE');
    if (query.onlySample) conditions.push('is_sample = TRUE');

    if (query.search) {
      const searchable = definition.searchableFields.filter((field) => IDENT.test(field));
      if (searchable.length) {
        params.push(`%${query.search}%`);
        const index = params.length;
        conditions.push(
          `(${searchable.map((field) => `"${field}"::text ILIKE $${index}`).join(' OR ')})`,
        );
      }
    }

    // Filter tambahan hanya diterima untuk field yang ada pada whitelist.
    for (const [field, value] of Object.entries(extraFilters)) {
      if (!definition.writableFields.includes(field) && field !== 'id') continue;
      if (!IDENT.test(field)) continue;
      params.push(value);
      conditions.push(`"${field}"::text = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortField =
      query.sortBy && definition.sortableFields.includes(query.sortBy)
        ? query.sortBy
        : definition.defaultSort;
    const sortDir = query.sortDir === 'desc' ? 'DESC' : 'ASC';

    const selectFields = definition.selectFields
      .filter((field) => IDENT.test(field))
      .map((field) => `"${field}"`)
      .join(', ');

    const countRows = await this.tenantDb.query<{ total: string }>(
      ctx.schemaName,
      `SELECT count(*)::text AS total FROM ${S}."${table}" ${where}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? '0');

    const items = await this.tenantDb.query<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT ${selectFields} FROM ${S}."${table}" ${where}
       ORDER BY "${ident(sortField)}" ${sortDir}, id ASC
       LIMIT ${query.pageSize} OFFSET ${query.skip}`,
      params,
    );

    return paged(await this.samarkan(ctx, definition, items), total, query);
  }

  async findById(
    ctx: LifecycleContext,
    resourceCode: string,
    id: string,
  ): Promise<Record<string, unknown>> {
    const definition = this.resource(resourceCode);
    const row = await this.tenantDb.queryOne<Record<string, unknown>>(
      ctx.schemaName,
      `SELECT * FROM "${ctx.schemaName}"."${ident(definition.table)}" WHERE id = $1`,
      [id],
    );
    if (!row) {
      // Cross-tenant / tidak ada → 404 tanpa membocorkan keberadaan data.
      throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
    }
    return (await this.samarkan(ctx, definition, [row]))[0];
  }

  async create(
    ctx: LifecycleContext,
    resourceCode: string,
    payload: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const definition = this.resource(resourceCode);
    const data = this.pickWritable(definition, payload);

    if (!data.code) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Field "code" wajib diisi.');
    }
    if (!data.name) data.name = String(data.code);

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        await this.assertForeignKeys(client, ctx.schemaName, definition, data);

        const duplicate = await client.query(
          `SELECT 1 FROM "${ctx.schemaName}"."${ident(definition.table)}"
           WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
          [data.code],
        );
        if (duplicate.rowCount) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `${definition.label} dengan kode "${String(data.code)}" sudah ada.`,
          );
        }

        const columns = Object.keys(data).map(ident);
        const placeholders = columns.map((_, index) => `$${index + 1}`);
        columns.push('created_by', 'updated_by');
        placeholders.push(`$${columns.length - 1}`, `$${columns.length}`);

        const inserted = await client.query<Record<string, unknown>>(
          `INSERT INTO "${ctx.schemaName}"."${ident(definition.table)}"
             (${columns.map((c) => `"${c}"`).join(', ')})
           VALUES (${placeholders.join(', ')})
           RETURNING *`,
          [...Object.values(data), ctx.userId, ctx.userId],
        );

        const row = inserted.rows[0];
        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'CREATE',
          entityType: definition.table,
          entityId: String(row.id),
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { resourceCode, code: data.code },
        });
        return row;
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'CREATE' },
    );
  }

  async update(
    ctx: LifecycleContext,
    resourceCode: string,
    id: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
  ): Promise<Record<string, unknown>> {
    const definition = this.resource(resourceCode);
    const data = this.pickWritable(definition, payload);
    if (!Object.keys(data).length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Tidak ada field yang dapat diubah.');
    }

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const current = await client.query<{ id: string; version: number; is_system: boolean; deleted_at: Date | null }>(
          `SELECT id, version, is_system, deleted_at
           FROM "${ctx.schemaName}"."${ident(definition.table)}" WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const row = current.rows[0];
        if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        if (row.deleted_at) {
          throw AppError.conflict(
            ErrorCodes.RECORD_ALREADY_DELETED,
            'Record sudah dihapus. Pulihkan terlebih dahulu sebelum mengubah.',
          );
        }
        if (expectedVersion !== undefined && row.version !== expectedVersion) {
          throw AppError.conflict(
            ErrorCodes.VERSION_CONFLICT,
            'Data telah diubah pengguna lain. Muat ulang lalu coba lagi.',
            { currentVersion: row.version },
          );
        }

        await this.assertForeignKeys(client, ctx.schemaName, definition, data);

        if (data.code) {
          const duplicate = await client.query(
            `SELECT 1 FROM "${ctx.schemaName}"."${ident(definition.table)}"
             WHERE code = $1 AND id <> $2 AND deleted_at IS NULL LIMIT 1`,
            [data.code, id],
          );
          if (duplicate.rowCount) {
            throw AppError.conflict(ErrorCodes.CONFLICT, `Kode "${String(data.code)}" sudah dipakai.`);
          }
        }

        const entries = Object.entries(data);
        const sets = entries.map(([field], index) => `"${ident(field)}" = $${index + 2}`);
        sets.push('updated_at = now()', `updated_by = $${entries.length + 2}`, 'version = version + 1');

        const updated = await client.query<Record<string, unknown>>(
          `UPDATE "${ctx.schemaName}"."${ident(definition.table)}"
           SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
          [id, ...entries.map(([, value]) => value), ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'UPDATE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
          metadata: { resourceCode, changedFields: Object.keys(data) },
        });
        return updated.rows[0];
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'UPDATE' },
    );
  }

  /** isActive=false — mekanisme nonaktif utama. */
  async deactivate(ctx: LifecycleContext, resourceCode: string, id: string, reason?: string) {
    const definition = this.resource(resourceCode);
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const updated = await client.query<Record<string, unknown>>(
          `UPDATE "${ctx.schemaName}"."${ident(definition.table)}"
           SET is_active = FALSE, deactivated_at = now(), deactivated_by = $2,
               updated_at = now(), updated_by = $2, version = version + 1
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id, code, is_active, deactivated_at, version`,
          [id, ctx.userId],
        );
        if (!updated.rowCount) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        }
        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'DEACTIVATE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason,
          requestId: ctx.audit.requestId,
        });
        return updated.rows[0];
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'DEACTIVATE' },
    );
  }

  async activate(ctx: LifecycleContext, resourceCode: string, id: string) {
    const definition = this.resource(resourceCode);
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const updated = await client.query<Record<string, unknown>>(
          `UPDATE "${ctx.schemaName}"."${ident(definition.table)}"
           SET is_active = TRUE, deactivated_at = NULL, deactivated_by = NULL,
               updated_at = now(), updated_by = $2, version = version + 1
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING id, code, is_active, version`,
          [id, ctx.userId],
        );
        if (!updated.rowCount) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        }
        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'ACTIVATE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });
        return updated.rows[0];
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'ACTIVATE' },
    );
  }

  /** DELETE = soft delete. Audit dan referensi tetap terjaga. */
  async softDelete(ctx: LifecycleContext, resourceCode: string, id: string, reason: string) {
    const definition = this.resource(resourceCode);
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const current = await client.query<{ is_system: boolean; deleted_at: Date | null; code: string }>(
          `SELECT is_system, deleted_at, code FROM "${ctx.schemaName}"."${ident(definition.table)}"
           WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const row = current.rows[0];
        if (!row) throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        if (row.deleted_at) {
          throw AppError.conflict(ErrorCodes.RECORD_ALREADY_DELETED, 'Record sudah dihapus.');
        }
        if (row.is_system) {
          throw AppError.forbidden(
            ErrorCodes.FORBIDDEN,
            'Record sistem tidak dapat dihapus.',
          );
        }

        const updated = await client.query<Record<string, unknown>>(
          `UPDATE "${ctx.schemaName}"."${ident(definition.table)}"
           SET deleted_at = now(), deleted_by = $2, delete_reason = $3,
               is_active = FALSE, updated_at = now(), updated_by = $2, version = version + 1
           WHERE id = $1
           RETURNING id, code, deleted_at, delete_reason, version`,
          [id, ctx.userId, reason],
        );

        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'SOFT_DELETE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason,
          requestId: ctx.audit.requestId,
        });
        return updated.rows[0];
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'SOFT_DELETE' },
    );
  }

  async restore(ctx: LifecycleContext, resourceCode: string, id: string) {
    const definition = this.resource(resourceCode);
    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const current = await client.query<{ deleted_at: Date | null; code: string }>(
          `SELECT deleted_at, code FROM "${ctx.schemaName}"."${ident(definition.table)}"
           WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!current.rows[0]) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        }
        if (!current.rows[0].deleted_at) {
          throw AppError.conflict(ErrorCodes.RECORD_NOT_DELETED, 'Record tidak dalam keadaan terhapus.');
        }

        // Kode unik harus tetap terjaga setelah pemulihan.
        const conflict = await client.query(
          `SELECT 1 FROM "${ctx.schemaName}"."${ident(definition.table)}"
           WHERE code = $1 AND id <> $2 AND deleted_at IS NULL LIMIT 1`,
          [current.rows[0].code, id],
        );
        if (conflict.rowCount) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Kode "${current.rows[0].code}" sudah dipakai record lain. Ubah kode tersebut sebelum memulihkan.`,
          );
        }

        const updated = await client.query<Record<string, unknown>>(
          `UPDATE "${ctx.schemaName}"."${ident(definition.table)}"
           SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL,
               is_active = TRUE, deactivated_at = NULL, deactivated_by = NULL,
               updated_at = now(), updated_by = $2, version = version + 1
           WHERE id = $1
           RETURNING id, code, is_active, deleted_at, version`,
          [id, ctx.userId],
        );

        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'RESTORE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          requestId: ctx.audit.requestId,
        });
        return updated.rows[0];
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'RESTORE' },
    );
  }

  /** Laporan referensi — dipakai UI sebelum menawarkan purge. */
  async references(
    ctx: LifecycleContext,
    resourceCode: string,
    id: string,
  ): Promise<ReferenceReport> {
    const definition = this.resource(resourceCode);
    const record = await this.findById(ctx, resourceCode, id);
    const results: ReferenceReport['references'] = [];

    for (const reference of definition.references) {
      const exists = await this.tenantDb.queryOne<{ exists: boolean }>(
        ctx.schemaName,
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = $2
         ) AS exists`,
        [ctx.schemaName, reference.table],
      );
      if (!exists?.exists) continue;

      const matchValue = resolveReferenceMatchValue(record, id, reference.viaColumn);
      if (matchValue == null) continue;

      const counted = await this.tenantDb.queryOne<{ total: string }>(
        ctx.schemaName,
        `SELECT count(*)::text AS total FROM "${ctx.schemaName}"."${ident(reference.table)}"
         WHERE "${ident(reference.column)}" = $1`,
        [matchValue],
      );
      const count = Number(counted?.total ?? '0');
      if (count > 0) {
        results.push({
          table: reference.table,
          column: reference.column,
          label: reference.label,
          count,
          isTransactional: reference.isTransactional,
        });
      }
    }

    const blockedByTransaction = results.some((r) => r.isTransactional);
    const isSample = record.is_sample === true;

    let canPurge = definition.supportsPurge;
    if (definition.hardDeletePolicy === 'NEVER_PURGE') canPurge = false;
    if (definition.hardDeletePolicy === 'PURGE_SAMPLE_ONLY' && !isSample) canPurge = false;
    if (definition.hardDeletePolicy === 'PURGE_IF_UNREFERENCED' && results.length > 0) canPurge = false;
    if (blockedByTransaction) canPurge = false;
    if (record.is_system === true) canPurge = false;

    return {
      resourceCode,
      recordId: id,
      canPurge,
      policy: definition.hardDeletePolicy,
      references: results,
    };
  }

  /**
   * Hard delete (purge).
   * Guard permission HARD_DELETE dan step-up dilakukan pada layer controller.
   */
  async purge(ctx: LifecycleContext, resourceCode: string, id: string, reason: string) {
    const definition = this.resource(resourceCode);
    if (!definition.supportsPurge || definition.hardDeletePolicy === 'NEVER_PURGE') {
      throw AppError.forbidden(
        ErrorCodes.PURGE_NOT_ALLOWED,
        `${definition.label} tidak mengizinkan hapus permanen.`,
      );
    }

    const report = await this.references(ctx, resourceCode, id);
    if (!report.canPurge) {
      throw AppError.conflict(
        ErrorCodes.RECORD_REFERENCED,
        'Record tidak dapat dihapus permanen karena masih direferensikan atau kebijakan melarangnya.',
        { policy: report.policy, references: report.references },
      );
    }

    return this.tenantDb.transaction(
      ctx.schemaName,
      async (client) => {
        const record = await client.query<Record<string, unknown>>(
          `SELECT * FROM "${ctx.schemaName}"."${ident(definition.table)}" WHERE id = $1 FOR UPDATE`,
          [id],
        );
        if (!record.rowCount) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, `${definition.label} tidak ditemukan.`);
        }

        await client.query(
          `DELETE FROM "${ctx.schemaName}".starter_data_marker WHERE table_name = $1 AND record_id = $2`,
          [definition.table, id],
        );
        await client.query(
          `DELETE FROM "${ctx.schemaName}"."${ident(definition.table)}" WHERE id = $1`,
          [id],
        );

        await this.audit.record({
          moduleCode: 'MASTER',
          actionCode: 'HARD_PURGE',
          entityType: definition.table,
          entityId: id,
          tenantId: ctx.tenantId,
          tenantSchema: ctx.schemaName,
          actorUserId: ctx.userId,
          actorUsername: ctx.username,
          reason,
          requestId: ctx.audit.requestId,
          metadata: { resourceCode, purgedRecord: sanitizeForAudit(record.rows[0]) },
        });

        return { purged: true, id, resourceCode };
      },
      { ...ctx.audit, moduleCode: 'MASTER', actionCode: 'HARD_PURGE' },
    );
  }

  /** Riwayat audit satu record dari schema audit tenant. */
  async auditTrail(ctx: LifecycleContext, resourceCode: string, id: string, limit = 100) {
    const definition = this.resource(resourceCode);
    const auditSchema = `${ctx.schemaName}__audit`;
    const rows = await this.tenantDb.queryAdmin<Record<string, unknown>>(
      `SELECT rc.id, rc.operation, rc.changed_columns, rc.statement_timestamp,
              rc.old_data, rc.new_data,
              ev.action_code, ev.actor_username, ev.actor_user_id, ev.request_id, ev.reason
       FROM "${auditSchema}".audit_row_change rc
       LEFT JOIN "${auditSchema}".audit_event ev ON ev.id = rc.audit_event_id
       WHERE rc.table_schema = $1 AND rc.table_name = $2 AND rc.row_pk->>'id' = $3
       ORDER BY rc.statement_timestamp DESC
       LIMIT ${Math.min(limit, 500)}`,
      [ctx.schemaName, definition.table, id],
    );
    if (!definition.sensitiveFields?.length || !rows.length) return rows;
    const permission = `${definition.menuCode}.VIEW_BANK_DETAILS`;
    const kurang = await this.izin.findMissing(ctx.schemaName, ctx.userId, [permission], {
      isDemo: ctx.isDemo,
      activeRoleId: ctx.activeRoleId,
    });
    return maskAuditRows(rows, definition.sensitiveFields, kurang.length === 0);
  }

  // -------------------------------------------------------------------------

  private pickWritable(
    definition: MasterResourceDefinition,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of definition.writableFields) {
      if (payload[field] !== undefined) out[field] = payload[field];
    }
    // Field di luar whitelist diabaikan, bukan ditulis.
    return out;
  }

  private async assertForeignKeys(
    client: PoolClient,
    schemaName: string,
    definition: MasterResourceDefinition,
    data: Record<string, unknown>,
  ): Promise<void> {
    for (const [field, referencedTable] of Object.entries(definition.foreignKeys ?? {})) {
      const value = data[field];
      if (value === undefined || value === null || value === '') continue;
      const result = await client.query(
        `SELECT 1 FROM "${schemaName}"."${ident(referencedTable)}"
         WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [value],
      );
      if (!result.rowCount) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Referensi pada field "${field}" tidak ditemukan atau sudah dihapus.`,
        );
      }
    }
  }
}

function ident(value: string): string {
  if (!IDENT.test(value)) {
    throw AppError.internal(ErrorCodes.INTERNAL_ERROR, `Identifier tidak valid: ${value}`);
  }
  return value;
}

function sanitizeForAudit(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (/password|token|secret|hash/i.test(key)) continue;
    out[key] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}
