/**
 * Pengujian layar klaim dan BPJS.
 *
 * Perlengkapan **disalin dari jawaban peladen sungguhan**, diperiksa lewat
 * `prove-web-contract.mjs` sebelum satu baris layar ditulis. Perhatikan bahwa
 * daftar kerja memakai `snake_case` dan satu klaim memakai `camelCase` — itu
 * bukan kekeliruan salin, itu memang bentuk peladennya.
 *
 * Yang dijaga di sini:
 *
 * - selisih uang muncul sebagai **angka**, bukan tersembunyi di balik status;
 * - temuan yang MENGHALANGI dibedakan dari yang tidak;
 * - naik kelas ditandai, bukan didiamkan sampai klaimnya ditolak;
 * - penghalang adapter BPJS ditampilkan apa adanya, bukan diringkas jadi merah.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PurposeProvider } from './PurposeGate';
import { ClaimPage } from './ClaimPage';
import { BpjsPage } from './BpjsPage';
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

/* Disalin dari GET /health/claims — snake_case. */
const KLAIM = [
  {
    id: 'K1',
    claim_number: 'KLM-20260801-0001',
    status: 'RECONCILED',
    service_date: '2026-08-01',
    submitted_amount: 10_000_000,
    approved_amount: 7_000_000,
    paid_amount: 6_500_000,
    rejection_reason: 'CODING_ERROR',
    needs_review: true,
    patient_name: 'Rina Bukti Klaim',
    blocking_findings: 0,
    open_flags: 1,
  },
  {
    id: 'K2',
    claim_number: 'KLM-20260801-0002',
    status: 'DRAFT',
    service_date: '2026-07-27',
    submitted_amount: null,
    approved_amount: null,
    paid_amount: null,
    rejection_reason: null,
    needs_review: false,
    patient_name: 'Budi Santoso',
    blocking_findings: 2,
    open_flags: 0,
  },
];

/* Disalin dari GET /health/claims/:id — camelCase. */
const RINCIAN = {
  id: 'K2',
  claimNumber: 'KLM-20260801-0002',
  status: 'DRAFT',
  patientId: 'P1',
  facilityId: 'F1',
  encounterId: null,
  admissionId: 'A1',
  codingId: null,
  sepNumber: null,
  serviceDate: '2026-07-27',
  admittedAt: '2026-07-27 08:29:53+07',
  dischargedAt: null,
  billedClass: 'CLASS_1',
  entitledClass: 'CLASS_3',
  submittedAmount: null,
  approvedAmount: null,
  paidAmount: null,
  rejectionReason: null,
  needsReview: false,
  codedBy: null,
  approvalGap: null,
  paymentGap: null,
  needsReason: null,
  message: null,
  findings: [
    {
      finding_type: 'MISSING_CODING',
      message: 'Berkas belum dikode.',
      blocks_submission: true,
      responsible_role: 'CODER',
      detected_at: '2026-07-28',
      resolved_at: null,
    },
    {
      finding_type: 'CLASS_UPGRADE',
      message: 'Pasien menempati kelas di atas haknya.',
      blocks_submission: false,
      responsible_role: null,
      detected_at: '2026-07-28',
      resolved_at: null,
    },
  ],
  flags: [
    {
      id: 'FL1',
      flag_type: 'CLASS_MISMATCH',
      message: 'Kelas ditagih berbeda dari kelas hak.',
      raised_at: '2026-07-28',
      reviewed_at: null,
      review_outcome: null,
      review_note: null,
    },
  ],
};

const SEBAB_TOLAK = [
  { rejection_reason: 'CODING_ERROR', claim_count: 1, total_gap: 3_000_000 },
  { rejection_reason: 'MISSING_DOCUMENT', claim_count: 8, total_gap: 900_000 },
];

