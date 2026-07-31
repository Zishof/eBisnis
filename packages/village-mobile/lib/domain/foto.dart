/// Foto lampiran pengaduan — aturan dan pembersihan metadata di sisi ponsel.
///
/// ## Mengapa metadata dibuang di ponsel, padahal peladen sudah membuangnya
///
/// Bukan karena peladennya tidak dipercaya. Peladen tetap membuangnya, dan
/// tetap menolak berkas yang metadatanya bertahan — kelak akan ada aplikasi
/// lain, dan aplikasi tidak pernah menjadi tempat menegakkan aturan.
///
/// Yang berubah bila pembuangannya dilakukan di sini adalah **koordinatnya
/// tidak pernah meninggalkan ponsel sama sekali**. Foto yang dikirim mentah
/// membawa koordinat rumah warga melewati jaringan seluler, singgah di memori
/// peladen, dan mungkin tercatat pada log perantara sebelum sempat dibersihkan.
/// Dibuang di sini, tidak satu pun dari itu terjadi.
///
/// Perbedaannya nyata bagi orang yang mengadukan tetangganya sendiri.
///
/// ## Yang dibuang
///
/// JPEG: seluruh ruas APP0–APP15 dan komentar. Di dalamnya ada EXIF (koordinat
/// GPS, merek dan nomor seri kamera, waktu pemotretan) dan seringkali gambar
/// kecil pratinjau yang **isinya bisa berbeda dari gambar utama** — foto yang
/// dipotong untuk menutupi wajah kerap menyisakan wajah itu pada pratinjaunya.
///
/// PNG: hanya potongan yang benar-benar diperlukan untuk menampilkan gambar
/// yang dipertahankan. Daftar izin, bukan daftar larangan: potongan yang belum
/// dikenal hari ini akan ikut terbuang, bukan ikut lolos.
library;

import 'dart:typed_data';

/// Sama dengan batas peladen. Diperiksa di sini agar warga tahu sebelum
/// menghabiskan kuotanya untuk unggahan yang akan ditolak.
const int ukuranMaksimalByte = 8 * 1024 * 1024;

/// Sama dengan `BERKAS_MAKSIMAL_PER_PENGADUAN` pada peladen.
const int fotoMaksimal = 3;

enum JenisFoto { jpeg, png }

extension JenisFotoMime on JenisFoto {
  String get mime => switch (this) {
        JenisFoto.jpeg => 'image/jpeg',
        JenisFoto.png => 'image/png',
      };
}

/// Menentukan jenis dari **isi berkas**, bukan dari namanya.
///
/// Nama berkas dapat diubah siapa saja, dan galeri Android mengembalikan
/// `.jpg` untuk berkas yang sebenarnya HEIC pada sebagian perangkat.
JenisFoto? jenisFoto(Uint8List data) {
  if (data.length >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF) {
    return JenisFoto.jpeg;
  }
  const png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (data.length >= 8) {
    for (var i = 0; i < 8; i++) {
      if (data[i] != png[i]) return null;
    }
    return JenisFoto.png;
  }
  return null;
}

class PutusanFoto {
  const PutusanFoto(this.boleh, [this.alasan]);
  final bool boleh;
  final String? alasan;
}

PutusanFoto periksaFoto(Uint8List data) {
  if (data.isEmpty) {
    return const PutusanFoto(false, 'Berkas foto kosong. Coba pilih ulang.');
  }
  if (data.length > ukuranMaksimalByte) {
    final mb = (data.length / 1024 / 1024).toStringAsFixed(1);
    return PutusanFoto(
      false,
      'Ukuran foto $mb MB, melebihi batas 8 MB. Pilih foto lain atau potret ulang '
      'dengan mutu lebih rendah.',
    );
  }
  if (jenisFoto(data) == null) {
    return const PutusanFoto(
      false,
      'Berkas ini bukan foto JPG atau PNG. Sebagian iPhone menyimpan foto dalam bentuk '
      'HEIC — ubah dahulu ke JPG pada Pengaturan > Kamera > Format > Paling Kompatibel.',
    );
  }
  return const PutusanFoto(true);
}

