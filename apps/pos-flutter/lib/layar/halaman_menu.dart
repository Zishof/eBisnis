/// Halaman-halaman non-kasir pada klien POS.
library;

import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';

import '../produk/accurate_excel.dart';
import 'sumber.dart';
import 'tema.dart';

class HalamanDashboard extends StatefulWidget {
  const HalamanDashboard({
    required this.produk,
    required this.riwayat,
    required this.uang,
    super.key,
  });

  final List<ProdukLokal> produk;
  final List<RiwayatPembayaranKasir> riwayat;
  final String Function(String) uang;

  @override
  State<HalamanDashboard> createState() => _HalamanDashboardState();
}

class _HalamanDashboardState extends State<HalamanDashboard> {
  static const _tab = [
    'Ringkasan Umum',
    'Keuangan & Kinerja',
    'Produk & Inventaris',
    'Perilaku Pelanggan',
    'Peringkat Mitra',
    'Resep, HPP & Margin',
    'Ramalan Penjualan',
    'Promo & Cashback',
    'Kepatuhan Operasional',
  ];

  int _aktif = 0;

  num _angka(String nilai) => num.tryParse(nilai) ?? 0;

  num get _omzet =>
      widget.riwayat.fold<num>(0, (jumlah, r) => jumlah + _angka(r.total));

  num get _tunai => widget.riwayat
      .where((r) => r.metode.memberiKembalian)
      .fold<num>(0, (jumlah, r) => jumlah + _angka(r.total));

  num get _nonTunai => _omzet - _tunai;

  int get _itemTerjual =>
      widget.riwayat.fold<int>(0, (jumlah, r) => jumlah + r.jumlahBarang);

  int get _siapJual => widget.produk.where((p) => (p.stok ?? 1) > 0).length;

  int get _habis => widget.produk.where((p) => p.stok == 0).length;

  int get _stokRendah => widget.produk
      .where((p) => p.stok != null && p.stok! > 0 && p.stok! <= 5)
      .length;

  String _uangNum(num nilai) => widget.uang(nilai.toStringAsFixed(0));

  List<({String label, num nilai})> _metodeBayar() {
    final peta = <String, num>{};
    for (final r in widget.riwayat) {
      peta[r.metode.nama] = (peta[r.metode.nama] ?? 0) + _angka(r.total);
    }
    final hasil = peta.entries
        .map((e) => (label: e.key, nilai: e.value))
        .toList()
      ..sort((a, b) => b.nilai.compareTo(a.nilai));
    return hasil;
  }

  List<({String label, num nilai})> _kategoriProduk() {
    final peta = <String, num>{};
    for (final p in widget.produk) {
      final nama = (p.kategori == null || p.kategori!.trim().isEmpty)
          ? 'Umum'
          : p.kategori!.trim();
      peta[nama] = (peta[nama] ?? 0) + 1;
    }
    final hasil = peta.entries
        .map((e) => (label: e.key, nilai: e.value))
        .toList()
      ..sort((a, b) => b.nilai.compareTo(a.nilai));
    return hasil;
  }

  List<({String label, num nilai})> _jenisPesanan() {
    final peta = <String, num>{};
    for (final r in widget.riwayat) {
      peta[r.jenisPesanan] = (peta[r.jenisPesanan] ?? 0) + 1;
    }
    final hasil = peta.entries
        .map((e) => (label: e.key, nilai: e.value))
        .toList()
      ..sort((a, b) => b.nilai.compareTo(a.nilai));
    return hasil;
  }

