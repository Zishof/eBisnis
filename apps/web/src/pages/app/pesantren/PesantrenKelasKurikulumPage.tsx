import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface UnitRow {
  id: string;
  nama: string;
}

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface RombonganRow extends Record<string, unknown> {
  id: string;
  unit_pendidikan_id: string;
  tahun_ajaran_id: string;
  tingkat: string;
  nama: string;
  kapasitas: number | null;
  status: string;
}

interface KurikulumRow extends Record<string, unknown> {
  id: string;
  unit_pendidikan_id: string;
  tahun_ajaran_id: string;
  tingkat: string;
  mata_pelajaran_id: string;
  jam_per_minggu: number;
}

interface MapelRow {
  id: string;
  code: string;
  nama: string;
}

const PAGE_SIZE = 25;

export function PesantrenKelasKurikulumPage({ initialTab = 'rombongan' }: { initialTab?: 'rombongan' | 'kurikulum' }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <>
      <PageHeader
        title="Kelas dan Kurikulum"
        description="Kelola rombongan belajar dan struktur mata pelajaran per unit, tingkat, dan tahun ajaran."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Kelas dan Kurikulum' }]}
      />
      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'rombongan' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('rombongan')}>Rombongan</button>
        <button type="button" className={tab === 'kurikulum' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('kurikulum')}>Kurikulum</button>
      </div>
      {tab === 'rombongan' ? <TabRombongan /> : <TabKurikulum />}
    </>
  );
}

