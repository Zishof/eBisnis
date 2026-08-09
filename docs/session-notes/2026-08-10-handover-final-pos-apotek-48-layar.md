# Handover Final — POS Apotek dan Paritas 48 Layar

Tanggal handover: **10 Agustus 2026 (Asia/Jakarta)**

Repository: `https://github.com/Zishof/eBisnis.git`

Branch kerja: `main`

Dokumen ini melengkapi
[`2026-08-10-ringkasan-sesi.md`](2026-08-10-ringkasan-sesi.md). Fokusnya adalah
pekerjaan audit/paritas 48 layar POS–Inventory, implementasi POS Apotek,
pengujian, CI/CD, persiapan deploy, dan publikasi artefak POS Apotek yang
dikerjakan pada rangkaian sesi ini.

> **Keamanan:** kredensial database, token GitHub, password server, isi `.env`,
> dan material signing sengaja tidak ditulis ke repository. Ambil kredensial
> dari pengelola sistem/secrets manager pada komputer baru.

---

## 1. Permintaan dan batasan tetap

Pekerjaan dimulai dari audit P0 sebelum mengubah source, dengan ruang lingkup:

- repository dan riwayat Git;
- database, schema, dan migration;
- API dan Web;
- Flutter Windows dan Flutter Android;
- local database/offline sync;
- test, CI, release, dan `deploy/update.sh`;
- pemetaan 48 layar legacy ke UI baru;
- implementasi incremental sampai seluruh layar mempunyai bukti paritas.

Batasan yang harus tetap dipatuhi:

- jangan rewrite repository;
- jangan reset/drop database;
- jangan mengedit migration yang sudah applied;
- jangan menimpa `.env`;
- jangan force-push;
- perubahan proses/AI lain di shared worktree tidak boleh ikut di-stage tanpa
  audit dan persetujuan eksplisit.

Input utama yang dipakai:

- `Mapping-48-Layar-Legacy-ke-UI-Baru-eBisnis-POS-Inventory-v3.pdf`;
- `PERINTAH_MASTER_CODEX_CLAUDE_POS_INVENTORY_PARITAS_48_LAYAR.md` dan dokumen
  yang dirujuk olehnya;
- paket prototipe/screenshot `eMedik-POS-UIUX-Prototype-dan-Screenshot.zip`;
- 21 screenshot desktop/mobile eMedik POS yang diberikan pengguna;
- dokumen bukti repository di `docs/pos-inventory-parity/`.

File input asli berada di komputer lama di bawah `C:\Users\Admin1\Downloads`.
File tersebut tidak di-commit karena berasal dari luar repository dan beberapa
berukuran besar.

---

## 2. Hasil audit dan implementasi POS/paritas

### 2.1 Paritas 48 layar

- Registry bukti dan ledger paritas diperiksa di
  `apps/api/src/modules/tenant/parity-evidence.registry.ts` dan
  `docs/pos-inventory-parity/`.
- Bukti API/database untuk seluruh 48 layar tersedia dan status ledger mencapai
  **48/48 PROVEN**.
- Dokumen indeks, ledger, checklist deploy, dan bukti UAT layar 43/44 diperbarui
  pada commit `3d9d541`.
- Jangan menyamakan `PROVEN` API/database dengan UAT hardware: printer,
  scanner, cash drawer, dan perangkat Android fisik tetap harus diuji di lokasi.

### 2.2 Vertical slice Tutup Shift POS Apotek

Commit utama: `3d9d541 feat(pos): complete shift close parity and deploy gate`

Perubahan penting:

- endpoint/API client tutup shift ditambahkan ke Flutter POS;
- UI tutup shift apotek dibuat di
  `apps/pos-flutter/lib/layar/operasi_apotik.dart`;
- alur rekonsiliasi kas, checklist, item belum selesai, dan finalisasi shift
  dihubungkan ke API nyata;
- test widget/API untuk alur shift ditambahkan;
- registry bukti layar serta dokumentasi deploy/paritas diperbarui.

