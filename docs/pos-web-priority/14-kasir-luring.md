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
| 3 | Buku transaksi lokal berantai hash, tersambung ke layar kasir | **Selesai** |
| 4 | **Menjual saat luring** — jatah nomor struk, penerimaan, karantina | **Selesai, saklarnya MATI** |

Kemampuannya sudah ada seluruhnya. **Kapan dinyalakan adalah keputusan usaha**,
dan setelan `POS_OFFLINE_SALE_ENABLED` bawaannya mati (§6).

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

## 6. Menjual saat luring — dan mengapa saklarnya tetap mati

Fase 4 sudah dibangun. Yang belum terjadi adalah **keputusan untuk
menyalakannya**, dan itu memang bukan keputusan pengembang.

### Bagaimana ketiga pertanyaan itu dijawab

Ketiga hal yang semula menghalangi kini punya jawaban yang **aman di bawah
kebijakan mana pun** — sehingga membangunnya tidak menuntut keputusan lebih
dahulu, dan menyalakannya tetap menuntutnya.

| Pertanyaan | Jawaban yang dibangun | Yang masih milik Anda |
| --- | --- | --- |
| **Stok saat luring** | Mesin kasir tidak memutuskan apa pun tentang stok. Saat transaksi diterima, peladen memeriksanya seperti biasa; bila tidak cukup dan tenant tidak mengizinkan minus, transaksinya **ditahan** — tidak dipaksa dan tidak dibuang. | Apakah menahan cukup, atau perlu batas nilai transaksi luring per shift. |
| **Nomor struk** | Register memesan **jatah** dari `number_sequence` yang sudah ada. Urutannya dimajukan melewati seluruh rentang, jadi penjualan daring tidak akan pernah menyentuhnya. Tidak ada sumber penomoran kedua. | Ukuran jatah (`POS_OFFLINE_RECEIPT_BLOCK_SIZE`, bawaan 200). |
| **Pembekuan harga** | Harga yang mengikat adalah harga pada salinan — itu yang tercetak dan itu yang dibayar. Bila peladen menghitung berbeda, transaksinya **ditahan beserta kedua angkanya**. | Apa yang dilakukan terhadap selisihnya: ditanggung, ditagihkan, atau transaksinya dikoreksi. |

### Mengapa "ditahan", bukan "ditolak" atau "diterima diam-diam"

Pembeli sudah membayar dan pulang. Ada tiga kemungkinan tindakan, dan dua di
antaranya salah:

- **Menolak** tidak membuat transaksinya tidak pernah terjadi. Uangnya sudah
  berpindah tangan dan barangnya sudah keluar dari rak; menolak hanya membuat
  pembukuan tidak menunjukkan keduanya.
- **Menerima diam-diam dengan angka peladen** membuat catatan tidak sesuai
  dengan kertas yang dipegang pembeli. Tidak ada galat, tidak ada yang tahu, dan
  selisihnya muncul belakangan sebagai kas yang tidak cocok tanpa sebab yang
  dapat ditelusuri.
- **Menahan** menyimpan transaksinya utuh beserta alasan dan kedua angkanya,
  menunggu keputusan manusia.

Tujuh sebab penahanan dibedakan, sebab tindak lanjutnya berbeda:
`PRICE_MISMATCH`, `STOCK_SHORT`, `SHIFT_CLOSED`, `PRODUCT_INACTIVE`,
`RECEIPT_OUT_OF_BLOCK`, `PAYMENT_MISMATCH`, `REPLAY_FAILED`.

### Menyalakannya

```sql
UPDATE "<schema>".app_setting
   SET value_json = '{"value": true}'::jsonb
 WHERE code = 'POS_OFFLINE_SALE_ENABLED';
```

Sesudah itu setiap register perlu **mengambil jatah nomor struk** sekali selagi
daring (tombolnya ada pada batang status kasir). Tanpa jatah, penjualan luring
tetap tertutup — dan layar mengatakannya.

Prasyarat: outlet harus punya urutan `POS_RECEIPT` pada `number_sequence`.
Tenant yang memakai penomoran cadangan berbasis tanggal tidak dapat memesan
jatah, sebab nomor cadangan dihitung dari banyaknya penjualan hari itu dan tidak
dapat dipesan di muka. Permintaan jatahnya ditolak dengan keterangan itu.

### Yang tetap tidak tersedia saat luring

Diskon manual, penggantian harga, promosi, dan buku harga **tidak dievaluasi**.
Harga yang tertagih adalah harga pada salinan katalog, yang umurnya dibatasi 12
jam. Kasir yang memerlukan diskon menunggu peladen kembali, dan layar
mengatakannya. Menirukan kebijakan harga di peramban berarti menulis aturan uang
untuk kedua kalinya — dan dua implementasi aturan uang tidak pernah tetap sama.

---

## 7. Bukti

| Apa | Di mana |
| --- | --- |
| Aturan sambungan, kesegaran katalog, penerapan pembaruan, aritmetika uang, jatah nomor, keutuhan rantai | `apps/web/src/pos-offline/*.spec.ts` — 90 uji |
| Aturan penerimaan transaksi luring | `apps/api/src/modules/pos/pos-offline.spec.ts` — 28 uji |
| Seluruh jalur luring lewat HTTP dan basis data sungguhan | `apps/api/scripts/prove-pos-offline.mjs` — 17 pemeriksaan, hasilnya di `bukti-pos-luring.txt` |
| Service worker terdaftar, katalog mendarat di IndexedDB, layar berubah saat peladen mati | `apps/web/e2e/pos-luring.spec.ts` — 6 uji peramban |
| Layar kasir tidak berubah perilakunya saat daring | `apps/web/e2e/pos-cashier.spec.ts` — 9 uji, tetap hijau |

Dua cacat sungguhan ditemukan oleh naskah bukti, bukan oleh uji satuan — keduanya
pada SQL, bukan pada aturannya:

1. **`produkNonaktif` mengembalikan seluruh produk.** Kueri mengambil `p.id` dari
   baris yang justru tidak punya pasangan, sehingga isinya selalu NULL. Setiap
   transaksi luring akan ditahan dengan alasan "produk tidak aktif" — alasan yang
   keliru, dan yang akan membuat orang mencari masalah di master produk.
2. **Percobaan migrasi yang GAGAL ikut mengunci checksumnya.** Migrasi yang
   diperbaiki lalu ditolak dengan "tidak boleh diubah", padahal ia belum pernah
   berhasil diterapkan. Diperbaiki pada `tenant-migration.service.ts`: hanya
   baris `SUCCEEDED` yang mengunci, dan riwayatnya di-`upsert` supaya percobaan
   ulang yang berhasil dapat mencatat hasilnya.

Uji luring hanya berjalan terhadap hasil build (`vite preview` atau CI), sebab
service worker sengaja dimatikan pada server pengembangan — service worker yang
aktif di sana menyajikan berkas lama sesudah setiap penyuntingan.
