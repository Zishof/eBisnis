# ADR-004 — Price waterfall deterministik dan evaluator diskon whitelist

- Status: Diterima
- Tanggal: 2026-07-30

## Konteks

Harga langganan dipengaruhi paket, jumlah perangkat POS, tier volume, override
per tenant, add-on, beberapa program diskon, kode promo, pajak, dan biaya admin
channel pembayaran. Dua kebutuhan bertabrakan:

- Tim penjualan ingin aturan diskon yang fleksibel tanpa deployment.
- Sistem tidak boleh mengeksekusi ekspresi bebas dari pengguna.

## Keputusan

### Waterfall 15 langkah

Perhitungan berjalan sebagai urutan langkah tetap, masing-masing mencatat
`step`, `name`, `detail`, dan `runningSubtotal` ke dalam `calculation_trace`:
versi paket → kuantitas → harga dasar → tier volume → override tenant → add-on →
diskon → kode promo → lantai harga → subtotal → pajak → biaya admin → total →
pembulatan → jejak.

Trace disimpan pada quote dan **tidak berubah** setelah quote diterima. Invoice
menyimpan snapshot harga, sehingga perubahan harga di masa depan tidak pernah
mengubah tagihan yang sudah diterbitkan.

### Evaluator diskon whitelist-only

Kondisi diskon **tidak** memakai ekspresi bebas. `eval`, konstruktor `Function`,
dan SQL dinamis dari pengguna tidak pernah dipakai. Kondisi hanya boleh
menyebut:

- **Field** dari enum `DiscountConditionField` (mis. `SELECTED_DEVICE_COUNT`,
  `BILLING_INTERVAL`, `TENANT_AGE_DAYS`, `QUOTE_SUBTOTAL`, `PROMOTION_CODE`).
- **Operator** dari enum `DiscountOperator`: `EQ`, `NE`, `GT`, `GTE`, `LT`,
  `LTE`, `IN`, `NOT_IN`, `BETWEEN`, `IS_TRUE`, `IS_FALSE`.

Field atau operator di luar whitelist melempar error validasi, bukan dievaluasi.
Grup kondisi tanpa isi dianggap **tidak cocok**, agar rule kosong tidak
memberikan diskon secara diam-diam.

Kebijakan penumpukan: `EXCLUSIVE` (menang sendiri), `BEST_PRICE` (ambil yang
paling menguntungkan pelanggan), `STACKABLE` (dapat digabung).

## Konsekuensi

- Seluruh aritmetika uang memakai `decimal.js`; tidak ada `number` floating point
  pada jalur harga.
- Setiap evaluasi diskon menghasilkan jejak kondisi (`expected`, `actual`,
  `matched`) yang dapat diserialisasi menjadi JSON, sehingga pertanyaan
  "mengapa diskon ini tidak berlaku" dapat dijawab tanpa menebak.
- Menambah field kondisi baru memerlukan perubahan enum dan kode — ini disengaja.
- Batas tier bersifat inklusif dan diuji eksplisit pada batasnya (10 vs 11
  perangkat), karena kesalahan off-by-one pada tier langsung berdampak tagihan.

## Rujukan

- `apps/api/src/modules/pricing/pricing-engine.service.ts`
- `apps/api/src/modules/pricing/discount-evaluator.service.ts`
- `apps/api/src/modules/pricing/discount-evaluator.service.spec.ts`
