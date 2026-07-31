import { cacheHitRatio } from './query-stats.adapter';
import { alignToWindow, WINDOW_MINUTES } from './performance-collector.service';

describe('rasio cache', () => {
  it('menghitung rasio dari blok yang dibaca', () => {
    expect(cacheHitRatio(900, 100)).toBe(0.9);
  });

  it('mengembalikan null untuk kueri yang tidak menyentuh blok', () => {
    // Mengembalikan 1 akan menyiratkan kondisi sempurna yang tidak pernah
    // diukur.
    expect(cacheHitRatio(0, 0)).toBeNull();
  });

  it('menghasilkan nol ketika seluruhnya dibaca dari cakram', () => {
    expect(cacheHitRatio(0, 500)).toBe(0);
  });

  it('menghasilkan satu ketika seluruhnya dari cache', () => {
    expect(cacheHitRatio(500, 0)).toBe(1);
  });
});

describe('penyelarasan jendela agregasi', () => {
  it('membulatkan ke awal jendela', () => {
    const hasil = alignToWindow(new Date('2026-07-31T10:07:33.500Z'));
    expect(hasil.toISOString()).toBe('2026-07-31T10:05:00.000Z');
  });

  it('membiarkan waktu yang sudah pas', () => {
    const hasil = alignToWindow(new Date('2026-07-31T10:05:00.000Z'));
    expect(hasil.toISOString()).toBe('2026-07-31T10:05:00.000Z');
  });

  it('menempatkan dua permintaan dalam jendela yang sama', () => {
    // Ini yang membuat agregat dapat digabungkan: dua permintaan pada menit
    // berbeda dalam satu jendela harus menghasilkan kunci yang sama.
    const a = alignToWindow(new Date('2026-07-31T10:06:00Z'));
    const b = alignToWindow(new Date('2026-07-31T10:09:59Z'));
    expect(a.getTime()).toBe(b.getTime());
  });

  it('memisahkan jendela yang berbeda', () => {
    const a = alignToWindow(new Date('2026-07-31T10:09:59Z'));
    const b = alignToWindow(new Date('2026-07-31T10:10:00Z'));
    expect(a.getTime()).not.toBe(b.getTime());
  });

  it('memakai lebar jendela yang dinyatakan', () => {
    expect(WINDOW_MINUTES).toBeGreaterThan(0);
    const hasil = alignToWindow(new Date('2026-07-31T10:07:00Z'), 15);
    expect(hasil.toISOString()).toBe('2026-07-31T10:00:00.000Z');
  });
});
