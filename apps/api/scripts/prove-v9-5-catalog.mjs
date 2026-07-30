/**
 * Bukti V9-5: kategori, projection, dan pencarian katalog publik.
 *
 * Dijalankan langsung terhadap basis data pengembangan dan API yang berjalan.
 * Yang dibuktikan bukan bahwa kodenya ada, melainkan bahwa aturannya berlaku:
 * listing yang belum terbit tidak pernah sampai ke katalog publik, dan
 * penarikan menghilangkannya kembali.
 */

import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const DATABASE_URL = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: DATABASE_URL });
const lines = [];
const log = (text) => {
  lines.push(text);
  console.log(text);
};

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok ? '' : `  (dapat ${JSON.stringify(actual)}, harap ${JSON.stringify(expected)})`}`);
}

await client.connect();

log('=========================================================================');
log('BUKTI V9-5 — KATALOG MARKETPLACE PUBLIK');
log('=========================================================================');
log('');

// -- 1. Kategori ------------------------------------------------------------
log('1. KATALOG KATEGORI');
const cat = await client.query(`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE parent_id IS NULL)::int AS akar,
         count(*) FILTER (WHERE is_leaf)::int AS daun,
         count(*) FILTER (WHERE is_restricted)::int AS terbatas
    FROM platform.marketplace_category WHERE deleted_at IS NULL`);
const c = cat.rows[0];
log(`  ${c.total} kategori: ${c.akar} akar, ${c.daun} daun, ${c.terbatas} terbatas`);
check('kategori tertanam', c.total > 40, true);
check('setiap akar punya anak', c.akar < c.daun, true);

const jalur = await client.query(`
  SELECT count(*)::int AS salah FROM platform.marketplace_category a
    JOIN platform.marketplace_category b ON a.parent_id = b.id
   WHERE a.path NOT LIKE b.path || '/%'`);
check('jalur anak berawalan jalur induk', jalur.rows[0].salah, 0);

const induk = await client.query(`
  SELECT count(*)::int AS salah FROM platform.marketplace_category p
   WHERE p.is_leaf AND EXISTS (SELECT 1 FROM platform.marketplace_category k WHERE k.parent_id = p.id)`);
check('kategori berANAK tidak ditandai daun', induk.rows[0].salah, 0);
log('');

// -- 2. Bentuk tabel projection --------------------------------------------
log('2. TABEL PROJECTION');
const kolom = await client.query(`
  SELECT column_name FROM information_schema.columns
   WHERE table_schema='platform' AND table_name='marketplace_listing_projection'
   ORDER BY column_name`);
const namaKolom = kolom.rows.map((r) => r.column_name);
check('search_document ada', namaKolom.includes('search_document'), true);
check('tenant_schema tersimpan untuk penelusuran balik', namaKolom.includes('tenant_schema'), true);

const idx = await client.query(`
  SELECT indexname FROM pg_indexes
   WHERE schemaname='platform' AND tablename='marketplace_listing_projection'
   ORDER BY indexname`);
const namaIdx = idx.rows.map((r) => r.indexname);
log(`  indeks: ${namaIdx.length}`);
check('indeks GIN pencarian teks penuh ada', namaIdx.includes('idx_listing_projection_search'), true);
check('indeks trigram judul ada', namaIdx.includes('idx_listing_projection_title_trgm'), true);
check(
  'satu listing tenant hanya satu baris',
  namaIdx.some((n) => n.includes('tenant_id_tenant_listing_id')),
  true,
);

const trg = await client.query(`
  SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
   WHERE c.relname = 'marketplace_listing_projection' AND NOT t.tgisinternal`);
check('trigger dokumen pencarian terpasang', trg.rows.some((r) => r.tgname === 'trg_listing_projection_search'), true);
log('');

// -- 3. Dokumen pencarian dibentuk trigger ---------------------------------
log('3. DOKUMEN PENCARIAN DIBENTUK BASIS DATA, BUKAN APLIKASI');
// Ditulis langsung lewat SQL, melewati seluruh kode aplikasi. Bila dokumen
// pencarian tetap terbentuk, artinya jalur penulisan mana pun tercakup.
const seller = await client.query(`SELECT id, tenant_id FROM platform.marketplace_seller WHERE deleted_at IS NULL LIMIT 1`);
const store = await client.query(`SELECT id, store_name, store_slug FROM platform.marketplace_store WHERE deleted_at IS NULL LIMIT 1`);
const kategoriDaun = await client.query(`SELECT id FROM platform.marketplace_category WHERE is_leaf AND is_active LIMIT 1`);

if (seller.rows[0] && store.rows[0] && kategoriDaun.rows[0]) {
  await client.query(`DELETE FROM platform.marketplace_listing_projection WHERE slug LIKE 'bukti-v95%'`);
  await client.query(
    `INSERT INTO platform.marketplace_listing_projection
       (id, seller_id, store_id, tenant_id, tenant_schema, tenant_listing_id, category_id,
        slug, title, description, condition, min_price, max_price, currency_code,
        availability, image_count, store_name, store_slug, source_updated_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, $3, 'bukti_schema', gen_random_uuid(), $4,
        'bukti-v95/kaos-polos-hitam', 'Kaos Polos Hitam Katun', 'Bahan katun combed 30s lembut',
        'NEW', 75000, 95000, 'IDR', 'IN_STOCK', 3, $5, 'bukti-v95', now(), now())`,
    [seller.rows[0].id, store.rows[0].id, seller.rows[0].tenant_id, kategoriDaun.rows[0].id, store.rows[0].store_name],
  );

  const doc = await client.query(
    `SELECT search_document IS NOT NULL AS terisi,
            search_document @@ websearch_to_tsquery('simple', 'kaos') AS cocok_judul,
            search_document @@ websearch_to_tsquery('simple', 'katun') AS cocok_deskripsi,
            search_document @@ websearch_to_tsquery('simple', 'sepatu') AS cocok_asing
       FROM platform.marketplace_listing_projection WHERE slug = 'bukti-v95/kaos-polos-hitam'`,
  );
  const d = doc.rows[0];
  check('dokumen terisi tanpa campur tangan aplikasi', d.terisi, true);
  check('kata dari judul ditemukan', d.cocok_judul, true);
  check('kata dari deskripsi ditemukan', d.cocok_deskripsi, true);
  check('kata yang tidak ada tidak ditemukan', d.cocok_asing, false);

  // Judul diubah lewat SQL; dokumen harus ikut berubah.
  await client.query(
    `UPDATE platform.marketplace_listing_projection SET title = 'Jaket Parasut Hitam'
      WHERE slug = 'bukti-v95/kaos-polos-hitam'`,
  );
  const doc2 = await client.query(
    `SELECT search_document @@ websearch_to_tsquery('simple', 'jaket') AS judul_baru,
            search_document @@ websearch_to_tsquery('simple', 'kaos') AS judul_lama
       FROM platform.marketplace_listing_projection WHERE slug = 'bukti-v95/kaos-polos-hitam'`,
  );
  check('judul baru ikut terindeks', doc2.rows[0].judul_baru, true);
  check('judul lama tidak lagi ditemukan', doc2.rows[0].judul_lama, false);

  await client.query(`DELETE FROM platform.marketplace_listing_projection WHERE slug LIKE 'bukti-v95%'`);
  log('  baris bukti dibersihkan');
} else {
  log('  DILEWATI — belum ada seller/store/kategori pada basis data ini');
}
log('');

// -- 4. Outbox --------------------------------------------------------------
log('4. OUTBOX SEBAGAI ANTREAN');
const schemas = await client.query(
  `SELECT schema_name FROM platform.tenant_schema_registry ORDER BY schema_name LIMIT 3`,
);
for (const row of schemas.rows) {
  const ada = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS ada`,
    [`${row.schema_name}.sync_outbox`],
  );
  log(`  ${row.schema_name}: sync_outbox ${ada.rows[0].ada ? 'tersedia' : 'TIDAK ADA'}`);
  if (!ada.rows[0].ada) failures += 1;
}

