/// Klien API Aplikasi Warga Desa.
///
/// ## Penyimpanan token mengikuti ADR-006, dengan satu perbedaan
///
/// Web menyimpan refresh token pada `sessionStorage`. Ponsel tidak punya
/// padanannya: aplikasi ditutup dan dibuka berkali-kali sehari, dan warga tidak
/// akan memakai aplikasi yang meminta kata sandi setiap kali.
///
/// Karena itu refresh token disimpan pada **penyimpanan aman sistem** —
/// Keystore pada Android, Keychain pada iOS. **Bukan** `SharedPreferences`:
/// di sana ia berkas biasa di dalam sandbox aplikasi, dan sandbox itu terbuka
/// pada perangkat yang di-root — yang di desa jauh lebih banyak daripada yang
/// diperkirakan.
///
/// Access token tetap **hanya di memori**, sama seperti web. Ia hidup beberapa
/// menit; menuliskannya ke disk menukar keamanan dengan kenyamanan yang tidak
/// dirasakan siapa pun.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

/// Galat yang membawa pesan dari peladen apa adanya.
///
/// Pesan peladen ditulis untuk warga — "Belanja melampaui pagu", "Akun Anda
/// belum tertaut" — dan menggantinya dengan "Terjadi kesalahan" pada aplikasi
/// membuang satu-satunya keterangan yang berguna.
class ApiError implements Exception {
  ApiError(this.code, this.message, this.status);
  final String code;
  final String message;
  final int status;

  @override
  String toString() => message;

  /// Benar bila galatnya karena jaringan, bukan karena penolakan peladen.
  bool get karenaJaringan => status == 0;
}

/// Hasil yang membedakan "belum ada isi" dari "gagal memuat".
///
/// Aturan yang sama dengan situs desa: warga yang melihat "belum ada berita"
/// padahal servernya bermasalah akan berhenti membukanya lagi.
class Hasil<T> {
  const Hasil.isi(this.data)
      : galat = null,
        sedangMemuat = false;
  const Hasil.galat(this.galat)
      : data = null,
        sedangMemuat = false;
  const Hasil.memuat()
      : data = null,
        galat = null,
        sedangMemuat = true;

  final T? data;
  final ApiError? galat;
  final bool sedangMemuat;

  bool get berhasil => galat == null && !sedangMemuat;
}

class ApiClient {
  ApiClient({required this.baseUrl, FlutterSecureStorage? penyimpanan, http.Client? http_})
      : _aman = penyimpanan ?? const FlutterSecureStorage(),
        _http = http_ ?? http.Client();

  final String baseUrl;
  final FlutterSecureStorage _aman;
  final http.Client _http;

  static const _kunciRefresh = 'ebisnis.village.refresh';

  /// Hanya di memori. Tidak pernah menyentuh disk.
  String? _accessToken;

  String? get accessToken => _accessToken;
  bool get sudahMasuk => _accessToken != null;

  Future<String?> get refreshToken => _aman.read(key: _kunciRefresh);

  Future<void> _simpanRefresh(String? token) async {
    if (token == null) {
      await _aman.delete(key: _kunciRefresh);
    } else {
      await _aman.write(key: _kunciRefresh, value: token);
    }
  }

  // --- Masuk dan keluar -----------------------------------------------------

  Future<void> masuk(String username, String password) async {
    final r = await _kirim('POST', '/auth/login', body: {
      'username': username,
      'password': password,
    }, denganToken: false);
    _accessToken = r['accessToken'] as String?;
    await _simpanRefresh(r['refreshToken'] as String?);
  }

  /// Memulihkan sesi dari refresh token yang tersimpan.
  ///
  /// Dipanggil saat aplikasi dibuka. Gagal berarti warga harus masuk lagi —
  /// dan itu tidak dianggap galat yang perlu ditampilkan.
  Future<bool> pulihkanSesi() async {
    final token = await refreshToken;
    if (token == null) return false;
    try {
      final r = await _kirim('POST', '/auth/refresh',
          body: {'refreshToken': token}, denganToken: false);
      _accessToken = r['accessToken'] as String?;
      // Refresh token dirotasi setiap kali dipakai; yang lama tidak berlaku
      // lagi. Menyimpan yang lama berarti pemulihan berikutnya gagal.
      await _simpanRefresh(r['refreshToken'] as String?);
      return _accessToken != null;
    } on ApiError {
      await _simpanRefresh(null);
      return false;
    }
  }

  Future<void> keluar() async {
    _accessToken = null;
    await _simpanRefresh(null);
  }

  // --- Pemanggilan ----------------------------------------------------------

  Future<Map<String, dynamic>> get(String jalur) async => _kirim('GET', jalur);

  Future<Map<String, dynamic>> post(String jalur, Map<String, dynamic> body) async =>
      _kirim('POST', jalur, body: body);

  Future<Map<String, dynamic>> hapus(String jalur) async => _kirim('DELETE', jalur);

  /// Daftar. Envelope peladen membungkus larik pada `data`.
  Future<List<dynamic>> getList(String jalur) async {
    final r = await _kirim('GET', jalur);
    final d = r['__list'];
    return d is List ? d : const [];
  }

