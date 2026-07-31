/**
 * Bukti K-10: peran, hak akses, data contoh, dan AI.
 *
 * Yang dibuktikan berpusat pada satu sifat:
 *
 *   **Pembersihan data contoh tidak boleh menghapus apa pun yang bukan
 *   contoh — terutama peran dan hak akses.**
 *
 * Aturannya sudah diuji sebagai fungsi murni. Yang dibuktikan DI SINI berbeda:
 * bahwa pada basis data sungguhan, sebuah pembersihan yang dijalankan sungguhan
 * meninggalkan data acuan dan data sungguhan utuh — dan bahwa jumlahnya
 * dihitung, bukan diyakini.
 *
 * Data sungguhan sengaja diselipkan di antara data contoh, dengan kode yang
 * mirip, supaya penyaringnya benar-benar diuji dan bukan sekadar dijalankan.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  AWALAN_CONTOH,
  KELOMPOK_DATA_KOPERASI,
  barisBolehDihapus,
  bolehDibersihkan,
  rencanaPembersihan,
} from '../dist/modules/cooperative/cooperative-sample.js';
import {
  HAK_AKSES_KOPERASI,
  PERAN_KOPERASI,
  periksaKonflik,
} from '../dist/modules/cooperative/rbac/cooperative-rbac.catalog.js';
import { COOPERATIVE_AI_USE_CASES } from '../dist/modules/cooperative/ai/cooperative-ai.catalog.js';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');
const SCHEMA = process.env.COOPERATIVE_SCHEMA ?? 'demo';

const client = new pg.Client({ connectionString: url });
const lines = [];
const log = (t) => { lines.push(t); console.log(t); };

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI K-10 — PERAN, HAK AKSES, DATA CONTOH, DAN AI');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  // ------------------------------------------------------------------ RBAC
  log('');
  log('1. Katalog peran dan hak akses');

  check(`${HAK_AKSES_KOPERASI.length} hak akses tersusun`, HAK_AKSES_KOPERASI.length > 40);
  check(`${PERAN_KOPERASI.length} peran tersusun`, PERAN_KOPERASI.length >= 9);
  check(
    'tidak ada izin DELETE sama sekali',
    HAK_AKSES_KOPERASI.every((p) => !p.endsWith('.DELETE')),
  );

  let konflikDitemukan = 0;
  for (const peran of PERAN_KOPERASI) {
    if (!periksaKonflik(peran.permissions).ok) konflikDitemukan += 1;
  }
  check('tidak ada peran bawaan yang melanggar pemisahan wewenang', konflikDitemukan === 0);

  const peranAnggota = PERAN_KOPERASI.filter((p) => p.isMemberRole);
  check(
    'peran anggota hanya memuat izin portal',
    peranAnggota.every((p) => p.permissions.every((x) => x.startsWith('COOPERATIVE_PORTAL.'))),
  );
  check(
    'tidak ada peran petugas yang memegang izin portal',
    PERAN_KOPERASI.filter((p) => !p.isMemberRole).every(
      (p) => !p.permissions.some((x) => x.startsWith('COOPERATIVE_PORTAL.')),
    ),
  );

  // ------------------------------------------------------- Persiapan data
  log('');
  log('2. Data contoh dan data sungguhan disiapkan berdampingan');

  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti K10') RETURNING id`,
    [`K10_${tag}`.slice(0, 32)],
  );
  const KOP = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-10', $2, $3, 'DRAFT') RETURNING id`,
      [`K10-${tag}`.toUpperCase(), `bukti-k10-${tag}`, jenis[0].id],
    )
  )[0].id;

  let urut = 0;
  const buatAnggota = async (nomor, nama) => {
    urut += 1;
    const nik = `3271${tag.padEnd(6, '0')}${String(urut).padStart(6, '0')}`;
    const r = await q(
      `INSERT INTO "${SCHEMA}".cooperative_member
         (cooperative_id, member_number, full_name, status, activated_at, identity_number)
       VALUES ($1, $2, $3, 'ACTIVE', now(), $4) RETURNING id`,
      [KOP, nomor, nama, nik],
    );
    return r[0].id;
  };

  // Enam contoh…
  const idContoh = [];
  for (let i = 1; i <= 6; i += 1) {
    idContoh.push(await buatAnggota(`${AWALAN_CONTOH}ANG-${tag}-${i}`, `Anggota Contoh ${i}`));
  }

  /*
   * …dan empat SUNGGUHAN, dengan kode yang sengaja dibuat mirip. Penyaring
   * yang lemah akan ikut menghapus salah satunya, dan di situlah kerugiannya
   * terjadi tanpa ada yang menyadari.
   */
  const idSungguhan = [];
  for (const nomor of [
    `ANG-${tag}-1`,                       // tanpa awalan
    `TOKO-${AWALAN_CONTOH}RASA-${tag}`,   // memuat kata contoh di tengah
    `${AWALAN_CONTOH.toLowerCase()}ang-${tag}`, // awalan huruf kecil
    `KSP-2026-${tag}`,                    // kode biasa
  ]) {
    idSungguhan.push(await buatAnggota(nomor, `Anggota Sungguhan ${nomor}`));
  }

  check('6 anggota contoh dan 4 anggota sungguhan tersimpan', idContoh.length === 6 && idSungguhan.length === 4);

  // -------------------------------------------------- Pembersihan sungguhan
  log('');
  log('3. Pembersihan data contoh dijalankan sungguhan');

  const rencana = rencanaPembersihan();
  check(
    'rencana mempertahankan seluruh kelompok acuan',
    rencana.kelompokDipertahankan.length ===
      KELOMPOK_DATA_KOPERASI.filter((k) => k.sifat === 'REFERENCE').length,
  );
  check('rencana TIDAK memuat COOPERATIVE_RBAC', !rencana.kelompokDihapus.includes('COOPERATIVE_RBAC'));

  const sebelum = await q(
    `SELECT id, member_number FROM "${SCHEMA}".cooperative_member WHERE cooperative_id = $1`,
    [KOP],
  );
  check(`${sebelum.length} anggota sebelum pembersihan`, sebelum.length === 10);

  // Penyaringnya dipakai apa adanya — fungsi yang sama dengan yang diuji.
  const akanDihapus = sebelum.filter((r) => barisBolehDihapus(r.member_number));
  check('penyaring memilih tepat 6 baris', akanDihapus.length === 6, String(akanDihapus.length));

  await q(
    `DELETE FROM "${SCHEMA}".cooperative_member WHERE id = ANY($1::uuid[])`,
    [akanDihapus.map((r) => r.id)],
  );

  const sesudah = await q(
    `SELECT id, member_number FROM "${SCHEMA}".cooperative_member WHERE cooperative_id = $1`,
    [KOP],
  );
  check('4 anggota tersisa setelah pembersihan', sesudah.length === 4, String(sesudah.length));

  const tersisa = new Set(sesudah.map((r) => r.id));
  check(
    'SELURUH anggota sungguhan masih ada',
    idSungguhan.every((id) => tersisa.has(id)),
  );
  check(
    'seluruh anggota contoh benar-benar terhapus',
    idContoh.every((id) => !tersisa.has(id)),
  );
  check(
    'baris berkode "TOKO-CONTOH-RASA" TIDAK terhapus',
    sesudah.some((r) => r.member_number.startsWith('TOKO-')),
  );
  check(
    'baris berawalan huruf kecil "contoh-" TIDAK terhapus',
    sesudah.some((r) => r.member_number.startsWith(AWALAN_CONTOH.toLowerCase())),
  );

  // --------------------------------------------- Acuan tidak dapat dihapus
  log('');
  log('4. Data acuan menolak dibersihkan');

  for (const kelompok of KELOMPOK_DATA_KOPERASI.filter((k) => k.sifat === 'REFERENCE')) {
    const v = bolehDibersihkan(kelompok);
    check(`${kelompok.label} menolak dibersihkan`, v.allowed === false, v.code);
  }

  const jenisMasihAda = await q(
    `SELECT 1 FROM "${SCHEMA}".cooperative_type WHERE id = $1`,
    [jenis[0].id],
  );
  check('jenis koperasi tetap ada setelah pembersihan anggota', jenisMasihAda.length === 1);

  // ---------------------------------------------------------------- AI
  log('');
  log('5. Batas keperluan AI');

  check(
    `${COOPERATIVE_AI_USE_CASES.length} keperluan AI tersusun`,
    COOPERATIVE_AI_USE_CASES.length >= 8,
  );
  check(
    'setiap keluaran hanya draf, analisis, atau usulan',
    COOPERATIVE_AI_USE_CASES.every((u) =>
      ['DRAFT', 'ANALYSIS', 'RECOMMENDATION'].includes(u.outputKind),
    ),
  );
  check(
    'setiap keperluan hanya membaca',
    COOPERATIVE_AI_USE_CASES.every((u) => u.action === 'READ'),
  );
  check(
    'tidak satu pun menyimpan isi prompt',
    COOPERATIVE_AI_USE_CASES.every((u) => u.storeContent === false),
  );
  check(
    'setiap keperluan bersandar pada izin yang ada di katalog',
    COOPERATIVE_AI_USE_CASES.every((u) =>
      HAK_AKSES_KOPERASI.includes(`${u.menuCode}.${u.action}`),
    ),
  );
  check(
    'keperluan berisiko tinggi seluruhnya menuntut bukti',
    COOPERATIVE_AI_USE_CASES.filter((u) => u.riskClass === 'HIGH').every(
      (u) => u.requiresEvidence,
    ),
  );

  // ------------------------------------------ Notulen AI wajib diperiksa
  log('');
  log('6. Notulen yang disusun AI wajib melewati manusia — ditegakkan basis data');

  const rapat = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_number, meeting_type, title, scheduled_at, status)
     VALUES ($1, $2, 'RAT', 'RAT Bukti K-10', now(), 'CLOSED') RETURNING id`,
    [KOP, `RAT-${tag}`],
  );
  const pengesah = idSungguhan[0];

  let ditolak = false;
  try {
    await client.query('SAVEPOINT s');
    await client.query(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_minutes
         (meeting_id, content, drafted_by_ai, reviewed_by, status,
          approved_by_member_id, approved_at)
       VALUES ($1, 'Notulen susunan AI.', true, NULL, 'APPROVED', $2, now())`,
      [rapat[0].id, pengesah],
    );
    await client.query('RELEASE SAVEPOINT s');
  } catch {
    ditolak = true;
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check('notulen AI yang BELUM diperiksa manusia tidak dapat disahkan', ditolak);

  await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_minutes
       (meeting_id, content, drafted_by_ai, reviewed_by, reviewed_at, status,
        approved_by_member_id, approved_at)
     VALUES ($1, 'Notulen susunan AI.', true, $2, now(), 'APPROVED', $2, now())`,
    [rapat[0].id, pengesah],
  );
  check('notulen AI yang SUDAH diperiksa manusia dapat disahkan', true);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await client.query('ROLLBACK');
  log('');
  log('Seluruh perubahan digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-k10-rbac-sample-ai.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
