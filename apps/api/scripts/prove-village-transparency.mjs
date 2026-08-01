/**
 * Bukti D-11: PPID, transparansi, dan laporan.
 *
 * Yang dibuktikan, seluruhnya pada basis data:
 *
 * 1. **Ambang penyajian tidak dapat diturunkan setelah laporan terbit.**
 *    Ditegakkan constraint beserta pemicu — bukan pemeriksaan layanan, yang
 *    dapat dilewati jalur impor maupun penyuntingan langsung.
 * 2. **Laporan yang masih dapat dibongkar tidak dapat tersimpan sebagai
 *    terbit.** Satu sel tertekan sendirian bersama total yang tayang dapat
 *    dihitung dengan pengurangan.
 * 3. **Pengecualian informasi wajib bertanggal**, berdasar hukum, dan beruji
 *    konsekuensi — ketiganya.
 * 4. **Penolakan permohonan wajib menyebut cara mengajukan keberatan.**
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const url = bacaEnv('DATABASE_URL');
const client = new pg.Client({ connectionString: url });

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
const S = `uji_d11_${tag}`;

async function ditolak(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-11 — PPID, TRANSPARANSI, DAN LAPORAN');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE SCHEMA "${S}__audit"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
  await q(`CREATE TABLE "${S}__audit".audit_log (
    id BIGSERIAL PRIMARY KEY, table_name TEXT, operation TEXT, at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE FUNCTION "${S}__audit".audit_row_trigger() RETURNS trigger AS $fn$
    BEGIN
      INSERT INTO "${S}__audit".audit_log (table_name, operation) VALUES (TG_TABLE_NAME, TG_OP);
      RETURN COALESCE(NEW, OLD);
    END $fn$ LANGUAGE plpgsql`);

  const manifest = JSON.parse(
    readFileSync(new URL('../tenant-migrations/village/manifest.village.json', import.meta.url), 'utf8'),
  );
  for (const m of manifest.migrations) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S).replace(/\{\{AUDIT_SCHEMA\}\}/g, `${S}__audit`));
  }

  const unit = await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug)
     VALUES ('DESA', 'U1', 'Desa Uji', 'desa-uji-${tag}') RETURNING id`,
  );
  const unitId = unit[0].id;

  // --- 1. Migrasi -----------------------------------------------------------
  log('');
  log('1. Migrasi D-11');
  const baru = [
    'village_disclosure_policy', 'village_information_item', 'village_information_request',
    'village_information_objection', 'village_report_publication',
  ];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check('lima tabel D-11 terbentuk', ada.length === baru.length, `${ada.length}/${baru.length}`);

  const pemicu = await q(
    `SELECT c.relname AS t FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT g.tgisinternal AND g.tgname LIKE 'trg_audit_%'
        AND c.relname = ANY($2)`,
    [S, baru],
  );
  check('pemicu audit terpasang pada tabel D-11', pemicu.length >= 5, `${pemicu.length} tabel`);

  // --- 2. Ambang penyajian --------------------------------------------------
  log('');
  log('2. Ambang penyajian tidak dapat diturunkan setelah laporan terbit');
  await q(
    `INSERT INTO "${S}".village_disclosure_policy (village_unit_id, threshold)
     VALUES ($1, 5)`,
    [unitId],
  );

  const ambangSatu = await ditolak(() =>
    q(`UPDATE "${S}".village_disclosure_policy SET threshold = 1 WHERE village_unit_id = $1`, [
      unitId,
    ]),
  );
  check('ambang satu ditolak', ambangSatu !== null, 'tidak menyembunyikan apa pun');

  await q(`UPDATE "${S}".village_disclosure_policy SET threshold = 3 WHERE village_unit_id = $1`, [
    unitId,
  ]);
  check('ambang boleh diturunkan selama belum ada laporan terbit', true);

  await q(`UPDATE "${S}".village_disclosure_policy SET threshold = 5 WHERE village_unit_id = $1`, [
    unitId,
  ]);
  await q(
    `INSERT INTO "${S}".village_report_publication
       (village_unit_id, report_code, title, period, threshold_used, suppressed_cells,
        hidden_count, total_shown, payload)
     VALUES ($1, 'PENDUDUK-RT', 'Penduduk per RT', '2027', 5, 2, 7, TRUE, '{"sel":[]}'::jsonb)`,
    [unitId],
  );

  const lantai = await q(
    `SELECT published_threshold_floor::int AS f FROM "${S}".village_disclosure_policy
      WHERE village_unit_id = $1`,
    [unitId],
  );
  check(
    'pemicu menaikkan lantai ambang saat laporan terbit',
    lantai[0].f === 5,
    `lantai sekarang ${lantai[0].f}`,
  );

  const turunkan = await ditolak(() =>
    q(`UPDATE "${S}".village_disclosure_policy SET threshold = 3 WHERE village_unit_id = $1`, [
      unitId,
    ]),
  );
  check(
    'ambang TIDAK dapat diturunkan setelah laporan terbit',
    turunkan !== null,
    'sel yang tadinya ditekan akan terbuka bagi siapa pun yang menyimpan versi sebelumnya',
  );

  await q(`UPDATE "${S}".village_disclosure_policy SET threshold = 8 WHERE village_unit_id = $1`, [
    unitId,
  ]);
  check('ambang tetap boleh dinaikkan', true);

  // --- 3. Laporan yang dapat dibongkar --------------------------------------
  log('');
  log('3. Laporan yang masih dapat dibongkar tidak dapat tersimpan');
  const satuSel = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_report_publication
         (village_unit_id, report_code, title, period, threshold_used, suppressed_cells,
          hidden_count, total_shown, payload)
       VALUES ($1, 'BANTUAN-RT', 'Penerima bantuan per RT', '2027', 5, 1, 3, TRUE, '{}'::jsonb)`,
      [unitId],
    ),
  );
  check(
    'satu sel tertekan sendirian bersama total yang tayang DITOLAK',
    satuSel !== null,
    'nilainya dapat dihitung dengan pengurangan',
  );

  const satuSelTanpaTotal = await q(
    `INSERT INTO "${S}".village_report_publication
       (village_unit_id, report_code, title, period, threshold_used, suppressed_cells,
        hidden_count, total_shown, payload)
     VALUES ($1, 'BANTUAN-RT', 'Penerima bantuan per RT', '2027', 8, 1, 3, FALSE, '{}'::jsonb)
     RETURNING id`,
    [unitId],
  );
  check(
    'satu sel tertekan tanpa total yang tayang diterima',
    satuSelTanpaTotal.length === 1,
    'tanpa total, tidak ada yang dapat menghitungnya',
  );

  const ambangTakMasukAkal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_report_publication
         (village_unit_id, report_code, title, period, threshold_used, payload)
       VALUES ($1, 'X', 'X', '2027', 1, '{}'::jsonb)`,
      [unitId],
    ),
  );
  check('laporan dengan ambang satu ditolak', ambangTakMasukAkal !== null);

  const tarikTanpaAlasan = await ditolak(() =>
    q(`UPDATE "${S}".village_report_publication SET withdrawn_at = now() WHERE id = $1`, [
      satuSelTanpaTotal[0].id,
    ]),
  );
  check('penarikan laporan tanpa alasan ditolak', tarikTanpaAlasan !== null);

  // --- 4. Pengecualian informasi --------------------------------------------
  log('');
  log('4. Pengecualian informasi wajib lengkap');
  const tanpaTanggal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_information_item
         (village_unit_id, code, title, classification, exemption_basis, exemption_consequence)
       VALUES ($1, 'DIP-01', 'Data pelapor pengaduan', 'DIKECUALIKAN', 'Pasal 17 huruf h',
               'Membuka data ini mengungkap identitas pelapor yang masih diproses.')`,
      [unitId],
    ),
  );
  check(
    'pengecualian tanpa batas waktu DITOLAK',
    tanpaTanggal !== null,
    'kerahasiaan permanen yang ditetapkan diam-diam',
  );

  const tanpaKonsekuensi = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_information_item
         (village_unit_id, code, title, classification, exemption_basis, exemption_consequence,
          exemption_until)
       VALUES ($1, 'DIP-01', 'Data pelapor', 'DIKECUALIKAN', 'Pasal 17 huruf h', 'rahasia',
               '2029-12-31')`,
      [unitId],
    ),
  );
  check(
    'pengecualian tanpa uji konsekuensi ditolak',
    tanpaKonsekuensi !== null,
    'penolakan yang diberi nama lain',
  );

  const kecuali = await q(
    `INSERT INTO "${S}".village_information_item
       (village_unit_id, code, title, classification, exemption_basis, exemption_consequence,
        exemption_until)
     VALUES ($1, 'DIP-01', 'Data pelapor pengaduan', 'DIKECUALIKAN', 'Pasal 17 huruf h UU 14/2008',
             'Membuka data ini mengungkap identitas pelapor pengaduan yang masih diproses.',
             '2029-12-31') RETURNING id`,
    [unitId],
  );
  check('pengecualian yang lengkap diterima', kecuali.length === 1);

  const kecualiTayang = await ditolak(() =>
    q(`UPDATE "${S}".village_information_item SET is_published = TRUE WHERE id = $1`, [
      kecuali[0].id,
    ]),
  );
  check('informasi yang dikecualikan tidak dapat ditayangkan', kecualiTayang !== null);

  const sisaPengecualian = await ditolak(() =>
    q(
      `UPDATE "${S}".village_information_item SET classification = 'SETIAP_SAAT' WHERE id = $1`,
      [kecuali[0].id],
    ),
  );
  check(
    'penggolongan ulang tanpa membersihkan sisa alasan pengecualian ditolak',
    sisaPengecualian !== null,
    'sisa isian akan terbaca sebagai pengecualian yang masih berlaku',
  );

  await q(
    `UPDATE "${S}".village_information_item
        SET classification = 'SETIAP_SAAT', exemption_basis = NULL,
            exemption_consequence = NULL, exemption_until = NULL
      WHERE id = $1`,
    [kecuali[0].id],
  );
  check('penggolongan ulang yang membersihkan sisanya diterima', true);

  // --- 5. Permohonan informasi ----------------------------------------------
  log('');
  log('5. Penolakan wajib menyebut cara mengajukan keberatan');
  const mohon = await q(
    `INSERT INTO "${S}".village_information_request
       (village_unit_id, request_number, applicant_name, requested_information, received_at, due_at)
     VALUES ($1, 'PPID/2027/031', 'Sumiati', 'Laporan realisasi APBDes 2026',
             '2027-03-01', '2027-03-15') RETURNING id`,
    [unitId],
  );
  check('permohonan tersimpan beserta tenggatnya', mohon.length === 1);

  const kolomMohon = (
    await q(
      `SELECT column_name, is_nullable FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_information_request'
          AND column_name = 'purpose'`,
      [S],
    )
  )[0];
  check(
    'alasan permohonan TIDAK diwajibkan',
    kolomMohon?.is_nullable === 'YES',
    'hak atas informasi publik tidak bergantung pada keperluan pemohon',
  );

  const tolakTanpaKeberatan = await ditolak(() =>
    q(
      `UPDATE "${S}".village_information_request
          SET status = 'DITOLAK', answered_at = CURRENT_DATE,
              refusal_basis = 'Pasal 17 huruf h UU 14/2008',
              refusal_detail = 'Informasi memuat data pribadi warga lain yang tidak memberi izin.'
        WHERE id = $1`,
      [mohon[0].id],
    ),
  );
  check(
    'penolakan tanpa cara mengajukan keberatan DITOLAK',
    tolakTanpaKeberatan !== null,
    'hak itu dihapus tanpa ada yang menghapusnya',
  );

  await q(
    `UPDATE "${S}".village_information_request
        SET status = 'DITOLAK', answered_at = CURRENT_DATE,
            refusal_basis = 'Pasal 17 huruf h UU 14/2008',
            refusal_detail = 'Informasi memuat data pribadi warga lain yang tidak memberi izin.',
            objection_guidance = 'Keberatan diajukan kepada Atasan PPID paling lambat 30 hari kerja.'
      WHERE id = $1`,
    [mohon[0].id],
  );
  check('penolakan yang lengkap diterima', true);

  const perpanjangTanpaAlasan = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_information_request
         (village_unit_id, request_number, applicant_name, requested_information, received_at,
          due_at, extended)
       VALUES ($1, 'PPID/2027/032', 'Karto', 'Data aset desa', '2027-03-01', '2027-03-22', TRUE)`,
      [unitId],
    ),
  );
  check('perpanjangan tanpa alasan ditolak', perpanjangTanpaAlasan !== null);

  const tenggatTerbalik = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_information_request
         (village_unit_id, request_number, applicant_name, requested_information, received_at, due_at)
       VALUES ($1, 'PPID/2027/033', 'Uji', 'Uji', '2027-03-10', '2027-03-01')`,
      [unitId],
    ),
  );
  check('tenggat yang mendahului tanggal terima ditolak', tenggatTerbalik !== null);

  // --- 6. Keberatan ---------------------------------------------------------
  log('');
  log('6. Keberatan');
  const keberatan = await q(
    `INSERT INTO "${S}".village_information_objection
       (village_unit_id, information_request_id, objection_number, reason, filed_at, due_at)
     VALUES ($1, $2, 'KBR/2027/004', 'Informasi yang diminta bukan data pribadi siapa pun.',
             '2027-03-20', '2027-05-04') RETURNING id`,
    [unitId, mohon[0].id],
  );
  check('keberatan tersimpan', keberatan.length === 1);

  const keberatanKedua = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_information_objection
         (village_unit_id, information_request_id, objection_number, reason, filed_at, due_at)
       VALUES ($1, $2, 'KBR/2027/005', 'Keberatan kedua.', '2027-03-21', '2027-05-05')`,
      [unitId, mohon[0].id],
    ),
  );
  check('satu permohonan hanya punya satu keberatan yang berjalan', keberatanKedua !== null);

  const putusTanpaPertimbangan = await ditolak(() =>
    q(
      `UPDATE "${S}".village_information_objection
          SET decided_at = CURRENT_DATE, decision = 'DITOLAK' WHERE id = $1`,
      [keberatan[0].id],
    ),
  );
  check(
    'putusan keberatan tanpa pertimbangan ditolak',
    putusTanpaPertimbangan !== null,
    'putusan tanpa pertimbangan tidak dapat diuji siapa pun',
  );

  await q(
    `UPDATE "${S}".village_information_objection
        SET decided_at = CURRENT_DATE, decision = 'DIKABULKAN',
            decision_note = 'Informasi yang diminta memang bukan data pribadi; permohonan dipenuhi.'
      WHERE id = $1`,
    [keberatan[0].id],
  );
  const keberatanBaru = await q(
    `INSERT INTO "${S}".village_information_objection
       (village_unit_id, information_request_id, objection_number, reason, filed_at, due_at)
     VALUES ($1, $2, 'KBR/2027/006', 'Keberatan susulan.', '2027-06-01', '2027-07-15')
     RETURNING id`,
    [unitId, mohon[0].id],
  );
  check(
    'setelah yang lama diputus, keberatan baru dapat diajukan',
    keberatanBaru.length === 1,
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await q(`DROP SCHEMA IF EXISTS "${S}" CASCADE`).catch(() => {});
  await q(`DROP SCHEMA IF EXISTS "${S}__audit" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d11-transparansi.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
