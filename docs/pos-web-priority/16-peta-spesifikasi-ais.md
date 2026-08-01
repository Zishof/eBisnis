# Peta spesifikasi AIS POS terhadap eBisnis

Pembacaan `C:\opt\AIS\ais\SPESIFIKASI_FITUR_POS_DESKTOP_ANDROID.md` (400 baris,
21 bagian) terhadap apa yang benar-benar ada di eBisnis hari ini.

Dokumen ini **bukan rencana penuh dan bukan janji**. Ia peta: apa yang sudah
ada, apa yang belum, mana yang bentrok, dan urutan mana yang masuk akal.

---

## 0. Yang perlu diluruskan lebih dahulu

Spesifikasi itu menggambarkan **sistem lain**: AIS POS di atas backend Java
(`PosApi.java`), satu endpoint `POST /PosApi` dengan badan `{action, ...payload}`.
eBisnis adalah NestJS + Prisma + PostgreSQL dengan REST `/api/v1/...`,
schema-per-tenant, audit append-only, dan RBAC yang sudah tegak.

§1 spesifikasi berkata "kontrak API tetap dipakai apa adanya agar tidak perlu
ubah backend" — itu benar **untuk penulisan ulang klien AIS mereka**. Bagi
eBisnis itu justru instruksi yang salah: mengadopsi kontrak `{action}` berarti
membuang model yang sudah berjalan dan sudah diuji.

Karena itu spesifikasi ini dibaca sebagai **rujukan perilaku dan aturan usaha** —
apa yang harus dilakukan aplikasi dan mengapa — bukan sebagai kontrak teknis.
Bagian yang paling berharga justru bukan daftar fiturnya, melainkan §19 dan §20:
pelajaran dari bug produksi sungguhan.

---

## 1. Yang sudah ada di eBisnis

Dari inventaris endpoint `apps/api/src/modules/pos/` dan klien:

| Bidang | Keadaan |
| --- | --- |
| Sesi kas (buka/tutup/setoran/approve/ringkasan) | ada |
| Daur hidup penjualan (buat, baris, bayar, selesai, batal, tahan, lanjutkan) | ada |
| Retur, termasuk **kondisi barang menentukan stok kembali** | ada (`RESTOCK` / `DAMAGED`) |
| Pembatalan bertingkat (`void-request` → `void-approve`) | ada |
| Struk + cetak ulang | ada |
| Katalog: pencarian, snapshot luring, cari-per-barcode | ada |
| Metode pembayaran dari peladen, termasuk registry pembayaran eksternal | ada |
| Penjualan luring: jatah nomor struk, karantina, rekonsiliasi | ada |
| Penugasan register, konteks kasir, cek stok | ada |
| Laporan kasir + dashboard | ada |
| Data contoh POS | ada |
| Klien Flutter: aturan uang, ESC/POS, layar pelanggan, pintasan, cek pembaruan | ada |
| Vektor konformansi mengikat aturan uang TS dan Dart | ada |

Yang sudah ada ini **lebih ketat** daripada AIS di beberapa titik: audit
append-only, `search_path` tidak pernah menerima schema dari request, jatah nomor
struk per register, dan karantina alih-alih menolak transaksi luring.

---

## 2. Peta per bagian spesifikasi

Kolom "Tempat" menandai di mana pekerjaannya jatuh: **A**=API, **W**=web,
**F**=Flutter.

