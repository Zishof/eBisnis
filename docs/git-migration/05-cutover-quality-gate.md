# 05 — Quality Gate Cutover

Checklist bagian 29 prompt Git-only, diisi dengan bukti.

| # | Kriteria | Status | Bukti |
| --- | --- | --- | --- |
| 1 | Secret scan clean | LULUS | gitleaks pada CI hijau setelah redaksi; 5 temuan awal ditutup |
| 2 | Workspace baru tersedia | LULUS | `C:\opt\eBisnisGithub`, 241 berkas tracked |
| 3 | `.svn` tidak ter-copy | LULUS | `find -type d -name .svn` nol hasil |
| 4 | `.env` tidak ter-commit | LULUS | `git ls-files` nol hasil; `git check-ignore` mengonfirmasi tertutup |
| 5 | Git initialized pada workspace baru | LULUS | `git rev-parse --show-toplevel` = `C:/opt/eBisnisGithub` |
| 6 | Remote origin benar | LULUS | `https://github.com/Zishof/eBisnis.git` |
| 7 | Repository `Zishof/eBisnis` private | LULUS | `visibility: PRIVATE` |
| 8 | Initial commit berhasil | LULUS | `a463093` |
| 9 | Push main berhasil | LULUS | `main` melacak `origin/main` |
| 10 | Clone verification berhasil | LULUS | clone bersih ke `C:\opt\eBisnisGithubVerify` |
| 11 | Install berhasil | LULUS | `pnpm install --frozen-lockfile` pada clone |
| 12 | Lint/test/build berhasil | LULUS | 0 warning, 83 test, build sukses — pada clone |
| 13 | Migration status aman | LULUS | `Database schema is up to date!` |
| 14 | Database tidak berubah destruktif | LULUS | hanya perintah baca; lihat `03-database-status.md` |
| 15 | Source lama ditandai deprecated | LULUS | `C:\opt\eBisnis\README_WORKSPACE_DEPRECATED.txt` |
| 16 | Development berikutnya memakai workspace baru | BERLAKU | aturan pada `04-migration-cutover-plan.md` |
| 17 | CHANGELOG mencatat migrasi SVN ke GitHub | LULUS | `CHANGELOG.md` bagian `Changed` |

## Checklist review manusia (bagian 32)

Seluruhnya terpenuhi, dengan dua pengecualian yang dinyatakan terbuka:

| Kriteria | Status |
| --- | --- |
| Source lama diaudit | LULUS |
| Perubahan lokal SVN ikut ter-copy | LULUS — seluruh source V5/V6 unversioned ikut pindah |
| `.svn` dan `.env` tidak ter-copy | LULUS |
| Secret scan clean | LULUS setelah redaksi |
| Repo benar dan private | LULUS |
| Initial commit dan push berhasil | LULUS |
| Clone verification berhasil | LULUS |
| Build/test berhasil | LULUS |
| DB tidak di-reset, migration lama tidak diubah | LULUS |
| Source lama read-only | LULUS |
| Git status clean, branch punya upstream, HEAD dipush | LULUS |
| CHANGELOG updated | LULUS |
| GitHub Actions green | LULUS — CI, Security, Migration check |
| Tidak ada force push | LULUS — nol force push; hook `pre-push` mencegahnya |
| Release memakai tag | **belum berlaku** — belum ada rilis |
| `ebisnisctl update` memakai GitHub Release | **belum berlaku** — installer fase V7-10 |

## Yang tetap terbuka setelah cutover

| Hal | Sifat | Rujukan |
| --- | --- | --- |
| Rotasi kredensial integrasi bank | **wajib**, keputusan pemilik | `docs/development/security-incident-2026-07-30-legacy-credentials.md` |
| Kredensial pada riwayat commit `a463093` | perlu keputusan force-push | idem |
| Rotasi kredensial `.env` yang ada di SVN r104 | **wajib**, keputusan pemilik | `01-secret-scan.md` |
| Branch protection GitHub | butuh GitHub Pro | `docs/development/branch-protection.md` |
| Enam advisory `high` pada dependency produksi | butuh upgrade mayor NestJS | `docs/development/security-debt.md` |

Tidak satu pun dari lima hal di atas menghalangi dimulainya pekerjaan Versi 7,
tetapi dua yang bertanda **wajib** menyangkut kredensial yang masih hidup dan
sebaiknya diselesaikan lebih dahulu.

## Kesimpulan

Cutover **berhasil**. `C:\opt\eBisnisGithub` menjadi satu-satunya workspace
development, GitHub `Zishof/eBisnis` menjadi source of truth, dan
`C:\opt\eBisnis` menjadi arsip read-only yang tidak dihapus.
