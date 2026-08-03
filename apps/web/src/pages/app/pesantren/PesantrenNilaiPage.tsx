import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Save } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface MataPelajaranRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  kelompok: string | null;
  jenjang: string | null;
}

interface KomponenRow extends Record<string, unknown> {
  id: string;
  kode: string;
  nama: string;
  bobot_persen: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

export function PesantrenNilaiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'mapel' | 'input'>('mapel');
  const [mapelId, setMapelId] = useState('');
  const [tahunAjaranId, setTahunAjaranId] = useState('');
  const [formMapel, setFormMapel] = useState({ code: '', nama: '', kelompok: '', jenjang: '' });
  const [formKomponen, setFormKomponen] = useState({ kode: '', nama: '', bobotPersen: '0' });
  const [formNilai, setFormNilai] = useState({ santriId: '', komponenId: '', nilaiAngka: '', catatan: '' });

  const mapel = useQuery({
    queryKey: ['pesantren-nilai-mapel'],
    queryFn: () => api.get<MataPelajaranRow[]>('/pesantren/nilai/mata-pelajaran'),
  });

  const komponen = useQuery({
    queryKey: ['pesantren-nilai-komponen', mapelId],
    enabled: Boolean(mapelId),
    queryFn: () => api.get<KomponenRow[]>(`/pesantren/nilai/mata-pelajaran/${mapelId}/komponen`),
  });

