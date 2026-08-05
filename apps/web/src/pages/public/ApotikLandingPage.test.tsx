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
    expect(screen.getAllByRole('link', { name: /Buka POS Apotik/i })).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: expect.stringContaining('/app/apotik/pos') })]),
    );
    expect(screen.getByRole('link', { name: /Baca manual PDF/i })).toHaveAttribute(
      'href',
      '/panduan/apotik/manual-pengguna-sistem-apotik-emedik.pdf',
    );
    expect(screen.getByRole('link', { name: /Unduh versi Word/i })).toHaveAttribute(
      'href',
      '/panduan/apotik/manual-pengguna-sistem-apotik-emedik.docx',
    );
    expect(screen.getByTitle('Manual Pengguna Sistem Apotik eMedik')).toHaveAttribute(
      'src',
      '/panduan/apotik/manual-pengguna-sistem-apotik-emedik.pdf#view=FitH',
    );
    expect(screen.getByRole('link', { name: /Unduh installer Windows/i })).toHaveAttribute(
      'href',
      '/update/pos-apotik-windows.exe',
    );
    expect(screen.getByRole('link', { name: /Unduh APK Android/i })).toHaveAttribute(
      'href',
      '/update/pos-apotik-android.apk',
    );
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
    expect(screen.getByText('Dikelola admin tenant')).toBeInTheDocument();
    expect(screen.getByText('OTC dan checkout POS')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kelola katalog produk/i })).toHaveAttribute('href', '/app/products');
    expect(screen.getByRole('link', { name: /Baca manual PDF/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Lihat katalog/i })).toEqual(
      expect.arrayContaining([expect.objectContaining({ href: expect.stringContaining('#Katalog') })]),
    );
  });

  it('menjadikan demo-apotik.emedik.id sebagai etalase tenant demo apotik', () => {
    setHost('demo-apotik.emedik.id');

    render(
      <MemoryRouter>
        <ApotikLandingPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Demo Apotik eMedik').length).toBeGreaterThan(0);
    expect(screen.getByText('Profil tenant apotik')).toBeInTheDocument();
    expect(screen.getByText('Katalog produk tenant')).toBeInTheDocument();
    expect(screen.getByText('Racikan puyer anak')).toBeInTheDocument();
  });
});
