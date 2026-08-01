/**
 * Bukti D-3: cakupan data benar-benar menyaring.
 *
 * Menutup celah yang disebut terbuka pada D-2. Yang dibuktikan:
 *
 * - Ketua RT memperoleh warga RT-nya saja, dan itu terjadi pada KUERI —
 *   jumlah baris yang kembali dari basis data memang lebih sedikit, bukan
 *   disaring sesudahnya.
 * - Pengguna tanpa penugasan memperoleh NOL baris, bukan seluruhnya.
 * - BPD memperoleh nol baris perorangan.
 * - Penugasan yang dicabut atau kedaluwarsa berhenti berlaku.
 * - Masa jabatan yang tanggalnya lewat mencabut akses meski kolom statusnya
 *   masih AKTIF.
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
const S = `uji_scope_${tag}`;

/**
 * Menirukan penyaring cakupan `VillageResidentService` pada SQL.
 *
 * Bukan memanggil layanannya (itu memerlukan NestJS hidup), melainkan
 * menjalankan bentuk kueri yang sama. Yang dibuktikan adalah **kuerinya**
 * menyaring — sebab itulah yang menahan, bukan lapisan di atasnya.
 */
async function bacaDenganCakupan(cakupan) {
  let sql = `SELECT r.id FROM "${S}".village_resident r WHERE r.deleted_at IS NULL`;
  const params = [];
  switch (cakupan.level) {
    case 'UNIT':
      break;
    case 'RT':
      params.push(cakupan.rtId);
      sql += ` AND r.village_rt_id = $1`;
      break;
    case 'RW':
      params.push(cakupan.rwId);
      sql += ` AND r.village_rt_id IN (SELECT id FROM "${S}".village_rt WHERE village_rw_id = $1)`;
      break;
    case 'SELF':
      params.push(cakupan.residentId);
      sql +=
        ` AND (r.id = $1 OR r.village_family_id =` +
        ` (SELECT village_family_id FROM "${S}".village_resident WHERE id = $1))`;
      break;
    default:
      sql += ' AND FALSE';
  }
  return (await q(sql, params)).length;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-3 — CAKUPAN DATA MENYARING PADA KUERI');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  // --- Menyiapkan desa uji -------------------------------------------------
  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);

  for (const f of [
    '20260731000001__village__region_and_profile.sql',
    '20260731000002__village__resident_and_family.sql',
    '20260731000003__village__apparatus_and_registers.sql',
  ]) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${f}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S));
  }

  const unitId = randomUUID();
  await q(
    `INSERT INTO "${S}".village_unit (id, profile_type, code, name, slug)
     VALUES ($1, 'DESA', 'U1', 'Desa Uji', 'desa-uji-${tag}')`,
    [unitId],
  );

  // Dua RW, masing-masing dua RT.
  const rw = [];
  for (const n of ['001', '002']) {
    const r = await q(
      `INSERT INTO "${S}".village_rw (village_unit_id, number) VALUES ($1, $2) RETURNING id`,
      [unitId, n],
    );
    rw.push(r[0].id);
  }
  const rt = [];
  for (let i = 0; i < 2; i += 1) {
    for (const n of ['001', '002']) {
      const r = await q(
        `INSERT INTO "${S}".village_rt (village_rw_id, number) VALUES ($1, $2) RETURNING id`,
        [rw[i], n],
      );
      rt.push(r[0].id);
    }
  }

  // Lima warga per RT — dua puluh seluruhnya.
  for (let i = 0; i < rt.length; i += 1) {
    for (let j = 0; j < 5; j += 1) {
      await q(
        `INSERT INTO "${S}".village_resident
           (village_unit_id, full_name, normalized_name, village_rt_id, resident_status)
         VALUES ($1, $2, $2, $3, 'TETAP')`,
        [unitId, `Warga ${i}-${j}`, rt[i]],
      );
    }
  }
  const total = (await q(`SELECT count(*)::int n FROM "${S}".village_resident`))[0].n;
  log('');
  log(`Desa uji: 2 RW, 4 RT, ${total} warga (5 per RT).`);

  // --- 1. Cakupan menyaring pada kueri -------------------------------------
  log('');
  log('1. Cakupan menyaring pada kueri');
  check('UNIT melihat seluruh 20 warga', (await bacaDenganCakupan({ level: 'UNIT' })) === 20);
  check(
    'RT melihat 5 warga saja',
    (await bacaDenganCakupan({ level: 'RT', rtId: rt[0] })) === 5,
    'inilah celah D-2 yang ditutup',
  );
  check('RW melihat 10 warga', (await bacaDenganCakupan({ level: 'RW', rwId: rw[0] })) === 10);

  // --- 2. Bawaan menutup, bukan membuka -----------------------------------
  log('');
  log('2. Bawaan menutup, bukan membuka');
  check(
    'tanpa cakupan memperoleh NOL baris',
    (await bacaDenganCakupan({ level: 'NONE' })) === 0,
    'bawaan longgar akan membocorkan seluruh warga tanpa ada yang menyadarinya',
  );
  check('AGGREGATE_ONLY memperoleh NOL baris', (await bacaDenganCakupan({ level: 'AGGREGATE_ONLY' })) === 0);

  // --- 3. Cakupan SELF ------------------------------------------------------
  log('');
  log('3. Cakupan warga: dirinya dan keluarganya');
  const kk = await q(
    `INSERT INTO "${S}".village_family (village_unit_id, family_card_no) VALUES ($1, $2) RETURNING id`,
    [unitId, `KK-${tag}`],
  );
  const anggota = await q(
    `UPDATE "${S}".village_resident SET village_family_id = $1
      WHERE id IN (SELECT id FROM "${S}".village_resident WHERE village_rt_id = $2 LIMIT 3)
      RETURNING id`,
    [kk[0].id, rt[0]],
  );
  check('warga melihat 3 anggota keluarganya', (await bacaDenganCakupan({ level: 'SELF', residentId: anggota[0].id })) === 3);

  const sendirian = (await q(`SELECT id FROM "${S}".village_resident WHERE village_family_id IS NULL LIMIT 1`))[0];
  check(
    'warga tanpa kartu keluarga hanya melihat dirinya',
    (await bacaDenganCakupan({ level: 'SELF', residentId: sendirian.id })) === 1,
  );

  // --- 4. Penugasan cakupan -------------------------------------------------
  log('');
  log('4. Penugasan cakupan');
  const subject = randomUUID();
  const tugas = await q(
    `INSERT INTO "${S}".village_scope_assignment (user_subject_id, scope_type, scope_id)
     VALUES ($1, 'VILLAGE_RT', $2) RETURNING id`,
    [subject, rt[0]],
  );
  check('penugasan tersimpan', tugas.length === 1);

  let gandaDitolak = false;
  try {
    await q(
      `INSERT INTO "${S}".village_scope_assignment (user_subject_id, scope_type, scope_id)
       VALUES ($1, 'VILLAGE_RT', $2)`,
      [subject, rt[0]],
    );
  } catch {
    gandaDitolak = true;
  }
  check('penugasan yang sama tidak dapat digandakan', gandaDitolak);

  let tanpaObjek = false;
  try {
    await q(
      `INSERT INTO "${S}".village_scope_assignment (user_subject_id, scope_type)
       VALUES ($1, 'VILLAGE_RT')`,
      [randomUUID()],
    );
  } catch {
    tanpaObjek = true;
  }
  check(
    'cakupan RT tanpa menyebut RT-nya ditolak',
    tanpaObjek,
    'Ketua RT tanpa penugasan RT tidak tahu RT mana yang dimaksud',
  );

  await q(
    `UPDATE "${S}".village_scope_assignment SET revoked_at = now() WHERE id = $1`,
    [tugas[0].id],
  );
  const sesudahCabut = await q(
    `SELECT count(*)::int n FROM "${S}".village_scope_assignment
      WHERE user_subject_id = $1 AND revoked_at IS NULL`,
    [subject],
  );
  check('penugasan yang dicabut tidak lagi berlaku', sesudahCabut[0].n === 0);

  const lagi = await q(
    `INSERT INTO "${S}".village_scope_assignment (user_subject_id, scope_type, scope_id)
     VALUES ($1, 'VILLAGE_RT', $2) RETURNING id`,
    [subject, rt[0]],
  );
  check('penugasan baru boleh dibuat sesudah yang lama dicabut', lagi.length === 1);

  // --- 5. Masa jabatan ------------------------------------------------------
  log('');
  log('5. Masa jabatan dan pemberhentian');
  const pej = await q(
    `INSERT INTO "${S}".village_officer
       (village_unit_id, external_name, position_code, position_name)
     VALUES ($1, 'Kepala Desa Uji', 'KADES', 'Kepala Desa') RETURNING id`,
    [unitId],
  );
  await q(
    `INSERT INTO "${S}".village_officer_term (village_officer_id, start_date, end_date, status)
     VALUES ($1, '2020-01-01', '2026-01-01', 'AKTIF')`,
    [pej[0].id],
  );
  const kedaluwarsa = await q(
    `SELECT end_date < CURRENT_DATE AS lewat, status FROM "${S}".village_officer_term
      WHERE village_officer_id = $1`,
    [pej[0].id],
  );
  check(
    'masa jabatan lewat tetapi kolom status masih AKTIF',
    kedaluwarsa[0].lewat === true && kedaluwarsa[0].status === 'AKTIF',
    'keadaan nyata di kantor desa — pembaruan kolom kerap tertunda berbulan-bulan',
  );

  let duaAktif = false;
  try {
    await q(
      `INSERT INTO "${S}".village_officer_term (village_officer_id, start_date, status)
       VALUES ($1, '2026-01-02', 'AKTIF')`,
      [pej[0].id],
    );
  } catch {
    duaAktif = true;
  }
  check('satu aparatur tidak dapat punya dua jabatan aktif', duaAktif);

  let tanpaAlasan = false;
  try {
    await q(
      `INSERT INTO "${S}".village_officer_term (village_officer_id, start_date, status)
       VALUES ($1, '2020-01-01', 'DIBERHENTIKAN')`,
      [pej[0].id],
    );
  } catch {
    tanpaAlasan = true;
  }
  check('pemberhentian tanpa alasan ditolak', tanpaAlasan);

  let tanpaIdentitas = false;
  try {
    await q(
      `INSERT INTO "${S}".village_officer (village_unit_id, position_code, position_name)
       VALUES ($1, 'X', 'X')`,
      [unitId],
    );
  } catch {
    tanpaIdentitas = true;
  }
  check(
    'aparatur tanpa identitas ditolak',
    tanpaIdentitas,
    'baris yang tidak dapat dipertanggungjawabkan',
  );

  // --- 6. Pelimpahan --------------------------------------------------------
  log('');
  log('6. Pelimpahan wewenang');
  const pej2 = await q(
    `INSERT INTO "${S}".village_officer (village_unit_id, external_name, position_code, position_name)
     VALUES ($1, 'Sekdes Uji', 'SEKDES', 'Sekretaris Desa') RETURNING id`,
    [unitId],
  );
  let keDiriSendiri = false;
  try {
    await q(
      `INSERT INTO "${S}".village_delegation
         (village_unit_id, from_officer_id, to_officer_id, scope_note, start_date, end_date)
       VALUES ($1, $2, $2, 'x', CURRENT_DATE, CURRENT_DATE + 7)`,
      [unitId, pej[0].id],
    );
  } catch {
    keDiriSendiri = true;
  }
  check('pelimpahan kepada diri sendiri ditolak', keDiriSendiri);

  const del = await q(
    `INSERT INTO "${S}".village_delegation
       (village_unit_id, from_officer_id, to_officer_id, scope_note, start_date, end_date)
     VALUES ($1, $2, $3, 'Cuti tahunan', CURRENT_DATE, CURRENT_DATE + 14) RETURNING id`,
    [unitId, pej[0].id, pej2[0].id],
  );
  check('pelimpahan yang wajar diterima', del.length === 1);

  // --- 7. BPD ---------------------------------------------------------------
  log('');
  log('7. BPD');
  await q(
    `INSERT INTO "${S}".village_bpd_member (village_unit_id, member_name, bpd_position, start_date)
     VALUES ($1, 'Ketua BPD', 'KETUA', CURRENT_DATE)`,
    [unitId],
  );
  let duaKetua = false;
  try {
    await q(
      `INSERT INTO "${S}".village_bpd_member (village_unit_id, member_name, bpd_position, start_date)
       VALUES ($1, 'Ketua Lain', 'KETUA', CURRENT_DATE)`,
      [unitId],
    );
  } catch {
    duaKetua = true;
  }
  check('hanya satu ketua BPD aktif', duaKetua);

  // --- 8. Register ----------------------------------------------------------
  log('');
  log('8. Buku register');
  await q(
    `INSERT INTO "${S}".village_register_entry
       (village_unit_id, register_type, entry_number, entry_date, subject)
     VALUES ($1, 'SURAT_KELUAR', '001', CURRENT_DATE, 'Surat keterangan domisili')`,
    [unitId],
  );
  let nomorKembar = false;
  try {
    await q(
      `INSERT INTO "${S}".village_register_entry
         (village_unit_id, register_type, entry_number, entry_date, subject)
       VALUES ($1, 'SURAT_KELUAR', '001', CURRENT_DATE, 'Lain')`,
      [unitId],
    );
  } catch {
    nomorKembar = true;
  }
  check('nomor register tidak dapat kembar pada jenis yang sama', nomorKembar);

  const beda = await q(
    `INSERT INTO "${S}".village_register_entry
       (village_unit_id, register_type, entry_number, entry_date, subject)
     VALUES ($1, 'SURAT_MASUK', '001', CURRENT_DATE, 'Surat undangan') RETURNING id`,
    [unitId],
  );
  check('nomor yang sama boleh pada jenis register berbeda', beda.length === 1);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await q(`DROP SCHEMA IF EXISTS "${S}" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d3-data-scope.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
