import { amountMatches, isSuccessStatus } from './marketplace-payment.service';

describe('penilaian status pembayaran', () => {
  describe('status yang dianggap lunas', () => {
    it.each(['PAID', 'SUCCESS', 'SETTLEMENT', 'COMPLETED'])('menerima %s', (status) => {
      expect(isSuccessStatus(status)).toBe(true);
    });

    it('tidak peduli huruf besar kecil', () => {
      expect(isSuccessStatus('paid')).toBe(true);
      expect(isSuccessStatus('Settlement')).toBe(true);
    });
  });

  describe('status yang tidak dianggap lunas', () => {
    it.each(['PENDING', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUND', 'DENY', ''])(
      'menolak %p',
      (status) => {
        expect(isSuccessStatus(status)).toBe(false);
      },
    );

    it('menolak status yang tidak dikenal alih-alih menebak', () => {
      // Status baru dari penyedia tidak boleh diterima sebagai lunas hanya
      // karena bunyinya mirip. Yang tidak dikenal ditolak sampai dipetakan
      // dengan sengaja.
      expect(isSuccessStatus('BERHASIL')).toBe(false);
      expect(isSuccessStatus('SUCCESSFUL')).toBe(false);
      expect(isSuccessStatus('PAID_PARTIAL')).toBe(false);
    });
  });
});

describe('pencocokan jumlah', () => {
  it('menerima jumlah yang sama persis', () => {
    expect(amountMatches(258000, 258000)).toBe(true);
  });

  it('menolak kekurangan sekecil apa pun', () => {
    // Menerima kekurangan berarti barang dikirim tanpa dibayar penuh.
    expect(amountMatches(257999, 258000)).toBe(false);
    expect(amountMatches(1, 258000)).toBe(false);
  });

  it('menolak kelebihan', () => {
    // Menerima kelebihan berarti utang kepada pembeli yang tidak tercatat.
    expect(amountMatches(258001, 258000)).toBe(false);
    expect(amountMatches(999999, 258000)).toBe(false);
  });

  it('membulatkan ke rupiah utuh sebelum membandingkan', () => {
    // Penyedia dapat mengirim "258000.00"; pembulatan membuat keduanya sama.
    expect(amountMatches(258000.4, 258000)).toBe(true);
    expect(amountMatches(258000, 257999.6)).toBe(true);
  });

  it('menolak nol terhadap tagihan yang ada isinya', () => {
    expect(amountMatches(0, 258000)).toBe(false);
  });

  it('menolak nilai negatif', () => {
    expect(amountMatches(-258000, 258000)).toBe(false);
  });
});
