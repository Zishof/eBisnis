/**
 * Pengujian katalog hak akses POS.
 *
 * Matriks pada `docs/pos-web-priority/04-role-permission-matrix.md` ditulis untuk
 * dibaca manusia. Berkas ini yang memastikan kode benar-benar mengikutinya —
 * sebab dokumen yang menyimpang dari kenyataan lebih berbahaya daripada tidak
 * ada dokumen sama sekali.
 *
 * Satu aturan yang dijaga paling ketat: **kasir tidak dapat menyetujui apa pun.**
 */

import {
  MENU_TREE_SEED,
  PERMISSION_ACTIONS_SEED,
} from '../../infrastructure/provisioning/tenant-menu.seed';
import { PROFILE_ACTIONS, type ProfileCode } from '../../infrastructure/provisioning/role-profile';
import {
  buildMenuModuleMap,
  expandRole,
} from '../../infrastructure/provisioning/role-expansion';
import { ROLE_CATALOG, buildSodGroups } from '../../infrastructure/provisioning/tenant-role.seed';

const AKSI_POS_BARU = [
  'SELL',
  'HOLD',
  'RESUME',
  'DISCOUNT_LINE',
  'DISCOUNT_CART',
  'PRICE_OVERRIDE',
  'OPEN_SHIFT',
  'CLOSE_SHIFT',
  'CASH_MOVE',
];

const MENU_POS = [
  'POS',
  'POS_SALE',
  'POS_HELD',
  'POS_SHIFT',
  'POS_CASH',
  'POS_RETURN',
  'POS_TERMINAL',
  'POS_REGISTER_ASSIGN',
  'POS_REPORT',
];

const peran = (code: string) => {
  const r = ROLE_CATALOG.find((x) => x.code === code);
  if (!r) throw new Error(`Peran ${code} tidak ada pada katalog`);
  return r;
};

const moduleMap = buildMenuModuleMap();
const izin = (code: string) => expandRole(peran(code), MENU_TREE_SEED, moduleMap).permissions;

