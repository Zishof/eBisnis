/**
 * Pengujian aturan tagihan pendidikan/SPP.
 */

import { totalTagihan, validasiTagihan } from './pesantren-tagihan';

const SAH = {
  santriId: 'a0000000-0000-0000-0000-000000000001',
  periode: '2026-08',
  jatuhTempo: '2026-08-10',
  items: [{ kode: 'SPP', deskripsi: 'SPP Bulan Agustus', jumlah: 150000 }],
};

describe('validasi tagihan', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiTagihan(SAH)).toEqual([]);
  });

  it('melaporkan seluruh galat sekaligus', () => {
    const galat = validasiTagihan({});
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['items', 'jatuhTempo', 'periode', 'santriId'].sort(),
    );
  });

  it('format periode harus YYYY-MM', () => {
    expect(validasiTagihan({ ...SAH, periode: '08/2026' })[0].code).toBe('TIDAK_SAH');
    expect(validasiTagihan({ ...SAH, periode: '2026-8' })[0].code).toBe('TIDAK_SAH');
  });

  it('format jatuh tempo yang tidak sah ditolak', () => {
    expect(validasiTagihan({ ...SAH, jatuhTempo: 'bukan-tanggal' })[0].code).toBe('TIDAK_SAH');
  });

  it('tagihan tanpa rincian ditolak', () => {
    const galat = validasiTagihan({ ...SAH, items: [] });
    expect(galat.some((g) => g.field === 'items')).toBe(true);
  });

  it('setiap rincian wajib kode, deskripsi, dan jumlah positif', () => {
    const galat = validasiTagihan({ ...SAH, items: [{ jumlah: -1 }] });
    expect(galat.map((g) => g.field).sort()).toEqual(
      ['items[0].deskripsi', 'items[0].jumlah', 'items[0].kode'].sort(),
    );
  });

  it('total tagihan menjumlahkan seluruh rincian', () => {
    expect(
      totalTagihan([
        { kode: 'SPP', deskripsi: 'SPP', jumlah: 150000 },
        { kode: 'ASRAMA', deskripsi: 'Asrama', jumlah: 50000 },
      ]),
    ).toBe(200000);
  });
});
