/**
 * Bukti Anjungan Mandiri Desa.
 *
 * Yang dibuktikan, seluruhnya pada basis data:
 *
 * 1. **Kode ambil hanya memakai abjad yang tidak membingungkan.** Kode yang
 *    memuat 0, O, 1, I, atau L ditolak constraint — kode seperti itu berarti ia
 *    dibuat jalur lain yang tidak mengikuti aturannya.
 * 2. **Satu berkas, satu kode yang berlaku.** Dua kode atas berkas yang sama
 *    berarti warga yang kehilangan kertasnya memperoleh kode kedua sementara
 *    yang pertama masih dapat dipakai orang yang menemukannya.
 * 3. **Cetak mandiri dibatasi.** Surat keterangan yang beredar dalam sepuluh
 *    salinan asli tidak lagi dapat dipakai membuktikan apa pun.
 * 4. **Buku tamu tidak menyediakan kolom NIK.**
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const url = bacaEnv('DATABASE_URL');
const client = new pg.Client({ connectionString: url });

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

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(4).toString('hex');
const S = `uji_anjungan_${tag}`;

async function ditolak(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI ANJUNGAN MANDIRI DESA');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE SCHEMA "${S}__audit"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
  await q(`CREATE TABLE "${S}__audit".audit_log (
    id BIGSERIAL PRIMARY KEY, table_name TEXT, operation TEXT, at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE FUNCTION "${S}__audit".audit_row_trigger() RETURNS trigger AS $fn$
    BEGIN
      INSERT INTO "${S}__audit".audit_log (table_name, operation) VALUES (TG_TABLE_NAME, TG_OP);
      RETURN COALESCE(NEW, OLD);
    END $fn$ LANGUAGE plpgsql`);

  const manifest = JSON.parse(
    readFileSync(new URL('../tenant-migrations/village/manifest.village.json', import.meta.url), 'utf8'),
  );
  for (const m of manifest.migrations) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S).replace(/\{\{AUDIT_SCHEMA\}\}/g, `${S}__audit`));
  }

  const unit = await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug)
     VALUES ('DESA', 'U1', 'Desa Uji', 'desa-uji-${tag}') RETURNING id`,
  );
  const unitId = unit[0].id;

  const katalog = await q(
    `INSERT INTO "${S}".village_service_catalog (village_unit_id, code, name)
     VALUES ($1, 'SKD', 'Surat Keterangan Domisili') RETURNING id`,
    [unitId],
  );
  const mohon = await q(
    `INSERT INTO "${S}".village_service_request
       (village_unit_id, service_catalog_id, applicant_name, status)
     VALUES ($1, $2, 'Sumiati', 'DITERBITKAN') RETURNING id`,
    [unitId, katalog[0].id],
  );

  // --- 1. Migrasi -----------------------------------------------------------
  log('');
  log('1. Migrasi anjungan');
  const baru = ['village_kiosk_claim', 'village_guest_book', 'village_patrol_attendance'];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check('tiga tabel anjungan terbentuk', ada.length === 3, `${ada.length}/3`);

  // --- 2. Abjad kode ambil --------------------------------------------------
  log('');
  log('2. Kode ambil dibuat untuk dibaca orang');
  for (const [huruf, kode] of [
    ['O', 'A7K29MPO'],
    ['0', 'A7K29MP0'],
    ['1', 'A7K29MP1'],
    ['I', 'A7K29MPI'],
    ['L', 'A7K29MPL'],
  ]) {
    const tolak = await ditolak(() =>
      q(
        `INSERT INTO "${S}".village_kiosk_claim
           (village_unit_id, claim_code, subject_type, service_request_id)
         VALUES ($1, $2, 'PERMOHONAN', $3)`,
        [unitId, kode, mohon[0].id],
      ),
    );
    check(`kode yang memuat "${huruf}" ditolak`, tolak !== null);
  }

  const pendek = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_kiosk_claim
         (village_unit_id, claim_code, subject_type, service_request_id)
       VALUES ($1, 'A7K2', 'PERMOHONAN', $2)`,
      [unitId, mohon[0].id],
    ),
  );
  check('kode yang panjangnya salah ditolak', pendek !== null);

  const kode = await q(
    `INSERT INTO "${S}".village_kiosk_claim
       (village_unit_id, claim_code, subject_type, service_request_id)
     VALUES ($1, 'A7K29MPQ', 'PERMOHONAN', $2) RETURNING id`,
    [unitId, mohon[0].id],
  );
  check('kode yang sah tersimpan', kode.length === 1);

  // --- 3. Satu berkas satu kode --------------------------------------------
  log('');
  log('3. Satu berkas, satu kode yang berlaku');
  const kodeKedua = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_kiosk_claim
         (village_unit_id, claim_code, subject_type, service_request_id)
       VALUES ($1, 'B8M34NRS', 'PERMOHONAN', $2)`,
      [unitId, mohon[0].id],
    ),
  );
  check(
    'kode kedua atas berkas yang sama ditolak',
    kodeKedua !== null,
    'yang pertama masih dapat dipakai orang yang menemukan kertasnya',
  );

  await q(`UPDATE "${S}".village_kiosk_claim SET revoked_at = now() WHERE id = $1`, [kode[0].id]);
  const kodeBaru = await q(
    `INSERT INTO "${S}".village_kiosk_claim
       (village_unit_id, claim_code, subject_type, service_request_id)
     VALUES ($1, 'B8M34NRS', 'PERMOHONAN', $2) RETURNING id`,
    [unitId, mohon[0].id],
  );
  check('setelah yang lama dicabut, kode baru dapat terbit', kodeBaru.length === 1);

  const duaSubjek = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_kiosk_claim
         (village_unit_id, claim_code, subject_type, service_request_id, complaint_id)
       VALUES ($1, 'C9N45PTU', 'PERMOHONAN', $2, $3)`,
      [unitId, mohon[0].id, kode[0].id],
    ),
  );
  check('kode yang menunjuk dua berkas sekaligus ditolak', duaSubjek !== null);

  const salahJenis = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_kiosk_claim
         (village_unit_id, claim_code, subject_type, complaint_id)
       VALUES ($1, 'D2P56QVW', 'PERMOHONAN', $2)`,
      [unitId, kode[0].id],
    ),
  );
  check('kode bertanda PERMOHONAN yang menunjuk pengaduan ditolak', salahJenis !== null);

  // --- 4. Cetak mandiri dibatasi -------------------------------------------
  log('');
  log('4. Cetak mandiri dibatasi');
  await q(`UPDATE "${S}".village_kiosk_claim SET kiosk_print_count = 3 WHERE id = $1`, [
    kodeBaru[0].id,
  ]);
  const cetakKeempat = await ditolak(() =>
    q(`UPDATE "${S}".village_kiosk_claim SET kiosk_print_count = 4 WHERE id = $1`, [
      kodeBaru[0].id,
    ]),
  );
  check(
    'cetak mandiri keempat ditolak basis data',
    cetakKeempat !== null,
    'surat yang beredar dalam sepuluh salinan asli tidak dapat membuktikan apa pun',
  );

  const percobaanNegatif = await ditolak(() =>
    q(`UPDATE "${S}".village_kiosk_claim SET failed_attempts = -1 WHERE id = $1`, [kodeBaru[0].id]),
  );
  check('penghitung percobaan tidak dapat menjadi negatif', percobaanNegatif !== null);

  // --- 5. Buku tamu tidak meminta NIK --------------------------------------
  log('');
  log('5. Buku tamu tidak meminta NIK');
  const kolomTamu = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_guest_book'`,
      [S],
    )
  ).map((k) => k.column_name);

  const terlarang = kolomTamu.filter((n) =>
    /nik|national_id|resident_id|birth_date|address|family_card/i.test(n),
  );
  check(
    'tidak ada kolom NIK, alamat, maupun rujukan ke data penduduk',
    terlarang.length === 0,
    'buku tamu adalah catatan siapa yang datang hari ini, bukan pendaftaran kependudukan',
  );
  check(
    'yang ada hanyalah nama, keperluan, dan keterangan',
    kolomTamu.includes('guest_name') && kolomTamu.includes('purpose'),
  );

  const tamuKosong = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_guest_book (village_unit_id, guest_name, purpose)
       VALUES ($1, ' ', 'LAYANAN_SURAT')`,
      [unitId],
    ),
  );
  check('isian buku tamu tanpa nama ditolak', tamuKosong !== null);

  const keperluanAsing = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_guest_book (village_unit_id, guest_name, purpose)
       VALUES ($1, 'Sumiati', 'MENCARI_DATA_WARGA')`,
      [unitId],
    ),
  );
  check('keperluan di luar daftar ditolak', keperluanAsing !== null);

  const tamu = await q(
    `INSERT INTO "${S}".village_guest_book (village_unit_id, guest_name, purpose, kiosk_code)
     VALUES ($1, 'Sumiati', 'LAYANAN_SURAT', 'ANJUNGAN-01') RETURNING id`,
    [unitId],
  );
  check('isian buku tamu yang sah tersimpan', tamu.length === 1);

  // --- 6. Absensi ronda -----------------------------------------------------
  log('');
  log('6. Absensi ronda');
  const jadwal = await q(
    `INSERT INTO "${S}".village_patrol_schedule
       (village_unit_id, patrol_date, shift_start, shift_end)
     VALUES ($1, CURRENT_DATE, '20:00', '23:00') RETURNING id`,
    [unitId],
  );
  await q(
    `INSERT INTO "${S}".village_patrol_attendance
       (village_unit_id, patrol_schedule_id, member_name, kiosk_code)
     VALUES ($1, $2, 'Karto', 'ANJUNGAN-01')`,
    [unitId, jadwal[0].id],
  );
  const absenGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_patrol_attendance
         (village_unit_id, patrol_schedule_id, member_name)
       VALUES ($1, $2, 'Karto')`,
      [unitId, jadwal[0].id],
    ),
  );
  check('satu anggota satu kehadiran per jadwal', absenGanda !== null);

  const kanalAsing = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_patrol_attendance
         (village_unit_id, member_name, channel) VALUES ($1, 'Slamet', 'TELEPATI')`,
      [unitId],
    ),
  );
  check('kanal absensi di luar daftar ditolak', kanalAsing !== null);

  // --- 7. Jejak audit -------------------------------------------------------
  log('');
  log('7. Jejak audit');
  const jejak = await q(
    `SELECT table_name, count(*)::int AS n FROM "${S}__audit".audit_log
      WHERE table_name IN ('village_kiosk_claim','village_guest_book','village_patrol_attendance')
      GROUP BY table_name ORDER BY table_name`,
  );
  check(
    'kode ambil, buku tamu, dan absensi tercatat pada skema audit',
    jejak.length === 3,
    jejak.map((r) => `${r.table_name}:${r.n}`).join(' '),
  );

  const pemicuSesi = await q(
    `SELECT g.tgname FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = 'village_kiosk_session' AND NOT g.tgisinternal`,
    [S],
  );
  check(
    'village_kiosk_session tetap TIDAK diaudit',
    pemicuSesi.length === 0,
    'isinya jejak layar yang wajib dihapus, berbeda dari kode ambil yang harus dapat ditelusuri',
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await q(`DROP SCHEMA IF EXISTS "${S}" CASCADE`).catch(() => {});
  await q(`DROP SCHEMA IF EXISTS "${S}__audit" CASCADE`).catch(() => {});
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-anjungan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
