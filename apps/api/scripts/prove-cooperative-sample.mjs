/**
 * Bukti data contoh koperasi: pasang, cetak laporan, hapus.
 *
 * Yang dibuktikan bukan "penyemaian berjalan" melainkan bahwa datanya
 * **cukup untuk mencetak laporan yang berarti** — dan bahwa penghapusannya
 * tidak menyentuh data sungguhan.
 *
 * Bukti ini benar-benar menyusun tiga laporan dari datanya:
 *
 *   · Neraca simpanan anggota
 *   · Berita Acara RAT beserta kuorum dan hasil pemungutan suara
 *   · Daftar pembagian SHU per anggota
 *
 * Laporan itu dicetak ke berkas bukti supaya bentuknya dapat dinilai manusia,
 * bukan hanya lulus-tidaknya.
 *
 * Data sungguhan sengaja diselipkan sebelum penghapusan, dengan kode yang
 * mirip, supaya penyaringnya benar-benar diuji.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { AWALAN_CONTOH } from '../dist/modules/cooperative/cooperative-sample.js';
import {
  JUMLAH_ANGGOTA,
  SURPLUS_TAHUN_BUKU,
  TAHUN_BUKU,
} from '../dist/modules/cooperative/sample/cooperative-sample-data.js';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/^DATABASE_URL=(.*)$/m)[1].trim().replace(/^"|"$/g, '');

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
const S = process.env.COOPERATIVE_SCHEMA ?? 'demo';
const rp = (n) => new Intl.NumberFormat('id-ID').format(Math.round(Number(n)));

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI DATA CONTOH KOPERASI');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${S}`);
  log('='.repeat(78));

  // ------------------------------------------------------- Data sungguhan
  log('');
  log('1. Data SUNGGUHAN diselipkan lebih dahulu');

  const jenisAsli = await q(
    `INSERT INTO "${S}".cooperative_type (code, name) VALUES ($1, 'KSP Asli') RETURNING id`,
    [`ASLI_${tag}`.slice(0, 32)],
  );
  const kopAsli = await q(
    `INSERT INTO "${S}".cooperative (code, name, slug, cooperative_type_id, status)
     VALUES ($1, 'Koperasi Sungguhan', $2, $3, 'DRAFT') RETURNING id`,
    [`ASLI-${tag}`, `asli-${tag}`, jenisAsli[0].id],
  );
  const anggotaAsli = [];
  for (const [nomor, nama] of [
    [`ANG-${tag}-1`, 'Anggota Sungguhan Satu'],
    [`TOKO-${AWALAN_CONTOH}RASA-${tag}`, 'Nama Mirip Contoh'],
    [`${AWALAN_CONTOH.toLowerCase()}huruf-kecil-${tag}`, 'Awalan Huruf Kecil'],
  ]) {
    const r = await q(
      `INSERT INTO "${S}".cooperative_member
         (cooperative_id, member_number, full_name, status, activated_at, identity_number)
       VALUES ($1, $2, $3, 'ACTIVE', now(), $4) RETURNING id`,
      [kopAsli[0].id, nomor, nama, `9271${tag}${anggotaAsli.length}00000`.slice(0, 20)],
    );
    anggotaAsli.push(r[0].id);
  }
  check('3 anggota sungguhan tersimpan, dua berkode mirip', anggotaAsli.length === 3);

  // ------------------------------------------------------------ Pemasangan
  log('');
  log('2. Data contoh dipasang');

  const { CooperativeSampleService } = await import(
    '../dist/modules/cooperative/sample/cooperative-sample.service.js'
  );
  // Layanan memakai TenantConnectionService; di sini dipanggil lewat klien yang
  // sama supaya seluruhnya berada di dalam transaksi yang digulung balik.
  const tenantDbPalsu = {
    query: async (_schema, sql, params) => (await client.query(sql, params)).rows,
    transaction: async (_schema, fn) => fn({ query: (sql, params) => client.query(sql, params) }),
  };
  const layanan = new CooperativeSampleService(tenantDbPalsu);

  const hasil = await layanan.pasang(S, null);
  check(`${hasil.anggota} anggota tersemai`, hasil.anggota === JUMLAH_ANGGOTA);
  check(`${hasil.rekeningSimpanan} rekening simpanan`, hasil.rekeningSimpanan > 100);
  check(`${hasil.mutasiSimpanan} mutasi simpanan`, hasil.mutasiSimpanan > 700);
  check(`${hasil.pinjaman} pinjaman`, hasil.pinjaman >= 20);
  check(`${hasil.angsuran} baris jadwal angsuran`, hasil.angsuran > 200);
  check(`${hasil.suara} suara pada RAT`, hasil.suara > 100);
  check(`${hasil.shuDibagikan} anggota memperoleh SHU`, hasil.shuDibagikan > 50);

  let ditolakUlang = false;
  try {
    await layanan.pasang(S, null);
  } catch {
    ditolakUlang = true;
  }
  check('pemasangan kedua DITOLAK — tidak menggandakan', ditolakUlang);

  // --------------------------------------------------------- LAPORAN RAT
  log('');
  log('3. LAPORAN — Berita Acara Rapat Anggota Tahunan');
  log('');

  const rat = await q(
    `SELECT title, meeting_number, scheduled_at, location, total_active_members,
            counted_for_quorum, required_count, quorum_reached
       FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1`,
    [`${AWALAN_CONTOH}%`],
  );
  const r0 = rat[0];
  log(`  ${r0.title}`);
  log(`  Nomor    : ${r0.meeting_number}`);
  log(`  Tempat   : ${r0.location}`);
  log('');
  log(`  Anggota aktif       : ${r0.total_active_members} orang`);
  log(`  Hadir               : ${r0.counted_for_quorum} orang`);
  log(`  Kuorum diperlukan   : ${r0.required_count} orang`);
  log(`  Kuorum              : ${r0.quorum_reached ? 'TERCAPAI' : 'TIDAK TERCAPAI'}`);
  log('');

  const kehadiran = await q(
    `SELECT mode, COUNT(*)::int n FROM "${S}".cooperative_meeting_attendance
      WHERE meeting_id = (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)
      GROUP BY mode ORDER BY mode`,
    [`${AWALAN_CONTOH}%`],
  );
  log(`  Rincian kehadiran   : ${kehadiran.map((k) => `${k.mode} ${k.n}`).join(', ')}`);
  log('');
  log('  Hasil pemungutan suara:');
  const keputusan = await q(
    `SELECT a.title, d.votes_yes, d.votes_no, d.votes_abstain, d.validity
       FROM "${S}".cooperative_meeting_decision d
       JOIN "${S}".cooperative_meeting_agenda a ON a.id = d.agenda_id
      WHERE d.meeting_id = (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)
      ORDER BY a.sequence_no`,
    [`${AWALAN_CONTOH}%`],
  );
  for (const k of keputusan) {
    log(
      `    · ${k.title}`.padEnd(58) +
        `setuju ${String(k.votes_yes).padStart(3)}  tolak ${String(k.votes_no).padStart(2)}  abstain ${String(k.votes_abstain).padStart(2)}`,
    );
  }
  log('');

  check('kuorum tercapai dan angkanya konsisten', r0.quorum_reached === true &&
    Number(r0.counted_for_quorum) >= Number(r0.required_count));
  check('tidak seluruh anggota aktif hadir', Number(r0.counted_for_quorum) < Number(r0.total_active_members));
  check('tiga keputusan tercatat', keputusan.length === 3);
  check(
    'ada suara menolak dan abstain — bukan bulat',
    keputusan.some((k) => Number(k.votes_no) > 0) && keputusan.some((k) => Number(k.votes_abstain) > 0),
  );

  // -------------------------------------------------------- LAPORAN SHU
  log('');
  log('4. LAPORAN — Pembagian Sisa Hasil Usaha');
  log('');

  const komponen = await q(
    `SELECT component, ratio, amount FROM "${S}".cooperative_shu_allocation
      WHERE calculation_id = (SELECT id FROM "${S}".cooperative_shu_calculation
                               WHERE input_fingerprint LIKE $1)
      ORDER BY amount DESC`,
    [`${AWALAN_CONTOH}%`],
  );
  log(`  Surplus tahun buku ${TAHUN_BUKU} : Rp ${rp(SURPLUS_TAHUN_BUKU)}`);
  log('');
  for (const k of komponen) {
    log(
      `    ${k.component.padEnd(20)} ${String(Math.round(Number(k.ratio) * 100)).padStart(3)}%   Rp ${rp(k.amount).padStart(14)}`,
    );
  }
  const totalKomponen = komponen.reduce((s, k) => s + Number(k.amount), 0);
  log(`    ${''.padEnd(20)}      ${''.padStart(3)}   ${'—'.repeat(17)}`);
  log(`    ${'JUMLAH'.padEnd(20)}      ${''.padStart(3)}   Rp ${rp(totalKomponen).padStart(14)}`);
  log('');

  check(
    'jumlah komponen PERSIS sama dengan surplus',
    totalKomponen === SURPLUS_TAHUN_BUKU,
    `${totalKomponen} vs ${SURPLUS_TAHUN_BUKU}`,
  );

  const shu = await q(
    `SELECT m.member_number, m.full_name, d.capital_service, d.patronage_service, d.net_amount
       FROM "${S}".cooperative_shu_distribution d
       JOIN "${S}".cooperative_member m ON m.id = d.member_id
      WHERE d.calculation_id = (SELECT id FROM "${S}".cooperative_shu_calculation
                                 WHERE input_fingerprint LIKE $1)
      ORDER BY d.net_amount DESC`,
    [`${AWALAN_CONTOH}%`],
  );

  log('  Sepuluh penerima SHU terbesar:');
  log('');
  log('    Nomor Anggota        Nama                      Jasa Modal    Jasa Usaha       Jumlah');
  log(`    ${'-'.repeat(84)}`);
  for (const x of shu.slice(0, 10)) {
    log(
      `    ${x.member_number.padEnd(20)} ${x.full_name.slice(0, 24).padEnd(24)} ` +
        `${rp(x.capital_service).padStart(11)}   ${rp(x.patronage_service).padStart(11)}  ${rp(x.net_amount).padStart(11)}`,
    );
  }
  log('');
  log(`    … dan ${shu.length - 10} anggota lainnya.`);
  log('');

  const totalModal = shu.reduce((s, x) => s + Number(x.capital_service), 0);
  const totalUsaha = shu.reduce((s, x) => s + Number(x.patronage_service), 0);
  const kModal = komponen.find((k) => k.component === 'CAPITAL_SERVICE');
  const kUsaha = komponen.find((k) => k.component === 'PATRONAGE_SERVICE');

  log(`    Jumlah jasa modal anggota  : Rp ${rp(totalModal)}  (alokasi Rp ${rp(kModal.amount)})`);
  log(`    Jumlah jasa usaha anggota  : Rp ${rp(totalUsaha)}  (alokasi Rp ${rp(kUsaha.amount)})`);
  log('');

  /*
   * Pemeriksaan yang paling menentukan pada laporan SHU. Jumlah kolom per
   * anggota WAJIB sama persis dengan alokasi komponennya — selisih beberapa
   * rupiah di sini adalah hal pertama yang ditanyakan anggota, sebab jumlah
   * yang dibacanya tidak sama dengan yang diumumkan RAT.
   */
  check(
    'jumlah jasa modal seluruh anggota PERSIS sama dengan alokasinya',
    totalModal === Number(kModal.amount),
    `${totalModal} vs ${kModal.amount}`,
  );
  check(
    'jumlah jasa usaha seluruh anggota PERSIS sama dengan alokasinya',
    totalUsaha === Number(kUsaha.amount),
    `${totalUsaha} vs ${kUsaha.amount}`,
  );
  check(`${shu.length} anggota memperoleh SHU`, shu.length >= 50);
  check(
    'hanya anggota AKTIF yang memperoleh SHU',
    (
      await q(
        `SELECT COUNT(*)::int n FROM "${S}".cooperative_shu_distribution d
           JOIN "${S}".cooperative_member m ON m.id = d.member_id
          WHERE m.status <> 'ACTIVE'`,
      )
    )[0].n === 0,
  );

  // ------------------------------------------------- LAPORAN SIMPANAN
  log('');
  log('5. LAPORAN — Rekapitulasi Simpanan Anggota');
  log('');

  const simpanan = await q(
    `SELECT p.name, COUNT(*)::int rekening, SUM(a.balance)::numeric total
       FROM "${S}".cooperative_saving_account a
       JOIN "${S}".cooperative_saving_product p ON p.id = a.product_id
      WHERE a.account_number LIKE $1
      GROUP BY p.name ORDER BY total DESC`,
    [`${AWALAN_CONTOH}%`],
  );
  log('    Jenis Simpanan            Rekening              Saldo');
  log(`    ${'-'.repeat(56)}`);
  for (const s of simpanan) {
    log(`    ${s.name.padEnd(24)} ${String(s.rekening).padStart(8)}   Rp ${rp(s.total).padStart(14)}`);
  }
  const totalSimpanan = simpanan.reduce((s, x) => s + Number(x.total), 0);
  log(`    ${'-'.repeat(56)}`);
  log(`    ${'JUMLAH'.padEnd(24)} ${''.padStart(8)}   Rp ${rp(totalSimpanan).padStart(14)}`);
  log('');

  const mutasi = await q(
    `SELECT COUNT(*)::int n FROM "${S}".cooperative_saving_transaction
      WHERE idempotency_key LIKE $1`,
    [`${AWALAN_CONTOH}%`],
  );
  log(`    Mutasi sepanjang tahun buku: ${mutasi[0].n} baris`);
  log('');

  check('tiga jenis simpanan terisi', simpanan.length === 3);
  check('total simpanan lebih dari Rp 50 juta', totalSimpanan > 50_000_000);

  /*
   * Saldo rekening WAJIB sama dengan jumlah mutasinya. Rekening koran yang
   * saldo akhirnya tidak sama dengan mutasinya adalah laporan yang tidak dapat
   * dipertanggungjawabkan kepada anggota.
   */
  const selisih = await q(
    `SELECT COUNT(*)::int n FROM (
       SELECT a.id, a.balance, COALESCE(SUM(
         CASE WHEN t.transaction_type = 'DEPOSIT' THEN t.amount ELSE -t.amount END), 0) AS hitung
         FROM "${S}".cooperative_saving_account a
    LEFT JOIN "${S}".cooperative_saving_transaction t ON t.account_id = a.id
        WHERE a.account_number LIKE $1
        GROUP BY a.id, a.balance
     ) x WHERE x.balance <> x.hitung`,
    [`${AWALAN_CONTOH}%`],
  );
  check(
    'saldo setiap rekening sama dengan jumlah mutasinya',
    Number(selisih[0].n) === 0,
    `${selisih[0].n} rekening berselisih`,
  );

  // ------------------------------------------------------------ Penghapusan
  log('');
  log('6. Data contoh dihapus — data sungguhan tidak tersentuh');

  const hapus = await layanan.hapus(S);
  log(`  ${hapus.totalBaris} baris terhapus`);

  const sisaContoh = await q(
    `SELECT COUNT(*)::int n FROM "${S}".cooperative_member WHERE member_number LIKE $1`,
    [`${AWALAN_CONTOH}%`],
  );
  check('tidak ada anggota contoh tersisa', Number(sisaContoh[0].n) === 0);

  const sisaMutasi = await q(
    `SELECT COUNT(*)::int n FROM "${S}".cooperative_saving_transaction WHERE idempotency_key LIKE $1`,
    [`${AWALAN_CONTOH}%`],
  );
  check('tidak ada mutasi contoh tersisa', Number(sisaMutasi[0].n) === 0);

  const sisaShu = await q(
    `SELECT COUNT(*)::int n FROM "${S}".cooperative_shu_calculation WHERE input_fingerprint LIKE $1`,
    [`${AWALAN_CONTOH}%`],
  );
  check('tidak ada perhitungan SHU contoh tersisa', Number(sisaShu[0].n) === 0);

  const asliMasihAda = await q(
    `SELECT id, member_number FROM "${S}".cooperative_member WHERE id = ANY($1::uuid[])`,
    [anggotaAsli],
  );
  check(
    'SELURUH 3 anggota sungguhan masih ada',
    asliMasihAda.length === 3,
    `${asliMasihAda.length} dari 3`,
  );
  check(
    'anggota berkode "TOKO-CONTOH-RASA" TIDAK terhapus',
    asliMasihAda.some((a) => a.member_number.startsWith('TOKO-')),
  );
  check(
    'anggota berawalan huruf kecil TIDAK terhapus',
    asliMasihAda.some((a) => a.member_number.startsWith(AWALAN_CONTOH.toLowerCase())),
  );
  check(
    'koperasi sungguhan masih ada',
    (await q(`SELECT 1 FROM "${S}".cooperative WHERE id = $1`, [kopAsli[0].id])).length === 1,
  );

  // Pemasangan ulang setelah penghapusan.
  const ulang = await layanan.pasang(S, null);
  check('dapat dipasang ulang setelah dihapus', ulang.anggota === JUMLAH_ANGGOTA);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
  log(e.stack?.split('\n').slice(1, 4).join('\n') ?? '');
} finally {
  await client.query('ROLLBACK');
  log('');
  log('Seluruh perubahan digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-data-contoh.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
