/// Mengambil keterangan rilis terakhir.
///
/// ## Mengapa penguraiannya dipisahkan dari pengambilannya
///
/// Yang berbahaya di sini bukan jaringannya, melainkan keputusan berkas mana
/// yang ditawarkan untuk dipasang pada mesin kasir. Keputusan itu dibuat
/// [uraiRilisGitHub] — fungsi murni atas teks — sehingga setiap aturannya dapat
/// dibuktikan tanpa peladen, termasuk aturan yang paling tidak nyaman dicoba
/// sungguhan.
///
/// ## Yang TIDAK dilakukan klien ini
///
/// Ia tidak mengunduh, tidak memasang, dan tidak menjalankan apa pun. Ia hanya
/// memberi tahu bahwa ada versi baru dan di mana berkasnya. Mengganti berkas
/// aplikasi kasir di tengah hari kerja — apalagi otomatis — adalah tindakan yang
/// harus dipilih manusia, pada saat yang ia pilih sendiri.
library;

import 'dart:convert';
import 'dart:io';

import 'versi.dart';

/// Sumber keterangan rilis. Satu-satunya yang dituntut: sebuah [RilisTersedia],
/// atau null bila tidak dapat diperiksa.
abstract interface class SumberPembaruan {
  Future<RilisTersedia?> ambil();
}

/// Akhiran berkas pemasang untuk platform yang sedang berjalan.
///
/// Dipakai untuk memilih aset yang benar dari satu rilis yang memuat keduanya.
/// Menawarkan `.apk` kepada mesin Windows memberi kasir berkas yang tidak
/// melakukan apa-apa ketika dibuka, dan itu tampak persis seperti pembaruan yang
/// gagal.
String akhiranPemasang() {
  if (Platform.isAndroid) return '.apk';
  if (Platform.isWindows) return '.exe';
  return '';
}

/// Pola versi pada ekor sebuah tag Git.
final RegExp _polaVersiDiEkor = RegExp(r'\d+(\.\d+)*(-[0-9A-Za-z.]+)?$');

/// Mengupas awalan lingkup dari nama tag: `pos-v1.2.0` menjadi `1.2.0`.
///
/// Repo ini memuat banyak aplikasi, sehingga tagnya berlingkup (`pos-v…`) supaya
/// rilis kasir tidak tercampur dengan rilis lain. Tanpa pengupasan ini,
/// [Versi.urai] menolak seluruh tagnya dan pemeriksaan pembaruan menjawab "tidak
/// dapat diperiksa" **selamanya** — kegagalan yang tampak persis seperti
/// jaringan yang buruk, sehingga tidak pernah ditelusuri.
///
/// Pengupasannya sengaja dilakukan di sini, bukan di dalam [Versi.urai]: yang
/// terakhir itu ketat dengan sengaja, dan kelonggaran yang dipasang di sana akan
/// ikut melonggarkan perbandingan versi yang menjadi dasar keputusannya.
String bersihkanTag(String tag) {
  final cocok = _polaVersiDiEkor.firstMatch(tag.trim());
  return cocok?.group(0) ?? tag.trim();
}

