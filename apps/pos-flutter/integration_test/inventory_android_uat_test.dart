import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

class _AndroidUatClient extends InventoryApiClient {
  _AndroidUatClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'ANDROID-UAT',
        );

  @override
  Future<int> pendingOutboxCount() async => 0;

  @override
  Future<InventoryParityContract> parityContract() async =>
      InventoryParityContract(
        screens: 48,
        flutter: const InventoryCoverageSummary(
          operational: 48,
          readOnly: 0,
          contractOnly: 0,
        ),
        items: List.generate(
          48,
          (index) => InventoryParityItem(
            screen: index + 1,
            name: 'Layar legacy ${index + 1}',
            flutter: 'OPERATIONAL',
          ),
        ),
      );

  @override
  Future<InventoryOperationsData> operations({
    required bool includePayables,
    bool includeSettled = false,
    bool includeReceivableSettled = false,
  }) async =>
      const InventoryOperationsData(
        receivables: [],
        payables: [],
        handovers: [],
        purchaseOrders: [],
        apPayments: [],
        suppliers: [],
        products: [],
        warehouses: [],
        arReceipts: [],
      );

  @override
  Future<InventoryStockPricingData> stockPricing() async =>
      const InventoryStockPricingData(
        products: [],
        prices: [],
        warehouses: [],
        opnames: [],
        priceBooks: [],
        customers: [],
        suppliers: [],
      );

  @override
  Future<InventoryFinanceData> financeWorkspace() async =>
      const InventoryFinanceData(
        accounts: [],
        periods: [],
        journals: [],
        closeRuns: [],
      );
}

const _persona = PersonaInventory(
  username: 'android-uat',
  label: 'Android UAT',
  role: 'Sales',
);

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Android membuka seluruh workspace paritas Inventory',
      (tester) async {
    await tester.pumpWidget(AplikasiInventory(
      initialPersona: _persona,
      initialCatalog: const InventoryCatalog(customers: [], products: []),
      client: _AndroidUatClient(),
    ));
    await tester.pumpAndSettle();

    // Sales selalu masuk langsung ke order, bukan dashboard eksekutif.
    expect(find.text('Sales Order'), findsWidgets);

    await tester.tap(find.text('Operasional'));
    await tester.pumpAndSettle();
    expect(find.text('Pembelian, Hutang & Piutang'), findsOneWidget);

    await tester.tap(find.text('Paritas'));
    await tester.pumpAndSettle();
    expect(
        find.text('48 layar diperiksa dari kontrak API yang sama dengan Web.'),
        findsOneWidget);
    expect(find.text('Master relasi (8 layar)'), findsOneWidget);
    expect(find.text('Keuangan dan periode (6 layar)'), findsOneWidget);

    final parityNavigation = find.text('Buka bukti navigasi per layar');
    await tester.ensureVisible(parityNavigation);
    await tester.tap(parityNavigation);
    await tester.pumpAndSettle();
    for (var screen = 1; screen <= 48; screen++) {
      final button = find.byKey(Key('open-legacy-screen-$screen'));
      expect(button, findsOneWidget, reason: 'Tombol layar $screen harus tersedia');
      expect(
        tester.widget<OutlinedButton>(button).onPressed,
        isNotNull,
        reason: 'Tombol layar $screen harus aktif',
      );
    }
    final lastScreen = find.byKey(const Key('open-legacy-screen-48'));
    await tester.ensureVisible(lastScreen);
    await tester.pumpAndSettle();
    await tester.tap(lastScreen);
    await tester.pumpAndSettle();
    expect(find.text('Kas, Bank & Akuntansi'), findsOneWidget);

    Future<void> openMore(String label, String heading) async {
      await tester.tap(find.byTooltip('Semua modul'));
      await tester.pumpAndSettle();
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
      expect(find.text(heading), findsOneWidget);
    }

    await openMore('Stok & Harga', 'Master Produk & Inventori');
    await openMore('Panduan', 'Panduan Penggunaan');
  });
}
