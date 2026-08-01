/// Keadaan pemeriksaan pembaruan yang dibaca layar.
///
/// ## Aturan yang menentukan bentuknya
///
/// **Pemeriksaan otomatis tidak pernah membuka dialog.** Ia hanya menyalakan
/// tanda pada tombol. Dialog hanya terbuka ketika kasir menekannya sendiri.
///
/// Alasannya bukan estetika. Mesin kasir dipakai berdiri, dengan antrean di
/// depan meja, dan jendela yang muncul sendiri akan ditutup dengan tekanan
/// tombol yang sedang dituju jari — tombol yang mungkin "Pasang sekarang".
/// Pembaruan yang berjalan di tengah transaksi menghentikan penjualan pada saat
/// yang paling mahal.
library;

import 'package:flutter/foundation.dart';

import 'sumber_pembaruan.dart';
import 'versi.dart';

class PengelolaPembaruan extends ChangeNotifier {
  PengelolaPembaruan({required this.sumber, required this.versiBerjalan});

  final SumberPembaruan sumber;
  final String versiBerjalan;

  HasilPeriksaPembaruan? _hasil;

  /// Hasil pemeriksaan terakhir, atau null bila belum pernah diperiksa.
  ///
  /// Dibedakan tegas dari "sudah diperiksa dan mutakhir": layar yang menampilkan
  /// "versi terbaru" padahal belum pernah memeriksa apa pun adalah kebohongan
  /// yang paling mudah dipercaya.
  HasilPeriksaPembaruan? get hasil => _hasil;

  bool _sedangMemeriksa = false;
  bool get sedangMemeriksa => _sedangMemeriksa;

  bool _dibuang = false;

  /// Benar hanya ketika ada versi lebih baru yang benar-benar dapat dipasang.
  bool get adaPembaruan => _hasil?.keadaan == KeadaanPembaruan.tersedia;

  Future<void> periksa() async {
    // Tombol yang ditekan berulang tidak menumpuk permintaan. Kasir yang merasa
    // tidak terjadi apa-apa akan menekannya lagi, dan tiga permintaan serentak
    // ke GitHub berakhir sebagai pembatasan laju — yaitu kegagalan yang tampak
    // persis seperti tidak ada jaringan.
    if (_sedangMemeriksa) return;

    _sedangMemeriksa = true;
    _kabari();
    try {
      final rilis = await sumber.ambil();
      _hasil = nilaiPembaruan(versiBerjalan: versiBerjalan, rilis: rilis);
    } finally {
      _sedangMemeriksa = false;
      _kabari();
    }
  }

  void _kabari() {
    if (_dibuang) return;
    notifyListeners();
  }

  @override
  void dispose() {
    _dibuang = true;
    super.dispose();
  }
}
