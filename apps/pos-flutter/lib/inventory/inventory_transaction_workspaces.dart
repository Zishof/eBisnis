import 'package:flutter/material.dart';

class TransactionParty {
  const TransactionParty({
    required this.id,
    required this.code,
    required this.name,
    this.phone = '-',
    this.address = '-',
    this.balance = 0,
    this.creditLimit = 0,
    this.paymentTermDays = 30,
  });

  final String id;
  final String code;
  final String name;
  final String phone;
  final String address;
  final double balance;
  final double creditLimit;
  final int paymentTermDays;
}

class TransactionProduct {
  const TransactionProduct({
    required this.id,
    required this.uomId,
    required this.code,
    required this.name,
    required this.uom,
    required this.price,
    required this.stock,
    this.imageUrl,
  });

  final String id;
  final String uomId;
  final String code;
  final String name;
  final String uom;
  final double price;
  final double stock;
  final String? imageUrl;
}

class TransactionLineDraft {
  TransactionLineDraft({required this.product, this.quantity = 1})
      : unitPrice = product.price;

  final TransactionProduct product;
  double quantity;
  double unitPrice;
  double discountPercent = 0;
  String batch = '';
  DateTime? expiryDate;

  double get gross => quantity * unitPrice;
  double get subtotal => gross * (1 - discountPercent / 100);
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
    required this.lines,
    required this.expectedDate,
    required this.taxPercent,
    required this.note,
  });
  final String supplierId;
  final String warehouseId;
  final List<TransactionLineDraft> lines;
  final DateTime expectedDate;
  final double taxPercent;
  final String note;
}

typedef SalesWorkspaceSubmit = Future<String> Function(
    SalesOrderWorkspaceSubmission value);
typedef PurchaseWorkspaceSubmit = Future<String> Function(
    PurchaseWorkspaceSubmission value);

class InventorySalesOrderWorkspace extends StatefulWidget {
  const InventorySalesOrderWorkspace({
    super.key,
    required this.customers,
    required this.products,
    required this.salesName,
    required this.onSubmit,
  });

  final List<TransactionParty> customers;
  final List<TransactionProduct> products;
  final String salesName;
  final SalesWorkspaceSubmit onSubmit;

  @override
  State<InventorySalesOrderWorkspace> createState() =>
      _InventorySalesOrderWorkspaceState();
}