  Future<Map<String, dynamic>> _kirim(
    String metode,
    String jalur, {
    Map<String, dynamic>? body,
    bool denganToken = true,
  }) async {
    final uri = Uri.parse('$baseUrl$jalur');
    final headers = {
      'Content-Type': 'application/json',
      'Accept-Language': 'id',
      if (denganToken && _accessToken != null) 'Authorization': 'Bearer $_accessToken',
    };

    http.Response res;
    try {
      res = switch (metode) {
        'POST' => await _http
            .post(uri, headers: headers, body: jsonEncode(body ?? {}))
            .timeout(const Duration(seconds: 20)),
        'DELETE' => await _http.delete(uri, headers: headers).timeout(const Duration(seconds: 20)),
        _ => await _http.get(uri, headers: headers).timeout(const Duration(seconds: 20)),
      };
    } on SocketException {
      // Sinyal di desa putus-putus. Galat jaringan dibedakan dari penolakan
      // peladen supaya layar dapat menawarkan "coba lagi" alih-alih menyuruh
      // warga ke kantor desa.
      throw ApiError('JARINGAN', 'Tidak ada sambungan. Periksa sinyal Anda lalu coba lagi.', 0);
    } catch (_) {
      throw ApiError('JARINGAN', 'Sambungan terputus. Coba lagi sebentar lagi.', 0);
    }

    // Access token kedaluwarsa: sekali perpanjang, lalu ulangi. Bila gagal
    // lagi, warga memang harus masuk kembali.
    if (res.statusCode == 401 && denganToken && await refreshToken != null) {
      if (await pulihkanSesi()) return _kirim(metode, jalur, body: body);
    }

    final Map<String, dynamic> payload;
    try {
      final d = jsonDecode(res.body);
      payload = d is Map<String, dynamic> ? d : {'data': d};
    } catch (_) {
      throw ApiError('GALAT', 'Jawaban peladen tidak dikenali.', res.statusCode);
    }

    if (res.statusCode >= 400 || payload['success'] == false) {
      final e = payload['error'];
      throw ApiError(
        (e is Map && e['code'] is String) ? e['code'] as String : 'GALAT',
        (e is Map && e['message'] is String)
            ? e['message'] as String
            : 'Terjadi kesalahan pada peladen.',
        res.statusCode,
      );
    }

    final data = payload['data'];
    if (data is List) return {'__list': data};
    if (data is Map<String, dynamic>) return data;
    return {'data': data};
  }

  /// Mengirim isi berkas apa adanya sebagai badan permintaan.
  ///
  /// Bukan multipart dan bukan base64. Base64 menaikkan ukuran kiriman
  /// sepertiga — pada sambungan desa yang tersendat, sepertiga itu terasa —
  /// dan multipart menambah pustaka di kedua sisi hanya untuk membungkus satu
  /// berkas.
  ///
  /// Tenggangnya jauh lebih panjang daripada pemanggilan biasa: foto delapan
  /// megabita pada sinyal lemah membutuhkan menit, bukan detik. Memutusnya pada
  /// detik kedua puluh berarti unggahan tidak pernah berhasil justru di tempat
  /// yang paling membutuhkannya.
  Future<Map<String, dynamic>> unggahBiner(
    String jalur,
    Uint8List isi,
    String mime, {
    Duration tenggang = const Duration(minutes: 3),
  }) async {
    final uri = Uri.parse('$baseUrl$jalur');
    final headers = {
      'Content-Type': mime,
      'Accept-Language': 'id',
      if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
    };

    http.Response res;
    try {
      res = await _http.post(uri, headers: headers, body: isi).timeout(tenggang);
    } on SocketException {
      throw ApiError('JARINGAN', 'Tidak ada sambungan. Periksa sinyal Anda lalu coba lagi.', 0);
    } catch (_) {
      throw ApiError('JARINGAN', 'Pengiriman foto terputus. Coba lagi sebentar lagi.', 0);
    }

    if (res.statusCode == 401 && await refreshToken != null) {
      // Sekali perpanjang, lalu ulangi. Foto berukuran besar kerap selesai
      // terkirim tepat setelah access token yang berumur pendek kedaluwarsa.
      if (await pulihkanSesi()) return unggahBiner(jalur, isi, mime, tenggang: tenggang);
    }

    final Map<String, dynamic> payload;
    try {
      final d = jsonDecode(res.body);
      payload = d is Map<String, dynamic> ? d : {'data': d};
    } catch (_) {
      throw ApiError('GALAT', 'Jawaban peladen tidak dikenali.', res.statusCode);
    }

    if (res.statusCode >= 400 || payload['success'] == false) {
      final e = payload['error'];
      throw ApiError(
        (e is Map && e['code'] is String) ? e['code'] as String : 'GALAT',
        (e is Map && e['message'] is String) ? e['message'] as String : 'Foto gagal dikirim.',
        res.statusCode,
      );
    }

    final data = payload['data'];
    return data is Map<String, dynamic> ? data : {'data': data};
  }
}
