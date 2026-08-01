/// Pencetak struk lewat jaringan (ESC/POS di atas TCP, lazimnya porta 9100).
///
/// Dipakai printer LAN dan sebagian besar kotak konverter USB-ke-Ethernet.
/// Inilah satu-satunya pengangkutan yang dapat dibuktikan tanpa perangkat keras
/// apa pun: uji membuka soket pendengar di mesin yang sama dan memeriksa byte
/// yang benar-benar tiba.
library;

import 'dart:async';
import 'dart:io';

import '../layar/sumber.dart';

class PencetakJaringan implements Pencetak {
  PencetakJaringan({
    required this.host,
    this.porta = 9100,
    this.batasSambung = const Duration(seconds: 3),
    this.batasKirim = const Duration(seconds: 10),
  });

  final String host;
  final int porta;

  /// Batas menunggu sambungan.
  ///
  /// Pendek dengan sengaja. Printer yang mati tidak menolak sambungan melainkan
  /// diam, dan kasir yang menunggu tiga puluh detik di depan antrean akan
  /// menekan tombol cetak berulang kali — menghasilkan struk berganda begitu
  /// printernya hidup lagi.
  final Duration batasSambung;

  /// Batas menunggu seluruh byte terkirim.
  ///
  /// Lebih panjang daripada batas sambung: printer yang kehabisan kertas menahan
  /// aliran sampai kertasnya diganti, dan memutusnya di tengah struk mencetak
  /// separuh struk yang tidak dapat dipakai siapa pun.
  final Duration batasKirim;

  bool _siap = false;

  @override
  bool get siap => _siap;

  /// Mencoba menyambung sekali untuk mengetahui apakah printernya menjawab.
  ///
  /// Dipisahkan dari `kirim` supaya layar dapat mengatakan keadaannya sebelum
  /// kasir menekan bayar — bukan sesudah struk gagal tercetak.
  Future<bool> periksa() async {
    try {
      final s = await Socket.connect(host, porta, timeout: batasSambung);
      await s.close();
      s.destroy();
      _siap = true;
    } on Object {
      _siap = false;
    }
    return _siap;
  }

  @override
  Future<void> kirim(List<int> byte) async {
    Socket? s;
    try {
      s = await Socket.connect(host, porta, timeout: batasSambung);
      s.add(byte);
      /*
       * Menunggu byte benar-benar keluar sebelum menutup.
       *
       * Tanpa `flush`, menutup soket dapat membuang isi penyangga yang belum
       * terkirim — dan struk keluar terpotong di tengah, biasanya justru pada
       * bagian totalnya, tanpa satu pun galat yang muncul.
       */
      await s.flush().timeout(batasKirim);
      _siap = true;
    } on Object {
      _siap = false;
      rethrow;
    } finally {
      try {
        await s?.close();
      } on Object {
        // Kegagalan menutup tidak boleh menutupi kegagalan mengirim, yang jauh
        // lebih penting bagi pemanggilnya.
      }
      s?.destroy();
    }
  }
}
