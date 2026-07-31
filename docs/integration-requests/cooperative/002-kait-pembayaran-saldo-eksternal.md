# IR-002 · Kait pembayaran bersaldo eksternal pada POS

**Dari:** sesi eKoperasi (`feature/v12-ekoperasi`)
**Kepada:** sesi Core / Integrator
**Tanggal:** 31 Juli 2026
**Sifat:** Tidak memblokir — K-7d dapat ditunda
**Berkas bersama:** `apps/api/src/modules/pos/pos-sale.service.ts`,
`apps/api/src/modules/pos/pos.module.ts`

---

## Kebutuhan

Anggota koperasi membayar belanjaannya di unit toko dengan **saldo simpanan
sukarela** atau dengan **pembelian kredit** yang memotong plafonnya.

Keduanya memerlukan POS memanggil koperasi saat pembayaran, karena hanya
koperasi yang tahu berapa saldo dan plafon anggota — dan hanya koperasi yang
boleh memverifikasi PIN-nya.

## Yang TIDAK diminta

Supaya jelas sejak awal:

```
BUKAN meminta POS mengenal koperasi.
BUKAN meminta tabel koperasi dibaca dari kode POS.
BUKAN meminta perubahan alur kasir yang sudah berjalan.
BUKAN meminta metode pembayaran baru dibakukan di POS.
```

Yang diminta hanya **satu titik perluasan**: registri penangan pembayaran
bertipe eksternal.

## Kontrak yang diusulkan

`payment_method.method_type` sudah ada. Ditambahkan satu nilai baru,
`EXTERNAL_BALANCE`, dan satu registri:

```ts
// apps/api/src/modules/pos/external-payment.registry.ts  (Core)

export interface ExternalPaymentHandler {
  /** Nilai payment_method.external_handler yang ditangani. */
  readonly handlerCode: string;

  /**
   * Menahan dana. Dipanggil sebelum pembayaran dicatat.
   * Menolak dengan pesan yang dapat dibaca kasir bila saldo tidak cukup.
   */
  authorize(ctx: ExternalPaymentContext): Promise<ExternalPaymentAuthorization>;

  /** Mewujudkan penahanan. Dipanggil di dalam transaksi penyelesaian. */
  capture(ctx: { schemaName: string; reference: string }): Promise<void>;

  /** Melepaskan penahanan. Dipanggil bila penjualan batal atau gagal. */
  reverse(ctx: { schemaName: string; reference: string; reason: string }): Promise<void>;
}

export interface ExternalPaymentContext {
  schemaName: string;
  saleId: string;
  outletId: string;
  customerId: string | null;
  amount: string;
  /**
   * Bukti sekali pakai dari layar milik penyedia penangan.
   * POS tidak pernah menerima, menyimpan, maupun meneruskan PIN.
   */
  authToken?: string;
}

export interface ExternalPaymentAuthorization {
  authorized: boolean;
  reference: string;
  /** Pesan untuk kasir bila ditolak — tanpa data pribadi. */
  message?: string;
}
```

Pendaftarannya oleh modul, bukan oleh POS:

```ts
// modules/cooperative/cooperative.module.ts
constructor(registry: ExternalPaymentRegistry, handler: MemberBalancePaymentHandler) {
  registry.register(handler);   // handlerCode: 'COOPERATIVE_MEMBER_BALANCE'
}
```

## Titik pemanggilan pada POS

Tiga tempat, seluruhnya pada alur yang sudah ada:

| Kapan | Panggilan | Bila gagal |
|---|---|---|
| `tambahPembayaran()` sebelum baris `pos_payment` disimpan | `authorize()` | Pembayaran ditolak dengan pesan dari penangan |
| `selesaikan()` di dalam transaksi, setelah stok dipotong | `capture()` | Seluruh transaksi digulung balik |
| Pembatalan atau void | `reverse()` | Dicatat sebagai galat, ditagih ulang penjadwal |

`capture()` **wajib** berada di dalam transaksi penyelesaian. Pemotongan saldo
anggota yang berhasil tanpa penjualan yang menaunginya adalah uang anggota yang
hilang tanpa jejak.

## Keamanan

Spesifikasi eKoperasi §14 menyebut tegas: *"PIN anggota tidak boleh terlihat oleh
kasir."* Karena itu:

- Layar PIN adalah milik koperasi, ditampilkan pada perangkat anggota atau pada
  pinpad terpisah — **bukan** pada layar kasir.
- Yang diserahkan ke POS hanya `authToken` sekali pakai berumur 60 detik.
- `authToken` tidak pernah masuk log, audit, maupun pesan galat.
- POS tidak menyimpan `authToken` pada `pos_payment`; yang disimpan hanya
  `reference` dari hasil `authorize()`.

## Kompatibilitas mundur

Penuh. Bila tidak ada penangan yang terdaftar, `EXTERNAL_BALANCE` tidak pernah
muncul sebagai metode pembayaran, dan alur POS berjalan persis seperti sekarang.
Penyewa non-koperasi tidak terpengaruh sama sekali.

## Migrasi

Satu, milik Core:

```sql
-- payment_method.method_type bertambah nilai EXTERNAL_BALANCE
-- payment_method bertambah kolom external_handler VARCHAR(64) NULL
```

Aditif; tidak ada baris yang berubah.

## Pengujian yang diusulkan

```
tanpa penangan terdaftar, metode EXTERNAL_BALANCE tidak dapat dipakai
authorize menolak -> pembayaran tidak tercatat, pesan sampai ke kasir
capture gagal -> seluruh penyelesaian digulung balik, stok tidak berkurang
pembatalan penjualan memanggil reverse
authToken tidak muncul pada pos_payment, log, maupun audit
dua penangan dengan handlerCode sama ditolak saat pendaftaran
penyelesaian yang terulang tidak memanggil capture dua kali
```

## Sementara menunggu

Unit toko koperasi berjalan penuh dengan tunai dan nontunai biasa. K-7d
(pembayaran saldo dan kredit anggota) ditunda dan **tidak menahan** K-8 sampai
K-11.

Yang **tidak** akan dilakukan sementara menunggu: menyunting `pos-sale.service.ts`
dari worktree koperasi. Perintah §3 melarangnya, dan alasannya benar — POS sedang
dikerjakan sesi Core, dan dua penulis pada satu berkas jalur uang adalah cara
tercepat menghasilkan cacat yang tidak dapat ditelusuri.
