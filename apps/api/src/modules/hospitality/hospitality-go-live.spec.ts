import { HospitalityGoLiveService } from './hospitality-go-live.service';

describe('HospitalityGoLiveService', () => {
  const query = jest.fn();
  const transaction = jest.fn();
  const service = new HospitalityGoLiveService({ query, transaction } as never);

  beforeEach(() => jest.clearAllMocks());

  it('fails closed for a payment provider without a verified adapter and keeps card data out of persistence', async () => {
    query.mockResolvedValue([{ request_hash: 'placeholder' }]);
    await expect(service.createPaymentIntent('tenant_x', '11111111-1111-1111-1111-111111111111', {
      providerKey: 'unknown-live-provider', idempotencyKey: 'pay-1', amount: 125000,
      cardNumber: '4111111111111111', cvv: '123',
    })).rejects.toMatchObject({ errorCode: 'CONFLICT' });
    const parameters = query.mock.calls[0][2] as unknown[];
    expect(parameters).not.toContain('4111111111111111');
    expect(parameters).not.toContain('123');
    expect(parameters).toContain('BLOCKED_PROVIDER_INPUT');
  });

  it('returns an existing idempotent payment only when the request hash is identical', async () => {
    query.mockImplementation(async (_schema: string, _sql: string, parameters: unknown[]) => [{
      request_hash: parameters[3], status: 'PENDING', provider_key: 'TEST', amount: '125000', currency: 'IDR',
    }]);
    const result = await service.createPaymentIntent('tenant_x', '11111111-1111-1111-1111-111111111111', {
      providerKey: 'TEST', idempotencyKey: 'pay-1', amount: 125000,
    });
    expect(result).toMatchObject({ status: 'PENDING', provider_key: 'TEST' });
  });

  it('rejects invalid inventory ranges before opening a transaction', async () => {
    await expect(service.reconcileInventory('tenant_x', 'property', {
      roomTypeId: 'room-type', startDate: '2026-08-12', endDate: '2026-08-12',
    }, 'actor')).rejects.toMatchObject({ errorCode: 'VALIDATION_FAILED' });
    expect(transaction).not.toHaveBeenCalled();
  });
});
