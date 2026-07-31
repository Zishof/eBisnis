import {
  MARKETPLACE_EVENTS,
  REQUIRED_AMOUNTS,
  buildJournalLines,
  checkRequiredAmounts,
  eventIdempotencyKey,
  isKnownEvent,
  type AccountingEvent,
  type PostingRule,
} from './posting-engine';

const occurredAt = new Date('2026-07-31T00:00:00Z');

const rule = (over: Partial<PostingRule> = {}): PostingRule => ({
  code: 'R1',
  eventCode: 'MARKETPLACE_SALE_RECOGNIZED',
  sortOrder: 1,
  accountId: 'AKUN-PIUTANG',
  side: 'DEBIT',
  amountKey: 'gross',
  skipWhenZero: true,
  descriptionTemplate: null,
  effectiveFrom: new Date('2026-01-01'),
  effectiveTo: null,
  isActive: true,
  ...over,
});

const event = (over: Partial<AccountingEvent> = {}): AccountingEvent => ({
  eventCode: 'MARKETPLACE_SALE_RECOGNIZED',
  sourceType: 'MarketplaceOrder',
  sourceId: 'ORD-1',
  sourceNumber: 'PSN-260731-0001',
  occurredAt,
  amounts: { gross: 220000, netSales: 200000, tax: 20000 },
  currencyCode: 'IDR',
  ...over,
});

const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

describe('penyusunan baris jurnal', () => {
  const seimbang = [
    rule({ code: 'R1', accountId: 'PIUTANG', side: 'DEBIT', amountKey: 'gross', sortOrder: 1 }),
    rule({ code: 'R2', accountId: 'PENJUALAN', side: 'CREDIT', amountKey: 'netSales', sortOrder: 2 }),
    rule({ code: 'R3', accountId: 'PPN', side: 'CREDIT', amountKey: 'tax', sortOrder: 3 }),
  ];

  it('menyusun jurnal yang seimbang', () => {
    const result = buildJournalLines(event(), seimbang);
    expect(result.ok).toBe(true);
    expect(result.totalDebit).toBe(220000);
    expect(result.totalCredit).toBe(220000);
    expect(result.lines).toHaveLength(3);
  });

  it('mengurutkan baris menurut sortOrder', () => {
    const result = buildJournalLines(event(), [...seimbang].reverse());
    expect(result.lines.map((l) => l.accountId)).toEqual(['PIUTANG', 'PENJUALAN', 'PPN']);
  });

  it('menolak jurnal yang tidak seimbang', () => {
    // Menyimpannya berarti neraca tidak akan pernah seimbang lagi, dan
    // menemukan penyebabnya kemudian jauh lebih mahal.
    const result = buildJournalLines(event(), [
      rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross' }),
      rule({ code: 'R2', side: 'CREDIT', amountKey: 'netSales' }),
    ]);
    expect(result.ok).toBe(false);
    expect(codes(result)).toContain('UNBALANCED');
  });

  it('menyebut selisihnya pada alasan', () => {
    const result = buildJournalLines(event(), [
      rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross' }),
      rule({ code: 'R2', side: 'CREDIT', amountKey: 'netSales' }),
    ]);
    expect(result.issues[0].detail).toMatch(/20000/);
  });
});

describe('aturan yang tidak ada atau belum berlaku', () => {
  it('menolak peristiwa tanpa aturan sama sekali', () => {
    const result = buildJournalLines(event(), []);
    expect(codes(result)).toContain('NO_RULE');
  });

  it('membedakan aturan yang ada tetapi belum berlaku', () => {
    // Membedakannya membantu menemukan kebijakan yang lupa diperpanjang.
    const result = buildJournalLines(
      event(),
      [rule({ effectiveFrom: new Date('2027-01-01') })],
    );
    expect(codes(result)).toContain('RULE_NOT_EFFECTIVE');
  });

  it('menolak aturan yang masa berlakunya sudah lewat', () => {
    const result = buildJournalLines(
      event(),
      [rule({ effectiveTo: new Date('2026-01-31') })],
    );
    expect(codes(result)).toContain('RULE_NOT_EFFECTIVE');
  });

  it('mengabaikan aturan yang tidak aktif', () => {
    const result = buildJournalLines(event(), [rule({ isActive: false })]);
    expect(codes(result)).toContain('RULE_NOT_EFFECTIVE');
  });

  it('mengabaikan aturan untuk peristiwa lain', () => {
    const result = buildJournalLines(
      event(),
      [rule({ eventCode: 'MARKETPLACE_REFUND' })],
    );
    expect(codes(result)).toContain('NO_RULE');
  });
});

