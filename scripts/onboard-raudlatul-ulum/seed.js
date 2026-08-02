/**
 * Data awal untuk pelanggan pertama: Pondok Pesantren Raudlatul Ulum,
 * Bojonegoro (raudlatul-ulum.santri.info).
 *
 * BERBEDA dari scripts/seed-ponpes-demo: tenant ini BUKAN sandbox demo --
 * ini pelanggan sungguhan. Karena itu tidak ada penandaan is_sample=true pada
 * data institusional (profil, unit pendidikan, mata pelajaran) -- HANYA satu
 * santri percobaan pembayaran yang ditandai jelas sebagai data uji coba,
 * supaya pengurus dapat mencobanya lalu menghapusnya sendiri.
 *
 * Prasyarat: tenant sudah diregistrasikan lewat
 * POST /public/pesantren/registrations (lihat deploy/onboard-raudlatul-ulum.sh),
 * sehingga schema, owner, dan peran EPESANTREN_ADMIN sudah ada.
 *
 * Dijalankan lewat: node seed.js
 * Env: DATABASE_ADMIN_URL atau DATABASE_URL, SEED_SCHEMA (bawaan admin_raudlatululum).
 */
const { Client } = require('pg');
const crypto = require('crypto');
const argon2 = require('argon2');
const fs = require('fs');
const path = require('path');

const CONN = process.env.DATABASE_ADMIN_URL || process.env.DATABASE_URL;
if (!CONN) {
  console.error('DATABASE_ADMIN_URL atau DATABASE_URL wajib diisi.');
  process.exit(1);
}
const SCHEMA = process.env.SEED_SCHEMA || 'admin_raudlatululum';
const uuid = () => crypto.randomUUID();

/**
 * Mata pelajaran Madrasah Ibtidaiyah (Kemenag/Kurikulum Merdeka) --
 * campuran mapel umum dan mapel keagamaan yang menjadi ciri khas madrasah
 * (Al-Qur'an Hadis, Akidah Akhlak, Fikih, SKI, Bahasa Arab -- TIDAK ada
 * padanannya pada Dikdasmen).
 *
 * CATATAN JUJUR: `kode_mapel_dapodik` di sini adalah kode SINGKATAN internal,
 * BUKAN nomor referensi EMIS/Dapodik pusat yang sudah diverifikasi -- riset
 * publik tidak menemukan tabel referensi resmi tersebut. Operator Dapodik
 * madrasah wajib menyesuaikan dengan kode resmi EMIS Kemenag saat sinkronisasi.
 */
const MAPEL_MI = [
  ['PAI', 'Pendidikan Agama Islam dan Budi Pekerti', 'UMUM'],
  ['PPKN', 'Pendidikan Pancasila', 'UMUM'],
  ['BINDO', 'Bahasa Indonesia', 'UMUM'],
  ['MTK', 'Matematika', 'UMUM'],
  ['IPAS', 'Ilmu Pengetahuan Alam dan Sosial', 'UMUM'],
  ['BING', 'Bahasa Inggris', 'UMUM'],
  ['SBDP', 'Seni Budaya dan Prakarya', 'UMUM'],
  ['PJOK', 'Pendidikan Jasmani, Olahraga, dan Kesehatan', 'UMUM'],
  ['BHS_JAWA', 'Bahasa Jawa (Muatan Lokal)', 'MULOK'],
  ['QURDIS', "Al-Qur'an Hadis", 'AGAMA'],
  ['AKIDAH', 'Akidah Akhlak', 'AGAMA'],
  ['FIKIH', 'Fikih', 'AGAMA'],
  ['SKI', 'Sejarah Kebudayaan Islam', 'AGAMA'],
  ['BHS_ARAB', 'Bahasa Arab', 'AGAMA'],
];

/**
 * Menyimpan satu berkas gambar SEBAGAI DATA (PostgreSQL Large Object) pada
 * `file_object`, mengganti isi lama pada `code` yang sama bila ada -- pola
 * sama persis dengan `TenantFileBlobService.simpanTunggal` di sisi API,
 * ditulis ulang di sini karena skrip ini standalone (Node + pg langsung,
 * bukan lewat Nest DI).
 */
async function simpanGambarBlob(tenantClient, { code, name, filename, mimeType, buffer }, actorUserId) {
  await tenantClient.query('BEGIN');
  try {
    const lama = await tenantClient.query(
      `SELECT oid::text AS oid FROM file_object WHERE code = $1 AND deleted_at IS NULL`,
      [code],
    );
    if (lama.rows[0]?.oid) {
      await tenantClient.query(`SELECT lo_unlink($1::oid)`, [lama.rows[0].oid]);
    }
    const lo = await tenantClient.query(`SELECT lo_from_bytea(0, $1::bytea) AS oid`, [buffer]);
    const oid = lo.rows[0].oid;
    await tenantClient.query(
      `INSERT INTO file_object (code, name, storage_key, filename, mime_type, size_bytes, oid, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7::oid, $8, $8)
       ON CONFLICT (code) WHERE deleted_at IS NULL DO UPDATE SET
         name = EXCLUDED.name, filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type,
         size_bytes = EXCLUDED.size_bytes, oid = EXCLUDED.oid, updated_at = now(),
         updated_by = $8, version = file_object.version + 1`,
      [code, name, `blob:${code}`, filename, mimeType, buffer.length, oid, actorUserId],
    );
    await tenantClient.query('COMMIT');
  } catch (err) {
    await tenantClient.query('ROLLBACK');
    throw err;
  }
}

async function peranId(client, kode) {
  const r = await client.query(`SELECT id::text AS id FROM "${SCHEMA}".role WHERE code = $1 LIMIT 1`, [kode]);
  if (!r.rows[0]) throw new Error(`Peran ${kode} tidak ditemukan pada schema ${SCHEMA}. Jalankan migrate:tenants dahulu.`);
  return r.rows[0].id;
}

