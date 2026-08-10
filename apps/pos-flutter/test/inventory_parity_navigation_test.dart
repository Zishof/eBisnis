import 'package:ebisnis_pos/inventory/inventory_parity_navigation.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('seluruh 48 layar memiliki workspace Flutter yang dapat dibuka', () {
    final mapping = {
      for (var screen = 1; screen <= 48; screen++)
        screen: inventoryTabForLegacyScreen(screen),
    };

    expect(mapping.length, 48);
    expect(mapping.values.every({1, 2, 3, 5}.contains), isTrue);
    expect(mapping[1], 2);
    expect(mapping[8], 3);
    expect(mapping[20], 2);
    expect(mapping[30], 1);
    expect(mapping[31], 2);
    expect(mapping[43], 5);
    expect(mapping[48], 5);
  });

  test('nomor di luar kontrak 48 layar ditolak', () {
    expect(() => inventoryTabForLegacyScreen(0), throwsRangeError);
    expect(() => inventoryTabForLegacyScreen(49), throwsRangeError);
  });
}
