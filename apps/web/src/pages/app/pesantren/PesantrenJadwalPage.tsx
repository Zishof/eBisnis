import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Clock3, DoorOpen, Layers3, Plus, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface JadwalRow extends Record<string, unknown> {
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

const HARI = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];

export function PesantrenJadwalPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [hari, setHari] = useState('');
  const [rombonganId, setRombonganId] = useState('');
  const [membuat, setMembuat] = useState(false);
  const [form, setForm] = useState({
    rombonganId: '',
    mataPelajaranId: '',
    hari: 'SENIN',
    waktuMulai: '07:00',
    waktuSelesai: '08:00',
    ruangan: '',
  });

  const jadwal = useQuery({
    queryKey: ['pesantren-jadwal', hari, rombonganId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (hari) params.set('hari', hari);
      if (rombonganId) params.set('rombonganId', rombonganId);
      const query = params.toString();
      return api.get<JadwalRow[]>(`/pesantren/kurikulum/jadwal${query ? `?${query}` : ''}`);
    },
  });

  const rombongan = useQuery({
    queryKey: ['pesantren-jadwal-rombongan'],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>('/pesantren/rombongan?halaman=1&ukuranHalaman=100'),
  });

  const mapel = useQuery({
    queryKey: ['pesantren-jadwal-mapel'],
    queryFn: () => api.get<MataPelajaranRow[]>('/pesantren/nilai/mata-pelajaran'),
  });

  const simpan = useMutation({
    mutationFn: () =>
      api.post<JadwalRow>('/pesantren/kurikulum/jadwal', {
        ...form,
        ruangan: form.ruangan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Jadwal pelajaran tersimpan.', 'success');
      setMembuat(false);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-jadwal'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan jadwal.'), 'error'),
  });

  const hapus = useMutation({
    mutationFn: (id: string) => api.delete<JadwalRow>(`/pesantren/kurikulum/jadwal/${id}`),
    onSuccess: () => {
      toast.push('Jadwal dibatalkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-jadwal'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membatalkan jadwal.'), 'error'),
  });

  const namaRombongan = new Map((rombongan.data?.items ?? []).map((item) => [item.id, `${item.tingkat} ${item.nama}`]));
  const namaMapel = new Map((mapel.data ?? []).map((item) => [item.id, item.nama]));
  const jadwalPerHari = HARI.map((item) => ({
    hari: item,
    items: (jadwal.data ?? [])
      .filter((row) => row.hari === item)
      .sort((a, b) => a.waktu_mulai.localeCompare(b.waktu_mulai)),
  }));
  const totalSesi = jadwal.data?.length ?? 0;
  const totalRombongan = new Set((jadwal.data ?? []).map((row) => row.rombongan_id)).size;
  const totalRuang = new Set((jadwal.data ?? []).map((row) => row.ruangan).filter(Boolean)).size;
  const hariTerisi = jadwalPerHari.filter((kolom) => kolom.items.length > 0).length;

  const columns: Array<GridColumn<JadwalRow>> = [
    { key: 'hari', header: 'Hari', render: (row) => <StatusBadge status={row.hari} /> },
    { key: 'waktu_mulai', header: 'Mulai' },
    { key: 'waktu_selesai', header: 'Selesai' },
    { key: 'rombongan_id', header: 'Rombongan', render: (row) => namaRombongan.get(row.rombongan_id) ?? row.rombongan_id },
    { key: 'mata_pelajaran_id', header: 'Mata Pelajaran', render: (row) => namaMapel.get(row.mata_pelajaran_id) ?? row.mata_pelajaran_id },
    { key: 'ruangan', header: 'Ruang', render: (row) => row.ruangan ?? '-' },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <button type="button" className="btn-outline px-2 py-1.5" onClick={() => hapus.mutate(row.id)}>
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Jadwal Pelajaran"
        description="Susun jadwal per rombongan belajar. Bentrok jam rombongan dan pengajar ditolak oleh sistem."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Jadwal' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" aria-hidden />
              Cetak
            </button>
            <button type="button" className="btn-outline" onClick={() => void jadwal.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
            <button type="button" className="btn-primary" onClick={() => setMembuat(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah Jadwal
            </button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <Metric icon={<CalendarDays className="h-4 w-4" aria-hidden />} label="Total sesi" value={totalSesi} />
        <Metric icon={<Layers3 className="h-4 w-4" aria-hidden />} label="Rombongan" value={totalRombongan} />
        <Metric icon={<DoorOpen className="h-4 w-4" aria-hidden />} label="Ruang dipakai" value={totalRuang} />
        <Metric icon={<Clock3 className="h-4 w-4" aria-hidden />} label="Hari terisi" value={hariTerisi} />
      </div>

      <div className="card mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-[220px_minmax(220px,1fr)_auto]">
          <Field label="Hari">
            <select id="jadwal-hari" className="field-input" value={hari} onChange={(e) => setHari(e.target.value)}>
              <option value="">Semua</option>
              {HARI.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </Field>
          <Field label="Rombongan belajar">
            <select className="field-input" value={rombonganId} onChange={(e) => setRombonganId(e.target.value)}>
              <option value="">Semua rombongan</option>
              {(rombongan.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.tingkat} {item.nama}</option>)}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              className="btn-outline w-full justify-center"
              onClick={() => {
                setHari('');
                setRombonganId('');
              }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 dark:border-slate-800 dark:from-emerald-950/30 dark:to-sky-950/20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Timetable Visual</h2>
            <p className="mt-1 text-xs text-slate-500">Ringkasan jadwal per hari untuk membaca benturan dan kepadatan kelas lebih cepat.</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {(jadwal.data ?? []).length} sesi
          </span>
        </div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-7">
          {jadwalPerHari.filter((kolom) => !hari || kolom.hari === hari).map((kolom) => (
            <div key={kolom.hari} className="min-h-32 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{kolom.hari}</p>
              <div className="mt-3 space-y-2">
                {kolom.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700">
                    Kosong
                  </p>
                ) : (
                  kolom.items.map((item) => (
                    <div key={item.id} className="rounded-lg border border-emerald-100 bg-white p-3 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
                      <p className="font-semibold leading-snug text-slate-900 dark:text-white">
                        {namaMapel.get(item.mata_pelajaran_id) ?? item.mata_pelajaran_id}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{namaRombongan.get(item.rombongan_id) ?? item.rombongan_id}</p>
                      <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        <Clock3 className="h-3.5 w-3.5" aria-hidden />
                        {item.waktu_mulai} - {item.waktu_selesai}
                      </p>
                      {item.ruangan && <p className="mt-1 text-xs text-slate-400">{item.ruangan}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <DataGrid
        columns={columns}
        rows={jadwal.data ?? []}
        loading={jadwal.isLoading}
        error={jadwal.isError ? toMessage(jadwal.error, (_key, fallback) => fallback ?? 'Gagal memuat jadwal.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void jadwal.refetch()}
        emptyTitle="Belum ada jadwal pelajaran."
      />

      {membuat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Jadwal</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Rombongan *">
                <select className="field-input" value={form.rombonganId} onChange={(e) => setForm({ ...form, rombonganId: e.target.value })}>
                  <option value="">Pilih rombongan</option>
                  {(rombongan.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.tingkat} {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Mata pelajaran *">
                <select className="field-input" value={form.mataPelajaranId} onChange={(e) => setForm({ ...form, mataPelajaranId: e.target.value })}>
                  <option value="">Pilih mata pelajaran</option>
                  {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Hari *">
                <select className="field-input" value={form.hari} onChange={(e) => setForm({ ...form, hari: e.target.value })}>
                  {HARI.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="Ruangan">
                <input className="field-input" value={form.ruangan} onChange={(e) => setForm({ ...form, ruangan: e.target.value })} />
              </Field>
              <Field label="Mulai *">
                <input type="time" className="field-input" value={form.waktuMulai} onChange={(e) => setForm({ ...form, waktuMulai: e.target.value })} />
              </Field>
              <Field label="Selesai *">
                <input type="time" className="field-input" value={form.waktuSelesai} onChange={(e) => setForm({ ...form, waktuSelesai: e.target.value })} />
              </Field>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setMembuat(false)}>Batal</button>
              <button type="button" className="btn-primary" disabled={!form.rombonganId || !form.mataPelajaranId || simpan.isPending} onClick={() => simpan.mutate()}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </>
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

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
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
