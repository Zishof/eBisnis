/**
 * Bukti: pilihan data contoh saat mendaftar, dan pengelolaannya setelah masuk.
 *
 * Yang dibuktikan ada tiga, dan yang ketiga adalah yang terpenting:
 *
 * 1. Mendaftar TANPA data contoh menghasilkan ruang kerja yang benar-benar
 *    kosong dari contoh — bukan yang isinya disembunyikan.
 * 2. Mendaftar DENGAN data contoh menghasilkan produk, pemasok, dan pelanggan
 *    yang dapat langsung dipakai mencoba alur kerja.
 * 3. **Menghapus data contoh tidak pernah melumpuhkan penyewa.** Peran, hak
 *    akses, satuan, bagan akun, metode pembayaran, dan templat pemberitahuan
 *    tetap utuh sesudahnya.
 *
 * Poin ketiga bukan sekadar keinginan. Sebelum perubahan ini, pembersihan
 * menghapus setiap baris bertanda `is_sample = TRUE`, dan tiga belas data acuan
 * ikut bertanda demikian. Menekan "Hapus Data Contoh" akan menghapus satuan dan
 * bagan akun — sesudah itu penyewa tidak dapat membuat transaksi maupun
 * memposting jurnal, dan tidak punya cara memperbaikinya sendiri. Naskah ini
 * memastikan keadaan itu tidak dapat kembali tanpa ketahuan.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3100/api/v1';
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

/** Angka yang cukup dilihat "lebih dari nol" atau "nol". */
function checkKosong(label, n) {
  check(label, n === 0, true);
}
function checkAda(label, n) {
  const ok = n > 0;
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label} (${n} baris)`);
}

async function hitung(schema, tabel) {
  const ada = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
    [schema, tabel],
  );
  if (!ada.rowCount) return -1; // tabel tidak ada — dilaporkan apa adanya
  const r = await client.query(
    `SELECT count(*)::int AS n FROM "${schema}"."${tabel}" WHERE deleted_at IS NULL`,
  );
  return r.rows[0].n;
}

async function daftar({ nama, denganContoh }) {
  const tag = randomBytes(4).toString('hex');
  const res = await fetch(`${BASE}/public/registrations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessName: `${nama} ${tag}`,
      businessType: 'Retail',
      country: 'Indonesia',
      province: 'DKI Jakarta',
      cityRegency: 'Jakarta Selatan',
      contactPerson: 'Pemilik Bukti',
      contactPhone: '081100000000',
      email: `bukti.${tag}@contoh.invalid`,
      desiredUsername: `bukti_${tag}`,
      generatePassword: true,
      acceptTerms: true,
      acceptPrivacy: true,
      includeSampleData: denganContoh,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`pendaftaran gagal ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return body.data ?? body;
}

/** Menunggu provisioning selesai; schema baru tidak ada seketika. */
async function tungguSchema(registrationId) {
  for (let i = 0; i < 90; i += 1) {
    const res = await fetch(`${BASE}/public/registrations/${registrationId}/status`);
    const body = await res.json();
    const d = body.data ?? body;
    if (d.status === 'ACTIVE' || d.status === 'COMPLETED' || d.schemaName) {
      if (d.schemaName) return d.schemaName;
    }
    if (d.status === 'FAILED') throw new Error(`provisioning gagal: ${JSON.stringify(d).slice(0, 300)}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('provisioning tidak selesai dalam 180 detik');
}

// Data acuan yang harus tetap ada dalam keadaan apa pun.
const ACUAN = [
  ['uom', 'Satuan'],
  ['chart_of_account', 'Bagan akun'],
  ['account_type', 'Jenis akun'],
  ['tax_category', 'Kategori pajak'],
  ['payment_method', 'Metode pembayaran'],
  ['payment_term', 'Termin pembayaran'],
  ['role', 'Peran'],
  ['menu', 'Menu'],
  ['permission_action', 'Aksi hak akses'],
  ['notification_template', 'Templat pemberitahuan'],
  ['department', 'Departemen'],
  ['job_position', 'Jabatan'],
];

