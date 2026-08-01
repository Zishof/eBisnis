/**
 * Pengujian aturan host portal.
 *
 * Pemetaan host menentukan merek dan konten apa yang tampil kepada publik, dan
 * pada jalur identitas juga menentukan penerbit mana yang dipercaya. Kesalahan
 * di sini tidak menghasilkan galat — ia menghasilkan halaman yang salah, atau
 * halaman yang tidak pernah muncul.
 */

import {
  LABEL_TERPESAN,
  bolehMencariPortal,
  domainBolehMelayani,
  peranCocok,
  slugPenyewaBoleh,
  tautanKanonik,
  type BarisPortalDomain,
} from './portal-host';

const aktif = (ubah: Partial<BarisPortalDomain> = {}): BarisPortalDomain => ({
  host: 'ebisnis.id',
  kind: 'PUBLIC',
  status: 'ACTIVE',
  verifiedAt: new Date('2026-01-01T00:00:00Z'),
  isCanonical: true,
  ...ubah,
});

describe('slug penyewa', () => {
  it('menolak seluruh label terpesan', () => {
    /*
     * Bukan soal kerapian penamaan. Bila `auth` boleh dipakai penyewa, ia dapat
     * mendaftarkan `auth.ebisnis.id` dan menerima permintaan yang ditujukan
     * kepada penerbit identitas — termasuk kode otorisasi yang sedang
     * dipertukarkan.
     */
    for (const label of LABEL_TERPESAN) {
      expect(slugPenyewaBoleh(label).boleh).toBe(false);
      expect(slugPenyewaBoleh(label).kode).toBe('SLUG_TERPESAN');
    }
  });

  it('menolak terpesan meski ditulis huruf besar', () => {
    // Pemeriksaan yang peka huruf besar-kecil hanya menunda masalahnya.
    expect(slugPenyewaBoleh('AUTH').boleh).toBe(false);
    expect(slugPenyewaBoleh('  Api  ').boleh).toBe(false);
  });

  it('menerima slug wajar', () => {
    for (const s of ['mitrasehat', 'koperasi-albahjah', 'sukoanyar', 'a1']) {
      expect(slugPenyewaBoleh(s).boleh).toBe(true);
    }
  });

  it('menolak bentuk yang bukan label DNS', () => {
    for (const s of ['', '-awal', 'akhir-', 'ada spasi', 'huruf_garis', 'a'.repeat(64)]) {
      expect(slugPenyewaBoleh(s).boleh).toBe(false);
    }
  });
});

describe('boleh mencari portal', () => {
  it('host wajar diterima', () => {
    expect(bolehMencariPortal('EBISNIS.ID').boleh).toBe(true);
    expect(bolehMencariPortal('emedik.id:443').boleh).toBe(true);
  });

  it('host terlarang ditolak sebelum menyentuh basis data', () => {
    // Yang ditolak di sini tidak pernah menjadi kueri, sehingga tidak ada yang
    // dapat disimpulkan dari lama jawabannya.
    for (const h of ['localhost', '127.0.0.1', '169.254.169.254']) {
      expect(bolehMencariPortal(h).boleh).toBe(false);
    }
  });

  it('host kosong atau tidak sah ditolak', () => {
    expect(bolehMencariPortal(undefined).boleh).toBe(false);
    expect(bolehMencariPortal('').boleh).toBe(false);
  });

  it('penolakan memakai pesan yang sama', () => {
    // Pengunjung yang menebak tidak boleh dapat membedakan sebab penolakan.
    const a = bolehMencariPortal('localhost');
    const b = bolehMencariPortal('');
    expect(a.pesan).toBe(b.pesan);
  });
});

describe('domain boleh melayani', () => {
  it('aktif dan terverifikasi boleh', () => {
    expect(domainBolehMelayani(aktif()).boleh).toBe(true);
  });

  it('status selain ACTIVE tidak melayani', () => {
    for (const s of ['PENDING', 'SUSPENDED', 'REVOKED']) {
      expect(domainBolehMelayani(aktif({ status: s })).boleh).toBe(false);
    }
  });

  it('AKTIF TANPA verifikasi tetap tidak melayani', () => {
    /*
     * Basis data sudah menolaknya lewat CHECK. Ini pertahanan kedua: baris yang
     * masuk lewat jalur mana pun — pemulihan cadangan, penyuntingan manual,
     * migrasi yang keliru — tetap tidak melayani apa pun.
     */
    expect(domainBolehMelayani(aktif({ verifiedAt: null })).boleh).toBe(false);
  });

  it('seluruh penolakan memakai pesan yang sama', () => {
    const a = domainBolehMelayani(aktif({ status: 'SUSPENDED' }));
    const b = domainBolehMelayani(aktif({ verifiedAt: null }));
    expect(a.pesan).toBe(b.pesan);
  });
});

describe('peran host', () => {
  it('host publik tidak melayani permintaan identitas', () => {
    /*
     * Host `PUBLIC` tidak boleh melayani pertukaran kode otorisasi, dan host
     * `AUTH` tidak boleh menyajikan halaman pemasaran. Memisahkannya membuat
     * satu host yang bocor tidak sekaligus membocorkan keduanya.
     */
    expect(peranCocok(aktif({ kind: 'PUBLIC' }), 'AUTH').boleh).toBe(false);
    expect(peranCocok(aktif({ kind: 'AUTH' }), 'PUBLIC').boleh).toBe(false);
  });

  it('peran yang cocok diterima', () => {
    expect(peranCocok(aktif({ kind: 'APP' }), 'APP').boleh).toBe(true);
  });
});

describe('tautan kanonik', () => {
  it('memilih host kanonik, bukan yang pertama', () => {
    // Tautan lintas portal yang memakai host non-kanonik menghasilkan konten
    // ganda di mata mesin pencari (§1683).
    const t = tautanKanonik([
      aktif({ host: 'www.ebisnis.id', isCanonical: false }),
      aktif({ host: 'ebisnis.id', isCanonical: true }),
    ]);
    expect(t).toBe('https://ebisnis.id');
  });

  it('selalu https', () => {
    expect(tautanKanonik([aktif()])).toMatch(/^https:\/\//);
  });

  it('mengabaikan host yang tidak melayani', () => {
    const t = tautanKanonik([
      aktif({ host: 'lama.ebisnis.id', isCanonical: true, status: 'REVOKED' }),
      aktif({ host: 'ebisnis.id', isCanonical: false }),
    ]);
    expect(t).toBe('https://ebisnis.id');
  });

  it('null bila tidak ada host yang layak', () => {
    // Null, bukan menebak host dari kode portal: tautan yang ditebak akan
    // mengarah ke tempat yang belum tentu dilayani siapa pun.
    expect(tautanKanonik([aktif({ status: 'PENDING' })])).toBeNull();
    expect(tautanKanonik([])).toBeNull();
  });

  it('memisahkan peran saat memilih', () => {
    const domains = [
      aktif({ host: 'app.ebisnis.id', kind: 'APP', isCanonical: true }),
      aktif({ host: 'ebisnis.id', kind: 'PUBLIC', isCanonical: true }),
    ];
    expect(tautanKanonik(domains, 'PUBLIC')).toBe('https://ebisnis.id');
    expect(tautanKanonik(domains, 'APP')).toBe('https://app.ebisnis.id');
  });
});
