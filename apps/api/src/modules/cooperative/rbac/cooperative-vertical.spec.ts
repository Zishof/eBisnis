/**
 * Pengujian katalog vertikal koperasi setelah diterjemahkan ke bentuk Core.
 *
 * Berkas `cooperative-rbac.spec.ts` menguji bentuk asli sesi eKoperasi — daftar
 * izin eksplisit. Yang diuji **di sini** berbeda dan lebih penting: bahwa
 * pemisahan wewenang tetap berlaku setelah peran dinyatakan sebagai profil per
 * modul dan **diperluas mesin profil**.
 *
 * Penerjemahan bentuk adalah tempat aturan keamanan paling mudah hilang tanpa
 * ada yang menyadarinya: keduanya tampak setara sampai seseorang memeriksa
 * hasil perluasannya.
 */

import {
  COOPERATIVE_MENUS,
  COOPERATIVE_MODULES,
  COOPERATIVE_PREFIX,
  COOPERATIVE_ROLES,
  COOPERATIVE_VERTICAL_CATALOG,
} from './cooperative-vertical.catalog';
import { MENU_KOPERASI, KONFLIK_WEWENANG } from './cooperative-rbac.catalog';
import { CORE_VERTICAL_CATALOG } from '../../../infrastructure/provisioning/core-vertical.catalog';
import { PERMISSION_ACTIONS_SEED } from '../../../infrastructure/provisioning/tenant-menu.seed';
import { VerticalCatalogRegistry } from '../../../infrastructure/provisioning/vertical-catalog.registry';
import { expandTenantRoles } from '../../../infrastructure/provisioning/role-expansion';
import { buildSodGroups } from '../../../infrastructure/provisioning/tenant-role.seed';
import { TENANT_ROLE_CATALOG } from '../../../infrastructure/provisioning/tenant-role.seed';

/** Dipakai menafsirkan izin '*'. */
const SELURUH_AKSI = PERMISSION_ACTIONS_SEED.map((a) => a.code);

/** Izin hasil perluasan, sebagaimana yang benar-benar disemai. */
function izinHasilPerluasan(kodePeran: string): Map<string, string[]> {
  const menus = [...CORE_VERTICAL_CATALOG.menus, ...COOPERATIVE_MENUS];
  const roles = [...TENANT_ROLE_CATALOG, ...COOPERATIVE_ROLES];
  const diperluas = expandTenantRoles(menus, roles).find((r) => r.code === kodePeran);
  const peta = new Map<string, string[]>();
  for (const [menuCode, actions] of Object.entries(diperluas?.permissions ?? {})) {
    // '*' berarti seluruh aksi pada menu itu. Diperlakukan sebagai daftar
    // seluruh aksi supaya pemeriksaan "tidak memegang APPROVE" tidak lolos
    // hanya karena bentuknya berbeda.
    peta.set(menuCode, actions === '*' ? SELURUH_AKSI : actions);
  }
  return peta;
}

const aksiPada = (kodePeran: string, menu: string): string[] =>
  izinHasilPerluasan(kodePeran).get(menu) ?? [];

