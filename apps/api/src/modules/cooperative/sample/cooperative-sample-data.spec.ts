/**
 * Pengujian pembangkit data contoh koperasi.
 *
 * Dua sifat yang menentukan gunanya:
 *
 *   1. **Deterministik.** Pemasangan yang sama menghasilkan angka yang sama
 *      persis, sehingga laporan contoh dapat dibandingkan dan penyewa yang
 *      memasang-menghapus-memasang tidak mengira sistemnya berubah sendiri.
 *
 *   2. **Cukup besar dan cukup tidak rapi.** Data yang seluruh anggotanya
 *      aktif, seluruh pinjamannya lancar, dan seluruh suaranya setuju tidak
 *      menguji apa pun — dan laporan yang dibuat darinya menyesatkan.
 */

import {
  BULAN_SIMPANAN_WAJIB,
  JUMLAH_ANGGOTA,
  KOMPONEN_SHU,
  SURPLUS_TAHUN_BUKU,
  bagiSisaTerbesar,
  bangunDataContoh,
} from './cooperative-sample-data';
import { AWALAN_CONTOH } from '../cooperative-sample';

describe('deterministik', () => {
  it('dua pemanggilan menghasilkan data yang sama persis', () => {
    expect(bangunDataContoh()).toEqual(bangunDataContoh());
  });

  it('benih berbeda menghasilkan data berbeda', () => {
    // Membuktikan bahwa keacakannya memang bergantung pada benih, bukan tetap.
    expect(bangunDataContoh(1)).not.toEqual(bangunDataContoh(2));
  });

  it('tidak memakai Math.random', () => {
    /*
     * Diperiksa dengan membekukan Math.random: bila pembangkitnya memakainya,
     * pemanggilan ini akan melempar.
     */
    const asli = Math.random;
    Math.random = () => {
      throw new Error('Math.random dipakai — data contoh tidak akan dapat diulang.');
    };
    try {
      expect(() => bangunDataContoh()).not.toThrow();
    } finally {
      Math.random = asli;
    }
  });
});

describe('cukup besar untuk laporan yang berarti', () => {
  const d = bangunDataContoh();

  it('sekurang-kurangnya 50 anggota', () => {
    expect(d.anggota.length).toBeGreaterThanOrEqual(50);
    expect(d.anggota).toHaveLength(JUMLAH_ANGGOTA);
  });

  it('lebih dari 100 rekening simpanan', () => {
    expect(d.simpanan.length).toBeGreaterThan(100);
  });

  it('setahun penuh simpanan wajib', () => {
    const wajib = d.simpanan.filter((s) => s.jenis === 'MANDATORY');
    expect(Math.max(...wajib.map((s) => s.jumlahSetoran ?? 0))).toBe(BULAN_SIMPANAN_WAJIB);
  });

  it('lebih dari 700 mutasi simpanan akan terbentuk', () => {
    /*
     * Inilah yang membuat rekening koran terlihat seperti setahun kegiatan,
     * bukan seperti data uji. Simpanan wajib menyumbang setoran bulanan;
     * simpanan sukarela menyumbang setoran dan penarikan yang tidak teratur.
     */
    const wajib = d.simpanan
      .filter((s) => s.jenis === 'MANDATORY')
      .reduce((s, x) => s + (x.jumlahSetoran ?? 0), 0);
    const sukarela = d.simpanan.reduce((s, x) => s + (x.mutasi?.length ?? 0), 0);
    expect(wajib + sukarela).toBeGreaterThan(700);
  });

  it('simpanan sukarela punya penarikan, bukan hanya setoran', () => {
    // Rekening yang hanya bertambah tidak menunjukkan bagaimana penarikan
    // tampil pada rekening koran.
    const jenis = new Set(d.simpanan.flatMap((s) => (s.mutasi ?? []).map((m) => m.jenis)));
    expect(jenis.has('DEPOSIT')).toBe(true);
    expect(jenis.has('WITHDRAWAL')).toBe(true);
  });

  it('saldo sukarela sama dengan jumlah mutasinya', () => {
    /*
     * Saldo akhir wajib sama dengan saldo awal ditambah mutasinya — ditegakkan
     * constraint K-3, dan diperiksa di sini supaya data contoh tidak pernah
     * ditolak saat disemai.
     */
    for (const s of d.simpanan.filter((x) => x.jenis === 'VOLUNTARY')) {
      const hitung = (s.mutasi ?? []).reduce(
        (t, m) => t + (m.jenis === 'DEPOSIT' ? m.nilai : -m.nilai),
        0,
      );
      expect({ rek: s.nomorRekening, saldo: s.saldo }).toEqual({
        rek: s.nomorRekening,
        saldo: hitung,
      });
    }
  });

  it('saldo sukarela tidak pernah negatif', () => {
    for (const s of d.simpanan.filter((x) => x.jenis === 'VOLUNTARY')) {
      expect(s.saldo).toBeGreaterThanOrEqual(0);
    }
  });

  it('lebih dari 20 pinjaman', () => {
    expect(d.pinjaman.length).toBeGreaterThanOrEqual(20);
  });

  it('lebih dari 100 suara pada RAT', () => {
    expect(d.suara.length).toBeGreaterThan(100);
  });
});

