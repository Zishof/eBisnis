/**
 * Bukti Versi 11: AI Gateway, kebijakan, dan RAG.
 *
 * Dijalankan terhadap API yang berjalan DAN penyedia Ollama yang sebenarnya.
 *
 * Yang dibuktikan:
 *
 * 1. Katalog model diisi dari penemuan, bukan dari nama yang dikarang.
 * 2. Kemampuan diuji dengan MENCOBA — dan hasilnya jujur: embedding ditolak
 *    server.
 * 3. AI tidak memberi akses yang tidak dimiliki penggunanya.
 * 4. Data sensitif disamarkan sebelum meninggalkan server, dan penyamarannya
 *    dilaporkan.
 * 5. Keperluan berbukti menolak dijalankan tanpa bukti.
 * 6. Keluaran terstruktur sesuai skema.
 * 7. Pencarian bukti menghormati izin dan kerahasiaan.
 * 8. Seluruh pemanggilan tercatat.
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
log('BUKTI VERSI 11 — AI GATEWAY, KEBIJAKAN, DAN RAG');
log('=========================================================================');
log('');

const jejak = `v11${randomUUID().slice(0, 6)}`;
const skema = 'demo';
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;

const tenantId = (await client.query(
  `SELECT tenant_id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [skema])).rows[0].tenant_id;

/** Membuat petugas dengan izin tertentu. */
async function buatPetugas(label, izinDaftar, isStaff = false) {
  const userId = randomUUID();
  const nama = `bukti.${jejak}.${label}`;
  await client.query(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, display_name, password_hash, status,
        must_change_password, is_platform_staff, updated_at)
     VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, $5, now())`,
    [userId, nama, `Petugas ${label}`, await argon2.hash(sandi), isStaff]);
  await client.query(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, joined_at, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, false, 'ACTIVE', now(), now(), now())`, [tenantId, userId]);

  const subjectId = randomUUID();
  await client.query(
    `INSERT INTO ${skema}.user_subject
       (id, platform_user_id, code, name, username_snapshot, status, is_active, updated_at)
     VALUES ($1, $2, $3::varchar, $4, $5, 'ACTIVE', true, now())`,
    [subjectId, userId, `SUBJ_${jejak}_${label}`, `Petugas ${label}`, nama]);

  const peranId = randomUUID();
  await client.query(
    `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
     VALUES ($1, $2::varchar, $3, true, now())`,
    [peranId, `BUKTI_${jejak}_${label}`.toUpperCase().slice(0, 60), `Peran ${label}`]);
  for (const p of izinDaftar) {
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

  const masuk = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: nama, password: sandi }),
  });
  const token = (await masuk.json()).data?.accessToken;
  return { userId, subjectId, peranId, nama, token };
}

