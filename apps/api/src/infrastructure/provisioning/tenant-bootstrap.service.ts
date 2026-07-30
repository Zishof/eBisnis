import { Injectable, Logger } from '@nestjs/common';
import { PoolClient } from 'pg';
import { TenantConnectionService } from '../database/tenant-connection.service';
import { PrismaService } from '../database/prisma.service';
import { deterministicBatchId } from '../../modules/master-seed/master-seed.service';
import { MENU_TREE_SEED, PERMISSION_ACTIONS_SEED, ROLE_TEMPLATES_SEED } from './tenant-menu.seed';
import { buildLegacyRoleMap, expandTenantRoles } from './role-expansion';
import { buildSodGroups, TENANT_ROLE_CATALOG } from './tenant-role.seed';
import type { DataScopeCode } from './role-profile';

/** Jumlah baris izin per pernyataan INSERT. */
const PERMISSION_INSERT_CHUNK = 500;

/**
 * Tingkat batas data yang tidak berarti apa-apa sampai penugasan konkret
 * dibuat. Pemegang role bergudang tanpa gudang yang ditugaskan harus melihat
 * nol baris, bukan seluruhnya.
 */
const SCOPES_NEEDING_ASSIGNMENT = new Set<DataScopeCode>([
  'LEGAL_ENTITY', 'BRAND', 'OUTLET', 'OUTLET_TERMINAL', 'WAREHOUSE',
  'DEPARTMENT', 'TEAM', 'ASSIGNED_TRIP', 'ASSIGNED_QUEUE', 'OWNERSHIP', 'API_SCOPE',
]);

/** Keterangan aturan pemisahan tugas, dikunci pada kode kelompok di katalog role. */
const SOD_RULE_META: Record<string, { name: string; description: string; severity: string }> = {
  POS_VOID: {
    name: 'Kasir tidak membatalkan transaksinya sendiri',
    description: 'Void dan refund harus disetujui supervisor, bukan kasir yang membuat transaksi.',
    severity: 'HIGH',
  },
  PR_APPROVAL: {
    name: 'Pemohon pembelian bukan penyetujunya',
    description: 'Permintaan pembelian disetujui pihak lain agar pengeluaran tidak disetujui sendiri.',
    severity: 'HIGH',
  },
  VENDOR_PAYMENT: {
    name: 'Pembuat pemasok bukan pembayarnya',
    description: 'Satu orang yang dapat membuat pemasok sekaligus membayarnya dapat mengalirkan dana ke pemasok fiktif.',
    severity: 'CRITICAL',
  },
  PO_RECEIPT_PAY: {
    name: 'Pemesan, penerima, dan pembayar dipisah',
    description: 'Pemesan barang, penerima barang, dan pembayar tagihan harus tiga pihak berbeda.',
    severity: 'CRITICAL',
  },
  STOCK_ADJUSTMENT: {
    name: 'Pembuat penyesuaian stok bukan penyetujunya',
    description: 'Penyesuaian stok menutupi selisih fisik; penyetujunya harus pihak lain.',
    severity: 'HIGH',
  },
  JOURNAL: {
    name: 'Penyiap jurnal bukan penyetujunya',
    description: 'Jurnal yang disiapkan dan disetujui orang yang sama menghapus kontrol pembukuan.',
    severity: 'CRITICAL',
  },
  PAYROLL: {
    name: 'Penyiap payroll bukan penyetujunya',
    description: 'Perhitungan gaji dan persetujuannya harus dipegang dua orang berbeda.',
    severity: 'CRITICAL',
  },
  EXPENSE: {
    name: 'Pengaju biaya bukan penyetujunya',
    description: 'Biaya perjalanan dan reimbursement tidak boleh disetujui pengajunya sendiri.',
    severity: 'MEDIUM',
  },
  BUDGET: {
    name: 'Penyusun anggaran bukan penyetujunya',
    description: 'Anggaran yang disusun dan disetujui orang yang sama menghilangkan kontrol perencanaan.',
    severity: 'MEDIUM',
  },
  WORKFLOW_APPROVAL: {
    name: 'Pengaju workflow bukan penyetujunya',
    description: 'Aturan umum yang berlaku pada seluruh alur persetujuan.',
    severity: 'HIGH',
  },
  CONTENT_PUBLISH: {
    name: 'Penulis konten bukan penerbitnya',
    description: 'Konten publik ditinjau pihak lain sebelum terbit.',
    severity: 'LOW',
  },
  HELP_PUBLISH: {
    name: 'Penulis panduan bukan penerbitnya',
    description: 'Panduan ditinjau pihak lain sebelum terbit agar isinya tidak menyesatkan.',
    severity: 'LOW',
  },
  AR_CASH: {
    name: 'Penagih piutang bukan penerima kasnya',
    description: 'Satu orang yang menagih sekaligus menerima uang dapat menahan setoran tanpa terlihat.',
    severity: 'CRITICAL',
  },
};

