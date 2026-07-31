/**
 * Bukti K-4: pinjaman, angsuran, dan penagihan.
 *
 * Yang dibuktikan berpusat pada pemisahan wewenang dan keutuhan uang:
 *
 * - penganalisis tidak boleh sama dengan penyurvei;
 * - penyetuju tidak boleh sama dengan penganalisis;
 * - penghapusbukuan menuntut DUA orang berbeda;
 * - alokasi pembayaran wajib berjumlah sama dengan nilai yang diterima;
 * - akad syariah tidak boleh membawa bunga, dan sebaliknya;
 * - janji bayar tanpa angka ditolak.
 *
 * Seluruhnya berjalan dalam satu transaksi yang selalu digulung balik.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
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
const U1 = randomUUID(), U2 = randomUUID(), U3 = randomUUID(), U4 = randomUUID();

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI K-4 — PINJAMAN, ANGSURAN, DAN PENAGIHAN');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel K-4 terpasang');
  for (const t of [
    'cooperative_loan_product', 'cooperative_loan_application', 'cooperative_collateral',
    'cooperative_guarantor', 'cooperative_credit_analysis', 'cooperative_loan',
    'cooperative_loan_disbursement', 'cooperative_installment_schedule',
    'cooperative_installment_payment', 'cooperative_loan_restructuring',
    'cooperative_collection_case', 'cooperative_collection_activity',
  ]) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name, allows_lending)
     VALUES ($1, 'KSP Bukti K4', TRUE) RETURNING id`,
    [`K4_${tag}`.slice(0, 32)],
  );
  const coopId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-4', $2, $3, 'DRAFT') RETURNING id`,
      [`K4-${tag}`.toUpperCase(), `bukti-k4-${tag}`, jenis[0].id],
    )
  )[0].id;
  const anggotaId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_member
         (cooperative_id, full_name, status, member_number, activated_at)
       VALUES ($1, 'Joko Peminjam', 'ACTIVE', $2, now()) RETURNING id`,
      [coopId, `K4-2026-00001`],
    )
  )[0].id;

  log('');
  log('2. Akad syariah tidak boleh membawa bunga, dan sebaliknya');
  await harusDitolak(
    'produk MURABAHA dengan annual_rate DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_product
       (cooperative_id, code, name, method, annual_rate)
     VALUES ($1, 'MRB_CURANG', 'Murabahah Berbunga', 'MURABAHA', 0.12)`,
    [coopId],
  );
  await harusDitolak(
    'produk EFFECTIVE dengan nisbah DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_product
       (cooperative_id, code, name, method, nisbah)
     VALUES ($1, 'EFF_CURANG', 'Efektif Bernisbah', 'EFFECTIVE', 0.6)`,
    [coopId],
  );
  await harusDitolak(
    'produk QARDH berimbalan DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_product
       (cooperative_id, code, name, method, margin_rate)
     VALUES ($1, 'QRD_CURANG', 'Qardh Bermargin', 'QARDH', 0.05)`,
    [coopId],
  );

  const produk = await q(
    `INSERT INTO "${SCHEMA}".cooperative_loan_product
       (cooperative_id, code, name, method, annual_rate, min_amount, max_amount,
        min_tenor_months, max_tenor_months, penalty_daily_rate, penalty_grace_days)
     VALUES ($1, 'PROD1', 'Pinjaman Umum', 'FLAT', 0.12, 500000, 50000000, 1, 36, 0.001, 7)
     RETURNING id`,
    [coopId],
  );
  check('produk pinjaman yang sah dibuat', produk.length === 1);

  log('');
  log('3. Pemisahan wewenang pada pengajuan');
  const pengajuan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_loan_application
       (cooperative_id, member_id, product_id, requested_amount, requested_tenor,
        status, submitted_at, submitted_by, surveyed_at, surveyed_by)
     VALUES ($1, $2, $3, 12000000, 12, 'UNDER_SURVEY', now(), $4, now(), $4)
     RETURNING id`,
    [coopId, anggotaId, produk[0].id, U1],
  );
  const pengajuanId = pengajuan[0].id;

  await harusDitolak(
    'penyurvei menganalisis surveinya sendiri DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_loan_application
        SET analyzed_by = $2, analyzed_at = now(), status = 'UNDER_ANALYSIS' WHERE id = $1`,
    [pengajuanId, U1],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative_loan_application
        SET analyzed_by = $2, analyzed_at = now(), status = 'UNDER_ANALYSIS' WHERE id = $1`,
    [pengajuanId, U2],
  );
  check('penganalisis yang berbeda dari penyurvei DITERIMA', true);

  await harusDitolak(
    'penganalisis menyetujui analisisnya sendiri DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_loan_application
        SET approved_by = $2, approved_at = now(), approved_amount = 12000000,
            approved_tenor = 12, status = 'APPROVED' WHERE id = $1`,
    [pengajuanId, U2],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative_loan_application
        SET approved_by = $2, approved_at = now(), approved_amount = 12000000,
            approved_tenor = 12, status = 'APPROVED' WHERE id = $1`,
    [pengajuanId, U3],
  );
  check('penyetuju yang berbeda dari penganalisis DITERIMA', true);

  log('');
  log('4. Persetujuan wajib menyebutkan nilai, penolakan wajib beralasan');
  await harusDitolak(
    'status APPROVED tanpa approved_amount DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_application
       (cooperative_id, member_id, product_id, requested_amount, requested_tenor, status)
     VALUES ($1, $2, $3, 1000000, 6, 'APPROVED')`,
    [coopId, anggotaId, produk[0].id],
  );
  await harusDitolak(
    'status REJECTED tanpa alasan DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_application
       (cooperative_id, member_id, product_id, requested_amount, requested_tenor, status)
     VALUES ($1, $2, $3, 1000000, 6, 'REJECTED')`,
    [coopId, anggotaId, produk[0].id],
  );

  log('');
  log('5. Pinjaman cair dengan jadwal yang dibekukan');
  const pinjaman = await q(
    `INSERT INTO "${SCHEMA}".cooperative_loan
       (cooperative_id, member_id, application_id, product_id, loan_number, method,
        principal, annual_rate, tenor_months, first_due_date, total_interest,
        total_payable, outstanding_principal, outstanding_interest, status,
        disbursed_at, disbursed_by)
     VALUES ($1, $2, $3, $4, $5, 'FLAT', 12000000, 0.12, 12, '2026-09-01',
             1440000, 13440000, 12000000, 1440000, 'ACTIVE', now(), $6)
     RETURNING id`,
    [coopId, anggotaId, pengajuanId, produk[0].id, `PJM-${tag}-001`, U4],
  );
  const pinjamanId = pinjaman[0].id;

  let sisa = 12_000_000;
  for (let i = 1; i <= 12; i += 1) {
    const pokok = i === 12 ? sisa : 1_000_000;
    sisa -= pokok;
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_installment_schedule
         (loan_id, installment_no, due_date, principal_due, interest_due, total_due,
          remaining_principal)
       VALUES ($1, $2, ($3::date + ($2 - 1) * INTERVAL '1 month')::date, $4, 120000, $5, $6)`,
      [pinjamanId, i, '2026-09-01', pokok, pokok + 120_000, sisa],
    );
  }
  const jumlah = await q(
    `SELECT SUM(principal_due)::numeric AS p, SUM(interest_due)::numeric AS b,
            SUM(total_due)::numeric AS t
       FROM "${SCHEMA}".cooperative_installment_schedule WHERE loan_id = $1`,
    [pinjamanId],
  );
  check(
    'jumlah pokok seluruh angsuran persis sama dengan pinjamannya',
    Number(jumlah[0].p) === 12_000_000,
    `dapat ${jumlah[0].p}`,
  );
  check('jumlah bunga sesuai flat 12% setahun', Number(jumlah[0].b) === 1_440_000);
  check('total angsuran = pokok + bunga', Number(jumlah[0].t) === 13_440_000);

  log('');
  log('6. Baris jadwal wajib seimbang');
  await harusDitolak(
    'total_due yang tidak sama dengan pokok + bunga DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_installment_schedule
       (loan_id, installment_no, due_date, principal_due, interest_due, total_due)
     VALUES ($1, 99, '2027-09-01', 1000000, 120000, 9999999)`,
    [pinjamanId],
  );

  log('');
  log('7. Alokasi pembayaran wajib berjumlah sama dengan nilainya');
  await harusDitolak(
    'alokasi yang tidak seimbang DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_installment_payment
       (loan_id, member_id, amount, allocated_penalty, allocated_interest,
        allocated_principal, excess_amount)
     VALUES ($1, $2, 1120000, 0, 120000, 500000, 0)`,
    [pinjamanId, anggotaId],
  );
  const bayar = await q(
    `INSERT INTO "${SCHEMA}".cooperative_installment_payment
       (loan_id, member_id, amount, allocated_penalty, allocated_interest,
        allocated_principal, excess_amount, idempotency_key)
     VALUES ($1, $2, 1120000, 0, 120000, 1000000, 0, $3) RETURNING id`,
    [pinjamanId, anggotaId, `bayar-${tag}-1`],
  );
  check('pembayaran dengan alokasi seimbang DITERIMA', bayar.length === 1);

  await harusDitolak(
    'pembayaran dengan idempotency_key yang sama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_installment_payment
       (loan_id, member_id, amount, allocated_interest, allocated_principal, idempotency_key)
     VALUES ($1, $2, 1120000, 120000, 1000000, $3)`,
    [pinjamanId, anggotaId, `bayar-${tag}-1`],
  );

  log('');
  log('8. Penghapusbukuan menuntut DUA orang berbeda');
  await harusDitolak(
    'penghapusbukuan oleh satu orang saja DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_loan
        SET status = 'WRITTEN_OFF', written_off_at = now(),
            written_off_by = $2, written_off_approved_by = $2 WHERE id = $1`,
    [pinjamanId, U2],
  );
  await harusDitolak(
    'status WRITTEN_OFF tanpa penyetuju DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_loan
        SET status = 'WRITTEN_OFF', written_off_at = now(), written_off_by = $2
      WHERE id = $1`,
    [pinjamanId, U2],
  );
  await q(
    `UPDATE "${SCHEMA}".cooperative_loan
        SET status = 'WRITTEN_OFF', written_off_at = now(),
            written_off_by = $2, written_off_approved_by = $3 WHERE id = $1`,
    [pinjamanId, U2, U3],
  );
  const hapus = await q(`SELECT status FROM "${SCHEMA}".cooperative_loan WHERE id = $1`, [pinjamanId]);
  check('penghapusbukuan dengan dua orang berbeda DITERIMA', hapus[0].status === 'WRITTEN_OFF');

  log('');
  log('9. Restrukturisasi tidak disetujui pemohonnya sendiri');
  await harusDitolak(
    'restrukturisasi disetujui pemohonnya sendiri DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_restructuring
       (old_loan_id, restructure_type, reason, old_outstanding, new_principal,
        new_tenor, requested_by, approved_by, approved_at)
     VALUES ($1, 'TENOR_EXTENSION', 'Usaha anggota menurun', 5000000, 5000000, 24, $2, $2, now())`,
    [pinjamanId, U2],
  );
  const restruk = await q(
    `INSERT INTO "${SCHEMA}".cooperative_loan_restructuring
       (old_loan_id, restructure_type, reason, old_outstanding, new_principal,
        new_tenor, requested_by, approved_by, approved_at)
     VALUES ($1, 'TENOR_EXTENSION', 'Usaha anggota menurun', 5000000, 5000000, 24, $2, $3, now())
     RETURNING id`,
    [pinjamanId, U2, U3],
  );
  check('restrukturisasi dengan penyetuju berbeda DITERIMA', restruk.length === 1);

  log('');
  log('10. Pencairan: nilai bersih wajib sama dengan nilai dikurangi biaya');
  await harusDitolak(
    'net_amount yang tidak cocok DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_loan_disbursement
       (loan_id, amount, admin_fee, net_amount)
     VALUES ($1, 12000000, 120000, 12000000)`,
    [pinjamanId],
  );
  const cair = await q(
    `INSERT INTO "${SCHEMA}".cooperative_loan_disbursement
       (loan_id, amount, admin_fee, net_amount, disbursed_by)
     VALUES ($1, 12000000, 120000, 11880000, $2) RETURNING id`,
    [pinjamanId, U4],
  );
  check('pencairan dengan nilai bersih yang cocok DITERIMA', cair.length === 1);

  log('');
  log('11. Janji bayar wajib menyebutkan tanggal DAN nilainya');
  const kasus = await q(
    `INSERT INTO "${SCHEMA}".cooperative_collection_case
       (cooperative_id, loan_id, member_id, days_overdue_at_open, arrears_at_open)
     VALUES ($1, $2, $3, 45, 2240000) RETURNING id`,
    [coopId, pinjamanId, anggotaId],
  );
  await harusDitolak(
    'janji bayar tanpa nilai DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_collection_activity
       (case_id, activity_type, promise_date) VALUES ($1, 'CALL', '2026-09-15')`,
    [kasus[0].id],
  );
  await harusDitolak(
    'janji bayar bernilai nol DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_collection_activity
       (case_id, activity_type, promise_date, promise_amount)
     VALUES ($1, 'CALL', '2026-09-15', 0)`,
    [kasus[0].id],
  );
  const janji = await q(
    `INSERT INTO "${SCHEMA}".cooperative_collection_activity
       (case_id, activity_type, promise_date, promise_amount)
     VALUES ($1, 'CALL', '2026-09-15', 1120000) RETURNING id`,
    [kasus[0].id],
  );
  check('janji bayar lengkap DITERIMA', janji.length === 1);

  const tanpaJanji = await q(
    `INSERT INTO "${SCHEMA}".cooperative_collection_activity
       (case_id, activity_type, note) VALUES ($1, 'VISIT', 'Tidak bertemu') RETURNING id`,
    [kasus[0].id],
  );
  check('kunjungan tanpa janji bayar tetap dapat dicatat', tanpaJanji.length === 1);

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
    new URL('../../../docs/ekoperasi/bukti-k4-pinjaman.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
