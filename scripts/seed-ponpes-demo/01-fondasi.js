/**
 * Seed data demo besar untuk tenant ponpes_demo -- diminta langsung oleh
 * pengguna untuk keperluan demonstrasi (1000 santri, 100 guru, 50 mata
 * pelajaran, 50 rombongan belajar pada tahun ajaran berjalan, 50 halaqah,
 * dan seterusnya). Semua baris ditandai is_sample = true dan berbagi satu
 * sample_batch_id supaya dapat dibersihkan/diketahui asalnya kelak.
 *
 * Dijalankan lewat: node seed-ponpes-demo.js
 * Sasaran basis data diambil dari DATABASE_ADMIN_URL/DATABASE_URL env var.
 */
const { Client } = require('pg');
const crypto = require('crypto');

const CONN = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.error('DATABASE_ADMIN_URL atau DATABASE_URL wajib diisi.');
  process.exit(1);
}
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

const NAMA_DEPAN_L = ['Ahmad', 'Muhammad', 'Abdullah', 'Yusuf', 'Ibrahim', 'Umar', 'Ali', 'Hasan', 'Husein', 'Zaid',
  'Fahmi', 'Rizky', 'Fajar', 'Dimas', 'Rafi', 'Aditya', 'Bagus', 'Faisal', 'Hafiz', 'Iqbal',
  'Khalid', 'Luthfi', 'Miftah', 'Naufal', 'Rasyid', 'Sulaiman', 'Taufik', 'Wildan', 'Zain', 'Farhan'];
const NAMA_DEPAN_P = ['Aisyah', 'Fatimah', 'Khadijah', 'Zainab', 'Maryam', 'Hafshah', 'Ruqayyah', 'Salamah', 'Halimah', 'Amina',
  'Nur', 'Siti', 'Putri', 'Dewi', 'Wulan', 'Salsabila', 'Zahra', 'Azizah', 'Latifah', 'Rahma',
  'Yasmin', 'Hanifah', 'Kamila', 'Nabila', 'Qonita', 'Sabrina', 'Ulfa', 'Widya', 'Zulfa', 'Alya'];
const NAMA_BELAKANG = ['Fauzi', 'Hidayat', 'Ramadhan', 'Setiawan', 'Wijaya', 'Nugroho', 'Saputra', 'Firdaus', 'Maulana', 'Prasetyo',
  'Kurniawan', 'Santoso', 'Gunawan', 'Susanto', 'Rahman', 'Hakim', 'Syahputra', 'Al-Fatih', 'Az-Zahra', 'An-Nur',
  'Pratama', 'Wibowo', 'Handoko', 'Permana', 'Utomo', 'Suherman', 'Yulianto', 'Sutrisno', 'Purnomo', 'Anwar'];
const KOTA = ['Kediri', 'Jombang', 'Tasikmalaya', 'Cirebon', 'Pati', 'Kudus', 'Ponorogo', 'Sumenep', 'Bangkalan', 'Lamongan',
  'Malang', 'Blitar', 'Madiun', 'Ngawi', 'Pekalongan', 'Tegal', 'Purwokerto', 'Banyumas', 'Garut', 'Sukabumi'];

function namaSantri(jk) {
  const depan = jk === 'L' ? pick(NAMA_DEPAN_L) : pick(NAMA_DEPAN_P);
  return `${depan} ${pick(NAMA_BELAKANG)}`;
}

