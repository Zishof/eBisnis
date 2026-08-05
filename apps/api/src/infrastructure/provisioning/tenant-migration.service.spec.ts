import { TenantMigrationService } from './tenant-migration.service';

describe('TenantMigrationService', () => {
  it('melewati V044 pada tenant yang tidak memiliki tabel pesantren_unit_pendidikan', async () => {
    const prisma = {
      tenantSchemaMigrationHistory: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const tenantDb = { executeAdmin: jest.fn(), queryAdmin: jest.fn() };
    const service = new TenantMigrationService(prisma as never, tenantDb as never);
    const definition = {
      version: 'V044',
      sequence: 44,
      file: 'V044__pesantren_unit_visuals.sql',
      name: 'Visual situs per unit pendidikan pesantren',
      description: '',
    };

    jest.spyOn(service, 'getManifest').mockReturnValue({ schemaVersion: 1, migrations: [definition] });
    jest.spyOn(service as never, 'loadSql').mockReturnValue({
      sql: 'ALTER TABLE "{{TENANT_SCHEMA}}".pesantren_unit_pendidikan ADD COLUMN hero_image_url TEXT;',
      checksum: 'checksum-v044',
    });
    jest.spyOn(service as never, 'hasTenantTable').mockResolvedValue(false);
    jest.spyOn(service as never, 'markMigrationSucceeded').mockResolvedValue(undefined);

    const result = await service.applyAll('cmnmedika_inventory', 'cmnmedika_inventory_audit');

    expect(result).toEqual([
      {
        version: 'V044',
        name: 'Visual situs per unit pendidikan pesantren',
        checksum: 'checksum-v044',
        durationMs: expect.any(Number),
        skipped: true,
      },
    ]);
    expect(tenantDb.executeAdmin).not.toHaveBeenCalledWith(expect.stringContaining('pesantren_unit_pendidikan'));
  });
});
