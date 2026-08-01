/// Peta pintasan papan ketik layar kasir.
///
/// ## Peta ini mengikuti spesifikasi AIS POS §21
///
/// Bukan peta yang dikarang di sini. Ia diambil dari sistem kasir yang sudah
/// dipakai bertahun-tahun di gerai sungguhan, sehingga jari kasir yang berpindah
/// ke eBisnis sudah tahu tempatnya.
///
/// **Kedua klien memakai peta yang sama.** Peta yang berbeda antara klien web
/// dan klien ini lebih buruk daripada peta mana pun yang dipilih: kasir yang
/// berpindah di tengah shift menekan tombol yang sama dan mendapat hal yang
/// berbeda.
///
/// ## Yang berubah, dan mengapa itu perlu dikatakan
///
/// | Tombol | Sebelumnya | Sekarang |
/// | --- | --- | --- |
/// | F2 | Fokus kotak pindai | **Bayar** |
/// | F3 | Cari produk | Tahan keranjang |
/// | F5 | Hapus baris | Pilih member |
/// | F6 | Tahan keranjang | **Buka laci kas** |
/// | F8 | Buka laci kas | Sinkronkan |
/// | F9 | **Bayar** | Layar pelanggan |
///
/// Jari yang terlatih akan salah tekan pada minggu pertama. Karena itu aksi yang
/// menyentuh uang atau menghilangkan pekerjaan tetap dikonfirmasi lebih dahulu
/// — lihat [wajibKonfirmasi] — dan bilah pintasan di kaki layar selalu terlihat,
/// dibangkitkan dari berkas ini sehingga tidak mungkin menampilkan peta lama.
///
/// F2 kehilangan "fokus kotak pindai" tanpa penggantinya berupa tombol lain:
/// kotak pindai kini merebut kembali fokus dengan sendirinya (spesifikasi §3.2),
/// sehingga tombol untuk itu memang tidak diperlukan lagi.
///
/// ## Mengapa Flutter, bukan peramban
///
/// Peramban menahan sebagian tombol untuk dirinya sendiri: F1 membuka bantuan,
/// F5 memuat ulang, F11 layar penuh, F12 alat pengembang. `preventDefault` tidak
/// dapat merebutnya. Pada aplikasi asli seluruh tombol tersedia — dan itulah
/// satu-satunya keunggulan pintasan yang tidak dapat dikejar PWA.
library;

import 'package:flutter/services.dart';

enum AksiKasir {
  bantuan,
  bayar,
  tahanKeranjang,
  pilihMetodeBayar,
  pilihMember,
  bukaLaci,
  modeFokus,
  sinkronkan,
  layarPelanggan,
  batalTransaksi,
  cetakUlangStruk,
  tutupShift,
  tutupDialog,

  /// Masih ada sebagai aksi, tetapi **tanpa tombol**.
  ///
  /// Spesifikasi AIS memakai F1–F9 seluruhnya, dan jumlah baris diubah dengan
  /// menekan +/− pada barisnya. Dipertahankan supaya layar tetap punya satu nama
  /// untuk aksinya.
  ubahJumlah,
  hapusBaris,

  /// Mengambil keranjang yang ditahan. Tanpa tombol: tempatnya di layar Pesanan
  /// (spesifikasi §5), bukan di layar kasir.
  ambilTertahan,
}

/// Keterangan yang ditampilkan pada bilah bantuan di kaki layar.
///
/// Ditulis sebagai kalimat kerja, bukan nama menu: kasir mencari "apa yang
/// terjadi kalau saya tekan ini", bukan nama internal fiturnya.
const Map<AksiKasir, String> keteranganAksi = {
  AksiKasir.bantuan: 'Bantuan',
  AksiKasir.bayar: 'Bayar',
  AksiKasir.tahanKeranjang: 'Tahan keranjang',
  AksiKasir.pilihMetodeBayar: 'Pilih metode bayar',
  AksiKasir.pilihMember: 'Pilih member',
  AksiKasir.bukaLaci: 'Buka laci kas',
  AksiKasir.modeFokus: 'Fokus keranjang',
  AksiKasir.sinkronkan: 'Sinkronkan',
  AksiKasir.layarPelanggan: 'Layar pelanggan',
  AksiKasir.batalTransaksi: 'Batalkan transaksi',
  AksiKasir.cetakUlangStruk: 'Cetak ulang struk',
  AksiKasir.tutupShift: 'Tutup shift',
  AksiKasir.tutupDialog: 'Tutup / batal',
  AksiKasir.ubahJumlah: 'Ubah jumlah',
  AksiKasir.hapusBaris: 'Hapus baris',
  AksiKasir.ambilTertahan: 'Ambil yang ditahan',
};

/// Tombol yang tidak dapat direbut peramban, sehingga hanya bekerja di sini.
///
/// Dipakai layar bantuan untuk menandainya — supaya kasir yang berpindah antara
/// klien web dan klien ini tahu mana yang berbeda, alih-alih mengira salah satu
/// rusak.
const Set<AksiKasir> hanyaDiAplikasiAsli = {
  AksiKasir.bantuan, // F1
  AksiKasir.pilihMember, // F5
  AksiKasir.cetakUlangStruk, // F11
  AksiKasir.tutupShift, // F12
};

