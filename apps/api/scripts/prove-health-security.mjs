/**
 * Bukti H-12: zona data, tujuan penggunaan, break-glass, penyamaran medan,
 * isolasi antar-tenant dan antar-vertical, serta redaksi AI.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * ## Yang paling penting dibuktikan naskah ini
 *
 * > **Token tenant B tidak dapat membaca data kesehatan tenant A pada satu
 * > jalan pun.**
 *
 * Dan ia dibuktikan sebagaimana H-10 membuktikan isolasi portal: bukan dengan
 * memeriksa satu jalan lalu menyimpulkan sisanya, melainkan dengan **mencoba
 * seluruhnya**. Isolasi yang berlaku pada sembilan dari sepuluh jalan bukan
 * isolasi; ia daftar sepuluh pintu yang salah satunya terbuka.
 *
 * Naskah ini membuat pengguna sungguhan pada tenant kedua — bukan token palsu,
 * bukan skema yang diketik pada parameter — lalu memakainya menembak setiap
 * jalan keamanan milik tenant pertama.
 *
 * ## Selebihnya
 *
 * - break-glass ditolak HANYA bila alasannya terlalu pendek untuk ditelaah —
 *   bukan atas dasar penilaian tentang keadaan daruratnya;
 * - dan yang diterima **selalu masuk antrean telaah**;
 * - tidak seorang pun menelaah aksesnya sendiri — ditegakkan basis data;
 * - telaah tidak dapat diubah dan tidak dapat dihapus;
 * - satu akses hanya boleh ditelaah satu kali;
 * - akses yang BUKAN darurat tidak dapat ditelaah;
 * - penyamaran menyisakan bentuknya, dan dua nama berbeda tetap berbeda;
 * - kolom yang belum tergolong dikembalikan apa adanya DAN disebutkan;
 * - permintaan AI lintas-tenant ditolak sekalipun sudah disamarkan;
 * - zona klinis tidak pernah sampai ke AI;
 * - teks permintaan yang ditolak TIDAK tersimpan di mana pun;
 * - dan tidak ada satu pun tabel kesehatan pada skema public.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3200/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';
/** Tenant kedua, sungguhan. Isolasi tidak dapat dibuktikan dengan satu tenant. */
const SCHEMA_LAIN = process.env.HEALTH_SCHEMA_LAIN ?? 'tokosaya';

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

