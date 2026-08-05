import 'package:ebisnis_pos/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('mode apotik selalu meminta akun server sebelum membuka kasir',
      (tester) async {
    await tester.pumpWidget(
      const AplikasiKasir(modeApotikOverride: true),
    );
    await tester.pump();

    expect(find.text('Masuk POS Apotik'), findsOneWidget);
    expect(find.byKey(const Key('login-apotik-username')), findsOneWidget);
    expect(find.byKey(const Key('login-apotik-password')), findsOneWidget);
    expect(find.byKey(const Key('login-apotik-tenant')), findsOneWidget);
    expect(find.text('POS Apotik'), findsNothing);
  });

  testWidgets('login apotik menolak kolom akun yang kosong', (tester) async {
    await tester.pumpWidget(
      const AplikasiKasir(modeApotikOverride: true),
    );
    await tester.pump();

    await tester.ensureVisible(find.byKey(const Key('login-apotik-submit')));
    await tester.tap(find.byKey(const Key('login-apotik-submit')));
    await tester.pump();

    expect(find.byKey(const Key('login-apotik-error')), findsOneWidget);
    expect(
      find.text('Nama pengguna dan kata sandi wajib diisi.'),
      findsOneWidget,
    );
  });
}
