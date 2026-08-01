/**
 * Profil hak aksi P0–P12 sesuai blueprint Versi 8 Revisi 1.
 *
 * Profil adalah cetakan: satu role menyatakan profil apa yang berlaku pada modul
 * apa, lalu seeder menurunkannya menjadi baris role_menu_permission. Tanpa
 * lapisan ini, 140 role dikali ratusan menu dikali 26 aksi berarti menulis dan
 * memelihara ratusan ribu baris satu per satu.
 *
 * Menambah menu baru otomatis terwarisi seluruh role, karena role menunjuk modul
 * dan bukan daftar menu.
 */

/**
 * Kode profil hak aksi.
 *
 * P0–P12 adalah profil umum Versi 8. M1–M8 adalah profil khusus marketplace
 * Versi 9, ditambahkan pada berkas yang sama dan bukan berkas kedua, supaya
 * mesin penurunan izinnya tetap satu.
 */
export type ProfileCode =
  | 'P0' | 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6'
  | 'P7' | 'P8' | 'P9' | 'P10' | 'P11' | 'P12'
  | 'C1' | 'C2' | 'C3' | 'C4'
  | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9'
  | 'K1' | 'K2' | 'K3' | 'K4' | 'K5';

/**
 * Tingkat pembatasan data. Menentukan baris mana yang terlihat, bukan tombol
 * mana yang tampil — keduanya lapisan berbeda dan keduanya ditegakkan server.
 */
/**
 * Daftar berjalan, bukan hanya tipe.
 *
 * Tingkat cakupan punya **kembaran di basis data**: dua CHECK constraint pada
 * `role_data_scope` dan `user_scope_assignment` yang mengenumerasi nilai yang
 * sah. Menambah nilai pada tipe saja membuat kode menyemai peran dengan tingkat
 * yang ditolak constraint — dan penolakannya muncul saat provisioning tenant,
 * bukan saat kompilasi.
 *
 * Itu sudah terjadi sekali: `CLASS_GROUP` dan `GUARDIAN_CHILD` ditambahkan,
 * seluruh uji satuan hijau, lalu provisioning demo berhenti di CI dengan
 * "violates check constraint ck_role_data_scope_level".
 *
 * Daftar ini ada supaya `education-data-scope.spec.ts` dapat membandingkannya
 * dengan SQL-nya dan menyalakan merah sebelum sampai ke basis data.
 */
export const DATA_SCOPE_CODES = [
  'PLATFORM',        // seluruh platform
  'TENANT',          // seluruh organisasi tenant
  'LEGAL_ENTITY',    // badan hukum yang ditugaskan
  'BRAND',           // brand yang ditugaskan
  'OUTLET',          // outlet yang ditugaskan
  'OUTLET_TERMINAL', // outlet + terminal + shift, khusus kasir
  'STORE',           // toko online yang ditugaskan (Versi 9)
  'WAREHOUSE',       // gudang yang ditugaskan
  'FULFILLMENT_LOCATION', // lokasi pemenuhan pesanan online (Versi 9)
  'PAYMENT_PROVIDER_ACCOUNT', // akun provider pembayaran tertentu (Versi 9)
  'DEPARTMENT',      // unit kerja
  'TEAM',            // bawahan langsung
  'SELF',            // hanya data milik sendiri
  'ASSIGNED_TRIP',   // perjalanan yang ditugaskan
  'ASSIGNED_QUEUE',  // antrean tiket yang ditugaskan
  'OWNERSHIP',       // kepemilikan investor sendiri
  'API_SCOPE',       // scope klien API
  // --- Pendidikan (Versi 13 §8) --------------------------------------------
  //
  // `GUARDIAN_CHILD` yang paling menentukan di antara semuanya: ia satu-satunya
  // cakupan yang dipegang orang di LUAR institusi. Portal wali adalah permukaan
  // terluas dengan pengguna paling sedikit terlatih, dan cakupan yang bocor di
  // sana berarti seorang wali membaca data anak orang lain.
  'INSTITUTION',     // satu perguruan tinggi/sekolah/pesantren dalam yayasan
  'CAMPUS',          // kampus/cabang yang ditugaskan
  'FACULTY',         // fakultas yang ditugaskan
  'STUDY_PROGRAM',   // program studi yang ditugaskan
  'SCHOOL_UNIT',     // unit sekolah yang ditugaskan
  'GRADE',           // tingkat kelas yang ditugaskan
  'CLASS_GROUP',     // rombel/kelas/halaqah yang diampu
  'PESANTREN_UNIT',  // unit pesantren yang ditugaskan
  'DORMITORY',       // asrama yang diampu
  'ROOM',            // kamar yang diampu
  'LEARNER_SELF',    // peserta didik: hanya dirinya sendiri
  'GUARDIAN_CHILD',  // wali: hanya anak yang menjadi tanggungannya
] as const;

