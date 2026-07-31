# K-0 · Kontrak Integrasi POS

Unit toko dan kantin koperasi memakai **POS Core yang sama**, lewat adapter.
Perintah eKoperasi §3 menegaskan batasnya: *"sesi koperasi hanya membuat
adapter/extension contract. Jangan mengubah behavior POS yang sedang dikerjakan
sesi Core."*

Dokumen ini menetapkan kontraknya sebelum satu baris adapter ditulis, supaya
sesi Core dapat menolak atau menyetujui bentuknya lebih dahulu.

---

## Mengapa bukan POS kedua

Godaannya nyata: POS koperasi punya kebutuhan yang tidak dimiliki POS ritel —
harga khusus anggota, pembayaran dengan saldo simpanan, pembelian kredit yang
memotong plafon, dan pencatatan patronage untuk SHU.

Membangun POS kedua akan menyelesaikan keempatnya dalam sehari, dan menimbulkan
masalah yang tidak selesai bertahun-tahun:

- **Persediaan terbelah.** Satu barang punya dua angka stok yang tidak pernah
  cocok, dan tidak ada yang tahu mana yang benar saat opname.
- **Pembukuan terbelah.** Dua jalur jurnal untuk satu jenis transaksi, dan
  laporan konsolidasi menjadi pekerjaan tangan.
- **Perbaikan tidak menyebar.** Cacat yang dibetulkan pada POS Core tetap ada
  pada POS koperasi sampai seseorang ingat menyalinnya.

Karena itu unit usaha koperasi adalah **outlet biasa** dengan pemilik berupa
unit usaha, dan keempat kebutuhan di atas dipenuhi lewat titik perluasan.

---

## Bentuk keterhubungan

```
cooperative_unit_business
        │
        │  cooperative_unit_pos_link
        ▼
   outlet (Core)  ──┬──  pos_terminal (Core)
                    ├──  warehouse (Core)
                    └──  pos_sale (Core)
                              │
                              │  cooperative_member_transaction
                              ▼
                    cooperative_member  →  patronage  →  SHU
```

`cooperative_unit_pos_link` adalah satu-satunya tempat kedua konteks bertemu.
Menghapusnya harus cukup untuk membuat POS berjalan tanpa koperasi, dan koperasi
berjalan tanpa POS.

---

## Port yang didefinisikan koperasi

Ditulis di `modules/cooperative/ports/pos.port.ts`. **Koperasi yang
mendefinisikan, Core yang tidak perlu tahu.** Adapternya
(`modules/cooperative/adapters/pos.adapter.ts`) memanggil layanan POS Core yang
sudah publik.

```ts
export interface PosPort {
  /** Outlet yang dimiliki sebuah unit usaha. */
  outletsOfUnit(schemaName: string, unitBusinessId: string): Promise<OutletRef[]>;

  /** Penjualan selesai pada rentang tanggal, untuk perhitungan patronage. */
  completedSales(
    schemaName: string,
    filter: { outletIds: string[]; from: string; to: string; customerIds?: string[] },
  ): Promise<SaleSummary[]>;

  /** Satu penjualan beserta barisnya, untuk penelusuran. */
  saleDetail(schemaName: string, saleId: string): Promise<SaleDetail | null>;
}

export interface SaleSummary {
  saleId: string;
  outletId: string;
  customerId: string | null;
  businessDate: string;
  grandTotal: string;
  status: string;
}
```

Perhatikan apa yang **tidak** ada: tidak ada `createSale`, `addPayment`, maupun
`completeSale`. Koperasi **membaca** dari POS; ia tidak menjual lewat POS. Kasir
tetap memakai layar kasir Core.

---

## Empat kebutuhan koperasi dan cara memenuhinya

### 1. Harga khusus anggota

**Tanpa mengubah POS.** `price_book` Core sudah punya `scope_type`/`scope_id`.
Koperasi membuat buku harga berlingkup kelompok pelanggan, dan menautkan
kategori anggota ke kelompok pelanggan itu:

```
cooperative_member_category  ──▶  customer_group (Core)  ──▶  price_book (Core)
```

Kasir memindai kartu anggota, POS mengenali pelanggannya, dan harga anggota
berlaku lewat mekanisme yang sudah ada.

