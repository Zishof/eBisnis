/**
 * pnpm docs:generate [--schema <tenant>] [--out <dir>]
 *
 * Menghasilkan dokumentasi database dari kondisi NYATA di PostgreSQL, bukan dari
 * catatan manual. Introspeksi memakai `information_schema` dan `pg_catalog`
 * sehingga dokumen selalu sinkron dengan migration yang sudah diterapkan.
 *
 * Keluaran pada `docs/database/`:
 *   - full-data-dictionary.md          kamus data seluruh kolom
 *   - entity-relationship-overview.md  ERD mermaid per domain
 *   - index-catalog.md                 katalog index, unique, dan primary key
 *   - model-catalog.md                 daftar model Prisma dan pemetaan tabel
 *   - master-seed-catalog.md           MasterSeedRegistry beserta minimum record
 *   - master-seed-exceptions.md        master yang dikecualikan dari aturan 10 record
 *   - table-lifecycle-policy.md        kolom lifecycle per tabel
 *   - hard-delete-reference-matrix.md  matriks referensi sebelum purge
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { createSeedContext } from './seed-runner';
import { parseArgs } from './cli-utils';
import { validateSchemaName } from '../infrastructure/database/schema-name.util';
import { MASTER_RESOURCES } from '../modules/tenant/master-resource.registry';
import { TENANT_MASTER_SEEDS, TENANT_SEED_EXCEPTIONS } from '../modules/master-seed/registry/tenant-master-seeds';
import type { MasterSeedVerifyReport } from '../modules/master-seed/master-seed.types';

interface ColumnRow {
  table_schema: string;
  table_name: string;
  column_name: string;
  ordinal_position: number;
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  is_nullable: string;
  column_default: string | null;
  comment: string | null;
}

interface ConstraintRow {
  table_schema: string;
  table_name: string;
  constraint_name: string;
  constraint_type: string;
  columns: string;
  foreign_schema: string | null;
  foreign_table: string | null;
  foreign_columns: string | null;
  delete_rule: string | null;
}

interface IndexRow {
  schema_name: string;
  table_name: string;
  index_name: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string;
  index_definition: string;
  index_size: string;
}

interface TableRow {
  table_schema: string;
  table_name: string;
  comment: string | null;
  approximate_rows: number;
}

interface TriggerRow {
  schema_name: string;
  table_name: string;
  trigger_name: string;
  action_timing: string;
  event_manipulation: string;
}

const LIFECYCLE_COLUMNS = [
  'is_active',
  'is_system',
  'is_sample',
  'sample_batch_id',
  'deactivated_at',
  'deleted_at',
  'delete_reason',
  'version',
];

/** Tabel bookkeeping tool yang tidak termasuk model domain. */
const EXCLUDED_TABLES = new Set(['_prisma_migrations']);

/**
 * Pengelompokan domain untuk ERD agar diagram tetap terbaca. Pola diurutkan:
 * pencocokan pertama menang, sehingga pola yang lebih spesifik ditulis lebih awal.
 */
const PLATFORM_DOMAINS: Array<{ title: string; match: RegExp }> = [
  {
    title: 'Identitas dan Akses Platform',
    match: /^(platform_user|platform_role|platform_permission|platform_session|platform_refresh_token|platform_login_attempt|platform_step_up|platform_admin_saved_view|global_permission_action|global_role_template|global_menu_template)/,
  },
  {
    title: 'Tenancy dan Provisioning',
    match: /^(tenant$|tenant_membership|tenant_schema|tenant_translation_override|registration|provisioning_|schema_name_reservation|schema_migration_catalog|demo_|platform_support_session|platform_tenant_action|onboarding)/,
  },
  {
    title: 'Katalog Produk dan Paket',
    match: /^(subscription_product|subscription_plan|subscription_add_on|module_catalog|feature_catalog|package_assignment|tenant_plan_|tenant_price_override|pricing_display_section)/,
  },
  { title: 'Diskon dan Promo', match: /^(discount_|promo_)/ },
  {
    title: 'Billing dan Langganan',
    match: /^(pricing_quote|pricing_adjustment|pos_device|device_|subscription$|subscription_item|subscription_change|billing_|entitlement_snapshot)/,
  },
  {
    title: 'Pembayaran',
    match: /^(payment_|provider_rate_limit_state|host_to_host_log|idempotency_record)/,
  },
  {
    title: 'CMS dan Website',
    match: /^(cms_|news_|announcement|faq_|media_|website|hero_slide|marketing_feature|call_to_action|contact_message|contact_office|newsletter_|testimonial|partner_logo|redirect_rule|seo_structured_data)/,
  },
  { title: 'Internasionalisasi', match: /^(locale|translation_)/ },
  { title: 'Pengaturan Platform', match: /^(platform_setting)/ },
];

