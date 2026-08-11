/**
 * Membersihkan akun dan peran sisa naskah uji pada tenant demo.
 *
 * ## Mengapa naskah ini ada
 *
 * Naskah bukti dan naskah penyelidik membuat pengguna sungguhan beserta
 * perannya, lalu sebagian besar tidak membersihkannya. Pada 11 Agustus 2026
 * tenant demo memuat **333 dari 404 akun platform** dan **299 dari 531 peran**
 * yang seluruhnya sisa naskah uji.
 *
 * Kata sandinya acak dan tidak tersimpan di mana pun, sehingga praktis tidak
 * dapat dipakai masuk. Tetapi itu bukan alasan membiarkannya: ia tetap akun
 * berstatus ACTIVE yang memegang hak — termasuk hak kesehatan — dan setiap
 * peninjauan akses akan membacanya sebagai orang sungguhan. Pertanyaan "siapa
 * yang dapat membuat pasien" saat ini dijawab dua puluh tiga peran, dua puluh
 * di antaranya sampah.
 *
 * ## Bawaannya TIDAK mengubah apa pun
 *
 * Tanpa saklar, naskah ini hanya melaporkan. Penghapusan pada tabel
 * control-plane bukan sesuatu yang pantas terjadi sebagai efek samping
 * menjalankan sebuah perintah.
 *
 *   node scripts/bersihkan-akun-uji.mjs                 laporan saja
 *   node scripts/bersihkan-akun-uji.mjs --nonaktifkan   cabut peran, set INACTIVE
 *   node scripts/bersihkan-akun-uji.mjs --hapus         hapus; yang tersangkut dinonaktifkan
 *
 * `--nonaktifkan` menghilangkan seluruh bahaya keamanannya tanpa menyentuh
 * satu baris jejak pun, dan itu pilihan yang benar bila ragu.
 *
 * ## Yang TIDAK akan disentuh, apa pun saklarnya
 *
 * - staf platform dan pemilik tenant;
 * - nama yang tidak cocok pola di bawah — termasuk `kader_*`, yang tampak
 *   seperti data demo sungguhan meskipun memegang peran `UJI_KADER_*`, dan
 *   `uat_persona_hotel`, yang tidak cocok pola naskah mana pun;
 * - peran yang masih terpasang pada pengguna di luar daftar hapus.
 *
 * Yang terakhir itu penting. Peran `UJI_KADER_*` terpasang pada pengguna
 * `kader_*`; menghapus perannya akan mencabut hak pengguna yang sengaja
 * dibiarkan hidup. Naskah ini melewatinya dan menyebutkannya.
 */

import { readFileSync } from 'node:fs';
import pg from 'pg';

const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';

/**
 * Pola nama, DITURUNKAN dari yang benar-benar ada pada basis data — bukan dari
 * ingatan tentang naskah apa saja yang pernah ditulis.
 *
 * Sengaja sempit. Pola yang longgar seperti `uji` saja akan ikut menelan nama
 * sungguhan; yang terlewat masih dapat dibersihkan lain kali, yang terhapus
 * keliru tidak dapat dikembalikan.
 */
/*
 * Dapat dipersempit lewat lingkungan — dipakai untuk MENGUJI naskah ini pada
 * sekumpulan kecil akun buatan sebelum dilepas ke seluruhnya, dan berguna pula
 * bagi operator yang hanya ingin membersihkan sisa satu naskah tertentu.
 *
 * Naskah penghapus yang belum pernah dijalankan sampai selesai lebih berbahaya
 * daripada sampah yang dibersihkannya.
 */
const POLA_PENGGUNA = process.env.POLA_UJI ?? '^(bukti_|probe_|uji_|uat_health_|alur_health_|e2e_kesehatan_)';
const POLA_PERAN = process.env.POLA_UJI_PERAN ?? '^(BUKTI_|PROBE_|UJI_|UAT_|ALUR_)';

const perintah = process.argv.slice(2);
const NONAKTIFKAN = perintah.includes('--nonaktifkan');
const HAPUS = perintah.includes('--hapus');
const LAPORAN_SAJA = !NONAKTIFKAN && !HAPUS;

function sambungan() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const nilai = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()?.replace(/^"|"$/g, '');
  if (nilai) return nilai;
  throw new Error('DATABASE_URL tidak ditemukan pada lingkungan maupun apps/api/.env');
}

const c = new pg.Client({ connectionString: sambungan() });
const q = async (s, p = []) => (await c.query(s, p)).rows;

await c.connect();

