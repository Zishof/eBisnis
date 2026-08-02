/**
 * Pengujian aturan pendaftaran pondok pesantren.
 *
 * Yang dijaga di sini adalah dua hal yang tidak dapat ditarik kembali setelah
 * terjadi: schema yang telanjur dibuat, dan host yang telanjur diklaim.
 */

import { LABEL_TERPESAN } from '../../infrastructure/portal/portal-host';
import {
  JENJANG_PESANTREN,
  hostSitus,
  slugSitusBoleh,
  usulanSlugDariNama,
  usulanUsernameDariNama,
  validasiPendaftaranPesantren,
} from './pesantren-registration';

const SAH = {
  namaPondok: 'Ponpes Demo',
  email: 'admin@ponpes-demo.sch.id',
  desiredUsername: 'ponpes_demo',
  slugSitus: 'ponpes-demo',
  tipePesantren: 'KOMBINASI',
  santriDilayani: 'PUTRA_PUTRI',
  jenjang: ['DINIYAH_TAKMILIYAH', 'TAHFIZ'],
  acceptTerms: true,
  acceptPrivacy: true,
};

describe('slug situs', () => {
  it('menerima label DNS yang sah', () => {
    expect(slugSitusBoleh('ponpes-demo')).toBeNull();
    expect(slugSitusBoleh('alhikam2')).toBeNull();
    expect(slugSitusBoleh('  Al-Hikam  ')).toBeNull();
  });

  it('MENOLAK garis bawah', () => {
    /*
     * Inilah perbedaan yang membuat slug tidak boleh disamakan dengan nama
     * pengguna. Nama pengguna menjadi nama schema dan boleh memakai garis
     * bawah; label DNS tidak. Menyamakannya menghasilkan host yang tersimpan,
     * tercatat aktif, dan tidak pernah dapat dibuka siapa pun.
     */
    const galat = slugSitusBoleh('ponpes_demo');
    expect(galat?.code).toBe('SLUG_TIDAK_SAH');
    expect(galat?.message).toContain('Garis bawah');
  });

  it('menolak label terpesan platform', () => {
    // Diperiksa terhadap daftar yang sama dengan portal, bukan salinannya.
    for (const label of LABEL_TERPESAN) {
      expect(slugSitusBoleh(label)?.code).toBe('SLUG_TERPESAN');
    }
  });

  it('menolak bentuk yang bukan label DNS', () => {
    expect(slugSitusBoleh('-awal')?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('akhir-')?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('a'.repeat(64))?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('ada.titik')?.code).toBe('SLUG_TIDAK_SAH');
    expect(slugSitusBoleh('huruf Besar')?.code).toBe('SLUG_TIDAK_SAH');
  });

  it('menolak yang kosong dan yang terlalu pendek', () => {
    expect(slugSitusBoleh('')?.code).toBe('SLUG_KOSONG');
    expect(slugSitusBoleh('   ')?.code).toBe('SLUG_KOSONG');
    expect(slugSitusBoleh('ab')?.code).toBe('SLUG_TERLALU_PENDEK');
  });

  it('label terpesan diperiksa SEBELUM panjang', () => {
    // `www` panjangnya 3, `api` juga. Bila urutannya terbalik keduanya lolos.
    expect(slugSitusBoleh('api')?.code).toBe('SLUG_TERPESAN');
  });
});

describe('usulan slug dari nama', () => {
  it('menyusun bentuk yang dapat dipakai', () => {
    expect(usulanSlugDariNama('Ponpes Demo')).toBe('ponpes-demo');
    expect(usulanSlugDariNama("Ma'had Aly Al-Hikam")).toBe('ma-had-aly-al-hikam');
  });

  it('membuang tanda gabung, bukan mengubahnya jadi tanda hubung', () => {
    // "Ma'ārif" ber-NFD: tanda gabung dibuang lebih dahulu, sehingga hasilnya
    // "maarif" dan bukan "ma-a-rif".
    expect(usulanSlugDariNama('Maārif')).toBe('maarif');
  });

  it('tidak menyisakan tanda hubung di tepi', () => {
    expect(usulanSlugDariNama('  --Al Hikam--  ')).toBe('al-hikam');
    expect(usulanSlugDariNama('Pondok!!!')).toBe('pondok');
  });

  it('usulan yang dihasilkan lolos pemeriksaannya sendiri', () => {
    /*
     * Usulan yang tidak sah adalah usulan yang menolak dirinya sendiri. Yang
     * dijaga di sini: jangan sampai formulir mengisi kolom dengan nilai yang
     * langsung ditolak saat dikirim.
     */
    for (const nama of [
      'Ponpes Demo',
      "Ma'had Aly Al-Hikam",
      'PP. Nurul Jadid',
      'Darul Ulum 2',
    ]) {
      expect(slugSitusBoleh(usulanSlugDariNama(nama))).toBeNull();
    }
  });

  it('nama yang tidak menyisakan huruf menghasilkan usulan kosong', () => {
    // Kosong lebih baik daripada tebakan: yang kosong ditolak `slugSitusBoleh`,
    // dan pengurus diminta mengisinya sendiri.
    expect(usulanSlugDariNama('!!!')).toBe('');
    expect(slugSitusBoleh(usulanSlugDariNama('!!!'))?.code).toBe('SLUG_KOSONG');
  });
});