describe('nilai peristiwa', () => {
  it('menolak nilai yang tidak ada', () => {
    const result = buildJournalLines(
      event({ amounts: { gross: 100000 } }),
      [rule({ amountKey: 'tidakAda' })],
    );
    expect(codes(result)).toContain('AMOUNT_MISSING');
  });

  it('menyebut nama medan dan aturan yang memintanya', () => {
    const result = buildJournalLines(
      event({ amounts: {} }),
      [rule({ code: 'R9', amountKey: 'gross' })],
    );
    expect(result.issues[0].detail).toMatch(/gross/);
    expect(result.issues[0].detail).toMatch(/R9/);
  });

  it('menolak nilai negatif', () => {
    // Pembalikan jurnal dilakukan dengan menukar sisi, bukan dengan nilai
    // negatif — jurnal bernilai negatif membuat laporan mudah salah jumlah.
    const result = buildJournalLines(
      event({ amounts: { gross: -100000 } }),
      [rule({ amountKey: 'gross' })],
    );
    expect(codes(result)).toContain('AMOUNT_NEGATIVE');
    expect(result.issues[0].detail).toMatch(/menukar sisi/);
  });

  it('melewati baris bernilai nol bila diminta', () => {
    const result = buildJournalLines(
      event({ amounts: { gross: 100000, shippingCost: 0 } }),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross' }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross' }),
        rule({ code: 'R3', side: 'DEBIT', amountKey: 'shippingCost', skipWhenZero: true }),
      ],
    );
    expect(result.lines).toHaveLength(2);
    expect(result.ok).toBe(true);
  });

  it('menyertakan baris nol bila diminta menyertakannya', () => {
    const result = buildJournalLines(
      event({ amounts: { gross: 0 } }),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross', skipWhenZero: false }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross', skipWhenZero: false }),
      ],
    );
    expect(result.lines).toHaveLength(2);
  });

  it('menolak bila seluruh baris terlewat', () => {
    const result = buildJournalLines(
      event({ amounts: { gross: 0 } }),
      [rule({ amountKey: 'gross', skipWhenZero: true })],
    );
    expect(codes(result)).toContain('NO_LINES');
  });

  it('membulatkan ke rupiah utuh', () => {
    const result = buildJournalLines(
      event({ amounts: { gross: 99999.6 } }),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross' }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross' }),
      ],
    );
    expect(result.lines.every((l) => Number.isInteger(l.amount))).toBe(true);
  });
});

describe('keterangan baris', () => {
  it('memakai templat bila ada', () => {
    const result = buildJournalLines(
      event(),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross', descriptionTemplate: 'Penjualan {sourceNumber}' }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross' }),
      ],
    );
    expect(result.lines[0].description).toBe('Penjualan PSN-260731-0001');
  });

  it('memberi keterangan bawaan tanpa templat', () => {
    const result = buildJournalLines(
      event(),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross' }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross' }),
      ],
    );
    expect(result.lines[0].description).toMatch(/PSN-260731-0001/);
  });

  it('tidak mengevaluasi apa pun di luar penanda yang dikenal', () => {
    // Templat yang dapat mengevaluasi apa pun adalah rumus bebas dengan nama
    // lain, dan larangan eval berlaku di sini.
    const result = buildJournalLines(
      event(),
      [
        rule({ code: 'R1', side: 'DEBIT', amountKey: 'gross', descriptionTemplate: '${process.env.SECRET} {tidakDikenal}' }),
        rule({ code: 'R2', side: 'CREDIT', amountKey: 'gross' }),
      ],
    );
    expect(result.lines[0].description).toBe('${process.env.SECRET} {tidakDikenal}');
  });
});

describe('kunci idempotensi', () => {
  it('menghasilkan kunci yang sama untuk peristiwa yang sama', () => {
    const a = eventIdempotencyKey('MARKETPLACE_PAYMENT_RECEIVED', 'MarketplaceOrder', 'ORD-1');
    const b = eventIdempotencyKey('MARKETPLACE_PAYMENT_RECEIVED', 'MarketplaceOrder', 'ORD-1');
    expect(a).toBe(b);
  });

  it('membedakan peristiwa berbeda pada dokumen yang sama', () => {
    const bayar = eventIdempotencyKey('MARKETPLACE_PAYMENT_RECEIVED', 'MarketplaceOrder', 'ORD-1');
    const jual = eventIdempotencyKey('MARKETPLACE_SALE_RECOGNIZED', 'MarketplaceOrder', 'ORD-1');
    expect(bayar).not.toBe(jual);
  });
});

describe('peristiwa yang dikenal', () => {
  it('mengenali seluruh peristiwa marketplace', () => {
    const unknown = MARKETPLACE_EVENTS.filter((e) => !isKnownEvent(e));
    expect(unknown).toEqual([]);
  });

  it('menolak peristiwa yang tidak terdaftar', () => {
    // Salah ketik tidak boleh menghasilkan peristiwa yang tidak pernah punya
    // aturan dan diam-diam tidak pernah dijurnal.
    expect(isKnownEvent('MARKETPLACE_SALE_RECOGNISED')).toBe(false);
    expect(isKnownEvent('')).toBe(false);
  });

  it('mendefinisikan nilai wajib untuk setiap peristiwa', () => {
    const tanpaDefinisi = MARKETPLACE_EVENTS.filter(
      (e) => !REQUIRED_AMOUNTS[e] || REQUIRED_AMOUNTS[e].length === 0,
    );
    expect(tanpaDefinisi).toEqual([]);
  });
});

describe('kelengkapan nilai peristiwa', () => {
  it('meloloskan peristiwa yang lengkap', () => {
    const result = checkRequiredAmounts('MARKETPLACE_SALE_RECOGNIZED', {
      netSales: 200000,
      tax: 20000,
      gross: 220000,
    });
    expect(result.ok).toBe(true);
  });

  it('menyebut nilai yang kurang', () => {
    // Lebih baik ditolak saat dibuat ketika konteksnya masih ada, daripada
    // gagal saat dijurnal jauh kemudian.
    const result = checkRequiredAmounts('MARKETPLACE_SALE_RECOGNIZED', { gross: 220000 });
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['netSales', 'tax']);
  });

  it('menolak peristiwa yang tidak dikenal', () => {
    const result = checkRequiredAmounts('TIDAK_ADA', { x: 1 });
    expect(result.ok).toBe(false);
  });

  it('menerima nilai nol sebagai terisi', () => {
    // Nol adalah nilai yang sah; yang tidak sah adalah tidak diisi sama sekali.
    const result = checkRequiredAmounts('MARKETPLACE_PAYMENT_RECEIVED', { amount: 0 });
    expect(result.ok).toBe(true);
  });
});