  @override
  Widget build(BuildContext context) {
    return _HalamanDasar(
      judul: 'Dashboard Bisnis',
      subjudul: 'Ringkasan performa kasir dan katalog pada mesin ini.',
      anak: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              key: const Key('dashboard-tab-list'),
              scrollDirection: Axis.horizontal,
              itemCount: _tab.length,
              separatorBuilder: (_, __) => const SizedBox(width: 6),
              itemBuilder: (context, i) {
                return ChoiceChip(
                  key: Key('dashboard-tab-$i'),
                  label: Text(_tab[i]),
                  selected: _aktif == i,
                  onSelected: (_) => setState(() => _aktif = i),
                );
              },
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: SingleChildScrollView(
              key: Key('dashboard-isi-${_tab[_aktif]}'),
              child: _isiTab(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _isiTab() {
    return switch (_aktif) {
      0 => _ringkasanUmum(),
      1 => _keuangan(),
      2 => _produkInventaris(),
      3 => _perilakuPelanggan(),
      4 => _peringkatMitra(),
      5 => _hppMargin(),
      6 => _ramalan(),
      7 => _promo(),
      _ => _kepatuhan(),
    };
  }

  Widget _ringkasanUmum() {
    final rata = widget.riwayat.isEmpty ? 0 : _omzet / widget.riwayat.length;
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Transaksi Sesi Ini', nilai: '${widget.riwayat.length}'),
          (label: 'Omzet Sesi Ini', nilai: _uangNum(_omzet)),
          (label: 'Produk Siap Jual', nilai: '$_siapJual'),
          (label: 'Stok Habis', nilai: '$_habis'),
          (label: 'Rata-rata Nota', nilai: _uangNum(rata)),
        ]),
        _PanelBar(
          judul: 'Tren Omzet Terakhir',
          data: widget.riwayat
              .take(6)
              .toList()
              .reversed
              .map((r) => (label: r.nomorStruk, nilai: _angka(r.total)))
              .toList(),
          format: _uangNum,
          kosong: 'Belum ada transaksi selesai.',
        ),
        _PanelBar(
          judul: 'Komposisi Metode Bayar',
          data: _metodeBayar(),
          format: _uangNum,
          kosong: 'Belum ada pembayaran pada sesi ini.',
        ),
      ],
    );
  }

