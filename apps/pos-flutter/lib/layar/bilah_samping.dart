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
  ItemMenu('pelanggan', 'Pelanggan', Icons.person_outline),
  ItemMenu('stok', 'Stok', Icons.warehouse_outlined),
  ItemMenu('pembelian', 'Pembelian', Icons.shopping_bag_outlined),
  ItemMenu('promo', 'Promo', Icons.local_offer_outlined),
  ItemMenu('laporan', 'Laporan', Icons.description_outlined),
  ItemMenu('pengaturan', 'Pengaturan', Icons.settings_outlined),
];

class BilahSamping extends StatelessWidget {
  const BilahSamping({
    required this.terpilih,
    required this.onPilih,
    this.keteranganLangganan,
    super.key,
  });

  final String terpilih;
  final void Function(ItemMenu) onPilih;
  final String? keteranganLangganan;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('bilah-samping'),
      width: 214,
      color: Warna.gelap,
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
                    child:
                        const Icon(Icons.bolt, color: Colors.white, size: 19),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'eBisnis POS',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Colors.white,
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
                  for (final m in daftarMenu)
                    _BarisMenu(
                      item: m,
                      aktif: m.kunci == terpilih,
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
    required this.onTekan,
  });

  final ItemMenu item;
  final bool aktif;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    final warnaTeks = aktif ? Colors.white : const Color(0xFFCBD5E1);

    return Padding(
      padding: const EdgeInsets.only(bottom: 2),
      child: Material(
        color: aktif ? Warna.utama : Colors.transparent,
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
