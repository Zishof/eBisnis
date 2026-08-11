# Handover POS/Inventory 48 Layar — 11 Agustus 2026

Dokumen ini adalah titik mulai untuk sesi di komputer baru. Baca dokumen ini
sebelum melakukan audit, perubahan source, deploy, atau membuat release baru.

## Kondisi Repository Saat Diserahterimakan

- Repository: <https://github.com/Zishof/eBisnis.git>
- Branch aktif dan sumber kebenaran: `main`
- Commit source fitur utama: `e20b9131`
- Commit release workflow: `d2989295`
- Commit dokumentasi bukti: `2151b0c3`
- Commit valuasi retur/void: `6489e569`
- Commit jurnal pembalik goods receipt: `5091f997`
- Tag kandidat UAT: `inventory-v0.1.35`
- Versi Flutter: `0.1.35+35`
- Release 0.1.35 berstatus **prerelease**, bukan stable production.

Commit baseline yang menambahkan handover ini adalah `00118111`. Gunakan
`git log -5 --oneline` setelah clone untuk melihat commit dokumentasi lanjutan
dan memastikan clone sudah sama dengan `origin/main`.

## Perkembangan Sesudah Baseline Handover

Handover awal ditulis pada `00118111`. Sebelum finalisasi lintas-komputer ini,
dua perubahan integritas tambahan sudah masuk `main`:

1. `6489e569` menutup pengenceran valuasi stok saat retur/void kasir dengan
   mengembalikan nilai berdasarkan `cost_snapshot`; biaya tak diketahui dan
   ember rusak/dimusnahkan dijaga agar tidak merusak average cost.
2. `5091f997` membuat jurnal pembalik append-only untuk goods receipt yang
   dibatalkan setelah event akuntansinya terlanjur `POSTED`, lengkap dengan
   idempotensi, `reversal_of_id`, dan pemeriksaan periode terbuka.

Kedua commit sudah memperbarui
[`docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md`](../pos-web-priority/20-serah-terima-remote-pos-inventory.md).
Jangan mengulang pekerjaan itu; mulai dari source dan test terbaru di
`origin/main`.

## Urutan Baca di Komputer Baru

1. Dokumen ini.
2. [`2026-08-11-deskripsi-pekerjaan-pos-inventory-48-layar.md`](2026-08-11-deskripsi-pekerjaan-pos-inventory-48-layar.md).
3. [`../implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md`](../implementation/inventory-sales-48/gap-analysis-video-48-2026-08-11.md).
4. [`../implementation/inventory-sales-48/parity-48.json`](../implementation/inventory-sales-48/parity-48.json).
5. [`../implementation/inventory-sales-48/evidence/uat/2026-08-11-inventory-0.1.35-release.md`](../implementation/inventory-sales-48/evidence/uat/2026-08-11-inventory-0.1.35-release.md).
6. `deploy/update.sh` sebelum deploy server.

Jangan mengulang audit backend 48 layar dari nol. Gunakan gap analysis dan
registry sebagai baseline, lalu perbarui evidence secara incremental.

## Memulai di Komputer Baru

```powershell
git clone https://github.com/Zishof/eBisnis.git C:\opt\eBisnis
Set-Location C:\opt\eBisnis
git checkout main
git pull --ff-only origin main
git config core.hooksPath .githooks
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm install --frozen-lockfile
```

Untuk Flutter:

```powershell
Set-Location apps\pos-flutter
flutter pub get
flutter analyze
flutter test
```

Jangan menyalin `.env`, database password, token GitHub, keystore, atau
sertifikat melalui Git. Pindahkan secret melalui kanal rahasia terpisah.

## Verifikasi Baseline Minimum

```powershell
pnpm --filter @ebisnis/api build
pnpm --filter @ebisnis/api test
pnpm --filter @ebisnis/web lint
pnpm --filter @ebisnis/web test
pnpm --filter @ebisnis/web build
Set-Location apps\pos-flutter
flutter analyze
flutter test
```

Hasil terakhir yang telah dibuktikan: API build/test lulus, Web build/lint dan
511 test lulus, Flutter analyze dan 203 test lulus. Bila hasil komputer baru
berbeda, periksa versi Node/pnpm/Flutter dan dependency sebelum mengubah source.

