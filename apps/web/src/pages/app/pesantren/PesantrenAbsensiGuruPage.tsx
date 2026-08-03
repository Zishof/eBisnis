import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface GuruRow {
  id: string;
  nip: string | null;
  nama: string;
}

interface AbsensiGuruRow extends Record<string, unknown> {
  id: string;
  guru_id: string;
  tanggal: string;
  status: string;
  jam_masuk: string | null;
  jam_pulang: string | null;
  keterangan: string | null;
}

interface PiketRow extends Record<string, unknown> {
  id: string;
  guru_id: string;
  tanggal: string;
  jenis_piket: string;
  status: string;
  keterangan: string | null;
}

const PAGE_SIZE = 25;
const STATUS_ABSENSI = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'];
const JENIS_PIKET = ['PIKET_HARIAN', 'PIKET_MALAM', 'PIKET_GERBANG', 'PIKET_ASRAMA', 'LAINNYA'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenAbsensiGuruPage() {
  const [tab, setTab] = useState<'absensi' | 'piket'>('absensi');

  return (
    <>
      <PageHeader
        title="Absensi Guru dan Piket"
        description="Catat kehadiran guru/ustadz dan jadwal piket harian."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Absensi Guru' }]}
      />
      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'absensi' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('absensi')}>
          Absensi
        </button>
        <button type="button" className={tab === 'piket' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('piket')}>
          Piket
        </button>
      </div>
      {tab === 'absensi' ? <TabAbsensi /> : <TabPiket />}
    </>
  );
}

function useGuru() {
  return useQuery({
    queryKey: ['pesantren-absensi-guru-master'],
    queryFn: () => api.get<{ items: GuruRow[]; total: number }>('/pesantren/guru?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
}

function TabAbsensi() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const guru = useGuru();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ dari: today(), sampai: today(), guruId: '' });
  const [form, setForm] = useState({ guruId: '', tanggal: today(), status: 'HADIR', jamMasuk: '', jamPulang: '', keterangan: '' });

  const list = useQuery({
    queryKey: ['pesantren-absensi-guru-list', page, filter],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (filter.dari) params.set('dari', filter.dari);
      if (filter.sampai) params.set('sampai', filter.sampai);
      if (filter.guruId) params.set('guruId', filter.guruId);
      return api.get<{ items: AbsensiGuruRow[]; total: number }>(`/pesantren/absensi-guru?${params.toString()}`);
    },
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<AbsensiGuruRow>('/pesantren/absensi-guru', {
        guruId: form.guruId,
        tanggal: form.tanggal,
        status: form.status,
        jamMasuk: form.jamMasuk || undefined,
        jamPulang: form.jamPulang || undefined,
        keterangan: form.keterangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Absensi guru tersimpan.', 'success');
      setForm({ guruId: '', tanggal: form.tanggal, status: 'HADIR', jamMasuk: '', jamPulang: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-absensi-guru-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan absensi.'), 'error'),
  });

  const namaGuru = new Map((guru.data?.items ?? []).map((item) => [item.id, `${item.nip ?? '-'} - ${item.nama}`]));
  const columns: Array<GridColumn<AbsensiGuruRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'guru_id', header: 'Guru', render: (row) => namaGuru.get(row.guru_id) ?? row.guru_id },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'jam_masuk', header: 'Masuk', render: (row) => row.jam_masuk ?? '-' },
    { key: 'jam_pulang', header: 'Pulang', render: (row) => row.jam_pulang ?? '-' },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan ?? '-' },
  ];
  const total = list.data?.total ?? 0;

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_150px_130px_130px_minmax(180px,1fr)_auto]">
          <GuruSelect value={form.guruId} guru={guru.data?.items ?? []} onChange={(value) => setForm({ ...form, guruId: value })} />
          <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
          <Select label="Status" value={form.status} options={STATUS_ABSENSI} onChange={(value) => setForm({ ...form, status: value })} />
          <Input label="Masuk" type="time" value={form.jamMasuk} onChange={(value) => setForm({ ...form, jamMasuk: value })} />
          <Input label="Pulang" type="time" value={form.jamPulang} onChange={(value) => setForm({ ...form, jamPulang: value })} />
          <Input label="Keterangan" value={form.keterangan} onChange={(value) => setForm({ ...form, keterangan: value })} />
          <div className="flex items-end">
            <button type="button" className="btn-primary" disabled={!form.guruId || simpan.isPending} onClick={() => simpan.mutate()}>
              <Plus className="h-4 w-4" aria-hidden />
              Simpan
            </button>
          </div>
        </div>
      </div>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Input label="Dari" type="date" value={filter.dari} onChange={(value) => { setFilter({ ...filter, dari: value }); setPage(1); }} />
          <Input label="Sampai" type="date" value={filter.sampai} onChange={(value) => { setFilter({ ...filter, sampai: value }); setPage(1); }} />
          <GuruSelect value={filter.guruId} guru={guru.data?.items ?? []} onChange={(value) => { setFilter({ ...filter, guruId: value }); setPage(1); }} allowAll />
        </div>
      </div>
      <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat absensi guru.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada absensi guru." />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}

