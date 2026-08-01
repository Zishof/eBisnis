/// Keadaan sambungan kasir — aturan murni, tanpa jaringan.
///
/// Salinan Dart dari `apps/web/src/pos-offline/koneksi.ts`.
///
/// Mengetahui bahwa perangkat "punya jaringan" tidak cukup. Wi-Fi warung yang
/// tersambung tetapi tidak dapat mencapai peladen adalah keadaan yang justru
/// paling sering terjadi: router menyala, langganan internetnya yang mati.
///
/// Kasir yang membaca "daring" lalu transaksinya gagal satu per satu akan
/// kehilangan kepercayaan pada seluruh layar. Karena itu keadaan sambungan
/// ditentukan oleh **apakah peladen benar-benar menjawab**.
library;

enum KeadaanKoneksi { daring, luring, memeriksa, terbatas }

extension KeadaanKoneksiNama on KeadaanKoneksi {
  String get nama => switch (this) {
        KeadaanKoneksi.daring => 'DARING',
        KeadaanKoneksi.luring => 'LURING',
        KeadaanKoneksi.memeriksa => 'MEMERIKSA',
        KeadaanKoneksi.terbatas => 'TERBATAS',
      };
}

class RingkasanKoneksi {
  const RingkasanKoneksi({
    required this.state,
    required this.message,
    required this.queueing,
    required this.lastReachableAgoMs,
  });

  final KeadaanKoneksi state;

  /// Kalimat yang dibaca kasir. Selalu menyebutkan akibatnya bagi pekerjaannya.
  final String message;

  /// Benar bila transaksi baru akan tersimpan lokal dahulu.
  final bool queueing;

  /// Milidetik sejak peladen terakhir menjawab; null bila belum pernah.
  final int? lastReachableAgoMs;
}

/// Berapa lama peladen boleh diam sebelum sambungan dianggap tidak sehat,
/// meski perangkat masih melaporkan ada jaringan.
const int ambangDiamMs = 30000;

RingkasanKoneksi nilaiKoneksi({
  /// Laporan perangkat. Dipakai sebagai petunjuk, bukan sebagai kebenaran.
  required bool browserOnline,
  required int? lastReachableAt,
  required int? lastAttemptAt,

  /// Percobaan terakhir berhasil? Null bila belum pernah mencoba.
  required bool? lastAttemptOk,
  required int now,
}) {
  final jeda = lastReachableAt == null ? null : now - lastReachableAt;

  if (lastAttemptOk == null) {
    return RingkasanKoneksi(
      state: KeadaanKoneksi.memeriksa,
      message: 'Memeriksa sambungan ke peladen…',
      queueing: false,
      lastReachableAgoMs: jeda,
    );
  }

  if (!browserOnline) {
    return RingkasanKoneksi(
      state: KeadaanKoneksi.luring,
      message: 'Tidak ada jaringan. Transaksi disimpan di mesin ini dan dikirim '
          'otomatis nanti.',
      queueing: true,
      lastReachableAgoMs: jeda,
    );
  }

  if (!lastAttemptOk) {
    // Keadaan yang paling menyesatkan bila tidak dibedakan: jaringan ada,
    // peladen tidak menjawab. Kasir perlu tahu bahwa masalahnya bukan pada kabel
    // di mejanya, supaya tidak menghabiskan waktu mencabut-colok router.
    return RingkasanKoneksi(
      state: KeadaanKoneksi.terbatas,
      message: 'Jaringan tersambung, tetapi peladen tidak menjawab. Transaksi '
          'disimpan di mesin ini dan dikirim otomatis begitu peladen kembali.',
      queueing: true,
      lastReachableAgoMs: jeda,
    );
  }

  if (jeda != null && jeda > ambangDiamMs) {
    return RingkasanKoneksi(
      state: KeadaanKoneksi.terbatas,
      message: 'Peladen terakhir menjawab ${(jeda / 1000).round()} detik lalu. '
          'Sambungan sedang tidak stabil.',
      queueing: true,
      lastReachableAgoMs: jeda,
    );
  }

  return RingkasanKoneksi(
    state: KeadaanKoneksi.daring,
    message: 'Tersambung ke peladen.',
    queueing: false,
    lastReachableAgoMs: jeda,
  );
}

/// Jeda maksimum sebelum percobaan berikutnya.
///
/// Mencoba setiap detik saat peladen mati hanya membebani mesin kasir tanpa
/// membuat peladen kembali lebih cepat. Tetapi jedanya dibatasi: kasir yang
/// menunggu peladen pulih tidak boleh menunggu lebih lama daripada yang
/// diperlukan setelah peladen benar-benar hidup lagi.
const int jedaMaksMs = 30000;

int jedaPercobaan(int gagalBerturut) {
  if (gagalBerturut <= 0) return 5000;
  final pangkat = gagalBerturut - 1 > 10 ? 10 : gagalBerturut - 1;
  final jeda = 2000 * (1 << pangkat);
  return jeda > jedaMaksMs ? jedaMaksMs : jeda;
}

/// Warna lencana pada batang status. Dipisah supaya dapat diuji tanpa antarmuka.
String warnaKoneksi(KeadaanKoneksi state) => switch (state) {
      KeadaanKoneksi.daring => 'hijau',
      KeadaanKoneksi.terbatas => 'kuning',
      KeadaanKoneksi.luring => 'merah',
      KeadaanKoneksi.memeriksa => 'kelabu',
    };
