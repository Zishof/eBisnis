import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const SecurityGateApp());
}

class SecurityGateApp extends StatelessWidget {
  const SecurityGateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gerbang Santri',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF00796B)),
        useMaterial3: true,
      ),
      home: const GateHomePage(),
    );
  }
}

class GateHomePage extends StatefulWidget {
  const GateHomePage({super.key});

  @override
  State<GateHomePage> createState() => _GateHomePageState();
}

class _GateHomePageState extends State<GateHomePage> {
  final settings = GateSettings();
  final cardController = TextEditingController();
  final noteController = TextEditingController();
  GateScanResult? scanResult;
  String direction = 'KELUAR';
  String? selectedPermitId;
  bool busy = false;
  bool listBusy = false;
  String? message;
  String? listMessage;
  final history = <GateLog>[];
  final activePermits = <GatePermit>[];

  @override
  void initState() {
    super.initState();
    Future<void>.microtask(loadActivePermits);
  }

  @override
  void dispose() {
    cardController.dispose();
    noteController.dispose();
    super.dispose();
  }

  Future<void> scanCard() async {
    final cardNumber = cardController.text.trim();
    if (cardNumber.isEmpty) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      final result = await settings.get<GateScanResult>(
        '/pesantren/gerbang/kartu/${Uri.encodeComponent(cardNumber)}',
        GateScanResult.fromJson,
      );
      setState(() {
        scanResult = result;
        selectedPermitId = result.activePermits.isEmpty ? null : result.activePermits.first.id;
        final firstPermit = result.activePermits.isEmpty ? null : result.activePermits.first;
        direction = firstPermit?.lastDirection == 'KELUAR' ? 'MASUK' : 'KELUAR';
      });
    } catch (error) {
      setState(() => message = '$error');
    } finally {
      setState(() => busy = false);
    }
  }

  Future<void> loadActivePermits() async {
    setState(() {
      listBusy = true;
      listMessage = null;
    });
    try {
      final permits = await settings.getList<GatePermit>('/pesantren/gerbang/izin-aktif', GatePermit.fromJson);
      setState(() {
        activePermits
          ..clear()
          ..addAll(permits);
      });
    } catch (error) {
      setState(() => listMessage = '$error');
    } finally {
      setState(() => listBusy = false);
    }
  }

  Future<void> pickPermitFromList(GatePermit permit) async {
    setState(() {
      selectedPermitId = permit.id;
      direction = permit.lastDirection == 'KELUAR' ? 'MASUK' : 'KELUAR';
      if (permit.cardNumber != null && permit.cardNumber!.isNotEmpty) {
        cardController.text = permit.cardNumber!;
      }
    });
    if (permit.cardNumber != null && permit.cardNumber!.isNotEmpty) {
      await scanCard();
    }
  }

  Future<void> recordGate() async {
    final permitId = selectedPermitId;
    if (permitId == null) return;
    setState(() {
      busy = true;
      message = null;
    });
    try {
      final log = await settings.post<GateLog>(
        '/pesantren/gerbang',
        {
          'izinId': permitId,
          'arah': direction,
          'catatan': noteController.text.trim(),
        },
        GateLog.fromJson,
      );
      setState(() {
        history.insert(0, log);
        message = 'Lintasan ${direction.toLowerCase()} tersimpan.';
        noteController.clear();
      });
      await loadActivePermits();
      await scanCard();
    } catch (error) {
      setState(() => message = '$error');
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Gerbang Santri'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(icon: Icon(Icons.list_alt), text: 'Daftar'),
              Tab(icon: Icon(Icons.qr_code_scanner), text: 'Scan'),
              Tab(icon: Icon(Icons.history), text: 'Riwayat'),
              Tab(icon: Icon(Icons.settings), text: 'Pengaturan'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            ActivePermitsTab(
              permits: activePermits,
              busy: listBusy,
              message: listMessage,
              onRefresh: loadActivePermits,
              onPick: pickPermitFromList,
            ),
            ScanTab(
              cardController: cardController,
              noteController: noteController,
              result: scanResult,
              selectedPermitId: selectedPermitId,
              direction: direction,
              busy: busy,
              message: message,
              onPermitChanged: (value) => setState(() => selectedPermitId = value),
              onDirectionChanged: (value) => setState(() => direction = value),
              onScan: scanCard,
              onRecord: recordGate,
            ),
            HistoryTab(history: history),
            SettingsTab(settings: settings, onChanged: () => setState(() {})),
          ],
        ),
      ),
    );
  }
}