const TENANT_DOMAINS: Array<{ title: string; match: RegExp }> = [
  {
    title: 'Organisasi dan Struktur',
    match: /^(legal_entity|business_group|brand$|product_brand|outlet|warehouse|region|department|job_position|address|party|owner_profile|investor_profile|ownership_interest|app_setting|onboarding_progress)/,
  },
  {
    title: 'Akses dan Menu',
    match: /^(user_subject|user_role_assignment|user_direct_permission|role|menu|permission_action|step_up_challenge|saved_view)/,
  },
  {
    title: 'Katalog Produk',
    match: /^(product|uom|tax_category|tax_rate|price_book|carrier)/,
  },
  { title: 'Mitra Bisnis', match: /^(supplier|customer)/ },
  {
    title: 'Inventori',
    match: /^(stock_|inventory_|bill_of_material)/,
  },
  {
    title: 'Pembelian dan Penerimaan',
    match: /^(request_order|purchase_order|purchase_backorder|backorder_|goods_receipt|supplier_invoice)/,
  },
  { title: 'Transfer Internal', match: /^(internal_transfer)/ },
  {
    title: 'Penjualan dan POS',
    match: /^(sales_order|pos_|payment_method|payment_term|cash_drawer_movement)/,
  },
  {
    title: 'Keuangan',
    match: /^(chart_of_account|account_type|journal_|fiscal_period)/,
  },
  { title: 'SDM', match: /^(employee|leave_type|vehicle_type)/ },
  {
    title: 'Workflow, Integrasi, dan Operasional',
    match: /^(workflow_|notification|number_sequence|schema_migration|starter_data_marker|sync_|job_execution|data_export_log|entity_attachment|file_object|idempotency_record)/,
  },
];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const ctx = await createSeedContext();

  try {
    const requestedSchema = args.options.schema ?? ctx.config.get<string>('schema.demo', 'demo');
    // Nama schema tetap divalidasi walaupun berasal dari argumen CLI.
    const validation = validateSchemaName(requestedSchema, { allowReserved: [requestedSchema] });
    if (!validation.valid) {
      throw new Error(`Nama schema "${requestedSchema}" tidak valid: ${validation.message}`);
    }
    const validated = validation.normalized;
    const tenantAuditSchema = validation.auditName;

    const platformSchemas = ['platform', 'platform__audit'];
    const tenantExists = await ctx.tenantDb.schemaExists(validated);
    const schemas = tenantExists
      ? [...platformSchemas, validated, tenantAuditSchema]
      : platformSchemas;

    if (!tenantExists) {
      process.stderr.write(
        `PERINGATAN: schema tenant "${validated}" belum ada. Kamus data hanya mencakup control plane.\n` +
          'Jalankan `pnpm db:seed` terlebih dahulu untuk memprovision sandbox demo.\n',
      );
    }

    process.stdout.write(`Introspeksi schema: ${schemas.join(', ')}\n`);

    const [tables, columns, constraints, indexes, triggers] = await Promise.all([
      fetchTables(ctx, schemas),
      fetchColumns(ctx, schemas),
      fetchConstraints(ctx, schemas),
      fetchIndexes(ctx, schemas),
      fetchTriggers(ctx, schemas),
    ]);

    const outDir = resolve(args.options.out ?? join(process.cwd(), '..', '..', 'docs', 'database'));
    await mkdir(outDir, { recursive: true });

    // Laporan platform diambil dari service verifikasi karena minimum record
    // control plane didefinisikan di sana, bukan pada registry statis.
    const platformReport = await ctx.platformSeed.verify();

    const generatedAt = new Date().toISOString();
    const context: DocContext = {
      generatedAt,
      tenantSchema: tenantExists ? validated : null,
      tenantAuditSchema: tenantExists ? tenantAuditSchema : null,
      tables,
      columns,
      constraints,
      indexes,
      triggers,
      platformReport,
    };

    const files: Array<[string, string]> = [
      ['full-data-dictionary.md', renderDataDictionary(context)],
      ['entity-relationship-overview.md', renderErd(context)],
      ['index-catalog.md', renderIndexCatalog(context)],
      ['model-catalog.md', renderModelCatalog(context)],
      ['master-seed-catalog.md', renderSeedCatalog(context)],
      ['master-seed-exceptions.md', renderSeedExceptions(context)],
      ['table-lifecycle-policy.md', renderLifecyclePolicy(context)],
      ['hard-delete-reference-matrix.md', renderReferenceMatrix(context)],
    ];

    for (const [name, content] of files) {
      const target = join(outDir, name);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, 'utf8');
      process.stdout.write(`  tulis ${name} (${content.split('\n').length} baris)\n`);
    }

    process.stdout.write(
      `\nSelesai. ${tables.length} tabel, ${columns.length} kolom, ${indexes.length} index, ` +
        `${constraints.filter((c) => c.constraint_type === 'FOREIGN KEY').length} foreign key.\n` +
        `Keluaran: ${outDir}\n`,
    );
  } finally {
    await ctx.app.close();
  }
}

type Ctx = Awaited<ReturnType<typeof createSeedContext>>;

interface DocContext {
  generatedAt: string;
  tenantSchema: string | null;
  tenantAuditSchema: string | null;
  tables: TableRow[];
  columns: ColumnRow[];
  constraints: ConstraintRow[];
  indexes: IndexRow[];
  triggers: TriggerRow[];
  platformReport: MasterSeedVerifyReport;
}

// --- Introspeksi -------------------------------------------------------------

