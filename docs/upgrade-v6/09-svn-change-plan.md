# 09 — Rencana Perubahan SVN

> Fase V6-0. **Tidak ada commit yang dilakukan pada fase ini.** Dokumen ini
> merencanakannya dan menandai keputusan yang memerlukan persetujuan pemilik.

## PERINGATAN — ada staging aktif yang belum dikomit (terdeteksi saat fase ini)

Antara pengambilan `svn status` awal dan akhir fase V6-0, muncul perubahan pada
working copy yang **bukan** berasal dari pekerjaan audit ini:

| Indikasi | Bukti |
| --- | --- |
| 241 path berstatus `A` (scheduled for add) | `evidence/svn-status-after-v6-0.txt` |
| Changelist bernama `ignore-on-commit` | idem; konvensi TortoiseSVN |
| Obstruction bertambah dari 1 menjadi 7 | idem |

Rincian 241 path yang sudah dijadwalkan untuk ditambahkan:

| Kelompok | Jumlah | Penilaian |
| --- | --- | --- |
| `node_modules\.pnpm\**` | 174 | **JANGAN DIKOMIT** |
| `node_modules\.bin\**` | 16 | **JANGAN DIKOMIT** |
| `node_modules\.cache\**` | 6 | **JANGAN DIKOMIT** |
| `node_modules\.modules.yaml`, `node_modules` | 2 | **JANGAN DIKOMIT** |
| `docs\upgrade-v6\**` | 20 | benar, ini keluaran fase V6-0 |
| `docs\database\**` | 9 | benar |
| `docs\architecture\**` | 7 | benar |
| `docs\modules\**` | 5 | benar |
| `docs\runbooks\**` | 2 | benar |

Yang **baik**: tidak ada `.env`, `dist`, `.dump`, `playwright-report`, atau
`test-results` di antara yang dijadwalkan.

Yang **berbahaya**: 198 path di bawah `node_modules` sudah dijadwalkan. Karena
`svn add` pada direktori bersifat rekursif, commit sekarang akan memasukkan
seluruh pohon dependency — puluhan ribu berkas — dan memperburuk masalah
`node_modules` yang sudah ada di r104.

Perubahan ini **tidak saya sentuh**: membatalkan penjadwalan orang lain adalah
tindakan atas pekerjaan yang sedang berjalan, dan itu keputusan pemilik.

Perintah untuk membatalkan penjadwalan `node_modules` **tanpa menghapus berkas
dari disk** (pnpm tetap berfungsi):

```bash
svn revert --depth infinity node_modules
svn revert --depth infinity apps/api/node_modules
```

`svn revert` pada path yang berstatus `A` hanya membatalkan penjadwalan; berkas di
disk tetap utuh. Setelah itu, lanjutkan dengan `svn:global-ignores` pada bagian
"Masalah 3" di bawah agar tidak terulang.

## Kondisi repository saat ini

| Atribut | Nilai |
| --- | --- |
| URL | `svn://38.47.178.34/pos/eBisnis` |
| Revisi working copy | 103 |
| Revisi repository | 104 |
| Path versioned | 104 (≈70 di bawah `node_modules`) |
| Unversioned | 54 |
| Obstruction | 1 (`apps\api\node_modules\@nestjs\cli`) |
| Conflict / missing / switched / external | tidak ada |
| Properti `svn:ignore` | **tidak ada satu pun** |

Working copy tertinggal satu revisi dari repository (103 vs 104). `svn update`
wajib dijalankan sebelum commit apa pun.

## Tiga masalah yang harus diselesaikan sebelum commit V6

### Masalah 1 — `apps/api/.env` ter-commit beserta kredensial

**Memerlukan keputusan pemilik.** Berkas ini sudah ada di riwayat repository
(r104), sehingga menghapusnya dari revisi HEAD **tidak** menghapusnya dari
riwayat. Siapa pun yang dapat membaca repository dapat mengambil
`svn cat -r 104 apps/api/.env`.

Kredensial yang terekspos:

| Variabel | Isi |
| --- | --- |
| `DATABASE_URL`, `DATABASE_ADMIN_URL` | user + kata sandi PostgreSQL |
| `JWT_ACCESS_SECRET` | secret token akses |
| `JWT_REFRESH_SECRET` | secret refresh token |
| `BOOTSTRAP_SUPER_ADMIN_PASSWORD` | kata sandi awal super admin |

Rekomendasi berurutan:

```text
1. Rotasi keempat secret di atas pada database dan .env lokal.
   (Kata sandi PostgreSQL, dua JWT secret, kata sandi super admin.)
   Rotasi JWT secret akan mencabut seluruh sesi aktif — ini disengaja.
2. svn delete apps/api/.env            (hapus dari versioning HEAD)
3. Set properti svn:ignore yang sesungguhnya (lihat di bawah).
4. Pastikan apps/api/.env.example tetap versioned dan TIDAK memuat nilai rahasia.
5. Bila kerahasiaan riwayat penting, riwayat repository perlu dibersihkan
   (svnadmin dump/filter/load pada server) — ini tindakan administratif server
   dan di luar kewenangan working copy.
```

