/// Panel keranjang di sisi kanan.
///
/// ## Yang tampil di sini adalah yang dihitung, bukan yang diketik
///
/// Seluruh angka pada panel ini berasal dari `hitungKeranjangLuring`, modul yang
/// sama dengan klien web dan diikat vektor konformansi bersama. Panel ini tidak
/// menjumlahkan apa pun sendiri — ia hanya menuliskannya.
///
/// Baris yang tidak punya nilai **tidak ditampilkan sebagai nol**. Diskon
/// bernilai Rp 0 pada gerai yang memang tidak berdiskon terlihat seperti diskon
/// yang gagal terpasang, dan itu berakhir sebagai pertanyaan kepada kasir yang
/// tidak dapat dijawabnya.
library;

import 'package:flutter/material.dart';

import '../aturan/harga_luring.dart';
import 'sumber.dart';
import 'tema.dart';

/// Jenis pesanan sebagaimana pada rancangan.
///
/// Disimpan sebagai keadaan setempat dan dicetak pada struk. Ia belum dikirim ke
/// peladen — klien API-nya belum ada — dan itu disebutkan apa adanya di README
/// alih-alih dibiarkan tampak sudah tercatat.
enum JenisPesanan { dineIn, takeAway, delivery }

const Map<JenisPesanan, String> namaJenisPesanan = {
  JenisPesanan.dineIn: 'Dine In',
  JenisPesanan.takeAway: 'Take Away',
  JenisPesanan.delivery: 'Delivery',
};

const Map<JenisPesanan, IconData> ikonJenisPesanan = {
  JenisPesanan.dineIn: Icons.restaurant_outlined,
  JenisPesanan.takeAway: Icons.shopping_bag_outlined,
  JenisPesanan.delivery: Icons.delivery_dining_outlined,
};

class PanelKeranjang extends StatelessWidget {
  const PanelKeranjang({
    required this.hasil,
    required this.metode,
    required this.uang,
    required this.jenis,
    required this.onJenis,
    required this.onUbahJumlah,
    required this.onHapus,
    required this.onBayar,
    required this.kendaliCatatan,
    super.key,
  });

  final HasilKeranjang hasil;
  final List<MetodeBayar> metode;
  final String Function(String) uang;
  final JenisPesanan jenis;
  final void Function(JenisPesanan) onJenis;

  /// Menerima indeks baris dan selisih jumlah (+1 / -1).
  final void Function(int, int) onUbahJumlah;
  final void Function(int) onHapus;

  /// Null berarti belum boleh membayar — keranjang kosong.
  final void Function(MetodeBayar)? onBayar;

  final TextEditingController kendaliCatatan;

  @override
  Widget build(BuildContext context) {
    final kosong = hasil.lines.isEmpty;

    return Container(
      width: 380,
      decoration: hiasanKartu(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _TabJenis(jenis: jenis, onPilih: onJenis),
          const Divider(height: 1, color: Warna.garis),
          const Padding(
            padding: EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: Row(
              children: [
                Expanded(child: _PemilihMati(ikon: Icons.person_outline, label: 'Pelanggan Umum')),
                SizedBox(width: 8),
                Expanded(child: _PemilihMati(ikon: Icons.table_bar_outlined, label: 'Tanpa meja')),
              ],
            ),
          ),
          Expanded(
            child: kosong
                ? const Center(
                    key: Key('keranjang-kosong'),
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'Pindai barang atau tekan produk di sebelah kiri\nuntuk mulai melayani pembeli.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Warna.teksRedup),
                      ),
                    ),
                  )
                : ListView.separated(
                    key: const Key('daftar-keranjang'),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: hasil.lines.length,
                    separatorBuilder: (c, i) => const Divider(height: 1, color: Warna.garis),
                    itemBuilder: (c, i) => _BarisKeranjang(
                      baris: hasil.lines[i],
                      indeks: i,
                      uang: uang,
                      onUbah: onUbahJumlah,
                      onHapus: onHapus,
                    ),
                  ),
          ),
          const Divider(height: 1, color: Warna.garis),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text(
                  'Catatan Pesanan (Opsional)',
                  style: TextStyle(fontSize: 11.5, color: Warna.teksRedup),
                ),
                const SizedBox(height: 6),
                TextField(
                  key: const Key('catatan-pesanan'),
                  controller: kendaliCatatan,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Contoh: tanpa gula, pisah saus, dll',
                    hintStyle: const TextStyle(fontSize: 13, color: Warna.teksRedup),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
                const SizedBox(height: 10),
                _Ringkas(label: 'Subtotal', nilai: uang(hasil.subtotal)),
                // Pajak hanya disebut bila memang ada tarifnya. Baris "Pajak
                // Rp 0" pada gerai non-PKP terlihat seperti pajak yang gagal
                // terpasang.
                if (hasil.taxTotal != '0' && hasil.taxTotal != '0.00')
                  _Ringkas(label: 'Pajak', nilai: uang(hasil.taxTotal)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Flexible(
                  child: Text(
                    'Total Pembayaran',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                  ),
                ),
                const SizedBox(width: 8),
                // Angka total TIDAK boleh dipendekkan. Ia satu-satunya yang
                // dibacakan kepada pembeli, dan "Rp 36.0…" adalah kesalahan yang
                // baru ketahuan ketika uangnya sudah diterima.
                Text(
                  uang(hasil.grandTotal),
                  key: const Key('total'),
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    color: Warna.utama,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: _TombolBayar(metode: metode, onBayar: kosong ? null : onBayar),
          ),
        ],
      ),
    );
  }
}