| § | Fitur | eBisnis hari ini | Selisih | Tempat |
| --- | --- | --- | --- | --- |
| 3.1 | Tata letak kasir, mode fokus keranjang | Web: dua kolom. Flutter: tiga kolom sesuai rancangan | Mode fokus/F7 belum ada di keduanya | W F |
| 3.2 | Katalog **hanya** dari cache lokal | Web memanggil `/pos/catalog/search` saat daring | **Bentrok kebijakan** — lihat §4 | W F |
| 3.2 | Pill kategori, badge stok, badge jumlah di keranjang | Flutter: ada. Web: sebagian | Web menyusul Flutter | W |
| 3.2 | Fokus kotak pindai direbut ulang otomatis (debounce 50 ms) | Fokus dikembalikan sesudah aksi, tidak merebut dari elemen lain | Kecil, berguna | W F |
| 3.3 | Cashback tidak mengurangi total | **Tidak ada konsep cashback** | Baru, menyentuh uang | A W F |
| 3.4 | `diskon_evaluasi` per perubahan keranjang | `DiscountEvaluatorService` ada di modul pricing, **belum dipakai POS** | Sambungkan + cashback | A W F |
| 3.5 | Pemilih member: modal, foto, cache luring, "transaksi terbaru" | Tidak ada member di POS | Besar | A W F |
| 3.6 | Bayar Saldo: cek ulang live, minimum mengendap, PIN | Tidak ada saldo member | Besar, menyentuh uang | A W F |
| 3.7 | Metode `manual` vs tuntas | Metode dari peladen ada; penandaan manual perlu diperiksa | Kecil | A |
| 3.8 | Checkout luring-dahulu, timeout lunak 3 detik | Ada, dengan karantina | Selaras; timeout lunak belum | W F |
| 3.8 | **Saldo dikecualikan dari jalur luring** | — | Ikut bila saldo dibangun | A |
| 3.9 | Tahan keranjang = entitas sama dengan pesanan online | `hold`/`resume` ada; pesanan online belum tersambung | Sedang | A W |
| 3.10 | Cetak **diserialisasi** | Flutter: belum. Web: lewat peladen | Kecil, penting (§19) | F |
| 3.11 | Buka laci selalu manual + varian pin | Flutter: ada (pin dapat diatur) | Selaras | — |
| 4 | Dashboard 9 tab | Dashboard kasir ada, jauh lebih ringkas | Besar, bertahap | A W |
| 5 | Pesanan online + keranjang tertahan satu layar | Modul `order`/`marketplace` ada, belum tersambung ke POS | Sedang | A W |
| 6 | Customer/Anggota | Modul koperasi punya anggota; POS tidak | Perlu keputusan: pakai anggota koperasi atau entitas member POS sendiri | A W |
| 7.2 | Resep/BOM, HPP, peladen menimpa harga beli | Tidak ada | Besar, menyentuh HPP | A W |
| 7.3 | Pembersihan duplikat 6 mode + pindah riwayat | Tidak ada | Sedang, berisiko | A W |
| 7.5 | Impor/ekspor Excel + **layar tinjau wajib** | Rencana V8-5/6 masih tertunda | Sedang | A W |
| 7.6 | Cetak price tag / POP | Tidak ada | Sedang | W F |
| 8 | Kulakan | ERP punya PO/penerimaan barang; bentuk berbeda | Perlu keputusan: jalur cepat POS atau arahkan ke ERP | A W |
| 9 | Aturan diskon (target produk/toko/member, persen+cap+nominal, potong vs cashback, batas 1×/hari) | Evaluator ada, katalog aturannya belum | Sedang | A W |
| 10 | Retur wizard 3 langkah | Aturan intinya ada; wizardnya belum | Kecil–sedang | W |
| 11 | Riwayat penjualan + cetak ulang | Cetak ulang ada; layarnya belum | Kecil | W |
| 12 | Laporan transaksi 3 sub-tab, omzet per kasir/mesin | Laporan kasir ada | Sedang | A W |
| 13 | Katalog ~150 laporan | Tidak ada | Besar; perlu keputusan apakah relevan bagi eBisnis | A W |
| 14 | Stok opname 3 tab, termasuk SO by Scan berantre | Tidak ada di POS | Sedang | A W F |
| 15 | **Identitas mesin POS (UUID + nama)** | Register ada; identitas mesin belum | Kecil, prasyarat banyak hal lain | A F |
| 16 | Layar pelanggan | Flutter: isinya ada, jendelanya belum. Web: belum | Sedang | W F |
| 17 | Gerbang sesi kas + mode darurat | Sesi kas ada; gerbang penuh dan mode darurat belum | Sedang | W F |
| 18 | Riwayat sinkronisasi + log error | Karantina ada; log error lokal belum | Kecil–sedang | W F |
| 19 | Kapabilitas perangkat | ESC/POS + jaringan + simpul perangkat ada; Bluetooth SPP belum | Sedang | F |
| 20 | Model luring-dahulu | **Sudah selaras**, termasuk aturan "jangan antrekan aksi lintas-terminal" | Selaras | — |
| 21 | Pintasan papan ketik | Ada, tetapi **berbeda** | **Bentrok** — lihat §4 | W F |

