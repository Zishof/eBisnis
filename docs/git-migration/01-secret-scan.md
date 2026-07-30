# 01 — Secret Scan Sebelum Push Pertama

- Tanggal: 2026-07-30
- Cakupan: seluruh berkas pada `C:\opt\eBisnisGithub` yang akan masuk Git
- Laporan pra-penyalinan: `C:\opt\eBisnisGitMigrationReport\03-secret-scan-before.md`

## Keterbatasan alat

| Alat | Status |
| --- | --- |
| `gitleaks` | tidak tersedia pada mesin ini |
| `trufflehog` | tidak tersedia pada mesin ini |

Pemindaian dilakukan manual berbasis pola. Keterbatasannya nyata dan harus
disadari: deteksi pola tidak menangkap secret dengan format tidak lazim, dan
tidak ada verifikasi apakah kredensial masih aktif.

**Mitigasi wajib:** pasang `gitleaks` pada `.github/workflows/security.yml`
sehingga setiap push dipindai otomatis oleh alat yang sesungguhnya.

## Temuan yang diperbaiki sebelum commit pertama

Empat temuan berklasifikasi `BLOCKING_SECRET` diredaksi pada workspace baru.
Workspace lama sengaja **tidak** diubah agar tetap utuh sebagai arsip.

| # | Berkas | Sebelum | Sesudah |
| --- | --- | --- | --- |
| S-03 | `docs/architecture/ADR-005-postgresql-port.md` | connection string dengan kata sandi asli | `postgresql://USER:PASSWORD@localhost:5433/...` |
| S-04 | `docs/architecture/ADR-005-postgresql-port.md` | kalimat menyebut kredensial asli | rujukan ke `apps/api/.env` tanpa nilai |
| S-05 | `MASTER_PROMPT_EBISNIS_V5.md` | ±20 kemunculan kata sandi database dan super admin | `USER:PASSWORD`, `<PASSWORD>`, `<BOOTSTRAP_PASSWORD>`, `"$PGPASSWORD"` |
| S-06 | `apps/api/src/modules/auth/auth.controller.ts:26` | contoh Swagger memakai kata sandi bootstrap asli | `ContohKataSandi#2026` |

Satu perbaikan tambahan di luar daftar semula:

| Berkas | Perubahan |
| --- | --- |
| `scripts/smoke-test.mjs` | kata sandi super admin tidak lagi di-hardcode; dibaca dari `SMOKE_ADMIN_PASSWORD` atau `BOOTSTRAP_SUPER_ADMIN_PASSWORD`, dan bagian super admin dilewati bila tidak disetel |

## Verifikasi akhir

Pencarian dijalankan terhadap seluruh berkas tracked, memakai pola untuk:

- nilai kata sandi database dan super admin pengembangan (nilai nyatanya
  sengaja tidak dituliskan di sini);
- connection string yang memuat kata sandi:
  `postgres(ql)?://[^"'\s]*:[^"'@\s]+@`;
- blok `BEGIN ... PRIVATE KEY`;
- token GitHub: `gh[pousr]_[A-Za-z0-9]{20,}`;
- berkas bernama tepat `.env`.

Hasil: nol kecocokan, selain placeholder `USER:PASSWORD` dan kredensial palsu
`ci:ci` pada workflow CI yang tidak pernah terhubung ke database mana pun.

| Pemeriksaan | Hasil |
| --- | --- |
| `.env` pada workspace baru | ada secara lokal, **tertutup `.gitignore`**, tidak pernah di-stage |
| `.env.example` | hanya placeholder |
| private key / sertifikat / keystore | tidak ada |
| dump database | tidak ada (berada di luar workspace) |
| data pelanggan / export data pribadi | tidak ada |
| token GitHub pada source | tidak ada |

## Risiko warisan yang TIDAK selesai dengan migrasi ini

`apps/api/.env` sudah ter-commit ke SVN pada revisi 104 beserta kata sandi
PostgreSQL, dua JWT secret, dan kata sandi super admin. Repository Git yang baru
bersih, tetapi riwayat SVN tetap memuatnya dan dapat diambil dengan
`svn cat -r 104 apps/api/.env`.

Tindakan yang memerlukan keputusan pemilik:

1. rotasi kata sandi PostgreSQL, kedua JWT secret, dan kata sandi super admin
   (rotasi JWT akan mencabut seluruh sesi aktif — memang itu tujuannya);
2. batasi atau cabut akses baca `svn://38.47.178.34/pos/eBisnis`;
3. bila kerahasiaan riwayat penting, bersihkan riwayat pada server SVN.
