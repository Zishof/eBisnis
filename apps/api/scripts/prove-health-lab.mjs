/**
 * Bukti H-5: dari pesanan pemeriksaan sampai nilai kritis diterima dokter.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - menerima spesimen tanpa label;
 * - memverifikasi hasil yang dimasukkan sendiri;
 * - meloloskan nilai kritis lewat verifikasi otomatis;
 * - melepas hasil dari spesimen yang ditolak;
 * - menerima nilai kritis tanpa bacaan ulang, atau dengan bacaan yang keliru;
 * - menimpa hasil yang sudah dilepas;
 * - mengamandemen tanpa alasan.
 *
 * Dan satu hal yang harus benar-benar terjadi: nilai kritis membuka catatan
 * penyampaiannya sendiri, tanpa ada yang menekan tombol.
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
  const username = `bukti_lab_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-5',FALSE) RETURNING id`,
      [`BUKTI_LAB_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-5 — DARI PESANAN PEMERIKSAAN SAMPAI NILAI KRITIS DITERIMA DOKTER');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  // --- Persiapan: empat orang ----------------------------------------------
  const BACA = ['READ'];
  const dokter = await buatPengguna(tenantId, 'dokter', {
    HEALTH: BACA,
    HEALTH_PATIENT: ['READ', 'CREATE'],
    HEALTH_LAB_ORDER: ['READ', 'CREATE'],
    HEALTH_LAB_RESULT: BACA,
    HEALTH_LAB_CRITICAL: ['READ', 'ACKNOWLEDGE_CRITICAL'],
    HEALTH_LAB_CATALOG: BACA,
    HEALTH_FACILITY: BACA,
  });
  const perawat = await buatPengguna(tenantId, 'perawat', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_LAB_ORDER: BACA,
    HEALTH_LAB_SPECIMEN: ['READ', 'CREATE'],
  });
  const analis = await buatPengguna(tenantId, 'analis', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_LAB_ORDER: BACA,
    HEALTH_LAB_SPECIMEN: ['READ', 'RECEIVE'],
    HEALTH_LAB_RESULT: ['READ', 'CREATE'],
    HEALTH_LAB_CRITICAL: ['READ', 'CREATE'],
    HEALTH_LAB_CATALOG: BACA,
  });
  const penyelia = await buatPengguna(tenantId, 'penyelia', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_LAB_ORDER: BACA,
    HEALTH_LAB_RESULT: ['READ', 'VERIFY_RESULT', 'AMEND'],
    HEALTH_LAB_CRITICAL: BACA,
    HEALTH_LAB_CATALOG: ['READ', 'CREATE', 'UPDATE'],
  });

  log('');
  log('Empat pengguna: dokter, perawat, analis, penyelia. Analis TIDAK diberi hak');
  log('memverifikasi, dan TIDAK diberi hak menerima nilai kritis — dua pemisahan');
  log('yang justru hendak dibuktikan naskah ini.');

  // --- Persiapan: fasilitas, pasien, katalog -------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category, supports_laboratory)
       VALUES ($1,'Klinik Bukti Lab','CLINIC',TRUE) RETURNING id`,
      [`BKLB-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'Klinik Bukti Lab','Asia/Jakarta') RETURNING id`,
      [typeId, `LB-${tag}`],
    )
  )[0].id;

  const patientId = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,'1980-06-10','MALE') RETURNING id`,
      [`Budi Bukti Lab ${tag}`, `EPI-LB-${tag}`],
    )
  )[0].id;

  // Kalium: nilai kritis ≤ 2,8 dan ≥ 6,0. Pemeriksaan yang benar-benar membunuh
  // bila hasilnya tidak dibaca.
  const kaliumId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_test_catalog
         (code, name, department, result_type, unit, specimen_type, container_type,
          max_transport_minutes, turnaround_minutes, allow_auto_verify, delta_check_percent)
       VALUES ($1,'Kalium','LAB','NUMERIC','mmol/L','SERUM','Tabung tutup merah',
               120, 60, TRUE, 30)
       RETURNING id`,
      [`K-${tag}`],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".lab_reference_range
       (test_id, low_value, high_value, critical_low, critical_high, unit)
     VALUES ($1, 3.5, 5.1, 2.8, 6.0, 'mmol/L')`,
    [kaliumId],
  );

  const hbId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_test_catalog
         (code, name, department, result_type, unit, specimen_type, container_type,
          max_transport_minutes, turnaround_minutes, allow_auto_verify, delta_check_percent)
       VALUES ($1,'Hemoglobin','LAB','NUMERIC','g/dL','WHOLE_BLOOD','Tabung tutup ungu',
               120, 60, TRUE, 25)
       RETURNING id`,
      [`HB-${tag}`],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".lab_reference_range
       (test_id, sex, min_age_years, low_value, high_value, critical_low, critical_high, unit)
     VALUES ($1,'MALE',18, 13.5, 17.5, 7, 20, 'g/dL')`,
    [hbId],
  );

  const rontgenId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_test_catalog
         (code, name, department, result_type, turnaround_minutes)
       VALUES ($1,'Rontgen Toraks','RAD','TEXT',240) RETURNING id`,
      [`RAD-${tag}`],
    )
  )[0].id;

  // --- 1. Memesan pemeriksaan ----------------------------------------------
  log('');
  log('1. Memesan pemeriksaan');
  const pesanan = await api(
    '/health/lab/orders',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, facilityId, priority: 'STAT',
        clinicalInfo: 'Lemas, dugaan gangguan elektrolit.',
        testIds: [kaliumId, hbId],
      }),
    },
    dokter.token,
    RAWAT,
  );
  check('pesanan dibuat', pesanan.status === 201, `status ${pesanan.status} ${pesan(pesanan)}`);
  const orderId = pesanan.data?.id;

  check(
    'dua pemeriksaan dari dua jenis spesimen menghasilkan dua spesimen',
    (pesanan.data?.specimens ?? []).length === 2,
    JSON.stringify(pesanan.data?.specimens?.map((s) => s.specimenType)),
  );

  const pesananSatuTabung = await api(
    '/health/lab/orders',
    {
      method: 'POST',
      body: JSON.stringify({ patientId, facilityId, testIds: [kaliumId] }),
    },
    dokter.token,
    RAWAT,
  );
  check('satu jenis spesimen menghasilkan satu spesimen', (pesananSatuTabung.data?.specimens ?? []).length === 1);

  const pesananKosong = await api(
    '/health/lab/orders',
    { method: 'POST', body: JSON.stringify({ patientId, facilityId, testIds: [] }) },
    dokter.token,
    RAWAT,
  );
  check('pesanan tanpa pemeriksaan ditolak', pesananKosong.status === 400 || pesananKosong.status === 422);

  // --- 2. Spesimen ---------------------------------------------------------
  log('');
  log('2. Spesimen — yang tanpa label tidak pernah diterima');
  const spesimen = await q(
    `SELECT id::text AS id, specimen_type FROM "${SCHEMA}".lab_specimen
      WHERE order_id = $1 ORDER BY specimen_number`,
    [orderId],
  );
  const serumId = spesimen.find((s) => s.specimen_type === 'SERUM').id;
  const darahId = spesimen.find((s) => s.specimen_type === 'WHOLE_BLOOD').id;

  const ambil = await api(
    `/health/lab/specimens/${serumId}/collect`,
    { method: 'POST', body: JSON.stringify({ volumeMl: 5 }) },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pengambilan spesimen tercatat', ambil.status === 200 || ambil.status === 201,
    `status ${ambil.status} ${pesan(ambil)}`);

  await api(
    `/health/lab/specimens/${darahId}/collect`,
    { method: 'POST', body: JSON.stringify({ volumeMl: 3 }) },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const tanpaLabel = await api(
    `/health/lab/specimens/${darahId}/receive`,
    { method: 'POST', body: JSON.stringify({ labelled: false, labelMatchesRequest: true }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('spesimen TANPA LABEL ditolak', tanpaLabel.status === 422, `status ${tanpaLabel.status}`);
  check('penolakannya menyebut sebabnya', pesan(tanpaLabel).toLowerCase().includes('label'));

  const statusDitolak = await q(
    `SELECT status, reject_reason FROM "${SCHEMA}".lab_specimen WHERE id = $1`,
    [darahId],
  );
  check('spesimennya tercatat DITOLAK dengan sebab tertutup',
    statusDitolak[0].status === 'REJECTED' && statusDitolak[0].reject_reason === 'UNLABELLED',
    JSON.stringify(statusDitolak[0]));

  const terima = await api(
    `/health/lab/specimens/${serumId}/receive`,
    {
      method: 'POST',
      body: JSON.stringify({
        labelled: true, labelMatchesRequest: true, volumeSufficient: true, containerCorrect: true,
      }),
    },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('spesimen yang baik diterima', terima.status === 200 || terima.status === 201,
    `status ${terima.status} ${pesan(terima)}`);

  // --- 3. Hasil dan verifikasi otomatis ------------------------------------
  log('');
  log('3. Hasil, rentang rujukan, dan verifikasi otomatis');
  const item = await q(
    `SELECT i.id::text AS id, t.code FROM "${SCHEMA}".lab_order_item i
       JOIN "${SCHEMA}".lab_test_catalog t ON t.id = i.test_id
      WHERE i.order_id = $1`,
    [orderId],
  );
  const itemKalium = item.find((i) => i.code.startsWith('K-')).id;

  const hasilNormal = await api(
    '/health/lab/results',
    { method: 'POST', body: JSON.stringify({ orderItemId: itemKalium, valueNumeric: 4.2 }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('hasil dalam rentang dinilai NORMAL', hasilNormal.data?.flag === 'NORMAL',
    `${hasilNormal.status} ${JSON.stringify(hasilNormal.data)}`);
  check('dan boleh lolos verifikasi otomatis', hasilNormal.data?.autoVerified === true);

  // Hasil kedua pada pesanan kedua: nilai kritis.
  const pesanan2 = pesananSatuTabung.data;
  const spesimen2 = pesanan2.specimens[0].id;
  await api(
    `/health/lab/specimens/${spesimen2}/collect`,
    { method: 'POST', body: JSON.stringify({ volumeMl: 5 }) },
    perawat.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  await api(
    `/health/lab/specimens/${spesimen2}/receive`,
    { method: 'POST', body: JSON.stringify({ labelled: true, labelMatchesRequest: true }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  const item2 = (
    await q(`SELECT id::text AS id FROM "${SCHEMA}".lab_order_item WHERE order_id = $1`, [pesanan2.id])
  )[0].id;

  const hasilKritis = await api(
    '/health/lab/results',
    { method: 'POST', body: JSON.stringify({ orderItemId: item2, valueNumeric: 7.2 }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('kalium 7,2 dinilai KRITIS TINGGI', hasilKritis.data?.flag === 'CRITICAL_HIGH',
    JSON.stringify(hasilKritis.data));
  check('nilai kritis TIDAK lolos verifikasi otomatis', hasilKritis.data?.autoVerified === false);
  check('sebab penahanannya disebutkan',
    String(hasilKritis.data?.autoVerifyBlockedBecause ?? '').toLowerCase().includes('kritis'));

  const catatanKritis = await q(
    `SELECT id::text AS id, acknowledged_at FROM "${SCHEMA}".lab_critical_notification
      WHERE result_id = $1`,
    [hasilKritis.data?.id],
  );
  check('catatan penyampaian terbuka SENDIRI, tanpa ada yang menekan tombol',
    catatanKritis.length === 1, `${catatanKritis.length} baris`);

  // --- 4. Verifikasi oleh orang kedua --------------------------------------
  log('');
  log('4. Pemisahan wewenang: pemasuk hasil tidak memverifikasi hasilnya sendiri');
  const verifikasiSendiri = await api(
    `/health/lab/results/${hasilKritis.data?.id}/verify`,
    { method: 'POST' },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('analis tidak berwenang memverifikasi sama sekali', verifikasiSendiri.status === 403,
    `status ${verifikasiSendiri.status}`);

  const verifikasi = await api(
    `/health/lab/results/${hasilKritis.data?.id}/verify`,
    { method: 'POST' },
    penyelia.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('penyelia memverifikasi', verifikasi.status === 200 || verifikasi.status === 201,
    `status ${verifikasi.status} ${pesan(verifikasi)}`);

  const lepas = await api(
    `/health/lab/results/${hasilKritis.data?.id}/release`,
    { method: 'POST' },
    penyelia.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('hasil dilepas kepada klinisi', lepas.status === 200 || lepas.status === 201,
    `status ${lepas.status} ${pesan(lepas)}`);
  check('pelepasannya menyebutkan bahwa hasilnya kritis', lepas.data?.critical === true);

  // --- 5. Nilai kritis: penyampaian dan bacaan ulang -----------------------
  log('');
  log('5. Nilai kritis — bacaan ulang wajib, dan dicocokkan di peladen');
  const notifId = catatanKritis[0].id;

  const daftarKritis = await api(
    `/health/lab/critical?facilityId=${facilityId}`,
    {},
    analis.token,
  );
  check('nilai kritis tampil pada daftar tertunda',
    (daftarKritis.data ?? []).some((r) => r.id === notifId),
    `status ${daftarKritis.status}`);
  check('statusnya menunggu penerimaan',
    (daftarKritis.data ?? []).find((r) => r.id === notifId)?.delivery?.state === 'PENDING');

  const sampaikan = await api(
    `/health/lab/critical/${notifId}/notify`,
    { method: 'POST', body: JSON.stringify({ channel: 'PHONE', notifiedTo: 'dr. Bukti' }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('percobaan penyampaian tercatat', sampaikan.status === 200 || sampaikan.status === 201,
    `status ${sampaikan.status} ${pesan(sampaikan)}`);

  const analisMenerima = await api(
    `/health/lab/critical/${notifId}/acknowledge`,
    { method: 'POST', body: JSON.stringify({ readBackValue: '7.2' }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('analis TIDAK berwenang menerima nilai kritis yang ia sampaikan sendiri',
    analisMenerima.status === 403, `status ${analisMenerima.status}`);

  const bacaanKeliru = await api(
    `/health/lab/critical/${notifId}/acknowledge`,
    { method: 'POST', body: JSON.stringify({ readBackValue: '2.7' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('bacaan ulang yang KELIRU ditolak', bacaanKeliru.status === 422,
    `status ${bacaanKeliru.status}`);
  check('penolakannya meminta penyampaian diulang',
    pesan(bacaanKeliru).toLowerCase().includes('ulangi'));

  const diterima = await api(
    `/health/lab/critical/${notifId}/acknowledge`,
    { method: 'POST', body: JSON.stringify({ readBackValue: '7,2' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('bacaan ulang dengan koma Indonesia diterima',
    diterima.status === 200 || diterima.status === 201,
    `status ${diterima.status} ${pesan(diterima)}`);

  const tercatat = await q(
    `SELECT acknowledged_by, read_back_value FROM "${SCHEMA}".lab_critical_notification WHERE id = $1`,
    [notifId],
  );
  check('penerimanya tercatat beserta bacaan ulangnya',
    Boolean(tercatat[0].acknowledged_by) && Boolean(tercatat[0].read_back_value),
    JSON.stringify(tercatat[0]));

  const ulangTerima = await api(
    `/health/lab/critical/${notifId}/acknowledge`,
    { method: 'POST', body: JSON.stringify({ readBackValue: '7.2' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('penerimaan tidak dapat dicatat dua kali', ulangTerima.status === 409,
    `status ${ulangTerima.status}`);

  // --- 6. Hasil yang sudah dilepas tidak dapat ditimpa ---------------------
  log('');
  log('6. Hasil yang sudah dilepas hanya dapat diamandemen');
  const timpa = await api(
    '/health/lab/results',
    { method: 'POST', body: JSON.stringify({ orderItemId: item2, valueNumeric: 4.0 }) },
    analis.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('menimpa hasil yang sudah dilepas ditolak', timpa.status === 409, `status ${timpa.status}`);
  check('penolakannya menunjuk amandemen', pesan(timpa).toLowerCase().includes('amandemen'));

  const amandemenTanpaAlasan = await api(
    `/health/lab/results/${hasilKritis.data?.id}/amend`,
    { method: 'POST', body: JSON.stringify({ valueNumeric: 4.0, reason: 'salah' }) },
    penyelia.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('amandemen dengan alasan terlalu pendek ditolak',
    amandemenTanpaAlasan.status === 400 || amandemenTanpaAlasan.status === 422,
    `status ${amandemenTanpaAlasan.status}`);

  const amandemen = await api(
    `/health/lab/results/${hasilKritis.data?.id}/amend`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueNumeric: 4.0,
        reason: 'Spesimen hemolisis; diperiksa ulang dengan tabung baru.',
      }),
    },
    penyelia.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('amandemen beralasan diterima', amandemen.status === 200 || amandemen.status === 201,
    `status ${amandemen.status} ${pesan(amandemen)}`);
  check('nilai barunya dinilai ulang dan tidak lagi kritis', amandemen.data?.critical === false);

  const riwayat = await q(
    `SELECT previous_value_numeric::float8 AS lama, new_value_numeric::float8 AS baru, reason
       FROM "${SCHEMA}".lab_result_amendment WHERE result_id = $1`,
    [hasilKritis.data?.id],
  );
  check('nilai yang lama TETAP TERLIHAT beserta penggantinya',
    riwayat.length === 1 && riwayat[0].lama === 7.2 && riwayat[0].baru === 4,
    JSON.stringify(riwayat[0]));

  let amandemenKekal = false;
  try {
    await q(`DELETE FROM "${SCHEMA}".lab_result_amendment WHERE result_id = $1`, [hasilKritis.data?.id]);
  } catch {
    amandemenKekal = true;
  }
  check('catatan amandemen tidak dapat dihapus, ditegakkan basis data', amandemenKekal);

  // --- 7. Daftar kerja -----------------------------------------------------
  log('');
  log('7. Daftar kerja — nilai kritis di atas STAT sekalipun');
  const kerja = await api(`/health/lab/worklist?facilityId=${facilityId}`, {}, analis.token);
  check('daftar kerja terbaca', kerja.status === 200, `status ${kerja.status}`);
  check('pesanan yang spesimennya ditolak tidak menghuni daftar kerja',
    !(kerja.data ?? []).some((r) => r.status === 'REJECTED'),
    JSON.stringify((kerja.data ?? []).map((r) => r.status)));

  // --- 8. Jejak dan tujuan penggunaan --------------------------------------
  log('');
  log('8. Setiap sentuhan rekam medis meninggalkan jejak');
  const hasilPasien = await api(
    `/health/lab/patients/${patientId}/results`,
    {},
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('hasil pasien terbaca', hasilPasien.status === 200, `status ${hasilPasien.status}`);
  check('hasil yang diamandemen menyertakan jumlah amandemennya',
    (hasilPasien.data ?? []).some((r) => r.amendment_count > 0));

  const tanpaTujuan = await api(`/health/lab/patients/${patientId}/results`, {}, dokter.token);
  check('membaca hasil tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [patientId],
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
    new URL('../../../docs/emedik/bukti-h5-laboratorium.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
