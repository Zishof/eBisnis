/**
 * Bukti H-9L: katalog layanan, pemetaan unit, sumber master data, dan pemetaan
 * kode lokal.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan, melainkan bahwa yang seharusnya
 * DITOLAK memang ditolak:
 *
 * - mengaktifkan layanan yang pemetaannya belum lengkap;
 * - menembusnya lewat UPDATE langsung ke tabel;
 * - petugas katalog mengaktifkan layanannya sendiri;
 * - baris contoh mengaku bersumber resmi;
 * - rujukan resmi tanpa nomor terbitan;
 * - satu kode lokal menunjuk dua kode resmi pada sistem yang sama;
 * - menyembunyikan data contoh yang sudah dipakai data nyata.
 *
 * Dan tiga hal yang harus TETAP berjalan: pemetaan yang belum lengkap tetap
 * dapat disimpan, kekurangannya dilaporkan satu per satu beserta fase yang
 * menunggunya, dan penyemaian dengan benih yang sama menghasilkan katalog yang
 * sama persis.
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
 * yang bekerja.
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

const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_md_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9L',FALSE) RETURNING id`,
      [`BUKTI_MD_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9L — KATALOG LAYANAN, PEMETAAN UNIT, DAN SUMBER MASTER DATA');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const BACA = ['READ'];
  const katalog = await buatPengguna(tenantId, 'katalog', {
    HEALTH: BACA,
    HEALTH_SERVICE_CATALOG: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_CODE_MAPPING: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_MASTER_DATA: BACA,
  });
  const admin = await buatPengguna(tenantId, 'admin', {
    HEALTH: BACA,
    HEALTH_SERVICE_CATALOG: ['READ', 'ACTIVATE'],
    HEALTH_MASTER_DATA: ['READ', 'CREATE', 'IMPORT', 'DELETE'],
    HEALTH_CODE_MAPPING: BACA,
  });

  log('');
  log('Dua pengguna. Petugas katalog TIDAK diberi ACTIVATE, administrator TIDAK');
  log('diberi CREATE maupun UPDATE atas katalognya — justru pemisahan itulah yang');
  log('hendak dibuktikan naskah ini.');

  // --- Persiapan -----------------------------------------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti Master Data','HOSPITAL') RETURNING id`,
      [`BKMD-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Master Data','Asia/Jakarta') RETURNING id`,
      [typeId, `MD-${tag}`],
    )
  )[0].id;
  const unitId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service_unit (facility_id, unit_type, code, name)
       VALUES ($1,'LABORATORY',$2,'Laboratorium Bukti') RETURNING id`,
      [facilityId, `LABMD-${tag}`],
    )
  )[0].id;
  const deptId = (
    await q(
      `INSERT INTO "${SCHEMA}".department (code, name) VALUES ($1,'Penunjang Medis') RETURNING id`,
      [`DEPMD-${tag}`],
    )
  )[0].id;

  // --- 1. Sumber master data -----------------------------------------------
  log('');
  log('1. Harga dan kode sintetis tidak dapat menyamar sebagai yang resmi');
  const contohMengakuResmi = await api(
    '/health/master-data/services',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `PALSU-${tag.toUpperCase()}`, name: 'Layanan Contoh Berlagak Resmi',
        serviceType: 'CONSULTATION', careSetting: 'OUTPATIENT',
        source: 'SYNTHETIC_DEMO', issuer: 'BPJS',
      }),
    },
    katalog.token,
  );
  check('baris contoh yang mengaku bersumber BPJS DITOLAK', contohMengakuResmi.status === 422,
    `status ${contohMengakuResmi.status}`);
  check('penolakannya menyebut akibatnya: dipakai menagih pasien',
    pesan(contohMengakuResmi).includes('menagih'));

  const resmiTanpaTerbitan = await api(
    '/health/master-data/services',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `TAKTELUSUR-${tag.toUpperCase()}`, name: 'Rujukan Tak Tertelusur',
        serviceType: 'CONSULTATION', careSetting: 'OUTPATIENT',
        source: 'OFFICIAL_REFERENCE', issuer: 'KFA',
      }),
    },
    katalog.token,
  );
  check('rujukan resmi tanpa nomor terbitan DITOLAK', resmiTanpaTerbitan.status === 422,
    `status ${resmiTanpaTerbitan.status}`);
  check('penolakannya menyebut bahwa ia tak dapat dibedakan dari karangan',
    pesan(resmiTanpaTerbitan).includes('karangan'));

  const tembusSumber = await gagal(
    `INSERT INTO "${SCHEMA}".health_service
       (facility_id, code, name, service_type, care_setting, source, issuer)
     VALUES ($1,$2,'Tembus Lewat SQL','CONSULTATION','OUTPATIENT','SYNTHETIC_DEMO','BPJS')`,
    [facilityId, `TEMBUS-${tag.toUpperCase()}`],
  );
  check('menembusnya lewat basis data pun ditolak constraint',
    (tembusSumber ?? '').includes('health_service_issuer_only_official'), tembusSumber ?? 'lolos');

  // --- 2. Katalog dan pemetaan ---------------------------------------------
  log('');
  log('2. Kekurangan pemetaan dilaporkan SATU PER SATU, beserta fase yang menunggunya');
  const layanan = await api(
    '/health/master-data/services',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `LAB-DL-${tag.toUpperCase()}`, name: 'Darah Lengkap',
        serviceType: 'LABORATORY', careSetting: 'LABORATORY', usesInventory: true,
      }),
    },
    katalog.token,
  );
  check('layanan dibuat', layanan.status === 201, `status ${layanan.status} ${pesan(layanan)}`);
  check('dan dibuat dalam keadaan TIDAK aktif', layanan.data?.isActive === false);

  const serviceId = layanan.data?.id;

  const petaKosong = await api(
    `/health/master-data/services/${serviceId}/mapping`,
    { method: 'POST', body: JSON.stringify({}) },
    katalog.token,
  );
  check('pemetaan yang belum lengkap TETAP dapat disimpan',
    petaKosong.status === 200 || petaKosong.status === 201,
    `status ${petaKosong.status} ${pesan(petaKosong)}`);

  const kurang = petaKosong.data?.missing ?? [];
  check('kekurangannya disebut satu per satu', kurang.length >= 8, `${kurang.length} kekurangan`);
  check('unit layanan yang kosong menyebut akibatnya',
    kurang.find((m) => m.slot === 'serviceUnitId')?.message.includes('tidak akan sampai ke mana pun'));
  check('pemeriksaan laboratorium menuntut SPESIMEN tanpa ditanya',
    kurang.some((m) => m.slot === 'specimenTypeId'));
  check('dan menuntut peran VERIFIKATOR', kurang.some((m) => m.slot === 'verifierRole'));
  check('dan menuntut akun HPP karena memakai persediaan',
    kurang.find((m) => m.slot === 'cogsAccountId')?.message.includes('seratus persen'));
  check('slot yang tabelnya belum ada menyebut fasenya',
    kurang.find((m) => m.slot === 'tariffId')?.awaitingPhase === 'H-9D');
  check('akun pendapatan menunggu H-9N',
    kurang.find((m) => m.slot === 'revenueAccountId')?.awaitingPhase === 'H-9N');
  check('departemen TIDAK menunggu fase mana pun',
    kurang.find((m) => m.slot === 'departmentId')?.awaitingPhase === undefined ||
      kurang.find((m) => m.slot === 'departmentId')?.awaitingPhase === null);

  const barisKekurangan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service_mapping_gap g
       JOIN "${SCHEMA}".health_service_mapping m ON m.id = g.mapping_id
      WHERE m.service_id = $1 AND g.resolved_at IS NULL`,
    [serviceId],
  );
  check('kekurangan disimpan sebagai BARIS, bukan sebagai angka', barisKekurangan[0].n === kurang.length,
    `${barisKekurangan[0].n} baris vs ${kurang.length} dilaporkan`);

  // --- 3. Aktivasi ---------------------------------------------------------
  log('');
  log('3. Layanan tidak dapat diaktifkan sebelum pemetaannya lengkap');
  const aktifTerlaluCepat = await api(
    `/health/master-data/services/${serviceId}/activate`,
    { method: 'POST' },
    admin.token,
  );
  check('aktivasi DITOLAK', aktifTerlaluCepat.status === 422, `status ${aktifTerlaluCepat.status}`);
  check('penolakannya memisahkan yang menunggu fase berikutnya',
    pesan(aktifTerlaluCepat).includes('tabelnya memang belum ada'));

  const tembusAktivasi = await gagal(
    `UPDATE "${SCHEMA}".health_service
        SET is_active = TRUE, activated_at = now(), activated_by = $2 WHERE id = $1`,
    [serviceId, admin.subjectId],
  );
  check('menembus aktivasi lewat basis data pun ditolak trigger',
    (tembusAktivasi ?? '').includes('SERVICE_MAPPING_INCOMPLETE'), tembusAktivasi ?? 'lolos');

  const belumDipetakanSamaSekali = (
    await q(
      `INSERT INTO "${SCHEMA}".health_service
         (facility_id, code, name, service_type, care_setting)
       VALUES ($1,$2,'Belum Dipetakan','CONSULTATION','OUTPATIENT') RETURNING id`,
      [facilityId, `NOMAP-${tag.toUpperCase()}`],
    )
  )[0].id;
  const tembusTanpaPemetaan = await gagal(
    `UPDATE "${SCHEMA}".health_service
        SET is_active = TRUE, activated_at = now(), activated_by = $2 WHERE id = $1`,
    [belumDipetakanSamaSekali, admin.subjectId],
  );
  check('layanan yang belum dipetakan sama sekali pun ditolak trigger',
    (tembusTanpaPemetaan ?? '').includes('belum dipetakan sama sekali'),
    tembusTanpaPemetaan ?? 'lolos');

  // --- 4. Melengkapi pemetaan ----------------------------------------------
  log('');
  log('4. Setelah dilengkapi, kekurangannya ditutup — bukan menggantung');
  const lengkap = await api(
    `/health/master-data/services/${serviceId}/mapping`,
    {
      method: 'POST',
      body: JSON.stringify({
        departmentId: deptId,
        serviceUnitId: unitId,
        performerRole: 'HEALTH_LAB_ANALYST',
        verifierRole: 'HEALTH_LAB_SUPERVISOR',
        specimenTypeId: 'WHOLE_BLOOD',
        clinicalOrderType: 'LAB',
        equipmentId: randomUUID(),
        tariffId: randomUUID(),
        revenueAccountId: randomUUID(),
        cogsAccountId: randomUUID(),
      }),
    },
    katalog.token,
  );
  check('pemetaan lengkap disimpan', lengkap.data?.blockingCount === 0,
    JSON.stringify((lengkap.data?.missing ?? []).map((m) => m.slot)));
  check('lokasi yang masih kosong dilaporkan tetapi TIDAK menahan',
    (lengkap.data?.missing ?? []).every((m) => m.blocksActivation === false));

  const gapTertutup = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service_mapping_gap g
       JOIN "${SCHEMA}".health_service_mapping m ON m.id = g.mapping_id
      WHERE m.service_id = $1 AND g.resolved_at IS NOT NULL`,
    [serviceId],
  );
  check('kekurangan lama ditutup dengan waktunya, bukan dihapus', gapTertutup[0].n >= 6,
    `${gapTertutup[0].n} baris ditutup`);

  // --- 5. Pemisahan wewenang -----------------------------------------------
  log('');
  log('5. Yang memetakan bukan yang mengaktifkan');
  const katalogMengaktifkan = await api(
    `/health/master-data/services/${serviceId}/activate`,
    { method: 'POST' },
    katalog.token,
  );
  check('petugas katalog tidak berwenang mengaktifkan', katalogMengaktifkan.status === 403,
    `status ${katalogMengaktifkan.status}`);

  const adminMemetakan = await api(
    `/health/master-data/services/${serviceId}/mapping`,
    { method: 'POST', body: JSON.stringify({ departmentId: deptId }) },
    admin.token,
  );
  check('dan administrator tidak berwenang memetakan', adminMemetakan.status === 403,
    `status ${adminMemetakan.status}`);

  const aktif = await api(
    `/health/master-data/services/${serviceId}/activate`,
    { method: 'POST' },
    admin.token,
  );
  check('administrator mengaktifkannya', aktif.status === 200 || aktif.status === 201,
    `status ${aktif.status} ${pesan(aktif)}`);
  check('dan layanannya kini aktif', aktif.data?.isActive === true);

  const nonaktifTanpaAlasan = await api(
    `/health/master-data/services/${serviceId}/deactivate`,
    { method: 'POST', body: JSON.stringify({ reason: 'x' }) },
    admin.token,
  );
  check('penonaktifan tanpa alasan yang bermakna ditolak',
    nonaktifTanpaAlasan.status === 400 || nonaktifTanpaAlasan.status === 422,
    `status ${nonaktifTanpaAlasan.status}`);

  // --- 6. Pemetaan kode lokal ----------------------------------------------
  log('');
  log('6. Satu kode lokal tidak menunjuk dua kode resmi pada sistem yang sama');
  const kodePertama = await api(
    '/health/master-data/code-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        localSystem: `LOCAL_LAB_${tag}`, localCode: 'DL',
        targetSystem: 'LOINC', targetCode: '58410-2', targetDisplay: 'CBC panel',
      }),
    },
    katalog.token,
  );
  check('pemetaan pertama diterima', kodePertama.status === 201,
    `status ${kodePertama.status} ${pesan(kodePertama)}`);

  const kodeBentrok = await api(
    '/health/master-data/code-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        localSystem: `LOCAL_LAB_${tag}`, localCode: 'DL',
        targetSystem: 'LOINC', targetCode: '99999-9',
      }),
    },
    katalog.token,
  );
  check('pemetaan kedua ke kode LOINC yang berbeda DITOLAK', kodeBentrok.status === 422,
    `status ${kodeBentrok.status}`);
  check('penolakannya menyebut kode yang sudah terpasang',
    pesan(kodeBentrok).includes('58410-2'));

  const kodeSistemLain = await api(
    '/health/master-data/code-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        localSystem: `LOCAL_LAB_${tag}`, localCode: 'DL',
        targetSystem: 'SNOMED', targetCode: '26604007', confidence: 'APPROXIMATE',
      }),
    },
    katalog.token,
  );
  check('sistem tujuan yang berbeda boleh berdampingan', kodeSistemLain.status === 201,
    `status ${kodeSistemLain.status} ${pesan(kodeSistemLain)}`);

  const tembusDuaKode = await gagal(
    `INSERT INTO "${SCHEMA}".local_code_mapping
       (local_system, local_code, target_system, target_code)
     VALUES ($1,'DL','LOINC','77777-7')`,
    [`LOCAL_LAB_${tag}`],
  );
  check('menembusnya lewat basis data pun ditolak indeks unik parsial',
    (tembusDuaKode ?? '').includes('ux_local_code_mapping_active'), tembusDuaKode ?? 'lolos');

  const pensiun = await api(
    `/health/master-data/code-mappings/${kodePertama.data?.id}/retire`,
    { method: 'POST', body: JSON.stringify({ reason: 'Terbitan LOINC baru mengganti kodenya.' }) },
    katalog.token,
  );
  check('pemetaan dipensiunkan, bukan dihapus', pensiun.status === 200 || pensiun.status === 201,
    `status ${pensiun.status} ${pesan(pensiun)}`);

  const masihAda = await q(
    `SELECT retired_at IS NOT NULL AS pensiun FROM "${SCHEMA}".local_code_mapping WHERE id = $1`,
    [kodePertama.data?.id],
  );
  check('barisnya masih ada dan bertanda pensiun', masihAda[0]?.pensiun === true);

  const kodeBaru = await api(
    '/health/master-data/code-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        localSystem: `LOCAL_LAB_${tag}`, localCode: 'DL',
        targetSystem: 'LOINC', targetCode: '99999-9',
      }),
    },
    katalog.token,
  );
  check('setelah dipensiunkan, pemetaan baru diterima', kodeBaru.status === 201,
    `status ${kodeBaru.status} ${pesan(kodeBaru)}`);

  // --- 7. Data contoh -------------------------------------------------------
  log('');
  log('7. Penyemaian contoh deterministik, dan tandanya tidak dapat dilepas');
  const semai1 = await api(
    '/health/master-data/samples/services',
    { method: 'POST', body: JSON.stringify({ facilityId, count: 30, seed: `benih-${tag}` }) },
    admin.token,
  );
  check('penyemaian berjalan', semai1.status === 201, `status ${semai1.status} ${pesan(semai1)}`);
  check('30 layanan contoh dibuat', semai1.data?.created === 30, `${semai1.data?.created}`);
  check('dan seluruhnya bertanda contoh', semai1.data?.source === 'SYNTHETIC_DEMO');
  check('catatannya menyatakan tidak boleh dipakai menagih',
    String(semai1.data?.note ?? '').includes('menagih'));

  const bukanResmi = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service
      WHERE sample_batch_id = $1 AND (source <> 'SYNTHETIC_DEMO' OR issuer IS NOT NULL)`,
    [semai1.data?.batchId],
  );
  check('tidak satu pun baris contoh yang mengaku resmi', bukanResmi[0].n === 0);

  const contohAktif = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service
      WHERE sample_batch_id = $1 AND is_active = TRUE`,
    [semai1.data?.batchId],
  );
  check('dan tidak satu pun langsung aktif', contohAktif[0].n === 0);

  const fasilitasKedua = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Kedua','Asia/Jakarta') RETURNING id`,
      [typeId, `MD2-${tag}`],
    )
  )[0].id;
  const semai2 = await api(
    '/health/master-data/samples/services',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId: fasilitasKedua, count: 30, seed: `benih-${tag}` }),
    },
    admin.token,
  );
  check('penyemaian kedua dengan benih yang SAMA berjalan', semai2.status === 201,
    `status ${semai2.status} ${pesan(semai2)}`);

  const bandingkan = await q(
    `SELECT count(*)::int AS beda
       FROM "${SCHEMA}".health_service a
      WHERE a.sample_batch_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM "${SCHEMA}".health_service b
           WHERE b.sample_batch_id = $2
             AND b.code = a.code AND b.name = a.name
             AND b.service_type = a.service_type
             AND b.care_setting = a.care_setting
             AND b.uses_inventory = a.uses_inventory
             AND b.description = a.description
        )`,
    [semai1.data?.batchId, semai2.data?.batchId],
  );
  check('benih yang sama menghasilkan katalog yang sama PERSIS', bandingkan[0].beda === 0,
    `${bandingkan[0].beda} baris berbeda`);

  const semaiUlang = await api(
    '/health/master-data/samples/services',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId: fasilitasKedua, count: 30, seed: `benih-${tag}` }),
    },
    admin.token,
  );
  check('menyemai ulang fasilitas yang sama dengan benih yang sama DITOLAK',
    semaiUlang.status === 409, `status ${semaiUlang.status}`);
  check('penolakannya menjelaskan bahwa hasilnya akan sama persis',
    pesan(semaiUlang).includes('sama persis'), pesan(semaiUlang));

  const fasilitasKetiga = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti Ketiga','Asia/Jakarta') RETURNING id`,
      [typeId, `MD3-${tag}`],
    )
  )[0].id;
  const semai3 = await api(
    '/health/master-data/samples/services',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId: fasilitasKetiga, count: 30, seed: `lain-${tag}` }),
    },
    admin.token,
  );
  check('penyemaian dengan benih berbeda berjalan', semai3.data?.created === 30,
    `${semai3.data?.created} baris`);
  const beda = await q(
    `SELECT count(*)::int AS sama
       FROM "${SCHEMA}".health_service a
       JOIN "${SCHEMA}".health_service b
         ON b.sample_batch_id = $2 AND b.code = a.code AND b.name = a.name
      WHERE a.sample_batch_id = $1`,
    [semai1.data?.batchId, semai3.data?.batchId],
  );
  check('benih yang berbeda menghasilkan katalog yang berbeda', beda[0].sama < 30,
    `${beda[0].sama} dari 30 sama`);

  // --- 8. Penghapusan data contoh ------------------------------------------
  log('');
  log('8. Data contoh yang sudah dipakai data nyata tidak dapat disembunyikan');
  const sembunyiBersih = await api(
    `/health/master-data/samples/${semai3.data?.batchId}/hide`,
    { method: 'POST', body: JSON.stringify({ reason: 'Katalog percobaan tidak dipakai.' }) },
    admin.token,
  );
  check('kumpulan yang belum dipakai boleh disembunyikan',
    sembunyiBersih.status === 200 || sembunyiBersih.status === 201,
    `status ${sembunyiBersih.status} ${pesan(sembunyiBersih)}`);

  const masihUtuh = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_service WHERE sample_batch_id = $1`,
    [semai3.data?.batchId],
  );
  check('barisnya TIDAK dihapus, hanya disembunyikan', masihUtuh[0].n > 0,
    `${masihUtuh[0].n} baris`);

  // Kunjungan NYATA pada fasilitas yang memuat kumpulan pertama.
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Budi Bukti Master Data','1990-03-03','MALE') RETURNING id`,
      [`EPI-MD-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;
  await q(
    `INSERT INTO "${SCHEMA}".health_encounter
       (patient_id, facility_id, encounter_number, encounter_type)
     VALUES ($1,$2,$3,'OUTPATIENT')`,
    [pasien, facilityId, `ENCMD-${tag}`],
  );

  const sembunyiTerpakai = await api(
    `/health/master-data/samples/${semai1.data?.batchId}/hide`,
    { method: 'POST', body: JSON.stringify({ reason: 'Ingin dibersihkan.' }) },
    admin.token,
  );
  check('kumpulan yang sudah dipakai data nyata DITOLAK', sembunyiTerpakai.status === 409,
    `status ${sembunyiTerpakai.status}`);
  check('penolakannya menyebut apa yang merujuknya',
    pesan(sembunyiTerpakai).includes('kunjungan'));
  check('dan menyerahkan keputusannya kepada manusia',
    pesan(sembunyiTerpakai).includes('jangan dihapus diam-diam'));

  // --- 9. Papan kekurangan --------------------------------------------------
  log('');
  log('9. Papan kekurangan katalog dikelompokkan menurut slotnya');

  // Satu layanan kedua yang sengaja dibiarkan setengah terpetakan, supaya papan
  // memuat kekurangan yang menahan DAN yang tidak menahan sekaligus. Papan yang
  // hanya memuat satu macam tidak membuktikan urutannya.
  const layananKedua = await api(
    '/health/master-data/services',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, code: `RAD-TX-${tag.toUpperCase()}`, name: 'Rontgen Toraks',
        serviceType: 'RADIOLOGY', careSetting: 'RADIOLOGY',
      }),
    },
    katalog.token,
  );
  const petaKedua = await api(
    `/health/master-data/services/${layananKedua.data?.id}/mapping`,
    {
      method: 'POST',
      body: JSON.stringify({
        departmentId: deptId, serviceUnitId: unitId,
        performerRole: 'HEALTH_RADIOGRAPHER', clinicalOrderType: 'RAD',
      }),
    },
    katalog.token,
  );
  check('layanan kedua dipetakan setengah jalan', (petaKedua.data?.blockingCount ?? 0) > 0,
    `status ${petaKedua.status} ${pesan(petaKedua)}`);

  const papan = await api(
    `/health/master-data/gaps?facilityId=${facilityId}`,
    {},
    katalog.token,
  );
  check('papan kekurangan terbaca', papan.status === 200, `status ${papan.status}`);
  check('dan mengelompokkan menurut slot, bukan menurut layanan',
    (papan.data ?? []).length > 0 && (papan.data ?? [])[0]?.service_count >= 1,
    JSON.stringify((papan.data ?? []).slice(0, 3).map((r) => `${r.slot}:${r.service_count}`)));
  check('yang menahan aktivasi berada di atas',
    (papan.data ?? [])[0]?.blocks_activation === true,
    JSON.stringify((papan.data ?? []).map((r) => `${r.slot}:${r.blocks_activation}`)));
  check('dan yang tidak menahan tetap dilaporkan, bukan disembunyikan',
    (papan.data ?? []).some((r) => r.blocks_activation === false));

  const daftar = await api(
    `/health/master-data/services?facilityId=${facilityId}&activeOnly=true`,
    {},
    katalog.token,
  );
  check('katalog aktif hanya memuat yang benar-benar aktif',
    (daftar.data ?? []).every((s) => s.is_active === true) && (daftar.data ?? []).length >= 1,
    `${(daftar.data ?? []).length} layanan`);

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
    new URL('../../../docs/emedik/bukti-h9l-master-data.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
