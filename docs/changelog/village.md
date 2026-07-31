# Changelog — info-desa (village)

Changelog modular sesuai panduan koordinasi paralel §11. Sesi Core/Integrator
menggabungkan entri terpilih ke `CHANGELOG.md` saat integrasi.

---

## D-0 — Audit dan profil Desa/Kelurahan

**Cabang:** `feature/v12-info-desa` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sepuluh dokumen audit pada `docs/info-desa/`.
- Dua integration request pada `docs/integration-requests/village/`.
- Changelog modular ini.

Belum ada kode. D-0 adalah tahap audit.

### Temuan yang mengubah rencana

- **`WorkflowPort` tidak ada.** Perintah §7 dan spesifikasi §7 mengharuskan
  village memakai mesin workflow bersama lewat adapter. Yang ada hanya empat
  tabel `workflow_*` dari V007 — tanpa satu baris kode pun yang menjalankannya.
  Tidak ada yang dapat diadaptasi.

  D-4 membangun alur persetujuannya sendiri di balik antarmuka milik village,
  mengikuti pola `surat` yang sudah terbukti. Diajukan sebagai
  [integration request 001](../integration-requests/village/001-workflow-port.md).

- **`modules/health/` sudah terpakai, dan bukan oleh kesehatan.** Panduan
  koordinasi §4 menugaskan namespace itu kepada sesi eMedik; isinya pemeriksa
  kesehatan aplikasi (`GET /health`) yang dipakai pemantauan produksi. Bukan
  wilayah village, dilaporkan sebagai peringatan dini pada
  [integration request 002](../integration-requests/village/002-health-namespace-collision.md).

- **Tidak ada satu pun *port* formal.** Sebelas port disebut perintah §7;
  pencarian `interface *Port` mengembalikan nol hasil. Village mendefinisikan
  port sebagai antarmuka miliknya sendiri dan menulis adapter tipis ke layanan
  Core yang ada.

- **Lima dari sebelas port belum punya mitra.** `HealthAggregatePort`,
  `CooperativeIntegrationPort`, `PosIntegrationPort`, `PaymentPort`, dan
  `WorkflowPort`. Adapternya mengembalikan "belum tersedia" dengan jujur —
  tidak pernah data karangan.

### Keputusan yang dicatat

- **Kelayakan profil ditegakkan pada layanan, bukan hanya menu.** Menu yang
  disembunyikan tetapi endpoint-nya terbuka bukan pembatasan melainkan
  penyamaran. Uji kebocoran profil menyasar endpoint.
- **Membaca data penduduk ikut diaudit**, bukan hanya menulisnya. Pada
  kependudukan, penyalahgunaan berbentuk pembacaan.
- **APBDes bukan pembukuan komersial.** Yang dipakai dari Core adalah mesin
  peristiwa akuntansinya, bukan bagan akun komersialnya. Belanja melampaui pagu
  ditolak pada tingkat basis data.
- **Surat desa bukan surat kantor.** `surat_outgoing` adalah korespondensi antar
  lembaga; surat keterangan domisili adalah keluaran layanan warga. Yang dipakai
  ulang dari modul `surat` adalah penomorannya, bukan tabelnya.

### Penghalang yang diwarisi

Tiga, seluruhnya dari V8 yang tidak pernah dibangun:

| Penghalang | Akibat |
|---|---|
| Pusat Bantuan (V8-1/V8-2) | D-12 tidak dapat menyediakan Help dalam aplikasi |
| Ekspor Excel (V8-5/6) | Laporan hanya tampil di layar |
| Cetak PDF (V8-7) | **Surat tidak dapat diunduh sebagai PDF** — yang paling menyakitkan bagi vertikal ini |

Rencana sementara untuk yang ketiga: HTML siap cetak, pendekatan yang sudah
dipakai halaman Proposal/PKS/Penawaran pada Core.

### Garis dasar

Diverifikasi di dalam worktree village:

- `jest` — 45 suite, **1048 tes lulus**
- `vitest` — 4 berkas, **35 tes lulus**
- `tsc --noEmit` API dan web — bersih
- `eslint --max-warnings=0` — bersih

Sasaran D-1 sampai D-12: **sekurang-kurangnya 210 pengujian baru**.

---

## D-1 — Portal, profil wilayah, dan domain

### Ditambahkan

- **`village-profile.ts`** — katalog kelayakan **77 fitur** di seluruh dua belas
  fase, beserta fungsi `layak()` yang dipakai menu, layanan, dan data contoh.
  Satu berkas, bukan tersebar: aturan yang tersebar di puluhan berkas akan
  menyimpang di salah satunya tanpa ketahuan.
- **Migrasi `20260731000001__village__region_and_profile.sql`** — sepuluh tabel:
  `village_unit`, `village_profile_change`, `village_sub_area`, `village_rw`,
  `village_rt`, `village_boundary`, `village_geo_area`, `village_potential`,
  `village_indicator`, `village_domain`.
- **`VillageMigrationService`** dengan manifes sendiri di
  `tenant-migrations/village/`.
- **`VillageUnitService`** dan sebelas endpoint `/village/*`.
- **Katalog modular**: 40 menu, 29 peran, ~130 hak akses `VILLAGE.*`.
- **79 pengujian** baru (54 unit + proof 16 pemeriksaan pada basis data nyata).

### Keputusan yang dicatat

- **Manifes migrasi terpisah.** `tenant-migrations/manifest.json` adalah berkas
  bersama berkonflik tinggi yang disunting empat sesi; penambahan pada satu
  array JSON dari empat cabang pasti bentrok. Village memakai manifes sendiri
  dengan versi berawalan waktu UTC. Bookkeeping tetap menumpang tabel
  `schema_migration` yang sama — runner Core mengiterasi manifesnya sendiri dan
  mengabaikan baris yang tidak dikenalnya.
- **Satu tabel untuk dusun dan lingkungan**, dibedakan `kind`. Dua tabel
  berbentuk sama akan memaksa setiap kueri kependudukan menggabungkan keduanya.
  `kind` ditentukan dari profil penyewa, bukan dari permintaan — membiarkan
  pemanggil menentukannya akan memungkinkan kelurahan membuat dusun hanya
  dengan mengirim nilai yang lain.
- **GeoJSON sebagai JSONB, bukan PostGIS.** Ekstensi itu belum tentu ada pada
  setiap pemasangan, dan kebutuhan village hanya menampilkan peta.
- **Kode wilayah administratif disimpan sebagai teks.** Nol di depan bermakna
  dan akan hilang bila disimpan sebagai bilangan.
- **Perubahan profil menuntut dasar hukum.** Desa berubah status menjadi
  kelurahan ketika wilayahnya menjadi perkotaan — itu peristiwa hukum, dan
  APBDes yang tersusun sebelumnya tetap harus dapat dipertanggungjawabkan.
- **Fitur `CONFIGURABLE` bawaannya MATI.** Kewenangan yang tidak dinyatakan
  tidak boleh dianggap ada.