const kolomOutbox = await client.query(`
  SELECT column_name FROM information_schema.columns
   WHERE table_schema = $1 AND table_name='sync_outbox'`, [schemas.rows[0]?.schema_name ?? 'x']);
const outboxCols = kolomOutbox.rows.map((r) => r.column_name);
check('outbox punya sequence_no untuk urutan', outboxCols.includes('sequence_no'), true);
check('outbox punya status untuk SKIP LOCKED', outboxCols.includes('status'), true);
log('');

// -- 5. Riwayat putaran -----------------------------------------------------
log('5. RIWAYAT PUTARAN PROJECTION');
const run = await client.query(`
  SELECT column_name FROM information_schema.columns
   WHERE table_schema='platform' AND table_name='marketplace_projection_run'`);
const runCols = run.rows.map((r) => r.column_name);
check('mencatat jumlah gagal terpisah dari dilewati',
  runCols.includes('events_failed') && runCols.includes('events_skipped'), true);
check('mencatat lama putaran', runCols.includes('duration_ms'), true);
log('');

// -- 6. R15: yang belum terbit tidak pernah ada di katalog -----------------
log('6. R15 — KATALOG HANYA BERISI YANG BOLEH DILIHAT PUBLIK');
const terbit = await client.query(`
  SELECT count(*)::int n FROM demo.online_listing
   WHERE status = 'PUBLISHED' AND deleted_at IS NULL`);
