/**
 * Pengujian aturan settlement jasa.
 *
 * Yang dijaga paling ketat: simulasi tidak pernah dibayarkan, yang sudah
 * dikunci tidak dihapus, pembalikan harus sama besar, dan pernyataan hanya
 * memuat yang benar-benar dibayarkan.
 */

import {
  bolehBayar,
  bolehKoreksi,
  bolehSetujuiKoreksi,
  bolehTerbitkanPernyataan,
  hitungPotonganPajak,
  periksaJumlahBaris,
  susunPernyataan,
  type BarisSettlement,
} from './health-settlement';
import type { StatusSettlement } from './health-fee';

const baris = (over: Partial<BarisSettlement> = {}): BarisSettlement => ({
  recipient: 'DOCTOR_FEE',
  providerId: 'dr-1',
  grossAmount: 1000000,
  taxAmount: 0,
  netAmount: 1000000,
  ...over,
});

const settlement = (over: Record<string, unknown> = {}) => ({
  grossAmount: 1000000,
  taxAmount: 100000,
  netAmount: 900000,
  isSimulation: false,
  status: 'PAID' as StatusSettlement,
  ...over,
});

describe('jumlah baris settlement', () => {
  it('baris yang jumlahnya cocok diterima', () => {
    expect(
      periksaJumlahBaris({
        settledAmount: 1000000,
        lines: [baris({ grossAmount: 400000, netAmount: 400000 }), baris({ grossAmount: 600000, netAmount: 600000 })],
      }).valid,
    ).toBe(true);
  });

  it('selisih satu rupiah pun DILAPORKAN', () => {
    /*
     * Settlement yang jumlahnya tidak cocok akan tetap dibayarkan, dan
     * selisihnya menjadi milik siapa pun yang menemukannya lebih dahulu.
     */
    const h = periksaJumlahBaris({
      settledAmount: 1000000,
      lines: [baris({ grossAmount: 999999, netAmount: 999999 })],
    });
    expect(h.valid).toBe(false);
    expect(h.difference).toBe(1);
  });

  it('settlement tanpa baris ditolak', () => {
    const h = periksaJumlahBaris({ settledAmount: 0, lines: [] });
    expect(h.valid).toBe(false);
    expect(h.message).toContain('tidak membayar siapa pun');
  });

  it('nilai bersih yang tidak sama dengan kotor dikurangi pajak DITOLAK', () => {
    // Nilai bersih dihitung, bukan diketik.
    const h = periksaJumlahBaris({
      settledAmount: 1000000,
      lines: [baris({ grossAmount: 1000000, taxAmount: 100000, netAmount: 950000 })],
    });
    expect(h.valid).toBe(false);
    expect(h.message).toContain('bukan diketik');
  });

  it('potongan pajak yang melebihi nilai kotornya ditolak', () => {
    const h = periksaJumlahBaris({
      settledAmount: 1000,
      lines: [baris({ grossAmount: 1000, taxAmount: 2000, netAmount: 0 })],
    });
    expect(h.valid).toBe(false);
    expect(h.message).toContain('melebihi nilai kotornya');
  });

  it('nilai negatif ditolak', () => {
    expect(
      periksaJumlahBaris({
        settledAmount: -1,
        lines: [baris({ grossAmount: -1, netAmount: -1 })],
      }).valid,
    ).toBe(false);
  });

  it('pajak dihitung terhadap nilai kotor, bukan terhadap totalnya', () => {
    const h = periksaJumlahBaris({
      settledAmount: 1000000,
      lines: [
        baris({ grossAmount: 400000, taxAmount: 40000, netAmount: 360000 }),
        baris({ grossAmount: 600000, taxAmount: 0, netAmount: 600000 }),
      ],
    });
    expect(h.valid).toBe(true);
  });
});

