import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantMigrationService } from '../../infrastructure/provisioning/tenant-migration.service';
import {
  FEATURE_CATALOG_SEED,
  LOCALE_SEED,
  MODULE_CATALOG_SEED,
  PAYMENT_CHANNEL_SEED,
  PAYMENT_EXPIRY_OPTIONS,
  PLATFORM_PERMISSION_SEED,
  PLATFORM_ROLE_SEED,
  SUBSCRIPTION_ADDON_SEED,
  SUBSCRIPTION_PLAN_SEED,
} from './registry/platform-master-seeds';
import { CmsSeedService } from './cms-seed.service';
import { PERMISSION_ACTIONS_SEED, MENU_TREE_SEED, ROLE_TEMPLATES_SEED } from '../../infrastructure/provisioning/tenant-menu.seed';
import { MasterSeedVerifyReport, MasterSeedVerifyRow } from './master-seed.types';

/** Batch id tetap untuk data contoh control plane agar seed idempotent. */
const SAMPLE_BATCH_ID = '00000000-0000-4000-8000-0000000000a1';

@Injectable()
export class PlatformSeedService {
  private readonly logger = new Logger(PlatformSeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly migrations: TenantMigrationService,
    private readonly cmsSeed: CmsSeedService,
  ) {}

  async seedAll(): Promise<{ summary: Record<string, number> }> {
    const summary: Record<string, number> = {};
    summary.locales = await this.seedLocales();
    summary.translationNamespaces = await this.seedTranslationNamespaces();
    summary.permissions = await this.seedPermissions();
    summary.roles = await this.seedRoles();
    summary.superAdmin = await this.seedSuperAdmin();
    summary.globalActions = await this.seedGlobalPermissionActions();
    summary.globalMenus = await this.seedGlobalMenuTemplates();
    summary.globalRoles = await this.seedGlobalRoleTemplates();
    summary.modules = await this.seedModules();
    summary.features = await this.seedFeatures();
    summary.plans = await this.seedPlans();
    summary.addOns = await this.seedAddOns();
    summary.discounts = await this.seedDiscountPrograms();
    summary.paymentChannels = await this.seedPaymentProvider();
    summary.migrationCatalog = await this.seedMigrationCatalog();
    summary.settings = await this.seedSettings();
    const cms = await this.cmsSeed.seedAll();
    Object.assign(summary, cms);
    return { summary };
  }

  // -------------------------------------------------------------------------

  private async seedLocales(): Promise<number> {
    for (const locale of LOCALE_SEED) {
      await this.prisma.locale.upsert({
        where: { code: locale.code },
        create: {
          code: locale.code,
          name: locale.name,
          nativeName: locale.nativeName,
          direction: locale.direction,
          enabled: locale.enabled,
          isDefault: locale.isDefault,
          fallbackCode: locale.fallbackCode ?? null,
          numberFormat: locale.numberFormat,
          sortOrder: locale.sortOrder,
          isSystem: true,
        },
        update: {
          name: locale.name,
          nativeName: locale.nativeName,
          direction: locale.direction,
          fallbackCode: locale.fallbackCode ?? null,
          sortOrder: locale.sortOrder,
        },
      });
    }
    return LOCALE_SEED.length;
  }

  private async seedTranslationNamespaces(): Promise<number> {
    const namespaces = [
      { code: 'common', name: 'Umum' },
      { code: 'auth', name: 'Autentikasi' },
      { code: 'menu', name: 'Menu' },
      { code: 'action', name: 'Aksi' },
      { code: 'master', name: 'Master Data' },
      { code: 'billing', name: 'Penagihan' },
      { code: 'inventory', name: 'Persediaan' },
      { code: 'purchasing', name: 'Pembelian' },
      { code: 'error', name: 'Pesan Kesalahan' },
      { code: 'web', name: 'Website Publik' },
      { code: 'payment', name: 'Pembayaran' },
      { code: 'validation', name: 'Validasi' },
    ];
    for (const [index, ns] of namespaces.entries()) {
      await this.prisma.translationNamespace.upsert({
        where: { code: ns.code },
        create: { code: ns.code, name: ns.name, sortOrder: index + 1, isSystem: true },
        update: { name: ns.name, sortOrder: index + 1 },
      });
    }
    return namespaces.length;
  }