class _InventorySalesOrderWorkspaceState
    extends State<InventorySalesOrderWorkspace> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  final List<TransactionLineDraft> _lines = [];
  String? _partyId;
  String _paymentTerm = 'Kredit 30 hari';
  String _productFilter = 'Semua';
  double _taxPercent = 11;
  bool _saving = false;
  String? _message;

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  TransactionParty? get _party {
    for (final value in widget.customers) {
      if (value.id == _partyId) return value;
    }
    return null;
  }

  List<TransactionProduct> get _filteredProducts {
    final q = _search.text.trim().toLowerCase();
    return widget.products
        .where((p) =>
            (q.isEmpty ||
                p.name.toLowerCase().contains(q) ||
                p.code.toLowerCase().contains(q)) &&
            (_productFilter != 'Stok Tersedia' || p.stock > 0) &&
            (_productFilter != 'Stok Menipis' ||
                (p.stock > 0 && p.stock <= 10)))
        .take(24)
        .toList();
  }

  double get _gross => _lines.fold(0, (sum, line) => sum + line.gross);
  double get _subtotal => _lines.fold(0, (sum, line) => sum + line.subtotal);
  double get _discount => _gross - _subtotal;
  double get _tax => _subtotal * _taxPercent / 100;
  double get _total => _subtotal + _tax;

  void _add(TransactionProduct product) {
    setState(() {
      final existing = _lines.where((l) => l.product.id == product.id);
      if (existing.isEmpty) {
        _lines.add(TransactionLineDraft(product: product));
      } else {
        existing.first.quantity += 1;
      }
      _message = null;
    });
  }

  Future<void> _submit() async {
    if (_partyId == null || _lines.isEmpty || _saving) return;
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      final number = await widget.onSubmit(SalesOrderWorkspaceSubmission(
        customerId: _partyId!,
        lines: List.unmodifiable(_lines),
        taxPercent: _taxPercent,
        paymentTerm: _paymentTerm,
        note: _note.text.trim(),
      ));
      if (!mounted) return;
      setState(() {
        _message = 'Order $number berhasil disimpan.';
        _lines.clear();
        _note.clear();
      });
    } on Object catch (error) {
      if (mounted) setState(() => _message = 'Order belum tersimpan: $error');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    _partyId ??= widget.customers.isEmpty ? null : widget.customers.first.id;
    return Material(
      color: const Color(0xFFF8FAFC),
      child: LayoutBuilder(builder: (context, box) {
        final desktop = box.maxWidth >= 1080;
        final center =
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _WorkspaceHeading(
            title: 'Sales Order',
            subtitle: 'Buat order lapangan dengan cepat dan mudah',
            steps: [
              'Pilih Customer',
              'Cari Barang',
              'Tambahkan ke Keranjang',
              'Review & Kirim'
            ],
            actions: _WorkspaceToolbar(
              primaryLabel: 'Kirim Order',
              primaryIcon: Icons.send_outlined,
              primaryEnabled: _partyId != null && _lines.isNotEmpty,
              busy: _saving,
              onPrimary: _submit,
              onDraft: _lines.isEmpty
                  ? null
                  : () => setState(() =>
                      _message = 'Draft tetap tersimpan pada perangkat ini.'),
              secondary: const ['Riwayat Draft', 'Sinkronkan'],
            ),
          ),
          const SizedBox(height: 12),
          _PartySelector(
            label: 'Pilih Customer',
            parties: widget.customers,
            value: _partyId,
            onChanged: (value) => setState(() => _partyId = value),
            trailing: _party == null
                ? null
                : Wrap(spacing: 8, runSpacing: 8, children: [
                    _MetricChip('Limit Kredit', _money(_party!.creditLimit)),
                    _MetricChip('Saldo Piutang', _money(_party!.balance),
                        warning: true),
                    _MetricChip(
                        'Sisa Kredit',
                        _money((_party!.creditLimit - _party!.balance)
                            .clamp(0, double.infinity)
                            .toDouble()),
                        success: true),
                    _MetricChip('Sales', widget.salesName),
                    const _MetricChip('Status', 'Aktif', success: true),
                  ]),
          ),
          const SizedBox(height: 12),
          if (desktop)
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Expanded(child: _productPicker()),
              const SizedBox(width: 12),
              Expanded(child: _lineEditor()),
            ])
          else ...[
            _productPicker(),
            const SizedBox(height: 12),
            _lineEditor(),
          ],
        ]);
        final summary = _SalesSummary(
          party: _party,
          lineCount: _lines.length,
          subtotal: _subtotal,
          discount: _discount,
          taxPercent: _taxPercent,
          tax: _tax,
          total: _total,
          paymentTerm: _paymentTerm,
          noteController: _note,
          saving: _saving,
          message: _message,
          onTaxChanged: (v) => setState(() => _taxPercent = v),
          onPaymentTermChanged: (v) => setState(() => _paymentTerm = v),
          onSubmit: _partyId == null || _lines.isEmpty ? null : _submit,
        );
        if (!desktop) {
          return Column(
              children: [center, const SizedBox(height: 12), summary]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(flex: 4, child: center),
          const SizedBox(width: 12),
          SizedBox(width: 300, child: summary),
        ]);
      }),
    );
  }

  Widget _productPicker() => _WorkspacePanel(
        title: 'Cari Barang',
        child: Column(children: [
          TextField(
            key: const Key('sales-product-search'),
            controller: _search,
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              hintText: 'Cari barang / SKU / barcode...',
              suffixIcon: Icon(Icons.qr_code_scanner),
            ),
          ),
          const SizedBox(height: 9),
          _TransactionFilters(
            selected: _productFilter,
            values: const [
              'Semua',
              'Favorit',
              'Stok Tersedia',
              'Stok Menipis',
              'Promo',
              'Sering Dibeli'
            ],
            onSelected: (value) => setState(() => _productFilter = value),
          ),
          if (_lines.isNotEmpty) ...[
            const SizedBox(height: 10),
            _RecentProductStrip(
                title: 'Terakhir Dipilih',
                products: _lines.reversed
                    .map((line) => line.product)
                    .take(3)
                    .toList(),
                onAdd: _add),
          ],
          const SizedBox(height: 10),
          const Align(
              alignment: Alignment.centerLeft,
              child: Text('Rekomendasi Produk',
                  style: TextStyle(fontWeight: FontWeight.w900))),
          SizedBox(
            height: 260,
            child: ListView.separated(
              itemCount: _filteredProducts.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (_, index) {
                final product = _filteredProducts[index];
                return _ProductResult(
                    product: product, onAdd: () => _add(product));
              },
            ),
          ),
        ]),
      );

  Widget _lineEditor() => _WorkspacePanel(
        title: 'Item Order (${_lines.length})',
        action: TextButton.icon(
          onPressed: _lines.isEmpty ? null : () => setState(_lines.clear),
          icon: const Icon(Icons.delete_sweep_outlined, size: 18),
          label: const Text('Bersihkan'),
        ),
        child: _lines.isEmpty
            ? const _EmptyTransactionLines(
                label: 'Pilih produk untuk mulai membuat order.')
            : Column(
                children: _lines
                    .map((line) => _LineEditor(
                          line: line,
                          purchase: false,
                          onChanged: () => setState(() {}),
                          onDelete: () => setState(() => _lines.remove(line)),
                        ))
                    .toList(),
              ),
      );
}

class InventoryPurchaseWorkspace extends StatefulWidget {
  const InventoryPurchaseWorkspace({
    super.key,
    required this.suppliers,
    required this.products,
    required this.warehouses,
    required this.onSubmit,
  });
  final List<TransactionParty> suppliers;
  final List<TransactionProduct> products;
  final List<TransactionParty> warehouses;
  final PurchaseWorkspaceSubmit onSubmit;

  @override
  State<InventoryPurchaseWorkspace> createState() =>
      _InventoryPurchaseWorkspaceState();
}

