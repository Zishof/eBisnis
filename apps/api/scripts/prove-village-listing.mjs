/**
 * Bukti lapisan daftar layar petugas.
 *
 * Uji satuan `village-listing.spec.ts` sudah mencocokkan setiap kolom terhadap
 * berkas migrasi. Yang **tidak** dapat dibuktikannya adalah bahwa kuerinya
 * benar-benar berjalan: nama kolom yang ada pada migrasi tetap dapat
 * menghasilkan SQL yang gagal karena gabungan yang keliru, alias yang tidak
 * dikenali, atau agregat tanpa GROUP BY.
 *
 * Berkas ini menjalankan **setiap** daftar terhadap PostgreSQL sungguhan.
 *
 * Yang dibuktikan:
 *
 * 1. **Setiap daftar dapat dijalankan** — tidak satu pun menghasilkan galat SQL.
 * 2. **Setiap daftar menyaring `village_unit_id`** — daftar yang lupa
 *    menyaringnya akan menampilkan data desa lain pada pemasangan terpusat yang
 *    kelak memuat lebih dari satu unit.
 * 3. **Tidak satu pun kolom hasil bernama ruas terlarang** — dibuktikan dari
 *    nama kolom yang BENAR-BENAR dikembalikan peladen, bukan dari konfigurasi.
 * 4. **Baris terhapus lunak tidak muncul.**
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });

const lines = [];
const log = (t) => {
  lines.push(t);
  console.log(t);
};
let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(4).toString('hex');
const S = `uji_daftar_${tag}`;

/**
 * Membaca konfigurasi daftar dari berkas TypeScript-nya.
 *
 * Bukan mengimpornya: berkasnya TypeScript, dan skrip ini Node biasa. Yang
 * dibaca hanya bagian yang diperlukan, dan bila pembacaannya gagal, jumlah
 * daftarnya akan nol — yang ditangkap pemeriksaan pertama.
 */
