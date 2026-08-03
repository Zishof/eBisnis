/// Halaman-halaman non-kasir pada klien POS.
library;

import 'dart:typed_data';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';

import '../produk/accurate_excel.dart';
import 'sumber.dart';
import 'tema.dart';

class HalamanDashboard extends StatelessWidget {
  const HalamanDashboard({
    required this.produk,
    required this.uang,
    super.key,
  });

  final List<ProdukLokal> produk;
  final String Function(String) uang;

  @override
  Widget build(BuildContext context) {
    final aktif = produk.where((p) => (p.stok ?? 1) > 0).length;
    final habis = produk.where((p) => p.stok == 0).length;
    return _HalamanDasar(
      judul: 'Dashboard',
      subjudul: 'Ringkasan cepat mesin kasir ini.',
      anak: GridView.count(
        crossAxisCount: 4,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 2.3,
        children: [
          _KartuAngka(label: 'Produk', nilai: '${produk.length}'),
          _KartuAngka(label: 'Siap jual', nilai: '$aktif'),
          _KartuAngka(label: 'Stok habis', nilai: '$habis'),
          _KartuAngka(
            label: 'Harga tertinggi',
            nilai: produk.isEmpty
                ? uang('0')
                : uang(produk
                    .map((p) => num.tryParse(p.harga) ?? 0)
                    .reduce((a, b) => a > b ? a : b)
                    .toStringAsFixed(0)),
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
