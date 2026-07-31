/**
 * Pengujian registri katalog vertikal (IR-004).
 *
 * Yang dijaga: sebuah vertikal **tidak dapat** mendaftarkan menu atau peran
 * milik inti maupun milik vertikal lain. Konflik pada daftar hak akses lebih
 * berbahaya daripada konflik biasa — penyelesaian yang keliru menghasilkan
 * peran yang memegang izin yang tidak pernah dimaksudkan siapa pun.
 */

import {
  VerticalCatalogError,
  VerticalCatalogRegistry,
  type VerticalCatalog,
} from './vertical-catalog.registry';
import type { MenuNodeSeed } from './tenant-menu.seed';
import type { RoleCatalogEntry } from './tenant-role.seed';

const menu = (code: string, parentCode?: string): MenuNodeSeed => ({
  code,
  parentCode,
  label: code,
  translationKey: `menu.${code.toLowerCase()}`,
  sortOrder: 1,
  actions: ['READ'],
});

const peran = (code: string): RoleCatalogEntry => ({
  code,
  name: code,
  family: 'Uji',
  profile: 'P1',
  modules: {},
  dataScope: 'SELF',
  description: 'peran uji',
});

const katalog = (over: Partial<VerticalCatalog> & { code: string }): VerticalCatalog => ({
  prefix: over.code.toUpperCase(),
  menus: [],
  roles: [],
  ...over,
});

let reg: VerticalCatalogRegistry;
beforeEach(() => {
  reg = new VerticalCatalogRegistry();
});

describe('pendaftaran', () => {
  it('mendaftarkan katalog vertikal', () => {
    reg.register(katalog({ code: 'cooperative', prefix: 'COOPERATIVE', menus: [menu('COOPERATIVE')] }));
    expect(reg.registeredCodes()).toEqual(['cooperative']);
  });

  it('menolak pendaftaran ganda dengan kode sama', () => {
    /*
     * Hampir selalu berarti dua modul memakai kode yang sama, dan yang kedua
     * akan menimpa yang pertama tanpa galat.
     */
    reg.register(katalog({ code: 'cooperative' }));
    expect(() => reg.register(katalog({ code: 'cooperative' }))).toThrow(VerticalCatalogError);
  });

  it('katalog inti boleh berawalan kosong', () => {
    // Inti memiliki menu apa pun; vertikal wajib memberi awalan.
    expect(() =>
      reg.register(katalog({ code: 'core', prefix: '', menus: [menu('HOME'), menu('POS')] })),
    ).not.toThrow();
  });
});

describe('awalan harus saling asing', () => {
  it('menolak awalan yang persis sama', () => {
    reg.register(katalog({ code: 'a', prefix: 'COOP' }));
    expect(() => reg.register(katalog({ code: 'b', prefix: 'COOP' }))).toThrow(/bertumpang tindih/);
  });

  it('menolak awalan yang saling berawalan', () => {
    /*
     * `COOP` dan `COOPERATIVE` tumpang tindih: menu `COOPERATIVE_MEMBER`
     * memenuhi keduanya, sehingga pemeriksaan kepemilikan berhenti bermakna.
     */
    reg.register(katalog({ code: 'a', prefix: 'COOP' }));
    expect(() => reg.register(katalog({ code: 'b', prefix: 'COOPERATIVE' }))).toThrow(
      /bertumpang tindih/,
    );
  });

  it('menolak pula pada urutan sebaliknya', () => {
    reg.register(katalog({ code: 'a', prefix: 'COOPERATIVE' }));
    expect(() => reg.register(katalog({ code: 'b', prefix: 'COOP' }))).toThrow(/bertumpang tindih/);
  });

  it('menerima awalan yang benar-benar berbeda', () => {
    reg.register(katalog({ code: 'a', prefix: 'COOPERATIVE' }));
    expect(() => reg.register(katalog({ code: 'b', prefix: 'HEALTH' }))).not.toThrow();
  });

  it('awalan kosong milik inti tidak menghalangi vertikal mana pun', () => {
    reg.register(katalog({ code: 'core', prefix: '' }));
    expect(() => reg.register(katalog({ code: 'cooperative', prefix: 'COOPERATIVE' }))).not.toThrow();
  });
});

