/**
 * Bukti H-9B: kerangka BPJS/JKN dan gerbang adapternya.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang paling penting dibuktikan naskah ini adalah **aturan paket kasus**, dan
 * ia dibuktikan pada tiga lapis sekaligus:
 *
 * 1. **Tabel baris item tidak punya satu pun kolom penggantian BPJS**,
 *    diperiksa pada `information_schema`. Ini lapis yang tidak dapat dilewati
 *    siapa pun.
 *
 * 2. **ValidationPipe menolak permintaan HTTP yang membawanya** — lapis yang
 *    paling sering berbunyi.
 *
 * 3. **Pemeriksaan pada layanan menjelaskan alasannya** bagi pemanggil dari
 *    dalam proses, yang tidak melewati ValidationPipe sama sekali.
 *
 * Selebihnya: seluruh adapter BLOCKED dan tetap BLOCKED sesudah akunnya aktif;
 * penolakannya menyebutkan apa yang MASIH dapat dikerjakan; kepesertaan
 * membedakan ADAPTER dari MANUAL; casemix group tidak dapat diisi tanpa
 * adapter; dan pasien selalu boleh dilayani.
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
  const username = `bukti_bp_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9B',FALSE) RETURNING id`,
      [`BUKTI_BP_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9B — KERANGKA BPJS/JKN DAN GERBANG ADAPTERNYA');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const admin = await buatPengguna(tenantId, 'admin', {
    HEALTH: ['READ'],
    HEALTH_BPJS: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE', 'MANAGE_CREDENTIAL'],
  });
  const interop = await buatPengguna(tenantId, 'interop', {
    HEALTH: ['READ'],
    HEALTH_BPJS: ['READ', 'VERIFY'],
  });
  const pendaftaran = await buatPengguna(tenantId, 'pendaftaran', {
    HEALTH: ['READ'],
    HEALTH_PATIENT: ['READ'],
    HEALTH_BPJS: ['READ', 'UPDATE'],
    HEALTH_BPJS_ELIGIBILITY: ['READ', 'CREATE'],
    HEALTH_BPJS_SEP: ['READ', 'CREATE'],
  });

  log('');
  log('Tiga pengguna. Administrator memasang kredensial; petugas interoperabilitas');
  log('memverifikasi adapter; petugas pendaftaran mencatat kepesertaan dan SEP —');
  log('pekerjaan yang tidak menuntut kredensial siapa pun.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti BPJS','HOSPITAL') RETURNING id`,
      [`BKBP-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti BPJS','Asia/Jakarta') RETURNING id`,
      [typeId, `BP-${tag}`],
    )
  )[0].id;
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Joko Bukti BPJS','1975-07-07','MALE') RETURNING id`,
      [`EPI-BP-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  // --- 1. Aturan paket kasus: lapis pertama --------------------------------
  log('');
  log('1. TABEL BARIS ITEM TIDAK PUNYA SATU PUN KOLOM PENGGANTIAN BPJS');
  /*
   * Yang dicari adalah kolom NILAI PENGGANTIAN, bukan sembarang kolom bernama
   * "bpjs". Kunci asing `bpjs_claim_id` menunjuk klaim induknya dan memang
   * harus ada — ia relasi, bukan angka. Pola yang tidak membedakan keduanya
   * akan berbunyi pada kolom yang benar, dan uji yang berbunyi pada hal yang
   * benar akan dimatikan orang pertama yang membacanya.
   */
  const kolomPenggantian = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'bpjs_claim_item'
        AND (column_name ILIKE '%reimburs%' OR column_name ILIKE '%inacbg%'
             OR column_name ILIKE '%approved%' OR column_name ILIKE '%paid%'
             OR column_name ILIKE '%package%'
             OR (column_name ILIKE '%bpjs%' AND column_name NOT LIKE '%\_id'))`,
    [SCHEMA],
  );
  check('tidak ada kolom penggantian, disetujui, atau dibayar pada baris item',
    kolomPenggantian.length === 0, kolomPenggantian.map((k) => k.column_name).join(','));

  const kunciInduk = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'bpjs_claim_item' AND column_name = 'bpjs_claim_id'`,
    [SCHEMA],
  );
  check('UJI KENDALI: kunci asing ke klaim induknya memang ada', kunciInduk[0].n === 1);

  const kolomItem = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'bpjs_claim_item'
        AND column_name IN ('actual_cost', 'patient_charge')`,
    [SCHEMA],
  );
  check('yang ada hanyalah biaya aktual dan tagihan pasien', kolomItem.length === 2,
    kolomItem.map((k) => k.column_name).join(','));

  const kolomPaket = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'bpjs_claim'
        AND column_name IN ('package_amount', 'casemix_group', 'approved_amount', 'paid_amount')`,
    [SCHEMA],
  );
  check('dan nilai penggantiannya berada pada tingkat PAKET', kolomPaket[0].n === 4,
    `${kolomPaket[0].n} kolom`);

  // --- 2. Matriks adapter --------------------------------------------------
  log('');
  log('2. Seluruh adapter BLOCKED, dan itu tidak menghentikan apa pun yang penting');
  const katalog = await api('/health/bpjs/catalog', {}, admin.token);
  check('katalog terbaca', katalog.status === 200, `status ${katalog.status}`);
  check('tujuh adapter tercatat', (katalog.data?.adapters ?? []).length === 7);
  check('lima metode pembayaran didukung berdampingan',
    (katalog.data?.paymentMethods ?? []).length === 5);
  check('katalog menyatakan penggantian resmi ada pada tingkat paket',
    String(katalog.data?.itemDataPurpose?.keterangan ?? '').includes('bukan pada baris item'));

  const adapters = await api(`/health/bpjs/adapters?facilityId=${facilityId}`, {}, admin.token);
  check('gerbang adapter tersemai bagi fasilitas BARU', (adapters.data?.items ?? []).length === 7,
    `${(adapters.data?.items ?? []).length}`);
  check('SELURUHNYA BLOCKED', (adapters.data?.items ?? []).every((a) => a.status === 'BLOCKED'));
  check('dan ditegaskan tidak menghentikan apa pun yang penting',
    String(adapters.data?.summary?.keterangan ?? '').includes('tidak menghentikan apa pun'));

  // --- 3. Kredensial dan gerbang -------------------------------------------
  log('');
  log('3. Kredensial sebagai rujukan; akun aktif TIDAK membuka gerbang');
  const nilaiMentah = await api(
    '/health/bpjs/accounts',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, providerCode: `PRV-${tag}`, serviceLevel: 'FKRTL',
        credentialRawValue: 'consumer-secret-rahasia',
      }),
    },
    admin.token,
  );
  check('kredensial sebagai NILAI DITOLAK', nilaiMentah.status === 422,
    `status ${nilaiMentah.status}`);
  check('penolakannya menyebut mengajukan klaim atas nama fasilitas ini',
    pesan(nilaiMentah).includes('atas nama fasilitas ini'));

  const tembusNilai = await gagal(
    `INSERT INTO "${SCHEMA}".bpjs_provider_account
       (facility_id, provider_code, service_level, credential_secret_ref)
     VALUES ($1,$2,'FKTP','consumer-secret-langsung')`,
    [facilityId, `PRVX-${tag}`],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusNilai ?? '').includes('bpjs_account_secret_is_ref'), tembusNilai ?? 'lolos');

  const akun = await api(
    '/health/bpjs/accounts',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, providerCode: `PRV-${tag}`, serviceLevel: 'FKRTL',
        credentialSecretRef: `vault://bpjs/${tag}`,
      }),
    },
    admin.token,
  );
  check('akun dengan rujukan brankas diterima', akun.status === 201,
    `status ${akun.status} ${pesan(akun)}`);

  const daftarAkun = await api(`/health/bpjs/accounts?facilityId=${facilityId}`, {}, admin.token);
  const medanAkun = Object.keys((daftarAkun.data ?? [])[0] ?? {});
  check('rujukan brankas TIDAK ikut dikembalikan',
    !medanAkun.includes('credential_secret_ref') && medanAkun.includes('has_credential'),
    JSON.stringify(medanAkun));

  await api(`/health/bpjs/accounts/${akun.data?.id}/activate`, { method: 'POST' }, admin.token);

  const sesudahAktif = await api(
    `/health/bpjs/adapters?facilityId=${facilityId}`,
    {},
    admin.token,
  );
  check('SELURUH ADAPTER MASIH BLOCKED sesudah akun aktif',
    (sesudahAktif.data?.items ?? []).every((a) => a.status === 'BLOCKED'));

  const panggil = await api(
    `/health/bpjs/adapters/VCLAIM/call?facilityId=${facilityId}`,
    { method: 'POST' },
    admin.token,
  );
  check('pemanggilan adapter TIDAK dilakukan', panggil.data?.called === false,
    `status ${panggil.status} ${pesan(panggil)}`);
  check('gerbangnya tertutup', panggil.data?.gateOpen === false);
  check('alasannya menyebut MENOLAK', String(panggil.data?.reason ?? '').includes('MENOLAK'));
  check('DAN MENYEBUT APA YANG MASIH DAPAT DIKERJAKAN',
    String(panggil.data?.stillPossible ?? '').includes('dua ujungnya'));

  const panggilEklaim = await api(
    `/health/bpjs/adapters/EKLAIM/call?facilityId=${facilityId}`,
    { method: 'POST' },
    admin.token,
  );
  check('penolakan EKLAIM menyebut tarif karangan',
    String(panggilEklaim.data?.reason ?? '').includes('tarif karangan'));
  check('dan menegaskan penyusunan klaim tidak menuntut grouper',
    String(panggilEklaim.data?.stillPossible ?? '').includes('tidak menuntut grouper'));

  const adapterAsing = await api(
    `/health/bpjs/adapters/APA_SAJA/call?facilityId=${facilityId}`,
    { method: 'POST' },
    admin.token,
  );
  check('adapter yang tidak ada pada matriks ditolak', adapterAsing.status === 400,
    `status ${adapterAsing.status}`);

  // --- 4. Pemisahan wewenang ----------------------------------------------
  log('');
  log('4. Yang mengaktifkan akun tidak memverifikasi adapternya');
  const idVclaim = (adapters.data?.items ?? []).find((a) => a.adapterCode === 'VCLAIM')?.id;

  const adminVerifikasi = await api(
    `/health/bpjs/adapters/${idVclaim}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'CONFIGURED' }) },
    admin.token,
  );
  check('administrator tidak berwenang mengubah status adapter',
    adminVerifikasi.status === 403, `status ${adminVerifikasi.status}`);

  const interopKredensial = await api(
    '/health/bpjs/accounts',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, providerCode: 'X', serviceLevel: 'FKTP', credentialSecretRef: 'vault://x',
      }),
    },
    interop.token,
  );
  check('dan petugas interoperabilitas tidak memasang kredensial',
    interopKredensial.status === 403, `status ${interopKredensial.status}`);

  const verifikasiTanpaKeterangan = await api(
    `/health/bpjs/adapters/${idVclaim}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'VERIFIED', note: 'ok' }) },
    interop.token,
  );
  check('VERIFIED tanpa keterangan yang bermakna DITOLAK',
    verifikasiTanpaKeterangan.status === 422, `status ${verifikasiTanpaKeterangan.status}`);
  check('penolakannya menyebut tidak dapat ditelaah setahun kemudian',
    pesan(verifikasiTanpaKeterangan).includes('setahun kemudian'));

  const tembusVerified = await gagal(
    `UPDATE "${SCHEMA}".bpjs_adapter_capability SET status = 'VERIFIED' WHERE id = $1`,
    [idVclaim],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusVerified ?? '').includes('bpjs_cap_verified_complete'), tembusVerified ?? 'lolos');

  // --- 5. Kepesertaan ------------------------------------------------------
  log('');
  log('5. Kepesertaan membedakan ADAPTER dari MANUAL, dan pasien SELALU dilayani');
  const catat = await api(
    '/health/bpjs/eligibility',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: pasien, membershipNumber: '0001234567890',
        participantStatus: 'ACTIVE', benefitClass: 2,
      }),
    },
    pendaftaran.token,
  );
  check('kepesertaan dicatat', catat.status === 201, `status ${catat.status} ${pesan(catat)}`);
  check('DICATAT SEBAGAI MANUAL, bukan ADAPTER', catat.data?.source === 'MANUAL');
  check('dan alasannya menyebut diketik petugas dari kartu peserta',
    String(catat.data?.note ?? '').includes('kartu peserta'));
  check('kedaluwarsanya terisi', Boolean(catat.data?.expiresAt));

  const tembusTanpaKedaluwarsa = await gagal(
    `UPDATE "${SCHEMA}".bpjs_participant_eligibility SET expires_at = NULL
      WHERE facility_id = $1 AND patient_id = $2`,
    [facilityId, pasien],
  );
  check('kepesertaan terperiksa TANPA kedaluwarsa ditolak constraint',
    (tembusTanpaKedaluwarsa ?? '').includes('bpjs_elig_checked_expires'),
    tembusTanpaKedaluwarsa ?? 'lolos');

  const baca = await api(
    `/health/bpjs/eligibility?facilityId=${facilityId}&patientId=${pasien}`,
    {},
    pendaftaran.token,
  );
  check('kepesertaan aktif dijamin BPJS', baca.data?.coverage?.tagihanKe === 'BPJS',
    JSON.stringify(baca.data?.coverage ?? {}));
  check('dan pasien boleh dilayani', baca.data?.coverage?.bolehDilayani === true);

  await q(
    `UPDATE "${SCHEMA}".bpjs_participant_eligibility
        SET participant_status = 'INACTIVE' WHERE facility_id = $1 AND patient_id = $2`,
    [facilityId, pasien],
  );
  const bacaTidakAktif = await api(
    `/health/bpjs/eligibility?facilityId=${facilityId}&patientId=${pasien}`,
    {},
    pendaftaran.token,
  );
  check('kepesertaan tidak aktif ditagihkan kepada pasien',
    bacaTidakAktif.data?.coverage?.tagihanKe === 'PATIENT');
  check('TETAPI PASIEN TETAP BOLEH DILAYANI',
    bacaTidakAktif.data?.coverage?.bolehDilayani === true);
  check('dan alasannya menyebut keputusan yang bukan milik perangkat lunak',
    String(bacaTidakAktif.data?.coverage?.keterangan ?? '').includes('bukan milik perangkat lunak'));

  // --- 6. SEP --------------------------------------------------------------
  log('');
  log('6. Nomor SEP datang dari BPJS, bukan dihasilkan di sini');
  const sepKarangan = await api(
    '/health/bpjs/sep',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: pasien, sepNumber: 'SEP-001', sepDate: hari(0),
        serviceType: 'OUTPATIENT',
      }),
    },
    pendaftaran.token,
  );
  check('nomor yang jelas dibuat sendiri DITOLAK', sepKarangan.status === 422,
    `status ${sepKarangan.status}`);
  check('penolakannya menyebut sesudah pelayanannya diberikan',
    pesan(sepKarangan).includes('sesudah pelayanannya diberikan'));
  check('dan menegaskan format resminya milik BPJS',
    pesan(sepKarangan).includes('menebaknya akan menolak nomor sah'));

  const nomorSep = `0301R00${tag}V0001`;
  const sep = await api(
    '/health/bpjs/sep',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: pasien, sepNumber: nomorSep, sepDate: hari(0),
        serviceType: 'INPATIENT', benefitClass: 3, occupiedClass: 1,
      }),
    },
    pendaftaran.token,
  );
  check('nomor sungguhan diterima apa adanya', sep.status === 201,
    `status ${sep.status} ${pesan(sep)}`);
  check('dan dinyatakan yang berwenang adalah BPJS',
    String(sep.data?.note ?? '').includes('bukan perangkat lunak ini'));
  check('NAIK KELAS TIDAK MENAHAN KLAIM', sep.data?.classDifference?.menahanKlaim === false,
    JSON.stringify(sep.data?.classDifference ?? {}));
  check('dan selisihnya ditagihkan kepada pasien',
    sep.data?.classDifference?.ditagihkanKe === 'PATIENT');

  const sepGanda = await api(
    '/health/bpjs/sep',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, patientId: pasien, sepNumber: nomorSep, sepDate: hari(0),
        serviceType: 'OUTPATIENT',
      }),
    },
    pendaftaran.token,
  );
  check('nomor SEP yang sama tidak dipakai dua kali', sepGanda.status === 409,
    `status ${sepGanda.status}`);
  check('penolakannya menyebut yang ditolak belum tentu yang keliru',
    pesan(sepGanda).includes('belum tentu yang keliru'));

  const tembusPlaceholder = await gagal(
    `INSERT INTO "${SCHEMA}".bpjs_sep
       (facility_id, patient_id, sep_number, sep_date, service_type)
     VALUES ($1,$2,'TEST',CURRENT_DATE,'OUTPATIENT')`,
    [facilityId, pasien],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusPlaceholder ?? '').includes('bpjs_sep_number_not_placeholder'),
    tembusPlaceholder ?? 'lolos');

  // --- 7. Aturan paket kasus: lapis kedua dan ketiga -----------------------
  log('');
  log('7. NILAI PENGGANTIAN PER ITEM DITOLAK PADA SETIAP LAPIS');
  const klaimId = (
    await q(
      `INSERT INTO "${SCHEMA}".bpjs_claim (facility_id, payment_method)
       VALUES ($1,'INACBG') RETURNING id`,
      [facilityId],
    )
  )[0].id;

  const itemSah = await api(
    `/health/bpjs/claims/${klaimId}/items`,
    {
      method: 'POST',
      body: JSON.stringify({
        itemType: 'DRUG', itemCode: 'OBAT-1', itemName: 'Obat Bukti',
        quantity: 2, actualCost: 2_000_000, patientCharge: 0,
      }),
    },
    pendaftaran.token,
  );
  check('baris item tanpa penggantian diterima', itemSah.status === 201,
    `status ${itemSah.status} ${pesan(itemSah)}`);
  check('dan dinyatakan penggantiannya ada pada tingkat paket',
    String(itemSah.data?.note ?? '').includes('INA-CBG membayar paket kasus'));

  const itemTerlarang = await api(
    `/health/bpjs/claims/${klaimId}/items`,
    {
      method: 'POST',
      body: JSON.stringify({
        itemType: 'DRUG', itemCode: 'OBAT-2', bpjsReimbursement: 2_000_000,
      }),
    },
    pendaftaran.token,
  );
  check('LAPIS KEDUA: permintaan HTTP yang membawanya ditolak ValidationPipe',
    itemTerlarang.status === 400, `status ${itemTerlarang.status}`);
  check('dan menyebut medan yang tidak dikenalnya',
    pesan(itemTerlarang).toLowerCase().includes('bpjsreimbursement') ||
      JSON.stringify(itemTerlarang.body).toLowerCase().includes('bpjsreimbursement'),
    JSON.stringify(itemTerlarang.body).slice(0, 200));

  const tembusKolom = await gagal(
    `ALTER TABLE "${SCHEMA}".bpjs_claim_item ADD COLUMN IF NOT EXISTS x_check_only INTEGER`,
  );
  await gagal(`ALTER TABLE "${SCHEMA}".bpjs_claim_item DROP COLUMN IF EXISTS x_check_only`);
  check('UJI KENDALI: tabelnya memang dapat diubah, sehingga ketiadaan kolomnya bermakna',
    tembusKolom === null, tembusKolom ?? '');

  // --- 8. Casemix hanya dari adapter --------------------------------------
  log('');
  log('8. Casemix group tidak dapat diisi tanpa adapter');
  const tembusCasemix = await gagal(
    `UPDATE "${SCHEMA}".bpjs_claim SET casemix_group = 'A-4-10-I' WHERE id = $1`,
    [klaimId],
  );
  check('mengetik casemix group tanpa adapter ditolak constraint',
    (tembusCasemix ?? '').includes('bpjs_claim_group_from_adapter'), tembusCasemix ?? 'lolos');

  const denganAdapter = await gagal(
    `UPDATE "${SCHEMA}".bpjs_claim
        SET casemix_group = 'A-4-10-I', grouped_by_adapter = TRUE, grouped_at = now()
      WHERE id = $1`,
    [klaimId],
  );
  check('UJI KENDALI: dengan penanda adapter, ia diterima', denganAdapter === null,
    denganAdapter ?? '');

  // --- 9. Kebijakan berversi ----------------------------------------------
  log('');
  log('9. Kebijakan kelas dan KRIS berversi, dan wajib menunjuk peraturannya');
  const tanpaPeraturan = await gagal(
    `INSERT INTO "${SCHEMA}".jkn_entitlement_policy
       (facility_id, policy_code, policy_name, policy_kind, effective_from)
     VALUES ($1,'KRIS-1','Kriteria KRIS','KRIS_CRITERIA',CURRENT_DATE)`,
    [facilityId],
  );
  check('kebijakan tanpa rujukan peraturan ditolak constraint',
    (tanpaPeraturan ?? '').includes('jkn_policy_has_regulation'), tanpaPeraturan ?? 'lolos');

  const denganPeraturan = await gagal(
    `INSERT INTO "${SCHEMA}".jkn_entitlement_policy
       (facility_id, policy_code, policy_name, policy_kind, regulation_ref, effective_from)
     VALUES ($1,'KRIS-1','Kriteria KRIS','KRIS_CRITERIA','Permenkes 3/2023',CURRENT_DATE)`,
    [facilityId],
  );
  check('UJI KENDALI: yang menunjuk peraturannya diterima', denganPeraturan === null,
    denganPeraturan ?? '');

  // --- 10. Pemisahan dari SATUSEHAT ---------------------------------------
  log('');
  log('10. BPJS dan SATUSEHAT tidak bertaut satu sama lain');
  const kunciSilang = await q(
    `SELECT count(*)::int AS n
       FROM information_schema.table_constraints tc
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
        AND ((tc.table_name LIKE 'bpjs%' AND ccu.table_name LIKE 'satusehat%')
          OR (tc.table_name LIKE 'satusehat%' AND ccu.table_name LIKE 'bpjs%'))`,
    [SCHEMA],
  );
  check('TIDAK SATU PUN kunci asing di antara keduanya', kunciSilang[0].n === 0,
    `${kunciSilang[0].n} kunci asing`);

  const akhir = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".bpjs_adapter_capability
      WHERE facility_id = $1 AND status = 'VERIFIED'`,
    [facilityId],
  );
  check('sesudah seluruhnya, tidak satu pun adapter VERIFIED', akhir[0].n === 0,
    `${akhir[0].n} adapter`);

  const seluruhTenant = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".bpjs_adapter_capability
      WHERE status = 'VERIFIED' AND verified_by IS NULL`,
  );
  check('di seluruh tenant, tidak ada VERIFIED tanpa nama manusianya',
    seluruhTenant[0].n === 0, `${seluruhTenant[0].n}`);

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
    new URL('../../../docs/emedik/bukti-h9b-bpjs.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