class _TabJenis extends StatelessWidget {
  const _TabJenis({required this.jenis, required this.onPilih});

  final JenisPesanan jenis;
  final void Function(JenisPesanan) onPilih;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final j in JenisPesanan.values)
          Expanded(
            child: InkWell(
              key: Key('jenis-${j.name}'),
              onTap: () => onPilih(j),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 12),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      color: j == jenis ? Warna.utama : Colors.transparent,
                      width: 2.5,
                    ),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      ikonJenisPesanan[j],
                      size: 17,
                      color: j == jenis ? Warna.utama : Warna.teksRedup,
                    ),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        namaJenisPesanan[j]!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: j == jenis ? FontWeight.w600 : FontWeight.w500,
                          color: j == jenis ? Warna.utama : Warna.teksRedup,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// Pemilih yang sengaja tidak dapat ditekan.
///
/// Daftar pelanggan dan daftar meja datang dari peladen, dan klien API-nya belum
/// ada. Ditampilkan supaya bentuk layarnya sesuai rancangan, tetapi dimatikan
/// dan diberi keterangan — tombol yang terbuka lalu menampilkan daftar kosong
/// membuat kasir mengira data pelanggannya hilang.
class _PemilihMati extends StatelessWidget {
  const _PemilihMati({required this.ikon, required this.label});

  final IconData ikon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: 'Belum tersambung ke peladen',
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        decoration: BoxDecoration(
          color: Warna.halaman,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Warna.garis),
        ),
        child: Row(
          children: [
            Icon(ikon, size: 16, color: Warna.teksRedup),
            const SizedBox(width: 7),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 12, color: Warna.teksRedup),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BarisKeranjang extends StatelessWidget {
  const _BarisKeranjang({
    required this.baris,
    required this.indeks,
    required this.uang,
    required this.onUbah,
    required this.onHapus,
  });

  final HasilBaris baris;
  final int indeks;
  final String Function(String) uang;
  final void Function(int, int) onUbah;
  final void Function(int) onHapus;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: warnaKotakProduk(baris.productId),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Text(
              baris.name.trim().isEmpty ? '?' : baris.name.trim()[0].toUpperCase(),
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: Warna.teks.withValues(alpha: 0.4),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  baris.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                Text(
                  uang(baris.unitPrice),
                  style: const TextStyle(fontSize: 11.5, color: Warna.teksRedup),
                ),
              ],
            ),
          ),
          _Stepper(indeks: indeks, jumlah: baris.quantity, onUbah: onUbah),
          SizedBox(
            width: 84,
            child: Text(
              uang(baris.lineTotal),
              key: Key('total-baris-$indeks'),
              textAlign: TextAlign.end,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
          ),
          IconButton(
            key: Key('hapus-$indeks'),
            onPressed: () => onHapus(indeks),
            icon: const Icon(Icons.close, size: 17),
            color: Warna.teksRedup,
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            padding: EdgeInsets.zero,
            tooltip: 'Keluarkan dari keranjang',
          ),
        ],
      ),
    );
  }
}

