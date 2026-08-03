import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface KitabRow extends Record<string, unknown> {
  id: string;
  code: string;
  judul: string;
  pengarang: string | null;
  status: string;
}

interface HalaqahRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  kitab_judul: string | null;
  jumlah_anggota: number;
  status: string;
}

interface TahfizRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: string;
  juz: number;
  predikat: string;
  catatan: string | null;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

const PAGE_SIZE = 25;
const JENIS_SETORAN = ['SETORAN_BARU', 'MURAJAAH', 'TASMI'];
const PREDIKAT_SETORAN = ['LANCAR', 'CUKUP', 'MENGULANG'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenDakwahPage({ initialTab = 'halaqah' }: { initialTab?: 'kitab' | 'halaqah' | 'tahfiz' }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <>
      <PageHeader
        title="Dakwah, Diniyah, dan Tahfiz"
        description="Kelola kitab, halaqah, anggota diniyah, dan setoran hafalan santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Dakwah' }]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tab === 'kitab' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('kitab')}>Kitab</button>
        <button type="button" className={tab === 'halaqah' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('halaqah')}>Halaqah</button>
        <button type="button" className={tab === 'tahfiz' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('tahfiz')}>Tahfiz</button>
      </div>
      {tab === 'kitab' && <TabKitab />}
      {tab === 'halaqah' && <TabHalaqah />}
      {tab === 'tahfiz' && <TabTahfiz />}
    </>
  );
}

