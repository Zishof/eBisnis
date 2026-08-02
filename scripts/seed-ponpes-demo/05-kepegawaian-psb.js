/**
 * Tahap 5 seed data demo -- absensi guru/piket, diniyah (kitab/halaqah),
 * tahfiz (setoran), dan PSB/PPDB (gelombang, calon santri, jadwal ujian).
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
const sample = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i += 1) out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  return out;
};

const NAMA_DEPAN_L = ['Ahmad', 'Muhammad', 'Abdullah', 'Yusuf', 'Ibrahim', 'Umar', 'Ali', 'Hasan', 'Rizky', 'Fajar'];
const NAMA_DEPAN_P = ['Aisyah', 'Fatimah', 'Khadijah', 'Zainab', 'Maryam', 'Nur', 'Siti', 'Putri', 'Dewi', 'Salsabila'];
const NAMA_BELAKANG = ['Fauzi', 'Hidayat', 'Ramadhan', 'Setiawan', 'Wijaya', 'Hakim', 'Pratama', 'Anwar'];
const KOTA = ['Kediri', 'Jombang', 'Tasikmalaya', 'Cirebon', 'Pati', 'Kudus', 'Malang', 'Blitar'];
const namaOrang = (jk) => `${pick(jk === 'L' ? NAMA_DEPAN_L : NAMA_DEPAN_P)} ${pick(NAMA_BELAKANG)}`;

async function main() {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);
  console.log(`Tahap 5 batch ${BATCH} -> schema ${SCHEMA}`);

  const taRes = await client.query(`SELECT id, code FROM pesantren_tahun_ajaran WHERE status = 'ACTIVE' LIMIT 1`);
  const TAHUN_ID = taRes.rows[0].id;
  const TAHUN_CODE = taRes.rows[0].code;
  const adminRes = await client.query(
    `SELECT us.platform_user_id AS id FROM user_subject us
       JOIN user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN role r ON r.id = ura.role_id
      WHERE r.code = 'EPESANTREN_ADMIN' LIMIT 1`,
  );
  const ACTOR = adminRes.rows[0]?.id || null;

  const santriAktif = (await client.query(
    `SELECT id, nis FROM pesantren_santri WHERE deleted_at IS NULL AND status = 'AKTIF' ORDER BY nis`,
  )).rows;
  const guruRows = (await client.query(`SELECT id FROM pesantren_guru WHERE deleted_at IS NULL`)).rows;
  const unitRows = (await client.query(`SELECT id, code FROM pesantren_unit_pendidikan WHERE deleted_at IS NULL`)).rows;

  // -----------------------------------------------------------------------
  // 20. Absensi guru (10 hari terakhir) + piket
  // -----------------------------------------------------------------------
  let absensiGuruCount = 0;
  for (const g of guruRows) {
    for (let d = -10; d <= 0; d += 1) {
      const tanggal = dateStr(addDays(new Date(), d));
      const status = pickWeighted([['HADIR', 90], ['IZIN', 5], ['SAKIT', 4], ['ALPA', 1]]);
      try {
        await client.query(
          `INSERT INTO pesantren_absensi_guru (id, guru_id, tanggal, status, jam_masuk, jam_pulang, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
          [uuid(), g.id, tanggal, status, status === 'HADIR' ? '07:00' : null, status === 'HADIR' ? '15:00' : null, ACTOR],
        );
        absensiGuruCount += 1;
      } catch (e) { /* lewati */ }
    }
  }
  console.log('Absensi guru:', absensiGuruCount);

  let piketCount = 0;
  const jenisPiketList = ['PIKET_HARIAN', 'PIKET_MALAM', 'PIKET_GERBANG', 'PIKET_ASRAMA'];
  for (let d = -14; d <= 0; d += 1) {
    const tanggal = dateStr(addDays(new Date(), d));
    for (const jenis of sample(jenisPiketList, 2)) {
      const g = pick(guruRows);
      try {
        await client.query(
          `INSERT INTO pesantren_piket (id, guru_id, tanggal, jenis_piket, status, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$6)`,
          [uuid(), g.id, tanggal, jenis, d < 0 ? pickWeighted([['HADIR', 9], ['TIDAK_HADIR', 1]]) : 'DIJADWALKAN', ACTOR],
        );
        piketCount += 1;
      } catch (e) { /* lewati */ }
    }
  }
  console.log('Piket:', piketCount);

  // -----------------------------------------------------------------------
  // 21. Diniyah: kitab (20) + halaqah (50) + halaqah_santri
  // -----------------------------------------------------------------------
  const kitabDefs = [
    'Safinatun Najah', 'Fathul Qorib', 'Taqrib', 'Sullam Taufiq', 'Jurumiyah', 'Imrithi', 'Alfiyah Ibnu Malik',
    'Ta\'lim Muta\'allim', 'Bulughul Maram', 'Riyadhus Sholihin', 'Tafsir Jalalain', 'Aqidatul Awam', 'Kifayatul Awam',
    'Minhajul Qawim', 'Uqudullujain', 'Tijan Darori', 'Washoya', 'Akhlaqul Banin', 'Nurul Yaqin', 'Khulasoh Nurul Yaqin',
  ];
  const kitabList = [];
  for (const judul of kitabDefs) {
    const id = uuid();
    const code = `KTB-${judul.slice(0, 4).toUpperCase().replace(/[^A-Z]/g, '')}${randInt(10, 99)}`;
    await client.query(
      `INSERT INTO pesantren_kitab (id, code, judul, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,true,$4,$5,$5) ON CONFLICT DO NOTHING`,
      [id, code, judul, BATCH, ACTOR],
    );
    kitabList.push({ id, judul });
  }
  let halaqahCount = 0;
  const halaqahList = [];
  for (let i = 0; i < 50; i += 1) {
    const id = uuid();
    const kitab = pick(kitabList);
    const code = `HLQ-${String(i + 1).padStart(3, '0')}`;
    try {
      await client.query(
        `INSERT INTO pesantren_halaqah (id, code, nama, kitab_id, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$6)`,
        [id, code, `Halaqah ${kitab.judul} ${i + 1}`, kitab.id, BATCH, ACTOR],
      );
      halaqahList.push(id);
      halaqahCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Kitab:', kitabList.length, 'Halaqah:', halaqahCount);

  let halaqahSantriCount = 0;
  for (const s of sample(santriAktif, 600)) {
    const h = pick(halaqahList);
    try {
      await client.query(
        `INSERT INTO pesantren_halaqah_santri (id, halaqah_id, santri_id, tanggal_gabung, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$6)`,
        [uuid(), h, s.id, dateStr(addDays(new Date(), -randInt(30, 300))), BATCH, ACTOR],
      );
      halaqahSantriCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Halaqah santri:', halaqahSantriCount);

  // -----------------------------------------------------------------------
  // 22. Tahfiz setoran (400 sampel)
  // -----------------------------------------------------------------------
  let setoranCount = 0;
  for (let i = 0; i < 400; i += 1) {
    const s = pick(santriAktif);
    try {
      await client.query(
        `INSERT INTO pesantren_tahfiz_setoran (id, santri_id, tanggal, jenis, juz, predikat, penilai_id, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9,$9)`,
        [uuid(), s.id, dateStr(addDays(new Date(), -randInt(0, 180))), pick(['SETORAN', 'MURAJAAH']),
          randInt(1, 30), pick(['LANCAR', 'LANCAR', 'LANCAR', 'PERLU_LATIHAN', 'MENGULANG']), null, BATCH, ACTOR],
      );
      setoranCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Tahfiz setoran:', setoranCount);

  // -----------------------------------------------------------------------
  // 23. PSB: gelombang (2) + calon santri (300+) + jadwal ujian
  // -----------------------------------------------------------------------
  const unitFormal = unitRows.filter((u) => u.code === 'MTS-DEMO' || u.code === 'MA-DEMO');
  const gelombangDefs = [
    { kode: 'G1', nama: 'Gelombang 1', kuota: 200, biaya: 150000 },
    { kode: 'G2', nama: 'Gelombang 2', kuota: 150, biaya: 175000 },
  ];
  const gelombangList = [];
  for (const g of gelombangDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_psb_gelombang (id, tahun_ajaran_id, kode, nama, tanggal_buka, tanggal_tutup, kuota, biaya_pendaftaran, status, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'DIBUKA',true,$9,$10,$10) ON CONFLICT DO NOTHING`,
      [id, TAHUN_ID, g.kode, g.nama, dateStr(addDays(new Date(), -60)), dateStr(addDays(new Date(), 60)), g.kuota, g.biaya, BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id, kode FROM pesantren_psb_gelombang WHERE tahun_ajaran_id=$1 AND kode=$2`, [TAHUN_ID, g.kode]);
    gelombangList.push({ id: existing.rows[0].id, kode: g.kode });
  }

  let pendaftarCount = 0;
  let jadwalCount = 0;
  const statusFunnel = pickWeighted;
  let urut = { [gelombangList[0].id]: 0, [gelombangList[1].id]: 0 };
  for (let i = 0; i < 320; i += 1) {
    const g = pick(gelombangList);
    urut[g.id] += 1;
    const nomor = `PSB-${TAHUN_CODE}-${g.kode}-${String(urut[g.id]).padStart(5, '0')}`;
    const jk = Math.random() < 0.52 ? 'L' : 'P';
    const status = pickWeighted([
      ['TERDAFTAR', 15], ['VERIFIKASI', 10], ['DIJADWALKAN', 15], ['LULUS_SELEKSI', 10],
      ['TIDAK_LULUS', 10], ['DITERIMA', 20], ['DAFTAR_ULANG', 15], ['DIBATALKAN', 5],
    ]);
    const pendaftarId = uuid();
    try {
      await client.query(
        `INSERT INTO pesantren_psb_pendaftar
           (id, gelombang_id, nomor_pendaftaran, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, nama_orang_tua, no_hp_orang_tua, alamat, asal_sekolah, unit_pendidikan_tujuan_id, status, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true,$14,$15,$15)`,
        [pendaftarId, g.id, nomor, namaOrang(jk), jk, pick(KOTA),
          dateStr(new Date(Date.UTC(2013, randInt(0, 11), randInt(1, 28)))),
          `${jk === 'L' ? 'Bpk.' : 'Ibu'} ${namaOrang(jk === 'L' ? 'P' : 'L')}`, `08${randInt(1000000000, 1999999999)}`,
          `Jl. ${pick(NAMA_BELAKANG)} No. ${randInt(1, 99)}, ${pick(KOTA)}`,
          pick(['SDN 1', 'SDN 2', 'MI Nurul Huda', 'SD Islam Terpadu']), pick(unitFormal)?.id || null,
          status, BATCH, ACTOR],
      );
      pendaftarCount += 1;

      if (['DIJADWALKAN', 'LULUS_SELEKSI', 'TIDAK_LULUS', 'DITERIMA', 'DAFTAR_ULANG'].includes(status)) {
        const jadwalStatus = status === 'DIJADWALKAN' ? 'DIJADWALKAN' : 'SELESAI';
        await client.query(
          `INSERT INTO pesantren_psb_jadwal (id, pendaftar_id, jenis, tanggal, waktu_mulai, waktu_selesai, lokasi, penguji, status, nilai, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)`,
          [uuid(), pendaftarId, pick(['UJIAN_TULIS', 'TES_BACA_QURAN', 'WAWANCARA']),
            dateStr(addDays(new Date(), -randInt(0, 45))), '08:00', '09:00', 'Aula Pondok', 'Panitia PSB',
            jadwalStatus, jadwalStatus === 'SELESAI' ? randInt(50, 100) : null, ACTOR],
        );
        jadwalCount += 1;
      }
    } catch (e) { /* lewati */ }
  }
  console.log('Gelombang PSB:', gelombangList.length, 'Pendaftar:', pendaftarCount, 'Jadwal ujian:', jadwalCount);

  await client.end();
  console.log('\nTahap 5 selesai (absensi guru/piket, diniyah, tahfiz, PSB).');
  console.log('BATCH_ID_TAHAP5=' + BATCH);
}

main().catch((e) => {
  console.error('GAGAL:', e.message, e.stack);
  process.exit(1);
});
