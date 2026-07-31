/**
 * Bukti V10-4: sesi, perangkat, dan peran aktif.
 *
 * Dijalankan terhadap API yang benar-benar berjalan. Yang dibuktikan bukan
 * bahwa kolomnya ada, melainkan bahwa aturannya berlaku: memilih peran benar-
 * benar MEMBATASI dan tidak pernah menambah, penjaganya ikut menyempit (bukan
 * hanya tampilannya), pergantian berlaku seketika tanpa token baru, dan sesi
 * orang lain tidak dapat disentuh.
 *
 * Petugas dan peran uji dibuat oleh skrip ini lalu dihapus kembali.
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
log('BUKTI V10-4 — SESI, PERANGKAT, DAN PERAN AKTIF');
log('=========================================================================');
log('');

// -- 0. Menyiapkan pengguna dua peran ---------------------------------------
/*
 * Fitur ini hanya berarti bagi pengguna yang memegang lebih dari satu peran,
 * dan pada basis data pengembangan tidak ada satu pun. Karena itu buktinya
 * membuat sendiri: dua peran dengan izin yang sengaja berbeda, satu pengguna
 * yang memegang keduanya. Semuanya dihapus kembali pada bagian akhir.
 */
const jejak = `v104${randomUUID().slice(0, 6)}`;
const userId = randomUUID();
const nama = `bukti.${jejak}`;
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;

const tenant = await client.query(
  `SELECT tenant_id, schema_name FROM platform.tenant_schema_registry WHERE schema_name = 'demo'`,
);
const { tenant_id: tenantId, schema_name: skema } = tenant.rows[0];

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash, status,
      must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, false, now())`,
  [userId, nama, 'Petugas Bukti V10-4', await argon2.hash(sandi)],
);
// Keanggotaan tenant — dari situlah sesi memperoleh skemanya.
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
  [subjectId, userId, `SUBJ_${jejak}`, 'Petugas Bukti V10-4', nama],
);

/**
 * Membuat peran dengan izin tertentu.
 *
 * `denied` dipakai membuktikan celah yang paling penting: peran yang MELARANG
 * sesuatu yang peran lain izinkan.
 */
async function buatPeran(kode, izin, ditolak = []) {
  const id = randomUUID();
  await client.query(
    `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
     VALUES ($1, $2::varchar, $3, true, now())`,
    [id, kode, `Peran Bukti ${kode}`],
  );
  for (const [daftar, effect] of [
    [izin, 'ALLOW'],
    [ditolak, 'DENY'],
  ]) {
    for (const p of daftar) {
      const [menu, aksi] = p.split('.');
      await client.query(
        `INSERT INTO ${skema}.role_menu_permission (id, role_id, menu_id, permission_action_id, effect, updated_at)
         SELECT gen_random_uuid(), $1, m.id, pa.id, $2::varchar, now()
           FROM ${skema}.menu m, ${skema}.permission_action pa
          WHERE m.code = $3 AND pa.code = $4`,
        [id, effect, menu, aksi],
      );
    }
  }
  await client.query(
    `INSERT INTO ${skema}.user_role_assignment (id, user_subject_id, role_id, valid_from)
     VALUES (gen_random_uuid(), $1, $2, now() - interval '1 hour')`,
    [subjectId, id],
  );
  return id;
}

// Peran A boleh membaca dan membuat pembelian, TETAPI melarang persetujuan kas.
// Peran B boleh membaca dan menyetujui kas.
const menuA = (
  await client.query(
    `SELECT code FROM ${skema}.menu WHERE deleted_at IS NULL AND is_active = TRUE ORDER BY code LIMIT 2`,
  )
).rows.map((r) => r.code);
const [MENU_1, MENU_2] = menuA;

const peranA = await buatPeran(`BUKTI_A_${jejak}`, [`${MENU_1}.READ`, `${MENU_1}.CREATE`], [
  `${MENU_2}.APPROVE`,
]);
const peranB = await buatPeran(`BUKTI_B_${jejak}`, [
  `${MENU_2}.READ`,
  `${MENU_2}.APPROVE`,
]);

log(`Menyiapkan pengguna ${nama} dengan dua peran pada skema ${skema}:`);
log(`  Peran A mengizinkan ${MENU_1}.READ, ${MENU_1}.CREATE dan MELARANG ${MENU_2}.APPROVE`);
log(`  Peran B mengizinkan ${MENU_2}.READ, ${MENU_2}.APPROVE`);
log('');

async function bersihkan() {
  await client.query(
    `DELETE FROM ${skema}.user_role_assignment WHERE role_id IN ($1, $2)`,
    [peranA, peranB],
  );
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id IN ($1, $2)`, [
    peranA,
    peranB,
  ]);
  await client.query(`DELETE FROM ${skema}.role WHERE id IN ($1, $2)`, [peranA, peranB]);
  await client.query(`DELETE FROM ${skema}.user_subject WHERE id = $1`, [subjectId]);
  await client.query('DELETE FROM platform.platform_role_switch_log WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id = $1)', [userId]);
  await client.query('DELETE FROM platform.platform_session WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_user WHERE id = $1', [userId]);
}

