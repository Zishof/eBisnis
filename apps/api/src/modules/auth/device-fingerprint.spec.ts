import { describeDevice, fingerprintDevice } from './device-fingerprint';

// User agent nyata, dipakai apa adanya supaya pengujian ini menguji dunia yang
// sebenarnya dan bukan dunia yang saya bayangkan.
const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const EDGE_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0';
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';

describe('describeDevice', () => {
  it('membedakan Edge dari Chrome meski Edge menyebut dirinya Chrome', () => {
    // Inilah alasan urutan pemeriksaan penting. Diperiksa dengan urutan yang
    // salah, seluruh peramban akan dilaporkan sebagai Safari.
    expect(describeDevice(EDGE_WINDOWS)).toBe('Edge di Windows');
    expect(describeDevice(CHROME_WINDOWS)).toBe('Chrome di Windows');
  });

  it('mengenali Safari di iOS, bukan macOS', () => {
    // User agent iPhone memuat "like Mac OS X"; yang benar tetap iOS.
    expect(describeDevice(SAFARI_IOS)).toBe('Safari di iOS');
  });

  it('mengenali Firefox di Linux', () => {
    expect(describeDevice(FIREFOX_LINUX)).toBe('Firefox di Linux');
  });

  it('mengenali alat baris perintah', () => {
    expect(describeDevice('curl/8.4.0')).toBe('curl');
    expect(describeDevice('PostmanRuntime/7.36.0')).toBe('Postman');
  });

  it('memotong user agent yang tidak dikenali alih-alih menyebut "tidak diketahui"', () => {
    const aneh = 'AlatInternalPerusahaan/2.1 (build 8842; modul sinkronisasi malam)';
    const hasil = describeDevice(aneh);
    expect(hasil.length).toBeLessThanOrEqual(60);
    expect(aneh.startsWith(hasil)).toBe(true);
  });
});

describe('fingerprintDevice', () => {
  it('tidak menyimpan user agent mentah pada sidiknya', () => {
    // Sifat inti: sidik tidak boleh dapat dibaca balik menjadi user agent.
    const { fingerprint } = fingerprintDevice(CHROME_WINDOWS);
    expect(fingerprint).not.toBeNull();
    expect(fingerprint).not.toContain('Windows');
    expect(fingerprint).not.toContain('Chrome');
    expect(fingerprint).toMatch(/^[0-9a-f]{32}$/);
  });

  it('user agent yang sama menghasilkan sidik yang sama', () => {
    expect(fingerprintDevice(CHROME_WINDOWS).fingerprint).toBe(
      fingerprintDevice(CHROME_WINDOWS).fingerprint,
    );
  });

  it('user agent berbeda menghasilkan sidik berbeda', () => {
    expect(fingerprintDevice(CHROME_WINDOWS).fingerprint).not.toBe(
      fingerprintDevice(EDGE_WINDOWS).fingerprint,
    );
  });

  it('perbedaan versi menghasilkan sidik berbeda', () => {
    /*
     * Ini bukan cacat, melainkan alasan sidik ini TIDAK dipakai sebagai penjaga.
     *
     * Peramban memperbarui dirinya sendiri, dan setiap pembaruan mengubah user
     * agent sehingga mengubah sidiknya. Penjaga yang memakai sidik ini akan
     * mengunci orang keluar dari akunnya sendiri pada hari Chrome naik versi.
     * Gunanya hanya mengelompokkan sesi pada daftar.
     */
    const lama = CHROME_WINDOWS;
    const baru = CHROME_WINDOWS.replace('131.0.0.0', '132.0.0.0');
    expect(fingerprintDevice(lama).fingerprint).not.toBe(fingerprintDevice(baru).fingerprint);
    // Labelnya tetap sama — dan itulah yang dilihat pengguna.
    expect(fingerprintDevice(lama).label).toBe(fingerprintDevice(baru).label);
  });

  it('tanpa user agent menghasilkan null, bukan galat', () => {
    expect(fingerprintDevice(undefined)).toEqual({ fingerprint: null, label: null });
    expect(fingerprintDevice(null)).toEqual({ fingerprint: null, label: null });
    expect(fingerprintDevice('')).toEqual({ fingerprint: null, label: null });
  });

  it('sidiknya muat pada kolom varchar(64)', () => {
    expect(fingerprintDevice(CHROME_WINDOWS).fingerprint!.length).toBeLessThanOrEqual(64);
  });

  it('labelnya muat pada kolom varchar(128)', () => {
    const panjang = 'X'.repeat(5000);
    expect(fingerprintDevice(panjang).label!.length).toBeLessThanOrEqual(128);
  });
});
