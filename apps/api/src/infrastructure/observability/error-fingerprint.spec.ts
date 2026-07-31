import {
  computeFingerprint,
  extractTopFrames,
  flattenCauseChain,
  severityFromStatus,
  shouldPersist,
} from './error-fingerprint';

const stack = [
  'Error: Pesanan tidak ditemukan',
  '    at OrderService.findForBuyer (C:\\opt\\eBisnisGithub\\apps\\api\\src\\modules\\order\\order.service.ts:312:11)',
  '    at BuyerOrderController.detail (C:\\opt\\eBisnisGithub\\apps\\api\\src\\modules\\order\\order.module.ts:120:24)',
  '    at Object.<anonymous> (C:\\opt\\eBisnisGithub\\node_modules\\@nestjs\\core\\router.js:44:2)',
  '    at processTicksAndRejections (node:internal/process/task_queues:105:5)',
].join('\n');

describe('pengambilan bingkai teratas', () => {
  it('mengambil bingkai dari kode sendiri', () => {
    const frames = extractTopFrames(stack);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatch(/OrderService.findForBuyer/);
  });

  it('membuang bingkai dari node_modules', () => {
    // Galat yang sama sering muncul lewat jalur pustaka berbeda;
    // menyertakannya memecah satu masalah menjadi beberapa kelompok.
    const frames = extractTopFrames(stack);
    expect(frames.join('|')).not.toMatch(/node_modules/);
  });

  it('membuang bingkai internal Node', () => {
    expect(extractTopFrames(stack).join('|')).not.toMatch(/node:internal/);
  });

  it('membuang nomor baris dan kolom', () => {
    // Menambah satu baris komentar di atas sebuah fungsi tidak boleh
    // menghasilkan kelompok galat yang baru.
    expect(extractTopFrames(stack)[0]).not.toMatch(/:312:11/);
  });

  it('memotong jalur sampai penanda proyek', () => {
    const frames = extractTopFrames(stack);
    expect(frames[0]).not.toMatch(/C:/);
    expect(frames[0]).toMatch(/apps\/api/);
  });

  it('mengembalikan larik kosong tanpa jejak', () => {
    expect(extractTopFrames(null)).toEqual([]);
    expect(extractTopFrames(undefined)).toEqual([]);
  });
});

