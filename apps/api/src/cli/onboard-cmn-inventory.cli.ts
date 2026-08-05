import 'dotenv/config';
import * as argon2 from 'argon2';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { createSeedContext } from './seed-runner';

type LegacyRow = { rowNumber: number; isDeleted: boolean; data: Record<string, unknown> };
type LegacyDbf = {
  fileName: string;
  filePath: string;
  fileHash: string;
  fileSizeBytes: number;
  totalRecords: number;
  activeRecords: number;
  deletedRecords: number;
  fields: Array<{ name: string; type: string; length: number }>;
  rows: LegacyRow[];
};
type LegacyFileClass = {
  status: 'PROJECTED' | 'RAW_VAULT_ONLY' | 'DUPLICATE_SUMMARY' | 'BROKEN_ARCHIVE' | 'RUNTIME_ARTIFACT' | 'SECURITY_ARCHIVE';
  projectedTable?: string;
  projectionClass: 'operational' | 'ledger' | 'historical' | 'security' | 'runtime' | 'damaged';
  note: string;
};
type LegacyImportCounts = {
  products: number;
  customers: number;
  suppliers: number;
  salesOrders: number;
  purchaseOrders: number;
  rawRecords: number;
  receivables: number;
  payables: number;
};

const TENANT = {
  code: 'CMNMEDIKA',
  name: 'Caruban Medika Nusantara',
  slug: 'cmnmedika-inventory',
  schema: 'cmnmedika_inventory',
  host: 'cmnmedika-inventory.ebisnis.id',
  verticalCode: 'CORE_ERP',
  siteVertical: 'inventory',
};

const USERS: Array<{
  username: string;
  password: string;
  displayName: string;
  roleCode: string;
  owner?: boolean;
}> = [
  { username: 'muklis', password: 'muklis123!!', displayName: 'Muklis', roleCode: 'PEMILIK_USAHA', owner: true },
  { username: 'masrukin', password: 'masrukin123!!', displayName: 'Masrukin', roleCode: 'SALES' },
  { username: 'tohirin', password: 'tohirin123!!', displayName: 'Tohirin', roleCode: 'SALES' },
  { username: 'nofal', password: 'nofal123!!', displayName: 'Nofal', roleCode: 'SALES' },
  { username: 'agung', password: 'agung123!!', displayName: 'Agung', roleCode: 'SALES' },
  {
    username: 'cmnmedika',
    password: 'cmnmedika123!!',
    displayName: 'Admin Caruban Medika Nusantara',
    roleCode: 'ADMIN_TENANT',
  },
] as const;

const LEGACY_DIR_CANDIDATES = [
  process.env.CMN_LEGACY_DBF_DIR,
  '/opt/ebisnis/imports/cmn-inventory',
  'C:/Users/USER/Documents/5-Inventory--/5-Inventory',
].filter(Boolean) as string[];

const LEGACY_FILE_CLASSIFICATION: Record<string, LegacyFileClass> = {
  'STOK.DBF': {
    status: 'PROJECTED',
    projectedTable: 'product',
    projectionClass: 'operational',
    note: 'Master obat diproyeksikan ke product dan stok awal.',
  },
  'CUSTOMER.DBF': {
    status: 'PROJECTED',
    projectedTable: 'customer',
    projectionClass: 'operational',
    note: 'Master pelanggan diproyeksikan ke customer.',
  },
  'SUPPLIER.DBF': {
    status: 'PROJECTED',
    projectedTable: 'supplier',
    projectionClass: 'operational',
    note: 'Master pemasok diproyeksikan ke supplier.',
  },
  'JUAL.DBF': {
    status: 'PROJECTED',
    projectedTable: 'sales_order',
    projectionClass: 'operational',
    note: 'Transaksi penjualan diproyeksikan ke sales order dan laporan sales.',
  },
  'BELI.DBF': {
    status: 'PROJECTED',
    projectedTable: 'purchase_order',
    projectionClass: 'operational',
    note: 'Transaksi pembelian diproyeksikan ke purchase order, receipt, dan invoice supplier.',
  },
  'BATCHNO.DBF': {
    status: 'PROJECTED',
    projectedTable: 'inventory_lot',
    projectionClass: 'operational',
    note: 'Batch dan tanggal kedaluwarsa diproyeksikan ke inventory lot.',
  },
  'TRAN_PIUT.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_receivable_ledger',
    projectionClass: 'ledger',
    note: 'Ledger piutang lama dipertahankan sebagai laporan piutang legacy.',
  },
  'PIUTSEMEN.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_receivable_ledger',
    projectionClass: 'ledger',
    note: 'Ledger piutang tambahan dipertahankan sebagai laporan piutang legacy.',
  },
  'TRAN_HUT.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_payable_ledger',
    projectionClass: 'ledger',
    note: 'Ledger hutang lama dipertahankan sebagai laporan hutang legacy.',
  },
  'SALES.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_salesperson_map',
    projectionClass: 'operational',
    note: 'Sales lama dipetakan ke akun sales CMN.',
  },
  'ACCOUNT.DBF': {
    status: 'PROJECTED',
    projectedTable: 'chart_of_account',
    projectionClass: 'ledger',
    note: 'Akun legacy diproyeksikan ke chart of account legacy.',
  },
  'JOURNAL.DBF': {
    status: 'RAW_VAULT_ONLY',
    projectionClass: 'ledger',
    note: 'Dump saat ini kosong atau belum punya pasangan debit-kredit final; raw vault tetap menyimpan struktur dan barisnya.',
  },
  'MASTERJL.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_price_history',
    projectionClass: 'historical',
    note: 'Riwayat harga jual customer dipertahankan untuk audit harga.',
  },
  'MASTERBL.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_price_history',
    projectionClass: 'historical',
    note: 'Riwayat harga beli supplier dipertahankan untuk audit harga.',
  },
  'DATAOPN.DBF': {
    status: 'PROJECTED',
    projectedTable: 'legacy_stock_opname',
    projectionClass: 'historical',
    note: 'Stock opname lama dipertahankan sebagai laporan audit stok.',
  },
  'TEMPCUST.DBF': {
    status: 'RAW_VAULT_ONLY',
    projectionClass: 'historical',
    note: 'File staging customer lama disimpan di raw vault; master resmi tetap CUSTOMER.DBF.',
  },
  'USERS.DBF': {
    status: 'SECURITY_ARCHIVE',
    projectionClass: 'security',
    note: 'User legacy diarsipkan sebagai bukti migrasi; akun baru dibuat ulang dengan hashing modern.',
  },
  'SEMBELI1.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara pembelian disimpan raw-only; detail resmi dari BELI.DBF.',
  },
  'SEMBELI2.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara pembelian disimpan raw-only; detail resmi dari BELI.DBF.',
  },
  'SEMBELI3.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara pembelian disimpan raw-only; detail resmi dari BELI.DBF.',
  },
  'SEMJUAL1.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara penjualan disimpan raw-only; detail resmi dari JUAL.DBF.',
  },
  'SEMJUAL2.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara penjualan disimpan raw-only; detail resmi dari JUAL.DBF.',
  },
  'SEMJUAL3.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara penjualan disimpan raw-only; detail resmi dari JUAL.DBF.',
  },
  'SEMJOUR1.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara jurnal disimpan raw-only untuk rekonsiliasi.',
  },
  'SEMJOUR2.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara jurnal disimpan raw-only untuk rekonsiliasi.',
  },
  'SEMJOUR3.DBF': {
    status: 'DUPLICATE_SUMMARY',
    projectionClass: 'historical',
    note: 'File ringkasan/sementara jurnal disimpan raw-only untuk rekonsiliasi.',
  },
  'FOXUSER.DBF': {
    status: 'RUNTIME_ARTIFACT',
    projectionClass: 'runtime',
    note: 'File runtime Visual FoxPro, bukan data bisnis; tetap dicatat agar audit folder lengkap.',
  },
  'JUA-RUSAKL.DBF': {
    status: 'BROKEN_ARCHIVE',
    projectionClass: 'damaged',
    note: 'File penjualan rusak/backup disimpan raw-only; transaksi resmi berasal dari JUAL.DBF.',
  },
};

