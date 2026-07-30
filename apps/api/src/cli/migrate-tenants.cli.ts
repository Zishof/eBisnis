/**
 * pnpm migrate:tenants [--schema <tenant>] [--dry-run]
 *
 * Menerapkan migration tenant yang belum diterapkan lalu menyemai ulang menu,
 * role, profil, batas data, dan aturan pemisahan tugas pada setiap schema yang
 * terdaftar.
 *
 * Tenant yang dibuat sebelum katalog role Versi 8 ada tidak akan memperolehnya
 * dengan sendirinya — provisioning hanya berjalan sekali saat pendaftaran.
 * Perintah ini yang menyusulkannya. Seluruhnya idempotent, sehingga aman
 * dijalankan berulang dan aman diulang setelah gagal di tengah.
 *
 * Tidak menghapus, tidak me-reset, dan tidak mengubah migration yang sudah
 * diterapkan — checksum yang berbeda menghasilkan error, bukan penerapan diam.
 */
import 'dotenv/config';
import { createSeedContext } from './seed-runner';
import { parseArgs } from './cli-utils';
import { TenantMigrationService } from '../infrastructure/provisioning/tenant-migration.service';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.flags.has('dry-run');
  const ctx = await createSeedContext();
  const migrations = ctx.app.get(TenantMigrationService);

  let failed = 0;

  try {
    const registries = await ctx.prisma.tenantSchemaRegistry.findMany({
      where: args.options.schema ? { schemaName: args.options.schema } : {},
      orderBy: { schemaName: 'asc' },
    });

    if (registries.length === 0) {
      process.stderr.write('Tidak ada schema tenant terdaftar yang cocok.\n');
      process.exit(1);
    }

    process.stdout.write(
      `${registries.length} schema tenant, target migration ${migrations.latestVersion()}` +
        `${dryRun ? ' (dry-run, tidak ada perubahan ditulis)' : ''}\n\n`,
    );

    for (const registry of registries) {
      const { schemaName, auditSchemaName, tenantId } = registry;
      process.stdout.write(`[${schemaName}]\n`);

      try {
        if (dryRun) {
          const state = await migrations.verifySchema(schemaName, auditSchemaName);
          process.stdout.write(`  status: ${JSON.stringify(state)}\n\n`);
          continue;
        }

        const applied = await migrations.applyAll(schemaName, auditSchemaName, { tenantId });
        const fresh = applied.filter((r) => !r.skipped);
        process.stdout.write(
          fresh.length > 0
            ? `  migration: ${fresh.map((r) => r.version).join(', ')}\n`
            : '  migration: sudah mutakhir\n',
        );

        // Nama usaha diambil dari yang sudah tersimpan; perintah ini tidak
        // boleh menimpa identitas tenant, hanya menyusulkan tata kelola role.
        const existing = await ctx.tenantDb.query<{ name: string }>(
          schemaName,
          'SELECT name FROM legal_entity WHERE code = $1 LIMIT 1',
          ['LE-UTAMA'],
        );
        const businessName = existing[0]?.name ?? schemaName;

        const result = await ctx.bootstrap.seedOrganization(schemaName, { businessName });
        process.stdout.write(
          `  menu ${result.menuCount}, role ${result.roleCount}, izin baru ${result.permissionCount}\n\n`,
        );
      } catch (error) {
        failed += 1;
        process.stderr.write(`  GAGAL: ${error instanceof Error ? error.message : String(error)}\n\n`);
      }
    }

    if (failed > 0) {
      process.stderr.write(`${failed} schema gagal. Perbaiki lalu jalankan ulang.\n`);
      process.exit(1);
    }
    process.stdout.write('Selesai.\n');
    process.exit(0);
  } finally {
    await ctx.app.close();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
