/**
 * Bukti K-6: SHU dan patronage.
 *
 * Yang dibuktikan berpusat pada satu sifat:
 *
 *   **Perhitungan SHU harus dapat diulang.**
 *
 * Di sini dibuktikan pada basis data sungguhan: sebuah perhitungan dijalankan,
 * disimpan, lalu **dihitung ulang dari cuplikan yang tersimpan** — dan hasilnya
 * dibandingkan baris demi baris. Bila keduanya berbeda, angka SHU koperasi
 * tidak dapat dipertanggungjawabkan pada RAT.
 *
 * Selebihnya menguji penjaga basis data: pembagian tanpa keputusan RAT,
 * perhitungan yang tidak utuh, pemotongan melebihi hak, dan dua perhitungan
 * atas tahun buku yang sama.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  bagianMasaKeanggotaan,
  hitungShu,
  periksaKebijakan,
} from '../dist/modules/cooperative/cooperative-shu.js';

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

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI K-6 — SHU DAN PATRONAGE');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel K-6 terpasang');
  for (const t of [
    'cooperative_shu_component', 'cooperative_shu_calculation',
    'cooperative_shu_allocation', 'cooperative_member_patronage',
    'cooperative_shu_distribution', 'cooperative_shu_statement',
  ]) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  // --- Persiapan koperasi dan anggota ---
  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti K6') RETURNING id`,
    [`K6_${tag}`.slice(0, 32)],
  );
  const coopId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-6', $2, $3, 'DRAFT') RETURNING id`,
      [`K6-${tag}`.toUpperCase(), `bukti-k6-${tag}`, jenis[0].id],
    )
  )[0].id;

  // Sebelas anggota dengan simpanan dan transaksi yang tidak bulat, supaya
  // pembulatan benar-benar diuji.
  const anggota = [];
  for (let i = 1; i <= 11; i += 1) {
    const m = await q(
      `INSERT INTO "${SCHEMA}".cooperative_member
         (cooperative_id, full_name, status, member_number, activated_at)
       VALUES ($1, $2, 'ACTIVE', $3, $4) RETURNING id`,
      [
        coopId,
        `Anggota ${i}`,
        `K6-2026-${String(i).padStart(5, '0')}`,
        i <= 9 ? '2025-01-01' : '2026-07-01', // dua anggota masuk pertengahan tahun
      ],
    );
    anggota.push({
      id: m[0].id,
      simpanan: 1_000_000 + i * 337_117,
      transaksi: 2_000_000 + i * 911_733,
      activatedAt: i <= 9 ? '2025-01-01' : '2026-07-01',
    });
  }

  log('');
  log('2. Kebijakan SHU wajib berjumlah tepat 100%');
  const kebijakan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_policy
       (cooperative_id, policy_type, code, name, version_no, effective_from,
        status, approved_at)
     VALUES ($1, 'SHU_POLICY', 'SHU_POLICY', 'Kebijakan SHU 2026', 1, '2026-01-01',
             'ACTIVE', now()) RETURNING id`,
    [coopId],
  );
  const komponen = [
    ['RESERVE', 0.25],
    ['CAPITAL_SERVICE', 0.25],
    ['PATRONAGE_SERVICE', 0.3],
    ['EDUCATION_FUND', 0.1],
    ['SOCIAL_FUND', 0.05],
    ['BOARD_INCENTIVE', 0.05],
  ];
  for (const [kode, rasio] of komponen) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_component
         (cooperative_id, policy_id, component, ratio) VALUES ($1, $2, $3, $4)`,
      [coopId, kebijakan[0].id, kode, rasio],
    );
  }
  const v = periksaKebijakan(komponen.map(([component, ratio]) => ({ component, ratio })));
  check('kebijakan enam komponen berjumlah 100%', v.allowed, v.message);

  await harusDitolak(
    'komponen yang tercantum dua kali DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_shu_component
       (cooperative_id, policy_id, component, ratio) VALUES ($1, $2, 'RESERVE', 0.1)`,
    [coopId, kebijakan[0].id],
  );

  log('');
  log('3. Menghitung SHU dan menyimpan cuplikannya');
  const SURPLUS = 87_654_321;
  const dasarAnggota = anggota.map((a) => ({
    memberId: a.id,
    averageEquitySaving: a.simpanan,
    patronageAmount: a.transaksi,
    membershipFraction: bagianMasaKeanggotaan(a.activatedAt, null, '2026-01-01', '2026-12-31'),
    receivesShu: true,
  }));

  const cuplikan = {
    fiscalYear: 2026,
    periodStart: '2026-01-01',
    periodEnd: '2026-12-31',
    surplus: SURPLUS,
    policyCode: 'SHU_POLICY',
    policyVersion: 1,
    components: komponen.map(([component, ratio]) => ({ component, ratio })),
    members: dasarAnggota,
  };

  const hasil = hitungShu(cuplikan);
  check('perhitungan utuh', hasil.integrity.ok, hasil.integrity.issues.join('; '));
  log(`   sidik jari masukan: ${hasil.inputFingerprint}`);

  const perhitungan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
       (cooperative_id, fiscal_year, period_start, period_end, policy_id, policy_code,
        policy_version, surplus, total_allocated, capital_service_total,
        patronage_service_total, eligible_member_count, input_fingerprint,
        status, integrity_ok)
     VALUES ($1, 2026, '2026-01-01', '2026-12-31', $2, 'SHU_POLICY', 1, $3, $3,
             $4, $5, $6, $7, 'CALCULATED', TRUE) RETURNING id`,
    [
      coopId, kebijakan[0].id, SURPLUS,
      hasil.distribution.totalCapitalService,
      hasil.distribution.totalPatronageService,
      hasil.distribution.eligibleCount,
      hasil.inputFingerprint,
    ],
  );
  const calcId = perhitungan[0].id;

  for (const a of hasil.allocations) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_allocation
         (calculation_id, component, ratio, amount) VALUES ($1, $2, $3, $4)`,
      [calcId, a.component, a.ratio, a.amount],
    );
  }
  for (const d of dasarAnggota) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_member_patronage
         (calculation_id, member_id, unit_business_amount, patronage_amount,
          average_equity_saving, membership_fraction, receives_shu)
       VALUES ($1, $2, $3, $3, $4, $5, TRUE)`,
      [calcId, d.memberId, d.patronageAmount, d.averageEquitySaving, d.membershipFraction],
    );
  }
  for (const m of hasil.distribution.perMember) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_shu_distribution
         (calculation_id, member_id, capital_service, patronage_service, total_amount,
          net_amount)
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [calcId, m.memberId, m.capitalService, m.patronageService, m.total],
    );
  }

  const jumlahAlokasi = await q(
    `SELECT SUM(amount)::numeric s FROM "${SCHEMA}".cooperative_shu_allocation
      WHERE calculation_id = $1`,
    [calcId],
  );
  check(
    'jumlah alokasi komponen persis sama dengan surplus',
    Number(jumlahAlokasi[0].s) === SURPLUS,
    `${jumlahAlokasi[0].s} vs ${SURPLUS}`,
  );

  log('');
  log('4. PERHITUNGAN ULANG DARI CUPLIKAN MENGHASILKAN ANGKA YANG SAMA');
  const cuplikanTersimpan = await q(
    `SELECT p.member_id, p.average_equity_saving, p.patronage_amount,
            p.membership_fraction, p.receives_shu
       FROM "${SCHEMA}".cooperative_member_patronage p
      WHERE p.calculation_id = $1`,
    [calcId],
  );
  const komponenTersimpan = await q(
    `SELECT component, ratio FROM "${SCHEMA}".cooperative_shu_allocation
      WHERE calculation_id = $1`,
    [calcId],
  );
  const kepala = await q(
    `SELECT surplus, policy_code, policy_version, input_fingerprint,
            period_start::text, period_end::text, fiscal_year
       FROM "${SCHEMA}".cooperative_shu_calculation WHERE id = $1`,
    [calcId],
  );

  const ulang = hitungShu({
    fiscalYear: kepala[0].fiscal_year,
    periodStart: kepala[0].period_start,
    periodEnd: kepala[0].period_end,
    surplus: Number(kepala[0].surplus),
    policyCode: kepala[0].policy_code,
    policyVersion: kepala[0].policy_version,
    components: komponenTersimpan.map((k) => ({
      component: k.component,
      ratio: Number(k.ratio),
    })),
    members: cuplikanTersimpan.map((m) => ({
      memberId: m.member_id,
      averageEquitySaving: Number(m.average_equity_saving),
      patronageAmount: Number(m.patronage_amount),
      membershipFraction: Number(m.membership_fraction),
      receivesShu: m.receives_shu,
    })),
  });

  check(
    'sidik jari perhitungan ulang SAMA dengan yang tersimpan',
    ulang.inputFingerprint === kepala[0].input_fingerprint,
    `${ulang.inputFingerprint} vs ${kepala[0].input_fingerprint}`,
  );

  const tersimpan = await q(
    `SELECT member_id, capital_service::numeric c, patronage_service::numeric p
       FROM "${SCHEMA}".cooperative_shu_distribution
      WHERE calculation_id = $1 ORDER BY member_id`,
    [calcId],
  );
  let cocok = 0;
  let beda = 0;
  for (const t of tersimpan) {
    const u = ulang.distribution.perMember.find((m) => m.memberId === t.member_id);
    if (u && Number(t.c) === u.capitalService && Number(t.p) === u.patronageService) cocok += 1;
    else beda += 1;
  }
  check(
    `bagian ${cocok} anggota SAMA PERSIS sampai ke rupiah terakhir`,
    beda === 0 && cocok === tersimpan.length,
    `${beda} berbeda`,
  );

  log('');
  log('5. Dua anggota yang masuk pertengahan tahun memperoleh bagian lebih kecil');
  const penuh = ulang.distribution.perMember.find((m) => m.memberId === anggota[0].id);
  const separuh = ulang.distribution.perMember.find((m) => m.memberId === anggota[10].id);
  check(
    'anggota setahun penuh memperoleh jasa modal lebih besar per rupiah simpanannya',
    penuh.capitalService / anggota[0].simpanan > separuh.capitalService / anggota[10].simpanan,
  );

  log('');
  log('6. Satu perhitungan hidup per tahun buku');
  await harusDitolak(
    'perhitungan kedua atas tahun buku yang sama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
       (cooperative_id, fiscal_year, period_start, period_end, policy_code,
        policy_version, surplus, input_fingerprint, status)
     VALUES ($1, 2026, '2026-01-01', '2026-12-31', 'SHU_POLICY', 1, 1, 'x', 'DRAFT')`,
    [coopId],
  );

  log('');
  log('7. Pembagian SHU menuntut keputusan RAT yang sah');
  await harusDitolak(
    'perhitungan APPROVED tanpa keputusan RAT DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_shu_calculation SET status = 'APPROVED' WHERE id = $1`,
    [calcId],
  );

  // Keputusan RAT yang sah
  const rapat = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_type, title, scheduled_at, status,
        total_active_members, counted_for_quorum, required_count, quorum_reached,
        quorum_computed_at)
     VALUES ($1, 'RAT', 'RAT 2026', now(), 'QUORUM_REACHED', 11, 8, 6, TRUE, now())
     RETURNING id`,
    [coopId],
  );
  const agenda = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_agenda
       (meeting_id, sequence_no, agenda_type, title)
     VALUES ($1, 1, 'SHU_DISTRIBUTION', 'Pembagian SHU 2026') RETURNING id`,
    [rapat[0].id],
  );
  const keputusan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
        valid_votes, required_yes, validity)
     VALUES ($1, $2, 'Pembagian SHU 2026 disetujui', 'SIMPLE_MAJORITY', 7, 1, 8, 5, 'VALID')
     RETURNING id`,
    [rapat[0].id, agenda[0].id],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative_shu_calculation
        SET status = 'APPROVED', meeting_decision_id = $2, approved_at = now() WHERE id = $1`,
    [calcId, keputusan[0].id],
  );
  const disetujui = await q(
    `SELECT status FROM "${SCHEMA}".cooperative_shu_calculation WHERE id = $1`,
    [calcId],
  );
  check('perhitungan dengan keputusan RAT DITERIMA', disetujui[0].status === 'APPROVED');

  log('');
  log('8. Perhitungan yang tidak utuh tidak dapat disetujui');
  await harusDitolak(
    'perhitungan integrity_ok = FALSE berstatus APPROVED DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_shu_calculation
       (cooperative_id, fiscal_year, period_start, period_end, policy_code,
        policy_version, surplus, input_fingerprint, status, integrity_ok,
        meeting_decision_id)
     VALUES ($1, 2025, '2025-01-01', '2025-12-31', 'SHU_POLICY', 1, 1000, 'y',
             'APPROVED', FALSE, $2)`,
    [coopId, keputusan[0].id],
  );

  log('');
  log('9. Pemotongan tidak boleh melebihi hak anggota');
  const satu = await q(
    `SELECT id, total_amount FROM "${SCHEMA}".cooperative_shu_distribution
      WHERE calculation_id = $1 LIMIT 1`,
    [calcId],
  );
  await harusDitolak(
    'pemotongan melebihi hak DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_shu_distribution
        SET deduction_amount = total_amount + 1, net_amount = -1,
            deduction_note = 'Tunggakan' WHERE id = $1`,
    [satu[0].id],
  );
  await harusDitolak(
    'pemotongan tanpa alasan DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_shu_distribution
        SET deduction_amount = 1000, net_amount = total_amount - 1000 WHERE id = $1`,
    [satu[0].id],
  );
  await q(
    `UPDATE "${SCHEMA}".cooperative_shu_distribution
        SET deduction_amount = 1000, net_amount = total_amount - 1000,
            deduction_note = 'Tunggakan simpanan wajib 2026-11' WHERE id = $1`,
    [satu[0].id],
  );
  check('pemotongan beralasan dan dalam batas DITERIMA', true);

  log('');
  log('10. Rincian patronage wajib menjelaskan totalnya');
  const pat = await q(
    `SELECT id FROM "${SCHEMA}".cooperative_member_patronage WHERE calculation_id = $1 LIMIT 1`,
    [calcId],
  );
  await harusDitolak(
    'rincian patronage yang tidak berjumlah totalnya DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_member_patronage
        SET unit_business_amount = 1, loan_interest_amount = 1, service_amount = 1
      WHERE id = $1`,
    [pat[0].id],
  );

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
    new URL('../../../docs/ekoperasi/bukti-k6-shu.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