export type DataScopeCode = (typeof DATA_SCOPE_CODES)[number];

const READ_ONLY = ['READ', 'PRINT'] as const;

const OPERATOR = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT'] as const;

const OPERATOR_IMPORT = [...OPERATOR, 'DELETE', 'IMPORT'] as const;

const APPROVER = ['READ', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'PRINT'] as const;

const SUPERVISOR = [
  'READ', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'EXPORT', 'IMPORT', 'PRINT', 'SUBMIT', 'REVIEW',
] as const;

const MODULE_MANAGER = [
  ...SUPERVISOR,
  'APPROVE', 'REJECT', 'CANCEL', 'POST', 'REVERSE', 'RETURN', 'CHECK_ALL',
  'VIEW_AMOUNT',
] as const;

const MODULE_ADMIN = [
  ...MODULE_MANAGER,
  'AUDIT_READ', 'MANAGE_DEVICE', 'DELEGATE', 'VIEW_COST',
] as const;

const TENANT_ADMIN = [
  ...MODULE_ADMIN,
  'VIEW_PROFIT', 'CLOSE_PERIOD', 'REOPEN',
] as const;

const AUDITOR = ['READ', 'EXPORT', 'PRINT', 'AUDIT_READ'] as const;

const SELF_SERVICE = ['READ', 'CREATE', 'UPDATE', 'SUBMIT', 'PRINT'] as const;

const EXECUTIVE = [
  'READ', 'PRINT', 'EXPORT', 'APPROVE', 'REJECT',
  'VIEW_AMOUNT', 'VIEW_COST', 'VIEW_PROFIT', 'AUDIT_READ',
] as const;

const SERVICE_ACCOUNT = ['READ', 'CREATE', 'UPDATE'] as const;

// --- Profil marketplace Versi 9 ------------------------------------------

const MP_VIEWER = ['READ', 'PRINT', 'EXPORT'] as const;

const MP_OPERATOR = [...MP_VIEWER, 'CREATE', 'UPDATE'] as const;

const MP_BULK = [...MP_OPERATOR, 'DELETE', 'RESTORE', 'IMPORT'] as const;

/**
 * Operator fulfillment. Sengaja TIDAK memiliki UPDATE: blueprint menyatakan
 * "Packer tidak mengubah harga atau kuantitas order" dan "Picker tidak membuat
 * stock adjustment". Ditegakkan lewat profil, bukan lewat aturan pemisahan
 * tugas — sebab tidak ada dua role yang bertabrakan di sini, yang ada adalah
 * batas hak di dalam satu role.
 */
const MP_FULFILLMENT = ['READ', 'PRINT', 'PICK', 'PACK', 'SHIP', 'ASSIGN'] as const;

/**
 * Layanan pelanggan. Boleh membuat permintaan retur, tetapi TIDAK memiliki
 * REFUND_APPROVE maupun MANAGE_CREDENTIAL — keduanya disebut eksplisit pada
 * blueprint sebagai yang tidak boleh dipegang layanan pelanggan.
 */
const MP_CUSTOMER_SERVICE = ['READ', 'PRINT', 'CREATE', 'UPDATE'] as const;

const MP_SUPERVISOR = [
  ...MP_BULK,
  'PICK', 'PACK', 'SHIP', 'DELIVER', 'ASSIGN',
  'SUBMIT', 'REVIEW', 'CANCEL', 'RETURN_APPROVE',
] as const;

/**
 * Manajer atau administrator seller. Blueprint menyatakan ia memegang seluruh
 * operasi tenant marketplace "kecuali credential penuh dan platform
 * moderation", sehingga MANAGE_CREDENTIAL tidak termasuk — hak itu terpisah
 * pada ADMIN_ESMARTLINK_TENANT yang menuntut step-up.
 */
