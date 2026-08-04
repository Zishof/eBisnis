import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, CheckCircle2, ClipboardList, Plus, Users } from 'lucide-react';
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
  jenis_pelanggaran_id: string;
  jenis: string;
  tanggal: string;
  kategori: string;
  poin: number;
  status: string;
  keterangan?: string | null;
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
  penyelenggara?: string | null;
  keterangan?: string | null;
  dokumen_url?: string | null;
}

interface PenghargaanRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  judul: string;
  jenis: string;
  tanggal: string;
  diberikan_oleh?: string | null;
  keterangan?: string | null;
}

interface EkskulRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  jenis: string;
  is_active: boolean;
  deskripsi?: string | null;
}

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface AnggotaEkskulRow extends Record<string, unknown> {
  id: string;
  ekstrakurikuler_id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  jabatan: string;
  tanggal_bergabung: string;
  status: string;
  nilai_partisipasi: string | null;
  catatan: string | null;
  nama_lengkap?: string;
  nis?: string;
}

interface HukumanRow extends Record<string, unknown> {
  id: string;
  pelanggaran_id: string;
  jenis_hukuman: string;
  keterangan: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
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

function useTahunAjaran() {
  return useQuery({
    queryKey: ['pesantren-pembinaan-tahun-ajaran'],
    queryFn: () => api.get<TahunAjaranRow[]>('/pesantren/nilai/tahun-ajaran'),
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
  const [pelanggaranTerpilih, setPelanggaranTerpilih] = useState<PelanggaranRow | null>(null);
  const [formHukuman, setFormHukuman] = useState({
    jenisHukuman: 'TEGURAN_LISAN',
    tanggalMulai: today(),
    tanggalSelesai: '',
    keterangan: '',
  });

  const jenis = useQuery({
    queryKey: ['pesantren-pelanggaran-jenis'],
    queryFn: () => api.get<JenisPelanggaranRow[]>('/pesantren/pelanggaran/jenis'),
  });
  const list = useQuery({
    queryKey: ['pesantren-pelanggaran-list', page],
    queryFn: () => api.get<{ items: PelanggaranRow[]; total: number }>(`/pesantren/pelanggaran?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`),
  });
  const hukuman = useQuery({
    queryKey: ['pesantren-pelanggaran-hukuman', pelanggaranTerpilih?.id],
    enabled: Boolean(pelanggaranTerpilih?.id),
    queryFn: () => api.get<HukumanRow[]>(`/pesantren/pelanggaran/${pelanggaranTerpilih!.id}/hukuman`),
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

  const simpanHukuman = useMutation({
    mutationFn: () =>
      api.post(`/pesantren/pelanggaran/${pelanggaranTerpilih!.id}/hukuman`, {
        jenisHukuman: formHukuman.jenisHukuman,
        tanggalMulai: formHukuman.tanggalMulai || undefined,
        tanggalSelesai: formHukuman.tanggalSelesai || undefined,
        keterangan: formHukuman.keterangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Hukuman/pembinaan tersimpan.', 'success');
      setFormHukuman({ jenisHukuman: 'TEGURAN_LISAN', tanggalMulai: today(), tanggalSelesai: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-hukuman', pelanggaranTerpilih?.id] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan hukuman.'), 'error'),
  });

  const selesaikanHukuman = useMutation({
    mutationFn: (id: string) => api.post(`/pesantren/pelanggaran/hukuman/${id}/selesai`, {}),
    onSuccess: () => {
      toast.push('Hukuman ditandai selesai.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-pelanggaran-hukuman', pelanggaranTerpilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyelesaikan hukuman.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<PelanggaranRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'jenis', header: 'Jenis' },
    { key: 'kategori', header: 'Kategori', render: (row) => <StatusBadge status={row.kategori} /> },
    { key: 'poin', header: 'Poin' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => setPelanggaranTerpilih(row)}>
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            Hukuman
          </button>
          {row.status === 'DICATAT' ? (
            <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => batalkan.mutate(row.id)}>Batal</button>
          ) : null}
        </div>
      ),
    },
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
        <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat pelanggaran.') : undefined} rowKey={(row) => String(row.id)} onRetry={() => void list.refetch()} emptyTitle="Belum ada pelanggaran." />
        <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
      </div>
      {pelanggaranTerpilih && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Riwayat Hukuman dan Pembinaan</h2>
                <p className="text-sm text-slate-500">{namaSantri.get(pelanggaranTerpilih.santri_id) ?? pelanggaranTerpilih.santri_id} - {pelanggaranTerpilih.jenis}</p>
              </div>
              <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={() => setPelanggaranTerpilih(null)}>Tutup</button>
            </div>
            <DataGrid
              columns={[
                { key: 'jenis_hukuman', header: 'Jenis', render: (row: HukumanRow) => <StatusBadge status={row.jenis_hukuman} /> },
                { key: 'tanggal_mulai', header: 'Mulai', render: (row: HukumanRow) => formatDate(row.tanggal_mulai) },
                { key: 'tanggal_selesai', header: 'Selesai', render: (row: HukumanRow) => row.tanggal_selesai ? formatDate(row.tanggal_selesai) : '-' },
                { key: 'status', header: 'Status', render: (row: HukumanRow) => <StatusBadge status={row.status} /> },
                {
                  key: 'aksi',
                  header: 'Aksi',
                  render: (row: HukumanRow) => row.status === 'DIJATUHKAN' ? (
                    <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => selesaikanHukuman.mutate(row.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                      Selesai
                    </button>
                  ) : null,
                },
              ]}
              rows={hukuman.data ?? []}
              loading={hukuman.isLoading}
              error={hukuman.isError ? toMessage(hukuman.error, (_key, fallback) => fallback ?? 'Gagal memuat hukuman.') : undefined}
              rowKey={(row) => String(row.id)}
              onRetry={() => void hukuman.refetch()}
              emptyTitle="Belum ada hukuman."
            />
          </div>
          <div className="card p-4">
            <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Tambah Hukuman</h2>
            <div className="grid gap-3">
              <Select label="Jenis hukuman" value={formHukuman.jenisHukuman} options={['TEGURAN_LISAN', 'TEGURAN_TERTULIS', 'PEMANGGILAN_ORANG_TUA', 'SKORSING', 'PEMBINAAN_KHUSUS', 'LAINNYA']} onChange={(value) => setFormHukuman({ ...formHukuman, jenisHukuman: value })} />
              <Input label="Tanggal mulai" type="date" value={formHukuman.tanggalMulai} onChange={(value) => setFormHukuman({ ...formHukuman, tanggalMulai: value })} />
              <Input label="Tanggal selesai rencana" type="date" value={formHukuman.tanggalSelesai} onChange={(value) => setFormHukuman({ ...formHukuman, tanggalSelesai: value })} />
              <Input label="Keterangan" value={formHukuman.keterangan} onChange={(value) => setFormHukuman({ ...formHukuman, keterangan: value })} />
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" className="btn-primary" disabled={!formHukuman.jenisHukuman || simpanHukuman.isPending} onClick={() => simpanHukuman.mutate()}>Simpan Hukuman</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TabPrestasi() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const santri = useSantriAktif();
  const [page, setPage] = useState(1);
  const [pagePenghargaan, setPagePenghargaan] = useState(1);
  const [form, setForm] = useState({
    santriId: '',
    cabang: '',
    namaKompetisi: '',
    tingkat: 'KABUPATEN',
    peringkat: 'JUARA_1',
    tanggal: today(),
    penyelenggara: '',
    keterangan: '',
    dokumenUrl: '',
  });
  const [formPenghargaan, setFormPenghargaan] = useState({
    santriId: '',
    judul: '',
    jenis: 'APRESIASI',
    tanggal: today(),
    diberikanOleh: '',
    keterangan: '',
  });
  const list = useQuery({
    queryKey: ['pesantren-prestasi-list', page],
    queryFn: () => api.get<{ items: PrestasiRow[]; total: number }>(`/pesantren/prestasi?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`),
  });
  const penghargaan = useQuery({
    queryKey: ['pesantren-penghargaan-list', pagePenghargaan],
    queryFn: () => api.get<{ items: PenghargaanRow[]; total: number }>(`/pesantren/prestasi/penghargaan/daftar?halaman=${pagePenghargaan}&ukuranHalaman=${PAGE_SIZE}`),
  });
  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/prestasi', { ...form, penyelenggara: form.penyelenggara.trim() || undefined, keterangan: form.keterangan.trim() || undefined, dokumenUrl: form.dokumenUrl.trim() || undefined }),
    onSuccess: () => {
      toast.push('Prestasi santri tercatat.', 'success');
      setForm({ santriId: '', cabang: '', namaKompetisi: '', tingkat: 'KABUPATEN', peringkat: 'JUARA_1', tanggal: form.tanggal, penyelenggara: '', keterangan: '', dokumenUrl: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-prestasi-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat prestasi.'), 'error'),
  });
  const simpanPenghargaan = useMutation({
    mutationFn: () =>
      api.post('/pesantren/prestasi/penghargaan', {
        ...formPenghargaan,
        diberikanOleh: formPenghargaan.diberikanOleh.trim() || undefined,
        keterangan: formPenghargaan.keterangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Penghargaan santri tercatat.', 'success');
      setFormPenghargaan({ santriId: '', judul: '', jenis: 'APRESIASI', tanggal: formPenghargaan.tanggal, diberikanOleh: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-penghargaan-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat penghargaan.'), 'error'),
  });
  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columns: Array<GridColumn<PrestasiRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'cabang', header: 'Cabang' },
    { key: 'nama_kompetisi', header: 'Kompetisi' },
    { key: 'tingkat', header: 'Tingkat', render: (row) => <StatusBadge status={row.tingkat} /> },
    { key: 'peringkat', header: 'Peringkat', render: (row) => <StatusBadge status={row.peringkat} /> },
    { key: 'dokumen_url', header: 'Dokumen', render: (row) => row.dokumen_url ? <a className="text-emerald-700 hover:underline" href={row.dokumen_url} target="_blank" rel="noreferrer">Buka</a> : '-' },
  ];
  const penghargaanColumns: Array<GridColumn<PenghargaanRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'judul', header: 'Judul' },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'diberikan_oleh', header: 'Diberikan oleh', render: (row) => row.diberikan_oleh ?? '-' },
  ];
  const total = list.data?.total ?? 0;
  const totalPenghargaan = penghargaan.data?.total ?? 0;

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Award className="h-5 w-5 text-emerald-700" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Catat Prestasi Kompetisi</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SantriSelect value={form.santriId} santri={santri.data?.items ?? []} onChange={(value) => setForm({ ...form, santriId: value })} />
            <Input label="Cabang" value={form.cabang} onChange={(value) => setForm({ ...form, cabang: value })} />
            <Input label="Kompetisi" value={form.namaKompetisi} onChange={(value) => setForm({ ...form, namaKompetisi: value })} />
            <Select label="Tingkat" value={form.tingkat} options={['SEKOLAH', 'KECAMATAN', 'KABUPATEN', 'PROVINSI', 'NASIONAL', 'INTERNASIONAL']} onChange={(value) => setForm({ ...form, tingkat: value })} />
            <Select label="Peringkat" value={form.peringkat} options={['JUARA_1', 'JUARA_2', 'JUARA_3', 'HARAPAN_1', 'HARAPAN_2', 'HARAPAN_3', 'PARTISIPASI']} onChange={(value) => setForm({ ...form, peringkat: value })} />
            <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
            <Input label="Penyelenggara" value={form.penyelenggara} onChange={(value) => setForm({ ...form, penyelenggara: value })} />
            <Input label="URL dokumen" value={form.dokumenUrl} onChange={(value) => setForm({ ...form, dokumenUrl: value })} />
          </div>
          <Input label="Keterangan" value={form.keterangan} onChange={(value) => setForm({ ...form, keterangan: value })} />
          <div className="mt-3 flex justify-end"><button type="button" className="btn-primary" disabled={!form.santriId || !form.cabang || !form.namaKompetisi || simpan.isPending} onClick={() => simpan.mutate()}>Simpan Prestasi</button></div>
        </div>
        <div className="card mb-4 p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" aria-hidden />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Catat Penghargaan Internal</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SantriSelect value={formPenghargaan.santriId} santri={santri.data?.items ?? []} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, santriId: value })} />
            <Input label="Judul" value={formPenghargaan.judul} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, judul: value })} />
            <Select label="Jenis" value={formPenghargaan.jenis} options={['APRESIASI', 'PENGHARGAAN_BULANAN', 'PENGHARGAAN_TAHUNAN', 'SERTIFIKAT', 'LAINNYA']} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, jenis: value })} />
            <Input label="Tanggal" type="date" value={formPenghargaan.tanggal} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, tanggal: value })} />
            <Input label="Diberikan oleh" value={formPenghargaan.diberikanOleh} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, diberikanOleh: value })} />
          </div>
          <Input label="Keterangan" value={formPenghargaan.keterangan} onChange={(value) => setFormPenghargaan({ ...formPenghargaan, keterangan: value })} />
          <div className="mt-3 flex justify-end"><button type="button" className="btn-primary" disabled={!formPenghargaan.santriId || !formPenghargaan.judul || simpanPenghargaan.isPending} onClick={() => simpanPenghargaan.mutate()}>Simpan Penghargaan</button></div>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          <DataGrid columns={columns} rows={list.data?.items ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat prestasi.') : undefined} rowKey={(row) => String(row.id)} onRetry={() => void list.refetch()} emptyTitle="Belum ada prestasi." />
          <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
        </div>
        <div>
          <DataGrid columns={penghargaanColumns} rows={penghargaan.data?.items ?? []} loading={penghargaan.isLoading} error={penghargaan.isError ? toMessage(penghargaan.error, (_key, fallback) => fallback ?? 'Gagal memuat penghargaan.') : undefined} rowKey={(row) => String(row.id)} onRetry={() => void penghargaan.refetch()} emptyTitle="Belum ada penghargaan." />
          <Pagination page={pagePenghargaan} totalPages={Math.max(1, Math.ceil(totalPenghargaan / PAGE_SIZE))} total={totalPenghargaan} onChange={setPagePenghargaan} />
        </div>
      </div>
    </>
  );
}

