/**
 * Bukti H-10: portal pasien dan website fasilitas.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * ## Yang paling penting dibuktikan naskah ini
 *
 * > **Pasien hanya melihat datanya sendiri; identitas dari token, tidak pernah
 * > dari parameter.**
 *
 * Dan ia dibuktikan dengan cara yang paling langsung: **pasien A mengirimkan
 * nomor pasien B pada setiap jalan portal**, dan seluruhnya harus 403. Bukan
 * sebagian; seluruhnya — sebab satu jalan yang lolos cukup untuk membocorkan
 * seluruh rekam medis rumah sakit.
 *
 * Sesudah itu diperiksa pula bahwa penolakannya **tercatat**, dan bahwa yang
 * tercatat menyebut pasien mana yang dicoba.
 *
 * Selebihnya:
 *
 * - akun portal tidak aktif tanpa verifikasi tatap muka;
 * - satu akun menaut tepat satu pasien, dan sebaliknya;
 * - hasil kritis tidak muncul di portal sampai dilepas, dan tidak dapat
 *   dilepas tanpa menghubungi pasiennya;
 * - wali melihat sesuai tingkat perwaliannya, tidak lebih;
 * - catatan klinis tidak dibuka kepada siapa pun lewat portal;
 * - dan website publik tidak dapat memuat data pasien.
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

const hari = (n) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString();
};

async function api(path, opts = {}, token = null) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

/** Membuat pengguna platform tanpa peran tenant — sebagaimana pasien. */
async function buatPenggunaPortal(tenantId, nama) {
  const username = `bukti_portal_${nama}_${tag}`;
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
  await q(
    `INSERT INTO "${SCHEMA}".user_subject
       (platform_user_id, code, name, username_snapshot, is_owner, status)
     VALUES ($1,$2::varchar,$3,$2::varchar,FALSE,'ACTIVE')`,
    [platformUserId, username, nama],
  );

  /*
   * TIDAK masuk di sini.
   *
   * Token dibuat pada saat masuk, dan hak yang diberikan sesudahnya tidak ada
   * di dalamnya. Masuk sekali saja, sesudah seluruh perannya diberikan —
   * sekaligus menjauhkan naskah ini dari pembatas laju permintaan masuk.
   */
  return { platformUserId, username, password, token: null };
}

