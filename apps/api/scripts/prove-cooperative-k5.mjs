/**
 * Bukti K-5: rapat anggota, kuorum, pemungutan suara, dan keputusan.
 *
 * Ditambah **bukti pemisahan data antar koperasi** — pertanyaan yang wajar
 * ditanyakan pemilik sistem, dan yang lebih baik dijawab dengan bukti daripada
 * dengan pernyataan.
 *
 * Yang dibuktikan:
 *
 * - satu anggota satu suara per mata acara, ditegakkan basis data;
 * - keputusan tanpa kuorum ditandai tidak sah, bukan dihilangkan;
 * - keputusan sah wajib benar-benar memenuhi ambangnya;
 * - notulen susunan AI wajib diperiksa manusia sebelum disahkan;
 * - **data koperasi berada pada skema terpisah dan tidak dapat bertemu.**
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

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

// --- Bagian A: pemisahan data antar koperasi (di luar transaksi) -----------
try {
  log('='.repeat(78));
  log('BUKTI K-5 — RAPAT ANGGOTA, VOTING, DAN PEMISAHAN DATA ANTAR KOPERASI');
  log(`Waktu  : ${new Date().toISOString()}`);
  log('='.repeat(78));

  log('');
  log('A. Pemisahan data antar koperasi');

  const daftar = await q(
    `SELECT schema_name, tenant_id FROM platform.tenant_schema_registry ORDER BY created_at`,
  );
  log(`   ${daftar.length} penyewa terdaftar, masing-masing pada skema tersendiri.`);
  check('setiap penyewa punya skema sendiri', daftar.length > 0);

  const skemaUnik = new Set(daftar.map((d) => d.schema_name));
  check(
    'tidak ada dua penyewa berbagi satu skema',
    skemaUnik.size === daftar.length,
    `${daftar.length} penyewa, ${skemaUnik.size} skema`,
  );

  const tenantUnik = new Set(daftar.map((d) => d.tenant_id));
  check('tidak ada dua skema menunjuk satu penyewa', tenantUnik.size === daftar.length);

  // Skema benar-benar ada sebagai skema PostgreSQL, bukan sekadar baris registri.
  const adaSkema = await q(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1::text[])`,
    [daftar.map((d) => d.schema_name)],
  );
  check(
    'setiap skema terdaftar benar-benar ada di basis data',
    adaSkema.length === daftar.length,
    `${adaSkema.length} dari ${daftar.length}`,
  );

  // Penjaga satu koperasi per skema.
  const penjaga = await q(
    `SELECT indexdef FROM pg_indexes
      WHERE schemaname = $1 AND indexname = 'ux_cooperative_single_per_tenant'`,
    [SCHEMA],
  );
  check('indeks penjaga satu koperasi per skema terpasang', penjaga.length === 1);

  /*
   * Tabel koperasi TIDAK memiliki kolom pembeda penyewa — dan itu memang
   * benar. Pemisahannya ada pada skemanya, bukan pada kolom penyaring. Kueri
   * yang lupa menyaring tidak dapat membocorkan data penyewa lain, sebab data
   * penyewa lain tidak berada pada skema itu sama sekali.
   */
  const kolomTenant = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'cooperative_member'
        AND column_name IN ('tenant_id', 'schema_name')`,
    [SCHEMA],
  );
  check(
    'tabel anggota tidak memakai kolom penyaring penyewa — pemisahannya di skema',
    kolomTenant.length === 0,
  );
} catch (e) {
  failures += 1;
  log(`GALAT bagian A: ${e.message}`);
}

// --- Bagian B: rapat anggota (di dalam transaksi yang digulung balik) ------
await client.query('BEGIN');

try {
  log('');
  log('B. Tabel K-5 terpasang');
  for (const t of [
    'cooperative_meeting', 'cooperative_meeting_agenda', 'cooperative_meeting_invitation',
    'cooperative_meeting_attendance', 'cooperative_meeting_vote',
    'cooperative_meeting_decision', 'cooperative_meeting_follow_up',
    'cooperative_meeting_minutes',
  ]) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti K5') RETURNING id`,
    [`K5_${tag}`.slice(0, 32)],
  );
  const coopId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-5', $2, $3, 'DRAFT') RETURNING id`,
      [`K5-${tag}`.toUpperCase(), `bukti-k5-${tag}`, jenis[0].id],
    )
  )[0].id;

  const anggota = [];
  for (let i = 1; i <= 5; i += 1) {
    const m = await q(
      `INSERT INTO "${SCHEMA}".cooperative_member
         (cooperative_id, full_name, status, member_number, activated_at)
       VALUES ($1, $2, 'ACTIVE', $3, now()) RETURNING id`,
      [coopId, `Anggota ${i}`, `K5-2026-0000${i}`],
    );
    anggota.push(m[0].id);
  }

  log('');
  log('C. Tabel suara TIDAK memiliki kolom bobot');
  const kolomBobot = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'cooperative_meeting_vote'
        AND column_name ~* 'weight|bobot|share|saving|capital'`,
    [SCHEMA],
  );
  check(
    'tidak ada kolom bobot, simpanan, maupun modal pada tabel suara',
    kolomBobot.length === 0,
    kolomBobot.map((k) => k.column_name).join(', '),
  );

  log('');
  log('D. Rapat dan mata acara');
  const rapat = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_type, title, scheduled_at, required_quorum_ratio,
        second_call_quorum_ratio, max_proxy_per_holder, status,
        total_active_members, counted_for_quorum, required_count, quorum_reached,
        quorum_computed_at)
     VALUES ($1, 'RAT', 'RAT Tahun Buku 2026', now(), 0.5, 0.25, 2, 'QUORUM_REACHED',
             5, 4, 3, TRUE, now())
     RETURNING id`,
    [coopId],
  );
  const rapatId = rapat[0].id;
  check('rapat dibuka dengan kuorum tercatat', Boolean(rapatId));

  await harusDitolak(
    'rapat QUORUM_REACHED tanpa angka pembuktinya DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_type, title, scheduled_at, status)
     VALUES ($1, 'RAT', 'RAT Tanpa Bukti', now(), 'QUORUM_REACHED')`,
    [coopId],
  );

  await harusDitolak(
    'kuorum rapat kedua yang lebih berat daripada rapat pertama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting
       (cooperative_id, meeting_type, title, scheduled_at,
        required_quorum_ratio, second_call_quorum_ratio)
     VALUES ($1, 'RAT', 'Rapat Aneh', now(), 0.5, 0.75)`,
    [coopId],
  );

  const agenda = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_agenda
       (meeting_id, sequence_no, agenda_type, title, decision_rule)
     VALUES ($1, 1, 'SHU_DISTRIBUTION', 'Pembagian SHU 2026', 'SIMPLE_MAJORITY')
     RETURNING id`,
    [rapatId],
  );
  const agendaId = agenda[0].id;

  log('');
  log('E. Kehadiran');
  for (let i = 0; i < 3; i += 1) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_attendance (meeting_id, member_id, mode)
       VALUES ($1, $2, 'IN_PERSON')`,
      [rapatId, anggota[i]],
    );
  }
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_attendance
       (meeting_id, member_id, mode, proxy_holder_member_id)
     VALUES ($1, $2, 'PROXY', $3)`,
    [rapatId, anggota[3], anggota[0]],
  );
  check('empat kehadiran tercatat', true);

  await harusDitolak(
    'anggota tercatat hadir dua kali DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_attendance (meeting_id, member_id, mode)
     VALUES ($1, $2, 'ONLINE')`,
    [rapatId, anggota[0]],
  );

  await harusDitolak(
    'kuasa kepada diri sendiri DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_attendance
       (meeting_id, member_id, mode, proxy_holder_member_id)
     VALUES ($1, $2, 'PROXY', $2)`,
    [rapatId, anggota[4]],
  );

  await harusDitolak(
    'kehadiran berkuasa tanpa pemegang kuasa DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_attendance (meeting_id, member_id, mode)
     VALUES ($1, $2, 'PROXY')`,
    [rapatId, anggota[4]],
  );

  log('');
  log('F. Satu anggota satu suara per mata acara');
  for (let i = 0; i < 3; i += 1) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_meeting_vote
         (meeting_id, agenda_id, member_id, choice) VALUES ($1, $2, $3, 'YES')`,
      [rapatId, agendaId, anggota[i]],
    );
  }
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_vote
       (meeting_id, agenda_id, member_id, cast_by_member_id, choice, channel)
     VALUES ($1, $2, $3, $4, 'NO', 'PROXY')`,
    [rapatId, agendaId, anggota[3], anggota[0]],
  );

  await harusDitolak(
    'anggota memilih dua kali pada mata acara yang sama DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_vote
       (meeting_id, agenda_id, member_id, choice) VALUES ($1, $2, $3, 'NO')`,
    [rapatId, agendaId, anggota[0]],
  );

  const suara = await q(
    `SELECT choice, count(*)::int n FROM "${SCHEMA}".cooperative_meeting_vote
      WHERE agenda_id = $1 GROUP BY choice ORDER BY choice`,
    [agendaId],
  );
  const setuju = suara.find((s) => s.choice === 'YES')?.n ?? 0;
  const tolak = suara.find((s) => s.choice === 'NO')?.n ?? 0;
  check('tiga setuju, satu menolak', setuju === 3 && tolak === 1);

  log('');
  log('G. Keputusan');
  await harusDitolak(
    'keputusan SAH padahal suaranya belum mencapai ambang DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
        valid_votes, required_yes, validity)
     VALUES ($1, $2, 'SHU disetujui', 'SIMPLE_MAJORITY', 1, 3, 4, 3, 'VALID')`,
    [rapatId, agendaId],
  );

  await harusDitolak(
    'suara sah yang tidak sama dengan setuju + tidak setuju DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
        votes_abstain, valid_votes, required_yes)
     VALUES ($1, $2, 'Salah hitung', 'SIMPLE_MAJORITY', 3, 1, 2, 6, 3)`,
    [rapatId, agendaId],
  );

  const keputusan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, decision_number, summary, decision_rule,
        votes_yes, votes_no, votes_abstain, valid_votes, required_yes, validity)
     VALUES ($1, $2, $3, 'Pembagian SHU 2026 disetujui', 'SIMPLE_MAJORITY',
             3, 1, 0, 4, 3, 'VALID') RETURNING id`,
    [rapatId, agendaId, `KEP-${tag}-001`],
  );
  check('keputusan sah dengan angka yang membuktikannya DITERIMA', keputusan.length === 1);

  log('');
  log('H. Keputusan tanpa kuorum DITANDAI tidak sah, bukan dihilangkan');
  const agenda2 = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_agenda
       (meeting_id, sequence_no, agenda_type, title, decision_rule)
     VALUES ($1, 2, 'BYLAW_AMENDMENT', 'Perubahan AD/ART', 'TWO_THIRDS') RETURNING id`,
    [rapatId],
  );
  await harusDitolak(
    'keputusan tidak sah tanpa keterangan sebabnya DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
        valid_votes, required_yes, validity)
     VALUES ($1, $2, 'AD/ART diubah', 'TWO_THIRDS', 2, 2, 4, 3, 'INVALID_NO_QUORUM')`,
    [rapatId, agenda2[0].id],
  );
  const tidakSah = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_decision
       (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
        valid_votes, required_yes, validity, invalidity_note)
     VALUES ($1, $2, 'AD/ART diubah', 'TWO_THIRDS', 2, 2, 4, 3, 'INVALID_NO_QUORUM',
             'Kuorum tidak tercapai; diagendakan ulang pada RALB berikutnya')
     RETURNING id, validity`,
    [rapatId, agenda2[0].id],
  );
  check(
    'keputusan tanpa kuorum TERSIMPAN dan ditandai tidak sah',
    tidakSah[0].validity === 'INVALID_NO_QUORUM',
  );

  log('');
  log('I. Notulen susunan AI wajib diperiksa manusia');
  await harusDitolak(
    'notulen AI disahkan tanpa pemeriksaan manusia DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_minutes
       (meeting_id, content, drafted_by_ai, status, approved_by_member_id, approved_at)
     VALUES ($1, 'Notulen susunan AI', TRUE, 'APPROVED', $2, now())`,
    [rapatId, anggota[0]],
  );
  const notulen = await q(
    `INSERT INTO "${SCHEMA}".cooperative_meeting_minutes
       (meeting_id, content, drafted_by_ai, status, reviewed_by, reviewed_at,
        approved_by_member_id, approved_at)
     VALUES ($1, 'Notulen susunan AI, sudah diperiksa', TRUE, 'APPROVED',
             gen_random_uuid(), now(), $2, now()) RETURNING id`,
    [rapatId, anggota[0]],
  );
  check('notulen AI yang sudah diperiksa manusia DITERIMA', notulen.length === 1);

  await harusDitolak(
    'notulen disahkan tanpa menyebut pengesahnya DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_meeting_minutes
       (meeting_id, content, status) VALUES ($1, 'Notulen lain', 'APPROVED')`,
    [rapatId],
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
  log('Perubahan bagian B digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-k5-rat.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
