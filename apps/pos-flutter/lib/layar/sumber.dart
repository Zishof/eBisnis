/// Sumber data dan perangkat yang dipakai layar kasir.
///
/// Ditulis sebagai antarmuka, bukan implementasi, dengan satu alasan: bagian
/// yang menentukan pada layar kasir — apa yang terjadi ketika barang dipindai,
/// ketika kembalian dihitung, ketika laci dibuka — dapat dibuktikan tanpa
/// peladen, tanpa printer, dan tanpa mesin kasir sungguhan.
///
/// Implementasi aslinya (HTTP, SQLite, USB, serial) menyusul, dan masing-masing
/// hanya perlu membuktikan bahwa ia menyalurkan data dengan benar — bukan bahwa
/// aturan kasirnya benar, sebab itu sudah dijaga di tempat lain.
library;

import '../aturan/harga_luring.dart';

/// Satu produk pada salinan katalog di mesin ini.
class ProdukLokal {
  const ProdukLokal({
    required this.productId,
    required this.nama,
    required this.harga,
    required this.barcodes,
    this.uomId,
    this.taxRateId,
  });

  final String productId;
  final String nama;

  /// Harga beku dari salinan katalog. Peramban maupun klien ini tidak pernah
  /// menghitungnya sendiri.
  final String harga;
  final List<String> barcodes;
  final String? uomId;
  final String? taxRateId;
}

/// Salinan katalog di mesin kasir.
abstract class SumberKatalog {
  /// Produk untuk sebuah barcode, atau null bila tidak ada pada salinan.
  ///
  /// Barcode utama dan alternatif diperlakukan sama: pemindai tidak tahu
  /// bedanya, dan kasir tidak seharusnya perlu tahu.
  ProdukLokal? dariBarcode(String kode);

  /// Pencarian menurut nama untuk kasir yang mengetik, bukan memindai.
  List<ProdukLokal> cari(String kunci);

  /// Tarif pajak yang berlaku, dari salinan yang sama dengan harganya.
  List<TarifLuring> get tarif;

  String get mataUang;
}

/// Metode pembayaran sebagaimana tersalin dari peladen.
class MetodeBayar {
  const MetodeBayar({
    required this.id,
    required this.nama,
    required this.memberiKembalian,
  });

  final String id;
  final String nama;

  /// Hanya tunai yang memberi kembalian. Menebaknya di sini berarti aturannya
  /// tertulis dua kali dan cepat atau lambat berbeda dari peladen.
  final bool memberiKembalian;
}

/// Printer struk, sekaligus jalan membuka laci kas.
abstract class Pencetak {
  /// Mengirim byte ESC/POS apa adanya.
  ///
  /// Sengaja hanya menerima byte: seluruh penyusunan perintah ada di
  /// `perangkat/escpos.dart` yang murni dan teruji. Antarmuka yang menerima
  /// "struk" sebagai objek akan memindahkan sebagian penyusunan ke sini, ke
  /// tempat yang hanya dapat dibuktikan dengan mencetak sungguhan.
  Future<void> kirim(List<int> byte);

  /// Benar bila printernya terpasang dan menjawab.
  ///
  /// Dipakai layar untuk mengatakan apa adanya ketika struk tidak dapat
  /// tercetak — kasir yang menunggu struk keluar dari printer yang mati akan
  /// menekan tombol cetak berulang kali.
  bool get siap;
}

/// Pencetak yang tidak melakukan apa pun.
///
/// Dipakai ketika mesin kasir memang tidak punya printer — misalnya tablet yang
/// hanya menampilkan struk di layar. Ia melaporkan dirinya TIDAK siap, sehingga
/// layar mengatakan struk tidak tercetak alih-alih diam.
class TanpaPencetak implements Pencetak {
  const TanpaPencetak();

  @override
  bool get siap => false;

  @override
  Future<void> kirim(List<int> byte) async {}
}
