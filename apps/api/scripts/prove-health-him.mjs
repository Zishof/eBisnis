/**
 * Bukti H-9: kelengkapan rekam medis, pengkodean, penahanan hukum,
 * pelepasan informasi, dan keselamatan pasien.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - mengode berkas yang belum lengkap;
 * - mengode dengan lebih dari satu diagnosis utama;
 * - memakai kode terminologi yang sudah dicabut;
 * - koder memverifikasi pengkodeannya sendiri;
 * - mengubah rekam medis yang sedang ditahan untuk keperluan hukum;
 * - melepas rekam kepada kepolisian tanpa nomor surat;
 * - menutup insiden tanpa tindakan perbaikan;
 * - pelapor menutup laporannya sendiri pada kejadian berat.
 *
 * Dan dua hal yang harus TETAP berjalan: pembacaan rekam yang ditahan, dan
 * pelaporan insiden oleh peran klinis mana pun.
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

/**
 * Menjalankan satu pernyataan yang SEHARUSNYA ditolak, dan mengembalikan bunyi
 * penolakannya — null bila justru berhasil.
 *
 * Sengaja mengembalikan pesannya, bukan sekadar benar/salah. Satu tabel dapat
 * memiliki beberapa penjaga; "gagal" saja tidak membuktikan penjaga yang mana
 * yang bekerja, dan naskah bukti yang lulus karena penjaga yang keliru lebih
 * berbahaya daripada tidak ada naskah bukti sama sekali.
 */
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

