import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Plus, RefreshCw, Settings2, XCircle } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface IzinRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  jenis: string;
  alasan: string;
  tanggal_mulai: string;
  tanggal_selesai_rencana: string;
  kontak_penjemput: string | null;
  no_hp_penjemput: string | null;
  disposisi_ke: string | null;
  status: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

const PAGE_SIZE = 25;
const STATUS_OPTIONS = ['MENUNGGU', 'DISETUJUI', 'DITOLAK', 'SELESAI', 'DIBATALKAN'];
const JENIS_OPTIONS = ['PULANG', 'KELUAR_SEMENTARA', 'SAKIT', 'KEPERLUAN_KELUARGA', 'LAINNYA'];
const SOP_DEFAULT: Record<string, string[]> = {
  PULANG: ['WALI_KELAS', 'PEMBINA_ASRAMA', 'PENGASUH'],
  KELUAR_SEMENTARA: ['PEMBINA_ASRAMA', 'KEAMANAN'],
  SAKIT: ['UKS_KLINIK', 'PEMBINA_ASRAMA', 'PENGASUH'],
  KEPERLUAN_KELUARGA: ['WALI_KELAS', 'PEMBINA_ASRAMA', 'PENGASUH'],
  LAINNYA: ['PEMBINA_ASRAMA', 'PENGASUH'],
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PesantrenPerizinanPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [membuat, setMembuat] = useState(false);
  const [mengaturSop, setMengaturSop] = useState(false);
  const [catatan, setCatatan] = useState<Record<string, string>>({});
  const [tujuanDisposisi, setTujuanDisposisi] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    santriId: '',
    jenis: 'PULANG',
    alasan: '',
    tanggalMulai: today(),
    tanggalSelesaiRencana: today(),
    kontakPenjemput: '',
    noHpPenjemput: '',
  });

  const izin = useQuery({
    queryKey: ['pesantren-perizinan', page, status],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      return api.get<{ items: IzinRow[]; total: number }>(`/pesantren/perizinan?${params.toString()}`);
    },
  });

  const santri = useQuery({
    queryKey: ['pesantren-perizinan-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });
  const sopQuery = useQuery({
    queryKey: ['pesantren-perizinan-sop-disposisi'],
    queryFn: () => api.get<Record<string, string[]>>('/pesantren/perizinan/sop-disposisi'),
  });

  const ajukan = useMutation({
    mutationFn: () =>
      api.post<IzinRow>('/pesantren/perizinan', {
        ...form,
        kontakPenjemput: form.kontakPenjemput.trim() || undefined,
        noHpPenjemput: form.noHpPenjemput.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Izin santri berhasil diajukan.', 'success');
      setMembuat(false);
      setForm({ santriId: '', jenis: 'PULANG', alasan: '', tanggalMulai: today(), tanggalSelesaiRencana: today(), kontakPenjemput: '', noHpPenjemput: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-perizinan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengajukan izin.'), 'error'),
  });

  const aksi = useMutation({
    mutationFn: ({ id, path }: { id: string; path: 'setujui' | 'tolak' | 'batalkan' | 'selesai' }) =>
      api.post<IzinRow>(`/pesantren/perizinan/${id}/${path}`, { catatan: catatan[id]?.trim() || undefined }),
    onSuccess: () => {
      toast.push('Status izin diperbarui.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-perizinan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memperbarui izin.'), 'error'),
  });

  const disposisi = useMutation({
    mutationFn: ({ id, tujuan }: { id: string; tujuan: string }) =>
      api.post<IzinRow>(`/pesantren/perizinan/${id}/disposisi`, { disposisiKe: tujuan, catatan: catatan[id]?.trim() || undefined }),
    onSuccess: () => {
      toast.push('Izin berhasil didisposisikan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-perizinan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal disposisi izin.'), 'error'),
  });

  const simpanSop = useMutation({
    mutationFn: (value: Record<string, string[]>) => api.post<Record<string, string[]>>('/pesantren/perizinan/sop-disposisi', { value }),
    onSuccess: async () => {
      toast.push('SOP disposisi tersimpan.', 'success');
      await queryClient.invalidateQueries({ queryKey: ['pesantren-perizinan-sop-disposisi'] });
      setMengaturSop(false);
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan SOP disposisi.'), 'error'),
  });

  const namaSantri = new Map((santri.data?.items ?? []).map((item) => [item.id, `${item.nis} - ${item.nama_lengkap}`]));
  const sop = sopQuery.data ?? SOP_DEFAULT;

  const columns: Array<GridColumn<IzinRow>> = [
    { key: 'santri_id', header: 'Santri', render: (row) => namaSantri.get(row.santri_id) ?? row.santri_id },
    { key: 'jenis', header: 'Jenis' },
    { key: 'tanggal_mulai', header: 'Mulai', render: (row) => formatDate(row.tanggal_mulai) },
    { key: 'tanggal_selesai_rencana', header: 'Rencana Kembali', render: (row) => formatDate(row.tanggal_selesai_rencana) },
    { key: 'kontak_penjemput', header: 'Penjemput', render: (row) => row.kontak_penjemput ?? '-' },
    {
      key: 'disposisi_ke',
      header: 'Disposisi',
      render: (row) => {
        const tahapan = sop[row.jenis] ?? SOP_DEFAULT[row.jenis] ?? SOP_DEFAULT.LAINNYA;
        const tujuanAktif = tujuanDisposisi[row.id] ?? row.disposisi_ke ?? tahapan[0] ?? 'PENGASUH';
        return (
          <select
            className="field-input min-w-[160px]"
            value={tujuanAktif}
            onChange={(event) => setTujuanDisposisi((current) => ({ ...current, [row.id]: event.target.value }))}
            disabled={row.status !== 'MENUNGGU'}
          >
            {tahapan.map((item) => (
              <option key={item} value={item}>
                {labelTujuan(item)}
              </option>
            ))}
          </select>
        );
      },
    },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'catatan',
      header: 'Catatan Aksi',
      render: (row) => (
        <input
          className="field-input min-w-[180px]"
          value={catatan[row.id] ?? ''}
          onChange={(event) => setCatatan((current) => ({ ...current, [row.id]: event.target.value }))}
          placeholder="Opsional"
        />
      ),
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-2">
          {row.status === 'MENUNGGU' && (
            <>
              <button type="button" className="btn-outline px-2 py-1.5" onClick={() => aksi.mutate({ id: row.id, path: 'setujui' })}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" className="btn-outline px-2 py-1.5" onClick={() => aksi.mutate({ id: row.id, path: 'tolak' })}>
                <XCircle className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                className="btn-outline px-2 py-1.5 text-xs"
                onClick={() => disposisi.mutate({ id: row.id, tujuan: tujuanDisposisi[row.id] ?? row.disposisi_ke ?? sop[row.jenis]?.[0] ?? 'PENGASUH' })}
              >
                Disposisi
              </button>
            </>
          )}
          {row.status === 'DISETUJUI' && <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => aksi.mutate({ id: row.id, path: 'selesai' })}>Selesai</button>}
          {!['SELESAI', 'DIBATALKAN'].includes(row.status) && <button type="button" className="btn-outline px-2 py-1.5 text-xs" onClick={() => aksi.mutate({ id: row.id, path: 'batalkan' })}>Batal</button>}
        </div>
      ),
    },
  ];

  const total = izin.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Perizinan Santri"
        description="Ajukan izin, setujui/tolak, disposisi, dan selesaikan izin setelah santri kembali."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Perizinan' }]}
        actions={
          <>
            <button type="button" className="btn-outline" onClick={() => void izin.refetch()}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
            <button type="button" className="btn-outline" onClick={() => setMengaturSop(true)}>
              <Settings2 className="h-4 w-4" aria-hidden />
              SOP Disposisi
            </button>
            <button type="button" className="btn-primary" onClick={() => setMembuat(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Ajukan Izin
            </button>
          </>
        }
      />

      <div className="card mb-4 max-w-xs p-4">
        <label className="field-label" htmlFor="izin-status">Status</label>
        <select id="izin-status" className="field-input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">Semua</option>
          {STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <DataGrid
        columns={columns}
        rows={izin.data?.items ?? []}
        loading={izin.isLoading}
        error={izin.isError ? toMessage(izin.error, (_key, fallback) => fallback ?? 'Gagal memuat izin.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void izin.refetch()}
        emptyTitle="Belum ada pengajuan izin."
      />
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))} total={total} onChange={setPage} />

      {membuat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ajukan Izin Santri</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Field label="Santri *">
                <select className="field-input" value={form.santriId} onChange={(e) => setForm({ ...form, santriId: e.target.value })}>
                  <option value="">Pilih santri</option>
                  {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
                </select>
              </Field>
              <Field label="Jenis *">
                <select className="field-input" value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
                  {JENIS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </Field>
              <Field label="Tanggal mulai *">
                <input type="date" className="field-input" value={form.tanggalMulai} onChange={(e) => setForm({ ...form, tanggalMulai: e.target.value })} />
              </Field>
              <Field label="Rencana kembali *">
                <input type="date" className="field-input" value={form.tanggalSelesaiRencana} onChange={(e) => setForm({ ...form, tanggalSelesaiRencana: e.target.value })} />
              </Field>
              <Field label="Kontak penjemput">
                <input className="field-input" value={form.kontakPenjemput} onChange={(e) => setForm({ ...form, kontakPenjemput: e.target.value })} />
              </Field>
              <Field label="HP penjemput">
                <input className="field-input" value={form.noHpPenjemput} onChange={(e) => setForm({ ...form, noHpPenjemput: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Alasan *">
                  <textarea className="field-input min-h-24" value={form.alasan} onChange={(e) => setForm({ ...form, alasan: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setMembuat(false)}>Batal</button>
              <button type="button" className="btn-primary" disabled={!form.santriId || !form.alasan.trim() || ajukan.isPending} onClick={() => ajukan.mutate()}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {mengaturSop && (
        <SopModal
          value={sop}
          onClose={() => setMengaturSop(false)}
          saving={simpanSop.isPending}
          onSave={(next) => simpanSop.mutate(next)}
        />
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

function SopModal({
  value,
  saving,
  onClose,
  onSave,
}: {
  value: Record<string, string[]>;
  saving?: boolean;
  onClose: () => void;
  onSave: (value: Record<string, string[]>) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(JENIS_OPTIONS.map((jenis) => [jenis, (value[jenis] ?? SOP_DEFAULT[jenis] ?? []).join(', ')])),
  );

  const simpan = () => {
    const parsed = Object.fromEntries(
      JENIS_OPTIONS.map((jenis) => [
        jenis,
        draft[jenis]
          .split(',')
          .map((item) => item.trim().toUpperCase().replace(/\s+/g, '_'))
          .filter(Boolean),
      ]),
    );
    onSave(parsed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="card w-full max-w-3xl p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">SOP Disposisi Perizinan</h2>
        <p className="mt-1 text-sm text-slate-500">Isi urutan tujuan dengan koma. Tombol disposisi pada daftar izin akan mengikuti jenis izin masing-masing.</p>
        <div className="mt-4 grid gap-3">
          {JENIS_OPTIONS.map((jenis) => (
            <label key={jenis} className="block">
              <span className="field-label">{labelTujuan(jenis)}</span>
              <input className="field-input" value={draft[jenis] ?? ''} onChange={(event) => setDraft((current) => ({ ...current, [jenis]: event.target.value }))} />
            </label>
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Batal</button>
          <button type="button" className="btn-primary" onClick={simpan} disabled={saving}>Simpan SOP</button>
        </div>
      </div>
    </div>
  );
}

function labelTujuan(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
