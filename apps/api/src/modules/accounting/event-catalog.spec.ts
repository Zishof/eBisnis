/**
 * Pengujian registri katalog peristiwa akuntansi (IR-003).
 *
 * Yang dijaga: sebuah modul tidak dapat mendaftarkan peristiwa milik modul
 * lain, dan tidak ada peristiwa yang lolos tanpa daftar nilai wajibnya.
 * Peristiwa keuangan yang tidak diperiksa kelengkapannya menghasilkan jurnal
 * yang tidak seimbang, dan ketidakseimbangan baru terlihat saat neraca
 * disusun — berbulan-bulan kemudian.
 */

import {
  AccountingEventCatalogError,
  AccountingEventCatalogRegistry,
  type AccountingEventCatalog,
} from './event-catalog.registry';
import { CORE_EVENT_CATALOGS } from './core-event-catalog';
import { ALL_EVENTS, REQUIRED_AMOUNTS } from './posting-engine';

const katalog = (
  module: string,
  prefix: string,
  events: string[],
  amounts?: Record<string, string[]>,
): AccountingEventCatalog => ({
  module,
  prefix,
  events,
  requiredAmounts: amounts ?? Object.fromEntries(events.map((e) => [e, ['amount']])),
});

let reg: AccountingEventCatalogRegistry;
beforeEach(() => {
  reg = new AccountingEventCatalogRegistry();
});

describe('pendaftaran', () => {
  it('mendaftarkan katalog modul', () => {
    reg.register(katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_SHU_PAID']));
    expect(reg.isKnownEvent('COOPERATIVE_SHU_PAID')).toBe(true);
    expect(reg.moduleOf('COOPERATIVE_SHU_PAID')).toBe('cooperative');
  });

  it('peristiwa yang tidak terdaftar tetap tidak dikenal', () => {
    expect(reg.isKnownEvent('COOPERATIVE_SHU_PAID')).toBe(false);
  });

  it('menolak pendaftaran ganda katalog yang sama', () => {
    reg.register(katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_A']));
    expect(() =>
      reg.register(katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_B'])),
    ).toThrow(AccountingEventCatalogError);
  });

  it('satu modul boleh mendaftarkan beberapa awalan', () => {
    // Inti memakainya untuk MARKETPLACE_ dan POS_ — dua kelompok peristiwa
    // yang memang berbeda dan dapat dimatikan sendiri-sendiri.
    reg.register(katalog('core', 'MARKETPLACE_', ['MARKETPLACE_SALE_RECOGNIZED']));
    expect(() => reg.register(katalog('core', 'POS_', ['POS_SALE']))).not.toThrow();
  });
});

describe('modul tidak boleh mendaftarkan peristiwa milik modul lain', () => {
  it('menolak peristiwa yang tidak berawalan katalognya', () => {
    /*
     * Jurnalnya akan terbentuk dengan aturan posting yang bukan miliknya —
     * dan itu berarti angka masuk ke akun yang salah, bukan sekadar rapi
     * atau tidak rapi.
     */
    expect(() =>
      reg.register(katalog('cooperative', 'COOPERATIVE_', ['POS_SALE'])),
    ).toThrow(/tidak berawalan/);
  });

  it('menolak peristiwa yang sudah didaftarkan modul lain', () => {
    reg.register(katalog('core', 'POS_', ['POS_SALE']));
    expect(() => reg.register(katalog('other', 'POS_', ['POS_SALE']))).toThrow(
      /sudah didaftarkan/,
    );
  });

  it('pesannya menyebut modul pemilik sebelumnya', () => {
    reg.register(katalog('core', 'POS_', ['POS_SALE']));
    let pesan = '';
    try {
      reg.register(katalog('other', 'POS_', ['POS_SALE']));
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('core');
    expect(pesan).toContain('other');
  });
});

describe('nilai wajib', () => {
  it('menolak peristiwa yang tidak menyebutkan nilai wajibnya', () => {
    expect(() =>
      reg.register({
        module: 'cooperative',
        prefix: 'COOPERATIVE_',
        events: ['COOPERATIVE_SHU_PAID'],
        requiredAmounts: {},
      }),
    ).toThrow(/tidak menyebutkan nilai wajibnya/);
  });

  it('menolak nilai wajib bagi peristiwa yang tidak ada — kemungkinan salah ketik', () => {
    /*
     * Bila dibiarkan, pemeriksaannya tidak akan pernah berjalan, dan tidak ada
     * yang tahu bahwa peristiwa itu sebenarnya tidak diperiksa.
     */
    expect(() =>
      reg.register({
        module: 'cooperative',
        prefix: 'COOPERATIVE_',
        events: ['COOPERATIVE_SHU_PAID'],
        requiredAmounts: {
          COOPERATIVE_SHU_PAID: ['amount'],
          COOPERATIVE_SHU_PAIID: ['amount'],
        },
      }),
    ).toThrow(/salah ketik/);
  });

  it('memeriksa kelengkapan nilai', () => {
    reg.register(
      katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_INSTALLMENT_RECEIVED'], {
        COOPERATIVE_INSTALLMENT_RECEIVED: ['principalPortion', 'interestPortion', 'total'],
      }),
    );
    const kurang = reg.checkRequiredAmounts('COOPERATIVE_INSTALLMENT_RECEIVED', { total: 100 });
    expect(kurang.ok).toBe(false);
    expect(kurang.missing.sort()).toEqual(['interestPortion', 'principalPortion']);
  });

  it('nilai nol dianggap ada, bukan hilang', () => {
    // Angsuran yang jasanya nol adalah keadaan yang sah — pinjaman qardh
    // memang tanpa imbalan. Menolaknya akan membuat qardh tidak dapat
    // dijurnal sama sekali.
    reg.register(
      katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_QARDH'], {
        COOPERATIVE_QARDH: ['principal', 'interest'],
      }),
    );
    expect(reg.checkRequiredAmounts('COOPERATIVE_QARDH', { principal: 100, interest: 0 }).ok).toBe(
      true,
    );
  });

  it('peristiwa yang tidak dikenal ditolak dengan keterangan', () => {
    const h = reg.checkRequiredAmounts('TIDAK_ADA', {});
    expect(h.ok).toBe(false);
    expect(h.missing[0]).toContain('tidak dikenal');
  });
});

