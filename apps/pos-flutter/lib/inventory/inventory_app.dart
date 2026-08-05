library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

class AplikasiInventory extends StatefulWidget {
  const AplikasiInventory({
    super.key,
    this.initialPersona,
    this.initialCatalog,
  });

  final PersonaInventory? initialPersona;
  final InventoryCatalog? initialCatalog;

  @override
  State<AplikasiInventory> createState() => _AplikasiInventoryState();
}

class _AplikasiInventoryState extends State<AplikasiInventory> {
  final _client = InventoryApiClient.fromEnvironment();
  PersonaInventory? _persona;

  @override
  void initState() {
    super.initState();
    _persona = widget.initialPersona;
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'eBisnis Inventory',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F766E),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF4F7FB),
      ),
      home: _persona == null
          ? InventoryLoginPage(
              client: _client,
              onMasuk: (persona) => setState(() => _persona = persona),
            )
          : InventoryHomePage(
              client: _client,
              persona: _persona!,
              initialCatalog: widget.initialCatalog,
              onKeluar: () => setState(() => _persona = null),
            ),
    );
  }
}

class InventoryLoginPage extends StatefulWidget {
  const InventoryLoginPage({
    super.key,
    required this.client,
    required this.onMasuk,
  });

  final InventoryApiClient client;
  final ValueChanged<PersonaInventory> onMasuk;

  @override
  State<InventoryLoginPage> createState() => _InventoryLoginPageState();
}

class _InventoryLoginPageState extends State<InventoryLoginPage> {
  final _username = TextEditingController();
  final _password = TextEditingController();
  bool _sibuk = false;
  String? _galat;

