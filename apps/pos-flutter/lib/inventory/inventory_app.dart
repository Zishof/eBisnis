library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:excel/excel.dart' hide Border;
import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'inventory_local_database.dart';
import 'inventory_supplier_workspace.dart';
import 'inventory_transaction_workspaces.dart';

class AplikasiInventory extends StatefulWidget {
  const AplikasiInventory({
    super.key,
    this.initialPersona,
    this.initialCatalog,
    this.client,
  });

  final PersonaInventory? initialPersona;
  final InventoryCatalog? initialCatalog;
  final InventoryApiClient? client;

  @override
  State<AplikasiInventory> createState() => _AplikasiInventoryState();
}

class _AplikasiInventoryState extends State<AplikasiInventory> {
  late final _client = widget.client ?? InventoryApiClient.fromEnvironment();
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
          seedColor: const Color(0xFF1769E0),
          brightness: Brightness.light,
          surface: Colors.white,
        ),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF7F9FC),
        fontFamily: 'Arial',
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          margin: EdgeInsets.zero,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8),
            side: const BorderSide(color: Color(0xFFE3E9F2)),
          ),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          isDense: true,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 13),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFFDCE3ED)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFFDCE3ED)),
          ),
        ),
        filledButtonTheme: FilledButtonThemeData(
          style: FilledButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(6),
            ),
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 15),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(6),
            ),
            side: const BorderSide(color: Color(0xFFD7E0EC)),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
        dividerColor: const Color(0xFFE7ECF3),
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
  late Future<InventoryParityContract> _parity = widget.client.parityContract();
  int _tab = 0;
  bool _syncing = false;
  int _pending = 0;

  @override
  void initState() {
    super.initState();
    unawaited(_loadPendingCount());
  }

  Future<void> _loadPendingCount() async {
    final pending = await widget.client.pendingOutboxCount();
    if (mounted) setState(() => _pending = pending);
  }

  void _refresh() {
    setState(() {
      _snapshot = widget.client.snapshot();
      _parity = widget.client.parityContract();
    });
  }

  Future<void> _synchronize() async {
    setState(() => _syncing = true);
    try {
      final result = await widget.client.synchronize();
      if (!mounted) return;
      setState(() => _pending = result.pending);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
            '${result.sent} transaksi terkirim, ${result.pending} masih menunggu.'),
      ));
      _refresh();
    } on Object catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('Sinkronisasi belum selesai: $error'),
      ));
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  void _selectTab(int value) => setState(() => _tab = value);

  String get _pageTitle => const [
        'Dashboard',
        'Sales Order',
        'Pembelian, Hutang & Piutang',
        'Master Produk & Inventori',
        'Paritas Sistem Legacy',
        'Kas, Bank & Akuntansi',
        'Reports & Analytics',
        'Panduan Penggunaan',
      ][_tab];

  String get _pageSubtitle => const [
        'Ringkasan operasional dan keuangan bisnis hari ini.',
        'Buat pesanan lapangan dengan stok dan harga pelanggan terkini.',
        'Kelola pembelian, kewajiban, penjualan, penerimaan, dan penagihan.',
        'Kelola produk, harga, batch, expiry, dan perhitungan fisik stok.',
        'Pastikan seluruh layar aplikasi lama telah tersedia dan teruji.',
        'Jurnal, buku besar, periode, rekonsiliasi, dan laporan keuangan.',
        'Pusat laporan operasional dan keuangan perusahaan.',
        'Petunjuk kerja end-to-end untuk pengguna nonteknis.',
      ][_tab];

  Widget _pageFor(InventorySnapshot? data) {
    if (_tab == 0) {
      return _InventoryDashboard(
        snapshot: data!,
        onCreateOrder: () => _selectTab(1),
      );
    }
    if (_tab == 1) {
      return _SalesOrderDraftPage(
        persona: widget.persona,
        client: widget.client,
        initialCatalog: widget.initialCatalog,
      );
    }
    if (_tab == 2) {
      return InventoryOperationsPage(
        client: widget.client,
        persona: widget.persona,
      );
    }
    if (_tab == 3) return InventoryStockPricingPage(client: widget.client);
    if (_tab == 4) return _InventoryFeaturePage(contract: _parity);
    if (_tab == 5) return InventoryFinancePage(client: widget.client);
    if (_tab == 6) return _InventoryReportPage(snapshot: data!);
    return const _InventoryManualPage();
  }

  Widget _content() {
    return FutureBuilder<InventorySnapshot>(
      future: _snapshot,
      builder: (context, state) {
        final needsSnapshot = _tab == 0 || _tab == 6;
        if (needsSnapshot && state.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (needsSnapshot && state.hasError) {
          return _ErrorPanel(
              message: state.error.toString(), onRetry: _refresh);
        }
        return Scrollbar(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _InventoryPageHeading(
                  title: _pageTitle,
                  subtitle: _pageSubtitle,
                  actions: _tab == 0
                      ? [
                          FilledButton.icon(
                            onPressed: () => _selectTab(1),
                            icon: const Icon(Icons.add, size: 18),
                            label: const Text('Buat Transaksi'),
                          ),
                          OutlinedButton.icon(
                            onPressed: _refresh,
                            icon: const Icon(Icons.tune, size: 18),
                            label: const Text('Filter Dashboard'),
                          ),
                        ]
                      : const [],
                ),
                const SizedBox(height: 18),
                _pageFor(state.data),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final desktop = box.maxWidth >= 1100;
      if (desktop) {
        return _InventoryDesktopShell(
          selectedIndex: _tab,
          persona: widget.persona,
          pending: _pending,
          syncing: _syncing,
          onSelected: _selectTab,
          onSync: _synchronize,
          onRefresh: _refresh,
          onLogout: widget.onKeluar,
          content: _content(),
        );
      }
      return _InventoryMobileShell(
        selectedIndex: _tab,
        persona: widget.persona,
        pending: _pending,
        syncing: _syncing,
        onSelected: _selectTab,
        onSync: _synchronize,
        onLogout: widget.onKeluar,
        content: _content(),
      );
    });
  }
}

class _InventoryNavItem {
  const _InventoryNavItem(this.label, this.icon);
  final String label;
  final IconData icon;
}

const _inventoryNavigation = [
  _InventoryNavItem('Dashboard', Icons.dashboard_outlined),
  _InventoryNavItem('Order Baru', Icons.receipt_long_outlined),
  _InventoryNavItem('Operasional', Icons.shopping_cart_outlined),
  _InventoryNavItem('Stok & Harga', Icons.inventory_2_outlined),
  _InventoryNavItem('Paritas', Icons.fact_check_outlined),
  _InventoryNavItem('Keuangan', Icons.account_balance_outlined),
  _InventoryNavItem('Laporan', Icons.analytics_outlined),
  _InventoryNavItem('Panduan', Icons.menu_book_outlined),
];

class _InventoryDesktopShell extends StatelessWidget {
  const _InventoryDesktopShell({
    required this.selectedIndex,
    required this.persona,
    required this.pending,
    required this.syncing,
    required this.onSelected,
    required this.onSync,
    required this.onRefresh,
    required this.onLogout,
    required this.content,
  });

  final int selectedIndex;
  final PersonaInventory persona;
  final int pending;
  final bool syncing;
  final ValueChanged<int> onSelected;
  final VoidCallback onSync;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;
  final Widget content;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Row(
          children: [
            Container(
              width: 220,
              decoration: const BoxDecoration(
                color: Colors.white,
                border: Border(right: BorderSide(color: Color(0xFFE5EAF1))),
              ),
              child: Column(
                children: [
                  const _InventoryBrand(),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(10, 8, 10, 12),
                      children: [
                        for (var index = 0;
                            index < _inventoryNavigation.length;
                            index++)
                          _InventoryNavButton(
                            item: _inventoryNavigation[index],
                            selected: selectedIndex == index,
                            onTap: () => onSelected(index),
                          ),
                        const Padding(
                          padding: EdgeInsets.fromLTRB(10, 16, 10, 8),
                          child: Text(
                            'FAVORIT',
                            style: TextStyle(
                              color: Color(0xFF1769E0),
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        const _InventoryFavorite(
                            'Penjualan Hari Ini', Icons.trending_up),
                        const _InventoryFavorite(
                            'Stok Menipis', Icons.warning_amber_outlined),
                        const _InventoryFavorite(
                            'Piutang Jatuh Tempo', Icons.schedule_outlined),
                      ],
                    ),
                  ),
                  _SyncStatusCard(
                    pending: pending,
                    syncing: syncing,
                    onSync: onSync,
                  ),
                  const Padding(
                    padding: EdgeInsets.fromLTRB(16, 8, 16, 14),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text('v2.6.0  -  eBisnis Suite',
                          style: TextStyle(
                              color: Color(0xFF8793A5), fontSize: 10)),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  _InventoryTopBar(
                    persona: persona,
                    pending: pending,
                    syncing: syncing,
                    onSync: onSync,
                    onRefresh: onRefresh,
                    onLogout: onLogout,
                  ),
                  Expanded(child: content),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InventoryMobileShell extends StatelessWidget {
  const _InventoryMobileShell({
    required this.selectedIndex,
    required this.persona,
    required this.pending,
    required this.syncing,
    required this.onSelected,
    required this.onSync,
    required this.onLogout,
    required this.content,
  });

  final int selectedIndex;
  final PersonaInventory persona;
  final int pending;
  final bool syncing;
  final ValueChanged<int> onSelected;
  final VoidCallback onSync;
  final VoidCallback onLogout;
  final Widget content;

  void _openMore(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 18),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var index = 3; index < _inventoryNavigation.length; index++)
                ListTile(
                  leading: Icon(_inventoryNavigation[index].icon),
                  title: Text(_inventoryNavigation[index].label),
                  selected: selectedIndex == index,
                  onTap: () {
                    Navigator.pop(context);
                    onSelected(index);
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.white,
        titleSpacing: 8,
        title: const Row(
          children: [
            _InventoryLogo(size: 34),
            SizedBox(width: 9),
            Expanded(
              child: Text(
                'eBisnis Inventory',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Semua modul',
            onPressed: () => _openMore(context),
            icon: const Icon(Icons.apps_outlined),
          ),
          Badge(
            isLabelVisible: pending > 0,
            label: Text('$pending'),
            child: IconButton(
              tooltip: 'Sinkronkan data',
              onPressed: syncing ? null : onSync,
              icon: syncing
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.cloud_done_outlined),
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Akun pengguna',
            onSelected: (value) {
              if (value == 'logout') onLogout();
            },
            itemBuilder: (_) => [
              PopupMenuItem(enabled: false, child: Text(persona.label)),
              const PopupMenuItem(value: 'logout', child: Text('Keluar')),
            ],
            icon: const CircleAvatar(
              radius: 15,
              backgroundColor: Color(0xFFE9F1FF),
              child: Icon(Icons.person_outline, size: 18),
            ),
          ),
        ],
      ),
      body: SafeArea(top: false, child: content),
      bottomNavigationBar: NavigationBar(
        height: 64,
        selectedIndex: switch (selectedIndex) {
          0 => 0,
          1 => 1,
          2 => 2,
          4 => 3,
          7 => 4,
          _ => 0,
        },
        onDestinationSelected: (value) {
          onSelected(const [0, 1, 2, 4, 7][value]);
        },
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.dashboard_outlined), label: 'Dashboard'),
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined), label: 'Order Baru'),
          NavigationDestination(
              icon: Icon(Icons.payments_outlined), label: 'Operasional'),
          NavigationDestination(
              icon: Icon(Icons.fact_check_outlined), label: 'Paritas'),
          NavigationDestination(
              icon: Icon(Icons.menu_book_outlined), label: 'Panduan'),
        ],
      ),
    );
  }
}

class _InventoryBrand extends StatelessWidget {
  const _InventoryBrand();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 72,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 16),
        child: Row(
          children: [
            _InventoryLogo(size: 38),
            SizedBox(width: 10),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('eBisnis',
                      style:
                          TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                  Text('Inventory Sales',
                      style: TextStyle(
                          fontSize: 11,
                          color: Color(0xFF526176),
                          fontWeight: FontWeight.w600)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InventoryLogo extends StatelessWidget {
  const _InventoryLogo({required this.size});
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: const Color(0xFF1769E0),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Icon(Icons.inventory_2_outlined, color: Colors.white),
    );
  }
}

class _InventoryNavButton extends StatelessWidget {
  const _InventoryNavButton({
    required this.item,
    required this.selected,
    required this.onTap,
  });
  final _InventoryNavItem item;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Material(
        color: selected ? const Color(0xFFEAF2FF) : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: 11),
            decoration: BoxDecoration(
              border: selected
                  ? const Border(
                      left: BorderSide(color: Color(0xFF1769E0), width: 3))
                  : null,
            ),
            child: Row(
              children: [
                Icon(item.icon,
                    size: 19,
                    color: selected
                        ? const Color(0xFF1769E0)
                        : const Color(0xFF536176)),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 13,
                      color: selected
                          ? const Color(0xFF1769E0)
                          : const Color(0xFF263449),
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                ),
                if (const {'Operasional', 'Stok & Harga', 'Keuangan'}
                    .contains(item.label))
                  const Icon(Icons.expand_more,
                      size: 16, color: Color(0xFF8290A3)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InventoryFavorite extends StatelessWidget {
  const _InventoryFavorite(this.label, this.icon);
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      child: Row(
        children: [
          Icon(icon, size: 16, color: const Color(0xFF67758A)),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: const TextStyle(fontSize: 12))),
        ],
      ),
    );
  }
}

class _SyncStatusCard extends StatelessWidget {
  const _SyncStatusCard({
    required this.pending,
    required this.syncing,
    required this.onSync,
  });
  final int pending;
  final bool syncing;
  final VoidCallback onSync;

  @override
  Widget build(BuildContext context) {
    final online = pending == 0;
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FBFE),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('STATUS SISTEM',
                    style:
                        TextStyle(fontSize: 10, fontWeight: FontWeight.w800)),
              ),
              Icon(online ? Icons.wifi : Icons.wifi_tethering_error,
                  size: 17,
                  color: online
                      ? const Color(0xFF16A34A)
                      : const Color(0xFFF59E0B)),
            ],
          ),
          const SizedBox(height: 9),
          Text(
            online ? 'Semua Sistem Online' : 'Semi Online - $pending antrean',
            style: TextStyle(
              color: online ? const Color(0xFF15803D) : const Color(0xFFD97706),
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 7),
          const Text('Terakhir sinkronisasi',
              style: TextStyle(fontSize: 10, color: Color(0xFF78869A))),
          const Text('Hari ini 10:15',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: syncing ? null : onSync,
              icon: syncing
                  ? const SizedBox.square(
                      dimension: 14,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.sync, size: 16),
              label: const Text('Sinkronisasi Sekarang',
                  style: TextStyle(fontSize: 10)),
            ),
          ),
        ],
      ),
    );
  }
}

class _InventoryTopBar extends StatelessWidget {
  const _InventoryTopBar({
    required this.persona,
    required this.pending,
    required this.syncing,
    required this.onSync,
    required this.onRefresh,
    required this.onLogout,
  });
  final PersonaInventory persona;
  final int pending;
  final bool syncing;
  final VoidCallback onSync;
  final VoidCallback onRefresh;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Color(0xFFE5EAF1))),
      ),
      child: Row(
        children: [
          const _TopSelector(
              icon: Icons.business_outlined,
              title: 'Caruban Medika Nusantara',
              subtitle: 'Tenant'),
          const SizedBox(width: 10),
          const _TopSelector(
              icon: Icons.warehouse_outlined,
              title: 'Gudang Pusat',
              subtitle: 'Cabang / Gudang'),
          const SizedBox(width: 14),
          const Expanded(
            child: TextField(
              decoration: InputDecoration(
                hintText: 'Cari menu, transaksi, pelanggan, produk...',
                prefixIcon: Icon(Icons.search, size: 20),
                suffixText: 'Ctrl + K',
              ),
            ),
          ),
          const SizedBox(width: 14),
          TextButton.icon(
            onPressed: syncing ? null : onSync,
            style: TextButton.styleFrom(
              foregroundColor: const Color(0xFF15803D),
              backgroundColor: const Color(0xFFEAF8EE),
            ),
            icon: syncing
                ? const SizedBox.square(
                    dimension: 14,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.check_circle_outline, size: 17),
            label: Text(pending == 0 ? 'Tersinkronisasi' : '$pending antrean',
                style: const TextStyle(fontSize: 11)),
          ),
          Badge(
            isLabelVisible: pending > 0,
            label: Text('$pending'),
            child: IconButton(
                tooltip: 'Notifikasi',
                onPressed: onRefresh,
                icon: const Icon(Icons.notifications_none, size: 21)),
          ),
          IconButton(
              tooltip: 'Bantuan',
              onPressed: () {},
              icon: const Icon(Icons.help_outline, size: 21)),
          const SizedBox(width: 4),
          const CircleAvatar(
            radius: 18,
            backgroundColor: Color(0xFFEAF2FF),
            child: Icon(Icons.person_outline, color: Color(0xFF1769E0)),
          ),
          const SizedBox(width: 8),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 118),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(persona.label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w800)),
                Text(persona.role,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 10, color: Color(0xFF77859A))),
              ],
            ),
          ),
          PopupMenuButton<String>(
            tooltip: 'Menu akun',
            onSelected: (value) {
              if (value == 'logout') onLogout();
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'logout', child: Text('Keluar')),
            ],
          ),
        ],
      ),
    );
  }
}

class _TopSelector extends StatelessWidget {
  const _TopSelector({
    required this.icon,
    required this.title,
    required this.subtitle,
  });
  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 190,
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFFDCE3ED)),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF1769E0)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 11, fontWeight: FontWeight.w800)),
                Text(subtitle,
                    style:
                        const TextStyle(color: Color(0xFF7A8799), fontSize: 9)),
              ],
            ),
          ),
          const Icon(Icons.expand_more, size: 16),
        ],
      ),
    );
  }
}

class _InventoryPageHeading extends StatelessWidget {
  const _InventoryPageHeading({
    required this.title,
    required this.subtitle,
    required this.actions,
  });
  final String title;
  final String subtitle;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final narrow = box.maxWidth < 620;
      final heading = Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: TextStyle(
                  fontSize: narrow ? 22 : 24,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF111827))),
          const SizedBox(height: 3),
          Text(subtitle,
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)),
        ],
      );
      if (narrow || actions.isEmpty) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            heading,
            if (actions.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ],
        );
      }
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(child: heading),
          Wrap(spacing: 8, runSpacing: 8, children: actions),
        ],
      );
    });
  }
}

class _InventoryDashboard extends StatelessWidget {
  const _InventoryDashboard({
    required this.snapshot,
    required this.onCreateOrder,
  });
  final InventorySnapshot snapshot;
  final VoidCallback onCreateOrder;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _KpiGrid(snapshot: snapshot),
        const SizedBox(height: 14),
        LayoutBuilder(builder: (context, box) {
          final desktop = box.maxWidth >= 1180;
          final salesTrend = _SectionCard(
            title: 'Tren Penjualan',
            icon: Icons.show_chart,
            action: const _RangeChip('30 Hari Terakhir'),
            child: _DashboardTrendChart(
              total: snapshot.revenueMonth,
              color: const Color(0xFF2563EB),
              values: snapshot.salesTrend.map((row) => row.total).toList(),
            ),
          );
          final purchaseTrend = _SectionCard(
            title: 'Tren Pembelian',
            icon: Icons.shopping_cart_checkout_outlined,
            action: const _RangeChip('30 Hari Terakhir'),
            child: _DashboardTrendChart(
              total: snapshot.purchasesMonth,
              color: const Color(0xFF16A34A),
              values: snapshot.purchaseTrend.map((row) => row.total).toList(),
            ),
          );
          final products = _SectionCard(
            title: 'Top Produk Terlaris',
            icon: Icons.leaderboard_outlined,
            action:
                TextButton(onPressed: () {}, child: const Text('Lihat semua')),
            child: Column(
              children: snapshot.topProducts
                  .take(5)
                  .map((row) => _ProgressLine(
                        label: row.name,
                        note: '${angka(row.quantity)} unit',
                        value: rupiah(row.revenue),
                        current: row.revenue,
                        max: snapshot.topProductsMax,
                        dense: true,
                      ))
                  .toList(),
            ),
          );
          final aging = _SectionCard(
            title: 'Aging Piutang',
            icon: Icons.donut_large_outlined,
            action: const _RangeChip('Semua Pelanggan'),
            child: _ReceivableAging(total: snapshot.receivableAmount),
          );
          if (!desktop) {
            return Column(children: [
              salesTrend,
              const SizedBox(height: 14),
              purchaseTrend,
              const SizedBox(height: 14),
              products,
              const SizedBox(height: 14),
              aging,
            ]);
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: salesTrend),
              const SizedBox(width: 14),
              Expanded(child: purchaseTrend),
              const SizedBox(width: 14),
              Expanded(child: products),
              const SizedBox(width: 14),
              Expanded(child: aging),
            ],
          );
        }),
        const SizedBox(height: 14),
        LayoutBuilder(builder: (context, box) {
          final wide = box.maxWidth >= 1040;
          final stock = _SectionCard(
            title: 'Peringatan Stok',
            icon: Icons.warning_amber_outlined,
            action:
                TextButton(onPressed: () {}, child: const Text('Lihat semua')),
            child: _CompactRiskTable(lots: snapshot.expiringLots),
          );
          final orders = _SectionCard(
            title: 'Transaksi Terbaru',
            icon: Icons.receipt_long_outlined,
            action: TextButton(
                onPressed: onCreateOrder, child: const Text('Buat transaksi')),
            child: _CompactOrderTable(orders: snapshot.orders),
          );
          final audit = _SectionCard(
            title: 'Aktivitas Audit Trail',
            icon: Icons.history_outlined,
            action:
                TextButton(onPressed: () {}, child: const Text('Lihat semua')),
            child: _DashboardAuditTrail(orders: snapshot.orders),
          );
          if (!wide) {
            return Column(children: [
              stock,
              const SizedBox(height: 14),
              orders,
              const SizedBox(height: 14),
              audit,
            ]);
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: stock),
              const SizedBox(width: 14),
              Expanded(flex: 2, child: orders),
              const SizedBox(width: 14),
              Expanded(child: audit),
            ],
          );
        }),
      ],
    );
  }
}

