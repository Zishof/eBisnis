/**
 * Bukti V11-3b: pencarian semantik dan hibrida.
 *
 * Yang dibuktikan berbeda tergantung keadaan penyedia, dan ITU YANG DIUJI:
 *
 * * Bila belum ada model embedding — sistem harus tetap bekerja secara leksikal
 *   DAN mengatakan dengan tepat apa yang kurang beserta cara memperbaikinya.
 *   Yang paling penting: ia tidak boleh gagal diam-diam, dan tidak boleh
 *   menyarankan perbaikan yang salah.
 *
 * * Bila sudah ada — pencariannya menjadi hibrida, vektor tersimpan, dan
 *   potongan dari model lain tidak pernah tercampur.
 *
 * Skrip ini lulus pada KEDUA keadaan. Bukti yang hanya lulus pada keadaan
 * sempurna tidak membuktikan apa-apa tentang keadaan sebenarnya.
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
const log = (t) => { lines.push(t); console.log(t); };

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}` +
    (ok ? '' : `  (dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)})`));
}

await client.connect();
log('=========================================================================');
log('BUKTI V11-3b — PENCARIAN SEMANTIK DAN HIBRIDA');
log('=========================================================================');
log('');

const jejak = `v11b${randomUUID().slice(0, 6)}`;
const skema = 'demo';
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;
const userId = randomUUID();
const nama = `bukti.${jejak}`;

const tenantId = (await client.query(
  `SELECT tenant_id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [skema])).rows[0].tenant_id;

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash, status,
      must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, true, now())`,
  [userId, nama, 'Petugas Bukti V11b', await argon2.hash(sandi)]);
await client.query(
  `INSERT INTO platform.platform_user_role (id, user_id, role_id)
   SELECT gen_random_uuid(), $1, id FROM platform.platform_role WHERE code='PLATFORM_SUPER_ADMIN'`,
  [userId]);
await client.query(
  `INSERT INTO platform.tenant_membership
     (id, tenant_id, platform_user_id, is_owner, status, joined_at, created_at, updated_at)
   VALUES (gen_random_uuid(), $1, $2, false, 'ACTIVE', now(), now(), now())`, [tenantId, userId]);

const subjectId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.user_subject
     (id, platform_user_id, code, name, username_snapshot, status, is_active, updated_at)
   VALUES ($1, $2, $3::varchar, $4, $5, 'ACTIVE', true, now())`,
  [subjectId, userId, `SUBJ_${jejak}`, 'Petugas Bukti V11b', nama]);

const peranId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
   VALUES ($1, $2::varchar, $3, true, now())`, [peranId, `BUKTI_${jejak}`.toUpperCase(), 'Peran Bukti V11b']);
for (const p of ['SURAT_MASUK.READ', 'HOME_DASHBOARD.READ', 'REPORTING.READ']) {
  const [menu, aksi] = p.split('.');
  await client.query(
    `INSERT INTO ${skema}.role_menu_permission (id, role_id, menu_id, permission_action_id, effect, updated_at)
     SELECT gen_random_uuid(), $1, m.id, pa.id, 'ALLOW'::varchar, now()
       FROM ${skema}.menu m, ${skema}.permission_action pa WHERE m.code = $2 AND pa.code = $3`,
    [peranId, menu, aksi]);
}
await client.query(
  `INSERT INTO ${skema}.user_role_assignment (id, user_subject_id, role_id, valid_from)
   VALUES (gen_random_uuid(), $1, $2, now() - interval '1 hour')`, [subjectId, peranId]);

async function bersihkan() {
  await client.query(`DELETE FROM ${skema}.knowledge_chunk WHERE source_ref LIKE $1`, [`%${jejak}%`]);
  await client.query('DELETE FROM platform.ai_invocation WHERE actor_user_id=$1', [userId]);
  await client.query(`DELETE FROM ${skema}.user_role_assignment WHERE role_id=$1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id=$1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role WHERE id=$1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.user_subject WHERE id=$1`, [subjectId]);
  await client.query('DELETE FROM platform.platform_user_role WHERE user_id=$1', [userId]);
  await client.query('DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id=$1)', [userId]);
  await client.query('DELETE FROM platform.platform_session WHERE user_id=$1', [userId]);
  await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id=$1', [userId]);
  await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id=$1', [userId]);
  await client.query('DELETE FROM platform.platform_user WHERE id=$1', [userId]);
}

const kirim = (token, jalur, isi) => fetch(`${BASE}${jalur}`, {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(isi ?? {}),
}).then(async (r) => { const b = await r.json(); return { status: r.status, body: b.data, error: b.error }; });

const ambil = (token, jalur) => fetch(`${BASE}${jalur}`, { headers: { authorization: `Bearer ${token}` } })
  .then(async (r) => { const b = await r.json(); return { status: r.status, body: b.data, error: b.error }; });

try {
  const masuk = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: nama, password: sandi }),
  });
  const token = (await masuk.json()).data?.accessToken;
  if (!token) throw new Error('gagal masuk');

  await kirim(token, '/platform/ai/models/sync', {});

  // -- 1. Penyimpanan vektor siap tanpa pgvector ---------------------------
  log('1. PENYIMPANAN VEKTOR SIAP TANPA EKSTENSI pgvector');
  const kolom = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='knowledge_chunk'
        AND column_name IN ('embedding','embedding_model','embedding_dim')
      ORDER BY column_name`, [skema]);
  for (const k of kolom.rows) log(`   ${k.column_name}: ${k.data_type}`);
  check('tiga kolom vektor ada', kolom.rows.length, 3);
  check('memakai array, bukan tipe vector', kolom.rows.find((k) => k.column_name === 'embedding').data_type, 'ARRAY');

  const ext = await client.query(`SELECT count(*)::int n FROM pg_available_extensions WHERE name='vector'`);
  check('pgvector memang tidak tersedia di server ini', ext.rows[0].n, 0);
  log('   Memasang pgvector menuntut paket sistem operasi pada server basis data —');
  log('   bukan wewenang aplikasi. float8[] bekerja hari ini tanpa ekstensi apa pun.');
  log('');

  // -- 2. Kesamaan kosinus di SQL -----------------------------------------
  log('2. KESAMAAN KOSINUS DIHITUNG DI BASIS DATA');
  const kos = await client.query(
    `SELECT ${skema}.cosine_similarity(ARRAY[1,2,3]::float8[], ARRAY[1,2,3]::float8[]) AS sama,
            ${skema}.cosine_similarity(ARRAY[1,0]::float8[], ARRAY[0,1]::float8[]) AS tegak,
            ${skema}.cosine_similarity(ARRAY[1,2,3]::float8[], ARRAY[1,2]::float8[]) AS beda_dimensi,
            ${skema}.cosine_similarity(ARRAY[0,0]::float8[], ARRAY[1,1]::float8[]) AS vektor_nol`);
  const k = kos.rows[0];
  log(`   identik=${k.sama}  tegak lurus=${k.tegak}  dimensi beda=${k.beda_dimensi}  vektor nol=${k.vektor_nol}`);
  check('vektor identik menghasilkan 1', Math.round(Number(k.sama)), 1);
  check('vektor tegak lurus menghasilkan 0', Math.round(Number(k.tegak)), 0);
  check('dimensi berbeda menghasilkan NULL, bukan 0', k.beda_dimensi, null);
  check('vektor nol menghasilkan NULL', k.vektor_nol, null);
  log('   NULL, bukan 0: "tidak dapat dibandingkan" bukan hal yang sama dengan');
  log('   "tidak mirip". Memakai 0 membuat potongan dari model lain tampak');
  log('   sebagai potongan yang tidak relevan, sehingga sebabnya tak terlihat.');
  log('');

  // -- 3. Keadaan embedding dilaporkan dengan tepat -----------------------
  log('3. KEADAAN EMBEDDING DILAPORKAN DENGAN TEPAT');
  const stat = await ambil(token, '/ai/knowledge/stats');
  log(`   Pencari aktif : ${stat.body?.retriever}`);
  log(`   Sebab         : ${stat.body?.reason}`);
  log(`   Saran         : ${stat.body?.remedy ?? '(tidak ada — sudah berjalan)'}`);
  check('jenis pencari dilaporkan',
    ['LEXICAL', 'SEMANTIC', 'HYBRID'].includes(stat.body?.retriever), true);
  check('sebabnya dijelaskan', typeof stat.body?.reason, 'string');

  const adaEmbedding = stat.body?.retriever === 'HYBRID';

  if (!adaEmbedding) {
    log('');
    log('   Penyedia BELUM punya model embedding. Yang diuji sekarang adalah');
    log('   apakah sistem gagal dengan jujur — bukan apakah semantiknya bekerja.');
    check('ada saran yang dapat ditindaklanjuti', typeof stat.body?.remedy, 'string');
    check('saran menyebut pengunduhan model, bukan bendera server',
      /ollama pull/i.test(stat.body?.remedy ?? ''), true);
    check('saran menyanggah petunjuk --embeddings yang menyesatkan',
      /menyesatkan|TIDAK menyelesaikan/i.test(stat.body?.remedy ?? ''), true);
    log('   Pesan galat llama.cpp menyarankan bendera --embeddings, dan itu SALAH');
    log('   sasaran. Saran yang salah membuat operator mengerjakan yang sia-sia.');
  }
  log('');

  // -- 4. Meminta vektor tanpa model gagal dengan keterangan --------------
  log('4. PERMINTAAN VEKTOR TANPA MODEL GAGAL DENGAN KETERANGAN');
  const buat = await kirim(token, '/ai/knowledge/embed', {});
  if (adaEmbedding) {
    check('pembuatan vektor berhasil', buat.status, 201);
    log(`   ${buat.body?.embedded} potongan bervektor, ${buat.body?.remaining} tersisa`);
  } else {
    check('ditolak, bukan diam-diam berhasil', buat.status >= 400, true);
    log(`   ${String(buat.error?.message ?? '').slice(0, 160)}`);
    check('keterangannya menyebut cara memperbaiki',
      /ollama pull/i.test(buat.error?.message ?? ''), true);
  }
  log('');

  // -- 5. Pencarian tetap bekerja apa pun keadaannya ----------------------
  log('5. PENCARIAN TETAP BEKERJA APA PUN KEADAAN PENYEDIANYA');
  for (const [ref, isi] of [
    [`SEM-A-${jejak}`, 'Permohonan cuti tahunan karyawan bagian gudang.'],
    [`SEM-B-${jejak}`, 'Surat keterangan penghasilan untuk pengajuan kredit.'],
  ]) {
    await client.query(
      `INSERT INTO ${skema}.knowledge_chunk
         (source_type, source_id, source_ref, title, content, required_menu_code,
          confidentiality, content_hash)
       VALUES ('CATATAN', gen_random_uuid(), $1::varchar, $2, $3, 'SURAT_MASUK', 'BIASA', md5($1::text))`,
      [ref, `Catatan ${ref}`, isi]);
  }

  const cari = await kirim(token, '/ai/copilot', {
    useCaseCode: 'BUAT_KESIMPULAN',
    question: 'permohonan cuti',
    evidence: [{ source: 'Konteks', content: 'Pengguna mencari dokumen cuti.' }],
  });
  check('pencarian berjalan', cari.status, 201);
  const ditemukan = (cari.body?.retrievedEvidence ?? []).map((e) => e.reference);
  log(`   Pencari: ${cari.body?.retriever}`);
  log(`   Ditemukan: ${ditemukan.join(', ') || '(tidak ada)'}`);
  check('dokumen yang kata kuncinya cocok ditemukan', ditemukan.includes(`SEM-A-${jejak}`), true);
  check('jenis pencari dilaporkan pada jawaban',
    ['LEXICAL', 'SEMANTIC', 'HYBRID'].includes(cari.body?.retriever), true);
  log('');

  // -- 6. Vektor dari model lain tidak pernah tercampur -------------------
  log('6. VEKTOR DARI MODEL LAIN TIDAK PERNAH TERCAMPUR');
  log('   Vektor dari model berbeda tidak dapat dibandingkan; mencampurnya');
  log('   menghasilkan kemiripan yang tampak masuk akal namun tidak berarti.');
  await client.query(
    `UPDATE ${skema}.knowledge_chunk
        SET embedding = ARRAY[0.1,0.2,0.3]::float8[], embedding_model = 'model-palsu-lain',
            embedding_dim = 3, embedded_at = now()
      WHERE source_ref = $1`, [`SEM-B-${jejak}`]);

  const bandingSilang = await client.query(
    `SELECT source_ref,
            ${skema}.cosine_similarity(embedding, ARRAY[0.1,0.2,0.3,0.4]::float8[]) AS skor
       FROM ${skema}.knowledge_chunk WHERE source_ref = $1`, [`SEM-B-${jejak}`]);
  check('dibandingkan dengan dimensi berbeda menghasilkan NULL',
    bandingSilang.rows[0].skor, null);
  log('   Potongan itu tidak akan pernah muncul pada pencarian semantik model');
  log('   lain — bukan karena disaring, melainkan karena tidak dapat dibandingkan.');
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
  log('');
  log(adaEmbedding
    ? 'Keadaan: model embedding TERSEDIA — pencarian hibrida aktif.'
    : 'Keadaan: model embedding BELUM ADA — pencarian leksikal, dengan sebab dan');
  if (!adaEmbedding) log('saran yang tepat dilaporkan pada setiap jawaban.');
} finally {
  await bersihkan();
  await client.end();
}

writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v11b-semantic.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