---

## 3. Yang sebaiknya diambil apa pun keputusan lainnya

Empat hal dari §19–§20 lahir dari bug produksi sungguhan, murah dikerjakan, dan
tidak bergantung pada fitur mana pun:

1. **Serialisasi operasi printer.** Beberapa panggilan cetak bersamaan terbukti
   membuat aplikasi Desktop mereka keluar sendiri di lapangan. Klien Flutter
   sekarang mengirim byte tanpa antrean.
2. **Deteksi printer virtual/PDF sebelum mencetak diam-diam.** Dialog simpan
   berkas milik OS yang dibatalkan pengguna terbukti menjatuhkan aplikasi dengan
   cara yang tidak tertangkap penanganan galat biasa.
3. **Indikator "dari cache" wajib pada setiap daftar yang menampilkan salinan.**
   §20.5 — jangan pernah menyamarkan data basi sebagai data live. Sebagian sudah
   ada di klien web; belum di Flutter.
4. **Baris yang ditolak peladen tetap PENDING dengan pesan galatnya**, tidak
   pernah dibuang diam-diam. eBisnis memakai karantina — selaras, tetapi layar
   yang menampilkannya kepada kasir belum ada di Flutter.

---

## 4. Bentrok yang harus diputuskan sebelum dibangun

### 4.1 Peta pintasan — sekarang ada TIGA

| Tombol | POS web (berjalan) | Rancangan gambar | Spesifikasi AIS §21 |
| --- | --- | --- | --- |
| F2 | Fokus kotak pindai | — | **Bayar** |
| F3 | — | Tahan Transaksi | Tahan Keranjang |
| F4 | — | Scan Barcode | Metode Pembayaran |
| F5 | — | Voucher | Pilih Member |
| F6 | **Tahan keranjang** | Refund | **Buka Laci** |
| F8 | — | Cetak Struk | Sinkronkan |
| F9 | **Bayar** | — | Layar Pelanggan |

Tiga peta yang tidak dapat dipenuhi sekaligus. Dua yang paling berbahaya:

- **F2**: fokus pindai di eBisnis, **Bayar** di AIS. Kasir AIS yang pindah ke
  eBisnis menekan F2 untuk membayar dan hanya memindahkan fokus — tidak berbahaya.
  Sebaliknya, kasir eBisnis yang pindah ke peta AIS menekan F2 untuk fokus dan
  **membuka pembayaran**.
- **F6**: menahan keranjang di eBisnis, **membuka laci** di AIS, **refund** di
  rancangan gambar. Tiga arti berbeda untuk satu jari yang terlatih.

Ini bukan keputusan yang boleh diambil diam-diam oleh siapa pun yang kebetulan
menulis kodenya. Ia perlu diputuskan sekali, lalu **klien web dan Flutter
berubah bersama** — peta yang berbeda antar klien lebih buruk daripada peta mana
pun yang dipilih.

### 4.2 Katalog: hanya cache, atau live saat daring?

§3.2 tegas: layar kasir **tidak pernah** memanggil peladen untuk daftar produk
jualan; kesegaran didelegasikan ke sinkron berkala. Alasannya masuk akal —
pencarian yang menunggu jaringan terasa seperti aplikasi menggantung, tepat saat
antrean panjang.

eBisnis sekarang memanggil `/pos/catalog/search` saat daring. Mengubahnya
menyentuh perilaku yang sudah diuji, jadi bukan perubahan yang dilakukan
sambil lalu.

