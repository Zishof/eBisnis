import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { SCHEMA_NAME_REGEX } from '../database/schema-name.util';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface TenantMigrationDefinition {
  version: string;
  sequence: number;
  file: string;
  name: string;
  description: string;
}

interface Manifest {
  schemaVersion: number;
  migrations: TenantMigrationDefinition[];
}

export interface MigrationApplyResult {
  version: string;
  name: string;
  checksum: string;
  durationMs: number;
  skipped: boolean;
}

/**
 * Menormalkan akhir baris sebelum sidik dihitung.
 *
 * Tanpa ini, berkas yang isinya sama persis menghasilkan sidik berbeda hanya
 * karena Git menormalkan CRLF menjadi LF saat commit — dan migration yang sudah
 * diterapkan mendadak dianggap berubah, sehingga seluruh penerapan berikutnya
 * ditolak.
 *
 * Terjadi nyata: V018 ditulis pada Windows dengan CRLF, diterapkan ke 14 skema,
 * lalu di-commit. Git menyimpannya sebagai LF, dan `git pull` berikutnya
 * menghasilkan berkas yang sidiknya berbeda dari yang tercatat. Hal yang sama
 * akan terjadi antara pengembang Windows dan CI Linux, atau antara dua orang
 * dengan setelan `core.autocrlf` berbeda.
 *
 * Yang hendak dijaga sidik ini adalah perubahan ISI. Akhir baris bukan isi.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);
  private readonly migrationsDir: string;
  private manifest?: Manifest;
  private readonly sqlCache = new Map<string, { sql: string; checksum: string }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {
    this.migrationsDir = resolveMigrationsDir();
  }

  getManifest(): Manifest {
    if (!this.manifest) {
      const manifestPath = join(this.migrationsDir, 'manifest.json');
      this.manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
      this.manifest.migrations.sort((a, b) => a.sequence - b.sequence);
    }
    return this.manifest;
  }

  /** Versi migration tertinggi pada katalog canonical. */
  latestVersion(): string {
    const migrations = this.getManifest().migrations;
    return migrations[migrations.length - 1]?.version ?? 'V000';
  }

  private loadSql(definition: TenantMigrationDefinition): { sql: string; checksum: string } {
    const cached = this.sqlCache.get(definition.file);
    if (cached) return cached;
    const sql = readFileSync(join(this.migrationsDir, definition.file), 'utf8');
    const checksum = createHash('sha256').update(normalizeLineEndings(sql), 'utf8').digest('hex');
    const entry = { sql, checksum };
    this.sqlCache.set(definition.file, entry);
    return entry;
  }

  /** Sinkronkan katalog canonical ke platform.schema_migration_catalog. */
  async syncCatalog(): Promise<void> {
    for (const definition of this.getManifest().migrations) {
      const { checksum } = this.loadSql(definition);
      await this.prisma.schemaMigrationCatalog.upsert({
        where: { version: definition.version },
        create: {
          version: definition.version,
          name: definition.name,
          checksum,
          scriptPath: `tenant-migrations/${definition.file}`,
          description: definition.description,
          sequence: definition.sequence,
        },
        update: {
          name: definition.name,
          checksum,
          scriptPath: `tenant-migrations/${definition.file}`,
          description: definition.description,
          sequence: definition.sequence,
        },
      });
    }
  }

  /**
   * Terapkan seluruh migration yang belum diterapkan pada satu schema tenant.
   * Idempotent: migration yang sudah tercatat dilewati; checksum yang berbeda
   * menghasilkan error, bukan penerapan diam-diam.
   */
  async applyAll(
    schemaName: string,
    auditSchemaName: string,
    options: { tenantId?: string | null } = {},
  ): Promise<MigrationApplyResult[]> {
    if (!SCHEMA_NAME_REGEX.test(schemaName)) {
      throw AppError.badRequest(ErrorCodes.INVALID_SCHEMA_NAME, `Schema tidak valid: ${schemaName}`);
    }
    if (!/^[a-z][a-z0-9_]{2,71}$/.test(auditSchemaName)) {
      throw AppError.badRequest(
        ErrorCodes.INVALID_SCHEMA_NAME,
        `Schema audit tidak valid: ${auditSchemaName}`,
      );
    }

    const applied = await this.prisma.tenantSchemaMigrationHistory.findMany({
      where: { schemaName },
      select: { migrationVersion: true, checksum: true },
    });
    const appliedMap = new Map(applied.map((row) => [row.migrationVersion, row.checksum]));

    const results: MigrationApplyResult[] = [];

    for (const definition of this.getManifest().migrations) {
      const { sql, checksum } = this.loadSql(definition);
      const existingChecksum = appliedMap.get(definition.version);

      if (existingChecksum) {
        if (existingChecksum !== checksum) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            `Checksum migration ${definition.version} berbeda dari yang sudah diterapkan pada schema ${schemaName}. ` +
              'Migration yang telah dipakai tidak boleh diubah — buat versi baru.',
          );
        }
        results.push({
          version: definition.version,
          name: definition.name,
          checksum,
          durationMs: 0,
          skipped: true,
        });
        continue;
      }

      const rendered = sql
        .replace(/\{\{TENANT_SCHEMA\}\}/g, schemaName)
        .replace(/\{\{AUDIT_SCHEMA\}\}/g, auditSchemaName);

      const startedAt = Date.now();
      try {
        await this.tenantDb.executeAdmin(rendered);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Migration ${definition.version} gagal pada schema ${schemaName}: ${message}`,
        );
        await this.prisma.tenantSchemaMigrationHistory
          .create({
            data: {
              tenantId: options.tenantId ?? null,
              schemaName,
              migrationVersion: definition.version,
              checksum,
              durationMs: Date.now() - startedAt,
              status: 'FAILED',
              errorMessage: message.slice(0, 4000),
            },
          })
          .catch(() => undefined);
        throw AppError.internal(
          ErrorCodes.PROVISIONING_FAILED,
          `Migration ${definition.version} gagal: ${message}`,
        );
      }

      const durationMs = Date.now() - startedAt;

      await this.tenantDb.executeAdmin(
        `INSERT INTO "${schemaName}".schema_migration (version, name, checksum, duration_ms)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (version) DO NOTHING`,
        [definition.version, definition.name, checksum, durationMs],
      );

      const catalog = await this.prisma.schemaMigrationCatalog.findUnique({
        where: { version: definition.version },
        select: { id: true },
      });

      await this.prisma.tenantSchemaMigrationHistory.create({
        data: {
          tenantId: options.tenantId ?? null,
          schemaName,
          migrationVersion: definition.version,
          catalogId: catalog?.id ?? null,
          checksum,
          durationMs,
          status: 'SUCCEEDED',
        },
      });

      await this.prisma.auditSchemaMigration.create({
        data: {
          schemaName,
          migrationVersion: definition.version,
          checksum,
          status: 'SUCCEEDED',
          durationMs,
        },
      });

      results.push({
        version: definition.version,
        name: definition.name,
        checksum,
        durationMs,
        skipped: false,
      });
      this.logger.log(`Migration ${definition.version} diterapkan ke ${schemaName} (${durationMs}ms)`);
    }

    return results;
  }

  /** Verifikasi tabel inti benar-benar terbentuk pada schema tenant. */
  async verifySchema(schemaName: string, auditSchemaName: string): Promise<{
    ok: boolean;
    tableCount: number;
    auditTableCount: number;
    triggerCount: number;
    missing: string[];
  }> {
    const required = [
      'app_setting',
      'legal_entity',
      'brand',
      'outlet',
      'warehouse',
      'product',
      'supplier',
      'uom',
      'stock_movement',
      'stock_balance',
      'stock_policy',
      'request_order',
      'purchase_order',
      'goods_receipt',
      'purchase_backorder',
      'internal_transfer',
      'menu',
      'role',
      'user_subject',
    ];

    const tables = await this.tenantDb.queryAdmin<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [schemaName],
    );
    const tableNames = new Set(tables.map((row) => row.table_name));
    const missing = required.filter((name) => !tableNames.has(name));

    const auditTables = await this.tenantDb.queryAdmin<{ count: string }>(
      `SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = $1`,
      [auditSchemaName],
    );

    const triggers = await this.tenantDb.queryAdmin<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND NOT t.tgisinternal AND t.tgname LIKE 'trg_audit_%'`,
      [schemaName],
    );

    return {
      ok: missing.length === 0,
      tableCount: tableNames.size,
      auditTableCount: Number(auditTables[0]?.count ?? '0'),
      triggerCount: Number(triggers[0]?.count ?? '0'),
      missing,
    };
  }
}

function resolveMigrationsDir(): string {
  const candidates = [
    // dev (tsx / ts-node dari src)
    resolve(__dirname, '../../../tenant-migrations'),
    // build (dist/main.js) — aset disalin oleh nest-cli
    resolve(__dirname, '../../tenant-migrations'),
    resolve(__dirname, '../tenant-migrations'),
    resolve(process.cwd(), 'tenant-migrations'),
    resolve(process.cwd(), 'apps/api/tenant-migrations'),
  ];
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'manifest.json'))) return candidate;
  }
  throw new Error(
    `Direktori tenant-migrations tidak ditemukan. Dicoba: ${candidates.join(', ')}`,
  );
}
