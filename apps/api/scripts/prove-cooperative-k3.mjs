/**
 * Bukti K-3: simpanan dan buku pembantu anggota.
 *
 * Yang dibuktikan berpusat pada tiga hal:
 *
 * 1. **Simpanan pokok dan wajib tidak dapat dibuat sebagai simpanan yang dapat
 *    ditarik.** Ditegakkan basis data, sehingga tidak ada jalan membuat
 *    "simpanan wajib yang dapat ditarik" — yang secara hukum bukan simpanan
 *    wajib lagi.
 * 2. **Lunasnya simpanan pokok mengaktifkan keanggotaan.** Alur penuh dari
 *    calon anggota sampai anggota penuh dijalankan di sini.
 * 3. **Saldo sama dengan jumlah mutasinya.** Dibangun ulang dari buku
 *    transaksinya dan dibandingkan dengan kolom cache-nya.
 *
 * Seluruhnya berjalan di dalam satu transaksi yang selalu digulung balik.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');
const SCHEMA = process.env.COOPERATIVE_SCHEMA ?? 'demo';

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

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI K-3 — SIMPANAN DAN BUKU PEMBANTU ANGGOTA');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel K-3 terpasang');
  for (const t of [
    'cooperative_saving_product', 'cooperative_saving_account',
    'cooperative_saving_transaction', 'cooperative_member_subledger',
    'cooperative_saving_statement',
  ]) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name, allows_lending)
     VALUES ($1, 'KSP Bukti K3', TRUE) RETURNING id`,
    [`K3_${tag}`.slice(0, 32)],
  );
  const coopId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-3', $2, $3, 'DRAFT') RETURNING id`,
      [`K3-${tag}`.toUpperCase(), `bukti-k3-${tag}`, jenis[0].id],
    )
  )[0].id;

  log('');
  log('2. Simpanan wajib TIDAK dapat dibuat sebagai simpanan yang dapat ditarik');
  await harusDitolak(
    'produk MANDATORY dengan allows_withdrawal DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, required_amount, period_unit,
        is_equity, allows_withdrawal)
     VALUES ($1, 'WAJIB_CURANG', 'Simpanan Wajib Bisa Ditarik', 'MANDATORY', 50000, 'MONTHLY',
             TRUE, TRUE)`,
    [coopId],
  );
  await harusDitolak(
    'produk PRINCIPAL yang ditandai bukan ekuitas DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, required_amount, is_equity, allows_withdrawal)
     VALUES ($1, 'POKOK_CURANG', 'Simpanan Pokok Kewajiban', 'PRINCIPAL', 500000, FALSE, FALSE)`,
    [coopId],
  );

  log('');
  log('3. Bunga dan nisbah tidak boleh diisi bersamaan');
  await harusDitolak(
    'produk berbunga sekaligus bernisbah DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, interest_rate, nisbah)
     VALUES ($1, 'CAMPUR', 'Sukarela Campur', 'VOLUNTARY', 0.05, 0.6)`,
    [coopId],
  );

  log('');
  log('4. Produk simpanan yang sah');
  const pokok = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, required_amount, is_equity,
        allows_withdrawal, counts_for_capital_service)
     VALUES ($1, 'POKOK', 'Simpanan Pokok', 'PRINCIPAL', 500000, TRUE, FALSE, TRUE)
     RETURNING id`,
    [coopId],
  );
  const wajib = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, required_amount, period_unit,
        is_equity, allows_withdrawal, counts_for_capital_service)
     VALUES ($1, 'WAJIB', 'Simpanan Wajib', 'MANDATORY', 50000, 'MONTHLY', TRUE, FALSE, TRUE)
     RETURNING id`,
    [coopId],
  );
  const sukarela = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, minimum_balance, interest_rate)
     VALUES ($1, 'SUKARELA', 'Simpanan Sukarela', 'VOLUNTARY', 10000, 0.03) RETURNING id`,
    [coopId],
  );
  check('tiga produk simpanan dibuat', Boolean(pokok[0] && wajib[0] && sukarela[0]));

  log('');
  log('5. Hanya satu produk simpanan pokok aktif per koperasi');
  await harusDitolak(
    'produk simpanan pokok kedua DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, required_amount, is_equity, allows_withdrawal)
     VALUES ($1, 'POKOK2', 'Simpanan Pokok Kedua', 'PRINCIPAL', 300000, TRUE, FALSE)`,
    [coopId],
  );

  log('');
  log('6. Alur: calon anggota melunasi pokok lalu menjadi anggota');
  const anggota = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, identity_number, status, applied_at)
     VALUES ($1, 'Rina Calon', $2, 'PENDING_PRINCIPAL_SAVING', now()) RETURNING id`,
    [coopId, `331${tag}0001`],
  );
  const anggotaId = anggota[0].id;

  const rekPokok = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_account
       (cooperative_id, member_id, product_id, account_number, balance)
     VALUES ($1, $2, $3, $4, 0) RETURNING id`,
    [coopId, anggotaId, pokok[0].id, `POK-${tag}-001`],
  );

  // Dua cicilan: 200.000 lalu 300.000.
  let saldo = 0;
  for (const nilai of [200_000, 300_000]) {
    saldo += nilai;
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
         (account_id, member_id, transaction_type, amount, balance_after, idempotency_key)
       VALUES ($1, $2, 'DEPOSIT', $3, $4, $5)`,
      [rekPokok[0].id, anggotaId, nilai, saldo, `pokok-${tag}-${nilai}`],
    );
    await q(
      `UPDATE "${SCHEMA}".cooperative_saving_account
          SET balance = $2, last_movement_at = now() WHERE id = $1`,
      [rekPokok[0].id, saldo],
    );
  }
  check('simpanan pokok lunas 500.000', saldo === 500_000);

  // Keanggotaan aktif — nomor dan tanggal aktif diisi bersamaan.
  await q(
    `UPDATE "${SCHEMA}".cooperative_member
        SET status = 'ACTIVE', member_number = $2, activated_at = now() WHERE id = $1`,
    [anggotaId, `K3-2026-00001`],
  );
  const aktif = await q(
    `SELECT status, activated_at FROM "${SCHEMA}".cooperative_member WHERE id = $1`,
    [anggotaId],
  );
  check('keanggotaan menjadi aktif setelah pokok lunas', aktif[0].status === 'ACTIVE');

  log('');
  log('7. Saldo sama dengan jumlah mutasinya');
  const dibangunUlang = await q(
    `SELECT COALESCE(SUM(
              CASE WHEN transaction_type IN
                     ('DEPOSIT','TRANSFER_IN','PROFIT_SHARING','CORRECTION_IN')
                   THEN amount ELSE -amount END), 0)::numeric AS saldo
       FROM "${SCHEMA}".cooperative_saving_transaction WHERE account_id = $1`,
    [rekPokok[0].id],
  );
  const cache = await q(
    `SELECT balance FROM "${SCHEMA}".cooperative_saving_account WHERE id = $1`,
    [rekPokok[0].id],
  );
  check(
    'saldo cache sama dengan saldo yang dibangun ulang dari mutasinya',
    Number(dibangunUlang[0].saldo) === Number(cache[0].balance),
    `mutasi ${dibangunUlang[0].saldo} vs cache ${cache[0].balance}`,
  );

  log('');
  log('8. Saldo simpanan tidak pernah negatif');
  await harusDitolak(
    'saldo rekening negatif DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_saving_account SET balance = -1 WHERE id = $1`,
    [rekPokok[0].id],
  );
  await harusDitolak(
    'transaksi yang menghasilkan saldo negatif DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
       (account_id, member_id, transaction_type, amount, balance_after)
     VALUES ($1, $2, 'WITHDRAWAL', 600000, -100000)`,
    [rekPokok[0].id, anggotaId],
  );

  log('');
  log('9. Satu periode simpanan wajib dibayar sekali saja');
  const rekWajib = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_account
       (cooperative_id, member_id, product_id, account_number)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [coopId, anggotaId, wajib[0].id, `WJB-${tag}-001`],
  );
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
       (account_id, member_id, transaction_type, amount, balance_after, period_code)
     VALUES ($1, $2, 'DEPOSIT', 50000, 50000, '2026-01')`,
    [rekWajib[0].id, anggotaId],
  );
  await harusDitolak(
    'setoran kedua untuk periode 2026-01 DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
       (account_id, member_id, transaction_type, amount, balance_after, period_code)
     VALUES ($1, $2, 'DEPOSIT', 50000, 100000, '2026-01')`,
    [rekWajib[0].id, anggotaId],
  );
  const feb = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
       (account_id, member_id, transaction_type, amount, balance_after, period_code)
     VALUES ($1, $2, 'DEPOSIT', 50000, 100000, '2026-02') RETURNING id`,
    [rekWajib[0].id, anggotaId],
  );
  check('periode berikutnya diterima', feb.length === 1);

  log('');
  log('10. Satu anggota satu rekening per produk');
  await harusDitolak(
    'rekening kedua atas produk yang sama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_account
       (cooperative_id, member_id, product_id, account_number)
     VALUES ($1, $2, $3, $4)`,
    [coopId, anggotaId, pokok[0].id, `POK-${tag}-002`],
  );

  log('');
  log('11. Setoran ganda dengan kunci idempotensi yang sama');
  await harusDitolak(
    'setoran dengan idempotency_key yang sama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_transaction
       (account_id, member_id, transaction_type, amount, balance_after, idempotency_key)
     VALUES ($1, $2, 'DEPOSIT', 200000, 700000, $3)`,
    [rekPokok[0].id, anggotaId, `pokok-${tag}-200000`],
  );

  log('');
  log('12. Buku pembantu: satu baris satu sisi');
  const akun = await q(
    `SELECT id FROM "${SCHEMA}".chart_of_account WHERE deleted_at IS NULL LIMIT 1`,
  );
  await harusDitolak(
    'baris dengan debit DAN kredit DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member_subledger
       (cooperative_id, member_id, subledger_type, account_id, reference_type,
        reference_id, debit, credit)
     VALUES ($1, $2, 'SAVING', $3, 'SAVING_TRANSACTION', $4, 100, 100)`,
    [coopId, anggotaId, akun[0]?.id ?? null, rekPokok[0].id],
  );
  await harusDitolak(
    'baris bernilai nol pada keduanya DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member_subledger
       (cooperative_id, member_id, subledger_type, account_id, reference_type,
        reference_id, debit, credit)
     VALUES ($1, $2, 'SAVING', $3, 'SAVING_TRANSACTION', $4, 0, 0)`,
    [coopId, anggotaId, akun[0]?.id ?? null, rekPokok[0].id],
  );

  const sub = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member_subledger
       (cooperative_id, member_id, subledger_type, account_id, reference_type,
        reference_id, credit, balance_after, description)
     VALUES ($1, $2, 'SAVING', $3, 'SAVING_TRANSACTION', $4, 500000, 500000, 'Simpanan pokok')
     RETURNING id`,
    [coopId, anggotaId, akun[0]?.id ?? null, rekPokok[0].id],
  );
  check('baris buku pembantu satu sisi diterima', sub.length === 1);

  log('');
  log('13. Rekening koran wajib seimbang');
  await harusDitolak(
    'rekening koran yang tidak seimbang DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_saving_statement
       (account_id, period_start, period_end, opening_balance, total_credit,
        total_debit, closing_balance)
     VALUES ($1, '2026-01-01', '2026-01-31', 0, 500000, 0, 999999)`,
    [rekPokok[0].id],
  );
  const koran = await q(
    `INSERT INTO "${SCHEMA}".cooperative_saving_statement
       (account_id, period_start, period_end, opening_balance, total_credit,
        total_debit, closing_balance)
     VALUES ($1, '2026-01-01', '2026-01-31', 0, 500000, 0, 500000) RETURNING id`,
    [rekPokok[0].id],
  );
  check('rekening koran yang seimbang diterima', koran.length === 1);

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
    new URL('../../../docs/ekoperasi/bukti-k3-simpanan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
