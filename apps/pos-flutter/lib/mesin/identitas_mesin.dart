/// Identitas mesin kasir: satu id permanen dan satu nama yang boleh diubah.
///
/// ## Untuk apa
///
/// Gerai dengan lebih dari satu terminal perlu tahu transaksi mana berasal dari
/// mesin mana — pada riwayat, pada pesanan tertahan, dan pada laporan omzet per
/// mesin (spesifikasi AIS §1, §12, §15). Tanpa ini, dua kasir yang berselisih
/// tentang satu transaksi tidak punya cara menunjukkan mesinnya.
///
/// ## Dua medan, dua sifat yang berlawanan
///
/// **Id permanen.** Ia yang tercatat pada transaksi. Bila ia berganti, riwayat
/// satu mesin terbelah menjadi dua yang tidak dapat disatukan lagi — dan tidak
/// ada galat yang muncul, sebab kedua bagiannya sama-sama sah.
///
/// **Nama boleh diubah** kapan saja ("Kasir Depan", "Kasir Drive-Thru"). Ia
/// hanya label untuk manusia; mengubahnya tidak memutus apa pun, sebab yang
/// tercatat adalah idnya.
library;

import 'dart:convert';
import 'dart:io';
import 'dart:math';

class IdentitasMesin {
  const IdentitasMesin({required this.id, required this.nama, this.dipulihkan = false});

  /// UUID v4. Dibuat sekali, lalu tidak pernah berubah.
  final String id;

  final String nama;

  /// Benar bila berkas identitas lama ada tetapi tidak dapat dibaca, sehingga
  /// identitas ini baru dibuat.
  ///
  /// Dibawa sampai ke layar dengan sengaja: mesin yang diam-diam berganti
  /// identitas akan memecah riwayatnya sendiri, dan tidak ada yang menyadarinya
  /// sampai seseorang mencari sebuah transaksi dan tidak menemukannya.
  final bool dipulihkan;

  Map<String, dynamic> keJson() => {'id': id, 'nama': nama};
}

/// Pola UUID v4 yang diterima.
final RegExp _polaUuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

bool idMesinSah(String id) => _polaUuid.hasMatch(id);

/// Membuat UUID v4 dari sumber acak kriptografis.
///
/// `Random.secure()`, bukan `Random()`: dua mesin yang dinyalakan bersamaan dari
/// citra sistem yang sama akan menghasilkan deret yang sama persis dari
/// `Random()` biasa — dan dua mesin kasir dengan id kembar adalah persis
/// kekacauan yang id ini dimaksudkan mencegah.
String buatIdMesin() {
  final acak = Random.secure();
  final b = List<int>.generate(16, (_) => acak.nextInt(256));

  b[6] = (b[6] & 0x0f) | 0x40; // versi 4
  b[8] = (b[8] & 0x3f) | 0x80; // varian RFC 4122

  String hx(int dari, int sampai) =>
      b.sublist(dari, sampai).map((x) => x.toRadixString(16).padLeft(2, '0')).join();

  return '${hx(0, 4)}-${hx(4, 6)}-${hx(6, 8)}-${hx(8, 10)}-${hx(10, 16)}';
}

/// Nama bawaan sebelum siapa pun menamainya.
///
/// Bukan "Mesin 1": penomoran menyiratkan ada yang mengatur urutannya, padahal
/// tidak ada. Bukan pula kosong — daftar transaksi dengan kolom mesin yang
/// kosong tidak memberi tahu apa pun.
const String namaMesinBawaan = 'Kasir Tanpa Nama';

/// Batas panjang nama.
///
/// Nama mesin ikut tercetak pada struk selebar 32–48 kolom. Yang lebih panjang
/// daripada ini akan terpotong di sana, dan yang terpotong di struk tidak dapat
/// dicocokkan kembali dengan daftar mesin.
const int panjangNamaMaks = 24;

/// Membersihkan nama yang diketik pengguna, atau null bila tidak dapat dipakai.
String? bersihkanNamaMesin(String mentah) {
  final bersih = mentah.trim().replaceAll(RegExp(r'\s+'), ' ');
  if (bersih.isEmpty) return null;
  if (bersih.length > panjangNamaMaks) return null;
  // Karakter kendali tidak terlihat pada layar tetapi merusak struk dan CSV
  // laporan — dan sumbernya tidak akan pernah ditemukan.
  if (RegExp(r'[\x00-\x1f\x7f]').hasMatch(bersih)) return null;
  return bersih;
}

/// Tempat identitas disimpan.
abstract interface class PenyimpananIdentitas {
  Future<IdentitasMesin> muat();
  Future<void> simpanNama(String nama);
}

/// Identitas dalam satu berkas JSON.
class IdentitasBerkas implements PenyimpananIdentitas {
  IdentitasBerkas(this.direktori);

  /// Direktori data aplikasi. Diserahkan pemanggil, bukan ditentukan di sini —
  /// tempatnya berbeda pada Windows dan Android, dan modul ini tidak perlu tahu.
  final Directory direktori;

  File get _berkas => File('${direktori.path}${Platform.pathSeparator}mesin.json');

  IdentitasMesin? _muatan;

  @override
  Future<IdentitasMesin> muat() async {
    if (_muatan case final m?) return m;

    if (await _berkas.exists()) {
      try {
        final isi = jsonDecode(await _berkas.readAsString());
        if (isi is Map<String, dynamic>) {
          final id = isi['id'];
          final nama = isi['nama'];
          if (id is String && idMesinSah(id)) {
            _muatan = IdentitasMesin(
              id: id,
              nama: (nama is String ? bersihkanNamaMesin(nama) : null) ?? namaMesinBawaan,
            );
            return _muatan!;
          }
        }
      } catch (_) {
        // Ditangani di bawah, sama dengan berkas yang isinya tidak masuk akal.
      }

      /*
       * Berkasnya ada tetapi tidak terbaca.
       *
       * Yang lama TIDAK ditimpa — ia disingkirkan dengan namanya sendiri. Isinya
       * mungkin masih dapat dibaca manusia, dan id lama itulah satu-satunya cara
       * menyatukan kembali riwayat mesin ini.
       *
       * Menolak berjalan bukan pilihan: itu menghentikan penjualan demi masalah
       * yang tidak menyangkut uang. Karena itu identitas baru dibuat, dan
       * [IdentitasMesin.dipulihkan] membawa kabarnya sampai ke layar.
       */
      try {
        await _berkas.rename('${_berkas.path}.rusak');
      } catch (_) {
        // Bila menyingkirkan pun gagal, tetap lanjut. Yang penting kasirnya
        // dapat berjualan.
      }
      final baru = IdentitasMesin(
        id: buatIdMesin(),
        nama: namaMesinBawaan,
        dipulihkan: true,
      );
      await _tulis(baru);
      _muatan = baru;
      return baru;
    }

    final baru = IdentitasMesin(id: buatIdMesin(), nama: namaMesinBawaan);
    await _tulis(baru);
    _muatan = baru;
    return baru;
  }

  @override
  Future<void> simpanNama(String nama) async {
    final bersih = bersihkanNamaMesin(nama);
    if (bersih == null) return;

    final sekarang = await muat();
    // Hanya namanya. Id tidak pernah ikut berubah — itulah seluruh gunanya.
    final baru = IdentitasMesin(id: sekarang.id, nama: bersih);
    await _tulis(baru);
    _muatan = baru;
  }

  Future<void> _tulis(IdentitasMesin m) async {
    await direktori.create(recursive: true);
    await _berkas.writeAsString(jsonEncode(m.keJson()));
  }
}
