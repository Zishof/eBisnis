/// Mesin kasir luring: membangun transaksi sepenuhnya di mesin ini ketika
/// peladen tidak terjangkau, menyimpannya di antrean lokal dengan kunci
/// idempotensi yang stabil, dan mengirimkannya begitu tersambung kembali.
///
/// ## Celah yang ditutup berkas ini
///
/// `PosApiClient.bukukan()` sendirian mengirim SETIAP percobaan sebagai
/// permintaan baru -- kunci idempotensi pembayarannya dibuat dari jam saat
/// itu (`DateTime.now().microsecondsSinceEpoch`), bukan disimpan. Retry
/// setelah jaringan gagal menjadi transaksi baru di mata peladen, bukan
/// pengiriman ulang yang aman. Peladen sudah punya jalur luring yang benar
/// (`PosOfflineService.terima`, idempoten pada `offlineId`, menahan transaksi
/// yang perlu diperiksa manusia di karantina alih-alih menolak atau menerima
/// diam-diam dengan angka lain) -- yang belum ada adalah klien Flutter yang
/// benar-benar memakainya.
///
/// ## Batasan yang disengaja
///
/// Mode farmasi (resep/racikan/produksi) TIDAK ditawarkan jalur luring: jalur
/// itu memerlukan pemilihan lot dan validasi farmasi yang harus dijawab
/// peladen, dan kontrak `TransaksiLuringDto` pada peladen belum membawa
/// field-field itu. Transaksi farmasi tetap memakai `PosApiClient.bukukan()`
/// apa adanya -- tidak diperbaiki, tidak diperburuk oleh berkas ini.
///
/// Jatuh ke jalur luring dari kegagalan jaringan yang REAKTIF (di tengah
/// transaksi daring yang sudah berjalan) sengaja dibatasi hanya pada
/// `SocketException` -- sinyal terkuat bahwa permintaannya sama sekali tidak
/// tersambung ke peladen, bukan sekadar lambat menjawab. `TimeoutException`
/// dan `HttpException` tetap dilempar apa adanya seperti sebelum berkas ini
/// ada: permintaan itu mungkin sudah diproses peladen, dan mengantrekan
/// salinannya berisiko membukukannya dua kali.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:drift/drift.dart';
import 'package:drift/native.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../api/pos_api.dart';
import '../aturan/koneksi.dart';
import '../inventory/inventory_local_database.dart';
import '../layar/sumber.dart';
import 'identitas_mesin.dart';

class KasirLuringEngine {
  KasirLuringEngine({
    required this.client,
    required this.sesi,
    required this.identitas,
    required this.katalogSyncedAt,
    InventoryLocalDatabase? database,
  }) : _database = database ?? _bukaDatabase();

  final PosApiClient client;
  final SesiKasirApi sesi;
  final IdentitasMesin identitas;

  /// `SumberKatalogApi.generatedAt` -- kapan salinan harga yang dipakai
  /// perhitungan luring ini diambil. Ikut terkirim pada setiap transaksi
  /// luring: itulah yang dijelaskan peladen pada pemeriksa ketika harga struk
  /// berbeda dari hitungan peladen.
  final String katalogSyncedAt;

  final InventoryLocalDatabase _database;

  /// Menyiapkan mesin kasir luring: memuat identitas permanen mesin ini dan
  /// memesan/memuat jatah nomor struk selagi (mudah-mudahan) masih daring.
  ///
  /// Tidak pernah melempar. Kegagalan mengambil direktori data aplikasi atau
  /// identitas mesin (kanal platform `path_provider` belum tersedia,
  /// penyimpanan tidak dapat diakses) menghasilkan mesin lewat
  /// [KasirLuringEngine.takTersedia] -- sama seperti keadaan sebelum mesin
  /// ini ada, bukan galat yang menghentikan kasir masuk sama sekali.
  static Future<KasirLuringEngine> buat({
    required PosApiClient client,
    required SesiKasirApi sesi,
    required String katalogSyncedAt,
  }) async {
    try {
      final direktori = await getApplicationSupportDirectory();
      final identitas = await IdentitasBerkas(direktori).muat();
      final mesin = KasirLuringEngine(
        client: client,
        sesi: sesi,
        identitas: identitas,
        katalogSyncedAt: katalogSyncedAt,
      );
      await mesin.siapkan();
      return mesin;
    } on Object {
      return KasirLuringEngine.takTersedia(
        client: client,
        sesi: sesi,
        katalogSyncedAt: katalogSyncedAt,
      );
    }
  }