- **Domain sendiri wajib diverifikasi**; subdomain `info-desa.id` tidak, dan
  hanya boleh yang sesuai slug penyewa — tanpa itu, satu desa dapat mengambil
  subdomain bernama desa lain.

### Cacat yang ditangkap pengujian sendiri

Katalog peran memberikan `REJECT` pada enam menu yang tidak mendeklarasikan
aksi itu. Hak akses yang menunjuk aksi tak bernama tidak akan pernah dapat
diberikan kepada siapa pun, dan kegagalannya senyap — peran tampak punya
wewenang yang sesungguhnya tidak berlaku. Cacat sejenis pernah ditemukan pada
Core (`CRM.CREATE` menunjuk menu root yang hanya punya `READ`).

Diperbaiki dengan menambahkan `REJECT` pada keenam menu, dan aturannya
dinyatakan: **setiap menu yang punya `APPROVE` wajib punya `REJECT`.**
Persetujuan yang tidak dapat ditolak bukan persetujuan melainkan formalitas.

### Berkas bersama yang disentuh

`apps/api/src/app.module.ts` — dua baris (satu impor, satu daftar). Titik sentuh
terkecil yang mungkin; konflik dengan sesi eMedik dan eKoperasi yang menambahkan
barisnya sendiri mudah diselesaikan.

### Bukti

`docs/info-desa/bukti-d1-profile-isolation.txt` — 16 pemeriksaan pada dua skema
sungguhan, seluruhnya lulus. Termasuk: `profile_type` menolak nilai ketiga,
jenis sub-wilayah menolak nilai di luar dua, domain sendiri tanpa token
ditolak, hanya satu domain utama per unit, RT unik per RW, dan perubahan profil
tanpa dasar hukum ditolak.

### Gerbang mutu

- `jest` — **1102 tes lulus** (bertambah 54)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih

---

## D-2 — Penduduk, keluarga, dan peristiwa kependudukan

### Ditambahkan

- **`village-resident.ts`** — aturan kependudukan sebagai fungsi murni:
  pemeriksaan NIK, penandaan duplikat, susunan kartu keluarga, transisi
  peristiwa, usia dan kelompoknya, serta ambang penyajian agregat.
  **39 pengujian.**
- **Migrasi `20260731000002__village__resident_and_family.sql`** — tujuh tabel:
  `village_family`, `village_resident`, `village_resident_history`,
  `village_resident_access_log`, `village_vital_event`,
  `village_resident_duplicate`, `village_resident_document`.
- **`VillageResidentService`** dengan penegakan cakupan pada kueri, dan
  **tujuh endpoint** `/village/residents/*`, `/village/vital-events/*`.

### Tiga sikap yang disengaja, dan berlawanan dengan naluri "sistem harus ketat"

**NIK yang janggal ditandai, bukan ditolak.** Godaannya besar: NIK punya format
terdefinisi, dan menolak yang tidak sesuai terasa benar. Tetapi NIK yang
tercetak keliru pada KTP sungguhan **ada**, dan warga pemiliknya tetap berhak
dilayani desanya. Menolaknya memaksa petugas mengarang NIK lain agar datanya
dapat masuk — dan data karangan lebih buruk daripada data yang ditandai janggal.
Yang tetap ditolak hanyalah yang bukan enam belas digit angka, sebab itu pasti
kesalahan pengetikan.

**Duplikat ditandai, bukan diputuskan.** NIK kembar bisa berarti salah ketik,
pemalsuan, atau kesalahan penerbitan. Sistem tidak tahu yang mana. Menolaknya
otomatis menghalangi pendataan warga yang datanya memang bermasalah — padahal
justru merekalah yang paling perlu dibantu mengurusnya. Penandaan dijalankan
**sesudah** penyimpanan, bukan sebelumnya.

**NIK dan nomor KK unik per penyewa, bukan global.** Warga yang pindah antar
desa tercatat pada keduanya untuk sementara; keunikan global akan menghalangi
desa tujuan mendata kedatangannya.

### `village_resident_access_log` — tabel yang tidak punya padanan

Pada kependudukan, penyalahgunaan berbentuk **pembacaan**: membuka data
tetangga karena penasaran, menyalin daftar penerima bantuan menjelang pemilihan.
Audit yang hanya mencatat perubahan tidak akan pernah melihatnya.

Yang dicatat: siapa, kapan, dalam kapasitas apa, penduduk mana, dari layar mana.
Yang **tidak** dicatat: isi datanya — catatan akses tidak boleh menjadi salinan
kedua dari data yang dilindunginya.

Kegagalan mencatat tidak menggagalkan pembacaannya: petugas tidak boleh berhenti
melayani warga yang sedang berdiri di depannya karena satu tabel jejak bermasalah.
Kegagalannya dicatat sebagai peringatan supaya tetap terlihat.

### Keputusan lain

- **Cakupan ditegakkan pada kueri**, mengembalikan potongan `WHERE` — bukan
  menyaring hasil. Penyaringan hasil tetap membaca seluruh baris dari basis data.
- **`AGGREGATE_ONLY` dan `NONE` menghasilkan `AND FALSE`.** BPD mengawasi, tidak
  menyelidiki; Linmas menjaga ketertiban, tidak mendata.
- **"Tidak ditemukan" dan "di luar cakupan" memberi pesan yang sama.**
  Membedakannya akan memberi tahu bahwa penduduk itu ADA di RT lain — dan itu
  sendiri sudah kebocoran.
- **Penyuntingan wajib beralasan**, dan setiap medan yang berubah menghasilkan
  satu baris riwayat beserta rujukan dokumennya.
- **Penduduk meninggal atau pindah tidak dihapus dan tidak dapat disunting.**
  Dokumen kependudukan kerap dibutuhkan bertahun-tahun kemudian, termasuk oleh
  ahli warisnya.
- **Persetujuan peristiwa dan perubahan status penduduk dalam satu transaksi.**
  Peristiwa yang disetujui tanpa status yang ikut berubah membuat penduduk yang
  sudah meninggal tetap tampak hidup pada daftar.
- **Penolakan peristiwa wajib beralasan**, ditegakkan constraint. Warga yang
  laporannya ditolak tanpa keterangan akan datang kembali menanyakan hal yang
  sama, dan petugas berikutnya tidak tahu apa yang harus dijawab.

### Yang belum tersambung, dan disebutkan terbuka

`cakupan()` pada controller mengembalikan `UNIT` bagi seluruh pengguna.
Mesin penyaringnya sudah ada dan teruji; yang belum adalah **sumber**
cakupannya — penyambungan ke `user_scope_assignment` Core dikerjakan pada D-3.
Sampai itu selesai, Ketua RT masih melihat seluruh desa.

Disebutkan di sini alih-alih dibiarkan tampak sudah berlaku.

### Gerbang mutu

- `jest` — **1141 tes lulus** (bertambah 39)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi pada skema sungguhan: 17 tabel village terbentuk

---

## D-3 — Aparatur, register, dan cakupan data

### Menutup celah D-2

