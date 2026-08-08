# Langkah Testing — Mulai dari Mana

**Tanggal:** 2026-08-08
**Perintah di bawah nyata dari `package.json`** (root name `ebisnis`, `packageManager: pnpm@9.15.4`).
Ada 5 tingkat, dari paling cepat/aman ke paling lengkap. **Mulai dari Tingkat 1.**

---

## Tingkat 0 — Prasyarat (sekali saja)

Di mesin yang memuat repo (dev Windows `C:\opt\eBisnis-Github\eBisnis`, atau server `/opt/ebisnis/app`):

```bash
node -v          # harus v22.x
corepack enable && corepack prepare pnpm@9.15.4 --activate
pnpm -v          # harus 9.15.4
pnpm install --frozen-lockfile
```

Untuk tingkat yang menjalankan API/DB (Tingkat 2+): PostgreSQL hidup + file `.env` terisi (`DATABASE_URL`, `DIRECT_DATABASE_URL`, `DATABASE_ADMIN_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CREDENTIAL_ENCRYPTION_KEYS`). Contoh: `deploy/env.production.example`.

---

## ⭐ Tingkat 1 — Gate statik (MULAI DI SINI — cepat, tanpa DB)

Satu perintah, sama persis dengan yang dijalankan skrip deploy sebelum menyentuh server:

```bash
pnpm check          # = pnpm lint && pnpm test && pnpm build
```

Kalau **hijau**, aman lanjut deploy. Kalau ingin bertahap / mempersempit saat merah:

```bash
pnpm lint                                   # eslint semua paket (0 warning)
pnpm test                                   # unit test semua paket (jest api + vitest web)
pnpm build                                  # build api + web
pnpm --filter @ebisnis/api test             # test API saja
pnpm --filter @ebisnis/web test             # test Web saja
```

Cek langsung temuan audit paritas (test yang meng-hardcode 48/48):

```bash
pnpm --filter @ebisnis/api test -- sales-inventory-parity
```

**Kriteria lulus:** exit code 0, tidak ada test merah, build sukses. Simpan output sebagai bukti baseline.

---

## Tingkat 2 — Jalan lokal (DB + API + Web hidup)

Siapkan schema & data, lalu nyalakan:

```bash
pnpm db:validate         # validasi schema prisma
pnpm db:generate         # generate prisma client
pnpm db:deploy           # terapkan migration platform (additive)
pnpm migrate:tenants     # terapkan migration ke semua tenant
pnpm seed:verify         # verifikasi seed/konsistensi
pnpm dev                 # nyalakan API (:3000) + Web (:5173) bersamaan
```

Lalu di browser buka Web (default Vite `http://localhost:5173`), login, dan **uji 48 layar** lewat rute:
`/app/master/suppliers`, `/app/master/customers`, `/app/master/salespeople`, `/app/inventory/stock`, `/app/inventory/stock-opnames`, `/app/inventory/pricing`, `/app/purchasing/invoices`, `/app/purchasing/payables`, `/app/purchasing/reports`, `/app/sales/invoices`, `/app/sales/receivables`, `/app/sales/note-custody`, `/app/sales/receivable-reports`, `/app/finance/journals`, `/app/finance/profit-loss`.

Menyalakan terpisah bila perlu: `pnpm dev:api` dan `pnpm dev:web`.

---

## Tingkat 3 — End-to-end (Web, Playwright)

```bash
pnpm --filter @ebisnis/web test:e2e:install    # sekali: unduh browser chromium
pnpm test:e2e                                   # jalankan e2e web
```

---

## Tingkat 4 — Deploy uji ke server + smoke (sekaligus install POS Inventory)

Di server (setelah Tingkat 1 hijau & perubahan ter-commit/push ke `main`):

```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```

Skrip ini otomatis: backup DB → release gate (lint+test+build) → `migrate deploy` + `migrate:tenants` → restart → health check → **onboarding tenant Caruban Medika Nusantara + impor DBF legacy** (langkah 9/10) → Apache. Gagal di tahap mana pun = **rollback**.

Pantau impor DBF (jalan di background):
```bash
tail -f /var/log/ebisnis/cmn-legacy-import-*.log
systemctl status ebisnis-api
```

Verifikasi pasca-deploy — data legacy benar-benar masuk:
```sql
-- ganti nama schema sesuai tenant yang dibuat CLI onboarding
SELECT count(*) FROM "cmn_inventory".supplier;                       -- vs SUPPLIER.DBF
SELECT count(*) FROM "cmn_inventory".customer;                       -- vs CUSTOMER.DBF
SELECT count(*) FROM "cmn_inventory".product;                        -- vs STOK.DBF
SELECT COALESCE(sum(amount),0) FROM "cmn_inventory".legacy_payable_ledger;    -- vs Tran_Hut.DBF
SELECT COALESCE(sum(amount),0) FROM "cmn_inventory".legacy_receivable_ledger; -- vs Tran_Piut.DBF
```
Lalu login ke `cmnmedika-inventory.ebisnis.id` dan buka 48 layar — pastikan angka muncul dari data legacy nyata.

---

## Tingkat 5 — UAT/PROVEN per layar (naikkan status jadi terbukti)

Jalankan runbook per domain (curl + SQL rekonsiliasi) terhadap tenant uji. Urutan disarankan (paling siap → paling berisiko lebih dulu di tiap domain):

1. FINANCE 45–48 → dokumen `04-template-bukti-proven-finance.md`
2. Sales/AR 30–42 & Purchase/AP 20–29 → `05-...` (fokus idempotency layar 34 & atomicity layar 30)
3. Stok & Harga 8–19 → `08-...` (opname idempoten, no-self-approval harga)
4. Master 1–7 → `07-...` (referential guard)

Setiap layar yang lulus → tambahkan entri ke `parity-evidence.registry.ts` dan keluarkan dari `PENDING_PROOF` (lihat `03-perbaikan-self-test-paritas.md`).

---

## Ringkas: "dari mana?"

1. **Ketik `pnpm check`** di folder repo. Ini titik mulai — cepat, tanpa DB, dan sama dengan gate deploy.
2. Hijau → **`sudo bash /opt/ebisnis/app/deploy/update.sh`** di server (deploy + install POS Inventory + impor DBF sekaligus).
3. Verifikasi data legacy masuk (query §Tingkat 4) dan buka 48 layar.
4. Untuk membuktikan tiap layar (PROVEN), jalankan runbook mulai FINANCE.

*Catatan: perintah di atas tidak saya jalankan dari sesi cloud ini (server & repo penuh tak terjangkau) — semuanya untuk Anda jalankan di mesin/server Anda.*
