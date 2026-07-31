# 24 — Retur, Pengembalian Dana, dan Sengketa (V9-10)

Menutup D21–D23 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel platform baru | 5 |
| Test baru | 37 |

## Pengembalian dana tidak dikarang

eSmartlink belum terbukti punya API pengembalian dana. `MANUAL_REQUIRED` ada
dan **dipakai sungguhan**: sistem mencatat bahwa dana harus dikembalikan, siapa
yang harus melakukannya, dan buktinya — tetapi tidak berpura-pura mengirim
perintah yang tidak ada.

Metode `PROVIDER` disediakan agar tidak perlu membongkar apa pun ketika
kemampuan itu terbukti tersedia.

### Bukti wajib pada metode manual

Tanpa bukti, "sudah dikembalikan" hanya klaim — dan klaim tanpa bukti tidak
dapat dipertanggungjawabkan bila pembeli mempersoalkannya.

## Yang dikembalikan adalah yang benar-benar diterima

| Hasil pemeriksaan | Dikembalikan? |
| --- | --- |
| `GOOD` | ya |
| `DAMAGED` | tidak |
| `MISSING` | tidak |
| `NOT_RECEIVED` | tidak |

Kalau barang yang tidak sampai tetap dikembalikan dananya, retur menjadi cara
mendapat barang gratis.

Nilai yang **dikecualikan** ikut dilaporkan agar dapat dijelaskan kepada
pembeli, bukan sekadar menghasilkan angka yang lebih kecil tanpa keterangan.

## Ongkos kirim awal

Dikembalikan hanya bila kesalahan ada pada penjual. `CHANGED_MIND` menanggung
sendiri; `DAMAGED`, `WRONG_ITEM`, `NOT_AS_DESCRIBED`, dan `MISSING_PART`
ditanggung penjual.

Bila tidak ada satu pun barang yang layak dikembalikan dananya, ongkos kirim
juga tidak — tidak ada dasar untuk mengembalikannya.

## Yang sudah pernah diretur ikut dihitung

Tanpa itu pembeli dapat meretur lebih banyak daripada yang dibelinya lewat
beberapa pengajuan terpisah. Pesan penolakan menyebut **sisa** yang masih dapat
diretur, bukan sekadar menolak.

## Penolakan bukan kata akhir

`REJECTED → DISPUTED` diizinkan. Itulah gunanya sengketa: keputusan penjual
dapat ditinjau platform.

Keputusan sengketa **wajib beralasan tertulis**. Sengketa yang diputus tanpa
alasan tidak dapat dipertanggungjawabkan bila dipersoalkan kemudian.

Bukti sengketa bersifat append-only — bukti yang dapat dihapus setelah diajukan
tidak berguna sebagai bukti.

## Keterbatasan yang diketahui

**Endpoint belum dipasang.** Aturan dan tabelnya lengkap dan diuji, tetapi
jalur HTTP-nya menyusul bersama UI retur. Membangun endpoint tanpa UI akan
menghasilkan jalur yang tidak pernah dipanggil siapa pun.

**Barang retur belum masuk kembali ke stok.** `disposition` mencatat niatnya
(`RESTOCK`, `SCRAP`, `REPAIR`) tetapi penambahan stok menyusul bersama
penyambungan ke pemenuhan.

**Penukaran barang belum berjalan.** `requestedResolution` menerima `EXCHANGE`,
tetapi pesanan pengganti belum dibuat otomatis.

**Batas waktu retur masih tetap tujuh hari.** Belum dapat disetel per kategori
maupun per penjual.
