import { HospitalityBookingEngineController } from './hospitality-booking-engine.controller';

describe('HospitalityBookingEngineController — isolasi tenant publik', () => {
  const booking = {
    cariKetersediaan: jest.fn(),
    pesanPublik: jest.fn(),
    lihatPemesanan: jest.fn(),
    batalkanPemesanan: jest.fn(),
  };
  const situs = { konteks: jest.fn() };
  const controller = new HospitalityBookingEngineController(booking as never, situs as never);

  beforeEach(() => {
    jest.clearAllMocks();
    situs.konteks.mockResolvedValue({
      schemaName: 'tenant_terpercaya',
      propertyId: 'property-1',
      propertyName: 'Hotel Uji',
      timezone: 'Asia/Jakarta',
    });
  });

  it('mengambil schema dan properti dari host terverifikasi saat mencari kamar', async () => {
    booking.cariKetersediaan.mockResolvedValue([]);

    await controller.cari('hotel-uji.mitrainap.id', {
      checkin: '2026-09-10',
      checkout: '2026-09-12',
    });

    expect(situs.konteks).toHaveBeenCalledWith('hotel-uji.mitrainap.id');
    expect(booking.cariKetersediaan).toHaveBeenCalledWith(
      'tenant_terpercaya',
      'property-1',
      expect.objectContaining({ checkin: '2026-09-10', checkout: '2026-09-12' }),
    );
  });

  it('mengabaikan identitas tenant dari pemanggil dan menyuntik properti hasil resolver', async () => {
    booking.pesanPublik.mockResolvedValue({ reservasi: { code: 'RES-1' }, diulang: false });

    await controller.pesan(
      'hotel-uji.mitrainap.id',
      {
        roomTypeId: 'room-type-1',
        checkin: '2026-09-10',
        checkout: '2026-09-12',
        namaLengkap: 'Tamu Uji',
      },
      { idempotencyKey: 'idem-1' } as never,
    );

    expect(booking.pesanPublik).toHaveBeenCalledWith(
      'tenant_terpercaya',
      expect.objectContaining({ propertyId: 'property-1', roomTypeId: 'room-type-1' }),
      'idem-1',
    );
  });
});
