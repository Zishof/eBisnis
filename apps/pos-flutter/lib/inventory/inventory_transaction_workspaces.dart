import 'package:flutter/material.dart';

class TransactionParty {
  const TransactionParty({
    required this.id,
    required this.code,
    required this.name,
    this.subtitle = '',
    this.balance = 0,
    this.creditLimit = 0,
  });

  final String id;
  final String code;
  final String name;
  final String subtitle;
  final double balance;
  final double creditLimit;
}

class TransactionProduct {
  const TransactionProduct({
    required this.id,
    required this.uomId,
    required this.code,
    required this.name,
    required this.price,
    required this.stock,
    this.uom = 'PCS',
    this.imageUrl = '',
  });

  final String id;
  final String uomId;
  final String code;
  final String name;
  final double price;
  final int stock;
  final String uom;
  final String imageUrl;
}

class TransactionLineDraft {
  const TransactionLineDraft({
    required this.product,
    required this.quantity,
    this.discountPercent = 0,
    this.batchNumber = '',
    this.expiryDate = '',
  });

  final TransactionProduct product;
  final double quantity;
  final double discountPercent;
  final String batchNumber;
  final String expiryDate;

  double get gross => product.price * quantity;
  double get discount => gross * discountPercent / 100;
  double get net => gross - discount;

  TransactionLineDraft copyWith({
    double? quantity,
    double? discountPercent,
    String? batchNumber,
    String? expiryDate,
  }) =>
      TransactionLineDraft(
        product: product,
        quantity: quantity ?? this.quantity,
        discountPercent: discountPercent ?? this.discountPercent,
        batchNumber: batchNumber ?? this.batchNumber,
        expiryDate: expiryDate ?? this.expiryDate,
      );
}

class SalesOrderWorkspaceSubmission {
  const SalesOrderWorkspaceSubmission({
    required this.customerId,
    required this.lines,
    required this.taxPercent,
    required this.paymentTerm,
    required this.note,
  });

  final String customerId;
  final List<TransactionLineDraft> lines;
  final double taxPercent;
  final String paymentTerm;
  final String note;
}

class PurchaseWorkspaceSubmission {
  const PurchaseWorkspaceSubmission({
    required this.supplierId,
    required this.warehouseId,
    required this.expectedDate,
    required this.note,
    required this.lines,
  });

  final String supplierId;
  final String warehouseId;
  final String expectedDate;
  final String note;
  final List<TransactionLineDraft> lines;
}

typedef SalesOrderWorkspaceSubmit = Future<String> Function(
    SalesOrderWorkspaceSubmission submission);
typedef PurchaseWorkspaceSubmit = Future<String> Function(
    PurchaseWorkspaceSubmission submission);

class InventorySalesOrderWorkspace extends StatefulWidget {
  const InventorySalesOrderWorkspace({
    super.key,
    required this.salesName,
    required this.customers,
    required this.products,
    required this.onSubmit,
    this.onSaveDraft,
  });

  final String salesName;
  final List<TransactionParty> customers;
  final List<TransactionProduct> products;
  final SalesOrderWorkspaceSubmit onSubmit;
  final Future<void> Function(SalesOrderWorkspaceSubmission submission)?
      onSaveDraft;

  @override
  State<InventorySalesOrderWorkspace> createState() =>
      _InventorySalesOrderWorkspaceState();
}