async function fetchTables(ctx: Ctx, schemas: string[]): Promise<TableRow[]> {
  const rows = await ctx.tenantDb.queryAdmin<TableRow>(
    `SELECT c.relnamespace::regnamespace::text AS table_schema,
            c.relname                          AS table_name,
            obj_description(c.oid, 'pg_class')  AS comment,
            GREATEST(c.reltuples, 0)::bigint    AS approximate_rows
       FROM pg_class c
      WHERE c.relkind = 'r'
        AND c.relnamespace::regnamespace::text = ANY($1::text[])
      ORDER BY 1, 2`,
    [schemas],
  );
  return rows.filter((row) => !EXCLUDED_TABLES.has(row.table_name));
}

async function fetchColumns(ctx: Ctx, schemas: string[]): Promise<ColumnRow[]> {
  const rows = await ctx.tenantDb.queryAdmin<ColumnRow>(
    `SELECT c.table_schema,
            c.table_name,
            c.column_name,
            c.ordinal_position,
            c.data_type,
            c.udt_name,
            c.character_maximum_length,
            c.numeric_precision,
            c.numeric_scale,
            c.is_nullable,
            c.column_default,
            col_description(
              format('%I.%I', c.table_schema, c.table_name)::regclass,
              c.ordinal_position
            ) AS comment
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema
        AND t.table_name = c.table_name
        AND t.table_type = 'BASE TABLE'
      WHERE c.table_schema = ANY($1::text[])
      ORDER BY c.table_schema, c.table_name, c.ordinal_position`,
    [schemas],
  );
  return rows.filter((row) => !EXCLUDED_TABLES.has(row.table_name));
}

async function fetchConstraints(ctx: Ctx, schemas: string[]): Promise<ConstraintRow[]> {
  const rows = await ctx.tenantDb.queryAdmin<ConstraintRow>(
    `SELECT n.nspname                                   AS table_schema,
            t.relname                                   AS table_name,
            con.conname                                 AS constraint_name,
            CASE con.contype
              WHEN 'p' THEN 'PRIMARY KEY'
              WHEN 'u' THEN 'UNIQUE'
              WHEN 'f' THEN 'FOREIGN KEY'
              WHEN 'c' THEN 'CHECK'
              ELSE con.contype::text
            END                                         AS constraint_type,
            COALESCE((
              SELECT string_agg(a.attname, ', ' ORDER BY k.ord)
                FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
            ), '') AS columns,
            fn.nspname                                  AS foreign_schema,
            ft.relname                                  AS foreign_table,
            (
              SELECT string_agg(fa.attname, ', ' ORDER BY fk.ord)
                FROM unnest(con.confkey) WITH ORDINALITY AS fk(attnum, ord)
                JOIN pg_attribute fa ON fa.attrelid = ft.oid AND fa.attnum = fk.attnum
            )                                           AS foreign_columns,
            CASE con.confdeltype
              WHEN 'a' THEN 'NO ACTION'
              WHEN 'r' THEN 'RESTRICT'
              WHEN 'c' THEN 'CASCADE'
              WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT'
              ELSE NULL
            END                                         AS delete_rule
       FROM pg_constraint con
       JOIN pg_class t ON t.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
       LEFT JOIN pg_class ft ON ft.oid = con.confrelid
       LEFT JOIN pg_namespace fn ON fn.oid = ft.relnamespace
      WHERE n.nspname = ANY($1::text[])
      ORDER BY 1, 2, 3`,
    [schemas],
  );
  return rows.filter((row) => !EXCLUDED_TABLES.has(row.table_name));
}

async function fetchIndexes(ctx: Ctx, schemas: string[]): Promise<IndexRow[]> {
  const rows = await ctx.tenantDb.queryAdmin<IndexRow>(
    `SELECT n.nspname                                    AS schema_name,
            t.relname                                    AS table_name,
            i.relname                                    AS index_name,
            ix.indisunique                               AS is_unique,
            ix.indisprimary                              AS is_primary,
            COALESCE((
              SELECT string_agg(pg_get_indexdef(ix.indexrelid, k.ord::int, true), ', ' ORDER BY k.ord)
                FROM generate_series(1, ix.indnatts) WITH ORDINALITY AS k(col, ord)
            ), '')                                       AS columns,
            pg_get_indexdef(ix.indexrelid)               AS index_definition,
            pg_size_pretty(pg_relation_size(ix.indexrelid)) AS index_size
       FROM pg_index ix
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_class t ON t.oid = ix.indrelid
       JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = ANY($1::text[])
      ORDER BY 1, 2, 3`,
    [schemas],
  );
  return rows.filter((row) => !EXCLUDED_TABLES.has(row.table_name));
}

function fetchTriggers(ctx: Ctx, schemas: string[]): Promise<TriggerRow[]> {
  return ctx.tenantDb.queryAdmin<TriggerRow>(
    `SELECT event_object_schema AS schema_name,
            event_object_table  AS table_name,
            trigger_name,
            action_timing,
            string_agg(event_manipulation, '/' ORDER BY event_manipulation) AS event_manipulation
       FROM information_schema.triggers
      WHERE event_object_schema = ANY($1::text[])
      GROUP BY 1, 2, 3, 4
      ORDER BY 1, 2, 3`,
    [schemas],
  );
}

