/**
 * Pengujian kontrak terhadap vertikal lain.
 *
 * Dua hal dijaga, dan keduanya adalah aturan yang tertulis pada dokumen D-0
 * yang akan dilanggar suatu hari oleh orang yang belum pernah membacanya:
 *
 * 1. **Tidak ada metode terlarang.** Larangan membaca rekam medis, saldo
 *    simpanan, dan tunggakan ditegakkan dengan tidak menyediakan metodenya.
 *    Pengujian ini menggagalkan berkasnya pada hari metode itu ditambahkan.
 * 2. **Adapter tiruan tidak mengarang data.** Ia menyatakan "belum tersambung"
 *    dengan jujur, dan tidak seorang pun dapat memperlakukan hasilnya sebagai
 *    "tidak ada data".
 */

import { METODE_SAH, METODE_TERLARANG } from './external.ports';
import {
  CooperativeUnavailableAdapter,
  HealthUnavailableAdapter,
  MarketplaceUnavailableAdapter,
  PosUnavailableAdapter,
} from './unavailable.adapter';

const port = {
  HEALTH: new HealthUnavailableAdapter(),
  COOPERATIVE: new CooperativeUnavailableAdapter(),
  POS: new PosUnavailableAdapter(),
  MARKETPLACE: new MarketplaceUnavailableAdapter(),
} as const;

function metodeMilik(obj: object): string[] {
  return Object.getOwnPropertyNames(Object.getPrototypeOf(obj)).filter(
    (n) => n !== 'constructor' && typeof (obj as Record<string, unknown>)[n] === 'function',
  );
}

describe('permukaan kontrak', () => {
  it.each(Object.keys(METODE_SAH) as Array<keyof typeof METODE_SAH>)(
    'port %s hanya memiliki metode yang ada pada daftar sahnya',
    (nama) => {
      expect(metodeMilik(port[nama]).sort()).toEqual([...METODE_SAH[nama]].sort());
    },
  );

  it('tidak satu port pun memiliki metode terlarang', () => {
    for (const nama of Object.keys(METODE_SAH) as Array<keyof typeof METODE_SAH>) {
      const punya = metodeMilik(port[nama]);
      for (const terlarang of METODE_TERLARANG) {
        expect(punya).not.toContain(terlarang);
      }
    }
  });

  it('daftar metode sah tidak beririsan dengan daftar terlarang', () => {
    const sah = Object.values(METODE_SAH).flat() as string[];
    for (const t of METODE_TERLARANG) expect(sah).not.toContain(t);
  });

  it('daftar terlarang memuat yang paling mungkin diminta kelak', () => {
    // Bukan uji sepele: daftar yang menyusut diam-diam adalah cara larangan ini
    // hilang tanpa seorang pun memutuskannya.
    for (const wajib of [
      'medicalRecord',
      'diagnosis',
      'savingsBalance',
      'loanHistory',
      'createListing',
      'adjustStock',
    ]) {
      expect(METODE_TERLARANG as readonly string[]).toContain(wajib);
    }
  });
});

describe('adapter belum tersedia', () => {
  it('eMedik menyatakan belum tersambung, bukan mengembalikan jadwal karangan', async () => {
    const h = await port.HEALTH.jadwalPosyandu();
    expect(h.tersedia).toBe(false);
    expect(h.data).toEqual([]);
    expect(h.keterangan).toContain('belum dapat dibaca');
  });

  it('indikator kesehatan kosong disertai pernyataan ketersediaan', async () => {
    const h = await port.HEALTH.indikatorAgregat();
    expect(h.tersedia).toBe(false);
    expect(h.data).toEqual([]);
  });

  it('cacah sasaran nol tidak berdiri sendiri tanpa keterangan', async () => {
    const h = await port.HEALTH.cacahSasaran();
    expect(h.tersedia).toBe(false);
    expect(h.data).toEqual({ total: 0, reached: 0 });
    expect(h.keterangan).toBeTruthy();
  });

  it('eKoperasi menyatakan belum tersambung, bukan "tidak ada koperasi"', async () => {
    const h = await port.COOPERATIVE.koperasiDiDesa();
    expect(h.tersedia).toBe(false);
    expect(h.data).toEqual([]);
  });

  it('apakahAnggota yang tidak tersedia tidak boleh dibaca sebagai "bukan anggota"', async () => {
    const h = await port.COOPERATIVE.apakahAnggota();
    expect(h.tersedia).toBe(false);
    // Nilainya memang false, dan justru karena itu `tersedia` wajib diperiksa
    // pemanggilnya: pemeriksaan bantuan ganda yang mengabaikannya akan
    // meloloskan penerima ganda persis ketika sistemnya sedang tidak dapat
    // memeriksa.
    expect(h.data.isMember).toBe(false);
    expect(h.keterangan).toBeTruthy();
  });

  it('POS menyatakan belum tersambung, bukan penjualan nol', async () => {
    const h = await port.POS.ringkasanPenjualan();
    expect(h.tersedia).toBe(false);
    expect(h.data.grossSales).toBe('0');
    expect(h.keterangan).toBeTruthy();
  });

  it('penautan unit usaha ke outlet POS mengembalikan linked salah', async () => {
    const h = await port.POS.tautkanUnitUsaha();
    expect(h.tersedia).toBe(false);
    expect(h.data.linked).toBe(false);
  });

  it('marketplace mengembalikan null, bukan listing karangan', async () => {
    const h = await port.MARKETPLACE.periksaListing();
    expect(h.tersedia).toBe(false);
    expect(h.data).toBeNull();
  });

  it('seluruh metode seluruh adapter menyatakan tersedia salah beserta keterangannya', async () => {
    for (const nama of Object.keys(METODE_SAH) as Array<keyof typeof METODE_SAH>) {
      const p = port[nama] as unknown as Record<string, () => Promise<{ tersedia: boolean; keterangan?: string }>>;
      for (const metode of METODE_SAH[nama]) {
        const h = await p[metode]();
        expect(h.tersedia).toBe(false);
        expect(typeof h.keterangan).toBe('string');
        expect(h.keterangan!.length).toBeGreaterThan(10);
      }
    }
  });
});
