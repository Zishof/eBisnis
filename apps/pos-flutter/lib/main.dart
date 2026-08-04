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
import 'inventory/inventory_app.dart';
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
  const product = String.fromEnvironment('APP_PRODUCT');
  if (product == 'inventory') {
    runApp(const AplikasiInventory());
    return;
  }
  runApp(const AplikasiKasir());
}

class AplikasiKasir extends StatefulWidget {
  const AplikasiKasir({super.key});

  @override
  State<AplikasiKasir> createState() => _AplikasiKasirState();
}

class _AplikasiKasirState extends State<AplikasiKasir> {
  _PersonaSalon? _persona;
  bool get _modeApotik {
    const mode = String.fromEnvironment('POS_MODE');
    const apotik = bool.fromEnvironment('POS_APOTIK');
    return apotik || mode == 'apotik';
  }

  /// Keadaan layar pelanggan.
  ///
  /// Hidup di sini, di atas layar kasir, sebab jendela layar kedua kelak dibuka
  /// dari sini pula — pada pohon widget yang berbeda.
  late final ValueNotifier<KeadaanPelanggan> _pelanggan;

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
    const alamatPenuh = String.fromEnvironment(
      'PEMBARUAN_URL',
      defaultValue: 'https://ebisnis.id/update/pos/latest',
    );
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
    _pelanggan = ValueNotifier<KeadaanPelanggan>(
      PelangganMenunggu(
        namaToko: _modeApotik ? 'Apotik eMedik' : 'eBisnis.id',
        sapaan: 'Selamat datang',
      ),
    );
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
      title: _modeApotik ? 'POS Apotik eMedik' : 'Kasir eBisnis.id',
      theme: temaKasir(),
      home: _beranda(),
    );
  }

  Widget _beranda() {
    final persona = _persona;
    if (_modeApotik) {
      return FutureBuilder<_SumberKasir>(
        future: _sumber,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const _MemuatKasir();
          }
          final sumber = snap.data ?? _SumberKasir.contoh(apotik: true);
          return LayarKasir(
            katalog: sumber.katalog,
            metode: sumber.metode,
            pencetak: _pencetak,
            namaToko: sumber.namaToko,
            pelanggan: _pelanggan,
            namaOutlet: sumber.namaOutlet,
            shift: sumber.shift,
            koneksi: sumber.koneksi,
            namaPengguna: sumber.namaPengguna ?? 'apoteker',
            pembaruan: _pembaruan,
            pembukuan: sumber.pembukuan,
            mode: ModeKasir.apotik,
          );
        },
      );
    }
    if (persona == null) {
      return _LoginSalonDemo(onMasuk: (p) => setState(() => _persona = p));
    }
    if (persona.jenis == _JenisPersonaSalon.pelanggan) {
      return _PortalPelangganSalonDemo(
        persona: persona,
        onKeluar: () => setState(() => _persona = null),
      );
    }
    return FutureBuilder<_SumberKasir>(
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
          namaPengguna: persona.label,
          pembaruan: _pembaruan,
          pembukuan: sumber.pembukuan,
        );
      },
    );
  }

  Future<_SumberKasir> _pilihSumberKasir() async {
    const apiBase = String.fromEnvironment('POS_API_BASE');
    if (apiBase.isEmpty) return _SumberKasir.contoh(apotik: _modeApotik);

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
      namaToko: _modeApotik ? 'Apotik eMedik' : 'eBisnis.id',
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

  factory _SumberKasir.contoh({bool apotik = false}) => _SumberKasir(
        katalog: apotik ? _KatalogApotikContoh() : _KatalogContoh(),
        metode: const [
          MetodeBayar(id: 'TUNAI', nama: 'Tunai', memberiKembalian: true),
          MetodeBayar(id: 'QRIS', nama: 'QRIS', memberiKembalian: false),
          MetodeBayar(id: 'KARTU', nama: 'Kartu', memberiKembalian: false),
          MetodeBayar(
              id: 'TRANSFER', nama: 'Transfer', memberiKembalian: false),
        ],
        namaToko: apotik ? 'Apotik eMedik' : 'eBisnis.id',
        namaOutlet: apotik ? 'Demo Apotik' : null,
        shift: apotik ? 'Shift Farmasi Pagi' : null,
        namaPengguna: apotik ? 'apoteker.demo' : null,
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

enum _JenisPersonaSalon { pelanggan, manajemen, pemilik }

class _PersonaSalon {
  const _PersonaSalon({
    required this.label,
    required this.username,
    required this.password,
    required this.jenis,
    required this.keterangan,
  });

  final String label;
  final String username;
  final String password;
  final _JenisPersonaSalon jenis;
  final String keterangan;
}

const _akunSalon = [
  _PersonaSalon(
    label: 'Pelanggan',
    username: 'pelanggan.salon',
    password: 'SalonDemo#2026',
    jenis: _JenisPersonaSalon.pelanggan,
    keterangan: 'Promo, booking, invoice, struk, dan riwayat kunjungan.',
  ),
  _PersonaSalon(
    label: 'Manajemen Salon',
    username: 'manajemen.salon',
    password: 'SalonDemo#2026',
    jenis: _JenisPersonaSalon.manajemen,
    keterangan:
        'Booking, layanan, petugas, kursi, stok, dan operasional harian.',
  ),
  _PersonaSalon(
    label: 'Pemilik Salon',
    username: 'pemilik.salon',
    password: 'SalonDemo#2026',
    jenis: _JenisPersonaSalon.pemilik,
    keterangan:
        'Dashboard omzet, laba, tren, performa layanan, dan keputusan bisnis.',
  ),
];

class _LoginSalonDemo extends StatefulWidget {
  const _LoginSalonDemo({required this.onMasuk});

  final ValueChanged<_PersonaSalon> onMasuk;

  @override
  State<_LoginSalonDemo> createState() => _LoginSalonDemoState();
}

class _LoginSalonDemoState extends State<_LoginSalonDemo> {
  final _username = TextEditingController(text: _akunSalon.first.username);
  final _password = TextEditingController(text: _akunSalon.first.password);
  String? _pesan;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  void _pilih(_PersonaSalon akun) {
    _username.text = akun.username;
    _password.text = akun.password;
    setState(() => _pesan = null);
  }

  void _masuk() {
    final username = _username.text.trim().toLowerCase();
    final password = _password.text;
    final cocok = _akunSalon.where(
      (akun) => akun.username == username && akun.password == password,
    );
    if (cocok.isEmpty) {
      setState(() => _pesan = 'Username atau password demo salon tidak cocok.');
      return;
    }
    widget.onMasuk(cocok.first);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F8),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 980),
            child: LayoutBuilder(
              builder: (context, box) {
                final form = _FormLoginSalon(
                  username: _username,
                  password: _password,
                  pesan: _pesan,
                  onMasuk: _masuk,
                );
                final akun = Column(
                  children: [
                    for (final item in _akunSalon)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: _KartuAkunSalon(
                            akun: item, onPilih: () => _pilih(item)),
                      ),
                  ],
                );
                if (box.maxWidth < 760) {
                  return Column(
                      children: [form, const SizedBox(height: 16), akun]);
                }
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: form),
                    const SizedBox(width: 20),
                    Expanded(child: akun),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _FormLoginSalon extends StatelessWidget {
  const _FormLoginSalon({
    required this.username,
    required this.password,
    required this.pesan,
    required this.onMasuk,
  });

  final TextEditingController username;
  final TextEditingController password;
  final String? pesan;
  final VoidCallback onMasuk;

  @override
  Widget build(BuildContext context) {
    return _PanelPutih(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Salon Cantik Demo',
            style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 8),
          const Text(
            'Masuk sebagai pelanggan, manajemen salon, atau pemilik salon. Akun ini sama dengan yang tampil di salon.ebisnis.id.',
            style: TextStyle(color: Color(0xFF526173), height: 1.5),
          ),
          const SizedBox(height: 24),
          TextField(
            controller: username,
            decoration: const InputDecoration(
              labelText: 'Username',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: password,
            decoration: const InputDecoration(
              labelText: 'Password',
              border: OutlineInputBorder(),
            ),
            obscureText: true,
          ),
          if (pesan != null) ...[
            const SizedBox(height: 12),
            Text(pesan!, style: const TextStyle(color: Color(0xFFB91C1C))),
          ],
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: onMasuk,
              icon: const Icon(Icons.login),
              label: const Text('Masuk'),
            ),
          ),
        ],
      ),
    );
  }
}

