import { parseUpdateAssetFilename } from './pos-update.controller';

describe('parseUpdateAssetFilename', () => {
  it.each([
    ['apotik', 'emedik-pos-apotik-0.1.8-windows.exe', '0.1.8', 'windows'],
    ['apotik', 'emedik-pos-apotik-0.1.8.apk', '0.1.8', 'android'],
    ['pos', 'ebisnis-pos-2.3.4-windows.exe', '2.3.4', 'windows'],
    ['inventory', 'ebisnis-inventory-sales-1.5.0.apk', '1.5.0', 'android'],
    ['apotik', 'emedik-pos-apotik-1.0.0-beta.2-windows.exe', '1.0.0-beta.2', 'windows'],
  ] as const)('membaca %s %s tanpa memasukkan suffix platform ke versi', (product, name, version, platform) => {
    expect(parseUpdateAssetFilename(product, name)).toEqual({ version, platform });
  });

  it('menolak nama aset produk lain atau format tanpa versi semver', () => {
    expect(parseUpdateAssetFilename('apotik', 'ebisnis-pos-0.1.8.apk')).toBeNull();
    expect(parseUpdateAssetFilename('apotik', 'emedik-pos-apotik-terbaru.apk')).toBeNull();
  });
});