  /// Mesin yang tidak pernah menawarkan penjualan luring. Dipakai saat
  /// prasyarat [buat] (direktori data aplikasi, identitas mesin) tak
  /// terjangkau -- database in-memory di sini tidak pernah benar-benar
  /// dipakai (tidak ada yang menyetel [_jatah]), tetapi disetel eksplisit
  /// tetap saja supaya pemanggil [sinkronkan]/[jumlahTertunda] di masa depan
  /// pada mesin ini tidak mewarisi kegagalan `path_provider` yang sama.
  factory KasirLuringEngine.takTersedia({
    required PosApiClient client,
    required SesiKasirApi sesi,
    required String katalogSyncedAt,
  }) {
    return KasirLuringEngine(
      client: client,
      sesi: sesi,
      identitas: IdentitasMesin(id: buatIdMesin(), nama: namaMesinBawaan),
      katalogSyncedAt: katalogSyncedAt,
      database: InventoryLocalDatabase(NativeDatabase.memory()),
    );
  }

  _JatahLokal? _jatah;

  int? _lastReachableAt;
  int? _lastAttemptAt;
  bool? _lastAttemptOk;

  /// Basis data lokal terpisah dari milik fitur Inventory (`ebisnis_pos_luring.sqlite`,
  /// bukan `ebisnis_inventory_sales.sqlite`) -- keduanya dapat berjalan pada
  /// perangkat yang sama sebagai instalasi berbeda, dan antrean salah satu
  /// tidak boleh terputar ulang lewat sesi masuk milik yang lain. Kelas tabel
  /// (`InventoryOutboxItems`) dipakai apa adanya karena strukturnya sudah
  /// generik (method+path+payload+status+percobaan), bukan karena datanya
  /// tentang inventory.
  static InventoryLocalDatabase _bukaDatabase() {
    return InventoryLocalDatabase(LazyDatabase(() async {
      final directory = await getApplicationSupportDirectory();
      final file = File(p.join(directory.path, 'ebisnis_pos_luring.sqlite'));
      return NativeDatabase.createInBackground(file);
    }));
  }

  RingkasanKoneksi get status => nilaiKoneksi(
        browserOnline: true,
        lastReachableAt: _lastReachableAt,
        lastAttemptAt: _lastAttemptAt,
        lastAttemptOk: _lastAttemptOk,
        now: DateTime.now().millisecondsSinceEpoch,
      );

  /// Benar bila penjualan luring dapat ditawarkan pada mesin ini sekarang:
  /// tenant mengizinkannya (dibuktikan dari jatah yang berhasil dimuat/dipesan)
  /// dan jatahnya belum habis.
  bool get luringTersedia =>
      _jatah != null && _jatah!.nextNumber <= _jatah!.toNumber;

  /// Dipanggil sekali setelah masuk, selagi (mudah-mudahan) masih daring.
  /// Memuat jatah nomor struk yang sudah aktif, atau memesan yang baru bila
  /// belum ada/sudah habis. Kegagalan di sini TIDAK dilempar ke pemanggil --
  /// penjualan luring hanya menjadi tidak tersedia pada sesi ini, sama seperti
  /// keadaan sebelum mesin ini ada.
  Future<void> siapkan() async {
    try {
      final aktif = await client.jatahStrukAktif(sesi.terminalId);
      if (aktif != null) {
        final j = _JatahLokal.dariJson(aktif);
        if (j.nextNumber <= j.toNumber) {
          _jatah = j;
          await _simpanJatah(j);
          _tandaiTerjangkau();
          return;
        }
      }
      final baru = await client.pesanJatahStruk(sesi.terminalId);
      _jatah = _JatahLokal.dariJson(baru);
      await _simpanJatah(_jatah!);
      _tandaiTerjangkau();
    } on Object {
      _tandaiGagal();
      // Jaringan gagal saat menyiapkan jatah -- coba pakai jatah tersimpan
      // dari sesi sebelumnya (mis. aplikasi baru dibuka ulang selagi luring).
      // Bila tidak ada, penjualan luring memang tidak tersedia sesi ini.
      //
      // Percobaan cadangan ini sendiri bisa gagal (mis. basis data lokal pun
      // tak terjangkau) -- dibungkus terpisah supaya kegagalan itu juga
      // tidak lolos ke pemanggil, menepati janji dokumentasi fungsi ini.
      try {
        _jatah = await _muatJatahTersimpan();
      } on Object {
        _jatah = null;
      }
    }
  }

