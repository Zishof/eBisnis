/**
 * Pengujian aturan pembayaran bersaldo eksternal (IR-002).
 *
 * Yang dijaga berpusat pada satu keadaan yang tidak boleh terjadi:
 *
 *   **Penjualan tercatat lunas sementara tidak ada dana yang berpindah.**
 *
 * Keadaan itu jauh lebih sulit diperbaiki daripada pembayaran yang gagal di
 * depan kasir — pelanggan sudah pulang membawa barangnya, dan yang tersisa
 * hanyalah baris yang mengatakan semuanya beres.
 */

import {
  EXTERNAL_BALANCE_METHOD,
  bolehDiproses,
  bolehDiselesaikan,
  bolehMemberiKembalian,
  bolehPindahKeadaan,
  perluDilepaskan,
  perluDiwujudkan,
  perluPenangan,
  pesanUntukKasir,
  type BarisPembayaran,
  type MetodePembayaran,
} from './pos-external-payment';

const metode = (over: Partial<MetodePembayaran> = {}): MetodePembayaran => ({
  methodType: EXTERNAL_BALANCE_METHOD,
  externalHandler: 'COOPERATIVE_MEMBER_BALANCE',
  name: 'Saldo Simpanan Anggota',
  ...over,
});

const bayar = (over: Partial<BarisPembayaran> = {}): BarisPembayaran => ({
  id: 'P1',
  externalHandler: 'COOPERATIVE_MEMBER_BALANCE',
  externalReference: 'REF-1',
  externalState: 'AUTHORIZED',
  status: 'RECEIVED',
  ...over,
});

describe('kapan penangan dipanggil', () => {
  it('dipanggil untuk metode bersaldo eksternal', () => {
    expect(perluPenangan(metode())).toBe(true);
  });

  it('TIDAK dipanggil untuk tunai maupun kartu', () => {
    for (const t of ['CASH', 'CARD', 'QR', 'TRANSFER', 'DEPOSIT']) {
      expect({ t, perlu: perluPenangan(metode({ methodType: t })) }).toEqual({ t, perlu: false });
    }
  });

  it('ditentukan jenis metodenya, bukan ada tidaknya penangan', () => {
    /*
     * Membalik urutannya akan membuat metode yang keliru terisi penangannya
     * diam-diam berjalan lewat jalur eksternal — dan jalur itu menahan dana
     * pada modul lain.
     */
    expect(perluPenangan(metode({ methodType: 'CASH' }))).toBe(false);
  });
});

describe('metode yang tidak dapat diproses menggagalkan pembayaran', () => {
  it('metode eksternal tanpa penangan DITOLAK', () => {
    /*
     * Bukan berjalan sebagai tunai. Penjualan yang tercatat lunas tanpa dana
     * yang berpindah jauh lebih sulit diperbaiki daripada pembayaran yang
     * gagal saat pelanggan masih di depan kasir.
     */
    const v = bolehDiproses(metode({ externalHandler: null }), false);
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('HANDLER_NOT_CONFIGURED');
  });

  it('penangan yang tidak terdaftar DITOLAK', () => {
    const v = bolehDiproses(metode(), false);
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('HANDLER_NOT_REGISTERED');
  });

  it('metode eksternal dengan penangan terdaftar diterima', () => {
    expect(bolehDiproses(metode(), true).allowed).toBe(true);
  });

  it('metode biasa tidak terpengaruh registri sama sekali', () => {
    expect(bolehDiproses(metode({ methodType: 'CASH' }), false).allowed).toBe(true);
  });

  it('pesannya menyarankan tindakan yang dapat dikerjakan kasir', () => {
    // Kasir tidak dapat mendaftarkan penangan; yang dapat ia kerjakan adalah
    // memakai metode lain.
    for (const v of [bolehDiproses(metode({ externalHandler: null }), false), bolehDiproses(metode(), false)]) {
      expect(v.message).toContain('metode lain');
    }
  });
});

describe('kembalian', () => {
  it('TIDAK pernah diberikan pada pembayaran bersaldo', () => {
    /*
     * Saldo yang ditahan sebesar nilai transaksi tidak menghasilkan uang tunai
     * di laci; memberi kembalian atasnya berarti mengeluarkan kas untuk dana
     * yang tidak pernah masuk ke laci itu.
     */
    const v = bolehMemberiKembalian(metode());
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('NO_CHANGE_ON_EXTERNAL');
  });

  it('tunai tidak terpengaruh', () => {
    expect(bolehMemberiKembalian(metode({ methodType: 'CASH' })).allowed).toBe(true);
  });
});

describe('penahanan yang harus diwujudkan', () => {
  it('memilih yang sudah tertahan dan belum diwujudkan', () => {
    expect(perluDiwujudkan([bayar()])).toHaveLength(1);
  });

  it('MELEWATI yang sudah diwujudkan', () => {
    // Penyelesaian yang terulang tidak boleh memotong saldo dua kali.
    expect(perluDiwujudkan([bayar({ externalState: 'CAPTURED' })])).toEqual([]);
  });

  it('melewati yang sudah dilepaskan', () => {
    expect(perluDiwujudkan([bayar({ externalState: 'REVERSED' })])).toEqual([]);
  });

  it('melewati pembayaran biasa', () => {
    expect(
      perluDiwujudkan([bayar({ externalHandler: null, externalReference: null, externalState: null })]),
    ).toEqual([]);
  });

  it('melewati pembayaran yang sudah dibatalkan kasir', () => {
    expect(perluDiwujudkan([bayar({ status: 'REVERSED' })])).toEqual([]);
  });

  it('melewati yang tertahan tanpa rujukan — tidak ada yang dapat diwujudkan', () => {
    expect(perluDiwujudkan([bayar({ externalReference: null })])).toEqual([]);
  });
});

