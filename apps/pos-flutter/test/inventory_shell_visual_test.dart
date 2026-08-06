import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _ShellVisualClient extends InventoryApiClient {
  _ShellVisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<int> pendingOutboxCount() async => 0;

  @override
  Future<InventoryParityContract> parityContract() async =>
      const InventoryParityContract(
        screens: 48,
        flutter: InventoryCoverageSummary(
            operational: 48, readOnly: 0, contractOnly: 0),
        items: [],
      );

  @override
  Future<InventorySnapshot> snapshot() async => const InventorySnapshot(
        revenueToday: 152450000,
        purchasesToday: 98760000,
        purchasesMonth: 987650000,
        revenueMonth: 1245600000,
        cogsMonth: 756230000,
        grossProfitMonth: 489370000,
        ordersMonth: 128,
        products: 626,
        customers: 334,
        availableQty: 345678,
        inventoryValue: 3456780000,
        lowStockProducts: 45,
        rawRecords: 154341,
        receivableAmount: 1245500000,
        payableAmount: 876300000,
        purchaseOrders: 60269,
        priceRows: 4894,
        topSales: [
          SalesKpi('Masrukin', 42, 385000000),
          SalesKpi('Tohirin', 35, 312500000),
          SalesKpi('Nofal', 29, 275800000),
          SalesKpi('Agung', 22, 196400000),
        ],
        topProducts: [
          ProductKpi('000102', 'Adem Sari', 1349, 187502000),
          ProductKpi('002959', 'Amplop 3/4 AM', 980, 156903000),
          ProductKpi('000118', 'Antimo', 876, 134040000),
          ProductKpi('002847', 'Bodrex Extra', 760, 91203000),
          ProductKpi('003388', 'Antangin HBTSD', 590, 70030000),
        ],
        salesTrend: [
          TrendKpi('2026-07-24', 82000000),
          TrendKpi('2026-07-26', 118000000),
          TrendKpi('2026-07-29', 69000000),
          TrendKpi('2026-08-01', 156000000),
          TrendKpi('2026-08-03', 103000000),
          TrendKpi('2026-08-06', 174000000),
        ],
        purchaseTrend: [
          TrendKpi('2026-07-24', 76000000),
          TrendKpi('2026-07-26', 98000000),
          TrendKpi('2026-07-29', 64000000),
          TrendKpi('2026-08-01', 134000000),
          TrendKpi('2026-08-03', 89000000),
          TrendKpi('2026-08-06', 148000000),
        ],
        orders: [
          OrderKpi('INV/0826/0098', 'Toko Sumber Rejeki', 'Masrukin', 2750000),
          OrderKpi('INV/0826/0097', 'UD Berkah Abadi', 'Tohirin', 1850000),
          OrderKpi('INV/0826/0096', 'Apotek Sehat', 'Nofal', 5250000),
          OrderKpi('INV/0826/0095', 'Toko Makmur', 'Agung', 3650000),
        ],
        expiringLots: [
          LotKpi('000102', 'Adem Sari', 'B2608A', '18 Agu 2026'),
          LotKpi('000118', 'Antimo', 'B2607C', '25 Agu 2026'),
          LotKpi('003388', 'Antangin HBTSD', 'B2606D', '30 Agu 2026'),
          LotKpi('002847', 'Bodrex Extra', 'B2608F', '02 Sep 2026'),
        ],
      );
}

const _persona = PersonaInventory(
  username: 'muklis',
  label: 'Muklis',
  role: 'Pemilik',
);

void main() {
  testWidgets('shell inventory mengikuti mockup desktop', (tester) async {
    tester.view.physicalSize = const Size(1600, 1000);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(AplikasiInventory(
      initialPersona: _persona,
      client: _ShellVisualClient(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Caruban Medika Nusantara'), findsOneWidget);
    expect(find.text('Gudang Pusat'), findsOneWidget);
    expect(find.text('Tren Penjualan'), findsOneWidget);
    expect(find.text('Transaksi Terbaru'), findsOneWidget);
    await expectLater(
      find.byType(InventoryHomePage),
      matchesGoldenFile('goldens/inventory-shell-desktop.png'),
    );
  });

  testWidgets('shell inventory mengikuti mockup mobile', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(AplikasiInventory(
      initialPersona: _persona,
      client: _ShellVisualClient(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('eBisnis Inventory'), findsOneWidget);
    expect(find.text('Order Baru'), findsOneWidget);
    expect(find.text('Paritas'), findsOneWidget);
    await expectLater(
      find.byType(InventoryHomePage),
      matchesGoldenFile('goldens/inventory-shell-mobile.png'),
    );
  });
}
