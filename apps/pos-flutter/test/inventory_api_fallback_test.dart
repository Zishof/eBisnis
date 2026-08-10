import 'dart:io';

import 'package:ebisnis_pos/inventory/inventory_app.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('endpoint CMN memakai dua zona DNS terpisah sebagai fallback', () {
    final candidates = inventoryApiRequestUris(
      Uri.parse('https://cmnmedika-inventory.ebisnis.id/api/v1/'),
      '/auth/login',
    );

    expect(candidates, [
      Uri.parse('https://cmnmedika-inventory.ebisnis.id/api/v1/auth/login'),
      Uri.parse('https://app.emedik.id/api/v1/auth/login'),
      Uri.parse('https://app.santri.info/api/v1/auth/login'),
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

  test('HTTP 429 ditampilkan sebagai pesan yang dapat ditindaklanjuti', () {
    final retryAfter = inventoryApiRetryAfter('12');

    expect(retryAfter, const Duration(seconds: 12));
    expect(
      inventoryApiErrorMessage(
        429,
        'ThrottlerException: Too Many Requests',
        retryAfter: retryAfter,
      ),
      'Server sedang menerima terlalu banyak permintaan. '
      'Tunggu 12 detik lalu coba lagi.',
    );
  });

  test('Retry-After berbentuk tanggal HTTP ikut didukung', () {
    expect(
      inventoryApiRetryAfter(
        'Tue, 11 Aug 2026 15:00:10 GMT',
        now: DateTime.utc(2026, 8, 11, 15),
      ),
      const Duration(seconds: 10),
    );
  });
}
