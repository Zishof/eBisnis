/**
 * Fixture uji peramban untuk layar kesehatan.
 *
 * Membuat SATU pengguna dengan peran kesehatan yang tersemai, lalu menuliskan
 * kredensialnya ke berkas yang dibaca Playwright. Tidak ada kredensial yang
 * tersimpan di repositori.
 *
 * ## Mengapa bukan sesi demo
 *
 * Uji peramban lain memakai sandbox demo. Peran `DEMO_USER` tidak memegang
 * satu pun hak kesehatan, dan memberinya hak itu akan membuka data pasien
 * contoh bagi siapa pun yang menekan "coba demo" pada halaman masuk.
 *
 * Sampel memang bukan orang sungguhan, tetapi layar yang sama kelak menampilkan
 * orang sungguhan, dan keputusan "biarkan saja, ini kan data contoh" adalah
 * keputusan yang tidak pernah ditinjau ulang. Karena itu fixture ini memakai
 * penggunanya sendiri dan sandbox demo dibiarkan sebagaimana adanya.
 *
 * ## Pemakaian
 *
 *   node scripts/e2e-health-fixture.mjs setup     -> menyiapkan, menulis berkas
 *   node scripts/e2e-health-fixture.mjs teardown  -> membersihkan seluruhnya
 */

import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';
const BERKAS =
  process.env.E2E_HEALTH_FIXTURE ??
  fileURLToPath(new URL('../../web/.playwright/health-fixture.json', import.meta.url));

function sambungan() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const nilai = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()?.replace(/^"|"$/g, '');
    if (nilai) return nilai;
  } catch {
    /* tidak ada .env — wajar pada CI */
  }
  throw new Error('DATABASE_URL tidak ditemukan pada lingkungan maupun apps/api/.env');
}

const client = new pg.Client({ connectionString: sambungan() });
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

/**
 * Peran yang diberikan kepada pengguna uji.
 *
 * Bukan satu peran, melainkan gabungan beberapa — sebab uji peramban membuka
 * layar dari berbagai bagian modul, sementara orang sungguhan hanya memegang
 * satu. Ini pengecualian yang disadari: yang diuji di sini adalah LAYARNYA
 * dapat dipakai, bukan siapa yang boleh membukanya. Pertanyaan kedua sudah
 * dijawab `prove-health-uat-persona.mjs`, dan menggabungkan keduanya akan
 * membuat masing-masing kurang jelas.
 */
const PERAN = [
  'HEALTH_REGISTRATION_CLERK',
  'HEALTH_DOCTOR',
  'HEALTH_NURSE',
  'HEALTH_PHARMACIST',
  'HEALTH_CODER',
  'HEALTH_CLAIM_OFFICER',
  'HEALTH_PHC_OFFICER',
  'HEALTH_QUALITY_MANAGER',
  'HEALTH_BIOMEDICAL_ENGINEER',
];

const perintah = process.argv[2];

await client.connect();

try {
  if (perintah === 'setup') await siapkan();
  else if (perintah === 'teardown') await bersihkan();
  else {
    console.error('Pemakaian: e2e-health-fixture.mjs setup|teardown');
    process.exitCode = 2;
  }
} finally {
  await client.end();
}


async function siapkan() {
  await bersihkan({ diam: true });

  const tag = randomBytes(4).toString('hex');
  const username = `e2e_kesehatan_${tag}`;
  const password = `Sehat-${randomBytes(9).toString('base64url')}!7`;
  const pid = randomUUID();

  const tenantId = (
    await q('SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1', [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Skema ${SCHEMA} tidak terdaftar pada platform.tenant_schema_registry.`);

  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,'Petugas Uji Peramban',$4,'ACTIVE',FALSE,FALSE,now(),now())`,
    [pid, username, `${username}@contoh.invalid`, await argon2.hash(password, { type: argon2.argon2id })],
  );
  await q(
    `INSERT INTO platform.tenant_membership (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, pid],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,'Petugas Uji Peramban',$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [pid, username],
    )
  )[0].id;

  const hilang = [];
  for (const kode of PERAN) {
    const peran = (await q(`SELECT id FROM "${SCHEMA}".role WHERE code = $1 AND deleted_at IS NULL`, [kode]))[0];
    if (!peran) {
      hilang.push(kode);
      continue;
    }
    await q(
      `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from) VALUES ($1,$2,CURRENT_DATE)`,
      [subjectId, peran.id],
    );
  }
  if (hilang.length) {
    /* Berisik, bukan diam. Peran yang tidak tersemai akan tampak sebagai layar
     * yang menolak, dan sebabnya akan dicari pada tempat yang keliru. */
    console.error(`PERINGATAN: peran tidak tersemai dan dilewati: ${hilang.join(', ')}`);
  }

  const fasilitas = (
    await q(`SELECT f.id::text AS id, f.code, f.name
               FROM "${SCHEMA}".health_facility f
              WHERE f.deleted_at IS NULL
                AND EXISTS (SELECT 1 FROM "${SCHEMA}".health_service_unit u WHERE u.facility_id = f.id)
              ORDER BY f.created_at LIMIT 1`)
  )[0];
  if (!fasilitas) throw new Error('Tidak ada fasilitas kesehatan berunit pada skema ini.');

  const fixture = {
    username,
    password,
    subjectId,
    platformUserId: pid,
    facilityId: fasilitas.id,
    facilityCode: fasilitas.code,
    roles: PERAN.filter((r) => !hilang.includes(r)),
  };
  mkdirSync(dirname(BERKAS), { recursive: true });
  writeFileSync(BERKAS, JSON.stringify(fixture, null, 2));
  console.log(`Fixture kesehatan siap: ${username} (${fixture.roles.length} peran) pada ${fasilitas.code}`);
  console.log(`Ditulis ke ${BERKAS}`);
}

async function bersihkan({ diam = false } = {}) {
  if (!existsSync(BERKAS)) {
    if (!diam) console.log('Tidak ada fixture kesehatan yang perlu dibersihkan.');
    return;
  }
  const f = JSON.parse(readFileSync(BERKAS, 'utf8'));
  /*
   * Dibersihkan berurutan dari yang paling bergantung. Pengguna uji yang
   * tertinggal bukan sekadar sampah: ia akun ACTIVE dengan hak kesehatan, dan
   * ratusan di antaranya sudah pernah menumpuk pada tenant demo karena naskah
   * pendahulu tidak membersihkan dirinya.
   */
  await q(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [f.subjectId]).catch(() => {});
  await q(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [f.subjectId]).catch(() => {});
  await q('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [f.platformUserId]).catch(() => {});
  await q('DELETE FROM platform.platform_user WHERE id = $1', [f.platformUserId]).catch(() => {});
  rmSync(BERKAS, { force: true });
  if (!diam) console.log('Fixture kesehatan dibersihkan.');
}
