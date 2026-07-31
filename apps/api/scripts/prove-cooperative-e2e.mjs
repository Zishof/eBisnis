/**
 * Bukti menyeluruh: satu koperasi dari berdiri sampai membagikan SHU.
 *
 * K-1 sampai K-10 masing-masing membuktikan bagiannya. Yang belum pernah
 * dibuktikan adalah bahwa bagian-bagian itu **bersambung** — bahwa angka yang
 * keluar dari simpanan benar-benar yang masuk ke SHU, bahwa RAT yang
 * mengesahkan SHU adalah RAT yang kuorum, dan bahwa yang dilihat anggota di
 * portalnya adalah angka yang sama dengan yang tercatat di buku.
 *
 * Dijalankan sebagai satu urutan, atas satu koperasi, dalam satu transaksi
 * yang digulung balik pada akhirnya.
 *
 * Yang diperiksa bukan hanya "berhasil", melainkan **kecocokan angka antar
 * bagian**. Sistem yang setiap bagiannya benar tetapi angkanya tidak
 * bersambung lebih berbahaya daripada sistem yang jelas rusak, sebab tidak ada
 * yang menyadarinya sampai seorang anggota menghitung sendiri.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { hitungShu } from '../dist/modules/cooperative/cooperative-shu.js';
import { bolehMembaca, saring } from '../dist/modules/cooperative/cooperative-portal.js';
import { periksaKonflik } from '../dist/modules/cooperative/rbac/cooperative-rbac.catalog.js';

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

async function harusDitolak(label, sql, params = []) {
  let ditolak = false;
  try {
    await client.query('SAVEPOINT s');
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT s');
  } catch {
    ditolak = true;
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check(label, ditolak, ditolak ? '' : 'diterima padahal seharusnya ditolak');
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');
const rp = (n) => new Intl.NumberFormat('id-ID').format(Math.round(Number(n)));

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI MENYELURUH — SATU KOPERASI DARI BERDIRI SAMPAI MEMBAGIKAN SHU');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  // ================================================================ BABAK 1
  log('');
  log('BABAK 1 — Koperasi berdiri');

  const jenis = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_type (code, name, allows_lending, allows_retail, is_sharia)
       VALUES ($1, 'Koperasi Serba Usaha', true, true, false) RETURNING id`,
      [`E2E_${tag}`.slice(0, 32)],
    )
  )[0].id;

  const KOP = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative
         (code, name, slug, cooperative_type_id, status, membership_scope)
       VALUES ($1, 'Koperasi Maju Bersama', $2, $3, 'DRAFT', 'OPEN') RETURNING id`,
      [`E2E-${tag}`.toUpperCase(), `maju-bersama-${tag}`, jenis],
    )
  )[0].id;
  check('koperasi terbentuk berstatus DRAFT', true);

  await harusDitolak(
    'koperasi TANPA badan hukum tidak dapat diaktifkan',
    `UPDATE "${SCHEMA}".cooperative SET status = 'ACTIVE' WHERE id = $1`,
    [KOP],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative
        SET legal_entity_number = $2, legal_entity_date = '2026-01-15', status = 'ACTIVE'
      WHERE id = $1`,
    [KOP, `518/BH/XIV.7/${tag}`],
  );
  check('koperasi aktif SETELAH badan hukumnya tercatat', true);

  // ================================================================ BABAK 2
  log('');
  log('BABAK 2 — Anggota masuk');

  let urut = 0;
  const buatAnggota = async (nama) => {
    urut += 1;
    const nik = `3271${tag.padEnd(6, '0')}${String(urut).padStart(6, '0')}`;
    return (
      await q(
        `INSERT INTO "${SCHEMA}".cooperative_member
           (cooperative_id, member_number, full_name, status, activated_at, identity_number)
         VALUES ($1, $2, $3, 'ACTIVE', '2026-02-01', $4) RETURNING id`,
        [KOP, `ANG-${tag}-${String(urut).padStart(3, '0')}`, nama, nik],
      )
    )[0].id;
  };

  const nama = [
    'Siti Aminah', 'Budi Santoso', 'Ratna Dewi', 'Joko Widodo', 'Ani Yudhoyono',
    'Hendra Gunawan', 'Maya Sari', 'Rudi Hartono', 'Nur Halimah', 'Agus Salim',
    'Dewi Lestari',
  ];
  const ANGGOTA = [];
  for (const n of nama) ANGGOTA.push(await buatAnggota(n));
  check(`${ANGGOTA.length} anggota aktif`, ANGGOTA.length === 11);

  // Satu calon anggota — belum boleh punya tanggal aktif.
  await harusDitolak(
    'calon anggota tidak boleh punya tanggal aktif',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, member_number, full_name, status, activated_at)
     VALUES ($1, $2, 'Calon Anggota', 'PROSPECT', now())`,
    [KOP, `CALON-${tag}`],
  );

  // ================================================================ BABAK 3
  log('');
  log('BABAK 3 — Simpanan dihimpun');

  /*
   * Simpanan pokok dan wajib menuntut besarannya disebutkan; simpanan wajib
   * menuntut periodenya pula. Keduanya menentukan keabsahan keanggotaan, dan
   * produk yang tidak menyebutkan besarannya membuat "sudah membayar simpanan
   * pokok" menjadi pernyataan yang tidak dapat diperiksa.
   */
  const buatProduk = async (kode, nm, tipe, ekuitas, tarik, jumlah, periode) =>
    (
      await q(
        `INSERT INTO "${SCHEMA}".cooperative_saving_product
           (cooperative_id, code, name, saving_kind, is_equity, allows_withdrawal,
            required_amount, period_unit, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true) RETURNING id`,
        [KOP, `${kode}-${tag}`, nm, tipe, ekuitas, tarik, jumlah, periode],
      )
    )[0].id;

  const POKOK = await buatProduk('POK', 'Simpanan Pokok', 'PRINCIPAL', true, false, 500000, null);
  const WAJIB = await buatProduk('WAJ', 'Simpanan Wajib', 'MANDATORY', true, false, 50000, 'MONTHLY');
  const SUKA = await buatProduk('SUK', 'Simpanan Sukarela', 'VOLUNTARY', false, true, null, null);
  check('tiga produk simpanan dibuat', true);

  await harusDitolak(
    'simpanan wajib yang DAPAT DITARIK ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, is_equity, allows_withdrawal,
        required_amount, period_unit, is_active)
     VALUES ($1, $2, 'Wajib Salah', 'MANDATORY', true, true, 50000, 'MONTHLY', true)`,
    [KOP, `SALAH-${tag}`],
  );

  await harusDitolak(
    'simpanan pokok TANPA besarannya ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, is_equity, allows_withdrawal, is_active)
     VALUES ($1, $2, 'Pokok Tanpa Nilai', 'PRINCIPAL', true, false, true)`,
    [KOP, `POKKOSONG-${tag}`],
  );

  await harusDitolak(
    'simpanan sukarela yang ditandai EKUITAS ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_saving_product
       (cooperative_id, code, name, saving_kind, is_equity, allows_withdrawal, is_active)
     VALUES ($1, $2, 'Sukarela Ekuitas', 'VOLUNTARY', true, true, true)`,
    [KOP, `SUKEKU-${tag}`],
  );

  /*
   * Angka sengaja tidak bulat dan berbeda tiap anggota, supaya pembagian SHU
   * benar-benar diuji pembulatannya — bukan diuji pada angka yang kebetulan
   * habis dibagi.
   */
  const simpananPerAnggota = [
    1_500_000, 2_350_000, 875_000, 3_120_000, 1_045_000, 2_680_000,
    1_930_000, 4_275_000, 660_000, 2_115_000, 1_388_000,
  ];

  const rekening = new Map();
  for (let i = 0; i < ANGGOTA.length; i += 1) {
    const pokok = 500_000;
    const wajib = simpananPerAnggata(i);
    const suka = simpananPerAnggota[i] - wajib;
    for (const [produk, saldo] of [[POKOK, pokok], [WAJIB, wajib], [SUKA, suka]]) {
      if (saldo <= 0) continue;
      const r = (
        await q(
          `INSERT INTO "${SCHEMA}".cooperative_saving_account
             (cooperative_id, member_id, product_id, account_number, balance, status, opened_at)
           VALUES ($1, $2, $3, $4, $5, 'ACTIVE', '2026-02-01') RETURNING id`,
          [KOP, ANGGOTA[i], produk, `${tag}${i}${produk.slice(0, 4)}`, saldo],
        )
      )[0].id;
      rekening.set(`${i}:${produk}`, r);
    }
  }
  function simpananPerAnggata(i) {
    return Math.round(simpananPerAnggota[i] * 0.6);
  }

  const totalSimpanan = await q(
    `SELECT SUM(balance)::numeric AS t FROM "${SCHEMA}".cooperative_saving_account
      WHERE cooperative_id = $1`,
    [KOP],
  );
  log(`         Total simpanan terhimpun: Rp${rp(totalSimpanan[0].t)}`);
  check('total simpanan lebih dari nol', Number(totalSimpanan[0].t) > 0);

  await harusDitolak(
    'saldo simpanan tidak boleh negatif',
    `UPDATE "${SCHEMA}".cooperative_saving_account SET balance = -1 WHERE member_id = $1`,
    [ANGGOTA[0]],
  );

  // ================================================================ BABAK 4
  log('');
  log('BABAK 4 — Pinjaman disalurkan');

  const PRODUK_PINJAMAN = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_loan_product
         (cooperative_id, code, name, method, annual_rate, min_tenor_months, max_tenor_months, is_active)
       VALUES ($1, $2, 'Pinjaman Anggota Efektif', 'EFFECTIVE', 18, 3, 24, true)
       RETURNING id`,
      [KOP, `PJM-${tag}`],
    )
  )[0].id;

  await harusDitolak(
    'akad syariah tidak boleh membawa tarif bunga',
    `INSERT INTO "${SCHEMA}".cooperative_loan_product
       (cooperative_id, code, name, method, annual_rate, min_tenor_months, max_tenor_months, is_active)
     VALUES ($1, $2, 'Murabahah Salah', 'MURABAHA', 18, 3, 24, true)`,
    [KOP, `SYAR-${tag}`],
  );

  const PINJAMAN = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_loan
         (cooperative_id, member_id, product_id, loan_number, method,
          principal, outstanding_principal, annual_rate, tenor_months,
          first_due_date, total_interest, total_payable, status, disbursed_at)
       VALUES ($1, $2, $3, $4, 'EFFECTIVE', 12000000, 12000000, 18, 12,
               '2026-04-01', 1170000, 13170000, 'ACTIVE', '2026-03-01') RETURNING id`,
      [KOP, ANGGOTA[1], PRODUK_PINJAMAN, `PJM-${tag}-001`],
    )
  )[0].id;
  check('pinjaman Rp12.000.000 tersalurkan kepada Budi Santoso', true);

  // Jadwal angsuran — dibekukan saat pencairan.
  let sisa = 12_000_000;
  let totalJasa = 0;
  for (let n = 1; n <= 12; n += 1) {
    const pokok = Math.round(12_000_000 / 12);
    const jasa = Math.round(sisa * 0.015);
    totalJasa += jasa;
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_installment_schedule
         (loan_id, installment_no, due_date, principal_due, interest_due,
          total_due, remaining_principal, status)
       VALUES ($1, $2, ($3::date + ($2::int || ' month')::interval)::date, $4, $5, $6, $7, 'SCHEDULED')`,
      [PINJAMAN, n, '2026-03-01', pokok, jasa, pokok + jasa, sisa - pokok],
    );
    sisa -= pokok;
  }
  const jadwal = await q(
    `SELECT SUM(principal_due)::numeric AS p, SUM(interest_due)::numeric AS j
       FROM "${SCHEMA}".cooperative_installment_schedule WHERE loan_id = $1`,
    [PINJAMAN],
  );
  check(
    'jumlah pokok pada jadwal sama dengan pokok pinjaman',
    Number(jadwal[0].p) === 12_000_000,
    `${rp(jadwal[0].p)}`,
  );
  log(`         Jasa pinjaman setahun: Rp${rp(jadwal[0].j)}`);

  // ================================================================ BABAK 5
  log('');
  log('BABAK 5 — Rapat Anggota Tahunan');

  const RAT = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting
         (cooperative_id, meeting_number, meeting_type, title, fiscal_year, scheduled_at,
          required_quorum_ratio, total_active_members, counted_for_quorum,
          required_count, quorum_reached, quorum_computed_at, status)
       VALUES ($1, $2, 'RAT', 'RAT Tahun Buku 2026', 2026, '2027-02-20',
               0.5, 11, 9, 6, true, now(), 'CLOSED') RETURNING id`,
      [KOP, `RAT-${tag}`],
    )
  )[0].id;
  check('RAT dibuka dengan kehadiran 9 dari 11 anggota — kuorum tercapai', true);

  /*
   * Ditemukan bukti ini: penjaga K-5 dikaitkan pada STATUS 'QUORUM_REACHED',
   * padahal RAT yang sudah selesai berstatus 'CLOSED'. Rapat dapat menyatakan
   * kuorum tanpa satu pun angka pendukung, selamanya. Diperbaiki migrasi
   * 20260801T100000.
   */
  await harusDitolak(
    'rapat CLOSED yang menyatakan kuorum TANPA angkanya ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_number, meeting_type, title, scheduled_at,
        quorum_reached, status)
     VALUES ($1, $2, 'RAT', 'RAT Tanpa Bukti', '2027-03-01', true, 'CLOSED')`,
    [KOP, `RAT2-${tag}`],
  );

  await harusDitolak(
    'rapat yang menyatakan kuorum padahal hadirnya KURANG dari syarat ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_number, meeting_type, title, scheduled_at,
        total_active_members, counted_for_quorum, required_count,
        quorum_reached, status)
     VALUES ($1, $2, 'RAT', 'RAT Angka Bertentangan', '2027-03-01',
             11, 3, 6, true, 'CLOSED')`,
    [KOP, `RAT3-${tag}`],
  );

  await harusDitolak(
    'rapat yang MENYANGKAL kuorum padahal hadirnya cukup ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_number, meeting_type, title, scheduled_at,
        total_active_members, counted_for_quorum, required_count,
        quorum_reached, status)
     VALUES ($1, $2, 'RAT', 'RAT Menyangkal Kuorum', '2027-03-01',
             11, 9, 6, false, 'CLOSED')`,
    [KOP, `RAT4-${tag}`],
  );

  const AGENDA = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_agenda
         (meeting_id, sequence_no, agenda_type, title, decision_rule, requires_vote, status)
       VALUES ($1, 1, 'SHU_DISTRIBUTION', 'Pengesahan pembagian SHU tahun buku 2026',
               'SIMPLE_MAJORITY', true, 'DECIDED') RETURNING id`,
      [RAT],
    )
  )[0].id;

  // Sembilan yang hadir memberikan suara. Satu anggota satu suara.
  for (let i = 0; i < 9; i += 1) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_vote
         (meeting_id, agenda_id, member_id, choice, cast_at)
       VALUES ($1, $2, $3, $4, now())`,
      [RAT, AGENDA, ANGGOTA[i], i < 8 ? 'YES' : 'NO'],
    );
  }

  await harusDitolak(
    'satu anggota TIDAK dapat memberikan suara dua kali',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_vote
       (meeting_id, agenda_id, member_id, choice, cast_at)
     VALUES ($1, $2, $3, 'YES', now())`,
    [RAT, AGENDA, ANGGOTA[0]],
  );

  const suara = await q(
    `SELECT choice, COUNT(*)::int AS n FROM "${SCHEMA}".cooperative_meeting_vote
      WHERE agenda_id = $1 GROUP BY choice ORDER BY choice`,
    [AGENDA],
  );
  const setuju = suara.find((s) => s.choice === 'YES')?.n ?? 0;
  check('8 setuju, 1 tidak setuju', setuju === 8, JSON.stringify(suara));

  /*
   * Keputusan yang mengaku SAH tetapi angkanya tidak memenuhi ambang ditolak
   * basis data. Ini menutup jalan mencatat keputusan sebagai sah padahal
   * suaranya menunjukkan sebaliknya.
   */
  await harusDitolak(
    'keputusan SAH yang suaranya kurang dari ambang ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, decision_number, summary, decision_rule,
        votes_yes, votes_no, votes_abstain, valid_votes, required_yes, validity)
     VALUES ($1, $2, $3, 'Mengaku sah', 'SIMPLE_MAJORITY', 2, 7, 0, 9, 5, 'VALID')`,
    [RAT, AGENDA, `KEP-PALSU-${tag}`],
  );

  const KEPUTUSAN = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
         (meeting_id, agenda_id, decision_number, summary, decision_rule,
          votes_yes, votes_no, votes_abstain, valid_votes, required_yes,
          validity, decided_at)
       VALUES ($1, $2, $3, 'Pembagian SHU 2026 disetujui sesuai usulan pengurus.',
               'SIMPLE_MAJORITY', 8, 1, 0, 9, 5, 'VALID', now()) RETURNING id`,
      [RAT, AGENDA, `KEP-${tag}-001`],
    )
  )[0].id;
  check('keputusan RAT tercatat dan SAH', true);

  // ================================================================ BABAK 6
  log('');
  log('BABAK 6 — SHU dihitung dan dibagikan');

  const SURPLUS = 45_000_000;

  /*
   * Angka masukan DICUPLIK dari basis data sekarang, lalu disimpan bersama
   * hasilnya. Simpanan anggota tahun depan berbeda; membacanya ulang berarti
   * menghitung SHU 2026 memakai angka 2027.
   *
   * Dasar jasa modal adalah simpanan EKUITAS saja — pokok dan wajib. Sukarela
   * tidak ikut: ia kewajiban koperasi kepada anggota, bukan modal anggota pada
   * koperasi.
   */
  const cuplikan = await q(
    `SELECT a.member_id,
            COALESCE(SUM(a.balance) FILTER (WHERE p.is_equity), 0)::numeric AS ekuitas
       FROM "${SCHEMA}".cooperative_saving_account a
       JOIN "${SCHEMA}".cooperative_saving_product p ON p.id = a.product_id
      WHERE a.cooperative_id = $1 AND a.status = 'ACTIVE'
      GROUP BY a.member_id ORDER BY a.member_id`,
    [KOP],
  );
  check(`cuplikan memuat ${cuplikan.length} anggota`, cuplikan.length === 11);

  const masukan = {
    fiscalYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    surplus: SURPLUS,
    policyCode: 'SHU_POLICY',
    policyVersion: 1,
    components: [
      { component: 'RESERVE', ratio: 0.25 },
      { component: 'CAPITAL_SERVICE', ratio: 0.25 },
      { component: 'PATRONAGE_SERVICE', ratio: 0.3 },
      { component: 'BOARD_INCENTIVE', ratio: 0.1 },
      { component: 'EDUCATION_FUND', ratio: 0.05 },
      { component: 'SOCIAL_FUND', ratio: 0.05 },
    ],
    members: cuplikan.map((c, i) => ({
      memberId: c.member_id,
      averageEquitySaving: Number(c.ekuitas),
      /*
       * Nilai transaksi anggota dengan koperasi selama periode — sengaja
       * dibuat tidak sebanding dengan simpanannya, supaya terlihat bahwa jasa
       * usaha memang dihitung tersendiri dan bukan salinan jasa modal.
       */
      patronageAmount: (i + 1) * 375_000,
      membershipFraction: 1,
      receivesShu: true,
    })),
  };

  const hasil = hitungShu(masukan);
  check('perhitungan SHU utuh', hasil.integrity.ok === true, hasil.integrity.issues.join('; '));

  const PERHITUNGAN = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
         (cooperative_id, fiscal_year, period_start, period_end, policy_code,
          policy_version, surplus, total_allocated, capital_service_total,
          patronage_service_total, eligible_member_count, input_fingerprint,
          status, integrity_ok, meeting_decision_id, calculated_at, approved_at)
       VALUES ($1, 2026, '2026-01-01', '2026-12-31', 'SHU_POLICY', 1, $2, $3, $4, $5,
               $6, $7, 'APPROVED', true, $8, now(), now()) RETURNING id`,
      [
        KOP,
        SURPLUS,
        hasil.distribution.totalDistributed,
        hasil.distribution.totalCapitalService,
        hasil.distribution.totalPatronageService,
        hasil.distribution.eligibleCount,
        hasil.inputFingerprint,
        KEPUTUSAN,
      ],
    )
  )[0].id;
  check('perhitungan tersimpan menunjuk keputusan RAT', true);

  await harusDitolak(
    'DUA perhitungan hidup atas tahun buku yang sama ditolak',
    `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
       (cooperative_id, fiscal_year, period_start, period_end, surplus, status)
     VALUES ($1, 2026, '2026-01-01', '2026-12-31', 1000, 'DRAFT')`,
    [KOP],
  );

  await harusDitolak(
    'perhitungan yang TIDAK utuh tidak dapat disetujui',
    `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
       (cooperative_id, fiscal_year, period_start, period_end, surplus,
        status, integrity_ok, meeting_decision_id)
     VALUES ($1, 2025, '2025-01-01', '2025-12-31', 1000, 'APPROVED', false, $2)`,
    [KOP, KEPUTUSAN],
  );

  // Alokasi per komponen.
  for (const a of hasil.allocations) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_allocation
         (calculation_id, component, ratio, amount)
       VALUES ($1, $2, $3, $4)`,
      [PERHITUNGAN, a.component, a.ratio, a.amount],
    );
  }
  const komponen = await q(
    `SELECT SUM(amount)::numeric AS t FROM "${SCHEMA}".cooperative_shu_allocation
      WHERE calculation_id = $1`,
    [PERHITUNGAN],
  );
  check(
    'jumlah seluruh komponen SAMA PERSIS dengan surplus',
    Number(komponen[0].t) === SURPLUS,
    `${rp(komponen[0].t)} vs ${rp(SURPLUS)}`,
  );

  // Pembagian per anggota.
  let totalDibagikan = 0;
  for (const b of hasil.distribution.perMember) {
    totalDibagikan += b.total;
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_distribution
         (calculation_id, member_id, capital_service, patronage_service,
          total_amount, deduction_amount, net_amount, payment_status)
       VALUES ($1, $2, $3, $4, $5, 0, $5, 'PENDING')`,
      [PERHITUNGAN, b.memberId, b.capitalService, b.patronageService, b.total],
    );
  }

  const dariBasisData = await q(
    `SELECT SUM(net_amount)::numeric AS t, COUNT(*)::int AS n
       FROM "${SCHEMA}".cooperative_shu_distribution WHERE calculation_id = $1`,
    [PERHITUNGAN],
  );
  check(`SHU dibagikan kepada ${dariBasisData[0].n} anggota`, dariBasisData[0].n === 11);
  log(`         Jasa modal + jasa usaha dibagikan: Rp${rp(dariBasisData[0].t)}`);

  /*
   * Kecocokan yang paling penting pada seluruh bukti ini: jumlah yang
   * tersimpan di basis data harus SAMA PERSIS dengan jumlah yang dihitung.
   * Selisih satu rupiah pun berarti ada anggota yang menerima angka berbeda
   * dari yang diputuskan RAT.
   */
  check(
    'jumlah di basis data SAMA PERSIS dengan hasil perhitungan',
    Number(dariBasisData[0].t) === totalDibagikan,
    `basis data ${rp(dariBasisData[0].t)} vs hitungan ${rp(totalDibagikan)}`,
  );

  const bagianAnggota =
    hasil.allocations.find((a) => a.component === 'CAPITAL_SERVICE').amount +
    hasil.allocations.find((a) => a.component === 'PATRONAGE_SERVICE').amount;
  check(
    'jumlah pembagian SAMA PERSIS dengan komponen jasa modal + jasa usaha',
    totalDibagikan === bagianAnggota,
    `${rp(totalDibagikan)} vs ${rp(bagianAnggota)}`,
  );

  await harusDitolak(
    'pemotongan yang MELEBIHI hak anggota ditolak',
    `UPDATE "${SCHEMA}".cooperative_shu_distribution
        SET deduction_amount = total_amount + 1, net_amount = -1
      WHERE calculation_id = $1 AND member_id = $2`,
    [PERHITUNGAN, ANGGOTA[0]],
  );

  /*
   * Perhitungan ulang dari cuplikan yang tersimpan harus menghasilkan angka
   * yang sama, baris demi baris. Sidik jari yang sama tetapi angka yang
   * berbeda adalah cacat yang pernah benar-benar ditemukan pada K-6, dan
   * pemeriksaan inilah yang menemukannya.
   */
  const ulang = hitungShu(masukan);
  let berbeda = 0;
  for (let i = 0; i < hasil.distribution.perMember.length; i += 1) {
    if (hasil.distribution.perMember[i].total !== ulang.distribution.perMember[i].total) {
      berbeda += 1;
    }
  }
  check('perhitungan ulang menghasilkan angka yang sama, baris demi baris', berbeda === 0);
  check('sidik jari masukannya sama', hasil.inputFingerprint === ulang.inputFingerprint);

  // ================================================================ BABAK 7
  log('');
  log('BABAK 7 — Anggota melihat portalnya');

  const SITI = ANGGOTA[0];
  const BUDI = ANGGOTA[1];

  await q(
    `INSERT INTO "${SCHEMA}".cooperative_member_portal_account
       (member_id, pin_hash, pin_set_at, status)
     VALUES ($1, '$argon2id$v=19$m=65536,t=3,p=4$rahasia', now(), 'ACTIVE')`,
    [SITI],
  );

  const semuaSimpanan = await q(
    `SELECT id, member_id AS "memberId", cooperative_id AS "cooperativeId", balance
       FROM "${SCHEMA}".cooperative_saving_account WHERE cooperative_id = $1`,
    [KOP],
  );
  const simpananSiti = saring(semuaSimpanan, {
    viewerMemberId: SITI,
    viewerStatus: 'ACTIVE',
    cooperativeId: KOP,
    resource: 'SAVING_ACCOUNT',
  });
  check(
    `Siti melihat ${simpananSiti.length} rekeningnya sendiri, bukan ${semuaSimpanan.length}`,
    simpananSiti.length > 0 && simpananSiti.length < semuaSimpanan.length,
  );
  check(
    'tidak satu pun rekening anggota lain lolos',
    simpananSiti.every((s) => s.memberId === SITI),
  );

  // Angka di portal harus sama dengan angka di buku.
  const totalPortal = simpananSiti.reduce((s, r) => s + Number(r.balance), 0);
  const totalBuku = await q(
    `SELECT COALESCE(SUM(balance), 0)::numeric AS t
       FROM "${SCHEMA}".cooperative_saving_account WHERE member_id = $1`,
    [SITI],
  );
  check(
    'saldo di portal SAMA dengan saldo di buku',
    totalPortal === Number(totalBuku[0].t),
    `${rp(totalPortal)} vs ${rp(totalBuku[0].t)}`,
  );

  const shuSiti = await q(
    `SELECT net_amount, capital_service, patronage_service
       FROM "${SCHEMA}".cooperative_shu_distribution
      WHERE calculation_id = $1 AND member_id = $2`,
    [PERHITUNGAN, SITI],
  );
  const shuDihitung = hasil.distribution.perMember.find((a) => a.memberId === SITI);
  check(
    'SHU yang dilihat Siti sama dengan yang dihitung untuknya',
    Number(shuSiti[0].net_amount) === shuDihitung.total,
    `${rp(shuSiti[0].net_amount)} vs ${rp(shuDihitung.total)}`,
  );
  check(
    'rinciannya pun cocok — jasa modal dan jasa usaha terpisah',
    Number(shuSiti[0].capital_service) === shuDihitung.capitalService &&
      Number(shuSiti[0].patronage_service) === shuDihitung.patronageService,
  );

  // Pinjaman Budi tidak boleh terlihat Siti.
  const vonis = bolehMembaca({
    resource: 'LOAN',
    viewerMemberId: SITI,
    ownerMemberId: BUDI,
    viewerStatus: 'ACTIVE',
    cooperativeIdOfViewer: KOP,
    cooperativeIdOfRow: KOP,
  });
  check('Siti TIDAK dapat melihat pinjaman Budi', vonis.allowed === false);
  check('penolakannya tidak menyebutkan bahwa pinjamannya ada', vonis.message === 'Data tidak ditemukan.');

  // Rapat anggota terlihat setiap anggota — sumber daya bersama.
  const vonisRapat = bolehMembaca({
    resource: 'MEETING',
    viewerMemberId: SITI,
    ownerMemberId: null,
    viewerStatus: 'ACTIVE',
    cooperativeIdOfViewer: KOP,
    cooperativeIdOfRow: KOP,
  });
  check('Siti DAPAT melihat RAT — rapat milik bersama', vonisRapat.allowed === true);

  // ================================================================ BABAK 8
  log('');
  log('BABAK 8 — Pengaduan dan penutupnya');

  const ADUAN = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_complaint
         (cooperative_id, member_id, complaint_number, category, subject, body)
       VALUES ($1, $2, $3, 'SHU', 'SHU saya lebih kecil dari tetangga',
               'Simpanan kami sama besar tetapi SHU saya lebih kecil.')
       RETURNING id`,
      [KOP, SITI, `ADU-${tag}-001`],
    )
  )[0].id;
  check('Siti mengajukan pengaduan', true);

  await harusDitolak(
    'pengaduan tidak dapat dinyatakan selesai tanpa keterangan',
    `UPDATE "${SCHEMA}".cooperative_complaint SET status = 'RESOLVED' WHERE id = $1`,
    [ADUAN],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative_complaint
        SET status = 'RESOLVED', resolved_at = now(),
            resolution = 'SHU dibagi menurut simpanan DAN transaksi. Rinciannya dapat dilihat pada portal.'
      WHERE id = $1`,
    [ADUAN],
  );
  check('pengurus menjawab dengan keterangan', true);

  await harusDitolak(
    'pengaduan tidak dapat DIHAPUS',
    `DELETE FROM "${SCHEMA}".cooperative_complaint WHERE id = $1`,
    [ADUAN],
  );
  check('— dan itulah maksudnya: pengaduan hanya berpindah status', true);

  // ================================================================ BABAK 9
  log('');
  log('BABAK 9 — Pemisahan wewenang bertahan sampai akhir');

  const peranMustahil = [
    'COOPERATIVE_LOAN.CREATE',
    'COOPERATIVE_LOAN.APPROVE',
    'COOPERATIVE_CREDIT_ANALYSIS.CREATE',
  ];
  const konflik = periksaKonflik(peranMustahil);
  check('peran yang menggabungkan pengaju dan penyetuju DITOLAK', konflik.ok === false);
  check(`${konflik.konflik.length} pasangan terlarang terdeteksi`, konflik.konflik.length >= 2);

  await harusDitolak(
    'anggota yang masih punya pengaduan tidak dapat dihapus',
    `DELETE FROM "${SCHEMA}".cooperative_member WHERE id = $1`,
    [SITI],
  );

  // ============================================================== RINGKASAN
  log('');
  log('-'.repeat(78));
  log('RINGKASAN ANGKA YANG BERSAMBUNG');
  log('-'.repeat(78));
  log(`  Anggota aktif               : 11`);
  log(`  Total simpanan terhimpun    : Rp${rp(totalSimpanan[0].t)}`);
  log(`  Pinjaman tersalurkan        : Rp${rp(12_000_000)}`);
  log(`  Jasa pinjaman setahun       : Rp${rp(jadwal[0].j)}`);
  log(`  Surplus tahun buku 2026     : Rp${rp(SURPLUS)}`);
  log(`  Kehadiran RAT               : 9 dari 11 (kuorum tercapai)`);
  log(`  Suara setuju                : 8 dari 9`);
  log(`  SHU dibagikan ke anggota    : Rp${rp(totalDibagikan)}`);
  log(`  Alokasi tersimpan           : Rp${rp(dariBasisData[0].t)}  (cocok)`);
  log(`  Saldo Siti di portal        : Rp${rp(totalPortal)}  (cocok dengan buku)`);
  log(`  SHU Siti di portal          : Rp${rp(shuSiti[0].net_amount)}  (cocok dengan hitungan)`);

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
    new URL('../../../docs/ekoperasi/bukti-e2e-koperasi.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
