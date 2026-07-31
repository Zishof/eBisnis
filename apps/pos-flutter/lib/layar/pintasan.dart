/// Peta pintasan papan ketik layar kasir.
///
/// ## Mengapa ini terpisah dan murni
///
/// Peta tombol adalah hal yang paling sering ditanyakan dan paling sering
/// berubah pada mesin kasir: setiap toko punya kebiasaan, dan kasir yang pindah
/// dari sistem lama membawa jarinya. Menyimpannya sebagai tabel yang dapat
/// dibaca dan diuji membuat pertanyaan "F7 itu apa" punya satu jawaban.
///
/// ## Mengapa Flutter, bukan peramban
///
/// Peramban menahan sebagian tombol untuk dirinya sendiri: F1 membuka bantuan,
/// F5 memuat ulang, F11 layar penuh, F12 alat pengembang. `preventDefault` tidak
/// dapat merebutnya. Pada aplikasi asli seluruh tombol tersedia — dan itulah
/// satu-satunya keunggulan pintasan yang tidak dapat dikejar PWA.
///
/// Tombol lainnya (F2, F3, F4, F6 sampai F10, Esc) **sudah bekerja** pada layar
/// kasir web. Klien ini tidak menambah apa pun untuk tombol-tombol itu.
library;

import 'package:flutter/services.dart';

enum AksiKasir {
  bantuan,
  fokusPindai,
  cariProduk,
  ubahJumlah,
  hapusBaris,
  tahanKeranjang,
  ambilTertahan,
  bukaLaci,
  bayar,
  batalTransaksi,
  cetakUlangStruk,
  tutupShift,
  tutupDialog,
}

/// Keterangan yang ditampilkan pada bilah bantuan di kaki layar.
///
/// Ditulis sebagai kalimat kerja, bukan nama menu: kasir mencari "apa yang
/// terjadi kalau saya tekan ini", bukan nama internal fiturnya.
const Map<AksiKasir, String> keteranganAksi = {
  AksiKasir.bantuan: 'Bantuan',
  AksiKasir.fokusPindai: 'Ke kotak pindai',
  AksiKasir.cariProduk: 'Cari produk',
  AksiKasir.ubahJumlah: 'Ubah jumlah',
  AksiKasir.hapusBaris: 'Hapus baris',
  AksiKasir.tahanKeranjang: 'Tahan keranjang',
  AksiKasir.ambilTertahan: 'Ambil yang ditahan',
  AksiKasir.bukaLaci: 'Buka laci kas',
  AksiKasir.bayar: 'Bayar',
  AksiKasir.batalTransaksi: 'Batalkan transaksi',
  AksiKasir.cetakUlangStruk: 'Cetak ulang struk',
  AksiKasir.tutupShift: 'Tutup shift',
  AksiKasir.tutupDialog: 'Tutup / batal',
};

/// Tombol yang tidak dapat direbut peramban, sehingga hanya bekerja di sini.
///
/// Dipakai layar bantuan untuk menandainya — supaya kasir yang berpindah antara
/// klien web dan klien ini tahu mana yang berbeda, alih-alih mengira salah satu
/// rusak.
const Set<AksiKasir> hanyaDiAplikasiAsli = {
  AksiKasir.bantuan, // F1
  AksiKasir.hapusBaris, // F5
  AksiKasir.cetakUlangStruk, // F11
  AksiKasir.tutupShift, // F12
};

/// Aksi yang menghilangkan pekerjaan atau menyentuh uang, sehingga wajib
/// dikonfirmasi lebih dahulu.
///
/// Bukan karena kasir ceroboh, melainkan karena jari yang terlatih menekan lebih
/// cepat daripada mata membaca. Membatalkan transaksi berisi dua belas barang
/// karena salah menekan satu tombol adalah kerugian yang tidak dapat dipulihkan
/// selain dengan memindai ulang seluruhnya di depan antrean.
///
/// `bukaLaci` termasuk bukan karena merusak, melainkan karena membuka laci di
/// luar transaksi adalah tindakan yang harus dapat dipertanggungjawabkan.
const Set<AksiKasir> wajibKonfirmasi = {
  AksiKasir.batalTransaksi,
  AksiKasir.hapusBaris,
  AksiKasir.bukaLaci,
  AksiKasir.tutupShift,
};

// `final`, bukan `const`: Dart melarang kunci map konstan dari kelas yang
// menimpa `==`, dan `LogicalKeyboardKey` menimpanya.
final Map<LogicalKeyboardKey, AksiKasir> _peta = {
  LogicalKeyboardKey.f1: AksiKasir.bantuan,
  LogicalKeyboardKey.f2: AksiKasir.fokusPindai,
  LogicalKeyboardKey.f3: AksiKasir.cariProduk,
  LogicalKeyboardKey.f4: AksiKasir.ubahJumlah,
  LogicalKeyboardKey.f5: AksiKasir.hapusBaris,
  LogicalKeyboardKey.f6: AksiKasir.tahanKeranjang,
  LogicalKeyboardKey.f7: AksiKasir.ambilTertahan,
  LogicalKeyboardKey.f8: AksiKasir.bukaLaci,
  LogicalKeyboardKey.f9: AksiKasir.bayar,
  LogicalKeyboardKey.f10: AksiKasir.batalTransaksi,
  LogicalKeyboardKey.f11: AksiKasir.cetakUlangStruk,
  LogicalKeyboardKey.f12: AksiKasir.tutupShift,
  LogicalKeyboardKey.escape: AksiKasir.tutupDialog,
};

/// Aksi untuk sebuah tombol, atau null bila tombolnya bukan pintasan.
///
/// Tombol bermodifier (Ctrl, Alt, Shift) sengaja **tidak** dipetakan. Pemindai
/// barcode HID mengetik seperti papan ketik, dan sebagian model mengirim
/// modifier saat mengetik huruf besar; memetakan kombinasi bermodifier membuat
/// pindaian tertentu memicu aksi alih-alih masuk ke kotak pindai.
AksiKasir? aksiUntukTombol(LogicalKeyboardKey tombol, {bool adaModifier = false}) {
  if (adaModifier) return null;
  return _peta[tombol];
}

/// Peta lengkap untuk layar bantuan, berurut sesuai nomor tombolnya.
List<({String tombol, AksiKasir aksi})> daftarPintasan() {
  final urutan = [
    (nama: 'F1', tombol: LogicalKeyboardKey.f1),
    (nama: 'F2', tombol: LogicalKeyboardKey.f2),
    (nama: 'F3', tombol: LogicalKeyboardKey.f3),
    (nama: 'F4', tombol: LogicalKeyboardKey.f4),
    (nama: 'F5', tombol: LogicalKeyboardKey.f5),
    (nama: 'F6', tombol: LogicalKeyboardKey.f6),
    (nama: 'F7', tombol: LogicalKeyboardKey.f7),
    (nama: 'F8', tombol: LogicalKeyboardKey.f8),
    (nama: 'F9', tombol: LogicalKeyboardKey.f9),
    (nama: 'F10', tombol: LogicalKeyboardKey.f10),
    (nama: 'F11', tombol: LogicalKeyboardKey.f11),
    (nama: 'F12', tombol: LogicalKeyboardKey.f12),
    (nama: 'Esc', tombol: LogicalKeyboardKey.escape),
  ];
  return [
    for (final u in urutan)
      if (_peta[u.tombol] case final a?) (tombol: u.nama, aksi: a),
  ];
}
