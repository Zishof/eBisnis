import 'package:flutter/material.dart';

typedef SupplierWorkspaceLoader = Future<Map<String, Object?>> Function();
typedef SupplierManagerLauncher = void Function(BuildContext context);

class InventorySupplierWorkspacePage extends StatefulWidget {
  const InventorySupplierWorkspacePage({
    super.key,
    required this.load,
    required this.onManage,
  });

  final SupplierWorkspaceLoader load;
  final SupplierManagerLauncher onManage;

  @override
  State<InventorySupplierWorkspacePage> createState() =>
      _InventorySupplierWorkspacePageState();
}

class _InventorySupplierWorkspacePageState
    extends State<InventorySupplierWorkspacePage> {
  late Future<_SupplierWorkspaceData> _future = _load();
  final _search = TextEditingController();
  int _tab = 0;
  String? _selectedId;
  String _status = 'ALL';

  Future<_SupplierWorkspaceData> _load() async =>
      _SupplierWorkspaceData.fromMap(await widget.load());

  void _reload() => setState(() => _future = _load());

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Supplier', style: TextStyle(fontWeight: FontWeight.w800)),
            Text('Master, pembelian, hutang, dan kinerja',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: [
          IconButton(
              onPressed: _reload,
              tooltip: 'Sinkronkan',
              icon: const Icon(Icons.sync)),
          IconButton(
              onPressed: () => widget.onManage(context),
              tooltip: 'Kelola data',
              icon: const Icon(Icons.edit_outlined)),
        ],
      ),
      body: FutureBuilder<_SupplierWorkspaceData>(
        future: _future,
        builder: (context, state) {
          if (state.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (state.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.cloud_off_outlined, size: 48),
                  const SizedBox(height: 12),
                  Text(state.error.toString(), textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                      onPressed: _reload,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Coba lagi')),
                ]),
              ),
            );
          }
          final data = state.data!;
          _selectedId ??=
              data.suppliers.isEmpty ? null : data.suppliers.first.id;
          _SupplierRow? selected;
          for (final supplier in data.suppliers) {
            if (supplier.id == _selectedId) {
              selected = supplier;
              break;
            }
          }
          return LayoutBuilder(builder: (context, box) {
            final desktop = box.maxWidth >= 900;
            return Column(children: [
              _tabs(desktop),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 180),
                  child: SingleChildScrollView(
                    key: ValueKey(_tab),
                    padding: EdgeInsets.all(desktop ? 20 : 12),
                    child: switch (_tab) {
                      0 => _list(data, desktop),
                      1 => _detail(selected, desktop),
                      2 => _history(data, selected, desktop),
                      3 => _ledger(data, selected, desktop),
                      _ => _analytics(data, desktop),
                    },
                  ),
                ),
              ),
            ]);
          });
        },
      ),
    );
  }

  Widget _tabs(bool desktop) {
    const items = [
      (Icons.groups_outlined, 'Daftar'),
      (Icons.business_outlined, 'Detail'),
      (Icons.history, 'Pembelian'),
      (Icons.account_balance_wallet_outlined, 'Ledger'),
      (Icons.analytics_outlined, 'Analisis'),
    ];
    if (!desktop) {
      return NavigationBar(
        height: 68,
        selectedIndex: _tab,
        onDestinationSelected: (value) => setState(() => _tab = value),
        destinations: [
          for (final item in items)
            NavigationDestination(icon: Icon(item.$1), label: item.$2),
        ],
      );
    }
    return Container(
      decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          border: Border(
              bottom: BorderSide(color: Theme.of(context).dividerColor))),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(children: [
        for (var index = 0; index < items.length; index++)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: TextButton.icon(
              onPressed: () => setState(() => _tab = index),
              icon: Icon(items[index].$1, size: 18),
              label: Text(items[index].$2),
              style: TextButton.styleFrom(
                foregroundColor: _tab == index
                    ? Theme.of(context).colorScheme.primary
                    : Theme.of(context).colorScheme.onSurfaceVariant,
                shape: const RoundedRectangleBorder(),
                side: _tab == index
                    ? BorderSide(
                        color: Theme.of(context).colorScheme.primary,
                        width: 0,
                        strokeAlign: BorderSide.strokeAlignOutside)
                    : BorderSide.none,
              ),
            ),
          ),
        const SizedBox(height: 12),
        TextButton.icon(
            onPressed: () => widget.onManage(context),
            icon: const Icon(Icons.edit_outlined),
            label: const Text('Kelola master')),
      ]),
    );
  }

  Widget _list(_SupplierWorkspaceData data, bool desktop) {
    final query = _search.text.trim().toLowerCase();
    final rows = data.suppliers.where((row) {
      final matchesSearch = query.isEmpty ||
          [row.code, row.name, row.contact, row.phone, row.region]
              .any((value) => value.toLowerCase().contains(query));
      final matchesStatus = _status == 'ALL' ||
          (_status == 'ACTIVE' && row.active) ||
          (_status == 'INACTIVE' && !row.active) ||
          (_status == 'PAYABLE' && row.payable > 0);
      return matchesSearch && matchesStatus;
    }).toList();
    final metrics = [
      ('Total Supplier', '${data.total}', Icons.groups_outlined, Colors.blue),
      (
        'Supplier Aktif',
        '${data.active}',
        Icons.verified_outlined,
        Colors.green
      ),
      (
        'Supplier Nonaktif',
        '${data.inactive}',
        Icons.block_outlined,
        Colors.orange
      ),
      (
        'Dengan Hutang',
        '${data.withPayables}',
        Icons.receipt_long_outlined,
        Colors.red
      ),
      (
        'Pembelian Bulan Ini',
        _money(data.purchasesMonth),
        Icons.shopping_cart_outlined,
        Colors.purple
      ),
    ];
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _responsiveWrap([
        for (final metric in metrics)
          _metricCard(metric.$1, metric.$2, metric.$3, metric.$4),
      ], desktop ? 5 : 2),
      const SizedBox(height: 14),
      _panel(
        Column(children: [
          if (desktop)
            Row(children: [
              Expanded(child: _searchField()),
              const SizedBox(width: 12),
              _filterChips(),
            ])
          else ...[
            _searchField(),
            const SizedBox(height: 10),
            SingleChildScrollView(
                scrollDirection: Axis.horizontal, child: _filterChips()),
          ],
          const SizedBox(height: 12),
          if (desktop)
            _supplierTable(rows)
          else
            for (final row in rows) _supplierTile(row),
          if (rows.isEmpty)
            const Padding(
                padding: EdgeInsets.all(28),
                child: Text('Supplier tidak ditemukan.')),
        ]),
      ),
    ]);
  }

  Widget _searchField() => TextField(
        controller: _search,
        onChanged: (_) => setState(() {}),
        decoration: const InputDecoration(
          prefixIcon: Icon(Icons.search),
          hintText: 'Cari nama, kode, telepon, atau kota',
          border: OutlineInputBorder(),
          isDense: true,
        ),
      );

  Widget _filterChips() => Wrap(spacing: 7, children: [
        for (final item in const [
          ('ALL', 'Semua'),
          ('ACTIVE', 'Aktif'),
          ('INACTIVE', 'Nonaktif'),
          ('PAYABLE', 'Ada hutang')
        ])
          FilterChip(
            label: Text(item.$2),
            selected: _status == item.$1,
            onSelected: (_) => setState(() => _status = item.$1),
          ),
      ]);

  Widget _supplierTable(List<_SupplierRow> rows) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          showCheckboxColumn: false,
          columns: const [
            DataColumn(label: Text('KODE')),
            DataColumn(label: Text('NAMA SUPPLIER')),
            DataColumn(label: Text('KONTAK')),
            DataColumn(label: Text('KOTA')),
            DataColumn(label: Text('TERMIN')),
            DataColumn(label: Text('STATUS')),
            DataColumn(label: Text('HUTANG')),
            DataColumn(label: Text('PEMBELIAN YTD')),
            DataColumn(label: Text('TERAKHIR')),
          ],
          rows: [
            for (final row in rows)
              DataRow(
                onSelectChanged: (_) => _select(row, 1),
                cells: [
                  DataCell(Text(row.code,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, color: Colors.blue))),
                  DataCell(Text(row.name,
                      style: const TextStyle(fontWeight: FontWeight.w700))),
                  DataCell(Text(row.contact.isEmpty
                      ? row.phone
                      : '${row.contact}\n${row.phone}')),
                  DataCell(Text(row.region.isEmpty ? '-' : row.region)),
                  DataCell(Text('${row.paymentDays} hari')),
                  DataCell(_statusBadge(row.active ? 'Aktif' : 'Nonaktif',
                      row.active ? Colors.green : Colors.grey)),
                  DataCell(Text(_money(row.payable),
                      style: const TextStyle(
                          color: Colors.red, fontWeight: FontWeight.w700))),
                  DataCell(Text(_money(row.purchaseYtd))),
                  DataCell(Text(_date(row.lastPurchase))),
                ],
              ),
          ],
        ),
      );

  Widget _supplierTile(_SupplierRow row) => ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
        onTap: () => _select(row, 1),
        leading: CircleAvatar(child: Text(row.name.characters.first)),
        title:
            Text(row.name, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(
            '${row.code} · ${row.region.isEmpty ? 'Wilayah belum diisi' : row.region}\nHutang ${_money(row.payable)}'),
        isThreeLine: true,
        trailing: const Icon(Icons.chevron_right),
      );

  void _select(_SupplierRow row, int tab) => setState(() {
        _selectedId = row.id;
        _tab = tab;
      });

  Widget _detail(_SupplierRow? row, bool desktop) {
    if (row == null) return _empty();
    final profile = _panel(Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          CircleAvatar(
              radius: 28,
              child: Text(row.name.characters.first,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800))),
          const SizedBox(width: 14),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(row.name,
                    style: Theme.of(context)
                        .textTheme
                        .titleLarge
                        ?.copyWith(fontWeight: FontWeight.w800)),
                Text(row.code),
              ])),
          _statusBadge(row.active ? 'Aktif' : 'Nonaktif',
              row.active ? Colors.green : Colors.grey),
        ]),
        const Divider(height: 30),
        _labelValue('NPWP', row.taxNumber),
        _labelValue('Kontak', row.contact),
        _labelValue('Telepon', row.phone),
        _labelValue('Email', row.email),
        _labelValue('Wilayah', row.region),
        _labelValue('Alamat', row.address),
        _labelValue('Termin', '${row.paymentDays} hari'),
        _labelValue('Bank', row.bankName),
        _labelValue('Rekening', row.bankAccount),
      ],
    ));
    final summary = Column(children: [
      _responsiveWrap([
        _metricCard('Saldo Hutang', _money(row.payable),
            Icons.account_balance_wallet_outlined, Colors.red),
        _metricCard('Pembelian YTD', _money(row.purchaseYtd),
            Icons.shopping_cart_outlined, Colors.blue),
        _metricCard('Pembayaran YTD', _money(row.paymentYtd),
            Icons.payments_outlined, Colors.green),
        _metricCard('Dokumen Terbuka', '${row.payableDocuments}',
            Icons.description_outlined, Colors.orange),
      ], desktop ? 2 : 2),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Kesehatan relasi',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 14),
        _labelValue('Pembelian terakhir', _date(row.lastPurchase)),
        _labelValue('Jumlah pembelian', '${row.purchaseCount} transaksi'),
        _labelValue('Lead time', '${row.leadTime} hari'),
        _labelValue(
            'Rating',
            row.rating > 0
                ? '${row.rating.toStringAsFixed(1)} / 5'
                : 'Belum dinilai'),
        const SizedBox(height: 8),
        FilledButton.icon(
            onPressed: () => setState(() => _tab = 2),
            icon: const Icon(Icons.history),
            label: const Text('Riwayat pembelian')),
      ])),
    ]);
    if (!desktop) {
      return Column(children: [profile, const SizedBox(height: 14), summary]);
    }
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Expanded(flex: 2, child: profile),
      const SizedBox(width: 16),
      Expanded(flex: 3, child: summary),
    ]);
  }

  Widget _history(
      _SupplierWorkspaceData data, _SupplierRow? row, bool desktop) {
    if (row == null) return _empty();
    final purchases =
        data.purchases.where((item) => item.supplierId == row.id).toList();
    final products = data.products
        .where((item) => item.supplierId == row.id)
        .take(8)
        .toList();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _supplierStrip(row, desktop),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Daftar transaksi pembelian',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _records(
          desktop,
          headers: const [
            'Tanggal',
            'No. Pembelian',
            'Gudang',
            'Grand Total',
            'Status'
          ],
          rows: [
            for (final item in purchases)
              [
                _date(item.date),
                item.number,
                item.warehouse,
                _money(item.total),
                item.status
              ]
          ],
        ),
      ])),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Produk yang sering dibeli',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        _responsiveWrap([
          for (final item in products)
            ListTile(
              dense: true,
              leading: const Icon(Icons.inventory_2_outlined),
              title:
                  Text(item.name, maxLines: 1, overflow: TextOverflow.ellipsis),
              subtitle: Text(
                  '${item.qty.toStringAsFixed(0)} ${item.uom} · ${_money(item.totalValue)}'),
            ),
        ], desktop ? 4 : 1),
      ])),
    ]);
  }

  Widget _ledger(_SupplierWorkspaceData data, _SupplierRow? row, bool desktop) {
    if (row == null) return _empty();
    final debts =
        data.payables.where((item) => item.supplierId == row.id).toList();
    final payments =
        data.payments.where((item) => item.supplierId == row.id).toList();
    double bucket(String name) => debts
        .where((item) => item.bucket == name)
        .fold(0, (sum, item) => sum + item.outstanding);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _supplierStrip(row, desktop),
      const SizedBox(height: 14),
      _responsiveWrap([
        for (final name in const [
          'BELUM JATUH TEMPO',
          '1-30 HARI',
          '31-60 HARI',
          '> 60 HARI'
        ])
          _metricCard(name, _money(bucket(name)), Icons.calendar_month_outlined,
              Colors.orange),
      ], desktop ? 4 : 2),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Ledger hutang',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _records(desktop, headers: const [
          'Tanggal',
          'Referensi',
          'Jatuh Tempo',
          'Nilai',
          'Sisa Hutang',
          'Aging'
        ], rows: [
          for (final item in debts)
            [
              _date(item.date),
              item.invoice,
              _date(item.dueDate),
              _money(item.original),
              _money(item.outstanding),
              item.bucket
            ]
        ]),
      ])),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Riwayat pembayaran',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _records(desktop, headers: const [
          'Tanggal',
          'Nomor',
          'Metode',
          'Jumlah',
          'Status'
        ], rows: [
          for (final item in payments)
            [
              _date(item.date),
              item.number,
              item.method,
              _money(item.total),
              item.status
            ]
        ]),
      ])),
    ]);
  }

  Widget _analytics(_SupplierWorkspaceData data, bool desktop) {
    final rows = [...data.suppliers]
      ..sort((a, b) => b.purchaseYtd.compareTo(a.purchaseYtd));
    final maxValue = rows.isEmpty || rows.first.purchaseYtd < 1
        ? 1.0
        : rows.first.purchaseYtd;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _responsiveWrap([
        _metricCard('Supplier Aktif', '${data.active}', Icons.groups_outlined,
            Colors.blue),
        _metricCard('Pembelian Bulan Ini', _money(data.purchasesMonth),
            Icons.shopping_cart_outlined, Colors.purple),
        _metricCard('Pembayaran Bulan Ini', _money(data.paymentsMonth),
            Icons.payments_outlined, Colors.green),
        _metricCard('Outstanding Hutang', _money(data.outstanding),
            Icons.warning_amber_outlined, Colors.red),
      ], desktop ? 4 : 2),
      const SizedBox(height: 14),
      _panel(Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Peringkat supplier berdasarkan pembelian YTD',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        for (var index = 0; index < rows.take(12).length; index++)
          InkWell(
            onTap: () => _select(rows[index], 1),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 9),
              child: Row(children: [
                SizedBox(width: 28, child: Text('${index + 1}')),
                Expanded(
                    flex: 2,
                    child: Text(rows[index].name,
                        maxLines: 1, overflow: TextOverflow.ellipsis)),
                Expanded(
                  flex: 3,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: LinearProgressIndicator(
                        value: rows[index].purchaseYtd / maxValue,
                        minHeight: 7,
                        borderRadius: BorderRadius.circular(4)),
                  ),
                ),
                Text(_money(rows[index].purchaseYtd),
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ]),
            ),
          ),
      ])),
    ]);
  }

  Widget _records(bool desktop,
      {required List<String> headers, required List<List<String>> rows}) {
    if (rows.isEmpty) {
      return const Padding(
          padding: EdgeInsets.all(24),
          child: Center(child: Text('Belum ada data.')));
    }
    if (!desktop) {
      return Column(children: [
        for (final row in rows)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
                border: Border(
                    bottom: BorderSide(color: Theme.of(context).dividerColor))),
            child: Column(children: [
              for (var index = 0; index < headers.length; index++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                            width: 112,
                            child: Text(headers[index],
                                style: const TextStyle(
                                    fontSize: 12, color: Colors.grey))),
                        Expanded(
                            child: Text(row[index],
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600))),
                      ]),
                ),
            ]),
          ),
      ]);
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        columns: [
          for (final header in headers) DataColumn(label: Text(header))
        ],
        rows: [
          for (final row in rows)
            DataRow(cells: [for (final value in row) DataCell(Text(value))]),
        ],
      ),
    );
  }

  Widget _supplierStrip(_SupplierRow row, bool desktop) => _panel(
        desktop
            ? Row(children: [
                Expanded(child: _supplierIdentity(row)),
                _stripMetric('Saldo hutang', _money(row.payable)),
                _stripMetric('Pembelian YTD', _money(row.purchaseYtd)),
                _stripMetric('Terakhir', _date(row.lastPurchase)),
              ])
            : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _supplierIdentity(row),
                const Divider(height: 24),
                _labelValue('Saldo hutang', _money(row.payable)),
                _labelValue('Pembelian YTD', _money(row.purchaseYtd)),
                _labelValue('Terakhir', _date(row.lastPurchase)),
              ]),
      );

  Widget _supplierIdentity(_SupplierRow row) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(row.code,
              style: TextStyle(
                  color: Theme.of(context).colorScheme.primary,
                  fontWeight: FontWeight.w700)),
          Text(row.name,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          Text(
              '${row.region.isEmpty ? '-' : row.region} · ${row.paymentDays} hari'),
        ],
      );

  Widget _stripMetric(String label, String value) => SizedBox(
        width: 190,
        child: _labelValue(label, value),
      );

  Widget _metricCard(String label, String value, IconData icon, Color color) {
    return Container(
      constraints: const BoxConstraints(minHeight: 116),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Theme.of(context).dividerColor),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(icon, color: color, size: 21),
          const SizedBox(width: 8),
          Expanded(
              child: Text(label,
                  style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w700))),
        ]),
        const SizedBox(height: 12),
        Text(value,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Widget _responsiveWrap(List<Widget> children, int columns) {
    return LayoutBuilder(builder: (context, box) {
      final gap = 12.0;
      final width = (box.maxWidth - gap * (columns - 1)) / columns;
      return Wrap(
        spacing: gap,
        runSpacing: gap,
        children: [
          for (final child in children) SizedBox(width: width, child: child)
        ],
      );
    });
  }

  Widget _panel(Widget child) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surface,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Theme.of(context).dividerColor),
        ),
        child: child,
      );

  Widget _labelValue(String label, Object? value) => Padding(
        padding: const EdgeInsets.only(bottom: 11),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
              width: 126,
              child: Text(label,
                  style: const TextStyle(fontSize: 12, color: Colors.grey))),
          Expanded(
              child: Text(
                  value == null || value.toString().isEmpty
                      ? '-'
                      : value.toString(),
                  style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );

  Widget _statusBadge(String label, Color color) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
        decoration: BoxDecoration(
            color: color.withValues(alpha: .1),
            borderRadius: BorderRadius.circular(6)),
        child: Text(label,
            style: TextStyle(
                color: color, fontSize: 12, fontWeight: FontWeight.w800)),
      );

  Widget _empty() => const Padding(
        padding: EdgeInsets.symmetric(vertical: 64),
        child: Center(child: Text('Pilih supplier dari tab Daftar.')),
      );
}

