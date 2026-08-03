/// Titik masuk klien kasir.
///
/// Masih memakai katalog contoh yang tertanam, sebab klien API dan penyimpanan
/// lokal belum ada. Itu disengaja dan sementara: dengan ini satu mesin kasir
/// sungguhan sudah dapat dijalankan — memindai, membayar, mencetak struk, dan
/// membuka laci kas — cukup untuk mengetahui apakah printer dan lacinya bekerja
/// sebelum sisanya dibangun.
///
/// Yang menggantikannya nanti hanyalah `SumberKatalog` dan `Pencetak`. Layar
/// kasirnya sendiri tidak perlu berubah, sebab keduanya sudah berupa antarmuka.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import 'api/pos_api.dart';
import 'aturan/harga_luring.dart';
import 'aturan/koneksi.dart';
import 'layar/layar_kasir.dart';
import 'layar/sumber.dart';
import 'layar/tampilan_pelanggan.dart';
import 'layar/tema.dart';
import 'pembaruan/pengelola_pembaruan.dart';
import 'pembaruan/sumber_pembaruan.dart';
import 'pembaruan/versi_aplikasi.dart';
import 'perangkat/antrean_cetak.dart';
import 'perangkat/pencetak_jaringan.dart';
import 'perangkat/pencetak_perangkat.dart';

void main() {
  runApp(const AplikasiKasir());
}

class AplikasiKasir extends StatefulWidget {
  const AplikasiKasir({super.key});

  @override
  State<AplikasiKasir> createState() => _AplikasiKasirState();
}

class _AplikasiKasirState extends State<AplikasiKasir> {
  /// Keadaan layar pelanggan.
  ///
  /// Hidup di sini, di atas layar kasir, sebab jendela layar kedua kelak dibuka
  /// dari sini pula — pada pohon widget yang berbeda.
  final _pelanggan = ValueNotifier<KeadaanPelanggan>(
    const PelangganMenunggu(namaToko: 'eBisnis.id', sapaan: 'Selamat datang'),
  );

  /// Pengangkutan mentahnya, disimpan terpisah.
  ///
  /// Pemeriksaan kesiapan bertanya kepada pengangkutan, bukan kepada antreannya
  /// — antrean tidak tahu apa-apa tentang soket maupun simpul perangkat.
  late final Pencetak _pengangkut = _pengangkutan();
  late final Pencetak _pencetak = _pilihPencetak();
  late final PengelolaPembaruan _pembaruan = PengelolaPembaruan(
    sumber: _pilihSumberPembaruan(),
    versiBerjalan: versiAplikasi,
  );
  late final Future<_SumberKasir> _sumber = _pilihSumberKasir();

  Timer? _jadwalPembaruan;

  /// Memilih pengangkutan printer dari argumen saat dibangun.
  ///
  /// Disetel lewat argumen, bukan lewat layar setelan, sebab layar setelannya
  /// belum ada — dan menebak bawaannya akan salah: mesin kasir Windows umumnya
  /// memakai porta COM, sedangkan gerai dengan printer bersama memakai jaringan.
  ///
  ///   flutter run -d windows --dart-define=PRINTER=COM3
  ///   flutter run -d windows --dart-define=PRINTER=192.168.1.50:9100
  ///
  /// Tanpa argumen, klien berjalan tanpa printer dan mengatakannya apa adanya
  /// pada layar — bukan diam-diam gagal mencetak.
  /// Selalu dibungkus antrean.
  ///
  /// Spesifikasi AIS §19 mencatat dari lapangan bahwa panggilan cetak yang
  /// bertumpuk membuat aplikasi kasir keluar sendiri. Di sini jalannya mudah
  /// dicapai tanpa niat: struk sedang dikirim, kasir menekan buka laci, dan
  /// byte kedua perintah berselang-seling pada soket yang sama.
  Pencetak _pilihPencetak() => PencetakBerantre(_pengangkut);

  Pencetak _pengangkutan() {
    const setelan = String.fromEnvironment('PRINTER');
    if (setelan.isEmpty) return const TanpaPencetak();

    final pisah = setelan.split(':');
    if (pisah.length == 2 && int.tryParse(pisah[1]) != null) {
      return PencetakJaringan(host: pisah[0], porta: int.parse(pisah[1]));
    }
    return PencetakPerangkat(setelan);
  }