class _InventorySalesOrderWorkspaceState
    extends State<InventorySalesOrderWorkspace> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  final Map<String, TransactionLineDraft> _lines = {};
  String? _customerId;
  String _paymentTerm = 'Tunai';
  double _taxPercent = 11;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _customerId = widget.customers.isEmpty ? null : widget.customers.first.id;
  }

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  TransactionParty? get _customer {
    for (final customer in widget.customers) {
      if (customer.id == _customerId) return customer;
    }
    return null;
  }

  List<TransactionProduct> get _filteredProducts {
    final query = _search.text.trim().toLowerCase();
    if (query.isEmpty) return widget.products.take(80).toList();
    return widget.products
        .where((product) =>
            product.name.toLowerCase().contains(query) ||
            product.code.toLowerCase().contains(query))
        .take(80)
        .toList();
  }

  double get _subtotal =>
      _lines.values.fold(0, (sum, line) => sum + line.net);
  double get _tax => _subtotal * _taxPercent / 100;
  double get _total => _subtotal + _tax;

  void _add(TransactionProduct product) {
    final existing = _lines[product.id];
    setState(() {
      _lines[product.id] = existing == null
          ? TransactionLineDraft(product: product, quantity: 1)
          : existing.copyWith(quantity: existing.quantity + 1);
      _message = null;
    });
  }

  void _updateQuantity(String productId, double quantity) {
    setState(() {
      final existing = _lines[productId];
      if (existing == null) return;
      if (quantity <= 0) {
        _lines.remove(productId);
      } else {
        _lines[productId] = existing.copyWith(quantity: quantity);
      }
      _message = null;
    });
  }

  SalesOrderWorkspaceSubmission? _submission() {
    if (_customerId == null || _lines.isEmpty) return null;
    return SalesOrderWorkspaceSubmission(
      customerId: _customerId!,
      lines: _lines.values.toList(growable: false),
      taxPercent: _taxPercent,
      paymentTerm: _paymentTerm,
      note: _note.text.trim(),
    );
  }

  Future<void> _save({required bool draft}) async {
    final submission = _submission();
    if (submission == null) {
      setState(() => _message = 'Pilih customer dan minimal satu barang.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      if (draft) {
        await widget.onSaveDraft?.call(submission);
        if (mounted) setState(() => _message = 'Draft order tersimpan di perangkat.');
      } else {
        final number = await widget.onSubmit(submission);
        if (!mounted) return;
        setState(() {
          _message = 'Order $number berhasil dikirim.';
          _lines.clear();
        });
      }
    } on Object catch (error) {
      if (mounted) setState(() => _message = 'Order belum tersimpan: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final desktop = box.maxWidth >= 1180;
      final tablet = box.maxWidth >= 720;
      final main = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _WorkspaceHeader(
            title: 'Sales Order',
            subtitle: 'Buat order lapangan dengan cepat dan mudah',
            primaryLabel: 'Kirim Order',
            primaryIcon: Icons.send_outlined,
            busy: _busy,
            onPrimary: () => _save(draft: false),
            onDraft: () => _save(draft: true),
          ),
          const SizedBox(height: 12),
          const _WorkflowSteps(labels: [
            'Pilih Customer',
            'Cari Barang',
            'Tambahkan ke Keranjang',
            'Review & Kirim Order',
          ]),
          const SizedBox(height: 12),
          _customerPanel(tablet),
          const SizedBox(height: 12),
          if (tablet)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _catalogPanel()),
                const SizedBox(width: 12),
                Expanded(child: _cartPanel()),
              ],
            )
          else ...[
            _catalogPanel(),
            const SizedBox(height: 12),
            _cartPanel(),
          ],
          if (_message != null) ...[
            const SizedBox(height: 12),
            _WorkspaceMessage(message: _message!),
          ],
        ],
      );
      if (!desktop) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [main, const SizedBox(height: 12), _summaryPanel()],
        );
      }
      return Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 4, child: main),
          const SizedBox(width: 14),
          SizedBox(width: 300, child: _summaryPanel()),
        ],
      );
    });
  }

  Widget _customerPanel(bool wide) {
    final customer = _customer;
    return _WorkspaceCard(
      title: 'Pilih Customer',
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            value: _customerId,
            isExpanded: true,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: 'Cari nama customer, kode, atau telepon',
            ),
            items: widget.customers
                .map((row) => DropdownMenuItem(
                    value: row.id, child: Text('${row.code} - ${row.name}')))
                .toList(),
            onChanged: (value) => setState(() => _customerId = value),
          ),
          if (customer != null) ...[
            const SizedBox(height: 12),
            if (wide)
              Row(children: [
                Expanded(flex: 2, child: _partyIdentity(customer)),
                const SizedBox(width: 10),
                Expanded(child: _MetricMini('Limit Kredit', _money(customer.creditLimit))),
                const SizedBox(width: 10),
                Expanded(child: _MetricMini('Saldo Piutang', _money(customer.balance), warning: true)),
                const SizedBox(width: 10),
                Expanded(child: _MetricMini('Sales', widget.salesName)),
              ])
            else ...[
              _partyIdentity(customer),
              const SizedBox(height: 10),
              Row(children: [
                Expanded(child: _MetricMini('Limit Kredit', _money(customer.creditLimit))),
                const SizedBox(width: 8),
                Expanded(child: _MetricMini('Saldo Piutang', _money(customer.balance), warning: true)),
              ]),
            ],
          ],
        ],
      ),
    );
  }

  Widget _partyIdentity(TransactionParty party) => Container(
        padding: const EdgeInsets.all(12),
        decoration: _softDecoration(),
        child: Row(children: [
          CircleAvatar(child: Text(_initials(party.name))),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(party.name,
                    style: const TextStyle(fontWeight: FontWeight.w800)),
                Text('${party.code}${party.subtitle.isEmpty ? '' : '  •  ${party.subtitle}'}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
              ],
            ),
          ),
          const Icon(Icons.check_circle, color: Color(0xFF16A34A), size: 18),
        ]),
      );

  Widget _catalogPanel() => _WorkspaceCard(
        title: 'Cari Barang',
        trailing: OutlinedButton.icon(
          onPressed: () {},
          icon: const Icon(Icons.qr_code_scanner, size: 18),
          label: const Text('Scan Barcode'),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              controller: _search,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search),
                labelText: 'Cari barang / SKU / barcode',
              ),
            ),
            const SizedBox(height: 10),
            Wrap(spacing: 7, runSpacing: 7, children: const [
              _FilterChipLabel('Semua', selected: true),
              _FilterChipLabel('Favorit'),
              _FilterChipLabel('Stok Tersedia'),
              _FilterChipLabel('Promo'),
              _FilterChipLabel('Sering Dibeli'),
            ]),
            const SizedBox(height: 12),
            ..._filteredProducts.take(8).map((product) =>
                _ProductSearchRow(product: product, onAdd: () => _add(product))),
          ],
        ),
      );

  Widget _cartPanel() => _WorkspaceCard(
        title: 'Item Order (${_lines.length})',
        trailing: TextButton.icon(
          onPressed: _lines.isEmpty ? null : () => setState(_lines.clear),
          icon: const Icon(Icons.delete_outline, size: 17),
          label: const Text('Bersihkan'),
        ),
        child: _lines.isEmpty
            ? const _EmptyWorkspace(
                icon: Icons.shopping_cart_outlined,
                message: 'Tambahkan barang dari katalog untuk mulai membuat order.')
            : Column(
                children: _lines.values
                    .map((line) => _EditableLine(
                          line: line,
                          purchase: false,
                          onQuantity: (value) =>
                              _updateQuantity(line.product.id, value),
                          onRemove: () => _updateQuantity(line.product.id, 0),
                        ))
                    .toList(),
              ),
      );

  Widget _summaryPanel() => _WorkspaceCard(
        title: 'Ringkasan Order',
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _SummaryRow('Customer', _customer?.name ?? '-'),
            _SummaryRow('Total Item', '${_lines.length} item'),
            _SummaryRow('Subtotal', _money(_subtotal)),
            const SizedBox(height: 6),
            DropdownButtonFormField<double>(
              value: _taxPercent,
              decoration: const InputDecoration(labelText: 'Pajak'),
              items: const [
                DropdownMenuItem(value: 0, child: Text('Tanpa pajak')),
                DropdownMenuItem(value: 11, child: Text('PPN 11%')),
              ],
              onChanged: (value) => setState(() => _taxPercent = value ?? 0),
            ),
            _SummaryRow('Pajak', _money(_tax)),
            const Divider(height: 24),
            _SummaryRow('Total Order', _money(_total), strong: true),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: _paymentTerm,
              decoration: const InputDecoration(labelText: 'Termin pembayaran'),
              items: const ['Tunai', '7 Hari', '14 Hari', '30 Hari']
                  .map((value) => DropdownMenuItem(value: value, child: Text(value)))
                  .toList(),
              onChanged: (value) => setState(() => _paymentTerm = value ?? 'Tunai'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _note,
              maxLines: 3,
              decoration: const InputDecoration(labelText: 'Catatan order'),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _busy ? null : () => _save(draft: false),
              icon: const Icon(Icons.send_outlined),
              label: Text(_busy ? 'Memproses...' : 'Kirim Order'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              onPressed: _busy ? null : () => _save(draft: true),
              icon: const Icon(Icons.save_outlined),
              label: const Text('Simpan Draft'),
            ),
          ],
        ),
      );
}

