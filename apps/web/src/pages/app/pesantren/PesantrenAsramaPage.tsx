import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface AsramaRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  jenis: string;
  alamat: string | null;
  created_at: string;
}

interface KamarRow extends Record<string, unknown> {
  id: string;
  asrama_id: string;
  nomor: string;
  kapasitas: number;
  terisi: number;
  created_at: string;
}

interface PenempatanRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  kamar_id: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  catatan: string | null;
  created_at: string;
}

interface SantriRingkas {
  id: string;
  nis: string;
  nama_lengkap: string;
  jenis_kelamin: string;
}

const JENIS_ASRAMA = ['PUTRA', 'PUTRI'];
const PAGE_SIZE = 25;

/**
 * Asrama, kamar, dan penempatan santri (EP-G). Backend sudah lengkap sejak
 * awal -- halaman ini yang sebelumnya belum ada (lihat dashboard pondok,
 * kartu "Buka Asrama dan Kamar" yang sebelumnya mengarah ke rute kosong).
 *
 * Dua tab: "Asrama dan Kamar" (kelola daftar asrama, lalu kamar per asrama
 * yang dipilih) dan "Penempatan Santri" (tempatkan santri ke kamar, akhiri
 * penempatan). Tidak ada endpoint UPDATE/DELETE pada asrama/kamar itu
 * sendiri -- halaman ini karena itu tidak menawarkan sunting/hapus, sesuai
 * kemampuan API sesungguhnya.
 */
export function PesantrenAsramaPage() {
  const [tab, setTab] = useState<'asrama' | 'penempatan'>('asrama');

  return (
    <>
      <PageHeader
        title="Asrama dan Kamar"
        description="Kelola asrama, kamar, dan penempatan santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Asrama' }]}
      />

      <div className="mb-4 flex gap-2 border-b border-slate-200 dark:border-slate-800">
        <TabButton aktif={tab === 'asrama'} onClick={() => setTab('asrama')}>
          Asrama dan Kamar
        </TabButton>
        <TabButton aktif={tab === 'penempatan'} onClick={() => setTab('penempatan')}>
          Penempatan Santri
        </TabButton>
      </div>

      {tab === 'asrama' ? <TabAsramaKamar /> : <TabPenempatan />}
    </>
  );
}

