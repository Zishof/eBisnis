/// Perbandingan versi dan keputusan memperbarui.
///
/// ## Mengapa ini murni dan diuji tersendiri
///
/// Membandingkan versi tampak sepele sampai `1.10.0` dianggap lebih lama
/// daripada `1.2.0` karena dibandingkan sebagai teks. Pada mesin kasir akibatnya
/// bukan sekadar salah tampil: pembaruan yang membawa perbaikan perhitungan uang
/// tidak pernah ditawarkan, dan tidak ada yang menyadarinya sebab layarnya
/// memang tidak menampilkan apa-apa.
///
/// Kebalikannya sama buruknya. Klien yang menawarkan "pembaruan" ke versi yang
/// lebih lama akan membuat mesin kasir turun versi diam-diam — dan turun versi
/// pada aplikasi yang menyimpan buku transaksi lokal berarti versi lama membaca
/// catatan yang ditulis versi baru.
library;

/// Satu versi semantik: `major.minor.patch` dengan pratayang opsional.
class Versi implements Comparable<Versi> {
  const Versi(this.major, this.minor, this.patch, {this.pratayang});

  /// Mengurai `1.2.3`, `v1.2.3`, atau `1.2.3-beta.1`.
  ///
  /// Mengembalikan null bila tidak dapat diurai, bukan melemparkan galat:
  /// jawaban peladen yang rusak tidak boleh menjatuhkan aplikasi kasir yang
  /// sedang melayani antrean. Yang terjadi cukup "tidak ada pembaruan".
  static Versi? urai(String teks) {
    var bersih = teks.trim();
    if (bersih.startsWith('v') || bersih.startsWith('V')) {
      bersih = bersih.substring(1);
    }
    if (bersih.isEmpty) return null;

    String? pra;
    final tandaPra = bersih.indexOf('-');
    if (tandaPra >= 0) {
      pra = bersih.substring(tandaPra + 1);
      bersih = bersih.substring(0, tandaPra);
      if (pra.isEmpty) pra = null;
    }

    final bagian = bersih.split('.');
    if (bagian.isEmpty || bagian.length > 3) return null;

    final angka = <int>[];
    for (final b in bagian) {
      final n = int.tryParse(b);
      if (n == null || n < 0) return null;
      angka.add(n);
    }
    while (angka.length < 3) {
      angka.add(0);
    }
    return Versi(angka[0], angka[1], angka[2], pratayang: pra);
  }

  final int major;
  final int minor;
  final int patch;

  /// Bagian sesudah tanda hubung, misalnya `beta.1`. Null bila versi rilis.
  final String? pratayang;

  @override
  int compareTo(Versi other) {
    // Dibandingkan sebagai ANGKA, bukan teks: sebagai teks, "10" lebih kecil
    // daripada "2" dan seluruh urutannya terbalik pada versi kesepuluh ke atas.
    final lain = other;
    if (major != lain.major) return major.compareTo(lain.major);
    if (minor != lain.minor) return minor.compareTo(lain.minor);
    if (patch != lain.patch) return patch.compareTo(lain.patch);

    /*
     * Pratayang lebih TUA daripada rilis dengan angka yang sama.
     *
     * `1.0.0-beta` mendahului `1.0.0`, bukan sebaliknya. Tanpa aturan ini,
     * mesin kasir yang menjalankan beta tidak akan pernah ditawari rilis
     * resminya — justru versi yang paling ingin dipasang.
     */
    if (pratayang == null && lain.pratayang == null) return 0;
    if (pratayang == null) return 1;
    if (lain.pratayang == null) return -1;
    return pratayang!.compareTo(lain.pratayang!);
  }

  bool operator >(Versi lain) => compareTo(lain) > 0;
  bool operator <(Versi lain) => compareTo(lain) < 0;

  @override
  bool operator ==(Object other) => other is Versi && compareTo(other) == 0;

  @override
  int get hashCode => Object.hash(major, minor, patch, pratayang);

  @override
  String toString() =>
      '$major.$minor.$patch${pratayang == null ? '' : '-$pratayang'}';
}

/// Keterangan rilis sebagaimana dikabarkan sumber pembaruan.
class RilisTersedia {
  const RilisTersedia({
    required this.versi,
    required this.jalurUnduh,
    this.catatan,
    this.wajib = false,
  });

