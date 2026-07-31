/**
 * Bantuan untuk layar koperasi.
 *
 * Ditulis untuk orang yang mengurus koperasi, bukan untuk orang yang memahami
 * perangkat lunak. Pengurus koperasi di kabupaten sering berganti tiap periode
 * kepengurusan, dan yang baru mewarisi sistem tanpa mewarisi orang yang tahu
 * cara memakainya.
 *
 * Karena itu setiap entri menjawab tiga hal, dan yang ketiga paling sering
 * dilewatkan tulisan bantuan pada umumnya:
 *
 *   1. Layar ini untuk apa
 *   2. Bagaimana memakainya
 *   3. **Apa yang tidak dapat diubah setelah dikerjakan** — sebab itulah yang
 *      paling mahal bila baru diketahui belakangan
 */

export interface EntriBantuan {
  /** Kode menu yang dijelaskannya. */
  menuCode: string;
  judul: string;
  ringkas: string;
  langkah: string[];
  /** Hal yang tidak dapat dibatalkan atau diubah kemudian. */
  tidakDapatDiubah: string[];
  /** Kesalahan yang paling sering terjadi pada layar ini. */
  seringKeliru?: string[];
}

export const BANTUAN_KOPERASI: EntriBantuan[] = [
  {
    menuCode: 'COOPERATIVE_PROFILE',
    judul: 'Profil Koperasi',
    ringkas:
      'Identitas koperasi Anda: nama, jenis, badan hukum, dan wilayah keanggotaan. Diisi sekali di awal, lalu jarang disentuh lagi.',
    langkah: [
      'Pilih jenis koperasi. Jenis menentukan apakah koperasi Anda boleh menyalurkan pinjaman dan apakah tunduk pada aturan syariah.',
      'Isi nomor badan hukum beserta tanggalnya sesuai akta pengesahan.',
      'Tentukan lingkup keanggotaan: terbuka untuk umum, khusus karyawan, khusus satu profesi, atau atas undangan.',
      'Ubah status menjadi AKTIF setelah seluruh keterangan lengkap.',
    ],
    tidakDapatDiubah: [
      'Koperasi berstatus AKTIF wajib memiliki nomor badan hukum. Statusnya tidak dapat diaktifkan tanpa itu, sebab koperasi yang belum sah tidak boleh menghimpun simpanan anggota.',
      'Satu ruang kerja hanya untuk satu koperasi. Bila Anda mengelola dua koperasi, keduanya perlu ruang kerja terpisah agar datanya tidak bercampur.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_POLICY',
    judul: 'Kebijakan dan AD/ART',
    ringkas:
      'Anggaran Dasar, Anggaran Rumah Tangga, aturan keanggotaan, dan kebijakan pembagian SHU. Setiap kebijakan punya nomor versi dan tanggal mulai berlaku.',
    langkah: [
      'Susun kebijakan baru sebagai versi berikutnya — jangan menyunting versi yang sedang berlaku.',
      'Tetapkan tanggal mulai berlakunya.',
      'Sahkan lewat keputusan Rapat Anggota. AD/ART, aturan keanggotaan, dan kebijakan SHU tidak sah tanpa itu.',
    ],
    tidakDapatDiubah: [
      'Kebijakan yang sudah dipakai menghitung SHU tidak boleh disunting. SHU dihitung menurut kebijakan yang berlaku pada periode bukunya; menyuntingnya membuat perhitungan tahun lalu tidak dapat diulang dan tidak dapat dipertanggungjawabkan kepada anggota.',
      'Pengesahan kebijakan menuntut nomor keputusan RAT. Tanpa itu kebijakan tetap berstatus draf.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_MEMBER',
    judul: 'Anggota',
    ringkas:
      'Daftar anggota dan calon anggota. Keduanya berada di satu daftar, dibedakan statusnya.',
    langkah: [
      'Catat calon anggota beserta berkasnya.',
      'Setelah simpanan pokok dibayar dan berkas lengkap, ubah statusnya menjadi AKTIF — nomor anggota dan tanggal aktif akan diminta.',
      'Anggota yang berhenti diubah statusnya menjadi BERHENTI beserta tanggal dan alasannya.',
    ],
    tidakDapatDiubah: [
      'Anggota tidak dapat dihapus, hanya diberhentikan. Datanya masih diperlukan untuk penyelesaian simpanan dan untuk jejak audit — dan pinjaman yang pernah diberikan kepadanya harus tetap dapat ditelusuri.',
      'Calon anggota tidak boleh diberi tanggal aktif sebelum statusnya diubah. Sistem menolaknya, agar tidak ada jalan mengisi tanggalnya lebih dahulu lalu mengubah statusnya belakangan.',
    ],
    seringKeliru: [
      'Nomor anggota bukan nomor urut berkas. Sekali diberikan, ia melekat pada orangnya selamanya.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_SAVING',
    judul: 'Simpanan',
    ringkas:
      'Setoran dan penarikan simpanan anggota, beserta buku pembantunya.',
    langkah: [
      'Buka rekening simpanan untuk anggota sesuai produknya.',
      'Catat setoran atau penarikan. Saldo dihitung sistem, bukan diketik.',
      'Cetak rekening koran bila anggota memintanya.',
    ],
    tidakDapatDiubah: [
      'Simpanan pokok dan simpanan wajib TIDAK dapat ditarik selama keanggotaan berjalan. Keduanya modal keanggotaan, bukan titipan. Sistem menolak produk simpanan wajib yang ditandai dapat ditarik.',
      'Saldo simpanan tidak pernah boleh negatif. Simpanan bukan pinjaman.',
      'Satu periode simpanan wajib hanya dapat dibayar sekali per rekening.',
    ],
    seringKeliru: [
      'Produk simpanan tidak boleh membawa bunga dan nisbah sekaligus. Pilih satu — produk yang membawa keduanya tidak dapat dijelaskan kepada pengawas mana pun.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_LOAN',
    judul: 'Pinjaman',
    ringkas:
      'Permohonan, analisis, persetujuan, pencairan, dan angsuran pinjaman anggota.',
    langkah: [
      'Terima permohonan dan lengkapi berkasnya.',
      'Susun analisis kredit — termasuk agunan dan penjamin bila ada.',
      'Ajukan untuk disetujui. Penyetujunya harus orang lain, bukan penyusun analisisnya.',
      'Cairkan setelah disetujui. Jadwal angsuran terbentuk dan dibekukan pada saat pencairan.',
    ],
    tidakDapatDiubah: [
      'Jadwal angsuran dibekukan saat pencairan. Perubahan syarat dilakukan lewat restrukturisasi, yang membentuk pinjaman baru menunjuk yang lama — bukan dengan menyunting jadwalnya.',
      'Penganalisis tidak boleh menjadi penyetuju, dan penyetuju tidak boleh menjadi pengaju pencairan. Sistem menolaknya, dan penolakan itu tidak dapat dilewati siapa pun.',
      'Penghapusbukuan menuntut dua orang berbeda. Ini perbuatan yang paling mudah dipakai menghilangkan jejak pinjaman bermasalah; satu tanda tangan tidak cukup untuknya.',
    ],
    seringKeliru: [
      'Akad syariah tidak boleh membawa tarif bunga, dan metode konvensional tidak boleh membawa nisbah. Qardh tidak boleh membawa imbalan apa pun.',
      'Alokasi pembayaran harus berjumlah persis sama dengan nilai yang dibayarkan. Selisih di sini berarti ada uang diterima yang tidak sampai ke mana pun.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_MEETING',
    judul: 'Rapat Anggota',
    ringkas:
      'Undangan, kehadiran, kuorum, pemungutan suara, keputusan, dan notulen.',
    langkah: [
      'Susun agenda dan sebarkan undangan.',
      'Catat kehadiran. Kuorum dihitung sistem berdasarkan syarat yang dicuplik saat rapat dibuka.',
      'Lakukan pemungutan suara per mata acara.',
      'Susun notulen dan sahkan.',
    ],
    tidakDapatDiubah: [
      'Satu anggota satu suara, berapa pun besar simpanannya. Tidak ada cara memberi bobot pada suara — itu pembeda koperasi dari perseroan terbatas, dan sistem ini tidak menyediakan tempat untuk menyimpannya.',
      'Keputusan yang diambil tanpa kuorum ditandai TIDAK SAH, bukan dihapus. Keputusan itu terjadi dan mungkin sudah dilaksanakan; menghilangkannya dari catatan membuat pelaksanaannya tidak dapat dijelaskan kemudian.',
      'Syarat kuorum dicuplik saat rapat dibuka. Bila AD/ART kelak diubah, kuorum rapat yang sudah lewat tidak ikut berubah.',
    ],
    seringKeliru: [
      'Notulen yang disusun dengan bantuan AI ditandai jelas dan wajib diperiksa manusia sebelum disahkan. Sistem menolak pengesahan notulen AI yang belum diperiksa.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_SHU',
    judul: 'Sisa Hasil Usaha',
    ringkas:
      'Menghitung dan membagikan SHU menurut kebijakan yang disahkan RAT.',
    langkah: [
      'Pastikan tahun buku sudah ditutup.',
      'Jalankan perhitungan. Angka masukannya dicuplik dan disimpan bersama hasilnya.',
      'Ajukan ke RAT untuk disahkan.',
      'Bagikan setelah keputusan RAT tercatat.',
    ],
    tidakDapatDiubah: [
      'Angka masukan dicuplik, bukan dibaca ulang. Simpanan anggota hari ini berbeda dari simpanannya saat tahun buku ditutup; membaca ulang berarti menghitung SHU tahun lalu memakai angka tahun ini.',
      'Satu tahun buku hanya boleh punya satu perhitungan yang hidup. Dua perhitungan berarti dua angka SHU, dan tidak ada yang tahu mana yang dibagikan.',
      'Perhitungan yang sudah disetujui atau dibagikan tidak dapat diubah. Bila ada kekeliruan, buat perhitungan pembetulan yang menunjuk yang lama.',
      'Pemotongan tidak boleh melebihi hak anggota. SHU tidak dapat berubah menjadi utang.',
    ],
    seringKeliru: [
      'SHU dibagi menurut dua hal sekaligus — besar simpanan (jasa modal) dan besar transaksi anggota dengan koperasi (jasa usaha). Anggota dengan simpanan sama dapat menerima SHU berbeda, dan itu benar.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_UNIT',
    judul: 'Unit Usaha',
    ringkas:
      'Toko, kantin, atau usaha lain milik koperasi, beserta tautannya ke kasir (POS).',
    langkah: [
      'Buat unit usaha dan tautkan ke outlet yang sudah ada.',
      'Tautkan kategori anggota ke kelompok pelanggan agar harga khusus anggota berlaku di kasir.',
      'Baca patronage secara berkala setelah periode buku ditutup.',
    ],
    tidakDapatDiubah: [
      'Satu outlet hanya boleh dimiliki satu unit usaha. Dua pemilik akan menghitung penjualan yang sama dua kali, dan SHU dibagikan atas angka itu.',
      'Patronage dibaca berkala dari kasir, bukan dicatat saat transaksi. Bila dicatat saat transaksi, angkanya ikut berubah setiap ada retur — termasuk retur yang terjadi setelah SHU dihitung.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_WEBSITE',
    judul: 'Situs Koperasi',
    ringkas:
      'Halaman publik koperasi Anda: profil, pengumuman, produk, dan formulir pendaftaran calon anggota.',
    langkah: [
      'Susun isi halaman dan pengaturan tampilannya.',
      'Pilih apa yang boleh tampil — jumlah anggota dan besar aset bawaannya TIDAK ditampilkan.',
      'Terbitkan halaman satu per satu dengan memberinya tanggal terbit.',
      'Buka pendaftaran daring bila Anda siap memeriksa berkas yang masuk.',
    ],
    tidakDapatDiubah: [
      'Halaman tidak terbit sampai diberi tanggal terbit. Draf tidak akan pernah tampil karena lupa diberi tanda.',
      'Lamaran yang masuk lewat situs TIDAK langsung menjadi anggota. Ia berhenti pada daftar calon dan menunggu pemeriksaan Anda — tanpa itu siapa pun di internet dapat menambahkan nama ke daftar anggota koperasi Anda.',
      'Lamaran yang ditolak wajib diberi alasan. Calon anggota berhak mengetahuinya.',
    ],
    seringKeliru: [
      'Menampilkan jumlah anggota dan besar aset adalah pilihan Anda, bukan bawaan. Angka itu meyakinkan calon anggota, tetapi juga dipakai orang lain menilai apakah koperasi Anda layak didekati.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_COMPLAINT',
    judul: 'Pengaduan Anggota',
    ringkas:
      'Keberatan yang disampaikan anggota lewat portal, beserta penanganannya.',
    langkah: [
      'Terima dan golongkan pengaduan.',
      'Tanggapi. Tanggapan biasa terlihat anggota; catatan internal tidak.',
      'Selesaikan dengan menuliskan penyelesaiannya, lalu tutup.',
    ],
    tidakDapatDiubah: [
      'Pengaduan tidak dapat dihapus. Pengaduan yang dapat dihapus adalah pengaduan yang dapat dihilangkan oleh orang yang isinya menegur dirinya.',
      'Menyatakan pengaduan SELESAI atau DITOLAK menuntut keterangan penyelesaiannya. Tanpa itu, "selesai" tidak dapat dibedakan dari "diabaikan".',
      'Penutupan menuntut nama orang yang menutup.',
      'Anggota dapat membuka kembali pengaduan yang sudah selesai dengan menanggapinya. Itu disengaja.',
    ],
    seringKeliru: [
      'Pengaduan anonim tetap menyimpan pemiliknya di sistem — namanya hanya tidak ditampilkan kepada Anda. Anggota diberi tahu hal ini sebelum menulis.',
    ],
  },
  {
    menuCode: 'COOPERATIVE_PORTAL',
    judul: 'Portal Anggota',
    ringkas:
      'Layar yang dibuka anggota untuk melihat simpanan, pinjaman, SHU, rapat, dan pengaduannya sendiri.',
    langkah: [
      'Aktifkan akun portal anggota dari layar Anggota.',
      'Anggota masuk dan mengatur PIN-nya sendiri.',
    ],
    tidakDapatDiubah: [
      'Anggota hanya melihat datanya sendiri. Tidak ada pengaturan yang dapat membuatnya melihat data anggota lain — kecuali rapat anggota, yang memang milik bersama.',
      'PIN anggota TIDAK PERNAH terlihat kasir maupun petugas mana pun, dan tidak dapat diatur mereka. Anggota mengaturnya sendiri lewat portal.',
      'Anggota yang sudah berhenti tidak dapat lagi membuka portal, tetapi datanya tetap tersimpan.',
    ],
    seringKeliru: [
      'Memberi seseorang akses portal tidak memberinya akses ke layar pengurus, dan sebaliknya. Keduanya peran yang terpisah sama sekali.',
    ],
  },
];

export function bantuanUntuk(menuCode: string): EntriBantuan | undefined {
  return BANTUAN_KOPERASI.find((b) => b.menuCode === menuCode);
}
