/**
 * Bukti H-8: pertumbuhan anak, imunisasi, dan cakupan.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - menilai pertumbuhan tanpa tabel rujukan lalu menyebutnya normal;
 * - mencatat tinggi tanpa menyebut cara pengukurannya;
 * - memberikan vaksin sebelum umur minimum;
 * - memberikan vaksin sebelum jarak minimum dari dosis sebelumnya;
 * - mencatat dosis yang sama dua kali;
 * - kader membaca rekam medis pasien seluruh fasilitas;
 * - kader memberikan imunisasi;
 * - mengubah atau menghapus catatan pertumbuhan.
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

const RAWAT = { 'x-purpose-of-use': 'TREATMENT' };
const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_kom_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-8',FALSE) RETURNING id`,
      [`BUKTI_KOM_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-8 — PERTUMBUHAN ANAK, IMUNISASI, DAN CAKUPAN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const BACA = ['READ'];
  const kader = await buatPengguna(tenantId, 'kader', {
    HEALTH: BACA,
    HEALTH_FAMILY: BACA,
    HEALTH_GROWTH: ['READ', 'CREATE'],
    HEALTH_IMMUNIZATION: BACA,
    HEALTH_HOME_VISIT: ['READ', 'CREATE'],
  });
  const petugas = await buatPengguna(tenantId, 'petugas', {
    HEALTH: BACA,
    HEALTH_PATIENT: ['READ', 'CREATE'],
    HEALTH_FAMILY: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_GROWTH: ['READ', 'CREATE'],
    HEALTH_IMMUNIZATION: ['READ', 'CREATE', 'IMMUNIZE'],
    HEALTH_HOME_VISIT: ['READ', 'CREATE'],
    HEALTH_PROGRAM: ['READ', 'UPDATE'],
    HEALTH_FACILITY: BACA,
  });

  log('');
  log('Dua pengguna: kader dan petugas Puskesmas. Kader TIDAK diberi');
  log('HEALTH_PATIENT.READ dan TIDAK diberi HEALTH_IMMUNIZATION.CREATE —');
  log('keduanya justru pemisahan yang hendak dibuktikan naskah ini.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'Puskesmas Bukti','PUSKESMAS') RETURNING id`,
      [`BKPK-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'Puskesmas Bukti','Asia/Jakarta') RETURNING id`,
      [typeId, `PK-${tag}`],
    )
  )[0].id;

  // Anak laki-laki, umur 24 bulan tepat.
  const lahir = new Date(Date.now() - 24 * 30.4375 * 86_400_000).toISOString().slice(0, 10);
  const anak = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,$3,'MALE') RETURNING id`,
      [`Bayu Bukti Gizi ${tag}`, `EPI-KM-${randomBytes(4).toString('hex')}`, lahir],
    )
  )[0].id;

  const ibu = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,'1995-04-04','FEMALE') RETURNING id`,
      [`Ibu Bukti ${tag}`, `EPI-KM-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  // --- 1. Tanpa baris rujukan yang berlaku ---------------------------------
  //
  // Anak berumur 36 bulan, dan tabel rujukan naskah ini sengaja hanya memuat
  // baris umur 24 bulan. Inilah keadaan yang sesungguhnya terjadi di lapangan:
  // tabelnya ada, tetapi barisnya tidak menjangkau umur anak yang ditimbang.
  log('');
  log('1. Tanpa baris rujukan yang berlaku, hasilnya BELUM DAPAT DINILAI');
  const anakTua = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,$3,'MALE') RETURNING id`,
      [
        `Anak Tanpa Rujukan ${tag}`,
        `EPI-KM-${randomBytes(4).toString('hex')}`,
        new Date(Date.now() - 36 * 30.4375 * 86_400_000).toISOString().slice(0, 10),
      ],
    )
  )[0].id;

  const sebelumRujukan = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anakTua, facilityId, weightKg: 12.0, heightCm: 90.0,
        heightMeasuredAs: 'STANDING',
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('pengukuran tercatat', sebelumRujukan.status === 201,
    `status ${sebelumRujukan.status} ${pesan(sebelumRujukan)}`);
  check('tinggi menurut umur BELUM DAPAT DINILAI',
    sebelumRujukan.data?.heightForAge?.status === 'UNKNOWN',
    JSON.stringify(sebelumRujukan.data?.heightForAge?.status));
  check('dan pesannya berkata menyebutnya normal akan berbohong',
    String(sebelumRujukan.data?.heightForAge?.message ?? '').includes('berbohong'));
  check('penilaian yang tidak dapat dilakukan TIDAK menuntut tindakan',
    sebelumRujukan.data?.heightForAge?.actionable === false);

  // --- 2. Dengan tabel rujukan ---------------------------------------------
  log('');
  log('2. Dengan baris rujukan WHO yang berlaku bagi umurnya');
  // Baris rujukan WHO 2006 untuk umur 24 bulan.
  await q(
    `INSERT INTO "${SCHEMA}".growth_reference (indicator, sex, x_value, l_value, m_value, s_value)
     VALUES ('HEIGHT_FOR_AGE','MALE',24,1,87.1,0.0378),
            ('HEIGHT_FOR_AGE','FEMALE',24,1,85.7,0.0388),
            ('WEIGHT_FOR_AGE','MALE',24,-0.1733,12.15,0.1074),
            ('WEIGHT_FOR_HEIGHT','MALE',80,-0.3833,10.4,0.0846)
     ON CONFLICT DO NOTHING`,
  );

  const denganRujukan = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.0, heightCm: 80.0,
        heightMeasuredAs: 'STANDING',
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('kini dapat dinilai', denganRujukan.data?.heightForAge?.status !== 'UNKNOWN',
    JSON.stringify(denganRujukan.data?.heightForAge));
  /*
   * z = ((80/87,1) − 1) / 0,0378 = −2,16 — di antara −3 dan −2, yaitu STUNTED.
   * Naskah ini semula menuntut SEVERELY_STUNTED; yang keliru adalah harapannya,
   * bukan perhitungannya. Ambang WHO −3 adalah "sangat pendek".
   */
  check('anak 80 cm pada umur 24 bulan dinyatakan STUNTING',
    denganRujukan.data?.heightForAge?.status === 'STUNTED',
    denganRujukan.data?.heightForAge?.status);
  check('z-scorenya sekitar −2,2 sesuai rumus LMS',
    Math.abs((denganRujukan.data?.heightForAge?.z ?? 0) + 2.16) < 0.05,
    String(denganRujukan.data?.heightForAge?.z));
  check('pesannya menyebut keadaan MENAHUN, bukan akut',
    String(denganRujukan.data?.heightForAge?.message ?? '').includes('MENAHUN') ||
      String(denganRujukan.data?.heightForAge?.message ?? '').includes('Stunting berat'));
  check('z-score tersimpan, bukan dihitung ulang saat dibaca',
    typeof denganRujukan.data?.heightForAge?.z === 'number');

  const tersimpan = await q(
    `SELECT haz::float8 AS haz, haz_status, reference_source FROM "${SCHEMA}".growth_measurement
      WHERE id = $1`,
    [denganRujukan.data?.id],
  );
  check('sumber rujukannya ikut tersimpan', tersimpan[0].reference_source === 'WHO_2006',
    tersimpan[0].reference_source);

  // --- 3. Cara pengukuran tinggi -------------------------------------------
  log('');
  log('3. Cara pengukuran tinggi wajib disebutkan, dan dibetulkan bila keliru');
  const tanpaCara = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: anak, facilityId, weightKg: 9.1, heightCm: 80.5 }),
    },
    petugas.token,
    RAWAT,
  );
  check('tinggi tanpa cara pengukuran ditolak', tanpaCara.status === 422,
    `status ${tanpaCara.status}`);
  check('penolakannya menyebut selisih 0,7 cm', pesan(tanpaCara).includes('0,7'));

  const berbaring = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.1, heightCm: 80.7,
        heightMeasuredAs: 'RECUMBENT',
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('anak ≥ 24 bulan yang diukur berbaring dibetulkan',
    berbaring.data?.heightAdjusted === true);
  check('pembetulannya dilaporkan, bukan diam-diam',
    String(berbaring.data?.heightNote ?? '').includes('WHO'));

  const nilaiAsli = await q(
    `SELECT height_cm::float8 AS h, height_raw_cm::float8 AS raw FROM "${SCHEMA}".growth_measurement
      WHERE id = $1`,
    [berbaring.data?.id],
  );
  check('nilai asli dan nilai yang dibetulkan disimpan keduanya',
    nilaiAsli[0].raw === 80.7 && nilaiAsli[0].h === 80,
    JSON.stringify(nilaiAsli[0]));

  // --- 4. Berat tidak naik --------------------------------------------------
  log('');
  log('4. Berat badan tidak naik dua kali berturut-turut');
  await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.1, heightCm: 80.5, heightMeasuredAs: 'STANDING',
      }),
    },
    petugas.token,
    RAWAT,
  );
  const datar = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.0, heightCm: 80.6, heightMeasuredAs: 'STANDING',
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('berat yang tidak naik dua kali ditandai', datar.data?.weightFlat?.flat === true,
    JSON.stringify(datar.data?.weightFlat));
  check('penandanya menyebut ia tidak menuntut tabel rujukan',
    String(datar.data?.weightFlat?.message ?? '').includes('tanpa tabel rujukan'));

  let ubahPengukuran = false;
  try {
    await q(`UPDATE "${SCHEMA}".growth_measurement SET weight_kg = 12 WHERE id = $1`,
      [datar.data?.id]);
  } catch {
    ubahPengukuran = true;
  }
  check('catatan pertumbuhan tidak dapat diubah, ditegakkan basis data', ubahPengukuran);

  // --- 5. Imunisasi ---------------------------------------------------------
  log('');
  log('5. Imunisasi — yang terlalu cepat DITOLAK, bukan diperingatkan');
  const bayi = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,$3,'FEMALE') RETURNING id`,
      [
        `Bayi Bukti Imunisasi ${tag}`,
        `EPI-KM-${randomBytes(4).toString('hex')}`,
        new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10),
      ],
    )
  )[0].id;

  const terlaluCepat = await api(
    '/health/community/immunization',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: bayi, facilityId, vaccineCode: 'DPT-HB-Hib', doseNumber: 1,
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('vaksin sebelum umur minimum DITOLAK', terlaluCepat.status === 422,
    `status ${terlaluCepat.status}`);
  check('penolakannya menyebut bahwa ia akan tercatat sebagai diberikan',
    pesan(terlaluCepat).includes('tercatat sebagai diberikan'));
  check('dan menyebut tanggal paling awalnya',
    Boolean(terlaluCepat.body?.error?.details?.earliestDate ??
            terlaluCepat.body?.error?.earliestDate ??
            pesan(terlaluCepat).match(/\d{4}-\d{2}-\d{2}/)));

  const bcg = await api(
    '/health/community/immunization',
    { method: 'POST', body: JSON.stringify({ patientId: bayi, facilityId, vaccineCode: 'BCG', doseNumber: 1 }) },
    petugas.token,
    RAWAT,
  );
  check('BCG pada umur 40 hari diizinkan', bcg.status === 201,
    `status ${bcg.status} ${pesan(bcg)}`);

  const ulang = await api(
    '/health/community/immunization',
    { method: 'POST', body: JSON.stringify({ patientId: bayi, facilityId, vaccineCode: 'BCG', doseNumber: 1 }) },
    petugas.token,
    RAWAT,
  );
  check('dosis yang sama tidak dapat dicatat dua kali', ulang.status === 409,
    `status ${ulang.status}`);

  const melompat = await api(
    '/health/community/immunization',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: bayi, facilityId, vaccineCode: 'POLIO', doseNumber: 2 }),
    },
    petugas.token,
    RAWAT,
  );
  check('dosis yang melompat urutan ditolak', melompat.status === 422,
    `status ${melompat.status}`);

  const status = await api(
    `/health/community/immunization/${bayi}`,
    {},
    petugas.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('status imunisasi terbaca', status.status === 200, `status ${status.status}`);
  check('yang sudah diberikan tercatat', (status.data?.given ?? []).length === 1);
  check('yang tertunggak dilaporkan', (status.data?.overdue ?? []).length > 0,
    JSON.stringify((status.data?.overdue ?? []).map((x) => x.vaccineCode)));
  check('yang boleh hari ini dipisahkan tersendiri',
    Array.isArray(status.data?.dueToday) && status.data.dueToday.length > 0);

  let hapusImunisasi = false;
  try {
    await q(`DELETE FROM "${SCHEMA}".immunization_record WHERE patient_id = $1`, [bayi]);
  } catch {
    hapusImunisasi = true;
  }
  check('catatan imunisasi tidak dapat dihapus, ditegakkan basis data', hapusImunisasi);

  // --- 6. Pemisahan wewenang kader -----------------------------------------
  log('');
  log('6. Kader bukan petugas Puskesmas');
  const kaderImunisasi = await api(
    '/health/community/immunization',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: bayi, facilityId, vaccineCode: 'POLIO', doseNumber: 1 }),
    },
    kader.token,
    RAWAT,
  );
  check('kader TIDAK berwenang memberikan imunisasi', kaderImunisasi.status === 403,
    `status ${kaderImunisasi.status}`);

  const kaderCariPasien = await api(
    '/health/patients?q=bukti',
    {},
    kader.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('kader TIDAK berwenang mencari pasien seluruh fasilitas',
    kaderCariPasien.status === 403, `status ${kaderCariPasien.status}`);

  const kaderTimbang = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.2, heightCm: 80.8, heightMeasuredAs: 'STANDING',
      }),
    },
    kader.token,
    RAWAT,
  );
  check('kader TETAP dapat menimbang dan mencatat', kaderTimbang.status === 201,
    `status ${kaderTimbang.status} ${pesan(kaderTimbang)}`);

  // --- 7. Folder keluarga ---------------------------------------------------
  log('');
  log('7. Folder keluarga');
  const folder = await api(
    '/health/community/folders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, headPatientId: ibu, memberPatientIds: [anak],
        village: 'Desa Bukti', rt: '01', rw: '02', posyanduName: 'Melati',
      }),
    },
    petugas.token,
    RAWAT,
  );
  check('folder keluarga dibuat', folder.status === 201,
    `status ${folder.status} ${pesan(folder)}`);
  check('dua anggota terdaftar', folder.data?.memberCount === 2,
    JSON.stringify(folder.data));

  const folderKedua = await api(
    '/health/community/folders',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, memberPatientIds: [anak], village: 'Desa Lain' }),
    },
    petugas.token,
    RAWAT,
  );
  check('anak yang sudah terdaftar dilaporkan, TANPA menggagalkan folder barunya',
    folderKedua.status === 201 && (folderKedua.data?.alreadyInAnotherFolder ?? []).includes(anak),
    JSON.stringify(folderKedua.data));

  const isi = await api(
    `/health/community/folders/${folder.data?.id}`,
    {},
    kader.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('kader dapat melihat isi folder keluarganya', isi.status === 200,
    `status ${isi.status}`);
  check('keadaan gizi terakhir ikut ditampilkan',
    (isi.data?.members ?? []).some((m) => m.haz_status));

  // --- 8. Cakupan dan kunjungan rumah --------------------------------------
  log('');
  log('8. Cakupan program dan daftar kunjungan rumah');
  await q(
    `INSERT INTO "${SCHEMA}".community_program_target
       (facility_id, program_code, program_name, period_year, target_count, achieved_count)
     VALUES ($1,'IMUNISASI_DASAR','Imunisasi Dasar Lengkap',2026,100,82)`,
    [facilityId],
  );

  const cakupan = await api(
    `/health/community/coverage?facilityId=${facilityId}&year=2026`,
    {},
    petugas.token,
  );
  check('cakupan terbaca', cakupan.status === 200, `status ${cakupan.status}`);
  check('cakupan dihitung terhadap sasaran, bukan yang datang',
    (cakupan.data ?? [])[0]?.coverage === 82, JSON.stringify((cakupan.data ?? [])[0]?.coverage));
  check('kekurangannya disebutkan', (cakupan.data ?? [])[0]?.gap === 18);

  const kunjungan = await api(
    `/health/community/home-visits/worklist?facilityId=${facilityId}`,
    {},
    kader.token,
  );
  check('daftar kunjungan terbaca', kunjungan.status === 200, `status ${kunjungan.status}`);
  check('anak yang stunting masuk daftar',
    (kunjungan.data ?? []).some((r) => r.patient_id === anak),
    `${(kunjungan.data ?? []).length} baris`);

  const catatKunjungan = await api(
    '/health/community/home-visits',
    {
      method: 'POST',
      body: JSON.stringify({
        familyFolderId: folder.data?.id, facilityId, patientId: anak,
        reason: 'STUNTING',
        findings: 'Pola makan kurang beragam, sumber protein hewani jarang.',
        actionTaken: 'Penyuluhan gizi dan pemberian makanan tambahan.',
      }),
    },
    kader.token,
    RAWAT,
  );
  check('kunjungan rumah tercatat', catatKunjungan.status === 201,
    `status ${catatKunjungan.status} ${pesan(catatKunjungan)}`);

  // --- 9. Jejak -------------------------------------------------------------
  log('');
  log('9. Jejak dan tujuan penggunaan');
  const tanpaTujuan = await api(
    '/health/community/growth',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: anak, facilityId, weightKg: 9.3, heightCm: 81, heightMeasuredAs: 'STANDING',
      }),
    },
    petugas.token,
  );
  check('mencatat pertumbuhan tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [anak],
  );
  check('jejak pembacaan tercatat', jejak[0].n > 0, `${jejak[0].n} baris`);

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
    new URL('../../../docs/emedik/bukti-h8-puskesmas.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
