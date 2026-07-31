/**
 * Menerapkan migrasi modul koperasi ke satu skema penyewa.
 *
 * **Sementara.** Pemuat migrasi Core hanya mengenal satu `manifest.json`
 * bernomor urut, dan IR-001 mengusulkan katalog modular yang menggantikannya.
 * Sampai IR itu disetujui, migrasi koperasi tidak didaftarkan pada manifest
 * global — sebab dua vertikal yang sama-sama menambahkan `V024` akan membuat
 * salah satunya dilewati diam-diam pada penyewa yang sudah menerapkan yang lain.
 *
 * Naskah ini menerapkannya langsung, dengan pencatatan yang sama pada
 * `schema_migration` supaya penerapannya idempoten dan kelak dapat diambil alih
 * pemuat Core tanpa menjalankan ulang apa pun.
 *
 *   node scripts/apply-cooperative-migrations.mjs [schema]
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'tenant-migrations', 'cooperative');
const env = readFileSync(join(here, '..', '.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, '');
const target = process.argv[2] ?? process.env.COOPERATIVE_SCHEMA ?? null;

/** Normalisasi akhiran baris sebelum checksum — pola yang sama dengan Core. */
const normalkan = (teks) => teks.replace(/\r\n/g, '\n');

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const berkasAda = new Set(readdirSync(dir).filter((f) => f.endsWith('.sql')));

  for (const m of manifest.migrations) {
    if (!berkasAda.has(m.file)) {
      throw new Error(`Manifest menyebut ${m.file} tetapi berkasnya tidak ada.`);
    }
  }
  // Berkas SQL yang tidak terdaftar tidak akan pernah diterapkan, dan itu jenis
  // kelalaian yang sulit disadari — disebutkan supaya terlihat.
  const terdaftar = new Set(manifest.migrations.map((m) => m.file));
  for (const f of berkasAda) {
    if (!terdaftar.has(f)) console.warn(`PERINGATAN: ${f} tidak terdaftar pada manifest.`);
  }

  const skema = target
    ? [{ schema_name: target }]
    : (
        await client.query(
          `SELECT schema_name FROM platform.tenant_schema_registry
            WHERE schema_name NOT LIKE 'bukti_%' ORDER BY created_at`,
        )
      ).rows;

  console.log(`Modul: ${manifest.module} · ${manifest.migrations.length} migrasi · ${skema.length} skema`);

  /*
   * Pencatatan memakai tabel modul sendiri, bukan `schema_migration` milik Core.
   *
   * Bukan pilihan gaya: `schema_migration.version` bertipe VARCHAR(16), dan id
   * migrasi modular yang bertimestamp panjangnya 49 aksara. Kolom itu secara
   * struktural tidak dapat menampung penamaan yang diminta panduan koordinasi
   * §7 — temuan yang dicatat pada IR-001 sebagai bagian wajib dari perubahan
   * Core, sebab tanpa pelebaran kolom itu katalog modular tidak dapat berjalan
   * sama sekali.
   *
   * Tabel ini dibuat naskah ini sendiri supaya tidak menambah migrasi yang
   * kelak perlu dicabut. Saat IR-001 disetujui, isinya dipindahkan sekali dan
   * tabelnya dibuang.
   */
  for (const { schema_name: schema } of skema) {
    await client.query(
      `CREATE TABLE IF NOT EXISTS "${schema}".cooperative_schema_migration (
         migration_id VARCHAR(128) PRIMARY KEY,
         module       VARCHAR(32)  NOT NULL,
         name         VARCHAR(255) NOT NULL,
         checksum     VARCHAR(64)  NOT NULL,
         applied_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
         duration_ms  INTEGER
       )`,
    );
  }

  for (const { schema_name: schema } of skema) {
    for (const m of manifest.migrations) {
      const isi = normalkan(readFileSync(join(dir, m.file), 'utf8'));
      const checksum = createHash('sha256').update(isi).digest('hex');

      const sudah = await client.query(
        `SELECT checksum FROM "${schema}".cooperative_schema_migration WHERE migration_id = $1`,
        [m.id],
      );
      if (sudah.rowCount) {
        if (sudah.rows[0].checksum !== checksum) {
          console.error(`  ${schema}: ${m.id} SUDAH diterapkan dengan isi berbeda — dilewati.`);
        }
        continue;
      }

      const mulai = Date.now();
      await client.query('BEGIN');
      try {
        await client.query(isi.replaceAll('{{TENANT_SCHEMA}}', schema));
        await client.query(
          `INSERT INTO "${schema}".cooperative_schema_migration
             (migration_id, module, name, checksum, applied_at, duration_ms)
           VALUES ($1, $2, $3, $4, now(), $5)`,
          [m.id, manifest.module, m.name, checksum, Date.now() - mulai],
        );
        await client.query('COMMIT');
        console.log(`  ${schema}: ${m.id} diterapkan (${Date.now() - mulai} ms)`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`  ${schema}: ${m.id} GAGAL — ${e.message}`);
        throw e;
      }
    }
  }
  console.log('Selesai.');
} finally {
  await client.end();
}
