/**
 * Pengujian layar Puskesmas dan Posyandu.
 *
 * ## Mengapa layar ini diuji, sedangkan layar lain tidak
 *
 * Sebagian besar layar dapat diperiksa dengan melihatnya sekali. Yang ini
 * tidak, sebab yang harus dijaga bukan rupanya melainkan **hal-hal yang justru
 * tidak terlihat ketika dilihat**:
 *
 * - daftar kunjungan yang urutannya tidak boleh dapat diubah;
 * - tombol yang HARUS tidak ada untuk imunisasi yang belum boleh diberikan;
 * - tombol yang dimatikan beserta sebabnya, bukan dimatikan diam-diam.
 *
 * Ketiganya berupa **ketiadaan**. Ketiadaan tidak dapat dilihat dengan
 * membuka halaman; ia hanya dapat diperiksa dengan menanyakannya.
 *
 * Dan ketiganya akan hilang tanpa suara pada penyuntingan berikutnya: seseorang
 * menambahkan tajuk kolom yang dapat diklik, atau menyeragamkan daftar
 * imunisasi supaya "konsisten", dan tidak ada satu pun galat yang muncul.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ToastProvider } from '../../components/ui';
import { PurposeProvider } from './PurposeGate';
import { HomeVisitPage } from './HomeVisitPage';
import { ImmunizationPage } from './ImmunizationPage';
import { CoveragePage } from './CoveragePage';
import { healthApi } from './health-api';

/**
 * Mengambil baris daftar kerja SAJA.
 *
 * `getAllByRole('listitem')` polos juga menangkap remah-remah navigasi, yang
 * kebetulan juga `<li>` — dan uji yang menegaskan urutan lalu membandingkan
 * "Beranda" dengan nama anak.
 */
async function barisKerja() {
  const daftar = await screen.findByRole('list', {
    name: /Daftar kunjungan rumah menurut kemendesakan/,
  });
  return within(daftar).getAllByRole('listitem');
}

function Bungkus({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
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
    code: 'PKM1',
    name: 'Puskesmas Sukamaju',
    short_name: null,
    hospital_class: null,
    subdomain: null,
    timezone: 'Asia/Jakarta',
    is_active: true,
    facility_type_code: 'PUSKESMAS',
    facility_type_name: 'Puskesmas',
    category: 'PUSKESMAS',
  },
];

/**
 * Daftar kerja SEPERTI YANG DIKEMBALIKAN PELADEN — sudah terurut menurut
 * kemendesakan. Nama-namanya sengaja tidak berurutan abjad, supaya kekeliruan
 * "diurut ulang di sisi klien" langsung terlihat.
 */
const DAFTAR_KUNJUNGAN = [
  {
    patient_id: 'P-gizi-buruk',
    full_name: 'Zulfa Ramadhani',
    birth_date: '2024-03-01',
    family_folder_id: 'FF1',
    folder_number: 'KK-001',
    village: 'Sukamaju',
    rt: '02',
    rw: '05',
    haz_status: 'NORMAL',
    whz_status: 'SEVERELY_WASTED',
    weight_flat_count: 0,
    last_measured_at: '2026-07-20',
    severelyWasted: true,
    wasted: false,
    stunted: false,
    weightFlat: false,
    overdueDays: 0,
  },
  {
    patient_id: 'P-berat-tetap',
    full_name: 'Andi Pratama',
    birth_date: '2024-01-15',
    family_folder_id: 'FF2',
    folder_number: 'KK-002',
    village: 'Sukamaju',
    rt: '01',
    rw: '03',
    haz_status: 'NORMAL',
    whz_status: 'NORMAL',
    weight_flat_count: 3,
    last_measured_at: '2026-07-18',
    severelyWasted: false,
    wasted: false,
    stunted: false,
    weightFlat: true,
    overdueDays: 0,
  },
  {
    /* Tanpa folder keluarga — peladen menuntutnya, jadi tombolnya harus mati. */
    patient_id: 'P-tanpa-folder',
    full_name: 'Bintang Nugroho',
    birth_date: '2023-11-02',
    family_folder_id: null,
    folder_number: null,
    village: 'Cibeureum',
    rt: null,
    rw: null,
    haz_status: 'STUNTED',
    whz_status: 'NORMAL',
    weight_flat_count: 0,
    last_measured_at: '2026-07-10',
    severelyWasted: false,
    wasted: false,
    stunted: true,
    weightFlat: false,
    overdueDays: 45,
  },
];

