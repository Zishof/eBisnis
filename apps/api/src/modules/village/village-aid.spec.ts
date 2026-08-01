/**
 * Pengujian bantuan sosial.
 *
 * Tiga hal dijaga paling ketat:
 *
 * 1. **Kriteria tidak pernah dieksekusi.** Ruas di luar daftar tertutup ditolak
 *    sebelum tersimpan, termasuk nama yang menunjuk properti bawaan JavaScript.
 * 2. **Kecerdasan buatan tidak menetapkan penerima.** Ia mengusulkan; manusia
 *    memutuskan, dan namanya tercatat.
 * 3. **Bantuan sejenis tidak berganda** pada periode yang beririsan.
 */

import {
  KEDALAMAN_MAKSIMAL,
  PEMBANDING_ANGKA,
  RUAS_KRITERIA,
  SIMPUL_MAKSIMAL,
  adalahRuasKriteria,
  bolehSalurkan,
  bolehTetapkanPenerima,
  deteksiTumpangTindih,
  evaluasi,
  periksaBentuk,
  ringkasJejak,
  type Fakta,
  type Kondisi,
  type PenerimaanLain,
  type PenetapanPenerima,
  type Penyaluran,
} from './village-aid';

// Kriteria yang menyerupai penyaringan bantuan langsung tunai yang sebenarnya.
const kriteriaBlt: Kondisi = {
  jenis: 'SEMUA',
  anak: [
    { jenis: 'BANDING', ruas: 'penghasilanBulanan', pembanding: 'MAKSIMAL', nilai: 1_500_000 },
    { jenis: 'BANDING', ruas: 'memilikiKendaraanBermotor', pembanding: 'SAMA', nilai: false },
    {
      jenis: 'SALAH_SATU',
      anak: [
        { jenis: 'BANDING', ruas: 'lansia', pembanding: 'SAMA', nilai: true },
        { jenis: 'BANDING', ruas: 'disabilitas', pembanding: 'SAMA', nilai: true },
        { jenis: 'BANDING', ruas: 'kepalaKeluargaPerempuan', pembanding: 'SAMA', nilai: true },
      ],
    },
  ],
};

const fakta = (over: Fakta = {}): Fakta => ({
  penghasilanBulanan: 900_000,
  memilikiKendaraanBermotor: false,
  lansia: true,
  disabilitas: false,
  kepalaKeluargaPerempuan: false,
  ...over,
});

const penetapan = (over: Partial<PenetapanPenerima> = {}): PenetapanPenerima => ({
  status: 'DIVERIFIKASI',
  sumber: 'ATURAN',
  diusulkanOleh: 'operator-1',
  penetap: { userId: 'kasi-kesra', jenis: 'MANUSIA' },
  dasarPenetapan: 'Hasil kunjungan rumah tanggal 4 Maret 2027; keadaan sesuai usulan.',
  ...over,
});

describe('daftar ruas kriteria adalah daftar tertutup', () => {
  it('menolak ruas di luar daftar', () => {
    expect(adalahRuasKriteria('penghasilanBulanan')).toBe(true);
    expect(adalahRuasKriteria('gajiRahasia')).toBe(false);
  });

  it('menolak nama yang menunjuk properti bawaan JavaScript', () => {
    // Inilah sebabnya pencocokan memakai hasOwnProperty, bukan `in` maupun
    // pembacaan langsung: `constructor` ada pada setiap objek.
    for (const nama of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(adalahRuasKriteria(nama)).toBe(false);
    }
  });

  it('setiap ruas menyebut tipenya', () => {
    for (const [ruas, tipe] of Object.entries(RUAS_KRITERIA)) {
      expect(['ANGKA', 'PILIHAN', 'BENAR_SALAH']).toContain(tipe);
      expect(ruas).toMatch(/^[a-zA-Z][a-zA-Z0-9]*$/);
    }
  });
});

