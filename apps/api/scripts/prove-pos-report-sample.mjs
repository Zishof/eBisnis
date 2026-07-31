/**
 * Bukti POS-9 dan POS-10: laporan operasional dan data contoh kasir.
 *
 * Yang dibuktikan, berurut dari yang paling penting:
 *
 * 1. **Kasir tidak melihat harga pokok.** Kolom biayanya benar-benar hilang
 *    dari jawaban, bukan sekadar tidak ditampilkan layar.
 * 2. **Kasir hanya melihat penjualannya sendiri**, apa pun yang dimintanya.
 * 3. **Angka laporan cocok dengan penjualan yang dibangun** — bukan sekadar
 *    "endpointnya menjawab 200".
 * 4. **Data contoh POS dapat dihapus tanpa melumpuhkan penyewa**: satuan,
 *    bagan akun, peran, dan hak akses tetap utuh.
 * 5. **Rentang tanggal dibatasi**, dan penolakannya menyebutkan batasnya.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3100/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const SCHEMA = process.env.POS_SCHEMA ?? 'demo';

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

const tag = randomBytes(4).toString('hex');
const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const aktor = {};
let batchId = null;

async function api(path, opts = {}, token = null, extra = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

async function buatAktor(nama, roleCode, tenantId) {
  const username = `bukti_${nama}_${tag}`;
  const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const platformUserId = randomUUID();
  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1, $2::varchar, lower($2::varchar), $3, $4, $5, 'ACTIVE', FALSE, FALSE, now(), now())`,
    [platformUserId, username, `${username}@contoh.invalid`, nama, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, FALSE, 'ACTIVE', now(), now())`,
    [tenantId, platformUserId],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1, $2::varchar, $3, $2::varchar, FALSE, 'ACTIVE') RETURNING id`,
      [platformUserId, username, nama],
    )
  )[0].id;
  const role = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = $1`, [roleCode]))[0];
  if (!role) throw new Error(`peran ${roleCode} tidak ada`);
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1, $2, CURRENT_DATE)`,
    [subjectId, role.id],
  );
  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const token = masuk.data?.accessToken;
  if (!token) throw new Error(`login ${nama} gagal: ${JSON.stringify(masuk.body).slice(0, 250)}`);
  return { platformUserId, subjectId, token };
}

// Data acuan yang harus utuh sesudah pembersihan.
const ACUAN = [
  ['uom', 'Satuan'],
  ['chart_of_account', 'Bagan akun'],
  ['role', 'Peran'],
  ['menu', 'Menu'],
  ['permission_action', 'Aksi hak akses'],
  ['payment_method', 'Metode pembayaran'],
  ['tax_category', 'Kategori pajak'],
];

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI POS-9 dan POS-10 — LAPORAN OPERASIONAL DAN DATA CONTOH KASIR');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  aktor.pemilik = await buatAktor('pemilik', 'OWNER', tenantId);
  aktor.kasir = await buatAktor('kasir', 'KASIR_POS', tenantId);
  log('');
  log('Dua aktor: pemilik (berhak penuh) dan kasir (terbatas).');

  // === 1. Membangun data contoh ===========================================
  log('');
  log('1. Membangun data contoh POS');
  const sebelum = {};
  for (const [t] of ACUAN) {
    sebelum[t] = Number(
      (await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".${t} WHERE deleted_at IS NULL`))[0].n,
    );
  }

  const bangun = await api(
    '/pos/sample-data',
    { method: 'POST', body: JSON.stringify({ profile: 'RINGKAS' }) },
    aktor.pemilik.token,
  );
  check('data contoh terbangun', bangun.status === 201 || bangun.status === 200, `status ${bangun.status}`);
  batchId = bangun.data?.sampleBatchId;
  log(`   batch ${batchId}`);
  log(
    `   ${bangun.data?.outlets} outlet, ${bangun.data?.registers} register, ` +
      `${bangun.data?.products} produk, ${bangun.data?.sales} penjualan (${bangun.data?.durationMs} ms)`,
  );
  check('menghasilkan penjualan', Number(bangun.data?.sales) > 0);
  check('menghasilkan baris penjualan', Number(bangun.data?.saleLines) > 0);

  const bertanda = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".pos_sale
      WHERE sample_batch_id = $1 AND is_sample = TRUE`,
    [batchId],
  );
  check(
    'seluruh penjualan contoh bertanda is_sample dan sample_batch_id',
    bertanda[0].n === Number(bangun.data?.sales),
    `${bertanda[0].n} vs ${bangun.data?.sales}`,
  );

  const tanpaBarcode = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".product p
      WHERE p.sample_batch_id = $1
        AND NOT EXISTS (SELECT 1 FROM "${SCHEMA}".product_barcode b WHERE b.product_id = p.id)`,
    [batchId],
  );
  check('setiap produk contoh punya barcode', tanpaBarcode[0].n === 0, `${tanpaBarcode[0].n} tanpa barcode`);

  const hitung = await api('/pos/sample-data', {}, aktor.pemilik.token);
  check('penghitung melaporkan ada data contoh', hitung.data?.hasSampleData === true);

  // === 2. Laporan cocok dengan datanya ====================================
  log('');
  log('2. Laporan mencerminkan penjualan yang dibangun');
  const ringkas = await api(
    '/pos/reports/SALES_SUMMARY?from=2000-01-01&to=2000-01-02',
    {},
    aktor.pemilik.token,
  );
  check('rentang lama tidak menghasilkan galat', ringkas.status === 200, `status ${ringkas.status}`);
  check('dan tidak menghasilkan baris', (ringkas.data?.rows ?? []).length === 0);

  const hariIni = new Date().toISOString().slice(0, 10);
  const mundur = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const penuh = await api(
    `/pos/reports/SALES_SUMMARY?from=${mundur}&to=${hariIni}`,
    {},
    aktor.pemilik.token,
  );
  check('laporan ringkasan menjawab', penuh.status === 200, `status ${penuh.status}`);
  const totalLaporan = (penuh.data?.rows ?? []).reduce((a, r) => a + Number(r.grossSales ?? 0), 0);

  const totalDb = Number(
    (
      await q(
        `SELECT COALESCE(SUM(grand_total),0)::text AS t FROM "${SCHEMA}".pos_sale
          WHERE sample_batch_id = $1 AND status = 'COMPLETED'`,
        [batchId],
      )
    )[0].t,
  );
  log(`   total laporan ${totalLaporan}, total di basis data (batch ini) ${totalDb}`);
  check(
    'total laporan mencakup seluruh penjualan contoh',
    totalLaporan >= totalDb && totalDb > 0,
    `${totalLaporan} vs ${totalDb}`,
  );

  const perProduk = await api(
    `/pos/reports/BY_PRODUCT?from=${mundur}&to=${hariIni}&limit=5`,
    {},
    aktor.pemilik.token,
  );
  check('laporan per produk menjawab', perProduk.status === 200);
  check('berisi baris', (perProduk.data?.rows ?? []).length > 0);
  check(
    'pemilik MELIHAT kolom biaya',
    Object.prototype.hasOwnProperty.call(perProduk.data?.rows?.[0] ?? {}, 'cost'),
  );
  check('dan kolom margin', Object.prototype.hasOwnProperty.call(perProduk.data?.rows?.[0] ?? {}, 'margin'));

  // === 3. Kasir tidak melihat biaya =======================================
  log('');
  log('3. Kasir tidak melihat harga pokok maupun kasir lain');
  const daftarKasir = await api('/pos/reports', {}, aktor.kasir.token);
  const kodeKasir = (daftarKasir.data ?? []).map((l) => l.code);
  check('daftar laporan kasir tidak memuat laporan berbiaya', !kodeKasir.includes('BY_PRODUCT'), kodeKasir.join(','));
  check('tetapi memuat laporan biasa', kodeKasir.includes('SALES_SUMMARY'));

  const produkKasir = await api(
    `/pos/reports/BY_PRODUCT?from=${mundur}&to=${hariIni}`,
    {},
    aktor.kasir.token,
  );
  check(
    'kasir DITOLAK membuka laporan berbiaya',
    produkKasir.status === 403,
    `status ${produkKasir.status}`,
  );
  check(
    'penolakannya menerangkan sebabnya',
    String(produkKasir.body?.error?.message ?? '').includes('harga pokok'),
    produkKasir.body?.error?.message,
  );

  const kasirKasir = await api(
    `/pos/reports/BY_CASHIER?from=${mundur}&to=${hariIni}&cashierId=${aktor.pemilik.subjectId}`,
    {},
    aktor.kasir.token,
  );
  check('kasir dapat membuka laporan per kasir', kasirKasir.status === 200, `status ${kasirKasir.status}`);
  check(
    'tetapi jawabannya menyatakan disaring ke dirinya sendiri',
    kasirKasir.data?.scopedToSelf === true,
  );
  const idKasirLain = (kasirKasir.data?.rows ?? []).filter(
    (r) => r.cashierId && r.cashierId !== aktor.kasir.subjectId,
  );
  check(
    'dan TIDAK memuat kasir lain, meski memintanya secara tegas',
    idKasirLain.length === 0,
    `${idKasirLain.length} baris kasir lain`,
  );

  // === 4. Batas rentang ====================================================
  log('');
  log('4. Batas rentang tanggal');
  const lebar = await api(
    '/pos/reports/SALES_SUMMARY?from=2025-01-01&to=2026-12-31',
    {},
    aktor.pemilik.token,
  );
  check('rentang terlalu lebar ditolak', lebar.status === 400, `status ${lebar.status}`);
  check(
    'penolakannya menyebut batasnya',
    String(lebar.body?.error?.message ?? '').includes('92'),
    lebar.body?.error?.message,
  );

  const terbalik = await api(
    '/pos/reports/SALES_SUMMARY?from=2026-07-31&to=2026-07-01',
    {},
    aktor.pemilik.token,
  );
  check('tanggal terbalik ditolak', terbalik.status === 400, `status ${terbalik.status}`);

  const takDikenal = await api('/pos/reports/LAPORAN_KARANGAN', {}, aktor.pemilik.token);
  check('laporan yang tidak terdaftar ditolak', takDikenal.status === 400, `status ${takDikenal.status}`);

  // === 5. Dasbor ===========================================================
  log('');
  log('5. Dasbor');
  const dasbor = await api('/pos/reports/dashboard', {}, aktor.pemilik.token);
  check('dasbor menjawab', dasbor.status === 200, `status ${dasbor.status}`);
  check('memuat totals', Boolean(dasbor.data?.totals));
  check('memuat komposisi pembayaran', Array.isArray(dasbor.data?.paymentMix));
  check('memuat sorotan', Array.isArray(dasbor.data?.highlights));

  const dasborKasir = await api('/pos/reports/dashboard', {}, aktor.kasir.token);
  check('dasbor kasir menjawab', dasborKasir.status === 200);
  check('dan menyatakan biaya disembunyikan', dasborKasir.data?.costHidden === true);
  const adaBiaya = (dasborKasir.data?.topProducts ?? []).some((p) =>
    Object.prototype.hasOwnProperty.call(p, 'cost'),
  );
  check('produk teratas pada dasbor kasir TIDAK memuat biaya', !adaBiaya);

  // === 6. Pembersihan tidak melumpuhkan ===================================
  log('');
  log('6. Menghapus data contoh POS');
  const bersih = await api(
    '/pos/sample-data/cleanup',
    { method: 'POST', body: JSON.stringify({ reason: 'Bukti POS-10' }) },
    aktor.pemilik.token,
  );
  check('pembersihan berhasil', bersih.status === 200, `status ${bersih.status}`);
  log(`   ${bersih.data?.totalRemoved} baris dihapus`);
  check('ada yang terhapus', Number(bersih.data?.totalRemoved) > 0);

  const sisaJual = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".pos_sale
      WHERE sample_batch_id = $1 AND deleted_at IS NULL`,
    [batchId],
  );
  check('penjualan contoh terhapus seluruhnya', sisaJual[0].n === 0, `sisa ${sisaJual[0].n}`);

  log('');
  log('   Yang HARUS selamat:');
  for (const [t, label] of ACUAN) {
    const n = Number(
      (await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".${t} WHERE deleted_at IS NULL`))[0].n,
    );
    check(`${label} utuh (${sebelum[t]} → ${n})`, n === sebelum[t] && n > 0);
  }

  const hitungAkhir = await api('/pos/sample-data', {}, aktor.pemilik.token);
  check(
    'penghitung melaporkan tidak ada lagi data contoh POS',
    hitungAkhir.data?.hasSampleData === false,
    JSON.stringify(hitungAkhir.data),
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
  log(String(e.stack ?? '').split('\n').slice(1, 4).join('\n'));
} finally {
  try {
    if (batchId) {
      // Sisa data contoh dihapus permanen; naskah bukti tidak boleh
      // meninggalkan outlet dan produk karangan pada ruang kerja.
      await q(
        `DELETE FROM "${SCHEMA}".pos_payment WHERE pos_sale_id IN
           (SELECT id FROM "${SCHEMA}".pos_sale WHERE sample_batch_id = $1)`,
        [batchId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_sale WHERE sample_batch_id = $1`, [batchId]);
      await q(
        `DELETE FROM "${SCHEMA}".pos_shift WHERE terminal_id IN
           (SELECT id FROM "${SCHEMA}".pos_terminal WHERE sample_batch_id = $1)`,
        [batchId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_terminal WHERE sample_batch_id = $1`, [batchId]);
      await q(`DELETE FROM "${SCHEMA}".product_barcode WHERE sample_batch_id = $1`, [batchId]);
      await q(
        `DELETE FROM "${SCHEMA}".stock_balance WHERE product_id IN
           (SELECT id FROM "${SCHEMA}".product WHERE sample_batch_id = $1)`,
        [batchId],
      );
      await q(`DELETE FROM "${SCHEMA}".product WHERE sample_batch_id = $1`, [batchId]);
      await q(`DELETE FROM "${SCHEMA}".customer WHERE sample_batch_id = $1`, [batchId]);
      await q(`DELETE FROM "${SCHEMA}".warehouse WHERE sample_batch_id = $1`, [batchId]);
      await q(`DELETE FROM "${SCHEMA}".outlet WHERE sample_batch_id = $1`, [batchId]);
      await q(`DELETE FROM "${SCHEMA}".brand WHERE sample_batch_id = $1`, [batchId]);
    }
    for (const a of Object.values(aktor)) {
      if (!a?.subjectId) continue;
      await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [a.subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [a.subjectId]);
      await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [a.platformUserId]);
      await q(`DELETE FROM platform.platform_user WHERE id = $1`, [a.platformUserId]);
    }
    log('');
    log('Data sementara dibersihkan.');
  } catch (e) {
    log(`Peringatan: pembersihan tidak tuntas — ${e.message}`);
  }
  await client.end();
  writeFileSync(
    new URL('../../../docs/pos-web-priority/bukti-pos-report-sample.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
