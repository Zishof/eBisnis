import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Link as LinkIcon, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
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

interface KajianRow extends Record<string, unknown> {
  id: string;
  judul: string;
  pemateri: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  lokasi: string | null;
  ringkasan: string | null;
  materi_url: string | null;
  rekaman_url: string | null;
  gambar_url: string | null;
  status: string;
  sort_order: number;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

const PAGE_SIZE = 25;
const JENIS_SETORAN = ['SETORAN_BARU', 'MURAJAAH', 'TASMI'];
const PREDIKAT_SETORAN = ['LANCAR', 'CUKUP', 'MENGULANG'];
const STATUS_KAJIAN = ['DRAFT', 'TERBIT', 'ARSIP'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenDakwahPage({ initialTab = 'halaqah' }: { initialTab?: 'kitab' | 'halaqah' | 'tahfiz' | 'kajian' }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <>
      <PageHeader
        title="Dakwah, Diniyah, dan Tahfiz"
        description="Kelola kitab, halaqah, kajian publik, materi dakwah, dan setoran hafalan santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Dakwah' }]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tab === 'kitab' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('kitab')}>Kitab</button>
        <button type="button" className={tab === 'halaqah' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('halaqah')}>Halaqah</button>
        <button type="button" className={tab === 'kajian' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('kajian')}>Kajian</button>
        <button type="button" className={tab === 'tahfiz' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('tahfiz')}>Tahfiz</button>
      </div>
      {tab === 'kitab' && <TabKitab />}
      {tab === 'halaqah' && <TabHalaqah />}
      {tab === 'kajian' && <TabKajian />}
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

function TabKajian() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({
    judul: '',
    pemateri: '',
    tanggalMulai: `${today()}T19:30`,
    tanggalSelesai: '',
    lokasi: '',
    ringkasan: '',
    materiUrl: '',
    rekamanUrl: '',
    gambarUrl: '',
    status: 'DRAFT',
    sortOrder: '0',
  });

  const kajian = useQuery({
    queryKey: ['pesantren-kajian', status],
    queryFn: () => api.get<KajianRow[]>(`/pesantren/kajian${status ? `?status=${status}` : ''}`),
  });

  const payload = (statusOverride?: string) => ({
    judul: form.judul,
    pemateri: form.pemateri.trim() || undefined,
    tanggalMulai: form.tanggalMulai,
    tanggalSelesai: form.tanggalSelesai || undefined,
    lokasi: form.lokasi.trim() || undefined,
    ringkasan: form.ringkasan.trim() || undefined,
    materiUrl: form.materiUrl.trim() || undefined,
    rekamanUrl: form.rekamanUrl.trim() || undefined,
    gambarUrl: form.gambarUrl.trim() || undefined,
    status: statusOverride ?? form.status,
    sortOrder: Number(form.sortOrder || 0),
  });

  const simpan = useMutation({
    mutationFn: () => api.post<KajianRow>('/pesantren/kajian', payload()),
    onSuccess: () => {
      toast.push('Kajian dakwah berhasil disimpan.', 'success');
      setForm({
        judul: '',
        pemateri: '',
        tanggalMulai: `${today()}T19:30`,
        tanggalSelesai: '',
        lokasi: '',
        ringkasan: '',
        materiUrl: '',
        rekamanUrl: '',
        gambarUrl: '',
        status: 'DRAFT',
        sortOrder: '0',
      });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kajian'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan kajian.'), 'error'),
  });

  const ubahStatus = useMutation({
    mutationFn: ({ item, next }: { item: KajianRow; next: string }) =>
      api.patch<KajianRow>(`/pesantren/kajian/${item.id}`, {
        judul: item.judul,
        pemateri: item.pemateri,
        tanggalMulai: item.tanggal_mulai,
        tanggalSelesai: item.tanggal_selesai,
        lokasi: item.lokasi,
        ringkasan: item.ringkasan,
        materiUrl: item.materi_url,
        rekamanUrl: item.rekaman_url,
        gambarUrl: item.gambar_url,
        sortOrder: item.sort_order,
        status: next,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kajian'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengubah status kajian.'), 'error'),
  });

  const hapus = useMutation({
    mutationFn: (id: string) => api.delete(`/pesantren/kajian/${id}`),
    onSuccess: () => {
      toast.push('Kajian dakwah dihapus.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kajian'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menghapus kajian.'), 'error'),
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,420px)_1fr]">
      <div className="card p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Jadwal dan Arsip Kajian</h2>
            <p className="text-xs text-slate-500">Materi yang berstatus TERBIT muncul di situs pondok.</p>
          </div>
        </div>
        <div className="space-y-3">
          <Input label="Judul kajian *" value={form.judul} onChange={(value) => setForm({ ...form, judul: value })} />
          <Input label="Pemateri" value={form.pemateri} onChange={(value) => setForm({ ...form, pemateri: value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Mulai" type="datetime-local" value={form.tanggalMulai} onChange={(value) => setForm({ ...form, tanggalMulai: value })} />
            <Input label="Selesai" type="datetime-local" value={form.tanggalSelesai} onChange={(value) => setForm({ ...form, tanggalSelesai: value })} />
          </div>
          <Input label="Lokasi" value={form.lokasi} onChange={(value) => setForm({ ...form, lokasi: value })} />
          <div>
            <label className="field-label">Ringkasan</label>
            <textarea className="field-input min-h-24" value={form.ringkasan} onChange={(event) => setForm({ ...form, ringkasan: event.target.value })} />
          </div>
          <Input label="URL materi" value={form.materiUrl} onChange={(value) => setForm({ ...form, materiUrl: value })} />
          <Input label="URL rekaman audio/video" value={form.rekamanUrl} onChange={(value) => setForm({ ...form, rekamanUrl: value })} />
          <Input label="URL gambar publikasi" value={form.gambarUrl} onChange={(value) => setForm({ ...form, gambarUrl: value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Status" value={form.status} options={STATUS_KAJIAN} onChange={(value) => setForm({ ...form, status: value })} />
            <Input label="Urutan" type="number" value={form.sortOrder} onChange={(value) => setForm({ ...form, sortOrder: value })} />
          </div>
          <button type="button" className="btn-primary w-full justify-center" disabled={!form.judul.trim() || !form.tanggalMulai || simpan.isPending} onClick={() => simpan.mutate()}>
            <Plus className="h-4 w-4" aria-hidden />
            Simpan kajian
          </button>
        </div>
      </div>

      <div>
        <div className="card mb-4 p-4">
          <div className="max-w-xs">
            <Select label="Filter status" value={status} options={['', ...STATUS_KAJIAN]} onChange={setStatus} />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {kajian.isLoading && <div className="card p-5 text-sm text-slate-500">Memuat kajian...</div>}
          {kajian.isSuccess && (kajian.data ?? []).length === 0 && (
            <div className="card p-5 text-sm text-slate-500">Belum ada jadwal kajian atau arsip dakwah.</div>
          )}
          {(kajian.data ?? []).map((item) => (
            <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
              {item.gambar_url && <img src={item.gambar_url} alt="" className="h-36 w-full object-cover" />}
              <div className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <StatusBadge status={item.status} />
                    <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{item.judul}</h3>
                  </div>
                  <p className="text-xs text-slate-500">{formatDate(item.tanggal_mulai)}</p>
                </div>
                <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
                  {item.pemateri && <p>Pemateri: {item.pemateri}</p>}
                  {item.lokasi && <p>Lokasi: {item.lokasi}</p>}
                  {item.ringkasan && <p className="line-clamp-3">{item.ringkasan}</p>}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.materi_url && <a className="btn-outline px-3 py-2 text-xs" href={item.materi_url} target="_blank" rel="noreferrer"><LinkIcon className="h-4 w-4" aria-hidden /> Materi</a>}
                  {item.rekaman_url && <a className="btn-outline px-3 py-2 text-xs" href={item.rekaman_url} target="_blank" rel="noreferrer"><LinkIcon className="h-4 w-4" aria-hidden /> Rekaman</a>}
                  <button
                    type="button"
                    className="btn-outline px-3 py-2 text-xs"
                    disabled={ubahStatus.isPending}
                    onClick={() => ubahStatus.mutate({ item, next: item.status === 'TERBIT' ? 'DRAFT' : 'TERBIT' })}
                  >
                    <Send className="h-4 w-4" aria-hidden />
                    {item.status === 'TERBIT' ? 'Draft' : 'Terbitkan'}
                  </button>
                  <button type="button" className="btn-outline px-3 py-2 text-xs text-red-700" disabled={hapus.isPending} onClick={() => hapus.mutate(item.id)}>
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Hapus
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
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
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </div>
  );
}