describe('pemeriksaan bentuk kriteria', () => {
  it('menerima kriteria yang sah', () => {
    const h = periksaBentuk(kriteriaBlt);
    expect(h.sah).toBe(true);
    expect(h.kesalahan).toEqual([]);
  });

  it('menolak ruas yang tidak dikenal, menyebut namanya', () => {
    const h = periksaBentuk({ jenis: 'BANDING', ruas: 'saldoRekening', pembanding: 'SAMA', nilai: 1 });
    expect(h.sah).toBe(false);
    expect(h.kesalahan[0]).toContain('saldoRekening');
  });

  it('menolak pembanding yang tidak berlaku bagi tipe ruasnya', () => {
    const h = periksaBentuk({ jenis: 'BANDING', ruas: 'lansia', pembanding: 'LEBIH', nilai: true });
    expect(h.sah).toBe(false);
    expect(h.kesalahan[0]).toContain('BENAR_SALAH');
  });

  it('menolak nilai yang tipenya tidak cocok', () => {
    expect(
      periksaBentuk({ jenis: 'BANDING', ruas: 'usia', pembanding: 'MINIMAL', nilai: 'enam puluh' }).sah,
    ).toBe(false);
    expect(
      periksaBentuk({ jenis: 'BANDING', ruas: 'lansia', pembanding: 'SAMA', nilai: 'ya' }).sah,
    ).toBe(false);
  });

  it('menuntut daftar tidak kosong pada pembanding TERMASUK', () => {
    expect(periksaBentuk({ jenis: 'BANDING', ruas: 'rt', pembanding: 'TERMASUK', nilai: [] }).sah).toBe(false);
    expect(
      periksaBentuk({ jenis: 'BANDING', ruas: 'rt', pembanding: 'TERMASUK', nilai: ['001', '002'] }).sah,
    ).toBe(true);
  });

  it('menolak jenis simpul yang tidak dikenal', () => {
    const h = periksaBentuk({ jenis: 'SQL', teks: 'DROP TABLE village_resident' });
    expect(h.sah).toBe(false);
    expect(h.kesalahan[0]).toContain('tidak dikenal');
  });

  it('menolak simpul gabungan yang tidak punya anak', () => {
    expect(periksaBentuk({ jenis: 'SEMUA', anak: [] }).sah).toBe(false);
    expect(periksaBentuk({ jenis: 'TIDAK' }).sah).toBe(false);
  });

  it('menolak yang bukan objek', () => {
    for (const bukan of [null, undefined, 'kriteria', 42, true]) {
      expect(periksaBentuk(bukan).sah).toBe(false);
    }
  });

  it('menolak pohon yang terlalu dalam', () => {
    let n: Kondisi = { jenis: 'BANDING', ruas: 'usia', pembanding: 'MINIMAL', nilai: 60 };
    for (let i = 0; i < KEDALAMAN_MAKSIMAL + 2; i += 1) n = { jenis: 'TIDAK', anak: n };
    const h = periksaBentuk(n);
    expect(h.sah).toBe(false);
    expect(h.kesalahan.join(' ')).toContain('terlalu dalam');
  });

  it('menolak pohon yang terlalu besar', () => {
    const anak: Kondisi[] = Array.from({ length: SIMPUL_MAKSIMAL + 5 }, () => ({
      jenis: 'BANDING' as const,
      ruas: 'usia' as const,
      pembanding: 'MINIMAL' as const,
      nilai: 60,
    }));
    const h = periksaBentuk({ jenis: 'SEMUA', anak });
    expect(h.sah).toBe(false);
    expect(h.kesalahan.join(' ')).toContain('terlalu besar');
  });

  it('berhenti dengan aman, tidak melempar, pada pohon yang sangat dalam', () => {
    let n: unknown = { jenis: 'BANDING', ruas: 'usia', pembanding: 'MINIMAL', nilai: 60 };
    for (let i = 0; i < 5_000; i += 1) n = { jenis: 'TIDAK', anak: n };
    expect(() => periksaBentuk(n)).not.toThrow();
    expect(periksaBentuk(n).sah).toBe(false);
  });
});