  private async seedPermissions(): Promise<number> {
    for (const [index, code] of PLATFORM_PERMISSION_SEED.entries()) {
      const [, moduleCode, actionCode] = code.split('.');
      await this.prisma.platformPermission.upsert({
        where: { code },
        create: {
          code,
          moduleCode,
          actionCode,
          name: humanize(`${moduleCode} ${actionCode}`),
          nameKey: `permission.${code.toLowerCase().replace(/\./g, '_')}`,
          sortOrder: index + 1,
          isSystem: true,
        },
        update: { moduleCode, actionCode, sortOrder: index + 1 },
      });
    }
    return PLATFORM_PERMISSION_SEED.length;
  }

  private async seedRoles(): Promise<number> {
    const allPermissions = await this.prisma.platformPermission.findMany({
      select: { id: true, code: true },
    });
    const permissionMap = new Map(allPermissions.map((p) => [p.code, p.id]));

    for (const role of PLATFORM_ROLE_SEED) {
      const created = await this.prisma.platformRole.upsert({
        where: { code: role.code },
        create: {
          code: role.code,
          name: role.name,
          nameKey: `role.${role.code.toLowerCase()}`,
          description: role.description,
          roleType: role.roleType,
          sortOrder: role.sortOrder,
          isSystem: true,
        },
        update: { name: role.name, description: role.description, sortOrder: role.sortOrder },
      });

      const codes =
        role.permissions === '*' ? PLATFORM_PERMISSION_SEED : (role.permissions as string[]);
      for (const permissionCode of codes) {
        const permissionId = permissionMap.get(permissionCode);
        if (!permissionId) continue;
        await this.prisma.platformRolePermission.upsert({
          where: { roleId_permissionId: { roleId: created.id, permissionId } },
          create: { roleId: created.id, permissionId, effect: 'ALLOW' },
          update: {},
        });
      }
    }
    return PLATFORM_ROLE_SEED.length;
  }