describe('usulan nama pengguna dari nama', () => {
  it('memakai garis bawah, bukan tanda hubung', () => {
    /*
     * Nama pengguna menjadi nama schema PostgreSQL. Tanda hubung tidak sah di
     * sana — dan itulah sebabnya bentuknya berbeda dari slug situs, yang justru
     * tidak boleh memakai garis bawah.
     */
    expect(usulanUsernameDariNama('Ponpes Demo')).toBe('ponpes_demo');
    expect(usulanUsernameDariNama('Al-Hikam')).toBe('al_hikam');
  });

  it('nama yang diawali angka diberi awalan huruf', () => {
    /*
     * `3_muhammadiyah` adalah nama schema yang ditolak PostgreSQL, dan
     * penolakannya baru terjadi saat schema hendak dibuat — sesudah pendaftar
     * mengisi seluruh formulir.
     *
     * Angkanya diberi awalan, bukan dibuang: membuangnya mengubah nama pondok
     * menjadi nama pondok lain.
     */
    expect(usulanUsernameDariNama('3 Muhammadiyah')).toBe('p3_muhammadiyah');
    expect(usulanUsernameDariNama('17 Agustus')).toBe('p17_agustus');
  });

  it('membuang tanda gabung seperti pada slug', () => {
    expect(usulanUsernameDariNama('Maārif')).toBe('maarif');
  });

  it('tidak menyisakan garis bawah di tepi', () => {
    expect(usulanUsernameDariNama('  ...Al Hikam...  ')).toBe('al_hikam');
  });

  it('yang terlalu pendek atau kosong menghasilkan kosong', () => {
    expect(usulanUsernameDariNama('!!!')).toBe('');
    expect(usulanUsernameDariNama('PP')).toBe('');
  });

  it('usulan yang dihasilkan sah sebagai nama schema', () => {
    // Pola yang sama dengan `validateSchemaName`: diawali huruf kecil, lalu
    // huruf kecil, angka, dan garis bawah, panjang 3..48.
    const POLA_SCHEMA = /^[a-z][a-z0-9_]{2,47}$/;
    const nama = [
      'Ponpes Demo',
      "Ma'had Aly Al-Hikam",
      '3 Muhammadiyah',
      'PP. Nurul Jadid',
      'Darul Ulum 2',
      'A'.repeat(120),
    ];

    // Nama yang gagal dikumpulkan lebih dahulu, bukan diperiksa satu per satu.
    // Yang gagal ikut tampil pada pesan galat — tanpa itu, yang terbaca hanya
    // "string tidak cocok pola", tanpa menyebut nama mana.
    const gagal = nama
      .map((n) => ({ n, usulan: usulanUsernameDariNama(n) }))
      .filter(({ usulan }) => usulan && !POLA_SCHEMA.test(usulan));

    expect(gagal).toEqual([]);
  });

  it('bentuknya BERBEDA dari usulan slug situs', () => {
    /*
     * Keduanya sengaja tidak sama. Bila suatu hari salah satunya disalin dari
     * yang lain, uji ini menyala — dan itulah cacat yang paling mahal di jalur
     * ini.
     */
    const nama = 'Ponpes Demo';
    expect(usulanUsernameDariNama(nama)).not.toBe(usulanSlugDariNama(nama));
    expect(usulanUsernameDariNama(nama)).toContain('_');
    expect(usulanSlugDariNama(nama)).toContain('-');
    expect(usulanSlugDariNama(nama)).not.toContain('_');
  });
});

describe('host situs', () => {
  it('selalu berada di bawah santri.info', () => {
    expect(hostSitus('ponpes-demo')).toBe('ponpes-demo.santri.info');
    expect(hostSitus('  AL-HIKAM ')).toBe('al-hikam.santri.info');
  });
});

