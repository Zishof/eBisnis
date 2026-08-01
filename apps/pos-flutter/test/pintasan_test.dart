/// Pengujian peta pintasan papan ketik.
library;

import 'package:ebisnis_pos/layar/pintasan.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('pemetaan tombol', () {
    test('seluruh tombol fungsi terpetakan, tanpa lubang', () {
      // Lubang di tengah peta membuat kasir menekan tombol yang tidak melakukan
      // apa pun, dan ia akan menekannya lagi lebih keras.
      final daftar = daftarPintasan();
      expect(daftar.length, 13);
      expect(daftar.map((d) => d.tombol).toList(), [
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6',
        'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Esc',
      ]);
    });

    test('tidak ada dua tombol yang mengerjakan aksi yang sama', () {
      final aksi = daftarPintasan().map((d) => d.aksi).toList();
      expect(aksi.toSet().length, aksi.length);
    });

    test('setiap aksi punya keterangan untuk bilah bantuan', () {
      // Pintasan tanpa keterangan hanya berguna bagi yang sudah hafal — dan yang
      // sudah hafal tidak membuka bantuan.
      for (final a in AksiKasir.values) {
        expect(keteranganAksi[a], isNotNull, reason: a.name);
        expect(keteranganAksi[a]!.isNotEmpty, isTrue);
      }
    });

    test('F9 membayar dan F2 kembali ke kotak pindai', () {
      // Dua yang paling sering ditekan; keduanya sama dengan layar kasir web,
      // supaya kasir yang berpindah tidak perlu belajar ulang.
      expect(aksiUntukTombol(LogicalKeyboardKey.f9), AksiKasir.bayar);
      expect(aksiUntukTombol(LogicalKeyboardKey.f2), AksiKasir.fokusPindai);
    });

    test('Esc menutup dialog', () {
      expect(aksiUntukTombol(LogicalKeyboardKey.escape), AksiKasir.tutupDialog);
    });

    test('tombol biasa bukan pintasan', () {
      // Huruf harus sampai ke kotak pindai apa adanya.
      expect(aksiUntukTombol(LogicalKeyboardKey.keyA), isNull);
      expect(aksiUntukTombol(LogicalKeyboardKey.digit1), isNull);
      expect(aksiUntukTombol(LogicalKeyboardKey.enter), isNull);
    });

    test('kombinasi bermodifier TIDAK memicu aksi', () {
      /*
       * Pemindai barcode HID mengetik seperti papan ketik, dan sebagian model
       * mengirim Shift saat mengetik huruf besar. Memetakan kombinasi
       * bermodifier membuat pindaian tertentu memicu aksi alih-alih masuk ke
       * kotak pindai — dan kasir tidak akan pernah menghubungkan "kadang barang
       * ini membatalkan transaksi" dengan barcode-nya.
       */
      expect(aksiUntukTombol(LogicalKeyboardKey.f10, adaModifier: true), isNull);
      expect(aksiUntukTombol(LogicalKeyboardKey.f9, adaModifier: true), isNull);
    });
  });

  group('keselamatan', () {
    test('aksi yang menghilangkan pekerjaan wajib dikonfirmasi', () {
      /*
       * Jari yang terlatih menekan lebih cepat daripada mata membaca.
       * Membatalkan transaksi berisi dua belas barang karena salah tekan adalah
       * kerugian yang hanya dapat dipulihkan dengan memindai ulang seluruhnya di
       * depan antrean.
       */
      expect(wajibKonfirmasi, contains(AksiKasir.batalTransaksi));
      expect(wajibKonfirmasi, contains(AksiKasir.hapusBaris));
      expect(wajibKonfirmasi, contains(AksiKasir.tutupShift));
    });

    test('membuka laci kas wajib dikonfirmasi meski tidak merusak apa pun', () {
      // Bukan karena berbahaya, melainkan karena membuka laci di luar transaksi
      // adalah tindakan yang harus dapat dipertanggungjawabkan.
      expect(wajibKonfirmasi, contains(AksiKasir.bukaLaci));
    });

    test('aksi sehari-hari TIDAK dikonfirmasi', () {
      /*
       * Konfirmasi yang muncul terlalu sering berhenti dibaca, dan begitu ia
       * berhenti dibaca, konfirmasi pada aksi yang benar-benar berbahaya ikut
       * kehilangan gunanya.
       */
      for (final a in [
        AksiKasir.bayar,
        AksiKasir.fokusPindai,
        AksiKasir.cariProduk,
        AksiKasir.tahanKeranjang,
        AksiKasir.ubahJumlah,
      ]) {
        expect(wajibKonfirmasi.contains(a), isFalse, reason: a.name);
      }
    });
  });

  group('perbedaan dengan klien web', () {
    test('hanya tombol yang direbut peramban yang ditandai', () {
      /*
       * F1, F5, F11, dan F12 tidak dapat direbut dari peramban dengan
       * `preventDefault`. Sisanya sudah bekerja pada layar kasir web, dan
       * menandainya sebagai "hanya di aplikasi" akan menyesatkan — seolah klien
       * web kurang mampu padahal tidak.
       */
      expect(hanyaDiAplikasiAsli, {
        AksiKasir.bantuan,
        AksiKasir.hapusBaris,
        AksiKasir.cetakUlangStruk,
        AksiKasir.tutupShift,
      });
    });

    test('aksi yang paling sering dipakai tersedia di kedua klien', () {
      // Kalau membayar atau memindai hanya bekerja di salah satunya, kasir tidak
      // dapat berpindah klien di tengah shift.
      expect(hanyaDiAplikasiAsli.contains(AksiKasir.bayar), isFalse);
      expect(hanyaDiAplikasiAsli.contains(AksiKasir.fokusPindai), isFalse);
      expect(hanyaDiAplikasiAsli.contains(AksiKasir.tahanKeranjang), isFalse);
    });
  });
}
