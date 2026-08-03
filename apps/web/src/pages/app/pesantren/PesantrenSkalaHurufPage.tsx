import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useErrorMessage } from '../../../app/auth-context';
import { DataGrid, PageHeader, type GridColumn } from '../../../components/ui';
import { api } from '../../../lib/api';

interface SkalaHurufRow extends Record<string, unknown> {
  id: string;
  huruf: string;
  nilai_minimum: number | string;
  nilai_maksimum: number | string;
  keterangan?: string | null;
}

const FORM_AWAL = { huruf: '', nilaiMinimum: '', nilaiMaksimum: '', keterangan: '' };

export function PesantrenSkalaHurufPage() {
  const queryClient = useQueryClient();
  const toMessage = useErrorMessage();
  const [form, setForm] = useState(FORM_AWAL);

  const skala = useQuery({
    queryKey: ['pesantren-skala-huruf'],
    queryFn: () => api.get<SkalaHurufRow[]>('/pesantren/nilai/skala-huruf'),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<SkalaHurufRow>('/pesantren/nilai/skala-huruf', {
        huruf: form.huruf.trim().toUpperCase(),
        nilaiMinimum: Number(form.nilaiMinimum),
        nilaiMaksimum: Number(form.nilaiMaksimum),
        keterangan: form.keterangan.trim() || undefined,
      }),
    onSuccess: async () => {
      setForm(FORM_AWAL);
      await queryClient.invalidateQueries({ queryKey: ['pesantren-skala-huruf'] });
    },
  });

  const columns: Array<GridColumn<SkalaHurufRow>> = [
    { key: 'huruf', header: 'Huruf', render: (row) => <span className="badge-soft">{row.huruf}</span> },
    { key: 'nilai_minimum', header: 'Minimum', render: (row) => String(row.nilai_minimum) },
    { key: 'nilai_maksimum', header: 'Maksimum', render: (row) => String(row.nilai_maksimum) },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan || '-' },
  ];

  return (
    <>
      <PageHeader
        title="Skala Huruf Rapor"
        description="Rentang konversi nilai angka menjadi huruf mutu rapor."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Skala Huruf' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void skala.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <form
          className="card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            simpan.mutate();
          }}
        >
          <h2 className="section-title mb-4">Tambah Rentang</h2>
          <Field label="Huruf" value={form.huruf} onChange={(value) => setForm({ ...form, huruf: value })} placeholder="A" required />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum" type="number" value={form.nilaiMinimum} onChange={(value) => setForm({ ...form, nilaiMinimum: value })} required />
            <Field label="Maksimum" type="number" value={form.nilaiMaksimum} onChange={(value) => setForm({ ...form, nilaiMaksimum: value })} required />
          </div>
          <Field label="Keterangan" value={form.keterangan} onChange={(value) => setForm({ ...form, keterangan: value })} placeholder="Sangat baik" />
          {simpan.isError && <p className="mt-2 text-sm text-red-600">{toMessage(simpan.error, (_key, fallback) => fallback ?? 'Gagal menyimpan skala.')}</p>}
          <button type="submit" className="btn-primary mt-4 w-full" disabled={simpan.isPending}>
            <Plus className="h-4 w-4" aria-hidden />
            Simpan Skala
          </button>
        </form>

        <DataGrid
          columns={columns}
          rows={skala.data ?? []}
          loading={skala.isLoading}
          error={skala.isError ? toMessage(skala.error, (_key, fallback) => fallback ?? 'Gagal memuat skala huruf.') : undefined}
          rowKey={(row) => row.id}
          onRetry={() => void skala.refetch()}
          emptyTitle="Belum ada skala huruf."
        />
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="mb-3 block">
      <span className="field-label">{label}</span>
      <input className="field-input" type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}
