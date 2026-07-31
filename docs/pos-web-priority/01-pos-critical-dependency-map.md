# POS-0 · Peta Dependensi Jalur Kritis

Apa yang harus ada lebih dahulu supaya kasir dapat menyelesaikan satu transaksi.

---

## Rantai dependensi

```
Tenant / Brand / Outlet                    [DONE]
          |
          v
User / Role / Permission / Data Scope      [DONE, kecuali hak akses POS]
          |
          v
Register (pos_terminal) + Penugasan Kasir  [PARTIAL — penugasan MISSING]
          |
          v
Shift (pos_shift) + Kas Awal               [PARTIAL]
          |
    +-----+-----------------+
    |                       |
    v                       v
Katalog / Barcode      Pelanggan            [DONE / DONE]
    |
    v
Harga / Pajak / Promosi                    [MISSING — mesin kuotasi POS]
    |
    v
Ketersediaan Stok                          [DONE — layanannya; endpoint MISSING]
    |
    v
Keranjang / Penjualan (pos_sale)           [PARTIAL — tabel ada, mesinnya belum]
    |
    v
Pembayaran (pos_payment)                   [PARTIAL]
    |
    +----------+
    |          |
    v          v
Struk      Pergerakan Stok                 [PARTIAL / DONE]
                |
                v
        Peristiwa Akuntansi                [PARTIAL — kode POS_* MISSING]
                |
                v
        Laporan / Audit                    [MISSING / DONE]
```

Seluruh simpul sampai Pembayaran, Struk, Pergerakan Stok, dan Penutupan Shift
berstatus **P0**.

---

## Simpul yang menahan simpul lain

Diurutkan menurut berapa banyak pekerjaan lain yang tertahan olehnya. Inilah
urutan pengerjaan yang sesungguhnya penting — bukan urutan nomor fase.

### 1. Hak akses POS (menahan seluruh fase berikutnya)

Tanpa `POS.SELL`, `POS.OPEN_SHIFT`, `POS.DISCOUNT_LINE`, dan seterusnya, setiap
endpoint yang dibangun harus memakai penjaga sementara — dan penjaga sementara
pada jalur uang punya kebiasaan buruk untuk tetap tinggal. Hak aksesnya harus
ada sebelum endpoint pertama ditulis, bukan sesudahnya.

**Menahan:** POS-1 sampai POS-9, seluruhnya.

### 2. Penugasan kasir ke register (menahan seluruh konteks transaksi)

`pos_sale` mensyaratkan `shift_id`, dan `pos_shift` mensyaratkan `terminal_id`.
Tetapi tidak ada yang membatasi kasir mana boleh membuka shift pada terminal
mana. Selama itu belum ada, aturan "kasir hanya outlet yang ditugaskan" tidak
dapat ditegakkan maupun diuji.

**Menahan:** POS-1, POS-4, dan seluruh pengujian cakupan data POS.

### 3. Mesin kuotasi harga POS (menahan keranjang)

Baris keranjang tidak dapat ditambahkan tanpa harga, dan harga tidak boleh
berasal dari peramban. Ini pekerjaan terbesar pada jalur kritis, dan
`PricingEngineService` yang sudah ada **tidak dapat dipakai** — mesin itu
menghitung tagihan langganan SaaS, bukan harga produk.

**Menahan:** POS-5, POS-6, POS-7, POS-9.

### 4. Kode peristiwa akuntansi `POS_*` (menahan penyelesaian transaksi)

Batas penyelesaian pada perintah §13 mensyaratkan pembentukan peristiwa
akuntansi sebelum penjualan ditandai selesai. Mesin postingnya sudah ada, tetapi
hanya mengenal dua belas kode `MARKETPLACE_*`. Dua belas kode `POS_*` beserta
aturan postingnya harus ditambahkan.

**Menahan:** POS-6 (penyelesaian), POS-8 (pembalikan).

### 5. Mesin transisi status penjualan (menahan void/retur/refund)

Tiga belas status pada perintah §6.9 memerlukan tabel transisi yang tegas,
seperti `order-state.ts` pada marketplace. Tanpa itu, void dan retur akan
ditulis sebagai serangkaian pemeriksaan `if` yang tersebar — dan aturan "kasir
tidak boleh menyetujui refund sendiri" akan mudah terlewat di salah satu jalan.

**Menahan:** POS-8.

---

## Yang **tidak** menahan apa pun

Berguna untuk diketahui supaya tidak dikerjakan lebih dahulu daripada perlunya:

| Kemampuan | Mengapa tidak menahan |
|---|---|
| Mode luring (offline-first) | `pos_sale.offline_id` dan `sync_status` sudah disiapkan. Kasir daring dapat berjualan tanpa ini |
| Varian produk | Produk tanpa varian tetap dapat dijual. Diperlukan untuk katalog yang lengkap, bukan untuk transaksi pertama |
| Promosi | Penjualan tanpa promosi tetap sah. Diskon manual dengan izin sudah cukup untuk P0 |
| AI POS | Perintah §19 menyebutnya non-pemblokir secara eksplisit |
| Ekspedisi, investor | Di luar lingkup POS sama sekali |

---

## Urutan yang disarankan

Berbeda sedikit dari urutan nomor fase pada perintah, karena dua hal harus naik
lebih awal:

```
POS-1a  hak akses POS + peran bawaan          <- dinaikkan
POS-1b  konteks, register, penugasan kasir
POS-2   katalog, barcode, mesin harga, pajak
POS-3   ketersediaan stok (endpoint)
POS-4   register, shift, kas
POS-5a  mesin transisi status penjualan       <- dinaikkan
POS-5b  keranjang dan mesin penjualan
POS-6a  kode peristiwa akuntansi POS_*        <- dinaikkan
POS-6b  pembayaran dan penyelesaian
POS-7   struk
POS-8   void, retur, refund
POS-9   dasbor dan laporan
POS-10  data contoh POS
POS-11  bantuan            (BLOCKED — perlu V8-1/V8-2)
POS-12  AI non-pemblokir
```

Ketiga yang dinaikkan bukan fase baru — melainkan bagian dari fasenya
masing-masing yang dikerjakan lebih dahulu, karena bila dikerjakan belakangan
akan memaksa membongkar apa yang sudah ditulis di atasnya.
