/// Layar Ajukan Surat.
///
/// Presentasi menjanjikan dua hal sekaligus: *"Ajukan surat & pantau
/// statusnya — tanpa antre, cukup dari rumah."* Karena itu layar ini punya dua
/// tab: mengajukan, dan memantau yang sudah diajukan.
///
/// ## Kode ambil ditampilkan sebesar mungkin
///
/// Inilah yang menyambungkan "ajukan dari rumah" dengan "cetak sendiri di
/// anjungan". Warga yang kehilangan kodenya harus mengantre — persis yang
/// hendak dihindari aplikasi ini. Karena itu kodenya besar, dapat disalin, dan
/// tetap dapat dilihat kembali dari daftar permohonan.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../data/api_client.dart';
import '../data/village_api.dart';
import '../domain/rules.dart';
import 'shared.dart';

class LayarAjukanSurat extends StatefulWidget {
  const LayarAjukanSurat({super.key, required this.api});
  final VillageApi api;

  @override
  State<LayarAjukanSurat> createState() => _LayarAjukanSuratState();
}

class _LayarAjukanSuratState extends State<LayarAjukanSurat>
    with SingleTickerProviderStateMixin {
  late final TabController _tab = TabController(length: 2, vsync: this);

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Ajukan Surat'),
          bottom: TabBar(
            controller: _tab,
            tabs: const [
              Tab(text: 'Ajukan Baru'),
              Tab(text: 'Permohonan Saya'),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tab,
          children: [
            _FormAjukan(api: widget.api, onSelesai: () => _tab.animateTo(1)),
            _DaftarPermohonan(api: widget.api),
          ],
        ),
      );
}

// --- Tab 1: mengajukan -------------------------------------------------------

class _FormAjukan extends StatefulWidget {
  const _FormAjukan({required this.api, required this.onSelesai});
  final VillageApi api;
  final VoidCallback onSelesai;

  @override
  State<_FormAjukan> createState() => _FormAjukanState();
}

class _FormAjukanState extends State<_FormAjukan> {
  Hasil<List<JenisLayanan>> _jenis = const Hasil.memuat();
  final _keperluan = TextEditingController();
  String? _dipilih;
  bool _mengirim = false;
  String? _galat;
  Map<String, dynamic>? _berhasil;

  @override
  void initState() {
    super.initState();
    _muat();
  }

  @override
  void dispose() {
    _keperluan.dispose();
    super.dispose();
  }

  Future<void> _muat() async {
    setState(() => _jenis = const Hasil.memuat());
    try {
      final d = await widget.api.jenisLayanan();
      if (mounted) setState(() => _jenis = Hasil.isi(d));
    } on ApiError catch (e) {
      if (mounted) setState(() => _jenis = Hasil.galat(e));
    }
  }

  Future<void> _kirim() async {
    if (_dipilih == null) {
      setState(() => _galat = 'Pilih jenis surat yang Anda perlukan.');
      return;
    }
    setState(() {
      _mengirim = true;
      _galat = null;
    });
    try {
      final r = await widget.api.ajukanSurat(
        jenisLayananId: _dipilih!,
        keperluan: _keperluan.text.trim().isEmpty ? null : _keperluan.text.trim(),
      );
      if (mounted) setState(() => _berhasil = r);
    } catch (e) {
      // Pilihan dan keperluan TIDAK dikosongkan: sinyal desa putus-putus, dan
      // warga yang harus mengisi ulang akan berhenti mencoba.
      if (mounted) setState(() => _galat = e.toString());
    } finally {
      if (mounted) setState(() => _mengirim = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_berhasil != null) return _Berhasil(hasil: _berhasil!, onSelesai: widget.onSelesai);

    return HasilBuilder<List<JenisLayanan>>(
      hasil: _jenis,
      onCobaLagi: _muat,
      apakahKosong: (d) => d.isEmpty,
      kosong: const KosongState(
        judul: 'Belum ada jenis surat',
        uraian: 'Pemerintah desa belum menyiapkan jenis layanan yang dapat diajukan daring.',
      ),
      bangun: (daftar) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Text('Jenis surat', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          ...daftar.map(
            (j) => RadioListTile<String>(
              value: j.id,
              groupValue: _dipilih,
              onChanged: (v) => setState(() => _dipilih = v),
              title: Text(j.nama),
              contentPadding: EdgeInsets.zero,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _keperluan,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Untuk keperluan apa?',
              hintText: 'Contoh: melamar pekerjaan',
              border: OutlineInputBorder(),
              alignLabelWithHint: true,
            ),
          ),
          if (_galat != null) ...[
            const SizedBox(height: 16),
            Catatan(_galat!, ikon: Icons.error_outline_rounded),
          ],
          const SizedBox(height: 16),
          const Catatan(
            'Bawa fotokopi KTP dan KK ke kantor desa untuk melengkapi berkas. Setelah surat '
            'terbit, Anda dapat mencetaknya sendiri di anjungan dengan kode ambil.',
            ikon: Icons.badge_outlined,
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: _mengirim ? null : _kirim,
            child: Text(_mengirim ? 'Mengirim…' : 'Ajukan'),
          ),
        ],
      ),
    );
  }
}

