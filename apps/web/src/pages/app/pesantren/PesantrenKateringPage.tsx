import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface MenuRow extends Record<string, unknown> {
  id: string;
  tanggal: string;
  waktu_makan: string;
  nama_menu: string;
  jumlah_porsi_disiapkan: number | null;
  status: string;
}

interface BahanRow extends Record<string, unknown> {
  id: string;
  nama_bahan: string;
  satuan: string;
  stok_saat_ini: string;
  stok_minimum: string | null;
  is_active: boolean;
}

interface AsramaRow {
  id: string;
  nama: string;
}

const WAKTU_MAKAN = ['SARAPAN', 'MAKAN_SIANG', 'MAKAN_MALAM', 'SNACK'];
const STATUS_MENU = ['DIRENCANAKAN', 'DISIAPKAN', 'SELESAI', 'DIBATALKAN'];
const JENIS_STOK = ['MASUK', 'KELUAR', 'PENYESUAIAN'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenKateringPage() {
  const [tab, setTab] = useState<'menu' | 'bahan'>('menu');
  return (
    <>
      <PageHeader
        title="Katering dan Dapur"
        description="Kelola menu makan, distribusi porsi, bahan dapur, dan pergerakan stok."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Katering' }]}
      />
      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'menu' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('menu')}>Menu</button>
        <button type="button" className={tab === 'bahan' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('bahan')}>Bahan</button>
      </div>
      {tab === 'menu' ? <TabMenu /> : <TabBahan />}
    </>
  );
}

