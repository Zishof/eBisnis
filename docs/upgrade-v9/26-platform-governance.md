# 26 — Tata Kelola Platform (V9-12)

Menutup D27–D29 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 5 |
| Test baru | 41 |

## Biaya diakrualkan, bukan dipotong dari setelmen

Memotong biaya dari setelmen menuntut penyedia pembayaran membagi dana ke
beberapa rekening. eSmartlink belum terbukti mendukungnya, dan membuat
pembagian sendiri berarti platform menampung uang penjual — kegiatan yang
menuntut izin yang tidak dimiliki.

```text
Pembeli bayar  ->  penjual menerima PENUH
                   platform mencatat biaya sebagai kewajiban penjual
                   ->  ditagihkan lewat faktur platform yang sudah ada
```

Bentuk ini juga lebih jujur secara akuntansi: pendapatan penjual dan biaya
platform adalah **dua peristiwa berbeda**, bukan satu angka bersih.

### Diakrualkan saat lunas, bukan saat dipesan

Biaya atas pesanan yang tidak jadi dibayar bukan pendapatan platform.

Batasan unik pada `orderId` menjaga agar peristiwa pembayaran yang sampai
berulang tidak menambah tagihan berkali-kali.

### Ongkos kirim tidak termasuk dasar perhitungan

Biaya atas ongkos kirim berarti platform menarik bagian dari uang yang
diteruskan penjual kepada ekspedisi.

### Biaya tidak pernah melebihi nilai barang

Penjual tidak boleh menerima pesanan lalu berutang lebih besar daripada nilai
yang dijualnya.

## Yang lebih khusus menang

```text
kebijakan penjual  >  kebijakan kategori  >  kebijakan umum
```

Tanpa urutan ini, kesepakatan khusus dengan satu penjual akan tertimpa
kebijakan umum yang diperbarui belakangan.

Pada kekhususan yang sama, yang paling baru berlaku.

## Kebijakan berversi

Biaya yang berubah tidak boleh mengubah tagihan yang sudah terbentuk. Tarif
yang berlaku **disalin** ke `rateSnapshot` pada akrual, sehingga tagihan dapat
diperiksa meski kebijakannya sudah berganti versi.

## Penangguhan pada poin terakumulasi

| Tingkat | Poin | Hukuman pertama |
| --- | ---: | --- |
| `LOW` | 1 | peringatan |
| `MEDIUM` | 3 | produk ditarik |
| `HIGH` | 6 | produk ditangguhkan |
| `CRITICAL` | 12 | **penjual ditangguhkan seketika** |

Kecuali yang kritis, penangguhan penjual terjadi pada poin terakumulasi
mencapai 12 — bukan pada satu pelanggaran.

Menangguhkan penjual karena satu kesalahan kecil menghentikan penghidupannya
atas hal yang mungkin kekeliruan.

## Banding wajib ada

Pelanggaran tanpa jalan banding membuat kesalahan moderator menjadi permanen.
Batasnya 14 hari sejak dicatat.

## Penyaring memicu peninjauan, bukan penolakan

Kata "pisau" muncul pada pisau dapur maupun pada barang terlarang. Menolak
otomatis akan menghalangi penjualan yang sah.

Pencocokan memakai **batas kata**, bukan sebagian — tanpa itu, "sabu" akan
cocok pada "sabun". Kata kunci yang memicunya ikut dilaporkan agar peninjau
tahu apa yang dicurigai.

## Laporan orang didahulukan daripada penyaring

| Pemicu | Prioritas |
| --- | ---: |
| Produk terlarang | 1 |
| **Dilaporkan orang** | 10 |
| Produk terbatas | 20 |
| Penyaring otomatis | 50 |
| Pemeriksaan berkala | 100 |

Seseorang meluangkan waktu melaporkannya, dan penyaring lebih sering keliru.

## Satu antrean untuk seluruh jenis objek

Antrean terpisah per jenis akan membuat moderator berpindah-pindah layar dan
kehilangan gambaran beban keseluruhan.

## Keterbatasan yang diketahui

**Endpoint belum dipasang.** Aturan dan tabelnya lengkap dan diuji; jalur HTTP
menyusul bersama UI moderasi platform.

**Akrual belum tersambung ke pembayaran.** `MarketplacePaymentService` belum
memanggil pembentukan akrual saat pesanan lunas.

**Penagihan biaya belum tersambung ke faktur.** `invoiceId` pada akrual masih
selalu kosong; penyambungannya menuntut keputusan tentang siklus penagihan
(bulanan, per pesanan, atau atas permintaan).

**Moderasi belum berjalan otomatis.** Antreannya ada tetapi tidak ada yang
mengisinya — penyaring belum dipanggil saat listing diterbitkan.
