import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface KartuRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  nomor_kartu: string;
  jenis: string;
  status: string;
  created_at: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

export function PesantrenKartuPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ santriId: '', nomorKartu: '', jenis: 'RFID' });
  const [alasan, setAlasan] = useState<Record<string, string>>({});

  const kartu = useQuery({
    queryKey: ['pesantren-kartu'],
    queryFn: () => api.get<KartuRow[]>('/pesantren/kartu'),
  });
  const santri = useQuery({
    queryKey: ['pesantren-kartu-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });

  const terbitkan = useMutation({
    mutationFn: () => api.post<KartuRow>('/pesantren/kartu', form),
    onSuccess: () => {
      toast.push('Kartu santri diterbitkan.', 'success');
      setForm({ santriId: '', nomorKartu: '', jenis: 'RFID' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kartu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menerbitkan kartu.'), 'error'),
  });

  const nonaktifkan = useMutation({
    mutationFn: (id: string) => api.post<KartuRow>(`/pesantren/kartu/${id}/nonaktifkan`, { alasan: alasan[id]?.trim() || undefined }),
    onSuccess: () => {
      toast.push('Kartu dinonaktifkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kartu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menonaktifkan kartu.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<KartuRow>> = [
    { key: 'nomor_kartu', header: 'Nomor Kartu' },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_at', header: 'Dibuat', render: (row) => formatDate(row.created_at) },
    {
      key: 'alasan',
      header: 'Alasan',
      render: (row) =>
        row.status === 'AKTIF' ? (
          <input className="field-input min-w-[180px]" value={alasan[row.id] ?? ''} onChange={(e) => setAlasan((current) => ({ ...current, [row.id]: e.target.value }))} placeholder="Hilang/rusak" />
        ) : '-',
    },
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

  return (
    <>
      <PageHeader
        title="Kartu Santri"
        description="Terbitkan dan nonaktifkan kartu RFID/QR untuk presensi, gerbang, dan dompet santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Kartu' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void kartu.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_150px_auto]">
          <div>
            <label className="field-label">Santri</label>
            <select className="field-input" value={form.santriId} onChange={(event) => setForm({ ...form, santriId: event.target.value })}>
              <option value="">Pilih santri</option>
              {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
            </select>
          </div>
          <Input label="Nomor kartu" value={form.nomorKartu} onChange={(value) => setForm({ ...form, nomorKartu: value })} />
          <div>
            <label className="field-label">Jenis</label>
            <select className="field-input" value={form.jenis} onChange={(event) => setForm({ ...form, jenis: event.target.value })}>
              <option value="RFID">RFID</option>
              <option value="QR">QR</option>
              <option value="NFC">NFC</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="button" className="btn-primary" disabled={!form.santriId || !form.nomorKartu || terbitkan.isPending} onClick={() => terbitkan.mutate()}>
              <Plus className="h-4 w-4" aria-hidden />
              Terbitkan
            </button>
          </div>
        </div>
      </div>
      <DataGrid
        columns={columns}
        rows={kartu.data ?? []}
        loading={kartu.isLoading}
        error={kartu.isError ? toMessage(kartu.error, (_key, fallback) => fallback ?? 'Gagal memuat kartu.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void kartu.refetch()}
        emptyTitle="Belum ada kartu santri."
      />
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