  @override
  void dispose() {
    _username.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _masuk() async {
    setState(() {
      _sibuk = true;
      _galat = null;
    });
    try {
      final persona = await widget.client.login(
        username: _username.text.trim(),
        password: _password.text,
      );
      if (!mounted) return;
      widget.onMasuk(persona);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _galat = error.toString());
    } finally {
      if (mounted) setState(() => _sibuk = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 980),
              child: LayoutBuilder(
                builder: (context, box) {
                  final narrow = box.maxWidth < 760;
                  final form = _LoginCard(
                    username: _username,
                    password: _password,
                    busy: _sibuk,
                    error: _galat,
                    onSubmit: _masuk,
                  );
                  final hero = const _InventoryHero();
                  if (narrow) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [hero, const SizedBox(height: 16), form],
                    );
                  }
                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(child: hero),
                      const SizedBox(width: 28),
                      Expanded(child: form),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class InventoryHomePage extends StatefulWidget {
  const InventoryHomePage({
    super.key,
    required this.client,
    required this.persona,
    required this.onKeluar,
    this.initialCatalog,
  });

  final InventoryApiClient client;
  final PersonaInventory persona;
  final VoidCallback onKeluar;
  final InventoryCatalog? initialCatalog;

  @override
  State<InventoryHomePage> createState() => _InventoryHomePageState();
}

class _InventoryHomePageState extends State<InventoryHomePage> {
  late Future<InventorySnapshot> _snapshot = widget.client.snapshot();
  int _tab = 0;

  void _refresh() {
    setState(() => _snapshot = widget.client.snapshot());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
          NavigationDestination(
              icon: Icon(Icons.add_shopping_cart_outlined),
              label: 'Order Baru'),
          NavigationDestination(
              icon: Icon(Icons.apps_outlined), label: 'Fitur'),
          NavigationDestination(
              icon: Icon(Icons.analytics_outlined), label: 'Laporan'),
        ],
      ),
      body: SafeArea(
        child: FutureBuilder<InventorySnapshot>(
          future: _snapshot,
          builder: (context, state) {
            final data = state.data;
            return CustomScrollView(
              slivers: [
                SliverAppBar.large(
                  pinned: true,
                  backgroundColor: Colors.white,
                  foregroundColor: const Color(0xFF0F172A),
                  title: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Caruban Medika Nusantara'),
                      Text(
                        widget.persona.label,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                  actions: [
                    IconButton(
                      tooltip: 'Muat ulang',
                      onPressed: _refresh,
                      icon: const Icon(Icons.refresh),
                    ),
                    IconButton(
                      tooltip: 'Keluar',
                      onPressed: widget.onKeluar,
                      icon: const Icon(Icons.logout),
                    ),
                  ],
                ),
                if (state.connectionState != ConnectionState.done)
                  const SliverFillRemaining(
                      child: Center(child: CircularProgressIndicator()))
                else if (state.hasError)
                  SliverFillRemaining(
                    child: _ErrorPanel(
                      message: state.error.toString(),
                      onRetry: _refresh,
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList.list(
                      children: [
                        if (_tab == 0) ...[
                          _KpiGrid(snapshot: data!),
                          const SizedBox(height: 16),
                          _SectionCard(
                            title: 'Performa sales',
                            icon: Icons.groups_outlined,
                            child: Column(
                              children: data.topSales
                                  .map((row) => _ProgressLine(
                                        label: row.name,
                                        note: '${row.orders} order',
                                        value: rupiah(row.revenue),
                                        current: row.revenue,
                                        max: data.topSalesMax,
                                      ))
                                  .toList(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          _SectionCard(
                            title: 'Order terbaru',
                            icon: Icons.receipt_long_outlined,
                            child: Column(
                              children: data.orders
                                  .map((order) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        title: Text(order.number),
                                        subtitle: Text(
                                            '${order.customer} - ${order.sales}'),
                                        trailing: Text(
                                          rupiah(order.total),
                                          style: const TextStyle(
                                              fontWeight: FontWeight.w800),
                                        ),
                                      ))
                                  .toList(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          _SectionCard(
                            title: 'Rekonsiliasi legacy',
                            icon: Icons.storage_outlined,
                            child: Wrap(
                              spacing: 10,
                              runSpacing: 10,
                              children: [
                                _Pill('Raw rows', angka(data.rawRecords)),
                                _Pill('HPP bulan', rupiah(data.cogsMonth)),
                                _Pill('Laba kotor',
                                    rupiah(data.grossProfitMonth)),
                                _Pill('Piutang', rupiah(data.receivableAmount)),
                                _Pill('Hutang', rupiah(data.payableAmount)),
                                _Pill('PO legacy', angka(data.purchaseOrders)),
                                _Pill('Riwayat harga', angka(data.priceRows)),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          _SectionCard(
                            title: 'Risiko batch dan stok',
                            icon: Icons.warning_amber_outlined,
                            child: Column(
                              children: data.expiringLots
                                  .map((lot) => ListTile(
                                        contentPadding: EdgeInsets.zero,
                                        leading: const Icon(
                                            Icons.medication_outlined),
                                        title: Text(lot.productName),
                                        subtitle: Text(
                                            '${lot.productCode} - batch ${lot.lotNumber}'),
                                        trailing: Text(lot.expiryDate),
                                      ))
                                  .toList(),
                            ),
                          ),
                        ] else if (_tab == 1)
                          _SalesOrderDraftPage(
                            persona: widget.persona,
                            client: widget.client,
                            initialCatalog: widget.initialCatalog,
                          )
                        else if (_tab == 2)
                          const _InventoryFeaturePage()
                        else
                          _InventoryReportPage(snapshot: data!),
                      ],
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SalesOrderDraftPage extends StatefulWidget {
  const _SalesOrderDraftPage({
    required this.persona,
    required this.client,
    this.initialCatalog,
  });
  final PersonaInventory persona;
  final InventoryApiClient client;
  final InventoryCatalog? initialCatalog;

  @override
  State<_SalesOrderDraftPage> createState() => _SalesOrderDraftPageState();
}

class _SalesOrderDraftPageState extends State<_SalesOrderDraftPage> {
  late Future<InventoryCatalog> _catalog;
  String? _customerId;
  final Map<String, int> _qty = {};
  String? _savedMessage;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _catalog = widget.initialCatalog == null
        ? widget.client.catalog()
        : Future.value(widget.initialCatalog!);
  }

  double _total(List<InventoryProductDemo> products) => products.fold(
        0,
        (sum, product) => sum + (_qty[product.code] ?? 0) * product.price,
      );

  int get _lineCount => _qty.values.where((value) => value > 0).length;

  void _setQty(String code, int value) {
    setState(() {
      if (value <= 0) {
        _qty.remove(code);
      } else {
        _qty[code] = value;
      }
      _savedMessage = null;
    });
  }

  Future<void> _saveOrder(InventoryCatalog catalog) async {
    if (_lineCount == 0 || _customerId == null) return;
    setState(() {
      _saving = true;
      _savedMessage = null;
    });
    try {
      final order = await widget.client.createOrder(
        customerId: _customerId!,
        lines: catalog.products
            .where((product) => (_qty[product.code] ?? 0) > 0)
            .map((product) => {
                  'productId': product.id,
                  'uomId': product.uomId,
                  'qty': _qty[product.code],
                })
            .toList(),
      );
      if (!mounted) return;
      setState(() {
        _savedMessage = 'Order ${order['order_number']} berhasil dikirim.';
        _qty.clear();
      });
    } on Object catch (error) {
      if (!mounted) return;
      setState(() => _savedMessage = 'Order belum terkirim: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InventoryCatalog>(
      future: _catalog,
      builder: (context, state) {
        if (state.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.hasError || state.data == null) {
          return _ErrorPanel(
            message: state.error.toString(),
            onRetry: () => setState(() => _catalog = widget.client.catalog()),
          );
        }
        final catalog = state.data!;
        _customerId ??=
            catalog.customers.isEmpty ? null : catalog.customers.first.id;
        return _buildOrder(context, catalog);
      },
    );
  }

  Widget _buildOrder(BuildContext context, InventoryCatalog catalog) {
    return LayoutBuilder(
      builder: (context, box) {
        final wide = box.maxWidth >= 880;
        final form = _SectionCard(
          title: 'Order Baru Sales',
          icon: Icons.add_shopping_cart_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              DropdownButtonFormField<String>(
                value: _customerId,
                decoration: const InputDecoration(labelText: 'Customer'),
                items: catalog.customers
                    .map((customer) => DropdownMenuItem(
                        value: customer.id, child: Text(customer.name)))
                    .toList(),
                onChanged: (value) {
                  if (value != null) setState(() => _customerId = value);
                },
              ),
              const SizedBox(height: 12),
              Text('Sales: ${widget.persona.label}',
                  style: Theme.of(context).textTheme.labelLarge),
              const SizedBox(height: 12),
              ...catalog.products.take(100).map((product) => _ProductQtyTile(
                    product: product,
                    qty: _qty[product.code] ?? 0,
                    onChanged: (value) => _setQty(product.code, value),
                  )),
            ],
          ),
        );
        final summary = _SectionCard(
          title: 'Ringkasan Keranjang',
          icon: Icons.receipt_long_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SummaryLine('Customer', _customerName(catalog.customers)),
              _SummaryLine('Item', '$_lineCount baris'),
              _SummaryLine('Total', rupiah(_total(catalog.products)),
                  strong: true),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: _lineCount == 0 || _customerId == null || _saving
                    ? null
                    : () => _saveOrder(catalog),
                icon: Icon(_saving
                    ? Icons.sync_outlined
                    : Icons.cloud_upload_outlined),
                label: Text(_saving ? 'Mengirim...' : 'Kirim Order'),
              ),
              const SizedBox(height: 8),
              const Text(
                'Setiap kiriman memakai event id unik. Pengiriman ulang tidak membuat order ganda.',
                style: TextStyle(color: Color(0xFF64748B), height: 1.45),
              ),
              if (_savedMessage != null) ...[
                const SizedBox(height: 12),
                Text(
                  _savedMessage!,
                  style: const TextStyle(
                      color: Color(0xFF047857), fontWeight: FontWeight.w800),
                ),
              ],
            ],
          ),
        );
        if (!wide) {
          return Column(children: [form, const SizedBox(height: 16), summary]);
        }
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(flex: 3, child: form),
            const SizedBox(width: 16),
            Expanded(flex: 2, child: summary),
          ],
        );
      },
    );
  }

  String _customerName(List<InventoryCustomer> customers) {
    for (final customer in customers) {
      if (customer.id == _customerId) return customer.name;
    }
    return '-';
  }
}

class _InventoryReportPage extends StatelessWidget {
  const _InventoryReportPage({required this.snapshot});
  final InventorySnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _SectionCard(
          title: 'Laporan Pemilik',
          icon: Icons.analytics_outlined,
          child: Column(
            children: [
              _SummaryLine('Omzet bulan ini', rupiah(snapshot.revenueMonth),
                  strong: true),
              _SummaryLine('HPP bulan ini', rupiah(snapshot.cogsMonth)),
              _SummaryLine('Laba kotor', rupiah(snapshot.grossProfitMonth),
                  strong: true),
              _SummaryLine('Order bulan ini', angka(snapshot.ordersMonth)),
              _SummaryLine('Piutang legacy', rupiah(snapshot.receivableAmount)),
              _SummaryLine('Hutang legacy', rupiah(snapshot.payableAmount)),
              _SummaryLine('Stok tersedia', angka(snapshot.availableQty)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Kontribusi Sales',
          icon: Icons.groups_outlined,
          child: Column(
            children: snapshot.topSales
                .map((row) => _ProgressLine(
                      label: row.name,
                      note: '${row.orders} order',
                      value: rupiah(row.revenue),
                      current: row.revenue,
                      max: snapshot.topSalesMax,
                    ))
                .toList(),
          ),
        ),
      ],
    );
  }
}

class _InventoryFeaturePage extends StatelessWidget {
  const _InventoryFeaturePage();

  @override
  Widget build(BuildContext context) {
    final groups = [
      (
        'Master relasi (8 layar)',
        'Supplier, customer, sales, termasuk daftar aktif dan lunas.',
        Icons.hub_outlined,
        const [
          _FeatureItem('Data supplier', 'Identitas, tempo, bank, dan kontak.',
              Icons.local_shipping_outlined),
          _FeatureItem('Supplier terbuka', 'Saldo dan dokumen belum lunas.',
              Icons.pending_actions_outlined),
          _FeatureItem(
              'Supplier lunas',
              'Arsip transaksi yang sudah diselesaikan.',
              Icons.task_alt_outlined),
          _FeatureItem('Data customer', 'Wilayah, tempo, kontak, dan plafon.',
              Icons.storefront_outlined),
          _FeatureItem('Customer terbuka', 'Piutang aktif dan jatuh tempo.',
              Icons.account_balance_wallet_outlined),
          _FeatureItem('Customer lunas', 'Riwayat pembayaran customer.',
              Icons.verified_outlined),
          _FeatureItem('Data sales', 'Akun, wilayah, dan mapping sales.',
              Icons.badge_outlined),
          _FeatureItem('Daftar sales', 'Kinerja dan status akun lapangan.',
              Icons.groups_outlined),
        ],
      ),
      (
        'Stok dan harga (11 layar)',
        'Katalog obat, opname, harga jual/beli, cetak, dan ekspor.',
        Icons.medication_outlined,
        const [
          _FeatureItem('Daftar stok', 'Awal, masuk, keluar, akhir, batch, ED.',
              Icons.inventory_2_outlined),
          _FeatureItem('Laporan opname', 'Stok sistem, fisik, selisih, nilai.',
              Icons.fact_check_outlined),
          _FeatureItem('Cetak opname', 'Bukti pemeriksaan stok fisik.',
              Icons.print_outlined),
          _FeatureItem('Analisis harga', 'Harga beli, jual, dan margin nyata.',
              Icons.query_stats_outlined),
          _FeatureItem('Pilih harga', 'Filter stok ada, nol, dan semua.',
              Icons.filter_alt_outlined),
          _FeatureItem('Cetak harga jual', 'Daftar harga tunai dan kredit.',
              Icons.print_outlined),
          _FeatureItem('Ekspor harga/stok', 'Excel untuk pemeriksaan lapangan.',
              Icons.file_download_outlined),
          _FeatureItem('Cetak stok', 'Laporan nilai dan jumlah stok.',
              Icons.print_outlined),
          _FeatureItem('Pratinjau stok', 'Preview sebelum cetak/PDF.',
              Icons.preview_outlined),
          _FeatureItem(
              'Master harga', 'Riwayat harga per mitra.', Icons.sell_outlined),
          _FeatureItem('Harga khusus mitra', 'Harga customer dan supplier.',
              Icons.price_check_outlined),
        ],
      ),
      (
        'Pembelian dan hutang (10 layar)',
        'Pembelian, hutang supplier, pembayaran, aging, dan laporan.',
        Icons.add_business_outlined,
        const [
          _FeatureItem(
              'Transaksi pembelian',
              'Faktur, batch, ED, diskon, dan total.',
              Icons.shopping_cart_checkout_outlined),
          _FeatureItem('Daftar hutang', 'Dokumen hutang menurut supplier.',
              Icons.account_balance_outlined),
          _FeatureItem('Hutang supplier', 'Rincian faktur dan jatuh tempo.',
              Icons.receipt_long_outlined),
          _FeatureItem('Hutang lunas', 'Tampilkan arsip yang diselesaikan.',
              Icons.task_alt_outlined),
          _FeatureItem('Pembayaran hutang', 'Tunai, giro, transfer, retur.',
              Icons.payments_outlined),
          _FeatureItem('Riwayat pembayaran', 'Jejak pembayaran per faktur.',
              Icons.history_outlined),
          _FeatureItem('Cetak pembayaran', 'Bukti pembayaran supplier.',
              Icons.print_outlined),
          _FeatureItem(
              'Aging hutang',
              'Belum jatuh tempo hingga lebih 90 hari.',
              Icons.timelapse_outlined),
          _FeatureItem('Cetak faktur beli', 'Dokumen pembelian terkontrol.',
              Icons.print_outlined),
          _FeatureItem('Laporan periode', 'Rekap per supplier dan barang.',
              Icons.assessment_outlined),
        ],
      ),
      (
        'Penjualan dan piutang (13 layar)',
        'Order sales, piutang, penerimaan, nota dibawa, dan laporan.',
        Icons.point_of_sale_outlined,
        const [
          _FeatureItem(
              'Transaksi penjualan',
              'Customer, produk, harga, dan faktur.',
              Icons.shopping_bag_outlined),
          _FeatureItem('Daftar piutang', 'Dokumen piutang customer.',
              Icons.wallet_outlined),
          _FeatureItem('Piutang customer', 'Rincian faktur dan saldo.',
              Icons.receipt_long_outlined),
          _FeatureItem('Piutang lunas', 'Arsip transaksi selesai.',
              Icons.task_alt_outlined),
          _FeatureItem('Penerimaan piutang', 'Tunai, giro, transfer, retur.',
              Icons.payments_outlined),
          _FeatureItem('Riwayat penerimaan', 'Jejak penerimaan per faktur.',
              Icons.history_outlined),
          _FeatureItem('Cetak penerimaan', 'Bukti penerimaan customer.',
              Icons.print_outlined),
          _FeatureItem('Analisis customer', 'Aging dan prioritas penagihan.',
              Icons.person_search_outlined),
          _FeatureItem('Analisis sales',
              'Piutang dan kolektibilitas per sales.', Icons.groups_outlined),
          _FeatureItem('Sales bawa nota', 'Serah-terima nota untuk ditagih.',
              Icons.assignment_ind_outlined),
          _FeatureItem('Cetak serah-terima', 'Daftar nota yang dibawa sales.',
              Icons.print_outlined),
          _FeatureItem('Laporan piutang', 'Rekap piutang dan penerimaan.',
              Icons.assessment_outlined),
          _FeatureItem('Cetak laporan', 'PDF/print dengan jejak cetak.',
              Icons.print_outlined),
        ],
      ),
      (
        'Keuangan dan periode (6 layar)',
        'Jurnal, akun, laba kotor nyata, laporan, dan tutup periode.',
        Icons.admin_panel_settings_outlined,
        const [
          _FeatureItem('Kas dan jurnal', 'Jurnal harian debit/kredit.',
              Icons.account_balance_wallet_outlined),
          _FeatureItem('Akun perkiraan', 'COA 1xx sampai 6xx.',
              Icons.account_tree_outlined),
          _FeatureItem('Laba/rugi', 'Omzet, HPP snapshot, dan laba kotor.',
              Icons.query_stats_outlined),
          _FeatureItem('Cetak laba kotor', 'Rincian barang, customer, sales.',
              Icons.print_outlined),
          _FeatureItem(
              'Laporan laba/rugi',
              'Analisis periode tanpa margin rekaan.',
              Icons.analytics_outlined),
          _FeatureItem(
              'Proses akhir periode',
              'Snapshot, backup, approval, audit.',
              Icons.event_available_outlined),
        ],
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionCard(
          title: 'Peta Fitur Inventory CMN',
          icon: Icons.apps_outlined,
          child: const Text(
            'Fungsi dari aplikasi Inventory Control lama disusun ulang menjadi modul modern, responsif, dan siap tersambung ke web/API eBisnis.',
            style: TextStyle(color: Color(0xFF475569), height: 1.5),
          ),
        ),
        const SizedBox(height: 16),
        ...groups.map((group) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: _FeatureGroupCard(
                title: group.$1,
                subtitle: group.$2,
                icon: group.$3,
                items: group.$4,
              ),
            )),
      ],
    );
  }
}

class _FeatureGroupCard extends StatelessWidget {
  const _FeatureGroupCard({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.items,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final List<_FeatureItem> items;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: ExpansionTile(
        leading: Icon(icon, color: const Color(0xFF0F766E)),
        title: Text(title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
        subtitle: Text(subtitle,
            style: const TextStyle(color: Color(0xFF64748B), height: 1.35)),
        childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
        children: items.map((item) => _FeatureRow(item: item)).toList(),
      ),
    );
  }
}

class _FeatureItem {
  const _FeatureItem(this.title, this.description, this.icon);
  final String title;
  final String description;
  final IconData icon;
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.item});
  final _FeatureItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(item.icon, size: 20, color: const Color(0xFF0F766E)),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.title,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                Text(item.description,
                    style: const TextStyle(
                        color: Color(0xFF64748B), height: 1.35)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class InventoryProductDemo {
  const InventoryProductDemo({
    required this.id,
    required this.uomId,
    required this.code,
    required this.name,
    required this.price,
    required this.stock,
  });
  final String id;
  final String uomId;
  final String code;
  final String name;
  final double price;
  final int stock;
}

class InventoryCustomer {
  const InventoryCustomer(this.id, this.code, this.name);
  final String id;
  final String code;
  final String name;
}

class InventoryCatalog {
  const InventoryCatalog({required this.customers, required this.products});
  final List<InventoryCustomer> customers;
  final List<InventoryProductDemo> products;

  factory InventoryCatalog.fromApi(Map<String, Object?> data) {
    return InventoryCatalog(
      customers: ((data['customers'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => InventoryCustomer(
                (row['id'] ?? '').toString(),
                (row['code'] ?? '').toString(),
                (row['name'] ?? '').toString(),
              ))
          .toList(),
      products: ((data['products'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => InventoryProductDemo(
                id: (row['id'] ?? '').toString(),
                uomId: (row['uom_id'] ?? '').toString(),
                code: (row['code'] ?? '').toString(),
                name: (row['name'] ?? '').toString(),
                price: toDouble(row['price']),
                stock: toInt(row['available_qty']),
              ))
          .toList(),
    );
  }
}

class _ProductQtyTile extends StatelessWidget {
  const _ProductQtyTile({
    required this.product,
    required this.qty,
    required this.onChanged,
  });

  final InventoryProductDemo product;
  final int qty;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: const Color(0xFFF8FAFC),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.name,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  Text('${product.code} - stok ${angka(product.stock)}'),
                  Text(rupiah(product.price),
                      style: const TextStyle(color: Color(0xFF0F766E))),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Kurangi',
              onPressed: qty == 0 ? null : () => onChanged(qty - 1),
              icon: const Icon(Icons.remove_circle_outline),
            ),
            SizedBox(
              width: 38,
              child: Text(
                '$qty',
                textAlign: TextAlign.center,
                style: const TextStyle(fontWeight: FontWeight.w900),
              ),
            ),
            IconButton(
              tooltip: 'Tambah',
              onPressed: qty >= product.stock ? null : () => onChanged(qty + 1),
              icon: const Icon(Icons.add_circle_outline),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryLine extends StatelessWidget {
  const _SummaryLine(this.label, this.value, {this.strong = false});
  final String label;
  final String value;
  final bool strong;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 7),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(
            value,
            style: TextStyle(
              fontWeight: strong ? FontWeight.w900 : FontWeight.w700,
              fontSize: strong ? 18 : null,
            ),
          ),
        ],
      ),
    );
  }
}

class InventoryApiClient {
  InventoryApiClient({
    required this.baseUrl,
    required this.tenantCode,
    HttpClient? http,
  }) : _http = http ?? HttpClient();

  factory InventoryApiClient.fromEnvironment() => InventoryApiClient(
        baseUrl: Uri.parse(
          const String.fromEnvironment(
            'INVENTORY_API_BASE',
            defaultValue: 'https://cmnmedika-inventory.ebisnis.id/api/v1/',
          ),
        ),
        tenantCode: const String.fromEnvironment(
          'INVENTORY_TENANT',
          defaultValue: 'CMNMEDIKA',
        ),
      );

  final Uri baseUrl;
  final String tenantCode;
  final HttpClient _http;
  String? _token;

  Future<PersonaInventory> login({
    required String username,
    required String password,
  }) async {
    final data = await _request<Map<String, Object?>>(
      'POST',
      '/auth/login',
      body: {
        'username': username,
        'password': password,
        'tenantCode': tenantCode
      },
      withoutToken: true,
    );
    _token = data['accessToken'] as String?;
    if (_token == null || _token!.isEmpty) {
      throw const InventoryApiException('Token login tidak diterima.');
    }
    return akunInventory.firstWhere(
      (p) => p.username == username,
      orElse: () => PersonaInventory(
        username: username,
        label: username,
        role: 'Sales',
      ),
    );
  }

  Future<InventorySnapshot> snapshot() async {
    if (_token == null) return InventorySnapshot.demo();
    final dashboard = await _request<Map<String, Object?>>(
        'GET', '/inventory/sales-dashboard');
    final reconciliation = await _request<Map<String, Object?>>(
        'GET', '/inventory/legacy-import-reconciliation');
    return InventorySnapshot.fromApi(dashboard, reconciliation);
  }

  Future<InventoryCatalog> catalog() async {
    if (_token == null) {
      throw const InventoryApiException('Silakan masuk kembali.');
    }
    final data = await _request<Map<String, Object?>>(
        'GET', '/inventory/mobile-catalog');
    return InventoryCatalog.fromApi(data);
  }

  Future<Map<String, Object?>> createOrder({
    required String customerId,
    required List<Map<String, Object?>> lines,
  }) {
    final eventId =
        '${tenantCode}_${DateTime.now().microsecondsSinceEpoch}_${lines.length}';
    return _request<Map<String, Object?>>(
      'POST',
      '/inventory/mobile-orders',
      body: {
        'deviceEventId': eventId,
        'customerId': customerId,
        'lines': lines,
      },
    );
  }

  Future<T> _request<T extends Object?>(
    String method,
    String path, {
    Object? body,
    bool withoutToken = false,
  }) async {
    final uri =
        baseUrl.resolve(path.startsWith('/') ? path.substring(1) : path);
    final request =
        await _http.openUrl(method, uri).timeout(const Duration(seconds: 15));
    request.headers.contentType = ContentType.json;
    request.headers.set(HttpHeaders.acceptHeader, 'application/json');
    request.headers.set(HttpHeaders.acceptLanguageHeader, 'id');
    if (!withoutToken && _token != null) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $_token');
    }
    if (body != null) request.write(jsonEncode(body));
    final response = await request.close().timeout(const Duration(seconds: 30));
    final text = await response.transform(utf8.decoder).join();
    final decoded = text.isEmpty
        ? <String, Object?>{}
        : jsonDecode(text) as Map<String, Object?>;
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        decoded['success'] == false) {
      final error = decoded['error'] as Map<String, Object?>?;
      throw InventoryApiException(
          (error?['message'] ?? 'Permintaan gagal (${response.statusCode}).')
              .toString());
    }
    return decoded['data'] as T;
  }
}

class InventoryApiException implements Exception {
  const InventoryApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class PersonaInventory {
  const PersonaInventory({
    required this.username,
    required this.label,
    required this.role,
  });

  final String username;
  final String label;
  final String role;
}

const akunInventory = [
  PersonaInventory(username: 'muklis', label: 'Muklis', role: 'Pemilik'),
  PersonaInventory(username: 'masrukin', label: 'Masrukin', role: 'Sales'),
  PersonaInventory(username: 'tohirin', label: 'Tohirin', role: 'Sales'),
  PersonaInventory(username: 'nofal', label: 'Nofal', role: 'Sales'),
  PersonaInventory(username: 'agung', label: 'Agung', role: 'Sales'),
  PersonaInventory(username: 'cmnmedika', label: 'Admin CMN', role: 'Admin'),
];

class InventorySnapshot {
  const InventorySnapshot({
    required this.revenueToday,
    required this.revenueMonth,
    required this.cogsMonth,
    required this.grossProfitMonth,
    required this.ordersMonth,
    required this.products,
    required this.customers,
    required this.availableQty,
    required this.rawRecords,
    required this.receivableAmount,
    required this.payableAmount,
    required this.purchaseOrders,
    required this.priceRows,
    required this.topSales,
    required this.orders,
    required this.expiringLots,
  });

  factory InventorySnapshot.demo() => const InventorySnapshot(
        revenueToday: 16850000,
        revenueMonth: 238475000,
        cogsMonth: 196425000,
        grossProfitMonth: 42050000,
        ordersMonth: 428,
        products: 626,
        customers: 334,
        availableQty: 18420,
        rawRecords: 222944,
        receivableAmount: 156980000,
        payableAmount: 84250000,
        purchaseOrders: 11842,
        priceRows: 15037,
        topSales: [
          SalesKpi('Masrukin', 124, 78000000),
          SalesKpi('Tohirin', 108, 64250000),
          SalesKpi('Nofal', 97, 51150000),
          SalesKpi('Agung', 92, 45075000),
        ],
        orders: [
          OrderKpi(
              'CMN-20260804-F0921', 'Apotek Sehat Waras', 'Masrukin', 2450000),
          OrderKpi('CMN-20260804-F0920', 'Klinik Barokah', 'Tohirin', 1875000),
          OrderKpi(
              'CMN-20260804-F0919', 'Toko Obat Sumber Urip', 'Nofal', 1540000),
        ],
        expiringLots: [
          LotKpi('OBT-0241', 'Amoxicillin 500 mg', 'B2407A', '2026-09-12'),
          LotKpi('OBT-0187', 'Paracetamol 500 mg', 'P2601C', '2026-10-03'),
        ],
      );

  factory InventorySnapshot.fromApi(
      Map<String, Object?> dashboard, Map<String, Object?> reconciliation) {
    final summary = dashboard['summary'] as Map<String, Object?>? ?? const {};
    final totals =
        reconciliation['totals'] as Map<String, Object?>? ?? const {};
    return InventorySnapshot(
      revenueToday: toDouble(summary['revenue_today']),
      revenueMonth: toDouble(summary['revenue_month']),
      cogsMonth: toDouble(summary['cogs_month']),
      grossProfitMonth: toDouble(summary['gross_profit_month']),
      ordersMonth: toInt(summary['orders_month']),
      products: toInt(summary['products']),
      customers: toInt(summary['customers']),
      availableQty: toDouble(summary['available_qty']),
      rawRecords: toInt(totals['raw_records']),
      receivableAmount: toDouble(totals['receivable_amount']),
      payableAmount: toDouble(totals['payable_amount']),
      purchaseOrders: toInt(totals['purchase_orders']),
      priceRows: toInt(totals['price_history_rows']),
      topSales: ((dashboard['topSales'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => SalesKpi(
                (row['sales_name'] ?? 'Tanpa sales').toString(),
                toInt(row['orders']),
                toDouble(row['revenue']),
              ))
          .toList(),
      orders: ((dashboard['recentOrders'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => OrderKpi(
                (row['order_number'] ?? '-').toString(),
                (row['customer_name'] ?? 'Pelanggan').toString(),
                (row['sales_name'] ?? 'Sales').toString(),
                toDouble(row['grand_total']),
              ))
          .toList(),
      expiringLots: ((dashboard['expiringLots'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => LotKpi(
                (row['product_code'] ?? '-').toString(),
                (row['product_name'] ?? 'Produk').toString(),
                (row['lot_number'] ?? '-').toString(),
                (row['expiry_date'] ?? '-').toString(),
              ))
          .toList(),
    );
  }

  final double revenueToday;
  final double revenueMonth;
  final double cogsMonth;
  final double grossProfitMonth;
  final int ordersMonth;
  final int products;
  final int customers;
  final double availableQty;
  final int rawRecords;
  final double receivableAmount;
  final double payableAmount;
  final int purchaseOrders;
  final int priceRows;
  final List<SalesKpi> topSales;
  final List<OrderKpi> orders;
  final List<LotKpi> expiringLots;

  double get topSalesMax => topSales.fold<double>(
      1, (max, row) => row.revenue > max ? row.revenue : max);
}

class SalesKpi {
  const SalesKpi(this.name, this.orders, this.revenue);
  final String name;
  final int orders;
  final double revenue;
}

class OrderKpi {
  const OrderKpi(this.number, this.customer, this.sales, this.total);
  final String number;
  final String customer;
  final String sales;
  final double total;
}

class LotKpi {
  const LotKpi(
      this.productCode, this.productName, this.lotNumber, this.expiryDate);
  final String productCode;
  final String productName;
  final String lotNumber;
  final String expiryDate;
}

class _InventoryHero extends StatelessWidget {
  const _InventoryHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(28),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F172A), Color(0xFF0F766E)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.18),
            blurRadius: 32,
            offset: const Offset(0, 18),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 62,
            height: 62,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
            ),
            child: const Icon(Icons.medication_liquid_outlined,
                color: Color(0xFF5EEAD4), size: 36),
          ),
          const SizedBox(height: 22),
          const Text(
            'Caruban Medika Nusantara Inventory',
            style: TextStyle(
              color: Colors.white,
              fontSize: 34,
              fontWeight: FontWeight.w900,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 14),
          const Text(
            'Aplikasi kerja sales obat: order lapangan, stok, batch-expiry, piutang, hutang, pembelian, dan laporan pemilik dalam satu alur.',
            style: TextStyle(
              color: Color(0xFFE2E8F0),
              fontSize: 16,
              height: 1.6,
            ),
          ),
          const SizedBox(height: 24),
          const Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill('FEFO', 'batch expiry'),
              _Pill('Sales', 'order cepat'),
              _Pill('Owner', 'dashboard'),
              _Pill('Admin', 'rekonsiliasi'),
            ],
          ),
          const SizedBox(height: 26),
          const _HeroMetricStrip(),
        ],
      ),
    );
  }
}

class _HeroMetricStrip extends StatelessWidget {
  const _HeroMetricStrip();

  @override
  Widget build(BuildContext context) {
    final items = [
      ('626', 'SKU obat'),
      ('4', 'sales aktif'),
      ('Live', 'API CMN'),
    ];
    return Row(
      children: items
          .map((item) => Expanded(
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.11),
                    borderRadius: BorderRadius.circular(16),
                    border:
                        Border.all(color: Colors.white.withValues(alpha: 0.14)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.$1,
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900)),
                      Text(item.$2,
                          style: const TextStyle(
                              color: Color(0xFFCBD5E1), fontSize: 12)),
                    ],
                  ),
                ),
              ))
          .toList(),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.username,
    required this.password,
    required this.busy,
    required this.onSubmit,
    this.error,
  });

  final TextEditingController username;
  final TextEditingController password;
  final bool busy;
  final String? error;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE6FFFB),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child:
                      const Icon(Icons.lock_outline, color: Color(0xFF0F766E)),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Masuk Inventory CMN',
                          style: TextStyle(
                              fontSize: 23, fontWeight: FontWeight.w900)),
                      SizedBox(height: 3),
                      Text('Gunakan akun resmi yang diberikan admin.'),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 22),
            TextField(
              controller: username,
              textInputAction: TextInputAction.next,
              decoration: const InputDecoration(
                labelText: 'Username',
                prefixIcon: Icon(Icons.person_outline),
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: password,
              obscureText: true,
              onSubmitted: (_) => busy ? null : onSubmit(),
              decoration: const InputDecoration(
                labelText: 'Password',
                prefixIcon: Icon(Icons.password_outlined),
                border: OutlineInputBorder(),
              ),
            ),
            if (error != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF1F2),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFFDA4AF)),
                ),
                child: Text(error!,
                    style: const TextStyle(color: Color(0xFFBE123C))),
              ),
            ],
            const SizedBox(height: 18),
            FilledButton(
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              onPressed: busy ? null : onSubmit,
              child: Text(busy ? 'Memeriksa...' : 'Masuk'),
            ),
            const SizedBox(height: 16),
            const _SecurityNote(),
          ],
        ),
      ),
    );
  }
}

