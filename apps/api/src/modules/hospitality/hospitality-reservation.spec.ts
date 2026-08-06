/**
 * Pengujian aturan reservasi dan transisi status (MI-8).
 */

import {
  transisiDiizinkan,
  validasiBatalkan,
  validasiReservasi,
  validasiRoomStay,
} from './hospitality-reservation';

const ROOM_STAY_SAH = {
  roomTypeId: 'rt-1',
  checkinDate: '2026-09-10',
  checkoutDate: '2026-09-12',
  rateAmount: 850000,
};

describe('validasi room stay', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiRoomStay(ROOM_STAY_SAH, 0)).toEqual([]);
  });

  it('checkout harus setelah checkin', () => {
    const galat = validasiRoomStay({ ...ROOM_STAY_SAH, checkinDate: '2026-09-12', checkoutDate: '2026-09-10' }, 0);
    expect(galat.some((g) => g.field === 'roomStays[0].checkoutDate')).toBe(true);
  });

  it('tarif wajib diisi dan tidak boleh negatif', () => {
    expect(validasiRoomStay({ ...ROOM_STAY_SAH, rateAmount: undefined }, 0).some((g) => g.field.endsWith('rateAmount'))).toBe(true);
    expect(validasiRoomStay({ ...ROOM_STAY_SAH, rateAmount: -1 }, 0).some((g) => g.field.endsWith('rateAmount'))).toBe(true);
  });

  it('jumlah dewasa harus bilangan bulat positif bila diisi', () => {
    expect(validasiRoomStay({ ...ROOM_STAY_SAH, adults: 0 }, 0).some((g) => g.field.endsWith('adults'))).toBe(true);
  });

  it('jumlah anak boleh nol tapi tidak boleh negatif', () => {
    expect(validasiRoomStay({ ...ROOM_STAY_SAH, children: 0 }, 0)).toEqual([]);
    expect(validasiRoomStay({ ...ROOM_STAY_SAH, children: -1 }, 0).some((g) => g.field.endsWith('children'))).toBe(true);
  });
});

describe('validasi reservasi', () => {
  const MASUKAN_SAH = {
    propertyId: 'prop-1',
    guestId: 'guest-1',
    roomStays: [ROOM_STAY_SAH],
  };

  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiReservasi(MASUKAN_SAH)).toEqual([]);
  });

  it('properti dan tamu wajib diisi', () => {
    const galat = validasiReservasi({ roomStays: [ROOM_STAY_SAH] });
    expect(galat.map((g) => g.field).sort()).toEqual(['guestId', 'propertyId'].sort());
  });

  it('reservasi wajib punya sekurang-kurangnya satu kamar', () => {
    expect(validasiReservasi({ ...MASUKAN_SAH, roomStays: [] })[0].field).toBe('roomStays');
    expect(validasiReservasi({ propertyId: 'p', guestId: 'g' })[0].field).toBe('roomStays');
  });

  it('galat pada room stay ikut dilaporkan dengan indeks yang benar', () => {
    const galat = validasiReservasi({
      ...MASUKAN_SAH,
      roomStays: [ROOM_STAY_SAH, { ...ROOM_STAY_SAH, rateAmount: -1 }],
    });
    expect(galat.some((g) => g.field === 'roomStays[1].rateAmount')).toBe(true);
  });

  it('sumber reservasi harus dari daftar yang dikenali', () => {
    expect(validasiReservasi({ ...MASUKAN_SAH, source: 'TIKTOK' }).some((g) => g.field === 'source')).toBe(true);
  });

  it('status awal hanya boleh HOLD atau CONFIRMED', () => {
    expect(validasiReservasi({ ...MASUKAN_SAH, statusAwal: 'CANCELLED' }).some((g) => g.field === 'statusAwal')).toBe(true);
    expect(validasiReservasi({ ...MASUKAN_SAH, statusAwal: 'CONFIRMED' })).toEqual([]);
  });
});

describe('validasi batalkan', () => {
  it('alasan wajib diisi', () => {
    expect(validasiBatalkan({})[0].field).toBe('alasan');
  });

  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiBatalkan({ alasan: 'Tamu membatalkan sendiri' })).toEqual([]);
  });
});

describe('transisi status', () => {
  it('HOLD dapat menjadi CONFIRMED atau CANCELLED', () => {
    expect(transisiDiizinkan('HOLD', 'CONFIRMED')).toBe(true);
    expect(transisiDiizinkan('HOLD', 'CANCELLED')).toBe(true);
    expect(transisiDiizinkan('HOLD', 'NO_SHOW')).toBe(false);
  });

  it('CONFIRMED dapat menjadi CANCELLED atau NO_SHOW, tidak kembali ke HOLD', () => {
    expect(transisiDiizinkan('CONFIRMED', 'CANCELLED')).toBe(true);
    expect(transisiDiizinkan('CONFIRMED', 'NO_SHOW')).toBe(true);
    expect(transisiDiizinkan('CONFIRMED', 'HOLD')).toBe(false);
  });

  it('CANCELLED dan NO_SHOW hanya dapat dipulihkan ke CONFIRMED', () => {
    expect(transisiDiizinkan('CANCELLED', 'CONFIRMED')).toBe(true);
    expect(transisiDiizinkan('CANCELLED', 'HOLD')).toBe(false);
    expect(transisiDiizinkan('NO_SHOW', 'CONFIRMED')).toBe(true);
    expect(transisiDiizinkan('NO_SHOW', 'CANCELLED')).toBe(false);
  });

  it('status yang tidak dikenali tidak punya transisi diizinkan', () => {
    expect(transisiDiizinkan('APAPUN', 'CONFIRMED')).toBe(false);
  });
});