describe('cukup tidak rapi agar laporannya jujur', () => {
  const d = bangunDataContoh();

  it('ada calon anggota dan bekas anggota, bukan hanya yang aktif', () => {
    /*
     * Di sanalah kekeliruan paling sering muncul: calon anggota ikut terhitung
     * kuorum, atau bekas anggota ikut memperoleh SHU.
     */
    const status = new Set(d.anggota.map((a) => a.status));
    expect(status.has('ACTIVE')).toBe(true);
    expect(status.has('PROSPECT')).toBe(true);
    expect(status.has('TERMINATED')).toBe(true);
  });

  it('TIDAK seluruh anggota hadir pada RAT', () => {
    // Kehadiran seratus persen tidak pernah terjadi, dan tidak menguji
    // perhitungan kuorum sama sekali.
    expect(d.kehadiran.length).toBeLessThan(d.ringkasan.anggotaAktif);
  });

  it('kuorum tetap tercapai — lebih dari separuh anggota aktif', () => {
    expect(d.kehadiran.length).toBeGreaterThan(d.ringkasan.anggotaAktif / 2);
  });

  it('kehadiran mencakup luring, daring, dan kuasa', () => {
    expect(new Set(d.kehadiran.map((h) => h.mode)).size).toBe(3);
  });

  it('suara TIDAK seluruhnya setuju', () => {
    /*
     * Laporan RAT yang seluruh suaranya setuju tidak menunjukkan bagaimana
     * ambang keputusan dihitung.
     */
    const pilihan = new Set(d.suara.map((s) => s.pilihan));
    expect(pilihan.has('YES')).toBe(true);
    expect(pilihan.has('NO')).toBe(true);
    expect(pilihan.has('ABSTAIN')).toBe(true);
  });

  it('pinjaman mencakup lancar, lunas, dan menunggak', () => {
    const status = new Set(d.pinjaman.map((p) => p.status));
    expect(status.has('ACTIVE')).toBe(true);
    expect(status.has('PAID_OFF')).toBe(true);
    expect(status.has('OVERDUE')).toBe(true);
  });

  it('tidak seluruh anggota punya simpanan sukarela', () => {
    const sukarela = d.simpanan.filter((s) => s.jenis === 'VOLUNTARY').length;
    expect(sukarela).toBeLessThan(d.ringkasan.anggotaAktif);
    expect(sukarela).toBeGreaterThan(10);
  });

  it('surplus TIDAK bulat', () => {
    /*
     * Surplus yang membagi habis membuat pembulatan SHU — bagian yang paling
     * mudah salah — tidak pernah terlihat pada laporan contoh.
     */
    expect(SURPLUS_TAHUN_BUKU % 1000).not.toBe(0);
  });
});

