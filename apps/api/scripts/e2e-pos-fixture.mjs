/**
 * Perkakas data untuk uji Playwright layar kasir.
 *
 * Uji peramban memerlukan keadaan yang tidak dapat disiapkan lewat antarmuka
 * itu sendiri: seorang kasir dengan hak dan penugasan register, produk
 * berbarcode, dan stok. Naskah ini menyiapkannya sebelum uji berjalan, lalu
 * membersihkannya sesudahnya.
 *
 * ## Mengapa kredensialnya dibuat, bukan disimpan
 *
 * Kata sandi dibangkitkan acak setiap kali dan ditulis ke berkas sementara di
 * luar repositori. Tidak ada kredensial yang pernah masuk ke Git, dan akun yang
 * dibuat tidak bertahan melewati satu kali jalan pengujian.
 *
 * Pemakaian:
 *   node scripts/e2e-pos-fixture.mjs setup     -> menyiapkan, menulis JSON
 *   node scripts/e2e-pos-fixture.mjs teardown  -> membersihkan seluruhnya
 */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const SCHEMA = process.env.POS_SCHEMA ?? 'demo';
const BERKAS =
  process.env.E2E_POS_FIXTURE ??
  new URL('../../web/.playwright/pos-fixture.json', import.meta.url).pathname.replace(/^\//, '');

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');

const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

const perintah = process.argv[2];

await client.connect();

try {
  if (perintah === 'setup') await siapkan();
  else if (perintah === 'teardown') await bersihkan();
  else {
    console.error('Pemakaian: e2e-pos-fixture.mjs setup|teardown');
    process.exitCode = 2;
  }
} finally {
  await client.end();
}

async function siapkan() {
  // Membersihkan sisa jalan sebelumnya lebih dahulu. Uji yang gagal di tengah
  // meninggalkan data, dan jalan berikutnya tidak boleh menumpuk di atasnya.
  await bersihkan({ diam: true });

  const tag = randomBytes(3).toString('hex');
  const username = `e2e_kasir_${tag}`;
  const password = `E2E-${randomBytes(12).toString('base64url')}!7`;

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const platformUserId = randomUUID();
  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1, $2::varchar, lower($2::varchar), $3, 'Kasir E2E', $4, 'ACTIVE', FALSE, FALSE, now(), now())`,
    [platformUserId, username, `${username}@e2e.invalid`, hash],
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
       VALUES ($1, $2::varchar, 'Kasir E2E', $2::varchar, FALSE, 'ACTIVE') RETURNING id`,
      [platformUserId, username],
    )
  )[0].id;

  // Supervisor kasir: haknya mencakup seluruh hak kasir, sehingga satu akun
  // dapat menjalankan seluruh alur uji tanpa berganti pengguna di tengah.
  const role = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = 'SUPERVISOR_KASIR'`))[0];
  if (!role) throw new Error('Peran SUPERVISOR_KASIR belum disemai');
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1, $2, CURRENT_DATE)`,
    [subjectId, role.id],
  );

  const outletId = (
    await q(
      `SELECT id FROM "${SCHEMA}".outlet WHERE deleted_at IS NULL AND is_active = TRUE
        ORDER BY created_at LIMIT 1`,
    )
  )[0]?.id;
  if (!outletId) throw new Error('Tidak ada outlet aktif');

  let warehouseId = (
    await q(
      `SELECT id FROM "${SCHEMA}".warehouse WHERE outlet_id = $1 AND deleted_at IS NULL
        AND is_active = TRUE ORDER BY is_parent ASC, level DESC LIMIT 1`,
      [outletId],
    )
  )[0]?.id;
  if (!warehouseId) {
    warehouseId = (
      await q(`SELECT id FROM "${SCHEMA}".warehouse WHERE deleted_at IS NULL LIMIT 1`)
    )[0]?.id;
    if (warehouseId) {
      await q(`UPDATE "${SCHEMA}".warehouse SET outlet_id = $2 WHERE id = $1`, [warehouseId, outletId]);
    }
  }
  if (!warehouseId) throw new Error('Tidak ada gudang');

  const terminalId = (
    await q(
      `INSERT INTO "${SCHEMA}".pos_terminal (outlet_id, code, name, register_status)
       VALUES ($1, $2, 'Kasir E2E', 'READY') RETURNING id`,
      [outletId, `E2E-${tag}`],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".pos_register_assignment (terminal_id, user_subject_id, is_primary)
     VALUES ($1, $2, TRUE)`,
    [terminalId, subjectId],
  );

  // Harga bulat supaya uji dapat menegaskan angka yang tepat alih-alih rentang.
  const uom = (await q(`SELECT id FROM "${SCHEMA}".uom WHERE deleted_at IS NULL LIMIT 1`))[0];
  const kategori = (
    await q(`SELECT id FROM "${SCHEMA}".product_category WHERE deleted_at IS NULL LIMIT 1`)
  )[0];
  const barcode = `899${String(Date.now()).slice(-10)}`;
  const productId = (
    await q(
      `INSERT INTO "${SCHEMA}".product
         (code, name, sku, base_uom_id, category_id, product_type, tracking_type,
          standard_cost, default_sale_price, is_sellable, is_purchasable, is_active)
       VALUES ($1::varchar, 'Produk Uji Kasir', $1::varchar, $2, $3, 'GOODS', 'NONE',
               6000, 10000, TRUE, TRUE, TRUE) RETURNING id`,
      [`E2E-${tag}`, uom.id, kategori?.id ?? null],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".product_barcode
       (product_id, uom_id, barcode, barcode_type, is_primary)
     VALUES ($1, $2, $3, 'EAN13', TRUE)`,
    [productId, uom.id, barcode],
  );
  await q(
    `INSERT INTO "${SCHEMA}".stock_balance
       (warehouse_id, product_id, on_hand_qty, reserved_qty, available_qty, average_cost)
     VALUES ($1, $2, 500, 0, 500, 6000)`,
    [warehouseId, productId],
  );

  const metode = (
    await q(
      `SELECT id, name FROM "${SCHEMA}".payment_method
        WHERE deleted_at IS NULL AND is_active = TRUE AND requires_reference = FALSE
        ORDER BY (method_type = 'CASH') DESC LIMIT 1`,
    )
  )[0];
  if (!metode) throw new Error('Tidak ada metode pembayaran tanpa nomor rujukan');

  const fixture = {
    schema: SCHEMA,
    username,
    password,
    tag,
    subjectId,
    platformUserId,
    outletId,
    terminalId,
    warehouseId,
    productId,
    productName: 'Produk Uji Kasir',
    barcode,
    unitPrice: 10000,
    paymentMethodName: metode.name,
  };

  mkdirSync(dirname(BERKAS), { recursive: true });
  writeFileSync(BERKAS, JSON.stringify(fixture, null, 2));
  console.log(`Fixture POS siap: ${username} pada ${SCHEMA} (barcode ${barcode})`);
}

