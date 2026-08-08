# UAT — Layar 9 (Laporan Opname Stok) — Freeze Enforcement + 2 Bug Nyata Ditemukan & Diperbaiki

**Tenant uji:** `uat_stock_price_18662`. **Konteks:** giliran sesi SEBELUM agent ini
memperbaiki `assertWarehouseNotFrozen()` dan sumber laporan opname (commit
`562b666 fix(inventory): enforce stock opname freeze and fix print report source`),
tapi commit itu eksplisit menyatakan **belum diverifikasi terhadap PostgreSQL nyata**.
Pass ini adalah verifikasi live pertama — dan langsung menemukan bahwa jalur posting
opname itu sendiri gagal 500 pada percobaan pertama.

## Skenario

1. **Buat opname**: `POST /stock-opnames` pada gudang `GDG-OUTLET-UTAMA` (berisi 50kg
   AYAM dari GR-000001 di layar 8) → `DRAFT`, 1 baris line ter-generate otomatis dari
   `stock_balance` saat ini (`system_qty=50`).
2. **Freeze**: `POST /stock-opnames/:id/freeze` → `DRAFT→FROZEN`.
3. **Coba mutasi stok di gudang yang sama saat FROZEN**: PO kedua (`PO-000002`, AYAM
   10kg) → goods receipt kedua (`GR-000002`) → inspect (accepted) → **`POST
   /goods-receipts/GR-000002/validate`** → **HTTP 409 `WAREHOUSE_FROZEN`**:
   *"Gudang sedang dibekukan untuk stock opname OPN-...-MSKSTZ2M. Mutasi stok ditolak
   sampai opname disetujui atau diposting."* Verifikasi DB: **0 baris** `stock_movement`
   untuk `GR-000002`, `stock_balance` tidak berubah (tetap 50). Penolakan bersih.
4. **Hitung fisik**: `PATCH /stock-opnames/:id` dengan `physicalQty=45` (varians −5) →
   status otomatis `FROZEN→COUNTED` (semua baris sudah dihitung).
5. **Masih diblokir saat COUNTED**: ulangi percobaan validate `GR-000002` → **409
   `WAREHOUSE_FROZEN` lagi** — jendela blokir memang FROZEN..COUNTED sesuai komentar
   kode di `assertWarehouseNotFrozen()`, bukan cuma FROZEN.
6. **Post sebelum approve ditolak**: `POST /stock-opnames/:id/post` saat status
   COUNTED → **409 CONFLICT**, *"Stock opname harus APPROVED sebelum diposting."*
7. **Approve**: `POST /stock-opnames/:id/approve` → `COUNTED→APPROVED`.
8. **Unfreeze setelah approve**: ulangi validate `GR-000002` sekarang → **HTTP 200,
   sukses**, `STOCK_POSTED` — APPROVED tidak lagi dianggap beku, sesuai klaim
   ("sebelum freeze dan setelah disetujui/diposting stok boleh bergerak lagi").
9. **Post opname**: `POST /stock-opnames/:id/post` → **GAGAL 500** (lihat Bug A di
   bawah). Setelah diperbaiki dan API hot-reload: **berhasil**, `POSTED`,
   `movementCount: 1`.
10. **Idempotency/state guard**: post ulang setelah POSTED → **409 CONFLICT** (bukan
    duplikasi movement) — status guard `WHERE status='APPROVED'` pada query pertama di
    `postStockOpname` sudah cukup untuk mencegah posting ganda; `stock_movement` untuk
    opname ini tetap **1 baris**.

## Temuan DIPERBAIKI #1 (Bug A): posting opname gagal 500 pada Postgres nyata

`POST /stock-opnames/:id/post` melempar **500 INTERNAL_ERROR**:
`"mededuksi tipe yang tidak konsisten untuk parameter $6"` (Postgres:
*"inconsistent types deduced for parameter $6"*) — lihat
`BUG-A-pre-fix-500-error.json`. Akar masalah: `$6` (`Math.abs(variance)`, angka JS
polos) dipakai baik sebagai nilai kolom `quantity` langsung MAUPUN di dalam
perbandingan `$6 < 0` / `$6 > 0` tanpa cast eksplisit — Postgres gagal menyimpulkan
satu tipe konsisten untuk `$6` di semua kemunculannya (node-postgres mengirim
parameter tak-bertipe). Ini persis konfirmasi dari catatan commit fix sebelumnya
("belum diverifikasi terhadap PostgreSQL nyata") — bug ini TIDAK mungkin tertangkap
oleh test bermock, hanya oleh percobaan live seperti ini.

**Perbaikan:** cast eksplisit `$6::numeric` di semua kemunculan. Lihat
`docs/pos-inventory-parity/evidence/bugs-found/fix-code-changes.txt` untuk before/after
lengkap. Diverifikasi live: post berhasil setelah perbaikan (`opname-post-after-fix.json`).

## Temuan DIPERBAIKI #2 (Bug B): arah mutasi ADJUSTMENT selalu salah — merusak invarian balance = Σ movement

