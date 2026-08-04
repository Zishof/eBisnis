import { describe, expect, it } from 'vitest';
import { educationPublicBrandFor, isEducationPublicHost } from './education-host';

describe('education public host', () => {
  it('mengenali apex dan www enterprise-education.id', () => {
    expect(isEducationPublicHost('enterprise-education.id')).toBe(true);
    expect(isEducationPublicHost('www.enterprise-education.id')).toBe(true);
    expect(isEducationPublicHost('enterprise-education.id:443')).toBe(true);
  });

  it('menolak host lain yang hanya memuat nama domain', () => {
    expect(isEducationPublicHost('enterprise-education.id.evil.test')).toBe(false);
    expect(isEducationPublicHost('santri.info')).toBe(false);
    expect(isEducationPublicHost('ebisnis.id')).toBe(false);
  });

  it('memberikan brand khusus pendidikan hanya untuk domain pendidikan', () => {
    expect(educationPublicBrandFor('enterprise-education.id')?.name).toBe('Enterprise Education');
    expect(educationPublicBrandFor('ebisnis.id')).toBeNull();
  });
});
