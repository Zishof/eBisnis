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
}
