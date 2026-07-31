# POS-0 · Peta Rute UI

**Keadaan hari ini:** menu `POS` sudah ada dan menunjuk ke `/app/pos`, tetapi
rute itu tidak terdaftar pada `apps/web/src/app/App.tsx`. Pengguna yang
mengkliknya hari ini sampai di `ComingSoonPage`.

---

## Rute yang perlu dibuat

| Rute | Halaman | Menu | Untuk |
|---|---|---|---|
| `/app/pos` | `PosEntryPage` | `POS` | Pemilihan outlet dan register, lalu buka shift |
| `/app/pos/kasir` | `PosSalePage` | `POS_SALE` | Layar kasir — yang dipakai sepanjang hari |
| `/app/pos/ditahan` | `PosHeldPage` | `POS_HELD` | Daftar keranjang yang ditahan |
| `/app/pos/shifts` | `PosShiftPage` | `POS_SHIFT` | Shift berjalan, riwayat, penutupan |
| `/app/pos/kas` | `PosCashPage` | `POS_CASH` | Kas masuk/keluar, penghitungan, rekonsiliasi |
| `/app/pos/retur` | `PosReturnPage` | `POS_RETURN` | Retur dan refund |
| `/app/pos/terminals` | `MasterListPage` | `POS_TERMINAL` | Master register (sudah ada polanya) |
| `/app/pos/penugasan` | `PosAssignmentPage` | `POS_REGISTER_ASSIGN` | Kasir mana boleh memakai register mana |
| `/app/pos/laporan` | `PosReportPage` | `POS_REPORT` | Empat belas laporan |

---

## Layar kasir — susunan

```
+--------------------------------------------------------------+
| Merek · Outlet · Register · Shift #12 · Kasir     [jaringan]  |
+---------------------------------+----------------------------+
| [ Cari produk / pindai barcode ]| Keranjang                  |
|                          (F2)   |                            |
+---------------------------------|  1  Kopi Susu    2  18.000 |
| Kategori | Favorit | Terjual    |  2  Roti Bakar   1  15.000 |
+---------------------------------|                            |
|  [ ]  [ ]  [ ]  [ ]  [ ]        |----------------------------|
|  [ ]  [ ]  [ ]  [ ]  [ ]        | Subtotal          51.000   |
|  [ ]  [ ]  [ ]  [ ]  [ ]        | Diskon            -2.000   |
|                                 | Pajak              4.900   |
|                                 | ------------------------   |
|                                 | TOTAL             53.900   |
|                                 |                            |
|                                 | Pelanggan: Umum     (F4)   |
|                                 |                            |
|                                 | [ Tahan (F6) ][ BAYAR F9 ] |
+---------------------------------+----------------------------+
```

Keranjang **selalu terlihat**. Tidak ada modal yang menutupinya kecuali dialog
pembayaran.

## Pintasan papan ketik

| Tombol | Tindakan |
|---|---|
| `F2` | Fokus ke kolom pencarian |
| `F4` | Pilih pelanggan |
| `F6` | Tahan keranjang |
| `F8` | Diskon (bila diizinkan) |
| `F9` | Buka dialog pembayaran |
| `Esc` | Tutup dialog |
| `+` / `-` | Ubah jumlah baris terpilih |
| `Del` | Hapus baris terpilih |

`F1`, `F3`, `F5`, `F7`, `F10`–`F12` sengaja tidak dipakai: ketujuhnya sudah
dipakai peramban (bantuan, cari lagi, muat ulang, layar penuh, menu). Pintasan
yang bertabrakan dengan peramban akan membuat kasir kehilangan keranjangnya.

## Masukan pemindai barcode

Pemindai barcode bekerja sebagai papan ketik: mengetik cepat lalu menekan Enter.
Karena itu masukan ditangkap di tingkat dokumen, bukan hanya saat kolom
pencarian sedang fokus — kasir tidak boleh perlu mengklik kolom lebih dahulu
sebelum memindai.

Pembeda dari pengetikan manusia: jeda antar-karakter di bawah 30 ms dan diakhiri
Enter. Bila pola itu terdeteksi, isinya diperlakukan sebagai barcode.

## Keadaan yang wajib ditampilkan

| Keadaan | Yang terlihat kasir |
|---|---|
| Memuat | Kerangka baris, bukan layar kosong |
| Jaringan terputus | Penanda merah pada kepala layar, tetap terlihat |
| Kuotasi harga gagal | Baris tidak masuk keranjang; pesan menyebut sebabnya |
| Stok kurang | Baris ditandai, jumlah maksimum yang tersedia disebutkan |
| Diskon perlu persetujuan | Baris ditandai menunggu, transaksi tidak dapat diselesaikan sampai disetujui |
| Draf dapat dipulihkan | Saat layar dibuka kembali, keranjang terakhir ditawarkan untuk dilanjutkan |

## Sasaran perangkat

| Perangkat | Sasaran |
|---|---|
| Desktop kasir | Utama. Papan ketik dan pemindai |
| Tablet mendatar | Kedua. Sasaran sentuh minimal 44×44 piksel |
| Layar sentuh | Tombol produk besar, tanpa hover sebagai satu-satunya petunjuk |
| Ponsel | Tidak diprioritaskan untuk kasir; laporan tetap terbaca |

## Yang **tidak** dikerjakan pada fase pertama

| Ditunda | Alasan |
|---|---|
| PWA / dapat dipasang | Perintah §3 menyebut sinkronisasi luring penuh boleh ditunda |
| Mode luring | Sama. Skemanya sudah siap, antarmukanya belakangan |
| Layar pelanggan (monitor kedua) | Ada pada aplikasi desktop yang sudah dirilis; belum diperlukan di web |
