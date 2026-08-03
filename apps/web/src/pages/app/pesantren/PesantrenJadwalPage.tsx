import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface JadwalRow extends Record<string, unknown> {
  id: string;
  rombongan_id: string;
  mata_pelajaran_id: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  ruangan: string | null;
}

interface RombonganRow {
  id: string;
  tingkat: string;
  nama: string;
}

interface MataPelajaranRow {
  id: string;
  code: string;
  nama: string;
}

const HARI = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'AHAD'];

export function PesantrenJadwalPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [hari, setHari] = useState('');
  const [membuat, setMembuat] = useState(false);
  const [form, setForm] = useState({
    rombonganId: '',
    mataPelajaranId: '',
    hari: 'SENIN',
    waktuMulai: '07:00',
    waktuSelesai: '08:00',
    ruangan: '',
  });

  const jadwal = useQuery({
    queryKey: ['pesantren-jadwal', hari],
    queryFn: () => api.get<JadwalRow[]>(`/pesantren/kurikulum/jadwal${hari ? `?hari=${hari}` : ''}`),
  });

  const rombongan = useQuery({
    queryKey: ['pesantren-jadwal-rombongan'],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>('/pesantren/rombongan?halaman=1&ukuranHalaman=100'),
  });

  const mapel = useQuery({
    queryKey: ['pesantren-jadwal-mapel'],
    queryFn: () => api.get<MataPelajaranRow[]>('/pesantren/nilai/mata-pelajaran'),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<JadwalRow>('/pesantren/kurikulum/jadwal', {
        ...form,
        ruangan: form.ruangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Jadwal pelajaran tersimpan.', 'success');
      setMembuat(false);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-jadwal'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan jadwal.'), 'error'),
  });

  const hapus = useMutation({
    mutationFn: (id: string) => api.delete<JadwalRow>(`/pesantren/kurikulum/jadwal/${id}`),
    onSuccess: () => {
      toast.push('Jadwal dibatalkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-jadwal'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membatalkan jadwal.'), 'error'),
  });

  const namaRombongan = new Map((rombongan.data?.items ?? []).map((item) => [item.id, `${item.tingkat} ${item.nama}`]));
  const namaMapel = new Map((mapel.data ?? []).map((item) => [item.id, item.nama]));

  const columns: Array<GridColumn<JadwalRow>> = [
    { key: 'hari', header: 'Hari', render: (row) => <StatusBadge status={row.hari} /> },
    { key: 'waktu_mulai', header: 'Mulai' },
    { key: 'waktu_selesai', header: 'Selesai' },
    { key: 'rombongan_id', header: 'Rombongan', render: (row) => namaRombongan.get(row.rombongan_id) ?? row.rombongan_id },
    { key: 'mata_pelajaran_id', header: 'Mata Pelajaran', render: (row) => namaMapel.get(row.mata_pelajaran_id) ?? row.mata_pelajaran_id },
    { key: 'ruangan', header: 'Ruang', render: (row) => row.ruangan ?? '-' },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <button type="button" className="btn-outline px-2 py-1.5" onClick={() => hapus.mutate(row.id)}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Jadwal Pelajaran"
        description="Susun jadwal per rombongan belajar. Bentrok jam rombongan dan pengajar ditolak oleh sistem."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Jadwal' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => void jadwal.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
            <button type="button" className="btn-primary" onClick={() => setMembuat(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah Jadwal
            </button>
          </>
        }
      />

      <div className="card mb-4 max-w-xs p-4">
        <label className="field-label" htmlFor="jadwal-hari">Hari</label>
        <select id="jadwal-hari" className="field-input" value={hari} onChange={(e) => setHari(e.target.value)}>
          <option value="">Semua</option>
          {HARI.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <DataGrid
        columns={columns}
        rows={jadwal.data ?? []}
        loading={jadwal.isLoading}
        error={jadwal.isError ? toMessage(jadwal.error, (_key, fallback) => fallback ?? 'Gagal memuat jadwal.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void jadwal.refetch()}
        emptyTitle="Belum ada jadwal pelajaran."
      />

      {membuat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Jadwal</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Rombongan *">
                <select className="field-input" value={form.rombonganId} onChange={(e) => setForm({ ...form, rombonganId: e.target.value })}>
                  <option value="">Pilih rombongan</option>
                  {(rombongan.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.tingkat} {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Mata pelajaran *">
                <select className="field-input" value={form.mataPelajaranId} onChange={(e) => setForm({ ...form, mataPelajaranId: e.target.value })}>
                  <option value="">Pilih mata pelajaran</option>
                  {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Hari *">
                <select className="field-input" value={form.hari} onChange={(e) => setForm({ ...form, hari: e.target.value })}>
                  {HARI.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Ruangan">
                <input className="field-input" value={form.ruangan} onChange={(e) => setForm({ ...form, ruangan: e.target.value })} />
              </Field>
              <Field label="Mulai *">
                <input type="time" className="field-input" value={form.waktuMulai} onChange={(e) => setForm({ ...form, waktuMulai: e.target.value })} />
              </Field>
              <Field label="Selesai *">
                <input type="time" className="field-input" value={form.waktuSelesai} onChange={(e) => setForm({ ...form, waktuSelesai: e.target.value })} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setMembuat(false)}>Batal</button>
              <button type="button" className="btn-primary" disabled={!form.rombonganId || !form.mataPelajaranId || simpan.isPending} onClick={() => simpan.mutate()}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
