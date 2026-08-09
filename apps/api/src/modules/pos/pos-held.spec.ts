/**
 * Pengujian penyaring dan urutan daftar transaksi tertahan.
 *
 * Yang diputuskan modul ini menentukan keranjang siapa yang terlihat oleh siapa.
 * Kasir yang tidak menemukan keranjangnya akan memindai ulang seluruh barang di
 * depan antrean — dan tidak ada galat yang muncul untuk memberi tahu mengapa.
 */

import {
  BATAS_BARIS_BAWAAN,
  BATAS_BARIS_MAKS,
  type BarisTertahan,
  bersihkanPenyaring,
  tandaiMesinIni,
  urutkanTertahan,
} from './pos-held';

const OUTLET = '11111111-1111-4111-8111-111111111111';
const TERMINAL = '22222222-2222-4222-8222-222222222222';

describe('membersihkan penyaring', () => {
  it('tanpa masukan memberi bawaan yang aman', () => {
    const p = bersihkanPenyaring({});
    expect(p).toEqual({
      dariTanggal: null,
      sampaiTanggal: null,
      kunci: null,
      outletId: null,
      terminalId: null,
      batas: BATAS_BARIS_BAWAAN,
    });
  });

  it('tanggal yang benar diterima', () => {
    const p = bersihkanPenyaring({ from: '2026-08-01', to: '2026-08-10' });
    expect(p.dariTanggal).toBe('2026-08-01');
    expect(p.sampaiTanggal).toBe('2026-08-10');
  });

  it('tanggal yang tidak dapat dibaca DIABAIKAN, bukan menolak halaman', () => {
    /*
     * Layar ini dibuka kasir yang sedang dikejar antrean. Menolak seluruh
     * halaman karena satu tanggal salah ketik lebih buruk daripada menampilkan
     * daftar penuh.
     */
    expect(bersihkanPenyaring({ from: 'kemarin' }).dariTanggal).toBeNull();
    expect(bersihkanPenyaring({ from: '01-08-2026' }).dariTanggal).toBeNull();
  });

  it('tanggal yang bentuknya benar tetapi tidak ada ditolak', () => {
    // 31 Februari lolos pemeriksaan pola, tetapi bukan tanggal.
    expect(bersihkanPenyaring({ from: '2026-02-31' }).dariTanggal).toBeNull();
    expect(bersihkanPenyaring({ from: '2026-13-01' }).dariTanggal).toBeNull();
  });

  it('rentang terbalik DITUKAR, bukan dikosongkan', () => {
    /*
     * Yang dimaksud jelas. Mengosongkannya diam-diam menampilkan seluruh
     * riwayat tanpa ada yang tahu penyaringnya sudah tidak berlaku.
     */
    const p = bersihkanPenyaring({ from: '2026-08-10', to: '2026-08-01' });
    expect(p.dariTanggal).toBe('2026-08-01');
    expect(p.sampaiTanggal).toBe('2026-08-10');
  });

  it('kunci pencarian dirapikan; kosong menjadi null', () => {
    expect(bersihkanPenyaring({ q: '  budi ' }).kunci).toBe('budi');
    expect(bersihkanPenyaring({ q: '   ' }).kunci).toBeNull();
  });

  it('id yang bukan UUID diabaikan', () => {
    expect(bersihkanPenyaring({ outletId: 'outlet-1' }).outletId).toBeNull();
    expect(bersihkanPenyaring({ outletId: OUTLET }).outletId).toBe(OUTLET);
  });

  it('batas baris dijepit', () => {
    // Tanpa batas atas, satu permintaan dapat menarik seluruh riwayat gerai.
    expect(bersihkanPenyaring({ limit: 5 }).batas).toBe(5);
    expect(bersihkanPenyaring({ limit: 100000 }).batas).toBe(BATAS_BARIS_MAKS);
    expect(bersihkanPenyaring({ limit: 0 }).batas).toBe(1);
    expect(bersihkanPenyaring({ limit: -3 }).batas).toBe(1);
    expect(bersihkanPenyaring({ limit: 'banyak' }).batas).toBe(BATAS_BARIS_BAWAAN);
  });
});

