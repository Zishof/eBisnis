import { describe, expect, it } from 'vitest';
import { emedikPublicBrandFor } from '../public/emedik-host';
import { registerSuccessCopy } from './RegisterSuccessPage';

describe('registerSuccessCopy', () => {
  it('menjelaskan ruang kerja fasilitas kesehatan yang baru dibuat', () => {
    const copy = registerSuccessCopy(emedikPublicBrandFor('demo.emedik.id'), (key) => key);

    expect(copy.title).toBe('Demo eMedik berhasil disiapkan');
    expect(copy.subtitle).toContain('fasilitas kesehatan');
    expect(copy.subtitle).toContain('farmasi');
  });

  it('menjelaskan ruang kerja apotik dan POS Apotik yang baru dibuat', () => {
    const copy = registerSuccessCopy(emedikPublicBrandFor('demo-apotik.emedik.id'), (key) => key);

    expect(copy.title).toBe('Demo Apotik eMedik berhasil disiapkan');
    expect(copy.subtitle).toContain('Ruang kerja apotik');
    expect(copy.subtitle).toContain('POS Apotik');
  });
});