Setelah Bug A diperbaiki dan statement bisa jalan, ditemukan bug KEDUA yang lebih
serius: query yang sama memutuskan `source_warehouse_id` vs `destination_warehouse_id`
dengan membandingkan `$6` (yaitu `Math.abs(variance)`, SELALU ≥ 0) terhadap `< 0` dan
`> 0`. Karena nilai mutlak tidak pernah negatif, cabang `< 0` TIDAK PERNAH benar dan
cabang `> 0` SELALU benar (baris `variance=0` sudah difilter WHERE di query
sebelumnya) — akibatnya **setiap** mutasi ADJUSTMENT, baik IN maupun OUT, selalu
tercatat sebagai `destination_warehouse_id` (stok masuk), tidak pernah
`source_warehouse_id` (stok keluar).

**Dibuktikan langsung, sebelum perbaikan** (opname pertama, varians −5,
`ADJUSTMENT_OUT`): baris `stock_movement` yang tercipta punya `destination_warehouse_id`
terisi dan `source_warehouse_id` NULL — salah arah. Rekonsiliasi memakai rumus
persis dari template pembuktian (`08-template-bukti-proven-stock-price.md` §3.1):

```
on_hand_qty = 55   vs   Σ movement (destination menambah, source mengurangi) = 65
```

Selisih 10 = 2× dari mutasi 5 unit yang salah arah — tanda tangan matematis persis
dari satu baris yang tanda arahnya terbalik. Lihat `screen-09/reconciliation.txt`.

**Perbaikan:** tambah parameter terikat ke-14 yang membawa `variance` BERTANDA (bukan
nilai mutlak), dipakai KHUSUS untuk keputusan arah, sementara `$6` (magnitude mutlak)
tetap dipakai untuk kolom `quantity` (yang memang harus selalu non-negatif). Lihat
`bugs-found/fix-code-changes.txt`.

**Verifikasi ulang setelah perbaikan** — dua opname baru pada gudang & produk yang
sama, dieksekusi penuh lewat siklus freeze→count→approve→post nyata:
- Opname #2, varians **+5** (`ADJUSTMENT_IN`) → baris movement: `has_source=false,
  has_dest=true` — **benar** (stok masuk).
- Opname #3, varians **−5** (`ADJUSTMENT_OUT`) → baris movement: `has_source=true,
  has_dest=false` — **benar, arah terbalik sekarang tepat** (stok keluar).

Rekonsiliasi akhir (`final-reconciliation.txt`) setelah opname #4 (−5) dan satu
penjualan (`SALES_ORDER_ISSUE`, −5) turut diposting: `on_hand_qty=45`. Jika baris
opname #1 yang cacat (satu-satunya baris pra-perbaikan) diperlakukan dengan tanda
yang SEHARUSNYA (dibalik, bukan dihapus), Σ movement = 60 (GR) − 5 (opname#1,
dikoreksi) + 5 (opname#2) − 5 (opname#3) − 5 (opname#4) − 5 (sale) = **45** — cocok
persis dengan `on_hand_qty`. Ini mengonfirmasi diagnosis: satu-satunya sumber
selisih di seluruh ledger adalah baris pra-perbaikan itu, dan besar selisihnya (10)
konsisten matematis dengan satu mutasi 5-unit yang tanda arahnya terbalik.

**Dampak sebelum perbaikan:** SETIAP posting opname (baik penambahan maupun
pengurangan stok akibat selisih fisik) di seluruh histori aplikasi ini akan merusak
kartu stok (`stock_movement`) — laporan kartu stok / mutasi (`GET
/inventory/movements`, layar-layar lain yang menyusun histori pergerakan) akan
menunjukkan arah yang salah untuk SEMUA penyesuaian opname, walau saldo akhir
(`stock_balance`, yang di-update lewat SQL terpisah tak terpengaruh bug ini) tetap
benar. Bug murni pada baris audit-trail immutable, bukan pada saldo — tapi baris
audit itu sendiri adalah bukti utama klaim "balance = Σ movement" di layar 8/9.

## Laporan opname (layar 10) — lihat `screen-10/uat.md`

## Hasil

**PASS** untuk enforcement freeze (409 pada percobaan mutasi FROZEN dan COUNTED,
sukses lagi setelah APPROVED — 3 skenario, semuanya diverifikasi via HTTP + SQL
nyata) DAN idempotency/state-guard posting. **DUA bug nyata ditemukan dan
diperbaiki** dalam pass ini (Bug A: 500 error yang memblokir SELURUH fitur posting
opname; Bug B: kerusakan invarian balance=Σmovement pada SEMUA mutasi ADJUSTMENT).
Keduanya diverifikasi ulang live setelah perbaikan, lint (`pnpm --filter @ebisnis/api
lint`) dan test suite penuh (`157 suites / 4015 tests`) tetap hijau.

## Yang TIDAK dicakup pass ini

Screenshot Web/Windows/Android tidak diambil. Freeze enforcement hanya diuji lewat
jalur goods-receipt-validate (satu dari 6 modul yang memanggil
`assertWarehouseNotFrozen()` menurut commit sebelumnya — POS sale/return, sales order
invoice, internal transfer, eMedik dispensing tidak diuji ulang secara individual di
pass ini, tapi memakai fungsi bantu yang SAMA sehingga risikonya rendah). Race
condition pada window pemeriksaan-lalu-tulis (`assertWarehouseNotFrozen` lalu INSERT
terpisah, bukan atomik dalam satu statement) tidak diuji dengan permintaan konkuren
sungguhan.
