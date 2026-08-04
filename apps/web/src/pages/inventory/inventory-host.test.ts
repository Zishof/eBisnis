import { inventoryRootRedirectFor, inventoryTenantLabelFromHost, isInventoryHost } from './inventory-host';

describe('host inventory eBisnis', () => {
  it('mengenali host demo dan host tenant inventory', () => {
    expect(isInventoryHost('demo-inventory.ebisnis.id')).toBe(true);
    expect(isInventoryHost('DEMO-INVENTORY.EBISNIS.ID:443')).toBe(true);
    expect(isInventoryHost('toko-obat-inventory.ebisnis.id')).toBe(true);
    expect(isInventoryHost('klinik-sehat.inventory.ebisnis.id')).toBe(true);
  });

  it('tidak menyamakan domain lain sebagai inventory', () => {
    expect(isInventoryHost('inventory.ebisnis.id.evil.com')).toBe(false);
    expect(isInventoryHost('salon.ebisnis.id')).toBe(false);
    expect(isInventoryHost('demo.ebisnis.id')).toBe(false);
  });

  it('mengalihkan root host inventory ke landing inventory', () => {
    expect(inventoryRootRedirectFor('demo-inventory.ebisnis.id', '/')).toBe('/inventory');
    expect(inventoryRootRedirectFor('demo-inventory.ebisnis.id', '/a/')).toBe('/inventory');
    expect(inventoryRootRedirectFor('demo-inventory.ebisnis.id', '/ebisnis/a')).toBe('/inventory');
    expect(inventoryRootRedirectFor('demo-inventory.ebisnis.id', '/masuk')).toBeNull();
    expect(inventoryRootRedirectFor('demo-inventory.ebisnis.id', '/app')).toBeNull();
  });

  it('membuat label tenant dari host', () => {
    expect(inventoryTenantLabelFromHost('demo-inventory.ebisnis.id')).toBe('Demo Inventory Obat');
    expect(inventoryTenantLabelFromHost('toko-obat-jaya-inventory.ebisnis.id')).toBe('Toko Obat Jaya');
    expect(inventoryTenantLabelFromHost('apotek-sehat.inventory.ebisnis.id')).toBe('Apotek Sehat');
  });
});
