/// Aturan antrean luring: apa yang dilakukan terhadap perintah yang gagal
/// dikirim.
///
/// ## Cacat yang ditutup
///
/// Antrean lama mengulang SETIAP kegagalan selamanya, dan berhenti pada
/// kegagalan pertama:
///
/// ```dart
/// } on Object catch (error) {
///   await database.markFailed(item, error);
///   break;                                  // seluruh pengurasan berhenti
/// }
/// ```
///
/// `markFailed` hanya menaikkan jumlah percobaan dan menunda paling lama satu
/// jam. Tidak ada keadaan "ditolak permanen".
///
/// Akibatnya satu perintah yang ditolak peladen secara sah — 400 karena
/// datanya salah, 403 karena haknya kurang — **meracuni seluruh antrean**.
/// Ia dicoba lagi tiap jam, gagal lagi, dan `break` membuat semua yang
/// mengantre di belakangnya tidak pernah terkirim. Selamanya, tanpa satu pun
/// galat yang memberi tahu pemakainya bahwa penjualan atau pembelian berikutnya
/// tidak pernah sampai.
///
/// Menyambungkan perintah pembelian ke antrean yang sama tanpa memperbaiki ini
/// akan melipatgandakan kerusakannya: satu penerimaan barang yang ditolak
/// menghentikan setiap pembelian, penerimaan, dan pembayaran sesudahnya.
///
/// ## Aturannya
///
/// Perbedaan yang menentukan: **peladen tidak dapat dihubungi** melawan
/// **peladen menjawab tidak**.
///
/// Yang pertama pasti sementara — jaringan putus, timeout, peladen sibuk. Itu
/// gunanya antrean.
///
/// Yang kedua adalah jawaban. Mengulanginya tiap jam tidak akan mengubah
/// jawabannya, dan setiap pengulangan hanya menunda perintah lain yang
/// sebenarnya baik-baik saja.
library;

/// Apa yang harus dilakukan terhadap satu perintah yang gagal.
enum KeputusanAntrean {
  /// Peladen tidak terjangkau atau sedang bermasalah. Dicoba lagi nanti.
  ulangiNanti,

  /// Peladen menjawab tidak, dan jawabannya tidak akan berubah. Berhenti
  /// mencoba; tetap disimpan supaya pemakainya dapat melihat dan memperbaiki.
  menyerah,

  /// Bentrok versi. Didaftarkan sebagai konflik, lalu berhenti dicoba —
  /// penyelesaiannya butuh keputusan manusia, bukan pengulangan.
  konflik,
}

/// Status yang disimpan pada baris antrean.
class StatusAntrean {
  static const pending = 'PENDING';
  static const failed = 'FAILED';
  static const completed = 'COMPLETED';

  /// Ditolak permanen. TIDAK pernah diulang, dan tidak ikut dihitung sebagai
  /// pekerjaan yang tertunda — tetapi tetap disimpan sebagai bukti.
  static const rejected = 'REJECTED';

  /// Bentrok versi yang menunggu keputusan manusia.
  static const conflict = 'CONFLICT';

  /// Status yang masih akan dicoba lagi oleh pengurasan.
  static const dapatDiulang = <String>[pending, failed];
}

/// Memutuskan nasib satu perintah yang gagal dikirim.
///
/// [statusCode] kosong berarti permintaannya tidak pernah sampai ke peladen
/// (jaringan putus, timeout, DNS gagal).
KeputusanAntrean putuskanKegagalan({int? statusCode}) {
  if (statusCode == null) return KeputusanAntrean.ulangiNanti;

  // Bentrok versi diperiksa lebih dahulu: ia 4xx, tetapi bukan penolakan biasa.
  if (statusCode == 409) return KeputusanAntrean.konflik;

  /*
   * 408 dan 429 berbentuk 4xx tetapi artinya "coba lagi", bukan "tidak".
   * Memasukkannya ke kelompok menyerah akan membuang perintah yang sah hanya
   * karena peladen sedang sibuk.
   */
  if (statusCode == 408 || statusCode == 429) return KeputusanAntrean.ulangiNanti;

  /*
   * 401 sengaja diulang, bukan menyerah: token kedaluwarsa adalah keadaan
   * sementara yang pulih sendiri sesudah pengguna masuk kembali. Menyerah di
   * sini akan membuang seluruh pekerjaan luring hanya karena sesinya habis
   * selagi perangkat tidak tersambung.
   */
  if (statusCode == 401) return KeputusanAntrean.ulangiNanti;

  if (statusCode >= 400 && statusCode < 500) return KeputusanAntrean.menyerah;

  // 5xx: peladennya yang bermasalah, bukan perintahnya.
  return KeputusanAntrean.ulangiNanti;
}

