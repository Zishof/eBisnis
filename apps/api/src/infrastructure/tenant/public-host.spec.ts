/**
 * Pengujian penerjemahan host menjadi penyewa (IR-005).
 *
 * Ini pemetaan yang paling terbuka di seluruh sistem: ia dipanggil setiap
 * permintaan dari internet, tanpa sesi. Yang dijaga:
 *
 *   · Host tidak pernah dipercaya apa adanya.
 *   · Tidak ada pilihan cadangan — yang tidak cocok menjadi 404.
 *   · Seluruh penolakan berbunyi sama, supaya tidak ada yang dapat disimpulkan
 *     dari perbedaan pesannya.
 */

import {
  HOST_TERLARANG,
  MAX_HOST_LENGTH,
  bolehDipakaiMencari,
  bolehMelayaniVertikal,
  bolehMemakaiPencocokan,
  SKEMA_TERLARANG,
  STATUS_REGISTRY_SIAP,
  kunciSimpanan,
  normalkanHost,
  type BarisDomain,
  type BarisRegistry,
} from './public-host';

describe('penormalan host', () => {
  it('menurunkan huruf besar dan membuang spasi', () => {
    expect(normalkanHost('  Koperasi.EKoperasi.ID ')).toBe('koperasi.ekoperasi.id');
  });

  it('membuang porta', () => {
    // koperasi.ekoperasi.id dan koperasi.ekoperasi.id:8443 adalah situs yang sama.
    expect(normalkanHost('koperasi.ekoperasi.id:8443')).toBe('koperasi.ekoperasi.id');
  });

  it('membuang titik akar di ujung', () => {
    expect(normalkanHost('koperasi.ekoperasi.id.')).toBe('koperasi.ekoperasi.id');
  });

  it('menolak porta yang bukan angka', () => {
    expect(normalkanHost('koperasi.ekoperasi.id:abc')).toBeNull();
  });

  it('menolak nilai kosong', () => {
    for (const v of ['', '   ', null, undefined]) expect(normalkanHost(v)).toBeNull();
  });

  it('menolak aksara di luar huruf, angka, tanda hubung, dan titik', () => {
    /*
     * Nama internasional harus sudah dalam bentuk punycode. Menerima Unicode
     * apa adanya membuka jalan ke host yang tampak sama bagi manusia tetapi
     * berbeda bagi mesin.
     */
    for (const h of [
      'koperasi.ekoperаsi.id', // huruf "а" Sirilik
      'koperasi_maju.id',
      'koperasi.id/../admin',
      'koperasi.id?x=1',
      'koperasi.id#a',
      'koperasi .id',
    ]) {
      expect({ host: h, hasil: normalkanHost(h) }).toEqual({ host: h, hasil: null });
    }
  });

  it('menolak label kosong', () => {
    for (const h of ['koperasi..id', '.koperasi.id', 'koperasi.id..']) {
      expect(normalkanHost(h)).toBeNull();
    }
  });

  it('menolak tanda hubung di ujung label', () => {
    for (const h of ['-koperasi.id', 'koperasi-.id', 'a.-b.id']) {
      expect(normalkanHost(h)).toBeNull();
    }
  });

  it('menerima tanda hubung di tengah label', () => {
    expect(normalkanHost('koperasi-maju.ekoperasi.id')).toBe('koperasi-maju.ekoperasi.id');
  });

  it('menolak label yang melebihi 63 aksara', () => {
    expect(normalkanHost(`${'a'.repeat(64)}.id`)).toBeNull();
  });

  it('menolak host yang melebihi batas DNS', () => {
    const panjang = Array.from({ length: 10 }, () => 'a'.repeat(30)).join('.');
    expect(panjang.length).toBeGreaterThan(MAX_HOST_LENGTH);
    expect(normalkanHost(panjang)).toBeNull();
  });
});

