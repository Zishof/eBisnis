import {
  buildPrompt,
  parseModelJson,
  redactObject,
  redactText,
  validateAgainstSchema,
} from './prompt-builder';
import { AI_USE_CASES, findUseCase, listUseCases } from './ai-use-case.registry';
import { MENU_TREE_SEED } from '../../infrastructure/provisioning/tenant-menu.seed';

describe('redactText', () => {
  it('menyamarkan nomor rekening', () => {
    const { text, redacted } = redactText('Transfer ke rekening 1234567890123 sebesar 5 juta.');
    expect(text).not.toContain('1234567890123');
    expect(text).toContain('[NOMOR-DISAMARKAN]');
    expect(redacted[0].count).toBe(1);
  });

  it('menyamarkan nomor telepon Indonesia dalam berbagai bentuk', () => {
    for (const nomor of ['081234567890', '+6281234567890', '6281234567890']) {
      const { text } = redactText(`Hubungi ${nomor} untuk konfirmasi.`);
      expect(text).not.toContain(nomor);
    }
  });

  it('menyamarkan surel', () => {
    const { text } = redactText('Kirim ke budi.santoso@contoh.co.id ya.');
    expect(text).not.toContain('budi.santoso@contoh.co.id');
    expect(text).toContain('[SUREL-DISAMARKAN]');
  });

  it('menyamarkan NPWP', () => {
    const { text } = redactText('NPWP 01.234.567.8-901.000 sudah terdaftar.');
    expect(text).not.toContain('01.234.567.8-901.000');
  });

  it('melaporkan apa yang disamarkan, tidak membuangnya diam-diam', () => {
    /*
     * Pengguna yang melihat "tiga nomor disamarkan" tahu mengapa jawabannya
     * tidak menyebut nomor itu. Tanpa laporan, ia akan mengira modelnya yang
     * tidak becus.
     */
    const { redacted } = redactText('Rek 1111111111111 dan 2222222222222 serta a@b.co');
    const jenis = Object.fromEntries(redacted.map((r) => [r.kind, r.count]));
    expect(jenis['nomor panjang']).toBe(2);
    expect(jenis['surel']).toBe(1);
  });

  it('teks tanpa data sensitif tidak berubah', () => {
    const asli = 'Penjualan Juli naik 20 persen dibanding Juni.';
    const { text, redacted } = redactText(asli);
    expect(text).toBe(asli);
    expect(redacted).toEqual([]);
  });

  it('angka biasa tidak ikut tersamarkan', () => {
    // Angka penjualan justru yang paling perlu sampai ke model.
    const { text } = redactText('Total 12500000 rupiah dari 350 transaksi.');
    expect(text).toContain('350');
  });
});

describe('redactObject', () => {
  it('membuang kata sandi lewat penyamar telemetri', () => {
    const { text } = redactObject({ username: 'budi', password: 'rahasia123' });
    expect(text).not.toContain('rahasia123');
  });

  it('menyamarkan pola sensitif pada nilai teks bebas', () => {
    const { text } = redactObject({ catatan: 'hubungi 081234567890' });
    expect(text).not.toContain('081234567890');
  });
});

describe('buildPrompt', () => {
  const dasar = {
    useCaseName: 'Buat Kesimpulan',
    instruction: 'Ringkas data berikut.',
    question: 'Bagaimana tren penjualan?',
    evidence: [{ source: 'Laporan Penjualan', reference: 'LP-2026-07', content: 'Juli: 12 juta' }],
  };

  it('menyertakan bukti beserta sumbernya', () => {
    const p = buildPrompt(dasar);
    expect(p.user).toContain('Laporan Penjualan');
    expect(p.user).toContain('LP-2026-07');
    expect(p.user).toContain('Juli: 12 juta');
    expect(p.includedEvidence).toBe(1);
  });

  it('melarang mengarang angka pada pesan sistem', () => {
    const p = buildPrompt(dasar);
    expect(p.system).toContain('JANGAN mengarang angka');
    expect(p.system).toContain('tidak cukup');
  });

  it('menyatakan bahwa AI tidak melakukan tindakan', () => {
    // Ditanamkan pada prompt DAN ditegakkan bentuknya pada registri.
    const p = buildPrompt(dasar);
    expect(p.system).toContain('TIDAK melakukan tindakan');
  });

  it('menyamarkan data sensitif pada bukti', () => {
    const p = buildPrompt({
      ...dasar,
      evidence: [{ source: 'Pelanggan', content: 'Budi, telepon 081234567890' }],
    });
    expect(p.user).not.toContain('081234567890');
    expect(p.redacted.some((r) => r.kind === 'telepon')).toBe(true);
  });

  it('memotong bukti yang melampaui batas dan MELAPORKAN berapa yang dibuang', () => {
    /*
     * Bukti yang melampaui konteks tidak menghasilkan galat — ia diam-diam
     * terpotong penyedianya, dan bagian yang terpotong sering justru bagian
     * akhir yang paling penting. Memotongnya sendiri membuat pemotongan itu
     * terlihat.
     */
    const banyak = Array.from({ length: 20 }, (_, i) => ({
      source: `Sumber ${i}`,
      content: 'x'.repeat(500),
    }));
    const p = buildPrompt({ ...dasar, evidence: banyak, evidenceCharBudget: 2_000 });
    expect(p.includedEvidence).toBeLessThan(20);
    expect(p.droppedEvidence).toBeGreaterThan(0);
    expect(p.includedEvidence + p.droppedEvidence).toBe(20);
  });

  it('menyatakan terang-terangan bila tidak ada bukti', () => {
    const p = buildPrompt({ ...dasar, evidence: [] });
    expect(p.user).toContain('tidak ada bukti disertakan');
  });

  it('sidik sama untuk masukan sama, berbeda untuk masukan berbeda', () => {
    expect(buildPrompt(dasar).fingerprint).toBe(buildPrompt(dasar).fingerprint);
    expect(buildPrompt({ ...dasar, question: 'lain' }).fingerprint).not.toBe(
      buildPrompt(dasar).fingerprint,
    );
  });
});

