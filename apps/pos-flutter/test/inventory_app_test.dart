library;

import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('aplikasi inventory menampilkan login produksi CMN',
      (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    expect(find.text('Masuk Inventory CMN'), findsOneWidget);
    expect(find.text('Caruban Medika Nusantara'), findsNothing);
    expect(
        find.text('Gunakan akun resmi yang diberikan admin.'), findsOneWidget);
    expect(find.text('Muklis'), findsNothing);
    expect(find.text('Masrukin'), findsNothing);
    expect(find.text('Admin CMN'), findsNothing);
  });

  testWidgets('halaman fitur memuat modul inventory lama', (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    await tester.enterText(find.byType(TextField).at(0), 'agung');
    await tester.enterText(find.byType(TextField).at(1), 'agung123!!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Fitur'));
    await tester.pumpAndSettle();

    expect(find.text('Peta Fitur Inventory CMN'), findsOneWidget);
    expect(find.text('Supplier'), findsOneWidget);
    expect(find.text('Customer'), findsOneWidget);
    expect(find.text('Stok Barang'), findsOneWidget);
    expect(find.text('Laba / Rugi'), findsOneWidget);
  });

  testWidgets('sales dapat membuat draft order inventory', (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    await tester.enterText(find.byType(TextField).at(0), 'masrukin');
    await tester.enterText(find.byType(TextField).at(1), 'masrukin123!!');
    await tester.tap(find.text('Masuk'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Order Baru'));
    await tester.pumpAndSettle();

    expect(find.text('Order Baru Sales'), findsOneWidget);
    expect(find.text('Amoxicillin 500 mg'), findsOneWidget);

    await tester.tap(find.byTooltip('Tambah').first);
    await tester.pump();

    expect(find.text('1 baris'), findsOneWidget);
    expect(find.text('Rp 18.500'), findsWidgets);

    await tester.ensureVisible(find.text('Simpan Draft Lokal'));
    await tester.pump();
    await tester.tap(find.text('Simpan Draft Lokal'));
    await tester.pump();

    expect(find.textContaining('tersimpan lokal'), findsOneWidget);
  });
}
