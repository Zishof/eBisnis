library;

import 'package:flutter/material.dart';

import '../api/pos_api.dart';
import 'tema.dart';

class BukaShiftApotikPage extends StatefulWidget {
  const BukaShiftApotikPage({
    required this.client,
    required this.contextData,
    required this.onShiftOpened,
    required this.onLogout,
    super.key,
  });

  final PosApiClient client;
  final Map<String, Object?> contextData;
  final Future<void> Function() onShiftOpened;
  final VoidCallback onLogout;

  @override
  State<BukaShiftApotikPage> createState() => _BukaShiftApotikPageState();
}

class _BukaShiftApotikPageState extends State<BukaShiftApotikPage> {
  final _saldo = TextEditingController(text: '0');
  String? _terminal;
  bool _busy = false;
  String? _error;

  List<Map<String, Object?>> get _registers =>
      ((widget.contextData['registers'] as List?) ?? const [])
          .whereType<Map<String, Object?>>()
          .toList();

  @override
  void initState() {
    super.initState();
    if (_registers.isNotEmpty) {
      _terminal = _registers.first['terminalId']?.toString();
    }
  }

  @override
  void dispose() {
    _saldo.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    if (_terminal == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.client.bukaShift(
        terminalId: _terminal!,
        openingCash: num.tryParse(_saldo.text.replaceAll('.', '')) ?? 0,
        note: 'Dibuka dari aplikasi POS Apotik',
      );
      await widget.onShiftOpened();
    } on Object catch (error) {
      if (mounted) setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final outlets = ((widget.contextData['outlets'] as List?) ?? const [])
        .whereType<Map<String, Object?>>()
        .toList();
    return Scaffold(
      backgroundColor: const Color(0xFFF4FAF8),
      appBar: AppBar(
        title: const Text('eMedik POS Apotik'),
        actions: [
          TextButton.icon(
              onPressed: widget.onLogout,
              icon: const Icon(Icons.logout),
              label: const Text('Keluar'))
        ],
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1160),
            child: LayoutBuilder(builder: (context, size) {
              final compact = size.maxWidth < 780;
              final form = _ShiftForm(
                tenant:
                    widget.client.authenticatedTenantName ?? 'Apotik eMedik',
                user: widget.client.displayName ??
                    widget.client.authenticatedUsername ??
                    '-',
                outlet: outlets.isEmpty
                    ? '-'
                    : (outlets.first['name'] ?? '-').toString(),
                registers: _registers,
                terminal: _terminal,
                onTerminal: (value) => setState(() => _terminal = value),
                saldo: _saldo,
                busy: _busy,
                error: _error,
                onOpen: _open,
              );
              final ready = const _ReadinessPanel();
              return compact
                  ? Column(children: [form, const SizedBox(height: 16), ready])
                  : Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                          Expanded(flex: 3, child: form),
                          const SizedBox(width: 18),
                          Expanded(flex: 2, child: ready)
                        ]);
            }),
          ),
        ),
      ),
    );
  }
}

