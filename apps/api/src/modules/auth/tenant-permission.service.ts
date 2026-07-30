import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';

interface CacheEntry {
  permissions: Set<string>;
  expiresAt: number;
}

/** Aksi yang tidak boleh dijalankan sesi demo meskipun role DEMO_USER mengizinkan. */
const DEMO_FORBIDDEN_ACTIONS = new Set([
  'HARD_DELETE',
  'EXPORT',
  'IMPORT',
  'MANAGE_DEVICE',
  'CLOSE_PERIOD',
  'REOPEN',
]);

@Injectable()
export class TenantPermissionService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly ttlMs = 30_000;

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /**
   * Menghitung permission efektif: role assignment + direct permission,
   * dengan DENY selalu menang.
   */
  async resolve(schemaName: string, platformUserId: string): Promise<Set<string>> {
    const key = `${schemaName}:${platformUserId}`;
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.permissions;

    const rows = await this.tenantDb.query<{ permission: string; effect: string; source: string }>(
      schemaName,
      `WITH subject AS (
         SELECT id FROM "${schemaName}".user_subject
         WHERE platform_user_id = $1 AND deleted_at IS NULL AND is_active = TRUE
       ),
       from_role AS (
         SELECT m.code || '.' || pa.code AS permission, rmp.effect AS effect, 'ROLE' AS source
         FROM subject s
         JOIN "${schemaName}".user_role_assignment ura ON ura.user_subject_id = s.id
           AND ura.valid_from <= now()
           AND (ura.valid_until IS NULL OR ura.valid_until >= now())
         JOIN "${schemaName}".role r ON r.id = ura.role_id AND r.deleted_at IS NULL AND r.is_active = TRUE
         JOIN "${schemaName}".role_menu_permission rmp ON rmp.role_id = r.id
         JOIN "${schemaName}".menu m ON m.id = rmp.menu_id AND m.deleted_at IS NULL AND m.is_active = TRUE
         JOIN "${schemaName}".permission_action pa ON pa.id = rmp.permission_action_id AND pa.deleted_at IS NULL
       ),
       from_direct AS (
         SELECT m.code || '.' || pa.code AS permission, udp.effect AS effect, 'DIRECT' AS source
         FROM subject s
         JOIN "${schemaName}".user_direct_permission udp ON udp.user_subject_id = s.id
         JOIN "${schemaName}".menu m ON m.id = udp.menu_id AND m.deleted_at IS NULL AND m.is_active = TRUE
         JOIN "${schemaName}".permission_action pa ON pa.id = udp.permission_action_id AND pa.deleted_at IS NULL
       )
       SELECT * FROM from_role UNION ALL SELECT * FROM from_direct`,
      [platformUserId],
    );

    const allow = new Set<string>();
    const deny = new Set<string>();
    for (const row of rows) {
      if (row.effect === 'DENY') deny.add(row.permission);
      else allow.add(row.permission);
    }
    for (const denied of deny) allow.delete(denied);

    this.cache.set(key, { permissions: allow, expiresAt: Date.now() + this.ttlMs });
    return allow;
  }

  async findMissing(
    schemaName: string,
    platformUserId: string,
    required: string[],
    options: { isDemo?: boolean } = {},
  ): Promise<string[]> {
    if (options.isDemo) {
      const blocked = required.filter((permission) => {
        const action = permission.split('.').pop() ?? '';
        return DEMO_FORBIDDEN_ACTIONS.has(action);
      });
      if (blocked.length) return blocked;
      // Sesi demo memakai role DEMO_USER yang di-seed pada schema demo;
      // tetap dievaluasi lewat resolve() di bawah.
    }
    const granted = await this.resolve(schemaName, platformUserId);
    return required.filter((permission) => !granted.has(permission));
  }

  /** Menu yang boleh dilihat pengguna (memiliki aksi READ). */
  async menuTree(
    schemaName: string,
    platformUserId: string,
    localeCode = 'id',
  ): Promise<Array<Record<string, unknown>>> {
    const granted = await this.resolve(schemaName, platformUserId);
    const menus = await this.tenantDb.query<{
      id: string;
      parent_id: string | null;
      code: string;
      name: string;
      translation_key: string;
      route: string | null;
      icon: string | null;
      module_code: string | null;
      sort_order: number;
      is_coming_soon: boolean;
    }>(
      schemaName,
      `SELECT id::text, parent_id::text, code, name, translation_key, route, icon,
              module_code, sort_order, is_coming_soon
       FROM "${schemaName}".menu
       WHERE deleted_at IS NULL AND is_active = TRUE
       ORDER BY sort_order, code`,
    );

    const actionsByMenu = new Map<string, string[]>();
    for (const permission of granted) {
      const [menuCode, action] = permission.split('.');
      if (!menuCode || !action) continue;
      const list = actionsByMenu.get(menuCode) ?? [];
      list.push(action);
      actionsByMenu.set(menuCode, list);
    }

    const visible = menus.filter((menu) => actionsByMenu.get(menu.code)?.includes('READ'));
    const byId = new Map(
      visible.map((menu) => [
        menu.id,
        {
          id: menu.id,
          code: menu.code,
          label: menu.name,
          translationKey: menu.translation_key,
          route: menu.route,
          icon: menu.icon,
          moduleCode: menu.module_code,
          sortOrder: menu.sort_order,
          isComingSoon: menu.is_coming_soon,
          actions: (actionsByMenu.get(menu.code) ?? []).sort(),
          children: [] as Array<Record<string, unknown>>,
        },
      ]),
    );

    const roots: Array<Record<string, unknown>> = [];
    for (const menu of visible) {
      const node = byId.get(menu.id)!;
      if (menu.parent_id && byId.has(menu.parent_id)) {
        (byId.get(menu.parent_id)!.children as Array<Record<string, unknown>>).push(node);
      } else if (!menu.parent_id) {
        roots.push(node);
      }
    }
    void localeCode;
    return roots;
  }

  invalidate(schemaName: string, platformUserId?: string): void {
    if (platformUserId) {
      this.cache.delete(`${schemaName}:${platformUserId}`);
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(`${schemaName}:`)) this.cache.delete(key);
    }
  }
}