/**
 * Menyisipkan izin role secara berkelompok.
 *
 * Katalog Versi 8 menghasilkan puluhan ribu baris per tenant. Satu INSERT per
 * baris membuat pendaftaran tenant berjalan lama tanpa alasan; satu INSERT per
 * 500 baris menyelesaikannya dalam beberapa puluh pernyataan.
 */
async function insertRolePermissions(
  client: PoolClient,
  schema: string,
  roleId: string,
  rows: ReadonlyArray<readonly [string, string]>,
): Promise<number> {
  let inserted = 0;
  for (let offset = 0; offset < rows.length; offset += PERMISSION_INSERT_CHUNK) {
    const chunk = rows.slice(offset, offset + PERMISSION_INSERT_CHUNK);
    const values: string[] = [];
    const params: string[] = [roleId];
    for (const [menuId, actionId] of chunk) {
      values.push(`($1, $${params.length + 1}, $${params.length + 2}, 'ALLOW')`);
      params.push(menuId, actionId);
    }
    const result = await client.query(
      `INSERT INTO ${schema}.role_menu_permission (role_id, menu_id, permission_action_id, effect)
       VALUES ${values.join(', ')}
       ON CONFLICT (role_id, menu_id, permission_action_id) DO NOTHING`,
      params,
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export interface OrganizationSeedOptions {
  businessName: string;
  businessType?: string | null;
  contactPerson?: string | null;
  isDemo?: boolean;
}

export interface OrganizationSeedResult {
  legalEntityId: string;
  brandId: string;
  regionId: string;
  outletId: string;
  parentWarehouseId: string;
  outletWarehouseId: string;
  menuCount: number;
  roleCount: number;
  permissionCount: number;
}

@Injectable()
export class TenantBootstrapService {
  private readonly logger = new Logger(TenantBootstrapService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Membuat struktur organisasi awal + menu tree + role template.
   * Idempotent melalui ON CONFLICT DO NOTHING / lookup by code.
   */
  async seedOrganization(
    schemaName: string,
    options: OrganizationSeedOptions,
  ): Promise<OrganizationSeedResult> {
    const batchId = deterministicBatchId(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;

      // --- Alamat utama ------------------------------------------------------
      const addressId = await upsertByCode(client, S, 'address', 'ADDR-HQ', {
        code: 'ADDR-HQ',
        name: 'Alamat Utama',
        address_line1: 'Alamat belum diisi',
        country: 'Indonesia',
        is_system: true,
      });

      // --- Grup usaha + badan hukum -----------------------------------------
      const groupId = await upsertByCode(client, S, 'business_group', 'GRP-UTAMA', {
        code: 'GRP-UTAMA',
        name: options.businessName,
        path: '/GRP-UTAMA',
        level: 0,
        is_system: true,
      });

      const legalEntityId = await upsertByCode(client, S, 'legal_entity', 'LE-UTAMA', {
        code: 'LE-UTAMA',
        name: options.businessName,
        legal_name: options.businessName,
        trade_name: options.businessName,
        business_group_id: groupId,
        address_id: addressId,
        currency_code: 'IDR',
        is_system: true,
      });

      const brandId = await upsertByCode(client, S, 'brand', 'BRAND-UTAMA', {
        code: 'BRAND-UTAMA',
        name: options.businessName,
        legal_entity_id: legalEntityId,
        is_system: true,
      });

      const regionId = await upsertByCode(client, S, 'region', 'REG-A', {
        code: 'REG-A',
        name: 'Wilayah A',
        region_type: 'AREA',
        path: '/REG-A',
        level: 0,
        is_system: true,
      });

      // --- Outlet utama ------------------------------------------------------
      const outletTypeCode = mapBusinessTypeToOutletType(options.businessType);
      const outletTypeId = await lookupByCode(client, S, 'outlet_type', outletTypeCode);

      const outletId = await upsertByCode(client, S, 'outlet', 'OUTLET-UTAMA', {
        code: 'OUTLET-UTAMA',
        name: `${options.businessName} — Outlet Utama`,
        legal_entity_id: legalEntityId,
        brand_id: brandId,
        region_id: regionId,
        outlet_type_id: outletTypeId,
        address_id: addressId,
        is_system: true,
      });

      // --- Gudang ------------------------------------------------------------
      const centralTypeId = await lookupByCode(client, S, 'warehouse_type', 'CENTRAL');
      const outletTypeWarehouseId = await lookupByCode(client, S, 'warehouse_type', 'OUTLET');

      const parentWarehouseId = await upsertByCode(client, S, 'warehouse', 'GDG-PARENT', {
        code: 'GDG-PARENT',
        name: 'Gudang Parent',
        legal_entity_id: legalEntityId,
        region_id: regionId,
        warehouse_type_id: centralTypeId,
        is_parent: true,
        path: '/GDG-PARENT',
        level: 0,
        is_system: true,
      });

      const outletWarehouseId = await upsertByCode(client, S, 'warehouse', 'GDG-OUTLET-UTAMA', {
        code: 'GDG-OUTLET-UTAMA',
        name: 'Gudang Outlet Utama',
        legal_entity_id: legalEntityId,
        outlet_id: outletId,
        region_id: regionId,
        parent_warehouse_id: parentWarehouseId,
        warehouse_type_id: outletTypeWarehouseId,
        path: '/GDG-PARENT/GDG-OUTLET-UTAMA',
        level: 1,
        is_system: true,
      });

      // --- Demo mendapat outlet & gudang tambahan ---------------------------
      if (options.isDemo) {
        await this.seedDemoLocations(client, S, {
          legalEntityId,
          brandId,
          regionId,
          parentWarehouseId,
          batchId,
        });
      }

      // --- Permission action -------------------------------------------------
      for (const action of PERMISSION_ACTIONS_SEED) {
        await upsertByCode(client, S, 'permission_action', action.code, {
          code: action.code,
          name: action.name,
          name_key: action.nameKey,
          action_type: action.actionType,
          requires_step_up: action.requiresStepUp ?? false,
          sort_order: action.sortOrder,
          is_system: true,
        });
      }

      // Id aksi dibaca sekali lalu dipakai ulang. Sebelumnya setiap baris izin
      // memicu satu query lookup; dengan katalog role Versi 8 itu berarti
      // puluhan ribu round-trip di tengah pendaftaran tenant.
      const actionIds = new Map<string, string>();
      for (const action of PERMISSION_ACTIONS_SEED) {
        const id = await lookupByCode(client, S, 'permission_action', action.code);
        if (id) actionIds.set(action.code, id);
      }

      // --- Menu tree ---------------------------------------------------------
      const menuIds = new Map<string, string>();
      let menuCount = 0;
      for (const node of MENU_TREE_SEED) {
        const parentId = node.parentCode ? menuIds.get(node.parentCode) ?? null : null;
        const path = node.parentCode ? `${pathOf(menuIds, node.parentCode)}/${node.code}` : `/${node.code}`;
        const id = await upsertByCode(client, S, 'menu', node.code, {
          code: node.code,
          name: node.label,
          translation_key: node.translationKey,
          parent_id: parentId,
          route: node.route ?? null,
          icon: node.icon ?? null,
          module_code: node.moduleCode ?? null,
          level: node.parentCode ? 1 : 0,
          path,
          sort_order: node.sortOrder,
          is_coming_soon: node.comingSoon ?? false,
          is_system: true,
        });
        menuIds.set(node.code, id);
        menuCount += 1;

        for (const actionCode of node.actions ?? ['READ']) {
          const actionId = actionIds.get(actionCode);
          if (!actionId) continue;
          await client.query(
            `INSERT INTO ${S}.menu_action (menu_id, permission_action_id)
             VALUES ($1, $2) ON CONFLICT (menu_id, permission_action_id) DO NOTHING`,
            [id, actionId],
          );
        }
      }

      // --- Role template -----------------------------------------------------
      // Template lama dipertahankan lebih dulu agar penugasan pengguna yang
      // sudah ada tidak putus, lalu katalog Versi 8 ditambahkan di belakangnya.
      // Keduanya idempoten, sehingga provisioning yang diulang tidak menggandakan.
      const roleTemplates = [...ROLE_TEMPLATES_SEED, ...expandTenantRoles()];
      const catalogByCode = new Map(TENANT_ROLE_CATALOG.map((entry) => [entry.code, entry]));
      const legacyMap = buildLegacyRoleMap();
      const roleIds = new Map<string, string>();
      let roleCount = 0;
      let permissionCount = 0;
      for (const template of roleTemplates) {
        const entry = catalogByCode.get(template.code);
        const roleId = await upsertByCode(client, S, 'role', template.code, {
          code: template.code,
          name: template.name,
          description: template.description,
          role_type: template.roleType,
          sort_order: template.sortOrder,
          is_system: true,
          profile_code: entry?.profile ?? null,
          role_family: entry?.family ?? null,
          is_core: entry?.core ?? false,
          is_legacy: !entry,
          successor_code: legacyMap.get(template.code) ?? null,
        });
        roleIds.set(template.code, roleId);
        roleCount += 1;

        // upsertByCode sengaja tidak memperbarui baris yang sudah ada, agar
        // seed tidak menimpa penyuntingan tenant. Kolom tata kelola tetap perlu
        // menyusul pada tenant lama, jadi diperbarui di sini — terbatas pada
        // role sistem, dan hanya bila nilainya memang berbeda supaya tidak
        // menghasilkan baris audit palsu setiap provisioning diulang.
        await client.query(
          `UPDATE ${S}.role
              SET profile_code = $2, role_family = $3, is_core = $4,
                  is_legacy = $5, successor_code = $6, updated_at = now()
            WHERE id = $1 AND is_system = TRUE
              AND (profile_code IS DISTINCT FROM $2
                OR role_family IS DISTINCT FROM $3
                OR is_core IS DISTINCT FROM $4
                OR is_legacy IS DISTINCT FROM $5
                OR successor_code IS DISTINCT FROM $6)`,
          [
            roleId,
            entry?.profile ?? null,
            entry?.family ?? null,
            entry?.core ?? false,
            !entry,
            legacyMap.get(template.code) ?? null,
          ],
        );

        const rows: Array<[string, string]> = [];
        for (const [menuCode, actions] of Object.entries(template.permissions)) {
          const menuId = menuIds.get(menuCode);
          if (!menuId) continue;
          const actionCodes = actions === '*' ? PERMISSION_ACTIONS_SEED.map((a) => a.code) : actions;
          for (const actionCode of actionCodes) {
            const actionId = actionIds.get(actionCode);
            if (actionId) rows.push([menuId, actionId]);
          }
        }
        permissionCount += await insertRolePermissions(client, S, roleId, rows);

        if (!entry) continue;

        // Profil per modul disimpan agar penurunan izin dapat diulang saat menu
        // baru ditambahkan, tanpa menebak profil apa yang dulu dipakai.
        for (const [moduleCode, profileCode] of Object.entries(entry.modules)) {
          await client.query(
            // WHERE pada DO UPDATE menahan penulisan ulang bernilai sama.
            // Tanpanya setiap provisioning yang diulang menerbitkan satu baris
            // audit per profil, dan riwayat perubahan hak terisi perubahan yang
            // tidak pernah terjadi.
            `INSERT INTO ${S}.role_module_profile (role_id, module_code, profile_code)
             VALUES ($1, $2, $3)
             ON CONFLICT (role_id, module_code)
             DO UPDATE SET profile_code = EXCLUDED.profile_code, updated_at = now()
             WHERE role_module_profile.profile_code IS DISTINCT FROM EXCLUDED.profile_code`,
            [roleId, moduleCode, profileCode],
          );
        }

        await client.query(
          `INSERT INTO ${S}.role_data_scope (role_id, scope_level, requires_assignment, description)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (role_id)
           DO UPDATE SET scope_level = EXCLUDED.scope_level,
                         requires_assignment = EXCLUDED.requires_assignment,
                         description = EXCLUDED.description,
                         updated_at = now()
           WHERE role_data_scope.scope_level IS DISTINCT FROM EXCLUDED.scope_level
              OR role_data_scope.requires_assignment IS DISTINCT FROM EXCLUDED.requires_assignment
              OR role_data_scope.description IS DISTINCT FROM EXCLUDED.description`,
          [roleId, entry.dataScope, SCOPES_NEEDING_ASSIGNMENT.has(entry.dataScope), entry.description],
        );
      }

      // --- Aturan pemisahan tugas -------------------------------------------
      // Diturunkan dari katalog role, bukan ditulis terpisah, sehingga aturan
      // tidak mungkin menyimpang dari role yang benar-benar disemai.
      let sodRuleCount = 0;
      for (const group of buildSodGroups()) {
        const meta = SOD_RULE_META[group.group];
        if (!meta) {
          this.logger.warn(`Kelompok SoD '${group.group}' tidak punya keterangan; dilewati`);
          continue;
        }
        const ruleId = await upsertByCode(client, S, 'segregation_of_duty_rule', group.group, {
          code: group.group,
          name: meta.name,
          description: meta.description,
          severity: meta.severity,
          enforcement: 'BLOCK',
          is_system: true,
        });
        sodRuleCount += 1;

        for (const member of group.members) {
          const roleId = roleIds.get(member.code);
          if (!roleId) continue;
          await client.query(
            `INSERT INTO ${S}.segregation_of_duty_role (rule_id, role_id, side)
             VALUES ($1, $2, $3)
             ON CONFLICT (rule_id, role_id) DO UPDATE SET side = EXCLUDED.side
             WHERE segregation_of_duty_role.side IS DISTINCT FROM EXCLUDED.side`,
            [ruleId, roleId, member.side],
          );
        }
      }
      this.logger.log(
        `Tata kelola role tersemai: ${roleCount} role, ${permissionCount} izin, ${sodRuleCount} aturan SoD`,
      );

      // --- Onboarding progress ----------------------------------------------
      await client.query(
        `INSERT INTO ${S}.onboarding_progress (current_step)
         SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM ${S}.onboarding_progress)`,
      );

      // --- Setting awal ------------------------------------------------------
      const settings: Array<[string, string, unknown]> = [
        ['DEFAULT_CURRENCY', 'Mata Uang Default', 'IDR'],
        ['DEFAULT_LOCALE', 'Bahasa Default', 'id'],
        ['DEFAULT_TIMEZONE', 'Zona Waktu', 'Asia/Jakarta'],
        ['AUTO_REQUEST_ORDER_ENABLED', 'Request Order Otomatis', true],
        ['RECEIPT_REQUIRES_VALIDATION', 'Penerimaan Wajib Divalidasi', true],
      ];
      for (const [code, name, value] of settings) {
        await upsertByCode(client, S, 'app_setting', code, {
          code,
          name,
          scope_type: 'TENANT',
          value_type: typeof value === 'boolean' ? 'BOOLEAN' : 'STRING',
          value_json: JSON.stringify({ value }),
          is_system: true,
        });
      }

      return {
        legalEntityId,
        brandId,
        regionId,
        outletId,
        parentWarehouseId,
        outletWarehouseId,
        menuCount,
        roleCount,
        permissionCount,
      };
    });
  }

  private async seedDemoLocations(
    client: PoolClient,
    S: string,
    ctx: {
      legalEntityId: string;
      brandId: string;
      regionId: string;
      parentWarehouseId: string;
      batchId: string;
    },
  ): Promise<void> {
    const outletTypeStore = await lookupByCode(client, S, 'outlet_type', 'STORE');
    const outletTypeCafe = await lookupByCode(client, S, 'outlet_type', 'CAFE');
    const warehouseTypeOutlet = await lookupByCode(client, S, 'warehouse_type', 'OUTLET');

    const demoOutlets: Array<[string, string, string | null]> = [
      ['TOKO-A', 'Toko A', outletTypeStore],
      ['TOKO-B', 'Toko B', outletTypeStore],
      ['CAFE-A', 'Cafe A', outletTypeCafe],
    ];

    for (const [code, name, typeId] of demoOutlets) {
      const outletId = await upsertByCode(client, S, 'outlet', code, {
        code,
        name,
        legal_entity_id: ctx.legalEntityId,
        brand_id: ctx.brandId,
        region_id: ctx.regionId,
        outlet_type_id: typeId,
        is_sample: true,
        sample_batch_id: ctx.batchId,
      });
      await upsertByCode(client, S, 'warehouse', `GDG-${code}`, {
        code: `GDG-${code}`,
        name: `Gudang ${name}`,
        legal_entity_id: ctx.legalEntityId,
        outlet_id: outletId,
        region_id: ctx.regionId,
        parent_warehouse_id: ctx.parentWarehouseId,
        warehouse_type_id: warehouseTypeOutlet,
        path: `/GDG-PARENT/GDG-${code}`,
        level: 1,
        is_sample: true,
        sample_batch_id: ctx.batchId,
      });
    }
  }

  /**
   * Kebijakan stok contoh + saldo awal melalui ledger (bukan update langsung).
   */
  async seedOperationalSamples(
    schemaName: string,
    options: { includeStarterTransactions?: boolean } = {},
  ): Promise<{ stockPolicies: number; openingMovements: number }> {
    const batchId = deterministicBatchId(schemaName);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const warehouses = await client.query<{ id: string; code: string }>(
        `SELECT id::text AS id, code FROM ${S}.warehouse WHERE deleted_at IS NULL ORDER BY level, code`,
      );
      const products = await client.query<{ id: string; code: string; base_uom_id: string }>(
        `SELECT id::text AS id, code, base_uom_id::text AS base_uom_id
         FROM ${S}.product WHERE deleted_at IS NULL AND product_type = 'GOODS' ORDER BY sort_order LIMIT 10`,
      );

      if (!warehouses.rows.length || !products.rows.length) {
        return { stockPolicies: 0, openingMovements: 0 };
      }

      let stockPolicies = 0;
      for (const warehouse of warehouses.rows) {
        for (const product of products.rows) {
          const code = `${warehouse.code}::${product.code}`;
          const existing = await client.query(
            `SELECT 1 FROM ${S}.stock_policy WHERE code = $1 LIMIT 1`,
            [code],
          );
          if (existing.rowCount) continue;
          await client.query(
            `INSERT INTO ${S}.stock_policy
               (code, name, warehouse_id, product_id, uom_id, minimum_stock, maximum_stock,
                reorder_point, safety_stock, lead_time_days, recommended_order_qty,
                auto_request_enabled, is_sample, sample_batch_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, TRUE, $12)`,
            [
              code,
              `Kebijakan stok ${product.code} di ${warehouse.code}`,
              warehouse.id,
              product.id,
              product.base_uom_id,
              20,
              200,
              25,
              10,
              3,
              100,
              batchId,
            ],
          );
          stockPolicies += 1;
        }
      }

      let openingMovements = 0;
      if (options.includeStarterTransactions) {
        // Saldo awal Wilayah A = 250 unit tersebar pada gudang.
        const distribution: Array<[string, number]> = [
          ['GDG-PARENT', 100],
          ['GDG-TOKO-A', 50],
          ['GDG-TOKO-B', 100],
        ];
        const product = products.rows[0];
        for (const [warehouseCode, qty] of distribution) {
          const warehouse = warehouses.rows.find((w) => w.code === warehouseCode);
          if (!warehouse) continue;
          const postingKey = `OPENING::${warehouseCode}::${product.code}`;
          const exists = await client.query(
            `SELECT 1 FROM ${S}.stock_movement WHERE posting_key = $1 LIMIT 1`,
            [postingKey],
          );
          if (exists.rowCount) continue;

          await client.query(
            `INSERT INTO ${S}.stock_movement
               (movement_number, movement_type, product_id, uom_id, quantity, unit_cost,
                destination_warehouse_id, bucket_to, reference_type, reference_number, posting_key)
             VALUES ($1, 'OPENING_BALANCE', $2, $3, $4, 0, $5, 'ON_HAND', 'OPENING_BALANCE', $6, $7)`,
            [
              `MV-OPEN-${warehouseCode}-${product.code}`.slice(0, 48),
              product.id,
              product.base_uom_id,
              qty,
              warehouse.id,
              `OPEN-${warehouseCode}`,
              postingKey,
            ],
          );
          await applyBalanceDelta(client, S, {
            warehouseId: warehouse.id,
            productId: product.id,
            onHandDelta: qty,
            availableDelta: qty,
          });
          openingMovements += 1;
        }
      }

      return { stockPolicies, openingMovements };
    });
  }

  /** Membuat proyeksi user owner pada schema tenant + assignment role OWNER. */
  async createOwnerSubject(
    schemaName: string,
    owner: {
      platformUserId: string;
      username: string;
      email?: string | null;
      displayName: string;
    },
  ): Promise<{ userSubjectId: string; roleCode: string }> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const existing = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM ${S}.user_subject WHERE platform_user_id = $1 LIMIT 1`,
        [owner.platformUserId],
      );

      let userSubjectId = existing.rows[0]?.id;
      if (!userSubjectId) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO ${S}.user_subject
             (platform_user_id, code, name, username_snapshot, email_snapshot, is_owner, status, is_system)
           VALUES ($1, $2, $3, $4, $5, TRUE, 'ACTIVE', TRUE)
           RETURNING id::text AS id`,
          [
            owner.platformUserId,
            owner.username,
            owner.displayName,
            owner.username,
            owner.email ?? null,
          ],
        );
        userSubjectId = inserted.rows[0].id;
      }

      const roleId = await lookupByCode(client, S, 'role', 'OWNER');
      if (roleId) {
        await client.query(
          `INSERT INTO ${S}.user_role_assignment (user_subject_id, role_id)
           VALUES ($1, $2) ON CONFLICT (user_subject_id, role_id) DO NOTHING`,
          [userSubjectId, roleId],
        );
        // Scope tenant-wide untuk role OWNER.
        await client.query(
          `INSERT INTO ${S}.role_scope (role_id, scope_type, scope_id)
           VALUES ($1::uuid, 'TENANT', NULL)
           ON CONFLICT DO NOTHING`,
          [roleId],
        );
      }

      return { userSubjectId: userSubjectId!, roleCode: 'OWNER' };
    });
  }

  /**
   * Subject pengguna sandbox demo.
   *
   * Seluruh sesi demo berbagi satu subject tetap sehingga resolusi permission,
   * menu tree, dan jejak audit berjalan melalui jalur yang sama dengan pengguna
   * biasa — tanpa cabang khusus demo pada authorization. Pembatasan aksi demo
   * ditegakkan terpisah melalui klaim `demo` pada token dan `@BlockDemo()`.
   */
  async createDemoSubject(
    schemaName: string,
  ): Promise<{ userSubjectId: string; platformUserId: string }> {
    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const existing = await client.query<{ id: string }>(
        `SELECT id::text AS id FROM ${S}.user_subject WHERE platform_user_id = $1::uuid LIMIT 1`,
        [DEMO_PLATFORM_USER_ID],
      );

      let userSubjectId = existing.rows[0]?.id;
      if (!userSubjectId) {
        const inserted = await client.query<{ id: string }>(
          `INSERT INTO ${S}.user_subject
             (platform_user_id, code, name, username_snapshot, is_owner, status, is_system)
           VALUES ($1::uuid, 'DEMO', 'Pengguna Demo', 'demo', FALSE, 'ACTIVE', TRUE)
           RETURNING id::text AS id`,
          [DEMO_PLATFORM_USER_ID],
        );
        userSubjectId = inserted.rows[0].id;
      }

      const roleId = await lookupByCode(client, S, 'role', 'DEMO_USER');
      if (roleId) {
        await client.query(
          `INSERT INTO ${S}.user_role_assignment (user_subject_id, role_id)
           VALUES ($1, $2) ON CONFLICT (user_subject_id, role_id) DO NOTHING`,
          [userSubjectId, roleId],
        );
        await client.query(
          `INSERT INTO ${S}.role_scope (role_id, scope_type, scope_id)
           VALUES ($1::uuid, 'TENANT', NULL)
           ON CONFLICT DO NOTHING`,
          [roleId],
        );
      }

      return { userSubjectId: userSubjectId!, platformUserId: DEMO_PLATFORM_USER_ID };
    });
  }
}

