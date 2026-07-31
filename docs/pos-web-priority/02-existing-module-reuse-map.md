# POS-0 · Peta Pemakaian Ulang Modul

Perintah prioritas §2 menutup daftar pencarian modulnya dengan satu kalimat:
*"Jangan menggandakan implementasi yang sudah ada."* Dokumen ini adalah
jawabannya — apa yang sudah ada, mana yang dapat dipakai apa adanya, dan mana
yang terdengar dapat dipakai tetapi sebenarnya tidak.

---

## Dapat dipakai apa adanya

| Yang ada | Berkas | Dipakai POS untuk |
|---|---|---|
| `StockReservationService` | `modules/order/stock-reservation.service.ts` | POS-3 seluruhnya. `hold()` menahan stok saat baris ditambahkan, `commit()` saat pembayaran berhasil, `release()` saat gagal, `releaseExpired()` untuk keranjang telantar. Persis alur yang diminta perintah §10 |
| Konteks permintaan (`AsyncLocalStorage`) | `common/context/request-context.ts` | Pengisian otomatis pelaku pada audit — tenantId, userId, activeRoleId, requestId |
| `AuditService` + pemicu basis data | `V008__audit_triggers.sql` | Audit setiap perubahan pada tabel POS, tanpa kode tambahan per tabel |
| Hub notifikasi | `modules/notification/` | Permintaan persetujuan diskon, void, refund; peringatan selisih kas; shift yang belum ditutup. Pengelompokan dan SLA sudah berjalan |
| Cakupan data pengguna | `V011__user_scope_assignment` + penegakan pada kueri | Kasir hanya melihat outletnya sendiri, tanpa menulis penyaringan baru di setiap kueri POS |
| Pemisahan wewenang | `V010__role_governance` | Aturan "kasir tidak boleh menyetujui refund sendiri" cukup didaftarkan sebagai aturan SoD baru |
| `number_sequence` | `V001__tenant_core` | Nomor struk per outlet per hari, dengan kebijakan reset |
| Pola penomoran anti-kembar | Tata kelola surat V10-6 | Nomor struk yang tidak dapat kembar meski dua kasir menyelesaikan transaksi pada milidetik yang sama. Sudah terbukti di bawah uji bersamaan |
| Catatan galat, kinerja, aktivitas | V10-2, V10-3, V10-5 | Observabilitas POS sesuai perintah §22 tanpa membangun apa pun |
| Gerbang AI | `modules/ai/` | POS-12. Kebijakan, kuota, bukti, redaksi, dan batas kewenangan sudah berlaku |
| Kerangka data contoh | `modules/master-seed/` | POS-10. Golongan `EXAMPLE` dan pembersihan yang tidak melumpuhkan baru saja dibereskan |

## Dapat dipakai ulang sebagian

| Yang ada | Yang dapat dipakai | Yang harus dibangun |
|---|---|---|
| `order-state.ts` | **Polanya** — tabel transisi eksplisit, satu fungsi `canAdvance` yang mengembalikan alasan penolakan | Tiga belas status POS berbeda dari status pesanan marketplace. Tabelnya baru, polanya sama |
| `return-rules.ts` | `computeRefundAmount()`, `resolveRefundMethod()`, `canCompleteRefund()` | Jendela retur 7 hari dan ongkos kirim yang ditanggung pembeli adalah aturan **marketplace**. Retur di kasir tidak mengenal ongkos kirim, dan jendelanya ditentukan kebijakan tenant |
| `posting-engine.ts` | Mesinnya, termasuk uji yang memaksa setiap kode peristiwa punya aturan posting | Dua belas kode `POS_*` beserta `REQUIRED_AMOUNTS`-nya |
| `DiscountEvaluatorService` | **Seluruhnya** — evaluator pohon kondisi tanpa `eval`, sudah diuji | Cara memanggilnya dari konteks POS (baris keranjang, bukan tagihan langganan) |
| `checkout-validation.spec.ts` | Pola validasi berlapis dengan pesan yang dapat dibaca pengguna | Validasi POS berbeda isinya |
| `pos_terminal.printer_config` (JSONB) | Menampung konfigurasi pencetak | Tabel perangkat tersendiri bila kelak perlu banyak perangkat per terminal |

## Terdengar dapat dipakai, tetapi **tidak**

Bagian ini yang paling berguna. Ketiganya mudah disalahpahami dari namanya.

### `PricingEngineService` — mesin harga **langganan**, bukan harga produk

```ts
export interface QuoteRequest {
  tenantId: string;
  planCode: string;                    // <- paket langganan SaaS
  paymentMode: SubscriptionPaymentMode;
  deviceIds?: string[];                // <- perangkat POS yang dilanggankan
  billingInterval?: BillingInterval;   // <- bulanan/tahunan
  ...
}
```

Ini menghitung **berapa yang harus dibayar penyewa kepada kita**, bukan berapa
yang harus dibayar pembeli kepada penyewa. Tidak ada `productId`, tidak ada
`outletId`, tidak ada `quantity` per produk, tidak ada `taxCategory`.

Mesin kuotasi harga POS harus dibangun baru. Yang dapat diambil dari sini
hanyalah `DiscountEvaluatorService` yang dipakainya.

### `modules/order/` — pesanan **marketplace**, bukan penjualan kasir

`OrderService` menangani pesanan daring: pembeli, alamat kirim, kelompok
penjual, status pengiriman. Kasir tidak punya pembeli terdaftar, tidak punya
alamat kirim, dan barangnya berpindah tangan seketika. Hanya
`StockReservationService` di dalamnya yang benar-benar netral terhadap kanal.

### `sales_order` / `sales_order_line` — pesanan penjualan, bukan transaksi kasir

Tabel ini ada pada `V006` bersama tabel POS, sehingga mudah dikira bagian dari
alur kasir. Sesungguhnya ini pesanan penjualan B2B: punya `delivery_date`,
`ordered_qty` versus `delivered_qty`, dan `channel`. Alur kasir memakai
`pos_sale`, dan keduanya tidak boleh dicampur.

---

## Aturan yang dipegang selama POS dibangun

1. **Bila sudah ada dan netral terhadap kanal, pakai.** Reservasi stok, audit,
   notifikasi, penomoran, cakupan data.
2. **Bila polanya sudah terbukti, tiru polanya — jangan menyalin kodenya.**
   Mesin transisi status, mesin posting, penomoran anti-kembar.
3. **Bila khusus marketplace, jangan dipaksa dipakai.** Memaksa aturan retur
   marketplace berlaku di kasir akan menghasilkan aturan yang salah di kedua
   tempat.
4. **Bila membangun baru, letakkan di `modules/pos/`.** Satu modul, bukan
   tersebar — sehingga cakupan POS dapat dilihat dan diuji sebagai satu
   kesatuan.
