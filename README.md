# eBisnis.id

Platform SaaS POS dan ERP multi-tenant: website publik ber-CMS, portal tenant,
portal platform, mesin harga langganan, dan vertical slice ERP dari Request Order
sampai validasi penerimaan barang.

## Arsitektur singkat

```
apps/api    NestJS 10 + Prisma 6 + PostgreSQL 17     — control plane + data plane
apps/web    React 18 + Vite 6 + TypeScript strict    — website publik + portal
docs        ADR, kamus data, ERD, karakterisasi legacy
scripts     smoke test end-to-end
```

Isolasi data memakai **schema-per-tenant**: control plane pada `platform` dan
`platform__audit`, setiap pendaftar mendapat `<tenant>` dan `<tenant>__audit`
tersendiri. Nama schema **hanya** berasal dari `platform.tenant_schema_registry`,
tidak pernah dari request. Lihat [ADR-001](docs/architecture/ADR-001-schema-per-tenant.md).

## Prasyarat

- Node.js ≥ 20.11
- pnpm 9.15.4 (`npm install -g pnpm@9.15.4`)
- PostgreSQL 17

## Menyiapkan lingkungan

```bash
pnpm install
```

Salin berkas contoh lalu sesuaikan. Berkas `.env` **tidak** dikomit ke SVN.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Pada mesin pengembangan ini PostgreSQL 17.2 berjalan pada **port 5433** karena
port 5432 ditempati instalasi 9.3.5 yang tidak didukung Prisma. Lihat
[ADR-005](docs/architecture/ADR-005-postgresql-port.md).

## Menjalankan

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm dev
```

`pnpm dev` menjalankan API pada <http://localhost:3000> dan web pada
<http://localhost:5173>. Server dev web mem-proxy `/api` ke API sehingga keduanya
satu origin.

- Website publik: <http://localhost:5173/> — route `/` menampilkan website, bukan
  mengarahkan ke halaman masuk.
- Swagger: <http://localhost:3000/docs>
- Health: <http://localhost:3000/health>

Mencoba tanpa mendaftar: tombol **Coba Demo** pada halaman masuk membuat sesi
sandbox `demo` dengan role `DEMO_USER`. Sesi demo tidak menyimpan refresh token,
sehingga muat ulang halaman mengakhiri sesi — ini disengaja.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `pnpm db:migrate` | Migration control plane (Prisma) |
| `pnpm db:seed` | Seed control plane + provision sandbox demo |
| `pnpm seed:verify` | Verifikasi minimum record per master; keluar dengan kode 1 bila gagal |
| `pnpm seed:repair` | Menambahkan data contoh yang kurang |
| `pnpm seed:cleanup` | Menghapus data contoh; record yang dipakai transaksi dilaporkan terblokir |
| `pnpm docs:generate` | Menghasilkan kamus data, ERD, dan katalog index dari database nyata |
| `pnpm lint` | ESLint pada API dan web, tanpa warning |
| `pnpm test` | Unit test (Jest + Vitest) |
| `pnpm build` | Build API dan web |
| `pnpm test:e2e` | Playwright, desktop dan mobile |
| `node scripts/smoke-test.mjs` | Smoke test end-to-end terhadap API yang sedang berjalan |

## Quality gate

```bash
pnpm lint && pnpm test && pnpm build
```

Verifikasi penuh memerlukan API yang berjalan:

```bash
pnpm seed:verify && node scripts/smoke-test.mjs && pnpm test:e2e
```

## Dokumentasi

### Keputusan arsitektur

Versi 5:

- [ADR-001 — Schema per tenant](docs/architecture/ADR-001-schema-per-tenant.md)
- [ADR-002 — Audit append-only](docs/architecture/ADR-002-append-only-audit.md)
- [ADR-003 — Lifecycle master](docs/architecture/ADR-003-master-lifecycle.md)
- [ADR-004 — Price waterfall](docs/architecture/ADR-004-pricing-waterfall.md)
- [ADR-005 — Port PostgreSQL](docs/architecture/ADR-005-postgresql-port.md)
- [ADR-006 — Strategi token](docs/architecture/ADR-006-token-strategy.md)

Versi 6 (keputusan sudah diambil, implementasi belum):

- [ADR-007 — Referral di control plane](docs/architecture/ADR-007-referral-control-plane.md)
- [ADR-008 — Kepemilikan effective-dated](docs/architecture/ADR-008-multi-investor-ownership.md)
- [ADR-009 — Routing tenant berbasis host](docs/architecture/ADR-009-host-based-tenant-routing.md)
- [ADR-010 — Workflow mengorkestrasi service yang sama](docs/architecture/ADR-010-workflow-orchestrates-shared-service.md)
- [ADR-011 — Accounting event engine](docs/architecture/ADR-011-accounting-event-engine.md)

### Upgrade Versi 6

- [Ikhtisar dan status fase](docs/upgrade-v6/README.md) — fase V6-0 (audit) selesai

### Database (dihasilkan otomatis)

- [Kamus data lengkap](docs/database/full-data-dictionary.md)
- [Ikhtisar ERD](docs/database/entity-relationship-overview.md)
- [Katalog index](docs/database/index-catalog.md)
- [Katalog model](docs/database/model-catalog.md)
- [Katalog seed master](docs/database/master-seed-catalog.md)
- [Pengecualian aturan minimum 10 record](docs/database/master-seed-exceptions.md)
- [Kebijakan lifecycle tabel](docs/database/table-lifecycle-policy.md)
- [Matriks referensi hapus permanen](docs/database/hard-delete-reference-matrix.md)

### Integrasi pembayaran

- [Karakterisasi legacy Esmartlink](docs/modules/billing/esmartlink-legacy-characterization.md)
- [Karakterisasi create-order](docs/modules/billing/esmartlink-create-order-characterization.md)
- [Karakterisasi inquiry](docs/modules/billing/esmartlink-inquiry-characterization.md)

### Operasional

- [Runbook operasional](docs/runbooks/operations.md)

## Catatan keamanan

- Kata sandi disimpan sebagai hash Argon2. Tidak ada kata sandi teks biasa pada
  tabel mana pun.
- Access token hanya di memory; refresh token di `sessionStorage` dan dirotasi
  setiap pemakaian, dengan pencabutan seluruh family saat terdeteksi dipakai ulang.
- Schema audit append-only; role runtime tidak memiliki UPDATE/DELETE pada audit.
- `stock_movement` immutable; koreksi memakai mutasi pembalik.
- Kondisi diskon hanya boleh menyebut field dan operator dari whitelist. `eval`,
  konstruktor `Function`, dan SQL bebas dari pengguna tidak dipakai.
- Payload sensitif dimask sebelum masuk audit atau log.
- `.env` tidak pernah dikomit ke SVN; lihat `.svnignore`.
