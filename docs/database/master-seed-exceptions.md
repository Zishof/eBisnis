# Pengecualian Aturan Minimum 10 Record

> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi
> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.

- Dihasilkan: `2026-07-30T10:47:45.433Z`
- Schema control plane: `platform`, `platform__audit`
- Schema tenant contoh: `demo`, `demo__audit`

Aturan umum Versi 5 adalah minimum 10 record contoh per master relevan. Master berikut dikecualikan karena jumlahnya ditentukan struktur bisnis nyata, bukan data contoh. Setiap pengecualian wajib memiliki alasan tertulis.

| Resource | Tabel | Alasan pengecualian |
| --- | --- | --- |
| `LEGAL_ENTITY` | `legal_entity` | Perusahaan/badan hukum berasal dari data pendaftaran nyata. Menciptakan 10 badan hukum fiktif akan mengacaukan struktur organisasi dan laporan konsolidasi. |
| `BRAND` | `brand` | Brand default dibuat dari nama bisnis pendaftar. Jumlah brand ditentukan pemilik pada onboarding. |
| `OUTLET` | `outlet` | Outlet merepresentasikan lokasi fisik nyata dan menjadi unit penagihan langganan. Outlet fiktif akan mempengaruhi perhitungan billing. |
| `WAREHOUSE` | `warehouse` | Gudang merepresentasikan lokasi penyimpanan nyata dan menjadi dimensi saldo stok. Dibuat sesuai struktur outlet. |
| `REGION` | `region` | Tree wilayah internal mengikuti struktur bisnis nyata pendaftar. |
| `USER_SUBJECT` | `user_subject` | Merupakan proyeksi pengguna nyata dari control plane. Pengguna fiktif akan menjadi risiko keamanan. |
| `ROLE` | `role` | Role di-seed dari template global (OWNER, MANAGER, dan seterusnya) sesuai kebutuhan, bukan dipaksa 10. |
| `MENU` | `menu` | Menu di-seed dari GlobalMenuTemplate secara utuh (>100 node), bukan berdasarkan aturan minimum 10. |
| `FISCAL_PERIOD` | `fiscal_period` | Periode fiskal dihasilkan otomatis mengikuti tahun buku perusahaan, bukan data contoh. |
| `ONBOARDING_PROGRESS` | `onboarding_progress` | Singleton per tenant. |
| `APP_SETTING` | `app_setting` | Konfigurasi bernilai tunggal per kunci; jumlah mengikuti kebutuhan fitur. |
| `INVENTORY_LOT` | `inventory_lot` | Lot/batch dihasilkan oleh penerimaan barang nyata, bukan data master yang diketik. |

Total pengecualian: 12. Master lain di luar daftar ini wajib
memenuhi minimum yang tercatat pada [katalog seed](master-seed-catalog.md).
