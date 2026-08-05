import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileDown,
  FileSpreadsheet,
  History,
  Plus,
  Power,
  Save,
  Search,
  X,
} from 'lucide-react';
import { api, apiRequestPaged, formatDateTime } from '../../lib/api';
import { downloadExcel, downloadPdf, type ExportColumn } from '../../lib/export-table';
import { PageHeader, StatusBadge, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

export type InventoryPartyKind = 'suppliers' | 'customers' | 'salespeople';

interface PartyRow extends Record<string, unknown> {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  deleted_at: string | null;
  version: number;
  updated_at: string;
}

interface BalanceRow {
  id: string;
  balance: string;
  document_count: number;
  customer_count?: number;
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  operation: string;
  changed_columns: string[] | null;
  statement_timestamp: string;
  action_code: string | null;
  actor_username: string | null;
}

interface FieldDefinition {
  key: string;
  label: string;
  type?: 'text' | 'email' | 'number' | 'textarea';
  required?: boolean;
  sensitive?: boolean;
  min?: number;
  max?: number;
}

const CONFIG: Record<InventoryPartyKind, {
  title: string;
  singular: string;
  description: string;
  codeMax: number;
  balanceLabel: string;
  fields: FieldDefinition[];
}> = {
  suppliers: {
    title: 'Master Pemasok',
    singular: 'pemasok',
    description: 'Data pemasok, termin pembayaran, rekening, saldo hutang, dan jejak perubahan.',
    codeMax: 3,
    balanceLabel: 'Saldo hutang',
    fields: [
      { key: 'code', label: 'Kode pemasok', required: true },
      { key: 'name', label: 'Nama pemasok', required: true },
      { key: 'legacy_payment_days', label: 'Termin pembayaran (hari)', type: 'number', min: 0, max: 3650 },
      { key: 'contact_person', label: 'Kontak utama' },
      { key: 'address_text', label: 'Alamat', type: 'textarea' },
      { key: 'region_name', label: 'Wilayah' },
      { key: 'phone', label: 'Nomor telepon' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'bank_account_number', label: 'Nomor rekening', sensitive: true },
      { key: 'bank_account_name', label: 'Nama pemilik rekening', sensitive: true },
      { key: 'bank_name', label: 'Bank', sensitive: true },
      { key: 'bank_address', label: 'Alamat bank', type: 'textarea', sensitive: true },
    ],
  },
  customers: {
    title: 'Master Pelanggan',
    singular: 'pelanggan',
    description: 'Profil toko pelanggan, wilayah sales, termin, diskon, rekening, dan saldo piutang.',
    codeMax: 5,
    balanceLabel: 'Saldo piutang',
    fields: [
      { key: 'code', label: 'Kode pelanggan', required: true },
      { key: 'name', label: 'Nama pelanggan', required: true },
      { key: 'legacy_payment_days', label: 'Termin pembayaran (hari)', type: 'number', min: 0, max: 3650 },
      { key: 'default_discount_percent', label: 'Diskon bawaan (%)', type: 'number', min: 0, max: 100 },
      { key: 'credit_limit', label: 'Batas kredit', type: 'number', min: 0 },
      { key: 'address_text', label: 'Alamat', type: 'textarea' },
      { key: 'region_name', label: 'Wilayah/rute' },
      { key: 'phone', label: 'Nomor telepon' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'bank_account_number', label: 'Nomor rekening', sensitive: true },
      { key: 'bank_account_name', label: 'Nama pemilik rekening', sensitive: true },
      { key: 'bank_name', label: 'Bank', sensitive: true },
      { key: 'bank_address', label: 'Alamat bank', type: 'textarea', sensitive: true },
    ],
  },
  salespeople: {
    title: 'Master Sales',
    singular: 'sales',
    description: 'Penugasan sales lapangan, wilayah, target bulanan, pelanggan, dan beban piutang.',
    codeMax: 2,
    balanceLabel: 'Piutang dibawa',
    fields: [
      { key: 'code', label: 'Kode sales', required: true },
      { key: 'name', label: 'Nama sales', required: true },
      { key: 'account_number', label: 'Nomor perkiraan' },
      { key: 'territory', label: 'Wilayah/rute' },
      { key: 'monthly_target', label: 'Target bulanan', type: 'number', min: 0 },
      { key: 'phone', label: 'Nomor telepon' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'description', label: 'Catatan penugasan', type: 'textarea' },
    ],
  },
};

function rupiah(value: string | number | undefined): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
    .format(Number(value ?? 0));
}

