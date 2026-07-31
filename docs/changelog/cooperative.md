# Changelog — Vertikal Koperasi (eKoperasi)

Changelog modular sesuai panduan koordinasi §11. Sesi Core/Integrator yang
menggabungkan entri terpilih ke `CHANGELOG.md` induk.

---

## K-1 — Profil koperasi, legalitas, dan kebijakan

**Cabang:** `feature/v12-ekoperasi`

### Ditambahkan

- **Migrasi modul** `20260731T160000__cooperative__profile_and_legality.sql`:
  delapan tabel — `cooperative_type`, `cooperative`,
  `cooperative_legal_document`, `cooperative_address`,
  `cooperative_service_area`, `cooperative_policy`, `cooperative_domain`,
  `cooperative_account_mapping`.
- **`cooperative-profile.ts`** — aturan sebagai fungsi murni: transisi status,
  daftar periksa kesiapan go-live, penyusunan dan pemeriksaan slug, masa
  berlaku berversi, dan kesesuaian jenis koperasi. **39 pengujian.**
- **`cooperative-profile.service.ts`** dan **`cooperative.module.ts`** —
  14 endpoint di bawah `/cooperative/*`.
- **`ports/index.ts`** — delapan port yang didefinisikan koperasi sendiri.
- **`scripts/apply-cooperative-migrations.mjs`** — penerap migrasi modul
  sementara, idempoten, mencatat pada tabel modulnya sendiri.
- **`scripts/prove-cooperative-k1.mjs`** dan buktinya di
  `docs/ekoperasi/bukti-k1-profil.txt` — **22 pemeriksaan, seluruhnya lulus.**

### Keputusan yang perlu dicatat

- **Satu ruang kerja hanya untuk satu koperasi**, ditegakkan indeks unik
  parsial. Dua koperasi pada satu tenant berarti dua bagan akun, dua RAT, dan
  dua SHU yang harus dipisahkan pada setiap kueri.
- **Koperasi berstatus ACTIVE wajib punya nomor badan hukum**, ditegakkan
  constraint. Itulah pembeda antara koperasi sah dan perkumpulan biasa, dan
  koperasi tidak sah tidak boleh menghimpun simpanan anggota.
- **Kebijakan aktif wajib menyebutkan persetujuannya.** Kebijakan yang berlaku
  tanpa persetujuan adalah kebijakan yang dibuat seseorang sendirian atas hak
  seluruh anggota.
- **AD/ART, aturan keanggotaan, dan kebijakan SHU sah hanya setelah diputuskan
  Rapat Anggota.** Ditegakkan layanan; tautan keputusannya diisi pada K-5.
- **Kebijakan baru selalu membentuk versi baru**, tidak pernah menyunting versi
  lama. SHU dihitung menurut kebijakan yang berlaku pada periode bukunya;
  kebijakan yang disunting di tempat membuat perhitungan tahun lalu tidak dapat
  diulang.
- **Kekurangan go-live dilaporkan seluruhnya sekaligus.** Pemilik koperasi yang
  diberi tahu satu kekurangan lalu satu lagi setelah memperbaikinya akan
  melalui banyak putaran untuk hal yang muat dalam satu layar.
- **Pembubaran bersifat akhir.** Menghidupkan kembali koperasi yang bubar
  berarti mendirikan koperasi baru dengan badan hukum baru, bukan mengubah
  status baris yang sama.

### Temuan baru untuk IR-001

`schema_migration.version` bertipe **`VARCHAR(16)`**, sedangkan id migrasi
modular yang diminta panduan §7 panjangnya 49 aksara. Kolom itu secara
struktural tidak dapat menampungnya — katalog modular tidak dapat berjalan
tanpa pelebaran kolom ini. Ditambahkan ke IR-001 sebagai bagian wajib dari
perubahan Core, beserta galat sungguhannya sebagai bukti.

### Berkas bersama yang disentuh

Satu: `apps/api/src/app.module.ts` — satu baris impor dan satu entri pada
`imports`. Sengaja sekecil mungkin, sebab berkas itu disentuh empat sesi
paralel. Tidak ada berkas bersama lain, tidak ada dependensi baru, lockfile
tidak berubah.

### Gerbang mutu

| | |
|---|---|
| `tsc --noEmit` (API dan web) | bersih |
| `eslint --max-warnings=0` | bersih |
| `jest` | 46 suite, **1087 tes lulus** (bertambah 39) |
| Bukti K-1 | **22 pemeriksaan lulus** |

### Belum dikerjakan pada K-1

- **Antarmuka `/ekoperasi/*`** ditunda ke K-9 bersama portal anggota, supaya
  seluruh layar koperasi dirancang sekaligus alih-alih sepotong per fase.
