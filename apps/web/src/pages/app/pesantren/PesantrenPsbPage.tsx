import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CheckCircle2, ClipboardCheck, MapPin, Plus, Trash2, UserRound, XCircle } from 'lucide-react';
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
  jalur_masuk: string | null;
  unit_pendidikan_tujuan_id: string | null;
  status: string;
  created_at: string;
}

interface JadwalRow extends Record<string, unknown> {
  id: string;
  pendaftar_id: string;
  jenis: string;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  lokasi: string | null;
  penguji: string | null;
  status: string;
  nilai: string | null;
  catatan_hasil: string | null;
  nomor_pendaftaran: string;
  nama_lengkap: string;
  status_pendaftar: string;
  gelombang_nama: string;
  unit_pendidikan_nama: string | null;
}

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  status: string;
}

interface UnitPendidikanRow {
  id: string;
  kode: string;
  nama: string;
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

type FieldTambahan = {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select';
  required: boolean;
  options: string;
};

const FIELD_TAMBAHAN_KOSONG: FieldTambahan = {
  name: '',
  label: '',
  type: 'text',
  required: false,
  options: '',
};

function fieldTambahanKeSchema(fields: FieldTambahan[]) {
  return fields
    .map((field) => ({
      name: field.name.trim(),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      options: field.options
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    }))
    .filter((field) => field.name && field.label)
    .map((field) => (field.type === 'select' ? field : { ...field, options: undefined }));
}

export function PesantrenPsbPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'gelombang' | 'pendaftar' | 'jadwal'>('gelombang');
  const [pageGelombang, setPageGelombang] = useState(1);
  const [pagePendaftar, setPagePendaftar] = useState(1);
  const [pageJadwal, setPageJadwal] = useState(1);
  const [statusGelombang, setStatusGelombang] = useState('');
  const [statusPendaftar, setStatusPendaftar] = useState('');
  const [statusJadwal, setStatusJadwal] = useState('');
  const [jenisJadwal, setJenisJadwal] = useState('');
  const [tanggalJadwal, setTanggalJadwal] = useState('');
  const [cariPendaftar, setCariPendaftar] = useState('');
  const [hasilJadwal, setHasilJadwal] = useState<Record<string, { nilai: string; catatanHasil: string }>>({});
  const [membuatGelombang, setMembuatGelombang] = useState(false);
  const [formGelombang, setFormGelombang] = useState(FORM_GELOMBANG_KOSONG);
  const [fieldTambahan, setFieldTambahan] = useState<FieldTambahan[]>([]);

  const tahunAjaran = useQuery({
    queryKey: ['pesantren-psb-tahun-ajaran'],
    queryFn: () => api.get<TahunAjaranRow[]>('/pesantren/nilai/tahun-ajaran'),
  });

  const unitPendidikan = useQuery({
    queryKey: ['pesantren-psb-unit-pendidikan'],
    queryFn: () => api.get<{ items: UnitPendidikanRow[]; total: number }>('/pesantren/unit-pendidikan?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });

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

  const jadwal = useQuery({
    queryKey: ['pesantren-psb-jadwal', pageJadwal, tanggalJadwal, jenisJadwal, statusJadwal],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(pageJadwal), ukuranHalaman: String(PAGE_SIZE) });
      if (tanggalJadwal) params.set('tanggal', tanggalJadwal);
      if (jenisJadwal) params.set('jenis', jenisJadwal);
      if (statusJadwal) params.set('status', statusJadwal);
      return api.get<{ items: JadwalRow[]; total: number }>(`/pesantren/psb/pendaftar/jadwal?${params.toString()}`);
    },
  });

