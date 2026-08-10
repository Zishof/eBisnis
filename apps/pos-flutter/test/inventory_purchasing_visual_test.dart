import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'golden_path.dart';

class _PurchasingVisualClient extends InventoryApiClient {
  _PurchasingVisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<InventoryOperationsData> operations(
          {required bool includePayables,
          bool includeSettled = false,
          bool includeReceivableSettled = false}) async =>
      InventoryOperationsData(
        receivables: const [],
        payables: const [],
        handovers: const [],
        purchaseOrders: const [
          PurchaseOrderSummary('po1', 'PO-2026-0008', 'DRAFT', '2026-08-06',
              'PT Sehat Bersama', 18750000),
          PurchaseOrderSummary('po2', 'PO-2026-0007', 'SUBMITTED', '2026-08-05',
              'CV Distribusi Prima', 4250000),
          PurchaseOrderSummary('po3', 'PO-2026-0006', 'APPROVED', '2026-08-04',
              'PT Niaga Medika', 9750000),
          PurchaseOrderSummary('po4', 'PO-2026-0005', 'SENT', '2026-08-03',
              'PT Pemasok Utama', 6500000),
        ],
        apPayments: const [],
        suppliers: const [InventoryPriceParty('s1', '001', 'PT Sehat Bersama')],
        products: const [
          InventoryProductDemo(
              id: 'p1',
              uomId: 'u1',
              code: 'P001',
              name: 'Produk A',
              price: 15000,
              stock: 20,
              imageUrl: '')
        ],
        warehouses: const [InventoryWarehouse('w1', 'GDG', 'Gudang Utama')],
      );
}

void main() {
  testWidgets('bukti visual pembelian desktop', (tester) async {
    tester.view.physicalSize = const Size(1280, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: InventoryOperationsPage(
        client: _PurchasingVisualClient(),
        persona: const PersonaInventory(
            username: 'muklis', label: 'Muklis', role: 'Pemilik'),
      ),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Pembelian'));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(InventoryOperationsPage),
      matchesGoldenFile(goldenPath('inventory-purchasing-desktop.png')),
    );
  });
}
