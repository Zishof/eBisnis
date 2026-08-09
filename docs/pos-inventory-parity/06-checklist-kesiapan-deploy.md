# Checklist Kesiapan Deploy & Install POS Inventory

**Tanggal:** 2026-08-09
**Perintah target:** `sudo bash /opt/ebisnis/app/deploy/update.sh`
**Kesimpulan singkat:** skrip deploy **aman & production-grade** (backup dulu, release gate, migrasi additive, rollback otomatis). Install POS Inventory + impor DBF legacy **sudah termasuk** di dalam `update.sh` (langkah 9/10). Sisa risiko satu-satunya: **release gate harus hijau** pada commit yang di-deploy.

---

## 1. Apa yang dilakukan `update.sh` (10 langkah)

1. **Backup database** → `/var/backups/ebisnis/*.dump` (pg_dump; simpan 10 terakhir). Bisa dilewati `SKIP_DB_BACKUP=1` (tidak disarankan).
2. **Ambil source** (git pull, dengan proteksi self-overwrite).
3. **Dependency + release gate + build** → `CI=true pnpm install --frozen-lockfile` (aman untuk sesi non-interaktif), `db:generate` (sebelum test agar instalasi bersih memiliki Prisma Client), `verify-migrations.mjs` (tolak edit migrasi applied/SQL destruktif), `pnpm lint`, `pnpm --filter @ebisnis/api test --runInBand`, `pnpm --filter @ebisnis/web test`, lalu `build`. **Gagal di sini → rollback.**
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

- [x] **Release gate source hijau lokal** pada reload 2026-08-09:
  ```bash
  CI=true pnpm install --frozen-lockfile
  pnpm db:generate
  pnpm lint
  pnpm --filter @ebisnis/api test --runInBand
  pnpm --filter @ebisnis/web test
  pnpm build
  ```
  API/Web lint, test penuh, dan production build lulus. Flutter analyze serta 174 functional test non-golden juga lulus. Golden tetap milik renderer Ubuntu CI.
- [ ] **Commit + push ke `main`** semua perubahan yang ingin di-deploy (server pull dari GitHub). Migrasi baru hari ini (V052–V062) harus ter-commit; jangan mengedit migrasi yang sudah applied (gate `verify-migrations` menolaknya).
- [ ] **toolchain server**: Node 22, **pnpm 9.15.4 persis** (`corepack prepare pnpm@9.15.4 --activate`), klien PostgreSQL.
- [ ] **DBF legacy tersedia di server** di `/opt/ebisnis/imports/cmn-inventory` (atau set `CMN_LEGACY_DBF_DIR`). Berkas ada di repo (`deploy/imports/cmn-inventory/*.DBF`: BELI 8.9MB, JUAL 13MB, CUSTOMER, SUPPLIER, STOK, Tran_Hut, Tran_Piut).
- [ ] **env.production** terisi (lihat §5).

## 4. Status self-test dan evidence

Patch evidence registry sudah aktif. Registry berisi **48 entri unik**, `PENDING_PROOF` kosong, dan suite kontrak paritas lulus 9/9. Evidence API/DB per layar tersedia di `docs/pos-inventory-parity/evidence/screen-01..48/`.

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

**Untuk paritas backend 48 layar:** evidence API/DB sudah 48/48. Yang masih perlu dilakukan di lingkungan target adalah UAT visual dan operasional pada Windows/Android, printer/scanner/cash drawer fisik, serta rekonsiliasi DBF produksi setelah impor.

*Catatan reload 2026-08-09: deploy server belum dijalankan. Build installer lokal juga belum dapat dilakukan karena host ini tidak memiliki Developer Mode/symlink, workload C++ lengkap, Inno Setup, dan Android SDK; gunakan workflow CI `rilis-pos.yml` yang memang memasang toolchain tersebut.*
