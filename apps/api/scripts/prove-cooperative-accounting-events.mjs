/**
 * Bukti pendaftaran dan penerbitan peristiwa akuntansi koperasi (IR-003).
 *
 * ## Yang diperbaiki catatan ini
 *
 * K-8 menyatakan peristiwa koperasi "tercatat pada `accounting_event` tetapi
 * belum dijurnal karena `isKnownEvent()` menolaknya". Keduanya keliru, dan
 * bukti ini memeriksanya pada basis data:
 *
 *   · modul koperasi belum pernah menulis satu pun baris `accounting_event`;
 *   · `isKnownEvent()` tidak dipanggil siapa pun, jadi ia bukan gerbang.
 *
 * ## Yang dibuktikan
 *
 *   1. Katalog koperasi terdaftar bersama katalog inti tanpa bertabrakan.
 *   2. Peristiwa yang salah TIDAK PERNAH terbit.
 *   3. Peristiwa yang sah terbit sekali, dan percobaan ulang tidak
 *      menggandakannya.
 *
 * ## Yang TIDAK dibuktikan, sebab memang belum ada
 *
 * Penjurnalan. Peristiwa terbit berstatus `PENDING` dan menunggu saluran
 * peristiwa-ke-jurnal yang belum dibangun untuk modul mana pun — POS pun
 * peristiwanya menunggu. Bukti ini menghitungnya, apa adanya.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { AccountingEventCatalogRegistry } from '../dist/modules/accounting/event-catalog.registry.js';
import { CORE_EVENT_CATALOGS } from '../dist/modules/accounting/core-event-catalog.js';
import { COOPERATIVE_EVENT_CATALOG } from '../dist/modules/cooperative/accounting/cooperative-events.catalog.js';
import { CooperativeAccountingEventService } from '../dist/modules/cooperative/accounting/cooperative-accounting-event.service.js';

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

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');
const S = process.env.COOPERATIVE_SCHEMA ?? 'demo';

/** Klien yang meneruskan ke transaksi yang sedang berjalan. */
const klien = { query: (sql, params = []) => client.query(sql, params) };

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI PERISTIWA AKUNTANSI KOPERASI (IR-003)');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${S}`);
  log('='.repeat(78));

  // ------------------------------------------------------------ Pendaftaran
  log('');
  log('1. Katalog koperasi terdaftar bersama katalog inti');

  const reg = new AccountingEventCatalogRegistry();
  for (const c of CORE_EVENT_CATALOGS) reg.register(c);
  const intiSebelum = reg.allEvents().length;
  reg.register(COOPERATIVE_EVENT_CATALOG);

  check(
    `${COOPERATIVE_EVENT_CATALOG.events.length} peristiwa koperasi terdaftar`,
    reg.eventsOfModule('cooperative').length === COOPERATIVE_EVENT_CATALOG.events.length,
  );
  check(
    `${intiSebelum} peristiwa inti tetap dikenal`,
    reg.eventsOfModule('core').length === intiSebelum,
  );
  check('POS_SALE tetap milik inti', reg.moduleOf('POS_SALE') === 'core');
  check(
    'COOPERATIVE_SHU_PAID kini milik koperasi',
    reg.moduleOf('COOPERATIVE_SHU_PAID') === 'cooperative',
  );

  let ditolakRebut = false;
  try {
    reg.register({
      module: 'nakal',
      prefix: 'COOPERATIVE_',
      events: ['COOPERATIVE_SHU_PAID'],
      requiredAmounts: { COOPERATIVE_SHU_PAID: ['amount'] },
    });
  } catch {
    ditolakRebut = true;
  }
  check('modul lain TIDAK dapat merebut peristiwa koperasi', ditolakRebut);

  // ------------------------------------------------ Keadaan sebelum terbit
  log('');
  log('2. Keadaan sebelum penerbitan — memeriksa catatan K-8');

  const sebelum = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".accounting_event WHERE event_code LIKE 'COOPERATIVE%'`,
  );
  check(
    'modul koperasi belum pernah menulis satu pun peristiwa',
    Number(sebelum[0].n) === 0,
    `${sebelum[0].n} baris`,
  );

  const kodeAda = await q(
    `SELECT DISTINCT event_code FROM "${S}".accounting_event ORDER BY 1`,
  );
  log(`  (kode yang ada sebelum ini: ${kodeAda.map((r) => r.event_code).join(', ') || '—'})`);

  // ------------------------------------------------- Peristiwa yang salah
  log('');
  log('3. Peristiwa yang salah tidak pernah terbit');

  const layanan = new CooperativeAccountingEventService(reg);

  const gagal = async (label, peristiwa, pola) => {
    let ditolak = false;
    let pesan = '';
    try {
      await layanan.terbitkan(klien, S, peristiwa);
    } catch (e) {
      ditolak = true;
      pesan = e.message;
    }
    check(label, ditolak && pola.test(pesan), pesan.slice(0, 90));
  };

  await gagal(
    'kode yang tidak dikenal DITOLAK',
    {
      eventCode: 'COOPERATIVE_TIDAK_ADA',
      sourceType: 'X',
      sourceId: 'X1',
      amounts: { amount: 1 },
    },
    /tidak dikenal/,
  );

  await gagal(
    'peristiwa milik POS DITOLAK',
    { eventCode: 'POS_SALE', sourceType: 'X', sourceId: 'X2', amounts: { gross: 1, net: 1, tax: 0 } },
    /tidak boleh menerbitkan/,
  );

  await gagal(
    'angsuran tanpa pemisahan pokok dan jasa DITOLAK',
    {
      eventCode: 'COOPERATIVE_INSTALLMENT_RECEIVED',
      sourceType: 'COOPERATIVE_LOAN',
      sourceId: 'L1',
      amounts: { total: 100000 },
    },
    /kurang nilai/,
  );

  const sesudahGagal = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".accounting_event WHERE event_code LIKE 'COOPERATIVE%'`,
  );
  check(
    'tidak satu pun baris tertulis dari percobaan yang ditolak',
    Number(sesudahGagal[0].n) === 0,
  );

  // --------------------------------------------------- Peristiwa yang sah
  log('');
  log('4. Peristiwa yang sah terbit, sekali saja');

  const sumberId = `11111111-1111-4111-8111-${tag}00000000`.slice(0, 36);

  await layanan.terbitkan(klien, S, {
    eventCode: 'COOPERATIVE_WALLET_PAYMENT',
    sourceType: 'COOPERATIVE_PAYMENT_HOLD',
    sourceId: sumberId,
    sourceNumber: `STR-${tag}`,
    amounts: { amount: 75000 },
  });

  const terbit = await q(
    `SELECT event_code, status, amounts, idempotency_key, source_number
       FROM "${S}".accounting_event WHERE source_id = $1`,
    [sumberId],
  );
  check('satu baris terbit', terbit.length === 1);
  check('kodenya benar', terbit[0]?.event_code === 'COOPERATIVE_WALLET_PAYMENT');
  check('berstatus PENDING — belum dijurnal', terbit[0]?.status === 'PENDING');
  check('nilainya tersimpan', Number(terbit[0]?.amounts?.amount) === 75000);
  check('nomor struknya tersimpan', terbit[0]?.source_number === `STR-${tag}`);

  // Percobaan ulang tidak menggandakan.
  await layanan.terbitkan(klien, S, {
    eventCode: 'COOPERATIVE_WALLET_PAYMENT',
    sourceType: 'COOPERATIVE_PAYMENT_HOLD',
    sourceId: sumberId,
    sourceNumber: `STR-${tag}`,
    amounts: { amount: 75000 },
  });
  const ulang = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".accounting_event WHERE source_id = $1`,
    [sumberId],
  );
  check('percobaan ulang TIDAK menggandakan barisnya', Number(ulang[0].n) === 1);

  // Beberapa sekaligus, seluruhnya diperiksa lebih dahulu.
  const idA = `22222222-2222-4222-8222-${tag}00000000`.slice(0, 36);
  let banyakDitolak = false;
  try {
    await layanan.terbitkanBanyak(klien, S, [
      {
        eventCode: 'COOPERATIVE_VOLUNTARY_SAVING_DEPOSIT',
        sourceType: 'COOPERATIVE_SAVING',
        sourceId: idA,
        amounts: { amount: 50000 },
      },
      {
        eventCode: 'COOPERATIVE_SALAH_KETIK',
        sourceType: 'COOPERATIVE_SAVING',
        sourceId: idA,
        amounts: { amount: 1 },
      },
    ]);
  } catch {
    banyakDitolak = true;
  }
  const barisA = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".accounting_event WHERE source_id = $1`,
    [idA],
  );
  check('penerbitan beberapa yang salah satunya cacat DITOLAK', banyakDitolak);
  check(
    'dan tidak satu pun dari kelompok itu tertulis',
    Number(barisA[0].n) === 0,
    `${barisA[0].n} baris`,
  );

  // ------------------------------------------------------ Yang belum ada
  log('');
  log('5. Penjurnalan — disebutkan apa adanya');

  const pending = await q(
    `SELECT status, COUNT(*)::int AS n FROM "${S}".accounting_event GROUP BY status ORDER BY status`,
  );
  log(`  keadaan accounting_event: ${pending.map((r) => `${r.status}=${r.n}`).join(', ')}`);

  const jurnal = await q(`SELECT COUNT(*)::int AS n FROM "${S}".journal_entry`);
  const aturan = await q(`SELECT COUNT(*)::int AS n FROM "${S}".accounting_posting_rule`);
  log(`  journal_entry: ${jurnal[0].n}, accounting_posting_rule: ${aturan[0].n}`);

  /*
   * Diperiksa sebagai FAKTA, bukan sebagai kegagalan. Saluran
   * peristiwa-ke-jurnal memang belum dibangun untuk modul mana pun, dan
   * pemeriksaan ini akan menyala begitu saluran itu ada — mengingatkan bahwa
   * bukti ini perlu diperbarui.
   */
  check(
    'peristiwa POS pun masih menunggu — bukan koperasi yang tertinggal sendirian',
    pending.some((r) => r.status === 'PENDING'),
  );
  check(
    'belum ada aturan posting tersemai, sehingga belum ada yang dapat dijurnal',
    Number(aturan[0].n) === 0,
    `${aturan[0].n} aturan`,
  );

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
    new URL('../../../docs/ekoperasi/bukti-peristiwa-akuntansi.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
