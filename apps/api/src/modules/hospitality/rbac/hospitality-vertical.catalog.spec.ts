/**
 * Pengujian katalog vertikal Hospitality (MitraInap.id).
 *
 * Kesalahan di sini tidak menghasilkan galat: ia menghasilkan menu yang tidak
 * pernah dapat dibuka, atau peran yang diam-diam tidak berdaya apa-apa.
 */

import {
  HOSPITALITY_MENUS,
  HOSPITALITY_PREFIX,
  HOSPITALITY_ROLES,
  HOSPITALITY_VERTICAL_CATALOG,
  ROLE_ADMIN_HOSPITALITY,
} from './hospitality-vertical.catalog';
import { VERTICAL_CATALOGS } from '../../../infrastructure/provisioning/vertical-catalogs';
import { buildMenuModuleMap, resolveMenuActions } from '../../../infrastructure/provisioning/role-expansion';

describe('katalog vertikal Hospitality', () => {
  it('setiap menu berawalan HOSPITALITY_', () => {
    const salah = HOSPITALITY_MENUS.filter((m) => !m.code.startsWith(HOSPITALITY_PREFIX));
    expect(salah).toEqual([]);
  });

  it('setiap menu menyebutkan aksinya', () => {
    const kosong = HOSPITALITY_MENUS.filter((m) => !m.actions || m.actions.length === 0);
    expect(kosong).toEqual([]);
  });

  it('menu dengan CREATE/UPDATE juga menawarkan READ', () => {
    for (const m of HOSPITALITY_MENUS) {
      const aksi = m.actions ?? [];
      if (aksi.includes('CREATE') || aksi.includes('UPDATE')) {
        expect(aksi).toContain('READ');
      }
    }
  });

  it('kode role tidak kembar', () => {
    const kode = HOSPITALITY_ROLES.map((r) => r.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('HOSPITALITY_ADMIN dapat membuka dan mencatat HOSPITALITY_PROPERTI (lewat grup HOSPITALITY_GROUP)', () => {
    const admin = HOSPITALITY_ROLES.find((r) => r.code === ROLE_ADMIN_HOSPITALITY);
    expect(admin).toBeDefined();
    expect(admin!.allModules).not.toBe(true);

    const moduleMap = buildMenuModuleMap(HOSPITALITY_MENUS);
    const properti = HOSPITALITY_MENUS.find((m) => m.code === 'HOSPITALITY_PROPERTI')!;
    const aksi = resolveMenuActions(admin!, properti, moduleMap.get('HOSPITALITY_PROPERTI')!);
    expect(aksi).toContain('READ');
    expect(aksi).toContain('CREATE');
    expect(aksi).toContain('UPDATE');
  });

  it('setiap modul yang disebut peran benar-benar ada pada daftar menu', () => {
    const kodeMenu = new Set(HOSPITALITY_MENUS.map((m) => m.code));
    const takDikenali = HOSPITALITY_ROLES.flatMap((peran) =>
      Object.keys(peran.modules)
        .filter((modul) => modul !== 'HOME' && modul !== 'SUPPORT' && !kodeMenu.has(modul))
        .map((modul) => `${peran.code} -> ${modul}`),
    );
    expect(takDikenali).toEqual([]);
  });

  it('terdaftar pada VERTICAL_CATALOGS', () => {
    expect(VERTICAL_CATALOGS).toContain(HOSPITALITY_VERTICAL_CATALOG);
  });

  it('kode katalog tidak bertabrakan dengan katalog lain', () => {
    const kode = VERTICAL_CATALOGS.map((c) => c.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
