import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { SecretBoxService } from '../../infrastructure/crypto/secret-box.service';
import { CredentialResolverService } from './credential-resolver.service';

const KEY = 'k'.repeat(48);

function secretBox(): SecretBoxService {
  const config = {
    get: (path: string, fallback?: unknown) =>
      path === 'credential.encryptionKeys'
        ? `k1:${KEY}`
        : path === 'credential.activeKeyId'
          ? 'k1'
          : fallback,
  } as unknown as ConfigService;
  const box = new SecretBoxService(config);
  box.onModuleInit();
  return box;
}

interface AccountShape {
  id: string;
  deletedAt: Date | null;
  status: string;
  environment: string;
  merchantId: string | null;
  credentialVersions: Array<{ id: string; fieldCode: string; version: number; ciphertext: string }>;
}

function build(account: AccountShape | null) {
  const accessLogs: Array<{ purpose: string; succeeded: boolean }> = [];
  const prisma = {
    tenantPaymentProviderAccount: {
      findUnique: jest.fn(async () => account),
      findFirst: jest.fn(async () => (account ? { id: account.id } : null)),
    },
    paymentCredentialAccessLog: {
      create: jest.fn(async ({ data }: { data: { purpose: string; succeeded: boolean } }) => {
        accessLogs.push({ purpose: data.purpose, succeeded: data.succeeded });
        return data;
      }),
    },
    paymentProviderCredentialVersion: { findMany: jest.fn(async () => []) },
  } as unknown as PrismaService;

  const box = secretBox();
  return { service: new CredentialResolverService(prisma, box), box, accessLogs, prisma };
}

const CTX = { purpose: 'CREATE_ORDER' as const, actorId: 'user-1', requestId: 'req-1' };

describe('CredentialResolverService', () => {
  describe('penolakan', () => {
    it('menolak akun yang tidak ada', async () => {
      const { service } = build(null);
      await expect(service.resolveForAccount('x', CTX)).rejects.toThrow(/tidak ditemukan/);
    });

    it('menolak akun yang sudah dihapus', async () => {
      const { service } = build({
        id: 'a1', deletedAt: new Date(), status: 'ACTIVE', environment: 'SANDBOX',
        merchantId: null, credentialVersions: [],
      });
      await expect(service.resolveForAccount('a1', CTX)).rejects.toThrow(/tidak ditemukan/);
    });

    it('menolak akun yang belum aktif dan menyebut statusnya', async () => {
      // "Tidak ditemukan" untuk akun yang sebenarnya belum diaktifkan membuat
      // operator mencari di tempat yang salah.
      const { service } = build({
        id: 'a1', deletedAt: null, status: 'AWAITING_CREDENTIAL', environment: 'SANDBOX',
        merchantId: null, credentialVersions: [],
      });
      await expect(service.resolveForAccount('a1', CTX)).rejects.toThrow(/AWAITING_CREDENTIAL/);
    });

    it('menolak akun aktif yang belum punya credential', async () => {
      const { service } = build({
        id: 'a1', deletedAt: null, status: 'ACTIVE', environment: 'SANDBOX',
        merchantId: null, credentialVersions: [],
      });
      await expect(service.resolveForAccount('a1', CTX)).rejects.toThrow(/belum memiliki credential/);
    });
  });

  describe('pembukaan', () => {
    function withSecrets(status = 'ACTIVE') {
      const box = secretBox();
      const merchant = box.seal('merchant-key-rahasia');
      const secret = box.seal('secret-key-rahasia');
      return build({
        id: 'a1', deletedAt: null, status, environment: 'PRODUCTION', merchantId: 'M-001',
        credentialVersions: [
          { id: 'v2', fieldCode: 'SECRET_KEY', version: 1, ciphertext: secret.ciphertext },
          { id: 'v1', fieldCode: 'MERCHANT_KEY', version: 1, ciphertext: merchant.ciphertext },
        ],
      });
    }

    it('mengembalikan nilai yang benar', async () => {
      const { service } = withSecrets();
      const resolved = await service.resolveForAccount('a1', CTX);
      expect(resolved.secrets).toEqual({
        MERCHANT_KEY: 'merchant-key-rahasia',
        SECRET_KEY: 'secret-key-rahasia',
      });
      expect(resolved.environment).toBe('PRODUCTION');
      expect(resolved.merchantId).toBe('M-001');
    });

    it('mengizinkan akun berstatus TESTING agar uji dapat berjalan', async () => {
      const { service } = withSecrets('TESTING');
      await expect(service.resolveForAccount('a1', CTX)).resolves.toBeDefined();
    });

    it('mencatat setiap pembukaan beserta alasannya', async () => {
      const { service, accessLogs } = withSecrets();
      await service.resolveForAccount('a1', CTX);
      expect(accessLogs).toHaveLength(2);
      expect(accessLogs.every((l) => l.purpose === 'CREATE_ORDER' && l.succeeded)).toBe(true);
    });

    it('memakai versi tertinggi untuk setiap field', async () => {
      const box = secretBox();
      const lama = box.seal('nilai-lama');
      const baru = box.seal('nilai-baru');
      const { service } = build({
        id: 'a1', deletedAt: null, status: 'ACTIVE', environment: 'SANDBOX', merchantId: null,
        credentialVersions: [
          // Diurutkan menurun oleh query; yang pertama adalah yang terbaru.
          { id: 'v2', fieldCode: 'SECRET_KEY', version: 2, ciphertext: baru.ciphertext },
          { id: 'v1', fieldCode: 'SECRET_KEY', version: 1, ciphertext: lama.ciphertext },
        ],
      });
      const resolved = await service.resolveForAccount('a1', CTX);
      expect(resolved.secrets.SECRET_KEY).toBe('nilai-baru');
    });
  });

  describe('ciphertext yang tidak dapat dibuka', () => {
    it('mencatat kegagalan lalu menolak dengan pesan yang dapat ditindaklanjuti', async () => {
      const { service, accessLogs } = build({
        id: 'a1', deletedAt: null, status: 'ACTIVE', environment: 'SANDBOX', merchantId: null,
        credentialVersions: [
          { id: 'v1', fieldCode: 'SECRET_KEY', version: 1, ciphertext: 'rusak' },
        ],
      });
      await expect(service.resolveForAccount('a1', CTX)).rejects.toThrow(/Masukkan ulang credential/);
      expect(accessLogs).toEqual([{ purpose: 'CREATE_ORDER', succeeded: false }]);
    });

    it('tidak membocorkan sebab teknis pada pesan ke pemanggil', async () => {
      const { service } = build({
        id: 'a1', deletedAt: null, status: 'ACTIVE', environment: 'SANDBOX', merchantId: null,
        credentialVersions: [
          { id: 'v1', fieldCode: 'SECRET_KEY', version: 1, ciphertext: 'v1.k9.aa.bb.cc' },
        ],
      });
      // Pesan menyebut apa yang harus dilakukan, bukan bagian mana yang cocok.
      await expect(service.resolveForAccount('a1', CTX)).rejects.toThrow(/SECRET_KEY/);
    });
  });

  describe('pencarian berdasarkan tenant', () => {
    it('menolak tenant yang belum punya akun pada environment tersebut', async () => {
      const { service, prisma } = build(null);
      (prisma.tenantPaymentProviderAccount.findFirst as jest.Mock).mockResolvedValueOnce(null);
      await expect(
        service.resolveForTenant('t1', 'ESMARTLINK', 'PRODUCTION' as never, CTX),
      ).rejects.toThrow(/belum memiliki akun ESMARTLINK/);
    });
  });
});