### 2.3 Keamanan evidence

Commit: `440c36c security: redact expired UAT tokens`

- token UAT kedaluwarsa di evidence JSON disamarkan;
- fingerprint historis/false-positive yang sudah diaudit dicatat secara
  terkontrol di `.gitleaksignore`;
- pemindaian penuh Gitleaks terhadap 588 commit menghasilkan **no leaks found**.

### 2.4 CI E2E

Commit: `e8b7e3a fix(ci): build E2E artifacts in production mode`

- build E2E dipaksa menggunakan `NODE_ENV=production`;
- memperbaiki kegagalan Workbox karena bundle test melampaui batas 2 MiB.

### 2.5 Persiapan deploy `update.sh`

Commit: `b3e9f00 fix(deploy): sync POS exe/apk from GitHub Releases on every run, not just app deploys`

- sinkronisasi `.exe`/`.apk` dipindahkan sebelum early exit sehingga release POS
  tetap disinkronkan walaupun commit aplikasi server tidak berubah;
- Prisma generate dijalankan pada urutan yang benar sebelum build;
- instalasi dependency CI/deploy diperketat;
- `bash -n deploy/update.sh` lulus.

Catatan penting: fungsi sinkronisasi otomatis saat ini memilih release yang
`draft=false` dan `prerelease=false`. Release POS Apotek `0.1.17` di bawah masih
pre-release, sehingga **tidak otomatis dipromosikan oleh `update.sh`**.

### 2.6 Release workflow Android manual

Commit: `a6246dc fix(release): allow debug APKs for manual verification`

- workflow manual dapat menghasilkan APK debug-signed bila keystore release
  tidak valid;
- build yang dipicu tag tetap strict dan gagal bila signing production tidak
  tersedia;
- ini sengaja mencegah APK debug dianggap sebagai release produksi resmi.

### 2.7 Login demo inventory generik

Commit: `d11a9b9 fix(web): remove non-working demo-login shortcuts for generic inventory host`

- shortcut akun demo yang tidak memiliki seed backend di host inventory generik
  dihapus;
- kredensial tenant pelanggan nyata tidak diekspos sebagai pengganti.

---

## 3. Commit penting yang sudah ada di `origin/main`

Urutan pekerjaan inti:

```text
3d9d541 feat(pos): complete shift close parity and deploy gate
440c36c security: redact expired UAT tokens
e8b7e3a fix(ci): build E2E artifacts in production mode
b3e9f00 fix(deploy): sync POS exe/apk from GitHub Releases on every run, not just app deploys
a6246dc fix(release): allow debug APKs for manual verification
d11a9b9 fix(web): remove non-working demo-login shortcuts for generic inventory host
a1a28db fix(tenant): mask bank-detail fields in audit trail snapshots
2b0e68e fix(tenant): block salesperson purge when referenced indirectly via user_subject_id
fd1eef1 fix(tenant): reverse goods-receipt payable ledger + compute stock average_cost
ea03c91 docs: add session summary for 2026-08-10
```

Saat handover disusun, `HEAD`/`origin/main` sebelum commit dokumen ini adalah
`ea03c9152577766618ac16401463dfcf46b38b28`, dan local tag `pos-v0.1.18`
menunjuk ke commit tersebut. Tag/release `0.1.18` berasal dari pekerjaan setelah
rilis `0.1.17`; audit asetnya secara terpisah sebelum menganggapnya sebagai
pengganti release yang diverifikasi di dokumen ini.

---

## 4. Validasi yang sudah dilakukan

### Flutter

- `flutter analyze`: lulus;
- 22 file test non-visual: **174/174 lulus**;
- test baru tutup shift/widget/API: lulus;
- suite resmi Flutter pada runner Ubuntu di CI: lulus;
- golden lokal Windows pernah berbeda karena renderer lintas-OS; ini bukan
  kegagalan logika dan runner resmi Ubuntu menjadi baseline CI.

### API/Web/Security

