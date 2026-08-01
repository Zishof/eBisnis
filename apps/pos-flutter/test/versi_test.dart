/// Pengujian perbandingan versi dan keputusan memperbarui.
///
/// Dua kesalahan yang dijaga paling ketat, keduanya tidak menghasilkan galat
/// apa pun ketika terjadi:
///
/// 1. **Membandingkan sebagai teks.** `1.10.0` dianggap lebih lama daripada
///    `1.2.0`, sehingga pembaruan tidak pernah ditawarkan — dan tidak ada yang
///    menyadarinya, sebab layarnya memang tidak menampilkan apa-apa.
/// 2. **Menawarkan turun versi.** Mesin kasir yang turun versi membuat versi
///    lama membaca buku transaksi yang ditulis versi baru.
library;

import 'package:ebisnis_pos/pembaruan/versi.dart';
import 'package:test/test.dart';

void main() {
  group('mengurai versi', () {
    test('bentuk baku', () {
      final v = Versi.urai('1.2.3')!;
      expect([v.major, v.minor, v.patch], [1, 2, 3]);
      expect(v.pratayang, isNull);
    });

    test('awalan v diterima, sebab tag Git lazim memakainya', () {
      expect(Versi.urai('v2.0.1').toString(), '2.0.1');
      expect(Versi.urai('V2.0.1').toString(), '2.0.1');
    });

    test('bagian yang kurang dianggap nol', () {
      expect(Versi.urai('1').toString(), '1.0.0');
      expect(Versi.urai('1.5').toString(), '1.5.0');
    });

    test('pratayang dipisahkan', () {
      final v = Versi.urai('1.0.0-beta.2')!;
      expect(v.pratayang, 'beta.2');
      expect(v.toString(), '1.0.0-beta.2');
    });

    test('teks rusak menghasilkan null, bukan galat', () {
      /*
       * Jawaban peladen yang rusak tidak boleh menjatuhkan aplikasi kasir yang
       * sedang melayani antrean. Cukup "tidak dapat diperiksa".
       */
      for (final buruk in ['', '   ', 'abc', '1.2.3.4', '1.-2.3', 'v', '1.x.0']) {
        expect(Versi.urai(buruk), isNull, reason: buruk);
      }
    });
  });

  group('membandingkan versi', () {
    test('dibandingkan sebagai ANGKA, bukan teks', () {
      // Sebagai teks, "10" lebih kecil daripada "2" dan seluruh urutannya
      // terbalik mulai versi kesepuluh.
      expect(Versi.urai('1.10.0')! > Versi.urai('1.2.0')!, isTrue);
      expect(Versi.urai('2.0.0')! > Versi.urai('10.0.0')!, isFalse);
      expect(Versi.urai('1.0.10')! > Versi.urai('1.0.9')!, isTrue);
    });

    test('urutan major, minor, patch', () {
      expect(Versi.urai('2.0.0')! > Versi.urai('1.99.99')!, isTrue);
      expect(Versi.urai('1.2.0')! > Versi.urai('1.1.99')!, isTrue);
    });

    test('versi yang sama tidak lebih besar maupun lebih kecil', () {
      expect(Versi.urai('1.2.3'), Versi.urai('1.2.3'));
      expect(Versi.urai('1.2.3')! > Versi.urai('1.2.3')!, isFalse);
      expect(Versi.urai('1.2.3')! < Versi.urai('1.2.3')!, isFalse);
    });

    test('pratayang lebih TUA daripada rilis dengan angka yang sama', () {
      /*
       * Tanpa aturan ini, mesin kasir yang menjalankan beta tidak akan pernah
       * ditawari rilis resminya — justru versi yang paling ingin dipasang.
       */
      expect(Versi.urai('1.0.0')! > Versi.urai('1.0.0-beta')!, isTrue);
      expect(Versi.urai('1.0.0-beta')! < Versi.urai('1.0.0')!, isTrue);
    });
  });

  group('keputusan memperbarui', () {
    const rilis = RilisTersedia(versi: '1.2.0', jalurUnduh: 'https://contoh/app.exe');

    test('versi lebih baru ditawarkan', () {
      final h = nilaiPembaruan(versiBerjalan: '1.1.0', rilis: rilis);
      expect(h.keadaan, KeadaanPembaruan.tersedia);
      expect(h.rilis, isNotNull);
      // Kedua angka disebut: kasir perlu tahu ia berpindah dari apa ke apa.
      expect(h.pesan, contains('1.2.0'));
      expect(h.pesan, contains('1.1.0'));
    });

    test('versi sama dinyatakan mutakhir', () {
      final h = nilaiPembaruan(versiBerjalan: '1.2.0', rilis: rilis);
      expect(h.keadaan, KeadaanPembaruan.mutakhir);
      expect(h.rilis, isNull);
    });

    test('versi berjalan yang lebih baru TIDAK ditawari turun versi', () {
      /*
       * Aturan terpenting di sini. Turun versi pada aplikasi yang menyimpan buku
       * transaksi lokal berarti versi lama membaca catatan yang ditulis versi
       * baru — dan itu terjadi tanpa satu pun galat, pada mesin yang sedang
       * dipakai berjualan.
       */
      final h = nilaiPembaruan(versiBerjalan: '1.3.0', rilis: rilis);
      expect(h.keadaan, KeadaanPembaruan.lebihBaru);
      expect(h.rilis, isNull, reason: 'tidak boleh menyodorkan berkas unduhan');
      expect(h.pesan, contains('Tidak ada yang perlu dipasang'));
    });

    test('sumber yang tidak terjangkau dinyatakan gagal diperiksa, bukan mutakhir', () {
      /*
       * Melaporkan "sudah terbaru" ketika sebenarnya tidak dapat memeriksa
       * adalah kebohongan yang paling mudah dipercaya — dan mesin kasir dapat
       * tertinggal berbulan-bulan tanpa ada yang curiga.
       */
      final h = nilaiPembaruan(versiBerjalan: '1.0.0', rilis: null);
      expect(h.keadaan, KeadaanPembaruan.gagalDiperiksa);
      expect(h.pesan, contains('tetap dapat dipakai'));
    });

    test('versi rilis yang tidak terbaca dinyatakan gagal diperiksa', () {
      final h = nilaiPembaruan(
        versiBerjalan: '1.0.0',
        rilis: const RilisTersedia(versi: 'terbaru', jalurUnduh: 'x'),
      );
      expect(h.keadaan, KeadaanPembaruan.gagalDiperiksa);
    });

    test('versi berjalan yang tidak terbaca dinyatakan gagal diperiksa', () {
      final h = nilaiPembaruan(versiBerjalan: 'entah', rilis: rilis);
      expect(h.keadaan, KeadaanPembaruan.gagalDiperiksa);
    });

    test('pembaruan wajib ditandai dan menyebutkan alasannya', () {
      /*
       * Pembaruan wajib menghentikan kasir di tengah hari kerja. Ia hanya
       * sebanding bila yang ditutupnya menyangkut uang atau data, dan pesannya
       * harus mengatakan itu — bukan sekadar "wajib diperbarui".
       */
      final h = nilaiPembaruan(
        versiBerjalan: '1.0.0',
        rilis: const RilisTersedia(versi: '1.2.0', jalurUnduh: 'x', wajib: true),
      );
      expect(h.wajib, isTrue);
      expect(h.pesan, contains('cacat'));
    });

    test('pembaruan wajib yang versinya sama tidak memaksa apa pun', () {
      // Menandai wajib pada versi yang sedang berjalan akan mengunci mesin kasir
      // pada dialog yang tidak dapat ditutup.
      final h = nilaiPembaruan(
        versiBerjalan: '1.2.0',
        rilis: const RilisTersedia(versi: '1.2.0', jalurUnduh: 'x', wajib: true),
      );
      expect(h.keadaan, KeadaanPembaruan.mutakhir);
      expect(h.wajib, isFalse);
    });
  });
}