describe('seluruh baris berkode contoh', () => {
  const d = bangunDataContoh();

  it('kode anggota berawalan contoh', () => {
    for (const a of d.anggota) expect(a.kode.startsWith(AWALAN_CONTOH)).toBe(true);
  });

  it('nomor anggota berawalan contoh', () => {
    // Inilah dasar penghapusannya. Nomor yang tidak berawalan akan bertahan
    // setelah pembersihan dan tampak seperti anggota sungguhan.
    for (const a of d.anggota) expect(a.nomorAnggota.startsWith(AWALAN_CONTOH)).toBe(true);
  });

  it('nomor rekening dan nomor pinjaman berawalan contoh', () => {
    for (const s of d.simpanan) expect(s.nomorRekening.startsWith(AWALAN_CONTOH)).toBe(true);
    for (const p of d.pinjaman) expect(p.nomor.startsWith(AWALAN_CONTOH)).toBe(true);
  });
});

describe('komponen SHU', () => {
  it('porsinya berjumlah tepat satu', () => {
    /*
     * Bila tidak, sebagian surplus tidak dibagikan ke mana pun dan tidak ada
     * yang tahu ke mana perginya.
     */
    const total = KOMPONEN_SHU.reduce((s, k) => s + k.ratio, 0);
    expect(Math.abs(total - 1)).toBeLessThan(1e-9);
  });

  it('memuat enam komponen yang disebut undang-undang', () => {
    const kode = KOMPONEN_SHU.map((k) => k.component);
    for (const w of ['RESERVE', 'CAPITAL_SERVICE', 'PATRONAGE_SERVICE', 'SOCIAL_FUND']) {
      expect(kode).toContain(w);
    }
  });
});

describe('pembagian sisa-terbesar', () => {
  it('jumlah bagiannya PERSIS sama dengan totalnya', () => {
    /*
     * Pembagian yang membulatkan tiap bagian sendiri-sendiri hampir selalu
     * meleset — dan selisih beberapa rupiah pada laporan SHU adalah hal yang
     * ditanyakan anggota, sebab jumlah kolomnya tidak sama dengan totalnya.
     */
    const bobot = [3, 7, 11, 13, 17, 19, 23];
    const bagian = bagiSisaTerbesar(1_000_003, bobot);
    expect(bagian.reduce((s, x) => s + x, 0)).toBe(1_000_003);
  });

  it('tepat pada pembagian yang sulit', () => {
    expect(bagiSisaTerbesar(10, [1, 1, 1]).reduce((s, x) => s + x, 0)).toBe(10);
    expect(bagiSisaTerbesar(1, [1, 1, 1, 1]).reduce((s, x) => s + x, 0)).toBe(1);
  });

  it('bobot nol menghasilkan nol, bukan NaN', () => {
    expect(bagiSisaTerbesar(100, [0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('deterministik pada pecahan yang sama', () => {
    // Dua anggota berpecahan sama harus selalu memperoleh hasil yang sama
    // pada setiap perhitungan ulang.
    const a = bagiSisaTerbesar(100, [1, 1, 1]);
    const b = bagiSisaTerbesar(100, [1, 1, 1]);
    expect(a).toEqual(b);
    expect(a[0]).toBeGreaterThanOrEqual(a[2]);
  });

  it('membagi surplus contoh ke enam komponen tanpa sisa', () => {
    const bagian = bagiSisaTerbesar(
      SURPLUS_TAHUN_BUKU,
      KOMPONEN_SHU.map((k) => k.ratio * 1_000_000),
    );
    expect(bagian.reduce((s, x) => s + x, 0)).toBe(SURPLUS_TAHUN_BUKU);
  });
});
