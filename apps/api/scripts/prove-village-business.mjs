/**
 * Bukti D-8: BUMDes, UMKM, dan wisata.
 *
 * Yang dibuktikan di sini, dan seluruhnya pada **basis data**:
 *
 * 1. **Kerugian BUMDes tidak dapat mengalir kembali mengurangi APBDes.**
 *    Bagian desa yang negatif ditolak constraint; laba nol atau rugi yang
 *    disertai bagian desa bukan-nol juga ditolak. Begitu satu baris pembukuan
 *    dapat melakukannya, pemisahan badan hukum BUMDes sudah runtuh tanpa
 *    seorang pun memutuskannya.
 * 2. **Satu transaksi APBDes menjadi satu penyertaan modal.** Uang yang keluar
 *    sekali tidak dapat dicatat dua kali sebagai modal.
 * 3. **Destinasi wisata tidak dapat ditayangkan setengah jadi**, betapapun
 *    jalan tulisnya.
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
const S = `uji_d8_${tag}`;
const juta = (n) => n * 1_000_000;

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
  log('BUKTI D-8 — BUMDes, UMKM, DAN WISATA');
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
  log('1. Migrasi D-8');
  const baru = [
    'village_bumdes', 'village_bumdes_unit', 'village_bumdes_capital', 'village_bumdes_result',
    'village_umkm', 'village_umkm_product', 'village_tourism_site',
    'village_cooperative_presence',
  ];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check('delapan tabel D-8 terbentuk', ada.length === baru.length, `${ada.length}/${baru.length}`);

  // Batas vertikal: rujukan ke sistem lain tidak boleh berelasi.
  const fkLuar = await q(
    `SELECT con.conname, a.attname
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
      WHERE n.nspname = $1 AND con.contype = 'f'
        AND a.attname IN ('pos_outlet_id', 'marketplace_listing_id', 'external_cooperative_id')`,
    [S],
  );
  check(
    'rujukan ke vertikal lain disimpan TANPA foreign key',
    fkLuar.length === 0,
    'foreign key lintas vertikal membuat migrasi satu vertikal dapat mematahkan yang lain',
  );

  const pemicu = await q(
    `SELECT c.relname AS t FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT g.tgisinternal AND g.tgname LIKE 'trg_audit_%'
        AND c.relname = ANY($2)`,
    [S, baru],
  );
  check('pemicu audit terpasang pada tabel D-8', pemicu.length >= 8, `${pemicu.length} tabel`);

  // --- 2. Pendirian BUMDes --------------------------------------------------
  log('');
  log('2. Pendirian BUMDes');
  const tanpaPerdes = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes (village_unit_id, name, status)
       VALUES ($1, 'BUMDes Tanpa Dasar', 'BERDIRI')`,
      [unitId],
    ),
  );
  check(
    'BUMDes berdiri tanpa peraturan desa ditolak',
    tanpaPerdes !== null,
    'BUMDes tanpa perdes bukan badan usaha milik desa',
  );

  const bagianSeratus = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes
         (village_unit_id, name, regulation_number, status, village_share_pct)
       VALUES ($1, 'BUMDes Serakah', 'Perdes 5/2027', 'BERDIRI', 100)`,
      [unitId],
    ),
  );
  check(
    'bagian desa seratus persen ditolak',
    bagianSeratus !== null,
    'BUMDes yang seluruh labanya disetor tidak akan tumbuh',
  );

  const bumdes = await q(
    `INSERT INTO "${S}".village_bumdes
       (village_unit_id, name, regulation_number, established_at, status, village_share_pct,
        ad_art_established)
     VALUES ($1, 'BUMDes Krajan Makmur', 'Perdes Nomor 5 Tahun 2027', '2027-02-01', 'AKTIF', 30, TRUE)
     RETURNING id`,
    [unitId],
  );
  const bumdesId = bumdes[0].id;
  check('BUMDes yang lengkap tersimpan', bumdes.length === 1);

  const bumdesKedua = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes
         (village_unit_id, name, regulation_number, status, village_share_pct)
       VALUES ($1, 'BUMDes Kedua', 'Perdes 9/2027', 'BERDIRI', 20)`,
      [unitId],
    ),
  );
  check('satu desa satu BUMDes', bumdesKedua !== null);

  const bubarTanpaAlasan = await ditolak(() =>
    q(`UPDATE "${S}".village_bumdes SET status = 'BUBAR' WHERE id = $1`, [bumdesId]),
  );
  check('pembubaran BUMDes tanpa alasan ditolak', bubarTanpaAlasan !== null);

  // --- 3. Penyertaan modal --------------------------------------------------
  log('');
  log('3. Penyertaan modal menunjuk APBDes-nya');
  const anggaran = await q(
    `INSERT INTO "${S}".village_budget
       (village_unit_id, fiscal_year, status, regulation_number, established_at)
     VALUES ($1, 2027, 'DITETAPKAN', 'Perdes Nomor 3 Tahun 2027', CURRENT_DATE) RETURNING id`,
    [unitId],
  );
  const baris = await q(
    `INSERT INTO "${S}".village_budget_line
       (village_budget_id, budget_type, account_code, account_name, ceiling_amount,
        committed_amount, realized_amount)
     VALUES ($1, 'PEMBIAYAAN_PENGELUARAN', '6.2.01', 'Penyertaan Modal Desa', $2, $2, $2)
     RETURNING id`,
    [anggaran[0].id, juta(150)],
  );
  const trx = await q(
    `INSERT INTO "${S}".village_budget_transaction
       (village_unit_id, budget_line_id, transaction_type, transaction_date, amount, description)
     VALUES ($1, $2, 'REALISASI', CURRENT_DATE, $3, 'Penyertaan modal BUMDes 2027') RETURNING id`,
    [unitId, baris[0].id, juta(150)],
  );

  const tanpaTransaksi = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_capital
         (village_unit_id, village_bumdes_id, fiscal_year, amount, regulation_number, transferred_at)
       VALUES ($1, $2, 2027, $3, 'Perdes 6/2027', CURRENT_DATE)`,
      [unitId, bumdesId, juta(150)],
    ),
  );
  check(
    'penyertaan modal tanpa transaksi APBDes ditolak',
    tanpaTransaksi !== null,
    'modal tanpa padanan APBDes berarti uangnya belum keluar, atau keluar tanpa dicatat',
  );

  const modal = await q(
    `INSERT INTO "${S}".village_bumdes_capital
       (village_unit_id, village_bumdes_id, fiscal_year, amount, regulation_number,
        budget_transaction_id, transferred_at)
     VALUES ($1, $2, 2027, $3, 'Perdes Nomor 6 Tahun 2027', $4, CURRENT_DATE) RETURNING id`,
    [unitId, bumdesId, juta(150), trx[0].id],
  );
  check('penyertaan modal yang menunjuk transaksinya tersimpan', modal.length === 1);

  const modalGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_capital
         (village_unit_id, village_bumdes_id, fiscal_year, amount, regulation_number,
          budget_transaction_id, transferred_at)
       VALUES ($1, $2, 2027, $3, 'Perdes 7/2027', $4, CURRENT_DATE)`,
      [unitId, bumdesId, juta(150), trx[0].id],
    ),
  );
  check(
    'satu transaksi APBDes tidak dapat menjadi dua penyertaan modal',
    modalGanda !== null,
    'uang yang keluar sekali tidak dicatat dua kali sebagai modal',
  );

  const modalNol = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_capital
         (village_unit_id, village_bumdes_id, fiscal_year, amount, regulation_number,
          budget_transaction_id, transferred_at)
       VALUES ($1, $2, 2028, 0, 'Perdes 8/2028', $3, CURRENT_DATE)`,
      [unitId, bumdesId, randomUUID()],
    ),
  );
  check('penyertaan modal nol ditolak', modalNol !== null);

  // --- 4. Kerugian tidak mengalir ke desa -----------------------------------
  log('');
  log('4. Kerugian BUMDes tidak mengurangi APBDes');
  const bagianNegatif = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_result
         (village_unit_id, village_bumdes_id, fiscal_year, revenue_amount, expense_amount,
          net_result, village_share_pct, village_share_amount)
       VALUES ($1, $2, 2027, $3, $4, $5, 30, $6)`,
      [unitId, bumdesId, juta(100), juta(160), juta(-60), juta(-18)],
    ),
  );
  check(
    'bagian desa yang NEGATIF ditolak basis data',
    bagianNegatif !== null,
    'kerugian BUMDes ditanggung modalnya sendiri, bukan APBDes',
  );

  const rugiTapiSetor = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_result
         (village_unit_id, village_bumdes_id, fiscal_year, revenue_amount, expense_amount,
          net_result, village_share_pct, village_share_amount)
       VALUES ($1, $2, 2027, $3, $4, $5, 30, $6)`,
      [unitId, bumdesId, juta(100), juta(160), juta(-60), juta(5)],
    ),
  );
  check(
    'BUMDes yang rugi tetapi menyetor bagian desa ditolak',
    rugiTapiSetor !== null,
    'aturan yang sama dari sisi yang lain',
  );

  const rugi = await q(
    `INSERT INTO "${S}".village_bumdes_result
       (village_unit_id, village_bumdes_id, fiscal_year, revenue_amount, expense_amount,
        net_result, village_share_pct, village_share_amount, retained_amount)
     VALUES ($1, $2, 2026, $3, $4, $5, 30, 0, $5) RETURNING id, net_result::text`,
    [unitId, bumdesId, juta(100), juta(160), juta(-60)],
  );
  check(
    'kerugian tercatat apa adanya dengan bagian desa nol',
    rugi.length === 1 && Number(rugi[0].net_result) === juta(-60),
    'menyembunyikan rugi tidak membuat uangnya kembali',
  );

  const laba = await q(
    `INSERT INTO "${S}".village_bumdes_result
       (village_unit_id, village_bumdes_id, fiscal_year, revenue_amount, expense_amount,
        net_result, village_share_pct, village_share_amount, retained_amount, status)
     VALUES ($1, $2, 2027, $3, $4, $5, 30, $6, $7, 'DITETAPKAN')
     RETURNING village_share_amount::text, retained_amount::text`,
    [unitId, bumdesId, juta(500), juta(380), juta(120), juta(36), juta(84)],
  );
  check(
    'laba dibagi menurut persentase yang dicuplik',
    Number(laba[0].village_share_amount) === juta(36) && Number(laba[0].retained_amount) === juta(84),
    `desa ${laba[0].village_share_amount}, BUMDes ${laba[0].retained_amount}`,
  );

  const persenBerubah = await q(
    `UPDATE "${S}".village_bumdes SET village_share_pct = 60 WHERE id = $1
     RETURNING village_share_pct::text`,
    [bumdesId],
  );
  const laporanLama = await q(
    `SELECT village_share_pct::text, village_share_amount::text
       FROM "${S}".village_bumdes_result WHERE village_bumdes_id = $1 AND fiscal_year = 2027`,
    [bumdesId],
  );
  check(
    'laporan lama TIDAK berubah ketika persentase anggaran dasar diubah',
    Number(persenBerubah[0].village_share_pct) === 60 &&
      Number(laporanLama[0].village_share_pct) === 30,
    'persentase dicuplik, bukan dirujuk — laporan yang berubah artinya bukan laporan',
  );

  const laporanKembar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_result
         (village_unit_id, village_bumdes_id, fiscal_year, village_share_pct)
       VALUES ($1, $2, 2027, 30)`,
      [unitId, bumdesId],
    ),
  );
  check('satu laporan hasil usaha per tahun', laporanKembar !== null);

  // --- 5. Unit usaha dan outlet POS ----------------------------------------
  log('');
  log('5. Unit usaha dan outlet POS');
  const outletId = randomUUID();
  const unitUsaha = await q(
    `INSERT INTO "${S}".village_bumdes_unit
       (village_unit_id, village_bumdes_id, code, name, pos_outlet_id, pos_linked_at, status)
     VALUES ($1, $2, 'UNIT-01', 'Toko Sembako Desa', $3, now(), 'BERJALAN') RETURNING id`,
    [unitId, bumdesId, outletId],
  );
  check('unit usaha tertaut ke outlet POS', unitUsaha.length === 1);

  const outletGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_unit
         (village_unit_id, village_bumdes_id, code, name, pos_outlet_id, pos_linked_at)
       VALUES ($1, $2, 'UNIT-02', 'Unit Lain', $3, now())`,
      [unitId, bumdesId, outletId],
    ),
  );
  check(
    'satu outlet POS tidak dapat ditautkan ke dua unit usaha',
    outletGanda !== null,
    'dua unit yang menunjuk outlet yang sama melaporkan penjualan yang sama dua kali',
  );

  const tautTanpaTanggal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_bumdes_unit
         (village_unit_id, village_bumdes_id, code, name, pos_outlet_id)
       VALUES ($1, $2, 'UNIT-03', 'Unit Tanpa Jejak', $3)`,
      [unitId, bumdesId, randomUUID()],
    ),
  );
  check(
    'tautan POS tanpa tanggal ditolak',
    tautTanpaTanggal !== null,
    'penjualan kosong harus dapat dibedakan dari tautan yang belum pernah dibuat',
  );

  // --- 6. UMKM dan listing --------------------------------------------------
  log('');
  log('6. UMKM menautkan listing, tidak membuatnya');
  const umkm = await q(
    `INSERT INTO "${S}".village_umkm
       (village_unit_id, code, business_name, owner_name, owner_user_id, annual_turnover, scale)
     VALUES ($1, 'UMKM-014', 'Keripik Singkong Bu Sari', 'Sari Wulandari', $2, $3, 'MIKRO')
     RETURNING id`,
    [unitId, randomUUID(), juta(450)],
  );
  const produk = await q(
    `INSERT INTO "${S}".village_umkm_product (village_unit_id, village_umkm_id, name)
     VALUES ($1, $2, 'Keripik Singkong Balado') RETURNING id`,
    [unitId, umkm[0].id],
  );

  const listingId = randomUUID();
  const tautTanpaJejak = await ditolak(() =>
    q(
      `UPDATE "${S}".village_umkm_product SET marketplace_listing_id = $2 WHERE id = $1`,
      [produk[0].id, listingId],
    ),
  );
  check(
    'tautan listing tanpa jejak siapa dan kapan ditolak',
    tautTanpaJejak !== null,
    'tautan tanpa jejak tidak dapat dipertanggungjawabkan ketika kepemilikannya digugat',
  );

  await q(
    `UPDATE "${S}".village_umkm_product
        SET marketplace_listing_id = $2, linked_at = now(), linked_by = $3 WHERE id = $1`,
    [produk[0].id, listingId, randomUUID()],
  );
  const produk2 = await q(
    `INSERT INTO "${S}".village_umkm_product (village_unit_id, village_umkm_id, name)
     VALUES ($1, $2, 'Keripik Singkong Original') RETURNING id`,
    [unitId, umkm[0].id],
  );
  const listingGanda = await ditolak(() =>
    q(
      `UPDATE "${S}".village_umkm_product
          SET marketplace_listing_id = $2, linked_at = now(), linked_by = $3 WHERE id = $1`,
      [produk2[0].id, listingId, randomUUID()],
    ),
  );
  check('satu listing tidak dapat ditautkan ke dua produk', listingGanda !== null);

  const skalaAsing = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_umkm
         (village_unit_id, code, business_name, owner_name, scale)
       VALUES ($1, 'UMKM-015', 'Usaha Uji', 'Uji', 'RAKSASA')`,
      [unitId],
    ),
  );
  check('skala usaha di luar daftar ditolak', skalaAsing !== null);

  // --- 7. Penayangan wisata -------------------------------------------------
  log('');
  log('7. Destinasi wisata tidak ditayangkan setengah jadi');
  const wisata = await q(
    `INSERT INTO "${S}".village_tourism_site (village_unit_id, code, name, category)
     VALUES ($1, 'WIS-01', 'Curug Krajan', 'ALAM') RETURNING id`,
    [unitId],
  );
  const wisataId = wisata[0].id;

  const tayangKosong = await ditolak(() =>
    q(`UPDATE "${S}".village_tourism_site SET is_published = TRUE WHERE id = $1`, [wisataId]),
  );
  check(
    'penayangan tanpa pengelola, kontak, foto, dan tarif ditolak',
    tayangKosong !== null,
    'penayangan adalah janji kepada orang yang belum pernah datang',
  );

  await q(
    `UPDATE "${S}".village_tourism_site
        SET manager_name = 'Pokdarwis Krajan', manager_contact = '0812-0000-0000', photo_count = 3
      WHERE id = $1`,
    [wisataId],
  );
  const tayangTanpaTarif = await ditolak(() =>
    q(`UPDATE "${S}".village_tourism_site SET is_published = TRUE WHERE id = $1`, [wisataId]),
  );
  check(
    'penayangan tanpa tarif yang dinyatakan ditolak',
    tayangTanpaTarif !== null,
    'destinasi tanpa tarif adalah destinasi yang tarifnya ditentukan di pintu masuk',
  );

  await q(`UPDATE "${S}".village_tourism_site SET entry_fee = 5000 WHERE id = $1`, [wisataId]);
  const tayang = await q(
    `UPDATE "${S}".village_tourism_site SET is_published = TRUE WHERE id = $1
     RETURNING is_published`,
    [wisataId],
  );
  check('destinasi yang lengkap dapat ditayangkan', tayang[0].is_published === true);

  const gratisBertarif = await ditolak(() =>
    q(`UPDATE "${S}".village_tourism_site SET is_free = TRUE WHERE id = $1`, [wisataId]),
  );
  check('destinasi gratis sekaligus bertarif ditolak', gratisBertarif !== null);

  const wisataGratis = await q(
    `INSERT INTO "${S}".village_tourism_site
       (village_unit_id, code, name, manager_name, manager_contact, photo_count, is_free,
        is_published)
     VALUES ($1, 'WIS-02', 'Taman Desa', 'Karang Taruna', '0813-1111-1111', 2, TRUE, TRUE)
     RETURNING id`,
    [unitId],
  );
  check(
    'destinasi gratis yang dinyatakan gratis dapat ditayangkan',
    wisataGratis.length === 1,
    'nol berbeda dari belum diisi',
  );

  // --- 8. Koperasi ----------------------------------------------------------
  log('');
  log('8. Koperasi: desa mencatat keberadaan, bukan datanya');
  const kolom = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'village_cooperative_presence'`,
    [S],
  );
  const nama = kolom.map((k) => k.column_name);
  const terlarang = nama.filter((n) =>
    /simpanan|saving|pinjaman|loan|tunggakan|arrear|saldo|balance/i.test(n),
  );
  check(
    'tidak ada kolom simpanan, pinjaman, maupun tunggakan',
    terlarang.length === 0,
    'kepentingan yang tidak ada tidak boleh diberi jalan',
  );

  const koperasi = await q(
    `INSERT INTO "${S}".village_cooperative_presence
       (village_unit_id, name, cooperative_type, external_cooperative_id, linked_at)
     VALUES ($1, 'KSP Sejahtera', 'SIMPAN_PINJAM', $2, now()) RETURNING id`,
    [unitId, randomUUID()],
  );
  check('keberadaan koperasi tercatat beserta rujukan buramnya', koperasi.length === 1);

  const rujukTanpaTanggal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_cooperative_presence
         (village_unit_id, name, external_cooperative_id)
       VALUES ($1, 'KSP Tanpa Jejak', $2)`,
      [unitId, randomUUID()],
    ),
  );
  check('rujukan ke eKoperasi tanpa tanggal penautan ditolak', rujukTanpaTanggal !== null);

  // --- 9. Jejak audit -------------------------------------------------------
  log('');
  log('9. Jejak audit');
  const jejak = await q(
    `SELECT table_name, count(*)::int AS n FROM "${S}__audit".audit_log
      WHERE table_name LIKE 'village_b%' OR table_name LIKE 'village_u%'
        OR table_name LIKE 'village_t%' OR table_name LIKE 'village_c%'
      GROUP BY table_name ORDER BY table_name`,
  );
  check(
    'perubahan pada tabel usaha desa tercatat pada skema audit',
    jejak.length >= 5,
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
    new URL('../../../docs/info-desa/bukti-d8-usaha-desa.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