class InventoryPurchaseWorkspace extends StatefulWidget {
  const InventoryPurchaseWorkspace({
    super.key,
    required this.suppliers,
    required this.warehouses,
    required this.products,
    required this.onSubmit,
  });

  final List<TransactionParty> suppliers;
  final List<TransactionParty> warehouses;
  final List<TransactionProduct> products;
  final PurchaseWorkspaceSubmit onSubmit;

  @override
  State<InventoryPurchaseWorkspace> createState() =>
      _InventoryPurchaseWorkspaceState();
}

class _InventoryPurchaseWorkspaceState extends State<InventoryPurchaseWorkspace> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  final Map<String, TransactionLineDraft> _lines = {};
  String? _supplierId;
  String? _warehouseId;
  String _expectedDate = DateTime.now()
      .add(const Duration(days: 14))
      .toIso8601String()
      .substring(0, 10);
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _supplierId = widget.suppliers.isEmpty ? null : widget.suppliers.first.id;
    _warehouseId = widget.warehouses.isEmpty ? null : widget.warehouses.first.id;
  }

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  TransactionParty? get _supplier {
    for (final row in widget.suppliers) {
      if (row.id == _supplierId) return row;
    }
    return null;
  }

  List<TransactionProduct> get _filteredProducts {
    final query = _search.text.trim().toLowerCase();
    return widget.products
        .where((row) => query.isEmpty || row.name.toLowerCase().contains(query) || row.code.toLowerCase().contains(query))
        .take(80)
        .toList();
  }

  double get _subtotal => _lines.values.fold(0, (sum, row) => sum + row.net);
  double get _tax => _subtotal * .11;
  double get _total => _subtotal + _tax;

  void _add(TransactionProduct product) {
    final current = _lines[product.id];
    setState(() {
      _lines[product.id] = current == null
          ? TransactionLineDraft(product: product, quantity: 1)
          : current.copyWith(quantity: current.quantity + 1);
    });
  }

  Future<void> _submit() async {
    if (_supplierId == null || _warehouseId == null || _lines.isEmpty) {
      setState(() => _message = 'Supplier, gudang, dan minimal satu barang wajib dipilih.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final number = await widget.onSubmit(PurchaseWorkspaceSubmission(
        supplierId: _supplierId!,
        warehouseId: _warehouseId!,
        expectedDate: _expectedDate,
        note: _note.text.trim(),
        lines: _lines.values.toList(growable: false),
      ));
      if (!mounted) return;
      setState(() {
        _message = 'Pembelian $number berhasil disimpan sebagai draft.';
        _lines.clear();
      });
    } on Object catch (error) {
      if (mounted) setState(() => _message = 'Pembelian belum tersimpan: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, box) {
      final desktop = box.maxWidth >= 1180;
      final main = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _WorkspaceHeader(
            title: 'Transaksi Pembelian',
            subtitle: 'Input pembelian dari supplier dengan cepat dan akurat',
            primaryLabel: 'Posting Pembelian',
            primaryIcon: Icons.send_outlined,
            busy: _busy,
            onPrimary: _submit,
            onDraft: _submit,
          ),
          const SizedBox(height: 12),
          const _WorkflowSteps(labels: [
            'Pilih Supplier',
            'Cari / Tambah Barang',
            'Review Pembelian',
            'Simpan / Posting',
          ]),
          const SizedBox(height: 12),
          _supplierPanel(),
          const SizedBox(height: 12),
          _purchaseDetails(),
          const SizedBox(height: 12),
          _purchaseItems(),
          if (_message != null) ...[
            const SizedBox(height: 12),
            _WorkspaceMessage(message: _message!),
          ],
        ],
      );
      if (!desktop) return Column(children: [main, const SizedBox(height: 12), _purchaseSummary()]);
      return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Expanded(child: main),
        const SizedBox(width: 14),
        SizedBox(width: 300, child: _purchaseSummary()),
      ]);
    });
  }

  Widget _supplierPanel() => _WorkspaceCard(
        title: '1. Pilih Supplier',
        child: Column(children: [
          DropdownButtonFormField<String>(
            value: _supplierId,
            isExpanded: true,
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), labelText: 'Cari nama supplier, kode, email, atau telepon'),
            items: widget.suppliers.map((row) => DropdownMenuItem(value: row.id, child: Text('${row.code} - ${row.name}'))).toList(),
            onChanged: (value) => setState(() => _supplierId = value),
          ),
          if (_supplier != null) ...[
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: _MetricMini('Supplier', _supplier!.name)),
              const SizedBox(width: 8),
              Expanded(child: _MetricMini('Saldo Hutang', _money(_supplier!.balance), warning: true)),
              const SizedBox(width: 8),
              const Expanded(child: _MetricMini('Status', 'Aktif')),
            ]),
          ],
        ]),
      );

  Widget _purchaseDetails() => _WorkspaceCard(
        title: '2. Cari / Tambah Barang',
        child: Column(children: [
          Row(children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _warehouseId,
                decoration: const InputDecoration(labelText: 'Gudang'),
                items: widget.warehouses.map((row) => DropdownMenuItem(value: row.id, child: Text('${row.code} - ${row.name}'))).toList(),
                onChanged: (value) => setState(() => _warehouseId = value),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: TextFormField(
                initialValue: _expectedDate,
                decoration: const InputDecoration(labelText: 'Tanggal jatuh tempo'),
                onChanged: (value) => _expectedDate = value,
              ),
            ),
          ]),
          const SizedBox(height: 10),
          TextField(
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(prefixIcon: Icon(Icons.search), labelText: 'Cari nama barang, SKU, barcode'),
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 86,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _filteredProducts.take(12).length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final product = _filteredProducts[index];
                return SizedBox(
                  width: 190,
                  child: _ProductCompactCard(product: product, onAdd: () => _add(product)),
                );
              },
            ),
          ),
        ]),
      );

  Widget _purchaseItems() => _WorkspaceCard(
        title: '3. Item Pembelian (${_lines.length} item)',
        child: _lines.isEmpty
            ? const _EmptyWorkspace(icon: Icons.inventory_2_outlined, message: 'Cari dan tambahkan produk yang akan dibeli.')
            : Column(
                children: _lines.values.map((line) => _EditableLine(
                      line: line,
                      purchase: true,
                      onQuantity: (value) => setState(() {
                        if (value <= 0) {
                          _lines.remove(line.product.id);
                        } else {
                          _lines[line.product.id] = line.copyWith(quantity: value);
                        }
                      }),
                      onRemove: () => setState(() => _lines.remove(line.product.id)),
                    )).toList(),
              ),
      );

  Widget _purchaseSummary() => _WorkspaceCard(
        title: 'Ringkasan Pembelian',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _SummaryRow('Total Item', '${_lines.length} item'),
          _SummaryRow('Total Qty', _number(_lines.values.fold(0, (sum, row) => sum + row.quantity))),
          const Divider(height: 24),
          _SummaryRow('Subtotal', _money(_subtotal)),
          _SummaryRow('PPN (11%)', _money(_tax)),
          const Divider(height: 24),
          _SummaryRow('Grand Total', _money(_total), strong: true),
          const SizedBox(height: 12),
          TextField(controller: _note, maxLines: 3, decoration: const InputDecoration(labelText: 'Catatan pembelian')),
          const SizedBox(height: 14),
          FilledButton.icon(onPressed: _busy ? null : _submit, icon: const Icon(Icons.send_outlined), label: Text(_busy ? 'Memproses...' : 'Posting Pembelian')),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: _busy ? null : _submit, icon: const Icon(Icons.save_outlined), label: const Text('Simpan Draft')),
        ]),
      );
}

