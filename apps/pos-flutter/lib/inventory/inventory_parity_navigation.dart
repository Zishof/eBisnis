/// Pemetaan layar legacy ke tab workspace Flutter Inventory.
///
/// Nomor tab mengikuti navigasi [InventoryHomePage]. Rentang ini sengaja
/// diekspresikan sebagai fungsi tunggal agar tombol Paritas, test Windows, dan
/// UAT Android tidak memiliki salinan aturan yang dapat berbeda diam-diam.
int inventoryTabForLegacyScreen(int screen) {
  if (screen < 1 || screen > 48) {
    throw RangeError.range(screen, 1, 48, 'screen');
  }
  if (screen <= 7) return 2; // master relasi hidup di workspace operasional
  if (screen <= 19) return 3; // stok, opname, harga, cetak, ekspor
  if (screen <= 29) return 2; // pembelian dan hutang
  if (screen == 30) return 1; // sales order
  if (screen <= 42) return 2; // piutang dan serah-terima nota
  return 5; // jurnal, akun, laba/rugi, snapshot dan cetak
}
