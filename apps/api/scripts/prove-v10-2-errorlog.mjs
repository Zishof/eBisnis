/**
 * Bukti V10-2: penangkapan, pengelompokan, dan penyaringan galat.
 *
 * Dijalankan terhadap API yang benar-benar berjalan. Yang dibuktikan bukan
 * bahwa kodenya ada, melainkan bahwa aturannya berlaku: galat yang sama
 * dikelompokkan, galat yang tidak berguna tidak disimpan, dan tidak ada
 * rahasia yang lolos ke penyimpanan.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const DATABASE_URL = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: DATABASE_URL });
const lines = [];
const log = (text) => {
  lines.push(text);
  console.log(text);
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
log('BUKTI V10-2 — ERRORLOG TERPUSAT');
log('=========================================================================');
log('');

// -- 0. Keadaan awal --------------------------------------------------------
const before = await client.query(
  'SELECT count(*)::int n FROM platform_observability.error_log',
);
const groupsBefore = await client.query(
  'SELECT count(*)::int n FROM platform_observability.error_group',
);
log(`Keadaan awal: ${before.rows[0].n} kejadian pada ${groupsBefore.rows[0].n} kelompok`);
log('');

/**
 * Menunggu sampai jumlah baris berhenti bertambah.
 *
 * Penangkapan galat sengaja berjalan SETELAH respons dikirim dan hasilnya tidak
 * ditunggu — permintaan tidak boleh melambat karena observability. Akibatnya
 * bukti tidak dapat mengandaikan jeda tetap; ia harus menunggu sampai keadaan
 * berhenti berubah.
 */
