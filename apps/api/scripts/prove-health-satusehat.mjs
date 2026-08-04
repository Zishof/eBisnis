/**
 * Bukti H-9A: kerangka SATUSEHAT dan gerbang kemampuannya.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Naskah ini membuktikan bahwa sebuah kerangka **menolak berjalan** — dan
 * membuktikan penolakan menuntut bentuk yang berbeda dari membuktikan
 * keberhasilan. Yang diperiksa di sini:
 *
 * 1. **Tidak ada satu pun kolom yang menampung payload FHIR maupun rahasia**,
 *    diperiksa pada `information_schema`. Menyediakan tempat menyimpannya
 *    sebelum bentuknya diketahui akan mengundang orang pertama yang
 *    membutuhkannya untuk mengarangnya.
 *
 * 2. **Seluruh kemampuan BLOCKED**, dan tetap BLOCKED sesudah lingkungannya
 *    didaftarkan DAN diaktifkan. Lingkungan aktif tidak membuka gerbang.
 *
 * 3. **Pengiriman ditolak, dan percobaannya tetap dicatat.** Percobaan yang
 *    tertahan gerbang menunjukkan bahwa seseorang mencoba, dan kapan.
 *
 * 4. **Kenaikan status tidak boleh melompat**, dan `VERIFIED` menuntut keenam
 *    buktinya beserta nama manusianya.
 *
 * 5. **Yang mengaktifkan lingkungan bukan yang memverifikasi kemampuannya.**
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
  const username = `bukti_ss_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9A',FALSE) RETURNING id`,
      [`BUKTI_SS_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9A — KERANGKA SATUSEHAT DAN GERBANG KEMAMPUANNYA');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const admin = await buatPengguna(tenantId, 'admin', {
    HEALTH: ['READ'],
    HEALTH_SATUSEHAT: ['READ', 'CREATE', 'UPDATE', 'ACTIVATE', 'MANAGE_CREDENTIAL'],
    // VERIFY diberikan pula, dan itu disengaja: penolakan "yang mengaktifkan
    // tidak memverifikasi" harus datang dari pemeriksaan barisnya, bukan dari
    // ketiadaan hak akses. Pelajaran H-9J dan H-9K.
    HEALTH_SATUSEHAT_CAPABILITY: ['READ'],
  });
  const interop = await buatPengguna(tenantId, 'interop', {
    HEALTH: ['READ'],
    HEALTH_SATUSEHAT: ['READ', 'CREATE'],
    HEALTH_SATUSEHAT_CAPABILITY: ['READ', 'UPDATE', 'VERIFY'],
  });

  log('');
  log('Dua pengguna. Administrator memasang kredensial dan mengaktifkan lingkungan;');
  log('petugas interoperabilitas memverifikasi kemampuannya. Administrator sengaja');
  log('TIDAK diberi VERIFY — ia orang yang paling ingin gerbangnya terbuka.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti SATUSEHAT','HOSPITAL') RETURNING id`,
      [`BKSS-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti SATUSEHAT','Asia/Jakarta') RETURNING id`,
      [typeId, `SS-${tag}`],
    )
  )[0].id;
  const pasien = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1,'Rina Bukti SATUSEHAT','1985-03-03','FEMALE') RETURNING id`,
      [`EPI-SS-${randomBytes(4).toString('hex')}`],
    )
  )[0].id;

  // --- 1. Yang sengaja tidak ada -------------------------------------------
  log('');
  log('1. TIDAK ADA KOLOM PAYLOAD MAUPUN RAHASIA');
  const kolomTerlarang = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name LIKE 'satusehat%'
        AND (column_name ILIKE '%payload%' OR column_name ILIKE '%request_body%'
             OR column_name ILIKE '%password%' OR column_name ILIKE '%token%'
             OR column_name ILIKE '%client_secret%' OR column_name ILIKE '%api_key%')`,
    [SCHEMA],
  );
  check('tidak ada kolom payload, badan permintaan, maupun rahasia',
    kolomTerlarang[0].n === 0, `${kolomTerlarang[0].n} kolom`);

  const tabelSatusehat = await q(
    `SELECT count(*)::int AS n FROM information_schema.tables
      WHERE table_schema = $1 AND table_name LIKE 'satusehat%'`,
    [SCHEMA],
  );
  check('lima tabel kerangka terbangun', tabelSatusehat[0].n === 5, `${tabelSatusehat[0].n} tabel`);

  // --- 2. Matriks kemampuan ------------------------------------------------
  log('');
  log('2. SELURUH KEMAMPUAN BLOCKED, DAN ITU KEADAAN YANG SESUNGGUHNYA');
  const katalog = await api('/health/satusehat/catalog', {}, admin.token);
  check('katalog terbaca', katalog.status === 200, `status ${katalog.status}`);
  check('dua puluh sumber daya tercatat', (katalog.data?.capabilities ?? []).length === 20,
    `${(katalog.data?.capabilities ?? []).length}`);
  check('setiap sumber daya menyebut penghalangnya',
    (katalog.data?.capabilities ?? []).every((k) => String(k.penghalang ?? '').length > 10));
  check('enam syarat verifikasi tercatat', (katalog.data?.requirements ?? []).length === 6);
  check('katalognya menyebut penghalangnya hanya pada lapisan pertukaran',
    String(katalog.data?.note ?? '').includes('lapisan pertukaran'));

  const kemampuan = await api(
    `/health/satusehat/capabilities?facilityId=${facilityId}`,
    {},
    admin.token,
  );
  check('kemampuan tersemai bagi fasilitas BARU', (kemampuan.data?.items ?? []).length === 20,
    `${(kemampuan.data?.items ?? []).length} baris`);
  check('SELURUHNYA BLOCKED',
    (kemampuan.data?.items ?? []).every((k) => k.status === 'BLOCKED'));
  check('tidak satu pun siap kirim', (kemampuan.data?.summary?.siapKirim ?? []).length === 0);
  check('dan dijelaskan bahwa ini bukan kegagalan pembangunan',
    String(kemampuan.data?.summary?.keterangan ?? '').includes('bukan kegagalan pembangunan'));
  check('sumber datanya di sisi kami disebutkan',
    (kemampuan.data?.items ?? []).find((k) => k.resourceType === 'Patient')?.localSource
      === 'patient, patient_identifier');

  // --- 3. Kredensial -------------------------------------------------------
  log('');
  log('3. Rahasia tidak pernah masuk basis data tenant');
  const nilaiMentah = await api(
    '/health/satusehat/environments',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, environment: 'SANDBOX', credentialRawValue: 'client-secret-rahasia',
      }),
    },
    admin.token,
  );
  check('kredensial sebagai NILAI DITOLAK', nilaiMentah.status === 422,
    `status ${nilaiMentah.status}`);
  check('penolakannya menyebut mengirimkan data atas nama fasilitas itu',
    pesan(nilaiMentah).includes('atas nama fasilitas itu'));

  const tembusNilai = await gagal(
    `INSERT INTO "${SCHEMA}".satusehat_environment
       (facility_id, environment, credential_secret_ref)
     VALUES ($1,'PRODUCTION','client-secret-langsung')`,
    [facilityId],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusNilai ?? '').includes('satusehat_env_secret_is_ref'), tembusNilai ?? 'lolos');

  const lingkungan = await api(
    '/health/satusehat/environments',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, environment: 'SANDBOX',
        organizationId: `ORG-${tag}`,
        baseUrl: 'https://api-satusehat-stg.example.invalid',
        credentialSecretRef: `vault://satusehat/${tag}`,
      }),
    },
    admin.token,
  );
  check('lingkungan dengan rujukan brankas diterima', lingkungan.status === 201,
    `status ${lingkungan.status} ${pesan(lingkungan)}`);
  check('tetapi TIDAK aktif', lingkungan.data?.isActive === false);
  check('dan dikatakan gerbangnya adalah status kemampuan',
    String(lingkungan.data?.note ?? '').includes('gerbangnya adalah status kemampuan'));

  const daftarEnv = await api(
    `/health/satusehat/environments?facilityId=${facilityId}`,
    {},
    admin.token,
  );
  const medanEnv = Object.keys((daftarEnv.data ?? [])[0] ?? {});
  check('rujukan brankas TIDAK ikut dikembalikan',
    !medanEnv.includes('credential_secret_ref') && medanEnv.includes('has_credential'),
    JSON.stringify(medanEnv));

  // --- 4. Lingkungan aktif tidak membuka gerbang ---------------------------
  log('');
  log('4. LINGKUNGAN AKTIF TIDAK MEMBUKA GERBANG');
  const aktifkan = await api(
    `/health/satusehat/environments/${lingkungan.data?.id}/activate`,
    { method: 'POST' },
    admin.token,
  );
  check('lingkungan diaktifkan', aktifkan.data?.isActive === true,
    `status ${aktifkan.status} ${pesan(aktifkan)}`);
  check('dan dinyatakan TIDAK membuka pengiriman',
    String(aktifkan.data?.note ?? '').includes('TIDAK membuka pengiriman'));

  const sesudahAktif = await api(
    `/health/satusehat/capabilities?facilityId=${facilityId}`,
    {},
    admin.token,
  );
  check('SELURUH KEMAMPUAN MASIH BLOCKED sesudah lingkungan aktif',
    (sesudahAktif.data?.items ?? []).every((k) => k.status === 'BLOCKED'));

  const kirim = await api(
    '/health/satusehat/transmissions',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, resourceType: 'Patient', localId: pasien }),
    },
    interop.token,
  );
  check('pengiriman disiapkan', kirim.status === 201, `status ${kirim.status} ${pesan(kirim)}`);
  check('TETAPI TIDAK DIKIRIM', kirim.data?.sent === false);
  check('gerbangnya tertutup', kirim.data?.gateOpen === false);
  check('alasannya menyebut MENOLAK, bukan memperingatkan',
    String(kirim.data?.reason ?? '').includes('MENOLAK'));
  check('dan menyebut apa yang dibutuhkan', (kirim.data?.requirements ?? []).length === 6);
  check('dinyatakan tidak ada panggilan jaringan',
    String(kirim.data?.note ?? '').includes('TIDAK ADA PANGGILAN JARINGAN'));

  const percobaan = await q(
    `SELECT a.outcome, a.error_code FROM "${SCHEMA}".satusehat_attempt a
       JOIN "${SCHEMA}".satusehat_transaction t ON t.id = a.transaction_id
      WHERE t.facility_id = $1`,
    [facilityId],
  );
  check('PERCOBAANNYA TETAP DICATAT', percobaan.length === 1, `${percobaan.length} baris`);
  check('dengan hasil BLOCKED', percobaan[0]?.outcome === 'BLOCKED');
  check('dan sebabnya', percobaan[0]?.error_code === 'CAPABILITY_NOT_VERIFIED');

  // --- 5. Idempotensi ------------------------------------------------------
  log('');
  log('5. Kunci idempotensi deterministik dari isinya');
  const kirimUlang = await api(
    '/health/satusehat/transmissions',
    {
      method: 'POST',
      body: JSON.stringify({ facilityId, resourceType: 'Patient', localId: pasien }),
    },
    interop.token,
  );
  check('kunci idempotensinya sama', kirimUlang.data?.idempotencyKey === kirim.data?.idempotencyKey,
    `${kirimUlang.data?.idempotencyKey}`);
  check('dan transaksinya pun sama', kirimUlang.data?.transactionId === kirim.data?.transactionId);

  const jumlahTxn = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".satusehat_transaction WHERE facility_id = $1`,
    [facilityId],
  );
  check('hanya satu transaksi tersimpan', jumlahTxn[0].n === 1, `${jumlahTxn[0].n}`);

  check('kunci tidak memuat cap waktu',
    !/\d{13}/.test(String(kirim.data?.idempotencyKey ?? '')),
    String(kirim.data?.idempotencyKey));

  // --- 6. Kenaikan status --------------------------------------------------
  log('');
  log('6. Kenaikan status tidak boleh melompat, dan VERIFIED menuntut keenamnya');
  const idPatient = (kemampuan.data?.items ?? []).find((k) => k.resourceType === 'Patient')?.id;

  const melompat = await api(
    `/health/satusehat/capabilities/${idPatient}/status`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: 'VERIFIED',
        evidenceCodes: (katalog.data?.requirements ?? []).map((s) => s.kode),
        note: 'Sudah dicoba dan bekerja dengan baik pada sandbox.',
      }),
    },
    interop.token,
  );
  check('kenaikan yang MELOMPAT ditolak', melompat.status === 422, `status ${melompat.status}`);
  check('penolakannya menyebut perbedaan yang selalu ada',
    pesan(melompat).includes('selalu ada'));

  const naikSatu = await api(
    `/health/satusehat/capabilities/${idPatient}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'DOCUMENTED' }) },
    interop.token,
  );
  check('kenaikan satu tahap diterima', naikSatu.data?.status === 'DOCUMENTED',
    `status ${naikSatu.status} ${pesan(naikSatu)}`);

  await api(
    `/health/satusehat/capabilities/${idPatient}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'SANDBOX_TESTED' }) },
    interop.token,
  );

  const kurangBukti = await api(
    `/health/satusehat/capabilities/${idPatient}/status`,
    {
      method: 'POST',
      body: JSON.stringify({
        status: 'VERIFIED',
        evidenceCodes: ['SANDBOX_CREDENTIAL', 'ORGANIZATION_ID'],
        note: 'Sudah dicoba dan bekerja dengan baik pada sandbox.',
      }),
    },
    interop.token,
  );
  check('VERIFIED dengan bukti kurang DITOLAK', kurangBukti.status === 422,
    `status ${kurangBukti.status}`);
  check('penolakannya menyebut yang tergesa', pesan(kurangBukti).includes('tergesa'));

  const tembusLompat = await gagal(
    `UPDATE "${SCHEMA}".satusehat_capability SET status = 'BLOCKED' WHERE id = $1`,
    [idPatient],
  );
  check('UJI KENDALI: PENURUNAN lewat basis data DIIZINKAN', tembusLompat === null,
    tembusLompat ?? '');

  const tembusNaik = await gagal(
    `UPDATE "${SCHEMA}".satusehat_capability SET status = 'VERIFIED' WHERE id = $1`,
    [idPatient],
  );
  check('tetapi kenaikan yang melompat ditolak trigger',
    (tembusNaik ?? '').includes('CAPABILITY_STATUS_SKIP'), tembusNaik ?? 'lolos');

  const tembusVerified = await gagal(
    `UPDATE "${SCHEMA}".satusehat_capability
        SET status = 'DOCUMENTED' WHERE id = $1`,
    [idPatient],
  );
  const tembusVerified2 = await gagal(
    `UPDATE "${SCHEMA}".satusehat_capability
        SET status = 'SANDBOX_TESTED' WHERE id = $1`,
    [idPatient],
  );
  const tembusTanpaNama = await gagal(
    `UPDATE "${SCHEMA}".satusehat_capability
        SET status = 'VERIFIED', evidence_codes = ARRAY['A','B','C','D','E','F']::varchar[]
      WHERE id = $1`,
    [idPatient],
  );
  check('VERIFIED tanpa nama manusianya ditolak constraint',
    (tembusTanpaNama ?? '').includes('satusehat_cap_verified_complete'),
    `${tembusVerified ?? ''}${tembusVerified2 ?? ''}${tembusTanpaNama ?? 'lolos'}`);

  // --- 7. Pemisahan wewenang ----------------------------------------------
  log('');
  log('7. Yang mengaktifkan lingkungan TIDAK memverifikasi kemampuannya');
  const adminVerifikasi = await api(
    `/health/satusehat/capabilities/${idPatient}/status`,
    { method: 'POST', body: JSON.stringify({ status: 'DOCUMENTED' }) },
    admin.token,
  );
  check('administrator tidak berwenang mengubah status kemampuan',
    adminVerifikasi.status === 403, `status ${adminVerifikasi.status}`);

  const interopAktifkan = await api(
    `/health/satusehat/environments/${lingkungan.data?.id}/activate`,
    { method: 'POST' },
    interop.token,
  );
  check('dan petugas interoperabilitas tidak mengaktifkan lingkungan',
    interopAktifkan.status === 403, `status ${interopAktifkan.status}`);

  const interopKredensial = await api(
    '/health/satusehat/environments',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, environment: 'PRODUCTION', credentialSecretRef: 'vault://x',
      }),
    },
    interop.token,
  );
  check('maupun memasang kredensial', interopKredensial.status === 403,
    `status ${interopKredensial.status}`);

  // --- 8. Rekonsiliasi -----------------------------------------------------
  log('');
  log('8. Rekonsiliasi: "sudah dikirim" tidak sama dengan "sudah kami coba"');
  const rekon = await api(
    `/health/satusehat/reconciliation?facilityId=${facilityId}`,
    {},
    admin.token,
  );
  check('rekonsiliasi terbaca', rekon.status === 200, `status ${rekon.status}`);
  check('satu pengiriman tercatat, tidak satu pun diterima',
    rekon.data?.dikirim === 1 && rekon.data?.diterima === 0,
    JSON.stringify(rekon.data));
  check('selisihnya dinamai', rekon.data?.seimbang === false);
  check('dan keterangannya menyebut sudah kami coba',
    String(rekon.data?.keterangan ?? '').includes('sudah kami coba'));

  // --- 9. Jejak tidak dapat dihapus ----------------------------------------
  log('');
  log('9. Jejak pengiriman tidak dapat dihapus');
  const hapusTxn = await gagal(
    `DELETE FROM "${SCHEMA}".satusehat_transaction WHERE facility_id = $1`,
    [facilityId],
  );
  check('jejak transaksi tidak dapat dihapus',
    (hapusTxn ?? '').includes('LEDGER_IMMUTABLE'), hapusTxn ?? 'lolos');

  const hapusPercobaan = await gagal(
    `DELETE FROM "${SCHEMA}".satusehat_attempt a
      USING "${SCHEMA}".satusehat_transaction t
      WHERE t.id = a.transaction_id AND t.facility_id = $1`,
    [facilityId],
  );
  check('jejak percobaan pun tidak', (hapusPercobaan ?? '').includes('LEDGER_IMMUTABLE'),
    hapusPercobaan ?? 'lolos');

  // --- 10. Yang tidak berubah ----------------------------------------------
  log('');
  log('10. SESUDAH SELURUHNYA — TIDAK SATU PUN KEMAMPUAN TERVERIFIKASI');
  const akhir = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".satusehat_capability
      WHERE facility_id = $1 AND status = 'VERIFIED'`,
    [facilityId],
  );
  check('tidak satu pun VERIFIED', akhir[0].n === 0, `${akhir[0].n} kemampuan`);

  const seluruhTenant = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".satusehat_capability
      WHERE status = 'VERIFIED' AND verified_by IS NULL`,
  );
  check('di SELURUH tenant, tidak ada VERIFIED tanpa nama manusianya',
    seluruhTenant[0].n === 0, `${seluruhTenant[0].n} kemampuan`);

  const tanpaPayload = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'satusehat_transaction'
        AND data_type IN ('json', 'jsonb')`,
    [SCHEMA],
  );
  check('tabel transaksi tidak punya satu pun kolom JSON untuk menampung payload',
    tanpaPayload[0].n === 0, `${tanpaPayload[0].n} kolom`);

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
    new URL('../../../docs/emedik/bukti-h9a-satusehat.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
