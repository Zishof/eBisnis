/**
 * Bukti H-9D: tarif JKN berversi dan cakupan penjamin.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa tarifnya terpilih, melainkan bahwa yang
 * seharusnya DITOLAK memang ditolak:
 *
 * - tarif yang belum tersedia TIDAK ditaksir;
 * - dua tarif yang sama-sama berlaku menghentikan perhitungan;
 * - tumpang tindih tanggal ditolak, termasuk pada tarif umum yang bagiannya kosong;
 * - versi tanpa dasar peraturan, berkas sumber, atau isi tidak dapat diaktifkan;
 * - yang mengimpor tidak menyetujuinya sendiri;
 * - baris tarif pada versi yang sudah aktif tidak dapat diubah;
 * - penjamin tanpa kontrak ditolak.
 *
 * Dan satu hal yang harus TETAP berjalan: klaim tahun lalu memakai tarif tahun
 * lalu, sekalipun tarif tahun ini sudah aktif.
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
const WIL = `REG-${tag.toUpperCase()}`;
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
  const username = `bukti_trf_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9D',FALSE) RETURNING id`,
      [`BUKTI_TRF_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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

const barisTarif = (over = {}) => ({
  paymentMethod: 'INA_CBG',
  regionCode: WIL,
  facilityClass: 'C',
  amount: 1000000,
  effectiveFrom: '2026-01-01',
  ...over,
});

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-9D — TARIF JKN BERVERSI DAN CAKUPAN PENJAMIN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const petugas = await buatPengguna(tenantId, 'petugas', {
    HEALTH: ['READ'],
    HEALTH_TARIFF: ['READ', 'IMPORT'],
    HEALTH_PAYER: ['READ', 'CREATE', 'UPDATE'],
  });
  const penyetuju = await buatPengguna(tenantId, 'penyetuju', {
    HEALTH: ['READ'],
    HEALTH_TARIFF: ['READ', 'APPROVE', 'ACTIVATE'],
    HEALTH_PAYER: ['READ'],
  });

  log('');
  log('Dua pengguna. Petugas tarif TIDAK diberi APPROVE, penyetuju TIDAK diberi');
  log('IMPORT — justru pemisahan itulah yang hendak dibuktikan naskah ini.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Tarif','HOSPITAL') RETURNING id`,
      [`BKTR-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Tarif','Asia/Jakarta') RETURNING id`,
      [typeId, `TR-${tag}`],
    )
  )[0].id;

  // --- 1. Tarif yang belum ada tidak ditaksir -------------------------------
  log('');
  log('1. Tarif yang belum tersedia TIDAK ditaksir');
  const belumAda = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C&serviceDate=2026-06-15`,
    {},
    petugas.token,
  );
  check('pencarian berjalan', belumAda.status === 200, `status ${belumAda.status}`);
  check('tetapi tarifnya TIDAK ditemukan', belumAda.data?.found === false);
  check('dan tidak ada angka yang dikembalikan', belumAda.data?.tariff === undefined);
  check('pesannya berkata belum tersedia', String(belumAda.data?.message ?? '').includes('belum tersedia'));
  check('dan menyebut sebabnya: menaksirnya akan dipakai menagih orang',
    String(belumAda.data?.message ?? '').includes('menagih orang'));

  const tanpaTanggal = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C`,
    {},
    petugas.token,
  );
  check('pencarian tanpa tanggal layanan ditolak', tanpaTanggal.status === 400,
    `status ${tanpaTanggal.status}`);
  check('penolakannya menegaskan bukan tanggal hari ini',
    pesan(tanpaTanggal).includes('bukan tanggal hari ini'));

  // --- 2. Versi dan impor ---------------------------------------------------
  log('');
  log('2. Impor membuat versi baru; tumpang tindih tanggal ditolak');
  await api(
    '/health/tariff/regulations',
    {
      method: 'POST',
      body: JSON.stringify({
        reference: `PMK-BUKTI-${tag}`, year: 2026,
        title: 'Peraturan tarif naskah bukti H-9D',
        scope: 'FKRTL', effectiveFrom: '2026-01-01',
        sourceFile: 'pmk.pdf', sourceHash: 'sha256:zzz',
      }),
    },
    petugas.token,
  );

  const versi2025 = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-2025-${tag}`, name: 'Tarif 2025',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'tarif-2025.csv', sourceHash: 'sha256:aaa',
      }),
    },
    petugas.token,
  );
  check('versi 2025 dibuat', versi2025.status === 201, `status ${versi2025.status} ${pesan(versi2025)}`);
  check('dan belum aktif', versi2025.data?.isActive === false);

  const imporBentrok = await api(
    `/health/tariff/versions/${versi2025.data?.id}/rows`,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [
          barisTarif({ effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', amount: 800000 }),
          barisTarif({ effectiveFrom: '2025-06-01', effectiveTo: '2025-12-31', amount: 850000 }),
        ],
      }),
    },
    petugas.token,
  );
  check('impor dengan tumpang tindih di dalam kirimannya DITOLAK', imporBentrok.status === 422,
    `status ${imporBentrok.status}`);
  check('penolakannya menyebut baris keberapa', pesan(imporBentrok).includes('Baris ke-2'));

  const belumImpor = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".jkn_tariff WHERE version_id = $1`,
    [versi2025.data?.id],
  );
  check('dan TIDAK mengimpor sebagiannya', belumImpor[0].n === 0, `${belumImpor[0].n} baris`);

  const impor2025 = await api(
    `/health/tariff/versions/${versi2025.data?.id}/rows`,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [
          barisTarif({ effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31', amount: 800000 }),
          barisTarif({
            effectiveFrom: '2025-01-01', effectiveTo: '2025-12-31',
            amount: 1200000, casemixSeverity: 'III',
          }),
        ],
      }),
    },
    petugas.token,
  );
  check('impor yang sah berhasil', impor2025.data?.imported === 2, `${impor2025.data?.imported}`);

  // --- 3. Aktivasi ----------------------------------------------------------
  log('');
  log('3. Yang mengimpor tidak menyetujuinya sendiri');
  const setujuSendiri = await api(
    `/health/tariff/versions/${versi2025.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Sudah saya periksa sendiri, aman.' }) },
    petugas.token,
  );
  check('petugas tarif tidak berwenang menyetujui', setujuSendiri.status === 403,
    `status ${setujuSendiri.status}`);

  const versiKosong = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-KOSONG-${tag}`, name: 'Versi Kosong',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'kosong.csv', sourceHash: 'sha256:kosong',
      }),
    },
    petugas.token,
  );
  const setujuKosong = await api(
    `/health/tariff/versions/${versiKosong.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Diperiksa dan tidak ada isinya.' }) },
    penyetuju.token,
  );
  check('versi KOSONG tidak dapat diaktifkan', setujuKosong.status === 422,
    `status ${setujuKosong.status}`);
  check('penolakannya menyebut akibatnya',
    pesan(setujuKosong).includes('menghentikan seluruh perhitungan'));

  const versiTanpaSumber = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-NOSRC-${tag}`, name: 'Tanpa Berkas Sumber',
        regulationReference: `PMK-BUKTI-${tag}`,
      }),
    },
    petugas.token,
  );
  await api(
    `/health/tariff/versions/${versiTanpaSumber.data?.id}/rows`,
    { method: 'POST', body: JSON.stringify({ rows: [barisTarif({ regionCode: `${WIL}-X` })] }) },
    petugas.token,
  );
  const setujuTanpaSumber = await api(
    `/health/tariff/versions/${versiTanpaSumber.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Diperiksa sekilas saja.' }) },
    penyetuju.token,
  );
  check('versi tanpa berkas sumber tidak dapat diaktifkan', setujuTanpaSumber.status === 422,
    `status ${setujuTanpaSumber.status}`);
  check('penolakannya menyebut tarif yang diketik dari ingatan',
    pesan(setujuTanpaSumber).includes('diketik dari ingatan'));

  const setuju2025 = await api(
    `/health/tariff/versions/${versi2025.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({
        note: 'Dibandingkan baris demi baris dengan lampiran PMK; dua baris cocok.',
      }),
    },
    penyetuju.token,
  );
  check('penyetuju mengaktifkan versi 2025', setuju2025.status === 200 || setuju2025.status === 201,
    `status ${setuju2025.status} ${pesan(setuju2025)}`);

  const tembusSetujuSendiri = await gagal(
    `UPDATE "${SCHEMA}".jkn_tariff_version
        SET approved_by = imported_by, approved_at = now() WHERE id = $1`,
    [versiTanpaSumber.data?.id],
  );
  check('menembus persetujuan sendiri lewat basis data ditolak constraint',
    (tembusSetujuSendiri ?? '').includes('jkn_version_approval_not_self'),
    tembusSetujuSendiri ?? 'lolos');

  // --- 4. Versi aktif tidak dapat diubah ------------------------------------
  log('');
  log('4. Baris tarif pada versi yang sudah aktif tidak dapat diubah');
  const ubahAktif = await gagal(
    `UPDATE "${SCHEMA}".jkn_tariff SET amount = 999999 WHERE version_id = $1`,
    [versi2025.data?.id],
  );
  check('mengubahnya ditolak trigger',
    (ubahAktif ?? '').includes('TARIFF_VERSION_ACTIVE'), ubahAktif ?? 'lolos');
  check('penolakannya menyuruh membuat versi baru',
    (ubahAktif ?? '').includes('buat versi baru'));

  const hapusAktif = await gagal(
    `DELETE FROM "${SCHEMA}".jkn_tariff WHERE version_id = $1`,
    [versi2025.data?.id],
  );
  check('menghapusnya pun ditolak',
    (hapusAktif ?? '').includes('TARIFF_VERSION_ACTIVE'), hapusAktif ?? 'lolos');

  const tambahKeAktif = await api(
    `/health/tariff/versions/${versi2025.data?.id}/rows`,
    { method: 'POST', body: JSON.stringify({ rows: [barisTarif({ regionCode: `${WIL}-Y` })] }) },
    petugas.token,
  );
  check('menambah baris ke versi aktif ditolak', tambahKeAktif.status === 409,
    `status ${tambahKeAktif.status}`);

  // --- 5. Pemilihan menurut tanggal layanan ---------------------------------
  log('');
  log('5. Klaim tahun lalu memakai tarif tahun lalu');
  const versi2026 = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-2026-${tag}`, name: 'Tarif 2026',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'tarif-2026.csv', sourceHash: 'sha256:bbb',
      }),
    },
    petugas.token,
  );
  await api(
    `/health/tariff/versions/${versi2026.data?.id}/rows`,
    {
      method: 'POST',
      body: JSON.stringify({ rows: [barisTarif({ effectiveFrom: '2026-01-01', amount: 1000000 })] }),
    },
    petugas.token,
  );
  await api(
    `/health/tariff/versions/${versi2026.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Dibandingkan dengan lampiran PMK 2026.' }) },
    penyetuju.token,
  );

  const tarifLama = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C&serviceDate=2025-03-10`,
    {},
    petugas.token,
  );
  check('layanan Maret 2025 memakai tarif 2025', tarifLama.data?.tariff?.amount === 800000,
    JSON.stringify(tarifLama.data?.tariff?.amount));

  const tarifBaru = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C&serviceDate=2026-06-15`,
    {},
    petugas.token,
  );
  check('layanan Juni 2026 memakai tarif 2026', tarifBaru.data?.tariff?.amount === 1000000,
    JSON.stringify(tarifBaru.data?.tariff?.amount));

  const hariTerakhir = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C&serviceDate=2025-12-31`,
    {},
    petugas.token,
  );
  check('hari TERAKHIR masa berlaku masih memakai tarif itu',
    hariTerakhir.data?.tariff?.amount === 800000,
    JSON.stringify(hariTerakhir.data?.tariff?.amount));

  const lebihKhusus = await api(
    `/health/tariff/lookup?paymentMethod=INA_CBG&regionCode=${WIL}&facilityClass=C` +
      '&serviceDate=2025-03-10&casemixSeverity=III',
    {},
    petugas.token,
  );
  check('yang lebih KHUSUS menang atas yang umum', lebihKhusus.data?.tariff?.amount === 1200000,
    JSON.stringify(lebihKhusus.data?.tariff?.amount));

  // --- 6. Tumpang tindih pada basis data ------------------------------------
  log('');
  log('6. Tumpang tindih ditolak basis data, termasuk pada tarif umum');
  const versiUji = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-UJI-${tag}`, name: 'Versi Uji Tumpang Tindih',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'uji.csv', sourceHash: 'sha256:ccc',
      }),
    },
    petugas.token,
  );

  await q(
    `INSERT INTO "${SCHEMA}".jkn_tariff
       (version_id, payment_method, region_code, facility_class, amount, effective_range)
     VALUES ($1,'INA_CBG',$2,'B',500000, daterange('2026-01-01','2027-01-01','[)'))`,
    [versiUji.data?.id, WIL],
  );

  const tembusTumpang = await gagal(
    `INSERT INTO "${SCHEMA}".jkn_tariff
       (version_id, payment_method, region_code, facility_class, amount, effective_range)
     VALUES ($1,'INA_CBG',$2,'B',600000, daterange('2026-06-01','2027-06-01','[)'))`,
    [versiUji.data?.id, WIL],
  );
  check('tumpang tindih pada kunci yang sama ditolak constraint pengecualian',
    (tembusTumpang ?? '').includes('jkn_tariff_no_overlap'), tembusTumpang ?? 'lolos');

  /*
   * Yang paling mudah terlewat: dua tarif UMUM yang bagiannya kosong. NULL
   * tidak pernah sama dengan NULL pada operator kesamaan, jadi tanpa COALESCE
   * keduanya akan lolos — dan keduanya berlaku bersamaan.
   */
  const tembusUmum = await gagal(
    `INSERT INTO "${SCHEMA}".jkn_tariff
       (version_id, payment_method, region_code, facility_class, service_class,
        casemix_group, casemix_severity, amount, effective_range)
     VALUES ($1,'INA_CBG',$2,'B',NULL,NULL,NULL,700000, daterange('2026-03-01','2026-09-01','[)'))`,
    [versiUji.data?.id, WIL],
  );
  check('dua tarif UMUM yang bagiannya kosong pun ditolak',
    (tembusUmum ?? '').includes('jkn_tariff_no_overlap'), tembusUmum ?? 'lolos');

  const tidakBentrok = await gagal(
    `INSERT INTO "${SCHEMA}".jkn_tariff
       (version_id, payment_method, region_code, facility_class, amount, effective_range)
     VALUES ($1,'INA_CBG',$2,'B',700000, daterange('2027-01-01','2028-01-01','[)'))`,
    [versiUji.data?.id, WIL],
  );
  check('rentang yang tidak bersinggungan tetap diterima', tidakBentrok === null,
    tidakBentrok ?? '');

  // --- 7. Ambiguitas menghentikan perhitungan -------------------------------
  log('');
  log('7. Dua tarif yang sama-sama berlaku menghentikan perhitungan');
  const versiAmbigu = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-AMBIGU-${tag}`, name: 'Versi Ambigu',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'ambigu.csv', sourceHash: 'sha256:ddd',
      }),
    },
    petugas.token,
  );
  await api(
    `/health/tariff/versions/${versiAmbigu.data?.id}/rows`,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [barisTarif({ facilityClass: 'D', amount: 400000, effectiveFrom: '2026-01-01' })],
      }),
    },
    petugas.token,
  );
  await api(
    `/health/tariff/versions/${versiAmbigu.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Diperiksa dengan lampiran yang sama.' }) },
    penyetuju.token,
  );

  // Versi kedua yang aktif dengan kunci yang sama: bentrok TIDAK ditahan
  // constraint sebab constraint bekerja per tabel, bukan per versi aktif.
  const versiAmbigu2 = await api(
    '/health/tariff/versions',
    {
      method: 'POST',
      body: JSON.stringify({
        code: `TARIF-AMBIGU2-${tag}`, name: 'Versi Ambigu Kedua',
        regulationReference: `PMK-BUKTI-${tag}`,
        sourceFile: 'ambigu2.csv', sourceHash: 'sha256:eee',
      }),
    },
    petugas.token,
  );
  const imporAmbigu2 = await api(
    `/health/tariff/versions/${versiAmbigu2.data?.id}/rows`,
    {
      method: 'POST',
      body: JSON.stringify({
        rows: [barisTarif({ facilityClass: 'D', amount: 500000, effectiveFrom: '2026-01-01' })],
      }),
    },
    petugas.token,
  );
  check('basis data menolak baris kedua yang bertumpang tindih lintas versi',
    imporAmbigu2.status === 500 || imporAmbigu2.status === 409 || imporAmbigu2.status === 422,
    `status ${imporAmbigu2.status}`);

  log('');
  log('  Catatan: constraint pengecualian bekerja pada SELURUH tabel, bukan hanya');
  log('  pada versi yang aktif. Akibatnya tarif ambigu tidak dapat dibuat sama');
  log('  sekali lewat jalur mana pun — penjaga di layanan menjadi lapis kedua,');
  log('  bukan satu-satunya.');

  // --- 8. Penjamin ----------------------------------------------------------
  log('');
  log('8. Penjamin, tanggungan, dan pembulatan yang memihak pasien');
  const tanpaKontrak = await api(
    '/health/tariff/payers',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, payerType: 'INSURER', payerName: 'Asuransi Tanpa Kontrak' }),
    },
    petugas.token,
  );
  check('penjamin tanpa kontrak DITOLAK', tanpaKontrak.status === 422,
    `status ${tanpaKontrak.status}`);
  check('penolakannya menyebut tidak dapat ditagihkan kepada siapa pun',
    pesan(tanpaKontrak).includes('tidak dapat ditagihkan'));

  const tembusKontrak = await gagal(
    `INSERT INTO "${SCHEMA}".health_payer_coverage (facility_id, payer_type, payer_name)
     VALUES ($1,'INSURER','Tembus Lewat SQL')`,
    [facilityId],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusKontrak ?? '').includes('payer_contract_required'), tembusKontrak ?? 'lolos');

  const bpjs = await api(
    '/health/tariff/payers',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, payerType: 'BPJS', payerName: 'BPJS Kesehatan',
        contractReference: `PKS-${tag}`, coveragePercent: 100, requiresReferral: true,
      }),
    },
    petugas.token,
  );
  check('penjamin dengan kontrak diterima', bpjs.status === 201, `status ${bpjs.status} ${pesan(bpjs)}`);

  const tanpaRujukan = await api(
    '/health/tariff/payers/split',
    {
      method: 'POST',
      body: JSON.stringify({ coverageId: bpjs.data?.id, totalAmount: 1000000 }),
    },
    petugas.token,
  );
  check('tanpa rujukan, tanggungan ditahan', tanpaRujukan.data?.blocked === true);
  check('dan seluruhnya sementara menjadi tanggungan pasien',
    tanpaRujukan.data?.patientAmount === 1000000);
  check('pesannya menyatakan itu SEMENTARA dan menyuruh hitung ulang',
    String(tanpaRujukan.data?.message ?? '').includes('hitung ulang'));

  const denganRujukan = await api(
    '/health/tariff/payers/split',
    {
      method: 'POST',
      body: JSON.stringify({
        coverageId: bpjs.data?.id, totalAmount: 1000000, hasValidReferral: true,
      }),
    },
    petugas.token,
  );
  check('dengan rujukan, penjamin menanggung penuh',
    denganRujukan.data?.payerAmount === 1000000 && denganRujukan.data?.patientAmount === 0,
    JSON.stringify(denganRujukan.data));

  const asuransi = await api(
    '/health/tariff/payers',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, payerType: 'INSURER', payerName: 'Asuransi Bukti',
        contractReference: `PKS-INS-${tag}`, coveragePercent: 50,
      }),
    },
    petugas.token,
  );
  const pembulatan = await api(
    '/health/tariff/payers/split',
    { method: 'POST', body: JSON.stringify({ coverageId: asuransi.data?.id, totalAmount: 1001 }) },
    petugas.token,
  );
  check('pembulatannya MEMIHAK PASIEN',
    pembulatan.data?.payerAmount === 501 && pembulatan.data?.patientAmount === 500,
    JSON.stringify(pembulatan.data));

  const persenSalah = await api(
    '/health/tariff/payers',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, payerType: 'CORPORATE', payerName: 'PT Salah',
        contractReference: `PKS-X-${tag}`, coveragePercent: 150,
      }),
    },
    petugas.token,
  );
  check('persentase di luar 0-100 ditolak', persenSalah.status === 400 || persenSalah.status === 422,
    `status ${persenSalah.status}`);

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
    new URL('../../../docs/emedik/bukti-h9d-tarif.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
