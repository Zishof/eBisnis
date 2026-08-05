import { CONTOH_USAHA, DOMAIN_CONTOH_USAHA, tautanWebsiteContohUsaha } from './HomePage';

describe('tautan kartu contoh unit usaha di beranda', () => {
  it('semua kartu beranda membuka domain publik unit usaha', () => {
    const tanpaDomain = CONTOH_USAHA.filter((item) => !DOMAIN_CONTOH_USAHA[item.label]).map((item) => item.label);

    expect(tanpaDomain).toEqual([]);
    for (const item of CONTOH_USAHA) {
      expect(tautanWebsiteContohUsaha(item), item.label).toMatch(/^https:\/\/[a-z0-9-]+\.(?:ebisnis|emedik)\.id$/);
    }
  });

  it('menjaga domain unit usaha utama yang diminta', () => {
    const tautan = Object.fromEntries(CONTOH_USAHA.map((item) => [item.label, tautanWebsiteContohUsaha(item)]));

    expect(tautan.Demo).toBe('https://demo.ebisnis.id');
    expect(tautan.Salon).toBe('https://salon.ebisnis.id');
    expect(tautan.Barbershop).toBe('https://barbershop.ebisnis.id');
    expect(tautan['Bengkel Motor']).toBe('https://bengkelmotor.ebisnis.id');
    expect(tautan['Bengkel Mobil']).toBe('https://bengkelmobil.ebisnis.id');
    expect(tautan['Bengkel Sepeda']).toBe('https://bengkelsepeda.ebisnis.id');
    expect(tautan.Restoran).toBe('https://restoran.ebisnis.id');
    expect(tautan.Kafe).toBe('https://cafe.ebisnis.id');
    expect(tautan.Fashion).toBe('https://fasion.ebisnis.id');
    expect(tautan.Laundry).toBe('https://laundy.ebisnis.id');
    expect(tautan['Cuci Mobil']).toBe('https://cucimobil.ebisnis.id');
    expect(tautan['Cuci Motor']).toBe('https://cucimotor.ebisnis.id');
    expect(tautan['Rental Kendaraan']).toBe('https://rentalkendaraan.ebisnis.id');
    expect(tautan['Rental Sepeda']).toBe('https://rentalsepeda.ebisnis.id');
    expect(tautan['Sales & Inventory']).toBe('https://inventory.ebisnis.id');
    expect(tautan.Apotek).toBe('https://apotik.emedik.id');
  });

  it('memasukkan ide unit usaha tambahan ke domain sendiri', () => {
    const tautan = Object.fromEntries(CONTOH_USAHA.map((item) => [item.label, tautanWebsiteContohUsaha(item)]));

    expect(tautan['Fotokopi dan Print']).toBe('https://fotokopi.ebisnis.id');
    expect(tautan['Frozen Food']).toBe('https://frozenfood.ebisnis.id');
    expect(tautan['Toko ATK']).toBe('https://tokoatk.ebisnis.id');
    expect(tautan['Toko HP dan Aksesoris']).toBe('https://tokohp.ebisnis.id');
    expect(tautan['Pet Shop']).toBe('https://petshop.ebisnis.id');
    expect(tautan['Depot Air Minum']).toBe('https://depotair.ebisnis.id');
    expect(tautan['Daycare dan PAUD']).toBe('https://daycare.ebisnis.id');
    expect(tautan['Wedding Organizer']).toBe('https://weddingorganizer.ebisnis.id');
  });
});