async function bersihkan({ diam = false } = {}) {
  if (!existsSync(BERKAS)) {
    if (!diam) console.log('Tidak ada fixture untuk dibersihkan.');
    return;
  }
  const f = JSON.parse(readFileSync(BERKAS, 'utf8'));

  try {
    // Urutan dari anak ke induk. Buku besar pergerakan stok TIDAK dihapus —
    // penjaga immutability V008 menolaknya, dan itu memang perilaku yang benar.
    await q(
      `DELETE FROM "${f.schema}".accounting_event WHERE source_id IN
         (SELECT id FROM "${f.schema}".pos_sale WHERE terminal_id = $1)`,
      [f.terminalId],
    );
    await q(
      `DELETE FROM "${f.schema}".pos_sale_receipt WHERE pos_sale_id IN
         (SELECT id FROM "${f.schema}".pos_sale WHERE terminal_id = $1)`,
      [f.terminalId],
    );
    await q(
      `DELETE FROM "${f.schema}".stock_reservation WHERE source_id IN
         (SELECT l.id FROM "${f.schema}".pos_sale_line l
            JOIN "${f.schema}".pos_sale s ON s.id = l.pos_sale_id WHERE s.terminal_id = $1)`,
      [f.terminalId],
    );
    await q(`DELETE FROM "${f.schema}".pos_sale WHERE terminal_id = $1`, [f.terminalId]);
    await q(
      `DELETE FROM "${f.schema}".cash_drawer_movement WHERE shift_id IN
         (SELECT id FROM "${f.schema}".pos_shift WHERE terminal_id = $1)`,
      [f.terminalId],
    );
    await q(`DELETE FROM "${f.schema}".pos_shift WHERE terminal_id = $1`, [f.terminalId]);
    await q(`DELETE FROM "${f.schema}".pos_register_assignment WHERE terminal_id = $1`, [f.terminalId]);
    await q(`DELETE FROM "${f.schema}".pos_terminal WHERE id = $1`, [f.terminalId]);

    await q(`DELETE FROM "${f.schema}".product_barcode WHERE product_id = $1`, [f.productId]);
    await q(`DELETE FROM "${f.schema}".stock_balance WHERE product_id = $1`, [f.productId]);
    // Produk yang sudah pernah terjual dirujuk buku besar dan tidak dapat
    // dihapus permanen; dinonaktifkan saja, seperti produk sungguhan.
    await q(
      `UPDATE "${f.schema}".product SET is_active = FALSE, deleted_at = now(),
              delete_reason = 'Produk uji Playwright' WHERE id = $1`,
      [f.productId],
    );
    await q(`DELETE FROM "${f.schema}".product WHERE id = $1 AND NOT EXISTS (
              SELECT 1 FROM "${f.schema}".stock_movement WHERE product_id = $1)`, [f.productId]);

    await q(`DELETE FROM "${f.schema}".user_role_assignment WHERE user_subject_id = $1`, [f.subjectId]);
    await q(`DELETE FROM "${f.schema}".user_subject WHERE id = $1`, [f.subjectId]);
    await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [f.platformUserId]);
    await q(`DELETE FROM platform.platform_user WHERE id = $1`, [f.platformUserId]);

    if (!diam) console.log(`Fixture POS ${f.username} dibersihkan.`);
  } catch (e) {
    console.warn(`Peringatan: pembersihan fixture tidak tuntas — ${e.message}`);
  } finally {
    rmSync(BERKAS, { force: true });
  }
}