/// Membaca jawaban GitHub Releases dan memutuskan aset mana yang ditawarkan.
///
/// Bentuk yang dibaca sengaja bentuk GitHub Releases, sebab itulah yang
/// dipublikasikan. Peladen eBisnis dapat meneruskan bentuk yang sama bila kelak
/// rilisnya diperantarai — satu penguraian, dua kemungkinan sumber.
///
/// Mengembalikan null, bukan melemparkan galat, untuk setiap bentuk yang tidak
/// dikenali.
RilisTersedia? uraiRilisGitHub(
  String badan, {
  required String akhiranBerkas,
  bool izinkanPratayang = false,
}) {
  if (akhiranBerkas.isEmpty) return null;

  Object? mentah;
  try {
    mentah = jsonDecode(badan);
  } catch (_) {
    return null;
  }
  if (mentah is! Map<String, dynamic>) return null;

  // Rilis draf belum terbit. Ia hanya terlihat oleh pemilik repo, dan
  // menawarkannya berarti menyodorkan berkas yang tidak dapat diunduh siapa pun
  // di gerai.
  if (mentah['draft'] == true) return null;
  if (mentah['prerelease'] == true && !izinkanPratayang) return null;

  final tag = mentah['tag_name'];
  if (tag is! String || tag.trim().isEmpty) return null;

  final aset = mentah['assets'];
  if (aset is! List) return null;

  String? unduh;
  for (final a in aset) {
    if (a is! Map<String, dynamic>) continue;
    final nama = a['name'];
    final jalur = a['browser_download_url'];
    if (nama is! String || jalur is! String) continue;
    if (!nama.toLowerCase().endsWith(akhiranBerkas.toLowerCase())) continue;

    /*
     * Alamat unduhan WAJIB https.
     *
     * Berkas yang diunduh dari sini adalah pemasang yang akan dijalankan pada
     * mesin yang memegang laci kas. Melalui http biasa, siapa pun yang berada di
     * jaringan gerai — jaringan yang sering dibagi dengan wifi tamu — dapat
     * menukarnya dengan berkas lain, dan yang tampak di layar kasir tetap
     * "pembaruan tersedia".
     */
    if (!jalur.startsWith('https://')) continue;

    unduh = jalur;
    break;
  }
  if (unduh == null) return null;

  final catatan = mentah['body'] is String ? mentah['body'] as String : null;

  return RilisTersedia(
    versi: bersihkanTag(tag),
    jalurUnduh: unduh,
    catatan: catatan,
    // Penanda dituliskan pada catatan rilis, bukan pada medan tersendiri, sebab
    // GitHub tidak punya medan untuk itu — dan yang menulis catatan rilis adalah
    // orang yang tahu apa yang ditutup versi ini.
    wajib: catatan != null && catatan.toUpperCase().contains('[WAJIB]'),
  );
}

/// Mengambil rilis terakhir lewat HTTP.
///
/// Memakai `HttpClient` bawaan, tanpa paket pihak ketiga: yang diperlukan hanya
/// satu GET dan satu batas waktu.
class SumberRilisGitHub implements SumberPembaruan {
  SumberRilisGitHub({
    required this.alamat,
    required this.akhiranBerkas,
    this.batasWaktu = const Duration(seconds: 8),
  }) : assert(
          alamat.scheme == 'https' || alamat.host == '127.0.0.1' || alamat.host == 'localhost',
          'sumber pembaruan harus https; http hanya diizinkan untuk pengujian setempat',
        );

  /// Menunjuk ke rilis terakhir sebuah repo GitHub.
  SumberRilisGitHub.repo({
    required String pemilik,
    required String repo,
    required String akhiranBerkas,
    Duration batasWaktu = const Duration(seconds: 8),
  }) : this(
          alamat: Uri.https('api.github.com', '/repos/$pemilik/$repo/releases/latest'),
          akhiranBerkas: akhiranBerkas,
          batasWaktu: batasWaktu,
        );

  final Uri alamat;
  final String akhiranBerkas;

  /// Batas waktu tiap tahap.
  ///
  /// Pendek dengan sengaja. Pemeriksaan pembaruan berjalan di belakang layar
  /// kasir yang sedang melayani antrean; yang menggantung lebih lama daripada
  /// ini lebih baik dinyatakan gagal dan dicoba lagi nanti.
  final Duration batasWaktu;

  @override
  Future<RilisTersedia?> ambil() async {
    final klien = HttpClient()..connectionTimeout = batasWaktu;
    try {
      final permintaan = await klien.getUrl(alamat).timeout(batasWaktu);
      permintaan.headers.set(HttpHeaders.acceptHeader, 'application/vnd.github+json');
      // GitHub menolak permintaan tanpa User-Agent.
      permintaan.headers.set(HttpHeaders.userAgentHeader, 'eBisnisPOS');

      final jawaban = await permintaan.close().timeout(batasWaktu);
      if (jawaban.statusCode != 200) {
        await jawaban.drain<void>();
        return null;
      }
      final badan = await jawaban.transform(utf8.decoder).join().timeout(batasWaktu);
      return uraiRilisGitHub(badan, akhiranBerkas: akhiranBerkas);
    } catch (_) {
      /*
       * Seluruh galat ditelan menjadi "tidak dapat diperiksa".
       *
       * Bukan karena galatnya tidak penting, melainkan karena tidak ada satu pun
       * di antaranya yang layak menghentikan mesin kasir: jaringan gerai putus,
       * GitHub membatasi laju, jam mesin salah sehingga sertifikat ditolak.
       * Semuanya berakhir sama bagi kasir — periksa lagi nanti.
       */
      return null;
    } finally {
      klien.close(force: true);
    }
  }
}