async function main() {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);

  console.log(`Seed batch ${BATCH} -> schema ${SCHEMA}`);

  // -----------------------------------------------------------------------
  // 0. Prasyarat: tahun ajaran berjalan, admin id untuk created_by
  // -----------------------------------------------------------------------
  const taRes = await client.query(`SELECT id, code FROM pesantren_tahun_ajaran WHERE status = 'ACTIVE' LIMIT 1`);
  if (!taRes.rows[0]) throw new Error('Tidak ada tahun ajaran ACTIVE. Jalankan migrasi/seed dasar dahulu.');
  const TAHUN_ID = taRes.rows[0].id;
  const TAHUN_CODE = taRes.rows[0].code;
  console.log('Tahun ajaran berjalan:', TAHUN_CODE, TAHUN_ID);

  const adminRes = await client.query(
    `SELECT us.platform_user_id AS id FROM user_subject us
       JOIN user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN role r ON r.id = ura.role_id
      WHERE r.code = 'EPESANTREN_ADMIN'
      LIMIT 1`,
  );
  const ACTOR = adminRes.rows[0]?.id || null;
  console.log('Actor (created_by):', ACTOR);

  // -----------------------------------------------------------------------
  // 1. Unit pendidikan (4)
  // -----------------------------------------------------------------------
  const unitDefs = [
    { code: 'MTS-DEMO', name: 'Madrasah Tsanawiyah', jenis: 'SEKOLAH_FORMAL', tingkat: ['VII', 'VIII', 'IX'] },
    { code: 'MA-DEMO', name: 'Madrasah Aliyah', jenis: 'SEKOLAH_FORMAL', tingkat: ['X', 'XI', 'XII'] },
    { code: 'DINIYAH-DEMO', name: 'Diniyah Takmiliyah', jenis: 'DINIYAH', tingkat: ['I', 'II', 'III'] },
    { code: 'TAHFIZ-DEMO', name: 'Tahfizul Quran', jenis: 'TAHFIZ', tingkat: ['I', 'II', 'III'] },
  ];
  const units = [];
  for (const u of unitDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_unit_pendidikan (id, code, name, jenis, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,true,$5,$6,$6)
       ON CONFLICT DO NOTHING`,
      [id, u.code, u.name, u.jenis, BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id FROM pesantren_unit_pendidikan WHERE code = $1`, [u.code]);
    units.push({ ...u, id: existing.rows[0].id });
  }
  console.log('Unit pendidikan:', units.map((u) => u.code).join(', '));

  // -----------------------------------------------------------------------
  // 2. Mata pelajaran (50) + komponen nilai (3 tiap mapel) + skala huruf
  // -----------------------------------------------------------------------
  const mapelBase = [
    'Al-Quran Hadits', 'Akidah Akhlak', 'Fiqih', 'SKI', 'Bahasa Arab', 'Bahasa Indonesia', 'Bahasa Inggris',
    'Matematika', 'IPA Terpadu', 'IPS Terpadu', 'PPKn', 'Penjaskes', 'Seni Budaya', 'Prakarya', 'TIK',
    'Nahwu', 'Shorof', 'Tafsir', 'Hadits', 'Ushul Fiqih', 'Balaghah', 'Mantiq', 'Tarikh Islam', 'Tajwid',
    'Faraidh', 'Qawaid Fiqhiyyah', 'Mustholah Hadits', 'Ilmu Kalam', 'Tasawuf', 'Khat',
    'Biologi', 'Fisika', 'Kimia', 'Ekonomi', 'Sosiologi', 'Geografi', 'Sejarah Indonesia',
    'Bahasa Jawa', 'Kewirausahaan', 'Statistika', 'Retorika Dakwah', 'Muhadatsah', 'Imla',
    'Mahfuzhat', 'Tarbiyah', 'Fiqih Muamalah', 'Fiqih Munakahat', 'Ilmu Falak', 'Adab', 'Insya', 'Khitobah',
  ];
  const mapel = [];
  for (let i = 0; i < mapelBase.length; i += 1) {
    const code = `MP${String(i + 1).padStart(3, '0')}`;
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_mata_pelajaran (id, code, nama, kelompok, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,true,$5,$6,$6) ON CONFLICT DO NOTHING`,
      [id, code, mapelBase[i], i < 30 ? 'Diniyah' : 'Umum', BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id FROM pesantren_mata_pelajaran WHERE code = $1`, [code]);
    mapel.push({ id: existing.rows[0].id, code, nama: mapelBase[i] });
  }
  console.log('Mata pelajaran:', mapel.length);

  const komponenPerMapel = [];
  for (const m of mapel) {
    const sudahAda = await client.query(`SELECT id, kode FROM pesantren_komponen_nilai WHERE mata_pelajaran_id = $1`, [m.id]);
    if (sudahAda.rows.length > 0) {
      komponenPerMapel.push({ mapel: m, komponen: sudahAda.rows });
      continue;
    }
    const defs = [
      { kode: 'TGS', nama: 'Tugas', bobot: 20 },
      { kode: 'UTS', nama: 'UTS', bobot: 30 },
      { kode: 'UAS', nama: 'UAS', bobot: 50 },
    ];
    const rows = [];
    for (const d of defs) {
      const id = uuid();
      await client.query(
        `INSERT INTO pesantren_komponen_nilai (id, mata_pelajaran_id, kode, nama, bobot_persen, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [id, m.id, d.kode, d.nama, d.bobot, ACTOR],
      );
      rows.push({ id, kode: d.kode });
    }
    komponenPerMapel.push({ mapel: m, komponen: rows });
  }

  const skalaCek = await client.query(`SELECT count(*)::int n FROM pesantren_skala_huruf`);
  if (skalaCek.rows[0].n === 0) {
    const skala = [
      ['A', 90, 100], ['B', 80, 89.99], ['C', 70, 79.99], ['D', 60, 69.99], ['E', 0, 59.99],
    ];
    for (const [huruf, min, max] of skala) {
      await client.query(
        `INSERT INTO pesantren_skala_huruf (id, huruf, nilai_minimum, nilai_maksimum, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$5)`,
        [uuid(), huruf, min, max, ACTOR],
      );
    }
  }

  // -----------------------------------------------------------------------
  // 3. Kurikulum -- setiap mapel dikaitkan ke satu unit+tingkat yang relevan
  // -----------------------------------------------------------------------
  let kurikulumCount = 0;
  for (let i = 0; i < mapel.length; i += 1) {
    const unit = i < 30 ? units[2] : units[i % 2]; // diniyah utk 30 mapel pertama, sisanya MTs/MA berselang-seling
    const tingkat = pick(unit.tingkat);
    try {
      await client.query(
        `INSERT INTO pesantren_kurikulum (id, unit_pendidikan_id, tahun_ajaran_id, tingkat, mata_pelajaran_id, jam_per_minggu, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$8)`,
        [uuid(), unit.id, TAHUN_ID, tingkat, mapel[i].id, randInt(2, 6), BATCH, ACTOR],
      );
      kurikulumCount += 1;
    } catch (e) { /* duplikat kombinasi -- lewati */ }
  }
  console.log('Kurikulum:', kurikulumCount);

  // -----------------------------------------------------------------------
  // 4. Rombongan belajar (50) untuk tahun ajaran berjalan
  // -----------------------------------------------------------------------
  const rombongan = [];
  const namaKelasHuruf = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'];
  let sisaRombongan = 50;
  const unitFormal = [units[0], units[1]]; // MTs, MA -- rombongan formal
  for (const unit of unitFormal) {
    for (const tingkat of unit.tingkat) {
      const jumlahKelas = Math.min(sisaRombongan, unit === unitFormal[unitFormal.length - 1] && tingkat === unit.tingkat[unit.tingkat.length - 1] ? sisaRombongan : randInt(3, 5));
      for (let k = 0; k < jumlahKelas && sisaRombongan > 0; k += 1) {
        const id = uuid();
        const nama = `${tingkat}-${namaKelasHuruf[k]}`;
        await client.query(
          `INSERT INTO pesantren_rombongan_belajar (id, unit_pendidikan_id, tahun_ajaran_id, tingkat, nama, kapasitas, is_sample, sample_batch_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$8) ON CONFLICT DO NOTHING`,
          [id, unit.id, TAHUN_ID, tingkat, nama, 30, BATCH, ACTOR],
        );
        const existing = await client.query(
          `SELECT id FROM pesantren_rombongan_belajar WHERE unit_pendidikan_id=$1 AND tahun_ajaran_id=$2 AND nama=$3`,
          [unit.id, TAHUN_ID, nama],
        );
        rombongan.push({ id: existing.rows[0].id, unitId: unit.id, tingkat, nama });
        sisaRombongan -= 1;
      }
    }
  }
  console.log('Rombongan belajar:', rombongan.length);

  // -----------------------------------------------------------------------
  // 5. Guru (100)
  // -----------------------------------------------------------------------
  const guruList = [];
  const existingGuruCount = await client.query(`SELECT count(*)::int n FROM pesantren_guru`);
  const startGuru = existingGuruCount.rows[0].n;
  for (let i = 0; i < 100; i += 1) {
    const jk = Math.random() < 0.55 ? 'L' : 'P';
    const gelar = jk === 'L' ? 'Ust.' : 'Ustdz.';
    const nama = `${gelar} ${namaSantri(jk)}`;
    const jenis = pickWeighted([['TETAP', 5], ['HONORER', 4], ['DPK', 1]]);
    const id = uuid();
    const nip = `G${String(startGuru + i + 1).padStart(4, '0')}`;
    await client.query(
      `INSERT INTO pesantren_guru (id, nip, nama, jenis, no_hp, status, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,'AKTIF',true,$6,$7,$7) ON CONFLICT DO NOTHING`,
      [id, nip, nama, jenis, `08${randInt(1000000000, 1999999999)}`, BATCH, ACTOR],
    );
    guruList.push({ id, nama });
  }
  console.log('Guru:', guruList.length);

  // -----------------------------------------------------------------------
  // 6. Penugasan mengajar (~200)
  // -----------------------------------------------------------------------
  let penugasanCount = 0;
  const kombinasiTerpakai = new Set();
  for (let i = 0; i < 220; i += 1) {
    const guru = pick(guruList);
    const m = pick(mapel);
    const r = pick(rombongan);
    const key = `${guru.id}|${m.id}|${r.id}`;
    if (kombinasiTerpakai.has(key)) continue;
    kombinasiTerpakai.add(key);
    try {
      await client.query(
        `INSERT INTO pesantren_penugasan_mengajar (id, guru_id, mata_pelajaran_id, rombongan_id, tahun_ajaran_id, jam_per_minggu, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7)`,
        [uuid(), guru.id, m.id, r.id, TAHUN_ID, randInt(2, 6), ACTOR],
      );
      penugasanCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Penugasan mengajar:', penugasanCount);

  // -----------------------------------------------------------------------
  // 7. Santri (1000)
  // -----------------------------------------------------------------------
  const existingSantriCount = await client.query(`SELECT count(*)::int n FROM pesantren_santri`);
  const startNis = existingSantriCount.rows[0].n;
  const santriList = [];
  const tahunMasukTahun = Number(TAHUN_CODE.slice(0, 4)) || new Date().getFullYear();
  for (let i = 0; i < 1000; i += 1) {
    const jk = Math.random() < 0.52 ? 'L' : 'P';
    const nama = namaSantri(jk);
    const status = pickWeighted([['AKTIF', 92], ['LULUS', 5], ['KELUAR', 2], ['PINDAH', 1]]);
    const unit = pick(unitFormal);
    const nis = `${tahunMasukTahun}${String(startNis + i + 1).padStart(5, '0')}`;
    const tglLahir = dateStr(new Date(Date.UTC(tahunMasukTahun - randInt(12, 18), randInt(0, 11), randInt(1, 28))));
    const tglMasuk = dateStr(addDays(new Date(), -randInt(200, 900)));
    const tglKeluar = status === 'AKTIF' ? null : dateStr(addDays(new Date(tglMasuk), randInt(30, 180)));
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_santri
         (id, nis, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir, unit_pendidikan_id, status, status_tinggal,
          tanggal_masuk, tanggal_keluar, alasan_keluar, alamat_asal, golongan_darah, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,$15,$16,$16)
       ON CONFLICT DO NOTHING`,
      [id, nis, nama, jk, pick(KOTA), tglLahir, unit.id, status, pickWeighted([['MUKIM', 8], ['NONMUKIM', 2]]),
        tglMasuk, tglKeluar, status === 'AKTIF' ? null : pick(['Lulus ujian akhir', 'Pindah domisili', 'Pindah pondok lain']),
        `Jl. ${pick(NAMA_BELAKANG)} No. ${randInt(1, 99)}, ${pick(KOTA)}`,
        pick(['A', 'B', 'AB', 'O', null]), BATCH, ACTOR],
    );
    santriList.push({ id, nis, nama, jk, status, unitId: unit.id });
  }
  console.log('Santri:', santriList.length);
  const santriAktif = santriList.filter((s) => s.status === 'AKTIF');

  await client.end();
  console.log('\nTahap 1 selesai (unit, mapel, kurikulum, rombongan, guru, penugasan, santri).');
  console.log('BATCH_ID=' + BATCH);
}

main().catch((e) => {
  console.error('GAGAL:', e.message, e.stack);
  process.exit(1);
});