class ScanTab extends StatelessWidget {
  const ScanTab({
    super.key,
    required this.cardController,
    required this.noteController,
    required this.result,
    required this.selectedPermitId,
    required this.direction,
    required this.busy,
    required this.message,
    required this.onPermitChanged,
    required this.onDirectionChanged,
    required this.onScan,
    required this.onRecord,
  });

  final TextEditingController cardController;
  final TextEditingController noteController;
  final GateScanResult? result;
  final String? selectedPermitId;
  final String direction;
  final bool busy;
  final String? message;
  final ValueChanged<String?> onPermitChanged;
  final ValueChanged<String> onDirectionChanged;
  final VoidCallback onScan;
  final VoidCallback onRecord;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: cardController,
          autofocus: true,
          decoration: const InputDecoration(
            border: OutlineInputBorder(),
            labelText: 'Nomor kartu / scanner RFID',
          ),
          onSubmitted: (_) => onScan(),
        ),
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: busy ? null : onScan,
          icon: const Icon(Icons.search),
          label: const Text('Cari Kartu'),
        ),
        if (message != null) ...[
          const SizedBox(height: 12),
          Text(message!, style: TextStyle(color: Theme.of(context).colorScheme.primary)),
        ],
        if (result != null) ...[
          const SizedBox(height: 16),
          Card(
            child: ListTile(
              title: Text(result!.studentName),
              subtitle: Text('NIS ${result!.nis} - ${result!.cardNumber}'),
              trailing: Chip(label: Text(result!.studentStatus)),
            ),
          ),
          DropdownButtonFormField<String>(
            value: selectedPermitId,
            items: result!.activePermits
                .map((permit) => DropdownMenuItem(value: permit.id, child: Text('${permit.kind} - ${permit.reason}')))
                .toList(),
            onChanged: busy ? null : onPermitChanged,
            decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Izin aktif'),
          ),
          const SizedBox(height: 12),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'KELUAR', icon: Icon(Icons.logout), label: Text('Keluar')),
              ButtonSegment(value: 'MASUK', icon: Icon(Icons.login), label: Text('Masuk')),
            ],
            selected: {direction},
            onSelectionChanged: busy ? null : (values) => onDirectionChanged(values.first),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: noteController,
            decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Catatan'),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: busy || selectedPermitId == null ? null : onRecord,
            icon: Icon(direction == 'KELUAR' ? Icons.door_front_door_outlined : Icons.door_back_door_outlined),
            label: Text('Catat ${direction == 'KELUAR' ? 'Keluar' : 'Masuk'}'),
          ),
        ],
      ],
    );
  }
}

class HistoryTab extends StatelessWidget {
  const HistoryTab({super.key, required this.history});

  final List<GateLog> history;

  @override
  Widget build(BuildContext context) {
    if (history.isEmpty) {
      return const Center(child: Text('Belum ada lintasan dari perangkat ini.'));
    }
    return ListView.builder(
      itemCount: history.length,
      itemBuilder: (context, index) {
        final item = history[index];
        return ListTile(
          leading: Icon(item.direction == 'KELUAR' ? Icons.logout : Icons.login),
          title: Text(item.studentName ?? item.permitId),
          subtitle: Text('${item.direction} - ${item.recordedAt}'),
        );
      },
    );
  }
}

class ActivePermitsTab extends StatelessWidget {
  const ActivePermitsTab({
    super.key,
    required this.permits,
    required this.busy,
    required this.message,
    required this.onRefresh,
    required this.onPick,
  });

