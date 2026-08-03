import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, RefreshCw, Save } from 'lucide-react';
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

interface JadwalRow {
  id: string;
  rombongan_id: string;
  mata_pelajaran_id: string;
  hari: string;
  waktu_mulai: string;
  waktu_selesai: string;
  ruangan: string | null;
}

interface RombonganRow {
  id: string;
  tingkat: string;
  nama: string;
}

interface MataPelajaranRow {
  id: string;
  code: string;
  nama: string;
}

interface AnggotaRombonganRow {
  santri_id: string;
  nis?: string;
  nama_lengkap?: string;
  status: string;
}

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ['HADIR', 'IZIN', 'SAKIT', 'ALPA'];
const JENIS_OPTIONS = ['HARIAN', 'SHALAT_SUBUH', 'SHALAT_DHUHUR', 'SHALAT_ASHAR', 'SHALAT_MAGHRIB', 'SHALAT_ISYA', 'KEGIATAN'];
const HARI_DARI_DATE = ['AHAD', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];

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
  const [modeJadwal, setModeJadwal] = useState(false);
  const [jadwalId, setJadwalId] = useState('');
  const [cari, setCari] = useState('');
  const [draft, setDraft] = useState<Record<string, { status: string; keterangan: string }>>({});

  const hariTanggal = useMemo(() => HARI_DARI_DATE[new Date(`${tanggal}T00:00:00`).getDay()] ?? 'SENIN', [tanggal]);

  const santri = useQuery({
    queryKey: ['pesantren-presensi-santri', page, cari],
    queryFn: () => {
      const params = new URLSearchParams({ status: 'AKTIF', halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (cari.trim()) params.set('cari', cari.trim());
      return api.get<{ items: SantriRow[]; total: number }>(`/pesantren/santri?${params.toString()}`);
    },
  });

  const jadwal = useQuery({
    queryKey: ['pesantren-presensi-jadwal', hariTanggal],
    queryFn: () => api.get<JadwalRow[]>(`/pesantren/kurikulum/jadwal?hari=${hariTanggal}`),
  });

  const rombongan = useQuery({
    queryKey: ['pesantren-presensi-rombongan'],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>('/pesantren/rombongan?halaman=1&ukuranHalaman=100'),
  });

  const mapel = useQuery({
    queryKey: ['pesantren-presensi-mapel'],
    queryFn: () => api.get<MataPelajaranRow[]>('/pesantren/nilai/mata-pelajaran'),
  });

  const jadwalAktif = (jadwal.data ?? []).find((item) => item.id === jadwalId) ?? null;
  const anggotaRombongan = useQuery({
    queryKey: ['pesantren-presensi-anggota-rombongan', jadwalAktif?.rombongan_id],
    enabled: modeJadwal && Boolean(jadwalAktif?.rombongan_id),
    queryFn: () => api.get<AnggotaRombonganRow[]>(`/pesantren/rombongan/${jadwalAktif!.rombongan_id}/anggota`),
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
      const rows = rowsPresensi;
      const keteranganJadwal = jadwalAktif ? labelJadwal(jadwalAktif, namaRombongan, namaMapel) : '';
      return api.post('/pesantren/presensi/massal', {
        tanggal,
        jenis,
        items: rows.map((row) => {
          const nilai = draft[row.id] ?? {
            status: presensiBySantri.get(row.id)?.status ?? 'HADIR',
            keterangan: presensiBySantri.get(row.id)?.keterangan ?? keteranganJadwal,
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

  const namaRombongan = useMemo(() => new Map((rombongan.data?.items ?? []).map((item) => [item.id, `${item.tingkat} ${item.nama}`])), [rombongan.data?.items]);
  const namaMapel = useMemo(() => new Map((mapel.data ?? []).map((item) => [item.id, item.nama])), [mapel.data]);

  const rowsPresensi = useMemo<SantriRow[]>(() => {
    if (!modeJadwal) return santri.data?.items ?? [];
    return (anggotaRombongan.data ?? [])
      .filter((row) => row.status === 'AKTIF')
      .map((row) => ({
        id: row.santri_id,
        nis: row.nis ?? '-',
        nama_lengkap: row.nama_lengkap ?? row.santri_id,
        status: row.status,
      }));
  }, [anggotaRombongan.data, modeJadwal, santri.data?.items]);

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
  const jadwalTerpilih = jadwalAktif ? labelJadwal(jadwalAktif, namaRombongan, namaMapel) : '';

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
            <button type="button" className="btn-primary" disabled={simpan.isPending || !rowsPresensi.length} onClick={() => simpan.mutate()}>
              <Save className="h-4 w-4" aria-hidden />
              Simpan
            </button>
          </>
        }
      />

      <div className="card mb-4 p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={modeJadwal ? 'btn-outline' : 'btn-primary'}
            onClick={() => {
              setModeJadwal(false);
              setJadwalId('');
            }}
          >
            Manual
          </button>
          <button
            type="button"
            className={modeJadwal ? 'btn-primary' : 'btn-outline'}
            onClick={() => {
              setModeJadwal(true);
              setJenis('KEGIATAN');
            }}
          >
            <CalendarCheck className="h-4 w-4" aria-hidden />
            Jadwal Pelajaran
          </button>
        </div>

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
        {modeJadwal && (
          <div className="mt-3">
            <label className="field-label" htmlFor="presensi-jadwal">Jadwal {hariTanggal}</label>
            <select
              id="presensi-jadwal"
              className="field-input"
              value={jadwalId}
              onChange={(e) => {
                setJadwalId(e.target.value);
                setDraft({});
                setPage(1);
              }}
            >
              <option value="">Pilih jadwal pelajaran</option>
              {(jadwal.data ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {labelJadwal(item, namaRombongan, namaMapel)}
                </option>
              ))}
            </select>
            {jadwalTerpilih && <p className="mt-2 text-sm text-slate-500">Keterangan awal: {jadwalTerpilih}</p>}
          </div>
        )}
        <p className="mt-3 text-sm text-slate-500">Data tersimpan untuk {formatDate(tanggal)} akan otomatis menjadi nilai awal di tabel.</p>
      </div>

      <DataGrid
        columns={columns}
        rows={rowsPresensi}
        loading={(modeJadwal ? anggotaRombongan.isLoading || jadwal.isLoading : santri.isLoading) || riwayat.isLoading}
        error={
          santri.isError
            ? toMessage(santri.error, (_key, fallback) => fallback ?? 'Gagal memuat santri.')
            : anggotaRombongan.isError
              ? toMessage(anggotaRombongan.error, (_key, fallback) => fallback ?? 'Gagal memuat anggota rombongan.')
              : undefined
        }
        rowKey={(row) => row.id}
        onRetry={() => void santri.refetch()}
        emptyTitle={modeJadwal && !jadwalId ? 'Pilih jadwal pelajaran lebih dulu.' : 'Belum ada santri aktif.'}
      />
      {!modeJadwal && <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />}
    </>
  );
}

function labelJadwal(jadwal: JadwalRow, rombongan: Map<string, string>, mapel: Map<string, string>) {
  const kelas = rombongan.get(jadwal.rombongan_id) ?? jadwal.rombongan_id;
  const pelajaran = mapel.get(jadwal.mata_pelajaran_id) ?? jadwal.mata_pelajaran_id;
  const ruang = jadwal.ruangan ? `, ${jadwal.ruangan}` : '';
  return `${jadwal.waktu_mulai}-${jadwal.waktu_selesai} | ${kelas} | ${pelajaran}${ruang}`;
}