class _WorkspaceHeader extends StatelessWidget {
  const _WorkspaceHeader({required this.title, required this.subtitle, required this.primaryLabel, required this.primaryIcon, required this.busy, required this.onPrimary, required this.onDraft});
  final String title;
  final String subtitle;
  final String primaryLabel;
  final IconData primaryIcon;
  final bool busy;
  final VoidCallback onPrimary;
  final VoidCallback onDraft;

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final actions = Wrap(spacing: 8, runSpacing: 8, children: [
          OutlinedButton.icon(onPressed: busy ? null : onDraft, icon: const Icon(Icons.save_outlined), label: const Text('Simpan Draft')),
          FilledButton.icon(onPressed: busy ? null : onPrimary, icon: Icon(primaryIcon), label: Text(primaryLabel)),
        ]);
        if (box.maxWidth < 650) {
          return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            Text(subtitle, style: const TextStyle(color: Color(0xFF64748B))),
            const SizedBox(height: 10),
            actions,
          ]);
        }
        return Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w900)),
            Text(subtitle, style: const TextStyle(color: Color(0xFF64748B))),
          ])),
          actions,
        ]);
      });
}

class _WorkflowSteps extends StatelessWidget {
  const _WorkflowSteps({required this.labels});
  final List<String> labels;
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final width = box.maxWidth < 720 ? box.maxWidth : (box.maxWidth - 24) / labels.length;
        return Wrap(
          spacing: 8,
          runSpacing: 8,
          children: labels.indexed.map((entry) => SizedBox(
            width: width,
            child: Container(
              padding: const EdgeInsets.all(11),
              decoration: BoxDecoration(
                color: entry.$1 == 0 ? const Color(0xFFEFF6FF) : Colors.white,
                border: Border.all(color: entry.$1 == 0 ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(7),
              ),
              child: Row(children: [
                CircleAvatar(radius: 13, backgroundColor: entry.$1 == 0 ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1), foregroundColor: Colors.white, child: Text('${entry.$1 + 1}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800))),
                const SizedBox(width: 8),
                Expanded(child: Text(entry.$2, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800))),
              ]),
            ),
          )).toList(),
        );
      });
}

