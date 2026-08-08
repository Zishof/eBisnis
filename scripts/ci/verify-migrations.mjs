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
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATION_DIR = 'apps/api/tenant-migrations';
const MANIFEST = join(MIGRATION_DIR, 'manifest.json');
const NAME_PATTERN = /^V(\d{3})__[a-z0-9]+(_[a-z0-9]+)*\.sql$/;
const HEALTH_NAME_PATTERN = /^H(\d{3})__health__[a-z0-9]+(_[a-z0-9]+)*\.sql$/;

/**
 * Nama berkas migrasi modul: <timestamp>__<modul>__<keterangan>.sql
 *
 * Modul vertikal tidak memakai nomor urut global. Nomor urut yang disunting
 * tiga sesi paralel akan bertabrakan, dan tabrakan pada nomor migrasi berarti
 * satu migrasi dianggap sudah diterapkan lalu dilewati tanpa galat (IR-001).
 */
const MODULE_NAME_PATTERN =
  /^(\d{8}T\d{6})__([a-z][a-z0-9_]*)__[a-z0-9]+(_[a-z0-9]+)*\.sql$/;
const MAX_MIGRATION_ID_LENGTH = 128;

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
const healthVersions = [];
for (const file of files) {
  const match = NAME_PATTERN.exec(file);
  if (match) {
    versions.push({ file, version: `V${match[1]}`, sequence: Number(match[1]) });
    continue;
  }

  const healthMatch = HEALTH_NAME_PATTERN.exec(file);
  if (healthMatch) {
    healthVersions.push({
      file,
      version: `H${healthMatch[1]}`,
      sequence: 1000 + Number(healthMatch[1]),
    });
    continue;
  }

  fail(`Penamaan tidak sesuai pola V###__snake_case.sql atau H###__health__snake_case.sql: ${file}`);
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

healthVersions.sort((a, b) => a.sequence - b.sequence);
healthVersions.forEach((entry, index) => {
  const previous = healthVersions[index - 1];
  if (previous?.sequence === entry.sequence) {
    fail(`Nomor migration health duplikat: ${previous.file} dan ${entry.file}`);
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

  for (const { file, version, sequence } of [...versions, ...healthVersions]) {
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
    if (entry.sequence !== sequence) {
      fail(
        `Sequence pada manifest (${entry.sequence}) tidak cocok dengan ${version} pada ${file}; ` +
          `seharusnya ${sequence}`,
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

// --- 3b. Migrasi modul vertikal (IR-001) -----------------------------------
//
// Sebelum ini pemeriksa hanya melihat berkas .sql di tingkat teratas, sehingga
// migrasi modul di dalam subdirektori TIDAK diperiksa sama sekali. Itu lebih
// buruk daripada gagal: pemeriksa yang melewatkan berkas tanpa berkata apa-apa
// memberi keyakinan yang tidak berdasar.

const moduleDirs = readdirSync(MIGRATION_DIR).filter((name) => {
  const full = join(MIGRATION_DIR, name);
  return statSync(full).isDirectory() && existsSync(join(full, 'manifest.json'));
});

/** Berkas modul, untuk ikut diperiksa SQL destruktifnya. */
const moduleFiles = [];

for (const moduleName of moduleDirs) {
  const dir = join(MIGRATION_DIR, moduleName);
  let moduleManifest;
  try {
    moduleManifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  } catch (error) {
    fail(`manifest.json modul ${moduleName} tidak dapat dibaca: ${error.message}`);
    continue;
  }

  if (moduleManifest.module !== moduleName) {
    fail(
      `Manifest pada direktori ${moduleName} menyebut modul "${moduleManifest.module}". ` +
        'Nama direktori dan nama modul harus sama.',
    );
  }

  const onDisk = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  const listed = new Map((moduleManifest.migrations ?? []).map((m) => [m.file, m]));

  for (const file of onDisk) {
    const match = MODULE_NAME_PATTERN.exec(file);
    if (!match) {
      fail(
        `Nama berkas migrasi modul tidak sesuai pola pada ${moduleName}/${file}. ` +
          'Pakai <timestamp>__<modul>__<keterangan>.sql',
      );
      continue;
    }
    if (match[2] !== moduleName) {
      fail(
        `Berkas ${moduleName}/${file} menyebut modul "${match[2]}". ` +
          'Nama modul pada berkas harus sama dengan direktorinya.',
      );
    }

    const entry = listed.get(file);
    if (!entry) {
      fail(`Berkas ${moduleName}/${file} ada di disk tetapi tidak terdaftar pada manifestnya`);
      continue;
    }
    if (entry.id !== file.replace(/\.sql$/, '')) {
      fail(
        `Id manifest (${entry.id}) tidak cocok dengan nama berkas ${moduleName}/${file}`,
      );
    }
    if (entry.id.length > MAX_MIGRATION_ID_LENGTH) {
      fail(
        `Id ${entry.id} panjangnya ${entry.id.length} aksara, melebihi batas ` +
          `${MAX_MIGRATION_ID_LENGTH} yang dapat disimpan schema_migration.version`,
      );
    }
    if (!entry.name) {
      fail(`Entri manifest ${moduleName}/${file} wajib memiliki name`);
    }
    listed.delete(file);
    moduleFiles.push(join(moduleName, file));
  }

  for (const orphan of listed.keys()) {
    fail(`manifest modul ${moduleName} mendaftarkan ${orphan} tetapi berkasnya tidak ada di disk`);
  }
}

// Id migrasi tidak boleh dipakai dua modul. Bila dibiarkan, salah satunya
// dianggap sudah diterapkan dan dilewati tanpa galat.
const seenIds = new Map();
for (const moduleName of moduleDirs) {
  const manifestPath = join(MIGRATION_DIR, moduleName, 'manifest.json');
  let mm;
  try {
    mm = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    continue;
  }
  for (const entry of mm.migrations ?? []) {
    const owner = seenIds.get(entry.id);
    if (owner) {
      fail(`Id migrasi "${entry.id}" dipakai modul ${owner} dan ${moduleName} sekaligus`);
    }
    seenIds.set(entry.id, moduleName);
  }
}

// --- 4. SQL destruktif tanpa persetujuan -----------------------------------

const destructiveTargets = [
  ...versions.map((v) => v.file),
  ...healthVersions.map((v) => v.file),
  ...moduleFiles,
];

for (const file of destructiveTargets) {
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
  let immutabilityChecked = false;
  try {
    changed = execFileSync(
      'git',
      ['diff', '--name-only', '--diff-filter=MDR', `${baseRef}...HEAD`, '--', MIGRATION_DIR],
      { encoding: 'utf8' },
    )
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.sql'));
    immutabilityChecked = true;
  } catch (error) {
    fail(
      `Pemeriksaan immutability gagal terhadap ${baseRef}: ${error.message.split('\n')[0]}\n` +
        '    Commit pembanding wajib valid; pemeriksaan tidak boleh dilewati diam-diam.',
    );
  }

  for (const path of changed) {
    fail(
      `Migration yang sudah ada diubah atau dihapus: ${path}\n` +
        '    Migration yang pernah diterapkan bersifat immutable. Buat versi baru.',
    );
  }

  if (immutabilityChecked && changed.length === 0) {
    notes.push(`Immutability: tidak ada migration lama yang diubah terhadap ${baseRef}`);
  }
} else {
  notes.push('Immutability dilewati: tidak ada commit pembanding yang diberikan');
}

// --- Laporan ---------------------------------------------------------------

console.log(
  `Memeriksa ${versions.length} migration inti, ${healthVersions.length} migration health, ` +
    `dan ${moduleFiles.length} migration modul ` +
    `(${moduleDirs.length} modul) pada ${MIGRATION_DIR}`,
);
for (const { file, version } of versions) {
  const checksum = createHash('sha256')
    .update(readFileSync(join(MIGRATION_DIR, file)))
    .digest('hex')
    .slice(0, 16);
  console.log(`  ${version}  ${checksum}  ${file}`);
}

for (const { file, version } of healthVersions) {
  const checksum = createHash('sha256')
    .update(readFileSync(join(MIGRATION_DIR, file)))
    .digest('hex')
    .slice(0, 16);
  console.log(`  ${version}  ${checksum}  ${file}`);
}

for (const file of moduleFiles) {
  const checksum = createHash('sha256')
    .update(readFileSync(join(MIGRATION_DIR, file)))
    .digest('hex')
    .slice(0, 16);
  console.log(`  modul  ${checksum}  ${file}`);
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
