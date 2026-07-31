/**
 * Bukti V10-6: tata kelola surat.
 *
 * Yang dibuktikan, terutama satu hal:
 *
 * **Nomor surat tidak dapat kembar, bahkan di bawah permintaan bersamaan.**
 *
 * Sistem lama punya `SinkronNomorSuratHelper` — penolong untuk menyelaraskan
 * nomor. Penolong seperti itu hanya dibutuhkan bila nomornya pernah tidak
 * selaras, dan nomor surat resmi yang kembar adalah cacat yang terbawa ke luar
 * organisasi. Di sini keadaan itu dibuat mustahil, bukan dapat diperbaiki.
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
log('BUKTI V10-6 — TATA KELOLA SURAT');
log('=========================================================================');
log('');

const jejak = `v106${randomUUID().slice(0, 6)}`;
const skema = 'demo';
const userId = randomUUID();
const nama = `bukti.${jejak}`;
const sandi = `${randomBytes(24).toString('base64url')}#Aa1`;

const tenantId = (
  await client.query(`SELECT tenant_id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [skema])
).rows[0].tenant_id;

await client.query(
  `INSERT INTO platform.platform_user
     (id, username, normalized_username, display_name, password_hash, status,
      must_change_password, is_platform_staff, updated_at)
   VALUES ($1, $2::varchar, lower($2::text), $3, $4, 'ACTIVE', false, false, now())`,
  [userId, nama, 'Petugas Bukti V10-6', await argon2.hash(sandi)],
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
  [subjectId, userId, `SUBJ_${jejak}`, 'Petugas Bukti V10-6', nama],
);

// Peran dengan izin surat. Menu surat belum ada di katalog, jadi izinnya
// disiapkan langsung untuk keperluan bukti ini.
const peranId = randomUUID();
await client.query(
  `INSERT INTO ${skema}.role (id, code, name, is_active, updated_at)
   VALUES ($1, $2::varchar, $3, true, now())`,
  [peranId, `BUKTI_${jejak}`, 'Peran Bukti V10-6'],
);
// Izin surat untuk peran uji.
for (const p of [
  'SURAT_MASUK.CREATE', 'SURAT_MASUK.UPDATE', 'SURAT_MASUK.READ',
  'SURAT_KELUAR.CREATE', 'SURAT_KELUAR.READ', 'SURAT_KELUAR.UPDATE', 'SURAT_KELUAR.APPROVE',
  'SURAT_PENOMORAN.READ', 'SURAT_PENOMORAN.UPDATE',
]) {
  const [menu, aksi] = p.split('.');
  const r = await client.query(
    `INSERT INTO ${skema}.role_menu_permission (id, role_id, menu_id, permission_action_id, effect, updated_at)
     SELECT gen_random_uuid(), $1, m.id, pa.id, 'ALLOW'::varchar, now()
       FROM ${skema}.menu m, ${skema}.permission_action pa
      WHERE m.code = $2 AND pa.code = $3
     RETURNING id`,
    [peranId, menu, aksi],
  );
  if (r.rowCount === 0) throw new Error(`izin ${p} tidak dapat dibuat — menu atau aksinya belum ada`);
}
await client.query(
  `INSERT INTO ${skema}.user_role_assignment (id, user_subject_id, role_id, valid_from)
   VALUES (gen_random_uuid(), $1, $2, now() - interval '1 hour')`,
  [subjectId, peranId],
);

// Master surat untuk pengujian.
const schemeId = randomUUID();
const flowId = randomUUID();
const klasId = randomUUID();

await client.query(
  `INSERT INTO ${skema}.surat_number_scheme
     (id, code, name, pattern, number_padding, start_number, reset_period)
   VALUES ($1, $2::varchar, $3, $4, 4, 1, 'YEARLY')`,
  [schemeId, `SCH_${jejak}`, 'Skema Bukti', '{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}'],
);
await client.query(
  `INSERT INTO ${skema}.surat_approval_flow (id, code, name, direction, enforce_all_steps)
   VALUES ($1, $2::varchar, $3, 'OUT', true)`,
  [flowId, `FLOW_${jejak}`, 'Alur Bukti'],
);
for (const [urut, judul] of [[1, 'Diperiksa Kepala Bagian'], [2, 'Disetujui Direktur']]) {
  await client.query(
    `INSERT INTO ${skema}.surat_approval_flow_step (flow_id, step_order, name, sla_hours)
     VALUES ($1, $2, $3, 24)`,
    [flowId, urut, judul],
  );
}
await client.query(
  `INSERT INTO ${skema}.surat_classification
     (id, code, name, direction, number_scheme_id, approval_flow_id)
   VALUES ($1, $2::varchar, $3, 'OUT', $4, $5)`,
  [klasId, `SK${jejak.slice(-4)}`, 'Surat Keterangan Bukti', schemeId, flowId],
);

async function bersihkan() {
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
  await client.query('DELETE FROM platform.platform_refresh_token WHERE session_id IN (SELECT id FROM platform.platform_session WHERE user_id = $1)', [userId]);
  await client.query('DELETE FROM platform.platform_session WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_login_attempt WHERE user_id = $1', [userId]);
  await client.query('DELETE FROM platform.platform_user WHERE id = $1', [userId]);
}

const kirim = (token, jalur, isi) =>
  fetch(`${BASE}${jalur}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(isi ?? {}),
  }).then(async (r) => {
    const b = await r.json();
    return { status: r.status, body: b.data, error: b.error };
  });

const ambil = (token, jalur) =>
  fetch(`${BASE}${jalur}`, { headers: { authorization: `Bearer ${token}` } }).then(async (r) => {
    const b = await r.json();
    return { status: r.status, body: b.data, error: b.error };
  });

try {
  const masuk = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: nama, password: sandi }),
  });
  const token = (await masuk.json()).data?.accessToken;
  if (!token) throw new Error('gagal masuk');

  // -- 1. Pola ditegakkan, bukan sekadar contoh ----------------------------
  log('1. POLA PENOMORAN DITEGAKKAN, BUKAN SEKADAR CONTOH');
  log('   Sistem lama menyimpan contohFormat — sebuah CONTOH. Contoh tidak dapat');
  log('   dieksekusi: dua orang yang membacanya tetap dapat menulis nomor berbeda.');
  const polaSalah = await kirim(token, '/surat/penomoran/periksa-pola', { pattern: '{NOMOR}/{TAHNU}' });
  check('penanda salah ketik ditolak', polaSalah.body.valid, false);
  log(`   ${polaSalah.body.errors[0]}`);
  const tanpaNomor = await kirim(token, '/surat/penomoran/periksa-pola', { pattern: 'SK/{TAHUN}' });
  check('pola tanpa {NOMOR} ditolak', tanpaNomor.body.valid, false);
  const polaBenar = await kirim(token, '/surat/penomoran/periksa-pola', {
    pattern: '{NOMOR}/{KODE_KLASIFIKASI}/{BULAN_ROMAWI}/{TAHUN}',
  });
  check('pola sah diterima', polaBenar.body.valid, true);
  log('');

  // -- 2. Konsep belum bernomor -------------------------------------------
  log('2. KONSEP BELUM BERNOMOR');
  log('   Nomor yang sudah keluar tidak dapat ditarik kembali. Konsep yang batal');
  log('   akan meninggalkan lubang penomoran yang tidak dapat dijelaskan saat diaudit.');
  const konsep = await kirim(token, '/surat/keluar', {
    classificationId: klasId,
    recipientName: 'PT Contoh Sejahtera',
    subject: 'Permohonan kerja sama',
    body: 'Isi surat.',
  });
  check('konsep dibuat', konsep.body.status, 'KONSEP');
  const suratId = konsep.body.id;
  const belum = await client.query(`SELECT letter_number FROM ${skema}.surat_outgoing WHERE id = $1`, [suratId]);
  check('konsep belum punya nomor', belum.rows[0].letter_number, null);
  log('');

  // -- 3. Nomor hanya keluar setelah seluruh langkah disetujui ------------
  log('3. NOMOR HANYA KELUAR SETELAH SELURUH LANGKAH DISETUJUI');
  const terbitDini = await kirim(token, `/surat/keluar/${suratId}/terbitkan`, {});
  check('konsep tidak dapat langsung diterbitkan', terbitDini.status, 400);
  log(`   ${terbitDini.error?.message}`);

  const ajukan = await kirim(token, `/surat/keluar/${suratId}/ajukan`, {});
  check('diajukan ke langkah pertama', ajukan.body.currentStep, 1);

  // Penolakan tanpa alasan harus ditolak.
  const tanpaAlasan = await kirim(token, `/surat/keluar/${suratId}/putuskan`, { decision: 'DITOLAK' });
  check('penolakan tanpa alasan ditolak', tanpaAlasan.status, 400);

  const setuju1 = await kirim(token, `/surat/keluar/${suratId}/putuskan`, { decision: 'DISETUJUI' });
  check('langkah 1 disetujui, lanjut ke langkah 2', setuju1.body.currentStep, 2);

  // Alur wajib: menyatakan selesai lebih awal harus DIABAIKAN.
  const terbitTengah = await kirim(token, `/surat/keluar/${suratId}/terbitkan`, {});
  check('belum dapat diterbitkan di tengah alur', terbitTengah.status, 400);

  const setuju2 = await kirim(token, `/surat/keluar/${suratId}/putuskan`, { decision: 'DISETUJUI' });
  check('langkah terakhir menyelesaikan alur', setuju2.body.status, 'DISETUJUI');

  const terbit = await kirim(token, `/surat/keluar/${suratId}/terbitkan`, {});
  log(`   Nomor terbit: ${terbit.body.letterNumber}`);
  check('nomor sesuai pola', /^\d{4}\/SK[a-z0-9]{4}\/[IVX]+\/\d{4}$/.test(terbit.body.letterNumber), true);

  // Idempoten.
  const terbitUlang = await kirim(token, `/surat/keluar/${suratId}/terbitkan`, {});
  check('penerbitan ulang mengembalikan nomor yang sama', terbitUlang.body.letterNumber, terbit.body.letterNumber);
  check('penerbitan ulang tidak mengambil nomor kedua', terbitUlang.body.alreadyIssued, true);
  log('');

  // -- 4. Nomor tidak kembar di bawah permintaan bersamaan ----------------
  log('4. NOMOR TIDAK KEMBAR DI BAWAH PERMINTAAN BERSAMAAN');
  log('   Inilah yang paling penting. MAX(nomor)+1 tidak dapat mencegahnya: dua');
  log('   permintaan membaca MAX yang sama sebelum salah satunya menulis.');
  log('   Di sini penghitungnya baris tersendiri, dinaikkan dengan satu pernyataan.');

  // Dua puluh surat disiapkan, lalu diterbitkan SERENTAK.
  const ids = [];
  for (let i = 0; i < 20; i += 1) {
    const k = await kirim(token, '/surat/keluar', {
      classificationId: klasId,
      recipientName: `Penerima ${i}`,
      subject: `Surat serentak ${i}`,
    });
    await kirim(token, `/surat/keluar/${k.body.id}/ajukan`, {});
    await kirim(token, `/surat/keluar/${k.body.id}/putuskan`, { decision: 'DISETUJUI' });
    await kirim(token, `/surat/keluar/${k.body.id}/putuskan`, { decision: 'DISETUJUI' });
    ids.push(k.body.id);
  }

  const hasil = await Promise.all(ids.map((id) => kirim(token, `/surat/keluar/${id}/terbitkan`, {})));
  const nomor = hasil.map((h) => h.body?.letterNumber).filter(Boolean);
  log(`   ${nomor.length} surat diterbitkan serentak.`);
  check('seluruhnya memperoleh nomor', nomor.length, 20);
  check('tidak ada nomor kembar', new Set(nomor).size, nomor.length);

  const urut = nomor
    .map((n) => Number(n.split('/')[0]))
    .sort((a, b) => a - b);
  log(`   Urutan yang diberikan: ${urut[0]} sampai ${urut[urut.length - 1]}`);
  const berurutTanpaLubang = urut.every((n, i) => i === 0 || n === urut[i - 1] + 1);
  check('nomornya berurut tanpa lubang', berurutTanpaLubang, true);

  const kembarDb = await client.query(
    `SELECT letter_number, count(*)::int n FROM ${skema}.surat_outgoing
      WHERE classification_id = $1 AND letter_number IS NOT NULL
      GROUP BY letter_number HAVING count(*) > 1`,
    [klasId],
  );
  check('basis data tidak memuat nomor kembar', kembarDb.rows.length, 0);
  log('');

  // -- 5. Pratinjau tidak mengambil nomor ---------------------------------
  log('5. PRATINJAU TIDAK MENGAMBIL NOMOR');
  const sebelumPratinjau = await client.query(
    `SELECT last_number FROM ${skema}.surat_number_counter WHERE scheme_id = $1`, [schemeId]);
  const pratinjau1 = await ambil(token, `/surat/penomoran/${schemeId}/pratinjau`);
  const pratinjau2 = await ambil(token, `/surat/penomoran/${schemeId}/pratinjau`);
  const sesudahPratinjau = await client.query(
    `SELECT last_number FROM ${skema}.surat_number_counter WHERE scheme_id = $1`, [schemeId]);
  log(`   Pratinjau: ${pratinjau1.body.number}`);
  check('penghitung tidak bergerak', sesudahPratinjau.rows[0].last_number, sebelumPratinjau.rows[0].last_number);
  check('dua pratinjau berturut-turut sama', pratinjau1.body.number, pratinjau2.body.number);
  check('pratinjau ditandai sebagai pratinjau', pratinjau1.body.isPreview, true);
  log('');

  // -- 6. Surat masuk dan disposisi ---------------------------------------
  log('6. SURAT MASUK DAN DISPOSISI');
  const sm1 = await kirim(token, '/surat/masuk', {
    senderName: 'Dinas Perdagangan',
    senderNumber: '005/DISDAG/VII/2026',
    subject: 'Undangan sosialisasi',
  });
  const sm2 = await kirim(token, '/surat/masuk', {
    senderName: 'Dinas Koperasi',
    // Nomor pengirim yang SAMA PERSIS dari instansi berbeda.
    senderNumber: '005/DISDAG/VII/2026',
    subject: 'Pemberitahuan',
  });
  log(`   Agenda: ${sm1.body.agendaNumber} dan ${sm2.body.agendaNumber}`);
  check('nomor pengirim yang kembar tetap diterima', sm2.status, 201);
  check('nomor agenda internalnya berbeda', sm1.body.agendaNumber !== sm2.body.agendaNumber, true);

  const disp = await kirim(token, `/surat/masuk/${sm1.body.id}/disposisi`, {
    toRoleCode: `BUKTI_${jejak}`,
    instruction: 'Mohon ditindaklanjuti dan disiapkan perwakilan.',
  });
  check('disposisi tercatat', disp.status, 201);

  const tanpaTujuan = await kirim(token, `/surat/masuk/${sm1.body.id}/disposisi`, {
    instruction: 'Tanpa tujuan.',
  });
  check('disposisi tanpa tujuan ditolak', tanpaTujuan.status, 400);

  const statusSm = await client.query(
    `SELECT status FROM ${skema}.surat_incoming WHERE id = $1`, [sm1.body.id]);
  check('surat masuk berubah menjadi DIDISPOSISI', statusSm.rows[0].status, 'DIDISPOSISI');
  log('');

  // -- 7. Kapasitas penyetuju tercatat ------------------------------------
  log('7. KAPASITAS PENYETUJU TERCATAT');
  const persetujuan = await client.query(
    `SELECT step_order, decision, decided_as_role_code, due_at IS NOT NULL AS ada_sla
       FROM ${skema}.surat_approval WHERE outgoing_id = $1 ORDER BY step_order`,
    [suratId],
  );
  for (const r of persetujuan.rows) {
    log(`   Langkah ${r.step_order}: ${r.decision}, SLA ${r.ada_sla ? 'ada' : 'tidak ada'}`);
  }
  check('dua langkah tercatat', persetujuan.rows.length, 2);
  check('batas waktu SLA dihitung', persetujuan.rows[0].ada_sla, true);
  log('');

  // -- 8. Surat yang sudah terbit tidak dapat disunting -------------------
  log('8. SURAT YANG SUDAH TERBIT TIDAK DAPAT KEMBALI MENJADI KONSEP');
  const detail = await ambil(token, `/surat/keluar/${suratId}`);
  check('ditandai tidak dapat disunting', detail.body.editable, false);
  log('   Yang benar adalah membuat surat baru yang menggantikannya, sehingga');
  log('   keduanya tetap tercatat. Menyunting surat yang sudah keluar berarti');
  log('   riwayatnya berbohong.');
  log('');

  log('=========================================================================');
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('=========================================================================');
} finally {
  await bersihkan();
  await client.end();
}

writeFileSync(new URL('../../../docs/upgrade-v10-v11/bukti-v10-6-surat.txt', import.meta.url), lines.join('\n'));
process.exit(failures === 0 ? 0 : 1);
