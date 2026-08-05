library;

import 'package:ebisnis_pos/inventory/inventory_app.dart';
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
    await tester.pumpWidget(const AplikasiInventory(
      initialPersona:
          PersonaInventory(username: 'agung', label: 'Agung', role: 'Sales'),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Fitur'));
    await tester.pumpAndSettle();

    expect(find.text('Peta Fitur Inventory CMN'), findsOneWidget);
    expect(find.text('Master relasi (8 layar)'), findsOneWidget);
    expect(find.text('Stok dan harga (11 layar)'), findsOneWidget);
    expect(find.text('Pembelian dan hutang (10 layar)'), findsOneWidget);
    expect(find.text('Penjualan dan piutang (13 layar)'), findsOneWidget);
    expect(find.text('Keuangan dan periode (6 layar)'), findsOneWidget);
  });

  testWidgets('sales melihat katalog tenant nyata untuk membuat order',
      (tester) async {
    await tester.pumpWidget(const AplikasiInventory(
      initialPersona: PersonaInventory(
          username: 'masrukin', label: 'Masrukin', role: 'Sales'),
      initialCatalog: InventoryCatalog(
        customers: [InventoryCustomer('c1', 'C001', 'Apotek Sehat Waras')],
        products: [
          InventoryProductDemo(
            id: 'p1',
            uomId: 'u1',
            code: '000102',
            name: 'ADEM SARI',
            price: 49000,
            stock: 5,
          ),
        ],
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Order Baru'));
    await tester.pumpAndSettle();

    expect(find.text('Order Baru Sales'), findsOneWidget);
    expect(find.text('ADEM SARI'), findsOneWidget);

    await tester.tap(find.byTooltip('Tambah').first);
    await tester.pump();

    expect(find.text('1 baris'), findsOneWidget);
    expect(find.text('Rp 49.000'), findsWidgets);
    expect(find.text('Kirim Order'), findsOneWidget);
  });

  testWidgets('panduan inventory dapat dibaca dari aplikasi', (tester) async {
    await tester.pumpWidget(const AplikasiInventory(
      initialPersona:
          PersonaInventory(username: 'agung', label: 'Agung', role: 'Sales'),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Panduan'));
    await tester.pumpAndSettle();

    expect(find.text('Panduan Inventory / Sales'), findsOneWidget);
    expect(find.text('Mulai bekerja'), findsOneWidget);
    expect(
      find.text('https://inventory.ebisnis.id/panduan/inventory-sales'),
      findsOneWidget,
    );
  });
}
