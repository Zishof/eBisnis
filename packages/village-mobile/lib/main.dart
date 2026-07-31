/// Aplikasi Warga Desa — eBisnis Sistem Informasi Desa.
///
/// Kanal warga sesuai presentasi: ajukan surat, lapor, jadwal Posyandu, info
/// bantuan, dan pengumuman — "desa dalam genggaman".
///
/// ## Tiga hal yang menentukan bentuk aplikasi ini
///
/// 1. **Sinyal di desa putus-putus.** Galat jaringan dibedakan dari penolakan
///    peladen, dan draf tidak pernah dibuang ketika pengiriman gagal.
/// 2. **Yang ditampilkan ditentukan sesinya.** Tidak ada satu pun layar yang
///    menerima pengenal penduduk, dan tidak ada pencarian warga.
/// 3. **Janji yang tidak dapat ditepati tidak diucapkan.** Aplikasi berbasis
///    akun tidak dapat menjanjikan pengaduan anonim, dan tidak menjanjikannya.
library;

import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'data/api_client.dart';
import 'data/village_api.dart';
import 'domain/rules.dart';
import 'ui/ajukan_surat.dart';
import 'ui/bantuan.dart';
import 'ui/beranda.dart';
import 'ui/lapor.dart';
import 'ui/pengumuman.dart';
import 'ui/posyandu.dart';
import 'ui/shared.dart';

/// Alamat API. Diisi saat build:
/// `flutter build apk --dart-define=API_BASE_URL=https://desa.example.id/api/v1`
const kApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3100/api/v1',
);

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Nama bulan dan hari dalam bahasa Indonesia. Tanpa ini, agenda desa
  // menampilkan "Monday, 3 March" kepada warga yang tidak membaca Inggris.
  await initializeDateFormatting('id_ID');
  runApp(const AplikasiWarga());
}

class AplikasiWarga extends StatelessWidget {
  const AplikasiWarga({super.key});

  @override
  Widget build(BuildContext context) {
    const benih = Color(0xFF00695C);
    return MaterialApp(
      title: 'Warga Desa',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: benih),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: benih, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: const Gerbang(),
    );
  }
}

/// Menentukan layar pertama: masuk, atau beranda.
class Gerbang extends StatefulWidget {
  const Gerbang({super.key});

  @override
  State<Gerbang> createState() => _GerbangState();
}

class _GerbangState extends State<Gerbang> {
  late final ApiClient _klien = ApiClient(baseUrl: kApiBaseUrl);
  late final VillageApi _api = VillageApi(_klien);

  bool _memeriksa = true;
  bool _masuk = false;

  @override
  void initState() {
    super.initState();
    _periksaSesi();
  }

  Future<void> _periksaSesi() async {
    final ada = await _klien.pulihkanSesi();
    if (mounted) {
      setState(() {
        _masuk = ada;
        _memeriksa = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_memeriksa) {
      return const Scaffold(body: MemuatState(label: 'Membuka aplikasi…'));
    }
    return _masuk
        ? LayarUtama(
            api: _api,
            onKeluar: () async {
              await _klien.keluar();
              if (mounted) setState(() => _masuk = false);
            },
          )
        : LayarMasuk(
            klien: _klien,
            onBerhasil: () => setState(() => _masuk = true),
          );
  }
}

class LayarMasuk extends StatefulWidget {
  const LayarMasuk({super.key, required this.klien, required this.onBerhasil});
  final ApiClient klien;
  final VoidCallback onBerhasil;

  @override
  State<LayarMasuk> createState() => _LayarMasukState();
}

class _LayarMasukState extends State<LayarMasuk> {
  final _nama = TextEditingController();
  final _sandi = TextEditingController();
  bool _sedang = false;
  String? _galat;

  @override
  void dispose() {
    _nama.dispose();
    _sandi.dispose();
    super.dispose();
  }

  Future<void> _masuk() async {
    setState(() {
      _sedang = true;
      _galat = null;
    });
    try {
      await widget.klien.masuk(_nama.text.trim(), _sandi.text);
      widget.onBerhasil();
    } catch (e) {
      if (mounted) setState(() => _galat = e.toString());
    } finally {
      if (mounted) setState(() => _sedang = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const SizedBox(height: 40),
            Icon(Icons.holiday_village_rounded,
                size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text('Warga Desa', textAlign: TextAlign.center, style: teks.headlineMedium),
            const SizedBox(height: 8),
            Text(
              'Satu akun untuk seluruh layanan desa',
              textAlign: TextAlign.center,
              style: teks.bodyMedium,
            ),
            const SizedBox(height: 40),
            TextField(
              controller: _nama,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Nama pengguna',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _sandi,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Kata sandi',
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => _masuk(),
            ),
            if (_galat != null) ...[
              const SizedBox(height: 16),
              Catatan(_galat!, ikon: Icons.error_outline_rounded),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _sedang ? null : _masuk,
              child: Text(_sedang ? 'Masuk…' : 'Masuk'),
            ),
            const SizedBox(height: 24),
            const Catatan(
              'Belum punya akun? Datang ke kantor desa dengan membawa KTP. Petugas akan '
              'membuatkan akun dan menautkannya ke data kependudukan Anda.',
              ikon: Icons.badge_outlined,
            ),
          ],
        ),
      ),
    );
  }
}

class LayarUtama extends StatefulWidget {
  const LayarUtama({super.key, required this.api, required this.onKeluar});
  final VillageApi api;
  final VoidCallback onKeluar;