class _RangeChip extends StatelessWidget {
  const _RangeChip(this.label);
  final String label;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          border: Border.all(color: const Color(0xFFDDE4EE)),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Text(label, style: const TextStyle(fontSize: 10)),
          const SizedBox(width: 4),
          const Icon(Icons.expand_more, size: 14),
        ]),
      );
}

class _DashboardTrendChart extends StatelessWidget {
  const _DashboardTrendChart({
    required this.total,
    required this.color,
    required this.values,
  });
  final double total;
  final Color color;
  final List<double> values;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 220,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Total periode',
              style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          Text(rupiah(total),
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          Expanded(
            child: CustomPaint(
              painter: _TrendPainter(values: values, color: color),
              child: const SizedBox.expand(),
            ),
          ),
          const SizedBox(height: 8),
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Awal periode',
                  style: TextStyle(fontSize: 10, color: Color(0xFF7C899A))),
              Text('Hari ini',
                  style: TextStyle(fontSize: 10, color: Color(0xFF7C899A))),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrendPainter extends CustomPainter {
  const _TrendPainter({required this.values, required this.color});
  final List<double> values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = const Color(0xFFE7ECF3)
      ..strokeWidth = 1;
    for (var i = 0; i <= 3; i++) {
      final y = size.height * i / 3;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    if (values.length < 2) return;
    final minValue = values.reduce(math.min);
    final maxValue = values.reduce(math.max);
    final span = math.max(maxValue - minValue, 1);
    final path = Path();
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height -
          ((values[i] - minValue) / span * (size.height - 12)) -
          6;
      if (i == 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    canvas.drawPath(
        path,
        Paint()
          ..color = color
          ..strokeWidth = 2.2
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round);
    for (var i = 0; i < values.length; i++) {
      final x = size.width * i / (values.length - 1);
      final y = size.height -
          ((values[i] - minValue) / span * (size.height - 12)) -
          6;
      canvas.drawCircle(Offset(x, y), 2.4, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant _TrendPainter oldDelegate) =>
      oldDelegate.values != values || oldDelegate.color != color;
}

class _ReceivableAging extends StatelessWidget {
  const _ReceivableAging({required this.total});
  final double total;

  @override
  Widget build(BuildContext context) {
    const buckets = <(String, double, Color)>[
      ('Belum jatuh tempo', .811, Color(0xFF22A35A)),
      ('1 - 30 hari', .126, Color(0xFFF4B400)),
      ('31 - 60 hari', .037, Color(0xFFF97316)),
      ('> 60 hari', .026, Color(0xFFEF4444)),
    ];
    return SizedBox(
      height: 220,
      child: Column(children: [
        const Text('Total Piutang',
            style: TextStyle(fontSize: 10, color: Color(0xFF64748B))),
        Text(rupiah(total),
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
        const SizedBox(height: 12),
        Expanded(
          child: Row(children: [
            SizedBox.square(
              dimension: 104,
              child: CustomPaint(painter: const _DonutPainter()),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: buckets
                    .map((item) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4),
                          child: Row(children: [
                            Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                    color: item.$3, shape: BoxShape.circle)),
                            const SizedBox(width: 7),
                            Expanded(
                              child: Text(item.$1,
                                  style: const TextStyle(fontSize: 9),
                                  overflow: TextOverflow.ellipsis),
                            ),
                            Text('${(item.$2 * 100).toStringAsFixed(1)}%',
                                style: const TextStyle(
                                    fontSize: 9, fontWeight: FontWeight.w800)),
                          ]),
                        ))
                    .toList(),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _DonutPainter extends CustomPainter {
  const _DonutPainter();
  @override
  void paint(Canvas canvas, Size size) {
    const buckets = <(double, Color)>[
      (.811, Color(0xFF22A35A)),
      (.126, Color(0xFFF4B400)),
      (.037, Color(0xFFF97316)),
      (.026, Color(0xFFEF4444)),
    ];
    final rect = Offset.zero & size;
    var start = -math.pi / 2;
    for (final bucket in buckets) {
      final sweep = math.pi * 2 * bucket.$1;
      canvas.drawArc(
          rect.deflate(12),
          start,
          sweep,
          false,
          Paint()
            ..color = bucket.$2
            ..strokeWidth = 18
            ..style = PaintingStyle.stroke);
      start += sweep;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _DashboardAuditTrail extends StatelessWidget {
  const _DashboardAuditTrail({required this.orders});
  final List<OrderKpi> orders;

  @override
  Widget build(BuildContext context) {
    final rows = orders.take(4).toList();
    if (rows.isEmpty) {
      return const SizedBox(
          height: 120, child: Center(child: Text('Belum ada aktivitas')));
    }
    return Column(
      children: [
        for (var i = 0; i < rows.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 7),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                    color: const Color(0xFFEAF2FF),
                    borderRadius: BorderRadius.circular(6)),
                child: Icon(
                    i.isEven
                        ? Icons.receipt_long_outlined
                        : Icons.edit_outlined,
                    size: 15,
                    color: const Color(0xFF1769E0)),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  '${rows[i].sales} ${i.isEven ? 'membuat penjualan' : 'memperbarui transaksi'}\n${rows[i].number}',
                  style: const TextStyle(fontSize: 10, height: 1.35),
                ),
              ),
            ]),
          ),
      ],
    );
  }
}

class _CompactRiskTable extends StatelessWidget {
  const _CompactRiskTable({required this.lots});
  final List<LotKpi> lots;

  @override
  Widget build(BuildContext context) {
    final rows = lots.take(5).toList();
    if (rows.isEmpty) {
      return const SizedBox(
          height: 120, child: Center(child: Text('Tidak ada risiko aktif')));
    }
    return Column(
      children: rows
          .map((lot) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded,
                        color: Color(0xFFF59E0B), size: 18),
                    const SizedBox(width: 9),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(lot.productName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700)),
                          Text('${lot.productCode} - ${lot.lotNumber}',
                              style: const TextStyle(
                                  fontSize: 10, color: Color(0xFF7A8798))),
                        ],
                      ),
                    ),
                    Text(lot.expiryDate,
                        style: const TextStyle(
                            fontSize: 10, color: Color(0xFFC2410C))),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _CompactOrderTable extends StatelessWidget {
  const _CompactOrderTable({required this.orders});
  final List<OrderKpi> orders;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return const SizedBox(
          height: 120, child: Center(child: Text('Belum ada transaksi')));
    }
    return Column(
      children: orders
          .take(6)
          .map((order) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Row(
                  children: [
                    Expanded(
                        child: Text(order.number,
                            style: const TextStyle(
                                color: Color(0xFF1769E0),
                                fontSize: 11,
                                fontWeight: FontWeight.w700))),
                    Expanded(
                        flex: 2,
                        child: Text('${order.customer} - ${order.sales}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11))),
                    Text(rupiah(order.total),
                        style: const TextStyle(
                            fontSize: 11, fontWeight: FontWeight.w800)),
                  ],
                ),
              ))
          .toList(),
    );
  }
}

class _InventoryManualPage extends StatelessWidget {
  const _InventoryManualPage();

  static const manualUrl =
      'https://inventory.ebisnis.id/panduan/inventory-sales';

  @override
  Widget build(BuildContext context) {
    const chapters = <(String, IconData, List<String>)>[
      (
        'Mulai bekerja',
        Icons.rocket_launch_outlined,
        [
          'Masuk dengan akun sendiri dan periksa tenant Caruban Medika Nusantara.',
          'Sinkronkan master customer, katalog, harga, stok batch, dan expiry.',
          'Sales memilih customer, menambahkan produk, memeriksa total, lalu mengirim order.',
          'Admin memvalidasi stok, limit piutang, dan pengiriman sebelum invoice diterbitkan.',
        ],
      ),
      (
        'Order sales lapangan',
        Icons.add_shopping_cart_outlined,
        [
          'Gunakan Order Baru, pilih customer dan produk sesuai wilayah penugasan.',
          'Periksa jumlah, harga, batch, expiry, dan ketersediaan sebelum dikirim.',
          'Jangan menekan kirim berulang; setiap order memakai identitas kejadian unik.',
          'Order tersimpan dapat dipantau sampai validasi, pengiriman, dan pembayaran.',
        ],
      ),
      (
        'Stok, batch, dan expiry',
        Icons.inventory_2_outlined,
        [
          'Gudang menggunakan FEFO: batch yang lebih cepat kedaluwarsa dikeluarkan dahulu.',
          'Stok opname mencatat stok sistem, fisik, selisih, alasan, dan petugas.',
          'Batch kedaluwarsa atau dikarantina tidak boleh dijanjikan kepada customer.',
        ],
      ),
      (
        'Piutang dan serah-terima nota',
        Icons.account_balance_wallet_outlined,
        [
          'Sales hanya melihat piutang customer yang menjadi tanggung jawabnya.',
          'Pembayaran wajib mencantumkan faktur, metode, tanggal, nominal, dan bukti.',
          'Nota yang dibawa sales diserahterimakan dan ditutup dengan jejak audit.',
        ],
      ),
      (
        'Dashboard pemilik',
        Icons.monitor_heart_outlined,
        [
          'Pantau omzet, HPP faktual, laba kotor, aging piutang, hutang, dan nilai stok.',
          'Bandingkan performa per sales, customer, produk, wilayah, serta periode.',
          'Tindak lanjuti expiry risk, stok minimum, dead stock, dan order tertahan.',
        ],
      ),
      (
        'Sinkronisasi dan bantuan',
        Icons.sync_outlined,
        [
          'Jaga koneksi saat sinkronisasi dan jangan menghapus data lokal secara manual.',
          'Jika gagal, catat waktu, akun, nomor transaksi, langkah, dan tangkapan layar.',
          'Panduan Word dan PDF lengkap tersedia pada alamat publik di bawah.',
        ],
      ),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _SectionCard(
          title: 'Panduan Inventory / Sales',
          icon: Icons.menu_book_outlined,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Panduan ringkas ini dapat dibaca tanpa meninggalkan aplikasi. Versi lengkap mencakup 16 bab dan paritas 48 layar aplikasi lama.',
              ),
              const SizedBox(height: 12),
              SelectableText(
                manualUrl,
                style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    await Clipboard.setData(
                      const ClipboardData(text: manualUrl),
                    );
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Alamat panduan berhasil disalin.'),
                      ),
                    );
                  },
                  icon: const Icon(Icons.copy_outlined),
                  label: const Text('Salin alamat panduan'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        ...chapters.map(
          (chapter) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Card(
              clipBehavior: Clip.antiAlias,
              child: ExpansionTile(
                leading: Icon(chapter.$2),
                title: Text(
                  chapter.$1,
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                childrenPadding: const EdgeInsets.fromLTRB(18, 0, 18, 16),
                children: chapter.$3
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Padding(
                              padding: EdgeInsets.only(top: 2),
                              child: Icon(
                                Icons.check_circle_outline,
                                size: 18,
                                color: Color(0xFF0F766E),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Text(item)),
                          ],
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
        ),
      ],
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
        _savedMessage = order['queued'] == true
            ? 'Order ${order['order_number']} tersimpan di perangkat dan akan dikirim otomatis saat koneksi kembali.'
            : 'Order ${order['order_number']} berhasil dikirim.';
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
    return InventorySalesOrderWorkspace(
      customers: catalog.customers
          .map((customer) => TransactionParty(
                id: customer.id,
                code: customer.code,
                name: customer.name,
              ))
          .toList(),
      products: catalog.products
          .map((product) => TransactionProduct(
                id: product.id,
                uomId: product.uomId,
                code: product.code,
                name: product.name,
                uom: 'PCS',
                price: product.price,
                stock: product.stock.toDouble(),
                imageUrl: product.imageUrl,
              ))
          .toList(),
      salesName: widget.persona.label,
      onSubmit: (submission) async {
        final order = await widget.client.createOrder(
          customerId: submission.customerId,
          taxPercent: submission.taxPercent,
          paymentTerm: submission.paymentTerm,
          note: submission.note,
          lines: submission.lines
              .map((line) => {
                    'productId': line.product.id,
                    'uomId': line.product.uomId,
                    'qty': line.quantity,
                    'unitPrice': line.unitPrice,
                    'discountPercent': line.discountPercent,
                  })
              .toList(),
        );
        final number = (order['order_number'] ?? '-').toString();
        return order['queued'] == true
            ? '$number (antrean sinkronisasi)'
            : number;
      },
    );
  }

  // Kept temporarily as a migration reference until the parity rollout closes.
  // ignore: unused_element
  Widget _buildOrderLegacy(BuildContext context, InventoryCatalog catalog) {
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

class InventoryOperationsPage extends StatefulWidget {
  const InventoryOperationsPage({
    super.key,
    required this.client,
    required this.persona,
  });

  final InventoryApiClient client;
  final PersonaInventory persona;

  @override
  State<InventoryOperationsPage> createState() =>
      _InventoryOperationsPageState();
}

class _PartyMasterLauncher extends StatelessWidget {
  const _PartyMasterLauncher({required this.client});
  final InventoryApiClient client;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Master Relasi',
      icon: Icons.hub_outlined,
      child: LayoutBuilder(builder: (context, box) {
        final width =
            box.maxWidth < 560 ? box.maxWidth : (box.maxWidth - 20) / 3;
        return Wrap(
          spacing: 10,
          runSpacing: 10,
          children: [
            _masterButton(context, width, 'suppliers', 'Pemasok',
                Icons.local_shipping_outlined),
            _masterButton(context, width, 'customers', 'Pelanggan',
                Icons.storefront_outlined),
            _masterButton(
                context, width, 'salespeople', 'Sales', Icons.badge_outlined),
          ],
        );
      }),
    );
  }

  Widget _masterButton(BuildContext context, double width, String kind,
      String label, IconData icon) {
    return SizedBox(
      width: width,
      child: OutlinedButton.icon(
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
        ),
        onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
          builder: (_) => kind == 'suppliers'
              ? InventorySupplierWorkspacePage(
                  load: client.supplierWorkspace,
                  onManage: (pageContext) => Navigator.of(pageContext).push(
                    MaterialPageRoute<void>(
                      builder: (_) => InventoryPartyMasterPage(
                        client: client,
                        initialKind: 'suppliers',
                      ),
                    ),
                  ),
                )
              : InventoryPartyMasterPage(client: client, initialKind: kind),
        )),
        icon: Icon(icon),
        label: Text(label, style: const TextStyle(fontWeight: FontWeight.w800)),
      ),
    );
  }
}

class InventoryPartyMasterPage extends StatefulWidget {
  const InventoryPartyMasterPage({
    super.key,
    required this.client,
    this.initialKind = 'suppliers',
  });

  final InventoryApiClient client;
  final String initialKind;

  @override
  State<InventoryPartyMasterPage> createState() =>
      _InventoryPartyMasterPageState();
}

class _InventoryPartyMasterPageState extends State<InventoryPartyMasterPage> {
  late String _kind = widget.initialKind;
  late Future<List<InventoryPartyRecord>> _records = _load();
  final _search = TextEditingController();
  final Map<String, TextEditingController> _fields = {};
  InventoryPartyRecord? _selected;
  bool _editing = false;
  bool _creating = false;
  bool _busy = false;
  bool _showBank = false;
  String _statusFilter = 'ALL';

  List<PartyField> get _definitions => partyFields[_kind]!;
  String get _title => partyLabels[_kind]!;

  @override
  void dispose() {
    _search.dispose();
    for (final controller in _fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<List<InventoryPartyRecord>> _load() =>
      widget.client.partyMasters(_kind);

  void _reload() {
    setState(() {
      _selected = null;
      _editing = false;
      _creating = false;
      _records = _load();
    });
  }

  void _select(InventoryPartyRecord record) {
    if ((_editing || _creating) && !_confirmDiscard()) return;
    _setSelected(record);
  }

  void _setSelected(InventoryPartyRecord record) {
    for (final definition in _definitions) {
      (_fields[definition.key] ??= TextEditingController()).text =
          (record.values[definition.key] ?? '').toString();
    }
    setState(() {
      _selected = record;
      _editing = false;
      _creating = false;
    });
  }

  bool _confirmDiscard() {
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
      content: Text('Simpan atau batalkan perubahan sebelum berpindah data.'),
    ));
    return false;
  }

  void _create() {
    if (_editing && !_confirmDiscard()) return;
    for (final definition in _definitions) {
      (_fields[definition.key] ??= TextEditingController()).clear();
    }
    setState(() {
      _selected = null;
      _editing = true;
      _creating = true;
    });
  }

  void _cancel() {
    if (_selected != null) {
      _setSelected(_selected!);
    } else {
      setState(() {
        _editing = false;
        _creating = false;
      });
    }
  }

  Future<void> _save() async {
    final code = _fields['code']?.text.trim() ?? '';
    final name = _fields['name']?.text.trim() ?? '';
    final limit = partyCodeLimits[_kind]!;
    if (code.isEmpty || name.isEmpty || code.length > limit) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content:
            Text('Kode dan nama wajib diisi; kode maksimum $limit karakter.'),
      ));
      return;
    }
    setState(() => _busy = true);
    try {
      final payload = <String, Object?>{};
      for (final definition in _definitions) {
        final value = _fields[definition.key]?.text.trim() ?? '';
        payload[definition.key] = definition.numeric
            ? (double.tryParse(value) ?? 0)
            : (value.isEmpty ? null : value);
      }
      final result = await widget.client.saveParty(
        kind: _kind,
        id: _creating ? null : _selected?.id,
        version: _creating ? null : _selected?.version,
        payload: payload,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(result.queued
            ? 'Disimpan di perangkat dan akan dikirim saat tersambung.'
            : 'Data berhasil disimpan.'),
      ));
      _reload();
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _toggleActive() async {
    final selected = _selected;
    if (selected == null) return;
    setState(() => _busy = true);
    try {
      await widget.client.toggleParty(_kind, selected);
      if (mounted) _reload();
    } on Object catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !_editing && !_creating,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmDiscard();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text('Master $_title'),
          actions: [
            IconButton(
                onPressed: _reload,
                tooltip: 'Muat ulang',
                icon: const Icon(Icons.refresh)),
            IconButton(
                onPressed: _create,
                tooltip: 'Tambah data',
                icon: const Icon(Icons.add)),
          ],
        ),
        body: SafeArea(
          child: FutureBuilder<List<InventoryPartyRecord>>(
            future: _records,
            builder: (context, state) {
              if (state.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (state.hasError) {
                return _ErrorPanel(
                    message: state.error.toString(), onRetry: _reload);
              }
              final records = state.data ?? const [];
              final query = _search.text.toLowerCase();
              final visible = records.where((record) {
                final matchesSearch = query.isEmpty ||
                    record.code.toLowerCase().contains(query) ||
                    record.name.toLowerCase().contains(query) ||
                    record.subtitle.toLowerCase().contains(query);
                final matchesStatus = _statusFilter == 'ALL' ||
                    (_statusFilter == 'ACTIVE' && record.active) ||
                    (_statusFilter == 'BALANCE' && record.balance > 0) ||
                    (_statusFilter == 'SETTLED' && record.balance <= 0);
                return matchesSearch && matchesStatus;
              }).toList();
              return LayoutBuilder(builder: (context, box) {
                final wide = box.maxWidth >= 900;
                final list = _masterList(visible);
                final detail = _masterDetail();
                if (!wide) {
                  return ListView(
                    padding: const EdgeInsets.all(12),
                    children:
                        _selected != null || _creating ? [detail] : [list],
                  );
                }
                return Row(children: [
                  SizedBox(width: 390, child: list),
                  const VerticalDivider(width: 1),
                  Expanded(
                      child: SingleChildScrollView(
                          padding: const EdgeInsets.all(18), child: detail)),
                ]);
              });
            },
          ),
        ),
      ),
    );
  }

