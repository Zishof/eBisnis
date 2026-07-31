/**
 * Pengujian aturan profil koperasi.
 *
 * Dua hal dijaga paling ketat:
 *
 * 1. **Koperasi tidak dapat go-live tanpa badan hukum dan kebijakan.** Koperasi
 *    yang menghimpun simpanan tanpa badan hukum adalah persoalan hukum bagi
 *    pengurusnya, bukan sekadar data yang belum lengkap.
 * 2. **Koperasi syariah tidak memakai bunga.** Bukan memakai istilah lain untuk
 *    hal yang sama.
 */

import {
  COOPERATIVE_STATUSES,
  COOPERATIVE_TRANSITIONS,
  DOKUMEN_WAJIB,
  KEBIJAKAN_WAJIB,
  SLUG_TERLARANG,
  berlakuPada,
  bolehMemakaiBunga,
  bolehMenjalankanPinjaman,
  bolehPindahStatus,
  periksaKesiapan,
  siapGoLive,
  slugSah,
  susunSlug,
  versiBerlaku,
  type CooperativeStatus,
  type KesiapanInput,
} from './cooperative-profile';

const lengkap = (over: Partial<KesiapanInput> = {}): KesiapanInput => ({
  legalEntityNumber: '518/BH/XIV.7/2026',
  legalEntityDate: '2026-01-15',
  cooperativeTypeId: 'type-1',
  hasPrimaryAddress: true,
  hasServiceArea: true,
  activePolicyCodes: [...KEBIJAKAN_WAJIB],
  documentTypes: [...DOKUMEN_WAJIB],
  ...over,
});

