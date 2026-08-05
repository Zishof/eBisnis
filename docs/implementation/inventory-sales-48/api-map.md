# API Map

API yang sudah menjadi fondasi:

- `GET/POST/PATCH /suppliers`, `/customers`, `/salespeople`
- `POST /:master/:id/activate`, `POST /:master/:id/deactivate`,
  `GET /:master/:id/audit`
- `GET /inventory/party-master-balances/:kind`
- `/inventory/master-data`, `/inventory/balances`, `/inventory/mobile-catalog`
- `/inventory/legacy/receivables`, `/inventory/legacy/payables`
- `/inventory/legacy/price-history`, `/inventory/legacy/stock-opname`
- `/stock-opnames`, `/inventory/price-books`
- `/ap/payments`, `/ar/receipts`, `/sales-note-handovers`
- `/inventory/finance-workspace`, `/inventory/journals`, `/inventory/fiscal-periods`
- `/reports/:code/preview`, `/reports/:code/snapshot`, `/report-snapshots/:id`
- `/sync/bootstrap`, `/sync/pull`, `/sync/status`, `/sync/conflicts`

Semua command uang dan posting memakai transaksi server, idempotency/correlation
ID, permission, serta audit. Endpoint tambahan per wave harus memperluas kontrak
ini, bukan membuat API paralel untuk Web dan Flutter.
