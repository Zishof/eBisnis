/**
 * Pengujian katalog vertikal eSchool.
 *
 * Yang diuji bukan bahwa menunya lengkap — itu berubah terus. Yang diuji adalah
 * **pemisahan wewenang** yang menjadi alasan menu dipecah menjadi tujuh modul,
 * dan yang bila hilang tidak menghasilkan galat apa pun: layarnya tetap terbuka,
 * datanya tetap tampil, dan yang membacanya adalah orang yang tidak berhak.
 */

import { PROFILE_ACTIONS } from '../../../infrastructure/provisioning/role-profile';
import {
  ESCHOOL_MENUS,
  ESCHOOL_PREFIX,
  ESCHOOL_ROLES,
  ESCHOOL_VERTICAL_CATALOG,
} from './eschool-vertical.catalog';

const peran = (code: string) => {
  const r = ESCHOOL_ROLES.find((x) => x.code === code);
  if (!r) throw new Error(`Peran ${code} tidak ada`);
  return r;
};

/** Aksi yang benar-benar diperoleh sebuah peran pada sebuah modul. */
const aksiPada = (roleCode: string, moduleCode: string): readonly string[] => {
  const profil = peran(roleCode).modules[moduleCode];
  return profil ? PROFILE_ACTIONS[profil] : [];
};

describe('katalog eSchool', () => {
  it('seluruh menu memakai awalan vertikal', () => {
    // Registri menolak katalog yang menunya keluar dari awalannya. Diperiksa di
    // sini pula supaya kegagalannya menyebut menu yang salah, bukan sekadar
    // "katalog ditolak".
    for (const m of ESCHOOL_MENUS) {
      expect(m.code.startsWith(ESCHOOL_PREFIX)).toBe(true);
    }
  });

  it('setiap menu menyatakan aksinya', () => {
    // Menu tanpa daftar aksi hanya menawarkan READ. Layar yang seharusnya dapat
    // mencatat lalu tampak hanya dapat dibaca — tanpa galat.
    for (const m of ESCHOOL_MENUS) {
      expect(m.actions?.length ?? 0).toBeGreaterThan(0);
    }
  });

  it('setiap menu anak menunjuk induk yang ada', () => {
    const kode = new Set(ESCHOOL_MENUS.map((m) => m.code));
    for (const m of ESCHOOL_MENUS) {
      if (m.parentCode) expect(kode.has(m.parentCode)).toBe(true);
    }
  });

  it('katalog terdaftar dengan kode modul yang canonical', () => {
    expect(ESCHOOL_VERTICAL_CATALOG.code).toBe('eschool');
    for (const m of ESCHOOL_MENUS) {
      expect(m.moduleCode).toBe('eschool');
    }
  });
});

