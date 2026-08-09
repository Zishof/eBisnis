# UAT — Layar 44 (Membuat Perkiraan Baru)

**Tanggal:** 2026-08-09

**Tenant uji terisolasi:** `uat_fin_161526`

**Database:** PostgreSQL lokal `ebisnis`; pengujian additive, tanpa reset/drop dan tanpa mengubah migration.

## Skenario dan bukti

1. Membuat akun lewat `POST /inventory/chart-accounts` dengan kode `UAT44161526`, kategori `ASSET`, dan normal balance `DEBIT`.
2. Endpoint menghasilkan akun posting baru bertipe `ASSET`.
3. Read-back melalui `GET /inventory/finance-workspace` menemukan akun tersebut tepat satu kali.
4. Akun dipakai sebagai sisi debit jurnal UAT layar 43, sehingga keterhubungan COA ke journal entry ikut terbukti.

## Hasil

**PASS.** Pembuatan dan pemakaian chart of account baru berjalan pada PostgreSQL nyata. Tidak ada data produksi yang disentuh.