describe('katalog diterima registri', () => {
  it('inti dan koperasi dapat terdaftar bersama', () => {
    const reg = new VerticalCatalogRegistry();
    reg.register(CORE_VERTICAL_CATALOG);
    expect(() => reg.register(COOPERATIVE_VERTICAL_CATALOG)).not.toThrow();
  });

  it('pohon menu gabungannya sah — tidak ada menu yatim', () => {
    const reg = new VerticalCatalogRegistry();
    reg.register(CORE_VERTICAL_CATALOG);
    reg.register(COOPERATIVE_VERTICAL_CATALOG);
    expect(() => reg.validateTree()).not.toThrow();
  });

  it('setiap layar yang dirancang sesi eKoperasi tetap ada', () => {
    /*
     * Susunannya berubah — enam modul, bukan satu — tetapi tidak satu layar
     * pun boleh hilang dalam penyusunan ulang itu. Layar yang hilang hanya
     * berarti menu yang tidak muncul, tanpa galat apa pun.
     */
    const ada = new Set(COOPERATIVE_MENUS.map((m) => m.code));
    for (const m of MENU_KOPERASI) {
      expect({ menu: m.code, ada: ada.has(m.code) }).toEqual({ menu: m.code, ada: true });
    }
  });

  it('modulnya mengikuti batas pemisahan wewenang', () => {
    // Simpanan, pinjaman, dan portal wajib menjadi modul tersendiri; bila
    // tidak, satu profil berlaku untuk ketiganya sekaligus.
    for (const wajib of ['COOPERATIVE_SAVING', 'COOPERATIVE_LOAN', 'COOPERATIVE_PORTAL']) {
      expect(COOPERATIVE_MODULES).toContain(wajib);
    }
  });

  it('setiap menu berawalan COOPERATIVE', () => {
    for (const m of COOPERATIVE_MENUS) expect(m.code.startsWith(COOPERATIVE_PREFIX)).toBe(true);
  });

  it('setiap peran berawalan COOPERATIVE', () => {
    for (const r of COOPERATIVE_ROLES) expect(r.code.startsWith(COOPERATIVE_PREFIX)).toBe(true);
  });
});

describe('pemisahan wewenang bertahan setelah diperluas', () => {
  it('Petugas Pinjaman MENGANALISIS tetapi tidak menyetujui', () => {
    /*
     * Pemisahan yang paling menentukan di koperasi simpan pinjam. Sekarang
     * dijaga bentuk profilnya sendiri: C1 memuat ANALYZE dan tidak memuat
     * APPROVE, sehingga tidak ada cara memberinya hak menyetujui tanpa
     * mengubah profil C1 itu sendiri.
     */
    const analisis = aksiPada('COOPERATIVE_LOAN_OFFICER', 'COOPERATIVE_CREDIT_ANALYSIS');
    expect(analisis).toContain('ANALYZE');
    expect(analisis).toContain('CREATE');

    const pinjaman = aksiPada('COOPERATIVE_LOAN_OFFICER', 'COOPERATIVE_LOAN');
    expect(pinjaman).not.toContain('APPROVE');
    expect(pinjaman).not.toContain('DISBURSE');
    expect(pinjaman).not.toContain('WRITE_OFF');
  });

  it('Ketua MENYETUJUI tetapi tidak mencatat', () => {
    const pinjaman = aksiPada('COOPERATIVE_CHAIRMAN', 'COOPERATIVE_LOAN');
    expect(pinjaman).toContain('APPROVE');
    expect(pinjaman).not.toContain('CREATE');
    expect(pinjaman).not.toContain('UPDATE');
  });

  it('Ketua satu-satunya yang memegang WRITE_OFF', () => {
    /*
     * Penghapusbukuan menghilangkan piutang dari neraca dan merupakan
     * perbuatan yang paling mudah dipakai menutupi pinjaman bermasalah.
     * Basis data tetap menuntut dua orang berbeda; hak akses ini tidak
     * menggantikannya.
     */
    const pemegang = COOPERATIVE_ROLES.filter((r) =>
      COOPERATIVE_MENUS.some((m) => aksiPada(r.code, m.code).includes('WRITE_OFF')),
    ).map((r) => r.code);
    expect(pemegang).toEqual(['COOPERATIVE_CHAIRMAN']);
  });

  it('Manajer mencairkan tetapi tidak menganalisis', () => {
    const pinjaman = aksiPada('COOPERATIVE_MANAGER', 'COOPERATIVE_LOAN');
    expect(pinjaman).toContain('DISBURSE');
    expect(pinjaman).not.toContain('CREATE');
    expect(aksiPada('COOPERATIVE_MANAGER', 'COOPERATIVE_CREDIT_ANALYSIS')).not.toContain('ANALYZE');
  });

  it('Petugas Simpanan mencatat tetapi tidak mengesahkan', () => {
    const simpanan = aksiPada('COOPERATIVE_SAVING_OFFICER', 'COOPERATIVE_SAVING');
    expect(simpanan).toContain('CREATE');
    expect(simpanan).not.toContain('APPROVE');
  });

  it('Bendahara menyusun jurnal tetapi tidak memostingnya', () => {
    const akuntansi = aksiPada('COOPERATIVE_TREASURER', 'COOPERATIVE_ACCOUNTING');
    expect(akuntansi).toContain('CREATE');
    expect(akuntansi).not.toContain('POST');
    expect(akuntansi).not.toContain('APPROVE');
  });

  it('tidak ada peran yang memegang kedua sisi sebuah konflik', () => {
    /*
     * Diperiksa terhadap hasil perluasan, bukan terhadap daftar yang ditulis
     * tangan. Bentuk lama menjamin ini lewat daftar izinnya; bentuk baru harus
     * membuktikannya lewat profilnya.
     */
    for (const peran of COOPERATIVE_ROLES) {
      const dimiliki = new Set<string>();
      for (const m of COOPERATIVE_MENUS) {
        for (const a of aksiPada(peran.code, m.code)) dimiliki.add(`${m.code}.${a}`);
      }
      const melanggar = KONFLIK_WEWENANG.filter((k) => dimiliki.has(k.a) && dimiliki.has(k.b));
      expect({ peran: peran.code, melanggar: melanggar.map((k) => `${k.a}+${k.b}`) }).toEqual({
        peran: peran.code,
        melanggar: [],
      });
    }
  });
});

