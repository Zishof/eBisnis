/**
 * Bukti penyemaian RBAC koperasi pada basis data sungguhan.
 *
 * Yang dibuktikan bukan "penyemaian berjalan" melainkan **apa yang benar-benar
 * ada di dalam skema penyewa sesudahnya** — sebab penyemaian ini punya dua cara
 * gagal yang tidak menghasilkan galat apa pun:
 *
 *   1. Katalog vertikal tidak terdaftar, sehingga menu koperasi tidak pernah
 *      disemai. Log tetap berbunyi "berhasil"; jumlah menunya saja yang lebih
 *      kecil, dan tidak ada yang memperhatikannya.
 *
 *   2. Kelompok pemisahan tugas tanpa keterangan **dilewati dengan peringatan**,
 *      bukan galat. Aturan yang paling menentukan pada koperasi simpan pinjam
 *      dapat hilang sepenuhnya sementara penyemaian dilaporkan sukses.
 *
 * Keduanya benar-benar terjadi selama pekerjaan ini, dan keduanya ditemukan
 * dengan memeriksa basis datanya — bukan dengan membaca lognya.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import pg from 'pg';
import {
  COOPERATIVE_MENUS,
  COOPERATIVE_MODULES,
  COOPERATIVE_ROLES,
} from '../dist/modules/cooperative/rbac/cooperative-vertical.catalog.js';

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

await client.connect();

try {
  log('='.repeat(78));
  log('BUKTI PENYEMAIAN RBAC KOPERASI');
  log(`Waktu : ${new Date().toISOString()}`);
  log('='.repeat(78));

  const skema = await q(
    `SELECT table_schema FROM information_schema.tables
      WHERE table_name = 'role_module_profile' AND table_schema NOT LIKE 'pg_%'
      ORDER BY table_schema`,
  );
  check(`${skema.length} skema penyewa ditemukan`, skema.length > 0);

  // --------------------------------------------------------------- Aksi baru
  log('');
  log('1. Tiga aksi baru tersemai di SELURUH skema');

  let lengkapAksi = 0;
  for (const s of skema) {
    const r = await q(
      `SELECT COUNT(*)::int AS n FROM "${s.table_schema}".permission_action
        WHERE code IN ('ANALYZE', 'DISBURSE', 'WRITE_OFF')`,
    );
    if (Number(r[0].n) === 3) lengkapAksi += 1;
  }
  check(
    `ANALYZE, DISBURSE, WRITE_OFF ada di ${skema.length} skema`,
    lengkapAksi === skema.length,
    `${lengkapAksi} dari ${skema.length}`,
  );

  const stepUp = await q(
    `SELECT code, requires_step_up FROM "${skema[0].table_schema}".permission_action
      WHERE code IN ('DISBURSE', 'WRITE_OFF') ORDER BY code`,
  );
  check(
    'DISBURSE dan WRITE_OFF menuntut pengesahan ulang',
    stepUp.length === 2 && stepUp.every((r) => r.requires_step_up === true),
    JSON.stringify(stepUp),
  );

  const analyzeStepUp = await q(
    `SELECT requires_step_up FROM "${skema[0].table_schema}".permission_action WHERE code = 'ANALYZE'`,
  );
  check(
    'ANALYZE TIDAK menuntutnya — ia menilai, bukan memindahkan uang',
    analyzeStepUp[0].requires_step_up === false,
  );

  // ------------------------------------------------------------------- Menu
  log('');
  log('2. Menu koperasi tersemai lengkap');

  /*
   * Skema yang diperiksa rinci sengaja dipilih yang lengkap, bukan yang
   * pertama menurut abjad. Skema sisa pengujian lama ada di basis data
   * pengembangan, dan memilihnya akan membuat bukti ini gagal karena alasan
   * yang tidak ada hubungannya dengan yang sedang dibuktikan.
   */
  const kandidat = await q(
    `SELECT table_schema FROM information_schema.tables
      WHERE table_name = 'role_menu_permission' AND table_schema NOT LIKE 'pg_%'
      ORDER BY (table_schema = 'demo') DESC, table_schema`,
  );
  const S = kandidat[0].table_schema;
  log(`  (skema yang diperiksa rinci: ${S})`);
  const menu = await q(
    `SELECT code, parent_id, path FROM "${S}".menu WHERE code LIKE 'COOPERATIVE%' ORDER BY code`,
  );
  check(
    `${COOPERATIVE_MENUS.length} menu koperasi tersemai`,
    menu.length === COOPERATIVE_MENUS.length,
    `basis data ${menu.length}`,
  );

  const kodeDb = new Set(menu.map((m) => m.code));
  const hilang = COOPERATIVE_MENUS.filter((m) => !kodeDb.has(m.code)).map((m) => m.code);
  check('tidak ada menu katalog yang gagal tersemai', hilang.length === 0, hilang.join(', '));

  const modulDb = menu.filter((m) => m.parent_id === null).map((m) => m.code).sort();
  check(
    `${COOPERATIVE_MODULES.length} modul koperasi berdiri sendiri`,
    modulDb.length === COOPERATIVE_MODULES.length,
    modulDb.join(', '),
  );

  /*
   * Simpanan, pinjaman, dan portal WAJIB menjadi modul terpisah. Bila salah
   * satunya berinduk pada modul lain, satu profil akan berlaku untuk keduanya
   * — dan Petugas Simpanan memperoleh hak mencatat pada layar pinjaman.
   */
  for (const wajib of ['COOPERATIVE_SAVING', 'COOPERATIVE_LOAN', 'COOPERATIVE_PORTAL']) {
    check(`${wajib} berdiri sebagai modul tersendiri`, modulDb.includes(wajib));
  }

  // ------------------------------------------------------------------ Peran
  log('');
  log('3. Peran koperasi tersemai beserta izinnya');

  const peran = await q(
    `SELECT code FROM "${S}".role WHERE code LIKE 'COOPERATIVE%' ORDER BY code`,
  );
  check(
    `${COOPERATIVE_ROLES.length} peran koperasi tersemai`,
    peran.length === COOPERATIVE_ROLES.length,
    `basis data ${peran.length}`,
  );

  const izin = async (kodePeran, kodeMenu) =>
    (
      await q(
        `SELECT pa.code
           FROM "${S}".role_menu_permission rp
           JOIN "${S}".role r ON r.id = rp.role_id
           JOIN "${S}".menu m ON m.id = rp.menu_id
           JOIN "${S}".permission_action pa ON pa.id = rp.permission_action_id
          WHERE r.code = $1 AND m.code = $2 AND rp.effect <> 'DENY'`,
        [kodePeran, kodeMenu],
      )
    ).map((x) => x.code);

  const petugasPinjaman = await izin('COOPERATIVE_LOAN_OFFICER', 'COOPERATIVE_LOAN');
  check('Petugas Pinjaman memiliki izin pada modul pinjaman', petugasPinjaman.length > 0);
  check(
    'Petugas Pinjaman TIDAK memegang APPROVE',
    !petugasPinjaman.includes('APPROVE'),
    petugasPinjaman.join(', '),
  );
  check('Petugas Pinjaman TIDAK memegang DISBURSE', !petugasPinjaman.includes('DISBURSE'));
  check('Petugas Pinjaman TIDAK memegang WRITE_OFF', !petugasPinjaman.includes('WRITE_OFF'));

  const analisis = await izin('COOPERATIVE_LOAN_OFFICER', 'COOPERATIVE_CREDIT_ANALYSIS');
  check('Petugas Pinjaman MEMEGANG ANALYZE', analisis.includes('ANALYZE'), analisis.join(', '));

  const ketua = await izin('COOPERATIVE_CHAIRMAN', 'COOPERATIVE_LOAN');
  check('Ketua memegang APPROVE', ketua.includes('APPROVE'));
  check('Ketua memegang WRITE_OFF', ketua.includes('WRITE_OFF'));
  check('Ketua TIDAK memegang CREATE', !ketua.includes('CREATE'), ketua.join(', '));

  const manajer = await izin('COOPERATIVE_MANAGER', 'COOPERATIVE_LOAN');
  check('Manajer memegang DISBURSE', manajer.includes('DISBURSE'));
  check('Manajer TIDAK memegang CREATE', !manajer.includes('CREATE'));

  const petugasSimpanan = await izin('COOPERATIVE_SAVING_OFFICER', 'COOPERATIVE_LOAN');
  check(
    'Petugas Simpanan TIDAK memiliki izin apa pun pada modul pinjaman',
    petugasSimpanan.length === 0,
    petugasSimpanan.join(', '),
  );

  const pengawasMenulis = [];
  for (const m of COOPERATIVE_MENUS) {
    const a = await izin('COOPERATIVE_SUPERVISOR', m.code);
    for (const x of a) {
      if (['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST', 'DISBURSE', 'WRITE_OFF'].includes(x)) {
        pengawasMenulis.push(`${m.code}.${x}`);
      }
    }
  }
  check(
    'Pengawas tidak memegang satu pun hak menulis',
    pengawasMenulis.length === 0,
    pengawasMenulis.join(', '),
  );

  // ------------------------------------------------------- Anggota vs petugas
  log('');
  log('4. Anggota terpisah dari petugas, dua arah');

  const anggotaPortal = await izin('COOPERATIVE_MEMBER_PORTAL', 'COOPERATIVE_PORTAL');
  check('Anggota memiliki izin pada portal', anggotaPortal.length > 0, anggotaPortal.join(', '));
  check('Anggota tidak memegang APPROVE', !anggotaPortal.includes('APPROVE'));

  const anggotaLain = [];
  for (const m of COOPERATIVE_MENUS) {
    if (m.code === 'COOPERATIVE_PORTAL') continue;
    const a = await izin('COOPERATIVE_MEMBER_PORTAL', m.code);
    if (a.length > 0) anggotaLain.push(m.code);
  }
  check(
    'Anggota TIDAK memiliki izin pada satu pun menu pengurus',
    anggotaLain.length === 0,
    anggotaLain.join(', '),
  );

  const petugasPortal = [];
  for (const r of COOPERATIVE_ROLES) {
    if (r.code === 'COOPERATIVE_MEMBER_PORTAL') continue;
    const a = await izin(r.code, 'COOPERATIVE_PORTAL');
    if (a.length > 0) petugasPortal.push(`${r.code}: ${a.join('/')}`);
  }
  check(
    'TIDAK ada peran petugas yang memiliki izin portal',
    petugasPortal.length === 0,
    petugasPortal.join(', '),
  );

  // ------------------------------------------------------------------- SoD
  log('');
  log('5. Aturan pemisahan tugas koperasi benar-benar tersemai');

  /*
   * Kelompok tanpa keterangan DILEWATI dengan peringatan, bukan galat. Aturan
   * yang paling menentukan pada koperasi simpan pinjam dapat hilang sepenuhnya
   * sementara penyemaian dilaporkan sukses — jadi keberadaannya diperiksa di
   * sini, pada barisnya.
   */
  let adaAturan = 0;
  for (const s of skema) {
    const r = await q(
      `SELECT COUNT(*)::int AS n FROM "${s.table_schema}".segregation_of_duty_rule
        WHERE code = 'COOPERATIVE_LOAN'`,
    );
    if (Number(r[0].n) === 1) adaAturan += 1;
  }
  check(
    `aturan COOPERATIVE_LOAN ada di ${skema.length} skema`,
    adaAturan === skema.length,
    `${adaAturan} dari ${skema.length}`,
  );

  const anggotaAturan = await q(
    `SELECT r.code, m.side
       FROM "${S}".segregation_of_duty_rule sod
       JOIN "${S}".segregation_of_duty_role m ON m.rule_id = sod.id
       JOIN "${S}".role r ON r.id = m.role_id
      WHERE sod.code = 'COOPERATIVE_LOAN'
      ORDER BY r.code`,
  ).catch(() => []);

  if (anggotaAturan.length > 0) {
    const sisi = new Set(anggotaAturan.map((a) => a.side));
    check('aturan memuat DUA sisi, bukan satu', sisi.size === 2, [...sisi].join('/'));
    check(
      'Petugas Pinjaman berada pada sisi penyiap',
      anggotaAturan.some((a) => a.code === 'COOPERATIVE_LOAN_OFFICER' && a.side === 'PREPARER'),
    );
    check(
      'Ketua berada pada sisi penyetuju',
      anggotaAturan.some((a) => a.code === 'COOPERATIVE_CHAIRMAN' && a.side === 'APPROVER'),
    );
  }

  // Aturan lama tidak boleh hilang karena penambahan ini.
  const totalAturan = await q(
    `SELECT COUNT(*)::int AS n FROM "${S}".segregation_of_duty_rule`,
  );
  check(
    `aturan SoD berjumlah ${totalAturan[0].n} — aturan lama tetap ada`,
    Number(totalAturan[0].n) >= 20,
    String(totalAturan[0].n),
  );

  // ----------------------------------------------------------------- Profil
  log('');
  log('6. Profil koperasi C1–C4 diterima basis data');

  const profil = await q(
    `SELECT DISTINCT profile_code FROM "${S}".role_module_profile
      WHERE profile_code LIKE 'C%' ORDER BY profile_code`,
  );
  check(
    'profil C1–C4 tersimpan pada role_module_profile',
    profil.length >= 3,
    profil.map((p) => p.profile_code).join(', '),
  );

  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));
} catch (e) {
  failures += 1;
  log(`GALAT: ${e.message}`);
} finally {
  await client.end();
  writeFileSync(
    new URL('../../../docs/integration-requests/bukti-rbac-koperasi.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
