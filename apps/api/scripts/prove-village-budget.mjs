/**
 * Bukti D-6: belanja melampaui pagu ditolak basis data.
 *
 * Pada APBDes, belanja melampaui pagu adalah **pelanggaran** — bukan keputusan
 * yang boleh diambil dengan menekan "lanjutkan". Yang dibuktikan di sini bukan
 * bahwa layanan memeriksanya, melainkan bahwa **basis data menolaknya**:
 * pemeriksaan layanan dapat dilewati jalan kode berikutnya, constraint tidak.
 *
 * Termasuk keadaan yang paling sulit ditangkap layanan: **dua ikatan yang
 * diproses bersamaan**, yang tanpa penguncian akan sama-sama membaca sisa pagu
 * yang sama dan keduanya lolos.
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
const S = `uji_d6_${tag}`;
const juta = (n) => n * 1_000_000;

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-6 — PENEGAKAN PAGU APBDes');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
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

  // --- 1. RPJM dan RKP -----------------------------------------------------
  log('');
  log('1. Perencanaan');
  const rpjm = await q(
    `INSERT INTO "${S}".village_rpjm (village_unit_id, start_year, end_year, title)
     VALUES ($1, 2025, 2030, 'RPJM Desa 2025-2030') RETURNING id`,
    [unitId],
  );
  check('RPJM Desa enam tahun tersimpan', rpjm.length === 1);

  let periodeGila = false;
  try {
    await q(
      `INSERT INTO "${S}".village_rpjm (village_unit_id, start_year, end_year, title)
       VALUES ($1, 2025, 2099, 'Periode tidak masuk akal')`,
      [unitId],
    );
  } catch {
    periodeGila = true;
  }
  check('periode RPJM lebih dari sepuluh tahun ditolak', periodeGila);

  const rkp = await q(
    `INSERT INTO "${S}".village_rkp (village_unit_id, village_rpjm_id, fiscal_year, title)
     VALUES ($1, $2, 2027, 'RKP Desa 2027') RETURNING id`,
    [unitId, rpjm[0].id],
  );
  let rkpKembar = false;
  try {
    await q(
      `INSERT INTO "${S}".village_rkp (village_unit_id, fiscal_year, title)
       VALUES ($1, 2027, 'Duplikat')`,
      [unitId],
    );
  } catch {
    rkpKembar = true;
  }
  check('satu RKP per tahun anggaran', rkpKembar);

  // --- 2. Usulan menjadi kegiatan ------------------------------------------
  log('');
  log('2. Usulan Musrenbang menjadi kegiatan RKP');
  const mus = await q(
    `INSERT INTO "${S}".village_musrenbang (village_unit_id, fiscal_year, title)
     VALUES ($1, 2027, 'Musrenbang 2027') RETURNING id`,
    [unitId],
  );
  const usulan = await q(
    `INSERT INTO "${S}".village_proposal
       (village_unit_id, musrenbang_id, title, estimated_cost, status)
     VALUES ($1, $2, 'Jembatan Dusun Krajan', $3, 'DISEPAKATI') RETURNING id`,
    [unitId, mus[0].id, juta(60)],
  );
  const kegiatan = await q(
    `INSERT INTO "${S}".village_activity
       (village_unit_id, village_rkp_id, code, name, village_proposal_id)
     VALUES ($1, $2, '2.1.03', 'Pembangunan Jembatan', $3) RETURNING id`,
    [unitId, rkp[0].id, usulan[0].id],
  );
  check('kegiatan tertaut ke usulannya', kegiatan.length === 1);

  let usulanDuaKegiatan = false;
  try {
    await q(
      `INSERT INTO "${S}".village_activity
         (village_unit_id, village_rkp_id, code, name, village_proposal_id)
       VALUES ($1, $2, '2.1.04', 'Jembatan lagi', $3)`,
      [unitId, rkp[0].id, usulan[0].id],
    );
  } catch {
    usulanDuaKegiatan = true;
  }
  check(
    'satu usulan tidak dapat menjadi dua kegiatan',
    usulanDuaKegiatan,
    'warga akan diberi tahu usulannya dikerjakan dua kali',
  );

  // --- 3. APBDes ------------------------------------------------------------
  log('');
  log('3. APBDes');
  const apb = await q(
    `INSERT INTO "${S}".village_budget (village_unit_id, village_rkp_id, fiscal_year)
     VALUES ($1, $2, 2027) RETURNING id`,
    [unitId, rkp[0].id],
  );

  let tanpaPerdes = false;
  try {
    await q(`UPDATE "${S}".village_budget SET status = 'DITETAPKAN' WHERE id = $1`, [apb[0].id]);
  } catch {
    tanpaPerdes = true;
  }
  check(
    'APBDes ditetapkan tanpa nomor peraturan desa DITOLAK',
    tanpaPerdes,
    'anggaran tanpa dasar hukum bukan anggaran yang dapat dipertanggungjawabkan',
  );

  const baris = await q(
    `INSERT INTO "${S}".village_budget_line
       (village_budget_id, village_activity_id, budget_type, account_code, account_name, ceiling_amount)
     VALUES ($1, $2, 'BELANJA', '5.2.01', 'Belanja Modal Jembatan', $3) RETURNING id`,
    [apb[0].id, kegiatan[0].id, juta(100)],
  );
  const lineId = baris[0].id;
  await q(
    `UPDATE "${S}".village_budget
        SET status = 'DITETAPKAN', regulation_number = 'Perdes 3/2027', total_expenditure = $2
      WHERE id = $1`,
    [apb[0].id, juta(100)],
  );
  check('APBDes dengan peraturan desa dapat ditetapkan', true);

  // --- 4. Penegakan pagu ---------------------------------------------------
  log('');
  log('4. Penegakan pagu — inti fase ini');
  log(`   pagu kegiatan: Rp ${juta(100).toLocaleString('id-ID')}`);

  await q(
    `UPDATE "${S}".village_budget_line SET committed_amount = $2 WHERE id = $1`,
    [lineId, juta(70)],
  );
  check('ikatan Rp 70jt dalam pagu diterima', true);

  let lampauiPagu = false;
  try {
    await q(
      `UPDATE "${S}".village_budget_line SET committed_amount = $2 WHERE id = $1`,
      [lineId, juta(130)],
    );
  } catch {
    lampauiPagu = true;
  }
  check(
    'ikatan melampaui pagu DITOLAK BASIS DATA',
    lampauiPagu,
    'pemeriksaan layanan dapat dilewati jalan kode berikutnya; constraint tidak',
  );

  const setelah = await q(
    `SELECT committed_amount::text FROM "${S}".village_budget_line WHERE id = $1`,
    [lineId],
  );
  check(
    'ikatan tetap pada nilai yang sah sesudah penolakan',
    Number(setelah[0].committed_amount) === juta(70),
    `dapat ${setelah[0].committed_amount}`,
  );

  // --- 5. Realisasi dibatasi ikatan ----------------------------------------
  log('');
  log('5. Realisasi dibatasi IKATAN, bukan pagu');
  await q(
    `UPDATE "${S}".village_budget_line SET realized_amount = $2 WHERE id = $1`,
    [lineId, juta(50)],
  );
  check('realisasi Rp 50jt dalam ikatan Rp 70jt diterima', true);

  let lampauiIkatan = false;
  try {
    await q(
      `UPDATE "${S}".village_budget_line SET realized_amount = $2 WHERE id = $1`,
      [lineId, juta(90)],
    );
  } catch {
    lampauiIkatan = true;
  }
  check(
    'realisasi melampaui ikatan DITOLAK meski masih dalam pagu',
    lampauiIkatan,
    'Rp 90jt masih di bawah pagu Rp 100jt, tetapi di atas ikatan Rp 70jt',
  );

  let paguDiturunkan = false;
  try {
    await q(
      `UPDATE "${S}".village_budget_line SET ceiling_amount = $2 WHERE id = $1`,
      [lineId, juta(50)],
    );
  } catch {
    paguDiturunkan = true;
  }
  check(
    'pagu tidak dapat diturunkan di bawah ikatan yang berjalan',
    paguDiturunkan,
    'kontrak yang sudah ditandatangani tidak boleh kehilangan anggarannya',
  );

  // --- 6. Ikatan bersamaan --------------------------------------------------
  log('');
  log('6. Dua ikatan bersamaan pada baris yang sama');
  await q(
    `UPDATE "${S}".village_budget_line SET realized_amount = 0, committed_amount = 0 WHERE id = $1`,
    [lineId],
  );

  /*
   * Keadaan yang paling sulit ditangkap layanan: dua SPP diproses pada saat
   * yang sama, keduanya membaca sisa pagu yang sama, keduanya menyimpulkan
   * cukup. Tanpa penguncian baris, keduanya lolos dan pagu terlampaui.
   */
  const a = new pg.Client({ connectionString: url });
  const b = new pg.Client({ connectionString: url });
  await a.connect();
  await b.connect();

  await a.query('BEGIN');
  await b.query('BEGIN');
  await a.query(`SELECT committed_amount FROM "${S}".village_budget_line WHERE id = $1 FOR UPDATE`, [
    lineId,
  ]);
  await a.query(
    `UPDATE "${S}".village_budget_line SET committed_amount = committed_amount + $2 WHERE id = $1`,
    [lineId, juta(60)],
  );

  // Transaksi kedua menunggu kunci sampai yang pertama selesai.
  const menunggu = b
    .query(`SELECT committed_amount FROM "${S}".village_budget_line WHERE id = $1 FOR UPDATE`, [lineId])
    .then(() =>
      b.query(
        `UPDATE "${S}".village_budget_line SET committed_amount = committed_amount + $2 WHERE id = $1`,
        [lineId, juta(60)],
      ),
    )
    .then(() => b.query('COMMIT'))
    .then(() => 'lolos')
    .catch((e) => (e.message.includes('committed_within_ceiling') ? 'ditolak' : `galat: ${e.message}`));

  await a.query('COMMIT');
  const hasilKedua = await menunggu;
  await a.end();
  await b.end();

  check(
    'ikatan kedua yang melampaui pagu DITOLAK meski bersamaan',
    hasilKedua === 'ditolak',
    `hasil: ${hasilKedua}`,
  );

  const total = await q(
    `SELECT committed_amount::text FROM "${S}".village_budget_line WHERE id = $1`,
    [lineId],
  );
  check(
    'total ikatan tidak melampaui pagu',
    Number(total[0].committed_amount) <= juta(100),
    `total ${total[0].committed_amount}`,
  );

  // --- 7. Transaksi ---------------------------------------------------------
  log('');
  log('7. Transaksi anggaran');
  let nilaiNol = false;
  try {
    await q(
      `INSERT INTO "${S}".village_budget_transaction
         (village_unit_id, budget_line_id, transaction_type, transaction_date, amount, description)
       VALUES ($1, $2, 'IKATAN', CURRENT_DATE, 0, 'Nol')`,
      [unitId, lineId],
    );
  } catch {
    nilaiNol = true;
  }
  check('transaksi bernilai nol ditolak', nilaiNol);

  const tx = await q(
    `INSERT INTO "${S}".village_budget_transaction
       (village_unit_id, budget_line_id, transaction_type, transaction_date, amount,
        description, idempotency_key)
     VALUES ($1, $2, 'IKATAN', CURRENT_DATE, $3, 'SPP jembatan', $4) RETURNING id`,
    [unitId, lineId, juta(60), `ikat-${tag}`],
  );
  let idemGanda = false;
  try {
    await q(
      `INSERT INTO "${S}".village_budget_transaction
         (village_unit_id, budget_line_id, transaction_type, transaction_date, amount,
          description, idempotency_key)
       VALUES ($1, $2, 'IKATAN', CURRENT_DATE, $3, 'Ulang', $4)`,
      [unitId, lineId, juta(60), `ikat-${tag}`],
    );
  } catch {
    idemGanda = true;
  }
  check('kunci idempotensi mencegah transaksi terulang', idemGanda);

  let batalTanpaAlasan = false;
  try {
    await q(`UPDATE "${S}".village_budget_transaction SET is_reversed = TRUE WHERE id = $1`, [
      tx[0].id,
    ]);
  } catch {
    batalTanpaAlasan = true;
  }
  check(
    'pembatalan transaksi tanpa alasan ditolak',
    batalTanpaAlasan,
    'lubang pada pertanggungjawaban',
  );

  // --- 8. Buku kas ----------------------------------------------------------
  log('');
  log('8. Buku kas');
  let duaSisi = false;
  try {
    await q(
      `INSERT INTO "${S}".village_cash_book
         (village_unit_id, fiscal_year, entry_date, sequence_no, description,
          debit_amount, credit_amount)
       VALUES ($1, 2027, CURRENT_DATE, 1, 'Dua sisi', 1000, 1000)`,
      [unitId],
    );
  } catch {
    duaSisi = true;
  }
  check('satu baris buku kas tidak dapat sekaligus debit dan kredit', duaSisi);

  // --- 9. Panjar ------------------------------------------------------------
  log('');
  log('9. Panjar');
  let panjarLebih = false;
  try {
    await q(
      `INSERT INTO "${S}".village_advance
         (village_unit_id, recipient_name, purpose, issued_amount, used_amount,
          returned_amount, issued_at)
       VALUES ($1, 'Kaur Umum', 'Belanja ATK', 1000000, 800000, 400000, CURRENT_DATE)`,
      [unitId],
    );
  } catch {
    panjarLebih = true;
  }
  check(
    'pertanggungjawaban panjar melebihi yang diterima ditolak',
    panjarLebih,
    '800rb dipakai + 400rb dikembalikan > 1jt diterima',
  );

  // --- 10. Kelurahan --------------------------------------------------------
  log('');
  log('10. Rencana kegiatan kelurahan');
  let realisasiLebih = false;
  try {
    await q(
      `INSERT INTO "${S}".village_activity_plan
         (village_unit_id, fiscal_year, code, name, allocated_amount, realized_amount)
       VALUES ($1, 2027, 'K.01', 'Kegiatan kelurahan', 10000000, 15000000)`,
      [unitId],
    );
  } catch {
    realisasiLebih = true;
  }
  check('realisasi kelurahan melampaui pagu yang diterima ditolak', realisasiLebih);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await q(`DROP SCHEMA IF EXISTS "${S}" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d6-apbdes.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