describe('pengawas', () => {
  it('tidak memegang satu pun hak menulis', () => {
    // Pengawas yang dapat mengubah data tidak lagi dapat mengawasinya.
    const menulis = ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST', 'DISBURSE', 'WRITE_OFF'];
    for (const m of COOPERATIVE_MENUS) {
      for (const a of aksiPada('COOPERATIVE_SUPERVISOR', m.code)) {
        expect({ menu: m.code, aksi: a, menulis: menulis.includes(a) }).toEqual({
          menu: m.code,
          aksi: a,
          menulis: false,
        });
      }
    }
  });

  it('tetap dapat membaca analisis kredit dan penagihan', () => {
    // Justru di sanalah penyimpangan paling mungkin ditemukan.
    expect(aksiPada('COOPERATIVE_SUPERVISOR', 'COOPERATIVE_CREDIT_ANALYSIS')).toContain('READ');
    expect(aksiPada('COOPERATIVE_SUPERVISOR', 'COOPERATIVE_COLLECTION')).toContain('READ');
  });
});

describe('anggota terpisah dari petugas, dua arah', () => {
  it('peran anggota hanya menyentuh menu portal', () => {
    /*
     * Portal dibuka kepada ratusan orang. Satu menu pengurus yang bocor ke
     * peran ini bocor kepada mereka semua sekaligus.
     */
    const anggota = COOPERATIVE_ROLES.find((r) => r.code === 'COOPERATIVE_MEMBER_PORTAL')!;
    const menuKoperasi = Object.keys(anggota.modules).filter((k) => k.startsWith('COOPERATIVE'));
    expect(menuKoperasi).toEqual(['COOPERATIVE_PORTAL']);
  });

  it('TIDAK ada peran petugas yang menyentuh menu portal', () => {
    /*
     * Arah sebaliknya. Petugas yang memegang menu portal akan lolos
     * pemeriksaan hak akses portal — dan portal mengasumsikan pemanggilnya
     * adalah anggota.
     */
    for (const peran of COOPERATIVE_ROLES) {
      if (peran.code === 'COOPERATIVE_MEMBER_PORTAL') continue;
      expect({
        peran: peran.code,
        portal: aksiPada(peran.code, 'COOPERATIVE_PORTAL'),
      }).toEqual({ peran: peran.code, portal: [] });
    }
  });

  it('anggota tidak dapat menyetujui apa pun', () => {
    expect(aksiPada('COOPERATIVE_MEMBER_PORTAL', 'COOPERATIVE_PORTAL')).not.toContain('APPROVE');
  });

  it('cakupan data anggota adalah dirinya sendiri', () => {
    const anggota = COOPERATIVE_ROLES.find((r) => r.code === 'COOPERATIVE_MEMBER_PORTAL')!;
    expect(anggota.dataScope).toBe('SELF');
  });
});