describe('aksi hak akses POS', () => {
  it('kesembilan aksi kasir terdaftar', () => {
    const kode = new Set(PERMISSION_ACTIONS_SEED.map((a) => a.code));
    for (const a of AKSI_POS_BARU) expect(kode).toContain(a);
  });

  it('kode aksi tidak kembar', () => {
    const kode = PERMISSION_ACTIONS_SEED.map((a) => a.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('urutan aksi tidak kembar', () => {
    const urutan = PERMISSION_ACTIONS_SEED.map((a) => a.sortOrder);
    expect(new Set(urutan).size).toBe(urutan.length);
  });

  it('PRICE_OVERRIDE dan CASH_MOVE ditandai sensitif', () => {
    // Keduanya menyentuh uang secara langsung. Penandaan sensitif adalah yang
    // membuat keduanya muncul pada tinjauan hak akses berkala.
    for (const kode of ['PRICE_OVERRIDE', 'CASH_MOVE']) {
      const a = PERMISSION_ACTIONS_SEED.find((x) => x.code === kode);
      expect(a?.actionType).toBe('SENSITIVE');
    }
  });

  it('tidak membuat aksi yang artinya sama dengan aksi yang sudah ada', () => {
    // Keputusan yang dicatat pada matriks: pembatalan baris adalah UPDATE,
    // pembatalan transaksi selesai adalah CANCEL, dan melihat kasir lain adalah
    // persoalan cakupan data. Ketiganya sengaja TIDAK menjadi aksi baru.
    const kode = new Set(PERMISSION_ACTIONS_SEED.map((a) => a.code));
    expect(kode).not.toContain('VOID_LINE');
    expect(kode).not.toContain('VOID_SALE');
    expect(kode).not.toContain('VIEW_OTHER_CASHIER');
  });
});

describe('menu POS', () => {
  it('kesembilan menu terdaftar dan bercabang dari POS', () => {
    const semua = new Map(MENU_TREE_SEED.map((m) => [m.code, m]));
    for (const kode of MENU_POS) expect(semua.has(kode)).toBe(true);
    for (const kode of MENU_POS.filter((k) => k !== 'POS')) {
      expect(semua.get(kode)?.parentCode).toBe('POS');
    }
  });

  it('tidak ada menu POS yang masih bertanda belum tersedia', () => {
    /*
     * Menu bertanda `comingSoon` mengarahkan pengguna ke halaman status. Sejak
     * POS dibangun sungguhan, penanda itu harus lepas — bila tidak, kasir yang
     * mengklik menunya akan melihat "segera hadir" di atas fitur yang sudah ada.
     */
    for (const kode of MENU_POS) {
      const m = MENU_TREE_SEED.find((x) => x.code === kode);
      expect(m?.comingSoon ?? false).toBe(false);
    }
  });

  it('setiap aksi yang ditawarkan menu POS memang terdaftar', () => {
    // Menu yang menawarkan aksi tak dikenal menghasilkan izin yang tidak pernah
    // dapat diberikan — persis cacat CRM.CREATE yang ditemukan pada V10.
    const dikenal = new Set(PERMISSION_ACTIONS_SEED.map((a) => a.code));
    for (const kode of MENU_POS) {
      const m = MENU_TREE_SEED.find((x) => x.code === kode);
      for (const aksi of m?.actions ?? []) expect(dikenal).toContain(aksi);
    }
  });

  it('setiap menu POS punya rute', () => {
    for (const kode of MENU_POS.filter((k) => k !== 'POS')) {
      expect(MENU_TREE_SEED.find((x) => x.code === kode)?.route).toMatch(/^\/app\/pos/);
    }
  });
});

describe('profil kasir K1–K4', () => {
  it('keempatnya terdaftar', () => {
    for (const p of ['K1', 'K2', 'K3', 'K4'] as ProfileCode[]) {
      expect(PROFILE_ACTIONS[p]).toBeDefined();
      expect(PROFILE_ACTIONS[p].length).toBeGreaterThan(0);
    }
  });

  it('kasir tidak dapat menyetujui apa pun', () => {
    /*
     * Inti seluruh berkas ini. Kasir yang dapat menyetujui refundnya sendiri
     * membuat pemisahan wewenang menjadi hiasan.
     */
    const k1 = PROFILE_ACTIONS.K1 as readonly string[];
    for (const aksi of ['APPROVE', 'RETURN_APPROVE', 'REFUND_APPROVE']) {
      expect(k1).not.toContain(aksi);
    }
  });

  it('kasir tidak melihat harga pokok maupun margin', () => {
    const k1 = PROFILE_ACTIONS.K1 as readonly string[];
    expect(k1).not.toContain('VIEW_COST');
    expect(k1).not.toContain('VIEW_PROFIT');
  });

  it('kasir tidak memindahkan kas dan tidak mengubah harga', () => {
    const k1 = PROFILE_ACTIONS.K1 as readonly string[];
    expect(k1).not.toContain('CASH_MOVE');
    expect(k1).not.toContain('PRICE_OVERRIDE');
    expect(k1).not.toContain('DISCOUNT_CART');
  });

  it('kasir dapat menjalankan transaksi dan shiftnya sendiri', () => {
    const k1 = PROFILE_ACTIONS.K1 as readonly string[];
    for (const aksi of ['SELL', 'HOLD', 'RESUME', 'DISCOUNT_LINE', 'OPEN_SHIFT', 'CLOSE_SHIFT']) {
      expect(k1).toContain(aksi);
    }
  });

  it('supervisor menambah persetujuan, kas, dan rekonsiliasi', () => {
    const k2 = PROFILE_ACTIONS.K2 as readonly string[];
    for (const aksi of [
      'APPROVE', 'RETURN_APPROVE', 'REFUND_APPROVE',
      'CASH_MOVE', 'RECONCILE', 'DISCOUNT_CART', 'PRICE_OVERRIDE', 'CANCEL',
    ]) {
      expect(k2).toContain(aksi);
    }
  });

  it('supervisor tetap tidak melihat harga pokok', () => {
    // Yang membedakan supervisor dari kepala toko. Supervisor mengawasi
    // jalannya kas dan transaksi; margin adalah urusan kepala toko ke atas.
    expect(PROFILE_ACTIONS.K2 as readonly string[]).not.toContain('VIEW_COST');
  });

  it('kepala toko melihat harga pokok dan margin', () => {
    const k3 = PROFILE_ACTIONS.K3 as readonly string[];
    expect(k3).toContain('VIEW_COST');
    expect(k3).toContain('VIEW_PROFIT');
  });

  it('kepala toko tidak kehilangan hak yang dimiliki supervisor', () => {
    // Peran yang lebih tinggi namun lebih tidak berdaya mendorong orang berbagi
    // kata sandi, dan itu lebih buruk daripada memberi izinnya secara terbuka.
    const k2 = PROFILE_ACTIONS.K2 as readonly string[];
    const k3 = PROFILE_ACTIONS.K3 as readonly string[];
    for (const aksi of k2) expect(k3).toContain(aksi);
  });

  it('auditor membaca segalanya tanpa mengubah apa pun', () => {
    const k4 = PROFILE_ACTIONS.K4 as readonly string[];
    expect(k4).toContain('AUDIT_READ');
    expect(k4).toContain('VIEW_COST');
    for (const aksi of ['CREATE', 'UPDATE', 'DELETE', 'SELL', 'APPROVE', 'CASH_MOVE']) {
      expect(k4).not.toContain(aksi);
    }
  });
});

describe('peran POS setelah diturunkan menjadi izin menu', () => {
  it('enam peran POS ada pada katalog', () => {
    for (const kode of [
      'KASIR_POS',
      'SUPERVISOR_KASIR',
      'KEPALA_TOKO',
      'ADMIN_TOKO',
      'PETUGAS_GUDANG_OUTLET',
      'AUDITOR_POS',
    ]) {
      expect(ROLE_CATALOG.some((r) => r.code === kode)).toBe(true);
    }
  });

  it('kasir memperoleh SELL pada layar kasir', () => {
    expect(izin('KASIR_POS').POS_SALE).toContain('SELL');
  });

  it('kasir TIDAK memperoleh APPROVE pada layar kasir', () => {
    expect(izin('KASIR_POS').POS_SALE ?? []).not.toContain('APPROVE');
  });

  it('kasir tidak memperoleh akses kas sama sekali', () => {
    // Menu POS_CASH hanya menawarkan CASH_MOVE, RECONCILE, READ, PRINT, EXPORT.
    // Kasir punya READ dan PRINT, jadi ia melihat halamannya tanpa dapat
    // memindahkan kas — itu memang yang diinginkan.
    const kas = izin('KASIR_POS').POS_CASH ?? [];
    expect(kas).not.toContain('CASH_MOVE');
    expect(kas).not.toContain('RECONCILE');
  });

  it('supervisor memperoleh kas dan rekonsiliasi', () => {
    const kas = izin('SUPERVISOR_KASIR').POS_CASH ?? [];
    expect(kas).toContain('CASH_MOVE');
    expect(kas).toContain('RECONCILE');
  });

  it('supervisor memperoleh persetujuan retur dan refund', () => {
    const retur = izin('SUPERVISOR_KASIR').POS_RETURN ?? [];
    expect(retur).toContain('RETURN_APPROVE');
    expect(retur).toContain('REFUND_APPROVE');
  });

  it('kasir dapat membuat retur tetapi tidak menyetujuinya', () => {
    const retur = izin('KASIR_POS').POS_RETURN ?? [];
    expect(retur).toContain('RETURN');
    expect(retur).not.toContain('RETURN_APPROVE');
    expect(retur).not.toContain('REFUND_APPROVE');
  });

  it('administrator toko mengelola terminal dan penugasan register', () => {
    const p = izin('ADMIN_TOKO');
    expect(p.POS_TERMINAL).toContain('CREATE');
    expect(p.POS_TERMINAL).toContain('UPDATE');
    expect(p.POS_REGISTER_ASSIGN).toContain('CREATE');
  });

  it('administrator toko tidak menyentuh satu pun jalur uang', () => {
    /*
     * Batas yang sesungguhnya. Ia memasang mesin kasir; ia tidak berjualan,
     * tidak memindahkan kas, tidak menyetujui apa pun, dan tidak mengubah harga.
     * Inilah alasan K5 dibuat alih-alih memakai P7 — profil manajer modul umum
     * membawa APPROVE dan CANCEL, yang pada layar kasir berarti menyetujui
     * diskon dan membatalkan transaksi yang sudah dibayar.
     */
    const p = izin('ADMIN_TOKO');
    const semua = Object.values(p).flat();
    for (const terlarang of [
      'SELL', 'CASH_MOVE', 'RECONCILE', 'PRICE_OVERRIDE',
      'DISCOUNT_CART', 'RETURN_APPROVE', 'REFUND_APPROVE', 'CANCEL',
    ]) {
      expect(semua).not.toContain(terlarang);
    }
  });

  it('petugas gudang outlet melihat POS tanpa dapat bertransaksi', () => {
    const p = izin('PETUGAS_GUDANG_OUTLET');
    expect(p.POS_SALE ?? []).toContain('READ');
    expect(p.POS_SALE ?? []).not.toContain('SELL');
  });

  it('auditor POS membaca laporan berbiaya tanpa dapat menjual', () => {
    const p = izin('AUDITOR_POS');
    expect(p.POS_REPORT).toContain('VIEW_COST');
    expect(p.POS_REPORT).toContain('AUDIT_READ');
    expect(p.POS_SALE ?? []).not.toContain('SELL');
  });

  it('kasir dibatasi pada satu outlet dan terminal', () => {
    expect(peran('KASIR_POS').dataScope).toBe('OUTLET_TERMINAL');
  });

  it('supervisor dan kepala toko dibatasi pada outlet', () => {
    expect(peran('SUPERVISOR_KASIR').dataScope).toBe('OUTLET');
    expect(peran('KEPALA_TOKO').dataScope).toBe('OUTLET');
  });
});

describe('pemisahan wewenang POS', () => {
  const kelompok = buildSodGroups();

  it('kelompok POS_VOID memisahkan penyiap dari penyetuju', () => {
    const g = kelompok.find((x) => x.group === 'POS_VOID');
    expect(g).toBeDefined();
    const sisi = new Set(g?.members.map((m) => m.side));
    expect(sisi.has('PREPARER')).toBe(true);
    expect(sisi.has('APPROVER')).toBe(true);
  });

  it('kasir adalah penyiap, supervisor adalah penyetuju', () => {
    expect(peran('KASIR_POS').sodSide).toBe('PREPARER');
    expect(peran('SUPERVISOR_KASIR').sodSide).toBe('APPROVER');
  });

  it('kelompok POS_CASH memisahkan pemegang alat dari pemeriksanya', () => {
    const g = kelompok.find((x) => x.group === 'POS_CASH');
    expect(g).toBeDefined();
    expect(new Set(g?.members.map((m) => m.side)).size).toBeGreaterThanOrEqual(2);
  });

  it('setiap kelompok yang tersisa benar-benar melarang sesuatu', () => {
    // buildSodGroups membuang kelompok bersisi tunggal. Bila ada yang lolos,
    // artinya ada aturan yang disemai tetapi tidak pernah berlaku.
    for (const g of kelompok) {
      expect(new Set(g.members.map((m) => m.side)).size).toBeGreaterThanOrEqual(2);
    }
  });
});