class _InventoryPurchaseWorkspaceState
    extends State<InventoryPurchaseWorkspace> {
  final _search = TextEditingController();
  final _note = TextEditingController();
  final List<TransactionLineDraft> _lines = [];
  String _productFilter = 'Semua';
  String? _supplierId;
  String? _warehouseId;
  DateTime _expected = DateTime.now().add(const Duration(days: 14));
  double _taxPercent = 11;
  bool _saving = false;
  String? _message;

  @override
  void dispose() {
    _search.dispose();
    _note.dispose();
    super.dispose();
  }

  TransactionParty? get _supplier {
    for (final value in widget.suppliers) {
      if (value.id == _supplierId) return value;
    }
    return null;
  }

  List<TransactionProduct> get _filteredProducts {
    final q = _search.text.trim().toLowerCase();
    return widget.products
        .where((p) =>
            (q.isEmpty ||
                p.name.toLowerCase().contains(q) ||
                p.code.toLowerCase().contains(q)) &&
            (_productFilter != 'Stok Tersedia' || p.stock > 0) &&
            (_productFilter != 'Stok Menipis' ||
                (p.stock > 0 && p.stock <= 10)))
        .take(12)
        .toList();
  }

  double get _gross => _lines.fold(0, (sum, line) => sum + line.gross);
  double get _subtotal => _lines.fold(0, (sum, line) => sum + line.subtotal);
  double get _discount => _gross - _subtotal;
  double get _tax => _subtotal * _taxPercent / 100;

  void _add(TransactionProduct product) => setState(() {
        final found = _lines.where((l) => l.product.id == product.id);
        found.isEmpty
            ? _lines.add(TransactionLineDraft(product: product))
            : found.first.quantity += 1;
      });

  Future<void> _submit() async {
    if (_supplierId == null ||
        _warehouseId == null ||
        _lines.isEmpty ||
        _saving) {
      return;
    }
    setState(() {
      _saving = true;
      _message = null;
    });
    try {
      final number = await widget.onSubmit(PurchaseWorkspaceSubmission(
        supplierId: _supplierId!,
        warehouseId: _warehouseId!,
        lines: List.unmodifiable(_lines),
        expectedDate: _expected,
        taxPercent: _taxPercent,
        note: _note.text.trim(),
      ));
      if (!mounted) return;
      setState(() {
        _message = 'Purchase order $number berhasil dibuat.';
        _lines.clear();
        _note.clear();
      });
    } on Object catch (error) {
      if (mounted) {
        setState(() => _message = 'Pembelian belum tersimpan: $error');
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    _supplierId ??= widget.suppliers.isEmpty ? null : widget.suppliers.first.id;
    _warehouseId ??=
        widget.warehouses.isEmpty ? null : widget.warehouses.first.id;
    return Material(
      color: const Color(0xFFF8FAFC),
      child: LayoutBuilder(builder: (context, box) {
        final desktop = box.maxWidth >= 1080;
        final content =
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _WorkspaceHeading(
            title: 'Transaksi Pembelian',
            subtitle: 'Input pembelian dari supplier dengan cepat dan akurat',
            steps: [
              'Pilih Supplier',
              'Cari / Tambah Barang',
              'Review Pembelian',
              'Simpan / Ajukan'
            ],
            actions: _WorkspaceToolbar(
              primaryLabel: 'Posting Pembelian',
              primaryIcon: Icons.send_outlined,
              primaryEnabled: _supplierId != null &&
                  _warehouseId != null &&
                  _lines.isNotEmpty,
              busy: _saving,
              onPrimary: _submit,
              onDraft: _lines.isEmpty
                  ? null
                  : () => setState(() =>
                      _message = 'Draft pembelian tersimpan pada perangkat.'),
              secondary: const ['Cetak', 'Export', 'Audit Trail'],
            ),
          ),
          const SizedBox(height: 12),
          _PartySelector(
            label: 'Pilih Supplier',
            parties: widget.suppliers,
            value: _supplierId,
            onChanged: (value) => setState(() => _supplierId = value),
            trailing: _supplier == null
                ? null
                : Wrap(spacing: 8, runSpacing: 8, children: [
                    _MetricChip('Saldo Hutang', _money(_supplier!.balance),
                        warning: true),
                    _MetricChip('Termin', '${_supplier!.paymentTermDays} hari'),
                    const _MetricChip('Peringkat', 'Terverifikasi',
                        success: true),
                    const _MetricChip('Status', 'Aktif', success: true),
                  ]),
          ),
          const SizedBox(height: 12),
          _PurchaseTransactionInfo(
            warehouses: widget.warehouses,
            warehouseId: _warehouseId,
            onWarehouseChanged: (value) => setState(() => _warehouseId = value),
            expectedDate: _expected,
            onExpectedChanged: (value) => setState(() => _expected = value),
            taxPercent: _taxPercent,
            onTaxChanged: (value) => setState(() => _taxPercent = value),
            noteController: _note,
          ),
          const SizedBox(height: 12),
          _WorkspacePanel(
              title: 'Cari / Tambah Barang',
              action: Wrap(spacing: 4, children: [
                TextButton.icon(
                    onPressed: () =>
                        _showWorkspaceNotice(context, 'Riwayat Supplier'),
                    icon: const Icon(Icons.history, size: 17),
                    label: const Text('Riwayat Supplier')),
                TextButton.icon(
                    onPressed: () =>
                        _showWorkspaceNotice(context, 'Katalog Supplier'),
                    icon: const Icon(Icons.menu_book_outlined, size: 17),
                    label: const Text('Katalog Supplier')),
              ]),
              child: Column(children: [
                TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(
                        prefixIcon: Icon(Icons.search),
                        hintText: 'Cari nama barang, SKU, barcode...',
                        suffixIcon: Icon(Icons.qr_code_scanner))),
                const SizedBox(height: 9),
                _TransactionFilters(
                  selected: _productFilter,
                  values: const [
                    'Semua',
                    'Stok Tersedia',
                    'Stok Menipis',
                    'Fast Moving',
                    'Promo'
                  ],
                  onSelected: (value) => setState(() => _productFilter = value),
                ),
                const SizedBox(height: 10),
                SizedBox(
                    height: 132,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: _filteredProducts.length,
                      separatorBuilder: (_, __) => const SizedBox(width: 8),
                      itemBuilder: (_, i) => SizedBox(
                          width: 230,
                          child: _ProductResult(
                              product: _filteredProducts[i],
                              onAdd: () => _add(_filteredProducts[i]))),
                    )),
              ])),
          const SizedBox(height: 12),
          _WorkspacePanel(
            title: 'Item Pembelian (${_lines.length})',
            child: _lines.isEmpty
                ? const _EmptyTransactionLines(
                    label: 'Tambahkan produk untuk menyusun pembelian.')
                : Column(
                    children: _lines
                        .map((line) => _LineEditor(
                            line: line,
                            purchase: true,
                            onChanged: () => setState(() {}),
                            onDelete: () =>
                                setState(() => _lines.remove(line))))
                        .toList()),
          ),
          const SizedBox(height: 12),
          const _PurchaseSupportingPanels(),
        ]);
        final summary = _PurchaseSummary(
          supplier: _supplier,
          warehouses: widget.warehouses,
          warehouseId: _warehouseId,
          onWarehouseChanged: (v) => setState(() => _warehouseId = v),
          expectedDate: _expected,
          onExpectedChanged: (v) => setState(() => _expected = v),
          lineCount: _lines.length,
          subtotal: _subtotal,
          discount: _discount,
          tax: _tax,
          total: _subtotal + _tax,
          taxPercent: _taxPercent,
          onTaxChanged: (value) => setState(() => _taxPercent = value),
          saving: _saving,
          message: _message,
          onSubmit:
              _supplierId == null || _warehouseId == null || _lines.isEmpty
                  ? null
                  : _submit,
        );
        if (!desktop) {
          return Column(
              children: [content, const SizedBox(height: 12), summary]);
        }
        return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Expanded(child: content),
          const SizedBox(width: 12),
          SizedBox(width: 300, child: summary),
        ]);
      }),
    );
  }
}

