import {
  ESCHOOL_MENUS,
  ESCHOOL_PREFIX,
  ESCHOOL_ROLES,
  ESCHOOL_VERTICAL_CATALOG,
  ROLE_ADMIN_ESCHOOL,
  ROLE_OPERATOR_DAPODIK,
} from './eschool-vertical.catalog';
import { VERTICAL_CATALOGS } from '../../../infrastructure/provisioning/vertical-catalogs';
import { buildMenuModuleMap, resolveMenuActions } from '../../../infrastructure/provisioning/role-expansion';

describe('katalog vertikal eSchool', () => {
  it('setiap menu dan role berawalan ESCHOOL_', () => {
    expect(ESCHOOL_MENUS.filter((m) => !m.code.startsWith(ESCHOOL_PREFIX))).toEqual([]);
    expect(ESCHOOL_ROLES.filter((r) => !r.code.startsWith(ESCHOOL_PREFIX))).toEqual([]);
  });

  it('setiap parentCode menunjuk menu yang ada', () => {
    const kode = new Set(ESCHOOL_MENUS.map((m) => m.code));
    const yatim = ESCHOOL_MENUS.filter((m) => m.parentCode && !kode.has(m.parentCode));
    expect(yatim).toEqual([]);
  });

  it('setiap menu menyebut aksi dan aksi tulis tetap menyertakan READ', () => {
    for (const menu of ESCHOOL_MENUS) {
      expect(menu.actions?.length).toBeGreaterThan(0);
      if (menu.actions?.some((a) => ['CREATE', 'UPDATE', 'IMPORT', 'DELETE'].includes(a))) {
        expect(menu.actions).toContain('READ');
      }
    }
  });

  it('admin eSchool dapat membuka seluruh menu lewat grup eSchool', () => {
    const admin = ESCHOOL_ROLES.find((r) => r.code === ROLE_ADMIN_ESCHOOL)!;
    const moduleMap = buildMenuModuleMap(ESCHOOL_MENUS);
    const siswa = ESCHOOL_MENUS.find((m) => m.code === 'ESCHOOL_SISWA')!;
    const rapor = ESCHOOL_MENUS.find((m) => m.code === 'ESCHOOL_AKADEMIK')!;

    expect(resolveMenuActions(admin, siswa, moduleMap.get('ESCHOOL_SISWA')!)).toContain('IMPORT');
    expect(resolveMenuActions(admin, rapor, moduleMap.get('ESCHOOL_AKADEMIK')!)).toContain('APPROVE');
  });

  it('operator DAPODIK hanya memegang DAPODIK dan master data formal yang terkait', () => {
    const operator = ESCHOOL_ROLES.find((r) => r.code === ROLE_OPERATOR_DAPODIK)!;
    expect(operator.modules.ESCHOOL_DAPODIK).toBe('P3');
    expect(operator.modules.ESCHOOL_MASTER).toBe('P3');
    expect(operator.modules.ESCHOOL_AKADEMIK).toBeUndefined();
    expect(operator.allModules).not.toBe(true);
  });

  it('terdaftar pada VERTICAL_CATALOGS', () => {
    expect(VERTICAL_CATALOGS).toContain(ESCHOOL_VERTICAL_CATALOG);
  });
});
