# Kasir luring — rancangan dan batasnya

Menjawab pertanyaan: *mesin kasir harus tetap bekerja ketika internet putus, dan
datanya harus bertahan meski komputernya dinyalakan ulang.*

Berkas ini mencatat **apa yang sudah jalan (fase 1–2)**, **mengapa dirancang
begitu**, dan **apa yang belum boleh dijanjikan**.

---

## 1. Fase, dan di mana kita sekarang

| Fase | Isi | Keadaan |
| --- | --- | --- |
| 1 | Dapat dipasang, cangkang aplikasi tercache, indikator sambungan jujur | **Selesai** |
| 2 | Katalog luring: produk, barcode, harga, pajak, metode bayar di IndexedDB | **Selesai** |
| 3 | Buku transaksi lokal berantai hash | Ada pada PR #47, belum digabung |
| 4 | **Menjual saat luring** | **Belum** — menunggu tiga keputusan usaha (§6) |

Fase 1–2 membuat kasir dapat **memeriksa harga dan menemukan barang** tanpa
peladen. Ia belum membuat kasir dapat **menjual** tanpa peladen, dan layar
mengatakannya apa adanya.

---

## 2. Apa yang tidak di-cache, dan mengapa itu keputusan terpenting

`runtimeCaching: []`. Tidak satu pun jawaban API disimpan service worker.
`navigateFallbackDenylist` menutup `/api` dan `/health`.

Alasannya bukan kehati-hatian umum. Harga yang basi **tidak menimbulkan galat
apa pun**: kasir menjual, pembeli membayar, struk tercetak, dan baru
berminggu-minggu kemudian ketahuan bahwa seluruh transaksi hari itu memakai
harga bulan lalu. Tidak ada yang gagal; yang terjadi hanya salah, diam-diam.

Cache service worker tidak tahu apa-apa tentang isi yang dilayaninya — ia hanya
tahu URL. Karena itu keputusan "boleh basi atau tidak" dipindahkan seluruhnya ke
`src/pos-offline/`, yang tahu bedanya antara nama produk dan harga.

Yang tercache hanyalah **cangkang aplikasi**: 35 berkas, 817 KiB, seluruhnya
kode dan gaya. Itu yang membuat `/app/pos` tetap terbuka saat internet putus,
alih-alih halaman galat peramban.

---

## 3. Empat keadaan sambungan, bukan dua

`navigator.onLine` hanya menjawab "adakah antarmuka jaringan yang aktif". Ia
bernilai benar pada Wi-Fi warung yang tersambung tetapi tidak mencapai peladen —
keadaan yang paling sering terjadi di lapangan: router menyala, langganan
internetnya yang mati.

| Keadaan | Artinya | Yang dilihat kasir |
| --- | --- | --- |
| `DARING` | Peladen menjawab | Hijau, "Tersambung ke peladen." |
| `TERBATAS` | Jaringan ada, peladen tidak menjawab | Kuning, menyebut bahwa masalahnya bukan di kabel mejanya |
| `LURING` | Tidak ada jaringan | Merah |
| `MEMERIKSA` | Belum sempat mencoba | Kelabu |

`TERBATAS` dipisahkan karena tindakannya berbeda: kasir yang tahu peladennya
yang mati tidak menghabiskan waktu mencabut-colok router.

Setiap keadaan membawa kalimat yang menyebutkan **akibatnya bagi pekerjaan
kasir**. Lencana berwarna tanpa kalimat tidak memberi tahu siapa pun apa yang
harus dilakukan berikutnya.

Penilaiannya ada di `src/pos-offline/koneksi.ts` sebagai aturan murni, sehingga
dapat diuji tanpa jaringan. Denyut pemeriksaannya membesar bertahap saat gagal,
tetapi dibatasi 30 detik — kasir yang menunggu peladen pulih tidak boleh
menunggu lebih lama daripada yang diperlukan setelah peladen benar-benar hidup.

---

## 4. Katalog luring

### Jalannya

`GET /pos/catalog/snapshot` mengembalikan dalam satu jawaban: produk beserta
**seluruh** barcode (utama dan alternatif dalam satu larik), tarif pajak, metode
pembayaran, mata uang, dan zona waktu.

Jalan tersendiri, bukan menggabungkan `catalog/search` yang sudah ada, karena
jalan itu hanya mengembalikan barcode utama. Salinan yang dibangun darinya akan
menolak barang yang di peladen dikenali — dan kasir tidak akan pernah tahu bahwa
penyebabnya salinan, bukan barangnya.

### Batas dan kejujurannya

Paling banyak **5.000 produk** per mesin. Tenant yang melewatinya tetap dilayani,
tetapi jawabannya menandai `truncated`, dan layar wajib menyebutkan angkanya:
"4.999 dari 12.480", bukan "sebagian produk tidak tersalin". Katalog yang
dipotong diam-diam membuat barang tampak tidak ada tanpa satu pun keterangan.

### Batas umur, dipilih menurut akibat bila salah

