/// Aritmetika transaksi luring — perkalian dan penjumlahan, bukan kebijakan harga.
///
/// Salinan Dart dari `apps/web/src/pos-offline/harga-luring.ts`. Keduanya wajib
/// menghasilkan angka yang sama persis, dan itu ditegakkan
/// `test/konformansi_test.dart` terhadap vektor bersama — bukan oleh kehati-hatian
/// orang yang menyuntingnya.
///
/// Aturan yang berlaku sama seperti pada sisi web:
///
/// - Layar kasir **tidak menghitung harga**. Ia mengalikan harga yang sudah
///   ditetapkan peladen dan dibekukan ke dalam salinan katalog. Promosi dan buku
///   harga tidak dievaluasi saat luring.
/// - Seluruh perhitungan memakai **satuan terkecil mata uang sebagai bilangan
///   bulat**. Pecahan biner pada mesin kasir menjadi selisih laci kas yang tidak
///   dapat dijelaskan siapa pun di akhir hari.
library;

/// Berapa satuan terkecil dalam satu satuan mata uang.
const Map<String, int> _pecahan = {
  'IDR': 1, // rupiah tidak memakai sen dalam praktik kasir
  'USD': 100,
  'EUR': 100,
  'SGD': 100,
  'MYR': 100,
};

int pecahanMataUang(String currencyCode) =>
    _pecahan[currencyCode.toUpperCase()] ?? 100;

class TarifLuring {
  const TarifLuring({
    required this.taxRateId,
    required this.code,
    required this.rate,
    required this.isInclusive,
  });

  final String taxRateId;
  final String code;

  /// Persen, misalnya 11 untuk 11%.
  final num rate;
  final bool isInclusive;
}

class BarisLuring {
  const BarisLuring({
    required this.productId,
    required this.name,
    required this.uomId,
    required this.quantity,
    required this.unitPrice,
    required this.taxRateId,
  });

  final String productId;
  final String name;
  final String? uomId;
  final int quantity;

  /// Harga satuan beku dari salinan, sebagai teks desimal.
  final String unitPrice;
  final String? taxRateId;
}

class HasilBaris {
  const HasilBaris({
    required this.productId,
    required this.name,
    required this.uomId,
    required this.quantity,
    required this.unitPrice,
    required this.lineSubtotal,
    required this.taxAmount,
    required this.lineTotal,
    required this.taxRateId,
  });

  final String productId;
  final String name;
  final String? uomId;
  final int quantity;
  final String unitPrice;

  /// Nilai baris sebelum pajak eksklusif ditambahkan.
  final String lineSubtotal;
  final String taxAmount;
  final String lineTotal;
  final String? taxRateId;

  Map<String, Object?> toJson() => {
        'productId': productId,
        'name': name,
        'uomId': uomId,
        'quantity': quantity,
        'unitPrice': unitPrice,
        'lineSubtotal': lineSubtotal,
        'taxAmount': taxAmount,
        'lineTotal': lineTotal,
        'taxRateId': taxRateId,
      };
}

class HasilKeranjang {
  const HasilKeranjang({
    required this.lines,
    required this.subtotal,
    required this.taxTotal,
    required this.grandTotal,
    required this.itemCount,
  });

  final List<HasilBaris> lines;
  final String subtotal;
  final String taxTotal;
  final String grandTotal;
  final int itemCount;

  Map<String, Object?> toJson() => {
        'lines': lines.map((l) => l.toJson()).toList(),
        'subtotal': subtotal,
        'taxTotal': taxTotal,
        'grandTotal': grandTotal,
        'itemCount': itemCount,
      };
}

final RegExp _desimalSah = RegExp(r'^-?\d*(\.\d*)?$');

/// Mengubah teks desimal menjadi bilangan bulat satuan terkecil.
///
/// Dilakukan lewat teks, bukan `(double.parse(x) * pecahan).round()`: mengalikan
/// pecahan biner lebih dahulu sudah memasukkan galat sebelum pembulatan. Pada
/// nilai seperti `1.005`, hasilnya membulat ke arah yang salah — dan salahnya
/// hanya satu sen, pada setiap transaksi, sepanjang hari.
int keSatuanTerkecil(String desimal, int pecahan) {
  final bersih = desimal.trim();
  if (bersih.isEmpty || !_desimalSah.hasMatch(bersih)) return 0;

  final negatif = bersih.startsWith('-');
  final tanpaTanda = negatif ? bersih.substring(1) : bersih;
  final titik = tanpaTanda.indexOf('.');
  final utuh = titik < 0 ? tanpaTanda : tanpaTanda.substring(0, titik);
  final pecahanTeks = titik < 0 ? '' : tanpaTanda.substring(titik + 1);

  final digitDiperlukan = pecahan.toString().length - 1;

  var dipangkas = pecahanTeks.length >= digitDiperlukan
      ? pecahanTeks.substring(0, digitDiperlukan)
      : pecahanTeks.padRight(digitDiperlukan, '0');
  if (digitDiperlukan == 0) dipangkas = '';

  final berikutnya = pecahanTeks.length > digitDiperlukan
      ? pecahanTeks.codeUnitAt(digitDiperlukan) - 48
      : -1;

  var nilai = int.parse('${utuh.isEmpty ? '0' : utuh}$dipangkas');
  // Pembulatan setengah ke atas, sama dengan yang dipakai peladen.
  if (berikutnya >= 5) nilai += 1;
  return negatif ? -nilai : nilai;
}

