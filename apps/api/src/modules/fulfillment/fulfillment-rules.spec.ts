import {
  ALL_FULFILLMENT_STATUSES,
  MAX_PACKAGE_DIMENSION_MM,
  MAX_PACKAGE_WEIGHT_GRAM,
  canAdvance,
  chargeableWeightGram,
  isFulfillmentTerminal,
  validatePackage,
  validatePick,
  type FulfillmentStatus,
} from './fulfillment-rules';

describe('perpindahan status pemenuhan', () => {
  it('mengizinkan alur normal dari awal sampai terkirim', () => {
    const path: FulfillmentStatus[] = [
      'NEW', 'ALLOCATED', 'PICKING', 'PICKED', 'PACKING', 'PACKED', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED',
    ];
    for (let i = 0; i < path.length - 1; i += 1) {
      expect(canAdvance(path[i], path[i + 1]).ok).toBe(true);
    }
  });

  it('menolak melompati tahapan', () => {
    expect(canAdvance('NEW', 'SHIPPED').ok).toBe(false);
    expect(canAdvance('ALLOCATED', 'PACKED').ok).toBe(false);
  });

  it('menolak mundur', () => {
    // Barang yang sudah dikirim tidak dapat kembali menjadi belum diambil.
    expect(canAdvance('SHIPPED', 'PICKING').ok).toBe(false);
    expect(canAdvance('PACKED', 'PICKED').ok).toBe(false);
  });

  it('tidak mengizinkan pembatalan setelah diserahkan ke ekspedisi', () => {
    // Setelah barang di tangan kurir, pembatalan bukan lagi urusan gudang.
    expect(canAdvance('SHIPPED', 'CANCELLED').ok).toBe(false);
    expect(canAdvance('READY_TO_SHIP', 'CANCELLED').ok).toBe(true);
  });

  it('menandai status akhir', () => {
    expect(isFulfillmentTerminal('DELIVERED')).toBe(true);
    expect(isFulfillmentTerminal('CANCELLED')).toBe(true);
    expect(isFulfillmentTerminal('PICKING')).toBe(false);
  });

  it('memberi setiap status berjalan jalan keluar', () => {
    const stuck = ALL_FULFILLMENT_STATUSES.filter(
      (s) => !isFulfillmentTerminal(s) &&
        !ALL_FULFILLMENT_STATUSES.some((to) => canAdvance(s, to).ok),
    );
    expect(stuck).toEqual([]);
  });

  it('menyebut status yang mungkin pada alasan penolakan', () => {
    expect(canAdvance('NEW', 'SHIPPED').reason).toMatch(/ALLOCATED/);
  });
});