class _ShiftForm extends StatelessWidget {
  const _ShiftForm(
      {required this.tenant,
      required this.user,
      required this.outlet,
      required this.registers,
      required this.terminal,
      required this.onTerminal,
      required this.saldo,
      required this.busy,
      required this.error,
      required this.onOpen});
  final String tenant, user, outlet;
  final List<Map<String, Object?>> registers;
  final String? terminal;
  final ValueChanged<String?> onTerminal;
  final TextEditingController saldo;
  final bool busy;
  final String? error;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(24),
        decoration: hiasanKartu(),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(Icons.verified_user_outlined, color: Warna.utama, size: 30),
            SizedBox(width: 12),
            Expanded(
                child: Text('Identitas Apotik & Buka Shift',
                    style:
                        TextStyle(fontSize: 24, fontWeight: FontWeight.w800)))
          ]),
          const SizedBox(height: 8),
          const Text(
              'Akun telah diverifikasi server. Periksa penempatan kerja sebelum mulai melayani transaksi.',
              style: TextStyle(color: Warna.teksRedup)),
          const SizedBox(height: 22),
          _InfoRow('Apotik', tenant),
          _InfoRow('Pengguna', user),
          _InfoRow('Outlet', outlet),
          const Divider(height: 32),
          const Text('Terminal kasir',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 7),
          DropdownButtonFormField<String>(
              value: terminal,
              items: registers
                  .map((r) => DropdownMenuItem(
                      value: r['terminalId']?.toString(),
                      child: Text((r['name'] ?? r['code'] ?? r['terminalId'])
                          .toString())))
                  .toList(),
              onChanged: onTerminal),
          const SizedBox(height: 16),
          const Text('Saldo awal laci kas',
              style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 7),
          TextField(
              controller: saldo,
              keyboardType: TextInputType.number,
              decoration:
                  const InputDecoration(prefixText: 'Rp ', hintText: '0')),
          if (error != null)
            Padding(
                padding: const EdgeInsets.only(top: 12),
                child:
                    Text(error!, style: const TextStyle(color: Warna.merah))),
          const SizedBox(height: 22),
          FilledButton.icon(
              onPressed: busy || terminal == null ? null : onOpen,
              icon: busy
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.lock_open_outlined),
              label: const Text('Buka Shift dan Mulai Transaksi')),
        ]),
      );
}

class _ReadinessPanel extends StatelessWidget {
  const _ReadinessPanel();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: hiasanKartu(),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Text('Checklist Sebelum Masuk',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text('Pastikan kesiapan operasional berikut.',
              style: TextStyle(color: Warna.teksRedup)),
          const SizedBox(height: 14),
          for (final item in const [
            ('Stok & kedaluwarsa', Icons.inventory_2_outlined),
            ('Printer dan scanner', Icons.print_outlined),
            ('Koneksi internet', Icons.wifi_outlined),
            ('Saldo awal kas', Icons.payments_outlined),
            ('Informasi harga', Icons.price_check_outlined),
            ('Area kerja', Icons.cleaning_services_outlined)
          ])
            ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                        color: const Color(0xFFE5F7F2),
                        borderRadius: BorderRadius.circular(6)),
                    child: Icon(item.$2, color: Warna.utama, size: 20)),
                title: Text(item.$1,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                trailing: const Icon(Icons.check_circle,
                    color: Color(0xFF16A34A), size: 19)),
        ]),
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow(this.label, this.value);
  final String label, value;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(color: Warna.teksRedup))),
        Expanded(
            child: Text(value,
                style: const TextStyle(fontWeight: FontWeight.w700)))
      ]));
}

class OperasiApotikPage extends StatefulWidget {
  const OperasiApotikPage(
      {required this.area, required this.client, super.key});
  final String area;
  final PosApiClient client;
  @override
  State<OperasiApotikPage> createState() => _OperasiApotikPageState();
}

class _OperasiApotikPageState extends State<OperasiApotikPage> {
  late Future<Object> _future;
  String? _selected;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  @override
  void didUpdateWidget(covariant OperasiApotikPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.area != widget.area) _reload();
  }

  void _reload() =>
      _future = widget.area == 'sinkronisasi' || widget.area == 'shift-apotik'
          ? widget.client.konteks()
          : widget.client.daftarPenjualanApotik();
  void _refresh() => setState(_reload);

  @override
  Widget build(BuildContext context) => FutureBuilder<Object>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorPanel(
              message: snapshot.error.toString(), onRetry: _refresh);
        }
        if (snapshot.data is Map<String, Object?>) {
          return _DevicePanel(
              data: snapshot.data! as Map<String, Object?>,
              onRefresh: _refresh);
        }
        final sales = (snapshot.data! as List<Map<String, Object?>>);
        return _SalesOperations(
            area: widget.area,
            sales: sales,
            selected: _selected,
            onSelected: (id) => setState(() => _selected = id),
            client: widget.client,
            onRefresh: _refresh);
      });
}

