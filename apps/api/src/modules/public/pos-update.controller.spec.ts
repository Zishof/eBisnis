import { latestAssetsForPlatform, parseUpdateAssetFilename } from './pos-update.controller';

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

describe('latestAssetsForPlatform', () => {
  const assets = [
    { version: '0.1.12', platform: 'android' as const },
    { version: '0.1.15', platform: 'windows' as const },
    { version: '0.1.16', platform: 'windows' as const },
  ];

  it('memisahkan versi terbaru Android dari rilis Windows yang lebih baru', () => {
    expect(latestAssetsForPlatform(assets, 'android')).toEqual({
      version: '0.1.12',
      assets: [assets[0]],
    });
    expect(latestAssetsForPlatform(assets, 'windows')).toEqual({
      version: '0.1.16',
      assets: [assets[2]],
    });
  });
});
