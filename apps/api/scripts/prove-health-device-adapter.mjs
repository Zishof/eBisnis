/**
 * Bukti H-9I: adapter protokol alat HL7 v2 dan ASTM.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan naskah ini:
 *
 * 1. **Pesan yang GAGAL DIURAI tetap tersimpan**, beserta sebabnya, dan
 *    permintaannya tetap berhasil. Membuangnya menghilangkan satu-satunya
 *    petunjuk tentang alat yang firmware-nya baru diperbarui.
 *
 * 2. **Pesan asli tidak dapat diubah maupun dihapus.** Naskah ini mencoba
 *    keduanya lewat basis data langsung.
 *
 * 3. **Kode yang belum terpeta tidak ditebak.** Ia masuk antrean, dan
 *    penghitungnya bertambah setiap kali ia muncul lagi.
 *
 * 4. **DICOM ditolak dengan penghalangnya disebut**, bukan dengan "tidak
 *    didukung".
 *
 * Selebihnya: pesan HL7 dan ASTM yang sah terurai benar, duplikat dikenali
 * lewat sidik jari isinya, teknisi tidak memetakan kode, dan pemetaan yang
 * sudah ada tidak ditimpa.
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

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_adp_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9I',FALSE) RETURNING id`,
      [`BUKTI_ADP_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9I — ADAPTER PROTOKOL ALAT HL7 v2 DAN ASTM');
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
    HEALTH_DEVICE_GATEWAY: ['READ', 'CREATE'],
    HEALTH_DEVICE_MESSAGE: ['READ', 'CREATE'],
    HEALTH_DEVICE_CODE_MAP: ['READ'],
  });
  const analis = await buatPengguna(tenantId, 'analis', {
    HEALTH: ['READ'],
    HEALTH_DEVICE: ['READ'],
    HEALTH_DEVICE_MESSAGE: ['READ'],
    HEALTH_DEVICE_CODE_MAP: ['READ', 'CREATE', 'UPDATE'],
  });

  log('');
  log('Dua pengguna. Teknisi menerima pesan tetapi TIDAK memetakan kode; analis');
  log('sebaliknya. Kode yang dipetakan keliru menghasilkan hasil laboratorium yang');
  log('tampak sempurna dan salah seluruhnya.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Adapter','HOSPITAL') RETURNING id`,
      [`BKAD-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Adapter','Asia/Jakarta') RETURNING id`,
      [typeId, `AD-${tag}`],
    )
  )[0].id;

  const gateway = await api(
    '/health/devices/gateways',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `GWA-${tag.toUpperCase()}`, name: 'Gateway Adapter',
        credentialSecretRef: `vault://gwa/${tag}`,
      }),
    },
    teknisi.token,
  );
  const alat = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `HL7-${tag.toUpperCase()}`,
        name: 'Analyzer HL7', deviceCategory: 'ANALYZER', sourceProtocol: 'HL7V2',
      }),
    },
    teknisi.token,
  );
  await api(
    `/health/devices/${alat.data?.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) },
    teknisi.token,
  );

  // --- 1. Protokol ---------------------------------------------------------
  log('');
  log('1. Protokol yang terhalang menyebutkan penghalangnya');
  const protokol = await api('/health/device-adapter/protocols', {}, teknisi.token);
  check('katalog adapter terbaca', protokol.status === 200, `status ${protokol.status}`);
  const dicom = (protokol.data?.protocols ?? []).find((p) => p.code === 'DICOM');
  check('DICOM belum siap', dicom?.ready === false);
  check('dan penghalangnya menyebut PACS', String(dicom?.blockedBy ?? '').includes('PACS'));
  check('setiap yang belum siap menyebutkan penghalangnya',
    (protokol.data?.protocols ?? []).filter((p) => !p.ready).every((p) => Boolean(p.blockedBy)));
  check('HL7 dan ASTM punya pengurai sungguhan',
    (protokol.data?.protocols ?? []).filter((p) => p.hasParser).map((p) => p.code).sort().join(',')
      === 'ASTM,HL7V2');

  const kirimDicom = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, sourceProtocol: 'DICOM', rawMessage: 'DICM',
      }),
    },
    teknisi.token,
  );
  check('pesan DICOM DITOLAK', kirimDicom.status === 422, `status ${kirimDicom.status}`);
  check('penolakannya menyebut cadangan yang tidak dapat dipulihkan',
    pesan(kirimDicom).includes('cadangan'));

  // --- 2. Pesan HL7 yang sah -----------------------------------------------
  log('');
  log('2. Pesan HL7 yang sah terurai benar');
  const hl7Sah = [
    `MSH|^~\\&|ANALYZER1|LAB|EMEDIK|RS|20260801093000||ORU^R01|MSG-${tag}-1|P|2.5`,
    'PID|1||RM000123^^^RS^MR||Tono^Suryo||19700101|M',
    'OBR|1|ORD-9001|LAB-5501|CBC^Darah Lengkap',
    'OBX|1|NM|HGB^Hemoglobin||13.5|g/dL|12.0-16.0|N|||F|||20260801093000',
    'OBX|2|NM|WBC^Leukosit||8.2|10^3/uL|4.0-11.0|N|||F|||20260801093000',
  ].join('\r');

  const terima = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, gatewayId: gateway.data?.id,
        sourceProtocol: 'HL7V2', rawMessage: hl7Sah,
      }),
    },
    teknisi.token,
  );
  check('pesan diterima', terima.status === 201, `status ${terima.status} ${pesan(terima)}`);
  check('dan terurai', terima.data?.parseStatus === 'PARSED');
  check('control ID terbaca', terima.data?.messageControlId === `MSG-${tag}-1`);
  check('jenis pesan terbaca', terima.data?.messageType === 'ORU^R01');
  check('order ID terbaca dari OBR-2', terima.data?.orderId === 'ORD-9001');
  check('pengenal pasien terbaca', terima.data?.patientIdentifier === 'RM000123');
  check('dua hasil terbaca', terima.data?.observationCount === 2);
  check('dibalas ACK AA', terima.data?.ackCode === 'AA');

  const tersimpan = await q(
    `SELECT raw_message, raw_message_hash, parse_status FROM "${SCHEMA}".device_inbound_message
      WHERE id = $1`,
    [terima.data?.id],
  );
  check('PESAN ASLI TERSIMPAN APA ADANYA', tersimpan[0]?.raw_message === hl7Sah);
  check('beserta sidik jarinya', String(tersimpan[0]?.raw_message_hash ?? '').startsWith('sha256:'));

  // --- 3. Kode yang belum terpeta ------------------------------------------
  log('');
  log('3. Kode yang belum terpeta TIDAK ditebak — ia masuk antrean');
  check('kedua kodenya dilaporkan belum terpeta',
    (terima.data?.unmappedCodes ?? []).sort().join(',') === 'HGB,WBC',
    JSON.stringify(terima.data?.unmappedCodes));

  const antrean = await api(
    `/health/device-adapter/code-map/pending?facilityId=${facilityId}`,
    {},
    analis.token,
  );
  check('antrean pemetaan terbaca', antrean.status === 200, `status ${antrean.status}`);
  check('memuat kedua kodenya', (antrean.data?.items ?? []).length === 2,
    `${(antrean.data?.items ?? []).length} baris`);
  check('terurut menurut yang paling sering muncul',
    String(antrean.data?.note ?? '').includes('tiga ratus hasil'));

  // Pesan kedua dengan kode yang sama tetapi isi berbeda.
  const hl7Kedua = hl7Sah.replace(`MSG-${tag}-1`, `MSG-${tag}-2`).replace('13.5', '14.1');
  await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, sourceProtocol: 'HL7V2', rawMessage: hl7Kedua,
      }),
    },
    teknisi.token,
  );
  const penghitung = await q(
    `SELECT occurrence_count FROM "${SCHEMA}".device_code_pending
      WHERE facility_id = $1 AND upper(device_code) = 'HGB' AND resolved_at IS NULL`,
    [facilityId],
  );
  check('penghitungnya bertambah ketika kodenya muncul lagi',
    Number(penghitung[0]?.occurrence_count) === 2, `${penghitung[0]?.occurrence_count}`);

  // --- 4. Duplikat ---------------------------------------------------------
  log('');
  log('4. Duplikat dikenali lewat sidik jari isinya');
  const ulang = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, sourceProtocol: 'HL7V2', rawMessage: hl7Sah,
      }),
    },
    teknisi.token,
  );
  check('pesan yang sama dikirim ulang DITOLAK', ulang.status === 409, `status ${ulang.status}`);
  check('penolakannya menyebut simpanan yang dikirim ulang begitu tersambung',
    pesan(ulang).includes('begitu tersambung'));

  // --- 5. Pesan yang gagal diurai TETAP TERSIMPAN --------------------------
  log('');
  log('5. PESAN YANG GAGAL DIURAI TETAP TERSIMPAN');
  const sebelum = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_inbound_message WHERE facility_id = $1`,
    [facilityId],
  );

  const rusak = `MSH|^~\\&|ANALYZER1|LAB|EMEDIK|RS|20260801093000||ORU^R01|MSG-${tag}-RUSAK|P|2.5\rPID|1||RM9`;
  const kirimRusak = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, sourceProtocol: 'HL7V2', rawMessage: rusak,
      }),
    },
    teknisi.token,
  );
  check('permintaannya TETAP BERHASIL', kirimRusak.status === 201,
    `status ${kirimRusak.status} ${pesan(kirimRusak)}`);
  check('statusnya FAILED', kirimRusak.data?.parseStatus === 'FAILED');
  check('dan pesannya tersimpan', kirimRusak.data?.stored === true);
  check('sebabnya disebutkan', (kirimRusak.data?.findings ?? []).some((f) => f.kode === 'NO_OBX'));
  check('dibalas AE, BUKAN AR', kirimRusak.data?.ackCode === 'AE');

  const sesudah = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_inbound_message WHERE facility_id = $1`,
    [facilityId],
  );
  check('jumlah pesan bertambah satu', sesudah[0].n === sebelum[0].n + 1,
    `${sebelum[0].n} -> ${sesudah[0].n}`);

  const tembusTanpaSebab = await gagal(
    `INSERT INTO "${SCHEMA}".device_inbound_message
       (facility_id, source_protocol, raw_message, raw_message_hash, parse_status)
     VALUES ($1,'HL7V2','x',$2,'FAILED')`,
    [facilityId, `sha256:tanpa-sebab-${tag}`],
  );
  check('pesan gagal TANPA sebab ditolak constraint',
    (tembusTanpaSebab ?? '').includes('device_msg_failure_explained'), tembusTanpaSebab ?? 'lolos');

  const daftarGagal = await api(
    `/health/device-adapter/messages?facilityId=${facilityId}&failedOnly=true`,
    {},
    teknisi.token,
  );
  check('papan pesan gagal memuatnya', (daftarGagal.data ?? []).length === 1,
    `${(daftarGagal.data ?? []).length} baris`);

  // --- 6. Pesan asli tidak dapat diubah ------------------------------------
  log('');
  log('6. Pesan asli tidak dapat diubah maupun dihapus');
  const ubahIsi = await gagal(
    `UPDATE "${SCHEMA}".device_inbound_message SET raw_message = 'diubah' WHERE id = $1`,
    [terima.data?.id],
  );
  check('mengubah isinya ditolak trigger',
    (ubahIsi ?? '').includes('INBOUND_MESSAGE_IMMUTABLE'), ubahIsi ?? 'lolos');

  const ubahSidik = await gagal(
    `UPDATE "${SCHEMA}".device_inbound_message SET raw_message_hash = 'sha256:palsu' WHERE id = $1`,
    [terima.data?.id],
  );
  check('mengubah sidik jarinya pun ditolak',
    (ubahSidik ?? '').includes('INBOUND_MESSAGE_IMMUTABLE'), ubahSidik ?? 'lolos');

  const hapusPesan = await gagal(
    `DELETE FROM "${SCHEMA}".device_inbound_message WHERE id = $1`,
    [terima.data?.id],
  );
  check('menghapusnya ditolak',
    (hapusPesan ?? '').includes('INBOUND_MESSAGE_IMMUTABLE'), hapusPesan ?? 'lolos');
  check('alasannya menyebut apakah yang tersimpan sama dengan yang dikirim alat',
    (hapusPesan ?? '').includes('yang dikirim alat'));

  const ubahProses = await gagal(
    `UPDATE "${SCHEMA}".device_inbound_message SET processed_at = now() WHERE id = $1`,
    [terima.data?.id],
  );
  check('UJI KENDALI: penanda pemrosesannya MASIH boleh berubah', ubahProses === null,
    ubahProses ?? '');

  const bacaAsli = await api(
    `/health/device-adapter/messages/${terima.data?.id}`,
    {},
    teknisi.token,
  );
  check('pesan asli dapat dibuka kembali apa adanya',
    bacaAsli.data?.raw_message === hl7Sah, `status ${bacaAsli.status}`);

  // --- 7. Pemetaan kode ----------------------------------------------------
  log('');
  log('7. Yang menerima pesan TIDAK memetakan kodenya');
  const teknisiPetakan = await api(
    '/health/device-adapter/code-map',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, deviceCode: 'HGB', localCode: 'LAB-HB',
      }),
    },
    teknisi.token,
  );
  check('teknisi tidak berwenang memetakan', teknisiPetakan.status === 403,
    `status ${teknisiPetakan.status}`);

  const petakan = await api(
    '/health/device-adapter/code-map',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, deviceCode: 'HGB', localCode: 'LAB-HB',
        deviceUnit: 'g/dL', localUnit: 'g/dL',
      }),
    },
    analis.token,
  );
  check('analis laboratorium memetakannya', petakan.status === 201,
    `status ${petakan.status} ${pesan(petakan)}`);
  check('dan antreannya ikut terselesaikan', petakan.data?.resolvedPending === 1,
    `${petakan.data?.resolvedPending}`);

  const petakanUlang = await api(
    '/health/device-adapter/code-map',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, deviceCode: 'HGB', localCode: 'LAB-LAIN',
      }),
    },
    analis.token,
  );
  check('pemetaan yang sudah ada TIDAK ditimpa', petakanUlang.status === 409,
    `status ${petakanUlang.status}`);
  check('penolakannya menyebut hasil lama yang dipersengketakan',
    pesan(petakanUlang).includes('dipersengketakan'));

  const tembusPeta = await gagal(
    `INSERT INTO "${SCHEMA}".device_code_map (facility_id, device_id, device_code, local_code, mapped_by)
     VALUES ($1,$2,'hgb','LAB-TEMBUS',gen_random_uuid())`,
    [facilityId, alat.data?.id],
  );
  check('pemetaan ganda lewat basis data ditolak indeks unik',
    (tembusPeta ?? '').includes('ux_device_map_active'), tembusPeta ?? 'lolos');

  const nonaktif = await api(
    `/health/device-adapter/code-map/${petakan.data?.id}/deactivate`,
    { method: 'POST' },
    analis.token,
  );
  check('pemetaan dapat dinonaktifkan', nonaktif.data?.active === false,
    `status ${nonaktif.status}`);
  const masihAda = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_code_map WHERE id = $1`,
    [petakan.data?.id],
  );
  check('dan barisnya TETAP TERSIMPAN sebagai riwayat', masihAda[0].n === 1);

  const petakanLagi = await api(
    '/health/device-adapter/code-map',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, deviceCode: 'HGB', localCode: 'LAB-HB-BARU',
      }),
    },
    analis.token,
  );
  check('UJI KENDALI: sesudah dinonaktifkan, kodenya boleh dipetakan ulang',
    petakanLagi.status === 201, `status ${petakanLagi.status} ${pesan(petakanLagi)}`);

  // --- 8. ASTM -------------------------------------------------------------
  log('');
  log('8. Pesan ASTM terurai benar');
  const alatAstm = await api(
    '/health/devices',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, gatewayId: gateway.data?.id, code: `AST-${tag.toUpperCase()}`,
        name: 'Analyzer ASTM', deviceCategory: 'ANALYZER', sourceProtocol: 'ASTM',
      }),
    },
    teknisi.token,
  );
  await api(
    `/health/devices/${alatAstm.data?.id}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) },
    teknisi.token,
  );

  const astm = [
    `H|\\^&|||ANALYZER2^1.0|||||||P|1|20260801093000`,
    'P|1||RM000456||Sari^Dewi||19800505|F',
    `O|1|ORD-${tag}||^^^CBC|R|20260801090000`,
    'R|1|^^^PLT|250|10*3/uL|150-400|N||F||||20260801093000',
    'L|1|N',
  ].join('\r\n');

  const terimaAstm = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alatAstm.data?.id, sourceProtocol: 'ASTM', rawMessage: astm,
      }),
    },
    teknisi.token,
  );
  check('pesan ASTM diterima dan terurai', terimaAstm.data?.parseStatus === 'PARSED',
    `status ${terimaAstm.status} ${pesan(terimaAstm)}`);
  check('order ID terbaca', terimaAstm.data?.orderId === `ORD-${tag}`);
  check('pengenal pasien terbaca', terimaAstm.data?.patientIdentifier === 'RM000456');
  check('hasilnya terbaca', terimaAstm.data?.observationCount === 1);

  // --- 9. Urai tanpa menyimpan ---------------------------------------------
  log('');
  log('9. Penguraian percobaan tidak menyimpan apa pun');
  const jumlahSebelum = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_inbound_message WHERE facility_id = $1`,
    [facilityId],
  );
  const uraiSaja = await api(
    '/health/device-adapter/parse',
    { method: 'POST', body: JSON.stringify({ sourceProtocol: 'HL7V2', rawMessage: hl7Sah }) },
    teknisi.token,
  );
  check('penguraian percobaan berhasil', uraiSaja.data?.valid === true,
    `status ${uraiSaja.status} ${pesan(uraiSaja)}`);
  check('dan ditandai sebagai percobaan', uraiSaja.data?.dryRun === true);
  const jumlahSesudah = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".device_inbound_message WHERE facility_id = $1`,
    [facilityId],
  );
  check('tidak ada pesan baru tersimpan', jumlahSesudah[0].n === jumlahSebelum[0].n,
    `${jumlahSebelum[0].n} -> ${jumlahSesudah[0].n}`);

  // --- 10. Jenis pesan tertutup --------------------------------------------
  log('');
  log('10. Jenis pesan adalah daftar TERTUTUP');
  const adt = [
    `MSH|^~\\&|HIS|RS|EMEDIK|RS|20260801093000||ADT^A01|MSG-${tag}-ADT|P|2.5`,
    'PID|1||RM000789||Budi^Santoso||19900101|M',
    'OBX|1|NM|HGB||13.0|g/dL',
  ].join('\r');
  const kirimAdt = await api(
    '/health/device-adapter/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: alat.data?.id, sourceProtocol: 'HL7V2', rawMessage: adt,
      }),
    },
    teknisi.token,
  );
  check('pesan ADT tersimpan tetapi berstatus FAILED',
    kirimAdt.status === 201 && kirimAdt.data?.parseStatus === 'FAILED',
    `status ${kirimAdt.status} ${kirimAdt.data?.parseStatus}`);
  check('sebabnya menyebut jenis pesan yang tidak diterima',
    (kirimAdt.data?.findings ?? []).some((f) => f.kode === 'UNSUPPORTED_MESSAGE_TYPE'));
  check('dan menjelaskan mengapa ADT bukan urusan alat',
    (kirimAdt.data?.findings ?? []).some((f) => String(f.pesan).includes('bukan dari alat')));

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
    new URL('../../../docs/emedik/bukti-h9i-adapter-alat.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
