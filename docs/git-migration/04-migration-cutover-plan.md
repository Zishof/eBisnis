# 04 — Rencana dan Hasil Cutover SVN → GitHub

## Aturan yang berlaku sejak cutover

```text
C:\opt\eBisnisGithub\   satu-satunya workspace development aktif
GitHub Zishof/eBisnis   source of truth (private, default branch main)
C:\opt\eBisnis\         legacy read-only, tidak dipakai untuk development
SVN                     tidak lagi dipakai untuk commit, update, maupun deployment
```

Identitas versi memakai **Git commit SHA dan tag**, bukan revisi SVN. Istilah
`SVN-Revision`, `svn commit`, `SVN mirror`, dan `dual VCS` tidak lagi dipakai
pada dokumentasi baru.

## Urutan cutover

| Fase | Isi | Status |
| --- | --- | --- |
| GIT-0 | Audit workspace lama, inventaris source, laporan berkas besar | selesai |
| GIT-1 | Secret scan, klasifikasi, redaksi `BLOCKING_SECRET` | selesai |
| GIT-2 | Penyalinan aman dengan exclusion | selesai |
| GIT-3 | `.gitignore` dan `.env.example` | selesai |
| GIT-4 | Install, validate, generate, lint, test, build, smoke test | selesai, seluruhnya hijau |
| GIT-5 | Pembuatan repository private | selesai |
| GIT-6 | `git init`, commit, push | selesai |
| GIT-7 | Clone verification dan penandaan workspace lama | selesai |

## Strategi commit

Cutover dipecah menjadi commit kecil yang dapat ditinjau, bukan satu commit
raksasa:

| Commit | Isi |
| --- | --- |
| `chore: import existing eBisnis V5-V7 codebase` | seluruh source, docs, `.gitignore` |
| `docs(changelog): catat migrasi SVN ke GitHub` | `CHANGELOG.md`, `docs/git-migration/**` |
| `ci: tambahkan workflow CI, security, dan migration check` | `.github/workflows/**` |

Commit berikutnya mengikuti Conventional Commits dan aturan pada bagian 15
prompt Git-only: satu tujuan logis, menyertakan migration dan test terkait, serta
memperbarui `CHANGELOG.md` bila perubahannya user-facing.

## Siklus kerja setelah cutover

```text
1.  pastikan cwd C:\opt\eBisnisGithub
2.  git status && git pull --ff-only origin main
3.  buat branch feature/v7-<topik>
4.  implementasi incremental + migration additive
5.  seed/backfill, API/OpenAPI, Orval, UI
6.  permission, i18n, audit
7.  test + regression V5/V6
8.  update docs dan CHANGELOG.md
9.  git diff + secret scan
10. commit, push, PR/merge
11. pull main, pastikan worktree clean
```

## Yang tidak boleh terjadi

```text
force push main            git push --force
commit .env atau secret    commit node_modules/dist/coverage/log
satu commit raksasa V7     development di C:\opt\eBisnis
prisma migrate reset       perubahan pada migration yang sudah applied
```

## Penghapusan workspace lama

`C:\opt\eBisnis` **tidak dihapus**. Ia ditandai dengan
`README_WORKSPACE_DEPRECATED.txt` dan disimpan sebagai arsip. Penghapusan atau
pengarsipan memerlukan persetujuan pemilik, dan sebaiknya baru dilakukan setelah
beberapa siklus pengembangan berjalan di repository baru.

## Rollback cutover

Bila terjadi masalah, workspace lama masih utuh dan dapat dipakai kembali:
kembalikan pengembangan ke `C:\opt\eBisnis`, dan repository GitHub cukup
dibiarkan atau dihapus manual oleh pemilik. Database tidak pernah tersentuh
sehingga tidak ada yang perlu dipulihkan.

## Langkah berikutnya

Fase V7 belum boleh dimulai sebelum cutover dinyatakan lulus. Setelah lulus,
urutan implementasi mengikuti bagian 14 prompt upgrade V7, dengan catatan bahwa
empat prasyarat V6-0.x pada `docs/upgrade-v6/08-upgrade-plan.md` — guard
permission master, rekonsiliasi versi schema, generate client Orval, dan
higiene repository — masih berlaku dan sebaiknya diselesaikan lebih dahulu
karena menyangkut otorisasi dan integritas migration.