`cakupan()` pada controller sebelumnya mengembalikan `UNIT` bagi semua orang,
sehingga **Ketua RT masih melihat seluruh desa**. Fase ini menyambungkannya ke
penugasan sungguhan.

Dibuktikan pada basis data: desa uji berisi 2 RW, 4 RT, 20 warga. Cakupan
`UNIT` mengembalikan 20 baris, `RW` mengembalikan 10, `RT` mengembalikan **5**.
Penyaringan terjadi pada kueri — jumlah baris yang kembali dari basis data
memang lebih sedikit, bukan disaring sesudahnya.

### Ditambahkan

- **`village-officer.ts`** — masa jabatan, pelimpahan wewenang, deteksi
  lingkaran struktur organisasi, dan penyelesai cakupan efektif. **34 pengujian.**
- **Migrasi `20260731000003`** — tujuh tabel: `village_officer`,
  `village_officer_term`, `village_bpd_member`, `village_org_node`,
  `village_delegation`, `village_scope_assignment`, `village_register_entry`.
- **`VillageScopeService`** — menyelesaikan cakupan dari penugasan dan peran.
- **Tiga endpoint**: `GET /village/my-scope`, `POST /village/scopes`,
  `POST /village/scopes/:id/revoke`.
- **Integration request 003** — meminta Core memperluas `ck_user_scope_type`.

### Bawaannya menutup, bukan membuka

Cakupan yang tidak dapat ditentukan menghasilkan `NONE`, bukan `UNIT`. Ini
keputusan yang paling mudah salah: bawaan longgar berarti pengguna yang
penugasannya belum sempat diisi melihat seluruh warga desa, **dan tidak ada yang
menyadarinya karena tidak ada yang error.** Bawaan ketat menghasilkan keluhan
pada hari pertama — dan keluhan jauh lebih baik daripada kebocoran yang senyap.

Turunannya: bawaan peran yang menunjuk objek (`RT`, `RW`, `SUB_AREA`, `SELF`)
tanpa penugasan juga menjadi `NONE`. Ketua RT tanpa penugasan RT tidak tahu RT
mana yang dimaksud.

### Mengapa `village_scope_assignment` ada tersendiri

`ck_user_scope_type` milik Core membatasi jenis cakupan pada daftar tertutup
yang tidak memuat dusun, RW, maupun RT — dan memang tidak seharusnya memuatnya:
itu kosakata pemerintahan desa, bukan kosakata perdagangan. Mengubah constraint
pada tabel bersama dilarang dilakukan langsung dari cabang vertikal.

Bentuk tabelnya sengaja dibuat sama persis dengan milik Core, sehingga
penggabungan kelak hanya memindahkan baris. Diajukan sebagai
[integration request 003](../integration-requests/village/003-village-scope-types.md).

**Perkiraan pada D-0 terbukti tepat**, hanya constraint yang tertabrak berbeda
dari yang diperkirakan — `ck_user_scope_type`, bukan `ck_role_module_profile_code`.

### Keputusan lain

- **Tanggal yang menentukan masa jabatan, bukan kolom status.** Masa jabatan
  yang tanggal berakhirnya sudah lewat tetap bertuliskan `AKTIF` sampai ada yang
  memperbaruinya, dan di kantor desa hal itu bisa tertunda berbulan-bulan.
  Aparatur yang purnatugas tetapi aksesnya menyala masih tinggal di kampung yang
  sama dan masih kenal semua orang.
- **Aparatur menunjuk `village_resident`**, tidak menyalin nama dan NIK-nya —
  data yang disalin akan berbeda dari sumbernya begitu salah satunya diperbarui.
  `external_name` disediakan untuk Lurah, yang kerap bukan warga desa itu.
- **Masa jabatan tabel tersendiri.** Satu orang dapat menjabat lebih dari
  sekali, dan riwayatnya bagian dari arsip desa.
- **Pelimpahan wewenang wajib berbatas waktu**, maksimum 180 hari. Yang tidak
  berujung bukan pelimpahan melainkan pergantian jabatan — prosedur berbeda
  dengan surat keputusan berbeda.
- **Sebelas jenis register memakai satu tabel** yang dibedakan `register_type`.
  Sebelas tabel berbentuk sama membuat pencarian lintas register menjadi sebelas
  kueri yang digabung.
- **Keterangan cakupan dikembalikan bersama data.** "Tidak ada data" dan "Anda
  tidak berwenang" adalah dua hal yang sangat berbeda; menyamakannya membuat
  petugas mengira sistemnya rusak lalu meminta administrator memperbaiki hal
  yang tidak rusak.

### Bukti

`docs/info-desa/bukti-d3-data-scope.txt` — **22 pemeriksaan pada basis data
sungguhan**, seluruhnya lulus.

### Gerbang mutu

- `jest` — **1175 tes lulus** (bertambah 34)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih

---

## D-4 — Layanan warga, surat, antrean, dan alur persetujuan

Inti sistem. Layanan warga dan surat adalah alasan sebuah desa memakai sistem
seperti ini.

### Ditambahkan

- **`village-service.ts`** — aturan layanan sebagai fungsi murni: mesin transisi
  sepuluh status, kelengkapan berkas, perhitungan SLA dalam hari kerja,
  penyusunan nomor surat dari pola, dan pemeriksaan alur buntu. **41 pengujian.**
- **`ports/workflow.port.ts`** — antarmuka `WorkflowPort` milik village.
- **`VillageWorkflowService`** — mesin alur persetujuan yang village bangun
  sendiri, sebab mesin bersama yang disebut perintah §7 tidak ada.
- **Migrasi `20260731000004`** — sebelas tabel layanan, surat, antrean, dan alur.
- **Migrasi `20260731000005`** — penjaga satu desa per schema.
- **`VillageRequestService`** dan **tujuh endpoint** `/village/requests/*`,
  `/village/queue/*`.

### Mengapa BUKAN memakai tabel `surat_*` Core

`surat_outgoing` adalah korespondensi resmi antar lembaga: ada pengirim,
penerima, klasifikasi, disposisi. Surat keterangan domisili bukan surat keluar —
ia **keluaran layanan**, yang pemohonnya warga dari luar organisasi, punya
persyaratan berkas, antrean, dan janji waktu.

Memaksakan keduanya ke satu tabel menghasilkan tabel yang setengah kolomnya
selalu kosong, dan laporan surat kantor yang tercemar ribuan surat keterangan.
Yang **dipakai ulang** adalah polanya, termasuk penomoran anti-kembar.

### Empat sikap yang berasal dari keadaan nyata di kantor desa

**Penolakan dan pengembalian wajib beralasan** — ditegakkan constraint, bukan
hanya layanan. Permohonan yang berhenti tanpa kabar adalah keluhan nomor satu
pelayanan publik; warga yang ditolak tanpa keterangan akan datang lagi
menanyakan hal yang sama, dan petugas berikutnya tidak tahu apa yang harus
dijawab.

