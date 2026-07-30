import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import {
  MasterSeedContext,
  MasterSeedDefinition,
  MasterSeedRecord,
  MasterSeedVerifyReport,
  MasterSeedVerifyRow,
} from './master-seed.types';
import { TENANT_MASTER_SEEDS } from './registry/tenant-master-seeds';

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

export interface SeedRunSummary {
  schemaName: string;
  sampleBatchId: string;
  resources: Array<{
    resourceCode: string;
    inserted: number;
    updated: number;
    skipped: number;
  }>;
  totalInserted: number;
  totalUpdated: number;
}

export interface CleanupSummary {
  schemaName: string;
  removed: Array<{ resourceCode: string; count: number }>;
  blocked: Array<{ resourceCode: string; code: string; reason: string }>;
  totalRemoved: number;
}

@Injectable()
export class MasterSeedService {
  private readonly logger = new Logger(MasterSeedService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  getTenantSeeds(): MasterSeedDefinition[] {
    return [...TENANT_MASTER_SEEDS].sort((a, b) => a.order - b.order);
  }

  /**
   * Menjalankan seluruh seed master pada schema tenant.
   * Idempotent: menjalankan dua kali tidak menghasilkan duplikat.
   */
  async seedTenant(
    schemaName: string,
    options: { sampleBatchId?: string; only?: string[] } = {},
  ): Promise<SeedRunSummary> {
    const sampleBatchId = options.sampleBatchId ?? deterministicBatchId(schemaName);
    const summary: SeedRunSummary = {
      schemaName,
      sampleBatchId,
      resources: [],
      totalInserted: 0,
      totalUpdated: 0,
    };

    await this.tenantDb.transaction(schemaName, async (client) => {
      const ctx = this.buildContext(client, schemaName, sampleBatchId);

      for (const definition of this.getTenantSeeds()) {
        if (options.only?.length && !options.only.includes(definition.resourceCode)) continue;
        if (!(await this.tableExists(client, schemaName, definition.table))) {
          this.logger.warn(`Tabel ${definition.table} tidak ada pada ${schemaName}; seed dilewati.`);
          continue;
        }

        const records = await this.resolveRecords(definition, ctx);
        const columnTypes = await this.getColumns(client, schemaName, definition.table);
        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const record of records) {
          const result = await this.upsertRecord(
            client,
            schemaName,
            definition,
            record,
            columnTypes,
            sampleBatchId,
          );
          if (result === 'inserted') inserted += 1;
          else if (result === 'updated') updated += 1;
          else skipped += 1;
        }

        summary.resources.push({
          resourceCode: definition.resourceCode,
          inserted,
          updated,
          skipped,
        });
        summary.totalInserted += inserted;
        summary.totalUpdated += updated;
      }
    });

    this.logger.log(
      `Seed master ${schemaName}: ${summary.totalInserted} baru, ${summary.totalUpdated} diperbarui.`,
    );
    return summary;
  }