  Widget _keuangan() {
    final kembali = widget.riwayat
        .fold<num>(0, (jumlah, r) => jumlah + _angka(r.kembalian));
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Pendapatan Kotor', nilai: _uangNum(_omzet)),
          (label: 'Tunai', nilai: _uangNum(_tunai)),
          (label: 'Non Tunai', nilai: _uangNum(_nonTunai)),
          (label: 'Kembalian', nilai: _uangNum(kembali)),
        ]),
        _PanelBar(
          judul: 'Metode Pembayaran',
          data: _metodeBayar(),
          format: _uangNum,
          kosong: 'Pembayaran belum tercatat.',
        ),
      ],
    );
  }

  Widget _produkInventaris() {
    final diketahui = widget.produk.where((p) => p.stok != null).length;
    final hargaTertinggi = widget.produk.isEmpty
        ? 0
        : widget.produk
            .map((p) => num.tryParse(p.harga) ?? 0)
            .reduce((a, b) => a > b ? a : b);
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Total Produk', nilai: '${widget.produk.length}'),
          (label: 'Siap Jual', nilai: '$_siapJual'),
          (label: 'Stok Rendah', nilai: '$_stokRendah'),
          (label: 'Stok Habis', nilai: '$_habis'),
          (label: 'Stok Diketahui', nilai: '$diketahui'),
          (label: 'Harga Tertinggi', nilai: _uangNum(hargaTertinggi)),
        ]),
        _PanelBar(
          judul: 'Produk per Kategori',
          data: _kategoriProduk(),
          kosong: 'Katalog produk belum terisi.',
        ),
      ],
    );
  }

  Widget _perilakuPelanggan() {
    final catatan =
        widget.riwayat.where((r) => r.catatan.trim().isNotEmpty).length;
    final rataItem =
        widget.riwayat.isEmpty ? 0 : _itemTerjual / widget.riwayat.length;
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Pelanggan Umum', nilai: '${widget.riwayat.length}'),
          (label: 'Item Terjual', nilai: '$_itemTerjual'),
          (label: 'Rata-rata Item', nilai: rataItem.toStringAsFixed(1)),
          (label: 'Pesanan Bercatatan', nilai: '$catatan'),
        ]),
        _PanelBar(
          judul: 'Jenis Pesanan',
          data: _jenisPesanan(),
          kosong: 'Belum ada transaksi selesai.',
        ),
      ],
    );
  }

  Widget _peringkatMitra() {
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Mitra Aktif', nilai: '0'),
          (label: 'Metode Terpakai', nilai: '${_metodeBayar().length}'),
          (
            label: 'Kategori Teratas',
            nilai:
                _kategoriProduk().isEmpty ? '-' : _kategoriProduk().first.label,
          ),
        ]),
        _PanelStatus(
          judul: 'Status Mitra',
          isi:
              'Data mitra pengiriman, marketplace, dan agregator belum tersambung pada klien kasir ini. Saat integrasi masuk, tab ini siap dipakai untuk ranking omzet dan SLA.',
        ),
      ],
    );
  }

  Widget _hppMargin() {
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Omzet Terukur', nilai: _uangNum(_omzet)),
          (label: 'HPP Tersambung', nilai: 'Belum'),
          (label: 'Margin Tersedia', nilai: 'Belum'),
          (label: 'Resep Tersambung', nilai: 'Belum'),
        ]),
        const _PanelStatus(
          judul: 'Resep, HPP & Margin',
          isi:
              'Katalog kasir saat ini membawa harga jual dan stok. Harga pokok, resep bahan, dan margin perlu disambungkan dari modul inventaris/akuntansi agar angkanya otoritatif.',
        ),
      ],
    );
  }

  Widget _ramalan() {
    final transaksi = widget.riwayat.length;
    final proyeksi7 = _omzet * 7;
    final proyeksi30 = _omzet * 30;
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Basis Transaksi', nilai: '$transaksi'),
          (label: 'Proyeksi 7 Hari', nilai: _uangNum(proyeksi7)),
          (label: 'Proyeksi 30 Hari', nilai: _uangNum(proyeksi30)),
          (label: 'Akurasi', nilai: transaksi < 10 ? 'Awal' : 'Cukup'),
        ]),
        const _PanelStatus(
          judul: 'Catatan Ramalan',
          isi:
              'Ramalan ini memakai sesi aplikasi saat ini sebagai baseline cepat. Setelah riwayat server tersambung, proyeksi dapat memakai pola harian, mingguan, musim libur, dan jam sibuk.',
        ),
      ],
    );
  }

  Widget _promo() {
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Promo Aktif', nilai: '0'),
          (label: 'Cashback Tercatat', nilai: _uangNum(0)),
          (label: 'Voucher Digunakan', nilai: '0'),
          (label: 'Potensi Member', nilai: '${widget.riwayat.length}'),
        ]),
        const _PanelStatus(
          judul: 'Promo & Cashback',
          isi:
              'Aturan diskon sudah disiapkan di backend/web. Klien kasir menunggu sinkronisasi promo agar dashboard ini dapat menampilkan nilai diskon, voucher, dan cashback.',
        ),
      ],
    );
  }

  Widget _kepatuhan() {
    return _DashboardStack(
      children: [
        _GridAngka(angka: [
          (label: 'Struk Tersimpan', nilai: '${widget.riwayat.length}'),
          (
            label: 'Produk Tanpa Stok',
            nilai: '${widget.produk.where((p) => p.stok == null).length}',
          ),
          (label: 'Produk Habis', nilai: '$_habis'),
          (label: 'Transaksi Luring', nilai: '0'),
        ]),
        const _PanelStatus(
          judul: 'Kepatuhan Operasional',
          isi:
              'Dashboard memantau hal yang sudah tersedia di klien: struk digital lokal, kelengkapan stok, dan kesiapan katalog. Audit shift dan sinkronisasi server akan masuk saat modulnya tersambung.',
        ),
      ],
    );
  }
}

class _DashboardStack extends StatelessWidget {
  const _DashboardStack({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final child in children) ...[
          child,
          const SizedBox(height: 12),
        ],
      ],
    );
  }
}

class _GridAngka extends StatelessWidget {
  const _GridAngka({required this.angka});

  final List<({String label, String nilai})> angka;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, batas) {
        final kolom = batas.maxWidth >= 1200
            ? 5
            : batas.maxWidth >= 900
                ? 4
                : batas.maxWidth >= 620
                    ? 3
                    : 2;
        return GridView.count(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisCount: kolom,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.25,
          children: [
            for (final a in angka) _KartuAngka(label: a.label, nilai: a.nilai),
          ],
        );
      },
    );
  }
}

class _PanelBar extends StatelessWidget {
  const _PanelBar({
    required this.judul,
    required this.data,
    this.format,
    this.kosong = 'Belum ada data.',
  });

