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
import 'package:ebisnis_pos/layar/kisi_produk.dart';
import 'package:ebisnis_pos/layar/layar_kasir.dart';
import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:ebisnis_pos/layar/tampilan_pelanggan.dart';
import 'package:ebisnis_pos/pembaruan/pengelola_pembaruan.dart';
import 'package:ebisnis_pos/pembaruan/sumber_pembaruan.dart';
import 'package:ebisnis_pos/pembaruan/versi.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

const _kopi = ProdukLokal(
  productId: 'P1',
  nama: 'Kopi Susu Gula Aren',
  harga: '18000',
  barcodes: ['8991234567890', '8990000000001'],
  kategori: 'Kopi',
  varian: 'Reguler',
  stok: 25,
  favorit: true,
);
const _teh = ProdukLokal(
  productId: 'P2',
  nama: 'Teh Manis',
  harga: '8000',
  barcodes: ['8991111111111'],
  kategori: 'Non Kopi',
  stok: 4,
);
const _habis = ProdukLokal(
  productId: 'P3',
  nama: 'Cheesecake',
  harga: '32000',
  barcodes: ['8992222222222'],
  kategori: 'Dessert',
  stok: 0,
);

class KatalogPalsu extends SumberKatalog {
  @override
  ProdukLokal? dariBarcode(String kode) {
    for (final p in [_kopi, _teh, _habis]) {
      if (p.barcodes.contains(kode.trim())) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) => [_kopi, _teh, _habis]
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

class SumberPembaruanPalsu implements SumberPembaruan {
  SumberPembaruanPalsu(this.rilis);
  final RilisTersedia? rilis;

  @override
  Future<RilisTersedia?> ambil() async => rilis;
}

/// Menemukan teks HANYA di dalam panel keranjang.
///
/// Sejak kisi produk ada, nama produk muncul di dua tempat sekaligus. Uji yang
/// mencari namanya tanpa membatasi tempat akan lulus meski keranjangnya kosong —
/// yaitu justru kegagalan yang paling ingin ditangkap uji ini.
Finder diKeranjang(String teks) => find.descendant(
      of: find.byKey(const Key('daftar-keranjang')),
      matching: find.text(teks),
    );

/// Menemukan teks HANYA di dalam dialog bantuan.
///
/// Bilah pintasan di kaki layar menampilkan keterangan aksi yang sama persis,
/// sehingga pencarian tanpa batas tempat dapat lulus tanpa dialognya pernah
/// terbuka.
Finder diBantuan(String teks) => find.descendant(
      of: find.byKey(const Key('dialog-bantuan')),
      matching: find.text(teks),
    );

Future<ValueNotifier<KeadaanPelanggan>> pasang(
  WidgetTester tester, {
  Pencetak? pencetak,
  List<MetodeBayar>? metode,
  PengelolaPembaruan? pembaruan,
  SinkronisasiKasir? sinkronisasi,
  ModeKasir mode = ModeKasir.penjualan,
  Size ukuran = const Size(1600, 960),
}) async {
  /*
   * Ukuran meja kasir, bukan ukuran bawaan uji (800x600).
   *
   * Klien ini menyasar meja kasir desktop dan tablet lanskap — bukan ponsel.
   * Mengujinya pada layar yang lebih sempit daripada perangkat mana pun yang
   * disasar hanya akan menghasilkan kegagalan tata letak yang tidak pernah
   * dialami siapa pun.
   */
  tester.view.physicalSize = ukuran;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final pelanggan = ValueNotifier<KeadaanPelanggan>(
    const PelangganMenunggu(namaToko: 'Toko Uji'),
  );
  addTearDown(pelanggan.dispose);

  await tester.pumpWidget(
    MaterialApp(
      home: LayarKasir(
        katalog: KatalogPalsu(),
        metode: metode ??
            const [
              MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true)
            ],
        pencetak: pencetak ?? PencetakPalsu(),
        namaToko: 'Toko Uji',
        pelanggan: pelanggan,
        pembaruan: pembaruan,
        sinkronisasi: sinkronisasi,
        mode: mode,
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
  testWidgets('bilah pintasan dapat diklik dan sinkronisasi benar-benar jalan',
      (tester) async {
    var dipanggil = 0;
    await pasang(
      tester,
      sinkronisasi: () async {
        dipanggil += 1;
        return 2;
      },
    );

    final tombol = find.byKey(const Key('aksi-sinkronkan'));
    await tester.scrollUntilVisible(
      tombol,
      300,
      scrollable: find.descendant(
        of: find.byKey(const Key('bilah-pintasan')),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.tap(tombol);
    await tester.pumpAndSettle();

    expect(dipanggil, 1);
    expect(find.text('2 transaksi tertunda berhasil disinkronkan.'),
        findsOneWidget);
  });

  testWidgets(
      'memindai barcode memasukkan barang, dan fokus kembali ke kotak pindai',
      (tester) async {
    /*
     * Pemindai mengetik lalu menekan Enter. Bila fokus tidak kembali, pindaian
     * berikutnya mendarat di tempat yang salah dan kasir baru menyadarinya
     * beberapa barang kemudian.
     */
    await pasang(tester);
    await pindai(tester, '8991234567890');

    expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);

    final kotak =
        tester.widget<TextField>(find.byKey(const Key('kotak-pindai')));
    expect(kotak.focusNode!.hasFocus, isTrue);
    expect(kotak.controller!.text, isEmpty);
  });

  testWidgets('mode apotik memakai istilah dan konteks farmasi',
      (tester) async {
    await pasang(tester, mode: ModeKasir.apotik);

    expect(find.text('POS Apotik'), findsWidgets);
    expect(find.byKey(const Key('panel-konteks-apotik')), findsOneWidget);
    expect(find.byKey(const Key('nomor-resep-apotik')), findsOneWidget);
    expect(find.text('Resep'), findsOneWidget);
    expect(find.text('Bebas'), findsOneWidget);
    expect(find.text('Antar'), findsOneWidget);
    expect(find.textContaining('Pindai barcode obat'), findsOneWidget);
  });

  testWidgets('mode apotik ponsel memakai navigasi bawah dan sheet keranjang',
      (tester) async {
    await pasang(
      tester,
      mode: ModeKasir.apotik,
      ukuran: const Size(412, 915),
    );

    expect(find.byKey(const Key('bilah-samping')), findsNothing);
    expect(find.byKey(const Key('ringkasan-keranjang-mobile')), findsOneWidget);
    expect(find.text('Kasir'), findsOneWidget);
    expect(find.text('Resep'), findsOneWidget);
    expect(find.text('Riwayat'), findsOneWidget);

    await pindai(tester, '8991234567890');
    await tester.tap(find.byKey(const Key('ringkasan-keranjang-mobile')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('daftar-keranjang')), findsOneWidget);
    expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('barcode alternatif ditemukan sama saja', (tester) async {
    // Pemindai tidak tahu bedanya barcode utama dan alternatif.
    await pasang(tester);
    await pindai(tester, '8990000000001');
    expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);
  });

  testWidgets('memindai barang yang sama dua kali menambah jumlah, bukan baris',
      (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');
    await pindai(tester, '8991234567890');

    expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);
    expect(tester.widget<Text>(find.byKey(const Key('jumlah-0'))).data, '2');
    expect(tester.widget<Text>(find.byKey(const Key('total-baris-0'))).data,
        'Rp 36.000');
    expect(
        tester.widget<Text>(find.byKey(const Key('total'))).data, 'Rp 36.000');
  });

  testWidgets('barcode tak dikenal menyebut kodenya dan langkah berikutnya',
      (tester) async {
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
    final tombol =
        tester.widget<FilledButton>(find.byKey(const Key('tombol-bayar')));
    expect(tombol.onPressed, isNull);
  });

  testWidgets('F2 membuka dialog bayar', (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f2);
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('dialog-bayar')), findsOneWidget);
  });

  testWidgets('selesaikan tidak dapat ditekan selama uang kurang',
      (tester) async {
    /*
     * Menyelesaikan transaksi dengan pembayaran kurang berarti selisih laci kas
     * yang baru ketahuan saat tutup shift — tanpa cara mengetahui transaksi mana
     * penyebabnya.
     */
    await pasang(tester);
    await pindai(tester, '8991234567890');
    await tester.sendKeyEvent(LogicalKeyboardKey.f2);
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '10000');
    await tester.pumpAndSettle();

    expect(find.textContaining('Kurang'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('selesaikan')))
          .onPressed,
      isNull,
    );
  });

