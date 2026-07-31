/// Layar Info Bantuan.
///
/// ## Yang membuatnya layar tersendiri, bukan bagian Pengumuman
///
/// Pengumuman menampilkan **program apa saja yang dibuka**. Layar ini menjawab
/// pertanyaan yang sebenarnya ditanyakan warga: *"apakah saya termasuk?"*
///
/// Pertanyaan itu hanya dapat dijawab tentang **dirinya sendiri**. Tidak ada
/// daftar penerima lain di sini, dan tidak akan pernah ada: daftar penerima
/// pada aplikasi yang dipegang seluruh warga adalah pengumuman siapa yang
/// miskin di desa ini — dan di aplikasi, ia dapat difoto layar lalu disebarkan.
///
/// ## Alasan penolakan tidak muncul di layar ini
///
/// D-7 menetapkan bahwa warga yang tidak menerima bantuan berhak mendapat
/// jawaban **dari seseorang**. Layar ponsel bukan seseorang.
///
/// Kalimat "penghasilan Anda terlalu tinggi" yang muncul sendirian di layar,
/// tanpa ada yang dapat ditanyai balik, lebih melukai daripada menjelaskan.
/// Layar menyampaikan keputusannya, lalu mengarahkan ke orang yang dapat
/// menjelaskan dan mencatat keberatan.
library;

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../data/api_client.dart';
import '../data/village_api.dart';
import '../domain/rules.dart';
import 'shared.dart';

class LayarBantuan extends StatefulWidget {
  const LayarBantuan({super.key, required this.api});
  final VillageApi api;

  @override
  State<LayarBantuan> createState() => _LayarBantuanState();
}

class _LayarBantuanState extends State<LayarBantuan> {
  Hasil<List<StatusBantuanSaya>> _data = const Hasil.memuat();

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() => _data = const Hasil.memuat());
    try {
      final d = await widget.api.statusBantuanSaya();
      if (mounted) setState(() => _data = Hasil.isi(d));
    } on ApiError catch (e) {
      if (mounted) setState(() => _data = Hasil.galat(e));
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Info Bantuan')),
        body: RefreshIndicator(
          onRefresh: _muat,
          child: HasilBuilder<List<StatusBantuanSaya>>(
            hasil: _data,
            onCobaLagi: _muat,
            apakahKosong: (d) => d.isEmpty,
            kosong: const KosongState(
              judul: 'Belum ada program bantuan',
              uraian: 'Belum ada program bantuan yang dibuka desa untuk saat ini.',
            ),
            bangun: (daftar) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                ...daftar.map((b) => _KartuBantuan(b: b)),
                const SizedBox(height: 8),
                // Dinyatakan sekali di bawah, bukan diulang pada tiap kartu.
                const Catatan(
                  'Yang ditampilkan hanya keadaan Anda sendiri. Daftar penerima lain tidak '
                  'ditampilkan di aplikasi.',
                  ikon: Icons.privacy_tip_outlined,
                ),
              ],
            ),
          ),
        ),
      );
}

class _KartuBantuan extends StatelessWidget {
  const _KartuBantuan({required this.b});
  final StatusBantuanSaya b;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final t = tilikStatusBantuan(b.status);
    final warna = _warna(context, b.status);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(b.namaProgram, style: teks.titleMedium),
            const SizedBox(height: 2),
            Text(b.jenis, style: teks.bodySmall),
            if (b.mulai != null) ...[
              const SizedBox(height: 4),
              Text(
                b.selesai != null
                    ? '${_tanggal(b.mulai!)} — ${_tanggal(b.selesai!)}'
                    : 'Mulai ${_tanggal(b.mulai!)}',
                style: teks.bodySmall,
              ),
            ],

            const Divider(height: 24),

            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(_ikon(b.status), size: 22, color: warna),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(t.judul, style: teks.titleSmall?.copyWith(color: warna)),
                      const SizedBox(height: 4),
                      Text(t.uraian, style: teks.bodyMedium),
                    ],
                  ),
                ),
              ],
            ),

            // Riwayat penyaluran hanya muncul bila ia memang penerima. Inilah
            // yang paling ingin diketahui warga: sudah cair atau belum.
            if (b.penyaluran.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text('Penyaluran', style: teks.titleSmall),
              const SizedBox(height: 8),
              ...b.penyaluran.map(
                (p) => Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline_rounded, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Termin ${p.termin} · ${_tanggal(p.tanggal)}',
                          style: teks.bodyMedium,
                        ),
                      ),
                      Text(_rupiah(p.jumlah), style: teks.bodyMedium),
                    ],
                  ),
                ),
              ),
            ],

            // Diarahkan ke orang, bukan diberi alasan oleh layar.
            if (t.saran != null) ...[
              const SizedBox(height: 16),
              Catatan(t.saran!, ikon: Icons.support_agent_rounded),
            ],
          ],
        ),
      ),
    );
  }

  IconData _ikon(StatusPenerima s) => switch (s) {
        StatusPenerima.penerima => Icons.check_circle_outline_rounded,
        StatusPenerima.sedangDinilai => Icons.hourglass_top_rounded,
        StatusPenerima.bukanPenerima => Icons.info_outline_rounded,
      };

  Color _warna(BuildContext c, StatusPenerima s) => switch (s) {
        StatusPenerima.penerima => Colors.green.shade700,
        StatusPenerima.sedangDinilai => Colors.orange.shade800,
        // Sengaja BUKAN merah. "Belum terdaftar" bukan kesalahan warga, dan
        // warna merah membuatnya terbaca sebagai penolakan yang menghakimi.
        StatusPenerima.bukanPenerima => Theme.of(c).colorScheme.onSurfaceVariant,
      };
}

String _tanggal(String iso) {
  final d = DateTime.tryParse(iso);
  return d == null ? iso : DateFormat('d MMM yyyy', 'id_ID').format(d.toLocal());
}

String _rupiah(String? nilai) {
  if (nilai == null || nilai.isEmpty) return '—';
  final n = double.tryParse(nilai);
  if (n == null) return nilai;
  return NumberFormat.currency(locale: 'id_ID', symbol: 'Rp ', decimalDigits: 0).format(n);
}
