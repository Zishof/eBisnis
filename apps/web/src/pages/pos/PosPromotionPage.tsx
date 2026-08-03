import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
import { api, apiRequestPaged, formatDate, formatMoney } from '../../lib/api';
import {
  Code,
  ConfirmDialog,
  DataGrid,
  PageHeader,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

type BenefitType = 'PERCENT' | 'AMOUNT';
type ScopeType = 'TENANT' | 'OUTLET' | 'BRAND';
type TargetKind = 'PRODUCT' | 'CATEGORY';

interface AturanDiskon extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  description: string | null;
  benefitType: BenefitType;
  benefitValue: string;
  maxDiscountAmount: string | null;
  minimumPurchase: string | null;
  minimumQuantity: string | null;
  scopeType: ScopeType;
  scopeId: string | null;
  validFrom: string | null;
  validUntil: string | null;
  validDays: number[] | null;
  validTimeFrom: string | null;
  validTimeTo: string | null;
  usageLimit: number | null;
  usageCount: number;
  requiresApproval: boolean;
  priority: number;
  isActive: boolean;
  targets: TargetAturan[];
}

interface TargetAturan {
  productId: string | null;
  productCategoryId: string | null;
  isExclusion: boolean;
}

interface PilihanMaster extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  is_active?: boolean;
  deleted_at?: string | null;
}

interface TargetForm {
  kind: TargetKind;
  id: string;
  isExclusion: boolean;
}

interface FormAturanDiskon {
  id?: string;
  code: string;
  name: string;
  description: string;
  benefitType: BenefitType;
  benefitValue: string;
  maxDiscountAmount: string;
  minimumPurchase: string;
  minimumQuantity: string;
  scopeType: ScopeType;
  scopeId: string;
  validFrom: string;
  validUntil: string;
  validDays: number[];
  validTimeFrom: string;
  validTimeTo: string;
  usageLimit: string;
  requiresApproval: boolean;
  priority: string;
  isActive: boolean;
  targets: TargetForm[];
}

const HARI = [
  { nilai: 1, label: 'Senin' },
  { nilai: 2, label: 'Selasa' },
  { nilai: 3, label: 'Rabu' },
  { nilai: 4, label: 'Kamis' },
  { nilai: 5, label: 'Jumat' },
  { nilai: 6, label: 'Sabtu' },
  { nilai: 7, label: 'Minggu' },
];

const FORM_KOSONG: FormAturanDiskon = {
  code: '',
  name: '',
  description: '',
  benefitType: 'PERCENT',
  benefitValue: '',
  maxDiscountAmount: '',
  minimumPurchase: '',
  minimumQuantity: '',
  scopeType: 'TENANT',
  scopeId: '',
  validFrom: '',
  validUntil: '',
  validDays: [],
  validTimeFrom: '',
  validTimeTo: '',
  usageLimit: '',
  requiresApproval: false,
  priority: '100',
  isActive: true,
  targets: [],
};

