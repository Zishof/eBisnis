import 'package:ebisnis_pos/api/pos_api.dart';
import 'package:ebisnis_pos/layar/operasi_apotik.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class _ShiftApiStub extends PosApiClient {
  _ShiftApiStub()
      : super(baseUrl: Uri.parse('http://localhost/'), accessToken: 'test');

  Map<String, Object?>? closeBody;

  @override
  Future<Map<String, Object?>> ringkasanKasShift(String shiftId) async => {
        'openingCash': '500000',
        'cashSales': '2000000',
        'cashIn': '0',
        'cashOut': '0',
        'expectedCash': '2500000',
      };

  @override
  Future<Map<String, Object?>> tutupShift({
    required String shiftId,
    required num countedCash,
    String? note,
  }) async {
    closeBody = {
      'shiftId': shiftId,
      'countedCash': countedCash,
      'note': note,
    };
    return {
      'status': 'CLOSED',
      'requiresApproval': false,
      'variance': '-5000',
    };
  }
}

void main() {
  testWidgets('kas dan shift memakai ringkasan server lalu menutup shift',
      (tester) async {
    final client = _ShiftApiStub();
    var refreshes = 0;
    await tester.pumpWidget(MaterialApp(
      home: Scaffold(
        body: ShiftApotikPanel(
          data: const {
            'openShift': {'shiftId': 'shift-1', 'shiftNumber': 'SFT-001'},
          },
          client: client,
          onRefresh: () => refreshes += 1,
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Tutup Shift & Rekonsiliasi'), findsWidgets);
    expect(find.text('Rp 2500000'), findsOneWidget);
    await tester.enterText(
        find.byKey(const Key('closing-cash-apotik')), '2495000');
    await tester.scrollUntilVisible(
      find.byKey(const Key('close-shift-apotik')),
      250,
      scrollable: find.byType(Scrollable).last,
    );
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('close-shift-apotik')))
          .onPressed,
      isNull,
    );
    await tester.enterText(find.byKey(const Key('closing-note-apotik')),
        'Retur tunai belum masuk rekap.');
    await tester.pump();
    expect(
      tester
          .widget<FilledButton>(find.byKey(const Key('close-shift-apotik')))
          .onPressed,
      isNotNull,
    );
    await tester.ensureVisible(find.byKey(const Key('close-shift-apotik')));
    await tester.tap(find.byKey(const Key('close-shift-apotik')));
    await tester.pumpAndSettle();

    expect(find.text('Konfirmasi Penutupan Shift'), findsOneWidget);
    expect(find.text('Kas sistem: Rp 2500000'), findsOneWidget);
    expect(find.text('Kas fisik: Rp 2495000'), findsOneWidget);
    expect(find.text('Selisih: Rp -5000'), findsOneWidget);
    expect(client.closeBody, isNull);
    await tester.tap(find.byKey(const Key('confirm-close-shift-apotik')));
    await tester.pumpAndSettle();

    expect(client.closeBody, {
      'shiftId': 'shift-1',
      'countedCash': 2495000,
      'note': 'Retur tunai belum masuk rekap.',
    });
    expect(refreshes, 1);
    expect(find.text('Shift berhasil ditutup.'), findsOneWidget);
  });
}