describe('kelompok pemisahan tugas', () => {
  it('peran koperasi ikut membentuk kelompok SoD', () => {
    /*
     * Bila tidak, Ketua dan Petugas Pinjaman dapat dipegang satu orang —
     * pasangan yang paling sering dipakai menyalurkan pinjaman fiktif.
     */
    const groups = buildSodGroups([...TENANT_ROLE_CATALOG, ...COOPERATIVE_ROLES]);
    const pinjaman = groups.find((g) => g.group === 'COOPERATIVE_LOAN');
    expect(pinjaman).toBeDefined();
    const sisi = pinjaman!.members.map((m) => `${m.code}:${m.side}`);
    expect(sisi).toContain('COOPERATIVE_LOAN_OFFICER:PREPARER');
    expect(sisi).toContain('COOPERATIVE_CHAIRMAN:APPROVER');
  });

  it('tidak ada kelompok koperasi yang hanya berisi satu sisi', () => {
    /*
     * Kelompok bersisi tunggal tidak pernah dapat bertentangan. Ia muncul pada
     * layar aturan sebagai pemeriksaan yang tampak berjalan padahal tidak
     * pernah menyala — dan orang mengandalkannya.
     */
    const groups = buildSodGroups([...TENANT_ROLE_CATALOG, ...COOPERATIVE_ROLES]).filter((g) =>
      g.group.startsWith('COOPERATIVE'),
    );
    for (const g of groups) {
      const sisi = new Set(g.members.map((m) => m.side));
      expect({ kelompok: g.group, jumlahSisi: sisi.size }).toEqual({
        kelompok: g.group,
        jumlahSisi: 2,
      });
    }
  });

  it('pemisahan simpanan dan pembukuan tetap dijaga bentuk profilnya', () => {
    // Lapis yang tidak bergantung pada kelompok SoD.
    expect(aksiPada('COOPERATIVE_SAVING_OFFICER', 'COOPERATIVE_SAVING')).not.toContain('APPROVE');
    expect(aksiPada('COOPERATIVE_TREASURER', 'COOPERATIVE_ACCOUNTING')).not.toContain('POST');
  });

  it('kelompok inti tidak terganggu kehadiran peran koperasi', () => {
    const tanpa = buildSodGroups(TENANT_ROLE_CATALOG).map((g) => g.group);
    const dengan = buildSodGroups([...TENANT_ROLE_CATALOG, ...COOPERATIVE_ROLES]).map((g) => g.group);
    for (const g of tanpa) expect(dengan).toContain(g);
  });
});

describe('aksi baru', () => {
  it('ANALYZE, DISBURSE, dan WRITE_OFF benar-benar terpakai', () => {
    // Aksi yang disemai tetapi tidak dipakai peran mana pun adalah baris pada
    // layar pengaturan yang tidak berarti apa-apa.
    const semua = new Set<string>();
    for (const peran of COOPERATIVE_ROLES) {
      for (const m of COOPERATIVE_MENUS) {
        for (const a of aksiPada(peran.code, m.code)) semua.add(a);
      }
    }
    for (const aksi of ['ANALYZE', 'DISBURSE', 'WRITE_OFF']) {
      expect({ aksi, terpakai: semua.has(aksi) }).toEqual({ aksi, terpakai: true });
    }
  });
});
