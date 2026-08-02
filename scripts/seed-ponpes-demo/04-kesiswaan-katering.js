/**
 * Tahap 4 seed data demo -- pelanggaran/hukuman, ekstrakurikuler, prestasi/
 * penghargaan, katering, absensi guru/piket, diniyah/tahfiz, dan PSB.
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

const NAMA_DEPAN_L = ['Ahmad', 'Muhammad', 'Yusuf', 'Ibrahim', 'Fahmi', 'Rizky'];
const NAMA_DEPAN_P = ['Aisyah', 'Fatimah', 'Zainab', 'Nur', 'Siti', 'Putri'];
const NAMA_BELAKANG = ['Fauzi', 'Hidayat', 'Ramadhan', 'Setiawan', 'Wijaya', 'Hakim'];
const namaGuru = (jk) => `${jk === 'L' ? 'Ust.' : 'Ustdz.'} ${pick(jk === 'L' ? NAMA_DEPAN_L : NAMA_DEPAN_P)} ${pick(NAMA_BELAKANG)}`;

async function main() {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);
  console.log(`Tahap 4 batch ${BATCH} -> schema ${SCHEMA}`);

  const taRes = await client.query(`SELECT id FROM pesantren_tahun_ajaran WHERE status = 'ACTIVE' LIMIT 1`);
  const TAHUN_ID = taRes.rows[0].id;
  const adminRes = await client.query(
    `SELECT us.platform_user_id AS id FROM user_subject us
       JOIN user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN role r ON r.id = ura.role_id
      WHERE r.code = 'EPESANTREN_ADMIN' LIMIT 1`,
  );
  const ACTOR = adminRes.rows[0]?.id || null;

  const santriAktif = (await client.query(
    `SELECT id, nis, nama_lengkap FROM pesantren_santri WHERE deleted_at IS NULL AND status = 'AKTIF' ORDER BY nis`,
  )).rows;
  const guruRows = (await client.query(`SELECT id, nama FROM pesantren_guru WHERE deleted_at IS NULL`)).rows;
  const asramaRows = (await client.query(`SELECT id, nama FROM pesantren_asrama WHERE deleted_at IS NULL`)).rows;
  const unitTahfizDiniyah = (await client.query(
    `SELECT id, code FROM pesantren_unit_pendidikan WHERE deleted_at IS NULL AND jenis IN ('DINIYAH','TAHFIZ')`,
  )).rows;

  // -----------------------------------------------------------------------
  // 16. Jenis pelanggaran + pelanggaran + hukuman
  // -----------------------------------------------------------------------
  const jenisPelanggaranDefs = [
    ['TL01', 'Terlambat masuk kelas', 'RINGAN', 5],
    ['TL02', 'Tidak mengerjakan tugas', 'RINGAN', 5],
    ['TL03', 'Tidak memakai seragam lengkap', 'RINGAN', 5],
    ['SD01', 'Membolos kegiatan pondok', 'SEDANG', 15],
    ['SD02', 'Keluar pondok tanpa izin', 'SEDANG', 20],
    ['SD03', 'Membawa alat elektronik terlarang', 'SEDANG', 15],
    ['BR01', 'Merokok di lingkungan pondok', 'BERAT', 50],
    ['BR02', 'Berkelahi dengan santri lain', 'BERAT', 50],
  ];
  const jenisPelanggaranList = [];
  for (const [code, nama, kategori, poin] of jenisPelanggaranDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_jenis_pelanggaran (id, code, nama, kategori, poin, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING`,
      [id, code, nama, kategori, poin, ACTOR],
    );
    const existing = await client.query(`SELECT id, poin FROM pesantren_jenis_pelanggaran WHERE code = $1`, [code]);
    jenisPelanggaranList.push({ id: existing.rows[0].id, poin: existing.rows[0].poin });
  }
  let pelanggaranCount = 0;
  let hukumanCount = 0;
  for (let i = 0; i < 180; i += 1) {
    const s = pick(santriAktif);
    const jp = pick(jenisPelanggaranList);
    const pelanggaranId = uuid();
    try {
      await client.query(
        `INSERT INTO pesantren_pelanggaran (id, santri_id, jenis_pelanggaran_id, tanggal, keterangan, poin, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$8)`,
        [pelanggaranId, s.id, jp.id, dateStr(addDays(new Date(), -randInt(0, 90))), 'Dicatat oleh musyrif piket', jp.poin, BATCH, ACTOR],
      );
      pelanggaranCount += 1;
      if (Math.random() < 0.4) {
        await client.query(
          `INSERT INTO pesantren_hukuman (id, pelanggaran_id, jenis_hukuman, keterangan, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,$5)`,
          [uuid(), pelanggaranId, pick(['TEGURAN_LISAN', 'TEGURAN_TERTULIS', 'PEMANGGILAN_ORANG_TUA', 'PEMBINAAN_KHUSUS']),
            'Sesuai kebijakan tata tertib pondok', ACTOR],
        );
        hukumanCount += 1;
      }
    } catch (e) { /* lewati */ }
  }
  console.log('Pelanggaran:', pelanggaranCount, 'Hukuman:', hukumanCount);

  // -----------------------------------------------------------------------
  // 17. Ekstrakurikuler + anggota
  // -----------------------------------------------------------------------
  const ekskulDefs = [
    ['PRAMUKA', 'Pramuka', 'KLUB'], ['SILAT', 'Pencak Silat', 'KLUB'], ['FUTSAL', 'Futsal', 'KLUB'],
    ['KALIGRAFI', 'Kaligrafi', 'KLUB'], ['MUHADHOROH', 'Muhadhoroh', 'KLUB'], ['QIROAH', "Qira'ah", 'KLUB'],
    ['MARAWIS', 'Marawis', 'KLUB'], ['JURNALISTIK', 'Jurnalistik Santri', 'KLUB'], ['PMR', 'Palang Merah Remaja', 'KLUB'],
    ['TAHFIDZ-EKS', 'Klub Tahfidz Ekstra', 'KLUB'], ['ROBOTIK', 'Robotik dan Sains', 'KLUB'], ['PANAHAN', 'Panahan', 'KLUB'],
    ['OSIS', 'OSIS (Organisasi Santri Intra Sekolah)', 'ORGANISASI'],
    ['IKSAP', 'Ikatan Santri Pelajar', 'ORGANISASI'],
  ];
  const ekskulList = [];
  for (const [code, nama, jenis] of ekskulDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_ekstrakurikuler (id, code, nama, jenis, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,true,$5,$6,$6) ON CONFLICT DO NOTHING`,
      [id, code, nama, jenis, BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id FROM pesantren_ekstrakurikuler WHERE code = $1`, [code]);
    ekskulList.push({ id: existing.rows[0].id });
  }
  let ekskulAnggotaCount = 0;
  const dipakaiKombinasi = new Set();
  for (let i = 0; i < 400; i += 1) {
    const e = pick(ekskulList);
    const s = pick(santriAktif);
    const key = `${e.id}|${s.id}`;
    if (dipakaiKombinasi.has(key)) continue;
    dipakaiKombinasi.add(key);
    try {
      await client.query(
        `INSERT INTO pesantren_ekstrakurikuler_anggota (id, ekstrakurikuler_id, santri_id, tahun_ajaran_id, jabatan, nilai_partisipasi, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$8)`,
        [uuid(), e.id, s.id, TAHUN_ID, pickWeighted([['ANGGOTA', 20], ['KETUA', 1], ['WAKIL_KETUA', 1], ['SEKRETARIS', 1], ['BENDAHARA', 1]]),
          randInt(70, 100), BATCH, ACTOR],
      );
      ekskulAnggotaCount += 1;
    } catch (e2) { /* lewati */ }
  }
  console.log('Ekstrakurikuler:', ekskulList.length, 'Anggota:', ekskulAnggotaCount);

  // -----------------------------------------------------------------------
  // 18. Prestasi + penghargaan
  // -----------------------------------------------------------------------
  let prestasiCount = 0;
  const cabangPrestasi = ['Tahfidz Quran', 'Pidato Bahasa Arab', 'Kaligrafi', 'Pencak Silat', 'Olimpiade Matematika', 'Cerdas Cermat Agama', 'Futsal'];
  for (let i = 0; i < 120; i += 1) {
    const s = pick(santriAktif);
    try {
      await client.query(
        `INSERT INTO pesantren_prestasi (id, santri_id, cabang, nama_kompetisi, tingkat, peringkat, tanggal, penyelenggara, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$10)`,
        [uuid(), s.id, pick(cabangPrestasi), `Lomba ${pick(cabangPrestasi)} ${randInt(2024, 2026)}`,
          pick(['SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL']),
          pick(['JUARA_1', 'JUARA_2', 'JUARA_3', 'HARAPAN_1', 'PARTISIPASI']),
          dateStr(addDays(new Date(), -randInt(0, 300))), pick(['Kemenag', 'Dinas Pendidikan', 'Panitia Daerah']), BATCH, ACTOR],
      );
      prestasiCount += 1;
    } catch (e) { /* lewati */ }
  }
  let penghargaanCount = 0;
  for (let i = 0; i < 90; i += 1) {
    const s = pick(santriAktif);
    try {
      await client.query(
        `INSERT INTO pesantren_penghargaan (id, santri_id, judul, jenis, tanggal, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,true,$6,$7,$7)`,
        [uuid(), s.id, pick(['Santri Teladan Bulan Ini', 'Hafalan Terbaik', 'Kedisiplinan Terbaik', 'Akhlak Terpuji']),
          pick(['APRESIASI', 'PENGHARGAAN_BULANAN', 'SERTIFIKAT']), dateStr(addDays(new Date(), -randInt(0, 200))), BATCH, ACTOR],
      );
      penghargaanCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Prestasi:', prestasiCount, 'Penghargaan:', penghargaanCount);

  // -----------------------------------------------------------------------
  // 19. Katering: menu (30 hari x 3 waktu), konsumsi, bahan + transaksi
  // -----------------------------------------------------------------------
  const waktuMakanList = ['SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM'];
  const menuNama = {
    SARAPAN: ['Nasi, telur dadar, sayur bening', 'Bubur ayam, kerupuk', 'Nasi, tempe orek, sayur asem'],
    MAKAN_SIANG: ['Nasi, ayam goreng, sayur lodeh', 'Nasi, ikan bakar, tumis kangkung', 'Nasi, rendang, sayur nangka'],
    MAKAN_MALAM: ['Nasi, tahu tempe, sayur sop', 'Nasi, telur balado, cah kangkung', 'Nasi, ayam kecap, sayur bayam'],
  };
  let menuCount = 0;
  let konsumsiCount = 0;
  const menuList = [];
  for (let d = -30; d <= 0; d += 1) {
    const tanggal = dateStr(addDays(new Date(), d));
    for (const waktu of waktuMakanList) {
      const id = uuid();
      try {
        await client.query(
          `INSERT INTO pesantren_menu_makan (id, tanggal, waktu_makan, nama_menu, jumlah_porsi_disiapkan, status, is_sample, sample_batch_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,'SELESAI',true,$6,$7,$7)`,
          [id, tanggal, waktu, pick(menuNama[waktu]), randInt(900, 1000), BATCH, ACTOR],
        );
        menuList.push(id);
        menuCount += 1;
        for (const a of asramaRows) {
          await client.query(
            `INSERT INTO pesantren_konsumsi (id, menu_id, asrama_id, jumlah_porsi, is_sample, sample_batch_id, created_by, updated_by)
             VALUES ($1,$2,$3,$4,true,$5,$6,$6)`,
            [uuid(), id, a.id, randInt(150, 250), BATCH, ACTOR],
          );
          konsumsiCount += 1;
        }
      } catch (e) { /* lewati */ }
    }
  }
  console.log('Menu makan:', menuCount, 'Konsumsi:', konsumsiCount);

  const bahanDefs = [
    ['Beras', 'kg', 200], ['Minyak Goreng', 'liter', 50], ['Telur', 'kg', 100], ['Ayam', 'kg', 80],
    ['Tempe', 'papan', 100], ['Tahu', 'papan', 100], ['Bawang Merah', 'kg', 30], ['Bawang Putih', 'kg', 20],
    ['Cabai', 'kg', 20], ['Gula', 'kg', 40], ['Garam', 'kg', 15], ['Sayur Bayam', 'ikat', 100],
    ['Sayur Kangkung', 'ikat', 100], ['Tepung Terigu', 'kg', 30], ['Kecap', 'botol', 20],
    ['Santan', 'liter', 25], ['Ikan', 'kg', 60], ['Daging Sapi', 'kg', 40], ['Kentang', 'kg', 40], ['Wortel', 'kg', 35],
  ];
  const bahanList = [];
  for (const [nama, satuan, minStok] of bahanDefs) {
    const id = uuid();
    await client.query(
      `INSERT INTO pesantren_stok_dapur (id, nama_bahan, satuan, stok_minimum, is_sample, sample_batch_id, created_by, updated_by)
       VALUES ($1,$2,$3,$4,true,$5,$6,$6) ON CONFLICT DO NOTHING`,
      [id, nama, satuan, minStok, BATCH, ACTOR],
    );
    const existing = await client.query(`SELECT id FROM pesantren_stok_dapur WHERE nama_bahan = $1`, [nama]);
    bahanList.push({ id: existing.rows[0].id, minStok });
  }
  let stokTransaksiCount = 0;
  for (const b of bahanList) {
    let stok = 0;
    for (let t = 0; t < randInt(4, 8); t += 1) {
      const jenis = pickWeighted([['MASUK', 6], ['KELUAR', 4]]);
      let jumlah = randInt(10, 60);
      if (jenis === 'KELUAR') jumlah = Math.min(jumlah, stok);
      if (jenis === 'KELUAR' && jumlah <= 0) continue;
      stok = jenis === 'MASUK' ? stok + jumlah : stok - jumlah;
      await client.query(
        `INSERT INTO pesantren_stok_dapur_transaksi (id, bahan_id, jenis, jumlah, stok_sesudah, is_sample, sample_batch_id, created_by, created_at)
         VALUES ($1,$2,$3,$4,$5,true,$6,$7,$8)`,
        [uuid(), b.id, jenis, jumlah, stok, BATCH, ACTOR, addDays(new Date(), -randInt(0, 30))],
      );
      stokTransaksiCount += 1;
    }
    await client.query(`UPDATE pesantren_stok_dapur SET stok_saat_ini = $2 WHERE id = $1`, [b.id, stok]);
  }
  console.log('Bahan dapur:', bahanList.length, 'Transaksi stok:', stokTransaksiCount);

  await client.end();
  console.log('\nTahap 4 selesai (pelanggaran/hukuman, ekstrakurikuler, prestasi/penghargaan, katering).');
  console.log('BATCH_ID_TAHAP4=' + BATCH);
}

main().catch((e) => {
  console.error('GAGAL:', e.message, e.stack);
  process.exit(1);
});
