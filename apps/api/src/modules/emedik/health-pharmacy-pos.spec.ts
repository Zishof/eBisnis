import { HealthPharmacyService } from './health-pharmacy.service';

describe('HealthPharmacyService POS Apotik', () => {
  const audit = { recordAccess: jest.fn() };
  const inventory = {};

  afterEach(() => jest.clearAllMocks());

  it('menolak resep yang belum ditelaah ketika konteks transaksi disimpan', async () => {
    const tenantDb = {
      query: jest.fn()
        .mockResolvedValueOnce([{ status: 'DRAFT' }])
        .mockResolvedValueOnce([{ id: 'rx-1', status: 'PRESCRIBED' }]),
    };
    const service = new HealthPharmacyService(tenantDb as never, audit as never, inventory as never);

    await expect(service.simpanKonteksTransaksiPos(
      'demo',
      'sale-1',
      { mode: 'PRESCRIPTION', prescriptionNumber: 'RX-DEMO-001' },
      'subject-1',
    )).rejects.toThrow('sudah ditelaah');
  });

  it('menolak obat wajib resep pada transaksi OTC', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ transaction_mode: 'OTC', prescription_id: null, prescription_status: null }] })
        .mockResolvedValueOnce({ rows: [{ product_name: 'Amoxicillin 500 mg' }] }),
    };
    const tenantDb = {
      transaction: jest.fn((_schema: string, handler: (db: typeof client) => Promise<unknown>) => handler(client)),
    };
    const service = new HealthPharmacyService(tenantDb as never, audit as never, inventory as never);

    await expect(service.validasiTransaksiPos('demo', 'sale-1'))
      .rejects.toThrow('memerlukan resep');
  });

  it('menyimpan snapshot seluruh komponen racikan sebelum penyelesaian POS', async () => {
    const client = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ transaction_mode: 'COMPOUND', prescription_id: 'rx-1', prescription_status: 'REVIEWED' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const tenantDb = {
      transaction: jest.fn((_schema: string, handler: (db: typeof client) => Promise<unknown>) => handler(client)),
    };
    const service = new HealthPharmacyService(tenantDb as never, audit as never, inventory as never);

    await expect(service.validasiTransaksiPos('demo', 'sale-1'))
      .resolves.toEqual({ saleId: 'sale-1', validated: true });
    expect(client.query.mock.calls[3][0]).toContain('rx_pos_compound_component');
    expect(client.query.mock.calls[4][0]).toContain("workflow_status = 'VALIDATED'");
  });
});
