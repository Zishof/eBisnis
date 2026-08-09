# Ringkasan Sesi — 9-10 Agustus 2026

Dokumen ini merangkum semua pekerjaan pada sesi kerja panjang ini di repo
`eBisnis` (POS/Inventory), agar pekerjaan bisa dilanjutkan dari komputer lain
tanpa kehilangan konteks. Instruksi baku sesi ini: **kerjakan sampai tuntas
tanpa perlu menunggu konfirmasi**, dan **deploy/`install.sh`/`update.sh` di
server produksi tetap tanggung jawab pemilik repo sendiri** — tidak ada aksi
SSH/server produksi yang dilakukan pada sesi ini.

Commit SHA yang disebut di bawah semuanya sudah **di-push ke `origin/main`**.
Untuk rincian per-baris, `git log --oneline` adalah sumber kebenaran paling
detail; dokumen ini adalah ringkasan naratif, bukan pengganti log commit.

---

## 1. CI/CD dan infrastruktur rilis Flutter

- **Golden image test yang rapuh lintas-OS**: golden dibuat di Windows tidak
  cocok dengan render `ubuntu-latest` di CI. Dibuat workflow sekali-pakai
  `.github/workflows/perbarui-golden-pos.yml` (trigger hanya di branch
  `golden-refresh/**`) yang menjalankan `flutter test --update-goldens` di
  `ubuntu-latest` lalu commit+push PNG hasilnya — dipakai berulang kali tiap
  ada perubahan UI yang mematahkan golden.
- **Build Windows/Android POS Desktop tercampur antar produk** (bug nyata,
  dikonfirmasi live oleh pemilik repo: exe "Inventory" hasil build masih
  berisi konten "Salon Cantik Demo"): `flutter clean` di antara build produk
  yang berurutan TERBUKTI TIDAK CUKUP. Diperbaiki tuntas dengan mengubah job
  `windows`/`android` di `.github/workflows/rilis-pos.yml` menjadi **matrix
  build** — satu runner VM terpisah per produk (default/apotik/inventory),
  menghilangkan shared state sepenuhnya. Dikonfirmasi lewat ukuran file exe
  yang jadi berbeda per produk (sebelumnya identik 11.0MB untuk ketiganya).
- **`deploy/update.sh`** — beberapa bug produksi nyata ditemukan dan
  diperbaiki:
  - `wait: pid ... is not a child of this shell` — script melakukan
    self-re-exec (`exec bash update.sh`) setelah `git pull`; proses backup
    yang di-background SEBELUM re-exec tidak lagi dikenali `wait` di proses
    SETELAH re-exec (job table bash per-instance, bukan per relasi
    kernel-PID). Diperbaiki dengan memindahkan seluruh siklus backup
    (start+wait) ke SETELAH titik re-exec.
  - **Sinkronisasi exe/apk terlewat pada fast-path "tidak ada yang
    dikerjakan"**: logika sync ke GitHub Release awalnya inline di step
    "10/10 Apache", tapi `update.sh` `exit 0` lebih awal saat commit `main`
    tidak berubah — padahal rilis exe/apk di-tag terpisah (`pos-v*`,
    `inventory-v*`), sehingga server bisa menyajikan binary basi
    selama-lamanya walau GitHub Release baru sudah terbit. Diperbaiki dengan
    mengekstrak jadi fungsi `sinkronkan_unduhan_pos()` yang dipanggil
    TANPA SYARAT sebelum pengecekan early-exit.
  - Tag `pos-v*` yang pernah dihapus/dibuat ulang saat debugging membuat
    fetch tag gagal di server (`--force` ditambahkan ke `git fetch --tags`).
  - Beberapa langkah dibuat berjalan di background dengan aman (backup DB,
    3 skrip onboarding demo/pelanggan contoh) karena terbukti independen dari
    langkah-langkah setelahnya; migrasi database TETAP sekuensial murni
    (tidak aman untuk paralel).
- **`rilis-pos.yml` — bug parsing `$GITHUB_OUTPUT`**: `ls` menghasilkan output
  satu-per-baris yang merusak format `key=value` satu baris saat ada lebih
  dari satu file exe cocok. Diperbaiki dengan glob langsung ke array bash,
  bukan mem-parsing output `ls`.
