/// Pengujian antrean cetak.
///
/// Yang diuji bukan "apakah byte-nya sampai" — itu urusan pengangkutan. Yang
/// diuji adalah bahwa dua perintah tidak pernah berjalan bersamaan, sebab
/// akibatnya bukan galat melainkan byte yang berselang-seling: struk rusak atau
/// laci tidak terbuka, tanpa satu pun pesan.
library;

import 'dart:async';

import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:ebisnis_pos/perangkat/antrean_cetak.dart';
import 'package:test/test.dart';

/// Pencetak yang mencatat kapan tiap kiriman mulai dan selesai.
class PencetakLambat implements Pencetak {
  PencetakLambat({this.gagalPada = -1});

  /// Indeks kiriman yang dibuat gagal, atau -1 bila semuanya berhasil.
  final int gagalPada;

  final List<String> jejak = [];
  int _ke = 0;
  int sedangBerjalan = 0;
  int puncakBersamaan = 0;

  @override
  bool get siap => true;

  @override
  Future<void> kirim(List<int> byte) async {
    final ke = _ke++;
    sedangBerjalan += 1;
    if (sedangBerjalan > puncakBersamaan) puncakBersamaan = sedangBerjalan;
    jejak.add('mulai-$ke');

    // Menyerahkan giliran beberapa kali: kalau antreannya tidak bekerja,
    // kiriman berikutnya akan menyelip di sini.
    await Future<void>.delayed(const Duration(milliseconds: 5));

    jejak.add('selesai-$ke');
    sedangBerjalan -= 1;
    if (ke == gagalPada) throw StateError('kertas habis');
  }
}

void main() {
  test('dua perintah tidak pernah berjalan bersamaan', () async {
    final dalam = PencetakLambat();
    final p = PencetakBerantre(dalam);

    await Future.wait([
      p.kirim([1]),
      p.kirim([2]),
      p.kirim([3]),
    ]);

    expect(dalam.puncakBersamaan, 1);
    expect(dalam.jejak, [
      'mulai-0',
      'selesai-0',
      'mulai-1',
      'selesai-1',
      'mulai-2',
      'selesai-2',
    ]);
  });

  test('urutannya sesuai urutan dikirim', () async {
    // Struk lalu buka laci harus tiba dalam urutan itu. Terbalik berarti laci
    // terbuka sebelum struknya keluar, dan kasir menutupnya lebih dahulu.
    final dalam = PencetakLambat();
    final p = PencetakBerantre(dalam);

    final a = p.kirim([1]);
    final b = p.kirim([2]);
    await Future.wait([a, b]);

    expect(dalam.jejak.first, 'mulai-0');
    expect(dalam.jejak.last, 'selesai-1');
  });

  test('galat diteruskan ke pemanggilnya', () async {
    /*
     * Layar perlu tahu struknya TIDAK tercetak. Menelan galatnya membuat kasir
     * mengira struk sudah keluar lalu menyerahkan barang tanpa struk.
     */
    final dalam = PencetakLambat(gagalPada: 0);
    final p = PencetakBerantre(dalam);

    await expectLater(p.kirim([1]), throwsA(isA<StateError>()));
  });

  test('satu kegagalan TIDAK mematikan antrean', () async {
    /*
     * Aturan yang paling mudah salah. Bila ekor antrean ikut membawa galatnya,
     * setiap kiriman berikutnya gagal seketika tanpa pernah menyentuh printer —
     * satu kertas habis di tengah hari kerja mematikan pencetakan sampai
     * aplikasi ditutup.
     */
    final dalam = PencetakLambat(gagalPada: 0);
    final p = PencetakBerantre(dalam);

    final gagal = p.kirim([1]);
    final berikutnya = p.kirim([2]);

    await expectLater(gagal, throwsA(isA<StateError>()));
    await expectLater(berikutnya, completes);
    expect(dalam.jejak, contains('mulai-1'));
  });

  test('meneruskan keadaan siap apa adanya', () async {
    // Pembungkus tidak boleh mengaku siap ketika yang dibungkusnya tidak.
    final p = PencetakBerantre(const TanpaPencetak());
    expect(p.siap, isFalse);
  });
}
