# Indeks Serah-Terima - 10 Agustus 2026

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
| 1 | eMedik dan POS Apotik | [`docs/emedik/HANDOVER-2026-08-10.md`](docs/emedik/HANDOVER-2026-08-10.md) | `64c60a4` |
| 2 | POS/Inventory, CI/CD, rilis Flutter, dan perbaikan integritas | [`docs/session-notes/2026-08-10-ringkasan-sesi.md`](docs/session-notes/2026-08-10-ringkasan-sesi.md) | `ea03c91` |
| 3 | ePesantren, eSchool, dan Education Core | [`docs/santri-info/21-session-handoff-2026-08-10.md`](docs/santri-info/21-session-handoff-2026-08-10.md) | `aef9c93` |
| 4 | POS/Inventory dan ekosistem lintas vertikal (konteks lengkap) | [`docs/pos-web-priority/18-serah-terima-claude-2026-08-10.md`](docs/pos-web-priority/18-serah-terima-claude-2026-08-10.md) | commit konsolidasi ini |
| 5 | POS/Inventory dan ekosistem (ringkasan sesi Codex) | [`docs/pos-web-priority/19-serah-terima-sesi-codex-2026-08-10.md`](docs/pos-web-priority/19-serah-terima-sesi-codex-2026-08-10.md) | commit konsolidasi ini |

Kelima dokumen tersebut saling melengkapi. Dokumen eMedik mencakup domain,
landing, storefront tenant, UI klinis, POS Apotik Web/Windows/Android, manual,
unduhan, pembaruan, deploy, dan status Android signing. Ringkasan POS/Inventory
mencakup CI, matrix build, auto-update, parity 48 layar, serta gap akuntansi dan
costing. Handoff Education mencakup ePesantren, eSchool, portal unit, DAPODIK,
rapor, dan gap eCampus.

Dua dokumen POS/Inventory tambahan pada urutan 4-5 sebelumnya hanya tersimpan
lokal di worktree `C:\opt\eBisnisGithub-ecosystem`. Keduanya kini dilacak Git.
Dokumen nomor 4 adalah konteks produk paling luas untuk melanjutkan lewat Claude
atau Codex; dokumen nomor 5 lebih ringkas dan berfokus pada status sesi serta
hal yang masih perlu dibuktikan. Bila ada perbedaan status, utamakan source,
test, `origin/main`, lalu ringkasan sesi pada urutan 2.

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
git clone https://github.com/Zishof/eBisnis.git C:\opt\eBisnisGithub-ekoperasi
Set-Location C:\opt\eBisnisGithub-ekoperasi
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
- POS/Inventory masih memiliki gap turunan pada costing reversal, transfer
  antar-gudang, status purchase order, dan jurnal pembalik tertentu.
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