  final String judul;
  final List<({String label, num nilai})> data;
  final String Function(num nilai)? format;
  final String kosong;

  @override
  Widget build(BuildContext context) {
    final max = data.isEmpty
        ? 0
        : data.map((d) => d.nilai).reduce((a, b) => a > b ? a : b);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: hiasanKartu(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            judul,
            style: const TextStyle(
              color: Warna.teks,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 14),
          if (data.isEmpty)
            Text(kosong, style: const TextStyle(color: Warna.teksRedup))
          else
            for (final d in data) ...[
              Row(
                children: [
                  SizedBox(
                    width: 150,
                    child: Text(
                      d.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(999),
                      child: LinearProgressIndicator(
                        value: max <= 0
                            ? 0
                            : (d.nilai / max).clamp(0, 1).toDouble(),
                        minHeight: 10,
                        backgroundColor: const Color(0xFFE2E8F0),
                        valueColor:
                            const AlwaysStoppedAnimation<Color>(Warna.utama),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 110,
                    child: Text(
                      format == null
                          ? d.nilai.toStringAsFixed(0)
                          : format!(d.nilai),
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
            ],
        ],
      ),
    );
  }
}

class _PanelStatus extends StatelessWidget {
  const _PanelStatus({required this.judul, required this.isi});

  final String judul;
  final String isi;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: hiasanKartu(),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, color: Warna.utama),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  judul,
                  style: const TextStyle(
                    color: Warna.teks,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(isi, style: const TextStyle(color: Warna.teksRedup)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class HalamanProduk extends StatefulWidget {
  const HalamanProduk({
    required this.produk,
    required this.uang,
    required this.onProdukDiunggah,
    super.key,
  });

  final List<ProdukLokal> produk;
  final String Function(String) uang;
  final void Function(List<ProdukLokal>) onProdukDiunggah;

  @override
  State<HalamanProduk> createState() => _HalamanProdukState();
}

class _HalamanProdukState extends State<HalamanProduk> {
  static const _xlsx = XTypeGroup(
    label: 'Excel',
    extensions: ['xlsx'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ],
  );

  bool _sibuk = false;

  Future<void> _upload() async {
    final file = await openFile(acceptedTypeGroups: const [_xlsx]);
    if (file == null) return;
    await _jalankan(() async {
      final produk = produkDariAccurate(await file.readAsBytes());
      if (produk.isEmpty) {
        throw Exception(
            'File tidak memuat baris produk Accurate yang terbaca.');
      }
      widget.onProdukDiunggah(produk);
      _pesan('${produk.length} produk diambil dari ${file.name}.');
    });
  }

  Future<void> _download() async {
    final lokasi = await getSaveLocation(
      acceptedTypeGroups: const [_xlsx],
      suggestedName: 'ebisnis-produk-accurate.xlsx',
    );
    if (lokasi == null) return;
    await _jalankan(() async {
      final bytes = accurateDariProduk(widget.produk);
      final out = XFile.fromData(
        Uint8List.fromList(bytes),
        mimeType:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        name: 'ebisnis-produk-accurate.xlsx',
      );
      await out.saveTo(lokasi.path);
      _pesan('Produk diunduh ke ${lokasi.path}.');
    });
  }

  Future<void> _jalankan(Future<void> Function() aksi) async {
    if (_sibuk) return;
    setState(() => _sibuk = true);
    try {
      await aksi();
    } catch (e) {
      _pesan(e.toString(), galat: true);
    } finally {
      if (mounted) setState(() => _sibuk = false);
    }
  }

  void _pesan(String teks, {bool galat = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(teks),
        backgroundColor: galat ? const Color(0xFFB91C1C) : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return _HalamanDasar(
      judul: 'Produk',
      subjudul: 'Kelola daftar barang kasir dan tukar data dengan Accurate.',
      aksi: [
        OutlinedButton.icon(
          key: const Key('download-produk-accurate'),
          onPressed: _sibuk ? null : _download,
          icon: const Icon(Icons.download_outlined),
          label: const Text('Download'),
        ),
        FilledButton.icon(
          key: const Key('upload-produk-accurate'),
          onPressed: _sibuk ? null : _upload,
          icon: const Icon(Icons.upload_file_outlined),
          label: const Text('Upload'),
        ),
      ],
      anak: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: hiasanKartu(),
            child: const Row(
              children: [
                Icon(Icons.table_chart_outlined, color: Warna.utama),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Format Accurate: sheet "Daftar Barang dan Jasa" dengan kolom Kode, UPC/Barcode, Kategori, Nama Barang, Satuan, Kts, dan Def. Hrg. Jual Sa.',
                    style: TextStyle(fontSize: 13, color: Warna.teksRedup),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Container(
              decoration: hiasanKartu(),
              child: ListView.separated(
                key: const Key('daftar-produk-menu'),
                itemCount: widget.produk.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final p = widget.produk[i];
                  return ListTile(
                    leading: CircleAvatar(
                      backgroundColor: warnaKotakProduk(p.productId),
                      child: Text(p.nama.characters.first.toUpperCase()),
                    ),
                    title: Text(p.nama),
                    subtitle: Text([
                      p.productId,
                      if (p.kategori != null) p.kategori!,
                      if (p.barcodes.isNotEmpty) p.barcodes.first,
                    ].join(' · ')),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          widget.uang(p.harga),
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          p.stok == null
                              ? 'Stok tidak diketahui'
                              : 'Stok ${p.stok}',
                          style: const TextStyle(
                              color: Warna.teksRedup, fontSize: 12),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HalamanRingkas extends StatelessWidget {
  const HalamanRingkas({
    required this.judul,
    required this.ikon,
    required this.keterangan,
    required this.angka,
    super.key,
  });

  final String judul;
  final IconData ikon;
  final String keterangan;
  final List<({String label, String nilai})> angka;

  @override
  Widget build(BuildContext context) {
    return _HalamanDasar(
      judul: judul,
      subjudul: keterangan,
      anak: GridView.count(
        crossAxisCount: 3,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.2,
        children: [
          for (final a in angka) _KartuAngka(label: a.label, nilai: a.nilai),
          _KartuKosong(ikon: ikon),
        ],
      ),
    );
  }
}

class HalamanRiwayatPembayaran extends StatefulWidget {
  const HalamanRiwayatPembayaran({
    required this.riwayat,
    required this.uang,
    required this.printerSiap,
    required this.onCetakStruk,
    super.key,
  });

  final List<RiwayatPembayaranKasir> riwayat;
  final String Function(String) uang;
  final bool printerSiap;
  final void Function(RiwayatPembayaranKasir) onCetakStruk;

  @override
  State<HalamanRiwayatPembayaran> createState() =>
      _HalamanRiwayatPembayaranState();
}

class _HalamanRiwayatPembayaranState extends State<HalamanRiwayatPembayaran> {
  String _metode = 'Semua';
  final TextEditingController _cari = TextEditingController();

  @override
  void dispose() {
    _cari.dispose();
    super.dispose();
  }

  List<RiwayatPembayaranKasir> get _tersaring {
    final kunci = _cari.text.trim().toLowerCase();
    return widget.riwayat.where((r) {
      final cocokMetode = _metode == 'Semua' || r.metode.nama == _metode;
      final cocokCari = kunci.isEmpty ||
          r.nomorStruk.toLowerCase().contains(kunci) ||
          r.metode.nama.toLowerCase().contains(kunci) ||
          r.jenisPesanan.toLowerCase().contains(kunci) ||
          r.catatan.toLowerCase().contains(kunci);
      return cocokMetode && cocokCari;
    }).toList();
  }

  num _angka(String nilai) => num.tryParse(nilai) ?? 0;

  String _tanggal(DateTime waktu) {
    String dua(int n) => n.toString().padLeft(2, '0');
    return '${dua(waktu.day)}-${dua(waktu.month)}-${waktu.year} '
        '${dua(waktu.hour)}:${dua(waktu.minute)}';
  }

  @override
  Widget build(BuildContext context) {
    final daftar = _tersaring;
    final total = daftar.fold<num>(0, (nilai, r) => nilai + _angka(r.total));
    final tunai = daftar
        .where((r) => r.metode.memberiKembalian)
        .fold<num>(0, (nilai, r) => nilai + _angka(r.total));
    final nontunai = total - tunai;
    final metode = {
      'Semua',
      for (final r in widget.riwayat) r.metode.nama,
    }.toList();

    return _HalamanDasar(
      judul: 'Riwayat Pembayaran',
      subjudul:
          'Summary pembayaran dan transaksi lunas pada sesi aplikasi ini.',
      anak: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 4,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 2.6,
            children: [
              _KartuAngka(label: 'Transaksi', nilai: '${daftar.length}'),
              _KartuAngka(
                  label: 'Total pembayaran',
                  nilai: widget.uang(total.toStringAsFixed(0))),
              _KartuAngka(
                  label: 'Tunai', nilai: widget.uang(tunai.toStringAsFixed(0))),
              _KartuAngka(
                  label: 'Non tunai',
                  nilai: widget.uang(nontunai.toStringAsFixed(0))),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              SizedBox(
                width: 260,
                child: TextField(
                  key: const Key('cari-riwayat-pembayaran'),
                  controller: _cari,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                    prefixIcon: Icon(Icons.search_outlined),
                    hintText: 'Cari struk, metode, atau catatan',
                    isDense: true,
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              for (final m in metode) ...[
                ChoiceChip(
                  key: Key('filter-riwayat-$m'),
                  label: Text(m),
                  selected: _metode == m,
                  onSelected: (_) => setState(() => _metode = m),
                ),
                const SizedBox(width: 6),
              ],
            ],
          ),
          const SizedBox(height: 12),
          Expanded(
            child: Container(
              key: const Key('panel-riwayat-pembayaran'),
              decoration: hiasanKartu(),
              child: daftar.isEmpty
                  ? const Center(
                      child: Text(
                        'Belum ada pembayaran pada sesi aplikasi ini.',
                        style: TextStyle(color: Warna.teksRedup),
                      ),
                    )
                  : ListView.separated(
                      key: const Key('daftar-riwayat-pembayaran'),
                      itemCount: daftar.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, i) {
                        final r = daftar[i];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Warna.utama.withValues(alpha: .12),
                            child: Icon(
                              r.metode.memberiKembalian
                                  ? Icons.payments_outlined
                                  : Icons.account_balance_wallet_outlined,
                              color: Warna.utama,
                            ),
                          ),
                          title: Text(
                            r.nomorStruk,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          subtitle: Text(
                            '${_tanggal(r.waktu)} - ${r.jenisPesanan} - '
                            '${r.jumlahBarang} item - ${r.metode.nama}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          trailing: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 270),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Flexible(
                                  child: Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        widget.uang(r.total),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w800,
                                          color: Warna.teks,
                                        ),
                                      ),
                                      Text(
                                        'Bayar ${widget.uang(r.diserahkan)} - '
                                        'Kembali ${widget.uang(r.kembalian)}',
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Warna.teksRedup,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 8),
                                IconButton(
                                  key: Key('cetak-riwayat-pembayaran-$i'),
                                  tooltip: 'Cetak struk',
                                  onPressed: widget.printerSiap
                                      ? () => widget.onCetakStruk(r)
                                      : null,
                                  icon: const Icon(Icons.print_outlined),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _HalamanDasar extends StatelessWidget {
  const _HalamanDasar({
    required this.judul,
    required this.subjudul,
    required this.anak,
    this.aksi = const [],
  });

  final String judul;
  final String subjudul;
  final Widget anak;
  final List<Widget> aksi;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      judul,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: Warna.teks,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(subjudul,
                        style: const TextStyle(color: Warna.teksRedup)),
                  ],
                ),
              ),
              for (final a in aksi) ...[const SizedBox(width: 8), a],
            ],
          ),
          const SizedBox(height: 14),
          Expanded(child: anak),
        ],
      ),
    );
  }
}

class _KartuAngka extends StatelessWidget {
  const _KartuAngka({required this.label, required this.nilai});

  final String label;
  final String nilai;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: hiasanKartu(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(label, style: const TextStyle(color: Warna.teksRedup)),
          const SizedBox(height: 8),
          Text(
            nilai,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: Warna.teks,
            ),
          ),
        ],
      ),
    );
  }
}

class _KartuKosong extends StatelessWidget {
  const _KartuKosong({required this.ikon});

  final IconData ikon;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: hiasanKartu(),
      child: Center(child: Icon(ikon, size: 40, color: Warna.teksRedup)),
    );
  }
}
