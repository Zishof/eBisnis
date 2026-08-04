import {
  isPelangganHost,
  pelangganRootRedirectFor,
  slugPelangganDariHost,
} from './pelanggan-host';

describe('host halaman pelanggan', () => {
  it('mengenali subdomain pelanggan demo', () => {
    expect(isPelangganHost('pelanggan-demo.ebisnis.id')).toBe(true);
    expect(slugPelangganDariHost('pelanggan-demo.ebisnis.id')).toBe('demo');
    expect(slugPelangganDariHost('PELANGGAN-tukang-cukur-joko.ebisnis.id:443')).toBe(
      'tukang-cukur-joko',
    );
  });

  it('menolak host yang bukan halaman pelanggan toko', () => {
    expect(isPelangganHost('ebisnis.id')).toBe(false);
    expect(isPelangganHost('demo.ebisnis.id')).toBe(false);
    expect(isPelangganHost('pelanggan-demo.example.com')).toBe(false);
    expect(isPelangganHost('x.pelanggan-demo.ebisnis.id')).toBe(false);
  });

  it('mengalihkan akar host pelanggan ke halaman tokonya', () => {
    expect(pelangganRootRedirectFor('pelanggan-demo.ebisnis.id', '/')).toBe('/pelanggan/demo');
    expect(pelangganRootRedirectFor('pelanggan-demo.ebisnis.id', '/produk')).toBeNull();
    expect(pelangganRootRedirectFor('ebisnis.id', '/')).toBeNull();
  });
});