  Future<void> _simpanJatah(_JatahLokal j) =>
      _database.putCache('pos_receipt_block', j.keJson());

  Future<_JatahLokal?> _muatJatahTersimpan() async {
    final tersimpan = await _database.getCache('pos_receipt_block');
    if (tersimpan == null) return null;
    final j = _JatahLokal.dariJson(tersimpan);
    return j.nextNumber <= j.toNumber ? j : null;
  }

  void _tandaiTerjangkau() {
    final now = DateTime.now().millisecondsSinceEpoch;
    _lastAttemptAt = now;
    _lastReachableAt = now;
    _lastAttemptOk = true;
  }

  void _tandaiGagal() {
    _lastAttemptAt = DateTime.now().millisecondsSinceEpoch;
    _lastAttemptOk = false;
  }

  /// Implementasi [PembukuanKasir].
  Future<String?> bukukan(TransaksiKasir transaksi) async {
    final bisaLuring = transaksi.modeFarmasi == null && luringTersedia;

    // Sudah diketahui luring/terbatas dari percobaan sebelumnya di sesi ini
    // -- jangan memaksa kasir menunggu waktu habis jaringan yang sudah
    // diketahui mati.
    if (bisaLuring && status.queueing) {
      return _bukukanLuring(transaksi);
    }

    try {
      final hasil = await client.bukukan(sesi: sesi, transaksi: transaksi);
      _tandaiTerjangkau();
      return hasil;
    } on SocketException {
      _tandaiGagal();
      if (bisaLuring) return _bukukanLuring(transaksi);
      rethrow;
    } on TimeoutException {
      _tandaiGagal();
      rethrow;
    } on HttpException {
      _tandaiGagal();
      rethrow;
    }
  }

  Future<String> _bukukanLuring(TransaksiKasir transaksi) async {
    final jatah = _jatah;
    if (jatah == null) {
      throw const PosApiException(
        'Jaringan tidak tersambung dan belum ada jatah nomor struk luring pada mesin ini. '
        'Sambungkan ke internet sebelum melanjutkan.',
      );
    }
    if (jatah.nextNumber > jatah.toNumber) {
      throw const PosApiException(
        'Jatah nomor struk luring pada mesin ini sudah habis. Sambungkan ke internet '
        'untuk memesan jatah baru sebelum melanjutkan.',
      );
    }

    final nomor = jatah.nextNumber;
    final nomorStruk =
        '${jatah.prefix}${nomor.toString().padLeft(jatah.padding, '0')}';
    _jatah = jatah.denganNomorBerikutnya(nomor + 1);
    await _simpanJatah(_jatah!);

    final offlineId =
        '${identitas.id}-${DateTime.now().microsecondsSinceEpoch}';
    final payload = <String, Object?>{
      'offlineId': offlineId,
      'outletId': sesi.outletId,
      'terminalId': sesi.terminalId,
      'shiftId': sesi.shiftId,
      'businessDate': sesi.businessDate,
      'receiptNumber': nomorStruk,
      'occurredAt': DateTime.now().toUtc().toIso8601String(),
      'currencyCode': sesi.currency,
      'subtotal': transaksi.hasil.subtotal,
      'taxTotal': transaksi.hasil.taxTotal,
      'grandTotal': transaksi.hasil.grandTotal,
      'changeTotal': transaksi.kembalian,
      'catalogSyncedAt': katalogSyncedAt,
      'localHash': null,
      // Dibangun manual, BUKAN `HasilBaris.toJson()`: DTO peladen
      // (`BarisLuringDto`) tidak mengenal field `name`, dan validasinya
      // menolak seluruh permintaan yang membawa field tak dikenal
      // (`forbidNonWhitelisted`, lihat main.ts).
      'lines': transaksi.hasil.lines
          .map((l) => {
                'productId': l.productId,
                'uomId': l.uomId,
                'quantity': l.quantity,
                'unitPrice': l.unitPrice,
                'lineSubtotal': l.lineSubtotal,
                'taxAmount': l.taxAmount,
                'lineTotal': l.lineTotal,
                'taxRateId': l.taxRateId,
              })
          .toList(),
      'payments': [
        {
          'paymentMethodId': transaksi.metode.id,
          'amount': transaksi.hasil.grandTotal,
          'tenderedAmount': transaksi.metode.memberiKembalian
              ? transaksi.diserahkan
              : transaksi.hasil.grandTotal,
          'reference': null,
        },
      ],
    };

    // Disimpan SEBELUM percobaan kirim apa pun: `offlineId` inilah kunci
    // idempotensi yang tetap sama pada setiap percobaan berikutnya, baik
    // dari percobaan langsung di bawah ini maupun dari `sinkronkan()` nanti.
    await _database.enqueue(
      eventId: offlineId,
      method: 'POST',
      path: '/pos/offline/sales',
      payload: payload,
    );

    try {
      await client.kirimTransaksiLuring(payload);
      await _database.markCompleted(offlineId);
      _tandaiTerjangkau();
    } on Object catch (error) {
      _tandaiGagal();
      final baris = await _cariOutbox(offlineId);
      if (baris != null) await _database.markFailed(baris, error);
      // Tidak dilempar ke pemanggil: transaksinya sudah tersimpan aman di
      // antrean lokal dan akan dicoba lagi lewat `sinkronkan()`. Kasir sudah
      // punya nomor struk yang sah untuk dicetak.
    }

    return nomorStruk;
  }