function TabPiket() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const guru = useGuru();
  const [tanggal, setTanggal] = useState(today());
  const [form, setForm] = useState({ guruId: '', tanggal: today(), jenisPiket: 'PIKET_GERBANG', keterangan: '' });

  const list = useQuery({
    queryKey: ['pesantren-piket-guru-list', tanggal],
    queryFn: () => api.get<PiketRow[]>(`/pesantren/absensi-guru/piket${tanggal ? `?tanggal=${tanggal}` : ''}`),
  });

  const jadwalkan = useMutation({
    mutationFn: () => api.post<PiketRow>('/pesantren/absensi-guru/piket', { ...form, keterangan: form.keterangan.trim() || undefined }),
    onSuccess: () => {
      toast.push('Jadwal piket tersimpan.', 'success');
      setForm({ guruId: '', tanggal: form.tanggal, jenisPiket: form.jenisPiket, keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-piket-guru-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan piket.'), 'error'),
  });

  const hadir = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => api.post<PiketRow>(`/pesantren/absensi-guru/piket/${id}/kehadiran`, { hadir: value }),
    onSuccess: () => {
      toast.push('Kehadiran piket tercatat.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-piket-guru-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat kehadiran piket.'), 'error'),
  });

  const namaGuru = new Map((guru.data?.items ?? []).map((item) => [item.id, `${item.nip ?? '-'} - ${item.nama}`]));
  const columns: Array<GridColumn<PiketRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'guru_id', header: 'Guru', render: (row) => namaGuru.get(row.guru_id) ?? row.guru_id },
    { key: 'jenis_piket', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis_piket} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan ?? '-' },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) =>
        row.status === 'DIJADWALKAN' ? (
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => hadir.mutate({ id: row.id, value: true })}>Hadir</button>
            <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => hadir.mutate({ id: row.id, value: false })}>Tidak</button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_170px_170px_minmax(180px,1fr)_auto]">
          <GuruSelect value={form.guruId} guru={guru.data?.items ?? []} onChange={(value) => setForm({ ...form, guruId: value })} />
          <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
          <Select label="Jenis piket" value={form.jenisPiket} options={JENIS_PIKET} onChange={(value) => setForm({ ...form, jenisPiket: value })} />
          <Input label="Keterangan" value={form.keterangan} onChange={(value) => setForm({ ...form, keterangan: value })} />
          <div className="flex items-end"><button type="button" className="btn-primary" disabled={!form.guruId || jadwalkan.isPending} onClick={() => jadwalkan.mutate()}><Plus className="h-4 w-4" aria-hidden />Jadwalkan</button></div>
        </div>
      </div>
      <div className="card mb-4 flex max-w-xs items-end gap-3 p-4">
        <Input label="Filter tanggal" type="date" value={tanggal} onChange={setTanggal} />
        <button type="button" className="btn-outline" onClick={() => void list.refetch()}><RefreshCw className="h-4 w-4" aria-hidden /></button>
      </div>
      <DataGrid columns={columns} rows={list.data ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat jadwal piket.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada jadwal piket." />
    </>
  );
}

function GuruSelect({ value, guru, onChange, allowAll = false }: { value: string; guru: GuruRow[]; onChange: (value: string) => void; allowAll?: boolean }) {
  return (
    <div>
      <label className="field-label">Guru/Ustadz</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allowAll ? 'Semua' : 'Pilih guru'}</option>
        {guru.map((item) => <option key={item.id} value={item.id}>{item.nip ?? '-'} - {item.nama}</option>)}
      </select>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
