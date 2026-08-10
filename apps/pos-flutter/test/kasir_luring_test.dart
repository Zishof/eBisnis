/// Uji `KasirLuringEngine.buat()`: mesin kasir luring yang menjadi jalur
/// pengiriman transaksi ketika peladen tidak terjangkau.
///
/// `buat()` tidak pernah melempar walau `path_provider` gagal. Disimulasikan
/// lewat `PathProviderPlatform.instance` palsu yang melempar deterministik --
/// BUKAN dengan membiarkan kanal platform tanpa mock sama sekali. Percobaan
/// pertama memakai pendekatan itu ("environment default sudah begini")
/// ternyata membuat `flutter test` di CI MENGGANTUNG ~10 menit alih-alih
/// melempar `MissingPluginException` seperti diduga -- perilaku kanal
/// platform tanpa handler ternyata tidak terjamin sama di semua versi
/// Flutter. Mock eksplisit di sini menjamin kegagalan yang CEPAT dan DAPAT
/// DIDUGA, tanpa bergantung pada perilaku ambien.
///
/// Siklus jual-luring-lalu-sinkron diuji dengan client deterministik. Tidak ada
/// socket server atau kanal platform ambien yang dapat menggantung CI: client
/// dibuat putus, transaksi harus masuk outbox dengan id tetap, lalu client
/// disambungkan dan item yang sama dikirim tepat sekali oleh `sinkronkan()`.
library;

import 'dart:io';

import 'package:ebisnis_pos/api/pos_api.dart';
import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/inventory/inventory_local_database.dart';
import 'package:ebisnis_pos/mesin/kasir_luring.dart';
import 'package:ebisnis_pos/mesin/identitas_mesin.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:drift/native.dart';
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

class _ClientLuring extends PosApiClient {
  _ClientLuring()
      : super(
          baseUrl: Uri.parse('https://offline.test/api/v1/'),
          accessToken: 'token-uji',
        );

  bool tersambung = true;
  final terkirim = <Map<String, Object?>>[];

  @override
  Future<Map<String, Object?>?> jatahStrukAktif(String terminalId) async => {
        'prefix': 'UAT-',
        'padding': 4,
        'fromNumber': 1,
        'toNumber': 10,
        'nextNumber': 1,
      };

  @override
  Future<String> bukukan({
    required SesiKasirApi sesi,
    required TransaksiKasir transaksi,
  }) async {
    if (!tersambung) throw const SocketException('jaringan diputus untuk uji');
    return 'ONLINE-0001';
  }

  @override
  Future<Map<String, Object?>> kirimTransaksiLuring(
      Map<String, Object?> payload) async {
    if (!tersambung) throw const SocketException('jaringan diputus untuk uji');
    terkirim.add(Map<String, Object?>.from(payload));
    return {'status': 'POSTED'};
  }
}

const _transaksi = TransaksiKasir(
  baris: [
    BarisLuring(
      productId: 'product-1',
      name: 'Barang Uji',
      uomId: 'uom-1',
      quantity: 2,
      unitPrice: '1500',
      taxRateId: null,
    ),
  ],
  hasil: HasilKeranjang(
    lines: [
      HasilBaris(
        productId: 'product-1',
        name: 'Barang Uji',
        uomId: 'uom-1',
        quantity: 2,
        unitPrice: '1500',
        lineSubtotal: '3000',
        taxAmount: '0',
        lineTotal: '3000',
        taxRateId: null,
      ),
    ],
    subtotal: '3000',
    taxTotal: '0',
    grandTotal: '3000',
    itemCount: 2,
  ),
  metode: MetodeBayar(id: 'cash-1', nama: 'Tunai', memberiKembalian: true),
  diserahkan: '5000',
  kembalian: '2000',
  jenisPesanan: 'Eceran',
  catatan: 'Uji luring',
);

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

  test('transaksi putus jaringan tersimpan lalu dikirim sekali saat reconnect',
      () async {
    final database = InventoryLocalDatabase(NativeDatabase.memory());
    addTearDown(database.close);
    final client = _ClientLuring();
    final mesin = KasirLuringEngine(
      client: client,
      sesi: _sesi,
      identitas: const IdentitasMesin(id: 'device-uat', nama: 'Kasir UAT'),
      katalogSyncedAt: '2026-08-10T00:00:00Z',
      database: database,
    );
    await mesin.siapkan();
    expect(mesin.luringTersedia, isTrue);

    client.tersambung = false;
    final receipt = await mesin.bukukan(_transaksi);

    expect(receipt, 'UAT-0001');
    expect(await mesin.jumlahTertunda(), 1);
    expect(client.terkirim, isEmpty);

    client.tersambung = true;
    expect(await mesin.sinkronkan(), 1);
    expect(await mesin.jumlahTertunda(), 0);
    expect(client.terkirim, hasLength(1));
    expect(client.terkirim.single['receiptNumber'], 'UAT-0001');
    expect(client.terkirim.single['offlineId'], startsWith('device-uat-'));

    // Item sudah completed; sinkron berikutnya tidak boleh mengirim duplikat.
    expect(await mesin.sinkronkan(), 0);
    expect(client.terkirim, hasLength(1));
  });
}
