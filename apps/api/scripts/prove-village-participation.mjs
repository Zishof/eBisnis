/**
 * Bukti D-5: pengaduan anonim benar-benar anonim.
 *
 * Pengaduan yang paling perlu didengar adalah pengaduan **tentang perangkat
 * desa itu sendiri**. Warga tidak akan menyampaikannya bila namanya terlihat
 * oleh orang yang ia adukan — yang tinggal di kampung yang sama dan akan terus
 * ia temui setiap hari.
 *
 * Karena itu yang dibuktikan di sini bukan "identitasnya disembunyikan",
 * melainkan **tidak ada identitas yang tersimpan untuk dibuka**:
 *
 * - basis data menolak baris anonim yang membawa identitas apa pun;
 * - pengaduan tidak diberi pemicu audit, sehingga tidak ada salinan identitas
 *   yang tertinggal di tabel audit;
 * - tidak ada kolom hash pelapor, sebab hash NIK dapat dicocokkan terhadap
 *   daftar warga dalam hitungan detik;
 * - aduan tentang aparatur tidak dapat ditugaskan kepada yang bersangkutan.
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
const S = `uji_d5_${tag}`;

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI D-5 — PENGADUAN ANONIM, ASPIRASI, DAN MUSRENBANG');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  await q(`CREATE SCHEMA "${S}"`);
  await q(`CREATE TABLE "${S}".schema_migration (
    version VARCHAR(16) PRIMARY KEY, name VARCHAR(160) NOT NULL,
    checksum VARCHAR(64) NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER NOT NULL DEFAULT 0)`);
  const manifest = JSON.parse(
    readFileSync(new URL('../tenant-migrations/village/manifest.village.json', import.meta.url), 'utf8'),
  );
  for (const m of manifest.migrations) {
    const sql = readFileSync(new URL(`../tenant-migrations/village/${m.file}`, import.meta.url), 'utf8');
    await q(sql.replace(/\{\{TENANT_SCHEMA\}\}/g, S));
  }

  const unit = await q(
    `INSERT INTO "${S}".village_unit (profile_type, code, name, slug)
     VALUES ('DESA', 'U1', 'Desa Uji', 'desa-uji-${tag}') RETURNING id`,
  );
  const unitId = unit[0].id;

  const pejabat = await q(
    `INSERT INTO "${S}".village_officer (village_unit_id, external_name, position_code, position_name)
     VALUES ($1, 'Kaur Umum', 'KAUR', 'Kaur Umum') RETURNING id`,
    [unitId],
  );
  const pejabatLain = await q(
    `INSERT INTO "${S}".village_officer (village_unit_id, external_name, position_code, position_name)
     VALUES ($1, 'Sekretaris Desa', 'SEKDES', 'Sekretaris Desa') RETURNING id`,
    [unitId],
  );

  // --- 1. Anonimitas ditegakkan basis data ---------------------------------
  log('');
  log('1. Baris anonim tidak dapat membawa identitas apa pun');

  const medan = [
    ['reporter_name', `'Ahmad Fauzi'`],
    ['reporter_phone', `'081234567890'`],
    ['reporter_user_id', `'${randomUUID()}'::uuid`],
  ];
  for (const [kolom, nilai] of medan) {
    let ditolak = false;
    try {
      await q(
        `INSERT INTO "${S}".village_complaint
           (village_unit_id, ticket_number, reporter_mode, tracking_token, title, description, ${kolom})
         VALUES ($1, 'ADU-X-${kolom}', 'ANONIM', $2, 'Uji', 'Uji anonimitas', ${nilai})`,
        [unitId, randomBytes(16).toString('base64url')],
      );
    } catch {
      ditolak = true;
    }
    check(`aduan anonim dengan ${kolom} DITOLAK`, ditolak);
  }

  const anonim = await q(
    `INSERT INTO "${S}".village_complaint
       (village_unit_id, ticket_number, reporter_mode, tracking_token, title, description,
        concerns_officer_id)
     VALUES ($1, 'ADU-2026-00001', 'ANONIM', $2, 'Dugaan pungutan liar',
             'Ada permintaan uang di luar ketentuan saat mengurus surat.', $3)
     RETURNING id, tracking_token`,
    [unitId, randomBytes(16).toString('base64url'), pejabat[0].id],
  );
  check('aduan anonim tanpa identitas diterima', anonim.length === 1);

  const isi = await q(
    `SELECT reporter_resident_id, reporter_user_id, reporter_name, reporter_phone
       FROM "${S}".village_complaint WHERE id = $1`,
    [anonim[0].id],
  );
  check(
    'seluruh medan identitas benar-benar kosong',
    Object.values(isi[0]).every((v) => v === null),
    JSON.stringify(isi[0]),
  );

  // --- 2. Tidak ada kolom hash pelapor -------------------------------------
  log('');
  log('2. Tidak ada kolom hash pelapor');
  const kolomAduan = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'village_complaint'`,
    [S],
  );
  const namaKolom = kolomAduan.map((k) => k.column_name);
  check(
    'tidak ada kolom hash/fingerprint pelapor',
    !namaKolom.some((k) => /hash|fingerprint|digest/i.test(k)),
    'hash NIK dapat dicocokkan terhadap daftar warga dalam hitungan detik',
  );

  // --- 3. Tidak ada pemicu audit pada pengaduan ---------------------------
  log('');
  log('3. Pengaduan tidak diberi pemicu audit baris');
  const pemicu = await q(
    `SELECT trigger_name FROM information_schema.triggers
      WHERE trigger_schema = $1 AND event_object_table = 'village_complaint'`,
    [S],
  );
  check(
    'village_complaint TIDAK punya pemicu audit',
    pemicu.length === 0,
    'pemicu menyalin nilai lama-baru termasuk identitas; anonimitas yang bocor lewat audit tetaplah bocor',
  );
  /*
   * Skema uji ini hanya memuat migrasi village, tanpa infrastruktur audit dari
   * V008. Pemasangan pemicu karena itu dilewati dengan sendirinya — dan itulah
   * perilaku yang benar.
   *
   * Yang dibuktikan di sini bukan bahwa pemicunya terpasang, melainkan bahwa
   * pengecualian village_complaint bersifat DISENGAJA dan bukan kebetulan:
   * daftar pengecualian pada migrasi 20260731000007 menyebutnya secara harfiah.
   */
  const naskah = readFileSync(
    new URL('../tenant-migrations/village/20260731000007__village__install_audit_triggers.sql', import.meta.url),
    'utf8',
  );
  check(
    'village_complaint disebut sebagai pengecualian audit yang disengaja',
    /dikecualikan TEXT\[\][\s\S]*?'village_complaint'/.test(naskah),
  );
  /*
   * Naskah diperiksa TANPA barisan komentarnya. Komentar migrasi itu justru
   * mengutip nama yang salah untuk menerangkan kekeliruannya, dan memeriksa
   * naskah utuh akan menuduh dokumentasi sebagai cacat.
   */
  const kode = naskah
    .split(/\r?\n/)
    .filter((baris) => !baris.trimStart().startsWith('--'))
    .join(' ');

  check(
    'pemasangan memakai nama fungsi yang benar',
    kode.includes('audit_row_trigger()'),
    'fungsi audit sesungguhnya bernama audit_row_trigger, bukan fn_audit_row_change',
  );
  check(
    'tidak ada lagi penjaga yang mencari nama yang salah',
    !kode.includes('fn_audit_row_change'),
    'penjaga IF EXISTS terhadap nama yang salah membuat kekeliruannya senyap',
  );
  check(
    'tabel village lain TIDAK dikecualikan',
    !/dikecualikan TEXT\[\][\s\S]*?'village_musrenbang'/.test(naskah),
  );

  // --- 4. Aduan tentang aparatur -------------------------------------------
  log('');
  log('4. Aduan tentang aparatur tidak dapat ditugaskan kepadanya');
  let ditugaskanKeTerlapor = false;
  try {
    await q(
      `UPDATE "${S}".village_complaint SET assigned_officer_id = $2 WHERE id = $1`,
      [anonim[0].id, pejabat[0].id],
    );
  } catch {
    ditugaskanKeTerlapor = true;
  }
  check(
    'penugasan kepada yang diadukan DITOLAK',
    ditugaskanKeTerlapor,
    'menugaskan aduan kepada terlapor sama dengan menutupnya',
  );

  await q(`UPDATE "${S}".village_complaint SET assigned_officer_id = $2 WHERE id = $1`, [
    anonim[0].id,
    pejabatLain[0].id,
  ]);
  check('penugasan kepada petugas lain diterima', true);

  // --- 5. Penutupan wajib beralasan ----------------------------------------
  log('');
  log('5. Penutupan dan penghentian wajib beralasan');
  for (const st of ['DITUTUP', 'BUKAN_KEWENANGAN']) {
    let tanpaAlasan = false;
    try {
      await q(`UPDATE "${S}".village_complaint SET status = $2 WHERE id = $1`, [anonim[0].id, st]);
    } catch {
      tanpaAlasan = true;
    }
    check(`status ${st} tanpa alasan ditolak`, tanpaAlasan);
  }
  await q(
    `UPDATE "${S}".village_complaint
        SET status = 'DITUTUP', close_reason = 'Tidak ditemukan bukti pendukung setelah peninjauan.'
      WHERE id = $1`,
    [anonim[0].id],
  );
  check('penutupan beralasan diterima', true);

  // --- 6. Pelacakan tanpa identitas ----------------------------------------
  log('');
  log('6. Pelapor anonim melacak lewat kode, bukan lewat identitas');
  const lacak = await q(
    `SELECT ticket_number, status, close_reason FROM "${S}".village_complaint
      WHERE tracking_token = $1`,
    [anonim[0].tracking_token],
  );
  check('kode pelacakan menemukan aduannya', lacak.length === 1);
  check('pelapor dapat membaca alasan penutupan', Boolean(lacak[0].close_reason));

  const kodeSalah = await q(
    `SELECT 1 FROM "${S}".village_complaint WHERE tracking_token = 'kode-palsu'`,
  );
  check('kode palsu tidak menemukan apa pun', kodeSalah.length === 0);

  // --- 7. Aspirasi anonim ---------------------------------------------------
  log('');
  log('7. Aspirasi anonim');
  let aspirasiBocor = false;
  try {
    await q(
      `INSERT INTO "${S}".village_aspiration
         (village_unit_id, reporter_mode, reporter_name, title, description)
       VALUES ($1, 'ANONIM', 'Budi', 'Usul', 'Usul jalan')`,
      [unitId],
    );
  } catch {
    aspirasiBocor = true;
  }
  check('aspirasi anonim dengan nama DITOLAK', aspirasiBocor);

  // --- 8. Musrenbang --------------------------------------------------------
  log('');
  log('8. Musrenbang: kuorum dan pembagian pagu');
  const mus = await q(
    `INSERT INTO "${S}".village_musrenbang
       (village_unit_id, forum_type, fiscal_year, title, quorum_minimum, budget_ceiling)
     VALUES ($1, 'MUSDES', 2027, 'Musrenbang Desa 2027', 30, 100000000) RETURNING id`,
    [unitId],
  );

  let forumKembar = false;
  try {
    await q(
      `INSERT INTO "${S}".village_musrenbang (village_unit_id, forum_type, fiscal_year, title)
       VALUES ($1, 'MUSDES', 2027, 'Duplikat')`,
      [unitId],
    );
  } catch {
    forumKembar = true;
  }
  check('satu forum per jenis per tahun anggaran', forumKembar);

  const usulan = [
    ['Jembatan Dusun Krajan', 60000000, 300, 5],
    ['Perbaikan drainase', 30000000, 120, 4],
    ['Lampu jalan', 40000000, 80, 3],
  ];
  for (const [judul, biaya, manfaat, skor] of usulan) {
    await q(
      `INSERT INTO "${S}".village_proposal
         (village_unit_id, musrenbang_id, title, estimated_cost, beneficiary_count, priority_score)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [unitId, mus[0].id, judul, biaya, manfaat, skor],
    );
  }

  let skorSalah = false;
  try {
    await q(
      `INSERT INTO "${S}".village_proposal
         (village_unit_id, musrenbang_id, title, priority_score)
       VALUES ($1, $2, 'Skor di luar rentang', 9)`,
      [unitId, mus[0].id],
    );
  } catch {
    skorSalah = true;
  }
  check('skor prioritas di luar 1-5 ditolak', skorSalah);

  let tolakTanpaAlasan = false;
  try {
    await q(
      `UPDATE "${S}".village_proposal SET status = 'DITOLAK'
        WHERE musrenbang_id = $1 AND title = 'Lampu jalan'`,
      [mus[0].id],
    );
  } catch {
    tolakTanpaAlasan = true;
  }
  check(
    'penolakan usulan tanpa alasan ditolak',
    tolakTanpaAlasan,
    'warga yang usulannya ditolak tanpa keterangan tidak akan mengusulkan lagi tahun depan',
  );

  // Pembagian pagu: 60jt + 30jt = 90jt masuk, 40jt tidak muat.
  await q(
    `UPDATE "${S}".village_proposal SET status = 'DISEPAKATI'
      WHERE musrenbang_id = $1 AND title IN ('Jembatan Dusun Krajan', 'Perbaikan drainase')`,
    [mus[0].id],
  );
  await q(
    `UPDATE "${S}".village_proposal
        SET status = 'DITUNDA',
            decision_note = 'Belum tertampung pagu tahun ini; dibahas kembali pada Musrenbang berikutnya.'
      WHERE musrenbang_id = $1 AND title = 'Lampu jalan'`,
    [mus[0].id],
  );
  const hasil = await q(
    `SELECT status, count(*)::int n FROM "${S}".village_proposal
      WHERE musrenbang_id = $1 GROUP BY status ORDER BY status`,
    [mus[0].id],
  );
  const peta = Object.fromEntries(hasil.map((h) => [h.status, h.n]));
  check('dua usulan disepakati sesuai pagu', peta.DISEPAKATI === 2);
  check(
    'usulan yang tidak tertampung DITUNDA, bukan ditolak',
    peta.DITUNDA === 1 && !peta.DITOLAK,
    'menolaknya menghapus jejak bahwa warga pernah mengusulkannya',
  );

  // --- 9. Kehadiran ---------------------------------------------------------
  log('');
  log('9. Kehadiran Musrenbang');
  const warga = await q(
    `INSERT INTO "${S}".village_resident (village_unit_id, full_name, normalized_name)
     VALUES ($1, 'Peserta Satu', 'PESERTA SATU') RETURNING id`,
    [unitId],
  );
  await q(
    `INSERT INTO "${S}".village_musrenbang_attendee (musrenbang_id, resident_id, attendee_name)
     VALUES ($1, $2, 'Peserta Satu')`,
    [mus[0].id, warga[0].id],
  );
  let hadirGanda = false;
  try {
    await q(
      `INSERT INTO "${S}".village_musrenbang_attendee (musrenbang_id, resident_id, attendee_name)
       VALUES ($1, $2, 'Peserta Satu')`,
      [mus[0].id, warga[0].id],
    );
  } catch {
    hadirGanda = true;
  }
  check('satu warga tidak tercatat hadir dua kali', hadirGanda);

  // --- 10. Penetap tercatat -------------------------------------------------
  log('');
  log('10. Penetap hasil tercatat');
  const penetap = randomUUID();
  await q(
    `UPDATE "${S}".village_musrenbang
        SET status = 'SELESAI', finalized_by = $2, finalized_at = now() WHERE id = $1`,
    [mus[0].id, penetap],
  );
  const tercatat = await q(
    `SELECT finalized_by IS NOT NULL AS ada FROM "${S}".village_musrenbang WHERE id = $1`,
    [mus[0].id],
  );
  check(
    'siapa yang menetapkan hasil tercatat',
    tercatat[0].ada === true,
    'pertanyaan "atas dasar apa usulan saya ditunda" menuntut nama',
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
  log('');
  log('Skema uji dibuang.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/info-desa/bukti-d5-partisipasi.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
