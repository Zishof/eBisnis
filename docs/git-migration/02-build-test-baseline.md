# 02 — Baseline Build dan Test pada Workspace Baru

Dijalankan pada `C:\opt\eBisnisGithub` setelah penyalinan dan redaksi secret,
**sebelum** `git init`. Seluruhnya hijau — tidak ada kegagalan yang perlu
didokumentasikan sebagai pengecualian.

## Hasil

| Langkah | Perintah | Hasil |
| --- | --- | --- |
| Install | `pnpm install --frozen-lockfile` | exit 0, lockfile tidak berubah |
| Prisma validate | `pnpm db:validate` | `The schemas at prisma\platform are valid` |
| Prisma generate | `pnpm db:generate` | `Generated Prisma Client (v6.19.3)` |
| Migration status | `prisma migrate status` | `Database schema is up to date!` |
| Lint | `pnpm lint` | api Done, web Done — 0 error, 0 warning |
| Test | `pnpm test` | **83 lulus** (68 Jest + 15 Vitest) |
| Build | `pnpm build` | api Done; web `built in 4.85s` |
| Smoke test | `node scripts/smoke-test.mjs` | **124 lulus / 0 gagal** |

Catatan: repository ini tidak memiliki script `typecheck` terpisah. Pemeriksaan
tipe berjalan di dalam `pnpm build` (`nest build` untuk API, `tsc -b` untuk web).

## Health check

```json
{
  "status": "ok",
  "app": "eBisnis.id",
  "version": "0.1.0",
  "environment": "development",
  "latencyMs": 31,
  "checks": {
    "database": "up",
    "tenantSchemas": 9,
    "tenantClientCache": 0,
    "tenantMigrationVersion": "V009"
  }
}
```

## Cakupan smoke test (20 bagian, 124 asersi)

| Area yang diminta prompt | Status |
| --- | --- |
| Website publik | lulus |
| Login admin (super admin platform) | lulus |
| Login tenant | lulus |
| Registration dan provisioning | lulus |
| Demo sandbox | lulus |
| CMS | lulus |
| Pricing | lulus |
| Subscription | lulus |
| Referral | **belum ada** — kapabilitas Versi 6, belum diimplementasikan |
| Investor | **belum ada** — tabel fondasi ada, service belum |
| Workflow | **belum ada** — tabel fondasi ada (V007), service belum |
| Ticketing | **belum ada** — kapabilitas Versi 7 |
| Logistics/GPS | **belum ada** — kapabilitas Versi 7 |

Lima area terakhir memang belum ada dan itu bukan kegagalan: cutover Git tidak
menambah kapabilitas apa pun. Statusnya terdokumentasi pada
`docs/upgrade-v6/02-v5-to-v6-gap-matrix.md`.

## Perbandingan dengan workspace lama

Angka identik dengan baseline pada `docs/upgrade-v6/06-test-baseline.md`
(83 unit + 124 smoke). Ini membuktikan penyalinan tidak menghilangkan atau
merusak apa pun.

Playwright E2E (56 test) tidak dijalankan ulang pada fase ini karena memerlukan
dev server web dan tidak terpengaruh oleh perpindahan workspace; hasilnya
terdokumentasi pada baseline V6-0. E2E akan dijalankan kembali pada fase V7
pertama yang menyentuh UI.

## Bukti

`docs/git-migration/evidence-build-test.txt`
