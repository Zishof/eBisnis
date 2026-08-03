import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, XCircle } from 'lucide-react';
import { api, formatDate, formatMoney } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface GelombangRow extends Record<string, unknown> {
  id: string;
  tahun_ajaran_id: string;
  unit_pendidikan_id: string | null;
  kode: string;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string;
  kuota: number | null;
  biaya_pendaftaran: string;
  form_schema: unknown[];
  status: string;
  created_at: string;
}

interface PendaftarRow extends Record<string, unknown> {
  id: string;
  gelombang_id: string;
  nomor_pendaftaran: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  nama_orang_tua: string | null;
  no_hp_orang_tua: string | null;
  unit_pendidikan_tujuan_id: string | null;
  status: string;
  created_at: string;
}

const PAGE_SIZE = 25;
const FORM_GELOMBANG_KOSONG = {
  tahunAjaranId: '',
  unitPendidikanId: '',
  kode: '',
  nama: '',
  tanggalBuka: '',
  tanggalTutup: '',
  kuota: '',
  biayaPendaftaran: '',
  formSchema: '',
};

export function PesantrenPsbPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'gelombang' | 'pendaftar'>('gelombang');
  const [pageGelombang, setPageGelombang] = useState(1);
  const [pagePendaftar, setPagePendaftar] = useState(1);
  const [statusGelombang, setStatusGelombang] = useState('');
  const [statusPendaftar, setStatusPendaftar] = useState('');
  const [cariPendaftar, setCariPendaftar] = useState('');
  const [membuatGelombang, setMembuatGelombang] = useState(false);
  const [formGelombang, setFormGelombang] = useState(FORM_GELOMBANG_KOSONG);

  const gelombang = useQuery({
    queryKey: ['pesantren-psb-gelombang', pageGelombang, statusGelombang],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(pageGelombang), ukuranHalaman: String(PAGE_SIZE) });
      if (statusGelombang) params.set('status', statusGelombang);
      return api.get<{ items: GelombangRow[]; total: number }>(`/pesantren/psb/gelombang?${params.toString()}`);
    },
  });

  const pendaftar = useQuery({
    queryKey: ['pesantren-psb-pendaftar', pagePendaftar, statusPendaftar, cariPendaftar],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(pagePendaftar), ukuranHalaman: String(PAGE_SIZE) });
      if (statusPendaftar) params.set('status', statusPendaftar);
      if (cariPendaftar) params.set('cari', cariPendaftar);
      return api.get<{ items: PendaftarRow[]; total: number }>(`/pesantren/psb/pendaftar?${params.toString()}`);
    },
  });

  const buatGelombang = useMutation({
    mutationFn: () => {
      let formSchema: unknown[] = [];
      if (formGelombang.formSchema.trim()) {
        const parsed = JSON.parse(formGelombang.formSchema) as unknown;
        formSchema = Array.isArray(parsed) ? parsed : [];
      }
      return api.post<GelombangRow>('/pesantren/psb/gelombang', {
        tahunAjaranId: formGelombang.tahunAjaranId,
        unitPendidikanId: formGelombang.unitPendidikanId || undefined,
        kode: formGelombang.kode,
        nama: formGelombang.nama,
        tanggalBuka: formGelombang.tanggalBuka,
        tanggalTutup: formGelombang.tanggalTutup,
        kuota: formGelombang.kuota ? Number(formGelombang.kuota) : undefined,
        biayaPendaftaran: formGelombang.biayaPendaftaran ? Number(formGelombang.biayaPendaftaran) : undefined,
        formSchema,
      });
    },
    onSuccess: () => {
      toast.push('Gelombang PSB berhasil dibuat.', 'success');
      setMembuatGelombang(false);
      setFormGelombang(FORM_GELOMBANG_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-gelombang'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat gelombang.'), 'error'),
  });

  const aksiGelombang = useMutation({
    mutationFn: ({ id, aksi }: { id: string; aksi: 'buka' | 'tutup' | 'selesai' }) =>
      api.post<GelombangRow>(`/pesantren/psb/gelombang/${id}/${aksi}`),
    onSuccess: () => {
      toast.push('Status gelombang diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-gelombang'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memperbarui status.'), 'error'),
  });

  const aksiPendaftar = useMutation({
    mutationFn: ({ id, aksi }: { id: string; aksi: 'verifikasi' | 'luluskan' | 'tidak-luluskan' | 'terima' | 'batalkan' }) =>
      api.post<PendaftarRow>(`/pesantren/psb/pendaftar/${id}/${aksi}`, {}),
    onSuccess: () => {
      toast.push('Status pendaftar diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-pendaftar'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memperbarui pendaftar.'), 'error'),
  });

  const gelombangColumns: Array<GridColumn<GelombangRow>> = [
    { key: 'kode', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'tanggal_buka', header: 'Buka', render: (row) => formatDate(row.tanggal_buka) },
    { key: 'tanggal_tutup', header: 'Tutup', render: (row) => formatDate(row.tanggal_tutup) },
    { key: 'kuota', header: 'Kuota', render: (row) => row.kuota ?? '-' },
    { key: 'biaya_pendaftaran', header: 'Biaya', render: (row) => formatMoney(row.biaya_pendaftaran) },
    { key: 'form_schema', header: 'Field Tambahan', render: (row) => `${Array.isArray(row.form_schema) ? row.form_schema.length : 0} field` },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex justify-end gap-2">
          {row.status === 'DRAFT' && <StatusAction label="Buka" onClick={() => aksiGelombang.mutate({ id: row.id, aksi: 'buka' })} />}
          {row.status === 'DIBUKA' && <StatusAction label="Tutup" onClick={() => aksiGelombang.mutate({ id: row.id, aksi: 'tutup' })} />}
          {row.status === 'DITUTUP' && <StatusAction label="Selesai" onClick={() => aksiGelombang.mutate({ id: row.id, aksi: 'selesai' })} />}
        </div>
      ),
    },
  ];

  const pendaftarColumns: Array<GridColumn<PendaftarRow>> = [
    { key: 'nomor_pendaftaran', header: 'No. Pendaftaran' },
    { key: 'nama_lengkap', header: 'Nama' },
    { key: 'jenis_kelamin', header: 'JK', render: (row) => (row.jenis_kelamin === 'L' ? 'L' : 'P') },
    { key: 'nama_orang_tua', header: 'Orang Tua', render: (row) => row.nama_orang_tua ?? '-' },
    { key: 'no_hp_orang_tua', header: 'HP', render: (row) => row.no_hp_orang_tua ?? '-' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'id',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          {row.status === 'TERDAFTAR' && <StatusAction label="Verifikasi" onClick={() => aksiPendaftar.mutate({ id: row.id, aksi: 'verifikasi' })} />}
          {row.status === 'DIJADWALKAN' && (
            <>
              <button type="button" className="btn-outline px-2 py-1.5" onClick={() => aksiPendaftar.mutate({ id: row.id, aksi: 'luluskan' })}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="btn-outline px-2 py-1.5" onClick={() => aksiPendaftar.mutate({ id: row.id, aksi: 'tidak-luluskan' })}>
                <XCircle className="h-4 w-4" aria-hidden />
              </button>
            </>
          )}
          {row.status === 'LULUS_SELEKSI' && <StatusAction label="Terima" onClick={() => aksiPendaftar.mutate({ id: row.id, aksi: 'terima' })} />}
          {!['DITERIMA', 'DAFTAR_ULANG', 'DIBATALKAN', 'TIDAK_LULUS'].includes(row.status) && (
            <StatusAction label="Batal" onClick={() => aksiPendaftar.mutate({ id: row.id, aksi: 'batalkan' })} />
          )}
        </div>
      ),
    },
  ];

  const totalGelombang = gelombang.data?.total ?? 0;
  const totalPendaftar = pendaftar.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="PSB / PPDB"
        description="Kelola gelombang penerimaan dan tindak lanjut calon santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'PSB / PPDB' }]}
        actions={
          tab === 'gelombang' ? (
            <button type="button" className="btn-primary" onClick={() => setMembuatGelombang(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Buat Gelombang
            </button>
          ) : undefined
        }
      />

      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'gelombang' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('gelombang')}>
          Gelombang
        </button>
        <button type="button" className={tab === 'pendaftar' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('pendaftar')}>
          Pendaftar
        </button>
      </div>

      {tab === 'gelombang' ? (
        <>
          <div className="card mb-4 max-w-xs p-4">
            <label className="field-label" htmlFor="psb-status-gelombang">
              Status
            </label>
            <select
              id="psb-status-gelombang"
              className="field-input"
              value={statusGelombang}
              onChange={(e) => {
                setStatusGelombang(e.target.value);
                setPageGelombang(1);
              }}
            >
              <option value="">Semua</option>
              {['DRAFT', 'DIBUKA', 'DITUTUP', 'SELESAI'].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <DataGrid
            columns={gelombangColumns}
            rows={gelombang.data?.items ?? []}
            loading={gelombang.isLoading}
            error={gelombang.isError ? toMessage(gelombang.error, (_key, fallback) => fallback ?? 'Gagal memuat gelombang.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void gelombang.refetch()}
            emptyTitle="Belum ada gelombang PSB."
          />
          <Pagination page={pageGelombang} totalPages={Math.max(1, Math.ceil(totalGelombang / PAGE_SIZE))} total={totalGelombang} onChange={setPageGelombang} />
        </>
      ) : (
        <>
          <div className="card mb-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <label className="field-label" htmlFor="psb-cari">
                  Cari pendaftar
                </label>
                <input
                  id="psb-cari"
                  className="field-input"
                  value={cariPendaftar}
                  onChange={(e) => {
                    setCariPendaftar(e.target.value);
                    setPagePendaftar(1);
                  }}
                />
              </div>
              <div className="min-w-[180px]">
                <label className="field-label" htmlFor="psb-status-pendaftar">
                  Status
                </label>
                <select
                  id="psb-status-pendaftar"
                  className="field-input"
                  value={statusPendaftar}
                  onChange={(e) => {
                    setStatusPendaftar(e.target.value);
                    setPagePendaftar(1);
                  }}
                >
                  <option value="">Semua</option>
                  {['TERDAFTAR', 'VERIFIKASI', 'DIJADWALKAN', 'LULUS_SELEKSI', 'TIDAK_LULUS', 'DITERIMA', 'DAFTAR_ULANG', 'DIBATALKAN'].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DataGrid
            columns={pendaftarColumns}
            rows={pendaftar.data?.items ?? []}
            loading={pendaftar.isLoading}
            error={pendaftar.isError ? toMessage(pendaftar.error, (_key, fallback) => fallback ?? 'Gagal memuat pendaftar.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void pendaftar.refetch()}
            emptyTitle="Belum ada pendaftar."
          />
          <Pagination page={pagePendaftar} totalPages={Math.max(1, Math.ceil(totalPendaftar / PAGE_SIZE))} total={totalPendaftar} onChange={setPagePendaftar} />
        </>
      )}

      {membuatGelombang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Buat Gelombang PSB</h2>
            <div className="mt-4 space-y-3">
              <Field label="Tahun ajaran ID *">
                <input className="field-input" value={formGelombang.tahunAjaranId} onChange={(e) => setFormGelombang({ ...formGelombang, tahunAjaranId: e.target.value })} />
              </Field>
              <Field label="Unit pendidikan ID">
                <input className="field-input" value={formGelombang.unitPendidikanId} onChange={(e) => setFormGelombang({ ...formGelombang, unitPendidikanId: e.target.value })} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Kode *">
                  <input className="field-input uppercase" value={formGelombang.kode} onChange={(e) => setFormGelombang({ ...formGelombang, kode: e.target.value.toUpperCase() })} />
                </Field>
                <Field label="Nama *">
                  <input className="field-input" value={formGelombang.nama} onChange={(e) => setFormGelombang({ ...formGelombang, nama: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tanggal buka *">
                  <input type="date" className="field-input" value={formGelombang.tanggalBuka} onChange={(e) => setFormGelombang({ ...formGelombang, tanggalBuka: e.target.value })} />
                </Field>
                <Field label="Tanggal tutup *">
                  <input type="date" className="field-input" value={formGelombang.tanggalTutup} onChange={(e) => setFormGelombang({ ...formGelombang, tanggalTutup: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Kuota">
                  <input type="number" min="1" className="field-input" value={formGelombang.kuota} onChange={(e) => setFormGelombang({ ...formGelombang, kuota: e.target.value })} />
                </Field>
                <Field label="Biaya pendaftaran">
                  <input type="number" min="0" className="field-input" value={formGelombang.biayaPendaftaran} onChange={(e) => setFormGelombang({ ...formGelombang, biayaPendaftaran: e.target.value })} />
                </Field>
              </div>
              <Field label="Field formulir tambahan (JSON array)">
                <textarea
                  className="field-input min-h-28 font-mono text-xs"
                  value={formGelombang.formSchema}
                  onChange={(e) => setFormGelombang({ ...formGelombang, formSchema: e.target.value })}
                  placeholder='[{"name":"asalSekolah","label":"Asal Sekolah","type":"text","required":true}]'
                />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setMembuatGelombang(false)}>
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!formGelombang.tahunAjaranId || !formGelombang.kode || !formGelombang.nama || !formGelombang.tanggalBuka || !formGelombang.tanggalTutup || buatGelombang.isPending}
                onClick={() => buatGelombang.mutate()}
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

function StatusAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={onClick}>
      {label}
    </button>
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
