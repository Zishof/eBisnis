import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorClosed, DoorOpen, RefreshCw, Search } from 'lucide-react';
import { api, formatDate, formatDateTime } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface IzinGerbangAktif {
  id: string;
  jenis: string;
  alasan: string;
  tanggal_mulai: string;
  tanggal_selesai_rencana: string;
  status: string;
  lintasan_terakhir: string | null;
}

interface HasilPindaiGerbang {
  santri: {
    id: string;
    nis: string;
    nama_lengkap: string;
    status: string;
  };
  kartu: {
    id: string;
    nomor_kartu: string;
    jenis: string;
    status: string;
  };
  izinAktif: IzinGerbangAktif[];
  lintasanTerakhir: BarisLintasan | null;
}

interface BarisLintasan extends Record<string, unknown> {
  id: string;
  izin_id: string;
  santri_id?: string;
  nis?: string;
  nama_lengkap?: string;
  jenis_izin?: string;
  arah: string;
  waktu: string;
  catatan: string | null;
}

const PAGE_SIZE = 25;

export function PesantrenGerbangPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [nomorKartu, setNomorKartu] = useState('');
  const [nomorDicari, setNomorDicari] = useState('');
  const [izinId, setIzinId] = useState('');
  const [arah, setArah] = useState<'KELUAR' | 'MASUK'>('KELUAR');
  const [catatan, setCatatan] = useState('');

  const hasil = useQuery({
    queryKey: ['pesantren-gerbang-kartu', nomorDicari],
    enabled: nomorDicari.length > 0,
    queryFn: () => api.get<HasilPindaiGerbang>(`/pesantren/gerbang/kartu/${encodeURIComponent(nomorDicari)}`),
  });

  const riwayat = useQuery({
    queryKey: ['pesantren-gerbang-riwayat', page],
    queryFn: () =>
      api.get<{ items: BarisLintasan[]; total: number }>(
        `/pesantren/gerbang?halaman=${page}&ukuranHalaman=${PAGE_SIZE}`,
      ),
  });

  const izinDipilih = useMemo(
    () => hasil.data?.izinAktif.find((item) => item.id === izinId) ?? hasil.data?.izinAktif[0],
    [hasil.data?.izinAktif, izinId],
  );

  const catat = useMutation({
    mutationFn: (input: { izinId: string; arah: 'KELUAR' | 'MASUK'; catatan?: string }) =>
      api.post<BarisLintasan>('/pesantren/gerbang', input),
    onSuccess: () => {
      toast.push(`Lintasan ${arah.toLowerCase()} berhasil dicatat.`, 'success');
      setCatatan('');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-gerbang-riwayat'] });
      if (nomorDicari) void queryClient.invalidateQueries({ queryKey: ['pesantren-gerbang-kartu', nomorDicari] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat lintasan.'), 'error'),
  });

  const columns: Array<GridColumn<BarisLintasan>> = [
    { key: 'waktu', header: 'Waktu', render: (row) => formatDateTime(row.waktu) },
    { key: 'arah', header: 'Arah', render: (row) => <StatusBadge status={row.arah} /> },
    { key: 'nama_lengkap', header: 'Santri', render: (row) => row.nama_lengkap ?? row.santri_id ?? '-' },
    { key: 'nis', header: 'NIS', render: (row) => row.nis ?? '-' },
    { key: 'jenis_izin', header: 'Izin', render: (row) => row.jenis_izin ?? row.izin_id },
    { key: 'catatan', header: 'Catatan', render: (row) => row.catatan ?? '-' },
  ];

  const total = riwayat.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Gerbang Keluar-Masuk"
        description="Pindai kartu santri, cocokkan dengan izin yang sudah disetujui, lalu catat lintasan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Gerbang' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void riwayat.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />

      <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="card p-5">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              const nomor = nomorKartu.trim();
              setNomorDicari(nomor);
              setIzinId('');
            }}
          >
            <div className="min-w-[240px] flex-1">
              <label className="field-label" htmlFor="gerbang-nomor-kartu">
                Nomor kartu / hasil scan
              </label>
              <input
                id="gerbang-nomor-kartu"
                className="field-input"
                value={nomorKartu}
                onChange={(event) => setNomorKartu(event.target.value)}
                placeholder="RFID-000123"
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary" disabled={!nomorKartu.trim() || hasil.isFetching}>
              <Search className="h-4 w-4" aria-hidden />
              Cari
            </button>
          </form>

          {hasil.isError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {toMessage(hasil.error, (_key, fallback) => fallback ?? 'Kartu tidak ditemukan atau tidak aktif.')}
            </div>
          )}

          {hasil.data && (
            <div className="mt-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <Info label="Santri" value={hasil.data.santri.nama_lengkap} />
                <Info label="NIS" value={hasil.data.santri.nis} />
                <Info label="Kartu" value={`${hasil.data.kartu.nomor_kartu} (${hasil.data.kartu.jenis})`} />
              </div>

              <div>
                <label className="field-label" htmlFor="gerbang-izin">
                  Izin aktif
                </label>
                <select
                  id="gerbang-izin"
                  className="field-input"
                  value={izinDipilih?.id ?? ''}
                  onChange={(event) => setIzinId(event.target.value)}
                  disabled={!hasil.data.izinAktif.length}
                >
                  {hasil.data.izinAktif.length ? (
                    hasil.data.izinAktif.map((izin) => (
                      <option key={izin.id} value={izin.id}>
                        {izin.jenis} - {formatDate(izin.tanggal_mulai)} s/d {formatDate(izin.tanggal_selesai_rencana)}
                      </option>
                    ))
                  ) : (
                    <option value="">Tidak ada izin DISETUJUI untuk hari ini</option>
                  )}
                </select>
              </div>

              {izinDipilih && (
                <div className="rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={izinDipilih.status} />
                    {izinDipilih.lintasan_terakhir && <StatusBadge status={`Terakhir ${izinDipilih.lintasan_terakhir}`} />}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{izinDipilih.alasan}</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <label className="field-label" htmlFor="gerbang-arah">
                    Arah lintasan
                  </label>
                  <select
                    id="gerbang-arah"
                    className="field-input"
                    value={arah}
                    onChange={(event) => setArah(event.target.value as 'KELUAR' | 'MASUK')}
                  >
                    <option value="KELUAR">Keluar</option>
                    <option value="MASUK">Masuk</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="gerbang-catatan">
                    Catatan
                  </label>
                  <input
                    id="gerbang-catatan"
                    className="field-input"
                    value={catatan}
                    onChange={(event) => setCatatan(event.target.value)}
                    placeholder="Opsional"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!izinDipilih || catat.isPending}
                  onClick={() =>
                    izinDipilih &&
                    catat.mutate({ izinId: izinDipilih.id, arah, catatan: catatan.trim() || undefined })
                  }
                >
                  {arah === 'KELUAR' ? <DoorOpen className="h-4 w-4" aria-hidden /> : <DoorClosed className="h-4 w-4" aria-hidden />}
                  Catat {arah === 'KELUAR' ? 'Keluar' : 'Masuk'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">Status terakhir</h2>
          {hasil.data?.lintasanTerakhir ? (
            <div className="space-y-2 text-sm">
              <Info label="Santri" value={hasil.data.lintasanTerakhir.nama_lengkap ?? '-'} />
              <Info label="Arah" value={hasil.data.lintasanTerakhir.arah} />
              <Info label="Waktu" value={formatDateTime(hasil.data.lintasanTerakhir.waktu)} />
              <Info label="Catatan" value={hasil.data.lintasanTerakhir.catatan ?? '-'} />
            </div>
          ) : (
            <p className="text-sm text-slate-500">Pindai kartu untuk melihat lintasan terakhir santri.</p>
          )}
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={riwayat.data?.items ?? []}
        loading={riwayat.isLoading}
        error={riwayat.isError ? toMessage(riwayat.error, (_key, fallback) => fallback ?? 'Gagal memuat riwayat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void riwayat.refetch()}
        emptyTitle="Belum ada lintasan gerbang."
      />
      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