class _Stepper extends StatelessWidget {
  const _Stepper({required this.indeks, required this.jumlah, required this.onUbah});

  final int indeks;
  final int jumlah;
  final void Function(int, int) onUbah;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Warna.garis),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _TombolStep(kunci: 'kurang-$indeks', ikon: Icons.remove, onTekan: () => onUbah(indeks, -1)),
          SizedBox(
            width: 26,
            child: Text(
              '$jumlah',
              key: Key('jumlah-$indeks'),
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
            ),
          ),
          _TombolStep(kunci: 'tambah-$indeks', ikon: Icons.add, onTekan: () => onUbah(indeks, 1)),
        ],
      ),
    );
  }
}

class _TombolStep extends StatelessWidget {
  const _TombolStep({required this.kunci, required this.ikon, required this.onTekan});

  final String kunci;
  final IconData ikon;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: Key(kunci),
      onTap: onTekan,
      child: Padding(
        padding: const EdgeInsets.all(6),
        child: Icon(ikon, size: 15, color: Warna.teks),
      ),
    );
  }
}

class _Ringkas extends StatelessWidget {
  const _Ringkas({required this.label, required this.nilai});

  final String label;
  final String nilai;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Text(label, style: const TextStyle(fontSize: 12.5, color: Warna.teksRedup)),
          const Spacer(),
          Text(nilai, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _TombolBayar extends StatelessWidget {
  const _TombolBayar({required this.metode, required this.onBayar});

  final List<MetodeBayar> metode;
  final void Function(MetodeBayar)? onBayar;

  @override
  Widget build(BuildContext context) {
    if (metode.isEmpty) {
      // Metode pembayaran berasal dari salinan peladen. Menambahkan "Tunai"
      // sendiri di sini berarti klien ini memutuskan cara gerai menerima uang.
      return const Text(
        'Belum ada metode pembayaran pada salinan di mesin ini.',
        style: TextStyle(color: Warna.merah, fontSize: 12.5),
      );
    }

    // Dua per baris, dengan lebar yang dibagi rata alih-alih ditetapkan.
    //
    // Lebar tetap akan meluber begitu sebuah gerai menamai metodenya lebih
    // panjang daripada dugaan — dan nama metode pembayaran datang dari peladen,
    // bukan dari sini.
    final baris = <List<int>>[];
    for (var i = 0; i < metode.length; i += 2) {
      baris.add([for (var j = i; j < i + 2 && j < metode.length; j += 1) j]);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final b in baris)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                for (final i in b) ...[
                  if (i != b.first) const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      // Kunci tetap pada tombol pertama: itulah tombol bayar
                      // utama, dan uji layar menuntutnya mati selama keranjang
                      // kosong.
                      key: Key(i == 0 ? 'tombol-bayar' : 'bayar-${metode[i].id}'),
                      onPressed: onBayar == null ? null : () => onBayar!(metode[i]),
                      style: FilledButton.styleFrom(
                        backgroundColor: warnaMetode(metode[i].id),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: Icon(_ikonMetode(metode[i].id), size: 18),
                      label: Text(
                        metode[i].nama,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
                // Menjaga tombol tunggal pada baris terakhir tetap selebar
                // setengah, bukan melebar sendiri dan tampak seperti tombol lain.
                if (b.length == 1 && baris.length > 1) ...[
                  const SizedBox(width: 8),
                  const Spacer(),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

IconData _ikonMetode(String id) {
  final k = id.toUpperCase();
  if (k.contains('TUNAI') || k.contains('CASH')) return Icons.payments_outlined;
  if (k.contains('QR')) return Icons.qr_code_2;
  if (k.contains('KARTU') || k.contains('CARD') || k.contains('DEBIT')) {
    return Icons.credit_card;
  }
  if (k.contains('TRANSFER') || k.contains('BANK')) return Icons.account_balance_outlined;
  return Icons.payment_outlined;
}