  Widget _masterList(List<InventoryPartyRecord> records) {
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(children: [
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                    value: 'suppliers',
                    label: Text('Pemasok'),
                    icon: Icon(Icons.local_shipping_outlined)),
                ButtonSegment(
                    value: 'customers',
                    label: Text('Pelanggan'),
                    icon: Icon(Icons.storefront_outlined)),
                ButtonSegment(
                    value: 'salespeople',
                    label: Text('Sales'),
                    icon: Icon(Icons.badge_outlined)),
              ],
              selected: {_kind},
              showSelectedIcon: false,
              onSelectionChanged: (value) {
                if (_editing && !_confirmDiscard()) return;
                setState(() {
                  _kind = value.first;
                  _selected = null;
                  _records = _load();
                });
              },
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: 'Cari kode, nama, atau wilayah',
                  border: OutlineInputBorder()),
            ),
            const SizedBox(height: 8),
            Wrap(spacing: 6, children: [
              for (final item in const [
                ('ALL', 'Semua'),
                ('ACTIVE', 'Aktif'),
                ('BALANCE', 'Ada saldo'),
                ('SETTLED', 'Lunas')
              ])
                FilterChip(
                    label: Text(item.$2),
                    selected: _statusFilter == item.$1,
                    onSelected: (_) => setState(() => _statusFilter = item.$1)),
            ]),
          ]),
        ),
        const Divider(height: 1),
        if (records.isEmpty)
          const Padding(
              padding: EdgeInsets.all(32), child: Text('Data tidak ditemukan.'))
        else
          ...records.take(100).map((record) => ListTile(
                selected: record.id == _selected?.id,
                onTap: () => _select(record),
                title: Text(record.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                    '${record.code} · ${record.subtitle}\n${rupiah(record.balance)}',
                    maxLines: 2),
                isThreeLine: true,
                trailing: Icon(
                    record.active ? Icons.check_circle : Icons.pause_circle,
                    color: record.active
                        ? const Color(0xFF059669)
                        : const Color(0xFFD97706)),
              )),
      ]),
    );
  }

  Widget _masterDetail() {
    if (_selected == null && !_creating) {
      return const Card(
          child: Padding(
              padding: EdgeInsets.all(40),
              child: Center(child: Text('Pilih data untuk melihat rincian.'))));
    }
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (MediaQuery.sizeOf(context).width < 900)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: _editing || _creating
                    ? () => _confirmDiscard()
                    : () => setState(() => _selected = null),
                icon: const Icon(Icons.arrow_back),
                label: const Text('Kembali ke daftar'),
              ),
            ),
          Row(children: [
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(
                      _creating
                          ? 'DATA BARU'
                          : 'DETAIL ${_title.toUpperCase()}',
                      style: const TextStyle(
                          color: Color(0xFF0F766E),
                          fontWeight: FontWeight.w800,
                          fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(_creating ? 'Tambah $_title' : _selected!.name,
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w900)),
                ])),
            if (!_creating)
              Chip(label: Text(_selected!.active ? 'Aktif' : 'Nonaktif')),
          ]),
          if (!_creating) ...[
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              _Pill('Saldo', rupiah(_selected!.balance)),
              _Pill('Dokumen', angka(_selected!.documentCount)),
              if (_kind == 'salespeople')
                _Pill('Pelanggan', angka(_selected!.customerCount)),
            ]),
          ],
          const SizedBox(height: 16),
          LayoutBuilder(builder: (context, box) {
            final fieldWidth =
                box.maxWidth < 620 ? box.maxWidth : (box.maxWidth - 12) / 2;
            return Wrap(
                spacing: 12,
                runSpacing: 12,
                children: _definitions.map((field) {
                  final controller =
                      _fields[field.key] ??= TextEditingController();
                  final hide = field.sensitive && !_showBank && !_editing;
                  return SizedBox(
                      width: field.multiline ? box.maxWidth : fieldWidth,
                      child: TextField(
                        controller: controller,
                        enabled: _editing,
                        obscureText: hide,
                        keyboardType: field.numeric
                            ? const TextInputType.numberWithOptions(
                                decimal: true)
                            : TextInputType.text,
                        maxLines: hide ? 1 : (field.multiline ? 3 : 1),
                        maxLength:
                            field.key == 'code' ? partyCodeLimits[_kind] : null,
                        decoration: InputDecoration(
                            labelText: field.label,
                            border: const OutlineInputBorder(),
                            counterText: ''),
                      ));
                }).toList());
          }),
          if (_definitions.any((field) => field.sensitive))
            Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() => _showBank = !_showBank),
                  icon: Icon(_showBank
                      ? Icons.visibility_off_outlined
                      : Icons.visibility_outlined),
                  label: Text(_showBank
                      ? 'Sembunyikan data bank'
                      : 'Tampilkan data bank'),
                )),
          const SizedBox(height: 14),
          Wrap(
              alignment: WrapAlignment.end,
              spacing: 8,
              runSpacing: 8,
              children: [
                if (!_creating && !_editing)
                  OutlinedButton.icon(
                      onPressed: _busy ? null : _toggleActive,
                      icon: const Icon(Icons.power_settings_new),
                      label:
                          Text(_selected!.active ? 'Nonaktifkan' : 'Aktifkan')),
                if (_editing)
                  OutlinedButton.icon(
                      onPressed: _busy ? null : _cancel,
                      icon: const Icon(Icons.close),
                      label: const Text('Batal')),
                if (_editing)
                  FilledButton.icon(
                      onPressed: _busy ? null : _save,
                      icon: const Icon(Icons.save_outlined),
                      label: Text(_busy ? 'Menyimpan...' : 'Simpan')),
                if (!_editing)
                  FilledButton.icon(
                      onPressed: () => setState(() => _editing = true),
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Ubah data')),
              ]),
        ]),
      ),
    );
  }
}

class InventoryStockPricingPage extends StatefulWidget {
  const InventoryStockPricingPage({super.key, required this.client});

  final InventoryApiClient client;

  @override
  State<InventoryStockPricingPage> createState() =>
      _InventoryStockPricingPageState();
}

class _InventoryStockPricingPageState extends State<InventoryStockPricingPage> {
  late Future<InventoryStockPricingData> _data = widget.client.stockPricing();
  final _search = TextEditingController();
  String _mode = 'STOCK';
  String? _message;
  bool _busy = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  void _reload() => setState(() => _data = widget.client.stockPricing());

  Future<void> _export(List<List<Object?>> rows, String name) async {
    if (rows.isEmpty) return;
    final workbook = Excel.createExcel();
    final sheetName = workbook.getDefaultSheet()!;
    final sheet = workbook[sheetName];
    for (final row in rows) {
      sheet.appendRow(row
          .map((value) => switch (value) {
                int v => IntCellValue(v),
                double v => DoubleCellValue(v),
                _ => TextCellValue(value?.toString() ?? ''),
              })
          .toList());
    }
    final location = await getSaveLocation(
      suggestedName: '$name.xlsx',
      acceptedTypeGroups: const [
        XTypeGroup(label: 'Excel', extensions: ['xlsx'])
      ],
    );
    if (location == null) return;
    final bytes = workbook.encode() ?? const <int>[];
    await XFile.fromData(Uint8List.fromList(bytes),
            name: '$name.xlsx',
            mimeType:
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .saveTo(location.path);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Excel disimpan di ${location.path}')));
    }
  }

  Future<void> _exportPdf(
      List<String> headers, List<List<Object?>> rows, String name) async {
    if (rows.isEmpty) return;
    final document = pw.Document();
    document.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      margin: const pw.EdgeInsets.all(28),
      header: (_) => pw.Padding(
        padding: const pw.EdgeInsets.only(bottom: 12),
        child: pw.Text(name.replaceAll('-', ' ').toUpperCase(),
            style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
      ),
      build: (_) => [
        pw.TableHelper.fromTextArray(
          headers: headers,
          data: rows
              .map((row) => row.map((cell) => cell?.toString() ?? '').toList())
              .toList(),
          headerStyle: pw.TextStyle(fontWeight: pw.FontWeight.bold),
          headerDecoration: const pw.BoxDecoration(color: PdfColors.grey300),
          cellStyle: const pw.TextStyle(fontSize: 8),
          cellPadding: const pw.EdgeInsets.all(4),
        ),
      ],
      footer: (context) => pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.Text(
            'Halaman ${context.pageNumber} dari ${context.pagesCount}',
            style: const pw.TextStyle(fontSize: 8)),
      ),
    ));
    final location = await getSaveLocation(
      suggestedName: '$name.pdf',
      acceptedTypeGroups: const [
        XTypeGroup(label: 'PDF', extensions: ['pdf'])
      ],
    );
    if (location == null) return;
    final bytes = await document.save();
    await XFile.fromData(bytes, name: '$name.pdf', mimeType: 'application/pdf')
        .saveTo(location.path);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PDF disimpan di ${location.path}')));
    }
  }

  Future<void> _opnameCommand(InventoryStockOpname session) async {
    final next = switch (session.status) {
      'DRAFT' => 'freeze',
      'COUNTED' => 'approve',
      'APPROVED' => 'post',
      _ => null,
    };
    if (next == null) return;
    setState(() => _busy = true);
    try {
      await widget.client.stockOpnameCommand(session.id, next);
      setState(() => _message = 'Sesi ${session.number} berhasil diproses.');
      _reload();
    } on Object catch (error) {
      setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _countOpname(InventoryStockOpname session) async {
    setState(() => _busy = true);
    try {
      final lines = await widget.client.stockOpnameLines(session.id);
      if (!mounted) return;
      final controllers = <String, TextEditingController>{
        for (final line in lines)
          line.id: TextEditingController(
              text: line.physicalQty == null ? '' : angka(line.physicalQty!)),
      };
      final accepted = await showDialog<bool>(
        context: context,
        builder: (dialogContext) => AlertDialog(
          title: Text('Hitung fisik ${session.number}'),
          content: SizedBox(
            width: 680,
            child: lines.isEmpty
                ? const Text('Belum ada baris stok pada sesi ini.')
                : ListView.separated(
                    shrinkWrap: true,
                    itemCount: lines.length,
                    separatorBuilder: (_, __) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final line = lines[index];
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(line.name,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800)),
                                Text(
                                  '${line.code} | Batch ${line.lot ?? '-'} | Kedaluwarsa ${line.expiry ?? '-'}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 110,
                            child: Text('Sistem ${angka(line.systemQty)}',
                                textAlign: TextAlign.end),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            width: 120,
                            child: TextField(
                              controller: controllers[line.id],
                              keyboardType:
                                  const TextInputType.numberWithOptions(
                                      decimal: true),
                              decoration: const InputDecoration(
                                  labelText: 'Fisik', isDense: true),
                            ),
                          ),
                        ]),
                      );
                    },
                  ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal')),
            FilledButton(
                onPressed: lines.isEmpty
                    ? null
                    : () => Navigator.pop(dialogContext, true),
                child: const Text('Simpan hitungan')),
          ],
        ),
      );
      if (accepted != true) return;
      final payload = <Map<String, Object?>>[];
      for (final line in lines) {
        final value = controllers[line.id]?.text.trim() ?? '';
        if (value.isEmpty) continue;
        final quantity = double.tryParse(value.replaceAll(',', '.'));
        if (quantity == null || quantity < 0) {
          throw const InventoryApiException(
              'Jumlah fisik harus berupa angka nol atau lebih.');
        }
        payload.add({'lineId': line.id, 'physicalQty': quantity});
      }
      if (payload.isEmpty) {
        throw const InventoryApiException(
            'Isi minimal satu hasil hitung fisik.');
      }
      await widget.client.countStockOpname(session.id, payload);
      if (mounted) {
        setState(() => _message =
            'Hitungan fisik ${session.number} tersimpan dan dapat ditinjau.');
        _reload();
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createOpname(InventoryStockPricingData data) async {
    if (data.warehouses.isEmpty) return;
    setState(() => _busy = true);
    try {
      await widget.client.createStockOpname(data.warehouses.first.id);
      setState(() => _message = 'Sesi opname baru berhasil dibuat.');
      _reload();
    } on Object catch (error) {
      setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createPriceBook(InventoryStockPricingData data) async {
    if (data.products.isEmpty) return;
    final code = TextEditingController();
    final name = TextEditingController();
    final price = TextEditingController();
    String productId = data.products.first.id;
    String scopeType = 'TENANT';
    String? scopeId;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (context, update) {
        return AlertDialog(
          title: const Text('Buku harga baru'),
          content: SizedBox(
            width: 520,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                  controller: code,
                  decoration: const InputDecoration(labelText: 'Kode')),
              TextField(
                  controller: name,
                  decoration:
                      const InputDecoration(labelText: 'Nama buku harga')),
              DropdownButtonFormField<String>(
                value: scopeType,
                decoration: const InputDecoration(labelText: 'Lingkup harga'),
                items: const [
                  DropdownMenuItem(value: 'TENANT', child: Text('Umum tenant')),
                  DropdownMenuItem(
                      value: 'CUSTOMER', child: Text('Khusus customer')),
                  DropdownMenuItem(
                      value: 'SUPPLIER', child: Text('Harga beli supplier')),
                ],
                onChanged: (value) => update(() {
                  scopeType = value ?? 'TENANT';
                  scopeId = null;
                }),
              ),
              if (scopeType != 'TENANT')
                DropdownButtonFormField<String>(
                  value: scopeId,
                  decoration: InputDecoration(
                      labelText: scopeType == 'CUSTOMER'
                          ? 'Customer tujuan'
                          : 'Supplier tujuan'),
                  items: (scopeType == 'CUSTOMER'
                          ? data.customers
                          : data.suppliers)
                      .map((row) => DropdownMenuItem(
                          value: row.id,
                          child: Text('${row.code} - ${row.name}')))
                      .toList(),
                  onChanged: (value) => update(() => scopeId = value),
                ),
              DropdownButtonFormField<String>(
                value: productId,
                decoration: const InputDecoration(labelText: 'Produk'),
                items: data.products
                    .take(500)
                    .map((row) => DropdownMenuItem(
                        value: row.id,
                        child: Text('${row.code} - ${row.name}')))
                    .toList(),
                onChanged: (value) =>
                    update(() => productId = value ?? productId),
              ),
              TextField(
                controller: price,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Harga'),
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal')),
            FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Ajukan')),
          ],
        );
      }),
    );
    if (accepted != true) return;
    setState(() => _busy = true);
    try {
      await widget.client.createPriceBook(
        code: code.text.trim(),
        name: name.text.trim(),
        scopeType: scopeType,
        scopeId: scopeId,
        productId: productId,
        price: double.tryParse(price.text) ?? -1,
      );
      setState(() => _message = 'Buku harga dibuat dan diajukan.');
      _reload();
    } on Object catch (error) {
      setState(() => _message = error.toString());
    } finally {
      code.dispose();
      name.dispose();
      price.dispose();
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InventoryStockPricingData>(
      future: _data,
      builder: (context, state) {
        if (state.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.hasError || state.data == null) {
          return _ErrorPanel(message: state.error.toString(), onRetry: _reload);
        }
        final data = state.data!;
        final needle = _search.text.trim().toLowerCase();
        return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _SectionCard(
                title: 'Persediaan, Opname, dan Harga',
                icon: Icons.inventory_2_outlined,
                child: Column(children: [
                  SegmentedButton<String>(
                    segments: const [
                      ButtonSegment(
                          value: 'STOCK',
                          label: Text('Stok'),
                          icon: Icon(Icons.inventory_outlined)),
                      ButtonSegment(
                          value: 'OPNAME',
                          label: Text('Opname'),
                          icon: Icon(Icons.fact_check_outlined)),
                      ButtonSegment(
                          value: 'PRICE',
                          label: Text('Harga'),
                          icon: Icon(Icons.sell_outlined)),
                    ],
                    selected: {_mode},
                    onSelectionChanged: (value) =>
                        setState(() => _mode = value.first),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      labelText: 'Cari kode, produk, batch, pihak, atau sesi',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 8),
                    Align(
                        alignment: Alignment.centerLeft,
                        child: Text(_message!,
                            style:
                                const TextStyle(fontWeight: FontWeight.w700))),
                  ],
                ]),
              ),
              const SizedBox(height: 12),
              if (_mode == 'STOCK') _stockView(data, needle),
              if (_mode == 'OPNAME') _opnameView(data, needle),
              if (_mode == 'PRICE') _priceView(data, needle),
            ]);
      },
    );
  }

  Widget _stockView(InventoryStockPricingData data, String needle) {
    final rows = data.products
        .where((row) =>
            needle.isEmpty ||
            row.code.toLowerCase().contains(needle) ||
            row.name.toLowerCase().contains(needle))
        .toList();
    return _SectionCard(
      title: '${rows.length} produk',
      icon: Icons.warehouse_outlined,
      child: Column(children: [
        Align(
          alignment: Alignment.centerRight,
          child: Wrap(spacing: 8, children: [
            OutlinedButton.icon(
                onPressed: () => _export([
                      ['Kode', 'Nama', 'Satuan', 'Stok', 'Harga jual'],
                      ...rows.map((row) =>
                          [row.code, row.name, row.uom, row.stock, row.price]),
                    ], 'stok-inventory'),
                icon: const Icon(Icons.table_view_outlined),
                label: const Text('Excel')),
            FilledButton.tonalIcon(
                onPressed: () => _exportPdf(
                    ['Kode', 'Nama', 'Satuan', 'Stok', 'Harga jual'],
                    rows
                        .map((row) => [
                              row.code,
                              row.name,
                              row.uom,
                              angka(row.stock),
                              rupiah(row.price)
                            ])
                        .toList(),
                    'laporan-stok-inventory'),
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text('PDF')),
          ]),
        ),
        ...rows.take(200).map((row) => ListTile(
              contentPadding: EdgeInsets.zero,
              leading:
                  const CircleAvatar(child: Icon(Icons.medication_outlined)),
              title: Text(row.name,
                  style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('${row.code} | ${row.uom} | ${rupiah(row.price)}'),
              trailing: Chip(label: Text('Stok ${angka(row.stock)}')),
            )),
      ]),
    );
  }

  Widget _opnameView(InventoryStockPricingData data, String needle) {
    final rows = data.opnames
        .where((row) =>
            needle.isEmpty ||
            row.number.toLowerCase().contains(needle) ||
            row.warehouse.toLowerCase().contains(needle))
        .toList();
    return _SectionCard(
      title: 'Sesi stock opname',
      icon: Icons.fact_check_outlined,
      child: Column(children: [
        Align(
          alignment: Alignment.centerRight,
          child: Wrap(spacing: 8, runSpacing: 8, children: [
            FilledButton.icon(
                onPressed: _busy || data.warehouses.isEmpty
                    ? null
                    : () => _createOpname(data),
                icon: const Icon(Icons.add),
                label: const Text('Sesi baru')),
            FilledButton.tonalIcon(
                onPressed: rows.isEmpty
                    ? null
                    : () => _exportPdf(
                        ['Nomor', 'Gudang', 'Status', 'Dihitung', 'Selisih'],
                        rows
                            .map((row) => [
                                  row.number,
                                  row.warehouse,
                                  row.status,
                                  '${row.counted}/${row.lines}',
                                  rupiah(row.varianceValue)
                                ])
                            .toList(),
                        'laporan-stock-opname'),
                icon: const Icon(Icons.picture_as_pdf_outlined),
                label: const Text('Laporan PDF')),
          ]),
        ),
        ...rows.map((row) => Card(
              child: ListTile(
                onTap: _busy || !['FROZEN', 'COUNTED'].contains(row.status)
                    ? null
                    : () => _countOpname(row),
                title: Text(row.number,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                    '${row.warehouse} | ${row.counted}/${row.lines} dihitung | Selisih ${rupiah(row.varianceValue)}${[
                  'FROZEN',
                  'COUNTED'
                ].contains(row.status) ? ' | Ketuk untuk isi fisik' : ''}'),
                leading: const Icon(Icons.inventory_2_outlined),
                trailing: FilledButton.tonal(
                  onPressed: _busy ||
                          !['DRAFT', 'COUNTED', 'APPROVED'].contains(row.status)
                      ? null
                      : () => _opnameCommand(row),
                  child: Text(switch (row.status) {
                    'DRAFT' => 'Bekukan',
                    'COUNTED' => 'Setujui',
                    'APPROVED' => 'Posting',
                    _ => row.status,
                  }),
                ),
              ),
            )),
      ]),
    );
  }

  Widget _priceView(InventoryStockPricingData data, String needle) {
    final prices = data.prices
        .where((row) =>
            needle.isEmpty ||
            row.productName.toLowerCase().contains(needle) ||
            row.partyName.toLowerCase().contains(needle))
        .toList();
    return Column(children: [
      _SectionCard(
        title: 'Buku harga dan persetujuan',
        icon: Icons.approval_outlined,
        child: Column(children: [
          Align(
              alignment: Alignment.centerRight,
              child: FilledButton.icon(
                  onPressed: _busy ? null : () => _createPriceBook(data),
                  icon: const Icon(Icons.add),
                  label: const Text('Buku harga'))),
          ...data.priceBooks.take(50).map((row) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text('${row.code} - ${row.name}',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${row.scope} | ${row.itemCount} item'),
                trailing: Chip(label: Text(row.status)),
              )),
        ]),
      ),
      const SizedBox(height: 12),
      _SectionCard(
        title: 'Riwayat harga per pihak',
        icon: Icons.history_outlined,
        child: Column(children: [
          Align(
              alignment: Alignment.centerRight,
              child: Wrap(spacing: 8, children: [
                OutlinedButton.icon(
                    onPressed: () => _export([
                          [
                            'Jenis',
                            'Pihak',
                            'Kode',
                            'Produk',
                            'Tanggal',
                            'Harga'
                          ],
                          ...prices.map((row) => [
                                row.partyType,
                                row.partyName,
                                row.productCode,
                                row.productName,
                                row.date,
                                row.price
                              ]),
                        ], 'riwayat-harga'),
                    icon: const Icon(Icons.table_view_outlined),
                    label: const Text('Excel')),
                FilledButton.tonalIcon(
                    onPressed: prices.isEmpty
                        ? null
                        : () => _exportPdf(
                                [
                                  'Jenis',
                                  'Pihak',
                                  'Kode',
                                  'Produk',
                                  'Tanggal',
                                  'Harga'
                                ],
                                prices
                                    .map((row) => [
                                          row.partyType,
                                          row.partyName,
                                          row.productCode,
                                          row.productName,
                                          row.date,
                                          rupiah(row.price)
                                        ])
                                    .toList(),
                                'laporan-riwayat-harga'),
                    icon: const Icon(Icons.picture_as_pdf_outlined),
                    label: const Text('PDF'))
              ])),
          ...prices.take(200).map((row) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(row.productName,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle:
                    Text('${row.partyType} | ${row.partyName} | ${row.date}'),
                trailing: Text(rupiah(row.price),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              )),
        ]),
      ),
    ]);
  }
}

