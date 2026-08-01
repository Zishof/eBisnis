/// Perintah ESC/POS: struk dan laci kas.
///
/// ## Mengapa laci kas ada di berkas printer
///
/// Laci kas pada mesin kasir tidak punya jalur sendiri. Ia dicolokkan ke printer
/// struk lewat soket RJ-11, dan dibuka ketika printer menerima **perintah
/// pulsa** — `ESC p`. Jadi "integrasi laci kas" sesungguhnya adalah satu
/// perintah ESC/POS di antara perintah-perintah lain.
///
/// Pemindai barcode juga bukan integrasi tersendiri: hampir seluruh pemindai POS
/// bekerja sebagai papan ketik (HID). Ia mengetikkan kodenya lalu menekan Enter,
/// dan yang diperlukan hanyalah kotak teks yang fokusnya terjaga.
///
/// Yang tersisa sebagai perangkat keras sungguhan hanyalah printernya.
///
/// ## Mengapa byte-nya dibangun sendiri
///
/// Seluruh berkas ini fungsi murni atas daftar byte, sehingga dapat diuji tanpa
/// printer dan tanpa perangkat apa pun. Pustaka pihak ketiga akan menyembunyikan
/// byte-nya di balik antarmuka yang hanya dapat dibuktikan dengan mencetak
/// sungguhan — dan perintah membuka laci kas adalah hal yang paling tidak nyaman
/// untuk dibuktikan dengan cara mencobanya berulang kali.
library;

import 'dart:convert';

/// Byte kendali ESC/POS yang dipakai.
class Esc {
  Esc._();

  static const int esc = 0x1B;
  static const int gs = 0x1D;
  static const int lf = 0x0A;
}

enum Rata { kiri, tengah, kanan }

/// Penyusun perintah struk.
///
/// Dipakai sebagai penampung yang menumpuk byte, bukan sebagai rangkaian
/// pemanggilan yang mengembalikan objek baru: struk disusun berurutan dari atas
/// ke bawah, dan urutan itulah bentuk aslinya.
class StrukEscPos {
  StrukEscPos({this.lebarKolom = 32}) {
    _byte.addAll([Esc.esc, 0x40]); // ESC @ — kembalikan printer ke keadaan awal
  }

  /// Banyak karakter per baris. 32 untuk kertas 58 mm, 48 untuk 80 mm.
  ///
  /// Salah menyetelnya tidak menghasilkan galat: struknya tercetak dengan kolom
  /// harga yang meleset, dan barulah kelihatan setelah tertumpuk di laci.
  final int lebarKolom;

  final List<int> _byte = [];

  List<int> selesai() => List.unmodifiable(_byte);

  void _tulis(String teks) {
    // Latin-1, bukan UTF-8: printer termal ESC/POS umumnya memakai halaman kode
    // satu byte. Mengirim UTF-8 membuat huruf beraksen tercetak sebagai dua
    // karakter aneh, bukan sebagai galat yang terlihat.
    _byte.addAll(latin1.encode(_gantiTakTerwakili(teks)));
  }

  /// Mengganti karakter yang tidak ada pada Latin-1 dengan padanan terdekat.
  ///
  /// Nama produk Indonesia jarang memerlukannya, tetapi tanda pisah dan tanda
  /// kutip melengkung sering ikut tersalin dari data master — dan tanpa
  /// penggantian, keduanya tercetak sebagai `?` di tengah nama barang.
  String _gantiTakTerwakili(String teks) => teks
      .replaceAll('—', '-')
      .replaceAll('–', '-')
      .replaceAll('‘', "'")
      .replaceAll('’', "'")
      .replaceAll('“', '"')
      .replaceAll('”', '"')
      .replaceAll('…', '...');

  void barisKosong([int jumlah = 1]) {
    for (var i = 0; i < jumlah; i += 1) {
      _byte.add(Esc.lf);
    }
  }

  void rata(Rata r) {
    _byte.addAll([Esc.esc, 0x61, r.index]);
  }

  void tebal(bool aktif) {
    _byte.addAll([Esc.esc, 0x45, aktif ? 1 : 0]);
  }

  /// Ukuran ganda untuk judul. `0` normal, `1` dua kali lipat.
  void ukuranGanda({bool lebar = false, bool tinggi = false}) {
    final n = (lebar ? 0x20 : 0) | (tinggi ? 0x10 : 0);
    _byte.addAll([Esc.gs, 0x21, n]);
  }

  void baris(String teks) {
    _tulis(teks);
    _byte.add(Esc.lf);
  }

  /// Satu baris dengan keterangan di kiri dan angka di kanan.
  ///
  /// Angka yang tidak rata kanan membuat struk sulit dibaca sekilas, dan kasir
  /// membaca struk sekilas — biasanya sambil menyerahkan kembalian.
  void barisKiriKanan(String kiri, String kanan) {
    final ruang = lebarKolom - kanan.length;
    if (ruang <= 0) {
      baris(kanan);
      return;
    }
    final kiriDipotong = kiri.length > ruang - 1 ? kiri.substring(0, ruang - 1) : kiri;
    baris(kiriDipotong.padRight(ruang) + kanan);
  }

  void garis([String karakter = '-']) {
    baris(karakter * lebarKolom);
  }

  /// Memotong kertas.
  void potong() {
    barisKosong(3); // ruang supaya potongannya tidak memakan baris terakhir
    _byte.addAll([Esc.gs, 0x56, 0x42, 0x00]); // GS V B 0 — potong sebagian
  }

  /// Membuka laci kas.
  ///
  /// `ESC p m t1 t2` — pulsa pada pin `m`, selama `t1` dan `t2` (satuan 2 ms).
  ///
  /// Pin 0 (soket 2) adalah yang lazim; sebagian printer memakai pin 1 (soket 5).
  /// Durasinya tidak boleh terlalu pendek: laci yang pulsanya kurang panjang
  /// hanya berbunyi klik tanpa terbuka, dan kasir akan menekan tombolnya
  /// berulang kali sambil antrean menunggu.
  void bukaLaci({int pin = 0, int nyalaMs = 50, int matiMs = 250}) {
    final t1 = (nyalaMs ~/ 2).clamp(1, 255);
    final t2 = (matiMs ~/ 2).clamp(1, 255);
    _byte.addAll([Esc.esc, 0x70, pin == 0 ? 0x00 : 0x01, t1, t2]);
  }
}

/// Perintah membuka laci kas, berdiri sendiri.
///
/// Dipakai ketika kasir menekan tombol "buka laci" di luar transaksi — misalnya
/// untuk menukar uang. Tindakan itu tetap harus tercatat pada audit peladen;
/// yang ada di sini hanyalah byte-nya.
List<int> perintahBukaLaci({int pin = 0, int nyalaMs = 50, int matiMs = 250}) {
  final t1 = (nyalaMs ~/ 2).clamp(1, 255);
  final t2 = (matiMs ~/ 2).clamp(1, 255);
  return [Esc.esc, 0x70, pin == 0 ? 0x00 : 0x01, t1, t2];
}
