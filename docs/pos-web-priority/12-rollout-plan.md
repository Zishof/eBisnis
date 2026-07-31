# POS-0 · Rencana Peluncuran

---

## Urutan fase

Mengikuti perintah prioritas, dengan tiga bagian yang dinaikkan karena bila
dikerjakan belakangan akan memaksa membongkar apa yang sudah ditulis di atasnya
(alasannya pada [01](01-pos-critical-dependency-map.md)).

| Fase | Isi | Migrasi | Tes baru (min.) |
|---|---|---|---|
| **POS-1a** | Hak akses POS, menu POS, peran bawaan, aturan SoD | `V024` | 8 |
| **POS-1b** | Konteks, register, penugasan kasir | `V024` | 12 |
| **POS-2** | Katalog, barcode, mesin kuotasi harga, pajak, promosi | `V025` | 16 |
| **POS-3** | Endpoint ketersediaan stok | — | 10 |
| **POS-4** | Register, shift, kas, rekonsiliasi | `V026` | 10 |
| **POS-5a** | Mesin transisi status penjualan | — | 6 |
| **POS-5b** | Keranjang dan mesin penjualan | `V027` | 18 |
| **POS-6a** | Dua belas kode peristiwa akuntansi `POS_*` | — | 8 |
| **POS-6b** | Pembayaran dan penyelesaian | `V028` | 14 |
| **POS-7** | Struk | `V029` | 8 |
| **POS-8** | Void, retur, refund | `V030` | 12 |
| **POS-9** | Dasbor dan laporan | — | 8 |
| **POS-10** | Data contoh POS | — | 6 |
| **POS-11** | Bantuan — **TERTAHAN** (perlu V8-1/V8-2) | — | — |
| **POS-12** | AI non-pemblokir | — | 4 |

Total pengujian baru minimum: **140**.

Migrasi diberi nomor berurutan mulai `V024` dan seluruhnya aditif. Tidak ada
yang menyentuh `V001`–`V023` yang sudah diterapkan pada 14 skema tenant.

## Setiap fase menghasilkan

Sesuai perintah §27, tidak ada fase yang dianggap selesai tanpa kesepuluh hal
berikut:

```
migrasi aditif  ·  API + OpenAPI  ·  Orval  ·  UI  ·  hak akses
audit           ·  pengujian      ·  Help    ·  CHANGELOG
commit + push + SHA + hasil CI
```

Bila Help tertahan (POS-11), yang dicatat adalah **tertahan beserta sebabnya**,
bukan dilewati diam-diam.

## Gerbang go-live

Kasir baru boleh berjualan sungguhan setelah kedelapan belas butir berikut
terpenuhi. Daftar ini disalin dari perintah §25 dan menjadi ukuran tunggal
"POS selesai":

```
[ ] login / peran / outlet / register berjalan
[ ] buka shift berjalan
[ ] pencarian barcode berjalan
[ ] harga, pajak, promosi benar
[ ] validasi stok berjalan
[ ] keranjang berjalan
[ ] pembayaran tunai berjalan
[ ] pembayaran majemuk berjalan
[ ] struk berjalan
[ ] posting persediaan berjalan
[ ] peristiwa akuntansi berjalan
[ ] tahan / lanjutkan berjalan
[ ] void / retur / refund berjalan
[ ] tutup shift dan rekonsiliasi berjalan
[ ] laporan berjalan
[ ] hak akses dan pemisahan wewenang berjalan
[ ] audit dan observabilitas berjalan
[ ] E2E lulus, CI hijau, tidak ada temuan keamanan kritis/tinggi
```

**Halaman kasir yang sudah tampil bukan POS yang selesai.** Perintah §1
menyebutnya secara eksplisit, dan itu memang godaan yang nyata: layar kasir
adalah bagian yang paling terlihat dan paling cepat dikerjakan, sementara
rekonsiliasi kas dan pembalikan jurnal adalah bagian yang menentukan apakah
sistem ini dapat dipercaya memegang uang.

## Peluncuran bertahap

| Tahap | Cakupan | Syarat maju |
|---|---|---|
| **Internal** | Satu tenant contoh, data contoh POS | Seluruh gerbang go-live terpenuhi |
| **Pilot** | Satu outlet nyata, satu register, satu kasir | Tujuh hari tanpa selisih kas yang tidak dapat dijelaskan; tanpa transaksi hilang |
| **Satu tenant penuh** | Seluruh outlet tenant pilot | Tiga puluh hari; laporan harian cocok dengan hitungan manual |
| **Umum** | Seluruh tenant | Ditinjau bersama pemilik sistem |

Pada tahap pilot, kasir tetap menjalankan pencatatan manual sebagai pembanding.
Bukan karena sistemnya diragukan, melainkan karena selisih yang ditemukan pada
minggu pertama jauh lebih murah diperbaiki daripada selisih yang ditemukan pada
bulan keenam.

## Rencana gulung balik

| Keadaan | Tindakan |
|---|---|
| Cacat pada layar kasir | Gulung balik penerapan web; API tetap berjalan |
| Cacat pada perhitungan harga/pajak | **Hentikan POS pada tenant terdampak.** Transaksi dengan harga salah tidak boleh berlanjut walau sebentar |
| Cacat pada posting stok | Hentikan POS; jalankan rekonsiliasi stok sebelum melanjutkan |
| Cacat pada peristiwa akuntansi | POS boleh berjalan bila peristiwanya tetap terbentuk. Posting yang tertunda dapat diproses ulang — itulah gunanya `accounting_event.status` |
| Migrasi bermasalah | Seluruh migrasi aditif, jadi versi lama tetap berjalan di atas skema baru. Tidak ada migrasi turun yang menghapus data |

## Kondisi berhenti dan meminta keputusan

Perintah §29 memerintahkan melanjutkan otomatis, dan berhenti hanya pada enam
keadaan. Ditegaskan di sini supaya tidak ada keraguan saat keadaannya benar-benar
terjadi:

```
kredensial terdeteksi pada kode atau log
basis data produksi memerlukan persetujuan
migrasi destruktif diperlukan
kontrak penyedia pembayaran belum tersedia untuk fitur wajib
ada risiko kehilangan transaksi
ada ketidakkonsistenan akuntansi yang kritis
```

Di luar keenamnya, pekerjaan berlanjut — termasuk ketika sesuatu tertahan.
Yang tertahan dicatat sebagai tertahan, bagian lain tetap diselesaikan penuh.

## Yang berjalan paralel

Perintah §26 mengizinkan enam alur lain berjalan bersamaan. Syaratnya:

- jangan mengubah kontrak bersama tanpa koordinasi;
- jangan mengubah migrasi POS yang sudah digabungkan;
- jangan memblokir CI POS;
- jangan mengubah API harga, persediaan, atau pembayaran tanpa menjaga
  kesesuaian mundur.

Tiga tugas V8 yang tertahan (Bantuan, Excel, PDF) adalah calon terbaik untuk
dikerjakan paralel — ketiganya membuka POS-7, POS-9, dan POS-11 sekaligus.