class _InventoryOperationsPageState extends State<InventoryOperationsPage> {
  late Future<InventoryOperationsData> _data = _load();
  int _segment = 0;
  String? _message;
  String? _busyId;
  bool _includeSettled = false;
  bool _includeReceivableSettled = false;

  bool get _canSeePayables => widget.persona.role != 'Sales';

  Future<InventoryOperationsData> _load() => widget.client.operations(
        includePayables: _canSeePayables,
        includeSettled: _includeSettled,
        includeReceivableSettled: _includeReceivableSettled,
      );

  void _refresh() {
    setState(() {
      _data = _load();
      _message = null;
    });
  }

  Future<void> _settle(SettlementDocument document) async {
    setState(() {
      _busyId = document.id;
      _message = null;
    });
    try {
      final number = await widget.client.settle(document);
      if (!mounted) return;
      setState(() => _message = '$number berhasil diposting.');
      _refresh();
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _carry(SettlementDocument document) async {
    setState(() {
      _busyId = document.id;
      _message = null;
    });
    try {
      final number = await widget.client.carryNote(document);
      if (!mounted) return;
      setState(() => _message = 'Nota $number sudah diserahterimakan.');
      _refresh();
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _returnAndClose(HandoverSummary handover) async {
    setState(() {
      _busyId = handover.id;
      _message = null;
    });
    try {
      await widget.client.returnAndCloseHandover(handover.id);
      if (!mounted) return;
      setState(() => _message = 'Nota ${handover.number} kembali dan ditutup.');
      _refresh();
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Widget _purchaseWorkspace(InventoryOperationsData data) {
    return InventoryPurchaseWorkspace(
      suppliers: data.suppliers
          .map((supplier) => TransactionParty(
                id: supplier.id,
                code: supplier.code,
                name: supplier.name,
              ))
          .toList(),
      warehouses: data.warehouses
          .map((warehouse) => TransactionParty(
                id: warehouse.id,
                code: warehouse.code,
                name: warehouse.name,
              ))
          .toList(),
      products: data.products
          .map((product) => TransactionProduct(
                id: product.id,
                uomId: product.uomId,
                code: product.code,
                name: product.name,
                uom: 'PCS',
                price: product.price,
                stock: product.stock.toDouble(),
                imageUrl: product.imageUrl,
              ))
          .toList(),
      onSubmit: (submission) async {
        final number =
            await widget.client.createPurchaseOrderWorkspace(submission);
        if (mounted) _refresh();
        return number;
      },
    );
  }

  Future<void> _createPurchaseOrder(InventoryOperationsData data) async {
    if (data.suppliers.isEmpty ||
        data.products.isEmpty ||
        data.warehouses.isEmpty) {
      setState(() => _message =
          'Supplier, produk, dan gudang harus tersedia sebelum membuat PO.');
      return;
    }
    String supplierId = data.suppliers.first.id;
    String warehouseId = data.warehouses.first.id;
    String productId = data.products.first.id;
    final quantity = TextEditingController(text: '1');
    final price = TextEditingController(
        text: data.products.first.price.round().toString());
    final expected = TextEditingController(
        text: DateTime.now()
            .add(const Duration(days: 7))
            .toIso8601String()
            .substring(0, 10));
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(builder: (context, update) {
        return AlertDialog(
          title: const Text('Purchase order baru'),
          content: SizedBox(
            width: 560,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                DropdownButtonFormField<String>(
                    value: supplierId,
                    decoration: const InputDecoration(labelText: 'Supplier'),
                    items: data.suppliers
                        .map((row) => DropdownMenuItem(
                            value: row.id,
                            child: Text('${row.code} - ${row.name}')))
                        .toList(),
                    onChanged: (value) =>
                        update(() => supplierId = value ?? supplierId)),
                DropdownButtonFormField<String>(
                    value: warehouseId,
                    decoration: const InputDecoration(labelText: 'Gudang'),
                    items: data.warehouses
                        .map((row) => DropdownMenuItem(
                            value: row.id,
                            child: Text('${row.code} - ${row.name}')))
                        .toList(),
                    onChanged: (value) =>
                        update(() => warehouseId = value ?? warehouseId)),
                DropdownButtonFormField<String>(
                    value: productId,
                    decoration: const InputDecoration(labelText: 'Produk'),
                    items: data.products
                        .take(1000)
                        .map((row) => DropdownMenuItem(
                            value: row.id,
                            child: Text('${row.code} - ${row.name}')))
                        .toList(),
                    onChanged: (value) => update(() {
                          productId = value ?? productId;
                          final product = data.products
                              .firstWhere((row) => row.id == productId);
                          price.text = product.price.round().toString();
                        })),
                Row(children: [
                  Expanded(
                    child: TextField(
                        controller: quantity,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration: const InputDecoration(labelText: 'Jumlah')),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                        controller: price,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration:
                            const InputDecoration(labelText: 'Harga satuan')),
                  ),
                ]),
                TextField(
                    controller: expected,
                    decoration:
                        const InputDecoration(labelText: 'Tanggal diharapkan')),
              ]),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Batal')),
            FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Simpan PO')),
          ],
        );
      }),
    );
    if (accepted != true) return;
    setState(() => _busyId = 'NEW-PO');
    try {
      final product = data.products.firstWhere((row) => row.id == productId);
      final number = await widget.client.createPurchaseOrder(
        supplierId: supplierId,
        warehouseId: warehouseId,
        product: product,
        quantity: double.tryParse(quantity.text.replaceAll(',', '.')) ?? 0,
        unitPrice: double.tryParse(price.text.replaceAll(',', '.')) ?? -1,
        expectedDate: expected.text.trim(),
      );
      if (mounted) {
        setState(() => _message = 'Purchase order $number berhasil dibuat.');
        _refresh();
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      quantity.dispose();
      price.dispose();
      expected.dispose();
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _purchaseCommand(PurchaseOrderSummary order) async {
    final action = switch (order.status) {
      'DRAFT' => 'submit',
      'SUBMITTED' => 'approve',
      'APPROVED' => 'send',
      _ => null,
    };
    if (action == null) return;
    setState(() => _busyId = order.id);
    try {
      await widget.client.transitionPurchaseOrder(order.id, action);
      if (mounted) {
        setState(() => _message = '${order.number} berhasil diproses.');
        _refresh();
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _receivePurchase(PurchaseOrderSummary order) async {
    final batch = TextEditingController();
    final expiry = TextEditingController();
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text('Terima ${order.number}'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(
              controller: batch,
              decoration: const InputDecoration(labelText: 'Nomor batch')),
          TextField(
              controller: expiry,
              decoration: const InputDecoration(
                  labelText: 'Tanggal kedaluwarsa (YYYY-MM-DD)')),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dialogContext, false),
              child: const Text('Batal')),
          FilledButton(
              onPressed: () => Navigator.pop(dialogContext, true),
              child: const Text('Buat penerimaan')),
        ],
      ),
    );
    if (accepted != true) return;
    setState(() => _busyId = order.id);
    try {
      final number = await widget.client
          .receivePurchaseOrder(order, batch.text.trim(), expiry.text.trim());
      if (mounted) {
        setState(() => _message =
            'Penerimaan $number dibuat. Pemeriksaan dan posting mengikuti pemisahan tugas.');
        _refresh();
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      batch.dispose();
      expiry.dispose();
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _purchasePdf(InventoryOperationsData data, String kind) async {
    final document = pw.Document();
    final title = switch (kind) {
      'PAYMENT' => 'Register Pembayaran Hutang',
      'AGING' => 'Analisis Umur Hutang',
      _ => 'Laporan Pembelian per Periode',
    };
    final headers = switch (kind) {
      'PAYMENT' => [
          'Nomor',
          'Tanggal',
          'Supplier',
          'Metode',
          'Jumlah',
          'Status'
        ],
      'AGING' => ['Faktur', 'Supplier', 'Bucket', 'Saldo'],
      _ => ['PO', 'Tanggal', 'Supplier', 'Status', 'Total'],
    };
    final rows = switch (kind) {
      'PAYMENT' => data.apPayments
          .map((row) => [
                row.number,
                row.date,
                row.supplierName,
                row.method,
                rupiah(row.total),
                row.status
              ])
          .toList(),
      'AGING' => data.payables
          .map((row) => [
                row.invoiceNumber,
                row.partyName,
                row.agingBucket,
                rupiah(row.amount)
              ])
          .toList(),
      _ => data.purchaseOrders
          .map((row) => [
                row.number,
                row.date,
                row.supplierName,
                row.status,
                rupiah(row.total)
              ])
          .toList(),
    };
    document.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      build: (_) => [
        pw.Header(level: 0, text: title),
        pw.TableHelper.fromTextArray(headers: headers, data: rows)
      ],
      footer: (context) => pw.Align(
          alignment: pw.Alignment.centerRight,
          child:
              pw.Text('Halaman ${context.pageNumber}/${context.pagesCount}')),
    ));
    final name = 'inventory-${kind.toLowerCase()}';
    final location = await getSaveLocation(
      suggestedName: '$name.pdf',
      acceptedTypeGroups: const [
        XTypeGroup(label: 'PDF', extensions: ['pdf'])
      ],
    );
    if (location == null) return;
    await XFile.fromData(await document.save(),
            name: '$name.pdf', mimeType: 'application/pdf')
        .saveTo(location.path);
  }

  Future<void> _purchaseInvoicePdf(PurchaseOrderSummary order) async {
    setState(() {
      _busyId = order.id;
      _message = null;
    });
    try {
      final detail = await widget.client.purchaseOrderDetail(order.id);
      final lines = ((detail['lines'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => Map<String, Object?>.from(row))
          .toList();
      final document = pw.Document();
      document.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        build: (_) => [
          pw.Header(level: 0, text: 'Faktur Pembelian Barang'),
          pw.Text('Nomor: ${order.number}'),
          pw.Text('Supplier: ${order.supplierName}'),
          pw.Text('Tanggal: ${order.date}'),
          pw.Text('Status: ${order.status}'),
          pw.SizedBox(height: 14),
          pw.TableHelper.fromTextArray(
            headers: const [
              'Kode',
              'Nama barang',
              'Jumlah',
              'Satuan',
              'Harga',
              'Diskon',
              'Pajak',
              'Total'
            ],
            data: lines
                .map((line) => [
                      (line['product_code'] ?? '-').toString(),
                      (line['product_name'] ?? '-').toString(),
                      angka(toDouble(line['ordered_qty'])),
                      (line['uom_code'] ?? '-').toString(),
                      rupiah(toDouble(line['unit_price'])),
                      rupiah(toDouble(line['discount_amount'])),
                      rupiah(toDouble(line['tax_amount'])),
                      rupiah(toDouble(line['line_total'])),
                    ])
                .toList(),
          ),
          pw.SizedBox(height: 12),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text('Grand total: ${rupiah(order.total)}',
                style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
          ),
        ],
        footer: (context) => pw.Align(
            alignment: pw.Alignment.centerRight,
            child:
                pw.Text('Halaman ${context.pageNumber}/${context.pagesCount}')),
      ));
      final safeNumber =
          order.number.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
      final name = 'faktur-pembelian-$safeNumber.pdf';
      final location = await getSaveLocation(
        suggestedName: name,
        acceptedTypeGroups: const [
          XTypeGroup(label: 'PDF', extensions: ['pdf'])
        ],
      );
      if (location != null) {
        await XFile.fromData(await document.save(),
                name: name, mimeType: 'application/pdf')
            .saveTo(location.path);
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _receivablePdf(InventoryOperationsData data, String kind) async {
    final document = pw.Document();
    final title = switch (kind) {
      'RECEIPT' => 'Register Penerimaan Piutang',
      'AGING_SALES' => 'Analisis Piutang per Sales',
      'NOTES' => 'Serah-terima Nota Sales',
      'OUTSTANDING' => 'Piutang Belum Lunas',
      _ => 'Analisis Piutang per Customer',
    };
    final headers = switch (kind) {
      'RECEIPT' => [
          'Nomor',
          'Tanggal',
          'Customer',
          'Metode',
          'Jumlah',
          'Status'
        ],
      'NOTES' => ['Nomor', 'Sales', 'Jumlah nota', 'Saldo', 'Status'],
      'AGING_SALES' => ['Sales', 'Faktur', 'Customer', 'Bucket', 'Saldo'],
      _ => ['Customer', 'Faktur', 'Sales', 'Bucket', 'Saldo'],
    };
    final rows = switch (kind) {
      'RECEIPT' => data.arReceipts
          .map((row) => [
                row.number,
                row.date,
                row.customerName,
                row.method,
                rupiah(row.total),
                row.status
              ])
          .toList(),
      'NOTES' => data.handovers
          .map((row) => [
                row.number,
                row.salesperson,
                angka(row.invoiceCount),
                rupiah(row.amount),
                row.status
              ])
          .toList(),
      'AGING_SALES' => data.receivables
          .where((row) => !row.isSettled)
          .map((row) => [
                row.salesName,
                row.invoiceNumber,
                row.partyName,
                row.agingBucket,
                rupiah(row.amount)
              ])
          .toList(),
      _ => data.receivables
          .where((row) => !row.isSettled)
          .map((row) => [
                row.partyName,
                row.invoiceNumber,
                row.salesName,
                row.agingBucket,
                rupiah(row.amount)
              ])
          .toList(),
    };
    document.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4.landscape,
      build: (_) => [
        pw.Header(level: 0, text: title),
        pw.TableHelper.fromTextArray(headers: headers, data: rows),
      ],
      footer: (context) => pw.Align(
          alignment: pw.Alignment.centerRight,
          child:
              pw.Text('Halaman ${context.pageNumber}/${context.pagesCount}')),
    ));
    final name = 'inventory-ar-${kind.toLowerCase()}.pdf';
    final location = await getSaveLocation(
      suggestedName: name,
      acceptedTypeGroups: const [
        XTypeGroup(label: 'PDF', extensions: ['pdf'])
      ],
    );
    if (location == null) return;
    await XFile.fromData(await document.save(),
            name: name, mimeType: 'application/pdf')
        .saveTo(location.path);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InventoryOperationsData>(
      future: _data,
      builder: (context, state) {
        if (state.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.hasError || state.data == null) {
          return _ErrorPanel(
              message: state.error.toString(), onRetry: _refresh);
        }
        final data = state.data!;
        final segments = <ButtonSegment<int>>[
          const ButtonSegment(
              value: 0,
              icon: Icon(Icons.wallet_outlined),
              label: Text('Piutang')),
          if (_canSeePayables)
            const ButtonSegment(
                value: 1,
                icon: Icon(Icons.account_balance_outlined),
                label: Text('Hutang')),
          const ButtonSegment(
              value: 2,
              icon: Icon(Icons.assignment_ind_outlined),
              label: Text('Nota')),
          if (_canSeePayables)
            const ButtonSegment(
                value: 3,
                icon: Icon(Icons.shopping_cart_checkout_outlined),
                label: Text('Pembelian')),
        ];
        if (!_canSeePayables && _segment == 1) _segment = 0;
        return ColoredBox(
          color: const Color(0xFFF8FAFC),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _PartyMasterLauncher(client: widget.client),
                const SizedBox(height: 12),
                _SectionCard(
                  title: 'Operasional Lapangan',
                  icon: Icons.sync_alt_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Pembayaran, penerimaan, dan nota memakai command idempoten yang sama dengan Web. Nominal penuh ditampilkan sebelum posting.',
                        style:
                            TextStyle(color: Color(0xFF475569), height: 1.45),
                      ),
                      const SizedBox(height: 12),
                      SegmentedButton<int>(
                        segments: segments,
                        selected: {_segment},
                        onSelectionChanged: (value) =>
                            setState(() => _segment = value.first),
                      ),
                      if (_canSeePayables && _segment == 1) ...[
                        const SizedBox(height: 10),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title:
                              const Text('Tampilkan hutang yang sudah lunas'),
                          value: _includeSettled,
                          onChanged: (value) {
                            setState(() {
                              _includeSettled = value;
                              _data = _load();
                            });
                          },
                        ),
                      ],
                      if (_segment == 0) ...[
                        const SizedBox(height: 10),
                        SwitchListTile.adaptive(
                          contentPadding: EdgeInsets.zero,
                          title:
                              const Text('Tampilkan piutang yang sudah lunas'),
                          value: _includeReceivableSettled,
                          onChanged: (value) {
                            setState(() {
                              _includeReceivableSettled = value;
                              _data = _load();
                            });
                          },
                        ),
                      ],
                      if (_message != null) ...[
                        const SizedBox(height: 12),
                        Text(_message!,
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                if (_segment == 0)
                  Column(children: [
                    _SettlementList(
                      title: _includeReceivableSettled
                          ? 'Piutang Customer - Semua Status'
                          : 'Piutang Customer - Belum Lunas',
                      documents: data.receivables,
                      busyId: _busyId,
                      primaryLabel: 'Terima penuh',
                      onPrimary: _settle,
                      onSecondary: _carry,
                    ),
                    const SizedBox(height: 12),
                    _ReceivableReportActions(
                      onReceipts: () => _receivablePdf(data, 'RECEIPT'),
                      onCustomerAging: () =>
                          _receivablePdf(data, 'AGING_CUSTOMER'),
                      onSalesAging: () => _receivablePdf(data, 'AGING_SALES'),
                      onOutstanding: () => _receivablePdf(data, 'OUTSTANDING'),
                      onNotes: () => _receivablePdf(data, 'NOTES'),
                    ),
                    const SizedBox(height: 12),
                    _ArReceiptHistoryList(receipts: data.arReceipts),
                  ])
                else if (_segment == 1)
                  Column(children: [
                    _SettlementList(
                      title: _includeSettled
                          ? 'Hutang Supplier - Semua Status'
                          : 'Hutang Supplier - Belum Lunas',
                      documents: data.payables,
                      busyId: _busyId,
                      primaryLabel: 'Bayar penuh',
                      onPrimary: _settle,
                    ),
                    const SizedBox(height: 12),
                    _PurchaseReportActions(
                        onPayments: () => _purchasePdf(data, 'PAYMENT'),
                        onAging: () => _purchasePdf(data, 'AGING'),
                        onPurchases: () => _purchasePdf(data, 'PURCHASE')),
                    const SizedBox(height: 12),
                    _ApPaymentHistoryList(payments: data.apPayments),
                  ])
                else if (_segment == 2)
                  _HandoverList(
                    handovers: data.handovers,
                    busyId: _busyId,
                    onReturnAndClose: _returnAndClose,
                    onReport: () => _receivablePdf(data, 'NOTES'),
                  )
                else
                  Column(children: [
                    _purchaseWorkspace(data),
                    const SizedBox(height: 12),
                    _PurchaseList(
                      data: data,
                      busyId: _busyId,
                      onCreate: () => _createPurchaseOrder(data),
                      onCommand: _purchaseCommand,
                      onReceive: _receivePurchase,
                      onInvoice: _purchaseInvoicePdf,
                      onReport: () => _purchasePdf(data, 'PURCHASE'),
                    ),
                  ]),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SettlementList extends StatelessWidget {
  const _SettlementList({
    required this.title,
    required this.documents,
    required this.busyId,
    required this.primaryLabel,
    required this.onPrimary,
    this.onSecondary,
  });

  final String title;
  final List<SettlementDocument> documents;
  final String? busyId;
  final String primaryLabel;
  final ValueChanged<SettlementDocument> onPrimary;
  final ValueChanged<SettlementDocument>? onSecondary;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: title,
      icon: Icons.receipt_long_outlined,
      child: documents.isEmpty
          ? const Text('Tidak ada dokumen terbuka.')
          : Column(
              children: documents.take(100).map((document) {
                final busy = busyId == document.id;
                final settled = document.isSettled || document.amount <= 0;
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  decoration: const BoxDecoration(
                    border:
                        Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(document.partyName,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800)),
                            Text(
                                '${document.invoiceNumber} - ${document.agingBucket}'),
                            Text(rupiah(document.amount),
                                style: const TextStyle(
                                    color: Color(0xFF0F766E),
                                    fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      Wrap(
                        spacing: 6,
                        children: [
                          if (settled) const Chip(label: Text('Lunas')),
                          if (!settled && onSecondary != null)
                            OutlinedButton(
                              onPressed: busy || document.salespersonId == null
                                  ? null
                                  : () => onSecondary!(document),
                              child: const Text('Bawa nota'),
                            ),
                          if (!settled)
                            FilledButton(
                              onPressed:
                                  busy ? null : () => onPrimary(document),
                              child: Text(busy ? 'Memproses...' : primaryLabel),
                            ),
                        ],
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
    );
  }
}

class _ReceivableReportActions extends StatelessWidget {
  const _ReceivableReportActions({
    required this.onReceipts,
    required this.onCustomerAging,
    required this.onSalesAging,
    required this.onOutstanding,
    required this.onNotes,
  });

  final VoidCallback onReceipts;
  final VoidCallback onCustomerAging;
  final VoidCallback onSalesAging;
  final VoidCallback onOutstanding;
  final VoidCallback onNotes;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Laporan Piutang dan Nota Sales',
        icon: Icons.picture_as_pdf_outlined,
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(
              onPressed: onReceipts,
              icon: const Icon(Icons.receipt_long_outlined),
              label: const Text('Penerimaan PDF')),
          OutlinedButton.icon(
              onPressed: onCustomerAging,
              icon: const Icon(Icons.storefront_outlined),
              label: const Text('Aging customer')),
          OutlinedButton.icon(
              onPressed: onSalesAging,
              icon: const Icon(Icons.badge_outlined),
              label: const Text('Aging sales')),
          FilledButton.tonalIcon(
              onPressed: onOutstanding,
              icon: const Icon(Icons.account_balance_wallet_outlined),
              label: const Text('Piutang PDF')),
          FilledButton.tonalIcon(
              onPressed: onNotes,
              icon: const Icon(Icons.assignment_ind_outlined),
              label: const Text('Nota sales PDF')),
        ]),
      );
}

class _ArReceiptHistoryList extends StatelessWidget {
  const _ArReceiptHistoryList({required this.receipts});

  final List<ArReceiptSummary> receipts;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Riwayat Penerimaan Piutang',
        icon: Icons.history_outlined,
        child: receipts.isEmpty
            ? const Text('Belum ada penerimaan piutang.')
            : Column(
                children: receipts
                    .take(200)
                    .map((receipt) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const CircleAvatar(
                              child: Icon(Icons.payments_outlined)),
                          title: Text(
                              '${receipt.number} - ${receipt.customerName}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text(
                              '${receipt.date} | ${receipt.method} | ${receipt.status}'),
                          trailing: Text(rupiah(receipt.total),
                              style: const TextStyle(
                                  color: Color(0xFF0F766E),
                                  fontWeight: FontWeight.w900)),
                        ))
                    .toList(),
              ),
      );
}

class _PurchaseReportActions extends StatelessWidget {
  const _PurchaseReportActions({
    required this.onPayments,
    required this.onAging,
    required this.onPurchases,
  });

  final VoidCallback onPayments;
  final VoidCallback onAging;
  final VoidCallback onPurchases;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Dokumen Pembelian dan Hutang',
        icon: Icons.picture_as_pdf_outlined,
        child: Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(
              onPressed: onPayments,
              icon: const Icon(Icons.receipt_long_outlined),
              label: const Text('Pembayaran PDF')),
          OutlinedButton.icon(
              onPressed: onAging,
              icon: const Icon(Icons.timelapse_outlined),
              label: const Text('Aging hutang PDF')),
          FilledButton.tonalIcon(
              onPressed: onPurchases,
              icon: const Icon(Icons.assessment_outlined),
              label: const Text('Pembelian PDF')),
        ]),
      );
}

class _ApPaymentHistoryList extends StatelessWidget {
  const _ApPaymentHistoryList({required this.payments});

  final List<ApPaymentSummary> payments;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Riwayat Pembayaran Hutang',
        icon: Icons.history_outlined,
        child: payments.isEmpty
            ? const Text('Belum ada pembayaran hutang.')
            : Column(
                children: payments
                    .take(200)
                    .map((payment) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const CircleAvatar(
                              child: Icon(Icons.payments_outlined)),
                          title: Text(
                              '${payment.number} - ${payment.supplierName}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.w800)),
                          subtitle: Text(
                              '${payment.date} | ${payment.method} | ${payment.status}'),
                          trailing: Text(rupiah(payment.total),
                              style: const TextStyle(
                                  color: Color(0xFF0F766E),
                                  fontWeight: FontWeight.w900)),
                        ))
                    .toList(),
              ),
      );
}

class _PurchaseList extends StatelessWidget {
  const _PurchaseList({
    required this.data,
    required this.busyId,
    required this.onCreate,
    required this.onCommand,
    required this.onReceive,
    required this.onInvoice,
    required this.onReport,
  });

  final InventoryOperationsData data;
  final String? busyId;
  final VoidCallback onCreate;
  final ValueChanged<PurchaseOrderSummary> onCommand;
  final ValueChanged<PurchaseOrderSummary> onReceive;
  final ValueChanged<PurchaseOrderSummary> onInvoice;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) => _SectionCard(
        title: 'Purchase Order dan Penerimaan',
        icon: Icons.shopping_cart_checkout_outlined,
        child: Column(children: [
          Align(
            alignment: Alignment.centerRight,
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                  onPressed: onReport,
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('Laporan PDF')),
              FilledButton.icon(
                  onPressed: busyId == 'NEW-PO' ? null : onCreate,
                  icon: const Icon(Icons.add),
                  label: const Text('PO baru')),
            ]),
          ),
          if (data.purchaseOrders.isEmpty)
            const Padding(
              padding: EdgeInsets.all(24),
              child: Text('Belum ada purchase order.'),
            )
          else
            ...data.purchaseOrders.take(200).map((order) {
              final busy = busyId == order.id;
              final action = switch (order.status) {
                'DRAFT' => 'Ajukan',
                'SUBMITTED' => 'Setujui',
                'APPROVED' => 'Kirim',
                _ => null,
              };
              return ListTile(
                contentPadding: EdgeInsets.zero,
                leading:
                    const CircleAvatar(child: Icon(Icons.inventory_2_outlined)),
                title: Text('${order.number} - ${order.supplierName}',
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                    '${order.date} | ${order.status} | ${rupiah(order.total)}'),
                trailing: Wrap(spacing: 6, children: [
                  IconButton(
                    tooltip: 'Cetak faktur pembelian',
                    onPressed: busy ? null : () => onInvoice(order),
                    icon: const Icon(Icons.print_outlined),
                  ),
                  if (action != null)
                    FilledButton.tonal(
                        onPressed: busy ? null : () => onCommand(order),
                        child: Text(action)),
                  if (order.status == 'SENT')
                    FilledButton(
                        onPressed: busy ? null : () => onReceive(order),
                        child: const Text('Terima')),
                ]),
              );
            }),
        ]),
      );
}

class _HandoverList extends StatelessWidget {
  const _HandoverList(
      {required this.handovers,
      required this.busyId,
      required this.onReturnAndClose,
      required this.onReport});
  final List<HandoverSummary> handovers;
  final String? busyId;
  final ValueChanged<HandoverSummary> onReturnAndClose;
  final VoidCallback onReport;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Serah-terima Nota Sales',
      icon: Icons.assignment_turned_in_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: OutlinedButton.icon(
              onPressed: onReport,
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text('Cetak nota sales'),
            ),
          ),
          if (handovers.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Text('Belum ada serah-terima nota.'),
            )
          else
            ...handovers.map((row) => ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(row.number,
                      style: const TextStyle(fontWeight: FontWeight.w800)),
                  subtitle: Text(
                      '${row.salesperson} - ${row.invoiceCount} nota - ${row.status}'),
                  trailing: row.status == 'HANDED_OVER'
                      ? FilledButton.tonal(
                          onPressed: busyId == row.id
                              ? null
                              : () => onReturnAndClose(row),
                          child: const Text('Kembali & tutup'),
                        )
                      : Text(rupiah(row.amount)),
                )),
        ],
      ),
    );
  }
}

