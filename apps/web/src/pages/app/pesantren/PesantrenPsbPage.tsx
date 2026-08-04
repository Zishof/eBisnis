import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, CalendarDays, CheckCircle2, GripVertical, Plus, Save, Trash2, XCircle } from 'lucide-react';
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

interface JadwalPsbRow {
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

const LABEL_TIPE_FIELD: Record<FieldTambahan['type'], string> = {
  text: 'Teks singkat',
  textarea: 'Paragraf',
  number: 'Angka',
  date: 'Tanggal',
  select: 'Pilihan',
};

const FORM_JADWAL_KOSONG = {
  jenis: 'UJIAN_TULIS',
  tanggal: '',
  waktuMulai: '',
  waktuSelesai: '',
  lokasi: '',
  penguji: '',
};

const FORM_HASIL_JADWAL_KOSONG = {
  status: 'SELESAI',
  nilai: '',
  catatanHasil: '',
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
  const [tab, setTab] = useState<'gelombang' | 'pendaftar'>('gelombang');
  const [pageGelombang, setPageGelombang] = useState(1);
  const [pagePendaftar, setPagePendaftar] = useState(1);
  const [statusGelombang, setStatusGelombang] = useState('');
  const [statusPendaftar, setStatusPendaftar] = useState('');
  const [cariPendaftar, setCariPendaftar] = useState('');
  const [membuatGelombang, setMembuatGelombang] = useState(false);
  const [formGelombang, setFormGelombang] = useState(FORM_GELOMBANG_KOSONG);
  const [fieldTambahan, setFieldTambahan] = useState<FieldTambahan[]>([]);
  const [fieldYangDitarik, setFieldYangDitarik] = useState<number | null>(null);
  const [pendaftarTerpilih, setPendaftarTerpilih] = useState<PendaftarRow | null>(null);
  const [formJadwal, setFormJadwal] = useState(FORM_JADWAL_KOSONG);
  const [jadwalHasilId, setJadwalHasilId] = useState('');
  const [formHasilJadwal, setFormHasilJadwal] = useState(FORM_HASIL_JADWAL_KOSONG);

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

  const jadwalPendaftar = useQuery({
    queryKey: ['pesantren-psb-jadwal', pendaftarTerpilih?.id],
    enabled: Boolean(pendaftarTerpilih?.id),
    queryFn: () => api.get<JadwalPsbRow[]>(`/pesantren/psb/pendaftar/${pendaftarTerpilih!.id}/jadwal`),
  });

  const buatGelombang = useMutation({
    mutationFn: () => {
      let formSchema: unknown[] = fieldTambahanKeSchema(fieldTambahan);
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

  const tambahJadwal = useMutation({
    mutationFn: () =>
      api.post<JadwalPsbRow>(`/pesantren/psb/pendaftar/${pendaftarTerpilih!.id}/jadwal`, {
        jenis: formJadwal.jenis,
        tanggal: formJadwal.tanggal,
        waktuMulai: formJadwal.waktuMulai || undefined,
        waktuSelesai: formJadwal.waktuSelesai || undefined,
        lokasi: formJadwal.lokasi || undefined,
        penguji: formJadwal.penguji || undefined,
      }),
    onSuccess: () => {
      toast.push('Jadwal seleksi tersimpan.', 'success');
      setFormJadwal(FORM_JADWAL_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-jadwal', pendaftarTerpilih?.id] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-pendaftar'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan jadwal.'), 'error'),
  });

  const simpanHasilJadwal = useMutation({
    mutationFn: () =>
      api.post<JadwalPsbRow>(`/pesantren/psb/jadwal/${jadwalHasilId}/hasil`, {
        status: formHasilJadwal.status,
        nilai: formHasilJadwal.nilai ? Number(formHasilJadwal.nilai) : undefined,
        catatanHasil: formHasilJadwal.catatanHasil || undefined,
      }),
    onSuccess: () => {
      toast.push('Hasil seleksi tersimpan.', 'success');
      setJadwalHasilId('');
      setFormHasilJadwal(FORM_HASIL_JADWAL_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-psb-jadwal', pendaftarTerpilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan hasil seleksi.'), 'error'),
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
          <button
            type="button"
            className="btn-outline px-2 py-1.5 text-xs"
            onClick={() => {
              setPendaftarTerpilih(row);
              setFormJadwal(FORM_JADWAL_KOSONG);
              setJadwalHasilId('');
              setFormHasilJadwal(FORM_HASIL_JADWAL_KOSONG);
            }}
          >
            <CalendarDays className="h-4 w-4" aria-hidden />
            Jadwal
          </button>
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
  const schemaPreview = fieldTambahanKeSchema(fieldTambahan);

  function ubahFieldTambahan(index: number, patch: Partial<FieldTambahan>) {
    setFieldTambahan((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
    setFormGelombang((sebelumnya) => (sebelumnya.formSchema ? { ...sebelumnya, formSchema: '' } : sebelumnya));
  }

  function pindahFieldTambahan(index: number, arah: -1 | 1) {
    pindahFieldTambahanKeIndex(index, index + arah);
  }

  function pindahFieldTambahanKeIndex(indexAsal: number, indexTujuan: number) {
    setFieldTambahan((items) => {
      if (indexTujuan < 0 || indexTujuan >= items.length || indexAsal === indexTujuan) return items;
      const salinan = [...items];
      const [dipindah] = salinan.splice(indexAsal, 1);
      salinan.splice(indexTujuan, 0, dipindah);
      return salinan;
    });
    setFormGelombang((sebelumnya) => (sebelumnya.formSchema ? { ...sebelumnya, formSchema: '' } : sebelumnya));
  }

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

      {pendaftarTerpilih && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[88vh] w-full max-w-5xl overflow-y-auto p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Jadwal Seleksi PSB</p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{pendaftarTerpilih.nama_lengkap}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pendaftarTerpilih.nomor_pendaftaran} - {pendaftarTerpilih.status}
                </p>
              </div>
              <button type="button" className="btn-outline" onClick={() => setPendaftarTerpilih(null)}>
                Tutup
              </button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
                <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Riwayat ujian dan wawancara</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Pendaftar dapat punya lebih dari satu sesi. Status SELESAI menjadi syarat sebelum diluluskan.
                  </p>
                </div>
                {jadwalPendaftar.isLoading ? (
                  <p className="p-4 text-sm text-slate-500">Memuat jadwal...</p>
                ) : jadwalPendaftar.isError ? (
                  <p className="p-4 text-sm text-rose-600">
                    {toMessage(jadwalPendaftar.error, (_key, fallback) => fallback ?? 'Gagal memuat jadwal.')}
                  </p>
                ) : (jadwalPendaftar.data ?? []).length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">Belum ada jadwal seleksi untuk pendaftar ini.</p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(jadwalPendaftar.data ?? []).map((item) => (
                      <article key={item.id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={item.jenis} />
                            <StatusBadge status={item.status} />
                            {item.nilai && <StatusBadge status={`Nilai ${item.nilai}`} />}
                          </div>
                          <h4 className="mt-2 font-semibold text-slate-900 dark:text-white">
                            {formatDate(item.tanggal)}
                            {item.waktu_mulai ? `, ${item.waktu_mulai}${item.waktu_selesai ? `-${item.waktu_selesai}` : ''}` : ''}
                          </h4>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {item.lokasi || 'Lokasi belum diisi'} {item.penguji ? `- ${item.penguji}` : ''}
                          </p>
                          {item.catatan_hasil && <p className="mt-2 text-sm text-slate-500">{item.catatan_hasil}</p>}
                        </div>
                        <div className="flex items-start justify-end">
                          <button
                            type="button"
                            className="btn-outline text-xs"
                            onClick={() => {
                              setJadwalHasilId(item.id);
                              setFormHasilJadwal({
                                status: item.status === 'DIJADWALKAN' ? 'SELESAI' : item.status,
                                nilai: item.nilai ?? '',
                                catatanHasil: item.catatan_hasil ?? '',
                              });
                            }}
                          >
                            Catat hasil
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="space-y-4">
                <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  <h3 className="font-semibold text-slate-900 dark:text-white">Tambah jadwal</h3>
                  <div className="mt-3 space-y-3">
                    <Field label="Jenis">
                      <select className="field-input" value={formJadwal.jenis} onChange={(e) => setFormJadwal({ ...formJadwal, jenis: e.target.value })}>
                        <option value="UJIAN_TULIS">Ujian tulis</option>
                        <option value="TES_BACA_QURAN">Tes baca Quran</option>
                        <option value="WAWANCARA">Wawancara</option>
                        <option value="TES_KESEHATAN">Tes kesehatan</option>
                        <option value="LAINNYA">Lainnya</option>
                      </select>
                    </Field>
                    <Field label="Tanggal *">
                      <input type="date" className="field-input" value={formJadwal.tanggal} onChange={(e) => setFormJadwal({ ...formJadwal, tanggal: e.target.value })} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Mulai">
                        <input type="time" className="field-input" value={formJadwal.waktuMulai} onChange={(e) => setFormJadwal({ ...formJadwal, waktuMulai: e.target.value })} />
                      </Field>
                      <Field label="Selesai">
                        <input type="time" className="field-input" value={formJadwal.waktuSelesai} onChange={(e) => setFormJadwal({ ...formJadwal, waktuSelesai: e.target.value })} />
                      </Field>
                    </div>
                    <Field label="Lokasi">
                      <input className="field-input" value={formJadwal.lokasi} onChange={(e) => setFormJadwal({ ...formJadwal, lokasi: e.target.value })} />
                    </Field>
                    <Field label="Penguji">
                      <input className="field-input" value={formJadwal.penguji} onChange={(e) => setFormJadwal({ ...formJadwal, penguji: e.target.value })} />
                    </Field>
                    <button
                      type="button"
                      className="btn-primary w-full"
                      disabled={!formJadwal.tanggal || tambahJadwal.isPending}
                      onClick={() => tambahJadwal.mutate()}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Simpan Jadwal
                    </button>
                  </div>
                </section>

                {jadwalHasilId && (
                  <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Catat hasil seleksi</h3>
                    <div className="mt-3 space-y-3">
                      <Field label="Status hasil">
                        <select className="field-input" value={formHasilJadwal.status} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, status: e.target.value })}>
                          <option value="DIJADWALKAN">Dijadwalkan</option>
                          <option value="SELESAI">Selesai</option>
                          <option value="TIDAK_HADIR">Tidak hadir</option>
                          <option value="DIBATALKAN">Dibatalkan</option>
                        </select>
                      </Field>
                      <Field label="Nilai">
                        <input type="number" min="0" max="100" className="field-input" value={formHasilJadwal.nilai} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, nilai: e.target.value })} />
                      </Field>
                      <Field label="Catatan hasil">
                        <textarea className="field-input min-h-24" value={formHasilJadwal.catatanHasil} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, catatanHasil: e.target.value })} />
                      </Field>
                      <div className="flex gap-2">
                        <button type="button" className="btn-outline flex-1" onClick={() => setJadwalHasilId('')}>
                          Batal
                        </button>
                        <button type="button" className="btn-primary flex-1" disabled={simpanHasilJadwal.isPending} onClick={() => simpanHasilJadwal.mutate()}>
                          <Save className="h-4 w-4" aria-hidden />
                          Simpan
                        </button>
                      </div>
                    </div>
                  </section>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}

      {membuatGelombang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[88vh] w-full max-w-5xl overflow-y-auto p-6">
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
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Builder field tambahan</h3>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Tambahkan pertanyaan khusus gelombang tanpa menulis JSON manual. Tarik pegangan field untuk mengubah urutan, atau pakai tombol naik/turun.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-outline min-h-11 px-3 py-2 text-xs"
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
                      <div
                        key={index}
                        className={`rounded-lg border bg-white p-3 transition dark:bg-slate-950 ${
                          fieldYangDitarik === index
                            ? 'border-emerald-300 opacity-60 ring-2 ring-emerald-200 dark:border-emerald-700 dark:ring-emerald-900'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.preventDefault();
                          const asal = Number(event.dataTransfer.getData('text/plain'));
                          if (Number.isInteger(asal)) {
                            pindahFieldTambahanKeIndex(asal, index);
                          }
                          setFieldYangDitarik(null);
                        }}
                      >
                        <div className="grid gap-3 md:grid-cols-[44px_1fr_1fr_130px_auto]">
                          <button
                            type="button"
                            draggable
                            className="btn-outline min-h-11 cursor-grab px-2 active:cursor-grabbing"
                            aria-label={`Tarik field ${field.label || index + 1} untuk mengubah urutan`}
                            onDragStart={(event) => {
                              setFieldYangDitarik(index);
                              event.dataTransfer.effectAllowed = 'move';
                              event.dataTransfer.setData('text/plain', String(index));
                            }}
                            onDragEnd={() => setFieldYangDitarik(null)}
                          >
                            <GripVertical className="h-4 w-4" aria-hidden />
                          </button>
                          <input
                            className="field-input"
                            placeholder="namaField"
                            value={field.name}
                            onChange={(e) => ubahFieldTambahan(index, { name: e.target.value })}
                          />
                          <input
                            className="field-input"
                            placeholder="Label pertanyaan"
                            value={field.label}
                            onChange={(e) => ubahFieldTambahan(index, { label: e.target.value })}
                          />
                          <select
                            className="field-input"
                            value={field.type}
                            onChange={(e) => ubahFieldTambahan(index, { type: e.target.value as FieldTambahan['type'] })}
                          >
                            <option value="text">Teks</option>
                            <option value="textarea">Paragraf</option>
                            <option value="number">Angka</option>
                            <option value="date">Tanggal</option>
                            <option value="select">Pilihan</option>
                          </select>
                          <div className="flex gap-1">
                            <button type="button" className="btn-outline min-h-11 px-2" aria-label="Naikkan field" disabled={index === 0} onClick={() => pindahFieldTambahan(index, -1)}>
                              <ArrowUp className="h-4 w-4" aria-hidden />
                            </button>
                            <button type="button" className="btn-outline min-h-11 px-2" aria-label="Turunkan field" disabled={index === fieldTambahan.length - 1} onClick={() => pindahFieldTambahan(index, 1)}>
                              <ArrowDown className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className="btn-outline min-h-11 px-2"
                              aria-label="Hapus field"
                              onClick={() => setFieldTambahan((items) => items.filter((_, i) => i !== index))}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                        <label className="mt-3 flex min-h-11 items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => ubahFieldTambahan(index, { required: e.target.checked })}
                          />
                          Wajib diisi
                        </label>
                        {field.type === 'select' && (
                          <textarea
                            className="field-input mt-3 min-h-20 text-xs"
                            placeholder="Satu pilihan per baris"
                            value={field.options}
                            onChange={(e) => ubahFieldTambahan(index, { options: e.target.value })}
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-semibold text-slate-900 dark:text-white">Preview formulir publik</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Urutan di sini sama dengan yang akan dibaca calon santri saat mendaftar.
                </p>
                <div className="mt-4 space-y-3">
                  {schemaPreview.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
                      Belum ada field tambahan.
                    </p>
                  ) : (
                    schemaPreview.map((field) => (
                      <div key={field.name} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{field.label}</p>
                          {field.required && <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">Wajib</span>}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{LABEL_TIPE_FIELD[field.type as FieldTambahan['type']] ?? field.type}</p>
                        {field.type === 'select' && Array.isArray(field.options) && field.options.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {field.options.map((opsi) => (
                              <span key={opsi} className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                {opsi}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </aside>
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
                disabled={!formGelombang.tahunAjaranId || !formGelombang.kode || !formGelombang.nama || !formGelombang.tanggalBuka || !formGelombang.tanggalTutup || buatGelombang.isPending}
                onClick={() => buatGelombang.mutate()}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {false && pendaftarTerpilih && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[88vh] w-full max-w-5xl overflow-y-auto p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Jadwal seleksi PSB</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{pendaftarTerpilih?.nama_lengkap}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {pendaftarTerpilih?.nomor_pendaftaran} · {pendaftarTerpilih?.nama_orang_tua ?? 'Orang tua belum diisi'}
                </p>
              </div>
              <button type="button" className="btn-outline" onClick={() => setPendaftarTerpilih(null)}>
                Tutup
              </button>
            </div>

            <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-emerald-700" aria-hidden />
                <h3 className="font-semibold text-slate-900 dark:text-white">Tambah jadwal ujian/wawancara</h3>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Jenis">
                  <select className="field-input" value={formJadwal.jenis} onChange={(e) => setFormJadwal({ ...formJadwal, jenis: e.target.value })}>
                    <option value="UJIAN_TULIS">Ujian tulis</option>
                    <option value="TES_BACA_QURAN">Tes baca Quran</option>
                    <option value="WAWANCARA">Wawancara</option>
                    <option value="TES_KESEHATAN">Tes kesehatan</option>
                    <option value="LAINNYA">Lainnya</option>
                  </select>
                </Field>
                <Field label="Tanggal *">
                  <input type="date" className="field-input" value={formJadwal.tanggal} onChange={(e) => setFormJadwal({ ...formJadwal, tanggal: e.target.value })} />
                </Field>
                <Field label="Lokasi">
                  <input className="field-input" value={formJadwal.lokasi} onChange={(e) => setFormJadwal({ ...formJadwal, lokasi: e.target.value })} />
                </Field>
                <Field label="Mulai">
                  <input type="time" className="field-input" value={formJadwal.waktuMulai} onChange={(e) => setFormJadwal({ ...formJadwal, waktuMulai: e.target.value })} />
                </Field>
                <Field label="Selesai">
                  <input type="time" className="field-input" value={formJadwal.waktuSelesai} onChange={(e) => setFormJadwal({ ...formJadwal, waktuSelesai: e.target.value })} />
                </Field>
                <Field label="Penguji">
                  <input className="field-input" value={formJadwal.penguji} onChange={(e) => setFormJadwal({ ...formJadwal, penguji: e.target.value })} />
                </Field>
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!formJadwal.tanggal || tambahJadwal.isPending}
                  onClick={() => tambahJadwal.mutate()}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Simpan jadwal
                </button>
              </div>
            </section>

            <section className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                <h3 className="font-semibold text-slate-900 dark:text-white">Riwayat jadwal</h3>
                <div className="mt-3 space-y-3">
                  {jadwalPendaftar.isLoading ? (
                    <p className="text-sm text-slate-500">Memuat jadwal...</p>
                  ) : (jadwalPendaftar.data ?? []).length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500 dark:border-slate-700">
                      Belum ada jadwal seleksi.
                    </p>
                  ) : (
                    (jadwalPendaftar.data ?? []).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          jadwalHasilId === item.id
                            ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30'
                            : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-slate-800 dark:bg-slate-950'
                        }`}
                        onClick={() => {
                          setJadwalHasilId(item.id);
                          setFormHasilJadwal({
                            status: item.status === 'DIJADWALKAN' ? 'SELESAI' : item.status,
                            nilai: item.nilai ?? '',
                            catatanHasil: item.catatan_hasil ?? '',
                          });
                        }}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.jenis}</p>
                          <StatusBadge status={item.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                          {formatDate(item.tanggal)}
                          {item.waktu_mulai ? `, ${item.waktu_mulai}${item.waktu_selesai ? `-${item.waktu_selesai}` : ''}` : ''}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[item.lokasi, item.penguji].filter(Boolean).join(' · ') || 'Lokasi dan penguji belum diisi'}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Catat hasil</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Pilih satu jadwal di kiri, lalu simpan hasil ujian atau wawancara.
                </p>
                <div className="mt-4 space-y-3">
                  <Field label="Status">
                    <select className="field-input" value={formHasilJadwal.status} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, status: e.target.value })}>
                      <option value="SELESAI">Selesai</option>
                      <option value="TIDAK_HADIR">Tidak hadir</option>
                      <option value="DIBATALKAN">Dibatalkan</option>
                    </select>
                  </Field>
                  <Field label="Nilai">
                    <input type="number" min="0" max="100" className="field-input" value={formHasilJadwal.nilai} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, nilai: e.target.value })} />
                  </Field>
                  <Field label="Catatan hasil">
                    <textarea className="field-input min-h-28" value={formHasilJadwal.catatanHasil} onChange={(e) => setFormHasilJadwal({ ...formHasilJadwal, catatanHasil: e.target.value })} />
                  </Field>
                </div>
                <button
                  type="button"
                  className="btn-primary mt-4 w-full"
                  disabled={!jadwalHasilId || simpanHasilJadwal.isPending}
                  onClick={() => simpanHasilJadwal.mutate()}
                >
                  Simpan hasil
                </button>
              </aside>
            </section>
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
