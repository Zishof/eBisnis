import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _ReceivablesVisualClient extends InventoryApiClient {
  _ReceivablesVisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<InventoryOperationsData> operations({
    required bool includePayables,
    bool includeSettled = false,
    bool includeReceivableSettled = false,
  }) async =>
      const InventoryOperationsData(
        receivables: [
          SettlementDocument(
            id: 'ar1',
            kind: 'AR',
            partyId: 'c1',
            partyName: 'Toko Sejahtera',
            invoiceNumber: 'INV-2026-0188',
            amount: 850000,
            agingBucket: '31-60',
            salespersonId: 'u1',
            salesName: 'Masrukin',
          ),
          SettlementDocument(
            id: 'ar2',
            kind: 'AR',
            partyId: 'c2',
            partyName: 'Apotek Makmur',
            invoiceNumber: 'INV-2026-0193',
            amount: 425000,
            agingBucket: '1-30',
            salespersonId: 'u2',
            salesName: 'Tohirin',
          ),
        ],
        payables: [],
        handovers: [
          HandoverSummary(
            id: 'h1',
            number: 'NOTA-2026-0012',
            salesperson: 'Masrukin',
            invoiceCount: 8,
            amount: 5750000,
            status: 'HANDED_OVER',
          ),
        ],
        purchaseOrders: [],
        apPayments: [],
        suppliers: [],
        products: [],
        warehouses: [],
        arReceipts: [
          ArReceiptSummary('RCV-2026-0102', '2026-08-06', 'Toko Sejahtera',
              'TRANSFER', 350000, 'POSTED'),
        ],
      );
}

void main() {
  testWidgets('bukti visual penjualan dan piutang desktop', (tester) async {
    tester.view.physicalSize = const Size(1280, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: Scaffold(
        body: SingleChildScrollView(
          child: InventoryOperationsPage(
            client: _ReceivablesVisualClient(),
            persona: const PersonaInventory(
                username: 'muklis', label: 'Muklis', role: 'Pemilik'),
          ),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Piutang Customer - Belum Lunas'), findsOneWidget);
    expect(find.text('Aging sales'), findsOneWidget);
    expect(find.text('Riwayat Penerimaan Piutang'), findsOneWidget);
    await expectLater(
      find.byType(InventoryOperationsPage),
      matchesGoldenFile('goldens/inventory-sales-receivables-desktop.png'),
    );
  });
}
