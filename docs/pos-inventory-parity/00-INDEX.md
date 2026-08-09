# Audit Paritas POS Inventory 48 Layar — Indeks

**Sesi awal:** 2026-08-08 · **Reload terakhir:** 2026-08-09 · **Modul:** eBisnis Inventory-Sales · **Workspace:** `C:\opt\eBisnis-Github\eBisnis`

Dokumen ini adalah pintu masuk seluruh hasil audit sesi. Semua berbasis pembacaan source aktual (bukan asumsi paket perintah).

## Daftar dokumen

| # | File | Isi |
|---|---|---|
| 00 | `00-INDEX.md` | Dokumen ini — indeks & dashboard status |
| 01 | `00-analisis-sesi-inventory-sales.md` | Analisis awal: arsitektur, temuan, rekomendasi |
| 02 | `01-requirement-ledger-48-layar.md` | Ledger 48 layar berbukti + temuan self-test |
| 03 | `02-peta-controller-endpoint.md` | Peta 4 controller → endpoint (penutup celah) |
| 04 | `03-perbaikan-self-test-paritas.md` | Patch: evidence registry + honesty test |
| 05 | `04-template-bukti-proven-finance.md` | Runbook PROVEN FINANCE (45–48) |
| 06 | `05-template-bukti-proven-purchase-ap-sales-ar.md` | Runbook PROVEN Purchase/AP (20–29) & Sales/AR (30–42) |
| 07 | `06-checklist-kesiapan-deploy.md` | Kesiapan deploy `update.sh` + install POS Inventory |
| 08 | `07-template-bukti-proven-master.md` | Runbook PROVEN Master (1–7) |
| 09 | `08-template-bukti-proven-stock-price.md` | Runbook PROVEN Stok & Harga (8–19) |

## Dashboard status modul Inventory-Sales

| Domain | Layar | API WIRED | Runbook PROVEN | PROVEN aktual |
|---|---|:--:|:--:|:--:|
| Master | 1–7 | ✅ (MasterController + registry) | ✅ (07) | ✅ API/DB UAT 7/7 |
| Stok & Harga | 8–19 | ✅ (ErpController + SalesInvOps) | ✅ (08) | ✅ API/DB UAT 12/12 |
| Purchase/AP | 20–29 | ✅ (ErpController + SalesInvOps) | ✅ (06) | ✅ API/DB UAT 10/10 |
| Sales/AR | 30–42 | ✅ (ErpController + SalesInvOps) | ✅ (06) | ✅ API/DB UAT 13/13 |
| Finance | 43–48 | ✅ (SalesInvOps + AccountingDoc) | ✅ (05) | ✅ API/DB UAT 6/6 |

**Ringkas:** 48/48 layar **WIRED dan mempunyai evidence API/DB UAT**. Registry berisi 48 nomor unik dan `PENDING_PROOF` kosong. Bukti per layar berada di `evidence/screen-01` sampai `screen-48`. Status ini membuktikan operasi backend terhadap PostgreSQL lokal; ia tidak menggantikan bukti printer/perangkat fisik atau perbandingan visual lintas-OS.

## Temuan utama (harus ditindak)

1. **Bukti perangkat fisik belum tersedia**: printer, scanner, cash drawer, dan Android nyata tetap harus diperiksa saat UAT lokasi.
2. **Golden Flutter dibuat di Ubuntu CI**. Functional test Windows lulus, tetapi perbandingan pixel golden tidak boleh diregenerasi dari Windows karena perbedaan renderer.
3. **Toolchain build lokal Windows belum lengkap**: Developer Mode/symlink, workload C++, Inno Setup, dan Android SDK tidak tersedia. Workflow `rilis-pos.yml` tetap menjadi jalur build resmi.
4. **File Flutter besar** `inventory_app.dart` masih layak dipecah feature-by-feature; perubahan ini bukan syarat deploy dan tidak boleh dilakukan sebagai rewrite besar.

## Kualitas implementasi yang terverifikasi (kuat)

Idempotency (Idempotency-Key pada settlement & jurnal), atomicity (invoice `transaction` + `FOR UPDATE`, hanya `CONFIRMED`), stock_movement immutable + posting_key, opname state machine, no-self-approval harga (app + constraint DB V055), report snapshot immutable + print audit, migrasi additive V045–V062 (aktif hari ini), deploy script production-grade dengan backup + rollback.

## Langkah berikutnya (urutan disarankan)

1. Commit dan push hanya perubahan yang sudah direview; worktree sesi ini belum otomatis di-commit.
2. Jalankan workflow `rilis-pos.yml` untuk build Windows/Android pada toolchain CI yang lengkap.
3. Deploy server: `sudo bash /opt/ebisnis/app/deploy/update.sh` → dokumen 07.
4. Verifikasi pasca-deploy, impor legacy, domain publik, serta perangkat fisik → dokumen 07 §7.
5. Catat hasil UAT lokasi sebagai pelengkap evidence API/DB yang sudah 48/48.

*Validasi reload 2026-08-09: lint/test/build API dan Web lulus; Flutter analyze dan 174 functional test non-golden lulus. UAT layar 43–44 dijalankan terhadap tenant PostgreSQL lokal terisolasi. Deploy server dan pengujian perangkat fisik belum dijalankan.*
