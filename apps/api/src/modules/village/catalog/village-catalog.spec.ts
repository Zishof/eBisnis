/**
 * Pengujian katalog menu, hak akses, dan peran.
 *
 * Yang dijaga: **peran `DESA_ONLY` tidak pernah sampai ke penyewa kelurahan**,
 * dan setiap hak akses yang disebut peran benar-benar ada pada katalog menu.
 * Hak akses yang menunjuk menu tak bernama tidak akan pernah dapat diberikan
 * kepada siapa pun — dan kegagalannya senyap.
 */

import { KATALOG_KELAYAKAN, layak, type KodeFitur } from '../village-profile';
import { VILLAGE_ACTIONS, VILLAGE_MENUS, villagePermissions } from './village-permission.catalog';
import { VILLAGE_ROLES, peranLayak } from './village-role.catalog';

describe('katalog menu', () => {
  it('kode menu unik', () => {
    const kode = VILLAGE_MENUS.map((m) => m.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('seluruh kode berawalan VILLAGE', () => {
    // Perintah §6 menetapkan namespace. Menu yang lupa awalannya akan bertabrakan
    // dengan menu Core atau vertikal lain saat registri digabung.
    for (const m of VILLAGE_MENUS) expect(m.code).toMatch(/^VILLAGE/);
  });

  it('setiap menu menyatakan fitur kelayakannya', () => {
    const dikenal = new Set(Object.keys(KATALOG_KELAYAKAN));
    for (const m of VILLAGE_MENUS) {
      expect(dikenal.has(m.feature)).toBe(true);
    }
  });

  it('induk setiap menu benar-benar ada', () => {
    const kode = new Set(VILLAGE_MENUS.map((m) => m.code));
    for (const m of VILLAGE_MENUS) {
      if (m.parentCode) expect(kode.has(m.parentCode)).toBe(true);
    }
  });

  it('setiap menu punya sekurang-kurangnya aksi READ', () => {
    for (const m of VILLAGE_MENUS) expect(m.actions).toContain('READ');
  });

  it('hanya memakai aksi yang terdaftar', () => {
    const sah = new Set<string>(VILLAGE_ACTIONS);
    for (const m of VILLAGE_MENUS) {
      for (const a of m.actions) expect(sah.has(a)).toBe(true);
    }
  });

  it('rute frontend berawalan /info-desa', () => {
    for (const m of VILLAGE_MENUS) {
      if (m.route) expect(m.route.startsWith('/info-desa')).toBe(true);
    }
  });

  it('menghasilkan hak akses berbentuk MENU.ACTION', () => {
    const izin = villagePermissions();
    expect(izin.length).toBeGreaterThan(50);
    for (const p of izin) expect(p).toMatch(/^VILLAGE[A-Z_]*\.[A-Z_]+$/);
    expect(new Set(izin).size).toBe(izin.length);
  });
});

describe('menu menurut profil', () => {
  const menuLayak = (profil: 'DESA' | 'KELURAHAN') =>
    VILLAGE_MENUS.filter((m) => layak(m.feature as KodeFitur, profil).layak).map((m) => m.code);

  it('APBDes tidak muncul pada kelurahan', () => {
    expect(menuLayak('KELURAHAN')).not.toContain('VILLAGE_APBDES');
    expect(menuLayak('DESA')).toContain('VILLAGE_APBDES');
  });

  it('BPD tidak muncul pada kelurahan', () => {
    expect(menuLayak('KELURAHAN')).not.toContain('VILLAGE_BPD');
  });

  it('BUMDes tidak muncul pada kelurahan', () => {
    expect(menuLayak('KELURAHAN')).not.toContain('VILLAGE_BUMDES');
  });

  it('Musrenbang desa dan kelurahan tidak pernah muncul bersamaan', () => {
    /*
     * Keduanya ada sebagai menu terpisah karena bentuk dan jenjangnya berbeda.
     * Yang tidak boleh: satu penyewa melihat keduanya, lalu bingung mana yang
     * harus dipakai.
     */
    const desa = menuLayak('DESA');
    const kel = menuLayak('KELURAHAN');
    expect(desa).toContain('VILLAGE_MUSRENBANG');
    expect(desa).not.toContain('VILLAGE_MUSRENBANG_KEL');
    expect(kel).toContain('VILLAGE_MUSRENBANG_KEL');
    expect(kel).not.toContain('VILLAGE_MUSRENBANG');
  });

  it('layanan warga muncul pada keduanya', () => {
    for (const p of ['DESA', 'KELURAHAN'] as const) {
      expect(menuLayak(p)).toContain('VILLAGE_SERVICE_REQUEST');
      expect(menuLayak(p)).toContain('VILLAGE_RESIDENT');
    }
  });
});

describe('katalog peran', () => {
  it('kode peran unik', () => {
    const kode = VILLAGE_ROLES.map((r) => r.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('dua puluh sembilan peran sesuai spesifikasi', () => {
    expect(VILLAGE_ROLES).toHaveLength(29);
  });

  it('setiap hak akses peran benar-benar ada pada katalog menu', () => {
    /*
     * Hak akses yang menunjuk menu tak bernama tidak akan pernah dapat
     * diberikan kepada siapa pun, dan kegagalannya senyap: peran tampak punya
     * wewenang yang sesungguhnya tidak berlaku. Cacat persis seperti ini pernah
     * ditemukan pada Core (CRM.CREATE menunjuk menu root yang hanya punya READ).
     */
    const sah = new Set(villagePermissions());
    const menggantung: string[] = [];
    for (const r of VILLAGE_ROLES) {
      for (const p of r.permissions) {
        if (!sah.has(p)) menggantung.push(`${r.code} -> ${p}`);
      }
    }
    expect(menggantung).toEqual([]);
  });

  it('setiap peran punya sekurang-kurangnya satu hak akses', () => {
    for (const r of VILLAGE_ROLES) expect(r.permissions.length).toBeGreaterThan(0);
  });
});

describe('peran menurut profil', () => {
  it('Kepala Desa tidak disemai pada kelurahan', () => {
    const kel = peranLayak('KELURAHAN').map((r) => r.code);
    expect(kel).not.toContain('VILLAGE_HEAD');
    expect(kel).toContain('URBAN_VILLAGE_HEAD');
  });

  it('Lurah tidak disemai pada desa', () => {
    const desa = peranLayak('DESA').map((r) => r.code);
    expect(desa).not.toContain('URBAN_VILLAGE_HEAD');
    expect(desa).toContain('VILLAGE_HEAD');
  });

  it('BPD dan Bendahara Desa tidak disemai pada kelurahan', () => {
    const kel = peranLayak('KELURAHAN').map((r) => r.code);
    expect(kel).not.toContain('VILLAGE_BPD');
    expect(kel).not.toContain('VILLAGE_TREASURER');
    expect(kel).not.toContain('VILLAGE_BUMDES_MANAGER');
  });

  it('peran DESA_ONLY tidak bocor sama sekali ke kelurahan', () => {
    const kel = new Set(peranLayak('KELURAHAN').map((r) => r.code));
    const bocor = VILLAGE_ROLES.filter((r) => r.eligibility === 'DESA_ONLY' && kel.has(r.code));
    expect(bocor.map((r) => r.code)).toEqual([]);
  });

  it('peran KELURAHAN_ONLY tidak bocor ke desa', () => {
    const desa = new Set(peranLayak('DESA').map((r) => r.code));
    const bocor = VILLAGE_ROLES.filter((r) => r.eligibility === 'KELURAHAN_ONLY' && desa.has(r.code));
    expect(bocor.map((r) => r.code)).toEqual([]);
  });

  it('keduanya memperoleh operator kependudukan dan pelayanan', () => {
    for (const p of ['DESA', 'KELURAHAN'] as const) {
      const kode = peranLayak(p).map((r) => r.code);
      expect(kode).toContain('VILLAGE_OP_POPULATION');
      expect(kode).toContain('VILLAGE_OP_SERVICE');
      expect(kode).toContain('VILLAGE_CITIZEN');
    }
  });
});

describe('cakupan data bawaan', () => {
  it('Ketua RT bercakupan RT', () => {
    expect(VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_RT_HEAD')?.defaultScope).toBe('RT');
  });

  it('warga bercakupan diri sendiri', () => {
    expect(VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_CITIZEN')?.defaultScope).toBe('SELF');
  });

  it('BPD hanya memperoleh agregat', () => {
    /*
     * BPD mengawasi anggaran dan kebijakan, bukan memeriksa warga per orang.
     * Akses yang tidak diperlukan tugasnya adalah akses yang akan dipakai untuk
     * hal lain.
     */
    const bpd = VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_BPD');
    expect(bpd?.defaultScope).toBe('AGGREGATE_ONLY');
    expect(bpd?.permissions.some((p) => p.startsWith('VILLAGE_RESIDENT'))).toBe(false);
  });

  it('Linmas tidak memperoleh akses data kependudukan', () => {
    // Tugasnya ketertiban, bukan pendataan.
    const linmas = VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_LINMAS');
    expect(linmas?.permissions.some((p) => p.startsWith('VILLAGE_RESIDENT'))).toBe(false);
    expect(linmas?.permissions.some((p) => p.startsWith('VILLAGE_FAMILY'))).toBe(false);
  });

  it('operator bantuan tidak dapat menyetujui penerima', () => {
    /*
     * Titik korupsi paling umum pada bantuan sosial desa. Pengusul dan
     * penyetuju harus orang yang berbeda, dan pemisahannya dimulai dari peran.
     */
    const op = VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_OP_AID');
    expect(op?.permissions).not.toContain('VILLAGE_BENEFICIARY.APPROVE');
    expect(op?.permissions).toContain('VILLAGE_BENEFICIARY.CREATE');
  });

  it('warga tidak dapat membaca data penduduk umum', () => {
    // Tidak ada pencarian warga pada portal.
    const w = VILLAGE_ROLES.find((r) => r.code === 'VILLAGE_CITIZEN');
    expect(w?.permissions.some((p) => p.startsWith('VILLAGE_RESIDENT'))).toBe(false);
  });
});