function baris(
  ubah: Partial<Omit<BarisTertahan, 'dariMesinIni'>> = {},
): Omit<BarisTertahan, 'dariMesinIni'> {
  return {
    id: 'sale-1',
    receiptNumber: 'ST-0001',
    businessDate: '2026-08-10',
    heldAt: '2026-08-10T03:00:00Z',
    outletId: OUTLET,
    outletName: 'Outlet Central Park',
    terminalId: TERMINAL,
    terminalName: 'Kasir Depan',
    customerName: null,
    currencyCode: 'IDR',
    grandTotal: '125000',
    itemCount: 3,
    ...ubah,
  };
}

describe('menandai mesin ini', () => {
  it('baris dari terminal yang sedang dipakai ditandai', () => {
    const [a, b] = tandaiMesinIni(
      [baris(), baris({ id: 'sale-2', terminalId: 'lain' })],
      TERMINAL,
    );
    expect(a.dariMesinIni).toBe(true);
    expect(b.dariMesinIni).toBe(false);
  });

  it('tanpa terminal aktif, tidak ada yang ditandai', () => {
    // Kasir yang belum membuka shift belum punya mesin; menandai apa pun di
    // situ akan menyesatkan.
    const [a] = tandaiMesinIni([baris()], null);
    expect(a.dariMesinIni).toBe(false);
  });

  it('baris tanpa terminal tidak pernah ditandai', () => {
    const [a] = tandaiMesinIni([baris({ terminalId: null })], null);
    expect(a.dariMesinIni).toBe(false);
  });
});

describe('mengurutkan', () => {
  it('milik mesin ini lebih dahulu', () => {
    /*
     * Keranjang yang paling mungkin dicari adalah yang baru saja ditahan pada
     * mesin yang sama — pembeli yang pergi mengambil satu barang lagi biasanya
     * kembali dalam hitungan menit.
     */
    const hasil = urutkanTertahan(
      tandaiMesinIni(
        [
          baris({ id: 'lain-baru', terminalId: 'lain', heldAt: '2026-08-10T09:00:00Z' }),
          baris({ id: 'ini-lama', heldAt: '2026-08-10T01:00:00Z' }),
        ],
        TERMINAL,
      ),
    );
    expect(hasil.map((b) => b.id)).toEqual(['ini-lama', 'lain-baru']);
  });

  it('di dalam kelompok yang sama, yang paling baru ditahan lebih dahulu', () => {
    const hasil = urutkanTertahan(
      tandaiMesinIni(
        [
          baris({ id: 'lama', heldAt: '2026-08-10T01:00:00Z' }),
          baris({ id: 'baru', heldAt: '2026-08-10T09:00:00Z' }),
        ],
        TERMINAL,
      ),
    );
    expect(hasil.map((b) => b.id)).toEqual(['baru', 'lama']);
  });

  it('waktu tahan yang kosong tidak menaikkan baris ke atas', () => {
    // Baris lama dari migrasi sebelum kolomnya ada. Ia tidak boleh menyalip
    // keranjang yang benar-benar baru ditahan.
    const hasil = urutkanTertahan(
      tandaiMesinIni(
        [
          baris({ id: 'tanpa-waktu', heldAt: null }),
          baris({ id: 'ada-waktu', heldAt: '2026-08-10T01:00:00Z' }),
        ],
        TERMINAL,
      ),
    );
    expect(hasil.map((b) => b.id)).toEqual(['ada-waktu', 'tanpa-waktu']);
  });

  it('tidak mengubah daftar aslinya', () => {
    const asli = tandaiMesinIni([baris({ id: 'a' }), baris({ id: 'b' })], null);
    const salinan = [...asli];
    urutkanTertahan(asli);
    expect(asli).toEqual(salinan);
  });
});
