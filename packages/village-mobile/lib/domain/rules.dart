/// Aturan Aplikasi Warga Desa — fungsi murni, tanpa jaringan dan tanpa layar.
///
/// Diuji `flutter test` tanpa perangkat maupun peladen. Aturan yang hanya hidup
/// di dalam widget hanya dapat diuji dengan menjalankan aplikasinya, dan yang
/// hanya dapat diuji begitu jarang diuji.
library;

/// Hasil pemeriksaan yang membawa alasannya.
///
/// Alasannya ditulis untuk dibaca warga, bukan untuk dicatat di log. Aplikasi
/// warga desa dipakai orang yang tidak akan menghubungi siapa pun ketika
/// bingung — ia hanya berhenti memakainya.
class Putusan {
  const Putusan.boleh() : bolehkah = true, alasan = null;
  const Putusan.tolak(this.alasan) : bolehkah = false;

  final bool bolehkah;
  final String? alasan;
}

// --- Tautan akun -------------------------------------------------------------

/// Keadaan akun terhadap data kependudukan.
///
/// Penautan dilakukan **petugas** setelah memastikan identitasnya, bukan oleh
/// pemilik akun. Akun yang menautkan dirinya sendiri hanya perlu menebak NIK
/// orang lain untuk membuka datanya.
enum KeadaanTautan { tertaut, belumTertaut, dicabut }

class Tautan {
  const Tautan(this.keadaan);
  final KeadaanTautan keadaan;

  /// Layanan yang memerlukan data kependudukan.
  static const perluTautan = {
    'PERMOHONAN_SURAT',
    'DATA_DIRI',
    'KARTU_KELUARGA',
    'STATUS_BANTUAN',
  };

  /// Layanan yang tetap terbuka bagi akun yang belum tertaut.
  ///
  /// Pengumuman dan pengaduan sengaja termasuk: warga yang belum sempat ke
  /// kantor desa tetap harus dapat membaca pengumuman dan melapor jalan rusak.
  /// Mengunci seluruh aplikasi sampai penautannya selesai membuat orang
  /// menghapusnya sebelum sempat memakainya.
  static const terbukaTanpaTautan = {'PENGUMUMAN', 'PENGADUAN', 'AGENDA', 'PANDUAN'};

  Putusan boleh(String layanan) {
    if (terbukaTanpaTautan.contains(layanan)) return const Putusan.boleh();
    if (keadaan == KeadaanTautan.tertaut) return const Putusan.boleh();
    if (keadaan == KeadaanTautan.dicabut) {
      return const Putusan.tolak(
        'Tautan akun Anda ke data kependudukan sudah dicabut. Datang ke kantor desa '
        'dengan membawa KTP untuk menautkannya kembali.',
      );
    }
    return const Putusan.tolak(
      'Akun Anda belum tertaut ke data kependudukan desa. Datang sekali ke kantor desa '
      'dengan membawa KTP; petugas akan menautkannya. Sesudah itu, layanan ini dapat '
      'dipakai dari rumah.',
    );
  }
}

// --- Pengaduan ---------------------------------------------------------------

/// Cara nama pelapor diperlakukan.
///
/// **`tanpaNamaPublik` BUKAN anonim.** Aplikasi ini mengharuskan masuk, sehingga
/// peladen selalu mengetahui siapa yang mengirim. Menyebutnya "anonim" adalah
/// janji yang tidak dapat ditepati aplikasi mana pun yang memakai akun.
///
/// Yang benar-benar anonim adalah jalur anjungan di kantor desa, yang tidak
/// menyimpan identitas sama sekali. Aplikasi mengarahkan ke sana bila warga
/// memang memerlukannya — dan mengatakannya terus terang.
enum ModeNama { cantumkan, tanpaNamaPublik }

class PesanMode {
  const PesanMode(this.judul, this.uraian);
  final String judul;
  final String uraian;
}

