import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:ebisnis_pos/api/pos_api.dart';
import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/layar/sumber.dart';

void main() {
  test('POS Apotik memilih FEFO lalu memvalidasi farmasi sebelum pembayaran',
      () async {
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    final calls = <String>[];
    final bodies = <String, Map<String, Object?>>{};

    final serving = () async {
      await for (final request in server) {
        final path = request.uri.path;
        calls.add('${request.method} $path');
        final text = await utf8.decoder.bind(request).join();
        if (text.isNotEmpty) {
          bodies[path] = jsonDecode(text) as Map<String, Object?>;
        }
        Object data = <String, Object?>{};
        if (path.endsWith('/pos/sales')) {
          data = <String, Object?>{'id': 'sale-1'};
        }
        if (path.endsWith('/lots')) {
          data = <Object?>[
            <String, Object?>{
              'id': 'lot-fefo',
              'eligible': true,
              'recommended': true
            },
          ];
        }
        if (path.endsWith('/complete')) {
          data = <String, Object?>{'receiptNumber': 'APT-0001'};
        }
        request.response.headers.contentType = ContentType.json;
        request.response.write(jsonEncode({'success': true, 'data': data}));
        await request.response.close();
      }
    }();

    final client = PosApiClient(
      baseUrl: Uri.parse('http://127.0.0.1:${server.port}/api/v1/'),
      accessToken: 'token-test',
    );
    final line = BarisLuring(
      productId: 'product-1',
      name: 'Paracetamol',
      uomId: 'uom-1',
      quantity: 2,
      unitPrice: '1500',
      taxRateId: null,
    );
    final result = HasilKeranjang(
      lines: const [],
      subtotal: '3000',
      taxTotal: '0',
      grandTotal: '3000',
      itemCount: 2,
    );
    final receipt = await client.bukukan(
      sesi: const SesiKasirApi(
        outletId: 'outlet-1',
        terminalId: 'terminal-1',
        shiftId: 'shift-1',
        businessDate: '2026-08-06',
        outletName: 'Apotik Demo',
        currency: 'IDR',
      ),
      transaksi: TransaksiKasir(
        baris: [line],
        hasil: result,
        metode: const MetodeBayar(
            id: 'cash-1', nama: 'Tunai', memberiKembalian: true),
        diserahkan: '5000',
        kembalian: '2000',
        jenisPesanan: 'Bebas',
        catatan: '',
        modeFarmasi: 'OTC',
      ),
    );

    expect(receipt, 'APT-0001');
    expect(bodies['/api/v1/pos/sales/sale-1/items']?['lotId'], 'lot-fefo');
    expect(
        calls.indexOf('POST /api/v1/health/pharmacy/pos-sales/sale-1/validate'),
        lessThan(calls.indexOf('POST /api/v1/pos/sales/sale-1/payments')));
    expect(
        calls.last, 'POST /api/v1/health/pharmacy/pos-sales/sale-1/complete');

    await server.close(force: true);
    await serving;
  });
}
