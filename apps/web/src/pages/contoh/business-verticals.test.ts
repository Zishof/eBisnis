import { describe, expect, it } from 'vitest';
import {
  businessTenantNameFromHost,
  businessVerticalByCode,
  businessVerticalFromHost,
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
  });

  it('menghasilkan nama tenant dan redirect landing', () => {
    expect(businessTenantNameFromHost('tukang-cukur-joko-barbershop.ebisnis.id')).toBe('Tukang Cukur Joko');
    expect(businessVerticalRootRedirectFor('tukang-cukur-joko-barbershop.ebisnis.id', '/')).toBe('/contoh-usaha/barbershop');
    expect(businessTenantNameFromHost('cantik-salon.ebisnis.id')).toBe('Cantik');
    expect(businessVerticalRootRedirectFor('cantik-salon.ebisnis.id', '/')).toBe('/contoh-usaha/salon');
    expect(businessTenantNameFromHost('cmnmedika-inventory.ebisnis.id')).toBe('Cmnmedika');
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

  it('tidak mengambil host asing', () => {
    expect(businessVerticalFromHost('barbershop.ebisnis.id.evil.test')).toBeNull();
    expect(businessVerticalFromHost('ebisnis.id')).toBeNull();
  });
});
