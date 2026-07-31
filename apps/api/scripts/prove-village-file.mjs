/**
 * Bukti foto bukti pengaduan — seluruhnya pada basis data sungguhan.
 *
 * Yang dibuktikan di sini adalah hal-hal yang **tidak dapat dibuktikan uji
 * satuan**: bahwa aturannya bertahan meskipun layanan dilewati sama sekali.
 * Setiap penyisipan di bawah dijalankan langsung ke PostgreSQL, tanpa NestJS,
 * tanpa satu baris pun kode layanan — persis seperti yang dilakukan jalur
 * impor, penyuntingan manual, dan kode yang ditulis orang lain tahun depan.
 *
 * 1. **Berkas yang metadatanya belum dibuang tidak dapat disimpan.**
 * 2. **Hanya JPEG dan PNG** — daftar izin, bukan daftar larangan.
 * 3. **Pembersihan tidak pernah memperbesar berkas.**
 * 4. **`village_complaint_evidence.file_object_id` akhirnya menunjuk sesuatu.**
 *    Sejak D-5 ia kolom UUID yang menggantung; nilai karangan diterima begitu
 *    saja, dan bukti sebuah pengaduan dapat menunjuk berkas yang tidak ada.
 * 5. **Berkas terhapus tidak meninggalkan bukti yang menunjuk ketiadaan.**
 * 6. **Satu berkas satu bukti** — kalau tidak, batas tiga foto dapat dilampaui
 *    dengan menautkan berkas yang sama berulang kali.
 * 7. **Tidak ada kolom `is_public` maupun `public_url`**, berbeda dari
 *    `MediaAsset` milik Core yang justru bawaannya publik.
 *
 * Pembuangan metadata itu sendiri dibuktikan `village-file.spec.ts`, yang
 * menyusun JPEG dan PNG sungguhan berisi koordinat GPS lalu memastikan
 * koordinat itu HILANG dari hasilnya — bukan sekadar memastikan fungsinya
 * berjalan tanpa galat.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
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

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(4).toString('hex');
const S = `uji_berkas_${tag}`;

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
  log('BUKTI FOTO BUKTI PENGADUAN');
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

  const aduan = await q(
    `INSERT INTO "${S}".village_complaint
       (village_unit_id, ticket_number, tracking_token, title, description, reporter_mode, status)
     VALUES ($1, 'ADU/2026/000001', $2, 'Sampah menumpuk',
             'Sampah menumpuk di ujung gang sejak pekan lalu.', 'TERBUKA', 'DITERIMA')
     RETURNING id`,
    [unitId, randomBytes(16).toString('hex')],
  );
  const aduanId = aduan[0].id;

  const simpan = (extra = {}) => {
    const nilai = {
      id: randomUUID(),
      village_unit_id: unitId,
      storage_key: `${S}/pengaduan/${aduanId}/${randomUUID()}.jpg`,
      original_name: 'foto.jpg',
      mime_type: 'image/jpeg',
      size_bytes: 120_000,
      metadata_stripped: true,
      original_size_bytes: 148_000,
      ...extra,
    };
    const kolom = Object.keys(nilai);
    const isi = Object.values(nilai);
    return q(
      `INSERT INTO "${S}".village_file_object (${kolom.join(', ')})
       VALUES (${kolom.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
      isi,
    );
  };

  // --- 1. Tabel terbentuk ---------------------------------------------------
  log('');
  log('1. Registri berkas');
  const ada = await q(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = 'village_file_object'`,
    [S],
  );
  check('village_file_object terbentuk', ada.length === 1);

  // --- 2. Metadata WAJIB sudah dibuang --------------------------------------
  log('');
  log('2. Berkas yang metadatanya belum dibuang TIDAK DAPAT disimpan');
  const pesan = await ditolak(() => simpan({ metadata_stripped: false }));
  check(
    'metadata_stripped = FALSE ditolak constraint',
    pesan?.includes('village_file_metadata_must_be_stripped'),
    pesan ?? 'DITERIMA — foto berkoordinat GPS dapat masuk lewat jalur mana pun',
  );
  log('       Alasannya: foto dari ponsel membawa koordinat tempat ia dipotret.');
  log('       Warga yang memotret rumah tetangganya melampirkan koordinat rumahnya');
  log('       sendiri tanpa menyadarinya — metadata tidak tampak di layar mana pun.');

  // --- 3. Daftar izin jenis berkas ------------------------------------------
  log('');
  log('3. Hanya JPEG dan PNG — daftar izin, bukan daftar larangan');
  for (const jenis of ['image/heic', 'image/svg+xml', 'application/pdf', 'text/html']) {
    const p = await ditolak(() => simpan({ mime_type: jenis }));
    check(`${jenis} ditolak`, p?.includes('village_file_mime_allowed'), p ?? 'DITERIMA');
  }
  const jpg = await simpan();
  const png = await simpan({ mime_type: 'image/png' });
  check('image/jpeg dan image/png diterima', jpg.length === 1 && png.length === 1);

  // --- 4. Ukuran ------------------------------------------------------------
  log('');
  log('4. Batas ukuran');
  const kosong = await ditolak(() => simpan({ size_bytes: 0 }));
  check('berkas nol bita ditolak', kosong?.includes('village_file_size_sane'), kosong ?? 'DITERIMA');
  const raksasa = await ditolak(() => simpan({ size_bytes: 8_388_609, original_size_bytes: null }));
  check(
    'berkas melebihi 8 MB ditolak',
    raksasa?.includes('village_file_size_sane'),
    raksasa ?? 'DITERIMA',
  );

  // --- 5. Pembersihan tidak memperbesar -------------------------------------
  log('');
  log('5. Pembersihan metadata tidak pernah memperbesar berkas');
  const tumbuh = await ditolak(() => simpan({ size_bytes: 200_000, original_size_bytes: 100_000 }));
  check(
    'ukuran akhir > ukuran awal ditolak',
    tumbuh?.includes('village_file_stripping_never_grows'),
    tumbuh ?? 'DITERIMA — angkanya tidak lagi dapat dipakai menunjukkan pembersihan terjadi',
  );

  // --- 6. Kolom yang SENGAJA tidak ada --------------------------------------
  log('');
  log('6. Kolom yang sengaja TIDAK ada');
  const kolom = (
    await q(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'village_file_object'`,
      [S],
    )
  ).map((r) => r.column_name);
  for (const dilarang of ['is_public', 'public_url', 'cdn_url', 'shared_link']) {
    check(`tidak ada kolom ${dilarang}`, !kolom.includes(dilarang));
  }
  log('       MediaAsset milik Core justru is_public bawaannya BENAR dan memiliki');
  log('       public_url. Foto pengaduan memperlihatkan rumah, wajah, pelat nomor,');
  log('       dan halaman orang — satu tautan tersalin ke grup percakapan sudah cukup.');

  // --- 7. Bukti pengaduan akhirnya menunjuk sesuatu -------------------------
  log('');
  log('7. village_complaint_evidence.file_object_id akhirnya menunjuk tabel nyata');
  const hantu = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_complaint_evidence (complaint_id, file_object_id)
       VALUES ($1, $2)`,
      [aduanId, randomUUID()],
    ),
  );
  check(
    'bukti yang menunjuk berkas tidak ada ditolak',
    hantu?.includes('village_complaint_evidence_file_fk'),
    hantu ?? 'DITERIMA — sejak D-5 kolom ini menggantung tanpa menunjuk apa pun',
  );

  await q(
    `INSERT INTO "${S}".village_complaint_evidence (complaint_id, file_object_id, caption)
     VALUES ($1, $2, 'Tumpukan di ujung gang')`,
    [aduanId, jpg[0].id],
  );
  const kembar = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_complaint_evidence (complaint_id, file_object_id)
       VALUES ($1, $2)`,
      [aduanId, jpg[0].id],
    ),
  );
  check(
    'satu berkas hanya dapat dilekatkan sekali',
    kembar?.includes('village_complaint_evidence_file_unique'),
    kembar ?? 'DITERIMA — batas tiga foto dapat dilampaui dengan berkas yang sama',
  );

  // --- 8. Berkas terhapus tidak menyisakan bukti menggantung ----------------
  log('');
  log('8. Berkas terhapus tidak meninggalkan bukti yang menunjuk ketiadaan');
  await q(`DELETE FROM "${S}".village_file_object WHERE id = $1`, [jpg[0].id]);
  const sisa = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".village_complaint_evidence WHERE file_object_id = $1`,
    [jpg[0].id],
  );
  check('baris buktinya ikut terhapus', sisa[0].n === 0, `tersisa ${sisa[0].n}`);

  // --- 9. Kunci penyimpanan unik --------------------------------------------
  log('');
  log('9. Kunci penyimpanan unik');
  const kunci = `${S}/pengaduan/${aduanId}/tabrakan.jpg`;
  await simpan({ storage_key: kunci });
  const tabrak = await ditolak(() => simpan({ storage_key: kunci }));
  check(
    'dua berkas tidak dapat berbagi kunci',
    tabrak?.includes('village_file_storage_key_unique'),
    tabrak ?? 'DITERIMA — unggahan kedua akan menimpa foto bukti pengaduan lain',
  );

  // --- 10. Audit ------------------------------------------------------------
  log('');
  log('10. Jejak audit');
  const pemicu = await q(
    `SELECT tgname FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = $1 AND c.relname = 'village_file_object' AND NOT t.tgisinternal`,
    [S],
  );
  check('village_file_object diaudit', pemicu.length > 0);
  const jejak = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}__audit".audit_log WHERE table_name = 'village_file_object'`,
  );
  check(
    'penyisipan dan penghapusan tercatat',
    jejak[0].n >= 2,
    `${jejak[0].n} baris — pertanyaan "siapa mengunggah foto ini" harus dapat dijawab`,
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
    new URL('../../../docs/info-desa/bukti-foto-pengaduan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