function TabButton({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-4 py-2 text-sm font-semibold ${
        aktif
          ? 'border-brand-600 text-brand-700 dark:text-brand-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}

function TabAsramaKamar() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [dipilih, setDipilih] = useState<AsramaRow | null>(null);
  const [tambahAsrama, setTambahAsrama] = useState(false);
  const [tambahKamar, setTambahKamar] = useState(false);
  const [formAsrama, setFormAsrama] = useState({ code: '', nama: '', jenis: 'PUTRA', alamat: '' });
  const [formKamar, setFormKamar] = useState({ nomor: '', kapasitas: '' });

  const daftarAsrama = useQuery({
    queryKey: ['pesantren-asrama'],
    queryFn: () => api.get<AsramaRow[]>('/pesantren/asrama'),
  });

  const daftarKamar = useQuery({
    queryKey: ['pesantren-asrama-kamar', dipilih?.id],
    queryFn: () => api.get<KamarRow[]>(`/pesantren/asrama/${dipilih!.id}/kamar`),
    enabled: !!dipilih,
  });

  const catatAsrama = useMutation({
    mutationFn: () => api.post<AsramaRow>('/pesantren/asrama', formAsrama),
    onSuccess: () => {
      toast.push('Asrama berhasil dicatat.', 'success');
      setTambahAsrama(false);
      setFormAsrama({ code: '', nama: '', jenis: 'PUTRA', alamat: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-asrama'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const catatKamar = useMutation({
    mutationFn: () =>
      api.post<KamarRow>(`/pesantren/asrama/${dipilih!.id}/kamar`, {
        nomor: formKamar.nomor,
        kapasitas: Number(formKamar.kapasitas),
      }),
    onSuccess: () => {
      toast.push('Kamar berhasil dicatat.', 'success');
      setTambahKamar(false);
      setFormKamar({ nomor: '', kapasitas: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-asrama-kamar', dipilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const kolomAsrama: Array<GridColumn<AsramaRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'jenis', header: 'Jenis' },
    { key: 'alamat', header: 'Alamat', render: (row) => row.alamat ?? '—' },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button type="button" className="btn-outline" onClick={() => setDipilih(row)}>
          {dipilih?.id === row.id ? 'Dipilih' : 'Pilih'}
        </button>
      ),
    },
  ];

  const kolomKamar: Array<GridColumn<KamarRow>> = [
    { key: 'nomor', header: 'Nomor Kamar' },
    { key: 'kapasitas', header: 'Kapasitas' },
    { key: 'terisi', header: 'Terisi', render: (row) => `${row.terisi} / ${row.kapasitas}` },
    { key: 'created_at', header: 'Dicatat', render: (row) => formatDate(row.created_at) },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Daftar Asrama</h2>
          <button type="button" className="btn-primary" onClick={() => setTambahAsrama(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Asrama
          </button>
        </div>
        <DataGrid
          columns={kolomAsrama}
          rows={daftarAsrama.data ?? []}
          loading={daftarAsrama.isLoading}
          error={daftarAsrama.isError ? toMessage(daftarAsrama.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
          rowKey={(row) => row.id}
          onRetry={() => void daftarAsrama.refetch()}
          emptyTitle="Belum ada asrama."
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Kamar {dipilih ? `— ${dipilih.nama}` : ''}
          </h2>
          <button type="button" className="btn-primary" disabled={!dipilih} onClick={() => setTambahKamar(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Tambah Kamar
          </button>
        </div>
        {!dipilih ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Pilih asrama di sebelah kiri untuk melihat kamarnya.</p>
        ) : (
          <DataGrid
            columns={kolomKamar}
            rows={daftarKamar.data ?? []}
            loading={daftarKamar.isLoading}
            error={daftarKamar.isError ? toMessage(daftarKamar.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void daftarKamar.refetch()}
            emptyTitle="Belum ada kamar pada asrama ini."
          />
        )}
      </div>

      {tambahAsrama && (
        <Modal judul="Tambah Asrama" onClose={() => setTambahAsrama(false)}>
          <Field label="Kode *">
            <input className="field-input" value={formAsrama.code} onChange={(e) => setFormAsrama({ ...formAsrama, code: e.target.value })} />
          </Field>
          <Field label="Nama *">
            <input className="field-input" value={formAsrama.nama} onChange={(e) => setFormAsrama({ ...formAsrama, nama: e.target.value })} />
          </Field>
          <Field label="Jenis *">
            <select className="field-input" value={formAsrama.jenis} onChange={(e) => setFormAsrama({ ...formAsrama, jenis: e.target.value })}>
              {JENIS_ASRAMA.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alamat">
            <textarea className="field-input" rows={2} value={formAsrama.alamat} onChange={(e) => setFormAsrama({ ...formAsrama, alamat: e.target.value })} />
          </Field>
          <ModalFooter
            onBatal={() => setTambahAsrama(false)}
            onSimpan={() => catatAsrama.mutate()}
            simpanDisabled={!formAsrama.code || !formAsrama.nama || catatAsrama.isPending}
          />
        </Modal>
      )}

      {tambahKamar && dipilih && (
        <Modal judul={`Tambah Kamar — ${dipilih.nama}`} onClose={() => setTambahKamar(false)}>
          <Field label="Nomor Kamar *">
            <input className="field-input" value={formKamar.nomor} onChange={(e) => setFormKamar({ ...formKamar, nomor: e.target.value })} />
          </Field>
          <Field label="Kapasitas *">
            <input type="number" min="1" className="field-input" value={formKamar.kapasitas} onChange={(e) => setFormKamar({ ...formKamar, kapasitas: e.target.value })} />
          </Field>
          <ModalFooter
            onBatal={() => setTambahKamar(false)}
            onSimpan={() => catatKamar.mutate()}
            simpanDisabled={!formKamar.nomor || !formKamar.kapasitas || catatKamar.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function TabPenempatan() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [hanyaAktif, setHanyaAktif] = useState(true);
  const [tempatkan, setTempatkan] = useState(false);
  const [formTempatkan, setFormTempatkan] = useState({ santriId: '', kamarId: '', catatan: '' });

  // Daftar kamar LINTAS asrama, untuk pemilih pada formulir "Tempatkan
  // Santri" -- API hanya menyediakan kamar per-asrama
  // (`GET /pesantren/asrama/:id/kamar`), jadi daftar datar ini dibangun
  // dengan mengambil kamar tiap asrama lalu digabung.
  const kamarSemua = useQuery({
    queryKey: ['pesantren-kamar-semua'],
    queryFn: async () => {
      const asramaList = await api.get<AsramaRow[]>('/pesantren/asrama');
      const perAsrama = await Promise.all(
        asramaList.map(async (a) => {
          const kamar = await api.get<KamarRow[]>(`/pesantren/asrama/${a.id}/kamar`);
          return kamar.map((k) => ({ ...k, asramaNama: a.nama }));
        }),
      );
      return perAsrama.flat();
    },
  });

  const santriAktif = useQuery({
    queryKey: ['pesantren-santri-aktif-ringkas'],
    queryFn: () =>
      api.get<{ items: SantriRingkas[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=200'),
  });

  const queryKey = ['pesantren-penempatan', page, hanyaAktif];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({
        halaman: String(page),
        ukuranHalaman: String(PAGE_SIZE),
        hanyaAktif: String(hanyaAktif),
      });
      return api.get<{ items: PenempatanRow[]; total: number }>(`/pesantren/penempatan?${params.toString()}`);
    },
  });

  const santriById = new Map((santriAktif.data?.items ?? []).map((s) => [s.id, s]));
  const kamarById = new Map((kamarSemua.data ?? []).map((k) => [k.id, k]));

  const tempatkanMutasi = useMutation({
    mutationFn: () =>
      api.post<PenempatanRow>('/pesantren/penempatan', {
        santriId: formTempatkan.santriId,
        kamarId: formTempatkan.kamarId,
        catatan: formTempatkan.catatan || undefined,
      }),
    onSuccess: () => {
      toast.push('Santri berhasil ditempatkan.', 'success');
      setTempatkan(false);
      setFormTempatkan({ santriId: '', kamarId: '', catatan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-penempatan'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kamar-semua'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menempatkan santri.'), 'error'),
  });

  const akhiri = useMutation({
    mutationFn: (id: string) => api.post<PenempatanRow>(`/pesantren/penempatan/${id}/akhiri`),
    onSuccess: () => {
      toast.push('Penempatan diakhiri.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-penempatan'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-kamar-semua'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengakhiri penempatan.'), 'error'),
  });

  const kolom: Array<GridColumn<PenempatanRow>> = [
    {
      key: 'santri_id',
      header: 'Santri',
      render: (row) => {
        const s = santriById.get(row.santri_id);
        return s ? `${s.nis} — ${s.nama_lengkap}` : row.santri_id;
      },
    },
    {
      key: 'kamar_id',
      header: 'Kamar',
      render: (row) => {
        const k = kamarById.get(row.kamar_id);
        return k ? `${k.nomor} (${k.asramaNama})` : row.kamar_id;
      },
    },
    { key: 'tanggal_mulai', header: 'Mulai', render: (row) => formatDate(row.tanggal_mulai) },
    {
      key: 'tanggal_selesai',
      header: 'Selesai',
      render: (row) => (row.tanggal_selesai ? formatDate(row.tanggal_selesai) : '—'),
    },
    {
      key: 'aksi',
      header: '',
      render: (row) =>
        !row.tanggal_selesai ? (
          <button type="button" className="btn-outline" disabled={akhiri.isPending} onClick={() => akhiri.mutate(row.id)}>
            Akhiri
          </button>
        ) : null,
    },
  ];

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="card mb-4 flex flex-wrap items-end justify-between gap-3 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hanyaAktif}
            onChange={(e) => {
              setHanyaAktif(e.target.checked);
              setPage(1);
            }}
          />
          Hanya penempatan aktif
        </label>
        <button type="button" className="btn-primary" onClick={() => setTempatkan(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Tempatkan Santri
        </button>
      </div>

      <DataGrid
        columns={kolom}
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        emptyTitle="Belum ada penempatan santri."
      />

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {tempatkan && (
        <Modal judul="Tempatkan Santri" onClose={() => setTempatkan(false)}>
          <Field label="Santri *">
            <select
              className="field-input"
              value={formTempatkan.santriId}
              onChange={(e) => setFormTempatkan({ ...formTempatkan, santriId: e.target.value })}
            >
              <option value="">— Pilih santri aktif —</option>
              {(santriAktif.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nis} — {s.nama_lengkap}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kamar *">
            <select
              className="field-input"
              value={formTempatkan.kamarId}
              onChange={(e) => setFormTempatkan({ ...formTempatkan, kamarId: e.target.value })}
            >
              <option value="">— Pilih kamar —</option>
              {(kamarSemua.data ?? []).map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nomor} ({k.asramaNama}) — {k.terisi}/{k.kapasitas} terisi
                </option>
              ))}
            </select>
          </Field>
          <Field label="Catatan">
            <textarea
              className="field-input"
              rows={2}
              value={formTempatkan.catatan}
              onChange={(e) => setFormTempatkan({ ...formTempatkan, catatan: e.target.value })}
            />
          </Field>
          <ModalFooter
            onBatal={() => setTempatkan(false)}
            onSimpan={() => tempatkanMutasi.mutate()}
            simpanDisabled={!formTempatkan.santriId || !formTempatkan.kamarId || tempatkanMutasi.isPending}
          />
        </Modal>
      )}
    </div>
  );
}

function Modal({ judul, onClose, children }: { judul: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{judul}</h2>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

function ModalFooter({
  onBatal,
  onSimpan,
  simpanDisabled,
}: {
  onBatal: () => void;
  onSimpan: () => void;
  simpanDisabled: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" className="btn-outline" onClick={onBatal}>
        Batal
      </button>
      <button type="button" className="btn-primary" disabled={simpanDisabled} onClick={onSimpan}>
        Simpan
      </button>
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
