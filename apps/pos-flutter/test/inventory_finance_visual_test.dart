import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'golden_path.dart';

class _FinanceVisualClient extends InventoryApiClient {
  _FinanceVisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<InventoryFinanceData> financeWorkspace() async =>
      const InventoryFinanceData(
        accounts: [
          FinanceAccount('a1', '101', 'Kas', 'ASSET', 'DEBIT', true),
          FinanceAccount('a2', '102', 'Piutang Dagang', 'ASSET', 'DEBIT', true),
          FinanceAccount(
              'a3', '202', 'Hutang Dagang', 'LIABILITY', 'CREDIT', true),
          FinanceAccount(
              'a4', '400', 'Pendapatan Penjualan', 'REVENUE', 'CREDIT', true),
        ],
        periods: [
          FinancePeriod('p1', '2026-08', 'Agustus 2026', '2026-08-01',
              '2026-08-31', 'OPEN'),
        ],
        journals: [
          FinanceJournal('j1', 'JRN-20260806-001', '2026-08-06',
              'Penerimaan pelanggan', 'POSTED', 850000, 850000),
          FinanceJournal('j2', 'JRN-20260806-002', '2026-08-06',
              'Pembelian tunai', 'DRAFT', 425000, 425000),
        ],
        closeRuns: [],
      );
}

void main() {
  testWidgets('bukti visual kas jurnal dan keuangan desktop', (tester) async {
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
          padding: const EdgeInsets.all(16),
          child: InventoryFinancePage(client: _FinanceVisualClient()),
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Keuangan dan Akuntansi'), findsOneWidget);
    expect(find.text('Jurnal baru'), findsOneWidget);
    expect(find.text('JRN-20260806-001'), findsOneWidget);
    await expectLater(
      find.byType(InventoryFinancePage),
      matchesGoldenFile(goldenPath('inventory-finance-desktop.png')),
    );
  });
}
