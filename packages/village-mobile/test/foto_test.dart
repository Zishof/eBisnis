/// Pengujian pembersihan metadata foto di sisi ponsel.
///
/// Yang diuji bukan "fungsinya berjalan tanpa galat". Setiap pengujian di bawah
/// menyusun JPEG dan PNG sungguhan yang **berisi koordinat GPS**, lalu
/// memastikan koordinat itu benar-benar HILANG dari hasilnya.
///
/// Pengujian yang hanya memanggil fungsinya lalu memeriksa hasilnya tidak
/// kosong akan tetap lulus pada hari fungsinya berhenti membuang apa pun.
library;

import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:village_mobile/domain/foto.dart';

/// Koordinat sungguhan (Yogyakarta). Dicari sebagai teks pada hasil akhir.
const koordinat = 'GPS:-7.797068,110.370529';
const seriKamera = 'SN:X9F-44210';

Uint8List _ruas(int penanda, List<int> isi) {
  final panjang = isi.length + 2;
  return Uint8List.fromList([0xFF, penanda, panjang >> 8, panjang & 0xFF, ...isi]);
}

/// JPEG kecil yang sah bentuknya: SOI, APP1 berisi EXIF, APP0 JFIF, komentar,
/// DQT, SOF0, DHT, SOS beserta datanya, EOI.
Uint8List jpegBerkoordinat() {
  final b = BytesBuilder();
  b.add([0xFF, 0xD8]);
  b.add(_ruas(0xE1, [...'Exif\x00\x00'.codeUnits, ...koordinat.codeUnits]));
  b.add(_ruas(0xE0, [...'JFIF\x00'.codeUnits, 1, 1, 0, 0, 1, 0, 1, 0, 0]));
  b.add(_ruas(0xEC, seriKamera.codeUnits)); // APP12, dipakai sebagian kamera
  b.add(_ruas(0xFE, 'Dipotret dengan ponsel Budi'.codeUnits)); // komentar
  b.add(_ruas(0xDB, List<int>.filled(65, 8))); // DQT
  b.add(_ruas(0xC0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0])); // SOF0
  b.add(_ruas(0xC4, [0x00, ...List<int>.filled(16, 0), 0])); // DHT
  b.add(_ruas(0xDA, [1, 1, 0x00, 0, 63, 0])); // SOS
  b.add([0x12, 0x34, 0x56, 0x78]); // data terkompresi
  b.add([0xFF, 0xD9]); // EOI
  return b.toBytes();
}