const pesanMode = {
  ModeNama.cantumkan: PesanMode(
    'Cantumkan nama saya',
    'Petugas dapat menghubungi Anda untuk menanyakan keterangan tambahan.',
  ),
  ModeNama.tanpaNamaPublik: PesanMode(
    'Jangan tampilkan nama saya',
    'Nama Anda tidak muncul pada daftar pengaduan yang dilihat warga lain. '
        'Petugas desa tetap dapat melihatnya — aplikasi ini memakai akun, '
        'sehingga tidak dapat menjanjikan anonim sepenuhnya. '
        'Bila Anda memerlukan pelaporan yang benar-benar tanpa identitas, '
        'gunakan anjungan di kantor desa.',
  ),
};

/// Sumber titik lokasi pada pengaduan.
///
/// **Lokasi yang dikirim adalah lokasi kejadian, bukan lokasi ponsel.**
///
/// Melampirkan GPS ponsel secara otomatis berarti aplikasi ini melacak di mana
/// warganya berada setiap kali ia melapor. Lebih buruk lagi, ia salah: orang
/// yang melaporkan jalan rusak biasanya melaporkannya sesudah sampai rumah,
/// bukan sambil berdiri di lubangnya.
enum SumberLokasi {
  /// Warga menunjuk sendiri pada peta, atau menuliskannya.
  ditunjukWarga,

  /// Posisi ponsel, HANYA bila warga menekan "pakai lokasi saya sekarang".
  posisiSekarang,

  /// Tidak dilampirkan.
  tidakAda,
}

class Pengaduan {
  const Pengaduan({
    required this.judul,
    required this.uraian,
    required this.modeNama,
    required this.sumberLokasi,
    this.keteranganLokasi,
    this.jumlahFoto = 0,
  });

  final String judul;
  final String uraian;
  final ModeNama modeNama;
  final SumberLokasi sumberLokasi;
  final String? keteranganLokasi;
  final int jumlahFoto;
}

/// Jumlah foto yang wajar untuk satu pengaduan.
///
/// Batasnya bukan pelit ruang: pengaduan dengan dua puluh foto tidak dibaca
/// petugas mana pun, dan yang tidak dibaca tidak ditindaklanjuti. Tiga foto
/// cukup untuk memperlihatkan keadaan, tempat, dan ukurannya.
const kFotoMaksimal = 3;

Putusan periksaPengaduan(Pengaduan p) {
  if (p.uraian.trim().length < 10) {
    return const Putusan.tolak(
      'Ceritakan laporan Anda sedikit lebih panjang agar dapat ditindaklanjuti.',
    );
  }
  if (p.judul.trim().isEmpty) {
    return const Putusan.tolak('Beri judul singkat, misalnya "Jalan berlubang depan masjid".');
  }
  if (p.jumlahFoto > kFotoMaksimal) {
    return const Putusan.tolak(
      'Paling banyak $kFotoMaksimal foto. Pengaduan dengan terlalu banyak foto '
      'jarang selesai dibaca, dan yang tidak dibaca tidak ditindaklanjuti.',
    );
  }
  final adaTempat = (p.keteranganLokasi ?? '').trim().isNotEmpty ||
      p.sumberLokasi != SumberLokasi.tidakAda;
  if (!adaTempat) {
    return const Putusan.tolak(
      'Sebutkan tempatnya, misalnya "depan masjid RT 03". Laporan tanpa tempat '
      'tidak dapat didatangi petugas.',
    );
  }
  return const Putusan.boleh();
}

// --- Draf yang tidak boleh hilang --------------------------------------------

/// Sinyal yang sedang dialami aplikasi.
enum Jaringan { ada, tidakAda, lambat }

/// Apa yang harus terjadi pada isian ketika pengiriman gagal.
///
/// **Draf disimpan, bukan dibuang.** Sinyal di desa putus-putus, dan warga yang
/// kehilangan tulisannya karena sinyal hilang tidak akan mengetiknya lagi — ia
/// akan berhenti memakai aplikasinya.
enum NasibDraf { simpanDanCobaLagi, simpanSaja, kirim }

NasibDraf nasibDraf(Jaringan jaringan) {
  switch (jaringan) {
    case Jaringan.ada:
      return NasibDraf.kirim;
    case Jaringan.lambat:
      return NasibDraf.simpanDanCobaLagi;
    case Jaringan.tidakAda:
      return NasibDraf.simpanSaja;
  }
}