class _SupplierWorkspaceData {
  _SupplierWorkspaceData({
    required this.total,
    required this.active,
    required this.inactive,
    required this.withPayables,
    required this.outstanding,
    required this.purchasesMonth,
    required this.paymentsMonth,
    required this.suppliers,
    required this.purchases,
    required this.payables,
    required this.payments,
    required this.products,
  });

  factory _SupplierWorkspaceData.fromMap(Map<String, Object?> value) {
    final summary = _map(value['summary']);
    return _SupplierWorkspaceData(
      total: _integer(summary['total']),
      active: _integer(summary['active']),
      inactive: _integer(summary['inactive']),
      withPayables: _integer(summary['withPayables']),
      outstanding: _number(summary['outstanding']),
      purchasesMonth: _number(summary['purchasesMonth']),
      paymentsMonth: _number(summary['paymentsMonth']),
      suppliers: _list(value['suppliers']).map(_SupplierRow.fromMap).toList(),
      purchases: _list(value['purchases']).map(_PurchaseRow.fromMap).toList(),
      payables: _list(value['payables']).map(_PayableRow.fromMap).toList(),
      payments: _list(value['payments']).map(_PaymentRow.fromMap).toList(),
      products: _list(value['topProducts']).map(_ProductRow.fromMap).toList(),
    );
  }

