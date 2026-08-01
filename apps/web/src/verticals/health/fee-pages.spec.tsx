/**
 * Pengujian layar tarif, jasa, settlement, dan kontrak fee.
 *
 * Perlengkapan disalin dari jawaban peladen sungguhan (`prove-web-contract.mjs`,
 * 31 pemeriksaan). Yang dijaga di sini hampir seluruhnya **gabungan keadaan
 * yang berbahaya dan tidak menimbulkan galat apa pun**:
 *
 * - kebijakan yang AKTIF tetapi belum disetujui untuk produksi;
 * - kontrak yang DISETUJUI tanpa telaah hukum;
 * - settlement SIMULASI yang berstatus "dibayar";
 * - persentase yang jumlahnya bukan 100.
 *
 * Keempatnya tampak wajar pada layar yang meringkas keadaan menjadi satu
 * lencana status. Uji di bawah menegaskan bahwa layar ini tidak meringkasnya.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PurposeProvider } from './PurposeGate';
import { TariffPage } from './TariffPage';
import { FeePolicyPage } from './FeePolicyPage';
import { SettlementPage } from './SettlementPage';
import { FeeContractPage } from './FeeContractPage';
import { healthApi } from './health-api';

function Bungkus({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <PurposeProvider>{children}</PurposeProvider>
        </ToastProvider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const FASILITAS = [
  {
    id: 'F1',
    code: 'RS1',
    name: 'RS Contoh',
    short_name: null,
    hospital_class: 'C',
    subdomain: null,
    timezone: 'Asia/Jakarta',
    is_active: true,
    facility_type_code: 'HOSPITAL',
    facility_type_name: 'Rumah Sakit',
    category: 'HOSPITAL',
  },
];

beforeEach(() => {
  vi.spyOn(healthApi, 'facilities').mockResolvedValue(FASILITAS as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Tarif — tiga keadaan versi yang berbeda', () => {
  const VERSI = [
    {
      id: 'V1',
      code: 'TARIF-2026',
      name: 'Tarif JKN 2026',
      regulation_reference: 'PMK-2026-01',
      source_file: 'pmk.csv',
      source_hash: 'sha256:aaa',
      row_count: 1200,
      is_active: true,
      imported_at: '2026-01-02',
      approved_at: '2026-01-05',
      retired_at: null,
    },
    {
      id: 'V2',
      code: 'TARIF-DRAF',
      name: 'Versi terimpor',
      regulation_reference: null,
      source_file: 'draf.csv',
      source_hash: 'sha256:bbb',
      row_count: 0,
      is_active: false,
      imported_at: '2026-07-30',
      approved_at: null,
      retired_at: null,
    },
  ];

  const PERATURAN = [
    {
      id: 'R1',
      reference: 'PMK-2026-01',
      year: 2026,
      title: 'Peraturan tarif 2026',
      scope: 'FKRTL',
      effective_from: '2026-01-01',
      revoked_at: null,
      revokes_reference: null,
      source_file: 'pmk.pdf',
      source_hash: 'sha256:ccc',
    },
    {
      id: 'R2',
      reference: 'PMK-2024-09',
      year: 2024,
      title: 'Peraturan tarif 2024',
      scope: 'FKRTL',
      effective_from: '2024-01-01',
      revoked_at: '2026-01-01',
      revokes_reference: 'PMK-2026-01',
      source_file: 'pmk-lama.pdf',
      source_hash: 'sha256:ddd',
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'tariffVersions').mockResolvedValue(VERSI as never);
    vi.spyOn(healthApi, 'tariffRegulations').mockResolvedValue(PERATURAN as never);
  });

  it('menghitung versi yang terimpor tetapi BELUM DISETUJUI secara terpisah', async () => {
    /*
     * Versi yang belum disetujui berisi angka yang belum diperiksa siapa pun.
     * Menghitungnya bersama yang aktif akan membuatnya tampak siap dipakai.
     */
    render(<TariffPage />, { wrapper: Bungkus });
    /*
     * Menunggu BARIS versinya, bukan judul ringkasannya. Ringkasan dirender
     * tanpa menunggu apa pun dan menampilkan 0 sampai datanya tiba — uji yang
     * menunggu judulnya saja menegaskan terhadap keadaan kosong.
     */
    await screen.findByText('Versi terimpor');

    const label = screen.getByText('Terimpor, belum disetujui');
    expect(label.nextElementSibling?.textContent?.trim()).toBe('1');
  });

  it('menampilkan peraturan yang SUDAH DICABUT beserta penggantinya', async () => {
    /*
     * "Tarif mana yang berlaku bulan Maret" adalah pertanyaan yang muncul
     * setiap kali klaim lama ditolak, dan ia tidak dapat dijawab bila yang
     * dicabut dihilangkan.
     */
    render(<TariffPage />, { wrapper: Bungkus });
    expect(await screen.findByText('PMK-2024-09')).toBeTruthy();
    expect(screen.getByText(/dicabut 2026-01-01/)).toBeTruthy();
  });

  it('menandai versi yang barisnya nol', async () => {
    render(<TariffPage />, { wrapper: Bungkus });
    const tabel = (await screen.findAllByRole('table'))[0];
    expect(within(tabel).getByText('0')).toBeTruthy();
    expect(within(tabel).getByText('belum disetujui')).toBeTruthy();
  });
});