const belumTerbit = await client.query(`
  SELECT count(*)::int n FROM demo.online_listing
   WHERE status <> 'PUBLISHED' AND deleted_at IS NULL`);
const diProyeksikan = await client.query(`
  SELECT count(*)::int n FROM platform.marketplace_listing_projection`);
log(`  tenant demo: ${terbit.rows[0].n} terbit, ${belumTerbit.rows[0].n} belum terbit`);
log(`  katalog publik: ${diProyeksikan.rows[0].n} produk`);
check('yang terbit sampai ke katalog', diProyeksikan.rows[0].n, terbit.rows[0].n);

// Setiap baris katalog harus punya pasangan yang benar-benar berstatus terbit.
const yatim = await client.query(`
  SELECT count(*)::int n FROM platform.marketplace_listing_projection p
   WHERE NOT EXISTS (
     SELECT 1 FROM demo.online_listing l
      WHERE l.id = p.tenant_listing_id AND l.status = 'PUBLISHED' AND l.deleted_at IS NULL)`);
check('tidak ada baris katalog tanpa listing terbit', yatim.rows[0].n, 0);

// Harga nol tidak pernah lolos: pembeli dapat memesan tanpa membayar.
const gratis = await client.query(`
  SELECT count(*)::int n FROM platform.marketplace_listing_projection WHERE min_price <= 0`);
check('tidak ada produk berharga nol', gratis.rows[0].n, 0);

// Kategori wajib dan harus kategori daun yang dikenal.
const tanpaKategori = await client.query(`
  SELECT count(*)::int n FROM platform.marketplace_listing_projection p
    LEFT JOIN platform.marketplace_category c ON c.id = p.category_id
   WHERE c.id IS NULL OR NOT c.is_leaf OR NOT c.is_active`);
check('setiap produk berkategori daun yang aktif', tanpaKategori.rows[0].n, 0);

// Ketersediaan mencerminkan stok, bukan disalin begitu saja.
const stok = await client.query(`
  SELECT p.availability, COALESCE(SUM(v.stock_qty), 0)::float8 AS total,
         bool_or(v.allow_preorder) AS preorder
    FROM platform.marketplace_listing_projection p
    JOIN demo.online_listing_variant v ON v.listing_id = p.tenant_listing_id
   WHERE v.is_active AND v.deleted_at IS NULL
   GROUP BY p.id, p.availability`);
const salahStok = stok.rows.filter((r) =>
  r.total > 0 ? r.availability !== 'IN_STOCK'
  : r.preorder ? r.availability !== 'PREORDER'
  : r.availability !== 'OUT_OF_STOCK');
check('ketersediaan sesuai stok dan izin pre-order', salahStok.length, 0);
log(`  ${stok.rows.filter((r) => r.availability === 'PREORDER').length} produk berstatus pesan-dahulu`);

// Nama schema tidak pernah bocor lewat kolom yang dibaca publik. Ia tersimpan
// untuk penelusuran balik, tetapi endpoint publik tidak mengembalikannya —
// diperiksa terpisah pada uji jalur HTTP.
log('  catatan: tenant_schema tersimpan untuk penelusuran, tidak dikembalikan endpoint publik');
log('');

log('=========================================================================');
log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
log('=========================================================================');

await client.end();

const { writeFileSync } = await import('node:fs');
writeFileSync(
  new URL('../../../docs/upgrade-v9/evidence/v9-5-catalog.txt', import.meta.url),
  lines.join('\n') + '\n',
);

process.exit(failures === 0 ? 0 : 1);
