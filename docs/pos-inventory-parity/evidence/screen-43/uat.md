# UAT — Layar 43 (Kas dan Jurnal)

**Tanggal:** 2026-08-09

**Tenant uji terisolasi:** `uat_fin_161526`

**Database:** PostgreSQL lokal `ebisnis`; pengujian additive, tanpa reset/drop dan tanpa mengubah migration.

## Skenario dan bukti

1. Membaca `GET /inventory/finance-workspace` dan memilih periode terbuka `2026-12`.
2. Percobaan jurnal dengan tanggal di luar rentang periode ditolak `VALIDATION_FAILED`. Guard periode bekerja.
3. Membuat jurnal seimbang melalui `POST /inventory/journals` dengan `Idempotency-Key`, debit dan kredit masing-masing `10000`, tanggal `2026-12-01`.
4. API menghasilkan jurnal `JRN-20261201-MSLL8Y9M` berstatus `DRAFT`.
5. `POST /inventory/journals/:id/post` mengubah status menjadi `POSTED`.
6. `POST /inventory/journals/:id/reverse` menghasilkan jurnal pembalik berstatus `POSTED`.
7. Read-back `GET /inventory/finance-workspace` menemukan jurnal asli dan jurnal reversal masing-masing tepat satu kali.

## Hasil

**PASS.** Alur create, validasi periode, posting, reversal, dan read-back jurnal berjalan pada PostgreSQL nyata. Tidak ada data produksi yang disentuh.