### 4.3 Member: anggota koperasi, atau entitas POS sendiri?

Saldo, PIN, dan minimum mengendap (§3.6) adalah fitur uang. eBisnis sudah punya
anggota koperasi dengan simpanan. Memakai ulang entitas itu untuk POS ritel akan
mencampur dua hal yang aturannya berbeda; membuat entitas member POS sendiri
berarti dua daftar orang. Keputusan produk, bukan teknis.

### 4.4 Pajak

§2 menyerahkan keputusan ini. eBisnis **sudah** menghitung pajak, termasuk pada
jalur luring dan pada vektor konformansi. Tidak ada yang perlu diubah — dicatat
di sini hanya supaya tidak ada yang mengira ia masih terbuka.

---

## 5. Urutan yang diusulkan

Bukan urutan nomor spesifikasi. Urutan berdasarkan apa yang menjadi prasyarat
bagi yang lain, dan apa yang paling sering dipakai kasir.

| Tahap | Isi | Alasan urutannya |
| --- | --- | --- |
| **0** | Putuskan §4.1 peta pintasan | Menghalangi pekerjaan UI mana pun di kedua klien |
| **1** | §19–20: serialisasi cetak, deteksi printer virtual, indikator cache, layar karantina di Flutter | Murah, lahir dari bug sungguhan, tidak bergantung apa pun |
| **2** | §15 identitas mesin POS | Prasyarat badge mesin di riwayat, pesanan, dan laporan |
| **3** | §9 + §3.4 aturan diskon tersambung ke kasir, **tanpa** cashback dulu | Evaluatornya sudah ada; menyambungkannya bernilai langsung |
| **4** | §5 pesanan online + keranjang tertahan satu layar | `hold`/`resume` sudah ada, tinggal disambungkan |
| **5** | §14 stok opname, termasuk SO by Scan | Dipakai rutin, mandiri dari alur checkout |
| **6** | §6 + §3.5 + §3.6 member, saldo, PIN | Paling besar dan menyentuh uang; sesudah §4.3 diputuskan |
| **7** | §3.4 cashback | Menumpang aturan diskon yang sudah jadi |
| **8** | §7.2 resep/HPP, §7.5 Excel, §7.6 price tag | Manajemen, bukan jalur kritis kasir |
| **9** | §4 dashboard bertahap, §12–13 laporan | Analitik; nilainya menyusul data yang terkumpul |

§13 (katalog ~150 laporan) sengaja ditaruh paling akhir dan **belum tentu
relevan**: ia mencerminkan katalog laporan JSP milik AIS, bukan kebutuhan
eBisnis. Menyalinnya bulat-bulat berarti membawa beban yang belum tentu ada yang
memakainya.

---

## 6. Yang TIDAK diambil dari spesifikasi

| Hal | Alasan |
| --- | --- |
| Kontrak API `{action, ...payload}` | eBisnis punya REST + RBAC + audit yang sudah tegak |
| IndexedDB tiga basis data terpisah (pola Android AIS) | Klien web sudah memakai dua basis data dengan alasan tercatat |
| Layar pelanggan lewat polling peladen tiap 1,5 detik | Untuk mesin dua layar, jendela langsung lebih tepat; polling hanya relevan bila layarnya perangkat terpisah |
| "Laporkan ke GitHub" dari log error | Repo privat; tautan issue pra-isi tidak dapat dibuka pengguna gerai |
| Tanpa pajak (varian Android AIS) | eBisnis sudah menghitung pajak dan mengikatnya di vektor konformansi |

---

## 7. Ukuran pekerjaannya

Sembilan tahap di atas, dua klien, dan sebagian menyentuh uang. Ini program
lintas beberapa minggu, bukan satu pekerjaan.

Yang membuatnya dapat dikerjakan adalah tahap 0–2: satu keputusan, lalu empat
perbaikan murah yang lahir dari bug produksi orang lain — sehingga tidak perlu
dipelajari ulang dari bug produksi sendiri.