  final int total;
  final int active;
  final int inactive;
  final int withPayables;
  final double outstanding;
  final double purchasesMonth;
  final double paymentsMonth;
  final List<_SupplierRow> suppliers;
  final List<_PurchaseRow> purchases;
  final List<_PayableRow> payables;
  final List<_PaymentRow> payments;
  final List<_ProductRow> products;
}

class _SupplierRow {
  _SupplierRow(this.value);
  factory _SupplierRow.fromMap(Map<String, Object?> value) =>
      _SupplierRow(value);
  final Map<String, Object?> value;
  String get id => '${value['id'] ?? ''}';
  String get code => '${value['code'] ?? ''}';
  String get name => '${value['name'] ?? ''}';
  String get taxNumber => '${value['tax_number'] ?? ''}';
  String get contact => '${value['contact_person'] ?? ''}';
  String get phone => '${value['phone'] ?? ''}';
  String get email => '${value['email'] ?? ''}';
  String get address => '${value['address_text'] ?? ''}';
  String get region => '${value['region_name'] ?? ''}';
  String get bankName => '${value['bank_name'] ?? ''}';
  String get bankAccount => '${value['bank_account_number'] ?? ''}';
  bool get active => value['is_active'] != false;
  int get paymentDays => _integer(value['legacy_payment_days']);
  int get leadTime => _integer(value['lead_time_days']);
  int get payableDocuments => _integer(value['payable_document_count']);
  int get purchaseCount => _integer(value['purchase_count']);
  double get payable => _number(value['payable_balance']);
  double get purchaseYtd => _number(value['purchase_ytd']);
  double get paymentYtd => _number(value['payment_ytd']);
  double get rating => _number(value['rating']);
  String get lastPurchase => '${value['last_purchase'] ?? ''}';
}

