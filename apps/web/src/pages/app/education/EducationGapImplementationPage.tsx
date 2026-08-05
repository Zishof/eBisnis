import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileSpreadsheet,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  Library,
  Network,
  School,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { PageHeader, StatusBadge } from '../../../components/ui';
import { api } from '../../../lib/api';

type ProductKey = 'epesantren' | 'eschool' | 'ecampus';
type ModuleStatus = 'TERIMPLEMENTASI' | 'SEBAGIAN' | 'FONDASI' | 'BELUM';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface EducationModule {
  code: string;
  name: string;
  product: ProductKey;
  status: ModuleStatus;
  priority: Priority;
  summary: string;
  implementedBy: string;
  nextAction: string;
  href?: string;
}

interface DatasetDefinition {
  code: string;
  name: string;
  standard: 'DAPODIK' | 'EMIS' | 'FEEDER';
  owner: ProductKey[];
  status: ModuleStatus;
  requiredFields: string[];
  importEndpoint?: string;
  exportEndpoint?: string;
  templateEndpoint?: string;
}

interface RoadmapItem {
  priority: Priority;
  title: string;
  items: string[];
}

const PRODUCTS: Record<ProductKey, { label: string; description: string; icon: typeof School }> = {
  epesantren: {
    label: 'ePesantren',
    description: 'Operasional pondok, santri mukim, diniyah, tahfiz, asrama, gerbang, wali, dan unit pendidikan.',
    icon: School,
  },
  eschool: {
    label: 'eSchool',
    description: 'Operasional sekolah formal: siswa, guru, rombel, kurikulum, PPDB, DAPODIK, BK, dan rapor.',
    icon: GraduationCap,
  },
  ecampus: {
    label: 'eCampus',
    description: 'Operasional perguruan tinggi: mahasiswa, dosen, prodi, PMB, KRS/KHS, OBE, Feeder, dan mutu.',
    icon: Landmark,
  },
};

