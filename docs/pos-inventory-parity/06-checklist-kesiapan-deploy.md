# Checklist Kesiapan Deploy & Install POS Inventory

**Tanggal:** 2026-08-08
**Perintah target:** `sudo bash /opt/ebisnis/app/deploy/update.sh`
**Kesimpulan singkat:** skrip deploy **aman & production-grade** (backup dulu, release gate, migrasi additive, rollback otomatis). Install POS Inventory + impor DBF legacy **sudah termasuk** di dalam `update.sh` (langkah 9/10). Sisa risiko satu-satunya: **release gate harus hijau** pada commit yang di-deploy.

---

## 1. Apa yang dilakukan `update.sh` (10 langkah)

1. **Backup database** → `/var/backups/ebisnis/*.dump` (pg_dump; simpan 10 terakhir). Bisa dilewati `SKIP_DB_BACKUP=1` (tidak disarankan).
2. **Ambil source** (git pull, dengan proteksi self-overwrite).
3. **Dependency + release gate + build** → `pnpm install --frozen-lockfile`, `verify-migrations.mjs` (tolak edit migrasi applied/SQL destruktif), `pnpm lint`, `pnpm --filter @ebisnis/api test --runInBand`, `pnpm --filter @ebisnis/web test`, `db:generate`, `build`. **Gagal di sini → rollback.**
4. **Migration** → `prisma migrate deploy` (additive) + `migrate:tenants` (idempoten, tolak checksum beda).
5. Restart layanan (systemd `ebisnis-api`).
6. **Health check** (gagal → rollback ke rilis + DB backup langkah 1).
7. Sandbox demo ePesantren.
8. Pelanggan pertama: Raudlatul Ulum.
9. **Pelanggan inventory: Caruban Medika Nusantara** → onboarding tenant + **impor DBF legacy POS Inventory**.
10. Apache.

Sifat aman terbukti: **tidak ada** `drop database/schema`, `migrate reset`, `db push`, `TRUNCATE`, atau force-push. `--force` hanya membangun ulang.

## 2. Yang BUKAN penghambat deploy

Enam dokumen audit di `docs/pos-inventory-parity/` dan patch self-test (`03-*`) adalah artefak **verifikasi/perencanaan**, bukan prasyarat deploy. Deploy berjalan dari **source code**, bukan dokumen. Meng-commit dokumen ini tidak memengaruhi gate.

## 3. Prasyarat WAJIB sebelum `update.sh` (server yang sudah ter-install)

- [ ] **Release gate hijau lokal dulu** (paling penting — karena tree diedit sesi aktif hari ini):
  ```bash
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm --filter @ebisnis/api test --runInBand
  pnpm --filter @ebisnis/web test
  pnpm db:generate && pnpm build
  ```
  Bila ada yang merah, `update.sh` akan **rollback** di langkah 3 — perbaiki dulu.
- [ ] **Commit + push ke `main`** semua perubahan yang ingin di-deploy (server pull dari GitHub). Migrasi baru hari ini (V052–V062) harus ter-commit; jangan mengedit migrasi yang sudah applied (gate `verify-migrations` menolaknya).
- [ ] **toolchain server**: Node 22, **pnpm 9.15.4 persis** (`corepack prepare pnpm@9.15.4 --activate`), klien PostgreSQL.
- [ ] **DBF legacy tersedia di server** di `/opt/ebisnis/imports/cmn-inventory` (atau set `CMN_LEGACY_DBF_DIR`). Berkas ada di repo (`deploy/imports/cmn-inventory/*.DBF`: BELI 8.9MB, JUAL 13MB, CUSTOMER, SUPPLIER, STOK, Tran_Hut, Tran_Piut).
- [ ] **env.production** terisi (lihat §5).

## 4. ⚠️ Catatan patch self-test (dokumen 03)

