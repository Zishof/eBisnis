/// Layar Jadwal Posyandu.
///
/// ## Layar ini menampilkan tiga keadaan, bukan dua
///
/// Kebanyakan layar hanya punya "ada isi" dan "gagal". Layar ini punya keadaan
/// ketiga yang lebih sering terjadi daripada keduanya: **belum tersambung**.
///
/// Sistem kesehatan desa (eMedik) adalah vertikal tersendiri. Sampai desa
/// menghubungkannya, jadwal Posyandu memang belum dapat dibaca — dan itu bukan
/// kerusakan, bukan pula "tidak ada jadwal".
///
/// Menampilkannya sebagai galat membuat warga mengira aplikasinya rusak lalu
/// berhenti membukanya. Menampilkannya sebagai kosong membuat ibu-ibu
/// menyimpulkan Posyandu bulan ini ditiadakan, lalu tidak datang membawa
/// balitanya. Keduanya salah, dan yang kedua lebih berbahaya.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/api_client.dart';
import '../data/village_api.dart';
import '../domain/rules.dart';
import 'shared.dart';

class LayarPosyandu extends StatefulWidget {
  const LayarPosyandu({super.key, required this.api});
  final VillageApi api;

  @override
  State<LayarPosyandu> createState() => _LayarPosyanduState();
}

class _LayarPosyanduState extends State<LayarPosyandu> {
  Hasil<JadwalPosyandu> _data = const Hasil.memuat();

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() => _data = const Hasil.memuat());
    try {
      final d = await widget.api.posyandu();
      if (mounted) setState(() => _data = Hasil.isi(d));
    } on ApiError catch (e) {
      if (mounted) setState(() => _data = Hasil.galat(e));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Jadwal Posyandu')),
        body: RefreshIndicator(
          onRefresh: _muat,
          child: _bangun(),
        ),
      );

  Widget _bangun() {
    if (_data.sedangMemuat) return const MemuatState();
    // Galat jaringan tetap galat: itu memang dapat diperbaiki warga dengan
    // pindah tempat, dan berbeda dari kanal yang belum tersambung.
    if (_data.galat != null) return GalatState(galat: _data.galat!, onCobaLagi: _muat);

    final d = _data.data!;
    final t = tilikPosyandu(tersedia: d.tersedia, adaIsi: d.jadwal.isNotEmpty);

    if (t.keadaan == KeadaanKanal.belumTersambung) {
      return _BelumTersambung(tilikan: t, keteranganPeladen: d.keterangan);
    }
    if (d.jadwal.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(24),
        children: [KosongState(judul: t.judul, uraian: t.uraian)],
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: d.jadwal.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (_, i) => _KartuJadwal(j: d.jadwal[i]),
    );
  }
}

/// Keadaan ketiga: kanalnya belum tersambung.
///
/// Sengaja **tidak** memakai warna galat dan tidak memakai ikon peringatan.
/// Warna merah membuat warga mengira ada yang rusak; yang perlu ia rasakan
/// adalah "fiturnya belum siap, dan ini yang bisa saya lakukan sementara".
class _BelumTersambung extends StatelessWidget {
  const _BelumTersambung({required this.tilikan, this.keteranganPeladen});
  final TilikanKanal tilikan;
  final String? keteranganPeladen;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final warna = Theme.of(context).colorScheme;

    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const SizedBox(height: 32),
        Icon(Icons.link_off_rounded, size: 56, color: warna.onSurfaceVariant),
        const SizedBox(height: 20),
        Text(tilikan.judul, textAlign: TextAlign.center, style: teks.titleLarge),
        const SizedBox(height: 12),
        Text(tilikan.uraian, textAlign: TextAlign.center, style: teks.bodyLarge),
        if (tilikan.saran != null) ...[
          const SizedBox(height: 24),
          Catatan(tilikan.saran!, ikon: Icons.lightbulb_outline_rounded),
        ],
        // Keterangan peladen ditampilkan apa adanya di bawah. Ia ditulis untuk
        // dibaca manusia, dan menyembunyikannya berarti membuang satu-satunya
        // keterangan yang tahu persis kanal mana yang belum siap.
        if (keteranganPeladen != null && keteranganPeladen!.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(
            keteranganPeladen!,
            textAlign: TextAlign.center,
            style: teks.bodySmall?.copyWith(color: warna.onSurfaceVariant),
          ),
        ],
      ],
    );
  }
}

class _KartuJadwal extends StatelessWidget {
  const _KartuJadwal({required this.j});
  final Map<String, dynamic> j;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final tanggal = j['date']?.toString();
    final pos = (j['postName'] ?? '-') as String;
    final kegiatan = j['activity']?.toString();
    final dusun = j['subAreaName']?.toString();

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.child_care_rounded, size: 28),
                const SizedBox(width: 12),
                Expanded(child: Text(pos, style: teks.titleMedium)),
              ],
            ),
            if (tanggal != null) ...[
              const SizedBox(height: 8),
              Text(_tanggal(tanggal), style: teks.bodyLarge),
            ],
            if (kegiatan != null && kegiatan.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(kegiatan, style: teks.bodyMedium),
            ],
            if (dusun != null && dusun.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(dusun, style: teks.bodySmall),
            ],
          ],
        ),
      ),
    );
  }
}

String _tanggal(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : DateFormat('EEEE, d MMMM yyyy', 'id_ID').format(d.toLocal());
}