const MODULES: EducationModule[] = [
  {
    code: 'EP-DASH',
    name: 'Dashboard pondok',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P1',
    summary: 'KPI santri, PSB, tagihan, asrama, rombel, dan ringkasan operasional pondok.',
    implementedBy: 'PesantrenDashboardPage dan /pesantren/laporan/dasbor.',
    nextAction: 'Tambahkan drilldown tren presensi, pembinaan, dompet, dan alarm harian.',
    href: '/app',
  },
  {
    code: 'EP-MASTER',
    name: 'Profil, unit, situs, dan CMS',
    product: 'epesantren',
    status: 'TERIMPLEMENTASI',
    priority: 'P0',
    summary: 'Profil pondok, unit pendidikan, media, berita, situs pondok, situs unit, dan subdomain.',
    implementedBy: 'Profil, media, berita, unit pendidikan, SitusPondokPage, dan SitusUnitPage.',
    nextAction: 'Samakan seluruh section agar gambar bisa diganti admin dan tidak ada header ganda.',
    href: '/app/pesantren/profil',
  },
  {
    code: 'EP-SANTRI',
    name: 'Santri, wali, alumni, dan DAPODIK',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Biodata santri/wali, status akhir, referensi nasional, dan integrasi DAPODIK.',
    implementedBy: 'PesantrenSantriPage dan PesantrenDapodikPage.',
    nextAction: 'Lengkapi riwayat mutasi/alumni dan dokumen legal per santri.',
    href: '/app/pesantren/santri',
  },
  {
    code: 'EP-PSB',
    name: 'PSB/PPDB online',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Gelombang, pendaftar, jadwal, portal pendaftar, dan status seleksi.',
    implementedBy: 'PesantrenPsbPage dan portal PSB publik.',
    nextAction: 'Tambah kartu peserta, matriks verifikasi dokumen, dan form builder lanjutan.',
    href: '/app/pesantren/psb',
  },
  {
    code: 'EP-AKADEMIK',
    name: 'Kurikulum, rombel, jadwal, nilai, rapor',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Rombel, kurikulum, jadwal, komponen nilai, skala huruf, input nilai, dan rapor dasar.',
    implementedBy: 'PesantrenKelasKurikulumPage, PesantrenJadwalPage, PesantrenNilaiPage.',
    nextAction: 'Cetak rapor PDF, leger, ranking, kenaikan kelas, dan validasi bentrok jadwal.',
    href: '/app/pesantren/nilai',
  },
  {
    code: 'EP-ASRAMA',
    name: 'Asrama, izin, gerbang, kiosk',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Asrama/kamar, perizinan, log keluar-masuk, kiosk, kartu, dan portal wali.',
    implementedBy: 'PesantrenAsramaPage, PesantrenPerizinanPage, PesantrenGerbangPage, PesantrenKioskPage.',
    nextAction: 'Tambah scanner tablet/PC, kunjungan wali, paket, penjemputan, dan mode offline ringan.',
    href: '/app/pesantren/gerbang',
  },
  {
    code: 'EP-PEMBINAAN',
    name: 'Diniyah, tahfiz, BK, pelanggaran, prestasi',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P1',
    summary: 'Kajian, halaqah, tahfiz, pelanggaran, prestasi, ekskul, dan buku penghubung.',
    implementedBy: 'PesantrenDakwahPage dan PesantrenPembinaanPage.',
    nextAction: 'Tambah workflow BK, konseling, target tahfiz personal, dan rapor diniyah.',
    href: '/app/pesantren/dakwah',
  },
  {
    code: 'EP-KEUANGAN',
    name: 'Tagihan, pembayaran, dompet, POS, koperasi',
    product: 'epesantren',
    status: 'SEBAGIAN',
    priority: 'P0',
    summary: 'Tagihan SPP, pembayaran, dompet santri, batas harian, serta koneksi POS.',
    implementedBy: 'PesantrenTagihanPage, PesantrenDompetPage, POS, payment, billing, accounting.',
    nextAction: 'Rekonsiliasi payment gateway, settlement dompet-POS, dan posting jurnal otomatis.',
    href: '/app/pesantren/tagihan',
  },
  {
    code: 'ES-MASTER',
    name: 'Master sekolah dan unit formal',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P1',
    summary: 'Profil sekolah, NPSN, jenjang, tahun ajaran, semester, kelas, rombel, dan alamat.',
    implementedBy: 'Fondasi dapat memakai unit pendidikan, rombel, kurikulum, tenant, dan profil.',
    nextAction: 'Buat namespace eSchool dan mapping sekolah formal dari unit pendidikan.',
    href: '/app/pesantren/unit-pendidikan',
  },
  {
    code: 'ES-SISWA',
    name: 'Siswa, orang tua, dan DAPODIK',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P1',
    summary: 'Biodata siswa, NISN, NIK, wali, mutasi, alumni, dan referensi nasional.',
    implementedBy: 'Facade DAPODIK eSchool memakai mesin DAPODIK ePesantren sebagai fondasi education-core.',
    nextAction: 'Buat facade siswa eSchool agar istilah, filter unit formal, dan validasi sesuai sekolah formal.',
    href: '/app/eschool/dapodik',
  },
  {
    code: 'ES-AKADEMIK',
    name: 'Akademik sekolah, rapor, PPDB',
    product: 'eschool',
    status: 'FONDASI',
    priority: 'P1',
    summary: 'Mapel, kurikulum, jadwal, nilai, rapor, ujian, kelulusan, dan PPDB sekolah.',
    implementedBy: 'Pola rombel, kurikulum, jadwal, nilai, dan PSB sudah tersedia di ePesantren.',
    nextAction: 'Tambah rapor sekolah resmi, kartu PPDB sekolah, dan finalisasi export DAPODIK khusus sekolah formal.',
    href: '/app/pesantren/psb',
  },
  {
    code: 'ES-LAYANAN',
    name: 'BK, perpustakaan, sarpras, akreditasi, alumni',
    product: 'eschool',
    status: 'BELUM',
    priority: 'P2',
    summary: 'Layanan pendukung sekolah untuk mutu, aset, literasi, konseling, dan jejaring alumni.',
    implementedBy: 'Belum ada domain eSchool khusus; sebagian bisa memakai surat, CMS, dan pembinaan.',
    nextAction: 'Buat modul BK sekolah terlebih dahulu, lalu sarpras/perpustakaan/akreditasi.',
  },
  {
    code: 'EC-MASTER',
    name: 'Master PT, fakultas, prodi',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P2',
    summary: 'Identitas perguruan tinggi, fakultas, prodi, jenjang, akreditasi, dan struktur organisasi.',
    implementedBy: 'Belum ada domain kampus; platform tenant dapat menjadi fondasi.',
    nextAction: 'Buat entity PT/fakultas/prodi sebagai inti eCampus MVP.',
  },
  {
    code: 'EC-AKADEMIK',
    name: 'Mahasiswa, dosen, PMB, KRS/KHS',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P2',
    summary: 'Mahasiswa, dosen, PMB, kurikulum, kelas kuliah, KRS, KHS, transkrip, dan wisuda.',
    implementedBy: 'Belum ada; pola santri/guru/PSB/nilai bisa menjadi referensi implementasi.',
    nextAction: 'Implementasi MVP dimulai dari mahasiswa, dosen, PMB, kelas kuliah, KRS, dan nilai.',
  },
  {
    code: 'EC-MUTU',
    name: 'OBE, MBKM, Feeder, SPMI, SPI, akreditasi',
    product: 'ecampus',
    status: 'BELUM',
    priority: 'P3',
    summary: 'Pelaporan nasional dan mutu perguruan tinggi: CPL/CPMK, PD-Dikti, SAPTO, PPEPP, dan AMI.',
    implementedBy: 'Belum ada; governance, surat, dan AI dapat mendukung evidence center.',
    nextAction: 'Buat mapping Feeder dan repository evidence setelah master akademik kampus selesai.',
  },
];

