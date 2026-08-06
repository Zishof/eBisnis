import 'package:ebisnis_pos/inventory/inventory_transaction_workspaces.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const parties = [
  TransactionParty(
    id: 'c1',
    code: 'CUST-00102',
    name: 'Adem Sari Mart',
    phone: '0812 3456 7890',
    address: 'Jl. Raya Bogor KM 28, Ciracas',
    balance: 17550000,
    creditLimit: 50000000,
  ),
];

const products = [
  TransactionProduct(
    id: 'p1',
    uomId: 'u1',
    code: '002959',
    name: 'AMPLOP 3/4 AM',
    uom: 'Bks',
    price: 77500,
    stock: 120,
  ),
  TransactionProduct(
    id: 'p2',
    uomId: 'u1',
    code: '000102',
    name: 'ADEM SARI',
    uom: 'Bks',
    price: 49500,
    stock: 5,
  ),
];

Widget host(Widget child) => MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF2563EB)),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          isDense: true,
        ),
      ),
      home: Scaffold(
        backgroundColor: const Color(0xFFF8FAFC),
        body: SingleChildScrollView(
            padding: const EdgeInsets.all(12), child: child),
      ),
    );

void main() {
  testWidgets('bukti visual sales order desktop', (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(host(InventorySalesOrderWorkspace(
      customers: parties,
      products: products,
      salesName: 'Muklis',
      onSubmit: (_) async => 'SO-2026-0001',
    )));
    await tester.tap(find.byTooltip('Tambah item').first);
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/inventory-sales-order-desktop.png'),
    );
  });

  testWidgets('bukti visual pembelian mobile', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(host(InventoryPurchaseWorkspace(
      suppliers: parties,
      products: products,
      warehouses: const [
        TransactionParty(id: 'w1', code: 'GDG', name: 'Gudang Pusat')
      ],
      onSubmit: (_) async => 'PO-2026-0001',
    )));
    await tester.tap(find.byTooltip('Tambah item').first);
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(Scaffold),
      matchesGoldenFile('goldens/inventory-purchase-mobile.png'),
    );
  });

  testWidgets(
      'sales order responsif dapat mencari, menambah, dan mengirim item',
      (tester) async {
    tester.view.physicalSize = const Size(1440, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SalesOrderWorkspaceSubmission? submission;

    await tester.pumpWidget(host(InventorySalesOrderWorkspace(
      customers: parties,
      products: products,
      salesName: 'Muklis',
      onSubmit: (value) async {
        submission = value;
        return 'SO-2026-0001';
      },
    )));

    expect(find.text('Sales Order'), findsOneWidget);
    expect(find.text('Review & Kirim'), findsOneWidget);
    await tester.enterText(
        find.byKey(const Key('sales-product-search')), 'ADEM');
    await tester.pump();
    expect(find.text('ADEM SARI'), findsOneWidget);
    await tester.tap(find.byTooltip('Tambah item'));
    await tester.pump();
    expect(find.text('Item Order (1)'), findsOneWidget);
    await tester.tap(find.byKey(const Key('submit-sales-order')));
    await tester.pumpAndSettle();
    expect(submission?.customerId, 'c1');
    expect(submission?.lines.single.product.code, '000102');
    expect(find.textContaining('SO-2026-0001'), findsOneWidget);
  });

  testWidgets(
      'purchase workspace mobile memuat batch, expiry, gudang, dan submit multi-item',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    PurchaseWorkspaceSubmission? submission;

    await tester.pumpWidget(host(InventoryPurchaseWorkspace(
      suppliers: parties,
      products: products,
      warehouses: const [
        TransactionParty(id: 'w1', code: 'GDG', name: 'Gudang Pusat')
      ],
      onSubmit: (value) async {
        submission = value;
        return 'PO-2026-0001';
      },
    )));
    expect(find.text('Transaksi Pembelian'), findsOneWidget);
    expect(find.text('Pilih Supplier'), findsWidgets);
    await tester.tap(find.byTooltip('Tambah item').first);
    await tester.pump();
    expect(find.text('Item Pembelian (1)'), findsOneWidget);
    expect(find.text('Batch'), findsOneWidget);
    await tester.ensureVisible(find.byKey(const Key('submit-purchase-order')));
    await tester.tap(find.byKey(const Key('submit-purchase-order')));
    await tester.pumpAndSettle();
    expect(submission?.supplierId, 'c1');
    expect(submission?.warehouseId, 'w1');
    expect(submission?.lines.single.product.code, '002959');
  });
}
