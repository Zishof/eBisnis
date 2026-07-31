/**
 * Bukti D-10: situs, portal warga, kiosk, dan siaran.
 *
 * Dua hal yang paling penting dibuktikan pada basis data:
 *
 * 1. **Sesi kiosk yang berakhir tidak dapat menyisakan jejak layar.** Kiosk di
 *    balai desa dipakai bergantian, dan warga berikutnya berdiri di depan layar
 *    yang sama kurang dari satu menit kemudian — sering tanpa menekan apa pun
 *    untuk keluar. Menutupi layar tidak cukup: tombol "kembali"
 *    mengembalikannya.
 * 2. **Siaran tidak dapat menyatakan TERKIRIM tanpa bukti dari penyedianya.**
 *    Sistem yang menandai terkirim tanpa bukti membuat pemerintah desa
 *    menyatakan sesuatu yang tidak diketahuinya kepada warganya.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
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
const S = `uji_d10_${tag}`;

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
  log('BUKTI D-10 — SITUS, PORTAL WARGA, KIOSK, DAN SIARAN');
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

  // --- 1. Migrasi -----------------------------------------------------------
  log('');
  log('1. Migrasi D-10');
  const baru = [
    'village_page', 'village_news', 'village_agenda', 'village_gallery',
    'village_portal_link', 'village_kiosk_session', 'village_broadcast',
  ];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check('tujuh tabel D-10 terbentuk', ada.length === baru.length, `${ada.length}/${baru.length}`);

  // --- 2. Kiosk menghapus jejaknya -----------------------------------------
  log('');
  log('2. Sesi kiosk yang berakhir tidak menyisakan jejak layar');
  const warga = await q(
    `INSERT INTO "${S}".village_resident (village_unit_id, full_name)
     VALUES ($1, 'Sumiati') RETURNING id`,
    [unitId],
  );

  const sesi = await q(
    `INSERT INTO "${S}".village_kiosk_session
       (village_unit_id, kiosk_code, resident_id, search_term, last_view_payload, request_id)
     VALUES ($1, 'KIOSK-01', $2, '3301010101010001', '{"nama":"Sumiati"}'::jsonb, 'req-9')
     RETURNING id`,
    [unitId, warga[0].id],
  );
  check('sesi berjalan boleh menyimpan jejak layar', sesi.length === 1);

  const tutupKotor = await ditolak(() =>
    q(
      `UPDATE "${S}".village_kiosk_session
          SET ended_at = now(), end_reason = 'MENGANGGUR' WHERE id = $1`,
      [sesi[0].id],
    ),
  );
  check(
    'sesi berakhir yang MASIH menyimpan jejak DITOLAK basis data',
    tutupKotor !== null,
    'menutupi layar tidak cukup — tombol kembali mengembalikannya',
  );

  for (const [kolom, nilai] of [
    ['resident_id', null],
    ['search_term', null],
    ['last_view_payload', null],
  ]) {
    await q(`UPDATE "${S}".village_kiosk_session SET ${kolom} = $2 WHERE id = $1`, [
      sesi[0].id,
      nilai,
    ]);
  }
  const sisaSatu = await ditolak(() =>
    q(
      `UPDATE "${S}".village_kiosk_session
          SET ended_at = now(), end_reason = 'MENGANGGUR' WHERE id = $1`,
      [sesi[0].id],
    ),
  );
  check(
    'satu jejak yang tersisa saja sudah cukup untuk menolak',
    sisaSatu !== null,
    'request_id belum dikosongkan',
  );

  await q(`UPDATE "${S}".village_kiosk_session SET request_id = NULL WHERE id = $1`, [sesi[0].id]);
  await q(
    `UPDATE "${S}".village_kiosk_session SET ended_at = now(), end_reason = 'MENGANGGUR'
      WHERE id = $1`,
    [sesi[0].id],
  );
  check('sesi yang bersih dapat ditutup', true);

  const isiUlang = await ditolak(() =>
    q(`UPDATE "${S}".village_kiosk_session SET search_term = 'sumiati' WHERE id = $1`, [
      sesi[0].id,
    ]),
  );
  check(
    'sesi yang sudah berakhir tidak dapat diisi jejak kembali',
    isiUlang !== null,
    'constraint berlaku pada setiap tulis',
  );

  const tutupTanpaSebab = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_kiosk_session (village_unit_id, kiosk_code, ended_at)
       VALUES ($1, 'KIOSK-02', now())`,
      [unitId],
    ),
  );
  check('sesi berakhir tanpa sebab ditolak', tutupTanpaSebab !== null);

  // --- 3. Kiosk tidak diaudit ----------------------------------------------
  log('');
  log('3. Sesi kiosk sengaja tidak diaudit');
  const pemicuKiosk = await q(
    `SELECT g.tgname FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = 'village_kiosk_session' AND NOT g.tgisinternal`,
    [S],
  );
  check(
    'village_kiosk_session tidak memiliki pemicu audit',
    pemicuKiosk.length === 0,
    'menyalinnya ke tabel append-only berarti menyimpan selamanya apa yang aturannya perintahkan dihapus',
  );

  const pemicuLain = await q(
    `SELECT c.relname FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT g.tgisinternal AND g.tgname LIKE 'trg_audit_%'
        AND c.relname IN ('village_page','village_news','village_agenda','village_gallery',
                          'village_portal_link','village_broadcast')`,
    [S],
  );
  check('enam tabel D-10 lainnya tetap diaudit', pemicuLain.length === 6, `${pemicuLain.length}/6`);

  // --- 4. Siaran ------------------------------------------------------------
  log('');
  log('4. Siaran tidak dapat menyatakan terkirim tanpa bukti');
  const tanpaRujukan = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_broadcast
         (village_unit_id, title, message, channel, status, sent_at)
       VALUES ($1, 'Pengumuman', 'Isi pengumuman', 'WHATSAPP', 'TERKIRIM', now())`,
      [unitId],
    ),
  );
  check(
    'status TERKIRIM tanpa provider_reference DITOLAK',
    tanpaRujukan !== null,
    'menandai terkirim tanpa bukti membuat desa menyatakan yang tidak diketahuinya',
  );

  const tanpaTanggal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_broadcast
         (village_unit_id, title, message, channel, status, provider_reference)
       VALUES ($1, 'Pengumuman', 'Isi pengumuman', 'WHATSAPP', 'TERKIRIM', 'wamid.X')`,
      [unitId],
    ),
  );
  check('status TERKIRIM tanpa sent_at ditolak', tanpaTanggal !== null);

  const terhalangTanpaAlasan = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_broadcast
         (village_unit_id, title, message, channel, status)
       VALUES ($1, 'Pengumuman', 'Isi pengumuman', 'WHATSAPP', 'TERHALANG')`,
      [unitId],
    ),
  );
  check('status TERHALANG tanpa alasan ditolak', terhalangTanpaAlasan !== null);

  const terhalang = await q(
    `INSERT INTO "${S}".village_broadcast
       (village_unit_id, title, message, channel, status, blocked_reason)
     VALUES ($1, 'Pengumuman', 'Isi pengumuman', 'WHATSAPP', 'TERHALANG',
             'Kanal WHATSAPP belum memiliki kredensial penyedia.')
     RETURNING id, status`,
    [unitId],
  );
  check(
    'siaran terhalang tersimpan beserta alasannya',
    terhalang[0].status === 'TERHALANG',
    'bukan GAGAL yang mengundang percobaan ulang tak berujung',
  );

  const terkirim = await q(
    `INSERT INTO "${S}".village_broadcast
       (village_unit_id, title, message, channel, status, provider_reference, sent_at,
        recipient_count)
     VALUES ($1, 'Pengumuman', 'Isi pengumuman', 'PAPAN_INFORMASI', 'TERKIRIM',
             'PAPAN:2027-03-01T00:00:00Z', now(), 412)
     RETURNING id`,
    [unitId],
  );
  check('siaran yang benar-benar terkirim menyimpan rujukannya', terkirim.length === 1);

  // --- 5. Portal warga ------------------------------------------------------
  log('');
  log('5. Portal warga: tautan dilakukan petugas');
  const userId = randomUUID();
  const tanpaKeterangan = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_portal_link
         (village_unit_id, user_id, resident_id, linked_by, verification_note)
       VALUES ($1, $2, $3, $4, 'ok')`,
      [unitId, userId, warga[0].id, randomUUID()],
    ),
  );
  check(
    'penautan tanpa keterangan cara identitasnya dipastikan ditolak',
    tanpaKeterangan !== null,
    'yang keliru membuka seluruh data satu keluarga kepada orang lain',
  );

  const tautan = await q(
    `INSERT INTO "${S}".village_portal_link
       (village_unit_id, user_id, resident_id, linked_by, verification_note)
     VALUES ($1, $2, $3, $4, 'KTP asli diperiksa di kantor desa pada 3 Maret 2027')
     RETURNING id`,
    [unitId, userId, warga[0].id, randomUUID()],
  );
  check('penautan yang berketerangan diterima', tautan.length === 1);

  const warga2 = await q(
    `INSERT INTO "${S}".village_resident (village_unit_id, full_name)
     VALUES ($1, 'Karto') RETURNING id`,
    [unitId],
  );
  const akunGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_portal_link
         (village_unit_id, user_id, resident_id, linked_by, verification_note)
       VALUES ($1, $2, $3, $4, 'KTP asli diperiksa di kantor desa')`,
      [unitId, userId, warga2[0].id, randomUUID()],
    ),
  );
  check('satu akun tidak dapat tertaut ke dua penduduk', akunGanda !== null);

  const wargaGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_portal_link
         (village_unit_id, user_id, resident_id, linked_by, verification_note)
       VALUES ($1, $2, $3, $4, 'KTP asli diperiksa di kantor desa')`,
      [unitId, randomUUID(), warga[0].id, randomUUID()],
    ),
  );
  check('satu penduduk tidak dapat tertaut ke dua akun', wargaGanda !== null);

  // --- 6. Isi situs ---------------------------------------------------------
  log('');
  log('6. Halaman kosong tidak dapat tayang');
  const beritaKosong = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_news
         (village_unit_id, slug, title, body, status, published_at)
       VALUES ($1, 'uji', 'Judul', 'pendek', 'TAYANG', now())`,
      [unitId],
    ),
  );
  check('berita tayang dengan isi sekadarnya ditolak', beritaKosong !== null);

  const tanpaTanggalTayang = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_news
         (village_unit_id, slug, title, body, status)
       VALUES ($1, 'uji', 'Judul', $2, 'TAYANG')`,
      [unitId, 'x'.repeat(40)],
    ),
  );
  check('berita tayang tanpa tanggal tayang ditolak', tanpaTanggalTayang !== null);

  const slugSalah = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_news (village_unit_id, slug, title, body)
       VALUES ($1, 'Judul Berita!', 'Judul', $2)`,
      [unitId, 'x'.repeat(40)],
    ),
  );
  check('slug yang bukan huruf kecil dan tanda hubung ditolak', slugSalah !== null);

  const berita = await q(
    `INSERT INTO "${S}".village_news
       (village_unit_id, slug, title, body, status, published_at, author_name)
     VALUES ($1, 'kerja-bakti-minggu-ini', 'Kerja Bakti Minggu Ini', $2, 'TAYANG', now(),
             'Sekretaris Desa')
     RETURNING id`,
    [unitId, 'Warga dusun Krajan mengadakan kerja bakti pada hari Minggu.'],
  );
  check('berita yang lengkap dapat tayang', berita.length === 1);

  const kolomBerita = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_news'`,
      [S],
    )
  ).map((k) => k.column_name);
  check(
    'berita menyimpan nama penulis, bukan rujukan ke data kependudukan',
    kolomBerita.includes('author_name') && !kolomBerita.some((n) => /resident/i.test(n)),
    'menautkannya membuat halaman publik menunjuk ke tabel yang seluruh isinya pribadi',
  );

  // --- 7. Agenda internal ---------------------------------------------------
  log('');
  log('7. Agenda internal tidak tampil publik');
  await q(
    `INSERT INTO "${S}".village_agenda (village_unit_id, title, start_at, is_public)
     VALUES ($1, 'Rapat perangkat desa', now() + interval '2 days', FALSE)`,
    [unitId],
  );
  await q(
    `INSERT INTO "${S}".village_agenda (village_unit_id, title, start_at, is_public)
     VALUES ($1, 'Musyawarah Desa', now() + interval '3 days', TRUE)`,
    [unitId],
  );
  const publik = await q(
    `SELECT title FROM "${S}".village_agenda
      WHERE village_unit_id = $1 AND is_public = TRUE AND deleted_at IS NULL`,
    [unitId],
  );
  check(
    'hanya agenda publik yang keluar dari kueri situs',
    publik.length === 1 && publik[0].title === 'Musyawarah Desa',
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
    new URL('../../../docs/info-desa/bukti-d10-situs-kiosk.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
