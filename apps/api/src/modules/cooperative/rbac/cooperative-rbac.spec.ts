/**
 * Pengujian katalog menu, hak akses, dan peran koperasi.
 *
 * Dua sifat dijaga paling ketat:
 *
 *   1. **Tidak ada peran yang memegang kedua sisi sebuah pemisahan wewenang.**
 *   2. **Peran anggota tidak pernah memuat izin pengurus.**
 *
 * Keduanya diperiksa di sini, bukan diserahkan pada ingatan orang yang
 * menyusun peran. Koperasi mengelola uang anggotanya sendiri dengan petugas
 * yang sedikit dan saling mengenal — di sanalah pemisahan wewenang paling
 * mudah luntur.
 */

import {
  AKSI_PER_MENU,
  CATALOG_RBAC_KOPERASI,
  HAK_AKSES_KOPERASI,
  KONFLIK_WEWENANG,
  MENU_KOPERASI,
  PERAN_KOPERASI,
  menuDariHakAkses,
  periksaKonflik,
} from './cooperative-rbac.catalog';

describe('menu koperasi', () => {
  it('setiap kode menu berbeda', () => {
    const kode = MENU_KOPERASI.map((m) => m.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('setiap induk yang disebut memang ada', () => {
    const kode = new Set(MENU_KOPERASI.map((m) => m.code));
    for (const m of MENU_KOPERASI) {
      if (m.parent !== null) expect(kode.has(m.parent)).toBe(true);
    }
  });

  it('setiap menu berawalan COOPERATIVE', () => {
    // Batas namespace pada panduan koordinasi §4.
    for (const m of MENU_KOPERASI) expect(m.code.startsWith('COOPERATIVE')).toBe(true);
  });

  it('PORTAL ANGGOTA bukan submenu dari menu pengurus', () => {
    /*
     * Portal bukan versi kecil dari layar pengurus melainkan permukaan
     * tersendiri. Menempatkannya sebagai anak menu pengurus adalah langkah
     * pertama menuju peran yang tanpa sengaja mewarisi keduanya.
     */
    const portal = MENU_KOPERASI.find((m) => m.code === 'COOPERATIVE_PORTAL');
    expect(portal?.parent).toBeNull();
  });

  it('jalur portal berada di luar /app', () => {
    const portal = MENU_KOPERASI.find((m) => m.code === 'COOPERATIVE_PORTAL');
    expect(portal?.path.startsWith('/app')).toBe(false);
  });

  it('setiap menu selain induk punya daftar aksi', () => {
    for (const m of MENU_KOPERASI) {
      if (m.code === 'COOPERATIVE') continue;
      expect(AKSI_PER_MENU[m.code]).toBeDefined();
      expect(AKSI_PER_MENU[m.code].length).toBeGreaterThan(0);
    }
  });
});

describe('hak akses', () => {
  it('setiap kode berbentuk MENU.AKSI', () => {
    for (const p of HAK_AKSES_KOPERASI) expect(p).toMatch(/^COOPERATIVE[A-Z_]*\.[A-Z]+$/);
  });

  it('TIDAK ADA izin DELETE di mana pun', () => {
    /*
     * Bukan kelalaian. Tidak ada satu pun catatan koperasi yang boleh dihapus:
     * anggota berhenti, pinjaman dihapusbukukan, pengaduan ditutup — semuanya
     * perubahan status yang menyisakan barisnya. Izin DELETE adalah izin
     * menghilangkan jejak, dan koperasi tempat yang jejaknya paling perlu
     * bertahan.
     */
    expect(HAK_AKSES_KOPERASI.filter((p) => p.endsWith('.DELETE'))).toEqual([]);
  });

  it('setiap kode berbeda', () => {
    expect(new Set(HAK_AKSES_KOPERASI).size).toBe(HAK_AKSES_KOPERASI.length);
  });

  it('menuDariHakAkses mengembalikan menunya', () => {
    expect(menuDariHakAkses('COOPERATIVE_LOAN.APPROVE')).toBe('COOPERATIVE_LOAN');
    expect(menuDariHakAkses('COOPERATIVE_PORTAL.READ')).toBe('COOPERATIVE_PORTAL');
  });
});

describe('peran', () => {
  it('setiap izin yang dipakai peran memang ada di katalog', () => {
    const sah = new Set(HAK_AKSES_KOPERASI);
    for (const peran of PERAN_KOPERASI) {
      for (const p of peran.permissions) {
        expect(sah.has(p)).toBe(true);
      }
    }
  });

  it('tidak ada peran yang mengulang izin yang sama', () => {
    for (const peran of PERAN_KOPERASI) {
      expect(new Set(peran.permissions).size).toBe(peran.permissions.length);
    }
  });

  it('setiap peran punya sekurang-kurangnya satu izin', () => {
    for (const peran of PERAN_KOPERASI) {
      expect(peran.permissions.length).toBeGreaterThan(0);
    }
  });
});

describe('pemisahan wewenang', () => {
  it('TIDAK ADA peran bawaan yang memegang kedua sisi sebuah konflik', () => {
    for (const peran of PERAN_KOPERASI) {
      const hasil = periksaKonflik(peran.permissions);
      expect({
        peran: peran.code,
        konflik: hasil.konflik.map((k) => `${k.a} + ${k.b}`),
      }).toEqual({ peran: peran.code, konflik: [] });
    }
  });

  it('menangkap konflik ketika benar-benar ada', () => {
    // Menguji bahwa penjaganya berfungsi, bukan hanya bahwa peran bawaan lolos.
    const hasil = periksaKonflik([
      'COOPERATIVE_LOAN.CREATE',
      'COOPERATIVE_LOAN.APPROVE',
    ]);
    expect(hasil.ok).toBe(false);
    expect(hasil.konflik).toHaveLength(1);
  });

  it('menangkap penganalisis yang sekaligus penyetuju', () => {
    const hasil = periksaKonflik([
      'COOPERATIVE_CREDIT_ANALYSIS.CREATE',
      'COOPERATIVE_LOAN.APPROVE',
    ]);
    expect(hasil.ok).toBe(false);
  });

  it('petugas pinjaman menganalisis tetapi TIDAK menyetujui', () => {
    const petugas = PERAN_KOPERASI.find((p) => p.code === 'COOPERATIVE_LOAN_OFFICER')!;
    expect(petugas.permissions).toContain('COOPERATIVE_CREDIT_ANALYSIS.CREATE');
    expect(petugas.permissions).not.toContain('COOPERATIVE_LOAN.APPROVE');
  });

  it('ketua menyetujui tetapi TIDAK mencatat', () => {
    // Pemisahan itulah yang membuat persetujuannya berarti.
    const ketua = PERAN_KOPERASI.find((p) => p.code === 'COOPERATIVE_CHAIRMAN')!;
    expect(ketua.permissions).toContain('COOPERATIVE_LOAN.APPROVE');
    expect(ketua.permissions).not.toContain('COOPERATIVE_LOAN.CREATE');
    expect(ketua.permissions).not.toContain('COOPERATIVE_SAVING.CREATE');
  });

  it('setiap pasangan konflik menyebutkan alasannya', () => {
    for (const k of KONFLIK_WEWENANG) {
      expect(k.alasan.length).toBeGreaterThan(30);
    }
  });

  it('kedua sisi setiap konflik adalah izin yang benar-benar ada', () => {
    const sah = new Set(HAK_AKSES_KOPERASI);
    for (const k of KONFLIK_WEWENANG) {
      expect(sah.has(k.a)).toBe(true);
      expect(sah.has(k.b)).toBe(true);
    }
  });
});

describe('pengawas', () => {
  it('HANYA membaca dan mengekspor', () => {
    /*
     * Pengawas yang dapat mengubah data tidak lagi dapat mengawasinya —
     * ia menjadi pihak yang perlu diawasi.
     */
    const pengawas = PERAN_KOPERASI.find((p) => p.code === 'COOPERATIVE_SUPERVISOR')!;
    for (const p of pengawas.permissions) {
      expect(['READ', 'EXPORT']).toContain(p.split('.')[1]);
    }
  });

  it('tetap dapat melihat analisis kredit dan penagihan', () => {
    // Justru di sanalah penyimpangan paling mungkin ditemukan.
    const pengawas = PERAN_KOPERASI.find((p) => p.code === 'COOPERATIVE_SUPERVISOR')!;
    expect(pengawas.permissions).toContain('COOPERATIVE_CREDIT_ANALYSIS.READ');
    expect(pengawas.permissions).toContain('COOPERATIVE_COLLECTION.READ');
  });
});

describe('peran anggota terpisah dari peran petugas', () => {
  const anggota = PERAN_KOPERASI.filter((p) => p.isMemberRole);

  it('ada tepat satu peran anggota', () => {
    expect(anggota).toHaveLength(1);
  });

  it('peran anggota TIDAK memuat satu pun izin di luar COOPERATIVE_PORTAL', () => {
    /*
     * Portal dibuka kepada ratusan orang. Satu izin pengurus yang bocor ke
     * sini bocor kepada mereka semua sekaligus.
     */
    for (const p of anggota[0].permissions) {
      expect(p.startsWith('COOPERATIVE_PORTAL.')).toBe(true);
    }
  });

  it('peran anggota tidak dapat melihat daftar anggota', () => {
    expect(anggota[0].permissions).not.toContain('COOPERATIVE_MEMBER.READ');
  });

  it('peran anggota tidak dapat menyetujui apa pun', () => {
    expect(anggota[0].permissions.filter((p) => p.endsWith('.APPROVE'))).toEqual([]);
  });

  it('TIDAK ADA peran petugas yang memegang izin portal', () => {
    /*
     * Arahnya dua-duanya. Petugas yang memegang COOPERATIVE_PORTAL.READ akan
     * lolos pemeriksaan hak akses portal — dan portal mengasumsikan
     * pemanggilnya adalah anggota.
     */
    for (const peran of PERAN_KOPERASI.filter((p) => !p.isMemberRole)) {
      expect(peran.permissions.filter((p) => p.startsWith('COOPERATIVE_PORTAL.'))).toEqual([]);
    }
  });
});

describe('bentuk katalog', () => {
  it('sesuai bentuk yang diusulkan IR-004', () => {
    expect(CATALOG_RBAC_KOPERASI.module).toBe('cooperative');
    expect(CATALOG_RBAC_KOPERASI.menus).toBe(MENU_KOPERASI);
    expect(CATALOG_RBAC_KOPERASI.permissions).toBe(HAK_AKSES_KOPERASI);
    expect(CATALOG_RBAC_KOPERASI.roles).toBe(PERAN_KOPERASI);
    expect(CATALOG_RBAC_KOPERASI.separationOfDuties).toBe(KONFLIK_WEWENANG);
  });

  it('setiap izin yang dipakai penjaga endpoint ada di katalog', () => {
    /*
     * Daftar ini disalin dari dekorator @Permissions pada cooperative.module.ts.
     * Bila endpoint memakai izin yang tidak pernah disemai, ia menolak setiap
     * permintaan selamanya — dan tidak ada yang mengetahuinya sampai seseorang
     * mencoba membukanya.
     */
    const dipakaiEndpoint = [
      'COOPERATIVE_PROFILE.READ',
      'COOPERATIVE_PROFILE.CREATE',
      'COOPERATIVE_PROFILE.UPDATE',
      'COOPERATIVE_PROFILE.APPROVE',
      'COOPERATIVE_PORTAL.READ',
      'COOPERATIVE_PORTAL.UPDATE',
      'COOPERATIVE_WEBSITE.READ',
      'COOPERATIVE_WEBSITE.UPDATE',
    ];
    const sah = new Set(HAK_AKSES_KOPERASI);
    for (const p of dipakaiEndpoint) expect(sah.has(p)).toBe(true);
  });
});
