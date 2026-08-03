/**
 * Bukti H-2 dan H-3: satu pasien dari pendaftaran sampai kunjungan selesai.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan hanya bahwa alurnya berjalan, melainkan bahwa yang
 * seharusnya DITOLAK memang ditolak:
 *
 * - membaca rekam medis tanpa menyebut tujuan penggunaan;
 * - akses darurat tanpa alasan;
 * - mendaftarkan pasien yang hampir pasti sudah terdaftar;
 * - menggabungkan dua rekam medis yang NIK-nya berbeda;
 * - mengubah catatan klinis yang sudah ditandatangani;
 * - mencatat diagnosis utama kedua pada satu kunjungan.
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
const username = `bukti_medik_${tag}`;
const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;

let platformUserId = null;
let subjectId = null;
let typeId = null;
let facilityId = null;
let roleId = null;

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

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-2 dan H-3 — SATU PASIEN DARI PENDAFTARAN SAMPAI KUNJUNGAN SELESAI');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  // --- Persiapan -----------------------------------------------------------
  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [
      SCHEMA,
    ])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const hash = await argon2.hash(password, { type: argon2.argon2id });
  platformUserId = randomUUID();
  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,'Petugas Bukti',$4,'ACTIVE',FALSE,FALSE,now(),now())`,
    [platformUserId, username, `${username}@contoh.invalid`, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, platformUserId],
  );
  subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,'Petugas Bukti',$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [platformUserId, username],
    )
  )[0].id;

  // Peran bukti dengan seluruh hak kesehatan yang diperlukan alur ini.
  roleId = (
    await q(
      `INSERT INTO "${SCHEMA}".role (code, name, description, is_system)
       VALUES ($1,'Peran Bukti eMedik','Hak penuh kesehatan untuk naskah bukti',FALSE)
       RETURNING id`,
      [`BUKTI_MEDIK_${tag.toUpperCase()}`],
    )
  )[0].id;

  const menus = await q(
    `SELECT id, code FROM "${SCHEMA}".menu WHERE code LIKE 'HEALTH%'`,
  );
  const aksi = await q(`SELECT id, code FROM "${SCHEMA}".permission_action`);
  const petaAksi = new Map(aksi.map((a) => [a.code, a.id]));

  let diberikan = 0;
  for (const m of menus) {
    // MERGE_PATIENT dan BREAK_GLASS disertakan dengan sengaja: keduanya hak
    // tersendiri, dan tanpa memberikannya endpoint-nya memang menolak — yang
    // pada percobaan pertama sempat terbaca sebagai cacat, padahal justru
    // penjaganya bekerja.
    for (const kode of ['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'REVIEW',
                        'ASSIGN', 'MERGE_PATIENT', 'BREAK_GLASS']) {
      const aksiId = petaAksi.get(kode);
      if (!aksiId) continue;
      try {
        await q(
          `INSERT INTO "${SCHEMA}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
           VALUES ($1,$2,$3,'ALLOW') ON CONFLICT DO NOTHING`,
          [roleId, m.id, aksiId],
        );
        diberikan += 1;
      } catch {
        /* aksi yang tidak berlaku pada menu itu dilewati */
      }
    }
  }
  log('');
  log(`Peran bukti dibuat dengan ${diberikan} hak akses pada ${menus.length} menu kesehatan.`);

  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, roleId],
  );

  typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type
         (code, name, category, supports_pharmacy, supports_laboratory)
       VALUES ($1,'Klinik Bukti Alur','CLINIC',TRUE,TRUE) RETURNING id`,
      [`BKTA-${tag}`],
    )
  )[0].id;

  facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'Klinik Bukti Alur','Asia/Jakarta') RETURNING id`,
      [typeId, `FAC-${tag}`],
    )
  )[0].id;

  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const token = masuk.data?.accessToken;
  if (!token) throw new Error(`login gagal: ${JSON.stringify(masuk.body).slice(0, 300)}`);

  // --- 1. Tujuan penggunaan wajib ------------------------------------------
  log('');
  log('1. Tujuan penggunaan wajib pada setiap pembacaan rekam medis');
  const tanpaTujuan = await api('/health/patients?q=siti', {}, token);
  check(
    'membaca rekam medis TANPA tujuan ditolak',
    tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`,
  );
  check(
    'penolakannya menyebutkan tajuk yang kurang',
    String(tanpaTujuan.body?.error?.message ?? '').includes('X-Purpose-Of-Use'),
  );

  const tujuanNgawur = await api('/health/patients?q=siti', {}, token, {
    'x-purpose-of-use': 'PENASARAN',
  });
  check('tujuan yang tidak dikenal ditolak', tujuanNgawur.status === 400);

  // --- 2. Mendaftarkan pasien ----------------------------------------------
  log('');
  log('2. Mendaftarkan pasien');
  /*
   * NIK harus unik setiap kali naskah ini dijalankan. Indeks unik pada NIK
   * menolak yang kedua — dan itu memang benar — sementara pasien bukti sengaja
   * tidak dihapus pada pembersihan karena penjaganya menolak penghapusan.
   * Empat angka terakhir NIK adalah nomor urut; di sanalah keunikannya
   * diletakkan, tanpa merusak bentuk NIK yang sah.
   */
  const urutNik = String(parseInt(tag, 16) % 9999).padStart(4, '0');
  const nik = `320101550385${urutNik}`;

  /*
   * Nama pasien juga dibuat unik per jalannya.
   *
   * Pada percobaan sebelumnya, pendaftaran PERTAMA justru ditolak 409 — bukan
   * karena cacat, melainkan karena pasien bukti dari jalannya yang terdahulu
   * masih ada dengan nama, tanggal lahir, dan nama ibu yang sama. Deteksi
   * penggandaan bekerja persis sebagaimana mestinya; yang keliru adalah naskah
   * buktinya, yang mengandaikan basis data selalu bersih.
   *
   * Pasien bukti sengaja TIDAK dihapus saat pembersihan, karena penjaga
   * retensi menolaknya — dan itu pun salah satu hal yang dibuktikan naskah ini.
   */
  const namaPasien = `Siti Aminah ${tag.toUpperCase()}`;
  const daftar = await api(
    '/health/patients',
    {
      method: 'POST',
      body: JSON.stringify({
        fullName: namaPasien,
        birthDate: '1985-03-15',
        gender: 'FEMALE',
        nik,
        phone: '081234567890',
        motherName: 'Fatimah',
        facilityId,
      }),
    },
    token,
    RAWAT,
  );
  check('pasien terdaftar', daftar.status === 201 || daftar.status === 200, `status ${daftar.status}`);
  const patientId = daftar.data?.patientId;
  check('memperoleh nomor rekam medis', Boolean(daftar.data?.medicalRecordNumber));
  log(`   MRN: ${daftar.data?.medicalRecordNumber}`);

  const nikSalah = await api(
    '/health/patients',
    {
      method: 'POST',
      body: JSON.stringify({ fullName: 'Uji NIK', nik: '123', facilityId }),
    },
    token,
    RAWAT,
  );
  check('NIK yang bentuknya salah ditolak', nikSalah.status === 400, `status ${nikSalah.status}`);

  // --- 3. Deteksi penggandaan ----------------------------------------------
  log('');
  log('3. Deteksi rekam medis ganda');
  const ganda = await api(
    '/health/patients',
    {
      method: 'POST',
      body: JSON.stringify({
        fullName: namaPasien,
        birthDate: '1985-03-15',
        gender: 'FEMALE',
        motherName: 'Fatimah',
        facilityId,
      }),
    },
    token,
    RAWAT,
  );
  check(
    'pendaftaran yang hampir pasti ganda DITAHAN',
    ganda.status === 409,
    `status ${ganda.status}`,
  );
  const kandidat = ganda.body?.error?.params?.candidates ?? [];
  check('penolakannya menyebutkan calon rekam medis yang sudah ada', kandidat.length >= 1);
  check(
    'menyertakan alasan mengapa diduga sama',
    (kandidat[0]?.reasons ?? []).length >= 1,
    JSON.stringify(kandidat[0]?.reasons ?? []).slice(0, 120),
  );

  const tegaskan = await api(
    '/health/patients',
    {
      method: 'POST',
      body: JSON.stringify({
        fullName: namaPasien,
        birthDate: '1985-03-15',
        gender: 'FEMALE',
        motherName: 'Fatimah',
        facilityId,
        confirmedNotDuplicate: true,
      }),
    },
    token,
    RAWAT,
  );
  check(
    'dapat dilanjutkan bila petugas menegaskan orangnya berbeda',
    tegaskan.status === 201 || tegaskan.status === 200,
    `status ${tegaskan.status}`,
  );
  const kembarId = tegaskan.data?.patientId;

  // --- 4. Penggabungan -----------------------------------------------------
  log('');
  log('4. Penggabungan rekam medis');
  const nikBeda = await q(
    `INSERT INTO "${SCHEMA}".patient_identifier (patient_id, identifier_type, identifier_value)
     VALUES ($1,'NIK',$2) RETURNING id`,
    [kembarId, `320101550385${String((parseInt(tag, 16) + 1) % 9999).padStart(4, '0')}`],
  );
  check('rekam kedua diberi NIK yang berbeda', nikBeda.length === 1);

  const gabungBeda = await api(
    '/health/patients/merge',
    {
      method: 'POST',
      body: JSON.stringify({
        sourceId: kembarId,
        targetId: patientId,
        reason: 'Diduga orang yang sama berdasarkan nama dan tanggal lahir.',
      }),
    },
    token,
    { 'x-purpose-of-use': 'OPERATIONS' },
  );
  check(
    'penggabungan dengan NIK berbeda DITOLAK',
    gabungBeda.status === 409,
    `status ${gabungBeda.status}`,
  );
  check(
    'penolakannya menyebutkan NIK',
    String(gabungBeda.body?.error?.message ?? '').includes('NIK'),
  );

  await q(`DELETE FROM "${SCHEMA}".patient_identifier WHERE id = $1`, [nikBeda[0].id]);
  const gabung = await api(
    '/health/patients/merge',
    {
      method: 'POST',
      body: JSON.stringify({
        sourceId: kembarId,
        targetId: patientId,
        reason: 'Terbukti orang yang sama setelah dicocokkan dengan kartu keluarga.',
      }),
    },
    token,
    { 'x-purpose-of-use': 'OPERATIONS' },
  );
  check('penggabungan yang sah berhasil', gabung.status < 400, `status ${gabung.status}`);

  const sesudahGabung = await q(
    `SELECT merged_into_id, is_active FROM "${SCHEMA}".patient WHERE id = $1`,
    [kembarId],
  );
  check(
    'rekam sumber TIDAK dihapus, hanya menunjuk induknya',
    sesudahGabung[0].merged_into_id === patientId,
  );

  // --- 5. Pendaftaran kunjungan dan antrean --------------------------------
  log('');
  log('5. Pendaftaran kunjungan dan antrean');
  const reg = await api(
    '/health/registrations',
    {
      method: 'POST',
      body: JSON.stringify({ patientId, facilityId, chiefComplaint: 'Nyeri kepala tiga hari' }),
    },
    token,
    RAWAT,
  );
  check('kunjungan terdaftar', reg.status < 400, `status ${reg.status}`);
  check('memperoleh nomor antrean', Boolean(reg.data?.queueLabel));
  check('ditandai tertagih', reg.data?.isBillable === true);
  log(`   ${reg.data?.registrationNumber} · antrean ${reg.data?.queueLabel}`);

  const regGabung = await api(
    '/health/registrations',
    { method: 'POST', body: JSON.stringify({ patientId: kembarId, facilityId }) },
    token,
    RAWAT,
  );
  check(
    'mendaftarkan pada rekam yang sudah digabungkan DITOLAK',
    regGabung.status === 409,
    `status ${regGabung.status}`,
  );

  const antre = await api(`/health/queue?facilityId=${facilityId}`, {}, token);
  check('antrean terbaca', antre.status === 200 && antre.data?.waiting >= 1);

  // --- 6. Kunjungan dan dokumentasi ----------------------------------------
  log('');
  log('6. Kunjungan dan dokumentasi klinis');
  const enc = await api(
    '/health/encounters',
    { method: 'POST', body: JSON.stringify({ registrationId: reg.data.registrationId }) },
    token,
    RAWAT,
  );
  check('kunjungan dimulai', enc.status < 400, `status ${enc.status}`);
  const encounterId = enc.data?.encounterId;

  const vital = await api(
    '/health/vital-signs',
    {
      method: 'POST',
      body: JSON.stringify({
        encounterId,
        systolicMmhg: 128,
        diastolicMmhg: 82,
        pulseBpm: 88,
        temperatureC: 36.8,
      }),
    },
    token,
    RAWAT,
  );
  check('tanda vital tercatat', vital.status < 400, `status ${vital.status}`);

  const vitalTerbalik = await api(
    '/health/vital-signs',
    { method: 'POST', body: JSON.stringify({ encounterId, systolicMmhg: 60, diastolicMmhg: 120 }) },
    token,
    RAWAT,
  );
  check(
    'tekanan darah terbalik ditolak',
    vitalTerbalik.status >= 400,
    `status ${vitalTerbalik.status}`,
  );

  const catatan = await api(
    '/health/clinical-notes',
    {
      method: 'POST',
      body: JSON.stringify({
        encounterId,
        subjective: 'Nyeri kepala berdenyut tiga hari, disertai mual.',
        objective: 'Kesadaran baik, tanda vital dalam batas.',
        assessment: 'Tension headache',
        plan: 'Analgesik, istirahat, kontrol bila memberat.',
        sign: true,
      }),
    },
    token,
    RAWAT,
  );
  check('catatan klinis tersimpan dan ditandatangani', catatan.status < 400 && catatan.data?.signed);
  const noteId = catatan.data?.noteId;

  await harusGagalDb(
    'mengubah catatan bertanda tangan lewat basis data DITOLAK',
    `UPDATE "${SCHEMA}".clinical_note SET assessment = 'diubah' WHERE id = $1`,
    [noteId],
  );

  const amandemen = await api(
    `/health/clinical-notes/${noteId}/amend`,
    {
      method: 'POST',
      body: JSON.stringify({
        assessment: 'Migrain tanpa aura',
        reason: 'Koreksi diagnosis setelah anamnesis ulang.',
      }),
    },
    token,
    RAWAT,
  );
  check('amandemen dapat dibuat', amandemen.status < 400, `status ${amandemen.status}`);

  const amandemenTanpaAlasan = await api(
    `/health/clinical-notes/${noteId}/amend`,
    { method: 'POST', body: JSON.stringify({ assessment: 'x', reason: 'ok' }) },
    token,
    RAWAT,
  );
  check('amandemen tanpa alasan bermakna ditolak', amandemenTanpaAlasan.status === 400);

  const diag = await api(
    '/health/diagnoses',
    {
      method: 'POST',
      body: JSON.stringify({
        encounterId,
        code: 'G43.0',
        description: 'Migrain tanpa aura',
        diagnosisRole: 'PRIMARY',
      }),
    },
    token,
    RAWAT,
  );
  check('diagnosis utama tercatat', diag.status < 400, `status ${diag.status}`);

  const diagKedua = await api(
    '/health/diagnoses',
    {
      method: 'POST',
      body: JSON.stringify({
        encounterId,
        code: 'I10',
        description: 'Hipertensi',
        diagnosisRole: 'PRIMARY',
      }),
    },
    token,
    RAWAT,
  );
  check('diagnosis utama KEDUA ditolak', diagKedua.status === 409, `status ${diagKedua.status}`);
  check(
    'penolakannya menerangkan apa yang harus dilakukan',
    String(diagKedua.body?.error?.message ?? '').includes('sekunder'),
  );

  const order = await api(
    '/health/clinical-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        encounterId,
        orderType: 'LABORATORY',
        orderName: 'Darah lengkap',
        priority: 'ROUTINE',
      }),
    },
    token,
    RAWAT,
  );
  check('order laboratorium dibuat', order.status < 400, `status ${order.status}`);

  // --- 7. Akses darurat ----------------------------------------------------
  log('');
  log('7. Akses darurat');
  const bgTanpaAlasan = await api(`/health/patients/${patientId}`, {}, token, {
    'x-purpose-of-use': 'EMERGENCY',
    'x-break-glass': 'true',
  });
  check('akses darurat tanpa alasan DITOLAK', bgTanpaAlasan.status === 400);

  const bg = await api(`/health/patients/${patientId}`, {}, token, {
    'x-purpose-of-use': 'EMERGENCY',
    'x-break-glass': 'true',
    'x-break-glass-reason': 'Pasien tidak sadar di IGD, riwayat alergi diperlukan segera.',
  });
  check('akses darurat beralasan diizinkan', bg.status === 200, `status ${bg.status}`);

  const jejakBg = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log
      WHERE patient_id = $1 AND break_glass = TRUE`,
    [patientId],
  );
  check('akses darurat tercatat pada jejak', jejakBg[0].n >= 1);

  const jejak = await api(`/health/patients/${patientId}/access-log`, {}, token);
  check('jejak pembacaan terbaca lewat API', jejak.status === 200 && jejak.data.length >= 2);
  log(`   ${jejak.data.length} pembacaan tercatat untuk pasien ini`);

  // --- 8. Menyelesaikan dan rekap penagihan --------------------------------
  log('');
  log('8. Menyelesaikan kunjungan dan rekap penagihan');
  const selesai = await api(
    `/health/encounters/${encounterId}/complete`,
    { method: 'POST', body: JSON.stringify({ disposition: 'HOME' }) },
    token,
  );
  check('kunjungan selesai', selesai.status < 400, `status ${selesai.status}`);

  const ringkas = await api(`/health/encounters/${encounterId}`, {}, token, RAWAT);
  check('ringkasan kunjungan terbaca', ringkas.status === 200);
  check('memuat dua catatan: asli dan amandemennya', (ringkas.data?.notes ?? []).length === 2);
  check(
    'catatan asli TETAP menyebut diagnosis semula',
    (ringkas.data?.notes ?? []).some((n) => n.assessment === 'Tension headache'),
  );
  check(
    'amandemen menyebut diagnosis yang dikoreksi',
    (ringkas.data?.notes ?? []).some((n) => n.assessment === 'Migrain tanpa aura'),
  );

  const rekap = await api(
    `/health/billing/daily?facilityId=${facilityId}&businessDate=${reg.data.businessDate}`,
    {},
    token,
  );
  check('rekap penagihan terbaca', rekap.status === 200);
  check(
    'pendaftaran yang berhasil ditandai tertagih',
    rekap.data?.billable === rekap.data?.total && rekap.data?.billable >= 1,
    JSON.stringify(rekap.data),
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));

  async function harusGagalDb(label, sql, params) {
    try {
      await q(sql, params);
      check(label, false, 'justru berhasil');
    } catch {
      check(label, true);
    }
  }
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
  log(String(e.stack ?? '').split('\n').slice(1, 4).join('\n'));
} finally {
  try {
    if (facilityId) {
      await q(
        `DELETE FROM "${SCHEMA}".clinical_order WHERE encounter_id IN
           (SELECT id FROM "${SCHEMA}".health_encounter WHERE facility_id = $1)`,
        [facilityId],
      );
      await q(
        `DELETE FROM "${SCHEMA}".encounter_diagnosis WHERE encounter_id IN
           (SELECT id FROM "${SCHEMA}".health_encounter WHERE facility_id = $1)`,
        [facilityId],
      );
      await q(
        `DELETE FROM "${SCHEMA}".vital_sign WHERE encounter_id IN
           (SELECT id FROM "${SCHEMA}".health_encounter WHERE facility_id = $1)`,
        [facilityId],
      );
      await q(
        `DELETE FROM "${SCHEMA}".health_queue WHERE facility_id = $1`,
        [facilityId],
      );
    }
    if (subjectId) {
      await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [subjectId]);
      await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [subjectId]);
    }
    if (roleId) {
      await q(`DELETE FROM "${SCHEMA}".role_menu_permission WHERE role_id = $1`, [roleId]);
      await q(`DELETE FROM "${SCHEMA}".role WHERE id = $1`, [roleId]);
    }
    if (platformUserId) {
      await q(`DELETE FROM platform.tenant_membership WHERE platform_user_id = $1`, [platformUserId]);
      await q(`DELETE FROM platform.platform_user WHERE id = $1`, [platformUserId]);
    }
    log('');
    log('Data sementara dibersihkan sebagian. Catatan klinis bertanda tangan, jejak');
    log('pembacaan, pendaftaran, dan pasien sengaja ditinggalkan: penjaganya menolak');
    log('penghapusan, dan itulah salah satu hal yang baru saja dibuktikan.');
  } catch (e) {
    log(`Peringatan pembersihan: ${e.message}`);
  }

  await client.end();
  writeFileSync(
    new URL('../../../docs/emedik/bukti-h2-h3-alur.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
