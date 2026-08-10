import 'dart:io';

import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('endpoint CMN memakai domain utama sebagai fallback DNS', () {
    final candidates = inventoryApiRequestUris(
      Uri.parse('https://cmnmedika-inventory.ebisnis.id/api/v1/'),
      '/auth/login',
    );

    expect(candidates, [
      Uri.parse('https://cmnmedika-inventory.ebisnis.id/api/v1/auth/login'),
      Uri.parse('https://ebisnis.id/api/v1/auth/login'),
    ]);
  });

  test('endpoint staging tidak pernah dialihkan ke produksi', () {
    final candidates = inventoryApiRequestUris(
      Uri.parse('https://staging.example.test/api/v1/'),
      '/auth/login',
    );

    expect(candidates,
        [Uri.parse('https://staging.example.test/api/v1/auth/login')]);
  });

  test('hanya kegagalan lookup DNS yang boleh mencoba fallback', () {
    expect(
      inventoryApiDnsLookupFailed(
        const SocketException(
          'Failed host lookup',
          osError: OSError('No address associated with hostname', 7),
        ),
      ),
      isTrue,
    );
    expect(
      inventoryApiDnsLookupFailed(
        const SocketException('Connection reset by peer'),
      ),
      isFalse,
    );
  });
}
