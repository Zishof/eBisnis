/**
 * Pengujian jenjang tarif pendaftaran pasien.
 *
 * Angka pada berkas ini akan ditagihkan kepada penyewa, jadi seluruhnya
 * dihitung tangan lebih dahulu dan ditulis apa adanya — bukan disalin dari
 * keluaran program.
 */

import {
  JENJANG_BAWAAN,
  hitungTarifHarian,
  hitungTertagih,
  periksaJenjang,
  tertagih,
  type Jenjang,
  type PendaftaranUntukTagihan,
} from './health-billing';

const wajar: PendaftaranUntukTagihan = {
  isSampleData: false,
  isTrainingTenant: false,
  isTestPatient: false,
  cancelledBeforeService: false,
  supersededByCorrection: false,
};

describe('jenjang bawaan', () => {
  it('susunannya sehat', () => {
    const v = periksaJenjang(JENJANG_BAWAAN);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  it('jenjang tertinggi dinegosiasikan, bukan berangka', () => {
    /*
     * Spesifikasi menyebut 500+ sebagai "contract/negotiation". Menaruh angka
     * apa pun di sana berarti menagihkan tarif yang tidak pernah disepakati.
     */
    const tertinggi = JENJANG_BAWAAN[JENJANG_BAWAAN.length - 1];
    expect(tertinggi.from).toBe(500);
    expect(tertinggi.to).toBeNull();
    expect(tertinggi.pricePerRegistration).toBeNull();
  });
});

describe('perhitungan marginal bertingkat', () => {
  it('satu pendaftaran ditagih tarif jenjang pertama', () => {
    expect(hitungTarifHarian(1).total).toBe(10_000);
  });

  it('tepat di batas jenjang pertama', () => {
    // 49 × 10.000
    expect(hitungTarifHarian(49).total).toBe(490_000);
  });

  it('melewati satu batas menagih marginal, bukan seluruhnya pada tarif baru', () => {
    /*
     * Inilah bedanya marginal bertingkat dari jenjang biasa, dan inilah yang
     * paling mudah salah:
     *
     *   jenjang biasa      : 50 × 7.500 = 375.000
     *   marginal bertingkat: 49 × 10.000 + 1 × 7.500 = 497.500
     */
    expect(hitungTarifHarian(50).total).toBe(497_500);
  });

  it('melewati dua batas', () => {
    // 49×10.000 + 50×7.500 + 21×5.000 = 490.000 + 375.000 + 105.000
    expect(hitungTarifHarian(120).total).toBe(970_000);
  });

  it('melewati tiga batas', () => {
    // 49×10.000 + 50×7.500 + 100×5.000 + 51×3.500
    // = 490.000 + 375.000 + 500.000 + 178.500 = 1.543.500
    expect(hitungTarifHarian(250).total).toBe(1_543_500);
  });

  it('tepat di batas terakhir sebelum negosiasi', () => {
    // 49×10.000 + 50×7.500 + 100×5.000 + 300×3.500
    // = 490.000 + 375.000 + 500.000 + 1.050.000 = 2.415.000
    const h = hitungTarifHarian(499);
    expect(h.total).toBe(2_415_000);
    expect(h.requiresNegotiation).toBe(false);
  });

  it('di atas lima ratus menandai perlu negosiasi', () => {
    const h = hitungTarifHarian(600);
    expect(h.requiresNegotiation).toBe(true);
    expect(h.negotiationFrom).toBe(500);
  });

  it('bagian yang dinegosiasikan tidak menambah total maupun dikarang angkanya', () => {
    /*
     * Menagih nol untuk 101 pendaftaran jelas salah — tetapi menagih angka
     * karangan lebih buruk, karena penyewa menerima tagihan atas tarif yang
     * tidak pernah ia setujui. Yang benar: tandai bahwa tagihannya belum
     * lengkap, dan biarkan manusia menyepakatinya.
     */
    const h = hitungTarifHarian(600);
    const baris = h.lines.find((l) => l.from === 500);
    expect(baris?.count).toBe(101);
    expect(baris?.subtotal).toBe(0);
    expect(h.total).toBe(hitungTarifHarian(499).total);
  });

  it('nol dan negatif tidak menagih apa pun', () => {
    for (const n of [0, -5, Number.NaN]) {
      const h = hitungTarifHarian(n);
      expect(h.total).toBe(0);
      expect(h.lines).toEqual([]);
    }
  });

  it('pecahan dibulatkan ke bawah', () => {
    // Setengah pendaftaran bukan hal yang ada; membulatkan ke atas akan menagih
    // pendaftaran yang tidak pernah terjadi.
    expect(hitungTarifHarian(49.9).total).toBe(hitungTarifHarian(49).total);
  });

  it('rincian per jenjang berjumlah sama dengan totalnya', () => {
    for (const n of [1, 49, 50, 120, 250, 499, 600]) {
      const h = hitungTarifHarian(n);
      const jumlah = h.lines.reduce((s, l) => s + l.subtotal, 0);
      expect(jumlah).toBe(h.total);
    }
  });

  it('cacah pada rincian berjumlah sama dengan pendaftarannya', () => {
    for (const n of [1, 49, 50, 120, 250, 499, 600]) {
      const h = hitungTarifHarian(n);
      const cacah = h.lines.reduce((s, l) => s + l.count, 0);
      expect(cacah).toBe(n);
    }
  });

  it('tarif per pendaftaran menurun seiring bertambahnya jumlah', () => {
    // Janji "makin banyak makin hemat" harus terbukti pada angkanya.
    const rerata = (n: number) => hitungTarifHarian(n).total / n;
    expect(rerata(120)).toBeLessThan(rerata(49));
    expect(rerata(250)).toBeLessThan(rerata(120));
  });
});

describe('pemeriksaan susunan jenjang', () => {
  it('menolak jenjang kosong', () => {
    expect(periksaJenjang([]).ok).toBe(false);
  });

  it('menolak yang tidak mulai dari satu', () => {
    const j: Jenjang[] = [{ from: 5, to: null, pricePerRegistration: 1000 }];
    expect(periksaJenjang(j).problems.join(' ')).toContain('mulai dari 1');
  });

  it('menemukan lubang antar jenjang', () => {
    // Pendaftaran ke-51 tidak masuk jenjang mana pun; tagihannya diam-diam
    // kurang, dan tidak ada yang menyadarinya.
    const j: Jenjang[] = [
      { from: 1, to: 50, pricePerRegistration: 10_000 },
      { from: 60, to: null, pricePerRegistration: 5_000 },
    ];
    expect(periksaJenjang(j).problems.join(' ')).toContain('lubang');
  });

  it('menemukan tumpang tindih', () => {
    const j: Jenjang[] = [
      { from: 1, to: 50, pricePerRegistration: 10_000 },
      { from: 40, to: null, pricePerRegistration: 5_000 },
    ];
    expect(periksaJenjang(j).problems.join(' ')).toContain('tumpang tindih');
  });

  it('menuntut jenjang terakhir tanpa batas atas', () => {
    // Tanpa itu, jumlah di atas batas tertinggi tidak tertagih sama sekali.
    const j: Jenjang[] = [{ from: 1, to: 100, pricePerRegistration: 10_000 }];
    expect(periksaJenjang(j).problems.join(' ')).toContain('tanpa batas atas');
  });

  it('menolak tarif negatif', () => {
    const j: Jenjang[] = [{ from: 1, to: null, pricePerRegistration: -100 }];
    expect(periksaJenjang(j).problems.join(' ')).toContain('negatif');
  });
});

describe('apa yang tertagih', () => {
  it('pendaftaran wajar tertagih', () => {
    expect(tertagih(wajar).billable).toBe(true);
  });

  it('data contoh tidak tertagih', () => {
    const v = tertagih({ ...wajar, isSampleData: true });
    expect(v.billable).toBe(false);
    expect(v.reason).toBe('SAMPLE_DATA');
  });

  it('lingkungan pelatihan tidak tertagih apa pun isinya', () => {
    const v = tertagih({ ...wajar, isTrainingTenant: true });
    expect(v.billable).toBe(false);
    expect(v.reason).toBe('TRAINING_TENANT');
  });

  it('pasien uji tidak tertagih', () => {
    expect(tertagih({ ...wajar, isTestPatient: true }).reason).toBe('TEST_PATIENT');
  });

  it('dibatalkan sebelum layanan tidak tertagih', () => {
    expect(tertagih({ ...wajar, cancelledBeforeService: true }).reason).toBe(
      'CANCELLED_BEFORE_SERVICE',
    );
  });

  it('pendaftaran ganda yang sudah dikoreksi tidak tertagih', () => {
    // Menagih keduanya berarti menagih satu kunjungan dua kali.
    expect(tertagih({ ...wajar, supersededByCorrection: true }).reason).toBe('DUPLICATE_CORRECTED');
  });

  it('lingkungan pelatihan mengalahkan alasan lain', () => {
    /*
     * Urutan pemeriksaan menentukan alasan mana yang dilaporkan. Yang paling
     * menyeluruh harus menang, supaya laporannya menjelaskan sebab yang
     * sesungguhnya alih-alih gejalanya.
     */
    const v = tertagih({ ...wajar, isTrainingTenant: true, isSampleData: true });
    expect(v.reason).toBe('TRAINING_TENANT');
  });

  it('setiap penolakan menyertakan keterangan yang dapat dibaca', () => {
    const kasus: Array<Partial<PendaftaranUntukTagihan>> = [
      { isSampleData: true },
      { isTrainingTenant: true },
      { isTestPatient: true },
      { cancelledBeforeService: true },
      { supersededByCorrection: true },
    ];
    for (const k of kasus) {
      const v = tertagih({ ...wajar, ...k });
      expect(v.billable).toBe(false);
      expect((v.explanation ?? '').length).toBeGreaterThan(20);
    }
  });
});

describe('menghitung yang tertagih dari sekumpulan pendaftaran', () => {
  it('memisahkan yang tertagih dari yang tidak, beserta sebabnya', () => {
    const daftar: PendaftaranUntukTagihan[] = [
      wajar,
      wajar,
      wajar,
      { ...wajar, isSampleData: true },
      { ...wajar, isSampleData: true },
      { ...wajar, cancelledBeforeService: true },
    ];
    const h = hitungTertagih(daftar);
    expect(h.billable).toBe(3);
    expect(h.excluded).toBe(3);
    expect(h.byReason.SAMPLE_DATA).toBe(2);
    expect(h.byReason.CANCELLED_BEFORE_SERVICE).toBe(1);
  });

  it('daftar kosong tidak menagih apa pun', () => {
    expect(hitungTertagih([])).toEqual({ billable: 0, excluded: 0, byReason: {} });
  });

  it('yang tertagih dan yang dikecualikan berjumlah seluruhnya', () => {
    const daftar = [wajar, { ...wajar, isTestPatient: true }, wajar];
    const h = hitungTertagih(daftar);
    expect(h.billable + h.excluded).toBe(daftar.length);
  });
});

describe('gabungan: dari pendaftaran mentah ke tagihan', () => {
  it('data contoh tidak menaikkan tagihan', () => {
    /*
     * Pemeriksaan yang paling penting pada seluruh berkas ini. Tenant demo
     * yang datanya dibuat sistem tidak boleh menerima tagihan — dan tagihan
     * yang salah adalah kerugian yang dapat dituntut.
     */
    const nyata = Array.from({ length: 30 }, () => wajar);
    const contoh = Array.from({ length: 500 }, () => ({ ...wajar, isSampleData: true }));

    const h = hitungTertagih([...nyata, ...contoh]);
    expect(h.billable).toBe(30);

    const tarif = hitungTarifHarian(h.billable);
    expect(tarif.total).toBe(300_000); // 30 × 10.000
    expect(tarif.requiresNegotiation).toBe(false);
  });
});
