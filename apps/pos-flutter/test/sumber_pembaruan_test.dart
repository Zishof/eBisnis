/// Pengujian sumber pembaruan.
///
/// Penguraiannya diuji sebagai fungsi murni, dan pengambilannya diuji terhadap
/// peladen HTTP sungguhan pada mesin yang sama — cara yang sama dengan pengujian
/// pengangkutan printer. Yang diperiksa bukan bahwa HTTP bekerja, melainkan
/// bahwa jawaban yang aneh, lambat, atau berbahaya berakhir sebagai "tidak dapat
/// diperiksa" alih-alih menjatuhkan aplikasi kasir.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:ebisnis_pos/pembaruan/pengelola_pembaruan.dart';
import 'package:ebisnis_pos/pembaruan/sumber_pembaruan.dart';
import 'package:ebisnis_pos/pembaruan/versi.dart';
import 'package:ebisnis_pos/pembaruan/versi_aplikasi.dart';
import 'package:test/test.dart';

String jawabanGitHub({
  String tag = 'v1.2.0',
  List<Map<String, String>> aset = const [
    {
      'name': 'ebisnis-pos-1.2.0-windows.exe',
      'browser_download_url': 'https://github.com/x/y/releases/download/v1.2.0/a.exe',
    },
  ],
  String body = 'Perbaikan kecil.',
  bool draft = false,
  bool prerelease = false,
}) =>
    jsonEncode({
      'tag_name': tag,
      'draft': draft,
      'prerelease': prerelease,
      'body': body,
      'assets': aset,
    });