async function api(path, opts = {}, token = null, tajuk = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...tajuk,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');
const TUJUAN = { 'x-purpose-of-use': 'OPERATIONS' };

async function buatPengguna(schema, tenantId, nama, hakPerMenu) {
  const username = `bukti_kmn_${nama}_${tag}`;
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
      `INSERT INTO "${schema}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,$3,$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [platformUserId, username, nama],
    )
  )[0].id;

  const roleId = (
    await q(
      `INSERT INTO "${schema}".role (code, name, description, is_system)
       VALUES ($1,$2,'Peran naskah bukti H-12',FALSE) RETURNING id`,
      [`BUKTI_KMN_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
    )
  )[0].id;

  const menus = new Map(
    (await q(`SELECT id, code FROM "${schema}".menu WHERE deleted_at IS NULL`)).map((m) => [m.code, m.id]),
  );
  const aksi = new Map(
    (await q(`SELECT id, code FROM "${schema}".permission_action`)).map((a) => [a.code, a.id]),
  );
  for (const [menuCode, aksiCodes] of Object.entries(hakPerMenu)) {
    const menuId = menus.get(menuCode);
    if (!menuId) continue;
    for (const aksiCode of aksiCodes) {
      const aksiId = aksi.get(aksiCode);
      if (!aksiId) continue;
      await q(
        `INSERT INTO "${schema}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
         VALUES ($1,$2,$3,'ALLOW') ON CONFLICT DO NOTHING`,
        [roleId, menuId, aksiId],
      );
    }
  }
  await q(
    `INSERT INTO "${schema}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, roleId],
  );

  return { username, password, subjectId, platformUserId };
}

async function masuk(akun) {
  const r = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: akun.username, password: akun.password }),
  });
  const token = r.data?.accessToken;
  if (!token) throw new Error(`login ${akun.username} gagal: ${JSON.stringify(r.body).slice(0, 300)}`);
  return token;
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-12 — KEAMANAN, ISOLASI, BREAK-GLASS, DAN REDAKSI AI');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}  (tenant kedua: ${SCHEMA_LAIN})`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  const tenantLainId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA_LAIN])
  )[0]?.id;
  if (!tenantLainId) throw new Error(`Tenant kedua ${SCHEMA_LAIN} tidak ada`);

  const HAK_PENUH = {
    HEALTH: ['READ'],
    HEALTH_DATA_ZONE: ['READ', 'UPDATE'],
    HEALTH_BREAK_GLASS: ['READ', 'APPROVE'],
    HEALTH_AI_GUARD: ['READ'],
  };

  /*
   * Empat pengguna dibuat lebih dahulu TANPA login, lalu login sekali
   * masing-masing. Pembatas laju login menghitung percobaan, bukan
   * keberhasilan — pelajaran H-10.
   */
  const akunPenelaah = await buatPengguna(SCHEMA, tenantId, 'penelaah', HAK_PENUH);
  const akunDokter = await buatPengguna(SCHEMA, tenantId, 'dokter', HAK_PENUH);
  const akunPenyusup = await buatPengguna(SCHEMA_LAIN, tenantLainId, 'penyusup', HAK_PENUH);

  const penelaah = await masuk(akunPenelaah);
  const dokter = await masuk(akunDokter);
  const penyusup = await masuk(akunPenyusup);

  log('');
  log('--- 1. Zona data --------------------------------------------------------');

  const zona = await api('/health/security/zones', {}, penelaah);
  check('daftar zona terbuka', zona.status === 200, `${zona.status} ${pesan(zona)}`);

  const zonaKode = (zona.data?.zones ?? []).map((z) => z.code).sort();
  check(
    'lima zona tercatat pada basis data',
    JSON.stringify(zonaKode) ===
      JSON.stringify(['CLINICAL', 'IDENTIFYING', 'OPERATIONAL', 'PUBLIC', 'SENSITIVE_CLINICAL']),
    zonaKode.join(','),
  );

  const terlarangAi = (zona.data?.zones ?? []).filter((z) => !z.allowedToAi).map((z) => z.code);
  check(
    'tiga zona terlarang bagi AI, dibaca dari BASIS DATA bukan dari kode',
    terlarangAi.length === 3
      && terlarangAi.includes('IDENTIFYING')
      && terlarangAi.includes('CLINICAL')
      && terlarangAi.includes('SENSITIVE_CLINICAL'),
    terlarangAi.join(','),
  );

  check(
    'setiap zona terlarang AI juga disamarkan pada ekspor',
    (zona.data?.zones ?? []).every((z) => z.allowedToAi || z.maskedOnExport),
  );

  /*
   * Constraint basis data, bukan sekadar tetapan pada kode: zona yang aman
   * dari model bahasa dan terbuka bagi berkas Excel adalah zona yang bocor —
   * dan berkas Excel jauh lebih sering dikirimkan lewat surel.
   */
  const langgarZona = await gagal(
    `INSERT INTO "${SCHEMA}".health_data_zone
       (code, name, breach_impact, allowed_to_ai, requires_purpose, masked_on_export)
     VALUES ('CLINICAL','uji','Uji constraint yang panjangnya cukup untuk lolos pemeriksaan.',
             FALSE, TRUE, FALSE)`,
  );
  check(
    'basis data menolak zona terlarang-AI yang tidak disamarkan pada ekspor',
    langgarZona?.includes('data_zone_ai_implies_mask'),
    langgarZona?.slice(0, 90) ?? 'diterima',
  );

  const medan = await api('/health/security/fields', {}, penelaah);
  check('penggolongan medan terbuka', medan.status === 200, `${medan.status}`);
  check(
    'penggolongan memuat lebih dari dua puluh medan',
    (medan.data?.total ?? 0) > 20,
    String(medan.data?.total),
  );

  const kolomPenting = (medan.data?.fields ?? []).map((f) => `${f.table}.${f.column}`);
  for (const wajib of [
    'patient.full_name',
    'patient_identifier.identifier_value',
    'clinical_note.free_text',
    'encounter_diagnosis.code',
    'lab_result.value_text',
  ]) {
    check(`medan ${wajib} tergolong`, kolomPenting.includes(wajib));
  }

  check(
    'keterbatasan per-BARIS dinyatakan, bukan disembunyikan',
    String(medan.data?.limitation ?? '').includes('sensitivity'),
  );

  /*
   * Penggolongan yang menunjuk kolom yang tidak ada adalah pintu terkunci pada
   * dinding kosong. Diperiksa terhadap information_schema, bukan dipercaya.
   */
  const kolomHantu = await q(
    `SELECT f.table_name, f.column_name
       FROM "${SCHEMA}".health_field_classification f
      WHERE f.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns c
           WHERE c.table_schema = $1 AND c.table_name = f.table_name
             AND c.column_name = f.column_name
        )`,
    [SCHEMA],
  );
  check(
    'TIDAK ADA penggolongan yang menunjuk kolom yang tidak ada',
    kolomHantu.length === 0,
    kolomHantu.map((k) => `${k.table_name}.${k.column_name}`).join(','),
  );

  log('');
  log('--- 2. Penyamaran medan -------------------------------------------------');

  const samar = await api(
    '/health/security/mask',
    {
      method: 'POST',
      body: JSON.stringify({
        table: 'patient',
        values: { full_name: 'Tono Suryo', phone: '081234567890', gender: 'MALE' },
      }),
    },
    penelaah,
  );
  check('penyamaran berjalan', samar.status === 200 || samar.status === 201, `${samar.status} ${pesan(samar)}`);
  check(
    'penyamaran MENYISAKAN BENTUKNYA, bukan menghapusnya',
    samar.data?.values?.full_name === 'T*** S****',
    String(samar.data?.values?.full_name),
  );
  check(
    'nomor menyisakan empat huruf terakhir',
    String(samar.data?.values?.phone ?? '').endsWith('7890')
      && String(samar.data?.values?.phone ?? '').startsWith('*'),
    String(samar.data?.values?.phone),
  );
  check(
    'kolom yang BELUM tergolong dikembalikan apa adanya',
    samar.data?.values?.gender === 'MALE',
    String(samar.data?.values?.gender),
  );
  check(
    'dan kolom yang belum tergolong DISEBUTKAN, tidak didiamkan',
    (samar.data?.unclassifiedColumns ?? []).includes('gender'),
    JSON.stringify(samar.data?.unclassifiedColumns),
  );

  const samarKedua = await api(
    '/health/security/mask',
    {
      method: 'POST',
      body: JSON.stringify({ table: 'patient', values: { full_name: 'Sri Wahyuni' } }),
    },
    penelaah,
  );
  check(
    'dua nama berbeda tetap terlihat berbeda sesudah disamarkan',
    samarKedua.data?.values?.full_name !== samar.data?.values?.full_name,
    `${samar.data?.values?.full_name} vs ${samarKedua.data?.values?.full_name}`,
  );

  log('');
  log('--- 3. Tujuan penggunaan ------------------------------------------------');

  // Diambil di sini sebab bagian ini sudah menulis ke jejak akses.
  const pasienId = (await q(`SELECT id FROM "${SCHEMA}".patient LIMIT 1`))[0]?.id;
  const fasilitasId = (await q(`SELECT id FROM "${SCHEMA}".health_facility LIMIT 1`))[0]?.id;
  if (!pasienId || !fasilitasId) throw new Error('Tidak ada pasien/fasilitas untuk diuji.');

  const tujuanKatalog = await api('/health/security/purposes', {}, penelaah);
  check('daftar tujuan tertutup', tujuanKatalog.data?.closed === true);

  /*
   * KOSAKATANYA DIBACA DARI CONSTRAINT, BUKAN DARI KODE.
   *
   * Ini pemeriksaan yang paling penting pada bagian ini. Jalan yang menerima
   * tujuan yang ditolak basis data akan membiarkan aksesnya berjalan lalu
   * gagal ketika mencatatnya: aksesnya terjadi, catatannya tidak.
   */
  const constraintTujuan = (
    await q(
      `SELECT pg_get_constraintdef(oid) d FROM pg_constraint
        WHERE conrelid = '${SCHEMA}.health_access_log'::regclass
          AND conname = 'health_access_purpose_valid'`,
    )
  )[0]?.d ?? '';
  const dariSkema = [...constraintTujuan.matchAll(/'([A-Z_]+)'::character varying/g)]
    .map((m) => m[1])
    .sort();
  const dariJalan = [...(tujuanKatalog.data?.purposes ?? [])].sort();
  check(
    'kosakata tujuan pada API SAMA PERSIS dengan constraint pada basis data',
    dariSkema.length > 0 && JSON.stringify(dariSkema) === JSON.stringify(dariJalan),
    `skema=[${dariSkema}] api=[${dariJalan}]`,
  );

  /*
   * Setiap tujuan yang diterima jalannya benar-benar DAPAT DICATAT. Diperiksa
   * dengan menuliskannya, bukan dengan mempercayai daftar.
   */
  let tujuanTakTercatat = 0;
  for (const t of dariJalan) {
    const galat = await gagal(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
          entity_id, action, break_glass)
       VALUES ($1,$2,$3,$4,'patient',$1,'READ',FALSE)`,
      [pasienId, fasilitasId, akunDokter.subjectId, t],
    );
    if (galat) tujuanTakTercatat += 1;
  }
  check(
    'setiap tujuan yang diterima API benar-benar dapat dicatat pada jejak akses',
    tujuanTakTercatat === 0,
    `${tujuanTakTercatat} tujuan ditolak basis data`,
  );

  const tujuanNgawur = await api('/health/security/purposes/CEK/check', {}, penelaah);
  check(
    'tujuan bebas-teks ditolak',
    tujuanNgawur.status === 400 && pesan(tujuanNgawur).includes('TERTUTUP'),
    `${tujuanNgawur.status} ${pesan(tujuanNgawur)}`,
  );

  const tujuanSah = await api('/health/security/purposes/TREATMENT/check', {}, penelaah);
  check('tujuan yang sah DITERIMA — uji kendali', tujuanSah.status === 200, `${tujuanSah.status}`);

  const risetTanpaEtik = await api('/health/security/purposes/RESEARCH/check', {}, penelaah);
  check(
    'RESEARCH tanpa persetujuan etik ditolak',
    risetTanpaEtik.status === 400 && pesan(risetTanpaEtik).includes('etik'),
    `${risetTanpaEtik.status}`,
  );

  const risetBerEtik = await api(
    '/health/security/purposes/RESEARCH/check?ethicsApprovalRef=KEPK-2026-0112',
    {},
    penelaah,
  );
  check('RESEARCH dengan persetujuan etik DITERIMA — uji kendali', risetBerEtik.status === 200);

  const daruratTanpaBg = await api('/health/security/purposes/EMERGENCY/check', {}, penelaah);
  check(
    'EMERGENCY tanpa break-glass ditolak',
    daruratTanpaBg.status === 400 && pesan(daruratTanpaBg).includes('break-glass'),
    `${daruratTanpaBg.status}`,
  );

  const daruratBg = await api(
    '/health/security/purposes/EMERGENCY/check?breakGlass=true',
    {},
    penelaah,
  );
  check('EMERGENCY bersama break-glass DITERIMA — uji kendali', daruratBg.status === 200);

  const antreanTanpaTajuk = await api('/health/security/break-glass/queue', {}, penelaah);
  check(
    'jalan yang menyebut patientId menuntut X-Purpose-Of-Use',
    antreanTanpaTajuk.status === 400,
    `${antreanTanpaTajuk.status} ${pesan(antreanTanpaTajuk)}`,
  );

  log('');
  log('--- 4. Break-glass: tidak pernah ditolak, selalu ditelaah ---------------');

  /*
   * SATU-SATUNYA dasar penolakan break-glass: alasan yang lebih pendek dari
   * sepuluh huruf.
   *
   * Ditegakkan H002, bukan fase ini — dan naskah ini membuktikannya berdiri
   * sebelum membuktikan apa pun yang lain. Rancangan pertama H-12 menyatakan
   * "break-glass tidak pernah ditolak" dan basis datalah yang membetulkannya.
   */
  const alasanKosong = await gagal(
    `INSERT INTO "${SCHEMA}".health_access_log
       (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
        entity_id, action, break_glass, break_glass_reason)
     VALUES ($1,$2,$3,'EMERGENCY','patient',$1,'READ',TRUE,NULL)`,
    [pasienId, fasilitasId, akunDokter.subjectId],
  );
  check(
    'akses darurat TANPA alasan ditolak basis data — sejak H002',
    alasanKosong?.includes('health_access_breakglass_needs_reason'),
    alasanKosong?.slice(0, 80) ?? 'diterima',
  );

  const alasanPendek = await gagal(
    `INSERT INTO "${SCHEMA}".health_access_log
       (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
        entity_id, action, break_glass, break_glass_reason)
     VALUES ($1,$2,$3,'EMERGENCY','patient',$1,'READ',TRUE,'cek')`,
    [pasienId, fasilitasId, akunDokter.subjectId],
  );
  check(
    'dan alasan tiga huruf ditolak pula — sepuluh huruf, bukan "ada isinya"',
    alasanPendek?.includes('health_access_breakglass_needs_reason'),
    alasanPendek?.slice(0, 80) ?? 'diterima',
  );

  /*
   * Sepuluh huruf tepat: uji kendali pada batasnya persis. Tanpa ini,
   * pemeriksaan di atas hanya membuktikan bahwa SESUATU ditolak, bukan bahwa
   * batasnya berada di tempat yang benar.
   */
  const aksesKosong = (
    await q(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
          entity_id, action, break_glass, break_glass_reason)
       VALUES ($1,$2,$3,'EMERGENCY','patient',$1,'READ',TRUE,'1234567890') RETURNING id`,
      [pasienId, fasilitasId, akunDokter.subjectId],
    )
  )[0].id;
  check('alasan sepuluh huruf DITERIMA — uji kendali pada batasnya', !!aksesKosong);

  const aksesPendek = (
    await q(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
          entity_id, action, break_glass, break_glass_reason)
       VALUES ($1,$2,$3,'EMERGENCY','patient',$1,'READ',TRUE,'perlu cepat') RETURNING id`,
      [pasienId, fasilitasId, akunDokter.subjectId],
    )
  )[0].id;

  const aksesWajar = (
    await q(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
          entity_id, action, break_glass, break_glass_reason)
       VALUES ($1,$2,$3,'EMERGENCY','patient',$1,'READ',TRUE,
               'Pasien tidak sadarkan diri di IGD, keluarga belum tiba, perlu riwayat alergi.')
       RETURNING id`,
      [pasienId, fasilitasId, akunDokter.subjectId],
    )
  )[0].id;

  /* Akses BIASA — bukan darurat. Dipakai menguji bahwa telaahnya ditolak. */
  const aksesBiasa = (
    await q(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, actor_user_id, purpose_of_use, entity_type,
          entity_id, action, break_glass)
       VALUES ($1,$2,$3,'TREATMENT','patient',$1,'READ',FALSE) RETURNING id`,
      [pasienId, fasilitasId, akunDokter.subjectId],
    )
  )[0].id;

  const antrean = await api('/health/security/break-glass/queue?limit=200', {}, penelaah, TUJUAN);
  check('antrean telaah terbuka', antrean.status === 200, `${antrean.status} ${pesan(antrean)}`);

  const idAntrean = (antrean.data?.queue ?? []).map((t) => String(t.accessLogId));
  check(
    'SELURUH akses darurat masuk antrean telaah — termasuk yang beralasan pendek',
    idAntrean.includes(String(aksesKosong))
      && idAntrean.includes(String(aksesPendek))
      && idAntrean.includes(String(aksesWajar)),
    idAntrean.slice(0, 6).join(','),
  );
  check(
    'akses BIASA tidak masuk antrean telaah darurat',
    !idAntrean.includes(String(aksesBiasa)),
  );

  const posKosong = idAntrean.indexOf(String(aksesKosong));
  const posWajar = idAntrean.indexOf(String(aksesWajar));
  check(
    'yang beralasan pendek berada DI ATAS yang beralasan lengkap',
    posKosong >= 0 && posWajar >= 0 && posKosong < posWajar,
    `pendek@${posKosong} lengkap@${posWajar}`,
  );

  const temuanKosong = (antrean.data?.queue ?? []).find((t) => String(t.accessLogId) === String(aksesKosong));
  check(
    'prioritasnya HIGH dan sebabnya disebutkan',
    temuanKosong?.prioritas === 'HIGH' && String(temuanKosong?.alasan ?? '').includes('alasannya pendek'),
    `${temuanKosong?.prioritas} ${temuanKosong?.alasan}`,
  );

  log('');
  log('--- 5. Telaah: tidak menelaah diri sendiri, dan tidak dapat diubah ------');

  /*
   * SATU PENJAGA SATU KALI.
   *
   * Dokter di sini memegang HEALTH_BREAK_GLASS.APPROVE seperti penelaah —
   * sengaja. Penolakannya harus datang dari pemeriksaan BARIS, bukan dari
   * ketiadaan hak akses. Pelajaran H-9F.
   */
  const telaahSendiri = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesWajar),
        verdict: 'JUSTIFIED',
        notes: 'Saya sendiri yang membukanya dan menurut saya itu wajar sekali.',
      }),
    },
    dokter,
  );
  check(
    'TIDAK SEORANG PUN menelaah akses daruratnya sendiri',
    telaahSendiri.status === 403 && pesan(telaahSendiri).includes('sendiri'),
    `${telaahSendiri.status} ${pesan(telaahSendiri)}`,
  );

  const telaahBiasa = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesBiasa),
        verdict: 'JUSTIFIED',
        notes: 'Mencoba menelaah akses yang bukan akses darurat sama sekali.',
      }),
    },
    penelaah,
  );
  check(
    'akses yang BUKAN darurat tidak dapat ditelaah',
    telaahBiasa.status === 400 && pesan(telaahBiasa).includes('bukan akses darurat'),
    `${telaahBiasa.status} ${pesan(telaahBiasa)}`,
  );

  const telaahTanpaTindakLanjut = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesPendek),
        verdict: 'NOT_JUSTIFIED',
        notes: 'Alasannya hanya "cek" dan pasiennya bukan pasien yang dirawatnya.',
      }),
    },
    penelaah,
  );
  check(
    'putusan yang tidak wajar menuntut langkah berikutnya',
    telaahTanpaTindakLanjut.status >= 400,
    `${telaahTanpaTindakLanjut.status} ${pesan(telaahTanpaTindakLanjut)}`,
  );

  const telaahSah = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesWajar),
        verdict: 'JUSTIFIED',
        notes: 'Pasien tidak sadarkan diri, riwayat alergi diperlukan segera; wajar.',
      }),
    },
    penelaah,
  );
  check(
    'penelaah lain MENELAAHNYA — uji kendali',
    telaahSah.status === 200 || telaahSah.status === 201,
    `${telaahSah.status} ${pesan(telaahSah)}`,
  );

  const telaahUlang = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesWajar),
        verdict: 'NOT_JUSTIFIED',
        notes: 'Menelaah ulang sampai putusannya berubah menjadi yang saya inginkan.',
        followUp: 'Tidak ada, ini percobaan.',
      }),
    },
    penelaah,
  );
  check(
    'satu akses, SATU telaah',
    telaahUlang.status === 409,
    `${telaahUlang.status} ${pesan(telaahUlang)}`,
  );

  const ubahTelaah = await gagal(
    `UPDATE "${SCHEMA}".health_break_glass_review SET verdict = 'NOT_JUSTIFIED'
      WHERE access_log_id = $1`,
    [aksesWajar],
  );
  check(
    'telaah TIDAK DAPAT DIUBAH',
    ubahTelaah?.includes('REVIEW_APPEND_ONLY'),
    ubahTelaah?.slice(0, 80) ?? 'berhasil diubah',
  );

  const hapusTelaah = await gagal(
    `DELETE FROM "${SCHEMA}".health_break_glass_review WHERE access_log_id = $1`,
    [aksesWajar],
  );
  check(
    'telaah TIDAK DAPAT DIHAPUS',
    hapusTelaah?.includes('REVIEW_APPEND_ONLY'),
    hapusTelaah?.slice(0, 80) ?? 'berhasil dihapus',
  );

  const catatanKosong = await gagal(
    `INSERT INTO "${SCHEMA}".health_break_glass_review
       (access_log_id, reviewed_by, verdict, notes)
     VALUES ($1, $2, 'JUSTIFIED', 'ok')`,
    [aksesKosong, akunPenelaah.subjectId],
  );
  check(
    'telaah berisi "ok" ditolak basis data',
    catatanKosong?.includes('bg_review_notes_meaningful'),
    catatanKosong?.slice(0, 80) ?? 'diterima',
  );

  const ringkas = await api('/health/security/break-glass/summary', {}, penelaah);
  check('ringkasan break-glass terbuka', ringkas.status === 200);
  check(
    'ringkasan menghitung yang BELUM ditelaah',
    (ringkas.data?.pending ?? 0) >= 2,
    JSON.stringify({ total: ringkas.data?.total, pending: ringkas.data?.pending }),
  );

  log('');
  log('--- 6. Penjaga AI -------------------------------------------------------');

  const aiKlinis = await api(
    '/health/security/ai/check',
    {
      method: 'POST',
      body: JSON.stringify({
        zone: 'CLINICAL',
        text: 'Ringkas kondisi pasien ini.',
        tenantIds: [SCHEMA],
        feature: 'ringkasan-klinis',
      }),
    },
    penelaah,
  );
  check(
    'zona klinis TIDAK PERNAH sampai ke AI',
    aiKlinis.data?.allowed === false,
    JSON.stringify(aiKlinis.data?.allowed),
  );

  const aiOperasional = await api(
    '/health/security/ai/check',
    {
      method: 'POST',
      body: JSON.stringify({
        zone: 'OPERATIONAL',
        text: 'Berapa rata-rata lama antre di poliklinik anak?',
        tenantIds: [SCHEMA],
        feature: 'analisis-antrean',
      }),
    },
    penelaah,
  );
  check(
    'zona operasional dengan teks bersih DILOLOSKAN — uji kendali',
    aiOperasional.data?.allowed === true,
    String(aiOperasional.data?.reason),
  );

  const aiLintasTenant = await api(
    '/health/security/ai/check',
    {
      method: 'POST',
      body: JSON.stringify({
        zone: 'OPERATIONAL',
        text: 'Bandingkan lama antre kedua klinik.',
        tenantIds: [SCHEMA, SCHEMA_LAIN],
        feature: 'banding-antrean',
      }),
    },
    penelaah,
  );
  check(
    'permintaan LINTAS-TENANT ditolak sekalipun zonanya boleh',
    aiLintasTenant.data?.allowed === false
      && String(aiLintasTenant.data?.reason).includes('dibandingkan'),
    String(aiLintasTenant.data?.reason).slice(0, 90),
  );

  const aiRedaksi = await api(
    '/health/security/ai/check',
    {
      method: 'POST',
      body: JSON.stringify({
        zone: 'OPERATIONAL',
        text: 'Pasien RM-004512 dengan diagnosis J18.9 memakai SEP-0301R0112500001.',
        tenantIds: [SCHEMA],
        feature: 'uji-redaksi',
      }),
    },
    penelaah,
  );
  const teksRedaksi = String(aiRedaksi.data?.redactedText ?? '');
  check(
    'nomor rekam medis, diagnosis, dan SEP disamarkan',
    !teksRedaksi.includes('004512') && !teksRedaksi.includes('J18.9')
      && !teksRedaksi.includes('0301R0112500001'),
    teksRedaksi.slice(0, 90),
  );
  check(
    'yang disamarkan DILAPORKAN, tidak dibuang diam-diam',
    (aiRedaksi.data?.redactions ?? []).length >= 3,
    JSON.stringify(aiRedaksi.data?.redactions),
  );

  /*
   * Log penjaga TIDAK MENYIMPAN TEKSNYA.
   *
   * Dibuktikan dua cara: tidak ada kolom untuk itu, dan teks yang baru saja
   * dikirim tidak ada di mana pun pada barisnya.
   */
  const kolomLog = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'health_ai_guard_log'`,
    [SCHEMA],
  );
  const namaKolom = kolomLog.map((k) => k.column_name);
  check(
    'log penjaga AI TIDAK punya kolom untuk teks permintaan',
    !namaKolom.some((n) => ['prompt', 'text', 'content', 'body', 'payload', 'request_text'].includes(n)),
    namaKolom.join(','),
  );

  const jejakTeks = await q(
    `SELECT count(*) n FROM "${SCHEMA}".health_ai_guard_log
      WHERE reason LIKE '%004512%' OR reason LIKE '%J18.9%' OR feature LIKE '%004512%'`,
  );
  check(
    'dan teks yang baru dikirim TIDAK tersimpan pada barisnya',
    Number(jejakTeks[0].n) === 0,
    String(jejakTeks[0].n),
  );

  const logAi = await api('/health/security/ai/log?limit=100', {}, penelaah);
  check('riwayat penjaga AI terbuka', logAi.status === 200);
  const diblokir = (logAi.data?.entries ?? []).filter((e) => e.outcome === 'BLOCKED');
  check(
    'penolakannya TERCATAT — yang tidak pernah sampai ke gateway tetap terlihat',
    diblokir.length >= 2,
    String(diblokir.length),
  );

  const larangan = await api('/health/security/ai/forbidden-actions', {}, penelaah);
  const kodeLarangan = (larangan.data?.forbidden ?? []).map((t) => t.kode);
  for (const wajib of ['PAYMENT', 'POSTING', 'APPROVAL', 'DELETE', 'RBAC', 'PRESCRIBE', 'DEVICE_COMMAND']) {
    check(`AI tidak melakukan ${wajib}`, kodeLarangan.includes(wajib));
  }

  const cekBayar = await api('/health/security/ai/forbidden-actions/PAYMENT/check', {}, penelaah);
  check(
    'pemeriksaan tindakan terlarang menolak dengan menyebutkan sebabnya',
    cekBayar.status === 403 && pesan(cekBayar).includes('mengusulkan'),
    `${cekBayar.status} ${pesan(cekBayar).slice(0, 70)}`,
  );

  const cekBoleh = await api('/health/security/ai/forbidden-actions/SUMMARIZE/check', {}, penelaah);
  check('tindakan yang tidak terlarang DILOLOSKAN — uji kendali', cekBoleh.status === 200);

  log('');
  log('--- 7. ISOLASI ANTAR-TENANT: seluruh jalan, bukan sebagian -------------');

  /*
   * INI YANG PALING PENTING PADA NASKAH INI.
   *
   * Penyusup adalah pengguna SUNGGUHAN pada tenant kedua, dengan hak akses
   * keamanan yang PENUH pada tenantnya sendiri. Ia bukan token palsu dan bukan
   * pengguna tanpa hak — penolakannya harus datang dari isolasi, bukan dari
   * ketiadaan hak.
   *
   * Setiap jalan dicoba. Isolasi yang berlaku pada sembilan dari sepuluh jalan
   * bukan isolasi; ia daftar sepuluh pintu yang salah satunya terbuka.
   */
  const jalanKeamanan = [
    ['GET', '/health/security/zones'],
    ['GET', '/health/security/fields'],
    ['GET', '/health/security/purposes'],
    ['GET', '/health/security/break-glass/queue'],
    ['GET', '/health/security/break-glass/reviews'],
    ['GET', '/health/security/break-glass/summary'],
    ['GET', '/health/security/ai/log'],
    ['GET', '/health/security/isolation'],
    ['GET', '/health/security/posture'],
  ];

  let bocor = 0;
  for (const [metode, jalan] of jalanKeamanan) {
    const r = await api(jalan, { method: metode }, penyusup, TUJUAN);
    /*
     * Yang diperiksa BUKAN status kodenya, melainkan ISINYA: token tenant
     * kedua boleh saja menerima 200, sebab ia memang punya zona dan antrean
     * sendiri. Yang tidak boleh adalah barisnya berasal dari tenant pertama.
     */
    const isi = JSON.stringify(r.body ?? {});
    const menyebutTenantPertama = isi.includes(SCHEMA)
      || isi.includes(String(aksesWajar))
      || isi.includes(String(pasienId));
    if (menyebutTenantPertama) bocor += 1;
    check(
      `${jalan} tidak mengembalikan data ${SCHEMA} kepada token ${SCHEMA_LAIN}`,
      !menyebutTenantPertama,
      isi.slice(0, 120),
    );
  }
  check('TIDAK SATU PUN jalan keamanan bocor lintas-tenant', bocor === 0, `${bocor} bocor`);

  const telaahLintas = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesKosong),
        verdict: 'JUSTIFIED',
        notes: 'Menelaah akses milik tenant lain dari tenant saya sendiri.',
      }),
    },
    penyusup,
  );
  check(
    'token tenant kedua TIDAK DAPAT menelaah akses tenant pertama',
    telaahLintas.status >= 400,
    `${telaahLintas.status} ${pesan(telaahLintas).slice(0, 70)}`,
  );

  const belumDitelaah = await q(
    `SELECT count(*) n FROM "${SCHEMA}".health_break_glass_review WHERE access_log_id = $1`,
    [aksesKosong],
  );
  check(
    'dan barisnya benar-benar tidak bertambah — bukan sekadar galat yang dikembalikan',
    Number(belumDitelaah[0].n) === 0,
    String(belumDitelaah[0].n),
  );

  const skemaDiketik = await api(
    `/health/security/isolation?schema=${SCHEMA}`,
    {},
    penyusup,
  );
  check(
    'menyebut skema lain pada parameter ditolak, tidak diikuti',
    skemaDiketik.status === 403 && pesan(skemaDiketik).includes('berbeda'),
    `${skemaDiketik.status} ${pesan(skemaDiketik).slice(0, 70)}`,
  );

  const skemaSendiri = await api(
    `/health/security/isolation?schema=${SCHEMA_LAIN}`,
    {},
    penyusup,
  );
  check(
    'menyebut skemanya SENDIRI diterima — uji kendali',
    skemaSendiri.status === 200,
    `${skemaSendiri.status} ${pesan(skemaSendiri)}`,
  );

  log('');
  log('--- 8. Isolasi antar-vertical ------------------------------------------');

  const isolasi = await api('/health/security/isolation', {}, penelaah);
  check('pemeriksaan isolasi terbuka', isolasi.status === 200);
  check(
    'TIDAK ADA tabel kesehatan pada skema public',
    isolasi.data?.isolated === true && (isolasi.data?.leakedToPublic ?? []).length === 0,
    JSON.stringify(isolasi.data?.leakedToPublic),
  );

  /*
   * Diperiksa langsung pula, tidak hanya lewat jalannya sendiri. Pemeriksaan
   * yang hanya mempercayai jawaban jalannya akan lulus sekalipun jalannya
   * berdusta.
   */
  const publikKesehatan = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND (table_name LIKE 'health\\_%' OR table_name LIKE 'patient%'
             OR table_name LIKE 'lab\\_%' OR table_name LIKE 'rx\\_%')`,
  );
  check(
    'diperiksa langsung ke information_schema pula: public bersih',
    publikKesehatan.length === 0,
    publikKesehatan.map((r) => r.table_name).join(','),
  );

  check(
    'jumlah tabel kesehatan pada tenant ini lebih dari lima puluh',
    (isolasi.data?.healthTableCount ?? 0) > 50,
    String(isolasi.data?.healthTableCount),
  );

  log('');
  log('--- 9. Sikap keamanan ---------------------------------------------------');

  const sikap = await api('/health/security/posture', {}, penelaah);
  check('sikap keamanan terbuka', sikap.status === 200, `${sikap.status} ${pesan(sikap)}`);
  check('lima zona', sikap.data?.zones === 5, String(sikap.data?.zones));
  check(
    'medan tergolong lebih dari dua puluh',
    (sikap.data?.classifiedFields ?? 0) > 20,
    String(sikap.data?.classifiedFields),
  );
  check(
    'penolakan AI terhitung',
    (sikap.data?.aiGuard?.blocked ?? 0) >= 2,
    JSON.stringify(sikap.data?.aiGuard),
  );
  check('isolasi dinyatakan utuh', sikap.data?.isolation?.isolated === true);

  log('');
  log('--- 10. Hak akses: pemisahannya berdiri --------------------------------');

  const akunPenggolong = await buatPengguna(SCHEMA, tenantId, 'penggolong', {
    HEALTH: ['READ'],
    HEALTH_DATA_ZONE: ['READ', 'UPDATE'],
  });
  const penggolong = await masuk(akunPenggolong);

  const penggolongMenelaah = await api(
    '/health/security/break-glass/review',
    {
      method: 'POST',
      body: JSON.stringify({
        accessLogId: String(aksesKosong),
        verdict: 'JUSTIFIED',
        notes: 'Yang menggolongkan medan mencoba menelaah akses daruratnya juga.',
      }),
    },
    penggolong,
  );
  check(
    'yang menggolongkan medan TIDAK dapat menelaah akses',
    penggolongMenelaah.status === 403,
    `${penggolongMenelaah.status}`,
  );

  const penggolongBacaZona = await api('/health/security/zones', {}, penggolong);
  check(
    'tetapi ia tetap dapat membaca zona — uji kendali',
    penggolongBacaZona.status === 200,
    `${penggolongBacaZona.status}`,
  );

  const aturanSoD = await q(
    `SELECT code FROM "${SCHEMA}".segregation_of_duty_rule
      WHERE code = 'HEALTH_SOD_ZONE_REVIEW' AND deleted_at IS NULL`,
  );
  check('aturan pemisahan wewenang H-12 tercatat', aturanSoD.length === 1);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? `SELURUH PEMERIKSAAN LULUS (${lines.filter((l) => l.includes('LULUS')).length})` : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} finally {
  await client.end();
  writeFileSync(new URL('../../../docs/emedik/bukti-h12-keamanan.txt', import.meta.url), lines.join('\n'), 'utf8');
}

process.exit(failures === 0 ? 0 : 1);
