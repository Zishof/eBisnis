import {
  buildAdapters,
  InAppAdapter,
  missingPlaceholders,
  renderTemplate,
  UnconfiguredAdapter,
} from './channel-adapter';

describe('renderTemplate', () => {
  it('mengisi penanda yang nilainya tersedia', () => {
    expect(renderTemplate('PO {{number}} dikirim', { number: 'PO-001' })).toBe('PO PO-001 dikirim');
  });

  it('penanda tanpa nilai dibiarkan APA ADANYA, bukan menjadi "undefined"', () => {
    /*
     * "PO {{number}} sudah dikirim" masih dapat dipahami. "PO undefined sudah
     * dikirim" tampak seperti sistem yang rusak — dan memang menandakan ada
     * nilai yang lupa diberikan, yang justru perlu terlihat.
     */
    const hasil = renderTemplate('PO {{number}} dikirim', {});
    expect(hasil).toBe('PO {{number}} dikirim');
    expect(hasil).not.toContain('undefined');
    expect(hasil).not.toContain('null');
  });

  it('nilai kosong diperlakukan seperti tidak ada', () => {
    expect(renderTemplate('Stok {{product}}', { product: '' })).toBe('Stok {{product}}');
  });

  it('nilai nol dan false tetap diisi', () => {
    // Nol adalah nilai yang sah dan sering justru yang penting.
    expect(renderTemplate('Sisa {{qty}}', { qty: 0 })).toBe('Sisa 0');
    expect(renderTemplate('Aktif: {{on}}', { on: false })).toBe('Aktif: false');
  });

  it('beberapa penanda sekaligus', () => {
    expect(renderTemplate('{{a}} dan {{b}}', { a: 'satu', b: 'dua' })).toBe('satu dan dua');
  });

  it('penanda yang sama diisi di setiap tempat', () => {
    expect(renderTemplate('{{x}}-{{x}}', { x: 'A' })).toBe('A-A');
  });
});

describe('missingPlaceholders', () => {
  it('menyebut penanda yang belum terisi', () => {
    expect(missingPlaceholders('PO {{number}} untuk {{vendor}}')).toEqual(['number', 'vendor']);
  });

  it('kosong bila seluruhnya terisi', () => {
    expect(missingPlaceholders(renderTemplate('PO {{n}}', { n: 1 }))).toEqual([]);
  });
});

describe('InAppAdapter', () => {
  const adapter = new InAppAdapter();

  it('selalu siap — tidak menuntut kredensial apa pun', () => {
    expect(adapter.isConfigured()).toBe(true);
  });

  it('menyatakan terkirim bila ada penerimanya', async () => {
    const hasil = await adapter.send({
      notificationId: 'n1',
      title: 'x',
      body: 'y',
      deepLink: null,
      recipientSubjectId: 'u1',
      severity: 'INFO',
      actionRequired: false,
    });
    expect(hasil.status).toBe('SENT');
  });

  it('dilewati bila ditujukan kepada peran, bukan kepada orang', async () => {
    // Bukan kegagalan: ia tetap tampil pada lonceng setiap pemegang peran itu.
    const hasil = await adapter.send({
      notificationId: 'n1',
      title: 'x',
      body: 'y',
      deepLink: null,
      recipientSubjectId: null,
      severity: 'INFO',
      actionRequired: false,
    });
    expect(hasil.status).toBe('SKIPPED');
    expect(hasil.note).toContain('peran');
  });
});