  /// Memilih sumber pembaruan.
  ///
  ///   --dart-define=PEMBARUAN_REPO=Zishof/eBisnis   (bawaan)
  ///   --dart-define=PEMBARUAN_URL=https://…         (menimpa yang di atas)
  ///
  /// Alamat penuh disediakan supaya rilis dapat diperantarai peladen eBisnis
  /// kelak — bentuk jawabannya sama, dan penguraiannya tidak perlu berubah.
  SumberPembaruan _pilihSumberPembaruan() {
    const alamatPenuh = String.fromEnvironment('PEMBARUAN_URL');
    final akhiran = akhiranPemasang();

    if (alamatPenuh.isNotEmpty) {
      return SumberRilisGitHub(
          alamat: Uri.parse(alamatPenuh), akhiranBerkas: akhiran);
    }

    const repo = String.fromEnvironment('PEMBARUAN_REPO',
        defaultValue: 'Zishof/eBisnis');
    final pisah = repo.split('/');
    return SumberRilisGitHub.repo(
      pemilik: pisah.first,
      repo: pisah.length > 1 ? pisah[1] : repo,
      akhiranBerkas: akhiran,
    );
  }

  @override
  void initState() {
    super.initState();
    // Diperiksa sekali di awal supaya layar dapat mengatakan keadaannya sebelum
    // kasir menekan bayar, bukan sesudah struknya gagal tercetak.
    unawaitedPeriksa();

    /*
     * Pemeriksaan pembaruan otomatis.
     *
     * Berjalan sekali saat dibuka lalu setiap enam jam — cukup untuk mesin yang
     * dibiarkan menyala berhari-hari, dan cukup jarang untuk tidak menjadi
     * beban pada jaringan gerai.
     *
     * Ia TIDAK PERNAH membuka dialog. Yang dilakukannya hanya menyalakan tanda
     * pada tombol di bilah atas; dialognya hanya terbuka ketika kasir
     * menekannya sendiri. Jendela yang muncul sendiri di atas layar kasir akan
     * ditutup dengan tekanan tombol yang sedang dituju jari.
     */
    unawaited(_pembaruan.periksa());
    _jadwalPembaruan = Timer.periodic(
      const Duration(hours: 6),
      (_) => unawaited(_pembaruan.periksa()),
    );
  }

  void unawaitedPeriksa() {
    // Bertanya kepada pengangkutan, bukan kepada antreannya. Antrean hanya
    // meneruskan `siap`; ia tidak punya soket untuk diperiksa.
    final p = _pengangkut;
    final Future<bool>? periksa = switch (p) {
      PencetakJaringan() => p.periksa(),
      PencetakPerangkat() => p.periksa(),
      _ => null,
    };
    periksa?.then((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _jadwalPembaruan?.cancel();
    _pembaruan.dispose();
    _pelanggan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kasir eBisnis.id',
      theme: temaKasir(),
      home: FutureBuilder<_SumberKasir>(
        future: _sumber,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const _MemuatKasir();
          }
          final sumber = snap.data ?? _SumberKasir.contoh();
          return LayarKasir(
            katalog: sumber.katalog,
            metode: sumber.metode,
            pencetak: _pencetak,
            namaToko: sumber.namaToko,
            pelanggan: _pelanggan,
            namaOutlet: sumber.namaOutlet,
            shift: sumber.shift,
            koneksi: sumber.koneksi,
            namaPengguna: sumber.namaPengguna,
            pembaruan: _pembaruan,
            pembukuan: sumber.pembukuan,
          );
        },
      ),
    );
  }

  Future<_SumberKasir> _pilihSumberKasir() async {
    const apiBase = String.fromEnvironment('POS_API_BASE');
    if (apiBase.isEmpty) return _SumberKasir.contoh();

    final client = PosApiClient(
      baseUrl: Uri.parse(apiBase.endsWith('/') ? apiBase : '$apiBase/'),
      accessToken: const String.fromEnvironment('POS_ACCESS_TOKEN'),
      username: const String.fromEnvironment('POS_USERNAME'),
      password: const String.fromEnvironment('POS_PASSWORD'),
      tenantCode: const String.fromEnvironment('POS_TENANT'),
    );
    final boot = await client.bootstrap();
    final sesi = boot.sesi;
    return _SumberKasir(
      katalog: boot.katalog,
      metode: boot.metode,
      namaToko: 'eBisnis.id',
      namaOutlet: sesi.outletName,
      shift: sesi.shiftNumber ?? sesi.businessDate,
      koneksi: KeadaanKoneksi.daring,
      namaPengguna:
          const String.fromEnvironment('POS_USERNAME', defaultValue: 'demo'),
      pembukuan: (transaksi) =>
          client.bukukan(sesi: sesi, transaksi: transaksi),
    );
  }
}

