import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Save } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface SantriRow extends Record<string, unknown> {
  id: string;
  nis: string;
  nama_lengkap: string;
  status: string;
}

interface PresensiRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  tanggal: string;
  jenis: string;
  status: string;
  keterangan: string | null;
}

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'];
const JENIS_OPTIONS = ['HARIAN', 'SHALAT_SUBUH', 'SHALAT_DHUHUR', 'SHALAT_ASHAR', 'SHALAT_MAGHRIB', 'SHALAT_ISYA', 'KEGIATAN'];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenPresensiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [tanggal, setTanggal] = useState(today());
  const [jenis, setJenis] = useState('HARIAN');
  const [cari, setCari] = useState('');
  const [draft, setDraft] = useState<Record<string, { status: string; keterangan: string }>>({});

  const santri = useQuery({
    queryKey: ['pesantren-presensi-santri', page, cari],
    queryFn: () => {
      const params = new URLSearchParams({ status: 'AKTIF', halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (cari.trim()) params.set('cari', cari.trim());
      return api.get<{ items: SantriRow[]; total: number }>(`/pesantren/santri?${params.toString()}`);
    },
  });

  const riwayat = useQuery({
    queryKey: ['pesantren-presensi-riwayat', tanggal, jenis],
    queryFn: () => {
      const params = new URLSearchParams({ tanggal, jenis, halaman: '1', ukuranHalaman: '100' });
      return api.get<{ items: PresensiRow[]; total: number }>(`/pesantren/presensi?${params.toString()}`);
    },
  });

  const presensiBySantri = useMemo(() => {
    const map = new Map<string, PresensiRow>();
    for (const item of riwayat.data?.items ?? []) map.set(item.santri_id, item);
    return map;
  }, [riwayat.data?.items]);

  const simpan = useMutation({
    mutationFn: () => {
      const rows = santri.data?.items ?? [];
      return api.post('/pesantren/presensi/massal', {
        tanggal,
        jenis,
        items: rows.map((row) => {
          const nilai = draft[row.id] ?? {
            status: presensiBySantri.get(row.id)?.status ?? 'HADIR',
            keterangan: presensiBySantri.get(row.id)?.keterangan ?? '',
          };
          return {
            santriId: row.id,
            status: nilai.status,
            keterangan: nilai.keterangan.trim() || undefined,
          };
        }),
      });
    },
    onSuccess: () => {
      toast.push('Presensi massal tersimpan.', 'success');
      setDraft({});
      void queryClient.invalidateQueries({ queryKey: ['pesantren-presensi-riwayat'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan presensi.'), 'error'),
  });

  const columns: Array<GridColumn<SantriRow>> = [
    { key: 'nis', header: 'NIS' },
    { key: 'nama_lengkap', header: 'Santri' },
    {
      key: 'status',
      header: 'Status Presensi',
      render: (row) => {
        const value = draft[row.id]?.status ?? presensiBySantri.get(row.id)?.status ?? 'HADIR';
        return (
          <select
            className="field-input min-w-[130px]"
            value={value}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                [row.id]: { status: event.target.value, keterangan: current[row.id]?.keterangan ?? presensiBySantri.get(row.id)?.keterangan ?? '' },
              }))
            }
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'keterangan',
      header: 'Keterangan',
      render: (row) => (
        <input
          className="field-input min-w-[220px]"
          value={draft[row.id]?.keterangan ?? presensiBySantri.get(row.id)?.keterangan ?? ''}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              [row.id]: { status: current[row.id]?.status ?? presensiBySantri.get(row.id)?.status ?? 'HADIR', keterangan: event.target.value },
            }))
          }
          placeholder="Opsional"
        />
      ),
    },
    {
      key: 'tersimpan',
      header: 'Tersimpan',
      render: (row) => (presensiBySantri.has(row.id) ? <StatusBadge status="YA" /> : <StatusBadge status="BELUM" />),
    },
  ];

  const total = santri.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Presensi Santri"
        description="Input presensi manual massal per tanggal dan jenis kegiatan. Scan/fingerprint nanti memakai endpoint yang sama."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Presensi' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => void santri.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
            <button type="button" className="btn-primary" disabled={simpan.isPending || !(santri.data?.items.length)} onClick={() => simpan.mutate()}>
              <Save className="h-4 w-4" aria-hidden />
              Simpan
            </button>
          </>
        }
      />

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[180px_220px_minmax(220px,1fr)]">
          <div>
            <label className="field-label" htmlFor="presensi-tanggal">Tanggal</label>
            <input id="presensi-tanggal" type="date" className="field-input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="presensi-jenis">Jenis</label>
            <select id="presensi-jenis" className="field-input" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {JENIS_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="presensi-cari">Cari santri</label>
            <input
              id="presensi-cari"
              className="field-input"
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setPage(1);
              }}
              placeholder="Nama atau NIS"
            />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">Data tersimpan untuk {formatDate(tanggal)} akan otomatis menjadi nilai awal di tabel.</p>
      </div>

      <DataGrid
        columns={columns}
        rows={santri.data?.items ?? []}
        loading={santri.isLoading || riwayat.isLoading}
        error={santri.isError ? toMessage(santri.error, (_key, fallback) => fallback ?? 'Gagal memuat santri.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void santri.refetch()}
        emptyTitle="Belum ada santri aktif."
      />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />
    </>
  );
}
