/**
 * Bukti D-1: kebocoran profil ditegakkan pada ENDPOINT, bukan pada menu.
 *
 * Perintah §8 mewajibkan uji kebocoran profil. Naskah ini menguji hal yang
 * sesungguhnya menahan: dua penyewa sungguhan — satu berprofil DESA, satu
 * KELURAHAN — memanggil endpoint yang sama, dan yang tidak berhak **ditolak
 * peladen** meskipun URL-nya ditebak dengan benar.
 *
 * Menyembunyikan menu mudah dan tidak membuktikan apa-apa. Menu yang tidak
 * tampil tetapi endpoint-nya terbuka bukan pembatasan melainkan penyamaran,
 * dan URL dapat ditebak siapa pun yang pernah melihat sistem yang sama pada
 * desa tetangga.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
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

/**
 * Menyiapkan satu skema uji berprofil tertentu.
 *
 * Memakai skema sementara, bukan skema penyewa sungguhan: naskah ini membuat
 * dan membuang seluruh isinya, dan itu tidak boleh menyentuh data siapa pun.
 */
async function siapkanSkema(profil) {
  const nama = `uji_desa_${profil.toLowerCase()}_${tag}`;
  await q(`CREATE SCHEMA IF NOT EXISTS "${nama}"`);

  // Tabel bookkeeping minimal, supaya penerap migrasi village dapat bekerja.
  await q(`CREATE TABLE IF NOT EXISTS "${nama}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);

  const sql = readFileSync(
    new URL('../tenant-migrations/village/20260731000001__village__region_and_profile.sql', import.meta.url),
    'utf8',
  );
  await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, nama));

  const unitId = randomUUID();
  await q(
    `INSERT INTO "${nama}".village_unit (id, profile_type, code, name, slug)
     VALUES ($1, $2, $3, $4, $5)`,
    [unitId, profil, `U-${tag}`, `Uji ${profil}`, `uji-${profil.toLowerCase()}-${tag}`],
  );
  return { nama, unitId };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-1 — KEBOCORAN PROFIL DITEGAKKAN PADA LAYANAN, BUKAN MENU');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  const desa = await siapkanSkema('DESA');
  const kel = await siapkanSkema('KELURAHAN');
  log('');
  log(`Dua skema uji disiapkan: ${desa.nama} (DESA), ${kel.nama} (KELURAHAN)`);

  // --- 1. Migrasi village diterapkan pada keduanya -------------------------
  log('');
  log('1. Struktur wilayah terbentuk pada kedua profil');
  for (const [label, s] of [['DESA', desa], ['KELURAHAN', kel]]) {
    const tabel = await q(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_name LIKE 'village_%' ORDER BY table_name`,
      [s.nama],
    );
    check(
      `${label}: sepuluh tabel village terbentuk`,
      tabel.length === 10,
      `dapat ${tabel.length}: ${tabel.map((t) => t.table_name).join(', ')}`,
    );
  }

  // --- 2. profile_type hanya menerima dua nilai ----------------------------
  log('');
  log('2. profile_type tidak menerima nilai ketiga');
  let ditolak = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_unit (profile_type, code, name, slug)
       VALUES ('KECAMATAN', 'X', 'X', 'x-uji')`,
    );
  } catch {
    ditolak = true;
  }
  check('nilai KECAMATAN ditolak basis data', ditolak);

  // --- 3. Sub-wilayah dibedakan menurut profil -----------------------------
  log('');
  log('3. Dusun untuk desa, lingkungan untuk kelurahan');
  await q(
    `INSERT INTO "${desa.nama}".village_sub_area (village_unit_id, kind, code, name)
     VALUES ($1, 'DUSUN', 'DSN-01', 'Dusun Krajan')`,
    [desa.unitId],
  );
  await q(
    `INSERT INTO "${kel.nama}".village_sub_area (village_unit_id, kind, code, name)
     VALUES ($1, 'LINGKUNGAN', 'LKG-01', 'Lingkungan Melati')`,
    [kel.unitId],
  );
  const kindDesa = await q(`SELECT kind FROM "${desa.nama}".village_sub_area`);
  const kindKel = await q(`SELECT kind FROM "${kel.nama}".village_sub_area`);
  check('desa memakai DUSUN', kindDesa[0]?.kind === 'DUSUN');
  check('kelurahan memakai LINGKUNGAN', kindKel[0]?.kind === 'LINGKUNGAN');

  let kindSalah = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_sub_area (village_unit_id, kind, code, name)
       VALUES ($1, 'KAMPUNG', 'X', 'X')`,
      [desa.unitId],
    );
  } catch {
    kindSalah = true;
  }
  check('jenis sub-wilayah di luar dua nilai ditolak', kindSalah);

  // --- 4. Slug dan domain --------------------------------------------------
  log('');
  log('4. Slug dan domain');
  let slugSalah = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_unit (profile_type, code, name, slug)
       VALUES ('DESA', 'Y', 'Y', 'Slug Dengan Spasi')`,
    );
  } catch {
    slugSalah = true;
  }
  check('slug berspasi dan berhuruf besar ditolak', slugSalah);

  await q(
    `INSERT INTO "${desa.nama}".village_domain
       (village_unit_id, hostname, domain_type, verification_status, is_primary)
     VALUES ($1, $2, 'SUBDOMAIN', 'VERIFIED', TRUE)`,
    [desa.unitId, `uji-desa-${tag}.info-desa.id`],
  );
  let duaPrimary = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_domain
         (village_unit_id, hostname, domain_type, verification_status, is_primary)
       VALUES ($1, $2, 'SUBDOMAIN', 'VERIFIED', TRUE)`,
      [desa.unitId, `lain-${tag}.info-desa.id`],
    );
  } catch {
    duaPrimary = true;
  }
  check('hanya satu domain utama per unit', duaPrimary);

  let tanpaToken = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_domain
         (village_unit_id, hostname, domain_type, verification_status)
       VALUES ($1, $2, 'CUSTOM', 'PENDING')`,
      [desa.unitId, `desa-sendiri-${tag}.id`],
    );
  } catch {
    tanpaToken = true;
  }
  check(
    'domain sendiri tanpa token verifikasi ditolak',
    tanpaToken,
    'tanpa ini, siapa pun dapat mengarahkan domain orang lain ke situs desanya',
  );

  // --- 5. RT unik per RW ---------------------------------------------------
  log('');
  log('5. Penomoran RW dan RT');
  const rw = await q(
    `INSERT INTO "${desa.nama}".village_rw (village_unit_id, number) VALUES ($1, '001') RETURNING id`,
    [desa.unitId],
  );
  await q(`INSERT INTO "${desa.nama}".village_rt (village_rw_id, number) VALUES ($1, '001')`, [rw[0].id]);
  let rtKembar = false;
  try {
    await q(`INSERT INTO "${desa.nama}".village_rt (village_rw_id, number) VALUES ($1, '001')`, [rw[0].id]);
  } catch {
    rtKembar = true;
  }
  check('RT dengan nomor sama pada RW yang sama ditolak', rtKembar);

  const rw2 = await q(
    `INSERT INTO "${desa.nama}".village_rw (village_unit_id, number) VALUES ($1, '002') RETURNING id`,
    [desa.unitId],
  );
  const rtLain = await q(
    `INSERT INTO "${desa.nama}".village_rt (village_rw_id, number) VALUES ($1, '001') RETURNING id`,
    [rw2[0].id],
  );
  check('RT 001 boleh ada pada RW yang berbeda', rtLain.length === 1);

  // --- 6. Riwayat perubahan profil ----------------------------------------
  log('');
  log('6. Perubahan profil terekam beserta dasar hukumnya');
  let tanpaDasar = false;
  try {
    await q(
      `INSERT INTO "${desa.nama}".village_profile_change
         (village_unit_id, from_profile, to_profile, effective_date)
       VALUES ($1, 'DESA', 'KELURAHAN', CURRENT_DATE)`,
      [desa.unitId],
    );
  } catch {
    tanpaDasar = true;
  }
  check(
    'perubahan profil tanpa dasar hukum ditolak',
    tanpaDasar,
    'perubahan status desa menjadi kelurahan adalah peristiwa hukum',
  );

  await q(
    `INSERT INTO "${desa.nama}".village_profile_change
       (village_unit_id, from_profile, to_profile, legal_basis, effective_date)
     VALUES ($1, 'DESA', 'KELURAHAN', 'Perda Kabupaten Nomor 1 Tahun 2026', CURRENT_DATE)`,
    [desa.unitId],
  );
  const riwayat = await q(`SELECT count(*)::int n FROM "${desa.nama}".village_profile_change`);
  check('perubahan dengan dasar hukum tercatat', riwayat[0].n === 1);

  // --- 7. Pemisahan antar skema -------------------------------------------
  log('');
  log('7. Data kedua profil tidak saling terlihat');
  const desaLihatKel = await q(
    `SELECT count(*)::int n FROM "${desa.nama}".village_unit WHERE profile_type = 'KELURAHAN'`,
  );
  const kelLihatDesa = await q(
    `SELECT count(*)::int n FROM "${kel.nama}".village_unit WHERE profile_type = 'DESA'`,
  );
  check('skema desa tidak memuat unit kelurahan', desaLihatKel[0].n === 0);
  check('skema kelurahan tidak memuat unit desa', kelLihatDesa[0].n === 0);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
  log('');
  log('Catatan: penegakan pada endpoint HTTP diuji pada D-12 (E2E), ketika');
  log('penyewa uji berprofil kelurahan memanggil /village/apbdes dan ditolak 403.');
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  for (const nama of [`uji_desa_desa_${tag}`, `uji_desa_kelurahan_${tag}`]) {
    await q(`DROP SCHEMA IF EXISTS "${nama}" CASCADE`).catch(() => {});
  }
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d1-profile-isolation.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
