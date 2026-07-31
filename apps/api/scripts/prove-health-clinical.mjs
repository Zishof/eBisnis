/**
 * Bukti H-3: dokumentasi klinis yang tidak dapat disunting diam-diam.
 *
 * Yang dibuktikan di sini tidak dapat diuji dengan pengujian unit, karena
 * penegakannya ada di **basis data**, bukan di layanan. Layanan dapat dilewati
 * — lewat jalan kedua, lewat naskah pemeliharaan, lewat konsol basis data.
 * Pemicu tidak.
 *
 * Enam hal yang harus benar:
 *
 * 1. Catatan klinis yang sudah ditandatangani tidak dapat diubah isinya.
 * 2. Catatan yang sudah ditandatangani tidak dapat dihapus.
 * 3. Amandemen dapat dibuat, dan catatan aslinya tetap terbaca.
 * 4. Tanda vital yang mustahil ditolak, yang tidak normal tetapi mungkin diterima.
 * 5. Satu kunjungan hanya punya satu diagnosis utama.
 * 6. Jejak pembacaan rekam medis tidak dapat diubah maupun dihapus.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

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

const q = async (sql, params = []) => (await client.query(sql, params)).rows;

/** Menjalankan sesuatu yang SEHARUSNYA gagal. */
async function harusGagal(label, sql, params = [], petunjuk = null) {
  try {
    await q(sql, params);
    check(label, false, 'justru berhasil — penjaganya tidak bekerja');
  } catch (e) {
    const pesan = String(e.message ?? '');
    const cocok = petunjuk ? pesan.includes(petunjuk) : true;
    check(label, cocok, cocok ? '' : `ditolak, tetapi pesannya lain: ${pesan.slice(0, 120)}`);
  }
}