**SLA dihitung sejak berkas lengkap**, bukan sejak permohonan masuk. Perbedaannya
bukan teknis melainkan soal siapa yang disalahkan angkanya: warga yang butuh
seminggu melengkapi berkas bukan kesalahan desa, dan angka yang menyalahkan
pihak yang salah tidak akan dipakai siapa pun untuk memperbaiki apa pun.

**Cuplikan definisi alur disimpan pada permohonan.** Bila katalog diubah —
persyaratan ditambah, jenjang persetujuan diubah — permohonan yang sudah
berjalan tetap memakai aturan yang berlaku saat ia masuk. Warga yang mengajukan
surat pada hari Senin tidak boleh tiba-tiba dituntut melengkapi berkas yang baru
diwajibkan pada hari Rabu.

**Pemohon tidak dapat memutuskan permohonannya sendiri** — ditegakkan mesin
alur, bukan diserahkan kepada pemanggil. Di desa kecil, perangkat desa juga
warga yang suatu saat mengajukan surat untuk dirinya.

### Satu desa satu schema — dijaga basis data

Atas pertanyaan pemilik sistem. eBisnis memakai skema-per-penyewa sejak awal:
satu desa mendaftar, satu schema PostgreSQL dibuat, dan pemisahannya berada di
lapisan basis data.

Yang **belum** dijaga adalah dua unit pemerintahan tersisip ke satu schema.
Akibatnya senyap seluruhnya: layanan village membaca baris pertama menurut
`created_at`, sehingga unit kedua tidak pernah terlihat pada daftar mana pun;
bila urutannya berubah karena baris pertama dinonaktifkan, seluruh sistem
tiba-tiba menunjuk desa yang berbeda tanpa galat apa pun; dan karena kelayakan
profil ditentukan `profile_type` unit itu, dua unit berbeda profil berarti
APBDes desa dapat dibuka petugas kelurahan.

Ditutup dengan indeks unik parsial. Baris nonaktif tidak menghalangi — desa yang
berubah status menjadi kelurahan menonaktifkan unit lamanya lalu membuat yang
baru, dan itu sah.

### Keputusan lain

- **Verifikasi publik tidak membocorkan data pribadi.** Pihak ketiga memeriksa
  keaslian surat tanpa masuk sistem; yang dikembalikan hanya sah/tidak sah,
  nomor, tanggal, jenis layanan, dan nama desanya. Halaman yang menampilkan isi
  surat akan menjadikan setiap token yang bocor sebagai kebocoran data warga.
- **`BERKAS_KURANG` kembali ke `DIAJUKAN`, bukan ke `DRAF`.** Warga melengkapi
  berkasnya, bukan mengajukan ulang dari nol; nomor antreannya tetap dan
  riwayatnya tidak terputus.
- **Riwayat permohonan punya penanda terlihat-warga.** Catatan internal petugas
  tidak perlu — dan tidak seharusnya — dibaca pemohonnya.
- **Satu permohonan satu surat**, ditegakkan indeks unik. Permohonan yang
  menerbitkan dua surat bernomor berbeda berarti salah satunya tidak dapat
  dipertanggungjawabkan.
- **Nomor antrean kembali ke satu setiap hari.** Yang tidak pernah kembali akan
  mencapai angka ribuan pada bulan ketiga, dan warga yang dipanggil nomor 3.412
  kehilangan gambaran berapa lama lagi gilirannya.
- **Layanan tanpa jenjang persetujuan langsung disetujui.** Surat keterangan
  sederhana pada desa kecil memang begitu; memaksakan langkah kosong hanya
  menambah klik tanpa menambah kendali.
- **Register surat keluar terisi otomatis** saat surat terbit. Buku register
  yang harus diisi ulang secara manual adalah buku register yang tidak pernah
  lengkap.
- **Alur buntu ketahuan saat dikonfigurasi**, bukan saat warga sudah mengantre.
  Desa kecil kerap tidak punya seluruh jabatan, dan alur yang menuntut Kasi
  Pelayanan pada desa yang tidak punya Kasi Pelayanan akan menggantung selamanya.

### Bukti

`docs/info-desa/bukti-d4-layanan-warga.txt` — **25 pemeriksaan pada dua desa
sungguhan**, seluruhnya lulus.

### Yang masih terhalang

Cetak PDF surat (V8-7 tidak pernah dibangun). Surat dapat dirender sebagai HTML
siap cetak; itu bukan pengganti PDF bertanda tangan digital, tetapi cukup
dipakai. Belum dikerjakan pada fase ini.

### Gerbang mutu

- `jest` — **1216 tes lulus** (bertambah 41)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi: 35 tabel village terbentuk

---

## D-5 — Pengaduan, aspirasi, dan Musrenbang

### Ditambahkan

- **`village-complaint.ts`** — aturan sebagai fungsi murni: mesin transisi
  pengaduan dan usulan, penyaringan identitas, eskalasi, pengurutan usulan,
  pembagian pagu, dan kuorum. **40 pengujian.**
- **Migrasi `20260731000006`** — sebelas tabel pengaduan, aspirasi, Musrenbang,
  usulan, kehadiran, dan survei.
- **Migrasi `20260731000007`** — koreksi pemicu audit (lihat di bawah).
- **`VillageParticipationService`** dan **sembilan endpoint**.

### Anonimitas: tidak disimpan, bukan disembunyikan

Pengaduan yang paling perlu didengar adalah pengaduan **tentang perangkat desa
itu sendiri** — pungutan liar, bantuan yang tidak sampai, keputusan yang
berpihak. Warga tidak akan menyampaikannya bila namanya terlihat oleh orang yang
ia adukan, yang tinggal di kampung yang sama dan akan terus ia temui.

Karena itu mode `ANONIM` berarti identitas pelapor **tidak disimpan sama
sekali**. Constraint basis data menolak baris anonim yang membawa identitas apa
pun, sehingga satu jalan kode yang lupa mengosongkannya gagal saat menyimpan
alih-alih menyimpan diam-diam.

**Tidak ada kolom hash pelapor.** Godaan yang wajar: simpan `sha256(nik)` untuk
mencegah spam, "toh tidak dapat dibalik". Tetapi ruang NIK hanya enam belas
digit dan desa memiliki daftar NIK seluruh warganya — mencocokkan hash terhadap
seribu NIK memakan kurang dari sedetik. Hash dari data berentropi rendah yang
daftarnya sudah dipegang bukan penyamaran, melainkan penundaan yang tidak
menunda apa pun.

**Kategori yang menyangkut aparatur dipaksa anonim.** Warga yang memilih
kategori itu lalu lupa mencentang "sembunyikan nama saya" tidak boleh tanpa
sengaja mengungkapkan dirinya kepada orang yang ia adukan.

**Aduan tentang aparatur tidak dapat ditugaskan kepadanya** — ditegakkan
constraint dan layanan. Menugaskan aduan kepada terlapor sama dengan menutupnya.

### Koreksi: pemicu audit village tidak pernah terpasang

