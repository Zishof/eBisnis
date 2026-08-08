# RANGKUMAN PERINTAH — eBisnis POS Inventory (Modul Inventory-Sales)

**Dibuat:** 2026-08-08 · **Workspace:** `C:\opt\eBisnis-Github\eBisnis` (Windows) / `/opt/ebisnis/app` (server) · **DB uji lokal:** `ebisnis` / `root` / `root123`

File ini merangkum seluruh diskusi audit paritas 48 layar + langkah test & deploy. Dirancang untuk dijalankan langsung di **Claude Code** (akses file lokal). Blok instruksi siap-tempel ada di Bagian 9.

Dokumen pendukung ada di `docs/pos-inventory-parity/` (mulai dari `00-INDEX.md`).

---

## 0. Ringkasan temuan (konteks)

- **48/48 layar WIRED penuh di API**, terverifikasi di 4 controller: `MasterController`, `ErpController`, `AccountingDocumentController`, `SalesInventoryOperationsController` (registrasi di `apps/api/src/modules/tenant/tenant.module.ts:2633`).
- Kualitas kuat & disiplin: idempotency (Idempotency-Key pada settlement & jurnal), atomicity (invoice `transaction` + `SELECT..FOR UPDATE`, hanya `CONFIRMED`), `stock_movement` immutable + `posting_key`, opname state machine, **no-self-approval** harga (app + constraint DB `price_book_no_self_approval` V055), report snapshot immutable + print audit.
- Migrasi additive `V045`–`V062` (aktif dikerjakan hari ini); deploy script production-grade (backup + release gate + rollback).
- **Temuan utama (prioritas 1):** `sales-inventory-parity.catalog.spec.ts:42–47` meng-hardcode 48/48 OPERATIONAL → mengunci deklarasi, bukan bukti. Perbaikan di Bagian 6.
- **Status:** WIRED + sebagian TESTED, **belum PROVEN** (UAT/print/reconciliation per layar belum ada). Runbook pembuktian per domain sudah lengkap (`04`,`05`,`07`,`08`).

---

## 1. Commit dokumentasi audit

```bash
cd /d C:\opt\eBisnis-Github\eBisnis          # Windows cmd
# cd /opt/ebisnis/app                        # server Linux
git add docs/pos-inventory-parity/
git commit -m "docs(inventory-sales): audit paritas 48 layar, runbook PROVEN, panduan test/deploy"
```

---

## 2. Prasyarat toolchain (sekali)

```bash
node -v                                       # harus v22.x
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm -v                                       # 9.15.4
pnpm install --frozen-lockfile
```

Prasyarat DB (untuk Bagian 4+): PostgreSQL hidup, database `ebisnis` ada, role `root` punya hak CREATE.
```bash
psql -U postgres -c "CREATE DATABASE ebisnis OWNER root;"   # bila belum ada
```

---

## 3. ⭐ Uji cepat — gate statik (MULAI DI SINI, tanpa DB)

```bash
pnpm check                                    # = pnpm lint && pnpm test && pnpm build
```
Granular / saat merah:
```bash
pnpm lint
pnpm test
pnpm build
pnpm --filter @ebisnis/api test               # API saja
pnpm --filter @ebisnis/web test               # Web saja
pnpm --filter @ebisnis/api test -- sales-inventory-parity   # cek temuan self-test
```
**Hijau = aman lanjut deploy.**

---

## 4. Uji lokal berjalan (DB + API + Web)

**Windows (skrip otomatis, buat .env + migrate + seed):**
```
powershell -ExecutionPolicy Bypass -File docs\pos-inventory-parity\jalankan-lokal.ps1
```
Port Postgres 5434: `powershell -ExecutionPolicy Bypass -Command "$env:DB_PORT='5434'; & docs\pos-inventory-parity\jalankan-lokal.ps1"`

**Linux/Git Bash:** `bash docs/pos-inventory-parity/jalankan-lokal.sh`

**Manual (bila tak pakai skrip):** buat `.env` di root & `apps/api` berisi:
```
DATABASE_URL=postgresql://root:root123@localhost:5432/ebisnis?schema=platform
DIRECT_DATABASE_URL=postgresql://root:root123@localhost:5432/ebisnis?schema=platform
DATABASE_ADMIN_URL=postgresql://root:root123@localhost:5432/ebisnis
JWT_ACCESS_SECRET=<acak>
JWT_REFRESH_SECRET=<acak>
CREDENTIAL_ENCRYPTION_KEYS=prod1:<openssl rand -base64 32>
CREDENTIAL_ENCRYPTION_ACTIVE_KEY=prod1
BOOTSTRAP_SUPER_ADMIN_USERNAME=admin
BOOTSTRAP_SUPER_ADMIN_PASSWORD=admin123
PLATFORM_SCHEMA=platform
```
lalu:
```bash
pnpm db:validate && pnpm db:generate && pnpm db:deploy && pnpm migrate:tenants && pnpm seed:verify
pnpm dev                                       # API :3000 + Web :5173
```
Buka `http://localhost:5173`, login `admin` / `admin123`. Uji 48 layar via rute:
`/app/master/suppliers|customers|salespeople`, `/app/inventory/stock|stock-opnames|pricing`, `/app/purchasing/invoices|payables|reports`, `/app/sales/invoices|receivables|note-custody|receivable-reports`, `/app/finance/journals|profit-loss`.

---

## 5. Deploy server + install POS Inventory (sekaligus impor DBF)