class _SalesOperations extends StatelessWidget {
  const _SalesOperations(
      {required this.area,
      required this.sales,
      required this.selected,
      required this.onSelected,
      required this.client,
      required this.onRefresh});
  final String area;
  final List<Map<String, Object?>> sales;
  final String? selected;
  final ValueChanged<String?> onSelected;
  final PosApiClient client;
  final VoidCallback onRefresh;

  String get title => switch (area) {
        'retur-apotik' => 'Retur Penjualan Apotik',
        'void-apotik' => 'Void & Persetujuan',
        _ => 'Riwayat Transaksi POS'
      };
  @override
  Widget build(BuildContext context) {
    final chosen = selected ??
        (sales.isEmpty ? null : sales.first['pos_sale_id']?.toString());
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _PageTitle(
          title: title,
          subtitle:
              'Data langsung dari server tenant, termasuk mode farmasi dan status transaksi.',
          onRefresh: onRefresh),
      Expanded(child: LayoutBuilder(builder: (context, size) {
        final list = ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: sales.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final sale = sales[index];
              final id = sale['pos_sale_id'].toString();
              return Material(
                  color: id == chosen ? const Color(0xFFE2F5F1) : Colors.white,
                  shape: RoundedRectangleBorder(
                      side: const BorderSide(color: Warna.garis),
                      borderRadius: BorderRadius.circular(6)),
                  child: ListTile(
                      onTap: () => onSelected(id),
                      title: Text(
                          (sale['receipt_number'] ??
                                  id.substring(
                                      0, id.length > 10 ? 10 : id.length))
                              .toString(),
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                          '${sale['transaction_mode'] ?? 'OTC'} · ${sale['line_count'] ?? 0} item · ${sale['updated_at'] ?? '-'}'),
                      trailing: Text('Rp ${sale['grand_total'] ?? 0}',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: Warna.utama))));
            });
        final detail = chosen == null
            ? const Center(child: Text('Belum ada transaksi.'))
            : _SaleDetail(
                area: area, saleId: chosen, client: client, onDone: onRefresh);
        return size.maxWidth < 760
            ? selected == null
                ? list
                : Column(children: [
                    Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                            onPressed: () => onSelected(null),
                            icon: const Icon(Icons.arrow_back),
                            label: const Text('Daftar transaksi'))),
                    Expanded(child: detail)
                  ])
            : Row(children: [
                Expanded(flex: 3, child: list),
                const VerticalDivider(width: 1),
                Expanded(flex: 2, child: detail)
              ]);
      })),
    ]);
  }
}

class _SaleDetail extends StatefulWidget {
  const _SaleDetail(
      {required this.area,
      required this.saleId,
      required this.client,
      required this.onDone});
  final String area, saleId;
  final PosApiClient client;
  final VoidCallback onDone;
  @override
  State<_SaleDetail> createState() => _SaleDetailState();
}

class _SaleDetailState extends State<_SaleDetail> {
  late Future<Map<String, Object?>> _detail;
  final _reason = TextEditingController();
  bool _busy = false;
  final Map<String, int> _returnQuantities = {};
  String _disposition = 'RESTOCK';
  @override
  void initState() {
    super.initState();
    _detail = widget.client.detailPenjualan(widget.saleId);
  }