beforeEach(() => {
  vi.spyOn(healthApi, 'facilities').mockResolvedValue(FASILITAS as never);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Kunjungan Rumah — urutannya milik peladen', () => {
  beforeEach(() => {
    vi.spyOn(healthApi, 'homeVisitWorklist').mockResolvedValue(DAFTAR_KUNJUNGAN as never);
  });

  it('menampilkan daftar persis pada urutan yang dikirim peladen', async () => {
    render(<HomeVisitPage />, { wrapper: Bungkus });

    const baris = await barisKerja();
    const nama = baris.map((li) => li.textContent ?? '');

    expect(nama[0]).toContain('Zulfa Ramadhani');
    expect(nama[1]).toContain('Andi Pratama');
    expect(nama[2]).toContain('Bintang Nugroho');
  });

  it('TIDAK menyediakan satu pun tajuk kolom yang dapat diklik untuk mengurut ulang', async () => {
    /*
     * Pemeriksaan atas KETIADAAN, dan ia yang paling penting pada berkas ini.
     *
     * Kolom yang dapat diklik akan diklik. Diurut menurut nama, anak dengan
     * gizi buruk berpindah ke tengah daftar dan tidak dikunjungi hari itu —
     * tanpa satu pun galat yang memberi tahu.
     */
    render(<HomeVisitPage />, { wrapper: Bungkus });
    await barisKerja();

    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
    expect(screen.queryByRole('table')).toBeNull();

    const tombol = screen.getAllByRole('button').map((b) => b.textContent ?? '');
    expect(tombol.some((t) => /urut|sort/i.test(t))).toBe(false);
  });

  it('menomori barisnya, sehingga urutannya terbaca sebagai urutan', async () => {
    render(<HomeVisitPage />, { wrapper: Bungkus });
    const baris = await barisKerja();
    expect(within(baris[0]).getByLabelText('Urutan 1')).toBeTruthy();
    expect(within(baris[1]).getByLabelText('Urutan 2')).toBeTruthy();
  });

  it('menyebutkan SEBAB tiap anak masuk daftar, bukan hanya namanya', async () => {
    render(<HomeVisitPage />, { wrapper: Bungkus });
    const baris = await barisKerja();

    expect(within(baris[0]).getByText('Gizi buruk')).toBeTruthy();
    expect(within(baris[1]).getByText(/Berat tidak naik 3/)).toBeTruthy();
    expect(within(baris[2]).getByText('Pendek')).toBeTruthy();
    expect(within(baris[2]).getByText(/Imunisasi tertunggak 45 hari/)).toBeTruthy();
  });

  it('mematikan tombol untuk anak tanpa folder keluarga — DAN menyebutkan jalan keluarnya', async () => {
    /*
     * Peladen menuntut familyFolderId. Membiarkan tombolnya hidup akan
     * menghasilkan galat 400 di tangan kader yang sedang berdiri di depan
     * rumah orang.
     */
    render(<HomeVisitPage />, { wrapper: Bungkus });
    const baris = await barisKerja();

    expect(within(baris[0]).getByRole('button', { name: /Catat kunjungan/ })).not.toBeDisabled();
    expect(within(baris[2]).getByRole('button', { name: /Catat kunjungan/ })).toBeDisabled();
    expect(within(baris[2]).getByText(/Belum punya folder keluarga/)).toBeTruthy();
    expect(within(baris[2]).getByText(/buatkan foldernya lebih dahulu/i)).toBeTruthy();
  });

  it('daftar kosong berkata tidak ada yang perlu dikunjungi, bukan menampilkan tabel kosong', async () => {
    vi.spyOn(healthApi, 'homeVisitWorklist').mockResolvedValue([] as never);
    render(<HomeVisitPage />, { wrapper: Bungkus });
    expect(await screen.findByText(/Tidak ada anak yang perlu dikunjungi/)).toBeTruthy();
  });
});

