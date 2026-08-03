import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useErrorMessage } from '../../../app/auth-context';
import { DataGrid, PageHeader, StatusBadge, type GridColumn } from '../../../components/ui';
import { api, formatDate, formatMoney } from '../../../lib/api';

interface AnakRow extends Record<string, unknown> {
  santri_id: string;
  nis?: string | null;
  nama_lengkap: string;
  status?: string | null;
  adalah_wali_utama?: boolean;
}

interface DetailAnak {
  santri?: Record<string, unknown>;
  asrama?: Record<string, unknown> | null;
  rombongan?: Record<string, unknown> | null;
}

interface DompetAnak {
  dompet?: { saldo?: number | string; batas_harian?: number | string; status?: string };
  riwayat?: Array<Record<string, unknown>>;
}

export function PesantrenPortalWaliPage() {
  const toMessage = useErrorMessage();
  const [santriId, setSantriId] = useState('');

  const anak = useQuery({
    queryKey: ['pesantren-portal-wali-anak'],
    queryFn: () => api.get<AnakRow[]>('/pesantren/portal/wali/anak'),
  });
  const pilihanId = santriId || anak.data?.[0]?.santri_id || '';

  const detail = useQuery({
    queryKey: ['pesantren-portal-wali-detail', pilihanId],
    enabled: Boolean(pilihanId),
    queryFn: () => api.get<DetailAnak>(`/pesantren/portal/wali/anak/${pilihanId}`),
  });
  const presensi = useQuery({
    queryKey: ['pesantren-portal-wali-presensi', pilihanId],
    enabled: Boolean(pilihanId),
    queryFn: () => api.get<{ items: Record<string, unknown>[]; total: number }>(`/pesantren/portal/wali/anak/${pilihanId}/presensi?halaman=1&ukuranHalaman=10`),
  });
  const tahfiz = useQuery({
    queryKey: ['pesantren-portal-wali-tahfiz', pilihanId],
    enabled: Boolean(pilihanId),
    queryFn: () => api.get<Record<string, unknown>[]>(`/pesantren/portal/wali/anak/${pilihanId}/tahfiz`),
  });
  const izin = useQuery({
    queryKey: ['pesantren-portal-wali-izin', pilihanId],
    enabled: Boolean(pilihanId),
    queryFn: () => api.get<Record<string, unknown>[]>(`/pesantren/portal/wali/anak/${pilihanId}/izin`),
  });
  const dompet = useQuery({
    queryKey: ['pesantren-portal-wali-dompet', pilihanId],
    enabled: Boolean(pilihanId),
    queryFn: () => api.get<DompetAnak>(`/pesantren/portal/wali/anak/${pilihanId}/dompet`),
  });

  const anakColumns: Array<GridColumn<AnakRow>> = [
    { key: 'nis', header: 'NIS', render: (row) => row.nis || '-' },
    { key: 'nama_lengkap', header: 'Nama', render: (row) => <button type="button" className="font-semibold text-emerald-700" onClick={() => setSantriId(row.santri_id)}>{row.nama_lengkap}</button> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status || '-'} /> },
    { key: 'wali', header: 'Wali Utama', render: (row) => (row.adalah_wali_utama ? 'Ya' : 'Tidak') },
  ];

  const presensiColumns: Array<GridColumn<Record<string, unknown>>> = [
    { key: 'tanggal', header: 'Tanggal', render: (row) => formatDate(String(row.tanggal ?? '')) },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={String(row.jenis ?? '-')} /> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={String(row.status ?? '-')} /> },
    { key: 'keterangan', header: 'Keterangan', render: (row) => String(row.keterangan ?? '-') },
  ];

  return (
    <>
      <PageHeader
        title="Portal Wali"
        description="Akses baca untuk orang tua atau wali terhadap data anak yang terhubung."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Portal Wali' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void anak.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />

      {anak.isError && (
        <div className="card mb-4 p-4 text-sm text-red-600">
          {toMessage(anak.error, (_key, fallback) => fallback ?? 'Akun ini belum terhubung ke data wali santri.')}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <DataGrid columns={anakColumns} rows={anak.data ?? []} loading={anak.isLoading} rowKey={(row) => row.santri_id} emptyTitle="Belum ada anak terhubung." />

        <aside className="space-y-4">
          <div className="card p-4">
            <p className="text-sm text-slate-500">Anak dipilih</p>
            <h2 className="section-title">{String(detail.data?.santri?.nama_lengkap ?? anak.data?.find((item) => item.santri_id === pilihanId)?.nama_lengkap ?? '-')}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Info label="NIS" value={detail.data?.santri?.nis} />
              <Info label="Status" value={detail.data?.santri?.status} />
              <Info label="Asrama" value={detail.data?.asrama?.nama} />
              <Info label="Rombongan" value={detail.data?.rombongan?.nama} />
            </div>
          </div>

          <div className="card p-4">
            <h3 className="font-semibold text-slate-900">Dompet</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <Info label="Saldo" value={formatMoney(dompet.data?.dompet?.saldo ?? 0)} />
              <Info label="Batas Harian" value={formatMoney(dompet.data?.dompet?.batas_harian ?? 0)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Ringkas label="Tahfiz" value={tahfiz.data?.length ?? 0} />
            <Ringkas label="Izin" value={izin.data?.length ?? 0} />
          </div>
        </aside>
      </div>

      <div className="mt-4">
        <DataGrid
          columns={presensiColumns}
          rows={(presensi.data?.items ?? []).map((row, index) => ({ ...row, __rowKey: String(row.id ?? `${row.tanggal ?? 'presensi'}-${index}`) }))}
          loading={presensi.isLoading}
          rowKey={(row) => String(row.__rowKey)}
          emptyTitle="Belum ada presensi terbaru."
        />
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value == null || value === '' ? '-' : String(value)}</p>
    </div>
  );
}

function Ringkas({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