void main() {
  group('mengurai jawaban rilis', () {
    test('aset yang cocok platform diambil', () {
      final r = uraiRilisGitHub(jawabanGitHub(), akhiranBerkas: '.exe')!;
      expect(r.versi, '1.2.0');
      expect(r.jalurUnduh, endsWith('a.exe'));
      expect(r.wajib, isFalse);
    });

    test('tag berlingkup dikupas menjadi versi yang dapat dibandingkan', () {
      /*
       * Repo ini memuat banyak aplikasi, sehingga tagnya berlingkup (`pos-v…`).
       * Tanpa pengupasan, pemeriksaan pembaruan menjawab "tidak dapat diperiksa"
       * SELAMANYA — kegagalan yang tampak persis seperti jaringan yang buruk,
       * sehingga tidak pernah ditelusuri.
       */
      expect(bersihkanTag('pos-v1.2.0'), '1.2.0');
      expect(bersihkanTag('v1.2.0'), '1.2.0');
      expect(bersihkanTag('1.2.0'), '1.2.0');
      expect(bersihkanTag('pos-v1.2.0-beta.1'), '1.2.0-beta.1');

      final r = uraiRilisGitHub(jawabanGitHub(tag: 'pos-v2.3.4'), akhiranBerkas: '.exe')!;
      expect(r.versi, '2.3.4');
      expect(
        nilaiPembaruan(versiBerjalan: '2.3.3', rilis: r).keadaan,
        KeadaanPembaruan.tersedia,
      );
    });

    test('tag tanpa angka dibiarkan apa adanya, lalu ditolak pembanding versi', () {
      // Dibiarkan, bukan ditebak: menebak "1.0.0" dari tag tanpa angka akan
      // membandingkan mesin kasir dengan versi yang tidak pernah ada.
      expect(bersihkanTag('terbaru'), 'terbaru');
      final r = uraiRilisGitHub(jawabanGitHub(tag: 'terbaru'), akhiranBerkas: '.exe')!;
      expect(
        nilaiPembaruan(versiBerjalan: '1.0.0', rilis: r).keadaan,
        KeadaanPembaruan.gagalDiperiksa,
      );
    });

    test('aset platform LAIN tidak diambil', () {
      /*
       * Satu rilis memuat .exe dan .apk sekaligus. Menawarkan .apk kepada mesin
       * Windows memberi kasir berkas yang tidak melakukan apa-apa ketika dibuka,
       * dan itu tampak persis seperti pembaruan yang gagal.
       */
      final r = uraiRilisGitHub(jawabanGitHub(), akhiranBerkas: '.apk');
      expect(r, isNull);
    });

    test('rilis yang memuat kedua platform memberi berkas yang benar pada masing-masing', () {
      final badan = jawabanGitHub(aset: const [
        {
          'name': 'ebisnis-pos-1.2.0.apk',
          'browser_download_url': 'https://github.com/x/y/releases/download/v1.2.0/a.apk',
        },
        {
          'name': 'ebisnis-pos-1.2.0-windows.exe',
          'browser_download_url': 'https://github.com/x/y/releases/download/v1.2.0/a.exe',
        },
      ]);
      expect(uraiRilisGitHub(badan, akhiranBerkas: '.exe')!.jalurUnduh, endsWith('.exe'));
      expect(uraiRilisGitHub(badan, akhiranBerkas: '.apk')!.jalurUnduh, endsWith('.apk'));
    });

    test('alamat unduhan http biasa DITOLAK', () {
      /*
       * Aturan paling penting pada berkas ini.
       *
       * Yang diunduh adalah pemasang yang akan dijalankan pada mesin yang
       * memegang laci kas. Melalui http biasa, siapa pun di jaringan gerai —
       * jaringan yang sering dibagi dengan wifi tamu — dapat menukarnya, dan yang
       * tampak di layar kasir tetap "pembaruan tersedia".
       */
      final badan = jawabanGitHub(aset: const [
        {
          'name': 'ebisnis-pos.exe',
          'browser_download_url': 'http://github.com/x/y/releases/download/v1.2.0/a.exe',
        },
      ]);
      expect(uraiRilisGitHub(badan, akhiranBerkas: '.exe'), isNull);
    });

    test('rilis draf tidak ditawarkan', () {
      // Draf hanya terlihat oleh pemilik repo; berkasnya tidak dapat diunduh
      // siapa pun di gerai.
      expect(uraiRilisGitHub(jawabanGitHub(draft: true), akhiranBerkas: '.exe'), isNull);
    });

    test('pratayang tidak ditawarkan kecuali diminta', () {
      expect(uraiRilisGitHub(jawabanGitHub(prerelease: true), akhiranBerkas: '.exe'), isNull);
      expect(
        uraiRilisGitHub(
          jawabanGitHub(prerelease: true),
          akhiranBerkas: '.exe',
          izinkanPratayang: true,
        ),
        isNotNull,
      );
    });

    test('rilis tanpa aset yang cocok tidak ditawarkan', () {
      // Menawarkan pembaruan yang tidak punya berkas berarti kasir menekan
      // "pasang" lalu tidak terjadi apa-apa.
      expect(uraiRilisGitHub(jawabanGitHub(aset: const []), akhiranBerkas: '.exe'), isNull);
    });

    test('penanda [WAJIB] pada catatan rilis terbaca', () {
      final r = uraiRilisGitHub(
        jawabanGitHub(body: '[WAJIB] Memperbaiki pembulatan pajak.'),
        akhiranBerkas: '.exe',
      )!;
      expect(r.wajib, isTrue);
      expect(r.catatan, contains('pembulatan'));
    });

    test('jawaban rusak menghasilkan null, bukan galat', () {
      for (final buruk in [
        '',
        'bukan json',
        '[]',
        '{}',
        '{"tag_name": ""}',
        '{"tag_name": "v1", "assets": "bukan daftar"}',
        '{"tag_name": 12, "assets": []}',
      ]) {
        expect(uraiRilisGitHub(buruk, akhiranBerkas: '.exe'), isNull, reason: buruk);
      }
    });

    test('platform tanpa akhiran yang dikenal tidak menawarkan apa pun', () {
      // Linux dan macOS belum dibangun. Menawarkan berkas Windows kepadanya lebih
      // buruk daripada tidak menawarkan apa-apa.
      expect(uraiRilisGitHub(jawabanGitHub(), akhiranBerkas: ''), isNull);
    });
  });

  group('mengambil lewat HTTP', () {
    late HttpServer peladen;
    late Uri alamat;
    int Function(HttpRequest) tanggapi = (_) => 200;
    String badan = jawabanGitHub();

    setUp(() async {
      peladen = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      alamat = Uri.parse('http://127.0.0.1:${peladen.port}/rilis');
      peladen.listen((r) async {
        final kode = tanggapi(r);
        r.response.statusCode = kode;
        if (kode == 200) r.response.write(badan);
        await r.response.close();
      });
    });

    tearDown(() async => peladen.close(force: true));

    test('jawaban sehat menjadi RilisTersedia', () async {
      final s = SumberRilisGitHub(alamat: alamat, akhiranBerkas: '.exe');
      final r = await s.ambil();
      expect(r, isNotNull);
      expect(r!.versi, '1.2.0');
    });

    test('kode galat menjadi null, bukan lemparan', () async {
      tanggapi = (_) => 404;
      final s = SumberRilisGitHub(alamat: alamat, akhiranBerkas: '.exe');
      expect(await s.ambil(), isNull);
      tanggapi = (_) => 200;
    });

    test('peladen yang tidak menjawab menyerah dalam batas waktu', () async {
      /*
       * Batas waktu yang menentukan. Tanpa batas, tombol "Cek pembaruan" berputar
       * sampai kasir menyerah — dan pada sebagian jaringan gerai itu berarti
       * beberapa menit.
       */
      final s = SumberRilisGitHub(
        alamat: Uri.parse('https://203.0.113.1/rilis'), // TEST-NET-3, tidak menjawab
        akhiranBerkas: '.exe',
        batasWaktu: const Duration(milliseconds: 400),
      );

      final mulai = DateTime.now();
      expect(await s.ambil(), isNull);
      expect(DateTime.now().difference(mulai).inSeconds, lessThan(5));
    });

    test('alamat repo GitHub tersusun benar', () {
      final s = SumberRilisGitHub.repo(pemilik: 'Zishof', repo: 'eBisnis', akhiranBerkas: '.exe');
      expect(s.alamat.toString(), 'https://api.github.com/repos/Zishof/eBisnis/releases/latest');
    });
  });

  group('pengelola pembaruan', () {
    test('belum diperiksa BUKAN berarti mutakhir', () {
      /*
       * Layar yang menampilkan "versi terbaru" padahal belum pernah memeriksa
       * apa pun adalah kebohongan yang paling mudah dipercaya — dan mesin kasir
       * dapat tertinggal berbulan-bulan tanpa ada yang curiga.
       */
      final p = PengelolaPembaruan(sumber: _SumberPalsu(null), versiBerjalan: '1.0.0');
      expect(p.hasil, isNull);
      expect(p.adaPembaruan, isFalse);
    });

    test('memeriksa mengisi hasil dan mengabari pendengar', () async {
      final p = PengelolaPembaruan(
        sumber: _SumberPalsu(
          const RilisTersedia(versi: '1.5.0', jalurUnduh: 'https://x/y.exe'),
        ),
        versiBerjalan: '1.0.0',
      );
      var kabar = 0;
      p.addListener(() => kabar += 1);

      await p.periksa();

      expect(p.hasil!.keadaan, KeadaanPembaruan.tersedia);
      expect(p.adaPembaruan, isTrue);
      expect(kabar, 2, reason: 'sekali saat mulai memeriksa, sekali saat selesai');
    });

    test('sumber yang gagal menjadi gagalDiperiksa, dan bukan pembaruan', () async {
      final p = PengelolaPembaruan(sumber: _SumberPalsu(null), versiBerjalan: '1.0.0');
      await p.periksa();
      expect(p.hasil!.keadaan, KeadaanPembaruan.gagalDiperiksa);
      expect(p.adaPembaruan, isFalse);
    });

    test('penekanan berulang tidak menumpuk permintaan', () async {
      // Kasir yang merasa tidak terjadi apa-apa akan menekannya lagi, dan tiga
      // permintaan serentak ke GitHub berakhir sebagai pembatasan laju.
      final sumber = _SumberLambat();
      final p = PengelolaPembaruan(sumber: sumber, versiBerjalan: '1.0.0');

      final a = p.periksa();
      final b = p.periksa();
      final c = p.periksa();
      sumber.lepaskan();
      await Future.wait([a, b, c]);

      expect(sumber.dipanggil, 1);
    });
  });

  test('versi bawaan sama dengan pubspec', () {
    /*
     * Bila keduanya berbeda, aplikasi yang dibangun di luar alur rilis
     * membandingkan dirinya dengan angka yang salah dan menyimpulkan "sudah versi
     * terbaru" pada mesin kasir yang tertinggal.
     */
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final baris = pubspec
        .split('\n')
        .firstWhere((b) => b.startsWith('version:'), orElse: () => '');
    final diPubspec = baris.split(':').last.trim().split('+').first;

    expect(diPubspec, isNotEmpty, reason: 'pubspec.yaml kehilangan version:');
    expect(
      versiAplikasi,
      diPubspec,
      reason: 'nilai bawaan versiAplikasi harus sama dengan version: pada pubspec.yaml',
    );
  });
}

class _SumberPalsu implements SumberPembaruan {
  _SumberPalsu(this._rilis);
  final RilisTersedia? _rilis;

  @override
  Future<RilisTersedia?> ambil() async => _rilis;
}

class _SumberLambat implements SumberPembaruan {
  int dipanggil = 0;
  final _pintu = Completer<void>();

  void lepaskan() => _pintu.complete();

  @override
  Future<RilisTersedia?> ambil() async {
    dipanggil += 1;
    await _pintu.future;
    return null;
  }
}
