import { isSalonDemoHost, salonRootRedirectFor } from './salon-host';

describe('host contoh salon', () => {
  it('mengenali salon.ebisnis.id', () => {
    expect(isSalonDemoHost('salon.ebisnis.id')).toBe(true);
    expect(isSalonDemoHost('SALON.EBISNIS.ID:443')).toBe(true);
    expect(isSalonDemoHost('salon.ebinis.id')).toBe(true);
    expect(isSalonDemoHost('salon.ebisinis.id')).toBe(true);
    expect(isSalonDemoHost('cantik-salon.ebisnis.id')).toBe(true);
    expect(isSalonDemoHost('cantik-salon.ebinis.id')).toBe(true);
    expect(isSalonDemoHost('cantik-salon.ebisinis.id')).toBe(true);
  });

  it('tidak menyamakan host lain sebagai salon', () => {
    expect(isSalonDemoHost('pelanggan-demo.ebisnis.id')).toBe(false);
    expect(isSalonDemoHost('salon.example.com')).toBe(false);
    expect(isSalonDemoHost('not-salon.ebisnis.id.evil.com')).toBe(false);
  });

  it('mengalihkan root host salon ke halaman contoh', () => {
    expect(salonRootRedirectFor('salon.ebisnis.id', '/')).toBe('/contoh/salon');
    expect(salonRootRedirectFor('salon.ebisnis.id', '/a/')).toBe('/contoh/salon');
    expect(salonRootRedirectFor('salon.ebisnis.id', '/ebisnis/a')).toBe('/contoh/salon');
    expect(salonRootRedirectFor('salon.ebisnis.id', '/app')).toBeNull();
  });
});