// --- Utilitas render ---------------------------------------------------------

function header(title: string, ctx: DocContext, intro: string): string {
  return [
    `# ${title}`,
    '',
    '> Berkas ini dihasilkan otomatis oleh `pnpm docs:generate` dari hasil introspeksi',
    '> PostgreSQL. Jangan diedit manual — perubahan akan hilang pada generate berikutnya.',
    '',
    `- Dihasilkan: \`${ctx.generatedAt}\``,
    `- Schema control plane: \`platform\`, \`platform__audit\``,
    ctx.tenantSchema
      ? `- Schema tenant contoh: \`${ctx.tenantSchema}\`, \`${ctx.tenantAuditSchema}\``
      : '- Schema tenant: belum diprovision saat generate dijalankan',
    '',
    intro,
    '',
  ].join('\n');
}

function typeLabel(column: ColumnRow): string {
  const base = column.udt_name.replace(/^_/, '') + (column.udt_name.startsWith('_') ? '[]' : '');
  if (column.character_maximum_length) return `${base}(${column.character_maximum_length})`;
  if (base === 'numeric' && column.numeric_precision) {
    return `numeric(${column.numeric_precision},${column.numeric_scale ?? 0})`;
  }
  return base;
}

function escapePipes(value: string | null): string {
  return (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const group = key(item);
    const existing = map.get(group);
    if (existing) existing.push(item);
    else map.set(group, [item]);
  }
  return map;
}

function domainOf(table: string, domains: Array<{ title: string; match: RegExp }>): string {
  return domains.find((domain) => domain.match.test(table))?.title ?? 'Lain-lain';
}

// --- Kamus data --------------------------------------------------------------

function renderDataDictionary(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Kamus Data Lengkap',
      ctx,
      'Setiap tabel dicantumkan beserta seluruh kolom, tipe fisik, nullability, nilai bawaan, ' +
        'kunci, dan relasi keluar. Kolom bertanda **PK** adalah primary key, **FK** foreign key, ' +
        'dan **U** bagian dari unique constraint.',
    ),
  ];

  const bySchema = groupBy(ctx.tables, (table) => table.table_schema);
  const summary: string[] = [
    '## Ringkasan',
    '',
    '| Schema | Jumlah tabel | Jumlah kolom | Foreign key | Index |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const [schema, tables] of bySchema) {
    const cols = ctx.columns.filter((c) => c.table_schema === schema).length;
    const fks = ctx.constraints.filter(
      (c) => c.table_schema === schema && c.constraint_type === 'FOREIGN KEY',
    ).length;
    const idx = ctx.indexes.filter((i) => i.schema_name === schema).length;
    summary.push(`| \`${schema}\` | ${tables.length} | ${cols} | ${fks} | ${idx} |`);
  }
  out.push(summary.join('\n'), '');

  for (const [schema, tables] of bySchema) {
    out.push(`## Schema \`${schema}\``, '');
    for (const table of tables) {
      const cols = ctx.columns.filter(
        (c) => c.table_schema === schema && c.table_name === table.table_name,
      );
      const cons = ctx.constraints.filter(
        (c) => c.table_schema === schema && c.table_name === table.table_name,
      );
      const pkColumns = new Set(
        cons.filter((c) => c.constraint_type === 'PRIMARY KEY').flatMap((c) => c.columns.split(', ')),
      );
      const uniqueColumns = new Set(
        cons.filter((c) => c.constraint_type === 'UNIQUE').flatMap((c) => c.columns.split(', ')),
      );
      const fkByColumn = new Map<string, ConstraintRow>();
      for (const fk of cons.filter((c) => c.constraint_type === 'FOREIGN KEY')) {
        for (const column of fk.columns.split(', ')) fkByColumn.set(column, fk);
      }

      out.push(`### \`${schema}.${table.table_name}\``, '');
      if (table.comment) out.push(escapePipes(table.comment), '');

      out.push(
        '| # | Kolom | Tipe | Null | Bawaan | Kunci | Relasi |',
        '| --- | --- | --- | --- | --- | --- | --- |',
      );
      for (const column of cols) {
        const fk = fkByColumn.get(column.column_name);
        const keys = [
          pkColumns.has(column.column_name) ? 'PK' : '',
          fk ? 'FK' : '',
          uniqueColumns.has(column.column_name) ? 'U' : '',
        ]
          .filter(Boolean)
          .join(' ');
        const relation = fk
          ? `\`${fk.foreign_table}.${fk.foreign_columns}\`${fk.delete_rule ? ` (ON DELETE ${fk.delete_rule})` : ''}`
          : '';
        out.push(
          `| ${column.ordinal_position} | \`${column.column_name}\` | \`${typeLabel(column)}\` | ` +
            `${column.is_nullable === 'YES' ? 'ya' : 'tidak'} | ` +
            `${column.column_default ? `\`${truncate(escapePipes(column.column_default), 48)}\`` : '—'} | ` +
            `${keys || '—'} | ${relation || '—'} |`,
        );
      }
      out.push('');

      const checks = cons.filter((c) => c.constraint_type === 'CHECK' && !c.constraint_name.endsWith('_not_null'));
      if (checks.length) {
        out.push('Check constraint:', '');
        for (const check of checks) out.push(`- \`${check.constraint_name}\``);
        out.push('');
      }

      const tableTriggers = ctx.triggers.filter(
        (trigger) => trigger.schema_name === schema && trigger.table_name === table.table_name,
      );
      if (tableTriggers.length) {
        out.push('Trigger:', '');
        for (const trigger of tableTriggers) {
          out.push(
            `- \`${trigger.trigger_name}\` — ${trigger.action_timing} ${trigger.event_manipulation}`,
          );
        }
        out.push('');
      }
    }
  }

  return out.join('\n');
}