describe('validasi pendaftaran', () => {
  it('masukan lengkap tidak menghasilkan galat', () => {
    expect(validasiPendaftaranPesantren(SAH)).toEqual([]);
  });

  it('melaporkan SELURUH galat sekaligus', () => {
    /*
     * Formulir ini panjang. Memulangkan satu galat per kiriman berarti pengurus
     * pondok mengirim ulang belasan kali dan memperbaiki satu hal setiap kali.
     */
    const galat = validasiPendaftaranPesantren({});
    const field = galat.map((g) => g.field).sort();
    expect(field).toEqual(
      [
        'acceptPrivacy',
        'acceptTerms',
        'email',
        'jenjang',
        'namaPondok',
        'santriDilayani',
        'slugSitus',
        'tipePesantren',
      ].sort(),
    );
  });

  it('menolak tipe dan jenis santri di luar daftar', () => {
    const galat = validasiPendaftaranPesantren({
      ...SAH,
      tipePesantren: 'MODERN',
      santriDilayani: 'CAMPUR',
    });
    expect(galat.map((g) => g.field).sort()).toEqual(['santriDilayani', 'tipePesantren']);
  });

  it('jenjang wajib larik, dan bukan larik tidak dipaksa menjadi larik', () => {
    expect(validasiPendaftaranPesantren({ ...SAH, jenjang: 'TAHFIZ' })[0].code).toBe('BUKAN_LARIK');
    expect(validasiPendaftaranPesantren({ ...SAH, jenjang: { a: 1 } })[0].code).toBe('BUKAN_LARIK');
    expect(validasiPendaftaranPesantren({ ...SAH, jenjang: [] })[0].code).toBe('WAJIB');
  });

  it('jenjang di luar katalog ditolak dan disebutkan', () => {
    const galat = validasiPendaftaranPesantren({ ...SAH, jenjang: ['TAHFIZ', 'SEKOLAH_SIHIR'] });
    expect(galat[0].code).toBe('TIDAK_DIKENALI');
    expect(galat[0].message).toContain('SEKOLAH_SIHIR');
  });

  it('seluruh kode katalog jenjang diterima', () => {
    // Mengikat katalog dengan validasinya: kode yang ditawarkan formulir harus
    // kode yang diterima pemeriksa.
    const galat = validasiPendaftaranPesantren({
      ...SAH,
      jenjang: JENJANG_PESANTREN.map((j) => j.code),
    });
    expect(galat).toEqual([]);
  });

  it('menolak jumlah negatif dan bukan bilangan bulat', () => {
    /*
     * Angka di sini mengalir ke penawaran harga. Penawaran bernilai negatif
     * adalah tagihan terbalik.
     */
    expect(validasiPendaftaranPesantren({ ...SAH, jumlahSantriMukim: -1 })[0].field).toBe(
      'jumlahSantriMukim',
    );
    expect(validasiPendaftaranPesantren({ ...SAH, jumlahUstaz: 3.5 })[0].field).toBe('jumlahUstaz');
    expect(validasiPendaftaranPesantren({ ...SAH, jumlahSantriNonmukim: 0 })).toEqual([]);
  });

  it('tahun berdiri di luar jangkauan ditolak', () => {
    expect(validasiPendaftaranPesantren({ ...SAH, tahunBerdiri: 202 })[0].field).toBe(
      'tahunBerdiri',
    );
    expect(validasiPendaftaranPesantren({ ...SAH, tahunBerdiri: 1899 })).toEqual([]);
  });

  it('kode pos wajib lima angka bila diisi', () => {
    expect(validasiPendaftaranPesantren({ ...SAH, kodePos: '6115' })[0].field).toBe('kodePos');
    expect(validasiPendaftaranPesantren({ ...SAH, kodePos: '61152' })).toEqual([]);
    expect(validasiPendaftaranPesantren({ ...SAH, kodePos: '  ' })).toEqual([]);
  });

  it('situs web hanya menerima http dan https', () => {
    /*
     * Nilai ini kelak ditampilkan sebagai tautan pada halaman yang dibuka orang
     * lain. `javascript:` yang tersimpan hari ini adalah skrip yang berjalan di
     * peramban pengunjung kelak.
     */
    for (const jahat of [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'bukan-alamat',
    ]) {
      expect(validasiPendaftaranPesantren({ ...SAH, situsWeb: jahat })[0].field).toBe('situsWeb');
    }
    expect(validasiPendaftaranPesantren({ ...SAH, situsWeb: 'https://ru.sch.id' })).toEqual([]);
  });

  it('persetujuan tidak dapat dilewati', () => {
    expect(
      validasiPendaftaranPesantren({ ...SAH, acceptTerms: false }).map((g) => g.field),
    ).toEqual(['acceptTerms']);
    expect(
      validasiPendaftaranPesantren({ ...SAH, acceptPrivacy: false }).map((g) => g.field),
    ).toEqual(['acceptPrivacy']);
  });

  it('surel diperiksa bentuknya', () => {
    expect(validasiPendaftaranPesantren({ ...SAH, email: 'bukan-surel' })[0].code).toBe(
      'TIDAK_SAH',
    );
  });
});
