/**
 * Penerap migrasi vertikal info-desa.
 *
 * ## Mengapa terpisah dari `TenantMigrationService`
 *
 * Bukan karena mekanismenya berbeda — justru sama persis. Terpisah karena
 * **manifesnya** file bersama berkonflik tinggi. `tenant-migrations/manifest.json`
 * disunting sesi Core dan tiga sesi vertikal, dan penambahan pada satu array
 * JSON dari empat cabang pasti bentrok saat merge.
 *
 * Village memakai manifes sendiri di `tenant-migrations/village/`, dengan versi
 * berawalan waktu UTC sesuai panduan koordinasi §7. Bookkeeping tetap menumpang
 * tabel `schema_migration` yang sama: runner Core mengiterasi manifesnya sendiri
 * dan mencari versi yang dikenalnya, sehingga baris village yang tidak ada pada
 * manifes Core diabaikannya dengan aman.
 *
 * Integration request 003 meminta Core menyatukan penerapannya kelak. Sampai
 * itu terjadi, penerapan village dijalankan dari sini.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';

export interface VillageMigrationDefinition {
  version: string;
  sequence: number;
  file: string;
  name: string;
  description: string;
}

interface VillageManifest {
  schemaVersion: number;
  vertical: string;
  versionPrefix: string;
  migrations: VillageMigrationDefinition[];
}

/**
 * Menyeragamkan akhir baris sebelum checksum dihitung.
 *
 * Git menormalkan CRLF menjadi LF saat commit. Tanpa penyeragaman ini, berkas
 * yang sama menghasilkan checksum berbeda pada Windows dan Linux, dan migrasi
 * yang sudah diterapkan akan ditolak sebagai "berubah". Cacat ini pernah
 * terjadi sungguhan pada Core dan menghentikan penerapan di empat belas skema.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, '\n');
}

@Injectable()
export class VillageMigrationService {
  private readonly logger = new Logger(VillageMigrationService.name);
  private readonly dir = join(process.cwd(), 'tenant-migrations', 'village');
  private manifest?: VillageManifest;
  private readonly cache = new Map<string, { sql: string; checksum: string }>();

  constructor(private readonly tenantDb: TenantConnectionService) {}

  getManifest(): VillageManifest {
    if (!this.manifest) {
      const isi = readFileSync(join(this.dir, 'manifest.village.json'), 'utf8');
      this.manifest = JSON.parse(isi) as VillageManifest;
      this.manifest.migrations.sort((a, b) => a.sequence - b.sequence);
    }
    return this.manifest;
  }

  private loadSql(def: VillageMigrationDefinition): { sql: string; checksum: string } {
    const cached = this.cache.get(def.file);
    if (cached) return cached;
    const sql = readFileSync(join(this.dir, def.file), 'utf8');
    const checksum = createHash('sha256').update(normalizeLineEndings(sql), 'utf8').digest('hex');
    const entry = { sql, checksum };
    this.cache.set(def.file, entry);
    return entry;
  }

  /**
   * Menerapkan migrasi village yang belum diterapkan pada sebuah skema.
   *
   * Idempoten: versi yang sudah tercatat dilewati. Checksum yang berbeda dari
   * yang tercatat **dilempar sebagai galat**, bukan diterapkan ulang —
   * migrasi yang sudah berjalan pada data sungguhan tidak boleh berubah
   * diam-diam.
   */
  async applyTo(schemaName: string): Promise<{ applied: string[]; skipped: string[] }> {
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const def of this.getManifest().migrations) {
      const { sql, checksum } = this.loadSql(def);

      const tercatat = await this.tenantDb.query<{ checksum: string }>(
        schemaName,
        `SELECT checksum FROM "${schemaName}".schema_migration WHERE version = $1`,
        [def.version],
      );

      if (tercatat.length) {
        if (tercatat[0].checksum !== checksum) {
          throw AppError.internal(
            ErrorCodes.INTERNAL_ERROR,
            `Migrasi village ${def.version} sudah diterapkan pada ${schemaName} dengan isi yang berbeda. ` +
              'Migrasi yang sudah berjalan tidak boleh diubah — buat versi baru.',
          );
        }
        skipped.push(def.version);
        continue;
      }

      const mulai = Date.now();
      await this.tenantDb.transaction(schemaName, async (client) => {
        await client.query(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, schemaName));
        await client.query(
          `INSERT INTO "${schemaName}".schema_migration (version, name, checksum, duration_ms)
           VALUES ($1, $2, $3, $4)`,
          [def.version, def.name, checksum, Date.now() - mulai],
        );
      });

      this.logger.log(`Migrasi village ${def.version} diterapkan pada ${schemaName}`);
      applied.push(def.version);
    }

    return { applied, skipped };
  }

  /** Versi migrasi village terakhir yang tercatat pada sebuah skema. */
  async currentVersion(schemaName: string): Promise<string | null> {
    const prefix = this.getManifest().versionPrefix;
    const rows = await this.tenantDb.query<{ version: string }>(
      schemaName,
      `SELECT version FROM "${schemaName}".schema_migration
        WHERE version LIKE $1 ORDER BY version DESC LIMIT 1`,
      [`${prefix}%`],
    );
    return rows[0]?.version ?? null;
  }

  /** Apakah skema ini sudah punya tabel village? Dipakai penjaga endpoint. */
  async isProvisioned(schemaName: string): Promise<boolean> {
    const rows = await this.tenantDb.query<{ ada: boolean }>(
      schemaName,
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = 'village_unit'
       ) AS ada`,
      [schemaName],
    );
    return rows[0]?.ada ?? false;
  }
}