export function PosPromotionPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [includeInactive, setIncludeInactive] = useState(true);
  const [form, setForm] = useState<FormAturanDiskon | null>(null);
  const [nonaktif, setNonaktif] = useState<AturanDiskon | null>(null);

  const daftar = useQuery({
    queryKey: ['pos-promotions', includeInactive],
    queryFn: () =>
      api.get<AturanDiskon[]>(`/pos/promotions?includeInactive=${String(includeInactive)}`),
  });

  const produk = useMasterOptions('products');
  const kategori = useMasterOptions('product-categories');
  const outlet = useMasterOptions('outlets');
  const brand = useMasterOptions('product-brands');

  const refreshDaftar = () => void queryClient.invalidateQueries({ queryKey: ['pos-promotions'] });

  const simpan = useMutation({
    mutationFn: (input: FormAturanDiskon) => {
      const body = susunPayload(input);
      return input.id
        ? api.patch<AturanDiskon>(`/pos/promotions/${input.id}`, body)
        : api.post<AturanDiskon>('/pos/promotions', body);
    },
    onSuccess: () => {
      toast.push('Aturan diskon berhasil disimpan.', 'success');
      setForm(null);
      refreshDaftar();
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan aturan diskon.'), 'error'),
  });

  const matikan = useMutation({
    mutationFn: (id: string) => api.post<AturanDiskon>(`/pos/promotions/${id}/deactivate`, {}),
    onSuccess: () => {
      toast.push('Aturan diskon dinonaktifkan.', 'success');
      setNonaktif(null);
      refreshDaftar();
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menonaktifkan aturan.'), 'error'),
  });

  const labelScope = useMemo(
    () => ({
      OUTLET: new Map((outlet.data ?? []).map((item) => [item.id, `${item.code} - ${item.name}`])),
      BRAND: new Map((brand.data ?? []).map((item) => [item.id, `${item.code} - ${item.name}`])),
    }),
    [outlet.data, brand.data],
  );

  const kolom: Array<GridColumn<AturanDiskon>> = [
    {
      key: 'code',
      header: 'Kode',
      render: (row) => <Code>{row.code}</Code>,
    },
    {
      key: 'name',
      header: 'Nama',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900 dark:text-white">{row.name}</p>
          {row.description && (
            <p className="mt-0.5 max-w-md text-xs text-slate-500 dark:text-slate-400">{row.description}</p>
          )}
        </div>
      ),
    },
    {
      key: 'benefit',
      header: 'Potongan',
      render: (row) =>
        row.benefitType === 'PERCENT'
          ? `${formatAngka(row.benefitValue)}%${row.maxDiscountAmount ? `, maks ${formatMoney(row.maxDiscountAmount)}` : ''}`
          : formatMoney(row.benefitValue),
    },
    {
      key: 'scope',
      header: 'Lingkup',
      render: (row) => {
        if (row.scopeType === 'TENANT') return 'Semua tenant';
        return labelScope[row.scopeType].get(row.scopeId ?? '') ?? `${row.scopeType} ${row.scopeId ?? ''}`;
      },
    },
    {
      key: 'masa',
      header: 'Masa',
      render: (row) => (
        <div className="text-xs">
          <p>{formatRentang(row)}</p>
          <p className="text-slate-500 dark:text-slate-400">{formatHariJam(row)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={row.isActive ? 'ACTIVE' : 'INACTIVE'} />
          {row.requiresApproval && <StatusBadge status="APPROVAL" tone="warning" />}
          <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Pakai {row.usageCount}
            {row.usageLimit ? `/${row.usageLimit}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setForm(formDariAturan(row))}
            title="Sunting"
            aria-label={`Sunting ${row.code}`}
          >
            <Edit3 className="h-4 w-4" aria-hidden />
          </button>
          {row.isActive && (
            <button
              type="button"
              className="rounded p-1.5 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950"
              onClick={() => setNonaktif(row)}
              title="Nonaktifkan"
              aria-label={`Nonaktifkan ${row.code}`}
            >
              <Power className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Aturan Diskon"
        description="Kelola aturan promo POS yang dipakai mesin harga saat transaksi kasir."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'POS' }, { label: 'Aturan Diskon' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => void daftar.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat ulang
            </button>
            <button type="button" className="btn-primary" onClick={() => setForm(FORM_KOSONG)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah Aturan
            </button>
          </>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(event) => setIncludeInactive(event.target.checked)}
          />
          Tampilkan aturan nonaktif
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Prioritas kecil menang lebih dulu saat beberapa aturan sama-sama berlaku.
        </p>
      </div>

      <DataGrid
        columns={kolom}
        rows={daftar.data ?? []}
        loading={daftar.isLoading}
        error={daftar.isError ? toMessage(daftar.error, (_key, fallback) => fallback ?? 'Gagal memuat aturan diskon.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void daftar.refetch()}
        emptyTitle="Belum ada aturan diskon."
      />

      {form && (
        <FormModal
          form={form}
          setForm={setForm}
          produk={produk.data ?? []}
          kategori={kategori.data ?? []}
          outlet={outlet.data ?? []}
          brand={brand.data ?? []}
          pending={simpan.isPending}
          onBatal={() => setForm(null)}
          onSimpan={() => simpan.mutate(form)}
        />
      )}

      <ConfirmDialog
        open={Boolean(nonaktif)}
        title="Nonaktifkan aturan diskon"
        description={nonaktif ? `Aturan ${nonaktif.code} tidak akan dipakai pada transaksi berikutnya.` : undefined}
        confirmLabel="Nonaktifkan"
        destructive
        onCancel={() => setNonaktif(null)}
        onConfirm={() => {
          if (nonaktif) matikan.mutate(nonaktif.id);
        }}
      />
    </>
  );
}

function useMasterOptions(resource: string) {
  return useQuery({
    queryKey: ['pos-promotion-options', resource],
    queryFn: async () => {
      const result = await apiRequestPaged<PilihanMaster[]>(
        `/${resource}?page=1&pageSize=200&includeInactive=false&includeDeleted=false`,
      );
      return result.data.filter((row) => row.deleted_at == null && row.is_active !== false);
    },
    staleTime: 5 * 60_000,
  });
}

function FormModal({
  form,
  setForm,
  produk,
  kategori,
  outlet,
  brand,
  pending,
  onBatal,
  onSimpan,
}: {
  form: FormAturanDiskon;
  setForm: (form: FormAturanDiskon) => void;
  produk: PilihanMaster[];
  kategori: PilihanMaster[];
  outlet: PilihanMaster[];
  brand: PilihanMaster[];
  pending: boolean;
  onBatal: () => void;
  onSimpan: () => void;
}) {
  const scopeOptions = form.scopeType === 'OUTLET' ? outlet : form.scopeType === 'BRAND' ? brand : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={form.id ? 'Sunting aturan diskon' : 'Tambah aturan diskon'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onBatal();
      }}
    >
      <div className="card max-h-[90vh] w-full max-w-5xl overflow-y-auto p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {form.id ? 'Sunting Aturan Diskon' : 'Tambah Aturan Diskon'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Nilai akhir transaksi tetap dihitung di server POS.
            </p>
          </div>
          <button type="button" className="btn-outline px-3 py-1.5" onClick={onBatal}>
            Batal
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Identitas</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Kode *">
                  <input
                    className="field-input uppercase"
                    value={form.code}
                    maxLength={48}
                    onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                    placeholder="KOPI10"
                  />
                </Field>
                <Field label="Nama *">
                  <input
                    className="field-input"
                    value={form.name}
                    maxLength={160}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="Diskon Kopi 10%"
                  />
                </Field>
              </div>
              <Field label="Deskripsi">
                <textarea
                  className="field-input"
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Potongan</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Jenis *">
                  <select
                    className="field-input"
                    value={form.benefitType}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        benefitType: event.target.value as BenefitType,
                        maxDiscountAmount: event.target.value === 'AMOUNT' ? '' : form.maxDiscountAmount,
                      })
                    }
                  >
                    <option value="PERCENT">Persen</option>
                    <option value="AMOUNT">Nominal</option>
                  </select>
                </Field>
                <Field label={form.benefitType === 'PERCENT' ? 'Nilai persen *' : 'Nilai nominal *'}>
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step={form.benefitType === 'PERCENT' ? '0.01' : '1'}
                    value={form.benefitValue}
                    onChange={(event) => setForm({ ...form, benefitValue: event.target.value })}
                  />
                </Field>
                <Field label="Maks potongan">
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="1"
                    disabled={form.benefitType === 'AMOUNT'}
                    value={form.maxDiscountAmount}
                    onChange={(event) => setForm({ ...form, maxDiscountAmount: event.target.value })}
                  />
                </Field>
                <Field label="Perlu approval">
                  <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={form.requiresApproval}
                      onChange={(event) => setForm({ ...form, requiresApproval: event.target.checked })}
                    />
                    Ya
                  </label>
                </Field>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Syarat dan masa berlaku</h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Min pembelian">
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.minimumPurchase}
                    onChange={(event) => setForm({ ...form, minimumPurchase: event.target.value })}
                  />
                </Field>
                <Field label="Min jumlah">
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.minimumQuantity}
                    onChange={(event) => setForm({ ...form, minimumQuantity: event.target.value })}
                  />
                </Field>
                <Field label="Kuota pakai">
                  <input
                    className="field-input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.usageLimit}
                    onChange={(event) => setForm({ ...form, usageLimit: event.target.value })}
                  />
                </Field>
                <Field label="Prioritas">
                  <input
                    className="field-input"
                    type="number"
                    min="0"
                    step="1"
                    value={form.priority}
                    onChange={(event) => setForm({ ...form, priority: event.target.value })}
                  />
                </Field>
                <Field label="Mulai">
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={form.validFrom}
                    onChange={(event) => setForm({ ...form, validFrom: event.target.value })}
                  />
                </Field>
                <Field label="Selesai">
                  <input
                    className="field-input"
                    type="datetime-local"
                    value={form.validUntil}
                    onChange={(event) => setForm({ ...form, validUntil: event.target.value })}
                  />
                </Field>
                <Field label="Jam mulai">
                  <input
                    className="field-input"
                    type="time"
                    value={form.validTimeFrom}
                    onChange={(event) => setForm({ ...form, validTimeFrom: event.target.value })}
                  />
                </Field>
                <Field label="Jam selesai">
                  <input
                    className="field-input"
                    type="time"
                    value={form.validTimeTo}
                    onChange={(event) => setForm({ ...form, validTimeTo: event.target.value })}
                  />
                </Field>
              </div>
              <div>
                <p className="field-label">Hari berlaku</p>
                <div className="flex flex-wrap gap-2">
                  {HARI.map((hari) => (
                    <label
                      key={hari.nilai}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
                    >
                      <input
                        type="checkbox"
                        checked={form.validDays.includes(hari.nilai)}
                        onChange={(event) => {
                          const validDays = event.target.checked
                            ? [...form.validDays, hari.nilai].sort((a, b) => a - b)
                            : form.validDays.filter((nilai) => nilai !== hari.nilai);
                          setForm({ ...form, validDays });
                        }}
                      />
                      {hari.label}
                    </label>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Lingkup</h3>
              <Field label="Berlaku untuk">
                <select
                  className="field-input"
                  value={form.scopeType}
                  onChange={(event) =>
                    setForm({ ...form, scopeType: event.target.value as ScopeType, scopeId: '' })
                  }
                >
                  <option value="TENANT">Semua tenant</option>
                  <option value="OUTLET">Outlet tertentu</option>
                  <option value="BRAND">Brand tertentu</option>
                </select>
              </Field>
              {form.scopeType !== 'TENANT' && (
                <Field label={form.scopeType === 'OUTLET' ? 'Outlet *' : 'Brand *'}>
                  <select
                    className="field-input"
                    value={form.scopeId}
                    onChange={(event) => setForm({ ...form, scopeId: event.target.value })}
                  >
                    <option value="">Pilih</option>
                    {scopeOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
                />
                Aktif
              </label>
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Target produk</h3>
                <button
                  type="button"
                  className="btn-outline px-2 py-1 text-xs"
                  onClick={() =>
                    setForm({
                      ...form,
                      targets: [...form.targets, { kind: 'PRODUCT', id: '', isExclusion: false }],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Target
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Kosong berarti berlaku untuk semua produk.
              </p>
              <div className="space-y-2">
                {form.targets.map((target, index) => {
                  const options = target.kind === 'PRODUCT' ? produk : kategori;
                  return (
                    <div
                      key={`${index}-${target.kind}`}
                      className="rounded-lg border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="grid gap-2">
                        <select
                          className="field-input"
                          value={target.kind}
                          onChange={(event) => updateTarget(form, setForm, index, { kind: event.target.value as TargetKind, id: '' })}
                        >
                          <option value="PRODUCT">Produk</option>
                          <option value="CATEGORY">Kategori</option>
                        </select>
                        <select
                          className="field-input"
                          value={target.id}
                          onChange={(event) => updateTarget(form, setForm, index, { id: event.target.value })}
                        >
                          <option value="">Pilih</option>
                          {options.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} - {item.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                            <input
                              type="checkbox"
                              checked={target.isExclusion}
                              onChange={(event) => updateTarget(form, setForm, index, { isExclusion: event.target.checked })}
                            />
                            Pengecualian
                          </label>
                          <button
                            type="button"
                            className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950"
                            onClick={() =>
                              setForm({ ...form, targets: form.targets.filter((_, targetIndex) => targetIndex !== index) })
                            }
                            title="Hapus target"
                            aria-label="Hapus target"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <button type="button" className="btn-outline" onClick={onBatal}>
            Batal
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!form.code || !form.name || !form.benefitValue || pending}
            onClick={onSimpan}
          >
            Simpan
          </button>
        </div>
      </div>
    </div>
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

function updateTarget(
  form: FormAturanDiskon,
  setForm: (form: FormAturanDiskon) => void,
  index: number,
  patch: Partial<TargetForm>,
) {
  setForm({
    ...form,
    targets: form.targets.map((target, targetIndex) =>
      targetIndex === index ? { ...target, ...patch } : target,
    ),
  });
}

function susunPayload(form: FormAturanDiskon) {
  const angka = (nilai: string) => (nilai.trim() === '' ? null : Number(nilai));
  return {
    code: form.code,
    name: form.name,
    description: form.description || null,
    benefitType: form.benefitType,
    benefitValue: angka(form.benefitValue),
    maxDiscountAmount: angka(form.maxDiscountAmount),
    minimumPurchase: angka(form.minimumPurchase),
    minimumQuantity: angka(form.minimumQuantity),
    scopeType: form.scopeType,
    scopeId: form.scopeType === 'TENANT' ? null : form.scopeId,
    validFrom: form.validFrom || null,
    validUntil: form.validUntil || null,
    validDays: form.validDays.length ? form.validDays : null,
    validTimeFrom: form.validTimeFrom || null,
    validTimeTo: form.validTimeTo || null,
    usageLimit: angka(form.usageLimit),
    requiresApproval: form.requiresApproval,
    priority: angka(form.priority),
    isActive: form.isActive,
    targets: form.targets
      .filter((target) => target.id)
      .map((target) => ({
        productId: target.kind === 'PRODUCT' ? target.id : null,
        productCategoryId: target.kind === 'CATEGORY' ? target.id : null,
        isExclusion: target.isExclusion,
      })),
  };
}

function formDariAturan(row: AturanDiskon): FormAturanDiskon {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    benefitType: row.benefitType,
    benefitValue: row.benefitValue,
    maxDiscountAmount: row.maxDiscountAmount ?? '',
    minimumPurchase: row.minimumPurchase ?? '',
    minimumQuantity: row.minimumQuantity ?? '',
    scopeType: row.scopeType,
    scopeId: row.scopeId ?? '',
    validFrom: keInputTanggal(row.validFrom),
    validUntil: keInputTanggal(row.validUntil),
    validDays: row.validDays ?? [],
    validTimeFrom: keInputJam(row.validTimeFrom),
    validTimeTo: keInputJam(row.validTimeTo),
    usageLimit: row.usageLimit ? String(row.usageLimit) : '',
    requiresApproval: row.requiresApproval,
    priority: String(row.priority),
    isActive: row.isActive,
    targets: row.targets.map((target) => ({
      kind: target.productId ? 'PRODUCT' : 'CATEGORY',
      id: target.productId ?? target.productCategoryId ?? '',
      isExclusion: target.isExclusion,
    })),
  };
}

function keInputTanggal(nilai: string | null): string {
  if (!nilai) return '';
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return '';
  const offset = tanggal.getTimezoneOffset() * 60_000;
  return new Date(tanggal.getTime() - offset).toISOString().slice(0, 16);
}

function keInputJam(nilai: string | null): string {
  return nilai ? nilai.slice(0, 5) : '';
}

function formatAngka(nilai: string | number): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(nilai));
}

function formatRentang(row: AturanDiskon): string {
  if (!row.validFrom && !row.validUntil) return 'Permanen';
  return `${formatDate(row.validFrom)} sampai ${formatDate(row.validUntil)}`;
}

function formatHariJam(row: AturanDiskon): string {
  const hari = row.validDays?.length
    ? row.validDays.map((nilai) => HARI.find((h) => h.nilai === nilai)?.label ?? nilai).join(', ')
    : 'Setiap hari';
  const jam = row.validTimeFrom && row.validTimeTo ? `${keInputJam(row.validTimeFrom)}-${keInputJam(row.validTimeTo)}` : 'sepanjang hari';
  return `${hari}, ${jam}`;
}