const RAWAT = { 'x-purpose-of-use': 'TREATMENT' };
const HUKUM = { 'x-purpose-of-use': 'LEGAL' };
const MUTU = { 'x-purpose-of-use': 'QUALITY' };
const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_him_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9',FALSE) RETURNING id`,
      [`BUKTI_HIM_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9 — REKAM MEDIS, PENGKODEAN, PENAHANAN HUKUM, DAN KESELAMATAN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const BACA = ['READ'];
  const koder = await buatPengguna(tenantId, 'koder', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_HIM_CODING: ['READ', 'CREATE'],
    HEALTH_TERMINOLOGY: BACA,
    HEALTH_FACILITY: BACA,
  });
  const verifikator = await buatPengguna(tenantId, 'verifikator', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_HIM_CODING: ['READ', 'VERIFY'],
  });
  const hukum = await buatPengguna(tenantId, 'hukum', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_LEGAL_HOLD: ['READ', 'CREATE', 'DELETE'],
    // Memutuskan pelepasan, TIDAK menyerahkan berkasnya. Yang menyerahkan
    // adalah petugas rekam medis — persis seperti katalog peran menyatakannya.
    HEALTH_INFO_RELEASE: ['READ', 'CREATE'],
  });
  const hukum2 = await buatPengguna(tenantId, 'hukum2', {
    HEALTH: BACA,
    HEALTH_LEGAL_HOLD: ['READ', 'CREATE', 'DELETE'],
  });
  const rekamMedis = await buatPengguna(tenantId, 'rekammedis', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_INFO_RELEASE: ['READ', 'EXPORT'],
  });
  const perawat = await buatPengguna(tenantId, 'perawat', {
    HEALTH: BACA,
    HEALTH_SAFETY: ['READ', 'CREATE'],
  });
  const mutu = await buatPengguna(tenantId, 'mutu', {
    HEALTH: BACA,
    HEALTH_SAFETY: ['READ', 'CREATE', 'UPDATE', 'APPROVE'],
    HEALTH_QUALITY: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_HIM_CODING: BACA,
  });

  log('');
  log('Tujuh pengguna. Koder TIDAK diberi VERIFY, verifikator TIDAK diberi CREATE,');
  log('petugas hukum TIDAK diberi EXPORT, perawat hanya diberi hak melapor insiden —');
  log('keempatnya justru pemisahan yang hendak dibuktikan naskah ini.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti HIM','HOSPITAL') RETURNING id`,
      [`BKHM-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti HIM','Asia/Jakarta') RETURNING id`,
      [typeId, `HM-${tag}`],
    )
  )[0].id;

  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,'1980-02-02','FEMALE') RETURNING id`,
      [`Dewi Bukti HIM ${tag}`, `EPI-HM-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  const providerId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_provider (code, full_name, provider_type)
       VALUES ($1,'dr. Bukti HIM','DOCTOR') RETURNING id`,
      [`DRHM-${tag}`],
    )
  )[0].id;

  // Kunjungan rawat jalan dengan satu catatan belum ditandatangani.
  const encounterId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_encounter
         (patient_id, facility_id, encounter_number, encounter_type, provider_id)
       VALUES ($1,$2,$3,'OUTPATIENT',$4) RETURNING id`,
      [pasien, facilityId, `ENCHM-${tag}`, providerId],
    )
  )[0].id;

  await q(
    `INSERT INTO "${SCHEMA}".clinical_note (encounter_id, patient_id, note_type, subjective)
     VALUES ($1,$2,'SOAP','Nyeri perut sejak dua hari.')`,
    [encounterId, pasien],
  );

  // Terminologi ICD-10 dengan satu kode yang sudah dicabut.
  const snapshotId = (
    await q(
      `INSERT INTO "${SCHEMA}".terminology_snapshot
         (system, version, source_file, source_hash, imported_by, activated_by,
          activated_at, is_active, code_count)
       VALUES ('ICD10',$1,'bukti.csv','abc123',$2,$3,now(),FALSE,3) RETURNING id`,
      [`BUKTI-${tag}`, koder.subjectId, verifikator.subjectId],
    )
  )[0].id;

  // Menonaktifkan snapshot ICD10 lain supaya indeks unik parsial tidak bentrok.
  await q(
    `UPDATE "${SCHEMA}".terminology_snapshot SET is_active = FALSE
      WHERE system = 'ICD10' AND id <> $1`,
    [snapshotId],
  );
  await q(`UPDATE "${SCHEMA}".terminology_snapshot SET is_active = TRUE WHERE id = $1`, [snapshotId]);

  await q(
    `INSERT INTO "${SCHEMA}".terminology_code (snapshot_id, system, code, display, deprecated_at, replaced_by)
     VALUES ($1,'ICD10','K29.7','Gastritis, tidak spesifik',NULL,NULL),
            ($1,'ICD10','A09.9','Gastroenteritis infeksius',NULL,NULL),
            ($1,'ICD10','Z00.0','Pemeriksaan umum','2025-01-01','Z00.00')`,
    [snapshotId],
  );

  // --- 1. Kelengkapan berkas -----------------------------------------------
  log('');
  log('1. Kekurangan berkas dilaporkan NAMANYA, bukan sebagai persentase');
  const periksa1 = await api(
    '/health/him/records/check',
    { method: 'POST', body: JSON.stringify({ encounterId }) },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pemeriksaan kelengkapan berjalan', periksa1.status === 201 || periksa1.status === 200,
    `status ${periksa1.status} ${pesan(periksa1)}`);
  check('berkas belum lengkap', periksa1.data?.complete === false);
  check('kekurangan disebut namanya',
    (periksa1.data?.deficiencies ?? []).some((d) => d.type === 'MISSING_PRINCIPAL_DIAGNOSIS'),
    JSON.stringify((periksa1.data?.deficiencies ?? []).map((d) => d.type)));
  check('catatan yang belum ditandatangani ikut dilaporkan',
    (periksa1.data?.deficiencies ?? []).some((d) => d.type === 'UNSIGNED_NOTE'));
  check('setiap kekurangan menyebut siapa yang memperbaikinya',
    (periksa1.data?.deficiencies ?? []).every((d) => Boolean(d.responsibleRole)));

  const codingId = periksa1.data?.id;

  const kodeSebelumLengkap = await api(
    `/health/him/coding/${codingId}/code`,
    {
      method: 'POST',
      body: JSON.stringify({
        items: [{ itemType: 'DIAGNOSIS', code: 'K29.7', codeSystem: 'ICD10', isPrincipal: true }],
      }),
    },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('mengode berkas yang belum lengkap DITOLAK', kodeSebelumLengkap.status === 422,
    `status ${kodeSebelumLengkap.status}`);
  check('penahannya disebutkan satu per satu',
    (kodeSebelumLengkap.body?.error?.details?.blockers ?? []).length > 0 ||
      pesan(kodeSebelumLengkap).includes('Diagnosis utama'));

  // --- 2. Melengkapi berkas -------------------------------------------------
  log('');
  log('2. Setelah berkas dilengkapi, kekurangannya ditutup — bukan menggantung');
  await q(
    `UPDATE "${SCHEMA}".clinical_note SET signed_at = now(), signed_by = $2
      WHERE encounter_id = $1`,
    [encounterId, providerId],
  );
  await q(
    `INSERT INTO "${SCHEMA}".encounter_diagnosis
       (encounter_id, patient_id, description, diagnosis_role)
     VALUES ($1,$2,'Gastritis akut','PRIMARY')`,
    [encounterId, pasien],
  );

  const periksa2 = await api(
    '/health/him/records/check',
    { method: 'POST', body: JSON.stringify({ encounterId }) },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  const sisa = periksa2.data?.deficiencies ?? [];
  check('tidak ada lagi yang MENAHAN pengkodean', periksa2.data?.blockingCount === 0,
    JSON.stringify(sisa.map((d) => `${d.type}:${d.blocksCoding}`)));
  check('yang tersisa hanya pekerjaan koder itu sendiri',
    sisa.length > 0 && sisa.every((d) => d.responsibleRole === 'HEALTH_CODER'),
    JSON.stringify(sisa.map((d) => d.type)));
  check('dan pekerjaan koder tidak menahan koder bekerja',
    sisa.every((d) => d.blocksCoding === false));

  const ditutup = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".him_deficiency
      WHERE coding_id = $1 AND resolved_at IS NOT NULL`,
    [codingId],
  );
  check('kekurangan lama ditutup dengan waktunya, bukan dihapus', ditutup[0].n >= 2,
    `${ditutup[0].n} baris ditutup`);

  // --- 3. Pengkodean --------------------------------------------------------
  log('');
  log('3. Pengkodean — satu diagnosis utama, dan kode yang dicabut ditolak');
  const duaUtama = await api(
    `/health/him/coding/${codingId}/code`,
    {
      method: 'POST',
      body: JSON.stringify({
        items: [
          { itemType: 'DIAGNOSIS', code: 'K29.7', codeSystem: 'ICD10', isPrincipal: true },
          { itemType: 'DIAGNOSIS', code: 'A09.9', codeSystem: 'ICD10', isPrincipal: true },
        ],
      }),
    },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('dua diagnosis utama DITOLAK', duaUtama.status === 422, `status ${duaUtama.status}`);
  check('penolakannya menyebut urutan baris bukan keputusan klinis',
    pesan(duaUtama).includes('urutan baris'));

  const kodeDicabut = await api(
    `/health/him/coding/${codingId}/code`,
    {
      method: 'POST',
      body: JSON.stringify({
        items: [{ itemType: 'DIAGNOSIS', code: 'Z00.0', codeSystem: 'ICD10', isPrincipal: true }],
      }),
    },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('kode yang sudah DICABUT ditolak', kodeDicabut.status === 422,
    `status ${kodeDicabut.status}`);
  check('penolakannya menyebut penggantinya', pesan(kodeDicabut).includes('Z00.00'));

  const kode = await api(
    `/health/him/coding/${codingId}/code`,
    {
      method: 'POST',
      body: JSON.stringify({
        items: [
          { itemType: 'DIAGNOSIS', code: 'K29.7', codeSystem: 'ICD10', isPrincipal: true },
          { itemType: 'DIAGNOSIS', code: 'A09.9', codeSystem: 'ICD10', isPrincipal: false },
        ],
      }),
    },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pengkodean yang sah berhasil', kode.status === 200 || kode.status === 201,
    `status ${kode.status} ${pesan(kode)}`);

  const versiTersimpan = await q(
    `SELECT DISTINCT code_version FROM "${SCHEMA}".him_coded_item WHERE coding_id = $1`,
    [codingId],
  );
  check('versi terminologi DISALIN ke tiap baris kode',
    versiTersimpan.length === 1 && versiTersimpan[0].code_version === `BUKTI-${tag}`,
    JSON.stringify(versiTersimpan));

  const tembusDuaUtama = await gagal(
    `INSERT INTO "${SCHEMA}".him_coded_item
       (coding_id, item_type, code, code_system, code_version, is_principal)
     VALUES ($1,'DIAGNOSIS','K29.9','ICD10','x',TRUE)`,
    [codingId],
  );
  check('menembus dua diagnosis utama lewat basis data pun ditolak indeks unik',
    (tembusDuaUtama ?? '').includes('ux_him_coded_one_principal'), tembusDuaUtama ?? 'lolos');

  const periksa3 = await api(
    '/health/him/records/check',
    { method: 'POST', body: JSON.stringify({ encounterId }) },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('setelah dikode, berkas dinyatakan lengkap', periksa3.data?.complete === true,
    JSON.stringify((periksa3.data?.deficiencies ?? []).map((d) => d.type)));

  // --- 4. Verifikasi --------------------------------------------------------
  log('');
  log('4. Koder tidak memverifikasi pengkodeannya sendiri');
  const verifSendiri = await api(
    `/health/him/coding/${codingId}/verify`,
    { method: 'POST', body: JSON.stringify({ approve: true }) },
    koder.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('koder tidak berwenang memverifikasi sama sekali', verifSendiri.status === 403,
    `status ${verifSendiri.status}`);

  const kembalikanTanpaAlasan = await api(
    `/health/him/coding/${codingId}/verify`,
    { method: 'POST', body: JSON.stringify({ approve: false }) },
    verifikator.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pengembalian tanpa keterangan ditolak', kembalikanTanpaAlasan.status === 422,
    `status ${kembalikanTanpaAlasan.status}`);

  const verifikasi = await api(
    `/health/him/coding/${codingId}/verify`,
    { method: 'POST', body: JSON.stringify({ approve: true }) },
    verifikator.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('verifikator memverifikasi', verifikasi.status === 200 || verifikasi.status === 201,
    `status ${verifikasi.status} ${pesan(verifikasi)}`);

  // --- 5. Penahanan hukum ---------------------------------------------------
  log('');
  log('5. Penahanan hukum menahan PERUBAHAN, bukan pembacaan');

  /*
   * Catatan yang BELUM ditandatangani, sengaja.
   *
   * Catatan yang sudah ditandatangani sudah dikunci trigger H-3, dan trigger itu
   * berjalan lebih dahulu menurut urutan abjad namanya. Memakai catatan
   * bertandatangan di sini akan membuat naskah ini lulus tanpa penahanan hukum
   * pernah diuji sama sekali.
   */
  const catatanBebas = (
    await q(
      `INSERT INTO "${SCHEMA}".clinical_note (encounter_id, patient_id, note_type, subjective)
       VALUES ($1,$2,'PROGRESS','Keluhan berkurang setelah obat lambung.') RETURNING id`,
      [encounterId, pasien],
    )
  )[0].id;

  const kendali = await gagal(
    `UPDATE "${SCHEMA}".clinical_note SET objective = 'sebelum penahanan' WHERE id = $1`,
    [catatanBebas],
  );
  check('sebelum penahanan, catatan itu memang dapat diubah', kendali === null,
    kendali ?? '');

  const tahan = await api(
    '/health/him/legal-holds',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: pasien, encounterId,
        reason: 'Perkara perdata nomor 123/Pdt.G/2026 di Pengadilan Negeri.',
        caseReference: '123/Pdt.G/2026',
      }),
    },
    hukum.token,
    { ...HUKUM, 'x-facility-id': facilityId },
  );
  check('penahanan dipasang', tahan.status === 201, `status ${tahan.status} ${pesan(tahan)}`);

  const ubahCatatan = await gagal(
    `UPDATE "${SCHEMA}".clinical_note SET objective = 'diubah' WHERE id = $1`,
    [catatanBebas],
  );
  check('kini catatan yang sama DITOLAK, dan justru oleh penahanannya',
    (ubahCatatan ?? '').includes('ditahan untuk keperluan hukum'), ubahCatatan ?? 'lolos');

  const ubahDiagnosis = await gagal(
    `UPDATE "${SCHEMA}".encounter_diagnosis SET description = 'diubah' WHERE encounter_id = $1`,
    [encounterId],
  );
  check('mengubah diagnosis DITOLAK oleh penahanan pula',
    (ubahDiagnosis ?? '').includes('ditahan untuk keperluan hukum'), ubahDiagnosis ?? 'lolos');

  const hapusDiagnosis = await gagal(
    `DELETE FROM "${SCHEMA}".encounter_diagnosis WHERE encounter_id = $1`,
    [encounterId],
  );
  check('menghapusnya pun ditolak', (hapusDiagnosis ?? '').includes('ditahan untuk keperluan hukum'),
    hapusDiagnosis ?? 'lolos');

  const bacaCatatan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".clinical_note WHERE encounter_id = $1`,
    [encounterId],
  );
  check('PEMBACAAN tetap diizinkan', bacaCatatan[0].n > 0);

  const status = await api(
    `/health/him/legal-holds/${pasien}`,
    {},
    hukum.token,
  );
  check('status penahanan terbaca', status.status === 200);
  check('dan menyatakan rekamnya tidak dapat diubah', status.data?.canAmend === false);

  const cabutSendiri = await api(
    `/health/him/legal-holds/${tahan.data?.id}/release`,
    { method: 'POST', body: JSON.stringify({ reason: 'Perkara selesai.' }) },
    hukum.token,
    { ...HUKUM, 'x-facility-id': facilityId },
  );
  check('yang memasang penahanan TIDAK mencabutnya sendiri', cabutSendiri.status === 409,
    `status ${cabutSendiri.status}`);

  const cabut = await api(
    `/health/him/legal-holds/${tahan.data?.id}/release`,
    { method: 'POST', body: JSON.stringify({ reason: 'Perkara telah berkekuatan hukum tetap.' }) },
    hukum2.token,
    { ...HUKUM, 'x-facility-id': facilityId },
  );
  check('petugas kedua mencabutnya', cabut.status === 200 || cabut.status === 201,
    `status ${cabut.status} ${pesan(cabut)}`);

  const ubahSetelahCabut = await gagal(
    `UPDATE "${SCHEMA}".clinical_note SET objective = 'boleh sekarang' WHERE id = $1`,
    [catatanBebas],
  );
  check('setelah dicabut, perubahan kembali diizinkan', ubahSetelahCabut === null,
    ubahSetelahCabut ?? '');

  // --- 6. Pelepasan informasi ----------------------------------------------
  log('');
  log('6. Pelepasan informasi — yang menentukan dasar hukumnya, bukan pemintanya');
  const polisiTanpaSurat = await api(
    '/health/him/releases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: pasien, facilityId, requesterType: 'POLICE',
        requesterName: 'Polsek Bukti', purpose: 'Penyidikan',
        requestedScope: ['resume medis'], hasLegalBasis: true,
      }),
    },
    hukum.token,
    HUKUM,
  );
  check('kepolisian tanpa nomor surat DITOLAK', polisiTanpaSurat.data?.decision === 'REJECTED',
    JSON.stringify(polisiTanpaSurat.data?.decision));

  const polisi = await api(
    '/health/him/releases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: pasien, facilityId, requesterType: 'POLICE',
        requesterName: 'Polsek Bukti', purpose: 'Penyidikan',
        requestedScope: ['resume medis'], hasLegalBasis: true,
        legalBasisDocument: 'SP/456/VIII/2026',
      }),
    },
    hukum.token,
    HUKUM,
  );
  check('dengan nomor surat, disetujui', polisi.data?.decision === 'APPROVED');

  const pemberiKerja = await api(
    '/health/him/releases',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId: pasien, facilityId, requesterType: 'EMPLOYER',
        requesterName: 'PT Bukti', purpose: 'Klaim asuransi karyawan',
        requestedScope: ['surat keterangan sakit'], hasPatientConsent: true,
      }),
    },
    hukum.token,
    HUKUM,
  );
  check('pemberi kerja menerima yang TERSAMARKAN meski pasien menyetujui',
    pemberiKerja.data?.decision === 'APPROVED' && pemberiKerja.data?.requiresRedaction === true,
    JSON.stringify(pemberiKerja.data));

  const lepasSendiri = await api(
    `/health/him/releases/${polisi.data?.id}/release`,
    { method: 'POST', body: JSON.stringify({ releasedScope: ['resume medis'] }) },
    hukum.token,
    { ...HUKUM, 'x-facility-id': facilityId },
  );
  check('yang MEMUTUSKAN pelepasan tidak menyerahkan berkasnya sendiri',
    lepasSendiri.status === 403, `status ${lepasSendiri.status}`);

  const lepas = await api(
    `/health/him/releases/${polisi.data?.id}/release`,
    { method: 'POST', body: JSON.stringify({ releasedScope: ['resume medis'] }) },
    rekamMedis.token,
    { ...HUKUM, 'x-facility-id': facilityId },
  );
  check('petugas rekam medis menyerahkannya, dan mencatat apa yang BENAR-BENAR dilepas',
    lepas.status === 200 || lepas.status === 201, `status ${lepas.status} ${pesan(lepas)}`);

  const hapusCatatan = await gagal(
    `DELETE FROM "${SCHEMA}".him_information_release WHERE id = $1`,
    [polisi.data?.id],
  );
  check('catatan pelepasan tidak dapat dihapus',
    (hapusCatatan ?? '').includes('LEDGER_IMMUTABLE'), hapusCatatan ?? 'lolos');

  // --- 7. Keselamatan pasien -----------------------------------------------
  log('');
  log('7. Keselamatan pasien — pelaporan longgar, penutupan ketat');
  const nyaris = await api(
    '/health/him/incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, incidentType: 'MEDICATION_ERROR',
        occurredAt: new Date().toISOString(),
        description: 'Resep tertulis dosis sepuluh kali lipat, tertangkap apoteker sebelum diserahkan.',
        harmLevel: 'NEAR_MISS', reachedPatient: false,
      }),
    },
    perawat.token,
    MUTU,
  );
  check('perawat dapat melaporkan insiden', nyaris.status === 201,
    `status ${nyaris.status} ${pesan(nyaris)}`);
  check('nyaris cedera bertingkat BLUE', nyaris.data?.grade === 'BLUE');
  check('tetapi TETAP ditelaah', (nyaris.data?.reviewDueHours ?? 0) > 0);
  check('dan sebabnya disebutkan', String(nyaris.data?.message ?? '').includes('sebelum ada yang terluka'));

  const anonim = await api(
    '/health/him/incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, incidentType: 'STAFFING',
        occurredAt: new Date().toISOString(),
        description: 'Satu perawat menjaga dua puluh pasien pada dinas malam.',
        harmLevel: 'NEAR_MISS', reachedPatient: false, anonymous: true,
      }),
    },
    perawat.token,
    MUTU,
  );
  check('pelaporan anonim diterima', anonim.status === 201, `status ${anonim.status}`);
  const anonimTersimpan = await q(
    `SELECT reported_by, is_anonymous FROM "${SCHEMA}".safety_incident WHERE id = $1`,
    [anonim.data?.id],
  );
  check('dan pelapornya benar-benar tidak tercatat',
    anonimTersimpan[0].reported_by === null && anonimTersimpan[0].is_anonymous === true);

  const berat = await api(
    '/health/him/incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: pasien, incidentType: 'PATIENT_FALL',
        occurredAt: new Date().toISOString(),
        description: 'Pasien jatuh dari tempat tidur, mengalami patah tulang panggul.',
        harmLevel: 'SEVERE', reachedPatient: true,
      }),
    },
    perawat.token,
    MUTU,
  );
  check('cedera berat dinyatakan sentinel', berat.data?.grade === 'RED');
  check('menuntut telaah akar masalah dalam 24 jam', berat.data?.reviewDueHours === 24);
  check('dan pelaporan ke luar', berat.data?.requiresExternalReport === true);

  const tutupTanpaTindakan = await api(
    `/health/him/incidents/${berat.data?.id}/close`,
    { method: 'POST', body: JSON.stringify({ rcaSummary: 'Pagar tempat tidur tidak terpasang.' }) },
    mutu.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('menutup tanpa tindakan perbaikan DITOLAK', tutupTanpaTindakan.status === 422,
    `status ${tutupTanpaTindakan.status}`);
  check('penolakannya berkata akan terjadi lagi',
    pesan(tutupTanpaTindakan).includes('akan terjadi lagi'));

  await api(
    `/health/him/incidents/${berat.data?.id}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'Pemeriksaan pagar tempat tidur pada setiap serah terima dinas.',
        actionType: 'PROCESS',
      }),
    },
    mutu.token,
    MUTU,
  );

  const pelaporMenutup = await api(
    `/health/him/incidents/${berat.data?.id}/close`,
    { method: 'POST', body: JSON.stringify({ rcaSummary: 'Pagar tempat tidur tidak terpasang.' }) },
    perawat.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('perawat pelapor tidak berwenang menutup', pelaporMenutup.status === 403,
    `status ${pelaporMenutup.status}`);

  /*
   * Yang di atas hanya membuktikan hak akses. Yang berikut membuktikan
   * pemisahannya: petugas mutu yang BERWENANG menutup, tetapi melaporkan
   * kejadiannya sendiri, tetap ditolak.
   */
  const beratSendiri = await api(
    '/health/him/incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, incidentType: 'WRONG_SITE_SURGERY',
        occurredAt: new Date().toISOString(),
        description: 'Penandaan sisi operasi terlewat; tertangkap saat time-out, tindakan dihentikan.',
        harmLevel: 'MODERATE', reachedPatient: true,
      }),
    },
    mutu.token,
    MUTU,
  );
  check('petugas mutu melaporkan kejadiannya sendiri', beratSendiri.status === 201,
    `status ${beratSendiri.status} ${pesan(beratSendiri)}`);
  check('cedera sedang bertingkat YELLOW', beratSendiri.data?.grade === 'YELLOW');

  await api(
    `/health/him/incidents/${beratSendiri.data?.id}/actions`,
    {
      method: 'POST',
      body: JSON.stringify({ action: 'Penandaan sisi wajib sebelum pasien meninggalkan ruang rawat.' }),
    },
    mutu.token,
    MUTU,
  );

  const tutupSendiri = await api(
    `/health/him/incidents/${beratSendiri.data?.id}/close`,
    { method: 'POST', body: JSON.stringify({ rcaSummary: 'Penandaan sisi tidak masuk daftar periksa ruangan.' }) },
    mutu.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('yang berwenang menutup pun ditolak bila ia PELAPORNYA', tutupSendiri.status === 422,
    `status ${tutupSendiri.status}`);
  check('penolakannya berkata telaah oleh pihak yang terlibat bukan telaah',
    pesan(tutupSendiri).includes('bukan telaah'));

  const tembusTutupSendiri = await gagal(
    `UPDATE "${SCHEMA}".safety_incident
        SET closed_at = now(), closed_by = reported_by,
            rca_completed_at = now(), rca_summary = 'x'
      WHERE id = $1`,
    [beratSendiri.data?.id],
  );
  check('menembusnya lewat basis data pun ditolak constraint',
    (tembusTutupSendiri ?? '').includes('safety_close_not_self'), tembusTutupSendiri ?? 'lolos');

  const tutup = await api(
    `/health/him/incidents/${berat.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({
        rcaSummary: 'Pagar tempat tidur tidak terpasang; tidak ada pemeriksaan pada serah terima.',
        closureNote: 'Tindakan perbaikan sudah berjalan dua pekan.',
      }),
    },
    mutu.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('petugas mutu menutupnya', tutup.status === 200 || tutup.status === 201,
    `status ${tutup.status} ${pesan(tutup)}`);

  const hapusInsiden = await gagal(
    `DELETE FROM "${SCHEMA}".safety_incident WHERE id = $1`, [berat.data?.id],
  );
  check('laporan insiden tidak dapat dihapus',
    (hapusInsiden ?? '').includes('LEDGER_IMMUTABLE'), hapusInsiden ?? 'lolos');

  const nyarisSampai = await gagal(
    `INSERT INTO "${SCHEMA}".safety_incident
       (incident_number, facility_id, incident_type, occurred_at, description,
        harm_level, reached_patient, grade)
     VALUES ($1,$2,'X',now(),'Uraian sepuluh huruf lebih','NEAR_MISS',TRUE,'BLUE')`,
    [`IKPX-${tag}`, facilityId],
  );
  check('nyaris cedera yang "sampai ke pasien" ditolak constraint',
    (nyarisSampai ?? '').includes('safety_near_miss_not_reached'), nyarisSampai ?? 'lolos');

  // --- 8. Papan dan mutu ----------------------------------------------------
  log('');
  log('8. Papan insiden dan indikator mutu');
  const papan = await api(`/health/him/incidents?facilityId=${facilityId}`, {}, mutu.token);
  check('papan insiden terbaca', papan.status === 200, `status ${papan.status}`);
  check('yang belum ditutup berada di atas',
    (papan.data ?? [])[0]?.closed_at === null,
    JSON.stringify((papan.data ?? []).slice(0, 2).map((r) => r.incident_number)));

  const indikatorId = (
    await q(
      `INSERT INTO "${SCHEMA}".quality_indicator
         (facility_id, code, name, numerator_definition, denominator_definition,
          direction, target_value)
       VALUES ($1,$2,'Kelengkapan resume pulang 1x24 jam',
               'Resume selesai dalam 24 jam','Seluruh pemulangan','HIGHER_IS_BETTER',80)
       RETURNING id`,
      [facilityId, `QI-${tag}`],
    )
  )[0].id;

  const ukur = await api(
    '/health/him/quality/measurements',
    {
      method: 'POST',
      body: JSON.stringify({
        indicatorId: indikatorId, periodYear: 2026, periodMonth: 8, numerator: 85, denominator: 100,
      }),
    },
    mutu.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('pengukuran indikator tercatat', ukur.status === 201 || ukur.status === 200,
    `status ${ukur.status} ${pesan(ukur)}`);
  check('target tercapai dinilai benar', ukur.data?.meetsTarget === true);

  const ukurNol = await api(
    '/health/him/quality/measurements',
    {
      method: 'POST',
      body: JSON.stringify({
        indicatorId: indikatorId, periodYear: 2026, periodMonth: 9, numerator: 0, denominator: 0,
      }),
    },
    mutu.token,
    { ...MUTU, 'x-facility-id': facilityId },
  );
  check('PENYEBUT NOL tidak menghasilkan nol', ukurNol.data?.value === null,
    JSON.stringify(ukurNol.data?.value));
  check('melainkan menyatakan belum ada datanya',
    String(ukurNol.data?.message ?? '').includes('belum ada datanya'));

  const pembilangLebih = await gagal(
    `INSERT INTO "${SCHEMA}".quality_measurement
       (indicator_id, period_year, period_month, numerator, denominator)
     VALUES ($1,2026,10,150,100)`,
    [indikatorId],
  );
  check('pembilang melebihi penyebut ditolak constraint',
    (pembilangLebih ?? '').includes('quality_measure_ratio_sane'), pembilangLebih ?? 'lolos');

  const papanMutu = await api(
    `/health/him/quality/dashboard?facilityId=${facilityId}&year=2026`,
    {},
    mutu.token,
  );
  check('papan mutu terbaca', papanMutu.status === 200, `status ${papanMutu.status}`);
  check('kelengkapan rekam medis ikut dilaporkan',
    typeof papanMutu.data?.recordCompleteness?.score === 'number');

  // --- 9. Jejak -------------------------------------------------------------
  log('');
  log('9. Jejak dan tujuan penggunaan');
  const tanpaTujuan = await api(
    '/health/him/records/check',
    { method: 'POST', body: JSON.stringify({ encounterId }) },
    koder.token,
  );
  check('memeriksa berkas tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [pasien],
  );
  check('jejak pembacaan tercatat', jejak[0].n > 0, `${jejak[0].n} baris`);

  const jejakEkspor = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log
      WHERE patient_id = $1 AND action = 'EXPORT'`,
    [pasien],
  );
  check('pelepasan informasi tercatat sebagai EKSPOR, bukan pembacaan biasa',
    jejakEkspor[0].n > 0, `${jejakEkspor[0].n} baris`);

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
    new URL('../../../docs/emedik/bukti-h9-rekam-medis.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
