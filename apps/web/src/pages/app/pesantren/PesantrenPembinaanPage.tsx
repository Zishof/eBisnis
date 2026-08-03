import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

interface PelanggaranRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  jenis: string;
  tanggal: string;
  kategori: string;
  poin: number;
  status: string;
}

interface JenisPelanggaranRow {
  id: string;
  code: string;
  nama: string;
  kategori: string;
  poin: number;
}

interface PrestasiRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  cabang: string;
  nama_kompetisi: string;
  tingkat: string;
  peringkat: string;
  tanggal: string;
}

interface EkskulRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  jenis: string;
  status: string;
}

const PAGE_SIZE = 25;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenPembinaanPage({ initialTab = 'pelanggaran' }: { initialTab?: 'pelanggaran' | 'prestasi' | 'ekskul' }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <>
      <PageHeader
        title="Pembinaan dan Kesiswaan"
        description="Catat pelanggaran, prestasi, penghargaan, ekstrakurikuler, dan organisasi santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Pembinaan' }]}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tab === 'pelanggaran' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('pelanggaran')}>Pelanggaran</button>
        <button type="button" className={tab === 'prestasi' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('prestasi')}>Prestasi</button>
        <button type="button" className={tab === 'ekskul' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('ekskul')}>Ekstrakurikuler</button>
      </div>
      {tab === 'pelanggaran' && <TabPelanggaran />}
      {tab === 'prestasi' && <TabPrestasi />}
      {tab === 'ekskul' && <TabEkskul />}
    </>
  );
}

