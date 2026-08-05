import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('kontrak master relasi mencakup pemasok pelanggan dan sales', () {
    expect(partyLabels.keys,
        containsAll(<String>['suppliers', 'customers', 'salespeople']));
    expect(partyCodeLimits['suppliers'], 3);
    expect(partyCodeLimits['customers'], 5);
    expect(partyCodeLimits['salespeople'], 2);
    expect(partyFields['suppliers']!.any((field) => field.sensitive), isTrue);
  });

  test('parser menggabungkan data master dan saldo server', () {
    final rows = InventoryPartyRecord.fromApiLists(
      <Object?>[
        <String, Object?>{
          'id': 'supplier-1',
          'code': '001',
          'name': 'PT Contoh',
          'region_name': 'Cirebon',
          'is_active': true,
          'version': 3,
        },
      ],
      <Object?>[
        <String, Object?>{
          'id': 'supplier-1',
          'balance': '1250000',
          'document_count': 4,
        },
      ],
    );

    expect(rows, hasLength(1));
    expect(rows.single.balance, 1250000);
    expect(rows.single.documentCount, 4);
    expect(rows.single.subtitle, 'Cirebon');
  });
}
