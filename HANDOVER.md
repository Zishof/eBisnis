# Indeks Serah-Terima - 11 Agustus 2026

Mulai dari berkas ini ketika repository dipindahkan ke komputer lain. Seluruh
dokumen yang tercantum di bagian **Handoff aktif** sudah disimpan di Git dan
sudah masuk ke branch `main` pada `origin`.

Repository resmi:

```text
https://github.com/Zishof/eBisnis.git
```

## Handoff aktif

Baca sesuai bidang yang akan dilanjutkan:

| Urutan | Bidang | Dokumen | Commit dokumen |
| --- | --- | --- | --- |
| 1 | **POS/Inventory 48 layar — handover aktif terbaru** | [`docs/session-notes/2026-08-11-handover-pos-inventory-48-layar.md`](docs/session-notes/2026-08-11-handover-pos-inventory-48-layar.md) | `00118111` |
| 2 | Deskripsi pekerjaan POS/Inventory 11 Agustus 2026 | [`docs/session-notes/2026-08-11-deskripsi-pekerjaan-pos-inventory-48-layar.md`](docs/session-notes/2026-08-11-deskripsi-pekerjaan-pos-inventory-48-layar.md) | `00118111` |
| 3 | eMedik dan POS Apotik | [`docs/emedik/HANDOVER-2026-08-10.md`](docs/emedik/HANDOVER-2026-08-10.md) | `64c60a4` |
| 4 | POS/Inventory, CI/CD, rilis Flutter, dan perbaikan integritas (historis 10 Agustus) | [`docs/session-notes/2026-08-10-ringkasan-sesi.md`](docs/session-notes/2026-08-10-ringkasan-sesi.md) | `ea03c91` |
| 5 | POS Apotek dan paritas 48 layar (historis 10 Agustus) | [`docs/session-notes/2026-08-10-handover-final-pos-apotek-48-layar.md`](docs/session-notes/2026-08-10-handover-final-pos-apotek-48-layar.md) | handover final 10 Agustus |
| 6 | ePesantren, eSchool, dan Education Core | [`docs/santri-info/21-session-handoff-2026-08-10.md`](docs/santri-info/21-session-handoff-2026-08-10.md) | `aef9c93` |
| 7 | POS/Inventory dan ekosistem lintas vertikal | [`docs/pos-web-priority/18-serah-terima-claude-2026-08-10.md`](docs/pos-web-priority/18-serah-terima-claude-2026-08-10.md) | `9634dfb` |
| 8 | POS/Inventory untuk kendali jarak jauh (historis) | [`docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md`](docs/pos-web-priority/20-serah-terima-remote-pos-inventory.md) | serah-terima remote |

Untuk melanjutkan POS/Inventory, selalu mulai dari dokumen nomor 1. Dokumen itu
memuat keadaan source dan release 0.1.35, langkah clone, baseline test, deploy,
gap yang masih terbuka, serta batas klaim UAT. Dokumen nomor 2 mencatat rincian
pekerjaan yang telah dilaksanakan.

Dokumen historis lainnya tetap saling melengkapi. Dokumen eMedik mencakup domain,
landing, storefront tenant, UI klinis, POS Apotik Web/Windows/Android, manual,
unduhan, pembaruan, deploy, dan status Android signing. Ringkasan POS/Inventory
mencakup CI, matrix build, auto-update, parity 48 layar, serta gap akuntansi dan
costing. Handover final POS Apotek menambahkan daftar commit, hasil CI final,
release publik `pos-v0.1.17`, checksum, status produksi, blocker SSH/signing,
dan langkah mulai di komputer baru. Handoff Education mencakup ePesantren,
eSchool, portal unit, DAPODIK, rapor, dan gap eCampus.

Dokumen konteks POS/Inventory lama yang sebelumnya hanya tersimpan di worktree
lain kini telah dilacak Git. Dokumen tersebut dipertahankan untuk audit, tetapi
bila ada perbedaan status, utamakan source, test, `origin/main`, lalu handover
11 Agustus pada urutan 1.

