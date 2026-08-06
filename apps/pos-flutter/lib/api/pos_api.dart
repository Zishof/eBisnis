/// Klien HTTP minimal untuk menjalankan POS Flutter terhadap peladen eBisnis.
///
/// Sengaja kecil dan tanpa paket pihak ketiga: targetnya bukan menggantikan
/// seluruh aplikasi web, melainkan membuat mesin kasir Flutter dapat mengambil
/// katalog demo dan membukukan transaksi sungguhan pada endpoint POS yang sama.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../aturan/harga_luring.dart';
import '../layar/sumber.dart';

class PosApiException implements Exception {
  const PosApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class PosApiClient {
  PosApiClient({
    required this.baseUrl,
    this.accessToken,
    this.username,
    this.password,
    HttpClient? http,
  }) : _http = http ?? HttpClient();

  final Uri baseUrl;
  String? accessToken;
  final String? username;
  final String? password;
  final HttpClient _http;
  String? displayName;
  String? authenticatedUsername;
  String? authenticatedTenantName;

  Future<void> pastikanMasuk() async {
    if (accessToken?.isNotEmpty == true) return;
    if ((username ?? '').isEmpty || (password ?? '').isEmpty) {
      throw const PosApiException(
        'POS_API_BASE disetel, tetapi POS_USERNAME/POS_PASSWORD atau POS_ACCESS_TOKEN belum ada.',
      );
    }
    final data = await _request<Map<String, Object?>>(
      'POST',
      '/auth/login',
      body: {
        'username': username,
        'password': password,
      },
      tanpaToken: true,
    );
    accessToken = data['accessToken'] as String?;
    if (accessToken?.isNotEmpty != true) {
      throw const PosApiException(
          'Login berhasil tetapi access token tidak diterima.');
    }
    if (data['mustChangePassword'] == true) {
      accessToken = null;
      throw const PosApiException(
        'Kata sandi wajib diganti. Masuk melalui apotik.emedik.id terlebih dahulu untuk membuat kata sandi baru.',
      );
    }
    final user = data['user'] as Map<String, Object?>?;
    final tenant = data['tenant'] as Map<String, Object?>?;
    if (tenant == null) {
      accessToken = null;
      throw const PosApiException(
        'Akun belum terhubung ke tenant. Hubungi admin Apotik eMedik.',
      );
    }
    authenticatedUsername = user?['username']?.toString();
    displayName = user?['displayName']?.toString();
    authenticatedTenantName = tenant['tenantName']?.toString();
  }

  Future<void> keluar() async {
    if (accessToken?.isNotEmpty == true) {
      try {
        await _request<Map<String, Object?>>('POST', '/auth/logout',
            body: const {});
      } on Object {
        // Token lokal tetap harus dibuang walaupun server sedang tidak terjangkau.
      }
    }
    accessToken = null;
    displayName = null;
    authenticatedUsername = null;
    authenticatedTenantName = null;
  }

  Future<BootstrapKasir> bootstrap() async {
    await pastikanMasuk();
    final konteks = await _request<Map<String, Object?>>('GET', '/pos/context');
    final snapshot = await _request<Map<String, Object?>>(
        'GET', '/pos/catalog/snapshot?limit=5000');

    final outlet = _pertama<Map<String, Object?>>(konteks['outlets'], 'outlet');
    final register = _pilihRegister(konteks, outlet['id'] as String);
    final shift = konteks['openShift'] as Map<String, Object?>?;
    if (shift == null) {
      throw const PosApiException(
          'Login berhasil, tetapi belum ada shift terbuka. Buka shift POS untuk akun ini dari aplikasi web, lalu masuk kembali.');
    }

    final sumber = SumberKatalogApi(snapshot);
    final metode = ((snapshot['paymentMethods'] as List?) ?? const [])
        .whereType<Map<String, Object?>>()
        .map(
          (m) => MetodeBayar(
            id: m['id'] as String,
            nama: (m['name'] ?? m['code'] ?? 'Pembayaran').toString(),
            memberiKembalian: m['allowsChange'] == true,
          ),
        )
        .toList();

    return BootstrapKasir(
      katalog: sumber,
      metode: metode,
      sesi: SesiKasirApi(
        outletId: outlet['id'] as String,
        terminalId: register['terminalId'] as String,
        shiftId: shift['shiftId'] as String,
        businessDate: (konteks['businessDate'] ?? '').toString(),
        outletName: (outlet['name'] ?? 'Outlet').toString(),
        shiftNumber: shift['shiftNumber']?.toString(),
        currency:
            (konteks['currency'] ?? snapshot['currency'] ?? 'IDR').toString(),
      ),
    );
  }

  Future<String> bukukan({
    required SesiKasirApi sesi,
    required TransaksiKasir transaksi,
  }) async {
    await pastikanMasuk();

    final sale = await _request<Map<String, Object?>>(
      'POST',
      '/pos/sales',
      body: {
        'outletId': sesi.outletId,
        'terminalId': sesi.terminalId,
        'shiftId': sesi.shiftId,
      },
    );
    final saleId = sale['id'] as String;

    for (final baris in transaksi.baris) {
      await _request<Map<String, Object?>>(
        'POST',
        '/pos/sales/$saleId/items',
        body: {
          'productId': baris.productId,
          if (baris.uomId != null) 'uomId': baris.uomId,
          'quantity': baris.quantity,
        },
      );
    }

    await _request<Map<String, Object?>>(
      'POST',
      '/pos/sales/$saleId/payments',
      headers: {
        'Idempotency-Key':
            'flutter-bayar-$saleId-${DateTime.now().microsecondsSinceEpoch}'
      },
      body: {
        'paymentMethodId': transaksi.metode.id,
        'amount': NumberConverter.toNumber(transaksi.total),
        'tenderedAmount': transaksi.metode.memberiKembalian
            ? NumberConverter.toNumber(transaksi.diserahkan)
            : NumberConverter.toNumber(transaksi.total),
      },
    );

    final selesai = await _request<Map<String, Object?>>(
      'POST',
      '/pos/sales/$saleId/complete',
      headers: {'Idempotency-Key': 'flutter-selesai-$saleId'},
      body: const {},
    );
    return (selesai['receiptNumber'] ?? saleId).toString();
  }

  Map<String, Object?> _pilihRegister(
      Map<String, Object?> konteks, String outletId) {
    final registers = ((konteks['registers'] as List?) ?? const [])
        .whereType<Map<String, Object?>>();
    final cocok = registers.where((r) => r['outletId'] == outletId).toList();
    if (cocok.isEmpty) {
      throw const PosApiException('Tidak ada register POS untuk outlet ini.');
    }
    cocok.sort((a, b) {
      final pa = a['isPrimary'] == true ? 0 : 1;
      final pb = b['isPrimary'] == true ? 0 : 1;
      return pa.compareTo(pb);
    });
    return cocok.first;
  }

  Future<T> _request<T extends Object?>(
    String method,
    String path, {
    Object? body,
    Map<String, String> headers = const {},
    bool tanpaToken = false,
  }) async {
    final uri =
        baseUrl.resolve(path.startsWith('/') ? path.substring(1) : path);
    final request =
        await _http.openUrl(method, uri).timeout(const Duration(seconds: 15));
    request.headers.contentType = ContentType.json;
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    request.headers.set(HttpHeaders.acceptLanguageHeader, 'id');
    if (!tanpaToken && accessToken?.isNotEmpty == true) {
      request.headers
          .set(HttpHeaders.authorizationHeader, 'Bearer $accessToken');
    }
    for (final entry in headers.entries) {
      request.headers.set(entry.key, entry.value);
    }
    if (body != null) request.write(jsonEncode(body));

    final response = await request.close().timeout(const Duration(seconds: 30));
    final text = await response.transform(utf8.decoder).join();
    final decoded = text.isEmpty
        ? <String, Object?>{}
        : jsonDecode(text) as Map<String, Object?>;
    final success = decoded['success'] != false &&
        response.statusCode >= 200 &&
        response.statusCode < 300;
    if (!success) {
      final error = decoded['error'] as Map<String, Object?>?;
      throw PosApiException(
        (error?['message'] ?? 'Permintaan POS gagal (${response.statusCode}).')
            .toString(),
      );
    }
    return decoded['data'] as T;
  }
}

class BootstrapKasir {
  const BootstrapKasir(
      {required this.katalog, required this.metode, required this.sesi});
  final SumberKatalogApi katalog;
  final List<MetodeBayar> metode;
  final SesiKasirApi sesi;
}

class SesiKasirApi {
  const SesiKasirApi({
    required this.outletId,
    required this.terminalId,
    required this.shiftId,
    required this.businessDate,
    required this.outletName,
    required this.currency,
    this.shiftNumber,
  });