describe('pemeriksaan pengambilan', () => {
  const line = (over = {}) => ({
    lineId: 'L1',
    sku: 'SKU-001',
    orderedQty: 5,
    pickedQty: 5,
    ...over,
  });

  it('meloloskan pengambilan yang pas', () => {
    expect(validatePick([line()]).ok).toBe(true);
  });

  it('mengizinkan kekurangan yang beralasan', () => {
    // Menolak kekurangan akan membuat petugas mencatat angka palsu supaya bisa
    // lanjut, dan angka palsu jauh lebih merusak daripada kekurangan jujur.
    const result = validatePick([line({ pickedQty: 3, discrepancyReason: 'RAK_KOSONG' })]);
    expect(result.ok).toBe(true);
  });

  it('menolak kekurangan tanpa alasan', () => {
    const result = validatePick([line({ pickedQty: 3 })]);
    expect(result.issues.map((i) => i.code)).toContain('REASON_REQUIRED');
  });

  it('menyebut selisihnya pada alasan', () => {
    const result = validatePick([line({ pickedQty: 3 })]);
    expect(result.issues[0].detail).toMatch(/kekurangan 2/);
  });

  it('menolak kelebihan pengambilan', () => {
    // Mengambil lebih banyak berarti barang milik pesanan lain ikut terbawa.
    const result = validatePick([line({ pickedQty: 7 })]);
    expect(result.issues.map((i) => i.code)).toContain('OVER_PICK');
  });

  it('menolak kelebihan meski disertai alasan', () => {
    const result = validatePick([line({ pickedQty: 7, discrepancyReason: 'SALAH_HITUNG' })]);
    expect(result.ok).toBe(false);
  });

  it('menolak ketika tidak ada satu pun yang diambil', () => {
    const result = validatePick([line({ pickedQty: 0, discrepancyReason: 'HABIS' })]);
    expect(result.issues.map((i) => i.code)).toContain('NOTHING_PICKED');
  });

  it('memeriksa seluruh baris, bukan berhenti pada yang pertama', () => {
    const result = validatePick([
      line({ lineId: 'L1', pickedQty: 3 }),
      line({ lineId: 'L2', pickedQty: 9 }),
    ]);
    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('meloloskan daftar kosong', () => {
    expect(validatePick([]).ok).toBe(true);
  });
});

describe('pemeriksaan paket', () => {
  const pkg = (over = {}) => ({
    weightGram: 800,
    lengthMm: 300,
    widthMm: 200,
    heightMm: 150,
    lines: [{ lineId: 'L1', quantity: 2, pickedQty: 2 }],
    ...over,
  });

  it('meloloskan paket yang lengkap', () => {
    expect(validatePackage(pkg()).ok).toBe(true);
  });

  it('menolak paket tanpa berat', () => {
    // Ekspedisi menagih berdasarkan yang ditimbang; paket tanpa berat berarti
    // ongkos baru diketahui setelah barang diserahkan.
    expect(validatePackage(pkg({ weightGram: null })).issues.map((i) => i.code)).toContain(
      'WEIGHT_REQUIRED',
    );
    expect(validatePackage(pkg({ weightGram: 0 })).ok).toBe(false);
  });

  it.each(['lengthMm', 'widthMm', 'heightMm'] as const)('menolak paket tanpa %s', (field) => {
    const result = validatePackage(pkg({ [field]: null }));
    expect(result.issues.map((i) => i.code)).toContain('DIMENSION_REQUIRED');
  });

  it('menolak dimensi yang tidak masuk akal', () => {
    const result = validatePackage(pkg({ lengthMm: MAX_PACKAGE_DIMENSION_MM + 1 }));
    expect(result.issues.map((i) => i.code)).toContain('DIMENSION_UNREASONABLE');
  });

  it('menolak berat yang tidak masuk akal', () => {
    const result = validatePackage(pkg({ weightGram: MAX_PACKAGE_WEIGHT_GRAM + 1 }));
    expect(result.issues.map((i) => i.code)).toContain('DIMENSION_UNREASONABLE');
  });

  it('menolak mengemas lebih banyak daripada yang diambil', () => {
    const result = validatePackage(pkg({ lines: [{ lineId: 'L1', quantity: 5, pickedQty: 2 }] }));
    expect(result.issues.map((i) => i.code)).toContain('EXCEEDS_PICKED');
  });

  it('menolak paket kosong', () => {
    expect(validatePackage(pkg({ lines: [] })).issues.map((i) => i.code)).toContain('EMPTY_PACKAGE');
  });

  it('melaporkan seluruh masalah sekaligus', () => {
    const result = validatePackage({
      weightGram: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      lines: [],
    });
    expect(result.issues.length).toBeGreaterThanOrEqual(5);
  });
});

describe('berat yang ditagih', () => {
  it('memakai berat sesungguhnya bila lebih besar', () => {
    // Kotak kecil berisi barang berat.
    expect(chargeableWeightGram(5000, 200, 150, 100)).toBe(5000);
  });

  it('memakai berat volume bila lebih besar', () => {
    // Kotak besar berisi barang ringan — inilah yang membuat penjual terkejut
    // bila tidak diberi tahu di muka.
    const result = chargeableWeightGram(500, 600, 400, 400);
    expect(result).toBeGreaterThan(500);
  });

  it('menghitung berat volume dengan pembagi yang lazim', () => {
    // 60 x 40 x 40 cm = 96.000 cm3; dibagi 6000 = 16 kg.
    expect(chargeableWeightGram(0, 600, 400, 400)).toBe(16000);
  });

  it('menerima pembagi lain', () => {
    expect(chargeableWeightGram(0, 600, 400, 400, 5000)).toBe(19200);
  });

  it('membulatkan ke gram utuh', () => {
    expect(Number.isInteger(chargeableWeightGram(333.7, 111, 222, 333))).toBe(true);
  });
});
