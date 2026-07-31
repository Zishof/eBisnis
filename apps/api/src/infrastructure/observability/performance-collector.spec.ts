/**
 * Pengujian pengumpul metrik kinerja.
 *
 * Yang diuji di sini bukan bahwa angkanya tersimpan, melainkan bahwa angkanya
 * berarti: jendela yang selaras, penghitung yang menangkap timer, dan agregat
 * yang tidak hilang saat ditulis.
 */

import { alignToWindow, countHandles, countRequests, WINDOW_MINUTES } from './performance-collector.service';

describe('alignToWindow', () => {
  it('membulatkan ke bawah menuju awal jendela', () => {
    expect(alignToWindow(new Date('2026-07-31T10:07:43.512Z'), 5).toISOString()).toBe(
      '2026-07-31T10:05:00.000Z',
    );
    expect(alignToWindow(new Date('2026-07-31T10:00:00.000Z'), 5).toISOString()).toBe(
      '2026-07-31T10:00:00.000Z',
    );
    expect(alignToWindow(new Date('2026-07-31T10:04:59.999Z'), 5).toISOString()).toBe(
      '2026-07-31T10:00:00.000Z',
    );
  });

  it('menghasilkan awal jendela yang sama untuk dua waktu dalam jendela yang sama', () => {
    // Inilah sifat yang membuat upsert bekerja: dua proses yang menulis pada
    // jendela sama harus menyepakati kuncinya tanpa berkoordinasi.
    const a = alignToWindow(new Date('2026-07-31T10:01:00.000Z'));
    const b = alignToWindow(new Date('2026-07-31T10:04:30.000Z'));
    expect(a.getTime()).toBe(b.getTime());
  });

  it('tidak pernah menghasilkan waktu di masa depan', () => {
    const sekarang = new Date('2026-07-31T10:07:43.512Z');
    expect(alignToWindow(sekarang).getTime()).toBeLessThanOrEqual(sekarang.getTime());
  });

  it('memakai lebar jendela bawaan bila tidak disebut', () => {
    const t = new Date('2026-07-31T10:07:43.512Z');
    expect(alignToWindow(t).getTime()).toBe(alignToWindow(t, WINDOW_MINUTES).getTime());
  });
});

describe('countHandles', () => {
  it('menghitung timer, bukan hanya socket', async () => {
    /*
     * Ini alasan `process._getActiveHandles()` ditinggalkan.
     *
     * API internal itu tidak menghitung timer sama sekali. `setInterval` yang
     * tidak pernah dibersihkan adalah salah satu bentuk kebocoran paling sering,
     * dan bila tidak terhitung maka heuristiknya akan melihat angka tetap lalu
     * menyimpulkan NORMAL — persis pada kasus yang paling perlu terdeteksi.
     */
    const sebelum = countHandles();

    const timer: NodeJS.Timeout[] = [];
    for (let i = 0; i < 10; i += 1) timer.push(setInterval(() => undefined, 60_000));

    const sesudah = countHandles();
    for (const t of timer) clearInterval(t);

    expect(sesudah - sebelum).toBeGreaterThanOrEqual(10);
  });

  it('kembali turun setelah timer dibersihkan', async () => {
    const dasar = countHandles();
    const timer = setInterval(() => undefined, 60_000);
    expect(countHandles()).toBeGreaterThan(dasar);
    clearInterval(timer);
    // Satu putaran event loop supaya pembersihan tercatat.
    await new Promise((resolve) => setImmediate(resolve));
    expect(countHandles()).toBeLessThanOrEqual(dasar + 1);
  });

  it('tidak pernah melempar', () => {
    expect(() => countHandles()).not.toThrow();
    expect(() => countRequests()).not.toThrow();
  });

  it('menghasilkan bilangan bulat tak negatif', () => {
    expect(Number.isInteger(countHandles())).toBe(true);
    expect(countHandles()).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(countRequests())).toBe(true);
    expect(countRequests()).toBeGreaterThanOrEqual(0);
  });
});
