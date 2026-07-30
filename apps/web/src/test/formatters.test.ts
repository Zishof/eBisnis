import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../lib/api';

/**
 * Intl memakai non-breaking space (U+00A0) dan narrow no-break space (U+202F)
 * sebagai pemisah simbol mata uang. Assertion memakai spasi biasa agar stabil
 * di seluruh versi ICU.
 */
function normalizeSpaces(value: string): string {
  const nbsp = String.fromCharCode(0x00a0);
  const narrowNbsp = String.fromCharCode(0x202f);
  return value.split(nbsp).join(' ').split(narrowNbsp).join(' ');
}

describe('formatMoney', () => {
  it('memformat rupiah tanpa desimal', () => {
    // Nilai dari API selalu string decimal.
    expect(normalizeSpaces(formatMoney('250000'))).toBe('Rp 250.000');
  });

  it('memformat mata uang dengan desimal untuk non-IDR', () => {
    expect(normalizeSpaces(formatMoney('19.99', 'USD', 'en-US'))).toBe('$19.99');
  });

  it('mengembalikan strip untuk nilai tidak valid', () => {
    expect(formatMoney('bukan angka')).toBe('-');
    expect(normalizeSpaces(formatMoney(null))).toBe('Rp 0');
  });
});

describe('formatNumber', () => {
  it('memakai pemisah ribuan Indonesia', () => {
    expect(formatNumber('1234567')).toBe('1.234.567');
  });

  it('mempertahankan pecahan kuantitas stok', () => {
    expect(formatNumber('12.5')).toBe('12,5');
  });
});

describe('formatDate', () => {
  it('mengembalikan strip untuk nilai kosong', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDateTime(undefined)).toBe('-');
  });

  it('mengembalikan strip untuk tanggal tidak valid', () => {
    expect(formatDate('bukan tanggal')).toBe('-');
  });

  it('memformat tanggal ISO', () => {
    expect(formatDate('2026-07-30T00:00:00.000Z')).toMatch(/2026/);
  });
});
