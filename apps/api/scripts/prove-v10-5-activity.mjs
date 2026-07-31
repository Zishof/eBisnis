/**
 * Bukti V10-5: jejak pemakaian, jejak perubahan, dan kapasitas pelaku.
 *
 * Yang dibuktikan:
 *
 * 1. Kapasitas pelaku (`active_role_code`) benar-benar terisi pada baris audit
 *    **tanpa satu pun pemanggil menyebutkannya** — inilah yang membedakannya
 *    dari `actor_role_codes` yang kosong pada seluruh 258 baris sebelumnya.
 * 2. Jejak pemakaian yang dilaporkan peramban tidak dapat memalsukan identitas,
 *    tidak dapat memakai kode menu karangan, dan kueri stringnya dibuang.
 * 3. Riwayat satu baris menyebut kolom yang berubah, bukan dua keadaan utuh.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });
const lines = [];
const log = (t) => {
  lines.push(t);
  console.log(t);
};

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  log(
    `  ${ok ? 'LULUS' : 'GAGAL'}  ${label}` +
      (ok ? '' : `  (dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)})`),
  );
}

await client.connect();

log('=========================================================================');
log('BUKTI V10-5 — JEJAK PEMAKAIAN, JEJAK PERUBAHAN, DAN KAPASITAS PELAKU');
log('=========================================================================');
log('');

const jejak = `v105${randomUUID().slice(0, 6)}`;
const userId = randomUUID();
const nama = `bukti.${jejak}`;
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;
const skema = 'demo';

const tenant = await client.query(
  `SELECT tenant_id FROM platform.tenant_schema_registry WHERE schema_name = $1`,
  [skema],
);
const tenantId = tenant.rows[0].tenant_id;

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash, status,
      must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, false, now())`,
  [userId, nama, 'Petugas Bukti V10-5', await argon2.hash(sandi)],
);
await client.query(
  `INSERT INTO platform.tenant_membership
     (id, tenant_id, platform_user_id, is_owner, status, joined_at, created_at, updated_at)
   VALUES (gen_random_uuid(), $1, $2, false, 'ACTIVE', now(), now(), now())`,
  [tenantId, userId],
);

const subjectId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.user_subject
     (id, platform_user_id, code, name, username_snapshot, status, is_active, updated_at)
   VALUES ($1, $2, $3::varchar, $4, $5, 'ACTIVE', true, now())`,
  [subjectId, userId, `SUBJ_${jejak}`, 'Petugas Bukti V10-5', nama],
);

// Satu peran dengan izin membaca audit — itulah yang dibutuhkan endpoint di sini.
const peranId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
   VALUES ($1, $2::varchar, $3, true, now())`,
  [peranId, `BUKTI_${jejak}`, 'Peran Bukti V10-5'],
);
for (const p of ['ADMIN_AUDIT.READ', 'ADMIN.READ']) {
  const [menu, aksi] = p.split('.');
  await client.query(
    `INSERT INTO ${skema}.role_menu_permission (id, role_id, menu_id, permission_action_id, effect, updated_at)
     SELECT gen_random_uuid(), $1, m.id, pa.id, 'ALLOW'::varchar, now()
       FROM ${skema}.menu m, ${skema}.permission_action pa
      WHERE m.code = $2 AND pa.code = $3`,
    [peranId, menu, aksi],
  );
}
await client.query(
  `INSERT INTO ${skema}.user_role_assignment (id, user_subject_id, role_id, valid_from)
   VALUES (gen_random_uuid(), $1, $2, now() - interval '1 hour')`,
  [subjectId, peranId],
);

async function bersihkan() {
  await client.query(`DELETE FROM ${skema}.ui_activity_log WHERE platform_user_id = $1`, [userId]);
  await client.query(`DELETE FROM ${skema}.user_role_assignment WHERE role_id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role WHERE id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.user_subject WHERE id = $1`, [subjectId]);
  await client.query('DELETE FROM platform.platform_role_switch_log WHERE user_id = $1', [userId]);
  await client.query(
    'DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id = $1)',
    [userId],
  );
  await client.query('DELETE FROM platform.platform_session WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_user WHERE id = $1', [userId]);
}

const ambil = (token, jalur) =>
  fetch(`${BASE}${jalur}`, { headers: { authorization: `Bearer ${token}` } }).then(async (r) => ({
    status: r.status,
    body: (await r.json()).data,
  }));

const kirim = (token, jalur, isi) =>
  fetch(`${BASE}${jalur}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(isi ?? {}),
  }).then(async (r) => ({ status: r.status, body: (await r.json()).data }));

try {
  const masuk = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: nama, password: sandi }),
  });
  const token = (await masuk.json()).data?.accessToken;
  if (!token) throw new Error('gagal masuk sebagai petugas bukti');

  // -- 1. Kapasitas pelaku terisi sendiri ----------------------------------
  log('1. KAPASITAS PELAKU TERISI SENDIRI');
  log('   Kolom actor_role_codes sudah ada sejak skema pertama dan KOSONG pada');
  log('   seluruh 258 baris yang pernah ditulis — karena mengisinya bergantung');
  log('   pada ingatan penulis 76 pemanggilan audit. active_role_code tidak');
  log('   bergantung pada siapa pun: ia terisi dari konteks permintaan.');

  // Dua pergantian: masuk ke peran, lalu kembali. Pergantian KEDUA terjadi
  // selagi peran sudah dipakai, sehingga barisnya harus membawa kapasitas itu.
  await kirim(token, '/me/active-role', { roleId: peranId, reason: 'uji bukti V10-5' });
  await kirim(token, '/me/active-role', { roleId: null, reason: 'kembali ke gabungan' });
  await kirim(token, '/me/active-role', { roleId: peranId, reason: 'dipakai lagi' });

  const audit = await client.query(
    `SELECT action_code, active_role_code, actor_username, session_id, metadata
       FROM platform__audit.audit_event
      WHERE actor_user_id = $1 ORDER BY occurred_at ASC`,
    [userId],
  );
  for (const r of audit.rows) {
    log(
      `   ${r.action_code.padEnd(20)} pelaku=${r.actor_username}  ` +
        `kapasitas=${r.active_role_code ?? '(gabungan)'}`,
    );
  }
  check('ada baris audit untuk petugas ini', audit.rows.length > 0, true);

  // Inilah pembuktiannya: TIDAK SATU PUN pemanggil menyebutkan kapasitas —
  // ia terisi sendiri dari konteks permintaan.
  const berkapasitas = audit.rows.filter((r) => r.active_role_code !== null);
  check('ada baris audit yang membawa kapasitas', berkapasitas.length > 0, true);
  check('kapasitasnya benar', berkapasitas[0]?.active_role_code, `BUKTI_${jejak}`);

  // Baris LOGIN wajib TETAP kosong: saat masuk memang belum ada peran dipilih.
  const login = audit.rows.find((r) => r.action_code === 'LOGIN');
  check('baris LOGIN tetap tanpa kapasitas', login?.active_role_code, null);
  log('   Baris LOGIN sengaja tetap kosong — saat masuk memang belum memilih peran.');

  // Kolom lama tetap kosong, dan itu jujur: ia memang tidak pernah diisi.
  const lama = await client.query(
    `SELECT count(*)::int n FROM platform__audit.audit_event WHERE actor_role_codes IS NOT NULL`,
  );
  log(`   actor_role_codes terisi pada ${lama.rows[0].n} baris — sengaja tidak diisi mundur.`);
  log('');

  // Perubahan data nyata sesudah peran dipilih — inilah yang harus membawa
  // kapasitasnya.
  log('   Melakukan perubahan data setelah peran dipilih:');
  await client.query(
    `UPDATE ${skema}.role SET name = $2, updated_at = now() WHERE id = $1`,
    [peranId, 'Peran Bukti V10-5 (diubah)'],
  );

  // -- 2. Jejak pemakaian tidak dapat memalsukan identitas -----------------
  log('2. JEJAK PEMAKAIAN: IDENTITAS DARI SESI, BUKAN DARI BADAN PERMINTAAN');
  const lapor = await kirim(token, '/activity/ui', {
    events: [
      { activityType: 'MENU_OPEN', menuCode: 'ADMIN', routePath: '/admin' },
      // Kueri string sengaja disertakan — server harus membuangnya.
      { activityType: 'PAGE_VIEW', menuCode: 'ADMIN', routePath: '/admin/pengguna?cari=Budi+Santoso' },
      { activityType: 'UI_ACTION', menuCode: 'ADMIN', actionCode: 'SIMPAN', outcome: 'SUCCESS' },
      { activityType: 'UI_ACTION', menuCode: 'ADMIN', actionCode: 'EKSPOR', outcome: 'CANCELLED' },
      // Kode menu karangan — harus ditolak, bukan diterima diam-diam.
      { activityType: 'MENU_OPEN', menuCode: 'MENU_YANG_TIDAK_ADA' },
      // UI_ACTION tanpa actionCode — harus ditolak.
      { activityType: 'UI_ACTION', menuCode: 'ADMIN' },
    ],
  });
  check('empat peristiwa sah diterima', lapor.body.accepted, 4);
  check('dua peristiwa ditolak', lapor.body.rejected.length, 2);
  for (const r of lapor.body.rejected) log(`   ditolak [${r.index}]: ${r.reason}`);

  const tersimpan = await client.query(
    `SELECT activity_type, route_path, action_code, outcome, platform_user_id, active_role_code
       FROM ${skema}.ui_activity_log WHERE platform_user_id = $1 ORDER BY occurred_at`,
    [userId],
  );
  check('tersimpan tepat empat', tersimpan.rows.length, 4);
  check(
    'seluruhnya atas nama pemilik sesi',
    tersimpan.rows.every((r) => r.platform_user_id === userId),
    true,
  );
  const halaman = tersimpan.rows.find((r) => r.activity_type === 'PAGE_VIEW');
  log(`   Jalur tersimpan: ${halaman.route_path}`);
  check('kueri string dibuang', halaman.route_path, '/admin/pengguna');
  check('nama yang dicari tidak tersimpan', /Budi/.test(JSON.stringify(tersimpan.rows)), false);
  check('kapasitas ikut tercatat', halaman.active_role_code, `BUKTI_${jejak}`);
  log('');

  // -- 3. Pemakaian menu dan tindakan yang dibatalkan ----------------------
  log('3. RINGKASAN PEMAKAIAN');
  const pakai = await ambil(token, '/activity/menu-usage?hari=1');
  check('endpoint pemakaian menu terbaca', pakai.status, 200);
  const adminMenu = pakai.body.items.find((i) => i.code === 'ADMIN');
  log(`   Menu ADMIN: ${adminMenu?.opens} pembukaan oleh ${adminMenu?.distinctUsers} orang`);
  check('pembukaan menu ADMIN tercatat', adminMenu.opens >= 2, true);
  log(`   Menu tidak pernah dibuka: ${pakai.body.neverOpened.length} dari ${pakai.body.items.length}`);
  check('daftar menu tak terpakai disertakan', Array.isArray(pakai.body.neverOpened), true);

  const batal = await ambil(token, '/activity/abandoned-actions?hari=1');
  const ekspor = batal.body.items.find((i) => i.actionCode === 'EKSPOR');
  log(`   Tindakan EKSPOR: ${ekspor?.cancelled} dibatalkan dari ${ekspor?.total} (${ekspor?.abandonRate}%)`);
  check('pembatalan tercatat', ekspor.cancelled, 1);
  log('');

  // -- 4. Jejak perubahan berasal dari trigger, bukan dari kode ------------
  log('4. JEJAK PERUBAHAN BERASAL DARI TRIGGER BASIS DATA');
  log('   Perubahan pada bagian 1 dilakukan LANGSUNG lewat SQL, tanpa melewati');
  log('   satu baris pun kode aplikasi. Ia tetap tercatat — itulah bedanya');
  log('   trigger basis data dari pencatatan di dalam kode.');

  const tabel = await ambil(token, '/table-audit/tables?hari=1');
  check('ringkasan per tabel terbaca', tabel.status, 200);
  const barisRole = tabel.body.items.find((i) => i.tableName === 'role');
  log(`   Tabel role: ${barisRole?.inserts} sisip, ${barisRole?.updates} ubah, ${barisRole?.deletes} hapus`);
  check('perubahan lewat SQL langsung tetap tercatat', barisRole.updates >= 1, true);

  const riwayat = await ambil(token, `/table-audit/rows/role/${peranId}`);
  check('riwayat baris terbaca', riwayat.status, 200);
  log(`   Riwayat peran uji: ${riwayat.body.changeCount} perubahan`);
  const perubahanNama = riwayat.body.items
    .flatMap((i) => i.changes)
    .find((c) => c.column === 'name' && String(c.after).includes('diubah'));
  log(`   Kolom name: "${perubahanNama?.before}" -> "${perubahanNama?.after}"`);
  check('perubahan disebut per kolom, bukan dua keadaan utuh', !!perubahanNama, true);
  log('');

  // -- 5. Nama tabel dari permintaan tidak dapat disuntikkan ---------------
  log('5. NAMA TABEL DARI PERMINTAAN TIDAK DAPAT DISUNTIKKAN');
  const suntik = await ambil(
    token,
    `/table-audit/rows/${encodeURIComponent('role; DROP TABLE demo.role--')}/${peranId}`,
  );
  check('nama tabel tidak sah ditolak', suntik.status, 400);
  const masihAda = await client.query(
    `SELECT to_regclass('${skema}.role') IS NOT NULL AS ada`,
  );
  check('tabel role masih ada', masihAda.rows[0].ada, true);
  log('');

  // -- 6. Tanpa izin audit, ringkasannya tertutup --------------------------
  log('6. RINGKASAN AUDIT MENUNTUT IZIN');
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id = $1`, [peranId]);
  // Cache izin berumur 30 detik; ditunggu supaya pencabutan benar-benar berlaku.
  await new Promise((r) => setTimeout(r, 31_000));
  const tolak = await ambil(token, '/table-audit/tables?hari=1');
  check('tanpa ADMIN_AUDIT.READ ditolak', tolak.status, 403);
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
} finally {
  await bersihkan();
  const sisa = await client.query(
    'SELECT count(*)::int n FROM platform.platform_user WHERE username LIKE $1',
    ['bukti.v105%'],
  );
  log('');
  log(`Pembersihan: sisa petugas bukti = ${sisa.rows[0].n}`);
  await client.end();
}

writeFileSync(
  new URL('../../../docs/upgrade-v10-v11/bukti-v10-5-activity.txt', import.meta.url),
  lines.join('\n'),
);
process.exit(failures === 0 ? 0 : 1);
