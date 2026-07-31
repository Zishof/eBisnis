/**
 * Bukti V10-3: PerformanceLog.
 *
 * Dijalankan terhadap API yang benar-benar berjalan. Yang dibuktikan bukan
 * bahwa tabelnya ada, melainkan bahwa angkanya benar-benar berasal dari lalu
 * lintas nyata, bahwa rute dengan id berbeda tetap menjadi satu templat, dan
 * bahwa yang tidak terukur dilaporkan tidak terukur — bukan dikarang.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (kunci) => env.match(new RegExp(`^${kunci}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const DATABASE_URL = bacaEnv('DATABASE_URL');

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
log('BUKTI V10-3 — PERFORMANCELOG');
log('=========================================================================');
log('');

// -- 0. Petugas sementara ---------------------------------------------------
/*
 * Bukti ini TIDAK memakai akun super admin bawaan.
 *
 * Akun bawaan wajib mengganti kata sandi sebelum dapat membuka apa pun — itu
 * penjagaan yang benar, dan sebuah skrip bukti tidak berhak melumpuhkannya
 * ataupun mengganti kata sandi milik orang lain. Karena itu bukti ini membuat
 * petugas sementara, memakainya, lalu menghapusnya kembali. Kata sandinya
 * dibangkitkan acak dan tidak pernah tersimpan di mana pun.
 */
const argon2 = await import('argon2');
const { randomUUID, randomBytes } = await import('node:crypto');