class _WorkspaceHeading extends StatelessWidget {
  const _WorkspaceHeading(
      {required this.title,
      required this.subtitle,
      required this.steps,
      this.actions});
  final String title;
  final String subtitle;
  final List<String> steps;
  final Widget? actions;

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        LayoutBuilder(builder: (context, box) {
          final heading =
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w900)),
            const SizedBox(height: 2),
            Text(subtitle, style: const TextStyle(color: Color(0xFF64748B))),
          ]);
          if (actions == null || box.maxWidth < 1100) {
            return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  heading,
                  if (actions != null) ...[
                    const SizedBox(height: 10),
                    actions!,
                  ]
                ]);
          }
          return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(child: heading),
            const SizedBox(width: 12),
            actions!,
          ]);
        }),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, box) {
          if (box.maxWidth < 680) {
            return SizedBox(
                height: 54,
                child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: steps.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) => SizedBox(
                        width: 190,
                        child: _StepTile(index: i, text: steps[i]))));
          }
          return Row(children: [
            for (var i = 0; i < steps.length; i++) ...[
              Expanded(child: _StepTile(index: i, text: steps[i])),
              if (i < steps.length - 1)
                const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 5),
                    child: Icon(Icons.chevron_right, color: Color(0xFF94A3B8))),
            ]
          ]);
        }),
      ]);
}

class _WorkspaceToolbar extends StatelessWidget {
  const _WorkspaceToolbar({
    required this.primaryLabel,
    required this.primaryIcon,
    required this.primaryEnabled,
    required this.busy,
    required this.onPrimary,
    required this.onDraft,
    required this.secondary,
  });
  final String primaryLabel;
  final IconData primaryIcon;
  final bool primaryEnabled;
  final bool busy;
  final VoidCallback onPrimary;
  final VoidCallback? onDraft;
  final List<String> secondary;

  @override
  Widget build(BuildContext context) => Wrap(
        spacing: 7,
        runSpacing: 7,
        alignment: WrapAlignment.end,
        children: [
          for (final label in secondary)
            OutlinedButton.icon(
              onPressed: () => _showWorkspaceNotice(context, label),
              icon: Icon(
                  label == 'Sinkronkan'
                      ? Icons.sync
                      : label == 'Cetak'
                          ? Icons.print_outlined
                          : label == 'Export'
                              ? Icons.file_download_outlined
                              : label == 'Audit Trail'
                                  ? Icons.policy_outlined
                                  : Icons.history,
                  size: 17),
              label: Text(label),
            ),
          OutlinedButton.icon(
              onPressed: onDraft,
              icon: const Icon(Icons.save_outlined, size: 17),
              label: const Text('Simpan Draft')),
          FilledButton.icon(
              onPressed: !primaryEnabled || busy ? null : onPrimary,
              icon: Icon(busy ? Icons.sync : primaryIcon, size: 17),
              label: Text(busy ? 'Menyimpan...' : primaryLabel)),
        ],
      );
}

class _StepTile extends StatelessWidget {
  const _StepTile({required this.index, required this.text});
  final int index;
  final String text;
  @override
  Widget build(BuildContext context) {
    final active = index == 0;
    return Container(
      height: 54,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: active ? const Color(0xFFEFF6FF) : Colors.white,
        border: Border.all(
            color: active ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Row(children: [
        CircleAvatar(
            radius: 14,
            backgroundColor:
                active ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
            child: Text('${index + 1}',
                style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 12))),
        const SizedBox(width: 8),
        Expanded(
            child: Text(text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: active
                        ? const Color(0xFF1D4ED8)
                        : const Color(0xFF475569)))),
      ]),
    );
  }
}

class _WorkspacePanel extends StatelessWidget {
  const _WorkspacePanel(
      {required this.title, required this.child, this.action});
  final String title;
  final Widget child;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(8)),
        child: LayoutBuilder(builder: (context, box) {
          final titleWidget =
              Text(title, style: const TextStyle(fontWeight: FontWeight.w900));
          final header = action == null
              ? titleWidget
              : box.maxWidth < 560
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                          titleWidget,
                          const SizedBox(height: 6),
                          Align(alignment: Alignment.centerLeft, child: action!)
                        ])
                  : Row(children: [
                      Expanded(child: titleWidget),
                      action!,
                    ]);
          return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [header, const SizedBox(height: 10), child]);
        }),
      );
}

class _TransactionFilters extends StatelessWidget {
  const _TransactionFilters(
      {required this.selected, required this.values, required this.onSelected});
  final String selected;
  final List<String> values;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 36,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: values.length,
          separatorBuilder: (_, __) => const SizedBox(width: 6),
          itemBuilder: (_, index) {
            final value = values[index];
            return FilterChip(
              selected: selected == value,
              label: Text(value),
              onSelected: (_) => onSelected(value),
              visualDensity: VisualDensity.compact,
            );
          },
        ),
      );
}