/// Aksi yang menghilangkan pekerjaan atau menyentuh uang, sehingga wajib
/// dikonfirmasi lebih dahulu.
///
/// Bukan karena kasir ceroboh, melainkan karena jari yang terlatih menekan lebih
/// cepat daripada mata membaca. Membatalkan transaksi berisi dua belas barang
/// karena salah menekan satu tombol adalah kerugian yang tidak dapat dipulihkan
/// selain dengan memindai ulang seluruhnya di depan antrean.
///
/// `bukaLaci` termasuk bukan karena merusak, melainkan karena membuka laci di
/// luar transaksi adalah tindakan yang harus dapat dipertanggungjawabkan — dan
/// ia kini menempati F6, tombol yang **sebelumnya menahan keranjang**. Justru
/// pada pergantian peta inilah konfirmasi itu paling berguna.
const Set<AksiKasir> wajibKonfirmasi = {
  AksiKasir.batalTransaksi,
  AksiKasir.hapusBaris,
  AksiKasir.bukaLaci,
  AksiKasir.tutupShift,
};

// `final`, bukan `const`: Dart melarang kunci map konstan dari kelas yang
// menimpa `==`, dan `LogicalKeyboardKey` menimpanya.
//
// F1–F9 persis spesifikasi AIS §21. F10–F12 dibiarkan untuk aksi eBisnis yang
// tidak ada padanannya di sana — spesifikasi memang tidak memakai ketiganya,
// jadi tidak ada yang bertabrakan.
final Map<LogicalKeyboardKey, AksiKasir> _peta = {
  LogicalKeyboardKey.f1: AksiKasir.bantuan,
  LogicalKeyboardKey.f2: AksiKasir.bayar,
  LogicalKeyboardKey.f3: AksiKasir.tahanKeranjang,
  LogicalKeyboardKey.f4: AksiKasir.pilihMetodeBayar,
  LogicalKeyboardKey.f5: AksiKasir.pilihMember,
  LogicalKeyboardKey.f6: AksiKasir.bukaLaci,
  LogicalKeyboardKey.f7: AksiKasir.modeFokus,
  LogicalKeyboardKey.f8: AksiKasir.sinkronkan,
  LogicalKeyboardKey.f9: AksiKasir.layarPelanggan,
  LogicalKeyboardKey.f10: AksiKasir.batalTransaksi,
  LogicalKeyboardKey.f11: AksiKasir.cetakUlangStruk,
  LogicalKeyboardKey.f12: AksiKasir.tutupShift,
  LogicalKeyboardKey.escape: AksiKasir.tutupDialog,
};

/// Aksi untuk sebuah tombol, atau null bila tombolnya bukan pintasan.
///
/// Tombol bermodifier (Ctrl, Alt, Shift) sengaja **tidak** dipetakan di sini.
/// Pemindai barcode HID mengetik seperti papan ketik, dan sebagian model
/// mengirim modifier saat mengetik huruf besar; memetakan kombinasi bermodifier
/// membuat pindaian tertentu memicu aksi alih-alih masuk ke kotak pindai.
///
/// Ctrl+angka (spesifikasi §21, memilih baris ke-N) belum dipetakan: ia menunggu
/// daftar yang memang dapat dipilih dengan angka, dan memetakannya sekarang
/// hanya menghasilkan tombol yang tidak melakukan apa pun.
AksiKasir? aksiUntukTombol(LogicalKeyboardKey tombol, {bool adaModifier = false}) {
  if (adaModifier) return null;
  return _peta[tombol];
}

/// Peta lengkap untuk layar bantuan, berurut sesuai nomor tombolnya.
List<({String tombol, AksiKasir aksi})> daftarPintasan() {
  final urutan = [
    (nama: 'F1', tombol: LogicalKeyboardKey.f1),
    (nama: 'F2', tombol: LogicalKeyboardKey.f2),
    (nama: 'F3', tombol: LogicalKeyboardKey.f3),
    (nama: 'F4', tombol: LogicalKeyboardKey.f4),
    (nama: 'F5', tombol: LogicalKeyboardKey.f5),
    (nama: 'F6', tombol: LogicalKeyboardKey.f6),
    (nama: 'F7', tombol: LogicalKeyboardKey.f7),
    (nama: 'F8', tombol: LogicalKeyboardKey.f8),
    (nama: 'F9', tombol: LogicalKeyboardKey.f9),
    (nama: 'F10', tombol: LogicalKeyboardKey.f10),
    (nama: 'F11', tombol: LogicalKeyboardKey.f11),
    (nama: 'F12', tombol: LogicalKeyboardKey.f12),
    (nama: 'Esc', tombol: LogicalKeyboardKey.escape),
  ];
  return [
    for (final u in urutan)
      if (_peta[u.tombol] case final a?) (tombol: u.nama, aksi: a),
  ];
}