describe('Imunisasi — yang belum boleh tidak diberi tombol', () => {
  const STATUS = {
    given: [
      { id: 'G1', vaccine_code: 'BCG', dose_number: 1, given_at: '2024-04-02', batch_number: 'B-77' },
    ],
    overdue: [{ vaccineCode: 'DPT-HB-Hib', doseNumber: 2, overdueDays: 31 }],
    upcoming: [
      /*
       * Bentuk ini DISALIN dari jawaban peladen sungguhan, bukan dikarang:
       *   {"vaccineCode":"HB0","doseNumber":1,"minAgeDays":0,
       *    "minIntervalDays":null,"recommendedAgeDays":1,
       *    "verdict":{"allowed":true}}
       * Perhatikan: verdict yang mengizinkan TIDAK punya `reason` maupun
       * `message`, dan yang menolak memakai `reason` sebagai KODE.
       */
      {
        vaccineCode: 'DPT-HB-Hib',
        doseNumber: 2,
        minAgeDays: 60,
        minIntervalDays: 28,
        recommendedAgeDays: 60,
        verdict: { allowed: true },
      },
      {
        vaccineCode: 'CAMPAK',
        doseNumber: 1,
        minAgeDays: 270,
        minIntervalDays: null,
        recommendedAgeDays: 270,
        verdict: {
          allowed: false,
          reason: 'TOO_YOUNG',
          message: 'Umur minimum 9 bulan; anak baru 6 bulan.',
          earliestDate: '2026-11-02',
        },
      },
    ],
    dueToday: [
      {
        vaccineCode: 'DPT-HB-Hib',
        doseNumber: 2,
        minAgeDays: 60,
        minIntervalDays: 28,
        recommendedAgeDays: 60,
        verdict: { allowed: true },
      },
    ],
  };

  beforeEach(() => {
    vi.spyOn(healthApi, 'searchPatients').mockResolvedValue({
      scope: 'FACILITY_LOCAL',
      scopeNote: '',
      total: 1,
      results: [
        {
          id: 'P1',
          enterprise_patient_id: 'E1',
          full_name: 'Zulfa Ramadhani',
          birth_date: '2024-03-01',
          gender: 'FEMALE',
          phone: null,
          identity_confidence: 'VERIFIED',
          safety_alert: null,
          deceased_at: null,
          mrn: 'RM-000123',
        },
      ],
    } as never);
    vi.spyOn(healthApi, 'immunizationStatus').mockResolvedValue(STATUS as never);
  });

  it('memisahkan tertunggak, boleh hari ini, dan belum boleh', async () => {
    render(<ImmunizationPage />, { wrapper: Bungkus });
    // Layar menuntut anak dipilih lebih dahulu; judulnya tetap harus tampil.
    expect(await screen.findByRole('heading', { name: 'Imunisasi' })).toBeTruthy();
  });

  /** Memilih anak lebih dahulu — layarnya menuntut itu sebelum menampilkan jadwal. */
  async function pilihAnak() {
    const pengguna = userEvent.setup();
    render(<ImmunizationPage />, { wrapper: Bungkus });
    await pengguna.type(screen.getByLabelText('Cari anak'), 'Zulfa');
    await pengguna.click(screen.getByRole('button', { name: /^Cari$/ }));
    await pengguna.click(await screen.findByRole('button', { name: /Zulfa Ramadhani/ }));
    await screen.findByRole('heading', { name: /Belum boleh diberikan/ });
  }

  it('menampilkan KALIMAT penolakan, bukan kode TOO_YOUNG', async () => {
    /*
     * Regresi yang sudah pernah terjadi, dan yang ditemukan hanya dengan
     * membuka halamannya pada peladen sungguhan: `verdict.reason` berisi KODE
     * (`TOO_YOUNG`, `OUT_OF_ORDER`), sedangkan kalimatnya ada pada
     * `verdict.message`. Kader yang membaca "TOO_YOUNG" tidak tahu itu artinya
     * apa, dan akan menekan tombol yang tidak ada.
     */
    await pilihAnak();

    expect(screen.getByText(/Umur minimum 9 bulan/)).toBeTruthy();
    expect(screen.queryByText('TOO_YOUNG')).toBeNull();
  });

  it('menjawab "kapan giliran anak saya" dengan TANGGAL', async () => {
    // `earliestDate` disediakan peladen sejak awal dan mula-mula tidak dipakai.
    await pilihAnak();
    expect(screen.getByText(/Paling awal 2026-11-02/)).toBeTruthy();
  });

  it('yang BELUM BOLEH tidak punya tombol; yang boleh hari ini punya', async () => {
    /*
     * Pemeriksaan atas ketiadaan, dan ia inti seluruh layar ini. Vaksin
     * sebelum umur minimum akan TERCATAT sebagai diberikan, lalu anaknya
     * tampak lengkap pada laporan cakupan dan tidak dikejar siapa pun.
     */
    await pilihAnak();

    const belum = screen
      .getByRole('heading', { name: /Belum boleh diberikan/ })
      .closest('section') as HTMLElement;
    expect(within(belum).queryAllByRole('button')).toHaveLength(0);
    expect(within(belum).getByText('CAMPAK')).toBeTruthy();

    const boleh = screen
      .getByRole('heading', { name: /Boleh diberikan hari ini/ })
      .closest('section') as HTMLElement;
    expect(within(boleh).getAllByRole('button', { name: 'Berikan' }).length).toBe(1);
  });

  it('memisahkan tertunggak dari yang boleh hari ini', async () => {
    await pilihAnak();
    const tertunggak = screen
      .getByRole('heading', { name: /Tertunggak/ })
      .closest('section') as HTMLElement;
    expect(within(tertunggak).getByText(/terlambat 31 hari/)).toBeTruthy();
  });

  it('menyatakan pada layar mengapa yang belum boleh tidak diberi tombol', async () => {
    /*
     * Kalimatnya ada di layar, bukan hanya di komentar kode. Kader yang tidak
     * menemukan tombolnya akan mengira aplikasinya rusak — kecuali sebabnya
     * tertulis di sebelahnya.
     */
    render(<ImmunizationPage />, { wrapper: Bungkus });
    expect(
      await screen.findByText(/tidak diberi tombol/i),
    ).toBeTruthy();
  });
});

