/**
 * Pengujian aturan pembayaran memakai saldo simpanan anggota.
 *
 * Dua sifat dijaga paling ketat:
 *
 *   1. **Simpanan pokok dan wajib tidak pernah dapat dibelanjakan.** Keduanya
 *      modal keanggotaan; membiarkannya terpakai di kasir berarti mengizinkan
 *      penarikan lewat pintu belakang.
 *
 *   2. **Bukti persetujuan adalah kredensial pembawa.** Ia dibatasi nilainya,
 *      dibatasi umurnya, terikat gerainya, dan tidak dapat dipakai dua kali.
 */

import {
  UMUR_BUKTI_DETIK,
  bolehDipakaiMembayar,
  bolehMembayar,
  bolehMemakaiBukti,
  bolehMenahan,
  bolehPindahKeadaan,
  keteranganMutasi,
  saldoTersedia,
  sudahSelesai,
  type KeadaanBukti,
  type KeadaanRekening,
  type ProdukSimpanan,
} from './member-balance';

const produk = (over: Partial<ProdukSimpanan> = {}): ProdukSimpanan => ({
  savingKind: 'VOLUNTARY',
  allowsWithdrawal: true,
  isEquity: false,
  name: 'Simpanan Sukarela',
  ...over,
});

const rekening = (over: Partial<KeadaanRekening> = {}): KeadaanRekening => ({
  status: 'ACTIVE',
  balance: '500000',
  heldAmount: '0',
  minimumBalance: '0',
  ...over,
});

const bukti = (over: Partial<KeadaanBukti> = {}): KeadaanBukti => ({
  memberId: 'M1',
  maxAmount: '100000',
  expiresAt: '2026-08-01T10:03:00.000Z',
  usedAt: null,
  outletId: null,
  now: '2026-08-01T10:00:00.000Z',
  ...over,
});