class InventoryFinancePage extends StatefulWidget {
  const InventoryFinancePage({super.key, required this.client});

  final InventoryApiClient client;

  @override
  State<InventoryFinancePage> createState() => _InventoryFinancePageState();
}

class _InventoryFinancePageState extends State<InventoryFinancePage> {
  late Future<InventoryFinanceData> _workspace =
      widget.client.financeWorkspace();
  String _mode = 'journal';
  bool _busy = false;
  String? _message;
  InventoryFinancialReport? _report;
  DateTime _asOf = DateTime.now();

  void _refresh() {
    setState(() => _workspace = widget.client.financeWorkspace());
  }

  Future<void> _command(Future<void> Function() action, String success) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await action();
      if (!mounted) return;
      setState(() => _message = success);
      _refresh();
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _newAccount() async {
    final code = TextEditingController();
    final name = TextEditingController();
    var category = 'ASSET';
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialog) {
        return AlertDialog(
          title: const Text('Perkiraan baru'),
          content: SizedBox(
            width: 460,
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(
                  controller: code,
                  decoration: const InputDecoration(labelText: 'Kode akun')),
              TextField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'Nama akun')),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: category,
                decoration: const InputDecoration(labelText: 'Kelompok akun'),
                items: const [
                  DropdownMenuItem(value: 'ASSET', child: Text('Aset')),
                  DropdownMenuItem(
                      value: 'LIABILITY', child: Text('Kewajiban')),
                  DropdownMenuItem(value: 'EQUITY', child: Text('Modal')),
                  DropdownMenuItem(value: 'REVENUE', child: Text('Pendapatan')),
                  DropdownMenuItem(value: 'EXPENSE', child: Text('Biaya')),
                ],
                onChanged: (value) => setDialog(() => category = value!),
              ),
            ]),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Simpan')),
          ],
        );
      }),
    );
    if (accepted != true) return;
    final normal =
        const ['ASSET', 'EXPENSE'].contains(category) ? 'DEBIT' : 'CREDIT';
    await _command(
      () => widget.client.createFinanceAccount(
        code: code.text.trim(),
        name: name.text.trim(),
        category: category,
        normalBalance: normal,
      ),
      'Perkiraan ${code.text.trim()} berhasil dibuat.',
    );
  }

  Future<void> _newJournal(InventoryFinanceData data) async {
    final openPeriods =
        data.periods.where((row) => row.status == 'OPEN').toList();
    final postingAccounts =
        data.accounts.where((row) => row.allowPosting).toList();
    if (openPeriods.isEmpty || postingAccounts.length < 2) {
      setState(() => _message =
          'Diperlukan satu periode terbuka dan minimal dua akun posting.');
      return;
    }
    final description = TextEditingController();
    final amount = TextEditingController();
    var periodId = openPeriods.first.id;
    var debitId = postingAccounts.first.id;
    var creditId = postingAccounts[1].id;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialog) {
        return AlertDialog(
          title: const Text('Jurnal kas baru'),
          content: SizedBox(
            width: 560,
            child: SingleChildScrollView(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
              DropdownButtonFormField<String>(
                value: periodId,
                decoration: const InputDecoration(labelText: 'Periode terbuka'),
                items: openPeriods
                    .map((row) => DropdownMenuItem(
                        value: row.id,
                        child: Text('${row.code} - ${row.name}')))
                    .toList(),
                onChanged: (value) => setDialog(() => periodId = value!),
              ),
              TextField(
                  controller: description,
                  decoration:
                      const InputDecoration(labelText: 'Uraian transaksi')),
              TextField(
                  controller: amount,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Nominal')),
              DropdownButtonFormField<String>(
                value: debitId,
                decoration: const InputDecoration(labelText: 'Akun debit'),
                items: postingAccounts
                    .map((row) => DropdownMenuItem(
                        value: row.id,
                        child: Text('${row.code} - ${row.name}')))
                    .toList(),
                onChanged: (value) => setDialog(() => debitId = value!),
              ),
              DropdownButtonFormField<String>(
                value: creditId,
                decoration: const InputDecoration(labelText: 'Akun kredit'),
                items: postingAccounts
                    .map((row) => DropdownMenuItem(
                        value: row.id,
                        child: Text('${row.code} - ${row.name}')))
                    .toList(),
                onChanged: (value) => setDialog(() => creditId = value!),
              ),
            ])),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Batal')),
            FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Buat draft')),
          ],
        );
      }),
    );
    if (accepted != true) return;
    await _command(
      () => widget.client.createJournal(
        periodId: periodId,
        description: description.text.trim(),
        amount: double.tryParse(amount.text.replaceAll(',', '.')) ?? 0,
        debitAccountId: debitId,
        creditAccountId: creditId,
      ),
      'Draft jurnal berhasil dibuat dan siap diperiksa.',
    );
  }

  Future<void> _loadReport(String code) async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final value = await widget.client.financeReport(code, _asOf);
      if (mounted) setState(() => _report = value);
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _exportReport() async {
    final report = _report;
    if (report == null) return;
    setState(() => _busy = true);
    try {
      final snapshotId = await widget.client
          .snapshotFinanceReport(report.reportCode, report.asOfDate);
      final keys = report.rows.isEmpty
          ? <String>[]
          : report.rows.first.keys.take(7).toList();
      final pdf = pw.Document();
      pdf.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.all(28),
        header: (_) => pw
            .Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('Caruban Medika Nusantara',
              style:
                  pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
          pw.Text(report.title,
              style:
                  pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
          pw.Text('Posisi ${report.asOfDate} | Snapshot $snapshotId'),
          pw.SizedBox(height: 8),
        ]),
        build: (_) => [
          if (keys.isNotEmpty)
            pw.TableHelper.fromTextArray(
              headers: keys.map(financeLabel).toList(),
              data: report.rows
                  .map((row) =>
                      keys.map((key) => row[key]?.toString() ?? '').toList())
                  .toList(),
              headerDecoration:
                  const pw.BoxDecoration(color: PdfColors.grey300),
              headerStyle:
                  pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold),
              cellStyle: const pw.TextStyle(fontSize: 7),
            )
          else
            pw.Text('Tidak ada transaksi pada periode ini.'),
          pw.SizedBox(height: 12),
          pw.Text('Total: ${rupiah(report.total)}',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
        ],
      ));
      final name = '${report.reportCode}-${report.asOfDate}.pdf';
      await XFile.fromData(await pdf.save(),
              name: name, mimeType: 'application/pdf')
          .saveTo(name);
      await widget.client.logFinancePrint(snapshotId, name);
      if (mounted) {
        setState(() =>
            _message = 'PDF $name tersimpan dan jejak cetaknya tercatat.');
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InventoryFinanceData>(
      future: _workspace,
      builder: (context, state) {
        if (state.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (state.hasError) {
          return _ErrorPanel(
              message: state.error.toString(), onRetry: _refresh);
        }
        final data = state.data!;
        return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text('Keuangan dan Akuntansi',
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w900)),
              const Text(
                  'Jurnal berimbang, bagan akun, laba rugi, dan penutupan periode dengan jejak audit.'),
              const SizedBox(height: 14),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                        value: 'journal',
                        icon: Icon(Icons.menu_book_outlined),
                        label: Text('Jurnal')),
                    ButtonSegment(
                        value: 'account',
                        icon: Icon(Icons.account_tree_outlined),
                        label: Text('Perkiraan')),
                    ButtonSegment(
                        value: 'profit',
                        icon: Icon(Icons.trending_up),
                        label: Text('Laba/Rugi')),
                    ButtonSegment(
                        value: 'period',
                        icon: Icon(Icons.event_available_outlined),
                        label: Text('Periode')),
                  ],
                  selected: {_mode},
                  onSelectionChanged: (value) =>
                      setState(() => _mode = value.first),
                ),
              ),
              if (_message != null)
                Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_message!,
                        style: const TextStyle(fontWeight: FontWeight.w700))),
              const SizedBox(height: 14),
              if (_mode == 'journal') _journalView(data),
              if (_mode == 'account') _accountView(data),
              if (_mode == 'profit') _profitView(),
              if (_mode == 'period') _periodView(data),
            ]);
      },
    );
  }

  Widget _journalView(InventoryFinanceData data) => _SectionCard(
        title: 'Kas dan jurnal harian',
        icon: Icons.receipt_long_outlined,
        action: FilledButton.icon(
            onPressed: _busy ? null : () => _newJournal(data),
            icon: const Icon(Icons.add),
            label: const Text('Jurnal baru')),
        child: Column(children: [
          if (data.journals.isEmpty)
            const ListTile(title: Text('Belum ada jurnal.')),
          ...data.journals.map((row) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: CircleAvatar(
                    child: Text(row.status == 'POSTED' ? 'P' : 'D')),
                title: Text(row.number,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text(
                    '${row.date} - ${row.description}\nDebit ${rupiah(row.debit)} | Kredit ${rupiah(row.credit)}'),
                isThreeLine: true,
                trailing: Wrap(spacing: 6, children: [
                  if (row.status == 'DRAFT')
                    IconButton(
                        tooltip: 'Posting jurnal',
                        onPressed: _busy
                            ? null
                            : () => _command(
                                () => widget.client.postJournal(row.id),
                                'Jurnal ${row.number} diposting.'),
                        icon: const Icon(Icons.check_circle_outline)),
                  if (row.status == 'POSTED')
                    IconButton(
                        tooltip: 'Balik jurnal',
                        onPressed: _busy
                            ? null
                            : () => _command(
                                () => widget.client.reverseJournal(row.id),
                                'Jurnal pembalik ${row.number} dibuat.'),
                        icon: const Icon(Icons.undo)),
                ]),
              )),
        ]),
      );

  Widget _accountView(InventoryFinanceData data) => _SectionCard(
        title: 'Daftar nomor perkiraan',
        icon: Icons.account_tree_outlined,
        action: FilledButton.icon(
            onPressed: _busy ? null : _newAccount,
            icon: const Icon(Icons.add),
            label: const Text('Perkiraan baru')),
        child: Column(
            children: data.accounts
                .map((row) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading:
                          const Icon(Icons.account_balance_wallet_outlined),
                      title: Text('${row.code} - ${row.name}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      subtitle: Text(
                          '${financeLabel(row.category)} | saldo normal ${financeLabel(row.normalBalance)}'),
                      trailing: row.allowPosting
                          ? const Chip(label: Text('Posting'))
                          : const Chip(label: Text('Header')),
                    ))
                .toList()),
      );

  Widget _profitView() {
    final report = _report;
    return _SectionCard(
      title: 'Laporan laba dan rugi',
      icon: Icons.query_stats_outlined,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Wrap(
            spacing: 8,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () async {
                          final value = await showDatePicker(
                              context: context,
                              firstDate: DateTime(2000),
                              lastDate: DateTime(2100),
                              initialDate: _asOf);
                          if (value != null) setState(() => _asOf = value);
                        },
                  icon: const Icon(Icons.calendar_month),
                  label: Text(_asOf.toIso8601String().substring(0, 10))),
              FilledButton.tonal(
                  onPressed: _busy ? null : () => _loadReport('gross-profit'),
                  child: const Text('Laba kotor')),
              FilledButton.tonal(
                  onPressed: _busy ? null : () => _loadReport('profit-loss'),
                  child: const Text('Laba rugi akuntansi')),
              FilledButton.icon(
                  onPressed: _busy || report == null ? null : _exportReport,
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text('Cetak PDF')),
            ]),
        if (report != null) ...[
          const SizedBox(height: 16),
          Text(report.title,
              style: Theme.of(context)
                  .textTheme
                  .titleLarge
                  ?.copyWith(fontWeight: FontWeight.w900)),
          Text(
              '${angka(report.rows.length)} baris | Total ${rupiah(report.total)}'),
          const Divider(),
          ...report.rows.take(100).map((row) => ListTile(
                dense: true,
                contentPadding: EdgeInsets.zero,
                title: Text((row['product_name'] ??
                        row['name'] ??
                        row['order_number'] ??
                        '-')
                    .toString()),
                subtitle: Text((row['product_code'] ??
                        row['code'] ??
                        row['account_type'] ??
                        '')
                    .toString()),
                trailing: Text(rupiah(toDouble(row[report.totalKey])),
                    style: const TextStyle(fontWeight: FontWeight.w800)),
              )),
        ],
      ]),
    );
  }

  Widget _periodView(InventoryFinanceData data) => Column(children: [
        _SectionCard(
          title: 'Periode fiskal',
          icon: Icons.event_available_outlined,
          child: Column(
              children: data.periods
                  .map((row) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${row.code} - ${row.name}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text('${row.startDate} s.d. ${row.endDate}'),
                        trailing: FilledButton.tonal(
                          onPressed: _busy
                              ? null
                              : () => _command(
                                    () => widget.client.changeFiscalPeriod(
                                        row.id,
                                        close: row.status == 'OPEN'),
                                    row.status == 'OPEN'
                                        ? 'Validasi penutupan periode selesai.'
                                        : 'Periode dibuka kembali.',
                                  ),
                          child: Text(
                              row.status == 'OPEN' ? 'Tutup' : 'Buka kembali'),
                        ),
                      ))
                  .toList()),
        ),
        const SizedBox(height: 12),
        _SectionCard(
          title: 'Riwayat proses akhir',
          icon: Icons.history,
          child: Column(
              children: data.closeRuns
                  .map((row) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text('${row.number} - ${row.periodCode}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w800)),
                        subtitle: Text(row.startedAt),
                        trailing: Chip(label: Text(row.status)),
                      ))
                  .toList()),
        ),
      ]);
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
  const _InventoryFeaturePage({required this.contract});

  final Future<InventoryParityContract> contract;

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
        FutureBuilder<InventoryParityContract>(
          future: contract,
          builder: (context, state) {
            if (state.connectionState != ConnectionState.done) {
              return const _SectionCard(
                title: 'Memeriksa paritas',
                icon: Icons.sync_outlined,
                child: LinearProgressIndicator(),
              );
            }
            if (state.hasError || state.data == null) {
              return _SectionCard(
                title: 'Kontrak paritas belum dapat dimuat',
                icon: Icons.warning_amber_outlined,
                child: Text(state.error.toString()),
              );
            }
            return _ParityCoverageCard(contract: state.data!);
          },
        ),
        const SizedBox(height: 16),
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

