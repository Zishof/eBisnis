/**
 * Pengujian katalog vertikal ePesantren.
 *
 * Kesalahan di sini tidak menghasilkan galat: ia menghasilkan menu yang tidak
 * pernah dapat dibuka, atau peran yang diam-diam tidak berdaya apa-apa.
 */

import {
  PESANTREN_MENUS,
  PESANTREN_PREFIX,
  PESANTREN_ROLES,
  PESANTREN_VERTICAL_CATALOG,
  ROLE_ADMIN_EPESANTREN,
} from './pesantren-vertical.catalog';
import { VERTICAL_CATALOGS } from '../../../infrastructure/provisioning/vertical-catalogs';

describe('katalog vertikal ePesantren', () => {
  it('setiap menu berawalan EPESANTREN_', () => {
    const salah = PESANTREN_MENUS.filter((m) => !m.code.startsWith(PESANTREN_PREFIX));
    expect(salah).toEqual([]);
  });

  it('setiap menu menyebutkan aksinya', () => {
    // Menu tanpa aksi hanya menawarkan READ (§ komentar cooperative-vertical) —
    // menyebutkannya bukan kerapian, melainkan syarat.
    const kosong = PESANTREN_MENUS.filter((m) => !m.actions || m.actions.length === 0);
    expect(kosong).toEqual([]);
  });

  it('menu dengan CREATE/UPDATE juga menawarkan READ', () => {
    // Aksi mengubah tanpa aksi membaca tidak masuk akal: tidak ada yang dapat
    // memastikan perubahannya berhasil tanpa dapat membaca hasilnya.
    for (const m of PESANTREN_MENUS) {
      const aksi = m.actions ?? [];
      if (aksi.includes('CREATE') || aksi.includes('UPDATE')) {
        expect(aksi).toContain('READ');
      }
    }
  });

  it('kode role tidak kembar', () => {
    const kode = PESANTREN_ROLES.map((r) => r.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('EPESANTREN_ADMIN memegang modul EPESANTREN_SANTRI', () => {
    const admin = PESANTREN_ROLES.find((r) => r.code === ROLE_ADMIN_EPESANTREN);
    expect(admin).toBeDefined();
    expect(admin!.modules.EPESANTREN_SANTRI).toBeDefined();
    expect(admin!.allModules).not.toBe(true);
  });

  it('setiap modul yang disebut peran benar-benar ada pada daftar menu', () => {
    /*
     * Peran yang menunjuk menu yang tidak ada memberi izin yang tidak pernah
     * dapat dipakai — tidak salah, hanya sia-sia, dan sia-sia yang tidak
     * ketahuan sampai seseorang bertanya mengapa menunya tidak muncul.
     */
    const kodeMenu = new Set(PESANTREN_MENUS.map((m) => m.code));
    const takDikenali = PESANTREN_ROLES.flatMap((peran) =>
      Object.keys(peran.modules)
        .filter((modul) => modul !== 'HOME' && modul !== 'SUPPORT' && !kodeMenu.has(modul))
        .map((modul) => `${peran.code} -> ${modul}`),
    );
    expect(takDikenali).toEqual([]);
  });

  it('terdaftar pada VERTICAL_CATALOGS', () => {
    expect(VERTICAL_CATALOGS).toContain(PESANTREN_VERTICAL_CATALOG);
  });

  it('kode katalog tidak bertabrakan dengan katalog lain', () => {
    const kode = VERTICAL_CATALOGS.map((c) => c.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});
