/**
 * Pengujian penjelasan "mengapa tombol daftar belum dapat ditekan".
 *
 * Yang dijaga di sini bukan kebenaran logika saja, melainkan bahwa setiap
 * keadaan yang mematikan tombol **selalu** menghasilkan penjelasan. Tombol yang
 * mati tanpa penjelasan adalah cacat yang sudah pernah terjadi, dan gejalanya
 * hanyalah pengurus pondok yang menekan berulang kali tanpa apa pun berubah.
 */

import { describe, expect, it } from 'vitest';
import {
  LANGKAH_AKUN,
  LANGKAH_IDENTITAS,
  LANGKAH_KONTAK,
  LANGKAH_PENYELENGGARAAN,
  bolehKirim,
  halanganKirim,
  type KeadaanFormulir,
} from './halangan-kirim';

const LENGKAP: KeadaanFormulir = {
  namaPondok: 'Ponpes Demo',
  email: 'pengurus@ponpes-demo.sch.id',
  slugSitus: 'ponpes-demo',
  desiredUsername: 'ponpes_demo',
  jumlahJenjangDipilih: 2,

  slugSedangDiperiksa: false,
  slugTersedia: true,
  slugGagalDiperiksa: false,
  slugSudahDijawab: true,

  usernameSedangDiperiksa: false,
  usernameTersedia: true,
  usernameGagalDiperiksa: false,
  usernameSudahDijawab: true,

  setujuSyarat: true,
  setujuPrivasi: true,
};

const kode = (k: KeadaanFormulir) => halanganKirim(k).map((h) => h.kode);

describe('formulir lengkap', () => {
  it('tidak ada halangan', () => {
    expect(halanganKirim(LENGKAP)).toEqual([]);
    expect(bolehKirim(LENGKAP)).toBe(true);
  });
});