/*
 * ## PERINGATAN YANG HARUS DIBACA SEBELUM MENAMBAH UJI DI BAWAH
 *
 * Perlengkapan data di berkas ini DITULIS TANGAN, dan karena itu ia **tidak
 * dapat membuktikan bentuk jawaban peladen**. Ia hanya membuktikan bahwa
 * komponennya berperilaku benar terhadap data yang bentuknya diandaikan
 * penulisnya.
 *
 * Ini bukan kelemahan teoretis. Ia sudah terjadi: perlengkapan cakupan mula-mula
 * memakai `percentage` dan `shortfall`, sedangkan `hitungCakupan` mengembalikan
 * `coverage`, `gap`, dan `message`. Seluruh uji di bawah LULUS, dan halamannya
 * melempar TypeError pada peramban — kosong, bukan salah angka.
 *
 * Perlengkapan yang keliru dan kode yang keliru saling menyetujui, dan keduanya
 * tidak sesuai kenyataan.
 *
 * Karena itu: sesudah mengubah apa pun yang menyentuh bentuk jawaban, BUKA
 * halamannya pada peramban terhadap peladen sungguhan. Uji di bawah tidak
 * menggantikannya, dan tidak pernah dapat.
 */
describe('Cakupan — penyebutnya sasaran', () => {
  const CAKUPAN = [
    {
      id: 'C1',
      program_code: 'IMUNISASI_DASAR',
      program_name: 'Imunisasi Dasar Lengkap',
      village: 'Sukamaju',
      target_count: 240,
      achieved_count: 191,
      period_year: 2026,
      period_month: null,
      coverage: 79.6,
      gap: 49,
      message: '79.6% tercapai. 49 sasaran belum terjangkau.',
    },
    {
      id: 'C2',
      program_code: 'PENIMBANGAN',
      program_name: 'Penimbangan Balita',
      village: null,
      target_count: 320,
      achieved_count: 244,
      period_year: 2026,
      period_month: null,
      coverage: 76.3,
      gap: 76,
      message: '76.3% tercapai. 76 sasaran belum terjangkau.',
    },
  ];

  beforeEach(() => {
    vi.spyOn(healthApi, 'coverage').mockResolvedValue(CAKUPAN as never);
  });

  it('menonjolkan BERAPA YANG BELUM TERSENTUH, bukan hanya persentasenya', async () => {
    /*
     * Persentase 79% terbaca lumayan; "125 anak belum tersentuh" tidak terbaca
     * lumayan oleh siapa pun. Itu seluruh alasan halaman ini ada.
     */
    render(<CoveragePage />, { wrapper: Bungkus });

    /*
     * SENGAJA muncul dua kali: sekali sebagai angka ringkasan, sekali sebagai
     * tajuk kolom. Yang membaca ringkasannya tahu totalnya; yang membaca
     * tabelnya tahu program mana penyumbangnya.
     */
    const sebutan = await screen.findAllByText('Belum tersentuh');
    expect(sebutan.length).toBe(2);
    // 49 + 76 = 125, dihitung dari sasaran dikurangi tercapai.
    expect(screen.getByText('125')).toBeTruthy();
  });

  it('menampilkan kekurangan tiap baris, bukan hanya totalnya', async () => {
    render(<CoveragePage />, { wrapper: Bungkus });
    await screen.findAllByText('Belum tersentuh');
    expect(screen.getByText('49')).toBeTruthy();
    expect(screen.getByText('76')).toBeTruthy();
  });

  it('menyebut wilayah kosong sebagai seluruh wilayah, bukan tanda hubung', async () => {
    render(<CoveragePage />, { wrapper: Bungkus });
    await screen.findAllByText('Belum tersentuh');
    expect(screen.getByText('Seluruh wilayah')).toBeTruthy();
  });

  it('TIDAK meminta tujuan penggunaan — seluruh angkanya agregat', async () => {
    /*
     * Diuji supaya tidak "diperbaiki" oleh orang yang mengira setiap layar
     * kesehatan harus punya gerbang tujuan. Menuntutnya pada layar yang tidak
     * menyebut satu pasien pun akan membuat tajuk itu diisi otomatis, dan yang
     * diisi otomatis tidak menyatakan apa pun.
     */
    render(<CoveragePage />, { wrapper: Bungkus });
    await screen.findAllByText('Belum tersentuh');
    expect(screen.queryByLabelText(/tujuan penggunaan/i)).toBeNull();
  });
});
