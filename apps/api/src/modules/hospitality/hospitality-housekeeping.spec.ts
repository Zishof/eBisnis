import { statusTujuanUntukAksi, transisiTugasHkDiizinkan, workloadPoints } from './hospitality-housekeeping';

describe('hospitality housekeeping domain', () => {
  it('menjaga urutan kerja dan rework inspeksi', () => {
    expect(transisiTugasHkDiizinkan('ASSIGNED','IN_PROGRESS')).toBe(true);
    expect(transisiTugasHkDiizinkan('IN_PROGRESS','COMPLETED')).toBe(true);
    expect(transisiTugasHkDiizinkan('INSPECTION_REQUIRED','IN_PROGRESS')).toBe(true);
    expect(transisiTugasHkDiizinkan('CLOSED','IN_PROGRESS')).toBe(false);
    expect(statusTujuanUntukAksi('INSPECT_FAIL')).toBe('IN_PROGRESS');
  });
  it('menghitung beban checkout, ukuran, VIP, dan due-in secara deterministik', () => {
    expect(workloadPoints('CHECKOUT', 45, true, true)).toBe(11);
    expect(workloadPoints('STAYOVER', 20, false, false)).toBe(3);
  });
});

