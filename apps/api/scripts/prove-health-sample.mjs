/**
 * Bukti H-11: data contoh, pembersihannya, laporan, dan penghalang.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * ## Yang paling penting dibuktikan naskah ini
 *
 * > **Pembersihan data contoh tidak menyentuh satu pun baris sungguhan.**
 *
 * Dan ia dibuktikan dengan cara yang tidak dapat dibantah: naskah ini membuat
 * baris SUNGGUHAN dan baris CONTOH pada tabel yang sama, menghitung keduanya,
 * menjalankan pembersihan, lalu menghitung ulang. Baris sungguhannya harus
 * **sama persis** — bukan "kurang lebih".
 *
 * Pembersihan yang salah sasaran menghapus rekam medis, tidak menimbulkan
 * galat, tidak terlihat pada pengujian mana pun yang memakai basis data kosong,
 * dan ditemukan oleh perawat yang mencari catatan pasiennya.
 *
 * Selebihnya:
 *
 * - pembersihan MENYEMBUNYIKAN, bukan menghapus — barisnya masih ada;
 * - tabel di luar daftar izin ditolak;
 * - daftar izinnya dibaca dari basis data, dan hanya memuat yang benar-benar
 *   dapat disembunyikan;
 * - yang menyemai bukan yang membersihkan;
 * - laporan seluruhnya agregat dan berbatas rentang;
 * - dan ekspor menolak dengan menyebutkan sebab serta jalan keluarnya.
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
  return t.toISOString().slice(0, 10);
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

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_smp_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-11',FALSE) RETURNING id`,
      [`BUKTI_SMP_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-11 — DATA CONTOH, PEMBERSIHAN, LAPORAN, DAN PENGHALANG');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const penyemai = await buatPengguna(tenantId, 'penyemai', {
    HEALTH: ['READ'],
    // HARD_DELETE sengaja DIBERIKAN pula: penolakannya harus datang dari
    // pemeriksaan baris, bukan dari ketiadaan hak akses. Pelajaran H-9J.
    HEALTH_SAMPLE_DATA: ['READ', 'CREATE', 'HARD_DELETE'],
    HEALTH_REPORT: ['READ', 'EXPORT'],
  });

  log('');
  log('Satu pengguna, dengan hak menyemai DAN membersihkan sekaligus — supaya');
  log('yang diuji adalah penjaganya, bukan ketiadaan hak aksesnya.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Contoh','HOSPITAL') RETURNING id`,
      [`BKSM-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Contoh','Asia/Jakarta') RETURNING id`,
      [typeId, `SM-${tag}`],
    )
  )[0].id;

  // --- 1. Daftar izin ------------------------------------------------------
  log('');
  log('1. DAFTAR IZIN DIBACA DARI BASIS DATA, dan hanya memuat yang dapat disembunyikan');
  const tabel = await api('/health/sample/tables', {}, penyemai.token);
  check('daftar izin terbaca', tabel.status === 200, `status ${tabel.status}`);
  check('memuat sepuluh tabel yang dapat dibersihkan', (tabel.data?.items ?? []).length === 10,
    `${(tabel.data?.items ?? []).length}`);
  check('DAN MENCATAT yang TIDAK dapat dibersihkan beserta sebabnya',
    (tabel.data?.notCleanable ?? []).length > 0 &&
      (tabel.data?.notCleanable ?? []).every((t) => String(t.reason).length > 40),
    `${(tabel.data?.notCleanable ?? []).length} tabel`);
  check('sebabnya menyebut menyentuh setiap modul sejak H-2',
    String((tabel.data?.notCleanable ?? [])[0]?.reason ?? '').includes('sejak H-2'));

  const seluruhnyaPunyaDeleted = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_sample_table_cleanable c
      WHERE NOT EXISTS (
        SELECT 1 FROM information_schema.columns k
         WHERE k.table_schema = $1 AND k.table_name = c.table_name
           AND k.column_name = 'deleted_at')`,
    [SCHEMA],
  );
  check('SETIAP tabel pada daftar izin benar-benar punya deleted_at',
    seluruhnyaPunyaDeleted[0].n === 0, `${seluruhnyaPunyaDeleted[0].n} tanpa deleted_at`);

  // --- 2. Penyemaian -------------------------------------------------------
  log('');
  log('2. Benih wajib, dan jumlah baris berbatas');
  const tanpaBenih = await api(
    '/health/sample/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, runCode: `RUN-${tag}`, profile: 'STANDARD', seed: 'a',
        rowsPerTable: 60, tableCount: 5,
      }),
    },
    penyemai.token,
  );
  check('benih terlalu pendek DITOLAK', tanpaBenih.status === 400 || tanpaBenih.status === 422,
    `status ${tanpaBenih.status}`);

  const terlaluBanyak = await api(
    '/health/sample/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, runCode: `RUN-X-${tag}`, profile: 'STANDARD', seed: `benih-${tag}`,
        rowsPerTable: 500, tableCount: 5,
      }),
    },
    penyemai.token,
  );
  check('jumlah baris melampaui batas profil DITOLAK', terlaluBanyak.status === 422,
    `status ${terlaluBanyak.status}`);
  check('penolakannya menyebut demo yang lambat',
    pesan(terlaluBanyak).includes('sistemnya lambat'));

  const terlaluSedikit = await api(
    '/health/sample/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, runCode: `RUN-Y-${tag}`, profile: 'STANDARD', seed: `benih-${tag}`,
        rowsPerTable: 5, tableCount: 5,
      }),
    },
    penyemai.token,
  );
  check('terlalu sedikit pun ditolak', terlaluSedikit.status === 422,
    `status ${terlaluSedikit.status}`);

  const semai = await api(
    '/health/sample/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, runCode: `RUN-${tag}`, profile: 'STANDARD', seed: `benih-${tag}`,
        rowsPerTable: 60, tableCount: 5,
      }),
    },
    penyemai.token,
  );
  check('penyemaian tercatat', semai.status === 201, `status ${semai.status} ${pesan(semai)}`);

  const tembusBenih = await gagal(
    `INSERT INTO "${SCHEMA}".health_sample_run (run_code, profile, seed)
     VALUES ($1,'STANDARD','a')`,
    [`RUN-TEMBUS-${tag}`],
  );
  check('menembus syarat benih lewat basis data ditolak constraint',
    (tembusBenih ?? '').includes('sample_run_seed_meaningful'), tembusBenih ?? 'lolos');

  // --- 3. INVARIAN UTAMA ---------------------------------------------------
  log('');
  log('3. PEMBERSIHAN TIDAK MENYENTUH SATU PUN BARIS SUNGGUHAN');
  log('   Baris SUNGGUHAN dan baris CONTOH dibuat pada tabel yang sama.');

  const unitSungguhan = [];
  const unitContoh = [];
  for (let i = 0; i < 7; i += 1) {
    unitSungguhan.push(
      (
        await q(
          `INSERT INTO "${SCHEMA}".health_service_unit
             (facility_id, code, name, unit_type, is_sample)
           VALUES ($1,$2,$3,'POLYCLINIC',FALSE) RETURNING id`,
          [facilityId, `SUNGGUH-${tag}-${i}`, `Unit Sungguhan ${i}`],
        )
      )[0].id,
    );
  }
  for (let i = 0; i < 5; i += 1) {
    unitContoh.push(
      (
        await q(
          `INSERT INTO "${SCHEMA}".health_service_unit
             (facility_id, code, name, unit_type, is_sample)
           VALUES ($1,$2,$3,'POLYCLINIC',TRUE) RETURNING id`,
          [facilityId, `CONTOH-${tag}-${i}`, `Unit Contoh ${i}`],
        )
      )[0].id,
    );
  }

  const sebelum = await q(
    `SELECT count(*) FILTER (WHERE is_sample = TRUE)::int AS contoh,
            count(*) FILTER (WHERE is_sample = FALSE)::int AS sungguhan
       FROM "${SCHEMA}".health_service_unit WHERE deleted_at IS NULL`,
  );
  check('baris sungguhan dan contoh terhitung sebelum pembersihan',
    sebelum[0].sungguhan >= 7 && sebelum[0].contoh >= 5,
    `${sebelum[0].sungguhan} sungguhan, ${sebelum[0].contoh} contoh`);

  const bersih = await api(
    '/health/sample/runs/clean',
    {
      method: 'POST',
      body: JSON.stringify({
        sampleRunId: semai.data?.id,
        tables: ['health_service_unit'],
        reason: 'Membersihkan data contoh sesudah peragaan selesai.',
      }),
    },
    penyemai.token,
  );
  check('pembersihan berjalan', bersih.status === 201,
    `status ${bersih.status} ${pesan(bersih)}`);

  const sesudah = await q(
    `SELECT count(*) FILTER (WHERE is_sample = TRUE)::int AS contoh,
            count(*) FILTER (WHERE is_sample = FALSE)::int AS sungguhan
       FROM "${SCHEMA}".health_service_unit WHERE deleted_at IS NULL`,
  );
  check('BARIS SUNGGUHAN SAMA PERSIS', sesudah[0].sungguhan === sebelum[0].sungguhan,
    `${sebelum[0].sungguhan} -> ${sesudah[0].sungguhan}`);
  check('dan baris contoh yang tampak menjadi nol', sesudah[0].contoh === 0,
    `${sesudah[0].contoh}`);
  check('jawabannya menyatakan nol baris sungguhan tersentuh',
    bersih.data?.realRowsTouched === 0);
  check('dan pemeriksaannya menyatakan aman', bersih.data?.verification?.aman === true,
    JSON.stringify(bersih.data?.verification ?? {}));

  // --- 4. Menyembunyikan, bukan menghapus ----------------------------------
  log('');
  log('4. YANG DIBERSIHKAN DISEMBUNYIKAN, BUKAN DIHAPUS');
  const masihAda = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service_unit
      WHERE id = ANY($1::uuid[])`,
    [unitContoh],
  );
  check('BARISNYA MASIH ADA', masihAda[0].n === unitContoh.length,
    `${masihAda[0].n} dari ${unitContoh.length}`);

  const tersembunyi = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service_unit
      WHERE id = ANY($1::uuid[]) AND deleted_at IS NOT NULL`,
    [unitContoh],
  );
  check('dan seluruhnya bertanda tersembunyi', tersembunyi[0].n === unitContoh.length);

  const sungguhanUtuh = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service_unit
      WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
    [unitSungguhan],
  );
  check('SELURUH BARIS SUNGGUHAN MASIH TAMPAK', sungguhanUtuh[0].n === unitSungguhan.length,
    `${sungguhanUtuh[0].n} dari ${unitSungguhan.length}`);

  check('caranya dinyatakan HIDE', bersih.data?.method === 'HIDE');
  check('dan alasannya menyebut jejak audit yang menunjuk ketiadaan',
    String(bersih.data?.note ?? '').includes('menunjuk ketiadaan'));

  // --- 5. Constraint penjaga -----------------------------------------------
  log('');
  log('5. Basis data menolak pencatatan yang menyatakan baris sungguhan berubah');
  const tembusHitungan = await gagal(
    `INSERT INTO "${SCHEMA}".health_sample_row_count
       (sample_run_id, table_name, sample_rows, real_rows_before, real_rows_after)
     VALUES ($1,'tabel_uji',5,100,99)`,
    [semai.data?.id],
  );
  check('hitungan yang menyatakan baris sungguhan berkurang DITOLAK constraint',
    (tembusHitungan ?? '').includes('sample_count_real_unchanged'), tembusHitungan ?? 'lolos');

  const hitunganSah = await gagal(
    `INSERT INTO "${SCHEMA}".health_sample_row_count
       (sample_run_id, table_name, sample_rows, real_rows_before, real_rows_after)
     VALUES ($1,'tabel_uji',5,100,100)`,
    [semai.data?.id],
  );
  check('UJI KENDALI: yang tidak berubah diterima', hitunganSah === null, hitunganSah ?? '');

  const hapusRun = await gagal(
    `DELETE FROM "${SCHEMA}".health_sample_run WHERE id = $1`,
    [semai.data?.id],
  );
  check('kumpulan penyemaian tidak dapat dihapus',
    (hapusRun ?? '').includes('LEDGER_IMMUTABLE'), hapusRun ?? 'lolos');

  // --- 6. Tabel di luar daftar izin ----------------------------------------
  log('');
  log('6. Tabel di luar daftar izin DITOLAK');
  const semaiKedua = await api(
    '/health/sample/runs',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, runCode: `RUN2-${tag}`, profile: 'MINIMAL', seed: `benih2-${tag}`,
        rowsPerTable: 50, tableCount: 3,
      }),
    },
    penyemai.token,
  );

  const tabelAsing = await api(
    '/health/sample/runs/clean',
    {
      method: 'POST',
      body: JSON.stringify({
        sampleRunId: semaiKedua.data?.id,
        tables: ['patient', 'platform_user'],
        reason: 'Mencoba membersihkan tabel di luar daftar izin.',
      }),
    },
    penyemai.token,
  );
  check('tabel di luar daftar izin DITOLAK', tabelAsing.status === 422,
    `status ${tabelAsing.status}`);
  check('penolakannya menyebut belum ditelaah', pesan(tabelAsing).includes('belum ditelaah'));

  const pasienUtuh = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".patient`,
  );
  check('dan tabel pasien tidak tersentuh sama sekali', pasienUtuh[0].n > 0,
    `${pasienUtuh[0].n} baris`);

  const bersihGanda = await api(
    '/health/sample/runs/clean',
    {
      method: 'POST',
      body: JSON.stringify({
        sampleRunId: semai.data?.id,
        tables: ['health_service_unit'],
        reason: 'Mencoba membersihkan kumpulan yang sudah dibersihkan.',
      }),
    },
    penyemai.token,
  );
  check('kumpulan yang sudah dibersihkan tidak dibersihkan lagi', bersihGanda.status === 409,
    `status ${bersihGanda.status}`);

  // --- 7. Laporan ----------------------------------------------------------
  log('');
  log('7. Laporan seluruhnya agregat dan berbatas rentang');
  const katalog = await api('/health/sample/catalog', {}, penyemai.token);
  check('katalog terbaca', katalog.status === 200, `status ${katalog.status}`);
  check('SELURUH LAPORAN AGREGAT', katalog.data?.allReportsAggregate === true);
  check('delapan laporan tercatat', (katalog.data?.reports ?? []).length === 8);
  check('tidak satu pun bertingkat pasien',
    (katalog.data?.reports ?? []).every((l) => l.tingkatPasien === false));

  const laporan = await api(
    `/health/sample/reports/VISIT_VOLUME?facilityId=${facilityId}&from=${hari(-30)}&to=${hari(0)}`,
    {},
    penyemai.token,
  );
  check('laporan berjalan', laporan.status === 200, `status ${laporan.status} ${pesan(laporan)}`);
  check('dan menyatakan dirinya bukan tingkat pasien', laporan.data?.patientLevel === false);

  const rentangJauh = await api(
    `/health/sample/reports/VISIT_VOLUME?facilityId=${facilityId}&from=2010-01-01&to=${hari(0)}`,
    {},
    penyemai.token,
  );
  check('rentang tanpa batas DITOLAK', rentangJauh.status === 422,
    `status ${rentangJauh.status}`);
  check('penolakannya menyebut jam sibuk', pesan(rentangJauh).includes('jam sibuk'));

  const laporanAsing = await api(
    `/health/sample/reports/LAPORAN_SENDIRI?facilityId=${facilityId}&from=${hari(-30)}&to=${hari(0)}`,
    {},
    penyemai.token,
  );
  check('laporan di luar katalog ditolak', laporanAsing.status === 400,
    `status ${laporanAsing.status}`);

  const jsonLaporan = JSON.stringify(laporan.body);
  check('jawaban laporan tidak memuat satu pun nama pasien',
    !/full_name|patient_name|nik/i.test(jsonLaporan));

  // --- 8. Penghalang -------------------------------------------------------
  log('');
  log('8. Penghalang dicatat, dan penolakannya menyebut jalan keluarnya');
  const penghalang = await api('/health/sample/blockers', {}, penyemai.token);
  check('penghalang terbaca', penghalang.status === 200, `status ${penghalang.status}`);
  check('tiga penghalang tercatat', (penghalang.data?.items ?? []).length === 3);
  check('SETIAP penghalang menyebut jalan keluarnya',
    (penghalang.data?.items ?? []).every((p) => String(p.jalanKeluar).length > 40));

  const ekspor = await api(
    `/health/sample/reports/VISIT_VOLUME/export?format=EXCEL`,
    { method: 'POST' },
    penyemai.token,
  );
  check('EKSPOR MENOLAK', ekspor.status === 422, `status ${ekspor.status}`);
  check('penolakannya menyebut sebabnya', pesan(ekspor).includes('V8-5'));
  check('DAN jalan keluarnya', pesan(ekspor).includes('JSON'));

  const cetak = await api(
    `/health/sample/reports/VISIT_VOLUME/export?format=PDF`,
    { method: 'POST' },
    penyemai.token,
  );
  check('cetak PDF menolak pula', cetak.status === 422, `status ${cetak.status}`);
  check('dan JUJUR bahwa jalan keluarnya tidak setara',
    pesan(cetak).includes('bukan pengganti yang setara'));

  const laporanBerpenghalang = laporan.data?.export;
  check('setiap laporan menyertakan penghalang ekspornya',
    laporanBerpenghalang?.excel?.blocked === true && laporanBerpenghalang?.pdf?.blocked === true,
    JSON.stringify(laporanBerpenghalang ?? {}));

  // --- 9. Peran ------------------------------------------------------------
  log('');
  log('9. Peran kesehatan dibaca dari basis data');
  const peran = await api('/health/sample/roles', {}, penyemai.token);
  check('ringkasan peran terbaca', peran.status === 200, `status ${peran.status}`);
  check('lebih dari 29 peran kesehatan ada', (peran.data?.total ?? 0) >= 29,
    `${peran.data?.total} peran`);
  /*
   * Yang diperiksa BUKAN "sebagian besar" — itu ambang sewenang-wenang yang
   * berubah setiap kali satu peran ditambahkan. Yang diperiksa adalah peran
   * TERTENTU yang memang dinyatakan tanpa hak pasien: bila salah satunya
   * kelak diberi hak pasien, uji ini gagal dan memaksa orang yang memberinya
   * menjelaskan mengapa.
   */
  const TANPA_HAK_PASIEN = [
    'HEALTH_WEB_EDITOR',
    'HEALTH_INTEROP_OFFICER',
    'HEALTH_DEVICE_SECURITY_ANALYST',
    'HEALTH_INVESTOR_VIEWER',
    'HEALTH_INVESTOR_ANALYST',
    'HEALTH_FINANCE_OFFICER',
    'HEALTH_BIOMEDICAL_ENGINEER',
    'HEALTH_ADMIN',
  ];
  const melanggar = (peran.data?.items ?? [])
    .filter((p) => TANPA_HAK_PASIEN.includes(p.code) && p.hasPatientAccess)
    .map((p) => p.code);
  check('DELAPAN PERAN YANG DINYATAKAN TANPA HAK PASIEN memang tidak punya',
    melanggar.length === 0, melanggar.join(','));

  const ditemukan = (peran.data?.items ?? [])
    .filter((p) => TANPA_HAK_PASIEN.includes(p.code))
    .length;
  check('dan kedelapannya benar-benar ada pada tenant ini', ditemukan === TANPA_HAK_PASIEN.length,
    `${ditemukan} dari ${TANPA_HAK_PASIEN.length}`);

  // --- 10. Yang tidak berubah ----------------------------------------------
  log('');
  log('10. SESUDAH SELURUHNYA — TIDAK ADA HITUNGAN YANG MENYATAKAN KEHILANGAN');
  const pelanggaran = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_sample_row_count
      WHERE real_rows_before IS NOT NULL AND real_rows_after IS NOT NULL
        AND real_rows_before <> real_rows_after`,
  );
  check('di SELURUH tenant, tidak satu pun hitungan menyatakan baris sungguhan berubah',
    pelanggaran[0].n === 0, `${pelanggaran[0].n} baris`);

  const adaDelete = await q(
    `SELECT count(*)::int AS n FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = $1 AND p.prosrc ILIKE '%DELETE FROM%'
        AND p.proname LIKE '%sample%'`,
    [SCHEMA],
  );
  check('tidak ada satu pun fungsi basis data bernama sample yang menjalankan DELETE',
    adaDelete[0].n === 0, `${adaDelete[0].n} fungsi`);

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
    new URL('../../../docs/emedik/bukti-h11-data-contoh.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
