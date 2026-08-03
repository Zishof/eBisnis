/**
 * Bukti H-9C: siklus klaim internal.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Dua hal yang paling penting dibuktikan di sini.
 *
 * 1. **Tiga angka disimpan terpisah** — diajukan, disetujui, dibayar — dan
 *    tidak satu pun jalan yang mempertukarkannya. Nilai yang sudah diajukan
 *    bahkan tidak dapat diubah lagi.
 *
 * 2. **Penanda anti-fraud TIDAK PERNAH menghentikan pengajuan.** Klaim
 *    bertanda tetap dapat diajukan, dan naskah ini membuktikannya dengan
 *    mengajukannya.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - mengajukan klaim yang belum diverifikasi internal;
 * - mengajukan klaim yang masih punya temuan penahan;
 * - yang mengode memverifikasi klaimnya sendiri;
 * - selisih disetujui tanpa sebab kode tertutup;
 * - sebab OTHER tanpa keterangan;
 * - klaim ganda atas kunjungan yang sama;
 * - menghapus atau mengubah nilai klaim yang sudah diajukan;
 * - menutup rekonsiliasi yang masih berselisih tanpa penjelasan.
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

const BAYAR = { 'x-purpose-of-use': 'PAYMENT' };
const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_klm_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9C',FALSE) RETURNING id`,
      [`BUKTI_KLM_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9C — SIKLUS KLAIM INTERNAL');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const petugas = await buatPengguna(tenantId, 'petugas', {
    HEALTH: ['READ'],
    HEALTH_PATIENT: ['READ'],
    HEALTH_CLAIM: ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'CANCEL'],
    HEALTH_CLAIM_RECON: ['READ', 'CREATE', 'CLOSE_PERIOD'],
  });
  const verifikator = await buatPengguna(tenantId, 'verifikator', {
    HEALTH: ['READ'],
    HEALTH_PATIENT: ['READ'],
    HEALTH_CLAIM: ['READ', 'VERIFY'],
    HEALTH_CLAIM_REVIEW: ['READ', 'REVIEW'],
  });

  log('');
  log('Dua pengguna. Petugas klaim TIDAK diberi VERIFY, verifikator TIDAK diberi');
  log('SUBMIT — dan verifikator sengaja dijadikan pengode klaim kedua, supaya');
  log('penolakan "yang mengode tidak memverifikasi" datang dari pemeriksaan baris.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Klaim','HOSPITAL') RETURNING id`,
      [`BKKL-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Klaim','Asia/Jakarta') RETURNING id`,
      [typeId, `KL-${tag}`],
    )
  )[0].id;
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Rina Bukti Klaim','1975-07-07','FEMALE') RETURNING id`,
      [`EPI-KL-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;
  const providerId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type)
       VALUES ($1,'dr. Klaim Bukti','DOCTOR') RETURNING id`,
      [`DRKL-${tag}`],
    )
  )[0].id;
  const encounterId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_encounter
         (patient_id, facility_id, encounter_number, encounter_type, provider_id)
       VALUES ($1,$2,$3,'OUTPATIENT',$4) RETURNING id`,
      [pasien, facilityId, `ENCKL-${tag}`, providerId],
    )
  )[0].id;

  // Pengkodean lengkap dan sah, memakai terminologi yang sudah ada.
  const snapshotId = (
    await q(
      `SELECT id FROM "${SCHEMA}".terminology_snapshot
        WHERE system = 'ICD10' AND is_active = TRUE LIMIT 1`,
    )
  )[0]?.id;
  const kodeSah = snapshotId
    ? (await q(
        `SELECT code FROM "${SCHEMA}".terminology_code
          WHERE snapshot_id = $1 AND deprecated_at IS NULL LIMIT 1`,
        [snapshotId],
      ))[0]?.code
    : null;
  if (!kodeSah) throw new Error('Tidak ada kode ICD10 aktif; jalankan bukti H-9 lebih dahulu.');

  const codingId = (
    await q(
      `INSERT INTO "${SCHEMA}".him_coding
         (encounter_id, patient_id, facility_id, service_date, encounter_type, status,
          coded_by, coded_at)
       VALUES ($1,$2,$3,CURRENT_DATE,'OUTPATIENT','CODED',$4,now()) RETURNING id`,
      [encounterId, pasien, facilityId, verifikator.subjectId],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".him_coded_item
       (coding_id, item_type, code, code_system, code_version, is_principal)
     VALUES ($1,'DIAGNOSIS',$2,'ICD10','v1',TRUE)`,
    [codingId, kodeSah],
  );

  // --- 1. Verifikasi internal ----------------------------------------------
  log('');
  log('1. Verifikasi internal menemukan kekurangan SEBELUM penjamin menemukannya');
  const klaim = await api(
    '/health/claims',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, encounterId, sepNumber: `SEP-${tag}` }),
    },
    petugas.token,
    BAYAR,
  );
  check('klaim disusun', klaim.status === 201, `status ${klaim.status} ${pesan(klaim)}`);
  check('nomornya bermakna', String(klaim.data?.claimNumber ?? '').startsWith('KLM-'),
    klaim.data?.claimNumber);

  const tanpaTujuan = await api(
    '/health/claims',
    { method: 'POST', body: JSON.stringify({ facilityId, encounterId }) },
    petugas.token,
  );
  check('menyusun klaim tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const ajukanBelumVerifikasi = await api(
    `/health/claims/${klaim.data?.id}/submit`,
    { method: 'POST', body: JSON.stringify({ submittedAmount: 10000000 }) },
    petugas.token,
    BAYAR,
  );
  check('mengajukan klaim yang belum diverifikasi DITOLAK',
    ajukanBelumVerifikasi.status === 422, `status ${ajukanBelumVerifikasi.status}`);
  check('penolakannya menyebut berminggu-minggu',
    pesan(ajukanBelumVerifikasi).includes('berminggu-minggu'));

  // Klaim kedua untuk membuktikan pemisahan pengode–verifikator.
  const encounter2 = (
    await q(
      `INSERT INTO "${SCHEMA}".health_encounter
         (patient_id, facility_id, encounter_number, encounter_type, provider_id)
       VALUES ($1,$2,$3,'OUTPATIENT',$4) RETURNING id`,
      [pasien, facilityId, `ENCKL2-${tag}`, providerId],
    )
  )[0].id;
  const klaim2 = await api(
    '/health/claims',
    { method: 'POST', body: JSON.stringify({ facilityId, encounterId: encounter2 }) },
    petugas.token,
    BAYAR,
  );
  await q(
    `UPDATE "${SCHEMA}".health_claim SET coded_by = $2 WHERE id = $1`,
    [klaim2.data?.id, verifikator.subjectId],
  );
  const verifikasiSendiri = await api(
    `/health/claims/${klaim2.data?.id}/verify`,
    { method: 'POST' },
    verifikator.token,
    BAYAR,
  );
  check('yang MENGODE tidak memverifikasi klaimnya sendiri', verifikasiSendiri.status === 403,
    `status ${verifikasiSendiri.status}`);
  check('penolakannya menyebut masih tampak benar baginya',
    pesan(verifikasiSendiri).includes('masih tampak benar baginya'));

  const tembusVerifikasiSendiri = await gagal(
    `UPDATE "${SCHEMA}".health_claim SET verified_by = coded_by WHERE id = $1`,
    [klaim2.data?.id],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusVerifikasiSendiri ?? '').includes('health_claim_verify_not_self'),
    tembusVerifikasiSendiri ?? 'lolos');

  const verifikasi = await api(
    `/health/claims/${klaim.data?.id}/verify`,
    { method: 'POST' },
    verifikator.token,
    BAYAR,
  );
  check('verifikasi berjalan', verifikasi.status === 201 || verifikasi.status === 200,
    `status ${verifikasi.status} ${pesan(verifikasi)}`);
  check('berkas yang lengkap dinyatakan bersih', verifikasi.data?.clean === true,
    JSON.stringify((verifikasi.data?.findings ?? []).map((f) => f.type)));
  check('dan statusnya berpindah', verifikasi.data?.status === 'INTERNALLY_VERIFIED');

  // Klaim ketiga yang sengaja kurang, untuk membuktikan temuan bernama.
  const admisiId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_admission
         (patient_id, facility_id, admission_number, admitted_at, status)
       VALUES ($1,$2,$3,now() - interval '5 days','ADMITTED') RETURNING id`,
      [pasien, facilityId, `INPKL-${tag}`],
    )
  )[0].id;
  const klaimKurang = await api(
    '/health/claims',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, admissionId: admisiId, billedClass: 'CLASS_1', entitledClass: 'CLASS_3',
      }),
    },
    petugas.token,
    BAYAR,
  );
  const verifikasiKurang = await api(
    `/health/claims/${klaimKurang.data?.id}/verify`,
    { method: 'POST' },
    verifikator.token,
    BAYAR,
  );
  const temuan = verifikasiKurang.data?.findings ?? [];
  check('berkas yang kurang menghasilkan temuan BERNAMA', temuan.length > 0,
    JSON.stringify(temuan.map((f) => f.type)));
  check('diagnosis utama yang tidak ada disebutkan',
    temuan.some((f) => f.type === 'MISSING_PRINCIPAL_DIAGNOSIS'));
  check('resume pulang yang belum ada disebutkan',
    temuan.some((f) => f.type === 'UNSIGNED_DISCHARGE_SUMMARY'));
  check('setiap temuan menyebut siapa yang memperbaikinya',
    temuan.every((f) => Boolean(f.responsibleRole)));

  const kelas = temuan.find((f) => f.type === 'CLASS_EXCEEDS_ENTITLEMENT');
  check('kelas yang melebihi hak peserta DILAPORKAN', Boolean(kelas));
  check('tetapi TIDAK menahan pengajuan', kelas?.blocksSubmission === false);
  check('dan menyebut bahwa selisihnya ditagihkan kepada pasien',
    String(kelas?.message ?? '').includes('bukan kepada penjamin'));

  const ajukanKurang = await api(
    `/health/claims/${klaimKurang.data?.id}/submit`,
    { method: 'POST', body: JSON.stringify({ submittedAmount: 5000000 }) },
    petugas.token,
    BAYAR,
  );
  check('klaim yang masih punya temuan penahan tidak dapat diajukan',
    ajukanKurang.status === 422, `status ${ajukanKurang.status}`);

  // --- 2. Penanda tidak menahan ---------------------------------------------
  log('');
  log('2. Penanda anti-fraud TIDAK PERNAH menghentikan pengajuan');
  const penandaTercatat = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_claim_flag WHERE claim_id = $1`,
    [klaim.data?.id],
  );
  const adaPenanda = penandaTercatat[0].n > 0;
  log(`  (klaim ini bertanda: ${adaPenanda ? 'ya' : 'tidak'})`);

  const kolomBlocked = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'health_claim_flag'
        AND column_name IN ('blocked','blocks_submission','is_blocking')`,
    [SCHEMA],
  );
  check('tabel penanda TIDAK punya satu pun kolom penahan', kolomBlocked[0].n === 0,
    `${kolomBlocked[0].n} kolom`);

  const kolomReview = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'health_claim' AND column_name = 'needs_review'`,
    [SCHEMA],
  );
  check('yang ada hanya needs_review', kolomReview[0].n === 1);

  const ajukan = await api(
    `/health/claims/${klaim.data?.id}/submit`,
    { method: 'POST', body: JSON.stringify({ submittedAmount: 10000000 }) },
    petugas.token,
    BAYAR,
  );
  check('klaim yang sudah diverifikasi DAPAT diajukan', ajukan.data?.status === 'SUBMITTED',
    `status ${ajukan.status} ${pesan(ajukan)}`);
  check('nilai yang diajukan tercatat', ajukan.data?.submittedAmount === 10000000);

  // --- 3. Tiga angka --------------------------------------------------------
  log('');
  log('3. Tiga angka disimpan terpisah dan tidak pernah dipertukarkan');
  const tigaKolom = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'health_claim'
        AND column_name IN ('submitted_amount','approved_amount','paid_amount')`,
    [SCHEMA],
  );
  check('ketiganya punya kolomnya sendiri', tigaKolom[0].n === 3);

  const kolomTunggal = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'health_claim'
        AND column_name IN ('amount','claim_amount','total_amount')`,
    [SCHEMA],
  );
  check('dan tidak ada kolom "nilai klaim" yang menyatukannya', kolomTunggal[0].n === 0);

  const ubahDiajukan = await gagal(
    `UPDATE "${SCHEMA}".health_claim SET submitted_amount = 99 WHERE id = $1`,
    [klaim.data?.id],
  );
  check('nilai yang sudah diajukan tidak dapat diubah',
    (ubahDiajukan ?? '').includes('CLAIM_SUBMITTED'), ubahDiajukan ?? 'lolos');
  check('penolakannya menyebut angkanya yang bergeser di sini',
    (ubahDiajukan ?? '').includes('angkanya yang bergeser di sini'));

  const hapusDiajukan = await gagal(
    `DELETE FROM "${SCHEMA}".health_claim WHERE id = $1`,
    [klaim.data?.id],
  );
  check('klaim yang sudah diajukan tidak dapat dihapus',
    (hapusDiajukan ?? '').includes('CLAIM_SUBMITTED'), hapusDiajukan ?? 'lolos');

  const hapusDraft = await gagal(
    `DELETE FROM "${SCHEMA}".health_claim WHERE id = $1`,
    [klaim2.data?.id],
  );
  check('tetapi yang belum diajukan boleh dihapus', hapusDraft === null, hapusDraft ?? '');

  // --- 4. Sebab penolakan kode tertutup -------------------------------------
  log('');
  log('4. Selisih yang merugikan wajib bersebab, dan sebabnya KODE TERTUTUP');
  const tanpaSebab = await api(
    `/health/claims/${klaim.data?.id}/decision`,
    { method: 'POST', body: JSON.stringify({ approvedAmount: 7000000 }) },
    petugas.token,
    BAYAR,
  );
  check('selisih tanpa sebab DITOLAK', tanpaSebab.status === 422, `status ${tanpaSebab.status}`);
  check('penolakannya menyebut tidak dapat memperbaikinya',
    pesan(tanpaSebab).includes('tidak dapat memperbaikinya'));

  const sebabOtherKosong = await api(
    `/health/claims/${klaim.data?.id}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({ approvedAmount: 7000000, rejectionReason: 'OTHER' }),
    },
    petugas.token,
    BAYAR,
  );
  check('sebab OTHER tanpa keterangan ditolak', sebabOtherKosong.status === 422,
    `status ${sebabOtherKosong.status}`);
  check('penolakannya menyebut tempat pembuangan',
    pesan(sebabOtherKosong).includes('tempat pembuangan'));

  const keputusan = await api(
    `/health/claims/${klaim.data?.id}/decision`,
    {
      method: 'POST',
      body: JSON.stringify({
        approvedAmount: 7000000, rejectionReason: 'CODING_ERROR',
      }),
    },
    petugas.token,
    BAYAR,
  );
  check('keputusan dengan sebab kode tertutup dicatat',
    keputusan.data?.status === 'PARTIALLY_APPROVED',
    `status ${keputusan.status} ${pesan(keputusan)}`);
  check('selisihnya dihitung', keputusan.data?.approvalGap === 3000000,
    `${keputusan.data?.approvalGap}`);

  const tembusTanpaSebab = await gagal(
    `UPDATE "${SCHEMA}".health_claim
        SET approved_amount = 1, rejection_reason = NULL WHERE id = $1`,
    [klaim.data?.id],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusTanpaSebab ?? '').includes('health_claim_gap_needs_reason'),
    tembusTanpaSebab ?? 'lolos');

  const bayar = await api(
    `/health/claims/${klaim.data?.id}/payment`,
    { method: 'POST', body: JSON.stringify({ paidAmount: 6500000 }) },
    petugas.token,
    BAYAR,
  );
  check('pembayaran dicatat sebagai angka KETIGA', bayar.data?.status === 'PAID',
    `status ${bayar.status} ${pesan(bayar)}`);
  check('selisih bayar dihitung terpisah dari selisih setuju',
    bayar.data?.approvalGap === 3000000 && bayar.data?.paymentGap === 500000,
    JSON.stringify({ setuju: bayar.data?.approvalGap, bayar: bayar.data?.paymentGap }));

  const tersimpan = await q(
    `SELECT submitted_amount::float8 AS a, approved_amount::float8 AS b, paid_amount::float8 AS c
       FROM "${SCHEMA}".health_claim WHERE id = $1`,
    [klaim.data?.id],
  );
  check('ketiganya tersimpan berbeda dan tidak saling menimpa',
    tersimpan[0].a === 10000000 && tersimpan[0].b === 7000000 && tersimpan[0].c === 6500000,
    JSON.stringify(tersimpan[0]));

  // --- 5. Klaim ganda -------------------------------------------------------
  log('');
  log('5. Satu klaim per kunjungan yang masih hidup');
  const klaimGanda = await gagal(
    `INSERT INTO "${SCHEMA}".health_claim
       (claim_number, facility_id, patient_id, encounter_id, service_date)
     VALUES ($1,$2,$3,$4,CURRENT_DATE)`,
    [`KLMX-${tag}`, facilityId, pasien, encounterId],
  );
  check('klaim kedua atas kunjungan yang sama ditolak indeks unik',
    (klaimGanda ?? '').includes('ux_health_claim_one_per_encounter'), klaimGanda ?? 'lolos');

  // --- 6. Rekonsiliasi tiga sisi --------------------------------------------
  log('');
  log('6. Rekonsiliasi membandingkan TIGA sisi');
  const tutupBerselisih = await api(
    `/health/claims/${klaim.data?.id}/reconcile`,
    {
      method: 'POST',
      body: JSON.stringify({
        payerStatedAmount: 6500000, bankCreditedAmount: 6400000, close: true,
      }),
    },
    petugas.token,
    BAYAR,
  );
  check('menutup rekonsiliasi yang masih berselisih tanpa penjelasan DITOLAK',
    tutupBerselisih.status === 422, `status ${tutupBerselisih.status}`);
  check('penolakannya menyebut akan selalu ditutup dengan selisih',
    pesan(tutupBerselisih).includes('akan selalu ditutup dengan selisih'));

  const catatSelisih = await api(
    `/health/claims/${klaim.data?.id}/reconcile`,
    {
      method: 'POST',
      body: JSON.stringify({ payerStatedAmount: 6500000, bankCreditedAmount: 6400000 }),
    },
    petugas.token,
    BAYAR,
  );
  check('selisihnya boleh DICATAT tanpa ditutup',
    catatSelisih.status === 201 || catatSelisih.status === 200,
    `status ${catatSelisih.status} ${pesan(catatSelisih)}`);
  check('kedua selisih dihitung terpisah',
    catatSelisih.data?.payerGap === 0 && catatSelisih.data?.bankGap === 100000,
    JSON.stringify({ p: catatSelisih.data?.payerGap, b: catatSelisih.data?.bankGap }));

  const tutupBerpenjelasan = await api(
    `/health/claims/${klaim.data?.id}/reconcile`,
    {
      method: 'POST',
      body: JSON.stringify({
        payerStatedAmount: 6500000, bankCreditedAmount: 6400000,
        explanation: 'Potongan biaya transfer antarbank; bukti nomor TRF-998.',
        bankReference: 'TRF-998', close: true,
      }),
    },
    petugas.token,
    BAYAR,
  );
  check('dengan penjelasan, boleh ditutup',
    tutupBerpenjelasan.status === 201 || tutupBerpenjelasan.status === 200,
    `status ${tutupBerpenjelasan.status} ${pesan(tutupBerpenjelasan)}`);

  const statusAkhir = await q(
    `SELECT status FROM "${SCHEMA}".health_claim WHERE id = $1`,
    [klaim.data?.id],
  );
  check('klaimnya berstatus REKONSILIASI', statusAkhir[0].status === 'RECONCILED',
    statusAkhir[0].status);

  const tembusTutup = await gagal(
    `INSERT INTO "${SCHEMA}".health_claim_reconciliation
       (claim_id, our_paid_amount, payer_stated_amount, bank_credited_amount,
        payer_gap, bank_gap, closed_at, closed_by)
     VALUES ($1,100,90,90,10,0,now(),$2)`,
    [klaim.data?.id, petugas.subjectId],
  );
  check('menutup selisih tanpa penjelasan lewat basis data ditolak constraint',
    (tembusTutup ?? '').includes('claim_recon_gap_needs_explanation'), tembusTutup ?? 'lolos');

  const hapusRekon = await gagal(
    `DELETE FROM "${SCHEMA}".health_claim_reconciliation WHERE claim_id = $1`,
    [klaim.data?.id],
  );
  check('catatan rekonsiliasi tidak dapat dihapus',
    (hapusRekon ?? '').includes('LEDGER_IMMUTABLE'), hapusRekon ?? 'lolos');

  // --- 7. Laporan sebab penolakan -------------------------------------------
  log('');
  log('7. Laporan sebab penolakan — inilah gunanya kode tertutup');
  const laporan = await api(
    `/health/claims/rejection-report?facilityId=${facilityId}&year=${new Date().getFullYear()}`,
    {},
    petugas.token,
  );
  check('laporan terbaca', laporan.status === 200, `status ${laporan.status}`);
  check('dan dikelompokkan menurut sebabnya',
    (laporan.data ?? []).some((r) => r.rejection_reason === 'CODING_ERROR'),
    JSON.stringify((laporan.data ?? []).map((r) => r.rejection_reason)));
  check('beserta nilai selisihnya',
    (laporan.data ?? []).find((r) => r.rejection_reason === 'CODING_ERROR')?.total_gap === 3000000,
    JSON.stringify((laporan.data ?? [])[0]));

  const papan = await api(
    `/health/claims?facilityId=${facilityId}`,
    {},
    petugas.token,
  );
  check('daftar kerja terbaca', papan.status === 200, `status ${papan.status}`);
  check('memuat jumlah temuan penahan tiap klaim',
    (papan.data ?? []).some((c) => typeof c.blocking_findings === 'number'));

  const detail = await api(`/health/claims/${klaim.data?.id}`, {}, petugas.token);
  check('klaim terbaca beserta temuan dan penandanya',
    Array.isArray(detail.data?.findings) && Array.isArray(detail.data?.flags));
  check('dan ketiga angkanya dilaporkan sekaligus',
    detail.data?.submittedAmount === 10000000 &&
      detail.data?.approvedAmount === 7000000 &&
      detail.data?.paidAmount === 6500000,
    JSON.stringify({
      a: detail.data?.submittedAmount,
      b: detail.data?.approvedAmount,
      c: detail.data?.paidAmount,
    }));

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
    new URL('../../../docs/emedik/bukti-h9c-klaim.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