Migrasi D-1 sampai D-5 memuat blok pemasangan pemicu audit yang mencari fungsi
bernama `fn_audit_row_change`. **Nama itu tidak pernah ada.** Fungsi audit yang
sesungguhnya bernama `audit_row_trigger()` dan tinggal pada skema audit terpisah
(`<tenant>__audit`), sebagaimana dipasang `V008`.

Akibatnya penjaga `IF EXISTS` selalu bernilai salah, blok itu dilewati tanpa
galat, dan **tidak satu pun tabel village benar-benar diaudit** — meskipun
komentar migrasi dan changelog D-1 sampai D-4 menyatakan sebaliknya.

Kegagalannya senyap justru karena penjaganya. Blok yang dijaga `IF EXISTS` tidak
pernah mengeluh ketika syaratnya tidak terpenuhi; ia hanya diam. Itu pilihan
yang tepat untuk menghadapi skema uji tanpa infrastruktur audit, tetapi menjadi
jebakan ketika nama yang dicari memang salah.

Cacat kedua di jalur yang sama: `VillageMigrationService` tidak pernah
mensubstitusi `{{AUDIT_SCHEMA}}`, sehingga naskah yang memakainya akan menyebut
skema bernama harfiah `{{AUDIT_SCHEMA}}` — yang juga tidak ada.

**Ditemukan oleh pengujian yang justru dimaksudkan membuktikan hal sebaliknya**:
asersi bahwa `village_proposal` diaudit sementara `village_complaint` tidak.

Diperbaiki: blok palsu dibuang dari kelima migrasi, pemasangan dipusatkan pada
migrasi `20260731000007` dengan nama fungsi yang benar, dan `{{AUDIT_SCHEMA}}`
kini disubstitusi. Klaim "diaudit" pada changelog D-1 sampai D-4 baru menjadi
benar sejak commit ini.

Yang sengaja dikecualikan dari audit: `village_complaint`, `village_aspiration`
(pemicu menyalin nilai lama-baru termasuk identitas pelapor — aduan yang pernah
tersimpan terbuka lalu diubah menjadi anonim akan meninggalkan salinannya, dan
anonimitas yang bocor lewat jalur audit tetaplah bocor), serta tabel jejak
seperti `village_resident_access_log` (mengaudit jejak menghasilkan jejak dari
jejak tanpa menambah apa pun).

### Keputusan lain

- **Pengaduan yang selesai dapat dibuka kembali.** Yang sekali ditutup tidak
  dapat dibuka lagi akan mendorong petugas menutupnya cepat-cepat demi angka
  penyelesaian.
- **Usulan yang tidak tertampung pagu DITUNDA, bukan ditolak.** Menolaknya
  menghapus jejak bahwa warga pernah mengusulkannya, dan tahun depan pengusulnya
  harus mulai dari nol.
- **Skor musyawarah didahulukan atas jumlah penerima manfaat, dan keduanya
  mendahului biaya.** Mengurutkan menurut biaya lebih dahulu akan membuat jalan
  setapak selalu mengalahkan jembatan, dan desa tidak pernah membangun apa pun
  yang besar.
- **Kuorum sebagai data, bukan angka tetap.** Ketentuannya berbeda antar daerah;
  menebaknya dari pusat akan salah di sebagian tempat.
- **Eskalasi dihitung dari terakhir ada tindakan**, bukan dari tanggal masuk.
- **Siapa yang menetapkan hasil Musrenbang tercatat.** Inilah saat usulan
  menjadi mengikat dan pagu terbagi; pertanyaan "atas dasar apa usulan saya
  ditunda" akan ditanyakan, dan jawabannya menuntut nama.

### Bukti

`docs/info-desa/bukti-d5-partisipasi.txt` — **28 pemeriksaan**, seluruhnya lulus.

### Gerbang mutu

- `jest` — **1256 tes lulus** (bertambah 40)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi: 46 tabel village terbentuk

---

## D-6 — Perencanaan, APBDes, dan adapter keuangan

### Ditambahkan

- **`village-budget.ts`** — aturan sebagai fungsi murni: transisi anggaran,
  penegakan pagu, keseimbangan APBDes, dua belas kode peristiwa akuntansi
  `VILLAGE_*`, dan periode perencanaan. **42 pengujian.**
- **Migrasi `20260731000008`** — sembilan tabel: `village_rpjm`, `village_rkp`,
  `village_activity`, `village_budget`, `village_budget_line`,
  `village_budget_transaction`, `village_cash_book`, `village_advance`,
  `village_activity_plan`.
- **`VillageBudgetService`** dan **delapan endpoint**.

### Penegakan pagu ada di basis data

Pada APBDes, belanja melampaui pagu adalah **pelanggaran** — bukan keputusan
yang boleh diambil dengan menekan "lanjutkan". Karena itu dua aturan ditegakkan
constraint:

```
committed_amount <= ceiling_amount
realized_amount  <= committed_amount
```

Perhitungan sisa pagu yang dilakukan layanan akan salah begitu dua SPP diproses
bersamaan: keduanya membaca sisa yang sama, keduanya menyimpulkan cukup, dan
keduanya lolos. **Dibuktikan pada dua koneksi sungguhan** — ikatan kedua yang
melampaui pagu ditolak meski berjalan bersamaan.

Layanan tetap memeriksa lebih dahulu, dan itu disengaja: pesannya menyebutkan
pagu, yang sudah diikat, dan sisanya. Petugas yang tahu angkanya dapat
menyesuaikan nilainya; yang hanya diberi tahu "melampaui pagu" akan menebak.

### Ikat dahulu, baru bayar

Pagu terpakai sejak belanja **diikat** (SPP disetujui, kontrak ditandatangani),
bukan sejak uang keluar. Desa yang hanya melihat realisasi akan mengira paguya
masih tersedia padahal sudah habis diikat kontrak — lalu mengikat kontrak kedua
yang tidak ada uangnya.

Turunannya: **realisasi dibatasi ikatan, bukan pagu.** Realisasi Rp 90 juta pada
pagu Rp 100 juta dengan ikatan Rp 70 juta tetap ditolak. Uang yang keluar tanpa
ikatan adalah pengeluaran tanpa dasar — temuan pemeriksaan, bukan sekadar
kelalaian pencatatan.

### APBDes bukan pembukuan komersial

Yang dipakai dari Core adalah **mesin peristiwa akuntansinya**, bukan bagan akun
komersialnya. Village menyediakan strukturnya sendiri:
Pendapatan – Belanja – Pembiayaan, dengan pagu per kegiatan sebagai satuan
kendali.

Keseimbangan diperiksa saat penetapan: surplus/defisit ditambah pembiayaan neto
harus nol. APBDes yang tidak seimbang tidak dapat ditetapkan — bukan karena
aturan sistem, melainkan karena begitulah anggaran disusun.

Dua belas kode peristiwa `VILLAGE_*` mengikuti pola Core: setiap kode wajib
punya daftar nilai wajibnya, dan pengujian menjaganya. `VILLAGE_ADVANCE_SETTLED`
menuntut **dua** angka — yang dipakai dan yang dikembalikan — sebab menyimpan
salah satunya saja membuat sisa panjar harus dihitung ulang, dan perhitungan
ulang selalu ada yang lupa.