const MP_SELLER_ADMIN = [
  ...MP_SUPERVISOR,
  'APPROVE', 'REJECT', 'PUBLISH', 'UNPUBLISH', 'MODERATE',
  'RESERVE', 'RELEASE', 'VIEW_AMOUNT', 'VIEW_COST',
] as const;

/**
 * Platform marketplace. Menambah moderasi lintas seller, rekonsiliasi, dan
 * pembacaan audit. HARD_DELETE tetap tidak termasuk, sejalan dengan keputusan
 * P8 pada Versi 8: penghapusan permanen adalah hak tersendiri.
 */
const MP_PLATFORM = [
  ...MP_SELLER_ADMIN,
  'RECONCILE', 'AUDIT_READ', 'VIEW_PROFIT', 'REFUND_APPROVE', 'POST',
] as const;

/**
 * Pemegang credential provider pembayaran.
 *
 * Blueprint Versi 9 bertentangan dengan dirinya sendiri pada titik ini: M7
 * didefinisikan sebagai seluruh operasi seller "kecuali credential penuh",
 * tetapi ADMIN_ESMARTLINK_TENANT — yang seluruh alasan keberadaannya adalah
 * mengelola credential — didaftarkan sebagai M7. Salah satu harus mengalah.
 *
 * Yang dipertahankan adalah pengecualian pada M7, sebab ia melindungi role yang
 * jauh lebih banyak dipakai (ADMIN_TOKO_ONLINE). Hak credential dipisahkan ke
 * profil tersendiri ini, dan hanya berlaku pada modul aktivasi. Aksinya sendiri
 * menuntut step-up.
 */
const MP_CREDENTIAL = [...MP_SELLER_ADMIN, 'MANAGE_CREDENTIAL'] as const;

// --- Profil kasir (POS) ----------------------------------------------------

/*
 * Mengapa profil tersendiri, bukan menambah aksi POS ke P2/P6 yang sudah ada.
 *
 * Profil bersifat lintas modul: satu profil berlaku pada setiap modul yang
 * ditugaskan kepada role. Menambahkan `REFUND_APPROVE` atau `RECONCILE` ke
 * MODULE_MANAGER akan memberikannya pula pada modul lain yang kebetulan
 * menawarkan aksi itu — hari ini modul marketplace. Hak menyetujui refund
 * bukan sesuatu yang boleh merembes karena seseorang manajer modul di tempat
 * lain.
 *
 * Versi 9 sudah menempuh jalan yang sama untuk marketplace (M1–M9), dengan
 * alasan yang sama. K1–K4 mengikutinya.
 */

/**
 * Kasir. Menjual, menahan, melanjutkan, membatalkan baris sebelum pembayaran,
 * membuka dan menutup shiftnya sendiri, serta memberi diskon baris.
 *
 * Yang TIDAK dimilikinya, dan sengaja demikian: menyetujui apa pun, mengubah
 * harga, memindahkan kas, melihat harga pokok, dan membatalkan transaksi yang
 * sudah selesai. Kasir yang melihat margin akan tergoda memberi diskon "yang
 * masih untung" — dan itu bukan wewenangnya.
 */
const POS_CASHIER = [
  'READ', 'CREATE', 'UPDATE', 'PRINT',
  'SELL', 'HOLD', 'RESUME', 'DISCOUNT_LINE',
  'OPEN_SHIFT', 'CLOSE_SHIFT',
  'RETURN',
] as const;

/**
 * Supervisor kasir. Menambah persetujuan, pembatalan transaksi selesai, diskon
 * keranjang, penggantian harga, pergerakan kas, dan rekonsiliasi.
 *
 * Memiliki hak menyetujui BUKAN berarti boleh menyetujui permintaannya sendiri:
 * aturan pemisahan tugas menolaknya secara terpisah, dan penolakan itu tetap
 * berlaku meskipun hak aksesnya ada.
 */
const POS_SUPERVISOR = [
  ...POS_CASHIER,
  // Tanpa DELETE dengan sengaja. Supervisor menjalankan shift; menghapus
  // terminal adalah pekerjaan administrator toko. Memberi DELETE di sini juga
  // akan membuat supervisor terhitung berhak mengunggah data massal, sebab
  // syarat tombol Unggah adalah memiliki UPDATE dan DELETE sekaligus.
  'CANCEL', 'APPROVE', 'REJECT', 'EXPORT', 'SUBMIT', 'REVIEW',
  'DISCOUNT_CART', 'PRICE_OVERRIDE', 'CASH_MOVE', 'RECONCILE',
  'RETURN_APPROVE', 'REFUND_APPROVE',
  'VIEW_AMOUNT',
] as const;

