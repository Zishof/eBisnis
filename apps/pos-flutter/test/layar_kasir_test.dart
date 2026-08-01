/// Pengujian layar kasir sebagaimana kasir mengalaminya.
///
/// Yang diuji hanya hal-hal yang tidak dapat dijangkau uji aturan: fokus kotak
/// pindai, tombol yang seharusnya mati, konfirmasi pada aksi yang menghilangkan
/// pekerjaan, dan apa yang tampil di layar pelanggan pada tiap tahap.
///
/// Angka-angkanya sendiri sudah dijaga vektor konformansi bersama; yang diperiksa
/// di sini adalah bahwa layar benar-benar memakainya.
library;

import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/layar/layar_kasir.dart';
import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:ebisnis_pos/layar/tampilan_pelanggan.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _kopi = ProdukLokal(
  productId: 'P1',
  nama: 'Kopi Susu Gula Aren',
  harga: '18000',
  barcodes: ['8991234567890', '8990000000001'],
);
const _teh = ProdukLokal(
  productId: 'P2',
  nama: 'Teh Manis',
  harga: '8000',
  barcodes: ['8991111111111'],
);

class KatalogPalsu implements SumberKatalog {
  @override
  ProdukLokal? dariBarcode(String kode) {
    for (final p in [_kopi, _teh]) {
      if (p.barcodes.contains(kode.trim())) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) => [_kopi, _teh]
      .where((p) => p.nama.toLowerCase().contains(kunci.toLowerCase()))
      .toList();

  @override
  List<TarifLuring> get tarif => const [];

  @override
  String get mataUang => 'IDR';
}

class PencetakPalsu implements Pencetak {
  PencetakPalsu({this.siap = true});

  @override
  final bool siap;

  final List<List<int>> terkirim = [];

