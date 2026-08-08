# UAT — Layar 6 (Menutup Daftar Customer)

**Tenant uji:** `uat_master_18664`. Sama seperti layar 3 tapi untuk `/customers`.

## Skenario dan hasil

Bukti inti ada di evidence layar 4 (aksi lifecycle yang sama persis dipakai layar ini):

1. **Soft-delete ("menutup" satu customer)**: `DELETE /customers/:id` dengan `reason` →
   **200**, `deleted_at` terisi (`../screen-04/soft-delete.json`). SQL langsung: record TETAP ADA
   di tabel `customer`, hanya `is_active=f` dan `deleted_at` terisi — bukan hard-delete.
2. **Referential guard mencegah hapus permanen**: customer yang punya `sales_order` nyata DITOLAK
   saat purge, **409 RECORD_REFERENCED**, bahkan dengan step-up token sah
   (`../screen-04/purge-blocked.json`).
3. **"Daftar tertutup" = mode presentasi**: query `includeDeleted=true&includeInactive=true` pada
   `GET /customers` (mekanisme sama dengan layar 5/2, sudah dibuktikan pada resource `suppliers`
   di layar 1) menampilkan customer nonaktif/terhapus — bukan endpoint baru.
4. **Reversibilitas**: `POST /customers/:id/restore` mengembalikan ke daftar terbuka
   (`../screen-04/restore.json`).

## Hasil

**PROVEN**: tidak ada endpoint terbuang untuk "tutup daftar". Soft-delete tidak menghapus data
permanen, referential guard mencegah hilang permanen record berlalu-lintas, siklus tutup→buka
kembali berfungsi.

## Yang TIDAK dicakup pass ini
Screenshot Web/Windows/Android tidak diambil.