describe('evaluasi kriteria', () => {
  it('meloloskan warga yang memenuhi seluruhnya', () => {
    expect(evaluasi(kriteriaBlt, fakta()).layak).toBe(true);
  });

  it('menolak warga yang penghasilannya melampaui ambang', () => {
    expect(evaluasi(kriteriaBlt, fakta({ penghasilanBulanan: 4_000_000 })).layak).toBe(false);
  });

  it('menolak bila tidak satu pun syarat SALAH_SATU terpenuhi', () => {
    const h = evaluasi(
      kriteriaBlt,
      fakta({ lansia: false, disabilitas: false, kepalaKeluargaPerempuan: false }),
    );
    expect(h.layak).toBe(false);
  });

  it('menilai seluruh anak SEMUA, bukan berhenti pada kegagalan pertama', () => {
    // Warga yang memperbaiki satu sebab lalu ditolak lagi karena sebab kedua
    // akan merasa dipermainkan. Jejaknya harus memuat keduanya sekaligus.
    const h = evaluasi(
      kriteriaBlt,
      fakta({ penghasilanBulanan: 4_000_000, memilikiKendaraanBermotor: true }),
    );
    const gagal = h.jejak.filter((j) => !j.lulus).map((j) => j.ruas);
    expect(gagal).toContain('penghasilanBulanan');
    expect(gagal).toContain('memilikiKendaraanBermotor');
  });

  it('menganggap ruas kosong tidak memenuhi, dan menyebutkannya', () => {
    const h = evaluasi(kriteriaBlt, fakta({ penghasilanBulanan: undefined }));
    expect(h.layak).toBe(false);
    expect(h.ruasKosong).toContain('penghasilanBulanan');
    expect(h.jejak.find((j) => j.ruas === 'penghasilanBulanan')?.dataKosong).toBe(true);
  });

  it('tidak meloloskan warga yang datanya kosong seluruhnya', () => {
    expect(evaluasi(kriteriaBlt, {}).layak).toBe(false);
  });

  it('membalik hasil pada simpul TIDAK', () => {
    const k: Kondisi = {
      jenis: 'TIDAK',
      anak: { jenis: 'BANDING', ruas: 'terdaftarDtks', pembanding: 'SAMA', nilai: true },
    };
    expect(evaluasi(k, { terdaftarDtks: false }).layak).toBe(true);
    expect(evaluasi(k, { terdaftarDtks: true }).layak).toBe(false);
  });

  it('menangani pembanding daftar', () => {
    const k: Kondisi = { jenis: 'BANDING', ruas: 'rt', pembanding: 'TERMASUK', nilai: ['001', '002'] };
    expect(evaluasi(k, { rt: '001' }).layak).toBe(true);
    expect(evaluasi(k, { rt: '007' }).layak).toBe(false);
  });

  it('memakai seluruh pembanding angka sebagaimana namanya', () => {
    const uji: Array<[(typeof PEMBANDING_ANGKA)[number], number, boolean]> = [
      ['SAMA', 60, true],
      ['TIDAK_SAMA', 60, false],
      ['MINIMAL', 60, true],
      ['MAKSIMAL', 60, true],
      ['LEBIH', 60, false],
      ['KURANG', 60, false],
    ];
    for (const [pembanding, nilai, harap] of uji) {
      const k: Kondisi = { jenis: 'BANDING', ruas: 'usia', pembanding, nilai };
      expect(evaluasi(k, { usia: 60 }).layak).toBe(harap);
    }
  });

  it('menyusun jejak menjadi kalimat yang dapat dibacakan', () => {
    const h = evaluasi(kriteriaBlt, fakta({ penghasilanBulanan: 4_000_000 }));
    const kalimat = ringkasJejak(h);
    expect(kalimat.some((k) => k.includes('Penghasilan Bulanan'))).toBe(true);
    expect(kalimat.some((k) => k.includes('sebanyak-banyaknya'))).toBe(true);
  });
});

