/**
 * Bukti H-9H: registri alat kesehatan, gateway, dan hasil alat.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Tiga hal yang paling penting dibuktikan di sini, dan dua di antaranya lewat
 * KETIADAAN:
 *
 * 1. **Alat tidak pernah punya kredensial basis data.** Tidak ada satu pun
 *    kolom pada tabel alat yang menampung kata sandi, token, atau kunci — dan
 *    naskah ini memeriksanya pada `information_schema`.
 *
 * 2. **Kendali jarak jauh MATI SECARA BAWAAN, untuk seluruh alat.** Naskah ini
 *    menghitung alat yang kendalinya menyala di seluruh tenant dan menuntut
 *    seluruhnya berkontrak enam syarat.
 *
 * 3. **Hasil tanpa identitas pasien TIDAK ditebak.** Ia masuk antrean
 *    PENDING_LINK.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - kredensial disimpan sebagai nilai;
 * - alat non-manual tanpa gateway;
 * - protokol yang terhalang;
 * - kendali jarak jauh menyala tanpa salah satu syaratnya;
 * - perintah di luar daftar putih, atau melampaui batas nilainya;
 * - pesan yang sama diterima dua kali;
 * - yang mengaitkan hasil menelaahnya sendiri.
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

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_dev_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9H',FALSE) RETURNING id`,
      [`BUKTI_DEV_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9H — REGISTRI ALAT KESEHATAN, GATEWAY, DAN HASIL ALAT');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const teknisi = await buatPengguna(tenantId, 'teknisi', {
    HEALTH: ['READ'],
    HEALTH_DEVICE: ['READ', 'CREATE', 'UPDATE', 'MANAGE_DEVICE'],
    HEALTH_DEVICE_GATEWAY: ['READ', 'CREATE', 'UPDATE', 'MANAGE_CREDENTIAL'],
    HEALTH_DEVICE_INBOX: ['READ', 'CREATE', 'ASSIGN'],
  });
  const admin = await buatPengguna(tenantId, 'admin', {
    HEALTH: ['READ'],
    HEALTH_DEVICE: ['READ', 'ACTIVATE', 'MANAGE_DEVICE'],
  });
  const penelaah = await buatPengguna(tenantId, 'penelaah', {
    HEALTH: ['READ'],
    HEALTH_PATIENT: ['READ'],
    HEALTH_DEVICE_INBOX: ['READ', 'ASSIGN', 'REVIEW'],
  });

  log('');
  log('Tiga pengguna. Teknisi mengelola alat tetapi TIDAK menyalakan kendali jarak');
  log('jauh; administrator sebaliknya. Yang ketiga menelaah hasil — dan ia sengaja');
  log('diberi hak MENGAITKAN pula, supaya penolakan "yang mengaitkan tidak');
  log('menelaah" datang dari pemeriksaan baris, bukan dari ketiadaan hak akses.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Alat','HOSPITAL') RETURNING id`,
      [`BKDV-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Alat','Asia/Jakarta') RETURNING id`,
      [typeId, `DV-${tag}`],
    )
  )[0].id;
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Tono Bukti Alat','1970-01-01','MALE') RETURNING id`,
      [`EPI-DV-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  // --- 1. Alat tidak pernah punya kredensial --------------------------------
  log('');
  log('1. ALAT TIDAK PERNAH PUNYA KREDENSIAL BASIS DATA');
  const kolomRahasia = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'medical_device'
        AND (column_name ILIKE '%password%' OR column_name ILIKE '%token%'
             OR column_name ILIKE '%api_key%' OR column_name ILIKE '%secret%'
             OR column_name ILIKE '%credential%')`,
    [SCHEMA],
  );
  check('tabel alat tidak punya satu pun kolom kredensial', kolomRahasia[0].n === 0,
    `${kolomRahasia[0].n} kolom`);

  const gateway = await api(
    '/health/devices/gateways',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `GW-${tag.toUpperCase()}`, name: 'Gateway Laboratorium',
        vendor: 'Vendor Bukti', networkSegment: 'VLAN-DEVICE-10',
        credentialSecretRef: `vault://gateway/${tag}`,
      }),
    },
    teknisi.token,
  );
  check('gateway dengan rujukan brankas diterima', gateway.status === 201,
    `status ${gateway.status} ${pesan(gateway)}`);
  check('dan diberi tahu bahwa ia tidak dapat membacanya kembali',
    String(gateway.data?.note ?? '').includes('tidak dapat membacanya kembali'));

  const nilaiMentah = await api(
    '/health/devices/gateways',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `GWX-${tag.toUpperCase()}`, name: 'Gateway Berkredensial Mentah',
        credentialRawValue: 'kata-sandi-rahasia',
      }),
    },
    teknisi.token,
  );
  check('kredensial sebagai NILAI DITOLAK', nilaiMentah.status === 422,
    `status ${nilaiMentah.status}`);
  check('penolakannya menyebut siapa yang harus dicurigai ketika ada kebocoran',
    pesan(nilaiMentah).includes('harus dicurigai ketika ada kebocoran'));

  const tembusNilai = await gagal(
    `INSERT INTO "${SCHEMA}".device_gateway (facility_id, code, name, credential_secret_ref)
     VALUES ($1,$2,'Tembus','kata-sandi-langsung')`,
    [facilityId, `GWT-${tag}`],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusNilai ?? '').includes('device_gateway_secret_is_ref'), tembusNilai ?? 'lolos');

  const daftarGw = await api(
    `/health/devices/gateways?facilityId=${facilityId}`,
    {},
    teknisi.token,
  );
  const medanGw = Object.keys((daftarGw.data ?? [])[0] ?? {});
  check('rujukan brankas TIDAK ikut dikembalikan pada daftar',
    !medanGw.includes('credential_secret_ref') && medanGw.includes('has_credential'),
    JSON.stringify(medanGw));

  // --- 2. Protokol ----------------------------------------------------------
  log('');
  log('2. Protokol yang terhalang menyebutkan penghalangnya');
  const protokol = await api('/health/devices/protocols', {}, teknisi.token);
  check('katalog protokol terbaca', protokol.status === 200, `status ${protokol.status}`);
  check('yang terhalang seluruhnya menyebut penghalangnya',
    (protokol.data ?? []).filter((p) => !p.usable).every((p) => Boolean(p.blockedBy)),
    JSON.stringify((protokol.data ?? []).filter((p) => !p.usable).map((p) => p.code)));

  const alatDicom = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `CT-${tag.toUpperCase()}`,
        name: 'CT Scan', deviceCategory: 'IMAGING', sourceProtocol: 'DICOM',
      }),
    },
    teknisi.token,
  );
  check('alat berprotokol DICOM ditolak', alatDicom.status === 422, `status ${alatDicom.status}`);
  check('penolakannya menyebut PACS', pesan(alatDicom).includes('PACS'));
  check('dan menegaskan ia bukan tidak didukung',
    pesan(alatDicom).includes('bukan tidak didukung'));

  const tanpaGateway = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `NOGW-${tag.toUpperCase()}`, name: 'Analyzer Tanpa Gateway',
        deviceCategory: 'ANALYZER', sourceProtocol: 'HL7V2',
      }),
    },
    teknisi.token,
  );
  check('alat non-manual TANPA gateway ditolak', tanpaGateway.status === 422,
    `status ${tanpaGateway.status}`);
  check('penolakannya menyebut tidak ada jalan langsung ke basis data',
    pesan(tanpaGateway).includes('Tidak ada jalan langsung'));

  // --- 3. Kendali jarak jauh mati secara bawaan -----------------------------
  log('');
  log('3. KENDALI JARAK JAUH MATI SECARA BAWAAN');
  const pompa = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `PUMP-${tag.toUpperCase()}`,
        name: 'Pompa Infus Bangsal 3', deviceCategory: 'INFUSION_PUMP',
        sourceProtocol: 'IEEE_11073', softwareVersion: '2.1.0',
        calibratedAt: '2026-01-01', calibrationDueAt: '2027-01-01',
      }),
    },
    teknisi.token,
  );
  check('alat terdaftar', pompa.status === 201, `status ${pompa.status} ${pesan(pompa)}`);
  check('dengan kendali jarak jauh MATI', pompa.data?.remoteControlEnabled === false);
  check('dan dikatakan bawaannya memang mati',
    String(pompa.data?.note ?? '').includes('untuk seluruh alat, tanpa kecuali'));

  const teknisiNyalakan = await api(
    `/health/devices/${pompa.data?.id}/remote-control/enable`,
    {
      method: 'POST',
      body: JSON.stringify({
        writtenApprovalRef: 'SK-01', riskReviewRef: 'RA-01',
        allowedCommands: ['SET_RATE'], maxValue: 100,
        commandLogging: true, emergencyStop: true,
      }),
    },
    teknisi.token,
  );
  check('TEKNISI tidak berwenang menyalakan kendali jarak jauh',
    teknisiNyalakan.status === 403, `status ${teknisiNyalakan.status}`);

  const kurangSyarat = await api(
    `/health/devices/${pompa.data?.id}/remote-control/enable`,
    {
      method: 'POST',
      body: JSON.stringify({
        writtenApprovalRef: 'SK-01', riskReviewRef: 'RA-01',
        allowedCommands: ['SET_RATE'], maxValue: 100,
        commandLogging: true, emergencyStop: false,
      }),
    },
    admin.token,
  );
  check('kurang satu syarat pun DITOLAK', kurangSyarat.status === 422,
    `status ${kurangSyarat.status}`);
  check('penolakannya menyebut akibat kegagalannya tidak dapat diperbaiki',
    pesan(kurangSyarat).includes('tidak dapat diperbaiki'));

  const tembusKendali = await gagal(
    `UPDATE "${SCHEMA}".medical_device SET remote_control_enabled = TRUE WHERE id = $1`,
    [pompa.data?.id],
  );
  check('menyalakannya lewat basis data ditolak constraint',
    (tembusKendali ?? '').includes('medical_device_remote_complete'), tembusKendali ?? 'lolos');

  const nyalakan = await api(
    `/health/devices/${pompa.data?.id}/remote-control/enable`,
    {
      method: 'POST',
      body: JSON.stringify({
        writtenApprovalRef: 'SK-DIR-08/2026', riskReviewRef: 'RA-KLINIS-03/2026',
        allowedCommands: ['SET_RATE'], minValue: 1, maxValue: 100,
        commandLogging: true, emergencyStop: true,
      }),
    },
    admin.token,
  );
  check('dengan keenam syaratnya, administrator menyalakannya',
    nyalakan.data?.remoteControlEnabled === true,
    `status ${nyalakan.status} ${pesan(nyalakan)}`);

  const semuaAktif = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".medical_device
      WHERE remote_control_enabled = TRUE
        AND (remote_written_approval_ref IS NULL OR remote_risk_review_ref IS NULL
             OR remote_max_value IS NULL OR remote_command_logging = FALSE
             OR remote_emergency_stop = FALSE)`,
  );
  check('di SELURUH tenant, tidak satu pun kendali menyala tanpa keenam syaratnya',
    semuaAktif[0].n === 0, `${semuaAktif[0].n} alat`);

  // --- 4. Perintah ----------------------------------------------------------
  log('');
  log('4. Perintah di luar daftar putih ditolak, dan setiap penolakan DICATAT');
  const perintahAsing = await api(
    `/health/devices/${pompa.data?.id}/commands`,
    { method: 'POST', body: JSON.stringify({ command: 'FACTORY_RESET' }) },
    teknisi.token,
  );
  check('perintah di luar daftar putih ditolak', perintahAsing.status === 403,
    `status ${perintahAsing.status}`);
  check('penolakannya menyebut pembaruan yang datang tanpa memberi tahu',
    pesan(perintahAsing).includes('tanpa memberi tahu siapa pun'));

  const perintahBerlebih = await api(
    `/health/devices/${pompa.data?.id}/commands`,
    { method: 'POST', body: JSON.stringify({ command: 'SET_RATE', value: 500 }) },
    teknisi.token,
  );
  check('nilai yang melampaui batas ditolak', perintahBerlebih.status === 403,
    `status ${perintahBerlebih.status}`);
  check('penolakannya menyebut perintah yang mencelakakan',
    pesan(perintahBerlebih).includes('perintah yang mencelakakan'));

  const perintahSah = await api(
    `/health/devices/${pompa.data?.id}/commands`,
    { method: 'POST', body: JSON.stringify({ command: 'SET_RATE', value: 50 }) },
    teknisi.token,
  );
  check('perintah yang sah diterima', perintahSah.data?.accepted === true,
    `status ${perintahSah.status} ${pesan(perintahSah)}`);

  const jejak = await api(`/health/devices/${pompa.data?.id}/commands`, {}, teknisi.token);
  check('ketiganya tercatat — termasuk yang DITOLAK', (jejak.data ?? []).length === 3,
    `${(jejak.data ?? []).length} baris`);
  check('yang ditolak menyimpan alasannya',
    (jejak.data ?? []).filter((j) => !j.accepted).every((j) => Boolean(j.rejection_reason)));

  const hapusJejak = await gagal(
    `DELETE FROM "${SCHEMA}".device_command_log WHERE device_id = $1`,
    [pompa.data?.id],
  );
  check('jejak perintah tidak dapat dihapus',
    (hapusJejak ?? '').includes('LEDGER_IMMUTABLE'), hapusJejak ?? 'lolos');

  // --- 5. Hasil alat --------------------------------------------------------
  log('');
  log('5. Hasil tanpa identitas pasien TIDAK DITEBAK');
  const analyzer = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `ANL-${tag.toUpperCase()}`,
        name: 'Hematology Analyzer', deviceCategory: 'ANALYZER',
        sourceProtocol: 'ASTM', calibratedAt: '2026-01-01', calibrationDueAt: '2027-01-01',
      }),
    },
    teknisi.token,
  );
  await api(
    `/health/devices/${analyzer.data?.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) },
    teknisi.token,
  );

  const sekarang = new Date().toISOString();
  const hasilTanpaPasien = await api(
    '/health/devices/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer.data?.id,
        rawMessage: `HL7|HGB|13.5|${tag}-1`,
        observationCode: 'HGB', observationValue: '13.5', observationUnit: 'g/dL',
        capturedAt: sekarang,
      }),
    },
    teknisi.token,
  );
  check('hasil diterima', hasilTanpaPasien.status === 201,
    `status ${hasilTanpaPasien.status} ${pesan(hasilTanpaPasien)}`);
  check('tetapi TIDAK dikaitkan kepada siapa pun', hasilTanpaPasien.data?.linked === false);
  check('dan masuk antrean PENDING_LINK',
    hasilTanpaPasien.data?.reviewStatus === 'PENDING_LINK');
  check('pesannya menyebut salah sekali',
    String(hasilTanpaPasien.data?.message ?? '').includes('salah sekali'));

  const antrean = await api(
    `/health/devices/observations/pending-link?facilityId=${facilityId}`,
    {},
    penelaah.token,
  );
  check('antrean pengaitan terbaca', antrean.status === 200, `status ${antrean.status}`);
  check('dan memuat hasil yang belum terkait', (antrean.data ?? []).length >= 1,
    `${(antrean.data ?? []).length} baris`);

  const tembusPasienTanpaCara = await gagal(
    `INSERT INTO "${SCHEMA}".device_observation
       (facility_id, device_id, patient_id, captured_at, source_protocol, raw_message_hash)
     VALUES ($1,$2,$3,now(),'ASTM',$4)`,
    [facilityId, analyzer.data?.id, pasien, `sha256:tembus-${tag}`],
  );
  check('pasien yang muncul TANPA cara pengaitan ditolak constraint',
    (tembusPasienTanpaCara ?? '').includes('device_obs_patient_needs_method'),
    tembusPasienTanpaCara ?? 'lolos');

  // --- 6. Duplikat lewat sidik jari ----------------------------------------
  log('');
  log('6. Duplikat dikenali lewat SIDIK JARI, bukan lewat waktu');
  const kirimUlang = await api(
    '/health/devices/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer.data?.id,
        rawMessage: `HL7|HGB|13.5|${tag}-1`,
        observationCode: 'HGB', observationValue: '13.5',
        // Waktu penerimaan berbeda; isinya sama.
        capturedAt: sekarang,
      }),
    },
    teknisi.token,
  );
  check('pesan yang sama dikirim ulang DITOLAK', kirimUlang.status >= 400,
    `status ${kirimUlang.status}`);

  const jumlahHasil = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_observation
      WHERE device_id = $1 AND raw_message_hash IS NOT NULL`,
    [analyzer.data?.id],
  );
  check('dan hanya satu barisnya yang tersimpan', jumlahHasil[0].n === 1,
    `${jumlahHasil[0].n} baris`);

  // --- 7. Waktu dan kalibrasi ----------------------------------------------
  log('');
  log('7. Dua waktu disimpan terpisah; kalibrasi kedaluwarsa MENANDAI');
  const lama = new Date(Date.now() - 8 * 3600 * 1000).toISOString();
  const hasilTertunda = await api(
    '/health/devices/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer.data?.id,
        rawMessage: `HL7|WBC|8.2|${tag}-2`,
        observationCode: 'WBC', observationValue: '8.2', capturedAt: lama,
      }),
    },
    teknisi.token,
  );
  check('hasil yang tertunda tetap DITERIMA', hasilTertunda.status === 201,
    `status ${hasilTertunda.status} ${pesan(hasilTertunda)}`);
  check('selisih waktunya dihitung', (hasilTertunda.data?.clockDriftMinutes ?? 0) >= 470,
    `${hasilTertunda.data?.clockDriftMinutes} menit`);
  check('dan ditandai, bukan ditolak', hasilTertunda.data?.clockDrifted === true);
  check('sebabnya disebutkan: hasilnya sah',
    (hasilTertunda.data?.warnings ?? []).some((w) => String(w).includes('hasilnya sah')));

  const duaWaktu = await q(
    `SELECT captured_at <> received_at AS berbeda FROM "${SCHEMA}".device_observation
      WHERE device_id = $1 AND observation_code = 'WBC'`,
    [analyzer.data?.id],
  );
  check('kedua waktu tersimpan berbeda', duaWaktu[0]?.berbeda === true);

  const alatKedaluwarsa = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `OLD-${tag.toUpperCase()}`,
        name: 'Analyzer Kalibrasi Lewat', deviceCategory: 'ANALYZER',
        sourceProtocol: 'ASTM', calibratedAt: '2024-01-01', calibrationDueAt: '2025-01-01',
      }),
    },
    teknisi.token,
  );
  await api(
    `/health/devices/${alatKedaluwarsa.data?.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) },
    teknisi.token,
  );
  const hasilKedaluwarsa = await api(
    '/health/devices/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alatKedaluwarsa.data?.id,
        rawMessage: `HL7|PLT|250|${tag}-3`,
        observationCode: 'PLT', observationValue: '250', capturedAt: sekarang,
      }),
    },
    teknisi.token,
  );
  check('hasil dari alat berkalibrasi kedaluwarsa TETAP DITERIMA',
    hasilKedaluwarsa.status === 201, `status ${hasilKedaluwarsa.status}`);
  check('tetapi ditandai', hasilKedaluwarsa.data?.calibrationWarning === true);
  check('dan sebabnya menyebut alat yang mungkin masih benar',
    (hasilKedaluwarsa.data?.warnings ?? []).some((w) => String(w).includes('mungkin masih benar')));

  // --- 8. DOWNTIME ----------------------------------------------------------
  log('');
  log('8. Alat DOWNTIME tidak menerima hasil baru');
  await api(
    `/health/devices/${alatKedaluwarsa.data?.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'DOWNTIME', reason: 'Rusak.' }) },
    teknisi.token,
  );
  const hasilDowntime = await api(
    '/health/devices/observations',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alatKedaluwarsa.data?.id,
        rawMessage: `HL7|PLT|260|${tag}-4`, capturedAt: sekarang,
      }),
    },
    teknisi.token,
  );
  check('hasil dari alat DOWNTIME ditolak', hasilDowntime.status === 422,
    `status ${hasilDowntime.status}`);

  // --- 9. Pengaitan dan telaah ---------------------------------------------
  log('');
  log('9. Yang mengaitkan hasil tidak menelaahnya sendiri');
  const kaitkan = await api(
    `/health/devices/observations/${hasilTanpaPasien.data?.id}/link`,
    { method: 'POST', body: JSON.stringify({ patientId: pasien }) },
    penelaah.token,
  );
  check('hasil dikaitkan manusia', kaitkan.data?.linked === true,
    `status ${kaitkan.status} ${pesan(kaitkan)}`);

  const namaTercatat = await q(
    `SELECT linked_by IS NOT NULL AS ada, link_method FROM "${SCHEMA}".device_observation
      WHERE id = $1`,
    [hasilTanpaPasien.data?.id],
  );
  check('dan namanya tercatat',
    namaTercatat[0]?.ada === true && namaTercatat[0]?.link_method === 'MANUAL');

  const telaahSendiri = await api(
    `/health/devices/observations/${hasilTanpaPasien.data?.id}/review`,
    { method: 'POST', body: JSON.stringify({ accept: true }) },
    penelaah.token,
  );
  check('yang MENGAITKAN tidak menelaahnya sendiri', telaahSendiri.status === 403,
    `status ${telaahSendiri.status}`);
  check('penolakannya menyebut membaca ulang keyakinannya sendiri',
    pesan(telaahSendiri).includes('keyakinannya sendiri'));

  const kaitkanUlang = await api(
    `/health/devices/observations/${hasilTanpaPasien.data?.id}/link`,
    { method: 'POST', body: JSON.stringify({ patientId: pasien }) },
    penelaah.token,
  );
  check('pengaitan yang sudah ada TIDAK ditimpa', kaitkanUlang.status === 409,
    `status ${kaitkanUlang.status}`);
  check('penolakannya menyebut peristiwa tersendiri',
    pesan(kaitkanUlang).includes('peristiwa tersendiri'));

  const hapusHasil = await gagal(
    `DELETE FROM "${SCHEMA}".device_observation WHERE id = $1`,
    [hasilTanpaPasien.data?.id],
  );
  check('hasil alat tidak dapat dihapus',
    (hapusHasil ?? '').includes('LEDGER_IMMUTABLE'), hapusHasil ?? 'lolos');

  // --- 10. Versi perangkat lunak -------------------------------------------
  log('');
  log('10. Perubahan versi perangkat lunak alat ditandai sendiri');
  await q(
    `UPDATE "${SCHEMA}".medical_device SET software_version = '2.2.0' WHERE id = $1`,
    [pompa.data?.id],
  );
  const versiBerubah = await q(
    `SELECT software_version, software_version_changed_at IS NOT NULL AS ditandai
       FROM "${SCHEMA}".medical_device WHERE id = $1`,
    [pompa.data?.id],
  );
  check('perubahan versi ditandai trigger', versiBerubah[0]?.ditandai === true,
    JSON.stringify(versiBerubah[0]));

  const daftarAlat = await api(`/health/devices?facilityId=${facilityId}`, {}, teknisi.token);
  check('daftar alat memuat penanda kalibrasi kedaluwarsa',
    (daftarAlat.data ?? []).some((d) => d.calibration_overdue === true));
  check('dan memuat keadaan kendali jarak jauhnya',
    (daftarAlat.data ?? []).some((d) => d.remote_control_enabled === true) &&
      (daftarAlat.data ?? []).some((d) => d.remote_control_enabled === false));

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
    new URL('../../../docs/emedik/bukti-h9h-alat.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
