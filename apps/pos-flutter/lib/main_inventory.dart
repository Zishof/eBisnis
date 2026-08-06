library;

import 'package:flutter/material.dart';

import 'inventory/inventory_app.dart';

/// Entrypoint khusus aplikasi Inventory dan Sales.
///
/// Berkas terpisah ini mencegah artefak Inventory memakai hasil kompilasi
/// varian POS/Salon ketika beberapa produk dibangun berurutan pada runner CI.
void main() {
  runApp(const AplikasiInventory());
}
