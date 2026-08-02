import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import {
  DataGrid,
  PageHeader,
  Pagination,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface SantriRow extends Record<string, unknown> {
  id: string;
  nis: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  status: string;
  status_tinggal: string;
  tanggal_masuk: string;
}

const JENIS_KELAMIN = ['L', 'P'];
const STATUS_TINGGAL = ['MUKIM', 'NONMUKIM'];
const PAGE_SIZE = 25;

const FORM_KOSONG = {
  nis: '',
  namaLengkap: '',
  jenisKelamin: 'L',
  statusTinggal: 'MUKIM',
  tempatLahir: '',
  tanggalLahir: '',
  alamatAsal: '',
};

/**
 * Data Santri (EP-A) -- List + pendaftaran santri baru lewat
 * `POST /pesantren/santri` yang sudah ada. Tidak ada endpoint UPDATE pada
 * modul ini (hanya List/Detail/Create) -- layar ini karena itu tidak
 * menawarkan sunting, sesuai kemampuan API sesungguhnya, bukan janji fitur
 * yang belum ada.
 */
export function PesantrenSantriPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(FORM_KOSONG);

  const queryKey = ['pesantren-santri', page, cari, status];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (cari) params.set('cari', cari);
      if (status) params.set('status', status);
      return api.get<{ items: SantriRow[]; total: number }>(`/pesantren/santri?${params.toString()}`);
    },
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/pesantren/santri', payload),
    onSuccess: () => {
      toast.push('Santri berhasil dicatat.', 'success');
      setCreating(false);
      setForm(FORM_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-santri'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const columns: Array<GridColumn<SantriRow>> = [
    { key: 'nis', header: 'NIS' },
    { key: 'nama_lengkap', header: 'Nama Lengkap' },
    {
      key: 'jenis_kelamin',
      header: 'JK',
      render: (row) => (row.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'),
    },
    { key: 'status_tinggal', header: 'Status Tinggal' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'tanggal_masuk',
      header: 'Tanggal Masuk',
      render: (row) => formatDate(row.tanggal_masuk),
    },
  ];

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Data Santri"
        description="Daftar santri dan pencatatan santri baru."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Data Santri' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Catat Santri Baru
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="santri-cari">
              Cari (nama atau NIS)
            </label>
            <input
              id="santri-cari"
              className="field-input"
              value={cari}
              onChange={(event) => {
                setCari(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="field-label" htmlFor="santri-status">
              Status
            </label>
            <select
              id="santri-status"
              className="field-input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              <option value="AKTIF">Aktif</option>
              <option value="LULUS">Lulus</option>
              <option value="KELUAR">Keluar</option>
              <option value="PINDAH">Pindah</option>
            </select>
          </div>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
      />

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Catat Santri Baru</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="field-label" htmlFor="f-nis">NIS *</label>
                <input
                  id="f-nis"
                  className="field-input"
                  value={form.nis}
                  onChange={(event) => setForm({ ...form, nis: event.target.value })}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="f-nama">Nama Lengkap *</label>
                <input
                  id="f-nama"
                  className="field-input"
                  value={form.namaLengkap}
                  onChange={(event) => setForm({ ...form, namaLengkap: event.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="f-jk">Jenis Kelamin *</label>
                  <select
                    id="f-jk"
                    className="field-input"
                    value={form.jenisKelamin}
                    onChange={(event) => setForm({ ...form, jenisKelamin: event.target.value })}
                  >
                    {JENIS_KELAMIN.map((j) => (
                      <option key={j} value={j}>{j === 'L' ? 'Laki-laki' : 'Perempuan'}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="f-tinggal">Status Tinggal *</label>
                  <select
                    id="f-tinggal"
                    className="field-input"
                    value={form.statusTinggal}
                    onChange={(event) => setForm({ ...form, statusTinggal: event.target.value })}
                  >
                    {STATUS_TINGGAL.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field-label" htmlFor="f-tempat">Tempat Lahir</label>
                  <input
                    id="f-tempat"
                    className="field-input"
                    value={form.tempatLahir}
                    onChange={(event) => setForm({ ...form, tempatLahir: event.target.value })}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="f-tgl-lahir">Tanggal Lahir</label>
                  <input
                    id="f-tgl-lahir"
                    type="date"
                    className="field-input"
                    value={form.tanggalLahir}
                    onChange={(event) => setForm({ ...form, tanggalLahir: event.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="f-alamat">Alamat Asal</label>
                <input
                  id="f-alamat"
                  className="field-input"
                  value={form.alamatAsal}
                  onChange={(event) => setForm({ ...form, alamatAsal: event.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setCreating(false);
                  setForm(FORM_KOSONG);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!form.nis || !form.namaLengkap || create.isPending}
                onClick={() => {
                  const payload = Object.fromEntries(
                    Object.entries(form).filter(([, value]) => value !== ''),
                  );
                  create.mutate(payload);
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
