/**
 * Pengujian isi bantuan koperasi.
 *
 * Bantuan diuji karena ia satu-satunya bagian sistem yang dibaca orang ketika
 * mereka sudah bingung. Pengurus koperasi berganti tiap periode kepengurusan,
 * dan yang baru mewarisi sistem tanpa mewarisi orang yang tahu cara memakainya.
 *
 * Yang diperiksa terutama bagian **tidakDapatDiubah** — hal yang paling mahal
 * bila baru diketahui belakangan.
 */

import { describe, expect, it } from 'vitest';
import { BANTUAN_KOPERASI, bantuanUntuk } from './bantuan';

describe('kelengkapan', () => {
  it('setiap entri menjelaskan apa yang tidak dapat diubah', () => {
    /*
     * Tulisan bantuan pada umumnya menjawab "layar ini untuk apa" dan
     * "bagaimana memakainya", lalu berhenti. Yang ketiga justru yang dicari
     * orang setelah terlanjur.
     */
    for (const b of BANTUAN_KOPERASI) {
      expect(b.tidakDapatDiubah.length).toBeGreaterThan(0);
    }
  });

  it('setiap entri punya langkah yang dapat diikuti', () => {
    for (const b of BANTUAN_KOPERASI) {
      expect(b.langkah.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('setiap menu hanya dijelaskan sekali', () => {
    const kode = BANTUAN_KOPERASI.map((b) => b.menuCode);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('menjelaskan setiap layar utama koperasi', () => {
    const wajib = [
      'COOPERATIVE_PROFILE',
      'COOPERATIVE_POLICY',
      'COOPERATIVE_MEMBER',
      'COOPERATIVE_SAVING',
      'COOPERATIVE_LOAN',
      'COOPERATIVE_MEETING',
      'COOPERATIVE_SHU',
      'COOPERATIVE_UNIT',
      'COOPERATIVE_WEBSITE',
      'COOPERATIVE_COMPLAINT',
      'COOPERATIVE_PORTAL',
    ];
    for (const m of wajib) expect(bantuanUntuk(m)).toBeDefined();
  });

  it('mengembalikan undefined untuk menu yang tidak dikenal', () => {
    expect(bantuanUntuk('MENU_YANG_TIDAK_ADA')).toBeUndefined();
  });
});

describe('bahasa', () => {
  it('tidak memakai istilah teknis perangkat lunak', () => {
    /*
     * Ditulis untuk orang yang mengurus koperasi, bukan untuk orang yang
     * memahami perangkat lunak.
     */
    const teknis = [
      'endpoint', 'constraint', 'foreign key', 'null', 'api', 'schema',
      'migration', 'commit', 'query', 'boolean', 'database', 'timestamp',
    ];
    for (const b of BANTUAN_KOPERASI) {
      const semua = [b.ringkas, ...b.langkah, ...b.tidakDapatDiubah, ...(b.seringKeliru ?? [])]
        .join(' ')
        .toLowerCase();
      for (const t of teknis) {
        // Sebagai kata utuh. "api" adalah bagian dari "tetapi", dan kata
        // Indonesia yang kebetulan memuat istilah teknis bukan istilah teknis.
        const adaSebagaiKata = new RegExp(`\\b${t.replace(/ /g, '\\s')}\\b`).test(semua);
        expect({ menu: b.menuCode, istilah: t, ada: adaSebagaiKata }).toEqual({
          menu: b.menuCode,
          istilah: t,
          ada: false,
        });
      }
    }
  });

  it('setiap keterangan cukup panjang untuk menjelaskan alasannya', () => {
    // "Tidak dapat diubah." tanpa alasan hanya membuat orang mencari cara
    // mengakalinya.
    for (const b of BANTUAN_KOPERASI) {
      for (const t of b.tidakDapatDiubah) {
        expect(t.length).toBeGreaterThan(40);
      }
    }
  });
});

describe('hal yang wajib disebutkan', () => {
  it('menyebut satu anggota satu suara', () => {
    const rapat = bantuanUntuk('COOPERATIVE_MEETING')!;
    expect(rapat.tidakDapatDiubah.join(' ')).toContain('satu suara');
  });

  it('menyebut bahwa simpanan pokok dan wajib tidak dapat ditarik', () => {
    // Anggota yang mengira seluruh simpanannya dapat diambil sewaktu-waktu
    // akan kecewa pada saat yang paling tidak tepat.
    const simpanan = bantuanUntuk('COOPERATIVE_SAVING')!;
    expect(simpanan.tidakDapatDiubah.join(' ').toLowerCase()).toContain('tidak dapat ditarik');
  });

  it('menyebut bahwa penganalisis tidak boleh menjadi penyetuju', () => {
    const pinjaman = bantuanUntuk('COOPERATIVE_LOAN')!;
    expect(pinjaman.tidakDapatDiubah.join(' ')).toContain('penyetuju');
  });

  it('menyebut bahwa perhitungan SHU memakai angka yang dicuplik', () => {
    const shu = bantuanUntuk('COOPERATIVE_SHU')!;
    expect(shu.tidakDapatDiubah.join(' ')).toContain('dicuplik');
  });

  it('menyebut bahwa PIN anggota tidak pernah terlihat kasir', () => {
    const portal = bantuanUntuk('COOPERATIVE_PORTAL')!;
    expect(portal.tidakDapatDiubah.join(' ')).toContain('TIDAK PERNAH terlihat kasir');
  });

  it('menyebut bahwa lamaran dari situs tidak langsung menjadi anggota', () => {
    const situs = bantuanUntuk('COOPERATIVE_WEBSITE')!;
    expect(situs.tidakDapatDiubah.join(' ')).toContain('TIDAK langsung menjadi anggota');
  });

  it('menyebut bahwa pengaduan tidak dapat dihapus', () => {
    const aduan = bantuanUntuk('COOPERATIVE_COMPLAINT')!;
    expect(aduan.tidakDapatDiubah.join(' ')).toContain('tidak dapat dihapus');
  });

  it('menyebut bahwa anggota tidak dapat dihapus, hanya diberhentikan', () => {
    const anggota = bantuanUntuk('COOPERATIVE_MEMBER')!;
    expect(anggota.tidakDapatDiubah.join(' ')).toContain('hanya diberhentikan');
  });

  it('menjelaskan mengapa SHU dua anggota bersimpanan sama dapat berbeda', () => {
    // Pertanyaan yang paling sering diajukan anggota, dan yang paling mudah
    // disalahpahami sebagai ketidakadilan.
    const shu = bantuanUntuk('COOPERATIVE_SHU')!;
    expect(shu.seringKeliru?.join(' ')).toContain('dapat menerima SHU berbeda');
  });
});
