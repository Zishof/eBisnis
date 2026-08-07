# 06. P1 POS Core Verification Findings (source-only, code-review level)

**Metode:** pembacaan kode langsung oleh 3 agent riset paralel, dibatasi pada file yang ada di
repo (tanpa live DB, tanpa Flutter build — lihat blocker pada `00-repository-baseline.md`). Setiap
klaim di bawah dikutip dengan file:line oleh agent yang membaca kode. Klasifikasi:
`CONFIRMED` (terverifikasi bekerja sesuai kontrak), `GAP` (hilang/rusak), `PARTIAL` (sebagian).

Temuan ini **membantah** sebagian klaim `OPERATIONAL` pada
`sales-inventory-parity.catalog.ts` — bukan karena kode itu salah (katalog memang berbicara
tentang layar 01-48 inventory/sales, bukan POS kasir), tetapi karena bagian **POS kasir** (yang
menurut addendum adalah prioritas #1: "POS kasir, Sales Order, pembelian... offline...") ternyata
punya gap nyata dan serius pada tepatnya area yang paling sering disebut sebagai prioritas:
**offline resilience pada checkout kasir**.

## Temuan kritis: checkout kasir Flutter TIDAK offline-safe

Ditemukan **tiga mekanisme offline/idempotency terpisah** di codebase, dengan kematangan yang
sangat berbeda:

| Mekanisme | Klien | Server | Status |
|---|---|---|---|
| A. Inventory mobile command (field-sales order) | `inventory_app.dart` | `inventory_mobile_command` via `tenant.module.ts` | **CONFIRMED benar** — key dibuat sekali, disimpan lokal (Drift), tidak diregenerasi saat retry |
| B. POS offline receipt replay + quarantine | *(tidak ada pemanggil Flutter)* | `pos-offline.service.ts` | Server **CONFIRMED sangat baik**, tapi **tidak terjangkau sama sekali dari app kasir Flutter** |
| C. POS checkout langsung (kasir) | `pos_api.dart` `bukukan()` | `pos.module.ts`/`pos-sale.service.ts` | **GAP** — pola anti-pattern persis yang dilarang dokumen perintah |

### Detail Mekanisme C (GAP, prioritas perbaikan tertinggi)

`apps/pos-flutter/lib/api/pos_api.dart:293-299` membuat idempotency key inline saat pemanggilan:
`'flutter-bayar-$saleId-${DateTime.now().microsecondsSinceEpoch}'` — **persis** pola yang secara
eksplisit dilarang dokumen perintah ("Ganti pola yang membuat key berdasarkan waktu pada setiap
HTTP attempt"). `bukukan()` (`pos_api.dart:219-318`) adalah alur 4 langkah langsung (create cart →
add items → pay → complete) **tanpa queue lokal sama sekali** — tidak ada import drift/sqlite di
file ini. Bila gagal di tengah jalan, `layar_kasir.dart` hanya menampilkan error dan kembali ke
layar cart; keranjang tetap di memory. Saat kasir menekan "Bayar" lagi, `bukukan()` berjalan dari
nol: `POST /pos/sales` membuat **sale row baru** setiap retry (tidak ada idempotency key di
endpoint create sama sekali), sehingga retry setelah timeout **tidak bisa dibedakan dari
transaksi baru** oleh server, dan cart setengah-jadi sebelumnya jadi orphan.

Ironisnya, mekanisme B (`pos-offline.service.ts`) dirancang sangat matang untuk kasus persis ini
(quarantine, reason code `PRICE_MISMATCH`/`STOCK_SHORT`/`SHIFT_CLOSED`/dst., replay konsisten) —
bahkan logika state koneksi sudah di-port ke Dart (`lib/aturan/koneksi.dart`, berlabel "Salinan
Dart dari apps/web/src/pos-offline/koneksi.ts") — tapi **tidak pernah dipanggil**:
`main.dart:323,365` meng-hardcode status koneksi jadi `KeadaanKoneksi.daring` (selalu online), dan
tidak ada connectivity listener atau timer sync periodik di manapun pada `apps/pos-flutter/lib`.

**Kesimpulan:** web PWA (`apps/web/src/pos-offline/store.ts`) sudah memakai mekanisme B dengan
benar (IndexedDB, `store.add` bukan `put` untuk cegah re-insert). App Flutter — platform yang
paling butuh offline (kasir toko fisik, sinyal tidak stabil) — justru satu-satunya yang TIDAK
memakainya. Ini kontradiksi langsung dengan prioritas addendum P1: "Shift, cart, payment, print,
**offline**, quarantine, return, void, device, update."

## Temuan lain (POS kasir inti)

| # | Area | Klasifikasi | Ringkasan |
|---|---|---|---|
| 1 | Atomicity checkout (`pos-sale.service.ts` `selesaikan()`) | **CONFIRMED** | Satu transaksi DB, row lock `FOR UPDATE`, stok+jurnal+receipt+status+audit dalam satu commit |
| 2 | Idempotency server (payment/stock/accounting) | **CONFIRMED**, tapi param `idempotencyKey` di `selesaikan()` tidak dipakai (dead parameter) — dedup nyata datang dari row lock + status check |
| 3 | State machine sale | **FIXED (2026-08-08)** | `VOID_REQUESTED → COMPLETED` (tolak void): ditambahkan `PosReturnService.tolakVoid()` + endpoint `POST sales/:id/void-reject`, permission `POS_SALE.APPROVE` ditambahkan ke tabel SYARAT (sebelumnya transisi ini tidak menuntut hak akses apa pun — celah nyata, bukan hanya "belum ada endpoint") |
| 4 | Permission `DISCOUNT_LINE`/`DISCOUNT_CART` | **GAP (belum dikerjakan)** | Hanya `PRICE_OVERRIDE` yang dicek eksplisit di controller; diskon manual tidak divalidasi server-side selain lewat RBAC catalog statis |
| 5 | Alur approval baris `requires_approval` | **FIXED (2026-08-08)** | Ditambahkan `PosSaleService.setujuiBaris()` + endpoint `POST sales/:id/items/:lineId/approve`, migration `V052` menambah `pos_sale_line.approved_at` berpasangan dengan `approved_by` (V027) yang sudah ada |
| 6 | Precision kuantitas | **PARTIAL** | Uang sudah Decimal end-to-end; kuantitas/override amount masih `number` JS di batas DTO (NUMERIC DB sebagai backstop, bukan defense-in-depth penuh) |
| 7 | Shift close/approve audit | **PARTIAL** | Actor/waktu/alasan tercatat tapi di kolom mutable pada `pos_shift`, bukan baris riwayat append-only seperti transisi sale lainnya |
| 8 | Return/void → stock movement | **CONFIRMED** | Movement nyata (bukan flip status), routing ke bucket AVAILABLE/DAMAGED/disposed |
| 9 | Return/void → payment reversal | **CONFIRMED** | `pos_refund` row + `accounting_event` pembalik, idempotent |
| 10 | Return/void → approval gate | **CONFIRMED** | 3 lapis: state table, controller permission, DB CHECK constraint anti self-approval |
| 11 | Return/void → audit | **CONFIRMED** | `pos_sale_status_history` untuk setiap transisi |
| 12 | Snapshot persistence (`inventory_report_snapshot`) | **CONFIRMED (arsitektur)** | `result_payload JSONB` menyimpan hasil lengkap saat dibuat; `GET /report-snapshots/:id` tidak menghitung ulang — desain sudah benar |
| 13 | Print log lengkap | **PARTIAL** | Actor+waktu tercatat; **tidak ada kolom reason/checksum/printer-device** — repo sendiri sudah mengakui ini sebagai "Additive Gap" terbuka di `docs/implementation/inventory-sales-48/data-model-gap.md` |
| 14 | Reprint snapshot LAMA (bukan live) | **PARTIAL** | Backend benar bila dipanggil dengan ID lama, TAPI satu-satunya tombol cetak di Web (`InventoryControlPage.tsx`) **selalu membuat snapshot baru dari data live** sebelum cetak — tidak ada UI untuk browse/reprint snapshot lama. Kapabilitas reprint-lama ada di API tapi yatim (orphaned), tidak pernah benar-benar dipakai |
| 15 | `apps/api/src/modules/return/` | **CONFIRMED tidak terkait** | Modul returns-policy generik untuk domain marketplace/order lain, tidak terhubung ke controller manapun — bukan bagian dari POS return (yang punya state machine sendiri di `pos-sale-state.ts`) |

## Dampak terhadap requirement ledger 48-layar

Temuan ini tidak langsung mengubah status 48 layar inventory/sales (yang audit source-nya belum
dilakukan sedalam ini), tapi **membuktikan bahwa self-report `OPERATIONAL` di codebase tidak bisa
dipercaya tanpa verifikasi** — persis peringatan dokumen perintah. Pola yang sama (backend matang,
tapi salah satu klien tidak benar-benar terhubung ke sana) patut dicurigai berulang di domain lain
(pembelian, piutang, dll.) dan perlu dicek dengan metode serupa: telusuri pemanggil nyata dari
Flutter/Web ke setiap endpoint, jangan berhenti pada "endpoint ada".

## Rekomendasi urutan perbaikan (P1, sebelum lanjut ke P2 layar 01-19)

1. **Prioritas tertinggi:** perbaiki `pos_api.dart`/`bukukan()` agar memakai pola Mekanisme A
   (idempotency key dibuat sekali per aksi bayar, disimpan Drift lokal, retry pakai key sama) ATAU
   sambungkan ke Mekanisme B (`/pos/offline/sales` + quarantine) yang sudah lengkap di server —
   opsi kedua lebih hemat karena backend sudah ada, tinggal membangun local outbox + connectivity
   listener nyata di Flutter dan menghapus hardcode `KeadaanKoneksi.daring`.
2. Tambahkan endpoint approve untuk `pos_sale_line.approved_by` (atau hapus gate bila memang belum
   dipakai — tapi menghapus butuh keputusan bisnis, jangan diam-diam).
3. Tambahkan endpoint reject untuk `VOID_REQUESTED → COMPLETED`.
4. Tambahkan permission check eksplisit `DISCOUNT_LINE`/`DISCOUNT_CART` di controller.
5. Tambahkan kolom `reason`, `checksum`, `printer/device` pada `inventory_print_log`, dan bangun
   UI browse/reprint snapshot lama (saat ini tombol cetak selalu membuat snapshot baru).
