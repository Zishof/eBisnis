import { HospitalityDomainService } from './hospitality-domain.service';

describe('HospitalityDomainService', () => {
  const create = jest.fn();
  const updateMany = jest.fn();
  const service = new HospitalityDomainService({ verticalSiteDomain: { create, updateMany } } as never);

  beforeEach(() => jest.clearAllMocks());

  it('does not allow managed mitrainap hosts through custom-domain registration', async () => {
    await expect(service.register('tenant', 'hotel.mitrainap.id')).rejects.toMatchObject({ errorCode: 'VALIDATION_FAILED' });
    expect(create).not.toHaveBeenCalled();
  });

  it('stores only a token hash and returns the DNS proof once', async () => {
    create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'domain', host: data.host, status: data.status, verificationRecord: data.verificationRecord, tlsStatus: data.tlsStatus,
    }));
    const result = await service.register('tenant', 'booking.example.com');
    const data = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.verificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(data).not.toHaveProperty('verifyToken');
    expect(result.verificationValue).toMatch(/^mitrainap-verification=/);
    expect(data.verificationTokenHash).not.toContain(result.verificationValue);
  });

  it('activates a custom host only with certificate evidence beyond 24 hours', async () => {
    updateMany.mockResolvedValue({ count: 1 });
    await expect(service.activateTls('domain', 'cert-manager/order/42', new Date(Date.now() + 7 * 86_400_000).toISOString())).resolves.toMatchObject({ active: true });
    expect(updateMany.mock.calls[0][0].where).toMatchObject({ verifiedAt: { not: null }, tlsStatus: 'PENDING_CERTIFICATE' });
    await expect(service.activateTls('domain', 'cert-manager/order/42', new Date().toISOString())).rejects.toMatchObject({ errorCode: 'VALIDATION_FAILED' });
  });
});