// --- ERD ---------------------------------------------------------------------

function renderErd(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Ikhtisar Entity Relationship',
      ctx,
      'Diagram dipecah per domain agar tetap terbaca. Setiap panah menunjukkan foreign key ' +
        'dari tabel anak ke tabel induk beserta aturan ON DELETE.',
    ),
  ];

  const sections: Array<{ schema: string; domains: Array<{ title: string; match: RegExp }> }> = [
    { schema: 'platform', domains: PLATFORM_DOMAINS },
  ];
  if (ctx.tenantSchema) {
    sections.push({ schema: ctx.tenantSchema, domains: TENANT_DOMAINS });
  }

  for (const section of sections) {
    const tables = ctx.tables
      .filter((table) => table.table_schema === section.schema)
      .map((table) => table.table_name);
    const fks = ctx.constraints.filter(
      (c) =>
        c.table_schema === section.schema &&
        c.constraint_type === 'FOREIGN KEY' &&
        c.foreign_schema === section.schema,
    );

    out.push(`## Schema \`${section.schema}\``, '');

    const byDomain = groupBy(tables, (table) => domainOf(table, section.domains));
    // Domain diurutkan sesuai deklarasi; `Lain-lain` selalu terakhir.
    const orderedDomains = [...section.domains.map((domain) => domain.title), 'Lain-lain'].filter(
      (title) => byDomain.has(title),
    );
    for (const domain of orderedDomains) {
      const domainTables = byDomain.get(domain)!;
      const inDomain = new Set(domainTables);
      const relations = fks.filter(
        (fk) => inDomain.has(fk.table_name) && inDomain.has(fk.foreign_table ?? ''),
      );

      out.push(`### ${domain}`, '', '```mermaid', 'erDiagram');
      for (const table of domainTables.sort()) {
        const cols = ctx.columns.filter(
          (c) => c.table_schema === section.schema && c.table_name === table,
        );
        const tableConstraints = ctx.constraints.filter(
          (c) => c.table_schema === section.schema && c.table_name === table,
        );
        const pk = new Set(
          tableConstraints
            .filter((c) => c.constraint_type === 'PRIMARY KEY')
            .flatMap((c) => c.columns.split(', ')),
        );
        // FK ditandai berdasarkan constraint nyata, bukan konvensi nama kolom.
        const fkColumns = new Set(
          tableConstraints
            .filter((c) => c.constraint_type === 'FOREIGN KEY')
            .flatMap((c) => c.columns.split(', ')),
        );
        // Hanya kolom kunci dan identitas bisnis ditampilkan agar diagram ringkas.
        const shown = cols.filter(
          (c) =>
            pk.has(c.column_name) ||
            fkColumns.has(c.column_name) ||
            ['code', 'name', 'status', 'number'].includes(c.column_name),
        );
        out.push(`  ${table} {`);
        for (const column of shown.slice(0, 12)) {
          const marker = pk.has(column.column_name)
            ? ' PK'
            : fkColumns.has(column.column_name)
              ? ' FK'
              : '';
          out.push(`    ${typeLabel(column).replace(/[^a-zA-Z0-9]/g, '_')} ${column.column_name}${marker}`);
        }
        out.push('  }');
      }
      for (const relation of relations) {
        const optional = ctx.columns.some(
          (c) =>
            c.table_schema === section.schema &&
            c.table_name === relation.table_name &&
            c.column_name === relation.columns.split(', ')[0] &&
            c.is_nullable === 'YES',
        );
        out.push(
          `  ${relation.foreign_table} ${optional ? '|o..o{' : '||--o{'} ${relation.table_name} : "${relation.columns}"`,
        );
      }
      out.push('```', '');
    }

    // Relasi lintas domain didaftarkan sebagai tabel agar tidak hilang.
    const crossDomain = fks.filter(
      (fk) =>
        domainOf(fk.table_name, section.domains) !== domainOf(fk.foreign_table ?? '', section.domains),
    );
    if (crossDomain.length) {
      out.push(
        `### Relasi lintas domain \`${section.schema}\``,
        '',
        '| Tabel anak | Kolom | Tabel induk | ON DELETE |',
        '| --- | --- | --- | --- |',
      );
      for (const fk of crossDomain) {
        out.push(
          `| \`${fk.table_name}\` | \`${fk.columns}\` | \`${fk.foreign_table}\` | ${fk.delete_rule ?? '—'} |`,
        );
      }
      out.push('');
    }
  }

  if (ctx.tenantAuditSchema) {
    out.push(
      '## Schema audit',
      '',
      'Schema audit bersifat append-only dan tidak memiliki foreign key ke tabel data agar',
      'penghapusan data tidak pernah menghapus jejak audit.',
      '',
      '| Schema | Tabel |',
      '| --- | --- |',
    );
    for (const table of ctx.tables.filter((t) => t.table_schema.endsWith('__audit'))) {
      out.push(`| \`${table.table_schema}\` | \`${table.table_name}\` |`);
    }
    out.push('');
  }

  return out.join('\n');
}

