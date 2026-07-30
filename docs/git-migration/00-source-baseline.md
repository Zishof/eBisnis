# 00 — Baseline Source Saat Migrasi ke Git

- Tanggal cutover: 2026-07-30
- Sumber: `C:\opt\eBisnis` (legacy, tetap utuh)
- Tujuan: `C:\opt\eBisnisGithub` (workspace aktif)
- Repository: `Zishof/eBisnis` (private)

## Kondisi source yang dipindahkan

Implementasi Versi 5 lengkap dan berjalan, ditambah audit Versi 6 fase V6-0.
Kapabilitas Versi 6 dan Versi 7 belum diimplementasikan.

| Metrik | Jumlah |
| --- | --- |
| Berkas tersalin | 228 |
| TypeScript API | 67 |
| TypeScript/TSX web | 46 |
| Spec Jest | 3 (68 test) |
| Spec Vitest | 2 (15 test) |
| Spec Playwright | 3 (28 test × 2 project) |
| Schema Prisma | 11 (136 model, 60 enum) |
| Migration tenant SQL | 9 (V001–V009) |
| Migration platform | 1 |
| Dokumen markdown | 44 |

## Struktur

```text
C:\opt\eBisnisGithub\
├── apps\api\             NestJS 10 + Prisma 6, port 3000
├── apps\web\             React 18 + Vite 6, port 5173
├── docs\
│   ├── architecture\     ADR-001 s.d. ADR-011
│   ├── database\         kamus data, ERD, katalog index
│   ├── development\      kebijakan berkas hasil generate
│   ├── git-migration\    dokumen fase ini
│   ├── input\            source legacy referensi
│   ├── modules\          karakterisasi Esmartlink
│   ├── runbooks\         runbook operasional
│   └── upgrade-v6\       audit V6-0
├── scripts\              smoke-test.mjs
├── CHANGELOG.md
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

## Yang sengaja tidak ikut

`.svn/`, `node_modules/`, `dist/`, `.env`, `*.tsbuildinfo`, `playwright-report/`,
`test-results/`, `*.dump`, `*.log`, private key, dan sertifikat. Verifikasi
pasca-penyalinan membuktikan tidak satu pun di antaranya berada pada workspace
baru.

Backup database berada di `C:\opt\eBisnis-backup\`, di luar kedua workspace,
sehingga tidak mungkin ikut ter-commit.

## Perubahan lokal yang ikut pindah

Seluruh source Versi 5 dan Versi 6 **tidak pernah ter-commit ke SVN** —
statusnya `?` (unversioned) atau `A` (scheduled for add). Karena itu penyalinan
dilakukan dari disk memakai `robocopy`, bukan `svn export`, sehingga tidak ada
pekerjaan yang hilang.

## Perangkat

| Alat | Versi |
| --- | --- |
| Node.js | v22.17.0 |
| pnpm | 9.15.4 |
| Git | 2.54.0.windows.1 |
| GitHub CLI | 2.96.0 |
| PostgreSQL server | 17.2 (port 5433) |

Catatan: `psql`/`pg_dump` pada PATH adalah versi 9.3.5 dan tidak dapat terhubung
ke server 17.2. Gunakan binary pada `C:\Program Files\PostgreSQL\17\bin`.
