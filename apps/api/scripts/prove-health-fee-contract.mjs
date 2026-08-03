/**
 * Bukti H-9G: kontrak fee sistem dan fee investor.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Dua hal yang paling penting dibuktikan di sini.
 *
 * 1. **Bawaannya NONE.** Tanpa kontrak, fee sistem dan bagian investor bernilai
 *    nol. Naskah ini memeriksanya pada basis data: tidak ada satu pun kontrak
 *    yang lahir dari migrasi, dan perhitungan tanpa kontrak mengembalikan nol
 *    beserta sebabnya.
 *
 * 2. **Investor tidak pernah memperoleh akses data pasien.** Diperiksa dari dua
 *    arah: peran bawaannya tidak memegang satu pun hak atas menu pasien, dan
 *    ringkasan yang dikirimkan kepadanya disaring lewat daftar putih.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - penyusun menelaah hukumnya sendiri;
 * - pemeriksa hukum menyetujuinya sendiri;
 * - kontrak aktif tanpa salah satu syaratnya;
 * - kontrak berlaku sejak sebelum telaah hukumnya;
 * - dua kontrak aktif untuk jenis yang sama;
 * - syarat kontrak yang sudah aktif diubah;
 * - persentase melampaui batas kontraknya.
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

/*
 * Tanggal dihitung relatif terhadap hari ini, bukan ditulis tetap.
 *
 * Telaah hukumnya terjadi pada saat naskah ini berjalan, dan kontrak tidak
 * boleh berlaku sejak sebelum ditelaah. Tanggal tetap akan membuat naskah ini
 * lulus hari ini dan gagal bulan depan — dan yang gagal bulan depan akan
 * disangka kerusakan kode.
 */
