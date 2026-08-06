/// Kisi produk beserta penyaring kategorinya.
///
/// ## Mengapa kisi, padahal pemindai sudah ada
///
/// Sebagian besar barang di gerai makanan dan minuman **tidak punya barcode**.
/// Kopi yang baru diseduh tidak dapat dipindai. Untuk gerai seperti itu kisi
/// inilah jalan utamanya, dan pemindai yang menjadi tambahan — kebalikan dari
/// minimarket.
///
/// Karena itu kartunya besar dan jarak antartombolnya lebar: ditekan dengan
/// jari, di layar sentuh, oleh orang yang sedang berdiri.
library;

import 'package:flutter/material.dart';

import 'sumber.dart';
import 'tema.dart';

/// Nama kategori semu untuk "seluruh produk".
const kategoriSemua = 'Semua';

/// Nama kategori semu untuk produk yang ditandai favorit.
const kategoriFavorit = 'Favorit';

class KisiProduk extends StatelessWidget {
  const KisiProduk({
    required this.produk,
    required this.kategori,
    required this.terpilih,
    required this.onKategori,
    required this.onPilih,
    required this.uang,
    this.kunciCari = '',
    super.key,
  });

  final List<ProdukLokal> produk;
  final List<String> kategori;
  final String terpilih;
  final void Function(String) onKategori;
  final void Function(ProdukLokal) onPilih;
  final String Function(String) uang;
  final String kunciCari;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 38,
          child: ListView(
            key: const Key('chip-kategori'),
            scrollDirection: Axis.horizontal,
            children: [
              for (final k in [kategoriSemua, kategoriFavorit, ...kategori])
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: _Chip(
                    label: k,
                    aktif: k == terpilih,
                    onTekan: () => onKategori(k),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: produk.isEmpty
              ? Center(
                  key: const Key('kisi-kosong'),
                  child: Text(
                    kunciCari.isEmpty
                        ? 'Tidak ada produk pada kategori ini.'
                        : 'Tidak ada produk yang cocok dengan "$kunciCari".',
                    style: const TextStyle(color: Warna.teksRedup),
                  ),
                )
              : LayoutBuilder(
                  builder: (c, batas) {
                    // Jumlah kolom mengikuti lebar, bukan angka tetap: klien yang
                    // sama berjalan pada monitor kasir 24 inci dan tablet 10 inci.
                    final kolom = (batas.maxWidth / 210).floor().clamp(2, 6);
                    return GridView.builder(
                      key: const Key('kisi-produk'),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: kolom,
                        crossAxisSpacing: 12,
                        mainAxisSpacing: 12,
                        childAspectRatio: 0.82,
                      ),
                      itemCount: produk.length,
                      itemBuilder: (c, i) => _KartuProduk(
                        produk: produk[i],
                        uang: uang,
                        onTekan: () => onPilih(produk[i]),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip(
      {required this.label, required this.aktif, required this.onTekan});

  final String label;
  final bool aktif;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: aktif ? Warna.utama : Warna.kartu,
      borderRadius: BorderRadius.circular(8),
      child: InkWell(
        key: Key('kategori-$label'),
        onTap: onTekan,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: aktif ? Warna.utama : Warna.garis),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: aktif ? Colors.white : Warna.teks,
              fontSize: 13,
              fontWeight: aktif ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _KartuProduk extends StatelessWidget {
  const _KartuProduk(
      {required this.produk, required this.uang, required this.onTekan});

  final ProdukLokal produk;
  final String Function(String) uang;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    final keadaan = keadaanStok(produk.stok);
    final warna = warnaStok(keadaan);

    /*
     * Barang yang habis tetap TAMPIL, tetapi tidak dapat ditekan.
     *
     * Menyembunyikannya membuat kasir mencarinya berulang kali dan menyimpulkan
     * bahwa katalognya rusak. Yang perlu diketahuinya adalah barangnya memang
     * ada di daftar dan memang sedang habis — sehingga ia dapat mengatakannya
     * kepada pembeli, bukan mencari-cari.
     */
    final bolehDitekan = keadaan != KeadaanStok.habis;

    return Opacity(
      opacity: bolehDitekan ? 1 : 0.55,
      child: Material(
        color: Warna.kartu,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          key: Key('produk-${produk.productId}'),
          onTap: bolehDitekan ? onTekan : null,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            decoration: hiasanKartu(),
            padding: const EdgeInsets.all(10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  produk.nama,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13.5, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        uang(produk.harga),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Warna.teks,
                        ),
                      ),
                    ),
                    if (produk.stok != null)
                      Container(
                        key: Key('stok-${produk.productId}'),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: warna.latar,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          keadaan == KeadaanStok.habis
                              ? 'Habis'
                              : 'Stok ${produk.stok}',
                          style: TextStyle(
                            color: warna.teks,
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
                if (produk.penanda.isNotEmpty) ...[
                  const SizedBox(height: 5),
                  Wrap(
                    spacing: 4,
                    runSpacing: 4,
                    children: [
                      for (final p in produk.penanda.take(2))
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _warnaPenanda(p).latar,
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            p,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: _warnaPenanda(p).teks,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Expanded(child: _KotakGambar(produk: produk)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        produk.varian ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 11.5, color: Warna.teksRedup),
                      ),
                    ),
                    Container(
                      width: 28,
                      height: 28,
                      decoration: BoxDecoration(
                        color: bolehDitekan ? Warna.utama : Warna.garis,
                        borderRadius: BorderRadius.circular(7),
                      ),
                      child: Icon(
                        Icons.add,
                        size: 18,
                        color: bolehDitekan ? Colors.white : Warna.teksRedup,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

({Color latar, Color teks}) _warnaPenanda(String label) {
  final kecil = label.toLowerCase();
  if (kecil.contains('resep') || kecil.contains('keras')) {
    return (latar: const Color(0xFFFEE2E2), teks: const Color(0xFF991B1B));
  }
  if (kecil.contains('alert') ||
      kecil.contains('nark') ||
      kecil.contains('psiko')) {
    return (latar: const Color(0xFFFEF3C7), teks: const Color(0xFF92400E));
  }
  if (kecil.contains('racik') || kecil.contains('produksi')) {
    return (latar: const Color(0xFFE0F2FE), teks: const Color(0xFF075985));
  }
  return (latar: Warna.utamaMuda, teks: Warna.utama);
}

/// Kotak berwarna dengan huruf awal produk.
///
/// Salinan katalog belum membawa foto. Ini bukan tempat penampung sementara yang
/// menunggu gambar: tanpa berkas gambar di mesin, memuatnya dari jaringan justru
/// merusak alasan klien ini ada — ia harus bekerja ketika jaringan gerai putus.
class _KotakGambar extends StatelessWidget {
  const _KotakGambar({required this.produk});

  final ProdukLokal produk;

  @override
  Widget build(BuildContext context) {
    final huruf =
        produk.nama.trim().isEmpty ? '?' : produk.nama.trim()[0].toUpperCase();
    final fallback = Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: warnaKotakProduk(produk.productId),
        borderRadius: BorderRadius.circular(9),
      ),
      alignment: Alignment.center,
      child: Text(
        huruf,
        style: TextStyle(
          fontSize: 30,
          fontWeight: FontWeight.w700,
          color: Warna.teks.withValues(alpha: 0.35),
        ),
      ),
    );
    final url = produk.imageUrl;
    if (url == null || url.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(9),
      child: Image.network(
        url,
        fit: BoxFit.contain,
        errorBuilder: (_, __, ___) => fallback,
        loadingBuilder: (_, child, progress) =>
            progress == null ? child : fallback,
      ),
    );
  }
}