  @override
  void didUpdateWidget(covariant _SaleDetail oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.saleId != widget.saleId) {
      _detail = widget.client.detailPenjualan(widget.saleId);
      _returnQuantities.clear();
    }
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _act(String action, List<Map<String, Object?>> lines) async {
    if (_reason.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Alasan wajib diisi untuk audit.')));
      return;
    }
    setState(() => _busy = true);
    try {
      if (action == 'print') {
        await widget.client.cetakUlang(widget.saleId, _reason.text);
      }
      if (action == 'void') {
        await widget.client.ajukanVoid(widget.saleId, _reason.text);
      }
      if (action == 'approve') {
        await widget.client.setujuiVoid(widget.saleId, _reason.text);
      }
      if (action == 'return') {
        final returnLines = lines
            .where(
                (line) => (_returnQuantities[line['id']?.toString()] ?? 0) > 0)
            .map((line) => <String, Object?>{
                  'saleLineId': line['id'],
                  'quantity': _returnQuantities[line['id']?.toString()]!,
                  'disposition': _disposition,
                })
            .toList();
        if (returnLines.isEmpty) {
          throw const PosApiException(
              'Pilih minimal satu jumlah item yang akan diretur.');
        }
        await widget.client.ajukanRetur(
            saleId: widget.saleId, reason: _reason.text, lines: returnLines);
      }
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Tindakan berhasil dicatat pada server.')));
      }
      widget.onDone();
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
  Widget build(BuildContext context) => FutureBuilder<Map<String, Object?>>(
      future: _detail,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final data = snapshot.data!;
        final lines = ((data['lines'] as List?) ?? const [])
            .whereType<Map<String, Object?>>()
            .toList();
        return ListView(padding: const EdgeInsets.all(18), children: [
          Text((data['receipt_number'] ?? widget.saleId).toString(),
              style:
                  const TextStyle(fontSize: 19, fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text('Status ${data['status'] ?? '-'}',
              style: const TextStyle(color: Warna.teksRedup)),
          const Divider(height: 28),
          for (final line in lines) _returnLine(line),
          if (widget.area == 'retur-apotik') ...[
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
                value: _disposition,
                decoration: const InputDecoration(labelText: 'Disposisi stok'),
                items: const [
                  DropdownMenuItem(
                      value: 'RESTOCK', child: Text('Kembali ke stok')),
                  DropdownMenuItem(
                      value: 'DAMAGED', child: Text('Rusak / karantina')),
                  DropdownMenuItem(
                      value: 'DISPOSED', child: Text('Dimusnahkan')),
                ],
                onChanged: (value) =>
                    setState(() => _disposition = value ?? 'RESTOCK')),
          ],
          const SizedBox(height: 10),
          TextField(
              controller: _reason,
              maxLines: 3,
              decoration: const InputDecoration(
                  labelText: 'Alasan operasional',
                  hintText: 'Wajib untuk audit')),
          const SizedBox(height: 14),
          if (widget.area == 'riwayat-server')
            FilledButton.icon(
                onPressed: _busy ? null : () => _act('print', lines),
                icon: const Icon(Icons.print_outlined),
                label: const Text('Cetak Ulang Struk')),
          if (widget.area == 'retur-apotik')
            FilledButton.icon(
                onPressed:
                    _busy || lines.isEmpty ? null : () => _act('return', lines),
                icon: const Icon(Icons.assignment_return_outlined),
                label: const Text('Ajukan Retur Terpilih')),
          if (widget.area == 'void-apotik')
            Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                  onPressed: _busy ? null : () => _act('void', lines),
                  icon: const Icon(Icons.block),
                  label: const Text('Ajukan Void')),
              FilledButton.icon(
                  onPressed: _busy ? null : () => _act('approve', lines),
                  icon: const Icon(Icons.verified_user_outlined),
                  label: const Text('Setujui Void'))
            ]),
          if (widget.area == 'void-apotik')
            const Padding(
                padding: EdgeInsets.only(top: 10),
                child: Text('Pemohon dan penyetuju wajib akun berbeda.',
                    style: TextStyle(fontSize: 12, color: Warna.jingga)))
        ]);
      });

  Widget _returnLine(Map<String, Object?> line) {
    final id = line['id']?.toString() ?? '';
    final purchased = NumberConverter.toInt(line['quantity']);
    final returned = NumberConverter.toInt(line['returned_quantity']);
    final available = (purchased - returned).clamp(0, purchased);
    final quantity = _returnQuantities[id] ?? 0;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text((line['product_name'] ?? 'Produk').toString()),
      subtitle: Text(
          'Batch ${line['lot_number'] ?? '-'} · ED ${line['expiry_date'] ?? '-'} · dapat diretur $available'),
      trailing: widget.area != 'retur-apotik'
          ? Text('$purchased')
          : SizedBox(
              width: 116,
              child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                IconButton(
                    onPressed: quantity <= 0
                        ? null
                        : () => setState(
                            () => _returnQuantities[id] = quantity - 1),
                    icon: const Icon(Icons.remove_circle_outline)),
                Text('$quantity',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
                IconButton(
                    onPressed: quantity >= available
                        ? null
                        : () => setState(
                            () => _returnQuantities[id] = quantity + 1),
                    icon: const Icon(Icons.add_circle_outline)),
              ])),
    );
  }
}

