/// Pengujian pengangkutan printer.
///
/// Dua dari tiga jalur dapat dibuktikan tanpa perangkat keras:
///
/// - **Jaringan** diuji terhadap soket pendengar sungguhan pada mesin yang sama,
///   sehingga byte yang diperiksa benar-benar melewati TCP.
/// - **Simpul perangkat** diuji dengan menunjuk jalurnya ke berkas sementara.
///   Itu bukan tipuan: jalur tulisnya sama persis dengan yang dipakai saat
///   mengirim ke `COM3` atau `/dev/usb/lp0`.
///
/// Yang tersisa hanyalah Bluetooth, yang memang tidak dapat dibuktikan tanpa
/// perangkat sungguhan dan karena itu belum ditulis.
library;

import 'dart:io';

import 'package:ebisnis_pos/perangkat/escpos.dart';
import 'package:ebisnis_pos/perangkat/pencetak_jaringan.dart';
import 'package:ebisnis_pos/perangkat/pencetak_perangkat.dart';
import 'package:test/test.dart';

void main() {
  group('pencetak jaringan', () {
    late ServerSocket peladen;
    late List<List<int>> diterima;

    setUp(() async {
      diterima = [];
      peladen = await ServerSocket.bind(InternetAddress.loopbackIPv4, 0);
      peladen.listen((s) {
        final kumpul = <int>[];
        s.listen(
          kumpul.addAll,
          onDone: () {
            diterima.add(kumpul);
            s.destroy();
          },
        );
      });
    });

    tearDown(() async => peladen.close());

    test('byte ESC/POS benar-benar sampai lewat TCP', () async {
      final p = PencetakJaringan(host: peladen.address.address, porta: peladen.port);
      final struk = StrukEscPos()
        ..baris('Toko Uji')
        ..bukaLaci()
        ..potong();

      await p.kirim(struk.selesai());

      // Menunggu peladen selesai membaca; soket ditutup pengirim.
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(diterima, hasLength(1));
      expect(diterima.single, struk.selesai());
    });

    test('perintah membuka laci ikut terkirim utuh', () async {
      final p = PencetakJaringan(host: peladen.address.address, porta: peladen.port);
      await p.kirim(perintahBukaLaci());
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(diterima.single, [0x1B, 0x70, 0x00, 25, 125]);
    });

    test('periksa melaporkan siap ketika printer menjawab', () async {
      final p = PencetakJaringan(host: peladen.address.address, porta: peladen.port);
      expect(p.siap, isFalse, reason: 'belum diperiksa, belum boleh mengaku siap');
      expect(await p.periksa(), isTrue);
      expect(p.siap, isTrue);
    });

    test('printer yang tidak ada dilaporkan tidak siap, bukan menggantung', () async {
      /*
       * Printer yang mati sering tidak menolak sambungan melainkan diam. Tanpa
       * batas waktu, kasir menunggu di depan antrean lalu menekan tombol cetak
       * berulang kali — dan mendapat struk berganda begitu printernya hidup.
       */
      final p = PencetakJaringan(
        host: '203.0.113.1', // blok TEST-NET-3, tidak akan pernah menjawab
        porta: 9100,
        batasSambung: const Duration(milliseconds: 300),
      );

      final mulai = DateTime.now();
      expect(await p.periksa(), isFalse);
      expect(DateTime.now().difference(mulai).inSeconds, lessThan(3));
      expect(p.siap, isFalse);
    });

    test('kegagalan mengirim menandai tidak siap dan meneruskan galatnya', () async {
      // Layar perlu tahu bahwa struknya TIDAK tercetak. Menelan galatnya membuat
      // kasir mengira struk sudah keluar dan menyerahkan barang tanpa struk.
      final p = PencetakJaringan(
        host: '203.0.113.1',
        porta: 9100,
        batasSambung: const Duration(milliseconds: 300),
      );
      await expectLater(p.kirim([0x1B, 0x40]), throwsA(isA<Object>()));
      expect(p.siap, isFalse);
    });
  });

  group('pencetak simpul perangkat', () {
    late Directory dir;
    late String jalur;

    setUp(() async {
      dir = await Directory.systemTemp.createTemp('pos-cetak');
      jalur = '${dir.path}${Platform.pathSeparator}printer.bin';
    });

    tearDown(() async => dir.delete(recursive: true));

    test('byte ditulis apa adanya ke jalurnya', () async {
      final p = PencetakPerangkat(jalur);
      final struk = StrukEscPos()..baris('Toko Uji');

      await p.kirim(struk.selesai());

      expect(await File(jalur).readAsBytes(), struk.selesai());
      expect(p.siap, isTrue);
    });

    test('struk kedua DITAMBAHKAN, tidak menimpa yang pertama', () async {
      /*
       * Pada simpul perangkat keduanya sama saja. Pada berkas biasa perbedaannya
       * besar: berkas itu dipakai justru ketika seseorang menelusuri masalah
       * cetak dan memerlukan seluruh riwayatnya.
       */
      final p = PencetakPerangkat(jalur);
      await p.kirim([1, 2, 3]);
      await p.kirim([4, 5, 6]);

      expect(await File(jalur).readAsBytes(), [1, 2, 3, 4, 5, 6]);
    });

    test('jalur yang tidak dapat ditulis dilaporkan tidak siap', () async {
      final p = PencetakPerangkat(
        '${dir.path}${Platform.pathSeparator}tidak-ada${Platform.pathSeparator}printer.bin',
      );
      expect(await p.periksa(), isFalse);
      expect(p.siap, isFalse);
    });

    test('memeriksa TIDAK mencetak apa pun', () async {
      /*
       * Halaman uji yang keluar setiap kali aplikasi dibuka menghabiskan kertas,
       * dan kasir akan belajar mengabaikan kertas yang keluar sendiri — termasuk
       * struk yang tercetak karena salah tekan.
       */
      final p = PencetakPerangkat(jalur);
      expect(await p.periksa(), isTrue);
      expect(await File(jalur).length(), 0);
    });

    test('kegagalan menulis meneruskan galatnya', () async {
      final p = PencetakPerangkat(
        '${dir.path}${Platform.pathSeparator}tidak-ada${Platform.pathSeparator}x.bin',
      );
      await expectLater(p.kirim([1]), throwsA(isA<FileSystemException>()));
      expect(p.siap, isFalse);
    });
  });
}