/**
 * Membuat satu akun staf baru: platform_user + tenant_membership + user_subject
 * (tenant) + user_role_assignment + role_scope. Pola sama dengan
 * `TenantBootstrapService.createOwnerSubject`, tetapi untuk personel BUKAN
 * pemilik -- `is_owner = FALSE`, dan peran yang diberikan bukan OWNER.
 */
async function buatAkun(platformClient, tenantClient, tenantId, { username, password, displayName, email, roleCode }) {
  const existing = await platformClient.query(
    `SELECT id::text AS id FROM platform.platform_user WHERE normalized_username = $1`,
    [username.toLowerCase()],
  );
  let platformUserId = existing.rows[0]?.id;

  if (!platformUserId) {
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    platformUserId = uuid();
    await platformClient.query(
      `INSERT INTO platform.platform_user
         (id, username, normalized_username, email, normalized_email, display_name,
          password_hash, status, must_change_password, is_platform_staff, updated_at)
       VALUES ($1, $2, $2, $3, $3, $4, $5, 'ACTIVE', TRUE, FALSE, now())`,
      [platformUserId, username.toLowerCase(), email ?? null, displayName, hash],
    );
  }

  await platformClient.query(
    `INSERT INTO platform.tenant_membership (id, tenant_id, platform_user_id, is_owner, status, joined_at, updated_at)
     VALUES ($1, $2, $3, FALSE, 'ACTIVE', now(), now())
     ON CONFLICT (tenant_id, platform_user_id) DO NOTHING`,
    [uuid(), tenantId, platformUserId],
  );

  const subjectExisting = await tenantClient.query(
    `SELECT id::text AS id FROM "${SCHEMA}".user_subject WHERE platform_user_id = $1`,
    [platformUserId],
  );
  let userSubjectId = subjectExisting.rows[0]?.id;
  if (!userSubjectId) {
    userSubjectId = uuid();
    await tenantClient.query(
      `INSERT INTO "${SCHEMA}".user_subject
         (id, platform_user_id, code, name, username_snapshot, email_snapshot, is_owner, status)
       VALUES ($1, $2, $3, $4, $3, $5, FALSE, 'ACTIVE')`,
      [userSubjectId, platformUserId, username.toLowerCase(), displayName, email ?? null],
    );
  }

  const roleId = await peranId(tenantClient, roleCode);
  await tenantClient.query(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id)
     VALUES ($1, $2) ON CONFLICT (user_subject_id, role_id) DO NOTHING`,
    [userSubjectId, roleId],
  );
  await tenantClient.query(
    `INSERT INTO "${SCHEMA}".role_scope (role_id, scope_type, scope_id)
     VALUES ($1::uuid, 'TENANT', NULL) ON CONFLICT DO NOTHING`,
    [roleId],
  );

  return { platformUserId, userSubjectId };
}

async function main() {
  const platform = new Client({ connectionString: CONN });
  const tenant = new Client({ connectionString: CONN });
  await platform.connect();
  await tenant.connect();
  await tenant.query(`SET search_path TO "${SCHEMA}"`);

  console.log(`Menyiapkan data Raudlatul Ulum -> schema ${SCHEMA}`);

  const tenantRow = await platform.query(
    `SELECT tenant_id::text AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`,
    [SCHEMA],
  );
  if (!tenantRow.rows[0]) throw new Error(`Tenant untuk schema ${SCHEMA} tidak ditemukan. Registrasikan dahulu.`);
  const TENANT_ID = tenantRow.rows[0].id;

  const adminRow = await tenant.query(
    `SELECT us.platform_user_id::text AS id FROM user_subject us
       JOIN user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN role r ON r.id = ura.role_id
      WHERE r.code = 'EPESANTREN_ADMIN' LIMIT 1`,
  );
  const ACTOR = adminRow.rows[0]?.id;
  if (!ACTOR) throw new Error('Tidak ada pemegang peran EPESANTREN_ADMIN. Registrasikan tenant terlebih dahulu.');

  // -- 0b. Kata sandi pemilik dapat diketahui (hanya bila belum diganti) ----
  //
  // Registrasi publik membuat kata sandi ACAK sekali, dikembalikan HANYA
  // pada respons HTTP saat itu juga -- deploy/onboard-raudlatul-ulum.sh
  // tidak pernah mencatatnya, sehingga tidak ada seorang pun yang tahu
  // kata sandi pemilik setelah registrasi selesai. Di sini direset ke nilai
  // yang diketahui, TETAPI HANYA bila `must_change_password` masih TRUE --
  // itu tanda pasti belum ada seorang pun yang berhasil masuk dan mengganti
  // kata sandinya sendiri. Begitu pemilik sungguhan mengganti kata sandinya
  // (menonaktifkan must_change_password), langkah ini TIDAK PERNAH lagi
  // menimpanya -- mengubah kata sandi orang yang sudah memilikinya sendiri
  // bukan sesuatu yang boleh dilakukan skrip ini diam-diam.
  const KATA_SANDI_AWAL = 'RaudlatulUlum2026!';
  const pemilik = await platform.query(
    `SELECT id::text AS id, username, must_change_password FROM platform.platform_user WHERE id = $1`,
    [ACTOR],
  );
  if (pemilik.rows[0]?.must_change_password === true) {
    const hash = await argon2.hash(KATA_SANDI_AWAL, { type: argon2.argon2id });
    await platform.query(`UPDATE platform.platform_user SET password_hash = $1, updated_at = now() WHERE id = $2`, [
      hash,
      ACTOR,
    ]);
    console.log(`Kata sandi awal pemilik (${pemilik.rows[0].username}) diset ke nilai yang diketahui -- wajib diganti saat masuk pertama.`);
  } else {
    console.log('Pemilik sudah pernah mengganti kata sandinya sendiri -- tidak disentuh.');
  }

  // -- 1. Tahun ajaran ACTIVE -----------------------------------------------
  let tahun = await tenant.query(`SELECT id::text AS id, code FROM pesantren_tahun_ajaran WHERE status = 'ACTIVE' LIMIT 1`);
  let TAHUN_ID;
  if (tahun.rows[0]) {
    TAHUN_ID = tahun.rows[0].id;
    console.log('Tahun ajaran ACTIVE sudah ada:', tahun.rows[0].code);
  } else {
    const ins = await tenant.query(
      `INSERT INTO pesantren_tahun_ajaran (code, name, tanggal_mulai, tanggal_selesai, status, created_by, updated_by)
       VALUES ('2026/2027', 'Tahun Ajaran 2026/2027', '2026-07-01', '2027-06-30', 'ACTIVE', $1, $1)
       RETURNING id::text AS id`,
      [ACTOR],
    );
    TAHUN_ID = ins.rows[0].id;
    console.log('Tahun ajaran 2026/2027 dibuat.');
  }

  // -- 1b. Profil situs publik dan berita ------------------------------------
  //
  // Ditulis langsung lewat SQL, BUKAN lewat HTTP (PUT /pesantren/profil) --
  // skrip ini dijalankan tanpa sesi login (dipanggil dari deploy, bukan
  // manual), dan kata sandi pemilik yang dibuat sekali saat registrasi tidak
  // lagi tersedia pada pemanggilan berikutnya. Kolom yang ditulis sama
  // persis dengan yang divalidasi `PesantrenProfilService`/`validasiProfil`.
  const profilAda = await tenant.query(`SELECT singleton FROM pesantren_website_setting WHERE singleton = TRUE`);
  if (profilAda.rows[0]) {
    console.log('Profil situs sudah ada -- tidak ditimpa (pengurus mungkin sudah menyuntingnya).');
  } else {
    await tenant.query(
      `INSERT INTO pesantren_website_setting
         (singleton, is_published, theme_code, nama_tampilan, tagline, muqodimah_html, sejarah_html, visi, misi,
          pengasuh, tahun_berdiri, afiliasi, alamat_publik, kontak_telepon, kontak_whatsapp,
          kontak_email, meta_description, updated_by)
       VALUES (TRUE, TRUE, 'HIJAU_ISLAMI', 'Raudlatul Ulum',
         'Menyemai Ilmu, Menanam Akhlak, Menebar Manfaat di Bumi Bojonegoro',
         $1, $2, $3, $4, 'KH. Masyhuri Dahlan', 2006, 'Nahdlatul Ulama',
         'Desa Campurejo, Kecamatan Bojonegoro Kota, Kabupaten Bojonegoro, Jawa Timur',
         '081234500000', '081234500000', 'admin@raudlatululum.santri.info',
         'Pondok Pesantren Raudlatul Ulum Bojonegoro -- pendidikan diniyah, Madrasah Ibtidaiyah, dan pelatihan keterampilan (BLK) di bawah naungan Nahdlatul Ulama.',
         $5)`,
      [
        "<p>Alhamdulillahi rabbil 'alamin, segala puji bagi Allah subhanahu wa ta'ala yang telah melimpahkan rahmat dan hidayah-Nya, sehingga Pondok Pesantren Raudlatul Ulum dapat terus istiqomah mengemban amanah mendidik generasi Qur'ani. Shalawat serta salam senantiasa tercurah kepada junjungan kita Nabi Muhammad shallallahu 'alaihi wasallam, keluarga, para sahabat, dan seluruh pengikutnya hingga akhir zaman.</p><p>Sebagai bagian dari keluarga besar Nahdlatul Ulama, Pondok Pesantren Raudlatul Ulum berkomitmen menjaga dan mengamalkan nilai-nilai Ahlussunnah wal Jama'ah An-Nahdliyah -- <em>tawassuth</em> (moderat), <em>tasamuh</em> (toleran), <em>tawazun</em> (seimbang), dan <em>i'tidal</em> (adil) -- dalam setiap laku pendidikan dan dakwah yang kami selenggarakan. Semoga Allah subhanahu wa ta'ala senantiasa memberkahi setiap langkah pengabdian ini, menjadikannya bermanfaat bagi santri, keluarga, dan masyarakat luas. Aamiin.</p>",
        "<p>Pondok Pesantren Raudlatul Ulum berdiri di Desa Campurejo, Kecamatan Bojonegoro Kota, Kabupaten Bojonegoro, Jawa Timur, dirintis oleh <strong>KH. Masyhuri Dahlan</strong> sejak tahun 2006. Bermula dari niat sederhana untuk menghadirkan ruang belajar agama yang membumi bagi masyarakat Campurejo, pondok ini tumbuh menjadi kawasan pendidikan yang menaungi Madrasah Ibtidaiyah (MI), Madrasah Diniyah Takmiliyah, hingga Balai Latihan Kerja Komunitas (BLK) sebagai wujud nyata bahwa ilmu agama dan kemandirian ekonomi umat berjalan beriringan.</p><p>Di bawah naungan Nahdlatul Ulama, Raudlatul Ulum turut aktif dalam Ikatan Pondok Pesantren Bojonegoro (IPPB), termasuk menjadi tuan rumah forum Bahtsul Masail dan rapat kerja para pengasuh pesantren se-Bojonegoro.</p>",
        "Mewujudkan generasi Qur'ani yang berilmu, beramal, dan berakhlak karimah, serta mandiri secara ekonomi demi kemaslahatan umat.",
        "1. Menyelenggarakan pendidikan diniyah dan formal yang berkualitas.\n2. Menanamkan akhlak karimah berlandaskan Ahlussunnah wal Jama'ah An-Nahdliyah.\n3. Membina kemandirian santri melalui unit pelatihan keterampilan (BLK Komunitas).\n4. Mengabdi kepada masyarakat sekitar melalui dakwah dan pemberdayaan ekonomi umat.",
        ACTOR,
      ],
    );
    console.log('Profil situs dibuat dan diterbitkan.');
  }

  const BERITA = [
    [
      'Ikatan Pondok Pesantren Bojonegoro Gelar Rapat Kerja dan Bahtsul Masail di Raudlatul Ulum',
      'Pondok Pesantren Raudlatul Ulum Campurejo menjadi tuan rumah rapat kerja Ikatan Pondok Pesantren Bojonegoro (IPPB) yang dirangkai dengan forum Bahtsul Masail, dipimpin KH. Hilmi Aljumadi.',
      '<p>Pengurus Ikatan Pondok Pesantren Bojonegoro (IPPB) menggelar rapat kerja di Aula Pondok Pesantren Raudlatul Ulum, Desa Campurejo, yang dirangkai dengan forum Bahtsul Masail membahas persoalan keagamaan kontemporer. Kegiatan dipimpin oleh KH. Hilmi Aljumadi dan diikuti perwakilan pondok pesantren se-Kabupaten Bojonegoro.</p>',
      'https://jagatsembilan.com/dirangkai-dengan-bahtsul-masail-ikatan-pondok-pesantren-bojonegoro-gelar-rapat-kerja/',
      '2024-12-25',
    ],
    [
      'NyRU Cafe: Unit Usaha Ekonomi Santri Raudlatul Ulum yang Kian Digemari',
      'Pondok mengembangkan unit usaha kuliner NyRU Cafe sebagai wadah pemberdayaan ekonomi santri dan masyarakat sekitar, dikelola bersama KSPPS BMT Nahdliyyin Raudlatul Ulum.',
      '<p>Sebagai bagian dari misi kemandirian ekonomi umat, Pondok Pesantren Raudlatul Ulum menghadirkan NyRU Cafe -- ruang usaha kuliner sekaligus tempat berkumpul warga yang dikelola berdampingan dengan koperasi syariah KSPPS BMT Nahdliyyin Raudlatul Ulum. Unit usaha ini menjadi sarana belajar kewirausahaan bagi santri sekaligus penggerak ekonomi lokal Desa Campurejo.</p>',
      'https://suaradesa.co/kabar-desa/nyru-cafe-tempat-nongkrong-yang-asik-didefinisikan/',
      '2026-04-18',
    ],
    [
      'BLK Komunitas Raudlatul Ulum Bekali Santri dan Warga Keterampilan Kerja',
      'Balai Latihan Kerja (BLK) Komunitas yang dinaungi pondok terdaftar resmi di Kementerian Ketenagakerjaan, membekali santri dan warga sekitar dengan keterampilan siap kerja.',
      '<p>Selain jalur pendidikan diniyah dan formal, Pondok Pesantren Raudlatul Ulum turut menaungi BLK Komunitas Raudlatul Ulum yang terdaftar dalam sistem kelembagaan Kementerian Ketenagakerjaan RI. Unit ini menyelenggarakan pelatihan keterampilan kerja bagi santri dan masyarakat sekitar, sejalan dengan misi pondok mencetak generasi yang berilmu sekaligus mandiri secara ekonomi.</p>',
      'https://kelembagaan.kemnaker.go.id',
      '2026-02-10',
    ],
    [
      'Sosialisasi Pencegahan DBD bagi Santri Raudlatul Ulum',
      'Tim pengabdian masyarakat menggelar sosialisasi pencegahan demam berdarah dengue (DBD) di lingkungan pondok memakai metode Participatory Learning and Action.',
      "<p>Sebuah tim pengabdian masyarakat menyelenggarakan sosialisasi pencegahan DBD di Pondok Pesantren Raudlatul Ulum Campurejo, memakai metode partisipatif agar santri tidak sekadar menerima materi tetapi turut mempraktikkan langkah pencegahan jentik nyamuk di lingkungan pondok. Kegiatan ini dilaporkan dalam jurnal pengabdian masyarakat SOLMA (UHAMKA).</p>",
      'https://journal.uhamka.ac.id/index.php/solma/article/view/18091',
      '2024-11-11',
    ],
    [
      'Pendampingan Digitalisasi Administrasi Pondok Raudlatul Ulum',
      'Program pengabdian masyarakat melatih pengurus pondok mengelola administrasi lewat Excel, Google Forms/Sheets, dan pengelolaan blog -- menggantikan pencatatan manual.',
      "<p>Sebelumnya administrasi Pondok Pesantren Raudlatul Ulum dikerjakan serba manual. Lewat program pengabdian masyarakat, pengurus pondok dilatih memakai Microsoft Excel (termasuk Analysis ToolPak untuk evaluasi), basis data Google Forms/Sheets, serta pengelolaan blog/situs -- langkah awal modernisasi tata kelola pondok. Kegiatan ini dilaporkan dalam jurnal pengabdian masyarakat SOLMA (UHAMKA).</p>",
      'https://journal.uhamka.ac.id/index.php/solma/article/view/20984',
      '2026-03-01',
    ],
    [
      'Penanaman Karakter Spiritual Sejak Dini di PAUD, TK, dan SD Lingkungan Pondok',
      'Kajian akademik meneliti penanaman karakter spiritual pada anak usia dini di satuan PAUD, TK, dan SD yang bernaung di lingkungan Pondok Pesantren Raudlatul Ulum Campurejo.',
      "<p>Sebuah artikel pada Jurnal ABIDUMASY (Vol. 5 No. 2, 2024) meneliti bagaimana nilai-nilai spiritual ditanamkan sejak dini kepada anak-anak di satuan PAUD, TK, dan SD yang berada di lingkungan Pondok Pesantren Raudlatul Ulum Campurejo, Bojonegoro -- ditulis oleh Moh. Miftahul Choiri, Denny Nurdiansyah, dan Auliyaur Rokhim.</p>",
      'https://doi.org/10.33752/abidumasy.v5i02.7299',
      '2024-06-01',
    ],
    [
      "Mujahadah dan Istighosah: Pembinaan Spiritual Santri dan Masyarakat",
      "Program pembinaan spiritual rutin berupa mujahadah dan istighosah diselenggarakan bagi santri dan masyarakat sekitar Pondok Pesantren Raudlatul Ulum Campurejo.",
      "<p>Pondok Pesantren Raudlatul Ulum Campurejo menyelenggarakan program pembinaan spiritual berupa mujahadah dan istighosah bagi santri sekaligus masyarakat sekitar -- salah satu wujud dakwah rutin pondok yang didokumentasikan dalam Jurnal ABIDUMASY oleh tim penulis yang sama dengan kajian karakter spiritual PAUD/TK/SD.</p>",
      'https://ejournal.unhasy.ac.id/index.php/ABIDUMASY/article/view/5121',
      '2024-03-26',
    ],
    [
      "Jam'iyyah Ta'lim Mujahadah Ahad Pahing: Dakwah Rutin Raudlatul Ulum untuk Masyarakat Campurejo",
      "Kajian skripsi UIN Sunan Kalijaga meneliti strategi dakwah program rutin JTMAP (Jam'iyyah Ta'lim Mujahadah Ahad Pahing) yang diselenggarakan Pondok Pesantren Raudlatul Ulum bagi masyarakat Desa Campurejo.",
      "<p>Pondok Pesantren Raudlatul Ulum menyelenggarakan Jam'iyyah Ta'lim Mujahadah Ahad Pahing (JTMAP), sebuah program dakwah rutin yang digelar setiap Ahad Pahing bagi masyarakat Desa Campurejo, Kabupaten Bojonegoro. Program ini menjadi objek kajian skripsi dakwah di UIN Sunan Kalijaga Yogyakarta yang meneliti strategi dakwahnya dalam menjawab kejenuhan beragama di masyarakat setempat.</p>",
      'https://digilib.uin-suka.ac.id/id/eprint/11650/',
      '2014-01-01',
    ],
    [
      'Peran Wali Santri dalam Memotivasi Anak Belajar di Madrasah Diniyah Raudlatul Ulum',
      'Skripsi UNUGIRI meneliti peran orang tua/wali santri dalam memotivasi anak mengikuti pendidikan di Madrasah Diniyah Raudlatul Ulum Campurejo.',
      '<p>Sebuah skripsi Pendidikan Agama Islam Universitas Nahdlatul Ulama Sunan Giri (UNUGIRI) Bojonegoro, ditulis oleh Masrofatul Fitriyah, meneliti bagaimana wali santri berperan memotivasi anak-anaknya untuk mengikuti pendidikan di Madrasah Diniyah Takmiliyah Raudlatul Ulum Campurejo.</p>',
      'https://repository.unugiri.ac.id',
      '2021-01-01',
    ],
    [
      'Kecerdasan Emosional dan Prestasi Belajar Siswa MI Raudlatul Ulum',
      'Kajian akademik meneliti kecerdasan emosional sebagai media peningkatan prestasi belajar siswa di Madrasah Ibtidaiyah Raudlatul Ulum Bojonegoro.',
      '<p>Sebuah kajian akademik meneliti hubungan kecerdasan emosional dengan prestasi belajar siswa di Madrasah Ibtidaiyah (MI) Raudlatul Ulum Bojonegoro -- menunjukkan perhatian dunia akademik terhadap praktik pendidikan di madrasah ini.</p>',
      'https://www.researchgate.net/publication/399066081',
      '2025-01-01',
    ],
    [
      'BLK Komunitas Raudlatul Ulum Resmi Terdaftar di Sistem Kelembagaan Kemnaker',
      'Balai Latihan Kerja Komunitas Raudlatul Ulum tercatat resmi sebagai Lembaga Pelatihan Kerja Swasta (LPKS) dalam sistem kelembagaan Kementerian Ketenagakerjaan RI.',
      '<p>BLK Komunitas Raudlatul Ulum tercatat sebagai Lembaga Pelatihan Kerja Swasta (LPKS) dalam sistem kelembagaan SIAPkerja Kementerian Ketenagakerjaan RI -- pengakuan formal atas peran pondok dalam pelatihan vokasi bagi santri dan masyarakat sekitar.</p>',
      'https://kelembagaan.kemnaker.go.id/home/companies/deecd9f6-641b-4ab6-871d-0c66b3aacce1/profiles',
      '2023-01-01',
    ],
    [
      'Yayasan Raudlatul Ulum Tervalidasi dalam Sistem Kemendikbudristek',
      'Data yayasan penyelenggara Pondok Pesantren Raudlatul Ulum tercatat dan tervalidasi dalam sistem Vervalyayasan Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi.',
      '<p>Yayasan yang menaungi satuan pendidikan Raudlatul Ulum di Jl. Lisman Gg. Buntu 1, Desa Campurejo, tercatat dan tervalidasi dalam sistem Vervalyayasan Kemendikbudristek -- salah satu syarat tata kelola formal satuan pendidikan di bawahnya, termasuk TK dan MI Raudlatul Ulum.</p>',
      'https://vervalyayasan.data.kemdikbud.go.id',
      '2022-01-01',
    ],
    [
      'Pembukaan DIKTAMA PASTI dan Pelantikan Pengurus Pagar Nusa Dihadiri Dandim Bojonegoro',
      'Komandan Kodim 0813 Bojonegoro menghadiri pelantikan pengurus cabang PSNU Pagar Nusa dan pembukaan DIKTAMA PASTI yang berlangsung di lingkungan Pondok Pesantren Raudlatul Ulum.',
      '<p>Komandan Kodim 0813 Bojonegoro menghadiri acara pelantikan pengurus cabang Pagar Nusa (badan otonom NU) serta pembukaan DIKTAMA PASTI yang diselenggarakan di lingkungan Pondok Pesantren Raudlatul Ulum -- menunjukkan hubungan baik pondok dengan unsur TNI dan organisasi banom NU setempat.</p>',
      'https://www.kodim0813bojonegoro.mil.id/dandim-bojonegoro-hadiri-pelantikan-pimpinan-cabang-psnu-pagar-nusa-dan-pembukaan-diktama-pasti/',
      '2022-08-01',
    ],
    [
      'Pengasuh Raudlatul Ulum Dipercaya Menjadi Wakil Katib PCNU Bojonegoro 2025-2030',
      'Auliyaur Rokhim, tokoh Pondok Pesantren Raudlatul Ulum, dipercaya menjabat Wakil Katib Pengurus Cabang Nahdlatul Ulama (PCNU) Bojonegoro masa khidmat 2025-2030.',
      '<p>Susunan pengurus PCNU Bojonegoro masa khidmat 2025-2030 mencantumkan Auliyaur Rokhim -- tokoh yang juga memimpin satuan pendidikan di lingkungan Pondok Pesantren Raudlatul Ulum -- sebagai Wakil Katib, menegaskan keterikatan erat pondok dengan struktur organisasi Nahdlatul Ulama di tingkat kabupaten.</p>',
      'https://jatim.nu.or.id/pantura/inilah-susunan-pengurus-pcnu-bojonegoro-masa-khidmat-2025-2030-zvEnH',
      '2025-01-01',
    ],
    [
      'Raudlatul Ulum Tercatat dalam Data Pondok Pesantren Resmi Kabupaten Bojonegoro',
      'Pondok Pesantren Raudlatul Ulum terdaftar dalam data terbuka (open data) pondok pesantren yang dikelola Pemerintah Kabupaten Bojonegoro.',
      '<p>Pondok Pesantren Raudlatul Ulum tercatat dalam data pondok pesantren resmi yang dipublikasikan Pemerintah Kabupaten Bojonegoro lewat portal data terbukanya -- bagian dari pendataan pesantren se-kabupaten untuk keperluan pembinaan dan penyaluran program pemerintah daerah.</p>',
      'https://data.bojonegorokab.go.id/public/reff_pendidikan/export_pondok',
      '2023-01-01',
    ],
    [
      'Kehadiran Digital: MI dan BLK Komunitas Raudlatul Ulum Aktif di Media Sosial',
      'Unit pendidikan dan pelatihan di lingkungan pondok aktif membagikan kegiatan lewat akun Instagram resmi masing-masing, memudahkan wali santri dan masyarakat mengikuti perkembangan pondok.',
      '<p>Madrasah Ibtidaiyah Raudlatul Ulum (@miru.bojonegoro) dan BLK Komunitas Raudlatul Ulum (@blkk_raudlatul_ulum_bojonegoro) aktif membagikan dokumentasi kegiatan belajar-mengajar dan pelatihan lewat akun Instagram resmi masing-masing -- salah satu cara pondok menjaga keterbukaan informasi kepada wali santri dan masyarakat luas.</p>',
      'https://instagram.com/miru.bojonegoro',
      '2026-01-01',
    ],
  ];
  for (const [judul, ringkasan, isiHtml, sumberUrl, tanggalTerbit] of BERITA) {
    const ada = await tenant.query(`SELECT 1 FROM pesantren_berita WHERE judul = $1`, [judul]);
    if (ada.rows[0]) continue;
    await tenant.query(
      `INSERT INTO pesantren_berita (judul, ringkasan, isi_html, sumber_url, status, tanggal_terbit, created_by, updated_by)
       VALUES ($1, $2, $3, $4, 'TERBIT', $5, $6, $6)`,
      [judul, ringkasan, isiHtml, sumberUrl, tanggalTerbit, ACTOR],
    );
  }
  console.log(`Berita pondok siap (${BERITA.length} kabar, seluruhnya bersumber dari riset -- lihat sumber_url masing-masing).`);

  const ASSETS_DIR = path.join(__dirname, 'assets');

  // -- 1c-bis. Berita SPMB, dengan poster resmi dari pondok sendiri --------
  //
  // BERBEDA dari 16 berita di atas (hasil riset internet): ini materi RESMI
  // yang diberikan langsung oleh pengurus pondok, bukan diadaptasi dari
  // sumber luar -- karena itu tanpa sumber_url. Poster disimpan lewat
  // mekanisme BLOB yang sama dengan logo/hero (lihat 1c di bawah).
  {
    const judulSpmb = 'SPMB Gelombang I Tahun Ajaran 2026/2027 Resmi Dibuka';
    const adaSpmb = await tenant.query(`SELECT id::text AS id FROM pesantren_berita WHERE judul = $1`, [judulSpmb]);
    let spmbId = adaSpmb.rows[0]?.id;
    if (!spmbId) {
      const ins = await tenant.query(
        `INSERT INTO pesantren_berita (judul, ringkasan, isi_html, status, tanggal_terbit, created_by, updated_by)
         VALUES ($1, $2, $3, 'TERBIT', CURRENT_DATE, $4, $4)
         RETURNING id::text AS id`,
        [
          judulSpmb,
          'Madrasah Ibtidaiyah Raudlatul Ulum Campurejo membuka Sistem Penerimaan Murid Baru (SPMB) Gelombang I untuk tahun ajaran 2026/2027.',
          '<p>Madrasah Ibtidaiyah Raudlatul Ulum Campurejo, Bojonegoro resmi membuka pendaftaran murid baru lewat Sistem Penerimaan Murid Baru (SPMB) Gelombang I untuk tahun ajaran 2026/2027. Calon wali santri dapat menghubungi pengurus madrasah untuk informasi pendaftaran lebih lanjut.</p>',
          ACTOR,
        ],
      );
      spmbId = ins.rows[0].id;
      console.log('Berita SPMB Gelombang I dibuat.');
    } else {
      console.log('Berita SPMB Gelombang I sudah ada.');
    }

    const posterPath = path.join(ASSETS_DIR, 'spmb-2026-poster.jpg');
    if (fs.existsSync(posterPath)) {
      const kodePoster = 'BERITA_SPMB_2026';
      const posterAda = await tenant.query(`SELECT 1 FROM file_object WHERE code = $1 AND deleted_at IS NULL`, [kodePoster]);
      if (!posterAda.rows[0]) {
        const buffer = fs.readFileSync(posterPath);
        await simpanGambarBlob(
          tenant,
          { code: kodePoster, name: 'Poster SPMB 2026', filename: 'spmb-2026-poster.jpg', mimeType: 'image/jpeg', buffer },
          ACTOR,
        );
        await tenant.query(`UPDATE pesantren_berita SET gambar_url = $1 WHERE id = $2`, [
          `/api/v1/pesantren/public/berita-gambar/${kodePoster}`,
          spmbId,
        ]);
        console.log(`Poster SPMB tersimpan (${(buffer.length / 1024).toFixed(0)} KB).`);
      } else {
        console.log('Poster SPMB sudah tersimpan -- tidak ditimpa.');
      }
    }
  }

  // -- 1c. Logo dan gambar latar (BLOB, lihat ATTRIBUTION.md untuk sumber) --
  //
  // Disimpan SEBAGAI DATA (PostgreSQL Large Object pada file_object),
  // bukan folder server -- diminta langsung pengguna. Mengunggah ulang
  // (mis. pengurus mengganti sendiri lewat menu Profil) MENGGANTI baris
  // ini, bukan menambah baris baru -- lihat simpanGambarBlob().
  const GAMBAR = [
    { code: 'PESANTREN_LOGO', name: 'Logo pondok', kolom: 'logo_url', file: 'logo-mi-ru.jpg', mimeType: 'image/jpeg' },
    {
      code: 'PESANTREN_HERO_BACKGROUND',
      name: 'Gambar latar situs',
      kolom: 'hero_image_url',
      file: 'hero-taklim-pesantren.jpg',
      mimeType: 'image/jpeg',
      // Lisensi CC BY-SA 4.0 mewajibkan atribusi -- lihat assets/ATTRIBUTION.md.
      atribusi: 'Foto: Muhamad Izzul Fiqih, CC BY-SA 4.0, via Wikimedia Commons',
    },
  ];
  for (const g of GAMBAR) {
    const lintasan = path.join(ASSETS_DIR, g.file);
    if (!fs.existsSync(lintasan)) {
      console.log(`Lewati ${g.name}: berkas ${g.file} belum ada di ${ASSETS_DIR}.`);
      continue;
    }
    const sudahAda = await tenant.query(`SELECT 1 FROM file_object WHERE code = $1 AND deleted_at IS NULL`, [g.code]);
    if (sudahAda.rows[0]) {
      console.log(`${g.name} sudah tersimpan -- tidak ditimpa (pengurus mungkin sudah mengganti sendiri).`);
      continue;
    }
    const buffer = fs.readFileSync(lintasan);
    await simpanGambarBlob(tenant, { code: g.code, name: g.name, filename: g.file, mimeType: g.mimeType, buffer }, ACTOR);
    const atribusiSql = g.atribusi ? `, hero_image_attribution = $3` : '';
    const params = g.atribusi
      ? [`/api/v1/pesantren/public/gambar/${g.code === 'PESANTREN_LOGO' ? 'logo' : 'hero'}`, ACTOR, g.atribusi]
      : [`/api/v1/pesantren/public/gambar/${g.code === 'PESANTREN_LOGO' ? 'logo' : 'hero'}`, ACTOR];
    await tenant.query(
      `UPDATE pesantren_website_setting SET ${g.kolom} = $1, updated_at = now(), updated_by = $2${atribusiSql} WHERE singleton = TRUE`,
      params,
    );
    console.log(`${g.name} tersimpan (${(buffer.length / 1024).toFixed(0)} KB).`);
  }

  // -- 2. Unit pendidikan (real, terverifikasi lewat riset) -----------------
  const UNIT = [
    ['MI-RU', 'Madrasah Ibtidaiyah Raudlatul Ulum', 'SEKOLAH_FORMAL', 1],
    ['MADIN-RU', 'Madrasah Diniyah Takmiliyah Raudlatul Ulum', 'DINIYAH', 2],
    ['BLKK-RU', 'BLK Komunitas Raudlatul Ulum', 'LAINNYA', 3],
  ];
  const unitId = {};
  for (const [code, name, jenis, urut] of UNIT) {
    const existing = await tenant.query(`SELECT id::text AS id FROM pesantren_unit_pendidikan WHERE code = $1`, [code]);
    if (existing.rows[0]) {
      unitId[code] = existing.rows[0].id;
      continue;
    }
    const ins = await tenant.query(
      `INSERT INTO pesantren_unit_pendidikan (code, name, jenis, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $5) RETURNING id::text AS id`,
      [code, name, jenis, urut, ACTOR],
    );
    unitId[code] = ins.rows[0].id;
  }
  console.log('Unit pendidikan siap:', Object.keys(unitId).join(', '));

  // -- 3. Mata pelajaran Dapodik-aligned untuk MI ----------------------------
  let sortOrder = 1;
  for (const [code, nama, kelompok] of MAPEL_MI) {
    const existing = await tenant.query(`SELECT id FROM pesantren_mata_pelajaran WHERE code = $1`, [code]);
    if (existing.rows[0]) {
      sortOrder += 1;
      continue;
    }
    await tenant.query(
      `INSERT INTO pesantren_mata_pelajaran (code, nama, kelompok, kode_mapel_dapodik, jenjang, sort_order, created_by, updated_by)
       VALUES ($1, $2, $3, $1, 'MI', $4, $5, $5)`,
      [code, nama, kelompok, sortOrder, ACTOR],
    );
    sortOrder += 1;
  }
  console.log(`Mata pelajaran MI (Dapodik-aligned) siap: ${MAPEL_MI.length} baris.`);

  // -- 4. Santri percobaan pembayaran (jelas ditandai uji coba) --------------
  let santri = await tenant.query(`SELECT id::text AS id FROM pesantren_santri WHERE nis = 'MI-2026-0001'`);
  let SANTRI_ID;
  if (santri.rows[0]) {
    SANTRI_ID = santri.rows[0].id;
    console.log('Santri percobaan sudah ada.');
  } else {
    const ins = await tenant.query(
      `INSERT INTO pesantren_santri
         (nis, nama_lengkap, nama_panggilan, jenis_kelamin, tempat_lahir, tanggal_lahir,
          unit_pendidikan_id, status_tinggal, tanggal_masuk, alamat_asal, catatan,
          nisn, agama, kewarganegaraan, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $15)
       RETURNING id::text AS id`,
      [
        'MI-2026-0001',
        'Muhammad Fauzi (Akun Uji Coba Pembayaran)',
        'Fauzi',
        'L',
        'Bojonegoro',
        '2018-05-12',
        unitId['MI-RU'],
        'NONMUKIM',
        '2026-07-13',
        'Desa Campurejo, Kecamatan Bojonegoro Kota, Kabupaten Bojonegoro',
        'Akun demo untuk mencoba alur tagihan dan pembayaran SPP. Aman dihapus kapan saja.',
        '0091234567',
        'Islam',
        'WNI',
        ACTOR,
      ],
    );
    SANTRI_ID = ins.rows[0].id;
    console.log('Santri percobaan MI-2026-0001 dibuat.');
  }

  // -- 5. Tagihan SPP + uang gedung, ISSUED dan belum dibayar ----------------
  const tagihanAda = await tenant.query(
    `SELECT id::text AS id FROM pesantren_tagihan WHERE santri_id = $1 AND periode = '2026-08' AND status <> 'VOID'`,
    [SANTRI_ID],
  );
  if (tagihanAda.rows[0]) {
    console.log('Tagihan Agustus 2026 sudah ada.');
  } else {
    const tagihan = await tenant.query(
      `INSERT INTO pesantren_tagihan (santri_id, periode, jatuh_tempo, total_tagihan, catatan, created_by, updated_by)
       VALUES ($1, '2026-08', '2026-08-10', 200000, 'Tagihan percobaan -- aman dihapus', $2, $2)
       RETURNING id::text AS id`,
      [SANTRI_ID, ACTOR],
    );
    const TAGIHAN_ID = tagihan.rows[0].id;
    await tenant.query(
      `INSERT INTO pesantren_tagihan_item (tagihan_id, kode, deskripsi, jumlah, sort_order) VALUES
         ($1, 'SPP', 'SPP Bulan Agustus 2026', 150000, 0),
         ($1, 'GEDUNG', 'Uang Pemeliharaan Gedung', 50000, 1)`,
      [TAGIHAN_ID],
    );
    await tenant.query(
      `UPDATE pesantren_tagihan SET status = 'ISSUED', diterbitkan_pada = now(), diterbitkan_oleh = $2 WHERE id = $1`,
      [TAGIHAN_ID, ACTOR],
    );
    console.log('Tagihan Agustus 2026 (Rp200.000, status ISSUED) dibuat -- siap dicoba dibayar dari UI.');
  }

  // -- 6. Akun tambahan untuk setiap peran terkait pesantren -----------------
  const akun = [
    {
      username: 'gerbang_raudlatululum',
      password: 'GerbangRU2026!',
      displayName: 'Petugas Gerbang Raudlatul Ulum',
      email: null,
      roleCode: 'EPESANTREN_PETUGAS_GERBANG',
    },
    {
      username: 'wali_raudlatululum',
      password: 'WaliRU2026!',
      displayName: 'Bapak Fauzi (Wali Santri Uji Coba)',
      email: null,
      roleCode: 'EPESANTREN_WALI',
    },
    {
      username: 'kiosk_raudlatululum',
      password: 'KioskRU2026!',
      displayName: 'Akun Perangkat Anjungan Raudlatul Ulum',
      email: null,
      roleCode: 'EPESANTREN_SERVICE_ACCOUNT_KIOSK',
    },
  ];

  for (const a of akun) {
    const { userSubjectId } = await buatAkun(platform, tenant, TENANT_ID, a);
    console.log(`Akun ${a.roleCode} siap: ${a.username}`);

    if (a.roleCode === 'EPESANTREN_WALI') {
      const waliAda = await tenant.query(`SELECT id::text AS id FROM pesantren_wali WHERE user_subject_id = $1`, [userSubjectId]);
      let waliId = waliAda.rows[0]?.id;
      if (!waliId) {
        const insWali = await tenant.query(
          `INSERT INTO pesantren_wali (user_subject_id, nama, hubungan, telepon, created_by, updated_by)
           VALUES ($1, $2, 'AYAH', '081234500001', $3, $3) RETURNING id::text AS id`,
          [userSubjectId, 'Bapak Fauzi', ACTOR],
        );
        waliId = insWali.rows[0].id;
      }
      const tautanAda = await tenant.query(
        `SELECT 1 FROM pesantren_santri_wali WHERE santri_id = $1 AND wali_id = $2 AND deleted_at IS NULL`,
        [SANTRI_ID, waliId],
      );
      if (!tautanAda.rows[0]) {
        await tenant.query(
          `INSERT INTO pesantren_santri_wali (santri_id, wali_id, adalah_wali_utama) VALUES ($1, $2, TRUE)`,
          [SANTRI_ID, waliId],
        );
      }
      console.log('Wali ditautkan sebagai wali utama santri percobaan.');
    }
  }

  console.log('\nSelesai. Ringkasan akun:');
  console.log('  Admin pondok  : admin_raudlatululum (dibuat saat registrasi)');
  for (const a of akun) console.log(`  ${a.roleCode.padEnd(30)}: ${a.username} / ${a.password}`);

  await platform.end();
  await tenant.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
