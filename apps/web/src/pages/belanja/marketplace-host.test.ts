import { describe, expect, it } from 'vitest';
import { isMarketplaceHost, rootRedirectFor } from './marketplace-host';

describe('isMarketplaceHost', () => {
  it('mengenali alamat marketplace', () => {
    expect(isMarketplaceHost('belanja.ebisnis.id')).toBe(true);
    expect(isMarketplaceHost('shop.ebisnis.id')).toBe(true);
    expect(isMarketplaceHost('toko.ebisnis.id')).toBe(true);
  });

  it('tidak mengenali alamat website perusahaan', () => {
    expect(isMarketplaceHost('ebisnis.id')).toBe(false);
    expect(isMarketplaceHost('www.ebisnis.id')).toBe(false);
    expect(isMarketplaceHost('demo.ebisnis.id')).toBe(false);
    expect(isMarketplaceHost('localhost')).toBe(false);
  });

  it('membandingkan awalan, bukan mencari di mana pun', () => {
    // Host yang memuat "belanja" di tengah tidak boleh dianggap marketplace;
    // bila dicari dengan `includes`, alamat di bawah akan lolos.
    expect(isMarketplaceHost('jual.belanja.evil.com')).toBe(false);
    expect(isMarketplaceHost('evil.com/belanja.ebisnis.id')).toBe(false);
    expect(isMarketplaceHost('notbelanja.ebisnis.id')).toBe(false);
  });

  it('tidak peduli huruf besar kecil', () => {
    expect(isMarketplaceHost('BELANJA.EBISNIS.ID')).toBe(true);
    expect(isMarketplaceHost('Belanja.Ebisnis.Id')).toBe(true);
  });
});

describe('rootRedirectFor', () => {
  it('mengalihkan akar marketplace ke katalog', () => {
    expect(rootRedirectFor('belanja.ebisnis.id', '/')).toBe('/belanja');
  });

  it('membiarkan akar website perusahaan apa adanya', () => {
    expect(rootRedirectFor('ebisnis.id', '/')).toBeNull();
  });

  it('tidak menyentuh halaman selain akar', () => {
    // Tanpa syarat ini, membuka belanja.ebisnis.id/masuk akan terlempar
    // kembali ke katalog dan tidak ada yang dapat masuk dari sana.
    for (const path of ['/masuk', '/harga', '/belanja/cari', '/app']) {
      expect(rootRedirectFor('belanja.ebisnis.id', path)).toBeNull();
    }
  });
});
