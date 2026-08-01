/**
 * Pengujian aturan penerimaan kiriman dari internet.
 *
 * Yang dijaga bukan peladen melainkan **antrean pengurus**. Lamaran yang tidak
 * pernah dibaca sama saja dengan lamaran yang tidak pernah masuk — dan pengurus
 * berhenti membaca ketika isinya seratus baris sampah.
 *
 * Sekaligus dijaga sisi sebaliknya: calon anggota yang sungguhan tidak boleh
 * tertolak. Batas yang terlalu ketat menolak orang yang berniat mendaftar, dan
 * itu kerugian yang tidak terlihat sama sekali dari sisi sistem.
 */

import {
  BATAS_HARIAN_PER_KOPERASI,
  JEDA_NOMOR_SAMA_DETIK,
  bolehMenerimaLamaran,
  normalkanTelepon,
  periksaIsian,
  sidikSumber,
  type IsianLamaran,
  type KeadaanAntrean,
} from './public-intake';

const antrean = (over: Partial<KeadaanAntrean> = {}): KeadaanAntrean => ({
  lamaranHariIni: 0,
  detikSejakNomorTerakhir: null,
  adaYangMasihMenunggu: false,
  ...over,
});

const isian = (over: Partial<IsianLamaran> = {}): IsianLamaran => ({
  fullName: 'Siti Rahayu',
  phone: '081234567890',
  ...over,
});