  const buatGelombang = useMutation({
    mutationFn: () => {
      let formSchema: unknown[] = fieldTambahanKeSchema(fieldTambahan);
      if (formGelombang.formSchema.trim()) {
        const parsed = JSON.parse(formGelombang.formSchema) as unknown;
        formSchema = Array.isArray(parsed) ? parsed : [];
      }
      return api.post<GelombangRow>('/pesantren/psb/gelombang', {
        tahunAjaranId: formGelombang.tahunAjaranId || tahunAktif?.id,
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
      setFieldTambahan([]);
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

  const catatHasilJadwal = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'SELESAI' | 'TIDAK_HADIR' | 'DIBATALKAN' }) => {
      const hasil = hasilJadwal[id] ?? { nilai: '', catatanHasil: '' };
      return api.post<JadwalRow>(`/pesantren/psb/pendaftar/jadwal/${id}/hasil`, {
        status,
        nilai: hasil.nilai ? Number(hasil.nilai) : undefined,
        catatanHasil: hasil.catatanHasil.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.push('Hasil jadwal PSB tercatat.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-jadwal'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-pendaftar'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat hasil jadwal.'), 'error'),
  });

  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const namaTahun = useMemo(() => new Map((tahunAjaran.data ?? []).map((item) => [item.id, `${item.code} - ${item.name}`])), [tahunAjaran.data]);
  const namaUnit = useMemo(() => new Map((unitPendidikan.data?.items ?? []).map((item) => [item.id, `${item.kode} - ${item.nama}`])), [unitPendidikan.data]);

  const gelombangColumns: Array<GridColumn<GelombangRow>> = [
    { key: 'kode', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'tahun_ajaran_id', header: 'Tahun Ajaran', render: (row) => namaTahun.get(row.tahun_ajaran_id) ?? row.tahun_ajaran_id },
    { key: 'unit_pendidikan_id', header: 'Unit', render: (row) => (row.unit_pendidikan_id ? namaUnit.get(row.unit_pendidikan_id) ?? row.unit_pendidikan_id : 'Lintas unit') },
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
    { key: 'jalur_masuk', header: 'Jalur', render: (row) => row.jalur_masuk ?? 'REGULER' },
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
  const totalJadwal = jadwal.data?.total ?? 0;
  const jadwalHariIni = (jadwal.data?.items ?? []).filter((item) => item.tanggal === new Date().toISOString().slice(0, 10)).length;
  const jadwalBelumSelesai = (jadwal.data?.items ?? []).filter((item) => item.status === 'DIJADWALKAN').length;

  const jadwalColumns: Array<GridColumn<JadwalRow>> = [
    {
      key: 'tanggal',
      header: 'Waktu',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{formatDate(row.tanggal)}</p>
          <p className="text-xs text-slate-500">{[row.waktu_mulai, row.waktu_selesai].filter(Boolean).join(' - ') || 'Jam belum diisi'}</p>
        </div>
      ),
    },
    {
      key: 'nama_lengkap',
      header: 'Pendaftar',
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{row.nama_lengkap}</p>
          <p className="text-xs text-slate-500">{row.nomor_pendaftaran}</p>
        </div>
      ),
    },
    { key: 'jenis', header: 'Jenis', render: (row) => <StatusBadge status={row.jenis} /> },
    { key: 'lokasi', header: 'Ruang/Lokasi', render: (row) => row.lokasi ?? '-' },
    { key: 'penguji', header: 'Penguji', render: (row) => row.penguji ?? '-' },
    { key: 'unit_pendidikan_nama', header: 'Unit', render: (row) => row.unit_pendidikan_nama ?? 'Lintas unit' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'nilai',
      header: 'Hasil',
      render: (row) => (
        <div className="min-w-[220px] space-y-2">
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <input
              className="field-input h-9 px-2 py-1 text-xs"
              type="number"
              min="0"
              max="100"
              placeholder="Nilai"
              value={hasilJadwal[row.id]?.nilai ?? row.nilai ?? ''}
              onChange={(event) => setHasilJadwal((current) => ({ ...current, [row.id]: { ...(current[row.id] ?? { catatanHasil: row.catatan_hasil ?? '' }), nilai: event.target.value } }))}
            />
            <input
              className="field-input h-9 px-2 py-1 text-xs"
              placeholder="Catatan"
              value={hasilJadwal[row.id]?.catatanHasil ?? row.catatan_hasil ?? ''}
              onChange={(event) => setHasilJadwal((current) => ({ ...current, [row.id]: { ...(current[row.id] ?? { nilai: row.nilai ?? '' }), catatanHasil: event.target.value } }))}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusAction label="Selesai" onClick={() => catatHasilJadwal.mutate({ id: row.id, status: 'SELESAI' })} />
            <StatusAction label="Tidak hadir" onClick={() => catatHasilJadwal.mutate({ id: row.id, status: 'TIDAK_HADIR' })} />
          </div>
        </div>
      ),
    },
  ];

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

      <div className="mb-4 flex flex-wrap gap-2">
        <button type="button" className={tab === 'gelombang' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('gelombang')}>
          Gelombang
        </button>
        <button type="button" className={tab === 'pendaftar' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('pendaftar')}>
          Pendaftar
        </button>
        <button type="button" className={tab === 'jadwal' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('jadwal')}>
          Jadwal Seleksi
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
      ) : tab === 'pendaftar' ? (
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
      ) : (
        <>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <PsbMetric icon={<CalendarClock className="h-4 w-4" aria-hidden />} label="Agenda halaman ini" value={jadwal.data?.items.length ?? 0} />
            <PsbMetric icon={<ClipboardCheck className="h-4 w-4" aria-hidden />} label="Belum selesai" value={jadwalBelumSelesai} />
            <PsbMetric icon={<MapPin className="h-4 w-4" aria-hidden />} label="Jadwal hari ini" value={jadwalHariIni} />
            <PsbMetric icon={<UserRound className="h-4 w-4" aria-hidden />} label="Total agenda" value={totalJadwal} />
          </div>
          <div className="card mb-4 p-4">
            <div className="grid gap-3 md:grid-cols-[180px_180px_180px_auto]">
              <Field label="Tanggal">
                <input
                  type="date"
                  className="field-input"
                  value={tanggalJadwal}
                  onChange={(event) => {
                    setTanggalJadwal(event.target.value);
                    setPageJadwal(1);
                  }}
                />
              </Field>
              <Field label="Jenis seleksi">
                <select
                  className="field-input"
                  value={jenisJadwal}
                  onChange={(event) => {
                    setJenisJadwal(event.target.value);
                    setPageJadwal(1);
                  }}
                >
                  <option value="">Semua</option>
                  {['UJIAN_TULIS', 'TES_BACA_QURAN', 'WAWANCARA', 'TES_KESEHATAN', 'LAINNYA'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Status jadwal">
                <select
                  className="field-input"
                  value={statusJadwal}
                  onChange={(event) => {
                    setStatusJadwal(event.target.value);
                    setPageJadwal(1);
                  }}
                >
                  <option value="">Semua</option>
                  {['DIJADWALKAN', 'SELESAI', 'TIDAK_HADIR', 'DIBATALKAN'].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-outline w-full justify-center"
                  onClick={() => {
                    setTanggalJadwal('');
                    setJenisJadwal('');
                    setStatusJadwal('');
                    setPageJadwal(1);
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <DataGrid
            columns={jadwalColumns}
            rows={jadwal.data?.items ?? []}
            loading={jadwal.isLoading}
            error={jadwal.isError ? toMessage(jadwal.error, (_key, fallback) => fallback ?? 'Gagal memuat jadwal PSB.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void jadwal.refetch()}
            emptyTitle="Belum ada jadwal seleksi."
          />
          <Pagination page={pageJadwal} totalPages={Math.max(1, Math.ceil(totalJadwal / PAGE_SIZE))} total={totalJadwal} onChange={setPageJadwal} />
        </>
      )}

      {membuatGelombang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[88vh] w-full max-w-xl overflow-y-auto p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Gelombang Penerimaan</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">Buat Gelombang PSB</h2>
                <p className="mt-1 text-sm text-slate-500">Atur periode, kuota, biaya, dan formulir tambahan tanpa mengisi ID teknis.</p>
              </div>
              {tahunAktif && <StatusBadge status={`TA ${tahunAktif.code}`} />}
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <TahunAjaranSelect value={formGelombang.tahunAjaranId || tahunAktif?.id || ''} tahunAjaran={tahunAjaran.data ?? []} onChange={(value) => setFormGelombang({ ...formGelombang, tahunAjaranId: value })} />
                <UnitPendidikanSelect value={formGelombang.unitPendidikanId} units={unitPendidikan.data?.items ?? []} onChange={(value) => setFormGelombang({ ...formGelombang, unitPendidikanId: value })} />
              </div>
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
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Builder field tambahan</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Tambahkan pertanyaan khusus gelombang tanpa menulis JSON manual.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline px-3 py-2 text-xs"
                    onClick={() => setFieldTambahan((items) => [...items, { ...FIELD_TAMBAHAN_KOSONG }])}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                    Field
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  {fieldTambahan.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950">
                      Belum ada field tambahan. Formulir publik tetap memakai field standar PSB.
                    </p>
                  ) : (
                    fieldTambahan.map((field, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_130px_auto]">
                          <input
                            className="field-input"
                            placeholder="namaField"
                            value={field.name}
                            onChange={(e) =>
                              setFieldTambahan((items) => items.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))
                            }
                          />
                          <input
                            className="field-input"
                            placeholder="Label pertanyaan"
                            value={field.label}
                            onChange={(e) =>
                              setFieldTambahan((items) => items.map((item, i) => (i === index ? { ...item, label: e.target.value } : item)))
                            }
                          />
                          <select
                            className="field-input"
                            value={field.type}
                            onChange={(e) =>
                              setFieldTambahan((items) =>
                                items.map((item, i) => (i === index ? { ...item, type: e.target.value as FieldTambahan['type'] } : item)),
                              )
                            }
                          >
                            <option value="text">Teks</option>
                            <option value="textarea">Paragraf</option>
                            <option value="number">Angka</option>
                            <option value="date">Tanggal</option>
                            <option value="select">Pilihan</option>
                          </select>
                          <button
                            type="button"
                            className="btn-outline px-2"
                            aria-label="Hapus field"
                            onClick={() => setFieldTambahan((items) => items.filter((_, i) => i !== index))}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) =>
                              setFieldTambahan((items) => items.map((item, i) => (i === index ? { ...item, required: e.target.checked } : item)))
                            }
                          />
                          Wajib diisi
                        </label>
                        {field.type === 'select' && (
                          <textarea
                            className="field-input mt-3 min-h-20 text-xs"
                            placeholder="Satu pilihan per baris"
                            value={field.options}
                            onChange={(e) =>
                              setFieldTambahan((items) => items.map((item, i) => (i === index ? { ...item, options: e.target.value } : item)))
                            }
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Field label="Field formulir tambahan (JSON array, opsional untuk impor lanjutan)">
                <textarea
                  className="field-input min-h-28 font-mono text-xs"
                  value={formGelombang.formSchema || JSON.stringify(fieldTambahanKeSchema(fieldTambahan), null, 2)}
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
                disabled={!(formGelombang.tahunAjaranId || tahunAktif?.id) || !formGelombang.kode || !formGelombang.nama || !formGelombang.tanggalBuka || !formGelombang.tanggalTutup || buatGelombang.isPending}
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

function PsbMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{icon}</span>
      <span>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-xl font-semibold text-slate-900 dark:text-white">{value}</p>
      </span>
    </div>
  );
}

function StatusAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={onClick}>
      {label}
    </button>
  );
}

function TahunAjaranSelect({
  value,
  tahunAjaran,
  onChange,
}: {
  value: string;
  tahunAjaran: TahunAjaranRow[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Tahun ajaran *">
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Pilih tahun ajaran</option>
        {tahunAjaran.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} - {item.name}{item.status === 'ACTIVE' ? ' (aktif)' : ''}
          </option>
        ))}
      </select>
    </Field>
  );
}

function UnitPendidikanSelect({
  value,
  units,
  onChange,
}: {
  value: string;
  units: UnitPendidikanRow[];
  onChange: (value: string) => void;
}) {
  return (
    <Field label="Unit pendidikan">
      <select className="field-input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Lintas semua unit</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.kode} - {unit.nama}
          </option>
        ))}
      </select>
    </Field>
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
