/**
 * Pengujian Anjungan Mandiri Desa.
 *
 * Satu aturan dijaga paling ketat: **anjungan tidak pernah mencari warga.**
 * Ia layar sentuh di ruang tunggu kantor desa — siapa pun dapat berdiri di
 * depannya, dan tidak ada yang menjaganya sepanjang hari. Anjungan yang dapat
 * dicari berdasarkan nama bukan anjungan layanan; ia terminal kependudukan yang
 * diletakkan di ruang publik.
 */

import {
  CETAK_MANDIRI_MAKSIMAL,
  HURUF_KODE,
  MENU_ANJUNGAN,
  PANDUAN,
  PANJANG_KODE,
  PERCOBAAN_MAKSIMAL,
  RUAS_ANJUNGAN,
  RUAS_TIDAK_DI_ANJUNGAN,
  bersihkanKode,
  bolehCetakMandiri,
  bolehIsiBukuTamu,
  bolehMencoba,
  formatKode,
  panduan,
  periksaBentukKode,
  pesanGagal,
  proyeksikanAnjungan,
  type JenisTampilan,
} from './village-kiosk';

describe('kode ambil dibuat untuk dibaca orang', () => {
  it('tidak memakai huruf yang mudah tertukar', () => {
    // 0/O, 1/I/L adalah pasangan yang paling sering tertukar pada cetakan kecil
    // yang dibaca sambil berdiri.
    for (const huruf of ['0', 'O', '1', 'I', 'L']) {
      expect(HURUF_KODE).not.toContain(huruf);
    }
  });

  it('memakai huruf besar dan angka saja', () => {
    expect(HURUF_KODE).toMatch(/^[A-Z2-9]+$/);
    expect(new Set(HURUF_KODE).size).toBe(HURUF_KODE.length);
  });

  it('ditampilkan berkelompok empat', () => {
    expect(formatKode('A7K29MPQ')).toBe('A7K2-9MPQ');
  });

  it('memaafkan tanda hubung, spasi, dan huruf kecil', () => {
    // Warga mengetik apa yang dilihatnya, dan yang dilihatnya bertanda hubung.
    for (const masukan of ['A7K2-9MPQ', 'a7k2 9mpq', ' A7K2-9MPQ ', 'a7k29mpq']) {
      expect(bersihkanKode(masukan)).toBe('A7K29MPQ');
      expect(periksaBentukKode(masukan).boleh).toBe(true);
    }
  });

  it('menolak kode yang panjangnya salah, menyebut panjang yang benar', () => {
    const h = periksaBentukKode('A7K2');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain(String(PANJANG_KODE));
  });

  it('MENYARANKAN huruf pengganti ketika yang diketik mirip', () => {
    // Warga yang mengetik "O" padahal seharusnya "Q" tidak akan menemukan
    // kesalahannya sendiri.
    const h = periksaBentukKode('A7K29MPO');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Q');

    const i = periksaBentukKode('A7K29MP1');
    expect(i.boleh).toBe(false);
    expect(i.alasan).toContain('J');
  });
});

describe('pembatasan percobaan', () => {
  const kini = '2027-03-11T10:00:00.000Z';

  it('mengizinkan percobaan selama masih ada sisa', () => {
    const h = bolehMencoba({ percobaanGagal: 2 }, kini);
    expect(h.boleh).toBe(true);
    expect(h.sisaPercobaan).toBe(PERCOBAAN_MAKSIMAL - 2);
  });

  it('menolak setelah percobaan habis', () => {
    expect(bolehMencoba({ percobaanGagal: PERCOBAAN_MAKSIMAL }, kini).boleh).toBe(false);
  });

  it('menolak selama masih terkunci', () => {
    const h = bolehMencoba({ percobaanGagal: 0, terkunciSampai: '2027-03-11T10:10:00.000Z' }, kini);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('petugas loket');
  });

  it('mengizinkan lagi setelah kuncinya lewat', () => {
    expect(
      bolehMencoba({ percobaanGagal: 0, terkunciSampai: '2027-03-11T09:00:00.000Z' }, kini).boleh,
    ).toBe(true);
  });

  it('pesan gagal TIDAK membedakan kode yang ada dari yang tidak ada', () => {
    // Membedakannya memberi tahu penebak bahwa tebakannya sudah mendekati — dan
    // pada terminal publik, itu satu-satunya petunjuk yang ia butuhkan.
    const pesan = pesanGagal(3);
    expect(pesan).toContain('tidak dikenali');
    expect(pesan).not.toMatch(/tidak ditemukan|belum terdaftar|salah/i);
  });

  it('memberi peringatan khusus pada percobaan terakhir', () => {
    expect(pesanGagal(1)).toContain('satu percobaan lagi');
    expect(pesanGagal(0)).toContain('terkunci');
  });
});

