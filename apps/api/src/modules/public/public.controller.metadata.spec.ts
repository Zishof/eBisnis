jest.mock('sanitize-html', () => jest.fn((value: string) => value));

import { metadataForHost } from './public.controller';

describe('metadataForHost eMedik dan Apotik', () => {
  it('memakai nama tenant eMedik pada metadata publik API', () => {
    const metadata = metadataForHost('demo.emedik.id');

    expect(metadata.title).toBe('Demo eMedik - Sistem Operasional Kesehatan');
    expect(metadata.siteName).toBe('Demo eMedik');
    expect(metadata.themeColor).toBe('#0891b2');
    expect(metadata.title).not.toContain('eBisnis');
  });

  it('memakai nama tenant apotik pada metadata publik API', () => {
    const metadata = metadataForHost('sehatjaya-apotik.emedik.id');

    expect(metadata.title).toBe('Sehatjaya Apotik - Farmasi dan POS Apotik');
    expect(metadata.siteName).toBe('Sehatjaya Apotik');
    expect(metadata.themeColor).toBe('#0f766e');
    expect(metadata.title).not.toContain('eBisnis');
  });

  it('mengenali demo apotik sebagai brand sendiri', () => {
    const metadata = metadataForHost('demo-apotik.emedik.id');

    expect(metadata.title).toBe('Demo Apotik eMedik - Farmasi dan POS Apotik');
    expect(metadata.siteName).toBe('Demo Apotik eMedik');
  });
});

describe('metadataForHost MitraInap', () => {
  it('memakai brand MitraInap pada apex dan www', () => {
    for (const host of ['mitrainap.id', 'www.mitrainap.id']) {
      const metadata = metadataForHost(host);
      expect(metadata.siteName).toBe('MitraInap.id');
      expect(metadata.themeColor).toBe('#4f46e5');
      expect(metadata.title).toContain('MitraInap.id');
      expect(metadata.title).not.toContain('eBisnis');
    }
  });

  it('mengenali subdomain mitrainap.id sebagai brand yang sama', () => {
    const metadata = metadataForHost('app.mitrainap.id');
    expect(metadata.siteName).toBe('MitraInap.id');
  });
});
