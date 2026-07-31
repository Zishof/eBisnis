/**
 * Bukti pembayaran bersaldo eksternal pada kasir (IR-002).
 *
 * Yang dibuktikan berpusat pada satu keadaan yang tidak boleh terjadi:
 *
 *   **Penjualan tercatat lunas sementara tidak ada dana yang berpindah.**
 *
 * Aturannya sudah diuji sebagai fungsi murni. Yang dibuktikan DI SINI adalah
 * hal yang tidak dapat diuji tanpa basis data: bahwa constraint benar-benar
 * menolak keadaan yang tidak dapat dijelaskan, dan bahwa penahanan yang
 * menggantung dapat ditemukan kembali oleh penjadwal pelepas.
 *
 * Seluruhnya di dalam BEGIN … ROLLBACK; basis data tidak berubah.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  bolehDiproses,
  bolehDiselesaikan,
  perluDilepaskan,
  perluDiwujudkan,
} from '../dist/modules/pos/pos-external-payment.js';
import { ExternalPaymentRegistry } from '../dist/modules/pos/external-payment.registry.js';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: url });
const lines = [];
const log = (t) => { lines.push(t); console.log(t); };

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

async function harusDitolak(label, sql, params = []) {
  let ditolak = false;
  try {
    await client.query('SAVEPOINT s');
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT s');
  } catch {
    ditolak = true;
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check(label, ditolak, ditolak ? '' : 'diterima padahal seharusnya ditolak');
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');
const S = 'demo';

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI PEMBAYARAN BERSALDO EKSTERNAL PADA KASIR (IR-002)');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${S}`);
  log('='.repeat(78));

  // ------------------------------------------------------------------ Skema
  log('');
  log('1. Kolom penahanan terpasang');

  for (const [tabel, kolom] of [
    ['payment_method', 'external_handler'],
    ['pos_payment', 'external_handler'],
    ['pos_payment', 'external_reference'],
    ['pos_payment', 'external_state'],
    ['pos_payment', 'external_captured_at'],
  ]) {
    const r = await q(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
      [S, tabel, kolom],
    );
    check(`${tabel}.${kolom} ada`, r.length === 1);
  }

  // ---------------------------------------------- Metode pembayaran
  log('');
  log('2. Metode EXTERNAL_BALANCE wajib menyebut penangannya');

  await harusDitolak(
    'metode EXTERNAL_BALANCE tanpa penangan DITOLAK',
    `INSERT INTO "${S}".payment_method (code, name, method_type, sort_order)
     VALUES ($1, 'Saldo Tanpa Penangan', 'EXTERNAL_BALANCE', 900)`,
    [`EXT-NOH-${tag}`],
  );

  const metode = await q(
    `INSERT INTO "${S}".payment_method
       (code, name, method_type, external_handler, allows_change, sort_order)
     VALUES ($1, 'Saldo Simpanan Anggota', 'EXTERNAL_BALANCE', 'COOPERATIVE_MEMBER_BALANCE', false, 901)
     RETURNING id`,
    [`EXT-${tag}`],
  );
  check('metode dengan penangan DITERIMA', metode.length === 1);

  // ------------------------------------------------------ Penjualan contoh
  log('');
  log('3. Pembayaran menyimpan rujukan penahanannya');

  const outlet = await q(`SELECT id FROM "${S}".outlet LIMIT 1`);
  if (!outlet.length) throw new Error('tidak ada outlet pada skema demo');

  const jual = await q(
    `INSERT INTO "${S}".pos_sale
       (outlet_id, business_date, status, subtotal, grand_total, currency_code)
     VALUES ($1, CURRENT_DATE, 'PAYMENT_PENDING', 50000, 50000, 'IDR')
     RETURNING id`,
    [outlet[0].id],
  );
  const saleId = jual[0].id;

  const bayar = await q(
    `INSERT INTO "${S}".pos_payment
       (pos_sale_id, payment_method_id, amount, tendered_amount, change_amount,
        status, idempotency_key, sequence_no, external_handler, external_reference, external_state)
     VALUES ($1, $2, 50000, 50000, 0, 'RECEIVED', $3, 1,
             'COOPERATIVE_MEMBER_BALANCE', $4, 'AUTHORIZED')
     RETURNING id, external_state`,
    [saleId, metode[0].id, `IDEM-${tag}`, `REF-${tag}`],
  );
  check('pembayaran tersimpan berstatus AUTHORIZED', bayar[0].external_state === 'AUTHORIZED');

  await harusDitolak(
    'rujukan tanpa penangan DITOLAK',
    `INSERT INTO "${S}".pos_payment
       (pos_sale_id, payment_method_id, amount, tendered_amount, change_amount,
        status, idempotency_key, sequence_no, external_reference)
     VALUES ($1, $2, 1, 1, 0, 'RECEIVED', $3, 2, $4)`,
    [saleId, metode[0].id, `IDEM2-${tag}`, `REF2-${tag}`],
  );

  await harusDitolak(
    'keadaan penahanan di luar daftar DITOLAK',
    `UPDATE "${S}".pos_payment SET external_state = 'DIPOTONG_SAJA' WHERE id = $1`,
    [bayar[0].id],
  );

  await harusDitolak(
    'CAPTURED tanpa waktu pewujudan DITOLAK',
    `UPDATE "${S}".pos_payment SET external_state = 'CAPTURED' WHERE id = $1`,
    [bayar[0].id],
  );

  // --------------------------------------------------------- Aturan murni
  log('');
  log('4. Aturan memilih baris yang benar dari basis data');

  const baris = (
    await q(
      `SELECT id, external_handler, external_reference, external_state, status
         FROM "${S}".pos_payment WHERE pos_sale_id = $1`,
      [saleId],
    )
  ).map((x) => ({
    id: x.id,
    externalHandler: x.external_handler,
    externalReference: x.external_reference,
    externalState: x.external_state,
    status: x.status,
  }));

  check('penjualan siap diselesaikan', bolehDiselesaikan(baris).allowed === true);
  check('satu penahanan perlu diwujudkan', perluDiwujudkan(baris).length === 1);
  check('satu penahanan perlu dilepaskan bila batal', perluDilepaskan(baris).length === 1);

  // Setelah diwujudkan, tidak boleh diwujudkan lagi maupun dilepaskan.
  await q(
    `UPDATE "${S}".pos_payment
        SET external_state = 'CAPTURED', external_captured_at = now() WHERE id = $1`,
    [bayar[0].id],
  );
  const sesudah = (
    await q(
      `SELECT id, external_handler, external_reference, external_state, status
         FROM "${S}".pos_payment WHERE pos_sale_id = $1`,
      [saleId],
    )
  ).map((x) => ({
    id: x.id,
    externalHandler: x.external_handler,
    externalReference: x.external_reference,
    externalState: x.external_state,
    status: x.status,
  }));
  check(
    'yang sudah diwujudkan TIDAK diwujudkan lagi',
    perluDiwujudkan(sesudah).length === 0,
  );
  check(
    'yang sudah diwujudkan TIDAK dilepaskan — pengembaliannya lewat retur',
    perluDilepaskan(sesudah).length === 0,
  );

  // ------------------------------------------------- Penahanan menggantung
  log('');
  log('5. Penahanan yang menggantung dapat ditemukan penjadwal');

  const gantung = await q(
    `INSERT INTO "${S}".pos_payment
       (pos_sale_id, payment_method_id, amount, tendered_amount, change_amount,
        status, idempotency_key, sequence_no, external_handler, external_reference, external_state)
     VALUES ($1, $2, 10000, 10000, 0, 'REVERSED', $3, 3,
             'COOPERATIVE_MEMBER_BALANCE', $4, 'AUTHORIZED')
     RETURNING id`,
    [saleId, metode[0].id, `IDEM3-${tag}`, `REF3-${tag}`],
  );

  const tertinggal = await q(
    `SELECT id FROM "${S}".pos_payment
      WHERE external_state = 'AUTHORIZED' AND external_handler = 'COOPERATIVE_MEMBER_BALANCE'
        AND pos_sale_id = $1`,
    [saleId],
  );
  check(
    'penahanan yang pembayarannya dibatalkan tetap terlihat',
    tertinggal.some((r) => r.id === gantung[0].id),
  );

  const indeks = await q(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = $1 AND tablename = 'pos_payment'
        AND indexname = 'ix_pos_payment_external_pending'`,
    [S],
  );
  check('indeks parsial penjadwal pelepas terpasang', indeks.length === 1);

  const perluLepas = (
    await q(
      `SELECT id, external_handler, external_reference, external_state, status
         FROM "${S}".pos_payment WHERE id = $1`,
      [gantung[0].id],
    )
  ).map((x) => ({
    id: x.id,
    externalHandler: x.external_handler,
    externalReference: x.external_reference,
    externalState: x.external_state,
    status: x.status,
  }));
  check(
    'pembayaran yang dibatalkan kasir tetap perlu dilepaskan',
    perluDilepaskan(perluLepas).length === 1,
  );

  // ------------------------------------------------------------- Registri
  log('');
  log('6. Registri menolak metode yang penangannya tidak ada');

  const reg = new ExternalPaymentRegistry();
  const metodeUji = {
    methodType: 'EXTERNAL_BALANCE',
    externalHandler: 'COOPERATIVE_MEMBER_BALANCE',
    name: 'Saldo Simpanan Anggota',
  };
  check(
    'metode eksternal ditolak selama penangannya belum terdaftar',
    bolehDiproses(metodeUji, reg.has('COOPERATIVE_MEMBER_BALANCE')).allowed === false,
  );

  reg.register({
    handlerCode: 'COOPERATIVE_MEMBER_BALANCE',
    authorize: async () => ({ authorized: true, reference: 'REF' }),
    capture: async () => undefined,
    reverse: async () => undefined,
  });
  check(
    'setelah terdaftar, metode diterima',
    bolehDiproses(metodeUji, reg.has('COOPERATIVE_MEMBER_BALANCE')).allowed === true,
  );

  let melempar = false;
  try {
    reg.require('TIDAK_ADA');
  } catch {
    melempar = true;
  }
  check('penangan yang tidak ada MELEMPAR, bukan lolos diam-diam', melempar);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await client.query('ROLLBACK');
  log('');
  log('Seluruh perubahan digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/integration-requests/bukti-pos-external-payment.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
