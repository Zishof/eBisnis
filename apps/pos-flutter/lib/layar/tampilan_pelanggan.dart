/// Layar pelanggan pada mesin kasir dua layar.
///
/// ## Yang menentukan bentuknya
///
/// Layar ini dibaca orang yang **tidak dapat bertanya**. Pembeli tidak dapat
/// menekan apa pun, tidak dapat menggulung, dan tidak tahu istilah yang dipakai
/// di dalam sistem. Ia hanya melihat, dan yang dilihatnya harus cukup untuk
/// menjawab satu pertanyaan: *apakah yang saya bayar sesuai dengan yang saya
/// beli?*
///
/// ## Yang TIDAK boleh muncul di sini
///
/// Layar ini menghadap ke luar meja. Yang tampak padanya tampak pula bagi orang
/// yang mengantre di belakang, bagi siapa pun yang lewat, dan bagi kamera
/// ponsel. Karena itu ia **tidak pernah** menampilkan:
///
/// - harga pokok, margin, atau nama pemasok;
/// - identitas kasir, nama pengguna, maupun peran;
/// - pesan galat teknis, nama tabel, atau jejak tumpukan;
/// - data pembeli sebelumnya — layar dikosongkan begitu transaksi selesai.
///
/// Aturan itu ditegakkan bentuk datanya: `KeadaanPelanggan` hanya dapat memuat
/// medan yang memang boleh dilihat. Tidak ada jalan bagi pemanggil untuk
/// menyisipkan sesuatu yang lain, sebab tidak ada medan untuk menampungnya.
library;

import 'package:flutter/material.dart';

/// Satu baris sebagaimana dilihat pembeli.
@immutable
class BarisPelanggan {
  const BarisPelanggan({
    required this.nama,
    required this.jumlah,
    required this.hargaSatuan,
    required this.total,
  });

  final String nama;
  final int jumlah;
  final String hargaSatuan;
  final String total;
}

/// Apa yang sedang ditampilkan kepada pembeli.
sealed class KeadaanPelanggan {
  const KeadaanPelanggan();
}

/// Belum ada transaksi. Menampilkan sapaan, bukan layar kosong.
class PelangganMenunggu extends KeadaanPelanggan {
  const PelangganMenunggu({required this.namaToko, this.sapaan});

  final String namaToko;
  final String? sapaan;
}

/// Sedang berbelanja.
class PelangganBerbelanja extends KeadaanPelanggan {
  const PelangganBerbelanja({
    required this.baris,
    required this.total,
    required this.jumlahBarang,
    this.terakhirDitambah,
  });

  final List<BarisPelanggan> baris;
  final String total;
  final int jumlahBarang;

  /// Barang yang baru saja dipindai.
  ///
  /// Ditonjolkan karena inilah saat pembeli dapat menyanggah: barang yang salah
  /// pindai jauh lebih murah diperbaiki sekarang daripada setelah struk tercetak.
  final BarisPelanggan? terakhirDitambah;
}

/// Menunggu pembayaran, dengan kembalian bila sudah dihitung.
class PelangganMembayar extends KeadaanPelanggan {
  const PelangganMembayar({
    required this.total,
    this.diserahkan,
    this.kembalian,
  });

  final String total;
  final String? diserahkan;
  final String? kembalian;
}

/// Transaksi selesai.
class PelangganSelesai extends KeadaanPelanggan {
  const PelangganSelesai({required this.total, required this.kembalian, this.nomorStruk});

  final String total;
  final String kembalian;
  final String? nomorStruk;
}

/// Layar pelanggan.
///
/// Seluruh angkanya besar dengan sengaja. Layar ini sering dipasang lebih rendah
/// daripada mata, kadang miring, dan dibaca sambil berdiri — ukuran yang nyaman
/// pada layar kasir tidak terbaca dari sisi seberang meja.
class TampilanPelanggan extends StatelessWidget {
  const TampilanPelanggan({
    required this.keadaan,
    required this.mataUang,
    super.key,
  });

  final KeadaanPelanggan keadaan;

