/**
 * Pengujian pengaduan, aspirasi, dan Musrenbang.
 *
 * Yang dijaga paling ketat adalah **anonimitas**: pengaduan yang paling perlu
 * didengar adalah pengaduan tentang perangkat desa itu sendiri, dan warga tidak
 * akan menyampaikannya bila namanya terlihat oleh orang yang ia adukan.
 */

import {
  AMBANG_BAWAAN,
  STATUS_PENGADUAN,
  TRANSISI_PENGADUAN,
  TRANSISI_USULAN,
  bagiMenurutPagu,
  bolehJadiPenandaAntiSpam,
  bolehLihatPelapor,
  bolehMenangani,
  bolehPindahPengaduan,
  bolehPindahUsulan,
  kuorumTerpenuhi,
  saringIdentitas,
  statusAkhirPengaduan,
  tingkatPerhatian,
  urutkanUsulan,
  type StatusPengaduan,
  type StatusUsulan,
  type Usulan,
} from './village-complaint';

const usulan = (over: Partial<Usulan> = {}): Usulan => ({
  id: 'U1',
  title: 'Perbaikan jalan',
  estimatedCost: 10_000_000,
  beneficiaryCount: 50,
  priorityScore: 3,
  status: 'DIUSULKAN',
  ...over,
});