- **Android APK signing**: MASIH terblokir oleh GitHub Secrets yang tidak
  lengkap (`ANDROID_STORE_PASSWORD`/`ANDROID_KEY_PASSWORD`/
  `ANDROID_KEY_ALIAS`) — **tidak diperbaiki di sesi ini** karena butuh akses
  ke secrets yang hanya pemilik repo yang punya. Windows publish sudah
  dipisah agar tidak ikut terblokir oleh ini (`terbitkan` job tidak lagi
  butuh KEDUA job `windows` dan `android` sukses).

## 2. Perbaikan UI/UX POS Inventory (Flutter)

- **Duplikasi judul "Sales Order"** pada layar Sales Order — dihapus salah
  satu (heading dobel dari widget wrapper + workspace-nya sendiri).
- **Pencarian customer/supplier yang tidak benar-benar mencari**:
  `DropdownButtonFormField` yang terlihat seperti search box tapi tidak
  memfilter apa pun, diganti `Autocomplete<TransactionParty>` yang benar-benar
  memfilter berdasarkan nama/kode/telepon. Komponen ini (`_PartySelector`)
  dipakai bersama oleh Sales Order ("Pilih Customer") DAN Purchase ("Pilih
  Supplier"), jadi satu perbaikan menyelesaikan dua keluhan sekaligus.
- **Dashboard untuk peran Sales**: sebelumnya login sebagai Sales menabrak
  error permission (dashboard eksekutif butuh `SALES_REPORT.VIEW_PROFIT` yang
  memang tidak dimiliki Sales). Diperbaiki dengan dashboard versi terbatas
  khusus Sales (`_MySalesDashboardPage`, endpoint baru
  `GET /inventory/my-sales-dashboard`) — KPI order/omzet milik sendiri,
  TANPA kolom cost/margin apa pun, memakai permission `SALES_ORDER.READ` yang
  memang sudah dimiliki Sales (bukan permission baru yang belum di-seed).
- **Menu "Pembelian ke Supplier" tidak ditemukan** di POS Desktop: bukan bug
  fungsional, tapi label sidebar "Operasional" menyembunyikan fakta bahwa
  Purchase-to-Supplier ada di dalamnya (segmen ke-4 dari 4). Diganti jadi
  "Pembelian & Piutang".

## 3. Fitur pembaruan otomatis (auto-update)

Infrastruktur `lib/pembaruan/*` (sudah ada untuk POS kasir) **dipakai ulang
apa adanya** untuk aplikasi Inventory (Desktop dan Android), bukan dibangun
ulang:
- Pengecekan otomatis saat start + tiap 6 jam, plus pemicu manual dari menu
  akun (khusus desktop).
- Sumber data: `https://ebisnis.id/update/inventory/latest` — proxy sisi
  server (`PosUpdateController`, sudah ada sebelumnya) yang meniru bentuk
  respons GitHub Release API, karena repo bersifat privat (URL GitHub
  Release mentah akan 404 untuk request tanpa autentikasi).

## 4. Halaman login demo yang tidak berfungsi

Pemilik repo melaporkan tombol "login demo" di `inventory.ebisnis.id` (host
marketing generik, BUKAN tenant pelanggan asli `cmnmedika-inventory...`)
tidak bisa dipakai. Dikonfirmasi lewat panggilan API langsung
(`POST /auth/login` → `401 INVALID_CREDENTIALS`): akun demo generik
(`sales.inventory`/dst.) memang TIDAK PERNAH punya seed backend — berbeda
dari vertikal pesantren yang punya `ensure-demo-pesantren.sh`. Diperbaiki
dengan **menghapus tombol/kartu demo yang tidak berfungsi** dari
`LoginPage.tsx` untuk host generik, BUKAN dengan mengekspos kredensial tenant
`cmnmedika` asli (pelanggan pembayar sungguhan) sebagai jalan pintas.

## 5. Empat gap keamanan/integritas data — semua DIPERBAIKI

Ditemukan lewat audit paralel sebelumnya di sesi ini, awalnya
didokumentasikan tanpa diperbaiki (dianggap terlalu berisiko/lintas-modul
untuk pass kecil), lalu **keempatnya diperbaiki, diverifikasi, dan di-push**
pada bagian akhir sesi ini:

### 5.1 Audit-trail membocorkan data bank (commit `a1a28db`)
`MasterLifecycleService.auditTrail()` mengembalikan `old_data`/`new_data`
JSONB mentah tanpa penyamaran — siapa pun ber-`AUDIT_READ` bisa membaca
nomor rekening penuh dari riwayat perubahan walau tidak punya
`VIEW_BANK_DETAILS` (padahal `list()`/`findById()` biasa sudah menyamarkan).
Diperbaiki dengan `maskAuditRows()` (menyamarkan field sensitif di dalam
snapshot JSONB, bukan di kolom baris), diuji unit penuh.

### 5.2 Purge salesperson tidak memeriksa referensi tidak langsung (`2b0e68e`)
`salespeople` terdaftar dengan `references: []` di registry generik, jadi
sistem SELALU melaporkan "tidak direferensikan" dan mengizinkan hapus
permanen — sudah terbukti menghapus satu salesperson uji yang punya riwayat
transaksi hidup pada sesi sebelumnya. Akar masalah: `sales_order.created_by`
dkk. menunjuk `user_subject.id`, BUKAN `inventory_salesperson_profile.id`,
jadi mekanisme reference-check langsung yang lama tidak bisa
mengekspresikannya. Diperbaiki dengan menambah `viaColumn` opsional pada
mekanisme referensi generik (`resolveReferenceMatchValue()`, diuji unit),
dipakai salesperson untuk mencocokkan lewat `user_subject_id`.

### 5.3 Reversal goods receipt tidak membalik hutang dagang (`fd1eef1`)
`reverseGoodsReceiptValidation()` membalik stok dengan benar tapi TIDAK
PERNAH menyentuh `legacy_payable_ledger` — hutang ke supplier untuk barang
yang sudah dibatalkan penerimaannya tetap "terbuka" selamanya ("hutang
hantu", terbukti menaikkan total AP aging di evidence sebelumnya). Diperbaiki:
- Diblokir **HTTP 409 `PAYABLE_ALREADY_PAID`** bila sudah ada pembayaran
  BERSTATUS POSTED yang teralokasi ke hutang tsb (uang sudah keluar, tidak
  aman dibatalkan otomatis — perlu koreksi manual).
- Bila belum ada pembayaran: payable disetel `is_settled=TRUE` + dicatat
  jejak audit di `metadata` (bukan dihapus/diubah nilainya, demi jejak
  audit).
- `accounting_event` terkait yang masih `PENDING` di-skip agar tidak
  terjurnal belakangan untuk nilai yang sudah dibalik.

### 5.4 `stock_balance.average_cost` tidak pernah ditulis (`fd1eef1`)
Bug POSTING FINANSIAL nyata, bukan sekadar kosmetik laporan: kolom ini
dibaca langsung sebagai HPP penjualan POS (dijurnal sebagai COGS) DAN untuk
valuasi stok (layar 14/15) — tapi tidak ada satu pun jalur transaksi live
yang pernah menulisnya (hanya seed demo dan CLI impor legacy sekali-jalan).
Diperbaiki dengan rumus moving-average-cost standar, ditambahkan sebagai
parameter opsional `inboundCost` pada `applyBalanceDelta()` (dipakai 13
titik panggil berbeda; HANYA aktif bila parameter ini diisi, jadi 12 titik
panggil lain tidak berubah perilakunya). Diwire HANYA ke titik goods-receipt
diterima — satu-satunya dari 13 titik yang sudah punya data biaya nyata
tanpa perlu plumbing baru. **Diverifikasi lewat skrip Node/`pg` mandiri di
skema Postgres sekali-pakai** (bukan skema tenant, demi tidak membebani dev
server yang sedang berjalan): 10 unit@100 lalu 5 unit@130 → rata-rata
110.0000, sesuai `(10*100+5*130)/15`.

**Masih gap, sengaja tidak dicakup** (didokumentasikan di
`docs/pos-inventory-parity/evidence/screen-08/uat.md` dan
`screen-20/uat.md`): biaya penerimaan transfer antar-gudang (data biaya
tidak ada sama sekali di jalur ini), un-blending rata-rata biaya saat
reversal goods receipt, retur/void POS terhadap rata-rata biaya, status
`purchase_order` yang tidak ikut turun setelah GR-nya dibatalkan, dan jurnal
pembalik otomatis untuk `accounting_event` yang SUDAH `POSTED` (jarang
terjadi karena aturan posting tidak disemai default per tenant).

**Verifikasi keempatnya**: `tsc --noEmit` bersih, ESLint bersih, dan suite
test API PENUH (186 suite / 4184 test) tetap hijau — dijalankan berulang
setelah setiap perbaikan, tanpa regresi sama sekali.

## 6. Insiden lingkungan (transparansi)

Saat memverifikasi test untuk perbaikan #1 di atas, ditemukan `node_modules`
proyek ini **rusak** (symlink pnpm silang-tertaut ke checkout proyek lain di
komputer yang sama, `eBisnisGithub-mitrainap`, plus beberapa paket
ter-link-sebagian). Upaya perbaikan awal (`pnpm install --force`) sempat
**tanpa sengaja mengosongkan seluruh `node_modules` repo** untuk sesaat saat
proses diinterupsi di tengah jalan — berpotensi mengganggu proses lain yang
sedang berjalan di komputer yang sama. **Sudah dipulihkan penuh** (diverifikasi
lewat suite test 186/186 hijau) sebelum melanjutkan pekerjaan apa pun. Selama
proses perbaikan, ditemukan juga proses dev server lain (bukan milik sesi
ini) sedang berjalan dan menahan lock pada beberapa file native
(`argon2`, query engine Prisma) — **tidak disentuh/dihentikan**, perbaikan
dilakukan di sekitarnya (ekstraksi manual paket dari registry npm,
menghindari operasi yang butuh unlink file terkunci).

Tidak ada file kerja/kode milik proses lain yang tersentuh oleh insiden ini —
hanya `node_modules` (artefak build yang bisa dibuat ulang, bukan hasil
kerja).

## 7. Perubahan yang SENGAJA tidak ikut commit (bukan milik sesi ini)

Sepanjang sesi ini, sebuah **proses lain berjalan bersamaan** di direktori
kerja yang sama, membangun vertikal "hospitality" (perhotelan) — modul baru,
migrasi baru, perubahan di beberapa file bersama (`parity-evidence.registry.ts`,
`app.module.ts`, `tenant.module.ts`, dll). Perubahan ini **sengaja dibiarkan
tidak ter-commit oleh sesi ini** — setiap kali file yang sama perlu diedit,
dipakai `git apply --cached` dengan patch yang sudah dipisah per-hunk agar
HANYA perubahan milik sesi ini yang ter-stage, tidak pernah membundel
perubahan proses lain secara tidak sengaja. Saat dokumen ini ditulis,
`git status` pada repo masih menunjukkan banyak file `M`/`??` dari proses
tsb — itu BUKAN pekerjaan yang belum selesai dari sesi ini, itu milik proses
lain dan sengaja tidak disentuh.

## 8. Commit yang dibuat sesi ini (sudah di-push ke `origin/main`)

Ringkas dari yang terbaru (lihat `git log --oneline` untuk daftar lengkap,
sesi ini juga mencakup banyak commit sebelum keempat commit gap-fix berikut):

```
fd1eef1 fix(tenant): reverse goods-receipt payable ledger + compute stock average_cost
2b0e68e fix(tenant): block salesperson purge when referenced indirectly via user_subject_id
a1a28db fix(tenant): mask bank-detail fields in audit trail snapshots
d11a9b9 fix(web): remove non-working demo-login shortcuts for generic inventory host
a6246dc fix(release): allow debug APKs for manual verification
b3e9f00 fix(deploy): sync POS exe/apk from GitHub Releases on every run, not just app deploys
e8b7e3a fix(ci): build E2E artifacts in production mode
3d9d541 feat(pos): complete shift close parity and deploy gate
a68c7c5 feat(pos-flutter): personal Sales dashboard consuming my-sales-dashboard
24afb3b feat(pos-flutter): auto-update checking for the Inventory app
7864496 fix(pos-flutter): rename buried "Operasional" sidebar label to surface Purchasing
4d03c54 fix(pos-flutter): default Sales role away from Dashboard, dedupe Sales Order heading, real customer search
848750f fix(pos-flutter): fully isolate each product build via CI matrix
737d70e fix(deploy): move backgrounded backup after self-re-exec, not across it
9f07e96 fix(pos-flutter): stop newline-corrupting GITHUB_OUTPUT in terbitkan
84bc21d feat(pos-flutter): let Windows release publish independently of Android
bc35170 fix(deploy): force-fetch tags so a moved pos-v* tag can't abort update.sh
a44cac7 fix(pos-flutter): flutter clean between sequential multi-product builds
e45abbd perf(deploy): background non-blocking steps in update.sh
... (dan seterusnya — lihat git log untuk audit UAT-to-PROVEN 48 layar,
    bridge Purchase→AP dan Sales→AR, dsb. dari bagian awal sesi ini)
```

## 9. Yang BELUM diselesaikan / perlu ditindaklanjuti

- **Android APK signing** masih terblokir GitHub Secrets yang tidak lengkap
  — hanya pemilik repo yang bisa memperbaikinya (butuh akses ke secrets).
- **Verifikasi ulang di server produksi**: permintaan terakhir pemilik repo
  sebelum sesi berpindah ke paket PDF/zip 48-layar adalah memastikan build
  Inventory exe/APK yang benar dan menu Pembelian-ke-Supplier berfungsi di
  server yang SUDAH di-update — belum sempat diverifikasi ulang secara live
  karena permintaan berikutnya (audit paket 48-layar → 4 gap fix) menyela.
- **Paket 117-halaman PDF + dokumen master command 233KB** (`Paket_Perintah_
  POS_Inventory_eBisnis_Paritas_48_Layar.zip`) belum dibaca penuh
  halaman-per-halaman — sudah dibandingkan pada level ringkasan
  (`MATRIKS_EKSEKUSI`, `REKOMENDASI`) terhadap `parity-evidence.registry.ts`
  yang menunjukkan 48/48 layar sudah PROVEN, plus keempat gap nyata yang
  ditemukan lewat audit sebelumnya (bukan dari paket ini) semuanya sudah
  diperbaiki di sesi ini. Cross-check baris-per-baris terhadap PDF 117
  halaman TIDAK dilakukan.
- **Gap turunan yang sengaja tidak dicakup** (lihat detail di §5.3-5.4):
  biaya transfer antar-gudang, un-blending average_cost saat reversal,
  status `purchase_order` setelah GR dibatalkan, jurnal pembalik otomatis.
- **CI Actions run status** setelah push terakhir belum dicek langsung (sesi
  ini tidak punya akses `gh auth` di sandbox) — cek tab Actions di GitHub
  sebelum menganggap semuanya hijau di CI juga, bukan hanya lolos lokal.

## 10. Catatan praktis untuk melanjutkan di komputer lain

- `node_modules` di komputer lain kemungkinan bersih (insiden §6 spesifik ke
  komputer ini) — `pnpm install` biasa seharusnya cukup. Bila menemui
  gejala serupa (modul native seperti `argon2`/prisma query engine hilang
  sebagian, atau path aneh menunjuk proyek lain), curigai pnpm store yang
  korup, bukan kesalahan kode.
- Semua pekerjaan sudah ter-push ke `origin/main` — `git pull` di komputer
  lain akan mendapatkan semuanya, termasuk dokumen ini.
- Deploy/`install.sh`/`update.sh` di server produksi TETAP tanggung jawab
  pemilik repo sendiri sesuai instruksi sesi ini — tidak ada perubahan pada
  aturan itu.