async function main(): Promise<void> {
  const ctx = await createSeedContext();
  try {
    const registration = await ensureCmnRegistration(ctx);
    const owner = await ensurePlatformUser(ctx, USERS[0]);
    let tenant = await ctx.prisma.tenant.findUnique({ where: { code: TENANT.code } });
    if (!tenant) {
      tenant = await ctx.prisma.tenant.create({
        data: {
          registrationId: registration.id,
          code: TENANT.code,
          name: TENANT.name,
          slug: TENANT.slug,
          status: 'PROVISIONING',
          verticalCode: TENANT.verticalCode,
          localeCode: 'id',
          metadata: {
            product: TENANT.siteVertical,
            publicHost: TENANT.host,
            onboarding: 'cmn-inventory',
          },
        },
      });
      process.stdout.write(`Tenant ${TENANT.name} dibuat.\n`);
    } else if (
      tenant.registrationId !== registration.id ||
      tenant.verticalCode !== TENANT.verticalCode ||
      tenant.name !== TENANT.name
    ) {
      tenant = await ctx.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          registrationId: registration.id,
          name: TENANT.name,
          slug: TENANT.slug,
          verticalCode: TENANT.verticalCode,
        },
      });
    }

    const registry = await ctx.prisma.tenantSchemaRegistry.findUnique({ where: { tenantId: tenant.id } });
    if (registry) {
      await ctx.provisioner.migrateTenant(tenant.id);
      await ctx.masterSeed.seedTenant(registry.schemaName, { includeExamples: false });
      await ctx.bootstrap.seedOrganization(registry.schemaName, {
        businessName: TENANT.name,
        businessType: 'Distribusi dan sales obat',
        contactPerson: 'Muklis',
      });
      await ctx.prisma.tenant.update({
        where: { id: tenant.id },
        data: { status: 'ACTIVE', activatedAt: new Date() },
      });
      process.stdout.write(`Schema ${registry.schemaName} ditemukan; migration dan seed dasar disinkronkan.\n`);
    } else {
      await ctx.provisioner.provision({
        registrationId: registration.id,
        tenantId: tenant.id,
        desiredUsername: TENANT.schema,
        businessName: TENANT.name,
        businessType: 'Distribusi dan sales obat',
        contactPerson: 'Muklis',
        ownerPlatformUserId: owner.id,
        ownerUsername: owner.username,
        ownerEmail: owner.email,
        includeSampleData: false,
        includeStarterTransactions: false,
      });
      process.stdout.write(`Schema ${TENANT.schema} diprovision.\n`);
    }

    await ctx.prisma.verticalSiteDomain.upsert({
      where: { host: TENANT.host },
      create: {
        host: TENANT.host,
        tenantId: tenant.id,
        vertical: TENANT.siteVertical,
        status: 'ACTIVE',
        verifiedAt: new Date(),
      },
      update: {
        tenantId: tenant.id,
        vertical: TENANT.siteVertical,
        status: 'ACTIVE',
        verifiedAt: new Date(),
      },
    });

    for (const user of USERS) {
      const platformUser = await ensurePlatformUser(ctx, user);
      await ensureTenantMembershipAndRole(ctx, tenant.id, TENANT.schema, platformUser, user.roleCode, Boolean(user.owner));
    }

    const imported = await importLegacyDataIfPresent(ctx, TENANT.schema);
    await ensureCmnRegistrationReady(ctx, registration.id, tenant.id);
    process.stdout.write(
      `CMN siap: tenant=${TENANT.code}, schema=${TENANT.schema}, host=${TENANT.host}, ` +
        `produk=${imported.products}, pelanggan=${imported.customers}, pemasok=${imported.suppliers}, penjualan=${imported.salesOrders}.\n`,
    );
  } finally {
    await ctx.app.close();
  }
}

