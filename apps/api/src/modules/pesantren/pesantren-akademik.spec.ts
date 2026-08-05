import { validasiAlasanPembatalanKeputusan, validasiKeputusanAkademik } from './pesantren-akademik';

describe('validasi keputusan akademik', () => {
  it('menerima keputusan naik kelas dengan rombongan tujuan', () => {
    expect(
      validasiKeputusanAkademik({
        santriId: 'santri-1',
        tahunAjaranAsalId: 'ta-1',
        jenis: 'NAIK_KELAS',
        rombonganTujuanId: 'rombel-2',
        tanggalKeputusan: '2026-06-30',
      }),
    ).toEqual([]);
  });

  it('mewajibkan rombongan tujuan untuk kenaikan atau tinggal kelas', () => {
    expect(
      validasiKeputusanAkademik({ santriId: 'santri-1', tahunAjaranAsalId: 'ta-1', jenis: 'TINGGAL_KELAS' }).some(
        (g) => g.field === 'rombonganTujuanId',
      ),
    ).toBe(true);
  });

  it('menolak kelulusan yang masih membawa rombongan tujuan', () => {
    expect(
      validasiKeputusanAkademik({
        santriId: 'santri-1',
        tahunAjaranAsalId: 'ta-1',
        jenis: 'LULUS',
        rombonganTujuanId: 'rombel-2',
      }).some((g) => g.field === 'rombonganTujuanId'),
    ).toBe(true);
  });

  it('memvalidasi alasan pembatalan', () => {
    expect(validasiAlasanPembatalanKeputusan('koreksi keputusan rapat')).toEqual([]);
    expect(validasiAlasanPembatalanKeputusan('pendek')[0]?.code).toBe('TERLALU_PENDEK');
  });
});