Di server, setelah gate hijau & perubahan ter-push ke `main`:
```bash
sudo bash /opt/ebisnis/app/deploy/update.sh
```
Otomatis: backup DB → release gate → `migrate deploy` + `migrate:tenants` → restart → health check → **onboarding tenant Caruban Medika Nusantara + impor DBF legacy** (langkah 9/10) → Apache. Gagal = rollback.

Kontrol impor DBF (opsional): `CMN_LEGACY_IMPORT_ASYNC=0` (tunggu sinkron) · `CMN_SKIP_LEGACY_IMPORT=1` (lewati).
Pantau: `tail -f /var/log/ebisnis/cmn-legacy-import-*.log` · `systemctl status ebisnis-api`

---

## 6. Verifikasi pasca-deploy (data legacy masuk)

```sql
-- ganti nama schema sesuai tenant yang dibuat CLI onboarding
SELECT count(*) FROM "cmn_inventory".supplier;                        -- vs SUPPLIER.DBF
SELECT count(*) FROM "cmn_inventory".customer;                        -- vs CUSTOMER.DBF
SELECT count(*) FROM "cmn_inventory".product;                         -- vs STOK.DBF
SELECT COALESCE(sum(amount),0) FROM "cmn_inventory".legacy_payable_ledger;     -- vs Tran_Hut.DBF
SELECT COALESCE(sum(amount),0) FROM "cmn_inventory".legacy_receivable_ledger;  -- vs Tran_Piut.DBF
```

---

## 7. Patch self-test paritas (prioritas 1 — iterasi terpisah)

Detail lengkap: `docs/pos-inventory-parity/03-perbaikan-self-test-paritas.md`. Ringkas:
1. Buat `apps/api/src/modules/tenant/parity-evidence.registry.ts` (evidence registry; 48 layar mulai `PENDING_PROOF`).
2. Di `sales-inventory-parity.catalog.spec.ts`, ganti blok `expect(...operational).toBe(48)` (baris 42–47) dengan test jujur: totals konsisten + setiap OPERATIONAL harus PROVEN atau PENDING_PROOF + `PENDING_PROOF` hanya menyusut.
3. **Jalankan `pnpm --filter @ebisnis/api test` sebelum commit** (test rusak → deploy rollback).

---

## 8. UAT → PROVEN per domain (naikkan status)

Runbook lengkap (curl + SQL rekonsiliasi) per domain — urutan disarankan:
1. FINANCE 45–48 → `04-template-bukti-proven-finance.md` (paling siap)
2. Sales/AR 30–42 & Purchase/AP 20–29 → `05-...` (fokus idempotency layar 34 & atomicity layar 30)
3. Stok & Harga 8–19 → `08-...` (opname idempoten, no-self-approval)
4. Master 1–7 → `07-...` (referential guard)

Layar lulus → tambah entri `parity-evidence.registry.ts`, keluarkan dari `PENDING_PROOF`.

---

## 9. 📋 Instruksi siap-tempel untuk Claude Code (jalankan lokal)

Salin blok berikut sebagai perintah pertama di Claude Code (di dalam folder repo `C:\opt\eBisnis-Github\eBisnis`):

```text
Baca docs/pos-inventory-parity/00-INDEX.md dan seluruh dokumen di folder itu.
Bertindak sebagai engineer yang menuntaskan paritas POS Inventory tanpa rewrite.

ATURAN KESELAMATAN (wajib):
- Jangan rewrite, jangan reset/drop database, jangan edit migrasi yang sudah applied,
  jangan menimpa .env, jangan force-push. Migrasi baru harus additive/reversible.
- Commit setiap perubahan ke git dengan pesan jelas.

LANGKAH:
1. Jalankan gate statik: `pnpm install --frozen-lockfile` lalu `pnpm check`.
   Laporkan hasil lint/test/build. Bila merah, tampilkan error dan usulkan perbaikan
   minimal sebelum lanjut.
2. Bila hijau: siapkan .env lokal (DB ebisnis/root/root123, port 5432) HANYA bila
   belum ada, lalu `pnpm db:generate && pnpm db:deploy && pnpm migrate:tenants && pnpm seed:verify`.
3. Terapkan patch self-test paritas sesuai docs/pos-inventory-parity/03-*.md
   (buat parity-evidence.registry.ts + ubah catalog.spec.ts), jalankan
   `pnpm --filter @ebisnis/api test` sampai hijau, lalu commit.
4. Mulai pembuktian PROVEN domain FINANCE (layar 45–48) sesuai docs/.../04-*.md:
   nyalakan API, jalankan skenario curl + query rekonsiliasi, simpan bukti di
   docs/pos-inventory-parity/evidence/screen-45..48/, lalu daftarkan ke
   parity-evidence.registry.ts dan keluarkan dari PENDING_PROOF. Commit.
5. Berhenti dan laporkan setelah FINANCE selesai; tunggu konfirmasi untuk domain berikutnya.

Jangan berhenti pada analisis/mockup/TODO. Setiap angka dari source nyata, setiap
posting atomik, setiap retry idempotent, setiap perubahan ter-commit.
```

---

*Catatan: seluruh perintah di atas dijalankan di mesin/server Anda. Sesi cloud tempat rangkuman ini dibuat tidak mengeksekusi git/pnpm/DB Anda. Perintah `pnpm ...` diverifikasi dari `package.json` (root `ebisnis`, `pnpm@9.15.4`).*
