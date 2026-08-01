/// Pengujian layar pelanggan.
///
/// Yang dijaga bukan tata letaknya, melainkan **apa yang boleh dan tidak boleh
/// dilihat orang di seberang meja**. Layar ini menghadap ke luar: yang tampak
/// padanya tampak pula bagi orang yang mengantre di belakang dan bagi kamera
/// ponsel siapa pun yang lewat.
library;

import 'package:ebisnis_pos/layar/tampilan_pelanggan.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

String rupiah(String n) => 'Rp $n';

Future<void> pasang(WidgetTester tester, KeadaanPelanggan keadaan) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: TampilanPelanggan(keadaan: keadaan, mataUang: rupiah),
      ),
    ),
  );
}

const contohKopi = BarisPelanggan(
  nama: 'Kopi Susu Gula Aren',
  jumlah: 2,
  hargaSatuan: '18000',
  total: '36000',
);
const contohTeh = BarisPelanggan(
  nama: 'Teh Manis',
  jumlah: 1,
  hargaSatuan: '8000',
  total: '8000',
);
const contohBaris = [contohKopi, contohTeh];

void main() {
  testWidgets('menunggu menampilkan nama toko, bukan layar kosong', (tester) async {
    // Layar hitam kosong terbaca seperti mesin rusak, dan pembeli yang mengira
    // mesinnya rusak akan bertanya kepada kasir yang sedang melayani orang lain.
    await pasang(tester, const PelangganMenunggu(namaToko: 'Toko Berkah', sapaan: 'Selamat datang'));

    expect(find.byKey(const Key('pelanggan-menunggu')), findsOneWidget);
    expect(find.text('Toko Berkah'), findsOneWidget);
    expect(find.text('Selamat datang'), findsOneWidget);
  });

  testWidgets('berbelanja menonjolkan barang yang baru dipindai', (tester) async {
    /*
     * Inilah saat pembeli dapat menyanggah. Barang yang salah pindai jauh lebih
     * murah diperbaiki sekarang daripada setelah struk tercetak dan uang
     * berpindah tangan.
     */
    await pasang(
      tester,
      const PelangganBerbelanja(
        baris: contohBaris,
        total: '44000',
        jumlahBarang: 3,
        terakhirDitambah: contohTeh,
      ),
    );

    expect(find.byKey(const Key('pelanggan-terakhir')), findsOneWidget);
    expect(find.text('Teh Manis'), findsWidgets);
    expect(find.text('1 × Rp 8000'), findsOneWidget);
  });

  testWidgets('total tampil dan terbaca', (tester) async {
    await pasang(
      tester,
      const PelangganBerbelanja(baris: contohBaris, total: '44000', jumlahBarang: 3),
    );

    final total = tester.widget<Text>(find.byKey(const Key('pelanggan-total')));
    expect(total.data, 'Rp 44000');
    // Angka yang nyaman dibaca pada layar kasir tidak terbaca dari seberang meja.
    expect(total.style?.fontSize, greaterThanOrEqualTo(48));
  });

  testWidgets('kembalian dicetak lebih besar daripada total', (tester) async {
    /*
     * Kembalian adalah angka yang diperiksa KEDUA orang, dan satu-satunya yang
     * pembeli tidak dapat hitung ulang dengan mudah sambil berdiri. Kalau ia
     * lebih kecil daripada total, yang paling perlu dilihat justru yang paling
     * sulit dilihat.
     */
    await pasang(
      tester,
      const PelangganMembayar(total: '44000', diserahkan: '50000', kembalian: '6000'),
    );

    final teks = tester.widgetList<Text>(find.byType(Text)).toList();
    final ukuranTotal = teks.firstWhere((t) => t.data == 'Rp 44000').style!.fontSize!;
    final ukuranKembalian = teks.firstWhere((t) => t.data == 'Rp 6000').style!.fontSize!;
    expect(ukuranKembalian, greaterThan(ukuranTotal));
  });

  testWidgets('membayar tanpa uang diserahkan hanya menampilkan total', (tester) async {
    // Sebelum kasir memasukkan uangnya, tidak ada kembalian untuk ditampilkan —
    // dan menampilkan "Rp 0" akan terbaca seolah pembeli tidak dapat kembalian.
    await pasang(tester, const PelangganMembayar(total: '44000'));

    expect(find.text('Kembalian'), findsNothing);
    expect(find.text('Diterima'), findsNothing);
  });

  testWidgets('selesai menampilkan terima kasih dan kembalian', (tester) async {
    await pasang(
      tester,
      const PelangganSelesai(total: '44000', kembalian: '6000', nomorStruk: 'ST-000123'),
    );

    expect(find.text('Terima kasih'), findsOneWidget);
    expect(find.text('Rp 6000'), findsOneWidget);
    expect(find.text('Struk ST-000123'), findsOneWidget);
  });

  testWidgets('keadaan menunggu tidak membawa sisa transaksi sebelumnya', (tester) async {
    /*
     * Data pembeli sebelumnya yang masih tertinggal di layar akan dibaca pembeli
     * berikutnya — beserta apa yang dibelinya dan berapa yang dibayarnya.
     *
     * Dijaga oleh bentuk datanya: `PelangganMenunggu` tidak punya medan untuk
     * menampung baris, total, maupun kembalian. Tidak ada jalan bagi pemanggil
     * untuk menyisipkannya, bahkan bila ia lupa mengosongkan.
     */
    await pasang(tester, const PelangganMenunggu(namaToko: 'Toko Berkah'));

    expect(find.textContaining('Rp'), findsNothing);
    expect(find.textContaining('Kembalian'), findsNothing);
    expect(find.byKey(const Key('pelanggan-total')), findsNothing);
  });

  testWidgets('nama barang yang sangat panjang tidak merusak tata letak', (tester) async {
    // Nama produk pada data master kadang memuat seluruh keterangan varian.
    await pasang(
      tester,
      const PelangganBerbelanja(
        baris: [
          BarisPelanggan(
            nama: 'Kopi Susu Gula Aren Ukuran Besar Dengan Tambahan Espresso Dan Krim Vanila',
            jumlah: 1,
            hargaSatuan: '35000',
            total: '35000',
          ),
        ],
        total: '35000',
        jumlahBarang: 1,
        terakhirDitambah: BarisPelanggan(
          nama: 'Kopi Susu Gula Aren Ukuran Besar Dengan Tambahan Espresso Dan Krim Vanila',
          jumlah: 1,
          hargaSatuan: '35000',
          total: '35000',
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });
}
