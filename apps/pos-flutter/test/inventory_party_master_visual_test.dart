import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'golden_path.dart';

class _VisualClient extends InventoryApiClient {
  _VisualClient()
      : super(
          baseUrl: Uri.parse('https://example.test/api/v1/'),
          tenantCode: 'VISUAL',
        );

  @override
  Future<List<InventoryPartyRecord>> partyMasters(String kind) async => [
        InventoryPartyRecord(
          id: '1',
          code: '001',
          name: 'PT Sehat Bersama',
          active: true,
          version: 4,
          balance: 18750000,
          documentCount: 12,
          customerCount: 0,
          values: const {
            'code': '001',
            'name': 'PT Sehat Bersama',
            'legacy_payment_days': 30,
            'contact_person': 'Ibu Ratna',
            'address_text': 'Jl. Industri Cirebon No. 18',
            'region_name': 'Cirebon',
            'phone': '0231-555018',
            'email': 'order@sehatbersama.test',
            'bank_account_number': '1234567890',
            'bank_account_name': 'PT Sehat Bersama',
            'bank_name': 'Bank Nusantara',
            'bank_address': 'Cabang Cirebon',
          },
        ),
        InventoryPartyRecord(
          id: '2',
          code: '002',
          name: 'CV Distribusi Prima',
          active: true,
          version: 2,
          balance: 4250000,
          documentCount: 3,
          customerCount: 0,
          values: const {
            'code': '002',
            'name': 'CV Distribusi Prima',
            'region_name': 'Majalengka',
          },
        ),
      ];
}

void main() {
  testWidgets('bukti visual master pemasok desktop', (tester) async {
    tester.view.physicalSize = const Size(1280, 820);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(MaterialApp(
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F766E)),
        useMaterial3: true,
      ),
      home: InventoryPartyMasterPage(client: _VisualClient()),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('PT Sehat Bersama').first);
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(InventoryPartyMasterPage),
      matchesGoldenFile(goldenPath('inventory-party-master-desktop.png')),
    );
  });
}