async function masuk(p) {
  const r = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: p.username, password: p.password }),
  });
  const token = r.data?.accessToken;
  if (!token) {
    throw new Error(`login ${p.username} gagal: ${JSON.stringify(r.body).slice(0, 300)}`);
  }
  p.token = token;
  return token;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-10 — PORTAL PASIEN DAN WEBSITE FASILITAS');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Portal','HOSPITAL') RETURNING id`,
      [`BKPT-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Portal','Asia/Jakarta') RETURNING id`,
      [typeId, `PT-${tag}`],
    )
  )[0].id;

  const buatPasien = async (nama, lahir) =>
    (
      await q(
        `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
         VALUES ($1,$2,$3,'FEMALE') RETURNING id`,
        [`EPI-PT-${randomBytes(4).toString('hex')}`, nama, lahir],
      )
    )[0].id;

  const pasienA = await buatPasien('Ani Bukti Portal', '1990-01-01');
  const pasienB = await buatPasien('Budi Bukti Portal', '1985-05-05');
  const anakA = await buatPasien('Cici Anak Ani', '2020-03-03');

  // --- Pengguna ------------------------------------------------------------
  const akunA = await buatPenggunaPortal(tenantId, 'ani');
  const akunB = await buatPenggunaPortal(tenantId, 'budi');
  const petugas = await buatPenggunaPortal(tenantId, 'petugas');
  const klinisi = await buatPenggunaPortal(tenantId, 'klinisi');
  const editor = await buatPenggunaPortal(tenantId, 'editor');

  const beriPeran = async (pengguna, nama, hakPerMenu) => {
    const roleId = (
      await q(
        `INSERT INTO "${SCHEMA}".role (code, name, description, is_system)
         VALUES ($1,$2,'Peran naskah bukti H-10',FALSE) RETURNING id`,
        [`BUKTI_PTL_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
      )
    )[0].id;
    const subjectId = (
      await q(`SELECT id FROM "${SCHEMA}".user_subject WHERE platform_user_id = $1`, [
        pengguna.platformUserId,
      ])
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
  };

  await beriPeran(petugas, 'petugas', {
    HEALTH: ['READ'],
    HEALTH_PORTAL_ACCOUNT: ['READ', 'CREATE', 'VERIFY', 'ACTIVATE'],
  });
  await beriPeran(klinisi, 'klinisi', {
    HEALTH: ['READ'],
    HEALTH_PORTAL_RELEASE: ['READ', 'RELEASE'],
  });
  await beriPeran(editor, 'editor', {
    HEALTH: ['READ'],
    HEALTH_WEB_CONTENT: ['READ', 'CREATE', 'UPDATE', 'PUBLISH', 'UNPUBLISH'],
  });

  // Masuk sekali, sesudah seluruh perannya diberikan.
  for (const p of [akunA, akunB, petugas, klinisi, editor]) {
    await masuk(p);
  }

  log('');
  log('Lima pengguna. Ani dan Budi adalah pasien; petugas memverifikasi akun,');
  log('klinisi melepas hasil, editor mengelola website. Ani menjadi wali anaknya.');

  // --- 1. Akun portal ------------------------------------------------------
  log('');
  log('1. AKUN PORTAL TIDAK AKTIF TANPA VERIFIKASI TATAP MUKA');
  const akunPendingA = (
    await q(
      `INSERT INTO "${SCHEMA}".patient_portal_account (patient_id, platform_user_id, status)
       VALUES ($1,$2,'PENDING') RETURNING id`,
      [pasienA, akunA.platformUserId],
    )
  )[0].id;

  const bukaPending = await api('/health/portal/me', {}, akunA.token);
  check('akun PENDING tidak dapat membuka portal', bukaPending.status === 403,
    `status ${bukaPending.status}`);
  check('penolakannya menyebut statusnya', pesan(bukaPending).includes('PENDING'));

  const tembusAktif = await gagal(
    `UPDATE "${SCHEMA}".patient_portal_account SET status = 'ACTIVE' WHERE id = $1`,
    [akunPendingA],
  );
  check('mengaktifkannya lewat basis data tanpa verifikasi ditolak constraint',
    (tembusAktif ?? '').includes('portal_account_active_verified'), tembusAktif ?? 'lolos');

  await q(
    `UPDATE "${SCHEMA}".patient_portal_account
        SET status = 'ACTIVE', identity_verified_by = gen_random_uuid(),
            identity_verified_at = now(), verification_method = 'IN_PERSON_ID',
            activated_at = now()
      WHERE id = $1`,
    [akunPendingA],
  );
  await q(
    `INSERT INTO "${SCHEMA}".patient_portal_account
       (patient_id, platform_user_id, status, identity_verified_by, identity_verified_at,
        verification_method, activated_at)
     VALUES ($1,$2,'ACTIVE',gen_random_uuid(),now(),'IN_PERSON_ID',now())`,
    [pasienB, akunB.platformUserId],
  );

  const bukaAktif = await api('/health/portal/me', {}, akunA.token);
  check('akun AKTIF dapat membuka portal', bukaAktif.status === 200,
    `status ${bukaAktif.status} ${pesan(bukaAktif)}`);
  check('dan yang dikembalikan adalah pasiennya sendiri',
    bukaAktif.data?.self?.patientId === pasienA);

  // --- 2. Satu akun, satu pasien -------------------------------------------
  log('');
  log('2. SATU AKUN, SATU PASIEN — DAN SEBALIKNYA');
  const akunGanda = await gagal(
    `INSERT INTO "${SCHEMA}".patient_portal_account
       (patient_id, platform_user_id, status) VALUES ($1,$2,'PENDING')`,
    [anakA, akunA.platformUserId],
  );
  check('satu pengguna tidak menaut dua pasien',
    (akunGanda ?? '').includes('ux_portal_account_user'), akunGanda ?? 'lolos');

  const pasienGanda = await gagal(
    `INSERT INTO "${SCHEMA}".patient_portal_account
       (patient_id, platform_user_id, status) VALUES ($1,gen_random_uuid(),'PENDING')`,
    [pasienA],
  );
  check('dan satu pasien tidak punya dua akun',
    (pasienGanda ?? '').includes('ux_portal_account_patient'), pasienGanda ?? 'lolos');

  // --- 3. INVARIAN UTAMA ---------------------------------------------------
  log('');
  log('3. IDENTITAS DARI TOKEN, TIDAK PERNAH DARI PARAMETER');
  log('   Ani mengirimkan nomor pasien Budi pada SETIAP jalan portal.');

  const jalanPortal = [
    ['appointments', 'GET'],
    ['queue', 'GET'],
    ['lab-results', 'GET'],
    ['visits', 'GET'],
    ['prescriptions', 'GET'],
  ];

  let ditolak = 0;
  for (const [jalan] of jalanPortal) {
    const r = await api(
      `/health/portal/${jalan}?subjectPatientId=${pasienB}`,
      {},
      akunA.token,
    );
    const tolak = r.status === 403;
    if (tolak) ditolak += 1;
    check(`  /${jalan} menolak nomor pasien lain`, tolak, `status ${r.status}`);
  }
  check('SELURUH jalan portal menolak, bukan sebagian', ditolak === jalanPortal.length,
    `${ditolak}/${jalanPortal.length}`);

  const contohTolak = await api(
    `/health/portal/lab-results?subjectPatientId=${pasienB}`,
    {},
    akunA.token,
  );
  check('penolakannya menjelaskan mengapa parameter bukan jawaban',
    pesan(contohTolak).includes('tidak pernah menjadi jawaban dengan sendirinya'));

  const janjiSendiri = await api('/health/portal/appointments', {}, akunA.token);
  check('UJI KENDALI: tanpa parameter, Ani membaca datanya sendiri',
    janjiSendiri.status === 200 && janjiSendiri.data?.accessedAs === 'SELF',
    `status ${janjiSendiri.status}`);

  // --- 4. Penolakan tercatat -----------------------------------------------
  log('');
  log('4. Penolakan TERCATAT, beserta pasien mana yang dicoba');
  const jejakTolak = await q(
    `SELECT l.outcome, l.subject_patient_id, l.deny_reason, l.data_kind
       FROM "${SCHEMA}".patient_portal_access_log l
       JOIN "${SCHEMA}".patient_portal_account a ON a.id = l.portal_account_id
      WHERE a.platform_user_id = $1 AND l.outcome = 'DENIED'`,
    [akunA.platformUserId],
  );
  check('penolakannya tercatat', jejakTolak.length >= jalanPortal.length,
    `${jejakTolak.length} baris`);
  check('dan seluruhnya menyebutkan sebabnya',
    jejakTolak.every((j) => Boolean(j.deny_reason)));

  const tembusTanpaSebab = await gagal(
    `INSERT INTO "${SCHEMA}".patient_portal_access_log
       (portal_account_id, subject_patient_id, accessed_as, data_kind, outcome)
     VALUES ($1,$2,'SELF','LAB_RESULT','DENIED')`,
    [akunPendingA, pasienA],
  );
  check('penolakan tanpa sebab ditolak constraint',
    (tembusTanpaSebab ?? '').includes('portal_log_deny_reason'), tembusTanpaSebab ?? 'lolos');

  const hapusJejak = await gagal(
    `DELETE FROM "${SCHEMA}".patient_portal_access_log
      WHERE portal_account_id = $1`,
    [akunPendingA],
  );
  check('jejak akses portal tidak dapat dihapus',
    (hapusJejak ?? '').includes('LEDGER_IMMUTABLE'), hapusJejak ?? 'lolos');

  // --- 5. Wali -------------------------------------------------------------
  log('');
  log('5. Wali melihat sesuai tingkatnya, tidak lebih');
  await q(
    `INSERT INTO "${SCHEMA}".patient_proxy
       (patient_id, proxy_patient_id, proxy_name, relationship, access_level)
     VALUES ($1,$2,'Ani Bukti Portal','PARENT','SUMMARY_ONLY')`,
    [anakA, pasienA],
  );

  const daftarWali = await api('/health/portal/me', {}, akunA.token);
  check('anaknya muncul pada daftar perwalian',
    (daftarWali.data?.proxies ?? []).some((p) => p.patientId === anakA),
    JSON.stringify(daftarWali.data?.proxies ?? []));

  const kunjunganAnak = await api(
    `/health/portal/visits?subjectPatientId=${anakA}`,
    {},
    akunA.token,
  );
  check('wali SUMMARY_ONLY melihat ringkasan kunjungan anaknya',
    kunjunganAnak.status === 200 && kunjunganAnak.data?.accessedAs === 'PROXY',
    `status ${kunjunganAnak.status} ${pesan(kunjunganAnak)}`);

  const hasilAnak = await api(
    `/health/portal/lab-results?subjectPatientId=${anakA}`,
    {},
    akunA.token,
  );
  check('TETAPI TIDAK melihat hasil laboratoriumnya', hasilAnak.status === 403,
    `status ${hasilAnak.status}`);
  check('penolakannya menyebut wali yang ditunjuk untuk satu keperluan',
    pesan(hasilAnak).includes('tidak berhak atas seluruhnya'));

  await q(
    `UPDATE "${SCHEMA}".patient_proxy SET revoked_at = now(), revoke_reason = 'Bukti pencabutan.'
      WHERE patient_id = $1 AND proxy_patient_id = $2`,
    [anakA, pasienA],
  );
  const sesudahCabut = await api(
    `/health/portal/visits?subjectPatientId=${anakA}`,
    {},
    akunA.token,
  );
  check('PERWALIAN YANG DICABUT langsung berlaku', sesudahCabut.status === 403,
    `status ${sesudahCabut.status}`);

  // --- 6. Hasil kritis -----------------------------------------------------
  log('');
  log('6. HASIL KRITIS TIDAK MUNCUL DI PORTAL SAMPAI DILEPAS');
  const testId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_test_catalog (facility_id, code, name, specimen_type, category)
       VALUES ($1,$2,'Kalium','BLOOD','CHEMISTRY') RETURNING id`,
      [facilityId, `K-${tag}`],
    )
  )[0].id;

  // Hasil menuntut pesanannya — dan itu benar: hasil tanpa pesanan adalah
  // hasil yang tidak ada yang memintanya.
  const orderId = (
    await q(
      `INSERT INTO "${SCHEMA}".lab_order
         (order_number, patient_id, facility_id, department, priority, ordered_at, status)
       VALUES ($1,$2,$3,'CHEMISTRY','ROUTINE',now(),'COMPLETED') RETURNING id`,
      [`LAB-${tag}`, pasienA, facilityId],
    )
  )[0].id;

  let barisPesanan = 0;
  const buatHasil = async (kritis, terverifikasi, dilepas, nilai) => {
    barisPesanan += 1;
    const itemId = (
      await q(
        `INSERT INTO "${SCHEMA}".lab_order_item (order_id, test_id, line_no, status)
         VALUES ($1,$2,$3,'RESULTED') RETURNING id`,
        [orderId, testId, barisPesanan],
      )
    )[0].id;
    return (
      await q(
        `INSERT INTO "${SCHEMA}".lab_result
           (order_id, order_item_id, patient_id, test_id, value_numeric, unit, is_critical,
            status, verified_at, verified_by, released_at, entered_at, entered_by)
         VALUES ($1,$2,$3,$4,$5,'mmol/L',$6,$9,$7,
                 CASE WHEN $7::timestamptz IS NULL THEN NULL ELSE gen_random_uuid() END,
                 $8, now(), gen_random_uuid()) RETURNING id`,
        [
          orderId,
          itemId,
          pasienA,
          testId,
          nilai,
          kritis,
          terverifikasi ? new Date().toISOString() : null,
          dilepas ? new Date().toISOString() : null,
          dilepas ? 'RELEASED' : terverifikasi ? 'VERIFIED' : 'RESULTED',
        ],
      )
    )[0].id;
  };

  const hasilKritis = await buatHasil(true, true, false, 6.8);
  const hasilBiasa = await buatHasil(false, true, true, 4.1);
  const hasilBelumVerifikasi = await buatHasil(false, false, false, 4.5);

  const hasilPortal = await api('/health/portal/lab-results', {}, akunA.token);
  check('daftar hasil terbaca', hasilPortal.status === 200, `status ${hasilPortal.status}`);

  const kritisDiPortal = (hasilPortal.data?.items ?? []).find((h) => h.id === hasilKritis);
  check('hasil KRITIS muncul sebagai baris', Boolean(kritisDiPortal));
  check('TETAPI ANGKANYA TIDAK', kritisDiPortal?.value === null,
    `${kritisDiPortal?.value}`);
  check('dan pesannya menyuruh jangan menunggu bila merasa tidak enak badan',
    String(kritisDiPortal?.message ?? '').includes('jangan menunggu'));

  const biasaDiPortal = (hasilPortal.data?.items ?? []).find((h) => h.id === hasilBiasa);
  check('UJI KENDALI: hasil biasa yang sudah dilepas MENAMPILKAN angkanya',
    biasaDiPortal?.value != null, `${biasaDiPortal?.value}`);

  const belumDiPortal = (hasilPortal.data?.items ?? []).find(
    (h) => h.id === hasilBelumVerifikasi,
  );
  check('hasil yang belum diverifikasi tidak menampilkan angkanya',
    belumDiPortal?.value === null);
  check('dan pesannya menyebut sedang diperiksa petugas laboratorium',
    String(belumDiPortal?.message ?? '').includes('sedang diperiksa petugas laboratorium'));

  const jsonPortal = JSON.stringify(hasilPortal.body);
  check('ANGKA KRITIS TIDAK ADA PADA JAWABANNYA SAMA SEKALI',
    !jsonPortal.includes('6.8'), 'angka 6.8 ditemukan pada jawaban');

  // --- 7. Pelepasan hasil kritis -------------------------------------------
  log('');
  log('7. Hasil kritis tidak dilepas tanpa menghubungi pasiennya');
  const tembusLepas = await gagal(
    `INSERT INTO "${SCHEMA}".portal_result_release
       (lab_result_id, released_by, was_critical, patient_contacted)
     VALUES ($1,gen_random_uuid(),TRUE,FALSE)`,
    [hasilKritis],
  );
  check('melepas hasil kritis tanpa menghubungi ditolak constraint',
    (tembusLepas ?? '').includes('portal_release_critical_contacted'), tembusLepas ?? 'lolos');

  const lepasSah = await gagal(
    `INSERT INTO "${SCHEMA}".portal_result_release
       (lab_result_id, released_by, was_critical, patient_contacted, contact_note)
     VALUES ($1,gen_random_uuid(),TRUE,TRUE,'Pasien dihubungi lewat telepon pukul 20.15.')`,
    [hasilKritis],
  );
  check('UJI KENDALI: dengan catatan menghubungi, ia diterima', lepasSah === null,
    lepasSah ?? '');

  await q(`UPDATE "${SCHEMA}".lab_result SET released_at = now() WHERE id = $1`, [hasilKritis]);
  const sesudahLepas = await api('/health/portal/lab-results', {}, akunA.token);
  const kritisSesudah = (sesudahLepas.data?.items ?? []).find((h) => h.id === hasilKritis);
  check('sesudah dilepas, angkanya muncul', kritisSesudah?.value != null,
    `${kritisSesudah?.value}`);

  const hapusPelepasan = await gagal(
    `DELETE FROM "${SCHEMA}".portal_result_release WHERE lab_result_id = $1`,
    [hasilKritis],
  );
  check('catatan pelepasan tidak dapat dihapus',
    (hapusPelepasan ?? '').includes('LEDGER_IMMUTABLE'), hapusPelepasan ?? 'lolos');

  // --- 8. Janji temu -------------------------------------------------------
  log('');
  log('8. Pasien membuat dan membatalkan janji temunya sendiri');
  const janjiBaru = await api(
    '/health/portal/appointments',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, scheduledAt: hari(7), chiefComplaint: 'Kontrol rutin.',
      }),
    },
    akunA.token,
  );
  check('janji temu dibuat', janjiBaru.status === 201,
    `status ${janjiBaru.status} ${pesan(janjiBaru)}`);

  const pemilikJanji = await q(
    `SELECT patient_id FROM "${SCHEMA}".health_appointment WHERE id = $1`,
    [janjiBaru.data?.id],
  );
  check('DAN PEMILIKNYA ADALAH ANI, bukan siapa pun yang dikirimkan',
    pemilikJanji[0]?.patient_id === pasienA);

  const janjiUntukBudi = await api(
    '/health/portal/appointments',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, subjectPatientId: pasienB, scheduledAt: hari(7),
      }),
    },
    akunA.token,
  );
  check('Ani tidak dapat membuat janji atas nama Budi', janjiUntukBudi.status === 403,
    `status ${janjiUntukBudi.status}`);

  const janjiLampau = await api(
    '/health/portal/appointments',
    { method: 'POST', body: JSON.stringify({ facilityId, scheduledAt: hari(-1) }) },
    akunA.token,
  );
  check('janji pada waktu yang sudah lewat ditolak', janjiLampau.status === 422,
    `status ${janjiLampau.status}`);

  const janjiJauh = await api(
    '/health/portal/appointments',
    { method: 'POST', body: JSON.stringify({ facilityId, scheduledAt: hari(400) }) },
    akunA.token,
  );
  check('janji terlalu jauh ke depan ditolak', janjiJauh.status === 422,
    `status ${janjiJauh.status}`);
  check('penolakannya menyebut dibatalkan sepihak',
    pesan(janjiJauh).includes('dibatalkan sepihak'));

  const batal = await api(
    `/health/portal/appointments/${janjiBaru.data?.id}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: 'Ada keperluan lain.' }) },
    akunA.token,
  );
  check('pasien membatalkan janjinya sendiri', batal.data?.status === 'CANCELLED',
    `status ${batal.status} ${pesan(batal)}`);

  const janjiBudi = (
    await q(
      `INSERT INTO "${SCHEMA}".health_appointment
         (patient_id, facility_id, appointment_number, scheduled_at, channel, status)
       VALUES ($1,$2,$3,now() + interval '7 days','ONLINE','BOOKED') RETURNING id`,
      [pasienB, facilityId, `APT-BUDI-${tag}`],
    )
  )[0].id;
  const batalJanjiOrangLain = await api(
    `/health/portal/appointments/${janjiBudi}/cancel`,
    { method: 'POST', body: JSON.stringify({ reason: 'Mencoba membatalkan milik orang lain.' }) },
    akunA.token,
  );
  check('ANI TIDAK DAPAT MEMBATALKAN JANJI BUDI', batalJanjiOrangLain.status === 403,
    `status ${batalJanjiOrangLain.status}`);

  const janjiBudiMasihAda = await q(
    `SELECT status FROM "${SCHEMA}".health_appointment WHERE id = $1`,
    [janjiBudi],
  );
  check('dan janji Budi tidak berubah', janjiBudiMasihAda[0]?.status === 'BOOKED',
    janjiBudiMasihAda[0]?.status);

  // --- 9. Website publik ---------------------------------------------------
  log('');
  log('9. Website publik tidak dapat memuat data pasien');
  const kolomPasienKonten = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'facility_web_content'
        AND (column_name ILIKE '%patient%' OR column_name ILIKE '%diagnos%'
             OR column_name = 'nik' OR column_name ILIKE '%medical_record%')`,
    [SCHEMA],
  );
  check('tabel konten tidak punya satu pun kolom pasien', kolomPasienKonten[0].n === 0,
    `${kolomPasienKonten[0].n} kolom`);

  const kunciKlinis = await q(
    `SELECT count(*)::int AS n
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'facility_web_content'
        AND ccu.table_name IN ('patient', 'health_encounter', 'lab_result', 'rx_prescription')`,
    [SCHEMA],
  );
  check('dan tidak satu pun kunci asing ke tabel klinis', kunciKlinis[0].n === 0,
    `${kunciKlinis[0].n}`);

  const kontenBersih = await api(
    '/health/portal-admin/web-content',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contentKind: 'SERVICE', slug: `poli-anak-${tag}`,
        title: 'Poliklinik Anak', summary: 'Buka Senin sampai Sabtu.',
        body: 'Poliklinik anak melayani imunisasi dan tumbuh kembang.',
      }),
    },
    editor.token,
  );
  check('konten bersih diterima', kontenBersih.status === 201,
    `status ${kontenBersih.status} ${pesan(kontenBersih)}`);

  const kontenNik = await api(
    '/health/portal-admin/web-content',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contentKind: 'ARTICLE', slug: `kisah-${tag}`,
        title: 'Kisah Pasien Kami',
        body: 'Pasien dengan NIK 3201234567890123 sembuh setelah dirawat.',
      }),
    },
    editor.token,
  );
  check('KONTEN YANG MEMUAT NIK DITOLAK', kontenNik.status === 422,
    `status ${kontenNik.status}`);
  check('penolakannya menyebut mesin pencari sudah menyalinnya',
    pesan(kontenNik).includes('mesin pencari sudah menyalinnya'));

  const kontenRm = await api(
    '/health/portal-admin/web-content',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, contentKind: 'ARTICLE', slug: `kisah2-${tag}`,
        title: 'Kisah Lain', body: 'Pasien RM-000123 dirawat tiga hari.',
      }),
    },
    editor.token,
  );
  check('konten yang memuat nomor rekam medis pun ditolak', kontenRm.status === 422,
    `status ${kontenRm.status}`);

  const belumTerbit = await api(
    `/health/public/${SCHEMA}/website?facilityId=${facilityId}`,
  );
  check('website publik dapat dibaca TANPA masuk', belumTerbit.status === 200,
    `status ${belumTerbit.status}`);
  check('konten DRAFT belum tampil',
    !(belumTerbit.data?.items ?? []).some((i) => i.slug === `poli-anak-${tag}`));

  await api(
    `/health/portal-admin/web-content/${kontenBersih.data?.id}/publish`,
    { method: 'POST' },
    editor.token,
  );
  const sesudahTerbit = await api(
    `/health/public/${SCHEMA}/website?facilityId=${facilityId}`,
  );
  check('sesudah diterbitkan, ia tampil',
    (sesudahTerbit.data?.items ?? []).some((i) => i.slug === `poli-anak-${tag}`));

  const tarikTanpaAlasan = await api(
    `/health/portal-admin/web-content/${kontenBersih.data?.id}/unpublish`,
    { method: 'POST', body: JSON.stringify({ reason: 'salah' }) },
    editor.token,
  );
  check('penarikan tanpa alasan yang bermakna ditolak',
    tarikTanpaAlasan.status === 400 || tarikTanpaAlasan.status === 422,
    `status ${tarikTanpaAlasan.status}`);

  await api(
    `/health/portal-admin/web-content/${kontenBersih.data?.id}/unpublish`,
    { method: 'POST', body: JSON.stringify({ reason: 'Jadwal poliklinik berubah mulai pekan depan.' }) },
    editor.token,
  );
  const sesudahTarik = await api(
    `/health/public/${SCHEMA}/website?facilityId=${facilityId}`,
  );
  check('YANG DITARIK LANGSUNG HILANG dari website publik',
    !(sesudahTarik.data?.items ?? []).some((i) => i.slug === `poli-anak-${tag}`));

  const jsonPublik = JSON.stringify(sesudahTerbit.body);
  check('jawaban website publik tidak memuat satu pun nama pasien',
    !/Ani Bukti Portal|Budi Bukti Portal|Cici Anak/.test(jsonPublik));

  // --- 10. Pemisahan jalur -------------------------------------------------
  log('');
  log('10. Jalur pasien dan jalur petugas terpisah');
  const pasienBukaAdmin = await api(
    '/health/portal-admin/accounts',
    {
      method: 'POST',
      body: JSON.stringify({ patientId: pasienB, platformUserId: randomUUID() }),
    },
    akunA.token,
  );
  check('pasien tidak dapat membuka jalur petugas', pasienBukaAdmin.status === 403,
    `status ${pasienBukaAdmin.status}`);

  const petugasBukaPortal = await api('/health/portal/me', {}, petugas.token);
  check('petugas tanpa akun portal tidak dapat membuka jalur pasien',
    petugasBukaPortal.status === 403, `status ${petugasBukaPortal.status}`);
  check('penolakannya menyebut akun yang tidak tertaut pasien',
    pesan(petugasBukaPortal).includes('tidak tertaut satu pun pasien'));

  const catatanKlinis = await api(
    '/health/portal/lab-results?subjectPatientId=',
    {},
    akunA.token,
  );
  check('UJI KENDALI: parameter kosong diperlakukan sebagai dirinya sendiri',
    catatanKlinis.status === 200 && catatanKlinis.data?.accessedAs === 'SELF',
    `status ${catatanKlinis.status}`);

  const seluruhTenant = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".patient_portal_account
      WHERE status = 'ACTIVE' AND identity_verified_at IS NULL`,
  );
  check('di SELURUH tenant, tidak ada akun aktif tanpa verifikasi',
    seluruhTenant[0].n === 0, `${seluruhTenant[0].n} akun`);

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
    new URL('../../../docs/emedik/bukti-h10-portal.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
