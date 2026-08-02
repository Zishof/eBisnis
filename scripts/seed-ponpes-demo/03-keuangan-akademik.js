/**
 * Tahap 3 seed data demo -- tagihan, dompet, kartu, nilai, presensi, izin,
 * pelanggaran, ekstrakurikuler, prestasi, katering, absensi guru/piket,
 * diniyah/tahfiz, dan PSB. Mengasumsikan Tahap 1 & 2 sudah berjalan.
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
  for (let i = 0; i < n && copy.length > 0; i += 1) {
    out.push(copy.splice(randInt(0, copy.length - 1), 1)[0]);
  }
  return out;
};

async function main() {
  const client = new Client({ connectionString: CONN });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);
  console.log(`Tahap 3 batch ${BATCH} -> schema ${SCHEMA}`);

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
    `SELECT id, nis, nama_lengkap, status FROM pesantren_santri WHERE deleted_at IS NULL ORDER BY nis`,
  )).rows;
  const santriAktif = santriRows.filter((s) => s.status === 'AKTIF');
  const guruRows = (await client.query(`SELECT id, nama FROM pesantren_guru WHERE deleted_at IS NULL`)).rows;
  const komponenRows = (await client.query(
    `SELECT id, mata_pelajaran_id FROM pesantren_komponen_nilai WHERE deleted_at IS NULL`,
  )).rows;
  const asramaRows = (await client.query(`SELECT id, nama FROM pesantren_asrama WHERE deleted_at IS NULL`)).rows;
  const unitRows = (await client.query(`SELECT id, code FROM pesantren_unit_pendidikan WHERE deleted_at IS NULL`)).rows;

  console.log(`Basis: ${santriRows.length} santri, ${guruRows.length} guru, ${komponenRows.length} komponen nilai`);

  // -----------------------------------------------------------------------
  // 10. Tagihan + item (600 sampel)
  // -----------------------------------------------------------------------
  const periodeList = ['2026-06', '2026-07', '2026-08'];
  let tagihanCount = 0;
  for (const s of sample(santriAktif, 600)) {
    const periode = pick(periodeList);
    const status = pickWeighted([['PAID', 55], ['ISSUED', 20], ['PARTIALLY_PAID', 10], ['OVERDUE', 10], ['DRAFT', 5]]);
    const itemSpp = randInt(300000, 500000);
    const itemAsrama = randInt(150000, 250000);
    const itemMakan = randInt(200000, 300000);
    const total = itemSpp + itemAsrama + itemMakan;
    const tagihanId = uuid();
    try {
      await client.query(
        `INSERT INTO pesantren_tagihan (id, santri_id, periode, status, jatuh_tempo, total_tagihan, diterbitkan_pada, diterbitkan_oleh, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10,$10)`,
        [tagihanId, s.id, periode, status, `${periode}-10`, total,
          status === 'DRAFT' ? null : new Date(`${periode}-01`), status === 'DRAFT' ? null : ACTOR, BATCH, ACTOR],
      );
      const items = [
        ['SPP', 'SPP Bulanan', itemSpp],
        ['ASRAMA', 'Biaya Asrama', itemAsrama],
        ['MAKAN', 'Konsumsi Bulanan', itemMakan],
      ];
      for (const [kode, deskripsi, jumlah] of items) {
        await client.query(
          `INSERT INTO pesantren_tagihan_item (id, tagihan_id, kode, deskripsi, jumlah) VALUES ($1,$2,$3,$4,$5)`,
          [uuid(), tagihanId, kode, deskripsi, jumlah],
        );
      }
      tagihanCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Tagihan:', tagihanCount);

  // -----------------------------------------------------------------------
  // 11. Dompet + transaksi
  // -----------------------------------------------------------------------
  let dompetCount = 0;
  let transaksiCount = 0;
  for (const s of santriAktif) {
    const dompetId = uuid();
    let saldo = randInt(20000, 150000);
    try {
      await client.query(
        `INSERT INTO pesantren_dompet (id, santri_id, saldo, batas_harian, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,true,$5,$6,$6)`,
        [dompetId, s.id, saldo, 25000, BATCH, ACTOR],
      );
      dompetCount += 1;
      const jumlahTransaksi = randInt(0, 3);
      for (let t = 0; t < jumlahTransaksi; t += 1) {
        const jenis = pickWeighted([['TOPUP', 3], ['BELANJA', 5], ['PENYESUAIAN', 1]]);
        let jumlah = randInt(5000, 30000);
        if (jenis === 'TOPUP') saldo += jumlah;
        else if (jenis === 'BELANJA') {
          jumlah = Math.min(jumlah, saldo);
          if (jumlah <= 0) continue;
          saldo -= jumlah;
        }
        await client.query(
          `INSERT INTO pesantren_dompet_transaksi (id, dompet_id, jenis, jumlah, saldo_sesudah, keterangan, dicatat_oleh, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [uuid(), dompetId, jenis, jumlah, saldo, jenis === 'BELANJA' ? 'Belanja kantin' : 'Top-up dari wali', ACTOR,
            addDays(new Date(), -randInt(0, 30))],
        );
        transaksiCount += 1;
      }
      await client.query(`UPDATE pesantren_dompet SET saldo = $2 WHERE id = $1`, [dompetId, saldo]);
    } catch (e) { /* lewati */ }
  }
  console.log('Dompet:', dompetCount, 'Transaksi dompet:', transaksiCount);

  // -----------------------------------------------------------------------
  // 12. Kartu RFID
  // -----------------------------------------------------------------------
  let kartuCount = 0;
  for (const s of santriAktif) {
    try {
      await client.query(
        `INSERT INTO pesantren_kartu (id, santri_id, nomor_kartu, jenis, status, diterbitkan_pada, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,'RFID','AKTIF',now(),true,$4,$5,$5)`,
        [uuid(), s.id, `RFID${s.nis}`, BATCH, ACTOR],
      );
      kartuCount += 1;
    } catch (e) { /* lewati */ }
  }
  console.log('Kartu:', kartuCount);

  // -----------------------------------------------------------------------
  // 13. Nilai -- sampel 300 santri x komponen dari kurikulum diniyah/umum
  // -----------------------------------------------------------------------
  let nilaiCount = 0;
  for (const s of sample(santriAktif, 300)) {
    const komponenSampel = sample(komponenRows, randInt(6, 12));
    for (const k of komponenSampel) {
      try {
        await client.query(
          `INSERT INTO pesantren_nilai (id, santri_id, komponen_id, tahun_ajaran_id, nilai_angka, is_sample, sample_batch_id, created_by, updated_by)
           VALUES ($1,$2,$3,$4,$5,true,$6,$7,$7)`,
          [uuid(), s.id, k.id, TAHUN_ID, randInt(60, 100), BATCH, ACTOR],
        );
        nilaiCount += 1;
      } catch (e) { /* lewati */ }
    }
  }
  console.log('Nilai:', nilaiCount);

  // -----------------------------------------------------------------------
  // 14. Presensi santri (500 sampel, 14 hari terakhir)
  // -----------------------------------------------------------------------
  let presensiCount = 0;
  const jenisPresensi = ['SEKOLAH', 'DINIYAH', 'IBADAH', 'KEGIATAN'];
  for (let i = 0; i < 500; i += 1) {
    const s = pick(santriAktif);
    const tanggal = dateStr(addDays(new Date(), -randInt(0, 14)));
    try {
      await client.query(
        `INSERT INTO pesantren_presensi (id, santri_id, tanggal, jenis, status, dicatat_oleh, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8,$8)`,
        [uuid(), s.id, tanggal, pick(jenisPresensi), pickWeighted([['HADIR', 85], ['IZIN', 7], ['SAKIT', 6], ['ALPA', 2]]), ACTOR, BATCH, ACTOR],
      );
      presensiCount += 1;
    } catch (e) { /* lewati -- kemungkinan duplikat santri+tanggal+jenis bila ada constraint */ }
  }
  console.log('Presensi:', presensiCount);

  // -----------------------------------------------------------------------
  // 15. Izin + gerbang log (250 izin, sebagian dengan lintasan gerbang)
  // -----------------------------------------------------------------------
  let izinCount = 0;
  let gerbangCount = 0;
  for (let i = 0; i < 250; i += 1) {
    const s = pick(santriAktif);
    const mulai = dateStr(addDays(new Date(), -randInt(0, 60)));
    const status = pickWeighted([['DISETUJUI', 70], ['MENUNGGU', 15], ['DITOLAK', 15]]);
    const izinId = uuid();
    try {
      await client.query(
        `INSERT INTO pesantren_izin (id, santri_id, jenis, alasan, tanggal_mulai, tanggal_selesai_rencana, status, disetujui_oleh, disetujui_pada, is_sample, sample_batch_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,$10,$11,$11)`,
        [izinId, s.id, pick(['PULANG', 'SAKIT', 'KEPERLUAN_KELUARGA', 'LAINNYA']),
          pick(['Menjenguk keluarga sakit', 'Acara keluarga', 'Kontrol kesehatan', 'Keperluan mendesak']),
          mulai, dateStr(addDays(new Date(mulai), randInt(1, 5))), status,
          status === 'MENUNGGU' ? null : ACTOR, status === 'MENUNGGU' ? null : new Date(mulai),
          BATCH, ACTOR],
      );
      izinCount += 1;
      if (status === 'DISETUJUI' && Math.random() < 0.7) {
        await client.query(
          `INSERT INTO pesantren_gerbang_log (id, izin_id, arah, waktu, dicatat_oleh) VALUES ($1,$2,'KELUAR',$3,$4)`,
          [uuid(), izinId, new Date(mulai), ACTOR],
        );
        gerbangCount += 1;
        if (Math.random() < 0.8) {
          await client.query(
            `INSERT INTO pesantren_gerbang_log (id, izin_id, arah, waktu, dicatat_oleh) VALUES ($1,$2,'MASUK',$3,$4)`,
            [uuid(), izinId, addDays(new Date(mulai), randInt(1, 5)), ACTOR],
          );
          gerbangCount += 1;
        }
      }
    } catch (e) { /* lewati */ }
  }
  console.log('Izin:', izinCount, 'Gerbang log:', gerbangCount);

  await client.end();
  console.log('\nTahap 3 (bagian A) selesai (tagihan, dompet, kartu, nilai, presensi, izin/gerbang).');
  console.log('BATCH_ID_TAHAP3=' + BATCH);
}

main().catch((e) => {
  console.error('GAGAL:', e.message, e.stack);
  process.exit(1);
});
