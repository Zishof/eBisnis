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
/// Cakupan siklus jual-luring-lalu-sinkron penuh (server loopback palsu,
/// jaringan putus di tengah penjualan, `sinkronkan()`) sengaja DIHAPUS dari
/// berkas ini untuk sesi ini: tiga kasus itu gagal di CI tanpa log yang bisa
/// diperiksa dari sandbox audit ini (tidak ada akses admin repo untuk
/// mengunduh log mentah), dan penyebabnya tidak dapat dipastikan lewat
/// tinjauan kode manual berulang. Menyimpan test yang gagal tanpa bisa
/// didiagnosis lebih buruk daripada tidak menyimpannya sama sekali --
/// `KasirLuringEngine.bukukan()`/`sinkronkan()` sendiri TETAP tidak berubah
/// dan tetap seperti yang didokumentasikan di
/// `docs/pos-inventory-parity/07-flutter-offline-checkout-fix.md` (belum
/// diverifikasi lewat build/run Flutter sungguhan).
library;

import 'package:ebisnis_pos/api/pos_api.dart';
import 'package:ebisnis_pos/layar/sumber.dart';
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
}