class _SumberKasir {
  const _SumberKasir({
    required this.katalog,
    required this.metode,
    required this.namaToko,
    this.namaOutlet,
    this.shift,
    this.koneksi,
    this.namaPengguna,
    this.pembukuan,
  });

  factory _SumberKasir.contoh() => _SumberKasir(
        katalog: _KatalogContoh(),
        metode: const [
          MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true),
          MetodeBayar(id: 'QRIS', nama: 'QRIS', memberiKembalian: false),
          MetodeBayar(id: 'KARTU', nama: 'Kartu', memberiKembalian: false),
          MetodeBayar(
              id: 'TRANSFER', nama: 'Transfer', memberiKembalian: false),
        ],
        namaToko: 'eBisnis.id',
      );

  final SumberKatalog katalog;
  final List<MetodeBayar> metode;
  final String namaToko;
  final String? namaOutlet;
  final String? shift;
  final KeadaanKoneksi? koneksi;
  final String? namaPengguna;
  final PembukuanKasir? pembukuan;
}

class _MemuatKasir extends StatelessWidget {
  const _MemuatKasir();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(),
            SizedBox(height: 16),
            Text('Menyiapkan kasir...'),
          ],
        ),
      ),
    );
  }
}

/// Katalog contoh sementara.
///
/// Namanya menyebut dirinya contoh supaya tidak ada yang mengiranya sumber data
/// sungguhan. Ia akan digantikan salinan katalog dari peladen.
class _KatalogContoh extends SumberKatalog {
  static const _produk = [
    ProdukLokal(
      productId: 'P1',
      nama: 'Es Kopi Gula Aren',
      harga: '28000',
      barcodes: ['8991234567890'],
      kategori: 'Kopi',
      varian: 'Reguler',
      stok: 32,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'P2',
      nama: 'Cappuccino',
      harga: '27000',
      barcodes: ['8991111111111'],
      kategori: 'Kopi',
      varian: 'Reguler',
      stok: 18,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'P3',
      nama: 'Teh Manis',
      harga: '8000',
      barcodes: ['8992222222222'],
      kategori: 'Non Kopi',
      varian: 'Reguler',
      stok: 24,
    ),
    ProdukLokal(
      productId: 'P4',
      nama: 'Chicken Sandwich',
      harga: '38000',
      barcodes: ['8993333333333'],
      kategori: 'Makanan',
      varian: 'Reguler',
      stok: 12,
    ),
    ProdukLokal(
      productId: 'P5',
      nama: 'Roti Bakar Cokelat',
      harga: '15000',
      barcodes: ['8994444444444'],
      kategori: 'Makanan',
      varian: 'Reguler',
      stok: 8,
    ),
    ProdukLokal(
      productId: 'P6',
      nama: 'Cheesecake',
      harga: '32000',
      barcodes: ['8995555555555'],
      kategori: 'Dessert',
      varian: 'Slice',
      stok: 0,
    ),
  ];

  @override
  ProdukLokal? dariBarcode(String kode) {
    for (final p in _produk) {
      if (p.barcodes.contains(kode.trim())) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) => _produk
      .where((p) => p.nama.toLowerCase().contains(kunci.toLowerCase()))
      .toList();

  @override
  List<TarifLuring> get tarif => const [];

  @override
  String get mataUang => 'IDR';
}
