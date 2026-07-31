# 23 — Pemenuhan: Picking, Packing, dan Pengiriman (V9-9)

Menutup D18–D20 pada [matriks gap](02-v8-to-v9-gap-matrix.md).

## Yang dibangun

| Objek | Jumlah |
| --- | ---: |
| Tabel tenant baru (V014) | 7 |
| Endpoint baru | 6 |
| Test baru | 31 |

## Armada internal tidak ada, jadi tidak ada yang diintegrasikan

Blueprint menyebut integrasi dengan armada internal, trip, GPS, dan bukti
terima. Audit terhadap 133 tabel tenant menunjukkan **tabel-tabel itu tidak
ada**; yang tersedia hanya `vehicle_type` dan `carrier` sebagai tabel referensi.

Karena itu tidak ada armada kedua yang dibuat di sini, dan tidak ada pula klaim
integrasi. `shipment` menunjuk `carrier` yang memang ada. Membuat armada sendiri
akan menghasilkan modul yang kelak bertabrakan dengan modul ekspedisi
sesungguhnya.

## Pemenuhan di tenant, pesanan di platform

Barangnya ada di gudang tenant; pesanannya dibaca pembeli yang tidak punya
tenant. Penghubungnya satu kolom, `marketplace_order_id`, **tanpa foreign key
lintas schema** — PostgreSQL tidak mendukungnya, dan memaksakannya lewat trigger
akan membuat setiap penulisan pesanan menyentuh setiap schema tenant.

Alamat tujuan **disalin** ke perintah pemenuhan. Petugas gudang tidak boleh
perlu menembus schema platform hanya untuk mencetak label.

## Kekurangan diizinkan, kelebihan tidak

| Keadaan | Perlakuan | Alasan |
| --- | --- | --- |
| Diambil kurang, ada alasan | **diterima** | menolaknya membuat petugas mencatat angka palsu supaya bisa lanjut |
| Diambil kurang, tanpa alasan | ditolak | kekurangan tanpa penjelasan tidak dapat ditindaklanjuti |
| Diambil lebih | **ditolak** | berarti barang milik pesanan lain ikut terbawa |
| Tidak ada yang diambil | ditolak | bukan pengambilan |

Angka palsu jauh lebih merusak daripada kekurangan yang jujur. Basis data ikut
menegakkannya lewat `ck_pick_task_discrepancy`.

## Berat dan dimensi wajib

Ekspedisi menagih berdasarkan **yang ditimbang**, bukan berdasarkan berat barang
yang dijumlahkan. Kemasan dan pengisi ikut berbobot.

Paket tanpa berat berarti ongkos kirim baru diketahui setelah barang diserahkan
— dan selisihnya ditanggung penjual yang tidak diberi tahu.

### Berat yang ditagih

`chargeableWeightGram` menghitung yang lebih besar antara berat sesungguhnya dan
berat volume (pembagi 6000, kelaziman kurir domestik). Penjual melihat angka yang
sama dengan yang akan ditagihkan, bukan terkejut kemudian.

## Barang yang sama tidak masuk dua paket

Pemeriksaan pengemasan membandingkan terhadap **sisa** yang boleh dikemas
(`picked_qty - packed_qty`), bukan terhadap seluruh yang diambil. Tanpa
pengurangan itu, barang yang sama dapat dimasukkan ke paket kedua.

Basis data ikut menjaganya lewat `ck_fulfillment_line_qty`.

## Nomor resi tidak dikarang

`tracking_number` diisi pemanggil, kosong bila belum ada. Pemesanan kurir lewat
API belum tersambung, dan nomor yang dikarang membuat pembeli melacak ke halaman
yang tidak ada.

Resi yang sama tidak boleh dipakai dua kali per ekspedisi — resi ganda membuat
dua pesanan terlihat sebagai satu kiriman.

## Peristiwa pelacakan tidak tercatat berulang

Batasan unik pada `(shipment_id, source_event_id)`. Ekspedisi mengirim ulang
peristiwa yang tidak dijawab, dan tanpa batasan itu riwayat pelacakan akan
penuh duplikat.

## Manifest, bukan penemuan otomatis

Migration tenant didaftarkan pada `tenant-migrations/manifest.json`, bukan
ditemukan dari isi direktori. V014 sempat tidak berjalan karena hal ini — runner
melaporkan "Selesai" tanpa mengerjakan apa pun.

Bentuk ini disengaja: berkas SQL yang tercecer di direktori tidak diterapkan
tanpa didaftarkan dengan sadar. Konsekuensinya, **menambah berkas saja tidak
cukup**.

## Bukti

```text
V014 diterapkan ke 14 dari 14 schema tenant
7 dari 7 tabel ada pada schema demo
545 test lulus (naik dari 514)
```

## Keterbatasan yang diketahui

**Pemesanan kurir lewat API belum ada.** Tarif, pemesanan, dan label datang dari
penyedia ekspedisi yang kontraknya belum tersedia. Yang ada sekarang adalah
pencatatan manual: penjual mengisi nomor resi yang diperolehnya sendiri.

**Ongkos kirim masih tetap Rp 20.000 per penjual** pada checkout. Tarif
sesungguhnya menuntut integrasi di atas.

**Gelombang pengambilan belum ada.** Setiap perintah pemenuhan dikerjakan
sendiri-sendiri; penggabungan beberapa pesanan menjadi satu putaran gudang
menyusul.

**Pemindaian barcode belum ada.** SKU dicocokkan lewat id baris, bukan lewat
pemindaian — sehingga salah ambil barang dengan SKU mirip masih mungkin.

**Bukti terima belum berbasis lokasi.** Kolomnya ada (`received_by`,
`proof_file_object_id`) tetapi pengisiannya menyusul bersama modul ekspedisi.
