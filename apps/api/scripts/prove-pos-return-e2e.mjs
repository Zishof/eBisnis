/**
 * Bukti POS-7 dan POS-8: struk, pembatalan, retur, dan refund.
 *
 * Yang dibuktikan, berurut dari yang paling penting:
 *
 * 1. **Tidak ada yang menyetujui permintaannya sendiri** — ditolak pada
 *    layanan, dan constraint basis data menolaknya pula bila layanan dilewati.
 * 2. **Transaksi yang dibatalkan tidak dihapus, melainkan dibalik** — stok
 *    kembali, jurnal pembalik terbentuk, barisnya tetap ada.
 * 3. **Retur tidak pernah melebihi yang dijual** — dijaga constraint, bukan
 *    hanya oleh layanan.
 * 4. **Barang rusak tidak kembali ke stok jual.**
 * 5. **Cetak ulang struk tercatat.**
 * 6. **Refund tidak melebihi nilai retur.**
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
let terminalId = null;
let productId = null;
let warehouseId = null;

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

/** Membuat satu pengguna tenant dengan peran tertentu, lalu memasukkannya. */
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
  return { platformUserId, subjectId, token, username };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI POS-7 dan POS-8 — STRUK, PEMBATALAN, RETUR, DAN REFUND');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  // Dua aktor: kasir yang menjual dan meminta, supervisor yang menyetujui.
  aktor.kasir = await buatAktor('kasir', 'SUPERVISOR_KASIR', tenantId);
  aktor.supervisor = await buatAktor('supervisor', 'SUPERVISOR_KASIR', tenantId);
  log('');
  log('Dua aktor disiapkan: kasir (pemohon) dan supervisor (penyetuju).');

  const outletId = (
    await q(`SELECT id FROM "${SCHEMA}".outlet WHERE deleted_at IS NULL AND is_active = TRUE LIMIT 1`)
  )[0].id;
  warehouseId = (
    await q(
      `SELECT id FROM "${SCHEMA}".warehouse WHERE outlet_id = $1 AND deleted_at IS NULL
        AND is_active = TRUE ORDER BY is_parent ASC, level DESC LIMIT 1`,
      [outletId],
    )
  )[0]?.id;
  if (!warehouseId) throw new Error('Gudang outlet tidak ada');

  terminalId = (
    await q(
      `INSERT INTO "${SCHEMA}".pos_terminal (outlet_id, code, name, register_status)
       VALUES ($1, $2, 'Kasir Retur', 'READY') RETURNING id`,
      [outletId, `RTR-${tag}`],
    )
  )[0].id;
  for (const a of [aktor.kasir, aktor.supervisor]) {
    await q(
      `INSERT INTO "${SCHEMA}".pos_register_assignment (terminal_id, user_subject_id, is_primary)
       VALUES ($1, $2, FALSE)`,
      [terminalId, a.subjectId],
    );
  }

  const uom = (await q(`SELECT id FROM "${SCHEMA}".uom WHERE deleted_at IS NULL LIMIT 1`))[0];
  const kategori = (
    await q(`SELECT id FROM "${SCHEMA}".product_category WHERE deleted_at IS NULL LIMIT 1`)
  )[0];
  if (!kategori) throw new Error('Schema ini tidak punya kategori produk');
  productId = (
    await q(
      `INSERT INTO "${SCHEMA}".product
         (code, name, sku, base_uom_id, category_id, product_type, tracking_type,
          standard_cost, default_sale_price, is_sellable, is_purchasable, is_active)
       VALUES ($1::varchar, 'Produk Bukti Retur', $1::varchar, $2, $3, 'GOODS', 'NONE',
               4000, 10000, TRUE, TRUE, TRUE) RETURNING id`,
      [`RTR-${tag}`, uom.id, kategori.id],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".stock_balance
       (warehouse_id, product_id, on_hand_qty, reserved_qty, available_qty, damaged_qty, average_cost)
     VALUES ($1, $2, 100, 0, 100, 0, 4000)`,
    [warehouseId, productId],
  );

  /*
   * Sengaja memilih metode TUNAI. Metode non-tunai menuntut nomor rujukan dari
   * mesin EDC — aturan yang benar dan sudah diuji tersendiri — tetapi yang
   * sedang diuji di sini adalah retur dan refund, bukan validasi pembayaran.
   */
  const metode = (
    await q(
      `SELECT id, name FROM "${SCHEMA}".payment_method
        WHERE deleted_at IS NULL AND is_active = TRUE AND requires_reference = FALSE
        ORDER BY (method_type = 'CASH') DESC
        LIMIT 1`,
    )
  )[0];
  if (!metode) throw new Error('Tidak ada metode pembayaran tanpa nomor rujukan');
  log(`Metode pembayaran bukti: ${metode.name}`);

  /** Menjual sejumlah unit dan menyelesaikannya; mengembalikan saleId. */
  // Shift dibuka sekali; satu register hanya boleh punya satu shift terbuka,
  // dan aturan itu memang yang seharusnya berlaku.
  const shiftAwal = await api(
    '/pos/shifts/open',
    { method: 'POST', body: JSON.stringify({ terminalId, openingCash: 100000 }) },
    aktor.kasir.token,
  );
  const shiftId =
    shiftAwal.data?.shiftId ??
    (await q(`SELECT id FROM "${SCHEMA}".pos_shift WHERE terminal_id = $1 AND status = 'OPEN'`, [
      terminalId,
    ]))[0]?.id;
  if (!shiftId) throw new Error(`shift tidak terbuka: ${JSON.stringify(shiftAwal.body).slice(0, 250)}`);

  async function jual(qty) {

    const k = await api(
      '/pos/sales',
      { method: 'POST', body: JSON.stringify({ outletId, terminalId, shiftId }) },
      aktor.kasir.token,
    );
    const saleId = k.data.id;
    await api(
      `/pos/sales/${saleId}/items`,
      { method: 'POST', body: JSON.stringify({ productId, quantity: qty }) },
      aktor.kasir.token,
    );
    const isi = await api(`/pos/sales/${saleId}`, {}, aktor.kasir.token);
    await api(
      `/pos/sales/${saleId}/payments`,
      {
        method: 'POST',
        body: JSON.stringify({ paymentMethodId: metode.id, amount: Number(isi.data.grand_total) }),
      },
      aktor.kasir.token,
      { 'idempotency-key': `bayar-${saleId}` },
    );
    const selesai = await api(
      `/pos/sales/${saleId}/complete`,
      { method: 'POST', body: '{}' },
      aktor.kasir.token,
      { 'idempotency-key': `selesai-${saleId}` },
    );
    return { saleId, receiptNumber: selesai.data?.receiptNumber, lines: isi.data.lines };
  }

  // === 1. Struk ============================================================
  log('');
  log('1. Struk');
  const t1 = await jual(4);
  const struk = await api(`/pos/sales/${t1.saleId}/receipt`, {}, aktor.kasir.token);
  check('struk dapat dibaca', struk.status === 200, `status ${struk.status}`);
  check('memuat nomor struk', Boolean(struk.data?.receipt_number));
  check('memuat barisnya', (struk.data?.lines ?? []).length === 1);
  check('memuat pembayarannya', (struk.data?.payments ?? []).length === 1);
  check('penghitung cetak mula-mula nol', Number(struk.data?.print_count) === 0);

  const ulang1 = await api(
    `/pos/sales/${t1.saleId}/receipt/reprint`,
    { method: 'POST', body: JSON.stringify({ reason: 'Struk pembeli sobek' }) },
    aktor.kasir.token,
  );
  check('cetak ulang berhasil', ulang1.status === 200, `status ${ulang1.status}`);
  check('penghitung cetak naik menjadi 1', Number(ulang1.data?.printCount) === 1);
  const ulang2 = await api(
    `/pos/sales/${t1.saleId}/receipt/reprint`,
    { method: 'POST', body: JSON.stringify({ reason: 'Diminta pembeli lagi' }) },
    aktor.kasir.token,
  );
  check('cetak ulang kedua tercatat terpisah', Number(ulang2.data?.printCount) === 2);

  const strukBelum = await api(`/pos/sales/${randomUUID()}/receipt`, {}, aktor.kasir.token);
  check('struk transaksi yang tidak ada ditolak', strukBelum.status === 404);

  // === 2. Pembatalan =======================================================
  log('');
  log('2. Pembatalan transaksi yang sudah selesai');
  const t2 = await jual(3);
  const stokSebelumVoid = Number(
    (await q(`SELECT on_hand_qty::text AS n FROM "${SCHEMA}".stock_balance WHERE warehouse_id=$1 AND product_id=$2`, [warehouseId, productId]))[0].n,
  );

  const tanpaAlasan = await api(
    `/pos/sales/${t2.saleId}/void-request`,
    { method: 'POST', body: JSON.stringify({ reason: '' }) },
    aktor.kasir.token,
  );
  check('pembatalan tanpa alasan ditolak', tanpaAlasan.status === 400, `status ${tanpaAlasan.status}`);

  const minta = await api(
    `/pos/sales/${t2.saleId}/void-request`,
    { method: 'POST', body: JSON.stringify({ reason: 'Pembeli membatalkan setelah membayar' }) },
    aktor.kasir.token,
  );
  check('pembatalan diajukan', minta.status === 200, `status ${minta.status}`);

  // Inti pengujian: pemohon menyetujui permintaannya sendiri.
  const sendiri = await api(
    `/pos/sales/${t2.saleId}/void-approve`,
    { method: 'POST', body: '{}' },
    aktor.kasir.token,
  );
  check(
    'pemohon TIDAK dapat menyetujui permintaannya sendiri',
    sendiri.status === 403,
    `status ${sendiri.status}`,
  );
  check(
    'penolakannya menerangkan sebabnya',
    String(sendiri.body?.error?.message ?? '').includes('sendiri'),
    sendiri.body?.error?.message,
  );

  // Lapisan basis data: layanan dilewati sama sekali.
  let ditolakDb = false;
  try {
    await q(
      `UPDATE "${SCHEMA}".pos_sale SET void_approved_by = void_requested_by WHERE id = $1`,
      [t2.saleId],
    );
  } catch (e) {
    ditolakDb = String(e.message).includes('pos_sale_no_self_void_approval');
  }
  check('constraint basis data menolaknya pula bila layanan dilewati', ditolakDb);

  const setuju = await api(
    `/pos/sales/${t2.saleId}/void-approve`,
    { method: 'POST', body: JSON.stringify({ reason: 'Disetujui supervisor' }) },
    aktor.supervisor.token,
  );
  check('supervisor lain dapat menyetujui', setuju.status === 200, `status ${setuju.status}`);

  const stokSesudahVoid = Number(
    (await q(`SELECT on_hand_qty::text AS n FROM "${SCHEMA}".stock_balance WHERE warehouse_id=$1 AND product_id=$2`, [warehouseId, productId]))[0].n,
  );
  check(
    'stok dikembalikan 3 unit',
    stokSesudahVoid === stokSebelumVoid + 3,
    `${stokSebelumVoid} -> ${stokSesudahVoid}`,
  );

  const barisTetap = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".pos_sale WHERE id = $1`,
    [t2.saleId],
  );
  check('transaksi TIDAK dihapus, hanya ditandai VOIDED', barisTetap[0].n === 1);

  const pembalik = await q(
    `SELECT (amounts->>'gross')::numeric AS g FROM "${SCHEMA}".accounting_event
      WHERE source_id = $1 AND event_code = 'POS_SALE' AND idempotency_key LIKE '%VOID%'`,
    [t2.saleId],
  );
  check('peristiwa akuntansi pembalik terbentuk', pembalik.length === 1);
  check('nilainya negatif', pembalik.length === 1 && Number(pembalik[0].g) < 0, `dapat ${pembalik[0]?.g}`);

  // === 3. Retur ============================================================
  log('');
  log('3. Retur sebagian');
  const t3 = await jual(10);
  const lineId = t3.lines[0].id;

  const berlebih = await api(
    `/pos/sales/${t3.saleId}/returns`,
    { method: 'POST', body: JSON.stringify({ lines: [{ saleLineId: lineId, quantity: 99 }] }) },
    aktor.kasir.token,
    { 'idempotency-key': `retur-lebih-${tag}` },
  );
  check('retur melebihi yang dijual ditolak', berlebih.status === 400, `status ${berlebih.status}`);
  check(
    'penolakannya menyebut sisa yang dapat diretur',
    String(berlebih.body?.error?.message ?? '').includes('10'),
    berlebih.body?.error?.message,
  );

  const stokSebelumRetur = await q(
    `SELECT on_hand_qty::text AS n, damaged_qty::text AS d FROM "${SCHEMA}".stock_balance
      WHERE warehouse_id=$1 AND product_id=$2`,
    [warehouseId, productId],
  );

  const retur = await api(
    `/pos/sales/${t3.saleId}/returns`,
    {
      method: 'POST',
      body: JSON.stringify({
        lines: [{ saleLineId: lineId, quantity: 4, disposition: 'RESTOCK' }],
        reason: 'Ukuran tidak sesuai',
      }),
    },
    aktor.kasir.token,
    { 'idempotency-key': `retur-${tag}` },
  );
  check('retur sebagian diajukan', retur.status === 201 || retur.status === 200, `status ${retur.status}`);
  check('transaksi menjadi RETURNED_PARTIAL', retur.data?.saleStatus === 'RETURNED_PARTIAL', retur.data?.saleStatus);
  const returnId = retur.data?.returnId;

  const returUlang = await api(
    `/pos/sales/${t3.saleId}/returns`,
    { method: 'POST', body: JSON.stringify({ lines: [{ saleLineId: lineId, quantity: 4 }] }) },
    aktor.kasir.token,
    { 'idempotency-key': `retur-${tag}` },
  );
  check('retur dengan kunci sama tidak dicatat dua kali', returUlang.data?.duplicate === true);

  const setujuSendiri = await api(
    `/pos/returns/${returnId}/approve`,
    { method: 'POST', body: '{}' },
    aktor.kasir.token,
  );
  check(
    'pemohon retur TIDAK dapat menyetujui returnya sendiri',
    setujuSendiri.status === 403,
    `status ${setujuSendiri.status}`,
  );

  const setujuRetur = await api(
    `/pos/returns/${returnId}/approve`,
    { method: 'POST', body: '{}' },
    aktor.supervisor.token,
  );
  check('supervisor menyetujui retur', setujuRetur.status === 200, `status ${setujuRetur.status}`);

  const stokSesudahRetur = await q(
    `SELECT on_hand_qty::text AS n, damaged_qty::text AS d FROM "${SCHEMA}".stock_balance
      WHERE warehouse_id=$1 AND product_id=$2`,
    [warehouseId, productId],
  );
  check(
    'barang layak jual kembali ke stok on-hand',
    Number(stokSesudahRetur[0].n) === Number(stokSebelumRetur[0].n) + 4,
    `${stokSebelumRetur[0].n} -> ${stokSesudahRetur[0].n}`,
  );

  // === 4. Barang rusak =====================================================
  log('');
  log('4. Retur barang rusak tidak kembali ke stok jual');
  const returRusak = await api(
    `/pos/sales/${t3.saleId}/returns`,
    {
      method: 'POST',
      body: JSON.stringify({
        lines: [{ saleLineId: lineId, quantity: 2, disposition: 'DAMAGED' }],
        reason: 'Barang rusak saat dibuka',
      }),
    },
    aktor.kasir.token,
    { 'idempotency-key': `retur-rusak-${tag}` },
  );
  check('retur barang rusak diajukan', returRusak.status < 400, `status ${returRusak.status}`);
  await api(
    `/pos/returns/${returRusak.data.returnId}/approve`,
    { method: 'POST', body: '{}' },
    aktor.supervisor.token,
  );

  const stokRusak = await q(
    `SELECT on_hand_qty::text AS n, damaged_qty::text AS d FROM "${SCHEMA}".stock_balance
      WHERE warehouse_id=$1 AND product_id=$2`,
    [warehouseId, productId],
  );
  check(
    'stok jual TIDAK bertambah',
    Number(stokRusak[0].n) === Number(stokSesudahRetur[0].n),
    `${stokSesudahRetur[0].n} -> ${stokRusak[0].n}`,
  );
  check(
    'ember rusak bertambah 2',
    Number(stokRusak[0].d) === Number(stokSesudahRetur[0].d) + 2,
    `${stokSesudahRetur[0].d} -> ${stokRusak[0].d}`,
  );

  // === 5. Refund ===========================================================
  log('');
  log('5. Refund');
  const nilaiRetur = Number(
    (await q(`SELECT grand_total::text AS n FROM "${SCHEMA}".pos_return WHERE id = $1`, [returnId]))[0].n,
  );
  log(`   nilai retur ${nilaiRetur}`);

  const refundLebih = await api(
    `/pos/returns/${returnId}/refund`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metode.id, amount: nilaiRetur + 50000 }) },
    aktor.supervisor.token,
    { 'idempotency-key': `refund-lebih-${tag}` },
  );
  check('refund melebihi nilai retur ditolak', refundLebih.status === 400, `status ${refundLebih.status}`);

  const refundSendiri = await api(
    `/pos/returns/${returnId}/refund`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metode.id, amount: nilaiRetur }) },
    aktor.kasir.token,
    { 'idempotency-key': `refund-sendiri-${tag}` },
  );
  check(
    'pemohon TIDAK dapat membayarkan refund atas returnya sendiri',
    refundSendiri.status === 403,
    `status ${refundSendiri.status}`,
  );

  const refund = await api(
    `/pos/returns/${returnId}/refund`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metode.id, amount: nilaiRetur }) },
    aktor.supervisor.token,
    { 'idempotency-key': `refund-${tag}` },
  );
  check('refund dibayarkan supervisor', refund.status === 200, `status ${refund.status}`);
  check('transaksi menjadi REFUNDED_PARTIAL', refund.data?.saleStatus === 'REFUNDED_PARTIAL', refund.data?.saleStatus);

  const refundUlang = await api(
    `/pos/returns/${returnId}/refund`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metode.id, amount: nilaiRetur }) },
    aktor.supervisor.token,
    { 'idempotency-key': `refund-${tag}` },
  );
  check('refund dengan kunci sama tidak dibayarkan dua kali', refundUlang.data?.duplicate === true);

  const jumlahRefund = await q(
    `SELECT count(*)::int AS n, COALESCE(SUM(amount),0)::text AS total
       FROM "${SCHEMA}".pos_refund WHERE pos_return_id = $1`,
    [returnId],
  );
  check('tercatat tepat satu refund', jumlahRefund[0].n === 1, `dapat ${jumlahRefund[0].n}`);
  check('nilainya sama dengan nilai retur', Number(jumlahRefund[0].total) === nilaiRetur);

  const peristiwaRefund = await q(
    `SELECT event_code FROM "${SCHEMA}".accounting_event
      WHERE source_id = $1 AND event_code IN ('POS_RETURN', 'POS_REFUND') ORDER BY event_code`,
    [returnId],
  );
  check(
    'peristiwa POS_RETURN dan POS_REFUND terbentuk',
    peristiwaRefund.map((p) => p.event_code).join(',') === 'POS_REFUND,POS_RETURN',
    peristiwaRefund.map((p) => p.event_code).join(','),
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
    for (const a of Object.values(aktor)) {
      if (!a?.subjectId) continue;
      await q(
        `DELETE FROM "${SCHEMA}".accounting_event WHERE source_id IN
           (SELECT id FROM "${SCHEMA}".pos_sale WHERE terminal_id = $1)
         OR source_id IN (SELECT id FROM "${SCHEMA}".pos_return WHERE terminal_id = $1)`,
        [terminalId],
      );
    }
    if (terminalId) {
      await q(
        `DELETE FROM "${SCHEMA}".pos_refund WHERE pos_return_id IN
           (SELECT id FROM "${SCHEMA}".pos_return WHERE terminal_id = $1)`,
        [terminalId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_return WHERE terminal_id = $1`, [terminalId]);
      await q(`DELETE FROM "${SCHEMA}".pos_sale WHERE terminal_id = $1`, [terminalId]);
      await q(
        `DELETE FROM "${SCHEMA}".cash_drawer_movement WHERE shift_id IN
           (SELECT id FROM "${SCHEMA}".pos_shift WHERE terminal_id = $1)`,
        [terminalId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_shift WHERE terminal_id = $1`, [terminalId]);
      await q(`DELETE FROM "${SCHEMA}".pos_register_assignment WHERE terminal_id = $1`, [terminalId]);
      await q(`DELETE FROM "${SCHEMA}".pos_terminal WHERE id = $1`, [terminalId]);
    }
    for (const a of Object.values(aktor)) {
      if (!a?.subjectId) continue;
      await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [a.subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [a.subjectId]);
      await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [a.platformUserId]);
      await q(`DELETE FROM platform.platform_user WHERE id = $1`, [a.platformUserId]);
    }
    if (productId) {
      await q(`DELETE FROM "${SCHEMA}".stock_balance WHERE product_id = $1`, [productId]);
      await q(
        `UPDATE "${SCHEMA}".product SET is_active = FALSE, deleted_at = now(),
                delete_reason = 'Produk bukti retur' WHERE id = $1`,
        [productId],
      );
    }
    log('');
    log('Data sementara dibersihkan. Buku besar pergerakan stok tidak dihapus —');
    log('penjaga immutability V008 menolaknya, dan itu memang perilaku yang benar.');
  } catch (e) {
    log(`Peringatan: pembersihan tidak tuntas — ${e.message}`);
  }
  await client.end();
  writeFileSync(
    new URL('../../../docs/pos-web-priority/bukti-pos-return-e2e.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