describe('setiap keadaan yang mematikan tombol menghasilkan penjelasan', () => {
  /*
   * Inilah uji yang paling penting di berkas ini. Ia mengambil setiap keadaan
   * yang membuat `bolehKirim` bernilai salah, lalu menuntut sedikitnya satu
   * halangan dijelaskan. Kombinasi yang lolos tanpa penjelasan berarti tombol
   * mati dan layar diam.
   */
  const keadaan: Array<[string, Partial<KeadaanFormulir>]> = [
    ['nama pondok kosong', { namaPondok: '   ' }],
    ['tidak ada jenjang', { jumlahJenjangDipilih: 0 }],
    ['surel kosong', { email: '' }],
    ['surel salah bentuk', { email: 'pengurus-at-pondok' }],
    ['alamat situs kosong', { slugSitus: '' }],
    ['alamat situs pendek', { slugSitus: 'ab' }],
    ['alamat situs sedang diperiksa', { slugSedangDiperiksa: true, slugTersedia: undefined }],
    ['alamat situs gagal diperiksa', { slugGagalDiperiksa: true, slugTersedia: undefined }],
    ['alamat situs terpakai', { slugTersedia: false }],
    ['alamat situs belum diperiksa', { slugTersedia: undefined, slugSudahDijawab: false }],
    ['jawaban alamat situs tidak terbaca', { slugTersedia: undefined, slugSudahDijawab: true }],
    ['nama pengguna kosong', { desiredUsername: '' }],
    ['nama pengguna pendek', { desiredUsername: 'ab' }],
    [
      'nama pengguna sedang diperiksa',
      { usernameSedangDiperiksa: true, usernameTersedia: undefined },
    ],
    [
      'nama pengguna gagal diperiksa',
      { usernameGagalDiperiksa: true, usernameTersedia: undefined },
    ],
    ['nama pengguna terpakai', { usernameTersedia: false }],
    [
      'nama pengguna belum diperiksa',
      { usernameTersedia: undefined, usernameSudahDijawab: false },
    ],
    [
      'jawaban nama pengguna tidak terbaca',
      { usernameTersedia: undefined, usernameSudahDijawab: true },
    ],
    ['syarat belum dicentang', { setujuSyarat: false }],
    ['privasi belum dicentang', { setujuPrivasi: false }],
  ];

  it.each(keadaan)('%s dijelaskan', (_nama, ubahan) => {
    const k = { ...LENGKAP, ...ubahan };
    const halangan = halanganKirim(k);

    expect(bolehKirim(k)).toBe(false);
    expect(halangan.length).toBeGreaterThan(0);

    // Setiap halangan wajib menyebut apa yang kurang DAN apa yang harus
    // dikerjakan. Menyebut yang pertama saja meninggalkan orang yang tahu ada
    // yang salah tetapi tidak tahu langkah berikutnya.
    for (const h of halangan) {
      expect(h.apa.length).toBeGreaterThan(10);
      expect(h.tindakan.length).toBeGreaterThan(10);
      expect(h.langkah).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('halangan menunjuk langkah yang benar', () => {
  it('nama pondok menunjuk langkah identitas', () => {
    const h = halanganKirim({ ...LENGKAP, namaPondok: '' })[0];
    expect(h.langkah).toBe(LANGKAH_IDENTITAS);
  });

  it('jenjang menunjuk langkah penyelenggaraan', () => {
    const h = halanganKirim({ ...LENGKAP, jumlahJenjangDipilih: 0 })[0];
    expect(h.langkah).toBe(LANGKAH_PENYELENGGARAAN);
  });

  it('surel menunjuk langkah kontak', () => {
    const h = halanganKirim({ ...LENGKAP, email: '' })[0];
    expect(h.langkah).toBe(LANGKAH_KONTAK);
  });

  it('persetujuan menunjuk langkah akun', () => {
    const h = halanganKirim({ ...LENGKAP, setujuSyarat: false })[0];
    expect(h.langkah).toBe(LANGKAH_AKUN);
  });
});

describe('urutan halangan mengikuti urutan langkah', () => {
  it('tidak pernah melompat mundur', () => {
    /*
     * Orang yang memperbaiki dari atas ke bawah harus bergerak maju melewati
     * formulir. Daftar yang melompat 5 → 1 → 4 memaksanya bolak-balik.
     */
    const halangan = halanganKirim({
      ...LENGKAP,
      namaPondok: '',
      jumlahJenjangDipilih: 0,
      email: '',
      slugSitus: '',
      desiredUsername: '',
      setujuSyarat: false,
      setujuPrivasi: false,
    });
    const langkah = halangan.map((h) => h.langkah);
    expect(langkah).toEqual([...langkah].sort((a, b) => a - b));
  });

  it('seluruh yang kurang disebut sekaligus, bukan satu per satu', () => {
    // Menyebut satu per satu berarti pengurus memperbaiki, menekan, dan
    // menemukan halangan berikutnya — berulang kali.
    expect(
      kode({
        ...LENGKAP,
        namaPondok: '',
        jumlahJenjangDipilih: 0,
        setujuSyarat: false,
      }),
    ).toEqual(['NAMA_KOSONG', 'JENJANG_KOSONG', 'SYARAT_BELUM']);
  });
});

describe('membedakan yang salah dari yang sedang menunggu', () => {
  it('pemeriksaan yang sedang berjalan ditandai menunggu', () => {
    const h = halanganKirim({
      ...LENGKAP,
      slugSedangDiperiksa: true,
      slugTersedia: undefined,
    })[0];
    expect(h.menunggu).toBe(true);
  });

  it('sambungan terputus ditandai menunggu, bukan kesalahan pengisian', () => {
    /*
     * Sambungan yang putus bukan salah pengurus pondok. Menampilkannya dengan
     * nada yang sama dengan "kolom belum diisi" membuat orang mencari kesalahan
     * pada isian yang sebenarnya sudah benar.
     */
    const h = halanganKirim({
      ...LENGKAP,
      slugGagalDiperiksa: true,
      slugTersedia: undefined,
    })[0];
    expect(h.menunggu).toBe(true);
    expect(h.apa).toContain('sambungan');
  });

  it('nama yang sudah terpakai BUKAN keadaan menunggu', () => {
    const h = halanganKirim({ ...LENGKAP, slugTersedia: false })[0];
    expect(h.menunggu).toBeUndefined();
  });
});

describe('jawaban yang tidak terbaca dibedakan dari yang sedang ditunggu', () => {
  /*
   * Keadaan ini TIDAK akan selesai sendiri. Menyuruh menunggu berarti menyuruh
   * menunggu selamanya — dan itu persis yang membuat orang menekan tombol
   * berulang kali tanpa apa pun berubah.
   */
  it('menyuruh memuat ulang, bukan menunggu', () => {
    const h = halanganKirim({
      ...LENGKAP,
      slugTersedia: undefined,
      slugSudahDijawab: true,
    })[0];
    expect(h.kode).toBe('SLUG_JAWABAN_TAK_TERBACA');
    expect(h.tindakan.toLowerCase()).toContain('muat ulang');
    expect(h.tindakan.toLowerCase()).not.toContain('tunggu sebentar');
  });

  it('yang belum dijawab tetap menyuruh menunggu', () => {
    const h = halanganKirim({
      ...LENGKAP,
      slugTersedia: undefined,
      slugSudahDijawab: false,
    })[0];
    expect(h.kode).toBe('SLUG_BELUM_DIPERIKSA');
    expect(h.tindakan.toLowerCase()).toContain('tunggu');
  });

  it('sedang diperiksa menang atas jawaban tak terbaca', () => {
    // Pemeriksaan baru yang sedang berjalan akan menimpa jawaban lama; yang
    // ditampilkan harus keadaan sekarang, bukan keadaan sebelumnya.
    const h = halanganKirim({
      ...LENGKAP,
      slugSedangDiperiksa: true,
      slugTersedia: undefined,
      slugSudahDijawab: true,
    })[0];
    expect(h.kode).toBe('SLUG_DIPERIKSA');
  });
});

describe('pesan dari peladen dipakai bila ada', () => {
  it('alasan penolakan alamat situs diteruskan apa adanya', () => {
    const h = halanganKirim({
      ...LENGKAP,
      slugTersedia: false,
      slugPesan: 'Alamat situs tersebut sudah dipakai pondok lain.',
    })[0];
    expect(h.apa).toBe('Alamat situs tersebut sudah dipakai pondok lain.');
  });

  it('pesan kosong dari peladen jatuh ke kalimat bawaan', () => {
    // Peladen yang menjawab pesan kosong tidak boleh menghasilkan baris kosong
    // di layar — itu persis cacat yang sedang diperbaiki.
    const h = halanganKirim({ ...LENGKAP, slugTersedia: false, slugPesan: '   ' })[0];
    expect(h.apa).toContain('ponpes-demo');
    expect(h.apa.length).toBeGreaterThan(10);
  });
});

describe('bentuk surel dijelaskan dengan bahasa sehari-hari', () => {
  it('menyebut tanda @ dan titik, bukan istilah teknis', () => {
    const h = halanganKirim({ ...LENGKAP, email: 'pengurus' })[0];
    expect(h.tindakan).toContain('@');
    expect(h.tindakan.toLowerCase()).not.toContain('regex');
    expect(h.tindakan.toLowerCase()).not.toContain('format');
    expect(h.tindakan.toLowerCase()).not.toContain('validasi');
  });
});