class _DevicePanel extends StatelessWidget {
  const _DevicePanel({required this.data, required this.onRefresh});
  final Map<String, Object?> data;
  final VoidCallback onRefresh;
  @override
  Widget build(BuildContext context) {
    final outlets = ((data['outlets'] as List?) ?? const []).length;
    final registers = ((data['registers'] as List?) ?? const []).length;
    final shift = data['openShift'] as Map<String, Object?>?;
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      _PageTitle(
          title: 'Sinkronisasi & Status Perangkat',
          subtitle: 'Status koneksi dan penempatan kerja dari server tenant.',
          onRefresh: onRefresh),
      Expanded(
          child: GridView.count(
              padding: const EdgeInsets.all(18),
              crossAxisCount: MediaQuery.sizeOf(context).width < 720 ? 1 : 3,
              childAspectRatio: 1.65,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              children: [
            _Metric(
                icon: Icons.cloud_done_outlined,
                title: 'Internet & API',
                value: 'Online',
                note: 'Koneksi server tersedia'),
            _Metric(
                icon: Icons.store_outlined,
                title: 'Outlet',
                value: '$outlets aktif',
                note: 'Tenant terverifikasi'),
            _Metric(
                icon: Icons.point_of_sale_outlined,
                title: 'Terminal',
                value: '$registers tersedia',
                note: 'Perangkat terdaftar'),
            _Metric(
                icon: Icons.schedule_outlined,
                title: 'Shift',
                value: shift == null ? 'Belum dibuka' : 'Aktif',
                note: shift?['shiftNumber']?.toString() ??
                    data['businessDate']?.toString() ??
                    '-'),
            const _Metric(
                icon: Icons.print_outlined,
                title: 'Printer',
                value: 'Periksa lokal',
                note: 'Gunakan tombol uji printer'),
            const _Metric(
                icon: Icons.qr_code_scanner_outlined,
                title: 'Scanner',
                value: 'Siap input',
                note: 'Pemindai bertindak sebagai keyboard')
          ]))
    ]);
  }
}

class _Metric extends StatelessWidget {
  const _Metric(
      {required this.icon,
      required this.title,
      required this.value,
      required this.note});
  final IconData icon;
  final String title, value, note;
  @override
  Widget build(BuildContext context) => Container(
      padding: const EdgeInsets.all(18),
      decoration: hiasanKartu(),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, color: Warna.utama),
        const Spacer(),
        Text(title, style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(value,
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
        Text(note, style: const TextStyle(fontSize: 12, color: Warna.teksRedup))
      ]));
}

class _PageTitle extends StatelessWidget {
  const _PageTitle(
      {required this.title, required this.subtitle, required this.onRefresh});
  final String title, subtitle;
  final VoidCallback onRefresh;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.fromLTRB(18, 16, 18, 10),
      child: Row(children: [
        Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style:
                  const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          Text(subtitle, style: const TextStyle(color: Warna.teksRedup))
        ])),
        IconButton(
            onPressed: onRefresh,
            tooltip: 'Perbarui',
            icon: const Icon(Icons.refresh))
      ]));
}

class _ErrorPanel extends StatelessWidget {
  const _ErrorPanel({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;
  @override
  Widget build(BuildContext context) => Center(
      child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 460),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off_outlined, size: 44, color: Warna.merah),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 14),
            FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Coba lagi'))
          ])));
}