describe('antrean pengurus dijaga', () => {
  it('menerima lamaran pertama', () => {
    expect(bolehMenerimaLamaran(antrean()).allowed).toBe(true);
  });

  it('menolak bila nomor itu masih punya lamaran yang menunggu', () => {
    /*
     * Diperiksa PALING DAHULU, dan pesannya menenangkan — orang yang mengirim
     * dua kali biasanya mengira yang pertama gagal, bukan sedang mencoba
     * membanjiri.
     */
    const v = bolehMenerimaLamaran(antrean({ adaYangMasihMenunggu: true }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('ALREADY_PENDING');
    expect(v.message).toContain('Tidak perlu mengirim ulang');
  });

  it('menahan nomor yang sama selama jedanya belum lewat', () => {
    const v = bolehMenerimaLamaran(antrean({ detikSejakNomorTerakhir: 60 }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('PHONE_COOLDOWN');
    expect(v.retryAfter).toBeGreaterThan(0);
  });

  it('mengizinkan lagi setelah jedanya lewat', () => {
    expect(
      bolehMenerimaLamaran(antrean({ detikSejakNomorTerakhir: JEDA_NOMOR_SAMA_DETIK + 1 })).allowed,
    ).toBe(true);
  });

  it('menolak bila kuota harian koperasi tercapai', () => {
    const v = bolehMenerimaLamaran(antrean({ lamaranHariIni: BATAS_HARIAN_PER_KOPERASI }));
    expect(v.allowed).toBe(false);
    expect(v.code).toBe('DAILY_QUOTA_REACHED');
  });

  it('pesan kuota TIDAK menyebutkan bahwa koperasi sedang dibanjiri', () => {
    /*
     * Calon anggota yang tidak bersalah tidak perlu tahu bahwa koperasi ini
     * sedang diserang, dan yang menyerang tidak perlu memperoleh kepastian
     * bahwa serangannya berhasil.
     */
    const v = bolehMenerimaLamaran(antrean({ lamaranHariIni: 999 }));
    expect(v.message).not.toMatch(/serang|banjir|spam|blokir/i);
    expect(v.message).toContain('hubungi pengurus');
  });

  it('kuotanya masuk akal bagi koperasi yang ramai', () => {
    // Bukan tentang kemampuan peladen melainkan berapa yang sanggup dibaca
    // pengurus.
    expect(BATAS_HARIAN_PER_KOPERASI).toBeGreaterThanOrEqual(20);
    expect(BATAS_HARIAN_PER_KOPERASI).toBeLessThanOrEqual(200);
  });

  it('jedanya tidak menghukum orang yang salah ketik nomornya', () => {
    // Cukup pendek supaya ia dapat memperbaikinya pada hari yang sama.
    expect(JEDA_NOMOR_SAMA_DETIK).toBeLessThanOrEqual(12 * 60 * 60);
  });
});

describe('penormalan nomor telepon', () => {
  it('tiga bentuk nomor yang sama menjadi satu', () => {
    /*
     * Menyimpannya dalam tiga bentuk membuat jeda antar kiriman tidak berlaku
     * — pengirim yang sama cukup mengganti bentuknya untuk melewatinya.
     */
    const harapan = '081234567890';
    for (const bentuk of ['081234567890', '6281234567890', '+6281234567890', '+62 812-3456-7890']) {
      expect({ bentuk, hasil: normalkanTelepon(bentuk) }).toEqual({ bentuk, hasil: harapan });
    }
  });

  it('menolak nomor yang bukan telepon Indonesia', () => {
    for (const n of ['12345', 'abcdefghij', '071234567890', '+1234567890', '08']) {
      expect({ n, hasil: normalkanTelepon(n) }).toEqual({ n, hasil: null });
    }
  });

  it('menerima panjang nomor yang lazim', () => {
    expect(normalkanTelepon('081234567890')).toBeTruthy();
    expect(normalkanTelepon('08123456789012')).toBeTruthy();
  });
});

describe('mutu isian', () => {
  it('menerima isian yang wajar', () => {
    expect(periksaIsian(isian()).allowed).toBe(true);
  });

  it('menolak nama yang terlalu pendek', () => {
    expect(periksaIsian(isian({ fullName: 'Ab' })).code).toBe('NAME_TOO_SHORT');
  });

  it('menolak nama tanpa satu pun huruf', () => {
    expect(periksaIsian(isian({ fullName: '123456' })).code).toBe('NAME_NOT_A_NAME');
  });

  it('MENERIMA nama yang memuat angka', () => {
    /*
     * Menolaknya akan menolak orang yang namanya memang demikian tertulis pada
     * kartu identitasnya — kerugian yang tidak terlihat dari sisi sistem.
     */
    expect(periksaIsian(isian({ fullName: 'Siti Rahayu 2' })).allowed).toBe(true);
  });

  it('menolak tautan pada kolom nama', () => {
    for (const n of ['http://spam.example', 'www.spam.example Siti']) {
      expect(periksaIsian(isian({ fullName: n })).code).toBe('NAME_HAS_LINK');
    }
  });

  it('menolak nomor telepon yang tidak sah, dengan contoh', () => {
    const v = periksaIsian(isian({ phone: '12345' }));
    expect(v.code).toBe('PHONE_INVALID');
    expect(v.message).toContain('081234567890');
  });

  it('menolak surel yang tidak sah', () => {
    expect(periksaIsian(isian({ email: 'bukan surel' })).code).toBe('EMAIL_INVALID');
  });

  it('surel kosong tetap sah — ia memang tidak wajib', () => {
    expect(periksaIsian(isian({ email: null })).allowed).toBe(true);
  });

  it('MENERIMA satu tautan pada alasan bergabung', () => {
    /*
     * Calon anggota kadang menyertakan tautan usahanya, dan menolaknya akan
     * menolak orang yang justru paling berniat.
     */
    expect(
      periksaIsian(isian({ motivation: 'Saya punya warung, https://tokosaya.example' })).allowed,
    ).toBe(true);
  });

  it('menolak lebih dari dua tautan', () => {
    expect(
      periksaIsian(
        isian({ motivation: 'https://a.example https://b.example https://c.example' }),
      ).code,
    ).toBe('TOO_MANY_LINKS');
  });

  it('menolak uraian yang kepanjangan', () => {
    expect(periksaIsian(isian({ motivation: 'x'.repeat(2100) })).code).toBe(
      'MOTIVATION_TOO_LONG',
    );
  });
});

describe('sidik sumber', () => {
  /*
   * Pengujian pertama di sini pernah berbunyi `expect(sidik).toContain('garam')`
   * dan LULUS terhadap penerapan yang mengembalikan `garam:203.0.113.10` —
   * alamat mentah, utuh, pada kolom bernama `source_ip_hash`. Yang diperiksanya
   * benar tetapi bukan yang penting.
   *
   * Yang penting adalah kebalikannya: alamatnya TIDAK boleh ada di sana.
   */
  it('alamat mentah tidak muncul pada hasilnya', () => {
    const ip = '203.0.113.10';
    const sidik = sidikSumber(ip, 'penyewa-1')!;
    expect(sidik).not.toContain(ip);
    expect(sidik).not.toContain('203');
    expect(sidik).not.toContain('penyewa-1');
  });

  it('hasilnya heksadesimal berukuran tetap', () => {
    expect(sidikSumber('203.0.113.10', 'penyewa-1')).toMatch(/^[0-9a-f]{32}$/);
    // Panjangnya tidak membocorkan panjang alamatnya.
    expect(sidikSumber('10.0.0.1', 'penyewa-1')).toHaveLength(32);
    expect(sidikSumber('2001:db8::8a2e:370:7334', 'penyewa-1')).toHaveLength(32);
  });

  it('alamat sama menghasilkan sidik sama — masih dapat dihitung', () => {
    expect(sidikSumber('203.0.113.10', 'penyewa-1')).toBe(sidikSumber('203.0.113.10', 'penyewa-1'));
  });

  it('alamat berbeda menghasilkan sidik berbeda', () => {
    expect(sidikSumber('203.0.113.10', 'penyewa-1')).not.toBe(
      sidikSumber('203.0.113.11', 'penyewa-1'),
    );
  });

  it('penyewa berbeda menyidik alamat yang sama secara berbeda', () => {
    /*
     * Tanpa ini, kiriman seseorang dapat dirangkaikan antar koperasi hanya
     * dengan membandingkan kolomnya — persis hal yang pemisahan penyewa
     * seharusnya cegah.
     */
    expect(sidikSumber('203.0.113.10', 'penyewa-1')).not.toBe(
      sidikSumber('203.0.113.10', 'penyewa-2'),
    );
  });

  it('alamat kosong menghasilkan null, bukan galat', () => {
    expect(sidikSumber(undefined, 'penyewa-1')).toBeNull();
  });
});