## Dokumen historis

Dokumen berikut tetap dilacak untuk audit, tetapi bukan titik awal keadaan
terkini:

- [`docs/emedik/HANDOVER-CODEX.md`](docs/emedik/HANDOVER-CODEX.md): snapshot
  eMedik 1 Agustus 2026 dengan angka menu H065/H066.
- [`docs/pos-web-priority/17-serah-terima-codex-2026-08-03.md`](docs/pos-web-priority/17-serah-terima-codex-2026-08-03.md):
  snapshot awal POS Flutter dan spesifikasi AIS.
- [`docs/santri-info/18-session-handoff-2026-08-03.md`](docs/santri-info/18-session-handoff-2026-08-03.md):
  snapshot awal vertikal pesantren.

Jangan memakai angka, branch, worktree, atau daftar gap pada dokumen historis
tanpa membandingkannya dengan handoff aktif dan `git log origin/main`.

## Memindahkan ke komputer baru

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

Pastikan clone benar-benar menerima seluruh handoff:

```powershell
git status --short --branch
git log --oneline -10
git ls-files HANDOVER.md docs | Select-String -Pattern 'HANDOVER|handoff|ringkasan-sesi|serah-terima'
```

`git status` harus bersih dan menunjukkan `main` sinkron dengan `origin/main`.

## Verifikasi minimum

Sesudah dependency tersedia:

```powershell
pnpm --filter @ebisnis/api build
pnpm --filter @ebisnis/web build
Set-Location apps\pos-flutter
flutter pub get
flutter analyze
flutter test
```

Untuk deploy server produksi:

```bash
sudo -u ebisnis git -C /opt/ebisnis/app fetch origin
sudo -u ebisnis git -C /opt/ebisnis/app checkout main
sudo -u ebisnis git -C /opt/ebisnis/app pull --ff-only origin main
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Push GitHub tidak otomatis membuktikan deploy produksi. Setelah deploy, ulangi
smoke test domain, login tenant, migrasi, endpoint unduhan, dan transaksi utama
sesuai checklist pada masing-masing handoff.

## Blocker yang perlu tetap terlihat

- APK Android POS Apotik stable masih memerlukan signing produksi dan secrets
  keystore yang lengkap. APK pratinjau/debug hanya untuk UAT.
- Angka menu eMedik lama harus dihitung ulang dari basis data tenant setelah
  migrasi terbaru; jangan menyalin angka H065/H066.
- Integrasi SATUSEHAT, BPJS, perangkat medis, DNS, dan layanan mitra tetap
  memerlukan credential serta verifikasi per lingkungan.
- POS/Inventory 0.1.35 adalah kandidat UAT. Source utama, purchase-to-pay,
  order-to-cash, custody, costing, laporan, konflik, test, dan release pipeline
  sudah diperluas; status paritas 100% tetap menunggu evidence per capability,
  UAT perangkat/peripheral, dan rekonsiliasi legacy.
- Installer Windows Inventory 0.1.35 masih unsigned UAT. Produksi memerlukan
  secret Authenticode; APK Android 0.1.35 sudah release-signed.
- Education masih mencatat eCampus sebagai gap besar; fingerprint menunggu
  vendor/perangkat nyata.
- `.env`, password, token, keystore Android, credential DNS/Cloudflare, dan
  akun tenant tidak disimpan di Git. Pindahkan melalui kanal rahasia terpisah.

## Aturan melanjutkan

1. Tarik `origin/main` sebelum mulai bekerja.
2. Baca handoff bidang terkait dan commit setelah dokumen tersebut.
3. Perlakukan status produksi sebagai hasil smoke test, bukan hasil membaca
   source atau commit message.
4. Jangan menghapus atau me-reset perubahan worktree yang tidak dibuat sendiri.
5. Perbarui handoff aktif atau indeks ini bila status blocker berubah.

Sumber kebenaran terakhir tetap kombinasi `origin/main`, migrasi tenant yang
benar-benar diterapkan, hasil test, dan keadaan server yang sudah diverifikasi.