describe('pemetaan akun', () => {
  it('dapat menyebutkan pemetaan yang dituntut sebuah peristiwa', () => {
    reg.register({
      module: 'cooperative',
      prefix: 'COOPERATIVE_',
      events: ['COOPERATIVE_WALLET_PAYMENT'],
      requiredAmounts: { COOPERATIVE_WALLET_PAYMENT: ['amount'] },
      requiredMappings: { COOPERATIVE_WALLET_PAYMENT: ['MEMBER_WALLET_LIABILITY', 'CASH'] },
    });
    expect(reg.requiredMappingsOf('COOPERATIVE_WALLET_PAYMENT')).toEqual([
      'MEMBER_WALLET_LIABILITY',
      'CASH',
    ]);
  });

  it('katalog tanpa pemetaan tetap sah', () => {
    // Peristiwa inti pemetaannya sudah tertanam pada aturan posting.
    reg.register(katalog('core', 'POS_', ['POS_SALE']));
    expect(reg.requiredMappingsOf('POS_SALE')).toBeUndefined();
  });
});

describe('katalog inti terdaftar lewat pintu yang sama', () => {
  beforeEach(() => {
    for (const c of CORE_EVENT_CATALOGS) reg.register(c);
  });

  it('seluruh peristiwa lama tetap dikenal', () => {
    /*
     * Ini pemeriksaan kompatibilitas mundur yang sesungguhnya: apa pun yang
     * dikenal `isKnownEvent()` sebelum perubahan ini harus tetap dikenal.
     */
    for (const e of ALL_EVENTS) {
      expect({ event: e, dikenal: reg.isKnownEvent(e) }).toEqual({ event: e, dikenal: true });
    }
  });

  it('nilai wajibnya sama persis dengan sebelumnya', () => {
    for (const e of ALL_EVENTS) {
      expect({ e, wajib: reg.requiredAmountsOf(e) }).toEqual({
        e,
        wajib: REQUIRED_AMOUNTS[e],
      });
    }
  });

  it('tidak menambah maupun mengurangi peristiwa', () => {
    expect(reg.allEvents().sort()).toEqual([...ALL_EVENTS].sort());
  });

  it('modul koperasi dapat menambah tanpa menyentuh peristiwa inti', () => {
    const sebelum = reg.allEvents().length;
    reg.register(
      katalog('cooperative', 'COOPERATIVE_', [
        'COOPERATIVE_PRINCIPAL_SAVING_RECEIVED',
        'COOPERATIVE_SHU_PAID',
      ]),
    );
    expect(reg.allEvents().length).toBe(sebelum + 2);
    for (const e of ALL_EVENTS) expect(reg.isKnownEvent(e)).toBe(true);
  });

  it('dapat menyebutkan peristiwa milik satu modul saja', () => {
    reg.register(katalog('cooperative', 'COOPERATIVE_', ['COOPERATIVE_SHU_PAID']));
    expect(reg.eventsOfModule('cooperative')).toEqual(['COOPERATIVE_SHU_PAID']);
    expect(reg.eventsOfModule('core').length).toBe(ALL_EVENTS.length);
  });
});
