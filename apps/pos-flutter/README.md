# Klien kasir eBisnis.id (Flutter)

Klien **kedua** dari sistem yang sama — bukan POS berdiri sendiri. Satu peladen,
satu basis data, satu jalur penerimaan transaksi luring. Alasannya, batasnya, dan
ongkosnya ada di [ADR-012](../../docs/architecture/ADR-012-klien-kasir-kedua-flutter.md).

## Memasang di gerai

Unduh pemasangnya dari rilis GitHub — `ebisnis-pos-X.Y.Z-windows.exe` untuk
Windows, `ebisnis-pos-X.Y.Z.apk` untuk tablet Android.

> **Belum dapat diunduh publik.** Repo ini privat, sehingga aset rilis hanya
> terjangkau oleh akun yang punya akses repo. Jalan keluarnya ada di
> [15-rilis-dan-pembaruan.md](../../docs/pos-web-priority/15-rilis-dan-pembaruan.md)
> §1 — dan itu keputusan pemilik, bukan bagian yang dapat diselesaikan kode.

Menerbitkan versi baru:

```bash
git tag pos-v1.2.0
git push origin pos-v1.2.0
```

Aplikasi memeriksa pembaruan sendiri saat dibuka dan setiap enam jam, dan dapat
diperiksa kapan saja lewat tombol **Cek pembaruan** di bilah atas. Ketika versi
baru tersedia, dialog otomatis tampil satu kali untuk versi tersebut dalam satu
sesi. Tombol **Unduh sekarang** membuka APK atau installer Windows di browser
sistem; pembaruan biasa dapat ditunda, sedangkan rilis bertanda `[WAJIB]` tidak
dapat ditutup dengan mengetuk area di luar dialog.

## Menjalankannya di mesin kasir

```bash
flutter run -d windows --dart-define=PRINTER=COM3
```

`PRINTER` menentukan pengangkutan struk. Tanpa argumen itu, klien berjalan tanpa
printer dan **mengatakannya pada layar** — bukan diam-diam gagal mencetak.

| Nilai | Pengangkutan | Lazim dipakai |
| --- | --- | --- |
| `COM3`, `\\.\COM3` | Simpul perangkat | Printer USB pada Windows; pemandunya memasangnya sebagai porta COM maya |
| `/dev/usb/lp0` | Simpul perangkat | Printer USB pada Linux |
| `192.168.1.50:9100` | TCP | Printer LAN dan konverter USB-ke-Ethernet |
| `C:\temp\struk.bin` | Berkas | Menampung byte untuk menelusuri masalah cetak, tanpa menghabiskan kertas |

Disetel lewat argumen dan bukan lewat layar setelan karena layar setelannya belum
ada — dan menebak bawaannya akan salah, sebab mesin kasir Windows umumnya memakai
porta COM sedangkan gerai dengan printer bersama memakai jaringan.

## POS Apotik

POS Apotik memakai aplikasi Flutter yang sama, tetapi dibangun dalam mode
farmasi:

```bash
flutter run -d windows --dart-define=POS_MODE=apotik
flutter build apk --release --flavor apotik --dart-define=POS_MODE=apotik
flutter build windows --release --dart-define=POS_MODE=apotik
```

Build Apotik menampilkan login server dan secara bawaan terhubung ke
`https://apotik.emedik.id/api/v1/`. Alamat dapat ditimpa untuk staging/lokal:

```bash
flutter run -d windows --dart-define=POS_MODE=apotik --dart-define=POS_API_BASE=http://localhost:3000/api/v1/
```

Pengguna memasukkan username/email dan kata sandi resmi server pada layar login.
`POS_USERNAME`, `POS_PASSWORD`, dan token tidak ditanam ke artefak rilis. Kode
tenant tidak diminta: username dan email unik secara global, sedangkan tenant
aktif ditentukan server dari membership akun. Sesudah login, katalog, outlet,
register, shift, dan metode bayar diambil dari server. Transaksi dibukukan ke
server ketika pembayaran selesai.
Pemeriksaan pembaruan POS Apotik memakai kanal publik khusus
`https://apotik.emedik.id/update/apotik/latest`, bukan kanal POS retail.