**Yang dibutuhkan dari Core:** tidak ada.

### 2. Pembayaran dengan saldo simpanan sukarela

**Perlu titik perluasan.** POS Core mengenal `payment_method` dengan
`method_type`. Koperasi memerlukan metode `MEMBER_BALANCE` yang, saat dipakai,
memanggil koperasi untuk memotong saldo.

Ini **satu-satunya** tempat POS perlu memanggil koperasi, dan bentuk yang
diusulkan adalah kait berbasis metode pembayaran — bukan kode koperasi di dalam
POS:

```ts
// Didaftarkan koperasi, dipanggil POS saat metode bertipe EXTERNAL_BALANCE.
export interface ExternalBalancePaymentHandler {
  methodType: 'MEMBER_BALANCE';
  authorize(ctx: { schemaName: string; customerId: string; amount: string; pinToken: string }):
    Promise<{ authorized: boolean; reference: string; message?: string }>;
  capture(ctx: { reference: string }): Promise<void>;
  reverse(ctx: { reference: string; reason: string }): Promise<void>;
}
```

**Yang dibutuhkan dari Core:** registri kait pembayaran bertipe eksternal.
→ [Permintaan integrasi 002](../integration-requests/cooperative/002-kait-pembayaran-saldo-eksternal.md)

**Sampai disetujui:** unit toko koperasi berjalan dengan tunai dan nontunai
biasa. Pembayaran dengan saldo simpanan ditunda, bukan diakali dengan menyunting
POS.

**Catatan keamanan:** PIN anggota **tidak pernah** sampai ke kasir maupun ke
POS. Layar PIN adalah milik koperasi, dan yang diserahkan ke POS hanya
`pinToken` sekali pakai berumur pendek. Spesifikasi §14 menyebutnya tegas: *"PIN
anggota tidak boleh terlihat oleh kasir."*

### 3. Pembelian kredit yang memotong plafon anggota

Sama bentuknya dengan (2), memakai kait yang sama dengan `methodType`
`MEMBER_CREDIT`. Otorisasinya memeriksa plafon dan tunggakan, bukan saldo.

### 4. Patronage untuk SHU

**Tanpa mengubah POS.** Koperasi membaca penjualan selesai lewat
`PosPort.completedSales()` pada akhir periode, lalu menjumlahkannya per anggota
menjadi `cooperative_member_patronage`.

Dibaca berkala, bukan ditulis saat transaksi. Alasannya bukan kemudahan:
patronage dihitung atas **periode buku yang sudah ditutup**, dan menuliskannya
saat transaksi berarti angkanya ikut berubah setiap ada retur — sesudah SHU
dihitung.

---

## Apa yang TIDAK boleh dilakukan adapter

Ditulis tegas supaya tidak perlu diperdebatkan kemudian:

```
JANGAN menulis ke pos_sale, pos_sale_line, pos_payment, atau pos_shift.
JANGAN mengubah stock_balance atau stock_movement dari kode koperasi.
JANGAN membuat accounting_event bertanda source_type POS_SALE.
JANGAN menyalin layanan POS ke modules/cooperative/.
JANGAN membaca tabel pos_* langsung tanpa melewati PosPort.
```

Yang ketiga perlu keterangan: penjualan di unit toko **sudah** menghasilkan
jurnal lewat mesin POS. Koperasi menambahkan jurnal keduanya hanya untuk hal
yang tidak diketahui POS — pemotongan saldo simpanan, misalnya, yang bagi POS
tampak seperti pembayaran biasa. Menjurnal ulang penjualannya akan menggandakan
pendapatan.

---

## Urutan pengerjaan

| Tahap | Bergantung pada Core? | Isi |
|---|---|---|
| K-7a | tidak | `cooperative_unit_business`, `cooperative_unit_pos_link`, `PosPort` + adapter baca |
| K-7b | tidak | Harga anggota lewat `customer_group` + `price_book` |
| K-7c | tidak | Patronage dari pembacaan berkala |
| K-7d | **ya** | Pembayaran saldo dan kredit anggota — menunggu permintaan integrasi 002 |

K-7d dapat ditunda tanpa menahan K-8 sampai K-11. Unit toko yang menerima tunai
sudah berfungsi penuh.