/**
 * Kepala toko. Seluruh hak supervisor ditambah harga pokok dan margin.
 *
 * Sengaja tidak dibuat sebagai peran yang lebih tinggi namun lebih tidak
 * berdaya. Kepala toko yang harus memanggil supervisor untuk menyetujui refund
 * akan mendorong orang berbagi kata sandi, dan itu lebih buruk daripada memberi
 * izinnya secara terbuka.
 */
const POS_STORE_MANAGER = [
  ...POS_SUPERVISOR,
  'DELETE', 'RESTORE', 'IMPORT', 'POST', 'REVERSE', 'CHECK_ALL', 'DELEGATE',
  'VIEW_COST', 'VIEW_PROFIT', 'AUDIT_READ',
] as const;

/** Auditor POS. Membaca segalanya, termasuk biaya; tidak mengubah apa pun. */
const POS_AUDITOR = [
  'READ', 'PRINT', 'EXPORT', 'AUDIT_READ', 'VIEW_AMOUNT', 'VIEW_COST', 'VIEW_PROFIT',
] as const;

/**
 * Administrator master POS. Menyiapkan terminal, penugasan register, dan
 * setelan struk — tanpa satu pun hak yang menyentuh uang.
 *
 * Sengaja bukan P7. Profil manajer modul umum memberi APPROVE, CANCEL, dan
 * REVERSE, yang pada layar kasir berarti menyetujui diskon dan membatalkan
 * transaksi yang sudah dibayar. Orang yang memasang mesin kasir tidak
 * seharusnya berada di dalam rantai persetujuan transaksinya — itulah pemisahan
 * antara yang menyiapkan alat dan yang memakainya.
 */
const POS_MASTER_ADMIN = [
  'READ', 'CREATE', 'UPDATE', 'DELETE', 'RESTORE',
  'EXPORT', 'IMPORT', 'PRINT', 'MANAGE_DEVICE', 'AUDIT_READ',
] as const;

/**
 * Aksi yang diberikan tiap profil.
 *
 * Catatan penting tentang P8: HARD_DELETE sengaja TIDAK termasuk. Blueprint
 * menyebut "seluruh hak tenant kecuali platform dan hard purge terbatas".
 * Penghapusan permanen tetap menuntut permission tersendiri dan step-up,
 * sehingga tidak ikut terbawa hanya karena seseorang administrator tenant.
 */
/**
 * Profil koperasi (C1–C4).
 *
 * Dibuat tersendiri dengan alasan yang sama seperti keluarga POS K1–K5: profil
 * umum P1–P12 tidak mengenal `ANALYZE`, `DISBURSE`, dan `WRITE_OFF`, sehingga
 * peran koperasi yang memakainya akan memperoleh hak itu lewat profil yang
 * terlalu luas — atau tidak memperolehnya sama sekali.
 *
 * Yang dijaga keluarga ini adalah pemisahan yang paling menentukan pada
 * koperasi simpan pinjam: **yang menganalisis tidak menyetujui, dan yang
 * menyetujui tidak mencairkan tanpa jejak.**
 */

/**
 * Petugas koperasi. Mencatat dan menganalisis; tidak menyetujui apa pun.
 *
 * `ANALYZE` ada di sini dan `APPROVE` tidak. Itulah seluruh maksudnya: analisis
 * kredit kehilangan gunanya bila penyusunnya sekaligus yang memutuskan, dan
 * pasangan itulah yang paling sering dipakai menyalurkan pinjaman fiktif.
 */
const COOP_OFFICER = ['READ', 'CREATE', 'UPDATE', 'PRINT', 'EXPORT', 'ANALYZE', 'SUBMIT'] as const;

/**
 * Penyetuju koperasi. Menyetujui dan mencairkan; tidak mencatat.
 *
 * Tanpa `CREATE` dan `UPDATE` dengan sengaja — pemisahan itulah yang membuat
 * persetujuannya berarti. Ketua yang dapat membuat permohonan lalu
 * menyetujuinya sendiri tidak sedang menyetujui apa pun.
 */
const COOP_APPROVER = [
  'READ', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'PRINT', 'EXPORT',
  'DISBURSE', 'VIEW_AMOUNT',
] as const;

