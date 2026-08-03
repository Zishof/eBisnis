/**
 * Bukti H-9J: pemeliharaan biomedis, kalibrasi, dan keamanan siber alat.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan naskah ini adalah sesuatu yang **tidak
 * terjadi**: seluruh modul H-9J dijalankan dari ujung ke ujung — pekerjaan
 * dibuka, pemeliharaan dibiarkan terlambat dua tahun, risiko dinilai CRITICAL
 * dengan enam faktor berat, insiden penyanderaan data dilaporkan — lalu status
 * alatnya dibaca kembali dan dituntut **tidak berubah**.
 *
 * Aturan "perangkat lunak tidak mematikan alat medis" adalah aturan yang paling
 * mudah dilanggar tanpa sengaja oleh orang yang menambahkan "supaya lebih
 * aman", dan pelanggarannya tidak menimbulkan galat: ia hanya menghentikan
 * ventilator pada pasien yang sedang memakainya.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - pekerjaan korektif yang mengenai pasien tanpa tautan insidennya;
 * - insiden siber yang mengenai perawatan tanpa laporan keselamatan pasien;
 * - kalibrasi lulus tanpa standar acuan;
 * - alat kembali melayani dengan pekerjaan yang masih terbuka;
 * - alat kembali melayani sesudah uji keselamatan listriknya GAGAL;
 * - penahan risiko tanpa rujukan bukti;
 * - penerimaan risiko tanpa tanggal tinjau;
 * - dan penilai yang memutuskan penerimaannya sendiri.
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

// Tanggal dihitung relatif terhadap hari berjalan — pelajaran H-9G. Naskah
// bertanggal tetap lulus hari ini dan gagal bulan depan, dan yang gagal bulan
// depan akan disangka kerusakan kode.
const hari = (n) => {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const HARI_INI = hari(0);

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
  const username = `bukti_rwt_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9J',FALSE) RETURNING id`,
      [`BUKTI_RWT_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9J — PEMELIHARAAN BIOMEDIS, KALIBRASI, DAN KEAMANAN SIBER ALAT');
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
    HEALTH_DEVICE_MAINTENANCE: ['READ', 'CREATE', 'UPDATE', 'RELEASE'],
    HEALTH_DEVICE_SECURITY: ['READ'],
  });
  const analis = await buatPengguna(tenantId, 'analis', {
    HEALTH: ['READ'],
    HEALTH_DEVICE: ['READ'],
    HEALTH_DEVICE_SECURITY: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_DEVICE_MAINTENANCE: ['READ'],
  });
  const manajemen = await buatPengguna(tenantId, 'manajemen', {
    HEALTH: ['READ'],
    HEALTH_DEVICE: ['READ'],
    // CREATE diberikan pula, dan itu disengaja: tanpa hak menilai, penolakan
    // "yang menilai tidak memutuskan sendiri" akan datang dari penjaga hak
    // akses alih-alih dari pemeriksaan baris — dan ujinya akan lulus karena
    // penjaga yang keliru. Pelajaran H-9 dan H-9F, diterapkan sejak awal.
    HEALTH_DEVICE_SECURITY: ['READ', 'CREATE', 'APPROVE'],
  });

  log('');
  log('Tiga pengguna. Teknisi memelihara alat; analis menilai risiko siber tetapi');
  log('TIDAK memutuskan dan TIDAK dapat menyentuh alatnya; manajemen memutuskan');
  log('tetapi tidak menilai.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Rawat Alat','HOSPITAL') RETURNING id`,
      [`BKRW-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Rawat Alat','Asia/Jakarta') RETURNING id`,
      [typeId, `RW-${tag}`],
    )
  )[0].id;
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Sari Bukti Rawat','1980-05-05','FEMALE') RETURNING id`,
      [`EPI-RW-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  const gateway = await api(
    '/health/devices/gateways',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `GWJ-${tag.toUpperCase()}`, name: 'Gateway Bangsal',
        credentialSecretRef: `vault://gwj/${tag}`,
      }),
    },
    teknisi.token,
  );

  const buatAlat = async (kode, nama, kategori, tambahan = {}) => {
    const r = await api(
      '/health/devices',
      {
        method: 'POST',
        body: JSON.stringify({
          facilityId, gatewayId: gateway.data?.id, code: kode, name: nama,
          deviceCategory: kategori, sourceProtocol: 'IEEE_11073',
          calibratedAt: hari(-200), calibrationDueAt: hari(165), ...tambahan,
        }),
      },
      teknisi.token,
    );
    if (r.status !== 201) throw new Error(`buat alat ${kode} gagal: ${pesan(r)}`);
    await api(
      `/health/devices/${r.data.id}/status`,
      { method: 'POST', body: JSON.stringify({ status: 'ACTIVE' }) },
      teknisi.token,
    );
    return r.data.id;
  };

  const ventilator = await buatAlat(`VNT-${tag.toUpperCase()}`, 'Ventilator ICU 2', 'VENTILATOR');
  const analyzer = await buatAlat(`ANJ-${tag.toUpperCase()}`, 'Analyzer Kimia', 'ANALYZER');
  const defib = await buatAlat(`DFB-${tag.toUpperCase()}`, 'Defibrilator IGD', 'OTHER');

  // Ventilator terhubung pasien dan pemeliharaannya terlambat dua tahun.
  await q(
    `UPDATE "${SCHEMA}".medical_device
        SET patient_connected = TRUE, maintenance_interval_days = 180,
            last_maintenance_at = $2::date, os_end_of_life = TRUE
      WHERE id = $1`,
    [ventilator, hari(-900)],
  );

  const statusAwal = await q(
    `SELECT id, status FROM "${SCHEMA}".medical_device WHERE id = ANY($1::uuid[]) ORDER BY code`,
    [[ventilator, analyzer, defib]],
  );

  // --- 1. Pemeliharaan menandai, tidak menghentikan -------------------------
  log('');
  log('1. KETERLAMBATAN PEMELIHARAAN MENANDAI, TIDAK MENGHENTIKAN');
  const papan = await api(
    `/health/device-maintenance/schedule?facilityId=${facilityId}`,
    {},
    teknisi.token,
  );
  check('papan pemeliharaan terbaca', papan.status === 200, `status ${papan.status} ${pesan(papan)}`);
  const barisVent = (papan.data?.items ?? []).find((d) => d.id === ventilator);
  check('ventilator tercatat terlambat', barisVent?.maintenance?.terlambat === true,
    JSON.stringify(barisVent?.maintenance ?? {}));
  check('keterlambatannya lebih dari 700 hari', (barisVent?.maintenance?.terlambatHari ?? 0) > 700,
    `${barisVent?.maintenance?.terlambatHari} hari`);
  check('tetapi TIDAK menghentikan layanan',
    barisVent?.maintenance?.menghentikanLayanan === false);
  check('dan alatnya masih ACTIVE', barisVent?.status === 'ACTIVE', barisVent?.status);
  check('papannya menyatakannya tegas, bukan hanya di dokumentasi',
    String(papan.data?.note ?? '').includes('dipilih kalender'));

  // --- 2. Tautan insiden keselamatan pasien --------------------------------
  log('');
  log('2. Pekerjaan korektif yang mengenai pasien WAJIB menunjuk insidennya');
  const tanpaTaut = await api(
    '/health/device-maintenance/work-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator, workType: 'CORRECTIVE',
        description: 'Alarm tidak berbunyi ketika sirkuit terlepas.',
        affectedPatient: true,
      }),
    },
    teknisi.token,
  );
  check('pekerjaan korektif tanpa tautan insiden DITOLAK', tanpaTaut.status === 422,
    `status ${tanpaTaut.status}`);
  check('penolakannya menyebut alat merek itu sudah tiga kali',
    pesan(tanpaTaut).includes('sudah tiga kali'));

  const insidenPasien = (
    await q(
      `INSERT INTO "${SCHEMA}".safety_incident
         (incident_number, facility_id, patient_id, incident_type, occurred_at, description,
          harm_level, reached_patient, grade)
       VALUES ($1,$2,$3,'DEVICE',now(),'Alarm ventilator tidak berbunyi saat sirkuit terlepas.',
               'MODERATE',TRUE,'YELLOW') RETURNING id`,
      [`IKP-RW-${tag}`, facilityId, pasien],
    )
  )[0].id;

  const denganTaut = await api(
    '/health/device-maintenance/work-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator, workType: 'CORRECTIVE', priority: 'URGENT',
        description: 'Alarm tidak berbunyi ketika sirkuit terlepas.',
        affectedPatient: true, safetyIncidentId: insidenPasien,
      }),
    },
    teknisi.token,
  );
  check('yang tertaut diterima', denganTaut.status === 201,
    `status ${denganTaut.status} ${pesan(denganTaut)}`);
  check('dan status alat TIDAK berubah karenanya', denganTaut.data?.deviceStatus === 'ACTIVE',
    denganTaut.data?.deviceStatus);
  check('pesannya menyebut membuka pekerjaan tidak menghentikan alat',
    String(denganTaut.data?.note ?? '').includes('tidak menghentikan alat'));

  const tembusTaut = await gagal(
    `INSERT INTO "${SCHEMA}".device_work_order
       (facility_id, device_id, work_order_number, work_type, description, affected_patient)
     VALUES ($1,$2,$3,'CORRECTIVE','Menembus tautan insiden pasien.',TRUE)`,
    [facilityId, ventilator, `WO-TEMBUS-${tag}`],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusTaut ?? '').includes('device_wo_patient_needs_incident'), tembusTaut ?? 'lolos');

  // --- 3. Alat tidak kembali melayani dengan pekerjaan terbuka -------------
  log('');
  log('3. Alat tidak kembali melayani selama pekerjaannya masih terbuka');
  const kembaliDini = await api(
    `/health/device-maintenance/devices/${ventilator}/return-to-service`,
    { method: 'POST' },
    teknisi.token,
  );
  check('dikembalikan dengan pekerjaan terbuka DITOLAK', kembaliDini.status === 422,
    `status ${kembaliDini.status}`);
  check('penolakannya menyebut alat yang dilupakan seseorang',
    pesan(kembaliDini).includes('dilupakan seseorang'));
  check('dan menyebut nomor pekerjaannya',
    pesan(kembaliDini).includes(denganTaut.data?.workOrderNumber ?? '#'));

  await api(
    `/health/device-maintenance/work-orders/${denganTaut.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({ completionNote: 'Modul alarm diganti; diuji ulang.', downtimeMinutes: 45 }),
    },
    teknisi.token,
  );
  const kembaliSah = await api(
    `/health/device-maintenance/devices/${ventilator}/return-to-service`,
    { method: 'POST' },
    teknisi.token,
  );
  check('sesudah pekerjaannya ditutup, alat kembali melayani',
    kembaliSah.data?.status === 'ACTIVE', `status ${kembaliSah.status} ${pesan(kembaliSah)}`);

  // --- 4. Kalibrasi --------------------------------------------------------
  log('');
  log('4. Kalibrasi wajib menyebut standar acuannya');
  const woKal = await api(
    '/health/device-maintenance/work-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer, workType: 'CALIBRATION',
        description: 'Kalibrasi tahunan analyzer kimia.',
      }),
    },
    teknisi.token,
  );
  const tanpaStandar = await api(
    `/health/device-maintenance/work-orders/${woKal.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({ completionNote: 'Sudah dikalibrasi.', inspectionResult: 'PASS' }),
    },
    teknisi.token,
  );
  check('kalibrasi LULUS tanpa standar acuan DITOLAK', tanpaStandar.status === 422,
    `status ${tanpaStandar.status}`);
  check('penolakannya menyebut menekan tombol',
    pesan(tanpaStandar).includes('menekan tombol'));

  const tutupKal = await api(
    `/health/device-maintenance/work-orders/${woKal.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({
        completionNote: 'Kalibrasi selesai; seluruh titik dalam batas.',
        inspectionResult: 'PASS',
        referenceStandard: 'Kalibrator tertelusur KAN — sertifikat 44/2026',
        validUntil: hari(365),
      }),
    },
    teknisi.token,
  );
  check('kalibrasi berstandar diterima', tutupKal.status === 201 || tutupKal.status === 200,
    `status ${tutupKal.status} ${pesan(tutupKal)}`);

  const riwayat = await api(
    `/health/device-maintenance/devices/${analyzer}/calibrations`,
    {},
    teknisi.token,
  );
  check('riwayat kalibrasinya tercatat tersendiri', (riwayat.data ?? []).length === 1,
    `${(riwayat.data ?? []).length} baris`);

  const terkalibrasi = await api(
    `/health/device-maintenance/devices/${analyzer}/calibrated-on?date=${HARI_INI}`,
    {},
    teknisi.token,
  );
  check('pertanyaan "terkalibrasi pada tanggal itu?" dapat dijawab',
    terkalibrasi.data?.calibrated === true, JSON.stringify(terkalibrasi.data ?? {}));

  const jauhLampau = await api(
    `/health/device-maintenance/devices/${analyzer}/calibrated-on?date=${hari(-400)}`,
    {},
    teknisi.token,
  );
  check('dan tanggal yang tidak tertutupi dijawab jujur', jauhLampau.data?.calibrated === false);
  check('jawabannya tidak berlebihan: bukan berarti hasilnya salah',
    String(jauhLampau.data?.note ?? '').includes('bukan berarti hasilnya salah'));

  const tembusStandar = await gagal(
    `INSERT INTO "${SCHEMA}".device_calibration_record
       (device_id, performed_on, valid_until, result)
     VALUES ($1, CURRENT_DATE, CURRENT_DATE + 365, 'PASS')`,
    [analyzer],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusStandar ?? '').includes('device_cal_standard_required'), tembusStandar ?? 'lolos');

  // --- 5. Uji keselamatan listrik ------------------------------------------
  log('');
  log('5. UJI KESELAMATAN LISTRIK YANG GAGAL — satu-satunya penahan keras');
  const woUji = await api(
    '/health/device-maintenance/work-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: defib, workType: 'SAFETY_INSPECTION',
        description: 'Uji keselamatan listrik tahunan defibrilator.',
      }),
    },
    teknisi.token,
  );
  const tutupUji = await api(
    `/health/device-maintenance/work-orders/${woUji.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({
        completionNote: 'Arus bocor casing 620 uA, melampaui ambang.',
        inspectionResult: 'FAIL',
        measuredValues: 'Arus bocor casing: 620 uA (ambang 500 uA)',
      }),
    },
    teknisi.token,
  );
  check('pekerjaannya ditutup dengan hasil GAGAL',
    (tutupUji.data?.warnings ?? []).length >= 1, `status ${tutupUji.status} ${pesan(tutupUji)}`);
  check('peringatannya menyebut menyetrum',
    (tutupUji.data?.warnings ?? []).some((w) => String(w).includes('menyetrum')));

  await api(
    `/health/devices/${defib}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'MAINTENANCE', reason: 'Uji listrik gagal.' }) },
    teknisi.token,
  );
  const kembaliGagal = await api(
    `/health/device-maintenance/devices/${defib}/return-to-service`,
    { method: 'POST' },
    teknisi.token,
  );
  check('alat yang uji listriknya GAGAL tidak boleh kembali melayani',
    kembaliGagal.status === 422, `status ${kembaliGagal.status}`);
  check('dan sebabnya dibedakan tegas dari kalibrasi',
    pesan(kembaliGagal).includes('kalibrasi') && pesan(kembaliGagal).includes('menyetrum'));

  const tembusUji = await gagal(
    `UPDATE "${SCHEMA}".medical_device SET status = 'ACTIVE' WHERE id = $1`,
    [defib],
  );
  check('menembusnya lewat basis data ditolak trigger',
    (tembusUji ?? '').includes('DEVICE_SAFETY_FAILED'), tembusUji ?? 'lolos');

  /*
   * UJI KENDALI — dan justru inilah yang menemukan cacatnya.
   *
   * Yang dijaga adalah PERALIHAN masuk ke pelayanan, bukan KEADAAN berada di
   * dalamnya. Alat yang sudah ACTIVE dan sedang dipakai pasien harus tetap
   * dapat DITANDAI ketika uji listriknya gagal — versi pertama penjaganya
   * memeriksa keadaan, sehingga teknisi yang menemukan arus bocor pada alat
   * yang sedang menyala tidak dapat mencatat temuannya sama sekali.
   */
  const woUji2 = await api(
    '/health/device-maintenance/work-orders',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer, workType: 'SAFETY_INSPECTION',
        description: 'Uji keselamatan listrik analyzer, alat sedang melayani.',
      }),
    },
    teknisi.token,
  );
  const tutupUji2 = await api(
    `/health/device-maintenance/work-orders/${woUji2.data?.id}/close`,
    {
      method: 'POST',
      body: JSON.stringify({
        completionNote: 'Arus bocor 700 uA pada alat yang sedang ACTIVE.',
        inspectionResult: 'FAIL',
      }),
    },
    teknisi.token,
  );
  check('alat yang SEDANG MELAYANI tetap dapat ditandai gagal uji listrik',
    tutupUji2.status === 201 || tutupUji2.status === 200,
    `status ${tutupUji2.status} ${pesan(tutupUji2)}`);
  const analyzerSesudah = await q(
    `SELECT status, safety_inspection_failed FROM "${SCHEMA}".medical_device WHERE id = $1`,
    [analyzer],
  );
  check('penandanya tersimpan', analyzerSesudah[0]?.safety_inspection_failed === true);
  check('dan alatnya TIDAK dihentikan basis data', analyzerSesudah[0]?.status === 'ACTIVE',
    analyzerSesudah[0]?.status);

  // --- 6. Penilaian risiko siber -------------------------------------------
  log('');
  log('6. Penahan pengganti wajib BERBUKTI, dan tidak menghilangkan risiko');
  const katalog = await api('/health/device-maintenance/risk/catalog', {}, analis.token);
  check('katalog risiko terbaca', katalog.status === 200, `status ${katalog.status}`);
  check('setiap faktor menyebut alasannya',
    (katalog.data?.faktor ?? []).every((f) => String(f.alasan).length > 20));
  check('setiap penahan pun', (katalog.data?.penahan ?? []).every((p) => String(p.alasan).length > 20));

  const tanpaBukti = await api(
    '/health/device-maintenance/risk',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator,
        faktor: ['OS_END_OF_LIFE', 'DEFAULT_CREDENTIALS'],
        penahan: [{ kode: 'NETWORK_SEGMENTED' }],
      }),
    },
    analis.token,
  );
  check('penahan TANPA rujukan bukti tidak dihitung', tanpaBukti.data?.pengurang === 0,
    `pengurang ${tanpaBukti.data?.pengurang}`);
  check('dan penolakannya menyebut kotak yang dicentang',
    (tanpaBukti.data?.penahanDitolak ?? []).some((p) => String(p.alasan).includes('kotak yang dicentang')));

  const penuhPenahan = await api(
    '/health/device-maintenance/risk',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: analyzer,
        faktor: ['OS_END_OF_LIFE', 'VENDOR_SUPPORT_ENDED', 'STORES_PHI'],
        penahan: [
          { kode: 'NETWORK_SEGMENTED', buktiRef: 'DIAGRAM-VLAN-2026' },
          { kode: 'ACCESS_RESTRICTED', buktiRef: 'ACL-GW-2026' },
          { kode: 'TRAFFIC_MONITORED', buktiRef: 'SIEM-RULE-118' },
          { kode: 'PHYSICALLY_SECURED', buktiRef: 'BA-KUNCI-2026' },
          { kode: 'OFFLINE_PROCEDURE', buktiRef: 'SOP-LURING-LAB-03' },
        ],
      }),
    },
    analis.token,
  );
  check('dengan penahan lengkap, pengurangnya melampaui skor bawaannya',
    (penuhPenahan.data?.pengurang ?? 0) > (penuhPenahan.data?.skorBawaan ?? 0),
    `${penuhPenahan.data?.pengurang} vs ${penuhPenahan.data?.skorBawaan}`);
  check('TETAPI RISIKO SISANYA TIDAK NOL', (penuhPenahan.data?.skorSisa ?? 0) > 0,
    `sisa ${penuhPenahan.data?.skorSisa}`);
  check('lantainya sepertiga skor bawaan',
    penuhPenahan.data?.skorSisa === Math.ceil((penuhPenahan.data?.skorBawaan ?? 0) / 3));
  check('dan itu diberitahukan, bukan disembunyikan',
    (penuhPenahan.data?.catatan ?? []).some((c) => String(c).includes('dapat ditanggung')));

  const tembusLantai = await gagal(
    `INSERT INTO "${SCHEMA}".device_risk_assessment
       (facility_id, device_id, inherent_score, mitigation_score, residual_score, risk_level)
     VALUES ($1,$2,9,20,0,'LOW')`,
    [facilityId, analyzer],
  );
  check('menembus lantai lewat basis data ditolak constraint',
    (tembusLantai ?? '').includes('device_risk_residual_floor'), tembusLantai ?? 'lolos');

  // --- 7. CRITICAL tidak mematikan alat ------------------------------------
  log('');
  log('7. RISIKO CRITICAL TIDAK MEMATIKAN ALAT');
  const kritis = await api(
    '/health/device-maintenance/risk',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator,
        faktor: ['OS_END_OF_LIFE', 'VENDOR_SUPPORT_ENDED', 'DEFAULT_CREDENTIALS',
                 'INTERNET_REACHABLE', 'REMOTE_CONTROL', 'PATIENT_CONNECTED'],
        penahan: [],
      }),
    },
    analis.token,
  );
  check('penilaian menghasilkan CRITICAL', kritis.data?.tingkat === 'CRITICAL',
    `${kritis.data?.tingkat} skor ${kritis.data?.skorSisa}`);
  check('menuntut keputusan dalam 7 hari', kritis.data?.decisionDueOn === hari(7),
    `${kritis.data?.decisionDueOn} vs ${hari(7)}`);
  check('TETAPI TIDAK MEMATIKAN ALAT', kritis.data?.deviceDisabled === false);
  check('dan jawabannya menyatakannya tegas',
    String(kritis.data?.note ?? '').includes('tidak memutus alat dari pasien'));
  check('gabungan internet + kata sandi bawaan diberi catatan tersendiri',
    (kritis.data?.catatan ?? []).some((c) => String(c).includes('membaca manual')));

  const statusSesudahKritis = await q(
    `SELECT status FROM "${SCHEMA}".medical_device WHERE id = $1`,
    [ventilator],
  );
  check('ventilator MASIH ACTIVE sesudah dinilai CRITICAL',
    statusSesudahKritis[0]?.status === 'ACTIVE', statusSesudahKritis[0]?.status);

  // --- 8. Keputusan risiko -------------------------------------------------
  log('');
  log('8. Yang menilai tidak memutuskan penerimaannya sendiri');
  /*
   * Manajemen menilai satu alat SENDIRI lebih dahulu.
   *
   * Ia memegang CREATE maupun APPROVE, sehingga penjaga hak akses tidak akan
   * menolaknya. Satu-satunya yang tersisa untuk menolaknya adalah pemeriksaan
   * baris: yang menilai bukan yang memutuskan. Tanpa penyusunan ini, ujinya
   * akan lulus karena penjaga yang keliru — dan itu berarti tidak membuktikan
   * apa pun tentang pemeriksaan barisnya.
   */
  const nilaiSendiri = await api(
    '/health/device-maintenance/risk',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: defib,
        faktor: ['OS_END_OF_LIFE', 'REMOVABLE_MEDIA'],
        penahan: [],
      }),
    },
    manajemen.token,
  );
  check('manajemen boleh menilai risiko', nilaiSendiri.status === 201,
    `status ${nilaiSendiri.status} ${pesan(nilaiSendiri)}`);

  const putusSendiri = await api(
    `/health/device-maintenance/risk/${nilaiSendiri.data?.id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: 'ACCEPT',
        reason: 'Defibrilator dipakai IGD dan penggantinya belum tiba kuartal ini.',
        reviewDueOn: hari(90),
      }),
    },
    manajemen.token,
  );
  check('tetapi TIDAK memutuskan penilaiannya sendiri', putusSendiri.status === 403,
    `status ${putusSendiri.status} ${pesan(putusSendiri)}`);
  check('penolakannya menyebut ditanggung rumah sakit',
    pesan(putusSendiri).includes('ditanggung rumah sakit'));

  const tanpaTinjau = await api(
    `/health/device-maintenance/risk/${kritis.data?.id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: 'ACCEPT',
        reason: 'Ventilator menopang layanan ICU dan penggantinya belum tiba.',
      }),
    },
    manajemen.token,
  );
  check('PENERIMAAN TANPA TANGGAL TINJAU DITOLAK', tanpaTinjau.status === 422,
    `status ${tanpaTinjau.status}`);
  check('penolakannya menyebut orang yang sudah pensiun',
    pesan(tanpaTinjau).includes('sudah pensiun'));

  const putusSah = await api(
    `/health/device-maintenance/risk/${kritis.data?.id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: 'ACCEPT',
        reason: 'Ventilator menopang layanan ICU dan penggantinya baru tiba kuartal depan; ' +
          'segmentasi jaringan dipercepat sementara itu.',
        reviewDueOn: hari(90),
      }),
    },
    manajemen.token,
  );
  check('manajemen menerimanya dengan tanggal tinjau', putusSah.data?.decision === 'ACCEPT',
    `status ${putusSah.status} ${pesan(putusSah)}`);
  check('penerimaan pun TIDAK mematikan alat', putusSah.data?.deviceDisabled === false);
  check('dan kedaluwarsanya kembali ke daftar menunggu, bukan daftar yang dimatikan',
    String(putusSah.data?.note ?? '').includes('bukan ke daftar yang harus dimatikan'));

  const putusUlang = await api(
    `/health/device-maintenance/risk/${kritis.data?.id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({
        decision: 'RETIRE',
        reason: 'Berubah pendirian sesudah rapat; alat dipensiunkan lebih awal.',
        planRef: 'RENCANA-GANTI-2026',
      }),
    },
    manajemen.token,
  );
  check('keputusan yang sudah ada tidak ditimpa', putusUlang.status === 409,
    `status ${putusUlang.status}`);
  check('penolakannya menyebut pendiriannya memang berubah',
    pesan(putusUlang).includes('pendiriannya memang berubah'));

  const tembusPutus = await gagal(
    `UPDATE "${SCHEMA}".device_risk_assessment
        SET decision = 'ACCEPT', decision_by = assessed_by, decision_at = now(),
            decision_reason = 'Menembus pemisahan penilai dan pemutus lewat basis data.',
            review_due_on = CURRENT_DATE + 30
      WHERE id = $1`,
    [penuhPenahan.data?.id],
  );
  check('menembus pemisahannya lewat basis data ditolak constraint',
    (tembusPutus ?? '').includes('device_risk_decide_not_self'), tembusPutus ?? 'lolos');

  const tembusTinjau = await gagal(
    `UPDATE "${SCHEMA}".device_risk_assessment
        SET decision = 'ACCEPT', decision_by = gen_random_uuid(), decision_at = now(),
            decision_reason = 'Menembus tanggal tinjau lewat basis data langsung.'
      WHERE id = $1`,
    [penuhPenahan.data?.id],
  );
  check('penerimaan tanpa tanggal tinjau ditolak constraint pula',
    (tembusTinjau ?? '').includes('device_risk_accept_needs_review'), tembusTinjau ?? 'lolos');

  // --- 9. Urutan papan perhatian -------------------------------------------
  log('');
  log('9. Yang lewat tenggat didahulukan atas yang skornya lebih tinggi');
  await q(
    `UPDATE "${SCHEMA}".device_risk_assessment
        SET decision_due_on = $2::date WHERE id = $1`,
    [penuhPenahan.data?.id, hari(-400)],
  );
  const papanRisiko = await api(
    `/health/device-maintenance/risk?facilityId=${facilityId}`,
    {},
    analis.token,
  );
  check('papan risiko terbaca', papanRisiko.status === 200, `status ${papanRisiko.status}`);
  check('yang lewat tenggat berada di puncak, sekalipun skornya lebih rendah',
    (papanRisiko.data?.items ?? [])[0]?.deviceId === analyzer,
    JSON.stringify((papanRisiko.data?.items ?? []).map((i) => [i.deviceCode, i.tingkat, i.skorSisa])));

  // --- 10. Insiden siber ---------------------------------------------------
  log('');
  log('10. Insiden siber yang mengenai perawatan WAJIB tertaut keselamatan pasien');
  const siberTanpaTaut = await api(
    '/health/device-maintenance/security-incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator, incidentType: 'RANSOMWARE', severity: 'CRITICAL',
        detectedAt: new Date().toISOString(),
        description: 'Layar ventilator menampilkan pesan tebusan; pengaturan tidak dapat diubah.',
        affectedPatientCare: true,
      }),
    },
    analis.token,
  );
  check('tanpa tautan keselamatan pasien DITOLAK', siberTanpaTaut.status === 422,
    `status ${siberTanpaTaut.status}`);
  check('penolakannya menyebut tidak pernah dihitung',
    pesan(siberTanpaTaut).includes('tidak pernah dihitung'));

  const siber = await api(
    '/health/device-maintenance/security-incidents',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, deviceId: ventilator, incidentType: 'RANSOMWARE', severity: 'CRITICAL',
        detectedAt: new Date().toISOString(),
        description: 'Layar ventilator menampilkan pesan tebusan; pengaturan tidak dapat diubah.',
        affectedPatientCare: true, safetyIncidentId: insidenPasien,
      }),
    },
    analis.token,
  );
  check('yang tertaut diterima', siber.status === 201, `status ${siber.status} ${pesan(siber)}`);
  check('langkah penahanannya dimulai dari isolasi jaringan, bukan daya',
    String((siber.data?.containmentSteps ?? [])[0] ?? '').includes('bukan dayanya'));
  check('dan menyebut alat yang tersusupi lebih baik daripada alat yang mati',
    (siber.data?.containmentSteps ?? []).some((l) => String(l).includes('lebih baik daripada alat yang mati')));
  check('PENCATATANNYA TIDAK MENGISOLASI ALAT', siber.data?.deviceIsolated === false);

  const statusSesudahSiber = await q(
    `SELECT status FROM "${SCHEMA}".medical_device WHERE id = $1`,
    [ventilator],
  );
  check('dan ventilator MASIH ACTIVE sesudah insiden penyanderaan data dicatat',
    statusSesudahSiber[0]?.status === 'ACTIVE', statusSesudahSiber[0]?.status);

  const tembusSiber = await gagal(
    `INSERT INTO "${SCHEMA}".device_security_incident
       (facility_id, device_id, incident_number, incident_type, severity, detected_at,
        description, affected_patient_care)
     VALUES ($1,$2,$3,'MALWARE','HIGH',now(),'Menembus tautan keselamatan pasien.',TRUE)`,
    [facilityId, ventilator, `ICS-TEMBUS-${tag}`],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusSiber ?? '').includes('device_sec_patient_needs_safety'), tembusSiber ?? 'lolos');

  const isolasi = await api(
    `/health/device-maintenance/security-incidents/${siber.data?.id}/isolate`,
    { method: 'POST', body: JSON.stringify({ containmentNote: 'Port switch dinonaktifkan pukul 02.15.' }) },
    analis.token,
  );
  check('isolasi jaringan yang sudah dilakukan orang dapat dicatat',
    isolasi.data?.deviceIsolated === true, `status ${isolasi.status} ${pesan(isolasi)}`);
  check('dan dinyatakan bukan perintah kepada alat',
    String(isolasi.data?.note ?? '').includes('bukan perintah kepada alat'));

  // --- 11. Analis keamanan tidak mengendalikan alat ------------------------
  log('');
  log('11. Analis keamanan TIDAK dapat mengendalikan alat');
  const analisUbahStatus = await api(
    `/health/devices/${ventilator}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'DOWNTIME', reason: 'Tersusupi.' }) },
    analis.token,
  );
  check('analis tidak dapat mengubah status alat', analisUbahStatus.status === 403,
    `status ${analisUbahStatus.status}`);

  const analisPerintah = await api(
    `/health/devices/${ventilator}/commands`,
    { method: 'POST', body: JSON.stringify({ command: 'STOP' }) },
    analis.token,
  );
  check('dan tidak dapat mengirim perintah', analisPerintah.status === 403,
    `status ${analisPerintah.status}`);

  const analisNyalakan = await api(
    `/health/devices/${ventilator}/remote-control/enable`,
    {
      method: 'POST',
      body: JSON.stringify({
        writtenApprovalRef: 'X', riskReviewRef: 'Y', allowedCommands: ['STOP'],
        maxValue: 1, commandLogging: true, emergencyStop: true,
      }),
    },
    analis.token,
  );
  check('dan tidak dapat menyalakan kendali jarak jauh', analisNyalakan.status === 403,
    `status ${analisNyalakan.status}`);

  // --- 12. Yang tidak berubah ----------------------------------------------
  log('');
  log('12. SESUDAH SELURUHNYA — STATUS ALAT TIDAK BERUBAH SENDIRI');
  const statusAkhir = await q(
    `SELECT id, status FROM "${SCHEMA}".medical_device WHERE id = ANY($1::uuid[]) ORDER BY code`,
    [[ventilator, analyzer]],
  );
  // Keduanya termasuk analyzer yang uji listriknya baru saja GAGAL: penandanya
  // tersimpan, dan alatnya tetap pada statusnya semula.
  const awal = new Map(statusAwal.map((r) => [r.id, r.status]));
  check('ventilator dan analyzer tetap pada statusnya semula',
    statusAkhir.every((r) => r.status === awal.get(r.id)),
    JSON.stringify(statusAkhir.map((r) => [r.id.slice(0, 8), awal.get(r.id), r.status])));

  const dimatikanOtomatis = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".medical_device d
      WHERE d.facility_id = $1 AND d.status = 'DOWNTIME'`,
    [facilityId],
  );
  check('TIDAK SATU PUN ALAT BERSTATUS DOWNTIME di fasilitas ini',
    dimatikanOtomatis[0].n === 0, `${dimatikanOtomatis[0].n} alat`);

  const jejakDihapus = await gagal(
    `DELETE FROM "${SCHEMA}".device_risk_assessment WHERE id = $1`,
    [kritis.data?.id],
  );
  check('penilaian risiko tidak dapat dihapus',
    (jejakDihapus ?? '').includes('LEDGER_IMMUTABLE'), jejakDihapus ?? 'lolos');

  const woDihapus = await gagal(
    `DELETE FROM "${SCHEMA}".device_work_order WHERE id = $1`,
    [denganTaut.data?.id],
  );
  check('pekerjaan yang sudah selesai tidak dapat dihapus',
    (woDihapus ?? '').includes('WORK_ORDER_IMMUTABLE'), woDihapus ?? 'lolos');

  const siberDihapus = await gagal(
    `DELETE FROM "${SCHEMA}".device_security_incident WHERE id = $1`,
    [siber.data?.id],
  );
  check('insiden siber tidak dapat dihapus',
    (siberDihapus ?? '').includes('LEDGER_IMMUTABLE'), siberDihapus ?? 'lolos');

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
    new URL('../../../docs/emedik/bukti-h9j-pemeliharaan-alat.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
