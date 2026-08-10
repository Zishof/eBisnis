import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/aturan/koneksi.dart';
import 'package:ebisnis_pos/layar/layar_kasir.dart';
import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'golden_path.dart';

const _produk = [
  ProdukLokal(
    productId: 'PARA500',
    nama: 'Paracetamol 500 mg',
    harga: '1500',
    barcodes: ['8991000000001'],
    kategori: 'Analgesik',
    varian: 'Tablet',
    penanda: ['OTC', 'Batch'],
    stok: 325,
    favorit: true,
  ),
  ProdukLokal(
    productId: 'VITC500',
    nama: 'Vitamin C 500 mg',
    harga: '2000',
    barcodes: ['8991000000002'],
    kategori: 'Vitamin & Suplemen',
    varian: 'Tablet hisap',
    penanda: ['OTC'],
    stok: 186,
    favorit: true,
  ),
  ProdukLokal(
    productId: 'AMOX500',
    nama: 'Amoxicillin 500 mg',
    harga: '3200',
    barcodes: ['8991000000003'],
    kategori: 'Antibiotik',
    varian: 'Kapsul',
    penanda: ['Resep'],
    stok: 92,
  ),
  ProdukLokal(
    productId: 'SALB100',
    nama: 'Salbutamol Inhaler 100 mcg',
    harga: '35000',
    barcodes: ['8991000000004'],
    kategori: 'Pernapasan',
    varian: 'Inhaler',
    penanda: ['Resep', 'High-alert'],
    stok: 5,
  ),
  ProdukLokal(
    productId: 'ORALIT',
    nama: 'Oralit 200 ml',
    harga: '4500',
    barcodes: ['8991000000005'],
    kategori: 'Saluran Cerna',
    varian: 'Larutan oral',
    penanda: ['OTC', 'Cold chain'],
    stok: 48,
  ),
  ProdukLokal(
    productId: 'DICLO50',
    nama: 'Diclofenac 50 mg',
    harga: '2500',
    barcodes: ['8991000000006'],
    kategori: 'Analgesik',
    varian: 'Tablet salut enterik',
    penanda: ['OTC'],
    stok: 72,
  ),
];

class _KatalogApotikVisual extends SumberKatalog {
  @override
  ProdukLokal? dariBarcode(String kode) {
    for (final produk in _produk) {
      if (produk.barcodes.contains(kode)) return produk;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) => _produk
      .where((p) => p.nama.toLowerCase().contains(kunci.toLowerCase()))
      .toList();

  @override
  List<TarifLuring> get tarif => const [];

  @override
  String get mataUang => 'IDR';
}

class _PencetakVisual implements Pencetak {
  @override
  bool get siap => true;

  @override
  Future<void> kirim(List<int> byte) async {}
}

Widget _aplikasi() => MaterialApp(
      home: LayarKasir(
        katalog: _KatalogApotikVisual(),
        metode: const [
          MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true),
          MetodeBayar(id: 'QRIS', nama: 'QRIS', memberiKembalian: false),
          MetodeBayar(
              id: 'KARTU', nama: 'Debit / Kredit', memberiKembalian: false),
        ],
        pencetak: _PencetakVisual(),
        namaToko: 'Apotik Sehat Sentosa',
        namaOutlet: '01 - Apotik Sehat Sentosa',
        shift: 'Pagi (08:00 - 16:00)',
        koneksi: KeadaanKoneksi.daring,
        namaPengguna: 'Siti Aisyah, S.Farm.',
        mode: ModeKasir.apotik,
      ),
    );

Future<void> _pasang(WidgetTester tester, Size ukuran) async {
  tester.view.physicalSize = ukuran;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(_aplikasi());
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('POS Apotik mengikuti komposisi desktop', (tester) async {
    await _pasang(tester, const Size(1600, 960));

    expect(find.text('POS Apotik'), findsWidgets);
    expect(find.text('Paracetamol 500 mg'), findsOneWidget);
    expect(find.byKey(const Key('bilah-samping')), findsOneWidget);
    await expectLater(
      find.byType(LayarKasir),
      matchesGoldenFile(goldenPath('apotik-pos-desktop.png')),
    );
  });

  testWidgets('POS Apotik mengikuti komposisi Android', (tester) async {
    await _pasang(tester, const Size(412, 915));

    expect(find.text('eMedik POS Apotik'), findsOneWidget);
    expect(find.byKey(const Key('bilah-samping')), findsNothing);
    expect(find.byKey(const Key('ringkasan-keranjang-mobile')), findsOneWidget);
    await expectLater(
      find.byType(LayarKasir),
      matchesGoldenFile(goldenPath('apotik-pos-mobile.png')),
    );
  });
}