/**
 * Pengurus koperasi yang menanggung keputusan terberat.
 *
 * Satu-satunya profil koperasi yang memegang `WRITE_OFF`. Penghapusbukuan
 * menghilangkan piutang dari neraca dan merupakan perbuatan yang paling mudah
 * dipakai menutupi pinjaman bermasalah — basis data karena itu tetap menuntut
 * dua orang berbeda, dan hak akses ini tidak menggantikannya.
 */
const COOP_BOARD = [...COOP_APPROVER, 'WRITE_OFF', 'CANCEL', 'AUDIT_READ'] as const;

/**
 * Anggota koperasi pada portalnya.
 *
 * Sengaja tidak memakai P10 (layanan mandiri) yang juga memberi `UPDATE`.
 * Anggota mengubah satu hal saja — menandai pemberitahuan sudah dibaca — dan
 * `UPDATE` yang berlaku pada seluruh menu portal jauh lebih luas daripada itu.
 */
const COOP_MEMBER = ['READ', 'CREATE', 'SUBMIT', 'PRINT'] as const;

export const PROFILE_ACTIONS: Record<ProfileCode, readonly string[]> = {
  P0: [],
  P1: READ_ONLY,
  P2: OPERATOR,
  P3: OPERATOR_IMPORT,
  P4: APPROVER,
  P5: SUPERVISOR,
  P6: MODULE_MANAGER,
  P7: MODULE_ADMIN,
  P8: TENANT_ADMIN,
  P9: AUDITOR,
  P10: SELF_SERVICE,
  P11: EXECUTIVE,
  P12: SERVICE_ACCOUNT,
  M1: MP_VIEWER,
  M2: MP_OPERATOR,
  M3: MP_BULK,
  M4: MP_FULFILLMENT,
  M5: MP_CUSTOMER_SERVICE,
  M6: MP_SUPERVISOR,
  M7: MP_SELLER_ADMIN,
  M8: MP_PLATFORM,
  M9: MP_CREDENTIAL,
  K1: POS_CASHIER,
  K2: POS_SUPERVISOR,
  K3: POS_STORE_MANAGER,
  K4: POS_AUDITOR,
  K5: POS_MASTER_ADMIN,
  C1: COOP_OFFICER,
  C2: COOP_APPROVER,
  C3: COOP_BOARD,
  C4: COOP_MEMBER,
};

export const PROFILE_LABELS: Record<ProfileCode, string> = {
  P0: 'Tanpa akses',
  P1: 'Lihat',
  P2: 'Operator',
  P3: 'Operator Impor',
  P4: 'Penyetuju',
  P5: 'Supervisor',
  P6: 'Manajer Modul',
  P7: 'Admin Modul',
  P8: 'Administrator Tenant',
  P9: 'Auditor',
  P10: 'Layanan Mandiri',
  P11: 'Eksekutif/Investor',
  P12: 'Perangkat/Service Account',
  M1: 'Viewer Marketplace',
  M2: 'Operator Katalog/Pesanan',
  M3: 'Operator Bulk',
  M4: 'Operator Fulfillment',
  M5: 'Layanan Pelanggan',
  M6: 'Supervisor Marketplace',
  C1: 'Petugas Koperasi',
  C2: 'Penyetuju Koperasi',
  C3: 'Pengurus Koperasi',
  C4: 'Anggota Koperasi',
  M7: 'Manajer/Admin Seller',
  M8: 'Platform Marketplace',
  M9: 'Pemegang Credential Pembayaran',
  K1: 'Kasir',
  K2: 'Supervisor Kasir',
  K3: 'Kepala Toko',
  K4: 'Auditor POS',
  K5: 'Administrator Master POS',
};

/**
 * Syarat tombol Upload pada blueprint bagian 15: tampil hanya bila UPDATE dan
 * DELETE keduanya dimiliki. Dihitung dari profil, bukan ditulis ulang di UI,
 * supaya UI dan server memakai sumber yang sama.
 */
export function profileAllowsUpload(profile: ProfileCode): boolean {
  const actions = PROFILE_ACTIONS[profile];
  return actions.includes('UPDATE') && actions.includes('DELETE');
}

/** Profil yang memenuhi syarat unggah. Dipakai pengujian agar tidak melenceng. */
export const UPLOAD_CAPABLE_PROFILES: ProfileCode[] = (
  Object.keys(PROFILE_ACTIONS) as ProfileCode[]
).filter(profileAllowsUpload);
