# UAT — Layar 39 (Sales Membawa Nota — Custody State Machine)

**Tenant uji:** `uat_sales_ar_18620`. **Prasyarat:** 2 piutang terbuka — order 1 (`718e16e0-...`,
Andi Pratama, awalnya 800000) dan order 3 (`22574103-...`, CV Warung Berkah, 1000000). Sales
pembawa nota: `b3bb36d3-...` ("UAT Tester", satu-satunya `user_subject` tenant ini — dipakai
sebagai `salespersonId`, BUKAN tabel `salespeople`/master melainkan `user_subject`, sesuai join
`sales_note_handover.salesperson_id → user_subject.id`).

Layar ini adalah layar pertama di seluruh pass Sales/AR yang benar-benar mengeksekusi
`sales-note-handovers` end-to-end (layar 30/34/24 yang sudah PROVEN sebelumnya tidak menyentuh
custody nota) — dan langsung menemukan 2 gap nyata di jalur yang belum pernah diuji langsung.

## Temuan DIPERBAIKI #1: `outstanding_amount` nota dari nilai faktur BRUTO, bukan sisa piutang riil

**Reproduksi:** ledger order 1 sengaja dibuat "sebagian lunas" DULU (pembayaran 300000 dari
800000 lewat `/ar/receipts` normal, di luar jalur nota) sebelum dititipkan ke sales — skenario
realistis: customer sempat transfer sebagian sebelum sales datang menagih sisanya.
`POST /sales-note-handovers` dengan `lines:[{ledger order1}, {ledger order3}]` →
`handover-detail-bug-check.json`: baris order 1 tercatat `outstanding_amount:"800000.0000"` —
**NILAI FAKTUR ASLI, bukan 500000 yang sebenarnya masih terutang.**

**Akar masalah:** query `ledgers` di `createHandover` (`sales-inventory-operations.controller.ts`)
mengambil `lr.amount::text` langsung dari `legacy_receivable_ledger`. Kolom itu TIDAK PERNAH
dikurangi saat pelunasan diposting (`transitionSettlement` hanya meng-update `is_settled`,
lihat pola yang sama di layar 24/34) — outstanding riil selalu dihitung ON THE FLY lewat join ke
alokasi `POSTED`, persis seperti yang dipakai `legacyReceivables` (layar 31-33) dan
`createSettlement` (layar 24/34). `createHandover` adalah SATU-SATUNYA tempat yang lupa memakai
pola netting ini.

**Dampak sebelum perbaikan:** paket titipan nota mencatat sales harus menagih LEBIH BESAR dari
piutang yang sebenarnya tersisa — bisa memicu sales menagih ulang uang yang sudah dibayar
customer lewat kanal lain, atau laporan custody (layar 40/`sales-note-handover` report) salah
total.

**Perbaikan:** query `ledgers` ditambah `LEFT JOIN LATERAL` yang menjumlahkan
`inventory_ar_receipt_allocation` yang `POSTED` (pola identik dengan `legacyReceivables` &
`createSettlement`), dan `amount` yang dipakai untuk `outstanding_amount` sekarang
`GREATEST(abs(lr.amount) - COALESCE(settlement.allocated_amount,0), 0)`. Ditambahkan juga guard:
bila hasil netting justru 0 (piutang sudah lunas penuh lewat kanal lain tapi `is_settled` belum
sempat ke-flip), permintaan ditolak `400 VALIDATION_FAILED` alih-alih membuat baris nota senilai 0.

**Verifikasi ulang setelah perbaikan:** nota lama (`9b3ada6f-...`, data salah) dibatalkan, lalu
dibuat ULANG dengan ledger yang sama persis. `handover-detail-after-fix.json`: baris order 1
sekarang `outstanding_amount:"500000.0000"` — **BENAR**, order 3 tetap `1000000.0000` (tidak
tersentuh pelunasan apa pun, tidak berubah). File: `sales-inventory-operations.controller.ts`.

## Temuan DIPERBAIKI #2: `POST /sales-note-handovers/:id/cancel` gagal total (500 INTERNAL_ERROR)

Ditemukan saat mencoba membatalkan nota bug #1 di atas untuk membuat ulang data yang benar:
`POST .../cancel` dengan body valid → **500 INTERNAL_ERROR**,
`"tidak dapat menentukan tipe data dari parameter $2"` (lihat `handover-bugfix-cancel-old.json`).

**Akar masalah:** query `concat_ws(E'\n', note, $2)` — parameter `$2` (reason) dipakai sebagai
argumen variadic `"any"` pada `concat_ws` tanpa cast eksplisit, membuat Postgres tidak bisa
menyimpulkan tipe parameter untuk statement siap-pakai (prepared statement) — driver `pg`
mengirim query ini via extended protocol yang mewajibkan tipe parameter diketahui di muka.
**Endpoint ini rusak TOTAL untuk SEMUA pemanggil**, bukan kasus tepi — setiap percobaan
membatalkan nota DRAFT pasti gagal 500.

**Perbaikan:** cast eksplisit `$2::text` pada `concat_ws(E'\n', note, $2::text)`.

**Verifikasi ulang setelah perbaikan:** `POST .../cancel` pada nota yang sama →
**200 OK**, `{"id":"9b3ada6f-...","status":"CANCELLED"}` (lihat
`handover-bugfix-cancel-old-retry.json`).

Kedua perbaikan diverifikasi bersih: `pnpm --filter @ebisnis/api lint` (0 error) dan
`pnpm --filter @ebisnis/api test` (157 suite / 4015 test, semua PASS) dijalankan ulang setelah
perubahan.

## Skenario state machine (pada nota BENAR pasca-perbaikan, `3901e97f-...`, NOTA-...-MSKSU52Y)

1. **ILLEGAL — `/close` langsung dari DRAFT** (lompat handover+return): `409 CONFLICT`,
   `"Serah-terima harus berstatus RETURNED."` (`illegal-close-on-draft.json`).
2. **ILLEGAL — `/return` langsung dari DRAFT** (lompat handover), payload valid (bukan gagal
   validasi DTO): `409 CONFLICT`, `"Nota hanya dapat dikembalikan setelah diserahterimakan."`
   (`illegal-return-on-draft.json`).
3. **LEGAL — `/handover`**: DRAFT → HANDED_OVER (`handover-transition.json`).
4. **ILLEGAL — `/handover` LAGI** (sudah HANDED_OVER): `409 CONFLICT`,
   `"Serah-terima harus berstatus DRAFT."` (`illegal-double-handover.json`).
5. **LEGAL — `/return`**: HANDED_OVER → RETURNED, line order1=COLLECTED 500000,
   line order3=RETURNED 1000000 (`return-transition.json`, HTTP 201).
6. **ILLEGAL — `/return` LAGI**: `409 CONFLICT` (`illegal-double-return.json`) — lihat detail
   lengkap siklus return→close di `../screen-40/uat.md`.

## Hasil

**PASS** untuk state machine (5 dari 6 transisi legal/ilegal dibuktikan di sini, sisanya di layar
40) — setiap lompatan status ditolak bersih `409 CONFLICT` tanpa efek samping, TERMASUK dua gap
nyata yang ditemukan justru karena pass ini adalah yang PERTAMA benar-benar mengeksekusi jalur ini
end-to-end. Keduanya DIPERBAIKI dan diverifikasi ulang lewat percobaan HTTP nyata (bukan lolos
diam-diam).

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Skenario `salespersonId` berbeda dari pembuat order
asli (`lr.salesperson_id IS NULL OR lr.salesperson_id = $2`) tidak diuji karena tenant uji hanya
punya 1 user_subject.