function TabMenu() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState({ dari: today(), sampai: today() });
  const [menuDipilih, setMenuDipilih] = useState<MenuRow | null>(null);
  const [form, setForm] = useState({ tanggal: today(), waktuMakan: 'SARAPAN', namaMenu: '', jumlahPorsiDisiapkan: '', deskripsi: '' });
  const [formKonsumsi, setFormKonsumsi] = useState({ asramaId: '', jumlahPorsi: '', catatan: '' });

  const menu = useQuery({
    queryKey: ['pesantren-katering-menu', filter],
    queryFn: () => api.get<MenuRow[]>(`/pesantren/katering/menu?dari=${filter.dari}&sampai=${filter.sampai}`),
  });
  const asrama = useQuery({
    queryKey: ['pesantren-katering-asrama'],
    queryFn: () => api.get<AsramaRow[]>('/pesantren/asrama'),
  });

  const simpan = useMutation({
    mutationFn: () => api.post<MenuRow>('/pesantren/katering/menu', { ...form, jumlahPorsiDisiapkan: form.jumlahPorsiDisiapkan ? Number(form.jumlahPorsiDisiapkan) : undefined, deskripsi: form.deskripsi.trim() || undefined }),
    onSuccess: () => {
      toast.push('Menu makan tersimpan.', 'success');
      setForm({ tanggal: form.tanggal, waktuMakan: 'SARAPAN', namaMenu: '', jumlahPorsiDisiapkan: '', deskripsi: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-katering-menu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan menu.'), 'error'),
  });

  const ubahStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.post<MenuRow>(`/pesantren/katering/menu/${id}/status`, { status }),
    onSuccess: () => {
      toast.push('Status menu diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-katering-menu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengubah status menu.'), 'error'),
  });

  const konsumsi = useMutation({
    mutationFn: () => api.post('/pesantren/katering/konsumsi', { menuId: menuDipilih!.id, asramaId: formKonsumsi.asramaId || undefined, jumlahPorsi: Number(formKonsumsi.jumlahPorsi), catatan: formKonsumsi.catatan.trim() || undefined }),
    onSuccess: () => {
      toast.push('Distribusi porsi tercatat.', 'success');
      setFormKonsumsi({ asramaId: '', jumlahPorsi: '', catatan: '' });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat distribusi.') , 'error'),
  });

  const columns: Array<GridColumn<MenuRow>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(row.tanggal) },
    { key: 'waktu_makan', header: 'Waktu', render: (row) => <StatusBadge status={row.waktu_makan} /> },
    { key: 'nama_menu', header: 'Menu' },
    { key: 'jumlah_porsi_disiapkan', header: 'Porsi', render: (row) => row.jumlah_porsi_disiapkan ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => setMenuDipilih(row)}>Distribusi</button>
          {STATUS_MENU.filter((s) => s !== row.status).slice(0, 2).map((status) => (
            <button key={status} type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => ubahStatus.mutate({ id: row.id, status })}>{status}</button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div>
        <div className="card mb-4 p-4">
          <div className="grid gap-3 md:grid-cols-[170px_170px_minmax(220px,1fr)_140px_auto]">
            <Input label="Tanggal" type="date" value={form.tanggal} onChange={(value) => setForm({ ...form, tanggal: value })} />
            <Select label="Waktu" value={form.waktuMakan} options={WAKTU_MAKAN} onChange={(value) => setForm({ ...form, waktuMakan: value })} />
            <Input label="Menu" value={form.namaMenu} onChange={(value) => setForm({ ...form, namaMenu: value })} />
            <Input label="Porsi" type="number" value={form.jumlahPorsiDisiapkan} onChange={(value) => setForm({ ...form, jumlahPorsiDisiapkan: value })} />
            <div className="flex items-end"><button type="button" className="btn-primary" disabled={!form.namaMenu || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
          </div>
        </div>
        <div className="card mb-4 p-4">
          <div className="grid gap-3 md:grid-cols-[170px_170px_auto]">
            <Input label="Dari" type="date" value={filter.dari} onChange={(value) => setFilter({ ...filter, dari: value })} />
            <Input label="Sampai" type="date" value={filter.sampai} onChange={(value) => setFilter({ ...filter, sampai: value })} />
            <div className="flex items-end"><button type="button" className="btn-outline" onClick={() => void menu.refetch()}><RefreshCw className="h-4 w-4" aria-hidden />Muat</button></div>
          </div>
        </div>
        <DataGrid columns={columns} rows={menu.data ?? []} loading={menu.isLoading} error={menu.isError ? toMessage(menu.error, (_key, fallback) => fallback ?? 'Gagal memuat menu.') : undefined} rowKey={(row) => row.id} onRetry={() => void menu.refetch()} emptyTitle="Belum ada menu makan." />
      </div>
      <div className="card p-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Distribusi Porsi</h2>
        <p className="mt-1 text-sm text-slate-500">{menuDipilih ? menuDipilih.nama_menu : 'Pilih menu untuk mencatat distribusi.'}</p>
        {menuDipilih && (
          <div className="mt-4 space-y-3">
            <div><label className="field-label">Asrama</label><select className="field-input" value={formKonsumsi.asramaId} onChange={(event) => setFormKonsumsi({ ...formKonsumsi, asramaId: event.target.value })}><option value="">Umum/tanpa asrama</option>{(asrama.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</select></div>
            <Input label="Jumlah porsi" type="number" value={formKonsumsi.jumlahPorsi} onChange={(value) => setFormKonsumsi({ ...formKonsumsi, jumlahPorsi: value })} />
            <Input label="Catatan" value={formKonsumsi.catatan} onChange={(value) => setFormKonsumsi({ ...formKonsumsi, catatan: value })} />
            <button type="button" className="btn-primary w-full" disabled={!formKonsumsi.jumlahPorsi || konsumsi.isPending} onClick={() => konsumsi.mutate()}>Simpan Distribusi</button>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBahan() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [bahanDipilih, setBahanDipilih] = useState<BahanRow | null>(null);
  const [form, setForm] = useState({ namaBahan: '', satuan: '', stokMinimum: '' });
  const [formStok, setFormStok] = useState({ jenis: 'MASUK', jumlah: '', keterangan: '' });
  const bahan = useQuery({ queryKey: ['pesantren-katering-bahan'], queryFn: () => api.get<BahanRow[]>('/pesantren/katering/bahan') });
  const simpan = useMutation({
    mutationFn: () => api.post<BahanRow>('/pesantren/katering/bahan', { namaBahan: form.namaBahan, satuan: form.satuan, stokMinimum: form.stokMinimum ? Number(form.stokMinimum) : undefined }),
    onSuccess: () => {
      toast.push('Bahan dapur tersimpan.', 'success');
      setForm({ namaBahan: '', satuan: '', stokMinimum: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-katering-bahan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan bahan.') , 'error'),
  });
  const transaksi = useMutation({
    mutationFn: () => api.post(`/pesantren/katering/bahan/${bahanDipilih!.id}/transaksi`, { jenis: formStok.jenis, jumlah: Number(formStok.jumlah), keterangan: formStok.keterangan.trim() || undefined }),
    onSuccess: () => {
      toast.push('Transaksi stok tersimpan.', 'success');
      setFormStok({ jenis: formStok.jenis, jumlah: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-katering-bahan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat stok.') , 'error'),
  });
  const columns: Array<GridColumn<BahanRow>> = [
    { key: 'nama_bahan', header: 'Bahan' },
    { key: 'stok_saat_ini', header: 'Stok', render: (row) => `${row.stok_saat_ini} ${row.satuan}` },
    { key: 'stok_minimum', header: 'Minimum', render: (row) => row.stok_minimum ? `${row.stok_minimum} ${row.satuan}` : '-' },
    { key: 'is_active', header: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'AKTIF' : 'NONAKTIF'} /> },
    { key: 'aksi', header: 'Aksi', render: (row) => <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => setBahanDipilih(row)}>Stok</button> },
  ];
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <div className="card mb-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_120px_160px_auto]">
            <Input label="Nama bahan" value={form.namaBahan} onChange={(value) => setForm({ ...form, namaBahan: value })} />
            <Input label="Satuan" value={form.satuan} onChange={(value) => setForm({ ...form, satuan: value })} />
            <Input label="Stok minimum" type="number" value={form.stokMinimum} onChange={(value) => setForm({ ...form, stokMinimum: value })} />
            <div className="flex items-end"><button type="button" className="btn-primary" disabled={!form.namaBahan || !form.satuan || simpan.isPending} onClick={() => simpan.mutate()}><Plus className="h-4 w-4" aria-hidden />Tambah</button></div>
          </div>
        </div>
        <DataGrid columns={columns} rows={bahan.data ?? []} loading={bahan.isLoading} error={bahan.isError ? toMessage(bahan.error, (_key, fallback) => fallback ?? 'Gagal memuat bahan.') : undefined} rowKey={(row) => row.id} onRetry={() => void bahan.refetch()} emptyTitle="Belum ada bahan dapur." />
      </div>
      <div className="card p-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Transaksi Stok</h2>
        <p className="mt-1 text-sm text-slate-500">{bahanDipilih ? `${bahanDipilih.nama_bahan} (${bahanDipilih.stok_saat_ini} ${bahanDipilih.satuan})` : 'Pilih bahan untuk mencatat stok.'}</p>
        {bahanDipilih && (
          <div className="mt-4 space-y-3">
            <Select label="Jenis" value={formStok.jenis} options={JENIS_STOK} onChange={(value) => setFormStok({ ...formStok, jenis: value })} />
            <Input label="Jumlah" type="number" value={formStok.jumlah} onChange={(value) => setFormStok({ ...formStok, jumlah: value })} />
            <Input label="Keterangan" value={formStok.keterangan} onChange={(value) => setFormStok({ ...formStok, keterangan: value })} />
            <button type="button" className="btn-primary w-full" disabled={!formStok.jumlah || transaksi.isPending} onClick={() => transaksi.mutate()}>Simpan Stok</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><label className="field-label">{label}</label><input type={type} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><label className="field-label">{label}</label><select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}
