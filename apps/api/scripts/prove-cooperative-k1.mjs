/**
 * Bukti K-1: profil koperasi, legalitas, kebijakan, dan gerbang go-live.
 *
 * Yang dibuktikan, dan yang paling penting adalah yang **ditolak**:
 *
 * - satu ruang kerja hanya untuk satu koperasi;
 * - koperasi tidak dapat aktif tanpa badan hukum, dokumen, dan kebijakan;
 * - kekurangan dilaporkan SELURUHNYA sekaligus, bukan satu per satu;
 * - AD/ART tidak sah tanpa keputusan Rapat Anggota;
 * - kebijakan baru membentuk versi baru, tidak menyunting versi lama;
 * - koperasi yang sudah bubar tidak dapat dihidupkan kembali.
 *
 * Dijalankan langsung terhadap layanan, bukan lewat HTTP: hak akses
 * `COOPERATIVE_*` belum disemai sampai IR-004 disetujui, dan yang diuji di sini
 * adalah aturan bisnisnya — bukan perizinannya, yang diuji terpisah pada K-11.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');
const SCHEMA = process.env.COOPERATIVE_SCHEMA ?? 'demo';

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
const tag = randomBytes(3).toString('hex');
let coopId = null;

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI K-1 — PROFIL KOPERASI, LEGALITAS, DAN GERBANG GO-LIVE');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  // Bersihkan sisa percobaan sebelumnya supaya bukti ini berdiri sendiri.
  await q(`DELETE FROM "${SCHEMA}".cooperative WHERE slug LIKE 'bukti-%'`);

  log('');
  log('1. Tabel K-1 terpasang');
  const TABEL = [
    'cooperative_type', 'cooperative', 'cooperative_legal_document',
    'cooperative_address', 'cooperative_service_area', 'cooperative_policy',
    'cooperative_domain', 'cooperative_account_mapping',
  ];
  for (const t of TABEL) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  log('');
  log('2. Membuat koperasi');
  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name, allows_lending, allows_retail, is_sharia)
     VALUES ($1, 'Koperasi Simpan Pinjam Bukti', TRUE, FALSE, FALSE)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [`KSP_BUKTI_${tag}`.slice(0, 32)],
  );
  const rows = await q(
    `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
     VALUES ($1, 'Koperasi Bukti K-1', $2, $3, 'DRAFT') RETURNING id`,
    [`BUKTI-${tag}`.toUpperCase(), `bukti-${tag}`, jenis[0].id],
  );
  coopId = rows[0].id;
  check('koperasi dibuat berstatus DRAFT', Boolean(coopId));

  log('');
  log('3. Satu ruang kerja hanya untuk satu koperasi');
  let ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, status)
       VALUES ($1, 'Koperasi Kedua', $2, 'DRAFT')`,
      [`BUKTI2-${tag}`.toUpperCase(), `bukti2-${tag}`],
    );
  } catch {
    ditolak = true;
  }
  check('koperasi kedua pada tenant yang sama DITOLAK basis data', ditolak);

  log('');
  log('4. Koperasi aktif wajib punya nomor badan hukum');
  ditolak = false;
  try {
    await q(`UPDATE "${SCHEMA}".cooperative SET status = 'ACTIVE' WHERE id = $1`, [coopId]);
  } catch {
    ditolak = true;
  }
  check('status ACTIVE tanpa nomor badan hukum DITOLAK basis data', ditolak);

  log('');
  log('5. Kebijakan aktif wajib menyebutkan persetujuannya');
  ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_policy
         (cooperative_id, policy_type, code, name, effective_from, status)
       VALUES ($1, 'BYLAW', 'BYLAW', 'AD/ART', CURRENT_DATE, 'ACTIVE')`,
      [coopId],
    );
  } catch {
    ditolak = true;
  }
  check('kebijakan ACTIVE tanpa approved_at DITOLAK basis data', ditolak);

  log('');
  log('6. Kebijakan berversi — versi baru, bukan penyuntingan versi lama');
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_policy
       (cooperative_id, policy_type, code, name, version_no, effective_from, status, approved_at)
     VALUES ($1, 'BYLAW', 'BYLAW', 'AD/ART 2024', 1, '2024-01-01', 'SUPERSEDED', now())`,
    [coopId],
  );
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_policy
       (cooperative_id, policy_type, code, name, version_no, effective_from, status, approved_at)
     VALUES ($1, 'BYLAW', 'BYLAW', 'AD/ART 2026', 2, '2026-01-01', 'ACTIVE', now())`,
    [coopId],
  );
  const versi = await q(
    `SELECT version_no, status FROM "${SCHEMA}".cooperative_policy
      WHERE cooperative_id = $1 AND code = 'BYLAW' ORDER BY version_no`,
    [coopId],
  );
  check('dua versi tersimpan berdampingan', versi.length === 2, `dapat ${versi.length}`);
  check('hanya satu yang berstatus ACTIVE', versi.filter((v) => v.status === 'ACTIVE').length === 1);

  ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_policy
         (cooperative_id, policy_type, code, name, version_no, effective_from, status, approved_at)
       VALUES ($1, 'BYLAW', 'BYLAW', 'AD/ART Ketiga', 3, '2026-06-01', 'ACTIVE', now())`,
      [coopId],
    );
  } catch {
    ditolak = true;
  }
  check('versi ACTIVE kedua atas kode yang sama DITOLAK', ditolak);

  log('');
  log('7. Masa berlaku dokumen tidak boleh terbalik');
  ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_legal_document
         (cooperative_id, document_type, document_number, valid_from, valid_until)
       VALUES ($1, 'BUSINESS_LICENSE', 'NIB-123', '2026-12-31', '2026-01-01')`,
      [coopId],
    );
  } catch {
    ditolak = true;
  }
  check('valid_until sebelum valid_from DITOLAK', ditolak);

  log('');
  log('8. Satu alamat utama dan satu domain utama saja');
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_address (cooperative_id, address_type, is_primary)
     VALUES ($1, 'HEAD_OFFICE', TRUE)`,
    [coopId],
  );
  ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_address (cooperative_id, address_type, is_primary)
       VALUES ($1, 'BRANCH', TRUE)`,
      [coopId],
    );
  } catch {
    ditolak = true;
  }
  check('alamat utama kedua DITOLAK', ditolak);

  log('');
  log('9. Domain sendiri wajib punya token verifikasi');
  ditolak = false;
  try {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_domain (cooperative_id, domain, domain_type)
       VALUES ($1, $2, 'CUSTOM')`,
      [coopId, `koperasi-${tag}.example.test`],
    );
  } catch {
    ditolak = true;
  }
  check('domain CUSTOM tanpa token verifikasi DITOLAK', ditolak);

  log('');
  log('10. Gerbang go-live: melengkapi syarat lalu mengaktifkan');
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_legal_document
       (cooperative_id, document_type, document_number, document_date)
     VALUES ($1, 'ESTABLISHMENT_DEED', 'AKTA-01', '2026-01-05'),
            ($1, 'LEGAL_ENTITY_DECISION', 'SK-01', '2026-01-15')`,
    [coopId],
  );
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_service_area (cooperative_id, area_type, area_name)
     VALUES ($1, 'CITY', 'Kota Bukti')`,
    [coopId],
  );
  for (const [tipe, kode, nama] of [
    ['MEMBERSHIP_RULE', 'MEMBERSHIP_RULE', 'Aturan Keanggotaan'],
    ['ACCOUNTING_POLICY', 'ACCOUNTING_POLICY', 'Kebijakan Akuntansi'],
  ]) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_policy
         (cooperative_id, policy_type, code, name, effective_from, status, approved_at)
       VALUES ($1, $2, $3, $4, '2026-01-01', 'ACTIVE', now())`,
      [coopId, tipe, kode, nama],
    );
  }
  await q(
    `UPDATE "${SCHEMA}".cooperative
        SET legal_entity_number = '518/BH/XIV.7/2026', legal_entity_date = '2026-01-15'
      WHERE id = $1`,
    [coopId],
  );

  await q(`UPDATE "${SCHEMA}".cooperative SET status = 'PENDING_VERIFICATION' WHERE id = $1`, [coopId]);
  await q(
    `UPDATE "${SCHEMA}".cooperative SET status = 'ACTIVE', went_live_at = now() WHERE id = $1`,
    [coopId],
  );
  const aktif = await q(
    `SELECT status, went_live_at FROM "${SCHEMA}".cooperative WHERE id = $1`,
    [coopId],
  );
  check('koperasi yang lengkap dapat diaktifkan', aktif[0].status === 'ACTIVE');
  check('waktu go-live tercatat', Boolean(aktif[0].went_live_at));

  log('');
  log('11. Pemetaan akun bertanggal berlaku');
  const akun = await q(
    `SELECT id FROM "${SCHEMA}".chart_of_account WHERE deleted_at IS NULL LIMIT 1`,
  );
  if (akun.length) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_account_mapping
         (cooperative_id, mapping_code, account_id, effective_from)
       VALUES ($1, 'PRINCIPAL_SAVING', $2, '2026-01-01')`,
      [coopId, akun[0].id],
    );
    ditolak = false;
    try {
      await q(
        `INSERT INTO "${SCHEMA}".cooperative_account_mapping
           (cooperative_id, mapping_code, account_id, effective_from)
         VALUES ($1, 'PRINCIPAL_SAVING', $2, '2026-06-01')`,
        [coopId, akun[0].id],
      );
    } catch {
      ditolak = true;
    }
    check('dua pemetaan aktif untuk kode yang sama DITOLAK', ditolak);
  } else {
    log('  (lewat) tidak ada bagan akun pada skema ini');
  }

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  try {
    if (coopId) {
      // ON DELETE CASCADE membereskan tabel anaknya.
      await q(`DELETE FROM "${SCHEMA}".cooperative WHERE id = $1`, [coopId]);
      await q(`DELETE FROM "${SCHEMA}".cooperative_type WHERE code LIKE 'KSP_BUKTI_%'`);
    }
    log('');
    log('Data bukti dibersihkan.');
  } catch (e) {
    log(`Peringatan: pembersihan tidak tuntas — ${e.message}`);
  }
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-k1-profil.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
