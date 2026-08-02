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
         (singleton, is_published, theme_code, nama_tampilan, tagline, sejarah_html, visi, misi,
          pengasuh, tahun_berdiri, afiliasi, alamat_publik, kontak_telepon, kontak_whatsapp,
          kontak_email, meta_description, updated_by)
       VALUES (TRUE, TRUE, 'HIJAU_ISLAMI', 'Raudlatul Ulum',
         'Menyemai Ilmu, Menanam Akhlak, Menebar Manfaat di Bumi Bojonegoro',
         $1, $2, $3, 'KH. Masyhuri Dahlan', 2006, 'Nahdlatul Ulama',
         'Desa Campurejo, Kecamatan Bojonegoro Kota, Kabupaten Bojonegoro, Jawa Timur',
         '081234500000', '081234500000', 'admin@raudlatululum.santri.info',
         'Pondok Pesantren Raudlatul Ulum Bojonegoro -- pendidikan diniyah, Madrasah Ibtidaiyah, dan pelatihan keterampilan (BLK) di bawah naungan Nahdlatul Ulama.',
         $4)`,
      [
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
  console.log('Berita pondok siap (3 kabar terverifikasi dari riset).');

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