- CI final commit `d11a9b9`: sukses;
- E2E final commit `d11a9b9`: sukses;
- Security final commit `d11a9b9`: sukses;
- Gitleaks lokal full-history: tidak menemukan secret aktif;
- pemeriksaan API penuh dan perbaikan integritas lanjutan dirangkum di
  `2026-08-10-ringkasan-sesi.md`.

Run GitHub Actions yang telah diverifikasi:

- CI: <https://github.com/Zishof/eBisnis/actions/runs/31317221196>
- E2E: <https://github.com/Zishof/eBisnis/actions/runs/31317221213>
- Security: <https://github.com/Zishof/eBisnis/actions/runs/31317221171>
- Build manual POS `0.1.17`:
  <https://github.com/Zishof/eBisnis/actions/runs/31315065566>

Build manual menghasilkan enam artefak matrix:

- Windows default, apotek, inventory;
- Android penjualan/default, apotek, inventory.

APK hasil build manual telah diperiksa dengan `jarsigner` dan valid sebagai
debug-signed. Installer Windows belum memiliki Authenticode signature.

---

## 5. Release publik POS Apotek

Release telah dibuat di GitHub:

- Release: <https://github.com/Zishof/eBisnis/releases/tag/pos-v0.1.17>
- Windows Desktop:
  <https://github.com/Zishof/eBisnis/releases/download/pos-v0.1.17/emedik-pos-apotik-0.1.17-windows.exe>
- Android APK:
  <https://github.com/Zishof/eBisnis/releases/download/pos-v0.1.17/emedik-pos-apotik-0.1.17.apk>

Metadata:

```text
Tag          : pos-v0.1.17
Target build : a6246dc6447209bb8d11c04691d4388eee05df09
Draft        : false
Prerelease   : true
APK SHA-256  : 10C65767950797D757138105622C75CA97438DBCD3BF4E7857DDB326044FB9CD
EXE SHA-256  : C26232CF6F73FA1AF96F253522FBBD96B2C96A7680FBACD68CA59E2FF2160BD9
```

Alasan `prerelease=true`:

- APK memakai debug signing dari workflow manual;
- Windows EXE belum ditandatangani Authenticode;
- publikasi ini untuk verifikasi/UAT, bukan promosi production-final.

Artefak lokal di komputer lama pernah diunduh ke:

```text
C:\opt\eBisnis-Github\eBisnis\tmp\rilis-pos-0.1.17
```

Jangan bergantung pada folder lokal tersebut di komputer baru; gunakan tautan
GitHub Release dan verifikasi SHA-256.

---

## 6. Database dan server produksi

Pengujian lokal diizinkan menggunakan database `ebisnis` pada port default.
Kredensial tidak dicatat di dokumen ini.

Pemeriksaan read-only terakhir terhadap health produksi menunjukkan:

```text
status                  ok
app                     eBisnis.id
version                 0.1.0
environment             production
database                up
tenantSchemas           4
tenantMigrationVersion  H071
```

Endpoint portals publik juga mengembalikan HTTP 200.

Deploy aktual **belum dilakukan** karena akses SSH ke server
`38.47.178.46:22031` ditolak untuk akun yang dicoba. Tidak ada database yang
di-reset/drop dan tidak ada `.env` yang ditimpa.

Setelah operator memperoleh akses resmi, perintah deploy yang disiapkan adalah:

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Sesudah deploy, lakukan smoke test health, login tenant, POS Apotek, close shift,
offline queue/sync, dan endpoint unduhan POS.

---

## 7. Yang masih pending

1. **Signing produksi Android**
   - isi GitHub Secrets keystore/alias/password dengan material release yang
     benar;
   - trigger tagged build;
   - verifikasi certificate fingerprint, bukan hanya `jarsigner` exit code.

2. **Signing Windows**
   - sediakan certificate/code-signing identity;
   - tandatangani installer dan verifikasi Authenticode.

