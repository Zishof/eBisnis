import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  test('APK release memiliki izin Internet untuk mengakses API eBisnis', () {
    final manifest =
        File('android/app/src/main/AndroidManifest.xml').readAsStringSync();

    expect(
      manifest,
      contains('android.permission.INTERNET'),
      reason: 'Izin Internet harus berada di manifest main, bukan hanya debug.',
    );
  });
}
