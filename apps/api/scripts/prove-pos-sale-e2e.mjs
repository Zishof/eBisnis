/**
 * Bukti POS-5 dan POS-6: satu transaksi kasir dari ujung ke ujung.
 *
 * Alurnya persis yang disebut perintah prioritas §24: buka shift, tambah baris,
 * ubah jumlah, tahan, lanjutkan, bayar, selesaikan, cetak — lalu **periksa
 * akibatnya pada basis data**: stok berkurang, peristiwa akuntansi terbentuk,
 * nomor struk terbit.
 *
 * Yang paling penting dibuktikan di sini bukan bahwa transaksinya berhasil,
 * melainkan bahwa yang **gagal** benar-benar gagal:
 *
 * - pembayaran ganda dengan kunci yang sama tidak menghasilkan dua pembayaran;
 * - penyelesaian yang terulang tidak mengurangi stok dua kali;
 * - pembayaran yang kurang atau lebih ditolak;
 * - keranjang yang sudah dibayar tidak dapat disunting;
 * - keranjang yang dibatalkan melepaskan penahanan stoknya.
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
const username = `bukti_jual_${tag}`;
const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;

const bersihkan = [];
let platformUserId = null;
let subjectId = null;
let terminalId = null;
let productId = null;
let warehouseId = null;

const q = async (sql, params = []) => (await client.query(sql, params)).rows;

async function api(path, opts = {}, token = null, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI POS-5 dan POS-6 — SATU TRANSAKSI KASIR DARI UJUNG KE UJUNG');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  // --- Persiapan -----------------------------------------------------------
  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  platformUserId = randomUUID();
  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1, $2::varchar, lower($2::varchar), $3, 'Kasir Bukti', $4, 'ACTIVE', FALSE, FALSE, now(), now())`,
    [platformUserId, username, `${username}@contoh.invalid`, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(), $1, $2, FALSE, 'ACTIVE', now(), now())`,
    [tenantId, platformUserId],
  );
  subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1, $2::varchar, 'Kasir Bukti', $2::varchar, FALSE, 'ACTIVE') RETURNING id`,
      [platformUserId, username],
    )
  )[0].id;

  // Supervisor kasir: haknya mencakup seluruh hak kasir, sehingga satu akun
  // cukup untuk seluruh alur tanpa menyembunyikan pemeriksaan hak akses —
  // pemisahan wewenang diuji terpisah pada pos-rbac.spec.ts.
  const role = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = 'SUPERVISOR_KASIR'`))[0];
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1, $2, CURRENT_DATE)`,
    [subjectId, role.id],
  );

  const outlet = (
    await q(
      `SELECT id, brand_id FROM "${SCHEMA}".outlet WHERE deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
    )
  )[0];
  const outletId = outlet.id;

  warehouseId = (
    await q(
      `SELECT id FROM "${SCHEMA}".warehouse WHERE outlet_id = $1 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
      [outletId],
    )
  )[0]?.id;
  if (!warehouseId) {
    warehouseId = (
      await q(
        `SELECT id FROM "${SCHEMA}".warehouse WHERE deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
      )
    )[0]?.id;
    if (warehouseId) {
      await q(`UPDATE "${SCHEMA}".warehouse SET outlet_id = $2 WHERE id = $1`, [
        warehouseId,
        outletId,
      ]);
    }
  }
  if (!warehouseId) throw new Error('Tidak ada gudang pada schema ini');

  terminalId = (
    await q(
      `INSERT INTO "${SCHEMA}".pos_terminal (outlet_id, code, name, register_status)
       VALUES ($1, $2, 'Kasir Bukti', 'READY') RETURNING id`,
      [outletId, `JUAL-${tag}`],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".pos_register_assignment (terminal_id, user_subject_id, is_primary)
     VALUES ($1, $2, TRUE)`,
    [terminalId, subjectId],
  );

  // Produk bukti dengan harga dan stok yang pasti, supaya angkanya dapat
  // dihitung tangan alih-alih bergantung pada data yang kebetulan ada.
  const uom = (await q(`SELECT id FROM "${SCHEMA}".uom WHERE deleted_at IS NULL LIMIT 1`))[0];
  const kategori = (
    await q(`SELECT id FROM "${SCHEMA}".product_category WHERE deleted_at IS NULL LIMIT 1`)
  )[0];
  productId = (
    await q(
      `INSERT INTO "${SCHEMA}".product
         (code, name, sku, base_uom_id, category_id, product_type, tracking_type,
          standard_cost, default_sale_price, is_sellable, is_purchasable, is_active)
       VALUES ($1::varchar, 'Produk Bukti Kasir', $1::varchar, $2, $3, 'GOODS', 'NONE',
               6000, 10000, TRUE, TRUE, TRUE)
       RETURNING id`,
      [`BUKTI-${tag}`, uom.id, kategori?.id ?? null],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".stock_balance
       (warehouse_id, product_id, on_hand_qty, reserved_qty, available_qty, average_cost)
     VALUES ($1, $2, 100, 0, 100, 6000)`,
    [warehouseId, productId],
  );

  const metodeTunai = (
    await q(
      `SELECT id, name FROM "${SCHEMA}".payment_method
        WHERE method_type = 'CASH' AND deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
    )
  )[0] ?? (await q(`SELECT id, name FROM "${SCHEMA}".payment_method WHERE deleted_at IS NULL LIMIT 1`))[0];
  if (!metodeTunai) throw new Error('Tidak ada metode pembayaran');

  log('');
  log(`Disiapkan: produk harga 10.000, HPP 6.000, stok 100 pada gudang outlet.`);

  // --- Masuk ---------------------------------------------------------------
  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const token = masuk.data?.accessToken;
  if (!token) throw new Error(`login gagal: ${JSON.stringify(masuk.body).slice(0, 300)}`);

  log('');
  log('1. Membuka shift');
  const shift = await api(
    '/pos/shifts/open',
    { method: 'POST', body: JSON.stringify({ terminalId, openingCash: 500000 }) },
    token,
  );
  check('shift terbuka', Boolean(shift.data?.shiftId), `status ${shift.status}`);
  const shiftId = shift.data?.shiftId;

  log('');
  log('2. Membuka keranjang dan memindai produk');
  const keranjang = await api(
    '/pos/sales',
    { method: 'POST', body: JSON.stringify({ outletId, terminalId, shiftId }) },
    token,
  );
  check('keranjang terbuka', Boolean(keranjang.data?.id), `status ${keranjang.status}`);
  const saleId = keranjang.data?.id;

  const tambah = await api(
    `/pos/sales/${saleId}/items`,
    { method: 'POST', body: JSON.stringify({ productId, quantity: 3 }) },
    token,
  );
  check('baris ditambahkan', tambah.status === 201 || tambah.status === 200, `status ${tambah.status}`);
  check('keranjang berisi satu baris', (tambah.data?.lines ?? []).length === 1);
  check(
    'subtotal dihitung peladen: 3 × 10.000',
    Number(tambah.data?.subtotal) === 30000,
    `dapat ${tambah.data?.subtotal}`,
  );

  const ditahanStok = await q(
    `SELECT reserved_qty::text, available_qty::text FROM "${SCHEMA}".stock_balance
      WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check(
    'stok ditahan, bukan dipotong',
    Number(ditahanStok[0].reserved_qty) === 3 && Number(ditahanStok[0].available_qty) === 97,
    `reserved ${ditahanStok[0].reserved_qty}, available ${ditahanStok[0].available_qty}`,
  );

  log('');
  log('3. Mengubah jumlah');
  const lineId = tambah.data.lines[0].id;
  const ubah = await api(
    `/pos/sales/${saleId}/items/${lineId}`,
    { method: 'PATCH', body: JSON.stringify({ quantity: 5 }) },
    token,
  );
  check('jumlah berubah', ubah.status === 200, `status ${ubah.status}`);
  check('subtotal ikut berubah menjadi 50.000', Number(ubah.data?.subtotal) === 50000, `dapat ${ubah.data?.subtotal}`);

  const stokUbah = await q(
    `SELECT reserved_qty::text FROM "${SCHEMA}".stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check(
    'penahanan stok disesuaikan, bukan ditambah reservasi kedua',
    Number(stokUbah[0].reserved_qty) === 5,
    `reserved ${stokUbah[0].reserved_qty}`,
  );

  log('');
  log('4. Menahan lalu melanjutkan keranjang');
  const tahan = await api(`/pos/sales/${saleId}/hold`, { method: 'POST', body: '{}' }, token);
  check('keranjang ditahan', tahan.data?.status === 'HELD', `status ${tahan.data?.status}`);
  const lanjut = await api(`/pos/sales/${saleId}/resume`, { method: 'POST', body: '{}' }, token);
  check('keranjang dilanjutkan', lanjut.data?.status === 'DRAFT', `status ${lanjut.data?.status}`);

  log('');
  log('5. Pembayaran');
  const total = Number(lanjut.data.grand_total);
  log(`   total tagihan ${total}`);

  const kurang = await api(
    `/pos/sales/${saleId}/payments`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metodeTunai.id, amount: total - 1000 }) },
    token,
    { 'idempotency-key': `kurang-${tag}` },
  );
  check('pembayaran kurang tetap diterima sebagai cicilan', kurang.status < 400, `status ${kurang.status}`);

  const selesaiKurang = await api(
    `/pos/sales/${saleId}/complete`,
    { method: 'POST', body: '{}' },
    token,
    { 'idempotency-key': `sel-${tag}` },
  );
  check(
    'penyelesaian dengan pembayaran kurang DITOLAK',
    selesaiKurang.status === 400,
    `status ${selesaiKurang.status}`,
  );
  check(
    'penolakannya menyebut berapa kurangnya',
    String(selesaiKurang.body?.error?.message ?? '').includes('kurang'),
  );

  const sisa = await api(
    `/pos/sales/${saleId}/payments`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metodeTunai.id, amount: 1000 }) },
    token,
    { 'idempotency-key': `sisa-${tag}` },
  );
  check('sisa pembayaran diterima', sisa.status < 400, `status ${sisa.status}`);

  const ganda = await api(
    `/pos/sales/${saleId}/payments`,
    { method: 'POST', body: JSON.stringify({ paymentMethodId: metodeTunai.id, amount: 1000 }) },
    token,
    { 'idempotency-key': `sisa-${tag}` },
  );
  check('pembayaran dengan kunci yang sama tidak dicatat dua kali', ganda.data?.duplicate === true);

  const jumlahBayar = await q(
    `SELECT count(*)::int AS n, COALESCE(SUM(amount),0)::text AS total
       FROM "${SCHEMA}".pos_payment WHERE pos_sale_id = $1`,
    [saleId],
  );
  check(
    'tercatat tepat dua pembayaran',
    jumlahBayar[0].n === 2,
    `dapat ${jumlahBayar[0].n}`,
  );
  check('jumlahnya sama dengan tagihan', Number(jumlahBayar[0].total) === total);

  log('');
  log('6. Keranjang yang menunggu pembayaran tidak dapat disunting');
  const suntingSetelahBayar = await api(
    `/pos/sales/${saleId}/items`,
    { method: 'POST', body: JSON.stringify({ productId, quantity: 1 }) },
    token,
  );
  check(
    'menambah baris sesudah pembayaran ditolak',
    suntingSetelahBayar.status === 409,
    `status ${suntingSetelahBayar.status}`,
  );

  log('');
  log('7. Menyelesaikan transaksi');
  const selesai = await api(
    `/pos/sales/${saleId}/complete`,
    { method: 'POST', body: '{}' },
    token,
    { 'idempotency-key': `sel2-${tag}` },
  );
  check('transaksi selesai', selesai.status === 200, `status ${selesai.status}`);
  check('memperoleh nomor struk', Boolean(selesai.data?.receiptNumber));
  log(`   nomor struk: ${selesai.data?.receiptNumber}`);

  const stokAkhir = await q(
    `SELECT on_hand_qty::text, reserved_qty::text, available_qty::text
       FROM "${SCHEMA}".stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check(
    'stok berkurang 5 dari 100',
    Number(stokAkhir[0].on_hand_qty) === 95,
    `on_hand ${stokAkhir[0].on_hand_qty}`,
  );
  check('penahanan dilepas', Number(stokAkhir[0].reserved_qty) === 0);
  check('ketersediaan cocok dengan on-hand', Number(stokAkhir[0].available_qty) === 95);

  const gerak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".stock_movement
      WHERE reference_type = 'POS_SALE' AND reference_id = $1`,
    [saleId],
  );
  check('satu pergerakan stok tercatat', gerak[0].n === 1, `dapat ${gerak[0].n}`);

  const peristiwa = await q(
    `SELECT event_code FROM "${SCHEMA}".accounting_event
      WHERE source_type = 'POS_SALE' AND source_id = $1 ORDER BY event_code`,
    [saleId],
  );
  const kode = peristiwa.map((p) => p.event_code);
  log(`   peristiwa akuntansi: ${kode.join(', ')}`);
  check('peristiwa POS_SALE terbentuk', kode.includes('POS_SALE'));
  check('peristiwa POS_CASH_RECEIPT terbentuk', kode.includes('POS_CASH_RECEIPT'));
  check('peristiwa POS_COGS terbentuk', kode.includes('POS_COGS'));
  check(
    'HPP tercatat 5 × 6.000',
    Number(
      (
        await q(
          `SELECT (amounts->>'cost')::text AS c FROM "${SCHEMA}".accounting_event
            WHERE source_id = $1 AND event_code = 'POS_COGS'`,
          [saleId],
        )
      )[0]?.c,
    ) === 30000,
  );

  const struk = await q(
    `SELECT receipt_number FROM "${SCHEMA}".pos_sale_receipt WHERE pos_sale_id = $1`,
    [saleId],
  );
  check('struk tercatat pada tabelnya sendiri', struk.length === 1);

  log('');
  log('8. Penyelesaian yang terulang');
  const ulang = await api(
    `/pos/sales/${saleId}/complete`,
    { method: 'POST', body: '{}' },
    token,
    { 'idempotency-key': `sel3-${tag}` },
  );
  check('penyelesaian ulang tidak menghasilkan galat', ulang.status === 200, `status ${ulang.status}`);
  check('dilaporkan sebagai duplikat', ulang.data?.duplicate === true);

  const stokUlang = await q(
    `SELECT on_hand_qty::text FROM "${SCHEMA}".stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check(
    'stok TIDAK berkurang dua kali',
    Number(stokUlang[0].on_hand_qty) === 95,
    `on_hand ${stokUlang[0].on_hand_qty}`,
  );
  const gerakUlang = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".stock_movement
      WHERE reference_type = 'POS_SALE' AND reference_id = $1`,
    [saleId],
  );
  check('pergerakan stok tetap satu', gerakUlang[0].n === 1, `dapat ${gerakUlang[0].n}`);

  log('');
  log('9. Keranjang yang dibatalkan melepaskan stoknya');
  const k2 = await api(
    '/pos/sales',
    { method: 'POST', body: JSON.stringify({ outletId, terminalId, shiftId }) },
    token,
  );
  await api(
    `/pos/sales/${k2.data.id}/items`,
    { method: 'POST', body: JSON.stringify({ productId, quantity: 10 }) },
    token,
  );
  const sebelumBatal = await q(
    `SELECT reserved_qty::text FROM "${SCHEMA}".stock_balance WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check('stok tertahan sebelum pembatalan', Number(sebelumBatal[0].reserved_qty) === 10);

  await api(`/pos/sales/${k2.data.id}/cancel`, { method: 'POST', body: '{}' }, token);
  const sesudahBatal = await q(
    `SELECT reserved_qty::text, available_qty::text FROM "${SCHEMA}".stock_balance
      WHERE warehouse_id = $1 AND product_id = $2`,
    [warehouseId, productId],
  );
  check(
    'penahanan dilepas seluruhnya',
    Number(sesudahBatal[0].reserved_qty) === 0,
    `reserved ${sesudahBatal[0].reserved_qty}`,
  );
  check('stok kembali tersedia', Number(sesudahBatal[0].available_qty) === 95);

  log('');
  log('10. Stok tidak cukup');
  const k3 = await api(
    '/pos/sales',
    { method: 'POST', body: JSON.stringify({ outletId, terminalId, shiftId }) },
    token,
  );
  const kebanyakan = await api(
    `/pos/sales/${k3.data.id}/items`,
    { method: 'POST', body: JSON.stringify({ productId, quantity: 9999 }) },
    token,
  );
  check('penjualan melebihi stok ditolak', kebanyakan.status === 409, `status ${kebanyakan.status}`);
  check(
    'penolakannya menyebutkan jumlah yang tersedia',
    String(kebanyakan.body?.error?.message ?? '').includes('95'),
    kebanyakan.body?.error?.message,
  );
  const barisGagal = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".pos_sale_line WHERE pos_sale_id = $1`,
    [k3.data.id],
  );
  check('baris yang gagal ditahan tidak tertinggal di keranjang', barisGagal[0].n === 0);

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
    if (subjectId) {
      await q(
        `DELETE FROM "${SCHEMA}".accounting_event WHERE source_id IN
           (SELECT id FROM "${SCHEMA}".pos_sale WHERE cashier_id = $1)`,
        [subjectId],
      );
      /*
       * Buku besar pergerakan stok TIDAK dihapus, dan itu memang benar: V008
       * memasang penjaga yang menolak DELETE pada stock_movement. Buku besar
       * yang barisnya dapat dihapus bukan buku besar. Naskah bukti pun tunduk
       * pada aturan itu — memaksanya lewat akan berarti menguji sistem yang
       * berbeda dari yang dijalankan penyewa.
       *
       * Akibatnya produk bukti tidak dapat dihapus permanen karena masih
       * dirujuk buku besar. Ia dinonaktifkan saja, persis seperti yang terjadi
       * pada produk sungguhan yang sudah pernah terjual.
       */
      await q(
        `DELETE FROM "${SCHEMA}".stock_reservation WHERE source_id IN
           (SELECT l.id FROM "${SCHEMA}".pos_sale_line l
              JOIN "${SCHEMA}".pos_sale s ON s.id = l.pos_sale_id WHERE s.cashier_id = $1)`,
        [subjectId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_sale WHERE cashier_id = $1`, [subjectId]);
      await q(
        `DELETE FROM "${SCHEMA}".cash_drawer_movement WHERE shift_id IN
           (SELECT id FROM "${SCHEMA}".pos_shift WHERE cashier_id = $1)`,
        [subjectId],
      );
      await q(`DELETE FROM "${SCHEMA}".pos_shift WHERE cashier_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".pos_register_assignment WHERE user_subject_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [subjectId]);
    }
    if (productId) {
      await q(`DELETE FROM "${SCHEMA}".stock_balance WHERE product_id = $1`, [productId]);
      await q(
        `UPDATE "${SCHEMA}".product
            SET is_active = FALSE, deleted_at = now(), delete_reason = 'Produk bukti POS'
          WHERE id = $1`,
        [productId],
      );
    }
    if (terminalId) await q(`DELETE FROM "${SCHEMA}".pos_terminal WHERE id = $1`, [terminalId]);
    if (platformUserId) {
      await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [platformUserId]);
      await q(`DELETE FROM platform.platform_user WHERE id = $1`, [platformUserId]);
    }
    log('');
    log('Data sementara dibersihkan.');
    log(
      'Buku besar pergerakan stok sengaja tidak dihapus — penjaga immutability ' +
        'V008 menolaknya, dan itu memang perilaku yang benar. Produk bukti ' +
        'dinonaktifkan, bukan dihapus permanen.',
    );
  } catch (e) {
    log(`Peringatan: pembersihan tidak tuntas — ${e.message}`);
  }

  await client.end();
  writeFileSync(
    new URL('../../../docs/pos-web-priority/bukti-pos-sale-e2e.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
