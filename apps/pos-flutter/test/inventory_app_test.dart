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

  testWidgets('halaman paritas memuat kontrak modul inventory lama',
      (tester) async {
    await tester.pumpWidget(const AplikasiInventory(
      initialPersona:
          PersonaInventory(username: 'agung', label: 'Agung', role: 'Sales'),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Paritas'));
    await tester.pumpAndSettle();

    expect(find.text('Peta Fitur Inventory CMN'), findsOneWidget);
    expect(find.text('Master relasi (8 layar)'), findsOneWidget);
    expect(find.text('Stok dan harga (11 layar)'), findsOneWidget);
    expect(find.text('Pembelian dan hutang (10 layar)'), findsOneWidget);
    expect(find.text('Penjualan dan piutang (13 layar)'), findsOneWidget);
    expect(find.text('Keuangan dan periode (6 layar)'), findsOneWidget);
  });

  test('operasional memetakan piutang, hutang, dan serah-terima nota', () {
    final data = InventoryOperationsData.fromApi(
      [
        {
          'id': 'ar-1',
          'customer_id': 'customer-1',
          'customer_name': 'Apotek Sehat',
          'salesperson_id': 'sales-1',
          'legacy_invoice_number': 'INV-001',
          'amount': '125000',
          'aging_bucket': '1-30',
        },
      ],
      [
        {
          'id': 'ap-1',
          'supplier_id': 'supplier-1',
          'supplier_name': 'PBF Nusantara',
          'legacy_invoice_number': 'PO-001',
          'amount': '80000',
          'aging_bucket': 'BELUM JATUH TEMPO',
        },
      ],
      [
        {
          'id': 'note-1',
          'handover_number': 'NOTA-001',
          'salesperson_name': 'Masrukin',
          'invoice_count': 1,
          'outstanding_amount': '125000',
          'status': 'HANDED_OVER',
        },
      ],
    );

    expect(data.receivables.single.partyName, 'Apotek Sehat');
    expect(data.receivables.single.salespersonId, 'sales-1');
    expect(data.payables.single.partyName, 'PBF Nusantara');
    expect(data.handovers.single.status, 'HANDED_OVER');
    expect(data.handovers.single.amount, 125000);
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
            imageUrl: '',
          ),
        ],
      ),
    ));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Order Baru'));
    await tester.pumpAndSettle();

    expect(find.text('Sales Order'), findsWidgets);
    expect(find.text('ADEM SARI'), findsOneWidget);

    await tester.ensureVisible(find.byTooltip('Tambah item').first);
    await tester.tap(find.byTooltip('Tambah item').first);
    await tester.pump();

    expect(find.text('1 item'), findsWidgets);
    expect(find.text('Rp 49.000'), findsWidgets);
    expect(find.text('Kirim Order'), findsWidgets);
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