describe('perpindahan status koperasi', () => {
  it('setiap status punya entri transisi', () => {
    for (const s of COOPERATIVE_STATUSES) {
      expect(COOPERATIVE_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('tidak menunjuk status yang tidak ada', () => {
    const dikenal = new Set<string>(COOPERATIVE_STATUSES);
    for (const tujuan of Object.values(COOPERATIVE_TRANSITIONS)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });

  it('mengikuti alur pendaftaran yang biasa', () => {
    expect(bolehPindahStatus('DRAFT', 'PENDING_VERIFICATION').allowed).toBe(true);
    expect(bolehPindahStatus('PENDING_VERIFICATION', 'ACTIVE').allowed).toBe(true);
  });

  it('menolak lompatan dari draf langsung ke aktif', () => {
    // Melompati verifikasi berarti koperasi beroperasi tanpa ada yang memeriksa
    // badan hukumnya.
    const v = bolehPindahStatus('DRAFT', 'ACTIVE');
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('DRAFT');
  });

  it('verifikasi yang ditolak dapat kembali ke draf', () => {
    expect(bolehPindahStatus('PENDING_VERIFICATION', 'DRAFT').allowed).toBe(true);
  });

  it('koperasi yang dibekukan dapat diaktifkan kembali', () => {
    expect(bolehPindahStatus('SUSPENDED', 'ACTIVE').allowed).toBe(true);
  });

  it('pembubaran bersifat akhir', () => {
    /*
     * Pembubaran adalah keputusan RAT yang dicatat pada lembaga pengawas.
     * Menghidupkannya kembali berarti mendirikan koperasi baru dengan badan
     * hukum baru — bukan mengubah status baris yang sama.
     */
    expect(COOPERATIVE_TRANSITIONS.DISSOLVED).toEqual([]);
    for (const s of COOPERATIVE_STATUSES) {
      if (s === 'DISSOLVED') continue;
      const v = bolehPindahStatus('DISSOLVED', s);
      expect(v.allowed).toBe(false);
      expect(v.message).toContain('final');
    }
  });

  it('setiap status dapat dibubarkan', () => {
    for (const s of COOPERATIVE_STATUSES) {
      if (s === 'DISSOLVED') continue;
      expect(bolehPindahStatus(s as CooperativeStatus, 'DISSOLVED').allowed).toBe(true);
    }
  });

  it('menolak perpindahan ke status yang sama', () => {
    expect(bolehPindahStatus('ACTIVE', 'ACTIVE').allowed).toBe(false);
  });
});

describe('kesiapan go-live', () => {
  it('meloloskan koperasi yang lengkap', () => {
    expect(periksaKesiapan(lengkap())).toEqual([]);
    expect(siapGoLive(lengkap())).toBe(true);
  });

  it('menolak tanpa nomor badan hukum', () => {
    const kurang = periksaKesiapan(lengkap({ legalEntityNumber: null }));
    expect(kurang.map((k) => k.code)).toContain('LEGAL_NUMBER_MISSING');
    // Pesannya menyebutkan akibatnya, bukan hanya menyatakan medan kosong.
    expect(kurang.find((k) => k.code === 'LEGAL_NUMBER_MISSING')?.message).toContain('simpanan');
  });

  it('menolak tanpa jenis koperasi', () => {
    expect(periksaKesiapan(lengkap({ cooperativeTypeId: null })).map((k) => k.code)).toContain(
      'TYPE_MISSING',
    );
  });

  it('menolak tanpa wilayah kerja', () => {
    expect(periksaKesiapan(lengkap({ hasServiceArea: false })).map((k) => k.code)).toContain(
      'SERVICE_AREA_MISSING',
    );
  });

  it('menolak tanpa akta pendirian dan SK badan hukum', () => {
    const kurang = periksaKesiapan(lengkap({ documentTypes: [] })).map((k) => k.code);
    expect(kurang).toContain('DOCUMENT_ESTABLISHMENT_DEED');
    expect(kurang).toContain('DOCUMENT_LEGAL_ENTITY_DECISION');
  });

  it('menolak tanpa AD/ART, aturan keanggotaan, dan kebijakan akuntansi', () => {
    const kurang = periksaKesiapan(lengkap({ activePolicyCodes: [] })).map((k) => k.code);
    for (const kode of KEBIJAKAN_WAJIB) {
      expect(kurang).toContain(`POLICY_${kode}`);
    }
  });

  it('melaporkan SELURUH kekurangan sekaligus, bukan yang pertama saja', () => {
    /*
     * Pemilik koperasi yang diberi tahu satu kekurangan lalu satu lagi setelah
     * memperbaikinya akan melalui lima putaran untuk hal yang dapat disebutkan
     * dalam satu layar.
     */
    const kosong: KesiapanInput = {
      legalEntityNumber: null,
      legalEntityDate: null,
      cooperativeTypeId: null,
      hasPrimaryAddress: false,
      hasServiceArea: false,
      activePolicyCodes: [],
      documentTypes: [],
    };
    const kurang = periksaKesiapan(kosong);
    expect(kurang.length).toBe(5 + DOKUMEN_WAJIB.length + KEBIJAKAN_WAJIB.length);
    expect(siapGoLive(kosong)).toBe(false);
  });

  it('setiap kekurangan punya kode dan pesan yang berarti', () => {
    const kurang = periksaKesiapan({
      legalEntityNumber: null,
      legalEntityDate: null,
      cooperativeTypeId: null,
      hasPrimaryAddress: false,
      hasServiceArea: false,
      activePolicyCodes: [],
      documentTypes: [],
    });
    for (const k of kurang) {
      expect(k.code).toMatch(/^[A-Z_]+$/);
      expect(k.message.length).toBeGreaterThan(20);
    }
  });

  it('kode kekurangan tidak kembar', () => {
    const kurang = periksaKesiapan({
      legalEntityNumber: null,
      legalEntityDate: null,
      cooperativeTypeId: null,
      hasPrimaryAddress: false,
      hasServiceArea: false,
      activePolicyCodes: [],
      documentTypes: [],
    });
    const kode = kurang.map((k) => k.code);
    expect(new Set(kode).size).toBe(kode.length);
  });
});

describe('slug', () => {
  it('menyusun slug dari nama koperasi', () => {
    expect(susunSlug('Koperasi Al-Bahjah')).toBe('koperasi-al-bahjah');
    expect(susunSlug('KSP Sejahtera Bersama')).toBe('ksp-sejahtera-bersama');
  });

  it('membuang aksara yang tidak sah sebagai label DNS', () => {
    expect(susunSlug('Koperasi "Maju" Jaya!')).toBe('koperasi-maju-jaya');
    expect(susunSlug('Koperasi   Serba    Usaha')).toBe('koperasi-serba-usaha');
  });

  it('tidak menghasilkan slug yang diawali atau diakhiri tanda hubung', () => {
    expect(susunSlug('---Koperasi---')).toBe('koperasi');
    expect(susunSlug('!!!Koperasi!!!')).toBe('koperasi');
  });

  it('memotong pada 63 aksara tanpa menyisakan tanda hubung di ujung', () => {
    const panjang = susunSlug('Koperasi ' + 'Sangat '.repeat(20) + 'Panjang');
    expect(panjang.length).toBeLessThanOrEqual(63);
    expect(panjang.endsWith('-')).toBe(false);
  });

  it('slug yang dihasilkan selalu sah', () => {
    const nama = [
      'Koperasi Al-Bahjah',
      'KSP "Sejahtera"',
      'Koperasi   Serba    Usaha 2026',
      'Kop. Karyawan PT Maju Jaya',
    ];
    for (const n of nama) {
      const s = susunSlug(n);
      expect(slugSah(s).allowed).toBe(true);
    }
  });

  it('menolak slug yang terlalu pendek', () => {
    expect(slugSah('ab').allowed).toBe(false);
  });

  it('menolak slug berhuruf besar dan berspasi', () => {
    expect(slugSah('Koperasi').allowed).toBe(false);
    expect(slugSah('koperasi maju').allowed).toBe(false);
  });

  it('menolak slug yang diawali atau diakhiri tanda hubung', () => {
    expect(slugSah('-koperasi').allowed).toBe(false);
    expect(slugSah('koperasi-').allowed).toBe(false);
  });

  it('menolak slug yang dipakai platform', () => {
    // Koperasi bernama slug "admin" akan tampak seperti halaman pengelola.
    for (const s of ['www', 'api', 'admin', 'login']) {
      const v = slugSah(s);
      expect(v.allowed).toBe(false);
      expect(v.message).toContain('platform');
    }
  });

  it('daftar slug terlarang tidak kembar', () => {
    expect(new Set(SLUG_TERLARANG).size).toBe(SLUG_TERLARANG.length);
  });
});

describe('masa berlaku', () => {
  it('berlaku pada rentangnya', () => {
    const p = { effectiveFrom: '2026-01-01', effectiveUntil: '2026-12-31' };
    expect(berlakuPada(p, '2026-06-15')).toBe(true);
    expect(berlakuPada(p, '2026-01-01')).toBe(true);
    expect(berlakuPada(p, '2026-12-31')).toBe(true);
  });

  it('tidak berlaku di luar rentangnya', () => {
    const p = { effectiveFrom: '2026-01-01', effectiveUntil: '2026-12-31' };
    expect(berlakuPada(p, '2025-12-31')).toBe(false);
    expect(berlakuPada(p, '2027-01-01')).toBe(false);
  });

  it('tanpa tanggal akhir berlaku selamanya', () => {
    const p = { effectiveFrom: '2026-01-01', effectiveUntil: null };
    expect(berlakuPada(p, '2099-01-01')).toBe(true);
  });

  it('memilih versi yang berlaku pada tanggal tertentu', () => {
    /*
     * Inilah yang membuat perhitungan SHU tahun lalu dapat diulang: kebijakan
     * yang berlaku saat itu masih dapat ditemukan, meskipun sekarang sudah ada
     * versi yang lebih baru.
     */
    const versi = [
      { effectiveFrom: '2024-01-01', effectiveUntil: '2025-12-31', v: 1 },
      { effectiveFrom: '2026-01-01', effectiveUntil: null, v: 2 },
    ];
    expect(versiBerlaku(versi, '2025-06-01').terpilih?.v).toBe(1);
    expect(versiBerlaku(versi, '2026-06-01').terpilih?.v).toBe(2);
  });

  it('mengembalikan kosong bila tidak ada yang berlaku', () => {
    const versi = [{ effectiveFrom: '2026-01-01', effectiveUntil: null, v: 1 }];
    expect(versiBerlaku(versi, '2025-01-01').terpilih).toBeNull();
  });

  it('melaporkan bila dua versi sama-sama berlaku', () => {
    // Seharusnya dicegah indeks unik, tetapi dapat terjadi pada data lama.
    // Memilih diam-diam lebih baik daripada melempar galat pada jalur baca —
    // asalkan keadaannya dilaporkan supaya dapat dibereskan.
    const versi = [
      { effectiveFrom: '2026-01-01', effectiveUntil: null, v: 1 },
      { effectiveFrom: '2026-03-01', effectiveUntil: null, v: 2 },
    ];
    const hasil = versiBerlaku(versi, '2026-06-01');
    expect(hasil.ganda).toBe(true);
    expect(hasil.terpilih?.v).toBe(2);
  });
});

describe('kesesuaian jenis koperasi', () => {
  const konsumen = { allowsLending: false, allowsRetail: true, isSharia: false };
  const simpanPinjam = { allowsLending: true, allowsRetail: false, isSharia: false };
  const syariah = { allowsLending: true, allowsRetail: false, isSharia: true };

  it('koperasi simpan pinjam boleh menjalankan produk pinjaman', () => {
    expect(bolehMenjalankanPinjaman(simpanPinjam).allowed).toBe(true);
  });

  it('koperasi konsumen tidak boleh menjalankan produk pinjaman', () => {
    /*
     * Bukan pembatasan teknis melainkan pembatasan hukum: koperasi konsumen
     * yang meminjamkan uang kepada anggotanya melampaui izin usahanya.
     */
    const v = bolehMenjalankanPinjaman(konsumen);
    expect(v.allowed).toBe(false);
    expect(v.message).toContain('izin usaha');
  });

  it('koperasi syariah tidak memakai bunga', () => {
    const v = bolehMemakaiBunga(syariah);
    expect(v.allowed).toBe(false);
    // Pesannya menawarkan penggantinya, bukan sekadar menolak.
    expect(v.message).toContain('murabahah');
  });

  it('koperasi konvensional boleh memakai bunga', () => {
    expect(bolehMemakaiBunga(simpanPinjam).allowed).toBe(true);
  });

  it('syariah dan kewenangan meminjamkan diperiksa terpisah', () => {
    // Koperasi syariah simpan pinjam boleh menyalurkan pembiayaan, tetapi tidak
    // boleh memakai bunga. Dua pemeriksaan berbeda atas satu koperasi.
    expect(bolehMenjalankanPinjaman(syariah).allowed).toBe(true);
    expect(bolehMemakaiBunga(syariah).allowed).toBe(false);
  });
});
