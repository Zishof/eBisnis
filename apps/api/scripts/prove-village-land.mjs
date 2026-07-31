/**
 * Bukti D-9: keamanan, bencana, lingkungan, dan pertanahan.
 *
 * Yang dibuktikan di sini, seluruhnya pada **basis data**:
 *
 * 1. **Surat keterangan tanah tidak dapat terbit tanpa penyangkalannya.**
 *    Diperiksa pada teks yang akan tercetak, bukan pada templat — templat dapat
 *    disunting, diganti, atau dilewati jalur penerbitan lain, dan yang dipegang
 *    warga adalah teks yang tercetak.
 * 2. **Tanah bersertifikat tidak diberi surat keterangan desa**, dan satu
 *    bidang hanya punya satu surat yang berlaku. Dua kertas atas satu bidang
 *    adalah cara sengketa dimulai.
 * 3. **Catatan insiden tidak menyediakan kolom untuk nama pelaku.**
 * 4. **Bantuan bencana tidak menyediakan tempat bagi penyaringan kelayakan** —
 *    kebalikan sengaja dari bantuan sosial D-7.
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
const S = `uji_d9_${tag}`;

async function ditolak(fn) {
  try {
    await fn();
    return null;
  } catch (e) {
    return e.message;
  }
}

const PENYANGKALAN =
  'Surat keterangan ini BUKAN BUKTI KEPEMILIKAN hak atas tanah dan TIDAK MENGGANTIKAN ' +
  'SERTIFIKAT yang diterbitkan Badan Pertanahan Nasional.';

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-9 — KEAMANAN, BENCANA, LINGKUNGAN, DAN PERTANAHAN');
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
  log('1. Migrasi D-9');
  const baru = [
    'village_security_post', 'village_linmas_member', 'village_patrol_schedule',
    'village_incident', 'village_disaster_event', 'village_disaster_damage',
    'village_relief_item', 'village_relief_distribution', 'village_infrastructure',
    'village_infrastructure_inspection', 'village_land_parcel', 'village_land_history',
    'village_land_boundary_consent', 'village_land_statement',
  ];
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = ANY($2)`,
    [S, baru],
  );
  check('empat belas tabel D-9 terbentuk', ada.length === baru.length, `${ada.length}/${baru.length}`);

  const pemicu = await q(
    `SELECT c.relname AS t FROM pg_trigger g
       JOIN pg_class c ON c.oid = g.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND NOT g.tgisinternal AND g.tgname LIKE 'trg_audit_%'
        AND c.relname = ANY($2)`,
    [S, baru],
  );
  check('pemicu audit terpasang pada tabel D-9', pemicu.length >= 13, `${pemicu.length} tabel`);

  // --- 2. Catatan insiden tidak menyimpan tuduhan --------------------------
  log('');
  log('2. Catatan insiden tidak menyimpan tuduhan sebagai fakta');
  const kolomInsiden = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_incident'`,
      [S],
    )
  ).map((k) => k.column_name);

  const terlarang = kolomInsiden.filter((n) =>
    /accused|suspect|perpetrator|pelaku|tersangka|terduga/i.test(n),
  );
  check(
    'tidak ada kolom untuk nama pelaku, tersangka, maupun terduga',
    terlarang.length === 0,
    'kolom yang tidak ada tidak dapat diisi',
  );
  check(
    'yang ada adalah pelapor, bukan terlapor',
    kolomInsiden.includes('reporter_name') && kolomInsiden.includes('is_anonymous'),
  );

  const anonimBernama = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_incident
         (village_unit_id, incident_number, incident_type, occurred_at, location_note,
          description, is_anonymous, reporter_name)
       VALUES ($1, 'INS-01', 'PENCURIAN', now(), 'RT 03', 'Kehilangan sepeda motor', TRUE, 'Karto')`,
      [unitId],
    ),
  );
  check(
    'laporan anonim yang menyimpan nama pelapor ditolak',
    anonimBernama !== null,
    'anonimitas yang hanya janji bukan anonimitas',
  );

  const insiden = await q(
    `INSERT INTO "${S}".village_incident
       (village_unit_id, incident_number, incident_type, occurred_at, location_note, description)
     VALUES ($1, 'INS-01', 'PENCURIAN', now(), 'RT 03', 'Kehilangan sepeda motor di halaman')
     RETURNING id`,
    [unitId],
  );
  check('insiden tercatat', insiden.length === 1);

  const rujukTanpaNomor = await ditolak(() =>
    q(
      `UPDATE "${S}".village_incident SET status = 'DIRUJUK', referred_to = 'Polsek' WHERE id = $1`,
      [insiden[0].id],
    ),
  );
  check(
    'rujukan ke kepolisian tanpa nomor laporan ditolak',
    rujukTanpaNomor !== null,
    '"sudah dilaporkan" tanpa nomornya tidak dapat ditelusuri',
  );

  await q(
    `UPDATE "${S}".village_incident
        SET status = 'DIRUJUK', referred_to = 'Polsek Kecamatan', referral_number = 'LP/45/III/2027'
      WHERE id = $1`,
    [insiden[0].id],
  );
  check('rujukan yang bernomor diterima', true);

  // --- 3. Bencana -----------------------------------------------------------
  log('');
  log('3. Laporan kejadian bencana tidak dihapus, hanya dikoreksi');
  const kolomBencana = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_disaster_event'`,
      [S],
    )
  ).map((k) => k.column_name);
  check(
    'village_disaster_event tidak memiliki deleted_at',
    !kolomBencana.includes('deleted_at'),
    'laporan sudah menjadi dasar laporan ke BPBD',
  );

  const bencana = await q(
    `INSERT INTO "${S}".village_disaster_event
       (village_unit_id, event_number, disaster_type, occurred_at, location_note,
        affected_family_count, displaced_count)
     VALUES ($1, 'BNC-01', 'BANJIR', '2027-01-18', 'Dusun Krajan', 42, 120) RETURNING id`,
    [unitId],
  );
  const koreksiTanpaAlasan = await ditolak(() =>
    q(
      `UPDATE "${S}".village_disaster_event
          SET displaced_count = 90, corrected_at = now() WHERE id = $1`,
      [bencana[0].id],
    ),
  );
  check('koreksi angka tanpa alasan ditolak', koreksiTanpaAlasan !== null);

  await q(
    `UPDATE "${S}".village_disaster_event
        SET displaced_count = 90, corrected_at = now(),
            correction_note = 'Pendataan ulang posko pada 20 Januari 2027'
      WHERE id = $1`,
    [bencana[0].id],
  );
  check('koreksi yang beralasan diterima, dan alasannya ikut tersimpan', true);

  const angkaNegatif = await ditolak(() =>
    q(`UPDATE "${S}".village_disaster_event SET casualty_count = -1 WHERE id = $1`, [
      bencana[0].id,
    ]),
  );
  check('angka korban negatif ditolak', angkaNegatif !== null);

  // --- 4. Logistik bencana --------------------------------------------------
  log('');
  log('4. Bantuan bencana tidak menunggu penyaringan kelayakan');
  const kolomSalur = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_relief_distribution'`,
      [S],
    )
  ).map((k) => k.column_name);
  const gerbangKelayakan = kolomSalur.filter((n) =>
    /candidate|verified|decision|eligib|screening|allow_stacking/i.test(n),
  );
  check(
    'tabel penyaluran TIDAK menyediakan tempat bagi verifikasi kelayakan',
    gerbangKelayakan.length === 0,
    'kebalikan sengaja dari bantuan sosial D-7',
  );
  check(
    'yang tetap dituntut hanyalah nama penerimanya',
    kolomSalur.includes('recipient_name'),
  );

  const barang = await q(
    `INSERT INTO "${S}".village_relief_item
       (village_unit_id, code, name, unit, stock_quantity)
     VALUES ($1, 'PKT-01', 'Paket Sembako', 'paket', 100) RETURNING id`,
    [unitId],
  );

  const tanpaNama = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_relief_distribution
         (village_unit_id, relief_item_id, quantity, recipient_name)
       VALUES ($1, $2, 2, '   ')`,
      [unitId, barang[0].id],
    ),
  );
  check('penyaluran tanpa nama penerima ditolak', tanpaNama !== null);

  await q(
    `INSERT INTO "${S}".village_relief_distribution
       (village_unit_id, disaster_event_id, relief_item_id, quantity, recipient_name)
     VALUES ($1, $2, $3, 2, 'Sumiati')`,
    [unitId, bencana[0].id, barang[0].id],
  );
  await q(`UPDATE "${S}".village_relief_item SET stock_quantity = stock_quantity - 2 WHERE id = $1`, [
    barang[0].id,
  ]);
  check('penyaluran tercatat tanpa verifikasi apa pun', true);

  const stokMinus = await ditolak(() =>
    q(`UPDATE "${S}".village_relief_item SET stock_quantity = stock_quantity - 1000 WHERE id = $1`, [
      barang[0].id,
    ]),
  );
  check(
    'stok logistik tidak dapat menjadi negatif',
    stokMinus !== null,
    'gudang yang menampilkan minus membuat petugas berhenti mempercayai seluruh angkanya',
  );

  // --- 5. Infrastruktur -----------------------------------------------------
  log('');
  log('5. Kondisi infrastruktur tidak dapat dicatat tanpa tanggalnya');
  const tanpaTanggal = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_infrastructure
         (village_unit_id, code, name, infra_type, condition)
       VALUES ($1, 'JLN-01', 'Jalan Dusun Krajan', 'JALAN', 'RUSAK_BERAT')`,
      [unitId],
    ),
  );
  check(
    'kondisi tanpa tanggal penilaian ditolak',
    tanpaTanggal !== null,
    'kondisi tanpa tanggal adalah pernyataan yang tidak pernah kedaluwarsa',
  );

  const jalan = await q(
    `INSERT INTO "${S}".village_infrastructure
       (village_unit_id, code, name, infra_type, condition, condition_assessed_at, length_m)
     VALUES ($1, 'JLN-01', 'Jalan Dusun Krajan', 'JALAN', 'RUSAK_BERAT', '2027-02-14', 1200)
     RETURNING id`,
    [unitId],
  );
  check('kondisi bertanggal diterima', jalan.length === 1);

  // --- 6. Bidang tanah ------------------------------------------------------
  log('');
  log('6. Catatan tanah administratif, bukan kepemilikan');
  const kolomTanah = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_land_parcel'`,
      [S],
    )
  ).map((k) => k.column_name);
  check(
    'kolomnya bernama possessor, bukan owner',
    kolomTanah.includes('possessor_name') && !kolomTanah.some((n) => /^owner/i.test(n)),
    'yang membaca basis data tidak membaca dokumentasi',
  );

  const sertifikatTanpaNomor = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_parcel
         (village_unit_id, parcel_code, possessor_name, area_m2, certificate_status)
       VALUES ($1, 'TNH-X', 'Uji', 300, 'BERSERTIFIKAT')`,
      [unitId],
    ),
  );
  check('bidang bertanda bersertifikat tanpa nomornya ditolak', sertifikatTanpaNomor !== null);

  const bidang = await q(
    `INSERT INTO "${S}".village_land_parcel
       (village_unit_id, parcel_code, possessor_name, area_m2, letter_c_number)
     VALUES ($1, 'TNH-0142', 'Sumiati', 300, 'C.1284') RETURNING id`,
    [unitId],
  );
  const bidangId = bidang[0].id;

  const riwayatTanpaDasar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_history
         (village_unit_id, land_parcel_id, transfer_type, transferred_at, from_name, to_name,
          legal_basis)
       VALUES ($1, $2, 'JUAL_BELI', '2027-03-11', 'Karto', 'Sumiati', '   ')`,
      [unitId, bidangId],
    ),
  );
  check(
    'riwayat peralihan tanpa dasar ditolak',
    riwayatTanpaDasar !== null,
    'daftar nama yang berurutan tampak seperti bukti tetapi tidak membuktikan apa pun',
  );

  const pihakSama = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_history
         (village_unit_id, land_parcel_id, transfer_type, transferred_at, from_name, to_name,
          legal_basis)
       VALUES ($1, $2, 'WARIS', '2027-03-11', 'Karto', 'Karto', 'Surat Keterangan Waris 3/2027')`,
      [unitId, bidangId],
    ),
  );
  check('peralihan kepada diri sendiri ditolak', pihakSama !== null);

  await q(
    `INSERT INTO "${S}".village_land_history
       (village_unit_id, land_parcel_id, transfer_type, transferred_at, from_name, to_name,
        legal_basis)
     VALUES ($1, $2, 'JUAL_BELI', '2027-03-11', 'Karto', 'Sumiati', 'Akta Jual Beli Nomor 14/2027')`,
    [unitId, bidangId],
  );
  check('peralihan yang berdasar tercatat', true);

  // --- 7. Persetujuan batas -------------------------------------------------
  log('');
  log('7. Persetujuan batas');
  for (const sisi of ['UTARA', 'SELATAN', 'TIMUR', 'BARAT']) {
    await q(
      `INSERT INTO "${S}".village_land_boundary_consent
         (village_unit_id, land_parcel_id, side, neighbour_name, consented, consented_at)
       VALUES ($1, $2, $3, $4, TRUE, CURRENT_DATE)`,
      [unitId, bidangId, sisi, `Tetangga ${sisi}`],
    );
  }
  const sisiKembar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_boundary_consent
         (village_unit_id, land_parcel_id, side, neighbour_name)
       VALUES ($1, $2, 'UTARA', 'Tetangga Lain')`,
      [unitId, bidangId],
    ),
  );
  check('satu sisi hanya punya satu persetujuan', sisiKembar !== null);

  const setujuTanpaTanggal = await ditolak(() =>
    q(
      `UPDATE "${S}".village_land_boundary_consent
          SET consented = TRUE, consented_at = NULL
        WHERE land_parcel_id = $1 AND side = 'UTARA'`,
      [bidangId],
    ),
  );
  check('persetujuan tanpa tanggal ditolak', setujuTanpaTanggal !== null);

  // --- 8. Surat keterangan tanah — INTI D-9 ---------------------------------
  log('');
  log('8. Surat keterangan tanah wajib memuat penyangkalannya');
  const badanPolos = 'Menerangkan bahwa tanah seluas 300 m2 dikuasai oleh Sumiati.';

  const tanpaPenyangkalan = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_statement
         (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
          certificate_status_at_issue, neighbour_count, consent_count, body_text)
       VALUES ($1, $2, 'SKT-01', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 4, $3)`,
      [unitId, bidangId, badanPolos],
    ),
  );
  check(
    'surat tanpa penyangkalan DITOLAK basis data',
    tanpaPenyangkalan !== null,
    'diperiksa pada teks yang akan tercetak, bukan pada templat',
  );

  const setengah = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_statement
         (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
          certificate_status_at_issue, neighbour_count, consent_count, body_text)
       VALUES ($1, $2, 'SKT-01', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 4, $3)`,
      [unitId, bidangId, `${badanPolos} Surat ini bukan bukti kepemilikan.`],
    ),
  );
  check(
    'surat yang penyangkalannya setengah ditolak',
    setengah !== null,
    'frasa "tidak menggantikan sertifikat" belum ada',
  );

  const persetujuanKurang = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_statement
         (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
          certificate_status_at_issue, neighbour_count, consent_count, body_text)
       VALUES ($1, $2, 'SKT-01', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 2, $3)`,
      [unitId, bidangId, `${badanPolos} ${PENYANGKALAN}`],
    ),
  );
  check(
    'surat dengan persetujuan batas yang belum lengkap ditolak',
    persetujuanKurang !== null,
    'memindahkan sengketa ke pengadilan dengan kertas resmi di tangan satu pihak',
  );

  const untukBersertifikat = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_statement
         (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
          certificate_status_at_issue, neighbour_count, consent_count, body_text)
       VALUES ($1, $2, 'SKT-01', CURRENT_DATE, 'Sumiati', 'BERSERTIFIKAT', 4, 4, $3)`,
      [unitId, bidangId, `${badanPolos} ${PENYANGKALAN}`],
    ),
  );
  check(
    'surat atas tanah BERSERTIFIKAT ditolak',
    untukBersertifikat !== null,
    'dua kertas atas satu bidang adalah cara sengketa dimulai',
  );

  const skt = await q(
    `INSERT INTO "${S}".village_land_statement
       (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
        certificate_status_at_issue, neighbour_count, consent_count, body_text)
     VALUES ($1, $2, 'SKT-01', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 4, $3)
     RETURNING id`,
    [unitId, bidangId, `${badanPolos} ${PENYANGKALAN}`],
  );
  check('surat yang lengkap terbit', skt.length === 1);

  const suratKedua = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_land_statement
         (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
          certificate_status_at_issue, neighbour_count, consent_count, body_text)
       VALUES ($1, $2, 'SKT-02', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 4, $3)`,
      [unitId, bidangId, `${badanPolos} ${PENYANGKALAN}`],
    ),
  );
  check(
    'satu bidang hanya punya satu surat yang berlaku',
    suratKedua !== null,
    'dua surat yang sama-sama berlaku tidak dapat dijelaskan kepada siapa pun',
  );

  const cabutTanpaAlasan = await ditolak(() =>
    q(`UPDATE "${S}".village_land_statement SET is_revoked = TRUE WHERE id = $1`, [skt[0].id]),
  );
  check('pencabutan surat tanpa alasan ditolak', cabutTanpaAlasan !== null);

  await q(
    `UPDATE "${S}".village_land_statement
        SET is_revoked = TRUE, revoked_at = now(), revoke_reason = 'Terbit atas permohonan yang keliru'
      WHERE id = $1`,
    [skt[0].id],
  );
  const suratBaru = await q(
    `INSERT INTO "${S}".village_land_statement
       (village_unit_id, land_parcel_id, statement_number, issued_at, possessor_name,
        certificate_status_at_issue, neighbour_count, consent_count, body_text)
     VALUES ($1, $2, 'SKT-02', CURRENT_DATE, 'Sumiati', 'BELUM_BERSERTIFIKAT', 4, 4, $3)
     RETURNING id`,
    [unitId, bidangId, `${badanPolos} ${PENYANGKALAN}`],
  );
  check('setelah yang lama dicabut, surat baru dapat terbit', suratBaru.length === 1);

  const menyunting = await ditolak(() =>
    q(`UPDATE "${S}".village_land_statement SET body_text = $2 WHERE id = $1`, [
      suratBaru[0].id,
      badanPolos,
    ]),
  );
  check(
    'penyangkalan tidak dapat dihapus dengan menyunting surat yang sudah terbit',
    menyunting !== null,
    'constraint berlaku pada setiap tulis, bukan hanya saat penerbitan',
  );

  // --- 9. Jejak audit -------------------------------------------------------
  log('');
  log('9. Jejak audit');
  const jejak = await q(
    `SELECT table_name, count(*)::int AS n FROM "${S}__audit".audit_log
      WHERE table_name LIKE 'village_land%' OR table_name LIKE 'village_incident'
        OR table_name LIKE 'village_disaster%' OR table_name LIKE 'village_relief%'
      GROUP BY table_name ORDER BY table_name`,
  );
  check(
    'perubahan pada tabel D-9 tercatat pada skema audit',
    jejak.length >= 5,
    jejak.map((r) => `${r.table_name}:${r.n}`).join(' '),
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
    new URL('../../../docs/info-desa/bukti-d9-keamanan-tanah.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