const hari = (selisih) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + selisih);
  return t.toISOString().slice(0, 10);
};
const HARI_INI = hari(0);
const KEMARIN = hari(-1);
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
  const username = `bukti_ktr_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9G',FALSE) RETURNING id`,
      [`BUKTI_KTR_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9G — KONTRAK FEE SISTEM DAN FEE INVESTOR');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const penyusun = await buatPengguna(tenantId, 'penyusun', {
    HEALTH: ['READ'],
    HEALTH_FEE_CONTRACT: ['READ', 'CREATE', 'UPDATE'],
  });
  // Sengaja diberi REVIEW pula, supaya penolakannya datang dari pemeriksaan
  // baris — bukan sekadar dari ketiadaan hak akses.
  const penyusunBerhakTelaah = penyusun;
  await q(
    `INSERT INTO "${SCHEMA}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
     SELECT r.id, m.id, a.id, 'ALLOW'
       FROM "${SCHEMA}".role r, "${SCHEMA}".menu m, "${SCHEMA}".permission_action a
      WHERE r.code = $1 AND m.code = 'HEALTH_FEE_CONTRACT' AND a.code = 'REVIEW'
     ON CONFLICT DO NOTHING`,
    [`BUKTI_KTR_PENYUSUN_${tag.toUpperCase()}`],
  );

  const hukum = await buatPengguna(tenantId, 'hukum', {
    HEALTH: ['READ'],
    HEALTH_FEE_CONTRACT: ['READ', 'REVIEW', 'APPROVE'],
  });
  const manajemen = await buatPengguna(tenantId, 'manajemen', {
    HEALTH: ['READ'],
    HEALTH_FEE_CONTRACT: ['READ', 'APPROVE', 'ACTIVATE', 'CANCEL'],
  });

  log('');
  log('Tiga pengguna. Penyusun sengaja DIBERI hak menelaah hukum pula — supaya');
  log('penolakannya datang dari pemeriksaan baris, bukan sekadar dari ketiadaan');
  log('hak akses. Hak akses menjaga siapa yang boleh membuka pintu; pemeriksaan');
  log('baris menjaga siapa yang boleh melewatinya kali ini.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Kontrak','HOSPITAL') RETURNING id`,
      [`BKKT-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Kontrak','Asia/Jakarta') RETURNING id`,
      [typeId, `KT-${tag}`],
    )
  )[0].id;

  // --- 1. Bawaannya NONE ----------------------------------------------------
  log('');
  log('1. BAWAANNYA NONE');
  const kontrakBawaan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_contract WHERE prepared_by IS NULL`,
  );
  check('migrasi tidak menyemai satu pun kontrak', kontrakBawaan[0].n === 0,
    `${kontrakBawaan[0].n} kontrak`);

  const tanpaKontrak = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 5, baseAmount: 10000000, onDate: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('perhitungan tanpa kontrak berjalan', tanpaKontrak.status === 201 || tanpaKontrak.status === 200,
    `status ${tanpaKontrak.status} ${pesan(tanpaKontrak)}`);
  check('dan hasilnya NOL', tanpaKontrak.data?.feeAmount === 0);
  check('sebabnya disebutkan: bukan taksiran, nol',
    String(tanpaKontrak.data?.message ?? '').includes('bukan taksiran, nol'));
  check('dan dicatat bahwa tidak ada kontraknya', tanpaKontrak.data?.hasContract === false);

  const jejakNol = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_contract_application
      WHERE facility_id = $1 AND fee_amount = 0`,
    [facilityId],
  );
  check('penerapan bernilai nol pun DICATAT, bukan didiamkan', jejakNol[0].n > 0,
    `${jejakNol[0].n} baris`);

  // --- 2. Tiga orang berbeda ------------------------------------------------
  log('');
  log('2. Tiga orang berbeda: penyusun, pemeriksa hukum, penyetuju manajemen');
  const kontrak = await api(
    '/health/fee-contract',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        counterpartyName: 'PT Platform eMedik',
        contractReference: `PKS-SIS-${tag}`,
        taxTreatment: 'PPh 23 dipotong rumah sakit dan disetorkan tiap bulan.',
        maximumPercent: 5,
        effectiveFrom: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('kontrak disusun sebagai DRAFT', kontrak.data?.status === 'DRAFT',
    `status ${kontrak.status} ${pesan(kontrak)}`);
  check('dan diberi tahu bahwa sampai aktif fee-nya nol',
    String(kontrak.data?.note ?? '').includes('fee-nya nol'));

  const telaahSendiri = await api(
    `/health/fee-contract/${kontrak.data?.id}/legal-review`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Sudah saya periksa sendiri; tidak ada masalah.' }),
    },
    penyusunBerhakTelaah.token,
  );
  check('penyusun yang BERHAK menelaah pun ditolak', telaahSendiri.status === 403,
    `status ${telaahSendiri.status}`);
  check('penolakannya menyebut membaca ulang kalimatnya sendiri',
    pesan(telaahSendiri).includes('baru saja ditulisnya'));

  const telaahKosong = await api(
    `/health/fee-contract/${kontrak.data?.id}/legal-review`,
    { method: 'POST', body: JSON.stringify({ note: 'oke' }) },
    hukum.token,
  );
  check('telaah hukum tanpa catatan yang bermakna ditolak',
    telaahKosong.status === 400 || telaahKosong.status === 422,
    `status ${telaahKosong.status}`);

  const telaah = await api(
    `/health/fee-contract/${kontrak.data?.id}/legal-review`,
    {
      method: 'POST',
      body: JSON.stringify({
        note: 'Ditelaah bagian hukum; klausul pemutusan dan batas maksimum sesuai kebijakan.',
      }),
    },
    hukum.token,
  );
  check('pemeriksa hukum menelaahnya', telaah.data?.status === 'LEGAL_REVIEW',
    `status ${telaah.status} ${pesan(telaah)}`);

  const hukumMenyetujui = await api(
    `/health/fee-contract/${kontrak.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Sekalian saya setujui, sudah saya periksa.' }) },
    hukum.token,
  );
  check('pemeriksa hukum yang BERHAK menyetujui pun ditolak', hukumMenyetujui.status === 403,
    `status ${hukumMenyetujui.status}`);
  check('penolakannya menyebut yang dirugikannya tidak duduk di ruangan itu',
    pesan(hukumMenyetujui).includes('tidak duduk di ruangan itu'));

  const setuju = await api(
    `/health/fee-contract/${kontrak.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Disetujui rapat direksi tanggal 20 Mei 2026, notulen 08/2026.' }),
    },
    manajemen.token,
  );
  check('penyetuju manajemen menyetujuinya', setuju.data?.status === 'MANAGEMENT_APPROVAL',
    `status ${setuju.status} ${pesan(setuju)}`);

  const tembusRantai = await gagal(
    `UPDATE "${SCHEMA}".fee_contract SET approved_by = prepared_by WHERE id = $1`,
    [kontrak.data?.id],
  );
  check('menembus rantai tiga orang lewat basis data ditolak constraint',
    (tembusRantai ?? '').includes('fee_contract_prepare_approve_differ'), tembusRantai ?? 'lolos');

  const aktif = await api(
    `/health/fee-contract/${kontrak.data?.id}/activate`,
    { method: 'POST' },
    manajemen.token,
  );
  check('kontrak diaktifkan', aktif.data?.status === 'ACTIVE',
    `status ${aktif.status} ${pesan(aktif)}`);

  // --- 3. Kelengkapan syarat ------------------------------------------------
  log('');
  log('3. Aktif menuntut SELURUH syaratnya');
  const kurang = await api(
    '/health/fee-contract',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'INVESTOR_SHARE',
        counterpartyName: 'PT Investor Bukti',
        // Sengaja tanpa nomor kontrak, pajak, dan batas maksimum.
      }),
    },
    penyusun.token,
  );
  await api(
    `/health/fee-contract/${kurang.data?.id}/legal-review`,
    { method: 'POST', body: JSON.stringify({ note: 'Ditelaah sekilas; belum lengkap syaratnya.' }) },
    hukum.token,
  );
  await api(
    `/health/fee-contract/${kurang.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Disetujui dengan catatan menyusul.' }) },
    manajemen.token,
  );
  const aktifKurang = await api(
    `/health/fee-contract/${kurang.data?.id}/activate`,
    { method: 'POST' },
    manajemen.token,
  );
  check('kontrak yang kurang syaratnya DITOLAK', aktifKurang.status === 422,
    `status ${aktifKurang.status}`);
  for (const syarat of ['nomor kontrak', 'perlakuan pajak', 'batas maksimum', 'tanggal berlaku']) {
    check(`  yang kurang disebut: ${syarat}`, pesan(aktifKurang).includes(syarat));
  }

  const tembusAktifKurang = await gagal(
    `UPDATE "${SCHEMA}".fee_contract SET status = 'ACTIVE' WHERE id = $1`,
    [kurang.data?.id],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusAktifKurang ?? '').includes('fee_contract_active_complete'),
    tembusAktifKurang ?? 'lolos');

  // --- 4. Tidak berlaku surut melampaui telaah hukum ------------------------
  log('');
  log('4. Kontrak tidak berlaku surut melampaui telaah hukumnya');
  const surut = await gagal(
    `INSERT INTO "${SCHEMA}".fee_contract
       (facility_id, contract_type, counterparty_name, legal_reviewed_at, effective_from)
     VALUES ($1,'SYSTEM_PLATFORM_FEE','PT Surut', now(), CURRENT_DATE - 30)`,
    [facilityId],
  );
  check('kontrak yang berlaku sejak sebelum telaahnya ditolak constraint',
    (surut ?? '').includes('fee_contract_not_backdated'), surut ?? 'lolos');

  // --- 5. Satu kontrak aktif per jenis --------------------------------------
  log('');
  log('5. Satu kontrak aktif per jenis per fasilitas');
  const duaAktif = await gagal(
    `INSERT INTO "${SCHEMA}".fee_contract
       (facility_id, contract_type, counterparty_name, contract_reference, legal_review_note,
        legal_reviewed_by, legal_reviewed_at, tax_treatment, maximum_percent, effective_from,
        status, prepared_by, approved_by, approved_at)
     VALUES ($1,'SYSTEM_PLATFORM_FEE','PT Kedua','PKS-2','Ditelaah seluruhnya.',
             $2, now(), 'PPh 23.', 3, CURRENT_DATE, 'ACTIVE', $3, $4, now())`,
    [facilityId, hukum.subjectId, penyusun.subjectId, manajemen.subjectId],
  );
  check('kontrak aktif kedua untuk jenis yang sama ditolak indeks unik',
    (duaAktif ?? '').includes('ux_fee_contract_one_active'), duaAktif ?? 'lolos');

  // --- 6. Syarat kontrak aktif terkunci -------------------------------------
  log('');
  log('6. Syarat kontrak yang sudah aktif tidak dapat diubah');
  const naikkanBatas = await gagal(
    `UPDATE "${SCHEMA}".fee_contract SET maximum_percent = 25 WHERE id = $1`,
    [kontrak.data?.id],
  );
  check('menaikkan batas maksimum pada kontrak berjalan ditolak trigger',
    (naikkanBatas ?? '').includes('FEE_CONTRACT_ACTIVE'), naikkanBatas ?? 'lolos');
  check('penolakannya menyebut cara paling sunyi untuk mengambil lebih banyak',
    (naikkanBatas ?? '').includes('cara paling sunyi'));

  const hapusKontrak = await gagal(
    `DELETE FROM "${SCHEMA}".fee_contract WHERE id = $1`,
    [kontrak.data?.id],
  );
  check('kontrak tidak dapat dihapus',
    (hapusKontrak ?? '').includes('LEDGER_IMMUTABLE'), hapusKontrak ?? 'lolos');

  // --- 7. Batas ditegakkan saat menghitung ----------------------------------
  log('');
  log('7. Batas maksimum ditegakkan saat MENGHITUNG, bukan sekadar dicatat');
  const sesuaiBatas = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 5, baseAmount: 10000000, onDate: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('fee dihitung menurut kontraknya', sesuaiBatas.data?.feeAmount === 500000,
    `${sesuaiBatas.data?.feeAmount}`);
  check('dan tidak dibatasi', sesuaiBatas.data?.capped === false);

  const lampauiBatas = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 25, baseAmount: 10000000, onDate: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('persentase yang melampaui batas DIBATASI, bukan ditolak diam-diam',
    lampauiBatas.data?.appliedPercent === 5 && lampauiBatas.data?.feeAmount === 500000,
    JSON.stringify(lampauiBatas.data));
  check('dan pembatasannya dinyatakan', lampauiBatas.data?.capped === true);
  check('sebabnya disebutkan: perhitungan yang tidak pernah membacanya',
    String(lampauiBatas.data?.message ?? '').includes('tidak pernah membacanya'));

  const sebelumBerlaku = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 5, baseAmount: 10000000, onDate: KEMARIN,
      }),
    },
    penyusun.token,
  );
  check('sebelum tanggal berlakunya, fee-nya nol', sebelumBerlaku.data?.feeAmount === 0);

  const jejak = await api(
    `/health/fee-contract/${kontrak.data?.id}/applications`,
    {},
    penyusun.token,
  );
  check('jejak penerapannya tercatat', (jejak.data ?? []).length >= 3,
    `${(jejak.data ?? []).length} baris`);
  check('termasuk yang dibatasi', (jejak.data ?? []).some((j) => j.was_capped === true));

  const tembusJejak = await gagal(
    `INSERT INTO "${SCHEMA}".fee_contract_application
       (facility_id, contract_type, base_amount, requested_percent, applied_percent,
        fee_amount, was_capped)
     VALUES ($1,'SYSTEM_PLATFORM_FEE',1000,5,25,250,FALSE)`,
    [facilityId],
  );
  check('jejak yang persentase terpakainya melebihi yang diminta ditolak constraint',
    (tembusJejak ?? '').includes('fee_application_applied_within'), tembusJejak ?? 'lolos');

  // --- 8. Investor tidak melihat data pasien --------------------------------
  log('');
  log('8. Investor TIDAK PERNAH memperoleh akses data pasien');
  const hakInvestor = await q(
    `SELECT count(*)::int AS n
       FROM "${SCHEMA}".role_menu_permission rmp
       JOIN "${SCHEMA}".role r ON r.id = rmp.role_id
       JOIN "${SCHEMA}".menu m ON m.id = rmp.menu_id
      WHERE r.code = 'HEALTH_INVESTOR_VIEWER'
        AND (m.code LIKE 'HEALTH_PATIENT%' OR m.code IN
             ('HEALTH_HIM_CODING','HEALTH_SAFETY','HEALTH_LAB_RESULT','HEALTH_PRESCRIPTION',
              'HEALTH_ACCESS_LOG','HEALTH_LEGAL_HOLD','HEALTH_INFO_RELEASE'))`,
  );
  check('peran investor tidak memegang satu pun hak atas menu klinis',
    hakInvestor[0].n === 0, `${hakInvestor[0].n} hak`);

  const aturanInvestor = await q(
    `SELECT severity FROM "${SCHEMA}".segregation_of_duty_rule
      WHERE code = 'HEALTH_SOD_INVESTOR_PATIENT' AND is_active = TRUE`,
  );
  check('aturan pemisahannya terpasang dan bertingkat CRITICAL',
    aturanInvestor[0]?.severity === 'CRITICAL', JSON.stringify(aturanInvestor[0]));

  const ringkasan = await api(
    `/health/fee-contract/investor-summary?facilityId=${facilityId}&year=2026`,
    {},
    penyusun.token,
  );
  check('ringkasan investor terbaca', ringkasan.status === 200, `status ${ringkasan.status}`);
  const medan = Object.keys(ringkasan.data ?? {});
  check('tidak satu pun medan pasien di dalamnya',
    !medan.some((m) => /patient|diagnos|nik|medical|nama/i.test(m)),
    JSON.stringify(medan));
  check('dan penyaringannya dilaporkan, bukan diam-diam',
    typeof ringkasan.data?._filtered === 'number');
  check('catatannya menyatakan daftar PUTIH',
    String(ringkasan.data?.note ?? '').includes('daftar PUTIH'));

  // --- 9. Pengecualian layanan ----------------------------------------------
  log('');
  log('9. Pengecualian layanan disimpan sebagai baris, bukan sebagai daftar teks');
  const layananId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service
         (facility_id, code, name, service_type, care_setting)
       VALUES ($1,$2,'Layanan Dikecualikan','CONSULTATION','OUTPATIENT') RETURNING id`,
      [facilityId, `EXC-${tag.toUpperCase()}`],
    )
  )[0].id;

  const kecuali = await api(
    `/health/fee-contract/${kontrak.data?.id}/exclusions`,
    {
      method: 'POST',
      body: JSON.stringify({
        serviceId: layananId,
        reason: 'Layanan bakti sosial; tidak dikenai fee menurut lampiran kontrak.',
      }),
    },
    penyusun.token,
  );
  check('pengecualian dicatat', kecuali.status === 201, `status ${kecuali.status} ${pesan(kecuali)}`);

  const feeDikecualikan = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 5, baseAmount: 10000000,
        serviceId: layananId, onDate: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('layanan yang dikecualikan tidak dikenai fee', feeDikecualikan.data?.feeAmount === 0,
    `${feeDikecualikan.data?.feeAmount}`);
  check('sebabnya disebutkan',
    String(feeDikecualikan.data?.message ?? '').includes('dikecualikan'));

  const kecualiGanda = await gagal(
    `INSERT INTO "${SCHEMA}".fee_contract_exclusion (contract_id, service_id, reason)
     VALUES ($1,$2,'Percobaan pengecualian ganda untuk naskah bukti.')`,
    [kontrak.data?.id, layananId],
  );
  check('pengecualian ganda atas layanan yang sama ditolak indeks unik',
    (kecualiGanda ?? '').includes('ux_fee_exclusion_service'), kecualiGanda ?? 'lolos');

  // --- 10. Pengakhiran ------------------------------------------------------
  log('');
  log('10. Kontrak yang sudah diakhiri tidak dihidupkan kembali');
  const akhiri = await api(
    `/health/fee-contract/${kontrak.data?.id}/terminate`,
    { method: 'POST', body: JSON.stringify({ reason: 'Kerja sama tidak dilanjutkan tahun depan.' }) },
    manajemen.token,
  );
  check('kontrak diakhiri', akhiri.data?.status === 'TERMINATED',
    `status ${akhiri.status} ${pesan(akhiri)}`);
  check('dan diberi tahu bahwa kontrak baru menuntut telaah hukum baru',
    String(akhiri.data?.note ?? '').includes('telaah hukum baru'));

  const setelahAkhir = await api(
    '/health/fee-contract/apply',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contractType: 'SYSTEM_PLATFORM_FEE',
        requestedPercent: 5, baseAmount: 10000000, onDate: HARI_INI,
      }),
    },
    penyusun.token,
  );
  check('sesudah diakhiri, fee-nya kembali NOL', setelahAkhir.data?.feeAmount === 0,
    `${setelahAkhir.data?.feeAmount}`);

  const hidupkanLagi = await api(
    `/health/fee-contract/${kontrak.data?.id}/activate`,
    { method: 'POST' },
    manajemen.token,
  );
  check('menghidupkannya kembali ditolak', hidupkanLagi.status === 409,
    `status ${hidupkanLagi.status}`);

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
    new URL('../../../docs/emedik/bukti-h9g-kontrak-fee.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
