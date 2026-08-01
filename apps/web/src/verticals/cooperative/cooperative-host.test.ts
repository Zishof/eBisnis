import { describe, expect, it } from 'vitest';
import { cooperativeRootRedirectFor, isCooperativeHost } from './cooperative-host';

describe('isCooperativeHost', () => {
  it('mengenali alamat koperasi', () => {
    expect(isCooperativeHost('koperasi.ebisnis.id')).toBe(true);
    expect(isCooperativeHost('ekoperasi.ebisnis.id')).toBe(true);
  });

  it('alamat utama bukan alamat koperasi', () => {
    expect(isCooperativeHost('ebisnis.id')).toBe(false);
    expect(isCooperativeHost('www.ebisnis.id')).toBe(false);
    expect(isCooperativeHost('belanja.ebisnis.id')).toBe(false);
    expect(isCooperativeHost('localhost')).toBe(false);
  });

  it('kata "koperasi" di tengah alamat TIDAK dianggap pintu masuk koperasi', () => {
    /*
     * Diperiksa sebagai awalan, bukan dicari di mana pun. Tanpa itu,
     * `jual.koperasi.evil.com` akan tampak sebagai alamat koperasi bagi
     * pengunjung yang membacanya sekilas.
     */
    expect(isCooperativeHost('jual.koperasi.evil.com')).toBe(false);
    expect(isCooperativeHost('bukan-koperasi.ebisnis.id')).toBe(false);
    expect(isCooperativeHost('evil.com/koperasi.ebisnis.id')).toBe(false);
  });

  it('huruf besar-kecil tidak membedakan', () => {
    expect(isCooperativeHost('KOPERASI.EBISNIS.ID')).toBe(true);
    expect(isCooperativeHost('Koperasi.Ebisnis.Id')).toBe(true);
  });
});

describe('cooperativeRootRedirectFor', () => {
  it('akar alamat koperasi mengarah ke situs koperasi', () => {
    expect(cooperativeRootRedirectFor('koperasi.ebisnis.id', '/')).toBe('/ekoperasi/situs');
  });

  it('akar alamat utama tidak dialihkan', () => {
    expect(cooperativeRootRedirectFor('ebisnis.id', '/')).toBeNull();
  });

  it('halaman selain akar tidak dialihkan', () => {
    /*
     * Pengunjung yang sudah membuka /masuk atau /harga dari alamat koperasi
     * sedang berada di tempat yang ia maksud; mengalihkannya akan membuat
     * halaman itu mustahil dibuka dari subdomain koperasi.
     */
    for (const path of ['/masuk', '/harga', '/ekoperasi/portal', '/belanja']) {
      expect(cooperativeRootRedirectFor('koperasi.ebisnis.id', path)).toBeNull();
    }
  });
});