class _KartuAkunSalon extends StatelessWidget {
  const _KartuAkunSalon({required this.akun, required this.onPilih});

  final _PersonaSalon akun;
  final VoidCallback onPilih;

  @override
  Widget build(BuildContext context) {
    return _PanelPutih(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(akun.label,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(akun.keterangan,
              style: const TextStyle(color: Color(0xFF526173), height: 1.45)),
          const SizedBox(height: 12),
          Text('Username: ${akun.username}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          Text('Password: ${akun.password}',
              style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onPilih,
            icon: const Icon(Icons.person),
            label: const Text('Pakai akun ini'),
          ),
        ],
      ),
    );
  }
}

class _PortalPelangganSalonDemo extends StatelessWidget {
  const _PortalPelangganSalonDemo({
    required this.persona,
    required this.onKeluar,
  });

  final _PersonaSalon persona;
  final VoidCallback onKeluar;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F7F8),
      appBar: AppBar(
        title: Text('Portal ${persona.label}'),
        actions: [
          TextButton.icon(
            onPressed: onKeluar,
            icon: const Icon(Icons.logout),
            label: const Text('Keluar'),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: const [
          _PanelPutih(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Promo minggu ini',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                SizedBox(height: 8),
                Text(
                    'Diskon 20% untuk Hair Spa dan Creambath setiap Senin sampai Rabu.'),
              ],
            ),
          ),
          SizedBox(height: 12),
          _PanelPutih(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Booking saya',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                SizedBox(height: 8),
                Text('Selasa, 10:00 - Hair Treatment dengan Rina - Kursi 2.'),
              ],
            ),
          ),
          SizedBox(height: 12),
          _PanelPutih(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Struk terakhir',
                    style:
                        TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                SizedBox(height: 8),
                Text('INV-SALON-1000 - Rp 186.000 - Tunai.'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PanelPutih extends StatelessWidget {
  const _PanelPutih({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14000000),
            blurRadius: 16,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Padding(padding: const EdgeInsets.all(20), child: child),
    );
  }
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

/// Katalog contoh POS Apotik.
///
/// Isinya sengaja mencampur obat bebas, obat resep, high-alert, racikan, dan
/// produksi farmasi agar layar demo memperlihatkan pekerjaan khas apotik, bukan
/// hanya POS ritel dengan nama produk yang diganti.
class _KatalogApotikContoh extends SumberKatalog {
  static const _produk = [
    ProdukLokal(
      productId: 'RX-AMX-500',
      nama: 'Amoxicillin 500 mg',
      harga: '8500',
      barcodes: ['8997001000011'],
      kategori: 'Resep Dokter',
      varian: 'Kapsul - strip',
      penanda: ['Resep', 'Antibiotik'],
      stok: 42,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'OTC-PCT-500',
      nama: 'Paracetamol 500 mg',
      harga: '4500',
      barcodes: ['8997001000028'],
      kategori: 'Obat Bebas',
      varian: 'Kaplet - strip',
      penanda: ['OTC'],
      stok: 120,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'RX-CET-10',
      nama: 'Cetirizine 10 mg',
      harga: '6200',
      barcodes: ['8997001000035'],
      kategori: 'Alergi',
      varian: 'Tablet - strip',
      penanda: ['Resep'],
      stok: 35,
    ),
    ProdukLokal(
      productId: 'HA-INS-GLA',
      nama: 'Insulin glargine pen',
      harga: '185000',
      barcodes: ['8997001000042'],
      kategori: 'High-alert',
      varian: 'Pen 3 ml - rantai dingin',
      penanda: ['High-alert', 'Cold chain'],
      stok: 9,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'RX-DZP-2',
      nama: 'Diazepam 2 mg',
      harga: '12500',
      barcodes: ['8997001000059'],
      kategori: 'Psikotropika',
      varian: 'Tablet - strip',
      penanda: ['Resep', 'Psikotropika'],
      stok: 16,
    ),
    ProdukLokal(
      productId: 'VIT-B-CPLX',
      nama: 'Vitamin B Complex',
      harga: '18000',
      barcodes: ['8997001000066'],
      kategori: 'Vitamin',
      varian: 'Botol 30 tablet',
      penanda: ['OTC'],
      stok: 28,
    ),
    ProdukLokal(
      productId: 'RC-BATUK-ANAK',
      nama: 'Racikan batuk anak',
      harga: '38000',
      barcodes: ['RACIKAN-BATUK-ANAK'],
      kategori: 'Racikan',
      varian: 'Puyer/sirup sesuai resep',
      penanda: ['Racikan', 'Formula'],
      stok: null,
      favorit: true,
    ),
    ProdukLokal(
      productId: 'PROD-ALKOHOL-70',
      nama: 'Produksi Alkohol 70%',
      harga: '15000',
      barcodes: ['8997001000073'],
      kategori: 'Produksi Farmasi',
      varian: 'Botol 100 ml',
      penanda: ['Produksi'],
      stok: 64,
    ),
    ProdukLokal(
      productId: 'BMHP-SYR-5',
      nama: 'Syringe 5 ml',
      harga: '2500',
      barcodes: ['8997001000080'],
      kategori: 'BMHP',
      varian: 'Steril sekali pakai',
      penanda: ['BMHP'],
      stok: 200,
    ),
    ProdukLokal(
      productId: 'OBH-PLUS',
      nama: 'OBH Combi Plus',
      harga: '24000',
      barcodes: ['8997001000097'],
      kategori: 'Obat Bebas Terbatas',
      varian: 'Sirup 60 ml',
      penanda: ['Bebas terbatas'],
      stok: 0,
    ),
  ];

  @override
  ProdukLokal? dariBarcode(String kode) {
    final bersih = kode.trim();
    for (final p in _produk) {
      if (p.barcodes.contains(bersih) || p.productId == bersih) return p;
    }
    return null;
  }

  @override
  List<ProdukLokal> cari(String kunci) {
    final kecil = kunci.trim().toLowerCase();
    if (kecil.isEmpty) return _produk;
    return _produk.where((p) {
      return p.nama.toLowerCase().contains(kecil) ||
          p.productId.toLowerCase().contains(kecil) ||
          (p.kategori ?? '').toLowerCase().contains(kecil) ||
          p.penanda.any((x) => x.toLowerCase().contains(kecil)) ||
          p.barcodes.any((b) => b.contains(kunci.trim()));
    }).toList();
  }

  @override
  List<TarifLuring> get tarif => const [];

  @override
  String get mataUang => 'IDR';
}
