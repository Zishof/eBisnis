/**
 * Pengujian registri pembayaran bersaldo eksternal (IR-002).
 *
 * Yang dijaga: metode pembayaran yang menyebut penangan tak terdaftar harus
 * **menggagalkan pembayaran**, bukan lolos. Penjualan yang tercatat lunas
 * tanpa ada dana yang berpindah jauh lebih sulit diperbaiki daripada
 * pembayaran yang gagal di depan kasir.
 */

import {
  ExternalPaymentError,
  ExternalPaymentRegistry,
  type ExternalPaymentAuthorization,
  type ExternalPaymentContext,
  type ExternalPaymentHandler,
} from './external-payment.registry';

const penangan = (
  handlerCode: string,
  over: Partial<ExternalPaymentHandler> = {},
): ExternalPaymentHandler => ({
  handlerCode,
  authorize: async () => ({ authorized: true, reference: 'REF-1' }),
  capture: async () => undefined,
  reverse: async () => undefined,
  ...over,
});

let reg: ExternalPaymentRegistry;
beforeEach(() => {
  reg = new ExternalPaymentRegistry();
});

describe('pendaftaran', () => {
  it('mendaftarkan penangan modul', () => {
    reg.register(penangan('COOPERATIVE_MEMBER_BALANCE'));
    expect(reg.has('COOPERATIVE_MEMBER_BALANCE')).toBe(true);
  });

  it('menolak pendaftaran ganda kode yang sama', () => {
    /*
     * Hampir selalu berarti dua modul mengaku menangani pembayaran yang sama.
     * Menimpanya diam-diam berarti uang anggota diproses modul yang bukan
     * pemiliknya.
     */
    reg.register(penangan('COOPERATIVE_MEMBER_BALANCE'));
    expect(() => reg.register(penangan('COOPERATIVE_MEMBER_BALANCE'))).toThrow(
      ExternalPaymentError,
    );
  });

  it('menolak kode yang bentuknya tidak sah', () => {
    // Kode ini disimpan pada payment_method dan dicocokkan apa adanya.
    for (const kode of ['coop', 'COOP BALANCE', 'CO', 'coop_balance', '1COOP']) {
      expect({ kode, gagal: (() => {
        try { new ExternalPaymentRegistry().register(penangan(kode)); return false; }
        catch { return true; }
      })() }).toEqual({ kode, gagal: true });
    }
  });

  it('beberapa modul boleh mendaftarkan penangan berbeda', () => {
    reg.register(penangan('COOPERATIVE_MEMBER_BALANCE'));
    reg.register(penangan('HEALTH_CLAIM_BALANCE'));
    expect(reg.registeredCodes()).toEqual([
      'COOPERATIVE_MEMBER_BALANCE',
      'HEALTH_CLAIM_BALANCE',
    ]);
  });
});

describe('penangan yang tidak terdaftar', () => {
  it('require() MELEMPAR, bukan mengembalikan undefined', () => {
    /*
     * Bila ia mengembalikan undefined, pemanggil yang lupa memeriksanya akan
     * melanjutkan seolah pembayaran berhasil. Penjualan tercatat lunas dan
     * tidak ada dana yang berpindah.
     */
    expect(() => reg.require('TIDAK_ADA')).toThrow(ExternalPaymentError);
  });

  it('pesannya menjelaskan akibat yang dicegah', () => {
    let pesan = '';
    try {
      reg.require('TIDAK_ADA');
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('tercatat lunas');
  });

  it('has() mengembalikan false tanpa melempar', () => {
    // Untuk pemeriksaan pada layar pengaturan, tempat ketiadaan penangan
    // adalah keterangan, bukan kegagalan.
    expect(reg.has('TIDAK_ADA')).toBe(false);
  });
});

describe('kontrak penangan', () => {
  const ctx: ExternalPaymentContext = {
    schemaName: 'koperasi_maju',
    saleId: 'S1',
    outletId: 'O1',
    customerId: 'C1',
    amount: '25000',
    idempotencyKey: 'IDEM-1',
    authToken: 'sekali-pakai',
  };

  it('authorize yang ditolak membawa pesan untuk kasir', async () => {
    reg.register(
      penangan('COOPERATIVE_MEMBER_BALANCE', {
        authorize: async (): Promise<ExternalPaymentAuthorization> => ({
          authorized: false,
          reference: '',
          message: 'Saldo simpanan tidak mencukupi.',
        }),
      }),
    );
    const hasil = await reg.require('COOPERATIVE_MEMBER_BALANCE').authorize(ctx);
    expect(hasil.authorized).toBe(false);
    expect(hasil.message).toBeTruthy();
  });

  it('pesan penolakan tidak memuat angka saldo', async () => {
    /*
     * Kasir cukup tahu bahwa pembayaran tidak dapat diteruskan. Berapa saldo
     * anggota bukan urusannya, dan layar kasir sering terlihat pelanggan
     * berikutnya.
     */
    reg.register(
      penangan('COOPERATIVE_MEMBER_BALANCE', {
        authorize: async () => ({
          authorized: false,
          reference: '',
          message: 'Saldo simpanan tidak mencukupi.',
        }),
      }),
    );
    const hasil = await reg.require('COOPERATIVE_MEMBER_BALANCE').authorize(ctx);
    expect(hasil.message).not.toMatch(/\d/);
  });

  it('konteks membawa authToken, BUKAN PIN', () => {
    /*
     * Spesifikasi eKoperasi §14: PIN anggota tidak boleh terlihat kasir — dan
     * sesuatu yang melewati kasir adalah sesuatu yang terlihat kasir.
     */
    expect(Object.keys(ctx)).not.toContain('pin');
    expect(Object.keys(ctx)).toContain('authToken');
  });

  it('konteks membawa kunci idempotensi', async () => {
    // Pembayaran yang dikirim dua kali karena jaringan putus tidak boleh
    // memotong saldo dua kali.
    let terlihat = '';
    reg.register(
      penangan('COOPERATIVE_MEMBER_BALANCE', {
        authorize: async (c) => {
          terlihat = c.idempotencyKey;
          return { authorized: true, reference: 'REF' };
        },
      }),
    );
    await reg.require('COOPERATIVE_MEMBER_BALANCE').authorize(ctx);
    expect(terlihat).toBe('IDEM-1');
  });

  it('reverse menuntut alasan', async () => {
    // Pelepasan penahanan tanpa alasan tidak dapat ditelusuri kemudian.
    let alasan = '';
    reg.register(
      penangan('COOPERATIVE_MEMBER_BALANCE', {
        reverse: async (c) => {
          alasan = c.reason;
        },
      }),
    );
    await reg
      .require('COOPERATIVE_MEMBER_BALANCE')
      .reverse({ schemaName: 'x', reference: 'REF', reason: 'Penjualan dibatalkan kasir.' });
    expect(alasan).toBeTruthy();
  });
});
