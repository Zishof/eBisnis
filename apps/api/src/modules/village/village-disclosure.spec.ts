/**
 * Pengujian transparansi dan keterbukaan informasi.
 *
 * Satu aturan dijaga paling ketat: **agregat yang sudah disajikan tidak dapat
 * dibongkar menjadi perorangan.** Pengujian tidak hanya memeriksa bahwa sel
 * kecil ditekan — ia mencoba **membongkarnya** dengan cara yang akan dipakai
 * orang, yaitu pengurangan dari total.
 */

import {
  AMBANG_BAWAAN,
  HARI_JAWAB,
  HARI_PERPANJANGAN,
  TRANSISI_PERMOHONAN_INFORMASI,
  bolehKecualikan,
  bolehPerpanjang,
  bolehPindahPermohonan,
  bolehTolak,
  bolehUbahAmbang,
  dapatDibongkar,
  hitungTenggat,
  keterlambatan,
  pengecualianKedaluwarsa,
  sajikan,
  sajikanPublik,
  tambahHariKerja,
  type SelAgregat,
  type StatusPermohonan,
} from './village-disclosure';

const kosong = new Set<string>();

describe('penekanan penyajian', () => {
  it('meloloskan tabel yang seluruh selnya memenuhi ambang', () => {
    const h = sajikan([
      { kunci: '001', cacah: 12 },
      { kunci: '002', cacah: 9 },
      { kunci: '003', cacah: 7 },
    ]);
    expect(h.jumlahDitekan).toBe(0);
    expect(h.totalAman).toBe(true);
    expect(h.total).toBe(28);
    expect(dapatDibongkar(h)).toBe(false);
  });

  it('menekan sel di bawah ambang', () => {
    const h = sajikan([
      { kunci: '001', cacah: 12 },
      { kunci: '002', cacah: 9 },
      { kunci: '003', cacah: 3 },
      { kunci: '004', cacah: 8 },
    ]);
    expect(h.sel.find((s) => s.kunci === '003')?.ditekan).toBe(true);
    expect(h.sel.find((s) => s.kunci === '003')?.nilai).toBeNull();
  });

  it('TIDAK meninggalkan satu sel tertekan sendirian bersama total', () => {
    // Inilah kekeliruan yang paling sering terjadi: 24 − 12 − 9 = 3.
    const h = sajikan([
      { kunci: '001', cacah: 12 },
      { kunci: '002', cacah: 9 },
      { kunci: '003', cacah: 3 },
    ]);
    expect(h.jumlahDitekan).toBeGreaterThanOrEqual(2);
    expect(dapatDibongkar(h)).toBe(false);
  });

  it('memilih sel terkecil sebagai penekanan pelengkap', () => {
    // Yang terkecil paling sedikit menghilangkan informasi bagi pembaca.
    const h = sajikan([
      { kunci: 'a', cacah: 40 },
      { kunci: 'b', cacah: 9 },
      { kunci: 'c', cacah: 20 },
      { kunci: 'd', cacah: 2 },
    ]);
    expect(h.sel.find((s) => s.kunci === 'd')?.sebab).toBe('DI_BAWAH_AMBANG');
    expect(h.sel.find((s) => s.kunci === 'b')?.ditekan).toBe(true);
    expect(h.sel.find((s) => s.kunci === 'a')?.ditekan).toBe(false);
    expect(h.sel.find((s) => s.kunci === 'c')?.ditekan).toBe(false);
  });

  it('meneruskan penekanan selama yang tersembunyi masih di bawah ambang', () => {
    // Dua sel tertekan yang bersama-sama berisi 2 orang hampir sama buruknya
    // dengan menyebut masing-masing.
    const h = sajikan([
      { kunci: 'a', cacah: 50 },
      { kunci: 'b', cacah: 40 },
      { kunci: 'c', cacah: 1 },
      { kunci: 'd', cacah: 1 },
    ]);
    expect(h.sisaTersembunyi).toBeGreaterThanOrEqual(AMBANG_BAWAAN);
    expect(dapatDibongkar(h)).toBe(false);
  });

  it('menekan KEDUA sel bila tabelnya hanya berisi dua', () => {
    // Dua sel saja, salah satunya kecil. Menekan yang kecil saja membuat
    // nilainya dapat dihitung dari total, sehingga keduanya ditekan. Yang
    // diketahui pembaca tinggal jumlah keduanya — dan itu memang tidak rahasia.
    const h = sajikan([
      { kunci: 'a', cacah: 30 },
      { kunci: 'b', cacah: 2 },
    ]);
    expect(h.jumlahDitekan).toBe(2);
    expect(h.total).toBe(32);
    expect(dapatDibongkar(h)).toBe(false);
  });

  it('menahan total ketika seluruh yang tersembunyi masih terlalu sedikit', () => {
    const h = sajikan([
      { kunci: 'a', cacah: 2 },
      { kunci: 'b', cacah: 1 },
    ]);
    expect(h.totalAman).toBe(false);
    expect(h.keterangan).toContain('ikut ditahan');
    expect(dapatDibongkar(h)).toBe(false);
  });

  it('tidak menekan nol', () => {
    // Nol tidak menyebut siapa pun, dan menekannya justru menandai bahwa di
    // sana ada sesuatu.
    const h = sajikan([
      { kunci: 'a', cacah: 20 },
      { kunci: 'b', cacah: 0 },
      { kunci: 'c', cacah: 15 },
    ]);
    expect(h.sel.find((s) => s.kunci === 'b')?.ditekan).toBe(false);
    expect(h.sel.find((s) => s.kunci === 'b')?.nilai).toBe(0);
  });

  it('sel tepat pada ambang tidak ditekan', () => {
    const h = sajikan([
      { kunci: 'a', cacah: AMBANG_BAWAAN },
      { kunci: 'b', cacah: 30 },
    ]);
    expect(h.jumlahDitekan).toBe(0);
  });

  it('menghormati ambang yang lebih tinggi', () => {
    const h = sajikan(
      [
        { kunci: 'a', cacah: 8 },
        { kunci: 'b', cacah: 30 },
        { kunci: 'c', cacah: 25 },
      ],
      { ambang: 10 },
    );
    expect(h.ambang).toBe(10);
    expect(h.sel.find((s) => s.kunci === 'a')?.ditekan).toBe(true);
  });

  it('menekan cukup ketika totalnya tidak ditayangkan', () => {
    // Tanpa total, satu sel tertekan tidak dapat dihitung siapa pun.
    const h = sajikan(
      [
        { kunci: 'a', cacah: 12 },
        { kunci: 'b', cacah: 3 },
      ],
      { tampilkanTotal: false },
    );
    expect(h.jumlahDitekan).toBe(1);
    expect(h.totalAman).toBe(false);
  });

  it('tidak pernah menghasilkan penyajian yang dapat dibongkar', () => {
    // Diperiksa pada banyak bentuk tabel sekaligus, sebab kekeliruan seperti
    // ini muncul pada bentuk yang tidak terpikirkan saat menulis aturannya.
    const bentuk: SelAgregat[][] = [
      [{ kunci: 'a', cacah: 1 }],
      [
        { kunci: 'a', cacah: 1 },
        { kunci: 'b', cacah: 1 },
      ],
      [
        { kunci: 'a', cacah: 100 },
        { kunci: 'b', cacah: 4 },
      ],
      [
        { kunci: 'a', cacah: 6 },
        { kunci: 'b', cacah: 6 },
        { kunci: 'c', cacah: 1 },
      ],
      [
        { kunci: 'a', cacah: 9 },
        { kunci: 'b', cacah: 8 },
        { kunci: 'c', cacah: 2 },
        { kunci: 'd', cacah: 2 },
      ],
      [
        { kunci: 'a', cacah: 0 },
        { kunci: 'b', cacah: 0 },
        { kunci: 'c', cacah: 3 },
      ],
      Array.from({ length: 12 }, (_, i) => ({ kunci: `rt-${i}`, cacah: i })),
    ];
    for (const t of bentuk) {
      const h = sajikan(t);
      expect([JSON.stringify(t), dapatDibongkar(h)]).toEqual([JSON.stringify(t), false]);
    }
  });

  it('bentuk publik TIDAK menyebutkan mengapa sebuah sel ditekan', () => {
    // Sel bertanda DI_BAWAH_AMBANG adalah sel yang isinya kurang dari ambang,
    // dan pembaca yang melihatnya sudah tahu jauh lebih banyak daripada yang
    // seharusnya. Kekeliruan ini tidak terlihat pada tampilan tabelnya — ia
    // terlihat pada jawaban API yang dibaca siapa pun.
    const h = sajikan([
      { kunci: 'a', cacah: 30 },
      { kunci: 'b', cacah: 2 },
      { kunci: 'c', cacah: 20 },
    ]);
    const publik = sajikanPublik(h);
    for (const s of publik.sel) {
      expect(Object.keys(s).sort()).toEqual(['ditekan', 'kunci', 'nilai']);
    }
    expect(JSON.stringify(publik)).not.toContain('DI_BAWAH_AMBANG');
    expect(JSON.stringify(publik)).not.toContain('PELENGKAP');
  });

  it('bentuk publik menahan total ketika tidak aman', () => {
    const publik = sajikanPublik(
      sajikan([
        { kunci: 'a', cacah: 2 },
        { kunci: 'b', cacah: 1 },
      ]),
    );
    expect(publik.total).toBeNull();
  });

  it('jumlah sel yang tayang ditambah yang tersembunyi tetap sama dengan total', () => {
    const t = [
      { kunci: 'a', cacah: 12 },
      { kunci: 'b', cacah: 9 },
      { kunci: 'c', cacah: 3 },
    ];
    const h = sajikan(t);
    const tayang = h.sel.filter((s) => !s.ditekan).reduce((n, s) => n + (s.nilai ?? 0), 0);
    expect(tayang + h.sisaTersembunyi).toBe(h.total);
  });
});

