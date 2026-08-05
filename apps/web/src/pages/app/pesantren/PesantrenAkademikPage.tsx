import { useState } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CheckCircle2, PlayCircle, RotateCcw } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
  status: string;
}

interface RombonganRow {
  id: string;
  tahun_ajaran_id: string;
  tingkat: string;
  nama: string;
}

interface KeputusanRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  nama_lengkap: string;
  nis: string;
  tahun_ajaran_asal_id: string;
  tahun_ajaran_asal: string;
  rombongan_asal: string | null;
  jenis: string;
  status: string;
  rombongan_tujuan_id: string | null;
  rombongan_tujuan: string | null;
  tanggal_keputusan: string;
  tanggal_efektif: string;
  finalized_at: string | null;
  executed_at: string | null;
}

const PAGE_SIZE = 25;
const JENIS = [
  { value: 'NAIK_KELAS', label: 'Naik kelas' },
  { value: 'TINGGAL_KELAS', label: 'Tinggal kelas' },
  { value: 'LULUS', label: 'Lulus' },
  { value: 'KELUAR', label: 'Keluar' },
];

export function PesantrenAkademikPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ tahunAjaranId: '', status: '' });
  const [form, setForm] = useState({
    santriId: '',
    tahunAjaranAsalId: '',
    jenis: 'NAIK_KELAS',
    rombonganTujuanId: '',
    tanggalKeputusan: new Date().toISOString().slice(0, 10),
    tanggalEfektif: new Date().toISOString().slice(0, 10),
    catatan: '',
  });

  const tahunAjaran = useQuery({
    queryKey: ['pesantren-akademik-tahun'],
    queryFn: () => api.get<TahunAjaranRow[]>('/pesantren/nilai/tahun-ajaran'),
  });
  const santri = useQuery({
    queryKey: ['pesantren-akademik-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const rombongan = useQuery({
    queryKey: ['pesantren-akademik-rombongan'],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>('/pesantren/rombongan?halaman=1&ukuranHalaman=100'),
  });
  const list = useQuery({
    queryKey: ['pesantren-akademik-keputusan', filter, page],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (filter.tahunAjaranId) params.set('tahunAjaranId', filter.tahunAjaranId);
      if (filter.status) params.set('status', filter.status);
      return api.get<{ items: KeputusanRow[]; total: number }>(`/pesantren/akademik/keputusan?${params.toString()}`);
    },
  });

  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const targetWajib = form.jenis === 'NAIK_KELAS' || form.jenis === 'TINGGAL_KELAS';

  const buat = useMutation({
    mutationFn: () =>
      api.post<KeputusanRow>('/pesantren/akademik/keputusan', {
        ...form,
        tahunAjaranAsalId: form.tahunAjaranAsalId || tahunAktif?.id,
        rombonganTujuanId: targetWajib ? form.rombonganTujuanId : undefined,
        catatan: form.catatan || undefined,
      }),
    onSuccess: () => {
      toast.push('Draft keputusan akademik dibuat.', 'success');
      setForm({ ...form, santriId: '', rombonganTujuanId: '', catatan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-akademik-keputusan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat keputusan akademik.'), 'error'),
  });

  const aksi = useMutation({
    mutationFn: ({ id, type, reason }: { id: string; type: 'finalisasi' | 'eksekusi' | 'batalkan'; reason?: string }) => {
      if (type === 'batalkan') return api.post<KeputusanRow>(`/pesantren/akademik/keputusan/${id}/batalkan`, { reason });
      return api.post<KeputusanRow>(`/pesantren/akademik/keputusan/${id}/${type}`, {});
    },
    onSuccess: () => {
      toast.push('Status keputusan akademik diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-akademik-keputusan'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-akademik-santri'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-akademik-rombongan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memperbarui keputusan.'), 'error'),
  });

  const total = list.data?.total ?? 0;
  const columns: Array<GridColumn<KeputusanRow>> = [
    { key: 'nama_lengkap', header: 'Santri', render: (row) => <div><p className="font-semibold">{row.nama_lengkap}</p><p className="text-xs text-slate-500">{row.nis}</p></div> },
    { key: 'tahun_ajaran_asal', header: 'Tahun asal' },
    { key: 'jenis', header: 'Keputusan', render: (row) => labelJenis(row.jenis) },
    { key: 'rombongan_asal', header: 'Dari', render: (row) => row.rombongan_asal ?? '-' },
    { key: 'rombongan_tujuan', header: 'Tujuan', render: (row) => row.rombongan_tujuan ?? '-' },
    { key: 'tanggal_efektif', header: 'Efektif' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline px-3 py-2 text-xs" disabled={row.status !== 'DRAFT' || aksi.isPending} onClick={() => aksi.mutate({ id: row.id, type: 'finalisasi' })}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Final
          </button>
          <button type="button" className="btn-outline px-3 py-2 text-xs" disabled={row.status !== 'FINALIZED' || aksi.isPending} onClick={() => aksi.mutate({ id: row.id, type: 'eksekusi' })}>
            <PlayCircle className="h-3.5 w-3.5" aria-hidden />Eksekusi
          </button>
          <button
            type="button"
            className="btn-outline px-3 py-2 text-xs"
            disabled={!['DRAFT', 'FINALIZED'].includes(row.status) || aksi.isPending}
            onClick={() => {
              const reason = window.prompt('Alasan pembatalan keputusan akademik:');
              if (reason) aksi.mutate({ id: row.id, type: 'batalkan', reason });
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />Batal
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Kenaikan dan Kelulusan"
        description="Kelola keputusan akademik setelah rapor difinalisasi: naik kelas, tinggal kelas, lulus, atau keluar."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Kenaikan dan Kelulusan' }]}
        actions={<BadgeCheck className="h-6 w-6 text-emerald-700" aria-hidden />}
      />

      <section className="card mb-4 p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Buat Draft Keputusan</h2>
            <p className="mt-1 text-sm text-slate-500">Finalisasi keputusan hanya bisa dilakukan setelah rapor santri tahun asal sudah final.</p>
          </div>
          {tahunAktif && <StatusBadge status={`TA ${tahunAktif.code}`} />}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_minmax(210px,1fr)_160px_minmax(210px,1fr)_150px_150px]">
          <Select label="Santri" value={form.santriId} onChange={(value) => setForm({ ...form, santriId: value })}>
            <option value="">Pilih santri</option>
            {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
          </Select>
          <Select label="Tahun asal" value={form.tahunAjaranAsalId || tahunAktif?.id || ''} onChange={(value) => setForm({ ...form, tahunAjaranAsalId: value })}>
            <option value="">Pilih tahun</option>
            {(tahunAjaran.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
          </Select>
          <Select label="Jenis" value={form.jenis} onChange={(value) => setForm({ ...form, jenis: value, rombonganTujuanId: '' })}>
            {JENIS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <Select label="Rombongan tujuan" value={form.rombonganTujuanId} onChange={(value) => setForm({ ...form, rombonganTujuanId: value })} disabled={!targetWajib}>
            <option value="">{targetWajib ? 'Pilih rombongan' : 'Tidak diperlukan'}</option>
            {(rombongan.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.tingkat} - {item.nama}</option>)}
          </Select>
          <Input label="Tanggal keputusan" type="date" value={form.tanggalKeputusan} onChange={(value) => setForm({ ...form, tanggalKeputusan: value })} />
          <Input label="Tanggal efektif" type="date" value={form.tanggalEfektif} onChange={(value) => setForm({ ...form, tanggalEfektif: value })} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input label="Catatan" value={form.catatan} onChange={(value) => setForm({ ...form, catatan: value })} />
          <div className="flex items-end">
            <button type="button" className="btn-primary min-h-11 w-full lg:w-auto" disabled={!form.santriId || !(form.tahunAjaranAsalId || tahunAktif?.id) || (targetWajib && !form.rombonganTujuanId) || buat.isPending} onClick={() => buat.mutate()}>
              <BadgeCheck className="h-4 w-4" aria-hidden />Buat Draft
            </button>
          </div>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Select label="Filter tahun" value={filter.tahunAjaranId} onChange={(value) => { setPage(1); setFilter({ ...filter, tahunAjaranId: value }); }}>
            <option value="">Semua tahun</option>
            {(tahunAjaran.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
          </Select>
          <Select label="Filter status" value={filter.status} onChange={(value) => { setPage(1); setFilter({ ...filter, status: value }); }}>
            <option value="">Semua status</option>
            {['DRAFT', 'FINALIZED', 'EXECUTED', 'CANCELED'].map((status) => <option key={status} value={status}>{status}</option>)}
          </Select>
        </div>
      </section>

      <DataGrid
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat keputusan akademik.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        emptyTitle="Belum ada keputusan akademik."
      />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <select className="field-input" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {children}
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

function labelJenis(value: string) {
  return JENIS.find((item) => item.value === value)?.label ?? value;
}
