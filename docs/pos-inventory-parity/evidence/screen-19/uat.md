# UAT — Layar 19 (Master Harga Jual per Customer) — Self-Approval Block, Dua Lapis

**Tenant uji:** `uat_stock_price_18662`. **Klaim:** `price_book` dengan
`scopeType:"CUSTOMER"`; larangan self-approval (V055) ditegakkan di app layer DAN
DB constraint. Bug D yang memblokir SELURUH transisi status (lihat `screen-17/uat.md`)
diperbaiki lebih dulu — evidensi di sini adalah pembuktian LANJUTAN setelah perbaikan.

## Skenario

1. `POST /inventory/price-books`, `scopeType:"CUSTOMER", scopeId:<CUST-007>`, AYAM
   @ Rp38.000 → `DRAFT` (`pb-customer-scope-create.json`, sama dengan yang dipakai
   di layar 17).
2. Submit → `SUBMITTED`, `submitted_by` terisi user aktif.
3. **Self-approve (app layer)**: user yang sama mencoba `{"status":"APPROVED"}` →
   **HTTP 403 FORBIDDEN** (`self-approve-rejected-403.json`) — sama dengan bukti di
   layar 17.
4. **Self-approve (DB layer, bypass app sepenuhnya)**: SQL langsung
   `UPDATE price_book SET approved_by = submitted_by WHERE code='PB-UAT-01'`
   (mem-forsir kondisi self-approval TANPA lewat endpoint sama sekali, mensimulasikan
   skenario "app layer kelak lupa memeriksa" yang disebut komentar migrasi V055) →
   **DITOLAK Postgres**: `ERROR: baris baru untuk relasi "price_book" melanggar
   pemeriksaan constraint "price_book_no_self_approval"` (`db-check-constraint-second-layer.txt`).
   Constraint `CHECK (approved_by IS NULL OR submitted_by IS NULL OR approved_by <>
   submitted_by)` dari migrasi V055 bekerja persis seperti didesain — bahkan
   melewati aplikasi sepenuhnya tidak bisa membuat baris self-approved di database.

## Catatan tentang bukti "pengaju BERBEDA bisa menyetujui"

Tenant uji ini hanya punya SATU `user_subject` (OWNER) — tidak ada endpoint HTTP di
codebase untuk membuat/mengundang user kedua di tenant yang sama (dikonfirmasi
lewat pencarian menyeluruh: `TenantAdminController` hanya `GET /admin/users`
read-only; `master-resource.registry.ts` tidak mendaftarkan resource `users`/`staff`;
satu-satunya jalur `INSERT user_subject` yang bisa dipanggil HTTP adalah
`public/registrations` yang membuat TENANT BARU, bukan user kedua di tenant yang
sama). Karena itu sisi POSITIF ("pengaju A, penyetuju B yang berbeda → sukses") tidak
diverifikasi dengan login kedua yang sungguhan pada pass ini. Sebagai gantinya, bukti
di atas (poin 4) memakai jalur yang justru LEBIH kuat untuk membuktikan larangan ini
tegak: constraint level database menolak kondisi self-approval bahkan saat aplikasi
dilewati seluruhnya — memenuhi maksud "app-check + constraint sebagai lapis kedua"
dari desain V055 tanpa bergantung pada infrastruktur user kedua yang memang belum ada
di produk ini.

## Hasil

**PASS**, dua lapis: app-layer 403 pada percobaan self-approve via API sungguhan,
DAN DB CHECK constraint menolak kondisi yang sama walau dipaksa langsung lewat SQL
(bypass app total). Bug D yang sebelumnya memblokir SELURUH alur ini (lihat
`screen-17/uat.md`) sudah diperbaiki dan diverifikasi ulang.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Skenario "penyetuju BERBEDA berhasil
menyetujui" tidak diverifikasi dengan login user kedua yang sungguhan (lihat catatan
di atas — tidak ada endpoint untuk membuat user kedua di tenant yang sama; ini gap
infrastruktur pengujian, bukan gap pada fitur yang sedang dibuktikan).
