import { describe, expect, it, vi } from 'vitest';
import { routeAplikasi } from './AppLayout';

describe('route aplikasi pada host eMedik', () => {
  it('mengarahkan menu induk POS ke POS Apotik pada host apotik', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo-apotik.emedik.id' } });
    expect(routeAplikasi('/app/pos')).toBe('/app/apotik/pos');
    expect(routeAplikasi('/app/pos/kasir')).toBe('/app/pos/kasir');
    vi.unstubAllGlobals();
  });

  it('mengarahkan menu induk POS pada tenant apotik kustom', () => {
    vi.stubGlobal('window', { location: { hostname: 'sehatjaya-apotik.emedik.id' } });
    expect(routeAplikasi('/app/pos')).toBe('/app/apotik/pos');
    vi.unstubAllGlobals();
  });

  it('membiarkan host eMedik umum memakai POS biasa', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.emedik.id' } });
    expect(routeAplikasi('/app/pos')).toBe('/app/pos');
    vi.unstubAllGlobals();
  });

  it('memotong URL absolut ebisnis supaya brand tetap pada host eMedik', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.emedik.id' } });
    expect(routeAplikasi('https://ebisnis.id/app/emedik/rawat-jalan?tab=hari-ini#aktif')).toBe(
      '/app/emedik/rawat-jalan?tab=hari-ini#aktif',
    );
    expect(routeAplikasi('https://tenant.ebisnis.id/app/pos')).toBe('/app/pos');
    vi.unstubAllGlobals();
  });
});
