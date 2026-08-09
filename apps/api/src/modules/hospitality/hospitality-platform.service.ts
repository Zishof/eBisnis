import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import {
  HOSPITALITY_PLAN_SEED,
  HOSPITALITY_PRODUCT_CODE,
} from '../master-seed/registry/platform-master-seeds';
import { HOSPITALITY_USAGE_METRICS, NON_BILLABLE_USAGE_SOURCES } from './hospitality-platform';

const REQUIRED_TABLES = [
  'hospitality_property',
  'hospitality_room_type',
  'hospitality_room',
  'hospitality_room_block',
  'hospitality_guest',
  'hospitality_reservation',
  'hospitality_rate_plan',
  'hospitality_channel_account',
] as const;

@Injectable()
export class HospitalityPlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantConnectionService,
  ) {}

  async health(schemaName: string, tenantId: string) {
    const [product, plan, assignments, tables] = await Promise.all([
      this.prisma.subscriptionProduct.findUnique({
        where: { code: HOSPITALITY_PRODUCT_CODE },
        select: { code: true, status: true, metadata: true },
      }),
      this.prisma.subscriptionPlan.findUnique({
        where: { code: HOSPITALITY_PLAN_SEED.code },
        include: {
          versions: {
            where: { status: 'PUBLISHED', deletedAt: null },
            take: 1,
            include: { modules: true, features: true, prices: { where: { isActive: true, deletedAt: null } } },
          },
        },
      }),
      this.prisma.packageAssignment.count({ where: { tenantId, status: 'ACTIVE', isActive: true } }),
      this.tenantDb.queryAdmin<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema=$1 AND table_name = ANY($2::text[])`,
        [schemaName, [...REQUIRED_TABLES]],
      ),
    ]);
    const tableSet = new Set(tables.map((table) => table.table_name));
    const missingTables = REQUIRED_TABLES.filter((table) => !tableSet.has(table));
    const version = plan?.versions[0];
    const catalogReady = Boolean(product && plan && version);
    return {
      status: catalogReady && missingTables.length === 0 ? 'ok' : 'degraded',
      product: {
        code: HOSPITALITY_PRODUCT_CODE,
        catalogReady,
        priceStatus:
          (plan?.metadata as { priceStatus?: string } | null)?.priceStatus ??
          HOSPITALITY_PLAN_SEED.priceStatus,
        configuredPriceCount: version?.prices.length ?? 0,
        moduleCount: version?.modules.length ?? 0,
        featureCount: version?.features.length ?? 0,
      },
      entitlement: { activePackageAssignments: assignments },
      provisioning: {
        schemaName,
        requiredTableCount: REQUIRED_TABLES.length,
        missingTables,
      },
      usage: {
        metrics: HOSPITALITY_USAGE_METRICS,
        nonBillableSources: NON_BILLABLE_USAGE_SOURCES,
      },
    };
  }
}
