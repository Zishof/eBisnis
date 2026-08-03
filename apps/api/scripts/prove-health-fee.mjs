/**
 * Bukti H-9E: kebijakan pembagian jasa dan kontributor.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan di sini: **tidak ada satu pun persentase yang
 * tertanam di dalam kode maupun disemai migrasi.** Naskah ini memeriksanya
 * secara harfiah pada basis data.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - jumlah persentase melebihi seratus;
 * - penyusun kebijakan menyetujui versinya sendiri;
 * - penerima jasa menyetujui aturan yang membayar dirinya;
 * - fee sistem dan fee investor aktif tanpa kontrak;
 * - templat contoh dipakai di produksi;
 * - baris kebijakan yang sudah aktif diubah;
 * - jasa BPJS dihitung dari tagihan kotor;
 * - kontributor tanpa bukti kehadiran ikut dibayar.
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

async function buatPengguna(tenantId, nama, hakPerMenu, subjectIdKeluar = {}) {
  const username = `bukti_fee_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9E',FALSE) RETURNING id`,
      [`BUKTI_FEE_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  Object.assign(subjectIdKeluar, { subjectId });
  return { token, subjectId, username };
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-9E — KEBIJAKAN PEMBAGIAN JASA DAN KONTRIBUTOR');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const penyusun = await buatPengguna(tenantId, 'penyusun', {
    HEALTH: ['READ'],
    HEALTH_FEE_POLICY: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_FEE_CONTRIBUTOR: ['READ', 'CREATE', 'UPDATE'],
  });
  const penyetuju = await buatPengguna(tenantId, 'penyetuju', {
    HEALTH: ['READ'],
    HEALTH_FEE_POLICY: ['READ', 'APPROVE', 'ACTIVATE'],
    HEALTH_FEE_CONTRIBUTOR: ['READ'],
  });
  // Penyetuju yang juga dokter — inti dari pemisahan ketiga.
  const dokterPenyetuju = await buatPengguna(tenantId, 'dokterapprover', {
    HEALTH: ['READ'],
    HEALTH_FEE_POLICY: ['READ', 'APPROVE', 'ACTIVATE'],
  });

  log('');
  log('Tiga pengguna. Yang ketiga penyetuju yang JUGA dokter — dan justru dialah');
  log('yang membuktikan pemisahan yang paling sulit dilihat: penerima jasa tidak');
  log('menyetujui aturan yang membayar dirinya.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Jasa','HOSPITAL') RETURNING id`,
      [`BKFE-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Jasa','Asia/Jakarta') RETURNING id`,
      [typeId, `FE-${tag}`],
    )
  )[0].id;

  const bedahId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type, user_subject_id)
       VALUES ($1,'dr. Bedah Bukti','DOCTOR',$2) RETURNING id`,
      [`DRBD-${tag}`, dokterPenyetuju.subjectId],
    )
  )[0].id;
  const anestesiId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type)
       VALUES ($1,'dr. Anestesi Bukti','DOCTOR') RETURNING id`,
      [`DRAN-${tag}`],
    )
  )[0].id;
  const perawatId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type)
       VALUES ($1,'Perawat Instrumen Bukti','NURSE') RETURNING id`,
      [`PRIN-${tag}`],
    )
  )[0].id;

  // --- 1. Tidak ada persentase bawaan --------------------------------------
  log('');
  log('1. TIDAK ADA SATU PUN PERSENTASE BAWAAN');
  /*
   * Diukur pada baris yang TIDAK dibuat pengguna mana pun. Migrasi tidak
   * mengisi created_by; setiap kebijakan yang lahir dari migrasi akan terlihat
   * di sini. Menghitung seluruh tabel akan ikut menghitung kebijakan yang
   * dibuat naskah ini sendiri pada jalannya yang sebelumnya.
   */
  const kebijakanBawaan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_policy WHERE created_by IS NULL`,
  );
  check('migrasi tidak menyemai satu pun kebijakan', kebijakanBawaan[0].n === 0,
    `${kebijakanBawaan[0].n} kebijakan`);

  const barisBawaan = await q(
    `SELECT count(*)::int AS n
       FROM "${SCHEMA}".fee_policy_line l
       JOIN "${SCHEMA}".fee_policy p ON p.id = l.policy_id
      WHERE p.created_by IS NULL`,
  );
  check('dan tidak satu pun baris persentase bawaan', barisBawaan[0].n === 0,
    `${barisBawaan[0].n} baris`);

  const aktifBawaan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_policy
      WHERE created_by IS NULL AND active = TRUE`,
  );
  check('sehingga tidak ada persentase apa pun yang berlaku tanpa pernah disepakati',
    aktifBawaan[0].n === 0, `${aktifBawaan[0].n} kebijakan aktif`);

  // --- 2. Menyusun kebijakan ------------------------------------------------
  log('');
  log('2. Bentuk kebijakan diperiksa; besarnya tidak');
  const lebihSeratus = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `LEBIH-${tag.toUpperCase()}`, name: 'Melebihi Seratus',
        lines: [
          { recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 60 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 60 },
        ],
      }),
    },
    penyusun.token,
  );
  check('jumlah persentase melebihi 100 DITOLAK', lebihSeratus.status === 422,
    `status ${lebihSeratus.status}`);
  check('penolakannya menyebut uang yang tidak dimilikinya',
    pesan(lebihSeratus).includes('tidak dimilikinya'));

  const kurangSeratus = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `KURANG-${tag.toUpperCase()}`, name: 'Kurang dari Seratus',
        lines: [{ recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 40 }],
      }),
    },
    penyusun.token,
  );
  check('jumlah persentase KURANG dari 100 tetap diterima', kurangSeratus.status === 201,
    `status ${kurangSeratus.status} ${pesan(kurangSeratus)}`);

  const kebijakan = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `BEDAH-${tag.toUpperCase()}`, name: 'Pembagian Jasa Operasi',
        basis: 'PAID_CLAIM',
        lines: [
          { recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 35, providerId: bedahId },
          { recipient: 'ANESTHESIA_FEE', method: 'PERCENTAGE', value: 15, providerId: anestesiId },
          { recipient: 'NURSE_FEE', method: 'PERCENTAGE', value: 10 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 40 },
        ],
      }),
    },
    penyusun.token,
  );
  check('kebijakan yang sah dibuat', kebijakan.status === 201,
    `status ${kebijakan.status} ${pesan(kebijakan)}`);
  check('dan dibuat dalam keadaan TIDAK aktif', kebijakan.data?.active === false);
  check('catatannya menyatakan ini kesepakatan dua pihak',
    String(kebijakan.data?.note ?? '').includes('kesepakatan dua pihak'));

  const tembusLebihSeratus = await gagal(
    `INSERT INTO "${SCHEMA}".fee_policy_line (policy_id, recipient, method, value)
     VALUES ($1,'OTHER_FEE','PERCENTAGE',50)`,
    [kebijakan.data?.id],
  );
  check('menembus batas 100 persen lewat basis data ditolak trigger',
    (tembusLebihSeratus ?? '').includes('FEE_POLICY_OVER_100'), tembusLebihSeratus ?? 'lolos');

  // --- 3. Persetujuan -------------------------------------------------------
  log('');
  log('3. Penyusun tidak menyetujui, dan penerima tidak menyetujui yang membayarnya');
  const setujuSendiri = await api(
    `/health/fee/policies/${kebijakan.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Sudah saya periksa sendiri, aman.' }) },
    penyusun.token,
  );
  check('penyusun tidak berwenang menyetujui', setujuSendiri.status === 403,
    `status ${setujuSendiri.status}`);

  const dokterMenyetujui = await api(
    `/health/fee/policies/${kebijakan.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Disepakati bersama komite medis pada rapat kemarin.' }),
    },
    dokterPenyetuju.token,
  );
  check('penyetuju yang JUGA penerima pada kebijakan ini DITOLAK',
    dokterMenyetujui.status === 403, `status ${dokterMenyetujui.status}`);
  check('penolakannya menyebut dua bulan berturut-turut',
    pesan(dokterMenyetujui).includes('dua bulan berturut-turut'));

  const setuju = await api(
    `/health/fee/policies/${kebijakan.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Disepakati bersama komite medis; notulen nomor 12/2026.' }),
    },
    penyetuju.token,
  );
  check('penyetuju yang bukan penerima mengaktifkannya',
    setuju.status === 200 || setuju.status === 201, `status ${setuju.status} ${pesan(setuju)}`);

  const tembusSetujuSendiri = await gagal(
    `UPDATE "${SCHEMA}".fee_policy SET approved_by = created_by WHERE id = $1`,
    [kurangSeratus.data?.id],
  );
  check('menembus persetujuan sendiri lewat basis data ditolak constraint',
    (tembusSetujuSendiri ?? '').includes('fee_policy_approval_not_self'),
    tembusSetujuSendiri ?? 'lolos');

  // --- 4. Kebijakan aktif tidak dapat diubah --------------------------------
  log('');
  log('4. Baris kebijakan yang sudah aktif tidak dapat diubah');
  const ubahAktif = await gagal(
    `UPDATE "${SCHEMA}".fee_policy_line SET value = 90 WHERE policy_id = $1`,
    [kebijakan.data?.id],
  );
  check('mengubahnya ditolak trigger',
    (ubahAktif ?? '').includes('FEE_POLICY_ACTIVE'), ubahAktif ?? 'lolos');
  check('penolakannya menyuruh membuat versi baru',
    (ubahAktif ?? '').includes('buat versi baru'));

  const hapusAktif = await gagal(
    `DELETE FROM "${SCHEMA}".fee_policy_line WHERE policy_id = $1`,
    [kebijakan.data?.id],
  );
  check('menghapusnya pun ditolak',
    (hapusAktif ?? '').includes('FEE_POLICY_ACTIVE'), hapusAktif ?? 'lolos');

  // --- 5. Fee sistem dan investor -------------------------------------------
  log('');
  log('5. Fee sistem dan fee investor bawaannya NONE');
  const feeSistem = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `SISTEM-${tag.toUpperCase()}`, name: 'Dengan Fee Sistem',
        lines: [
          { recipient: 'SYSTEM_PLATFORM_FEE', method: 'PERCENTAGE', value: 5 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 95 },
        ],
      }),
    },
    penyusun.token,
  );
  check('kebijakan berfee sistem boleh DISUSUN', feeSistem.status === 201,
    `status ${feeSistem.status}`);

  const aktifkanFeeSistem = await api(
    `/health/fee/policies/${feeSistem.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Diperiksa dan hendak diaktifkan.' }) },
    penyetuju.token,
  );
  check('tetapi TIDAK dapat diaktifkan tanpa kontrak', aktifkanFeeSistem.status === 422,
    `status ${aktifkanFeeSistem.status}`);
  const enamSyarat = ['kontrak', 'telaah hukum', 'persetujuan manajemen', 'perlakuan pajak',
    'tanggal berlaku', 'batas maksimum'];
  check('penolakannya menyebut keenam syaratnya satu per satu',
    enamSyarat.every((k) => pesan(aktifkanFeeSistem).includes(k)),
    pesan(aktifkanFeeSistem));
  check('dan menyebut bahwa fee itu mengambil dari kumpulan jasa tenaga medis',
    pesan(aktifkanFeeSistem).includes('jasa tenaga medis'));

  const feeInvestor = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `INVESTOR-${tag.toUpperCase()}`, name: 'Dengan Bagian Investor',
        lines: [
          { recipient: 'INVESTOR_SHARE', method: 'PERCENTAGE', value: 10 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 90 },
        ],
      }),
    },
    penyusun.token,
  );
  const aktifkanInvestor = await api(
    `/health/fee/policies/${feeInvestor.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Diperiksa dan hendak diaktifkan.' }) },
    penyetuju.token,
  );
  check('bagian investor pun tidak dapat diaktifkan tanpa kontrak',
    aktifkanInvestor.status === 422, `status ${aktifkanInvestor.status}`);

  const feeSistemAktif = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".fee_policy p
       JOIN "${SCHEMA}".fee_policy_line l ON l.policy_id = p.id
      WHERE p.active = TRUE AND l.recipient IN ('SYSTEM_PLATFORM_FEE','INVESTOR_SHARE')`,
  );
  check('tidak satu pun fee sistem atau investor yang aktif di seluruh tenant',
    feeSistemAktif[0].n === 0, `${feeSistemAktif[0].n} baris`);

  // --- 6. Templat contoh ----------------------------------------------------
  log('');
  log('6. Templat contoh bukan standar nasional dan bukan saran hukum');
  const templat = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `CONTOH-${tag.toUpperCase()}`, name: 'Templat Contoh',
        isSampleData: true,
        lines: [
          { recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 40 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 60 },
        ],
      }),
    },
    penyusun.token,
  );
  const aktifkanTemplat = await api(
    `/health/fee/policies/${templat.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Templatnya kelihatan wajar, pakai saja.' }) },
    penyetuju.token,
  );
  check('templat contoh tidak dapat diaktifkan sebelum disetujui produksi',
    aktifkanTemplat.status === 422, `status ${aktifkanTemplat.status}`);
  check('penolakannya menyatakan ia bukan saran hukum',
    pesan(aktifkanTemplat).includes('bukan saran hukum'));
  check('dan menyatakan persentase produksi ditentukan fasilitas bersama tenaga medisnya',
    pesan(aktifkanTemplat).includes('bersama'));

  const tembusTemplat = await gagal(
    `UPDATE "${SCHEMA}".fee_policy
        SET active = TRUE, approved_by = $2, approved_at = now() WHERE id = $1`,
    [templat.data?.id, penyetuju.subjectId],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusTemplat ?? '').includes('fee_policy_sample_not_production'), tembusTemplat ?? 'lolos');

  // --- 7. Dasar perhitungan -------------------------------------------------
  log('');
  log('7. Jasa BPJS dihitung dari klaim yang DIBAYAR');
  const kotor = await api(
    '/health/fee/policies',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `KOTOR-${tag.toUpperCase()}`, name: 'Berdasar Tagihan Kotor',
        basis: 'GROSS_CHARGE',
        lines: [
          { recipient: 'DOCTOR_FEE', method: 'PERCENTAGE', value: 40 },
          { recipient: 'FACILITY_FEE', method: 'PERCENTAGE', value: 60 },
        ],
      }),
    },
    penyusun.token,
  );
  await api(
    `/health/fee/policies/${kotor.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Untuk pasien tunai; disepakati.' }) },
    penyetuju.token,
  );

  const finalKotor = await api(
    '/health/fee/calculate',
    {
      method: 'POST',
      body: JSON.stringify({
        policyId: kotor.data?.id, basisAmount: 10000000, payerPaysByClaim: true,
      }),
    },
    penyusun.token,
  );
  check('perhitungan final dari tagihan kotor pada penjamin klaim DITOLAK',
    finalKotor.status === 422, `status ${finalKotor.status}`);
  check('penolakannya menyebut uang yang tidak pernah diterimanya',
    pesan(finalKotor).includes('tidak pernah diterimanya'));

  const simulasiKotor = await api(
    '/health/fee/calculate',
    {
      method: 'POST',
      body: JSON.stringify({
        policyId: kotor.data?.id, basisAmount: 10000000,
        payerPaysByClaim: true, isSimulation: true,
      }),
    },
    penyusun.token,
  );
  check('tetapi SIMULASI dengan dasar yang sama diizinkan',
    simulasiKotor.status === 200 || simulasiKotor.status === 201,
    `status ${simulasiKotor.status} ${pesan(simulasiKotor)}`);

  const hitungBenar = await api(
    '/health/fee/calculate',
    {
      method: 'POST',
      body: JSON.stringify({
        policyId: kebijakan.data?.id, basisAmount: 7000000, payerPaysByClaim: true,
      }),
    },
    penyusun.token,
  );
  check('perhitungan dengan dasar PAID_CLAIM berjalan',
    hitungBenar.status === 200 || hitungBenar.status === 201,
    `status ${hitungBenar.status} ${pesan(hitungBenar)}`);
  check('dan membagi habis tanpa sisa', hitungBenar.data?.remainder === 0,
    `sisa ${hitungBenar.data?.remainder}`);
  check('versi kebijakan DISALIN ke hasilnya',
    typeof hitungBenar.data?.policyVersion === 'number');

  const belumAktif = await api(
    '/health/fee/calculate',
    { method: 'POST', body: JSON.stringify({ policyId: templat.data?.id, basisAmount: 1000000 }) },
    penyusun.token,
  );
  check('kebijakan yang belum aktif tidak dipakai untuk perhitungan final',
    belumAktif.status === 422, `status ${belumAktif.status}`);

  // --- 8. Kontributor -------------------------------------------------------
  log('');
  log('8. Jasa dibayarkan kepada yang benar-benar hadir');
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Andi Bukti Jasa','1988-08-08','MALE') RETURNING id`,
      [`EPI-FE-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;
  const theatreId = (
    await q(
      `INSERT INTO "${SCHEMA}".ot_theatre (facility_id, code, name)
       VALUES ($1,$2,'OK Bukti') RETURNING id`,
      [facilityId, `OK-${tag}`],
    )
  )[0].id;
  const caseId = (
    await q(
      `INSERT INTO "${SCHEMA}".ot_case
         (facility_id, patient_id, theatre_id, case_number, procedure_name, surgeon_id,
          anaesthetist_id, status)
       VALUES ($1,$2,$3,$4,'Apendektomi',$5,$6,'SCHEDULED') RETURNING id`,
      [facilityId, pasien, theatreId, `OTC-${tag}`, bedahId, anestesiId],
    )
  )[0].id;

  const hadir = await api(
    '/health/fee/contributors',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, otCaseId: caseId, providerId: bedahId, contributorRole: 'SURGEON',
        attendanceEvidence: 'ot_case.surgeon_id', point: 5, clinicalResponsibility: 'PRIMARY',
      }),
    },
    penyusun.token,
  );
  check('kontributor dengan bukti kehadiran dicatat', hadir.status === 201,
    `status ${hadir.status} ${pesan(hadir)}`);
  check('dan ditandai memiliki bukti', hadir.data?.hasEvidence === true);

  await api(
    '/health/fee/contributors',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, otCaseId: caseId, providerId: anestesiId, contributorRole: 'ANAESTHETIST',
        attendanceEvidence: 'ot_case.anaesthetist_id', point: 3,
      }),
    },
    penyusun.token,
  );

  const tanpaBukti = await api(
    '/health/fee/contributors',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, otCaseId: caseId, providerId: perawatId, contributorRole: 'SCRUB_NURSE',
        point: 2,
      }),
    },
    penyusun.token,
  );
  check('kontributor TANPA bukti tetap dicatat', tanpaBukti.status === 201,
    `status ${tanpaBukti.status}`);
  check('tetapi ditandai belum memiliki bukti', tanpaBukti.data?.hasEvidence === false);
  check('dan diberi tahu bahwa ia tidak akan ikut dibayar',
    String(tanpaBukti.data?.note ?? '').includes('tidak akan ikut dibayar'));

  const daftar = await api(`/health/fee/contributors?otCaseId=${caseId}`, {}, penyusun.token);
  check('yang layak dan yang tersaring dipisahkan',
    (daftar.data?.eligible ?? []).length === 2 && (daftar.data?.rejected ?? []).length === 1,
    `${(daftar.data?.eligible ?? []).length} layak, ${(daftar.data?.rejected ?? []).length} tersaring`);
  check('yang tersaring disebut namanya, bukan dihilangkan',
    (daftar.data?.rejected ?? [])[0]?.contributor?.providerName?.includes('Perawat'));
  check('dan alasannya menyebut daftar keinginan',
    String((daftar.data?.rejected ?? [])[0]?.reason ?? '').includes('daftar keinginan'));

  const bagi = await api(
    '/health/fee/distribute',
    {
      method: 'POST',
      body: JSON.stringify({ otCaseId: caseId, poolAmount: 800000, method: 'POINT_BASED' }),
    },
    penyusun.token,
  );
  check('kumpulan dibagi menurut bobot', (bagi.data?.shares ?? []).length === 2,
    JSON.stringify((bagi.data?.shares ?? []).map((s) => s.amount)));
  check('yang tidak hadir TIDAK menerima apa pun',
    !(bagi.data?.shares ?? []).some((s) => s.providerId === perawatId));
  check('seluruh kumpulan terbagi habis',
    (bagi.data?.shares ?? []).reduce((n, s) => n + s.amount, 0) === 800000,
    JSON.stringify((bagi.data?.shares ?? []).map((s) => s.amount)));
  check('bedah dengan bobot 5 menerima lebih besar daripada anestesi dengan bobot 3',
    (bagi.data?.shares ?? []).find((s) => s.providerId === bedahId)?.amount === 500000,
    JSON.stringify(bagi.data?.shares));
  check('jumlah yang dikecualikan disebutkan', bagi.data?.excluded === 1);

  const kontributorGanda = await gagal(
    `INSERT INTO "${SCHEMA}".fee_contributor
       (facility_id, ot_case_id, provider_id, contributor_role)
     VALUES ($1,$2,$3,'SURGEON')`,
    [facilityId, caseId, bedahId],
  );
  check('satu pemberi layanan tidak dapat tercatat dua kali dengan peran yang sama',
    (kontributorGanda ?? '').includes('ux_fee_contributor_case_role'), kontributorGanda ?? 'lolos');

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
    new URL('../../../docs/emedik/bukti-h9e-jasa.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