  /// Cara menuliskan angka uang. Dilewatkan, bukan ditentukan di sini, supaya
  /// layar pelanggan dan struk memakai bentuk yang sama persis.
  final String Function(String) mataUang;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0F172A),
      padding: const EdgeInsets.all(32),
      child: DefaultTextStyle(
        style: const TextStyle(color: Colors.white, fontSize: 24),
        child: switch (keadaan) {
          PelangganMenunggu(:final namaToko, :final sapaan) =>
            _menunggu(namaToko, sapaan),
          PelangganBerbelanja(
            :final baris,
            :final total,
            :final jumlahBarang,
            :final terakhirDitambah,
          ) =>
            _berbelanja(baris, total, jumlahBarang, terakhirDitambah),
          PelangganMembayar(:final total, :final diserahkan, :final kembalian) =>
            _membayar(total, diserahkan, kembalian),
          PelangganSelesai(:final total, :final kembalian, :final nomorStruk) =>
            _selesai(total, kembalian, nomorStruk),
        },
      ),
    );
  }

  Widget _menunggu(String namaToko, String? sapaan) => Center(
        key: const Key('pelanggan-menunggu'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              namaToko,
              style: const TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            if (sapaan != null) ...[
              const SizedBox(height: 16),
              Text(sapaan, style: const TextStyle(fontSize: 28, color: Colors.white70)),
            ],
          ],
        ),
      );

  Widget _berbelanja(
    List<BarisPelanggan> baris,
    String total,
    int jumlahBarang,
    BarisPelanggan? terakhir,
  ) =>
      Column(
        key: const Key('pelanggan-berbelanja'),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (terakhir != null)
            Container(
              key: const Key('pelanggan-terakhir'),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      terakhir.nama,
                      style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w600),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Text(
                    '${terakhir.jumlah} × ${mataUang(terakhir.hargaSatuan)}',
                    style: const TextStyle(fontSize: 26, color: Colors.white70),
                  ),
                ],
              ),
            ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              // Baris terbaru di atas: pembeli melihat yang baru saja dipindai
              // tanpa perlu menunggu daftarnya bergulir.
              reverse: true,
              itemCount: baris.length,
              itemBuilder: (context, i) {
                final b = baris[baris.length - 1 - i];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${b.jumlah} × ${b.nama}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      Text(mataUang(b.total)),
                    ],
                  ),
                );
              },
            ),
          ),
          const Divider(color: Colors.white24, height: 32),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$jumlahBarang barang', style: const TextStyle(color: Colors.white70)),
              Text(
                mataUang(total),
                key: const Key('pelanggan-total'),
                style: const TextStyle(fontSize: 56, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      );

  Widget _membayar(String total, String? diserahkan, String? kembalian) => Center(
        key: const Key('pelanggan-membayar'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _angkaBesar('Total', total, 56),
            if (diserahkan != null) ...[
              const SizedBox(height: 24),
              _angkaBesar('Diterima', diserahkan, 40),
            ],
            if (kembalian != null) ...[
              const SizedBox(height: 24),
              /*
               * Kembalian adalah angka yang diperiksa KEDUA orang, dan satu-satunya
               * yang pembeli tidak dapat hitung ulang dengan mudah sambil berdiri.
               * Karena itu ia yang paling besar, bahkan lebih besar daripada total.
               */
              _angkaBesar('Kembalian', kembalian, 72, warna: const Color(0xFF34D399)),
            ],
          ],
        ),
      );

  Widget _selesai(String total, String kembalian, String? nomorStruk) => Center(
        key: const Key('pelanggan-selesai'),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Terima kasih',
              style: TextStyle(fontSize: 48, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            _angkaBesar('Kembalian', kembalian, 56, warna: const Color(0xFF34D399)),
            if (nomorStruk != null) ...[
              const SizedBox(height: 24),
              Text(
                'Struk $nomorStruk',
                style: const TextStyle(fontSize: 20, color: Colors.white54),
              ),
            ],
          ],
        ),
      );

  Widget _angkaBesar(String label, String nilai, double ukuran, {Color? warna}) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(label, style: const TextStyle(fontSize: 24, color: Colors.white70)),
          const SizedBox(height: 4),
          Text(
            mataUang(nilai),
            style: TextStyle(
              fontSize: ukuran,
              fontWeight: FontWeight.bold,
              color: warna ?? Colors.white,
            ),
          ),
        ],
      );
}
