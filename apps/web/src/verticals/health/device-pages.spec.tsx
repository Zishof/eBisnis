/**
 * Pengujian layar alat medis.
 *
 * Perlengkapan disalin dari jawaban peladen sungguhan (`prove-web-contract.mjs`,
 * 39 pemeriksaan). Dua bentuk yang **mula-mula saya tebak salah** dan dibetulkan
 * dari sumbernya sebelum layarnya jadi — keduanya tercermin di sini:
 *
 * ```
 * pesan alat     : source_protocol / parse_status   (bukan protocol / status)
 * antrean peta   : device_code / occurrence_count   (bukan deviceCode / count)
 * ```
 *
 * Yang dijaga:
 *
 * - kendali jarak jauh mati secara bawaan, dan yang menyala DIHITUNG;
 * - perintah yang diizinkan disebut satu per satu, bukan diringkas;
 * - gagal uji keselamatan dihitung TERPISAH dari pemeliharaan yang lewat;
 * - protokol "siap tanpa pengurai" dihitung tersendiri;
 * - urutan antrean pemetaan milik peladen, dan layar tidak mengurut ulang.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PurposeProvider } from './PurposeGate';
import { DevicePage } from './DevicePage';
import { DeviceMaintenancePage } from './DeviceMaintenancePage';
import { DeviceAdapterPage } from './DeviceAdapterPage';
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

describe('Alat Medis — kendali jarak jauh mati secara bawaan', () => {
  const ALAT = [
    {
      id: 'D1',
      code: 'VNT-01',
      name: 'Ventilator ICU 2',
      device_category: 'VENTILATOR',
      manufacturer: null,
      model: null,
      source_protocol: 'IEEE_11073',
      status: 'ACTIVE',
      software_version: null,
      software_version_changed_at: null,
      calibration_due_at: '2025-01-01',
      calibration_overdue: true,
      remote_control_enabled: true,
      remote_allowed_commands: ['READ_STATUS', 'SET_ALARM_LIMIT'],
    },
    {
      id: 'D2',
      code: 'ANJ-01',
      name: 'Analyzer Kimia',
      device_category: 'ANALYZER',
      manufacturer: null,
      model: null,
      source_protocol: 'HL7V2',
      status: 'ACTIVE',
      software_version: null,
      software_version_changed_at: null,
      calibration_due_at: '2027-08-01',
      calibration_overdue: false,
      remote_control_enabled: false,
      remote_allowed_commands: [],
    },
  ];

  const PROTOKOL = [
    { code: 'HL7V2', usable: true, blockedBy: null },
    { code: 'DICOM', usable: false, blockedBy: 'Menunggu arsitektur PACS.' },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'devices').mockResolvedValue(ALAT as never);
    vi.spyOn(healthApi, 'deviceProtocols').mockResolvedValue(PROTOKOL as never);
  });

  it('MENGHITUNG alat yang kendali jarak jauhnya menyala', async () => {
    /*
     * Angka yang seharusnya nol pada sebagian besar fasilitas. Bila bukan, ia
     * pertanyaan — dan pertanyaan itu tidak muncul bila angkanya tidak ada.
     */
    render(<DevicePage />, { wrapper: Bungkus });
    await screen.findByText('Ventilator ICU 2');

    const label = screen.getByText('Kendali jarak jauh menyala');
    expect(label.nextElementSibling?.textContent?.trim()).toBe('1');
  });

  it('menyebut perintah yang diizinkan SATU PER SATU, bukan meringkasnya', async () => {
    /*
     * "Kendali jarak jauh menyala" tanpa daftar perintahnya tidak memberi tahu
     * apakah yang menyala sekadar pembacaan status atau penyetelan alarm.
     */
    render(<DevicePage />, { wrapper: Bungkus });
    await screen.findByText('Ventilator ICU 2');

    expect(screen.getByText('READ_STATUS')).toBeTruthy();
    expect(screen.getByText('SET_ALARM_LIMIT')).toBeTruthy();
  });

  it('alat yang kendalinya mati ditandai mati, bukan dikosongkan', async () => {
    render(<DevicePage />, { wrapper: Bungkus });
    await screen.findByText('Analyzer Kimia');

    const tabel = screen.getAllByRole('table')[0];
    const baris = within(tabel).getAllByRole('row');
    expect(within(baris[2]).getByText('mati')).toBeTruthy();
  });

  it('menyebutkan protokol yang terhalang beserta SEBABNYA', async () => {
    render(<DevicePage />, { wrapper: Bungkus });
    expect(await screen.findByText(/Menunggu arsitektur PACS/)).toBeTruthy();
  });

  it('menyatakan bahwa kalibrasi lewat MENANDAI, tidak menghentikan', async () => {
    render(<DevicePage />, { wrapper: Bungkus });
    await screen.findByText('Ventilator ICU 2');
    /*
     * Kata "menandai" berada di dalam <strong>, jadi teksnya terpotong antar
     * elemen. Dicocokkan pada kalimat lanjutannya yang utuh — dan kalimat itu
     * justru yang membawa alasannya.
     */
    expect(screen.getByText(/berhenti pada saat yang dipilih kalender/)).toBeTruthy();
  });
});