// ---------------------------------------------------------------------------

/**
 * Identitas platform tetap untuk sandbox demo. Bukan akun nyata dan tidak
 * memiliki kredensial; hanya dipakai sebagai kunci `platform_user_id` pada
 * `user_subject` schema demo.
 */
export const DEMO_PLATFORM_USER_ID = '00000000-0000-4000-8000-00000000de00';

const IDENT = /^[a-z_][a-z0-9_]*$/;

async function upsertByCode(
  client: PoolClient,
  schemaLiteral: string,
  table: string,
  code: string,
  payload: Record<string, unknown>,
): Promise<string> {
  if (!IDENT.test(table)) throw new Error(`Nama tabel tidak valid: ${table}`);
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM ${schemaLiteral}.${table} WHERE code = $1 LIMIT 1`,
    [code],
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const columns = Object.keys(payload).filter((c) => IDENT.test(c));
  const values = columns.map((c) => payload[c]);
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${schemaLiteral}.${table} (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING id::text AS id`,
    values,
  );
  return inserted.rows[0].id;
}

async function lookupByCode(
  client: PoolClient,
  schemaLiteral: string,
  table: string,
  code: string,
): Promise<string | null> {
  if (!IDENT.test(table)) throw new Error(`Nama tabel tidak valid: ${table}`);
  const result = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM ${schemaLiteral}.${table} WHERE code = $1 AND deleted_at IS NULL LIMIT 1`,
    [code],
  );
  return result.rows[0]?.id ?? null;
}

function pathOf(menuIds: Map<string, string>, parentCode: string): string {
  return `/${parentCode}`;
}

function mapBusinessTypeToOutletType(businessType?: string | null): string {
  const value = (businessType ?? '').toLowerCase();
  if (value.includes('kafe') || value.includes('cafe') || value.includes('kopi')) return 'CAFE';
  if (value.includes('restoran') || value.includes('resto') || value.includes('rumah makan')) {
    return 'RESTAURANT';
  }
  if (value.includes('kios')) return 'KIOSK';
  if (value.includes('kantin')) return 'CANTEEN';
  if (value.includes('pabrik') || value.includes('manufaktur')) return 'FACTORY';
  if (value.includes('kantor')) return 'OFFICE';
  if (value.includes('dapur')) return 'CENTRAL_KITCHEN';
  if (value.includes('distributor') || value.includes('grosir')) return 'OUTLET';
  return 'STORE';
}

/**
 * Mengurangi stok tersedia dari baris saldo yang benar-benar memiliki stok.
 *
 * Dipakai saat pengeluaran tidak menyebut lot tertentu. Alokasi memakai FEFO
 * (kedaluwarsa terdekat lebih dahulu), lalu baris tanpa lot. Mengembalikan
 * rincian per lot agar ledger mencatat mutasi per lot secara akurat.
 */
export async function consumeAvailable(
  client: PoolClient,
  schemaLiteral: string,
  input: { warehouseId: string; productId: string; quantity: number },
): Promise<Array<{ lotId: string | null; binId: string | null; quantity: number }>> {
  const rows = await client.query<{
    id: string;
    lot_id: string | null;
    bin_id: string | null;
    available_qty: string;
  }>(
    `SELECT b.id::text AS id, b.lot_id::text AS lot_id, b.bin_id::text AS bin_id,
            b.available_qty::text AS available_qty
     FROM ${schemaLiteral}.stock_balance b
     LEFT JOIN ${schemaLiteral}.inventory_lot l ON l.id = b.lot_id
     WHERE b.warehouse_id = $1 AND b.product_id = $2 AND b.available_qty > 0
     ORDER BY l.expiry_date NULLS LAST, b.last_movement_at NULLS FIRST
     FOR UPDATE OF b`,
    [input.warehouseId, input.productId],
  );

  let remaining = input.quantity;
  const allocations: Array<{ lotId: string | null; binId: string | null; quantity: number }> = [];

  for (const row of rows.rows) {
    if (remaining <= 0) break;
    const availableOnRow = Number(row.available_qty);
    const take = Math.min(availableOnRow, remaining);
    if (take <= 0) continue;

    await client.query(
      `UPDATE ${schemaLiteral}.stock_balance
       SET on_hand_qty = on_hand_qty - $2,
           available_qty = available_qty - $2,
           last_movement_at = now(), updated_at = now(), version = version + 1
       WHERE id = $1`,
      [row.id, take],
    );
    allocations.push({ lotId: row.lot_id, binId: row.bin_id, quantity: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error(
      `INSUFFICIENT_STOCK: kekurangan ${remaining} unit pada gudang ${input.warehouseId}.`,
    );
  }
  return allocations;
}

/** Update projection saldo stok secara atomik. */
export async function applyBalanceDelta(
  client: PoolClient,
  schemaLiteral: string,
  delta: {
    warehouseId: string;
    productId: string;
    lotId?: string | null;
    binId?: string | null;
    onHandDelta?: number;
    availableDelta?: number;
    reservedDelta?: number;
    inTransitDelta?: number;
    quarantineDelta?: number;
    damagedDelta?: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO ${schemaLiteral}.stock_balance
       (warehouse_id, product_id, lot_id, bin_id, on_hand_qty, available_qty, reserved_qty,
        in_transit_qty, quarantine_qty, damaged_qty, last_movement_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
     ON CONFLICT (warehouse_id, product_id,
                  COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid),
                  COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid))
     DO UPDATE SET
       on_hand_qty    = ${schemaLiteral}.stock_balance.on_hand_qty + EXCLUDED.on_hand_qty,
       available_qty  = ${schemaLiteral}.stock_balance.available_qty + EXCLUDED.available_qty,
       reserved_qty   = ${schemaLiteral}.stock_balance.reserved_qty + EXCLUDED.reserved_qty,
       in_transit_qty = ${schemaLiteral}.stock_balance.in_transit_qty + EXCLUDED.in_transit_qty,
       quarantine_qty = ${schemaLiteral}.stock_balance.quarantine_qty + EXCLUDED.quarantine_qty,
       damaged_qty    = ${schemaLiteral}.stock_balance.damaged_qty + EXCLUDED.damaged_qty,
       last_movement_at = now(),
       updated_at     = now(),
       version        = ${schemaLiteral}.stock_balance.version + 1`,
    [
      delta.warehouseId,
      delta.productId,
      delta.lotId ?? null,
      delta.binId ?? null,
      delta.onHandDelta ?? 0,
      delta.availableDelta ?? 0,
      delta.reservedDelta ?? 0,
      delta.inTransitDelta ?? 0,
      delta.quarantineDelta ?? 0,
      delta.damagedDelta ?? 0,
    ],
  );
}
