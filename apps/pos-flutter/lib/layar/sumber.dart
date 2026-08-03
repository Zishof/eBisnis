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
    this.kategori,
    this.varian,
    this.stok,
    this.favorit = false,
  });

  final String productId;
  final String nama;

  /// Harga beku dari salinan katalog. Peramban maupun klien ini tidak pernah
  /// menghitungnya sendiri.
  final String harga;
  final List<String> barcodes;
  final String? uomId;
  final String? taxRateId;

  /// Kategori untuk penyaring di atas kisi produk. Null berarti tidak
  /// berkategori, dan produknya hanya muncul pada "Semua".
  final String? kategori;

  /// Keterangan varian yang tampil di bawah nama, misalnya `Reguler`, `Slice`.
  final String? varian;

  /// Sisa stok pada salinan katalog, atau **null bila tidak diketahui**.
  ///
  /// Dibedakan tegas dari nol. Salinan katalog tidak selalu membawa stok, dan
  /// menampilkan "Stok 0" untuk stok yang tidak diketahui membuat kasir menolak
  /// menjual barang yang sebenarnya ada di rak.
  final int? stok;

  /// Ditandai kasir atau gerai sebagai barang yang paling sering terjual.
  final bool favorit;
}

/// Salinan katalog di mesin kasir.
///
/// Diturunkan dengan `extends`, bukan `implements`: sebagian anggotanya sudah
/// punya isi bawaan yang cukup, dan `implements` menuntut seluruhnya ditulis
/// ulang — termasuk yang tidak perlu diubah.
abstract class SumberKatalog {
  /// Produk untuk sebuah barcode, atau null bila tidak ada pada salinan.
  ///
  /// Barcode utama dan alternatif diperlakukan sama: pemindai tidak tahu
  /// bedanya, dan kasir tidak seharusnya perlu tahu.
  ProdukLokal? dariBarcode(String kode);

  /// Pencarian menurut nama untuk kasir yang mengetik, bukan memindai.
  List<ProdukLokal> cari(String kunci);

  /// Seluruh produk pada salinan, untuk kisi yang ditekan kasir dengan jari.
  ///
  /// Bawaannya adalah pencarian dengan kunci kosong, sehingga implementasi yang
  /// sudah ada tidak perlu berubah. Sumber yang katalognya besar sebaiknya
  /// menimpanya dengan pembacaan berhalaman.
  List<ProdukLokal> semua() => cari('');

  /// Kategori yang benar-benar dipakai produk pada salinan ini.
  ///
  /// Diturunkan, bukan didaftar terpisah: daftar kategori yang disimpan sendiri
  /// akan memuat kategori kosong — penyaring yang ditekan lalu tidak
  /// menampilkan apa pun, dan kasir menyimpulkan aplikasinya rusak.
  List<String> kategori() {
    final terpakai = <String>{};
    for (final p in semua()) {
      final k = p.kategori;
      if (k != null && k.trim().isNotEmpty) terpakai.add(k);
    }
    final urut = terpakai.toList()..sort();
    return urut;
  }

  /// Tarif pajak yang berlaku, dari salinan yang sama dengan harganya.
  List<TarifLuring> get tarif;

  String get mataUang;
}

/// Katalog sederhana yang hidup di memori aplikasi.
///
/// Dipakai untuk data contoh dan untuk hasil upload Excel pada mesin kasir.
/// Peladen tetap menjadi sumber utama bila POS tersambung, tetapi kasir perlu
/// dapat mencoba daftar produk dari file tanpa menunggu sinkronisasi penuh.
class KatalogMemori extends SumberKatalog {
  KatalogMemori({
    required List<ProdukLokal> produk,
    required this.mataUang,
    List<TarifLuring> tarif = const [],
  })  : _produk = List.of(produk),
        _tarif = List.of(tarif);

  final List<ProdukLokal> _produk;
  final List<TarifLuring> _tarif;

  @override
  final String mataUang;

  @override
  ProdukLokal? dariBarcode(String kode) {
    final bersih = kode.trim();
    for (final p in _produk) {
      if (p.barcodes.contains(bersih)) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) {
    final kecil = kunci.trim().toLowerCase();
    if (kecil.isEmpty) return List.unmodifiable(_produk);
    return _produk.where((p) {
      return p.nama.toLowerCase().contains(kecil) ||
          p.productId.toLowerCase().contains(kecil) ||
          p.barcodes.any((b) => b.contains(kunci.trim()));
    }).toList();
  }

  @override
  List<TarifLuring> get tarif => List.unmodifiable(_tarif);
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

/// Transaksi yang sudah disetujui kasir untuk dibukukan.
///
/// Angka di dalam `hasil` tetap angka lokal dari salinan katalog. Saat
/// tersambung peladen, angka otoritatif tetap dihitung ulang oleh endpoint POS;
/// bentuk ini hanya memberi tahu peladen produk, jumlah, dan pembayaran yang
/// dipilih kasir.
class TransaksiKasir {
  const TransaksiKasir({
    required this.baris,
    required this.hasil,
    required this.metode,
    required this.diserahkan,
    required this.kembalian,
    required this.jenisPesanan,
    required this.catatan,
  });

  final List<BarisLuring> baris;
  final HasilKeranjang hasil;
  final MetodeBayar metode;
  final String diserahkan;
  final String kembalian;
  final String jenisPesanan;
  final String catatan;

  String get total => hasil.grandTotal;
}

/// Pembuku transaksi ke sistem pusat.
///
/// Mengembalikan nomor struk dari peladen bila pembukuan berhasil. Bila null,
/// layar tetap menjalankan mode lokal lama.
typedef PembukuanKasir = Future<String?> Function(TransaksiKasir transaksi);

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