describe('validateAgainstSchema', () => {
  const skema = {
    type: 'object',
    properties: {
      kesimpulan: { type: 'string' },
      poinPenting: { type: 'array' },
      keyakinan: { type: 'string' },
    },
    required: ['kesimpulan', 'poinPenting', 'keyakinan'],
  };

  it('menerima keluaran yang lengkap', () => {
    const hasil = validateAgainstSchema(
      { kesimpulan: 'naik', poinPenting: ['a'], keyakinan: 'TINGGI' },
      skema,
    );
    expect(hasil.valid).toBe(true);
  });

  it('menolak bidang wajib yang hilang, menyebut namanya', () => {
    // Keluaran yang tidak sesuai bentuk akan meledak jauh dari sini — pada
    // komponen antarmuka yang membaca bidang yang ternyata tidak ada.
    const hasil = validateAgainstSchema({ kesimpulan: 'naik' }, skema);
    expect(hasil.valid).toBe(false);
    expect(hasil.errors.join(' ')).toContain('poinPenting');
    expect(hasil.errors.join(' ')).toContain('keyakinan');
  });

  it('menolak tipe yang salah', () => {
    const hasil = validateAgainstSchema(
      { kesimpulan: 'naik', poinPenting: 'bukan array', keyakinan: 'TINGGI' },
      skema,
    );
    expect(hasil.valid).toBe(false);
    expect(hasil.errors[0]).toContain('poinPenting');
  });

  it('menolak yang bukan objek', () => {
    expect(validateAgainstSchema('teks biasa', skema).valid).toBe(false);
    expect(validateAgainstSchema(null, skema).valid).toBe(false);
    expect(validateAgainstSchema([1, 2], skema).valid).toBe(false);
  });

  it('membedakan array dari objek', () => {
    // typeof [] adalah 'object'; tanpa pemeriksaan tersendiri, array akan
    // lolos sebagai objek.
    const hasil = validateAgainstSchema(
      { kesimpulan: 'x', poinPenting: [], keyakinan: 'RENDAH' },
      skema,
    );
    expect(hasil.valid).toBe(true);
  });
});

describe('parseModelJson', () => {
  it('membaca JSON murni', () => {
    const hasil = parseModelJson('{"a":1}');
    expect(hasil.ok && hasil.value).toEqual({ a: 1 });
  });

  it('membaca JSON yang dibungkus pagar kode', () => {
    // Model kadang membungkusnya meski diminta JSON murni. Membiarkannya
    // berarti seluruh jawaban terbuang hanya karena tiga karakter pembungkus.
    const hasil = parseModelJson('```json\n{"a":1}\n```');
    expect(hasil.ok && hasil.value).toEqual({ a: 1 });
  });

  it('membaca pagar kode tanpa penanda bahasa', () => {
    const hasil = parseModelJson('```\n{"a":1}\n```');
    expect(hasil.ok && hasil.value).toEqual({ a: 1 });
  });

  it('melaporkan galat untuk yang bukan JSON', () => {
    const hasil = parseModelJson('maaf, saya tidak tahu');
    expect(hasil.ok).toBe(false);
  });
});

