/**
 * Katalog inti dalam bentuk yang sama dengan katalog vertikal.
 *
 * Inti mendaftar lewat pintu yang sama, tanpa perlakuan istimewa. Bila inti
 * istimewa, jalur inti dan jalur vertikal akan berbeda perilakunya — dan yang
 * jarang dipakai akan membusuk tanpa ada yang tahu, sampai vertikal pertama
 * mencobanya.
 *
 * Awalannya kosong: inti memiliki menu apa pun. Vertikal wajib berawalan, dan
 * registri menegakkannya.
 */

import {
  MENU_TREE_SEED,
  PERMISSION_ACTIONS_SEED,
} from './tenant-menu.seed';
import { TENANT_ROLE_CATALOG } from './tenant-role.seed';
import type { VerticalCatalog } from './vertical-catalog.registry';

export const CORE_VERTICAL_CATALOG: VerticalCatalog = {
  code: 'core',
  prefix: '',
  menus: MENU_TREE_SEED,
  roles: TENANT_ROLE_CATALOG,
  permissionActions: PERMISSION_ACTIONS_SEED,
};