describe('sidik galat', () => {
  const base = {
    errorType: 'NotFoundError',
    message: 'Pesanan tidak ditemukan',
    stack,
    moduleCode: 'MARKETPLACE',
    routePath: '/api/v1/public/orders/8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8',
    errorCode: 'NOT_FOUND',
  };

  it('menghasilkan sidik yang sama untuk galat yang sama', () => {
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base }));
  });

  it('menyatukan galat pada pesanan yang berbeda', () => {
    // Satu kegagalan yang terjadi sepuluh ribu kali adalah satu masalah.
    const a = computeFingerprint({
      ...base,
      message: 'Pesanan 8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8 tidak ditemukan',
      routePath: '/api/v1/public/orders/8f3a1b2c-4d5e-6f70-8192-a3b4c5d6e7f8',
    });
    const b = computeFingerprint({
      ...base,
      message: 'Pesanan 11111111-2222-3333-4444-555555555555 tidak ditemukan',
      routePath: '/api/v1/public/orders/11111111-2222-3333-4444-555555555555',
    });
    expect(a).toBe(b);
  });

  it('memisahkan galat yang memang berbeda', () => {
    const a = computeFingerprint(base);
    const b = computeFingerprint({ ...base, errorType: 'ConflictError' });
    expect(a).not.toBe(b);
  });

  it('memisahkan galat pada modul berbeda', () => {
    expect(computeFingerprint(base)).not.toBe(
      computeFingerprint({ ...base, moduleCode: 'INVENTORY' }),
    );
  });

  it('memisahkan galat dari tempat berbeda pada kode', () => {
    const lain = stack.replace('OrderService.findForBuyer', 'CartService.addItem');
    expect(computeFingerprint(base)).not.toBe(computeFingerprint({ ...base, stack: lain }));
  });

  it('tidak terpengaruh perubahan nomor baris', () => {
    const digeser = stack.replace(':312:11', ':420:11');
    expect(computeFingerprint(base)).toBe(computeFingerprint({ ...base, stack: digeser }));
  });

  it('menghasilkan hash sepanjang 64 karakter heksadesimal', () => {
    expect(computeFingerprint(base)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('bekerja tanpa jejak tumpukan', () => {
    const tanpaStack = computeFingerprint({ ...base, stack: null });
    expect(tanpaStack).toMatch(/^[0-9a-f]{64}$/);
  });

  it('membedakan kode galat yang berbeda pada pesan yang sama', () => {
    // Kode galat lebih dipercaya daripada pesan: pesan dapat diperbaiki
    // kalimatnya tanpa mengubah masalahnya.
    expect(computeFingerprint({ ...base, errorCode: 'NOT_FOUND' })).not.toBe(
      computeFingerprint({ ...base, errorCode: 'FORBIDDEN' }),
    );
  });
});

describe('rantai penyebab', () => {
  it('menyusun rantai galat bertingkat', () => {
    const dalam = new Error('Koneksi terputus');
    const luar = new Error('Gagal menyimpan pesanan', { cause: dalam });
    const result = flattenCauseChain(luar);
    expect(result).toMatch(/Gagal menyimpan pesanan/);
    expect(result).toMatch(/Koneksi terputus/);
  });

  it('mengembalikan null untuk galat tanpa penyebab', () => {
    // Rantai satu tingkat bukan rantai; pesannya sudah ada di tempat lain.
    expect(flattenCauseChain(new Error('sendirian'))).toBeNull();
  });

  it('berhenti pada kedalaman maksimum', () => {
    let error = new Error('dasar');
    for (let i = 0; i < 20; i += 1) error = new Error(`tingkat ${i}`, { cause: error });
    const result = flattenCauseChain(error, 3);
    expect(result!.split('disebabkan oleh').length).toBeLessThanOrEqual(3);
  });

  it('menangani galat yang menunjuk dirinya sendiri', () => {
    const a = new Error('a') as Error & { cause?: unknown };
    a.cause = a;
    expect(flattenCauseChain(a)).toMatch(/lingkaran/);
  });
});

describe('tingkat keparahan dari status HTTP', () => {
  it('menandai kegagalan server sebagai ERROR', () => {
    expect(severityFromStatus(500)).toBe('ERROR');
    expect(severityFromStatus(503)).toBe('ERROR');
  });

  it('menandai penolakan otorisasi sebagai WARNING', () => {
    expect(severityFromStatus(401)).toBe('WARNING');
    expect(severityFromStatus(403)).toBe('WARNING');
  });

  it('menandai pembatasan laju sebagai WARNING', () => {
    expect(severityFromStatus(429)).toBe('WARNING');
  });

  it('menandai kesalahan pengguna sebagai INFO', () => {
    // Mencatatnya sebagai ERROR akan membanjiri daftar dengan hal yang memang
    // seharusnya terjadi, dan membuat galat sungguhan tenggelam.
    expect(severityFromStatus(400)).toBe('INFO');
    expect(severityFromStatus(404)).toBe('INFO');
    expect(severityFromStatus(422)).toBe('INFO');
  });

  it('menganggap galat tanpa status sebagai ERROR', () => {
    expect(severityFromStatus(null)).toBe('ERROR');
  });
});

describe('keputusan menyimpan', () => {
  it('selalu menyimpan galat yang tidak tertangani', () => {
    expect(shouldPersist(null, false)).toBe(true);
    expect(shouldPersist(404, false)).toBe(true);
  });

  it('menyimpan kegagalan server', () => {
    expect(shouldPersist(500, true)).toBe(true);
  });

  it('menyimpan penolakan otorisasi', () => {
    // Polanya menandakan usaha menembus.
    expect(shouldPersist(401, true)).toBe(true);
    expect(shouldPersist(403, true)).toBe(true);
  });

  it('menyimpan pembatasan laju', () => {
    // Menandakan penyalahgunaan.
    expect(shouldPersist(429, true)).toBe(true);
  });

  it('tidak menyimpan kesalahan validasi biasa', () => {
    // Terjadi terus-menerus pada sistem yang sehat; menyimpan seluruhnya
    // menghabiskan penyimpanan tanpa menambah pengetahuan.
    expect(shouldPersist(400, true)).toBe(false);
    expect(shouldPersist(404, true)).toBe(false);
    expect(shouldPersist(422, true)).toBe(false);
  });
});