PutusanFoto bolehTambahFoto(int jumlahSekarang) {
  if (jumlahSekarang >= fotoMaksimal) {
    return const PutusanFoto(
      false,
      'Sudah $fotoMaksimal foto. Hapus salah satu bila ingin mengganti. '
      'Tiga foto cukup untuk menunjukkan keadaan; selebihnya memperlambat petugas '
      'membaca aduan Anda.',
    );
  }
  return const PutusanFoto(true);
}

// --- Pembuangan metadata ----------------------------------------------------

/// Membuang seluruh ruas APPn dan komentar dari JPEG.
///
/// Mengembalikan `null` bila bentuknya tidak dikenali — dan yang tidak dikenali
/// **tidak dikirim**, bukan dikirim apa adanya.
Uint8List? buangMetadataJpeg(Uint8List data) {
  if (data.length < 4 || data[0] != 0xFF || data[1] != 0xD8) return null;

  final keluar = BytesBuilder();
  keluar.add([0xFF, 0xD8]); // SOI

  var i = 2;
  while (i < data.length) {
    if (data[i] != 0xFF) return null; // bukan batas segmen: berkas rusak

    // Bita pengisi 0xFF berturut-turut dibolehkan oleh standar.
    var j = i;
    while (j < data.length && data[j] == 0xFF) {
      j += 1;
    }
    if (j >= data.length) return null;

    final penanda = data[j];

    // SOS: sesudahnya data terkompresi sampai akhir berkas — ia gambarnya
    // sendiri, disalin apa adanya.
    if (penanda == 0xDA) {
      keluar.add([0xFF, 0xDA]);
      keluar.add(data.sublist(j + 1));
      return keluar.toBytes();
    }

    if (penanda == 0xD9) {
      keluar.add([0xFF, 0xD9]);
      return keluar.toBytes();
    }

    if (j + 2 >= data.length) return null;
    final panjang = (data[j + 1] << 8) | data[j + 2];
    if (panjang < 2 || j + 1 + panjang > data.length) return null;

    // APP0–APP15 (0xE0–0xEF) dan COM (0xFE) dibuang seluruhnya.
    final dibuang = (penanda >= 0xE0 && penanda <= 0xEF) || penanda == 0xFE;
    if (!dibuang) {
      keluar.add([0xFF, penanda]);
      keluar.add(data.sublist(j + 1, j + 1 + panjang));
    }
    i = j + 1 + panjang;
  }

  // Habis tanpa pernah menemukan data pindai: berkasnya tidak utuh.
  //
  // Mengembalikan apa yang sempat terkumpul akan menghasilkan berkas dua bita
  // yang tetap lolos pemeriksaan bita awal di peladen — foto yang unggahannya
  // terputus di tengah akan tersimpan sebagai berkas yang tidak dapat dibuka
  // siapa pun, dan baru ketahuan ketika petugas mencoba melihatnya.
  return null;
}

