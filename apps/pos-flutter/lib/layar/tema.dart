/// Warna dan bentuk layar kasir, mengikuti rancangan eBisnis POS.
///
/// Dikumpulkan di satu berkas bukan demi kerapian, melainkan karena layar kasir
/// dibaca sambil berdiri, di bawah lampu gerai, oleh orang yang matanya sedang
/// pada pembeli. Kontras dan ukuran angka di sini menentukan apakah kasir
/// membaca total yang benar — dan warna yang ditebak per widget cepat atau
/// lambat menghasilkan satu tempat dengan kontras yang tidak cukup.
library;

import 'package:flutter/material.dart';

abstract final class Warna {
  /// Bilah samping dan bilah atas.
  static const gelap = Color(0xFF0F172A);
  static const gelapMuda = Color(0xFF1E293B);
  static const garisGelap = Color(0xFF1E2C45);

  /// Latar halaman dan kartu.
  static const halaman = Color(0xFFF1F5F9);
  static const kartu = Color(0xFFFFFFFF);
  static const garis = Color(0xFFE2E8F0);

  static const utama = Color(0xFF2563EB);
  static const utamaMuda = Color(0xFFEFF6FF);

  static const teks = Color(0xFF0F172A);
  static const teksRedup = Color(0xFF64748B);
  static const teksAtasGelap = Color(0xFF94A3B8);

  static const hijau = Color(0xFF16A34A);
  static const jingga = Color(0xFFD97706);
  static const merah = Color(0xFFDC2626);
}

/// Keadaan stok sebagaimana ditampilkan pada kartu produk.
enum KeadaanStok { takDiketahui, aman, menipis, habis }

/// Ambang "menipis".
///
/// Bukan angka ajaib: ia menandai barang yang tidak akan bertahan sampai gerai
/// tutup, sehingga kasir dapat memberi tahu pembeli sebelum barangnya dipesan,
/// bukan sesudah.
const int ambangStokMenipis = 10;

KeadaanStok keadaanStok(int? stok) {
  // Null bukan nol. Salinan katalog tidak selalu membawa stok, dan menampilkan
  // "Stok 0" untuk stok yang tidak diketahui membuat kasir menolak menjual
  // barang yang sebenarnya ada di rak.
  if (stok == null) return KeadaanStok.takDiketahui;
  if (stok <= 0) return KeadaanStok.habis;
  if (stok <= ambangStokMenipis) return KeadaanStok.menipis;
  return KeadaanStok.aman;
}

({Color latar, Color teks}) warnaStok(KeadaanStok k) => switch (k) {
      KeadaanStok.aman => (latar: const Color(0xFFDCFCE7), teks: const Color(0xFF15803D)),
      KeadaanStok.menipis => (latar: const Color(0xFFFEF3C7), teks: const Color(0xFFB45309)),
      KeadaanStok.habis => (latar: const Color(0xFFFEE2E2), teks: const Color(0xFFB91C1C)),
      KeadaanStok.takDiketahui => (latar: const Color(0xFFF1F5F9), teks: Warna.teksRedup),
    };

/// Warna tombol untuk sebuah metode pembayaran.
///
/// Dipetakan dari kode metode, bukan dari urutannya: kasir menghafal warna, dan
/// warna yang berpindah ketika gerai menambah satu metode baru akan membuat
/// tangan yang terlatih menekan tombol yang salah.
Color warnaMetode(String id) {
  final k = id.toUpperCase();
  if (k.contains('TUNAI') || k.contains('CASH')) return Warna.hijau;
  if (k.contains('QRIS') || k.contains('QR')) return Warna.utama;
  if (k.contains('KARTU') || k.contains('CARD') || k.contains('DEBIT')) {
    return const Color(0xFF7C3AED);
  }
  if (k.contains('TRANSFER') || k.contains('BANK')) return const Color(0xFF0891B2);
  if (k.contains('SPLIT')) return const Color(0xFFEA580C);
  return Warna.gelapMuda;
}

/// Warna tetap untuk kotak gambar produk, diturunkan dari id produknya.
///
/// Salinan katalog belum membawa foto. Kotak berwarna dengan huruf awal produk
/// lebih berguna daripada ikon gambar rusak: warnanya tetap sama untuk produk
/// yang sama, sehingga kasir tetap dapat mengenalinya dari sudut mata.
Color warnaKotakProduk(String productId) {
  const palet = [
    Color(0xFFDBEAFE),
    Color(0xFFFCE7F3),
    Color(0xFFDCFCE7),
    Color(0xFFFEF3C7),
    Color(0xFFEDE9FE),
    Color(0xFFCFFAFE),
  ];
  var jumlah = 0;
  for (final unit in productId.codeUnits) {
    jumlah = (jumlah + unit) % palet.length;
  }
  return palet[jumlah];
}

ThemeData temaKasir() {
  final dasar = ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Warna.utama),
    useMaterial3: true,
  );
  return dasar.copyWith(
    scaffoldBackgroundColor: Warna.halaman,
    textTheme: dasar.textTheme.apply(bodyColor: Warna.teks, displayColor: Warna.teks),
  );
}

/// Kartu putih bersudut, dipakai kisi produk dan panel keranjang.
BoxDecoration hiasanKartu({Color? garis, double radius = 12}) => BoxDecoration(
      color: Warna.kartu,
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: garis ?? Warna.garis),
    );