async function ensureCmnRegistration(ctx: Awaited<ReturnType<typeof createSeedContext>>) {
  const now = new Date();
  const email = 'cmnmedika@cmnmedika-inventory.ebisnis.id';
  const existing = await ctx.prisma.registration.findFirst({
    where: {
      OR: [
        { registrationCode: 'REG-CMN-INVENTORY' },
        { normalizedUsername: TENANT.schema },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });

  const data = {
    registrationCode: 'REG-CMN-INVENTORY',
    businessName: TENANT.name,
    businessType: 'Distribusi dan sales obat',
    country: 'Indonesia',
    province: 'Jawa Barat',
    cityRegency: 'Cirebon',
    district: null,
    address: 'Wilayah operasional Cirebon dan sekitarnya',
    contactPerson: 'Muklis',
    contactPhone: null,
    businessPhone: null,
    email,
    desiredUsername: TENANT.schema,
    normalizedUsername: TENANT.schema,
    generatePassword: false,
    status: 'PROVISIONING' as const,
    source: 'BOOTSTRAP_CMN_INVENTORY',
    localeCode: 'id',
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    failureCode: null,
    failureMessage: null,
  };

  const registration = existing
    ? await ctx.prisma.registration.update({
        where: { id: existing.id },
        data: {
          ...data,
          registrationCode: existing.registrationCode,
          status: existing.status === 'READY' ? 'READY' : data.status,
          deletedAt: null,
        },
      })
    : await ctx.prisma.registration.create({ data });

  await ctx.prisma.schemaNameReservation.upsert({
    where: { normalizedName: TENANT.schema },
    create: {
      normalizedName: TENANT.schema,
      auditName: `${TENANT.schema}__audit`,
      registrationId: registration.id,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
      consumedAt: now,
    },
    update: {
      auditName: `${TENANT.schema}__audit`,
      registrationId: registration.id,
      consumedAt: now,
      releasedAt: null,
      expiresAt: new Date(now.getTime() + 30 * 60_000),
    },
  });

  return registration;
}

async function ensureCmnRegistrationReady(
  ctx: Awaited<ReturnType<typeof createSeedContext>>,
  registrationId: string,
  tenantId: string,
) {
  await ctx.prisma.registration.update({
    where: { id: registrationId },
    data: {
      status: 'READY',
      failureCode: null,
      failureMessage: null,
    },
  });

  const latestJob = await ctx.prisma.provisioningJob.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  if (latestJob && !latestJob.registrationId) {
    await ctx.prisma.provisioningJob.update({
      where: { id: latestJob.id },
      data: { registrationId },
    });
  }
}

async function ensurePlatformUser(
  ctx: Awaited<ReturnType<typeof createSeedContext>>,
  input: { username: string; password: string; displayName: string },
) {
  const normalized = input.username.toLowerCase();
  const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
  return ctx.prisma.platformUser.upsert({
    where: { normalizedUsername: normalized },
    create: {
      username: input.username,
      normalizedUsername: normalized,
      email: `${normalized}@cmnmedika-inventory.ebisnis.id`,
      normalizedEmail: `${normalized}@cmnmedika-inventory.ebisnis.id`,
      displayName: input.displayName,
      passwordHash,
      mustChangePassword: false,
      preferredLocaleCode: 'id',
      metadata: { tenant: TENANT.code, bootstrap: 'cmn-inventory' },
    },
    update: {
      displayName: input.displayName,
      passwordHash,
      mustChangePassword: false,
      isActive: true,
      status: 'ACTIVE',
      metadata: { tenant: TENANT.code, bootstrap: 'cmn-inventory' },
    },
    select: { id: true, username: true, email: true, displayName: true },
  });
}

async function ensureTenantMembershipAndRole(
  ctx: Awaited<ReturnType<typeof createSeedContext>>,
  tenantId: string,
  schemaName: string,
  user: { id: string; username: string; email: string | null; displayName: string },
  roleCode: string,
  isOwner: boolean,
) {
  await ctx.tenantDb.transaction(schemaName, async (client) => {
    const S = `"${schemaName}"`;
    const subject = await upsertSubject(client, S, user, isOwner);
    const roleId = await scalar<string>(client, `SELECT id::text FROM ${S}.role WHERE code = $1 AND deleted_at IS NULL`, [
      roleCode,
    ]);
    if (!roleId) throw new Error(`Role ${roleCode} tidak ditemukan pada schema ${schemaName}.`);

    await client.query(
      `INSERT INTO ${S}.user_role_assignment (user_subject_id, role_id)
       VALUES ($1::uuid, $2::uuid)
       ON CONFLICT (user_subject_id, role_id) DO NOTHING`,
      [subject.id, roleId],
    );
    await client.query(
      `INSERT INTO ${S}.role_scope (role_id, scope_type, scope_id)
       VALUES ($1::uuid, 'TENANT', NULL)
       ON CONFLICT DO NOTHING`,
      [roleId],
    );
  });

  const subjectId = await ctx.tenantDb
    .query<{ id: string }>(schemaName, `SELECT id::text AS id FROM "${schemaName}".user_subject WHERE platform_user_id = $1::uuid`, [user.id])
    .then((r) => r[0]?.id ?? null);

  await ctx.prisma.tenantMembership.upsert({
    where: { tenantId_platformUserId: { tenantId, platformUserId: user.id } },
    create: {
      tenantId,
      platformUserId: user.id,
      tenantSubjectId: subjectId,
      isOwner,
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
    update: {
      tenantSubjectId: subjectId,
      isOwner,
      status: 'ACTIVE',
      deletedAt: null,
    },
  });
}

async function upsertSubject(
  client: PoolClient,
  schema: string,
  user: { id: string; username: string; email: string | null; displayName: string },
  isOwner: boolean,
): Promise<{ id: string }> {
  const existing = await scalar<string>(
    client,
    `SELECT id::text FROM ${schema}.user_subject WHERE platform_user_id = $1::uuid AND deleted_at IS NULL`,
    [user.id],
  );
  if (existing) {
    await client.query(
      `UPDATE ${schema}.user_subject
       SET code = $2, name = $3, username_snapshot = $4, email_snapshot = $5, is_owner = $6,
           status = 'ACTIVE', is_active = TRUE, updated_at = now(), version = version + 1
       WHERE id = $1::uuid`,
      [existing, user.username, user.displayName, user.username, user.email, isOwner],
    );
    return { id: existing };
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${schema}.user_subject
       (platform_user_id, code, name, username_snapshot, email_snapshot, is_owner, status, is_system)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, 'ACTIVE', FALSE)
     RETURNING id::text AS id`,
    [user.id, user.username, user.displayName, user.username, user.email, isOwner],
  );
  return inserted.rows[0];
}

async function importLegacyDataIfPresent(
  ctx: Awaited<ReturnType<typeof createSeedContext>>,
  schemaName: string,
): Promise<LegacyImportCounts> {
  const marker = await ctx.tenantDb
    .query<{ value: unknown }>(
      schemaName,
      `SELECT value_json AS value FROM "${schemaName}".app_setting WHERE code = 'CMN_LEGACY_IMPORT_V2' AND deleted_at IS NULL`,
    )
    .then((r) => r[0]?.value ?? null);
  const currentCounts = await operationalImportCounts(ctx, schemaName);
  const dir = LEGACY_DIR_CANDIDATES.find((candidate) => existsSync(join(candidate, 'STOK.DBF')));
  if (!dir) {
    if (marker && currentCounts.products > 0 && currentCounts.salesOrders > 0) {
      await ctx.tenantDb.transaction(schemaName, async (client) => {
        const S = `"${schemaName}"`;
        await syncLegacyAuditMetadata(client, S);
      });
      await markImport(ctx, schemaName, {
        ...(typeof marker === 'object' && marker !== null ? marker : { previousMarker: marker }),
        ...currentCounts,
        auditSyncedAt: new Date().toISOString(),
        auditVersion: 'CMN_LEGACY_AUDIT_V4',
        warning: 'Folder DBF sumber tidak ditemukan saat deploy ini; memakai data import yang sudah ada.',
      });
      process.stdout.write(
        `DBF CMN tidak ditemukan, tetapi data import sudah ada; produk=${currentCounts.products}, penjualan=${currentCounts.salesOrders}.\n`,
      );
      return currentCounts;
    }
    process.stdout.write(
      `DBF CMN belum ditemukan. Set CMN_LEGACY_DBF_DIR atau salin ke /opt/ebisnis/imports/cmn-inventory; impor akan dicoba lagi pada deploy berikutnya.\n`,
    );
    return { products: 0, customers: 0, suppliers: 0, salesOrders: 0, purchaseOrders: 0, rawRecords: 0, receivables: 0, payables: 0 };
  }

  const dbfs = loadLegacyDbfs(dir);
  const byName = new Map(dbfs.map((file) => [file.fileName.toUpperCase(), file]));
  const expectedCounts = expectedLegacyImportCounts(byName);
  if (marker) {
    if (legacyImportComplete(currentCounts, expectedCounts)) {
      await ctx.tenantDb.transaction(schemaName, async (client) => {
        const S = `"${schemaName}"`;
        await syncLegacyAuditMetadata(client, S);
      });
      await markImport(ctx, schemaName, {
        ...(typeof marker === 'object' && marker !== null ? marker : { previousMarker: marker }),
        ...currentCounts,
        expected: expectedCounts,
        auditSyncedAt: new Date().toISOString(),
        auditVersion: 'CMN_LEGACY_AUDIT_V4',
      });
      process.stdout.write(
        `Import legacy CMN sudah lengkap; ${legacyCountSummary(currentCounts, expectedCounts)}. Metadata audit DBF disinkronkan ulang.\n`,
      );
      return currentCounts;
    }
    process.stdout.write(
      `Marker import CMN ditemukan, tetapi import belum lengkap (${legacyCountSummary(currentCounts, expectedCounts)}); ` +
        `import DBF dijalankan ulang secara idempotent.\n`,
    );
  }

  const stok = activeRows(byName.get('STOK.DBF'));
  const customers = activeRows(byName.get('CUSTOMER.DBF'));
  const suppliers = activeRows(byName.get('SUPPLIER.DBF'));
  const sales = activeRows(byName.get('JUAL.DBF'));
  const purchases = activeRows(byName.get('BELI.DBF'));
  const batch = activeRows(byName.get('BATCHNO.DBF'));
  const salespeople = activeRows(byName.get('SALES.DBF'));
  // Baris DBF yang ditandai deleted adalah bukti pelunasan pada aplikasi lama.
  // Ia wajib ikut proyeksi agar tombol "Lunas Muncul" tidak kehilangan sejarah.
  const receivables = allLegacyRows(byName.get('TRAN_PIUT.DBF'));
  const cementReceivables = allLegacyRows(byName.get('PIUTSEMEN.DBF'));
  const payables = allLegacyRows(byName.get('TRAN_HUT.DBF'));
  const customerPrices = activeLegacyRows(byName.get('MASTERJL.DBF'));
  const supplierPrices = activeLegacyRows(byName.get('MASTERBL.DBF'));
  const stockOpname = activeLegacyRows(byName.get('DATAOPN.DBF'));
  const accounts = activeRows(byName.get('ACCOUNT.DBF'));
  const journals = activeRows(byName.get('JOURNAL.DBF'));

  const result = await ctx.tenantDb.transaction(schemaName, async (client) => {
    const S = `"${schemaName}"`;
    const rawRecords = await importRawLegacyDbfs(client, S, dbfs);
    const uomId = await ensureUom(client, S, 'PCS', 'Pcs');
    const categoryId = await ensureProductCategory(client, S);
    const warehouseId = await scalar<string>(client, `SELECT id::text FROM ${S}.warehouse WHERE code = 'MAIN-WH' AND deleted_at IS NULL LIMIT 1`)
      ?? await scalar<string>(client, `SELECT id::text FROM ${S}.warehouse WHERE deleted_at IS NULL LIMIT 1`);
    const outletId = await scalar<string>(client, `SELECT id::text FROM ${S}.outlet WHERE deleted_at IS NULL LIMIT 1`);

    const salesMap = await importSalespeople(client, S, salespeople);

    let productCount = 0;
    for (const row of stok) {
      const code = text(row.KODEBRG);
      const name = text(row.NAMABRG);
      if (!code || !name) continue;
      const productId = await upsertProduct(client, S, {
        categoryId,
        uomId,
        code,
        name,
        cost: number(row.HARGABELI),
        price: number(row.HARGAJUAL),
        minStock: number(row.STOKMINIM),
        metadata: row,
      });
      if (warehouseId) {
        await upsertStock(
          client,
          S,
          warehouseId,
          productId,
          null,
          number(row.AWAL) + number(row.MASUK) - Math.abs(number(row.KELUAR)),
          number(row.HARGABELI),
        );
      }
      productCount += 1;
    }

    let customerCount = 0;
    for (const row of customers) {
      const code = text(row.KODECUST) || text(row.KODE) || `CUST-${customerCount + 1}`;
      const name = text(row.NAMACUST) || text(row.NAMA) || code;
      await upsertCustomer(client, S, code, name, row);
      customerCount += 1;
    }

    let supplierCount = 0;
    for (const row of suppliers) {
      const code = text(row.KODESUPPL) || text(row.KODESUPP) || text(row.KODE) || `SUP-${supplierCount + 1}`;
      const name = text(row.NAMASUPPL) || text(row.NAMASUPP) || text(row.NAMA) || code;
      await upsertSupplier(client, S, code, name, row);
      supplierCount += 1;
    }

    const lotCount = await importLots(client, S, batch);
    const salesOrders = outletId
      ? await importSales(client, S, sales, outletId, uomId, salesMap)
      : 0;
    const purchaseOrders = warehouseId ? await importPurchases(client, S, purchases, warehouseId, uomId) : 0;
    const receivableRows = await importReceivableLedger(client, S, 'Tran_Piut.DBF', receivables, salesMap)
      + await importReceivableLedger(client, S, 'PIUTSEMEN.DBF', cementReceivables, salesMap);
    const payableRows = await importPayableLedger(client, S, payables);
    const priceRows = await importPriceHistory(client, S, 'masterjl.dbf', 'CUSTOMER', customerPrices)
      + await importPriceHistory(client, S, 'masterbl.DBF', 'SUPPLIER', supplierPrices);
    const stockOpnameRows = await importStockOpname(client, S, stockOpname);
    const accountRows = await importAccounts(client, S, accounts);
    const journalRows = await importJournalRows(client, S, journals);
    await markProjectedFiles(client, S);

    return {
      productCount,
      customerCount,
      supplierCount,
      lotCount,
      salesOrders,
      purchaseOrders,
      rawRecords,
      receivableRows,
      payableRows,
      priceRows,
      stockOpnameRows,
      accountRows,
      journalRows,
    };
  });

  await markImport(ctx, schemaName, { importedAt: new Date().toISOString(), dir, expected: expectedCounts, ...result });
  return {
    products: result.productCount,
    customers: result.customerCount,
    suppliers: result.supplierCount,
    salesOrders: result.salesOrders,
    purchaseOrders: result.purchaseOrders,
    rawRecords: result.rawRecords,
    receivables: result.receivableRows,
    payables: result.payableRows,
  };
}

async function operationalImportCounts(ctx: Awaited<ReturnType<typeof createSeedContext>>, schemaName: string) {
  const rows = await ctx.tenantDb.query<{
    products: string;
    customers: string;
    suppliers: string;
    sales_orders: string;
    purchase_orders: string;
    raw_records: string;
    receivables: string;
    payables: string;
  }>(
    schemaName,
    `SELECT
       (SELECT count(*) FROM "${schemaName}".product WHERE deleted_at IS NULL)::text AS products,
       (SELECT count(*) FROM "${schemaName}".customer WHERE deleted_at IS NULL)::text AS customers,
       (SELECT count(*) FROM "${schemaName}".supplier WHERE deleted_at IS NULL)::text AS suppliers,
       (SELECT count(*) FROM "${schemaName}".sales_order)::text AS sales_orders,
       (SELECT count(*) FROM "${schemaName}".purchase_order WHERE source_type = 'CMN_LEGACY_DBF')::text AS purchase_orders,
       (SELECT count(*) FROM "${schemaName}".legacy_import_record)::text AS raw_records,
       (SELECT count(*) FROM "${schemaName}".legacy_receivable_ledger)::text AS receivables,
       (SELECT count(*) FROM "${schemaName}".legacy_payable_ledger)::text AS payables`,
  );
  const row = rows[0];
  return {
    products: Number(row?.products ?? 0),
    customers: Number(row?.customers ?? 0),
    suppliers: Number(row?.suppliers ?? 0),
    salesOrders: Number(row?.sales_orders ?? 0),
    purchaseOrders: Number(row?.purchase_orders ?? 0),
    rawRecords: Number(row?.raw_records ?? 0),
    receivables: Number(row?.receivables ?? 0),
    payables: Number(row?.payables ?? 0),
  };
}

async function markImport(ctx: Awaited<ReturnType<typeof createSeedContext>>, schemaName: string, value: unknown) {
  await ctx.tenantDb.query(
    schemaName,
    `INSERT INTO "${schemaName}".app_setting (code, name, value_type, value_json, is_system)
     VALUES ('CMN_LEGACY_IMPORT_V2', 'Import legacy CMN Inventory lengkap', 'JSON', $1::jsonb, TRUE)
     ON CONFLICT (scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
     WHERE deleted_at IS NULL
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now(), version = "${schemaName}".app_setting.version + 1`,
    [legacyJson(value)],
  );
}

function loadLegacyDbfs(dir: string): LegacyDbf[] {
  return [
    'STOK.DBF',
    'CUSTOMER.DBF',
    'SUPPLIER.DBF',
    'JUAL.DBF',
    'BELI.DBF',
    'batchno.dbf',
    'Tran_Piut.DBF',
    'Tran_Hut.DBF',
    'SALES.DBF',
    'account.dbf',
    'journal.dbf',
    'masterjl.dbf',
    'masterbl.DBF',
    'dataopn.dbf',
    'PIUTSEMEN.DBF',
    'tempcust.dbf',
    'USERS.DBF',
    'sembeli1.dbf',
    'sembeli2.dbf',
    'sembeli3.dbf',
    'semjual1.dbf',
    'semjual2.dbf',
    'semjual3.dbf',
    'semjour1.dbf',
    'semjour2.dbf',
    'semjour3.dbf',
    'foxuser.dbf',
    'JUA-rusakL.DBF',
  ].filter((name) => existsSync(join(dir, name))).map((name) => readDbf(join(dir, name), name));
}

function activeRows(file: LegacyDbf | undefined): Array<Record<string, unknown>> {
  return file?.rows.filter((row) => !row.isDeleted).map((row) => row.data) ?? [];
}

function activeLegacyRows(file: LegacyDbf | undefined): LegacyRow[] {
  return file?.rows.filter((row) => !row.isDeleted) ?? [];
}

function allLegacyRows(file: LegacyDbf | undefined): LegacyRow[] {
  return file?.rows ?? [];
}

function expectedLegacyImportCounts(byName: Map<string, LegacyDbf>): LegacyImportCounts {
  const stok = activeRows(byName.get('STOK.DBF'));
  const customers = activeRows(byName.get('CUSTOMER.DBF'));
  const suppliers = activeRows(byName.get('SUPPLIER.DBF'));
  const sales = activeRows(byName.get('JUAL.DBF'));
  const purchases = activeRows(byName.get('BELI.DBF'));
  return {
    products: stok.filter((row) => text(row.KODEBRG) && text(row.NAMABRG)).length,
    customers: customers.filter((row) => text(row.KODECUST) || text(row.KODE) || text(row.NAMACUST) || text(row.NAMA)).length,
    suppliers: suppliers.filter((row) => text(row.KODESUPPL) || text(row.KODESUPP) || text(row.KODE) || text(row.NAMASUPPL) || text(row.NAMASUPP) || text(row.NAMA)).length,
    salesOrders: countLegacyGroups(sales, (row) => {
      const invoice = text(row.NOFAKTUR);
      return invoice ? `${dateOrNull(row.TANGGAL) ?? 'legacy'}:${invoice}` : null;
    }),
    purchaseOrders: countLegacyGroups(purchases, (row) => {
      const invoice = text(row.NOFAKTUR);
      return invoice ? `${dateOrNull(row.TANGGAL) ?? 'legacy'}:${text(row.KODESUPPL)}:${invoice}` : null;
    }),
    rawRecords: Array.from(byName.values()).reduce((sum, file) => sum + file.rows.length, 0),
    receivables: allLegacyRows(byName.get('TRAN_PIUT.DBF')).length + allLegacyRows(byName.get('PIUTSEMEN.DBF')).length,
    payables: allLegacyRows(byName.get('TRAN_HUT.DBF')).length,
  };
}

function countLegacyGroups(rows: Array<Record<string, unknown>>, keyOf: (row: Record<string, unknown>) => string | null): number {
  const groups = new Set<string>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key) groups.add(key);
  }
  return groups.size;
}

function legacyImportComplete(current: LegacyImportCounts, expected: LegacyImportCounts): boolean {
  return (
    current.products >= expected.products &&
    current.customers >= expected.customers &&
    current.suppliers >= expected.suppliers &&
    current.salesOrders >= expected.salesOrders &&
    current.purchaseOrders >= expected.purchaseOrders &&
    current.rawRecords >= expected.rawRecords &&
    current.receivables >= expected.receivables &&
    current.payables >= expected.payables
  );
}

function legacyCountSummary(current: LegacyImportCounts, expected: LegacyImportCounts): string {
  return [
    `produk=${current.products}/${expected.products}`,
    `customer=${current.customers}/${expected.customers}`,
    `supplier=${current.suppliers}/${expected.suppliers}`,
    `penjualan=${current.salesOrders}/${expected.salesOrders}`,
    `pembelian=${current.purchaseOrders}/${expected.purchaseOrders}`,
    `raw=${current.rawRecords}/${expected.rawRecords}`,
    `piutang=${current.receivables}/${expected.receivables}`,
    `hutang=${current.payables}/${expected.payables}`,
  ].join(', ');
}

function readDbf(path: string, fileName: string): LegacyDbf {
  const buf = readFileSync(path);
  const recordCount = buf.readUInt32LE(4);
  const headerLength = buf.readUInt16LE(8);
  const recordLength = buf.readUInt16LE(10);
  const fields: Array<{ name: string; type: string; length: number; offset: number }> = [];
  let offset = 1;
  for (let pos = 32; pos < headerLength - 1; pos += 32) {
    if (buf[pos] === 0x0d) break;
    const zero = buf.indexOf(0, pos);
    const name = buf.subarray(pos, zero > pos && zero < pos + 11 ? zero : pos + 11).toString('latin1').trim();
    const type = String.fromCharCode(buf[pos + 11]);
    const length = buf[pos + 16];
    fields.push({ name, type, length, offset });
    offset += length;
  }

  const rows: LegacyRow[] = [];
  let deletedRecords = 0;
  for (let i = 0; i < recordCount; i += 1) {
    const base = headerLength + i * recordLength;
    const isDeleted = buf[base] === 0x2a;
    if (isDeleted) deletedRecords += 1;
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = cleanLegacyString(buf.subarray(base + field.offset, base + field.offset + field.length).toString('latin1'));
      row[field.name] = field.type === 'N' || field.type === 'F' ? Number(raw || 0) : raw;
    }
    rows.push({ rowNumber: i + 1, isDeleted, data: row });
  }
  return {
    fileName,
    filePath: path,
    fileHash: createHash('sha256').update(buf).digest('hex'),
    fileSizeBytes: statSync(path).size,
    totalRecords: recordCount,
    activeRecords: recordCount - deletedRecords,
    deletedRecords,
    fields: fields.map(({ name, type, length }) => ({ name, type, length })),
    rows,
  };
}

async function importRawLegacyDbfs(client: PoolClient, S: string, files: LegacyDbf[]): Promise<number> {
  let imported = 0;
  for (const file of files) {
    const classification = classifyLegacyFile(file.fileName);
    const record = await client.query<{ id: string }>(
      `INSERT INTO ${S}.legacy_import_file
         (file_name, file_path, file_hash, file_size_bytes, total_records, active_records, deleted_records, imported_records, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       ON CONFLICT (source_system, file_name)
       DO UPDATE SET file_path = EXCLUDED.file_path, file_hash = EXCLUDED.file_hash,
         file_size_bytes = EXCLUDED.file_size_bytes, total_records = EXCLUDED.total_records,
         active_records = EXCLUDED.active_records, deleted_records = EXCLUDED.deleted_records,
         imported_records = EXCLUDED.imported_records, status = EXCLUDED.status, metadata = EXCLUDED.metadata,
         imported_at = now(), updated_at = now(), version = ${S}.legacy_import_file.version + 1
       RETURNING id::text AS id`,
      [
        file.fileName,
        file.filePath,
        file.fileHash,
        file.fileSizeBytes,
        file.totalRecords,
        file.activeRecords,
        file.deletedRecords,
        file.rows.length,
        classification.status,
        legacyJson({
          fields: file.fields,
          projectedTable: classification.projectedTable ?? null,
          projectionClass: classification.projectionClass,
          projectionNote: classification.note,
        }),
      ],
    );
    const fileId = record.rows[0].id;
    for (const chunk of chunks(file.rows, 250)) {
      const params: unknown[] = [];
      const values = chunk.map((row, index) => {
        const base = index * 7;
        const normalized = sanitizeLegacyJson(row.data) as Record<string, unknown>;
        const rowHash = createHash('sha256').update(legacyJson(normalized)).digest('hex');
        const key = legacyKey(file.fileName, normalized);
        params.push(fileId, file.fileName, row.rowNumber, row.isDeleted, key, legacyJson(normalized), rowHash);
        return `($${base + 1}::uuid, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb, $${base + 7})`;
      });
      await client.query(
        `INSERT INTO ${S}.legacy_import_record
           (import_file_id, file_name, row_number, is_deleted, legacy_key, row_data, row_hash)
         VALUES ${values.join(', ')}
         ON CONFLICT (file_name, row_number)
         DO UPDATE SET import_file_id = EXCLUDED.import_file_id, is_deleted = EXCLUDED.is_deleted,
           legacy_key = EXCLUDED.legacy_key, row_data = EXCLUDED.row_data, row_hash = EXCLUDED.row_hash`,
        params,
      );
      imported += chunk.length;
    }
  }
  return imported;
}

function classifyLegacyFile(fileName: string): LegacyFileClass {
  return LEGACY_FILE_CLASSIFICATION[fileName.toUpperCase()] ?? {
    status: 'RAW_VAULT_ONLY',
    projectionClass: 'historical',
    note: 'File legacy disimpan utuh di raw vault dan belum diproyeksikan ke tabel operasional.',
  };
}

async function syncLegacyAuditMetadata(client: PoolClient, S: string): Promise<void> {
  for (const [fileName, info] of Object.entries(LEGACY_FILE_CLASSIFICATION)) {
    await client.query(
      `UPDATE ${S}.legacy_import_file
          SET status = $2,
              metadata = metadata || $3::jsonb,
              updated_at = now(),
              version = version + 1
        WHERE upper(file_name) = $1`,
      [
        fileName,
        info.status,
        legacyJson({
          projectedTable: info.projectedTable ?? null,
          projectionClass: info.projectionClass,
          projectionNote: info.note,
        }),
      ],
    );

    await client.query(
      `UPDATE ${S}.legacy_import_record
          SET projection_status = $2,
              projected_table = $3,
              projection_note = $4
        WHERE upper(file_name) = $1
          AND is_deleted = FALSE`,
      [
        fileName,
        info.status === 'PROJECTED' ? 'PROJECTED' : 'RAW_ONLY',
        info.status === 'PROJECTED' ? info.projectedTable ?? null : null,
        info.note,
      ],
    );
  }
}

async function importSalespeople(client: PoolClient, S: string, rows: Array<Record<string, unknown>>): Promise<Map<string, string>> {
  const explicitUsers = new Map(
    [
      ['MASRUKIN', 'masrukin'],
      ['TOHIRIN', 'tohirin'],
      ['NOFAL', 'nofal'],
      ['AGUNG', 'agung'],
    ].map(([name, username]) => [name, username]),
  );
  const fallbackSales = await client.query<{ id: string; username: string; name: string }>(
    `SELECT us.id::text AS id, us.username_snapshot AS username, us.name
       FROM ${S}.user_subject us
       JOIN ${S}.user_role_assignment ura ON ura.user_subject_id = us.id
       JOIN ${S}.role r ON r.id = ura.role_id
      WHERE r.code = 'SALES' AND us.deleted_at IS NULL
      ORDER BY us.name`,
  );
  const map = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const legacyCode = text(row.KODESALES) || text(row.KODE) || `SALES-${i + 1}`;
    const legacyName = text(row.NAMASALES) || text(row.NAMA) || legacyCode;
    const username = explicitUsers.get(legacyName.toUpperCase()) ?? fallbackSales.rows[i % Math.max(fallbackSales.rows.length, 1)]?.username ?? null;
    const subjectId = username
      ? await scalar<string>(client, `SELECT id::text FROM ${S}.user_subject WHERE username_snapshot = $1 AND deleted_at IS NULL`, [username])
      : null;
    await client.query(
      `INSERT INTO ${S}.legacy_salesperson_map (legacy_code, legacy_name, user_subject_id, mapped_username, metadata)
       VALUES ($1, $2, $3::uuid, $4, $5::jsonb)
       ON CONFLICT (legacy_code) WHERE is_active
       DO UPDATE SET legacy_name = EXCLUDED.legacy_name, user_subject_id = EXCLUDED.user_subject_id,
         mapped_username = EXCLUDED.mapped_username, metadata = EXCLUDED.metadata,
         updated_at = now(), version = ${S}.legacy_salesperson_map.version + 1`,
      [legacyCode, legacyName, subjectId, username, legacyJson(row)],
    );
    await client.query(
      `INSERT INTO ${S}.inventory_salesperson_profile
         (user_subject_id, code, name, account_number, territory, phone, metadata, is_active)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, TRUE)
       ON CONFLICT (code) WHERE deleted_at IS NULL
       DO UPDATE SET user_subject_id = COALESCE(EXCLUDED.user_subject_id, ${S}.inventory_salesperson_profile.user_subject_id),
         name = EXCLUDED.name, account_number = COALESCE(EXCLUDED.account_number, ${S}.inventory_salesperson_profile.account_number),
         territory = COALESCE(EXCLUDED.territory, ${S}.inventory_salesperson_profile.territory),
         phone = COALESCE(EXCLUDED.phone, ${S}.inventory_salesperson_profile.phone),
         updated_at = now(), version = ${S}.inventory_salesperson_profile.version + 1`,
      [subjectId, legacyCode, legacyName, text(row.NOPERKIRAAN) || text(row.PERKIRAAN) || null,
        text(row.WILAYAH) || null, text(row.NOTELP) || text(row.TELEPON) || null, legacyJson(row)],
    );
    if (subjectId) map.set(legacyCode, subjectId);
  }
  for (const row of fallbackSales.rows) {
    map.set(row.username, row.id);
    map.set(row.name, row.id);
  }
  return map;
}

async function ensureUom(client: PoolClient, S: string, code: string, name: string) {
  return upsertNamed(client, S, 'uom', code, name);
}

async function ensureProductCategory(client: PoolClient, S: string) {
  return upsertNamed(client, S, 'product_category', 'OBAT', 'Obat dan Alat Kesehatan');
}

async function upsertNamed(client: PoolClient, S: string, table: string, code: string, name: string) {
  const found = await scalar<string>(client, `SELECT id::text FROM ${S}.${table} WHERE code = $1 AND deleted_at IS NULL`, [code]);
  if (found) return found;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${S}.${table} (code, name, is_system) VALUES ($1, $2, FALSE) RETURNING id::text AS id`,
    [code, name],
  );
  return inserted.rows[0].id;
}

async function upsertProduct(client: PoolClient, S: string, input: Record<string, unknown>) {
  const found = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [input.code]);
  if (found) {
    await client.query(
      `UPDATE ${S}.product SET name = $2, standard_cost = $3, default_sale_price = $4, metadata = $5::jsonb, updated_at = now(), version = version + 1
       WHERE id = $1::uuid`,
      [found, input.name, input.cost, input.price, legacyJson(input.metadata)],
    );
    return found;
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${S}.product
       (category_id, base_uom_id, code, sku, name, tracking_type, standard_cost, default_sale_price, metadata)
     VALUES ($1::uuid, $2::uuid, $3, $3, $4, 'LOT_EXPIRY', $5, $6, $7::jsonb)
     RETURNING id::text AS id`,
    [input.categoryId, input.uomId, input.code, input.name, input.cost, input.price, legacyJson(input.metadata)],
  );
  return inserted.rows[0].id;
}

async function upsertCustomer(client: PoolClient, S: string, code: string, name: string, metadata: unknown) {
  const row = metadata as Record<string, unknown>;
  await client.query(
    `INSERT INTO ${S}.customer
       (code, name, customer_type, credit_limit, legacy_payment_days, default_discount_percent,
        address_text, region_name, phone, bank_account_number, bank_account_name, bank_name, bank_address, metadata)
     VALUES ($1, $2, 'BUSINESS', 0, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
     ON CONFLICT (code) WHERE deleted_at IS NULL
     DO UPDATE SET name = EXCLUDED.name, legacy_payment_days = EXCLUDED.legacy_payment_days,
       default_discount_percent = EXCLUDED.default_discount_percent,
       address_text = EXCLUDED.address_text, region_name = EXCLUDED.region_name, phone = EXCLUDED.phone,
       bank_account_number = EXCLUDED.bank_account_number, bank_account_name = EXCLUDED.bank_account_name,
       bank_name = EXCLUDED.bank_name, bank_address = EXCLUDED.bank_address,
       metadata = EXCLUDED.metadata, updated_at = now(), version = ${S}.customer.version + 1`,
    [code, name, number(row.SYARATBAYAR ?? row.SYARAT ?? row.TEMPO), number(row.DISCOUNT ?? row.DISKON),
      text(row.ALAMAT) || null, text(row.WILAYAH) || null, text(row.NOTELP ?? row.TELEPON) || null,
      text(row.NOREK ?? row.NOREKENING) || null, text(row.ATASNAMA) || null,
      text(row.BANK) || null, text(row.ALAMATBANK) || null, legacyJson(metadata)],
  );
}

async function upsertSupplier(client: PoolClient, S: string, code: string, name: string, metadata: unknown) {
  const row = metadata as Record<string, unknown>;
  await client.query(
    `INSERT INTO ${S}.supplier
       (code, name, legacy_payment_days, address_text, region_name, phone,
        bank_account_number, bank_account_name, bank_name, bank_address, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     ON CONFLICT (code) WHERE deleted_at IS NULL
     DO UPDATE SET name = EXCLUDED.name, legacy_payment_days = EXCLUDED.legacy_payment_days,
       address_text = EXCLUDED.address_text, region_name = EXCLUDED.region_name, phone = EXCLUDED.phone,
       bank_account_number = EXCLUDED.bank_account_number, bank_account_name = EXCLUDED.bank_account_name,
       bank_name = EXCLUDED.bank_name, bank_address = EXCLUDED.bank_address,
       metadata = EXCLUDED.metadata, updated_at = now(), version = ${S}.supplier.version + 1`,
    [code, name, number(row.SYARATBAYAR ?? row.SYARAT ?? row.TEMPO), text(row.ALAMAT) || null,
      text(row.WILAYAH) || null, text(row.NOTELP ?? row.TELEPON) || null,
      text(row.NOREK ?? row.NOREKENING) || null, text(row.ATASNAMA) || null,
      text(row.BANK) || null, text(row.ALAMATBANK) || null, legacyJson(metadata)],
  );
}

async function upsertStock(client: PoolClient, S: string, warehouseId: string, productId: string, lotId: string | null, qty: number, cost: number) {
  await client.query(
    `INSERT INTO ${S}.stock_balance (warehouse_id, product_id, lot_id, on_hand_qty, available_qty, average_cost, last_movement_at)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $4, $5, now())
     ON CONFLICT (warehouse_id, product_id, COALESCE(lot_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(bin_id, '00000000-0000-0000-0000-000000000000'::uuid))
     DO UPDATE SET on_hand_qty = EXCLUDED.on_hand_qty, available_qty = EXCLUDED.available_qty, average_cost = EXCLUDED.average_cost,
                   updated_at = now(), version = ${S}.stock_balance.version + 1`,
    [warehouseId, productId, lotId, qty, cost],
  );
}

async function importLots(client: PoolClient, S: string, rows: Array<Record<string, unknown>>) {
  let count = 0;
  for (const row of rows) {
    const productCode = text(row.KODEBRG);
    const lot = text(row.NOBATCH);
    if (!productCode || !lot) continue;
    const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [productCode]);
    if (!productId) continue;
    await client.query(
      `INSERT INTO ${S}.inventory_lot (product_id, code, name, lot_number, expiry_date)
       VALUES ($1::uuid, $2, $2, $2, $3::date)
       ON CONFLICT (product_id, lot_number) WHERE deleted_at IS NULL
       DO UPDATE SET expiry_date = EXCLUDED.expiry_date, updated_at = now(), version = ${S}.inventory_lot.version + 1`,
      [productId, lot, dateOrNull(row.TGLEXP)],
    );
    count += 1;
  }
  return count;
}

async function importSales(
  client: PoolClient,
  S: string,
  rows: Array<Record<string, unknown>>,
  outletId: string,
  uomId: string,
  salesMap: Map<string, string>,
) {
  let count = 0;
  const fallbackSalesUserIds = Array.from(new Set(salesMap.values()));
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const invoice = text(row.NOFAKTUR);
    if (!invoice) continue;
    const key = `${dateOrNull(row.TANGGAL) ?? 'legacy'}:${invoice}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const [key, lines] of groups) {
    const first = lines[0];
    const orderNumber = `CMN-${key}`.slice(0, 48);
    const existing = await scalar<string>(client, `SELECT id::text FROM ${S}.sales_order WHERE order_number = $1`, [orderNumber]);
    const subtotal = lines.reduce((sum, row) => sum + number(row.JUMLAH) * number(row.HARGAJUAL), 0);
    const customerId = await scalar<string>(client, `SELECT id::text FROM ${S}.customer WHERE code = $1 AND deleted_at IS NULL`, [text(first.KODECUST)]);
    const salesUserId = salesMap.get(text(first.KODESALES)) ?? (fallbackSalesUserIds.length ? fallbackSalesUserIds[count % fallbackSalesUserIds.length] : null);
    const orderId = existing ?? (await client.query<{ id: string }>(
      `INSERT INTO ${S}.sales_order (customer_id, outlet_id, order_number, order_date, channel, subtotal, grand_total, status, created_by)
       VALUES ($1::uuid, $2::uuid, $3, COALESCE($4::date, CURRENT_DATE), 'FIELD_SALES', $5, $5, 'CONFIRMED', $6::uuid)
       RETURNING id::text AS id`,
      [customerId, outletId, orderNumber, dateOrNull(first.TANGGAL), subtotal, salesUserId],
    )).rows[0].id;
    let lineNo = 1;
    for (const row of lines) {
      const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [text(row.KODEBRG)]);
      if (!productId) continue;
      const qty = number(row.JUMLAH);
      const price = number(row.HARGAJUAL);
      const unitCost = number(row.HARGABELI);
      await client.query(
        `INSERT INTO ${S}.sales_order_line
           (sales_order_id, product_id, uom_id, line_no, ordered_qty, unit_price, line_total, legacy_unit_cost)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8)
         ON CONFLICT (sales_order_id, line_no) DO UPDATE
           SET product_id = EXCLUDED.product_id,
               ordered_qty = EXCLUDED.ordered_qty,
               unit_price = EXCLUDED.unit_price,
               line_total = EXCLUDED.line_total,
               legacy_unit_cost = EXCLUDED.legacy_unit_cost`,
        [orderId, productId, uomId, lineNo, qty, price, qty * price, unitCost],
      );
      lineNo += 1;
    }
    if (!existing) count += 1;
  }
  return count;
}

async function importPurchases(
  client: PoolClient,
  S: string,
  rows: Array<Record<string, unknown>>,
  warehouseId: string,
  uomId: string,
) {
  let count = 0;
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const invoice = text(row.NOFAKTUR);
    if (!invoice) continue;
    const key = `${dateOrNull(row.TANGGAL) ?? 'legacy'}:${text(row.KODESUPPL)}:${invoice}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  for (const [key, lines] of groups) {
    const first = lines[0];
    const purchaseOrderNumber = `CMN-PO-${key}`.slice(0, 48);
    const existing = await scalar<string>(client, `SELECT id::text FROM ${S}.purchase_order WHERE purchase_order_number = $1`, [
      purchaseOrderNumber,
    ]);
    if (existing) continue;

    const supplierId =
      (await scalar<string>(client, `SELECT id::text FROM ${S}.supplier WHERE code = $1 AND deleted_at IS NULL`, [text(first.KODESUPPL)]))
      ?? (await ensureUnknownSupplier(client, S));
    const subtotal = lines.reduce((sum, row) => sum + purchaseLineTotal(row), 0);
    const purchaseOrder = await client.query<{ id: string }>(
      `INSERT INTO ${S}.purchase_order
         (purchase_order_number, supplier_id, warehouse_id, order_date, expected_date, subtotal, grand_total, status, source_type, note)
       VALUES ($1, $2::uuid, $3::uuid, COALESCE($4::date, CURRENT_DATE), $4::date, $5, $5, 'CLOSED', 'CMN_LEGACY_DBF', 'Diimpor dari BELI.DBF')
       RETURNING id::text AS id`,
      [purchaseOrderNumber, supplierId, warehouseId, dateOrNull(first.TANGGAL), subtotal],
    );
    const poId = purchaseOrder.rows[0].id;
    const receipt = await client.query<{ id: string }>(
      `INSERT INTO ${S}.goods_receipt
         (receipt_number, purchase_order_id, supplier_id, warehouse_id, arrival_date, receipt_date, status, validation_status, validated_at, note)
       VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5::date, COALESCE($5::date, CURRENT_DATE), 'VALIDATED', 'VALIDATED', now(), 'Diimpor dari BELI.DBF')
       RETURNING id::text AS id`,
      [`CMN-GR-${key}`.slice(0, 48), poId, supplierId, warehouseId, dateOrNull(first.TANGGAL)],
    );
    const grId = receipt.rows[0].id;
    let lineNo = 1;
    for (const row of lines) {
      const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [text(row.KODEBRG)]);
      if (!productId) continue;
      const qty = number(row.JUMLAH);
      const unitCost = number(row.HARGABELI);
      const lineTotal = purchaseLineTotal(row);
      const poLine = await client.query<{ id: string }>(
        `INSERT INTO ${S}.purchase_order_line
           (purchase_order_id, product_id, uom_id, line_no, ordered_qty, received_qty, unit_price, discount_amount, line_total)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $5, $6, $7, $8)
         RETURNING id::text AS id`,
        [poId, productId, uomId, lineNo, qty, unitCost, legacyDiscountAmount(row), lineTotal],
      );
      const lotId = await ensureLot(client, S, productId, text(row.NOBATCH), dateOrNull(row.TGLEXP));
      await client.query(
        `INSERT INTO ${S}.goods_receipt_line
           (goods_receipt_id, purchase_order_line_id, product_id, uom_id, lot_id, line_no, ordered_qty, received_qty, accepted_qty,
            rejected_qty, unit_cost, batch_number, expiry_date, quality_status)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $7, $7, 0, $8, $9, $10::date, 'GOOD')`,
        [grId, poLine.rows[0].id, productId, uomId, lotId, lineNo, qty, unitCost, text(row.NOBATCH) || null, dateOrNull(row.TGLEXP)],
      );
      lineNo += 1;
    }
    await client.query(
      `INSERT INTO ${S}.supplier_invoice
         (supplier_id, purchase_order_id, invoice_number, invoice_date, due_date, subtotal, grand_total, paid_total, match_status, status)
       VALUES ($1::uuid, $2::uuid, $3, COALESCE($4::date, CURRENT_DATE), $4::date, $5, $5, 0, 'MATCHED', 'APPROVED')
       ON CONFLICT (supplier_id, invoice_number)
       DO UPDATE SET purchase_order_id = EXCLUDED.purchase_order_id, subtotal = EXCLUDED.subtotal,
         grand_total = EXCLUDED.grand_total, match_status = EXCLUDED.match_status,
         status = EXCLUDED.status, updated_at = now(), version = ${S}.supplier_invoice.version + 1`,
      [supplierId, poId, text(first.NOFAKTUR), dateOrNull(first.TANGGAL), subtotal],
    );
    count += 1;
  }
  return count;
}

async function importReceivableLedger(
  client: PoolClient,
  S: string,
  sourceFile: string,
  rows: LegacyRow[],
  salesMap: Map<string, string>,
) {
  let count = 0;
  for (const row of rows) {
    const data = row.data;
    const invoice = text(data.NOFAKTUR);
    if (!invoice) continue;
    const customerId = await scalar<string>(client, `SELECT id::text FROM ${S}.customer WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODECUST)]);
    const salespersonId = salesMap.get(text(data.KODESALES)) ?? null;
    await client.query(
      `INSERT INTO ${S}.legacy_receivable_ledger
         (source_file, legacy_row_number, legacy_invoice_number, customer_id, salesperson_id, transaction_date, due_date, paid_at,
          amount, payment_note, giro_number, bank_name, giro_date, return_number, source_deleted, is_settled, status, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::date, $7::date, $8::date, $9, $10, $11, $12, $13::date, $14,
               $15, $15, CASE WHEN $15 THEN 'SETTLED' ELSE 'OPEN' END, $16::jsonb)
       ON CONFLICT (source_file, legacy_row_number) DO UPDATE
         SET source_deleted = EXCLUDED.source_deleted,
             is_settled = EXCLUDED.is_settled,
             status = EXCLUDED.status,
             paid_at = EXCLUDED.paid_at,
             payment_note = EXCLUDED.payment_note,
             metadata = EXCLUDED.metadata`,
      [
        sourceFile,
        row.rowNumber,
        invoice,
        customerId,
        salespersonId,
        dateOrNull(data.TANGGAL),
        dateOrNull(data.JTHTEMPO),
        dateOrNull(data.TGLBAYAR),
        number(data.JUMLAH),
        text(data.KETBAYAR) || null,
        text(data.NOMERBG) || null,
        text(data.NAMABANK) || null,
        dateOrNull(data.TANGGALBG),
        text(data.NORETUR) || null,
        row.isDeleted,
        legacyJson(data),
      ],
    );
    count += 1;
  }
  return count;
}

