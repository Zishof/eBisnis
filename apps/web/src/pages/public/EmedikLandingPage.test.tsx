import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { LandingHeader } from './EmedikLandingPage';

describe('LandingHeader', () => {
  it('menampilkan identitas apotik tanpa kembali ke logo eMedik generik', () => {
    render(
      <MemoryRouter>
        <LandingHeader
          brand="Sehatjaya Apotik"
          logoText="Rx"
          tone="emerald"
          links={['Farmasi', 'POS Apotik']}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sehatjaya Apotik')).toBeInTheDocument();
    expect(screen.getByText('Rx')).toHaveClass('bg-emerald-700');
    expect(screen.queryByText('eM')).not.toBeInTheDocument();
  });
});
