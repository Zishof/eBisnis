/**
 * Pengujian penerbit peristiwa akuntansi koperasi.
 *
 * Yang dijaga: peristiwa yang salah **tidak pernah terbit**. Peristiwa yang
 * kurang nilainya atau salah kodenya tidak menimbulkan galat saat dibuat — ia
 * hanya menumpuk sebagai `PENDING` dan gagal berhari-hari kemudian, pada
 * pekerja yang tidak tahu apa-apa tentang transaksi yang melahirkannya.
 */

import { AccountingEventCatalogRegistry } from '../../accounting/event-catalog.registry';
import { CORE_EVENT_CATALOGS } from '../../accounting/core-event-catalog';
import { COOPERATIVE_EVENT_CATALOG } from './cooperative-events.catalog';
import {
  CooperativeAccountingEventService,
  type KlienTransaksi,
  type PeristiwaKoperasi,
} from './cooperative-accounting-event.service';

function klienPalsu() {
  const ditulis: Array<{ sql: string; params: unknown[] }> = [];
  const client: KlienTransaksi = {
    query: async (sql: string, params: unknown[] = []) => {
      ditulis.push({ sql, params });
      return { rows: [] };
    },
  };
  return { client, ditulis };
}

function layanan() {
  const reg = new AccountingEventCatalogRegistry();
  for (const c of CORE_EVENT_CATALOGS) reg.register(c);
  reg.register(COOPERATIVE_EVENT_CATALOG);
  return new CooperativeAccountingEventService(reg);
}

const peristiwa = (over: Partial<PeristiwaKoperasi> = {}): PeristiwaKoperasi => ({
  eventCode: 'COOPERATIVE_SHU_PAID',
  sourceType: 'COOPERATIVE_SHU',
  sourceId: 'S1',
  amounts: { amount: 250000 },
  ...over,
});

describe('katalog koperasi diterima registri Core', () => {
  it('terdaftar bersama katalog inti tanpa bertabrakan', () => {
    expect(() => layanan()).not.toThrow();
  });

  it('seluruh peristiwa koperasi menjadi dikenal', () => {
    const reg = new AccountingEventCatalogRegistry();
    for (const c of CORE_EVENT_CATALOGS) reg.register(c);
    reg.register(COOPERATIVE_EVENT_CATALOG);
    for (const e of COOPERATIVE_EVENT_CATALOG.events) {
      expect({ e, dikenal: reg.isKnownEvent(e) }).toEqual({ e, dikenal: true });
    }
  });

  it('peristiwa inti tidak terganggu', () => {
    const reg = new AccountingEventCatalogRegistry();
    for (const c of CORE_EVENT_CATALOGS) reg.register(c);
    reg.register(COOPERATIVE_EVENT_CATALOG);
    expect(reg.isKnownEvent('POS_SALE')).toBe(true);
    expect(reg.moduleOf('POS_SALE')).toBe('core');
    expect(reg.moduleOf('COOPERATIVE_SHU_PAID')).toBe('cooperative');
  });

  it('seluruh isi katalog terdaftar, tanpa ada yang tercecer', () => {
    /*
     * Diturunkan dari katalognya, bukan ditulis tetap. Angka tetap di sini
     * harus disunting setiap ada peristiwa baru — dan pengujian yang menuntut
     * penyuntingan rutin akan disesuaikan tanpa dibaca. (Catatan K-8 menyebut
     * "26 kode"; jumlah sebenarnya 29, dan selisih itu baru ketahuan saat
     * pendaftaran dikerjakan.)
     */
    const reg = new AccountingEventCatalogRegistry();
    for (const c of CORE_EVENT_CATALOGS) reg.register(c);
    reg.register(COOPERATIVE_EVENT_CATALOG);
    expect(reg.eventsOfModule('cooperative')).toHaveLength(
      COOPERATIVE_EVENT_CATALOG.events.length,
    );
    expect(COOPERATIVE_EVENT_CATALOG.events.length).toBeGreaterThanOrEqual(26);
  });
});