// --- Katalog index -----------------------------------------------------------

function renderIndexCatalog(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Katalog Index',
      ctx,
      'Setiap index dicantumkan beserta definisi lengkap. Kolom **Jenis** membedakan primary key, ' +
        'unique constraint, dan index pendukung query.',
    ),
  ];

  const bySchema = groupBy(ctx.indexes, (index) => index.schema_name);
  for (const [schema, indexes] of bySchema) {
    out.push(
      `## Schema \`${schema}\``,
      '',
      `Total ${indexes.length} index pada ${new Set(indexes.map((i) => i.table_name)).size} tabel.`,
      '',
      '| Tabel | Index | Jenis | Kolom | Ukuran |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const index of indexes) {
      const kind = index.is_primary ? 'PRIMARY KEY' : index.is_unique ? 'UNIQUE' : 'INDEX';
      // Ekstrak daftar kolom dari definisi index agar ekspresi partial ikut terlihat.
      const columns = index.index_definition.replace(/^.*USING \w+ /, '');
      out.push(
        `| \`${index.table_name}\` | \`${index.index_name}\` | ${kind} | ` +
          `\`${truncate(escapePipes(columns), 90)}\` | ${index.index_size} |`,
      );
    }
    out.push('');
  }

  const tablesWithoutIndex = ctx.tables.filter(
    (table) =>
      !ctx.indexes.some(
        (index) =>
          index.schema_name === table.table_schema &&
          index.table_name === table.table_name &&
          !index.is_primary,
      ),
  );
  if (tablesWithoutIndex.length) {
    out.push(
      '## Tabel tanpa index sekunder',
      '',
      'Tabel berikut hanya memiliki primary key. Ini wajar untuk tabel referensi kecil, tetapi',
      'perlu ditinjau bila tabel tersebut sering difilter pada query pelaporan.',
      '',
    );
    for (const table of tablesWithoutIndex) {
      out.push(`- \`${table.table_schema}.${table.table_name}\``);
    }
    out.push('');
  }

  const unindexedForeignKeys = ctx.constraints.filter((constraint) => {
    if (constraint.constraint_type !== 'FOREIGN KEY') return false;
    const first = constraint.columns.split(', ')[0];
    return !ctx.indexes.some(
      (index) =>
        index.schema_name === constraint.table_schema &&
        index.table_name === constraint.table_name &&
        new RegExp(`\\(\\s*"?${first}"?`).test(index.index_definition),
    );
  });
  if (unindexedForeignKeys.length) {
    out.push(
      '## Foreign key tanpa index pendukung',
      '',
      'PostgreSQL tidak membuat index otomatis pada sisi anak foreign key. Kolom berikut akan',
      'melakukan sequential scan saat induknya dihapus atau saat join dilakukan dari sisi induk.',
      '',
      '| Tabel | Kolom | Induk |',
      '| --- | --- | --- |',
    );
    for (const fk of unindexedForeignKeys) {
      out.push(
        `| \`${fk.table_schema}.${fk.table_name}\` | \`${fk.columns}\` | \`${fk.foreign_table}\` |`,
      );
    }
    out.push('');
  }

  return out.join('\n');
}

// --- Katalog model -----------------------------------------------------------

function renderModelCatalog(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Katalog Model',
      ctx,
      'Pemetaan tabel fisik ke resource aplikasi. Kolom **Resource master** terisi bila tabel ' +
        'dikelola melalui engine lifecycle master generik; tabel dokumen memiliki service tersendiri.',
    ),
  ];

  const resourceByTable = new Map(MASTER_RESOURCES.map((resource) => [resource.table, resource]));
  const seedByTable = new Map(TENANT_MASTER_SEEDS.map((seed) => [seed.table, seed]));

  const bySchema = groupBy(ctx.tables, (table) => table.table_schema);
  for (const [schema, tables] of bySchema) {
    out.push(
      `## Schema \`${schema}\``,
      '',
      '| Tabel | Kolom | Resource master | Seed minimum | Kebijakan hapus permanen |',
      '| --- | --- | --- | --- | --- |',
    );
    for (const table of tables) {
      const resource = resourceByTable.get(table.table_name);
      const seed = seedByTable.get(table.table_name);
      const columnCount = ctx.columns.filter(
        (c) => c.table_schema === schema && c.table_name === table.table_name,
      ).length;
      out.push(
        `| \`${table.table_name}\` | ${columnCount} | ` +
          `${resource ? `\`${resource.resourceCode}\`` : '—'} | ` +
          `${seed ? seed.minimumRecords : '—'} | ` +
          `${resource?.hardDeletePolicy ?? seed?.hardDeletePolicy ?? '—'} |`,
      );
    }
    out.push('');
  }

  out.push(
    '## Resource master yang diekspos melalui API generik',
    '',
    '| Resource | Label | Tabel | Field dapat ditulis | Purge |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const resource of MASTER_RESOURCES) {
    out.push(
      `| \`${resource.resourceCode}\` | ${resource.label} | \`${resource.table}\` | ` +
        `${resource.writableFields.length} | ${resource.supportsPurge ? 'ya' : 'tidak'} |`,
    );
  }
  out.push('');

  return out.join('\n');
}