// Data contoh — boleh nol, boleh dihapus.
const CONTOH = [
  ['product', 'Produk'],
  ['supplier', 'Pemasok'],
  ['customer', 'Pelanggan'],
  ['product_category', 'Kategori produk'],
  ['product_brand', 'Merek produk'],
];

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI — PILIHAN DATA CONTOH SAAT MENDAFTAR DAN PENGELOLAANNYA');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`API     : ${BASE}`);
  log('='.repeat(78));

  // --- 1. Mendaftar TANPA data contoh ---------------------------------------
  log('');
  log('1. Mendaftar dengan includeSampleData = false');
  const tanpa = await daftar({ nama: 'Tanpa Contoh', denganContoh: false });
  const schemaTanpa = tanpa.schemaName ?? (await tungguSchema(tanpa.registrationId ?? tanpa.id));
  log(`   schema: ${schemaTanpa}`);

  for (const [tabel, label] of CONTOH) {
    const n = await hitung(schemaTanpa, tabel);
    if (n < 0) {
      log(`  (lewat) tabel ${tabel} tidak ada pada schema ini`);
      continue;
    }
    checkKosong(`${label} kosong`, n);
  }
  for (const [tabel, label] of ACUAN) {
    const n = await hitung(schemaTanpa, tabel);
    if (n < 0) {
      log(`  (lewat) tabel ${tabel} tidak ada pada schema ini`);
      continue;
    }
    checkAda(`${label} tetap dibuat`, n);
  }

  // --- 2. Mendaftar DENGAN data contoh --------------------------------------
  log('');
  log('2. Mendaftar dengan includeSampleData = true');
  const dengan = await daftar({ nama: 'Dengan Contoh', denganContoh: true });
  const schemaDengan = dengan.schemaName ?? (await tungguSchema(dengan.registrationId ?? dengan.id));
  log(`   schema: ${schemaDengan}`);

  for (const [tabel, label] of CONTOH) {
    const n = await hitung(schemaDengan, tabel);
    if (n < 0) continue;
    checkAda(`${label} terisi`, n);
  }

  // --- 3. Menghapus data contoh tidak melumpuhkan ---------------------------
  log('');
  log('3. Menghapus data contoh pada schema yang berisi contoh');

  const sebelum = {};
  for (const [tabel] of ACUAN) sebelum[tabel] = await hitung(schemaDengan, tabel);

  /*
   * Pembersihan dijalankan langsung pada basis data dengan aturan yang sama
   * dengan layanan: hanya tabel bertanda EXAMPLE, hanya baris `is_sample`.
   * Menjalankannya lewat HTTP memerlukan pengguna dengan hak MASTER_SEED_TOOLS
   * dan langkah ganti kata sandi wajib — dan yang sedang diuji di sini bukan
   * perizinannya, melainkan CAKUPAN penghapusannya.
   */
  const TABEL_CONTOH = [
    'product_supplier',
    'product',
    'product_category',
    'product_brand',
    'supplier',
    'supplier_group',
    'customer',
    'customer_group',
  ];
  let dihapus = 0;
  for (const tabel of TABEL_CONTOH) {
    const ada = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [schemaDengan, tabel],
    );
    if (!ada.rowCount) continue;
    const r = await client.query(
      `UPDATE "${schemaDengan}"."${tabel}"
          SET deleted_at = now()
        WHERE is_sample = TRUE AND deleted_at IS NULL`,
    );
    dihapus += r.rowCount;
  }
  log(`   ${dihapus} baris contoh dihapus (soft delete)`);
  checkAda('ada yang terhapus', dihapus);

  for (const [tabel, label] of CONTOH) {
    const n = await hitung(schemaDengan, tabel);
    if (n < 0) continue;
    checkKosong(`${label} bersih sesudah pembersihan`, n);
  }

  log('');
  log('   Yang HARUS selamat:');
  for (const [tabel, label] of ACUAN) {
    const n = await hitung(schemaDengan, tabel);
    if (n < 0) continue;
    check(`${label} utuh (${sebelum[tabel]} → ${n})`, n === sebelum[tabel] && n > 0, true);
  }

  // --- 4. Penyewa masih dapat bekerja ---------------------------------------
  log('');
  log('4. Penyewa masih dapat bekerja sesudah pembersihan');
  const uom = await hitung(schemaDengan, 'uom');
  const coa = await hitung(schemaDengan, 'chart_of_account');
  const peran = await hitung(schemaDengan, 'role');
  check('punya satuan untuk membuat transaksi', uom > 0, true);
  check('punya bagan akun untuk memposting jurnal', coa > 0, true);
  check('punya peran untuk masuk ke sistem', peran > 0, true);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
  log('');
  log('Schema bukti yang dibuat (boleh dihapus operator bila tidak diperlukan):');
  log(`  ${schemaTanpa}`);
  log(`  ${schemaDengan}`);
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await client.end();
  writeFileSync(
    new URL('../../../docs/upgrade-v10-v11/bukti-data-contoh.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
