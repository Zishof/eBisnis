import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { CrudActionBar, CrudDashboard } from '../../../components/crud-actions';
import { useErrorMessage } from '../../../app/auth-context';

interface GuruRow extends Record<string, unknown> {
  id: string;
  nip: string | null;
  nama: string;
  jenis: string;
  no_hp: string | null;
  email: string | null;
  status: string;
}

const PAGE_SIZE = 25;
const JENIS_GURU = ['FORMAL', 'DINIYAH', 'TAHFIZ', 'PENGASUH'];

export function PesantrenGuruPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('AKTIF');
  const [form, setForm] = useState({ nip: '', nama: '', jenis: 'FORMAL', noHp: '', email: '', alamat: '' });

  const guru = useQuery({
    queryKey: ['pesantren-guru', page, cari, status],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (cari.trim()) params.set('cari', cari.trim());
      return api.get<{ items: GuruRow[]; total: number }>(`/pesantren/guru?${params.toString()}`);
    },
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<GuruRow>('/pesantren/guru', {
        nip: form.nip.trim() || undefined,
        nama: form.nama,
        jenis: form.jenis,
        noHp: form.noHp.trim() || undefined,
        email: form.email.trim() || undefined,
        alamat: form.alamat.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Guru berhasil ditambahkan.', 'success');
      setForm({ nip: '', nama: '', jenis: 'FORMAL', noHp: '', email: '', alamat: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-guru'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan guru.'), 'error'),
  });

  const nonaktifkan = useMutation({
    mutationFn: (id: string) => api.post<GuruRow>(`/pesantren/guru/${id}/nonaktifkan`, {}),
    onSuccess: () => {
      toast.push('Guru dinonaktifkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-guru'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menonaktifkan guru.'), 'error'),
  });

  const uploadExcel = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const content = XLSX.utils.sheet_to_csv(worksheet);
      return api.post<{ created: number; updated: number; skipped: number }>('/pesantren/dapodik/guru/import', {
        format: 'csv',
        content,
        dryRun: false,
      });
    },
    onSuccess: (payload) => {
      toast.push(`Upload guru selesai: ${payload.created} dibuat, ${payload.updated} diperbarui, ${payload.skipped} dilewati.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-guru'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Upload Excel guru gagal.'), 'error'),
  });

  const columns: Array<GridColumn<GuruRow>> = [
    { key: 'nip', header: 'NIP', render: (row) => row.nip ?? '-' },
    { key: 'nama', header: 'Nama' },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'no_hp', header: 'HP', render: (row) => row.no_hp ?? '-' },
    { key: 'email', header: 'Email', render: (row) => row.email ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) =>
        row.status === 'AKTIF' ? (
          <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => nonaktifkan.mutate(row.id)}>
            Nonaktifkan
          </button>
        ) : null,
    },
  ];
  const total = guru.data?.total ?? 0;
  const rows = guru.data?.items ?? [];
  const aktif = rows.filter((row) => row.status === 'AKTIF').length;
  const formal = rows.filter((row) => row.jenis === 'FORMAL').length;
  const diniyah = rows.filter((row) => row.jenis === 'DINIYAH').length;

  return (
    <>
      <PageHeader
        title="Guru dan Ustadz"
        description="Master guru formal, ustadz diniyah, tahfiz, dan pengasuh."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Guru' }]}
        actions={
          <>
            <CrudActionBar
              title="Guru dan Ustadz"
              rows={rows}
              columns={columns}
              filename="data-guru"
              uploadLabel={uploadExcel.isPending ? 'Mengupload...' : 'Upload Excel'}
              onUploadRows={async (uploadedRows) => {
                await uploadExcel.mutateAsync(uploadedRows);
              }}
            />
            <button type="button" className="btn-outline" onClick={() => void guru.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
          </>
        }
      />
      <CrudDashboard
        metrics={[
          { label: 'Total Data', value: total, tone: 'emerald' },
          { label: 'Aktif di halaman ini', value: aktif, tone: 'sky' },
          { label: 'Formal', value: formal, tone: 'amber' },
          { label: 'Diniyah', value: diniyah, tone: 'slate' },
        ]}
      />
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[130px_minmax(200px,1fr)_150px_170px_220px_auto]">
          <Input label="NIP" value={form.nip} onChange={(value) => setForm({ ...form, nip: value })} />
          <Input label="Nama" value={form.nama} onChange={(value) => setForm({ ...form, nama: value })} />
          <Select label="Jenis" value={form.jenis} options={JENIS_GURU} onChange={(value) => setForm({ ...form, jenis: value })} />
          <Input label="HP" value={form.noHp} onChange={(value) => setForm({ ...form, noHp: value })} />
          <Input label="Email" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
          <div className="flex items-end">
            <button type="button" className="btn-primary" disabled={!form.nama || simpan.isPending} onClick={() => simpan.mutate()}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah
            </button>
          </div>
        </div>
      </div>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px]">
          <Input label="Cari" value={cari} onChange={(value) => { setCari(value); setPage(1); }} />
          <Select label="Status" value={status} options={['', 'AKTIF', 'NONAKTIF']} onChange={(value) => { setStatus(value); setPage(1); }} />
        </div>
      </div>
      <DataGrid
        columns={columns}
        rows={rows}
        loading={guru.isLoading}
        error={guru.isError ? toMessage(guru.error, (_key, fallback) => fallback ?? 'Gagal memuat guru.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void guru.refetch()}
        emptyTitle="Belum ada guru."
      />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option || 'ALL'} value={option}>{option || 'Semua'}</option>)}
      </select>
    </div>
  );
}
