import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, ClipboardList, ExternalLink, Layers3 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageHeader, StatusBadge } from '../../../components/ui';
import { api } from '../../../lib/api';

type ModuleStatus = 'TERIMPLEMENTASI' | 'SEBAGIAN' | 'FONDASI' | 'BELUM';
type Priority = 'P0' | 'P1' | 'P2' | 'P3';

interface EschoolNavigationItem {
  code: string;
  name: string;
  description: string;
  href: string;
  status: ModuleStatus;
  priority: Priority;
  metricLabel: string;
  metricValue: string;
  foundation: string;
}

const STATUS_TONE: Record<ModuleStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  TERIMPLEMENTASI: 'success',
  SEBAGIAN: 'warning',
  FONDASI: 'info',
  BELUM: 'neutral',
};

const FOUNDATION_LINKS: Record<string, Array<{ label: string; href: string; description: string }>> = {
  siswa: [
    { label: 'Data siswa', href: '/app/pesantren/santri', description: 'Fondasi peserta didik education-core.' },
    { label: 'DAPODIK siswa', href: '/app/eschool/dapodik', description: 'Template, import, export, dan rollback.' },
  ],
  guru: [
    { label: 'Guru dan penugasan', href: '/app/pesantren/guru', description: 'Fondasi GTK dan penugasan mengajar.' },
    { label: 'DAPODIK GTK', href: '/app/eschool/dapodik', description: 'Pertukaran data guru/GTK.' },
  ],
  ppdb: [
    { label: 'PPDB/PSB', href: '/app/pesantren/psb', description: 'Gelombang dan pendaftar sebagai fondasi.' },
  ],
  kelas: [
    { label: 'Rombel', href: '/app/pesantren/rombongan', description: 'Kelas dan anggota rombel.' },
    { label: 'Kurikulum', href: '/app/pesantren/kurikulum', description: 'Alokasi mapel per tingkat.' },
  ],
  akademik: [
    { label: 'Jadwal', href: '/app/pesantren/jadwal', description: 'Jadwal pelajaran dan pengajar.' },
    { label: 'Nilai', href: '/app/pesantren/nilai', description: 'Komponen nilai, skala, dan rapor dasar.' },
  ],
  presensi: [
    { label: 'Presensi', href: '/app/pesantren/presensi', description: 'Kehadiran dan kegiatan harian.' },
    { label: 'Perizinan', href: '/app/pesantren/perizinan', description: 'Izin siswa dan jejak persetujuan.' },
  ],
  bk: [
    { label: 'Pembinaan', href: '/app/pesantren/pelanggaran', description: 'Pelanggaran, tindak lanjut, dan prestasi.' },
    { label: 'Buku penghubung', href: '/app/pesantren/buku-penghubung', description: 'Catatan guru, siswa, dan orang tua.' },
  ],
  alumni: [
    { label: 'Data siswa', href: '/app/pesantren/santri', description: 'Status keluar/lulus sebagai fondasi alumni.' },
  ],
  laporan: [
    { label: 'Laporan education', href: '/app/education/implementasi', description: 'Roadmap dan dataset nasional.' },
    { label: 'Laporan pesantren', href: '/app/pesantren/laporan', description: 'Fondasi laporan operasional.' },
  ],
};

