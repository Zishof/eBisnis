import { buatRaporPdf } from './pesantren-rapor-pdf';

describe('buatRaporPdf', () => {
  it('membangkitkan buffer PDF dasar untuk rapor', () => {
    const pdf = buatRaporPdf({
      pondok: { nama: 'Pondok Pesantren Contoh', alamat: 'Jl. Pendidikan' },
      santri: { nis: '001', nama: 'Ahmad' },
      tahunAjaran: { nama: '2026/2027' },
      rows: [
        { mata_pelajaran: 'Fikih', nilai_akhir: 88.5, huruf_mutu: 'B' },
        { mata_pelajaran: 'Tahfiz', nilai_akhir: 95, huruf_mutu: 'A' },
      ],
      ringkasan: { jumlahMapel: 2, rataRata: 91.75, predikatDominan: 'A' },
      tanggalCetak: '2026-08-06',
    });

    expect(pdf.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
    expect(pdf.toString('latin1')).toContain('%%EOF');
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
