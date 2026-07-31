import { chunkText } from './knowledge.service';

describe('chunkText', () => {
  it('teks pendek tidak dipotong', () => {
    expect(chunkText('Surat pendek.', 1000, 100)).toEqual(['Surat pendek.']);
  });

  it('teks kosong menghasilkan daftar kosong', () => {
    expect(chunkText('', 1000, 100)).toEqual([]);
    expect(chunkText('   \n  ', 1000, 100)).toEqual([]);
  });

  it('teks panjang dipotong menjadi beberapa bagian', () => {
    const panjang = 'kata '.repeat(1000);
    const potongan = chunkText(panjang, 500, 50);
    expect(potongan.length).toBeGreaterThan(1);
    for (const p of potongan) expect(p.length).toBeLessThanOrEqual(500);
  });

  it('potongan bertumpang tindih supaya kalimat perbatasan tetap utuh', () => {
    /*
     * Kalimat yang jatuh tepat di perbatasan akan terbelah. Tanpa tumpang
     * tindih, jawaban yang bergantung pada kalimat itu selalu kehilangan
     * separuhnya — dan separuh kalimat sering berubah artinya.
     */
    const teks = 'A'.repeat(300) + 'PENANDA-UNIK' + 'B'.repeat(300);
    const potongan = chunkText(teks, 320, 100);
    const yangMemuat = potongan.filter((p) => p.includes('PENANDA-UNIK'));
    expect(yangMemuat.length).toBeGreaterThanOrEqual(1);
  });

  it('memotong pada batas kalimat bila ada di dekat ujungnya', () => {
    const teks = `${'x'.repeat(280)}. ${'y'.repeat(400)}`;
    const potongan = chunkText(teks, 400, 50);
    // Potongan pertama berakhir pada titik, bukan di tengah deretan y.
    expect(potongan[0].endsWith('.')).toBe(true);
  });

  it('TIDAK menggantung ketika tumpang tindih lebih besar daripada ukuran', () => {
    /*
     * Inilah penjagaan yang sempat salah ditulis.
     *
     * Bila `overlap` sama besar atau lebih besar daripada kemajuan satu putaran,
     * `akhir - overlap` tidak lebih besar daripada `mulai`, dan perulangannya
     * tidak pernah maju — menghasilkan potongan yang sama berulang kali sampai
     * memori habis. Diuji dengan nilai yang sengaja tidak masuk akal.
     */
    const potongan = chunkText('z'.repeat(1000), 100, 200);
    expect(potongan.length).toBeLessThan(50);
    expect(potongan.length).toBeGreaterThan(0);
  });

  it('tumpang tindih sama dengan ukuran tetap berhenti', () => {
    const potongan = chunkText('z'.repeat(500), 100, 100);
    expect(potongan.length).toBeLessThan(20);
  });

  it('tumpang tindih nol tetap bekerja', () => {
    const potongan = chunkText('z'.repeat(500), 100, 0);
    expect(potongan.length).toBe(5);
  });

  it('seluruh isi tetap terwakili', () => {
    // Sifat yang paling penting: tidak ada bagian yang hilang.
    const teks = Array.from({ length: 50 }, (_, i) => `bagian${i}`).join(' ');
    const gabung = chunkText(teks, 100, 20).join(' ');
    for (let i = 0; i < 50; i += 1) {
      expect(gabung).toContain(`bagian${i}`);
    }
  });
});
