/**
 * Pengujian layar rekam medis dan telaah darurat.
 *
 * ## PERINGATAN YANG SAMA DENGAN BERKAS W-1
 *
 * Perlengkapan data di bawah **disalin dari jawaban peladen sungguhan** —
 * diperiksa dengan memanggil setiap jalannya sebelum satu baris layar ditulis.
 * Itu bukan kehati-hatian berlebihan: pada W-1 perlengkapan yang ditulis dari
 * dugaan membuat enam uji LULUS atas halaman yang melempar TypeError dan kosong
 * sama sekali di peramban.
 *
 * Sekalipun begitu, perlengkapan tetap **salinan**, bukan kontrak. Sesudah
 * mengubah apa pun yang menyentuh bentuk jawaban, buka halamannya pada peladen
 * sungguhan.
 *
 * ## Yang dijaga di sini
 *
 * Sebagian besar berupa **ketiadaan**, sama seperti W-1:
 *
 * - tidak ada tombol hapus pada jejak akses, dan tidak boleh pernah ada;
 * - tidak ada tombol simpan telaah sebelum catatannya cukup panjang;
 * - tidak ada kolom "langkah berikutnya" ketika putusannya wajar — dan ia
 *   WAJIB muncul ketika putusannya tidak wajar.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PurposeProvider } from './PurposeGate';
import { BreakGlassPage } from './BreakGlassPage';
import { CodingPage } from './CodingPage';
import { LegalHoldPage } from './LegalHoldPage';
import { SafetyPage } from './SafetyPage';
import { QualityPage } from './QualityPage';
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

/* Disalin dari GET /health/security/break-glass/queue */
const ANTREAN = {
  queue: [
    {
      accessLogId: '8',
      alasan: 'Perlu ditelaah: bukan pasien yang dirawatnya; di luar jam kerja.',
      prioritas: 'HIGH' as const,
      patientId: '732a95db-8761-4c08-8808-0c4b46d8be9a',
      actorUserId: '88abcc75-b2a2-4b9f-8494-679cb426a2c3',
      purposeOfUse: 'EMERGENCY',
      occurredAt: '2026-07-31T17:42:31.165Z',
      breakGlassReason: 'Pasien tidak sadar di IGD, riwayat alergi diperlukan segera.',
    },
    {
      accessLogId: '168',
      alasan: 'Perlu ditelaah: bukan pasien yang dirawatnya; alasannya pendek.',
      prioritas: 'HIGH' as const,
      patientId: 'e2d2ec9d-9938-45f0-972d-34f6b690b8dc',
      actorUserId: 'b4ee7771-0a55-4c0f-9a05-d257fedda12f',
      purposeOfUse: 'EMERGENCY',
      occurredAt: '2026-08-01T11:38:03.628Z',
      breakGlassReason: 'perlu cepat',
    },
  ],
  total: 2,
  note: 'Diurut menurut yang paling mencurigakan, BUKAN menurut waktu.',
};

/* Disalin dari GET /health/security/break-glass/summary */
const RINGKAS = {
  total: 10,
  reviewed: 2,
  pending: 8,
  adverse: 0,
  note: 'Break-glass TIDAK PERNAH ditolak dan SELALU ditelaah.',
};

/* Disalin dari GET /health/security/break-glass/reviews */
const RIWAYAT = {
  reviews: [
    {
      id: '0da85681-0b79-47e0-9348-0a926990f60e',
      access_log_id: '169',
      reviewed_by: '01898188-049c-4da9-beae-bd3de62602ea',
      reviewed_at: '2026-08-01T11:38:03.684Z',
      verdict: 'JUSTIFIED',
      notes: 'Pasien tidak sadarkan diri, riwayat alergi diperlukan segera; wajar.',
      follow_up: null,
      patient_id: 'e2d2ec9d-9938-45f0-972d-34f6b690b8dc',
      actor_user_id: 'b4ee7771-0a55-4c0f-9a05-d257fedda12f',
      occurred_at: '2026-08-01T11:38:03.629Z',
      break_glass_reason: 'Pasien tidak sadarkan diri di IGD, keluarga belum tiba.',
    },
  ],
  note: 'Telaah bersifat tambah-saja.',
};