/// Status yang disimpan untuk sebuah keputusan.
String statusUntuk(KeputusanAntrean keputusan) {
  switch (keputusan) {
    case KeputusanAntrean.ulangiNanti:
      return StatusAntrean.failed;
    case KeputusanAntrean.menyerah:
      return StatusAntrean.rejected;
    case KeputusanAntrean.konflik:
      return StatusAntrean.conflict;
  }
}

/// Apakah pengurasan boleh melanjutkan ke perintah berikutnya.
///
/// Berhenti HANYA ketika peladen tidak terjangkau: perintah berikutnya pasti
/// gagal dengan sebab yang sama, dan mencobanya hanya menambah kegagalan yang
/// tidak berarti.
///
/// Untuk penolakan dan konflik, pengurasan JALAN TERUS. Justru di sinilah
/// racunnya dulu: satu penolakan menahan seluruh antrean di belakangnya.
bool lanjutkanPengurasan(KeputusanAntrean keputusan) {
  return keputusan != KeputusanAntrean.ulangiNanti;
}

/// Jeda sebelum percobaan berikutnya, dalam menit.
///
/// Naik dua kali lipat sampai 32 menit, lalu tetap 60. Cerminan perilaku
/// `markFailed()` yang sudah berjalan; ada di sini supaya dapat diuji tanpa
/// basis data.
int jedaMenit(int attempts) {
  final n = attempts < 0 ? 0 : attempts;
  return n >= 6 ? 60 : 1 << (n > 5 ? 5 : n);
}

/// Perintah yang boleh menunggu di antrean saat perangkat luring.
///
/// Daftar putih, bukan daftar hitam: perintah yang tidak disebut di sini TIDAK
/// diantrekan. Perintah baru harus diputuskan secara sadar, bukan ikut
/// terbawa karena kebetulan cocok dengan sebuah pola.
///
/// Yang sengaja TIDAK ada di sini:
///
/// - **Pembayaran hutang dan penerimaan piutang** (`/ap/payments`,
///   `/ar/receipts`). Membuat pembayaran saat luring berarti uang tercatat
///   keluar pada saat yang tidak dapat dilihat siapa pun, terhadap saldo yang
///   mungkin sudah berubah ketika akhirnya terkirim. Itu keputusan pemilik,
///   bukan keputusan yang boleh diambil diam-diam di sini.
/// - Segala perintah pembalikan. Membalik sesuatu yang belum tentu sudah
///   tercatat adalah cara tercepat membuat dua sistem berbeda pendapat.
bool bolehDiantre(String method, String path) {
  if (method != 'POST' && method != 'PATCH') return false;
  final bersih = path.split('?').first;

  for (final pola in _polaBolehDiantre) {
    if (pola.hasMatch(bersih)) return true;
  }
  return false;
}

final List<RegExp> _polaBolehDiantre = <RegExp>[
  // Master pihak — sudah berjalan sebelum berkas ini ada.
  RegExp(r'^/(suppliers|customers|salespeople)(/[0-9a-fA-F-]+)?$'),
  // Pesanan penjualan luring — sudah berjalan.
  RegExp(r'^/sales-orders(/[0-9a-fA-F-]+)?$'),
  RegExp(r'^/mobile/sales-orders(/[0-9a-fA-F-]+)?$'),

  // --- Pembelian: dokumen dan transisinya --------------------------------
  RegExp(r'^/purchase-orders$'),
  RegExp(r'^/purchase-orders/[0-9a-fA-F-]+/(submit|approve|send)$'),
  RegExp(r'^/goods-receipts$'),
  RegExp(r'^/goods-receipts/[0-9a-fA-F-]+/(inspect|validate|supplier-invoice)$'),
];
