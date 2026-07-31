# POS-0 · Matriks Peran dan Hak Akses

> **Diperbarui setelah POS-1 dikerjakan.** Rancangan awal dokumen ini
> mengandaikan peran POS memakai profil umum P1–P12. Saat diterapkan, ternyata
> itu tidak dapat dilakukan tanpa merusak modul lain: profil berlaku lintas
> modul, sehingga menambahkan `REFUND_APPROVE` atau `CASH_MOVE` ke profil
> manajer modul akan memberikannya pula pada marketplace. Lima profil kasir
> **K1–K5** dibuat sebagai gantinya, mengikuti jalan yang sudah ditempuh Versi 9
> untuk marketplace (M1–M9). Bagian "Lima profil kasir" di bawah menjelaskannya.

---

## Bentuk hak akses di eBisnis

Hak akses berbentuk `MENU.AKSI` — bukan daftar datar. Sistem sudah memiliki
**133 menu** dan **40 aksi**, dan setiap kombinasi yang sah didaftarkan pada
`menu_action`.

Perintah prioritas §6.2 menulis hak aksesnya sebagai `POS.SELL`, `POS.HOLD`,
dan seterusnya. Bentuk itu cocok dengan konvensi yang sudah ada, dengan catatan:
sebagian sudah tersedia sebagai aksi umum, sebagian perlu ditambahkan sebagai
aksi baru.

## Aksi yang sudah ada dan dapat dipakai

| Diminta perintah | Aksi yang sudah ada | Keterangan |
|---|---|---|
| `POS.READ` | `READ` | langsung |
| `POS.REPRINT` | `PRINT` | Cetak ulang dan cetak pertama sebaiknya **dipisah** — cetak ulang perlu audit tersendiri. Usulan: pakai `PRINT` untuk keduanya, dan catat cetak ulang pada audit dengan penanda `reprint` |
| `POS.RECONCILE` | `RECONCILE` | langsung |
| `POS.RETURN` | `RETURN` | langsung |
| `POS.APPROVE_REFUND` | `REFUND_APPROVE` | langsung |
| `POS.APPROVE_VOID` | `APPROVE` pada menu yang tepat, atau `CANCEL` | perlu keputusan; lihat di bawah |
| `POS.VIEW_COST` | `VIEW_COST` | langsung |
| `POS.VIEW_MARGIN` | `VIEW_PROFIT` | langsung |
| `POS.REPORT` | `READ` pada menu laporan POS | menu laporannya yang baru, bukan aksinya |

## Aksi yang perlu ditambahkan

Sembilan aksi baru pada `permission_action`:

| Kode | Nama | Untuk |
|---|---|---|
| `SELL` | Melakukan Penjualan | Menyelesaikan transaksi kasir |
| `HOLD` | Menahan Transaksi | Menyimpan keranjang untuk dilanjutkan |
| `RESUME` | Melanjutkan Transaksi | Membuka kembali keranjang yang ditahan |
| `DISCOUNT_LINE` | Diskon per Baris | — |
| `DISCOUNT_CART` | Diskon Keranjang | — |
| `PRICE_OVERRIDE` | Ubah Harga Manual | Selalu teraudit, tanpa kecuali |
| `OPEN_SHIFT` | Membuka Shift | — |
| `CLOSE_SHIFT` | Menutup Shift | — |
| `CASH_MOVE` | Kas Masuk / Keluar | Satu aksi untuk keduanya; arahnya ada pada `movement_type`, dan alasannya wajib |

`VOID_LINE` dan `VOID_SALE` **tidak** menjadi aksi baru: pembatalan baris
sebelum pembayaran adalah bagian dari `UPDATE` pada keranjang, dan pembatalan
penjualan yang sudah selesai adalah `CANCEL` — aksi yang sudah ada dan sudah
punya makna yang tepat di tempat lain. Menambah aksi yang artinya sama dengan
aksi yang sudah ada hanya membuat matriks hak akses lebih sulit dibaca, dan
matriks yang sulit dibaca adalah matriks yang salah dikonfigurasi.

`VIEW_OTHER_CASHIER` juga tidak menjadi aksi. Itu persoalan **cakupan data**,
bukan hak akses — dan cakupan data sudah punya mekanismenya sendiri
(`user_scope_assignment`, `role_data_scope`). Menuliskannya sebagai hak akses
akan menaruh aturan yang sama di dua tempat.

