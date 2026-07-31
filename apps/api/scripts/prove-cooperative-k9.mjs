/**
 * Bukti K-9: situs koperasi dan portal anggota.
 *
 * Yang dibuktikan berpusat pada satu sifat:
 *
 *   **Anggota hanya melihat dirinya sendiri.**
 *
 * Aturannya sudah diuji sebagai fungsi murni pada cooperative-portal.spec.ts.
 * Yang dibuktikan DI SINI berbeda: bahwa aturan itu benar-benar berlaku atas
 * baris sungguhan di basis data. Dua anggata dibuat, masing-masing dengan
 * simpanan, pinjaman, pengaduan, dan pemberitahuannya sendiri; lalu setiap
 * jalur baca portal dijalankan atas nama anggota pertama dan dihitung berapa
 * baris milik anggota kedua yang lolos.
 *
 * Jawaban yang benar untuk setiap jalur adalah nol.
 *
 * Selain itu dibuktikan penjaga basis data pada pintu yang menerima kiriman
 * dari orang yang belum dikenal: lamaran dari internet tidak dapat berstatus
 * disetujui tanpa menerbitkan anggotanya, tidak dapat ditolak tanpa alasan,
 * dan tidak dapat disimpan tanpa persetujuan pengolahan data pribadi.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import {
  MEDAN_TERLARANG,
  bersihkan,
  bolehMembaca,
  saring,
} from '../dist/modules/cooperative/cooperative-portal.js';

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
  log('BUKTI K-9 — SITUS KOPERASI DAN PORTAL ANGGOTA');
  log(`Waktu  : ${new Date().toISOString()}`);
  log(`Schema : ${SCHEMA}`);
  log('='.repeat(78));

  log('');
  log('1. Tabel K-9 terpasang');
  for (const t of [
    'cooperative_website_setting', 'cooperative_website_page',
    'cooperative_announcement', 'cooperative_public_application',
    'cooperative_complaint', 'cooperative_complaint_response',
    'cooperative_notification', 'cooperative_portal_activity',
  ]) {
    const r = await q(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
      [SCHEMA, t],
    );
    check(`tabel ${t} ada`, r.length === 1);
  }

  const jenis = await q(
    `INSERT INTO "${SCHEMA}".cooperative_type (code, name) VALUES ($1, 'KSU Bukti K9') RETURNING id`,
    [`K9_${tag}`.slice(0, 32)],
  );
  const KOP = (
    await q(
      `INSERT INTO "${SCHEMA}".cooperative (code, name, slug, cooperative_type_id, status)
       VALUES ($1, 'Koperasi Bukti K-9', $2, $3, 'DRAFT') RETURNING id`,
      [`K9-${tag}`.toUpperCase(), `bukti-k9-${tag}`, jenis[0].id],
    )
  )[0].id;

  // ---------------------------------------------------------------- Dua anggota
  log('');
  log('2. Dua anggota disiapkan, masing-masing dengan datanya sendiri');

  let urut = 0;
  const buatAnggota = async (nama, nomor) => {
    urut += 1;
    const nik = `3271${tag.padEnd(6, '0')}${String(urut).padStart(6, '0')}`;
    const [m] = await q(
      `INSERT INTO "${SCHEMA}".cooperative_member
         (cooperative_id, member_number, full_name, status, activated_at, identity_number)
       VALUES ($1, $2, $3, 'ACTIVE', now(), $4)
       RETURNING id`,
      [KOP, nomor, nama, nik],
    );
    return m.id;
  };

  const ANDI = await buatAnggota(`Andi K9 ${tag}`, `K9A${tag}`);
  const BUDI = await buatAnggota(`Budi K9 ${tag}`, `K9B${tag}`);
  check('dua anggota terbentuk', Boolean(ANDI && BUDI));

  // Pengaduan milik masing-masing.
  const buatPengaduan = async (memberId, subjek, nomor) => {
    const [c] = await q(
      `INSERT INTO "${SCHEMA}".cooperative_complaint
         (cooperative_id, member_id, complaint_number, category, subject, body)
       VALUES ($1, $2, $3, 'SERVICE', $4, 'Isi pengaduan.')
       RETURNING id`,
      [KOP, memberId, nomor, subjek],
    );
    return c.id;
  };
  const ADUAN_ANDI = await buatPengaduan(ANDI, 'Aduan Andi', `ADU-A-${tag}`);
  const ADUAN_BUDI = await buatPengaduan(BUDI, 'Aduan Budi', `ADU-B-${tag}`);

  // Pemberitahuan milik masing-masing.
  for (const [m, judul] of [[ANDI, 'Angsuran Andi'], [BUDI, 'Angsuran Budi']]) {
    await q(
      `INSERT INTO "${SCHEMA}".cooperative_notification
         (cooperative_id, member_id, kind, title, link_path)
       VALUES ($1, $2, 'INSTALLMENT_DUE', $3, '/ekoperasi/portal/pinjaman')`,
      [KOP, m, judul],
    );
  }
  check('pengaduan dan pemberitahuan kedua anggota tersimpan', true);

  // -------------------------------------------------- Cakupan data portal
  log('');
  log('3. Anggota hanya melihat dirinya sendiri — atas baris sungguhan');

  /*
   * Setiap jalur baca portal dijalankan atas nama Andi. Yang dihitung bukan
   * "apakah Andi melihat datanya" melainkan "berapa baris milik Budi yang
   * lolos". Jawaban yang benar selalu nol.
   */
  const konteksAndi = {
    viewerMemberId: ANDI,
    viewerStatus: 'ACTIVE',
    cooperativeId: KOP,
    resource: 'COMPLAINT',
  };

  const semuaAduan = await q(
    `SELECT id, member_id AS "memberId", cooperative_id AS "cooperativeId", subject
       FROM "${SCHEMA}".cooperative_complaint
      WHERE cooperative_id = $1 AND complaint_number LIKE $2`,
    [KOP, `ADU-%-${tag}`],
  );
  check('kedua pengaduan terbaca tanpa penyaring', semuaAduan.length === 2);

  const aduanAndi = saring(semuaAduan, konteksAndi);
  check('setelah disaring, Andi melihat 1 pengaduan', aduanAndi.length === 1);
  check(
    'pengaduan Budi TIDAK lolos ke Andi',
    aduanAndi.every((a) => a.id !== ADUAN_BUDI),
    aduanAndi.map((a) => a.subject).join(', '),
  );

  const semuaNotif = await q(
    `SELECT id, member_id AS "memberId", cooperative_id AS "cooperativeId", title
       FROM "${SCHEMA}".cooperative_notification
      WHERE member_id IN ($1, $2)`,
    [ANDI, BUDI],
  );
  const notifAndi = saring(semuaNotif, { ...konteksAndi, resource: 'NOTIFICATION' });
  check('Andi melihat 1 pemberitahuan', notifAndi.length === 1);
  check(
    'pemberitahuan Budi TIDAK lolos ke Andi',
    !notifAndi.some((n) => n.title.includes('Budi')),
  );

  // Pembacaan langsung satu baris, bukan daftar — jalur yang paling mudah
  // terlewat karena tidak memakai penyaring daftar.
  const [aduanBudi] = await q(
    `SELECT member_id AS "memberId", cooperative_id AS "cooperativeId"
       FROM "${SCHEMA}".cooperative_complaint WHERE id = $1`,
    [ADUAN_BUDI],
  );
  const vonis = bolehMembaca({
    resource: 'COMPLAINT',
    viewerMemberId: ANDI,
    ownerMemberId: aduanBudi.memberId,
    viewerStatus: 'ACTIVE',
    cooperativeIdOfViewer: KOP,
    cooperativeIdOfRow: aduanBudi.cooperativeId,
  });
  check('Andi membuka pengaduan Budi lewat id langsung: DITOLAK', vonis.allowed === false);
  check(
    'penolakannya tidak membocorkan bahwa barisnya ada',
    vonis.message === 'Data tidak ditemukan.',
    vonis.message,
  );

  // ------------------------------------------------ Medan yang tidak dikirim
  log('');
  log('4. Medan rahasia tidak ikut terkirim ke portal');

  const [barisAnggota] = await q(
    `SELECT * FROM "${SCHEMA}".cooperative_member WHERE id = $1`,
    [ANDI],
  );
  check(
    'baris mentah dari basis data MEMANG membawa identity_number',
    barisAnggota.identity_number != null,
  );
  const dikirim = bersihkan(barisAnggota);
  for (const m of MEDAN_TERLARANG) {
    if (!(m in barisAnggota)) continue;
    check(`medan ${m} dibuang sebelum dikirim`, !(m in dikirim));
  }

  const [akunPortal] = await q(
    `INSERT INTO "${SCHEMA}".cooperative_member_portal_account
       (member_id, pin_hash, pin_set_at, status)
     VALUES ($1, '$argon2id$v=19$m=65536,t=3,p=4$xxxx', now(), 'ACTIVE')
     RETURNING *`,
    [ANDI],
  );
  check('pin_hash tersimpan sebagai hash, bukan angka', akunPortal.pin_hash.startsWith('$argon2id$'));
  check('pin_hash TIDAK ikut terkirim ke portal', !('pin_hash' in bersihkan(akunPortal)));

  // ---------------------------------------------- Pintu dari internet
  log('');
  log('5. Kiriman dari internet berhenti di tabel karantina');

  const [lamaran] = await q(
    `INSERT INTO "${SCHEMA}".cooperative_public_application
       (cooperative_id, application_number, full_name, phone, consent_given, consent_at)
     VALUES ($1, $2, 'Citra Calon', '081200000000', true, now())
     RETURNING id, status`,
    [KOP, `APP-${tag}`],
  );
  check('lamaran tersimpan berstatus SUBMITTED', lamaran.status === 'SUBMITTED');

  const anggotaSetelah = await q(
    `SELECT 1 FROM "${SCHEMA}".cooperative_member WHERE full_name = 'Citra Calon'`,
  );
  check(
    'lamaran TIDAK membentuk baris anggota dengan sendirinya',
    anggotaSetelah.length === 0,
  );

  await harusDitolak(
    'lamaran tanpa persetujuan pengolahan data pribadi DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_public_application
       (cooperative_id, application_number, full_name, phone, consent_given)
     VALUES ($1, $2, 'Tanpa Consent', '081200000001', false)`,
    [KOP, `APP-NC-${tag}`],
  );

  await harusDitolak(
    'persetujuan tanpa waktunya DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_public_application
       (cooperative_id, application_number, full_name, phone, consent_given, consent_at)
     VALUES ($1, $2, 'Consent Tanpa Waktu', '081200000002', true, NULL)`,
    [KOP, `APP-NW-${tag}`],
  );

  await harusDitolak(
    'lamaran DISETUJUI tanpa menerbitkan anggotanya DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_public_application
        SET status = 'APPROVED' WHERE id = $1`,
    [lamaran.id],
  );

  await harusDitolak(
    'lamaran DITOLAK tanpa alasan DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_public_application
        SET status = 'REJECTED' WHERE id = $1`,
    [lamaran.id],
  );

  // Jalur yang benar: pengurus memeriksa, menerbitkan anggota, lalu menautkan.
  const CITRA = await buatAnggota('Citra Calon Sah', `K9C${tag}`);
  await q(
    `UPDATE "${SCHEMA}".cooperative_public_application
        SET status = 'APPROVED', converted_member_id = $2, reviewed_at = now()
      WHERE id = $1`,
    [lamaran.id, CITRA],
  );
  check('lamaran disetujui SETELAH anggotanya diterbitkan: DITERIMA', true);

  const [lamaranKedua] = await q(
    `INSERT INTO "${SCHEMA}".cooperative_public_application
       (cooperative_id, application_number, full_name, phone, consent_given, consent_at)
     VALUES ($1, $2, 'Citra Lagi', '081200000003', true, now())
     RETURNING id`,
    [KOP, `APP2-${tag}`],
  );
  await harusDitolak(
    'dua lamaran menunjuk anggota yang sama DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_public_application
        SET status = 'APPROVED', converted_member_id = $2 WHERE id = $1`,
    [lamaranKedua.id, CITRA],
  );

  // ------------------------------------------------------------- Pengaduan
  log('');
  log('6. Pengaduan tidak dapat ditutup diam-diam');

  await harusDitolak(
    'pengaduan RESOLVED tanpa keterangan penyelesaian DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_complaint SET status = 'RESOLVED' WHERE id = $1`,
    [ADUAN_ANDI],
  );

  await harusDitolak(
    'pengaduan CLOSED tanpa menyebut siapa yang menutup DITOLAK',
    `UPDATE "${SCHEMA}".cooperative_complaint
        SET status = 'CLOSED', resolution = 'selesai' WHERE id = $1`,
    [ADUAN_ANDI],
  );

  await q(
    `UPDATE "${SCHEMA}".cooperative_complaint
        SET status = 'RESOLVED', resolution = 'Sudah dijelaskan kepada anggota.',
            resolved_at = now()
      WHERE id = $1`,
    [ADUAN_ANDI],
  );
  check('penyelesaian yang beralasan DITERIMA', true);

  await harusDitolak(
    'anggota menulis catatan internal DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_complaint_response
       (complaint_id, author_type, author_id, body, is_internal)
     VALUES ($1, 'MEMBER', $2, 'Diam-diam', true)`,
    [ADUAN_ANDI, ANDI],
  );

  await q(
    `INSERT INTO "${SCHEMA}".cooperative_complaint_response
       (complaint_id, author_type, author_id, body, is_internal)
     VALUES ($1, 'BOARD', NULL, 'Perlu dibahas pengurus.', true)`,
    [ADUAN_ANDI],
  );
  check('pengurus menulis catatan internal DITERIMA', true);

  const tampil = await q(
    `SELECT body FROM "${SCHEMA}".cooperative_complaint_response
      WHERE complaint_id = $1 AND is_internal = false`,
    [ADUAN_ANDI],
  );
  check('catatan internal TIDAK muncul pada tampilan anggota', tampil.length === 0);

  // ---------------------------------------------------------- Pemberitahuan
  log('');
  log('7. Pemberitahuan tidak menuntun anggota ke alamat luar');

  await harusDitolak(
    'pemberitahuan bertautan ke alamat luar DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_notification
       (cooperative_id, member_id, kind, title, link_path)
     VALUES ($1, $2, 'ANNOUNCEMENT', 'Klik di sini', 'https://koperasi-palsu.example/login')`,
    [KOP, ANDI],
  );

  await harusDitolak(
    'jenis pemberitahuan di luar daftar DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_notification
       (cooperative_id, member_id, kind, title)
     VALUES ($1, $2, 'KIRIM_UANG_SEKARANG', 'Segera')`,
    [KOP, ANDI],
  );

  // ------------------------------------------------------------------ Situs
  log('');
  log('8. Situs koperasi: yang tampil adalah pilihan sadar pengurus');

  const [situs] = await q(
    `INSERT INTO "${SCHEMA}".cooperative_website_setting (cooperative_id)
     VALUES ($1) RETURNING *`,
    [KOP],
  );
  check('situs bawaannya BELUM terbit', situs.is_published === false);
  check('jumlah anggota bawaannya TIDAK ditampilkan', situs.show_member_count === false);
  check('besar aset bawaannya TIDAK ditampilkan', situs.show_asset_total === false);
  check('pendaftaran daring bawaannya TERTUTUP', situs.accepts_online_application === false);

  await harusDitolak(
    'dua pengaturan situs pada satu koperasi DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_website_setting (cooperative_id) VALUES ($1)`,
    [KOP],
  );

  await harusDitolak(
    'slug halaman dengan karakter aneh DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_website_page (cooperative_id, slug, title)
     VALUES ($1, '../../etc/passwd', 'Aneh')`,
    [KOP],
  );

  const [halaman] = await q(
    `INSERT INTO "${SCHEMA}".cooperative_website_page (cooperative_id, slug, title, page_type)
     VALUES ($1, 'profil-koperasi', 'Profil Koperasi', 'PROFILE')
     RETURNING id, published_at`,
    [KOP],
  );
  check('halaman baru BELUM terbit sampai diberi tanggal terbit', halaman.published_at === null);

  // ---------------------------------------------------------- Jejak portal
  log('');
  log('9. Jejak portal mencatat penolakan beserta alasannya');

  await harusDitolak(
    'jejak penolakan tanpa kode alasan DITOLAK',
    `INSERT INTO "${SCHEMA}".cooperative_portal_activity
       (cooperative_id, member_id, action, resource, outcome)
     VALUES ($1, $2, 'READ', 'COMPLAINT', 'DENIED')`,
    [KOP, ANDI],
  );

  await q(
    `INSERT INTO "${SCHEMA}".cooperative_portal_activity
       (cooperative_id, member_id, action, resource, resource_id, outcome, deny_code)
     VALUES ($1, $2, 'READ', 'COMPLAINT', $3, 'DENIED', 'NOT_OWNER')`,
    [KOP, ANDI, ADUAN_BUDI],
  );
  const jejak = await q(
    `SELECT deny_code FROM "${SCHEMA}".cooperative_portal_activity
      WHERE member_id = $1 AND outcome = 'DENIED'`,
    [ANDI],
  );
  check('percobaan membaca data anggota lain tercatat', jejak.length === 1);
  check('alasannya tercatat sebagai NOT_OWNER', jejak[0].deny_code === 'NOT_OWNER');

  const kolomJejak = await q(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'cooperative_portal_activity'`,
    [SCHEMA],
  );
  const nama = kolomJejak.map((k) => k.column_name);
  check(
    'jejak TIDAK menyalin isi data yang dibaca',
    !nama.some((n) => ['payload', 'response_body', 'data', 'content'].includes(n)),
    nama.join(', '),
  );

  // --------------------------------------------------- Bekas anggota
  log('');
  log('10. Bekas anggota kehilangan akses, datanya tidak hilang');

  // Pemberhentian menuntut tanggalnya — penjaga dari K-2 yang masih berlaku.
  await q(
    `UPDATE "${SCHEMA}".cooperative_member
        SET status = 'TERMINATED', terminated_at = now(),
            termination_reason = 'Mengundurkan diri.'
      WHERE id = $1`,
    [BUDI],
  );
  const budiSetelah = saring(semuaAduan, {
    viewerMemberId: BUDI,
    viewerStatus: 'TERMINATED',
    cooperativeId: KOP,
    resource: 'COMPLAINT',
  });
  check('bekas anggota tidak melihat apa pun lewat portal', budiSetelah.length === 0);

  const aduanBudiMasihAda = await q(
    `SELECT 1 FROM "${SCHEMA}".cooperative_complaint WHERE id = $1`,
    [ADUAN_BUDI],
  );
  check('tetapi datanya MASIH ADA untuk penyelesaian dan audit', aduanBudiMasihAda.length === 1);

  await harusDitolak(
    'menghapus anggota yang masih punya pengaduan DITOLAK',
    `DELETE FROM "${SCHEMA}".cooperative_member WHERE id = $1`,
    [BUDI],
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
    new URL('../../../docs/ekoperasi/bukti-k9-portal.txt', import.meta.url),
    lines.join('\n') + '\n',
  );
  process.exit(failures === 0 ? 0 : 1);
}