class _RecentProductStrip extends StatelessWidget {
  const _RecentProductStrip(
      {required this.title, required this.products, required this.onAdd});
  final String title;
  final List<TransactionProduct> products;
  final ValueChanged<TransactionProduct> onAdd;

  @override
  Widget build(BuildContext context) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(height: 6),
          SizedBox(
            height: 76,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: products.length,
              separatorBuilder: (_, __) => const SizedBox(width: 7),
              itemBuilder: (_, index) {
                final product = products[index];
                return InkWell(
                  onTap: () => onAdd(product),
                  borderRadius: BorderRadius.circular(7),
                  child: Container(
                    width: 190,
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      borderRadius: BorderRadius.circular(7),
                    ),
                    child: Row(children: [
                      _ProductThumb(product: product),
                      const SizedBox(width: 7),
                      Expanded(
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                            Text(product.name,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: 12)),
                            Text('Stok ${_qty(product.stock)}',
                                style: const TextStyle(
                                    color: Color(0xFF64748B), fontSize: 11)),
                            Text(_money(product.price),
                                style: const TextStyle(
                                    color: Color(0xFF047857),
                                    fontWeight: FontWeight.w800,
                                    fontSize: 11)),
                          ])),
                    ]),
                  ),
                );
              },
            ),
          )
        ],
      );
}

class _PurchaseTransactionInfo extends StatelessWidget {
  const _PurchaseTransactionInfo({
    required this.warehouses,
    required this.warehouseId,
    required this.onWarehouseChanged,
    required this.expectedDate,
    required this.onExpectedChanged,
    required this.taxPercent,
    required this.onTaxChanged,
    required this.noteController,
  });
  final List<TransactionParty> warehouses;
  final String? warehouseId;
  final ValueChanged<String?> onWarehouseChanged;
  final DateTime expectedDate;
  final ValueChanged<DateTime> onExpectedChanged;
  final double taxPercent;
  final ValueChanged<double> onTaxChanged;
  final TextEditingController noteController;

  @override
  Widget build(BuildContext context) => _WorkspacePanel(
        title: 'Informasi Transaksi',
        child: LayoutBuilder(builder: (context, box) {
          final fields = <Widget>[
            TextFormField(
                initialValue: 'Otomatis saat posting',
                readOnly: true,
                decoration: const InputDecoration(labelText: 'No. Pembelian')),
            DropdownButtonFormField<String>(
                value: warehouseId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Gudang'),
                items: warehouses
                    .map((w) => DropdownMenuItem(
                        value: w.id,
                        child: Text('${w.code} - ${w.name}',
                            overflow: TextOverflow.ellipsis)))
                    .toList(),
                onChanged: onWarehouseChanged),
            OutlinedButton.icon(
                onPressed: () async {
                  final date = await showDatePicker(
                      context: context,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                      initialDate: expectedDate);
                  if (date != null) onExpectedChanged(date);
                },
                icon: const Icon(Icons.event_outlined, size: 17),
                label: Text('Jatuh tempo ${_date(expectedDate)}')),
            DropdownButtonFormField<double>(
                value: taxPercent,
                decoration: const InputDecoration(labelText: 'Pajak'),
                items: const [
                  DropdownMenuItem(value: 0, child: Text('Tanpa pajak')),
                  DropdownMenuItem(value: 11, child: Text('PPN 11%')),
                ],
                onChanged: (value) => onTaxChanged(value ?? 0)),
            TextField(
                controller: noteController,
                decoration: const InputDecoration(
                    labelText: 'Referensi / Catatan',
                    hintText: 'No. PO, faktur supplier, atau catatan')),
          ];
          if (box.maxWidth < 680) {
            return Column(
                children: fields
                    .expand((field) => [field, const SizedBox(height: 8)])
                    .toList());
          }
          return Wrap(
              spacing: 10,
              runSpacing: 10,
              children: fields
                  .map((field) => SizedBox(width: 230, child: field))
                  .toList());
        }),
      );
}

class _PurchaseSupportingPanels extends StatelessWidget {
  const _PurchaseSupportingPanels();

  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (context, box) {
        final panels = <Widget>[
          _WorkspacePanel(
              title: 'Lampiran',
              action: TextButton.icon(
                  onPressed: () => _showWorkspaceNotice(context, 'Lampiran'),
                  icon: const Icon(Icons.attach_file, size: 17),
                  label: const Text('Pilih File')),
              child: const Text(
                  'PDF, JPG, atau PNG dapat dilampirkan setelah nomor pembelian terbentuk.',
                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12))),
          const _WorkspacePanel(
              title: 'Riwayat Pembelian Supplier',
              child: _EmptyOperationalData(
                  text:
                      'Pilih supplier untuk menampilkan transaksi sebelumnya.')),
          const _WorkspacePanel(
              title: 'Ringkasan Supplier YTD',
              child: _EmptyOperationalData(
                  text:
                      'Ringkasan mengikuti data pembelian yang telah diposting.')),
        ];
        if (box.maxWidth < 760) {
          return Column(
              children: panels
                  .expand((panel) => [panel, const SizedBox(height: 10)])
                  .toList());
        }
        return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: panels
                .expand((panel) =>
                    [Expanded(child: panel), const SizedBox(width: 10)])
                .toList()
              ..removeLast());
      });
}

class _EmptyOperationalData extends StatelessWidget {
  const _EmptyOperationalData({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(text,
          style: const TextStyle(color: Color(0xFF64748B), fontSize: 12)));
}

class _PartySelector extends StatelessWidget {
  const _PartySelector(
      {required this.label,
      required this.parties,
      required this.value,
      required this.onChanged,
      this.trailing});
  final String label;
  final List<TransactionParty> parties;
  final String? value;
  final ValueChanged<String?> onChanged;
  final Widget? trailing;
  static String _display(TransactionParty p) => '${p.code} - ${p.name}';

