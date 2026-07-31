/**
 * Pengujian perencanaan dan APBDes.
 *
 * Satu aturan dijaga paling ketat: **belanja melampaui pagu ditolak, bukan
 * diperingatkan.** Pada APBDes itu pelanggaran, dan sistem yang memperingatkan
 * lalu menerima hanya memindahkan tanggung jawabnya kepada petugas yang menekan
 * "lanjutkan".
 */

import {
  NILAI_WAJIB,
  TRANSISI_ANGGARAN,
  VILLAGE_EVENTS,
  bolehMasukRkp,
  bolehMengikat,
  bolehMerealisasi,
  bolehPindahAnggaran,
  bolehTurunkanPagu,
  bolehUbahPagu,
  isVillageEvent,
  periksaKeseimbangan,
  periksaNilaiWajib,
  serapan,
  sisaIkatan,
  sisaPagu,
  tahunDalamPeriode,
  type PaguKegiatan,
  type StatusAnggaran,
} from './village-budget';

const pagu = (over: Partial<PaguKegiatan> = {}): PaguKegiatan => ({
  ceiling: 100_000_000,
  committed: 0,
  realized: 0,
  ...over,
});

describe('transisi anggaran', () => {
  it('mengizinkan alur penyusunan yang biasa', () => {
    const alur: Array<[StatusAnggaran, StatusAnggaran]> = [
      ['DRAF', 'DIBAHAS'],
      ['DIBAHAS', 'DISETUJUI'],
      ['DISETUJUI', 'DITETAPKAN'],
    ];
    for (const [a, b] of alur) expect(bolehPindahAnggaran(a, b).boleh).toBe(true);
  });

  it('perubahan APBDes adalah satu-satunya jalan mengubah yang sudah ditetapkan', () => {
    expect(bolehPindahAnggaran('DITETAPKAN', 'PERUBAHAN').boleh).toBe(true);
    expect(bolehPindahAnggaran('DITETAPKAN', 'DRAF').boleh).toBe(false);
    expect(bolehPindahAnggaran('DITETAPKAN', 'DIBAHAS').boleh).toBe(false);
  });

  it('anggaran yang ditutup tidak dapat dibuka', () => {
    expect(bolehPindahAnggaran('DITUTUP', 'PERUBAHAN').boleh).toBe(false);
  });

  it('setiap status dapat dicapai dari DRAF', () => {
    const tercapai = new Set<StatusAnggaran>(['DRAF']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of TRANSISI_ANGGARAN[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    const semua = Object.keys(TRANSISI_ANGGARAN) as StatusAnggaran[];
    expect(semua.filter((s) => !tercapai.has(s))).toEqual([]);
  });
});

describe('penyuntingan pagu', () => {
  it('pagu dapat disunting selama masih draf atau dibahas', () => {
    expect(bolehUbahPagu('DRAF').boleh).toBe(true);
    expect(bolehUbahPagu('DIBAHAS').boleh).toBe(true);
    expect(bolehUbahPagu('PERUBAHAN').boleh).toBe(true);
  });

  it('pagu yang sudah ditetapkan tidak dapat disunting langsung', () => {
    /*
     * Membiarkannya disunting berarti anggaran yang disahkan bukan anggaran
     * yang dijalankan — dan yang disahkan itulah yang dipertanggungjawabkan.
     */
    const v = bolehUbahPagu('DITETAPKAN');
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('APBDes Perubahan');
    expect(v.alasan).toContain('BPD');
  });
});

describe('ikatan belanja', () => {
  it('mengizinkan ikatan dalam pagu', () => {
    const v = bolehMengikat(pagu(), 40_000_000);
    expect(v.boleh).toBe(true);
    expect(v.sisaPagu).toBe(60_000_000);
    expect(v.sisaIkatan).toBe(40_000_000);
  });

  it('mengizinkan ikatan tepat sebesar sisa pagu', () => {
    expect(bolehMengikat(pagu({ committed: 60_000_000 }), 40_000_000).boleh).toBe(true);
  });

  it('MENOLAK ikatan yang melampaui pagu', () => {
    /*
     * Bukan memperingatkan — menolak. Pada APBDes, belanja melampaui pagu
     * adalah pelanggaran.
     */
    const v = bolehMengikat(pagu({ committed: 80_000_000 }), 30_000_000);
    expect(v.boleh).toBe(false);
    expect(v.reason).toBe('MELAMPAUI_PAGU');
  });

  it('penolakan menyebutkan angkanya', () => {
    // Petugas yang tahu sisa paguya dapat menyesuaikan nilainya; yang hanya
    // diberi tahu "melampaui pagu" akan menebak.
    const v = bolehMengikat(pagu({ committed: 80_000_000 }), 30_000_000);
    expect(v.alasan).toContain('100.000.000');
    expect(v.alasan).toContain('80.000.000');
    expect(v.alasan).toContain('20.000.000');
  });

  it('menolak nilai nol dan negatif', () => {
    for (const n of [0, -1, Number.NaN]) {
      const v = bolehMengikat(pagu(), n);
      expect(v.boleh).toBe(false);
      expect(v.reason).toBe('NILAI_TIDAK_SAH');
    }
  });

  it('pagu yang sudah habis diikat menolak ikatan apa pun', () => {
    expect(bolehMengikat(pagu({ committed: 100_000_000 }), 1).boleh).toBe(false);
  });
});

describe('realisasi belanja', () => {
  it('mengizinkan realisasi dalam ikatan', () => {
    const v = bolehMerealisasi(pagu({ committed: 50_000_000 }), 30_000_000);
    expect(v.boleh).toBe(true);
    expect(v.sisaIkatan).toBe(20_000_000);
  });

  it('MENOLAK realisasi melampaui ikatan', () => {
    /*
     * Uang yang keluar tanpa ikatan adalah pengeluaran tanpa dasar — temuan
     * pemeriksaan, bukan sekadar kelalaian pencatatan.
     */
    const v = bolehMerealisasi(pagu({ committed: 50_000_000, realized: 40_000_000 }), 20_000_000);
    expect(v.boleh).toBe(false);
    expect(v.reason).toBe('MELAMPAUI_IKATAN');
    expect(v.alasan).toContain('Ikat belanjanya terlebih dahulu');
  });

  it('menolak realisasi tanpa ikatan sama sekali', () => {
    const v = bolehMerealisasi(pagu(), 1_000_000);
    expect(v.boleh).toBe(false);
    expect(v.reason).toBe('MELAMPAUI_IKATAN');
  });

  it('realisasi tepat sebesar sisa ikatan diterima', () => {
    expect(
      bolehMerealisasi(pagu({ committed: 50_000_000, realized: 30_000_000 }), 20_000_000).boleh,
    ).toBe(true);
  });
});

describe('ikat dahulu baru bayar', () => {
  it('pagu berkurang sejak DIIKAT, bukan sejak dibayar', () => {
    /*
     * Desa yang hanya melihat realisasi akan mengira paguya masih tersedia
     * padahal sudah habis diikat kontrak — lalu mengikat kontrak kedua yang
     * tidak ada uangnya.
     */
    const p = pagu({ committed: 100_000_000, realized: 0 });
    expect(sisaPagu(p)).toBe(0);
    expect(bolehMengikat(p, 1).boleh).toBe(false);
    // Tetapi masih ada 100jt yang belum dibayar.
    expect(sisaIkatan(p)).toBe(100_000_000);
  });
});

describe('penurunan pagu', () => {
  it('pagu tidak dapat diturunkan di bawah ikatan yang berjalan', () => {
    // Kontrak yang sudah ditandatangani tidak boleh kehilangan anggarannya.
    const v = bolehTurunkanPagu(pagu({ committed: 60_000_000 }), 50_000_000);
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('Batalkan ikatannya');
  });

  it('pagu dapat diturunkan sampai sebesar ikatan', () => {
    expect(bolehTurunkanPagu(pagu({ committed: 60_000_000 }), 60_000_000).boleh).toBe(true);
  });
});

describe('serapan', () => {
  it('menghitung persentase ikatan dan realisasi', () => {
    const s = serapan(pagu({ committed: 75_000_000, realized: 50_000_000 }));
    expect(s.committedPct).toBe(75);
    expect(s.realizedPct).toBe(50);
  });

  it('pagu nol tidak menghasilkan pembagian nol', () => {
    expect(serapan(pagu({ ceiling: 0 }))).toEqual({ committedPct: 0, realizedPct: 0 });
  });
});

describe('keseimbangan APBDes', () => {
  it('defisit yang ditutup pembiayaan dinyatakan seimbang', () => {
    const h = periksaKeseimbangan({
      pendapatan: 900_000_000,
      belanja: 1_000_000_000,
      pembiayaanPenerimaan: 100_000_000,
      pembiayaanPengeluaran: 0,
    });
    expect(h.seimbang).toBe(true);
    expect(h.surplusDefisit).toBe(-100_000_000);
    expect(h.keterangan).toContain('Defisit');
  });

  it('surplus yang disalurkan ke pengeluaran pembiayaan seimbang', () => {
    const h = periksaKeseimbangan({
      pendapatan: 1_000_000_000,
      belanja: 900_000_000,
      pembiayaanPenerimaan: 0,
      pembiayaanPengeluaran: 100_000_000,
    });
    expect(h.seimbang).toBe(true);
    expect(h.keterangan).toContain('Surplus');
  });

  it('menandai kekurangan yang belum tertutup', () => {
    const h = periksaKeseimbangan({
      pendapatan: 900_000_000,
      belanja: 1_000_000_000,
      pembiayaanPenerimaan: 0,
      pembiayaanPengeluaran: 0,
    });
    expect(h.seimbang).toBe(false);
    expect(h.keterangan).toContain('belum tertutup');
  });

  it('menandai kelebihan yang belum dialokasikan', () => {
    const h = periksaKeseimbangan({
      pendapatan: 1_000_000_000,
      belanja: 900_000_000,
      pembiayaanPenerimaan: 0,
      pembiayaanPengeluaran: 0,
    });
    expect(h.seimbang).toBe(false);
    expect(h.keterangan).toContain('belum dialokasikan');
  });

  it('pendapatan sama dengan belanja tanpa pembiayaan seimbang', () => {
    expect(
      periksaKeseimbangan({
        pendapatan: 1_000_000_000,
        belanja: 1_000_000_000,
        pembiayaanPenerimaan: 0,
        pembiayaanPengeluaran: 0,
      }).seimbang,
    ).toBe(true);
  });
});

describe('peristiwa akuntansi village', () => {
  it('dua belas kode terdaftar', () => {
    expect(VILLAGE_EVENTS).toHaveLength(12);
  });

  it('kode unik', () => {
    expect(new Set(VILLAGE_EVENTS).size).toBe(VILLAGE_EVENTS.length);
  });

  it('seluruhnya berawalan VILLAGE_', () => {
    // Supaya tidak tercampur dengan MARKETPLACE_* maupun POS_* milik Core.
    for (const e of VILLAGE_EVENTS) expect(e.startsWith('VILLAGE_')).toBe(true);
  });

  it('setiap kode punya daftar nilai wajib', () => {
    /*
     * Kode yang ditambahkan tanpa daftar akan menggagalkan pengujian ini,
     * bukan diam-diam menghasilkan jurnal kosong.
     */
    const tanpa = VILLAGE_EVENTS.filter((e) => !NILAI_WAJIB[e] || NILAI_WAJIB[e].length === 0);
    expect(tanpa).toEqual([]);
  });

  it('menolak kode yang tidak terdaftar', () => {
    expect(isVillageEvent('VILLAGE_SALAH_KETIK')).toBe(false);
    expect(isVillageEvent('')).toBe(false);
  });

  it('panjar yang dipertanggungjawabkan membawa dua angka', () => {
    // Menyimpan hanya salah satunya membuat sisa panjar harus dihitung ulang,
    // dan perhitungan ulang selalu ada yang lupa.
    expect(NILAI_WAJIB.VILLAGE_ADVANCE_SETTLED.sort()).toEqual(['returnedAmount', 'usedAmount']);
  });

  it('penyaluran bantuan membawa jumlah penerimanya', () => {
    expect(NILAI_WAJIB.VILLAGE_AID_DISBURSED).toContain('beneficiaryCount');
  });

  it('peristiwa yang kurang nilainya ditolak saat dibuat', () => {
    const v = periksaNilaiWajib('VILLAGE_ADVANCE_SETTLED', { usedAmount: 500_000 });
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual(['returnedAmount']);
  });

  it('peristiwa lengkap diterima', () => {
    expect(periksaNilaiWajib('VILLAGE_REVENUE_RECEIVED', { amount: 1_000_000 }).ok).toBe(true);
  });
});

describe('periode perencanaan', () => {
  it('tahun di dalam periode RPJM diterima', () => {
    expect(tahunDalamPeriode(2027, { startYear: 2025, endYear: 2030 }).boleh).toBe(true);
  });

  it('tahun di luar periode ditolak beserta rentangnya', () => {
    /*
     * Rencana tahunan tanpa rencana jangka menengah adalah rencana yang tidak
     * dapat dipertanggungjawabkan arahnya.
     */
    const v = tahunDalamPeriode(2032, { startYear: 2025, endYear: 2030 });
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('2025');
    expect(v.alasan).toContain('2030');
  });

  it('batas periode termasuk di dalamnya', () => {
    expect(tahunDalamPeriode(2025, { startYear: 2025, endYear: 2030 }).boleh).toBe(true);
    expect(tahunDalamPeriode(2030, { startYear: 2025, endYear: 2030 }).boleh).toBe(true);
  });
});

describe('usulan masuk RKP', () => {
  it('hanya usulan yang disepakati boleh masuk', () => {
    expect(bolehMasukRkp('DISEPAKATI').boleh).toBe(true);
  });

  it('usulan yang masih dibahas ditolak', () => {
    // Memasukkannya berarti mendahului musyawarahnya.
    const v = bolehMasukRkp('DIBAHAS');
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('disepakati musyawarah');
  });

  it('usulan yang ditolak tidak dapat masuk lewat pintu belakang', () => {
    expect(bolehMasukRkp('DITOLAK').boleh).toBe(false);
    expect(bolehMasukRkp('DITUNDA').boleh).toBe(false);
  });

  it('usulan yang sudah masuk tidak dapat masuk dua kali', () => {
    const v = bolehMasukRkp('MASUK_RKP');
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('sudah masuk');
  });
});
