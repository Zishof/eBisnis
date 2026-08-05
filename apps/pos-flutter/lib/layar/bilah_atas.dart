/// Bilah atas: gerai, shift, printer, sinkronisasi, pembaruan, pengguna.
///
/// ## Aturan yang menentukan isinya
///
/// Setiap penanda di sini **hanya menyatakan yang benar-benar diketahui**. Yang
/// belum tersambung ditulis "Belum tersambung", bukan dibiarkan hijau.
///
/// Alasannya sederhana: penanda pada bilah atas dibaca sekilas, sekali di pagi
/// hari, lalu dipercaya sepanjang hari. Penanda sinkronisasi yang hijau padahal
/// tidak pernah memeriksa apa pun akan membuat gerai menutup buku dengan yakin
/// bahwa seluruh transaksinya sudah sampai di peladen.
library;

import 'package:flutter/material.dart';

import '../aturan/koneksi.dart';
import '../pembaruan/pengelola_pembaruan.dart';
import 'tema.dart';

class BilahAtas extends StatelessWidget {
  const BilahAtas({
    required this.namaOutlet,
    required this.printerSiap,
    this.shift,
    this.koneksi,
    this.namaPengguna,
    this.peranPengguna,
    this.pembaruan,
    this.onCekPembaruan,
    this.onKeluar,
    super.key,
  });

  final String namaOutlet;
  final bool printerSiap;

  /// Keterangan shift berjalan, atau null bila belum dibuka.
  final String? shift;

  /// Keadaan sambungan ke peladen, atau null bila klien ini belum pernah
  /// memeriksanya sama sekali.
  final KeadaanKoneksi? koneksi;

  final String? namaPengguna;
  final String? peranPengguna;