class _Berhasil extends StatelessWidget {
  const _Berhasil({required this.hasil, required this.onSelesai});
  final Map<String, dynamic> hasil;
  final VoidCallback onSelesai;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final kode = (hasil['claimDisplay'] ?? hasil['claimCode'] ?? '') as String;

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 24),
        const Icon(Icons.check_circle_outline_rounded, size: 64, color: Colors.green),
        const SizedBox(height: 16),
        Text('Permohonan terkirim', textAlign: TextAlign.center, style: teks.headlineSmall),
        const SizedBox(height: 24),

        if (kode.isNotEmpty) ...[
          Text('Kode ambil Anda', textAlign: TextAlign.center, style: teks.titleMedium),
          const SizedBox(height: 12),
          // Sebesar mungkin, dan dapat disalin. Warga yang kehilangan kodenya
          // harus mengantre — persis yang hendak dihindari aplikasi ini.
          SelectableText(
            kode,
            textAlign: TextAlign.center,
            style: teks.displaySmall?.copyWith(
              fontFamily: 'monospace',
              fontWeight: FontWeight.bold,
              letterSpacing: 4,
            ),
          ),
          const SizedBox(height: 12),
          Center(
            child: OutlinedButton.icon(
              onPressed: () {
                Clipboard.setData(ClipboardData(text: kode));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Kode disalin')),
                );
              },
              icon: const Icon(Icons.copy_rounded),
              label: const Text('Salin kode'),
            ),
          ),
          const SizedBox(height: 24),
        ],

        Catatan((hasil['note'] as String?) ?? 'Permohonan Anda sudah masuk.'),
        const SizedBox(height: 24),
        FilledButton(onPressed: onSelesai, child: const Text('Lihat permohonan saya')),
      ],
    );
  }
}

// --- Tab 2: memantau ---------------------------------------------------------

class _DaftarPermohonan extends StatefulWidget {
  const _DaftarPermohonan({required this.api});
  final VillageApi api;

  @override
  State<_DaftarPermohonan> createState() => _DaftarPermohonanState();
}

class _DaftarPermohonanState extends State<_DaftarPermohonan> {
  Hasil<List<Permohonan>> _daftar = const Hasil.memuat();

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() => _daftar = const Hasil.memuat());
    try {
      final d = await widget.api.permohonanSaya();
      if (mounted) setState(() => _daftar = Hasil.isi(d));
    } on ApiError catch (e) {
      if (mounted) setState(() => _daftar = Hasil.galat(e));
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
        onRefresh: _muat,
        child: HasilBuilder<List<Permohonan>>(
          hasil: _daftar,
          onCobaLagi: _muat,
          apakahKosong: (d) => d.isEmpty,
          kosong: const KosongState(
            judul: 'Belum ada permohonan',
            uraian: 'Permohonan yang Anda ajukan akan muncul di sini beserta perkembangannya.',
          ),
          bangun: (daftar) => ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: daftar.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (_, i) => _KartuPermohonan(p: daftar[i]),
          ),
        ),
      );
}

class _KartuPermohonan extends StatelessWidget {
  const _KartuPermohonan({required this.p});
  final Permohonan p;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final tindakan = tindakanDari(p.status);

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.nomor ?? 'Nomor belum terbit', style: teks.titleMedium),
            const SizedBox(height: 6),
            // Label yang dapat dibaca, bukan kode dalam huruf besar. Warga yang
            // membaca MENUNGGU_PERSETUJUAN tidak tahu apakah ia harus menunggu
            // atau datang ke kantor.
            Row(
              children: [
                Icon(_ikonStatus(p.status), size: 18, color: _warnaStatus(context, p.status)),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    labelDari(p.status),
                    style: teks.bodyLarge?.copyWith(color: _warnaStatus(context, p.status)),
                  ),
                ),
              ],
            ),
            // Status saja tidak cukup: "Berkas belum lengkap" tanpa keterangan
            // membuat warga menunggu sesuatu yang tidak akan datang.
            if (tindakan != null) ...[
              const SizedBox(height: 12),
              Catatan(tindakan, ikon: Icons.arrow_forward_rounded),
            ],
          ],
        ),
      ),
    );
  }

  IconData _ikonStatus(String? s) => switch (s) {
        'DITERBITKAN' || 'DISERAHKAN' => Icons.check_circle_outline_rounded,
        'DITOLAK' || 'DIBATALKAN' => Icons.cancel_outlined,
        'BERKAS_KURANG' => Icons.pending_actions_rounded,
        _ => Icons.hourglass_top_rounded,
      };

  Color _warnaStatus(BuildContext c, String? s) {
    final w = Theme.of(c).colorScheme;
    return switch (s) {
      'DITERBITKAN' || 'DISERAHKAN' => Colors.green.shade700,
      'DITOLAK' || 'DIBATALKAN' => w.error,
      'BERKAS_KURANG' => Colors.orange.shade800,
      _ => w.onSurfaceVariant,
    };
  }
}
