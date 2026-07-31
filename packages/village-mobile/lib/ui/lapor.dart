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
///
/// ## Foto dikirim SESUDAH pengaduannya tersimpan, dan itu terlihat di layar
///
/// Pengaduan disimpan lebih dahulu, fotonya menyusul satu per satu. Urutan itu
/// dipilih supaya kegagalan mengirim foto — yang jauh lebih mungkin terjadi
/// daripada kegagalan mengirim teks, sebab ukurannya ratusan kali lipat —
/// tidak ikut membatalkan aduan yang sudah selesai ditulis warga.
///
/// Akibatnya ada keadaan **ketiga** yang wajib dinyatakan apa adanya: aduannya
/// tersimpan, sebagian fotonya tidak. Menyebutnya gagal seluruhnya membuat
/// warga mengadukan hal yang sama untuk kedua kalinya; menyebutnya berhasil
/// seluruhnya membuatnya mengira petugas melihat foto yang tidak pernah sampai.
library;

import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../domain/foto.dart';
import '../domain/rules.dart';
import 'shared.dart';

/// Hasil penyimpanan pengaduan. Pengenalnya diperlukan untuk melekatkan foto.
class HasilLapor {
  const HasilLapor({required this.id, required this.pesan});
  final String id;
  final String pesan;
}

class LayarLapor extends StatefulWidget {
  const LayarLapor({super.key, required this.onKirim, required this.onUnggahFoto});

  final Future<HasilLapor> Function({
    required String judul,
    required String uraian,
    required bool tampilkanNama,
    String? tempat,
  }) onKirim;

  /// Mengirim satu foto yang metadatanya **sudah** dibuang.
  final Future<void> Function({
    required String pengaduanId,
    required Uint8List isi,
    required String mime,
    required String namaBerkas,
  }) onUnggahFoto;

  @override
  State<LayarLapor> createState() => _LayarLaporState();
}

class _LayarLaporState extends State<LayarLapor> {
  final _judul = TextEditingController();
  final _uraian = TextEditingController();
  final _tempat = TextEditingController();
  final _pemilih = ImagePicker();

  ModeNama _mode = ModeNama.cantumkan;
  final List<FotoSiap> _foto = [];
  bool _mengirim = false;
  String? _tahap;
  String? _galat;
  String? _berhasil;

  @override
  void dispose() {
    _judul.dispose();
    _uraian.dispose();
    _tempat.dispose();
    super.dispose();
  }

  // --- Memilih foto ---------------------------------------------------------

  Future<void> _ambilFoto(ImageSource sumber) async {
    final bisa = bolehTambahFoto(_foto.length);
    if (!bisa.boleh) {
      setState(() => _galat = bisa.alasan);
      return;
    }

    final XFile? berkas;
    try {
      berkas = await _pemilih.pickImage(
        source: sumber,
        // Diperkecil di ponsel. Foto 12 MP dari kamera modern hampir selalu
        // melewati batas 8 MB, dan warga yang ditolak setelah menunggu unggahan
        // berjalan setengah jalan tidak akan mencoba lagi.
        maxWidth: 2000,
        maxHeight: 2000,
        imageQuality: 85,
      );
    } catch (e) {
      // Izin ditolak atau kamera tidak tersedia. Dinyatakan, bukan didiamkan.
      if (mounted) {
        setState(() => _galat = 'Tidak dapat membuka ${sumber == ImageSource.camera ? 'kamera' : 'galeri'}. '
            'Periksa izin aplikasi pada Pengaturan ponsel.');
      }
      return;
    }
    if (berkas == null) return; // warga membatalkan

    final mentah = await berkas.readAsBytes();
    try {
      // Metadata dibuang DI SINI, sebelum apa pun dikirim. Koordinat GPS pada
      // foto tidak pernah meninggalkan ponsel.
      final siap = siapkanFoto(mentah, berkas.name);
      if (mounted) {
        setState(() {
          _foto.add(siap);
          _galat = null;
        });
      }
    } on FotoDitolak catch (e) {
      if (mounted) setState(() => _galat = e.pesan);
    }
  }