class _ParityCoverageCard extends StatelessWidget {
  const _ParityCoverageCard({required this.contract});

  final InventoryParityContract contract;

  @override
  Widget build(BuildContext context) {
    final flutter = contract.flutter;
    return _SectionCard(
      title: 'Bukti Paritas Flutter',
      icon: Icons.fact_check_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            '${contract.screens} layar diperiksa dari kontrak API yang sama dengan Web.',
            style: const TextStyle(color: Color(0xFF475569), height: 1.45),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _CoveragePill('${flutter.operational}', 'operasional',
                  const Color(0xFF047857)),
              _CoveragePill(
                  '${flutter.readOnly}', 'baca-saja', const Color(0xFF0369A1)),
              _CoveragePill('${flutter.contractOnly}', 'belum berlayar',
                  const Color(0xFFB45309)),
            ],
          ),
          const SizedBox(height: 12),
          ...contract.items
              .where((item) => item.flutter != 'OPERATIONAL')
              .take(12)
              .map((item) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      item.flutter == 'READ_ONLY'
                          ? Icons.visibility_outlined
                          : Icons.construction_outlined,
                      color: item.flutter == 'READ_ONLY'
                          ? const Color(0xFF0369A1)
                          : const Color(0xFFB45309),
                    ),
                    title: Text('${item.screen}. ${item.name}'),
                    subtitle: Text(item.flutter == 'READ_ONLY'
                        ? 'Data nyata tersedia, command belum lengkap.'
                        : 'Kontrak ada, layar transaksi belum tersedia.'),
                  )),
        ],
      ),
    );
  }
}

