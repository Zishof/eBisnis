/// Import dan export produk dengan bentuk workbook Accurate.
library;

import 'dart:typed_data';

import 'package:excel/excel.dart';

import '../layar/sumber.dart';

const String sheetAccurateBarang = 'Daftar Barang dan Jasa';

const List<String> _judulAccurate = [
  'No',
  'Kode',
  'UPC/Barcode',
  'Kategori',
  'Nama Barang',
  'Nama Pemasok Utama',
  'Satuan',
  'Kts',
  'Def. Hrg. Jual Sa',
  'Nilai Satuan',
  'Nilai Total',
];

List<ProdukLokal> produkDariAccurate(Uint8List bytes) {
  final excel = Excel.decodeBytes(bytes);
  final sheet = excel.tables[sheetAccurateBarang] ??
      (excel.tables.isEmpty ? null : excel.tables.values.first);
  if (sheet == null) return const [];

  final rows = sheet.rows;
  final headerIndex = _cariHeader(rows);
  if (headerIndex == null) return const [];

  final header = rows[headerIndex];
  final kolom = <String, int>{};
  for (var i = 0; i < header.length; i++) {
    final nama = _teks(header[i]).toLowerCase();
    if (nama.isNotEmpty) kolom[nama] = i;
  }

  int? idx(String nama) => kolom[nama.toLowerCase()];
  final kode = idx('kode');
  final barcode = idx('upc/barcode');
  final kategori = idx('kategori');
  final nama = idx('nama barang');
  final satuan = idx('satuan');
  final stok = idx('kts');
  final harga = idx('def. hrg. jual sa') ?? idx('nilai satuan');

  final hasil = <ProdukLokal>[];
  for (var r = headerIndex + 1; r < rows.length; r++) {
    final row = rows[r];
    final productId = _ambil(row, kode).trim();
    final namaProduk = _ambil(row, nama).trim();
    if (productId.isEmpty && namaProduk.isEmpty) continue;

    final id = productId.isNotEmpty ? productId : 'BARANG-${r + 1}';
    final namaFinal = namaProduk.isNotEmpty ? namaProduk : id;
    final hargaFinal = _angka(_ambil(row, harga));
    if (hargaFinal <= 0) continue;

    hasil.add(
      ProdukLokal(
        productId: id,
        nama: namaFinal,
        harga: hargaFinal.toStringAsFixed(0),
        barcodes: _barcode(_ambil(row, barcode)),
        uomId: _ambil(row, satuan).trim().isEmpty ? null : _ambil(row, satuan),
        kategori:
            _ambil(row, kategori).trim().isEmpty ? null : _ambil(row, kategori),
        varian: _ambil(row, satuan).trim().isEmpty ? null : _ambil(row, satuan),
        stok: _stok(_ambil(row, stok)),
      ),
    );
  }

  return hasil;
}

Uint8List accurateDariProduk(List<ProdukLokal> produk) {
  final excel = Excel.createExcel();
  excel.rename(excel.getDefaultSheet()!, sheetAccurateBarang);
  final sheet = excel[sheetAccurateBarang];

  _isi(sheet, 1, 2, 'Ekonomi Syariah');
  _isi(sheet, 2, 2, 'Daftar Barang dan Jasa');
  _isi(sheet, 3, 2,
      'Per Tgl. ${DateTime.now().toIso8601String().substring(0, 10)}');
  _isi(sheet, 4, 2, 'Cabang : [Semua Cabang]');

  for (var i = 0; i < _judulAccurate.length; i++) {
    _isi(sheet, 5, i + 3, _judulAccurate[i]);
  }

  for (var i = 0; i < produk.length; i++) {
    final p = produk[i];
    final row = i + 6;
    final harga = _angka(p.harga);
    final stok = p.stok ?? 0;
    _isi(sheet, row, 3, i + 1);
    _isi(sheet, row, 4, p.productId);
    _isi(sheet, row, 5, p.barcodes.join(', '));
    _isi(sheet, row, 6, p.kategori ?? '');
    _isi(sheet, row, 7, p.nama);
    _isi(sheet, row, 8, '');
    _isi(sheet, row, 9, p.uomId ?? p.varian ?? 'PCS');
    _isi(sheet, row, 10, stok);
    _isi(sheet, row, 11, harga);
    _isi(sheet, row, 12, harga);
    _isi(sheet, row, 13, harga * stok);
  }

  final bytes = excel.encode();
  return Uint8List.fromList(bytes ?? const []);
}

int? _cariHeader(List<List<Data?>> rows) {
  for (var r = 0; r < rows.length; r++) {
    final teks = rows[r].map(_teks).map((x) => x.toLowerCase()).toSet();
    if (teks.contains('kode') && teks.contains('nama barang')) return r;
  }
  return null;
}

String _ambil(List<Data?> row, int? index) {
  if (index == null || index < 0 || index >= row.length) return '';
  return _teks(row[index]);
}

String _teks(Data? cell) {
  final value = cell?.value;
  if (value == null) return '';
  return value.toString().trim();
}

List<String> _barcode(String teks) {
  return teks
      .split(RegExp(r'[,;\s]+'))
      .map((x) => x.trim())
      .where((x) => x.isNotEmpty)
      .toList();
}

num _angka(String teks) {
  final bersih = teks
      .replaceAll(RegExp(r'[^0-9,.-]'), '')
      .replaceAll('.', '')
      .replaceAll(',', '.');
  return num.tryParse(bersih) ?? 0;
}

int? _stok(String teks) {
  if (teks.trim().isEmpty) return null;
  return _angka(teks).round();
}

void _isi(Sheet sheet, int row, int col, Object value) {
  final cell = sheet.cell(CellIndex.indexByColumnRow(
    columnIndex: col - 1,
    rowIndex: row - 1,
  ));
  cell.value = switch (value) {
    int v => IntCellValue(v),
    num v => DoubleCellValue(v.toDouble()),
    _ => TextCellValue(value.toString()),
  };
}