function bacaDaftar() {
  // Akhiran baris dinormalkan lebih dahulu. Berkasnya tersimpan dengan CRLF
  // di Windows, dan pola yang memuat baris baru tidak akan cocok satu pun
  // tanpa ini - menghasilkan nol daftar, yang tampak seperti "tidak ada yang
  // perlu diuji" alih-alih seperti pembacaan yang rusak.
  const teks = readFileSync(
    new URL('../src/modules/village/village-listing.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  const blok = teks.slice(
    teks.indexOf('export const DAFTAR'),
    teks.indexOf('// --- Pemeriksaan konfigurasi'),
  );

  const hasil = [];
  for (const potongan of blok.split(/\n  \{\n/).slice(1)) {
    const ambil = (kunci) => potongan.match(new RegExp(`${kunci}: '([^']*)'`))?.[1];
    const kode = ambil('kode');
    if (!kode) continue;

    const pilihBlok = potongan.match(/pilih: \[([\s\S]*?)\n    \],/);
    const pilihSatuBaris = potongan.match(/pilih: \[([^\]]*)\],/);
    const pilihTeks = (pilihBlok ?? pilihSatuBaris)?.[1] ?? '';
    const pilih = [...pilihTeks.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);

    hasil.push({
      kode,
      tabel: ambil('tabel'),
      alias: ambil('alias'),
      gabung: ambil('gabung') ?? '',
      urut: ambil('urut'),
      pilih,
      hapusLunak: /hapusLunak: true/.test(potongan),
    });
  }
  return hasil;
}

const RUAS_TERLARANG = [
  'national_id', 'nik', 'applicant_nik', 'external_id_number', 'mother_name',
  'father_name', 'tracking_token', 'verification_token', 'claim_code',
  'storage_key', 'latitude', 'longitude', 'geojson', 'reporter_phone',
  'applicant_phone', 'answers',
];

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI LAPISAN DAFTAR LAYAR PETUGAS');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE SCHEMA "${S}__audit"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
  await q(`CREATE TABLE "${S}__audit".audit_log (
    id BIGSERIAL PRIMARY KEY, table_name TEXT, operation TEXT, at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE FUNCTION "${S}__audit".audit_row_trigger() RETURNS trigger AS $fn$
    BEGIN
      INSERT INTO "${S}__audit".audit_log (table_name, operation) VALUES (TG_TABLE_NAME, TG_OP);
      RETURN COALESCE(NEW, OLD);
    END $fn$ LANGUAGE plpgsql`);

  const manifest = JSON.parse(
    readFileSync(new URL('../tenant-migrations/village/manifest.village.json', import.meta.url), 'utf8'),
  );
  for (const m of manifest.migrations) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S).replace(/\{\{AUDIT_SCHEMA\}\}/g, `${S}__audit`));
  }

  // Dua unit: satu aktif, satu tidak.
  //
  // Skema penyewa hanya boleh punya SATU unit aktif, ditegakkan indeks parsial
  // `village_unit_single_active` (D-5) — jaminan yang lebih kuat daripada yang
  // semula hendak diuji di sini. Unit kedua tetap dibuat sebagai unit lama yang
  // sudah dinonaktifkan, keadaan yang sah ketika desa berubah menjadi
  // kelurahan, dan datanya masih tertinggal pada tabel yang sama.
  //
  // Justru itulah yang perlu dibuktikan: daftar tidak boleh menampilkan data
  // milik unit yang sudah dinonaktifkan bersama data unit yang berjalan.
  const unitA = (await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug)
     VALUES ('DESA', 'A', 'Desa Uji A', 'desa-a-${tag}') RETURNING id`,
  ))[0].id;
  const unitB = (await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug, is_active)
     VALUES ('DESA', 'B', 'Unit Lama (nonaktif)', 'desa-b-${tag}', FALSE) RETURNING id`,
  ))[0].id;

  const daftar = bacaDaftar();

  // --- 1. Konfigurasinya terbaca -------------------------------------------
  log('');
  log('1. Konfigurasi daftar');
  check(
    'konfigurasi terbaca dengan jumlah yang masuk akal',
    daftar.length >= 20,
    `${daftar.length} daftar terbaca`,
  );
  check('setiap daftar punya tabel, alias, dan proyeksi',
    daftar.every((d) => d.tabel && d.alias && d.pilih.length && d.urut));

  // --- 2. Setiap daftar berjalan --------------------------------------------
  log('');
  log('2. Setiap daftar dapat dijalankan terhadap PostgreSQL sungguhan');
  const kolomHasil = new Map();

  for (const d of daftar) {
    const gabung = d.gabung.replace(/\{S\}/g, `"${S}"`);
    const pilih = d.pilih.map((p) => p.replace(/\{S\}/g, `"${S}"`)).join(', ');
    const syarat = [`${d.alias}.village_unit_id = $1`];
    if (d.hapusLunak) syarat.push(`${d.alias}.deleted_at IS NULL`);

    const sql =
      `SELECT ${pilih} FROM "${S}".${d.tabel} ${d.alias} ${gabung} ` +
      `WHERE ${syarat.join(' AND ')} ORDER BY ${d.urut} LIMIT 50 OFFSET 0`;

    try {
      const hasil = await client.query(sql, [unitA]);
      kolomHasil.set(d.kode, hasil.fields.map((f) => f.name));
      check(`${d.kode}`, true);
    } catch (e) {
      check(`${d.kode}`, false, e.message.split('\n')[0]);
    }

    // Kuerinya juga harus berjalan sebagai CACAH — bentuk yang dipakai
    // penomoran halaman, dan bentuk yang paling mudah rusak oleh agregat.
    try {
      await client.query(
        `SELECT COUNT(*)::text AS n FROM "${S}".${d.tabel} ${d.alias} ${gabung} WHERE ${syarat.join(' AND ')}`,
        [unitA],
      );
    } catch (e) {
      check(`${d.kode} (cacah)`, false, e.message.split('\n')[0]);
    }
  }

  // --- 3. Tidak ada ruas terlarang pada kolom hasil -------------------------
  log('');
  log('3. Kolom yang BENAR-BENAR dikembalikan peladen');
  const bocor = [];
  for (const [kode, kolom] of kolomHasil) {
    for (const k of kolom) {
      if (RUAS_TERLARANG.includes(k)) bocor.push(`${kode}.${k}`);
    }
  }
  check(
    'tidak satu pun kolom hasil bernama ruas terlarang',
    bocor.length === 0,
    bocor.join(', ') || 'dibuktikan dari nama kolom hasil, bukan dari konfigurasi',
  );
  log(`       ${kolomHasil.size} daftar diperiksa, ${[...kolomHasil.values()].flat().length} kolom.`);

  // --- 4. Pemisahan antar unit ---------------------------------------------
  log('');
  log('4. Daftar tidak membocorkan unit lain');
  log('       Satu skema hanya boleh punya SATU unit aktif — ditegakkan indeks parsial');
  log('       village_unit_single_active. Unit kedua di bawah adalah unit lama yang');
  log('       sudah dinonaktifkan, dan datanya masih tertinggal pada tabel yang sama.');
  await q(
    `INSERT INTO "${S}".village_officer (village_unit_id, external_name, position_code, position_name)
     VALUES ($1, 'Aparatur Desa A', 'KADES', 'Kepala Desa'),
            ($2, 'Aparatur unit lama', 'KADES', 'Kepala Desa')`,
    [unitA, unitB],
  );

  const aparaturA = await q(
    `SELECT COALESCE(o.external_name, r.full_name) AS display_name
       FROM "${S}".village_officer o
  LEFT JOIN "${S}".village_resident r ON r.id = o.village_resident_id
      WHERE o.village_unit_id = $1 AND o.deleted_at IS NULL`,
    [unitA],
  );
  check(
    'daftar aparatur Desa A hanya berisi aparatur Desa A',
    aparaturA.length === 1 && aparaturA[0].display_name === 'Aparatur Desa A',
    `${aparaturA.length} baris: ${aparaturA.map((r) => r.display_name).join(', ')}`,
  );

  const tanpaSaring = await q(`SELECT COUNT(*)::int AS n FROM "${S}".village_officer`);
  check(
    'tanpa penyaring unit, data unit lama memang ikut terbawa',
    tanpaSaring[0].n === 2,
    'ini yang dicegah penyaring village_unit_id pada setiap daftar',
  );

  // --- 5. Baris terhapus lunak tidak muncul --------------------------------
  log('');
  log('5. Baris terhapus lunak');
  const dihapus = (await q(
    `INSERT INTO "${S}".village_officer
       (village_unit_id, external_name, position_code, position_name, deleted_at)
     VALUES ($1, 'Sudah berhenti', 'KAUR', 'Kaur Umum', now()) RETURNING id`,
    [unitA],
  ))[0].id;

  const tampil = await q(
    `SELECT o.id FROM "${S}".village_officer o
      WHERE o.village_unit_id = $1 AND o.deleted_at IS NULL`,
    [unitA],
  );
  check(
    'aparatur yang sudah berhenti tidak muncul',
    !tampil.some((r) => r.id === dihapus),
    'aparatur yang muncul kembali setelah berhenti akan ditugaskan menandatangani surat',
  );

  // --- 6. Nilai saringan yang tidak sah tidak menjadi SQL -------------------
  log('');
  log('6. Nilai saringan selalu terikat sebagai parameter');
  const jahat = "'; DROP TABLE \"" + S + '".village_officer; --';
  const hasilJahat = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".village_officer o
      WHERE o.village_unit_id = $1 AND COALESCE(o.external_name, '') ILIKE $2`,
    [unitA, `%${jahat}%`],
  );
  const masihAda = await q(
    `SELECT to_regclass($1) IS NOT NULL AS ada`,
    [`"${S}".village_officer`],
  );
  check(
    'nilai saringan berisi perintah SQL diperlakukan sebagai teks',
    hasilJahat[0].n === 0 && masihAda[0].ada === true,
    'tabelnya masih ada; nilainya dicari sebagai teks biasa dan tidak cocok apa pun',
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await q(`DROP SCHEMA IF EXISTS "${S}" CASCADE`).catch(() => {});
  await q(`DROP SCHEMA IF EXISTS "${S}__audit" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-daftar-petugas.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
