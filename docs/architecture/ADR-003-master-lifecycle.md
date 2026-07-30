# ADR-003 — Lifecycle master tiga tingkat dan hapus permanen terkendali

- Status: Diterima
- Tanggal: 2026-07-30

## Konteks

Pengguna butuh membersihkan data master yang salah, tetapi hapus permanen pada
master yang sudah dipakai transaksi akan merusak dokumen historis: invoice lama
kehilangan nama produk, kartu stok kehilangan satuan, jurnal kehilangan akun.
Di sisi lain, "tidak boleh menghapus apa pun" membuat daftar master penuh
sampah dan pengguna kehilangan kepercayaan pada sistem.

## Keputusan

Setiap master memiliki **tiga tingkat lifecycle**:

| Tingkat | Kolom | Efek | Dapat dibatalkan |
| --- | --- | --- | --- |
| Nonaktifkan | `is_active = false` | Tidak muncul pada pilihan baru; dokumen lama tetap utuh | Ya (`activate`) |
| Hapus sementara | `deleted_at`, `deleted_by`, `delete_reason` | Hilang dari daftar; referensi tetap resolvable | Ya (`restore`) |
| Hapus permanen | baris dihapus fisik | Tidak dapat dibatalkan | **Tidak** |

Hapus permanen (purge) memerlukan **seluruh** syarat berikut:

1. Permission `<MENU>.HARD_DELETE`.
2. **Step-up authentication** — verifikasi ulang kata sandi, token dikirim
   melalui header `X-Step-Up-Token` dan hanya berlaku untuk satu tujuan.
3. **Alasan** wajib, tersimpan pada audit.
4. **Reference check** terhadap seluruh tabel yang mereferensikan record. Bila
   ada referensi dari tabel transaksi, purge **selalu** ditolak.
5. Kebijakan `hardDeletePolicy` resource mengizinkannya.

Kebijakan yang tersedia: `NEVER_PURGE`, `PURGE_IF_UNREFERENCED`,
`PURGE_SAMPLE_ONLY`, `PURGE_AFTER_RETENTION`, `PLATFORM_SUPER_ADMIN_ONLY`.

## Konsekuensi

- Registry resource (`MASTER_RESOURCES`) mendeklarasikan tabel perujuk secara
  eksplisit, bukan mengandalkan katalog foreign key. Deklarasi ini diverifikasi
  terhadap database oleh `pnpm docs:generate`, sehingga registry yang menyimpang
  dari skema nyata langsung terlihat.
- Kolom foreign key yang dipakai reference check diberi index tersendiri
  (migration `V009`), karena tanpa index pemeriksaan pada `stock_movement` atau
  `pos_sale` melakukan sequential scan.
- Antarmuka meminta kata sandi melalui dialog `type="password"`, bukan prompt
  teks biasa, sehingga kata sandi tidak pernah tampil sebagai teks.
- Data contoh (`is_sample = true`) dapat dibersihkan massal, tetapi record yang
  sudah dipakai transaksi nyata dilaporkan sebagai **terblokir** dan dibiarkan.

## Rujukan

- [Matriks referensi hapus permanen](../database/hard-delete-reference-matrix.md)
- [Kebijakan lifecycle tabel](../database/table-lifecycle-policy.md)
- `apps/api/src/modules/tenant/master-lifecycle.service.ts`
