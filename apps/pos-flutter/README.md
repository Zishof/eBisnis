# Klien kasir eBisnis.id (Flutter)

Klien **kedua** dari sistem yang sama — bukan POS berdiri sendiri. Satu peladen,
satu basis data, satu jalur penerimaan transaksi luring. Alasannya, batasnya, dan
ongkosnya ada di [ADR-012](../../docs/architecture/ADR-012-klien-kasir-kedua-flutter.md).

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

76 uji, seluruhnya berjalan tanpa emulator, tanpa perangkat, dan tanpa printer.

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
| Klien API | Katalog masih contoh yang tertanam pada `main.dart` |
| Penyimpanan lokal | Keranjang hilang bila aplikasi ditutup |
| Buku transaksi luring | Penjualan belum tersimpan maupun terkirim ke peladen |
| Pengangkutan Bluetooth | Printer Bluetooth belum dapat dipakai |
| Jendela layar kedua | Isi layar pelanggan sudah ada, jendelanya belum |

Tiga yang pertama menunggu pekerjaan berikutnya. Dua yang terakhir menunggu
pengujian pada perangkat sungguhan — keduanya tidak dapat dibuktikan tanpa mesin
kasir, dan menulisnya tanpa pernah menjalankannya hanya akan memindahkan
kegagalannya ke tempat yang lebih mahal untuk ditemukan.
