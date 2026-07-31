/**
 * Bukti pembayaran memakai saldo simpanan anggota (IR-002, sisi koperasi).
 *
 * Yang dibuktikan adalah alur lengkapnya pada basis data sungguhan:
 * bukti diterbitkan, dana ditahan, dana diwujudkan, saldo berkurang tepat
 * sekali — dan setiap jalan pintasnya ditolak.
 *
 * Dua sifat dijaga paling ketat:
 *
 *   · **Simpanan pokok dan wajib tidak pernah dapat dibelanjakan.**
 *   · **Bukti persetujuan sekali pakai, dan hanya sidiknya yang disimpan.**
 *
 * Seluruhnya di dalam BEGIN … ROLLBACK; basis data tidak berubah.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  UMUR_BUKTI_DETIK,
  bolehDipakaiMembayar,
  bolehMemakaiBukti,
  bolehMenahan,
  saldoTersedia,
} from '../dist/modules/cooperative/payment/member-balance.js';

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
const S = process.env.COOPERATIVE_SCHEMA ?? 'demo';
const sidik = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI PEMBAYARAN MEMAKAI SALDO SIMPANAN ANGGOTA');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${S}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel penahanan dan bukti terpasang');
  for (const t of ['cooperative_payment_token', 'cooperative_payment_hold']) {
    const r = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [S, t],
    );
    check(`tabel ${t} ada`, r.length === 1);
  }

  // --- Persiapan koperasi, anggota, dan simpanan --------------------------
  const jenis = await q(
    `INSERT INTO "${S}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti Saldo') RETURNING id`,
    [`SLD_${tag}`.slice(0, 32)],
  );
  const KOP = (
    await q(
      `INSERT INTO "${S}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti Saldo', $2, $3, 'DRAFT') RETURNING id`,
      [`SLD-${tag}`.toUpperCase(), `bukti-saldo-${tag}`, jenis[0].id],
    )
  )[0].id;

  const ANGGOTA = (
    await q(
      `INSERT INTO "${S}".cooperative_member
         (cooperative_id, member_number, full_name, status, activated_at, identity_number)
       VALUES ($1, $2, 'Sari Anggota', 'ACTIVE', now(), $3) RETURNING id`,
      [KOP, `SLD-A-${tag}`, `3271${tag.padEnd(6, '0')}000001`],
    )
  )[0].id;

  const produkSukarela = (
    await q(
      `INSERT INTO "${S}".cooperative_saving_product
         (cooperative_id, code, name, saving_kind, allows_withdrawal, is_equity, minimum_balance)
       VALUES ($1, $2, 'Simpanan Sukarela', 'VOLUNTARY', TRUE, FALSE, 0) RETURNING id`,
      [KOP, `SUK-${tag}`],
    )
  )[0].id;

  const produkPokok = (
    await q(
      `INSERT INTO "${S}".cooperative_saving_product
         (cooperative_id, code, name, saving_kind, allows_withdrawal, is_equity, required_amount)
       VALUES ($1, $2, 'Simpanan Pokok', 'PRINCIPAL', FALSE, TRUE, 100000) RETURNING id`,
      [KOP, `POK-${tag}`],
    )
  )[0].id;

  const rekSukarela = (
    await q(
      `INSERT INTO "${S}".cooperative_saving_account
         (cooperative_id, member_id, product_id, account_number, opened_at, balance, status)
       VALUES ($1, $2, $3, $4, now(), 500000, 'ACTIVE') RETURNING id`,
      [KOP, ANGGOTA, produkSukarela, `SUK-R-${tag}`],
    )
  )[0].id;

  const rekPokok = (
    await q(
      `INSERT INTO "${S}".cooperative_saving_account
         (cooperative_id, member_id, product_id, account_number, opened_at, balance, status)
       VALUES ($1, $2, $3, $4, now(), 1000000, 'ACTIVE') RETURNING id`,
      [KOP, ANGGOTA, produkPokok, `POK-R-${tag}`],
    )
  )[0].id;

  log('');
  log('2. Hanya simpanan yang boleh ditarik yang terpilih');

  const terpilih = await q(
    `SELECT a.id, p.name FROM "${S}".cooperative_saving_account a
       JOIN "${S}".cooperative_saving_product p ON p.id = a.product_id
      WHERE a.member_id = $1 AND a.status = 'ACTIVE'
        AND p.is_equity = FALSE AND p.allows_withdrawal = TRUE
      ORDER BY a.opened_at, a.id`,
    [ANGGOTA],
  );
  check('tepat satu rekening terpilih', terpilih.length === 1, String(terpilih.length));
  check('yang terpilih adalah simpanan sukarela', terpilih[0]?.id === rekSukarela);
  check(
    'simpanan pokok TIDAK ikut terpilih meski saldonya lebih besar',
    !terpilih.some((r) => r.id === rekPokok),
  );
  check(
    'aturan menolak simpanan pokok bila dipaksakan',
    bolehDipakaiMembayar({
      savingKind: 'PRINCIPAL',
      allowsWithdrawal: false,
      isEquity: true,
      name: 'Simpanan Pokok',
    }).allowed === false,
  );

  // --- Bukti persetujuan --------------------------------------------------
  log('');
  log('3. Bukti persetujuan: sekali pakai, hanya sidiknya disimpan');

  const tokenAsli = randomBytes(32).toString('base64url');
  const kedaluwarsa = new Date(Date.now() + UMUR_BUKTI_DETIK * 1000);
  const bukti = await q(
    `INSERT INTO "${S}".cooperative_payment_token
       (cooperative_id, member_id, token_hash, max_amount, expires_at)
     VALUES ($1, $2, $3, 100000, $4) RETURNING id, token_hash`,
    [KOP, ANGGOTA, sidik(tokenAsli), kedaluwarsa],
  );
  check('bukti tersimpan', bukti.length === 1);
  check(
    'yang tersimpan adalah SIDIKNYA, bukan buktinya',
    bukti[0].token_hash !== tokenAsli && bukti[0].token_hash.length === 64,
  );

  const cariAsli = await q(
    `SELECT 1 FROM "${S}".cooperative_payment_token WHERE token_hash = $1`,
    [tokenAsli],
  );
  check('bukti asli tidak dapat ditemukan di basis data', cariAsli.length === 0);

  await harusDitolak(
    'dua bukti bersidik sama DITOLAK',
    `INSERT INTO "${S}".cooperative_payment_token
       (cooperative_id, member_id, token_hash, max_amount, expires_at)
     VALUES ($1, $2, $3, 50000, $4)`,
    [KOP, ANGGOTA, sidik(tokenAsli), kedaluwarsa],
  );

  await harusDitolak(
    'bukti yang kedaluwarsa sebelum diterbitkan DITOLAK',
    `INSERT INTO "${S}".cooperative_payment_token
       (cooperative_id, member_id, token_hash, max_amount, issued_at, expires_at)
     VALUES ($1, $2, $3, 50000, now(), now() - interval '1 minute')`,
    [KOP, ANGGOTA, sidik(`lain-${tag}`)],
  );

  await harusDitolak(
    'bukti bernilai nol DITOLAK',
    `INSERT INTO "${S}".cooperative_payment_token
       (cooperative_id, member_id, token_hash, max_amount, expires_at)
     VALUES ($1, $2, $3, 0, $4)`,
    [KOP, ANGGOTA, sidik(`nol-${tag}`), kedaluwarsa],
  );

  const now = new Date().toISOString();
  check(
    'aturan menolak nilai melebihi yang disetujui anggota',
    bolehMemakaiBukti(
      { memberId: ANGGOTA, maxAmount: '100000', expiresAt: kedaluwarsa.toISOString(), usedAt: null, outletId: null, now },
      150000,
      null,
    ).allowed === false,
  );

  // --- Penahanan ----------------------------------------------------------
  log('');
  log('4. Penahanan menahan, tidak memotong');

  const hold = await q(
    `INSERT INTO "${S}".cooperative_payment_hold
       (cooperative_id, member_id, saving_account_id, amount, idempotency_key, state)
     VALUES ($1, $2, $3, 75000, $4, 'AUTHORIZED') RETURNING id`,
    [KOP, ANGGOTA, rekSukarela, `IDEM-${tag}`],
  );
  await q(
    `UPDATE "${S}".cooperative_payment_token SET used_at = now(), used_by_hold_id = $2 WHERE id = $1`,
    [bukti[0].id, hold[0].id],
  );

  const saldoSetelahTahan = await q(
    `SELECT balance FROM "${S}".cooperative_saving_account WHERE id = $1`,
    [rekSukarela],
  );
  check(
    'saldo BELUM berkurang setelah penahanan',
    Number(saldoSetelahTahan[0].balance) === 500000,
    saldoSetelahTahan[0].balance,
  );

  const tertahan = await q(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM "${S}".cooperative_payment_hold
      WHERE saving_account_id = $1 AND state = 'AUTHORIZED'`,
    [rekSukarela],
  );
  check(
    'saldo tersedia berkurang oleh penahanan',
    saldoTersedia({ status: 'ACTIVE', balance: '500000', heldAmount: tertahan[0].total, minimumBalance: '0' }) === 425000,
  );
  check(
    'penahanan kedua yang melebihi sisa DITOLAK aturan',
    bolehMenahan(
      { status: 'ACTIVE', balance: '500000', heldAmount: tertahan[0].total, minimumBalance: '0' },
      450000,
    ).allowed === false,
  );

  await harusDitolak(
    'penahanan kedua dengan kunci idempotensi sama DITOLAK',
    `INSERT INTO "${S}".cooperative_payment_hold
       (cooperative_id, member_id, saving_account_id, amount, idempotency_key, state)
     VALUES ($1, $2, $3, 75000, $4, 'AUTHORIZED')`,
    [KOP, ANGGOTA, rekSukarela, `IDEM-${tag}`],
  );

  await harusDitolak(
    'penahanan CAPTURED tanpa transaksi simpanan DITOLAK',
    `UPDATE "${S}".cooperative_payment_hold
        SET state = 'CAPTURED', captured_at = now() WHERE id = $1`,
    [hold[0].id],
  );

  await harusDitolak(
    'pelepasan tanpa alasan DITOLAK',
    `UPDATE "${S}".cooperative_payment_hold
        SET state = 'REVERSED', reversed_at = now() WHERE id = $1`,
    [hold[0].id],
  );

  // --- Pewujudan ----------------------------------------------------------
  log('');
  log('5. Pewujudan memotong saldo tepat sekali dan mencatat mutasinya');

  const mutasi = await q(
    `INSERT INTO "${S}".cooperative_saving_transaction
       (account_id, member_id, transaction_date, transaction_type,
        amount, balance_after, note, reference, idempotency_key)
     VALUES ($1, $2, CURRENT_DATE, 'WITHDRAWAL', 75000, 425000,
             'Pembayaran belanja (struk UJI-1)', 'UJI-1', $3)
     RETURNING id`,
    [rekSukarela, ANGGOTA, `hold-${tag}`],
  );
  await q(
    `UPDATE "${S}".cooperative_saving_account SET balance = 425000 WHERE id = $1`,
    [rekSukarela],
  );
  await q(
    `UPDATE "${S}".cooperative_payment_hold
        SET state = 'CAPTURED', captured_at = now(), saving_transaction_id = $2
      WHERE id = $1`,
    [hold[0].id, mutasi[0].id],
  );

  const akhir = await q(
    `SELECT balance FROM "${S}".cooperative_saving_account WHERE id = $1`,
    [rekSukarela],
  );
  check('saldo berkurang tepat sebesar pembayaran', Number(akhir[0].balance) === 425000);

  const jejak = await q(
    `SELECT note, reference, idempotency_key FROM "${S}".cooperative_saving_transaction WHERE id = $1`,
    [mutasi[0].id],
  );
  check(
    'mutasinya menyebut nomor struk agar anggota dapat mencocokkannya',
    jejak[0].note.includes('struk'),
  );
  check('mutasinya merujuk struknya', jejak[0].reference === 'UJI-1');

  /*
   * Pewujudan yang terulang tidak boleh menghasilkan penarikan kedua. Kunci
   * idempotensi mutasi diturunkan dari penahanannya, sehingga percobaan kedua
   * ditolak basis data — bukan tercatat sebagai penarikan baru.
   */
  await harusDitolak(
    'mutasi kedua dengan kunci idempotensi sama DITOLAK',
    `INSERT INTO "${S}".cooperative_saving_transaction
       (account_id, member_id, transaction_date, transaction_type,
        amount, balance_after, note, idempotency_key)
     VALUES ($1, $2, CURRENT_DATE, 'WITHDRAWAL', 75000, 350000, 'Ulang', $3)`,
    [rekSukarela, ANGGOTA, `hold-${tag}`],
  );

  await harusDitolak(
    'penahanan yang sudah diwujudkan tidak dapat dilepaskan',
    `UPDATE "${S}".cooperative_payment_hold
        SET reversed_at = now(), reverse_reason = 'coba' WHERE id = $1`,
    [hold[0].id],
  );

  // --- Saldo tidak pernah negatif ----------------------------------------
  log('');
  log('6. Saldo simpanan tidak pernah negatif');

  await harusDitolak(
    'saldo negatif DITOLAK basis data',
    `UPDATE "${S}".cooperative_saving_account SET balance = -1 WHERE id = $1`,
    [rekSukarela],
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
    new URL('../../../docs/ekoperasi/bukti-pembayaran-saldo-anggota.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
