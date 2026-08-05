import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { HealthOperationalModulePage } from './HealthOperationalModulePage';

describe('HealthOperationalModulePage', () => {
  it('menampilkan command center mobile-friendly untuk rute klinis yang belum spesifik penuh', () => {
    render(
      <MemoryRouter initialEntries={['/app/emedik/operasi']}>
        <HealthOperationalModulePage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Command Center Rawat Inap dan Akut').length).toBeGreaterThan(0);
    expect(screen.getByText('Operasi aman')).toBeInTheDocument();
    expect(screen.getByText('Prioritas shift')).toBeInTheDocument();
    expect(screen.getByText('Demo, bukan data pasien asli')).toBeInTheDocument();
  });
});
