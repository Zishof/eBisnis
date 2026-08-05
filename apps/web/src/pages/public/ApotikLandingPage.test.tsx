import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApotikLandingPage } from './ApotikLandingPage';

function setHost(hostname: string) {
  vi.stubGlobal('location', {
    ...window.location,
    hostname,
    href: `https://${hostname}/`,
  });
}

describe('ApotikLandingPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('menjaga apotik.emedik.id sebagai landing produk platform Apotik eMedik', () => {
    setHost('apotik.emedik.id');

    render(
      <MemoryRouter>
        <ApotikLandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /Apotik modern untuk resep/i })).toBeInTheDocument();
    expect(screen.getByText('Daftarkan apotik')).toBeInTheDocument();
    expect(screen.queryByText('Katalog produk tenant')).not.toBeInTheDocument();
  });

  it('menjadikan subdomain tenant apotik sebagai profil dan katalog produk tenant', () => {
    setHost('sehatjaya-apotik.emedik.id');

    render(
      <MemoryRouter>
        <ApotikLandingPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Sehatjaya Apotik').length).toBeGreaterThan(0);
    expect(screen.getByText('Profil tenant apotik')).toBeInTheDocument();
    expect(screen.getByText('Katalog produk tenant')).toBeInTheDocument();
    expect(screen.getByText('Paracetamol 500 mg')).toBeInTheDocument();
    expect(screen.getByText('Antibiotik sesuai resep')).toBeInTheDocument();
    expect(screen.getByAltText('Produk Paracetamol 500 mg di katalog tenant apotik')).toBeInTheDocument();
    expect(screen.getByText('per strip')).toBeInTheDocument();
  });
});