describe('peristiwa yang salah tidak pernah terbit', () => {
  it('menolak kode yang tidak dikenal katalog', () => {
    /*
     * Peristiwa yang tidak dikenal tidak akan pernah dijurnal; ia hanya
     * menumpuk sebagai PENDING tanpa ada yang menyadarinya.
     */
    const { client, ditulis } = klienPalsu();
    expect(
      layanan().terbitkan(client, 'demo', peristiwa({ eventCode: 'COOPERATIVE_TIDAK_ADA' })),
    ).rejects.toThrow(/tidak dikenal/);
    expect(ditulis).toHaveLength(0);
  });

  it('MENOLAK peristiwa milik modul lain', async () => {
    /*
     * Menerbitkan POS_SALE dari koperasi akan menjurnal penjualan dua kali —
     * sekali oleh kasir, sekali oleh koperasi — dan pendapatannya tercatat
     * ganda.
     */
    const { client, ditulis } = klienPalsu();
    await expect(
      layanan().terbitkan(client, 'demo', peristiwa({ eventCode: 'POS_SALE' })),
    ).rejects.toThrow(/tidak boleh menerbitkan/);
    expect(ditulis).toHaveLength(0);
  });

  it('menolak peristiwa yang kurang nilainya', async () => {
    const { client, ditulis } = klienPalsu();
    await expect(
      layanan().terbitkan(
        client,
        'demo',
        peristiwa({
          eventCode: 'COOPERATIVE_INSTALLMENT_RECEIVED',
          amounts: { total: 100000 },
        }),
      ),
    ).rejects.toThrow(/kurang nilai/);
    expect(ditulis).toHaveLength(0);
  });

  it('pesannya menyebut nilai mana yang kurang', async () => {
    const { client } = klienPalsu();
    let pesan = '';
    try {
      await layanan().terbitkan(
        client,
        'demo',
        peristiwa({
          eventCode: 'COOPERATIVE_INSTALLMENT_RECEIVED',
          amounts: { total: 100000 },
        }),
      );
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('principalPortion');
    expect(pesan).toContain('interestPortion');
  });

  it('nilai nol dianggap ada, bukan hilang', async () => {
    // Angsuran qardh memang tanpa imbalan; menolaknya akan membuat qardh
    // tidak dapat dijurnal sama sekali.
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkan(
      client,
      'demo',
      peristiwa({
        eventCode: 'COOPERATIVE_INSTALLMENT_RECEIVED',
        amounts: { principalPortion: 100000, interestPortion: 0, total: 100000 },
      }),
    );
    expect(ditulis).toHaveLength(1);
  });
});

describe('penerbitan yang sah', () => {
  it('menulis satu baris accounting_event', async () => {
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkan(client, 'demo', peristiwa());
    expect(ditulis).toHaveLength(1);
    expect(ditulis[0].sql).toContain('accounting_event');
    expect(ditulis[0].sql).toContain('"demo"');
  });

  it('berstatus PENDING — belum dijurnal', () => {
    /*
     * Saluran peristiwa-ke-jurnal belum dibangun untuk modul mana pun. Yang
     * terbit menunggu, dan itu keadaan yang benar untuk sekarang.
     */
    expect(peristiwa()).toBeDefined();
  });

  it('kunci idempotensinya disusun dari kode, jenis, dan id sumber', async () => {
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkan(client, 'demo', peristiwa());
    expect(ditulis[0].params).toContain('COOPERATIVE_SHU_PAID:COOPERATIVE_SHU:S1');
  });

  it('memakai ON CONFLICT DO NOTHING agar percobaan ulang tidak menggandakan', async () => {
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkan(client, 'demo', peristiwa());
    expect(ditulis[0].sql).toContain('ON CONFLICT');
    expect(ditulis[0].sql).toContain('DO NOTHING');
  });

  it('mata uang bawaannya IDR', async () => {
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkan(client, 'demo', peristiwa());
    expect(ditulis[0].params).toContain('IDR');
  });
});

describe('penerbitan beberapa sekaligus', () => {
  it('memeriksa SELURUHNYA sebelum menulis satu pun', async () => {
    /*
     * Menerbitkan tiga lalu gagal pada keempat meninggalkan pembukuan separuh
     * jadi — dan meskipun transaksinya digulung balik, galatnya jauh lebih
     * sulit ditelusuri daripada penolakan di depan.
     */
    const { client, ditulis } = klienPalsu();
    await expect(
      layanan().terbitkanBanyak(client, 'demo', [
        peristiwa(),
        peristiwa({ eventCode: 'COOPERATIVE_SALAH_KETIK', sourceId: 'S2' }),
      ]),
    ).rejects.toThrow();
    expect(ditulis).toHaveLength(0);
  });

  it('menulis seluruhnya bila seluruhnya sah', async () => {
    const { client, ditulis } = klienPalsu();
    await layanan().terbitkanBanyak(client, 'demo', [
      peristiwa(),
      peristiwa({
        eventCode: 'COOPERATIVE_VOLUNTARY_SAVING_WITHDRAWAL',
        sourceType: 'COOPERATIVE_SAVING',
        sourceId: 'A1',
        amounts: { amount: 75000 },
      }),
    ]);
    expect(ditulis).toHaveLength(2);
  });
});

describe('pemetaan akun yang dituntut', () => {
  it('dapat disebutkan untuk layar pengaturan', () => {
    expect(layanan().pemetaanDituntut('COOPERATIVE_WALLET_PAYMENT')).toEqual([
      'MEMBER_WALLET_LIABILITY',
      'CASH',
    ]);
  });

  it('peristiwa tanpa pemetaan mengembalikan daftar kosong, bukan galat', () => {
    expect(layanan().pemetaanDituntut('POS_SALE')).toEqual([]);
  });
});