describe('host yang tidak boleh dipakai mencari', () => {
  it('menolak localhost dan alamat metadata awan', () => {
    /*
     * Bila salah satunya sempat terdaftar — karena kekeliruan pengembangan
     * yang terbawa ke produksi — permintaan dari dalam mesin sendiri akan
     * memperoleh konteks penyewa sungguhan.
     */
    for (const h of HOST_TERLARANG) {
      expect({ h, allowed: bolehDipakaiMencari(h).allowed }).toEqual({ h, allowed: false });
    }
  });

  it('menolak alamat IP', () => {
    // Menandakan permintaan yang menembus pengarah, bukan pengunjung biasa.
    expect(bolehDipakaiMencari('203.0.113.10').code).toBe('HOST_IS_IP');
  });

  it('menolak host tanpa titik', () => {
    expect(bolehDipakaiMencari('koperasi').code).toBe('HOST_NO_DOT');
  });

  it('menolak null', () => {
    expect(bolehDipakaiMencari(null).allowed).toBe(false);
  });

  it('menerima host biasa', () => {
    expect(bolehDipakaiMencari('koperasi.ekoperasi.id').allowed).toBe(true);
  });

  it('seluruh penolakan berbunyi sama', () => {
    for (const h of [null, 'localhost', '203.0.113.10', 'koperasi']) {
      const v = bolehDipakaiMencari(h);
      expect({ h, pesan: v.message }).toEqual({ h, pesan: 'Situs tidak ditemukan.' });
    }
  });
});

describe('kelayakan pencocokan', () => {
  const domain = (over: Partial<BarisDomain> = {}): BarisDomain => ({
    host: 'koperasi.ekoperasi.id',
    tenantId: 'T1',
    vertical: 'cooperative',
    status: 'ACTIVE',
    verifiedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  });

  const registry = (over: Partial<BarisRegistry> = {}): BarisRegistry => ({
    tenantId: 'T1',
    schemaName: 'koperasi_maju',
    status: 'READY',
    ...over,
  });

  it('mengizinkan pencocokan yang sah', () => {
    expect(bolehMemakaiPencocokan(domain(), registry()).allowed).toBe(true);
  });

  it('menolak host yang tidak terdaftar', () => {
    expect(bolehMemakaiPencocokan(null, registry()).code).toBe('DOMAIN_NOT_REGISTERED');
  });

  it('menolak domain yang BELUM terbukti dimiliki penyewanya', () => {
    /*
     * Tanpa ini, siapa pun dapat mendaftarkan host milik orang lain dan
     * memperoleh permintaan yang ditujukan ke sana — beserta konteks
     * penyewanya.
     */
    expect(bolehMemakaiPencocokan(domain({ verifiedAt: null }), registry()).code).toBe(
      'DOMAIN_NOT_VERIFIED',
    );
  });

  it('menolak domain nonaktif', () => {
    expect(bolehMemakaiPencocokan(domain({ status: 'SUSPENDED' }), registry()).code).toBe(
      'DOMAIN_NOT_ACTIVE',
    );
  });

  it('menolak penyewa yang belum tersedia skemanya', () => {
    expect(bolehMemakaiPencocokan(domain(), null).code).toBe('TENANT_NOT_PROVISIONED');
  });

  it('menolak penyewa yang belum atau tidak lagi siap', () => {
    for (const status of ['RESERVED', 'PROVISIONING', 'SUSPENDED', 'FAILED']) {
      expect({ status, code: bolehMemakaiPencocokan(domain(), registry({ status })).code }).toEqual(
        { status, code: 'TENANT_NOT_READY' },
      );
    }
  });

  it('menolak penyewa yang sedang BERMIGRASI', () => {
    /*
     * Melayani pengunjung dari skema yang sedang bermigrasi berarti membaca
     * tabel yang mungkin baru separuh berubah — halaman yang salah tanpa satu
     * pun galat.
     */
    expect(bolehMemakaiPencocokan(domain(), registry({ status: 'MIGRATING' })).code).toBe(
      'TENANT_NOT_READY',
    );
  });

  it('status yang diterima memakai nilai enum yang sungguhan ada', () => {
    // Cacat yang pernah terjadi: pemeriksaan mencari 'ACTIVE', sedangkan enum
    // TenantSchemaStatus tidak pernah memuat nilai itu — sehingga setiap
    // penyewa ditolak.
    expect([...STATUS_REGISTRY_SIAP]).toEqual(['READY']);
  });

  it('menolak bila registry milik penyewa lain', () => {
    // Menandakan pemetaan yang rusak. Meloloskannya berarti melayani satu
    // penyewa dengan data penyewa lain.
    expect(bolehMemakaiPencocokan(domain(), registry({ tenantId: 'T2' })).code).toBe(
      'TENANT_MISMATCH',
    );
  });

  it('memeriksa BENTUK nama skema meski datang dari registry', () => {
    /*
     * Penjaga terakhir. Nilai ini disisipkan ke dalam SQL sebagai pengenal,
     * dan pengenal tidak dapat diparameterkan — jadi bentuknya diperiksa
     * meskipun sumbernya dipercaya.
     */
    for (const nama of ['Koperasi', 'ko', 'koperasi;drop', 'koperasi maju', '1koperasi']) {
      expect({
        nama,
        code: bolehMemakaiPencocokan(domain(), registry({ schemaName: nama })).code,
      }).toEqual({ nama, code: 'SCHEMA_NAME_INVALID' });
    }
  });

  it('menolak nama skema yang BENTUKNYA sah tetapi terlarang', () => {
    /*
     * `public` memenuhi pola nama skema sepenuhnya, dan justru itulah yang
     * berbahaya: aturan tetap proyek melarangnya menjadi skema penyewa maupun
     * cadangan search_path. Satu baris registry yang keliru akan mengarahkan
     * permintaan dari internet ke skema yang isinya milik semua orang.
     */
    for (const nama of SKEMA_TERLARANG) {
      if (!/^[a-z][a-z0-9_]{2,63}$/.test(nama)) continue;
      expect({
        nama,
        code: bolehMemakaiPencocokan(domain(), registry({ schemaName: nama })).code,
      }).toEqual({ nama, code: 'SCHEMA_NAME_RESERVED' });
    }
  });

  it('seluruh penolakan berbunyi sama', () => {
    /*
     * Pengunjung yang menebak tidak boleh dapat membedakan "host tidak
     * terdaftar" dari "host terdaftar tetapi penyewanya nonaktif" —
     * perbedaan itu sendiri sudah merupakan keterangan.
     */
    const kasus = [
      bolehMemakaiPencocokan(null, null),
      bolehMemakaiPencocokan(domain({ verifiedAt: null }), registry()),
      bolehMemakaiPencocokan(domain({ status: 'SUSPENDED' }), registry()),
      bolehMemakaiPencocokan(domain(), registry({ status: 'SUSPENDED' })),
      bolehMemakaiPencocokan(domain(), registry({ tenantId: 'T2' })),
    ];
    for (const v of kasus) expect(v.message).toBe('Situs tidak ditemukan.');
  });
});