### Keputusan lain

- **APBDes yang ditetapkan wajib menyebut peraturan desanya.** Anggaran tanpa
  dasar hukum bukan anggaran yang dapat dipertanggungjawabkan.
- **Pagu yang sudah ditetapkan hanya berubah lewat APBDes Perubahan**, yang
  memerlukan persetujuan BPD dan peraturan desa tersendiri. Membiarkannya
  disunting langsung berarti anggaran yang disahkan bukan anggaran yang
  dijalankan.
- **Pagu tidak dapat diturunkan di bawah ikatan yang berjalan.** Kontrak yang
  sudah ditandatangani tidak boleh kehilangan anggarannya.
- **Satu usulan Musrenbang menjadi paling banyak satu kegiatan.** Dua kegiatan
  yang menunjuk usulan yang sama berarti warga diberi tahu usulannya dikerjakan
  dua kali. Tautannya eksplisit — pertanyaan "usulan saya jadi apa" dapat dijawab
  tanpa menebak.
- **RKP wajib berada di dalam periode RPJM induknya.** Rencana tahunan tanpa
  rencana jangka menengah adalah rencana yang tidak dapat dipertanggungjawabkan
  arahnya.
- **Kelurahan memperoleh `village_activity_plan` yang jauh lebih sederhana** —
  ia menerima pagu dari daerah, tidak menyusun anggaran sendiri.
- **Pembatalan transaksi wajib beralasan.** Transaksi anggaran yang dibatalkan
  tanpa keterangan adalah lubang pada pertanggungjawaban.

### Bukti

`docs/info-desa/bukti-d6-apbdes.txt` — **20 pemeriksaan**, seluruhnya lulus,
termasuk dua ikatan bersamaan pada dua koneksi basis data sungguhan.

### Gerbang mutu

- `jest` — **1298 tes lulus** (bertambah 42)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi: 55 tabel village terbentuk

---

## D-7 — Aset, pengadaan, dan bantuan

### Ditambahkan

- **`village-asset.ts`** — aturan aset sebagai fungsi murni: penggolongan KIB,
  transisi status, peminjaman, penghapusan, metode pengadaan. **27 pengujian.**
- **`village-aid.ts`** — pohon kriteria kelayakan beserta penafsirnya, batas
  kecerdasan buatan, deteksi bantuan berganda, aturan penyaluran.
  **43 pengujian.**
- **Migrasi `20260731000009`** — dua belas tabel: `village_asset_category`,
  `village_asset`, `village_asset_borrowing`, `village_asset_maintenance`,
  `village_asset_disposal`, `village_procurement_plan`,
  `village_household_survey`, `village_aid_program`, `village_aid_criteria`,
  `village_aid_candidate`, `village_aid_beneficiary`,
  `village_aid_distribution`.
- **`VillageAssetService`**, **`VillageAidService`**, dan **enam belas
  endpoint.**

### Kriteria kelayakan adalah pohon, bukan ekspresi

Kriteria bantuan berubah tiap program dan tiap tahun, sehingga menuliskannya di
dalam kode berarti menunggu programmer setiap kali bupati mengubah ambangnya.
Godaannya adalah menyimpan kriteria sebagai teks lalu mengevaluasinya — `eval`,
`new Function`, atau menempelkannya ke `WHERE`.

Ketiganya berarti hal yang sama: **siapa pun yang dapat menyunting kriteria
program bantuan dapat menjalankan kode di server.** Yang menyunting kriteria
adalah operator desa, dan pada satu dari sekian ribu desa ada operator yang akan
mencobanya.

Karena itu kriteria disimpan sebagai pohon kondisi terstruktur. Setiap daun
menunjuk satu ruas dari **daftar tertutup** dua puluh dua ruas, dengan satu
pembanding dari daftar tertutup lainnya. Nama ruas yang datang dari badan
permintaan tidak pernah menjadi nama kolom maupun penelusuran properti pada
objek sembarang — pencocokannya memakai `hasOwnProperty`, sehingga
`constructor`, `__proto__`, dan `toString` ditolak seperti nama asing lainnya.

Bentuknya diperiksa **sebelum disimpan**, dengan batas kedalaman enam dan batas
delapan puluh simpul. Pohon yang datang dari badan permintaan adalah masukan yang
tidak tepercaya, dan rekursi tanpa batas atasnya adalah cara paling mudah
menjatuhkan proses. Kedalaman juga punya alasan yang bukan teknis: kriteria yang
tidak dapat dibaca manusia tidak dapat digugat warga.

### Kecerdasan buatan hanya mengusulkan — dan itu bukan sekadar niat

Penyaringan otomatis berhenti pada `village_aid_candidate`. Yang membuatnya
penegakan, bukan kesepakatan, adalah satu kolom:

```
decided_session_id UUID NOT NULL
```

Pemanggilan otomatis dari dalam sistem tidak memiliki sesi. Jalan kode yang
kelak mencoba menetapkan penerima tanpa manusia yang masuk tidak akan gagal pada
tinjauan kode — ia gagal pada `NOT NULL`.

Di sampingnya, `decision_basis` menuntut sekurang-kurangnya lima belas huruf.
Warga yang tidak menerima bantuan berhak mendapat jawaban dari seseorang, dan
"begitu hasil sistemnya" bukan jawaban yang dapat dipertanggungjawabkan siapa
pun.

Setiap calon menyimpan **jejak penilaiannya**: ruas mana yang lulus, mana yang
tidak, dan berapa nilainya. Penilaian `SEMUA` tidak berhenti pada kegagalan
pertama — warga yang memperbaiki satu sebab lalu ditolak lagi karena sebab kedua
akan merasa dipermainkan.

### Satu warga tidak menerima bantuan sejenis dari dua jalur

Ditegakkan indeks unik parsial atas (warga, jenis bantuan, tahun anggaran).
Dua petugas yang menetapkan warga yang sama pada dua program berbeda secara
bersamaan akan sama-sama lolos pemeriksaan layanan: keduanya membaca daftar
penerima yang sama, keduanya tidak menemukan bentrok. **Dibuktikan pada dua
koneksi sungguhan** — penetapan kedua tertahan menunggu yang pertama, lalu
ditolak.

Ini **menolak**, bukan menandai, dan itu berbeda dengan NIK kembar pada D-2.
Perbedaannya bukan kebetulan: NIK kembar bisa berarti salah ketik, dan sistem
yang menolak menyimpannya justru memaksa petugas memalsukan data agar dapat
melanjutkan. Bantuan ganda bukan keraguan pencatatan — ia pembayaran kedua.

Bertumpuk tetap mungkin lewat `allow_stacking`, tetapi harus dinyatakan pada
**rancangan program**, bukan diputuskan diam-diam per warga.

