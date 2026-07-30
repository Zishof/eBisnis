import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { StorefrontResolverService } from './storefront-resolver.service';

const MARKETPLACE_HOST = 'belanja.ebisnis.id';

interface StoreFixture {
  id: string;
  storeSlug: string;
  storeName: string;
  status: string;
  deletedAt: Date | null;
  seller: { id: string; tenantId: string; status: string };
}

interface DomainFixture {
  host: string;
  storeId: string;
  status: string;
  verifiedAt: Date | null;
  isPrimary: boolean;
  store: StoreFixture;
}

const store = (over: Partial<StoreFixture> = {}): StoreFixture => ({
  id: 'store-1',
  storeSlug: 'toko-joni',
  storeName: 'Toko Joni',
  status: 'PUBLISHED',
  deletedAt: null,
  seller: { id: 'seller-1', tenantId: 'tenant-1', status: 'ACTIVE' },
  ...over,
});

function build(options: {
  domains?: DomainFixture[];
  stores?: StoreFixture[];
  registry?: { schemaName: string } | null;
} = {}) {
  const domains = options.domains ?? [];
  const stores = options.stores ?? [];
  const registry = options.registry === undefined ? { schemaName: 'tokojoni' } : options.registry;

  const prisma = {
    marketplaceStoreDomain: {
      findFirst: jest.fn(async ({ where, select }: never) => {
        const w = where as unknown as Record<string, unknown>;
        if (w.isPrimary) {
          const primary = domains.find((d) => d.storeId === w.storeId && d.isPrimary);
          return primary ? { host: primary.host } : null;
        }
        void select;
        return domains.find((d) => d.host === w.host) ?? null;
      }),
    },
    marketplaceStore: {
      findFirst: jest.fn(async ({ where }: never) => {
        const w = where as unknown as Record<string, unknown>;
        return stores.find((s) => s.storeSlug === w.storeSlug) ?? null;
      }),
    },
    tenantSchemaRegistry: { findFirst: jest.fn(async () => registry) },
  } as unknown as PrismaService;

  const config = {
    get: (path: string) => (path === 'marketplace.publicHost' ? MARKETPLACE_HOST : undefined),
  } as unknown as ConfigService;

  return new StorefrontResolverService(prisma, config);
}