  testWidgets('alur penuh: pindai, bayar, lalu pilih cetak struk dan buka laci',
      (tester) async {
    final pencetak = PencetakPalsu();
    await pasang(tester, pencetak: pencetak);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f2);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '20000');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('selesaikan')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('dialog-transaksi-berhasil')), findsOneWidget);
    expect(find.text('Rp 2.000'), findsOneWidget);
    expect(pencetak.terkirim, isEmpty);

    await tester.tap(find.byKey(const Key('aksi-cetak-struk-selesai')));
    await tester.pumpAndSettle();
    expect(pencetak.terkirim, hasLength(1));
    final byte = pencetak.terkirim.single;
    expect(_memuatUrutan(byte, [0x1B, 0x70]), isFalse,
        reason: 'cetak struk tidak boleh membuka laci otomatis');

    await tester.tap(find.byKey(const Key('aksi-buka-laci-selesai')));
    await tester.pumpAndSettle();
    expect(pencetak.terkirim, hasLength(2));
    expect(pencetak.terkirim.last, [0x1B, 0x70, 0x00, 25, 125]);

    await tester.tap(find.byKey(const Key('aksi-transaksi-baru')));
    await tester.pumpAndSettle();

    // Keranjang dikosongkan untuk transaksi berikutnya.
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
  });

  testWidgets('pembayaran selesai masuk ke riwayat pembayaran dan summary',
      (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');

    await tester.tap(find.byKey(const Key('tombol-bayar')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '20000');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('selesaikan')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('aksi-transaksi-baru')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('menu-riwayat-pembayaran')));
    await tester.pumpAndSettle();

    expect(find.text('Riwayat Pembayaran'), findsWidgets);
    expect(find.text('Transaksi'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.textContaining('LOKAL-'), findsOneWidget);
    expect(find.textContaining('Tunai'), findsWidgets);
    expect(find.text('Rp 18.000'), findsWidgets);
  });

  testWidgets(
      'tanpa printer, transaksi tetap selesai tetapi dikatakan struk tidak tercetak',
      (tester) async {
    /*
     * Menghentikan transaksi karena printer mati akan menahan antrean untuk
     * masalah yang tidak menyangkut uang. Mendiamkannya membuat kasir menunggu
     * struk yang tidak akan pernah keluar.
     */
    await pasang(tester, pencetak: PencetakPalsu(siap: false));
    await pindai(tester, '8991111111111');

    await tester.sendKeyEvent(LogicalKeyboardKey.f2);
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('uang-diserahkan')), '10000');
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('selesaikan')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('dialog-transaksi-berhasil')), findsOneWidget);
    expect(find.textContaining('Printer tidak terpasang'), findsOneWidget);
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
  });

  testWidgets('F10 membatalkan transaksi HANYA setelah dikonfirmasi',
      (tester) async {
    await pasang(tester);
    await pindai(tester, '8991234567890');

    await tester.sendKeyEvent(LogicalKeyboardKey.f10);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('dialog-konfirmasi')), findsOneWidget);

    // Membatalkan konfirmasinya tidak boleh menghapus apa pun.
    await tester.tap(find.text('Batal'));
    await tester.pumpAndSettle();
    expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.f10);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lanjutkan'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
  });

  testWidgets('F6 membuka laci lewat printer, setelah dikonfirmasi',
      (tester) async {
    final pencetak = PencetakPalsu();
    await pasang(tester, pencetak: pencetak);

    await tester.sendKeyEvent(LogicalKeyboardKey.f6);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Lanjutkan'));
    await tester.pumpAndSettle();

    expect(pencetak.terkirim.single, [0x1B, 0x70, 0x00, 25, 125]);
  });

  testWidgets('tanpa printer, F6 mengatakan lacinya tidak dapat dibuka',
      (tester) async {
    // Laci dibuka lewat printer; tanpa printer tidak ada jalan lain.
    await pasang(tester, pencetak: PencetakPalsu(siap: false));

    await tester.sendKeyEvent(LogicalKeyboardKey.f6);
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
    expect(diBantuan('Bantuan'), findsOneWidget);

    /*
     * Digulung untuk mencapai baris di bawah, sebagaimana kasir menggulungnya.
     * Daftar yang panjang tidak terbangun seluruhnya sekaligus, dan memeriksa
     * tanpa menggulung hanya membuktikan bahwa layarnya cukup tinggi pada mesin
     * yang menjalankan ujinya.
     */
    await tester.scrollUntilVisible(
      diBantuan('Buka laci kas'),
      100,
      // Disebut tegas: keranjang di belakang dialog juga dapat digulung, dan
      // tanpa penunjukan Playwright-nya Flutter tidak tahu yang mana dimaksud.
      scrollable: find.descendant(
        of: find.byKey(const Key('daftar-pintasan')),
        matching: find.byType(Scrollable),
      ),
    );
    await tester.pumpAndSettle();
    expect(diBantuan('Buka laci kas'), findsOneWidget);
    expect(diBantuan('Bayar'), findsOneWidget);
  });

  group('kisi produk', () {
    testWidgets('menekan kartu produk memasukkannya ke keranjang',
        (tester) async {
      /*
       * Sebagian besar barang di gerai makanan dan minuman tidak punya barcode.
       * Kopi yang baru diseduh tidak dapat dipindai, sehingga bagi gerai seperti
       * itu kisi inilah jalan utamanya.
       */
      await pasang(tester);
      await tester.tap(find.byKey(const Key('produk-P1')));
      await tester.pumpAndSettle();

      expect(diKeranjang('Kopi Susu Gula Aren'), findsOneWidget);
      expect(tester.widget<Text>(find.byKey(const Key('total'))).data,
          'Rp 18.000');
    });

    testWidgets('barang habis TAMPIL tetapi tidak dapat ditekan',
        (tester) async {
      /*
       * Menyembunyikannya membuat kasir mencarinya berulang kali dan
       * menyimpulkan bahwa katalognya rusak. Yang perlu diketahuinya adalah
       * barangnya memang ada di daftar dan memang sedang habis — sehingga ia
       * dapat mengatakannya kepada pembeli, bukan mencari-cari.
       */
      await pasang(tester);
      expect(find.byKey(const Key('produk-P3')), findsOneWidget);
      expect(find.text('Habis'), findsOneWidget);

      await tester.tap(find.byKey(const Key('produk-P3')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('keranjang-kosong')), findsOneWidget);
    });

    testWidgets('stok yang TIDAK diketahui tidak ditampilkan sebagai nol',
        (tester) async {
      // Menampilkan "Stok 0" untuk stok yang tidak diketahui membuat kasir
      // menolak menjual barang yang sebenarnya ada di rak.
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: KisiProduk(
              produk: const [
                // Namanya sengaja tidak memuat kata "Stok": pencarian teks di
                // bawah akan lulus atau gagal karena nama produknya, bukan
                // karena badge yang sedang diuji.
                ProdukLokal(
                    productId: 'X',
                    nama: 'Kopi Tubruk',
                    harga: '1000',
                    barcodes: []),
              ],
              kategori: const [],
              terpilih: kategoriSemua,
              onKategori: (_) {},
              onPilih: (_) {},
              uang: (n) => 'Rp $n',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('stok-X')), findsNothing);
      expect(find.textContaining('Stok'), findsNothing);
      expect(find.text('Habis'), findsNothing);
    });

    testWidgets('penyaring kategori mempersempit kisi', (tester) async {
      await pasang(tester);
      expect(find.byKey(const Key('produk-P2')), findsOneWidget);

      await tester.tap(find.byKey(const Key('kategori-Kopi')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('produk-P1')), findsOneWidget);
      expect(find.byKey(const Key('produk-P2')), findsNothing);
    });

    testWidgets('mengetik nama menyaring kisi, bukan mengeluh soal barcode',
        (tester) async {
      /*
       * Satu kotak melayani pemindai dan pengetikan nama sekaligus. Yang
       * menentukan perlakuannya adalah bentuk teksnya: barcode yang tak dikenal
       * adalah masalah data master, sedangkan nama yang tak ditemukan cukup
       * dijawab dengan mempersempit kisi.
       */
      await pasang(tester);
      await pindai(tester, 'teh');

      expect(find.byKey(const Key('produk-P2')), findsOneWidget);
      expect(find.byKey(const Key('produk-P1')), findsNothing);
      expect(find.byKey(const Key('pesan')), findsNothing);
    });

    testWidgets('nama yang tidak ada dikatakan tanpa menyebut master produk',
        (tester) async {
      await pasang(tester);
      await pindai(tester, 'nasi goreng');

      expect(find.textContaining('Tidak ada produk bernama'), findsOneWidget);
      expect(find.textContaining('master produk'), findsNothing);
    });
  });

  group('cek pembaruan', () {
    testWidgets('versi baru diumumkan otomatis sekali per sesi',
        (tester) async {
      final p = PengelolaPembaruan(
        sumber: SumberPembaruanPalsu(
          const RilisTersedia(
              versi: '9.9.9', jalurUnduh: 'https://contoh/pos.exe'),
        ),
        versiBerjalan: '1.0.0',
      );
      addTearDown(p.dispose);
      await p.periksa();

      await pasang(tester, pembaruan: p);
      await tester.pumpAndSettle();

      expect(
          find.byKey(const Key('dialog-pembaruan-otomatis')), findsOneWidget);
      expect(find.text('Pembaruan POS tersedia'), findsOneWidget);
      expect(find.byKey(const Key('tombol-unduh-pembaruan')), findsOneWidget);

      await tester.tap(find.byKey(const Key('tombol-tunda-pembaruan')));
      await tester.pumpAndSettle();
      await p.periksa();
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dialog-pembaruan-otomatis')), findsNothing);
    });

    testWidgets('menekan tombol memeriksa dan menampilkan hasilnya',
        (tester) async {
      final p = PengelolaPembaruan(
        sumber: SumberPembaruanPalsu(
          const RilisTersedia(
              versi: '9.9.9', jalurUnduh: 'https://contoh/pos.exe'),
        ),
        versiBerjalan: '1.0.0',
      );
      addTearDown(p.dispose);

      await pasang(tester, pembaruan: p);
      await tester.tap(find.byKey(const Key('tombol-cek-pembaruan')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('dialog-pembaruan')), findsOneWidget);
      expect(find.text('Pembaruan POS tersedia'), findsWidgets);
      expect(find.byKey(const Key('tautan-unduh')), findsOneWidget);
      expect(find.byKey(const Key('tombol-unduh-pembaruan')), findsOneWidget);
    });

    testWidgets('sumber yang gagal TIDAK dilaporkan sebagai sudah terbaru',
        (tester) async {
      /*
       * Melaporkan "sudah terbaru" ketika sebenarnya tidak dapat memeriksa
       * adalah kebohongan yang paling mudah dipercaya — dan mesin kasir dapat
       * tertinggal berbulan-bulan tanpa ada yang curiga.
       */
      final p = PengelolaPembaruan(
        sumber: SumberPembaruanPalsu(null),
        versiBerjalan: '1.0.0',
      );
      addTearDown(p.dispose);

      await pasang(tester, pembaruan: p);
      await tester.tap(find.byKey(const Key('tombol-cek-pembaruan')));
      await tester.pumpAndSettle();

      expect(find.text('Tidak dapat diperiksa'), findsOneWidget);
      expect(find.byKey(const Key('tautan-unduh')), findsNothing);
    });

    testWidgets('tanpa pengelola pembaruan, tombolnya tidak ada sama sekali',
        (tester) async {
      await pasang(tester);
      expect(find.byKey(const Key('tombol-cek-pembaruan')), findsNothing);
    });
  });

  group('bilah atas mengatakan yang benar-benar diketahui', () {
    testWidgets('printer yang tidak terpasang disebut merah, bukan didiamkan',
        (tester) async {
      await pasang(tester, pencetak: PencetakPalsu(siap: false));
      expect(find.text('Tidak terpasang'), findsOneWidget);
    });

    testWidgets('sinkronisasi yang belum pernah diperiksa BUKAN "Online"',
        (tester) async {
      /*
       * Penanda pada bilah atas dibaca sekilas, sekali di pagi hari, lalu
       * dipercaya sepanjang hari. Penanda hijau yang tidak pernah memeriksa apa
       * pun membuat gerai menutup buku dengan yakin bahwa seluruh transaksinya
       * sudah sampai di peladen.
       */
      await pasang(tester);
      expect(find.text('Belum tersambung'), findsOneWidget);
      expect(find.text('Online'), findsNothing);
    });
  });

  group('bilah samping', () {
    testWidgets('menu non-kasir membuka halaman aktif', (tester) async {
      await pasang(tester);
      await tester.tap(find.byKey(const Key('menu-laporan')));
      await tester.pumpAndSettle();

      expect(find.textContaining('Ringkasan transaksi'), findsOneWidget);
    });

    testWidgets('dashboard bisnis memuat tab analitik lengkap', (tester) async {
      await pasang(tester);
      await tester.tap(find.byKey(const Key('menu-dashboard')));
      await tester.pumpAndSettle();

      expect(find.text('Dashboard Bisnis'), findsOneWidget);
      expect(find.text('Ringkasan Umum'), findsOneWidget);
      expect(find.text('Keuangan & Kinerja'), findsOneWidget);

      await tester.tap(find.byKey(const Key('dashboard-tab-1')));
      await tester.pumpAndSettle();
      expect(find.text('Pendapatan Kotor'), findsOneWidget);

      final daftarTab = find.descendant(
        of: find.byKey(const Key('dashboard-tab-list')),
        matching: find.byType(Scrollable),
      );
      for (var i = 0; i < 16; i += 1) {
        await tester.drag(daftarTab, const Offset(-180, 0));
        await tester.pumpAndSettle();
        final tabAkhir = find.byKey(const Key('dashboard-tab-8'));
        if (tabAkhir.evaluate().isEmpty) continue;
        final pusat = tester.getCenter(tabAkhir);
        if (pusat.dx < tester.view.physicalSize.width - 40) {
          break;
        }
      }
      await tester.tap(find.byKey(const Key('dashboard-tab-8')));
      await tester.pumpAndSettle();

      expect(find.text('Kepatuhan Operasional'), findsWidgets);
      expect(find.text('Struk Tersimpan'), findsOneWidget);
    });
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

    testWidgets('kembalian tampil sebelum transaksi diselesaikan',
        (tester) async {
      /*
       * Pembeli perlu melihat kembaliannya SEBELUM uangnya diserahkan, bukan
       * sesudah — itulah saat ia dapat menyanggah tanpa membuka dompet lagi.
       */
      final p = await pasang(tester);
      await pindai(tester, '8991234567890');
      await tester.sendKeyEvent(LogicalKeyboardKey.f2);
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(const Key('uang-diserahkan')), '20000');
      await tester.pumpAndSettle();

      final k = p.value as PelangganMembayar;
      expect(k.kembalian, '2000');
    });

    testWidgets('kembali ke sapaan setelah keranjang dikosongkan',
        (tester) async {
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
