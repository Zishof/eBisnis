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

import 'package:flutter/material.dart';

import 'aturan/harga_luring.dart';
import 'layar/layar_kasir.dart';
import 'layar/sumber.dart';
import 'layar/tampilan_pelanggan.dart';
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

  late final Pencetak _pencetak = _pilihPencetak();

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
  Pencetak _pilihPencetak() {
    const setelan = String.fromEnvironment('PRINTER');
    if (setelan.isEmpty) return const TanpaPencetak();

    final pisah = setelan.split(':');
    if (pisah.length == 2 && int.tryParse(pisah[1]) != null) {
      return PencetakJaringan(host: pisah[0], porta: int.parse(pisah[1]));
    }
    return PencetakPerangkat(setelan);
  }

  @override
  void initState() {
    super.initState();
    // Diperiksa sekali di awal supaya layar dapat mengatakan keadaannya sebelum
    // kasir menekan bayar, bukan sesudah struknya gagal tercetak.
    unawaitedPeriksa();
  }

  void unawaitedPeriksa() {
    final p = _pencetak;
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
    _pelanggan.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kasir eBisnis.id',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0F172A)),
        useMaterial3: true,
      ),
      home: LayarKasir(
        katalog: _KatalogContoh(),
        metode: const [MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true)],
        pencetak: _pencetak,
        namaToko: 'eBisnis.id',
        pelanggan: _pelanggan,
      ),
    );
  }
}

/// Katalog contoh sementara.
///
/// Namanya menyebut dirinya contoh supaya tidak ada yang mengiranya sumber data
/// sungguhan. Ia akan digantikan salinan katalog dari peladen.
class _KatalogContoh implements SumberKatalog {
  static const _produk = [
    ProdukLokal(
      productId: 'P1',
      nama: 'Kopi Susu Gula Aren',
      harga: '18000',
      barcodes: ['8991234567890'],
    ),
    ProdukLokal(
      productId: 'P2',
      nama: 'Teh Manis',
      harga: '8000',
      barcodes: ['8991111111111'],
    ),
    ProdukLokal(
      productId: 'P3',
      nama: 'Roti Bakar Cokelat',
      harga: '15000',
      barcodes: ['8992222222222'],
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
  List<ProdukLokal> cari(String kunci) =>
      _produk.where((p) => p.nama.toLowerCase().contains(kunci.toLowerCase())).toList();

  @override
  List<TarifLuring> get tarif => const [];

  @override
  String get mataUang => 'IDR';
}