describe('pemisahan wewenang eSchool', () => {
  it('guru mencatat nilai tetapi TIDAK membaca bimbingan konseling', () => {
    /*
     * Catatan konseling menyangkut keluarga dan sering memuat hal yang tidak
     * boleh dibaca setiap guru. Inilah alasan Bimbingan menjadi modul
     * tersendiri: profil diberikan per modul, sehingga bimbingan yang bernaung
     * di bawah Pembelajaran akan ikut terbuka bagi setiap pemegang profilnya.
     */
    expect(aksiPada('ESCHOOL_TEACHER', 'ESCHOOL_LEARNING')).toContain('CREATE');
    expect(peran('ESCHOOL_TEACHER').modules.ESCHOOL_GUIDANCE).toBeUndefined();
  });

  it('guru BK mencatat bimbingan tetapi TIDAK memasukkan nilai', () => {
    // Kebalikan dari guru. Keduanya tidak dapat ditulis sebagai satu profil.
    expect(aksiPada('ESCHOOL_COUNSELOR', 'ESCHOOL_GUIDANCE')).toContain('CREATE');
    expect(aksiPada('ESCHOOL_COUNSELOR', 'ESCHOOL_LEARNING')).not.toContain('CREATE');
  });

  it('guru tidak melihat keuangan sama sekali', () => {
    expect(peran('ESCHOOL_TEACHER').modules.ESCHOOL_FINANCE).toBeUndefined();
    expect(peran('ESCHOOL_HOMEROOM_TEACHER').modules.ESCHOOL_FINANCE).toBeUndefined();
  });

  it('petugas keuangan mencatat tagihan tetapi tidak menyetujuinya', () => {
    const aksi = aksiPada('ESCHOOL_FINANCE_OFFICER', 'ESCHOOL_FINANCE');
    expect(aksi).toContain('CREATE');
    expect(aksi).not.toContain('APPROVE');
  });

  it('kepala sekolah menyetujui tetapi tidak mencatat rapor', () => {
    // Pemisahan inilah yang membuat persetujuannya berarti.
    const aksi = aksiPada('ESCHOOL_PRINCIPAL', 'ESCHOOL_LEARNING');
    expect(aksi).toContain('APPROVE');
    expect(aksi).not.toContain('CREATE');
  });

  it('penyusun dan pengesah rapor berada pada sisi SoD yang berlawanan', () => {
    expect(peran('ESCHOOL_TEACHER').sodGroup).toBe('ESCHOOL_REPORT_CARD');
    expect(peran('ESCHOOL_TEACHER').sodSide).toBe('PREPARER');
    expect(peran('ESCHOOL_PRINCIPAL').sodGroup).toBe('ESCHOOL_REPORT_CARD');
    expect(peran('ESCHOOL_PRINCIPAL').sodSide).toBe('APPROVER');
  });

  it('operator SPMB tidak berlanjut ke data murid aktif', () => {
    // Haknya musiman. Membiarkannya melekat berarti akun yang menganggur
    // sepanjang tahun tetap memegang seluruh data murid.
    const r = peran('ESCHOOL_ADMISSION_OFFICER');
    expect(r.modules.ESCHOOL_ADMISSION).toBeDefined();
    expect(aksiPada('ESCHOOL_ADMISSION_OFFICER', 'ESCHOOL_STUDENT')).not.toContain('UPDATE');
  });

  it('operator Dapodik membaca, tidak mengubah', () => {
    expect(aksiPada('ESCHOOL_DAPODIK_OPERATOR', 'ESCHOOL_STUDENT')).not.toContain('UPDATE');
    expect(aksiPada('ESCHOOL_DAPODIK_OPERATOR', 'ESCHOOL_REPORTING')).toContain('CREATE');
  });
});

describe('peran wali murid', () => {
  it('HANYA memegang modul portal — tidak satu pun modul sekolah', () => {
    /*
     * Uji yang paling menentukan pada berkas ini.
     *
     * Wali adalah satu-satunya pemegang peran dari LUAR institusi. Satu modul
     * sekolah yang bocor ke sini — bahkan yang hanya "lihat" — berarti setiap
     * wali dapat membuka daftar seluruh murid.
     */
    const modul = Object.keys(peran('ESCHOOL_PARENT').modules);
    expect(modul).toEqual(['ESCHOOL_PARENT_PORTAL']);
  });

  it('cakupan datanya GUARDIAN_CHILD, bukan TENANT', () => {
    expect(peran('ESCHOOL_PARENT').dataScope).toBe('GUARDIAN_CHILD');
  });

  it('tidak memperoleh aksi tulis, sebab menunya tidak menawarkannya', () => {
    /*
     * Yang diperoleh adalah IRISAN profil dengan aksi yang ditawarkan menu
     * (`role-expansion.ts`), bukan profilnya saja.
     *
     * Profil `P10` sendiri memuat CREATE, UPDATE, dan SUBMIT — pantas untuk
     * layanan mandiri, misalnya wali mengajukan izin. Yang menahannya di portal
     * ini adalah menunya, yang hanya menawarkan READ dan PRINT.
     *
     * Karena itu yang diuji irisannya. Menguji profil saja akan merah pada
     * keadaan yang sebenarnya aman; menguji menu saja akan hijau seandainya
     * peran wali kelak diberi profil yang lebih luas.
     */
    const menu = ESCHOOL_MENUS.find((m) => m.code === 'ESCHOOL_PARENT_PORTAL')!;
    const ditawarkan = menu.actions ?? [];
    const dimiliki = aksiPada('ESCHOOL_PARENT', 'ESCHOOL_PARENT_PORTAL');
    const diperoleh = ditawarkan.filter((a) => dimiliki.includes(a));

    expect(diperoleh).toEqual(['READ', 'PRINT']);
    for (const terlarang of ['CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'POST']) {
      expect(diperoleh).not.toContain(terlarang);
    }
  });

  it('tidak ada peran LAIN yang memegang modul portal wali', () => {
    // Portal wali menampilkan data dengan asumsi pembacanya seorang wali. Peran
    // lain yang memegangnya akan membacanya dengan cakupan yang berbeda.
    const pemegang = ESCHOOL_ROLES.filter((r) => r.modules.ESCHOOL_PARENT_PORTAL);
    expect(pemegang.map((r) => r.code)).toEqual(['ESCHOOL_PARENT']);
  });
});