async function importPayableLedger(client: PoolClient, S: string, rows: LegacyRow[]) {
  let count = 0;
  for (const row of rows) {
    const data = row.data;
    const invoice = text(data.NOFAKTUR);
    if (!invoice) continue;
    const supplierId = await scalar<string>(client, `SELECT id::text FROM ${S}.supplier WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODESUPPL)]);
    await client.query(
      `INSERT INTO ${S}.legacy_payable_ledger
         (source_file, legacy_row_number, legacy_invoice_number, supplier_id, transaction_date, due_date, paid_at,
          amount, payment_note, giro_number, bank_name, giro_date, source_deleted, is_settled, status, metadata)
       VALUES ('Tran_Hut.DBF', $1, $2, $3::uuid, $4::date, $5::date, $6::date, $7, $8, $9, $10, $11::date,
               $12, $12, CASE WHEN $12 THEN 'SETTLED' ELSE 'OPEN' END, $13::jsonb)
       ON CONFLICT (source_file, legacy_row_number) DO UPDATE
         SET source_deleted = EXCLUDED.source_deleted,
             is_settled = EXCLUDED.is_settled,
             status = EXCLUDED.status,
             paid_at = EXCLUDED.paid_at,
             payment_note = EXCLUDED.payment_note,
             metadata = EXCLUDED.metadata`,
      [
        row.rowNumber,
        invoice,
        supplierId,
        dateOrNull(data.TANGGAL),
        dateOrNull(data.JTHTEMPO),
        dateOrNull(data.TGLBAYAR),
        number(data.JUMLAH),
        text(data.KETBAYAR) || null,
        text(data.NOMERBG) || null,
        text(data.NAMABANK) || null,
        dateOrNull(data.TANGGALBG),
        row.isDeleted,
        legacyJson(data),
      ],
    );
    count += 1;
  }
  return count;
}

async function importPriceHistory(
  client: PoolClient,
  S: string,
  sourceFile: string,
  partyType: 'CUSTOMER' | 'SUPPLIER',
  rows: LegacyRow[],
) {
  let count = 0;
  for (const row of rows) {
    const data = row.data;
    const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODEBRG)]);
    const customerId = partyType === 'CUSTOMER'
      ? await scalar<string>(client, `SELECT id::text FROM ${S}.customer WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODECUST)])
      : null;
    const supplierId = partyType === 'SUPPLIER'
      ? await scalar<string>(client, `SELECT id::text FROM ${S}.supplier WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODESUPPL)])
      : null;
    await client.query(
      `INSERT INTO ${S}.legacy_price_history
         (source_file, legacy_row_number, party_type, customer_id, supplier_id, product_id, effective_date, price, metadata)
       VALUES ($1, $2, $3, $4::uuid, $5::uuid, $6::uuid, $7::date, $8, $9::jsonb)
       ON CONFLICT (source_file, legacy_row_number) DO NOTHING`,
      [
        sourceFile,
        row.rowNumber,
        partyType,
        customerId,
        supplierId,
        productId,
        dateOrNull(data.TANGGAL),
        partyType === 'CUSTOMER' ? number(data.HARGAJUAL) : number(data.HARGABELI),
        legacyJson(data),
      ],
    );
    count += 1;
  }
  return count;
}

async function importStockOpname(client: PoolClient, S: string, rows: LegacyRow[]) {
  let count = 0;
  for (const row of rows) {
    const data = row.data;
    const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [text(data.KODEBRG)]);
    const systemQty = number(data.STOKKOMP);
    const physicalQty = number(data.STOKFISIK);
    await client.query(
      `INSERT INTO ${S}.legacy_stock_opname
         (source_file, legacy_row_number, product_id, opname_date, system_qty, physical_qty, unit_cost, variance_qty, metadata)
       VALUES ('dataopn.dbf', $1, $2::uuid, $3::date, $4, $5, $6, $7, $8::jsonb)
       ON CONFLICT (source_file, legacy_row_number) DO NOTHING`,
      [row.rowNumber, productId, dateOrNull(data.TANGGAL), systemQty, physicalQty, number(data.HARGABELI), physicalQty - systemQty, legacyJson(data)],
    );
    count += 1;
  }
  return count;
}

async function importAccounts(client: PoolClient, S: string, rows: Array<Record<string, unknown>>) {
  let count = 0;
  const typeId = await ensureAccountType(client, S);
  for (const row of rows) {
    const code = text(row.KODEPERK);
    const name = text(row.KETERANGAN) || code;
    if (!code || !name) continue;
    await client.query(
      `INSERT INTO ${S}.chart_of_account (account_type_id, code, name, normal_balance, metadata)
       VALUES ($1::uuid, $2, $3, 'DEBIT', $4::jsonb)
       ON CONFLICT (code) WHERE deleted_at IS NULL
       DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, updated_at = now(), version = ${S}.chart_of_account.version + 1`,
      [typeId, code, name, legacyJson(row)],
    );
    count += 1;
  }
  return count;
}

async function importJournalRows(client: PoolClient, S: string, rows: Array<Record<string, unknown>>) {
  // JOURNAL.DBF pada dump CMN saat ini kosong; bila kelak terisi, raw vault sudah
  // menyimpan seluruh barisnya dan marker ini membuat laporan impor tetap jujur.
  return rows.length;
}

async function markProjectedFiles(client: PoolClient, S: string): Promise<void> {
  const projections = Object.entries(LEGACY_FILE_CLASSIFICATION)
    .filter(([, info]) => info.status === 'PROJECTED' && info.projectedTable);
  for (const [fileName, info] of projections) {
    await client.query(
        `UPDATE ${S}.legacy_import_record
          SET projection_status = 'PROJECTED',
              projected_table = $2,
              projection_note = 'Projected during CMN legacy import V2.'
        WHERE upper(file_name) = $1 AND is_deleted = FALSE`,
      [fileName, info.projectedTable],
    );
  }
}

async function scalar<T = string>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await client.query(sql, params);
  return (result.rows[0] ? Object.values(result.rows[0])[0] : null) as T | null;
}

function legacyJson(value: unknown): string {
  return JSON.stringify(sanitizeLegacyJson(value));
}

function sanitizeLegacyJson(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return cleanLegacyString(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map((item) => sanitizeLegacyJson(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        cleanLegacyString(key),
        sanitizeLegacyJson(item),
      ]),
    );
  }
  return String(value);
}

function cleanLegacyString(value: string): string {
  return value.replaceAll(String.fromCharCode(0), '').replace(/[\uD800-\uDFFF]/g, '').trim();
}

function text(value: unknown): string {
  return cleanLegacyString(String(value ?? ''));
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function purchaseLineTotal(row: Record<string, unknown>): number {
  const gross = number(row.JUMLAH) * number(row.HARGABELI);
  return Math.max(0, gross - legacyDiscountAmount(row));
}

function legacyDiscountAmount(row: Record<string, unknown>): number {
  const gross = number(row.JUMLAH) * number(row.HARGABELI);
  const d1 = number(row.DISCOUNT);
  const d2 = number(row.DISCOUNT2);
  const afterD1 = d1 > 0 && d1 <= 100 ? gross * (1 - d1 / 100) : gross - d1;
  const afterD2 = d2 > 0 && d2 <= 100 ? afterD1 * (1 - d2 / 100) : afterD1 - d2;
  return Math.max(0, gross - Math.max(0, afterD2));
}

async function ensureLot(client: PoolClient, S: string, productId: string, lotNumber: string, expiryDate: string | null): Promise<string | null> {
  if (!lotNumber) return null;
  const existing = await scalar<string>(
    client,
    `SELECT id::text FROM ${S}.inventory_lot WHERE product_id = $1::uuid AND lot_number = $2 AND deleted_at IS NULL`,
    [productId, lotNumber],
  );
  if (existing) return existing;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${S}.inventory_lot (product_id, code, name, lot_number, expiry_date)
     VALUES ($1::uuid, $2, $2, $2, $3::date)
     ON CONFLICT (product_id, lot_number) WHERE deleted_at IS NULL
     DO UPDATE SET expiry_date = EXCLUDED.expiry_date, updated_at = now(), version = ${S}.inventory_lot.version + 1
     RETURNING id::text AS id`,
    [productId, lotNumber, expiryDate],
  );
  return inserted.rows[0].id;
}

