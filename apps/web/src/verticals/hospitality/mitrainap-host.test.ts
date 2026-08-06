/**
 * Pengujian pengenalan host mitrainap.id.
 *
 * Yang dijaga di sini: apex adalah PORTAL, subdomain adalah PROPERTI.
 * Menyamakan keduanya berarti setiap properti yang mendaftar kehilangan
 * situsnya sendiri dan hanya melihat halaman jualan platform.
 */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';
import {
  LABEL_TERPESAN_MITRAINAP,
  isMitrainapDemoHost,
  isMitrainapPortalHost,
  slugPropertiDariHost,
} from './mitrainap-host';

describe('host portal', () => {
  it('apex dan www adalah portal', () => {
    expect(isMitrainapPortalHost('mitrainap.id')).toBe(true);
    expect(isMitrainapPortalHost('www.mitrainap.id')).toBe(true);
    expect(isMitrainapPortalHost('MITRAINAP.ID')).toBe(true);
    expect(isMitrainapPortalHost('mitrainap.id:443')).toBe(true);
    expect(isMitrainapPortalHost('mitrainap.id.')).toBe(true);
  });

  it('subdomain properti BUKAN portal', () => {
    expect(isMitrainapPortalHost('hotel-demo.mitrainap.id')).toBe(false);
  });

  it('domain lain bukan portal', () => {
    for (const h of ['ebisnis.id', 'mitrainap.id.evil.com', 'notmitrainap.id', 'mitrainap.idmedia.id']) {
      expect(isMitrainapPortalHost(h)).toBe(false);
    }
  });
});

describe('host demo', () => {
  it('demo.mitrainap.id adalah host demo', () => {
    expect(isMitrainapDemoHost('demo.mitrainap.id')).toBe(true);
    expect(isMitrainapDemoHost('DEMO.MITRAINAP.ID')).toBe(true);
  });

  it('bukan portal maupun properti', () => {
    expect(isMitrainapPortalHost('demo.mitrainap.id')).toBe(false);
    expect(slugPropertiDariHost('demo.mitrainap.id')).toBeNull();
  });

  it('host lain bukan host demo', () => {
    expect(isMitrainapDemoHost('mitrainap.id')).toBe(false);
    expect(isMitrainapDemoHost('hotel-demo.mitrainap.id')).toBe(false);
  });
});

describe('slug properti', () => {
  it('subdomain satu tingkat menjadi slug', () => {
    expect(slugPropertiDariHost('hotel-demo.mitrainap.id')).toBe('hotel-demo');
    expect(slugPropertiDariHost('Grand-Hotel.MITRAINAP.ID')).toBe('grand-hotel');
  });

  it('apex dan www bukan properti', () => {
    expect(slugPropertiDariHost('mitrainap.id')).toBeNull();
    expect(slugPropertiDariHost('www.mitrainap.id')).toBeNull();
  });

  it('label terpesan platform bukan properti', () => {
    for (const label of LABEL_TERPESAN_MITRAINAP) {
      expect(slugPropertiDariHost(`${label}.mitrainap.id`)).toBeNull();
    }
  });

  it('label terpesan sisi peramban tidak berselisih dengan sisi API', () => {
    let sumber: string;
    try {
      sumber = readFileSync('../api/src/infrastructure/portal/portal-host.ts', 'utf8');
    } catch {
      return; // Dijalankan di luar monorepo; bukan urusan uji ini.
    }

    const blok = sumber.match(/LABEL_TERPESAN\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    expect(blok, 'LABEL_TERPESAN tidak ditemukan di sisi API').not.toBeNull();

    const labelApi = [...blok![1].matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(labelApi.length).toBeGreaterThan(5);

    const hilang = labelApi.filter((l) => !LABEL_TERPESAN_MITRAINAP.has(l));
    expect(hilang).toEqual([]);
  });

  it('subdomain bertingkat ditolak', () => {
    expect(slugPropertiDariHost('a.b.mitrainap.id')).toBeNull();
  });

  it('slug berbentuk bukan label DNS ditolak', () => {
    expect(slugPropertiDariHost('-awal.mitrainap.id')).toBeNull();
    expect(slugPropertiDariHost('akhir-.mitrainap.id')).toBeNull();
    expect(slugPropertiDariHost(`${'a'.repeat(64)}.mitrainap.id`)).toBeNull();
  });

  it('domain yang sekadar MEMUAT mitrainap.id ditolak', () => {
    expect(slugPropertiDariHost('hotel.mitrainap.id.evil.com')).toBeNull();
  });
});