describe('penahanan yang harus dilepaskan', () => {
  it('memilih yang masih tertahan', () => {
    expect(perluDilepaskan([bayar()])).toHaveLength(1);
  });

  it('TIDAK melepaskan yang sudah diwujudkan', () => {
    /*
     * Dana yang sudah berpindah dikembalikan lewat retur, yang punya jejaknya
     * sendiri. Melepaskannya diam-diam di sini akan mengembalikan uang tanpa
     * dokumen yang menjelaskannya.
     */
    expect(perluDilepaskan([bayar({ externalState: 'CAPTURED' })])).toEqual([]);
  });

  it('tidak melepaskan dua kali', () => {
    expect(perluDilepaskan([bayar({ externalState: 'REVERSED' })])).toEqual([]);
  });

  it('melepaskan meski pembayarannya sudah dibatalkan kasir', () => {
    // Justru itu keadaan yang paling perlu dilepaskan: kasir membatalkan,
    // dan saldonya masih tertahan.
    expect(perluDilepaskan([bayar({ status: 'REVERSED' })])).toHaveLength(1);
  });
});

describe('penjualan tidak diselesaikan bila penahanannya menggantung', () => {
  it('MENOLAK bila ada pembayaran eksternal tanpa rujukan', () => {
    /*
     * Menyelesaikan penjualan dengan pembayaran yang penahanannya gagal
     * berarti menyerahkan barang tanpa dana apa pun berpindah.
     */
    const v = bolehDiselesaikan([bayar({ externalReference: null, externalState: null })]);
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('EXTERNAL_NOT_AUTHORIZED');
  });

  it('mengizinkan bila seluruhnya sudah tertahan', () => {
    expect(bolehDiselesaikan([bayar()]).allowed).toBe(true);
  });

  it('mengizinkan penjualan tunai biasa', () => {
    expect(
      bolehDiselesaikan([bayar({ externalHandler: null, externalReference: null, externalState: null })])
        .allowed,
    ).toBe(true);
  });

  it('mengabaikan pembayaran yang sudah dibatalkan', () => {
    expect(
      bolehDiselesaikan([bayar({ status: 'REVERSED', externalReference: null })]).allowed,
    ).toBe(true);
  });
});

describe('perpindahan keadaan penahanan', () => {
  it('penahanan baru hanya boleh menjadi AUTHORIZED', () => {
    expect(bolehPindahKeadaan(null, 'AUTHORIZED').allowed).toBe(true);
    expect(bolehPindahKeadaan(null, 'CAPTURED').allowed).toBe(false);
    expect(bolehPindahKeadaan(null, 'REVERSED').allowed).toBe(false);
  });

  it('yang tertahan boleh diwujudkan atau dilepaskan', () => {
    expect(bolehPindahKeadaan('AUTHORIZED', 'CAPTURED').allowed).toBe(true);
    expect(bolehPindahKeadaan('AUTHORIZED', 'REVERSED').allowed).toBe(true);
  });

  it('CAPTURED dan REVERSED bersifat AKHIR', () => {
    /*
     * Keduanya berarti dana bergerak dua kali ke arah yang berlawanan, dan
     * tidak ada catatan yang dapat menjelaskan hasilnya.
     */
    for (const dari of ['CAPTURED', 'REVERSED']) {
      for (const ke of ['AUTHORIZED', 'CAPTURED', 'REVERSED'] as const) {
        expect({ dari, ke, boleh: bolehPindahKeadaan(dari, ke).allowed }).toEqual({
          dari,
          ke,
          boleh: false,
        });
      }
    }
  });

  it('penahanan tidak dapat ditahan dua kali', () => {
    expect(bolehPindahKeadaan('AUTHORIZED', 'AUTHORIZED').allowed).toBe(false);
  });
});

describe('pesan untuk kasir', () => {
  it('memakai pesan penangan bila ada', () => {
    // Penangan yang tahu alasannya dapat menjelaskan lebih baik.
    expect(pesanUntukKasir('Saldo simpanan tidak mencukupi.', 'Saldo')).toBe(
      'Saldo simpanan tidak mencukupi.',
    );
  });

  it('memakai kalimat umum bila penangan diam', () => {
    expect(pesanUntukKasir(undefined, 'Saldo Anggota')).toContain('Saldo Anggota');
  });

  it('menolak pesan kosong', () => {
    expect(pesanUntukKasir('   ', 'Saldo')).toContain('tidak dapat diteruskan');
  });

  it('menolak pesan yang kepanjangan — galat teknis tidak muncul di layar kasir', () => {
    /*
     * Kasir tidak dapat berbuat apa pun dengan jejak tumpukan, dan pelanggan
     * di depannya ikut membacanya.
     */
    const panjang = 'x'.repeat(500);
    expect(pesanUntukKasir(panjang, 'Saldo')).not.toContain(panjang);
  });
});
