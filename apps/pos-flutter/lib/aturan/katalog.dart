/// Kesegaran salinan katalog — kapan salinan lokal boleh dipakai.
///
/// Salinan Dart dari `apps/web/src/pos-offline/katalog.ts`.
///
/// Menyalin produk dan harga ke mesin kasir itu mudah. Yang sulit adalah
/// memutuskan **kapan salinan itu tidak boleh lagi dipercaya**.
///
/// Harga yang basi tidak menimbulkan galat apa pun. Kasir menjual, pembeli
/// membayar, struk tercetak — dan baru berminggu-minggu kemudian ketahuan bahwa
/// seluruh transaksi hari itu memakai harga bulan lalu. Tidak ada yang gagal;
/// yang terjadi hanyalah salah, diam-diam.
library;

enum JenisKatalog { produk, barcode, harga, pajak, metodeBayar }

extension JenisKatalogNama on JenisKatalog {
  String get nama => switch (this) {
        JenisKatalog.produk => 'PRODUK',
        JenisKatalog.barcode => 'BARCODE',
        JenisKatalog.harga => 'HARGA',
        JenisKatalog.pajak => 'PAJAK',
        JenisKatalog.metodeBayar => 'METODE_BAYAR',
      };

  static JenisKatalog dariNama(String nama) => switch (nama) {
        'PRODUK' => JenisKatalog.produk,
        'BARCODE' => JenisKatalog.barcode,
        'HARGA' => JenisKatalog.harga,
        'PAJAK' => JenisKatalog.pajak,
        'METODE_BAYAR' => JenisKatalog.metodeBayar,
        _ => throw ArgumentError('Jenis katalog tidak dikenal: $nama'),
      };
}

/// Berapa lama tiap jenis boleh dipakai tanpa disegarkan.
///
/// Angkanya dipilih menurut **akibat bila salah**, bukan menurut seberapa sering
/// datanya berubah:
///
/// - Harga dan pajak langsung menentukan uang yang diterima. Salah sedikit,
///   salah pada setiap transaksi sesudahnya.
/// - Produk dan barcode paling buruk membuat satu barang tidak ditemukan —
///   kasir tahu seketika dan dapat mencarinya menurut nama.
const Map<JenisKatalog, int> batasUmurMs = {
  JenisKatalog.harga: 12 * 60 * 60 * 1000, // 12 jam
  JenisKatalog.pajak: 12 * 60 * 60 * 1000,
  JenisKatalog.produk: 7 * 24 * 60 * 60 * 1000, // 7 hari
  JenisKatalog.barcode: 7 * 24 * 60 * 60 * 1000,
  JenisKatalog.metodeBayar: 7 * 24 * 60 * 60 * 1000,
};

enum TingkatKesegaran { segar, menua, basi, kosong }

extension TingkatKesegaranNama on TingkatKesegaran {
  String get nama => switch (this) {
        TingkatKesegaran.segar => 'SEGAR',
        TingkatKesegaran.menua => 'MENUA',
        TingkatKesegaran.basi => 'BASI',
        TingkatKesegaran.kosong => 'KOSONG',
      };
}

class PenilaianKatalog {
  const PenilaianKatalog({
    required this.level,
    required this.ageMs,
    required this.usable,
    required this.message,
  });

  final TingkatKesegaran level;
  final int? ageMs;

  /// Boleh dipakai berjualan?
  final bool usable;
  final String message;
}

/// Sesudah berapa bagian dari batasnya, salinan mulai disebut menua.
const double _ambangMenua = 0.5;

PenilaianKatalog nilaiKesegaran({
  required JenisKatalog jenis,
  required int? syncedAt,
  required int now,
}) {
  final batas = batasUmurMs[jenis]!;

  if (syncedAt == null) {
    return PenilaianKatalog(
      level: TingkatKesegaran.kosong,
      ageMs: null,
      usable: false,
      message: '${_label(jenis)} belum pernah disalin ke mesin ini. Sambungkan ke '
          'peladen sekali sebelum berjualan luring.',
    );
  }

  final umur = now - syncedAt;
  final umurAman = umur < 0 ? 0 : umur;

  if (umurAman > batas) {
    return PenilaianKatalog(
      level: TingkatKesegaran.basi,
      ageMs: umurAman,
      // Sengaja TIDAK boleh dipakai. Menjual dengan harga yang mungkin sudah
      // berubah tidak menimbulkan galat apa pun — dan itulah yang membuatnya
      // berbahaya.
      usable: false,
      message: '${_label(jenis)} terakhir disalin ${jam(umurAman)} lalu, melewati '
          'batas ${jam(batas)}. Sambungkan ke peladen untuk menyegarkannya sebelum '
          'melanjutkan.',
    );
  }

  if (umurAman > batas * _ambangMenua) {
    return PenilaianKatalog(
      level: TingkatKesegaran.menua,
      ageMs: umurAman,
      usable: true,
      message: '${_label(jenis)} disalin ${jam(umurAman)} lalu. Masih dipakai, '
          'tetapi sebaiknya disegarkan.',
    );
  }

  return PenilaianKatalog(
    level: TingkatKesegaran.segar,
    ageMs: umurAman,
    usable: true,
    message: '${_label(jenis)} disalin ${jam(umurAman)} lalu.',
  );
}

class KesiapanLuring {
  const KesiapanLuring({
    required this.ready,
    required this.blockers,
    required this.warnings,
  });

  final bool ready;
  final List<PenilaianKatalog> blockers;
  final List<PenilaianKatalog> warnings;
}

/// Kesiapan berjualan luring secara keseluruhan.
///
/// Satu jenis yang basi sudah cukup untuk menghentikan penjualan luring — bukan
/// karena kaku, tetapi karena tidak ada gunanya menjual dengan harga yang tidak
/// dapat dipertanggungjawabkan.
KesiapanLuring siapLuring(List<PenilaianKatalog> penilaian) {
  final penghalang = penilaian.where((p) => !p.usable).toList();
  final peringatan = penilaian
      .where((p) => p.usable && p.level == TingkatKesegaran.menua)
      .toList();
  return KesiapanLuring(
    ready: penghalang.isEmpty,
    blockers: penghalang,
    warnings: peringatan,
  );
}

String _label(JenisKatalog j) => switch (j) {
      JenisKatalog.harga => 'Harga',
      JenisKatalog.pajak => 'Tarif pajak',
      JenisKatalog.produk => 'Daftar produk',
      JenisKatalog.barcode => 'Barcode',
      JenisKatalog.metodeBayar => 'Metode pembayaran',
    };

/// Umur dalam kalimat yang wajar dibaca, bukan dalam milidetik.
///
/// Diperiksa dalam milidetik, bukan setelah dibulatkan ke menit: pembulatan
/// setengah ke atas membuat tiga puluh detik terbaca "1 menit". Salah kecil,
/// tetapi pada layar yang dipakai menilai apakah salinan masih segar, angka yang
/// dilebihkan justru menyesatkan ke arah yang salah.
String jam(int ms) {
  if (ms < 60000) return 'kurang dari semenit';
  final menit = (ms / 60000).round();
  if (menit < 60) return '$menit menit';
  final j = (menit / 60).round();
  if (j < 24) return '$j jam';
  final h = (j / 24).round();
  return '$h hari';
}
