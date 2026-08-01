/// Pengujian perintah ESC/POS.
///
/// Yang dijaga di sini adalah **byte**, bukan tampilan. Perintah printer tidak
/// menghasilkan galat ketika salah: laci kas hanya berbunyi klik tanpa terbuka,
/// atau struk keluar dengan kolom harga yang meleset — dan keduanya baru
/// ketahuan ketika antrean sudah menunggu.
///
/// Karena seluruhnya fungsi murni atas daftar byte, ia dapat dibuktikan tanpa
/// printer, tanpa emulator, dan tanpa perangkat apa pun.
library;

import 'package:ebisnis_pos/perangkat/escpos.dart';
import 'package:test/test.dart';

void main() {
  group('membuka laci kas', () {
    test('mengirim ESC p dengan pin dan durasi', () {
      // `ESC p m t1 t2` — 0x1B 0x70, pin, nyala, mati. Satuan t adalah 2 ms.
      expect(
        perintahBukaLaci(nyalaMs: 50, matiMs: 250),
        [0x1B, 0x70, 0x00, 25, 125],
      );
    });

    test('pin kedua dipetakan ke soket 5', () {
      // Sebagian printer memasang lacinya pada pin 1, bukan pin 0. Salah pin
      // berarti laci tidak pernah terbuka, tanpa galat apa pun.
      expect(perintahBukaLaci(pin: 1)[2], 0x01);
    });

    test('durasi tidak pernah nol', () {
      /*
       * Pulsa yang terlalu pendek membuat laci berbunyi klik tanpa terbuka, dan
       * kasir akan menekan tombolnya berulang kali sambil antrean menunggu.
       * Pembulatan ke bawah dari durasi kecil tidak boleh menghasilkan nol.
       */
      final p = perintahBukaLaci(nyalaMs: 1, matiMs: 1);
      expect(p[3], greaterThanOrEqualTo(1));
      expect(p[4], greaterThanOrEqualTo(1));
    });

    test('durasi sangat panjang dibatasi, bukan meluap', () {
      // Byte hanya menampung 255. Tanpa pembatasan, 600 ms menjadi 44 — pulsa
      // yang justru lebih pendek daripada yang diminta.
      final p = perintahBukaLaci(nyalaMs: 10000, matiMs: 10000);
      expect(p[3], 255);
      expect(p[4], 255);
    });

    test('perintah pada struk sama dengan perintah berdiri sendiri', () {
      // Keduanya harus menghasilkan byte yang sama; laci yang terbuka saat
      // mencetak struk dan laci yang dibuka lewat tombol adalah laci yang sama.
      final struk = StrukEscPos()..bukaLaci();
      final byteStruk = struk.selesai();
      expect(
        byteStruk.sublist(byteStruk.length - 5),
        perintahBukaLaci(),
      );
    });
  });

  group('penyusunan struk', () {
    test('diawali perintah kembali ke keadaan awal', () {
      /*
       * `ESC @` menghapus setelan yang tertinggal dari cetakan sebelumnya.
       * Tanpanya, struk yang dicetak setelah struk bergaya tebal akan ikut tebal
       * seluruhnya — dan printer tidak pernah dinyalakan ulang di antara
       * keduanya sepanjang hari.
       */
      expect(StrukEscPos().selesai().sublist(0, 2), [0x1B, 0x40]);
    });

    test('baris kiri-kanan merapatkan angka ke tepi kanan', () {
      final s = StrukEscPos(lebarKolom: 20)..barisKiriKanan('Total', '44.880');
      final teks = String.fromCharCodes(s.selesai().sublist(2)).trimRight();
      expect(teks.length, 20);
      expect(teks.endsWith('44.880'), isTrue);
    });

    test('keterangan yang terlalu panjang dipotong, bukan mendorong angkanya', () {
      /*
       * Angka yang terdorong keluar kolom membuat struk tidak dapat dibaca
       * sekilas — dan kasir membaca struk sekilas, biasanya sambil menyerahkan
       * kembalian.
       */
      final s = StrukEscPos(lebarKolom: 20)
        ..barisKiriKanan('Nama produk yang sangat panjang sekali', '1.000.000');
      final teks = String.fromCharCodes(s.selesai().sublist(2)).trimRight();
      expect(teks.length, lessThanOrEqualTo(20));
      expect(teks.endsWith('1.000.000'), isTrue);
    });

    test('angka yang lebih lebar daripada kertas dicetak sendiri', () {
      // Lebih baik satu baris berisi angkanya saja daripada baris yang terpotong
      // di tengah angka.
      final s = StrukEscPos(lebarKolom: 8)..barisKiriKanan('Total', '123456789');
      final teks = String.fromCharCodes(s.selesai().sublist(2)).trimRight();
      expect(teks, '123456789');
    });

    test('garis mengisi selebar kertas', () {
      final s = StrukEscPos(lebarKolom: 32)..garis();
      final teks = String.fromCharCodes(s.selesai().sublist(2)).trimRight();
      expect(teks, '-' * 32);
    });

    test('karakter di luar Latin-1 diganti padanan, bukan menjadi tanda tanya', () {
      /*
       * Tanda pisah dan kutip melengkung sering ikut tersalin dari data master.
       * Tanpa penggantian, keduanya tercetak sebagai `?` di tengah nama barang —
       * dan pembeli membaca nama barang itu pada struknya.
       */
      final s = StrukEscPos()..baris('Kopi — “Susu” … Aren');
      final teks = String.fromCharCodes(s.selesai().sublist(2)).trimRight();
      expect(teks, 'Kopi - "Susu" ... Aren');
      expect(teks.contains('?'), isFalse);
    });

    test('potong kertas menyisakan ruang di atas potongan', () {
      /*
       * Tanpa baris kosong, pemotongnya memakan baris terakhir struk — biasanya
       * justru totalnya, atau nomor struknya.
       */
      final s = StrukEscPos()..potong();
      final b = s.selesai();
      expect(b.sublist(b.length - 4), [0x1D, 0x56, 0x42, 0x00]);
      expect(b.sublist(b.length - 7, b.length - 4), [0x0A, 0x0A, 0x0A]);
    });

    test('rata tengah dan tebal mengirim perintahnya', () {
      final s = StrukEscPos()
        ..rata(Rata.tengah)
        ..tebal(true);
      final b = s.selesai();
      expect(b.sublist(2, 5), [0x1B, 0x61, 1]);
      expect(b.sublist(5, 8), [0x1B, 0x45, 1]);
    });

    test('hasilnya tidak dapat disunting setelah selesai', () {
      // Byte struk yang sudah dikirim ke printer tidak boleh berubah di belakang
      // pemanggilnya.
      final b = StrukEscPos().selesai();
      expect(() => b.add(0), throwsUnsupportedError);
    });
  });
}