describe('Pemeliharaan — gagal uji keselamatan terpisah dari yang lewat', () => {
  const JADWAL = {
    items: [
      {
        id: 'D1',
        code: 'ANJ-01',
        name: 'Analyzer Kimia',
        status: 'ACTIVE',
        maintenance: null,
        calibrationOverdue: false,
        safetyInspectionFailed: true,
      },
      {
        id: 'D2',
        code: 'VNT-01',
        name: 'Ventilator ICU 2',
        status: 'ACTIVE',
        maintenance: {
          jatuhTempo: '2024-08-11',
          terlambatHari: 720,
          terlambat: true,
          menghentikanLayanan: false as const,
          keterangan: 'Terlambat 720 hari.',
        },
        calibrationOverdue: true,
        safetyInspectionFailed: false,
      },
    ],
    overdueCount: 1,
    note: 'Yang terlambat menandai, tidak menghentikan.',
  };

  const RISIKO = {
    items: [
      {
        assessmentId: 'A1',
        deviceId: 'D1',
        deviceCode: 'ANJ-01',
        deviceName: 'Analyzer Kimia',
        tingkat: 'MEDIUM',
        skorSisa: 3,
        decision: null,
        tenggatKeputusan: '2025-06-27',
        adaKeputusanBerlaku: false,
        keterangan: 'Belum berkeputusan.',
      },
      {
        assessmentId: 'A2',
        deviceId: 'D2',
        deviceCode: 'VNT-01',
        deviceName: 'Ventilator ICU 2',
        tingkat: 'CRITICAL',
        skorSisa: 22,
        decision: 'ACCEPT',
        tenggatKeputusan: '2027-01-01',
        adaKeputusanBerlaku: true,
        keterangan: 'Sudah diputuskan.',
      },
    ],
    note: 'Penilaian tanpa keputusan bukan penilaian.',
  };

  beforeEach(() => {
    vi.spyOn(healthApi, 'deviceSchedule').mockResolvedValue(JADWAL as never);
    vi.spyOn(healthApi, 'deviceRisk').mockResolvedValue(RISIKO as never);
  });

  it('menghitung GAGAL UJI KESELAMATAN terpisah dari pemeliharaan yang lewat', async () => {
    /*
     * Gagal uji berarti SUDAH diperiksa dan hasilnya buruk; pemeliharaan lewat
     * berarti belum diperiksa. Menggabungkannya membuat yang mendesak
     * tenggelam.
     */
    render(<DeviceMaintenancePage />, { wrapper: Bungkus });
    await screen.findByText('Analyzer Kimia');

    expect(
      screen.getByText('Gagal uji keselamatan').nextElementSibling?.textContent?.trim(),
    ).toBe('1');
    expect(screen.getByText('Pemeliharaan lewat').nextElementSibling?.textContent?.trim()).toBe('1');
    expect(screen.getByText('Kalibrasi lewat').nextElementSibling?.textContent?.trim()).toBe('1');
  });

  it('menampilkan hari keterlambatan sebagai angka, bukan hanya "terlambat"', async () => {
    render(<DeviceMaintenancePage />, { wrapper: Bungkus });
    await screen.findByText('Ventilator ICU 2');
    expect(screen.getByText('720')).toBeTruthy();
  });

  it('menandai penilaian risiko yang LEWAT TENGGAT tanpa keputusan', async () => {
    /*
     * Penilaian tanpa keputusan bukan penilaian — ia catatan bahwa seseorang
     * pernah melihat masalahnya dan tidak melakukan apa pun.
     */
    const pengguna = userEvent.setup();
    render(<DeviceMaintenancePage />, { wrapper: Bungkus });
    await pengguna.click(await screen.findByRole('tab', { name: /Risiko keamanan/ }));

    expect(await screen.findByText(/1 penilaian sudah lewat tenggat tanpa/)).toBeTruthy();
    expect(screen.getByText('Belum berkeputusan.')).toBeTruthy();
    /* Yang sudah diputuskan tidak ditandai, sekalipun tingkatnya KRITIS. */
    expect(screen.getByText('ACCEPT')).toBeTruthy();
  });
});

