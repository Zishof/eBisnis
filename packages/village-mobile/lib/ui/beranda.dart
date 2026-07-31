/// Beranda Aplikasi Warga Desa.
///
/// Lima menu, persis yang dijanjikan presentasi dan dalam urutan yang sama:
/// Ajukan Surat, Lapor / Aduan, Jadwal Posyandu, Info Bantuan, Pengumuman.
///
/// Menu yang menuntut tautan akun **tetap ditampilkan**, tidak disembunyikan.
/// Menu yang hilang membuat warga mengira aplikasinya tidak punya fitur itu;
/// menu yang ada tetapi menjelaskan syaratnya membuatnya datang ke kantor desa
/// satu kali lalu memakainya seterusnya.
library;

import 'package:flutter/material.dart';

import '../domain/rules.dart';
import 'shared.dart';

const _ikonMenu = <String, IconData>{
  'PERMOHONAN_SURAT': Icons.description_outlined,
  'PENGADUAN': Icons.report_problem_outlined,
  'POSYANDU': Icons.child_care_outlined,
  'STATUS_BANTUAN': Icons.volunteer_activism_outlined,
  'PENGUMUMAN': Icons.campaign_outlined,
};

class Beranda extends StatelessWidget {
  const Beranda({
    super.key,
    required this.namaDesa,
    required this.tautan,
    required this.onBuka,
  });

  final String namaDesa;
  final Tautan tautan;
  final void Function(String kodeMenu) onBuka;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final belumTertaut = tautan.keadaan != KeadaanTautan.tertaut;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        Text(namaDesa, style: teks.headlineSmall),
        const SizedBox(height: 4),
        Text('Layanan desa dari genggaman Anda', style: teks.bodyMedium),
        const SizedBox(height: 20),

        // Ditampilkan sekali di atas, bukan diulang pada setiap menu yang
        // terkunci. Peringatan yang muncul lima kali berhenti dibaca.
        if (belumTertaut) ...[
          Catatan(
            tautan.boleh('PERMOHONAN_SURAT').alasan!,
            ikon: Icons.badge_outlined,
          ),
          const SizedBox(height: 20),
        ],

        ...menuWarga.map((m) {
          final putusan = tautan.boleh(m.kode);
          final terkunci = !putusan.bolehkah;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                leading: Icon(_ikonMenu[m.kode] ?? Icons.apps_rounded, size: 32),
                title: Text(m.label, style: teks.titleMedium),
                subtitle: Text(terkunci ? 'Perlu tautan akun' : m.keterangan),
                trailing: Icon(
                  terkunci ? Icons.lock_outline_rounded : Icons.chevron_right_rounded,
                ),
                // Menu terkunci tetap dapat ditekan: yang muncul adalah
                // keterangannya, bukan diam. Tombol yang tidak bereaksi membuat
                // orang mengira aplikasinya rusak.
                onTap: () => terkunci
                    ? ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(putusan.alasan!), duration: const Duration(seconds: 6)),
                      )
                    : onBuka(m.kode),
              ),
            ),
          );
        }),
      ],
    );
  }
}