- **Langganan Rp 500.000/bulan** memerlukan paket pada control plane; menunggu
  keputusan sesi Core apakah paket vertikal masuk katalog paket yang sama.
- **Menu dan hak akses koperasi** belum disemai — menunggu IR-004. Endpoint
  sudah ada dan berpenjaga, tetapi penyewa sungguhan belum dapat memanggilnya.
  Itu keadaan yang benar, bukan yang perlu diakali.

## K-0 — Audit dan batas konteks

**Cabang:** `feature/v12-ekoperasi` · **Titik tolak:** `origin/main` @ `4f7ab88`

### Ditambahkan

- Sembilan dokumen audit di `docs/ekoperasi/`: keadaan saat ini, peta domain,
  matriks pakai-ulang, kontrak integrasi POS, kontrak akuntansi, keamanan dan
  pemisahan wewenang, rencana implementasi, garis dasar pengujian, dan daftar
  permintaan integrasi.
- Empat permintaan integrasi di `docs/integration-requests/cooperative/`.

### Temuan

- **Tidak ada satu pun kode koperasi di dalam repositori.** Kata "koperasi"
  hanya muncul pada naskah pemasaran. Delapan agregat koperasi seluruhnya
  dibangun baru, sekitar 80 tabel.
- **Katalog migrasi masih tunggal dan bernomor urut.** Tiga vertikal yang
  sama-sama menambahkan ke `manifest.json` bukan sekadar akan berkonflik saat
  penggabungan — dua migrasi berbeda dapat memakai nomor sama, dan penyewa yang
  sudah menerapkan salah satunya akan **melewati** yang lain tanpa satu pun galat
  muncul. → IR-001.
- **Sembilan port bersama yang disebut perintah belum ada.** Tidak menghalangi:
  port yang baik didefinisikan pemakainya. Koperasi mendefinisikan sendiri di
  `modules/cooperative/ports/`.
- **`modules/health/` sudah terpakai** oleh pemeriksaan kesehatan platform,
  padahal panduan memberikannya kepada sesi eMedik. Disampaikan sebagai temuan
  untuk sesi lain.

### Keputusan yang perlu dicatat

- **`investor_profile` dan `ownership_interest` TIDAK dipakai untuk
  keanggotaan.** Keduanya memodelkan penyertaan modal perseroan, dengan suara
  mengikuti kepemilikan. Koperasi bekerja terbalik — satu anggota satu suara,
  berapa pun simpanannya. Memakainya akan menanamkan pembobotan suara
  berdasarkan modal ke dalam fondasinya.
- **Simpanan pokok dan wajib diperlakukan sebagai ekuitas, bukan kewajiban.**
  Keduanya tidak dapat ditarik selama keanggotaan berjalan. Menyamakannya dengan
  simpanan sukarela akan membuat neraca menyatakan modal sendiri jauh lebih
  kecil daripada yang sebenarnya, dan rasio kesehatan yang dihitung di atasnya
  ikut salah.
- **Akad syariah memakai kode peristiwa akuntansi tersendiri**, bukan kode
  pinjaman dengan nama berbeda. Memakai `COOPERATIVE_LOAN_DISBURSED` untuk
  murabahah akan menyajikan jual-beli sebagai pinjaman berbunga.
- **Angsuran wajib memisahkan pokok dan jasa.** Keduanya masuk akun berbeda, dan
  membelah totalnya kemudian berarti menebak berapa pendapatan koperasi.
- **Unit usaha tidak memiliki POS sendiri.** Ia tertaut ke `outlet` dan
  `pos_terminal` Core lewat satu tabel penghubung. POS kedua akan membelah
  persediaan dan pembukuan menjadi dua kebenaran.
- **Patronage dibaca berkala, bukan ditulis saat transaksi.** Ia dihitung atas
  periode buku yang sudah ditutup; menuliskannya saat transaksi berarti angkanya
  ikut berubah setiap ada retur — sesudah SHU dihitung.
- **PIN anggota tidak pernah sampai ke kasir maupun ke POS.** Layar PIN milik
  koperasi; yang diserahkan ke POS hanya token sekali pakai berumur 60 detik.

### Garis dasar

| | |
|---|---|
| `pnpm install --frozen-lockfile` | berhasil — lockfile tidak berubah |
| `tsc --noEmit` (API) | bersih |
| `jest` (API) | 45 suite, **1048 tes lulus** |
| Cakupan pengujian koperasi | **nol** — sasaran K-11: sekitar 1325 |

### Belum dikerjakan

Tidak ada kode koperasi yang ditulis pada K-0. Audit ini sengaja berhenti pada
dokumen, sebab tiga dari empat permintaan integrasi menentukan bentuk kode yang
akan ditulis sesudahnya — dan menulis kode lebih dahulu lalu menyesuaikannya
berarti mengerjakan hal yang sama dua kali.