| Jenis | Batas | Alasan |
| --- | --- | --- |
| Harga, pajak | 12 jam | Langsung menentukan uang yang diterima. Salah sedikit, salah pada setiap transaksi sesudahnya. |
| Produk, barcode, metode bayar | 7 hari | Paling buruk membuat satu barang tidak ditemukan — kasir tahu seketika dan dapat mencarinya menurut nama. |

Angkanya dipilih menurut **akibat bila salah**, bukan menurut seberapa sering
datanya berubah. Salinan yang melewati batasnya **tidak dipakai sama sekali**.

### Penyimpanan

Basis data IndexedDB tersendiri: `ebisnis-pos-katalog`, terpisah dari buku
transaksi lokal. Katalog boleh hilang — tinggal disalin ulang. Buku transaksi
tidak. Menyatukannya berarti setiap tindakan "bersihkan cache", milik kita
sendiri maupun milik peramban, mengancam yang tidak tergantikan demi membereskan
yang tergantikan.

Satu catatan utuh, bukan satu baris per produk: pencarian luring memuat seluruh
katalog ke memori, jadi memecahnya menjadi ribuan baris tidak memberi apa pun.

Setiap salinan membawa `tenantId`. Bila mesin yang sama dipakai masuk ke tenant
lain, salinan lama **dibuang** sebelum apa pun dibaca darinya — bukan sekadar
diabaikan.

`navigator.storage.persist()` diminta agar peramban tidak membuangnya saat ruang
menipis. Peramban boleh menolak, dan penolakannya bukan galat.

---

## 5. Pembaruan aplikasi ditunda, tidak otomatis

`registerType: 'prompt'`. Pilihan bawaan aplikasi web — pasang versi baru lalu
muat ulang — salah di sini, dan salahnya mahal: memuat ulang di tengah transaksi
menghapus keranjang yang barangnya sudah dipindai satu per satu, di depan
pembeli yang sedang menunggu.

Ditunda selama:

1. **keranjang terbuka** — alasan di atas;
2. **masih ada transaksi yang belum terkirim ke peladen** — antrean itu tersimpan
   di mesin ini, dan yang tahu cara membacanya adalah versi yang menulisnya.
   Versi baru boleh saja mengubah bentuk catatannya. Menunggu antrean kosong
   menghapus seluruh golongan masalah itu, bukan menambal satu kasusnya.

Aturannya di `src/pos-offline/pembaruan.ts`, dan dijaga juga di dalam
`terapkan()` — bukan hanya disembunyikan dari antarmuka. Tombol yang tidak
tampak tetap dapat terpanggil dari tempat lain, dan akibat salahnya terlalu mahal
untuk bergantung pada tata letak.

---

## 6. Yang menghalangi fase 4 — dan ini keputusan usaha, bukan keputusan teknis

Menjual saat luring belum dibuka karena tiga hal berikut belum dijawab. Ketiganya
menyangkut uang dan tanggung jawab, jadi jawabannya bukan milik pengembang.

1. **Kebijakan stok saat luring.** Mesin kasir yang tidak terhubung tidak tahu
   sisa stok yang sebenarnya. Boleh menjual melebihi stok lalu diselisihkan
   kemudian, atau menolak? Menjual berarti kemungkinan menjanjikan barang yang
   sudah habis; menolak berarti kehilangan penjualan yang sebenarnya bisa
   dilayani.

2. **Blok nomor struk per register.** Nomor struk harus unik dan tidak boleh
   bertabrakan antar-register yang sama-sama luring. Cara lazimnya membagi blok
   di muka (misalnya register 1 memegang 1–1000). Yang harus diputuskan: berapa
   besar bloknya, dan apa yang dilakukan bila habis sebelum peladen kembali.

3. **Pembekuan harga.** Harga mana yang mengikat ketika luring — harga pada
   salinan, atau harga peladen saat transaksi akhirnya terkirim? Bila keduanya
   berbeda, pembeli sudah membayar angka yang tercetak pada struknya.

Sampai ketiganya dijawab, layar kasir mengatakan apa adanya: salinan lokal
dipakai untuk memeriksa harga dan nama barang, dan memasukkan barang ke
keranjang masih memerlukan peladen.

---

## 7. Bukti

| Apa | Di mana |
| --- | --- |
| Aturan sambungan, kesegaran katalog, penerapan pembaruan | `apps/web/src/pos-offline/*.spec.ts` — 34 uji |
| Service worker terdaftar, katalog mendarat di IndexedDB, layar berubah saat peladen mati | `apps/web/e2e/pos-luring.spec.ts` — 6 uji peramban |
| Layar kasir tidak berubah perilakunya saat daring | `apps/web/e2e/pos-cashier.spec.ts` — 9 uji, tetap hijau |

Uji luring hanya berjalan terhadap hasil build (`vite preview` atau CI), sebab
service worker sengaja dimatikan pada server pengembangan — service worker yang
aktif di sana menyajikan berkas lama sesudah setiap penyuntingan.