describe('Kebijakan Jasa — gabungan keadaan yang berbahaya', () => {
  const KEBIJAKAN = [
    {
      id: 'P1',
      code: 'BEDAH-01',
      name: 'Pembagian Jasa Operasi',
      basis: 'PAID_CLAIM',
      effective_from: '2026-01-01',
      effective_to: null,
      active: true,
      is_sample_data: false,
      production_approved: false,
      approved_at: '2026-01-02',
      line_count: 4,
      total_percent: 100,
    },
    {
      id: 'P2',
      code: 'RALAN-01',
      name: 'Jasa Rawat Jalan',
      basis: 'PAID_CLAIM',
      effective_from: '2026-01-01',
      effective_to: null,
      active: true,
      is_sample_data: false,
      production_approved: true,
      approved_at: '2026-01-02',
      line_count: 2,
      total_percent: 95,
    },
    {
      id: 'P3',
      code: 'CONTOH-01',
      name: 'Contoh Demo',
      basis: 'PAID_CLAIM',
      effective_from: '2026-01-01',
      effective_to: null,
      active: false,
      is_sample_data: true,
      production_approved: false,
      approved_at: null,
      line_count: 2,
      total_percent: 100,
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'feePolicies').mockResolvedValue(KEBIJAKAN as never);
  });

  it('menghitung kebijakan AKTIF yang belum disetujui untuk produksi', async () => {
    /*
     * P1 aktif, bukan contoh, belum disetujui produksi — satu-satunya yang
     * berbahaya. P2 sudah disetujui; P3 data contoh dan tidak aktif.
     *
     * Ia menghitung uang sungguhan memakai persentase yang belum disepakati
     * siapa pun, dan tidak ada satu pun galat yang muncul karenanya.
     */
    render(<FeePolicyPage />, { wrapper: Bungkus });
    await screen.findByText('Pembagian Jasa Operasi');

    const label = screen.getByText('Aktif, belum disetujui produksi');
    expect(label.nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText(/1 kebijakan aktif belum disetujui untuk\s+produksi/)).toBeTruthy();
  });

  it('menandai kebijakan yang jumlah persennya bukan 100', async () => {
    // Berarti ada uang yang tidak diberikan kepada siapa pun, atau dua kali.
    render(<FeePolicyPage />, { wrapper: Bungkus });
    await screen.findByText('Jasa Rawat Jalan');

    const label = screen.getByText('Jumlah persen bukan 100');
    expect(label.nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText('95.0%')).toBeTruthy();
  });

  it('menampilkan ketiga penanda TERPISAH, tidak meringkasnya jadi satu status', async () => {
    render(<FeePolicyPage />, { wrapper: Bungkus });
    await screen.findByText('Contoh Demo');

    expect(screen.getAllByText('aktif').length).toBe(2);
    expect(screen.getByText('data contoh')).toBeTruthy();
    expect(screen.getAllByText('belum disetujui produksi').length).toBe(2);
    expect(screen.getByText('disetujui produksi')).toBeTruthy();
  });
});

describe('Settlement — simulasi tidak boleh terlihat seperti pembayaran', () => {
  const SETTLEMENT = [
    {
      id: 'S1',
      settlement_number: 'STL-0001',
      status: 'PAID',
      is_simulation: false,
      period_year: 2026,
      period_month: 7,
      basis: 'PAID_CLAIM',
      basis_amount: 10_000_000,
      policy_version: 2,
      policy_code: 'BEDAH-01',
      calculated_at: '2026-08-01',
      paid_at: '2026-08-02',
      line_count: 2,
      corrected_amount: 9_000_000,
    },
    {
      id: 'S2',
      settlement_number: 'STL-0002',
      status: 'PAID',
      is_simulation: true,
      period_year: 2026,
      period_month: 7,
      basis: 'PAID_CLAIM',
      basis_amount: 12_000_000,
      policy_version: 3,
      policy_code: 'BEDAH-01',
      calculated_at: '2026-08-01',
      paid_at: null,
      line_count: 2,
      corrected_amount: 12_000_000,
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'settlements').mockResolvedValue(SETTLEMENT as never);
  });

  it('MENANDAI simulasi sekalipun statusnya "dibayar"', async () => {
    /*
     * Simulasi berstatus PAID tidak pernah membayar siapa pun. Lencana status
     * sendirian membacanya seperti pembayaran sungguhan — dan dokter yang
     * ditunjukkan angka simulasi akan mengingatnya sebagai janji.
     */
    render(<SettlementPage />, { wrapper: Bungkus });
    await screen.findByText('STL-0002');

    const tabel = screen.getAllByRole('table')[0];
    const baris = within(tabel).getAllByRole('row');
    expect(within(baris[1]).queryByText('simulasi')).toBeNull();
    expect(within(baris[2]).getByText('simulasi')).toBeTruthy();
    /* Keduanya tetap berstatus "Dibayar" — itu memang bentuk datanya. */
    expect(within(baris[2]).getByText('Dibayar')).toBeTruthy();
  });

  it('menghitung sungguhan, simulasi, dan yang dikoreksi terpisah', async () => {
    render(<SettlementPage />, { wrapper: Bungkus });
    await screen.findByText('STL-0001');

    expect(screen.getByText('Sungguhan').nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText('Simulasi').nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText('Dikoreksi').nextElementSibling?.textContent?.trim()).toBe('1');
  });

  it('menampilkan dasar dan hasil sesudah koreksi berdampingan', async () => {
    // "Mengapa bagian saya berubah" hanya terjawab bila keduanya terlihat.
    render(<SettlementPage />, { wrapper: Bungkus });
    await screen.findByText('STL-0001');

    const tabel = screen.getAllByRole('table')[0];
    expect(within(tabel).getByText(/10\.000\.000/)).toBeTruthy();
    expect(within(tabel).getByText(/9\.000\.000/)).toBeTruthy();
  });
});