  const santri = useQuery({
    queryKey: ['pesantren-nilai-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });

  const tambahMapel = useMutation({
    mutationFn: () =>
      api.post<MataPelajaranRow>('/pesantren/nilai/mata-pelajaran', {
        code: formMapel.code,
        nama: formMapel.nama,
        kelompok: formMapel.kelompok.trim() || undefined,
        jenjang: formMapel.jenjang.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Mata pelajaran tersimpan.', 'success');
      setFormMapel({ code: '', nama: '', kelompok: '', jenjang: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-mapel'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan mata pelajaran.'), 'error'),
  });

  const tambahKomponen = useMutation({
    mutationFn: () =>
      api.post<KomponenRow>(`/pesantren/nilai/mata-pelajaran/${mapelId}/komponen`, {
        kode: formKomponen.kode,
        nama: formKomponen.nama,
        bobotPersen: Number(formKomponen.bobotPersen),
      }),
    onSuccess: () => {
      toast.push('Komponen nilai tersimpan.', 'success');
      setFormKomponen({ kode: '', nama: '', bobotPersen: '0' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-komponen', mapelId] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan komponen.'), 'error'),
  });

  const simpanNilai = useMutation({
    mutationFn: () =>
      api.post('/pesantren/nilai', {
        santriId: formNilai.santriId,
        komponenId: formNilai.komponenId,
        tahunAjaranId,
        nilaiAngka: Number(formNilai.nilaiAngka),
        catatan: formNilai.catatan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Nilai santri tersimpan.', 'success');
      setFormNilai({ santriId: '', komponenId: formNilai.komponenId, nilaiAngka: '', catatan: '' });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai.'), 'error'),
  });

  const columns: Array<GridColumn<MataPelajaranRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Mata Pelajaran' },
    { key: 'kelompok', header: 'Kelompok', render: (row) => row.kelompok ?? '-' },
    { key: 'jenjang', header: 'Jenjang', render: (row) => row.jenjang ? <StatusBadge status={row.jenjang} /> : '-' },
  ];

  return (
    <>
      <PageHeader
        title="Nilai dan Rapor"
        description="Kelola mata pelajaran, komponen penilaian, dan input nilai santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Nilai' }]}
        actions={
          <button type="button" className="btn-outline" onClick={() => void mapel.refetch()}>
            <RefreshCw className="h-4 w-4" aria-hidden />
            Muat Ulang
          </button>
        }
      />

      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'mapel' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('mapel')}>Mata Pelajaran</button>
        <button type="button" className={tab === 'input' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('input')}>Input Nilai</button>
      </div>

      {tab === 'mapel' ? (
        <>
          <div className="card mb-4 p-4">
            <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_180px_160px_auto]">
              <Input label="Kode" value={formMapel.code} onChange={(value) => setFormMapel({ ...formMapel, code: value.toUpperCase() })} />
              <Input label="Nama" value={formMapel.nama} onChange={(value) => setFormMapel({ ...formMapel, nama: value })} />
              <Input label="Kelompok" value={formMapel.kelompok} onChange={(value) => setFormMapel({ ...formMapel, kelompok: value })} />
              <Input label="Jenjang" value={formMapel.jenjang} onChange={(value) => setFormMapel({ ...formMapel, jenjang: value.toUpperCase() })} />
              <div className="flex items-end">
                <button type="button" className="btn-primary" disabled={!formMapel.code || !formMapel.nama || tambahMapel.isPending} onClick={() => tambahMapel.mutate()}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Tambah
                </button>
              </div>
            </div>
          </div>
          <DataGrid
            columns={columns}
            rows={mapel.data ?? []}
            loading={mapel.isLoading}
            error={mapel.isError ? toMessage(mapel.error, (_key, fallback) => fallback ?? 'Gagal memuat mata pelajaran.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void mapel.refetch()}
            emptyTitle="Belum ada mata pelajaran."
          />
        </>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
          <div className="card p-4">
            <Field label="Mata pelajaran">
              <select className="field-input" value={mapelId} onChange={(e) => { setMapelId(e.target.value); setFormNilai({ ...formNilai, komponenId: '' }); }}>
                <option value="">Pilih mata pelajaran</option>
                {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
              </select>
            </Field>
            <div className="mt-4 grid gap-3 md:grid-cols-[120px_minmax(180px,1fr)_120px_auto]">
              <Input label="Kode" value={formKomponen.kode} onChange={(value) => setFormKomponen({ ...formKomponen, kode: value.toUpperCase() })} />
              <Input label="Komponen" value={formKomponen.nama} onChange={(value) => setFormKomponen({ ...formKomponen, nama: value })} />
              <Input label="Bobot %" type="number" value={formKomponen.bobotPersen} onChange={(value) => setFormKomponen({ ...formKomponen, bobotPersen: value })} />
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!mapelId || !formKomponen.kode || !formKomponen.nama || tambahKomponen.isPending} onClick={() => tambahKomponen.mutate()}>
                  Tambah
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(komponen.data ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <span>{item.kode} - {item.nama}</span>
                  <StatusBadge status={`${item.bobot_persen}%`} />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Tahun ajaran ID *" value={tahunAjaranId} onChange={setTahunAjaranId} />
              <Field label="Komponen *">
                <select className="field-input" value={formNilai.komponenId} onChange={(e) => setFormNilai({ ...formNilai, komponenId: e.target.value })}>
                  <option value="">Pilih komponen</option>
                  {(komponen.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.kode} - {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Santri *">
                <select className="field-input" value={formNilai.santriId} onChange={(e) => setFormNilai({ ...formNilai, santriId: e.target.value })}>
                  <option value="">Pilih santri</option>
                  {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
                </select>
              </Field>
              <Input label="Nilai angka *" type="number" value={formNilai.nilaiAngka} onChange={(value) => setFormNilai({ ...formNilai, nilaiAngka: value })} />
              <div className="md:col-span-2">
                <Field label="Catatan">
                  <textarea className="field-input min-h-24" value={formNilai.catatan} onChange={(e) => setFormNilai({ ...formNilai, catatan: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" disabled={!tahunAjaranId || !formNilai.santriId || !formNilai.komponenId || !formNilai.nilaiAngka || simpanNilai.isPending} onClick={() => simpanNilai.mutate()}>
                <Save className="h-4 w-4" aria-hidden />
                Simpan Nilai
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
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
