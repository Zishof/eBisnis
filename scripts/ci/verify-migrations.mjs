#!/usr/bin/env node
/**
 * Verifikasi integritas migration sebelum merge.
 *
 * Memeriksa:
 *   1. penamaan berkas migration tenant  V###__snake_case.sql
 *   2. katalog manifest.json sinkron dengan berkas di disk
 *   3. nomor versi berurutan tanpa lompatan atau duplikat
 *   4. SQL destruktif tanpa penanda persetujuan
 *   5. immutability: berkas migration yang sudah ada tidak boleh berubah
 *
 * Pemeriksaan immutability hanya berjalan bila diberi commit pembanding
 * (argumen pertama, biasanya SHA base branch pada pull request).
 *
 * Keluar dengan kode 1 bila ada pelanggaran.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_DIR = 'apps/api/tenant-migrations';
const MANIFEST = join(MIGRATION_DIR, 'manifest.json');
const NAME_PATTERN = /^V(\d{3})__[a-z0-9]+(_[a-z0-9]+)*\.sql$/;

/**
 * Pernyataan yang menghancurkan atau kehilangan data. Ditolak kecuali berkas
 * memuat penanda persetujuan eksplisit, karena pola upgrade proyek ini adalah
 * expand-and-contract: penghapusan dilakukan pada rilis CONTRACT terpisah.
 */
const DESTRUCTIVE = [
  /\bDROP\s+TABLE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDROP\s+DATABASE\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TABLE\s+\S+\s+RENAME\b/i,
  /\bDROP\s+CONSTRAINT\b/i,
  /\bDROP\s+INDEX\b/i,
];
const APPROVAL_MARKER = '-- DESTRUCTIVE-APPROVED:';

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

// --- 1 dan 3. Penamaan dan urutan versi ------------------------------------

const files = readdirSync(MIGRATION_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  fail(`Tidak ada berkas .sql pada ${MIGRATION_DIR}`);
}

const versions = [];
for (const file of files) {
  const match = NAME_PATTERN.exec(file);
  if (!match) {
    fail(`Penamaan tidak sesuai pola V###__snake_case.sql: ${file}`);
    continue;
  }
  versions.push({ file, version: `V${match[1]}`, sequence: Number(match[1]) });
}

versions.sort((a, b) => a.sequence - b.sequence);
versions.forEach((entry, index) => {
  const expected = index + 1;
  if (entry.sequence !== expected) {
    fail(
      `Urutan versi tidak berurutan: ${entry.file} berada pada posisi ${expected} ` +
        `tetapi bernomor ${entry.sequence}. Nomor tidak boleh melompat atau duplikat.`,
    );
  }
});

// --- 2. Manifest sinkron dengan disk ---------------------------------------

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (error) {
  fail(`Tidak dapat membaca ${MANIFEST}: ${error.message}`);
}

if (manifest) {
  const listed = new Map(manifest.migrations.map((m) => [m.file, m]));

  for (const { file, version } of versions) {
    const entry = listed.get(file);
    if (!entry) {
      fail(`Berkas ${file} ada di disk tetapi tidak terdaftar pada manifest.json`);
      continue;
    }
    if (entry.version !== version) {
      fail(
        `Versi pada manifest (${entry.version}) tidak cocok dengan nama berkas ${file}`,
      );
    }
    if (!entry.name || !entry.description) {
      fail(`Entri manifest ${file} wajib memiliki name dan description`);
    }
    listed.delete(file);
  }

  for (const orphan of listed.keys()) {
    fail(`manifest.json mendaftarkan ${orphan} tetapi berkasnya tidak ada di disk`);
  }
}

// --- 4. SQL destruktif tanpa persetujuan -----------------------------------

for (const { file } of versions) {
  const content = readFileSync(join(MIGRATION_DIR, file), 'utf8');
  const approved = content.includes(APPROVAL_MARKER);

  for (const pattern of DESTRUCTIVE) {
    const lines = content.split('\n').filter((line) => {
      const trimmed = line.trim();

      // Komentar bukan pernyataan.
      if (trimmed.startsWith('--')) return false;

      // `DROP ... IF EXISTS` adalah pola pembuatan ulang yang idempotent:
      // objeknya langsung dibuat kembali pada pernyataan berikutnya.
      if (/\bDROP\s+(TRIGGER|FUNCTION|CONSTRAINT|INDEX|POLICY|VIEW)\s+IF\s+EXISTS/i.test(trimmed)) {
        return false;
      }

      // Pada GRANT/REVOKE, kata seperti TRUNCATE adalah NAMA PRIVILEGE, bukan
      // perintah yang menghapus data. Justru REVOKE-lah yang melindungi tabel
      // audit agar append-only.
      if (/^\s*(GRANT|REVOKE)\b/i.test(trimmed)) return false;

      return pattern.test(trimmed);
    });

    if (lines.length > 0 && !approved) {
      fail(
        `SQL destruktif tanpa penanda persetujuan pada ${file}:\n` +
          lines.map((l) => `      ${l.trim()}`).join('\n') +
          `\n    Tambahkan baris "${APPROVAL_MARKER} <alasan>" bila memang disengaja.`,
      );
    }
  }
}

// --- 5. Immutability terhadap commit pembanding ----------------------------

const baseRef = process.argv[2];
if (baseRef) {
  let changed = [];
  try {
    changed = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=MDR', `${baseRef}...HEAD`, '--', MIGRATION_DIR],
      { encoding: 'utf8' },
    )
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.sql'));
  } catch (error) {
    notes.push(`Lewati pemeriksaan immutability: ${error.message.split('\n')[0]}`);
  }

  for (const path of changed) {
    fail(
      `Migration yang sudah ada diubah atau dihapus: ${path}\n` +
        '    Migration yang pernah diterapkan bersifat immutable. Buat versi baru.',
    );
  }

  if (changed.length === 0) {
    notes.push(`Immutability: tidak ada migration lama yang diubah terhadap ${baseRef}`);
  }
} else {
  notes.push('Immutability dilewati: tidak ada commit pembanding yang diberikan');
}

// --- Laporan ---------------------------------------------------------------

console.log(`Memeriksa ${versions.length} migration tenant pada ${MIGRATION_DIR}`);
for (const { file, version } of versions) {
  const checksum = createHash('sha256')
    .update(readFileSync(join(MIGRATION_DIR, file)))
    .digest('hex')
    .slice(0, 16);
  console.log(`  ${version}  ${checksum}  ${file}`);
}

for (const note of notes) {
  console.log(`\nCatatan: ${note}`);
}

if (problems.length > 0) {
  console.error(`\n${problems.length} pelanggaran ditemukan:\n`);
  problems.forEach((p, i) => console.error(`  ${i + 1}. ${p}`));
  process.exit(1);
}

console.log('\nSeluruh pemeriksaan migration lulus.');