  /** Verifikasi setiap master relevan memiliki minimal N record aktif. */
  async verifyTenant(schemaName: string): Promise<MasterSeedVerifyReport> {
    const rows: MasterSeedVerifyRow[] = [];

    await this.tenantDb.transaction(schemaName, async (client) => {
      const ctx = this.buildContext(client, schemaName, deterministicBatchId(schemaName));

      for (const definition of this.getTenantSeeds()) {
        if (!(await this.tableExists(client, schemaName, definition.table))) {
          rows.push({
            resourceCode: definition.resourceCode,
            label: definition.label,
            requiredMinimum: definition.minimumRecords,
            activeCount: 0,
            sampleCount: 0,
            status: 'MISSING_TABLE',
            missingCodes: [],
          });
          continue;
        }

        const table = assertIdentifier(definition.table);
        const counts = await client.query<{ active: string; sample: string }>(
          `SELECT
             count(*) FILTER (WHERE is_active = TRUE AND deleted_at IS NULL)::text AS active,
             count(*) FILTER (WHERE is_sample = TRUE AND deleted_at IS NULL)::text AS sample
           FROM "${schemaName}"."${table}"`,
        );
        const activeCount = Number(counts.rows[0]?.active ?? '0');
        const sampleCount = Number(counts.rows[0]?.sample ?? '0');

        const expected = await this.resolveRecords(definition, ctx);
        const uniqueColumn = assertIdentifier(definition.uniqueColumn ?? 'code');
        const expectedCodes = expected.map((r) => String(r[uniqueColumn] ?? r.code));
        const present = await client.query<{ value: string }>(
          `SELECT "${uniqueColumn}"::text AS value FROM "${schemaName}"."${table}" WHERE deleted_at IS NULL`,
        );
        const presentSet = new Set(present.rows.map((r) => r.value));
        const missingCodes = expectedCodes.filter((code) => !presentSet.has(code));

        let status: MasterSeedVerifyRow['status'] = 'OK';
        if (definition.minimumRecords === 0) status = 'EXEMPT';
        else if (activeCount < definition.minimumRecords) status = 'INSUFFICIENT';

        rows.push({
          resourceCode: definition.resourceCode,
          label: definition.label,
          requiredMinimum: definition.minimumRecords,
          activeCount,
          sampleCount,
          status,
          missingCodes,
        });
      }
    });

    const failing = rows.filter((r) => r.status === 'INSUFFICIENT' || r.status === 'MISSING_TABLE');
    return {
      schemaName,
      scope: 'tenant',
      checkedAt: new Date().toISOString(),
      passed: failing.length === 0,
      totalResources: rows.length,
      failingResources: failing.length,
      rows,
    };
  }

  /** Menambahkan kembali record contoh yang hilang (Tambahkan Data Contoh yang Kurang). */
  async repairTenant(schemaName: string): Promise<SeedRunSummary> {
    const report = await this.verifyTenant(schemaName);
    const needsRepair = report.rows
      .filter((r) => r.status === 'INSUFFICIENT' || r.missingCodes.length > 0)
      .map((r) => r.resourceCode);

    if (!needsRepair.length) {
      return {
        schemaName,
        sampleBatchId: deterministicBatchId(schemaName),
        resources: [],
        totalInserted: 0,
        totalUpdated: 0,
      };
    }
    this.logger.log(`Perbaikan seed ${schemaName}: ${needsRepair.join(', ')}`);
    return this.seedTenant(schemaName, { only: needsRepair });
  }

  /**
   * Menghapus data contoh (Hapus Data Contoh).
   * Data contoh yang telah direferensikan transaksi nyata TIDAK dihapus.
   */
  async cleanupSampleData(
    schemaName: string,
    options: { hard?: boolean; deletedBy?: string; reason?: string } = {},
  ): Promise<CleanupSummary> {
    const summary: CleanupSummary = {
      schemaName,
      removed: [],
      blocked: [],
      totalRemoved: 0,
    };

    await this.tenantDb.transaction(schemaName, async (client) => {
      // Urutan terbalik agar child dibersihkan sebelum parent.
      for (const definition of [...this.getTenantSeeds()].reverse()) {
        if (!definition.supportsSampleCleanup) continue;
        if (!(await this.tableExists(client, schemaName, definition.table))) continue;

        const table = assertIdentifier(definition.table);
        const uniqueColumn = assertIdentifier(definition.uniqueColumn ?? 'code');
        const samples = await client.query<{ id: string; code: string }>(
          `SELECT id::text AS id, "${uniqueColumn}"::text AS code
           FROM "${schemaName}"."${table}"
           WHERE is_sample = TRUE AND deleted_at IS NULL`,
        );

        let removed = 0;
        for (const sample of samples.rows) {
          const blocker = await this.findTransactionalReference(
            client,
            schemaName,
            definition,
            sample.id,
          );
          if (blocker) {
            summary.blocked.push({
              resourceCode: definition.resourceCode,
              code: sample.code,
              reason: `Direferensikan oleh ${blocker}.`,
            });
            continue;
          }

          if (options.hard) {
            await client.query(`DELETE FROM "${schemaName}"."${table}" WHERE id = $1`, [sample.id]);
          } else {
            await client.query(
              `UPDATE "${schemaName}"."${table}"
               SET deleted_at = now(), deleted_by = $2, delete_reason = $3, is_active = FALSE,
                   version = version + 1
               WHERE id = $1`,
              [sample.id, options.deletedBy ?? null, options.reason ?? 'Hapus data contoh'],
            );
          }
          removed += 1;
        }

        await client.query(
          `UPDATE "${schemaName}".starter_data_marker
           SET removed_at = now()
           WHERE table_name = $1 AND removed_at IS NULL`,
          [definition.table],
        );

        if (removed > 0) {
          summary.removed.push({ resourceCode: definition.resourceCode, count: removed });
          summary.totalRemoved += removed;
        }
      }
    });

    return summary;
  }

