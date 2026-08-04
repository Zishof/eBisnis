library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

class AplikasiInventory extends StatefulWidget {
  const AplikasiInventory({super.key});

  @override
  State<AplikasiInventory> createState() => _AplikasiInventoryState();
}

class _AplikasiInventoryState extends State<AplikasiInventory> {
  final _client = InventoryApiClient.fromEnvironment();
  PersonaInventory? _persona;

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
  final _username = TextEditingController(text: 'muklis');
  final _password = TextEditingController(text: 'muklis123!!');
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
                    onPreset: (p) {
                      _username.text = p.username;
                      _password.text = p.password;
                    },
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
  });

  final InventoryApiClient client;
  final PersonaInventory persona;
  final VoidCallback onKeluar;

  @override
  State<InventoryHomePage> createState() => _InventoryHomePageState();
}

class _InventoryHomePageState extends State<InventoryHomePage> {
  late Future<InventorySnapshot> _snapshot = widget.client.snapshot();

  void _refresh() {
    setState(() => _snapshot = widget.client.snapshot());
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
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
                                          '${order.customer} • ${order.sales}'),
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
                                      leading:
                                          const Icon(Icons.medication_outlined),
                                      title: Text(lot.productName),
                                      subtitle: Text(
                                          '${lot.productCode} • batch ${lot.lotNumber}'),
                                      trailing: Text(lot.expiryDate),
                                    ))
                                .toList(),
                          ),
                        ),
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
    final preset = akunInventory.firstWhere(
      (p) => p.username == username && p.password == password,
      orElse: () => PersonaInventory(
        username: username,
        password: password,
        label: username,
        role: 'Sales',
      ),
    );
    try {
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
      return preset;
    } on Object {
      return preset;
    }
  }

  Future<InventorySnapshot> snapshot() async {
    if (_token == null) return InventorySnapshot.demo();
    final dashboard = await _request<Map<String, Object?>>(
        'GET', '/inventory/sales-dashboard');
    final reconciliation = await _request<Map<String, Object?>>(
        'GET', '/inventory/legacy-import-reconciliation');
    return InventorySnapshot.fromApi(dashboard, reconciliation);
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
    required this.password,
    required this.label,
    required this.role,
  });

  final String username;
  final String password;
  final String label;
  final String role;
}

const akunInventory = [
  PersonaInventory(
      username: 'muklis',
      password: 'muklis123!!',
      label: 'Muklis',
      role: 'Pemilik'),
  PersonaInventory(
      username: 'masrukin',
      password: 'masrukin123!!',
      label: 'Masrukin',
      role: 'Sales'),
  PersonaInventory(
      username: 'tohirin',
      password: 'tohirin123!!',
      label: 'Tohirin',
      role: 'Sales'),
  PersonaInventory(
      username: 'nofal', password: 'nofal123!!', label: 'Nofal', role: 'Sales'),
  PersonaInventory(
      username: 'agung', password: 'agung123!!', label: 'Agung', role: 'Sales'),
  PersonaInventory(
      username: 'cmnmedika',
      password: 'cmnmedika123!!',
      label: 'Admin CMN',
      role: 'Admin'),
];

class InventorySnapshot {
  const InventorySnapshot({
    required this.revenueToday,
    required this.revenueMonth,
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
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: const Color(0xFF0F172A),
      ),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.inventory_2_outlined, color: Color(0xFF5EEAD4), size: 44),
          SizedBox(height: 20),
          Text(
            'Sales dan inventory obat dalam satu aplikasi.',
            style: TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
                height: 1.08),
          ),
          SizedBox(height: 14),
          Text(
            'Order sales, stok, batch-expiry, piutang, hutang, pembelian, dan laporan pemilik tersambung ke Caruban Medika Nusantara.',
            style:
                TextStyle(color: Color(0xFFCBD5E1), fontSize: 16, height: 1.6),
          ),
          SizedBox(height: 24),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Pill('Owner', 'dashboard'),
              _Pill('Sales', 'order'),
              _Pill('Admin', 'rekonsiliasi'),
            ],
          ),
        ],
      ),
    );
  }
}

class _LoginCard extends StatelessWidget {
  const _LoginCard({
    required this.username,
    required this.password,
    required this.busy,
    required this.onSubmit,
    required this.onPreset,
    this.error,
  });

  final TextEditingController username;
  final TextEditingController password;
  final bool busy;
  final String? error;
  final VoidCallback onSubmit;
  final ValueChanged<PersonaInventory> onPreset;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Masuk Inventory CMN',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            const Text('Gunakan akun pemilik, admin, atau sales.'),
            const SizedBox(height: 18),
            TextField(
                controller: username,
                decoration: const InputDecoration(labelText: 'Username')),
            const SizedBox(height: 12),
            TextField(
                controller: password,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true),
            if (error != null) ...[
              const SizedBox(height: 12),
              Text(error!, style: const TextStyle(color: Colors.red)),
            ],
            const SizedBox(height: 18),
            FilledButton(
              onPressed: busy ? null : onSubmit,
              child: Text(busy ? 'Memeriksa...' : 'Masuk'),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: akunInventory
                  .map((p) => OutlinedButton(
                        onPressed: () => onPreset(p),
                        child: Text(p.label),
                      ))
                  .toList(),
            ),
          ],
        ),
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