async function masuk(userAgent) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': userAgent },
    body: JSON.stringify({ username: nama, password: sandi }),
  });
  const body = await r.json();
  return body.data?.accessToken;
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
  const CHROME =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  const IPHONE =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';

  const token = await masuk(CHROME);
  if (!token) throw new Error('gagal masuk sebagai petugas bukti');

  // -- 1. Perangkat dikenali, user agent mentah tidak menjadi sidik ---------
  log('1. PERANGKAT DIKENALI TANPA MENYIMPAN SIDIK MENTAH');
  const sesiDb = await client.query(
    'SELECT device_label, device_fingerprint, user_agent FROM platform.platform_session WHERE user_id = $1',
    [userId],
  );
  const s0 = sesiDb.rows[0];
  log(`   Label: ${s0.device_label}`);
  check('label perangkat terbaca manusia', s0.device_label, 'Chrome di Windows');
  check('sidik bukan user agent mentah', s0.device_fingerprint === s0.user_agent, false);
  check('sidik berupa hash heksadesimal', /^[0-9a-f]{32}$/.test(s0.device_fingerprint), true);
  log('');

  // -- 2. Belum memilih peran berarti tidak ada perubahan -------------------
  log('2. BELUM MEMILIH BERARTI TIDAK ADA YANG BERUBAH');
  log('   Menebakkan satu peran saat masuk akan mengejutkan pengguna yang selama');
  log('   ini memakai gabungan seluruh perannya. Pemilihan harus disengaja.');
  const peranAwal = await ambil(token, '/me/roles');
  check('tidak ada peran aktif saat baru masuk', peranAwal.body.activeRoleId, null);
  check('dua peran terbaca', peranAwal.body.items.length, 2);
  check('penyempitan ditawarkan karena perannya lebih dari satu', peranAwal.body.canNarrow, true);
  const izinPenuh = peranAwal.body.permissionCountFull;
  check(
    'izin efektif sama dengan izin penuh sebelum memilih',
    peranAwal.body.permissionCountEffective,
    izinPenuh,
  );
  log(`   Izin penuh: ${izinPenuh}`);
  log('');

  // -- 3. Larangan peran lain tetap berlaku --------------------------------
  log('3. LARANGAN PERAN LAIN TETAP BERLAKU — MEMILIH TIDAK PERNAH MENAMBAH');
  log(`   Peran A melarang ${MENU_2}.APPROVE, peran B mengizinkannya. Gabungannya`);
  log('   menolak karena DENY menang. Bila penyempitan hanya melihat peran B,');
  log('   larangan peran A ikut hilang dan memilih peran justru MEMBERI izin.');

  const izinSebelum = await ambil(token, '/me/permissions');
  const punyaApprove = (b) => b.tenantPermissions.includes(`${MENU_2}.APPROVE`);
  check('gabungan menolak APPROVE karena DENY menang', punyaApprove(izinSebelum.body), false);

  const pilihB = await kirim(token, '/me/active-role', { roleId: peranB, reason: 'uji bukti' });
  check('peran B terpilih', pilihB.body.activeRoleCode, `BUKTI_B_${jejak}`);

  const izinSesudah = await ambil(token, '/me/permissions');
  check('APPROVE TETAP ditolak setelah menyempit ke peran B', punyaApprove(izinSesudah.body), false);
  log(`   Izin sebelum ${pilihB.body.permissionsBefore} -> sesudah ${pilihB.body.permissionsAfter}`);
  check(
    'menyempit mengurangi izin, tidak menambah',
    pilihB.body.permissionsAfter <= pilihB.body.permissionsBefore,
    true,
  );
  log('');

  // -- 4. Penjaganya ikut menyempit, bukan hanya tampilannya ---------------
  log('4. PENJAGANYA IKUT MENYEMPIT, BUKAN HANYA TAMPILANNYA');
  log('   Penyempitan yang hanya mengubah menu tetapi membiarkan penjaganya');
  log('   memakai gabungan seluruh peran adalah pembatasan yang tidak membatasi.');

  const pilihA = await kirim(token, '/me/active-role', { roleId: peranA });
  check('peran A terpilih', pilihA.body.activeRoleCode, `BUKTI_A_${jejak}`);

  const izinA = await ambil(token, '/me/permissions');
  const daftarA = izinA.body.tenantPermissions;
  check(`memegang ${MENU_1}.READ dari peran A`, daftarA.includes(`${MENU_1}.READ`), true);
  check(`TIDAK memegang ${MENU_2}.READ milik peran B`, daftarA.includes(`${MENU_2}.READ`), false);

  // Menu ikut menyempit — tombol yang pasti ditolak tidak boleh ditampilkan.
  const menuA2 = await ambil(token, '/me/menus');
  const kodeMenu = JSON.stringify(menuA2.body);
  check('menu milik peran B tidak muncul saat peran A dipakai', kodeMenu.includes(`"${MENU_2}"`), false);
  log('');

  // -- 5. Berlaku seketika tanpa token baru --------------------------------
  log('5. BERLAKU SEKETIKA — TOKEN LAMA LANGSUNG MENGIKUTI');
  log('   Peran aktif dibaca dari baris sesi, bukan dari klaim token. Bila ia');
  log('   disimpan di dalam token, pergantian baru berlaku setelah token');
  log('   berikutnya terbit — dan sepanjang jeda itu izin lama masih dipegang.');
  const kembali = await kirim(token, '/me/active-role', { roleId: null });
  check('kembali ke gabungan seluruh peran', kembali.body.activeRoleId, null);
  const izinKembali = await ambil(token, '/me/permissions');
  check(
    'token yang SAMA langsung melihat izin penuh lagi',
    izinKembali.body.tenantPermissions.length,
    izinPenuh,
  );
  log('   Token tidak diterbitkan ulang sama sekali sepanjang bagian ini.');
  log('');

  // -- 6. Peran yang tidak dipegang ditolak --------------------------------
  log('6. PERAN YANG TIDAK DIPEGANG DITOLAK');
  log('   Tanpa pemeriksaan ini, sesi dapat menyebut kapasitas yang tidak pernah');
  log('   dimiliki — dan jejak auditnya berbohong.');
  const asing = await kirim(token, '/me/active-role', {
    roleId: '00000000-0000-0000-0000-000000000000',
  });
  check('peran asing ditolak', asing.status, 403);
  log('');

  // -- 7. Riwayat pergantian tercatat --------------------------------------
  log('7. RIWAYAT PERGANTIAN TERCATAT');
  const riwayat = await client.query(
    `SELECT from_role_code, to_role_code, permissions_before, permissions_after, reason
       FROM platform.platform_role_switch_log WHERE user_id = $1 ORDER BY occurred_at`,
    [userId],
  );
  for (const r of riwayat.rows) {
    log(
      `   ${r.from_role_code ?? '(gabungan)'} -> ${r.to_role_code ?? '(gabungan)'}` +
        `  ${r.permissions_before} -> ${r.permissions_after} izin` +
        (r.reason ? `  alasan: ${r.reason}` : ''),
    );
  }
  check('tiga pergantian tercatat', riwayat.rows.length, 3);
  check('peran asing yang ditolak TIDAK tercatat sebagai pergantian',
    riwayat.rows.some((r) => r.to_role_code === null && r.permissions_before === 0), false);
  log('');

  // -- 8. Daftar sesi dan pencabutan ---------------------------------------
  log('8. DAFTAR SESI DAN PENCABUTAN');
  const token2 = await masuk(IPHONE);
  const daftar = await ambil(token, '/me/sessions');
  log(`   ${daftar.body.items.length} sesi: ${daftar.body.items.map((i) => i.deviceLabel).join(', ')}`);
  check('dua perangkat terlihat', daftar.body.items.length, 2);
  check('tepat satu ditandai sebagai sesi berjalan',
    daftar.body.items.filter((i) => i.isCurrent).length, 1);

  const lain = daftar.body.items.find((i) => !i.isCurrent);
  const cabut = await kirim(token, `/me/sessions/${lain.id}/revoke`, { reason: 'uji bukti' });
  check('sesi lain tercabut', cabut.body.revoked, 1);

  const setelahCabut = await ambil(token2, '/me/roles');
  check('token dari sesi yang tercabut langsung tidak berlaku', setelahCabut.status, 401);
  const masihJalan = await ambil(token, '/me/roles');
  check('sesi yang sedang dipakai tetap berjalan', masihJalan.status, 200);
  log('');

  // -- 9. Sesi orang lain tidak dapat disentuh -----------------------------
  log('9. SESI ORANG LAIN TIDAK DAPAT DISENTUH');
  const sesiOrangLain = await client.query(
    'SELECT id FROM platform.platform_session WHERE user_id <> $1 ORDER BY issued_at DESC LIMIT 1',
    [userId],
  );
  if (sesiOrangLain.rows.length) {
    const tolak = await kirim(token, `/me/sessions/${sesiOrangLain.rows[0].id}/revoke`, {});
    check('sesi milik orang lain dijawab 404, bukan 403', tolak.status, 404);
    log('   Dijawab sama seperti sesi yang tidak ada — membedakannya akan memberi');
    log('   tahu penebak bahwa suatu id memang dipakai orang.');
    const utuh = await client.query(
      'SELECT revoked_at FROM platform.platform_session WHERE id = $1',
      [sesiOrangLain.rows[0].id],
    );
    check('sesi orang lain tidak tersentuh', utuh.rows[0].revoked_at, null);
  } else {
    log('   (tidak ada sesi milik orang lain — bagian ini dilewati)');
  }
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
} finally {
  await bersihkan();
  const sisa = await client.query(
    'SELECT count(*)::int n FROM platform.platform_user WHERE username LIKE $1',
    ['bukti.v104%'],
  );
  log('');
  log(`Pembersihan: sisa petugas bukti = ${sisa.rows[0].n}`);
  await client.end();
}

writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v10-4-session.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
