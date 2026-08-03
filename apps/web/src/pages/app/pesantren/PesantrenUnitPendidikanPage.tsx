import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface UnitPendidikanRow extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  jenis: string;
  sort_order: number;
  is_active: boolean;
  website_enabled: boolean;
  public_slug: string | null;
  santri_subdomain: string | null;
  custom_domain: string | null;
  domain_status: string;
  welcome_title: string | null;
  welcome_body: string | null;
}

const JENIS_UNIT = [
  { value: 'SEKOLAH_FORMAL', label: 'Sekolah Formal' },
  { value: 'DINIYAH', label: 'Diniyah' },
  { value: 'TAHFIZ', label: 'Tahfiz' },
  { value: 'LAINNYA', label: 'Lainnya' },
];

const FORM_KOSONG = {
  code: '',
  name: '',
  jenis: 'SEKOLAH_FORMAL',
  sortOrder: '0',
  isActive: true,
  websiteEnabled: true,
  publicSlug: '',
  santriSubdomain: '',
  customDomain: '',
  welcomeTitle: '',
  welcomeBody: '',
};

type FormState = typeof FORM_KOSONG;

function isiForm(row: UnitPendidikanRow): FormState {
  return {
    code: row.code,
    name: row.name,
    jenis: row.jenis,
    sortOrder: String(row.sort_order),
    isActive: row.is_active,
    websiteEnabled: row.website_enabled,
    publicSlug: row.public_slug ?? '',
    santriSubdomain: row.santri_subdomain ?? '',
    customDomain: row.custom_domain ?? '',
    welcomeTitle: row.welcome_title ?? '',
    welcomeBody: row.welcome_body ?? '',
  };
}

function bangunPayload(form: FormState) {
  return {
    code: form.code,
    name: form.name,
    jenis: form.jenis,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
    isActive: form.isActive,
    websiteEnabled: form.websiteEnabled,
    publicSlug: form.publicSlug || undefined,
    santriSubdomain: form.santriSubdomain || undefined,
    customDomain: form.customDomain || undefined,
    welcomeTitle: form.welcomeTitle || undefined,
    welcomeBody: form.welcomeBody || undefined,
  };
}

export function PesantrenUnitPendidikanPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [cari, setCari] = useState('');
  const [aktif, setAktif] = useState('');
  const [editing, setEditing] = useState<UnitPendidikanRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_KOSONG);

  const queryKey = ['pesantren-unit-pendidikan', cari, aktif];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (cari) params.set('cari', cari);
      if (aktif) params.set('aktif', aktif);
      const qs = params.toString();
      return api.get<UnitPendidikanRow[]>(`/pesantren/unit-pendidikan${qs ? `?${qs}` : ''}`);
    },
  });

  const tutupForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(FORM_KOSONG);
  };

  const create = useMutation({
    mutationFn: (payload: ReturnType<typeof bangunPayload>) => api.post('/pesantren/unit-pendidikan', payload),
    onSuccess: () => {
      toast.push('Unit pendidikan berhasil dibuat.', 'success');
      tutupForm();
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ReturnType<typeof bangunPayload> }) =>
      api.patch(`/pesantren/unit-pendidikan/${id}`, payload),
    onSuccess: () => {
      toast.push('Unit pendidikan berhasil diperbarui.', 'success');
      tutupForm();
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pesantren/unit-pendidikan/${id}`),
    onSuccess: () => {
      toast.push('Unit pendidikan berhasil dihapus.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menghapus.'), 'error'),
  });

  const columns: Array<GridColumn<UnitPendidikanRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'name', header: 'Nama Unit' },
    {
      key: 'jenis',
      header: 'Jenis',
      render: (row) => JENIS_UNIT.find((j) => j.value === row.jenis)?.label ?? row.jenis,
    },
    { key: 'sort_order', header: 'Urutan' },
    {
      key: 'is_active',
      header: 'Status',
      render: (row) => <StatusBadge status={row.is_active ? 'AKTIF' : 'NONAKTIF'} />,
    },
    {
      key: 'website_enabled',
      header: 'Website',
      render: (row) => (
        <div>
          <StatusBadge status={row.website_enabled ? 'TERBIT' : 'DRAFT'} />
          {row.public_slug && <p className="mt-1 text-xs text-slate-400">/unit/{row.public_slug}</p>}
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-outline px-2 py-1.5"
            onClick={() => {
              setEditing(row);
              setCreating(false);
              setForm(isiForm(row));
            }}
            aria-label={`Sunting ${row.name}`}
          >
            <Edit2 className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="btn-outline px-2 py-1.5 text-red-700 hover:border-red-300 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm(`Hapus unit pendidikan "${row.name}"?`)) remove.mutate(row.id);
            }}
            aria-label={`Hapus ${row.name}`}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      ),
    },
  ];

  const menyimpan = create.isPending || update.isPending;
  const formTerbuka = creating || editing;

  return (
    <>
      <PageHeader
        title="Unit Pendidikan"
        description="Kelola MI, madrasah diniyah, tahfiz, BLK, atau unit lain di pondok."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Unit Pendidikan' }]}
        actions={
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setCreating(true);
              setEditing(null);
              setForm(FORM_KOSONG);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Unit
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="unit-cari">
              Cari kode atau nama
            </label>
            <input id="unit-cari" className="field-input" value={cari} onChange={(event) => setCari(event.target.value)} />
          </div>
          <div className="min-w-[160px]">
            <label className="field-label" htmlFor="unit-status">
              Status
            </label>
            <select id="unit-status" className="field-input" value={aktif} onChange={(event) => setAktif(event.target.value)}>
              <option value="">Semua</option>
              <option value="true">Aktif</option>
              <option value="false">Nonaktif</option>
            </select>
          </div>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={list.data ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
      />

      {formTerbuka && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {editing ? 'Sunting Unit Pendidikan' : 'Tambah Unit Pendidikan'}
            </h2>

            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode *">
                  <input
                    className="field-input uppercase"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="MI-RU"
                  />
                </Field>
                <Field label="Jenis *">
                  <select className="field-input" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                    {JENIS_UNIT.map((jenis) => (
                      <option key={jenis.value} value={jenis.value}>
                        {jenis.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Nama Unit *">
                <input
                  className="field-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Madrasah Ibtidaiyah Raudlatul Ulum"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Urutan">
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={form.sortOrder}
                    onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                  />
                </Field>
                <label className="mt-6 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Aktif
                </label>
              </div>

              <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.websiteEnabled}
                    onChange={(e) => setForm({ ...form, websiteEnabled: e.target.checked })}
                  />
                  Terbitkan halaman welcome unit
                </label>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Field label="Slug halaman">
                    <input
                      className="field-input lowercase"
                      value={form.publicSlug}
                      onChange={(e) => setForm({ ...form, publicSlug: e.target.value.toLowerCase() })}
                      placeholder="mi-ru"
                    />
                  </Field>
                  <Field label="Subdomain santri.info">
                    <div className="flex">
                      <input
                        className="field-input rounded-e-none lowercase"
                        value={form.santriSubdomain}
                        onChange={(e) => setForm({ ...form, santriSubdomain: e.target.value.toLowerCase() })}
                        placeholder="mi-raudlatul-ulum"
                      />
                      <span className="inline-flex items-center rounded-e-lg border border-s-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                        .santri.info
                      </span>
                    </div>
                  </Field>
                </div>

                <Field label="Domain kustom sekolah">
                  <input
                    className="field-input lowercase"
                    value={form.customDomain}
                    onChange={(e) => setForm({ ...form, customDomain: e.target.value.toLowerCase() })}
                    placeholder="mi.raudlatululum.sch.id"
                  />
                </Field>

                <Field label="Judul welcome">
                  <input
                    className="field-input"
                    value={form.welcomeTitle}
                    onChange={(e) => setForm({ ...form, welcomeTitle: e.target.value })}
                    placeholder="Selamat datang di MI Raudlatul Ulum"
                  />
                </Field>

                <Field label="Isi welcome">
                  <textarea
                    className="field-input min-h-28"
                    value={form.welcomeBody}
                    onChange={(e) => setForm({ ...form, welcomeBody: e.target.value })}
                    placeholder="Ringkasan program, kekhasan unit, atau informasi awal untuk calon wali santri."
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={tutupForm}>
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!form.code.trim() || !form.name.trim() || menyimpan}
                onClick={() => {
                  const payload = bangunPayload(form);
                  if (editing) update.mutate({ id: editing.id, payload });
                  else create.mutate(payload);
                }}
              >
                Simpan
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
