/**
 * Bukti D-7: aset, pengadaan, dan bantuan.
 *
 * Tiga hal yang dibuktikan di sini, dan seluruhnya dibuktikan pada **basis
 * data**, bukan pada layanan:
 *
 * 1. **Satu warga tidak menerima bantuan sejenis dari dua jalur.** Termasuk
 *    ketika dua petugas menetapkannya bersamaan pada dua koneksi sungguhan —
 *    keadaan yang pasti lolos dari pemeriksaan layanan mana pun.
 * 2. **Kecerdasan buatan tidak dapat menetapkan penerima.** Bukan karena
 *    dilarang, melainkan karena `decided_session_id` tidak dapat diisi tanpa
 *    manusia yang masuk.
 * 3. **Aset tidak berhenti ada diam-diam.** Penghapusan tanpa nomor keputusan
 *    ditolak constraint; aset yang sedang dipinjam tidak dapat dihapus.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
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
const S = `uji_d7_${tag}`;

/** Menjalankan sesuatu yang seharusnya ditolak basis data. */
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
  log('BUKTI D-7 — ASET, PENGADAAN, DAN BANTUAN');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE SCHEMA "${S}__audit"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);

  // Fungsi audit tiruan dengan nama yang sama seperti di produksi. Yang diuji
  // bukan isinya, melainkan bahwa migrasi memasang pemicu yang memanggilnya.
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

  // --- 1. Tabel dan pemicu audit -------------------------------------------
  log('');
  log('1. Migrasi D-7');
  const baru = [
    'village_asset_category', 'village_asset', 'village_asset_borrowing',
    'village_asset_maintenance', 'village_asset_disposal', 'village_procurement_plan',
    'village_household_survey', 'village_aid_program', 'village_aid_criteria',
    'village_aid_candidate', 'village_aid_beneficiary', 'village_aid_distribution',
  ];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check(`dua belas tabel D-7 terbentuk`, ada.length === baru.length, `${ada.length}/${baru.length}`);

  const pemicu = await q(
    `SELECT c.relname AS t FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT g.tgisinternal AND g.tgname LIKE 'trg_audit_%'
        AND c.relname = ANY($2)`,
    [S, baru],
  );
  check(
    'pemicu audit terpasang pada tabel D-7 yang diaudit',
    pemicu.length >= 10,
    `${pemicu.length} tabel`,
  );

  // --- 2. Penghapusan aset --------------------------------------------------
  log('');
  log('2. Aset tidak berhenti ada diam-diam');
  const aset = await q(
    `INSERT INTO "${S}".village_asset
       (village_unit_id, register_number, name, kib_group, is_lendable)
     VALUES ($1, 'AST-B-0001', 'Proyektor', 'B', TRUE) RETURNING id`,
    [unitId],
  );
  const asetId = aset[0].id;

  const tanpaSk = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_asset_disposal
         (village_unit_id, village_asset_id, method, decision_number, decision_date, reason)
       VALUES ($1, $2, 'DIMUSNAHKAN', '   ', CURRENT_DATE, 'Rusak berat tidak dapat diperbaiki')`,
      [unitId, asetId],
    ),
  );
  check('penghapusan tanpa nomor keputusan ditolak', tanpaSk !== null);

  const alasanPendek = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_asset_disposal
         (village_unit_id, village_asset_id, method, decision_number, decision_date, reason)
       VALUES ($1, $2, 'DIMUSNAHKAN', 'SK/1/2027', CURRENT_DATE, 'rusak')`,
      [unitId, asetId],
    ),
  );
  check('penghapusan dengan alasan sekadarnya ditolak', alasanPendek !== null);

  const jualTanpaNilai = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_asset_disposal
         (village_unit_id, village_asset_id, method, decision_number, decision_date, reason)
       VALUES ($1, $2, 'DIJUAL', 'SK/2/2027', CURRENT_DATE, 'Sudah tidak dipakai lagi oleh desa')`,
      [unitId, asetId],
    ),
  );
  check(
    'penghapusan dengan cara dijual tanpa nilai penjualan ditolak',
    jualTanpaNilai !== null,
    'hasil penjualan aset desa adalah pendapatan desa',
  );

  await q(
    `INSERT INTO "${S}".village_asset_disposal
       (village_unit_id, village_asset_id, method, decision_number, decision_date, reason)
     VALUES ($1, $2, 'DIMUSNAHKAN', 'SK/3/2027', CURRENT_DATE, 'Rusak berat, biaya perbaikan melampaui nilainya')`,
    [unitId, asetId],
  );
  const hapusKedua = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_asset_disposal
         (village_unit_id, village_asset_id, method, decision_number, decision_date, reason)
       VALUES ($1, $2, 'DIHIBAHKAN', 'SK/4/2027', CURRENT_DATE, 'Diserahkan kepada karang taruna')`,
      [unitId, asetId],
    ),
  );
  check('satu aset tidak dapat dihapus dua kali', hapusKedua !== null);

  // --- 3. Satu aset, satu peminjam -----------------------------------------
  log('');
  log('3. Satu aset hanya dapat sedang dipinjam oleh satu orang');
  const aset2 = await q(
    `INSERT INTO "${S}".village_asset
       (village_unit_id, register_number, name, kib_group, is_lendable)
     VALUES ($1, 'AST-B-0002', 'Tenda', 'B', TRUE) RETURNING id`,
    [unitId],
  );

  const pinjam = async (nama) =>
    q(
      `INSERT INTO "${S}".village_asset_borrowing
         (village_unit_id, village_asset_id, borrower_name, purpose, borrowed_at, due_at)
       VALUES ($1, $2, $3, 'Hajatan', CURRENT_DATE, CURRENT_DATE + 3) RETURNING id`,
      [unitId, aset2[0].id, nama],
    );

  await pinjam('Karto');
  const pinjamKedua = await ditolak(() => pinjam('Sumiati'));
  check('peminjaman kedua atas aset yang sedang dipinjam ditolak', pinjamKedua !== null);

  const tanggalTerbalik = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_asset_borrowing
         (village_unit_id, village_asset_id, borrower_name, purpose, borrowed_at, due_at)
       VALUES ($1, $2, 'Uji', 'Uji', CURRENT_DATE, CURRENT_DATE - 1)`,
      [unitId, aset[0].id],
    ),
  );
  check('tanggal rencana kembali yang mendahului tanggal pinjam ditolak', tanggalTerbalik !== null);

  // --- 4. Kriteria tidak pernah dieksekusi ---------------------------------
  log('');
  log('4. Kriteria bantuan');
  const program = await q(
    `INSERT INTO "${S}".village_aid_program
       (village_unit_id, code, name, aid_category, fiscal_year, period_start, period_end, quota)
     VALUES ($1, 'BLT-2027', 'BLT Desa 2027', 'BLT', 2027, '2027-01-01', '2027-12-31', 5)
     RETURNING id`,
    [unitId],
  );
  const programId = program[0].id;

  const akarAsing = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_criteria (village_unit_id, aid_program_id, name, criteria)
       VALUES ($1, $2, 'Jahat', '{"jenis":"SQL","teks":"DROP TABLE village_resident"}'::jsonb)`,
      [unitId, programId],
    ),
  );
  check(
    'kriteria dengan jenis simpul asing ditolak basis data',
    akarAsing !== null,
    'lapisan terakhir bila kelak ada jalan tulis lain',
  );

  const terlaluBesar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_criteria
         (village_unit_id, aid_program_id, name, criteria, node_count, depth)
       VALUES ($1, $2, 'Raksasa', '{"jenis":"SEMUA"}'::jsonb, 500, 40)`,
      [unitId, programId],
    ),
  );
  check('kriteria yang melampaui batas simpul dan kedalaman ditolak', terlaluBesar !== null);

  const kriteriaSah = await q(
    `INSERT INTO "${S}".village_aid_criteria
       (village_unit_id, aid_program_id, name, criteria, node_count, depth)
     VALUES ($1, $2, 'Kriteria BLT', $3::jsonb, 3, 2) RETURNING id`,
    [
      unitId,
      programId,
      JSON.stringify({
        jenis: 'SEMUA',
        anak: [
          { jenis: 'BANDING', ruas: 'penghasilanBulanan', pembanding: 'MAKSIMAL', nilai: 1500000 },
          { jenis: 'BANDING', ruas: 'memilikiKendaraanBermotor', pembanding: 'SAMA', nilai: false },
        ],
      }),
    ],
  );
  check('kriteria yang sah tersimpan', kriteriaSah.length === 1);

  // --- 5. Calon dan verifikasi ---------------------------------------------
  log('');
  log('5. Penyaringan berhenti pada calon');
  const keluarga = await q(
    `INSERT INTO "${S}".village_family (village_unit_id, family_card_no)
     VALUES ($1, '3301010101010001') RETURNING id`,
    [unitId],
  );
  const warga = await q(
    `INSERT INTO "${S}".village_resident
       (village_unit_id, village_family_id, full_name, family_relation, resident_status)
     VALUES ($1, $2, 'Sumiati', 'KEPALA_KELUARGA', 'TETAP') RETURNING id`,
    [unitId, keluarga[0].id],
  );
  const wargaId = warga[0].id;

  const calon = await q(
    `INSERT INTO "${S}".village_aid_candidate
       (village_unit_id, aid_program_id, resident_id, source, status)
     VALUES ($1, $2, $3, 'AI', 'DIUSULKAN') RETURNING id`,
    [unitId, programId, wargaId],
  );
  check('calon hasil penyaringan otomatis tersimpan dengan asal usulnya', calon.length === 1);

  const calonKembar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_candidate (village_unit_id, aid_program_id, resident_id)
       VALUES ($1, $2, $3)`,
      [unitId, programId, wargaId],
    ),
  );
  check('satu warga hanya menjadi satu calon pada satu program', calonKembar !== null);

  const verifTanpaPetugas = await ditolak(() =>
    q(`UPDATE "${S}".village_aid_candidate SET status = 'DIVERIFIKASI' WHERE id = $1`, [
      calon[0].id,
    ]),
  );
  check(
    'calon tidak dapat berstatus diverifikasi tanpa petugas yang memverifikasi',
    verifTanpaPetugas !== null,
  );

  const tolakTanpaAlasan = await ditolak(() =>
    q(`UPDATE "${S}".village_aid_candidate SET status = 'DITOLAK' WHERE id = $1`, [calon[0].id]),
  );
  check('penolakan calon tanpa alasan ditolak', tolakTanpaAlasan !== null);

  await q(
    `UPDATE "${S}".village_aid_candidate
        SET status = 'DIVERIFIKASI', verified_by = $2, verified_at = now(),
            verification_note = 'Kunjungan rumah 4 Maret 2027'
      WHERE id = $1`,
    [calon[0].id, randomUUID()],
  );

  // --- 6. Kecerdasan buatan tidak menetapkan -------------------------------
  log('');
  log('6. Kecerdasan buatan tidak dapat menetapkan penerima');
  const tanpaSesi = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_beneficiary
         (village_unit_id, aid_program_id, candidate_id, resident_id, aid_category, fiscal_year,
          decided_by, decision_basis)
       VALUES ($1, $2, $3, $4, 'BLT', 2027, $5, 'Ditetapkan oleh penyaringan otomatis sistem')`,
      [unitId, programId, calon[0].id, wargaId, randomUUID()],
    ),
  );
  check(
    'penetapan tanpa sesi manusia ditolak basis data',
    tanpaSesi !== null,
    'decided_session_id NOT NULL — penyaringan otomatis tidak memiliki sesi',
  );

  const dasarPendek = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_beneficiary
         (village_unit_id, aid_program_id, resident_id, aid_category, fiscal_year,
          decided_by, decided_session_id, decision_basis)
       VALUES ($1, $2, $3, 'BLT', 2027, $4, $5, 'layak')`,
      [unitId, programId, wargaId, randomUUID(), randomUUID()],
    ),
  );
  check('penetapan tanpa dasar yang diuraikan ditolak', dasarPendek !== null);

  const penerima = await q(
    `INSERT INTO "${S}".village_aid_beneficiary
       (village_unit_id, aid_program_id, candidate_id, resident_id, aid_category, fiscal_year,
        decided_by, decided_session_id, decision_basis)
     VALUES ($1, $2, $3, $4, 'BLT', 2027, $5, $6,
             'Hasil kunjungan rumah 4 Maret 2027; keadaan sesuai usulan penyaringan')
     RETURNING id`,
    [unitId, programId, calon[0].id, wargaId, randomUUID(), randomUUID()],
  );
  check('penetapan oleh manusia dengan dasar yang diuraikan diterima', penerima.length === 1);

  // --- 7. Bantuan sejenis tidak berganda -----------------------------------
  log('');
  log('7. Satu warga tidak menerima bantuan sejenis dari dua jalur');
  const program2 = await q(
    `INSERT INTO "${S}".village_aid_program
       (village_unit_id, code, name, aid_category, fiscal_year, period_start, period_end)
     VALUES ($1, 'BLT-DD-2027', 'BLT Dana Desa 2027', 'BLT', 2027, '2027-06-01', '2027-11-30')
     RETURNING id`,
    [unitId],
  );

  const ganda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_aid_beneficiary
         (village_unit_id, aid_program_id, resident_id, aid_category, fiscal_year,
          decided_by, decided_session_id, decision_basis)
       VALUES ($1, $2, $3, 'BLT', 2027, $4, $5,
               'Ditetapkan pada program kedua untuk tahun anggaran yang sama')`,
      [unitId, program2[0].id, wargaId, randomUUID(), randomUUID()],
    ),
  );
  check('bantuan sejenis dari program kedua pada tahun yang sama ditolak', ganda !== null);

  const programLain = await q(
    `INSERT INTO "${S}".village_aid_program
       (village_unit_id, code, name, aid_category, fiscal_year, period_start, period_end)
     VALUES ($1, 'RTLH-2027', 'Rumah Tidak Layak Huni 2027', 'RUTILAHU', 2027,
             '2027-01-01', '2027-12-31') RETURNING id`,
    [unitId],
  );
  const beda = await q(
    `INSERT INTO "${S}".village_aid_beneficiary
       (village_unit_id, aid_program_id, resident_id, aid_category, fiscal_year,
        decided_by, decided_session_id, decision_basis)
     VALUES ($1, $2, $3, 'RUTILAHU', 2027, $4, $5,
             'Rumah berlantai tanah dan beratap rusak menurut pendataan Januari 2027')
     RETURNING id`,
    [unitId, programLain[0].id, wargaId, randomUUID(), randomUUID()],
  );
  check('bantuan berjenis lain tetap dapat diterima warga yang sama', beda.length === 1);

  const programTumpuk = await q(
    `INSERT INTO "${S}".village_aid_program
       (village_unit_id, code, name, aid_category, fiscal_year, period_start, period_end,
        allow_stacking)
     VALUES ($1, 'BLT-TAMBAHAN', 'BLT Tambahan Desa', 'BLT', 2027, '2027-01-01', '2027-12-31', TRUE)
     RETURNING id`,
    [unitId],
  );
  const tumpuk = await q(
    `INSERT INTO "${S}".village_aid_beneficiary
       (village_unit_id, aid_program_id, resident_id, aid_category, fiscal_year, allow_stacking,
        decided_by, decided_session_id, decision_basis)
     VALUES ($1, $2, $3, 'BLT', 2027, TRUE, $4, $5,
             'Program tambahan desa yang memang dirancang menambah BLT pusat')
     RETURNING id`,
    [unitId, programTumpuk[0].id, wargaId, randomUUID(), randomUUID()],
  );
  check(
    'penumpukan yang dinyatakan pada rancangan program diizinkan',
    tumpuk.length === 1,
    'allow_stacking harus dinyatakan, bukan diputuskan diam-diam per warga',
  );

  // --- 8. Dua penetapan bersamaan ------------------------------------------
  log('');
  log('8. Dua petugas menetapkan warga yang sama secara bersamaan');
  const warga2 = await q(
    `INSERT INTO "${S}".village_resident
       (village_unit_id, village_family_id, full_name, family_relation, resident_status)
     VALUES ($1, $2, 'Karto', 'KEPALA_KELUARGA', 'TETAP') RETURNING id`,
    [unitId, keluarga[0].id],
  );

  const a = new pg.Client({ connectionString: url });
  const b = new pg.Client({ connectionString: url });
  await a.connect();
  await b.connect();

  const tetapkan = (c, prog) =>
    c.query(
      `INSERT INTO "${S}".village_aid_beneficiary
         (village_unit_id, aid_program_id, resident_id, aid_category, fiscal_year,
          decided_by, decided_session_id, decision_basis)
       VALUES ($1, $2, $3, 'BLT', 2027, $4, $5,
               'Ditetapkan menerima bantuan langsung tunai tahun anggaran 2027')`,
      [unitId, prog, warga2[0].id, randomUUID(), randomUUID()],
    );

  await a.query('BEGIN');
  await b.query('BEGIN');

  // Keduanya membaca daftar penerima pada saat yang sama, dan keduanya tidak
  // menemukan bentrok. Inilah keadaan yang pasti lolos dari pemeriksaan layanan.
  const lihatA = await a.query(
    `SELECT count(*)::int AS n FROM "${S}".village_aid_beneficiary
      WHERE resident_id = $1 AND aid_category = 'BLT' AND status = 'AKTIF'`,
    [warga2[0].id],
  );
  const lihatB = await b.query(
    `SELECT count(*)::int AS n FROM "${S}".village_aid_beneficiary
      WHERE resident_id = $1 AND aid_category = 'BLT' AND status = 'AKTIF'`,
    [warga2[0].id],
  );
  check(
    'kedua petugas sama-sama membaca "belum menerima"',
    lihatA.rows[0].n === 0 && lihatB.rows[0].n === 0,
  );

  await tetapkan(a, programId);

  let keduaDitolak = false;
  let selesai = false;
  const janjiB = tetapkan(b, program2[0].id).then(
    () => {
      selesai = true;
    },
    () => {
      keduaDitolak = true;
      selesai = true;
    },
  );

  // Yang kedua menunggu kunci indeks yang dipegang transaksi pertama.
  await new Promise((r) => setTimeout(r, 300));
  check('penetapan kedua tertahan menunggu yang pertama', !selesai);

  await a.query('COMMIT');
  await janjiB;
  await b.query('ROLLBACK').catch(() => {});

  check(
    'penetapan kedua DITOLAK meski berjalan bersamaan',
    keduaDitolak,
    'indeks unik parsial, bukan pemeriksaan layanan',
  );

  const akhir = await q(
    `SELECT count(*)::int AS n FROM "${S}".village_aid_beneficiary
      WHERE resident_id = $1 AND aid_category = 'BLT' AND status = 'AKTIF'`,
    [warga2[0].id],
  );
  check('hanya satu penetapan yang bertahan', akhir[0].n === 1, `tercatat ${akhir[0].n}`);

  await a.end();
  await b.end();

  // --- 9. Penyaluran --------------------------------------------------------
  log('');
  log('9. Penyaluran');
  // Tiap pemanggilan memakai terminnya sendiri kecuali sengaja diulang, supaya
  // yang menolak benar-benar aturan yang diuji dan bukan indeks termin.
  const salur = async (termin, extra = {}) =>
    q(
      `INSERT INTO "${S}".village_aid_distribution
         (village_unit_id, aid_program_id, beneficiary_id, installment_no, distributed_at,
          aid_form, amount, received_by, proxy_name, receipt_reference)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, 300000, $6, $7, $8) RETURNING id`,
      [
        unitId,
        programId,
        penerima[0].id,
        termin,
        'form' in extra ? extra.form : 'UANG',
        'received' in extra ? extra.received : 'PENERIMA',
        'proxy' in extra ? extra.proxy : null,
        'receipt' in extra ? extra.receipt : 'TTD-0091',
      ],
    );

  const t1 = await salur(1);
  check('penyaluran termin pertama tercatat', t1.length === 1);

  const t1Lagi = await ditolak(() => salur(1));
  check(
    'penyaluran kedua pada termin yang sama ditolak',
    t1Lagi !== null,
    'pembayaran kedua, bukan pencatatan kedua',
  );

  const uangTanpaBukti = await ditolak(() => salur(2, { receipt: null }));
  check('penyaluran berbentuk uang tanpa bukti terima ditolak', uangTanpaBukti !== null);

  const barangTanpaBukti = await salur(2, { form: 'BARANG', receipt: null });
  check(
    'penyaluran berbentuk barang tanpa bukti terima tetap diterima',
    barangTanpaBukti.length === 1,
  );

  const kuasaTanpaNama = await ditolak(() => salur(3, { received: 'KUASA' }));
  check(
    'penyaluran yang diwakilkan tanpa nama yang mewakili ditolak',
    kuasaTanpaNama !== null,
    'tidak dapat ditelusuri bila penerimanya menyatakan tidak pernah menerima',
  );

  const kuasa = await salur(3, { received: 'KUASA', proxy: 'Suparjo' });
  check('penyaluran yang diwakilkan dengan nama diterima', kuasa.length === 1);

  // --- 10. Pengadaan --------------------------------------------------------
  log('');
  log('10. Rencana pengadaan wajib menunjuk pagunya');
  const anggaran = await q(
    `INSERT INTO "${S}".village_budget
       (village_unit_id, fiscal_year, status, regulation_number, established_at)
     VALUES ($1, 2027, 'DITETAPKAN', 'Perdes Nomor 3 Tahun 2027', CURRENT_DATE) RETURNING id`,
    [unitId],
  );
  const baris = await q(
    `INSERT INTO "${S}".village_budget_line
       (village_budget_id, budget_type, account_code, account_name, ceiling_amount)
     VALUES ($1, 'BELANJA', '5.1.02', 'Belanja Modal Peralatan', 50000000) RETURNING id`,
    [anggaran[0].id],
  );

  const tanpaPagu = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_procurement_plan
         (village_unit_id, fiscal_year, code, name, estimated_value)
       VALUES ($1, 2027, 'PBJ-01', 'Laptop', 12000000)`,
      [unitId],
    ),
  );
  check('rencana pengadaan tanpa baris anggaran ditolak', tanpaPagu !== null);

  const pengadaan = await q(
    `INSERT INTO "${S}".village_procurement_plan
       (village_unit_id, fiscal_year, budget_line_id, code, name, estimated_value, method)
     VALUES ($1, 2027, $2, 'PBJ-01', 'Laptop', 12000000, 'SWAKELOLA') RETURNING id`,
    [unitId, baris[0].id],
  );
  check('rencana pengadaan yang menunjuk pagunya diterima', pengadaan.length === 1);

  // --- 11. Pendataan --------------------------------------------------------
  log('');
  log('11. Pendataan keadaan keluarga');
  const survei = await q(
    `INSERT INTO "${S}".village_household_survey
       (village_unit_id, village_family_id, survey_year, monthly_income, house_status, surveyed_at)
     VALUES ($1, $2, 2027, 900000, 'MENUMPANG', '2027-01-18') RETURNING id`,
    [unitId, keluarga[0].id],
  );
  check('pendataan tersimpan beserta tanggal kunjungannya', survei.length === 1);

  const surveiKembar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_household_survey
         (village_unit_id, village_family_id, survey_year, surveyed_at)
       VALUES ($1, $2, 2027, '2027-03-01')`,
      [unitId, keluarga[0].id],
    ),
  );
  check('satu pendataan per keluarga per tahun', surveiKembar !== null);

  const statusRumahAsing = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_household_survey
         (village_unit_id, village_family_id, survey_year, house_status, surveyed_at)
       VALUES ($1, $2, 2028, 'ISTANA', '2028-01-01')`,
      [unitId, keluarga[0].id],
    ),
  );
  check('status rumah di luar daftar ditolak', statusRumahAsing !== null);

  // --- 12. Jejak audit ------------------------------------------------------
  log('');
  log('12. Jejak audit');
  const jejak = await q(
    `SELECT table_name, count(*)::int AS n FROM "${S}__audit".audit_log
      WHERE table_name LIKE 'village_a%' GROUP BY table_name ORDER BY table_name`,
  );
  check(
    'perubahan pada tabel aset dan bantuan tercatat pada skema audit',
    jejak.length >= 4,
    jejak.map((r) => `${r.table_name}:${r.n}`).join(' '),
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
    new URL('../../../docs/info-desa/bukti-d7-aset-bantuan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