describe('Adapter — "siap" tidak sama dengan "dapat dibaca"', () => {
  const PROTOKOL = {
    protocols: [
      { code: 'HL7V2', ready: true, hasParser: true, blockedBy: null },
      { code: 'IEEE_11073', ready: true, hasParser: false, blockedBy: null },
      {
        code: 'DICOM',
        ready: false,
        hasParser: false,
        blockedBy: 'Menunggu arsitektur PACS. Menyimpan berkas DICOM utuh di basis data relasional bermasalah.',
      },
    ],
    note: 'Protokol yang siap tanpa pengurai menerima pesan tetapi belum membacanya.',
  };

  const PENDING = {
    items: [
      {
        id: 'M1',
        device_code: 'GLU',
        device_unit: 'mg/dL',
        sample_value: '110',
        occurrence_count: 312,
        first_seen_at: '2026-05-01',
        last_seen_at: '2026-08-01',
        device_code_ref: 'ANJ-01',
      },
      {
        id: 'M2',
        device_code: 'XYZ9',
        device_unit: null,
        sample_value: '1',
        occurrence_count: 1,
        first_seen_at: '2026-07-30',
        last_seen_at: '2026-07-30',
        device_code_ref: null,
      },
    ],
    note: 'Terurut menurut yang paling sering muncul, bukan menurut yang paling baru.',
  };

  beforeEach(() => {
    vi.spyOn(healthApi, 'adapterProtocols').mockResolvedValue(PROTOKOL as never);
    vi.spyOn(healthApi, 'codeMapPending').mockResolvedValue(PENDING as never);
  });

  it('menghitung protokol yang SIAP tetapi belum punya pengurai', async () => {
    /*
     * Ia menerima pesan dan menyimpannya, tetapi belum membacanya. Petugas yang
     * melihat "siap" akan mengira hasilnya sudah masuk ke rekam medis.
     */
    render(<DeviceAdapterPage />, { wrapper: Bungkus });
    await screen.findByText('IEEE_11073');

    expect(screen.getByText('Siap, belum ada pengurai').nextElementSibling?.textContent?.trim()).toBe(
      '1',
    );
    expect(screen.getByText('Belum siap').nextElementSibling?.textContent?.trim()).toBe('1');
  });

  it('menampilkan penghalang DICOM apa adanya, tidak meringkasnya', async () => {
    render(<DeviceAdapterPage />, { wrapper: Bungkus });
    expect(await screen.findByText(/Menyimpan berkas DICOM utuh/)).toBeTruthy();
  });

  it('TIDAK mengurut ulang antrean pemetaan — yang paling sering tetap di atas', async () => {
    /*
     * Kode yang muncul tiga ratus kali sehari menahan tiga ratus hasil; kode
     * yang muncul sekali mungkin salah ketik pada alatnya.
     */
    const pengguna = userEvent.setup();
    render(<DeviceAdapterPage />, { wrapper: Bungkus });
    await pengguna.click(await screen.findByRole('tab', { name: /Pemetaan kode/ }));

    const tabel = await screen.findByRole('table');
    const baris = within(tabel).getAllByRole('row');
    expect(baris[1].textContent).toContain('GLU');
    expect(baris[1].textContent).toContain('312');
    expect(baris[2].textContent).toContain('XYZ9');
  });
});