  @override
  State<LayarUtama> createState() => _LayarUtamaState();
}

class _LayarUtamaState extends State<LayarUtama> {
  Hasil<ProfilWarga> _profil = const Hasil.memuat();
  Tautan _tautan = const Tautan(KeadaanTautan.belumTertaut);

  @override
  void initState() {
    super.initState();
    _muat();
  }

  Future<void> _muat() async {
    setState(() => _profil = const Hasil.memuat());
    try {
      final p = await widget.api.profil();
      if (mounted) {
        setState(() {
          _profil = Hasil.isi(p);
          _tautan = const Tautan(KeadaanTautan.tertaut);
        });
      }
    } on ApiError catch (e) {
      if (!mounted) return;
      setState(() {
        // 403 berarti akunnya belum tertaut — bukan kerusakan yang perlu
        // ditampilkan sebagai galat. Aplikasi tetap berjalan; menu yang
        // memerlukan tautan menjelaskan syaratnya.
        if (e.status == 403) {
          _profil = const Hasil.isi(null);
          _tautan = const Tautan(KeadaanTautan.belumTertaut);
        } else {
          _profil = Hasil.galat(e);
        }
      });
    }
  }

  Future<void> _buka(String kodeMenu) async {
    if (kodeMenu == 'PERMOHONAN_SURAT') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LayarAjukanSurat(api: widget.api)),
      );
      return;
    }

    if (kodeMenu == 'PENGUMUMAN') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LayarPengumuman(api: widget.api)),
      );
      return;
    }

    if (kodeMenu == 'POSYANDU') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LayarPosyandu(api: widget.api)),
      );
      return;
    }

    if (kodeMenu == 'STATUS_BANTUAN') {
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => LayarBantuan(api: widget.api)),
      );
      return;
    }

    if (kodeMenu == 'PENGADUAN') {
      await Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => Scaffold(
            appBar: AppBar(title: const Text('Lapor / Aduan')),
            body: LayarLapor(
              onKirim: ({
                required String judul,
                required String uraian,
                required bool tampilkanNama,
                String? tempat,
              }) async {
                final r = await widget.api.lapor(
                  judul: judul,
                  uraian: uraian,
                  tampilkanNama: tampilkanNama,
                  keteranganTempat: tempat,
                );
                return (r['note'] as String?) ?? 'Laporan Anda tersimpan.';
              },
            ),
          ),
        ),
      );
      return;
    }

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Layar ini sedang disiapkan.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final nama = _profil.data?.nama;
    return Scaffold(
      appBar: AppBar(
        title: Text(nama == null ? 'Warga Desa' : 'Halo, $nama'),
        actions: [
          IconButton(
            onPressed: widget.onKeluar,
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Keluar',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _muat,
        child: _profil.galat != null
            ? GalatState(galat: _profil.galat!, onCobaLagi: _muat)
            : _profil.sedangMemuat
                ? const MemuatState()
                : Beranda(
                    namaDesa: 'Layanan Desa',
                    tautan: _tautan,
                    onBuka: _buka,
                  ),
      ),
    );
  }
}
