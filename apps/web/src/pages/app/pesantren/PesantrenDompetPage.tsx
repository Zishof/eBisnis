import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { api, formatDateTime, formatMoney } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

interface DompetRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  saldo: string;
  batas_harian: string | null;
  is_active: boolean;
}

interface TransaksiRow extends Record<string, unknown> {
  id: string;
  jenis: string;
  jumlah: string;
  saldo_sesudah: string;
  keterangan: string | null;
  created_at: string;
}

const PAGE_SIZE = 25;

export function PesantrenDompetPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dipilih, setDipilih] = useState<DompetRow | null>(null);
  const [pageRiwayat, setPageRiwayat] = useState(1);
  const [formBuat, setFormBuat] = useState({ santriId: '', batasHarian: '' });
  const [formTransaksi, setFormTransaksi] = useState({ jenis: 'topup', jumlah: '', keterangan: '' });

  const santri = useQuery({
    queryKey: ['pesantren-dompet-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const dompet = useQuery({
    queryKey: ['pesantren-dompet-list'],
    queryFn: () => api.get<DompetRow[]>('/pesantren/dompet'),
  });
  const riwayat = useQuery({
    queryKey: ['pesantren-dompet-riwayat', dipilih?.id, pageRiwayat],
    enabled: Boolean(dipilih),
    queryFn: () => api.get<{ items: TransaksiRow[]; total: number }>(`/pesantren/dompet/${dipilih!.id}/riwayat?halaman=${pageRiwayat}&ukuranHalaman=${PAGE_SIZE}`),
  });

  const buat = useMutation({
    mutationFn: () => api.post<DompetRow>('/pesantren/dompet', { santriId: formBuat.santriId, batasHarian: formBuat.batasHarian ? Number(formBuat.batasHarian) : undefined }),
    onSuccess: () => {
      toast.push('Dompet santri dibuat.', 'success');
      setFormBuat({ santriId: '', batasHarian: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dompet-list'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat dompet.'), 'error'),
  });

  const transaksi = useMutation({
    mutationFn: () =>
      api.post<TransaksiRow>(`/pesantren/dompet/${dipilih!.id}/${formTransaksi.jenis}`, {
        jumlah: Number(formTransaksi.jumlah),
        keterangan: formTransaksi.keterangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Transaksi dompet tersimpan.', 'success');
      setFormTransaksi({ jenis: formTransaksi.jenis, jumlah: '', keterangan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dompet-list'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-dompet-riwayat'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat transaksi.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const columnsDompet: Array<GridColumn<DompetRow>> = [
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'saldo', header: 'Saldo', render: (row) => formatMoney(row.saldo) },
    { key: 'batas_harian', header: 'Batas Harian', render: (row) => (row.batas_harian ? formatMoney(row.batas_harian) : '-') },
    { key: 'is_active', header: 'Status', render: (row) => <StatusBadge status={row.is_active ? 'AKTIF' : 'NONAKTIF'} /> },
    { key: 'aksi', header: 'Aksi', render: (row) => <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => { setDipilih(row); setPageRiwayat(1); }}>Riwayat</button> },
  ];
  const columnsRiwayat: Array<GridColumn<TransaksiRow>> = [
    { key: 'created_at', header: 'Waktu', render: (row) => formatDateTime(row.created_at) },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'jumlah', header: 'Jumlah', render: (row) => formatMoney(row.jumlah) },
    { key: 'saldo_sesudah', header: 'Saldo Sesudah', render: (row) => formatMoney(row.saldo_sesudah) },
    { key: 'keterangan', header: 'Keterangan', render: (row) => row.keterangan ?? '-' },
  ];
  const totalRiwayat = riwayat.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Dompet Santri"
        description="Buka dompet uang saku, top up, catat belanja, dan pantau riwayat transaksi."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Dompet Santri' }]}
        actions={<button type="button" className="btn-outline" onClick={() => void dompet.refetch()}><RefreshCw className="h-4 w-4" aria-hidden />Muat Ulang</button>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div>
          <div className="card mb-4 p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_auto]">
              <SantriSelect value={formBuat.santriId} santri={santri.data?.items ?? []} onChange={(value) => setFormBuat({ ...formBuat, santriId: value })} />
              <Input label="Batas harian" type="number" value={formBuat.batasHarian} onChange={(value) => setFormBuat({ ...formBuat, batasHarian: value })} />
              <div className="flex items-end"><button type="button" className="btn-primary" disabled={!formBuat.santriId || buat.isPending} onClick={() => buat.mutate()}><Plus className="h-4 w-4" aria-hidden />Buat</button></div>
            </div>
          </div>
          <DataGrid columns={columnsDompet} rows={dompet.data ?? []} loading={dompet.isLoading} error={dompet.isError ? toMessage(dompet.error, (_key, fallback) => fallback ?? 'Gagal memuat dompet.') : undefined} rowKey={(row) => row.id} onRetry={() => void dompet.refetch()} emptyTitle="Belum ada dompet santri." />
        </div>
        <div className="card p-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Transaksi</h2>
          <p className="mt-1 text-sm text-slate-500">{dipilih ? namaSantri.get(dipilih.santri_id) ?? dipilih.santri_id : 'Pilih dompet untuk melihat riwayat.'}</p>
          {dipilih && (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Select label="Jenis" value={formTransaksi.jenis} options={['topup', 'belanja']} onChange={(value) => setFormTransaksi({ ...formTransaksi, jenis: value })} />
                <Input label="Jumlah" type="number" value={formTransaksi.jumlah} onChange={(value) => setFormTransaksi({ ...formTransaksi, jumlah: value })} />
                <div className="md:col-span-2"><Input label="Keterangan" value={formTransaksi.keterangan} onChange={(value) => setFormTransaksi({ ...formTransaksi, keterangan: value })} /></div>
              </div>
              <div className="mt-3 flex justify-end"><button type="button" className="btn-primary" disabled={!formTransaksi.jumlah || transaksi.isPending} onClick={() => transaksi.mutate()}>Simpan Transaksi</button></div>
              <div className="mt-5">
                <DataGrid columns={columnsRiwayat} rows={riwayat.data?.items ?? []} loading={riwayat.isLoading} error={riwayat.isError ? toMessage(riwayat.error, (_key, fallback) => fallback ?? 'Gagal memuat riwayat.') : undefined} rowKey={(row) => row.id} onRetry={() => void riwayat.refetch()} emptyTitle="Belum ada transaksi." />
                <Pagination page={pageRiwayat} totalPages={Math.max(1, Math.ceil(totalRiwayat / PAGE_SIZE))} total={totalRiwayat} onChange={setPageRiwayat} />
              </div>
            </>
          )}
        </div>
      </div>
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
  return <div><label className="field-label">{label}</label><input type={type} className="field-input" value={value} onChange={(event) => onChange(event.target.value)} /></div>;
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><label className="field-label">{label}</label><select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}