beforeEach(() => {
  vi.spyOn(healthApi, 'facilities').mockResolvedValue(FASILITAS as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Klaim — selisih sebagai uang, bukan sebagai status', () => {
  /*
   * Menunggu BARIS KLAIM, bukan judul kolom.
   *
   * Ringkasan di bagian atas dirender tanpa menunggu apa pun dan menampilkan
   * "Rp 0" sampai datanya tiba. Uji yang menunggu judulnya saja akan menegaskan
   * terhadap keadaan kosong — dan lulus atau gagal tergantung waktu, bukan
   * tergantung benar atau tidaknya layar.
   */
  async function tunggu() {
    return screen.findByText('KLM-20260801-0002');
  }

  beforeEach(() => {
    vi.spyOn(healthApi, 'claims').mockResolvedValue(KLAIM as never);
    vi.spyOn(healthApi, 'claimRejectionReport').mockResolvedValue(SEBAB_TOLAK as never);
    vi.spyOn(healthApi, 'claim').mockResolvedValue(RINCIAN as never);
  });

  it('menampilkan yang TIDAK DISETUJUI dan yang BELUM DIBAYAR sebagai rupiah', async () => {
    /*
     * Klaim ini berstatus RECONCILED — pada layar berbasis status ia tampak
     * beres. Diajukan 10 juta, disetujui 7 juta, dibayar 6,5 juta: tiga juta
     * tidak disetujui dan setengah juta belum dibayar, dan keduanya tidak
     * muncul di mana pun kecuali dihitung.
     */
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();

    /*
     * Dilingkupi ke kartu ringkasan. Angka 3.000.000 SENGAJA muncul dua kali —
     * sekali sebagai selisih persetujuan, sekali sebagai uang yang hilang pada
     * laporan sebab — dan pemeriksaan yang tidak dilingkupi tidak dapat
     * membedakan keduanya.
     */
    const labelSetuju = screen.getByText('Tidak disetujui');
    const labelBayar = screen.getByText('Belum dibayar');
    expect(labelSetuju.nextElementSibling?.textContent).toMatch(/3\.000\.000/);
    expect(labelBayar.nextElementSibling?.textContent).toMatch(/500\.000/);
  });

  it('menghitung klaim yang tertahan temuan', async () => {
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();

    expect(screen.getByText('Klaim tertahan')).toBeTruthy();
    const tabel = screen.getAllByRole('table')[0];
    expect(within(tabel).getByText('KLM-20260801-0002')).toBeTruthy();
    /* Dua temuan yang menghalangi pada klaim kedua. */
    expect(within(tabel).getByText('2')).toBeTruthy();
  });

  it('memisahkan temuan yang MENGHALANGI dari yang tidak', async () => {
    const pengguna = userEvent.setup();
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();
    await pengguna.click(screen.getAllByRole('button', { name: 'Rincian' })[1]);

    expect(await screen.findByText('Berkas belum dikode.')).toBeTruthy();
    expect(screen.getByText('Pasien menempati kelas di atas haknya.')).toBeTruthy();
    // Yang menghalangi menyebut peran yang bertanggung jawab.
    expect(screen.getByText(/→ CODER/)).toBeTruthy();
  });

  it('MENANDAI naik kelas alih-alih mendiamkannya sampai klaimnya ditolak', async () => {
    const pengguna = userEvent.setup();
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();
    await pengguna.click(screen.getAllByRole('button', { name: 'Rincian' })[1]);

    /*
     * Kalimatnya satu paragraf yang memuat kode kelas di dalamnya, jadi
     * pencocokan teks polos menemukan induk dan anaknya sekaligus. Yang
     * ditegaskan: paragrafnya ada, dan ia menyebutkan akibatnya.
     */
    const peringatan = await screen.findByText(/mengubah siapa yang membayar selisihnya/);
    expect(peringatan.textContent).toContain('CLASS_1');
    expect(peringatan.textContent).toContain('CLASS_3');
  });

  it('menandai penanda telaah yang belum ditelaah', async () => {
    const pengguna = userEvent.setup();
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();
    await pengguna.click(screen.getAllByRole('button', { name: 'Rincian' })[1]);
    expect(await screen.findByText('menunggu telaah')).toBeTruthy();
  });

  it('laporan sebab penolakan menampilkan UANG, bukan hanya jumlah klaim', async () => {
    /*
     * Peladen mengurutkannya ORDER BY sum(submitted - approved) DESC. Sebab
     * yang mengenai satu klaim besar merugikan lebih banyak daripada sebab yang
     * mengenai delapan klaim kecil — dan yang diurut menurut jumlah akan
     * menyuruh petugas mengejar yang salah.
     */
    render(<ClaimPage />, { wrapper: Bungkus });
    await screen.findByText('Uang yang hilang');

    const tabelTolak = screen.getAllByRole('table').at(-1) as HTMLElement;
    const baris = within(tabelTolak).getAllByRole('row');
    expect(baris[1].textContent).toContain('Kesalahan pengkodean');
    expect(baris[2].textContent).toContain('Berkas tidak lengkap');
  });

  it('menerjemahkan sebab penolakan ke bahasa manusia, bukan kode', async () => {
    render(<ClaimPage />, { wrapper: Bungkus });
    await tunggu();

    /*
     * SENGAJA muncul dua kali: pada baris klaimnya dan pada laporan sebab.
     * Yang ditegaskan bukan jumlahnya melainkan bahwa KODE MENTAHNYA tidak
     * pernah muncul — petugas yang membaca "CODING_ERROR" tidak tahu itu
     * artinya apa.
     */
    expect(screen.getAllByText('Kesalahan pengkodean').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('CODING_ERROR')).toBeNull();
    expect(screen.queryByText('MISSING_DOCUMENT')).toBeNull();
  });
});

describe('BPJS — mengatakan apa yang belum ada', () => {
  const KATALOG = {
    adapters: [
      {
        kode: 'VCLAIM',
        nama: 'BpjsVClaimAdapter',
        cakupan: 'Kepesertaan, rujukan, SEP, surat kontrol',
        penghalang: 'Consumer ID, secret, dan user key belum ada.',
      },
    ],
    paymentMethods: [],
    itemDataPurpose: {},
    note: 'Kerangka; belum ada sambungan sungguhan.',
  };

  const ADAPTER = {
    items: [
      {
        id: 'A1',
        adapterCode: 'VCLAIM',
        status: 'BLOCKED',
        blocker: 'Consumer ID, secret, dan user key belum ada.',
        verifiedAt: null,
        scope: 'Kepesertaan, rujukan, SEP, surat kontrol',
      },
      {
        id: 'A2',
        adapterCode: 'PCARE',
        status: 'VERIFIED',
        blocker: null,
        verifiedAt: '2026-07-01T00:00:00.000Z',
        scope: 'FKTP: pendaftaran, kunjungan, rujukan',
      },
    ],
    summary: {},
  };

  const SEP = [
    {
      id: 'S1',
      sep_number: 'SEP-0001',
      sep_date: '2026-07-20',
      service_type: 'RAWAT_INAP',
      benefit_class: 'CLASS_3',
      occupied_class: 'CLASS_1',
      status: 'ACTIVE',
      patient_name: 'Rina Bukti Klaim',
    },
    {
      id: 'S2',
      sep_number: 'SEP-0002',
      sep_date: '2026-07-21',
      service_type: 'RAWAT_JALAN',
      benefit_class: 'CLASS_2',
      occupied_class: 'CLASS_2',
      status: 'ACTIVE',
      patient_name: 'Budi Santoso',
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'bpjsCatalog').mockResolvedValue(KATALOG as never);
    vi.spyOn(healthApi, 'bpjsAdapters').mockResolvedValue(ADAPTER as never);
    vi.spyOn(healthApi, 'bpjsSep').mockResolvedValue(SEP as never);
  });

  it('menampilkan PENGHALANG apa adanya, bukan meringkasnya jadi lencana merah', async () => {
    /*
     * Petugas yang tahu "kredensial belum ada" berhenti mencoba; petugas yang
     * hanya melihat merah akan mencoba lagi besok, dan besoknya lagi.
     */
    render(<BpjsPage />, { wrapper: Bungkus });
    expect(
      await screen.findAllByText('Consumer ID, secret, dan user key belum ada.'),
    ).toBeTruthy();
  });

  it('menyebutkan apa yang TETAP dapat dikerjakan tanpa kredensial', async () => {
    render(<BpjsPage />, { wrapper: Bungkus });
    /*
     * Jangkarnya kalimat yang HANYA ada di dalam kartu. Frasa "tetap dapat
     * dikerjakan" juga muncul pada uraian halaman, dan pencocokannya menemukan
     * keduanya.
     */
    const catatan = await screen.findByText(/mencatat nomor kartu/);

    /*
     * Kedua kalimat berada pada paragraf yang BERBEDA di dalam kartu yang sama.
     * Yang ditegaskan: keduanya ada, dan keduanya menyebutkan pekerjaan yang
     * masih mungkin — bukan sekadar mengabarkan kegagalan.
     */
    const kartu = catatan.closest('.card') as HTMLElement;
    expect(kartu.textContent).toContain('mencatat nomor kartu');
    expect(kartu.textContent).toContain('Klaim tetap dapat');
  });

  it('menghitung adapter yang terhalang terhadap seluruhnya', async () => {
    render(<BpjsPage />, { wrapper: Bungkus });
    await screen.findByRole('list', { name: 'Kemampuan adapter BPJS' });

    const label = screen.getByText('Adapter terhalang');
    const angka = label.nextElementSibling as HTMLElement;
    expect(angka.textContent?.replace(/\s+/g, '')).toBe('1/2');
  });

  it('MENANDAI naik kelas pada SEP, dan tidak menandai yang kelasnya sama', async () => {
    /*
     * Layar yang hanya menampilkan satu kolom kelas menyembunyikan selisih ini
     * sampai klaimnya ditolak berbulan-bulan kemudian.
     */
    render(<BpjsPage />, { wrapper: Bungkus });
    await screen.findByText('SEP-0001');

    const semuaTabel = screen.getAllByRole('table');
    const tabelSep = semuaTabel.at(-1) as HTMLElement;
    const baris = within(tabelSep).getAllByRole('row');

    expect(within(baris[1]).getByText('naik kelas')).toBeTruthy();
    expect(within(baris[2]).queryByText('naik kelas')).toBeNull();
  });

  it('adapter yang sudah diverifikasi tidak menampilkan penghalang', async () => {
    render(<BpjsPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', { name: 'Kemampuan adapter BPJS' });
    const baris = within(daftar).getAllByRole('listitem');
    expect(baris[0].textContent).toContain('Terhalang');
    expect(baris[1].textContent).toContain('Terverifikasi');
    expect(baris[1].textContent).toContain('Diverifikasi 2026-07-01');
  });
});