describe('Kontrak Fee — NONE sampai ada kontraknya', () => {
  const KONTRAK = [
    {
      id: 'C1',
      contract_type: 'INVESTOR_SHARE',
      contract_reference: 'KTR-INV-01',
      counterparty_name: 'PT Modal Sehat',
      status: 'ACTIVE',
      maximum_percent: 25,
      effective_from: '2026-07-02',
      effective_to: null,
      legal_reviewed_at: '2026-06-17',
      approved_at: '2026-07-01',
      is_sample_data: false,
      exclusion_count: 0,
    },
    {
      id: 'C2',
      contract_type: 'SYSTEM_FEE',
      contract_reference: 'KTR-SYS-01',
      counterparty_name: 'PT Penyedia Sistem',
      status: 'APPROVED',
      maximum_percent: 3,
      effective_from: '2026-08-01',
      effective_to: null,
      legal_reviewed_at: null,
      approved_at: '2026-07-25',
      is_sample_data: false,
      exclusion_count: 0,
    },
  ];

  const INVESTOR = {
    periodYear: 2026,
    facilityCount: 2,
    grossRevenue: 500_000_000,
    distributionAmount: 25_000_000,
    contractReference: 'KTR-INV-01',
    _filtered: 14,
    note: 'Ringkasan ini disaring lewat daftar PUTIH medan yang boleh dilihat pemegang kontrak investor.',
  };

  beforeEach(() => {
    vi.spyOn(healthApi, 'feeContracts').mockResolvedValue(KONTRAK as never);
    vi.spyOn(healthApi, 'investorSummary').mockResolvedValue(INVESTOR as never);
  });

  it('menghitung kontrak yang DISETUJUI TANPA TELAAH HUKUM', async () => {
    /*
     * Lebih berbahaya daripada kontrak yang belum disetujui sama sekali: yang
     * kedua tidak berlaku, yang pertama berlaku tanpa ada yang membaca
     * pasalnya.
     */
    render(<FeeContractPage />, { wrapper: Bungkus });
    await screen.findByText('PT Penyedia Sistem');

    const label = screen.getByText('Disetujui tanpa telaah hukum');
    expect(label.nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText('tanpa telaah hukum')).toBeTruthy();
  });

  it('menampilkan TIGA TAHAP terpisah, bukan satu lencana status', async () => {
    render(<FeeContractPage />, { wrapper: Bungkus });
    await screen.findByText('PT Modal Sehat');

    const tabel = screen.getAllByRole('table')[0];
    const baris = within(tabel).getAllByRole('row');
    expect(within(baris[1]).getByText('telaah hukum')).toBeTruthy();
    expect(within(baris[1]).getByText('disetujui')).toBeTruthy();
    expect(within(baris[1]).getByText('Berlaku')).toBeTruthy();
  });

  it('MENAMPILKAN berapa medan yang disaring dari ringkasan investor', async () => {
    /*
     * Pemegang kontrak berhak tahu bahwa ia melihat pandangan yang disaring,
     * dan rumah sakit berhak menunjukkan bahwa penyaringannya bekerja.
     */
    render(<FeeContractPage />, { wrapper: Bungkus });
    expect(await screen.findByText('Medan yang disaring')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText(/daftar PUTIH/)).toBeTruthy();
  });

  it('berkata NONE ketika tidak ada kontrak yang berlaku', async () => {
    vi.spyOn(healthApi, 'feeContracts').mockResolvedValue([] as never);
    render(<FeeContractPage />, { wrapper: Bungkus });
    expect(
      await screen.findByText(/fee sistem dan fee\s+investor bernilai NONE/),
    ).toBeTruthy();
  });
});