  @override
  Widget build(BuildContext context) => _WorkspacePanel(
        title: label,
        child: LayoutBuilder(builder: (context, box) {
          final selected = parties.where((p) => p.id == value).firstOrNull;
          // Autocomplete, bukan DropdownButtonFormField: dropdown polos hanya
          // membuka daftar statis untuk digulir -- ikon kaca pembesar dan teks
          // "Cari nama..." pada versi lama menjanjikan pencarian tetapi tidak
          // benar-benar memfilter apa pun saat diketik. Ini benar-benar
          // memfilter berdasarkan nama, kode, ATAU telepon setiap ketikan.
          final selector = Autocomplete<TransactionParty>(
            initialValue: TextEditingValue(
                text: selected == null ? '' : _display(selected)),
            displayStringForOption: _display,
            optionsBuilder: (input) {
              final q = input.text.trim().toLowerCase();
              if (q.isEmpty) return parties;
              return parties.where((p) =>
                  p.name.toLowerCase().contains(q) ||
                  p.code.toLowerCase().contains(q) ||
                  p.phone.toLowerCase().contains(q));
            },
            onSelected: (p) => onChanged(p.id),
            fieldViewBuilder: (context, controller, focusNode, onSubmit) =>
                TextField(
              key: const Key('sales-order-party-search'),
              controller: controller,
              focusNode: focusNode,
              decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Cari nama, kode, atau telepon...'),
            ),
            optionsViewBuilder: (context, onSelected, options) => Align(
              alignment: Alignment.topLeft,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                child: ConstrainedBox(
                  constraints:
                      const BoxConstraints(maxHeight: 280, maxWidth: 480),
                  child: options.isEmpty
                      ? const Padding(
                          padding: EdgeInsets.all(14),
                          child: Text('Tidak ada customer yang cocok.'),
                        )
                      : ListView.separated(
                          padding: EdgeInsets.zero,
                          shrinkWrap: true,
                          itemCount: options.length,
                          separatorBuilder: (_, __) =>
                              const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final p = options.elementAt(index);
                            return ListTile(
                              dense: true,
                              title: Text(p.name,
                                  overflow: TextOverflow.ellipsis),
                              subtitle: Text('${p.code}  •  ${p.phone}',
                                  overflow: TextOverflow.ellipsis),
                              onTap: () => onSelected(p),
                            );
                          },
                        ),
                ),
              ),
            ),
          );
          final party = selected;
          final card = party == null
              ? const SizedBox.shrink()
              : Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(7)),
                  child: Row(children: [
                    CircleAvatar(
                        backgroundColor: const Color(0xFFDBEAFE),
                        child: Text(_initials(party.name),
                            style: const TextStyle(
                                color: Color(0xFF1D4ED8),
                                fontWeight: FontWeight.w900))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                          Text(party.name,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w900)),
                          Text('${party.code}  •  ${party.phone}',
                              style: const TextStyle(
                                  color: Color(0xFF64748B), fontSize: 12)),
                          Text(party.address,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: Color(0xFF64748B), fontSize: 12)),
                        ])),
                  ]),
                );
          if (box.maxWidth < 760) {
            return Column(children: [
              selector,
              const SizedBox(height: 8),
              card,
              if (trailing != null) ...[
                const SizedBox(height: 8),
                Align(alignment: Alignment.centerLeft, child: trailing!)
              ]
            ]);
          }
          return Row(children: [
            Expanded(
                flex: 2,
                child: Column(
                    children: [selector, const SizedBox(height: 8), card])),
            if (trailing != null) ...[
              const SizedBox(width: 12),
              Expanded(flex: 3, child: trailing!)
            ]
          ]);
        }),
      );
}

class _MetricChip extends StatelessWidget {
  const _MetricChip(this.label, this.value,
      {this.warning = false, this.success = false});
  final String label;
  final String value;
  final bool warning;
  final bool success;
  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minWidth: 112),
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            borderRadius: BorderRadius.circular(7)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
          const SizedBox(height: 3),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.w900,
                  color: warning
                      ? const Color(0xFFEA580C)
                      : success
                          ? const Color(0xFF15803D)
                          : const Color(0xFF0F172A))),
        ]),
      );
}

class _ProductResult extends StatelessWidget {
  const _ProductResult({required this.product, required this.onAdd});
  final TransactionProduct product;
  final VoidCallback onAdd;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 7),
        child: Row(children: [
          _ProductThumb(product: product),
          const SizedBox(width: 9),
          Expanded(
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                Text(product.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w900)),
                Text(
                    '${product.code}  •  Stok ${_qty(product.stock)} ${product.uom}',
                    style: const TextStyle(
                        color: Color(0xFF64748B), fontSize: 11)),
                Text(_money(product.price),
                    style: const TextStyle(
                        color: Color(0xFF047857), fontWeight: FontWeight.w800)),
              ])),
          IconButton.filledTonal(
              onPressed: product.stock <= 0 ? null : onAdd,
              tooltip: 'Tambah item',
              icon: const Icon(Icons.add, size: 18)),
        ]),
      );
}

class _ProductThumb extends StatelessWidget {
  const _ProductThumb({required this.product});
  final TransactionProduct product;
  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
        width: 46,
        height: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(6)),
        child:
            const Icon(Icons.inventory_2_outlined, color: Color(0xFF2563EB)));
    if (product.imageUrl == null || product.imageUrl!.isEmpty) {
      return placeholder;
    }
    return ClipRRect(
        borderRadius: BorderRadius.circular(6),
        child: Image.network(product.imageUrl!,
            width: 46,
            height: 46,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => placeholder));
  }
}

