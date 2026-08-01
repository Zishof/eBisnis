/**
 * Pengujian penentuan modul dari jalur permintaan.
 *
 * Modul menentukan schema mana yang dibaca dan ditulis. Yang diuji di sini
 * adalah bahwa penentuannya **tidak dapat dipengaruhi dari luar**, dan bahwa
 * jalur yang tidak dikenal berakhir sebagai penolakan — bukan sebagai schema
 * bawaan.
 */

import { modulDariJalur, perluSchemaSendiri } from './education-schema-route';

describe('jalur di luar namespace pendidikan', () => {
  it('dilewatkan, bukan ditolak', () => {
    // Rute lain tidak berurusan dengan berkas ini. Menolaknya di sini akan
    // mematikan seluruh aplikasi.
    for (const p of ['/api/v1/pos/sales', '/api/v1/auth/me', '/health', '/']) {
      expect(modulDariJalur(p)).toEqual({ pendidikan: false });
    }
  });

  it('jalur yang hanya mirip tidak ikut tertangkap', () => {
    expect(modulDariJalur('/api/v1/educational/x').pendidikan).toBe(false);
    expect(modulDariJalur('/api/v2/education/school/x').pendidikan).toBe(false);
  });
});

describe('segmen yang dikenal', () => {
  it.each([
    ['/api/v1/education/school/pupils', 'eschool'],
    ['/api/v1/education/campus/students', 'ecampus'],
    ['/api/v1/education/pesantren/santri', 'epesantren'],
    ['/api/v1/education/common/periods', 'education'],
  ])('%s -> %s', (path, module) => {
    expect(modulDariJalur(path)).toEqual({ pendidikan: true, module });
  });

  it('segmen alamat tidak sama dengan kode modul, dan itu disengaja', () => {
    /*
     * `school` bukan `eschool`. Menurunkan yang satu dari yang lain berarti
     * mengubah alamat publik setiap kali kode modul disesuaikan — dan alamat
     * publik sudah tertulis pada dokumen integrasi milik institusi.
     */
    expect(modulDariJalur('/api/v1/education/eschool/x').module).toBeUndefined();
    expect(modulDariJalur('/api/v1/education/school/x').module).toBe('eschool');
  });

  it('kueri tidak memengaruhi hasil', () => {
    expect(modulDariJalur('/api/v1/education/school/pupils?module=ecampus').module).toBe(
      'eschool',
    );
  });

  it('segmen di bawahnya tidak memengaruhi hasil', () => {
    expect(modulDariJalur('/api/v1/education/school/a/b/c/campus').module).toBe('eschool');
  });
});

describe('segmen yang memakai schema inti', () => {
  it('billing dan integrations tetap di schema inti', () => {
    /*
     * Keduanya lintas vertical: billing menghitung langganan seluruh vertical,
     * integrations menyimpan kredensial dan riwayat pengiriman. Menaruhnya di
     * schema vertical membuat penonaktifan vertical itu menghapus riwayat milik
     * vertical lain.
     */
    expect(modulDariJalur('/api/v1/education/billing/usage').module).toBe('core');
    expect(modulDariJalur('/api/v1/education/integrations/dapodik').module).toBe('core');
  });

  it('hanya modul selain inti yang memerlukan schema sendiri', () => {
    expect(perluSchemaSendiri('core')).toBe(false);
    expect(perluSchemaSendiri('eschool')).toBe(true);
    expect(perluSchemaSendiri('education')).toBe(true);
  });
});

describe('penolakan', () => {
  it('segmen asing DITOLAK, bukan dianggap inti', () => {
    /*
     * Uji yang paling menentukan pada berkas ini.
     *
     * Menganggapnya inti membuat rute yang salah ketik diam-diam membaca schema
     * inti — dan yang salah ketik biasanya rute pendidikan yang baru
     * ditambahkan, sehingga kesalahannya justru mengenai data pendidikan.
     */
    const hasil = modulDariJalur('/api/v1/education/schoool/pupils');
    expect(hasil.pendidikan).toBe(true);
    expect(hasil.module).toBeUndefined();
    expect(hasil.alasanTolak).toContain('schoool');
  });

  it('pesan penolakan menyebutkan segmen yang tersedia', () => {
    expect(modulDariJalur('/api/v1/education/entah/x').alasanTolak).toContain('school');
  });

  it('jalur tanpa segmen ditolak', () => {
    expect(modulDariJalur('/api/v1/education/').module).toBeUndefined();
    expect(modulDariJalur('/api/v1/education/').alasanTolak).toBeDefined();
  });
});