class _SecurityNote extends StatelessWidget {
  const _SecurityNote();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.verified_user_outlined,
              size: 20, color: Color(0xFF0F766E)),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'Akses dibatasi per peran. Sales hanya melihat order dan performa miliknya, pemilik melihat ringkasan seluruh sales.',
              style: TextStyle(color: Color(0xFF475569), height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.snapshot});
  final InventorySnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final items = [
      (
        'Omzet hari ini',
        rupiah(snapshot.revenueToday),
        Icons.payments_outlined
      ),
      ('Omzet bulan ini', rupiah(snapshot.revenueMonth), Icons.trending_up),
      ('Laba kotor', rupiah(snapshot.grossProfitMonth), Icons.query_stats),
      (
        'Order bulan ini',
        angka(snapshot.ordersMonth),
        Icons.receipt_long_outlined
      ),
      ('Produk obat', angka(snapshot.products), Icons.medication_outlined),
      ('Pelanggan', angka(snapshot.customers), Icons.storefront_outlined),
      ('Stok tersedia', angka(snapshot.availableQty), Icons.warehouse_outlined),
    ];
    return LayoutBuilder(
      builder: (context, box) {
        final cols = box.maxWidth > 900
            ? 3
            : box.maxWidth > 560
                ? 2
                : 1;
        return GridView.count(
          crossAxisCount: cols,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: cols == 1 ? 3.6 : 2.5,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          children: items
              .map((item) =>
                  _KpiCard(label: item.$1, value: item.$2, icon: item.$3))
              .toList(),
        );
      },
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard(
      {required this.label, required this.value, required this.icon});
  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
                backgroundColor: const Color(0xFFE0F2F1),
                foregroundColor: const Color(0xFF0F766E),
                child: Icon(icon)),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(label, style: Theme.of(context).textTheme.labelMedium),
                  Text(value,
                      style: const TextStyle(
                          fontSize: 22, fontWeight: FontWeight.w900)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard(
      {required this.title, required this.icon, required this.child});
  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: const Color(0xFF0F766E)),
                const SizedBox(width: 8),
                Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 18)),
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _ProgressLine extends StatelessWidget {
  const _ProgressLine(
      {required this.label,
      required this.note,
      required this.value,
      required this.current,
      required this.max});
  final String label;
  final String note;
  final String value;
  final double current;
  final double max;

  @override
  Widget build(BuildContext context) {
    final width = max <= 0 ? 0.0 : (current / max).clamp(0.04, 1.0);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                  child: Text('$label\n$note',
                      style: const TextStyle(height: 1.45))),
              Text(value, style: const TextStyle(fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 8),
          LinearProgressIndicator(
              value: width,
              minHeight: 8,
              borderRadius: BorderRadius.circular(99)),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text('$label: $value',
          style: const TextStyle(
              fontWeight: FontWeight.w800, color: Color(0xFF1E3A8A))),
    );
  }
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_outlined, size: 48),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 12),
            FilledButton(onPressed: onRetry, child: const Text('Coba lagi')),
          ],
        ),
      ),
    );
  }
}

String rupiah(Object? value) {
  final amount = toDouble(value);
  final text = amount.round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < text.length; i += 1) {
    final left = text.length - i;
    buffer.write(text[i]);
    if (left > 1 && left % 3 == 1) buffer.write('.');
  }
  return 'Rp $buffer';
}

String angka(Object? value) {
  final text = toDouble(value).round().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < text.length; i += 1) {
    final left = text.length - i;
    buffer.write(text[i]);
    if (left > 1 && left % 3 == 1) buffer.write('.');
  }
  return buffer.toString();
}

double toDouble(Object? value) {
  if (value is num) return value.toDouble();
  return double.tryParse((value ?? '0').toString()) ?? 0;
}

int toInt(Object? value) => toDouble(value).round();