## Menu POS yang perlu ditambahkan

Tiga sudah ada (`POS`, `POS_SHIFT`, `POS_TERMINAL`). Yang perlu ditambahkan:

| Kode menu | Nama | Rute |
|---|---|---|
| `POS_SALE` | Kasir | `/app/pos/kasir` |
| `POS_HELD` | Transaksi Ditahan | `/app/pos/ditahan` |
| `POS_RETURN` | Retur & Refund | `/app/pos/retur` |
| `POS_CASH` | Kas & Rekonsiliasi | `/app/pos/kas` |
| `POS_REPORT` | Laporan POS | `/app/pos/laporan` |
| `POS_REGISTER_ASSIGN` | Penugasan Register | `/app/pos/penugasan` |

---

## Lima profil kasir (K1–K5)

Profil adalah cetakan: peran menyatakan profil apa yang berlaku pada modul apa,
lalu penyemai menurunkannya menjadi baris izin. Aksinya kemudian **diiris**
dengan aksi yang benar-benar ditawarkan menu — sehingga sebuah peran tidak
pernah tercatat memiliki izin pada halaman yang tidak menyediakannya.

| Profil | Untuk | Ciri utama |
|---|---|---|
| `K1` | Kasir POS | Menjual, menahan, melanjutkan, diskon baris, buka/tutup shift sendiri. **Tanpa** persetujuan, kas, harga pokok, dan penggantian harga |
| `K2` | Supervisor Kasir | K1 + persetujuan, pembatalan transaksi selesai, diskon keranjang, penggantian harga, kas, rekonsiliasi. **Tanpa** harga pokok dan tanpa `DELETE` |
| `K3` | Kepala Toko | K2 + harga pokok, margin, `DELETE`, posting, dan pembacaan audit |
| `K4` | Auditor POS | Membaca segalanya termasuk biaya. **Tanpa** satu pun aksi yang mengubah |
| `K5` | Administrator Master POS | Terminal, penugasan register, setelan struk. **Tanpa** satu pun aksi yang menyentuh uang |

Empat keputusan yang layak disebut alasannya:

**K2 tanpa `DELETE`.** Supervisor menjalankan shift; menghapus terminal adalah
pekerjaan administrator toko. Ada akibat kedua yang tidak langsung terlihat:
syarat munculnya tombol Unggah adalah memiliki `UPDATE` dan `DELETE` sekaligus,
sehingga memberi `DELETE` di sini akan membuat supervisor terhitung berhak
mengunggah data massal di tengah shift.

**K2 tanpa `VIEW_COST`.** Inilah yang membedakannya dari kepala toko. Supervisor
mengawasi jalannya kas dan transaksi; margin adalah urusan tingkat di atasnya.

**K3 memuat seluruh isi K2.** Peran yang lebih tinggi namun lebih tidak berdaya
mendorong orang berbagi kata sandi, dan itu lebih buruk daripada memberi izinnya
secara terbuka. Sebuah pengujian menjaga agar K3 tidak pernah kehilangan aksi
yang dimiliki K2.

**K5 bukan `P7`.** Profil manajer modul umum membawa `APPROVE`, `CANCEL`, dan
`REVERSE` — yang pada layar kasir berarti menyetujui diskon dan membatalkan
transaksi yang sudah dibayar. Orang yang memasang mesin kasir tidak seharusnya
berada di dalam rantai persetujuan transaksinya.

## Enam peran bawaan

Ditandai: **W** wajib, **–** tidak diberikan, **A** hanya dengan persetujuan.

