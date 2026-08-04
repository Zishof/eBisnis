/**
 * Bukti H-9F: settlement jasa, koreksi, dan pernyataan.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan di sini: **tidak ada satu pun jalan yang
 * menghapus.** Settlement yang sudah dikunci, koreksinya, dan pernyataannya
 * seluruhnya kekal — dan naskah ini mencoba menghapus ketiganya lewat SQL
 * langsung.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - simulasi dibayarkan;
 * - tanda simulasi diubah menjadi settlement sungguhan;
 * - yang menghitung menyetujui sendiri;
 * - yang menyetujui membayar sendiri;
 * - pembalikan sebagian yang menyamar sebagai pembalikan penuh;
 * - koreksi melebihi nilai settlement;
 * - pembuat koreksi menyetujuinya sendiri;
 * - baris settlement yang sudah dikunci diubah;
 * - pernyataan diterbitkan dua kali dengan angka berbeda.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3200/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';

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

async function gagal(sql, params = []) {
  try {
    await client.query(sql, params);
    return null;
  } catch (e) {
    return String(e.message);
  }
}

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

const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_stl_${nama}_${tag}`;
  const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const platformUserId = randomUUID();

  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,$4,$5,'ACTIVE',FALSE,FALSE,now(),now())`,
    [platformUserId, username, `${username}@contoh.invalid`, nama, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, platformUserId],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,$3,$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [platformUserId, username, nama],
    )
  )[0].id;

  const roleId = (
    await q(
      `INSERT INTO "${SCHEMA}".role (code, name, description, is_system)
       VALUES ($1,$2,'Peran naskah bukti H-9F',FALSE) RETURNING id`,
      [`BUKTI_STL_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
    )
  )[0].id;

  const menus = new Map(
    (await q(`SELECT id, code FROM "${SCHEMA}".menu WHERE deleted_at IS NULL`)).map((m) => [m.code, m.id]),
  );
  const aksi = new Map(
    (await q(`SELECT id, code FROM "${SCHEMA}".permission_action`)).map((a) => [a.code, a.id]),
  );

  for (const [menuCode, aksiCodes] of Object.entries(hakPerMenu)) {
    const menuId = menus.get(menuCode);
    if (!menuId) continue;
    for (const aksiCode of aksiCodes) {
      const aksiId = aksi.get(aksiCode);
      if (!aksiId) continue;
      await q(
        `INSERT INTO "${SCHEMA}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
         VALUES ($1,$2,$3,'ALLOW') ON CONFLICT DO NOTHING`,
        [roleId, menuId, aksiId],
      );
    }
  }

  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, roleId],
  );

  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const token = masuk.data?.accessToken;
  if (!token) throw new Error(`login ${nama} gagal: ${JSON.stringify(masuk.body).slice(0, 300)}`);
  return { token, subjectId, username };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-9F — SETTLEMENT JASA, KOREKSI, DAN PERNYATAAN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const penghitung = await buatPengguna(tenantId, 'penghitung', {
    HEALTH: ['READ'],
    HEALTH_FEE_SETTLEMENT: ['READ', 'CREATE'],
    HEALTH_FEE_POLICY: ['READ', 'CREATE', 'UPDATE'],
  });
  const penyetuju = await buatPengguna(tenantId, 'penyetuju', {
    HEALTH: ['READ'],
    HEALTH_FEE_SETTLEMENT: ['READ', 'APPROVE'],
    HEALTH_FEE_POLICY: ['READ', 'APPROVE', 'ACTIVATE'],
  });
  const pembayar = await buatPengguna(tenantId, 'pembayar', {
    HEALTH: ['READ'],
    HEALTH_FEE_SETTLEMENT: ['READ', 'POST'],
    HEALTH_FEE_STATEMENT: ['READ', 'CREATE', 'EXPORT'],
  });
  const pengoreksi = await buatPengguna(tenantId, 'pengoreksi', {
    HEALTH: ['READ'],
    HEALTH_FEE_SETTLEMENT: ['READ', 'REVERSE'],
    HEALTH_FEE_STATEMENT: ['READ'],
  });

  log('');
  log('Empat pengguna, satu untuk tiap wewenang: menghitung, menyetujui, mengunci');
  log('dan membayar, lalu mengoreksi. Tidak satu pun memegang dua di antaranya.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Settlement','HOSPITAL') RETURNING id`,
      [`BKST-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Settlement','Asia/Jakarta') RETURNING id`,
      [typeId, `ST-${tag}`],
    )
  )[0].id;
  const dokterId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type)
       VALUES ($1,'dr. Penerima Bukti','DOCTOR') RETURNING id`,
      [`DRST-${tag}`],
    )
  )[0].id;

  const kebijakan = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `STL-${tag.toUpperCase()}`, name: 'Kebijakan Settlement Bukti',
        basis: 'PAID_CLAIM',
        lines: [
          { recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 40, providerId: dokterId },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 60 },
        ],
      }),
    },
    penghitung.token,
  );
  await api(
    `/health/fee/policies/${kebijakan.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Disepakati bersama komite medis.' }) },
    penyetuju.token,
  );

  // --- 1. Simulasi ----------------------------------------------------------
  log('');
  log('1. Simulasi tidak pernah menjadi utang');
  const simulasi = await api(
    '/health/settlement',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, policyId: kebijakan.data?.id, periodYear: 2026, periodMonth: 7,
        basisAmount: 10000000, taxRatePercent: 5, isSimulation: true,
      }),
    },
    penghitung.token,
  );
  check('simulasi dihitung', simulasi.status === 201,
    `status ${simulasi.status} ${pesan(simulasi)}`);
  check('nomornya berawalan SIM, bukan STL',
    String(simulasi.data?.settlementNumber ?? '').startsWith('SIM-'),
    simulasi.data?.settlementNumber);
  check('dan diberi tahu bahwa ia tidak akan pernah dibayarkan',
    String(simulasi.data?.note ?? '').includes('tidak akan pernah dapat dibayarkan'));

  const bayarSimulasi = await api(
    `/health/settlement/${simulasi.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ reference: 'TRF-001' }) },
    pembayar.token,
  );
  check('membayar simulasi DITOLAK', bayarSimulasi.status === 422,
    `status ${bayarSimulasi.status}`);
  check('penolakannya menyebut salah menekan tombol',
    pesan(bayarSimulasi).includes('salah menekan tombol'));

  const ubahTanda = await gagal(
    `UPDATE "${SCHEMA}".fee_settlement SET is_simulation = FALSE WHERE id = $1`,
    [simulasi.data?.id],
  );
  check('mengubah tanda simulasi lewat basis data ditolak trigger',
    (ubahTanda ?? '').includes('SETTLEMENT_SIMULATION_IMMUTABLE'), ubahTanda ?? 'lolos');
  check('penolakannya menyebut pintu paling sunyi',
    (ubahTanda ?? '').includes('pintu paling sunyi'));

  /*
   * Seluruh syarat lain dipenuhi sekaligus — disetujui orang kedua, dikunci,
   * dibayar, dan berujukan — supaya satu-satunya yang tersisa untuk menolaknya
   * adalah tanda simulasinya. Tanpa itu, constraint kelengkapan persetujuan
   * yang akan menolaknya lebih dahulu, dan naskah ini akan lulus tanpa
   * membuktikan apa yang hendak dibuktikannya.
   */
  const tembusBayarSimulasi = await gagal(
    `UPDATE "${SCHEMA}".fee_settlement
        SET status = 'PAID', approved_by = $2, approved_at = now(),
            locked_at = now(), paid_at = now(), paid_reference = 'TEMBUS'
      WHERE id = $1`,
    [simulasi.data?.id, penyetuju.subjectId],
  );
  check('membayar simulasi lewat basis data ditolak constraint',
    (tembusBayarSimulasi ?? '').includes('fee_settlement_simulation_never_paid'),
    tembusBayarSimulasi ?? 'lolos');

  // --- 2. Settlement sungguhan ----------------------------------------------
  log('');
  log('2. Empat wewenang, empat pemegang berbeda');
  const stl = await api(
    '/health/settlement',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, policyId: kebijakan.data?.id, periodYear: 2026, periodMonth: 7,
        basisAmount: 10000000, taxRatePercent: 5, payerPaysByClaim: true,
      }),
    },
    penghitung.token,
  );
  check('settlement sungguhan dihitung', stl.status === 201,
    `status ${stl.status} ${pesan(stl)}`);
  check('nomornya berawalan STL', String(stl.data?.settlementNumber ?? '').startsWith('STL-'));
  check('versi kebijakan DISALIN', typeof stl.data?.policyVersion === 'number');

  const jumlahBaris = await q(
    `SELECT sum(gross_amount)::float8 AS kotor, sum(net_amount)::float8 AS bersih,
            sum(tax_amount)::float8 AS pajak
       FROM "${SCHEMA}".fee_settlement_line WHERE settlement_id = $1`,
    [stl.data?.id],
  );
  check('jumlah baris sama persis dengan nilai dasarnya', jumlahBaris[0].kotor === 10000000,
    `${jumlahBaris[0].kotor}`);
  check('pajak hanya dipotong dari jasa perorangan', jumlahBaris[0].pajak === 200000,
    `pajak ${jumlahBaris[0].pajak}`);
  check('nilai bersih sama dengan kotor dikurangi pajak',
    jumlahBaris[0].bersih === 10000000 - 200000);

  const setujuSendiri = await api(
    `/health/settlement/${stl.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Sudah saya periksa sendiri, aman.' }) },
    penghitung.token,
  );
  check('yang menghitung tidak berwenang menyetujui', setujuSendiri.status === 403,
    `status ${setujuSendiri.status}`);

  const setuju = await api(
    `/health/settlement/${stl.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Dicocokkan dengan rekening koran klaim bulan Juli.' }),
    },
    penyetuju.token,
  );
  check('penyetuju menyetujuinya', setuju.status === 200 || setuju.status === 201,
    `status ${setuju.status} ${pesan(setuju)}`);

  const penyetujuMengunci = await api(
    `/health/settlement/${stl.data?.id}/lock`,
    { method: 'POST' },
    penyetuju.token,
  );
  check('yang menyetujui tidak berwenang mengunci dan membayar',
    penyetujuMengunci.status === 403, `status ${penyetujuMengunci.status}`);

  const kunci = await api(
    `/health/settlement/${stl.data?.id}/lock`,
    { method: 'POST' },
    pembayar.token,
  );
  check('petugas pembayaran menguncinya', kunci.status === 200 || kunci.status === 201,
    `status ${kunci.status} ${pesan(kunci)}`);
  check('dan diberi tahu bahwa sejak ini hanya koreksi yang mungkin',
    String(kunci.data?.note ?? '').includes('meninggalkan barisnya sendiri'));

  const bayarTanpaRujukan = await api(
    `/health/settlement/${stl.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ reference: '  ' }) },
    pembayar.token,
  );
  check('pembayaran tanpa rujukan transaksi ditolak',
    bayarTanpaRujukan.status === 400 || bayarTanpaRujukan.status === 422,
    `status ${bayarTanpaRujukan.status}`);

  const bayar = await api(
    `/health/settlement/${stl.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ reference: `TRF-${tag}` }) },
    pembayar.token,
  );
  check('pembayaran dicatat beserta rujukannya', bayar.data?.status === 'PAID',
    `status ${bayar.status} ${pesan(bayar)}`);

  // --- 3. Yang sudah dikunci tidak dapat diubah -----------------------------
  log('');
  log('3. Yang sudah dikunci tidak diubah dan tidak dihapus');
  const ubahBaris = await gagal(
    `UPDATE "${SCHEMA}".fee_settlement_line SET gross_amount = 99, net_amount = 99
      WHERE settlement_id = $1`,
    [stl.data?.id],
  );
  check('mengubah baris settlement terkunci ditolak trigger',
    (ubahBaris ?? '').includes('SETTLEMENT_LOCKED'), ubahBaris ?? 'lolos');

  const hapusBaris = await gagal(
    `DELETE FROM "${SCHEMA}".fee_settlement_line WHERE settlement_id = $1`,
    [stl.data?.id],
  );
  check('menghapusnya pun ditolak',
    (hapusBaris ?? '').includes('SETTLEMENT_LOCKED'), hapusBaris ?? 'lolos');

  const ubahDasar = await gagal(
    `UPDATE "${SCHEMA}".fee_settlement SET basis_amount = 1 WHERE id = $1`,
    [stl.data?.id],
  );
  check('mengubah nilai dasarnya ditolak trigger',
    (ubahDasar ?? '').includes('SETTLEMENT_LOCKED'), ubahDasar ?? 'lolos');

  const hapusSettlement = await gagal(
    `DELETE FROM "${SCHEMA}".fee_settlement WHERE id = $1`,
    [stl.data?.id],
  );
  check('settlement tidak dapat dihapus sama sekali',
    (hapusSettlement ?? '').includes('LEDGER_IMMUTABLE'), hapusSettlement ?? 'lolos');

  // --- 4. Koreksi -----------------------------------------------------------
  log('');
  log('4. Kekeliruan diperbaiki lewat koreksi, bukan penghapusan');
  const balikSebagian = await api(
    `/health/settlement/${stl.data?.id}/corrections`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'REVERSAL', amount: 3000000,
        reason: 'Klaim disetujui kurang; berkas nomor 456/VII/2026.',
      }),
    },
    pengoreksi.token,
  );
  check('pembalikan SEBAGIAN ditolak', balikSebagian.status === 422,
    `status ${balikSebagian.status}`);
  check('penolakannya menyebut selisih yang ditemukan setahun kemudian',
    pesan(balikSebagian).includes('setahun kemudian'));

  const tanpaAlasan = await api(
    `/health/settlement/${stl.data?.id}/corrections`,
    { method: 'POST', body: JSON.stringify({ type: 'ADJUSTMENT', amount: 1000, reason: 'salah' }) },
    pengoreksi.token,
  );
  check('koreksi tanpa alasan yang bermakna ditolak',
    tanpaAlasan.status === 400 || tanpaAlasan.status === 422, `status ${tanpaAlasan.status}`);

  const penyesuaian = await api(
    `/health/settlement/${stl.data?.id}/corrections`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'ADJUSTMENT', amount: 3000000,
        reason: 'Klaim disetujui tujuh juta dari sepuluh juta; berkas 456/VII/2026.',
      }),
    },
    pengoreksi.token,
  );
  check('penyesuaian sebagian diterima', penyesuaian.status === 201,
    `status ${penyesuaian.status} ${pesan(penyesuaian)}`);
  check('dan menyebutkan nilai akhirnya', penyesuaian.data?.resultingAmount === 7000000,
    `${penyesuaian.data?.resultingAmount}`);
  check('serta menyatakan ia belum berlaku sampai disetujui',
    String(penyesuaian.data?.note ?? '').includes('belum berlaku'));

  const setujuKoreksiSendiri = await api(
    `/health/settlement/corrections/${penyesuaian.data?.id}/approve`,
    { method: 'POST' },
    pengoreksi.token,
  );
  check('pembuat koreksi tidak berwenang menyetujuinya', setujuKoreksiSendiri.status === 403,
    `status ${setujuKoreksiSendiri.status}`);

  const setujuKoreksi = await api(
    `/health/settlement/corrections/${penyesuaian.data?.id}/approve`,
    { method: 'POST' },
    penyetuju.token,
  );
  check('penyetuju menyetujui koreksinya',
    setujuKoreksi.status === 200 || setujuKoreksi.status === 201,
    `status ${setujuKoreksi.status} ${pesan(setujuKoreksi)}`);

  const koreksiBerlebih = await api(
    `/health/settlement/${stl.data?.id}/corrections`,
    {
      method: 'POST',
      body: JSON.stringify({
        type: 'ADJUSTMENT', amount: 8000000,
        reason: 'Percobaan koreksi yang melebihi sisanya; sengaja untuk naskah bukti.',
      }),
    },
    pengoreksi.token,
  );
  check('koreksi yang membuat nilainya negatif DITOLAK', koreksiBerlebih.status === 422,
    `status ${koreksiBerlebih.status}`);
  check('penolakannya menyebut menagih kembali kepada dokter',
    pesan(koreksiBerlebih).includes('menagih kembali kepada dokter'));

  const tembusKoreksiBerlebih = await gagal(
    `INSERT INTO "${SCHEMA}".fee_settlement_correction
       (settlement_id, correction_type, amount, reason)
     VALUES ($1,'ADJUSTMENT',8000000,'Tembus lewat SQL langsung untuk naskah bukti.')`,
    [stl.data?.id],
  );
  check('menembusnya lewat basis data ditolak constraint trigger',
    (tembusKoreksiBerlebih ?? '').includes('CORRECTION_EXCEEDS_SETTLEMENT'),
    tembusKoreksiBerlebih ?? 'lolos');

  const hapusKoreksi = await gagal(
    `DELETE FROM "${SCHEMA}".fee_settlement_correction WHERE id = $1`,
    [penyesuaian.data?.id],
  );
  check('koreksi tidak dapat dihapus',
    (hapusKoreksi ?? '').includes('LEDGER_IMMUTABLE'), hapusKoreksi ?? 'lolos');

  const tembusSetujuKoreksiSendiri = await gagal(
    `UPDATE "${SCHEMA}".fee_settlement_correction
        SET approved_by = created_by, approved_at = now() WHERE id = $1`,
    [penyesuaian.data?.id],
  );
  check('menyetujui koreksi sendiri lewat basis data ditolak constraint',
    (tembusSetujuKoreksiSendiri ?? '').includes('fee_correction_approval_not_self'),
    tembusSetujuKoreksiSendiri ?? 'lolos');

  // --- 5. Pernyataan --------------------------------------------------------
  log('');
  log('5. Pernyataan memuat yang benar-benar dibayarkan');
  const pernyataan = await api(
    '/health/settlement/statements',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, providerId: dokterId, periodYear: 2026, periodMonth: 7 }),
    },
    pembayar.token,
  );
  check('pernyataan diterbitkan', pernyataan.status === 201,
    `status ${pernyataan.status} ${pesan(pernyataan)}`);
  check('nilai kotor, pajak, dan bersih dinyatakan ketiganya',
    pernyataan.data?.grossAmount === 4000000 && pernyataan.data?.taxAmount === 200000,
    JSON.stringify({ kotor: pernyataan.data?.grossAmount, pajak: pernyataan.data?.taxAmount }));
  check('koreksi yang sudah disetujui mengurangi nilai bersihnya',
    pernyataan.data?.adjustmentAmount === 3000000,
    `${pernyataan.data?.adjustmentAmount}`);
  check('dan nilai bersihnya memperhitungkan keduanya',
    pernyataan.data?.netAmount === 4000000 - 200000 - 3000000,
    `${pernyataan.data?.netAmount}`);

  const simulasiTidakMasuk = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_settlement_line l
       JOIN "${SCHEMA}".fee_settlement s ON s.id = l.settlement_id
      WHERE l.provider_id = $1 AND s.is_simulation = TRUE`,
    [dokterId],
  );
  check('simulasi memang ada barisnya di basis data', simulasiTidakMasuk[0].n > 0,
    `${simulasiTidakMasuk[0].n} baris`);
  check('tetapi TIDAK ikut masuk pernyataan',
    pernyataan.data?.settlementCount === 1, `${pernyataan.data?.settlementCount} settlement`);
  check('dan yang dikecualikan disebutkan', (pernyataan.data?.excluded ?? 0) > 0,
    `${pernyataan.data?.excluded}`);

  const terbitUlang = await api(
    '/health/settlement/statements',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, providerId: dokterId, periodYear: 2026, periodMonth: 7 }),
    },
    pembayar.token,
  );
  check('menerbitkan ulang pernyataan yang sama DITOLAK', terbitUlang.status === 409,
    `status ${terbitUlang.status}`);
  check('penolakannya menyebut dua kertas',
    pesan(terbitUlang).includes('dua kertas'));

  const koreksiPernyataan = await api(
    '/health/settlement/statements',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, providerId: dokterId, periodYear: 2026, periodMonth: 7,
        isCorrection: true, correctsStatementId: pernyataan.data?.id,
      }),
    },
    pembayar.token,
  );
  check('pernyataan KOREKSI diterima bila menunjuk yang dikoreksinya',
    koreksiPernyataan.status === 201, `status ${koreksiPernyataan.status} ${pesan(koreksiPernyataan)}`);

  const hapusPernyataan = await gagal(
    `DELETE FROM "${SCHEMA}".fee_statement WHERE id = $1`,
    [pernyataan.data?.id],
  );
  check('pernyataan tidak dapat dihapus',
    (hapusPernyataan ?? '').includes('LEDGER_IMMUTABLE'), hapusPernyataan ?? 'lolos');

  const duaAsli = await gagal(
    `INSERT INTO "${SCHEMA}".fee_statement
       (statement_number, facility_id, provider_id, period_year, period_month,
        gross_amount, net_amount)
     VALUES ($1,$2,$3,2026,7,1,1)`,
    [`PJX-${tag}`, facilityId, dokterId],
  );
  check('dua pernyataan ASLI pada periode yang sama ditolak indeks unik',
    (duaAsli ?? '').includes('ux_fee_statement_original'), duaAsli ?? 'lolos');

  const daftarPernyataan = await api(
    `/health/settlement/statements?providerId=${dokterId}`,
    {},
    pembayar.token,
  );
  check('penerimanya memegang DUA kertas, bukan satu yang berganti isi',
    (daftarPernyataan.data ?? []).length === 2,
    `${(daftarPernyataan.data ?? []).length} pernyataan`);

  // --- 6. Tidak ada penghapusan sama sekali ---------------------------------
  log('');
  log('6. TIDAK ADA SATU PUN JALAN YANG MENGHAPUS');
  const jalanHapus = await q(
    `SELECT count(*)::int AS n FROM information_schema.triggers
      WHERE trigger_schema = $1
        AND event_object_table IN ('fee_settlement','fee_settlement_correction','fee_statement')
        AND event_manipulation = 'DELETE'
        AND action_statement LIKE '%forbid_ledger_mutation%'`,
    [SCHEMA],
  );
  check('ketiga tabelnya berpenjaga anti-hapus', jalanHapus[0].n === 3,
    `${jalanHapus[0].n} trigger`);

  const detail = await api(`/health/settlement/${stl.data?.id}`, {}, penghitung.token);
  check('settlement terbaca beserta baris dan koreksinya',
    (detail.data?.lines ?? []).length > 0 && (detail.data?.corrections ?? []).length > 0,
    `${(detail.data?.lines ?? []).length} baris, ${(detail.data?.corrections ?? []).length} koreksi`);

  const papan = await api(
    `/health/settlement?facilityId=${facilityId}&year=2026`,
    {},
    penghitung.token,
  );
  check('papan settlement memisahkan simulasi dari yang sungguhan',
    (papan.data ?? []).some((s) => s.is_simulation === true) &&
      (papan.data ?? []).some((s) => s.is_simulation === false));
  check('dan yang sungguhan berada di atas', (papan.data ?? [])[0]?.is_simulation === false,
    JSON.stringify((papan.data ?? []).slice(0, 3).map((s) => s.settlement_number)));

  // --- Kesimpulan ----------------------------------------------------------
  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  log('');
  log(`GALAT: ${e.message}`);
  failures += 1;
} finally {
  writeFileSync(
    new URL('../../../docs/emedik/bukti-h9f-settlement.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
