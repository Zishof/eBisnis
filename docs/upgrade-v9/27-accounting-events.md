# 27 — Peristiwa Akuntansi dan Aturan Posting (V9-14)

Menutup D30–D31 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel tenant baru (V015) | 2 |
| Test baru | 28 |

## Debit dan kredit tinggal di data, bukan di kode

Blueprint melarang menulis debit/kredit di controller. Larangan itu **tidak
dapat ditegakkan hanya dengan disiplin**: satu endpoint baru yang lupa akan
membuat jurnal dengan akun yang berbeda dari endpoint lain untuk peristiwa yang
sama.

```text
Kode  ->  "peristiwa ini terjadi dengan nilai sekian"
Data  ->  akun mana yang didebit dan dikredit
```

`accounting_posting_rule` dapat diubah tanpa rilis.

## Tidak ada buku besar kedua

`journal_entry` dan `journal_entry_line` yang sudah ada sejak V006 dipakai apa
adanya. Kolom `source_type`, `source_id`, dan `posting_key` di sana **memang
sudah dirancang** untuk penelusuran sumber-ke-jurnal.

Yang ditambahkan hanya lapisan yang memetakan peristiwa bisnis ke jurnal.

## Aturan menunjuk nama medan, bukan rumus

```sql
amount_key VARCHAR(48)   -- 'gross', 'netSales', 'tax'
```

Rumus bebas pada data adalah pintu masuk eksekusi kode yang tidak diinginkan.
Larangan `eval` dan `Function` berlaku di sini sebagaimana pada mesin diskon.

Templat keterangan pun hanya mengganti penanda yang dikenal — templat yang
dapat mengevaluasi apa pun adalah rumus bebas dengan nama lain. Diuji: string
`${process.env.SECRET}` keluar apa adanya.

## Peristiwa dipisahkan dari jurnal

Satu baris `accounting_event` berarti "hal ini terjadi dan berdampak pada
pembukuan". Penjurnalannya menyusul, mungkin oleh penjadwal.

Memisahkannya membuat **kegagalan menjurnal tidak membatalkan transaksi
bisnisnya** — pesanan yang lunas tetap lunas meski pembukuannya belum
terbentuk.

Basis data menjaga agar keduanya tetap sejalan:

```sql
CONSTRAINT ck_accounting_event_posted CHECK (
  status <> 'POSTED' OR journal_entry_id IS NOT NULL
)
```

Tanpa itu, "sudah dijurnal" dapat berdiri tanpa jurnal yang dapat diperiksa.

## Jurnal tidak seimbang tidak pernah disimpan

Menyimpannya berarti neraca tidak akan pernah seimbang lagi, dan menemukan
penyebabnya kemudian jauh lebih mahal daripada menolaknya sekarang.

Selisihnya disebut pada alasan penolakan, bukan sekadar "tidak seimbang".

## Nilai negatif ditolak

Pembalikan jurnal dilakukan dengan **menukar sisi debit dan kredit**, bukan
dengan nilai negatif. Jurnal bernilai negatif membuat laporan sulit dibaca dan
mudah salah jumlah.

## Aturan ada tetapi belum berlaku ≠ tidak ada aturan

Dibedakan dengan sengaja. Kebijakan yang lupa diperpanjang menghasilkan
`RULE_NOT_EFFECTIVE`, bukan `NO_RULE` — dan perbedaan itu langsung menunjuk ke
penyebabnya.

## Dua belas peristiwa marketplace

```text
MARKETPLACE_SALE_RECOGNIZED     MARKETPLACE_PAYMENT_RECEIVED
MARKETPLACE_PLATFORM_FEE_ACCRUED MARKETPLACE_PLATFORM_FEE_BILLED
MARKETPLACE_SHIPPING_COST       MARKETPLACE_PACKAGING_COST
MARKETPLACE_DISCOUNT_SELLER     MARKETPLACE_DISCOUNT_PLATFORM
MARKETPLACE_RETURN_RECEIVED     MARKETPLACE_REFUND
MARKETPLACE_COGS                MARKETPLACE_INVENTORY_RELEASE
```

Peristiwa di luar daftar **ditolak**. Salah ketik tidak boleh menghasilkan
peristiwa yang tidak pernah punya aturan dan diam-diam tidak pernah dijurnal —
`MARKETPLACE_SALE_RECOGNISED` (ejaan Britania) ditolak, dan itu diuji.

Setiap peristiwa mendeklarasikan nilai wajibnya. Kelengkapan diperiksa **saat
peristiwa dibuat**, ketika konteksnya masih ada, bukan saat dijurnal jauh
kemudian.

## Bukti

```text
V015 diterapkan ke 14 dari 14 schema tenant
710 test lulus (naik dari 682)
15 migration lulus verifikasi
```

## Keterbatasan yang diketahui

**Aturan posting belum diseed.** Tabelnya ada dan mesinnya berjalan, tetapi
tidak ada satu pun baris aturan. Menyeed-nya menuntut pemetaan ke bagan akun
tenant yang berbeda-beda antar tenant — dan menebak nomor akun akan
menghasilkan jurnal yang salah pada tenant yang bagan akunnya berbeda.

**Peristiwa belum dipancarkan.** `MarketplacePaymentService` dan
`OrderService` belum memanggil pembuatan peristiwa. Penyambungannya menuntut
aturan posting ada lebih dahulu; memancarkan peristiwa yang tidak dapat
dijurnal hanya menumpuk antrean gagal.

**Penjadwal penjurnalan belum ada.** Peristiwa berstatus `PENDING` belum
diproses siapa pun.

**Laporan belum dibuat.** GMV, net sales, dan sisanya menuntut peristiwa
mengalir lebih dahulu.