const petugasId = randomUUID();
const petugasNama = `bukti.v10.3.${petugasId.slice(0, 8)}`;
const petugasSandi = `${randomBytes(24).toString('base64url')}#Aa1`;

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash,
      status, must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, true, now())`,
  [petugasId, petugasNama, 'Petugas Bukti V10-3', await argon2.hash(petugasSandi)],
);
await client.query(
  `INSERT INTO platform.platform_user_role (id, user_id, role_id)
   SELECT gen_random_uuid(), $1, id FROM platform.platform_role
    WHERE code = 'PLATFORM_SUPER_ADMIN'`,
  [petugasId],
);

/** Menghapus petugas sementara — dipanggil pada jalur sukses maupun gagal. */
async function bersihkan() {
  await client.query('DELETE FROM platform.platform_user_role WHERE user_id = $1', [petugasId]);
  await client.query('DELETE FROM platform.platform_user WHERE id = $1', [petugasId]);
}

const masuk = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: petugasNama, password: petugasSandi }),
});
// Setiap respons dibungkus `{ success, data }`; token ada di dalamnya.
const sesi = await masuk.json();
const token = sesi.data?.accessToken;
if (!token) {
  log(`GAGAL masuk sebagai petugas bukti: ${masuk.status} ${JSON.stringify(sesi).slice(0, 200)}`);
  await bersihkan();
  await client.end();
  process.exit(1);
}
const berwenang = { authorization: `Bearer ${token}` };
log(`Petugas sementara ${petugasNama} dibuat dan masuk — akan dihapus di akhir.`);
log('');

// -- 1. Rute dengan id berbeda tetap satu templat ---------------------------
log('1. NORMALISASI RUTE');
log('   Tiga permintaan ke id berbeda harus menjadi SATU baris agregat, bukan tiga.');
log('   Rute yang tidak dinormalkan membuat setiap id terlihat sebagai rute');
log('   tersendiri, dan persentil kehilangan artinya.');

for (const id of ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333']) {
  await fetch(`${BASE}/platform/observability/errors/groups/${id}`, { headers: berwenang });
}

const tulis = await fetch(`${BASE}/platform/observability/performance/flush`, {
  method: 'POST',
  headers: berwenang,
});
const hasilTulis = (await tulis.json()).data;
log(`   ${hasilTulis.written} agregat rute ditulis.`);

const templat = await client.query(`
  SELECT route_template, http_method, sum(request_count)::int AS jumlah
    FROM platform_observability.performance_route_aggregate
   WHERE route_template ILIKE '%observability/errors/groups%'
   GROUP BY route_template, http_method`);

check(
  'tiga id berbeda menjadi satu templat',
  templat.rows.filter((r) => r.http_method === 'GET' && r.route_template.includes(':')).length,
  1,
);
const barisTemplat = templat.rows.find((r) => r.route_template.includes(':'));
log(`   Templat: ${barisTemplat?.http_method} ${barisTemplat?.route_template} — ${barisTemplat?.jumlah} permintaan`);
check('id tidak tersimpan pada templat', /1111|2222|3333/.test(barisTemplat?.route_template ?? ''), false);
log('');

// -- 2. Persentil berasal dari durasi nyata ---------------------------------
log('2. PERSENTIL BERASAL DARI PENGUKURAN');
log('   p50 <= p95 <= p99 <= max adalah sifat yang harus selalu berlaku. Jika');
log('   dilanggar, angkanya bukan persentil — melainkan angka yang kebetulan ada.');

const persentil = await client.query(`
  SELECT route_template, http_method, request_count,
         duration_p50, duration_p90, duration_p95, duration_p99, duration_max
    FROM platform_observability.performance_route_aggregate
   ORDER BY request_count DESC LIMIT 10`);

let urutanBenar = true;
for (const r of persentil.rows) {
  if (!(r.duration_p50 <= r.duration_p90 && r.duration_p90 <= r.duration_p95 &&
        r.duration_p95 <= r.duration_p99 && r.duration_p99 <= r.duration_max)) {
    urutanBenar = false;
    log(`   URUTAN SALAH pada ${r.http_method} ${r.route_template}`);
  }
}
check('urutan p50 <= p90 <= p95 <= p99 <= max pada semua rute', urutanBenar, true);
for (const r of persentil.rows.slice(0, 5)) {
  log(`   ${r.http_method} ${r.route_template}: n=${r.request_count} p50=${r.duration_p50}ms p95=${r.duration_p95}ms max=${r.duration_max}ms`);
}

// Endpoint pembacaannya sendiri harus mengurutkan menurut p95, bukan rata-rata.
// Rata-rata menyembunyikan ekor yang justru dirasakan pengguna.
const rute = await fetch(`${BASE}/platform/observability/performance/routes?jam=24`, { headers: berwenang });
const hasilRute = (await rute.json()).data;
log(`   Endpoint /routes mengembalikan ${hasilRute.items.length} rute.`);
const p95 = hasilRute.items.map((i) => i.durationP95);
check('urut menurun menurut p95', p95.every((v, i) => i === 0 || p95[i - 1] >= v), true);
const teratas = hasilRute.items[0];
log(`   Terlambat: ${teratas?.httpMethod} ${teratas?.routeTemplate} p95=${teratas?.durationP95}ms (n=${teratas?.requestCount})`);
log('');

// -- 3. Cuplikan proses benar-benar terambil --------------------------------
log('3. CUPLIKAN PROSES');
const cuplikan = await client.query(`
  SELECT count(*)::int n,
         min(captured_at) AS awal, max(captured_at) AS akhir,
         min(heap_used) AS heap_min, max(heap_used) AS heap_max,
         max(active_handles) AS pegangan
    FROM platform_observability.performance_snapshot`);
const c = cuplikan.rows[0];
log(`   ${c.n} cuplikan antara ${c.awal?.toISOString?.() ?? c.awal} dan ${c.akhir?.toISOString?.() ?? c.akhir}`);
log(`   heapUsed ${Math.round(Number(c.heap_min) / 1048576)} MB → ${Math.round(Number(c.heap_max) / 1048576)} MB, pegangan aktif puncak ${c.pegangan}`);
check('cuplikan terambil', c.n > 0, true);
check('heapUsed bukan nol', Number(c.heap_max) > 0, true);
log('');

// -- 4. Kesimpulan kebocoran menahan diri saat bukti kurang -----------------
log('4. ANALISIS KEBOCORAN MENAHAN DIRI');
log('   Satu grafik RAM yang naik bukan bukti kebocoran. Dengan sampel sedikit,');
log('   jawaban yang benar adalah "bukti belum cukup" — bukan tebakan.');

const memori = await fetch(`${BASE}/platform/observability/performance/memory?jam=6`, { headers: berwenang });
const hasilMemori = (await memori.json()).data;
log(`   Sampel: ${hasilMemori.sampleCount}, putusan: ${hasilMemori.memory.verdict}`);
log(`   Alasan: ${hasilMemori.memory.reason}`);
if (hasilMemori.sampleCount < 12) {
  check('sampel sedikit menghasilkan INSUFFICIENT_EVIDENCE', hasilMemori.memory.verdict, 'INSUFFICIENT_EVIDENCE');
} else {
  check('putusan termasuk nilai yang dikenal',
    ['NORMAL', 'SUSPICIOUS', 'REPRODUCED', 'TEMPORARY_SPIKE', 'INSUFFICIENT_EVIDENCE'].includes(hasilMemori.memory.verdict),
    true);
}
check('bukti angka disertakan, bukan hanya kesimpulan', typeof hasilMemori.memory.evidence, 'object');
log('');

// -- 5. Yang tidak terukur dilaporkan tidak terukur -------------------------
log('5. STATISTIK KUERI JUJUR SAAT EKSTENSI TIDAK ADA');
const kueri = await fetch(`${BASE}/platform/observability/performance/queries`, { headers: berwenang });
const hasilKueri = (await kueri.json()).data;
log(`   Status: ${hasilKueri.status}`);
log(`   Catatan: ${hasilKueri.note}`);
check('status termasuk nilai yang dikenal',
  ['AVAILABLE', 'EXTENSION_MISSING', 'NOT_PERMITTED', 'ERROR'].includes(hasilKueri.status), true);
if (hasilKueri.status !== 'AVAILABLE') {
  check('tidak ada baris dikarang saat tidak tersedia', hasilKueri.rows.length, 0);
  check('catatan menjelaskan cara mengaktifkan', /shared_preload_libraries|pg_read_all_stats/.test(hasilKueri.note), true);
}
log('');

// -- 6. Administrator tenant tidak boleh membacanya -------------------------
log('6. MASUK SAJA TIDAK CUKUP — IZINNYA YANG MENENTUKAN');
log('   Yang dibuktikan bukan hanya bahwa tanpa token ditolak, melainkan bahwa');
log('   petugas platform yang sudah masuk pun tetap ditolak bila tidak memegang');
log('   PLATFORM.OBSERVABILITY.*. Observability memuat jejak seluruh tenant.');

const tanpaToken = await fetch(`${BASE}/platform/observability/performance/routes`);
check('tanpa token ditolak', tanpaToken.status, 401);

// Petugas kedua, sengaja diberi peran yang tidak memegang izin observability.
const lainId = randomUUID();
const lainNama = `bukti.v10.3.${lainId.slice(0, 8)}`;
const lainSandi = `${randomBytes(24).toString('base64url')}#Aa1`;
await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash,
      status, must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, true, now())`,
  [lainId, lainNama, 'Petugas Tanpa Izin Observability', await argon2.hash(lainSandi)],
);
await client.query(
  `INSERT INTO platform.platform_user_role (id, user_id, role_id)
   SELECT gen_random_uuid(), $1, id FROM platform.platform_role
    WHERE code = 'PLATFORM_CONTENT_EDITOR'`,
  [lainId],
);

const masukLain = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username: lainNama, password: lainSandi }),
});
const tokenLain = (await masukLain.json()).data?.accessToken;
check('petugas tanpa izin tetap dapat masuk', !!tokenLain, true);

for (const jalur of ['routes', 'memory', 'queries']) {
  const tolak = await fetch(`${BASE}/platform/observability/performance/${jalur}`, {
    headers: { authorization: `Bearer ${tokenLain}` },
  });
  check(`GET /performance/${jalur} ditolak untuk petugas tanpa izin`, tolak.status, 403);
}
const tolakTulis = await fetch(`${BASE}/platform/observability/performance/flush`, {
  method: 'POST',
  headers: { authorization: `Bearer ${tokenLain}` },
});
check('POST /performance/flush ditolak untuk petugas tanpa izin', tolakTulis.status, 403);

await client.query('DELETE FROM platform.platform_user_role WHERE user_id = $1', [lainId]);
await client.query('DELETE FROM platform.platform_user WHERE id = $1', [lainId]);
log('');

// -- 7. Pembacaan tercatat --------------------------------------------------
log('7. SETIAP PEMBACAAN TERCATAT');
const akses = await client.query(`
  SELECT subject_type, count(*)::int n
    FROM platform_observability.observability_access_log
   WHERE subject_type IN ('RoutePerformance', 'MemoryAnalysis')
   GROUP BY subject_type ORDER BY subject_type`);
for (const r of akses.rows) log(`   ${r.subject_type}: ${r.n} pembacaan tercatat`);
check('pembacaan analisis memori tercatat', akses.rows.some((r) => r.subject_type === 'MemoryAnalysis'), true);
log('');

// -- 8. Tidak ada rahasia yang lolos ke agregat -----------------------------
log('8. TIDAK ADA RAHASIA PADA AGREGAT');
await fetch(`${BASE}/platform/observability/performance/routes?password=rahasia123&token=abc`, { headers: berwenang });
await fetch(`${BASE}/platform/observability/performance/flush`, { method: 'POST', headers: berwenang });
const bocor = await client.query(`
  SELECT count(*)::int n FROM platform_observability.performance_route_aggregate
   WHERE route_template ILIKE '%rahasia123%' OR route_template ILIKE '%password%'
      OR route_template ILIKE '%token=%'`);
check('kueri string tidak ikut tersimpan pada templat rute', bocor.rows[0].n, 0);
log('   Templat rute hanya memuat jalur; kueri string tidak pernah masuk.');
log('');

// -- 9. Petugas sementara dihapus kembali -----------------------------------
await bersihkan();
const sisa = await client.query(
  'SELECT count(*)::int n FROM platform.platform_user WHERE username LIKE $1',
  ['bukti.v10.3.%'],
);
log('9. PEMBERSIHAN');
check('petugas sementara terhapus', sisa.rows[0].n, 0);
log('');

log('=========================================================================');
log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
log('=========================================================================');

await client.end();
writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v10-3-performance.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
