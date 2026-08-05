import { describe, expect, it } from 'vitest';
import { emedikPublicBrandFor } from '../public/emedik-host';
import { registerStepLabels } from './RegisterPage';

describe('registerStepLabels', () => {
  it('mengganti istilah bisnis umum pada host eMedik', () => {
    const labels = registerStepLabels(emedikPublicBrandFor('demo.emedik.id'), (key) => key);

    expect(labels).toEqual(['Profil Fasilitas', 'Lokasi layanan', 'Kontak PIC', 'Akun fasilitas']);
    expect(labels).not.toContain('register.stepBusiness');
  });

  it('mengganti istilah bisnis umum pada host apotik', () => {
    const labels = registerStepLabels(emedikPublicBrandFor('demo-apotik.emedik.id'), (key) => key);

    expect(labels).toEqual(['Profil Apotik', 'Lokasi layanan', 'Kontak farmasi', 'Akun apotik']);
    expect(labels).not.toContain('register.stepBusiness');
  });
});
