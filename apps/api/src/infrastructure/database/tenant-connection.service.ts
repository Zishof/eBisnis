import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { quoteIdentifier, SCHEMA_NAME_REGEX } from './schema-name.util';

export interface AuditContext {
  requestId?: string;
  correlationId?: string;
  userId?: string;
  username?: string;
  sessionId?: string;
  supportSessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  moduleCode?: string;
  actionCode?: string;
}

interface CachedPool {
  pool: Pool;
  lastUsedAt: number;
}

/**
 * Akses data schema tenant.
 *
 * Aturan keamanan yang tidak boleh dilanggar:
 *  - `schemaName` HANYA berasal dari platform.tenant_schema_registry;
 *  - identifier divalidasi regex sebelum dirangkai;
 *  - `search_path` tidak pernah menyertakan `public` sebagai fallback;
 *  - pool di-cache dengan LRU + idle eviction dan di-disconnect saat dievict.
 */
@Injectable()
export class TenantConnectionService implements OnModuleDestroy {
  private readonly logger = new Logger(TenantConnectionService.name);
  private readonly pools = new Map<string, CachedPool>();
  private readonly maxPools: number;
  private readonly idleTtlMs: number;
  private readonly connectionString: string;
  private sweeper?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {
    this.maxPools = this.config.get<number>('tenantClient.cacheMax', 50);
    this.idleTtlMs = this.config.get<number>('tenantClient.idleTtlSeconds', 900) * 1000;
    this.connectionString = this.config.get<string>('database.adminUrl', '');
    if (!this.connectionString) {
      throw new Error('DATABASE_ADMIN_URL / DATABASE_URL wajib diisi.');
    }
    this.sweeper = setInterval(() => this.evictIdle(), 60_000);
    this.sweeper.unref?.();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweeper) clearInterval(this.sweeper);
    await Promise.all([...this.pools.values()].map((entry) => entry.pool.end().catch(() => undefined)));
    this.pools.clear();
  }

  /** Pool administratif tanpa schema tenant (untuk DDL provisioning). */
  private adminPool?: Pool;

  getAdminPool(): Pool {
    if (!this.adminPool) {
      this.adminPool = new Pool({ connectionString: this.connectionString, max: 5 });
    }
    return this.adminPool;
  }

  private getPool(schemaName: string): Pool {
    if (!SCHEMA_NAME_REGEX.test(schemaName)) {
      throw AppError.badRequest(
        ErrorCodes.INVALID_SCHEMA_NAME,
        `Nama schema tidak valid: ${schemaName}`,
      );
    }

    const cached = this.pools.get(schemaName);
    if (cached) {
      cached.lastUsedAt = Date.now();
      // Refresh posisi LRU.
      this.pools.delete(schemaName);
      this.pools.set(schemaName, cached);
      return cached.pool;
    }

    if (this.pools.size >= this.maxPools) {
      const oldestKey = this.pools.keys().next().value as string | undefined;
      if (oldestKey) {
        const evicted = this.pools.get(oldestKey);
        this.pools.delete(oldestKey);
        evicted?.pool.end().catch(() => undefined);
        this.logger.debug(`Pool tenant dievict dari cache: ${oldestKey}`);
      }
    }

    // search_path hanya schema tenant + pg_catalog. `public` TIDAK disertakan.
    const pool = new Pool({
      connectionString: this.connectionString,
      max: 4,
      idleTimeoutMillis: 30_000,
      options: `-c search_path=${schemaName},pg_catalog`,
    });
    this.pools.set(schemaName, { pool, lastUsedAt: Date.now() });
    return pool;
  }

  private evictIdle(): void {
    const threshold = Date.now() - this.idleTtlMs;
    for (const [key, entry] of [...this.pools.entries()]) {
      if (entry.lastUsedAt < threshold) {
        this.pools.delete(key);
        entry.pool.end().catch(() => undefined);
        this.logger.debug(`Pool tenant idle dievict: ${key}`);
      }
    }
  }

  /** Query sederhana pada schema tenant. */
  async query<T extends QueryResultRow = QueryResultRow>(
    schemaName: string,
    sql: string,
    params: unknown[] = [],
    audit?: AuditContext,
  ): Promise<T[]> {
    const pool = this.getPool(schemaName);
    const client = await pool.connect();
    try {
      if (audit) await this.applyAuditContext(client, audit);
      const result = await client.query<T>(sql, params as never[]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async queryOne<T extends QueryResultRow = QueryResultRow>(
    schemaName: string,
    sql: string,
    params: unknown[] = [],
    audit?: AuditContext,
  ): Promise<T | null> {
    const rows = await this.query<T>(schemaName, sql, params, audit);
    return rows[0] ?? null;
  }

  /** Menjalankan beberapa statement dalam satu transaksi database. */
  async transaction<T>(
    schemaName: string,
    handler: (client: PoolClient) => Promise<T>,
    audit?: AuditContext,
  ): Promise<T> {
    const pool = this.getPool(schemaName);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (audit) await this.applyAuditContext(client, audit);
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Menyetel konteks audit pada transaksi. Trigger DML membaca nilai ini.
   * `set_config(..., true)` = local ke transaksi.
   */
  private async applyAuditContext(client: PoolClient, audit: AuditContext): Promise<void> {
    const entries: Array<[string, string | undefined]> = [
      ['app.request_id', audit.requestId],
      ['app.correlation_id', audit.correlationId],
      ['app.user_id', audit.userId],
      ['app.username', audit.username],
      ['app.session_id', audit.sessionId],
      ['app.support_session_id', audit.supportSessionId],
      ['app.ip_address', audit.ipAddress],
      ['app.user_agent', audit.userAgent],
      ['app.module_code', audit.moduleCode],
      ['app.action_code', audit.actionCode],
      // Reset agar setiap transaksi memperoleh audit_event baru.
      ['app.audit_event_id', ''],
    ];
    for (const [key, value] of entries) {
      await client.query('SELECT set_config($1, $2, true)', [key, value ?? '']);
    }
  }

  /** DDL administratif — hanya dipanggil provisioner dengan identifier tervalidasi. */
  async executeAdmin(sql: string, params: unknown[] = []): Promise<void> {
    const client = await this.getAdminPool().connect();
    try {
      await client.query(sql, params as never[]);
    } finally {
      client.release();
    }
  }

  async queryAdmin<T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const client = await this.getAdminPool().connect();
    try {
      const result = await client.query<T>(sql, params as never[]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async schemaExists(schemaName: string): Promise<boolean> {
    const rows = await this.queryAdmin<{ exists: boolean }>(
      'SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = $1) AS exists',
      [schemaName],
    );
    return rows[0]?.exists ?? false;
  }

  async createSchema(schemaName: string): Promise<void> {
    const quoted = quoteIdentifier(schemaName);
    await this.executeAdmin(`CREATE SCHEMA IF NOT EXISTS ${quoted}`);
  }

  async dropSchema(schemaName: string): Promise<void> {
    const quoted = quoteIdentifier(schemaName);
    await this.executeAdmin(`DROP SCHEMA IF EXISTS ${quoted} CASCADE`);
  }

  /** Advisory lock untuk mencegah dua pendaftaran membuat schema yang sama. */
  async withAdvisoryLock<T>(key: string, handler: () => Promise<T>): Promise<T> {
    const client = await this.getAdminPool().connect();
    try {
      const lockId = hashToBigInt(key);
      const acquired = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [lockId],
      );
      if (!acquired.rows[0]?.locked) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          'Nama pengguna sedang diproses oleh pendaftaran lain. Coba beberapa saat lagi.',
        );
      }
      try {
        return await handler();
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [lockId]);
      }
    } finally {
      client.release();
    }
  }

  cacheSize(): number {
    return this.pools.size;
  }
}

function hashToBigInt(value: string): string {
  // FNV-1a 64-bit, dipetakan ke rentang bigint bertanda PostgreSQL.
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= BigInt(value.charCodeAt(i));
    hash = (hash * prime) & 0xffffffffffffffffn;
  }
  const signed = hash >= 0x8000000000000000n ? hash - 0x10000000000000000n : hash;
  return signed.toString();
}