// --- Status permohonan -------------------------------------------------------

/// Label status untuk warga.
///
/// Bukan kode dalam huruf besar. Warga yang membaca `MENUNGGU_PERSETUJUAN`
/// tidak tahu apakah ia harus menunggu atau datang ke kantor.
const labelStatus = <String, String>{
  'DRAF': 'Belum diajukan',
  'DIAJUKAN': 'Sudah diajukan, menunggu diperiksa',
  'BERKAS_KURANG': 'Berkas belum lengkap',
  'DIVERIFIKASI': 'Berkas sudah diperiksa',
  'MENUNGGU_PERSETUJUAN': 'Menunggu tanda tangan pejabat',
  'DISETUJUI': 'Sudah disetujui, surat sedang disiapkan',
  'DITOLAK': 'Tidak dapat diproses',
  'DITERBITKAN': 'Sudah terbit',
  'DISERAHKAN': 'Sudah diserahkan',
  'DIBATALKAN': 'Dibatalkan',
};

/// Apa yang perlu dilakukan warga pada status ini.
///
/// Status saja tidak cukup. "Berkas belum lengkap" tanpa keterangan membuat
/// warga menunggu sesuatu yang tidak akan datang.
const tindakanStatus = <String, String>{
  'BERKAS_KURANG': 'Datang ke kantor desa membawa berkas yang kurang.',
  'DITOLAK': 'Datang ke kantor desa untuk menanyakan alasannya.',
  'DITERBITKAN': 'Ambil di kantor desa, atau cetak sendiri di anjungan dengan kode ambil Anda.',
};

String labelDari(String? status) =>
    labelStatus[status ?? ''] ?? (status ?? 'Tidak diketahui');

String? tindakanDari(String? status) => tindakanStatus[status ?? ''];

// --- Kode ambil --------------------------------------------------------------

/// Sama dengan abjad anjungan: tanpa 0, O, 1, I, dan L.
const kHurufKode = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

String bersihkanKode(String masukan) =>
    masukan.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '');

String formatKode(String kode) {
  final k = bersihkanKode(kode);
  return k.length == 8 ? '${k.substring(0, 4)}-${k.substring(4)}' : k;
}

// --- Menu beranda ------------------------------------------------------------

/// Menu yang dijanjikan presentasi, persis urutannya.
class MenuWarga {
  const MenuWarga(this.kode, this.label, this.keterangan, this.perluTautan);
  final String kode;
  final String label;
  final String keterangan;
  final bool perluTautan;
}

const menuWarga = <MenuWarga>[
  MenuWarga('PERMOHONAN_SURAT', 'Ajukan Surat',
      'Tanpa antre — cukup dari rumah', true),
  MenuWarga('PENGADUAN', 'Lapor / Aduan',
      'Sertakan foto dan tempat kejadian', false),
  MenuWarga('POSYANDU', 'Jadwal Posyandu',
      'Penimbangan, imunisasi, dan kegiatan', false),
  MenuWarga('STATUS_BANTUAN', 'Info Bantuan',
      'Program bantuan yang sedang dibuka', true),
  MenuWarga('PENGUMUMAN', 'Pengumuman',
      'Berita dan kegiatan desa', false),
];

// --- Keadaan ketiga: belum tersambung ---------------------------------------

/// Keadaan sebuah layar yang bergantung pada vertikal lain.
///
/// **"Belum tersambung" bukan galat, dan bukan kosong.** Ia keadaan ketiga,
/// dan menyamakannya dengan salah satu dari keduanya sama-sama menyesatkan:
///
/// | Ditampilkan sebagai | Yang disimpulkan warga | Yang ia lakukan |
/// |---|---|---|
/// | Galat | Aplikasinya rusak | Menutup, mencoba besok, lalu menyerah |
/// | Kosong | Posyandu memang tidak ada jadwal | Tidak datang |
/// | Belum tersambung | Fiturnya belum siap | Bertanya ke kader — jawaban yang benar |
///
/// Yang ketiga itu yang benar, dan satu-satunya yang membuat warga melakukan
/// hal yang tepat.
enum KeadaanKanal { siap, belumTersambung, galat }