class _WorkspaceCard extends StatelessWidget {
  const _WorkspaceCard({required this.title, required this.child, this.trailing});
  final String title;
  final Widget child;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: Colors.white, border: Border.all(color: const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(8)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900))), if (trailing != null) trailing!]),
          const SizedBox(height: 12),
          child,
        ]),
      );
}

class _MetricMini extends StatelessWidget {
  const _MetricMini(this.label, this.value, {this.warning = false});
  final String label;
  final String value;
  final bool warning;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(11),
        decoration: _softDecoration(),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          const SizedBox(height: 5),
          Text(value, maxLines: 2, overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w900, color: warning ? const Color(0xFFEA580C) : const Color(0xFF0F172A))),
        ]),
      );
}

class _ProductSearchRow extends StatelessWidget {
  const _ProductSearchRow({required this.product, required this.onAdd});
  final TransactionProduct product;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0)))),
        child: Row(children: [
          _ProductImage(product: product, size: 42),
          const SizedBox(width: 9),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
            Text('${product.code}  •  Stok ${product.stock}  •  ${_money(product.price)}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
          ])),
          OutlinedButton.icon(onPressed: product.stock <= 0 ? null : onAdd, icon: const Icon(Icons.add, size: 16), label: const Text('Tambah')),
        ]),
      );
}

