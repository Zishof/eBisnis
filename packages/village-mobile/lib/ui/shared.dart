/// Bagian tampilan yang dipakai berulang.
///
/// ## Gagal memuat dan "belum ada isi" tidak pernah tampak sama
///
/// Aturan yang sama dengan situs desa. Warga yang melihat "belum ada berita"
/// padahal sinyalnya putus akan berhenti membukanya lagi — dan ia tidak akan
/// mengadu, ia hanya berhenti.
library;

import 'package:flutter/material.dart';

import '../data/api_client.dart';

class MemuatState extends StatelessWidget {
  const MemuatState({super.key, this.label});
  final String? label;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              if (label != null) ...[
                const SizedBox(height: 16),
                Text(label!, style: Theme.of(context).textTheme.bodyLarge),
              ],
            ],
          ),
        ),
      );
}

/// Keadaan galat.
///
/// Galat jaringan diberi kalimat yang berbeda dari penolakan peladen: yang
/// pertama dapat diperbaiki warga sendiri dengan pindah tempat, yang kedua
/// tidak.
class GalatState extends StatelessWidget {
  const GalatState({super.key, required this.galat, this.onCobaLagi});
  final ApiError galat;
  final VoidCallback? onCobaLagi;

  @override
  Widget build(BuildContext context) {
    final warna = Theme.of(context).colorScheme;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              galat.karenaJaringan ? Icons.wifi_off_rounded : Icons.error_outline_rounded,
              size: 48,
              color: warna.error,
            ),
            const SizedBox(height: 16),
            Text(
              galat.message,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            if (onCobaLagi != null) ...[
              const SizedBox(height: 20),
              FilledButton.tonalIcon(
                onPressed: onCobaLagi,
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('Coba lagi'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class KosongState extends StatelessWidget {
  const KosongState({super.key, required this.judul, this.uraian});
  final String judul;
  final String? uraian;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.inbox_rounded, size: 48, color: Theme.of(context).disabledColor),
              const SizedBox(height: 16),
              Text(judul, style: Theme.of(context).textTheme.titleMedium),
              if (uraian != null) ...[
                const SizedBox(height: 8),
                Text(
                  uraian!,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ],
            ],
          ),
        ),
      );
}

/// Membangun tampilan dari [Hasil], memisahkan ketiga keadaannya.
class HasilBuilder<T> extends StatelessWidget {
  const HasilBuilder({
    super.key,
    required this.hasil,
    required this.bangun,
    required this.kosong,
    this.onCobaLagi,
    this.apakahKosong,
  });

  final Hasil<T> hasil;
  final Widget Function(T data) bangun;
  final Widget kosong;
  final VoidCallback? onCobaLagi;
  final bool Function(T data)? apakahKosong;

  @override
  Widget build(BuildContext context) {
    if (hasil.sedangMemuat) return const MemuatState();
    if (hasil.galat != null) {
      return GalatState(galat: hasil.galat!, onCobaLagi: onCobaLagi);
    }
    final d = hasil.data;
    if (d == null) return kosong;
    if (apakahKosong?.call(d) ?? false) return kosong;
    return bangun(d);
  }
}

/// Kartu keterangan yang menyatakan sesuatu yang perlu dibaca, bukan galat.
class Catatan extends StatelessWidget {
  const Catatan(this.teks, {super.key, this.ikon = Icons.info_outline_rounded});
  final String teks;
  final IconData ikon;

  @override
  Widget build(BuildContext context) {
    final warna = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: warna.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ikon, size: 22, color: warna.onSecondaryContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              teks,
              style: Theme.of(context)
                  .textTheme
                  .bodyMedium
                  ?.copyWith(color: warna.onSecondaryContainer),
            ),
          ),
        ],
      ),
    );
  }
}
