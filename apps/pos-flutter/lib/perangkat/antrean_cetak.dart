/// Pembungkus yang membuat perintah ke printer berjalan satu per satu.
///
/// ## Mengapa ini ada
///
/// Spesifikasi AIS §19 mencatat pelajaran dari lapangan: beberapa panggilan
/// cetak yang berjalan bersamaan terbukti membuat aplikasi kasir mereka **keluar
/// sendiri**, terutama pada pemandu printer yang tidak stabil — dan printer
/// termal murah memang kerap begitu.
///
/// Pada klien ini jalannya mudah dicapai tanpa niat: kasir menekan bayar,
/// struknya sedang dikirim, lalu ia menekan buka laci. Keduanya menulis ke soket
/// atau simpul perangkat yang sama. Yang terjadi bukan galat melainkan byte dua
/// perintah yang berselang-seling — struk tercetak rusak, atau laci tidak
/// terbuka, tanpa satu pun pesan.
///
/// ## Mengantre, bukan menolak
///
/// Perintah kedua **ditunda**, bukan dibuang. Kasir yang menekan buka laci saat
/// struk sedang tercetak memang bermaksud membuka laci; menolaknya berarti ia
/// menekan lagi lebih keras.
library;

import 'dart:async';

import '../layar/sumber.dart';

class PencetakBerantre implements Pencetak {
  PencetakBerantre(this._dalam);

  final Pencetak _dalam;

  /// Ekor antrean. Setiap kiriman baru menyambung di belakangnya.
  Future<void> _ekor = Future<void>.value();

  @override
  bool get siap => _dalam.siap;

  @override
  Future<void> kirim(List<int> byte) {
    final giliran = _ekor.then((_) => _dalam.kirim(byte));

    /*
     * Ekornya menelan galat, yang dikembalikan tidak.
     *
     * Dua hal berbeda yang mudah tertukar:
     *
     * - Pemanggil HARUS tahu struknya gagal tercetak. Menelan galatnya di situ
     *   membuat kasir mengira struk sudah keluar lalu menyerahkan barang tanpa
     *   struk.
     * - Antreannya TIDAK boleh putus karena satu kegagalan. Bila ekor membawa
     *   galat itu, setiap kiriman berikutnya gagal seketika tanpa pernah
     *   menyentuh printer — satu kertas habis di tengah hari kerja akan
     *   mematikan pencetakan sampai aplikasi ditutup.
     */
    _ekor = giliran.catchError((_) {});
    return giliran;
  }
}
