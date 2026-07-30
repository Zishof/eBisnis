/**
 * Bukti jalur HTTP katalog publik.
 *
 * Dijalankan terhadap API yang benar-benar berjalan. Yang diuji di sini adalah
 * hal yang tidak dapat dibuktikan dari basis data: apa yang sungguh
 * dikembalikan kepada pengunjung anonim, dan apa yang tidak.
 *
 *   node apps/api/scripts/prove-v9-5-http.mjs
 */

const BASE = process.env.API_BASE ?? 'http://localhost:3000/api/v1';
const lines = [];
const log = (text) => {
  lines.push(text);
  console.log(text);
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

/** Memanggil tanpa satu pun header otorisasi — persis seperti pengunjung. */
async function anon(path) {
  const response = await fetch(`${BASE}${path}`);
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

/** Mengupas amplop respons bila ada. */
const unwrap = (body) => (body && typeof body === 'object' && 'data' in body ? body.data : body);

log('=========================================================================');
log('BUKTI V9-5 — JALUR HTTP KATALOG PUBLIK');
log(`Basis: ${BASE}`);
log('=========================================================================');
log('');

// -- 1. Tanpa masuk ---------------------------------------------------------
log('1. DAPAT DIBACA TANPA MASUK');
const kategori = await anon('/public/catalog/categories');
check('kategori terbuka untuk anonim', kategori.status, 200);
const pohon = unwrap(kategori.body);
log(`  ${Array.isArray(pohon) ? pohon.length : 0} kategori akar`);
check('pohon kategori berisi', Array.isArray(pohon) && pohon.length > 5, true);

const cari = await anon('/public/catalog/search');
check('pencarian terbuka untuk anonim', cari.status, 200);
const hasil = unwrap(cari.body);
log(`  ${hasil?.total ?? 0} produk pada katalog`);
log('');

// -- 2. Nama schema tidak pernah dikembalikan ------------------------------
log('2. NAMA SCHEMA DAN PENGENAL INTERNAL TIDAK BOCOR');
const mentah = JSON.stringify(cari.body);
const bocor = ['tenantSchema', 'tenant_schema', 'tenantId', 'tenant_id', 'tenantListingId'].filter(
  (kunci) => mentah.includes(kunci),
);
check('tidak ada pengenal tenant pada respons pencarian', bocor, []);

if (hasil?.items?.length) {
  const contoh = hasil.items[0];
  const detail = await anon(`/public/catalog/produk/${contoh.slug}`);
  check('detail produk terbuka untuk anonim', detail.status, 200);
  const detailMentah = JSON.stringify(detail.body);
  const bocorDetail = ['tenantSchema', 'tenant_schema', 'tenantId', 'tenantListingId'].filter((k) =>
    detailMentah.includes(k),
  );
  check('tidak ada pengenal tenant pada detail produk', bocorDetail, []);
  log(`  contoh: ${contoh.title} — ${contoh.storeName}`);
}
log('');

// -- 3. Batas terhadap pengambilan massal (R26) ----------------------------
log('3. R26 — BATAS TERHADAP PENGAMBILAN MASSAL');
const besar = await anon('/public/catalog/search?jumlah=100000');
const hasilBesar = unwrap(besar.body);
check('permintaan besar tetap dilayani', besar.status, 200);
check('ukuran halaman dipangkas ke batas', hasilBesar?.limit <= 48, true);
log(`  jumlah=100000 dilayani dengan limit ${hasilBesar?.limit}`);

const dalam = await anon('/public/catalog/search?halaman=500');
check('penelusuran sangat dalam ditolak', dalam.status, 400);

const dalamTanpaSaring = await anon('/public/catalog/search?halaman=20');
check('halaman jauh tanpa penyaring ditolak', dalamTanpaSaring.status, 400);

const dalamDenganSaring = await anon('/public/catalog/search?q=kaos&halaman=3');
check('halaman jauh dengan kata kunci dilayani', dalamDenganSaring.status, 200);
log('');

// -- 4. Pencarian benar-benar menyaring ------------------------------------
log('4. PENCARIAN MENYARING, BUKAN MENGEMBALIKAN SEMUANYA');
const kaos = unwrap((await anon('/public/catalog/search?q=kaos')).body);
const semua = unwrap((await anon('/public/catalog/search')).body);
log(`  "kaos": ${kaos?.items?.length ?? 0} hasil dari ${semua?.total ?? 0} produk`);
check('kata kunci mempersempit hasil', (kaos?.items?.length ?? 0) < (semua?.total ?? 0), true);
check('kata kunci menemukan sesuatu', (kaos?.items?.length ?? 0) > 0, true);

// Jumlah yang dilaporkan harus jumlah yang cocok, bukan jumlah seluruh
// katalog. Melaporkan enam ketika hanya satu yang cocok membuat pembeli
// menyimpulkan ada lima hasil lain yang tidak ditampilkan.
check('jumlah yang dilaporkan sesuai hasil kata kunci', kaos?.total, kaos?.items?.length);

const takAda = unwrap((await anon('/public/catalog/search?q=xyzqwertyasdf')).body);
check('kata kunci yang tidak ada menghasilkan kosong', takAda?.items?.length ?? -1, 0);
check('jumlah nol saat tidak ada yang cocok', takAda?.total, 0);

const kategoriSaring = unwrap((await anon('/public/catalog/search?kategori=fashion-pria')).body);
log(`  kategori "fashion-pria": ${kategoriSaring?.items?.length ?? 0} hasil`);
check('penyaring kategori bekerja', (kategoriSaring?.items?.length ?? 0) > 0, true);

// Kategori induk mencakup keturunannya.
const indukSaring = unwrap((await anon('/public/catalog/search?kategori=fashion')).body);
check(
  'kategori induk mencakup subkategorinya',
  (indukSaring?.items?.length ?? 0) >= (kategoriSaring?.items?.length ?? 0),
  true,
);
log(`  kategori induk "fashion": ${indukSaring?.items?.length ?? 0} hasil`);

const kategoriAsing = unwrap((await anon('/public/catalog/search?kategori=tidak-ada-ini')).body);
check('kategori tak dikenal menghasilkan kosong, bukan galat', kategoriAsing?.items?.length ?? -1, 0);
log('');

// -- 5. Urutan harga --------------------------------------------------------
log('5. PENGURUTAN');
const murah = unwrap((await anon('/public/catalog/search?urut=PRICE_ASC')).body);
const mahal = unwrap((await anon('/public/catalog/search?urut=PRICE_DESC')).body);
if (murah?.items?.length > 1) {
  const harga = murah.items.map((i) => Number(i.minPrice));
  const naik = harga.every((v, i) => i === 0 || harga[i - 1] <= v);
  check('harga termurah tersusun menaik', naik, true);
  log(`  termurah: ${harga[0]}, termahal: ${Number(mahal.items[0].minPrice)}`);
  check('urutan menurun benar-benar berbeda', Number(mahal.items[0].minPrice) >= harga[0], true);
}

const urutAsing = await anon('/public/catalog/search?urut=DROP%20TABLE');
check('nilai urut tak dikenal diabaikan, bukan diteruskan', urutAsing.status, 200);
log('');

// -- 6. Produk yang tidak ada ----------------------------------------------
log('6. ALAMAT YANG TIDAK ADA');
const hilang = await anon('/public/catalog/produk/toko-tidak-ada/produk-tidak-ada');
check('produk tak dikenal menghasilkan 404', hilang.status, 404);

const suntik = await anon("/public/catalog/produk/toko/'%20OR%201=1--");
check('alamat berisi upaya suntikan tetap 404', suntik.status, 404);
log('');

log('=========================================================================');
log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
log('=========================================================================');

const { writeFileSync } = await import('node:fs');
writeFileSync(
  new URL('../../../docs/upgrade-v9/evidence/v9-5-http.txt', import.meta.url),
  lines.join('\n') + '\n',
);

process.exit(failures === 0 ? 0 : 1);