describe('vertikal', () => {
  const d: BarisDomain = {
    host: 'koperasi.ekoperasi.id',
    tenantId: 'T1',
    vertical: 'cooperative',
    status: 'ACTIVE',
    verifiedAt: '2026-07-01T00:00:00.000Z',
  };

  it('melayani vertikal yang sesuai', () => {
    expect(bolehMelayaniVertikal(d, 'cooperative').allowed).toBe(true);
  });

  it('MENOLAK vertikal lain pada host yang sama', () => {
    /*
     * Situs koperasi tidak boleh melayani permintaan klinik hanya karena
     * penyewanya sama — keduanya punya pembaca, isi, dan aturan cakupan data
     * yang berbeda.
     */
    expect(bolehMelayaniVertikal(d, 'health').code).toBe('VERTICAL_MISMATCH');
  });
});

describe('kunci penyimpanan', () => {
  it('memakai penormal yang sama dengan pembacaan', () => {
    /*
     * Penyimpanan dan pembacaan yang memakai penormal berbeda menghasilkan
     * baris yang tersimpan tetapi tidak pernah ditemukan — dan gejalanya
     * hanyalah situs yang "tidak bekerja", tanpa galat apa pun.
     */
    expect(kunciSimpanan('  Koperasi.EKoperasi.ID:443 ')).toBe('koperasi.ekoperasi.id');
  });

  it('menolak host yang tidak boleh dipakai mencari', () => {
    expect(kunciSimpanan('localhost')).toBeNull();
    expect(kunciSimpanan('203.0.113.10')).toBeNull();
  });

  it('menolak host yang bentuknya tidak sah', () => {
    expect(kunciSimpanan('koperasi..id')).toBeNull();
  });
});