Jika Anda menerapkan patch A (tambah `parity-evidence.registry.ts` + ubah `catalog.spec.ts`) **sebelum** deploy, WAJIB jalankan `pnpm --filter @ebisnis/api test` lokal dulu. Test rusak → `update.sh` rollback di langkah 3. Jika patch **belum** diterapkan, deploy tidak terpengaruh (test lama tetap hijau). Rekomendasi: deploy dulu apa adanya untuk uji server, terapkan patch A pada iterasi terpisah.

## 5. Variabel env wajib (`/opt/ebisnis/app/.env` produksi)

Kritis (tanpa ini API/deploy gagal):

- `DATABASE_URL`, `DIRECT_DATABASE_URL`, `DATABASE_ADMIN_URL`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (isi acak kuat)
- `BOOTSTRAP_SUPER_ADMIN_PASSWORD` (kosong → super admin tak dibuat)
- `CREDENTIAL_ENCRYPTION_KEYS=prod1:<openssl rand -base64 32>`, `CREDENTIAL_ENCRYPTION_ACTIVE_KEY=prod1`
- `CORS_ORIGINS`, `APP_URL`, `WEB_URL`

`install.sh` (server baru) membuat file env dari `env.production.example` bila belum ada dan **tidak menimpanya** bila sudah ada.

## 6. Kontrol impor DBF POS Inventory (langkah 9/10)

- Default `CMN_LEGACY_IMPORT_ASYNC=1` → tenant siap cepat, DBF besar impor di **background** (`tail -f /var/log/ebisnis/cmn-legacy-import-*.log`).
- `CMN_LEGACY_IMPORT_ASYNC=0` → tunggu impor selesai sinkron.
- `CMN_SKIP_LEGACY_IMPORT=1` → lewati impor DBF (tenant tetap dibuat).
- Idempoten: marker `CMN_LEGACY_IMPORT_V2` mencegah impor ganda.

## 7. Verifikasi pasca-deploy (bukti nyata POS Inventory hidup)

Setelah `update.sh` sukses:

- [ ] `systemctl status ebisnis-api` aktif; health check langkah 6 lulus.
- [ ] Login super admin; buka tenant `cmnmedika-inventory.ebisnis.id`.
- [ ] Cek data legacy masuk (jalankan rekonsiliasi dari runbook `04-*`/`05-*`):
  ```sql
  SELECT count(*) FROM "cmn_inventory".supplier;      -- vs SUPPLIER.DBF
  SELECT count(*) FROM "cmn_inventory".customer;       -- vs CUSTOMER.DBF
  SELECT count(*) FROM "cmn_inventory".product;        -- vs STOK.DBF
  SELECT sum(amount) FROM "cmn_inventory".legacy_payable_ledger;    -- vs Tran_Hut.DBF
  SELECT sum(amount) FROM "cmn_inventory".legacy_receivable_ledger; -- vs Tran_Piut.DBF
  ```
  (nama schema tenant sesuaikan dengan yang dibuat CLI onboarding.)
- [ ] Buka 48 layar dari `/app/master/*`, `/app/inventory/*`, `/app/purchasing/*`, `/app/sales/*`, `/app/finance/*` — pastikan angka muncul dari data legacy nyata.

---

## Ringkasan "apa lagi yang belum"

**Untuk deploy & install POS Inventory:** tidak ada penghambat dari sisi skrip — aman. Yang perlu Anda pastikan hanya: (1) release gate hijau lokal, (2) perubahan ter-commit & ter-push, (3) env terisi, (4) DBF ada di server. Setelah itu `sudo bash /opt/ebisnis/app/deploy/update.sh` boleh dijalankan.

**Untuk paritas 100% PROVEN** (di luar sekadar deploy jalan): masih perlu bukti UAT/reconciliation aktual per layar (template FINANCE, Purchase/AP, Sales/AR sudah ada; Master 1–7 & Stock/Price 8–19 belum), perbaikan self-test paritas, dan rekonsiliasi dokumentasi.

*Catatan: saya tidak menjalankan deploy atau baseline dari sesi ini — server tidak terjangkau dari lingkungan cloud, dan repo penuh tidak ada di sini. Penilaian di atas berbasis pembacaan skrip aktual.*
