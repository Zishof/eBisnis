# 00 — Inventaris Kondisi Saat Ini

> Fase V6-0. Dokumen ini merekam kondisi workspace `C:\opt\eBisnis` **sebelum**
> perubahan apa pun untuk Versi 6. Seluruh angka dibuktikan oleh perintah yang
> keluarannya tersimpan pada `evidence/`.

## Ringkasan satu paragraf

Workspace berisi implementasi Versi 5 yang **berjalan dan lulus seluruh quality
gate-nya sendiri**: 157 endpoint API, 51 route UI, 136 model Prisma control plane,
9 migration tenant kanonik yang sudah diterapkan pada 10 schema, 83 unit test,
124 asersi smoke test, dan 56 test Playwright — semuanya hijau pada baseline
2026-07-30. Yang belum ada sama sekali adalah keenam area Versi 6: referral,
multi-investor, tenant website/custom domain, workflow/SOP generik, enterprise
accounting, dan modul ERP tambahan. Temuan paling serius bukan pada fungsi
aplikasi, melainkan pada **higiene repository SVN**: `apps/api/.env` beserta
kredensial dan `apps/api/node_modules/**` sudah ter-commit, sementara hampir
seluruh source V5 justru belum diversi.

## Perangkat

| Alat | Versi | Catatan |
| --- | --- | --- |
| Node.js | v22.17.0 | memenuhi `engines >= 20.11.0` |
| pnpm | 9.15.4 | sesuai `packageManager` |
| Subversion | 1.14.2-SlikSvn | working copy valid |
| PostgreSQL server | 17.2 port 5433 | lihat ADR-005 |
| `psql` / `pg_dump` pada PATH | 9.3.5 | **tidak kompatibel**; pakai `C:\Program Files\PostgreSQL\17\bin` |
| npx | 11.4.2 | |

## Struktur workspace

```text
C:\opt\eBisnis\
├── apps\api\           NestJS 10 + Prisma 6 (67 file .ts, 3 .spec.ts)
├── apps\web\           React 18 + Vite 6 (46 file .ts/.tsx, 3 .spec.ts e2e)
├── docs\
│   ├── architecture\   6 ADR
│   ├── database\       8 dokumen hasil generate
│   ├── modules\        3 karakterisasi Esmartlink
│   ├── runbooks\       1 runbook operasional
│   ├── input\          5 source legacy + 2 PDF + 1 struktur menu
│   └── upgrade-v6\     dokumen fase ini
├── scripts\            smoke-test.mjs
├── package.json        workspace pnpm
└── pnpm-workspace.yaml apps/*, packages/*
```

`packages/*` dideklarasikan pada workspace tetapi direktorinya belum ada
(`Scope: 2 of 3 workspace projects`). Bukan masalah; disediakan untuk shared
package di masa depan.

## Volume source

| Metrik | Jumlah |
| --- | --- |
| File TypeScript API | 67 |
| Spec Jest API | 3 (68 test) |
| File TypeScript/TSX web | 46 |
| Spec Playwright | 3 (56 test × 2 project) |
| Spec Vitest web | 2 (15 test) |
| Berkas schema Prisma | 11 (136 model, 60 enum) |
| Migration tenant SQL | 9 (V001–V009) |
| Migration platform Prisma | 1 (`20260730053842_init_ebisnis_platform`) |
| Dokumen markdown | 19 |

## Kondisi SVN

| Atribut | Nilai |
| --- | --- |
| Repository Root | `svn://38.47.178.34/pos` |
| URL | `svn://38.47.178.34/pos/eBisnis` |
| Repository UUID | `0a6fe329-0a23-41ef-b204-d71cfcd7d950` |
| Revisi working copy | 103 |
| Revisi repository | 104 |
| Author terakhir | fauzi |
| Path versioned di repo | 104 (≈70 di antaranya `node_modules`) |
| `svn status` | 54 unversioned (`?`), 1 obstruction (`~`) |
| Conflict | tidak ada |
| Missing file | tidak ada |
| Switched path | tidak ada |
| External definition | tidak ada |

### Temuan V6-0-B01 — `.env` beserta kredensial ter-commit ke SVN

**Severity: KRITIS (keamanan).**

`svn list -R svn://38.47.178.34/pos/eBisnis` mengembalikan `apps/api/.env`.
Berkas tersebut memuat:

```text
DATABASE_URL           berisi user dan kata sandi database
DATABASE_ADMIN_URL     berisi user dan kata sandi database
JWT_ACCESS_SECRET      secret penandatangan token akses
JWT_REFRESH_SECRET     secret penandatangan refresh token
BOOTSTRAP_SUPER_ADMIN_PASSWORD  kata sandi awal super admin
```

