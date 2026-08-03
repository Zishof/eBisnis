/**
 * Bukti H-9K: dasbor investor agregat, waterfall, dan distribusi.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan naskah ini adalah **ketiadaan**, dan
 * ketiadaannya diperiksa pada `information_schema` — bukan dengan membaca
 * kodenya:
 *
 * 1. **Tabel proyeksi investor tidak punya satu pun kolom pasien.** Tidak ada
 *    `patient_id`, tidak ada `encounter_id`, tidak ada kunci asing ke tabel
 *    klinis mana pun. Bukan karena kuerinya tidak akan mengambilnya, melainkan
 *    karena tabelnya tidak punya tempat untuk menyimpannya.
 *
 * 2. **Investor memegang tepat satu hak** pada seluruh dasbor: membacanya. Ia
 *    tidak dapat menghitung ulang, tidak dapat mengubah ambang kohort, dan
 *    tidak dapat menyetujui apa pun.
 *
 * 3. **Sel yang tersamar tidak menyimpan nilainya di basis data** — bukan
 *    menyimpan lalu menyembunyikan saat ditampilkan. Naskah ini membaca
 *    barisnya langsung dan menuntut kolomnya NULL.
 *
 * Selebihnya, yang seharusnya DITOLAK memang ditolak:
 *
 * - ambang kohort nol;
 * - waterfall yang menunjuk kontrak fee sistem alih-alih kontrak investor;
 * - lapisan yang berupa jumlah sekaligus persentase;
 * - distribusi yang disetujui penghitungnya sendiri;
 * - distribusi yang dibayar penyetujunya sendiri;
 * - dan perubahan nilai distribusi yang sudah dibayar.
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
const AWAL = hari(-30);
const AKHIR = hari(0);

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
  const username = `bukti_inv_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9K',FALSE) RETURNING id`,
      [`BUKTI_INV_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9K — DASBOR INVESTOR AGREGAT, WATERFALL, DAN DISTRIBUSI');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const analis = await buatPengguna(tenantId, 'analis', {
    HEALTH: ['READ'],
    HEALTH_INVESTOR_DASHBOARD: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_INVESTOR_WATERFALL: ['READ', 'CREATE', 'UPDATE'],
    // APPROVE diberikan pula, dan itu disengaja — sama seperti manajemen dan
    // kasir. Tanpanya, penolakan "penghitung tidak menyetujui" datang dari
    // penjaga hak akses alih-alih dari pemeriksaan baris, dan ujinya lulus
    // tanpa membuktikan apa pun tentang pemeriksaan barisnya.
    HEALTH_INVESTOR_DISTRIBUTION: ['READ', 'CREATE', 'APPROVE'],
    HEALTH_FEE_CONTRACT: ['READ'],
  });
  const manajemen = await buatPengguna(tenantId, 'manajemen', {
    HEALTH: ['READ'],
    HEALTH_INVESTOR_DASHBOARD: ['READ'],
    HEALTH_INVESTOR_WATERFALL: ['READ', 'ACTIVATE'],
    // CREATE diberikan pula, dan itu disengaja: penolakan "yang menghitung
    // tidak menyetujui" harus datang dari pemeriksaan baris, bukan dari
    // ketiadaan hak akses. Pelajaran H-9J.
    HEALTH_INVESTOR_DISTRIBUTION: ['READ', 'CREATE', 'APPROVE'],
  });
  const kasir = await buatPengguna(tenantId, 'kasir', {
    HEALTH: ['READ'],
    // APPROVE diberikan pula, dengan alasan yang sama.
    HEALTH_INVESTOR_DISTRIBUTION: ['READ', 'APPROVE', 'POST'],
  });
  const investor = await buatPengguna(tenantId, 'investor', {
    HEALTH: ['READ'],
    // TEPAT SATU HAK. Inilah yang diuji.
    HEALTH_INVESTOR_DASHBOARD: ['READ'],
  });

  log('');
  log('Empat pengguna. Analis menghitung; manajemen menyetujui; kasir membayar;');
  log('investor HANYA membaca. Manajemen dan kasir sengaja diberi hak yang lebih');
  log('luas daripada yang dipakainya, supaya penolakan "yang menghitung tidak');
  log('menyetujui" datang dari pemeriksaan baris — bukan dari ketiadaan hak.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Investor','HOSPITAL') RETURNING id`,
      [`BKIV-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Investor','Asia/Jakarta') RETURNING id`,
      [typeId, `IV-${tag}`],
    )
  )[0].id;

  // --- 1. Tabel proyeksi tidak berkolom pasien -----------------------------
  log('');
  log('1. TABEL PROYEKSI INVESTOR TIDAK PUNYA SATU PUN KOLOM PASIEN');
  const kolomPasien = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name IN ('investor_projection', 'investor_projection_cell')
        AND (column_name ILIKE '%patient%' OR column_name ILIKE '%encounter%'
             OR column_name ILIKE '%diagnos%' OR column_name = 'nik'
             OR column_name ILIKE '%medical_record%')`,
    [SCHEMA],
  );
  check('tidak ada kolom pasien, kunjungan, atau diagnosis', kolomPasien[0].n === 0,
    `${kolomPasien[0].n} kolom`);

  const kunciAsing = await q(
    `SELECT count(*)::int AS n
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name IN ('investor_projection', 'investor_projection_cell')
        AND ccu.table_name IN ('patient', 'health_encounter', 'health_claim',
                               'clinical_note', 'lab_order', 'lab_result')`,
    [SCHEMA],
  );
  check('dan tidak satu pun kunci asing ke tabel klinis', kunciAsing[0].n === 0,
    `${kunciAsing[0].n} kunci asing`);

  // --- 2. Ambang kohort ----------------------------------------------------
  log('');
  log('2. Ambang kohort tidak boleh nol');
  const kebijakan = await api(
    `/health/investor/disclosure-policy?facilityId=${facilityId}`,
    {},
    analis.token,
  );
  check('kebijakan tersemai bagi fasilitas baru', kebijakan.data?.seeded === true,
    JSON.stringify(kebijakan.data ?? {}));
  check('dengan ambang bawaan bukan nol', (kebijakan.data?.minimumCohort ?? 0) >= 1,
    `${kebijakan.data?.minimumCohort}`);

  const ambangNol = await api(
    `/health/investor/disclosure-policy/${facilityId}`,
    { method: 'POST', body: JSON.stringify({ minimumCohort: 0 }) },
    analis.token,
  );
  check('ambang nol DITOLAK', ambangNol.status === 400 || ambangNol.status === 422,
    `status ${ambangNol.status}`);

  const tembusAmbang = await gagal(
    `UPDATE "${SCHEMA}".investor_disclosure_policy SET minimum_cohort = 0 WHERE facility_id = $1`,
    [facilityId],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusAmbang ?? '').includes('investor_policy_cohort_not_zero'), tembusAmbang ?? 'lolos');

  await api(
    `/health/investor/disclosure-policy/${facilityId}`,
    { method: 'POST', body: JSON.stringify({ minimumCohort: 5 }) },
    analis.token,
  );

  // --- 3. Data sumber, sebagian berkohort kecil ----------------------------
  log('');
  log('3. Penyamaran: yang kohortnya kecil disembunyikan, dan BUKAN menjadi nol');
  const unitBesar = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service_unit (facility_id, code, name, unit_type)
       VALUES ($1,$2,'Poliklinik Umum','POLYCLINIC') RETURNING id`,
      [facilityId, `UBS-${tag}`],
    )
  )[0].id;
  const unitKecil = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service_unit (facility_id, code, name, unit_type)
       VALUES ($1,$2,'Poliklinik Kulit','POLYCLINIC') RETURNING id`,
      [facilityId, `UKC-${tag}`],
    )
  )[0].id;
  const unitSedang = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service_unit (facility_id, code, name, unit_type)
       VALUES ($1,$2,'Poliklinik Gigi','POLYCLINIC') RETURNING id`,
      [facilityId, `USD-${tag}`],
    )
  )[0].id;

  const buatKunjungan = async (unitId, jumlah) => {
    for (let i = 0; i < jumlah; i += 1) {
      const pid = (
        await q(
          `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
           VALUES ($1,$2,'1990-01-01','FEMALE') RETURNING id`,
          [`EPI-IV-${tag}-${randomBytes(3).toString('hex')}`, `Pasien Bukti ${i}`],
        )
      )[0].id;
      await q(
        `INSERT INTO "${SCHEMA}".health_encounter
           (facility_id, patient_id, service_unit_id, encounter_number, encounter_type,
            started_at, status)
         VALUES ($1,$2,$3,$4,'OUTPATIENT', now() - interval '5 days', 'COMPLETED')`,
        [facilityId, pid, unitId, `ENC-IV-${tag}-${randomBytes(3).toString('hex')}`],
      );
    }
  };
  await buatKunjungan(unitBesar, 12);
  await buatKunjungan(unitSedang, 7);
  // Poliklinik Kulit: dua orang. Persis contoh pada dokumen 16.
  await buatKunjungan(unitKecil, 2);

  const proyeksi = await api(
    '/health/investor/projections',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, periodStart: AWAL, periodEnd: AKHIR }),
    },
    analis.token,
  );
  check('proyeksi dihitung', proyeksi.status === 201,
    `status ${proyeksi.status} ${pesan(proyeksi)}`);

  const kunjungan = (proyeksi.data?.metrics ?? []).find((m) => m.metricCode === 'encounterCount');
  check('sebagian selnya tersamar', (kunjungan?.suppressed ?? 0) >= 1,
    `${kunjungan?.suppressed} tersamar`);

  const selKulit = await q(
    `SELECT c.breakdown_key, c.cell_value, c.cell_cohort, c.suppressed, c.suppression_reason
       FROM "${SCHEMA}".investor_projection_cell c
       JOIN "${SCHEMA}".investor_projection p ON p.id = c.projection_id
      WHERE p.facility_id = $1 AND p.metric_code = 'encounterCount'
        AND c.breakdown_key = 'Poliklinik Kulit'`,
    [facilityId],
  );
  check('Poliklinik Kulit tersamar', selKulit[0]?.suppressed === true,
    JSON.stringify(selKulit[0] ?? {}));
  check('NILAINYA TIDAK TERSIMPAN DI BASIS DATA', selKulit[0]?.cell_value === null,
    `nilai ${selKulit[0]?.cell_value}`);
  check('dan bukan tersimpan sebagai nol', selKulit[0]?.cell_value !== '0');
  check('KOHORTNYA pun tidak tersimpan', selKulit[0]?.cell_cohort === null,
    `kohort ${selKulit[0]?.cell_cohort}`);
  check('sebabnya tercatat', selKulit[0]?.suppression_reason === 'BELOW_THRESHOLD');

  const tembusSel = await gagal(
    `UPDATE "${SCHEMA}".investor_projection_cell SET cell_value = 999, cell_cohort = 2
      WHERE suppressed = TRUE AND projection_id IN (
        SELECT id FROM "${SCHEMA}".investor_projection WHERE facility_id = $1)`,
    [facilityId],
  );
  check('menyimpan nilai pada sel tersamar ditolak constraint',
    (tembusSel ?? '').includes('investor_cell_suppressed_empty'), tembusSel ?? 'lolos');

  const selBesar = await q(
    `SELECT c.suppressed FROM "${SCHEMA}".investor_projection_cell c
       JOIN "${SCHEMA}".investor_projection p ON p.id = c.projection_id
      WHERE p.facility_id = $1 AND p.metric_code = 'encounterCount'
        AND c.breakdown_key = 'Poliklinik Umum'`,
    [facilityId],
  );
  check('UJI KENDALI: Poliklinik Umum yang berkohort 12 TIDAK tersamar',
    selBesar[0]?.suppressed === false);

  const selGigi = await q(
    `SELECT c.suppressed, c.suppression_reason FROM "${SCHEMA}".investor_projection_cell c
       JOIN "${SCHEMA}".investor_projection p ON p.id = c.projection_id
      WHERE p.facility_id = $1 AND p.metric_code = 'encounterCount'
        AND c.breakdown_key = 'Poliklinik Gigi'`,
    [facilityId],
  );
  check('PENYAMARAN PELENGKAP: Poliklinik Gigi ikut tersamar sekalipun berkohort 7',
    selGigi[0]?.suppressed === true, JSON.stringify(selGigi[0] ?? {}));
  check('dan sebabnya dibedakan', selGigi[0]?.suppression_reason === 'COMPLEMENT_DISCLOSURE');

  // --- 4. Investor membaca, tidak menghitung -------------------------------
  log('');
  log('4. INVESTOR MEMEGANG TEPAT SATU HAK: MEMBACA');
  const bacaInvestor = await api(
    `/health/investor/projections?facilityId=${facilityId}&periodStart=${AWAL}&periodEnd=${AKHIR}`,
    {},
    investor.token,
  );
  check('investor dapat membaca proyeksi', bacaInvestor.status === 200,
    `status ${bacaInvestor.status} ${pesan(bacaInvestor)}`);

  const metrikBaca = (bacaInvestor.data?.metrics ?? []).find((m) => m.metricCode === 'encounterCount');
  const kulitBaca = (metrikBaca?.breakdown ?? []).find((b) => b.key === 'Poliklinik Kulit');
  check('yang tersamar dikembalikan sebagai null, bukan nol', kulitBaca?.value === null);
  check('dan disebutkan sebabnya kepada investor',
    String(kulitBaca?.note ?? '').includes('BUKAN nol'));
  check('dasbornya mengatakan bahwa ia menyembunyikan',
    String(bacaInvestor.data?.note ?? '').includes('gambaran lengkap'));

  const jawabanInvestor = JSON.stringify(bacaInvestor.body);
  check('tidak ada satu pun nama pasien pada jawabannya',
    !/Pasien Bukti/.test(jawabanInvestor));
  check('dan tidak ada medan pasien mana pun',
    !/"patient|"nik"|"diagnosis|"medicalRecord/i.test(jawabanInvestor));

  const investorHitung = await api(
    '/health/investor/projections',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, periodStart: AWAL, periodEnd: AKHIR }),
    },
    investor.token,
  );
  check('INVESTOR TIDAK DAPAT MENGHITUNG ULANG', investorHitung.status === 403,
    `status ${investorHitung.status}`);

  const investorAmbang = await api(
    `/health/investor/disclosure-policy/${facilityId}`,
    { method: 'POST', body: JSON.stringify({ minimumCohort: 1 }) },
    investor.token,
  );
  check('dan tidak dapat melonggarkan ambang kohortnya', investorAmbang.status === 403,
    `status ${investorAmbang.status}`);

  const investorDistribusi = await api(
    `/health/investor/distributions?facilityId=${facilityId}`,
    {},
    investor.token,
  );
  check('dan tidak dapat melihat daftar distribusi', investorDistribusi.status === 403,
    `status ${investorDistribusi.status}`);

  const investorPasien = await api(`/health/patients?facilityId=${facilityId}`, {}, investor.token);
  check('dan tidak dapat membaca daftar pasien', investorPasien.status === 403,
    `status ${investorPasien.status}`);

  // --- 5. Waterfall --------------------------------------------------------
  log('');
  log('5. Waterfall: urutan mengikat, dan lapisan tidak boleh berdua dasar');
  /*
   * Kontrak AKTIF disusun lengkap dengan rantai tiga orangnya.
   *
   * Constraint fee_contract_active_complete dari H-9G menuntut seluruh
   * syaratnya sekaligus, dan naskah ini memenuhinya — bukan menembusnya.
   * Kontrak yang ditembus akan membuat pemeriksaan H-9K berikutnya lulus di
   * atas keadaan yang tidak mungkin terjadi pada penggunaan sungguhan.
   */
  const buatKontrak = async (jenis, nama, maksimum, status) => {
    const lengkap =
      status === 'ACTIVE'
        ? {
            ref: `KTR-${jenis}-${tag}`,
            telaah: 'Telaah hukum lengkap oleh biro hukum; klausulnya sesuai peraturan.',
            pajak: 'PPh Pasal 23 dipotong pada saat pembayaran.',
          }
        : { ref: null, telaah: null, pajak: null };
    return (
      await q(
        `INSERT INTO "${SCHEMA}".fee_contract
           (facility_id, contract_type, counterparty_name, maximum_percent, status,
            contract_reference, legal_review_note, legal_reviewed_by, legal_reviewed_at,
            tax_treatment, effective_from, prepared_by, prepared_at, approved_by, approved_at)
         VALUES ($1,$2,$3,$4,$5::varchar,$6,$7,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN gen_random_uuid() END,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN now() - interval '45 days' END,
                 $8,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN CURRENT_DATE - 30 END,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN gen_random_uuid() END,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN now() END,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN gen_random_uuid() END,
                 CASE WHEN $5::varchar = 'ACTIVE' THEN now() END)
         RETURNING id`,
        [facilityId, jenis, nama, maksimum, status, lengkap.ref, lengkap.telaah, lengkap.pajak],
      )
    )[0].id;
  };

  const kontrakSistem = await buatKontrak('SYSTEM_PLATFORM_FEE', 'Platform eBisnis', 5, 'ACTIVE');
  const kontrakInvestor = await buatKontrak('INVESTOR_SHARE', 'PT Modal Sehat', 25, 'ACTIVE');

  const waterfallSalahKontrak = await api(
    '/health/investor/waterfall',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, feeContractId: kontrakSistem, name: 'Waterfall Salah Kontrak',
        tiers: [{ order: 1, type: 'OPERATING_COST', amount: 100 }],
      }),
    },
    analis.token,
  );
  check('waterfall yang menunjuk kontrak fee SISTEM ditolak',
    waterfallSalahKontrak.status === 422, `status ${waterfallSalahKontrak.status}`);
  check('penolakannya menyebut aturan yang bukan miliknya',
    pesan(waterfallSalahKontrak).includes('bukan miliknya'));

  const lapisanDuaDasar = await api(
    '/health/investor/waterfall',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, feeContractId: kontrakInvestor, name: 'Waterfall Dua Dasar',
        tiers: [{ order: 1, type: 'OPERATING_COST', amount: 100, percent: 50 }],
      }),
    },
    analis.token,
  );
  check('lapisan berupa jumlah SEKALIGUS persentase ditolak', lapisanDuaDasar.status === 422,
    `status ${lapisanDuaDasar.status}`);
  check('penolakannya menyebut lapisan yang tidak pernah menerima apa pun',
    pesan(lapisanDuaDasar).includes('tidak pernah menerima apa pun'));

  const waterfall = await api(
    '/health/investor/waterfall',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, feeContractId: kontrakInvestor, name: 'Waterfall Investor 2026',
        effectiveFrom: AWAL,
        tiers: [
          { order: 1, type: 'OPERATING_COST', amount: 600 },
          { order: 2, type: 'DEBT_SERVICE', amount: 200 },
          { order: 3, type: 'PROFIT_SHARE', percent: 50 },
        ],
      }),
    },
    analis.token,
  );
  check('waterfall tersusun', waterfall.status === 201,
    `status ${waterfall.status} ${pesan(waterfall)}`);

  const simulasiCukup = await api(
    `/health/investor/waterfall/${waterfall.data?.id}/simulate`,
    { method: 'POST', body: JSON.stringify({ distributableAmount: 1000 }) },
    analis.token,
  );
  check('simulasi dana cukup memenuhi seluruh lapisan',
    (simulasiCukup.data?.lapisan ?? []).every((l) => l.kurang === 0),
    JSON.stringify((simulasiCukup.data?.lapisan ?? []).map((l) => [l.jenis, l.dibayar])));
  check('persentase dihitung terhadap SISA, bukan nilai awal',
    (simulasiCukup.data?.lapisan ?? [])[2]?.dibayar === 100,
    `${(simulasiCukup.data?.lapisan ?? [])[2]?.dibayar}`);

  const simulasiKurang = await api(
    `/health/investor/waterfall/${waterfall.data?.id}/simulate`,
    { method: 'POST', body: JSON.stringify({ distributableAmount: 400 }) },
    analis.token,
  );
  check('DANA YANG KURANG TIDAK DIBAGI RATA',
    (simulasiKurang.data?.lapisan ?? [])[0]?.dibayar === 400 &&
      (simulasiKurang.data?.lapisan ?? [])[1]?.dibayar === 0,
    JSON.stringify((simulasiKurang.data?.lapisan ?? []).map((l) => l.dibayar)));
  check('kekurangannya dicatat', (simulasiKurang.data?.lapisan ?? [])[1]?.kurang === 200);
  check('dan simulasinya tidak menyimpan apa pun',
    simulasiKurang.data?.simulationOnly === true);

  const tersimpan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".investor_distribution WHERE facility_id = $1`,
    [facilityId],
  );
  check('tidak ada distribusi yang lahir dari simulasi', tersimpan[0].n === 0,
    `${tersimpan[0].n} baris`);

  // --- 6. Distribusi tanpa kontrak aktif -----------------------------------
  log('');
  log('6. Tanpa kontrak AKTIF, bagian investor bernilai NOL');
  const kontrakDraft = await buatKontrak('INVESTOR_SHARE', 'PT Belum Berkontrak', 25, 'DRAFT');
  const distNol = await api(
    '/health/investor/distributions',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, feeContractId: kontrakDraft, periodStart: AWAL, periodEnd: AKHIR,
        distributableAmount: 1000, requestedPercent: 20,
      }),
    },
    analis.token,
  );
  check('perhitungannya BERHASIL, bukan galat', distNol.status === 201,
    `status ${distNol.status} ${pesan(distNol)}`);
  check('dan bagiannya NOL', distNol.data?.investorAmount === 0,
    `${distNol.data?.investorAmount}`);
  check('alasannya menyebut nol sebagai jawaban yang benar',
    String(distNol.data?.reason ?? '').includes('nol adalah jawaban yang benar'));

  // --- 7. Batas kontrak ----------------------------------------------------
  log('');
  log('7. Persentase yang melampaui batas kontrak DIBATASI');
  const distDibatasi = await api(
    '/health/investor/distributions',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, feeContractId: kontrakInvestor, policyId: waterfall.data?.id,
        periodStart: AWAL, periodEnd: AKHIR,
        distributableAmount: 1000, requestedPercent: 60,
      }),
    },
    analis.token,
  );
  check('dibatasi pada batas kontraknya', distDibatasi.data?.investorPercent === 25,
    `${distDibatasi.data?.investorPercent}`);
  check('penandanya diangkat', distDibatasi.data?.wasCapped === true);
  check('alasannya menyebut batas yang tidak pernah dibaca',
    String(distDibatasi.data?.reason ?? '').includes('tidak pernah membacanya'));
  check('perhitungan TIDAK memindahkan uang',
    String(distDibatasi.data?.note ?? '').includes('TIDAK memindahkan uang'));

  // --- 8. Tiga orang -------------------------------------------------------
  log('');
  log('8. Tiga orang: yang menghitung, yang menyetujui, yang membayar');
  const setujuSendiri = await api(
    `/health/investor/distributions/${distDibatasi.data?.id}/approve`,
    { method: 'POST', body: JSON.stringify({ note: 'Disetujui oleh penghitungnya sendiri.' }) },
    analis.token,
  );
  check('penghitung tidak menyetujuinya sendiri', setujuSendiri.status === 403,
    `status ${setujuSendiri.status}`);
  check('penolakannya menyebut ia yang membuatnya',
    pesan(setujuSendiri).includes('ia yang membuatnya'));

  const bayarBelumSetuju = await api(
    `/health/investor/distributions/${distDibatasi.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ paymentReference: 'TRF-001' }) },
    kasir.token,
  );
  check('yang belum disetujui tidak dapat dibayar', bayarBelumSetuju.status === 422,
    `status ${bayarBelumSetuju.status}`);
  check('penolakannya menyebut tidak ada pembayaran otomatis',
    pesan(bayarBelumSetuju).includes('Tidak ada pembayaran otomatis'));

  const setuju = await api(
    `/health/investor/distributions/${distDibatasi.data?.id}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ note: 'Sesuai kontrak PT Modal Sehat dan waterfall 2026.' }),
    },
    manajemen.token,
  );
  check('manajemen menyetujuinya', setuju.data?.status === 'APPROVED',
    `status ${setuju.status} ${pesan(setuju)}`);

  const bayarPenyetuju = await api(
    `/health/investor/distributions/${distDibatasi.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ paymentReference: 'TRF-002' }) },
    manajemen.token,
  );
  check('penyetuju tidak membayarkannya sendiri',
    bayarPenyetuju.status === 403 || bayarPenyetuju.status === 422,
    `status ${bayarPenyetuju.status}`);

  const bayar = await api(
    `/health/investor/distributions/${distDibatasi.data?.id}/pay`,
    { method: 'POST', body: JSON.stringify({ paymentReference: 'TRF-2026-0044' }) },
    kasir.token,
  );
  check('kasir membayarkannya', bayar.data?.status === 'PAID',
    `status ${bayar.status} ${pesan(bayar)}`);

  const tembusTigaOrang = await gagal(
    `UPDATE "${SCHEMA}".investor_distribution
        SET approved_by = calculated_by WHERE id = $1`,
    [distNol.data?.id],
  );
  check('menembus pemisahannya lewat basis data ditolak constraint',
    (tembusTigaOrang ?? '').includes('investor_dist_approve_not_self'),
    tembusTigaOrang ?? 'lolos');

  // --- 9. Yang sudah dibayar tidak berubah ---------------------------------
  log('');
  log('9. Nilai distribusi yang sudah dibayar tidak dapat diubah');
  const ubahNilai = await gagal(
    `UPDATE "${SCHEMA}".investor_distribution SET investor_amount = 999 WHERE id = $1`,
    [distDibatasi.data?.id],
  );
  check('mengubah nilainya ditolak trigger',
    (ubahNilai ?? '').includes('DISTRIBUTION_IMMUTABLE'), ubahNilai ?? 'lolos');
  check('alasannya menyebut catatan yang berbeda dari mutasi rekening',
    (ubahNilai ?? '').includes('mutasi rekening'));

  const hapusDibayar = await gagal(
    `DELETE FROM "${SCHEMA}".investor_distribution WHERE id = $1`,
    [distDibatasi.data?.id],
  );
  check('menghapusnya pun ditolak',
    (hapusDibayar ?? '').includes('DISTRIBUTION_IMMUTABLE'), hapusDibayar ?? 'lolos');

  const ubahBelumBayar = await gagal(
    `UPDATE "${SCHEMA}".investor_distribution SET approval_note = 'catatan' WHERE id = $1`,
    [distNol.data?.id],
  );
  check('UJI KENDALI: yang belum dibayar masih dapat disunting', ubahBelumBayar === null,
    ubahBelumBayar ?? '');

  const melampauiDana = await gagal(
    `INSERT INTO "${SCHEMA}".investor_distribution
       (facility_id, fee_contract_id, distribution_number, period_start, period_end,
        distributable_amount, investor_amount)
     VALUES ($1,$2,$3,CURRENT_DATE,CURRENT_DATE,100,500)`,
    [facilityId, kontrakInvestor, `DIS-LEBIH-${tag}`],
  );
  check('bagian yang melampaui dana yang dibagikan ditolak constraint',
    (melampauiDana ?? '').includes('investor_dist_within_pool'), melampauiDana ?? 'lolos');

  // --- 10. Kelengkapan daftar ----------------------------------------------
  log('');
  log('10. Daftar distribusi memuat siapa yang berbuat apa');
  const daftar = await api(
    `/health/investor/distributions?facilityId=${facilityId}`,
    {},
    manajemen.token,
  );
  const dibayar = (daftar.data ?? []).find((d) => d.status === 'PAID');
  check('daftar terbaca', daftar.status === 200, `status ${daftar.status}`);
  check('yang dibayar punya ketiganya',
    dibayar?.has_calculator === true && dibayar?.has_approver === true && dibayar?.has_payer === true,
    JSON.stringify(dibayar ?? {}));

  const totalDistribusi = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".investor_distribution
      WHERE facility_id = $1 AND status = 'PAID' AND (approved_by IS NULL OR paid_by IS NULL)`,
    [facilityId],
  );
  check('tidak satu pun distribusi PAID tanpa penyetuju atau pembayar',
    totalDistribusi[0].n === 0, `${totalDistribusi[0].n} baris`);

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
    new URL('../../../docs/emedik/bukti-h9k-investor.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
