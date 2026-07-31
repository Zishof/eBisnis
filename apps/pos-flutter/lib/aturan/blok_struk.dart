/// Jatah nomor struk untuk mesin kasir yang berjualan tanpa peladen.
///
/// Salinan Dart dari `apps/web/src/pos-offline/blok-struk.ts`.
///
/// Nomor struk harus unik di seluruh tenant. Saat luring, mesin kasir tidak
/// dapat bertanya — bila ia menerka, dua register yang sama-sama luring akan
/// mencetak nomor yang sama, dan benturannya baru ketahuan ketika kedua struk
/// sudah berada di tangan dua pembeli berbeda.
///
/// Karena itu register memesan **jatah** selagi masih daring: peladen memajukan
/// `number_sequence` sejauh ukuran jatah dan mencatat rentangnya milik register
/// itu. Tidak ada sumber penomoran kedua — hanya potongan yang dipesan dari
/// sumber yang sudah ada.
library;

class BlokStruk {
  const BlokStruk({
    required this.blockId,
    required this.terminalId,
    required this.outletId,
    required this.prefix,
    required this.padding,
    required this.fromNumber,
    required this.toNumber,
    required this.nextNumber,
    required this.allocatedAt,
    this.businessDate,
  });

  final String blockId;
  final String terminalId;
  final String outletId;
  final String prefix;
  final int padding;

  /// Nomor pertama pada jatah, ikut terpakai.
  final int fromNumber;

  /// Nomor terakhir pada jatah, ikut terpakai.
  final int toNumber;

  /// Nomor berikutnya yang belum dipakai.
  final int nextNumber;
  final String allocatedAt;
  final String? businessDate;

  BlokStruk salinDengan({int? nextNumber}) => BlokStruk(
        blockId: blockId,
        terminalId: terminalId,
        outletId: outletId,
        prefix: prefix,
        padding: padding,
        fromNumber: fromNumber,
        toNumber: toNumber,
        nextNumber: nextNumber ?? this.nextNumber,
        allocatedAt: allocatedAt,
        businessDate: businessDate,
      );
}

enum KeadaanBlok { tidakAda, cukup, menipis, habis, salahRegister }

/// Nama yang dipakai pada vektor konformansi bersama.
extension KeadaanBlokNama on KeadaanBlok {
  String get nama => switch (this) {
        KeadaanBlok.tidakAda => 'TIDAK_ADA',
        KeadaanBlok.cukup => 'CUKUP',
        KeadaanBlok.menipis => 'MENIPIS',
        KeadaanBlok.habis => 'HABIS',
        KeadaanBlok.salahRegister => 'SALAH_REGISTER',
      };
}

class PenilaianBlok {
  const PenilaianBlok({
    required this.state,
    required this.remaining,
    required this.usable,
    required this.message,
  });

  final KeadaanBlok state;
  final int remaining;

  /// Boleh dipakai menerbitkan struk luring?
  final bool usable;
  final String message;
}

/// Sisa jatah yang membuat layar mulai memperingatkan.
///
/// Peringatannya bukan supaya kasir berhemat — nomor struk tidak perlu dihemat —
/// melainkan supaya ia sempat menyambung ke peladen sebelum jatahnya habis.
/// Peringatan yang muncul saat sisa satu tidak menolong siapa pun.
const int ambangMenipis = 20;

int sisaBlok(BlokStruk b) {
  final sisa = b.toNumber - b.nextNumber + 1;
  return sisa < 0 ? 0 : sisa;
}

PenilaianBlok nilaiBlok(BlokStruk? blok, String? terminalId) {
  if (blok == null) {
    return const PenilaianBlok(
      state: KeadaanBlok.tidakAda,
      remaining: 0,
      usable: false,
      message: 'Register ini belum punya jatah nomor struk. Sambungkan ke peladen '
          'sekali untuk mengambil jatah sebelum berjualan luring.',
    );
  }

  // Jatah milik register lain tidak boleh dipakai, meskipun ada di mesin ini.
  // Terjadi ketika satu komputer dipakai bergantian sebagai dua register.
  if (terminalId != null && blok.terminalId != terminalId) {
    return const PenilaianBlok(
      state: KeadaanBlok.salahRegister,
      remaining: 0,
      usable: false,
      message: 'Jatah nomor struk yang tersimpan milik register lain. Ambil jatah '
          'baru untuk register ini sebelum berjualan luring.',
    );
  }

  final sisa = sisaBlok(blok);
  if (sisa <= 0) {
    return const PenilaianBlok(
      state: KeadaanBlok.habis,
      remaining: 0,
      usable: false,
      message: 'Jatah nomor struk habis. Penjualan luring dihentikan sampai peladen '
          'dapat dihubungi untuk mengambil jatah baru — struk tanpa nomor tidak '
          'dapat dipertanggungjawabkan.',
    );
  }

  if (sisa <= ambangMenipis) {
    return PenilaianBlok(
      state: KeadaanBlok.menipis,
      remaining: sisa,
      usable: true,
      message: 'Jatah nomor struk tinggal $sisa. Sambungkan ke peladen untuk '
          'mengambil jatah baru.',
    );
  }

  return PenilaianBlok(
    state: KeadaanBlok.cukup,
    remaining: sisa,
    usable: true,
    message: 'Jatah nomor struk tersisa $sisa.',
  );
}

class NomorTerambil {
  const NomorTerambil({required this.nomor, required this.blok});

  final String nomor;
  final BlokStruk blok;
}

/// Mengambil satu nomor dari jatah.
///
/// Tidak mengubah masukannya: pemanggil yang menyimpan hasilnya, dan penyimpanan
/// itu harus berhasil **sebelum** struknya tercetak. Kalau urutannya dibalik,
/// mesin yang mati di antara keduanya akan menerbitkan nomor yang sama dua kali.
NomorTerambil? ambilNomor(BlokStruk blok) {
  if (sisaBlok(blok) <= 0) return null;
  final n = blok.nextNumber;
  return NomorTerambil(
    nomor: '${blok.prefix}${n.toString().padLeft(blok.padding, '0')}',
    blok: blok.salinDengan(nextNumber: n + 1),
  );
}
