import { describe, expect, it } from 'vitest';
import { id } from '../i18n/locales/id';
import { en } from '../i18n/locales/en';
import { ar } from '../i18n/locales/ar';
import { zhCN } from '../i18n/locales/zh-CN';
import { SUPPORTED_LOCALES, applyLocaleDirection } from '../i18n';

function flatten(source: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(source).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value as Record<string, unknown>, path)
      : [path];
  });
}

describe('katalog terjemahan', () => {
  const baseline = flatten(id).sort();

  it.each([
    ['en', en],
    ['ar', ar],
    ['zh-CN', zhCN],
  ])('locale %s memiliki seluruh kunci yang ada pada id', (_code, catalog) => {
    const keys = new Set(flatten(catalog as Record<string, unknown>));
    const missing = baseline.filter((key) => !keys.has(key));
    expect(missing).toEqual([]);
  });

  it('tidak memiliki kunci berlebih pada locale lain', () => {
    const baseSet = new Set(baseline);
    for (const catalog of [en, ar, zhCN]) {
      const extra = flatten(catalog as Record<string, unknown>).filter((key) => !baseSet.has(key));
      expect(extra).toEqual([]);
    }
  });
});

describe('arah teks', () => {
  it('bahasa Arab memakai RTL, lainnya LTR', () => {
    expect(SUPPORTED_LOCALES.find((l) => l.code === 'ar')?.dir).toBe('rtl');
    expect(SUPPORTED_LOCALES.filter((l) => l.code !== 'ar').every((l) => l.dir === 'ltr')).toBe(true);
  });

  it('applyLocaleDirection menyetel atribut dokumen', () => {
    applyLocaleDirection('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');

    applyLocaleDirection('id');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('id');
  });

  it('locale tidak dikenal jatuh ke bahasa Indonesia', () => {
    applyLocaleDirection('xx-YY');
    expect(document.documentElement.lang).toBe('id');
  });
});
