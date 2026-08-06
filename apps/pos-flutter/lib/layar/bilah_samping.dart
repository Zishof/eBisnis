/// Bilah navigasi kiri.
library;

import 'package:flutter/material.dart';

import 'tema.dart';

class ItemMenu {
  const ItemMenu(this.kunci, this.label, this.ikon, {this.diKlienIni = true});

  final String kunci;
  final String label;
  final IconData ikon;
  final bool diKlienIni;
}

const daftarMenu = [
  ItemMenu('dashboard', 'Dashboard', Icons.home_outlined),
  ItemMenu('kasir', 'Kasir/POS', Icons.shopping_cart_outlined),
  ItemMenu('produk', 'Produk', Icons.inventory_2_outlined),
  ItemMenu(
      'riwayat-pembayaran', 'Riwayat Pembayaran', Icons.receipt_long_outlined),
  ItemMenu('pelanggan', 'Pelanggan', Icons.person_outline),
  ItemMenu('stok', 'Stok', Icons.warehouse_outlined),
  ItemMenu('pembelian', 'Pembelian', Icons.shopping_bag_outlined),
  ItemMenu('promo', 'Promo', Icons.local_offer_outlined),
  ItemMenu('laporan', 'Laporan', Icons.description_outlined),
  ItemMenu('pengaturan', 'Pengaturan', Icons.settings_outlined),
];

const daftarMenuApotik = [
  ItemMenu('dashboard', 'Dashboard', Icons.home_outlined),
  ItemMenu('kasir', 'POS Apotik', Icons.medication_outlined),
  ItemMenu('produk', 'Obat & Farmasi', Icons.inventory_2_outlined),
  ItemMenu('riwayat-server', 'Riwayat Transaksi', Icons.receipt_long_outlined),
  ItemMenu('retur-apotik', 'Retur Penjualan', Icons.assignment_return_outlined),
  ItemMenu('void-apotik', 'Void & Persetujuan', Icons.block_outlined),
  ItemMenu('pelanggan', 'Pasien', Icons.person_outline),
  ItemMenu('stok', 'Stok & Expiry', Icons.warehouse_outlined),
  ItemMenu('pembelian', 'PBF & Pembelian', Icons.shopping_bag_outlined),
  ItemMenu('sinkronisasi', 'Sinkronisasi & Perangkat', Icons.sync_outlined),
  ItemMenu('shift-apotik', 'Kas & Shift', Icons.point_of_sale_outlined),
  ItemMenu('promo', 'Paket & Promo', Icons.local_offer_outlined),
  ItemMenu('laporan', 'Laporan Farmasi', Icons.description_outlined),
  ItemMenu('pengaturan', 'Pengaturan', Icons.settings_outlined),
];

class BilahSamping extends StatelessWidget {
  const BilahSamping({
    required this.terpilih,
    required this.onPilih,
    this.judul = 'eBisnis POS',
    this.ikon = Icons.bolt,
    this.menu = daftarMenu,
    this.keteranganLangganan,
    super.key,
  });

  final String terpilih;
  final void Function(ItemMenu) onPilih;
  final String judul;
  final IconData ikon;
  final List<ItemMenu> menu;
  final String? keteranganLangganan;

  @override
  Widget build(BuildContext context) {
    final apotik = judul == 'POS Apotik';
    return Container(
      key: const Key('bilah-samping'),
      width: 214,
      decoration: BoxDecoration(
        color: apotik ? Colors.white : Warna.gelap,
        border:
            apotik ? const Border(right: BorderSide(color: Warna.garis)) : null,
      ),
      child: SafeArea(
        right: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 24),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: Warna.utama,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Icon(ikon, color: Colors.white, size: 19),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      judul,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: apotik ? Warna.teks : Colors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                children: [
                  for (final m in menu)
                    _BarisMenu(
                      item: m,
                      aktif: m.kunci == terpilih,
                      terang: apotik,
                      onTekan: () => onPilih(m),
                    ),
                ],
              ),
            ),
            if (keteranganLangganan != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 8, 14, 16),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Warna.gelapMuda,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.workspace_premium_outlined,
                          color: Color(0xFFFACC15), size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          keteranganLangganan!,
                          style: const TextStyle(
                              color: Warna.teksAtasGelap, fontSize: 11),
                        ),
                      ),
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

class _BarisMenu extends StatelessWidget {
  const _BarisMenu({
    required this.item,
    required this.aktif,
    required this.terang,
    required this.onTekan,
  });

  final ItemMenu item;
  final bool aktif;
  final bool terang;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    final warnaTeks = terang
        ? (aktif ? const Color(0xFF006B68) : Warna.teksRedup)
        : (aktif ? Colors.white : const Color(0xFFCBD5E1));

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: aktif
            ? (terang ? const Color(0xFFDDF4EF) : Warna.utama)
            : Colors.transparent,
        borderRadius: BorderRadius.circular(9),
        child: InkWell(
          key: Key('menu-${item.kunci}'),
          onTap: onTekan,
          borderRadius: BorderRadius.circular(9),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
            child: Row(
              children: [
                Icon(item.ikon, size: 19, color: warnaTeks),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      color: warnaTeks,
                      fontSize: 13.5,
                      fontWeight: aktif ? FontWeight.w600 : FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