describe('ambang penyajian', () => {
  it('boleh dinaikkan kapan pun', () => {
    expect(bolehUbahAmbang(5, 10, true).boleh).toBe(true);
  });

  it('boleh diturunkan selama belum ada laporan terbit', () => {
    expect(bolehUbahAmbang(5, 3, false).boleh).toBe(true);
  });

  it('TIDAK boleh diturunkan setelah laporan terbit', () => {
    const h = bolehUbahAmbang(5, 3, true);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('memegang keduanya sekaligus');
  });

  it('menolak ambang satu', () => {
    const h = bolehUbahAmbang(5, 1, false);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak menyembunyikan apa pun');
  });

  it('bawaannya lima', () => {
    expect(AMBANG_BAWAAN).toBe(5);
  });
});

describe('pengecualian informasi', () => {
  const kecuali = (over = {}) => ({
    dasarHukum: 'Pasal 17 huruf h UU 14/2008',
    konsekuensi: 'Membuka data ini mengungkap identitas pelapor pengaduan yang masih diproses.',
    berlakuSampai: '2029-12-31',
    ...over,
  });

  it('menerima pengecualian yang lengkap', () => {
    expect(bolehKecualikan(kecuali()).boleh).toBe(true);
  });

  it('menolak tanpa dasar hukum', () => {
    const h = bolehKecualikan(kecuali({ dasarHukum: '  ' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('"Rahasia" bukan dasar hukum');
  });

  it('MENOLAK tanpa uji konsekuensi', () => {
    const h = bolehKecualikan(kecuali({ konsekuensi: 'rahasia' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('penolakan yang diberi nama lain');
  });

  it('MENOLAK pengecualian tanpa batas waktu', () => {
    const h = bolehKecualikan(kecuali({ berlakuSampai: null }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('kerahasiaan permanen');
  });

  it('mengenali pengecualian yang sudah lewat masanya', () => {
    expect(pengecualianKedaluwarsa('2027-12-31', '2028-01-01')).toBe(true);
    expect(pengecualianKedaluwarsa('2029-12-31', '2028-01-01')).toBe(false);
  });
});

describe('tenggat permohonan informasi', () => {
  it('melewati Sabtu dan Minggu', () => {
    // 2027-03-05 adalah Jumat.
    expect(tambahHariKerja('2027-03-05', 1, kosong)).toBe('2027-03-08');
    expect(tambahHariKerja('2027-03-05', 2, kosong)).toBe('2027-03-09');
  });

  it('melewati hari libur yang terdaftar', () => {
    const libur = new Set(['2027-03-08']);
    expect(tambahHariKerja('2027-03-05', 1, libur)).toBe('2027-03-09');
  });

  it('sepuluh hari kerja untuk menjawab', () => {
    expect(HARI_JAWAB).toBe(10);
    const t = hitungTenggat('2027-03-01', kosong);
    expect(t.tenggat).toBe('2027-03-15');
    expect(t.diperpanjang).toBe(false);
  });

  it('perpanjangan menambah tujuh hari kerja', () => {
    expect(HARI_PERPANJANGAN).toBe(7);
    const t = hitungTenggat('2027-03-01', kosong, true);
    expect(t.tenggat).toBe('2027-03-24');
    expect(t.diperpanjang).toBe(true);
  });

  it('menghitung keterlambatan dalam hari kerja', () => {
    expect(keterlambatan('2027-03-15', '2027-03-15', kosong)).toBe(0);
    expect(keterlambatan('2027-03-15', '2027-03-18', kosong)).toBe(3);
    // Melewati akhir pekan: 15 Maret Senin, 22 Maret Senin berikutnya.
    expect(keterlambatan('2027-03-15', '2027-03-22', kosong)).toBe(5);
  });

  it('perpanjangan hanya satu kali, dan wajib beralasan', () => {
    expect(bolehPerpanjang(false, 'Berkas berada di kecamatan dan menunggu salinan resmi.').boleh).toBe(
      true,
    );
    const ulang = bolehPerpanjang(true, 'Masih dicari.');
    expect(ulang.boleh).toBe(false);
    expect(ulang.alasan).toContain('mengajukan keberatan');

    const tanpaAlasan = bolehPerpanjang(false, 'sibuk');
    expect(tanpaAlasan.boleh).toBe(false);
    expect(tanpaAlasan.alasan).toContain('tidak pernah dinyatakan');
  });
});

describe('penolakan permohonan', () => {
  const tolak = (over = {}) => ({
    dasarHukum: 'Pasal 17 huruf h UU 14/2008',
    uraian: 'Informasi yang dimohonkan memuat data pribadi warga lain yang tidak memberi izin.',
    caraKeberatan: 'Keberatan diajukan kepada Atasan PPID paling lambat 30 hari kerja.',
    ...over,
  });

  it('menerima penolakan yang lengkap', () => {
    expect(bolehTolak(tolak()).boleh).toBe(true);
  });

  it('MENOLAK penolakan yang tidak menyebutkan cara mengajukan keberatan', () => {
    const h = bolehTolak(tolak({ caraKeberatan: '' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('hak itu dihapus tanpa ada yang menghapusnya');
  });

  it('menolak tanpa dasar hukum atau uraian', () => {
    expect(bolehTolak(tolak({ dasarHukum: '' })).boleh).toBe(false);
    expect(bolehTolak(tolak({ uraian: 'tidak bisa' })).boleh).toBe(false);
  });
});

describe('transisi permohonan informasi', () => {
  it('mengizinkan alur yang biasa', () => {
    expect(bolehPindahPermohonan('DITERIMA', 'DIPROSES').boleh).toBe(true);
    expect(bolehPindahPermohonan('DIPROSES', 'DIPERPANJANG').boleh).toBe(true);
    expect(bolehPindahPermohonan('DIPERPANJANG', 'DIPENUHI').boleh).toBe(true);
  });

  it('tidak mengubah permohonan yang sudah dijawab', () => {
    for (const akhir of ['DIPENUHI', 'DIPENUHI_SEBAGIAN', 'DITOLAK'] as const) {
      expect(TRANSISI_PERMOHONAN_INFORMASI[akhir]).toEqual([]);
      const h = bolehPindahPermohonan(akhir, 'DIPROSES');
      expect(h.boleh).toBe(false);
      expect(h.alasan).toContain('berkas tersendiri');
    }
  });

  it('tidak memperpanjang permohonan dua kali lewat transisi', () => {
    expect(bolehPindahPermohonan('DIPERPANJANG', 'DIPERPANJANG').boleh).toBe(false);
  });

  it('setiap status hanya menyebut status yang dikenal', () => {
    const dikenal = new Set(Object.keys(TRANSISI_PERMOHONAN_INFORMASI));
    for (const tujuan of Object.values(TRANSISI_PERMOHONAN_INFORMASI)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });

  it('menolak perpindahan ke status yang sama', () => {
    for (const s of Object.keys(TRANSISI_PERMOHONAN_INFORMASI) as StatusPermohonan[]) {
      expect(bolehPindahPermohonan(s, s).boleh).toBe(false);
    }
  });
});
