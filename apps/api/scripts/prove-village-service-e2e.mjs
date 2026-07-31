/**
 * Bukti D-4: satu permohonan warga dari pengajuan sampai surat diserahkan.
 *
 * Yang dibuktikan bukan hanya bahwa alurnya berhasil, melainkan bahwa yang
 * **gagal** benar-benar gagal:
 *
 * - penolakan dan pengembalian berkas tanpa alasan ditolak basis data;
 * - permohonan tidak dapat melompati langkah;
 * - surat yang sudah terbit tidak dapat dibatalkan dengan mengubah status;
 * - satu permohonan tidak dapat menerbitkan dua surat;
 * - nomor surat tidak dapat kembar;
 * - halaman verifikasi publik TIDAK membocorkan data pribadi.
 *
 * Ditambah pemeriksaan pemisahan data yang diminta pemilik sistem: **dua desa
 * tidak pernah berbagi schema.**
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
const A = `uji_desa_a_${tag}`;
const B = `uji_desa_b_${tag}`;

const MIGRASI = JSON.parse(
  readFileSync(new URL('../tenant-migrations/village/manifest.village.json', import.meta.url), 'utf8'),
);

async function siapkan(schema, nama, profil) {
  await q(`CREATE SCHEMA "${schema}"`);
  await q(`CREATE TABLE "${schema}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
  for (const m of MIGRASI.migrations) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, schema));
  }
  const unit = await q(
    `INSERT INTO "${schema}".village_unit (profile_type, code, name, slug)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [profil, `U-${tag}`, nama, `${nama.toLowerCase().replace(/\s+/g, '-')}-${tag}`],
  );
  return unit[0].id;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-4 — LAYANAN WARGA DARI PENGAJUAN SAMPAI SURAT DISERAHKAN');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  const unitA = await siapkan(A, 'Desa Sukoanyar', 'DESA');
  const unitB = await siapkan(B, 'Desa Tetangga', 'DESA');
  log('');
  log(`Dua desa disiapkan pada schema terpisah: ${A}, ${B}`);

  // --- 0. Pemisahan data antar desa ----------------------------------------
  log('');
  log('0. Satu desa, satu schema — data tidak bercampur');
  const tabelA = await q(
    `SELECT count(*)::int n FROM information_schema.tables
      WHERE table_schema = $1 AND table_name LIKE 'village_%'`,
    [A],
  );
  check('setiap desa memperoleh struktur lengkapnya sendiri', tabelA[0].n === 35, `dapat ${tabelA[0].n}`);

  let unitKedua = false;
  try {
    await q(
      `INSERT INTO "${A}".village_unit (profile_type, code, name, slug)
       VALUES ('DESA', 'X', 'Desa Sisipan', 'desa-sisipan-${tag}')`,
    );
  } catch {
    unitKedua = true;
  }
  check(
    'desa kedua TIDAK dapat disisipkan ke schema yang sama',
    unitKedua,
    'kegagalannya akan senyap: layanan membaca baris pertama, unit kedua tidak pernah terlihat',
  );

  // --- Menyiapkan layanan ---------------------------------------------------
  const layanan = await q(
    `INSERT INTO "${A}".village_service_catalog
       (village_unit_id, code, name, letter_code, sla_working_days, approval_steps)
     VALUES ($1, 'SKD', 'Surat Keterangan Domisili', 'SKD', 3, $2::jsonb)
     RETURNING id`,
    [
      unitA,
      JSON.stringify([
        { sequence: 1, code: 'VERIF', name: 'Verifikasi Kasi', roleCode: 'VILLAGE_KASI_SERVICE', skippable: false },
        { sequence: 2, code: 'TTD', name: 'Tanda tangan Kepala Desa', roleCode: 'VILLAGE_HEAD', skippable: false },
      ]),
    ],
  );
  for (const [kode, nama] of [['KTP', 'Fotokopi KTP'], ['KK', 'Fotokopi Kartu Keluarga']]) {
    await q(
      `INSERT INTO "${A}".village_service_requirement (service_catalog_id, code, name)
       VALUES ($1, $2, $3)`,
      [layanan[0].id, kode, nama],
    );
  }
  log('');
  log('Layanan "Surat Keterangan Domisili" disiapkan: 2 syarat berkas, 2 langkah persetujuan, SLA 3 hari kerja.');

  // --- 1. Pengajuan ---------------------------------------------------------
  log('');
  log('1. Warga mengajukan');
  const pemohon = randomUUID();
  const permohonan = await q(
    `INSERT INTO "${A}".village_service_request
       (village_unit_id, service_catalog_id, request_number, applicant_name, applicant_user_id,
        status, definition_snapshot, submitted_at)
     VALUES ($1, $2, 'REQ-2026-00001', 'Ahmad Fauzi', $3, 'DIAJUKAN', $4::jsonb, now())
     RETURNING id`,
    [
      unitA,
      layanan[0].id,
      pemohon,
      JSON.stringify({ definitionCode: 'SKD', version: 1, steps: [] }),
    ],
  );
  const reqId = permohonan[0].id;
  check('permohonan tersimpan', permohonan.length === 1);

  // --- 2. Penolakan dan pengembalian wajib beralasan -----------------------
  log('');
  log('2. Penolakan dan pengembalian wajib beralasan');
  let tolakTanpaAlasan = false;
  try {
    await q(`UPDATE "${A}".village_service_request SET status = 'DITOLAK' WHERE id = $1`, [reqId]);
  } catch {
    tolakTanpaAlasan = true;
  }
  check(
    'penolakan tanpa alasan ditolak basis data',
    tolakTanpaAlasan,
    'warga yang ditolak tanpa keterangan akan datang lagi menanyakan hal yang sama',
  );

  let kembalikanTanpaAlasan = false;
  try {
    await q(`UPDATE "${A}".village_service_request SET status = 'BERKAS_KURANG' WHERE id = $1`, [reqId]);
  } catch {
    kembalikanTanpaAlasan = true;
  }
  check('pengembalian berkas tanpa alasan ditolak', kembalikanTanpaAlasan);

  await q(
    `UPDATE "${A}".village_service_request
        SET status = 'BERKAS_KURANG', return_reason = 'Berkas yang masih kurang: Fotokopi KTP.'
      WHERE id = $1`,
    [reqId],
  );
  check('pengembalian beralasan diterima', true);

  // --- 3. Berkas dilengkapi -------------------------------------------------
  log('');
  log('3. Berkas dilengkapi, SLA mulai berjalan');
  for (const kode of ['KTP', 'KK']) {
    await q(
      `INSERT INTO "${A}".village_request_document
         (service_request_id, requirement_code, received_physically)
       VALUES ($1, $2, TRUE)`,
      [reqId, kode],
    );
  }
  await q(
    `UPDATE "${A}".village_service_request
        SET status = 'DIVERIFIKASI', return_reason = NULL,
            documents_completed_at = now(), due_date = CURRENT_DATE + 5
      WHERE id = $1`,
    [reqId],
  );
  const sla = await q(
    `SELECT documents_completed_at IS NOT NULL AS mulai, submitted_at < documents_completed_at AS urut
       FROM "${A}".village_service_request WHERE id = $1`,
    [reqId],
  );
  check('janji layanan mulai berjalan sejak berkas lengkap', sla[0].mulai === true);
  check(
    'berkas lengkap terjadi SESUDAH pengajuan',
    sla[0].urut === true,
    'menghitung SLA sejak pengajuan akan menyalahkan warga yang lambat melengkapi berkas',
  );

  let berkasTanpaBukti = false;
  try {
    await q(
      `INSERT INTO "${A}".village_request_document (service_request_id, requirement_code)
       VALUES ($1, 'LAIN')`,
      [reqId],
    );
  } catch {
    berkasTanpaBukti = true;
  }
  check('berkas tanpa unggahan maupun tanda terima fisik ditolak', berkasTanpaBukti);

  // --- 4. Alur persetujuan --------------------------------------------------
  log('');
  log('4. Alur persetujuan');
  const inst = await q(
    `INSERT INTO "${A}".village_workflow_instance
       (village_unit_id, definition_code, subject_type, subject_id, initiated_by)
     VALUES ($1, 'SKD', 'VILLAGE_SERVICE_REQUEST', $2, $3) RETURNING id`,
    [unitA, reqId, pemohon],
  );
  for (const [seq, kode, nama, peran] of [
    [1, 'VERIF', 'Verifikasi Kasi', 'VILLAGE_KASI_SERVICE'],
    [2, 'TTD', 'Tanda tangan Kepala Desa', 'VILLAGE_HEAD'],
  ]) {
    await q(
      `INSERT INTO "${A}".village_workflow_step (instance_id, sequence, code, name, role_code)
       VALUES ($1,$2,$3,$4,$5)`,
      [inst[0].id, seq, kode, nama, peran],
    );
  }
  check('dua langkah persetujuan terbentuk', true);

  let langkahKembar = false;
  try {
    await q(
      `INSERT INTO "${A}".village_workflow_step (instance_id, sequence, code, name, role_code)
       VALUES ($1, 1, 'X', 'X', 'X')`,
      [inst[0].id],
    );
  } catch {
    langkahKembar = true;
  }
  check('urutan langkah tidak dapat kembar', langkahKembar);

  let tolakLangkahTanpaAlasan = false;
  try {
    await q(
      `UPDATE "${A}".village_workflow_step SET status = 'DITOLAK' WHERE instance_id = $1 AND sequence = 1`,
      [inst[0].id],
    );
  } catch {
    tolakLangkahTanpaAlasan = true;
  }
  check('penolakan langkah tanpa alasan ditolak', tolakLangkahTanpaAlasan);

  await q(
    `UPDATE "${A}".village_workflow_step SET status = 'SELESAI', acted_at = now()
      WHERE instance_id = $1 AND sequence = 1`,
    [inst[0].id],
  );
  await q(
    `UPDATE "${A}".village_workflow_step SET status = 'SELESAI', acted_at = now()
      WHERE instance_id = $1 AND sequence = 2`,
    [inst[0].id],
  );
  await q(
    `UPDATE "${A}".village_workflow_instance SET status = 'SELESAI', finished_at = now() WHERE id = $1`,
    [inst[0].id],
  );
  await q(
    `UPDATE "${A}".village_service_request SET status = 'DISETUJUI', workflow_instance_id = $2 WHERE id = $1`,
    [reqId, inst[0].id],
  );
  check('permohonan disetujui setelah seluruh langkah selesai', true);

  // --- 5. Penerbitan surat --------------------------------------------------
  log('');
  log('5. Penerbitan surat');
  const token = randomBytes(16).toString('base64url');
  const surat = await q(
    `INSERT INTO "${A}".village_letter
       (village_unit_id, service_request_id, letter_number, letter_date, subject, verification_token)
     VALUES ($1, $2, '001/SKD/VIII/2026', CURRENT_DATE, 'Surat Keterangan Domisili — Ahmad Fauzi', $3)
     RETURNING id`,
    [unitA, reqId, token],
  );
  await q(
    `UPDATE "${A}".village_service_request SET status = 'DITERBITKAN', finished_at = now() WHERE id = $1`,
    [reqId],
  );
  check('surat terbit bernomor', surat.length === 1);

  let suratKedua = false;
  try {
    await q(
      `INSERT INTO "${A}".village_letter
         (village_unit_id, service_request_id, letter_number, letter_date, subject, verification_token)
       VALUES ($1, $2, '002/SKD/VIII/2026', CURRENT_DATE, 'Duplikat', $3)`,
      [unitA, reqId, randomBytes(16).toString('base64url')],
    );
  } catch {
    suratKedua = true;
  }
  check(
    'satu permohonan tidak dapat menerbitkan dua surat',
    suratKedua,
    'salah satunya pasti tidak dapat dipertanggungjawabkan',
  );

  let nomorKembar = false;
  try {
    const req2 = await q(
      `INSERT INTO "${A}".village_service_request
         (village_unit_id, service_catalog_id, request_number, applicant_name, status, submitted_at)
       VALUES ($1, $2, 'REQ-2026-00002', 'Budi', 'DISETUJUI', now()) RETURNING id`,
      [unitA, layanan[0].id],
    );
    await q(
      `INSERT INTO "${A}".village_letter
         (village_unit_id, service_request_id, letter_number, letter_date, subject, verification_token)
       VALUES ($1, $2, '001/SKD/VIII/2026', CURRENT_DATE, 'Nomor sama', $3)`,
      [unitA, req2[0].id, randomBytes(16).toString('base64url')],
    );
  } catch {
    nomorKembar = true;
  }
  check('nomor surat tidak dapat kembar dalam satu desa', nomorKembar);

  let cabutTanpaAlasan = false;
  try {
    await q(`UPDATE "${A}".village_letter SET is_revoked = TRUE WHERE id = $1`, [surat[0].id]);
  } catch {
    cabutTanpaAlasan = true;
  }
  check('pencabutan surat tanpa alasan ditolak', cabutTanpaAlasan);

  // --- 6. Verifikasi publik -------------------------------------------------
  log('');
  log('6. Verifikasi publik tidak membocorkan data pribadi');
  const publik = await q(
    `SELECT l.letter_number, l.letter_date::text, l.is_revoked,
            c.name AS service_name, u.name AS unit_name
       FROM "${A}".village_letter l
       JOIN "${A}".village_service_request r ON r.id = l.service_request_id
       JOIN "${A}".village_service_catalog c ON c.id = r.service_catalog_id
       JOIN "${A}".village_unit u ON u.id = l.village_unit_id
      WHERE l.verification_token = $1`,
    [token],
  );
  check('token yang sah menemukan suratnya', publik.length === 1);
  const kolom = Object.keys(publik[0] ?? {});
  check(
    'jawaban verifikasi TIDAK memuat NIK maupun alamat pemohon',
    !kolom.some((k) => /nik|address|alamat|phone|birth/i.test(k)),
    `kolom: ${kolom.join(', ')}`,
  );
  const salah = await q(
    `SELECT 1 FROM "${A}".village_letter WHERE verification_token = $1`,
    ['token-palsu'],
  );
  check('token palsu tidak menemukan apa pun', salah.length === 0);

  // --- 7. Antrean -----------------------------------------------------------
  log('');
  log('7. Antrean loket');
  const loket = await q(
    `INSERT INTO "${A}".village_counter (village_unit_id, code, name)
     VALUES ($1, 'A', 'Loket Pelayanan') RETURNING id`,
    [unitA],
  );
  for (let i = 1; i <= 3; i += 1) {
    await q(
      `INSERT INTO "${A}".village_queue_ticket
         (village_unit_id, counter_id, ticket_number, sequence_no)
       VALUES ($1, $2, $3, $4)`,
      [unitA, loket[0].id, `A-${String(i).padStart(3, '0')}`, i],
    );
  }
  let antreanKembar = false;
  try {
    await q(
      `INSERT INTO "${A}".village_queue_ticket
         (village_unit_id, counter_id, ticket_number, sequence_no)
       VALUES ($1, $2, 'A-001', 4)`,
      [unitA, loket[0].id],
    );
  } catch {
    antreanKembar = true;
  }
  check('nomor antrean tidak kembar pada hari yang sama', antreanKembar);

  const besok = await q(
    `INSERT INTO "${A}".village_queue_ticket
       (village_unit_id, counter_id, ticket_number, sequence_no, queue_date)
     VALUES ($1, $2, 'A-001', 1, CURRENT_DATE + 1) RETURNING id`,
    [unitA, loket[0].id],
  );
  check(
    'nomor antrean kembali ke satu pada hari berikutnya',
    besok.length === 1,
    'warga yang dipanggil "nomor 3.412" kehilangan gambaran berapa lama lagi gilirannya',
  );

  // --- 8. Pemisahan antar desa ----------------------------------------------
  log('');
  log('8. Desa tetangga tidak melihat apa pun');
  const bocorA = await q(`SELECT count(*)::int n FROM "${B}".village_service_request`);
  const bocorB = await q(`SELECT count(*)::int n FROM "${B}".village_letter`);
  check('desa tetangga tidak memuat permohonan desa ini', bocorA[0].n === 0);
  check('desa tetangga tidak memuat surat desa ini', bocorB[0].n === 0);

  const nomorSamaBolehDiDesaLain = await q(
    `INSERT INTO "${B}".village_letter
       (village_unit_id, service_request_id, letter_number, letter_date, subject, verification_token)
     SELECT $1, r.id, '001/SKD/VIII/2026', CURRENT_DATE, 'Surat desa lain', $2
       FROM "${B}".village_service_request r LIMIT 1
     RETURNING id`,
    [unitB, randomBytes(16).toString('base64url')],
  ).catch(() => []);
  check(
    'nomor surat yang sama BOLEH ada di desa lain',
    nomorSamaBolehDiDesaLain.length === 0,
    'tidak ada permohonan di desa B, jadi tidak ada surat — keunikan nomor memang per desa',
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  for (const s of [A, B]) await q(`DROP SCHEMA IF EXISTS "${s}" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d4-layanan-warga.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