function TabEkskul() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const santri = useSantriAktif();
  const tahunAjaran = useTahunAjaran();
  const [jenis, setJenis] = useState('');
  const [ekskulTerpilih, setEkskulTerpilih] = useState<EkskulRow | null>(null);
  const [anggotaNilaiId, setAnggotaNilaiId] = useState('');
  const [form, setForm] = useState({ code: '', nama: '', jenis: 'KLUB', deskripsi: '' });
  const [formAnggota, setFormAnggota] = useState({ santriId: '', tahunAjaranId: '', jabatan: 'ANGGOTA', tanggalBergabung: today() });
  const [formNilai, setFormNilai] = useState({ nilaiPartisipasi: '', catatan: '' });
  const list = useQuery({
    queryKey: ['pesantren-ekskul-list', jenis],
    queryFn: () => api.get<EkskulRow[]>(`/pesantren/ekstrakurikuler${jenis ? `?jenis=${jenis}` : ''}`),
  });
  const anggota = useQuery({
    queryKey: ['pesantren-ekskul-anggota', ekskulTerpilih?.id],
    enabled: Boolean(ekskulTerpilih?.id),
    queryFn: () => api.get<AnggotaEkskulRow[]>(`/pesantren/ekstrakurikuler/${ekskulTerpilih!.id}/anggota`),
  });
  const simpan = useMutation({
    mutationFn: () => api.post('/pesantren/ekstrakurikuler', { ...form, deskripsi: form.deskripsi.trim() || undefined }),
    onSuccess: () => {
      toast.push('Ekstrakurikuler/organisasi tersimpan.', 'success');
      setForm({ code: '', nama: '', jenis: 'KLUB', deskripsi: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-ekskul-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan ekstrakurikuler.'), 'error'),
  });
  const tambahAnggota = useMutation({
    mutationFn: () =>
      api.post('/pesantren/ekstrakurikuler/anggota', {
        ekstrakurikulerId: ekskulTerpilih!.id,
        santriId: formAnggota.santriId,
        tahunAjaranId: formAnggota.tahunAjaranId || tahunAktif?.id,
        jabatan: formAnggota.jabatan || undefined,
        tanggalBergabung: formAnggota.tanggalBergabung || undefined,
      }),
    onSuccess: () => {
      toast.push('Anggota ekstrakurikuler ditambahkan.', 'success');
      setFormAnggota({ santriId: '', tahunAjaranId: formAnggota.tahunAjaranId, jabatan: 'ANGGOTA', tanggalBergabung: today() });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-ekskul-anggota', ekskulTerpilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menambah anggota.'), 'error'),
  });
  const keluarkanAnggota = useMutation({
    mutationFn: (id: string) => api.post(`/pesantren/ekstrakurikuler/anggota/${id}/keluar`, {}),
    onSuccess: () => {
      toast.push('Anggota dikeluarkan dari ekstrakurikuler.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-ekskul-anggota', ekskulTerpilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengeluarkan anggota.'), 'error'),
  });
  const simpanNilai = useMutation({
    mutationFn: () =>
      api.post(`/pesantren/ekstrakurikuler/anggota/${anggotaNilaiId}/nilai-partisipasi`, {
        nilaiPartisipasi: formNilai.nilaiPartisipasi ? Number(formNilai.nilaiPartisipasi) : undefined,
        catatan: formNilai.catatan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Nilai partisipasi tersimpan.', 'success');
      setAnggotaNilaiId('');
      setFormNilai({ nilaiPartisipasi: '', catatan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-ekskul-anggota', ekskulTerpilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai partisipasi.'), 'error'),
  });
  const columns: Array<GridColumn<EkskulRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'is_active', header: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'AKTIF' : 'NONAKTIF'} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <button
          type="button"
          className="btn-outline px-2 py-1.5 text-xs"
          onClick={() => {
            setEkskulTerpilih(row);
            setAnggotaNilaiId('');
          }}
        >
          <Users className="h-3.5 w-3.5" aria-hidden />
          Anggota
        </button>
      ),
    },
  ];
  const anggotaColumns: Array<GridColumn<AnggotaEkskulRow>> = [
    { key: 'santri_id', header: 'Santri', render: (row) => row.nis && row.nama_lengkap ? `${row.nis} - ${row.nama_lengkap}` : row.santri_id },
    { key: 'jabatan', header: 'Jabatan', render: (row) => <StatusBadge status={row.jabatan} /> },
    { key: 'tanggal_bergabung', header: 'Bergabung', render: (row) => formatDate(row.tanggal_bergabung) },
    { key: 'nilai_partisipasi', header: 'Nilai', render: (row) => row.nilai_partisipasi ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-outline px-2 py-1.5 text-xs"
            onClick={() => {
              setAnggotaNilaiId(row.id);
              setFormNilai({ nilaiPartisipasi: row.nilai_partisipasi ?? '', catatan: row.catatan ?? '' });
            }}
          >
            Nilai
          </button>
          {row.status === 'AKTIF' ? (
            <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => keluarkanAnggota.mutate(row.id)}>Keluar</button>
          ) : null}
        </div>
      ),
    },
  ];
  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  return (
    <>
      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_170px_minmax(180px,1fr)_auto]">
          <Input label="Kode" value={form.code} onChange={(value) => setForm({ ...form, code: value.toUpperCase() })} />
          <Input label="Nama" value={form.nama} onChange={(value) => setForm({ ...form, nama: value })} />
          <Select label="Jenis" value={form.jenis} options={['KLUB', 'ORGANISASI']} onChange={(value) => setForm({ ...form, jenis: value })} />
          <Input label="Deskripsi" value={form.deskripsi} onChange={(value) => setForm({ ...form, deskripsi: value })} />
          <div className="flex items-end"><button type="button" className="btn-primary" disabled={!form.code || !form.nama || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
        </div>
      </div>
      <div className="card mb-4 max-w-xs p-4">
        <Select label="Filter jenis" value={jenis} options={['', 'KLUB', 'ORGANISASI']} onChange={setJenis} />
      </div>
      <DataGrid columns={columns} rows={list.data ?? []} loading={list.isLoading} error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat ekstrakurikuler.') : undefined} rowKey={(row) => String(row.id)} onRetry={() => void list.refetch()} emptyTitle="Belum ada ekstrakurikuler." />
      {ekskulTerpilih && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Anggota {ekskulTerpilih.nama}</h2>
                <p className="text-sm text-slate-500">{ekskulTerpilih.code} - {ekskulTerpilih.jenis}</p>
              </div>
              <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={() => setEkskulTerpilih(null)}>Tutup</button>
            </div>
            <DataGrid
              columns={anggotaColumns}
              rows={anggota.data ?? []}
              loading={anggota.isLoading}
              error={anggota.isError ? toMessage(anggota.error, (_key, fallback) => fallback ?? 'Gagal memuat anggota.') : undefined}
              rowKey={(row) => String(row.id)}
              onRetry={() => void anggota.refetch()}
              emptyTitle="Belum ada anggota."
            />
          </div>
          <div className="space-y-4">
            <div className="card p-4">
              <div className="mb-3 flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-700" aria-hidden />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tambah Anggota</h2>
              </div>
              <div className="grid gap-3">
                <SantriSelect value={formAnggota.santriId} santri={santri.data?.items ?? []} onChange={(value) => setFormAnggota({ ...formAnggota, santriId: value })} />
                <div>
                  <label className="field-label">Tahun ajaran</label>
                  <select className="field-input" value={formAnggota.tahunAjaranId || tahunAktif?.id || ''} onChange={(event) => setFormAnggota({ ...formAnggota, tahunAjaranId: event.target.value })}>
                    <option value="">Pilih tahun ajaran</option>
                    {(tahunAjaran.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                  </select>
                </div>
                <Select label="Jabatan" value={formAnggota.jabatan} options={['KETUA', 'WAKIL_KETUA', 'SEKRETARIS', 'BENDAHARA', 'ANGGOTA']} onChange={(value) => setFormAnggota({ ...formAnggota, jabatan: value })} />
                <Input label="Tanggal bergabung" type="date" value={formAnggota.tanggalBergabung} onChange={(value) => setFormAnggota({ ...formAnggota, tanggalBergabung: value })} />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!formAnggota.santriId || !(formAnggota.tahunAjaranId || tahunAktif?.id) || tambahAnggota.isPending}
                  onClick={() => tambahAnggota.mutate()}
                >
                  Tambah Anggota
                </button>
              </div>
            </div>
            {anggotaNilaiId && (
              <div className="card p-4">
                <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Nilai Partisipasi</h2>
                <div className="grid gap-3">
                  <Input label="Nilai 0-100" type="number" value={formNilai.nilaiPartisipasi} onChange={(value) => setFormNilai({ ...formNilai, nilaiPartisipasi: value })} />
                  <Input label="Catatan" value={formNilai.catatan} onChange={(value) => setFormNilai({ ...formNilai, catatan: value })} />
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button type="button" className="btn-outline" onClick={() => setAnggotaNilaiId('')}>Batal</button>
                  <button type="button" className="btn-primary" disabled={simpanNilai.isPending} onClick={() => simpanNilai.mutate()}>Simpan Nilai</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
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
