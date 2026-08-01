/// Pencetak struk lewat simpul perangkat: porta serial, USB, atau berkas.
///
/// ## Mengapa menulis ke jalur berkas, bukan memakai pustaka USB
///
/// Printer termal USB pada mesin kasir Windows hampir selalu muncul sebagai
/// porta COM maya (`COM3`, `COM4`) — itulah yang dipasang pemandunya. Pada Linux
/// ia muncul sebagai `/dev/usb/lp0`. Pada keduanya, mengirim ESC/POS berarti
/// menulis byte mentah ke jalur itu, dan Dart sudah dapat melakukannya tanpa
/// pustaka apa pun.
///
/// Karena jalurnya hanyalah jalur, kelas ini dapat diuji dengan menunjuknya ke
/// berkas sementara dan memeriksa byte yang tertulis. Itu bukan tipuan uji:
/// jalur tulisnya benar-benar sama dengan yang dipakai saat mencetak sungguhan.
///
/// ## Yang TIDAK tercakup
///
/// Printer Bluetooth. Ia menuntut penyandingan, izin sistem, dan pustaka khas
/// platform — dan tidak dapat dibuktikan tanpa perangkat sungguhan. Ia sengaja
/// dibiarkan kosong daripada ditulis tanpa pernah dijalankan.
library;

import 'dart:io';

import '../layar/sumber.dart';

class PencetakPerangkat implements Pencetak {
  PencetakPerangkat(this.jalur);

  /// Jalur simpul perangkat.
  ///
  /// Contoh: `COM3` atau `\\.\COM3` pada Windows, `/dev/usb/lp0` pada Linux,
  /// atau jalur berkas biasa untuk menampung keluaran saat menelusuri masalah.
  final String jalur;

  bool _siap = false;

  @override
  bool get siap => _siap;

  /// Memeriksa apakah jalurnya ada dan dapat ditulis.
  ///
  /// Tidak mencetak apa pun untuk memeriksanya. Halaman uji yang keluar setiap
  /// kali aplikasi dibuka akan menghabiskan kertas, dan kasir akan belajar
  /// mengabaikan kertas yang keluar sendiri — termasuk struk yang tercetak
  /// karena salah tekan.
  Future<bool> periksa() async {
    try {
      final f = File(jalur);
      // Membuka untuk ditambahkan, lalu menutupnya tanpa menulis apa pun.
      final akses = await f.open(mode: FileMode.append);
      await akses.close();
      _siap = true;
    } on Object {
      _siap = false;
    }
    return _siap;
  }

  @override
  Future<void> kirim(List<int> byte) async {
    RandomAccessFile? akses;
    try {
      /*
       * Ditambahkan, bukan ditimpa.
       *
       * Pada simpul perangkat keduanya sama saja — byte diteruskan ke printer.
       * Pada berkas biasa perbedaannya besar: menimpa akan menghapus struk
       * sebelumnya, dan berkas itu justru dipakai ketika seseorang sedang
       * menelusuri masalah cetak dan memerlukan seluruh riwayatnya.
       */
      akses = await File(jalur).open(mode: FileMode.append);
      await akses.writeFrom(byte);
      await akses.flush();
      _siap = true;
    } on Object {
      _siap = false;
      rethrow;
    } finally {
      try {
        await akses?.close();
      } on Object {
        // Kegagalan menutup tidak boleh menutupi kegagalan menulis.
      }
    }
  }
}
