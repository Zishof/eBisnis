/**
 * Bukti POS-1 dan POS-2: konteks kasir, penugasan register, shift, dan harga.
 *
 * Yang dibuktikan, dan yang ketiga adalah yang terpenting:
 *
 * 1. Kasir hanya melihat register yang ditugaskan kepadanya — bukan seluruh
 *    register tenant.
 * 2. Shift tidak dapat dibuka dua kali pada register yang sama.
 * 3. **Harga selalu ditentukan peladen.** Kasir yang mengirim harga sendiri
 *    ditolak bila tidak berwenang, dan hasilnya tetap dihitung ulang.
 *
 * Naskah ini menyiapkan sendiri apa yang dibutuhkannya — pengguna sementara,
 * terminal, penugasan — lalu membersihkannya. Ia tidak bergantung pada keadaan
 * basis data sebelumnya, sehingga dapat dijalankan berulang kali.
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
const username = `bukti_kasir_${tag}`;
const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;
let platformUserId = null;
let subjectId = null;
let terminalId = null;
let terminalIdLain = null;

async function q(sql, params = []) {
  return (await client.query(sql, params)).rows;
}

async function api(path, opts = {}, token = null) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI POS-1 dan POS-2 — KONTEKS KASIR, SHIFT, DAN HARGA OTORITATIF');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`API     : ${BASE}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  // --- Persiapan -----------------------------------------------------------
  const tenant = await q(
    `SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1 LIMIT 1`,
    [SCHEMA],
  );
  const tenantId = tenant[0]?.id;
  if (!tenantId) throw new Error(`Tenant untuk schema ${SCHEMA} tidak ditemukan`);

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

  const subject = await q(
    `INSERT INTO "${SCHEMA}".user_subject
       (platform_user_id, code, name, username_snapshot, is_owner, status)
     VALUES ($1, $2::varchar, 'Kasir Bukti', $2::varchar, FALSE, 'ACTIVE') RETURNING id`,
    [platformUserId, username],
  );
  subjectId = subject[0].id;

  const roleKasir = await q(`SELECT id FROM "${SCHEMA}".role WHERE code = 'KASIR_POS'`);
  if (!roleKasir.length) throw new Error('Peran KASIR_POS belum tersemai');
  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1, $2, CURRENT_DATE)`,
    [subjectId, roleKasir[0].id],
  );

  const outlet = await q(
    `SELECT id, brand_id FROM "${SCHEMA}".outlet WHERE deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
  );
  if (!outlet.length) throw new Error('Tidak ada outlet aktif pada schema ini');
  const outletId = outlet[0].id;

  const t1 = await q(
    `INSERT INTO "${SCHEMA}".pos_terminal (outlet_id, code, name, register_status)
     VALUES ($1, $2, 'Kasir Bukti 1', 'READY') RETURNING id`,
    [outletId, `BUKTI-${tag}-1`],
  );
  terminalId = t1[0].id;
  const t2 = await q(
    `INSERT INTO "${SCHEMA}".pos_terminal (outlet_id, code, name, register_status)
     VALUES ($1, $2, 'Kasir Bukti 2', 'READY') RETURNING id`,
    [outletId, `BUKTI-${tag}-2`],
  );
  terminalIdLain = t2[0].id;

  // Hanya terminal PERTAMA yang ditugaskan. Yang kedua sengaja tidak.
  await q(
    `INSERT INTO "${SCHEMA}".pos_register_assignment (terminal_id, user_subject_id, is_primary)
     VALUES ($1, $2, TRUE)`,
    [terminalId, subjectId],
  );

  log('');
  log(`Disiapkan: pengguna ${username}, dua terminal, satu penugasan.`);

  // --- Masuk ---------------------------------------------------------------
  log('');
  log('1. Masuk sebagai kasir');
  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  check('login berhasil', masuk.status === 200, `status ${masuk.status}`);
  const token = masuk.data?.accessToken;
  check('memperoleh token akses', Boolean(token));
  if (!token) throw new Error(`login gagal: ${JSON.stringify(masuk.body).slice(0, 300)}`);

  // --- POS-1: konteks ------------------------------------------------------
  log('');
  log('2. Konteks kasir');
  const ctx = await api('/pos/context', {}, token);
  check('konteks dapat dibaca', ctx.status === 200, `status ${ctx.status}`);
  const registers = ctx.data?.registers ?? [];
  check('hanya register yang ditugaskan yang tampil', registers.length === 1, `dapat ${registers.length}`);
  check(
    'register yang tampil adalah yang ditugaskan',
    registers[0]?.terminalId === terminalId,
  );
  check(
    'register yang TIDAK ditugaskan tidak bocor',
    !registers.some((r) => r.terminalId === terminalIdLain),
  );
  check('tanggal usaha disertakan', Boolean(ctx.data?.businessDate));
  check('ambang persetujuan disertakan', typeof ctx.data?.thresholds?.discountApprovalPct === 'number');

  // --- POS-1: shift --------------------------------------------------------
  log('');
  log('3. Membuka shift');
  const buka = await api(
    '/pos/shifts/open',
    { method: 'POST', body: JSON.stringify({ terminalId, openingCash: 500000 }) },
    token,
  );
  check('shift terbuka', buka.status === 201 || buka.status === 200, `status ${buka.status}`);
  check('memperoleh id shift', Boolean(buka.data?.shiftId));

  const bukaLagi = await api(
    '/pos/shifts/open',
    { method: 'POST', body: JSON.stringify({ terminalId, openingCash: 500000 }) },
    token,
  );
  check('buka shift kedua ditolak', bukaLagi.status === 403, `status ${bukaLagi.status}`);
  check(
    'penolakannya menyebutkan alasan yang dapat ditindaklanjuti',
    String(bukaLagi.body?.error?.message ?? '').includes('Lanjutkan'),
  );

  log('');
  log('4. Register yang tidak ditugaskan');
  const bukaAsing = await api(
    '/pos/shifts/open',
    { method: 'POST', body: JSON.stringify({ terminalId: terminalIdLain, openingCash: 100000 }) },
    token,
  );
  check('membuka register orang lain ditolak', bukaAsing.status === 403, `status ${bukaAsing.status}`);
  check(
    'alasannya: tidak ditugaskan',
    bukaAsing.body?.error?.params?.reason === 'NOT_ASSIGNED',
    JSON.stringify(bukaAsing.body?.error?.params),
  );

  // Kas awal tercatat sebagai pergerakan kas, bukan hanya kolom pada shift.
  const kas = await q(
    `SELECT movement_type, amount::text FROM "${SCHEMA}".cash_drawer_movement WHERE shift_id = $1`,
    [buka.data.shiftId],
  );
  check('kas awal tercatat sebagai pergerakan kas', kas.length === 1 && kas[0].movement_type === 'OPENING');

  // --- POS-2: katalog ------------------------------------------------------
  log('');
  log('5. Pencarian katalog');
  const cari = await api('/pos/catalog/search?q=&limit=5', {}, token);
  check('pencarian dapat dijalankan', cari.status === 200, `status ${cari.status}`);
  const produk = Array.isArray(cari.data) ? cari.data : [];
  log(`   ${produk.length} produk ditemukan`);

  if (!produk.length) {
    log('  (lewat) schema ini tanpa produk; pemeriksaan harga dilewati');
  } else {
    const p = produk[0];
    check('produk menyertakan satuannya', Boolean(p.uomId && p.uomCode));

    // --- POS-2: barcode ----------------------------------------------------
    log('');
    log('6. Pemindaian barcode');
    const bc = await q(
      `SELECT barcode FROM "${SCHEMA}".product_barcode
        WHERE product_id = $1 AND deleted_at IS NULL AND is_active = TRUE LIMIT 1`,
      [p.productId],
    );
    const kode = bc[0]?.barcode ?? p.barcode;
    if (kode) {
      const scan = await api(`/pos/products/by-barcode?code=${encodeURIComponent(kode)}`, {}, token);
      check('barcode ditemukan', scan.status === 200, `status ${scan.status}`);
      check('barcode menunjuk produk yang benar', scan.data?.productId === p.productId);
    } else {
      log('  (lewat) produk pertama tanpa barcode');
    }

    const salah = await api('/pos/products/by-barcode?code=0000000000000', {}, token);
    check('barcode tak dikenal ditolak', salah.status === 404, `status ${salah.status}`);
    check(
      'penolakannya menawarkan tindak lanjut',
      String(salah.body?.error?.message ?? '').includes('daftarkan'),
    );

    // --- POS-2: harga ------------------------------------------------------
    log('');
    log('7. Kuotasi harga');
    const quote = await api(
      '/pos/price/quote',
      {
        method: 'POST',
        body: JSON.stringify({ outletId, productId: p.productId, quantity: 2 }),
      },
      token,
    );
    check('kuotasi berhasil', quote.status === 200 || quote.status === 201, `status ${quote.status}`);
    const h = quote.data ?? {};
    log(`   satuan ${h.unitPrice} × 2 = bruto ${h.grossAmount}, pajak ${h.taxAmount}, total ${h.lineTotal}`);
    check('harga satuan dikembalikan', h.unitPrice !== undefined);
    /*
     * Harga nol hanya sah bila disertai peringatan NO_PRICE. Tanpa pemeriksaan
     * ini, produk yang belum berharga akan lolos sebagai "kuotasi berhasil"
     * dengan total nol — dan barang terjual gratis tanpa ada yang menyadarinya.
     */
    check(
      'harga nol selalu disertai peringatan, tidak pernah diam-diam',
      Number(h.unitPrice) > 0 || (h.warnings ?? []).some((w) => w.code === 'NO_PRICE'),
      `unitPrice ${h.unitPrice}, warnings ${JSON.stringify(h.warnings)}`,
    );
    check(
      'bruto benar-benar satuan dikali jumlah',
      Number(h.grossAmount) === Number(h.unitPrice) * 2,
      `${h.grossAmount} vs ${h.unitPrice}×2`,
    );
    check(
      'total adalah neto ditambah pajak',
      Number(h.lineTotal) === Number(h.netAmount) + Number(h.taxAmount),
      `${h.lineTotal} vs ${h.netAmount}+${h.taxAmount}`,
    );
    check('rincian pajak disertakan, bukan hanya jumlahnya', Array.isArray(h.taxes));

    log('');
    log('8. Harga tidak dapat ditentukan peramban');
    const paksa = await api(
      '/pos/price/quote',
      {
        method: 'POST',
        body: JSON.stringify({ outletId, productId: p.productId, quantity: 1, priceOverride: 1 }),
      },
      token,
    );
    check(
      'kasir tanpa hak PRICE_OVERRIDE ditolak',
      paksa.status === 403,
      `status ${paksa.status}`,
    );
    check(
      'penolakannya mengarahkan ke supervisor',
      String(paksa.body?.error?.message ?? '').includes('supervisor'),
    );

    log('');
    log('9. Produk nonaktif tidak dapat dijual');
    const nonaktif = await api(
      '/pos/price/quote',
      {
        method: 'POST',
        body: JSON.stringify({
          outletId,
          productId: '00000000-0000-0000-0000-000000000000',
          quantity: 1,
        }),
      },
      token,
    );
    check('produk tidak dikenal ditolak', nonaktif.status === 404, `status ${nonaktif.status}`);
  }

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  // --- Pembersihan ---------------------------------------------------------
  try {
    if (subjectId) {
      await q(`DELETE FROM "${SCHEMA}".cash_drawer_movement WHERE shift_id IN
                 (SELECT id FROM "${SCHEMA}".pos_shift WHERE cashier_id = $1)`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".pos_shift WHERE cashier_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".pos_register_assignment WHERE user_subject_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [subjectId]);
    }
    for (const id of [terminalId, terminalIdLain]) {
      if (id) await q(`DELETE FROM "${SCHEMA}".pos_terminal WHERE id = $1`, [id]);
    }
    if (platformUserId) {
      await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [platformUserId]);
      await q(`DELETE FROM platform.platform_user WHERE id = $1`, [platformUserId]);
    }
    log('');
    log('Data sementara dibersihkan.');
  } catch (e) {
    log(`Peringatan: pembersihan tidak tuntas — ${e.message}`);
  }

  await client.end();
  writeFileSync(
    new URL('../../../docs/pos-web-priority/bukti-pos-1-2.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