const DATASETS: DatasetDefinition[] = [
  {
    code: 'dapodik-siswa',
    name: 'Siswa/Santri',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['NISN', 'NIK', 'nama', 'tanggal lahir', 'jenis kelamin', 'wali', 'alamat'],
  },
  {
    code: 'dapodik-guru',
    name: 'Guru dan tenaga pendidik',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['NUPTK/NIP', 'nama', 'jenis PTK', 'mapel', 'status aktif'],
  },
  {
    code: 'dapodik-rombel',
    name: 'Rombel, anggota rombel, mapel, jadwal',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'SEBAGIAN',
    requiredFields: ['tahun ajaran', 'semester', 'tingkat', 'rombongan', 'anggota', 'mapel'],
  },
  {
    code: 'dapodik-nilai',
    name: 'Nilai dan rapor',
    standard: 'DAPODIK',
    owner: ['epesantren', 'eschool'],
    status: 'FONDASI',
    requiredFields: ['komponen nilai', 'nilai angka', 'predikat', 'deskripsi', 'semester'],
  },
  {
    code: 'emis-pesantren',
    name: 'EMIS pesantren/madrasah',
    standard: 'EMIS',
    owner: ['epesantren'],
    status: 'BELUM',
    requiredFields: ['NSM/NPSN', 'santri', 'ustadz', 'rombel', 'lembaga', 'sarana'],
  },
  {
    code: 'feeder-kampus',
    name: 'Feeder/PD-Dikti',
    standard: 'FEEDER',
    owner: ['ecampus'],
    status: 'BELUM',
    requiredFields: ['mahasiswa', 'dosen', 'prodi', 'kelas kuliah', 'KRS', 'nilai', 'aktivitas'],
  },
];

const ROADMAP: RoadmapItem[] = [
  {
    priority: 'P0',
    title: 'Sempurnakan ePesantren yang sudah paling dekat produksi',
    items: [
      'Rapor PDF, PSB lanjut, DAPODIK penuh, payment reconciliation, gerbang QR.',
      'Situs pondok/unit konsisten, gambar bisa diganti admin, responsif mobile/desktop.',
    ],
  },
  {
    priority: 'P1',
    title: 'Jadikan eSchool vertical nyata',
    items: ['Namespace eSchool, siswa/guru/rombongan, PPDB, BK, portal orang tua.'],
  },
  {
    priority: 'P2',
    title: 'Buat eCampus MVP',
    items: ['Master eCampus, mahasiswa, dosen, PMB, KRS/KHS, tagihan UKT.'],
  },
  {
    priority: 'P3',
    title: 'Modul diferensiasi dan otomasi',
    items: ['Feeder, SPMI/SPI, akreditasi, AI assistant, analytics lanjutan.'],
  },
];