describe('pembayaran', () => {
  it('settlement terkunci boleh dibayarkan', () => {
    expect(bolehBayar({ isSimulation: false, status: 'LOCKED' }).allowed).toBe(true);
  });

  it('SIMULASI tidak pernah dibayarkan, sekalipun statusnya sudah terkunci', () => {
    /*
     * Simulasi yang dapat berubah menjadi settlement hanya dengan menekan
     * tombol akan berubah ketika seseorang salah menekan tombol.
     */
    const h = bolehBayar({ isSimulation: true, status: 'LOCKED' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('salah menekan tombol');
  });

  it('yang belum dikunci tidak dibayarkan', () => {
    expect(bolehBayar({ isSimulation: false, status: 'APPROVED' }).allowed).toBe(false);
  });

  it('yang sudah dibayarkan tidak dibayarkan lagi', () => {
    expect(bolehBayar({ isSimulation: false, status: 'PAID' }).allowed).toBe(false);
  });
});

describe('koreksi', () => {
  const dasar = {
    originalAmount: 1000000,
    alreadyCorrected: 0,
    reason: 'Klaim disetujui kurang dari yang diajukan; nomor berkas 123.',
    status: 'PAID' as StatusSettlement,
  };

  it('penyesuaian sebagian diterima', () => {
    const h = bolehKoreksi({ ...dasar, type: 'ADJUSTMENT', correctionAmount: 300000 });
    expect(h.allowed).toBe(true);
    expect(h.resultingAmount).toBe(700000);
  });

  it('pembalikan wajib SAMA BESAR dengan yang tersisa', () => {
    /*
     * Pembalikan sebagian yang menyamar sebagai pembalikan penuh akan
     * menyisakan selisih yang ditemukan setahun kemudian.
     */
    const h = bolehKoreksi({ ...dasar, type: 'REVERSAL', correctionAmount: 300000 });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('setahun kemudian');
  });

  it('pembalikan penuh diterima dan menyisakan nol', () => {
    const h = bolehKoreksi({ ...dasar, type: 'REVERSAL', correctionAmount: 1000000 });
    expect(h.allowed).toBe(true);
    expect(h.resultingAmount).toBe(0);
  });

  it('pembalikan setelah penyesuaian memperhitungkan yang tersisa', () => {
    const h = bolehKoreksi({
      ...dasar,
      alreadyCorrected: 300000,
      type: 'REVERSAL',
      correctionAmount: 700000,
    });
    expect(h.allowed).toBe(true);
  });

  it('penyesuaian yang membuat nilainya NEGATIF ditolak', () => {
    // Settlement yang berakhir negatif berarti rumah sakit menagih kembali
    // kepada dokter, dan itu keputusan tersendiri.
    const h = bolehKoreksi({ ...dasar, type: 'ADJUSTMENT', correctionAmount: 1500000 });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('menagih kembali kepada dokter');
  });

  it('koreksi tanpa alasan yang bermakna DITOLAK', () => {
    const h = bolehKoreksi({
      ...dasar,
      type: 'ADJUSTMENT',
      correctionAmount: 100,
      reason: 'salah',
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('bukan orang yang mengubahnya');
  });

  it('koreksi atas settlement yang BELUM dikunci ditolak', () => {
    const h = bolehKoreksi({
      ...dasar,
      status: 'CALCULATED',
      type: 'ADJUSTMENT',
      correctionAmount: 100000,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('masih dapat dihitung ulang');
  });

  it('koreksi bernilai nol atau negatif ditolak', () => {
    expect(bolehKoreksi({ ...dasar, type: 'ADJUSTMENT', correctionAmount: 0 }).allowed).toBe(false);
    expect(bolehKoreksi({ ...dasar, type: 'ADJUSTMENT', correctionAmount: -5 }).allowed).toBe(false);
  });

  it('koreksi atas settlement yang sudah dinyatakan tetap boleh', () => {
    // Justru di sanalah koreksi paling sering dibutuhkan.
    expect(
      bolehKoreksi({ ...dasar, status: 'STATED', type: 'ADJUSTMENT', correctionAmount: 1000 })
        .allowed,
    ).toBe(true);
  });
});

describe('persetujuan koreksi', () => {
  it('disetujui orang kedua', () => {
    expect(bolehSetujuiKoreksi({ createdBy: 'a', approverId: 'b' }).allowed).toBe(true);
  });

  it('yang membuat koreksi TIDAK menyetujuinya sendiri', () => {
    const h = bolehSetujuiKoreksi({ createdBy: 'a', approverId: 'a' });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('terlihat seperti pembetulan');
  });
});

describe('pernyataan', () => {
  it('memuat yang sudah dibayarkan', () => {
    const h = susunPernyataan({ providerId: 'dr-1', settlements: [settlement()] });
    expect(h.statement.netAmount).toBe(900000);
    expect(h.statement.settlementCount).toBe(1);
  });

  it('SIMULASI tidak masuk pernyataan', () => {
    // Pernyataan yang memuat angka yang belum tentu dibayarkan akan dibaca
    // sebagai janji.
    const h = susunPernyataan({
      providerId: 'dr-1',
      settlements: [settlement({ isSimulation: true })],
    });
    expect(h.statement.settlementCount).toBe(0);
    expect(h.excluded).toBe(1);
    expect(h.message).toContain('dibaca sebagai janji');
  });

  it('yang belum dibayarkan tidak masuk pernyataan', () => {
    const h = susunPernyataan({
      providerId: 'dr-1',
      settlements: [settlement({ status: 'LOCKED' })],
    });
    expect(h.statement.settlementCount).toBe(0);
  });

  it('nilai kotor, pajak, dan bersih dinyatakan KETIGANYA', () => {
    /*
     * Pernyataan yang hanya menyebut nilai bersih akan ditanyakan setiap bulan;
     * yang hanya menyebut kotor membuat penerimanya mengira ia dibayar kurang.
     */
    const h = susunPernyataan({ providerId: 'dr-1', settlements: [settlement()] });
    expect(h.statement.grossAmount).toBe(1000000);
    expect(h.statement.taxAmount).toBe(100000);
    expect(h.statement.netAmount).toBe(900000);
  });

  it('koreksi mengurangi nilai bersihnya dan dinyatakan tersendiri', () => {
    const h = susunPernyataan({
      providerId: 'dr-1',
      settlements: [settlement()],
      corrections: [{ amount: 200000 }],
    });
    expect(h.statement.adjustmentAmount).toBe(200000);
    expect(h.statement.netAmount).toBe(700000);
  });

  it('beberapa settlement dijumlahkan', () => {
    const h = susunPernyataan({
      providerId: 'dr-1',
      settlements: [settlement(), settlement({ status: 'STATED' })],
    });
    expect(h.statement.settlementCount).toBe(2);
    expect(h.statement.netAmount).toBe(1800000);
  });

  it('penerima tanpa settlement menghasilkan pernyataan nol, bukan galat', () => {
    const h = susunPernyataan({ providerId: 'dr-1', settlements: [] });
    expect(h.statement.netAmount).toBe(0);
  });
});

describe('penerbitan pernyataan', () => {
  it('pernyataan pertama diterbitkan', () => {
    expect(
      bolehTerbitkanPernyataan({ alreadyIssued: false, netAmount: 900000, isCorrection: false })
        .allowed,
    ).toBe(true);
  });

  it('menerbitkan ulang dengan angka berbeda DITOLAK', () => {
    /*
     * Yang dipegang penerimanya harus dua kertas, bukan satu kertas yang
     * diam-diam berganti isi.
     */
    const h = bolehTerbitkanPernyataan({
      alreadyIssued: true,
      previousNetAmount: 900000,
      netAmount: 800000,
      isCorrection: false,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('dua kertas');
  });

  it('pernyataan koreksi diterima bila menunjuk yang dikoreksinya', () => {
    expect(
      bolehTerbitkanPernyataan({
        alreadyIssued: true,
        previousNetAmount: 900000,
        netAmount: 800000,
        isCorrection: true,
        correctsStatementId: 'stmt-1',
      }).allowed,
    ).toBe(true);
  });

  it('pernyataan koreksi tanpa penunjuk ditolak', () => {
    expect(
      bolehTerbitkanPernyataan({
        alreadyIssued: true,
        netAmount: 800000,
        isCorrection: true,
      }).allowed,
    ).toBe(false);
  });

  it('pernyataan bernilai NEGATIF ditolak', () => {
    const h = bolehTerbitkanPernyataan({
      alreadyIssued: false,
      netAmount: -1,
      isCorrection: false,
    });
    expect(h.allowed).toBe(false);
    expect(h.message).toContain('berutang kepada rumah sakit');
  });

  it('pernyataan bernilai nol diterima', () => {
    expect(
      bolehTerbitkanPernyataan({ alreadyIssued: false, netAmount: 0, isCorrection: false }).allowed,
    ).toBe(true);
  });
});

describe('potongan pajak', () => {
  it('dihitung menurut tarif yang diberikan', () => {
    const h = hitungPotonganPajak({ grossAmount: 1000000, taxRatePercent: 5 });
    expect(h.taxAmount).toBe(50000);
    expect(h.netAmount).toBe(950000);
  });

  it('pembulatannya MEMIHAK PENERIMA', () => {
    /*
     * Potongan dibulatkan ke bawah, sehingga sisa satu rupiah tetap menjadi hak
     * penerimanya.
     */
    const h = hitungPotonganPajak({ grossAmount: 1001, taxRatePercent: 50 });
    expect(h.taxAmount).toBe(500);
    expect(h.netAmount).toBe(501);
  });

  it('tarif nol tidak memotong apa pun', () => {
    const h = hitungPotonganPajak({ grossAmount: 1000000, taxRatePercent: 0 });
    expect(h.taxAmount).toBe(0);
    expect(h.message).toContain('Tidak ada potongan');
  });

  it('tarif seratus persen memotong seluruhnya', () => {
    expect(hitungPotonganPajak({ grossAmount: 1000, taxRatePercent: 100 }).netAmount).toBe(0);
  });

  it('nilai kotor negatif ditolak', () => {
    expect(() => hitungPotonganPajak({ grossAmount: -1, taxRatePercent: 5 })).toThrow();
  });

  it('tarif di luar 0-100 ditolak', () => {
    expect(() => hitungPotonganPajak({ grossAmount: 1000, taxRatePercent: 101 })).toThrow();
    expect(() => hitungPotonganPajak({ grossAmount: 1000, taxRatePercent: -1 })).toThrow();
  });

  it('tidak ada tarif pajak bawaan di dalam kode', () => {
    // Tarif pajak berubah lewat peraturan, dan peraturan tidak menunggu
    // penerbitan versi aplikasi.
    const nol = hitungPotonganPajak({ grossAmount: 1000000, taxRatePercent: 0 });
    expect(nol.taxAmount).toBe(0);
  });
});