Indeksnya memakai tahun anggaran, bukan rentang tanggal. Rentang menuntut
`btree_gist`, dan migrasi ini dijalankan setiap kali sebuah desa mendaftar: satu
desa gagal disiapkan karena ekstensi tidak terpasang jauh lebih buruk daripada
penegakan yang sedikit lebih kasar. Rentang yang sesungguhnya tetap diperiksa
layanan, yang pesannya menyebut nama program yang bentrok.

### Aset desa tidak disusutkan

Penyusutan membebankan harga perolehan kepada periode yang menikmati
manfaatnya, supaya laba tiap periode terukur. Balai desa tidak menghasilkan
pendapatan yang perlu dilawankan dengan beban apa pun, sehingga angka nilai buku
balai desa tidak menjawab pertanyaan siapa pun.

Yang ditanyakan pada Musyawarah Desa adalah pertanyaan lain: **mana yang rusak
dan perlu diperbaiki tahun ini.** Karena itu yang dicatat `condition`, bukan
nilai buku. Traktor berumur sepuluh tahun yang terawat lebih berguna daripada
traktor berumur dua tahun yang rusak berat, dan penyusutan garis lurus
menyatakan sebaliknya.

Penggolongannya mengikuti KIB A–F yang sudah dipakai pemerintahan, bukan
penggolongan baru yang lebih rapi — petugas menyalin dari daftar ini ketika
melapor ke kecamatan.

### Aset tidak berhenti ada diam-diam

- **Penghapusan wajib berdasar keputusan bernomor**, dengan alasan yang
  diuraikan. Aset yang lenyap dari register tanpa dasar keputusan bukanlah aset
  yang dihapus melainkan aset yang **hilang**.
- **Aset yang sedang dipinjam tidak dapat dihapus.** Barangnya masih di tangan
  orang lain, dan menghapusnya berarti melepaskan tanggung jawab atas barang
  yang keberadaannya justru sedang diketahui.
- **Penghapusan dengan cara dijual wajib menyebut nilainya.** Hasil penjualan
  aset desa adalah pendapatan desa.
- **Pengusul bukan penyetuju.**
- **Aset yang sudah dihapus tidak kembali.** Bila barangnya ditemukan, ia
  dicatat sebagai perolehan baru — sehingga jejak penghapusan yang keliru tetap
  terbaca.

### Keputusan lain

- **Satu aset hanya dapat sedang dipinjam oleh satu orang**, ditegakkan indeks.
  Bukan aturan administrasi melainkan kenyataan: proyektornya hanya satu.
- **Tanggal rencana kembali wajib.** Peminjaman tanpa batas waktu bukan
  peminjaman melainkan pemberian.
- **Kondisi aset mengikuti kondisi saat dikembalikan.** Aset yang kembali rusak
  dan tetap tercatat baik akan dipinjamkan lagi kepada orang berikutnya, yang
  lalu dianggap merusaknya.
- **Rencana pengadaan wajib menunjuk baris anggarannya.** Pengadaan tanpa pagu
  akan ketahuan saat pembayarannya ditolak, ketika barangnya sudah telanjur
  dipesan.
- **`village_household_survey` menyimpan tanggal kunjungannya**, dan umur data
  disajikan bersama hasil penyaringan. Penetapan bantuan atas data pendataan
  tiga tahun lalu adalah penetapan atas desa yang sudah tidak ada.
- **Yang sudah diketahui sistem tidak ditanyakan ulang.** Usia, jenis kelamin
  kepala keluarga, RT/RW/dusun, dan kedisabilitasan diturunkan; yang ditanyakan
  hanya yang diperoleh dengan mendatangi rumahnya.
- **Satu termin disalurkan satu kali.** Penyaluran ganda pada termin yang sama
  adalah pembayaran kedua, bukan pencatatan kedua.
- **Kriteria lama dinonaktifkan, tidak dihapus.** Pertanyaan "kriteria mana yang
  berlaku saat penetapan tahun lalu" akan muncul.
- **Kelurahan tidak dapat mencatat aset bertanda `DESA`** — ia perangkat daerah
  dan tidak memiliki kekayaan sendiri.

### Bukti

`docs/info-desa/bukti-d7-aset-bantuan.txt` — **38 pemeriksaan**, seluruhnya
lulus, termasuk dua penetapan bersamaan pada dua koneksi basis data sungguhan.

### Yang belum dikerjakan

**Antarmuka web belum ada — dan bukan hanya pada tahap ini.** `apps/web` belum
memuat satu berkas pun untuk vertikal ini sejak D-1; seluruh D-1 sampai D-7 baru
berupa API, migrasi, aturan, dan pengujian. Daftar tahap pada §5 menyebut UI
sebagai bagian tiap tahap, sehingga utangnya menumpuk tujuh tahap dan patut
diputuskan tersendiri: dikejar sekaligus, atau digabungkan ke D-10 yang memang
membangun situs dan portal warga.

### Gerbang mutu

- `jest` — **1368 tes lulus** (bertambah 70)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi: 67 tabel village terbentuk

---

## D-8 — BUMDes, UMKM, wisata, dan kontrak integrasi

### Ditambahkan

- **`ports/external.ports.ts`** — empat kontrak konsumen: `HealthAggregatePort`,
  `CooperativeIntegrationPort`, `PosIntegrationPort`, `MarketplaceLinkPort`.
- **`ports/unavailable.adapter.ts`** — adapter tiruan yang jujur.
  **16 pengujian.**
- **`village-business.ts`** — aturan BUMDes, UMKM, dan wisata sebagai fungsi
  murni. **40 pengujian.**
- **Migrasi `20260731000010`** — delapan tabel: `village_bumdes`,
  `village_bumdes_unit`, `village_bumdes_capital`, `village_bumdes_result`,
  `village_umkm`, `village_umkm_product`, `village_tourism_site`,
  `village_cooperative_presence`.
- **`VillageBusinessService`** dan **empat belas endpoint.**
- **`docs/integration-requests/village/004-external-contracts.md`**

### Kerugian BUMDes tidak menjadi beban APBDes

BUMDes adalah badan hukum tersendiri. Desa menyertakan modal; ia tidak "punya
kas BUMDes". Yang membedakan bukan istilah melainkan akibatnya — dan akibat yang
paling mudah hilang adalah yang ini:

```
CHECK (village_share_amount >= 0)
CHECK (net_result > 0 OR village_share_amount = 0)
```

Begitu kerugian dapat mengalir kembali sebagai angka negatif pada bagian desa,
pemisahan badan hukumnya sudah runtuh — bukan lewat keputusan, melainkan lewat
satu baris pembukuan, tanpa seorang pun memutuskannya. Kerugian tetap dicatat
apa adanya pada `net_result` yang boleh negatif; menyembunyikannya tidak membuat
uangnya kembali. Yang tidak boleh negatif adalah yang **mengalir ke desa**.

Sisi lainnya: `GET /village/bumdes/:id/capital` menyebutkan jumlah penyertaan
modal beserta kalimat bahwa itulah seluruh paparan desa. Angka yang harus
disimpulkan sendiri adalah angka yang disimpulkan keliru.

### Bagi hasil dicuplik, bukan dirujuk