// --- Katalog seed ------------------------------------------------------------

function renderSeedCatalog(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Katalog MasterSeedRegistry',
      ctx,
      'Registry menetapkan minimum record per master relevan. `pnpm seed:verify` memakai daftar ' +
        'ini sebagai sumber tunggal kebenaran dan gagal bila ada master di bawah minimum.',
    ),
  ];

  out.push(
    '## Seed tenant',
    '',
    '| Urutan | Resource | Tabel | Minimum | Record terdefinisi | Tabel di database | Strategi | Cleanup contoh | Kebijakan purge |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const seed of [...TENANT_MASTER_SEEDS].sort((a, b) => a.order - b.order)) {
    const exists = ctx.tenantSchema
      ? ctx.tables.some((t) => t.table_schema === ctx.tenantSchema && t.table_name === seed.table)
      : false;
    const defined = Array.isArray(seed.records) ? String(seed.records.length) : 'dinamis';
    out.push(
      `| ${seed.order} | \`${seed.resourceCode}\` | \`${seed.table}\` | ${seed.minimumRecords} | ` +
        `${defined} | ${exists ? 'ada' : 'tidak ditemukan'} | ${seed.strategy} | ` +
        `${seed.supportsSampleCleanup ? 'ya' : 'tidak'} | ${seed.hardDeletePolicy} |`,
    );
  }
  out.push('');

  out.push(
    '## Seed control plane',
    '',
    'Minimum record control plane diverifikasi langsung terhadap database. Angka berikut adalah',
    `hasil verifikasi saat generate dijalankan (status keseluruhan: ${ctx.platformReport.passed ? 'LULUS' : 'GAGAL'}).`,
    '',
    '| Resource | Label | Minimum | Aktif | Status |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const row of ctx.platformReport.rows) {
    out.push(
      `| \`${row.resourceCode}\` | ${row.label} | ${row.requiredMinimum} | ${row.activeCount} | ` +
        `${row.status === 'OK' ? 'OK' : 'KURANG'} |`,
    );
  }
  out.push('');

  const insufficient = TENANT_MASTER_SEEDS.filter(
    (seed) => Array.isArray(seed.records) && seed.records.length < seed.minimumRecords,
  );
  out.push(
    '## Konsistensi registry',
    '',
    insufficient.length === 0
      ? 'Seluruh definisi seed tenant memiliki jumlah record minimal sama dengan `minimumRecords`.'
      : 'Definisi berikut memiliki record lebih sedikit daripada `minimumRecords` dan akan gagal pada verifikasi:',
    '',
  );
  for (const seed of insufficient) {
    out.push(
      `- \`${seed.resourceCode}\`: ${Array.isArray(seed.records) ? seed.records.length : 0} record, minimum ${seed.minimumRecords}`,
    );
  }
  out.push('');

  return out.join('\n');
}

function renderSeedExceptions(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Pengecualian Aturan Minimum 10 Record',
      ctx,
      'Aturan umum Versi 5 adalah minimum 10 record contoh per master relevan. Master berikut ' +
        'dikecualikan karena jumlahnya ditentukan struktur bisnis nyata, bukan data contoh. ' +
        'Setiap pengecualian wajib memiliki alasan tertulis.',
    ),
    '| Resource | Tabel | Alasan pengecualian |',
    '| --- | --- | --- |',
  ];
  for (const exception of TENANT_SEED_EXCEPTIONS) {
    out.push(
      `| \`${exception.resourceCode}\` | \`${exception.table}\` | ${escapePipes(exception.reason)} |`,
    );
  }
  out.push(
    '',
    `Total pengecualian: ${TENANT_SEED_EXCEPTIONS.length}. Master lain di luar daftar ini wajib`,
    'memenuhi minimum yang tercatat pada [katalog seed](master-seed-catalog.md).',
    '',
  );
  return out.join('\n');
}

// --- Kebijakan lifecycle -----------------------------------------------------