  @override
  Future<void> kirim(List<int> byte) async => terkirim.add(byte);
}

Future<ValueNotifier<KeadaanPelanggan>> pasang(
  WidgetTester tester, {
  Pencetak? pencetak,
  List<MetodeBayar>? metode,
}) async {
  final pelanggan = ValueNotifier<KeadaanPelanggan>(
    const PelangganMenunggu(namaToko: 'Toko Uji'),
  );
  await tester.pumpWidget(
    MaterialApp(
      home: LayarKasir(
        katalog: KatalogPalsu(),
        metode: metode ??
            const [MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true)],
        pencetak: pencetak ?? PencetakPalsu(),
        namaToko: 'Toko Uji',
        pelanggan: pelanggan,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return pelanggan;
}

Future<void> pindai(WidgetTester tester, String kode) async {
  await tester.enterText(find.byKey(const Key('kotak-pindai')), kode);
  await tester.testTextInput.receiveAction(TextInputAction.done);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('memindai barcode memasukkan barang, dan fokus kembali ke kotak pindai',
      (tester) async {
    /*
     * Pemindai mengetik lalu menekan Enter. Bila fokus tidak kembali, pindaian
     * berikutnya mendarat di tempat yang salah dan kasir baru menyadarinya
     * beberapa barang kemudian.
     */
    await pasang(tester);
    await pindai(tester, '8991234567890');

    expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);

    final kotak = tester.widget<TextField>(find.byKey(const Key('kotak-pindai')));
    expect(kotak.focusNode!.hasFocus, isTrue);
    expect(kotak.controller!.text, isEmpty);
  });

  testWidgets('barcode alternatif ditemukan sama saja', (tester) async {
    // Pemindai tidak tahu bedanya barcode utama dan alternatif.
    await pasang(tester);
    await pindai(tester, '8990000000001');
    expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);
  });

  testWidgets('memindai barang yang sama dua kali menambah jumlah, bukan baris', (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');
    await pindai(tester, '8991234567890');

    expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);
    expect(find.text('2 × Rp 18.000'), findsOneWidget);
    expect(find.byKey(const Key('total')), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const Key('total'))).data, 'Rp 36.000');
  });

  testWidgets('barcode tak dikenal menyebut kodenya dan langkah berikutnya', (tester) async {
    /*
     * "Barcode tidak dikenali" tanpa kodenya tidak memberi tahu kasir apakah ia
     * salah pindai atau barangnya memang belum terdaftar — dua hal dengan
     * tindak lanjut yang sama sekali berbeda.
     */
    await pasang(tester);
    await pindai(tester, '0000000000000');

    expect(find.byKey(const Key('pesan')), findsOneWidget);
    expect(find.textContaining('0000000000000'), findsOneWidget);
    expect(find.textContaining('master produk'), findsOneWidget);
  });

  testWidgets('tombol bayar mati selama keranjang kosong', (tester) async {
    await pasang(tester);
    final tombol = tester.widget<FilledButton>(find.byKey(const Key('tombol-bayar')));
    expect(tombol.onPressed, isNull);
  });

  testWidgets('F9 membuka dialog bayar', (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f9);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('dialog-bayar')), findsOneWidget);
  });

  testWidgets('selesaikan tidak dapat ditekan selama uang kurang', (tester) async {
    /*
     * Menyelesaikan transaksi dengan pembayaran kurang berarti selisih laci kas
     * yang baru ketahuan saat tutup shift — tanpa cara mengetahui transaksi mana
     * penyebabnya.
     */
    await pasang(tester);
    await pindai(tester, '8991234567890');
    await tester.sendKeyEvent(LogicalKeyboardKey.f9);
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '10000');
    await tester.pumpAndSettle();

    expect(find.textContaining('Kurang'), findsOneWidget);
    expect(
      tester.widget<FilledButton>(find.byKey(const Key('selesaikan'))).onPressed,
      isNull,
    );
  });

  testWidgets('alur penuh: pindai, bayar, struk tercetak dan laci terbuka', (tester) async {
    final pencetak = PencetakPalsu();
    await pasang(tester, pencetak: pencetak);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f9);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '20000');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('selesaikan')));
    await tester.pumpAndSettle();

    expect(pencetak.terkirim, hasLength(1));

    // Perintah membuka laci ikut pada byte struk: laci yang terbuka tanpa struk,
    // atau sebaliknya, membuat kasir tidak yakin transaksinya sudah selesai.
    final byte = pencetak.terkirim.single;
    expect(_memuatUrutan(byte, [0x1B, 0x70]), isTrue, reason: 'perintah ESC p tidak ada');

    // Keranjang dikosongkan dan kembaliannya disebutkan.
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
    expect(find.textContaining('Rp 2.000'), findsOneWidget);
  });

  testWidgets('tanpa printer, transaksi tetap selesai tetapi dikatakan struk tidak tercetak',
      (tester) async {
    /*
     * Menghentikan transaksi karena printer mati akan menahan antrean untuk
     * masalah yang tidak menyangkut uang. Mendiamkannya membuat kasir menunggu
     * struk yang tidak akan pernah keluar.
     */
    await pasang(tester, pencetak: PencetakPalsu(siap: false));
    await pindai(tester, '8991111111111');

    await tester.sendKeyEvent(LogicalKeyboardKey.f9);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '10000');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('selesaikan')));
    await tester.pumpAndSettle();

    expect(find.textContaining('TIDAK tercetak'), findsOneWidget);
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
  });

  testWidgets('F10 membatalkan transaksi HANYA setelah dikonfirmasi', (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f10);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('dialog-konfirmasi')), findsOneWidget);

    // Membatalkan konfirmasinya tidak boleh menghapus apa pun.
    await tester.tap(find.text('Batal'));
    await tester.pumpAndSettle();
    expect(find.text('Kopi Susu Gula Aren'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.f10);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lanjutkan'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
  });

  testWidgets('F8 membuka laci lewat printer, setelah dikonfirmasi', (tester) async {
    final pencetak = PencetakPalsu();
    await pasang(tester, pencetak: pencetak);

    await tester.sendKeyEvent(LogicalKeyboardKey.f8);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lanjutkan'));
    await tester.pumpAndSettle();

    expect(pencetak.terkirim.single, [0x1B, 0x70, 0x00, 25, 125]);
  });

  testWidgets('tanpa printer, F8 mengatakan lacinya tidak dapat dibuka', (tester) async {
    // Laci dibuka lewat printer; tanpa printer tidak ada jalan lain.
    await pasang(tester, pencetak: PencetakPalsu(siap: false));

    await tester.sendKeyEvent(LogicalKeyboardKey.f8);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lanjutkan'));
    await tester.pumpAndSettle();

    expect(find.textContaining('laci kas tidak dapat dibuka'), findsOneWidget);
  });

  testWidgets('F1 menampilkan seluruh pintasan', (tester) async {
    await pasang(tester);
    await tester.sendKeyEvent(LogicalKeyboardKey.f1);
    await tester.pumpAndSettle();
    // F1 tidak dikonfirmasi: ia aksi sehari-hari, dan konfirmasi yang terlalu
    // sering berhenti dibaca.
    expect(find.byKey(const Key('dialog-bantuan')), findsOneWidget);
    expect(find.text('Ke kotak pindai'), findsOneWidget);

    /*
     * Digulung untuk mencapai baris di bawah, sebagaimana kasir menggulungnya.
     * Daftar yang panjang tidak terbangun seluruhnya sekaligus, dan memeriksa
     * tanpa menggulung hanya membuktikan bahwa layarnya cukup tinggi pada mesin
     * yang menjalankan ujinya.
     */
    await tester.scrollUntilVisible(
      find.text('Buka laci kas'),
      100,
      // Disebut tegas: keranjang di belakang dialog juga dapat digulung, dan
      // tanpa penunjukan Playwright-nya Flutter tidak tahu yang mana dimaksud.
      scrollable: find.descendant(
        of: find.byKey(const Key('daftar-pintasan')),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Buka laci kas'), findsOneWidget);
    expect(find.text('Bayar'), findsOneWidget);
  });

  group('layar pelanggan mengikuti', () {
    testWidgets('mulai dari sapaan, bukan layar kosong', (tester) async {
      final p = await pasang(tester);
      expect(p.value, isA<PelangganMenunggu>());
    });

    testWidgets('menampilkan barang yang baru dipindai', (tester) async {
      final p = await pasang(tester);
      await pindai(tester, '8991234567890');

      final k = p.value as PelangganBerbelanja;
      expect(k.terakhirDitambah?.nama, 'Kopi Susu Gula Aren');
      expect(k.total, '18000');
      expect(k.jumlahBarang, 1);
    });

    testWidgets('kembalian tampil sebelum transaksi diselesaikan', (tester) async {
      /*
       * Pembeli perlu melihat kembaliannya SEBELUM uangnya diserahkan, bukan
       * sesudah — itulah saat ia dapat menyanggah tanpa membuka dompet lagi.
       */
      final p = await pasang(tester);
      await pindai(tester, '8991234567890');
      await tester.sendKeyEvent(LogicalKeyboardKey.f9);
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('uang-diserahkan')), '20000');
      await tester.pumpAndSettle();

      final k = p.value as PelangganMembayar;
      expect(k.kembalian, '2000');
    });

    testWidgets('kembali ke sapaan setelah keranjang dikosongkan', (tester) async {
      // Data pembeli sebelumnya tidak boleh tertinggal di layar yang menghadap
      // pembeli berikutnya.
      final p = await pasang(tester);
      await pindai(tester, '8991234567890');
      await tester.sendKeyEvent(LogicalKeyboardKey.f10);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Lanjutkan'));
      await tester.pumpAndSettle();

      expect(p.value, isA<PelangganMenunggu>());
    });
  });
}

bool _memuatUrutan(List<int> data, List<int> pola) {
  for (var i = 0; i + pola.length <= data.length; i += 1) {
    var cocok = true;
    for (var j = 0; j < pola.length; j += 1) {
      if (data[i + j] != pola[j]) {
        cocok = false;
        break;
      }
    }
    if (cocok) return true;
  }
  return false;
}
