/**
 * Bukti H-9N: pemetaan akuntansi kesehatan.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan di sini bukan bahwa pemetaannya berjalan,
 * melainkan bahwa **tidak ada buku besar kedua**: tidak satu pun jalan pada
 * modul ini menghasilkan jurnal, dan laporan kesiapannya berkata terus terang
 * bahwa penjurnalannya menunggu mesin akuntansi bersama.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - menautkan peran pendapatan ke akun bersaldo normal debit;
 * - menautkan ke akun induk yang tidak menerima posting;
 * - satu peran menunjuk dua akun;
 * - debit dan kredit peran yang sama;
 * - rumus pada medan nilai;
 * - petugas keuangan membaca rekam medis pasien.
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
  const username = `bukti_acc_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9N',FALSE) RETURNING id`,
      [`BUKTI_ACC_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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

/** Membuat satu akun pada bagan akun bersama. Kami menunjuknya, tidak membuat tabelnya. */
async function buatAkun(kode, nama, normal, allowPosting = true) {
  return (
    await q(
      `INSERT INTO "${SCHEMA}".chart_of_account
         (code, name, normal_balance, allow_posting, is_active)
       VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
      [kode, nama, normal, allowPosting],
    )
  )[0].id;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-9N — PEMETAAN AKUNTANSI KESEHATAN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const keuangan = await buatPengguna(tenantId, 'keuangan', {
    HEALTH: ['READ'],
    HEALTH_ACCOUNTING_MAP: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_SERVICE_CATALOG: ['READ'],
    // Sengaja TANPA HEALTH_PATIENT sama sekali.
  });

  log('');
  log('Satu pengguna: petugas keuangan, sengaja TANPA hak membaca rekam medis.');
  log('Ia perlu tahu bahwa pendapatan laboratorium masuk ke akun 4160; ia tidak');
  log('perlu tahu siapa yang diperiksa.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Akuntansi','HOSPITAL') RETURNING id`,
      [`BKAC-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Akuntansi','Asia/Jakarta') RETURNING id`,
      [typeId, `AC-${tag}`],
    )
  )[0].id;

  const akunPendapatanLab = await buatAkun(`4160-${tag}`, 'Pendapatan Laboratorium', 'CREDIT');
  const akunPiutangPasien = await buatAkun(`1131-${tag}`, 'Piutang Pasien', 'DEBIT');
  const akunKas = await buatAkun(`1111-${tag}`, 'Kas', 'DEBIT');
  const akunDeposit = await buatAkun(`2131-${tag}`, 'Deposit Pasien', 'CREDIT');
  const akunHppReagen = await buatAkun(`5130-${tag}`, 'Harga Pokok Reagen', 'DEBIT');
  const akunPersediaanReagen = await buatAkun(`1143-${tag}`, 'Persediaan Reagen', 'DEBIT');
  const akunInduk = await buatAkun(`4000-${tag}`, 'Pendapatan (induk)', 'CREDIT', false);

  // --- 1. Templat bagan akun ------------------------------------------------
  log('');
  log('1. Templat bagan akun disemai sebagai DATA, bukan ditanam di dalam kode');
  const templat = await api('/health/accounting/coa-template', {}, keuangan.token);
  check('templat terbaca', templat.status === 200, `status ${templat.status}`);
  check('memuat sekurang-kurangnya 35 akun', (templat.data ?? []).length >= 35,
    `${(templat.data ?? []).length} akun`);

  const bebanKlaim = (templat.data ?? []).find((t) => t.role === 'EXPENSE_CLAIM_ADJUSTMENT');
  check('memuat Beban Penyesuaian Klaim', Boolean(bebanKlaim));
  check('dan menerangkan mengapa selisih klaim harus terlihat',
    String(bebanKlaim?.note ?? '').includes('mutu pengkodean'));

  const akumulasi = (templat.data ?? []).find((t) => t.role === 'ACCUMULATED_DEPRECIATION');
  check('akumulasi penyusutan bergolongan ASET tetapi bersaldo normal KREDIT',
    akumulasi?.account_group === 'ASSET' && akumulasi?.normal_balance === 'CREDIT',
    JSON.stringify(akumulasi));

  const deposit = (templat.data ?? []).find((t) => t.role === 'PATIENT_DEPOSIT');
  check('deposit pasien adalah LIABILITAS, bukan pendapatan',
    deposit?.account_group === 'LIABILITY');

  // --- 2. Profil dan penautan -----------------------------------------------
  log('');
  log('2. Peran akun ditautkan ke akun BERSAMA — tidak ada bagan akun kedua');
  const profil = await api(
    '/health/accounting/profiles',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId,
        name: 'Profil Akuntansi RS Bukti',
        enabledEvents: [
          'HEALTH_SERVICE_RENDERED_CASH',
          'HEALTH_REAGENT_CONSUMED',
          'HEALTH_DEPOSIT_RECEIVED',
          'HEALTH_DEPOSIT_APPLIED',
        ],
      }),
    },
    keuangan.token,
  );
  check('profil dibuat', profil.status === 201, `status ${profil.status} ${pesan(profil)}`);
  const profileId = profil.data?.id;

  const peristiwaAsing = await api(
    '/health/accounting/profiles',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, name: 'Profil Karangan', enabledEvents: ['HEALTH_TIDAK_ADA'],
      }),
    },
    keuangan.token,
  );
  check('peristiwa yang tidak dikenal ditolak',
    peristiwaAsing.status === 400 || peristiwaAsing.status === 422,
    `status ${peristiwaAsing.status}`);

  const tautSah = await api(
    `/health/accounting/profiles/${profileId}/links`,
    { method: 'POST', body: JSON.stringify({ role: 'AR_PATIENT', accountId: akunPiutangPasien }) },
    keuangan.token,
  );
  check('penautan yang sah diterima', tautSah.status === 201 || tautSah.status === 200,
    `status ${tautSah.status} ${pesan(tautSah)}`);

  const tautTerbalik = await api(
    `/health/accounting/profiles/${profileId}/links`,
    { method: 'POST', body: JSON.stringify({ role: 'REVENUE_LAB', accountId: akunPiutangPasien }) },
    keuangan.token,
  );
  check('peran PENDAPATAN ke akun bersaldo normal debit DITOLAK', tautTerbalik.status === 422,
    `status ${tautTerbalik.status}`);
  check('penolakannya menyebut akibatnya pada laporan',
    pesan(tautTerbalik).includes('berlawanan tanda'));

  const tautInduk = await api(
    `/health/accounting/profiles/${profileId}/links`,
    { method: 'POST', body: JSON.stringify({ role: 'REVENUE_LAB', accountId: akunInduk }) },
    keuangan.token,
  );
  check('penautan ke akun INDUK ditolak', tautInduk.status === 422, `status ${tautInduk.status}`);
  check('penolakannya menyuruh memakai akun anaknya',
    pesan(tautInduk).includes('akun anaknya'));

  const tembusTerbalik = await gagal(
    `INSERT INTO "${SCHEMA}".health_account_link (profile_id, role, account_id)
     VALUES ($1,'REVENUE_LAB',$2)`,
    [profileId, akunPiutangPasien],
  );
  check('menembusnya lewat basis data pun ditolak trigger',
    (tembusTerbalik ?? '').includes('HEALTH_ACCOUNT_LINK_INVALID'), tembusTerbalik ?? 'lolos');

  const tembusInduk = await gagal(
    `INSERT INTO "${SCHEMA}".health_account_link (profile_id, role, account_id)
     VALUES ($1,'REVENUE_LAB',$2)`,
    [profileId, akunInduk],
  );
  check('akun induk pun ditolak trigger',
    (tembusInduk ?? '').includes('akun induk'), tembusInduk ?? 'lolos');

  // Menautkan sisanya.
  for (const [role, accountId] of [
    ['REVENUE_LAB', akunPendapatanLab],
    ['COGS_REAGENT', akunHppReagen],
    ['INVENTORY_REAGENT', akunPersediaanReagen],
    ['CASH', akunKas],
    ['PATIENT_DEPOSIT', akunDeposit],
  ]) {
    await api(
      `/health/accounting/profiles/${profileId}/links`,
      { method: 'POST', body: JSON.stringify({ role, accountId }) },
      keuangan.token,
    );
  }

  const tautUlang = await api(
    `/health/accounting/profiles/${profileId}/links`,
    { method: 'POST', body: JSON.stringify({ role: 'CASH', accountId: akunKas }) },
    keuangan.token,
  );
  check('menautkan ulang peran yang sama menggantikan, bukan menggandakan',
    tautUlang.status === 200 || tautUlang.status === 201, `status ${tautUlang.status}`);

  const jumlahKas = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_account_link
      WHERE profile_id = $1 AND role = 'CASH'`,
    [profileId],
  );
  check('satu peran hanya menunjuk satu akun', jumlahKas[0].n === 1, `${jumlahKas[0].n} baris`);

  const tembusDuaAkun = await gagal(
    `INSERT INTO "${SCHEMA}".health_account_link (profile_id, role, account_id)
     VALUES ($1,'CASH',$2)`,
    [profileId, akunPiutangPasien],
  );
  check('menembusnya lewat basis data ditolak indeks unik',
    (tembusDuaAkun ?? '').includes('ux_health_account_link'), tembusDuaAkun ?? 'lolos');

  // --- 3. Aturan pemetaan ---------------------------------------------------
  log('');
  log('3. Pemetaan tinggal di DATA, dan medan nilainya bukan rumus');
  const semaiAturan = await api(
    `/health/accounting/profiles/${profileId}/rules/seed-defaults`,
    { method: 'POST' },
    keuangan.token,
  );
  check('aturan bawaan disemai', semaiAturan.status === 201 || semaiAturan.status === 200,
    `status ${semaiAturan.status} ${pesan(semaiAturan)}`);
  check('hanya bagi peristiwa yang MEMANG dipakai fasilitas ini',
    semaiAturan.data?.created === 4, `${semaiAturan.data?.created} aturan`);
  check('dan menyuruh memeriksanya sebelum dipakai',
    String(semaiAturan.data?.note ?? '').includes('Periksalah sebelum dipakai'));

  const sisiSama = await api(
    `/health/accounting/profiles/${profileId}/rules`,
    {
      method: 'POST',
      body: JSON.stringify({
        eventCode: 'HEALTH_DEPOSIT_RECEIVED', debitRole: 'CASH', creditRole: 'CASH',
      }),
    },
    keuangan.token,
  );
  check('debit dan kredit peran yang SAMA ditolak', sisiSama.status === 422,
    `status ${sisiSama.status}`);
  check('penolakannya berkata jurnalnya tidak mengubah apa pun',
    pesan(sisiSama).includes('tidak mengubah apa pun'));

  const rumus = await api(
    `/health/accounting/profiles/${profileId}/rules`,
    {
      method: 'POST',
      body: JSON.stringify({
        eventCode: 'HEALTH_DEPOSIT_RECEIVED', debitRole: 'CASH', creditRole: 'PATIENT_DEPOSIT',
        amountKey: 'amount * 1.1',
      }),
    },
    keuangan.token,
  );
  check('RUMUS pada medan nilai ditolak', rumus.status === 400 || rumus.status === 422,
    `status ${rumus.status}`);

  const tembusRumus = await gagal(
    `INSERT INTO "${SCHEMA}".health_accounting_rule
       (profile_id, event_code, debit_role, credit_role, amount_key)
     VALUES ($1,'HEALTH_CLAIM_PAID','CASH','AR_BPJS','amount * 1.1')`,
    [profileId],
  );
  check('menembus rumus lewat basis data ditolak constraint',
    (tembusRumus ?? '').includes('health_rule_amount_key_plain'), tembusRumus ?? 'lolos');

  const tembusSisiSama = await gagal(
    `INSERT INTO "${SCHEMA}".health_accounting_rule
       (profile_id, event_code, debit_role, credit_role, amount_key)
     VALUES ($1,'HEALTH_CLAIM_PAID','CASH','CASH','paidAmount')`,
    [profileId],
  );
  check('menembus sisi yang sama lewat basis data ditolak constraint',
    (tembusSisiSama ?? '').includes('health_rule_sides_differ'), tembusSisiSama ?? 'lolos');

  // --- 4. Kesiapan ----------------------------------------------------------
  log('');
  log('4. Laporan kesiapan memisahkan pekerjaan kami dari yang menunggu Core');
  const siap = await api(
    `/health/accounting/profiles/${profileId}/readiness`,
    {},
    keuangan.token,
  );
  check('laporan kesiapan terbaca', siap.status === 200, `status ${siap.status}`);
  check('profil akunnya dinyatakan lengkap', siap.data?.complete === true,
    JSON.stringify((siap.data?.missing ?? []).map((m) => m.role)));
  check('tetapi BELUM siap menjurnal', siap.data?.ready === false);
  check('tidak ada lagi pekerjaan di pihak kami', (siap.data?.ourWork ?? []).length === 0,
    JSON.stringify(siap.data?.ourWork));
  check('seluruh peristiwanya menunggu mesin akuntansi bersama',
    (siap.data?.waitingOnCore ?? []).length === 4,
    JSON.stringify(siap.data?.waitingOnCore));
  check('dan pesannya berkata membuat buku besar kedua bukan jalan keluarnya',
    String(siap.data?.message ?? '').includes('buku besar kedua'));

  // Melepas satu penautan, supaya kekurangannya dapat diperiksa.
  await q(
    `DELETE FROM "${SCHEMA}".health_account_link WHERE profile_id = $1 AND role = 'CASH'`,
    [profileId],
  );
  const kurang = await api(
    `/health/accounting/profiles/${profileId}/readiness`,
    {},
    keuangan.token,
  );
  check('peran yang belum tertaut disebut namanya',
    (kurang.data?.missing ?? []).some((m) => m.role === 'CASH'),
    JSON.stringify((kurang.data?.missing ?? []).map((m) => m.role)));
  check('dan menyebut peristiwa apa yang menjadi buntu karenanya',
    ((kurang.data?.missing ?? []).find((m) => m.role === 'CASH')?.blocksEvents ?? []).includes(
      'HEALTH_DEPOSIT_RECEIVED',
    ));
  check('pekerjaan kami kini muncul terpisah', (kurang.data?.ourWork ?? []).length === 1,
    JSON.stringify(kurang.data?.ourWork));

  // --- 5. Tidak ada buku besar kedua ---------------------------------------
  log('');
  log('5. TIDAK ADA BUKU BESAR KEDUA');
  const peta = await api(`/health/accounting/profiles/${profileId}/map`, {}, keuangan.token);
  check('peta terbaca', peta.status === 200, `status ${peta.status}`);
  check('dan menyatakan sendiri bahwa ia tidak menghasilkan jurnal',
    String(peta.data?.note ?? '').includes('TIDAK menghasilkan jurnal'));
  check('peta menunjuk akun bagan akun BERSAMA, bukan tabel akun sendiri',
    (peta.data?.rules ?? []).some((r) => r.credit_account_code === `2131-${tag}`),
    JSON.stringify((peta.data?.rules ?? []).map((r) => r.event_code)));

  const tabelJurnal = await q(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = $1
        AND (table_name LIKE 'health%journal%' OR table_name LIKE 'health%ledger%'
             OR table_name LIKE 'health%balance%')`,
    [SCHEMA],
  );
  check('tidak ada satu pun tabel jurnal, buku besar, atau saldo milik kesehatan',
    tabelJurnal[0].n === 0, `${tabelJurnal[0].n} tabel`);

  const jurnalSebelum = await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".journal_entry`);
  const peristiwaSebelum = await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".accounting_event`);

  await api(
    `/health/accounting/profiles/${profileId}/rules/seed-defaults`,
    { method: 'POST' },
    keuangan.token,
  );
  await api(`/health/accounting/profiles/${profileId}/readiness`, {}, keuangan.token);
  await api(`/health/accounting/profiles/${profileId}/map`, {}, keuangan.token);
  await api(
    '/health/accounting/claim-adjustment',
    { method: 'POST', body: JSON.stringify({ submittedAmount: 900000, approvedAmount: 400000 }) },
    keuangan.token,
  );

  const jurnalSesudah = await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".journal_entry`);
  const peristiwaSesudah = await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".accounting_event`);
  check('memakai seluruh modul ini tidak menambah satu pun baris jurnal',
    jurnalSebelum[0].n === jurnalSesudah[0].n,
    `${jurnalSebelum[0].n} -> ${jurnalSesudah[0].n}`);
  check('dan tidak menambah satu pun peristiwa akuntansi',
    peristiwaSebelum[0].n === peristiwaSesudah[0].n,
    `${peristiwaSebelum[0].n} -> ${peristiwaSesudah[0].n}`);

  // --- 6. Selisih klaim -----------------------------------------------------
  log('');
  log('6. Selisih klaim adalah BEBAN, bukan pendapatan yang hilang begitu saja');
  const kurangBayar = await api(
    '/health/accounting/claim-adjustment?submitted=1000000&approved=750000',
    {},
    keuangan.token,
  );
  check('selisihnya dihitung', kurangBayar.data?.adjustmentAmount === 250000,
    `${kurangBayar.data?.adjustmentAmount}`);
  check('dan dinyatakan sebagai beban penyesuaian klaim',
    kurangBayar.data?.event === 'HEALTH_CLAIM_UNDERPAID');
  check('bukan dihapus dari piutang begitu saja',
    String(kurangBayar.data?.message ?? '').includes('bukan dihapus dari piutang'));
  check('dan TIDAK dijurnal', kurangBayar.data?.posted === false);
  check('sebabnya disebutkan terus terang',
    String(kurangBayar.data?.postingNote ?? '').includes('buku besar kedua'));

  const lebihBayar = await api(
    '/health/accounting/claim-adjustment?submitted=750000&approved=1000000',
    {},
    keuangan.token,
  );
  check('disetujui LEBIH BESAR daripada diajukan menuntut telaah',
    lebihBayar.data?.needsReview === true);
  check('dan tidak menghasilkan peristiwa apa pun', lebihBayar.data?.event === null);
  check('pesannya berkata itu bukan keuntungan',
    String(lebihBayar.data?.message ?? '').includes('bukan keuntungan'));

  const negatif = await api(
    '/health/accounting/claim-adjustment?submitted=-1&approved=0',
    {},
    keuangan.token,
  );
  check('nilai negatif ditolak', negatif.status === 400, `status ${negatif.status}`);

  // --- 7. Pemisahan wewenang ------------------------------------------------
  log('');
  log('7. Petugas keuangan tidak membaca rekam medis');
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Sari Bukti Akuntansi','1985-05-05','FEMALE') RETURNING id`,
      [`EPI-AC-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  const bacaPasien = await api(
    `/health/patients/${pasien}`,
    {},
    keuangan.token,
    { 'x-purpose-of-use': 'PAYMENT' },
  );
  check('petugas keuangan TIDAK dapat membaca rekam medis pasien',
    bacaPasien.status === 403, `status ${bacaPasien.status}`);

  const aturanSoD = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".segregation_of_duty_rule
      WHERE code = 'HEALTH_SOD_FINANCE_PATIENT' AND is_active = TRUE`,
  );
  check('dan aturan pemisahannya benar-benar terpasang', aturanSoD[0].n === 1);

  const peranKeuangan = await q(
    `SELECT count(*)::int AS n
       FROM "${SCHEMA}".role_menu_permission rmp
       JOIN "${SCHEMA}".role r ON r.id = rmp.role_id
       JOIN "${SCHEMA}".menu m ON m.id = rmp.menu_id
      WHERE r.code = 'HEALTH_FINANCE_OFFICER' AND m.code LIKE 'HEALTH_PATIENT%'`,
  );
  check('peran bawaan Petugas Keuangan tidak diberi hak atas menu pasien mana pun',
    peranKeuangan[0].n === 0, `${peranKeuangan[0].n} hak`);

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
    new URL('../../../docs/emedik/bukti-h9n-akuntansi.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
