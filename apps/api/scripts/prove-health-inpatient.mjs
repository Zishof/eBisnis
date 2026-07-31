/**
 * Bukti H-6: satu tempat tidur, satu pasien.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - menempatkan pasien kedua di tempat tidur yang sudah terisi;
 * - menempatkan pasien di tempat tidur yang belum dibersihkan;
 * - menempatkan pasien isolasi di kamar yang tidak mampu menampungnya;
 * - mencampur jenis kelamin di kamar bersama;
 * - menerima pasien yang masih dirawat di tempat lain;
 * - memulangkan pasien yang nilai kritisnya belum diterima siapa pun;
 * - memulangkan tanpa ringkasan pulang;
 * - pulang paksa tanpa keterangan;
 * - menyatakan tempat tidur kosong tanpa melewati pembersihan.
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
  const username = `bukti_inap_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-6',FALSE) RETURNING id`,
      [`BUKTI_INAP_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-6 — SATU TEMPAT TIDUR, SATU PASIEN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const BACA = ['READ'];
  const dokter = await buatPengguna(tenantId, 'dokter', {
    HEALTH: BACA,
    HEALTH_PATIENT: ['READ', 'CREATE'],
    HEALTH_ADMISSION: ['READ', 'ADMIT', 'DISCHARGE', 'UPDATE'],
    HEALTH_NURSING: BACA,
    HEALTH_BED: BACA,
    HEALTH_FACILITY: BACA,
  });
  const perawat = await buatPengguna(tenantId, 'perawat', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_ADMISSION: ['READ', 'UPDATE'],
    HEALTH_NURSING: ['READ', 'CREATE'],
    HEALTH_BED: ['READ', 'UPDATE'],
  });

  log('');
  log('Dua pengguna: dokter dan perawat. Perawat TIDAK diberi hak ADMIT maupun');
  log('DISCHARGE — memutuskan pasien dirawat dan boleh pulang adalah keputusan');
  log('klinis, bukan penutupan berkas.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category, supports_inpatient)
       VALUES ($1,'RS Bukti Inap','HOSPITAL',TRUE) RETURNING id`,
      [`BKIN-${tag}`],
    ).catch(async () =>
      q(
        `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
         VALUES ($1,'RS Bukti Inap','HOSPITAL') RETURNING id`,
        [`BKIN-${tag}`],
      ),
    )
  )[0].id;

  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Inap','Asia/Jakarta') RETURNING id`,
      [typeId, `IN-${tag}`],
    )
  )[0].id;

  const unitId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service_unit (facility_id, unit_type, code, name)
       VALUES ($1,'WARD',$2,'Bangsal Bukti') RETURNING id`,
      [facilityId, `WD-${tag}`],
    )
  )[0].id;

  // Tiga kamar: bersama, isolasi kontak, dan satu tempat tidur.
  const kamarBersama = (
    await q(
      `INSERT INTO "${SCHEMA}".health_room
         (service_unit_id, code, name, care_class, capacity, isolation_capability)
       VALUES ($1,$2,'Kamar Bersama','KELAS_2',2,ARRAY['NONE']::VARCHAR(24)[]) RETURNING id`,
      [unitId, `KB-${tag}`],
    )
  )[0].id;
  const kamarIsolasi = (
    await q(
      `INSERT INTO "${SCHEMA}".health_room
         (service_unit_id, code, name, care_class, capacity, isolation_capability)
       VALUES ($1,$2,'Kamar Isolasi','KELAS_2',1,ARRAY['CONTACT','AIRBORNE']::VARCHAR(24)[])
       RETURNING id`,
      [unitId, `KI-${tag}`],
    )
  )[0].id;

  const tt = async (roomId, code, kelas = 'KELAS_2') =>
    (
      await q(
        `INSERT INTO "${SCHEMA}".health_bed (room_id, code, bed_status, care_class)
         VALUES ($1,$2,'AVAILABLE',$3) RETURNING id`,
        [roomId, code, kelas],
      )
    )[0].id;

  const ttA = await tt(kamarBersama, `TT-A-${tag}`);
  const ttB = await tt(kamarBersama, `TT-B-${tag}`);
  const ttIso = await tt(kamarIsolasi, `TT-ISO-${tag}`);

  const pasien = async (nama, gender) =>
    (
      await q(
        `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
         VALUES ($2,$1,'1975-05-05',$3) RETURNING id`,
        [`${nama} ${tag}`, `EPI-IN-${randomBytes(4).toString('hex')}`, gender],
      )
    )[0].id;

  const budi = await pasien('Budi Bukti Inap', 'MALE');
  const bagus = await pasien('Bagus Bukti Inap', 'MALE');
  const sari = await pasien('Sari Bukti Inap', 'FEMALE');

  log('');
  log('Kamar bersama berkapasitas dua, kamar isolasi berkapasitas satu.');

  // --- 1. Penerimaan -------------------------------------------------------
  log('');
  log('1. Penerimaan dan penempatan tempat tidur');
  const terimaBudi = await api(
    '/health/inpatient/admissions',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: budi, facilityId, bedId: ttA, classCode: 'KELAS_2',
        admissionReason: 'Demam berkepanjangan.',
      }),
    },
    dokter.token,
    RAWAT,
  );
  check('pasien pertama diterima', terimaBudi.status === 201,
    `status ${terimaBudi.status} ${pesan(terimaBudi)}`);
  check('penempatan tempat tidurnya ikut dilaporkan', Boolean(terimaBudi.data?.bedCode));

  const perawatMenerima = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: bagus, facilityId }) },
    perawat.token,
    RAWAT,
  );
  check('perawat TIDAK berwenang menerima pasien rawat inap', perawatMenerima.status === 403,
    `status ${perawatMenerima.status}`);

  // --- 2. Satu tempat tidur, satu pasien -----------------------------------
  log('');
  log('2. Satu tempat tidur, satu pasien');
  const tumpuk = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: bagus, facilityId, bedId: ttA }) },
    dokter.token,
    RAWAT,
  );
  check('menempatkan pasien kedua di tempat tidur yang sama DITOLAK', tumpuk.status === 422,
    `status ${tumpuk.status}`);
  check('penolakannya menyebut tempat tidurnya sedang ditempati',
    pesan(tumpuk).toLowerCase().includes('ditempati'));

  const langsung = await q(
    `INSERT INTO "${SCHEMA}".health_bed_assignment (admission_id, bed_id, patient_id)
     SELECT $1::uuid, $2::uuid, $3::uuid RETURNING id`,
    [terimaBudi.data?.id, ttA, bagus],
  ).then(() => false).catch(() => true);
  check('menembus lewat jalur basis data pun ditolak indeks unik parsial', langsung);

  const dobelRawat = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: budi, facilityId, bedId: ttB }) },
    dokter.token,
    RAWAT,
  );
  check('pasien yang masih dirawat tidak dapat diterima lagi', dobelRawat.status === 409,
    `status ${dobelRawat.status}`);

  // --- 3. Jenis kelamin dan isolasi ----------------------------------------
  log('');
  log('3. Kamar bersama: jenis kelamin dan isolasi');
  const campurKelamin = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: sari, facilityId, bedId: ttB }) },
    dokter.token,
    RAWAT,
  );
  check('kamar bersama berpenghuni laki-laki menolak pasien perempuan',
    campurKelamin.status === 422, `status ${campurKelamin.status}`);

  const isolasiSalahKamar = await api(
    '/health/inpatient/admissions',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: sari, facilityId, bedId: ttB, isolationType: 'CONTACT' }),
    },
    dokter.token,
    RAWAT,
  );
  check('kamar tanpa kemampuan isolasi menolak pasien yang membutuhkannya',
    isolasiSalahKamar.status === 422, `status ${isolasiSalahKamar.status}`);
  check('penolakannya menyebut isolasi, bukan jenis kelamin',
    pesan(isolasiSalahKamar).toLowerCase().includes('isolasi'));

  const isolasiBenar = await api(
    '/health/inpatient/admissions',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: sari, facilityId, bedId: ttIso, isolationType: 'CONTACT' }),
    },
    dokter.token,
    RAWAT,
  );
  check('kamar isolasi yang sesuai menerimanya', isolasiBenar.status === 201,
    `status ${isolasiBenar.status} ${pesan(isolasiBenar)}`);

  // --- 4. Pengamatan keperawatan -------------------------------------------
  log('');
  log('4. Pengamatan keperawatan dan skor peringatan dini');
  const amatiNormal = await api(
    '/health/inpatient/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        admissionId: terimaBudi.data?.id, respiratoryRate: 16, spo2: 98,
        systolicBp: 120, heartRate: 72, temperature: 36.8, consciousness: 'ALERT',
      }),
    },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pengamatan tercatat', amatiNormal.status === 201,
    `status ${amatiNormal.status} ${pesan(amatiNormal)}`);
  check('tanda vital normal berisiko rendah', amatiNormal.data?.risk === 'LOW');
  check('jarak pengamatan berikutnya empat jam', amatiNormal.data?.observationMinutes === 240);

  const amatiBuruk = await api(
    '/health/inpatient/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        admissionId: terimaBudi.data?.id, respiratoryRate: 26, spo2: 90,
        systolicBp: 88, heartRate: 125, temperature: 38.5, consciousness: 'VOICE',
      }),
    },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pasien memburuk berisiko tinggi', amatiBuruk.data?.risk === 'HIGH',
    JSON.stringify(amatiBuruk.data));
  check('dan jarak pengamatannya dipersingkat menjadi tiga puluh menit',
    amatiBuruk.data?.observationMinutes === 30);

  const amatiKurang = await api(
    '/health/inpatient/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        admissionId: terimaBudi.data?.id, respiratoryRate: 16, heartRate: 72,
        consciousness: 'ALERT',
      }),
    },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('tanda vital yang tidak diukur DILAPORKAN, bukan dianggap normal',
    (amatiKurang.data?.missing ?? []).length === 3,
    JSON.stringify(amatiKurang.data?.missing));

  const ubahPengamatan = await q(
    `UPDATE "${SCHEMA}".health_nursing_observation SET spo2 = 99 WHERE id = $1`,
    [amatiNormal.data?.id],
  ).then(() => false).catch(() => true);
  check('pengamatan tidak dapat diubah, ditegakkan basis data', ubahPengamatan);

  // --- 5. Pemulangan -------------------------------------------------------
  log('');
  log('5. Pemulangan');
  const tanpaRingkasan = await api(
    `/health/inpatient/admissions/${terimaBudi.data?.id}/discharge`,
    { method: 'POST', body: JSON.stringify({ disposition: 'ROUTINE' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('memulangkan tanpa ringkasan pulang ditolak', tanpaRingkasan.status === 422,
    `status ${tanpaRingkasan.status}`);
  check('penolakannya menyebut ringkasan pulang',
    pesan(tanpaRingkasan).toLowerCase().includes('ringkasan'));

  const ringkasan = await api(
    `/health/inpatient/admissions/${terimaBudi.data?.id}/summary`,
    {
      method: 'POST',
      body: JSON.stringify({
        dischargeDiagnosis: 'Demam tifoid, membaik.',
        followUpPlan: 'Kontrol poliklinik penyakit dalam satu minggu.',
        warningSigns: 'Kembali bila demam di atas 39 derajat atau muntah terus-menerus.',
      }),
    },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('ringkasan pulang tersimpan', ringkasan.status === 201 || ringkasan.status === 200,
    `status ${ringkasan.status} ${pesan(ringkasan)}`);

  // Nilai kritis yang belum diterima siapa pun.
  const testId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_test_catalog
         (code, name, department, result_type, unit, specimen_type)
       VALUES ($1,'Kalium Bukti Inap','LAB','NUMERIC','mmol/L','SERUM') RETURNING id`,
      [`KIN-${tag}`],
    )
  )[0].id;
  const orderId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_order (order_number, patient_id, facility_id)
       VALUES ($1,$2,$3) RETURNING id`,
      [`LABIN-${tag}`, budi, facilityId],
    )
  )[0].id;
  const itemId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_order_item (order_id, test_id, line_no)
       VALUES ($1,$2,1) RETURNING id`,
      [orderId, testId],
    )
  )[0].id;
  const resultId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_result
         (order_id, order_item_id, patient_id, test_id, value_numeric, flag, is_critical, status)
       VALUES ($1,$2,$3,$4,7.4,'CRITICAL_HIGH',TRUE,'RESULTED') RETURNING id`,
      [orderId, itemId, budi, testId],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".lab_critical_notification (result_id, patient_id)
     VALUES ($1,$2)`,
    [resultId, budi],
  );

  const adaKritis = await api(
    `/health/inpatient/admissions/${terimaBudi.data?.id}/discharge`,
    { method: 'POST', body: JSON.stringify({ disposition: 'ROUTINE' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('NILAI KRITIS yang belum diterima menahan pemulangan', adaKritis.status === 422,
    `status ${adaKritis.status}`);
  check('penolakannya menyebut nilai kritis', pesan(adaKritis).toLowerCase().includes('kritis'));

  await q(
    `UPDATE "${SCHEMA}".lab_critical_notification
        SET acknowledged_at = now(), acknowledged_by = $2, read_back_value = '7.4'
      WHERE result_id = $1`,
    [resultId, dokter.subjectId],
  );

  const pulang = await api(
    `/health/inpatient/admissions/${terimaBudi.data?.id}/discharge`,
    { method: 'POST', body: JSON.stringify({ disposition: 'ROUTINE' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('setelah nilai kritisnya diterima, pemulangan berhasil',
    pulang.status === 200 || pulang.status === 201,
    `status ${pulang.status} ${pesan(pulang)}`);
  check('lama rawat dihitung dan disimpan', (pulang.data?.lengthOfStay ?? 0) >= 1,
    String(pulang.data?.lengthOfStay));

  // --- 6. Pembersihan tempat tidur -----------------------------------------
  log('');
  log('6. Tempat tidur yang baru ditinggalkan bukan tempat tidur yang kosong');
  const statusTT = await q(
    `SELECT bed_status FROM "${SCHEMA}".health_bed WHERE id = $1`,
    [ttA],
  );
  check('tempat tidur menjadi MENUNGGU PEMBERSIHAN, bukan langsung kosong',
    statusTT[0].bed_status === 'CLEANING', statusTT[0].bed_status);

  const tempatiKotor = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: bagus, facilityId, bedId: ttA }) },
    dokter.token,
    RAWAT,
  );
  check('menempatkan pasien di tempat tidur yang belum dibersihkan DITOLAK',
    tempatiKotor.status === 422, `status ${tempatiKotor.status}`);
  check('penolakannya menyebut kebersihan', pesan(tempatiKotor).toLowerCase().includes('bersih'));

  const bersihkan = await api(
    `/health/inpatient/beds/${ttA}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'AVAILABLE' }) },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('perawat menyatakan tempat tidur sudah bersih',
    bersihkan.status === 200 || bersihkan.status === 201,
    `status ${bersihkan.status} ${pesan(bersihkan)}`);

  const setelahBersih = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: bagus, facilityId, bedId: ttA }) },
    dokter.token,
    RAWAT,
  );
  check('setelah dibersihkan, pasien berikutnya dapat ditempatkan',
    setelahBersih.status === 201, `status ${setelahBersih.status} ${pesan(setelahBersih)}`);

  // --- 7. Pulang paksa -----------------------------------------------------
  log('');
  log('7. Pulang paksa tidak ditolak, tetapi wajib berketerangan');
  await api(
    `/health/inpatient/admissions/${setelahBersih.data?.id}/summary`,
    { method: 'POST', body: JSON.stringify({ dischargeDiagnosis: 'Observasi, membaik.' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const paksaTanpaAlasan = await api(
    `/health/inpatient/admissions/${setelahBersih.data?.id}/discharge`,
    { method: 'POST', body: JSON.stringify({ disposition: 'AGAINST_MEDICAL_ADVICE' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pulang paksa tanpa keterangan ditolak', paksaTanpaAlasan.status === 422,
    `status ${paksaTanpaAlasan.status}`);

  const paksa = await api(
    `/health/inpatient/admissions/${setelahBersih.data?.id}/discharge`,
    {
      method: 'POST',
      body: JSON.stringify({
        disposition: 'AGAINST_MEDICAL_ADVICE',
        reason: 'Pasien memilih dirawat di rumah, sudah dijelaskan risikonya.',
      }),
    },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dengan keterangan, pulang paksa TIDAK ditolak',
    paksa.status === 200 || paksa.status === 201, `status ${paksa.status} ${pesan(paksa)}`);

  // --- 8. Papan bangsal ----------------------------------------------------
  log('');
  log('8. Papan bangsal');
  const papan = await api(`/health/inpatient/board?facilityId=${facilityId}`, {}, dokter.token);
  check('papan bangsal terbaca', papan.status === 200, `status ${papan.status}`);
  check('hanya pasien yang masih dirawat yang tampil',
    (papan.data ?? []).length === 1 && papan.data[0].patient_name.startsWith('Sari'),
    JSON.stringify((papan.data ?? []).map((r) => r.patient_name)));

  const daftarTT = await api(`/health/inpatient/beds?facilityId=${facilityId}`, {}, dokter.token);
  check('daftar tempat tidur terbaca', daftarTT.status === 200, `status ${daftarTT.status}`);
  check('tempat tidur yang baru ditinggalkan tampak menunggu pembersihan',
    (daftarTT.data ?? []).some((b) => b.status === 'CLEANING'),
    JSON.stringify((daftarTT.data ?? []).map((b) => `${b.code}:${b.status}`)));

  // --- 9. Jejak ------------------------------------------------------------
  log('');
  log('9. Jejak dan tujuan penggunaan');
  const tanpaTujuan = await api(
    '/health/inpatient/admissions',
    { method: 'POST', body: JSON.stringify({ patientId: bagus, facilityId }) },
    dokter.token,
  );
  check('menerima pasien tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [budi],
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
    new URL('../../../docs/emedik/bukti-h6-rawat-inap.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
