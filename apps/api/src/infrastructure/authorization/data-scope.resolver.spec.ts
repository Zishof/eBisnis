import { TenantConnectionService } from '../database/tenant-connection.service';
import { DataScopeResolver } from './data-scope.resolver';

type Row = Record<string, unknown>;

/**
 * Klien tiruan: query pertama yang menyebut `role_data_scope` mengembalikan
 * tingkat, query yang menyebut `user_scope_assignment` mengembalikan penugasan.
 */
function fakeDb(levels: Row[], assignments: string[] = []) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn(async (_schema: string, sql: string, params: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('role_data_scope')) return levels;
    if (sql.includes('user_scope_assignment')) return assignments.map((id) => ({ scope_id: id }));
    return [];
  });
  return {
    db: { query } as unknown as TenantConnectionService,
    calls,
  };
}

const COLUMNS = {
  LEGAL_ENTITY: 'w.legal_entity_id',
  WAREHOUSE: 'sb.warehouse_id',
  OUTLET: 'o.outlet_id',
  SELF: 'doc.created_by',
};

describe('DataScopeResolver', () => {
  describe('tanpa role', () => {
    it('menolak seluruh baris, bukan meloloskannya', async () => {
      const { db } = fakeDb([]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result).toMatchObject({ sql: 'FALSE', denied: true, level: null });
    });
  });

  describe('tingkat tanpa batas', () => {
    it('tidak menyaring apa pun pada TENANT', async () => {
      const { db } = fakeDb([{ scope_level: 'TENANT', requires_assignment: false }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result).toMatchObject({ sql: 'TRUE', denied: false, level: 'TENANT' });
    });

    it('tidak menyaring apa pun pada PLATFORM', async () => {
      const { db } = fakeDb([{ scope_level: 'PLATFORM', requires_assignment: false }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result.sql).toBe('TRUE');
    });
  });

  describe('tingkat yang menuntut penugasan', () => {
    it('mengembalikan NOL baris bila belum ditugaskan', async () => {
      // Inti aturannya: kepala gudang tanpa gudang yang ditugaskan tidak berarti
      // "seluruh gudang". Ini yang paling mudah salah dan paling merugikan.
      const { db } = fakeDb([{ scope_level: 'WAREHOUSE', requires_assignment: true }], []);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result).toMatchObject({ sql: 'FALSE', denied: true, level: 'WAREHOUSE' });
    });

    it('menyaring pada penugasan yang ada', async () => {
      const { db } = fakeDb([{ scope_level: 'WAREHOUSE', requires_assignment: true }], [
        'w-1',
        'w-2',
      ]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result.sql).toBe('sb.warehouse_id = ANY($1::uuid[])');
      expect(result.params).toEqual([['w-1', 'w-2']]);
      expect(result.denied).toBe(false);
    });

    it('menomori parameter mulai dari startIndex', async () => {
      const { db } = fakeDb([{ scope_level: 'OUTLET', requires_assignment: true }], ['o-1']);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS, {
        startIndex: 4,
      });
      expect(result.sql).toBe('o.outlet_id = ANY($4::uuid[])');
    });
  });

  describe('tingkat yang tidak menuntut penugasan', () => {
    it('meloloskan bila belum ditugaskan', async () => {
      const { db } = fakeDb([{ scope_level: 'LEGAL_ENTITY', requires_assignment: false }], []);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result.sql).toBe('TRUE');
    });
  });

  describe('batas SELF', () => {
    it('menyaring pada kolom pemilik', async () => {
      const { db } = fakeDb([{ scope_level: 'SELF', requires_assignment: false }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result.sql).toBe('doc.created_by = $1');
      expect(result.params).toEqual(['u1']);
    });

    it('memakai ownerColumn bila diberikan', async () => {
      const { db } = fakeDb([{ scope_level: 'SELF', requires_assignment: false }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS, {
        ownerColumn: 'trip.driver_id',
      });
      expect(result.sql).toBe('trip.driver_id = $1');
    });

    it('menolak bila query tidak punya kolom pemilik', async () => {
      const { db } = fakeDb([{ scope_level: 'SELF', requires_assignment: false }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', {
        WAREHOUSE: 'sb.warehouse_id',
      });
      expect(result).toMatchObject({ sql: 'FALSE', denied: true });
    });
  });

  describe('tingkat yang tidak dapat dipetakan', () => {
    it('menolak, bukan meloloskan', async () => {
      // Pemegang batas ASSIGNED_TRIP membuka daftar produk: tidak ada kolom
      // perjalanan pada produk, sehingga batasnya tidak dapat dinyatakan.
      const { db } = fakeDb([{ scope_level: 'ASSIGNED_TRIP', requires_assignment: true }]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result).toMatchObject({ sql: 'FALSE', denied: true, level: 'ASSIGNED_TRIP' });
    });

    it('memperlakukan tingkat tak dikenal sebagai yang paling sempit', async () => {
      const { db } = fakeDb([
        { scope_level: 'ENTAH_APA', requires_assignment: true },
        { scope_level: 'WAREHOUSE', requires_assignment: true },
      ], ['w-1']);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      // WAREHOUSE lebih luas daripada tingkat tak dikenal, sehingga ia yang dipakai.
      expect(result.level).toBe('WAREHOUSE');
    });
  });

  describe('beberapa role sekaligus', () => {
    it('memakai tingkat yang paling luas', async () => {
      const { db } = fakeDb([
        { scope_level: 'WAREHOUSE', requires_assignment: true },
        { scope_level: 'TENANT', requires_assignment: false },
        { scope_level: 'SELF', requires_assignment: false },
      ]);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result).toMatchObject({ sql: 'TRUE', level: 'TENANT' });
    });

    it('memilih LEGAL_ENTITY di atas WAREHOUSE', async () => {
      const { db } = fakeDb([
        { scope_level: 'WAREHOUSE', requires_assignment: true },
        { scope_level: 'LEGAL_ENTITY', requires_assignment: true },
      ], ['le-1']);
      const result = await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      expect(result.level).toBe('LEGAL_ENTITY');
      expect(result.sql).toBe('w.legal_entity_id = ANY($1::uuid[])');
    });
  });

  describe('sumber penugasan', () => {
    it('menggabungkan penugasan pengguna dan penugasan role', async () => {
      const { db, calls } = fakeDb(
        [{ scope_level: 'WAREHOUSE', requires_assignment: true }],
        ['w-1'],
      );
      await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      const assignmentQuery = calls.find((c) => c.sql.includes('user_scope_assignment'))!;
      expect(assignmentQuery.sql).toContain('role_scope');
      expect(assignmentQuery.sql).toContain('revoked_at IS NULL');
      expect(assignmentQuery.params).toEqual(['u1', 'WAREHOUSE']);
    });

    it('hanya menghitung role yang masih aktif dan belum dihapus', async () => {
      const { db, calls } = fakeDb([{ scope_level: 'TENANT', requires_assignment: false }]);
      await new DataScopeResolver(db).buildPredicate('tokosaya', 'u1', COLUMNS);
      const levelQuery = calls.find((c) => c.sql.includes('role_data_scope'))!;
      expect(levelQuery.sql).toContain('r.deleted_at IS NULL');
      expect(levelQuery.sql).toContain('r.is_active');
      expect(levelQuery.sql).toContain('ura.valid_until IS NULL OR ura.valid_until > now()');
    });
  });
});