  /**
   * Seed Platform Super Admin.
   * Idempotent: bila user sudah ada, hash/password/mustChangePassword TIDAK diubah.
   */
  private async seedSuperAdmin(): Promise<number> {
    const username = this.config.get<string>('bootstrap.superAdminUsername', 'admin');
    const normalized = username.trim().toLowerCase();
    const isProduction = this.config.get<boolean>('isProduction', false);
    const password = this.config.get<string>('bootstrap.superAdminPassword', '');

    const existing = await this.prisma.platformUser.findUnique({
      where: { normalizedUsername: normalized },
    });

    if (existing) {
      // Pastikan role assignment tetap ada, tetapi jangan sentuh credential.
      await this.assignSuperAdminRole(existing.id);
      this.logger.log(`Super admin "${normalized}" sudah ada — credential tidak diubah.`);
      return 0;
    }

    if (!password) {
      if (isProduction) {
        throw new Error(
          'BOOTSTRAP_SUPER_ADMIN_PASSWORD wajib diisi dari secret manager pada production.',
        );
      }
      this.logger.warn('BOOTSTRAP_SUPER_ADMIN_PASSWORD kosong — super admin tidak dibuat.');
      return 0;
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await this.prisma.platformUser.create({
      data: {
        username: normalized,
        normalizedUsername: normalized,
        email: `${normalized}@ebisnis.local`,
        normalizedEmail: `${normalized}@ebisnis.local`,
        displayName: 'Platform Super Admin',
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: this.config.get<boolean>('bootstrap.forcePasswordChange', true),
        isPlatformStaff: true,
        isSystem: true,
        preferredLocaleCode: 'id',
        profile: { create: { fullName: 'Platform Super Admin', timezone: 'Asia/Jakarta' } },
      },
    });

    await this.assignSuperAdminRole(user.id);

    // Audit pembuatan bootstrap TANPA mencatat password.
    await this.prisma.auditEvent.create({
      data: {
        moduleCode: 'PLATFORM',
        actionCode: 'BOOTSTRAP_SUPER_ADMIN_CREATED',
        entityType: 'PlatformUser',
        entityId: user.id,
        actorUsername: 'system',
        result: 'SUCCESS',
        metadata: { username: normalized, mustChangePassword: true },
      },
    });

    this.logger.log(`Super admin "${normalized}" dibuat dengan forced password change.`);
    return 1;
  }

  private async assignSuperAdminRole(userId: string): Promise<void> {
    const role = await this.prisma.platformRole.findUnique({
      where: { code: 'PLATFORM_SUPER_ADMIN' },
    });
    if (!role) return;
    await this.prisma.platformUserRole.upsert({
      where: { userId_roleId: { userId, roleId: role.id } },
      create: { userId, roleId: role.id },
      update: {},
    });
  }

  private async seedGlobalPermissionActions(): Promise<number> {
    for (const action of PERMISSION_ACTIONS_SEED) {
      await this.prisma.globalPermissionAction.upsert({
        where: { code: action.code },
        create: {
          code: action.code,
          name: action.name,
          nameKey: action.nameKey,
          actionType: action.actionType,
          sortOrder: action.sortOrder,
          isSystem: true,
        },
        update: { name: action.name, nameKey: action.nameKey, sortOrder: action.sortOrder },
      });
    }
    return PERMISSION_ACTIONS_SEED.length;
  }

  private async seedGlobalMenuTemplates(): Promise<number> {
    const idByCode = new Map<string, string>();
    for (const node of MENU_TREE_SEED) {
      const parentId = node.parentCode ? idByCode.get(node.parentCode) ?? null : null;
      const path = node.parentCode ? `/${node.parentCode}/${node.code}` : `/${node.code}`;
      const created = await this.prisma.globalMenuTemplate.upsert({
        where: { code: node.code },
        create: {
          code: node.code,
          parentId,
          translationKey: node.translationKey,
          defaultLabel: node.label,
          route: node.route ?? null,
          icon: node.icon ?? null,
          moduleCode: node.moduleCode ?? null,
          level: node.parentCode ? 1 : 0,
          path,
          sortOrder: node.sortOrder,
          isComingSoon: node.comingSoon ?? false,
          actionCodes: node.actions ?? ['READ'],
          isSystem: true,
        },
        update: {
          parentId,
          translationKey: node.translationKey,
          defaultLabel: node.label,
          route: node.route ?? null,
          sortOrder: node.sortOrder,
          isComingSoon: node.comingSoon ?? false,
          actionCodes: node.actions ?? ['READ'],
        },
      });
      idByCode.set(node.code, created.id);
    }
    return MENU_TREE_SEED.length;
  }

  private async seedGlobalRoleTemplates(): Promise<number> {
    for (const template of ROLE_TEMPLATES_SEED) {
      await this.prisma.globalRoleTemplate.upsert({
        where: { code: template.code },
        create: {
          code: template.code,
          name: template.name,
          nameKey: `role.tenant.${template.code.toLowerCase()}`,
          description: template.description,
          roleType: 'TENANT',
          isDefault: template.code === 'OWNER',
          permissions: template.permissions as Prisma.InputJsonValue,
          sortOrder: template.sortOrder,
          isSystem: true,
        },
        update: {
          name: template.name,
          description: template.description,
          permissions: template.permissions as Prisma.InputJsonValue,
          sortOrder: template.sortOrder,
        },
      });
    }
    return ROLE_TEMPLATES_SEED.length;
  }

  private async seedModules(): Promise<number> {
    for (const mod of MODULE_CATALOG_SEED) {
      await this.prisma.moduleCatalog.upsert({
        where: { code: mod.code },
        create: {
          code: mod.code,
          name: mod.name,
          nameKey: `module.${mod.code.toLowerCase()}`,
          descriptionKey: `module.${mod.code.toLowerCase()}.desc`,
          category: mod.category,
          icon: mod.icon,
          dependsOn: (mod.dependsOn ?? []) as Prisma.InputJsonValue,
          sortOrder: mod.sortOrder,
          isSystem: true,
        },
        update: {
          name: mod.name,
          category: mod.category,
          icon: mod.icon,
          dependsOn: (mod.dependsOn ?? []) as Prisma.InputJsonValue,
          sortOrder: mod.sortOrder,
        },
      });
    }
    return MODULE_CATALOG_SEED.length;
  }

  private async seedFeatures(): Promise<number> {
    const modules = await this.prisma.moduleCatalog.findMany({ select: { id: true, code: true } });
    const moduleMap = new Map(modules.map((m) => [m.code, m.id]));
    for (const feature of FEATURE_CATALOG_SEED) {
      const moduleId = moduleMap.get(feature.moduleCode);
      if (!moduleId) continue;
      await this.prisma.featureCatalog.upsert({
        where: { code: feature.code },
        create: {
          code: feature.code,
          moduleId,
          name: feature.name,
          nameKey: `feature.${feature.code.toLowerCase()}`,
          featureType: feature.featureType,
          defaultLimit: feature.defaultLimit ?? null,
          unit: feature.unit ?? null,
          sortOrder: feature.sortOrder,
          isSystem: true,
        },
        update: {
          moduleId,
          name: feature.name,
          featureType: feature.featureType,
          defaultLimit: feature.defaultLimit ?? null,
          sortOrder: feature.sortOrder,
        },
      });
    }
    return FEATURE_CATALOG_SEED.length;
  }

  private async seedPlans(): Promise<number> {
    const product = await this.prisma.subscriptionProduct.upsert({
      where: { code: 'POS_DEVICE_LICENSE' },
      create: {
        code: 'POS_DEVICE_LICENSE',
        name: 'Lisensi Perangkat POS',
        nameKey: 'product.posDeviceLicense',
        productType: 'LICENSE',
        defaultTrialDays: this.config.get<number>('pricing.defaultPosTrialDays', 30),
        isSystem: true,
      },
      update: {},
    });

    const modules = await this.prisma.moduleCatalog.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true },
    });
    const moduleMap = new Map(modules.map((m) => [m.code, m.id]));
    const features = await this.prisma.featureCatalog.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, code: true },
    });
    const featureMap = new Map(features.map((f) => [f.code, f.id]));

    const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');

    for (const planSeed of SUBSCRIPTION_PLAN_SEED) {
      const plan = await this.prisma.subscriptionPlan.upsert({
        where: { code: planSeed.code },
        create: {
          productId: product.id,
          code: planSeed.code,
          name: planSeed.name,
          nameKey: `plan.${planSeed.code.toLowerCase()}`,
          descriptionKey: `plan.${planSeed.code.toLowerCase()}.desc`,
          metadata: { description: planSeed.description },
          status: 'PUBLISHED',
          isPublic: true,
          isRecommended: planSeed.isRecommended,
          sortOrder: planSeed.sortOrder,
        },
        update: {
          name: planSeed.name,
          isRecommended: planSeed.isRecommended,
          sortOrder: planSeed.sortOrder,
          status: 'PUBLISHED',
          metadata: { description: planSeed.description },
        },
      });

      const existingVersion = await this.prisma.subscriptionPlanVersion.findUnique({
        where: { planId_versionNumber: { planId: plan.id, versionNumber: 1 } },
      });

      const version =
        existingVersion ??
        (await this.prisma.subscriptionPlanVersion.create({
          data: {
            planId: plan.id,
            versionNumber: 1,
            status: 'PUBLISHED',
            effectiveFrom,
            futureModulePolicy: 'SNAPSHOT_AT_VERSION',
            tenantWidePolicy: 'ANY_ACTIVE_ITEM',
            trialDays: this.config.get<number>('pricing.defaultPosTrialDays', 30),
            gracePeriodDays: 7,
            publishedAt: new Date(),
            changeNote: 'Seed penawaran awal development.',
          },
        }));

      // Modul paket
      const moduleEntries =
        planSeed.modules === 'ALL_MODULES_AT_VERSION'
          ? modules.map((m) => ({
              code: m.code,
              scope: m.code === 'POS' ? ('DEVICE' as const) : ('TENANT_WIDE' as const),
            }))
          : planSeed.modules;

      for (const [index, entry] of moduleEntries.entries()) {
        const moduleId = moduleMap.get(entry.code);
        if (!moduleId) continue;
        await this.prisma.subscriptionPlanModule.upsert({
          where: {
            planVersionId_moduleId: { planVersionId: version.id, moduleId },
          },
          create: {
            planVersionId: version.id,
            moduleId,
            entitlementScope: entry.scope,
            included: true,
            sortOrder: index + 1,
          },
          update: { entitlementScope: entry.scope, included: true },
        });
      }

      // Fitur paket
      const featureCodes =
        planSeed.features === 'ALL_FEATURES_AT_VERSION'
          ? features.map((f) => f.code)
          : (planSeed.features as string[]);
      for (const featureCode of featureCodes) {
        const featureId = featureMap.get(featureCode);
        if (!featureId) continue;
        await this.prisma.subscriptionPlanFeature.upsert({
          where: { planVersionId_featureId: { planVersionId: version.id, featureId } },
          create: { planVersionId: version.id, featureId, included: true },
          update: { included: true },
        });
      }

      // Harga + tier
      const price = await this.prisma.subscriptionPlanPrice.upsert({
        where: {
          planVersionId_currencyCode_billingMetric_billingInterval_intervalCount_effectiveFrom: {
            planVersionId: version.id,
            currencyCode: 'IDR',
            billingMetric: 'PER_POS_DEVICE',
            billingInterval: 'MONTH',
            intervalCount: 1,
            effectiveFrom,
          },
        },
        create: {
          planVersionId: version.id,
          currencyCode: 'IDR',
          billingMetric: 'PER_POS_DEVICE',
          billingInterval: 'MONTH',
          intervalCount: 1,
          unitPrice: new Prisma.Decimal(planSeed.unitPrice),
          minimumQty: 1,
          effectiveFrom,
        },
        update: { unitPrice: new Prisma.Decimal(planSeed.unitPrice) },
      });

      for (const [index, tier] of planSeed.tiers.entries()) {
        await this.prisma.subscriptionPlanPriceTier.upsert({
          where: { priceId_minQuantity: { priceId: price.id, minQuantity: tier.min } },
          create: {
            priceId: price.id,
            minQuantity: tier.min,
            maxQuantity: tier.max,
            unitPrice: new Prisma.Decimal(tier.unitPrice),
            sortOrder: index + 1,
          },
          update: {
            maxQuantity: tier.max,
            unitPrice: new Prisma.Decimal(tier.unitPrice),
            sortOrder: index + 1,
          },
        });
      }

      for (const constraint of planSeed.constraints) {
        await this.prisma.subscriptionPlanConstraint.upsert({
          where: {
            planVersionId_constraintType: {
              planVersionId: version.id,
              constraintType: constraint.type,
            },
          },
          create: {
            planVersionId: version.id,
            constraintType: constraint.type,
            numericValue: constraint.value,
          },
          update: { numericValue: constraint.value },
        });
      }
    }
    return SUBSCRIPTION_PLAN_SEED.length;
  }

  private async seedAddOns(): Promise<number> {
    const modules = await this.prisma.moduleCatalog.findMany({ select: { id: true, code: true } });
    const moduleMap = new Map(modules.map((m) => [m.code, m.id]));
    const effectiveFrom = new Date('2026-01-01T00:00:00.000Z');

    for (const [index, addOnSeed] of SUBSCRIPTION_ADDON_SEED.entries()) {
      const addOn = await this.prisma.subscriptionAddOn.upsert({
        where: { code: addOnSeed.code },
        create: {
          code: addOnSeed.code,
          name: addOnSeed.name,
          nameKey: `addon.${addOnSeed.code.toLowerCase()}`,
          sortOrder: index + 1,
        },
        update: { name: addOnSeed.name, sortOrder: index + 1 },
      });

      const version = await this.prisma.subscriptionAddOnVersion.upsert({
        where: { addOnId_versionNumber: { addOnId: addOn.id, versionNumber: 1 } },
        create: {
          addOnId: addOn.id,
          versionNumber: 1,
          status: 'PUBLISHED',
          effectiveFrom,
          publishedAt: new Date(),
        },
        update: {},
      });

      for (const moduleCode of addOnSeed.modules) {
        const moduleId = moduleMap.get(moduleCode);
        if (!moduleId) continue;
        await this.prisma.subscriptionAddOnModule.upsert({
          where: {
            addOnVersionId_moduleId: { addOnVersionId: version.id, moduleId },
          },
          create: {
            addOnVersionId: version.id,
            moduleId,
            entitlementScope: addOnSeed.scope,
          },
          update: { entitlementScope: addOnSeed.scope },
        });
      }

      await this.prisma.subscriptionAddOnPrice.upsert({
        where: {
          addOnVersionId_currencyCode_billingInterval_intervalCount_effectiveFrom: {
            addOnVersionId: version.id,
            currencyCode: 'IDR',
            billingInterval: 'MONTH',
            intervalCount: 1,
            effectiveFrom,
          },
        },
        create: {
          addOnVersionId: version.id,
          currencyCode: 'IDR',
          billingMetric: 'FLAT_TENANT',
          billingInterval: 'MONTH',
          intervalCount: 1,
          unitPrice: new Prisma.Decimal(addOnSeed.unitPrice),
          effectiveFrom,
        },
        update: { unitPrice: new Prisma.Decimal(addOnSeed.unitPrice) },
      });
    }
    return SUBSCRIPTION_ADDON_SEED.length;
  }

  /** Contoh aturan: diskon 10% untuk lebih dari 10 perangkat. */
  private async seedDiscountPrograms(): Promise<number> {
    const program = await this.prisma.discountProgram.upsert({
      where: { code: 'DISC_POS_ABOVE_10' },
      create: {
        code: 'DISC_POS_ABOVE_10',
        name: 'Diskon POS di atas 10 perangkat',
        nameKey: 'discount.posAbove10',
        description: 'Diskon 10% bila jumlah perangkat yang dipilih lebih dari 10.',
        priority: 100,
        stackPolicy: 'EXCLUSIVE',
        status: 'PUBLISHED',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        isSample: true,
        sampleBatchId: SAMPLE_BATCH_ID,
      },
      update: { status: 'PUBLISHED' },
    });

    const rule = await this.prisma.discountRule.upsert({
      where: { programId_code: { programId: program.id, code: 'RULE_DEVICE_GT_10' } },
      create: {
        programId: program.id,
        code: 'RULE_DEVICE_GT_10',
        name: 'Perangkat lebih dari 10',
        sequence: 1,
      },
      update: {},
    });

    const existingGroup = await this.prisma.discountConditionGroup.findFirst({
      where: { ruleId: rule.id, parentGroupId: null },
    });
    const group =
      existingGroup ??
      (await this.prisma.discountConditionGroup.create({
        data: { ruleId: rule.id, operator: 'AND', sequence: 1 },
      }));

    const existingCondition = await this.prisma.discountCondition.findFirst({
      where: { groupId: group.id, field: 'SELECTED_DEVICE_COUNT' },
    });
    if (!existingCondition) {
      await this.prisma.discountCondition.create({
        data: {
          groupId: group.id,
          field: 'SELECTED_DEVICE_COUNT',
          operator: 'GT',
          valueJson: { value: 10 },
          sequence: 1,
        },
      });
    }

    const existingBenefit = await this.prisma.discountBenefit.findFirst({
      where: { ruleId: rule.id, benefitType: 'PERCENT_DISCOUNT' },
    });
    if (!existingBenefit) {
      await this.prisma.discountBenefit.create({
        data: {
          ruleId: rule.id,
          benefitType: 'PERCENT_DISCOUNT',
          numericValue: new Prisma.Decimal(10),
          labelKey: 'discount.posAbove10.benefit',
          sequence: 1,
        },
      });
    }

    // Program kedua: promo tahunan.
    const annual = await this.prisma.discountProgram.upsert({
      where: { code: 'DISC_ANNUAL_PREPAY' },
      create: {
        code: 'DISC_ANNUAL_PREPAY',
        name: 'Diskon Pembayaran Tahunan',
        nameKey: 'discount.annualPrepay',
        description: 'Diskon 15% untuk pembayaran dengan interval tahunan.',
        priority: 90,
        stackPolicy: 'BEST_PRICE',
        status: 'PUBLISHED',
        validFrom: new Date('2026-01-01T00:00:00.000Z'),
        isSample: true,
        sampleBatchId: SAMPLE_BATCH_ID,
      },
      update: { status: 'PUBLISHED' },
    });
    const annualRule = await this.prisma.discountRule.upsert({
      where: { programId_code: { programId: annual.id, code: 'RULE_ANNUAL' } },
      create: { programId: annual.id, code: 'RULE_ANNUAL', name: 'Interval tahunan', sequence: 1 },
      update: {},
    });
    const annualGroup =
      (await this.prisma.discountConditionGroup.findFirst({
        where: { ruleId: annualRule.id, parentGroupId: null },
      })) ??
      (await this.prisma.discountConditionGroup.create({
        data: { ruleId: annualRule.id, operator: 'AND', sequence: 1 },
      }));
    const annualCondition = await this.prisma.discountCondition.findFirst({
      where: { groupId: annualGroup.id, field: 'BILLING_INTERVAL' },
    });
    if (!annualCondition) {
      await this.prisma.discountCondition.create({
        data: {
          groupId: annualGroup.id,
          field: 'BILLING_INTERVAL',
          operator: 'EQ',
          valueJson: { value: 'YEAR' },
          sequence: 1,
        },
      });
    }
    const annualBenefit = await this.prisma.discountBenefit.findFirst({
      where: { ruleId: annualRule.id },
    });
    if (!annualBenefit) {
      await this.prisma.discountBenefit.create({
        data: {
          ruleId: annualRule.id,
          benefitType: 'PERCENT_DISCOUNT',
          numericValue: new Prisma.Decimal(15),
          labelKey: 'discount.annualPrepay.benefit',
          sequence: 1,
        },
      });
    }

    return 2;
  }

  private async seedPaymentProvider(): Promise<number> {
    const provider = await this.prisma.paymentProvider.upsert({
      where: { code: 'ESMARTLINK' },
      create: {
        code: 'ESMARTLINK',
        name: 'Esmartlink',
        environment: 'SANDBOX',
        // Tetap DISABLED sampai konfigurasi credential tersedia.
        status: this.config.get<boolean>('esmartlink.enabled', false) ? 'SANDBOX' : 'DISABLED',
        baseUrl: this.config.get<string>('esmartlink.baseUrl', '') || null,
        createOrderPath: 'api/payment/create-order',
        inquiryOrderPath: 'api/payment/inquiry-order/',
        callbackUrl: this.config.get<string>('esmartlink.callbackUrl', ''),
        successRedirectUrl: `${this.config.get<string>('webUrl', '')}/payment/success`,
        failedRedirectUrl: `${this.config.get<string>('webUrl', '')}/payment/failed`,
        secretReference: 'env:ESMARTLINK_CLIENT_ID,env:ESMARTLINK_CLIENT_SECRET',
        allowedIps: this.config.get<string[]>('esmartlink.allowedIps', []).join(',') || null,
        trustProxy: this.config.get<boolean>('esmartlink.trustProxy', false),
        ackSuccess: this.config.get<string>('esmartlink.ackSuccess', 'OK'),
        ackError: this.config.get<string>('esmartlink.ackError', 'ERROR'),
        rawPayloadRetentionDays: this.config.get<number>(
          'esmartlink.rawPayloadRetentionDays',
          90,
        ),
        defaultChannelCodes: 'VA_CIMB,VA_BRI',
        statusMapping: {
          success: 'PAID',
          settlement: 'PAID',
          paid: 'PAID',
          pending: 'PENDING',
          expire: 'EXPIRED',
          expired: 'EXPIRED',
          cancel: 'CANCELLED',
          deny: 'FAILED',
          failure: 'FAILED',
        },
        isSystem: true,
      },
      update: {
        callbackUrl: this.config.get<string>('esmartlink.callbackUrl', ''),
        ackSuccess: this.config.get<string>('esmartlink.ackSuccess', 'OK'),
        ackError: this.config.get<string>('esmartlink.ackError', 'ERROR'),
      },
    });

    for (const channel of PAYMENT_CHANNEL_SEED) {
      await this.prisma.paymentChannel.upsert({
        where: { providerId_code: { providerId: provider.id, code: channel.code } },
        create: {
          providerId: provider.id,
          code: channel.code,
          name: channel.name,
          labelKey: `payment.channel.${channel.code.toLowerCase()}`,
          adminFeeType: channel.feeType ?? 'FIXED',
          adminFeeValue: new Prisma.Decimal(channel.adminFee),
          expiryOptions: PAYMENT_EXPIRY_OPTIONS,
          sortOrder: channel.sortOrder,
          isSample: true,
          sampleBatchId: SAMPLE_BATCH_ID,
        },
        update: {
          name: channel.name,
          adminFeeType: channel.feeType ?? 'FIXED',
          adminFeeValue: new Prisma.Decimal(channel.adminFee),
          expiryOptions: PAYMENT_EXPIRY_OPTIONS,
          sortOrder: channel.sortOrder,
        },
      });
    }
    return PAYMENT_CHANNEL_SEED.length;
  }

  private async seedMigrationCatalog(): Promise<number> {
    await this.migrations.syncCatalog();
    return this.migrations.getManifest().migrations.length;
  }

  private async seedSettings(): Promise<number> {
    const settings: Array<{ key: string; valueType: string; value: unknown; description: string }> = [
      { key: 'PLATFORM_NAME', valueType: 'STRING', value: 'eBisnis.id', description: 'Nama platform.' },
      { key: 'DEFAULT_COUNTRY', valueType: 'STRING', value: 'Indonesia', description: 'Negara default pendaftaran.' },
      { key: 'DEFAULT_CURRENCY', valueType: 'STRING', value: 'IDR', description: 'Mata uang default.' },
      { key: 'DEFAULT_TIMEZONE', valueType: 'STRING', value: 'Asia/Jakarta', description: 'Zona waktu default.' },
      { key: 'REGISTRATION_OPEN', valueType: 'BOOLEAN', value: true, description: 'Pendaftaran publik dibuka.' },
      { key: 'DEMO_ENABLED', valueType: 'BOOLEAN', value: true, description: 'Tombol Coba Demo aktif.' },
      { key: 'GENERATE_PASSWORD_DEFAULT', valueType: 'BOOLEAN', value: true, description: 'Default opsi buat password otomatis pada pendaftaran.' },
      { key: 'MASTER_SEED_MINIMUM', valueType: 'NUMBER', value: 10, description: 'Minimum record contoh per master.' },
      { key: 'PAYMENT_CHECK_BATCH_MAX', valueType: 'NUMBER', value: this.config.get<number>('esmartlink.checkBatchMax', 300), description: 'Batas maksimum item cek pembayaran massal.' },
      { key: 'TAX_RATE_DEFAULT_PERCENT', valueType: 'NUMBER', value: 11, description: 'Tarif pajak default untuk invoice langganan.' },
    ];
    for (const setting of settings) {
      await this.prisma.platformSetting.upsert({
        where: { key: setting.key },
        create: {
          key: setting.key,
          valueType: setting.valueType,
          value: { value: setting.value } as Prisma.InputJsonValue,
          description: setting.description,
          isSystem: true,
        },
        update: { description: setting.description },
      });
    }
    return settings.length;
  }

  /** Verifikasi minimum 10 record aktif per master control plane. */
  async verify(): Promise<MasterSeedVerifyReport> {
    const checks: Array<{
      resourceCode: string;
      label: string;
      minimum: number;
      count: () => Promise<number>;
    }> = [
      { resourceCode: 'LOCALE', label: 'Bahasa', minimum: 10, count: () => this.prisma.locale.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'TRANSLATION_NAMESPACE', label: 'Namespace Terjemahan', minimum: 10, count: () => this.prisma.translationNamespace.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'PLATFORM_PERMISSION', label: 'Permission Platform', minimum: 10, count: () => this.prisma.platformPermission.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'PLATFORM_ROLE', label: 'Role Platform', minimum: 4, count: () => this.prisma.platformRole.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'GLOBAL_PERMISSION_ACTION', label: 'Aksi Permission Global', minimum: 10, count: () => this.prisma.globalPermissionAction.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'GLOBAL_MENU_TEMPLATE', label: 'Template Menu Global', minimum: 10, count: () => this.prisma.globalMenuTemplate.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'GLOBAL_ROLE_TEMPLATE', label: 'Template Role Global', minimum: 5, count: () => this.prisma.globalRoleTemplate.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'MODULE_CATALOG', label: 'Katalog Modul', minimum: 10, count: () => this.prisma.moduleCatalog.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'FEATURE_CATALOG', label: 'Katalog Fitur', minimum: 10, count: () => this.prisma.featureCatalog.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'SUBSCRIPTION_PLAN', label: 'Paket Langganan', minimum: 4, count: () => this.prisma.subscriptionPlan.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'PAYMENT_CHANNEL', label: 'Channel Pembayaran', minimum: 10, count: () => this.prisma.paymentChannel.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'NEWS_CATEGORY', label: 'Kategori Berita', minimum: 10, count: () => this.prisma.newsCategory.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'NEWS_TAG', label: 'Tag Berita', minimum: 10, count: () => this.prisma.newsTag.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'NEWS_ARTICLE', label: 'Artikel Berita', minimum: 10, count: () => this.prisma.newsArticle.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'FAQ_CATEGORY', label: 'Kategori FAQ', minimum: 10, count: () => this.prisma.faqCategory.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'FAQ_ITEM', label: 'Item FAQ', minimum: 10, count: () => this.prisma.faqItem.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'ANNOUNCEMENT', label: 'Pengumuman', minimum: 10, count: () => this.prisma.announcement.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'TESTIMONIAL', label: 'Testimoni', minimum: 10, count: () => this.prisma.testimonial.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'PARTNER_LOGO', label: 'Logo Mitra', minimum: 10, count: () => this.prisma.partnerLogo.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'MARKETING_FEATURE', label: 'Fitur Pemasaran', minimum: 10, count: () => this.prisma.marketingFeature.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'MEDIA_FOLDER', label: 'Folder Media', minimum: 10, count: () => this.prisma.mediaFolder.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'PLATFORM_SETTING', label: 'Pengaturan Platform', minimum: 10, count: () => this.prisma.platformSetting.count({ where: { isActive: true } }) },
      { resourceCode: 'CMS_PAGE', label: 'Halaman CMS', minimum: 5, count: () => this.prisma.cmsPage.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'CALL_TO_ACTION', label: 'Call to Action', minimum: 4, count: () => this.prisma.callToAction.count({ where: { isActive: true, deletedAt: null } }) },
      { resourceCode: 'SCHEMA_MIGRATION_CATALOG', label: 'Katalog Migration Tenant', minimum: 5, count: () => this.prisma.schemaMigrationCatalog.count({ where: { isActive: true } }) },
    ];

    const rows: MasterSeedVerifyRow[] = [];
    for (const check of checks) {
      const activeCount = await check.count();
      rows.push({
        resourceCode: check.resourceCode,
        label: check.label,
        requiredMinimum: check.minimum,
        activeCount,
        sampleCount: activeCount,
        status: activeCount >= check.minimum ? 'OK' : 'INSUFFICIENT',
        missingCodes: [],
      });
    }

    const failing = rows.filter((r) => r.status === 'INSUFFICIENT');
    return {
      schemaName: this.config.get<string>('schema.platform', 'platform'),
      scope: 'platform',
      checkedAt: new Date().toISOString(),
      passed: failing.length === 0,
      totalResources: rows.length,
      failingResources: failing.length,
      rows,
    };
  }
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split(/[\s_]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