  void _pilihSumber() {
    showModalBottomSheet<void>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Potret sekarang'),
              onTap: () {
                Navigator.of(c).pop();
                _ambilFoto(ImageSource.camera);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Pilih dari galeri'),
              onTap: () {
                Navigator.of(c).pop();
                _ambilFoto(ImageSource.gallery);
              },
            ),
          ],
        ),
      ),
    );
  }

  // --- Mengirim -------------------------------------------------------------

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
      _tahap = 'Mengirim laporan…';
    });

    try {
      final hasil = await widget.onKirim(
        judul: _judul.text.trim(),
        uraian: _uraian.text.trim(),
        tampilkanNama: _mode == ModeNama.cantumkan,
        tempat: _tempat.text.trim().isEmpty ? null : _tempat.text.trim(),
      );

      // Aduannya sudah tersimpan mulai baris ini. Apa pun yang terjadi pada
      // foto sesudahnya TIDAK boleh membuat layar menyatakan laporannya gagal.
      var terkirim = 0;
      var gagal = 0;
      for (var i = 0; i < _foto.length; i++) {
        if (mounted) {
          setState(() => _tahap = 'Mengirim foto ${i + 1} dari ${_foto.length}…');
        }
        try {
          await widget.onUnggahFoto(
            pengaduanId: hasil.id,
            isi: _foto[i].data,
            mime: _foto[i].jenis.mime,
            namaBerkas: _foto[i].namaAsli,
          );
          terkirim += 1;
        } catch (_) {
          gagal += 1;
        }
      }

      final ringkas = RingkasanUnggah(terkirim: terkirim, gagal: gagal);
      if (mounted) {
        setState(() {
          _berhasil = _foto.isEmpty ? hasil.pesan : '${hasil.pesan}\n\n${ringkas.pesan}';
        });
      }
    } catch (e) {
      // Isian TIDAK dikosongkan. Sinyal di desa putus-putus, dan warga yang
      // kehilangan tulisannya karena pengiriman gagal tidak akan mengetiknya
      // lagi. Foto yang sudah dipilih juga tetap ada.
      if (mounted) setState(() => _galat = e.toString());
    } finally {
      if (mounted) {
        setState(() {
          _mengirim = false;
          _tahap = null;
        });
      }
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
        _BagianFoto(
          foto: _foto,
          aktif: !_mengirim,
          onTambah: _pilihSumber,
          onHapus: (i) => setState(() => _foto.removeAt(i)),
        ),

        const SizedBox(height: 24),
        Text('Nama Anda', style: teks.titleMedium),
        const SizedBox(height: 8),
        ...ModeNama.values.map((m) {
          final p = pesanMode[m]!;
          return RadioListTile<ModeNama>(
            value: m,
            groupValue: _mode,
            onChanged: _mengirim ? null : (v) => setState(() => _mode = v!),
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
          // Tahapnya disebut. Warga yang menunggu tanpa keterangan pada sinyal
          // lemah akan menekan tombolnya lagi, dan aduannya terkirim dua kali.
          child: Text(_mengirim ? (_tahap ?? 'Mengirim…') : 'Kirim Laporan'),
        ),
      ],
    );
  }
}

/// Bagian pemilihan foto.
///
/// Kalimat tentang lokasi ditulis apa adanya: metadata **sudah dibuang di
/// ponsel**, jadi yang dinyatakan bukan janji melainkan sesuatu yang sudah
/// terjadi ketika kalimat itu terbaca.
class _BagianFoto extends StatelessWidget {
  const _BagianFoto({
    required this.foto,
    required this.aktif,
    required this.onTambah,
    required this.onHapus,
  });

  final List<FotoSiap> foto;
  final bool aktif;
  final VoidCallback onTambah;
  final void Function(int) onHapus;

  @override
  Widget build(BuildContext context) {
    final teks = Theme.of(context).textTheme;
    final adaYangDibuang = foto.any((f) => f.adaYangDibuang);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(child: Text('Foto (opsional)', style: teks.titleMedium)),
            Text('${foto.length}/$fotoMaksimal', style: teks.bodySmall),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Foto membantu petugas memahami keadaannya tanpa harus bertanya ulang.',
          style: teks.bodySmall,
        ),
        const SizedBox(height: 12),

        if (foto.isNotEmpty)
          SizedBox(
            height: 104,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: foto.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (_, i) => _Pratinjau(
                foto: foto[i],
                onHapus: aktif ? () => onHapus(i) : null,
              ),
            ),
          ),

        if (foto.length < fotoMaksimal) ...[
          if (foto.isNotEmpty) const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: aktif ? onTambah : null,
            icon: const Icon(Icons.add_a_photo_outlined),
            label: Text(foto.isEmpty ? 'Tambahkan foto' : 'Tambah foto lagi'),
          ),
        ],

        if (adaYangDibuang) ...[
          const SizedBox(height: 12),
          Catatan(
            'Data lokasi dan informasi kamera pada foto sudah dihapus di ponsel Anda, '
            'sebelum foto dikirim. Foto dari kamera ponsel biasanya menyimpan koordinat '
            'tempat ia dipotret — dan itu bisa jadi rumah Anda sendiri.',
            ikon: Icons.privacy_tip_outlined,
          ),
        ],
      ],
    );
  }
}

class _Pratinjau extends StatelessWidget {
  const _Pratinjau({required this.foto, this.onHapus});
  final FotoSiap foto;
  final VoidCallback? onHapus;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          // Yang ditampilkan adalah byte yang AKAN dikirim, bukan berkas
          // aslinya. Warga melihat persis apa yang diterima kantor desa.
          child: Image.memory(
            foto.data,
            width: 104,
            height: 104,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              width: 104,
              height: 104,
              color: Theme.of(context).colorScheme.surfaceContainerHighest,
              child: const Icon(Icons.broken_image_outlined),
            ),
          ),
        ),
        if (onHapus != null)
          Positioned(
            top: 2,
            right: 2,
            child: Material(
              color: Colors.black54,
              shape: const CircleBorder(),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onHapus,
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.close_rounded, size: 16, color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