describe('UnconfiguredAdapter', () => {
  const bersihkanEnv = (keys: string[]) => {
    const lama: Record<string, string | undefined> = {};
    for (const k of keys) {
      lama[k] = process.env[k];
      delete process.env[k];
    }
    return () => {
      for (const k of keys) {
        if (lama[k] === undefined) delete process.env[k];
        else process.env[k] = lama[k]!;
      }
    };
  };

  it('melaporkan UNCONFIGURED, bukan mengarang keberhasilan', async () => {
    /*
     * Melaporkan berhasil padahal tidak terkirim adalah yang paling berbahaya:
     * orang mengira sudah diberi tahu, pekerjaan berhenti menunggu seseorang
     * yang tidak pernah tahu ia ditunggu, dan tidak ada satu pun tanda bahwa
     * ada yang salah.
     */
    const pulihkan = bersihkanEnv(['UJI_KUNCI_A', 'UJI_KUNCI_B']);
    const adapter = new UnconfiguredAdapter('EMAIL', 'Butuh SMTP.', [
      'UJI_KUNCI_A',
      'UJI_KUNCI_B',
    ]);
    const hasil = await adapter.send();
    expect(hasil.status).toBe('UNCONFIGURED');
    expect(hasil.status).not.toBe('SENT');
    pulihkan();
  });

  it('menyebutkan APA yang kurang, bukan sekadar "tidak dikonfigurasi"', async () => {
    // Keterangan yang tidak menyebutkan apa yang kurang memaksa operatornya
    // menebak apa yang harus disiapkan.
    const pulihkan = bersihkanEnv(['UJI_KUNCI_A', 'UJI_KUNCI_B']);
    process.env.UJI_KUNCI_A = 'ada';
    const adapter = new UnconfiguredAdapter('EMAIL', 'Butuh SMTP.', [
      'UJI_KUNCI_A',
      'UJI_KUNCI_B',
    ]);
    const hasil = await adapter.send();
    expect(hasil.note).toContain('UJI_KUNCI_B');
    // Yang sudah ada tidak ikut disebut sebagai kurang.
    expect(hasil.note).not.toContain('UJI_KUNCI_A,');
    pulihkan();
  });

  it('membedakan kredensial yang kurang dari pengirim yang belum ditulis', async () => {
    // Operator yang sudah menyiapkan kredensial tidak boleh mengira setelannya
    // yang salah.
    const pulihkan = bersihkanEnv(['UJI_KUNCI_A']);
    process.env.UJI_KUNCI_A = 'ada';
    const adapter = new UnconfiguredAdapter('EMAIL', 'Butuh SMTP.', ['UJI_KUNCI_A']);
    const hasil = await adapter.send();
    expect(hasil.status).toBe('FAILED');
    expect(hasil.note).toContain('belum diimplementasikan');
    pulihkan();
  });

  it('memeriksa env saat dipanggil, bukan saat dibuat', () => {
    // Kredensial dapat dipasang tanpa membangun ulang aplikasi.
    const pulihkan = bersihkanEnv(['UJI_KUNCI_C']);
    const adapter = new UnconfiguredAdapter('WHATSAPP', 'Butuh token.', ['UJI_KUNCI_C']);
    expect(adapter.isConfigured()).toBe(false);
    process.env.UJI_KUNCI_C = 'ada';
    expect(adapter.isConfigured()).toBe(true);
    pulihkan();
  });
});

describe('buildAdapters', () => {
  it('menyediakan kelima kanal', () => {
    expect(buildAdapters().map((a) => a.channel).sort()).toEqual(
      ['EMAIL', 'IN_APP', 'MOBILE_PUSH', 'WEB_PUSH', 'WHATSAPP'].sort(),
    );
  });

  it('hanya IN_APP yang siap tanpa kredensial', () => {
    const siap = buildAdapters().filter((a) => a.isConfigured()).map((a) => a.channel);
    expect(siap).toContain('IN_APP');
  });

  it('keterangan WhatsApp menyebut persetujuan templat Meta', () => {
    // Kredensial saja tidak cukup untuk WhatsApp, dan operator yang tidak tahu
    // itu akan menyiapkan token lalu bingung mengapa pesannya tetap ditolak.
    const wa = buildAdapters().find((a) => a.channel === 'WHATSAPP')!;
    expect(wa.missingRequirement()).toContain('templat');
  });
});
