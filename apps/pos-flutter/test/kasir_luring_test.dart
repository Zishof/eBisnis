/// Uji `KasirLuringEngine`: mesin kasir luring yang menjadi jalur pengiriman
/// transaksi ketika peladen tidak terjangkau.
///
/// Dua hal diuji berkas ini:
///
/// 1. `KasirLuringEngine.buat()` tidak pernah melempar walau `path_provider`
///    gagal. Disimulasikan lewat `PathProviderPlatform.instance` palsu yang
///    melempar deterministik -- BUKAN dengan membiarkan kanal platform tanpa
///    mock sama sekali. Percobaan pertama memakai pendekatan itu ("environment
///    default sudah begini") ternyata membuat `flutter test` di CI MENGGANTUNG
///    ~10 menit alih-alih melempar `MissingPluginException` seperti diduga --
///    perilaku kanal platform tanpa handler ternyata tidak terjamin sama di
///    semua versi Flutter. Mock eksplisit di sini menjamin kegagalan yang
///    CEPAT dan DAPAT DIDUGA, tanpa bergantung pada perilaku ambien.
/// 2. Siklus jual-luring-lalu-sinkron sungguhan: jatah dipesan selagi daring,
///    jaringan putus di tengah penjualan, transaksi tetap tersimpan di
///    antrean lokal tanpa melempar ke pemanggil, lalu terkirim begitu
///    `sinkronkan()` dipanggil kembali.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/native.dart';
import 'package:ebisnis_pos/api/pos_api.dart';
import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/inventory/inventory_local_database.dart';
import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:ebisnis_pos/mesin/identitas_mesin.dart';
import 'package:ebisnis_pos/mesin/kasir_luring.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path_provider_platform_interface/path_provider_platform_interface.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

/// `path_provider` palsu yang selalu gagal -- deterministik, tanpa bergantung
/// pada bagaimana kanal platform tanpa handler berperilaku di versi Flutter
/// yang sedang dipakai CI.
class _PathProviderGagal extends PathProviderPlatform with MockPlatformInterfaceMixin {
  @override
  Future<String?> getApplicationSupportPath() async {
    throw PlatformException(
      code: 'UNAVAILABLE',
      message: 'path_provider tidak tersedia (disimulasikan untuk uji).',
    );
  }
}

const _sesi = SesiKasirApi(
  outletId: 'outlet-1',
  terminalId: 'terminal-1',
  shiftId: 'shift-1',
  businessDate: '2026-08-08',
  outletName: 'Toko Uji',
  currency: 'IDR',
);

TransaksiKasir _transaksiContoh({String? modeFarmasi}) => TransaksiKasir(
      baris: const [
        BarisLuring(
          productId: 'product-1',
          name: 'Kopi Sachet',
          uomId: 'uom-1',
          quantity: 2,
          unitPrice: '5000',
          taxRateId: null,
        ),
      ],
      hasil: const HasilKeranjang(
        lines: [
          HasilBaris(
            productId: 'product-1',
            name: 'Kopi Sachet',
            uomId: 'uom-1',
            quantity: 2,
            unitPrice: '5000',
            lineSubtotal: '10000',
            taxAmount: '0',
            lineTotal: '10000',
            taxRateId: null,
          ),
        ],
        subtotal: '10000',
        taxTotal: '0',
        grandTotal: '10000',
        itemCount: 2,
      ),
      metode: const MetodeBayar(id: 'cash-1', nama: 'Tunai', memberiKembalian: true),
      diserahkan: '10000',
      kembalian: '0',
      jenisPesanan: 'Bebas',
      catatan: '',
      modeFarmasi: modeFarmasi,
    );

/// Membuka lalu segera menutup satu server loopback, dan mengembalikan
/// portnya. Menyambung ke port ini sesudahnya andal melempar
/// `SocketException` -- lebih stabil daripada menebak port yang tidak dipakai.
Future<int> _portMati() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final port = server.port;
  await server.close(force: true);
  return port;
}

