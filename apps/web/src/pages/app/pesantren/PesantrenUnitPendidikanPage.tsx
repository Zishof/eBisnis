import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Image, Plus, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { CrudActionBar, CrudDashboard } from '../../../components/crud-actions';
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
  logo_url: string | null;
  hero_image_url: string | null;
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
  logoUrl: '',
  heroImageUrl: '',
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
    logoUrl: row.logo_url ?? '',
    heroImageUrl: row.hero_image_url ?? '',
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
    logoUrl: form.logoUrl || undefined,
    heroImageUrl: form.heroImageUrl || undefined,
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

  const unggahGambar = useMutation({
    mutationFn: async ({ id, kategori, file }: { id: string; kategori: 'LOGO' | 'HERO'; file: File }) => {
      const body = new FormData();
      body.append('file', file);
      return api.post<UnitPendidikanRow>(`/pesantren/unit-pendidikan/${id}/gambar/${kategori}`, body);
    },
    onSuccess: (row, variables) => {
      toast.push(variables.kategori === 'LOGO' ? 'Logo unit berhasil diunggah.' : 'Foto hero unit berhasil diunggah.', 'success');
      setEditing(row);
      setForm(isiForm(row));
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengunggah gambar.'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pesantren/unit-pendidikan/${id}`),
    onSuccess: () => {
      toast.push('Unit pendidikan berhasil dihapus.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menghapus.'), 'error'),
  });

  const uploadExcel = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const content = XLSX.utils.sheet_to_csv(worksheet);
      return api.post<{ created: number; updated: number; skipped: number }>('/pesantren/dapodik/unit-pendidikan/import', {
        format: 'csv',
        content,
        dryRun: false,
      });
    },
    onSuccess: (payload) => {
      toast.push(`Upload unit selesai: ${payload.created} dibuat, ${payload.updated} diperbarui, ${payload.skipped} dilewati.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-unit-pendidikan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Upload Excel unit pendidikan gagal.'), 'error'),
  });

  const columns: Array<GridColumn<UnitPendidikanRow>> = [
    { key: 'code', header: 'Kode' },
    {
      key: 'name',
      header: 'Nama Unit',
      render: (row) => (
        <div className="flex items-center gap-3">
          <VisualPreview url={row.logo_url || row.hero_image_url} fallback={row.name} />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{row.name}</p>
            <p className="text-xs text-slate-500">{row.logo_url || row.hero_image_url ? 'Visual unit aktif' : 'Memakai visual pondok'}</p>
          </div>
        </div>
      ),
    },
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
  const rows = list.data ?? [];
  const aktifCount = rows.filter((row) => row.is_active).length;
  const websiteCount = rows.filter((row) => row.website_enabled).length;
  const domainCount = rows.filter((row) => row.santri_subdomain || row.custom_domain).length;

  return (
    <>
      <PageHeader
        title="Unit Pendidikan"
        description="Kelola MI, madrasah diniyah, tahfiz, BLK, atau unit lain di pondok."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Unit Pendidikan' }]}
        actions={
          <>
            <CrudActionBar
              title="Unit Pendidikan"
              rows={rows}
              columns={columns}
              filename="unit-pendidikan"
              uploadLabel={uploadExcel.isPending ? 'Mengupload...' : 'Upload Excel'}
              onUploadRows={async (uploadedRows) => {
                await uploadExcel.mutateAsync(uploadedRows);
              }}
            />
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
          </>
        }
      />

      <CrudDashboard
        metrics={[
          { label: 'Total Unit', value: rows.length, tone: 'emerald' },
          { label: 'Aktif', value: aktifCount, tone: 'sky' },
          { label: 'Website Terbit', value: websiteCount, tone: 'amber' },
          { label: 'Domain Terisi', value: domainCount, tone: 'slate' },
        ]}
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
        rows={rows}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        showCrudTools={false}
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

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                  <div className="mb-4 flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      <Image className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">Visual Halaman Unit</h3>
                      <p className="text-xs text-slate-500">Kosongkan untuk memakai logo dan foto hero pondok induk.</p>
                    </div>
                  </div>
                  <div className="grid gap-3 md:grid-cols-[150px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                      {form.heroImageUrl || form.logoUrl ? (
                        <img src={form.heroImageUrl || form.logoUrl} alt="" className="h-28 w-full object-cover" />
                      ) : (
                        <div className="grid h-28 place-items-center text-slate-300">
                          <Image className="h-8 w-8" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Field label="Logo unit URL">
                        <input
                          className="field-input"
                          value={form.logoUrl}
                          onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                          placeholder="https://.../logo-mi.png"
                        />
                        {editing && (
                          <UploadButton
                            disabled={unggahGambar.isPending}
                            onFile={(file) => unggahGambar.mutate({ id: editing.id, kategori: 'LOGO', file })}
                          />
                        )}
                      </Field>
                      <Field label="Foto hero unit URL">
                        <input
                          className="field-input"
                          value={form.heroImageUrl}
                          onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
                          placeholder="https://.../kegiatan-belajar.jpg"
                        />
                        {editing && (
                          <UploadButton
                            disabled={unggahGambar.isPending}
                            onFile={(file) => unggahGambar.mutate({ id: editing.id, kategori: 'HERO', file })}
                          />
                        )}
                      </Field>
                    </div>
                  </div>
                  {!editing && (
                    <p className="mt-3 text-xs text-slate-500">
                      Simpan unit terlebih dahulu untuk mengunggah gambar dari komputer.
                    </p>
                  )}
                </div>

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

function VisualPreview({ url, fallback }: { url: string | null; fallback: string }) {
  if (url) {
    return <img src={url} alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-slate-200 dark:ring-slate-800" />;
  }
  return (
    <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-50 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-900">
      {fallback.slice(0, 2).toUpperCase()}
    </span>
  );
}

function UploadButton({ disabled, onFile }: { disabled?: boolean; onFile: (file: File) => void }) {
  return (
    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
      <Upload className="h-4 w-4" aria-hidden />
      Unggah gambar
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );
}
