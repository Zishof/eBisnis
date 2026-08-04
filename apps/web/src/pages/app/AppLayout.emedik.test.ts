import { describe, expect, it, vi } from 'vitest';
import { routeAplikasi } from './AppLayout';

describe('route aplikasi pada host eMedik', () => {
  it('mengarahkan menu induk POS ke POS Apotik pada host apotik', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo-apotik.emedik.id' } });
    expect(routeAplikasi('/app/pos')).toBe('/app/apotik/pos');
    expect(routeAplikasi('/app/pos/kasir')).toBe('/app/pos/kasir');
    vi.unstubAllGlobals();
  });

  it('membiarkan host eMedik umum memakai POS biasa', () => {
    vi.stubGlobal('window', { location: { hostname: 'demo.emedik.id' } });
    expect(routeAplikasi('/app/pos')).toBe('/app/pos');
    vi.unstubAllGlobals();
  });
});