/// Potongan PNG yang dipertahankan. Daftar izin.
const _potonganDiizinkan = {'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'sRGB'};

Uint8List? buangMetadataPng(Uint8List data) {
  if (jenisFoto(data) != JenisFoto.png) return null;

  final keluar = BytesBuilder();
  keluar.add(data.sublist(0, 8)); // tanda tangan

  var i = 8;
  var adaIhdr = false;
  var adaIdat = false;

  while (i + 8 <= data.length) {
    final panjang =
        (data[i] << 24) | (data[i + 1] << 16) | (data[i + 2] << 8) | data[i + 3];
    if (panjang < 0) return null;
    final akhir = i + 12 + panjang; // 4 panjang + 4 jenis + isi + 4 CRC
    if (akhir > data.length) return null;

    final jenis = String.fromCharCodes(data.sublist(i + 4, i + 8));
    if (_potonganDiizinkan.contains(jenis)) {
      keluar.add(data.sublist(i, akhir));
      if (jenis == 'IHDR') adaIhdr = true;
      if (jenis == 'IDAT') adaIdat = true;
    }

    i = akhir;
    if (jenis == 'IEND') break;
  }

  // Tanpa keterangan gambar atau tanpa data gambar, yang tersisa bukan foto.
  if (!adaIhdr || !adaIdat) return null;
  return keluar.toBytes();
}

Uint8List? buangMetadata(JenisFoto jenis, Uint8List data) => switch (jenis) {
      JenisFoto.jpeg => buangMetadataJpeg(data),
      JenisFoto.png => buangMetadataPng(data),
    };

/// Hasil penyiapan satu foto sebelum dikirim.
class FotoSiap {
  const FotoSiap({
    required this.data,
    required this.jenis,
    required this.ukuranAsli,
    required this.namaAsli,
  });

  final Uint8List data;
  final JenisFoto jenis;
  final int ukuranAsli;
  final String namaAsli;

  /// Benar bila pembersihan benar-benar membuang sesuatu. Dipakai untuk
  /// memberi tahu warga apa yang terjadi pada fotonya — bukan sekadar
  /// menyatakan "aman" tanpa dasar.
  bool get adaYangDibuang => ukuranAsli > data.length;
  int get byteDibuang => ukuranAsli - data.length;
}

/// Menyiapkan foto: memeriksa, lalu membuang metadatanya.
///
/// Melempar [FotoDitolak] dengan alasan yang dapat dibaca warga.
FotoSiap siapkanFoto(Uint8List mentah, String namaAsli) {
  final v = periksaFoto(mentah);
  if (!v.boleh) throw FotoDitolak(v.alasan!);

  final jenis = jenisFoto(mentah)!;
  final bersih = buangMetadata(jenis, mentah);
  if (bersih == null) {
    // Tidak dikirim apa adanya. Foto yang bentuknya tidak dikenali mungkin
    // membawa apa saja, dan mengirimnya berarti menyerahkan keputusan itu
    // kepada kebetulan.
    throw const FotoDitolak(
      'Foto ini tidak dapat diproses di ponsel Anda, sehingga tidak dikirim. '
      'Coba potret ulang dengan aplikasi kamera bawaan.',
    );
  }

  return FotoSiap(
    data: bersih,
    jenis: jenis,
    ukuranAsli: mentah.length,
    namaAsli: namaAsli,
  );
}

class FotoDitolak implements Exception {
  const FotoDitolak(this.pesan);
  final String pesan;
  @override
  String toString() => pesan;
}

/// Nasib satu foto sesudah pengaduannya tersimpan.
///
/// Ada **tiga**, bukan dua. Yang ketiga yang paling penting: pengaduannya
/// tersimpan tetapi fotonya tidak. Menyatakannya gagal seluruhnya membuat warga
/// mengadu untuk kedua kalinya; menyatakannya berhasil seluruhnya membuatnya
/// mengira petugas melihat foto yang tidak pernah sampai.
enum NasibFoto { terkirim, gagal, belumDicoba }

class RingkasanUnggah {
  const RingkasanUnggah({required this.terkirim, required this.gagal});
  final int terkirim;
  final int gagal;

  bool get semuaTerkirim => gagal == 0;

  String get pesan {
    if (terkirim == 0 && gagal == 0) return 'Laporan Anda tersimpan.';
    if (gagal == 0) {
      return 'Laporan Anda tersimpan beserta $terkirim foto.';
    }
    if (terkirim == 0) {
      return 'Laporan Anda TERSIMPAN, tetapi fotonya gagal terkirim. '
          'Laporan Anda tetap akan ditindaklanjuti. Anda dapat menambahkan foto '
          'nanti dari daftar laporan.';
    }
    return 'Laporan Anda tersimpan dengan $terkirim foto; $gagal foto gagal terkirim. '
        'Anda dapat menambahkannya lagi nanti dari daftar laporan.';
  }
}