describe('registri keperluan AI', () => {
  it('TIDAK ADA satu pun keperluan yang membuat AI bertindak', () => {
    /*
     * Larangan terpenting seluruh Versi 11, ditegakkan oleh BENTUK: satu-satunya
     * nilai outputKind adalah DRAFT, ANALYSIS, dan RECOMMENDATION. Tidak ada
     * nilai yang berarti "kerjakan", sehingga keperluan yang membuat AI
     * melakukan pembayaran, posting, persetujuan, penghapusan, atau perubahan
     * hak akses tidak dapat dinyatakan sama sekali.
     */
    const diizinkan = ['DRAFT', 'ANALYSIS', 'RECOMMENDATION'];
    for (const u of AI_USE_CASES) {
      expect(diizinkan).toContain(u.outputKind);
    }
  });

  it('keperluan berisiko tinggi menyimpan isinya untuk penelusuran', () => {
    for (const u of AI_USE_CASES.filter((x) => x.riskClass === 'HIGH')) {
      expect(u.storeContent).toBe(true);
    }
  });

  it('keperluan berisiko rendah TIDAK menyimpan isi', () => {
    // Menyimpan isi berarti membuat salinan kedua dari data sensitif pada tabel
    // yang aturan aksesnya berbeda dari tabel aslinya.
    for (const u of AI_USE_CASES.filter((x) => x.riskClass === 'LOW')) {
      expect(u.storeContent).toBe(false);
    }
  });

  it('keperluan yang menyimpulkan angka wajib berbukti', () => {
    for (const kode of ['BUAT_KESIMPULAN', 'JELASKAN_ANGKA', 'TEMUKAN_ANOMALI']) {
      expect(findUseCase(kode)!.requiresEvidence).toBe(true);
    }
  });

  it('setiap keperluan menunjuk menu dan aksi untuk izinnya', () => {
    for (const u of AI_USE_CASES) {
      expect(u.menuCode).toMatch(/^[A-Z_]+$/);
      expect(u.action).toMatch(/^[A-Z_]+$/);
    }
  });

  it('setiap keperluan punya kuota', () => {
    for (const u of AI_USE_CASES) {
      expect(u.hourlyQuotaPerUser).toBeGreaterThan(0);
    }
  });

  it('kode keperluan unik', () => {
    const kode = AI_USE_CASES.map((u) => u.code);
    expect(new Set(kode).size).toBe(kode.length);
  });

  it('kode yang tidak dikenal menghasilkan undefined, bukan kebijakan bawaan', () => {
    // Kebijakan bawaan pada keperluan tak dikenal berarti keperluan apa pun
    // dapat diselundupkan dengan mengarang kodenya.
    expect(findUseCase('KEPERLUAN_KARANGAN')).toBeUndefined();
  });

  it('setiap menuCode benar-benar ada pada katalog menu', () => {
    /*
     * Tanpa uji ini, satu huruf yang salah pada `menuCode` baru ketahuan saat
     * seseorang memakai keperluannya — dan galatnya muncul sebagai "menu tidak
     * dikenal" pada penjaga izin, jauh dari sebabnya.
     *
     * Katalog menu adalah sumber kebenarannya, jadi diperiksa terhadap katalog
     * itu sendiri, bukan terhadap daftar yang disalin.
     */
    const kodeMenu = new Set(MENU_TREE_SEED.map((m) => m.code));
    const salah = AI_USE_CASES.filter((u) => !kodeMenu.has(u.menuCode));
    expect(salah.map((u) => `${u.code} -> ${u.menuCode}`)).toEqual([]);
  });

  it('setiap aksi benar-benar tersedia pada menunya', () => {
    // Izin `MENU.ACTION` hanya dapat diberikan bila menunya memang punya aksi
    // itu. Keperluan yang menuntut aksi yang tidak ada tidak akan pernah dapat
    // dipakai siapa pun.
    const aksiPerMenu = new Map(MENU_TREE_SEED.map((m) => [m.code, new Set(m.actions ?? [])]));
    const salah = AI_USE_CASES.filter((u) => !aksiPerMenu.get(u.menuCode)?.has(u.action));
    expect(salah.map((u) => `${u.code} -> ${u.menuCode}.${u.action}`)).toEqual([]);
  });

  it('keperluan yang menyusun teks untuk pihak luar berisiko tinggi', () => {
    // Draft yang keluar dari organisasi — surat, balasan pelanggan — dapat
    // menimbulkan akibat yang tidak dapat ditarik kembali bila isinya salah.
    for (const kode of ['DRAFT_SURAT_KELUAR', 'DRAFT_BALASAN_PELANGGAN']) {
      const u = findUseCase(kode)!;
      expect(u.riskClass).toBe('HIGH');
      expect(u.storeContent).toBe(true);
    }
  });

  it('keperluan berisiko tinggi berkuota lebih ketat daripada yang rendah', () => {
    const tinggi = AI_USE_CASES.filter((u) => u.riskClass === 'HIGH');
    const rendah = AI_USE_CASES.filter((u) => u.riskClass === 'LOW');
    const maksTinggi = Math.max(...tinggi.map((u) => u.hourlyQuotaPerUser));
    const minRendah = Math.min(...rendah.map((u) => u.hourlyQuotaPerUser));
    expect(maksTinggi).toBeLessThanOrEqual(minRendah);
  });

  it('skema keluaran setiap keperluan menyebut bidang wajib', () => {
    for (const u of listUseCases()) {
      expect(Array.isArray(u.outputSchema.required)).toBe(true);
      expect((u.outputSchema.required as string[]).length).toBeGreaterThan(0);
    }
  });
});
