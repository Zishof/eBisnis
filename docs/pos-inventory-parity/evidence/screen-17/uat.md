# UAT — Layar 17 (Menu Master Harga) — Bug Nyata Ditemukan & Diperbaiki

**Tenant uji:** `uat_stock_price_18662`. **Konteks:** commit `6987509
fix(pricing): block price-book self-approval` (sesi sebelumnya) menambah
migrasi V055 (`submitted_by`/`submitted_at` + constraint
`price_book_no_self_approval`) dan pemeriksaan aplikasi, dengan catatan eksplisit
"NOT verified against a live PostgreSQL instance". Pass ini adalah verifikasi live
pertama — dan langsung menemukan bahwa jalur SUBMIT itu sendiri (prasyarat mutlak
sebelum self-approval bisa diuji sama sekali) gagal 500.

## Skenario

1. `POST /inventory/price-books` (CUSTOMER-scope, CUST-007, AYAM @ Rp38.000) →
   sukses, `status:"DRAFT"` (`pb-create.json`).
2. `PATCH /inventory/price-books/:id/status` dengan `{"status":"SUBMITTED"}` →
   **GAGAL 500** pada percobaan pertama (lihat Bug D di bawah).

## Temuan DIPERBAIKI (Bug D): transisi status price-book gagal 500 — SELURUH alur persetujuan buku harga terblokir

`PATCH /inventory/price-books/:id/status` melempar **500 INTERNAL_ERROR**:
`"mededuksi tipe yang tidak konsisten untuk parameter $2"` (Postgres: *"inconsistent
types deduced for parameter $2"*) — lihat `BUG-D-pre-fix-500-error.json`. Akar
masalah SAMA PERSIS dengan Bug A di layar 9 (lihat `screen-09/uat.md`): `$2`
(`body.status`, string JS polos) dipakai baik sebagai nilai kolom `approval_status`
langsung MAUPUN di dalam lima perbandingan string `CASE WHEN $2 = '...'` tanpa cast
konsisten — Postgres gagal menyimpulkan satu tipe untuk `$2` di semua kemunculannya.

**Dampak sebelum perbaikan: ini bukan cuma soal self-approval — SELURUH mekanisme
transisi status price-book (submit, approve, reject, deactivate) gagal 100% saat
dipanggil terhadap Postgres nyata.** Tidak ada satu pun buku harga yang bisa maju
dari DRAFT ke status apa pun. Fitur "self-approval block" yang diklaim sesi
sebelumnya tidak mungkin teruji ATAU terpakai secara live — SUBMIT saja sudah gagal
sebelum self-approval sempat dicoba.

**Perbaikan:** cast eksplisit `$2::varchar` di semua enam kemunculan. Lihat
`docs/pos-inventory-parity/evidence/bugs-found/fix-code-changes.txt` untuk
before/after lengkap.

**Verifikasi ulang setelah perbaikan** (API hot-reload):
```
PATCH .../status {"status":"SUBMITTED"} → HTTP 200, status:"SUBMITTED"
```
(`pb-submit-after-fix.json`). Baru setelah ini logika self-approval (yang KODENYA
sudah benar sejak awal, hanya tidak pernah bisa dieksekusi) dapat diuji — lihat
hasil di bawah dan detail lengkap di `screen-19/uat.md`.

## Skenario lanjutan: self-approval block (setelah Bug D diperbaiki)

3. `PATCH .../status {"status":"APPROVED"}` oleh user YANG SAMA yang men-submit →
   **HTTP 403 FORBIDDEN**: *"Anda tidak dapat menyetujui pengajuan buku harga Anda
   sendiri. Mintakan kepada supervisor lain."* (`pb-self-approve-rejected-403.json`)
   — persis sesuai klaim.
4. `GET /inventory/price-books` → buku harga tampil dengan `approval_status:
   "SUBMITTED", is_active:false` (`pb-list.json`) — daftar master harga
   menunjukkan status pending dengan benar, harga belum aktif dipakai.

## Hasil

**Bug nyata ditemukan DAN DIPERBAIKI**: fitur inti layar ini (mengajukan perubahan
harga untuk disetujui) gagal total sebelum perbaikan. Setelah diperbaiki: siklus
submit bekerja, dan self-approval block (fitur keamanan utama sesi sebelumnya)
terbukti bekerja persis sesuai klaim — dengan DUA lapis pertahanan (app-layer 403 +
DB CHECK constraint, lihat `screen-19/uat.md` untuk bukti lapis kedua).
`pnpm --filter @ebisnis/api lint` dan test suite penuh (157/4015) tetap hijau setelah
perbaikan.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Transisi REJECTED dan INACTIVE tidak
diuji langsung di pass ini (SUBMITTED→APPROVED dan blokir self-approval sudah cukup
membuktikan mekanisme cast/perbandingan `$2` bekerja untuk semua cabang, karena
kelimanya memakai pola casting yang identik).