const STATUS_TONE: Record<ModuleStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  TERIMPLEMENTASI: 'success',
  SEBAGIAN: 'warning',
  FONDASI: 'info',
  BELUM: 'neutral',
};

const HIGHLIGHT_ICONS = [LayoutDashboard, FileSpreadsheet, BookOpenCheck, ShieldCheck, DatabaseZap, BarChart3];

export function EducationGapImplementationPage() {
  const location = useLocation();
  const [product, setProduct] = useState<ProductKey>(() => produkDariPath(location.pathname));
  const modulesQuery = useQuery({
    queryKey: ['education-gap-modules'],
    queryFn: () => api.get<EducationModule[]>('/education/modules'),
  });
  const datasetsQuery = useQuery({
    queryKey: ['education-datasets'],
    queryFn: () => api.get<DatasetDefinition[]>('/education/datasets'),
  });
  const roadmapQuery = useQuery({
    queryKey: ['education-roadmap'],
    queryFn: () => api.get<RoadmapItem[]>('/education/roadmap'),
  });
  const modules = modulesQuery.data ?? MODULES;
  const datasets = datasetsQuery.data ?? DATASETS;
  const roadmap = roadmapQuery.data ?? ROADMAP;
  const visibleModules = useMemo(() => modules.filter((item) => item.product === product), [modules, product]);
  const visibleDatasets = useMemo(() => datasets.filter((item) => item.owner.includes(product)), [datasets, product]);
  const counts = useMemo(
    () =>
      modules.reduce(
        (acc, item) => {
          acc[item.product] += 1;
          return acc;
        },
        { epesantren: 0, eschool: 0, ecampus: 0 } satisfies Record<ProductKey, number>,
      ),
    [modules],
  );

  return (
    <>
      <PageHeader
        title="Pusat Implementasi Education"
        description="Peta kerja ePesantren, eSchool, dan eCampus berdasarkan gap analysis. Halaman ini menjadi pengganti layar kosong: admin bisa melihat modul yang sudah ada, fondasi yang bisa dipakai ulang, serta pekerjaan berikutnya."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Education' }, { label: 'Implementasi' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-outline" to={product === 'eschool' ? '/app/eschool/dapodik' : '/app/pesantren/dapodik'}>
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              DAPODIK
            </Link>
            <a className="btn-primary" href="/docs/gap-analysis-epesantren-eschool-ecampus-2026-08-05.md">
              <ArrowRight className="h-4 w-4" aria-hidden />
              Gap Analysis
            </a>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-3">
        {(Object.keys(PRODUCTS) as ProductKey[]).map((key) => {
          const Icon = PRODUCTS[key].icon;
          const active = product === key;
          return (
            <button
              key={key}
              type="button"
              className={`card p-5 text-left transition ${
                active ? 'border-brand-300 bg-brand-50/70 dark:border-brand-700 dark:bg-brand-950/40' : 'hover:border-brand-200 dark:hover:border-brand-800'
              }`}
              onClick={() => setProduct(key)}
            >
              <span className="grid h-11 w-11 place-items-center rounded-lg bg-white text-brand-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-brand-300 dark:ring-slate-800">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div className="mt-4 flex items-center justify-between gap-3">
                <h2 className="font-semibold text-slate-950 dark:text-white">{PRODUCTS[key].label}</h2>
                <StatusBadge status={`${counts[key]} modul`} tone={active ? 'brand' : 'neutral'} />
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{PRODUCTS[key].description}</p>
            </button>
          );
        })}
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700 dark:text-brand-300">
                  {PRODUCTS[product].label}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Daftar modul dan pekerjaan berikutnya</h2>
              </div>
              <StatusBadge status={product === 'epesantren' ? 'Production hardening' : 'Vertical build-out'} tone="info" />
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleModules.map((module, index) => {
              const Icon = HIGHLIGHT_ICONS[index % HIGHLIGHT_ICONS.length] ?? ClipboardCheck;
              return (
                <article key={module.code} className="grid gap-4 p-5 lg:grid-cols-[auto_1fr_auto]">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-950 dark:text-white">{module.name}</h3>
                      <StatusBadge status={module.status} tone={STATUS_TONE[module.status]} />
                      <StatusBadge status={module.priority} tone={module.priority === 'P0' ? 'danger' : module.priority === 'P1' ? 'warning' : 'neutral'} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{module.summary}</p>
                    <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-200">Sudah ada/fondasi</dt>
                        <dd className="mt-1 text-slate-600 dark:text-slate-300">{module.implementedBy}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-700 dark:text-slate-200">Pekerjaan berikutnya</dt>
                        <dd className="mt-1 text-slate-600 dark:text-slate-300">{module.nextAction}</dd>
                      </div>
                    </dl>
                  </div>
                  {module.href ? (
                    <Link className="btn-outline self-start" to={module.href}>
                      Buka
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  ) : (
                    <span className="self-start rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Antrian build
                    </span>
                  )}
                </article>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold text-slate-950 dark:text-white">Dataset nasional</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Menu import/export diarahkan ke standar yang sesuai: DAPODIK/EMIS untuk pesantren dan sekolah, Feeder untuk kampus.
            </p>
            <div className="mt-4 space-y-3">
              {visibleDatasets.map((dataset) => (
                <div key={dataset.code} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{dataset.standard}</p>
                      <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{dataset.name}</h3>
                    </div>
                    <StatusBadge status={dataset.status} tone={STATUS_TONE[dataset.status]} />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Kolom kunci: {dataset.requiredFields.join(', ')}.
                  </p>
                  {(dataset.templateEndpoint || dataset.exportEndpoint || dataset.importEndpoint) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {dataset.templateEndpoint && <span className="rounded bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">template</span>}
                      {dataset.exportEndpoint && <span className="rounded bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">export</span>}
                      {dataset.importEndpoint && <span className="rounded bg-slate-100 px-2 py-1 text-slate-600 dark:bg-slate-900 dark:text-slate-300">import</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="font-semibold text-slate-950 dark:text-white">Prioritas eksekusi</h2>
            <div className="mt-4 space-y-3">
              {roadmap.map((item) => (
                <div key={item.priority} className="flex gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                    {item.priority}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.items.join(' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {[
          { icon: UsersRound, label: 'Shared education-core', value: 'Peserta didik, pendidik, wali, periode, kelas, jadwal, nilai.' },
          { icon: Network, label: 'Adapter vertical', value: 'Pesantren, sekolah, dan kampus punya istilah, aturan, dan integrasi sendiri.' },
          { icon: CheckCircle2, label: 'Tanpa layar kosong', value: 'Modul yang belum penuh tetap punya peta kerja, status, dan rute tindak lanjut.' },
          { icon: Building2, label: 'Multi lembaga', value: 'Pondok, unit sekolah, dan kampus dapat berjalan dalam tenant/domain berbeda.' },
          { icon: Library, label: 'Dokumen dan evidence', value: 'Surat, arsip, akreditasi, dan mutu disatukan dengan CMS dan audit.' },
          { icon: UserRoundCheck, label: 'Peran jelas', value: 'Admin, pengurus, guru, wali, petugas gerbang, dan pimpinan dipisah lewat RBAC.' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="card p-5">
              <Icon className="h-5 w-5 text-brand-700 dark:text-brand-300" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">{item.label}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.value}</p>
            </div>
          );
        })}
      </section>
    </>
  );
}

function produkDariPath(pathname: string): ProductKey {
  if (pathname.includes('/ecampus')) return 'ecampus';
  if (pathname.includes('/eschool')) return 'eschool';
  return 'epesantren';
}