beforeEach(() => {
  vi.spyOn(healthApi, 'facilities').mockResolvedValue(FASILITAS as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Telaah Darurat — angka yang belum ditelaah paling atas', () => {
  beforeEach(() => {
    vi.spyOn(healthApi, 'breakGlassQueue').mockResolvedValue(ANTREAN as never);
    vi.spyOn(healthApi, 'breakGlassSummary').mockResolvedValue(RINGKAS as never);
    vi.spyOn(healthApi, 'breakGlassReviews').mockResolvedValue(RIWAYAT as never);
  });

  it('menonjolkan berapa akses darurat yang BELUM ditelaah', async () => {
    /*
     * Angka itu satu-satunya yang memberi tahu bahwa sifat kedua break-glass
     * sudah berhenti berlaku. Membaca antrean halaman per halaman tidak.
     */
    render(<BreakGlassPage />, { wrapper: Bungkus });
    expect(await screen.findByText('Belum ditelaah')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('mengutip alasan yang ditulis PELAKUNYA apa adanya', async () => {
    /*
     * Termasuk yang berbunyi "perlu cepat". Yang menuliskan sepatah kata pada
     * kolom alasan sedang tergesa atau sedang tidak jujur, dan keduanya hilang
     * bila kalimatnya diperhalus atau diringkas.
     */
    render(<BreakGlassPage />, { wrapper: Bungkus });
    expect(await screen.findByText('perlu cepat')).toBeTruthy();
    expect(
      screen.getByText('Pasien tidak sadar di IGD, riwayat alergi diperlukan segera.'),
    ).toBeTruthy();
  });

  it('menampilkan antrean pada urutan peladen, bernomor', async () => {
    render(<BreakGlassPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', {
      name: /Antrean telaah akses darurat menurut kecurigaan/,
    });
    const baris = within(daftar).getAllByRole('listitem');
    expect(within(baris[0]).getByLabelText('Urutan 1')).toBeTruthy();
    expect(baris[0].textContent).toContain('riwayat alergi diperlukan segera');
    expect(baris[1].textContent).toContain('perlu cepat');
  });

  it('menuntut catatan telaah sekurang-kurangnya 20 huruf sebelum dapat disimpan', async () => {
    const pengguna = userEvent.setup();
    render(<BreakGlassPage />, { wrapper: Bungkus });

    await pengguna.click((await screen.findAllByRole('button', { name: 'Telaah' }))[0]);
    const simpan = screen.getByRole('button', { name: /Simpan telaah/ });
    expect(simpan).toBeDisabled();

    await pengguna.type(screen.getByLabelText('Catatan telaah'), 'ok');
    expect(simpan).toBeDisabled();

    await pengguna.type(
      screen.getByLabelText('Catatan telaah'),
      ' — diperiksa, pasien memang di IGD saat itu.',
    );
    expect(simpan).not.toBeDisabled();
  });

  it('menuntut LANGKAH BERIKUTNYA hanya ketika putusannya bukan wajar', async () => {
    /*
     * Telaah yang menemukan sesuatu tanpa menyebutkan langkah berikutnya
     * berhenti pada dirinya sendiri.
     */
    const pengguna = userEvent.setup();
    render(<BreakGlassPage />, { wrapper: Bungkus });

    await pengguna.click((await screen.findAllByRole('button', { name: 'Telaah' }))[0]);
    expect(screen.queryByLabelText(/Langkah berikutnya/)).toBeNull();

    await pengguna.selectOptions(screen.getByLabelText('Putusan'), 'NOT_JUSTIFIED');
    expect(screen.getByLabelText(/Langkah berikutnya/)).toBeTruthy();

    await pengguna.type(
      screen.getByLabelText('Catatan telaah'),
      'Pelaku bukan tenaga yang merawat pasien ini sama sekali.',
    );
    expect(screen.getByRole('button', { name: /Simpan telaah/ })).toBeDisabled();

    await pengguna.type(screen.getByLabelText(/Langkah berikutnya/), 'Diteruskan ke komite etik.');
    expect(screen.getByRole('button', { name: /Simpan telaah/ })).not.toBeDisabled();
  });

  it('menyatakan bahwa telaah tidak menyetujui aksesnya', async () => {
    const pengguna = userEvent.setup();
    render(<BreakGlassPage />, { wrapper: Bungkus });
    await pengguna.click((await screen.findAllByRole('button', { name: 'Telaah' }))[0]);
    expect(screen.getByText(/tidak menyetujui/)).toBeTruthy();
    expect(screen.getByText(/tidak dapat diubah maupun dihapus/)).toBeTruthy();
  });
});

describe('Pengkodean — yang menghalangi dibedakan dari yang tidak', () => {
  const KODING = [
    {
      id: 'C1',
      status: 'PENDING',
      service_date: '2026-07-28',
      encounter_type: 'OUTPATIENT',
      deficiency_count: 3,
      blocking_count: 2,
      checked_at: '2026-07-29',
      patient_name: 'Siti Rahayu',
      open_deficiencies: 3,
    },
    {
      id: 'C2',
      status: 'CODED',
      service_date: '2026-07-30',
      encounter_type: 'INPATIENT',
      deficiency_count: 1,
      blocking_count: 0,
      checked_at: '2026-07-31',
      patient_name: 'Budi Santoso',
      open_deficiencies: 1,
    },
  ];

  const KEKURANGAN = [
    {
      id: 'D1',
      deficiency_type: 'MISSING_DIAGNOSIS',
      message: 'Diagnosis utama belum diisi.',
      blocks_coding: true,
      detected_at: '2026-07-29',
      coding_id: 'C1',
      service_date: '2026-07-28',
      patient_name: 'Siti Rahayu',
    },
    {
      id: 'D2',
      deficiency_type: 'UNSIGNED_NOTE',
      message: 'Catatan klinis belum ditandatangani.',
      blocks_coding: false,
      detected_at: '2026-07-29',
      coding_id: 'C1',
      service_date: '2026-07-28',
      patient_name: 'Siti Rahayu',
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'codingWorklist').mockResolvedValue(KODING as never);
    vi.spyOn(healthApi, 'deficiencies').mockResolvedValue(KEKURANGAN as never);
  });

  it('menampilkan jumlah yang MENGHALANGI sebagai kolom tersendiri', async () => {
    render(<CodingPage />, { wrapper: Bungkus });
    expect(await screen.findByText('Menghalangi')).toBeTruthy();
    expect(screen.getByText('Siti Rahayu')).toBeTruthy();
  });

  it('memisahkan kekurangan yang menghalangi dari yang tidak', async () => {
    const pengguna = userEvent.setup();
    render(<CodingPage />, { wrapper: Bungkus });
    await pengguna.click(await screen.findByRole('tab', { name: /Kekurangan berkas/ }));

    expect(await screen.findByText(/Menghalangi pengkodean \(1\)/)).toBeTruthy();
    expect(screen.getByText(/Tidak menghalangi \(1\)/)).toBeTruthy();
    expect(screen.getByText('Diagnosis utama belum diisi.')).toBeTruthy();
  });

  it('kekurangan ditujukan kepada PERAN, bukan disajikan sebagai angka kelengkapan', async () => {
    /*
     * "Kelengkapan 87%" tidak memberi tahu dokter mana pun berkas siapa yang
     * harus ditandatanganinya sore ini.
     */
    const pengguna = userEvent.setup();
    render(<CodingPage />, { wrapper: Bungkus });
    await pengguna.click(await screen.findByRole('tab', { name: /Kekurangan berkas/ }));
    expect(screen.getByLabelText('Kekurangan milik')).toBeTruthy();
  });
});

describe('Penahanan Hukum dan Jejak Akses', () => {
  const PASIEN = {
    scope: 'FACILITY_LOCAL' as const,
    scopeNote: '',
    total: 1,
    results: [
      {
        id: 'P1',
        enterprise_patient_id: 'E1',
        full_name: 'Siti Rahayu',
        birth_date: '1990-05-05',
        gender: 'FEMALE',
        phone: null,
        identity_confidence: 'VERIFIED',
        safety_alert: null,
        deceased_at: null,
        mrn: 'RM-000123',
      },
    ],
  };

  /* Disalin dari GET /health/him/legal-holds/:patientId */
  const PENAHANAN = {
    holds: [
      {
        id: 'H1',
        reason: 'Permintaan pengadilan perkara 123/Pdt.G/2026.',
        case_reference: '123/Pdt.G/2026',
        placed_at: '2026-07-20T09:00:00.000Z',
        released_at: null,
      },
    ],
    canAmend: false,
    message: 'Berkas beku: ada penahanan hukum aktif.',
  };

  /* Disalin dari GET /health/patients/:id/access-log */
  const JEJAK = [
    {
      id: '193',
      actor_user_id: 'ef0abfa3-f7d7-423f-8f17-6a214b64f266',
      purpose_of_use: 'QUALITY' as const,
      entity_type: 'patient',
      action: 'SEARCH',
      break_glass: false,
      break_glass_reason: null,
      occurred_at: '2026-08-01T13:51:45.121Z',
    },
    {
      id: '194',
      actor_user_id: 'b4ee7771-0a55-4c0f-9a05-d257fedda12f',
      purpose_of_use: 'EMERGENCY' as const,
      entity_type: 'patient',
      action: 'READ',
      break_glass: true,
      break_glass_reason: 'Pasien tidak sadar di IGD.',
      occurred_at: '2026-08-01T14:02:11.000Z',
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'searchPatients').mockResolvedValue(PASIEN as never);
    vi.spyOn(healthApi, 'legalHolds').mockResolvedValue(PENAHANAN as never);
    vi.spyOn(healthApi, 'accessLog').mockResolvedValue(JEJAK as never);
  });

  async function bukaPasien() {
    const pengguna = userEvent.setup();
    render(<LegalHoldPage />, { wrapper: Bungkus });
    await pengguna.type(screen.getByLabelText('Cari pasien'), 'Siti');
    await pengguna.click(screen.getByRole('button', { name: /^Cari$/ }));
    await pengguna.click(await screen.findByRole('button', { name: /Siti Rahayu/ }));
    await screen.findByText(/Jejak pembacaan rekam medis/);
    return pengguna;
  }

  it('menyatakan berkasnya BEKU ketika ada penahanan aktif', async () => {
    await bukaPasien();
    expect(screen.getByText(/Berkas beku: ada penahanan hukum aktif/)).toBeTruthy();
  });

  it('TIDAK menyediakan tombol hapus pada jejak akses', async () => {
    /*
     * Pemeriksaan atas ketiadaan, dan ia tidak boleh pernah gagal. Jejak yang
     * dapat dihapus adalah jejak yang akan dihapus tepat ketika ia paling
     * berguna.
     */
    await bukaPasien();
    const tombol = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(tombol.some((t) => /hapus|delete/i.test(t))).toBe(false);
    expect(screen.getByText(/tidak dapat dihapus dari layar mana pun/)).toBeTruthy();
  });

  it('menandai pembacaan yang memakai akses darurat, dan menghitungnya', async () => {
    await bukaPasien();
    expect(screen.getByText(/1 pembacaan memakai akses darurat/)).toBeTruthy();
    expect(screen.getByText('Pasien tidak sadar di IGD.')).toBeTruthy();
  });

  it('menerjemahkan tujuan penggunaan ke bahasa manusia, bukan kode', async () => {
    /*
     * Petugas yang membaca "QUALITY" tidak tahu itu penjaminan mutu.
     *
     * Dilingkupi ke TABELNYA: pemilih tujuan penggunaan pada bagian atas
     * halaman juga memuat kata yang sama, dan pemeriksaan yang tidak
     * dilingkupi akan lulus sekalipun tabelnya menampilkan kode mentah.
     */
    await bukaPasien();
    const tabel = screen.getByRole('table');
    expect(within(tabel).getByText('Penjaminan mutu')).toBeTruthy();
    expect(within(tabel).getByText('Kegawatdaruratan')).toBeTruthy();
    expect(within(tabel).queryByText('QUALITY')).toBeNull();
  });

  it('menuntut alasan pencabutan sekurang-kurangnya 5 huruf', async () => {
    const pengguna = await bukaPasien();
    await pengguna.click(screen.getByRole('button', { name: 'Cabut' }));
    const tombol = screen.getByRole('button', { name: /Cabut penahanan/ });
    expect(tombol).toBeDisabled();
    await pengguna.type(screen.getByLabelText('Alasan pencabutan'), 'Perkara selesai.');
    expect(tombol).not.toBeDisabled();
  });
});

describe('Keselamatan Pasien - yang terlupa, bukan yang paling berat', () => {
  /*
   * Disalin dari GET /health/him/incidents. Urutannya SUDAH diurutkan peladen:
   * yang belum ditutup dan lewat tenggat paling atas, baru menurut derajat.
   * Perhatikan bahwa yang HIJAU berada di atas yang MERAH — itu bukan
   * kekeliruan perlengkapan, itu justru yang diuji.
   */
  const PAPAN = [
    {
      id: 'I1',
      incident_number: 'INS-0001',
      incident_type: 'FALL',
      grade: 'GREEN',
      harm_level: 'NO_HARM',
      occurred_at: '2026-07-01T08:00:00.000Z',
      review_due_at: '2026-07-15T08:00:00.000Z',
      closed_at: null,
      is_anonymous: false,
      action_count: 0,
    },
    {
      id: 'I2',
      incident_number: 'INS-0002',
      incident_type: 'MEDICATION',
      grade: 'RED',
      harm_level: 'SEVERE',
      occurred_at: '2026-07-30T08:00:00.000Z',
      review_due_at: '2027-01-30T08:00:00.000Z',
      closed_at: null,
      is_anonymous: true,
      action_count: 2,
    },
    {
      id: 'I3',
      incident_number: 'INS-0003',
      incident_type: 'SURGICAL',
      grade: 'RED',
      harm_level: 'DEATH',
      occurred_at: '2026-06-01T08:00:00.000Z',
      review_due_at: '2026-06-15T08:00:00.000Z',
      closed_at: '2026-06-20T08:00:00.000Z',
      is_anonymous: false,
      action_count: 4,
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'incidents').mockResolvedValue(PAPAN as never);
  });

  it('menampilkan urutan peladen apa adanya - hijau yang terlupa di atas merah yang baru', async () => {
    /*
     * Kejadian berat yang sudah ditelaah SUDAH DIKERJAKAN; kejadian ringan yang
     * terlupa dua pekan adalah pekerjaan yang menumpuk diam-diam. Layar yang
     * mengurutkan ulang menurut derajat membalikkan seluruh maksudnya.
     */
    render(<SafetyPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', { name: /Papan insiden menurut yang terlupa/ });
    const baris = within(daftar).getAllByRole('listitem');
    expect(baris[0].textContent).toContain('INS-0001');
    expect(baris[1].textContent).toContain('INS-0002');
  });

  it('menghitung yang LEWAT TENGGAT, bukan hanya yang terbuka', async () => {
    render(<SafetyPage />, { wrapper: Bungkus });
    expect(await screen.findByText('Lewat tenggat')).toBeTruthy();
    expect(screen.getByText('Belum ditutup')).toBeTruthy();
  });

  it('TIDAK dapat menutup insiden yang belum punya tindakan perbaikan', async () => {
    /*
     * Ditegakkan peladen pula. Dijelaskan DI LAYAR sebelum tombolnya ditekan:
     * penjaga yang baru menjelaskan dirinya sesudah menolak terasa sebagai
     * penghalang, yang menjelaskan lebih dahulu terasa sebagai aturan.
     */
    render(<SafetyPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', { name: /Papan insiden/ });
    const baris = within(daftar).getAllByRole('listitem');

    expect(within(baris[0]).getByRole('button', { name: 'Tutup' })).toBeDisabled();
    expect(within(baris[0]).getByText(/belum ada tindakan perbaikan/i)).toBeTruthy();
    expect(within(baris[1]).getByRole('button', { name: 'Tutup' })).not.toBeDisabled();
  });

  it('menyebutkan bahwa pelapor tidak menutup laporannya sendiri pada kejadian berat', async () => {
    render(<SafetyPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', { name: /Papan insiden/ });
    const baris = within(daftar).getAllByRole('listitem');
    expect(within(baris[1]).getByText(/telaah oleh pihak yang terlibat bukan telaah/i)).toBeTruthy();
  });

  it('insiden yang sudah ditutup tidak lagi menawarkan tombol apa pun', async () => {
    render(<SafetyPage />, { wrapper: Bungkus });
    const daftar = await screen.findByRole('list', { name: /Papan insiden/ });
    const baris = within(daftar).getAllByRole('listitem');
    expect(within(baris[2]).queryByRole('button', { name: 'Tutup' })).toBeNull();
    expect(within(baris[2]).queryByRole('button', { name: /Tindakan/ })).toBeNull();
  });

  it('menandai laporan tanpa nama', async () => {
    // Pelaporan tanpa nama tetap dihitung dan tetap ditelaah.
    render(<SafetyPage />, { wrapper: Bungkus });
    expect(await screen.findByText('tanpa nama')).toBeTruthy();
  });
});

describe('Indikator Mutu - arah menentukan warnanya', () => {
  /* Disalin dari GET /health/him/quality/dashboard */
  const MUTU = {
    indicators: [
      {
        id: 'Q1',
        code: 'ILO',
        name: 'Infeksi Luka Operasi',
        category: 'KESELAMATAN',
        direction: 'LOWER_IS_BETTER',
        target_value: 2,
        value: 1.4,
        meets_target: true,
      },
      {
        id: 'Q2',
        code: 'HH',
        name: 'Kepatuhan Cuci Tangan',
        category: 'KESELAMATAN',
        direction: 'HIGHER_IS_BETTER',
        target_value: 85,
        value: 61.2,
        meets_target: false,
      },
      {
        id: 'Q3',
        code: 'RESP',
        name: 'Waktu Tanggap IGD',
        category: 'AKSES',
        direction: 'LOWER_IS_BETTER',
        target_value: 5,
        value: null,
        meets_target: null,
      },
    ],
    recordCompleteness: { score: 87.5, message: '35 dari 40 berkas lengkap (87.5%).' },
  };

  beforeEach(() => {
    vi.spyOn(healthApi, 'qualityDashboard').mockResolvedValue(MUTU as never);
  });

  it('memakai meets_target dari peladen, BUKAN membandingkan angkanya sendiri', async () => {
    /*
     * 1,4 lebih kecil daripada sasaran 2 dan itu TERCAPAI (makin rendah makin
     * baik). 61,2 lebih besar daripada 1,4 dan itu TAK TERCAPAI (makin tinggi
     * makin baik, sasarannya 85).
     *
     * Layar yang membandingkan sendiri akan membalik salah satunya, dan tidak
     * seorang pun akan menyadarinya: warna hijau tidak pernah ditanyakan.
     */
    render(<QualityPage />, { wrapper: Bungkus });
    const tabel = await screen.findByRole('table');
    const baris = within(tabel).getAllByRole('row');
    expect(within(baris[1]).getByText('Tercapai')).toBeTruthy();
    expect(within(baris[2]).getByText('Tak tercapai')).toBeTruthy();
  });

  it('MENAMPILKAN indikator yang belum diukur, tidak menyembunyikannya', async () => {
    /*
     * Papan yang seluruhnya hijau karena separuh indikatornya tidak diukur
     * adalah keadaan paling menyesatkan yang dapat ditampilkan dasbor mutu.
     */
    render(<QualityPage />, { wrapper: Bungkus });
    expect(await screen.findByText('Waktu Tanggap IGD')).toBeTruthy();

    /*
     * "Belum diukur" SENGAJA muncul dua kali: sekali sebagai angka ringkasan,
     * sekali sebagai lencana pada barisnya. Yang membaca ringkasan tahu
     * berapa; yang membaca tabel tahu yang mana.
     */
    expect(screen.getAllByText('Belum diukur').length).toBe(2);

    const tabel = screen.getByRole('table');
    expect(within(tabel).getByText('belum diukur')).toBeTruthy();
    expect(within(tabel).getByText('Belum diukur')).toBeTruthy();
  });

  it('menampilkan kelengkapan berkas beserta kalimat penjelasnya', async () => {
    render(<QualityPage />, { wrapper: Bungkus });
    expect(await screen.findByText('87.5%')).toBeTruthy();
    expect(screen.getByText('35 dari 40 berkas lengkap (87.5%).')).toBeTruthy();
  });

  it('menerjemahkan arah indikator ke bahasa manusia', async () => {
    render(<QualityPage />, { wrapper: Bungkus });
    const tabel = await screen.findByRole('table');
    expect(within(tabel).getAllByText('makin rendah makin baik').length).toBe(2);
    expect(within(tabel).getByText('makin tinggi makin baik')).toBeTruthy();
  });
});