function initialForm(config: (typeof CONFIG)[InventoryPartyKind], row?: PartyRow): Record<string, string> {
  return Object.fromEntries(config.fields.map((field) => [field.key, String(row?.[field.key] ?? '')]));
}

function payloadOf(fields: FieldDefinition[], form: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => {
    const raw = form[field.key]?.trim() ?? '';
    if (field.type === 'number') return [field.key, raw === '' ? 0 : Number(raw)];
    return [field.key, raw || null];
  }));
}

export function InventoryPartyMasterPage({ kind }: { kind: InventoryPartyKind }) {
  const config = CONFIG[kind];
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showBank, setShowBank] = useState(false);
  const [balanceFilter, setBalanceFilter] = useState<'ALL' | 'OPEN' | 'SETTLED'>('ALL');
  const [form, setForm] = useState<Record<string, string>>(() => initialForm(config));

  const list = useQuery({
    queryKey: ['inventory-party-master', kind, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: '1', pageSize: '100', includeInactive: 'true', sortBy: 'name' });
      if (search.trim()) params.set('search', search.trim());
      return apiRequestPaged<PartyRow[]>(`/${kind}?${params.toString()}`);
    },
  });
  const balances = useQuery({
    queryKey: ['inventory-party-balances', kind],
    queryFn: () => api.get<BalanceRow[]>(`/inventory/party-master-balances/${kind}`),
  });
  const rows = list.data?.data ?? [];
  const balanceById = useMemo(() => new Map((balances.data ?? []).map((row) => [row.id, row])), [balances.data]);
  const visibleRows = useMemo(() => rows.filter((row) => {
    const balance = Number(balanceById.get(row.id)?.balance ?? 0);
    return balanceFilter === 'ALL' || (balanceFilter === 'OPEN' && balance > 0) || (balanceFilter === 'SETTLED' && balance <= 0);
  }), [rows, balanceById, balanceFilter]);
  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const position = selected ? visibleRows.findIndex((row) => row.id === selected.id) : -1;
  const selectedBalance = selected ? balanceById.get(selected.id) : undefined;

  useEffect(() => {
    if ((!selectedId || !visibleRows.some((row) => row.id === selectedId)) && visibleRows[0]) setSelectedId(visibleRows[0].id);
  }, [visibleRows, selectedId]);
  useEffect(() => {
    if (selected && !editing && !creating) setForm(initialForm(config, selected));
  }, [selected, editing, creating, config]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!editing && !creating) return;
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [editing, creating]);

  const audit = useQuery({
    queryKey: ['inventory-party-audit', kind, selectedId],
    queryFn: () => api.get<AuditRow[]>(`/${kind}/${selectedId}/audit`),
    enabled: Boolean(selectedId),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = payloadOf(config.fields, form);
      if (creating) return api.post<PartyRow>(`/${kind}`, payload);
      return api.patch<PartyRow>(`/${kind}/${selected!.id}`, { ...payload, version: selected!.version });
    },
    onSuccess: (row) => {
      toast.push(`${config.singular} berhasil disimpan.`, 'success');
      setEditing(false);
      setCreating(false);
      setSelectedId(row.id);
      void queryClient.invalidateQueries({ queryKey: ['inventory-party-master', kind] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-party-audit', kind, row.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan data.'), 'error'),
  });

  const toggleActive = useMutation({
    mutationFn: (row: PartyRow) => api.post(`/${kind}/${row.id}/${row.is_active ? 'deactivate' : 'activate'}`, row.is_active ? { reason: 'Dinonaktifkan dari master Sales/Inventory' } : undefined),
    onSuccess: () => {
      toast.push('Status berhasil diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['inventory-party-master', kind] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengubah status.'), 'error'),
  });

  const choose = (id: string) => {
    if ((editing || creating) && !window.confirm('Perubahan belum disimpan. Abaikan perubahan?')) return;
    setEditing(false);
    setCreating(false);
    setSelectedId(id);
  };
  const beginCreate = () => {
    if (editing && !window.confirm('Perubahan belum disimpan. Abaikan perubahan?')) return;
    setSelectedId(null);
    setCreating(true);
    setEditing(true);
    setForm(initialForm(config));
  };
  const cancel = () => {
    setEditing(false);
    setCreating(false);
    setForm(initialForm(config, selected ?? undefined));
  };
  const code = form.code?.trim() ?? '';
  const valid = Boolean(code && form.name?.trim() && code.length <= config.codeMax && !save.isPending);
  const exportRows = rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.is_active ? 'Aktif' : 'Nonaktif',
    balance: Number(balanceById.get(row.id)?.balance ?? 0),
    updated: formatDateTime(row.updated_at),
  }));
  const exportColumns: ExportColumn<(typeof exportRows)[number]>[] = [
    { key: 'code', label: 'Kode' }, { key: 'name', label: 'Nama' }, { key: 'status', label: 'Status' },
    { key: 'balance', label: config.balanceLabel }, { key: 'updated', label: 'Diperbarui' },
  ];

  const move = (next: number) => {
    const row = visibleRows[Math.max(0, Math.min(visibleRows.length - 1, next))];
    if (row) choose(row.id);
  };

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[{ label: 'Dashboard', href: '/app' }, { label: 'Sales & Inventory' }, { label: config.title }]}
        actions={<button type="button" className="btn-primary" onClick={beginCreate}><Plus className="h-4 w-4" />Tambah</button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Jumlah data</p>
          <p className="mt-1 text-2xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">Aktif</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{rows.filter((row) => row.is_active).length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase text-slate-500">{config.balanceLabel}</p>
          <p className="mt-1 text-2xl font-bold">{rupiah([...balanceById.values()].reduce((total, row) => total + Number(row.balance), 0))}</p>
        </div>
      </div>

      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(560px,1.4fr)]">
        <section className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" aria-label={`Daftar ${config.singular}`}>
          <div className="border-b border-slate-200 p-3 dark:border-slate-700">
            <label className="relative block">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="field-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Cari kode, nama, wilayah ${config.singular}`} />
            </label>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Filter saldo">
              {([['ALL', 'Semua'], ['OPEN', 'Ada saldo'], ['SETTLED', 'Lunas']] as const).map(([value, label]) => <button key={value} type="button" className={balanceFilter === value ? 'btn-primary' : 'btn-outline'} onClick={() => setBalanceFilter(value)}>{label}</button>)}
            </div>
          </div>
          <div className="max-h-[560px] overflow-auto">
            {list.isLoading ? <p className="p-5 text-sm text-slate-500">Memuat data...</p> : null}
            {visibleRows.map((row) => {
              const metric = balanceById.get(row.id);
              return <button key={row.id} type="button" onClick={() => choose(row.id)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition dark:border-slate-800 ${row.id === selectedId ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{row.name}</p><p className="mt-0.5 text-xs text-slate-500">{row.code} · {String(row.region_name ?? row.territory ?? 'Wilayah belum diisi')}</p></div>
                  <StatusBadge status={row.is_active ? 'ACTIVE' : 'INACTIVE'} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{metric?.document_count ?? 0} dokumen</span><span className="font-semibold text-slate-700 dark:text-slate-200">{rupiah(metric?.balance)}</span></div>
              </button>;
            })}
            {!list.isLoading && visibleRows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">Data tidak ditemukan untuk filter ini.</p> : null}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-700">
            <button className="btn-outline" type="button" onClick={() => downloadPdf(`master-${kind}`, config.title, exportColumns, exportRows)}><FileDown className="h-4 w-4" />PDF</button>
            <button className="btn-outline" type="button" onClick={() => downloadExcel(`master-${kind}`, exportColumns, exportRows)}><FileSpreadsheet className="h-4 w-4" />Excel</button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label={`Detail ${config.singular}`}>
          {!selected && !creating ? <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">Pilih data di sebelah kiri atau tekan Tambah.</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-700">
              <div><p className="text-xs font-semibold uppercase text-emerald-700">{creating ? 'Data baru' : `Detail ${config.singular}`}</p><h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{creating ? `Tambah ${config.singular}` : selected?.name}</h2></div>
              <div className="flex gap-1">
                <button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Data pertama" disabled={editing || position <= 0} onClick={() => move(0)}><ChevronFirst className="h-4 w-4" /></button>
                <button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Data sebelumnya" disabled={editing || position <= 0} onClick={() => move(position - 1)}><ChevronLeft className="h-4 w-4" /></button>
                <button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Data berikutnya" disabled={editing || position < 0 || position >= visibleRows.length - 1} onClick={() => move(position + 1)}><ChevronRight className="h-4 w-4" /></button>
                <button type="button" className="rounded p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" title="Data terakhir" disabled={editing || position < 0 || position >= visibleRows.length - 1} onClick={() => move(visibleRows.length - 1)}><ChevronLast className="h-4 w-4" /></button>
              </div>
            </div>

            {!creating && selected ? <div className="my-4 grid gap-3 sm:grid-cols-3"><div className="rounded bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">{config.balanceLabel}</p><p className="mt-1 font-bold">{rupiah(selectedBalance?.balance)}</p></div><div className="rounded bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">Dokumen</p><p className="mt-1 font-bold">{selectedBalance?.document_count ?? 0}</p></div><div className="rounded bg-slate-50 p-3 dark:bg-slate-800"><p className="text-xs text-slate-500">{kind === 'salespeople' ? 'Pelanggan' : 'Pembaruan terakhir'}</p><p className="mt-1 font-bold">{kind === 'salespeople' ? selectedBalance?.customer_count ?? 0 : formatDateTime(selected.updated_at)}</p></div></div> : null}

            <div className="grid gap-x-4 gap-y-3 md:grid-cols-2">
              {config.fields.map((field) => {
                const hidden = field.sensitive && !showBank && !editing;
                const common = { id: `${kind}-${field.key}`, className: 'field-input', disabled: !editing, value: hidden ? '••••••••' : form[field.key] ?? '', onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [field.key]: event.target.value }) };
                return <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}><label className="field-label" htmlFor={common.id}>{field.label}{field.required ? ' *' : ''}</label>{field.type === 'textarea' ? <textarea {...common} rows={2} /> : <input {...common} type={field.type ?? 'text'} min={field.min} max={field.max} maxLength={field.key === 'code' ? config.codeMax : undefined} />}{field.key === 'code' && code.length > config.codeMax ? <p className="mt-1 text-xs text-rose-600">Maksimum {config.codeMax} karakter sesuai kode legacy.</p> : null}</div>;
              })}
            </div>

            {config.fields.some((field) => field.sensitive) ? <button type="button" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-700" onClick={() => setShowBank(!showBank)}>{showBank ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{showBank ? 'Sembunyikan data bank' : 'Tampilkan data bank'}</button> : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div className="flex gap-2">{selected && !creating ? <button type="button" className="btn-outline" disabled={toggleActive.isPending || editing} title={editing ? 'Simpan atau batalkan perubahan terlebih dahulu' : undefined} onClick={() => toggleActive.mutate(selected)}><Power className="h-4 w-4" />{selected.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button> : null}</div>
              <div className="flex gap-2">{editing ? <><button type="button" className="btn-outline" onClick={cancel}><X className="h-4 w-4" />Batal</button><button type="button" className="btn-primary" disabled={!valid} title={!valid ? 'Kode dan nama wajib valid sebelum disimpan' : undefined} onClick={() => save.mutate()}><Save className="h-4 w-4" />Simpan</button></> : <button type="button" className="btn-primary" onClick={() => setEditing(true)}>Ubah data</button>}</div>
            </div>

            {!creating && selected ? <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700"><div className="flex items-center gap-2"><History className="h-4 w-4 text-emerald-700" /><h3 className="font-semibold">Riwayat audit</h3></div>{audit.isError ? <p className="mt-3 text-sm text-slate-500">Riwayat audit tidak dapat dibuka dengan hak akses saat ini.</p> : <div className="mt-3 max-h-44 space-y-2 overflow-auto">{(audit.data ?? []).map((item) => <div key={item.id} className="rounded bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"><div className="flex justify-between gap-3"><span className="font-medium">{item.action_code ?? item.operation}</span><span className="text-xs text-slate-500">{formatDateTime(item.statement_timestamp)}</span></div><p className="mt-1 text-xs text-slate-500">{item.actor_username ?? 'Sistem'}{item.changed_columns?.length ? ` · ${item.changed_columns.join(', ')}` : ''}</p></div>)}{!audit.isLoading && !audit.data?.length ? <p className="text-sm text-slate-500">Belum ada perubahan tercatat.</p> : null}</div>}</div> : null}
          </>}
        </section>
      </div>
    </>
  );
}