  final List<GatePermit> permits;
  final bool busy;
  final String? message;
  final Future<void> Function() onRefresh;
  final Future<void> Function(GatePermit permit) onPick;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          FilledButton.icon(
            onPressed: busy ? null : onRefresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Muat Izin Aktif Hari Ini'),
          ),
          if (message != null) ...[
            const SizedBox(height: 12),
            Text(message!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 12),
          if (permits.isEmpty)
            const Card(
              child: ListTile(
                title: Text('Belum ada izin aktif'),
                subtitle: Text('Tarik ke bawah atau tekan tombol muat untuk memperbarui daftar.'),
              ),
            )
          else
            ...permits.map(
              (permit) => Card(
                child: ListTile(
                  title: Text(permit.studentName ?? permit.reason),
                  subtitle: Text([
                    if (permit.nis != null) 'NIS ${permit.nis}',
                    permit.kind,
                    if (permit.cardNumber != null) permit.cardNumber!,
                    if (permit.lastDirection != null) 'terakhir ${permit.lastDirection}',
                  ].join(' - ')),
                  trailing: FilledButton(
                    onPressed: busy ? null : () => onPick(permit),
                    child: const Text('Pilih'),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SettingsTab extends StatelessWidget {
  const SettingsTab({super.key, required this.settings, required this.onChanged});

  final GateSettings settings;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextFormField(
          initialValue: settings.apiBaseUrl,
          decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'API Base URL'),
          onChanged: (value) {
            settings.apiBaseUrl = value.trim();
            onChanged();
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: settings.accessToken,
          decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Access token perangkat/petugas'),
          obscureText: true,
          onChanged: (value) {
            settings.accessToken = value.trim();
            onChanged();
          },
        ),
        const SizedBox(height: 12),
        TextFormField(
          initialValue: settings.deviceId,
          decoration: const InputDecoration(border: OutlineInputBorder(), labelText: 'Device ID'),
          onChanged: (value) {
            settings.deviceId = value.trim();
            onChanged();
          },
        ),
      ],
    );
  }
}

class GateSettings {
  String apiBaseUrl = 'https://raudlatul-ulum.santri.info/api/v1';
  String accessToken = '';
  String deviceId = 'security-gate-01';

  Future<T> get<T>(String path, T Function(Map<String, dynamic>) mapper) async {
    final response = await http.get(_uri(path), headers: _headers);
    return _decode(response, mapper);
  }

  Future<List<T>> getList<T>(String path, T Function(Map<String, dynamic>) mapper) async {
    final response = await http.get(_uri(path), headers: _headers);
    final payload = _decodeRaw(response);
    final data = payload['data'];
    if (data is! List) throw Exception('Jawaban server bukan daftar.');
    return data.cast<Map<String, dynamic>>().map(mapper).toList();
  }

  Future<T> post<T>(String path, Map<String, dynamic> body, T Function(Map<String, dynamic>) mapper) async {
    final response = await http.post(_uri(path), headers: _headers, body: jsonEncode(body));
    return _decode(response, mapper);
  }

  Uri _uri(String path) => Uri.parse('$apiBaseUrl$path');

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId,
        if (accessToken.isNotEmpty) 'Authorization': 'Bearer $accessToken',
      };

  T _decode<T>(http.Response response, T Function(Map<String, dynamic>) mapper) {
    final payload = _decodeRaw(response);
    return mapper(payload['data'] as Map<String, dynamic>);
  }

  Map<String, dynamic> _decodeRaw(http.Response response) {
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode < 200 || response.statusCode >= 300 || payload['success'] == false) {
      final error = payload['error'] as Map<String, dynamic>?;
      throw Exception(error?['message'] ?? 'Gagal menghubungi server.');
    }
    return payload;
  }
}

class GateScanResult {
  GateScanResult({
    required this.studentName,
    required this.nis,
    required this.studentStatus,
    required this.cardNumber,
    required this.activePermits,
  });

  final String studentName;
  final String nis;
  final String studentStatus;
  final String cardNumber;
  final List<GatePermit> activePermits;

  factory GateScanResult.fromJson(Map<String, dynamic> json) {
    final student = json['santri'] as Map<String, dynamic>;
    final card = json['kartu'] as Map<String, dynamic>;
    final permits = (json['izinAktif'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(GatePermit.fromJson)
        .toList();
    return GateScanResult(
      studentName: student['nama_lengkap'] as String,
      nis: student['nis'] as String,
      studentStatus: student['status'] as String,
      cardNumber: card['nomor_kartu'] as String,
      activePermits: permits,
    );
  }
}

class GatePermit {
  GatePermit({
    required this.id,
    required this.kind,
    required this.reason,
    this.lastDirection,
    this.studentName,
    this.nis,
    this.cardNumber,
  });

  final String id;
  final String kind;
  final String reason;
  final String? lastDirection;
  final String? studentName;
  final String? nis;
  final String? cardNumber;

  factory GatePermit.fromJson(Map<String, dynamic> json) => GatePermit(
        id: json['id'] as String,
        kind: json['jenis'] as String,
        reason: json['alasan'] as String,
        lastDirection: json['lintasan_terakhir'] as String?,
        studentName: json['nama_lengkap'] as String?,
        nis: json['nis'] as String?,
        cardNumber: json['nomor_kartu'] as String?,
      );
}

class GateLog {
  GateLog({required this.permitId, required this.direction, required this.recordedAt, this.studentName});

  final String permitId;
  final String direction;
  final String recordedAt;
  final String? studentName;

  factory GateLog.fromJson(Map<String, dynamic> json) => GateLog(
        permitId: json['izin_id'] as String,
        direction: json['arah'] as String,
        recordedAt: json['waktu'] as String,
        studentName: json['nama_lengkap'] as String?,
      );
}
