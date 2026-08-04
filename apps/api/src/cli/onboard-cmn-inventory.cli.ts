import 'dotenv/config';
import * as argon2 from 'argon2';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { PoolClient } from 'pg';
import { createSeedContext } from './seed-runner';

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

async function main(): Promise<void> {
  const ctx = await createSeedContext();
  try {
    const owner = await ensurePlatformUser(ctx, USERS[0]);
    let tenant = await ctx.prisma.tenant.findUnique({ where: { code: TENANT.code } });
    if (!tenant) {
      tenant = await ctx.prisma.tenant.create({
        data: {
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
    } else if (tenant.verticalCode !== TENANT.verticalCode || tenant.name !== TENANT.name) {
      tenant = await ctx.prisma.tenant.update({
        where: { id: tenant.id },
        data: { name: TENANT.name, slug: TENANT.slug, verticalCode: TENANT.verticalCode },
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
    process.stdout.write(
      `CMN siap: tenant=${TENANT.code}, schema=${TENANT.schema}, host=${TENANT.host}, ` +
        `produk=${imported.products}, pelanggan=${imported.customers}, pemasok=${imported.suppliers}, penjualan=${imported.salesOrders}.\n`,
    );
  } finally {
    await ctx.app.close();
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
): Promise<{ products: number; customers: number; suppliers: number; salesOrders: number }> {
  const marker = await ctx.tenantDb
    .query<{ value: unknown }>(
      schemaName,
      `SELECT value_json AS value FROM "${schemaName}".app_setting WHERE code = 'CMN_LEGACY_IMPORT_V1' AND deleted_at IS NULL`,
    )
    .then((r) => r[0]?.value ?? null);
  if (marker) return { products: 0, customers: 0, suppliers: 0, salesOrders: 0 };

  const dir = LEGACY_DIR_CANDIDATES.find((candidate) => existsSync(join(candidate, 'STOK.DBF')));
  if (!dir) {
    process.stdout.write(
      `DBF CMN belum ditemukan. Set CMN_LEGACY_DBF_DIR atau salin ke /opt/ebisnis/imports/cmn-inventory; impor akan dicoba lagi pada deploy berikutnya.\n`,
    );
    return { products: 0, customers: 0, suppliers: 0, salesOrders: 0 };
  }

  const stok = readDbf(join(dir, 'STOK.DBF'));
  const customers = readDbf(join(dir, 'CUSTOMER.DBF'));
  const suppliers = readDbf(join(dir, 'SUPPLIER.DBF'));
  const sales = readDbf(join(dir, 'JUAL.DBF'));
  const batch = existsSync(join(dir, 'batchno.dbf')) ? readDbf(join(dir, 'batchno.dbf')) : [];

  const result = await ctx.tenantDb.transaction(schemaName, async (client) => {
    const S = `"${schemaName}"`;
    const uomId = await ensureUom(client, S, 'PCS', 'Pcs');
    const categoryId = await ensureProductCategory(client, S);
    const warehouseId = await scalar<string>(client, `SELECT id::text FROM ${S}.warehouse WHERE code = 'MAIN-WH' AND deleted_at IS NULL LIMIT 1`)
      ?? await scalar<string>(client, `SELECT id::text FROM ${S}.warehouse WHERE deleted_at IS NULL LIMIT 1`);
    const outletId = await scalar<string>(client, `SELECT id::text FROM ${S}.outlet WHERE deleted_at IS NULL LIMIT 1`);

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
        await upsertStock(client, S, warehouseId, productId, null, number(row.AWAL) + number(row.MASUK) - number(row.KELUAR), number(row.HARGABELI));
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
      const code = text(row.KODESUPP) || text(row.KODE) || `SUP-${supplierCount + 1}`;
      const name = text(row.NAMASUPP) || text(row.NAMA) || code;
      await upsertSupplier(client, S, code, name, row);
      supplierCount += 1;
    }

    const lotCount = await importLots(client, S, batch);
    const salesUsers = await client.query<{ id: string }>(
      `SELECT us.id::text AS id
         FROM ${S}.user_subject us
         JOIN ${S}.user_role_assignment ura ON ura.user_subject_id = us.id
         JOIN ${S}.role r ON r.id = ura.role_id
        WHERE r.code = 'SALES' AND us.deleted_at IS NULL
        ORDER BY us.name`,
    );
    const salesOrders = outletId
      ? await importSales(client, S, sales, outletId, uomId, salesUsers.rows.map((row) => row.id))
      : 0;

    return { productCount, customerCount, supplierCount, lotCount, salesOrders };
  });

  await markImport(ctx, schemaName, { importedAt: new Date().toISOString(), dir, ...result });
  return {
    products: result.productCount,
    customers: result.customerCount,
    suppliers: result.supplierCount,
    salesOrders: result.salesOrders,
  };
}

async function markImport(ctx: Awaited<ReturnType<typeof createSeedContext>>, schemaName: string, value: unknown) {
  await ctx.tenantDb.query(
    schemaName,
    `INSERT INTO "${schemaName}".app_setting (code, name, value_type, value_json, is_system)
     VALUES ('CMN_LEGACY_IMPORT_V1', 'Import legacy CMN Inventory', 'JSON', $1::jsonb, TRUE)
     ON CONFLICT (scope_type, COALESCE(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), code)
     WHERE deleted_at IS NULL
     DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = now(), version = "${schemaName}".app_setting.version + 1`,
    [JSON.stringify(value)],
  );
}

function readDbf(path: string): Array<Record<string, unknown>> {
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

  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < recordCount; i += 1) {
    const base = headerLength + i * recordLength;
    if (buf[base] === 0x2a) continue;
    const row: Record<string, unknown> = {};
    for (const field of fields) {
      const raw = buf.subarray(base + field.offset, base + field.offset + field.length).toString('latin1').trim();
      row[field.name] = field.type === 'N' || field.type === 'F' ? Number(raw || 0) : raw;
    }
    rows.push(row);
  }
  return rows;
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
      [found, input.name, input.cost, input.price, JSON.stringify(input.metadata)],
    );
    return found;
  }
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO ${S}.product
       (category_id, base_uom_id, code, sku, name, tracking_type, standard_cost, default_sale_price, metadata)
     VALUES ($1::uuid, $2::uuid, $3, $3, $4, 'LOT_EXPIRY', $5, $6, $7::jsonb)
     RETURNING id::text AS id`,
    [input.categoryId, input.uomId, input.code, input.name, input.cost, input.price, JSON.stringify(input.metadata)],
  );
  return inserted.rows[0].id;
}

async function upsertCustomer(client: PoolClient, S: string, code: string, name: string, metadata: unknown) {
  await client.query(
    `INSERT INTO ${S}.customer (code, name, customer_type, credit_limit, metadata)
     VALUES ($1, $2, 'BUSINESS', 0, $3::jsonb)
     ON CONFLICT (code) WHERE deleted_at IS NULL
     DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, updated_at = now(), version = ${S}.customer.version + 1`,
    [code, name, JSON.stringify(metadata)],
  );
}

async function upsertSupplier(client: PoolClient, S: string, code: string, name: string, metadata: unknown) {
  await client.query(
    `INSERT INTO ${S}.supplier (code, name, metadata)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (code) WHERE deleted_at IS NULL
     DO UPDATE SET name = EXCLUDED.name, metadata = EXCLUDED.metadata, updated_at = now(), version = ${S}.supplier.version + 1`,
    [code, name, JSON.stringify(metadata)],
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
  salesUserIds: string[],
) {
  let count = 0;
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
    if (existing) continue;
    const subtotal = lines.reduce((sum, row) => sum + number(row.JUMLAH) * number(row.HARGAJUAL), 0);
    const customerId = await scalar<string>(client, `SELECT id::text FROM ${S}.customer WHERE code = $1 AND deleted_at IS NULL`, [text(first.KODECUST)]);
    const salesUserId = salesUserIds.length ? salesUserIds[count % salesUserIds.length] : null;
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ${S}.sales_order (customer_id, outlet_id, order_number, order_date, channel, subtotal, grand_total, status, created_by)
       VALUES ($1::uuid, $2::uuid, $3, COALESCE($4::date, CURRENT_DATE), 'FIELD_SALES', $5, $5, 'CONFIRMED', $6::uuid)
       RETURNING id::text AS id`,
      [customerId, outletId, orderNumber, dateOrNull(first.TANGGAL), subtotal, salesUserId],
    );
    let lineNo = 1;
    for (const row of lines) {
      const productId = await scalar<string>(client, `SELECT id::text FROM ${S}.product WHERE code = $1 AND deleted_at IS NULL`, [text(row.KODEBRG)]);
      if (!productId) continue;
      const qty = number(row.JUMLAH);
      const price = number(row.HARGAJUAL);
      await client.query(
        `INSERT INTO ${S}.sales_order_line (sales_order_id, product_id, uom_id, line_no, ordered_qty, unit_price, line_total)
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7)
         ON CONFLICT (sales_order_id, line_no) DO NOTHING`,
        [inserted.rows[0].id, productId, uomId, lineNo, qty, price, qty * price],
      );
      lineNo += 1;
    }
    count += 1;
  }
  return count;
}

async function scalar<T = string>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T | null> {
  const result = await client.query(sql, params);
  return (result.rows[0] ? Object.values(result.rows[0])[0] : null) as T | null;
}

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function number(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