const NEXT_STEPS: Record<string, string[]> = {
  siswa: ['Pisahkan istilah santri menjadi siswa di form dan export.', 'Tambah filter sekolah/unit formal dan status mutasi sekolah.', 'Validasi NISN/NIK/NIPD lebih kuat.'],
  guru: ['Tambah NUPTK, jenis PTK, tugas tambahan, dan riwayat mengajar.', 'Pisahkan guru sekolah dari ustadz/pengajar pesantren.', 'Siapkan export DAPODIK GTK.'],
  ppdb: ['Buat formulir PPDB sekolah formal.', 'Tambah kartu peserta dan verifikasi berkas.', 'Sediakan laporan hasil seleksi per jalur masuk.'],
  kelas: ['Tambah semester dan kurikulum nasional per jenjang.', 'Pisahkan kelas paralel dan rombel DAPODIK.', 'Tambah validasi kapasitas dan wali kelas.'],
  akademik: ['Finalisasi rapor PDF sekolah.', 'Tambah leger, kenaikan kelas, dan kelulusan.', 'Sediakan QR verifikasi dan tanda tangan digital.'],
  presensi: ['Tambah presensi kelas per jam pelajaran.', 'Sediakan rekap wali kelas dan notifikasi orang tua.', 'Tambah export presensi bulanan.'],
  bk: ['Buat workflow konseling BK.', 'Tambah kategori kasus, rencana tindak lanjut, dan monitoring.', 'Pisahkan catatan internal dan catatan untuk orang tua.'],
  perpustakaan: ['Buat entity buku, eksemplar, anggota, peminjaman, dan denda.', 'Tambah barcode/QR buku.', 'Sediakan statistik literasi siswa.'],
  sarpras: ['Buat master ruang, aset, kondisi, dan jadwal perawatan.', 'Hubungkan sarpras ke akreditasi.', 'Tambah lampiran foto/bukti pemeriksaan.'],
  akreditasi: ['Buat evidence center per standar.', 'Tambah checklist dokumen dan status pemenuhan.', 'Hubungkan ke surat, arsip, dan media.'],
  alumni: ['Buat tracer study lulusan.', 'Tambah riwayat lanjut studi/kerja.', 'Sediakan komunitas dan kampanye alumni.'],
  laporan: ['Satukan laporan siswa, guru, kelas, PPDB, nilai, DAPODIK.', 'Tambahkan export Excel/PDF per modul.', 'Buat dashboard pimpinan sekolah.'],
};

export function EschoolOperationalPage() {
  const params = useParams();
  const moduleCode = params.moduleCode ?? 'dashboard';
  const navigationQuery = useQuery({
    queryKey: ['eschool-navigation'],
    queryFn: () => api.get<EschoolNavigationItem[]>('/eschool/navigation'),
  });
  const modules = navigationQuery.data ?? [];
  const module = useMemo(() => modules.find((item) => item.code === moduleCode), [moduleCode, modules]);
  const current = module ?? fallbackModule(moduleCode);
  const links = FOUNDATION_LINKS[current.code] ?? [];
  const steps = NEXT_STEPS[current.code] ?? ['Siapkan entity khusus eSchool.', 'Tambahkan CRUD, import/export, PDF, dan dashboard.', 'Hubungkan ke menu dan RBAC sekolah.'];

  return (
    <>
      <PageHeader
        title={current.name}
        description={current.description}
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'eSchool', href: '/app/eschool' }, { label: current.name }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className="btn-outline" to="/app/eschool">
              <Layers3 className="h-4 w-4" aria-hidden />
              Dashboard
            </Link>
            <Link className="btn-primary" to="/app/eschool/dapodik">
              <ExternalLink className="h-4 w-4" aria-hidden />
              DAPODIK
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="card p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={current.status} tone={STATUS_TONE[current.status]} />
            <StatusBadge status={current.priority} tone={current.priority === 'P0' ? 'danger' : current.priority === 'P1' ? 'warning' : 'neutral'} />
          </div>
          <h2 className="mt-5 text-xl font-semibold text-slate-950 dark:text-white">Fondasi saat ini</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{current.foundation}</p>
          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{current.metricLabel}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{current.metricValue}</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-950 dark:text-white">Langkah implementasi berikutnya</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Urutan kerja dibuat agar modul berubah dari facade menjadi vertical sekolah formal yang mandiri.</p>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {steps.map((step, index) => (
              <div key={step} className="flex gap-3 p-5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {index + 1}
                </span>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {links.length > 0 && (
        <section className="mt-5 card p-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
            <h2 className="font-semibold text-slate-950 dark:text-white">Buka fondasi yang sudah berjalan</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => (
              <Link key={link.href} to={link.href} className="group rounded-lg border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:border-slate-800 dark:hover:border-emerald-800 dark:hover:bg-emerald-950/20">
                <div className="flex items-start justify-between gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-300" aria-hidden />
                  <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-emerald-700" aria-hidden />
                </div>
                <h3 className="mt-3 font-semibold text-slate-950 dark:text-white">{link.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{link.description}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function fallbackModule(code: string): EschoolNavigationItem {
  const label = code
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ') || 'Modul eSchool';
  return {
    code,
    name: label,
    description: 'Modul eSchool ini disiapkan sebagai namespace sekolah formal dan akan dilengkapi bertahap.',
    href: `/app/eschool/${code}`,
    status: 'BELUM',
    priority: 'P2',
    metricLabel: 'Roadmap',
    metricValue: 'P2',
    foundation: 'Belum ada fondasi khusus yang aktif.',
  };
}