void main() {
  group('KasirLuringEngine.buat', () {
    testWidgets(
      'tidak melempar dan menandai luring tak tersedia ketika direktori data aplikasi tak terjangkau',
      (tester) async {
        final asli = PathProviderPlatform.instance;
        PathProviderPlatform.instance = _PathProviderGagal();
        addTearDown(() => PathProviderPlatform.instance = asli);

        final client = PosApiClient(
          baseUrl: Uri.parse('http://127.0.0.1:1/'),
          accessToken: 'token-uji',
        );

        final mesin = await KasirLuringEngine.buat(
          client: client,
          sesi: _sesi,
          katalogSyncedAt: '2026-08-08T00:00:00Z',
        );

        expect(mesin.luringTersedia, isFalse);
        expect(await mesin.jumlahTertunda(), 0);
      },
    );
  });

  group('KasirLuringEngine siklus luring', () {
    test(
      'bukukan() tidak melempar ketika jaringan putus setelah jatah dipesan -- transaksi tersimpan di antrean',
      () async {
        final calls = <String>[];
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        unawaited(server.forEach((request) async {
          calls.add('${request.method} ${request.uri.path}');
          Object? data;
          if (request.uri.path.endsWith('/receipt-blocks/current')) {
            data = null;
          } else if (request.uri.path.endsWith('/receipt-blocks')) {
            data = {
              'prefix': 'OFF-',
              'padding': 4,
              'fromNumber': 1,
              'toNumber': 10,
              'nextNumber': 1,
            };
          } else {
            data = <String, Object?>{};
          }
          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode({'success': true, 'data': data}));
          await request.response.close();
        }));

        final client = PosApiClient(
          baseUrl: Uri.parse('http://127.0.0.1:${server.port}/api/v1/'),
          accessToken: 'token-uji',
        );
        final mesin = KasirLuringEngine(
          client: client,
          sesi: _sesi,
          identitas: IdentitasMesin(id: buatIdMesin(), nama: namaMesinBawaan),
          katalogSyncedAt: '2026-08-08T00:00:00Z',
          database: InventoryLocalDatabase(NativeDatabase.memory()),
        );

        // Selagi daring: jatah nomor struk berhasil dipesan.
        await mesin.siapkan();
        expect(mesin.luringTersedia, isTrue);
        expect(calls, contains('POST /api/v1/pos/offline/receipt-blocks'));

        // Jaringan putus di tengah shift -- port yang sama sekarang mati.
        await server.close(force: true);

        final nomorStruk = await mesin.bukukan(_transaksiContoh());

        expect(nomorStruk, 'OFF-0001');
        expect(await mesin.jumlahTertunda(), 1);
      },
    );

    test(
      'bukukan() TIDAK menawarkan jalur luring pada transaksi mode farmasi, walau jatah tersedia',
      () async {
        final deadPort = await _portMati();
        final client = PosApiClient(
          baseUrl: Uri.parse('http://127.0.0.1:$deadPort/api/v1/'),
          accessToken: 'token-uji',
        );
        final db = InventoryLocalDatabase(NativeDatabase.memory());
        final mesin = KasirLuringEngine(
          client: client,
          sesi: _sesi,
          identitas: IdentitasMesin(id: buatIdMesin(), nama: namaMesinBawaan),
          katalogSyncedAt: '2026-08-08T00:00:00Z',
          database: db,
        );

        // Tidak lewat siapkan(): pastikan modeFarmasi menang bahkan bila
        // implementasi luringTersedia berubah nanti.
        await expectLater(
          mesin.bukukan(_transaksiContoh(modeFarmasi: 'OTC')),
          throwsA(isA<SocketException>()),
        );
        expect(await mesin.jumlahTertunda(), 0);
      },
    );

    test(
      'sinkronkan() mengirim ulang transaksi yang tertunda begitu peladen terjangkau kembali',
      () async {
        final db = InventoryLocalDatabase(NativeDatabase.memory());
        await db.enqueue(
          eventId: 'offline-1',
          method: 'POST',
          path: '/pos/offline/sales',
          payload: const {'offlineId': 'offline-1', 'receiptNumber': 'OFF-0001'},
        );
        expect(await db.pendingCount(), 1);

        final received = <Map<String, Object?>>[];
        final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
        unawaited(server.forEach((request) async {
          final text = await utf8.decoder.bind(request).join();
          received.add(jsonDecode(text) as Map<String, Object?>);
          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode({
            'success': true,
            'data': {'saleId': 'sale-synced-1'},
          }));
          await request.response.close();
        }));

        final client = PosApiClient(
          baseUrl: Uri.parse('http://127.0.0.1:${server.port}/api/v1/'),
          accessToken: 'token-uji',
        );
        final mesin = KasirLuringEngine(
          client: client,
          sesi: _sesi,
          identitas: IdentitasMesin(id: buatIdMesin(), nama: namaMesinBawaan),
          katalogSyncedAt: '2026-08-08T00:00:00Z',
          database: db,
        );

        final terkirim = await mesin.sinkronkan();

        expect(terkirim, 1);
        expect(await db.pendingCount(), 0);
        expect(received.single['offlineId'], 'offline-1');

        await server.close(force: true);
      },
    );
  });
}