  Future<InventoryOutboxItem?> _cariOutbox(String eventId) async {
    final rows = await _database.pendingOutbox();
    for (final row in rows) {
      if (row.eventId == eventId) return row;
    }
    return null;
  }

  /// Mengirim ulang transaksi yang masih tertahan di antrean. Dipanggil dari
  /// pemeriksa sambungan berkala atau tombol sinkronisasi manual.
  Future<int> sinkronkan() async {
    // Tombol sinkronisasi adalah permintaan eksplisit operator sesudah jaringan
    // pulih. Ia tidak boleh diam-diam melewati item FAILED hanya karena jadwal
    // backoff otomatisnya belum jatuh tempo.
    final pending = await _database.pendingOutbox(ignoreSchedule: true);
    var terkirim = 0;
    for (final item in pending) {
      try {
        await client.kirimTransaksiLuring(
          jsonDecode(item.payload) as Map<String, Object?>,
        );
        await _database.markCompleted(item.eventId);
        terkirim += 1;
        _tandaiTerjangkau();
      } on Object catch (error) {
        await _database.markFailed(item, error);
        _tandaiGagal();
        // Berhenti pada kegagalan pertama: item berikutnya kemungkinan gagal
        // karena sebab yang sama, dan mencobanya satu per satu hanya
        // memperpanjang waktu tunggu tanpa menambah informasi.
        break;
      }
    }
    return terkirim;
  }

  Future<int> jumlahTertunda() => _database.pendingCount();
}

class _JatahLokal {
  const _JatahLokal({
    required this.prefix,
    required this.padding,
    required this.fromNumber,
    required this.toNumber,
    required this.nextNumber,
  });

  final String prefix;
  final int padding;
  final int fromNumber;
  final int toNumber;
  final int nextNumber;

  factory _JatahLokal.dariJson(Map<String, Object?> json) => _JatahLokal(
        prefix: (json['prefix'] ?? '').toString(),
        padding: _keInt(json['padding']) ?? 6,
        fromNumber: _keInt(json['fromNumber']) ?? 0,
        toNumber: _keInt(json['toNumber']) ?? 0,
        nextNumber:
            _keInt(json['nextNumber']) ?? _keInt(json['fromNumber']) ?? 0,
      );

  _JatahLokal denganNomorBerikutnya(int n) => _JatahLokal(
        prefix: prefix,
        padding: padding,
        fromNumber: fromNumber,
        toNumber: toNumber,
        nextNumber: n,
      );

  Map<String, Object?> keJson() => {
        'prefix': prefix,
        'padding': padding,
        'fromNumber': fromNumber,
        'toNumber': toNumber,
        'nextNumber': nextNumber,
      };
}

int? _keInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