3. **Promosi release stabil**
   - hanya setelah kedua signing di atas dan UAT lulus;
   - ubah dari pre-release menjadi release stabil atau terbitkan versi baru;
   - setelah stabil, `deploy/update.sh` dapat mengambilnya otomatis.

4. **Deploy produksi**
   - membutuhkan akses SSH resmi;
   - jalankan `update.sh`, jangan menjalankan migrasi manual di luar alurnya.

5. **UAT hardware**
   - printer thermal 58/80 mm;
   - scanner barcode;
   - cash drawer;
   - perangkat Android fisik;
   - simulasi offline lalu reconnect/sync;
   - verifikasi cetak/kirim ulang struk dan tutup shift.

6. **Cross-check dokumen sumber halaman-per-halaman**
   - ledger repository sudah 48/48 PROVEN;
   - cross-check visual penuh terhadap seluruh PDF besar dan setiap gambar
     referensi tetap perlu dilakukan bila diminta sebagai acceptance visual
     pixel/detail-level.

7. **Gap turunan inventory/accounting**
   - biaya transfer antar-gudang;
   - un-blending `average_cost` saat reversal;
   - status purchase order setelah goods receipt dibatalkan;
   - jurnal pembalik otomatis untuk event yang sudah `POSTED`.

---

## 8. Kondisi shared worktree saat handover

Pada saat dokumen ini dibuat terdapat perubahan **Hospitality** dari proses/AI
lain pada file API, Web, migration, dan modul baru. Perubahan itu tidak termasuk
scope POS Apotek/paritas sesi ini dan **sengaja tidak dimasukkan ke commit
handover**.

Kelompok perubahan yang terlihat antara lain:

- migration platform Hospitality;
- `apps/api/src/modules/hospitality/`;
- controller/service POS Hospitality;
- registration/public Hospitality;
- tenant migrations Hospitality;
- halaman/vertical Web Hospitality;
- perubahan shared registry/module/role/permission/seed;
- `robots.txt` dan `sitemap.xml`.

Sebelum bekerja di komputer lama, jalankan `git status -sb` dan jangan reset
perubahan tersebut. Di komputer baru, perubahan uncommitted ini memang tidak
akan ikut melalui `git pull`; koordinasikan dengan pemilik proses Hospitality
agar mereka membuat commit terpisah setelah test mereka selesai.

---

## 9. Langkah mulai di komputer baru

```bash
git clone https://github.com/Zishof/eBisnis.git
cd eBisnis
git checkout main
git pull --ff-only origin main
git status -sb
```

Kemudian:

1. baca dokumen ini dan `docs/session-notes/2026-08-10-ringkasan-sesi.md`;
2. salin `.env` dari secrets manager/administrator, jangan dari Git;
3. pasang versi Node/pnpm/Flutter yang dinyatakan repository;
4. jalankan install dependency bersih;
5. generate Prisma memakai schema/config repository;
6. jalankan typecheck, unit test API/Web, Flutter analyze/test, lalu E2E;
7. cek Actions dan Release terbaru sebelum membuat tag baru;
8. lanjutkan item pending di bagian 7.

Catatan lingkungan komputer lama: pernah ada lock native DLL Prisma/Node dan
symlink pnpm yang rusak karena shared worktree. Jika Prisma generate gagal
`EPERM`, tutup proses Node yang memang milik Anda atau reboot; jangan membunuh
proses developer lain dan jangan menghapus worktree secara paksa.

---

## 10. Kriteria selesai berikutnya

Pekerjaan benar-benar siap produksi bila seluruh kondisi berikut terpenuhi:

- CI, E2E, Security, API/Web/Flutter test hijau pada commit release;
- APK signed dengan release key yang benar;
- Windows installer signed dan signature tervalidasi;
- UAT Windows/Android/perangkat POS nyata lulus;
- release bukan draft/prerelease dan checksum dipublikasikan;
- `update.sh` berhasil di server tanpa reset/drop/edit migration applied;
- health/database/tenant migration tetap sehat sesudah deploy;
- 48 layar diperiksa ulang terhadap acceptance visual dan workflow bisnis.
