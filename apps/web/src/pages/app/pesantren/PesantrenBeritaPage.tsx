import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, Image, Plus, Send, Upload } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface BeritaRow extends Record<string, unknown> {
  id: string;
  judul: string;
  ringkasan: string | null;
  isi_html: string | null;
  gambar_url: string | null;
  sumber_url: string | null;
  status: string;
  tanggal_terbit: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;
const FORM_KOSONG = { judul: '', ringkasan: '', isiHtml: '', gambarUrl: '', sumberUrl: '', tanggalTerbit: '' };

export function PesantrenBeritaPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<BeritaRow | null>(null);
  const [form, setForm] = useState(FORM_KOSONG);

  const queryKey = ['pesantren-berita', page, status];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      return api.get<{ items: BeritaRow[]; total: number }>(`/pesantren/berita?${params.toString()}`);
    },
  });

  const buat = useMutation({
    mutationFn: () =>
      api.post<BeritaRow>('/pesantren/berita', {
        judul: form.judul,
        ringkasan: form.ringkasan || undefined,
        isiHtml: form.isiHtml || undefined,
        gambarUrl: form.gambarUrl || undefined,
        sumberUrl: form.sumberUrl || undefined,
        tanggalTerbit: form.tanggalTerbit || undefined,
      }),
    onSuccess: (row) => {
      toast.push('Berita berhasil dibuat sebagai draft.', 'success');
      setCreating(false);
      setForm(FORM_KOSONG);
      setDetail(row);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-berita'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat berita.'), 'error'),
  });

  const terbitkan = useMutation({
    mutationFn: (id: string) => api.post<BeritaRow>(`/pesantren/berita/${id}/terbitkan`),
    onSuccess: () => {
      toast.push('Berita berhasil diterbitkan.', 'success');
      setDetail(null);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-berita'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menerbitkan berita.'), 'error'),
  });

  const unggahGambar = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      return api.post<BeritaRow>(`/pesantren/berita/${id}/gambar`, body);
    },
    onSuccess: (row) => {
      toast.push('Gambar sampul berita berhasil diunggah.', 'success');
      setDetail(row);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-berita'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengunggah gambar.'), 'error'),
  });

  const columns: Array<GridColumn<BeritaRow>> = [
    { key: 'judul', header: 'Judul' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'tanggal_terbit', header: 'Tanggal Terbit', render: (row) => formatDate(row.tanggal_terbit) },
    { key: 'created_at', header: 'Dibuat', render: (row) => formatDate(row.created_at) },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline px-2 py-1.5" onClick={() => setDetail(row)} aria-label={`Detail ${row.judul}`}>
            <Eye className="h-4 w-4" aria-hidden />
          </button>
          {row.status !== 'TERBIT' && (
            <button
              type="button"
              className="btn-outline px-2 py-1.5"
              disabled={terbitkan.isPending}
              onClick={() => terbitkan.mutate(row.id)}
              aria-label={`Terbitkan ${row.judul}`}
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Berita Pondok"
        description="Tulis kabar pondok dan terbitkan ke halaman publik santri.info."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Berita Pondok' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Tulis Berita
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="max-w-xs">
          <label className="field-label" htmlFor="berita-status">
            Status
          </label>
          <select
            id="berita-status"
            className="field-input"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua</option>
            <option value="DRAFT">Draft</option>
            <option value="TERBIT">Terbit</option>
          </select>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat berita.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        emptyTitle="Belum ada berita."
      />
      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tulis Berita</h2>
            <div className="mt-4 space-y-3">
              <Field label="Judul *">
                <input className="field-input" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} />
              </Field>
              <Field label="Ringkasan">
                <textarea className="field-input min-h-20" value={form.ringkasan} onChange={(e) => setForm({ ...form, ringkasan: e.target.value })} />
              </Field>
              <Field label="Isi berita">
                <textarea className="field-input min-h-48" value={form.isiHtml} onChange={(e) => setForm({ ...form, isiHtml: e.target.value })} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tanggal terbit">
                  <input type="date" className="field-input" value={form.tanggalTerbit} onChange={(e) => setForm({ ...form, tanggalTerbit: e.target.value })} />
                </Field>
                <Field label="Gambar URL">
                  <input className="field-input" value={form.gambarUrl} onChange={(e) => setForm({ ...form, gambarUrl: e.target.value })} />
                </Field>
              </div>
              <Field label="Sumber URL">
                <input className="field-input" value={form.sumberUrl} onChange={(e) => setForm({ ...form, sumberUrl: e.target.value })} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setCreating(false)}>
                Batal
              </button>
              <button type="button" className="btn-primary" disabled={!form.judul.trim() || buat.isPending} onClick={() => buat.mutate()}>
                Simpan Draft
              </button>
            </div>
          </div>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{detail.judul}</h2>
                <p className="mt-1 text-sm text-slate-500">{formatDate(detail.tanggal_terbit ?? detail.created_at)}</p>
              </div>
              <StatusBadge status={detail.status} />
            </div>
            {detail.ringkasan && <p className="mt-4 text-sm font-medium text-slate-700 dark:text-slate-300">{detail.ringkasan}</p>}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex gap-3">
                <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg bg-white dark:bg-slate-950">
                  {detail.gambar_url ? (
                    <img src={detail.gambar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-slate-300">
                      <Image className="h-7 w-7" aria-hidden />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900 dark:text-white">Gambar sampul</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Gambar ini tampil pada kartu kabar pondok dan detail berita publik. Gunakan JPEG, PNG, atau WEBP maksimal 5 MB.
                  </p>
                  <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
                    <Upload className="h-4 w-4" aria-hidden />
                    Unggah sampul
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={unggahGambar.isPending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) unggahGambar.mutate({ id: detail.id, file });
                        e.currentTarget.value = '';
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            {detail.isi_html && <div className="prose prose-sm mt-4 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: detail.isi_html }} />}
            <div className="mt-6 flex justify-end gap-2">
              {detail.status !== 'TERBIT' && (
                <button type="button" className="btn-primary" disabled={terbitkan.isPending} onClick={() => terbitkan.mutate(detail.id)}>
                  Terbitkan
                </button>
              )}
              <button type="button" className="btn-outline" onClick={() => setDetail(null)}>
                Tutup
              </button>
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
