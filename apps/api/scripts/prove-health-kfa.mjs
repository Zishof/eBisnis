/**
 * Bukti H-9M: kerangka impor KFA dan terminologi resmi.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Dua hal yang paling penting dibuktikan naskah ini, dan keduanya menyangkut
 * hal yang **tidak** dilakukan sistem:
 *
 * 1. **Harga sintetis tidak dapat menyebut dirinya resmi.** Constraint menolak
 *    baris bersumber SYNTHETIC_DEMO yang mengaku berterbitan resmi, dan
 *    layanan menolaknya lebih dahulu dengan menyebutkan alasannya.
 *
 * 2. **Obat yang belum terpetakan ke KFA TETAP dapat dipakai.** Naskah ini
 *    memeriksanya pada `information_schema`: tidak ada kolom `kfa_code NOT
 *    NULL` pada tabel produk, dan tidak ada constraint yang menahan resep
 *    tanpa pemetaan.
 *
 * Selebihnya: pemetaan berdasarkan kemiripan nama ditolak pada layanan DAN
 * pada basis data; impor yang bergalat tidak diterapkan; dan yang memvalidasi
 * tidak menerapkannya sendiri.
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
  const username = `bukti_kfa_${nama}_${tag}`;
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
       VALUES ($1,$2,'Peran naskah bukti H-9M',FALSE) RETURNING id`,
      [`BUKTI_KFA_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
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
  log('BUKTI H-9M — KERANGKA IMPOR KFA DAN TERMINOLOGI RESMI');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const apoteker = await buatPengguna(tenantId, 'apoteker', {
    HEALTH: ['READ'],
    // APPROVE diberikan pula, dan itu disengaja: penolakan "yang memvalidasi
    // tidak menerapkan" harus datang dari pemeriksaan baris, bukan dari
    // ketiadaan hak akses. Pelajaran H-9J, H-9K, dan H-9B.
    HEALTH_TERMINOLOGY: ['READ', 'IMPORT', 'VERIFY', 'APPROVE'],
    HEALTH_KFA_MAPPING: ['READ', 'CREATE', 'UPDATE'],
  });
  const penanggungJawab = await buatPengguna(tenantId, 'pj', {
    HEALTH: ['READ'],
    HEALTH_TERMINOLOGY: ['READ', 'APPROVE'],
    HEALTH_KFA_MAPPING: ['READ'],
  });

  log('');
  log('Dua pengguna. Apoteker mengimpor, memvalidasi, dan memetakan; penanggung');
  log('jawab farmasi menerapkan. Apoteker sengaja DIBERI hak menerapkan pula,');
  log('supaya penolakannya datang dari pemeriksaan baris — bukan dari hak akses.');

  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category)
       VALUES ($1,'RS Bukti KFA','HOSPITAL') RETURNING id`,
      [`BKKF-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'RS Bukti KFA','Asia/Jakarta') RETURNING id`,
      [typeId, `KF-${tag}`],
    )
  )[0].id;

  // --- 1. Obat tanpa KFA tetap dapat dipakai --------------------------------
  log('');
  log('1. OBAT TANPA PEMETAAN KFA TETAP DAPAT DIPAKAI');
  const kolomWajib = await q(
    `SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'rx_product'
        AND column_name ILIKE '%kfa%' AND is_nullable = 'NO'`,
    [SCHEMA],
  );
  check('tidak ada kolom KFA yang WAJIB pada tabel produk', kolomWajib[0].n === 0,
    `${kolomWajib[0].n} kolom`);

  const constraintMenahan = await q(
    `SELECT count(*)::int AS n FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = $1
        AND t.relname IN ('rx_prescription', 'rx_prescription_line', 'rx_dispensing')
        AND pg_get_constraintdef(c.oid) ILIKE '%kfa%'`,
    [SCHEMA],
  );
  check('dan tidak ada constraint yang menahan resep tanpa pemetaan',
    constraintMenahan[0].n === 0, `${constraintMenahan[0].n} constraint`);

  const katalog = await api('/health/terminology/catalog', {}, apoteker.token);
  check('katalog terbaca', katalog.status === 200, `status ${katalog.status}`);
  check('dinyatakan tegas: dapat dipakai', katalog.data?.withoutKfa?.bolehDipakai === true);
  check('tetapi tidak dapat dikirim ke SATUSEHAT',
    katalog.data?.withoutKfa?.bolehDikirimSatusehat === false);
  check('dan alasannya menyebut dijalankan di luar sistem',
    String(katalog.data?.withoutKfa?.keterangan ?? '').includes('di luar sistem'));

  // --- 2. Kesiapan katalog -------------------------------------------------
  log('');
  log('2. Katalog kosong dijawab "belum dapat dinilai", bukan "tidak ada masalah"');
  const kesiapan = await api('/health/terminology/readiness', {}, apoteker.token);
  check('kesiapan terbaca', kesiapan.status === 200, `status ${kesiapan.status}`);
  check('enam katalog tercatat', (kesiapan.data?.items ?? []).length === 6,
    `${(kesiapan.data?.items ?? []).length}`);
  /*
   * Diukur pada katalog yang TIDAK DISENTUH naskah ini.
   *
   * Katalog terminologi bersifat tenant-wide — ICD-10 tidak berbeda antar
   * fasilitas — sehingga penerapan impor pada jalan berikutnya mengubah
   * barisnya untuk seluruh tenant. Menuntut "seluruhnya kosong" akan lulus
   * pada jalan pertama dan gagal pada jalan kedua, sebab yang diukurnya adalah
   * keadaan yang diubahnya sendiri. Pelajaran H-9E, diterapkan lagi di sini.
   *
   * Naskah ini mengimpor KFA dan LOINC; keempat katalog di bawah tidak pernah
   * disentuhnya.
   */
  const TAK_TERSENTUH = ['ICD10', 'ICD9CM', 'SNOMED', 'WHO_GROWTH'];
  const takTersentuh = (kesiapan.data?.items ?? []).filter((k) => TAK_TERSENTUH.includes(k.code));
  check('empat katalog yang tidak disentuh naskah ini tetap kosong',
    takTersentuh.length === 4 && takTersentuh.every((k) => k.rowCount === 0),
    JSON.stringify(takTersentuh.map((k) => [k.code, k.rowCount])));
  check('dan seluruhnya dijawab BELUM DAPAT DINILAI',
    takTersentuh.every((k) => k.assessment?.jawaban === 'NOT_ASSESSABLE'));
  check('jawabannya membedakannya dari "tidak ada masalah"',
    String(takTersentuh[0]?.assessment?.keterangan ?? '')
      .includes('bukan "tidak ada masalah"'));
  check('dan seluruhnya bersumber SYNTHETIC_DEMO, bukan OFFICIAL_REFERENCE',
    takTersentuh.every((k) => k.dataSource === 'SYNTHETIC_DEMO'));

  // --- 3. Harga sintetis tidak dapat mengaku resmi -------------------------
  log('');
  log('3. HARGA SINTETIS TIDAK DAPAT MENYEBUT DIRINYA RESMI');
  const isiBerkas = ['KODE;NAMA;SATUAN', '93000001;Amlodipine 5 mg;TABLET',
    '93000002;Amlodipine 10 mg;TABLET'].join('\n');

  const resmiTanpaTerbitan = await api(
    '/health/terminology/imports',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, catalogCode: 'KFA', fileName: `kfa-${tag}.csv`,
        fileContent: isiBerkas, dataSource: 'OFFICIAL_REFERENCE',
      }),
    },
    apoteker.token,
  );
  check('rujukan RESMI tanpa terbitan DITOLAK', resmiTanpaTerbitan.status === 422,
    `status ${resmiTanpaTerbitan.status}`);
  check('penolakannya menyebut yang tidak dapat diperiksa akan dipercaya',
    pesan(resmiTanpaTerbitan).includes('yang tidak dapat diperiksa akan dipercaya'));

  /*
   * Diuji pada ICD10 — katalog yang TIDAK PERNAH diimpor naskah ini, sehingga
   * ia pasti belum berterbitan. Mengujinya pada KFA akan lulus pada jalan
   * pertama dan gagal pada jalan kedua, sebab KFA sudah berterbitan sesudah
   * imporannya diterapkan; dan yang gagal pada jalan kedua akan disangka
   * kerusakan kode.
   */
  const tembusResmi = await gagal(
    `UPDATE "${SCHEMA}".terminology_catalog
        SET data_source = 'OFFICIAL_REFERENCE' WHERE facility_id IS NULL AND catalog_code = 'ICD10'`,
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusResmi ?? '').includes('terminology_official_has_edition'), tembusResmi ?? 'lolos');

  const tembusPalsu = await gagal(
    `INSERT INTO "${SCHEMA}".terminology_import
       (facility_id, catalog_code, file_name, file_hash, data_source)
     VALUES ($1,'KFA','palsu.csv',$2,'OFFICIAL_REFERENCE')`,
    [facilityId, `sha256:palsu-${tag}`],
  );
  check('berkas impor "resmi" tanpa terbitan pun ditolak constraint',
    (tembusPalsu ?? '').includes('terminology_import_official_has_edition'),
    tembusPalsu ?? 'lolos');

  const impor = await api(
    '/health/terminology/imports',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, catalogCode: 'KFA', fileName: `kfa-${tag}.csv`,
        fileContent: isiBerkas, dataSource: 'OFFICIAL_REFERENCE',
        editionRef: 'KFA Kemenkes edisi 2026-07', editionDate: '2026-07-01',
      }),
    },
    apoteker.token,
  );
  check('rujukan resmi BERTERBITAN diterima', impor.status === 201,
    `status ${impor.status} ${pesan(impor)}`);
  check('sidik jarinya dihitung', String(impor.data?.fileHash ?? '').startsWith('sha256:'));
  check('dan dinyatakan BELUM diterapkan',
    String(impor.data?.note ?? '').includes('BELUM diterapkan'));

  const imporGanda = await api(
    '/health/terminology/imports',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, catalogCode: 'KFA', fileName: `nama-lain-${tag}.csv`,
        fileContent: isiBerkas, dataSource: 'OFFICIAL_REFERENCE',
        editionRef: 'KFA Kemenkes edisi 2026-07', editionDate: '2026-07-01',
      }),
    },
    apoteker.token,
  );
  check('berkas dengan ISI yang sama ditolak sekalipun namanya berbeda',
    imporGanda.status === 409, `status ${imporGanda.status}`);
  check('penolakannya menyebut berkas yang sama dengan nama berbeda',
    pesan(imporGanda).includes('nama berbeda'));

  // --- 4. Impor yang bergalat tidak diterapkan -----------------------------
  log('');
  log('4. Impor yang masih bergalat TIDAK diterapkan');
  const imporGalat = await api(
    '/health/terminology/imports',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, catalogCode: 'LOINC', fileName: `loinc-${tag}.csv`,
        fileContent: 'KODE;NAMA\n1234-5;Hemoglobin\nRUSAK', dataSource: 'FACILITY_IMPORT',
      }),
    },
    apoteker.token,
  );
  const validasiGalat = await api(
    `/health/terminology/imports/${imporGalat.data?.id}/validate`,
    { method: 'POST', body: JSON.stringify({ rowError: 1, errorNote: 'Satu baris tanpa kode.' }) },
    apoteker.token,
  );
  check('impor bergalat berstatus REJECTED', validasiGalat.data?.status === 'REJECTED',
    `${validasiGalat.data?.status}`);
  check('dan alasannya menyebut baris mana yang mana',
    String(validasiGalat.data?.note ?? '').includes('baris mana yang mana'));

  const terapkanGalat = await api(
    `/health/terminology/imports/${imporGalat.data?.id}/apply`,
    { method: 'POST' },
    penanggungJawab.token,
  );
  check('impor REJECTED tidak dapat diterapkan', terapkanGalat.status === 422,
    `status ${terapkanGalat.status}`);
  check('penolakannya menyebut berkas yang belum dibaca siapa pun',
    pesan(terapkanGalat).includes('belum dibaca siapa pun'));

  const tembusGalat = await gagal(
    `UPDATE "${SCHEMA}".terminology_import
        SET status = 'APPLIED', applied_by = gen_random_uuid(), applied_at = now()
      WHERE id = $1`,
    [imporGalat.data?.id],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusGalat ?? '').includes('terminology_import_applied_clean'), tembusGalat ?? 'lolos');

  // --- 5. Yang memvalidasi tidak menerapkan --------------------------------
  log('');
  log('5. Yang memvalidasi impor TIDAK menerapkannya sendiri');
  await api(
    `/health/terminology/imports/${impor.data?.id}/validate`,
    { method: 'POST', body: JSON.stringify({ rowError: 0 }) },
    apoteker.token,
  );

  const terapkanSendiri = await api(
    `/health/terminology/imports/${impor.data?.id}/apply`,
    { method: 'POST' },
    apoteker.token,
  );
  check('yang memvalidasi tidak menerapkannya sendiri', terapkanSendiri.status === 403,
    `status ${terapkanSendiri.status}`);
  check('penolakannya menyebut membaca ulang keyakinannya',
    pesan(terapkanSendiri).includes('membaca ulang keyakinannya'));

  const terapkan = await api(
    `/health/terminology/imports/${impor.data?.id}/apply`,
    { method: 'POST' },
    penanggungJawab.token,
  );
  check('penanggung jawab farmasi menerapkannya', terapkan.data?.status === 'APPLIED',
    `status ${terapkan.status} ${pesan(terapkan)}`);
  check('dan katalognya kini bersumber terbitan resmi',
    String(terapkan.data?.note ?? '').includes('terbitan resmi'));

  const sesudah = await api('/health/terminology/readiness', {}, apoteker.token);
  check('ringkasannya menyebut berapa katalog yang terisi',
    typeof sesudah.data?.summary?.terisi === 'number' &&
      sesudah.data.summary.terisi >= 1,
    JSON.stringify(sesudah.data?.summary ?? {}));
  const kfaSesudah = (sesudah.data?.items ?? []).find((k) => k.code === 'KFA');
  check('katalog KFA kini terisi', kfaSesudah?.rowCount === 3, `${kfaSesudah?.rowCount}`);
  check('dan bersumber OFFICIAL_REFERENCE', kfaSesudah?.dataSource === 'OFFICIAL_REFERENCE');
  check('serta tidak lagi dijawab belum dapat dinilai', kfaSesudah?.assessment === null);

  const tembusPemisahan = await gagal(
    `UPDATE "${SCHEMA}".terminology_import SET applied_by = validated_by WHERE id = $1`,
    [impor.data?.id],
  );
  check('menembus pemisahannya lewat basis data ditolak constraint',
    (tembusPemisahan ?? '').includes('terminology_import_apply_not_self'),
    tembusPemisahan ?? 'lolos');

  const hapusImpor = await gagal(
    `DELETE FROM "${SCHEMA}".terminology_import WHERE id = $1`,
    [impor.data?.id],
  );
  check('riwayat impor tidak dapat dihapus',
    (hapusImpor ?? '').includes('LEDGER_IMMUTABLE'), hapusImpor ?? 'lolos');

  // --- 6. Pemetaan KFA -----------------------------------------------------
  log('');
  log('6. PEMETAAN BERDASARKAN KEMIRIPAN NAMA DITOLAK');
  const produkId = randomUUID();

  const kemiripanNama = await api(
    '/health/terminology/kfa-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, mappingKind: 'PRODUCT', kfaCode: '93000001',
        kfaName: 'Amlodipine 5 mg', localKind: 'RX_PRODUCT', localId: produkId,
        localName: 'Amlodipine 10 mg', mappingMethod: 'NAME_SIMILARITY',
      }),
    },
    apoteker.token,
  );
  check('pemetaan berdasarkan kemiripan nama DITOLAK', kemiripanNama.status === 422,
    `status ${kemiripanNama.status}`);
  check('penolakannya menyebut dua kali lipat dosisnya',
    pesan(kemiripanNama).includes('dua kali lipat dosisnya'));
  check('dan menyebut akan dikirim sebagai obat yang bukan diberikan',
    pesan(kemiripanNama).includes('bukan diberikan'));

  const tembusKemiripan = await gagal(
    `INSERT INTO "${SCHEMA}".kfa_mapping
       (facility_id, mapping_kind, kfa_code, local_kind, local_id, mapping_method, mapped_by)
     VALUES ($1,'PRODUCT','93000001','RX_PRODUCT',$2,'NAME_SIMILARITY',gen_random_uuid())`,
    [facilityId, produkId],
  );
  check('menembusnya lewat basis data ditolak constraint',
    (tembusKemiripan ?? '').includes('kfa_mapping_method_valid'), tembusKemiripan ?? 'lolos');

  const kesiapanSebelum = await api(
    `/health/terminology/kfa-mappings/readiness?facilityId=${facilityId}&localId=${produkId}`,
    {},
    apoteker.token,
  );
  check('produk yang belum terpeta DAPAT DIPAKAI',
    kesiapanSebelum.data?.usableInHospital === true);
  check('tetapi tidak dapat dikirim', kesiapanSebelum.data?.sendableToSatusehat === false);

  const petakan = await api(
    '/health/terminology/kfa-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, mappingKind: 'PRODUCT', kfaCode: '93000002',
        kfaName: 'Amlodipine 10 mg', localKind: 'RX_PRODUCT', localId: produkId,
        localName: 'Amlodipine 10 mg', mappingMethod: 'MANUAL',
      }),
    },
    apoteker.token,
  );
  check('pemetaan MANUAL diterima', petakan.status === 201,
    `status ${petakan.status} ${pesan(petakan)}`);

  const kesiapanSesudah = await api(
    `/health/terminology/kfa-mappings/readiness?facilityId=${facilityId}&localId=${produkId}`,
    {},
    apoteker.token,
  );
  check('sesudah dipetakan, ia dapat dikirim',
    kesiapanSesudah.data?.sendableToSatusehat === true);
  check('dan kode KFA-nya disebutkan', kesiapanSesudah.data?.kfaCode === '93000002');

  const petakanUlang = await api(
    '/health/terminology/kfa-mappings',
    {
      method: 'POST',
      body: JSON.stringify({
        facilityId, mappingKind: 'PRODUCT', kfaCode: '93000099',
        localKind: 'RX_PRODUCT', localId: produkId, mappingMethod: 'MANUAL',
      }),
    },
    apoteker.token,
  );
  check('pemetaan yang sudah ada TIDAK ditimpa', petakanUlang.status === 409,
    `status ${petakanUlang.status}`);
  check('penolakannya menyebut kiriman lama yang dipersengketakan',
    pesan(petakanUlang).includes('dipersengketakan'));

  const tanpaNama = await gagal(
    `INSERT INTO "${SCHEMA}".kfa_mapping
       (facility_id, mapping_kind, kfa_code, local_kind, local_id, mapping_method)
     VALUES ($1,'PRODUCT','93000003','RX_PRODUCT',gen_random_uuid(),'MANUAL')`,
    [facilityId],
  );
  check('pemetaan tanpa nama pemetanya ditolak basis data',
    (tanpaNama ?? '').includes('mapped_by'), tanpaNama ?? 'lolos');

  // --- 7. Yang tidak berubah -----------------------------------------------
  log('');
  log('7. SESUDAH SELURUHNYA — KATALOG SINTETIS TETAP BERTANDA SINTETIS');
  const sintetis = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".terminology_catalog
      WHERE facility_id IS NULL AND data_source = 'SYNTHETIC_DEMO'
        AND (edition_ref IS NOT NULL OR edition_date IS NOT NULL)`,
  );
  check('tidak satu pun katalog sintetis yang mengaku berterbitan', sintetis[0].n === 0,
    `${sintetis[0].n}`);

  const resmiTanpaBukti = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".terminology_catalog
      WHERE data_source = 'OFFICIAL_REFERENCE' AND (edition_ref IS NULL OR edition_date IS NULL)`,
  );
  check('dan tidak satu pun yang mengaku resmi tanpa terbitannya',
    resmiTanpaBukti[0].n === 0, `${resmiTanpaBukti[0].n}`);

  const kemiripanTersimpan = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".kfa_mapping
      WHERE mapping_method NOT IN ('MANUAL', 'IMPORTED')`,
  );
  check('di SELURUH tenant, tidak ada pemetaan berdasarkan kemiripan nama',
    kemiripanTersimpan[0].n === 0, `${kemiripanTersimpan[0].n}`);

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
    new URL('../../../docs/emedik/bukti-h9m-kfa.txt', import.meta.url),
    `${lines.join('\n')}\n`,
    'utf8',
  );
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