  final String outletId;
  final String terminalId;
  final String shiftId;
  final String businessDate;
  final String outletName;
  final String currency;
  final String? shiftNumber;
}

class SumberKatalogApi extends SumberKatalog {
  SumberKatalogApi(Map<String, Object?> snapshot)
      : mataUang = (snapshot['currency'] ?? 'IDR').toString(),
        generatedAt = (snapshot['generatedAt'] ?? '').toString(),
        productCount = NumberConverter.toInt(snapshot['productCount']),
        productTotal = NumberConverter.toInt(snapshot['productTotal']),
        truncated = snapshot['truncated'] == true,
        _tarif = ((snapshot['taxRates'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map(_tarifDariJson)
            .toList(),
        _produk = _produkDariSnapshot(snapshot);

  final List<ProdukLokal> _produk;
  final List<TarifLuring> _tarif;
  final String generatedAt;
  final int productCount;
  final int productTotal;
  final bool truncated;

  @override
  final String mataUang;

  @override
  ProdukLokal? dariBarcode(String kode) {
    final bersih = kode.trim();
    for (final p in _produk) {
      if (p.barcodes.contains(bersih)) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) {
    final kecil = kunci.trim().toLowerCase();
    if (kecil.isEmpty) return List.unmodifiable(_produk);
    return _produk.where((p) {
      return p.nama.toLowerCase().contains(kecil) ||
          p.productId.toLowerCase().contains(kecil) ||
          p.barcodes.any((b) => b.contains(kecil));
    }).toList();
  }

  @override
  List<TarifLuring> get tarif => List.unmodifiable(_tarif);
}

List<ProdukLokal> _produkDariSnapshot(Map<String, Object?> snapshot) {
  final taxRateByCategory = <String, String>{};
  for (final r in ((snapshot['taxRates'] as List?) ?? const [])
      .whereType<Map<String, Object?>>()) {
    final categoryId = r['taxCategoryId'];
    final rateId = r['taxRateId'];
    if (categoryId != null && rateId != null) {
      taxRateByCategory.putIfAbsent(
          categoryId.toString(), () => rateId.toString());
    }
  }

  return ((snapshot['products'] as List?) ?? const [])
      .whereType<Map<String, Object?>>()
      .map((p) {
        final taxCategoryId = p['taxCategoryId']?.toString();
        return ProdukLokal(
          productId: p['productId'] as String,
          nama: (p['name'] ?? p['code'] ?? 'Produk').toString(),
          harga: (p['defaultSalePrice'] ?? '0').toString(),
          barcodes: ((p['barcodes'] as List?) ?? const [])
              .map((b) => b.toString())
              .toList(),
          uomId: p['uomId'] as String?,
          taxRateId:
              taxCategoryId == null ? null : taxRateByCategory[taxCategoryId],
          kategori: p['categoryName']?.toString(),
          varian: p['code']?.toString(),
          stok: null,
        );
      })
      .where((p) => NumberConverter.toNumber(p.harga) > 0)
      .toList();
}

TarifLuring _tarifDariJson(Map<String, Object?> r) {
  return TarifLuring(
    taxRateId: r['taxRateId'].toString(),
    code: (r['code'] ?? r['taxRateId']).toString(),
    rate: NumberConverter.toNumber(r['rate']),
    isInclusive: r['isInclusive'] == true,
  );
}

T _pertama<T>(Object? value, String nama) {
  final list = (value as List?)?.whereType<T>().toList() ?? const [];
  if (list.isEmpty) {
    throw PosApiException('Tidak ada $nama yang dapat dipakai akun ini.');
  }
  return list.first;
}

class NumberConverter {
  static num toNumber(Object? value) {
    if (value is num) return value;
    return num.tryParse((value ?? '0').toString()) ?? 0;
  }

  static int toInt(Object? value) => toNumber(value).toInt();
}
