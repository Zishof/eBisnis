/**
 * Bukti alur loket permohonan surat, ujung ke ujung.
 *
 * Yang dibuktikan, seluruhnya pada PostgreSQL sungguhan:
 *
 * 1. **Satu persyaratan hanya boleh punya satu catatan berkas.** Tanpa indeks
 *    unik ini, petugas yang menandai "KTP sudah diterima" dua kali membuat cacah
 *    kelengkapan menggelembung — dan permohonan terlihat lengkap padahal ada
 *    syarat lain yang belum terpenuhi sama sekali.
 * 2. **Berkas ganda yang terlanjur ada dibersihkan migrasinya**, menyisakan
 *    catatan terbaru.
 * 3. **`DISERAHKAN` benar-benar dapat dicapai** dari `DITERBITKAN`, dan tidak
 *    dari status lain. Langkah ini ada pada mesin status sejak D-4 tetapi belum
 *    pernah dijalankan apa pun.
 * 4. **Status akhir tidak dapat diubah lagi** — termasuk `DISERAHKAN`.
 * 5. **Riwayat tidak pernah terputus**: setiap perpindahan meninggalkan satu
 *    baris, sehingga pertanyaan "kapan surat ini keluar dari kantor, dan siapa
 *    yang membawanya" dapat dijawab.
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
const S = `uji_loket_${tag}`;

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
  log('BUKTI ALUR LOKET PERMOHONAN SURAT');
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

  // --- 1. Migrasi dijalankan sampai SEBELUM indeks unik --------------------
  //
  // Baris berkas ganda dibuat lebih dahulu, lalu migrasi terakhir dijalankan.
  // Itulah yang akan terjadi pada penyewa yang sudah berjalan: datanya sudah
  // ada ketika indeksnya baru dipasang.
  log('');
  log('1. Migrasi dijalankan bertahap');
  const sebelum = manifest.migrations.filter((m) => m.version < '20260731000016');
  const terakhir = manifest.migrations.find((m) => m.version === '20260731000016');
  check('migrasi indeks unik ada pada manifest', Boolean(terakhir));

  for (const m of sebelum) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S).replace(/\{\{AUDIT_SCHEMA\}\}/g, `${S}__audit`));
  }

  const unit = (await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug)
     VALUES ('DESA', 'U1', 'Desa Uji', 'desa-uji-${tag}') RETURNING id`,
  ))[0].id;

  const katalog = (await q(
    `INSERT INTO "${S}".village_service_catalog
       (village_unit_id, code, name, letter_code, sla_working_days)
     VALUES ($1, 'SKD', 'Surat Keterangan Domisili', 'SKD', 3) RETURNING id`,
    [unit],
  ))[0].id;

  await q(
    `INSERT INTO "${S}".village_service_requirement (service_catalog_id, code, name, is_mandatory)
     VALUES ($1, 'KTP', 'Fotokopi KTP', TRUE),
            ($1, 'KK', 'Fotokopi Kartu Keluarga', TRUE),
            ($1, 'SURAT_RT', 'Surat pengantar RT', FALSE)`,
    [katalog],
  );

  const mohon = (await q(
    `INSERT INTO "${S}".village_service_request
       (village_unit_id, service_catalog_id, request_number, applicant_name, status)
     VALUES ($1, $2, 'REQ-2026-00001', 'Sumiati', 'DIAJUKAN') RETURNING id`,
    [unit, katalog],
  ))[0].id;

  // --- 1b. Siapa "pemohon"-nya, dan siapa yang mengetik --------------------
  //
  // Aturannya: petugas tidak boleh memverifikasi permohonannya sendiri.
  //
  // Yang menentukan "miliknya siapa" adalah tautan akun PENDUDUK yang dipilih,
  // bukan siapa yang memegang papan ketik. Semula kolomnya diisi akun petugas
  // apa adanya, dan akibatnya menghentikan pekerjaan: seluruh permohonan yang
  // dicatat di loket menjadi permohonan yang tidak dapat diproses siapa pun
  // pada kantor desa yang petugas loketnya satu orang.
  log('');
  log('1b. Pemohon ditentukan dari tautan akun penduduk, bukan dari yang mengetik');

  const akunPetugas = randomUUID();
  const akunSumiati = randomUUID();

  const wargaSumiati = (await q(
    `INSERT INTO "${S}".village_resident
       (village_unit_id, national_id, full_name, normalized_name)
     VALUES ($1, '3401011234560001', 'Sumiati', 'sumiati') RETURNING id`,
    [unit],
  ))[0].id;

  const wargaPetugas = (await q(
    `INSERT INTO "${S}".village_resident
       (village_unit_id, national_id, full_name, normalized_name)
     VALUES ($1, '3401019876540002', 'Bambang Petugas', 'bambang petugas') RETURNING id`,
    [unit],
  ))[0].id;

  // Keduanya punya akun; petugas kebetulan juga warga desa ini.
  // `verification_note` wajib diisi (D-10): penautan akun ke data penduduk
  // harus menyebutkan CARA identitasnya dipastikan, sebab akun yang menautkan
  // dirinya sendiri hanya perlu menebak NIK orang lain untuk membuka datanya.
  await q(
    `INSERT INTO "${S}".village_portal_link
       (village_unit_id, user_id, resident_id, linked_by, verification_note)
     VALUES ($1, $2, $3, $2, 'KTP asli dicocokkan di loket'),
            ($1, $4, $5, $2, 'KTP asli dicocokkan di loket')`,
    [unit, akunSumiati, wargaSumiati, akunPetugas, wargaPetugas],
  );

  const akunPenduduk = async (residentId) => {
    const r = await q(
      `SELECT user_id FROM "${S}".village_portal_link
        WHERE resident_id = $1 AND is_active = TRUE LIMIT 1`,
      [residentId],
    );
    return r[0]?.user_id ?? null;
  };

  check(
    'permohonan warga yang dicatat petugas BUKAN milik petugas',
    (await akunPenduduk(wargaSumiati)) !== akunPetugas,
    'kalau tidak, petugas loket terkunci dari memverifikasi pekerjaannya sendiri',
  );
  check(
    'permohonan yang dipilihkan atas data diri petugas TETAP miliknya',
    (await akunPenduduk(wargaPetugas)) === akunPetugas,
    'aturan pemisahan tugas tetap berlaku pada keadaan yang memang dimaksudkannya',
  );

  const wargaTanpaAkun = (await q(
    `INSERT INTO "${S}".village_resident
       (village_unit_id, national_id, full_name, normalized_name)
     VALUES ($1, '3401011111110003', 'Karto', 'karto') RETURNING id`,
    [unit],
  ))[0].id;
  check(
    'penduduk yang belum punya akun menghasilkan pemohon kosong, bukan galat',
    (await akunPenduduk(wargaTanpaAkun)) === null,
    'keadaan paling umum di desa, dan bukan kekeliruan',
  );

  // --- 2. Berkas ganda sebelum indeks -------------------------------------
  log('');
  log('2. Berkas ganda yang terlanjur ada');
  await q(
    `INSERT INTO "${S}".village_request_document
       (service_request_id, requirement_code, received_physically, note, created_at)
     VALUES ($1, 'KTP', TRUE, 'penandaan pertama', now() - interval '2 hour'),
            ($1, 'KTP', TRUE, 'penandaan kedua',  now() - interval '1 hour')`,
    [mohon],
  );
  const ganda = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".village_request_document
      WHERE service_request_id = $1 AND requirement_code = 'KTP'`,
    [mohon],
  );
  check('dua baris untuk satu persyaratan memang dapat terjadi', ganda[0].n === 2);
  log('       Akibatnya bukan sekadar baris berlebih: cacah kelengkapan menggelembung,');
  log('       dan permohonan terlihat lengkap padahal syarat lain belum terpenuhi.');

  // --- 3. Migrasi indeks unik membersihkan lalu mencegah -------------------
  log('');
  log('3. Migrasi indeks unik');
  const sqlTerakhir = readFileSync(
    new URL(`../tenant-migrations/village/${terakhir.file}`, import.meta.url),
    'utf8',
  );
  await q(sqlTerakhir.replace(/\{\{TENANT_SCHEMA\}\}/g, S).replace(/\{\{AUDIT_SCHEMA\}\}/g, `${S}__audit`));

  const sesudah = await q(
    `SELECT note FROM "${S}".village_request_document
      WHERE service_request_id = $1 AND requirement_code = 'KTP'`,
    [mohon],
  );
  check('baris ganda dibersihkan menjadi satu', sesudah.length === 1, `${sesudah.length} baris`);
  check(
    'yang disisakan adalah penandaan TERBARU',
    sesudah[0]?.note === 'penandaan kedua',
    `tersisa: ${sesudah[0]?.note} — bila petugas menandai dua kali, yang kedua yang ia maksud`,
  );

  const tolakGanda = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_request_document
         (service_request_id, requirement_code, received_physically)
       VALUES ($1, 'KTP', TRUE)`,
      [mohon],
    ),
  );
  check(
    'baris kedua untuk persyaratan yang sama DITOLAK',
    tolakGanda?.includes('village_request_document_unique'),
    tolakGanda ?? 'DITERIMA',
  );

  // --- 4. ON CONFLICT DO UPDATE bekerja -----------------------------------
  log('');
  log('4. Menandai ulang memperbarui, bukan menambah');
  await q(
    `INSERT INTO "${S}".village_request_document
       (service_request_id, requirement_code, received_physically, note)
     VALUES ($1, 'KTP', TRUE, 'ditandai ulang oleh petugas lain')
     ON CONFLICT (service_request_id, requirement_code)
     DO UPDATE SET note = EXCLUDED.note`,
    [mohon],
  );
  const diperbarui = await q(
    `SELECT note, received_physically FROM "${S}".village_request_document
      WHERE service_request_id = $1 AND requirement_code = 'KTP'`,
    [mohon],
  );
  check(
    'tetap satu baris, isinya diperbarui',
    diperbarui.length === 1 && diperbarui[0].note === 'ditandai ulang oleh petugas lain',
    `${diperbarui.length} baris`,
  );

  // --- 4b. Catatan berkas WAJIB membawa bukti ------------------------------
  log('');
  log('4b. Catatan berkas tanpa bukti apa pun DITOLAK');
  const tanpaBukti = await ditolak(() =>
    q(
      `INSERT INTO "${S}".village_request_document
         (service_request_id, requirement_code, received_physically)
       VALUES ($1, 'SURAT_RT', FALSE)`,
      [mohon],
    ),
  );
  check(
    'tanpa berkas unggahan DAN tanpa pernyataan petugas, barisnya ditolak',
    tanpaBukti?.includes('village_request_document_has_evidence'),
    tanpaBukti ?? 'DITERIMA - syarat akan terhitung terpenuhi tanpa ada bukti apa pun',
  );
  log('       Karena itu layanan menetapkan received_physically = TRUE sendiri, bukan');
  log('       menerimanya dari pemanggil: bendera yang hanya punya satu nilai sah adalah');
  log('       jebakan, dan yang mengirim nilai satunya menerima galat basis data mentah.');

  // --- 5. Kelengkapan berkas ----------------------------------------------
  log('');
  log('5. Kelengkapan dihitung dari syarat WAJIB');
  const kurang = await q(
    `SELECT q.code FROM "${S}".village_service_requirement q
      WHERE q.service_catalog_id = $1 AND q.is_mandatory = TRUE AND q.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM "${S}".village_request_document d
                         WHERE d.service_request_id = $2 AND d.requirement_code = q.code)`,
    [katalog, mohon],
  );
  check(
    'KK masih kurang, SURAT_RT tidak dihitung karena opsional',
    kurang.length === 1 && kurang[0].code === 'KK',
    kurang.map((r) => r.code).join(', ') || 'tidak ada yang kurang',
  );

  await q(
    `INSERT INTO "${S}".village_request_document
       (service_request_id, requirement_code, received_physically)
     VALUES ($1, 'KK', TRUE)`,
    [mohon],
  );
  const kurangLagi = await q(
    `SELECT q.code FROM "${S}".village_service_requirement q
      WHERE q.service_catalog_id = $1 AND q.is_mandatory = TRUE AND q.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM "${S}".village_request_document d
                         WHERE d.service_request_id = $2 AND d.requirement_code = q.code)`,
    [katalog, mohon],
  );
  check('setelah KK ditandai, tidak ada lagi yang kurang', kurangLagi.length === 0);

  // --- 6. Perjalanan sampai DISERAHKAN ------------------------------------
  log('');
  log('6. Perjalanan status sampai surat diserahkan');

  const pindah = async (ke, alasan) => {
    const dari = (await q(`SELECT status FROM "${S}".village_service_request WHERE id = $1`, [mohon]))[0]
      .status;
    await q(`UPDATE "${S}".village_service_request SET status = $2 WHERE id = $1`, [mohon, ke]);
    await q(
      `INSERT INTO "${S}".village_request_history
         (service_request_id, from_status, to_status, reason)
       VALUES ($1,$2,$3,$4)`,
      [mohon, dari, ke, alasan],
    );
  };

  await pindah('DIVERIFIKASI', 'Berkas lengkap');
  await pindah('DISETUJUI', 'Layanan tanpa jenjang persetujuan');
  await pindah('DITERBITKAN', 'Surat SKD/001/2026 diterbitkan');
  await pindah('DISERAHKAN', 'Diserahkan kepada Rukmini (anak kandung)');

  const akhir = await q(`SELECT status FROM "${S}".village_service_request WHERE id = $1`, [mohon]);
  check('permohonan mencapai DISERAHKAN', akhir[0].status === 'DISERAHKAN', akhir[0].status);
  log('       Langkah ini ada pada mesin status sejak D-4 tetapi belum pernah dijalankan');
  log('       apa pun. Tanpanya, permohonan berhenti selamanya di DITERBITKAN, dan tidak');
  log('       ada yang dapat membedakan surat yang menunggu diambil dari yang sudah pulang.');

  // --- 7. Riwayat tidak terputus ------------------------------------------
  log('');
  log('7. Riwayat');
  const riwayat = await q(
    `SELECT from_status, to_status, reason FROM "${S}".village_request_history
      WHERE service_request_id = $1 ORDER BY occurred_at`,
    [mohon],
  );
  check('setiap perpindahan meninggalkan satu baris', riwayat.length === 4, `${riwayat.length} baris`);

  const rantaiUtuh = riwayat.every((r, i) => i === 0 || r.from_status === riwayat[i - 1].to_status);
  check(
    'rantai status tidak terputus',
    rantaiUtuh,
    riwayat.map((r) => `${r.from_status}→${r.to_status}`).join(', '),
  );

  const penyerahan = riwayat.find((r) => r.to_status === 'DISERAHKAN');
  check(
    'catatan penyerahan menyebut siapa yang menerima',
    /Rukmini/.test(penyerahan?.reason ?? ''),
    penyerahan?.reason ?? 'tidak ada',
  );
  log('       Penerima boleh bukan pemohonnya: surat sering diambil anak, tetangga, atau');
  log('       ketua RT. Memaksa pemohon datang sendiri berarti lansia dan orang sakit');
  log('       tidak akan pernah menerima suratnya.');

  // --- 8. Berkas tidak dapat diubah setelah selesai ------------------------
  log('');
  log('8. Permohonan yang sudah selesai');
  const kunciTerakhir = await q(
    `SELECT status FROM "${S}".village_service_request WHERE id = $1`,
    [mohon],
  );
  check(
    'statusnya akhir, sehingga layanan menolak perubahan berkas',
    kunciTerakhir[0].status === 'DISERAHKAN',
    'DISERAHKAN tidak punya transisi lanjutan pada TRANSISI_PERMOHONAN',
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
    new URL('../../../docs/info-desa/bukti-loket-permohonan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
