# UAT — Layar 3 (Menutup Daftar Supplier)

**Tenant uji:** `uat_master_18664`. Sama seperti layar 2: katalog paritas memetakan ke
`/suppliers` + `/inventory/party-master-balances/suppliers`, bukan endpoint terpisah. "Menutup
daftar" = mode presentasi UI untuk supplier nonaktif/terhapus, ditambah aksi deactivate/soft-delete
yang sesungguhnya mengubah state record.

## Skenario dan hasil

Bukti inti ada di evidence layar 1 (aksi lifecycle yang sama persis dipakai layar ini):

1. **Soft-delete ("menutup" satu supplier)**: `DELETE /suppliers/:id` dengan `reason` wajib →
   **200**, `deleted_at` terisi, `is_active` ikut `false` (`../screen-01/soft-delete.json`).
   Diverifikasi lewat SQL langsung: record TETAP ADA di tabel (`SELECT` berhasil menemukannya),
   bukan hard-delete — sesuai klaim "hanya soft-delete, bukan hilang permanen".
2. **Referential guard mencegah hapus permanen**: supplier yang sama, yang punya PO nyata
   (`PO-000001`), DITOLAK saat purge (`409 RECORD_REFERENCED`) bahkan dengan step-up token sah
   (`../screen-01/purge-blocked-with-stepup.json`) — supplier "ditutup" TIDAK BISA sungguh hilang
   selama masih dirujuk transaksi.
3. **"Daftar tertutup" sebagai mode presentasi**: `GET /suppliers?includeDeleted=true&includeInactive=true`
   menampilkan supplier yang sudah di-soft-delete (`../screen-01/list-after-delete-included.json`)
   — inilah yang secara wajar dipetakan UI sebagai "daftar tertutup"/nonaktif, memakai flag query
   yang sama dengan layar 2, bukan endpoint baru.
4. **Reversibilitas ("buka kembali")**: `POST /suppliers/:id/restore` mengembalikan supplier ke
   daftar terbuka (`../screen-01/restore.json`) — konsisten dengan siklus tutup/buka dua arah yang
   diharapkan legacy.

## Hasil

**PROVEN**: tidak ada endpoint terbuang untuk "tutup daftar" (mode presentasi UI + aksi
soft-delete generik yang sudah dibuktikan). Soft-delete tidak menghapus data secara permanen,
referential guard mencegah hilang permanen record berlalu-lintas, dan siklus tutup→buka kembali
berfungsi (restore).

## Yang TIDAK dicakup pass ini
Screenshot Web/Windows/Android tidak diambil.