function renderLifecyclePolicy(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Kebijakan Lifecycle Tabel',
      ctx,
      'Lifecycle master Versi 5 memakai tiga tingkat: nonaktifkan (`is_active = false`), hapus ' +
        'sementara (`deleted_at` terisi), dan hapus permanen (purge) yang memerlukan permission ' +
        '`HARD_DELETE`, step-up authentication, alasan, dan reference check.',
    ),
  ];

  const bySchema = groupBy(ctx.tables, (table) => table.table_schema);
  for (const [schema, tables] of bySchema) {
    out.push(
      `## Schema \`${schema}\``,
      '',
      '| Tabel | ' + LIFECYCLE_COLUMNS.map((column) => `\`${column}\``).join(' | ') + ' | Tingkat |',
      '| --- |' + LIFECYCLE_COLUMNS.map(() => ' --- |').join('') + ' --- |',
    );
    for (const table of tables) {
      const columns = new Set(
        ctx.columns
          .filter((c) => c.table_schema === schema && c.table_name === table.table_name)
          .map((c) => c.column_name),
      );
      const marks = LIFECYCLE_COLUMNS.map((column) => (columns.has(column) ? '✓' : '—'));
      const level = columns.has('deleted_at')
        ? columns.has('is_active')
          ? 'nonaktif + soft delete + purge terkontrol'
          : 'soft delete'
        : schema.endsWith('__audit')
          ? 'append-only (tidak pernah dihapus)'
          : 'immutable / ledger';
      out.push(`| \`${table.table_name}\` | ${marks.join(' | ')} | ${level} |`);
    }
    out.push('');
  }

  out.push(
    '## Tabel append-only dan immutable',
    '',
    'Tabel berikut tidak boleh di-UPDATE atau DELETE oleh role runtime. Pembatasan ditegakkan',
    'oleh trigger database, bukan hanya oleh kode aplikasi.',
    '',
    '| Schema | Tabel | Trigger penegak |',
    '| --- | --- | --- |',
  );
  const guardTriggers = ctx.triggers.filter((trigger) => /forbid|immutable|append/i.test(trigger.trigger_name));
  for (const trigger of guardTriggers) {
    out.push(
      `| \`${trigger.schema_name}\` | \`${trigger.table_name}\` | \`${trigger.trigger_name}\` (${trigger.action_timing} ${trigger.event_manipulation}) |`,
    );
  }
  if (!guardTriggers.length) out.push('| — | — | belum ada trigger penegak terpasang |');
  out.push('');

  out.push(
    '## Trigger audit DML',
    '',
    'Setiap tabel data tenant memiliki trigger audit generik yang menulis perubahan baris ke',
    'schema audit tenant beserta konteks permintaan.',
    '',
  );
  const auditTriggers = ctx.triggers.filter((trigger) => /audit/i.test(trigger.trigger_name));
  out.push(
    `Total trigger audit terpasang: ${auditTriggers.length} pada ${
      new Set(auditTriggers.map((trigger) => `${trigger.schema_name}.${trigger.table_name}`)).size
    } tabel.`,
    '',
  );

  return out.join('\n');
}

// --- Matriks referensi hard delete ------------------------------------------

function renderReferenceMatrix(ctx: DocContext): string {
  const out: string[] = [
    header(
      'Matriks Referensi Hapus Permanen',
      ctx,
      'Sebelum purge dijalankan, engine lifecycle memeriksa seluruh tabel yang mereferensikan ' +
        'record. Bila salah satu referensi berasal dari tabel transaksi, purge selalu ditolak ' +
        'dan pengguna diarahkan memakai hapus sementara.',
    ),
  ];

  for (const resource of MASTER_RESOURCES) {
    out.push(
      `## \`${resource.resourceCode}\` — ${resource.label}`,
      '',
      `- Tabel: \`${resource.table}\``,
      `- Kebijakan: \`${resource.hardDeletePolicy}\``,
      `- Purge diizinkan: ${resource.supportsPurge ? 'ya, bila tidak ada referensi' : 'tidak'}`,
      '',
    );
    if (resource.references.length === 0) {
      out.push('Tidak ada tabel yang mereferensikan resource ini.', '');
      continue;
    }
    out.push('| Tabel perujuk | Kolom | Jenis | Terpasang di database |', '| --- | --- | --- | --- |');
    for (const reference of resource.references) {
      // Verifikasi bahwa referensi yang didaftarkan benar-benar ada sebagai kolom.
      const present = ctx.tenantSchema
        ? ctx.columns.some(
            (column) =>
              column.table_schema === ctx.tenantSchema &&
              column.table_name === reference.table &&
              column.column_name === reference.column,
          )
        : false;
      out.push(
        `| \`${reference.table}\` | \`${reference.column}\` | ` +
          `${reference.isTransactional ? '**transaksi**' : 'master'} | ${present ? 'ya' : 'tidak ditemukan'} |`,
      );
    }
    out.push('');
  }

  const missing = MASTER_RESOURCES.flatMap((resource) =>
    resource.references
      .filter(
        (reference) =>
          ctx.tenantSchema &&
          !ctx.columns.some(
            (column) =>
              column.table_schema === ctx.tenantSchema &&
              column.table_name === reference.table &&
              column.column_name === reference.column,
          ),
      )
      .map((reference) => `${resource.resourceCode} → ${reference.table}.${reference.column}`),
  );
  out.push(
    '## Validasi registry terhadap database',
    '',
    missing.length === 0
      ? 'Seluruh referensi yang terdaftar pada registry benar-benar ada sebagai kolom di schema tenant.'
      : 'Referensi berikut terdaftar pada registry tetapi tidak ditemukan di database:',
    '',
  );
  for (const item of missing) out.push(`- \`${item}\``);
  out.push('');

  return out.join('\n');
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