function useSantriAktif() {
  return useQuery({
    queryKey: ['pesantren-pembinaan-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
}

function TabPelanggaran() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const santri = useSantriAktif();
  const [page, setPage] = useState(1);
  const [formJenis, setFormJenis] = useState({ code: '', nama: '', kategori: 'RINGAN', poin: '5' });
  const [form, setForm] = useState({ santriId: '', jenisPelanggaranId: '', tanggal: today(), keterangan: '' });

  const jenis = useQuery({
    queryKey: ['pesantren-pelanggaran-jenis'],
    queryFn: () => api.get<JenisPelanggaranRow[]>('/pesantren/pelanggaran/jenis'),
  });
  const list = useQuery({
    queryKey: ['pesantren-pelanggaran-list', page],
    queryFn: () => api.get<{ items: PelanggaranRow[]; total: number }>(`/pesantren/pelanggaran?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`),
  });

  const simpanJenis = useMutation({
    mutationFn: () => api.post('/pesantren/pelanggaran/jenis', { code: formJenis.code, nama: formJenis.nama, kategori: formJenis.kategori, poin: Number(formJenis.poin) }),
    onSuccess: () => {
      toast.push('Jenis pelanggaran tersimpan.', 'success');
      setFormJenis({ code: '', nama: '', kategori: 'RINGAN', poin: '5' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-jenis'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan jenis pelanggaran.'), 'error'),
  });

  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/pelanggaran', { ...form, keterangan: form.keterangan.trim() || undefined }),
    onSuccess: () => {
      toast.push('Pelanggaran santri tercatat.', 'success');
      setForm({ santriId: '', jenisPelanggaranId: '', tanggal: form.tanggal, keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat pelanggaran.'), 'error'),
  });

  const batalkan = useMutation({
    mutationFn: (id: string) => api.post(`/pesantren/pelanggaran/${id}/batalkan`, { alasan: 'Dibatalkan dari UI pembinaan.' }),
    onSuccess: () => {
      toast.push('Pelanggaran dibatalkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membatalkan pelanggaran.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<PelanggaranRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'jenis', header: 'Jenis' },
    { key: 'kategori', header: 'Kategori', render: (row) => <StatusBadge status={row.kategori} /> },
    { key: 'poin', header: 'Poin' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'aksi', header: 'Aksi', render: (row) => row.status === 'TERCATAT' ? <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => batalkan.mutate(row.id)}>Batal</button> : null },
  ];
  const total = list.data?.total ?? 0;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Jenis Pelanggaran</h2>
          <div className="grid gap-3 md:grid-cols-[120px_minmax(180px,1fr)_150px_100px_auto]">
            <Input label="Kode" value={formJenis.code} onChange={(value) => setFormJenis({ ...formJenis, code: value.toUpperCase() })} />
            <Input label="Nama" value={formJenis.nama} onChange={(value) => setFormJenis({ ...formJenis, nama: value })} />
            <Select label="Kategori" value={formJenis.kategori} options={['RINGAN', 'SEDANG', 'BERAT']} onChange={(value) => setFormJenis({ ...formJenis, kategori: value })} />
            <Input label="Poin" type="number" value={formJenis.poin} onChange={(value) => setFormJenis({ ...formJenis, poin: value })} />
            <div className="flex items-end"><button type="button" className="btn-primary" disabled={!formJenis.code || !formJenis.nama || simpanJenis.isPending} onClick={() => simpanJenis.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Catat Pelanggaran</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <SantriSelect value={form.santriId} santri={santri.data?.items ?? []} onChange={(value) => setForm({ ...form, santriId: value })} />
            <div>
              <label className="field-label">Jenis</label>
              <select className="field-input" value={form.jenisPelanggaranId} onChange={(e) => setForm({ ...form, jenisPelanggaranId: e.target.value })}>
                <option value="">Pilih jenis</option>
                {(jenis.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
              </select>
            </div>
            <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
            <Input label="Keterangan" value={form.keterangan} onChange={(value) => setForm({ ...form, keterangan: value })} />
          </div>
          <div className="mt-3 flex justify-end"><button type="button" className="btn-primary" disabled={!form.santriId || !form.jenisPelanggaranId || simpan.isPending} onClick={() => simpan.mutate()}>Simpan</button></div>
        </div>
      </div>
      <div className="mt-4">
        <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat pelanggaran.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada pelanggaran." />
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
      </div>
    </>
  );
}

function TabPrestasi() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const santri = useSantriAktif();
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ santriId: '', cabang: '', namaKompetisi: '', tingkat: 'KABUPATEN', peringkat: 'JUARA_1', tanggal: today(), penyelenggara: '', keterangan: '' });
  const list = useQuery({
    queryKey: ['pesantren-prestasi-list', page],
    queryFn: () => api.get<{ items: PrestasiRow[]; total: number }>(`/pesantren/prestasi?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`),
  });
  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/prestasi', { ...form, penyelenggara: form.penyelenggara.trim() || undefined, keterangan: form.keterangan.trim() || undefined }),
    onSuccess: () => {
      toast.push('Prestasi santri tercatat.', 'success');
      setForm({ santriId: '', cabang: '', namaKompetisi: '', tingkat: 'KABUPATEN', peringkat: 'JUARA_1', tanggal: form.tanggal, penyelenggara: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-prestasi-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat prestasi.'), 'error'),
  });
  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<PrestasiRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'cabang', header: 'Cabang' },
    { key: 'nama_kompetisi', header: 'Kompetisi' },
    { key: 'tingkat', header: 'Tingkat', render: (row) => <StatusBadge status={row.tingkat} /> },
    { key: 'peringkat', header: 'Peringkat', render: (row) => <StatusBadge status={row.peringkat} /> },
  ];
  const total = list.data?.total ?? 0;

  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SantriSelect value={form.santriId} santri={santri.data?.items ?? []} onChange={(value) => setForm({ ...form, santriId: value })} />
          <Input label="Cabang" value={form.cabang} onChange={(value) => setForm({ ...form, cabang: value })} />
          <Input label="Kompetisi" value={form.namaKompetisi} onChange={(value) => setForm({ ...form, namaKompetisi: value })} />
          <Select label="Tingkat" value={form.tingkat} options={['INTERNAL', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL']} onChange={(value) => setForm({ ...form, tingkat: value })} />
          <Select label="Peringkat" value={form.peringkat} options={['JUARA_1', 'JUARA_2', 'JUARA_3', 'HARAPAN', 'FINALIS', 'PESERTA']} onChange={(value) => setForm({ ...form, peringkat: value })} />
          <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
        </div>
        <div className="mt-3 flex justify-end"><button type="button" className="btn-primary" disabled={!form.santriId || !form.cabang || !form.namaKompetisi || simpan.isPending} onClick={() => simpan.mutate()}>Simpan Prestasi</button></div>
      </div>
      <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat prestasi.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada prestasi." />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}

function TabEkskul() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [jenis, setJenis] = useState('');
  const [form, setForm] = useState({ code: '', nama: '', jenis: 'EKSTRAKURIKULER', deskripsi: '' });
  const list = useQuery({
    queryKey: ['pesantren-ekskul-list', jenis],
    queryFn: () => api.get<EkskulRow[]>(`/pesantren/ekstrakurikuler${jenis ? `?jenis=${jenis}` : ''}`),
  });
  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/ekstrakurikuler', { ...form, deskripsi: form.deskripsi.trim() || undefined }),
    onSuccess: () => {
      toast.push('Ekstrakurikuler/organisasi tersimpan.', 'success');
      setForm({ code: '', nama: '', jenis: 'EKSTRAKURIKULER', deskripsi: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-ekskul-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan ekstrakurikuler.'), 'error'),
  });
  const columns: Array<GridColumn<EkskulRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];
  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_190px_minmax(180px,1fr)_auto]">
          <Input label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
          <Input label="Nama" value={form.nama} onChange={(value) => setForm({ ...form, nama: value })} />
          <Select label="Jenis" value={form.jenis} options={['EKSTRAKURIKULER', 'ORGANISASI', 'KEPANITIAAN']} onChange={(value) => setForm({ ...form, jenis: value })} />
          <Input label="Deskripsi" value={form.deskripsi} onChange={(value) => setForm({ ...form, deskripsi: value })} />
          <div className="flex items-end"><button type="button" className="btn-primary" disabled={!form.code || !form.nama || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
        </div>
      </div>
      <div className="card mb-4 max-w-xs p-4">
        <Select label="Filter jenis" value={jenis} options={['', 'EKSTRAKURIKULER', 'ORGANISASI', 'KEPANITIAAN']} onChange={setJenis} />
      </div>
      <DataGrid columns={columns} rows={list.data ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat ekstrakurikuler.') : undefined} rowKey={(row) => row.id} onRetry={() => void list.refetch()} emptyTitle="Belum ada ekstrakurikuler." />
    </>
  );
}

function SantriSelect({ value, santri, onChange }: { value: string; santri: SantriRow[]; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="field-label">Santri</label>
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Pilih santri</option>
        {santri.map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
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