class _ProductCompactCard extends StatelessWidget {
  const _ProductCompactCard({required this.product, required this.onAdd});
  final TransactionProduct product;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(9),
        decoration: _softDecoration(),
        child: Row(children: [
          _ProductImage(product: product, size: 40),
          const SizedBox(width: 8),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
            Text(_money(product.price), style: const TextStyle(fontSize: 11, color: Color(0xFF475569))),
          ])),
          IconButton(onPressed: onAdd, icon: const Icon(Icons.add_circle_outline, color: Color(0xFF2563EB))),
        ]),
      );
}

class _ProductImage extends StatelessWidget {
  const _ProductImage({required this.product, required this.size});
  final TransactionProduct product;
  final double size;
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: size,
          height: size,
          color: const Color(0xFFEFF6FF),
          child: product.imageUrl.isEmpty
              ? const Icon(Icons.inventory_2_outlined, color: Color(0xFF2563EB))
              : Image.network(product.imageUrl, fit: BoxFit.cover, errorBuilder: (_, __, ___) => const Icon(Icons.inventory_2_outlined, color: Color(0xFF2563EB))),
        ),
      );
}

class _EditableLine extends StatelessWidget {
  const _EditableLine({required this.line, required this.purchase, required this.onQuantity, required this.onRemove});
  final TransactionLineDraft line;
  final bool purchase;
  final ValueChanged<double> onQuantity;
  final VoidCallback onRemove;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0)))),
        child: LayoutBuilder(builder: (context, box) {
          final compact = box.maxWidth < 520;
          final identity = Row(children: [
            _ProductImage(product: line.product, size: 40),
            const SizedBox(width: 8),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(line.product.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w800)),
              Text('${line.product.code}  •  ${line.product.uom}', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            ])),
          ]);
          final controls = Row(mainAxisSize: MainAxisSize.min, children: [
            IconButton(onPressed: () => onQuantity(line.quantity - 1), icon: const Icon(Icons.remove_circle_outline, size: 19)),
            Text(_number(line.quantity), style: const TextStyle(fontWeight: FontWeight.w800)),
            IconButton(onPressed: () => onQuantity(line.quantity + 1), icon: const Icon(Icons.add_circle_outline, size: 19)),
            SizedBox(width: 88, child: Text(_money(line.net), textAlign: TextAlign.end, style: const TextStyle(fontWeight: FontWeight.w900))),
            IconButton(onPressed: onRemove, icon: const Icon(Icons.delete_outline, size: 19, color: Color(0xFFEF4444))),
          ]);
          if (compact) return Column(children: [identity, const SizedBox(height: 6), Align(alignment: Alignment.centerRight, child: controls)]);
          return Row(children: [Expanded(child: identity), controls]);
        }),
      );
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value, {this.strong = false});
  final String label;
  final String value;
  final bool strong;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: Text(label, style: TextStyle(color: strong ? const Color(0xFF0F172A) : const Color(0xFF64748B), fontWeight: strong ? FontWeight.w800 : FontWeight.w500))),
          const SizedBox(width: 8),
          Flexible(child: Text(value, textAlign: TextAlign.end, style: TextStyle(fontSize: strong ? 18 : 13, color: strong ? const Color(0xFF2563EB) : const Color(0xFF0F172A), fontWeight: strong ? FontWeight.w900 : FontWeight.w700))),
        ]),
      );
}