`village_share_pct` disalin ke tiap laporan hasil usaha saat laporan itu
ditetapkan. **Dibuktikan:** persentase pada BUMDes diubah dari 30 menjadi 60,
dan laporan tahun 2027 tetap menyebut 30. Laporan yang hanya merujuk anggaran
dasar akan berubah artinya ketika anggaran dasarnya diubah, dan laporan tahun
lalu yang berubah artinya bukan laporan.

Bagian desa tidak boleh 100 persen. BUMDes yang seluruh labanya disetor tidak
menyisakan apa pun untuk pemupukan modal, cadangan, dan jasa pengurus — ia tidak
akan tumbuh, dan tahun berikutnya desa menyertakan modal lagi untuk hal yang
sama.

### Penyertaan modal menunjuk uangnya

Wajib menunjuk `village_budget_transaction` yang **sudah direalisasi** dengan
nilai yang sama, dan menyebut peraturan desanya. Modal yang tercatat pada BUMDes
tanpa padanan pada APBDes berarti salah satu dari dua hal — uangnya belum
keluar, atau uangnya keluar tanpa dicatat — dan keduanya perlu ketahuan
sekarang, bukan saat pemeriksaan.

Satu transaksi menjadi satu penyertaan, ditegakkan indeks unik. Uang yang keluar
sekali tidak dapat dicatat dua kali sebagai modal.

### Larangan ditegakkan dengan tidak menyediakan metodenya

Keempat port tidak memiliki metode untuk rekam medis, diagnosis, riwayat
kunjungan, saldo simpanan, riwayat pinjaman, tunggakan, membuat listing,
menjual, membuka shift, maupun menyesuaikan stok. Antarmuka yang tidak punya
metode tidak dapat dipanggil, dan itu jauh lebih kuat daripada metode yang ada
tetapi diberi pemeriksaan izin — pemeriksaan izin dapat dilonggarkan oleh orang
yang sedang terburu-buru, metode yang tidak ada tidak dapat.

Dijaga pengujian dari dua arah: daftar metode tiap port harus **sama persis**
dengan daftar sahnya, dan tidak satu pun boleh muncul pada daftar terlarang.
Aturan yang hanya tertulis pada dokumen akan dilanggar suatu hari oleh orang
yang belum pernah membacanya; daftar yang diuji menggagalkan berkasnya pada hari
yang sama.

`village_cooperative_presence` diperiksa dari sisi basis datanya: bukti D-8
memindai nama kolomnya dan menolak yang menyerupai simpanan, pinjaman, atau
tunggakan. Desa tidak berkepentingan mengetahuinya, dan kepentingan yang tidak
ada tidak boleh diberi jalan.

### "Kosong" dan "belum tersambung" tidak pernah disamakan

eMedik dan eKoperasi belum dibuat; POS belum masuk `main`. Adapter tiruan
menyatakan keadaan itu apa adanya dan **tidak mengembalikan satu pun angka
karangan**.

Godaannya besar: mengisi jadwal Posyandu dengan tiga baris contoh membuat
halaman tampak selesai, demo berjalan mulus, dan tidak seorang pun bertanya.
Lalu vertikal kesehatannya jadi, datanya berbeda, dan yang berubah bukan hanya
angkanya — kepercayaan pada seluruh halaman itu ikut hilang.

Karena itu setiap metode mengembalikan `HasilLuar<T>` — `{ tersedia,
keterangan?, data }` — dan layanan meneruskannya apa adanya. Halaman yang
menampilkan "0 koperasi di desa ini" padahal eKoperasi belum tersambung
menyampaikan kebohongan yang akan diulang pemerintah desa kepada warganya.

Satu turunannya patut disebut: `apakahAnggota` yang tidak tersedia **tidak boleh
dibaca sebagai "bukan anggota"**. Pemeriksaan bantuan ganda yang mengabaikan
`tersedia` akan meloloskan penerima ganda persis ketika sistemnya sedang tidak
dapat memeriksa.

### Rujukan lintas vertikal tanpa foreign key

`pos_outlet_id`, `marketplace_listing_id`, dan `external_cooperative_id`
menunjuk entitas milik sistem lain dan sengaja tidak berelasi. Foreign key yang
melintasi batas vertikal membuat migrasi satu vertikal dapat mematahkan vertikal
lain — persis yang dilarang §3. Keabsahannya diperiksa lewat port. **Dibuktikan
dengan memindai `pg_constraint`:** nol foreign key pada ketiga kolom itu.

Yang tetap ditegakkan: satu outlet POS untuk satu unit usaha (dua unit yang
menunjuk outlet yang sama akan melaporkan penjualan yang sama dua kali), satu
listing untuk satu produk, dan tautan yang tercatat wajib menyebut kapan serta
oleh siapa.

### Desa menautkan produk, tidak mendaftarkannya

Tidak ada metode untuk membuat listing. Produk yang didaftarkan pemerintah desa
atas nama warga menimbulkan pertanyaan siapa yang bertanggung jawab bila
produknya bermasalah — dan pertanyaan itu muncul justru ketika keadaannya sedang
buruk.

`periksaListing` menggabungkan keberadaan dan kepemilikan menjadi satu jawaban.
Metode terpisah yang mengembalikan listing lalu membiarkan pemanggil
membandingkan pemiliknya akan dilewati oleh pemanggil yang lupa
membandingkannya.

Skala UMKM **dihitung dari omzet, bukan diketik.** Skala yang diisi sendiri
pelaku usaha akan mengikuti syarat bantuan yang sedang dibuka, bukan mengikuti
usahanya.

### Penayangan adalah janji kepada orang yang belum pernah datang

Destinasi wisata yang ditayangkan wajib menyebut pengelola, kontaknya,
sekurang-kurangnya satu foto, dan tarifnya — termasuk bila gratis. Ditegakkan
constraint, bukan pemeriksaan layanan, sehingga jalan tulis mana pun tertahan.

- Destinasi tanpa pengelola mengirim pengunjung ke tempat yang tidak ada
  penanggung jawabnya.
- Destinasi yang ditayangkan tanpa tarif adalah destinasi yang tarifnya
  ditentukan di pintu masuk, berbeda-beda menurut penampilan yang datang.
- Gratis dan bertarif tidak dapat keduanya. Nol berbeda dari belum diisi.

### Bukti

`docs/info-desa/bukti-d8-usaha-desa.txt` — **34 pemeriksaan**, seluruhnya lulus.

### Yang belum dikerjakan

**Antarmuka web masih belum ada**, kini delapan tahap. Dicatat kembali di sini
supaya tidak menjadi kelalaian yang disepakati diam-diam.

Keempat kontrak menunggu jawaban pihak lain — lihat integration request 004.
Sampai dijawab, adapter tiruan berlaku dan tidak satu pun data karangan
tersimpan.

### Gerbang mutu

- `jest` — **1424 tes lulus** (bertambah 56)
- `tsc --noEmit` dan `eslint --max-warnings=0` — bersih
- Migrasi diverifikasi: 75 tabel village terbentuk