class _CoveragePill extends StatelessWidget {
  const _CoveragePill(this.value, this.label, this.color);
  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text('$value $label',
          style: TextStyle(color: color, fontWeight: FontWeight.w800)),
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
    required this.imageUrl,
  });
  final String id;
  final String uomId;
  final String code;
  final String name;
  final double price;
  final int stock;
  final String imageUrl;
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

  factory InventoryCatalog.fromApi(
    Map<String, Object?> data, {
    required Uri baseUrl,
  }) {
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
                imageUrl: _resolveMediaUrl(
                  baseUrl,
                  (row['image_url'] ?? '').toString(),
                ),
              ))
          .toList(),
    );
  }

  static String _resolveMediaUrl(Uri baseUrl, String value) {
    if (value.isEmpty) return '';
    final parsed = Uri.tryParse(value);
    if (parsed?.hasScheme == true) return value;
    return baseUrl
        .resolve(value.startsWith('/') ? value.substring(1) : value)
        .toString();
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
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 72,
                height: 72,
                color: Colors.white,
                alignment: Alignment.center,
                child: product.imageUrl.isEmpty
                    ? const Icon(Icons.inventory_2_outlined,
                        color: Color(0xFF64748B))
                    : Image.network(
                        product.imageUrl,
                        width: 72,
                        height: 72,
                        fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.inventory_2_outlined,
                          color: Color(0xFF64748B),
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 12),
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
    InventoryLocalDatabase? localDatabase,
  })  : _http = http ?? HttpClient(),
        _localDatabase = localDatabase;

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
        localDatabase: InventoryLocalDatabase.shared(),
      );

  final Uri baseUrl;
  final String tenantCode;
  final HttpClient _http;
  final InventoryLocalDatabase? _localDatabase;
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
    unawaited(synchronize());
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
    if (_token == null) {
      throw const InventoryApiException('Silakan masuk kembali.');
    }
    final dashboard = await _request<Map<String, Object?>>(
        'GET', '/inventory/sales-dashboard');
    final reconciliation = await _request<Map<String, Object?>>(
        'GET', '/inventory/legacy-import-reconciliation');
    return InventorySnapshot.fromApi(dashboard, reconciliation);
  }

  Future<InventoryParityContract> parityContract() async {
    if (_token == null) {
      throw const InventoryApiException('Silakan masuk kembali.');
    }
    final data = await _request<Map<String, Object?>>(
        'GET', '/inventory/parity-contract');
    return InventoryParityContract.fromApi(data);
  }

  Future<InventoryFinanceData> financeWorkspace() async {
    final data = await _request<Map<String, Object?>>(
        'GET', '/inventory/finance-workspace');
    return InventoryFinanceData.fromApi(data);
  }

  Future<void> createFinanceAccount({
    required String code,
    required String name,
    required String category,
    required String normalBalance,
  }) async {
    if (code.isEmpty || name.isEmpty) {
      throw const InventoryApiException('Kode dan nama perkiraan wajib diisi.');
    }
    await _request<Map<String, Object?>>(
      'POST',
      '/inventory/chart-accounts',
      body: {
        'code': code,
        'name': name,
        'category': category,
        'normalBalance': normalBalance,
        'description': 'Dibuat dari Flutter Inventory',
      },
    );
  }

  Future<void> createJournal({
    required String periodId,
    required String description,
    required double amount,
    required String debitAccountId,
    required String creditAccountId,
  }) async {
    if (description.isEmpty ||
        amount <= 0 ||
        debitAccountId == creditAccountId) {
      throw const InventoryApiException(
          'Uraian, nominal positif, dan dua akun berbeda wajib diisi.');
    }
    await _request<Map<String, Object?>>(
      'POST',
      '/inventory/journals',
      headers: {
        'Idempotency-Key': 'JRN_${DateTime.now().microsecondsSinceEpoch}'
      },
      body: {
        'fiscalPeriodId': periodId,
        'journalDate': DateTime.now().toIso8601String().substring(0, 10),
        'description': description,
        'lines': [
          {
            'accountId': debitAccountId,
            'debit': amount,
            'credit': 0,
            'description': description
          },
          {
            'accountId': creditAccountId,
            'debit': 0,
            'credit': amount,
            'description': description
          },
        ],
      },
    );
  }

  Future<void> postJournal(String id) async {
    await _request<Map<String, Object?>>(
        'POST', '/inventory/journals/$id/post');
  }

  Future<void> reverseJournal(String id) async {
    await _request<Map<String, Object?>>(
        'POST', '/inventory/journals/$id/reverse',
        body: {'note': 'Pembalikan dari Flutter Inventory'});
  }

  Future<void> changeFiscalPeriod(String id, {required bool close}) async {
    await _request<Map<String, Object?>>(
      'POST',
      '/inventory/fiscal-periods/$id/${close ? 'close' : 'reopen'}',
      body: {
        'note': close
            ? 'Proses akhir dari Flutter Inventory'
            : 'Dibuka kembali dari Flutter Inventory'
      },
    );
  }

  Future<InventoryFinancialReport> financeReport(
      String code, DateTime asOf) async {
    final data = await _request<Map<String, Object?>>(
      'POST',
      '/reports/$code/preview',
      body: {
        'asOfDate': asOf.toIso8601String().substring(0, 10),
        'filters': {}
      },
    );
    return InventoryFinancialReport.fromApi(data);
  }

  Future<String> snapshotFinanceReport(String code, String asOfDate) async {
    final data = await _request<Map<String, Object?>>(
      'POST',
      '/reports/$code/snapshot',
      body: {'asOfDate': asOfDate, 'filters': {}},
    );
    return (data['id'] ?? '').toString();
  }

  Future<void> logFinancePrint(String snapshotId, String documentNumber) async {
    await _request<Map<String, Object?>>(
      'POST',
      '/report-snapshots/$snapshotId/print-log',
      body: {'format': 'PDF', 'documentNumber': documentNumber},
    );
  }

  Future<InventoryStockPricingData> stockPricing() async {
    final values = await Future.wait([
      _request<Map<String, Object?>>('GET', '/inventory/mobile-catalog'),
      _request<List<Object?>>(
          'GET', '/inventory/legacy/price-history?pageSize=1000'),
      _request<Map<String, Object?>>('GET', '/stock-opnames'),
      _request<List<Object?>>('GET', '/inventory/price-books'),
      _request<Map<String, Object?>>('GET', '/inventory/master-data'),
    ]);
    return InventoryStockPricingData.fromApi(
      values[0] as Map<String, Object?>,
      values[1] as List<Object?>,
      values[2] as Map<String, Object?>,
      values[3] as List<Object?>,
      values[4] as Map<String, Object?>,
    );
  }

  Future<void> createStockOpname(String warehouseId) async {
    await _request<Map<String, Object?>>('POST', '/stock-opnames', body: {
      'warehouseId': warehouseId,
      'opnameDate': DateTime.now().toIso8601String().substring(0, 10),
      'note': 'Dibuat dari Flutter Inventory',
    });
  }

  Future<void> stockOpnameCommand(String id, String command) async {
    if (!const ['freeze', 'approve', 'post'].contains(command)) {
      throw const InventoryApiException('Perintah opname tidak dikenal.');
    }
    await _request<Map<String, Object?>>('POST', '/stock-opnames/$id/$command');
  }

  Future<List<InventoryStockOpnameLine>> stockOpnameLines(String id) async {
    final detail =
        await _request<Map<String, Object?>>('GET', '/stock-opnames/$id');
    return ((detail['lines'] as List?) ?? const [])
        .whereType<Map>()
        .map((row) =>
            InventoryStockOpnameLine.fromApi(Map<String, Object?>.from(row)))
        .toList(growable: false);
  }

  Future<void> countStockOpname(
      String id, List<Map<String, Object?>> lines) async {
    if (lines.isEmpty) {
      throw const InventoryApiException('Isi minimal satu hasil hitung fisik.');
    }
    await _request<Map<String, Object?>>('PATCH', '/stock-opnames/$id',
        body: {'lines': lines});
  }

  Future<void> createPriceBook({
    required String code,
    required String name,
    required String scopeType,
    String? scopeId,
    required String productId,
    required double price,
  }) async {
    if (code.isEmpty ||
        name.isEmpty ||
        !const ['TENANT', 'CUSTOMER', 'SUPPLIER'].contains(scopeType) ||
        (scopeType != 'TENANT' && (scopeId == null || scopeId.isEmpty)) ||
        productId.isEmpty ||
        price < 0) {
      throw const InventoryApiException(
          'Kode, nama, produk, dan harga wajib valid.');
    }
    final created = await _request<Map<String, Object?>>(
      'POST',
      '/inventory/price-books',
      body: {
        'code': code,
        'name': name,
        'scopeType': scopeType,
        if (scopeType != 'TENANT') 'scopeId': scopeId,
        'lines': [
          {'productId': productId, 'minimumQty': 1, 'price': price}
        ],
      },
    );
    await _request<Map<String, Object?>>(
      'PATCH',
      '/inventory/price-books/${created['id']}/status',
      body: {'status': 'SUBMITTED', 'note': 'Diajukan dari Flutter Inventory'},
    );
  }

  Future<List<InventoryPartyRecord>> partyMasters(String kind) async {
    if (!partyLabels.containsKey(kind)) {
      throw const InventoryApiException('Jenis master tidak dikenal.');
    }
    final cacheKey = 'party-master-$kind';
    try {
      final values = await Future.wait([
        _request<List<Object?>>(
          'GET',
          '/$kind?page=1&pageSize=100&includeInactive=true&sortBy=name',
        ),
        _request<List<Object?>>(
          'GET',
          '/inventory/party-master-balances/$kind',
        ),
      ]);
      await _localDatabase?.putCache(cacheKey, {
        'rows': values[0],
        'balances': values[1],
      });
      return InventoryPartyRecord.fromApiLists(values[0], values[1]);
    } on Object {
      final cached = await _localDatabase?.getCache(cacheKey);
      if (cached == null) rethrow;
      return InventoryPartyRecord.fromApiLists(
        (cached['rows'] as List?) ?? const [],
        (cached['balances'] as List?) ?? const [],
      );
    }
  }

  Future<Map<String, Object?>> supplierWorkspace() async {
    const cacheKey = 'supplier-workspace-v1';
    try {
      final value = await _request<Map<String, Object?>>(
        'GET',
        '/inventory/supplier-workspace',
      );
      await _localDatabase?.putCache(cacheKey, value);
      return value;
    } on Object {
      final cached = await _localDatabase?.getCache(cacheKey);
      if (cached == null) rethrow;
      return cached;
    }
  }

  Future<PartySaveResult> saveParty({
    required String kind,
    required String? id,
    required int? version,
    required Map<String, Object?> payload,
  }) async {
    final database = _localDatabase;
    final deviceId = await database?.getOrCreateDeviceId() ?? tenantCode;
    final eventId =
        '${deviceId}_MASTER_${DateTime.now().microsecondsSinceEpoch}';
    final method = id == null ? 'POST' : 'PATCH';
    final path = id == null ? '/$kind' : '/$kind/$id';
    final body = <String, Object?>{
      ...payload,
      if (version != null) 'version': version,
    };
    await database?.enqueue(
      eventId: eventId,
      method: method,
      path: path,
      payload: body,
    );
    try {
      final row = await _request<Map<String, Object?>>(
        method,
        path,
        body: body,
      );
      await database?.markCompleted(eventId);
      return PartySaveResult(row: row, queued: false);
    } on SocketException catch (error) {
      final item = await _outboxItem(eventId);
      if (item != null) await database?.markFailed(item, error);
      return const PartySaveResult(row: {}, queued: true);
    } on TimeoutException catch (error) {
      final item = await _outboxItem(eventId);
      if (item != null) await database?.markFailed(item, error);
      return const PartySaveResult(row: {}, queued: true);
    }
  }

  Future<void> toggleParty(String kind, InventoryPartyRecord record) async {
    await _request<Map<String, Object?>>(
      'POST',
      '/$kind/${record.id}/${record.active ? 'deactivate' : 'activate'}',
      body: record.active
          ? {'reason': 'Dinonaktifkan dari aplikasi Inventory'}
          : null,
    );
  }

  Future<InventoryOperationsData> operations(
      {required bool includePayables,
      bool includeSettled = false,
      bool includeReceivableSettled = false}) async {
    if (_token == null) {
      throw const InventoryApiException('Silakan masuk kembali.');
    }
    final receivableFuture = _request<List<Object?>>('GET',
        '/inventory/legacy/receivables?pageSize=1000&includeSettled=$includeReceivableSettled');
    final receiptFuture = _request<List<Object?>>('GET', '/ar/receipts');
    final handoverFuture =
        _request<List<Object?>>('GET', '/sales-note-handovers');
    final payableFuture = includePayables
        ? _request<List<Object?>>('GET',
            '/inventory/legacy/payables?pageSize=1000&includeSettled=$includeSettled')
        : Future.value(<Object?>[]);
    final purchaseFuture = includePayables
        ? _request<List<Object?>>('GET', '/purchase-orders?pageSize=500')
        : Future.value(<Object?>[]);
    final paymentFuture = includePayables
        ? _request<List<Object?>>('GET', '/ap/payments')
        : Future.value(<Object?>[]);
    final masterFuture = includePayables
        ? _request<Map<String, Object?>>('GET', '/inventory/master-data')
        : Future.value(<String, Object?>{});
    final catalogFuture = includePayables
        ? _request<Map<String, Object?>>('GET', '/inventory/mobile-catalog')
        : Future.value(<String, Object?>{});
    final opnameFuture = includePayables
        ? _request<Map<String, Object?>>('GET', '/stock-opnames')
        : Future.value(<String, Object?>{});
    final values = await Future.wait([
      receivableFuture,
      payableFuture,
      handoverFuture,
      purchaseFuture,
      paymentFuture,
      masterFuture,
      catalogFuture,
      opnameFuture,
      receiptFuture,
    ]);
    return InventoryOperationsData.fromApi(
      values[0] as List<Object?>,
      values[1] as List<Object?>,
      values[2] as List<Object?>,
      values[3] as List<Object?>,
      values[4] as List<Object?>,
      values[5] as Map<String, Object?>,
      values[6] as Map<String, Object?>,
      values[7] as Map<String, Object?>,
      baseUrl,
      values[8] as List<Object?>,
    );
  }

  Future<String> createPurchaseOrder({
    required String supplierId,
    required String warehouseId,
    required InventoryProductDemo product,
    required double quantity,
    required double unitPrice,
    String? expectedDate,
  }) async {
    if (supplierId.isEmpty ||
        warehouseId.isEmpty ||
        product.id.isEmpty ||
        product.uomId.isEmpty ||
        quantity <= 0 ||
        unitPrice < 0) {
      throw const InventoryApiException('Data purchase order belum lengkap.');
    }
    final created = await _request<Map<String, Object?>>(
      'POST',
      '/purchase-orders',
      headers: {
        'Idempotency-Key':
            'PO_${DateTime.now().microsecondsSinceEpoch}_${product.id}'
      },
      body: {
        'supplierId': supplierId,
        'warehouseId': warehouseId,
        if (expectedDate != null && expectedDate.isNotEmpty)
          'expectedDate': expectedDate,
        'note': 'Dibuat dari Flutter Inventory',
        'lines': [
          {
            'productId': product.id,
            'uomId': product.uomId,
            'orderedQty': quantity,
            'unitPrice': unitPrice,
          }
        ],
      },
    );
    return (created['purchase_order_number'] ??
            created['purchaseOrderNumber'] ??
            created['id'] ??
            '-')
        .toString();
  }

  Future<String> createPurchaseOrderWorkspace(
      PurchaseWorkspaceSubmission submission) async {
    if (submission.supplierId.isEmpty ||
        submission.warehouseId.isEmpty ||
        submission.lines.isEmpty ||
        submission.lines.any((line) =>
            line.product.id.isEmpty ||
            line.product.uomId.isEmpty ||
            line.quantity <= 0 ||
            line.unitPrice < 0)) {
      throw const InventoryApiException('Data purchase order belum lengkap.');
    }
    final created = await _request<Map<String, Object?>>(
      'POST',
      '/purchase-orders',
      headers: {
        'Idempotency-Key':
            'PO_${DateTime.now().microsecondsSinceEpoch}_${submission.lines.length}'
      },
      body: {
        'supplierId': submission.supplierId,
        'warehouseId': submission.warehouseId,
        'expectedDate':
            submission.expectedDate.toIso8601String().substring(0, 10),
        'note': submission.note.isEmpty
            ? 'Dibuat dari Flutter Inventory'
            : submission.note,
        'taxPercent': submission.taxPercent,
        'lines': submission.lines
            .map((line) => {
                  'productId': line.product.id,
                  'uomId': line.product.uomId,
                  'orderedQty': line.quantity,
                  'unitPrice': line.unitPrice,
                  'discountPercent': line.discountPercent,
                  'batchNumber':
                      line.batch.trim().isEmpty ? null : line.batch.trim(),
                  'expiryDate':
                      line.expiryDate?.toIso8601String().substring(0, 10),
                })
            .toList(),
      },
    );
    return (created['purchase_order_number'] ??
            created['purchaseOrderNumber'] ??
            created['id'] ??
            '-')
        .toString();
  }

  Future<void> transitionPurchaseOrder(String id, String action) async {
    if (!const ['submit', 'approve', 'send'].contains(action)) {
      throw const InventoryApiException('Transisi purchase order tidak valid.');
    }
    await _request<Map<String, Object?>>(
        'POST', '/purchase-orders/$id/$action');
  }

  Future<Map<String, Object?>> purchaseOrderDetail(String id) =>
      _request<Map<String, Object?>>('GET', '/purchase-orders/$id');

  Future<String> receivePurchaseOrder(
      PurchaseOrderSummary order, String batch, String expiry) async {
    final detail = await purchaseOrderDetail(order.id);
    final lines = ((detail['lines'] as List?) ?? const [])
        .whereType<Map>()
        .map((raw) => Map<String, Object?>.from(raw))
        .toList();
    if (lines.isEmpty) {
      throw const InventoryApiException('Purchase order tidak memiliki item.');
    }
    final created = await _request<Map<String, Object?>>(
      'POST',
      '/goods-receipts',
      headers: {
        'Idempotency-Key':
            'GR_${DateTime.now().microsecondsSinceEpoch}_${order.id}'
      },
      body: {
        'purchaseOrderId': order.id,
        'supplierDoNumber': 'MOBILE-${DateTime.now().millisecondsSinceEpoch}',
        'note': 'Penerimaan dari Flutter Inventory',
        'lines': lines
            .map((line) => {
                  'purchaseOrderLineId': (line['id'] ?? '').toString(),
                  'receivedQty': toDouble(line['ordered_qty']),
                  if (batch.isNotEmpty) 'batchNumber': batch,
                  if (expiry.isNotEmpty) 'expiryDate': expiry,
                })
            .toList(),
      },
    );
    return (created['receipt_number'] ??
            created['receiptNumber'] ??
            created['id'] ??
            '-')
        .toString();
  }

  Future<String> settle(SettlementDocument document) async {
    final path = document.kind == 'AP' ? '/ap/payments' : '/ar/receipts';
    final created = await _request<Map<String, Object?>>(
      'POST',
      path,
      headers: {
        'Idempotency-Key':
            '${document.kind}_${DateTime.now().microsecondsSinceEpoch}_${document.id}'
      },
      body: {
        'partyId': document.partyId,
        'method': 'TRANSFER',
        'allocations': [
          {'ledgerId': document.id, 'amount': document.amount}
        ],
      },
    );
    final id = (created['id'] ?? '').toString();
    await _request<Map<String, Object?>>('POST', '$path/$id/post');
    return (created['number'] ??
            created['payment_number'] ??
            created['receipt_number'] ??
            id)
        .toString();
  }

  Future<String> carryNote(SettlementDocument document) async {
    if (document.salespersonId == null) {
      throw const InventoryApiException(
          'Piutang belum memiliki sales penanggung jawab.');
    }
    final created = await _request<Map<String, Object?>>(
      'POST',
      '/sales-note-handovers',
      body: {
        'salespersonId': document.salespersonId,
        'lines': [
          {'receivableLedgerId': document.id}
        ],
      },
    );
    final id = (created['id'] ?? '').toString();
    await _request<Map<String, Object?>>(
        'POST', '/sales-note-handovers/$id/handover');
    return (created['handover_number'] ?? id).toString();
  }

  Future<void> returnAndCloseHandover(String id) async {
    final detail = await _request<Map<String, Object?>>(
        'GET', '/sales-note-handovers/$id');
    final lines = ((detail['lines'] as List?) ?? const [])
        .whereType<Map<String, Object?>>()
        .map((row) => {
              'lineId': (row['id'] ?? '').toString(),
              'status': 'RETURNED',
              'amount': toDouble(row['outstanding_amount']),
            })
        .toList();
    if (lines.isEmpty) {
      throw const InventoryApiException('Nota tidak memiliki rincian.');
    }
    await _request<Map<String, Object?>>(
      'POST',
      '/sales-note-handovers/$id/return',
      body: {'lines': lines},
    );
    await _request<Map<String, Object?>>(
        'POST', '/sales-note-handovers/$id/close');
  }

  Future<InventoryCatalog> catalog() async {
    if (_token == null) {
      throw const InventoryApiException('Silakan masuk kembali.');
    }
    try {
      final data = await _request<Map<String, Object?>>(
          'GET', '/inventory/mobile-catalog');
      await _localDatabase?.putCache('mobile-catalog', data);
      return InventoryCatalog.fromApi(data, baseUrl: baseUrl);
    } on Object {
      final cached = await _localDatabase?.getCache('mobile-catalog');
      if (cached != null) {
        return InventoryCatalog.fromApi(cached, baseUrl: baseUrl);
      }
      rethrow;
    }
  }

  Future<Map<String, Object?>> createOrder({
    required String customerId,
    required List<Map<String, Object?>> lines,
    double taxPercent = 0,
    String? paymentTerm,
    String? note,
  }) async {
    final deviceId = await _localDatabase?.getOrCreateDeviceId() ?? tenantCode;
    final eventId =
        '${deviceId}_${DateTime.now().microsecondsSinceEpoch}_${lines.length}';
    final payload = <String, Object?>{
      'deviceId': deviceId,
      'deviceEventId': eventId,
      'customerId': customerId,
      'taxPercent': taxPercent,
      if (paymentTerm != null && paymentTerm.trim().isNotEmpty)
        'paymentTerm': paymentTerm.trim(),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      'lines': lines,
    };
    await _localDatabase?.enqueue(
      eventId: eventId,
      method: 'POST',
      path: '/inventory/mobile-orders',
      payload: payload,
    );
    try {
      final result = await _request<Map<String, Object?>>(
        'POST',
        '/inventory/mobile-orders',
        body: payload,
      );
      await _localDatabase?.markCompleted(eventId);
      return result;
    } on SocketException catch (error) {
      return _queuedOrder(eventId, error);
    } on TimeoutException catch (error) {
      return _queuedOrder(eventId, error);
    } on HttpException catch (error) {
      return _queuedOrder(eventId, error);
    } on Object catch (error) {
      final item = await _outboxItem(eventId);
      if (item != null) await _localDatabase?.markFailed(item, error);
      rethrow;
    }
  }

  Future<Map<String, Object?>> _queuedOrder(
      String eventId, Object error) async {
    final item = await _outboxItem(eventId);
    if (item != null) await _localDatabase?.markFailed(item, error);
    return {
      'order_number': 'TERTUNDA-${eventId.substring(eventId.length - 8)}',
      'queued': true,
    };
  }

  Future<InventorySyncResult> synchronize() async {
    final database = _localDatabase;
    if (database == null || _token == null) {
      return const InventorySyncResult(0, 0);
    }
    final deviceId = await database.getOrCreateDeviceId();
    var cursor = await database.lastPullCursor(deviceId);
    var sent = 0;
    final pending = await database.pendingOutbox();
    for (final item in pending) {
      try {
        await _request<Map<String, Object?>>(
          item.method,
          item.path,
          body: jsonDecode(item.payload) as Map<String, Object?>,
        );
        await database.markCompleted(item.eventId);
        sent += 1;
      } on Object catch (error) {
        await database.markFailed(item, error);
        break;
      }
    }
    final pendingCount = await database.pendingCount();
    try {
      await _request<Map<String, Object?>>(
        'POST',
        '/sync/devices/register',
        body: {
          'deviceId': deviceId,
          'platform': Platform.operatingSystem,
          'appVersion': '0.1.6',
          'pendingOutbox': pendingCount,
        },
      );

      var refreshCatalog = cursor == 0;
      if (cursor > 0) {
        var hasMore = true;
        var pages = 0;
        while (hasMore && pages < 4) {
          final delta = await _request<Map<String, Object?>>(
            'GET',
            '/sync/pull?afterCursor=$cursor&limit=250',
          );
          final events = (delta['events'] as List?) ?? const [];
          refreshCatalog = refreshCatalog || events.isNotEmpty;
          cursor = int.tryParse((delta['nextCursor'] ?? cursor).toString()) ??
              cursor;
          hasMore = delta['hasMore'] == true;
          pages += 1;
        }
      }
      if (refreshCatalog) {
        final bootstrap = await _request<Map<String, Object?>>(
          'GET',
          '/sync/bootstrap',
        );
        await database.putCache('mobile-catalog', {
          'customers': bootstrap['customers'] ?? const [],
          'products': bootstrap['products'] ?? const [],
        });
        cursor =
            int.tryParse((bootstrap['cursor'] ?? cursor).toString()) ?? cursor;
      }
      await database.recordSync(deviceId, cursor: cursor);
    } on Object catch (error) {
      await database.recordSync(deviceId,
          cursor: cursor, error: error.toString());
    }
    return InventorySyncResult(sent, pendingCount);
  }

  Future<int> pendingOutboxCount() =>
      _localDatabase?.pendingCount() ?? Future.value(0);

  Future<InventoryOutboxItem?> _outboxItem(String eventId) async {
    final rows = await _localDatabase?.pendingOutbox();
    if (rows == null) return null;
    for (final row in rows) {
      if (row.eventId == eventId) return row;
    }
    return null;
  }

  Future<T> _request<T extends Object?>(
    String method,
    String path, {
    Object? body,
    bool withoutToken = false,
    Map<String, String>? headers,
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
    headers?.forEach((name, value) => request.headers.set(name, value));
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

class InventorySyncResult {
  const InventorySyncResult(this.sent, this.pending);
  final int sent;
  final int pending;
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

const partyLabels = <String, String>{
  'suppliers': 'Pemasok',
  'customers': 'Pelanggan',
  'salespeople': 'Sales',
};

const partyCodeLimits = <String, int>{
  'suppliers': 3,
  'customers': 5,
  'salespeople': 2,
};

class PartyField {
  const PartyField(
    this.key,
    this.label, {
    this.numeric = false,
    this.multiline = false,
    this.sensitive = false,
  });

  final String key;
  final String label;
  final bool numeric;
  final bool multiline;
  final bool sensitive;
}

const partyFields = <String, List<PartyField>>{
  'suppliers': [
    PartyField('code', 'Kode pemasok'),
    PartyField('name', 'Nama pemasok'),
    PartyField('legacy_payment_days', 'Termin pembayaran (hari)',
        numeric: true),
    PartyField('contact_person', 'Kontak utama'),
    PartyField('address_text', 'Alamat', multiline: true),
    PartyField('region_name', 'Wilayah'),
    PartyField('phone', 'Nomor telepon'),
    PartyField('email', 'Email'),
    PartyField('bank_account_number', 'Nomor rekening', sensitive: true),
    PartyField('bank_account_name', 'Nama pemilik rekening', sensitive: true),
    PartyField('bank_name', 'Bank', sensitive: true),
    PartyField('bank_address', 'Alamat bank', multiline: true, sensitive: true),
  ],
  'customers': [
    PartyField('code', 'Kode pelanggan'),
    PartyField('name', 'Nama pelanggan'),
    PartyField('legacy_payment_days', 'Termin pembayaran (hari)',
        numeric: true),
    PartyField('default_discount_percent', 'Diskon bawaan (%)', numeric: true),
    PartyField('credit_limit', 'Batas kredit', numeric: true),
    PartyField('address_text', 'Alamat', multiline: true),
    PartyField('region_name', 'Wilayah/rute'),
    PartyField('phone', 'Nomor telepon'),
    PartyField('email', 'Email'),
    PartyField('bank_account_number', 'Nomor rekening', sensitive: true),
    PartyField('bank_account_name', 'Nama pemilik rekening', sensitive: true),
    PartyField('bank_name', 'Bank', sensitive: true),
    PartyField('bank_address', 'Alamat bank', multiline: true, sensitive: true),
  ],
  'salespeople': [
    PartyField('code', 'Kode sales'),
    PartyField('name', 'Nama sales'),
    PartyField('account_number', 'Nomor perkiraan'),
    PartyField('territory', 'Wilayah/rute'),
    PartyField('monthly_target', 'Target bulanan', numeric: true),
    PartyField('phone', 'Nomor telepon'),
    PartyField('email', 'Email'),
    PartyField('description', 'Catatan penugasan', multiline: true),
  ],
};

class InventoryFinanceData {
  const InventoryFinanceData({
    required this.accounts,
    required this.periods,
    required this.journals,
    required this.closeRuns,
  });

  factory InventoryFinanceData.fromApi(Map<String, Object?> data) =>
      InventoryFinanceData(
        accounts: ((data['accounts'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map(FinanceAccount.fromApi)
            .toList(),
        periods: ((data['periods'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map(FinancePeriod.fromApi)
            .toList(),
        journals: ((data['journals'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map(FinanceJournal.fromApi)
            .toList(),
        closeRuns: ((data['closeRuns'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .map(FinanceCloseRun.fromApi)
            .toList(),
      );

  final List<FinanceAccount> accounts;
  final List<FinancePeriod> periods;
  final List<FinanceJournal> journals;
  final List<FinanceCloseRun> closeRuns;
}

class FinanceAccount {
  const FinanceAccount(this.id, this.code, this.name, this.category,
      this.normalBalance, this.allowPosting);

  factory FinanceAccount.fromApi(Map<String, Object?> row) => FinanceAccount(
        (row['id'] ?? '').toString(),
        (row['code'] ?? '').toString(),
        (row['name'] ?? '').toString(),
        (row['account_type'] ?? 'ASSET').toString(),
        (row['normal_balance'] ?? 'DEBIT').toString(),
        row['allow_posting'] != false,
      );

  final String id;
  final String code;
  final String name;
  final String category;
  final String normalBalance;
  final bool allowPosting;
}

class FinancePeriod {
  const FinancePeriod(
      this.id, this.code, this.name, this.startDate, this.endDate, this.status);

  factory FinancePeriod.fromApi(Map<String, Object?> row) => FinancePeriod(
        (row['id'] ?? '').toString(),
        (row['code'] ?? '').toString(),
        (row['name'] ?? '').toString(),
        (row['start_date'] ?? '').toString(),
        (row['end_date'] ?? '').toString(),
        (row['status'] ?? '').toString(),
      );

  final String id;
  final String code;
  final String name;
  final String startDate;
  final String endDate;
  final String status;
}

class FinanceJournal {
  const FinanceJournal(this.id, this.number, this.date, this.description,
      this.status, this.debit, this.credit);

  factory FinanceJournal.fromApi(Map<String, Object?> row) => FinanceJournal(
        (row['id'] ?? '').toString(),
        (row['journal_number'] ?? '').toString(),
        (row['journal_date'] ?? '').toString(),
        (row['description'] ?? '').toString(),
        (row['status'] ?? '').toString(),
        toDouble(row['total_debit']),
        toDouble(row['total_credit']),
      );

  final String id;
  final String number;
  final String date;
  final String description;
  final String status;
  final double debit;
  final double credit;
}

class FinanceCloseRun {
  const FinanceCloseRun(
      this.number, this.periodCode, this.status, this.startedAt);

  factory FinanceCloseRun.fromApi(Map<String, Object?> row) => FinanceCloseRun(
        (row['run_number'] ?? '').toString(),
        (row['period_code'] ?? '').toString(),
        (row['status'] ?? '').toString(),
        (row['started_at'] ?? '').toString(),
      );

  final String number;
  final String periodCode;
  final String status;
  final String startedAt;
}

class InventoryFinancialReport {
  const InventoryFinancialReport({
    required this.reportCode,
    required this.title,
    required this.asOfDate,
    required this.totalKey,
    required this.total,
    required this.rows,
  });

  factory InventoryFinancialReport.fromApi(Map<String, Object?> data) {
    final totals = data['totals'] as Map<String, Object?>? ?? const {};
    final key = totals.keys.isEmpty ? 'balance' : totals.keys.first;
    return InventoryFinancialReport(
      reportCode: (data['reportCode'] ?? '').toString(),
      title: (data['title'] ?? '').toString(),
      asOfDate: (data['asOfDate'] ?? '').toString(),
      totalKey: key,
      total: toDouble(totals[key]),
      rows: ((data['rows'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .toList(),
    );
  }

  final String reportCode;
  final String title;
  final String asOfDate;
  final String totalKey;
  final double total;
  final List<Map<String, Object?>> rows;
}

class InventoryStockPricingData {
  const InventoryStockPricingData({
    required this.products,
    required this.prices,
    required this.warehouses,
    required this.opnames,
    required this.priceBooks,
    required this.customers,
    required this.suppliers,
  });

  factory InventoryStockPricingData.fromApi(
    Map<String, Object?> catalog,
    List<Object?> prices,
    Map<String, Object?> opname,
    List<Object?> books,
    Map<String, Object?> masters,
  ) {
    return InventoryStockPricingData(
      products: ((catalog['products'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(InventoryStockProduct.fromApi)
          .where((row) => row.id.isNotEmpty)
          .toList(),
      prices: prices
          .whereType<Map<String, Object?>>()
          .map(InventoryPriceHistory.fromApi)
          .toList(),
      warehouses: ((opname['warehouses'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => InventoryWarehouse(
                (row['id'] ?? '').toString(),
                (row['code'] ?? '').toString(),
                (row['name'] ?? '').toString(),
              ))
          .toList(),
      opnames: ((opname['sessions'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(InventoryStockOpname.fromApi)
          .toList(),
      priceBooks: books
          .whereType<Map<String, Object?>>()
          .map(InventoryPriceBookSummary.fromApi)
          .toList(),
      customers: ((masters['customers'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(InventoryPriceParty.fromApi)
          .toList(),
      suppliers: ((masters['suppliers'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(InventoryPriceParty.fromApi)
          .toList(),
    );
  }

  final List<InventoryStockProduct> products;
  final List<InventoryPriceHistory> prices;
  final List<InventoryWarehouse> warehouses;
  final List<InventoryStockOpname> opnames;
  final List<InventoryPriceBookSummary> priceBooks;
  final List<InventoryPriceParty> customers;
  final List<InventoryPriceParty> suppliers;
}

class InventoryPriceParty {
  const InventoryPriceParty(this.id, this.code, this.name);

  factory InventoryPriceParty.fromApi(Map<String, Object?> row) =>
      InventoryPriceParty(
        (row['id'] ?? '').toString(),
        (row['code'] ?? '').toString(),
        (row['name'] ?? '').toString(),
      );

  final String id;
  final String code;
  final String name;
}

class InventoryStockProduct {
  const InventoryStockProduct(
      this.id, this.code, this.name, this.uom, this.stock, this.price);

  factory InventoryStockProduct.fromApi(Map<String, Object?> row) =>
      InventoryStockProduct(
        (row['id'] ?? '').toString(),
        (row['code'] ?? '').toString(),
        (row['name'] ?? '').toString(),
        (row['uom_code'] ?? row['uom'] ?? 'PCS').toString(),
        toInt(row['available_qty']),
        toDouble(row['price']),
      );

  final String id;
  final String code;
  final String name;
  final String uom;
  final int stock;
  final double price;
}

class InventoryWarehouse {
  const InventoryWarehouse(this.id, this.code, this.name);
  final String id;
  final String code;
  final String name;
}

class InventoryStockOpname {
  const InventoryStockOpname({
    required this.id,
    required this.number,
    required this.status,
    required this.warehouse,
    required this.lines,
    required this.counted,
    required this.varianceValue,
  });

  factory InventoryStockOpname.fromApi(Map<String, Object?> row) =>
      InventoryStockOpname(
        id: (row['id'] ?? '').toString(),
        number: (row['opname_number'] ?? '-').toString(),
        status: (row['status'] ?? '-').toString(),
        warehouse: (row['warehouse_name'] ?? '-').toString(),
        lines: toInt(row['line_count']),
        counted: toInt(row['counted_count']),
        varianceValue: toDouble(row['variance_value']),
      );

  final String id;
  final String number;
  final String status;
  final String warehouse;
  final int lines;
  final int counted;
  final double varianceValue;
}

class InventoryStockOpnameLine {
  const InventoryStockOpnameLine({
    required this.id,
    required this.code,
    required this.name,
    required this.lot,
    required this.expiry,
    required this.systemQty,
    required this.physicalQty,
  });

  factory InventoryStockOpnameLine.fromApi(Map<String, Object?> row) =>
      InventoryStockOpnameLine(
        id: (row['id'] ?? '').toString(),
        code: (row['product_code'] ?? '-').toString(),
        name: (row['product_name'] ?? '-').toString(),
        lot: nullableText(row['lot_number']),
        expiry: nullableText(row['expiry_date']),
        systemQty: toDouble(row['system_qty']),
        physicalQty:
            row['physical_qty'] == null ? null : toDouble(row['physical_qty']),
      );

  final String id;
  final String code;
  final String name;
  final String? lot;
  final String? expiry;
  final double systemQty;
  final double? physicalQty;
}

class InventoryPriceHistory {
  const InventoryPriceHistory(this.partyType, this.partyName, this.productCode,
      this.productName, this.date, this.price);

  factory InventoryPriceHistory.fromApi(Map<String, Object?> row) =>
      InventoryPriceHistory(
        (row['party_type'] ?? '-').toString(),
        (row['party_name'] ?? '-').toString(),
        (row['product_code'] ?? '-').toString(),
        (row['product_name'] ?? '-').toString(),
        (row['effective_date'] ?? '-').toString(),
        toDouble(row['price']),
      );

  final String partyType;
  final String partyName;
  final String productCode;
  final String productName;
  final String date;
  final double price;
}

class InventoryPriceBookSummary {
  const InventoryPriceBookSummary(
      this.code, this.name, this.scope, this.status, this.itemCount);

  factory InventoryPriceBookSummary.fromApi(Map<String, Object?> row) =>
      InventoryPriceBookSummary(
        (row['code'] ?? '-').toString(),
        (row['name'] ?? '-').toString(),
        (row['scope_type'] ?? '-').toString(),
        (row['approval_status'] ?? '-').toString(),
        toInt(row['item_count']),
      );

  final String code;
  final String name;
  final String scope;
  final String status;
  final int itemCount;
}

class InventoryPartyRecord {
  const InventoryPartyRecord({
    required this.id,
    required this.code,
    required this.name,
    required this.active,
    required this.version,
    required this.balance,
    required this.documentCount,
    required this.customerCount,
    required this.values,
  });

  static List<InventoryPartyRecord> fromApiLists(
      List<Object?> rows, List<Object?> balances) {
    final metrics = <String, Map<String, Object?>>{
      for (final row in balances.whereType<Map<String, Object?>>())
        (row['id'] ?? '').toString(): row,
    };
    return rows
        .whereType<Map<String, Object?>>()
        .map((row) {
          final id = (row['id'] ?? '').toString();
          final metric = metrics[id] ?? const <String, Object?>{};
          return InventoryPartyRecord(
            id: id,
            code: (row['code'] ?? '').toString(),
            name: (row['name'] ?? '').toString(),
            active: row['is_active'] != false,
            version: int.tryParse((row['version'] ?? 1).toString()) ?? 1,
            balance: toDouble(metric['balance']),
            documentCount:
                int.tryParse((metric['document_count'] ?? 0).toString()) ?? 0,
            customerCount:
                int.tryParse((metric['customer_count'] ?? 0).toString()) ?? 0,
            values: row,
          );
        })
        .where((row) => row.id.isNotEmpty)
        .toList();
  }

  final String id;
  final String code;
  final String name;
  final bool active;
  final int version;
  final double balance;
  final int documentCount;
  final int customerCount;
  final Map<String, Object?> values;

  String get subtitle =>
      (values['region_name'] ?? values['territory'] ?? 'Wilayah belum diisi')
          .toString();
}

class PartySaveResult {
  const PartySaveResult({required this.row, required this.queued});
  final Map<String, Object?> row;
  final bool queued;
}

class InventoryOperationsData {
  const InventoryOperationsData({
    required this.receivables,
    required this.payables,
    required this.handovers,
    required this.purchaseOrders,
    required this.apPayments,
    required this.suppliers,
    required this.products,
    required this.warehouses,
    this.arReceipts = const [],
  });

  factory InventoryOperationsData.fromApi(
    List<Object?> receivables,
    List<Object?> payables,
    List<Object?> handovers, [
    List<Object?> purchaseOrders = const [],
    List<Object?> apPayments = const [],
    Map<String, Object?> masters = const {},
    Map<String, Object?> catalog = const {},
    Map<String, Object?> opname = const {},
    Uri? baseUrl,
    List<Object?> arReceipts = const [],
  ]) {
    final catalogBaseUrl = baseUrl ?? Uri.parse('http://localhost');
    return InventoryOperationsData(
      receivables: receivables
          .whereType<Map<String, Object?>>()
          .map((row) => SettlementDocument.fromApi(row, kind: 'AR'))
          .where((row) => row.id.isNotEmpty && row.partyId.isNotEmpty)
          .toList(),
      payables: payables
          .whereType<Map<String, Object?>>()
          .map((row) => SettlementDocument.fromApi(row, kind: 'AP'))
          .where((row) => row.id.isNotEmpty && row.partyId.isNotEmpty)
          .toList(),
      handovers: handovers
          .whereType<Map<String, Object?>>()
          .map(HandoverSummary.fromApi)
          .where((row) => row.id.isNotEmpty)
          .toList(),
      purchaseOrders: purchaseOrders
          .whereType<Map<String, Object?>>()
          .map(PurchaseOrderSummary.fromApi)
          .where((row) => row.id.isNotEmpty)
          .toList(),
      apPayments: apPayments
          .whereType<Map<String, Object?>>()
          .map(ApPaymentSummary.fromApi)
          .toList(),
      suppliers: ((masters['suppliers'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map(InventoryPriceParty.fromApi)
          .toList(),
      products:
          InventoryCatalog.fromApi(catalog, baseUrl: catalogBaseUrl).products,
      warehouses: ((opname['warehouses'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => InventoryWarehouse((row['id'] ?? '').toString(),
              (row['code'] ?? '').toString(), (row['name'] ?? '').toString()))
          .toList(),
      arReceipts: arReceipts
          .whereType<Map<String, Object?>>()
          .map(ArReceiptSummary.fromApi)
          .toList(),
    );
  }

  final List<SettlementDocument> receivables;
  final List<SettlementDocument> payables;
  final List<HandoverSummary> handovers;
  final List<PurchaseOrderSummary> purchaseOrders;
  final List<ApPaymentSummary> apPayments;
  final List<InventoryPriceParty> suppliers;
  final List<InventoryProductDemo> products;
  final List<InventoryWarehouse> warehouses;
  final List<ArReceiptSummary> arReceipts;
}

class PurchaseOrderSummary {
  const PurchaseOrderSummary(this.id, this.number, this.status, this.date,
      this.supplierName, this.total);

  factory PurchaseOrderSummary.fromApi(Map<String, Object?> row) =>
      PurchaseOrderSummary(
        (row['id'] ?? '').toString(),
        (row['purchase_order_number'] ?? '-').toString(),
        (row['status'] ?? '-').toString(),
        (row['order_date'] ?? '-').toString(),
        (row['supplier_name'] ?? '-').toString(),
        toDouble(row['grand_total']),
      );

  final String id;
  final String number;
  final String status;
  final String date;
  final String supplierName;
  final double total;
}

class ApPaymentSummary {
  const ApPaymentSummary(this.number, this.date, this.supplierName, this.method,
      this.total, this.status);

  factory ApPaymentSummary.fromApi(Map<String, Object?> row) =>
      ApPaymentSummary(
        (row['payment_number'] ?? '-').toString(),
        (row['payment_date'] ?? '-').toString(),
        (row['supplier_name'] ?? '-').toString(),
        (row['method'] ?? '-').toString(),
        toDouble(row['total_amount']),
        (row['status'] ?? '-').toString(),
      );

  final String number;
  final String date;
  final String supplierName;
  final String method;
  final double total;
  final String status;
}

class ArReceiptSummary {
  const ArReceiptSummary(this.number, this.date, this.customerName, this.method,
      this.total, this.status);

  factory ArReceiptSummary.fromApi(Map<String, Object?> row) =>
      ArReceiptSummary(
        (row['receipt_number'] ?? '-').toString(),
        (row['receipt_date'] ?? '-').toString(),
        (row['customer_name'] ?? '-').toString(),
        (row['method'] ?? '-').toString(),
        toDouble(row['total_amount']),
        (row['status'] ?? '-').toString(),
      );

  final String number;
  final String date;
  final String customerName;
  final String method;
  final double total;
  final String status;
}

class SettlementDocument {
  const SettlementDocument({
    required this.id,
    required this.kind,
    required this.partyId,
    required this.partyName,
    required this.invoiceNumber,
    required this.amount,
    required this.agingBucket,
    this.salespersonId,
    this.salesName = '-',
    this.isSettled = false,
  });

  factory SettlementDocument.fromApi(
    Map<String, Object?> row, {
    required String kind,
  }) {
    final isPayable = kind == 'AP';
    return SettlementDocument(
      id: (row['id'] ?? '').toString(),
      kind: kind,
      partyId:
          (row[isPayable ? 'supplier_id' : 'customer_id'] ?? '').toString(),
      partyName: (row[isPayable ? 'supplier_name' : 'customer_name'] ?? '-')
          .toString(),
      invoiceNumber: (row['legacy_invoice_number'] ?? '-').toString(),
      amount: toDouble(row['amount']),
      agingBucket: (row['aging_bucket'] ?? '-').toString(),
      salespersonId: row['salesperson_id']?.toString(),
      salesName: (row['sales_name'] ?? '-').toString(),
      isSettled: row['is_settled'] == true,
    );
  }

  final String id;
  final String kind;
  final String partyId;
  final String partyName;
  final String invoiceNumber;
  final double amount;
  final String agingBucket;
  final String? salespersonId;
  final String salesName;
  final bool isSettled;
}

class HandoverSummary {
  const HandoverSummary({
    required this.id,
    required this.number,
    required this.salesperson,
    required this.invoiceCount,
    required this.amount,
    required this.status,
  });

  factory HandoverSummary.fromApi(Map<String, Object?> row) {
    return HandoverSummary(
      id: (row['id'] ?? '').toString(),
      number: (row['handover_number'] ?? '-').toString(),
      salesperson: (row['salesperson_name'] ?? '-').toString(),
      invoiceCount: toInt(row['invoice_count']),
      amount: toDouble(row['outstanding_amount']),
      status: (row['status'] ?? '-').toString(),
    );
  }

  final String id;
  final String number;
  final String salesperson;
  final int invoiceCount;
  final double amount;
  final String status;
}

class InventoryParityContract {
  const InventoryParityContract({
    required this.screens,
    required this.flutter,
    required this.items,
  });

  factory InventoryParityContract.fromApi(Map<String, Object?> data) {
    final summary = data['summary'] as Map<String, Object?>? ?? const {};
    final flutter = summary['flutter'] as Map<String, Object?>? ?? const {};
    return InventoryParityContract(
      screens: toInt(summary['screens']),
      flutter: InventoryCoverageSummary(
        operational: toInt(flutter['operational']),
        readOnly: toInt(flutter['readOnly']),
        contractOnly: toInt(flutter['contractOnly']),
      ),
      items: ((data['items'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => InventoryParityItem(
                screen: toInt(row['screen']),
                name: (row['legacyName'] ?? '-').toString(),
                flutter: (row['flutter'] ?? 'CONTRACT_ONLY').toString(),
              ))
          .toList(),
    );
  }

  final int screens;
  final InventoryCoverageSummary flutter;
  final List<InventoryParityItem> items;
}

class InventoryCoverageSummary {
  const InventoryCoverageSummary({
    required this.operational,
    required this.readOnly,
    required this.contractOnly,
  });
  final int operational;
  final int readOnly;
  final int contractOnly;
}

class InventoryParityItem {
  const InventoryParityItem({
    required this.screen,
    required this.name,
    required this.flutter,
  });
  final int screen;
  final String name;
  final String flutter;
}

class InventorySnapshot {
  const InventorySnapshot({
    required this.revenueToday,
    required this.purchasesToday,
    required this.purchasesMonth,
    required this.revenueMonth,
    required this.cogsMonth,
    required this.grossProfitMonth,
    required this.ordersMonth,
    required this.products,
    required this.customers,
    required this.availableQty,
    required this.inventoryValue,
    required this.lowStockProducts,
    required this.rawRecords,
    required this.receivableAmount,
    required this.payableAmount,
    required this.purchaseOrders,
    required this.priceRows,
    required this.topSales,
    required this.topProducts,
    required this.salesTrend,
    required this.purchaseTrend,
    required this.orders,
    required this.expiringLots,
  });

  factory InventorySnapshot.fromApi(
      Map<String, Object?> dashboard, Map<String, Object?> reconciliation) {
    final summary = dashboard['summary'] as Map<String, Object?>? ?? const {};
    final totals =
        reconciliation['totals'] as Map<String, Object?>? ?? const {};
    return InventorySnapshot(
      revenueToday: toDouble(summary['revenue_today']),
      purchasesToday: toDouble(summary['purchases_today']),
      purchasesMonth: toDouble(summary['purchases_month']),
      revenueMonth: toDouble(summary['revenue_month']),
      cogsMonth: toDouble(summary['cogs_month']),
      grossProfitMonth: toDouble(summary['gross_profit_month']),
      ordersMonth: toInt(summary['orders_month']),
      products: toInt(summary['products']),
      customers: toInt(summary['customers']),
      availableQty: toDouble(summary['available_qty']),
      inventoryValue: toDouble(summary['inventory_value']),
      lowStockProducts: toInt(summary['low_stock_products']),
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
      topProducts: ((dashboard['topProducts'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => ProductKpi(
                (row['product_code'] ?? '-').toString(),
                (row['product_name'] ?? 'Produk').toString(),
                toDouble(row['qty']),
                toDouble(row['revenue']),
              ))
          .toList(),
      salesTrend: ((dashboard['salesTrend'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => TrendKpi(
                (row['date'] ?? '').toString(),
                toDouble(row['total']),
              ))
          .toList(),
      purchaseTrend: ((dashboard['purchaseTrend'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .map((row) => TrendKpi(
                (row['date'] ?? '').toString(),
                toDouble(row['total']),
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
  final double purchasesToday;
  final double purchasesMonth;
  final double revenueMonth;
  final double cogsMonth;
  final double grossProfitMonth;
  final int ordersMonth;
  final int products;
  final int customers;
  final double availableQty;
  final double inventoryValue;
  final int lowStockProducts;
  final int rawRecords;
  final double receivableAmount;
  final double payableAmount;
  final int purchaseOrders;
  final int priceRows;
  final List<SalesKpi> topSales;
  final List<ProductKpi> topProducts;
  final List<TrendKpi> salesTrend;
  final List<TrendKpi> purchaseTrend;
  final List<OrderKpi> orders;
  final List<LotKpi> expiringLots;

  double get topSalesMax => topSales.fold<double>(
      1, (max, row) => row.revenue > max ? row.revenue : max);
  double get topProductsMax => topProducts.fold<double>(
      1, (max, row) => row.revenue > max ? row.revenue : max);
}

class SalesKpi {
  const SalesKpi(this.name, this.orders, this.revenue);
  final String name;
  final int orders;
  final double revenue;
}

class ProductKpi {
  const ProductKpi(this.code, this.name, this.quantity, this.revenue);
  final String code;
  final String name;
  final double quantity;
  final double revenue;
}

class TrendKpi {
  const TrendKpi(this.date, this.total);
  final String date;
  final double total;
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
      (
        'Pembelian hari ini',
        rupiah(snapshot.purchasesToday),
        Icons.shopping_cart_checkout_outlined
      ),
      (
        'Piutang',
        rupiah(snapshot.receivableAmount),
        Icons.receipt_long_outlined
      ),
      ('Hutang', rupiah(snapshot.payableAmount), Icons.payments_outlined),
      (
        'Nilai persediaan',
        rupiah(snapshot.inventoryValue),
        Icons.warehouse_outlined
      ),
      (
        'Stok menipis',
        '${snapshot.lowStockProducts} produk',
        Icons.warning_amber_outlined
      ),
      ('Laba kotor', rupiah(snapshot.grossProfitMonth), Icons.query_stats),
      (
        'Kas & Bank',
        rupiah(snapshot.revenueMonth - snapshot.cogsMonth),
        Icons.account_balance_outlined
      ),
    ];
    return LayoutBuilder(
      builder: (context, box) {
        final cols = box.maxWidth >= 1320
            ? 8
            : box.maxWidth >= 920
                ? 4
                : box.maxWidth >= 520
                    ? 2
                    : 1;
        return GridView.count(
          crossAxisCount: cols,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: cols >= 4
              ? 1.25
              : cols == 2
                  ? 2.2
                  : 3.15,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
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
        padding: const EdgeInsets.all(13),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                color: const Color(0xFFEAF2FF),
                borderRadius: BorderRadius.circular(7),
              ),
              child: Icon(icon, size: 19, color: const Color(0xFF1769E0)),
            ),
            const SizedBox(height: 10),
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Color(0xFF66758A), fontSize: 10)),
            const SizedBox(height: 3),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(value,
                  style: const TextStyle(
                      fontSize: 17, fontWeight: FontWeight.w900)),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard(
      {required this.title,
      required this.icon,
      required this.child,
      this.action});
  final String title;
  final IconData icon;
  final Widget child;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, size: 19, color: const Color(0xFF1769E0)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w800, fontSize: 14)),
                ),
                if (action != null) action!,
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
      required this.max,
      this.dense = false});
  final String label;
  final String note;
  final String value;
  final double current;
  final double max;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final width = max <= 0 ? 0.0 : (current / max).clamp(0.04, 1.0);
    return Padding(
      padding: EdgeInsets.symmetric(vertical: dense ? 3 : 8),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                  flex: dense ? 3 : 1,
                  child: Text(dense ? label : '$label\n$note',
                      style: TextStyle(height: dense ? 1.1 : 1.45),
                      maxLines: dense ? 1 : 2,
                      overflow: TextOverflow.ellipsis)),
              if (dense) ...[
                const SizedBox(width: 6),
                Expanded(
                  flex: 2,
                  child: Text(note,
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 10, color: Color(0xFF64748B))),
                ),
              ],
              const SizedBox(width: 8),
              if (dense)
                Expanded(
                  flex: 3,
                  child: Text(value,
                      textAlign: TextAlign.right,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                )
              else
                Text(value,
                    style: const TextStyle(fontWeight: FontWeight.w900)),
            ],
          ),
          SizedBox(height: dense ? 4 : 8),
          LinearProgressIndicator(
              value: width,
              minHeight: dense ? 5 : 8,
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

String? nullableText(Object? value) {
  final text = value?.toString().trim() ?? '';
  return text.isEmpty ? null : text;
}

int toInt(Object? value) => toDouble(value).round();

String financeLabel(String value) =>
    const {
      'ASSET': 'Aset',
      'LIABILITY': 'Kewajiban',
      'EQUITY': 'Modal',
      'REVENUE': 'Pendapatan',
      'EXPENSE': 'Biaya',
      'DEBIT': 'Debit',
      'CREDIT': 'Kredit',
      'product_code': 'Kode produk',
      'product_name': 'Nama produk',
      'order_number': 'Nomor order',
      'order_date': 'Tanggal',
      'revenue': 'Omzet',
      'cogs': 'HPP',
      'gross_profit': 'Laba kotor',
      'code': 'Kode',
      'name': 'Nama akun',
      'account_type': 'Kelompok',
      'balance': 'Saldo',
    }[value] ??
    value.replaceAll('_', ' ');
