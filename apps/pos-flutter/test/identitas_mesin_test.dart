/// Pengujian identitas mesin kasir.
///
/// Satu aturan menentukan seluruh berkas ini: **id tidak pernah berubah**. Bila
/// ia berganti, riwayat satu mesin terbelah menjadi dua yang tidak dapat
/// disatukan lagi — dan tidak ada galat yang muncul, sebab kedua bagiannya
/// sama-sama sah.
library;

import 'dart:convert';
import 'dart:io';

import 'package:ebisnis_pos/mesin/identitas_mesin.dart';
import 'package:test/test.dart';

void main() {
  group('membuat id', () {
    test('berbentuk UUID v4', () {
      for (var i = 0; i < 50; i += 1) {
        expect(idMesinSah(buatIdMesin()), isTrue);
      }
    });

    test('tidak pernah kembar', () {
      /*
       * Dipakai `Random.secure()`, bukan `Random()` biasa: dua mesin yang
       * dinyalakan bersamaan dari citra sistem yang sama menghasilkan deret
       * yang sama persis dari yang biasa — dan dua mesin kasir dengan id kembar
       * adalah persis kekacauan yang id ini dimaksudkan mencegah.
       */
      final kumpulan = {for (var i = 0; i < 2000; i += 1) buatIdMesin()};
      expect(kumpulan.length, 2000);
    });

    test('menolak bentuk yang bukan UUID v4', () {
      for (final buruk in [
        '',
        'kasir-depan',
        '12345678-1234-1234-1234-123456789012', // versi bukan 4
        '12345678-1234-4234-1234-123456789012', // varian salah
        'ZZZZZZZZ-1234-4234-8234-123456789012',
      ]) {
        expect(idMesinSah(buruk), isFalse, reason: buruk);
      }
    });
  });

  group('membersihkan nama', () {
    test('spasi berlebih dirapikan', () {
      expect(bersihkanNamaMesin('  Kasir   Depan '), 'Kasir Depan');
    });

    test('nama kosong ditolak', () {
      expect(bersihkanNamaMesin('   '), isNull);
    });

    test('nama terlalu panjang ditolak', () {
      /*
       * Nama mesin ikut tercetak pada struk selebar 32–48 kolom. Yang terpotong
       * di sana tidak dapat dicocokkan kembali dengan daftar mesin — dan itulah
       * saat seseorang justru sedang mencari mesin mana yang mencetaknya.
       */
      expect(bersihkanNamaMesin('K' * (panjangNamaMaks + 1)), isNull);
      expect(bersihkanNamaMesin('K' * panjangNamaMaks), isNotNull);
    });

    test('karakter kendali ditolak', () {
      // Tidak terlihat pada layar, tetapi merusak struk dan CSV laporan — dan
      // sumbernya tidak akan pernah ditemukan.
      expect(bersihkanNamaMesin('Kasir\u0000Depan'), isNull);
      expect(bersihkanNamaMesin('Kasir\u001FDepan'), isNull);
    });
  });

  group('menyimpan dan memuat', () {
    late Directory dir;

    setUp(() async => dir = await Directory.systemTemp.createTemp('pos-mesin'));
    tearDown(() async => dir.delete(recursive: true));

    test('pemuatan pertama membuat identitas dan menyimpannya', () async {
      final p = IdentitasBerkas(dir);
      final m = await p.muat();

      expect(idMesinSah(m.id), isTrue);
      expect(m.nama, namaMesinBawaan);
      expect(m.dipulihkan, isFalse);
      expect(await File('${dir.path}${Platform.pathSeparator}mesin.json').exists(), isTrue);
    });

    test('id BERTAHAN antar pemuatan', () async {
      // Aturan terpenting berkas ini.
      final pertama = await IdentitasBerkas(dir).muat();
      final kedua = await IdentitasBerkas(dir).muat();
      expect(kedua.id, pertama.id);
    });

    test('mengubah nama TIDAK mengubah id', () async {
      final p = IdentitasBerkas(dir);
      final sebelum = await p.muat();

      await p.simpanNama('Kasir Drive-Thru');

      final sesudah = await IdentitasBerkas(dir).muat();
      expect(sesudah.nama, 'Kasir Drive-Thru');
      expect(sesudah.id, sebelum.id, reason: 'id ikut berubah — riwayat mesin akan terbelah');
    });

    test('nama yang tidak sah tidak menimpa nama yang sudah ada', () async {
      final p = IdentitasBerkas(dir);
      await p.simpanNama('Kasir Depan');
      await p.simpanNama('   ');

      expect((await IdentitasBerkas(dir).muat()).nama, 'Kasir Depan');
    });

    test('berkas rusak: identitas baru dibuat, yang lama DISINGKIRKAN bukan ditimpa',
        () async {
      /*
       * Isinya mungkin masih dapat dibaca manusia, dan id lama itulah
       * satu-satunya cara menyatukan kembali riwayat mesin ini. Menolak berjalan
       * bukan pilihan — itu menghentikan penjualan demi masalah yang tidak
       * menyangkut uang.
       */
      final berkas = File('${dir.path}${Platform.pathSeparator}mesin.json');
      await berkas.writeAsString('{ ini bukan json');

      final m = await IdentitasBerkas(dir).muat();

      expect(idMesinSah(m.id), isTrue);
      expect(m.dipulihkan, isTrue, reason: 'layar harus dapat mengatakannya');
      expect(await File('${berkas.path}.rusak').exists(), isTrue);
      expect(await File('${berkas.path}.rusak').readAsString(), '{ ini bukan json');
    });

    test('id yang tersimpan tetapi tidak sah diperlakukan sebagai rusak', () async {
      // Id yang bentuknya salah tidak dapat dipercaya sebagai id mesin mana pun.
      final berkas = File('${dir.path}${Platform.pathSeparator}mesin.json');
      await berkas.writeAsString(jsonEncode({'id': 'kasir-depan', 'nama': 'Kasir Depan'}));

      final m = await IdentitasBerkas(dir).muat();
      expect(idMesinSah(m.id), isTrue);
      expect(m.dipulihkan, isTrue);
    });

    test('nama tersimpan yang tidak sah jatuh ke nama bawaan, id tetap dipakai',
        () async {
      // Nama rusak bukan alasan membuang id — id itu yang mahal.
      final berkas = File('${dir.path}${Platform.pathSeparator}mesin.json');
      final id = buatIdMesin();
      await berkas.writeAsString(jsonEncode({'id': id, 'nama': ''}));

      final m = await IdentitasBerkas(dir).muat();
      expect(m.id, id);
      expect(m.nama, namaMesinBawaan);
      expect(m.dipulihkan, isFalse);
    });
  });
}