function TabKitab() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: '', judul: '', pengarang: '', keterangan: '' });

  const kitab = useQuery({
    queryKey: ['pesantren-dakwah-kitab'],
    queryFn: () => api.get<KitabRow[]>('/pesantren/kitab'),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<KitabRow>('/pesantren/kitab', {
        code: form.code,
        judul: form.judul,
        pengarang: form.pengarang.trim() || undefined,
        keterangan: form.keterangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Kitab berhasil ditambahkan.', 'success');
      setForm({ code: '', judul: '', pengarang: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dakwah-kitab'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan kitab.'), 'error'),
  });

  const columns: Array<GridColumn<KitabRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'judul', header: 'Judul' },
    { key: 'pengarang', header: 'Pengarang', render: (row) => row.pengarang ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_220px_auto]">
          <Input label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
          <Input label="Judul" value={form.judul} onChange={(value) => setForm({ ...form, judul: value })} />
          <Input label="Pengarang" value={form.pengarang} onChange={(value) => setForm({ ...form, pengarang: value })} />
          <div className="flex items-end">
            <button type="button" className="btn-primary" disabled={!form.code || !form.judul || simpan.isPending} onClick={() => simpan.mutate()}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah
            </button>
          </div>
        </div>
      </div>
      <DataGrid
        columns={columns}
        rows={kitab.data ?? []}
        loading={kitab.isLoading}
        error={kitab.isError ? toMessage(kitab.error, (_key, fallback) => fallback ?? 'Gagal memuat kitab.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void kitab.refetch()}
        emptyTitle="Belum ada kitab."
      />
    </>
  );
}

function TabHalaqah() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dipilih, setDipilih] = useState<HalaqahRow | null>(null);
  const [santriId, setSantriId] = useState('');
  const [form, setForm] = useState({ code: '', nama: '', kitabId: '' });

  const halaqah = useQuery({
    queryKey: ['pesantren-dakwah-halaqah'],
    queryFn: () => api.get<HalaqahRow[]>('/pesantren/halaqah'),
  });
  const kitab = useQuery({
    queryKey: ['pesantren-dakwah-kitab'],
    queryFn: () => api.get<KitabRow[]>('/pesantren/kitab'),
  });
  const santri = useQuery({
    queryKey: ['pesantren-dakwah-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const anggota = useQuery({
    queryKey: ['pesantren-dakwah-anggota', dipilih?.id],
    enabled: Boolean(dipilih),
    queryFn: () => api.get<Array<Record<string, unknown>>>(`/pesantren/halaqah/${dipilih!.id}/anggota`),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<HalaqahRow>('/pesantren/halaqah', {
        code: form.code,
        nama: form.nama,
        kitabId: form.kitabId || undefined,
      }),
    onSuccess: () => {
      toast.push('Halaqah berhasil dibuat.', 'success');
      setForm({ code: '', nama: '', kitabId: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dakwah-halaqah'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan halaqah.'), 'error'),
  });

  const gabungkan = useMutation({
    mutationFn: () => api.post(`/pesantren/halaqah/${dipilih!.id}/anggota`, { santriId }),
    onSuccess: () => {
      toast.push('Santri ditambahkan ke halaqah.', 'success');
      setSantriId('');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dakwah-anggota', dipilih?.id] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dakwah-halaqah'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menambahkan anggota.'), 'error'),
  });

  const columns: Array<GridColumn<HalaqahRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Halaqah' },
    { key: 'kitab_judul', header: 'Kitab', render: (row) => row.kitab_judul ?? '-' },
    { key: 'jumlah_anggota', header: 'Anggota' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'aksi', header: 'Aksi', render: (row) => <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => setDipilih(row)}>Anggota</button> },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="card mb-4 p-4">
          <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_220px_auto]">
            <Input label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
            <Input label="Nama halaqah" value={form.nama} onChange={(value) => setForm({ ...form, nama: value })} />
            <div>
              <label className="field-label">Kitab</label>
              <select className="field-input" value={form.kitabId} onChange={(e) => setForm({ ...form, kitabId: e.target.value })}>
                <option value="">Tanpa kitab</option>
                {(kitab.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.judul}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button type="button" className="btn-primary" disabled={!form.code || !form.nama || simpan.isPending} onClick={() => simpan.mutate()}>
                <Plus className="h-4 w-4" aria-hidden />
                Tambah
              </button>
            </div>
          </div>
        </div>
        <DataGrid
          columns={columns}
          rows={halaqah.data ?? []}
          loading={halaqah.isLoading}
          error={halaqah.isError ? toMessage(halaqah.error, (_key, fallback) => fallback ?? 'Gagal memuat halaqah.') : undefined}
          rowKey={(row) => row.id}
          onRetry={() => void halaqah.refetch()}
          emptyTitle="Belum ada halaqah."
        />
      </div>
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Anggota</h2>
          <button type="button" className="btn-outline px-2 py-1.5" onClick={() => dipilih && void anggota.refetch()} disabled={!dipilih}>
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {dipilih ? (
          <>
            <p className="mb-3 text-sm text-slate-500">{dipilih.nama}</p>
            <div className="mb-4 flex gap-2">
              <select className="field-input" value={santriId} onChange={(e) => setSantriId(e.target.value)}>
                <option value="">Pilih santri</option>
                {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
              </select>
              <button type="button" className="btn-primary" disabled={!santriId || gabungkan.isPending} onClick={() => gabungkan.mutate()}>Tambah</button>
            </div>
            <div className="space-y-2">
              {(anggota.data ?? []).map((item) => (
                <div key={String(item.id)} className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                  {String(item.nama_lengkap ?? item.santri_id ?? '-')}
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">Pilih halaqah untuk mengelola anggota.</p>
        )}
      </div>
    </div>
  );
}

function TabTahfiz() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tanggal, setTanggal] = useState('');
  const [form, setForm] = useState({ santriId: '', tanggal: today(), jenis: 'SETORAN_BARU', juz: '1', predikat: 'LANCAR', catatan: '' });

  const santri = useQuery({
    queryKey: ['pesantren-tahfiz-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const tahfiz = useQuery({
    queryKey: ['pesantren-tahfiz', page, tanggal],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (tanggal) params.set('tanggal', tanggal);
      return api.get<{ items: TahfizRow[]; total: number }>(`/pesantren/tahfiz?${params.toString()}`);
    },
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<TahfizRow>('/pesantren/tahfiz', {
        santriId: form.santriId,
        tanggal: form.tanggal,
        jenis: form.jenis,
        juz: Number(form.juz),
        predikat: form.predikat,
        catatan: form.catatan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Setoran tahfiz tercatat.', 'success');
      setForm({ santriId: '', tanggal: form.tanggal, jenis: form.jenis, juz: '1', predikat: 'LANCAR', catatan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tahfiz'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat setoran.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<TahfizRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'juz', header: 'Juz' },
    { key: 'predikat', header: 'Predikat', render: (row) => <StatusBadge status={row.predikat} /> },
    { key: 'catatan', header: 'Catatan', render: (row) => row.catatan ?? '-' },
  ];
  const total = tahfiz.data?.total ?? 0;

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[180px_minmax(220px,1fr)_170px_100px_150px_minmax(180px,1fr)_auto]">
          <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
          <div>
            <label className="field-label">Santri</label>
            <select className="field-input" value={form.santriId} onChange={(e) => setForm({ ...form, santriId: e.target.value })}>
              <option value="">Pilih santri</option>
              {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
            </select>
          </div>
          <Select label="Jenis" value={form.jenis} options={JENIS_SETORAN} onChange={(value) => setForm({ ...form, jenis: value })} />
          <Input label="Juz" type="number" value={form.juz} onChange={(value) => setForm({ ...form, juz: value })} />
          <Select label="Predikat" value={form.predikat} options={PREDIKAT_SETORAN} onChange={(value) => setForm({ ...form, predikat: value })} />
          <Input label="Catatan" value={form.catatan} onChange={(value) => setForm({ ...form, catatan: value })} />
          <div className="flex items-end">
            <button type="button" className="btn-primary" disabled={!form.santriId || simpan.isPending} onClick={() => simpan.mutate()}>Simpan</button>
          </div>
        </div>
      </div>
      <div className="card mb-4 max-w-xs p-4">
        <Input label="Filter tanggal" type="date" value={tanggal} onChange={(value) => { setTanggal(value); setPage(1); }} />
      </div>
      <DataGrid
        columns={columns}
        rows={tahfiz.data?.items ?? []}
        loading={tahfiz.isLoading}
        error={tahfiz.isError ? toMessage(tahfiz.error, (_key, fallback) => fallback ?? 'Gagal memuat setoran.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void tahfiz.refetch()}
        emptyTitle="Belum ada setoran tahfiz."
      />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
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
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