describe('anjungan tidak menampilkan data pribadi', () => {
  it('proyeksi hanya mengeluarkan ruas yang diizinkan', () => {
    const baris = {
      requestNumber: '470/12/2027',
      serviceName: 'Surat Keterangan Domisili',
      status: 'DITERBITKAN',
      // Yang di bawah tidak boleh keluar.
      applicantName: 'Sumiati',
      applicantNik: '3301010101010001',
      address: 'Jalan Contoh 1',
    };
    const hasil = proyeksikanAnjungan('PERMOHONAN', baris);
    expect(hasil.requestNumber).toBe('470/12/2027');
    expect(hasil).not.toHaveProperty('applicantName');
    expect(hasil).not.toHaveProperty('applicantNik');
    expect(hasil).not.toHaveProperty('address');
  });

  it('NAMA PEMOHON pun tidak ditampilkan', () => {
    // Warga yang memasukkan kode ambil sudah tahu namanya sendiri; yang
    // mengantre di belakangnya tidak perlu ikut tahu.
    const semua = Object.values(RUAS_ANJUNGAN).flat() as string[];
    expect(semua).not.toContain('applicantName');
  });

  it('tidak satu pun ruas terlarang ada pada daftar izin', () => {
    const semua = Object.values(RUAS_ANJUNGAN).flat() as string[];
    for (const terlarang of RUAS_TIDAK_DI_ANJUNGAN) {
      expect(semua).not.toContain(terlarang);
    }
  });

  it('daftar terlarang memuat yang paling mungkin diminta kelak', () => {
    for (const wajib of ['nik', 'applicantName', 'address', 'birthDate']) {
      expect(RUAS_TIDAK_DI_ANJUNGAN as readonly string[]).toContain(wajib);
    }
  });

  it('setiap jenis tampilan punya daftar izinnya', () => {
    for (const jenis of Object.keys(RUAS_ANJUNGAN) as JenisTampilan[]) {
      expect(RUAS_ANJUNGAN[jenis].length).toBeGreaterThan(0);
    }
  });

  it('tidak meloloskan properti dari prototipe', () => {
    const jahat = Object.create({ requestNumber: 'dari prototipe' }) as Record<string, unknown>;
    expect(proyeksikanAnjungan('PERMOHONAN', jahat)).toEqual({});
  });
});

