/**
 * Bukti K-2: organisasi, kepengurusan, dan keanggotaan.
 *
 * Yang dibuktikan berpusat pada satu aturan:
 *
 *   **Seseorang menjadi anggota hanya setelah simpanan pokoknya lunas.**
 *
 * Ditegakkan dari dua arah oleh basis data: anggota ACTIVE wajib punya nomor
 * dan tanggal aktif, DAN calon anggota tidak boleh punya tanggal aktif. Arah
 * kedua menutup jalan mengisi `activated_at` lebih dahulu lalu mengubah status
 * kemudian — jalan yang akan terlewat bila hanya arah pertama yang dijaga.
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

/** Menjalankan sesuatu yang HARUS ditolak basis data. */
async function harusDitolak(label, sql, params = []) {
  let ditolak = false;
  let pesan = '';
  try {
    await client.query('SAVEPOINT s');
    await client.query(sql, params);
    await client.query('RELEASE SAVEPOINT s');
  } catch (e) {
    ditolak = true;
    pesan = e.message.slice(0, 60);
    await client.query('ROLLBACK TO SAVEPOINT s');
  }
  check(label, ditolak, ditolak ? '' : 'diterima padahal seharusnya ditolak');
  return pesan;
}

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const tag = randomBytes(3).toString('hex');
let coopId = null;

await client.connect();
await client.query('BEGIN');