Mode ini mengganti brand menjadi **POS Apotik**, memakai katalog obat tenant, dan
menampilkan konteks kerja farmasi: nomor resep/e-resep, pasien, resep dokter,
obat bebas, antar, racikan, produksi farmasi, high-alert, batch, dan kedaluwarsa.

POS Apotik memang dipisah dari POS Penjualan biasa karena alurnya berbeda:
apotik perlu telaah resep, penanda obat keras/high-alert, racikan, nomor batch,
kedaluwarsa, konseling, dan jejak audit farmasi. Menyatukannya sebagai tombol
tambahan di POS biasa akan membuat kasir ritel membawa aturan klinis yang tidak
ia pakai, sementara apoteker kehilangan konteks keselamatan obat.

Pada Android, flavor `apotik` memakai `applicationId` berbeda
(`id.emedik.pos_apotik`), sehingga POS Apotik dapat dipasang berdampingan dengan
POS Penjualan biasa (`id.ebisnis.ebisnis_pos`) pada perangkat yang sama.

## Perangkat keras

Tiga hal yang biasanya disebut "integrasi perangkat keras" ternyata satu.

- **Pemindai barcode** tidak memerlukan apa pun. Hampir seluruh pemindai POS
  bekerja sebagai papan ketik (HID): ia mengetikkan kodenya lalu menekan Enter.
  Yang diperlukan hanyalah kotak teks yang fokusnya terjaga, dan itu sudah ada.
- **Laci kas** tidak punya jalur sendiri. Ia dicolokkan ke printer struk lewat
  soket RJ-11 dan dibuka oleh perintah pulsa `ESC p`.
- **Printer** karena itu satu-satunya perangkat keras sungguhan.

Perintah ESC/POS dibangun sendiri di `lib/perangkat/escpos.dart`, seluruhnya
fungsi murni atas daftar byte. Ia dapat dibuktikan tanpa printer — dan perintah
membuka laci kas adalah hal yang paling tidak nyaman untuk dibuktikan dengan cara
mencobanya berulang kali.

### Bila lacinya tidak terbuka

Sebagian printer memasang lacinya pada pin 1, bukan pin 0 — ubah `bukaLaci(pin: 1)`.
Bila lacinya hanya berbunyi klik tanpa terbuka, pulsanya terlalu pendek: naikkan
`nyalaMs`.

## Bentuk layar

Mengikuti rancangan eBisnis POS: bilah samping gelap, bilah atas berisi keadaan
mesin, kisi produk di tengah, panel keranjang di kanan.

Satu kotak melayani dua hal sekaligus — pemindai **dan** pengetikan nama. Yang
menentukan perlakuannya adalah bentuk teksnya, bukan tombol mode yang harus
diingat kasir: teks yang hanya angka dan cukup panjang diperlakukan sebagai
barcode, selebihnya sebagai pencarian nama. Barcode tak dikenal adalah masalah
data master; nama yang tak ditemukan cukup dijawab dengan mempersempit kisi.

Kisi produknya bukan pelengkap. Sebagian besar barang di gerai makanan dan
minuman tidak punya barcode — kopi yang baru diseduh tidak dapat dipindai — dan
bagi gerai seperti itu kisi inilah jalan utamanya.

### Yang tampil apa adanya, bukan yang enak dilihat

| Di layar | Mengapa begitu |
| --- | --- |
| Menu selain Kasir/POS ditulis lebih redup dan menjawab "ada pada aplikasi web" | Menyembunyikannya membuat orang mengira aplikasi ini kehilangan fitur; menampilkannya seolah bekerja lebih buruk lagi |
| Penanda Sync berbunyi "Belum tersambung", bukan hijau | Klien API belum ada. Penanda hijau yang tidak pernah memeriksa apa pun membuat gerai menutup buku dengan yakin bahwa transaksinya sudah sampai |
| Pemilih pelanggan dan meja dimatikan | Daftarnya datang dari peladen. Tombol yang terbuka lalu menampilkan daftar kosong membuat kasir mengira data pelanggannya hilang |
| Barang habis tetap tampil, tetapi tidak dapat ditekan | Menyembunyikannya membuat kasir mencarinya berulang kali dan menyimpulkan katalognya rusak |
| Stok yang tidak diketahui tidak menampilkan badge sama sekali | "Stok 0" untuk stok yang tidak diketahui membuat kasir menolak menjual barang yang ada di rak |
| Baris pajak hilang bila tarifnya nol | "Pajak Rp 0" pada gerai non-PKP terlihat seperti pajak yang gagal terpasang |
| Kotak gambar berwarna dengan huruf awal, bukan foto | Salinan katalog belum membawa foto, dan memuatnya dari jaringan merusak alasan klien ini ada |

