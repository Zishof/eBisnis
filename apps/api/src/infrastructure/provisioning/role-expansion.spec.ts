import {
  buildLegacyRoleMap,
  buildMenuModuleMap,
  expandRole,
  expandTenantRoles,
  resolveMenuActions,
} from './role-expansion';
import { PROFILE_ACTIONS, UPLOAD_CAPABLE_PROFILES, profileAllowsUpload } from './role-profile';
import {
  CORE_TENANT_ROLES,
  ROLE_CATALOG,
  TENANT_ROLE_CATALOG,
  buildSodGroups,
  type RoleCatalogEntry,
} from './tenant-role.seed';
import { MENU_TREE_SEED, PERMISSION_ACTIONS_SEED, ROLE_TEMPLATES_SEED } from './tenant-menu.seed';

const byCode = (code: string): RoleCatalogEntry => {
  const entry = ROLE_CATALOG.find((r) => r.code === code);
  if (!entry) throw new Error(`Role ${code} tidak ada di katalog`);
  return entry;
};

describe('katalog aksi permission', () => {
  it('memuat setiap aksi yang dirujuk profil P0–P12', () => {
    const known = new Set(PERMISSION_ACTIONS_SEED.map((a) => a.code));
    const referenced = new Set(Object.values(PROFILE_ACTIONS).flatMap((list) => [...list]));
    expect([...referenced].filter((code) => !known.has(code))).toEqual([]);
  });

  it('tidak memuat kode ganda', () => {
    const codes = PERMISSION_ACTIONS_SEED.map((a) => a.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  it('menuntut step-up untuk aksi yang tidak dapat dibatalkan', () => {
    const stepUp = new Set(
      PERMISSION_ACTIONS_SEED.filter((a) => a.requiresStepUp).map((a) => a.code),
    );
    const required = ['HARD_DELETE', 'CLOSE_PERIOD', 'REOPEN', 'REVERSE'];
    expect(required.filter((code) => !stepUp.has(code))).toEqual([]);
  });
});

describe('katalog role', () => {
  it('tidak memuat kode ganda', () => {
    const codes = ROLE_CATALOG.map((r) => r.code);
    expect(codes.length).toBe(new Set(codes).size);
  });

  it('hanya merujuk modul yang benar-benar ada pada menu tree', () => {
    const roots = new Set(buildMenuModuleMap().values());
    const unknown = new Set<string>();
    for (const role of ROLE_CATALOG) {
      for (const moduleCode of Object.keys(role.modules)) {
        if (!roots.has(moduleCode)) unknown.add(`${role.code}:${moduleCode}`);
      }
    }
    expect([...unknown]).toEqual([]);
  });

  it('memisahkan role platform dari role yang disemai ke tenant', () => {
    expect(TENANT_ROLE_CATALOG.every((r) => !r.platformOnly)).toBe(true);
    expect(TENANT_ROLE_CATALOG.length).toBeLessThan(ROLE_CATALOG.length);
    expect(CORE_TENANT_ROLES.length).toBeGreaterThan(0);
    expect(CORE_TENANT_ROLES.every((r) => r.core && !r.platformOnly)).toBe(true);
  });

  it('memetakan seluruh role lama Versi 5 ke padanan Versi 8', () => {
    const legacy = buildLegacyRoleMap();
    // DEMO_USER dipertahankan apa adanya sehingga tidak muncul sebagai pemetaan.
    expect(Object.fromEntries(legacy)).toEqual({
      OWNER: 'PEMILIK_USAHA',
      MANAGER: 'MANAJER_OPERASIONAL',
      CASHIER: 'KASIR_POS',
      PURCHASING_STAFF: 'STAF_PURCHASING',
      WAREHOUSE_STAFF: 'ADMIN_GUDANG',
    });
  });

  it('mempertahankan kode role lama agar penugasan pengguna tidak putus', () => {
    // Bootstrap menyemai ROLE_TEMPLATES_SEED lebih dulu, lalu katalog Versi 8.
    const seeded = new Set([
      ...ROLE_TEMPLATES_SEED.map((r) => r.code),
      ...expandTenantRoles().map((r) => r.code),
    ]);
    const legacyCodes = ['OWNER', 'MANAGER', 'CASHIER', 'PURCHASING_STAFF', 'WAREHOUSE_STAFF', 'DEMO_USER'];
    expect(legacyCodes.filter((code) => !seeded.has(code))).toEqual([]);
  });
});

describe('penurunan profil menjadi izin menu', () => {
  const moduleMap = buildMenuModuleMap();

  it('memetakan setiap menu ke leluhur teratasnya', () => {
    expect(moduleMap.get('HOME')).toBe('HOME');
    expect(moduleMap.get('POS_TERMINAL')).toBe('POS');
    expect(moduleMap.get('CATALOG_PRODUCT')).toBe('CATALOG');
    expect(moduleMap.size).toBe(MENU_TREE_SEED.length);
  });

  it('memberi hanya aksi yang memang ditawarkan menu', () => {
    const menu = MENU_TREE_SEED.find((m) => m.code === 'CATALOG_UOM')!;
    const actions = resolveMenuActions(byCode('ADMIN_MASTER_DATA'), menu, 'CATALOG');
    expect(actions.every((a) => menu.actions!.includes(a))).toBe(true);
    // UOM tidak menawarkan IMPORT walaupun profil P7 memilikinya.
    expect(actions).not.toContain('IMPORT');
  });

  it('tidak memberi apa pun pada modul yang tidak disebut role', () => {
    const menu = MENU_TREE_SEED.find((m) => m.code === 'FINANCE')!;
    expect(resolveMenuActions(byCode('PENYETUJU_PR'), menu, 'FINANCE')).toEqual([]);
  });

  it('membatasi role sempit pada modulnya sendiri', () => {
    const modules = new Set(
      Object.keys(expandRole(byCode('PENYETUJU_PR')).permissions).map((code) => moduleMap.get(code)),
    );
    expect([...modules].sort()).toEqual(['HOME', 'PURCHASING', 'SUPPORT']);
  });

  it('memberi seluruh modul hanya pada role bertanda allModules', () => {
    const adminModules = new Set(
      Object.keys(expandRole(byCode('ADMIN_TENANT')).permissions).map((code) => moduleMap.get(code)),
    );
    expect(adminModules.size).toBe(new Set(moduleMap.values()).size);
  });

  it('tidak memberi HARD_DELETE kepada administrator tenant', () => {
    const permissions = expandRole(byCode('ADMIN_TENANT')).permissions;
    const withHardDelete = Object.entries(permissions).filter(([, a]) =>
      (a as string[]).includes('HARD_DELETE'),
    );
    expect(withHardDelete).toEqual([]);
  });

  it('mengunci kasir pada terminal dan tidak memberinya pembatalan', () => {
    const permissions = expandRole(byCode('KASIR_POS')).permissions;
    expect(permissions['POS']).toContain('READ');
    expect(permissions['POS']).not.toContain('CANCEL');
    expect(byCode('KASIR_POS').dataScope).toBe('OUTLET_TERMINAL');
  });

  it('memberi auditor hanya aksi baca', () => {
    const permissions = expandRole(byCode('AUDITOR_INTERNAL')).permissions;
    const mutating = new Set(['CREATE', 'UPDATE', 'DELETE', 'POST', 'APPROVE']);
    const offending = Object.entries(permissions).flatMap(([menu, actions]) =>
      (actions as string[]).filter((a) => mutating.has(a)).map((a) => `${menu}.${a}`),
    );
    expect(offending).toEqual([]);
  });

  it('menghasilkan role tanpa kode ganda dan tanpa aksi ganda', () => {
    const expanded = expandTenantRoles();
    expect(expanded.length).toBe(new Set(expanded.map((r) => r.code)).size);
    const duplicated = expanded.flatMap((role) =>
      Object.entries(role.permissions)
        .filter(([, a]) => (a as string[]).length !== new Set(a as string[]).size)
        .map(([menu]) => `${role.code}.${menu}`),
    );
    expect(duplicated).toEqual([]);
  });

  it('hanya memberi aksi yang dikenal katalog permission', () => {
    const known = new Set(PERMISSION_ACTIONS_SEED.map((a) => a.code));
    for (const role of expandTenantRoles()) {
      for (const actions of Object.values(role.permissions)) {
        for (const action of actions as string[]) expect(known.has(action)).toBe(true);
      }
    }
  });

  it('mewarisi menu baru tanpa mengubah katalog role', () => {
    const extended = [
      ...MENU_TREE_SEED,
      {
        code: 'CATALOG_NEW_THING',
        parentCode: 'CATALOG',
        label: 'Hal Baru',
        translationKey: 'menu.catalog.newThing',
        sortOrder: 99,
        actions: ['READ', 'CREATE', 'UPDATE', 'DELETE'],
      },
    ];
    const before = expandRole(byCode('ADMIN_MASTER_DATA'));
    const after = expandRole(byCode('ADMIN_MASTER_DATA'), extended, buildMenuModuleMap(extended));
    expect(before.permissions['CATALOG_NEW_THING']).toBeUndefined();
    expect(after.permissions['CATALOG_NEW_THING']).toEqual(['READ', 'CREATE', 'UPDATE', 'DELETE']);
  });

  it('menolak menu tree yang memuat siklus', () => {
    expect(() =>
      buildMenuModuleMap([
        { code: 'A', parentCode: 'B', label: 'A', translationKey: 'a', sortOrder: 1 },
        { code: 'B', parentCode: 'A', label: 'B', translationKey: 'b', sortOrder: 2 },
      ]),
    ).toThrow(/siklus/);
  });
});

describe('syarat tombol unggah', () => {
  it('menuntut UPDATE dan DELETE sekaligus', () => {
    expect(profileAllowsUpload('P2')).toBe(false); // punya UPDATE, tanpa DELETE
    expect(profileAllowsUpload('P3')).toBe(true);
    expect(profileAllowsUpload('P4')).toBe(false); // penyetuju tidak mengunggah
    expect(UPLOAD_CAPABLE_PROFILES).toEqual(['P3', 'P5', 'P6', 'P7', 'P8']);
  });

  it('sejalan antara profil dan izin menu yang diturunkan', () => {
    const moduleMap = buildMenuModuleMap();
    const mismatched = TENANT_ROLE_CATALOG.flatMap((role) =>
      Object.entries(expandRole(role, MENU_TREE_SEED, moduleMap).permissions)
        .filter(([, a]) => (a as string[]).includes('UPDATE') && (a as string[]).includes('DELETE'))
        .filter(([menuCode]) => {
          const profile = role.modules[moduleMap.get(menuCode)!] ?? role.profile;
          return !profileAllowsUpload(profile);
        })
        .map(([menuCode]) => `${role.code}.${menuCode}`),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('pemisahan tugas', () => {
  const groups = buildSodGroups();

  it('hanya menyemai kelompok yang benar-benar melarang sesuatu', () => {
    for (const group of groups) {
      expect(new Set(group.members.map((m) => m.side)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('memuat pemisahan tiga arah pemesan, penerima, dan pembayar', () => {
    const group = groups.find((g) => g.group === 'PO_RECEIPT_PAY');
    expect(group).toBeDefined();
    expect(new Set(group!.members.map((m) => m.side)).size).toBe(3);
  });

  it('memuat aturan yang paling berulang pada blueprint', () => {
    const codes = new Set(groups.map((g) => g.group));
    const expected = [
      'JOURNAL', 'PAYROLL', 'VENDOR_PAYMENT', 'STOCK_ADJUSTMENT',
      'PR_APPROVAL', 'POS_VOID', 'EXPENSE', 'BUDGET', 'WORKFLOW_APPROVAL',
    ];
    expect(expected.filter((code) => !codes.has(code))).toEqual([]);
  });

  it('hanya merujuk role yang ada di katalog', () => {
    const known = new Set(ROLE_CATALOG.map((r) => r.code));
    for (const group of groups) {
      for (const member of group.members) expect(known.has(member.code)).toBe(true);
    }
  });

  it('tidak menempatkan satu role pada dua sisi kelompok yang sama', () => {
    for (const group of groups) {
      const codes = group.members.map((m) => m.code);
      expect(codes.length).toBe(new Set(codes).size);
    }
  });
});