  final String versi;

  /// Alamat berkas pemasang untuk platform yang sedang berjalan.
  final String jalurUnduh;
  final String? catatan;

  /// Benar bila versi ini menutup cacat yang tidak boleh dibiarkan berjalan.
  ///
  /// Dipakai dengan sangat hemat: pembaruan wajib menghentikan kasir di tengah
  /// hari kerja, dan itu hanya sebanding bila yang ditutupnya menyangkut uang
  /// atau data.
  final bool wajib;
}

enum KeadaanPembaruan {
  /// Sudah versi terbaru.
  mutakhir,

  /// Ada versi lebih baru.
  tersedia,

  /// Versi yang berjalan lebih baru daripada rilis terakhir.
  lebihBaru,

  /// Tidak dapat diperiksa — jaringan, jawaban rusak, atau sumber tidak dikenal.
  gagalDiperiksa,
}

class HasilPeriksaPembaruan {
  const HasilPeriksaPembaruan({
    required this.keadaan,
    required this.pesan,
    this.rilis,
    this.wajib = false,
  });

  final KeadaanPembaruan keadaan;

  /// Kalimat untuk kasir. Selalu menyebutkan apa yang perlu dilakukan, atau
  /// menegaskan bahwa tidak ada yang perlu dilakukan.
  final String pesan;
  final RilisTersedia? rilis;
  final bool wajib;
}

/// Memutuskan apakah pembaruan perlu ditawarkan.
///
/// Dipisahkan dari pengambilannya lewat jaringan supaya seluruh keputusannya —
/// termasuk kasus yang paling mudah salah — dapat dibuktikan tanpa peladen.
HasilPeriksaPembaruan nilaiPembaruan({
  required String versiBerjalan,
  required RilisTersedia? rilis,
}) {
  final sekarang = Versi.urai(versiBerjalan);
  if (sekarang == null) {
    return const HasilPeriksaPembaruan(
      keadaan: KeadaanPembaruan.gagalDiperiksa,
      pesan: 'Versi aplikasi yang berjalan tidak dapat dibaca, sehingga pembaruan '
          'tidak dapat diperiksa.',
    );
  }

  if (rilis == null) {
    return const HasilPeriksaPembaruan(
      keadaan: KeadaanPembaruan.gagalDiperiksa,
      pesan: 'Tidak dapat menghubungi sumber pembaruan. Aplikasi tetap dapat dipakai; '
          'coba lagi nanti.',
    );
  }

  final terbaru = Versi.urai(rilis.versi);
  if (terbaru == null) {
    return const HasilPeriksaPembaruan(
      keadaan: KeadaanPembaruan.gagalDiperiksa,
      pesan: 'Keterangan versi dari sumber pembaruan tidak dapat dibaca.',
    );
  }

  if (terbaru > sekarang) {
    return HasilPeriksaPembaruan(
      keadaan: KeadaanPembaruan.tersedia,
      rilis: rilis,
      wajib: rilis.wajib,
      pesan: rilis.wajib
          ? 'Versi $terbaru wajib dipasang. Versi yang berjalan memuat cacat yang '
              'tidak boleh dibiarkan pada mesin kasir.'
          : 'Versi $terbaru tersedia. Versi yang berjalan $sekarang.',
    );
  }

  if (sekarang > terbaru) {
    /*
     * Versi yang berjalan lebih baru daripada rilis terakhir — lazim pada mesin
     * uji. TIDAK ditawari "pembaruan", sebab yang ditawarkan sebenarnya turun
     * versi, dan turun versi pada aplikasi yang menyimpan buku transaksi lokal
     * berarti versi lama membaca catatan yang ditulis versi baru.
     */
    return HasilPeriksaPembaruan(
      keadaan: KeadaanPembaruan.lebihBaru,
      pesan: 'Versi yang berjalan ($sekarang) lebih baru daripada rilis terakhir '
          '($terbaru). Tidak ada yang perlu dipasang.',
    );
  }

  return HasilPeriksaPembaruan(
    keadaan: KeadaanPembaruan.mutakhir,
    pesan: 'Sudah versi terbaru ($sekarang).',
  );
}
