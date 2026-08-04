library;

import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('aplikasi inventory menampilkan login dan akun demo CMN',
      (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    expect(find.text('Masuk Inventory CMN'), findsOneWidget);
    expect(find.text('Caruban Medika Nusantara'), findsNothing);
    expect(find.text('Muklis'), findsOneWidget);
    expect(find.text('Masrukin'), findsOneWidget);
    expect(find.text('Admin CMN'), findsOneWidget);
  });

  testWidgets('preset akun mengisi username dan password', (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    await tester.tap(find.text('Agung'));
    await tester.pump();

    expect(find.text('agung'), findsOneWidget);
  });

  testWidgets('sales dapat membuat draft order inventory', (tester) async {
    await tester.pumpWidget(const AplikasiInventory());

    await tester.tap(find.text('Masrukin'));
    await tester.pump();
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