Tombol pembayaran dibangkitkan dari metode yang ada pada salinan peladen, bukan
dari daftar tetap. Warnanya dipetakan dari kode metode — kasir menghafal warna,
dan warna yang berpindah ketika gerai menambah satu metode akan membuat tangan
yang terlatih menekan tombol yang salah.

## Pintasan papan ketik

Tekan **F1** untuk daftar lengkapnya di dalam aplikasi.

Hanya **F1, F5, F11, dan F12** yang benar-benar tidak dapat dipakai pada klien
web — peramban menahannya untuk dirinya sendiri. Sisanya sudah bekerja di sana,
dan peta tombolnya sengaja dibuat sama supaya kasir yang berpindah antara kedua
klien tidak perlu belajar ulang.

Aksi yang menghilangkan pekerjaan atau menyentuh uang (batal transaksi, hapus
baris, buka laci, tutup shift) selalu dikonfirmasi lebih dahulu. Aksi sehari-hari
tidak — konfirmasi yang muncul terlalu sering berhenti dibaca, dan begitu
berhenti dibaca, konfirmasi pada aksi yang benar-benar berbahaya ikut kehilangan
gunanya.

## Layar pelanggan

`lib/layar/tampilan_pelanggan.dart`. Bentuk datanya **tidak dapat** memuat harga
pokok, identitas kasir, maupun galat teknis — tidak ada medan untuk menampungnya.
Layar itu menghadap ke luar meja, dan yang tampak padanya tampak pula bagi orang
yang mengantre serta bagi kamera ponsel siapa pun yang lewat.

Pembukaan jendelanya di layar kedua **belum ada** (Android `Presentation`,
Windows multi-window). Yang sudah ada adalah isinya, beserta ujinya.

## Menguji

```bash
flutter test
```

126 uji, seluruhnya berjalan tanpa emulator, tanpa perangkat, dan tanpa printer.

`test/konformansi_test.dart` yang paling menentukan: ia membaca
`packages/pos-rules-vectors/vectors.json` — berkas yang **sama** dengan yang
diuji sisi TypeScript — dan menuntut Dart menghasilkan angka yang sama persis.
Aturan uang yang diubah di satu klien tanpa klien lain menjadi uji yang merah,
bukan perbedaan yang baru ketahuan di kasir.

`test/pencetak_test.dart` menguji pengangkutan sungguhan: yang jaringan terhadap
soket pendengar pada mesin yang sama, yang simpul perangkat dengan menunjuk
jalurnya ke berkas sementara. Jalur tulisnya sama persis dengan yang dipakai saat
mengirim ke `COM3`.

## Yang belum ada

| Belum ada | Akibatnya sekarang |
| --- | --- |
| Klien API | Katalog masih contoh yang tertanam pada `main.dart`; pelanggan, meja, shift, dan sesi kasir ikut kosong |
| Penyimpanan lokal | Keranjang hilang bila aplikasi ditutup |
| Buku transaksi luring | Penjualan belum tersimpan maupun terkirim ke peladen |
| Jenis pesanan terkirim | Dine In / Take Away / Delivery tercetak pada struk, tetapi belum tercatat di peladen |
| Pengangkutan Bluetooth | Printer Bluetooth belum dapat dipakai |
| Jendela layar kedua | Isi layar pelanggan sudah ada, jendelanya belum |
| Penandatanganan kode Windows | SmartScreen memperingatkan pada pemasangan pertama |

Empat yang pertama menunggu pekerjaan berikutnya. Dua berikutnya menunggu
pengujian pada perangkat sungguhan — keduanya tidak dapat dibuktikan tanpa mesin
kasir, dan menulisnya tanpa pernah menjalankannya hanya akan memindahkan
kegagalannya ke tempat yang lebih mahal untuk ditemukan. Yang terakhir menunggu
sertifikat yang harus dibeli.