describe('batas kecerdasan buatan', () => {
  it('menolak penetapan oleh sistem, apa pun keadaan lainnya', () => {
    const h = bolehTetapkanPenerima(penetapan({ penetap: { userId: 'ai-gateway', jenis: 'AI' } }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('hanya');
    expect(h.alasan).toContain('mengusulkan');
  });

  it('tetap menolak sistem meskipun calon sudah diverifikasi dan dasarnya lengkap', () => {
    const h = bolehTetapkanPenerima(
      penetapan({
        status: 'DIVERIFIKASI',
        penetap: { userId: 'ai-gateway', jenis: 'AI' },
        dasarPenetapan: 'Seluruh syarat terpenuhi menurut penyaringan otomatis dengan keyakinan tinggi.',
      }),
    );
    expect(h.boleh).toBe(false);
  });

  it('menerima penetapan oleh manusia atas calon yang diverifikasi', () => {
    expect(bolehTetapkanPenerima(penetapan()).boleh).toBe(true);
  });

  it('menolak pengusul yang menetapkan usulannya sendiri', () => {
    const h = bolehTetapkanPenerima(
      penetapan({ diusulkanOleh: 'kasi-kesra', penetap: { userId: 'kasi-kesra', jenis: 'MANUSIA' } }),
    );
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('usulkan sendiri');
  });

  it('mengizinkan penetapan atas usulan penyaringan yang tidak berpengusul', () => {
    expect(bolehTetapkanPenerima(penetapan({ diusulkanOleh: null, sumber: 'AI' })).boleh).toBe(true);
  });

  it('menuntut verifikasi sebelum penetapan', () => {
    const h = bolehTetapkanPenerima(penetapan({ status: 'DIUSULKAN' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('kunjungan petugas');
  });

  it('menuntut dasar penetapan yang diuraikan', () => {
    expect(bolehTetapkanPenerima(penetapan({ dasarPenetapan: 'layak' })).boleh).toBe(false);
    expect(bolehTetapkanPenerima(penetapan({ dasarPenetapan: '   ' })).boleh).toBe(false);
  });

  it('menolak menetapkan ulang yang sudah ditetapkan atau ditolak', () => {
    expect(bolehTetapkanPenerima(penetapan({ status: 'DITETAPKAN' })).boleh).toBe(false);
    expect(bolehTetapkanPenerima(penetapan({ status: 'DITOLAK' })).boleh).toBe(false);
  });
});

describe('tumpang tindih antarprogram', () => {
  const program = {
    id: 'blt-2027',
    aidCategory: 'BLT',
    periodStart: '2027-01-01',
    periodEnd: '2027-12-31',
  };
  const lain = (over: Partial<PenerimaanLain> = {}): PenerimaanLain => ({
    programId: 'blt-dd-2027',
    programName: 'BLT Dana Desa 2027',
    aidCategory: 'BLT',
    periodStart: '2027-06-01',
    periodEnd: '2027-11-30',
    ...over,
  });

  it('menemukan bantuan sejenis pada periode yang beririsan', () => {
    const h = deteksiTumpangTindih(program, [lain()]);
    expect(h.bentrok).toBe(true);
    expect(h.penerimaanBentrok).toHaveLength(1);
    expect(h.alasan).toContain('BLT Dana Desa 2027');
  });

  it('mengabaikan bantuan berjenis lain', () => {
    expect(deteksiTumpangTindih(program, [lain({ aidCategory: 'RUTILAHU' })]).bentrok).toBe(false);
  });

  it('mengabaikan periode yang tidak beririsan', () => {
    expect(
      deteksiTumpangTindih(program, [lain({ periodStart: '2026-01-01', periodEnd: '2026-12-31' })])
        .bentrok,
    ).toBe(false);
  });

  it('menghitung irisan yang hanya menyentuh satu hari', () => {
    expect(
      deteksiTumpangTindih(program, [lain({ periodStart: '2026-06-01', periodEnd: '2027-01-01' })])
        .bentrok,
    ).toBe(true);
  });

  it('mengabaikan program yang sama, agar penetapan ulang tidak dianggap ganda', () => {
    expect(deteksiTumpangTindih(program, [lain({ programId: 'blt-2027' })]).bentrok).toBe(false);
  });

  it('bawaannya menolak, bukan mengizinkan', () => {
    // Bantuan yang diam-diam berganda bagi sebagian keluarga adalah cara
    // pemerintah desa kehilangan kepercayaan warganya. Yang aman menjadi bawaan.
    expect(deteksiTumpangTindih(program, [lain()]).bentrok).toBe(true);
    expect(deteksiTumpangTindih({ ...program, bolehBertumpuk: true }, [lain()]).bentrok).toBe(false);
  });
});

describe('penyaluran', () => {
  const salur = (over: Partial<Penyaluran> = {}): Penyaluran => ({
    statusPenerima: 'DITETAPKAN',
    bentuk: 'UANG',
    nilai: 300_000,
    diterimaOleh: 'PENERIMA',
    buktiTerima: 'TTD-0091',
    ...over,
  });

  it('menerima penyaluran yang lengkap', () => {
    expect(bolehSalurkan(salur()).boleh).toBe(true);
  });

  it('menolak penyaluran kepada calon yang belum ditetapkan', () => {
    for (const s of ['DIUSULKAN', 'DIVERIFIKASI', 'DITOLAK'] as const) {
      expect(bolehSalurkan(salur({ statusPenerima: s })).boleh).toBe(false);
    }
  });

  it('menuntut nama yang mewakili bila diwakilkan', () => {
    const h = bolehSalurkan(salur({ diterimaOleh: 'KUASA' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak pernah menerima');
    expect(bolehSalurkan(salur({ diterimaOleh: 'KUASA', namaPenerimaKuasa: 'Sumiati' })).boleh).toBe(
      true,
    );
  });

  it('menuntut bukti terima pada bantuan berbentuk uang', () => {
    expect(bolehSalurkan(salur({ buktiTerima: undefined })).boleh).toBe(false);
    expect(bolehSalurkan(salur({ bentuk: 'BARANG', buktiTerima: undefined })).boleh).toBe(true);
  });

  it('menolak nilai yang tidak sah', () => {
    expect(bolehSalurkan(salur({ nilai: 0 })).boleh).toBe(false);
    expect(bolehSalurkan(salur({ nilai: -1 })).boleh).toBe(false);
  });
});