async function ensureUnknownSupplier(client: PoolClient, S: string): Promise<string> {
  await upsertSupplier(client, S, 'UNKNOWN', 'Supplier Tidak Teridentifikasi', { source: 'CMN_LEGACY_IMPORT', reason: 'Legacy row has no matching supplier code.' });
  const id = await scalar<string>(client, `SELECT id::text FROM ${S}.supplier WHERE code = 'UNKNOWN' AND deleted_at IS NULL`);
  if (!id) throw new Error('Supplier UNKNOWN gagal dibuat.');
  return id;
}

async function ensureAccountType(client: PoolClient, S: string): Promise<string> {
  const existing = await scalar<string>(client, `SELECT id::text FROM ${S}.account_type WHERE code = 'LEGACY' AND deleted_at IS NULL`);
  if (existing) return existing;
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${S}.account_type (code, name, normal_balance, category, is_system)
     VALUES ('LEGACY', 'Legacy Account', 'DEBIT', 'ASSET', FALSE)
     RETURNING id::text AS id`,
  );
  return inserted.rows[0].id;
}

function legacyKey(fileName: string, row: Record<string, unknown>): string {
  const file = fileName.toUpperCase();
  if (file.includes('JUAL') || file.includes('BELI') || file.includes('TRAN_')) return [text(row.TANGGAL), text(row.NOFAKTUR), text(row.KODEBRG), text(row.KODECUST), text(row.KODESUPPL)].filter(Boolean).join(':');
  if (file.includes('STOK') || file.includes('BATCH')) return [text(row.KODEBRG), text(row.NOBATCH)].filter(Boolean).join(':');
  if (file.includes('CUSTOMER')) return text(row.KODECUST);
  if (file.includes('SUPPLIER')) return text(row.KODESUPPL);
  if (file.includes('SALES')) return text(row.KODESALES);
  return createHash('sha1').update(legacyJson(row)).digest('hex');
}

function chunks<T>(rows: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += size) result.push(rows.slice(i, i + size));
  return result;
}

function dateOrNull(value: unknown): string | null {
  const raw = text(value);
  if (!raw || raw === '0') return null;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  return null;
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
