import { describe, expect, it } from 'vitest';
import {
  businessTenantNameFromHost,
  businessVerticalByCode,
  businessVerticalFromHost,
  businessVerticalPublicHostFor,
  businessVerticalRootRedirectFor,
} from './business-verticals';

describe('business vertical hosts', () => {
  it('mengenali root dan tenant vertical eBisnis', () => {
    expect(businessVerticalFromHost('barbershop.ebisnis.id')?.code).toBe('barbershop');
    expect(businessVerticalFromHost('joko-barbershop.ebisnis.id')?.code).toBe('barbershop');
    expect(businessVerticalFromHost('bengkelmotor.ebisnis.id')?.code).toBe('bengkelmotor');
    expect(businessVerticalFromHost('maju-bengkelmobil.ebisnis.id')?.code).toBe('bengkelmobil');
    expect(businessVerticalFromHost('restoran.ebisnis.id')?.code).toBe('restoran');
    expect(businessVerticalFromHost('toko.ebisnis.id')?.code).toBe('toko');
    expect(businessVerticalFromHost('rentalkendaraan.ebisnis.id')?.code).toBe('rentalkendaraan');
  });

  it('mendukung alias typo yang sudah dipakai di percakapan', () => {
    expect(businessVerticalFromHost('fasion.ebisnis.id')?.code).toBe('fashion');
    expect(businessVerticalFromHost('ayu-fasion.ebisnis.id')?.code).toBe('fashion');
    expect(businessVerticalFromHost('laundy.ebisnis.id')?.code).toBe('laundry');
    expect(businessVerticalFromHost('cepat-laundy.ebisnis.id')?.code).toBe('laundry');
    expect(businessVerticalByCode('laundri')?.code).toBe('laundry');
    expect(businessVerticalPublicHostFor('fashion')).toBe('fasion.ebisnis.id');
    expect(businessVerticalPublicHostFor('laundry')).toBe('laundy.ebisnis.id');
  });

  it('menghasilkan nama tenant dan redirect landing', () => {
    expect(businessTenantNameFromHost('tukang-cukur-joko-barbershop.ebisnis.id')).toBe('Tukang Cukur Joko');
    expect(businessVerticalRootRedirectFor('tukang-cukur-joko-barbershop.ebisnis.id', '/')).toBe('/contoh-usaha/barbershop');
    expect(businessTenantNameFromHost('cantik-salon.ebisnis.id')).toBe('Cantik');
    expect(businessVerticalRootRedirectFor('cantik-salon.ebisnis.id', '/')).toBe('/contoh-usaha/salon');
    expect(businessTenantNameFromHost('cmnmedika-inventory.ebisnis.id')).toBe('Caruban Medika Nusantara');
    expect(businessVerticalRootRedirectFor('cmnmedika-inventory.ebisnis.id', '/')).toBe('/contoh-usaha/inventory');
    expect(businessVerticalRootRedirectFor('tukang-cukur-joko-barbershop.ebisnis.id', '/masuk')).toBeNull();
  });

  it('mendukung typo host lama tanpa membuka host asing', () => {
    expect(businessVerticalFromHost('cantik-salon.ebinis.id')?.code).toBe('salon');
    expect(businessVerticalFromHost('cantik-salon.ebisinis.id')?.code).toBe('salon');
    expect(businessTenantNameFromHost('cantik-salon.ebisinis.id')).toBe('Cantik');
  });

  it('mengenali ide vertical tambahan', () => {
    expect(businessVerticalFromHost('prima-optik.ebisnis.id')?.code).toBe('optik');
    expect(businessVerticalFromHost('ceria-eventorganizer.ebisnis.id')?.code).toBe('eventorganizer');
    expect(businessVerticalFromHost('bersih-jasakebersihan.ebisnis.id')?.code).toBe('jasakebersihan');
  });

  it('mengenali seluruh domain unit usaha publik dan tenant prefixed', () => {
    const contoh = [
      ['salon.ebisnis.id', 'salon'],
      ['ayu-salon.ebisnis.id', 'salon'],
      ['barbershop.ebisnis.id', 'barbershop'],
      ['joko-barbershop.ebisnis.id', 'barbershop'],
      ['bengkelmotor.ebisnis.id', 'bengkelmotor'],
      ['bengkelmobil.ebisnis.id', 'bengkelmobil'],
      ['bengkelsepeda.ebisnis.id', 'bengkelsepeda'],
      ['restoran.ebisnis.id', 'restoran'],
      ['cafe.ebisnis.id', 'cafe'],
      ['kuliner.ebisnis.id', 'kuliner'],
      ['fasion.ebisnis.id', 'fashion'],
      ['toko.ebisnis.id', 'toko'],
      ['warteg.ebisnis.id', 'warteg'],
      ['jasa.ebisnis.id', 'jasa'],
      ['tokopertanian.ebisnis.id', 'tokopertanian'],
      ['olahanpertanian.ebisnis.id', 'olahanpertanian'],
      ['fitnes.ebisnis.id', 'fitnes'],
      ['spa.ebisnis.id', 'spa'],
      ['katering.ebisnis.id', 'katering'],
      ['minimarket.ebisnis.id', 'minimarket'],
      ['kosmetik.ebisnis.id', 'kosmetik'],
      ['kerajinan.ebisnis.id', 'kerajinan'],
      ['agribisnis.ebisnis.id', 'agribisnis'],
      ['laundy.ebisnis.id', 'laundry'],
      ['cucimobil.ebisnis.id', 'cucimobil'],
      ['cucimotor.ebisnis.id', 'cucimotor'],
      ['rentalkendaraan.ebisnis.id', 'rentalkendaraan'],
      ['inventory.ebisnis.id', 'inventory'],
      ['rentalsepeda.ebisnis.id', 'rentalsepeda'],
      ['fotokopi.ebisnis.id', 'fotokopi'],
      ['frozenfood.ebisnis.id', 'frozenfood'],
      ['tokoatk.ebisnis.id', 'tokoatk'],
      ['tokohp.ebisnis.id', 'tokohp'],
      ['petshop.ebisnis.id', 'petshop'],
      ['cucisepatu.ebisnis.id', 'cucisepatu'],
      ['depotair.ebisnis.id', 'depotair'],
      ['travel.ebisnis.id', 'travel'],
      ['homestay.ebisnis.id', 'homestay'],
      ['kursus.ebisnis.id', 'kursus'],
      ['daycare.ebisnis.id', 'daycare'],
      ['bakery.ebisnis.id', 'bakery'],
      ['alatkesehatan.ebisnis.id', 'alatkesehatan'],
      ['tokobuku.ebisnis.id', 'tokobuku'],
      ['florist.ebisnis.id', 'florist'],
      ['konveksi.ebisnis.id', 'konveksi'],
      ['furniture.ebisnis.id', 'furniture'],
      ['tokomainan.ebisnis.id', 'tokomainan'],
      ['babyshop.ebisnis.id', 'babyshop'],
      ['fotografi.ebisnis.id', 'fotografi'],
      ['weddingorganizer.ebisnis.id', 'weddingorganizer'],
      ['tokoemas.ebisnis.id', 'tokoemas'],
    ] as const;

    for (const [host, code] of contoh) {
      expect(businessVerticalFromHost(host)?.code, host).toBe(code);
      expect(businessVerticalFromHost(`tenant-${host}`)?.code, `tenant-${host}`).toBe(code);
    }
  });

  it('tidak mengambil host asing', () => {
    expect(businessVerticalFromHost('barbershop.ebisnis.id.evil.test')).toBeNull();
    expect(businessVerticalFromHost('ebisnis.id')).toBeNull();
  });
});