describe('vertikal tidak boleh mendaftarkan milik orang lain', () => {
  it('menolak menu yang tidak berawalan katalognya', () => {
    expect(() =>
      reg.register(
        katalog({ code: 'cooperative', prefix: 'COOPERATIVE', menus: [menu('POS')] }),
      ),
    ).toThrow(/tidak berawalan/);
  });

  it('menolak peran yang tidak berawalan katalognya', () => {
    expect(() =>
      reg.register(
        katalog({ code: 'cooperative', prefix: 'COOPERATIVE', roles: [peran('CASHIER')] }),
      ),
    ).toThrow(/tidak berawalan/);
  });

  it('menolak menu yang sudah didaftarkan katalog lain', () => {
    reg.register(katalog({ code: 'core', prefix: '', menus: [menu('POS')] }));
    expect(() =>
      reg.register(katalog({ code: 'pos2', prefix: 'POS', menus: [menu('POS')] })),
    ).toThrow(/sudah didaftarkan/);
  });

  it('pesannya menyebut katalog pemilik sebelumnya', () => {
    reg.register(katalog({ code: 'core', prefix: '', menus: [menu('POS')] }));
    let pesan = '';
    try {
      reg.register(katalog({ code: 'pos2', prefix: 'POS', menus: [menu('POS')] }));
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('core');
  });
});

describe('aksi hak akses boleh dipakai bersama', () => {
  const aksi = (code: string, name: string) => ({
    code,
    name,
    nameKey: `action.${code.toLowerCase()}`,
    actionType: 'STANDARD',
    sortOrder: 1,
  });

  it('dua katalog boleh memakai APPROVE yang sama', () => {
    /*
     * Memaksa tiap vertikal mendefinisikan COOPERATIVE_APPROVE akan
     * melipatgandakan daftar aksi tanpa menambah kejelasan.
     */
    reg.register(
      katalog({ code: 'core', prefix: '', permissionActions: [aksi('APPROVE', 'Setujui')] }),
    );
    expect(() =>
      reg.register(
        katalog({
          code: 'cooperative',
          prefix: 'COOPERATIVE',
          permissionActions: [aksi('APPROVE', 'Setujui')],
        }),
      ),
    ).not.toThrow();
  });

  it('tetapi TIDAK boleh dengan arti berbeda', () => {
    // Layar pengaturan hak akses menampilkan satu nama untuk satu kode.
    reg.register(
      katalog({ code: 'core', prefix: '', permissionActions: [aksi('APPROVE', 'Setujui')] }),
    );
    expect(() =>
      reg.register(
        katalog({
          code: 'cooperative',
          prefix: 'COOPERATIVE',
          permissionActions: [aksi('APPROVE', 'Sahkan RAT')],
        }),
      ),
    ).toThrow(/satu arti/);
  });

  it('aksi yang sama hanya muncul sekali pada hasil gabungan', () => {
    reg.register(
      katalog({ code: 'core', prefix: '', permissionActions: [aksi('APPROVE', 'Setujui')] }),
    );
    reg.register(
      katalog({
        code: 'cooperative',
        prefix: 'COOPERATIVE',
        permissionActions: [aksi('APPROVE', 'Setujui'), aksi('DISBURSE', 'Cairkan')],
      }),
    );
    const kode = reg.allPermissionActions().map((a) => a.code);
    expect(kode.filter((c) => c === 'APPROVE')).toHaveLength(1);
    expect(kode).toContain('DISBURSE');
  });
});

describe('menu yatim ditolak', () => {
  it('menolak parentCode yang tidak ada di mana pun', () => {
    /*
     * Menu yatim tidak menimbulkan galat apa pun — ia hanya tidak pernah
     * muncul di layar. Gejalanya adalah ketiadaan, dan itu butuh waktu lama
     * untuk disadari.
     */
    reg.register(
      katalog({
        code: 'cooperative',
        prefix: 'COOPERATIVE',
        menus: [menu('COOPERATIVE_MEMBER', 'COOPERATIVE')],
      }),
    );
    expect(() => reg.validateTree()).toThrow(/menunjuk induk yang tidak ada/);
  });

  it('mengizinkan menu vertikal menggantung pada menu INTI', () => {
    // Urutan pendaftaran tidak boleh menentukan sah atau tidaknya, jadi
    // pemeriksaannya dijalankan setelah seluruh katalog terdaftar.
    reg.register(katalog({ code: 'cooperative', prefix: 'COOPERATIVE', menus: [menu('COOPERATIVE_X', 'HOME')] }));
    reg.register(katalog({ code: 'core', prefix: '', menus: [menu('HOME')] }));
    expect(() => reg.validateTree()).not.toThrow();
  });

  it('menerima pohon yang lengkap', () => {
    reg.register(
      katalog({
        code: 'cooperative',
        prefix: 'COOPERATIVE',
        menus: [menu('COOPERATIVE'), menu('COOPERATIVE_MEMBER', 'COOPERATIVE')],
      }),
    );
    expect(() => reg.validateTree()).not.toThrow();
  });

  it('menyebut seluruh menu yatim, bukan hanya yang pertama', () => {
    reg.register(
      katalog({
        code: 'cooperative',
        prefix: 'COOPERATIVE',
        menus: [menu('COOPERATIVE_A', 'HILANG_1'), menu('COOPERATIVE_B', 'HILANG_2')],
      }),
    );
    let pesan = '';
    try {
      reg.validateTree();
    } catch (e) {
      pesan = (e as Error).message;
    }
    expect(pesan).toContain('HILANG_1');
    expect(pesan).toContain('HILANG_2');
  });
});

describe('pengumpulan', () => {
  beforeEach(() => {
    reg.register(katalog({ code: 'core', prefix: '', menus: [menu('HOME')], roles: [peran('ADMIN')] }));
    reg.register(
      katalog({
        code: 'cooperative',
        prefix: 'COOPERATIVE',
        menus: [menu('COOPERATIVE')],
        roles: [peran('COOPERATIVE_CHAIRMAN')],
      }),
    );
  });

  it('mengumpulkan menu dari seluruh katalog', () => {
    expect(reg.allMenus().map((m) => m.code).sort()).toEqual(['COOPERATIVE', 'HOME']);
  });

  it('mengumpulkan peran dari seluruh katalog', () => {
    expect(reg.allRoles().map((r) => r.code).sort()).toEqual(['ADMIN', 'COOPERATIVE_CHAIRMAN']);
  });

  it('dapat menyebut pemilik sebuah menu', () => {
    expect(reg.ownerOfMenu('COOPERATIVE')).toBe('cooperative');
    expect(reg.ownerOfMenu('HOME')).toBe('core');
    expect(reg.ownerOfMenu('TIDAK_ADA')).toBeUndefined();
  });
});
