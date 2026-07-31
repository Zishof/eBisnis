/**
 * Pengujian menu portal anggota.
 *
 * Menu portal menentukan apa yang dilihat ratusan anggota. Satu entri yang
 * lolos ke tempat yang salah lebih baik ditangkap di sini daripada oleh
 * anggota yang membukanya.
 */

import { describe, expect, it } from 'vitest';
import {
  LABEL_JENIS_SIMPANAN,
  LABEL_KATEGORI_PENGADUAN,
  LABEL_STATUS_PENGADUAN,
  MENU_PORTAL,
  TERLARANG_DI_PORTAL,
  formatRupiah,
  formatTanggal,
  menuUntuk,
} from './portal-menu';

describe('menu portal', () => {
  it('tidak memuat satu pun layar pengurus', () => {
    /*
     * Portal anggota bukan versi kecil dari layar pengurus; ia permukaan yang
     * berbeda dengan pembaca yang berbeda.
     */
    for (const m of MENU_PORTAL) {
      expect(TERLARANG_DI_PORTAL).not.toContain(m.path);
    }
  });

  it('tidak memuat daftar seluruh anggota', () => {
    expect(MENU_PORTAL.some((m) => m.path === 'anggota')).toBe(false);
  });

  it('setiap entri punya jalur yang berbeda', () => {
    const jalur = MENU_PORTAL.map((m) => m.path);
    expect(new Set(jalur).size).toBe(jalur.length);
  });

  it('setiap jalur bersifat relatif, bukan alamat luar', () => {
    for (const m of MENU_PORTAL) {
      expect(m.path).not.toMatch(/^https?:/);
      expect(m.path).not.toMatch(/^\//);
    }
  });
});

describe('menu menurut status keanggotaan', () => {
  it('anggota aktif melihat seluruh menu', () => {
    expect(menuUntuk('ACTIVE')).toHaveLength(MENU_PORTAL.length);
  });

  it('bekas anggota tidak melihat menu apa pun', () => {
    expect(menuUntuk('TERMINATED')).toEqual([]);
  });

  it('calon anggota hanya melihat yang memang sudah ada isinya', () => {
    // Menampilkan menu yang seluruhnya kosong membuat portal terasa rusak,
    // bukan terasa lengkap.
    const menu = menuUntuk('PROSPECT');
    expect(menu.map((m) => m.path).sort()).toEqual(['', 'pemberitahuan', 'pengaduan']);
  });

  it('calon anggota TIDAK melihat menu SHU maupun RAT', () => {
    const jalur = menuUntuk('PROSPECT').map((m) => m.path);
    expect(jalur).not.toContain('shu');
    expect(jalur).not.toContain('rat');
  });

  it('anggota yang dibekukan tetap dapat mengadu', () => {
    /*
     * Pembekuan justru saat seorang anggota paling mungkin ingin menyatakan
     * keberatan. Yang hilang adalah hak suaranya, bukan haknya bersuara.
     */
    const jalur = menuUntuk('SUSPENDED').map((m) => m.path);
    expect(jalur).toContain('pengaduan');
    expect(jalur).not.toContain('rat');
  });

  it('anggota yang dibekukan tetap melihat simpanannya', () => {
    expect(menuUntuk('SUSPENDED').map((m) => m.path)).toContain('simpanan');
  });
});

describe('format tampilan', () => {
  it('menampilkan rupiah tanpa pecahan', () => {
    expect(formatRupiah('1500000')).toContain('1.500.000');
  });

  it('nilai kosong menjadi nol, bukan NaN', () => {
    expect(formatRupiah(null)).toContain('0');
    expect(formatRupiah('bukan angka')).toBe('Rp0');
  });

  it('tanggal kosong menjadi tanda hubung, bukan Invalid Date', () => {
    expect(formatTanggal(null)).toBe('—');
    expect(formatTanggal('bukan tanggal')).toBe('—');
  });

  it('tanggal ditulis dalam bahasa Indonesia', () => {
    expect(formatTanggal('2026-08-17T00:00:00.000Z')).toContain('Agustus');
  });
});

describe('label', () => {
  it('setiap status pengaduan punya label yang dapat dibaca anggota', () => {
    for (const s of [
      'SUBMITTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CLOSED',
    ]) {
      expect(LABEL_STATUS_PENGADUAN[s]).toBeTruthy();
      expect(LABEL_STATUS_PENGADUAN[s]).not.toBe(s);
    }
  });

  it('setiap kategori pengaduan punya label', () => {
    for (const k of [
      'SERVICE', 'SAVING', 'LOAN', 'SHU', 'GOVERNANCE', 'STAFF', 'UNIT_BUSINESS', 'OTHER',
    ]) {
      expect(LABEL_KATEGORI_PENGADUAN[k]).toBeTruthy();
    }
  });

  it('simpanan pokok dan wajib disebut namanya, bukan kodenya', () => {
    expect(LABEL_JENIS_SIMPANAN.PRINCIPAL).toBe('Simpanan Pokok');
    expect(LABEL_JENIS_SIMPANAN.MANDATORY).toBe('Simpanan Wajib');
  });
});