describe('simpanan pokok dan wajib tidak dapat dibelanjakan', () => {
  it('MENOLAK simpanan bertanda ekuitas', () => {
    /*
     * Modal keanggotaan, bukan titipan. Anggota tidak dapat menariknya selama
     * masih menjadi anggota, dan membiarkannya terpakai di kasir berarti
     * mengizinkan penarikan lewat pintu belakang.
     */
    const v = bolehDipakaiMembayar(produk({ isEquity: true, savingKind: 'PRINCIPAL' }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('EQUITY_SAVING');
  });

  it('MENOLAK simpanan yang tidak dapat ditarik', () => {
    expect(bolehDipakaiMembayar(produk({ allowsWithdrawal: false })).code).toBe('NOT_WITHDRAWABLE');
  });

  it('memeriksa KEDUA sifat, bukan salah satunya', () => {
    /*
     * Keduanya seharusnya selalu sejalan — constraint K-3 menegakkannya —
     * tetapi mengandalkan satu berarti bergantung pada constraint yang berlaku
     * di tempat lain.
     */
    expect(bolehDipakaiMembayar(produk({ isEquity: true, allowsWithdrawal: true })).allowed).toBe(false);
    expect(bolehDipakaiMembayar(produk({ isEquity: false, allowsWithdrawal: false })).allowed).toBe(false);
  });

  it('menerima simpanan sukarela', () => {
    expect(bolehDipakaiMembayar(produk()).allowed).toBe(true);
  });

  it('pesannya menyebut nama produknya, supaya kasir dapat menjelaskan', () => {
    expect(bolehDipakaiMembayar(produk({ isEquity: true, name: 'Simpanan Pokok' })).message).toContain(
      'Simpanan Pokok',
    );
  });
});

describe('saldo yang dapat dibelanjakan', () => {
  it('mengurangi penahanan yang masih menggantung', () => {
    /*
     * Mengabaikannya berarti satu saldo dapat dijanjikan kepada dua transaksi
     * sekaligus — dan yang kedua baru gagal saat diwujudkan, ketika barangnya
     * sudah keluar.
     */
    expect(saldoTersedia(rekening({ balance: '500000', heldAmount: '200000' }))).toBe(300000);
  });

  it('mengurangi saldo minimum', () => {
    expect(saldoTersedia(rekening({ balance: '500000', minimumBalance: '50000' }))).toBe(450000);
  });

  it('tidak pernah negatif', () => {
    expect(saldoTersedia(rekening({ balance: '10000', heldAmount: '50000' }))).toBe(0);
  });

  it('nilai yang tidak masuk akal menjadi nol, bukan NaN', () => {
    expect(saldoTersedia(rekening({ balance: 'bukan angka' }))).toBe(0);
  });
});

describe('penahanan', () => {
  it('menolak rekening yang tidak aktif', () => {
    expect(bolehMenahan(rekening({ status: 'CLOSED' }), 1000).code).toBe('ACCOUNT_NOT_ACTIVE');
  });

  it('menolak nilai nol atau negatif', () => {
    expect(bolehMenahan(rekening(), 0).code).toBe('AMOUNT_INVALID');
    expect(bolehMenahan(rekening(), -1).code).toBe('AMOUNT_INVALID');
  });

  it('menolak bila saldo tidak cukup', () => {
    expect(bolehMenahan(rekening({ balance: '5000' }), 10000).code).toBe('INSUFFICIENT_BALANCE');
  });

  it('menolak bila penahanan lain sudah memakai saldonya', () => {
    expect(bolehMenahan(rekening({ balance: '100000', heldAmount: '95000' }), 10000).allowed).toBe(
      false,
    );
  });

  it('pesan saldo tidak cukup TIDAK menyebutkan angkanya', () => {
    /*
     * Layar kasir terlihat pelanggan berikutnya, dan berapa simpanan seorang
     * anggota bukan urusan orang yang kebetulan mengantre di belakangnya.
     */
    const v = bolehMenahan(rekening({ balance: '5000' }), 10000);
    expect(v.message).not.toMatch(/\d/);
  });

  it('menerima pembayaran dalam batas saldo', () => {
    expect(bolehMenahan(rekening(), 100000).allowed).toBe(true);
  });

  it('menerima pembayaran tepat sebesar saldo tersedia', () => {
    expect(bolehMenahan(rekening({ balance: '100000' }), 100000).allowed).toBe(true);
  });
});

describe('bukti persetujuan anggota', () => {
  it('menerima bukti yang sah', () => {
    expect(bolehMemakaiBukti(bukti(), 50000, null).allowed).toBe(true);
  });

  it('menolak bukti yang tidak ditemukan', () => {
    expect(bolehMemakaiBukti(null, 1000, null).code).toBe('TOKEN_NOT_FOUND');
  });

  it('menolak bukti yang SUDAH dipakai', () => {
    // Sekali pakai. Bukti yang dapat dipakai dua kali berarti satu persetujuan
    // anggota membelanjakan saldonya dua kali.
    expect(bolehMemakaiBukti(bukti({ usedAt: '2026-08-01T09:59:00.000Z' }), 1000, null).code).toBe(
      'TOKEN_USED',
    );
  });

  it('menolak bukti yang kedaluwarsa', () => {
    expect(
      bolehMemakaiBukti(bukti({ now: '2026-08-01T10:05:00.000Z' }), 1000, null).code,
    ).toBe('TOKEN_EXPIRED');
  });

  it('menolak nilai yang melebihi yang disetujui anggota', () => {
    /*
     * Anggota menyetujui sebuah jumlah pada layarnya sendiri; kasir tidak
     * dapat menaikkannya setelah itu.
     */
    expect(bolehMemakaiBukti(bukti({ maxAmount: '50000' }), 60000, null).code).toBe(
      'AMOUNT_EXCEEDS_TOKEN',
    );
  });

  it('menerima nilai tepat sebesar yang disetujui', () => {
    expect(bolehMemakaiBukti(bukti({ maxAmount: '50000' }), 50000, null).allowed).toBe(true);
  });

  it('menolak bukti dari gerai lain', () => {
    /*
     * Anggota yang menyetujui pembayaran di toko koperasi tidak sedang
     * menyetujui pembayaran di kantor cabang.
     */
    expect(bolehMemakaiBukti(bukti({ outletId: 'O1' }), 1000, 'O2').code).toBe(
      'TOKEN_WRONG_OUTLET',
    );
  });

  it('bukti tanpa ikatan gerai berlaku di mana saja', () => {
    expect(bolehMemakaiBukti(bukti({ outletId: null }), 1000, 'O2').allowed).toBe(true);
  });

  it('SELURUH penolakan berbunyi sama', () => {
    /*
     * Orang yang mencoba menebak bukti anggota lain tidak boleh memperoleh
     * keterangan dari perbedaan pesannya.
     */
    const kasus = [
      bolehMemakaiBukti(null, 1000, null),
      bolehMemakaiBukti(bukti({ usedAt: '2026-08-01T09:00:00.000Z' }), 1000, null),
      bolehMemakaiBukti(bukti({ now: '2026-08-01T11:00:00.000Z' }), 1000, null),
      bolehMemakaiBukti(bukti({ maxAmount: '10' }), 1000, null),
      bolehMemakaiBukti(bukti({ outletId: 'O1' }), 1000, 'O2'),
    ];
    const pesan = new Set(kasus.map((k) => k.message));
    expect(pesan.size).toBe(1);
  });

  it('umurnya pendek — cukup mengantre, tidak cukup ditinggal', () => {
    expect(UMUR_BUKTI_DETIK).toBeLessThanOrEqual(300);
    expect(UMUR_BUKTI_DETIK).toBeGreaterThanOrEqual(60);
  });
});

describe('keanggotaan', () => {
  it('menolak pelanggan yang bukan anggota', () => {
    expect(bolehMembayar(null, 'K1').code).toBe('NOT_A_MEMBER');
  });

  it('menolak anggota koperasi lain', () => {
    expect(bolehMembayar({ status: 'ACTIVE', cooperativeId: 'K2' }, 'K1').code).toBe(
      'CROSS_COOPERATIVE',
    );
  });

  it('menolak anggota yang dibekukan atau berhenti', () => {
    /*
     * Penarikannya berjalan lewat loket, tempat pengurus dapat memeriksa
     * keadaannya — dan tempat penyelesaian keanggotaan memang diurus.
     */
    for (const s of ['SUSPENDED', 'TERMINATED', 'PROSPECT']) {
      expect({ s, code: bolehMembayar({ status: s, cooperativeId: 'K1' }, 'K1').code }).toEqual({
        s,
        code: 'MEMBERSHIP_NOT_ACTIVE',
      });
    }
  });

  it('menerima anggota aktif', () => {
    expect(bolehMembayar({ status: 'ACTIVE', cooperativeId: 'K1' }, 'K1').allowed).toBe(true);
  });
});

describe('perpindahan keadaan penahanan', () => {
  it('yang tertahan boleh diwujudkan atau dilepaskan', () => {
    expect(bolehPindahKeadaan('AUTHORIZED', 'CAPTURED').allowed).toBe(true);
    expect(bolehPindahKeadaan('AUTHORIZED', 'REVERSED').allowed).toBe(true);
  });

  it('CAPTURED dan REVERSED bersifat akhir', () => {
    expect(bolehPindahKeadaan('CAPTURED', 'REVERSED').code).toBe('HOLD_STATE_FINAL');
    expect(bolehPindahKeadaan('REVERSED', 'CAPTURED').code).toBe('HOLD_STATE_FINAL');
  });

  it('pemanggilan ulang dikenali, bukan diperlakukan sebagai galat', () => {
    /*
     * POS dapat memanggil capture() dua kali bila jaringan putus setelah
     * panggilan pertama berhasil. Pemanggilan kedua harus berakhir dengan
     * keadaan yang sama, bukan menggulung balik transaksi yang sudah benar.
     */
    expect(sudahSelesai('CAPTURED', 'CAPTURED')).toBe(true);
    expect(sudahSelesai('REVERSED', 'REVERSED')).toBe(true);
    expect(sudahSelesai('AUTHORIZED', 'CAPTURED')).toBe(false);
  });
});

describe('keterangan mutasi', () => {
  it('menyebut nomor struk supaya anggota dapat mencocokkannya', () => {
    /*
     * Anggota yang memeriksa mutasinya sebulan kemudian perlu dapat
     * mencocokkannya dengan struk yang ia simpan; tanpa nomor itu, satu-satunya
     * jalan adalah menebak dari tanggal.
     */
    expect(keteranganMutasi('STR-0001', 'Toko Koperasi')).toContain('STR-0001');
    expect(keteranganMutasi('STR-0001', 'Toko Koperasi')).toContain('Toko Koperasi');
  });

  it('tetap dapat dibaca tanpa nomor struk', () => {
    expect(keteranganMutasi(null, null)).toBe('Pembayaran belanja');
  });
});