| Hak akses | Kasir POS | Supervisor Kasir | Kepala Toko | Admin Toko | Gudang Outlet | Auditor POS |
|---|---|---|---|---|---|---|
| `POS_SALE.READ` | W | W | W | W | – | W |
| `POS_SALE.SELL` | W | W | W | – | – | – |
| `POS_SALE.HOLD` | W | W | W | – | – | – |
| `POS_SALE.RESUME` | W | W | W | – | – | – |
| `POS_SALE.DISCOUNT_LINE` | A | W | W | – | – | – |
| `POS_SALE.DISCOUNT_CART` | – | W | W | – | – | – |
| `POS_SALE.PRICE_OVERRIDE` | – | A | W | – | – | – |
| `POS_SALE.UPDATE` (void baris) | W | W | W | – | – | – |
| `POS_SALE.CANCEL` (void selesai) | – | W | W | – | – | – |
| `POS_SALE.APPROVE` | – | W | W | – | – | – |
| `POS_SALE.PRINT` | W | W | W | – | – | – |
| `POS_RETURN.RETURN` | W | W | W | – | – | – |
| `POS_RETURN.RETURN_APPROVE` | – | W | W | – | – | – |
| `POS_RETURN.REFUND_APPROVE` | – | W | W | – | – | – |
| `POS_SHIFT.OPEN_SHIFT` | W | W | W | – | – | – |
| `POS_SHIFT.CLOSE_SHIFT` | W | W | W | – | – | – |
| `POS_SHIFT.APPROVE` | – | W | W | – | – | – |
| `POS_CASH.CASH_MOVE` | – | W | W | – | – | – |
| `POS_CASH.RECONCILE` | – | W | W | – | – | – |
| `POS_SALE.VIEW_COST` | – | – | W | – | – | W |
| `POS_SALE.VIEW_PROFIT` | – | – | W | – | – | W |
| `POS_REPORT.READ` | – | W | W | W | – | W |
| `POS_TERMINAL.CREATE/UPDATE` | – | – | – | W | – | – |
| `POS_REGISTER_ASSIGN.ASSIGN` | – | – | W | W | – | – |
| `POS.AUDIT_READ` | – | – | – | – | – | W |

Tiga hal yang sengaja dibuat demikian:

**Kasir tidak melihat HPP maupun margin.** Perintah §6.2 menyebutkannya, dan
alasannya bukan sekadar kerahasiaan: kasir yang melihat margin akan tergoda
memberi diskon "yang masih untung", dan keputusan itu bukan wewenangnya.

**Kasir tidak dapat menyetujui apa pun.** Tidak `APPROVE`, tidak
`RETURN_APPROVE`, tidak `REFUND_APPROVE`, tidak `CLOSE_SHIFT.APPROVE`. Ini
ditegakkan dua kali — sekali lewat hak akses, sekali lagi lewat aturan
pemisahan wewenang yang melarang pelaku menyetujui permintaannya sendiri
meskipun hak aksesnya kebetulan diberikan.

**Kepala Toko dapat melakukan apa yang dapat dilakukan Supervisor, ditambah
melihat biaya.** Bukan peran yang lebih tinggi tetapi lebih tidak berdaya —
kepala toko yang harus memanggil supervisor untuk menyetujui refund akan
mendorong orang berbagi kata sandi, dan itu lebih buruk daripada memberi izinnya
secara terbuka.

## Aturan pemisahan wewenang POS

Didaftarkan pada `segregation_of_duty_rule`, ditegakkan pada layanan:

| Aturan | Isi |
|---|---|
| `POS_SELF_APPROVE_VOID` | Pelaku permintaan void tidak boleh menjadi penyetujunya |
| `POS_SELF_APPROVE_REFUND` | Pelaku permintaan refund tidak boleh menjadi penyetujunya |
| `POS_SELF_APPROVE_SHIFT` | Kasir tidak boleh menyetujui penutupan shiftnya sendiri bila selisihnya melampaui ambang |
| `POS_SELF_APPROVE_DISCOUNT` | Kasir tidak boleh menyetujui diskonnya sendiri di atas ambang |

Keempatnya memakai mesin SoD yang sudah ada. Yang perlu ditulis hanyalah
pendaftarannya, bukan mesinnya.

## Ambang yang perlu dikonfigurasi

Disimpan pada `app_setting` per tenant, bukan dikunci di dalam program:

| Kunci | Bawaan | Arti |
|---|---|---|
| `POS_DISCOUNT_APPROVAL_PCT` | 10 | Diskon di atas persen ini memerlukan persetujuan |
| `POS_VOID_APPROVAL_AMOUNT` | 0 | Nilai di atas ini memerlukan persetujuan; 0 berarti selalu |
| `POS_CASH_VARIANCE_THRESHOLD` | 10000 | Selisih kas di atas ini memerlukan persetujuan penutupan shift |
| `POS_ALLOW_NEGATIVE_STOCK` | false | Boleh menjual melebihi stok tercatat |
