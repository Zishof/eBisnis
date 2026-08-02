/**
 * Pengujian aturan kartu RFID/QR santri.
 */

import { validasiKartu } from './pesantren-kartu';

describe('validasi kartu', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiKartu({ santriId: 'a', nomorKartu: 'RFID-001', jenis: 'RFID' })).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    expect(validasiKartu({}).map((g) => g.field).sort()).toEqual(['jenis', 'nomorKartu', 'santriId'].sort());
  });

  it('jenis hanya dari daftar yang dikenali', () => {
    expect(validasiKartu({ santriId: 'a', nomorKartu: '1', jenis: 'NFC' })[0].code).toBe('TIDAK_DIKENALI');
  });
});
