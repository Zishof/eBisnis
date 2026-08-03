import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { api, formatDate, formatMoney } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface ModulRow extends Record<string, unknown> {
  __rowKey?: string;
  id?: string;
  code?: string;
  kode?: string;
  nama?: string;
  nama_lengkap?: string;
  judul?: string;
  status?: string;
  created_at?: string;
}

interface ModulConfig {
  title: string;
  description: string;
  endpoint: string;
  breadcrumbsLabel: string;
  columns: Array<{ key: string; header: string; kind?: 'date' | 'money' | 'status' }>;
  paged?: boolean;
  statusOptions?: string[];
  searchParam?: string;
}

const PAGE_SIZE = 25;

export const PESANTREN_MODUL: Record<string, ModulConfig> = {
  rombongan: {
    title: 'Rombongan Belajar',
    description: 'Daftar kelas atau rombongan belajar santri per unit pendidikan.',
    endpoint: '/pesantren/rombongan',
    breadcrumbsLabel: 'Rombongan',
    paged: true,
    columns: [
      { key: 'tingkat', header: 'Tingkat' },
      { key: 'nama', header: 'Nama' },
      { key: 'kapasitas', header: 'Kapasitas' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'created_at', header: 'Dibuat', kind: 'date' },
    ],
  },
  kurikulum: {
    title: 'Kurikulum',
    description: 'Komponen mata pelajaran dan jam per minggu untuk unit pendidikan.',
    endpoint: '/pesantren/kurikulum',
    breadcrumbsLabel: 'Kurikulum',
    columns: [
      { key: 'tingkat', header: 'Tingkat' },
      { key: 'mata_pelajaran_id', header: 'Mata Pelajaran' },
      { key: 'jam_per_minggu', header: 'JP' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'created_at', header: 'Dibuat', kind: 'date' },
    ],
  },
  diniyah: {
    title: 'Diniyah',
    description: 'Katalog kitab dan halaqah diniyah pondok.',
    endpoint: '/pesantren/halaqah',
    breadcrumbsLabel: 'Diniyah',
    columns: [
      { key: 'code', header: 'Kode' },
      { key: 'nama', header: 'Nama Halaqah' },
      { key: 'kitab_judul', header: 'Kitab' },
      { key: 'jumlah_anggota', header: 'Anggota' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  kitab: {
    title: 'Kitab',
    description: 'Katalog kitab untuk pembelajaran diniyah.',
    endpoint: '/pesantren/kitab',
    breadcrumbsLabel: 'Kitab',
    columns: [
      { key: 'code', header: 'Kode' },
      { key: 'judul', header: 'Judul' },
      { key: 'pengarang', header: 'Pengarang' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  guru: {
    title: 'Guru dan Ustadz',
    description: 'Daftar pengajar aktif, formal maupun diniyah.',
    endpoint: '/pesantren/guru',
    breadcrumbsLabel: 'Guru',
    paged: true,
    searchParam: 'cari',
    statusOptions: ['AKTIF', 'NONAKTIF'],
    columns: [
      { key: 'nip', header: 'NIP' },
      { key: 'nama', header: 'Nama' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'no_hp', header: 'HP' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  kartu: {
    title: 'Kartu Santri',
    description: 'Kartu RFID/QR santri yang aktif maupun sudah dinonaktifkan.',
    endpoint: '/pesantren/kartu',
    breadcrumbsLabel: 'Kartu',
    columns: [
      { key: 'nomor_kartu', header: 'Nomor Kartu' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'santri_id', header: 'Santri' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'created_at', header: 'Dibuat', kind: 'date' },
    ],
  },
  tahfiz: {
    title: 'Tahfiz',
    description: 'Catatan setoran hafalan santri.',
    endpoint: '/pesantren/tahfiz',
    breadcrumbsLabel: 'Tahfiz',
    paged: true,
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'santri_id', header: 'Santri' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'juz', header: 'Juz' },
      { key: 'predikat', header: 'Predikat', kind: 'status' },
    ],
  },
  presensi: {
    title: 'Presensi Santri',
    description: 'Daftar presensi harian santri berdasarkan tanggal dan jenis kegiatan.',
    endpoint: '/pesantren/presensi',
    breadcrumbsLabel: 'Presensi',
    paged: true,
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'santri_id', header: 'Santri' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'keterangan', header: 'Keterangan' },
    ],
  },
  nilai: {
    title: 'Nilai',
    description: 'Katalog mata pelajaran sebagai dasar penilaian dan rapor.',
    endpoint: '/pesantren/nilai/mata-pelajaran',
    breadcrumbsLabel: 'Nilai',
    columns: [
      { key: 'code', header: 'Kode' },
      { key: 'nama', header: 'Mata Pelajaran' },
      { key: 'kelompok', header: 'Kelompok' },
      { key: 'jenjang', header: 'Jenjang' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  'absensi-guru': {
    title: 'Absensi Guru',
    description: 'Daftar kehadiran guru dan ustadz.',
    endpoint: '/pesantren/absensi-guru',
    breadcrumbsLabel: 'Absensi Guru',
    paged: true,
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'guru_id', header: 'Guru' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'jam_masuk', header: 'Masuk' },
      { key: 'jam_pulang', header: 'Pulang' },
    ],
  },
  ekstrakurikuler: {
    title: 'Ekstrakurikuler',
    description: 'Daftar kegiatan ekstrakurikuler dan organisasi santri.',
    endpoint: '/pesantren/ekstrakurikuler',
    breadcrumbsLabel: 'Ekstrakurikuler',
    columns: [
      { key: 'code', header: 'Kode' },
      { key: 'nama', header: 'Nama' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'pembina_guru_id', header: 'Pembina' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  prestasi: {
    title: 'Prestasi',
    description: 'Daftar prestasi kompetisi santri.',
    endpoint: '/pesantren/prestasi',
    breadcrumbsLabel: 'Prestasi',
    paged: true,
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'santri_id', header: 'Santri' },
      { key: 'cabang', header: 'Cabang' },
      { key: 'nama_kompetisi', header: 'Kompetisi' },
      { key: 'peringkat', header: 'Peringkat', kind: 'status' },
    ],
  },
  'buku-penghubung': {
    title: 'Buku Penghubung',
    description: 'Catatan guru, pengurus, dan wali untuk tindak lanjut perkembangan santri.',
    endpoint: '/pesantren/buku-penghubung',
    breadcrumbsLabel: 'Buku Penghubung',
    paged: true,
    statusOptions: ['TERBUKA', 'SELESAI'],
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'nis', header: 'NIS' },
      { key: 'nama_lengkap', header: 'Santri' },
      { key: 'jenis', header: 'Jenis', kind: 'status' },
      { key: 'judul', header: 'Judul' },
      { key: 'visibilitas', header: 'Visibilitas', kind: 'status' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  perizinan: {
    title: 'Perizinan Santri',
    description: 'Pengajuan izin keluar dan keputusan pengurus.',
    endpoint: '/pesantren/perizinan',
    breadcrumbsLabel: 'Perizinan',
    paged: true,
    statusOptions: ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'SELESAI', 'DIBATALKAN'],
    columns: [
      { key: 'santri_id', header: 'Santri' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'tanggal_mulai', header: 'Mulai', kind: 'date' },
      { key: 'tanggal_selesai_rencana', header: 'Rencana Kembali', kind: 'date' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  pelanggaran: {
    title: 'Pelanggaran',
    description: 'Catatan pembinaan dan pelanggaran tata tertib santri.',
    endpoint: '/pesantren/pelanggaran',
    breadcrumbsLabel: 'Pelanggaran',
    paged: true,
    statusOptions: ['TERCATAT', 'DITINDAKLANJUTI', 'SELESAI'],
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'santri_id', header: 'Santri' },
      { key: 'jenis', header: 'Jenis' },
      { key: 'poin', header: 'Poin' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  dompet: {
    title: 'Dompet Santri',
    description: 'Saldo dan batas harian dompet santri.',
    endpoint: '/pesantren/dompet',
    breadcrumbsLabel: 'Dompet',
    columns: [
      { key: 'santri_id', header: 'Santri' },
      { key: 'saldo', header: 'Saldo', kind: 'money' },
      { key: 'batas_harian', header: 'Batas Harian', kind: 'money' },
      { key: 'status', header: 'Status', kind: 'status' },
      { key: 'created_at', header: 'Dibuat', kind: 'date' },
    ],
  },
  laporan: {
    title: 'Laporan ePesantren',
    description: 'Daftar laporan operasional yang tersedia di backend.',
    endpoint: '/pesantren/laporan',
    breadcrumbsLabel: 'Laporan',
    columns: [
      { key: 'code', header: 'Kode' },
      { key: 'nama', header: 'Nama' },
      { key: 'description', header: 'Keterangan' },
    ],
  },
  katering: {
    title: 'Katering',
    description: 'Daftar menu makan yang disiapkan dapur pesantren.',
    endpoint: '/pesantren/katering/menu',
    breadcrumbsLabel: 'Katering',
    columns: [
      { key: 'tanggal', header: 'Tanggal', kind: 'date' },
      { key: 'waktu_makan', header: 'Waktu' },
      { key: 'nama_menu', header: 'Menu' },
      { key: 'jumlah_porsi_disiapkan', header: 'Porsi' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
  gerbang: {
    title: 'Gerbang Santri',
    description: 'Log keluar-masuk santri terkait izin yang disetujui.',
    endpoint: '/pesantren/gerbang',
    breadcrumbsLabel: 'Gerbang',
    paged: true,
    columns: [
      { key: 'izin_id', header: 'Izin' },
      { key: 'arah', header: 'Arah', kind: 'status' },
      { key: 'waktu', header: 'Waktu', kind: 'date' },
      { key: 'catatan', header: 'Catatan' },
    ],
  },
  'portal-wali': {
    title: 'Portal Wali',
    description: 'Daftar anak yang terhubung ke akun wali yang sedang masuk.',
    endpoint: '/pesantren/portal/wali/anak',
    breadcrumbsLabel: 'Portal Wali',
    columns: [
      { key: 'santri_id', header: 'Santri' },
      { key: 'nis', header: 'NIS' },
      { key: 'nama_lengkap', header: 'Nama' },
      { key: 'status_tinggal', header: 'Tinggal' },
      { key: 'status', header: 'Status', kind: 'status' },
    ],
  },
};

export function PesantrenDaftarModulPage({ module }: { module: keyof typeof PESANTREN_MODUL }) {
  const toMessage = useErrorMessage();
  const config = PESANTREN_MODUL[module];
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [cari, setCari] = useState('');

  const query = useQuery({
    queryKey: ['pesantren-modul', module, page, status, cari],
    queryFn: () => {
      const params = new URLSearchParams();
      if (config.paged) {
        params.set('halaman', String(page));
        params.set('ukuranHalaman', String(PAGE_SIZE));
      }
      if (status) params.set('status', status);
      if (config.searchParam && cari) params.set(config.searchParam, cari);
      const qs = params.toString();
      return api.get<unknown>(`${config.endpoint}${qs ? `?${qs}` : ''}`);
    },
  });

  const rows = useMemo(() => normalisasiRows(query.data), [query.data]);
  const total = totalDariResponse(query.data, rows.length);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Array<GridColumn<ModulRow>> = config.columns.map((column) => ({
    key: column.key,
    header: column.header,
    render: (row) => renderNilai(row[column.key], column.kind),
  }));

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: config.breadcrumbsLabel }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void query.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />

      {(config.statusOptions || config.searchParam) && (
        <div className="card mb-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            {config.searchParam && (
              <div className="min-w-[220px] flex-1">
                <label className="field-label" htmlFor={`modul-${module}-cari`}>
                  Cari
                </label>
                <input
                  id={`modul-${module}-cari`}
                  className="field-input"
                  value={cari}
                  onChange={(e) => {
                    setCari(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            )}
            {config.statusOptions && (
              <div className="min-w-[180px]">
                <label className="field-label" htmlFor={`modul-${module}-status`}>
                  Status
                </label>
                <select
                  id={`modul-${module}-status`}
                  className="field-input"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">Semua</option>
                  {config.statusOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      <DataGrid
        columns={columns}
        rows={rows}
        loading={query.isLoading}
        error={query.isError ? toMessage(query.error, (_key, fallback) => fallback ?? 'Gagal memuat data.') : undefined}
        rowKey={(row) => row.__rowKey ?? String(row.id ?? row.code ?? row.kode ?? 'row')}
        onRetry={() => void query.refetch()}
        emptyTitle="Belum ada data."
      />

      {config.paged && <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />}
    </>
  );
}

function normalisasiRows(data: unknown): ModulRow[] {
  if (Array.isArray(data)) return beriKunci(data.filter(isObject) as ModulRow[]);
  if (isObject(data) && Array.isArray(data.items)) return beriKunci(data.items.filter(isObject) as ModulRow[]);
  if (isObject(data) && Array.isArray(data.reports)) return beriKunci(data.reports.filter(isObject) as ModulRow[]);
  return [];
}

function totalDariResponse(data: unknown, fallback: number): number {
  if (isObject(data) && typeof data.total === 'number') return data.total;
  return fallback;
}

function renderNilai(value: unknown, kind?: 'date' | 'money' | 'status') {
  if (kind === 'status') return <StatusBadge status={String(value ?? '-')} />;
  if (kind === 'date') return formatDate(typeof value === 'string' ? value : null);
  if (kind === 'money') return formatMoney(typeof value === 'number' || typeof value === 'string' ? value : 0);
  if (value == null || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  return String(value);
}

function beriKunci(rows: ModulRow[]): ModulRow[] {
  return rows.map((row, index) => ({
    ...row,
    __rowKey: String(row.id ?? row.code ?? row.kode ?? `${index}`),
  }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