Uint8List _potongan(String jenis, List<int> isi) {
  final n = isi.length;
  return Uint8List.fromList([
    (n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF,
    ...jenis.codeUnits,
    ...isi,
    0, 0, 0, 0, // CRC — tidak dihitung; pembersih tidak memvalidasinya
  ]);
}

Uint8List pngBerkoordinat() {
  final b = BytesBuilder();
  b.add([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  b.add(_potongan('IHDR', [0, 0, 0, 16, 0, 0, 0, 16, 8, 2, 0, 0, 0]));
  b.add(_potongan('eXIf', koordinat.codeUnits));
  b.add(_potongan('tEXt', 'Author\x00Budi'.codeUnits));
  b.add(_potongan('iTXt', seriKamera.codeUnits));
  b.add(_potongan('IDAT', [0x78, 0x9C, 0x01, 0x00]));
  b.add(_potongan('IEND', const []));
  return b.toBytes();
}

String _sebagaiTeks(Uint8List d) => String.fromCharCodes(d);

void main() {
  group('jenis foto ditentukan dari isinya', () {
    test('mengenali JPEG dan PNG', () {
      expect(jenisFoto(jpegBerkoordinat()), JenisFoto.jpeg);
      expect(jenisFoto(pngBerkoordinat()), JenisFoto.png);
    });

    test('berkas yang menyamar sebagai foto ditolak', () {
      // Namanya boleh apa saja; isinya yang dinilai.
      final html = Uint8List.fromList('<html><script>alert(1)</script>'.codeUnits);
      expect(jenisFoto(html), isNull);
      expect(periksaFoto(html).boleh, isFalse);
    });

    test('HEIC ditolak dengan saran yang dapat diikuti', () {
      final heic = Uint8List.fromList([
        0, 0, 0, 24, ...'ftypheic'.codeUnits, 0, 0, 0, 0, ...'mif1heic'.codeUnits,
      ]);
      final v = periksaFoto(heic);
      expect(v.boleh, isFalse);
      // Bukan sekadar "jenis tidak didukung": warga diberi tahu di mana
      // mengubahnya, sebab HEIC adalah bawaan iPhone dan bukan kekeliruannya.
      expect(v.alasan, contains('Paling Kompatibel'));
    });
  });

  group('JPEG — koordinat GPS benar-benar hilang', () {
    test('koordinat tidak lagi ada pada hasil', () {
      final asli = jpegBerkoordinat();
      expect(_sebagaiTeks(asli), contains(koordinat), reason: 'contoh ujinya harus benar');

      final bersih = buangMetadataJpeg(asli)!;
      expect(_sebagaiTeks(bersih), isNot(contains(koordinat)));
    });

    test('nomor seri kamera dan komentar ikut hilang', () {
      final bersih = buangMetadataJpeg(jpegBerkoordinat())!;
      final teks = _sebagaiTeks(bersih);
      expect(teks, isNot(contains(seriKamera)));
      expect(teks, isNot(contains('Budi')));
      expect(teks, isNot(contains('Exif')));
      expect(teks, isNot(contains('JFIF')));
    });

    test('gambarnya sendiri tetap utuh', () {
      final bersih = buangMetadataJpeg(jpegBerkoordinat())!;
      // SOI, EOI, dan data terkompresi sesudah SOS tetap ada — kalau tidak,
      // yang terkirim bukan lagi foto.
      expect(bersih[0], 0xFF);
      expect(bersih[1], 0xD8);
      expect(bersih.sublist(bersih.length - 2), [0xFF, 0xD9]);
      expect(_sebagaiTeks(bersih).codeUnits, containsAllInOrder([0x12, 0x34, 0x56, 0x78]));
      // Tabel kuantisasi dan Huffman wajib bertahan; tanpanya gambarnya tidak
      // dapat dibuka sama sekali.
      expect(bersih.length, greaterThan(80));
    });

    test('bentuk yang tidak dikenali menghasilkan null, bukan berkas apa adanya', () {
      expect(buangMetadataJpeg(Uint8List.fromList([0xFF, 0xD8, 0x00, 0x01])), isNull);
      expect(buangMetadataJpeg(Uint8List.fromList([1, 2, 3])), isNull);
    });
  });

  group('PNG — hanya potongan yang diizinkan bertahan', () {
    test('eXIf, tEXt, dan iTXt hilang', () {
      final asli = pngBerkoordinat();
      expect(_sebagaiTeks(asli), contains(koordinat));

      final bersih = buangMetadataPng(asli)!;
      final teks = _sebagaiTeks(bersih);
      expect(teks, isNot(contains(koordinat)));
      expect(teks, isNot(contains(seriKamera)));
      expect(teks, isNot(contains('Budi')));
      expect(teks, isNot(contains('eXIf')));
    });

    test('IHDR, IDAT, dan IEND bertahan', () {
      final teks = _sebagaiTeks(buangMetadataPng(pngBerkoordinat())!);
      expect(teks, contains('IHDR'));
      expect(teks, contains('IDAT'));
      expect(teks, contains('IEND'));
    });

    test('potongan yang belum dikenal ikut terbuang, bukan ikut lolos', () {
      final b = BytesBuilder();
      b.add([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      b.add(_potongan('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]));
      b.add(_potongan('zzZz', 'rahasia'.codeUnits));
      b.add(_potongan('IDAT', [0x78, 0x9C]));
      b.add(_potongan('IEND', const []));
      final bersih = buangMetadataPng(b.toBytes())!;
      expect(_sebagaiTeks(bersih), isNot(contains('rahasia')));
    });
  });

  group('penyiapan sebelum dikirim', () {
    test('menghasilkan foto bersih beserta ukuran asalnya', () {
      final asli = jpegBerkoordinat();
      final siap = siapkanFoto(asli, 'IMG_20260731_1042.jpg');
      expect(siap.jenis, JenisFoto.jpeg);
      expect(siap.ukuranAsli, asli.length);
      expect(siap.data.length, lessThan(asli.length));
      expect(siap.adaYangDibuang, isTrue);
      expect(siap.byteDibuang, greaterThan(0));
    });

    test('foto yang tidak dapat diproses TIDAK dikirim apa adanya', () {
      // Bentuk JPEG yang rusak. Yang penting: ia dilempar, bukan diteruskan.
      expect(
        () => siapkanFoto(Uint8List.fromList([0xFF, 0xD8, 0x11, 0x22]), 'a.jpg'),
        throwsA(isA<FotoDitolak>()),
      );
    });

    test('batas tiga foto', () {
      expect(bolehTambahFoto(0).boleh, isTrue);
      expect(bolehTambahFoto(2).boleh, isTrue);
      expect(bolehTambahFoto(3).boleh, isFalse);
      expect(bolehTambahFoto(3).alasan, contains('Hapus salah satu'));
    });

    test('berkas melebihi 8 MB ditolak sebelum kuota warga terpakai', () {
      final besar = Uint8List(8 * 1024 * 1024 + 1);
      besar[0] = 0xFF;
      besar[1] = 0xD8;
      besar[2] = 0xFF;
      final v = periksaFoto(besar);
      expect(v.boleh, isFalse);
      expect(v.alasan, contains('8 MB'));
    });
  });

  group('ringkasan unggah menyatakan keadaan sebenarnya', () {
    test('pengaduan tersimpan sementara fotonya gagal DINYATAKAN, bukan disembunyikan', () {
      final r = const RingkasanUnggah(terkirim: 0, gagal: 2);
      expect(r.semuaTerkirim, isFalse);
      // Kata "TERSIMPAN" wajib ada. Warga yang mengira laporannya gagal akan
      // mengadukan hal yang sama untuk kedua kalinya, dan petugas menerima dua
      // aduan atas satu kejadian.
      expect(r.pesan, contains('TERSIMPAN'));
      expect(r.pesan, contains('tetap akan ditindaklanjuti'));
    });

    test('sebagian terkirim disebut apa adanya', () {
      final r = const RingkasanUnggah(terkirim: 1, gagal: 2);
      expect(r.pesan, contains('1 foto'));
      expect(r.pesan, contains('2 foto gagal'));
    });

    test('tanpa foto tidak menyebut foto sama sekali', () {
      const r = RingkasanUnggah(terkirim: 0, gagal: 0);
      expect(r.pesan, 'Laporan Anda tersimpan.');
    });
  });
}
