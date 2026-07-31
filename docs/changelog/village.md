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