try {
  console.log('='.repeat(78));
  console.log('PEMBERSIHAN AKUN DAN PERAN SISA NASKAH UJI');
  console.log(`Skema  : ${SCHEMA}`);
  console.log(`Modus  : ${LAPORAN_SAJA ? 'LAPORAN SAJA — tidak ada yang diubah' : HAPUS ? 'HAPUS' : 'NONAKTIFKAN'}`);
  console.log('='.repeat(78));

  /* --- 1. Siapa yang menjadi sasaran ---------------------------------- */

  const pengguna = await q(
    `SELECT pu.id::text AS id, pu.username, pu.status, pu.is_platform_staff,
            (SELECT count(*) FROM platform.tenant_membership tm
              WHERE tm.platform_user_id = pu.id AND tm.is_owner) ::int AS pemilik
       FROM platform.platform_user pu
      WHERE pu.username ~ $1
      ORDER BY pu.username`,
    [POLA_PENGGUNA],
  );

  /*
   * Staf platform dan pemilik tenant disingkirkan dari sasaran, bukan sekadar
   * diperingatkan. Nama yang cocok pola uji TIDAK cukup menjadi alasan
   * menghapus akun yang memegang kendali sistem — bila ada yang seperti itu,
   * yang keliru adalah penamaannya, dan itu urusan manusia.
   */
  const terlindungi = pengguna.filter((p) => p.is_platform_staff || p.pemilik > 0);
  const sasaran = pengguna.filter((p) => !p.is_platform_staff && p.pemilik === 0);

  console.log(`\nAkun cocok pola      : ${pengguna.length}`);
  console.log(`  dilindungi         : ${terlindungi.length}${terlindungi.length ? '  (staf platform atau pemilik tenant)' : ''}`);
  console.log(`  menjadi sasaran    : ${sasaran.length}`);
  for (const t of terlindungi) console.log(`     DILINDUNGI  ${t.username}`);

  const totalAkun = (await q('SELECT count(*)::int AS n FROM platform.platform_user'))[0].n;
  console.log(`  dari total akun    : ${totalAkun}`);

  /* --- 2. Peran mana yang boleh ikut ----------------------------------- */

  const peran = await q(
    `SELECT r.id::text AS id, r.code, r.is_system,
            (SELECT count(*) FROM "${SCHEMA}".role_menu_permission p WHERE p.role_id = r.id)::int AS hak,
            (SELECT count(*) FROM "${SCHEMA}".user_role_assignment ura
               JOIN "${SCHEMA}".user_subject us ON us.id = ura.user_subject_id
              WHERE ura.role_id = r.id AND us.username_snapshot !~ $2)::int AS dipakai_luar
       FROM "${SCHEMA}".role r
      WHERE r.code ~ $1 AND r.deleted_at IS NULL
      ORDER BY r.code`,
    [POLA_PERAN, POLA_PENGGUNA],
  );

  /*
   * Peran sistem tidak pernah disentuh, dan peran yang masih dipakai pengguna
   * DI LUAR daftar hapus juga tidak — menghapusnya akan mencabut hak orang yang
   * sengaja dibiarkan hidup.
   */
  const peranAman = peran.filter((r) => !r.is_system && r.dipakai_luar === 0);
  const peranDilewati = peran.filter((r) => r.is_system || r.dipakai_luar > 0);

  console.log(`\nPeran cocok pola     : ${peran.length}`);
  console.log(`  dapat dihapus      : ${peranAman.length}  (${peranAman.reduce((s, r) => s + r.hak, 0)} hibah)`);
  console.log(`  dilewati           : ${peranDilewati.length}`);
  for (const r of peranDilewati) {
    console.log(`     DILEWATI  ${r.code.padEnd(30)} ${r.is_system ? 'peran sistem' : `masih dipakai ${r.dipakai_luar} pengguna di luar daftar`}`);
  }

  const totalPeran = (await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".role WHERE deleted_at IS NULL`))[0].n;
  console.log(`  dari total peran   : ${totalPeran}`);

  if (LAPORAN_SAJA) {
    console.log('\n' + '='.repeat(78));
    console.log('Tidak ada yang diubah. Jalankan ulang dengan salah satu saklar:');
    console.log('  --nonaktifkan   mencabut peran dan menyetel INACTIVE; jejak utuh, dapat dipulihkan');
    console.log('  --hapus         menghapus barisnya; yang tersangkut jejak jatuh ke nonaktif');
    console.log('='.repeat(78));
    process.exit(0);
  }

  /* --- 3. Mengerjakannya ---------------------------------------------- */

  await c.query('BEGIN');
  let dihapus = 0;
  let dinonaktifkan = 0;
  const jatuh = [];

  for (const p of sasaran) {
    const subjek = await q(`SELECT id::text AS id FROM "${SCHEMA}".user_subject WHERE platform_user_id = $1`, [p.id]);

    if (HAPUS) {
      /*
       * Tiap pengguna dicoba di dalam SAVEPOINT-nya sendiri.
       *
       * Ada sekitar tujuh puluh kunci asing menunjuk `user_subject`, dan
       * sebagian besar NO ACTION atau RESTRICT — pengguna uji yang pernah
       * memposting penerimaan barang atau menutup shift kasir sudah menjadi
       * bagian jejak transaksi itu. Menghapusnya akan gagal, dan pada kolom
       * SET NULL justru lebih buruk: berhasil, lalu menghapus siapa yang
       * mengerjakannya.
       *
       * Karena itu kegagalan di sini BUKAN galat. Ia jawaban, dan jawabannya
       * adalah "yang ini dinonaktifkan saja".
       */
      await c.query('SAVEPOINT coba');
      try {
        for (const s of subjek) {
          await c.query(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [s.id]);
          await c.query(`DELETE FROM "${SCHEMA}".user_subject WHERE id = $1`, [s.id]);
        }
        await c.query('DELETE FROM platform.tenant_membership WHERE platform_user_id = $1', [p.id]);
        await c.query('DELETE FROM platform.platform_user WHERE id = $1', [p.id]);
        await c.query('RELEASE SAVEPOINT coba');
        dihapus += 1;
        continue;
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT coba');
        jatuh.push({ nama: p.username, sebab: (e.constraint ?? e.message).slice(0, 70) });
      }
    }

    /* Nonaktifkan — dipakai pada modus --nonaktifkan, dan sebagai jaring bagi
     * yang tersangkut pada modus --hapus. */
    for (const s of subjek) {
      await c.query(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE user_subject_id = $1`, [s.id]);
      await c.query(`UPDATE "${SCHEMA}".user_subject SET status = 'INACTIVE' WHERE id = $1`, [s.id]);
    }
    await c.query("UPDATE platform.platform_user SET status = 'SUSPENDED', updated_at = now() WHERE id = $1", [p.id]);
    dinonaktifkan += 1;
  }

  let peranDihapus = 0;
  if (HAPUS) {
    for (const r of peranAman) {
      await c.query('SAVEPOINT coba_peran');
      try {
        await c.query(`DELETE FROM "${SCHEMA}".role_menu_permission WHERE role_id = $1`, [r.id]);
        await c.query(`DELETE FROM "${SCHEMA}".user_role_assignment WHERE role_id = $1`, [r.id]);
        await c.query(`DELETE FROM "${SCHEMA}".role WHERE id = $1`, [r.id]);
        await c.query('RELEASE SAVEPOINT coba_peran');
        peranDihapus += 1;
      } catch (e) {
        await c.query('ROLLBACK TO SAVEPOINT coba_peran');
        jatuh.push({ nama: `peran ${r.code}`, sebab: (e.constraint ?? e.message).slice(0, 70) });
      }
    }
  } else {
    /* Pada modus nonaktif, peran uji dikosongkan hibahnya tetapi barisnya
     * dibiarkan — supaya dapat ditelusuri, dan supaya keputusan menghapusnya
     * tetap terpisah dari keputusan menonaktifkan akunnya. */
    for (const r of peranAman) {
      await c.query(`DELETE FROM "${SCHEMA}".role_menu_permission WHERE role_id = $1`, [r.id]);
    }
  }

  await c.query('COMMIT');

  /* --- 4. Melaporkan apa yang benar-benar terjadi ---------------------- */

  console.log('\n' + '='.repeat(78));
  console.log('HASIL');
  console.log('='.repeat(78));
  console.log(`  akun dihapus        : ${dihapus}`);
  console.log(`  akun dinonaktifkan  : ${dinonaktifkan}`);
  console.log(`  peran dihapus       : ${peranDihapus}`);
  if (!HAPUS) console.log(`  hibah peran uji dikosongkan pada ${peranAman.length} peran`);
  if (jatuh.length) {
    console.log(`\n  ${jatuh.length} tersangkut jejak dan TIDAK dihapus:`);
    for (const j of jatuh.slice(0, 20)) console.log(`     ${j.nama.padEnd(40)} ${j.sebab}`);
    if (jatuh.length > 20) console.log(`     ... dan ${jatuh.length - 20} lagi`);
    console.log('\n  Ini bukan kegagalan. Baris-baris itu bagian jejak transaksi yang');
    console.log('  sudah terjadi, dan akunnya dinonaktifkan alih-alih dihapus.');
  }

  const sisaAkun = (await q('SELECT count(*)::int AS n FROM platform.platform_user WHERE username ~ $1', [POLA_PENGGUNA]))[0].n;
  const sisaPeran = (await q(`SELECT count(*)::int AS n FROM "${SCHEMA}".role WHERE code ~ $1 AND deleted_at IS NULL`, [POLA_PERAN]))[0].n;
  console.log(`\n  sisa akun cocok pola  : ${sisaAkun}`);
  console.log(`  sisa peran cocok pola : ${sisaPeran}`);
  console.log('='.repeat(78));
} catch (e) {
  await c.query('ROLLBACK').catch(() => {});
  console.error('\nDIBATALKAN SELURUHNYA — tidak ada yang berubah.');
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await c.end();
}
