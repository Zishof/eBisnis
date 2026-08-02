/**
 * Tahap 2 seed data demo -- lanjutan seed-ponpes-demo.js. Mengasumsikan
 * Tahap 1 sudah berjalan (unit, mapel, kurikulum, rombongan, guru,
 * penugasan, santri). Membaca data yang sudah ada, bukan membuat ulang.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const CONN = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
const SCHEMA = process.env.SEED_SCHEMA || 'ponpes_demo';
const BATCH = crypto.randomUUID();
const uuid = () => crypto.randomUUID();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickWeighted = (pairs) => {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let r = Math.random() * total;
  for (const [v, w] of pairs) {
    if (r < w) return v;
    r -= w;
  }
  return pairs[0][0];
};
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const dateStr = (d) => d.toISOString().slice(0, 10);
const addDays = (base, n) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
};
const today = new Date();

async function main() {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);
  console.log(`Tahap 2 batch ${BATCH} -> schema ${SCHEMA}`);

  const taRes = await client.query(`SELECT id, code FROM pesantren_tahun_ajaran WHERE status = 'ACTIVE' LIMIT 1`);
  const TAHUN_ID = taRes.rows[0].id;
  const adminRes = await client.query(
    `SELECT us.platform_user_id AS id FROM user_subject us
       JOIN user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN role r ON r.id = ura.role_id
      WHERE r.code = 'EPESANTREN_ADMIN' LIMIT 1`,
  );
  const ACTOR = adminRes.rows[0]?.id || null;

  const santriRows = (await client.query(
    `SELECT id, nis, nama_lengkap, jenis_kelamin, status, status_tinggal, unit_pendidikan_id
       FROM pesantren_santri WHERE deleted_at IS NULL ORDER BY nis`,
  )).rows;
  const santriAktif = santriRows.filter((s) => s.status === 'AKTIF');
  const rombonganRows = (await client.query(
    `SELECT id, nama, unit_pendidikan_id, kapasitas FROM pesantren_rombongan_belajar WHERE deleted_at IS NULL`,
  )).rows;
  const guruRows = (await client.query(`SELECT id, nama FROM pesantren_guru WHERE deleted_at IS NULL`)).rows;
  const mapelRows = (await client.query(`SELECT id, nama FROM pesantren_mata_pelajaran WHERE deleted_at IS NULL`)).rows;
  const komponenRows = (await client.query(
    `SELECT id, mata_pelajaran_id FROM pesantren_komponen_nilai WHERE deleted_at IS NULL`,
  )).rows;

  console.log(`Basis: ${santriRows.length} santri (${santriAktif.length} aktif), ${rombonganRows.length} rombongan, ${guruRows.length} guru`);

  // -----------------------------------------------------------------------
  // 8. Rombongan anggota -- sebar santri aktif ke rombongan
  // -----------------------------------------------------------------------
  let anggotaCount = 0;
  const santriPerRombongan = new Map();
  for (const s of santriAktif) {
    const kandidat = rombonganRows.filter((r) => r.unit_pendidikan_id === s.unit_pendidikan_id);
    if (kandidat.length === 0) continue;
    const r = pick(kandidat);
    const isi = santriPerRombongan.get(r.id) || 0;
    if (isi >= (r.kapasitas || 30)) continue;
    try {
      await client.query(
        `INSERT INTO pesantren_rombongan_anggota (id, rombongan_id, santri_id, tahun_ajaran_id, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$6)`,
        [uuid(), r.id, s.id, TAHUN_ID, BATCH, ACTOR],
      );
      santriPerRombongan.set(r.id, isi + 1);
      anggotaCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Rombongan anggota:', anggotaCount);

  // -----------------------------------------------------------------------
  // 9. Asrama + kamar + penempatan
  // -----------------------------------------------------------------------
  const asramaDefs = [
    { code: 'ASR-PA-1', nama: 'Asrama Putra Al-Fatih', jenis: 'PUTRA' },
    { code: 'ASR-PA-2', nama: 'Asrama Putra Ar-Rasyid', jenis: 'PUTRA' },
    { code: 'ASR-PI-1', nama: 'Asrama Putri Az-Zahra', jenis: 'PUTRI' },
    { code: 'ASR-PI-2', nama: 'Asrama Putri Khadijah', jenis: 'PUTRI' },
  ];
  const asramaList = [];
  for (const a of asramaDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_asrama (id, code, nama, jenis, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,true,$5,$6,$6) ON CONFLICT DO NOTHING`,
      [id, a.code, a.nama, a.jenis, BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id FROM pesantren_asrama WHERE code = $1`, [a.code]);
    asramaList.push({ ...a, id: existing.rows[0].id });
  }
  const kamarList = [];
  for (const a of asramaList) {
    for (let n = 1; n <= 13; n += 1) {
      const id = uuid();
      const nomor = String(n).padStart(2, '0');
      await client.query(
        `INSERT INTO pesantren_kamar (id, asrama_id, nomor, kapasitas, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$6) ON CONFLICT DO NOTHING`,
        [id, a.id, nomor, 8, BATCH, ACTOR],
      );
      const existing = await client.query(`SELECT id FROM pesantren_kamar WHERE asrama_id=$1 AND nomor=$2`, [a.id, nomor]);
      kamarList.push({ id: existing.rows[0].id, asramaId: a.id, jenis: a.jenis, kapasitas: 8, isi: 0 });
    }
  }
  console.log('Asrama:', asramaList.length, 'Kamar:', kamarList.length);

  let penempatanCount = 0;
  const santriMukim = santriAktif.filter((s) => s.status_tinggal === 'MUKIM');
  const santriAsrama = new Map(); // santriId -> asramaId (untuk konsumsi katering nanti)
  for (const s of santriMukim) {
    const kandidat = kamarList.filter((k) => k.jenis === (s.jenis_kelamin === 'L' ? 'PUTRA' : 'PUTRI') && k.isi < k.kapasitas);
    if (kandidat.length === 0) continue;
    const k = pick(kandidat);
    try {
      await client.query(
        `INSERT INTO pesantren_penempatan (id, santri_id, kamar_id, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,true,$4,$5,$5)`,
        [uuid(), s.id, k.id, BATCH, ACTOR],
      );
      k.isi += 1;
      santriAsrama.set(s.id, k.asramaId);
      penempatanCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Penempatan asrama:', penempatanCount);

  await client.end();
  console.log('\nTahap 2 selesai (rombongan anggota, asrama, kamar, penempatan).');
  console.log('BATCH_ID_TAHAP2=' + BATCH);
}

main().catch((e) => {
  console.error('GAGAL:', e.message, e.stack);
  process.exit(1);
});