/// Kebalikannya: bilangan bulat satuan terkecil menjadi teks desimal.
String keDesimal(int satuan, int pecahan) {
  if (pecahan == 1) return satuan.toString();
  final negatif = satuan < 0;
  final abs = satuan.abs();
  final digit = pecahan.toString().length - 1;
  final utuh = abs ~/ pecahan;
  final sisa = (abs % pecahan).toString().padLeft(digit, '0');
  return '${negatif ? '-' : ''}$utuh.$sisa';
}

/// Menghitung satu baris.
///
/// Pajak inklusif **dikeluarkan** dari harga, bukan ditambahkan di atasnya:
/// harga yang tertera sudah termasuk pajak, dan menambahkannya lagi menagih
/// pembeli dua kali untuk pajak yang sama — dengan angka yang cukup dekat
/// dengan yang benar sehingga tidak ada yang curiga.
HasilBaris hitungBarisLuring(
  BarisLuring baris,
  List<TarifLuring> tarif,
  String currencyCode,
) {
  final pecahan = pecahanMataUang(currencyCode);
  final harga = keSatuanTerkecil(baris.unitPrice, pecahan);
  final kotor = harga * baris.quantity;

  TarifLuring? t;
  if (baris.taxRateId != null) {
    for (final x in tarif) {
      if (x.taxRateId == baris.taxRateId) {
        t = x;
        break;
      }
    }
  }

  var subtotal = kotor;
  var pajak = 0;

  if (t != null && t.rate != 0) {
    if (t.isInclusive) {
      // Harga sudah mengandung pajak; yang dicari adalah bagian pajaknya.
      final dasar = ((kotor * 100) / (100 + t.rate)).round();
      pajak = kotor - dasar;
      subtotal = dasar;
    } else {
      pajak = ((kotor * t.rate) / 100).round();
      subtotal = kotor;
    }
  }

  return HasilBaris(
    productId: baris.productId,
    name: baris.name,
    uomId: baris.uomId,
    quantity: baris.quantity,
    unitPrice: baris.unitPrice,
    lineSubtotal: keDesimal(subtotal, pecahan),
    taxAmount: keDesimal(pajak, pecahan),
    lineTotal: keDesimal(subtotal + pajak, pecahan),
    taxRateId: baris.taxRateId,
  );
}

/// Menjumlahkan seluruh keranjang.
///
/// Dijumlahkan dari nilai baris yang **sudah dibulatkan**, bukan dari nilai
/// mentah lalu dibulatkan sekali di akhir. Struk mencantumkan angka per baris,
/// dan pembeli yang menjumlahkan sendiri baris-baris pada struknya harus
/// mendapat angka yang sama dengan totalnya.
HasilKeranjang hitungKeranjangLuring(
  List<BarisLuring> baris,
  List<TarifLuring> tarif,
  String currencyCode,
) {
  final pecahan = pecahanMataUang(currencyCode);
  final hasil = baris.map((b) => hitungBarisLuring(b, tarif, currencyCode)).toList();

  var subtotal = 0;
  var pajak = 0;
  var jumlahBarang = 0;
  for (final h in hasil) {
    subtotal += keSatuanTerkecil(h.lineSubtotal, pecahan);
    pajak += keSatuanTerkecil(h.taxAmount, pecahan);
    jumlahBarang += h.quantity;
  }

  return HasilKeranjang(
    lines: hasil,
    subtotal: keDesimal(subtotal, pecahan),
    taxTotal: keDesimal(pajak, pecahan),
    grandTotal: keDesimal(subtotal + pajak, pecahan),
    itemCount: jumlahBarang,
  );
}

class HasilKembalian {
  const HasilKembalian({
    required this.cukup,
    required this.change,
    required this.kurang,
  });

  final bool cukup;
  final String change;
  final String kurang;

  Map<String, Object?> toJson() =>
      {'cukup': cukup, 'change': change, 'kurang': kurang};
}

/// Kembalian, dan penolakan bila uang yang diserahkan kurang.
///
/// Dipisah menjadi fungsi tersendiri karena inilah satu-satunya tempat layar
/// kasir memutuskan sesuatu tentang uang tanpa peladen.
HasilKembalian hitungKembalian(
  String grandTotal,
  String diserahkan,
  String currencyCode,
) {
  final pecahan = pecahanMataUang(currencyCode);
  final tagihan = keSatuanTerkecil(grandTotal, pecahan);
  final uang = keSatuanTerkecil(diserahkan, pecahan);
  if (uang < tagihan) {
    return HasilKembalian(
      cukup: false,
      change: keDesimal(0, pecahan),
      kurang: keDesimal(tagihan - uang, pecahan),
    );
  }
  return HasilKembalian(
    cukup: true,
    change: keDesimal(uang - tagihan, pecahan),
    kurang: keDesimal(0, pecahan),
  );
}