function useUnitPendidikan() {
  return useQuery({
    queryKey: ['pesantren-kelas-unit'],
    queryFn: () => api.get<{ items: UnitRow[]; total: number }>('/pesantren/unit-pendidikan?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
}

function useTahunAjaran() {
  return useQuery({
    queryKey: ['pesantren-kelas-tahun-ajaran'],
    queryFn: () => api.get<TahunAjaranRow[]>('/pesantren/nilai/tahun-ajaran'),
  });
}

function TabRombongan() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const unit = useUnitPendidikan();
  const tahunAjaran = useTahunAjaran();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ unitPendidikanId: '', tahunAjaranId: '', tingkat: '', nama: '', kapasitas: '' });
  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const list = useQuery({
    queryKey: ['pesantren-rombongan-list', page],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>(`/pesantren/rombongan?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`),
  });
  const simpan = useMutation({
    mutationFn: () =>
      api.post('/pesantren/rombongan', {
        unitPendidikanId: form.unitPendidikanId,
        tahunAjaranId: form.tahunAjaranId || tahunAktif?.id,
        tingkat: form.tingkat,
        nama: form.nama,
        kapasitas: form.kapasitas ? Number(form.kapasitas) : undefined,
      }),
    onSuccess: () => {
      toast.push('Rombongan belajar dibuat.', 'success');
      setForm({ unitPendidikanId: '', tahunAjaranId: form.tahunAjaranId, tingkat: '', nama: '', kapasitas: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-rombongan-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat rombongan.'), 'error'),
  });
  const namaUnit = new Map((unit.data?.items ?? []).map((item) => [item.id, item.nama]));
  const namaTahun = new Map((tahunAjaran.data ?? []).map((item) => [item.id, `${item.code} - ${item.name}`]));
  const columns: Array<GridColumn<RombonganRow>> = [
    { key: 'unit_pendidikan_id', header: 'Unit', render: (row) => namaUnit.get(row.unit_pendidikan_id) ?? row.unit_pendidikan_id },
    { key: 'tahun_ajaran_id', header: 'Tahun Ajaran', render: (row) => namaTahun.get(row.tahun_ajaran_id) ?? row.tahun_ajaran_id },
    { key: 'tingkat', header: 'Tingkat' },
    { key: 'nama', header: 'Nama' },
    { key: 'kapasitas', header: 'Kapasitas', render: (row) => row.kapasitas ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  const total = list.data?.total ?? 0;
  return (
    <>
      <div className="card mb-4 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tambah Rombongan Belajar</h2>
            <p className="mt-1 text-sm text-slate-500">Pilih unit dan tahun ajaran, lalu isi tingkat dan nama kelas.</p>
          </div>
          {tahunAktif && <StatusBadge status={`TA ${tahunAktif.code}`} />}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_120px_minmax(160px,1fr)_120px_auto]">
          <UnitSelect value={form.unitPendidikanId} units={unit.data?.items ?? []} onChange={(value) => setForm({ ...form, unitPendidikanId: value })} />
          <TahunAjaranSelect value={form.tahunAjaranId || tahunAktif?.id || ''} tahunAjaran={tahunAjaran.data ?? []} onChange={(value) => setForm({ ...form, tahunAjaranId: value })} />
          <Input label="Tingkat" value={form.tingkat} onChange={(value) => setForm({ ...form, tingkat: value })} />
          <Input label="Nama kelas" value={form.nama} onChange={(value) => setForm({ ...form, nama: value })} />
          <Input label="Kapasitas" type="number" value={form.kapasitas} onChange={(value) => setForm({ ...form, kapasitas: value })} />
          <div className="flex items-end"><button type="button" className="btn-primary min-h-11 w-full xl:w-auto" disabled={!form.unitPendidikanId || !(form.tahunAjaranId || tahunAktif?.id) || !form.tingkat || !form.nama || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
        </div>
      </div>
      <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat rombongan.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada rombongan belajar." />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}

function TabKurikulum() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const unit = useUnitPendidikan();
  const tahunAjaran = useTahunAjaran();
  const [filter, setFilter] = useState({ unitPendidikanId: '', tahunAjaranId: '', tingkat: '' });
  const [form, setForm] = useState({ unitPendidikanId: '', tahunAjaranId: '', tingkat: '', mataPelajaranId: '', jamPerMinggu: '2' });
  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const mapel = useQuery({
    queryKey: ['pesantren-kurikulum-mapel'],
    queryFn: () => api.get<MapelRow[]>('/pesantren/nilai/mata-pelajaran'),
  });
  const list = useQuery({
    queryKey: ['pesantren-kurikulum-list', filter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter.unitPendidikanId) params.set('unitPendidikanId', filter.unitPendidikanId);
      if (filter.tahunAjaranId) params.set('tahunAjaranId', filter.tahunAjaranId);
      if (filter.tingkat) params.set('tingkat', filter.tingkat);
      return api.get<KurikulumRow[]>(`/pesantren/kurikulum${params.toString() ? `?${params.toString()}` : ''}`);
    },
  });
  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/kurikulum', { ...form, tahunAjaranId: form.tahunAjaranId || tahunAktif?.id, jamPerMinggu: Number(form.jamPerMinggu) }),
    onSuccess: () => {
      toast.push('Kurikulum mata pelajaran ditambahkan.', 'success');
      setForm({ ...form, mataPelajaranId: '', jamPerMinggu: '2' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kurikulum-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menambahkan kurikulum.'), 'error'),
  });
  const namaUnit = new Map((unit.data?.items ?? []).map((item) => [item.id, item.nama]));
  const namaTahun = new Map((tahunAjaran.data ?? []).map((item) => [item.id, `${item.code} - ${item.name}`]));
  const namaMapel = new Map((mapel.data ?? []).map((item) => [item.id, `${item.code} - ${item.nama}`]));
  const columns: Array<GridColumn<KurikulumRow>> = [
    { key: 'unit_pendidikan_id', header: 'Unit', render: (row) => namaUnit.get(row.unit_pendidikan_id) ?? row.unit_pendidikan_id },
    { key: 'tahun_ajaran_id', header: 'Tahun Ajaran', render: (row) => namaTahun.get(row.tahun_ajaran_id) ?? row.tahun_ajaran_id },
    { key: 'tingkat', header: 'Tingkat' },
    { key: 'mata_pelajaran_id', header: 'Mata Pelajaran', render: (row) => namaMapel.get(row.mata_pelajaran_id) ?? row.mata_pelajaran_id },
    { key: 'jam_per_minggu', header: 'JP/Minggu' },
  ];
  return (
    <>
      <div className="card mb-4 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tambah Struktur Kurikulum</h2>
            <p className="mt-1 text-sm text-slate-500">Susun mata pelajaran per unit, tingkat, dan tahun ajaran.</p>
          </div>
          {tahunAktif && <StatusBadge status={`TA ${tahunAktif.code}`} />}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_120px_minmax(220px,1fr)_120px_auto]">
          <UnitSelect value={form.unitPendidikanId} units={unit.data?.items ?? []} onChange={(value) => setForm({ ...form, unitPendidikanId: value })} />
          <TahunAjaranSelect value={form.tahunAjaranId || tahunAktif?.id || ''} tahunAjaran={tahunAjaran.data ?? []} onChange={(value) => setForm({ ...form, tahunAjaranId: value })} />
          <Input label="Tingkat" value={form.tingkat} onChange={(value) => setForm({ ...form, tingkat: value })} />
          <div>
            <label className="field-label">Mata pelajaran</label>
            <select className="field-input" value={form.mataPelajaranId} onChange={(event) => setForm({ ...form, mataPelajaranId: event.target.value })}>
              <option value="">Pilih mapel</option>
              {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
            </select>
          </div>
          <Input label="JP" type="number" value={form.jamPerMinggu} onChange={(value) => setForm({ ...form, jamPerMinggu: value })} />
          <div className="flex items-end"><button type="button" className="btn-primary min-h-11 w-full xl:w-auto" disabled={!form.unitPendidikanId || !(form.tahunAjaranId || tahunAktif?.id) || !form.tingkat || !form.mataPelajaranId || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
        </div>
      </div>
      <div className="card mb-4 p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Filter Kurikulum</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan filter untuk melihat struktur kurikulum per unit dan tingkat.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <UnitSelect value={filter.unitPendidikanId} units={unit.data?.items ?? []} onChange={(value) => setFilter({ ...filter, unitPendidikanId: value })} allowAll />
          <TahunAjaranSelect value={filter.tahunAjaranId} tahunAjaran={tahunAjaran.data ?? []} onChange={(value) => setFilter({ ...filter, tahunAjaranId: value })} allowAll />
          <Input label="Tingkat" value={filter.tingkat} onChange={(value) => setFilter({ ...filter, tingkat: value })} />
        </div>
      </div>
      <DataGrid columns={columns} rows={list.data ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat kurikulum.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada kurikulum." />
    </>
  );
}

function UnitSelect({ value, units, onChange, allowAll = false }: { value: string; units: UnitRow[]; onChange: (value: string) => void; allowAll?: boolean }) {
  return (
    <div>
      <label className="field-label">Unit pendidikan</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allowAll ? 'Semua' : 'Pilih unit'}</option>
        {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.nama}</option>)}
      </select>
    </div>
  );
}

function TahunAjaranSelect({
  value,
  tahunAjaran,
  onChange,
  allowAll = false,
}: {
  value: string;
  tahunAjaran: TahunAjaranRow[];
  onChange: (value: string) => void;
  allowAll?: boolean;
}) {
  return (
    <div>
      <label className="field-label">Tahun ajaran</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allowAll ? 'Semua tahun ajaran' : 'Pilih tahun ajaran'}</option>
        {tahunAjaran.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} - {item.name}{item.status === 'ACTIVE' ? ' (aktif)' : ''}
          </option>
        ))}
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