const tag = randomBytes(4).toString('hex');
let patientId = null;
let facilityId = null;
let encounterId = null;
let typeId = null;

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI H-3 — DOKUMENTASI KLINIS YANG TIDAK DAPAT DISUNTING DIAM-DIAM');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  // --- Persiapan -----------------------------------------------------------
  typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category, supports_inpatient)
       VALUES ($1, 'Klinik Bukti', 'CLINIC', FALSE) RETURNING id`,
      [`BUKTI-${tag}`],
    )
  )[0].id;

  facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name)
       VALUES ($1, $2, 'Klinik Bukti Klinis') RETURNING id`,
      [typeId, `FAC-${tag}`],
    )
  )[0].id;

  patientId = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($1, 'Pasien Bukti', '1985-03-15', 'FEMALE') RETURNING id`,
      [`EP-${tag}`],
    )
  )[0].id;

  encounterId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_encounter
         (patient_id, facility_id, encounter_number, encounter_type)
       VALUES ($1, $2, $3, 'OUTPATIENT') RETURNING id`,
      [patientId, facilityId, `ENC-${tag}`],
    )
  )[0].id;

  log('');
  log('Disiapkan: satu klinik, satu pasien, satu kunjungan.');

  // --- 1. Catatan yang belum ditandatangani MASIH boleh disunting -----------
  log('');
  log('1. Catatan yang belum ditandatangani');
  const draf = (
    await q(
      `INSERT INTO "${SCHEMA}".clinical_note
         (encounter_id, patient_id, note_type, subjective, assessment)
       VALUES ($1, $2, 'SOAP', 'Nyeri kepala tiga hari.', 'Tension headache') RETURNING id`,
      [encounterId, patientId],
    )
  )[0].id;

  await q(
    `UPDATE "${SCHEMA}".clinical_note SET subjective = $2 WHERE id = $1`,
    [draf, 'Nyeri kepala empat hari.'],
  );
  const setelahSunting = await q(
    `SELECT subjective FROM "${SCHEMA}".clinical_note WHERE id = $1`,
    [draf],
  );
  check(
    'draf masih dapat disunting',
    setelahSunting[0].subjective === 'Nyeri kepala empat hari.',
  );

  // --- 2. Sesudah ditandatangani, isinya terkunci ---------------------------
  log('');
  log('2. Sesudah ditandatangani');
  await q(
    `UPDATE "${SCHEMA}".clinical_note
        SET signed_at = now(), signed_by = gen_random_uuid()
      WHERE id = $1`,
    [draf],
  );
  check('catatan dapat ditandatangani', true);

  await harusGagal(
    'mengubah bagian subjektif DITOLAK',
    `UPDATE "${SCHEMA}".clinical_note SET subjective = 'diubah diam-diam' WHERE id = $1`,
    [draf],
    'CLINICAL_NOTE_IMMUTABLE',
  );

  await harusGagal(
    'mengubah penilaian DITOLAK',
    `UPDATE "${SCHEMA}".clinical_note SET assessment = 'diagnosis lain' WHERE id = $1`,
    [draf],
    'CLINICAL_NOTE_IMMUTABLE',
  );

  await harusGagal(
    'memindahkan catatan ke pasien lain DITOLAK',
    `UPDATE "${SCHEMA}".clinical_note SET patient_id = gen_random_uuid() WHERE id = $1`,
    [draf],
    'CLINICAL_NOTE_IMMUTABLE',
  );

  await harusGagal(
    'memundurkan waktu tanda tangan DITOLAK',
    `UPDATE "${SCHEMA}".clinical_note SET signed_at = now() - interval '3 days' WHERE id = $1`,
    [draf],
    'CLINICAL_NOTE_IMMUTABLE',
  );

  await harusGagal(
    'menghapus catatan bertanda tangan DITOLAK',
    `DELETE FROM "${SCHEMA}".clinical_note WHERE id = $1`,
    [draf],
    'CLINICAL_NOTE_IMMUTABLE',
  );

  // --- 3. Amandemen --------------------------------------------------------
  log('');
  log('3. Amandemen');
  await harusGagal(
    'amandemen tanpa alasan DITOLAK',
    `INSERT INTO "${SCHEMA}".clinical_note
       (encounter_id, patient_id, note_type, assessment, amended_from_id)
     VALUES ($1, $2, 'SOAP', 'Migrain', $3)`,
    [encounterId, patientId, draf],
    'amendment_needs_reason',
  );

  const amandemen = (
    await q(
      `INSERT INTO "${SCHEMA}".clinical_note
         (encounter_id, patient_id, note_type, subjective, assessment,
          amended_from_id, amendment_reason)
       VALUES ($1, $2, 'SOAP', 'Nyeri kepala empat hari.', 'Migrain tanpa aura',
               $3, 'Koreksi diagnosis setelah hasil pemeriksaan lanjutan.')
       RETURNING id`,
      [encounterId, patientId, draf],
    )
  )[0].id;
  check('amandemen dapat dibuat', Boolean(amandemen));

  const asli = await q(
    `SELECT assessment, signed_at FROM "${SCHEMA}".clinical_note WHERE id = $1`,
    [draf],
  );
  check(
    'catatan asli TETAP terbaca dan tidak berubah',
    asli[0].assessment === 'Tension headache',
    `dapat "${asli[0].assessment}"`,
  );
  check('catatan asli tetap bertanda tangan', asli[0].signed_at !== null);

  const rantai = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".clinical_note WHERE amended_from_id = $1`,
    [draf],
  );
  check('amandemen menunjuk catatan yang digantikannya', rantai[0].n === 1);

  // --- 4. Tanda vital ------------------------------------------------------
  log('');
  log('4. Batas kewajaran tanda vital');

  const gawat = await q(
    `INSERT INTO "${SCHEMA}".vital_sign
       (patient_id, encounter_id, systolic_mmhg, diastolic_mmhg, pulse_bpm, temperature_c, spo2_percent)
     VALUES ($1, $2, 70, 40, 140, 39.8, 88) RETURNING id`,
    [patientId, encounterId],
  );
  check(
    'angka yang TIDAK NORMAL tetapi mungkin tetap diterima',
    gawat.length === 1,
    'pasien syok septik harus dapat dicatat',
  );

  await harusGagal(
    'suhu 450 derajat DITOLAK',
    `INSERT INTO "${SCHEMA}".vital_sign (patient_id, temperature_c) VALUES ($1, 450)`,
    [patientId],
    'temp_plausible',
  );

  await harusGagal(
    'tekanan darah terbalik DITOLAK',
    `INSERT INTO "${SCHEMA}".vital_sign (patient_id, systolic_mmhg, diastolic_mmhg)
     VALUES ($1, 60, 120)`,
    [patientId],
    'bp_ordered',
  );

  await harusGagal(
    'saturasi 150 persen DITOLAK',
    `INSERT INTO "${SCHEMA}".vital_sign (patient_id, spo2_percent) VALUES ($1, 150)`,
    [patientId],
    'spo2_plausible',
  );

  await harusGagal(
    'berat 900 kilogram DITOLAK',
    `INSERT INTO "${SCHEMA}".vital_sign (patient_id, weight_kg) VALUES ($1, 900)`,
    [patientId],
    'weight_plausible',
  );

  const bayi = await q(
    `INSERT INTO "${SCHEMA}".vital_sign (patient_id, weight_kg, height_cm, head_circum_cm)
     VALUES ($1, 3.2, 50, 35) RETURNING id`,
    [patientId],
  );
  check('berat bayi 3,2 kg diterima', bayi.length === 1);

  // --- 5. Diagnosis utama --------------------------------------------------
  log('');
  log('5. Satu kunjungan, satu diagnosis utama');
  await q(
    `INSERT INTO "${SCHEMA}".encounter_diagnosis
       (encounter_id, patient_id, code, description, diagnosis_role)
     VALUES ($1, $2, 'G43.0', 'Migrain tanpa aura', 'PRIMARY')`,
    [encounterId, patientId],
  );
  check('diagnosis utama pertama diterima', true);

  await harusGagal(
    'diagnosis utama KEDUA ditolak',
    `INSERT INTO "${SCHEMA}".encounter_diagnosis
       (encounter_id, patient_id, code, description, diagnosis_role)
     VALUES ($1, $2, 'I10', 'Hipertensi', 'PRIMARY')`,
    [encounterId, patientId],
    'ux_encounter_diagnosis_primary',
  );

  const sekunder = await q(
    `INSERT INTO "${SCHEMA}".encounter_diagnosis
       (encounter_id, patient_id, code, description, diagnosis_role)
     VALUES ($1, $2, 'I10', 'Hipertensi', 'SECONDARY') RETURNING id`,
    [encounterId, patientId],
  );
  check('diagnosis sekunder boleh lebih dari satu', sekunder.length === 1);

  // --- 6. Jejak pembacaan --------------------------------------------------
  log('');
  log('6. Jejak pembacaan rekam medis');

  await harusGagal(
    'break-glass tanpa alasan DITOLAK',
    `INSERT INTO "${SCHEMA}".health_access_log
       (patient_id, purpose_of_use, entity_type, break_glass)
     VALUES ($1, 'EMERGENCY', 'clinical_note', TRUE)`,
    [patientId],
    'breakglass_needs_reason',
  );

  const jejak = (
    await q(
      `INSERT INTO "${SCHEMA}".health_access_log
         (patient_id, facility_id, purpose_of_use, entity_type, entity_id,
          break_glass, break_glass_reason)
       VALUES ($1, $2, 'EMERGENCY', 'clinical_note', $3, TRUE,
               'Pasien tidak sadar di IGD, riwayat alergi diperlukan segera.')
       RETURNING id`,
      [patientId, facilityId, draf],
    )
  )[0].id;
  check('break-glass beralasan tercatat', Boolean(jejak));

  await harusGagal(
    'mengubah jejak pembacaan DITOLAK',
    `UPDATE "${SCHEMA}".health_access_log SET purpose_of_use = 'TREATMENT' WHERE id = $1`,
    [jejak],
    'LEDGER_IMMUTABLE',
  );

  await harusGagal(
    'menghapus jejak pembacaan DITOLAK',
    `DELETE FROM "${SCHEMA}".health_access_log WHERE id = $1`,
    [jejak],
    'LEDGER_IMMUTABLE',
  );

  // --- 7. Alergi tingkat pasien --------------------------------------------
  log('');
  log('7. Alergi melekat pada pasien, bukan pada kunjungan');
  await q(
    `INSERT INTO "${SCHEMA}".patient_allergy
       (patient_id, allergen_type, allergen_name, severity, certainty, reaction)
     VALUES ($1, 'DRUG', 'Amoksisilin', 'SEVERE', 'CONFIRMED', 'Angioedema')`,
    [patientId],
  );

  const kunjunganKedua = (
    await q(
      `INSERT INTO "${SCHEMA}".health_encounter
         (patient_id, facility_id, encounter_number, encounter_type)
       VALUES ($1, $2, $3, 'OUTPATIENT') RETURNING id`,
      [patientId, facilityId, `ENC2-${tag}`],
    )
  )[0].id;

  const alergiTerlihat = await q(
    `SELECT a.allergen_name, a.severity
       FROM "${SCHEMA}".patient_allergy a
       JOIN "${SCHEMA}".health_encounter e ON e.patient_id = a.patient_id
      WHERE e.id = $1 AND a.refuted_at IS NULL`,
    [kunjunganKedua],
  );
  check(
    'alergi yang dicatat pada kunjungan pertama terlihat pada kunjungan kedua',
    alergiTerlihat.length === 1 && alergiTerlihat[0].allergen_name === 'Amoksisilin',
    'inilah sebabnya alergi tidak diletakkan pada kunjungan',
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
  log(String(e.stack ?? '').split('\n').slice(1, 4).join('\n'));
} finally {
  try {
    if (patientId) {
      // Catatan bertanda tangan dan jejak pembacaan sengaja TIDAK dihapus di
      // sini — penjaganya menolak, dan itu memang perilaku yang benar. Yang
      // dibersihkan hanya yang memang boleh dibersihkan.
      await q(`DELETE FROM "${SCHEMA}".vital_sign WHERE patient_id = $1`, [patientId]);
      await q(`DELETE FROM "${SCHEMA}".encounter_diagnosis WHERE patient_id = $1`, [patientId]);
      await q(`DELETE FROM "${SCHEMA}".patient_allergy WHERE patient_id = $1`, [patientId]);
      await q(`DELETE FROM "${SCHEMA}".clinical_note WHERE patient_id = $1 AND signed_at IS NULL`, [
        patientId,
      ]);
      log('');
      log('Data sementara dibersihkan sebagian.');
      log('Catatan bertanda tangan dan jejak pembacaan sengaja ditinggalkan:');
      log('penjaganya menolak penghapusan, dan itulah yang baru saja dibuktikan.');
    }
  } catch (e) {
    log(`Peringatan pembersihan: ${e.message}`);
  }

  await client.end();
  writeFileSync(
    new URL('../../../docs/emedik/bukti-h3-klinis.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
