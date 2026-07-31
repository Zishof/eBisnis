/**
 * Bukti V10-7: Notification Hub.
 *
 * Yang dibuktikan:
 *
 * 1. Tabel `notification` berhenti kosong — perbuatan nyata menerbitkan
 *    pemberitahuan nyata.
 * 2. Kanal yang belum berkredensial melaporkan `UNCONFIGURED` beserta apa yang
 *    kurang, BUKAN mengarang keberhasilan.
 * 3. Pengelompokan mencegah satu surat terlambat menjadi puluhan baris lonceng.
 * 4. Yang menuntut tindakan tidak dapat ditutup begitu saja.
 * 5. Eskalasi SLA menutup celah V10-6: due_at yang tercatat kini benar-benar
 *    dibaca.
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
log('BUKTI V10-7 — NOTIFICATION HUB');
log('=========================================================================');
log('');

const awal = await client.query('SELECT count(*)::int n FROM demo.notification');
log(`Keadaan awal: ${awal.rows[0].n} pemberitahuan pada demo.notification`);
log('Tabel ini ada sejak V004 dan tidak pernah terisi — tidak ada satu pun kode');
log('yang menulisinya, dan tidak ada satu pun endpoint yang membacanya.');
log('');

const jejak = `v107${randomUUID().slice(0, 6)}`;
const skema = 'demo';
const userId = randomUUID();
const nama = `bukti.${jejak}`;
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;
const peranKode = `BUKTI_${jejak}`;

const tenantId = (await client.query(
  `SELECT tenant_id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [skema])).rows[0].tenant_id;

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash, status,
      must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, false, now())`,
  [userId, nama, 'Petugas Bukti V10-7', await argon2.hash(sandi)]);
await client.query(
  `INSERT INTO platform.tenant_membership
     (id, tenant_id, platform_user_id, is_owner, status, joined_at, created_at, updated_at)
   VALUES (gen_random_uuid(), $1, $2, false, 'ACTIVE', now(), now(), now())`, [tenantId, userId]);

const subjectId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.user_subject
     (id, platform_user_id, code, name, username_snapshot, status, is_active, updated_at)
   VALUES ($1, $2, $3::varchar, $4, $5, 'ACTIVE', true, now())`,
  [subjectId, userId, `SUBJ_${jejak}`, 'Petugas Bukti V10-7', nama]);

const peranId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
   VALUES ($1, $2::varchar, $3, true, now())`, [peranId, peranKode, 'Peran Bukti V10-7']);
for (const p of ['SURAT_MASUK.CREATE','SURAT_MASUK.UPDATE','SURAT_KELUAR.CREATE',
                 'SURAT_KELUAR.READ','SURAT_KELUAR.UPDATE','SURAT_KELUAR.APPROVE']) {
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

// Master surat dengan alur yang menunjuk peran uji, SLA satu jam.
const schemeId = randomUUID(), flowId = randomUUID(), klasId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.surat_number_scheme (id, code, name, pattern, number_padding, reset_period)
   VALUES ($1, $2::varchar, $3, '{NOMOR}/{TAHUN}', 4, 'YEARLY')`,
  [schemeId, `SCH_${jejak}`, 'Skema Bukti V10-7']);
await client.query(
  `INSERT INTO ${skema}.surat_approval_flow (id, code, name, direction, enforce_all_steps)
   VALUES ($1, $2::varchar, $3, 'OUT', true)`, [flowId, `FLOW_${jejak}`, 'Alur Bukti V10-7']);
await client.query(
  `INSERT INTO ${skema}.surat_approval_flow_step (flow_id, step_order, name, role_code, sla_hours)
   VALUES ($1, 1, 'Disetujui Pemeriksa', $2, 1)`, [flowId, peranKode]);
await client.query(
  `INSERT INTO ${skema}.surat_classification (id, code, name, direction, number_scheme_id, approval_flow_id)
   VALUES ($1, $2::varchar, $3, 'OUT', $4, $5)`,
  [klasId, `SK${jejak.slice(-4)}`, 'Klasifikasi Bukti V10-7', schemeId, flowId]);

async function bersihkan() {
  await client.query(`DELETE FROM ${skema}.notification_delivery WHERE notification_id IN (SELECT id FROM ${skema}.notification WHERE recipient_role_code = $1 OR recipient_subject_id = $2)`, [peranKode, subjectId]);
  await client.query(`DELETE FROM ${skema}.notification WHERE recipient_role_code = $1 OR recipient_subject_id = $2`, [peranKode, subjectId]);
  await client.query(`DELETE FROM ${skema}.surat_approval WHERE outgoing_id IN (SELECT id FROM ${skema}.surat_outgoing WHERE classification_id = $1)`, [klasId]);
  await client.query(`DELETE FROM ${skema}.surat_outgoing WHERE classification_id = $1`, [klasId]);
  await client.query(`DELETE FROM ${skema}.surat_disposition WHERE incoming_id IN (SELECT id FROM ${skema}.surat_incoming WHERE registered_by_user_subject_id = $1)`, [subjectId]);
  await client.query(`DELETE FROM ${skema}.surat_incoming WHERE registered_by_user_subject_id = $1`, [subjectId]);
  await client.query(`DELETE FROM ${skema}.surat_classification WHERE id = $1`, [klasId]);
  await client.query(`DELETE FROM ${skema}.surat_approval_flow_step WHERE flow_id = $1`, [flowId]);
  await client.query(`DELETE FROM ${skema}.surat_approval_flow WHERE id = $1`, [flowId]);
  await client.query(`DELETE FROM ${skema}.surat_number_counter WHERE scheme_id = $1`, [schemeId]);
  await client.query(`DELETE FROM ${skema}.surat_number_scheme WHERE id = $1`, [schemeId]);
  await client.query(`DELETE FROM ${skema}.user_role_assignment WHERE role_id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role_menu_permission WHERE role_id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.role WHERE id = $1`, [peranId]);
  await client.query(`DELETE FROM ${skema}.user_subject WHERE id = $1`, [subjectId]);
  await client.query('DELETE FROM platform.platform_role_switch_log WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id = $1)', [userId]);
  await client.query('DELETE FROM platform.platform_session WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_user WHERE id = $1', [userId]);
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

  // Peran aktif dipilih supaya pemberitahuan berbasis peran tampil pada lonceng.
  await kirim(token, '/me/active-role', { roleId: peranId });

  // -- 1. Kanal melaporkan keadaannya apa adanya --------------------------
  log('1. KANAL MELAPORKAN KEADAANNYA APA ADANYA');
  log('   Melaporkan berhasil padahal tidak terkirim adalah yang paling berbahaya:');
  log('   orang mengira sudah diberi tahu, pekerjaan berhenti menunggu seseorang');
  log('   yang tidak pernah tahu ia ditunggu, tanpa satu pun tanda ada yang salah.');
  const kanal = await ambil(token, '/notifications/kanal');
  for (const k of kanal.body.channels) {
    log(`   ${k.channel.padEnd(12)} ${k.configured ? 'SIAP' : 'BELUM'}${k.missing ? ' — ' + k.missing.slice(0, 70) : ''}`);
  }
  check('IN_APP siap', kanal.body.channels.find((k) => k.channel === 'IN_APP').configured, true);
  check('EMAIL belum siap', kanal.body.channels.find((k) => k.channel === 'EMAIL').configured, false);
  check('keterangan menyebut apa yang kurang',
    /SMTP_HOST/.test(kanal.body.channels.find((k) => k.channel === 'EMAIL').missing), true);
  log('');

  // -- 2. Disposisi menerbitkan pemberitahuan -----------------------------
  log('2. DISPOSISI MENERBITKAN PEMBERITAHUAN');
  const sm = await kirim(token, '/surat/masuk', {
    senderName: 'Dinas Perhubungan', subject: 'Permohonan data armada',
  });
  await kirim(token, `/surat/masuk/${sm.body.id}/disposisi`, {
    toRoleCode: peranKode, instruction: 'Mohon disiapkan datanya sebelum Jumat.',
  });

  const lonceng1 = await ambil(token, '/notifications');
  log(`   Lonceng: ${lonceng1.body.unreadCount} belum dibaca, ${lonceng1.body.actionPendingCount} menunggu tindakan`);
  const disp = lonceng1.body.items.find((i) => i.title.includes('Disposisi'));
  check('disposisi muncul pada lonceng', !!disp, true);
  check('disposisi menuntut tindakan', disp.action_required, true);
  log(`   Tautan: ${disp.deep_link}`);
  check('ada tautan menuju suratnya', /^\/app\/surat\/masuk\//.test(disp.deep_link), true);
  log('');

  // -- 3. Langkah persetujuan memberi tahu penyetujunya -------------------
  log('3. LANGKAH PERSETUJUAN MEMBERI TAHU PENYETUJUNYA');
  log('   Penyetuju yang tidak tahu gilirannya tiba akan membuat suratnya');
  log('   menunggu sampai ada yang menanyakannya secara langsung.');
  const konsep = await kirim(token, '/surat/keluar', {
    classificationId: klasId, recipientName: 'PT Contoh', subject: 'Balasan permohonan data',
  });
  await kirim(token, `/surat/keluar/${konsep.body.id}/ajukan`, {});

  const lonceng2 = await ambil(token, '/notifications');
  const menunggu = lonceng2.body.items.find((i) => i.title.includes('menunggu persetujuan'));
  check('penyetuju diberi tahu', !!menunggu, true);
  check('yang menuntut tindakan didahulukan', lonceng2.body.items[0].action_required, true);
  log('');

  // -- 4. Yang menuntut tindakan tidak dapat ditutup begitu saja ----------
  log('4. YANG MENUNTUT TINDAKAN TIDAK DAPAT DITUTUP BEGITU SAJA');
  const tutup = await kirim(token, `/notifications/${menunggu.id}/tutup`, {});
  check('penutupan ditolak', tutup.status, 400);
  log(`   ${tutup.error?.message}`);
  log('   Menutupnya akan membuat pekerjaan orang lain berhenti menunggu tanpa');
  log('   ada yang tahu sebabnya.');
  log('');

  // -- 5. Dibaca berbeda dari ditindaklanjuti -----------------------------
  log('5. DIBACA BERBEDA DARI DITINDAKLANJUTI');
  await kirim(token, '/notifications/baca', { ids: [menunggu.id] });
  const setelahBaca = await ambil(token, '/notifications');
  check('sudah dibaca', setelahBaca.body.unreadCount < lonceng2.body.unreadCount, true);
  check('TETAP menunggu tindakan', setelahBaca.body.actionPendingCount >= 1, true);
  log('   Melihat permintaan persetujuan tidak sama dengan menyetujuinya.');

  await kirim(token, `/notifications/${menunggu.id}/tindaklanjuti`, {});
  const setelahTindak = await ambil(token, '/notifications');
  check('setelah ditindaklanjuti tidak lagi terhitung menunggu',
    setelahTindak.body.actionPendingCount < setelahBaca.body.actionPendingCount, true);
  log('');

  // -- 6. Pengelompokan mencegah lonceng tenggelam ------------------------
  log('6. PENGELOMPOKAN MENCEGAH LONCENG TENGGELAM');
  log('   Pemeriksaan SLA berjalan tiap jam. Tanpa pengelompokan, surat yang');
  log('   terlambat tiga hari menghasilkan 72 baris lonceng — yang menenggelamkan');
  log('   segala hal lain dan membuat lonceng itu diabaikan.');

  // Batas waktu dimundurkan supaya langkahnya benar-benar terlambat.
  await client.query(
    `UPDATE ${skema}.surat_approval SET due_at = now() - interval '30 hours'
      WHERE outgoing_id = $1 AND decision = 'MENUNGGU'`, [konsep.body.id]);

  const sebelumSapu = await client.query(
    `SELECT count(*)::int n FROM ${skema}.notification WHERE group_key LIKE 'SLA_SURAT:%'`);

  // Disapu tiga kali, meniru tiga jam pemeriksaan berturut-turut.
  let totalEskalasi = 0;
  for (let i = 0; i < 3; i += 1) {
    const sapu = await kirim(token, '/notifications/sapu-sla', {});
    totalEskalasi += sapu.body?.escalated ?? 0;
  }
  log(`   Tiga kali pemeriksaan menerbitkan ${totalEskalasi} eskalasi.`);

  const sesudahSapu = await client.query(
    `SELECT group_key, occurrence_count, severity FROM ${skema}.notification
      WHERE group_key LIKE 'SLA_SURAT:%'`);
  log(`   Baris eskalasi pada lonceng: ${sesudahSapu.rows.length}`);
  for (const r of sesudahSapu.rows) {
    log(`     ${r.group_key.slice(0, 45)} -> ${r.occurrence_count} kejadian, ${r.severity}`);
  }
  check('tiga pemeriksaan menghasilkan SATU baris, bukan tiga', sesudahSapu.rows.length, 1);
  check('penghitung kejadian eskalasi naik menjadi tiga', sesudahSapu.rows[0].occurrence_count, 3);
  check('terlambat lebih dari sehari menjadi CRITICAL', sesudahSapu.rows[0].severity, 'CRITICAL');
  log('   due_at yang dicatat V10-6 kini benar-benar dibaca — celah itu tertutup.');
  log('');
  log('   Pengelompokan pengajuan ulang:');

  // Menerbitkan ulang pemberitahuan yang berkunci sama harus menaikkan
  // penghitung, bukan menambah baris.
  await kirim(token, `/surat/keluar/${konsep.body.id}/putuskan`, { decision: 'DIKEMBALIKAN', note: 'Perlu dilengkapi datanya.' });
  await kirim(token, `/surat/keluar/${konsep.body.id}/ajukan`, {});
  await kirim(token, `/surat/keluar/${konsep.body.id}/putuskan`, { decision: 'DIKEMBALIKAN', note: 'Masih kurang lengkap.' });
  await kirim(token, `/surat/keluar/${konsep.body.id}/ajukan`, {});

  const kelompok = await client.query(
    `SELECT group_key, occurrence_count FROM ${skema}.notification
      WHERE group_key = $1 AND read_at IS NULL AND dismissed_at IS NULL`,
    [`SURAT_PERSETUJUAN:${konsep.body.id}:1`]);
  log(`   Setelah tiga kali pengajuan: ${kelompok.rows.length} baris, ${kelompok.rows[0]?.occurrence_count} kejadian`);
  check('tetap satu baris, bukan tiga', kelompok.rows.length, 1);
  check('penghitung kejadiannya naik', kelompok.rows[0].occurrence_count >= 2, true);
  log('');

  // -- 7. Catatan pengiriman per kanal ------------------------------------
  log('7. CATATAN PENGIRIMAN PER KANAL');
  const kirimannya = await client.query(
    `SELECT d.channel, d.status, d.note FROM ${skema}.notification_delivery d
       JOIN ${skema}.notification n ON n.id = d.notification_id
      WHERE n.recipient_role_code = $1 OR n.recipient_subject_id = $2
      GROUP BY d.channel, d.status, d.note`, [peranKode, subjectId]);
  for (const r of kirimannya.rows) log(`   ${r.channel}: ${r.status}${r.note ? ' — ' + r.note.slice(0, 60) : ''}`);
  check('ada catatan pengiriman', kirimannya.rows.length > 0, true);
  check('tidak ada yang mengaku SENT tanpa benar-benar terkirim',
    kirimannya.rows.every((r) => r.status !== 'SENT' || r.channel === 'IN_APP'), true);
  log('');

  // -- 8. Tabel tidak lagi kosong -----------------------------------------
  log('8. TABEL TIDAK LAGI KOSONG');
  const akhir = await client.query(
    `SELECT count(*)::int n FROM ${skema}.notification WHERE recipient_role_code = $1 OR recipient_subject_id = $2`,
    [peranKode, subjectId]);
  log(`   ${akhir.rows[0].n} pemberitahuan diterbitkan oleh perbuatan nyata.`);
  check('tabel terisi', akhir.rows[0].n > 0, true);
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
} finally {
  await bersihkan();
  await client.end();
}

writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v10-7-notification.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