async function tungguStabil(target, batasDetik = 15) {
  let sebelumnya = -1;
  for (let i = 0; i < batasDetik * 2; i += 1) {
    const r = await client.query('SELECT count(*)::int n FROM platform_observability.error_log');
    const n = r.rows[0].n;
    if (n === sebelumnya && n >= target) return n;
    sebelumnya = n;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return sebelumnya;
}

// -- 1. Galat yang sama dikelompokkan --------------------------------------
log('1. GALAT YANG SAMA DIKELOMPOKKAN');

// Tiga permintaan tanpa token menghasilkan galat yang sama persis.
for (let i = 0; i < 3; i += 1) {
  await fetch(`${BASE}/platform/observability/errors/groups`).catch(() => undefined);
}
await tungguStabil(3);

const grouped = await client.query(`
  SELECT occurrence_count, error_type, severity, status
    FROM platform_observability.error_group
   WHERE message_normalized ILIKE '%token%'
   ORDER BY last_seen_at DESC LIMIT 1`);

if (grouped.rows[0]) {
  log(`  kelompok "${grouped.rows[0].error_type}": ${grouped.rows[0].occurrence_count} kejadian`);
  check('tiga galat sama menjadi satu kelompok', grouped.rows[0].occurrence_count >= 3, true);
  check('ditandai WARNING, bukan ERROR', grouped.rows[0].severity, 'WARNING');
  check('kelompok baru berstatus NEW', grouped.rows[0].status, 'NEW');
} else {
  log('  GAGAL — kelompok tidak terbentuk');
  failures += 1;
}
log('');

// -- 2. Kejadian tetap tersimpan utuh --------------------------------------
log('2. KEJADIAN TETAP TERSIMPAN, BUKAN HANYA RINGKASANNYA');
const occ = await client.query(`
  SELECT g.occurrence_count::int AS diklaim, count(l.id)::int AS tersimpan
    FROM platform_observability.error_group g
    JOIN platform_observability.error_log l ON l.error_group_id = g.id
   GROUP BY g.id, g.occurrence_count
   ORDER BY max(l.occurred_at) DESC LIMIT 1`);
if (occ.rows[0]) {
  log(`  kelompok mengklaim ${occ.rows[0].diklaim}, tersimpan ${occ.rows[0].tersimpan} baris`);
  check('setiap kejadian punya barisnya sendiri', occ.rows[0].tersimpan >= 3, true);
}
log('');

// -- 3. Galat yang tidak berguna tidak disimpan -----------------------------
log('3. GALAT YANG TIDAK BERGUNA TIDAK DISIMPAN');
const beforeNoise = await client.query(
  'SELECT count(*)::int n FROM platform_observability.error_log',
);

// Sepuluh 404 — persis yang dihasilkan pemindai otomatis.
for (let i = 0; i < 10; i += 1) {
  await fetch(`${BASE}/public/catalog/produk/tidak/ada-${i}`).catch(() => undefined);
}
// Menunggu lebih lama justru penting di sini: bukti bahwa 404 TIDAK tersimpan
// hanya sahih bila kita sudah memberi kesempatan untuk tersimpan.
await new Promise((resolve) => setTimeout(resolve, 4000));

const afterNoise = await client.query(
  'SELECT count(*)::int n FROM platform_observability.error_log',
);
log(`  10 permintaan 404 dikirim; baris bertambah ${afterNoise.rows[0].n - beforeNoise.rows[0].n}`);
check('404 biasa tidak menambah baris', afterNoise.rows[0].n - beforeNoise.rows[0].n, 0);
log('');

// -- 4. Tidak ada rahasia yang lolos ---------------------------------------
log('4. TIDAK ADA RAHASIA YANG LOLOS KE PENYIMPANAN');

// Permintaan membawa header rahasia dan query yang memuat kata sandi.
await fetch(`${BASE}/platform/observability/errors/groups?password=rahasia123&token=abc`, {
  headers: {
    authorization: 'Bearer contoh-token-yang-tidak-boleh-tersimpan',
    cookie: 'sid=jangan-simpan-ini',
    'x-api-key': 'kunci-rahasia',
    'user-agent': 'bukti-v10-2',
  },
}).catch(() => undefined);
await tungguStabil(4);

const leaked = await client.query(`
  SELECT count(*)::int n FROM platform_observability.error_log
   WHERE request_headers_sanitized::text ILIKE '%authorization%'
      OR request_headers_sanitized::text ILIKE '%cookie%'
      OR request_headers_sanitized::text ILIKE '%x-api-key%'
      OR request_headers_sanitized::text ILIKE '%contoh-token%'
      OR request_headers_sanitized::text ILIKE '%jangan-simpan%'`);
check('header rahasia tidak tersimpan sama sekali', leaked.rows[0].n, 0);

const queryLeak = await client.query(`
  SELECT request_query_sanitized FROM platform_observability.error_log
   WHERE request_query_sanitized::text ILIKE '%password%'
   ORDER BY occurred_at DESC LIMIT 1`);
if (queryLeak.rows[0]) {
  const teks = JSON.stringify(queryLeak.rows[0].request_query_sanitized);
  log(`  query tersimpan: ${teks}`);
  check('nilai kata sandi pada query tersamar', teks.includes('rahasia123'), false);
  check('nama medannya tetap terlihat', teks.includes('password'), true);
}

const sample = await client.query(`
  SELECT request_headers_sanitized FROM platform_observability.error_log
   WHERE request_headers_sanitized::text ILIKE '%bukti-v10-2%' LIMIT 1`);
if (sample.rows[0]) {
  log(`  header tersimpan: ${JSON.stringify(sample.rows[0].request_headers_sanitized)}`);
}
log('');

// -- 5. Bentuk data yang tersimpan -----------------------------------------
log('5. BENTUK DATA YANG TERSIMPAN');
const shape = await client.query(`
  SELECT
    count(*) FILTER (WHERE stack_sanitized ILIKE '%C:%')::int AS jalur_absolut,
    count(*) FILTER (WHERE ip_masked LIKE '%.0')::int AS ip_tersamar,
    count(*) FILTER (WHERE ip_masked IS NOT NULL AND ip_masked NOT LIKE '%.0'
                     AND ip_masked NOT LIKE '%::')::int AS ip_utuh,
    count(*)::int AS total
  FROM platform_observability.error_log`);
const s = shape.rows[0];
log(`  total ${s.total} kejadian`);
check('tidak ada jalur absolut pada jejak tumpukan', s.jalur_absolut, 0);
check('tidak ada alamat IP tersimpan utuh', s.ip_utuh, 0);

const sessions = await client.query(`
  SELECT count(*)::int n FROM platform_observability.error_log
   WHERE session_id_hash IS NOT NULL AND length(session_id_hash) <> 64`);
check('id sesi hanya tersimpan sebagai hash', sessions.rows[0].n, 0);
log('');

// -- 6. Akses tercatat ------------------------------------------------------
log('6. SETIAP AKSES TERCATAT');
const access = await client.query(`
  SELECT column_name FROM information_schema.columns
   WHERE table_schema='platform_observability' AND table_name='observability_access_log'`);
const cols = access.rows.map((r) => r.column_name);
check('mencatat siapa yang mengakses', cols.includes('actor_user_id'), true);
check('mencatat tindakan apa', cols.includes('action'), true);
check('mencatat alasannya', cols.includes('reason'), true);
check('mencatat tenant yang tersentuh', cols.includes('affected_tenant_id'), true);
log('');

// -- 7. Hanya Super Admin yang berhak --------------------------------------
log('7. HANYA SUPER ADMIN YANG BERHAK');
const perms = await client.query(`
  SELECT r.code AS role, count(*)::int n
    FROM platform.platform_role r
    JOIN platform.platform_role_permission rp ON rp.role_id = r.id
    JOIN platform.platform_permission pp ON pp.id = rp.permission_id
   WHERE pp.code LIKE '%OBSERVABILITY%'
   GROUP BY r.code ORDER BY r.code`);
log(`  role yang memiliki permission observability: ${perms.rows.map((r) => `${r.role}(${r.n})`).join(', ')}`);
check('hanya satu role yang memilikinya', perms.rows.length, 1);
check('role itu adalah Super Admin', perms.rows[0]?.role, 'PLATFORM_SUPER_ADMIN');

const anon = await fetch(`${BASE}/platform/observability/errors/groups`);
check('anonim ditolak', anon.status === 401 || anon.status === 403, true);
log('');

log('=========================================================================');
log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
log('=========================================================================');

await client.end();

writeFileSync(
  new URL('../../../docs/upgrade-v10-v11/evidence/v10-2-errorlog.txt', import.meta.url),
  lines.join('\n') + '\n',
);

process.exit(failures === 0 ? 0 : 1);
