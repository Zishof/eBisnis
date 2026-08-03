/**
 * Bukti H-7: triase, jeda sebelum sayatan, dan hitungan kasa.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - tanda vital yang mengancam nyawa dinilai ringan oleh petugas;
 * - menurunkan tingkat triase tanpa alasan;
 * - "pergi tanpa dilihat" pada pasien yang sudah dilihat dokter;
 * - memulangkan pasien triase tingkat 2 tanpa keterangan;
 * - menjadwalkan dua operasi pada kamar dan waktu yang sama;
 * - menyayat sebelum jeda dilakukan;
 * - menyayat ketika sisi yang ditandai berbeda dari persetujuan tindakan;
 * - mencatat jeda SESUDAH sayatan dimulai;
 * - meninggalkan kamar operasi dengan hitungan kasa yang tidak cocok.
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
  const username = `bukti_akut_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-7',FALSE) RETURNING id`,
      [`BUKTI_AKUT_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-7 — TRIASE, JEDA SEBELUM SAYATAN, DAN HITUNGAN KASA');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const BACA = ['READ'];
  const perawatTriase = await buatPengguna(tenantId, 'triase', {
    HEALTH: BACA,
    HEALTH_PATIENT: ['READ', 'CREATE'],
    HEALTH_EMERGENCY: ['READ', 'TRIAGE'],
    HEALTH_FACILITY: BACA,
  });
  const dokter = await buatPengguna(tenantId, 'dokter', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_EMERGENCY: ['READ', 'TRIAGE', 'UPDATE', 'DISCHARGE'],
    HEALTH_SURGERY: BACA,
    HEALTH_ICU: BACA,
  });
  const bedah = await buatPengguna(tenantId, 'bedah', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_SURGERY: ['READ', 'CREATE', 'UPDATE', 'INCISE', 'CANCEL'],
  });
  const instrumen = await buatPengguna(tenantId, 'instrumen', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_SURGERY: ['READ', 'CHECKLIST', 'UPDATE'],
  });
  const intensif = await buatPengguna(tenantId, 'intensif', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_ICU: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_ADMISSION: BACA,
  });

  log('');
  log('Lima pengguna. Perawat triase TIDAK diberi DISCHARGE; dokter bedah TIDAK');
  log('diberi CHECKLIST; perawat instrumen TIDAK diberi INCISE. Ketiganya justru');
  log('pemisahan yang hendak dibuktikan naskah ini.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Akut','HOSPITAL') RETURNING id`,
      [`BKAK-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Akut','Asia/Jakarta') RETURNING id`,
      [typeId, `AK-${tag}`],
    )
  )[0].id;

  const pasien = async (nama, gender) =>
    (
      await q(
        `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
         VALUES ($2,$1,'1970-01-01',$3) RETURNING id`,
        [`${nama} ${tag}`, `EPI-AK-${randomBytes(4).toString('hex')}`, gender],
      )
    )[0].id;

  const andi = await pasien('Andi Bukti Akut', 'MALE');
  const rina = await pasien('Rina Bukti Akut', 'FEMALE');
  const tono = await pasien('Tono Bukti Akut', 'MALE');

  const theatreId = (
    await q(
      `INSERT INTO "${SCHEMA}".ot_theatre (facility_id, code, name)
       VALUES ($1,$2,'OK 1') RETURNING id`,
      [facilityId, `OK1-${tag}`],
    )
  )[0].id;

  // --- 1. Triase -----------------------------------------------------------
  log('');
  log('1. Triase — tanda bahaya menaikkan tingkat, tidak pernah menurunkannya');
  const triaseRingan = await api(
    '/health/acute/ed/visits',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: andi, requestedLevel: 5,
        chiefComplaint: 'Lemas',
        vitals: { spo2: 86, systolicBp: 84, heartRate: 132, consciousness: 'VOICE' },
      }),
    },
    perawatTriase.token,
    RAWAT,
  );
  check('kunjungan gawat darurat dibuat', triaseRingan.status === 201,
    `status ${triaseRingan.status} ${pesan(triaseRingan)}`);
  check('petugas menilai tingkat 5, sistem menaikkannya ke tingkat 1',
    triaseRingan.data?.level === 1 && triaseRingan.data?.requestedLevel === 5,
    JSON.stringify({ level: triaseRingan.data?.level, requested: triaseRingan.data?.requestedLevel }));
  check('sebab kenaikannya dilaporkan satu per satu',
    (triaseRingan.data?.redFlags ?? []).length >= 3,
    JSON.stringify(triaseRingan.data?.redFlags));
  check('batas tunggunya mengikuti tingkat AKHIR, bukan yang diusulkan',
    triaseRingan.data?.maxWaitMinutes === 0);

  const tersimpan = await q(
    `SELECT requested_level, triage_level FROM "${SCHEMA}".ed_visit WHERE id = $1`,
    [triaseRingan.data?.id],
  );
  check('kedua tingkat DISIMPAN — selisihnya adalah data mutu IGD',
    tersimpan[0].requested_level === 5 && tersimpan[0].triage_level === 1,
    JSON.stringify(tersimpan[0]));

  const triaseWajar = await api(
    '/health/acute/ed/visits',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: rina, requestedLevel: 4,
        vitals: { spo2: 98, systolicBp: 120, heartRate: 76, consciousness: 'ALERT' },
      }),
    },
    perawatTriase.token,
    RAWAT,
  );
  check('tanda vital normal tidak menaikkan tingkat', triaseWajar.data?.level === 4);
  check('dan tidak melaporkan tanda bahaya palsu',
    (triaseWajar.data?.redFlags ?? []).length === 0);

  // --- 2. Menurunkan tingkat -----------------------------------------------
  log('');
  log('2. Menurunkan tingkat triase menuntut alasan');
  const turunTanpaAlasan = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/triage`,
    { method: 'POST', body: JSON.stringify({ level: 5 }) },
    perawatTriase.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('menurunkan tingkat tanpa alasan ditolak', turunTanpaAlasan.status === 422,
    `status ${turunTanpaAlasan.status}`);

  const naik = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/triage`,
    { method: 'POST', body: JSON.stringify({ level: 2 }) },
    perawatTriase.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('MENAIKKAN tingkat tanpa alasan selalu boleh',
    naik.status === 200 || naik.status === 201, `status ${naik.status} ${pesan(naik)}`);

  const turun = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/triage`,
    {
      method: 'POST',
      body: JSON.stringify({ level: 4, reason: 'Tanda vital diulang, seluruhnya dalam batas normal.' }),
    },
    perawatTriase.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dengan alasan, penurunan diizinkan',
    turun.status === 200 || turun.status === 201, `status ${turun.status} ${pesan(turun)}`);

  const riwayat = await q(
    `SELECT from_level, to_level, reason FROM "${SCHEMA}".ed_triage_change
      WHERE ed_visit_id = $1 ORDER BY changed_at`,
    [triaseWajar.data?.id],
  );
  check('setiap perubahan meninggalkan barisnya sendiri', riwayat.length === 3,
    `${riwayat.length} baris`);
  check('alasan penurunannya tersimpan', Boolean(riwayat[2]?.reason));

  let ubahRiwayat = false;
  try {
    await q(`UPDATE "${SCHEMA}".ed_triage_change SET reason = 'x' WHERE ed_visit_id = $1`,
      [triaseWajar.data?.id]);
  } catch {
    ubahRiwayat = true;
  }
  check('riwayat triase tidak dapat diubah, ditegakkan basis data', ubahRiwayat);

  // --- 3. Disposisi --------------------------------------------------------
  log('');
  log('3. Disposisi');
  const perawatMemulangkan = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/disposition`,
    { method: 'POST', body: JSON.stringify({ disposition: 'DISCHARGED' }) },
    perawatTriase.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('perawat triase TIDAK berwenang menetapkan disposisi',
    perawatMemulangkan.status === 403, `status ${perawatMemulangkan.status}`);

  const belumDilihat = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/disposition`,
    { method: 'POST', body: JSON.stringify({ disposition: 'DISCHARGED' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pasien yang belum dilihat dokter tidak dapat dipulangkan',
    belumDilihat.status === 422, `status ${belumDilihat.status}`);

  await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/seen`,
    { method: 'POST' },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const lwbsSalah = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/disposition`,
    { method: 'POST', body: JSON.stringify({ disposition: 'LEFT_WITHOUT_BEING_SEEN' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('"pergi tanpa dilihat" pada pasien yang SUDAH dilihat ditolak',
    lwbsSalah.status === 422, `status ${lwbsSalah.status}`);

  const pulang = await api(
    `/health/acute/ed/visits/${triaseWajar.data?.id}/disposition`,
    { method: 'POST', body: JSON.stringify({ disposition: 'DISCHARGED' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pasien tingkat 4 dipulangkan tanpa keterangan tambahan',
    pulang.status === 200 || pulang.status === 201, `status ${pulang.status} ${pesan(pulang)}`);

  // Pasien tingkat 1: pemulangan menuntut keterangan.
  await api(
    `/health/acute/ed/visits/${triaseRingan.data?.id}/seen`,
    { method: 'POST' },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  const gawatTanpaKeterangan = await api(
    `/health/acute/ed/visits/${triaseRingan.data?.id}/disposition`,
    { method: 'POST', body: JSON.stringify({ disposition: 'DISCHARGED' }) },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pasien triase tingkat 1 yang dipulangkan menuntut keterangan',
    gawatTanpaKeterangan.status === 422, `status ${gawatTanpaKeterangan.status}`);

  const gawatDenganKeterangan = await api(
    `/health/acute/ed/visits/${triaseRingan.data?.id}/disposition`,
    {
      method: 'POST',
      body: JSON.stringify({
        disposition: 'DISCHARGED',
        reason: 'Hipoglikemia, sudah dikoreksi, tanda vital kembali normal dan stabil dua jam.',
      }),
    },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dengan keterangan, pemulangannya diizinkan',
    gawatDenganKeterangan.status === 200 || gawatDenganKeterangan.status === 201,
    `status ${gawatDenganKeterangan.status} ${pesan(gawatDenganKeterangan)}`);

  // --- 4. Penjadwalan operasi ----------------------------------------------
  log('');
  log('4. Kamar operasi tidak dapat dijadwalkan dua kali');
  const op1 = await api(
    '/health/acute/ot/cases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: tono, facilityId, theatreId,
        procedureName: 'Hernia inguinalis',
        requiresSiteMarking: true, consentSite: 'KIRI',
        scheduledStart: '2026-08-05T01:00:00Z', scheduledEnd: '2026-08-05T03:00:00Z',
      }),
    },
    bedah.token,
    RAWAT,
  );
  check('operasi pertama dijadwalkan', op1.status === 201,
    `status ${op1.status} ${pesan(op1)}`);

  const bentrok = await api(
    '/health/acute/ot/cases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: andi, facilityId, theatreId, procedureName: 'Apendektomi',
        scheduledStart: '2026-08-05T02:00:00Z', scheduledEnd: '2026-08-05T04:00:00Z',
      }),
    },
    bedah.token,
    RAWAT,
  );
  check('jadwal yang bertumpang tindih ditolak', bentrok.status === 409,
    `status ${bentrok.status}`);

  const bersentuhan = await api(
    '/health/acute/ot/cases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: andi, facilityId, theatreId, procedureName: 'Apendektomi',
        scheduledStart: '2026-08-05T03:00:00Z', scheduledEnd: '2026-08-05T05:00:00Z',
      }),
    },
    bedah.token,
    RAWAT,
  );
  check('bersentuhan ujung ke ujung BUKAN tumpang tindih', bersentuhan.status === 201,
    `status ${bersentuhan.status} ${pesan(bersentuhan)}`);

  const tembusLangsung = await q(
    `INSERT INTO "${SCHEMA}".ot_case
       (case_number, patient_id, facility_id, theatre_id, procedure_name,
        scheduled_start, scheduled_end, scheduled_range)
     VALUES ($1,$2,$3,$4,'Tembus langsung',
             '2026-08-05T02:00:00Z','2026-08-05T02:30:00Z',
             tstzrange('2026-08-05T02:00:00Z','2026-08-05T02:30:00Z','[)'))`,
    [`TEMBUS-${tag}`, andi, facilityId, theatreId],
  ).then(() => false).catch(() => true);
  check('menembus lewat jalur basis data pun ditolak constraint pengecualian', tembusLangsung);

  const tanpaSisi = await api(
    '/health/acute/ot/cases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: andi, facilityId, procedureName: 'Katarak', requiresSiteMarking: true,
      }),
    },
    bedah.token,
    RAWAT,
  );
  check('prosedur bersisi tanpa sisi pada persetujuan ditolak sejak dijadwalkan',
    tanpaSisi.status === 422, `status ${tanpaSisi.status}`);

  // --- 5. Jeda sebelum sayatan ---------------------------------------------
  log('');
  log('5. Jeda sebelum sayatan — penahan terakhir untuk operasi salah sisi');
  const caseId = op1.data?.id;

  const sayatDuluan = await api(
    `/health/acute/ot/cases/${caseId}/incision`,
    { method: 'POST' },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('menyayat sebelum tahap pembiusan diselesaikan ditolak',
    sayatDuluan.status === 422, `status ${sayatDuluan.status}`);

  const bedahMengisi = await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    {
      method: 'POST',
      body: JSON.stringify({ phase: 'SIGN_IN', items: [] }),
    },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dokter bedah TIDAK berwenang mengisi daftar periksa', bedahMengisi.status === 403,
    `status ${bedahMengisi.status}`);

  const butir = await api('/health/acute/ot/checklist-items', {}, instrumen.token);
  check('butir wajib tiap tahap terbaca', butir.status === 200 && Boolean(butir.data?.TIME_OUT));

  const setengah = await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    {
      method: 'POST',
      body: JSON.stringify({ phase: 'TIME_OUT', items: ['TEAM_INTRODUCED'] }),
    },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('tahap yang belum lengkap ditolak', setengah.status === 422, `status ${setengah.status}`);
  check('butir yang kurang disebutkan NAMANYA', pesan(setengah).includes('SITE_STATED'));

  await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    { method: 'POST', body: JSON.stringify({ phase: 'SIGN_IN', items: butir.data.SIGN_IN }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    { method: 'POST', body: JSON.stringify({ phase: 'TIME_OUT', items: butir.data.TIME_OUT }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const belumDitandai = await api(
    `/health/acute/ot/cases/${caseId}/incision`,
    { method: 'POST' },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('menyayat sebelum sisi ditandai ditolak', belumDitandai.status === 422,
    `status ${belumDitandai.status}`);

  const sisiSalah = await api(
    `/health/acute/ot/cases/${caseId}/mark-site`,
    { method: 'POST', body: JSON.stringify({ site: 'KANAN' }) },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('penandaan tercatat meski berbeda dari persetujuan',
    sisiSalah.status === 200 || sisiSalah.status === 201);
  check('dan ketidakcocokannya dilaporkan', sisiSalah.data?.matchesConsent === false);

  const sayatSisiSalah = await api(
    `/health/acute/ot/cases/${caseId}/incision`,
    { method: 'POST' },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('SISI YANG BERBEDA dari persetujuan MENGHENTIKAN sayatan',
    sayatSisiSalah.status === 422, `status ${sayatSisiSalah.status}`);
  check('penolakannya berkata HENTIKAN', pesan(sayatSisiSalah).includes('HENTIKAN'));

  await api(
    `/health/acute/ot/cases/${caseId}/mark-site`,
    { method: 'POST', body: JSON.stringify({ site: 'KIRI' }) },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const sayat = await api(
    `/health/acute/ot/cases/${caseId}/incision`,
    { method: 'POST' },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dengan seluruh penahan terpenuhi, sayatan dimulai',
    sayat.status === 200 || sayat.status === 201, `status ${sayat.status} ${pesan(sayat)}`);

  const jedaSesudahnya = await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    { method: 'POST', body: JSON.stringify({ phase: 'TIME_OUT', items: butir.data.TIME_OUT }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('mencatat jeda SESUDAH sayatan dimulai ditolak', jedaSesudahnya.status === 409,
    `status ${jedaSesudahnya.status}`);

  const tembusJeda = await q(
    `UPDATE "${SCHEMA}".ot_case SET time_out_at = incision_at + interval '5 minutes' WHERE id = $1`,
    [caseId],
  ).then(() => false).catch(() => true);
  check('menembus lewat basis data pun ditolak constraint', tembusJeda);

  // --- 6. Hitungan kasa ----------------------------------------------------
  log('');
  log('6. Hitungan kasa yang tidak cocok menahan pasien di kamar operasi');
  await api(
    `/health/acute/ot/cases/${caseId}/counts`,
    { method: 'POST', body: JSON.stringify({ itemType: 'KASA', countedIn: 20 }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  await api(
    `/health/acute/ot/cases/${caseId}/counts`,
    { method: 'POST', body: JSON.stringify({ itemType: 'KASA', countedOut: 19 }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  await api(
    `/health/acute/ot/cases/${caseId}/checklist`,
    { method: 'POST', body: JSON.stringify({ phase: 'SIGN_OUT', items: butir.data.SIGN_OUT }) },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );

  const keluarTidakCocok = await api(
    `/health/acute/ot/cases/${caseId}/leave`,
    { method: 'POST', body: JSON.stringify({}) },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('hitungan yang tidak cocok MENAHAN pasien di kamar operasi',
    keluarTidakCocok.status === 422, `status ${keluarTidakCocok.status}`);
  check('selisihnya disebutkan per jenis benda', pesan(keluarTidakCocok).includes('KASA'));

  const periksaSendiri = await api(
    `/health/acute/ot/cases/${caseId}/counts`,
    {
      method: 'POST',
      body: JSON.stringify({ itemType: 'JARUM', countedIn: 6, countedOut: 6, verifiedBy: instrumen.subjectId }),
    },
    instrumen.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('penghitung kedua yang sama dengan penghitung pertama ditolak',
    periksaSendiri.status === 403, `status ${periksaSendiri.status}`);

  const keluar = await api(
    `/health/acute/ot/cases/${caseId}/leave`,
    {
      method: 'POST',
      body: JSON.stringify({
        discrepancyResolution: 'Foto sinar-X intraoperatif, tidak tampak benda tertinggal.',
        operativeNote: 'Hernioplasti kiri, tanpa penyulit.',
      }),
    },
    bedah.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dengan keterangan pencarian, pasien boleh keluar',
    keluar.status === 200 || keluar.status === 201, `status ${keluar.status} ${pesan(keluar)}`);

  // --- 7. Perawatan intensif -----------------------------------------------
  log('');
  log('7. Perawatan intensif — dukungan organ ganda selalu kritis');
  const admissionId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_admission
         (admission_number, patient_id, facility_id, status)
       VALUES ($1,$2,$3,'ADMITTED') RETURNING id`,
      [`INPAK-${tag}`, tono, facilityId],
    )
  )[0].id;
  const stayId = (
    await q(
      `INSERT INTO "${SCHEMA}".icu_stay (admission_id, patient_id, admission_reason)
       VALUES ($1,$2,'Pascaoperasi') RETURNING id`,
      [admissionId, tono],
    )
  )[0].id;

  const asesmenBaik = await api(
    '/health/acute/icu/assessments',
    {
      method: 'POST',
      body: JSON.stringify({
        icuStayId: stayId,
        vitals: { spo2: 98, systolicBp: 120, heartRate: 80, respiratoryRate: 16, consciousness: 'ALERT' },
      }),
    },
    intensif.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('tanda vital baik tanpa dukungan berisiko rendah', asesmenBaik.data?.risk === 'LOW',
    JSON.stringify(asesmenBaik.data));

  const asesmenMesin = await api(
    '/health/acute/icu/assessments',
    {
      method: 'POST',
      body: JSON.stringify({
        icuStayId: stayId,
        vitals: { spo2: 98, systolicBp: 120, heartRate: 80, respiratoryRate: 16, consciousness: 'ALERT' },
        onVentilator: true, onVasopressor: true,
      }),
    },
    intensif.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('tanda vital yang SAMA dengan dukungan organ ganda dinyatakan KRITIS',
    asesmenMesin.data?.risk === 'CRITICAL', JSON.stringify(asesmenMesin.data));
  check('dukungan organnya dihitung', asesmenMesin.data?.organSupport === 2);

  let ubahAsesmen = false;
  try {
    await q(`UPDATE "${SCHEMA}".icu_assessment SET severity_score = 0 WHERE id = $1`,
      [asesmenMesin.data?.id]);
  } catch {
    ubahAsesmen = true;
  }
  check('asesmen intensif tidak dapat diubah, ditegakkan basis data', ubahAsesmen);

  // --- 8. Papan ------------------------------------------------------------
  log('');
  log('8. Papan dan jejak');
  const papanIgd = await api(`/health/acute/ed/board?facilityId=${facilityId}`, {}, dokter.token);
  check('papan gawat darurat terbaca', papanIgd.status === 200, `status ${papanIgd.status}`);

  const jadwal = await api(`/health/acute/ot/schedule?facilityId=${facilityId}`, {}, bedah.token);
  check('jadwal operasi terbaca', jadwal.status === 200 && (jadwal.data ?? []).length >= 2,
    `status ${jadwal.status}`);

  const papanIcu = await api(`/health/acute/icu/board?facilityId=${facilityId}`, {}, intensif.token);
  check('papan intensif terbaca', papanIcu.status === 200, `status ${papanIcu.status}`);
  check('keadaan terakhirnya yang ditampilkan, bukan yang pertama',
    (papanIcu.data ?? [])[0]?.risk_level === 'CRITICAL',
    JSON.stringify((papanIcu.data ?? [])[0]?.risk_level));

  const tanpaTujuan = await api(
    '/health/acute/ed/visits',
    { method: 'POST', body: JSON.stringify({ facilityId, requestedLevel: 3 }) },
    perawatTriase.token,
  );
  check('menriase tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [andi],
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
    new URL('../../../docs/emedik/bukti-h7-akut.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