class _FilterChipLabel extends StatelessWidget {
  const _FilterChipLabel(this.label, {this.selected = false});
  final String label;
  final bool selected;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(color: selected ? const Color(0xFF2563EB) : Colors.white, border: Border.all(color: selected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(6)),
        child: Text(label, style: TextStyle(fontSize: 11, color: selected ? Colors.white : const Color(0xFF475569), fontWeight: FontWeight.w700)),
      );
}

class _EmptyWorkspace extends StatelessWidget {
  const _EmptyWorkspace({required this.icon, required this.message});
  final IconData icon;
  final String message;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 30),
        child: Column(children: [Icon(icon, size: 38, color: const Color(0xFF94A3B8)), const SizedBox(height: 8), Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B)))]),
      );
}

class _WorkspaceMessage extends StatelessWidget {
  const _WorkspaceMessage({required this.message});
  final String message;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: const Color(0xFFEFF6FF), border: Border.all(color: const Color(0xFFBFDBFE)), borderRadius: BorderRadius.circular(7)),
        child: Row(children: [const Icon(Icons.info_outline, color: Color(0xFF2563EB)), const SizedBox(width: 9), Expanded(child: Text(message, style: const TextStyle(fontWeight: FontWeight.w700)))]),
      );
}

BoxDecoration _softDecoration() => BoxDecoration(
      color: const Color(0xFFF8FAFC),
      border: Border.all(color: const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(7),
    );

String _initials(String value) {
  final words = value.trim().split(RegExp(r'\s+')).where((word) => word.isNotEmpty).take(2);
  return words.map((word) => word[0].toUpperCase()).join();
}

String _money(double value) => 'Rp ${value.round().toString().replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (match) => '.')}';
String _number(double value) => value == value.roundToDouble() ? value.round().toString() : value.toStringAsFixed(2);