class _LineEditor extends StatelessWidget {
  const _LineEditor(
      {required this.line,
      required this.purchase,
      required this.onChanged,
      required this.onDelete});
  final TransactionLineDraft line;
  final bool purchase;
  final VoidCallback onChanged;
  final VoidCallback onDelete;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0)))),
        child: Column(children: [
          Row(children: [
            _ProductThumb(product: line.product),
            const SizedBox(width: 8),
            Expanded(
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                  Text(line.product.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900)),
                  Text(
                      '${line.product.code} • Stok ${_qty(line.product.stock)}',
                      style: const TextStyle(
                          color: Color(0xFF64748B), fontSize: 11)),
                ])),
            IconButton(
                onPressed: onDelete,
                tooltip: 'Hapus',
                icon:
                    const Icon(Icons.delete_outline, color: Color(0xFFDC2626))),
          ]),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
                child: _NumberField(
                    label: 'Qty',
                    value: line.quantity,
                    onChanged: (v) {
                      line.quantity = v <= 0 ? 1 : v;
                      onChanged();
                    })),
            const SizedBox(width: 8),
            Expanded(
                child: _NumberField(
                    label: purchase ? 'Harga Beli' : 'Harga',
                    value: line.unitPrice,
                    onChanged: (v) {
                      line.unitPrice = v < 0 ? 0 : v;
                      onChanged();
                    })),
            const SizedBox(width: 8),
            Expanded(
                child: _NumberField(
                    label: 'Diskon %',
                    value: line.discountPercent,
                    onChanged: (v) {
                      line.discountPercent = v.clamp(0, 100);
                      onChanged();
                    })),
          ]),
          if (purchase) ...[
            const SizedBox(height: 8),
            Row(children: [
              Expanded(
                  child: TextFormField(
                      initialValue: line.batch,
                      decoration: const InputDecoration(labelText: 'Batch'),
                      onChanged: (v) => line.batch = v)),
              const SizedBox(width: 8),
              Expanded(
                  child: OutlinedButton.icon(
                      onPressed: () async {
                        final date = await showDatePicker(
                            context: context,
                            firstDate: DateTime.now(),
                            lastDate:
                                DateTime.now().add(const Duration(days: 3650)),
                            initialDate: line.expiryDate ??
                                DateTime.now().add(const Duration(days: 365)));
                        if (date != null) {
                          line.expiryDate = date;
                          onChanged();
                        }
                      },
                      icon: const Icon(Icons.event_outlined, size: 17),
                      label: Text(line.expiryDate == null
                          ? 'Expiry'
                          : _date(line.expiryDate!)))),
            ]),
          ],
          const SizedBox(height: 5),
          Align(
              alignment: Alignment.centerRight,
              child: Text('Subtotal ${_money(line.subtotal)}',
                  style: const TextStyle(fontWeight: FontWeight.w900))),
        ]),
      );
}

class _NumberField extends StatelessWidget {
  const _NumberField(
      {required this.label, required this.value, required this.onChanged});
  final String label;
  final double value;
  final ValueChanged<double> onChanged;
  @override
  Widget build(BuildContext context) => TextFormField(
      key: ValueKey('$label-$value'),
      initialValue: _qty(value),
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label),
      onChanged: (v) =>
          onChanged(double.tryParse(v.replaceAll(',', '.')) ?? 0));
}

class _EmptyTransactionLines extends StatelessWidget {
  const _EmptyTransactionLines({required this.label});
  final String label;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(children: [
        const Icon(Icons.shopping_cart_outlined,
            size: 38, color: Color(0xFF94A3B8)),
        const SizedBox(height: 8),
        Text(label,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Color(0xFF64748B))),
      ]));
}

class _SalesSummary extends StatelessWidget {
  const _SalesSummary({
    required this.party,
    required this.lineCount,
    required this.subtotal,
    required this.discount,
    required this.taxPercent,
    required this.tax,
    required this.total,
    required this.paymentTerm,
    required this.noteController,
    required this.saving,
    required this.message,
    required this.onTaxChanged,
    required this.onPaymentTermChanged,
    required this.onSubmit,
  });
  final TransactionParty? party;
  final int lineCount;
  final double subtotal;
  final double discount;
  final double taxPercent;
  final double tax;
  final double total;
  final String paymentTerm;
  final TextEditingController noteController;
  final bool saving;
  final String? message;
  final ValueChanged<double> onTaxChanged;
  final ValueChanged<String> onPaymentTermChanged;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) => _WorkspacePanel(
      title: 'Ringkasan Order',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _SummaryRow('Customer', party?.name ?? '-'),
        const Divider(),
        _SummaryRow('Total Item', '$lineCount item'),
        _SummaryRow('Diskon', _money(discount)),
        _SummaryRow('Subtotal', _money(subtotal)),
        DropdownButtonFormField<double>(
          value: taxPercent,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Pajak'),
          items: const [
            DropdownMenuItem(value: 0, child: Text('Tanpa pajak')),
            DropdownMenuItem(value: 11, child: Text('PPN 11%'))
          ],
          onChanged: (v) => onTaxChanged(v ?? 0),
        ),
        _SummaryRow('Pajak', _money(tax)),
        const Divider(),
        _SummaryRow('Total Order', _money(total), strong: true),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          value: paymentTerm,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Pembayaran & Termin'),
          items: const [
            'Tunai',
            'Kredit 7 hari',
            'Kredit 14 hari',
            'Kredit 30 hari'
          ].map((v) => DropdownMenuItem(value: v, child: Text(v))).toList(),
          onChanged: (v) => onPaymentTermChanged(v ?? paymentTerm),
        ),
        const SizedBox(height: 8),
        TextField(
            controller: noteController,
            minLines: 2,
            maxLines: 3,
            decoration: const InputDecoration(
                labelText: 'Catatan Order',
                hintText: 'Catatan untuk order ini (opsional)')),
        const SizedBox(height: 12),
        FilledButton.icon(
          key: const Key('submit-sales-order'),
          onPressed: saving ? null : onSubmit,
          icon: Icon(saving ? Icons.sync : Icons.send_outlined),
          label: Text(saving ? 'Menyimpan...' : 'Kirim Order'),
        ),
        const SizedBox(height: 7),
        OutlinedButton.icon(
            onPressed: lineCount == 0
                ? null
                : () => _showWorkspaceNotice(context, 'Simpan Draft'),
            icon: const Icon(Icons.save_outlined),
            label: const Text('Simpan Draft')),
        if (message != null) ...[
          const SizedBox(height: 10),
          _StatusMessage(message!)
        ],
      ]));
}

