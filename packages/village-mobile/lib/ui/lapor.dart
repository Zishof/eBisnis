/// Layar pengaduan.
///
/// ## Yang paling penting pada layar ini bukan formulirnya
///
/// Melainkan **kalimat tentang nama.** Presentasi menjanjikan "lapor masalah
/// desa"; warga yang mengadukan perangkat desanya sendiri perlu tahu persis
/// siapa yang akan melihat namanya.
///
/// Aplikasi ini memakai akun, sehingga peladen selalu tahu siapa yang mengirim.
/// Menyebut pilihan keduanya "anonim" adalah janji yang tidak dapat ditepati.
/// Karena itu pilihannya bernama "jangan tampilkan nama saya", uraiannya
/// menyatakan terus terang bahwa petugas tetap melihatnya, dan warga yang
/// memang memerlukan anonim sungguhan diarahkan ke anjungan kantor desa.
library;

import 'package:flutter/material.dart';

import '../domain/rules.dart';
import 'shared.dart';

class LayarLapor extends StatefulWidget {
  const LayarLapor({super.key, required this.onKirim});

  /// Mengembalikan pesan dari peladen bila berhasil.
  final Future<String> Function({
    required String judul,
    required String uraian,
    required bool tampilkanNama,
    String? tempat,
  }) onKirim;

  @override
  State<LayarLapor> createState() => _LayarLaporState();
}

class _LayarLaporState extends State<LayarLapor> {
  final _judul = TextEditingController();
  final _uraian = TextEditingController();
  final _tempat = TextEditingController();
  ModeNama _mode = ModeNama.cantumkan;
  bool _mengirim = false;
  String? _galat;
  String? _berhasil;

  @override
  void dispose() {
    _judul.dispose();
    _uraian.dispose();
    _tempat.dispose();
    super.dispose();
  }

  Future<void> _kirim() async {
    final p = Pengaduan(
      judul: _judul.text,
      uraian: _uraian.text,
      modeNama: _mode,
      sumberLokasi: SumberLokasi.ditunjukWarga,
      keteranganLokasi: _tempat.text,
    );
    final periksa = periksaPengaduan(p);
    if (!periksa.bolehkah) {
      setState(() => _galat = periksa.alasan);
      return;
    }

    setState(() {
      _mengirim = true;
      _galat = null;
    });
    try {
      final pesan = await widget.onKirim(
        judul: _judul.text.trim(),
        uraian: _uraian.text.trim(),
        tampilkanNama: _mode == ModeNama.cantumkan,
        tempat: _tempat.text.trim().isEmpty ? null : _tempat.text.trim(),
      );
      if (mounted) setState(() => _berhasil = pesan);
    } catch (e) {
      // Isian TIDAK dikosongkan. Sinyal di desa putus-putus, dan warga yang
      // kehilangan tulisannya karena pengiriman gagal tidak akan mengetiknya
      // lagi.
      if (mounted) setState(() => _galat = e.toString());
    } finally {
      if (mounted) setState(() => _mengirim = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;

    if (_berhasil != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle_outline_rounded, size: 64, color: Colors.green),
            const SizedBox(height: 16),
            Text('Laporan terkirim', style: teks.headlineSmall),
            const SizedBox(height: 12),
            Text(_berhasil!, textAlign: TextAlign.center, style: teks.bodyLarge),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Selesai'),
            ),
          ],
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        TextField(
          controller: _judul,
          maxLength: 300,
          decoration: const InputDecoration(
            labelText: 'Laporan Anda tentang apa?',
            hintText: 'Contoh: Jalan berlubang depan masjid',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _uraian,
          maxLines: 5,
          decoration: const InputDecoration(
            labelText: 'Ceritakan lebih lengkap',
            border: OutlineInputBorder(),
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _tempat,
          decoration: const InputDecoration(
            labelText: 'Di mana kejadiannya?',
            // Tempat KEJADIAN, bukan posisi ponsel. Melampirkan GPS otomatis
            // berarti melacak di mana warga berada setiap kali ia melapor —
            // dan salah, sebab orang biasanya melapor sesudah sampai rumah.
            hintText: 'Contoh: depan masjid RT 03',
            border: OutlineInputBorder(),
          ),
        ),

        const SizedBox(height: 24),
        Text('Nama Anda', style: teks.titleMedium),
        const SizedBox(height: 8),
        ...ModeNama.values.map((m) {
          final p = pesanMode[m]!;
          return RadioListTile<ModeNama>(
            value: m,
            groupValue: _mode,
            onChanged: (v) => setState(() => _mode = v!),
            title: Text(p.judul),
            subtitle: Text(p.uraian),
            isThreeLine: true,
            contentPadding: EdgeInsets.zero,
          );
        }),

        if (_galat != null) ...[
          const SizedBox(height: 16),
          Catatan(_galat!, ikon: Icons.error_outline_rounded),
        ],

        const SizedBox(height: 24),
        FilledButton(
          onPressed: _mengirim ? null : _kirim,
          child: Text(_mengirim ? 'Mengirim…' : 'Kirim Laporan'),
        ),
      ],
    );
  }
}
