import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, MessageSquareText, Plus, RefreshCw, Send } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface CatatanRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  nis?: string;
  nama_lengkap?: string;
  tanggal: string;
  jenis: string;
  visibilitas: string;
  judul: string;
  isi: string;
  tindak_lanjut: string | null;
  status: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

const PAGE_SIZE = 25;
const JENIS = ['AKADEMIK', 'AKHLAK', 'KESEHATAN', 'TAHFIZ', 'PERIZINAN', 'LAINNYA'];
const VISIBILITAS = ['INTERNAL', 'WALI'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenBukuPenghubungPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [dipilihId, setDipilihId] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    santriId: '',
    tanggal: today(),
    jenis: 'AKHLAK',
    visibilitas: 'WALI',
    judul: '',
    isi: '',
    tindakLanjut: '',
  });

  const santri = useQuery({
    queryKey: ['pesantren-buku-penghubung-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const list = useQuery({
    queryKey: ['pesantren-buku-penghubung', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      return api.get<{ items: CatatanRow[]; total: number }>(`/pesantren/buku-penghubung?${params.toString()}`);
    },
  });
  const detail = useQuery({
    queryKey: ['pesantren-buku-penghubung-detail', dipilihId],
    enabled: Boolean(dipilihId),
    queryFn: () => api.get<CatatanRow>(`/pesantren/buku-penghubung/${dipilihId}`),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<CatatanRow>('/pesantren/buku-penghubung', {
        ...form,
        tindakLanjut: form.tindakLanjut.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Catatan buku penghubung tersimpan.', 'success');
      setForm({ santriId: '', tanggal: form.tanggal, jenis: 'AKHLAK', visibilitas: 'WALI', judul: '', isi: '', tindakLanjut: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-buku-penghubung'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan catatan.'), 'error'),
  });

  const selesai = useMutation({
    mutationFn: (id: string) => api.patch<CatatanRow>(`/pesantren/buku-penghubung/${id}/selesai`, { tindakLanjut: tindakLanjut[id]?.trim() || undefined }),
    onSuccess: () => {
      toast.push('Catatan ditutup.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-buku-penghubung'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-buku-penghubung-detail'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menutup catatan.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const catatanDipilih = detail.data ?? (list.data?.items ?? []).find((item) => item.id === dipilihId) ?? list.data?.items[0] ?? null;
  const terbuka = (list.data?.items ?? []).filter((item) => item.status === 'TERBUKA').length;
  const untukWali = (list.data?.items ?? []).filter((item) => item.visibilitas === 'WALI').length;
  const columns: Array<GridColumn<CatatanRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => row.nama_lengkap ? `${row.nis ?? ''} ${row.nama_lengkap}` : namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'visibilitas', header: 'Visibilitas', render: (row) => <StatusBadge status={row.visibilitas} /> },
    {
      key: 'judul',
      header: 'Judul',
      render: (row) => (
        <button type="button" className="text-left font-semibold text-emerald-700" onClick={() => setDipilihId(row.id)}>
          {row.judul}
        </button>
      ),
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) =>
        row.status === 'TERBUKA' ? (
          <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => setDipilihId(row.id)}>
            Tindak lanjuti
          </button>
        ) : null,
    },
  ];
  const total = list.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Buku Penghubung"
        description="Catatan guru, pengurus, dan wali untuk tindak lanjut perkembangan santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Buku Penghubung' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void list.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Metric icon={<MessageSquareText className="h-4 w-4" aria-hidden />} label="Catatan halaman ini" value={list.data?.items.length ?? 0} />
        <Metric icon={<Send className="h-4 w-4" aria-hidden />} label="Perlu tindak lanjut" value={terbuka} />
        <Metric icon={<Bell className="h-4 w-4" aria-hidden />} label="Terkirim ke wali" value={untukWali} />
      </div>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="field-label">Santri</label>
            <select className="field-input" value={form.santriId} onChange={(event) => setForm({ ...form, santriId: event.target.value })}>
              <option value="">Pilih santri</option>
              {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
            </select>
          </div>
          <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
          <Select label="Jenis" value={form.jenis} options={JENIS} onChange={(value) => setForm({ ...form, jenis: value })} />
          <Select label="Visibilitas" value={form.visibilitas} options={VISIBILITAS} onChange={(value) => setForm({ ...form, visibilitas: value })} />
          <Input label="Judul" value={form.judul} onChange={(value) => setForm({ ...form, judul: value })} />
          <Input label="Tindak lanjut awal" value={form.tindakLanjut} onChange={(value) => setForm({ ...form, tindakLanjut: value })} />
          <div className="md:col-span-3">
            <label className="field-label">Isi catatan</label>
            <textarea className="field-input min-h-24" value={form.isi} onChange={(event) => setForm({ ...form, isi: event.target.value })} />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="btn-primary" disabled={!form.santriId || !form.judul || !form.isi || simpan.isPending} onClick={() => simpan.mutate()}>
            <Plus className="h-4 w-4" aria-hidden />
            Simpan Catatan
          </button>
        </div>
      </div>
      <div className="card mb-4 max-w-xs p-4">
        <Select label="Status" value={status} options={['', 'TERBUKA', 'SELESAI']} onChange={(value) => { setStatus(value); setPage(1); }} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <DataGrid
            columns={columns}
            rows={list.data?.items ?? []}
            loading={list.isLoading}
            error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat buku penghubung.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void list.refetch()}
            emptyTitle="Belum ada catatan buku penghubung."
          />
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
        </div>

        <aside className="card p-4">
          {catatanDipilih ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{formatDate(catatanDipilih.tanggal)}</p>
                  <h2 className="section-title">{catatanDipilih.judul}</h2>
                </div>
                <StatusBadge status={catatanDipilih.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={catatanDipilih.jenis} />
                <StatusBadge status={catatanDipilih.visibilitas} />
                {catatanDipilih.visibilitas === 'WALI' && <span className="badge-soft inline-flex items-center gap-1"><Bell className="h-3.5 w-3.5" aria-hidden /> Notifikasi wali</span>}
              </div>
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm font-semibold text-slate-900">{catatanDipilih.nama_lengkap ? `${catatanDipilih.nis ?? ''} ${catatanDipilih.nama_lengkap}` : namaSantri.get(catatanDipilih.santri_id) ?? catatanDipilih.santri_id}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{catatanDipilih.isi}</p>
              </div>
              {catatanDipilih.tindak_lanjut && (
                <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-sm font-semibold text-emerald-900">Tindak lanjut</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-emerald-800">{catatanDipilih.tindak_lanjut}</p>
                </div>
              )}
              {catatanDipilih.status === 'TERBUKA' && (
                <div className="mt-4">
                  <label className="field-label">Balasan / tindak lanjut</label>
                  <textarea
                    className="field-input min-h-28"
                    value={tindakLanjut[catatanDipilih.id] ?? catatanDipilih.tindak_lanjut ?? ''}
                    onChange={(event) => setTindakLanjut((current) => ({ ...current, [catatanDipilih.id]: event.target.value }))}
                    placeholder="Tulis tindak lanjut yang akan dibaca pengurus dan wali bila visibilitas WALI."
                  />
                  <button type="button" className="btn-primary mt-3 w-full" disabled={selesai.isPending} onClick={() => selesai.mutate(catatanDipilih.id)}>
                    <Send className="h-4 w-4" aria-hidden />
                    Kirim dan Tutup
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">Pilih catatan untuk melihat detail.</div>
          )}
        </aside>
      </div>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">{icon}</span>
      <span>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900">{value}</p>
      </span>
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
        {options.map((option) => <option key={option || 'ALL'} value={option}>{option || 'Semua'}</option>)}
      </select>
    </div>
  );
}