describe('StorefrontResolverService', () => {
  describe('mode marketplace', () => {
    it('mengembalikan mode MARKETPLACE untuk host publik tanpa slug', async () => {
      const result = await build().resolve(MARKETPLACE_HOST);
      expect(result).toMatchObject({ ok: true, mode: 'MARKETPLACE', host: MARKETPLACE_HOST });
    });

    it('menyelesaikan toko dari slug pada jalur', async () => {
      const resolver = build({ stores: [store()] });
      const result = await resolver.resolve(MARKETPLACE_HOST, 'toko-joni');
      expect(result).toMatchObject({
        ok: true,
        mode: 'SINGLE_STORE',
        storeSlug: 'toko-joni',
        schemaName: 'tokojoni',
      });
    });

    it('menolak slug yang tidak ada', async () => {
      const result = await build({ stores: [] }).resolve(MARKETPLACE_HOST, 'tidak-ada');
      expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_HOST' });
    });

    it('menolak slug yang tidak valid', async () => {
      const result = await build().resolve(MARKETPLACE_HOST, 'toko/../admin');
      expect(result).toMatchObject({ ok: false, code: 'INVALID_HOST' });
    });
  });

  describe('host spoofing', () => {
    it('menolak host yang tidak dapat dinormalkan', async () => {
      for (const raw of ['evil.com@tokojoni.com', '192.168.1.1', 'localhost', '']) {
        const result = await build().resolve(raw);
        expect(result).toMatchObject({ ok: false, code: 'INVALID_HOST' });
      }
    });

    it('menolak header host ganda', async () => {
      const result = await build().resolve(['a.com', 'b.com']);
      expect(result).toMatchObject({ ok: false, code: 'INVALID_HOST' });
    });

    it('menolak host yang tidak terdaftar alih-alih memakai toko bawaan', async () => {
      // Ini aturan yang paling mudah dilanggar tanpa disadari. Mengarahkan host
      // tak dikenal ke toko bawaan berarti setiap kesalahan DNS menampilkan
      // katalog milik orang lain.
      const result = await build({ domains: [] }).resolve('domain-asing.com');
      expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_HOST' });
      expect((result as { storeId?: string }).storeId).toBeUndefined();
    });

    it('mencocokkan host setelah dinormalkan, bukan nilai mentahnya', async () => {
      const resolver = build({
        domains: [
          {
            host: 'tokojoni.com',
            storeId: 'store-1',
            status: 'ACTIVE',
            verifiedAt: new Date(),
            isPrimary: true,
            store: store(),
          },
        ],
      });
      const ditolak: string[] = [];
      for (const raw of ['TokoJoni.com', 'tokojoni.com.', 'tokojoni.com:443']) {
        const result = await resolver.resolve(raw);
        if (!(result as { ok: boolean }).ok) ditolak.push(raw);
      }
      expect(ditolak).toEqual([]);
    });
  });

  describe('domain yang belum terverifikasi', () => {
    const unverified = (over: Partial<DomainFixture> = {}): DomainFixture => ({
      host: 'tokojoni.com',
      storeId: 'store-1',
      status: 'PENDING_VERIFICATION',
      verifiedAt: null,
      isPrimary: true,
      store: store(),
      ...over,
    });

    it('menolak domain berstatus PENDING_VERIFICATION', async () => {
      const result = await build({ domains: [unverified()] }).resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'NOT_VERIFIED' });
    });

    it('menolak domain berstatus FAILED', async () => {
      const result = await build({ domains: [unverified({ status: 'FAILED' })] }).resolve(
        'tokojoni.com',
      );
      expect(result).toMatchObject({ ok: false, code: 'NOT_VERIFIED' });
    });

    it('menolak domain berstatus VERIFIED tetapi tanpa verifiedAt', async () => {
      // Status dan stempel waktu harus sejalan; salah satunya saja tidak cukup.
      const result = await build({
        domains: [unverified({ status: 'VERIFIED', verifiedAt: null })],
      }).resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'NOT_VERIFIED' });
    });
  });

  describe('toko dan seller yang tidak layak dilayani', () => {
    const withStatus = (storeStatus: string, sellerStatus = 'ACTIVE'): DomainFixture => ({
      host: 'tokojoni.com',
      storeId: 'store-1',
      status: 'ACTIVE',
      verifiedAt: new Date(),
      isPrimary: true,
      store: store({
        status: storeStatus,
        seller: { id: 'seller-1', tenantId: 'tenant-1', status: sellerStatus },
      }),
    });

    it('menolak toko berstatus DRAFT', async () => {
      const result = await build({ domains: [withStatus('DRAFT')] }).resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });

    it('menolak toko yang ditangguhkan', async () => {
      const result = await build({ domains: [withStatus('SUSPENDED')] }).resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });

    it('menolak toko yang sellernya ditangguhkan', async () => {
      const result = await build({ domains: [withStatus('PUBLISHED', 'SUSPENDED')] }).resolve(
        'tokojoni.com',
      );
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });

    it('menolak toko yang sellernya belum disetujui', async () => {
      const result = await build({ domains: [withStatus('PUBLISHED', 'PENDING_APPROVAL')] }).resolve(
        'tokojoni.com',
      );
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });

    it('menolak toko yang sudah dihapus', async () => {
      const domain = withStatus('PUBLISHED');
      domain.store.deletedAt = new Date();
      const result = await build({ domains: [domain] }).resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });
  });

  describe('nama schema', () => {
    const verified: DomainFixture = {
      host: 'tokojoni.com',
      storeId: 'store-1',
      status: 'ACTIVE',
      verifiedAt: new Date(),
      isPrimary: true,
      store: store(),
    };

    it('diambil dari registry, bukan diturunkan dari host', async () => {
      // Schema-nya sengaja tidak menyerupai host, membuktikan tidak ada
      // penurunan diam-diam dari nama domain.
      const resolver = build({ domains: [verified], registry: { schemaName: 'abc_xyz_123' } });
      const result = await resolver.resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: true, schemaName: 'abc_xyz_123' });
    });

    it('menolak bila tenant belum diprovision', async () => {
      const resolver = build({ domains: [verified], registry: null });
      const result = await resolver.resolve('tokojoni.com');
      expect(result).toMatchObject({ ok: false, code: 'STORE_UNAVAILABLE' });
    });
  });

  describe('alamat kanonik', () => {
    it('memakai host itu sendiri bila ia domain utama', async () => {
      const resolver = build({
        domains: [
          {
            host: 'tokojoni.com',
            storeId: 'store-1',
            status: 'ACTIVE',
            verifiedAt: new Date(),
            isPrimary: true,
            store: store(),
          },
        ],
      });
      const result = await resolver.resolve('tokojoni.com');
      expect(result).toMatchObject({ canonicalHost: 'tokojoni.com' });
    });

    it('menunjuk domain utama bila diakses lewat domain kedua', async () => {
      // Tanpa ini, mesin pencari melihat katalog yang sama pada dua alamat.
      const primary: DomainFixture = {
        host: 'tokojoni.com',
        storeId: 'store-1',
        status: 'ACTIVE',
        verifiedAt: new Date(),
        isPrimary: true,
        store: store(),
      };
      const alias: DomainFixture = { ...primary, host: 'www.tokojoni.com', isPrimary: false };
      const resolver = build({ domains: [alias, primary] });
      const result = await resolver.resolve('www.tokojoni.com');
      expect(result).toMatchObject({ ok: true, host: 'www.tokojoni.com', canonicalHost: 'tokojoni.com' });
    });
  });

  describe('isolasi antar-tenant', () => {
    it('domain tenant A tidak pernah menghasilkan schema tenant B', async () => {
      const tokoA: DomainFixture = {
        host: 'toko-a.com',
        storeId: 'store-a',
        status: 'ACTIVE',
        verifiedAt: new Date(),
        isPrimary: true,
        store: store({
          id: 'store-a',
          storeSlug: 'toko-a',
          seller: { id: 'seller-a', tenantId: 'tenant-a', status: 'ACTIVE' },
        }),
      };
      const resolver = build({ domains: [tokoA], registry: { schemaName: 'tenant_a' } });
      const result = await resolver.resolve('toko-a.com');
      expect(result).toMatchObject({ ok: true, tenantId: 'tenant-a', schemaName: 'tenant_a' });

      // Host lain yang tidak terdaftar tidak boleh memperoleh konteks apa pun.
      const asing = await resolver.resolve('toko-b.com');
      expect(asing).toMatchObject({ ok: false });
      expect((asing as { tenantId?: string }).tenantId).toBeUndefined();
    });
  });
});