Ini melanggar larangan eksplisit pada Master Prompt V5 dan V6 serta prompt
upgrade bagian 3.3 ("Jangan memasukkan secret ke SVN") dan bagian 19
("Jangan commit: .env").

Rantai penyebab yang terbukti: **tidak ada properti `svn:ignore` sama sekali**.
`svn propget svn:ignore .` mengembalikan `W200017: Property 'svn:ignore' not found`,
demikian pula pada `apps/api`. Berkas `.svnignore` di root hanyalah berkas teks
biasa; Subversion tidak pernah membacanya. Jadi pola ignore yang tertulis di sana
tidak pernah berlaku.

Perbaikan **tidak** dilakukan pada fase ini karena menghapus berkas dari
repository dan merotasi kredensial adalah tindakan outward-facing yang
memerlukan keputusan pemilik. Rencana tercatat pada
[09-svn-change-plan.md](09-svn-change-plan.md).

### Temuan V6-0-B02 — `node_modules` ter-commit dan menimbulkan obstruction

**Severity: TINGGI (higiene, memblokir commit).**

Dari 104 path versioned, sekitar 70 berada di bawah `apps/api/node_modules/`.
Akibatnya `svn status` melaporkan:

```text
~M      apps\api\node_modules\@nestjs\cli
```

`~` berarti objek versioned terhalang oleh objek berjenis berbeda di disk —
SVN mengharapkan sesuatu yang berbeda dari yang dibuat pnpm di sana. Selama
kondisi ini ada, `svn commit` pada path tersebut tidak dapat diandalkan.

### Temuan V6-0-B03 — hampir seluruh implementasi V5 belum diversi

**Severity: TINGGI (risiko kehilangan pekerjaan).**

Yang **sudah** ada di repository: `.editorconfig`, `.svnignore`,
`MASTER_PROMPT_EBISNIS_V5.md`, `package.json`, `pnpm-workspace.yaml`,
`apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`,
`apps/api/jest.config.js`, `apps/api/.eslintrc.cjs`, 11 berkas
`apps/api/prisma/platform/*.prisma`, `docs/input/**`, dan (secara salah)
`.env` + `node_modules`.

Yang **belum** ada di repository:

```text
apps/api/src/**                          67 file, seluruh backend
apps/api/tenant-migrations/**            9 migration + manifest
apps/api/prisma/platform/migrations/**   migration platform yang sudah diterapkan
apps/api/prisma/seed.ts
apps/api/prisma.config.ts
apps/api/tsconfig.build.json
apps/api/tsconfig.spec.json
apps/web/**                              seluruh frontend
scripts/**                               smoke-test.mjs
docs/architecture/**                     6 ADR
docs/database/**                         8 dokumen
docs/modules/**                          3 karakterisasi
docs/runbooks/**                         1 runbook
README.md
pnpm-lock.yaml
```

Ini berarti seluruh source V5 hanya ada di disk lokal. Prompt upgrade bagian 20
meminta commit per fase yang lulus; commit pertama yang perlu dilakukan adalah
**membawa V5 masuk ke repository** — mendahului commit V6 apa pun.

## Kondisi database

Ringkas: 23 schema, 1.357 tabel, 10 tenant (1 `demo` + 9 artefak uji).
Detail pada [03-database-migration-inventory.md](03-database-migration-inventory.md).

Backup pra-V6 sudah dibuat dan diverifikasi:
`C:\opt\eBisnis-backup\ebisnis-before-v6-20260730-193212.dump` (10.782 objek).

## Baseline quality gate

Seluruh gate dijalankan pada 2026-07-30 dan **semuanya lulus**. Tidak ada
kegagalan baseline yang perlu dipisahkan dari kegagalan perubahan V6.

| Gate | Perintah | Hasil |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | OK, lockfile up to date |
| Prisma validate | `pnpm db:validate` | OK |
| Prisma generate | `pnpm db:generate` | OK |
| Lint | `pnpm lint` | OK, 0 warning (api + web) |
| Unit test | `pnpm test` | 83 lulus (68 Jest + 15 Vitest) |
| Build | `pnpm build` | OK (api + web) |
| Seed verify | `pnpm seed:verify` | LULUS (platform 25/25, demo 22/22) |
| Smoke test | `node scripts/smoke-test.mjs` | 124/124 |
| E2E | `playwright test` | 56/56 (desktop + mobile) |

Evidence: `evidence/baseline-01-install-db.txt` sampai
`evidence/baseline-05-e2e.txt`.

## Proses yang berjalan saat audit

| Proses | Port | Keperluan |
| --- | --- | --- |
| API (`node dist/main.js`) | 3000 | smoke test, OpenAPI, verifikasi manual |
| Vite dev server | 5173 | Playwright |

Keduanya perlu dihentikan sebelum rebuild agar port tidak bentrok.