class _PurchaseSummary extends StatelessWidget {
  const _PurchaseSummary({
    required this.supplier,
    required this.warehouses,
    required this.warehouseId,
    required this.onWarehouseChanged,
    required this.expectedDate,
    required this.onExpectedChanged,
    required this.lineCount,
    required this.subtotal,
    required this.discount,
    required this.taxPercent,
    required this.tax,
    required this.total,
    required this.saving,
    required this.message,
    required this.onTaxChanged,
    required this.onSubmit,
  });
  final TransactionParty? supplier;
  final List<TransactionParty> warehouses;
  final String? warehouseId;
  final ValueChanged<String?> onWarehouseChanged;
  final DateTime expectedDate;
  final ValueChanged<DateTime> onExpectedChanged;
  final int lineCount;
  final double subtotal;
  final double discount;
  final double taxPercent;
  final double tax;
  final double total;
  final bool saving;
  final String? message;
  final ValueChanged<double> onTaxChanged;
  final VoidCallback? onSubmit;

  @override
  Widget build(BuildContext context) => _WorkspacePanel(
      title: 'Ringkasan Pembelian',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        _SummaryRow('Supplier', supplier?.name ?? '-'),
        _SummaryRow('Total Item', '$lineCount item'),
        _SummaryRow('Diskon Total', _money(discount)),
        _SummaryRow('Subtotal', _money(subtotal)),
        DropdownButtonFormField<double>(
          value: taxPercent,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Pajak'),
          items: const [
            DropdownMenuItem(value: 0, child: Text('Tanpa pajak')),
            DropdownMenuItem(value: 11, child: Text('PPN 11%')),
          ],
          onChanged: (value) => onTaxChanged(value ?? 0),
        ),
        _SummaryRow('Pajak', _money(tax)),
        const Divider(),
        _SummaryRow('Grand Total', _money(total), strong: true),
        _SummaryRow('Uang Muka / Pembayaran', _money(0)),
        _SummaryRow('Sisa Hutang', _money(total)),
        const SizedBox(height: 10),
        DropdownButtonFormField<String>(
          value: warehouseId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Gudang Tujuan'),
          items: warehouses
              .map((w) => DropdownMenuItem(
                  value: w.id,
                  child: Text('${w.code} - ${w.name}',
                      overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: onWarehouseChanged,
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
            onPressed: () async {
              final date = await showDatePicker(
                  context: context,
                  firstDate: DateTime.now(),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                  initialDate: expectedDate);
              if (date != null) onExpectedChanged(date);
            },
            icon: const Icon(Icons.event_outlined),
            label: Text('Jatuh tempo ${_date(expectedDate)}')),
        const SizedBox(height: 12),
        FilledButton.icon(
          key: const Key('submit-purchase-order'),
          onPressed: saving ? null : onSubmit,
          icon: Icon(saving ? Icons.sync : Icons.send_outlined),
          label: Text(saving ? 'Menyimpan...' : 'Posting Pembelian'),
        ),
        const SizedBox(height: 7),
        OutlinedButton.icon(
            onPressed: lineCount == 0
                ? null
                : () => _showWorkspaceNotice(context, 'Simpan Draft'),
            icon: const Icon(Icons.save_outlined),
            label: const Text('Simpan Draft')),
        if (message != null) ...[
          const SizedBox(height: 10),
          _StatusMessage(message!)
        ],
      ]));
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
        Expanded(
            child: Text(label,
                style: TextStyle(
                    color: strong
                        ? const Color(0xFF0F172A)
                        : const Color(0xFF64748B),
                    fontWeight: strong ? FontWeight.w900 : FontWeight.w500))),
        const SizedBox(width: 8),
        Flexible(
            child: Text(value,
                textAlign: TextAlign.right,
                style: TextStyle(
                    fontSize: strong ? 18 : 13,
                    color: strong
                        ? const Color(0xFF2563EB)
                        : const Color(0xFF0F172A),
                    fontWeight: FontWeight.w900))),
      ]));
}

class _StatusMessage extends StatelessWidget {
  const _StatusMessage(this.message);
  final String message;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(6)),
      child: Text(message,
          style: const TextStyle(
              color: Color(0xFF047857),
              fontWeight: FontWeight.w800,
              fontSize: 12)));
}

void _showWorkspaceNotice(BuildContext context, String action) {
  ScaffoldMessenger.of(context)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
        content: Text('$action tersedia setelah dokumen transaksi tersimpan.'),
        behavior: SnackBarBehavior.floating));
}

String _money(double value) {
  final rounded = value.round().abs().toString();
  final formatted =
      rounded.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => '.');
  return '${value < 0 ? '-' : ''}Rp $formatted';
}

String _qty(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : value.toStringAsFixed(2);
String _date(DateTime value) =>
    '${value.day.toString().padLeft(2, '0')}/${value.month.toString().padLeft(2, '0')}/${value.year}';
String _initials(String value) => value
    .trim()
    .split(RegExp(r'\s+'))
    .where((v) => v.isNotEmpty)
    .take(2)
    .map((v) => v[0].toUpperCase())
    .join();

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