  /** Memulihkan data contoh yang di-soft-delete (Pulihkan Data Contoh). */
  async restoreSampleData(schemaName: string): Promise<{ restored: number }> {
    let restored = 0;
    await this.tenantDb.transaction(schemaName, async (client) => {
      for (const definition of this.getTenantSeeds()) {
        if (!definition.supportsSampleCleanup) continue;
        if (!(await this.tableExists(client, schemaName, definition.table))) continue;
        const table = assertIdentifier(definition.table);
        const result = await client.query(
          `UPDATE "${schemaName}"."${table}"
           SET deleted_at = NULL, deleted_by = NULL, delete_reason = NULL,
               is_active = TRUE, deactivated_at = NULL, version = version + 1
           WHERE is_sample = TRUE AND deleted_at IS NOT NULL`,
        );
        restored += result.rowCount ?? 0;
      }
    });
    // Isi ulang record yang benar-benar hilang.
    await this.repairTenant(schemaName);
    return { restored };
  }

  // -------------------------------------------------------------------------

  private buildContext(
    client: PoolClient,
    schemaName: string,
    sampleBatchId: string,
  ): MasterSeedContext {
    const cache = new Map<string, string | null>();
    const lookupId = async (table: string, code: string): Promise<string | null> => {
      const key = `${table}:${code}`;
      if (cache.has(key)) return cache.get(key) ?? null;
      const safeTable = assertIdentifier(table);
      const result = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM "${schemaName}"."${safeTable}" WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
        [code],
      );
      const id = result.rows[0]?.id ?? null;
      cache.set(key, id);
      return id;
    };
    return {
      schemaName,
      sampleBatchId,
      lookupId,
      requireId: async (table, code) => {
        const id = await lookupId(table, code);
        if (!id) {
          throw AppError.internal(
            ErrorCodes.INTERNAL_ERROR,
            `Seed dependency tidak ditemukan: ${table}.${code} pada schema ${schemaName}.`,
          );
        }
        return id;
      },
    };
  }

  private async resolveRecords(
    definition: MasterSeedDefinition,
    ctx: MasterSeedContext,
  ): Promise<MasterSeedRecord[]> {
    return typeof definition.records === 'function'
      ? definition.records(ctx)
      : definition.records;
  }

  private async tableExists(
    client: PoolClient,
    schemaName: string,
    table: string,
  ): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = $2
       ) AS exists`,
      [schemaName, table],
    );
    return result.rows[0]?.exists ?? false;
  }

  private async getColumns(
    client: PoolClient,
    schemaName: string,
    table: string,
  ): Promise<Set<string>> {
    const result = await client.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2`,
      [schemaName, table],
    );
    return new Set(result.rows.map((r) => r.column_name));
  }

  private async upsertRecord(
    client: PoolClient,
    schemaName: string,
    definition: MasterSeedDefinition,
    record: MasterSeedRecord,
    columns: Set<string>,
    sampleBatchId: string,
  ): Promise<'inserted' | 'updated' | 'skipped'> {
    const table = assertIdentifier(definition.table);
    const uniqueColumn = assertIdentifier(definition.uniqueColumn ?? 'code');
    const uniqueValue = record[uniqueColumn] ?? record.code;

    const payload: Record<string, unknown> = { ...record };
    if (columns.has('is_sample')) payload.is_sample = record.is_sample ?? true;
    if (columns.has('sample_batch_id')) payload.sample_batch_id = sampleBatchId;
    if (columns.has('name') && payload.name === undefined) payload.name = String(uniqueValue);

    // Buang kolom yang tidak ada pada tabel.
    for (const key of Object.keys(payload)) {
      if (!columns.has(key)) delete payload[key];
    }

    const existing = await client.query<{ id: string }>(
      `SELECT id::text AS id FROM "${schemaName}"."${table}" WHERE "${uniqueColumn}" = $1 LIMIT 1`,
      [uniqueValue],
    );

    if (existing.rows.length > 0) {
      if (definition.strategy === 'INSERT_IF_MISSING') return 'skipped';

      const updatable = Object.keys(payload).filter(
        (k) => k !== uniqueColumn && k !== 'id' && k !== 'created_at' && k !== 'created_by',
      );
      if (!updatable.length) return 'skipped';

      const sets = updatable.map((col, i) => `"${assertIdentifier(col)}" = $${i + 2}`);
      if (columns.has('updated_at')) sets.push('updated_at = now()');
      if (columns.has('version')) sets.push('version = version + 1');

      await client.query(
        `UPDATE "${schemaName}"."${table}" SET ${sets.join(', ')} WHERE id = $1`,
        [existing.rows[0].id, ...updatable.map((col) => payload[col])],
      );
      return 'updated';
    }

    const insertCols = Object.keys(payload).map((c) => assertIdentifier(c));
    const placeholders = insertCols.map((_, i) => `$${i + 1}`);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO "${schemaName}"."${table}" (${insertCols.map((c) => `"${c}"`).join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING id::text AS id`,
      Object.values(payload),
    );

    const newId = inserted.rows[0]?.id;
    if (newId && (payload.is_sample ?? false)) {
      await client.query(
        `INSERT INTO "${schemaName}".starter_data_marker
           (resource_code, table_name, record_id, record_code, sample_batch_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (table_name, record_id) DO NOTHING`,
        [definition.resourceCode, definition.table, newId, String(uniqueValue), sampleBatchId],
      );
    }
    return 'inserted';
  }

  /**
   * Mencari referensi ke record master. Mengembalikan deskripsi bila ditemukan.
   * Referensi transaksional selalu memblokir; referensi master hanya memblokir
   * bila record yang mereferensikan bukan data contoh.
   */
  private async findTransactionalReference(
    client: PoolClient,
    schemaName: string,
    definition: MasterSeedDefinition,
    recordId: string,
  ): Promise<string | null> {
    for (const reference of definition.references ?? []) {
      if (!(await this.tableExists(client, schemaName, reference.table))) continue;
      const table = assertIdentifier(reference.table);
      const column = assertIdentifier(reference.column);
      const columns = await this.getColumns(client, schemaName, reference.table);

      const conditions = [`"${column}" = $1`];
      if (columns.has('deleted_at')) conditions.push('deleted_at IS NULL');
      if (!reference.isTransactional && columns.has('is_sample')) {
        // Referensi dari sesama data contoh tidak memblokir pembersihan.
        conditions.push('is_sample = FALSE');
      }

      const result = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM "${schemaName}"."${table}" WHERE ${conditions.join(' AND ')}`,
        [recordId],
      );
      if (Number(result.rows[0]?.count ?? '0') > 0) {
        return `${reference.table}.${reference.column}`;
      }
    }
    return null;
  }
}

function assertIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) {
    throw AppError.internal(ErrorCodes.INTERNAL_ERROR, `Identifier tidak valid: ${value}`);
  }
  return value;
}

/** Batch id deterministik agar seed berulang menghasilkan nilai yang sama. */
export function deterministicBatchId(schemaName: string): string {
  const hex = Buffer.from(`ebisnis-sample-${schemaName}`)
    .toString('hex')
    .padEnd(32, '0')
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    // Versi 4 nominal agar tetap valid sebagai UUID.
    `4${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