async function bersihkan() {
  await client.query(`DELETE FROM ${skema}.knowledge_chunk WHERE source_ref LIKE $1`, [`%${jejak}%`]);
  const u = await client.query(`SELECT id FROM platform.platform_user WHERE username LIKE $1`, [`bukti.${jejak}%`]);
  for (const x of u.rows) {
    await client.query('DELETE FROM platform.ai_feedback WHERE invocation_id IN (SELECT id FROM platform.ai_invocation WHERE actor_user_id=$1)', [x.id]);
    await client.query('DELETE FROM platform.ai_invocation WHERE actor_user_id=$1', [x.id]);
    await client.query(`DELETE FROM ${skema}.user_role_assignment WHERE user_subject_id IN (SELECT id FROM ${skema}.user_subject WHERE platform_user_id=$1)`, [x.id]);
    await client.query(`DELETE FROM ${skema}.user_subject WHERE platform_user_id=$1`, [x.id]);
    await client.query('DELETE FROM platform.platform_role_switch_log WHERE user_id=$1', [x.id]);
    await client.query('DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id=$1)', [x.id]);
    await client.query('DELETE FROM platform.platform_session WHERE user_id=$1', [x.id]);
    await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id=$1', [x.id]);
    await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id=$1', [x.id]);
    await client.query('DELETE FROM platform.platform_user WHERE id=$1', [x.id]);
  }
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id IN (SELECT id FROM ${skema}.role WHERE code LIKE $1)`, [`BUKTI_${jejak}%`.toUpperCase()]);
  await client.query(`DELETE FROM ${skema}.role WHERE code LIKE $1`, [`BUKTI_${jejak}%`.toUpperCase()]);
}

const kirim = (token, jalur, isi) => fetch(`${BASE}${jalur}`, {
  method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  body: JSON.stringify(isi ?? {}),
}).then(async (r) => { const b = await r.json(); return { status: r.status, body: b.data, error: b.error }; });

const ambil = (token, jalur) => fetch(`${BASE}${jalur}`, { headers: { authorization: `Bearer ${token}` } })
  .then(async (r) => { const b = await r.json(); return { status: r.status, body: b.data, error: b.error }; });

try {
  // Super admin untuk pengelolaan katalog.
  const admin = await buatPetugas('adm', [], true);
  await client.query(
    `INSERT INTO platform.platform_user_role (id, user_id, role_id)
     SELECT gen_random_uuid(), $1, id FROM platform.platform_role WHERE code='PLATFORM_SUPER_ADMIN'`,
    [admin.userId]);
  // Token diterbitkan ulang supaya membawa peran platformnya.
  const masukLagi = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: admin.nama, password: sandi }),
  });
  admin.token = (await masukLagi.json()).data?.accessToken;

  // -- 1. Katalog diisi dari penemuan -------------------------------------
  log('1. KATALOG MODEL DIISI DARI PENEMUAN, BUKAN DIKARANG');
  const kesehatan = await ambil(admin.token, '/platform/ai/health');
  log(`   Penyedia: ${kesehatan.body?.current?.status}, versi ${kesehatan.body?.current?.version}, ` +
      `${kesehatan.body?.current?.modelCount} model, ${kesehatan.body?.current?.latencyMs} ms`);
  check('penyedia menjawab', ['HEALTHY', 'DEGRADED'].includes(kesehatan.body?.current?.status), true);

  const sync = await kirim(admin.token, '/platform/ai/models/sync', {});
  log(`   Penyelarasan: ${sync.body?.discovered} ditemukan, ${sync.body?.added} baru, ${sync.body?.missing} hilang`);
  check('model ditemukan', sync.body?.discovered > 0, true);

  const modelDb = await client.query(`SELECT name FROM platform.ai_model ORDER BY name`);
  log(`   Katalog: ${modelDb.rows.map((r) => r.name).join(', ')}`);
  check('katalog terisi', modelDb.rows.length > 0, true);
  log('');

  // -- 2. Kemampuan diuji dengan mencoba ----------------------------------
  log('2. KEMAMPUAN DIUJI DENGAN MENCOBA, BUKAN DITEBAK DARI NAMA');
  log('   Ini yang membedakan katalog yang jujur dari katalog yang berharap.');
  const probe = await kirim(admin.token, '/platform/ai/models/probe', {});
  for (const m of probe.body ?? []) {
    log(`   ${m.name}: chat=${m.chat} embedding=${m.embedding} terstruktur=${m.structured}`);
  }
  check('ada model yang mampu chat', (probe.body ?? []).some((m) => m.chat), true);
  check('ada model yang mampu keluaran terstruktur', (probe.body ?? []).some((m) => m.structured), true);
  check('TIDAK ADA model yang mampu embedding', (probe.body ?? []).every((m) => !m.embedding), true);

  const catatan = await client.query(
    `SELECT note FROM platform.ai_model WHERE note ILIKE '%embedding%' LIMIT 1`);
  log(`   Sebab embedding ditolak: ${(catatan.rows[0]?.note ?? '').slice(0, 150)}`);
  check('sebabnya tercatat, bukan sekadar "tidak didukung"',
    /embeddings/i.test(catatan.rows[0]?.note ?? ''), true);
  log('');

  // -- 3. AI tidak memberi akses yang tidak dimiliki -----------------------
  log('3. AI TIDAK MEMBERI AKSES YANG TIDAK DIMILIKI PENGGUNANYA');
  log('   Tanpa pemeriksaan ini, AI menjadi jalan memintas seluruh hak akses:');
  log('   yang tidak berhak membaca laporan cukup meminta AI meringkasnya.');
  const tanpaIzin = await buatPetugas('noaccess', ['ADMIN.READ']);
  const ditolak = await kirim(tanpaIzin.token, '/ai/ask', {
    useCaseCode: 'TEMUKAN_ANOMALI',
    question: 'Ada yang janggal?',
    evidence: [{ source: 'Uji', content: 'angka 1 2 3' }],
  });
  check('tanpa izin menu keperluannya ditolak', ditolak.status, 403);
  log(`   ${ditolak.error?.message}`);
  log('');

  // -- 4. Keperluan tak dikenal ditolak ------------------------------------
  log('4. KEPERLUAN YANG TIDAK TERDAFTAR DITOLAK');
  const pengguna = await buatPetugas('user', ['HOME_DASHBOARD.READ', 'REPORTING.READ', 'SURAT_MASUK.READ', 'SURAT_KELUAR.READ']);
  const karangan = await kirim(pengguna.token, '/ai/ask', {
    useCaseCode: 'KIRIM_PEMBAYARAN',
    question: 'Bayar tagihan ini',
    evidence: [{ source: 'x', content: 'y' }],
  });
  check('kode keperluan karangan ditolak', karangan.status, 400);
  log('   Daftar tertutup mencegah prompt bebas — tanpa itu, siapa pun dapat');
  log('   mengirim pertanyaan apa saja beserta data apa saja ke penyedia.');
  log('');

  // -- 5. Keperluan berbukti menolak tanpa bukti --------------------------
  log('5. KEPERLUAN BERBUKTI MENOLAK DIJALANKAN TANPA BUKTI');
  const tanpaBukti = await kirim(pengguna.token, '/ai/ask', {
    useCaseCode: 'BUAT_KESIMPULAN', question: 'Bagaimana penjualan?',
  });
  check('tanpa bukti ditolak', tanpaBukti.status, 400);
  log(`   ${tanpaBukti.error?.message}`);
  log('');

  // -- 6. Penyamaran sebelum meninggalkan server --------------------------
  log('6. DATA SENSITIF DISAMARKAN SEBELUM MENINGGALKAN SERVER');
  const jawaban = await kirim(pengguna.token, '/ai/ask', {
    useCaseCode: 'BUAT_KESIMPULAN',
    question: 'Ringkas penjualan dua bulan ini.',
    evidence: [{
      source: 'Laporan Penjualan',
      reference: `LP-${jejak}`,
      content: 'Juni 10.000.000, Juli 12.000.000. Kontak: budi@contoh.co.id, 081234567890.',
    }],
  });
  check('jawaban berhasil', jawaban.status, 201);
  log(`   Model: ${jawaban.body?.model}, ${jawaban.body?.durationMs} ms`);
  log(`   Disamarkan: ${JSON.stringify(jawaban.body?.redacted)}`);
  check('surel dan telepon disamarkan',
    (jawaban.body?.redacted ?? []).length >= 2, true);
  log(`   Kesimpulan: ${String(jawaban.body?.output?.kesimpulan ?? '').slice(0, 120)}`);
  log('');

  // -- 7. Keluaran terstruktur sesuai skema -------------------------------
  log('7. KELUARAN TERSTRUKTUR SESUAI SKEMA');
  check('bidang kesimpulan ada', typeof jawaban.body?.output?.kesimpulan, 'string');
  check('bidang poinPenting berupa array', Array.isArray(jawaban.body?.output?.poinPenting), true);
  check('bidang keyakinan ada', typeof jawaban.body?.output?.keyakinan, 'string');
  check('bentuk keluarannya ANALYSIS, bukan tindakan', jawaban.body?.outputKind, 'ANALYSIS');
  check('sumber bukti disertakan pada jawaban', jawaban.body?.evidenceUsed?.length >= 1, true);
  check('peringatan disertakan', typeof jawaban.body?.disclaimer, 'string');
  log(`   Peringatan: ${String(jawaban.body?.disclaimer).slice(0, 90)}...`);
  log('');

  // -- 8. RAG menghormati izin dan kerahasiaan ----------------------------
  log('8. PENCARIAN BUKTI MENGHORMATI IZIN DAN KERAHASIAAN');
  // Dua potongan: satu boleh dibaca, satu rahasia.
  for (const [ref, rahasia, menu] of [
    [`KB-BIASA-${jejak}`, 'BIASA', 'SURAT_MASUK'],
    [`KB-RAHASIA-${jejak}`, 'RAHASIA', 'SURAT_MASUK'],
    [`KB-TERLARANG-${jejak}`, 'BIASA', 'FINANCE'],
  ]) {
    await client.query(
      `INSERT INTO ${skema}.knowledge_chunk
         (source_type, source_id, source_ref, title, content, required_menu_code,
          confidentiality, content_hash)
       VALUES ('CATATAN', gen_random_uuid(), $1::varchar, $2, $3, $4, $5, md5($1::text))`,
      [ref, `Catatan ${ref}`, `Kata kunci khusus: zebrakuning ${ref}`, menu, rahasia]);
  }

  const cari = await kirim(pengguna.token, '/ai/copilot', {
    useCaseCode: 'BUAT_KESIMPULAN',
    question: 'zebrakuning',
    routePath: '/app/surat/masuk',
    evidence: [{ source: 'Konteks', content: 'Pengguna mencari catatan zebrakuning.' }],
  });
  const ditemukan = (cari.body?.retrievedEvidence ?? []).map((e) => e.reference);
  log(`   Bukti ditemukan: ${ditemukan.join(', ') || '(tidak ada)'}`);
  check('potongan biasa ditemukan', ditemukan.includes(`KB-BIASA-${jejak}`), true);
  check('potongan RAHASIA tidak pernah ikut', ditemukan.includes(`KB-RAHASIA-${jejak}`), false);
  check('potongan di luar izin menu tidak ikut', ditemukan.includes(`KB-TERLARANG-${jejak}`), false);
  log(`   Jenis pencari: ${cari.body?.retriever}`);
  check('jenis pencarinya dinyatakan terus terang', cari.body?.retriever, 'LEXICAL');
  log('');

  // -- 9. Seluruh pemanggilan tercatat ------------------------------------
  log('9. SELURUH PEMANGGILAN TERCATAT');
  const jejakAi = await client.query(
    `SELECT use_case_code, status, model_name, evidence_count, schema_valid,
            prompt_redacted IS NOT NULL AS simpan_isi, active_role_code
       FROM platform.ai_invocation WHERE actor_user_id = $1 ORDER BY occurred_at`,
    [pengguna.userId]);
  for (const r of jejakAi.rows) {
    log(`   ${r.use_case_code.padEnd(18)} ${r.status.padEnd(8)} bukti=${r.evidence_count} ` +
        `skema=${r.schema_valid} simpanIsi=${r.simpan_isi}`);
  }
  check('pemanggilan tercatat', jejakAi.rows.length > 0, true);
  check('keperluan berisiko rendah TIDAK menyimpan isi',
    jejakAi.rows.filter((r) => r.use_case_code === 'BUAT_KESIMPULAN').every((r) => !r.simpan_isi), true);
  log('   Prompt ERP memuat angka penjualan, nama pelanggan, dan gaji. Menyimpannya');
  log('   utuh berarti membuat salinan kedua dari seluruh data sensitif.');
  log('');

  // -- 10. Penilaian dan kuota --------------------------------------------
  log('10. PENILAIAN DAN KUOTA');
  const nilai = await kirim(pengguna.token, `/ai/invocations/${jawaban.body.invocationId}/feedback`, {
    verdict: 'ACCEPTED',
  });
  check('penilaian tercatat', nilai.status, 201);

  const tolakTanpaAlasan = await kirim(pengguna.token, `/ai/invocations/${jawaban.body.invocationId}/feedback`, {
    verdict: 'REJECTED',
  });
  check('penolakan tanpa alasan ditolak', tolakTanpaAlasan.status, 400);
  log('   Mutu AI hanya dapat diperbaiki dari alasan penolakannya.');

  const daftar = await ambil(pengguna.token, '/ai/use-cases');
  const bentuk = new Set((daftar.body?.items ?? []).map((u) => u.outputKind));
  log(`   Bentuk keluaran yang ada: ${[...bentuk].join(', ')}`);
  check('tidak ada bentuk keluaran yang berarti "kerjakan"',
    [...bentuk].every((b) => ['DRAFT', 'ANALYSIS', 'RECOMMENDATION'].includes(b)), true);
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
} finally {
  await bersihkan();
  await client.end();
}

writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v11-ai.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
