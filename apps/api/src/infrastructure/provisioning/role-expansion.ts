/**
 * Penurunan katalog role menjadi baris izin menu.
 *
 * Role menyatakan profil per modul; berkas ini yang mengubahnya menjadi daftar
 * aksi per menu. Karena penurunan dilakukan saat penyemaian, menambah menu baru
 * pada modul yang sudah dikenal otomatis terwarisi seluruh role tanpa satu pun
 * baris katalog role diubah.
 */
import { MENU_TREE_SEED, type MenuNodeSeed, type RoleTemplateSeed } from './tenant-menu.seed';
import { PROFILE_ACTIONS, type ProfileCode } from './role-profile';
import { ROLE_CATALOG, TENANT_ROLE_CATALOG, type RoleCatalogEntry } from './tenant-role.seed';

/** Aksi yang berlaku bila sebuah node menu tidak menyatakan daftar aksinya. */
const DEFAULT_MENU_ACTIONS = ['READ'];

/** Peta kode menu ke kode modul, yaitu kode leluhur teratasnya. */
export function buildMenuModuleMap(menus: readonly MenuNodeSeed[] = MENU_TREE_SEED): Map<string, string> {
  const parentOf = new Map<string, string | undefined>(menus.map((m) => [m.code, m.parentCode]));
  const rootOf = new Map<string, string>();

  for (const menu of menus) {
    let current = menu.code;
    const guard = new Set<string>([current]);
    for (;;) {
      const parent = parentOf.get(current);
      if (!parent) break;
      if (guard.has(parent)) {
        throw new Error(`Menu tree mengandung siklus pada '${menu.code}'`);
      }
      guard.add(parent);
      current = parent;
    }
    rootOf.set(menu.code, current);
  }

  return rootOf;
}

/**
 * Aksi yang diperoleh sebuah role pada satu menu.
 *
 * Hasilnya adalah irisan antara aksi yang diberikan profil dan aksi yang
 * memang ditawarkan menu tersebut. Irisan ini penting: tanpanya sebuah role
 * akan tercatat memiliki EXPORT pada halaman yang sama sekali tidak punya
 * ekspor, dan daftar izin berhenti mencerminkan kenyataan.
 */
export function resolveMenuActions(role: RoleCatalogEntry, menu: MenuNodeSeed, moduleCode: string): string[] {
  const profile: ProfileCode | undefined =
    role.modules[moduleCode] ?? (role.allModules ? role.profile : undefined);
  if (!profile || profile === 'P0') return [];

  const granted = PROFILE_ACTIONS[profile];
  const offered = menu.actions ?? DEFAULT_MENU_ACTIONS;
  return offered.filter((action) => granted.includes(action));
}

/** Menurunkan satu role katalog menjadi template siap semai. */
export function expandRole(
  role: RoleCatalogEntry,
  menus: readonly MenuNodeSeed[] = MENU_TREE_SEED,
  moduleMap: Map<string, string> = buildMenuModuleMap(menus),
  sortOrder = 0,
): RoleTemplateSeed {
  const permissions: Record<string, string[]> = {};

  for (const menu of menus) {
    const moduleCode = moduleMap.get(menu.code);
    if (!moduleCode) continue;
    const actions = resolveMenuActions(role, menu, moduleCode);
    if (actions.length > 0) permissions[menu.code] = actions;
  }

  return {
    code: role.code,
    name: role.name,
    description: role.description,
    roleType: role.family,
    sortOrder,
    permissions,
  };
}

/**
 * Seluruh role tenant, sudah diturunkan dan siap disemai.
 *
 * Role tanpa satu pun izin tetap dikembalikan. Role seperti `ADMIN_WEBSITE`
 * menunggu modul yang menunya belum ada; menyembunyikannya akan membuat
 * katalog tampak lebih kecil daripada yang sebenarnya dirancang.
 */
export function expandTenantRoles(menus: readonly MenuNodeSeed[] = MENU_TREE_SEED): RoleTemplateSeed[] {
  const moduleMap = buildMenuModuleMap(menus);
  return TENANT_ROLE_CATALOG.map((role, index) => expandRole(role, menus, moduleMap, (index + 1) * 10));
}

/** Peta role lama Versi 5 ke padanan Versi 8, untuk migrasi penugasan. */
export function buildLegacyRoleMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const role of ROLE_CATALOG) {
    if (role.legacyCode && role.legacyCode !== role.code) map.set(role.legacyCode, role.code);
  }
  return map;
}
