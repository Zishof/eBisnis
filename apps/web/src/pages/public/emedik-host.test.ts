import { describe, expect, it } from 'vitest';
import {
  emedikPublicBrandFor,
  isApotikHost,
  isDemoApotikHost,
  isEmedikHost,
  rootExperienceFor,
} from './emedik-host';

describe('host publik eMedik', () => {
  it('mengenali portal utama eMedik', () => {
    expect(isEmedikHost('emedik.id')).toBe(true);
    expect(isEmedikHost('www.emedik.id')).toBe(true);
    expect(isEmedikHost('apotik.emedik.id')).toBe(false);
  });

  it('mengenali landing apotik dan tenant apotik', () => {
    expect(isApotikHost('apotik.emedik.id')).toBe(true);
    expect(isApotikHost('demo-apotik.emedik.id')).toBe(true);
    expect(isApotikHost('sehatjaya-apotik.emedik.id')).toBe(true);
    expect(isApotikHost('kliniksehat.emedik.id')).toBe(false);
  });

  it('mengenali demo apotik secara khusus', () => {
    expect(isDemoApotikHost('demo-apotik.emedik.id')).toBe(true);
    expect(isDemoApotikHost('apotik.emedik.id')).toBe(false);
  });

  it('memilih pengalaman akar tanpa menyentuh path lain', () => {
    expect(rootExperienceFor('emedik.id', '/')).toBe('emedik');
    expect(rootExperienceFor('apotik.emedik.id', '/')).toBe('apotik');
    expect(rootExperienceFor('demo-apotik.emedik.id', '/')).toBe('demo-apotik');
    expect(rootExperienceFor('demo-apotik.emedik.id', '/masuk')).toBeNull();
    expect(rootExperienceFor('ebisnis.id', '/')).toBeNull();
  });

  it('tidak mencari kata apotik di tengah host asing', () => {
    expect(isApotikHost('evil-apotik.emedik.id.evil.com')).toBe(false);
    expect(isApotikHost('x-apotik.evil.com')).toBe(false);
  });

  it('memberi brand publik sesuai host tanpa kembali ke eBisnis', () => {
    expect(emedikPublicBrandFor('emedik.id')?.name).toBe('eMedik.id');
    expect(emedikPublicBrandFor('emedik.id')?.homeUrl).toBe('https://emedik.id');
    expect(emedikPublicBrandFor('apotik.emedik.id')?.name).toBe('Apotik eMedik');
    expect(emedikPublicBrandFor('apotik.emedik.id')?.homeUrl).toBe('https://apotik.emedik.id');
    expect(emedikPublicBrandFor('demo-apotik.emedik.id')?.homeUrl).toBe('https://apotik.emedik.id');
    expect(emedikPublicBrandFor('sehatjaya-apotik.emedik.id')?.homeUrl).toBe('https://apotik.emedik.id');
    expect(emedikPublicBrandFor('ebisnis.id')).toBeNull();
  });
});
