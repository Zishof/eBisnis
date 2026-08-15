# MI-0 — Keadaan aktual

## Baseline

- Monorepo pnpm: NestJS/Prisma/PostgreSQL API, React/Vite Web, Flutter POS, dan Flutter gerbang pesantren.
- Worktree terpisah bersih dibuat pada `C:\opt\eBisnisGithub-mitrainap`.
- `mitrainap`, `hospitality`, hotel reservation, folio, dan night audit belum ada sebagai domain/module/vertical.
- Control plane telah memiliki tenant, schema registry, portal, domain, CMS, pricing, billing, entitlement, payment, observability, dan audit.
- Data plane memakai migration tenant ber-manifest dan schema per tenant.

## Database lokal

Audit read-only ke `ebisnis` pada PostgreSQL 16.4 port 5432 sebagai user `root`: 28 migration platform selesai, schema `platform`, `demo`, beberapa tenant/UAT, dan schema audit tersedia. Tidak ada tabel Hospitality. Hasil pencarian yang mirip hanya `health_room`, `stock_reservation`, `marketplace_stock_reservation`, dan `schema_name_reservation`; semuanya bukan model hotel.

## Kesimpulan

Status MI-0 adalah **FOUNDATION_REUSABLE / HOSPITALITY_MISSING**. Strategi yang benar: extend registry dan shared services, membuat bounded context `hospitality`, serta memakai adapter untuk POS/payment/accounting/channel/provider. Dilarang membuat auth, CMS, billing, POS, notification, audit, atau AI gateway kedua.
