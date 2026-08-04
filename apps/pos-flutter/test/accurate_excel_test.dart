library;

import 'package:ebisnis_pos/layar/sumber.dart';
import 'package:ebisnis_pos/produk/accurate_excel.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('export lalu import format Accurate mempertahankan produk utama', () {
    final bytes = accurateDariProduk(const [
      ProdukLokal(
        productId: 'BRG-001',
        nama: 'Beras Premium',
        harga: '14500',
        barcodes: ['8991234567890'],
        kategori: 'Sembako',
        uomId: 'PCS',
        stok: 12,
      ),
    ]);

    final produk = produkDariAccurate(bytes);

    expect(produk, hasLength(1));
    expect(produk.single.productId, 'BRG-001');
    expect(produk.single.nama, 'Beras Premium');
    expect(produk.single.harga, '14500');
    expect(produk.single.barcodes, contains('8991234567890'));
    expect(produk.single.kategori, 'Sembako');
    expect(produk.single.stok, 12);
  });
}