describe('kelengkapan transisi pengaduan', () => {
  it('setiap status punya entri', () => {
    for (const s of STATUS_PENGADUAN) expect(TRANSISI_PENGADUAN[s]).toBeDefined();
  });

  it('tidak menunjuk status yang tidak ada', () => {
    const dikenal = new Set<string>(STATUS_PENGADUAN);
    for (const t of Object.values(TRANSISI_PENGADUAN)) {
      for (const x of t) expect(dikenal.has(x)).toBe(true);
    }
  });

  it('setiap status dapat dicapai dari BARU', () => {
    const tercapai = new Set<StatusPengaduan>(['BARU']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of TRANSISI_PENGADUAN[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect(STATUS_PENGADUAN.filter((s) => !tercapai.has(s))).toEqual([]);
  });

  it('dua status bersifat akhir', () => {
    expect(STATUS_PENGADUAN.filter(statusAkhirPengaduan).sort()).toEqual(
      ['BUKAN_KEWENANGAN', 'DITUTUP'].sort(),
    );
  });
});

describe('perpindahan status pengaduan', () => {
  it('mengizinkan alur penanganan yang biasa', () => {
    const alur: Array<[StatusPengaduan, StatusPengaduan]> = [
      ['BARU', 'DITERIMA'],
      ['DITERIMA', 'DITUGASKAN'],
      ['DITUGASKAN', 'DITINDAKLANJUTI'],
      ['DITINDAKLANJUTI', 'SELESAI'],
    ];
    for (const [a, b] of alur) expect(bolehPindahPengaduan(a, b).boleh).toBe(true);
  });

  it('pengaduan yang sudah selesai dapat dibuka kembali', () => {
    /*
     * Warga yang menilai penyelesaiannya belum memadai berhak membuka kembali.
     * Pengaduan yang sekali ditutup tidak dapat dibuka lagi akan mendorong
     * petugas menutupnya cepat-cepat demi angka penyelesaian.
     */
    const v = bolehPindahPengaduan('SELESAI', 'DITINDAKLANJUTI');
    expect(v.boleh).toBe(true);
    expect(v.wajibBeralasan).toBe(true);
  });

  it('pengaduan yang ditutup tidak dapat dibuka lagi', () => {
    expect(bolehPindahPengaduan('DITUTUP', 'DITERIMA').boleh).toBe(false);
  });

  it('setiap penghentian tanpa penyelesaian wajib beralasan', () => {
    // Warga berhak tahu mengapa aduannya berhenti.
    for (const dari of STATUS_PENGADUAN) {
      for (const ke of TRANSISI_PENGADUAN[dari]) {
        if (ke === 'DITUTUP' || ke === 'BUKAN_KEWENANGAN') {
          expect(bolehPindahPengaduan(dari, ke).wajibBeralasan).toBe(true);
        }
      }
    }
  });

  it('penugasan tidak wajib beralasan', () => {
    expect(bolehPindahPengaduan('DITERIMA', 'DITUGASKAN').wajibBeralasan).toBeFalsy();
  });
});

describe('anonimitas pelapor', () => {
  const identitas = {
    residentId: 'R1',
    userId: 'U1',
    name: 'Ahmad Fauzi',
    phone: '081234567890',
  };

  it('mode terbuka menyimpan identitas apa adanya', () => {
    expect(saringIdentitas('TERBUKA', identitas)).toEqual(identitas);
  });

  it('mode anonim TIDAK MENYIMPAN APA PUN', () => {
    /*
     * Bukan menyimpan lalu menyembunyikan. Yang disembunyikan dapat dibuka oleh
     * siapa pun yang punya akses basis data, dan administrator desa punya akses
     * itu — sementara ia bisa jadi orang yang diadukan.
     */
    const h = saringIdentitas('ANONIM', identitas);
    expect(h).toEqual({ residentId: null, userId: null, name: null, phone: null });
  });

  it('mengosongkan seluruh medan, termasuk yang tidak diminta pemanggil', () => {
    // Membiarkan pemanggil menentukan medan mana yang dikosongkan berarti satu
    // jalan yang lupa akan menyimpan nama pelapor selamanya.
    const h = saringIdentitas('ANONIM', { name: 'Budi' });
    expect(Object.values(h).every((v) => v === null)).toBe(true);
  });

  it('identitas pelapor anonim tidak dapat dilihat siapa pun', () => {
    expect(bolehLihatPelapor('ANONIM')).toBe(false);
    expect(bolehLihatPelapor('TERBUKA')).toBe(true);
  });
});

describe('penanda anti-spam', () => {
  it('menolak NIK sebagai penanda', () => {
    /*
     * Godaan yang wajar: simpan sha256(nik), "toh tidak dapat dibalik". Tetapi
     * ruang NIK hanya enam belas digit dan desa memiliki daftar NIK seluruh
     * warganya — mencocokkan hash terhadap seribu NIK memakan kurang dari
     * sedetik.
     */
    const h = bolehJadiPenandaAntiSpam('NIK');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('enam belas digit');
    expect(h.alasan).toContain('hitungan detik');
  });

  it('menolak nomor KK, telepon, nama, dan surel', () => {
    for (const j of ['KK', 'PHONE', 'NAME', 'EMAIL']) {
      expect(bolehJadiPenandaAntiSpam(j).boleh).toBe(false);
    }
  });

  it('tidak peduli huruf besar-kecil', () => {
    expect(bolehJadiPenandaAntiSpam('nik').boleh).toBe(false);
  });

  it('mengizinkan penanda yang bukan data warga', () => {
    expect(bolehJadiPenandaAntiSpam('SESSION_TOKEN').boleh).toBe(true);
  });
});

describe('pengaduan tentang aparatur', () => {
  it('tidak dapat ditugaskan kepada yang diadukan', () => {
    /*
     * Bukan kehati-hatian berlebihan: pengaduan desa paling sering menyangkut
     * perangkat desa, dan menugaskan aduan kepada terlapor sama dengan
     * menutupnya.
     */
    const v = bolehMenangani('OFF-1', 'OFF-1');
    expect(v.boleh).toBe(false);
    expect(v.alasan).toContain('atasan');
  });

  it('dapat ditugaskan kepada petugas lain', () => {
    expect(bolehMenangani('OFF-1', 'OFF-2').boleh).toBe(true);
  });

  it('pengaduan yang tidak menyangkut aparatur bebas ditugaskan', () => {
    expect(bolehMenangani(null, 'OFF-1').boleh).toBe(true);
  });
});

describe('eskalasi', () => {
  it('pengaduan yang baru disentuh berstatus normal', () => {
    expect(tingkatPerhatian(1, 'DITINDAKLANJUTI').tingkat).toBe('NORMAL');
  });

  it('menandai terlantar setelah ambang pertama', () => {
    const h = tingkatPerhatian(AMBANG_BAWAAN.hariTerlantar, 'DITERIMA');
    expect(h.tingkat).toBe('TERLANTAR');
    expect(h.keterangan).toContain('3 hari kerja');
  });

  it('menandai perlu eskalasi setelah ambang kedua', () => {
    const h = tingkatPerhatian(AMBANG_BAWAAN.hariEskalasi, 'DITUGASKAN');
    expect(h.tingkat).toBe('PERLU_ESKALASI');
    expect(h.keterangan).toContain('atasan');
  });

  it('pengaduan yang sudah selesai tidak dieskalasi', () => {
    expect(tingkatPerhatian(30, 'SELESAI').tingkat).toBe('NORMAL');
    expect(tingkatPerhatian(30, 'DITUTUP').tingkat).toBe('NORMAL');
  });

  it('ambang dapat disesuaikan desa', () => {
    const h = tingkatPerhatian(2, 'DITERIMA', { hariTerlantar: 1, hariEskalasi: 2 });
    expect(h.tingkat).toBe('PERLU_ESKALASI');
  });
});

describe('usulan Musrenbang', () => {
  it('usulan yang ditunda kembali dibahas, bukan mati', () => {
    /*
     * Menolaknya secara permanen membuat warga berhenti mengusulkan, dan
     * Musrenbang tahun berikutnya sepi.
     */
    expect(bolehPindahUsulan('DITUNDA', 'DIBAHAS').boleh).toBe(true);
  });

  it('penolakan dan penundaan wajib beralasan', () => {
    expect(bolehPindahUsulan('DIBAHAS', 'DITOLAK').wajibBeralasan).toBe(true);
    expect(bolehPindahUsulan('DIBAHAS', 'DITUNDA').wajibBeralasan).toBe(true);
  });

  it('usulan yang masuk RKP bersifat final', () => {
    expect(TRANSISI_USULAN.MASUK_RKP).toEqual([]);
    expect(bolehPindahUsulan('MASUK_RKP', 'DIBAHAS').boleh).toBe(false);
  });

  it('usulan tidak dapat melompat dari diusulkan ke RKP', () => {
    // Melompati pembahasan berarti melompati musyawarahnya.
    expect(bolehPindahUsulan('DIUSULKAN', 'MASUK_RKP').boleh).toBe(false);
  });

  it('setiap status usulan dapat dicapai dari DIUSULKAN', () => {
    const tercapai = new Set<StatusUsulan>(['DIUSULKAN']);
    let berubah = true;
    while (berubah) {
      berubah = false;
      for (const s of [...tercapai]) {
        for (const t of TRANSISI_USULAN[s]) {
          if (!tercapai.has(t)) {
            tercapai.add(t);
            berubah = true;
          }
        }
      }
    }
    expect((Object.keys(TRANSISI_USULAN) as StatusUsulan[]).filter((s) => !tercapai.has(s))).toEqual([]);
  });
});

describe('pengurutan usulan', () => {
  it('skor musyawarah didahulukan atas jumlah penerima manfaat', () => {
    const h = urutkanUsulan([
      usulan({ id: 'A', priorityScore: 2, beneficiaryCount: 500 }),
      usulan({ id: 'B', priorityScore: 5, beneficiaryCount: 10 }),
    ]);
    expect(h[0].id).toBe('B');
  });

  it('jumlah penerima manfaat mendahului biaya', () => {
    const h = urutkanUsulan([
      usulan({ id: 'A', priorityScore: 3, beneficiaryCount: 10, estimatedCost: 1_000_000 }),
      usulan({ id: 'B', priorityScore: 3, beneficiaryCount: 200, estimatedCost: 50_000_000 }),
    ]);
    expect(h[0].id).toBe('B');
  });

  it('biaya hanya menjadi penentu terakhir', () => {
    /*
     * Mengurutkan menurut biaya lebih dahulu — yang termurah menang — akan
     * membuat jalan setapak selalu mengalahkan jembatan, dan desa tidak pernah
     * membangun apa pun yang besar.
     */
    const h = urutkanUsulan([
      usulan({ id: 'A', priorityScore: 3, beneficiaryCount: 50, estimatedCost: 20_000_000 }),
      usulan({ id: 'B', priorityScore: 3, beneficiaryCount: 50, estimatedCost: 5_000_000 }),
    ]);
    expect(h[0].id).toBe('B');
  });
});

describe('pembagian menurut pagu', () => {
  it('memasukkan usulan sampai pagu habis', () => {
    const h = bagiMenurutPagu(
      [
        usulan({ id: 'A', priorityScore: 5, estimatedCost: 60_000_000 }),
        usulan({ id: 'B', priorityScore: 4, estimatedCost: 30_000_000 }),
        usulan({ id: 'C', priorityScore: 3, estimatedCost: 40_000_000 }),
      ],
      100_000_000,
    );
    expect(h.masuk.map((u) => u.id)).toEqual(['A', 'B']);
    expect(h.terpakai).toBe(90_000_000);
    expect(h.sisa).toBe(10_000_000);
  });

  it('usulan yang tidak tertampung DITUNDA, bukan ditolak', () => {
    /*
     * Menolaknya menghapus jejak bahwa warga pernah mengusulkannya, dan tahun
     * depan pengusulnya harus mulai dari nol.
     */
    const h = bagiMenurutPagu([usulan({ id: 'A', estimatedCost: 200_000_000 })], 100_000_000);
    expect(h.masuk).toEqual([]);
    expect(h.luar.map((u) => u.id)).toEqual(['A']);
  });

  it('usulan yang lebih murah tetap masuk meski yang mahal tidak muat', () => {
    // Satu usulan besar yang tidak muat tidak boleh menghentikan sisanya.
    const h = bagiMenurutPagu(
      [
        usulan({ id: 'BESAR', priorityScore: 5, estimatedCost: 200_000_000 }),
        usulan({ id: 'KECIL', priorityScore: 4, estimatedCost: 10_000_000 }),
      ],
      100_000_000,
    );
    expect(h.masuk.map((u) => u.id)).toEqual(['KECIL']);
    expect(h.luar.map((u) => u.id)).toEqual(['BESAR']);
  });

  it('pagu nol menyisakan seluruh usulan di luar', () => {
    const h = bagiMenurutPagu([usulan()], 0);
    expect(h.masuk).toEqual([]);
    expect(h.sisa).toBe(0);
  });
});

describe('kuorum Musrenbang', () => {
  it('memenuhi kuorum', () => {
    expect(kuorumTerpenuhi(40, 30).sah).toBe(true);
  });

  it('tidak memenuhi kuorum, dan menerangkan akibatnya', () => {
    // Musyawarah yang dihadiri lima orang bukan musyawarah desa.
    const h = kuorumTerpenuhi(5, 30);
    expect(h.sah).toBe(false);
    expect(h.keterangan).toContain('belum dapat ditetapkan');
  });

  it('tepat pada ambang sudah sah', () => {
    expect(kuorumTerpenuhi(30, 30).sah).toBe(true);
  });
});