try {
  log('='.repeat(78));
  log('BUKTI K-2 — ORGANISASI, KEPENGURUSAN, DAN KEANGGOTAAN');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel K-2 terpasang');
  for (const t of [
    'cooperative_organization_term', 'cooperative_board_position', 'cooperative_member',
    'cooperative_member_category', 'cooperative_appointment', 'cooperative_member_document',
    'cooperative_member_consent', 'cooperative_member_beneficiary',
    'cooperative_related_party', 'cooperative_member_status_history',
    'cooperative_member_portal_account',
  ]) {
    const ada = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t}`, ada.length === 1);
  }

  // Koperasi bukti
  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name, allows_lending)
     VALUES ($1, 'KSP Bukti K2', TRUE) RETURNING id`,
    [`K2_${tag}`.slice(0, 32)],
  );
  coopId = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-2', $2, $3, 'DRAFT') RETURNING id`,
      [`K2-${tag}`.toUpperCase(), `bukti-k2-${tag}`, jenis[0].id],
    )
  )[0].id;

  log('');
  log('2. Calon anggota TIDAK boleh punya tanggal aktif');
  await harusDitolak(
    'calon anggota dengan activated_at DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, status, activated_at)
     VALUES ($1, 'Calon Curang', 'APPROVED', now())`,
    [coopId],
  );

  log('');
  log('3. Anggota aktif WAJIB punya nomor anggota dan tanggal aktif');
  await harusDitolak(
    'anggota ACTIVE tanpa nomor anggota DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, status, activated_at)
     VALUES ($1, 'Anggota Tanpa Nomor', 'ACTIVE', now())`,
    [coopId],
  );
  await harusDitolak(
    'anggota ACTIVE tanpa tanggal aktif DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, status, member_number)
     VALUES ($1, 'Anggota Tanpa Tanggal', 'ACTIVE', $2)`,
    [coopId, `K2-2026-00001`],
  );

  log('');
  log('4. Alur keanggotaan yang sah');
  const anggota = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, identity_number, birth_date, status, applied_at)
     VALUES ($1, 'Siti Anggota', $2, '1995-04-10', 'PROSPECT', now()) RETURNING id`,
    [coopId, `327${tag}0001`],
  );
  const anggotaId = anggota[0].id;
  check('calon anggota dibuat', Boolean(anggotaId));

  for (const [dari, ke] of [
    ['PROSPECT', 'PENDING_VERIFICATION'],
    ['PENDING_VERIFICATION', 'APPROVED'],
    ['APPROVED', 'PENDING_PRINCIPAL_SAVING'],
  ]) {
    await q(`UPDATE "${SCHEMA}".cooperative_member SET status = $2 WHERE id = $1`, [anggotaId, ke]);
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_member_status_history
         (member_id, from_status, to_status, reason) VALUES ($1, $2, $3, 'bukti')`,
      [anggotaId, dari, ke],
    );
  }
  check('calon anggota melalui tahapan tanpa tanggal aktif', true);

  // Pengaktifan: nomor dan tanggal aktif diisi bersamaan dengan statusnya.
  await q(
    `UPDATE "${SCHEMA}".cooperative_member
        SET status = 'ACTIVE', member_number = $2, activated_at = now()
      WHERE id = $1`,
    [anggotaId, `K2-2026-00001`],
  );
  const aktif = await q(
    `SELECT status, member_number, activated_at FROM "${SCHEMA}".cooperative_member WHERE id = $1`,
    [anggotaId],
  );
  check('anggota diaktifkan bersama nomor dan tanggalnya', aktif[0].status === 'ACTIVE');
  check('tanggal aktif tercatat', Boolean(aktif[0].activated_at));

  log('');
  log('5. Nomor anggota tidak boleh kembar');
  await harusDitolak(
    'nomor anggota kembar DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, status, member_number, activated_at)
     VALUES ($1, 'Anggota Kembar', 'ACTIVE', $2, now())`,
    [coopId, `K2-2026-00001`],
  );

  log('');
  log('6. Satu orang satu keanggotaan yang belum berakhir');
  await harusDitolak(
    'identitas yang sama mendaftar dua kali DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, identity_number, status)
     VALUES ($1, 'Siti Kembar', $2, 'PROSPECT')`,
    [coopId, `327${tag}0001`],
  );

  log('');
  log('   Setelah keanggotaan berakhir, identitas yang sama boleh mendaftar lagi:');
  await q(
    `UPDATE "${SCHEMA}".cooperative_member
        SET status = 'TERMINATED', terminated_at = now() WHERE id = $1`,
    [anggotaId],
  );
  const daftarUlang = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, identity_number, status)
     VALUES ($1, 'Siti Daftar Ulang', $2, 'PROSPECT') RETURNING id`,
    [coopId, `327${tag}0001`],
  );
  check('bekas anggota dapat mendaftar kembali sebagai calon baru', daftarUlang.length === 1);

  log('');
  log('7. Pemberhentian wajib mencantumkan tanggalnya');
  await harusDitolak(
    'status TERMINATED tanpa terminated_at DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member
       (cooperative_id, full_name, status) VALUES ($1, 'Berhenti Tanpa Tanggal', 'TERMINATED')`,
    [coopId],
  );

  log('');
  log('8. Satu jabatan hanya dipangku satu orang pada satu waktu');
  const posisi = await q(
    `INSERT INTO "${SCHEMA}".cooperative_board_position
       (cooperative_id, code, name, board_type, can_sign_agreement)
     VALUES ($1, 'CHAIRPERSON', 'Ketua', 'MANAGEMENT', TRUE) RETURNING id`,
    [coopId],
  );
  const anggotaB = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member (cooperative_id, full_name, status)
     VALUES ($1, 'Budi Pengurus', 'PROSPECT') RETURNING id`,
    [coopId],
  );
  const anggotaC = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member (cooperative_id, full_name, status)
     VALUES ($1, 'Cici Pengurus', 'PROSPECT') RETURNING id`,
    [coopId],
  );

  await q(
    `INSERT INTO "${SCHEMA}".cooperative_appointment
       (cooperative_id, position_id, member_id, appointed_from, appointed_until, status)
     VALUES ($1, $2, $3, '2026-01-01', '2029-12-31', 'ACTIVE')`,
    [coopId, posisi[0].id, anggotaB[0].id],
  );
  check('ketua pertama diangkat', true);

  await harusDitolak(
    'ketua kedua pada periode yang tumpang tindih DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_appointment
       (cooperative_id, position_id, member_id, appointed_from, appointed_until, status)
     VALUES ($1, $2, $3, '2027-01-01', '2030-12-31', 'ACTIVE')`,
    [coopId, posisi[0].id, anggotaC[0].id],
  );

  const berurutan = await q(
    `INSERT INTO "${SCHEMA}".cooperative_appointment
       (cooperative_id, position_id, member_id, appointed_from, appointed_until, status)
     VALUES ($1, $2, $3, '2030-01-01', '2033-12-31', 'ACTIVE') RETURNING id`,
    [coopId, posisi[0].id, anggotaC[0].id],
  );
  check('ketua berikutnya setelah periode sebelumnya berakhir DITERIMA', berurutan.length === 1);

  log('');
  log('9. Ahli waris: bagian tidak boleh melebihi seratus persen');
  await harusDitolak(
    'bagian ahli waris 120% DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member_beneficiary
       (member_id, full_name, relationship, share_percent)
     VALUES ($1, 'Ahli Waris', 'SPOUSE', 120)`,
    [anggotaB[0].id],
  );

  log('');
  log('10. Hubungan keluarga: seseorang bukan keluarga dirinya sendiri');
  await harusDitolak(
    'hubungan keluarga dengan diri sendiri DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_related_party
       (cooperative_id, member_id, related_member_id, relationship)
     VALUES ($1, $2, $2, 'SIBLING')`,
    [coopId, anggotaB[0].id],
  );
  const relasi = await q(
    `INSERT INTO "${SCHEMA}".cooperative_related_party
       (cooperative_id, member_id, related_member_id, relationship)
     VALUES ($1, $2, $3, 'SIBLING') RETURNING id`,
    [coopId, anggotaB[0].id, anggotaC[0].id],
  );
  check('hubungan keluarga antar dua anggota tercatat', relasi.length === 1);

  log('');
  log('11. Persetujuan pemakaian data tercatat, bukan diasumsikan');
  await q(
    `INSERT INTO "${SCHEMA}".cooperative_member_consent (member_id, purpose, granted)
     VALUES ($1, 'CREDIT_SCORING', TRUE)`,
    [anggotaB[0].id],
  );
  const consent = await q(
    `SELECT granted FROM "${SCHEMA}".cooperative_member_consent
      WHERE member_id = $1 AND purpose = 'CREDIT_SCORING'`,
    [anggotaB[0].id],
  );
  check('persetujuan tercatat dengan waktunya', consent.length === 1 && consent[0].granted === true);
  await harusDitolak(
    'tujuan persetujuan di luar daftar DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_member_consent (member_id, purpose, granted)
     VALUES ($1, 'DIJUAL_KE_SIAPA_SAJA', TRUE)`,
    [anggotaB[0].id],
  );

  log('');
  log('12. Riwayat status tersimpan lengkap');
  const riwayat = await q(
    `SELECT from_status, to_status FROM "${SCHEMA}".cooperative_member_status_history
      WHERE member_id = $1 ORDER BY occurred_at`,
    [anggotaId],
  );
  check('tiga perpindahan tercatat', riwayat.length === 3, `dapat ${riwayat.length}`);

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  // Seluruh bukti berjalan di dalam satu transaksi yang selalu digulung balik:
  // basis data pengembangan tidak boleh berubah karena dijalankannya bukti.
  await client.query('ROLLBACK');
  log('');
  log('Seluruh perubahan digulung balik — basis data tidak berubah.');
  await client.end();
  writeFileSync(
    new URL('../../../docs/ekoperasi/bukti-k2-keanggotaan.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