describe('pencetakan mandiri', () => {
  const cetak = (over = {}) => ({
    status: 'DITERBITKAN',
    adaSurat: true,
    suratDicabut: false,
    sudahDicetak: 0,
    ...over,
  });

  it('mengizinkan surat yang sudah terbit', () => {
    expect(bolehCetakMandiri(cetak()).boleh).toBe(true);
    expect(bolehCetakMandiri(cetak({ status: 'DISERAHKAN' })).boleh).toBe(true);
  });

  it('menolak surat yang belum terbit, dengan kalimat yang menenangkan', () => {
    const h = bolehCetakMandiri(cetak({ status: 'DIVERIFIKASI', adaSurat: false }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('belum terbit');
    expect(h.alasan).toContain('memeriksa perkembangannya');
  });

  it('menolak surat yang sudah dicabut', () => {
    const h = bolehCetakMandiri(cetak({ suratDicabut: true }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('dicabut');
  });

  it('membatasi jumlah cetak mandiri, lalu mengarahkan ke loket', () => {
    // Surat keterangan yang beredar dalam sepuluh salinan asli tidak lagi dapat
    // dipakai membuktikan apa pun.
    expect(bolehCetakMandiri(cetak({ sudahDicetak: CETAK_MANDIRI_MAKSIMAL - 1 })).boleh).toBe(true);
    const h = bolehCetakMandiri(cetak({ sudahDicetak: CETAK_MANDIRI_MAKSIMAL }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('loket');
  });
});

describe('buku tamu', () => {
  const tamu = (over = {}) => ({
    nama: 'Sumiati',
    keperluan: 'LAYANAN_SURAT' as const,
    ...over,
  });

  it('menerima isian yang hanya berisi nama dan keperluan', () => {
    expect(bolehIsiBukuTamu(tamu()).boleh).toBe(true);
  });

  it('TIDAK meminta NIK', () => {
    // Meminta NIK pada layar terbuka di ruang tunggu berarti mengumpulkan nomor
    // induk warga di tempat yang paling mudah dilihat orang lain, untuk
    // keperluan yang tidak memerlukannya.
    const isian = tamu();
    expect(Object.keys(isian)).not.toContain('nik');
    expect(bolehIsiBukuTamu(isian).boleh).toBe(true);
  });

  it('menolak nama kosong atau terlalu pendek', () => {
    expect(bolehIsiBukuTamu(tamu({ nama: '' })).boleh).toBe(false);
    expect(bolehIsiBukuTamu(tamu({ nama: 'S' })).boleh).toBe(false);
  });

  it('telepon boleh kosong', () => {
    expect(bolehIsiBukuTamu(tamu({ telepon: null })).boleh).toBe(true);
    expect(bolehIsiBukuTamu(tamu({ telepon: '0812-3456-7890' })).boleh).toBe(true);
  });

  it('menolak telepon yang jelas bukan nomor, dan menyarankan mengosongkannya', () => {
    const h = bolehIsiBukuTamu(tamu({ telepon: 'tidak punya hp' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Kosongkan');
  });
});

describe('panduan langkah demi langkah', () => {
  it('menyediakan panduan untuk kelima fungsi utama', () => {
    for (const kode of ['CETAK_SURAT', 'CEK_STATUS', 'ANTREAN', 'ADUAN', 'BUKU_TAMU']) {
      expect(panduan(kode)).not.toBeNull();
    }
  });

  it('setiap panduan bernomor urut mulai satu', () => {
    for (const p of PANDUAN) {
      expect(p.langkah.length).toBeGreaterThan(2);
      p.langkah.forEach((l, i) => {
        expect([p.kode, l.nomor]).toEqual([p.kode, i + 1]);
      });
    }
  });

  it('setiap langkah punya judul pendek dan uraian yang menjelaskan', () => {
    for (const p of PANDUAN) {
      for (const l of p.langkah) {
        expect([p.kode, l.judul.length <= 40]).toEqual([p.kode, true]);
        expect([p.kode, l.uraian.length > 20]).toEqual([p.kode, true]);
      }
    }
  });

  it('tidak memakai istilah yang hanya dimengerti perangkat desa', () => {
    // Warga yang membaca "unggah dokumen persyaratan" akan berhenti; yang
    // membaca "bawa fotokopi KTP dan KK" tidak.
    const teks = PANDUAN.flatMap((p) => p.langkah.map((l) => `${l.judul} ${l.uraian}`)).join(' ');
    for (const istilah of ['unggah', 'submit', 'workflow', 'disposisi', 'verifikasi berkas']) {
      expect(teks.toLowerCase()).not.toContain(istilah);
    }
  });

  it('mengembalikan null untuk panduan yang tidak ada', () => {
    expect(panduan('TIDAK_ADA')).toBeNull();
  });
});

describe('menu anjungan', () => {
  it('memuat kelima fungsi yang dijanjikan presentasi', () => {
    const kode = MENU_ANJUNGAN.map((m) => m.kode);
    // Cetak surat, cek status & antrean, pengumuman & info bantuan, buku tamu,
    // dan panduan langkah demi langkah.
    for (const wajib of ['CETAK_SURAT', 'CEK_STATUS', 'ANTREAN', 'PENGUMUMAN', 'BUKU_TAMU', 'PANDUAN']) {
      expect(kode).toContain(wajib);
    }
  });

  it('memuat tiga fungsi yang disebut slide lain', () => {
    const kode = MENU_ANJUNGAN.map((m) => m.kode);
    // "Ajukan via mobile/anjungan", "dukungan kanal mobile & anjungan" untuk
    // pengaduan, dan "absensi ronda via mobile/anjungan".
    for (const wajib of ['AJUKAN_SURAT', 'LAPOR', 'RONDA']) {
      expect(kode).toContain(wajib);
    }
  });

  it('setiap menu punya kode yang unik dan keterangan yang dapat dibaca warga', () => {
    const kode = MENU_ANJUNGAN.map((m) => m.kode);
    expect(new Set(kode).size).toBe(kode.length);
    for (const m of MENU_ANJUNGAN) {
      expect([m.kode, m.label.length <= 20]).toEqual([m.kode, true]);
      expect([m.kode, m.keterangan.length > 10]).toEqual([m.kode, true]);
    }
  });

  it('menu yang memerlukan kode ambil ditandai', () => {
    const perluKode = MENU_ANJUNGAN.filter((m) => m.perluKode).map((m) => m.kode);
    expect(perluKode.sort()).toEqual(['CEK_STATUS', 'CETAK_SURAT']);
  });

  it('TIDAK ada menu pencarian warga', () => {
    const kode = MENU_ANJUNGAN.map((m) => m.kode.toLowerCase()).join(' ');
    const label = MENU_ANJUNGAN.map((m) => m.label.toLowerCase()).join(' ');
    for (const terlarang of ['cari', 'search', 'penduduk', 'warga_', 'daftar_warga']) {
      expect(kode).not.toContain(terlarang);
    }
    expect(label).not.toContain('cari warga');
    expect(label).not.toContain('data penduduk');
  });
});