## Build yang Sudah Tersedia

- APK Android release-signed:
  <https://github.com/Zishof/eBisnis/releases/download/inventory-v0.1.35/ebisnis-inventory-sales-0.1.35.apk>
- Windows UAT unsigned:
  <https://github.com/Zishof/eBisnis/releases/download/inventory-v0.1.35/ebisnis-inventory-sales-0.1.35-windows-unsigned-uat.exe>
- GitHub Actions:
  <https://github.com/Zishof/eBisnis/actions/runs/31479114540>

Checksum harus dicocokkan dengan dokumen evidence sebelum instalasi.

## Deploy Server

`deploy/update.sh` sudah menjalankan frozen install, build, validasi migration,
Prisma platform migration, migration seluruh schema tenant, restart service,
health check, Apache reload, dan rollback ketika gate wajib gagal.

```bash
sudo -u ebisnis git -C /opt/ebisnis/app fetch origin
sudo -u ebisnis git -C /opt/ebisnis/app checkout main
sudo -u ebisnis git -C /opt/ebisnis/app pull --ff-only origin main
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Deploy belum dianggap selesai hanya karena script keluar sukses. Verifikasi:

- endpoint `/health`;
- login tenant dari jaringan operator;
- migration platform dan seluruh tenant;
- transaksi pembelian, penerimaan, hutang, Sales Order, piutang, dan pembatalan;
- laporan/snapshot/print log;
- endpoint download APK/installer;
- log service dan proxy setelah smoke test.

## Pekerjaan yang Masih Terbuka

Ini adalah pekerjaan eksternal/evidence atau perlu keputusan bisnis; jangan
ditutup dengan placeholder:

1. Menyediakan secret `WINDOWS_CODE_SIGNING_PFX_BASE64` dan
   `WINDOWS_CODE_SIGNING_PASSWORD`, lalu membuat installer Windows signed/stable.
2. UAT Android dan Windows pada perangkat fisik, termasuk install/update-in-place.
3. UAT printer, barcode/scanner, peripheral, dan jaringan putus/tersambung kembali.
4. Rekonsiliasi hasil transaksi, stok, HPP, AP/AR, jurnal, dan laporan terhadap
   data serta keluaran aplikasi legacy.
5. Persetujuan pemilik proses untuk tiap layar/capability dan pengisian evidence
   registry per Web, Windows, Android, offline, print/export, reconciliation,
   serta hardware.
6. Memutuskan merger aman per entity sebelum mengaktifkan conflict policy
   `CLIENT_WINS` atau `MERGED`.
7. Menyempurnakan capability yang masih dicatat sebagai pending pada
   `parity-48.json`; jangan mengganti status menjadi proven tanpa bukti.

## Batas Klaim

- 48 layar memiliki route/workspace dan vertical slice utama sudah nyata.
- Automated gates untuk kandidat 0.1.35 lulus.
- Ini **belum** membuktikan paritas fungsional 100% di lapangan.
- Release Windows saat ini unsigned UAT; auto-updater stable mengabaikannya.
- Deploy produksi harus dibuktikan dari server, bukan dari Git commit.

## Aturan Melanjutkan

- Selalu tarik `origin/main` dan cek `git status` sebelum bekerja.
- Jangan menghapus perubahan lokal yang tidak dibuat sendiri.
- Gunakan migration baru yang aditif; jangan mengubah migration applied.
- Jangan reset/drop database, menimpa `.env`, atau force-push.
- Implementasikan dan buktikan gap secara vertical slice, bukan TODO/skeleton.
- Setelah status berubah, perbarui handover, gap analysis, registry, evidence,
  dan release notes dalam commit yang sama atau commit dokumentasi berurutan.

## Catatan Worktree Asal

Pada komputer asal terdapat folder lokal tidak terlacak `releases/`. Folder itu
tidak dimasukkan ke commit dan tidak boleh dihapus/reset oleh sesi lanjutan tanpa
memastikan kepemilikannya. Clone baru tidak memerlukan folder tersebut karena
artefak resmi tersedia pada GitHub Release.
