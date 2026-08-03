import { buatProdukSalon, buatTransaksiSalon, ringkasTransaksi } from './salon-data';

describe('data contoh salon', () => {
  it('membuat minimal 100 produk dan 1000 transaksi', () => {
    const produk = buatProdukSalon();
    const transaksi = buatTransaksiSalon(produk, 1000, new Date('2026-08-04T12:00:00+07:00'));

    expect(produk.length).toBeGreaterThanOrEqual(100);
    expect(transaksi.length).toBeGreaterThanOrEqual(1000);
    expect(new Set(produk.map((item) => item.id)).size).toBe(produk.length);
  });

  it('transaksi bergerak mengikuti tanggal acuan', () => {
    const produk = buatProdukSalon();
    const lama = buatTransaksiSalon(produk, 1000, new Date('2026-08-04T12:00:00+07:00'));
    const baru = buatTransaksiSalon(produk, 1000, new Date('2026-08-05T12:00:00+07:00'));

    expect(lama[999].tanggal).not.toBe(baru[999].tanggal);
    expect(ringkasTransaksi(baru).jumlah).toBeGreaterThan(980);
  });
});
