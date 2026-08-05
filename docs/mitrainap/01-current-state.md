# 01 — Current State / Baseline Command Evidence (MI-0)

Dijalankan sungguhan di `C:\opt\eBisnisGithub-mitrainap` (worktree baru,
cabang `feature/v14-mitrainap-hospitality`, dari `origin/main`
commit `1ebc4a8`), 2026-08-06. Bukan hasil karangan — tiap baris di bawah
adalah output nyata.

## Perintah yang benar-benar tersedia di repo ini

Root `package.json` TIDAK punya skrip bernama `typecheck` (perintah master
mengasumsikan `pnpm typecheck` — skrip itu tidak ada). Skrip nyata yang
dipakai sebagai gantinya:

```text
pnpm install --frozen-lockfile   -- ADA, dipakai apa adanya
pnpm db:validate                  -- ADA (pnpm --filter @ebisnis/api db:validate)
pnpm db:generate                  -- ADA
pnpm typecheck                    -- TIDAK ADA. Diganti: tsc --noEmit -p apps/api DAN -p apps/web terpisah
pnpm lint                         -- ADA (pnpm -r lint)
pnpm test                         -- ADA (pnpm -r test)
pnpm test:e2e                     -- ADA (pnpm --filter @ebisnis/web test:e2e) -- BELUM DIJALANKAN di MI-0 ini
pnpm build                        -- ADA (pnpm -r build) -- BELUM DIJALANKAN di MI-0 ini
```

`pnpm test:e2e` dan `pnpm build` sengaja BELUM dijalankan pada pemeriksaan
awal ini (masing-masing butuh browser/waktu build yang signifikan) --
akan dijalankan sebelum PR MI-0 benar-benar di-push, dicatat di sini
sebagai kondisi yang jujur, bukan diklaim sudah lolos.

## Hasil aktual

### `pnpm install --frozen-lockfile`
**LULUS.** 1334 paket resolved, selesai ~4 menit. Tidak ada perubahan pada
`pnpm-lock.yaml` (frozen lockfile, sesuai larangan mengubah file
high-conflict tanpa koordinasi).

### `pnpm db:validate`
Awalnya GAGAL: `DATABASE_URL` tidak diset (worktree baru tidak punya
`.env`). Dibuat `apps/api/.env` LOKAL SEMENTARA (kredensial dev lokal,
`postgresql://root:root123@localhost:5433/ebisnis`, TIDAK di-commit,
TIDAK menyentuh basis data produksi -- pola yang sama dipakai sepanjang
sesi kerja pesantren sebelumnya). Setelah itu:

**LULUS.** `The schemas at prisma\platform are valid`. Prisma 6.19.3
melaporkan update mayor tersedia (7.9.1) -- tidak diupgrade (file
high-conflict, keputusan upgrade Prisma bukan wewenang worktree ini).

### `pnpm db:generate`
**LULUS.** Prisma Client ter-generate ke `node_modules/.pnpm/@prisma+client@6.19.3.../`.

### Typecheck (`tsc --noEmit`)
**LULUS**, `apps/api` dan `apps/web` keduanya bersih, tanpa error.

### `pnpm lint`
**GAGAL** -- tapi BUKAN karena MitraInap (belum ada kode MitraInap sama
sekali di titik ini). Kegagalan berasal dari `main` itu sendiri:

```text
apps/web/src/pages/app/eschool/EschoolOperationalPage.tsx:89:9
  warning  react-hooks/exhaustive-deps
ESLint found too many warnings (maximum: 0)
```

**Dicatat sebagai temuan baseline, BUKAN diperbaiki di worktree ini** --
berkas itu milik vertikal `eschool` (pendidikan formal, bukan hospitality),
memperbaikinya adalah pekerjaan sesi/worktree lain, di luar cakupan
MitraInap. Dilaporkan di sini supaya sesi berikutnya tidak bingung kenapa
`pnpm lint` di root gagal walau seluruh kode MitraInap sendiri bersih.

### `pnpm test`
**LULUS PENUH.**

```text
apps/api: 149 test suite lulus, 3960 test lulus, 0 gagal (114.9s)
apps/web: 41 berkas test lulus, 500 test lulus, 0 gagal (125.4s)
```

Catatan menarik dari log test (bukti nyata isolasi antar-vertikal sudah
berjalan): `[TenantMigrationService] Migration V044 dilewati pada
cmnmedika_inventory: tabel pesantren_unit_pendidikan tidak ada.` --
konfirmasi migrasi tenant modern sudah punya mekanisme lewati-jika-tidak-
relevan per skema, pola yang sama akan dipakai migrasi hospitality nanti.

## Vertikal yang sudah ada di platform (bukti dari kode, bukan dokumen)

Ditemukan lewat `git log`, struktur `apps/web/src/verticals/`,
`apps/web/src/pages/app/`, dan konstanta `VERTIKAL_*`:

```text
pesantren    -- paling matang, ada di apps/web/src/verticals/pesantren/**
               dan apps/web/src/pages/app/pesantren/**
emedik       -- apotek/farmasi, apps/web/src/verticals/health/**,
               EmedikLandingPage, ada Android POS terpisah
eschool      -- pendidikan formal, "vertical shell" (commit
               "feat: add eschool vertical shell" -- baru kerangka)
cooperative  -- ekoperasi, apps/web/src/verticals/cooperative/**
marketplace  -- belanja, apps/web/src/pages/belanja/**
village      -- info-desa (disebut di komentar VerticalSiteDomain,
               belum diperiksa detail)
```

Pola landing-per-vertikal (`apps/web/src/app/beranda-sesudah-masuk.ts`)
HANYA punya satu entri terdaftar: `VERTIKAL_PESANTREN = 'PESANTREN' ->
'/pesantren'`. Vertikal lain (emedik, eschool, cooperative) TIDAK
terdaftar di peta itu -- kemungkinan jatuh ke beranda bawaan, atau
memiliki mekanisme sendiri yang belum diperiksa. Perlu diverifikasi
ulang saat MI-1 (Portal Registry) sebelum menganggap pola ini sebagai
standar yang harus ditiru MitraInap apa adanya.