class _PurchaseRow {
  _PurchaseRow(this.value);
  factory _PurchaseRow.fromMap(Map<String, Object?> value) =>
      _PurchaseRow(value);
  final Map<String, Object?> value;
  String get supplierId => '${value['supplier_id'] ?? ''}';
  String get number => '${value['purchase_order_number'] ?? ''}';
  String get date => '${value['order_date'] ?? ''}';
  String get warehouse => '${value['warehouse_name'] ?? ''}';
  String get status => '${value['status'] ?? ''}';
  double get total => _number(value['grand_total']);
}

class _PayableRow {
  _PayableRow(this.value);
  factory _PayableRow.fromMap(Map<String, Object?> value) => _PayableRow(value);
  final Map<String, Object?> value;
  String get supplierId => '${value['supplier_id'] ?? ''}';
  String get invoice => '${value['legacy_invoice_number'] ?? ''}';
  String get date => '${value['transaction_date'] ?? ''}';
  String get dueDate => '${value['due_date'] ?? ''}';
  String get bucket => '${value['aging_bucket'] ?? ''}';
  double get original => _number(value['original_amount']);
  double get outstanding => _number(value['outstanding_amount']);
}

class _PaymentRow {
  _PaymentRow(this.value);
  factory _PaymentRow.fromMap(Map<String, Object?> value) => _PaymentRow(value);
  final Map<String, Object?> value;
  String get supplierId => '${value['supplier_id'] ?? ''}';
  String get number => '${value['payment_number'] ?? ''}';
  String get date => '${value['payment_date'] ?? ''}';
  String get method => '${value['method'] ?? ''}';
  String get status => '${value['status'] ?? ''}';
  double get total => _number(value['total_amount']);
}

class _ProductRow {
  _ProductRow(this.raw);
  factory _ProductRow.fromMap(Map<String, Object?> value) => _ProductRow(value);
  final Map<String, Object?> raw;
  String get supplierId => '${raw['supplier_id'] ?? ''}';
  String get name => '${raw['product_name'] ?? ''}';
  String get uom => '${raw['uom'] ?? ''}';
  double get qty => _number(raw['total_qty']);
  double get totalValue => _number(raw['total_value']);
}

Map<String, Object?> _map(Object? value) =>
    value is Map<String, Object?> ? value : <String, Object?>{};
List<Map<String, Object?>> _list(Object? value) =>
    value is List ? value.whereType<Map<String, Object?>>().toList() : const [];
double _number(Object? value) => double.tryParse('$value') ?? 0;
int _integer(Object? value) => int.tryParse('$value') ?? 0;
String _money(Object? value) =>
    'Rp ${_number(value).round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}';
String _date(Object? value) {
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '-';
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des'
  ];
  return '${parsed.day.toString().padLeft(2, '0')} ${months[parsed.month - 1]} ${parsed.year}';
}
