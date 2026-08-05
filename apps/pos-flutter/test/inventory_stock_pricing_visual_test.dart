import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _StockVisualClient extends InventoryApiClient {
  _StockVisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<InventoryStockPricingData> stockPricing() async =>
      const InventoryStockPricingData(
        products: [
          InventoryStockProduct('p1', '000102', 'Adem Sari', 'BOX', 24, 49500),
          InventoryStockProduct(
              'p2', '003482', 'Amplop 3/4 Plus', 'SLP', 34, 61500),
          InventoryStockProduct('p3', '000127', 'Amplox', 'BOX', 18, 57000),
          InventoryStockProduct('p4', '000118', 'Antimo', 'LSN', 670, 54000),
          InventoryStockProduct('p5', '000218', 'Bodrex', 'BOX', 879, 102000),
          InventoryStockProduct(
              'p6', '002847', 'Bodrex Extra', 'BOX', 626, 56000),
        ],
        prices: [],
        warehouses: [InventoryWarehouse('w1', 'GDG', 'Gudang Utama')],
        opnames: [],
        priceBooks: [],
        customers: [],
        suppliers: [],
      );
}

void main() {
  testWidgets('bukti visual stok dan harga desktop', (tester) async {
    tester.view.physicalSize = const Size(1280, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: InventoryStockPricingPage(client: _StockVisualClient()),
    ));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(InventoryStockPricingPage),
      matchesGoldenFile('goldens/inventory-stock-pricing-desktop.png'),
    );
  });
}
