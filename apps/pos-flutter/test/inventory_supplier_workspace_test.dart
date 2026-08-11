import 'package:ebisnis_pos/inventory/inventory_supplier_workspace.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'golden_path.dart';

Map<String, Object?> _workspace() => {
      'summary': {
        'total': 1,
        'active': 1,
        'inactive': 0,
        'withPayables': 1,
        'outstanding': '2500000',
        'purchasesMonth': '4500000',
        'paymentsMonth': '2000000',
      },
      'suppliers': [
        {
          'id': 'supplier-1',
          'code': 'SUP-001',
          'name': 'PT Sumber Makmur Abadi',
          'contact_person': 'Andi Wijaya',
          'phone': '081234567890',
          'email': 'andi@example.test',
          'legacy_payment_days': 30,
          'region_name': 'Jakarta',
          'is_active': true,
          'payable_balance': '2500000',
          'payable_document_count': 2,
          'purchase_count': 4,
          'purchase_ytd': '4500000',
          'last_purchase': '2026-08-05',
          'payment_ytd': '2000000',
        }
      ],
      'purchases': [
        {
          'id': 'purchase-1',
          'supplier_id': 'supplier-1',
          'purchase_order_number': 'PO-001',
          'order_date': '2026-08-05',
          'warehouse_name': 'Gudang Pusat',
          'status': 'POSTED',
          'discount_total': '0',
          'tax_total': '0',
          'grand_total': '4500000',
        }
      ],
      'payables': [
        {
          'supplier_id': 'supplier-1',
          'legacy_invoice_number': 'INV-001',
          'transaction_date': '2026-08-05',
          'due_date': '2026-09-04',
          'original_amount': '4500000',
          'outstanding_amount': '2500000',
          'aging_bucket': 'BELUM_JATUH_TEMPO',
        }
      ],
      'payments': [
        {
          'supplier_id': 'supplier-1',
          'payment_number': 'PAY-001',
          'payment_date': '2026-08-06',
          'method': 'TRANSFER',
          'status': 'POSTED',
          'total_amount': '2000000',
        }
      ],
      'topProducts': [
        {
          'supplier_id': 'supplier-1',
          'product_code': 'PRD-001',
          'product_name': 'Produk A',
          'uom': 'PCS',
          'total_qty': '20',
          'total_value': '4500000',
        }
      ],
    };

Widget _app() => MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
      ),
      home: InventorySupplierWorkspacePage(
        load: () async => _workspace(),
        onManage: (_) {},
      ),
    );

void main() {
  testWidgets('workspace supplier desktop memuat lima alur operasional',
      (tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.text('PT Sumber Makmur Abadi'), findsWidgets);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile(goldenPath('inventory_supplier_workspace_desktop.png')),
    );
    await tester.tap(find.text('Detail'));
    await tester.pumpAndSettle();
    expect(find.text('Kesehatan relasi'), findsOneWidget);

    await tester.tap(find.text('Pembelian'));
    await tester.pumpAndSettle();
    expect(find.text('PO-001'), findsOneWidget);

    await tester.tap(find.text('Ledger'));
    await tester.pumpAndSettle();
    expect(find.text('INV-001'), findsOneWidget);
    expect(find.text('PAY-001'), findsOneWidget);

    await tester.tap(find.text('Analisis'));
    await tester.pumpAndSettle();
    expect(find.text('Peringkat supplier berdasarkan pembelian YTD'),
        findsOneWidget);
  });

  testWidgets('workspace supplier tetap dapat dinavigasi di layar telepon',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('PT Sumber Makmur Abadi'), findsOneWidget);
    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile(goldenPath('inventory_supplier_workspace_mobile.png')),
    );
    await tester.tap(find.byType(NavigationDestination).at(3));
    await tester.pumpAndSettle();
    expect(find.text('Ledger hutang'), findsOneWidget);
  });
}
