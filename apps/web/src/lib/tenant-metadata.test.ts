import { describe, expect, it } from 'vitest';
import { metadataForTenant } from './tenant-metadata';

describe('metadataForTenant untuk eMedik', () => {
  it('memakai nama tenant eMedik pada judul browser dan tidak kembali ke eBisnis', () => {
    const metadata = metadataForTenant('demo.emedik.id');

    expect(metadata.title).toBe('Demo eMedik - Sistem Operasional Kesehatan');
    expect(metadata.siteName).toBe('Demo eMedik');
    expect(metadata.appName).toBe('Demo eMedik');
    expect(metadata.title).not.toContain('eBisnis');
  });

  it('memakai nama tenant apotik pada judul browser dan preview', () => {
    const metadata = metadataForTenant('sehatjaya-apotik.emedik.id');

    expect(metadata.title).toBe('Sehatjaya Apotik - Farmasi dan POS Apotik');
    expect(metadata.siteName).toBe('Sehatjaya Apotik');
    expect(metadata.appName).toBe('Sehatjaya Apotik');
    expect(metadata.themeColor).toBe('#0f766e');
  });
});