Langkah 1 dan 5 adalah keputusan pemilik. Saya tidak menjalankannya sendiri.

### Masalah 2 — `node_modules` ter-commit dan obstruction

```text
svn delete --keep-local apps/api/node_modules
```

`--keep-local` mempertahankan direktori di disk (pnpm tetap berfungsi) sementara
mengeluarkannya dari versioning. Ini juga menyelesaikan obstruction `~M`.

### Masalah 3 — `svn:ignore` tidak pernah ada

`.svnignore` di root adalah berkas teks biasa; Subversion tidak membacanya.
Isinya benar, tetapi tidak pernah berlaku. Yang diperlukan adalah properti:

```bash
svn propset svn:global-ignores "node_modules
dist
build
coverage
playwright-report
test-results
blob-report
.playwright
*.log
*.tsbuildinfo
.tmp
.cache
.turbo
.vite
generated
.env
.env.local
.env.production
.env.*.local
.DS_Store
Thumbs.db" .
```

`svn:global-ignores` (Subversion 1.8+) berlaku rekursif dari root, sehingga tidak
perlu menyetel `svn:ignore` di setiap direktori.

Catatan: `svn:global-ignores` **tidak** memengaruhi berkas yang sudah versioned.
`.env` dan `node_modules` tetap harus di-`svn delete` lebih dahulu.

`.svnignore` sebaiknya tetap ada sebagai dokumentasi, dengan komentar bahwa
sumber kebenarannya adalah properti SVN.

## Rencana commit

Prompt upgrade bagian 20 meminta commit kecil per fase yang lulus. Karena hampir
seluruh V5 belum diversi, commit pertama adalah membawa V5 masuk — **terpisah**
dari V6 agar `svn diff` setiap fase V6 tetap dapat ditinjau.

| # | Pesan commit | Isi | Prasyarat |
| --- | --- | --- | --- |
| C0 | `chore: set svn:global-ignores, keluarkan .env dan node_modules dari versioning` | properti + 2 `svn delete` | rotasi secret selesai |
| C1 | `v5: backend api source, tenant migrations, platform migration, seed` | `apps/api/src`, `tenant-migrations`, `prisma/platform/migrations`, `prisma/seed.ts`, `prisma.config.ts`, `tsconfig.build.json`, `tsconfig.spec.json` | C0 |
| C2 | `v5: frontend web app` | `apps/web/**` kecuali `node_modules`, `dist`, `playwright-report`, `test-results` | C1 |
| C3 | `v5: smoke test, docs arsitektur, data dictionary, runbook, README` | `scripts/`, `docs/architecture`, `docs/database`, `docs/modules`, `docs/runbooks`, `README.md`, `pnpm-lock.yaml` | C2 |
| C4 | `v6-0: audit implementasi v5 existing` | `docs/upgrade-v6/**` | C3 |
| C5 | `v6-0.x: guard permission master, rekonsiliasi registry, orval client` | perbaikan prasyarat | C4 + test lulus |
| C6 | `v6-1a: skema referral dan migration` | model + migration platform | C5 |
| C7 | `v6-1b: service attribution dan komisi referral` | service + API | C6 |
| C8 | `v6-1c: UI referral dan test` | UI + test | C7 |
| … | `v6-2a`, `v6-3a`, `v6-4a`, `v6-4b`, `v6-5a`, … | per fase | berurutan |

## Yang TIDAK boleh dikomit

```text
.env dan seluruh varian .env.*        (kecuali .env.example tanpa nilai rahasia)
node_modules/
dist/  build/  coverage/
playwright-report/  test-results/  blob-report/
*.log  *.tsbuildinfo
C:\opt\eBisnis-backup\*.dump         (di luar working copy — sudah aman)
sertifikat, private key
generated/  (client Orval — dihasilkan, bukan sumber)
```

Berkas dump database sudah ditempatkan di `C:\opt\eBisnis-backup\`, di luar
working copy, sehingga tidak mungkin ikut ter-commit.

## Prosedur sebelum setiap commit

```bash
svn update
svn status
svn diff --summarize
svn diff
```

Bila `svn update` menghasilkan conflict: **hentikan commit**, selesaikan conflict
setelah memahami perubahan, jangan menimpa pekerjaan orang lain. Working copy
saat ini tertinggal satu revisi, jadi conflict mungkin terjadi pada `svn update`
pertama.

## Verifikasi setelah commit

```bash
svn status                                   # bersih, kecuali berkas ignored
svn list -R svn://38.47.178.34/pos/eBisnis | grep -E "\.env$|node_modules"
                                             # harus kosong
```

## Evidence fase ini

| Berkas | Isi |
| --- | --- |
| `evidence/svn-info-before.txt` | `svn info` sebelum perubahan |
| `evidence/svn-status-before.txt` | 55 baris status |
| `evidence/svn-diff-summary-before.txt` | ringkasan diff |
| `evidence/svn-log-before.txt` | 20 revisi terakhir |
