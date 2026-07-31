/// Layar Pengumuman.
///
/// Presentasi: *"Informasi & pengumuman — Jadwal Posyandu, bantuan, dan
/// kegiatan desa."* Tiga bagian itu ada di sini; jadwal Posyandu punya layarnya
/// sendiri karena datangnya dari vertikal kesehatan.
///
/// ## Program bantuan ditampilkan, penerimanya tidak
///
/// Aturan yang sama dengan anjungan dan situs publik. Daftar penerima pada
/// aplikasi yang dipegang seluruh warga adalah pengumuman siapa yang miskin di
/// desa ini — dan pada aplikasi, ia dapat difoto layar lalu disebarkan.
///
/// Warga yang ingin tahu apakah dirinya termasuk penerima diarahkan ke kantor
/// desa. Itu memang satu langkah lebih panjang, dan itu disengaja.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/api_client.dart';
import '../data/village_api.dart';
import 'shared.dart';

class LayarPengumuman extends StatefulWidget {
  const LayarPengumuman({super.key, required this.api});
  final VillageApi api;

  @override
  State<LayarPengumuman> createState() => _LayarPengumumanState();
}

class _LayarPengumumanState extends State<LayarPengumuman> {
  Hasil<Pengumuman> _data = const Hasil.memuat();

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() => _data = const Hasil.memuat());
    try {
      final d = await widget.api.pengumuman();
      if (mounted) setState(() => _data = Hasil.isi(d));
    } on ApiError catch (e) {
      if (mounted) setState(() => _data = Hasil.galat(e));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Pengumuman')),
        body: RefreshIndicator(
          onRefresh: _muat,
          child: HasilBuilder<Pengumuman>(
            hasil: _data,
            onCobaLagi: _muat,
            apakahKosong: (d) =>
                d.berita.isEmpty && d.agenda.isEmpty && d.programBantuan.isEmpty,
            kosong: const KosongState(
              judul: 'Belum ada pengumuman',
              uraian: 'Pemerintah desa belum menayangkan berita, agenda, maupun program bantuan.',
            ),
            bangun: (d) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                if (d.berita.isNotEmpty) ...[
                  _Judul('Berita'),
                  ...d.berita.map((b) => _KartuBerita(b)),
                  const SizedBox(height: 24),
                ],
                if (d.agenda.isNotEmpty) ...[
                  _Judul('Agenda Kegiatan'),
                  ...d.agenda.map((a) => _KartuAgenda(a)),
                  const SizedBox(height: 24),
                ],
                if (d.programBantuan.isNotEmpty) ...[
                  _Judul('Program Bantuan'),
                  ...d.programBantuan.map((p) => _KartuBantuan(p)),
                  const SizedBox(height: 12),
                  // Dinyatakan terus terang, bukan dibiarkan warga menebak
                  // mengapa namanya tidak ada di mana pun.
                  const Catatan(
                    'Daftar penerima tidak ditampilkan di aplikasi. Untuk menanyakan apakah '
                    'Anda termasuk penerima, silakan ke kantor desa.',
                    ikon: Icons.privacy_tip_outlined,
                  ),
                ],
              ],
            ),
          ),
        ),
      );
}

class _Judul extends StatelessWidget {
  const _Judul(this.teks);
  final String teks;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Text(teks, style: Theme.of(context).textTheme.titleLarge),
      );
}

class _KartuBerita extends StatelessWidget {
  const _KartuBerita(this.b);
  final Berita b;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(b.judul, style: teks.titleMedium),
            if (b.tayangPada != null) ...[
              const SizedBox(height: 4),
              Text(_tanggal(b.tayangPada!), style: teks.bodySmall),
            ],
            if (b.ringkas != null && b.ringkas!.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(b.ringkas!, style: teks.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}

class _KartuAgenda extends StatelessWidget {
  const _KartuAgenda(this.a);
  final Agenda a;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const Icon(Icons.event_rounded, size: 32),
        title: Text(a.judul, style: teks.titleMedium),
        subtitle: Text(
          [_waktu(a.mulai), if (a.tempat != null && a.tempat!.isNotEmpty) a.tempat!]
              .join(' · '),
        ),
        isThreeLine: a.tempat != null && a.tempat!.isNotEmpty,
      ),
    );
  }
}

class _KartuBantuan extends StatelessWidget {
  const _KartuBantuan(this.p);
  final ProgramBantuan p;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(p.nama, style: teks.titleMedium),
            const SizedBox(height: 4),
            Text(p.jenis, style: teks.bodySmall),
            if (p.mulai != null) ...[
              const SizedBox(height: 8),
              Text(
                p.selesai != null
                    ? 'Berlaku ${_tanggal(p.mulai!)} sampai ${_tanggal(p.selesai!)}'
                    : 'Mulai ${_tanggal(p.mulai!)}',
                style: teks.bodyMedium,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Tanggal yang gagal diurai ditampilkan apa adanya, bukan sebagai tanggal
/// karangan. Peladen yang mengirim bentuk lain tidak boleh membuat aplikasi
/// menampilkan tanggal yang salah dengan yakin.
String _tanggal(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : DateFormat('d MMMM yyyy', 'id_ID').format(d.toLocal());
}

String _waktu(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : DateFormat('EEEE, d MMM yyyy · HH.mm', 'id_ID').format(d.toLocal());
}