class TilikanKanal {
  const TilikanKanal({
    required this.keadaan,
    required this.judul,
    required this.uraian,
    this.saran,
  });

  final KeadaanKanal keadaan;
  final String judul;
  final String uraian;

  /// Apa yang dapat dilakukan warga sementara ini.
  final String? saran;
}

/// Tilikan untuk layar yang bergantung pada sistem kesehatan.
///
/// Ketika belum tersambung, layar **menjelaskan apa yang akan tampil nanti**
/// lalu menyebutkan jalan lain yang sudah ada sekarang. Layar yang hanya
/// mengatakan "belum tersedia" membuat warga menutupnya dan tidak kembali.
TilikanKanal tilikPosyandu({required bool tersedia, required bool adaIsi}) {
  if (!tersedia) {
    return const TilikanKanal(
      keadaan: KeadaanKanal.belumTersambung,
      judul: 'Jadwal Posyandu belum tersambung',
      uraian:
          'Desa Anda belum menghubungkan sistem kesehatannya, sehingga jadwal Posyandu '
          'belum dapat ditampilkan di sini. Jadwal yang tampil nanti berisi tanggal, '
          'tempat, dan kegiatan tiap Posyandu.',
      saran:
          'Sementara ini, tanyakan jadwalnya kepada kader Posyandu atau bidan desa. '
          'Jadwal juga biasanya diumumkan di pengumuman desa.',
    );
  }
  if (!adaIsi) {
    return const TilikanKanal(
      keadaan: KeadaanKanal.siap,
      judul: 'Belum ada jadwal',
      uraian: 'Belum ada kegiatan Posyandu yang dijadwalkan untuk waktu dekat.',
    );
  }
  return const TilikanKanal(
    keadaan: KeadaanKanal.siap,
    judul: 'Jadwal Posyandu',
    uraian: '',
  );
}

// --- Status bantuan milik sendiri -------------------------------------------

/// Keadaan warga terhadap sebuah program bantuan.
enum StatusPenerima { penerima, bukanPenerima, sedangDinilai }

/// Pesan status bantuan.
///
/// **Alasan penolakan TIDAK disampaikan lewat aplikasi.** D-7 menetapkan bahwa
/// warga yang tidak menerima bantuan berhak mendapat jawaban *dari seseorang* —
/// dan layar ponsel bukan seseorang.
///
/// Kalimat "Anda tidak memenuhi syarat karena penghasilan Anda terlalu tinggi"
/// yang muncul sendirian di layar, tanpa ada yang dapat ditanyai balik, lebih
/// melukai daripada menjelaskan. Aplikasi menyampaikan keputusannya, lalu
/// mengarahkan ke orang yang dapat menjelaskannya.
TilikanKanal tilikStatusBantuan(StatusPenerima s) => switch (s) {
      StatusPenerima.penerima => const TilikanKanal(
          keadaan: KeadaanKanal.siap,
          judul: 'Anda terdaftar sebagai penerima',
          uraian: 'Penyaluran akan diumumkan desa. Bawa KTP saat pengambilan.',
        ),
      StatusPenerima.sedangDinilai => const TilikanKanal(
          keadaan: KeadaanKanal.siap,
          judul: 'Sedang dinilai',
          uraian:
              'Nama Anda masuk daftar calon dan sedang diverifikasi petugas. '
              'Petugas mungkin datang ke rumah untuk memastikan keadaannya.',
        ),
      StatusPenerima.bukanPenerima => const TilikanKanal(
          keadaan: KeadaanKanal.siap,
          judul: 'Anda belum terdaftar sebagai penerima',
          uraian: 'Untuk program ini, nama Anda belum termasuk penerima.',
          // Diarahkan ke orang, bukan diberi alasan oleh layar.
          saran:
              'Untuk menanyakan alasannya atau mengajukan keberatan, datang ke kantor '
              'desa. Petugas dapat menjelaskannya dan mencatat keberatan Anda.',
        ),
    };