  final PengelolaPembaruan? pembaruan;
  final VoidCallback? onCekPembaruan;
  final VoidCallback? onKeluar;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('bilah-atas'),
      color: Warna.gelap,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Flexible(
              child: _Kapsul(
                ikon: Icons.storefront_outlined,
                utama: namaOutlet,
                lebar: true,
              ),
            ),
            const Spacer(),
            /*
             * Penanda keadaan digulung mendatar bila layarnya sempit, bukan
             * dipotong.
             *
             * Klien yang sama berjalan pada monitor kasir 24 inci dan tablet 10
             * inci lanskap. Penanda yang terpotong di ujung kanan pada tablet
             * adalah penanda printer dan sinkronisasi — dua hal yang justru
             * paling perlu terlihat.
             */
            Flexible(
              flex: 3,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                reverse: true,
                child: Row(
                  children: [
                    _Kapsul(
                      ikon: Icons.access_time,
                      atas: shift == null ? 'Shift' : 'Kas Shift',
                      utama: shift ?? 'Belum dibuka',
                      warnaUtama: shift == null ? Warna.jingga : Colors.white,
                    ),
                    const SizedBox(width: 8),
                    _Kapsul(
                      ikon: Icons.print_outlined,
                      atas: 'Printer',
                      utama: printerSiap ? 'Terhubung' : 'Tidak terpasang',
                      warnaUtama: printerSiap ? Warna.hijau : Warna.merah,
                    ),
                    const SizedBox(width: 8),
                    _Kapsul(
                      ikon: Icons.sync,
                      atas: 'Sync',
                      utama: _kataKoneksi(koneksi),
                      warnaUtama: _warnaKoneksi(koneksi),
                    ),
                    const SizedBox(width: 8),
                    _TombolPembaruan(
                        pembaruan: pembaruan, onTekan: onCekPembaruan),
                    const SizedBox(width: 8),
                    _Pengguna(nama: namaPengguna, peran: peranPengguna),
                    if (onKeluar != null) ...[
                      const SizedBox(width: 8),
                      Tooltip(
                        message: 'Keluar akun',
                        child: IconButton.filledTonal(
                          key: const Key('tombol-keluar-akun'),
                          onPressed: onKeluar,
                          icon: const Icon(Icons.logout, size: 18),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _kataKoneksi(KeadaanKoneksi? k) => switch (k) {
      KeadaanKoneksi.daring => 'Online',
      KeadaanKoneksi.terbatas => 'Terbatas',
      KeadaanKoneksi.luring => 'Luring',
      KeadaanKoneksi.memeriksa => 'Memeriksa',
      // Bukan "Online". Klien ini belum punya klien API, dan penanda hijau yang
      // tidak pernah memeriksa apa pun adalah penanda yang paling berbahaya
      // pada layar ini.
      null => 'Belum tersambung',
    };

Color _warnaKoneksi(KeadaanKoneksi? k) => switch (k) {
      KeadaanKoneksi.daring => Warna.hijau,
      KeadaanKoneksi.terbatas => Warna.jingga,
      KeadaanKoneksi.luring => Warna.merah,
      KeadaanKoneksi.memeriksa => Warna.teksAtasGelap,
      null => Warna.teksAtasGelap,
    };

class _TombolPembaruan extends StatelessWidget {
  const _TombolPembaruan({required this.pembaruan, required this.onTekan});

  final PengelolaPembaruan? pembaruan;
  final VoidCallback? onTekan;

  @override
  Widget build(BuildContext context) {
    final p = pembaruan;
    if (p == null) return const SizedBox.shrink();

    return AnimatedBuilder(
      animation: p,
      builder: (c, _) {
        final ada = p.adaPembaruan;
        final sedang = p.sedangMemeriksa;

        return Tooltip(
          message: p.hasil?.pesan ?? 'Belum diperiksa',
          child: Material(
            color: ada ? Warna.utama : Warna.gelapMuda,
            borderRadius: BorderRadius.circular(9),
            child: InkWell(
              key: const Key('tombol-cek-pembaruan'),
              // Dimatikan hanya selama pemeriksaan berjalan, supaya penekanan
              // berulang tidak menumpuk permintaan ke GitHub — yang berakhir
              // sebagai pembatasan laju, yaitu kegagalan yang tampak persis
              // seperti tidak ada jaringan.
              onTap: sedang ? null : onTekan,
              borderRadius: BorderRadius.circular(9),
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (sedang)
                      const SizedBox(
                        width: 15,
                        height: 15,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    else
                      Icon(
                        ada ? Icons.system_update_alt : Icons.refresh,
                        size: 17,
                        color: ada ? Colors.white : Warna.teksAtasGelap,
                      ),
                    const SizedBox(width: 8),
                    Text(
                      ada ? 'Pembaruan tersedia' : 'Cek pembaruan',
                      style: TextStyle(
                        color: ada ? Colors.white : Warna.teksAtasGelap,
                        fontSize: 12,
                        fontWeight: ada ? FontWeight.w600 : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Kapsul extends StatelessWidget {
  const _Kapsul({
    required this.ikon,
    required this.utama,
    this.atas,
    this.warnaUtama = Colors.white,
    this.lebar = false,
  });

  final IconData ikon;
  final String utama;
  final String? atas;
  final Color warnaUtama;
  final bool lebar;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: lebar ? 14 : 12, vertical: 7),
      decoration: BoxDecoration(
        color: Warna.gelapMuda,
        borderRadius: BorderRadius.circular(9),
        border: Border.all(color: Warna.garisGelap),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(ikon, size: 17, color: Warna.teksAtasGelap),
          const SizedBox(width: 9),
          Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (atas != null)
                Text(atas!,
                    style: const TextStyle(
                        color: Warna.teksAtasGelap, fontSize: 10.5)),
              Text(
                utama,
                style: TextStyle(
                  color: warnaUtama,
                  fontSize: lebar ? 14 : 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          if (lebar) ...[
            const SizedBox(width: 8),
            const Icon(Icons.expand_more, size: 18, color: Warna.teksAtasGelap),
          ],
        ],
      ),
    );
  }
}

class _Pengguna extends StatelessWidget {
  const _Pengguna({required this.nama, required this.peran});

  final String? nama;
  final String? peran;

  @override
  Widget build(BuildContext context) {
    // Tanpa klien API belum ada sesi. Ditulis apa adanya, bukan diisi nama
    // contoh: nama kasir pada struk dan pada audit harus berasal dari sesi yang
    // sungguhan, dan nama contoh di layar akan membuat orang mengira sudah ada.
    final tampil = nama ?? 'Belum masuk';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        CircleAvatar(
          radius: 16,
          backgroundColor: Warna.gelapMuda,
          child: Icon(
            nama == null ? Icons.person_off_outlined : Icons.person,
            size: 18,
            color: Warna.teksAtasGelap,
          ),
        ),
        const SizedBox(width: 9),
        Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(peran ?? 'Kasir',
                style: const TextStyle(
                    color: Warna.teksAtasGelap, fontSize: 10.5)),
            Text(
              tampil,
              style: TextStyle(
                color: nama == null ? Warna.jingga : Colors.white,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
