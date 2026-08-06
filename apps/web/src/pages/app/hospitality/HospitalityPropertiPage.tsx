import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface PropertiRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  timezone: string;
  business_date: string;
  alamat: string | null;
  status: string;
  created_at: string;
}

interface TipeKamarRow extends Record<string, unknown> {
  id: string;
  property_id: string;
  code: string;
  nama: string;
  okupansi_maks: number;
  deskripsi: string | null;
  created_at: string;
}

interface KamarRow extends Record<string, unknown> {
  id: string;
  property_id: string;
  room_type_id: string;
  nomor_kamar: string;
  lantai: string | null;
  status: string;
  created_at: string;
}

/**
 * Properti, tipe kamar, dan kamar (MI-5) — fondasi seluruh modul hospitality
 * lain (ketersediaan, reservasi, front office, dst, MI-6 dan seterusnya).
 *
 * Tiga kolom bertingkat: pilih properti -> pilih tipe kamar -> lihat/tambah
 * kamar pada tipe itu. Tidak ada endpoint UPDATE/DELETE pada ketiganya --
 * halaman ini karena itu tidak menawarkan sunting/hapus, sesuai kemampuan
 * API sesungguhnya (pola sama dengan `PesantrenAsramaPage`).
 */
export function HospitalityPropertiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [propertiDipilih, setPropertiDipilih] = useState<PropertiRow | null>(null);
  const [tipeKamarDipilih, setTipeKamarDipilih] = useState<TipeKamarRow | null>(null);
  const [tambahProperti, setTambahProperti] = useState(false);
  const [tambahTipeKamar, setTambahTipeKamar] = useState(false);
  const [tambahKamar, setTambahKamar] = useState(false);
  const [formProperti, setFormProperti] = useState({ code: '', nama: '', timezone: 'Asia/Jakarta', alamat: '' });
  const [formTipeKamar, setFormTipeKamar] = useState({ code: '', nama: '', okupansiMaks: '2', deskripsi: '' });
  const [formKamar, setFormKamar] = useState({ nomorKamar: '', lantai: '' });

  const daftarProperti = useQuery({
    queryKey: ['hospitality-properti'],
    queryFn: () => api.get<PropertiRow[]>('/hospitality/properti'),
  });

  const daftarTipeKamar = useQuery({
    queryKey: ['hospitality-tipe-kamar', propertiDipilih?.id],
    queryFn: () => api.get<TipeKamarRow[]>(`/hospitality/properti/${propertiDipilih!.id}/tipe-kamar`),
    enabled: !!propertiDipilih,
  });

  const daftarKamar = useQuery({
    queryKey: ['hospitality-kamar', propertiDipilih?.id],
    queryFn: () => api.get<KamarRow[]>(`/hospitality/properti/${propertiDipilih!.id}/kamar`),
    enabled: !!propertiDipilih,
  });

  const kamarTipeIni = (daftarKamar.data ?? []).filter((k) => k.room_type_id === tipeKamarDipilih?.id);

  const catatProperti = useMutation({
    mutationFn: () => api.post<PropertiRow>('/hospitality/properti', formProperti),
    onSuccess: () => {
      toast.push('Properti berhasil dicatat.', 'success');
      setTambahProperti(false);
      setFormProperti({ code: '', nama: '', timezone: 'Asia/Jakarta', alamat: '' });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-properti'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const catatTipeKamar = useMutation({
    mutationFn: () =>
      api.post<TipeKamarRow>(`/hospitality/properti/${propertiDipilih!.id}/tipe-kamar`, {
        code: formTipeKamar.code,
        nama: formTipeKamar.nama,
        okupansiMaks: Number(formTipeKamar.okupansiMaks),
        deskripsi: formTipeKamar.deskripsi || undefined,
      }),
    onSuccess: () => {
      toast.push('Tipe kamar berhasil dicatat.', 'success');
      setTambahTipeKamar(false);
      setFormTipeKamar({ code: '', nama: '', okupansiMaks: '2', deskripsi: '' });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tipe-kamar', propertiDipilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const catatKamar = useMutation({
    mutationFn: () =>
      api.post<KamarRow>(`/hospitality/properti/${propertiDipilih!.id}/kamar`, {
        roomTypeId: tipeKamarDipilih!.id,
        nomorKamar: formKamar.nomorKamar,
        lantai: formKamar.lantai || undefined,
      }),
    onSuccess: () => {
      toast.push('Kamar berhasil dicatat.', 'success');
      setTambahKamar(false);
      setFormKamar({ nomorKamar: '', lantai: '' });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-kamar', propertiDipilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const kolomProperti: Array<GridColumn<PropertiRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'status', header: 'Status' },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setPropertiDipilih(row);
            setTipeKamarDipilih(null);
          }}
        >
          {propertiDipilih?.id === row.id ? 'Dipilih' : 'Pilih'}
        </button>
      ),
    },
  ];

  const kolomTipeKamar: Array<GridColumn<TipeKamarRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Nama' },
    { key: 'okupansi_maks', header: 'Okupansi Maks' },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button type="button" className="btn-outline" onClick={() => setTipeKamarDipilih(row)}>
          {tipeKamarDipilih?.id === row.id ? 'Dipilih' : 'Pilih'}
        </button>
      ),
    },
  ];

  const kolomKamar: Array<GridColumn<KamarRow>> = [
    { key: 'nomor_kamar', header: 'Nomor Kamar' },
    { key: 'lantai', header: 'Lantai', render: (row) => row.lantai ?? '—' },
    { key: 'status', header: 'Status' },
    { key: 'created_at', header: 'Dicatat', render: (row) => formatDate(row.created_at) },
  ];

  return (
    <>
      <PageHeader
        title="Properti dan Kamar"
        description="Kelola properti, tipe kamar, dan kamar."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Hospitality' }, { label: 'Properti' }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Properti</h2>
            <button type="button" className="btn-primary" onClick={() => setTambahProperti(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah
            </button>
          </div>
          <DataGrid
            columns={kolomProperti}
            rows={daftarProperti.data ?? []}
            loading={daftarProperti.isLoading}
            error={daftarProperti.isError ? toMessage(daftarProperti.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void daftarProperti.refetch()}
            emptyTitle="Belum ada properti."
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Tipe Kamar {propertiDipilih ? `— ${propertiDipilih.nama}` : ''}
            </h2>
            <button type="button" className="btn-primary" disabled={!propertiDipilih} onClick={() => setTambahTipeKamar(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah
            </button>
          </div>
          {!propertiDipilih ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Pilih properti di sebelah kiri.</p>
          ) : (
            <DataGrid
              columns={kolomTipeKamar}
              rows={daftarTipeKamar.data ?? []}
              loading={daftarTipeKamar.isLoading}
              error={daftarTipeKamar.isError ? toMessage(daftarTipeKamar.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
              rowKey={(row) => row.id}
              onRetry={() => void daftarTipeKamar.refetch()}
              emptyTitle="Belum ada tipe kamar pada properti ini."
            />
          )}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Kamar {tipeKamarDipilih ? `— ${tipeKamarDipilih.nama}` : ''}
            </h2>
            <button type="button" className="btn-primary" disabled={!tipeKamarDipilih} onClick={() => setTambahKamar(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Tambah
            </button>
          </div>
          {!tipeKamarDipilih ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Pilih tipe kamar di sebelah kiri.</p>
          ) : (
            <DataGrid
              columns={kolomKamar}
              rows={kamarTipeIni}
              loading={daftarKamar.isLoading}
              error={daftarKamar.isError ? toMessage(daftarKamar.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
              rowKey={(row) => row.id}
              onRetry={() => void daftarKamar.refetch()}
              emptyTitle="Belum ada kamar pada tipe ini."
            />
          )}
        </div>
      </div>

      {tambahProperti && (
        <Modal judul="Tambah Properti" onClose={() => setTambahProperti(false)}>
          <Field label="Kode *">
            <input className="field-input" value={formProperti.code} onChange={(e) => setFormProperti({ ...formProperti, code: e.target.value })} />
          </Field>
          <Field label="Nama *">
            <input className="field-input" value={formProperti.nama} onChange={(e) => setFormProperti({ ...formProperti, nama: e.target.value })} />
          </Field>
          <Field label="Zona Waktu">
            <input className="field-input" value={formProperti.timezone} onChange={(e) => setFormProperti({ ...formProperti, timezone: e.target.value })} />
          </Field>
          <Field label="Alamat">
            <textarea className="field-input" rows={2} value={formProperti.alamat} onChange={(e) => setFormProperti({ ...formProperti, alamat: e.target.value })} />
          </Field>
          <ModalFooter
            onBatal={() => setTambahProperti(false)}
            onSimpan={() => catatProperti.mutate()}
            simpanDisabled={!formProperti.code || !formProperti.nama || catatProperti.isPending}
          />
        </Modal>
      )}

      {tambahTipeKamar && propertiDipilih && (
        <Modal judul={`Tambah Tipe Kamar — ${propertiDipilih.nama}`} onClose={() => setTambahTipeKamar(false)}>
          <Field label="Kode *">
            <input className="field-input" value={formTipeKamar.code} onChange={(e) => setFormTipeKamar({ ...formTipeKamar, code: e.target.value })} />
          </Field>
          <Field label="Nama *">
            <input className="field-input" value={formTipeKamar.nama} onChange={(e) => setFormTipeKamar({ ...formTipeKamar, nama: e.target.value })} />
          </Field>
          <Field label="Okupansi Maksimum *">
            <input type="number" min="1" className="field-input" value={formTipeKamar.okupansiMaks} onChange={(e) => setFormTipeKamar({ ...formTipeKamar, okupansiMaks: e.target.value })} />
          </Field>
          <Field label="Deskripsi">
            <textarea className="field-input" rows={2} value={formTipeKamar.deskripsi} onChange={(e) => setFormTipeKamar({ ...formTipeKamar, deskripsi: e.target.value })} />
          </Field>
          <ModalFooter
            onBatal={() => setTambahTipeKamar(false)}
            onSimpan={() => catatTipeKamar.mutate()}
            simpanDisabled={!formTipeKamar.code || !formTipeKamar.nama || !formTipeKamar.okupansiMaks || catatTipeKamar.isPending}
          />
        </Modal>
      )}

      {tambahKamar && tipeKamarDipilih && (
        <Modal judul={`Tambah Kamar — ${tipeKamarDipilih.nama}`} onClose={() => setTambahKamar(false)}>
          <Field label="Nomor Kamar *">
            <input className="field-input" value={formKamar.nomorKamar} onChange={(e) => setFormKamar({ ...formKamar, nomorKamar: e.target.value })} />
          </Field>
          <Field label="Lantai">
            <input className="field-input" value={formKamar.lantai} onChange={(e) => setFormKamar({ ...formKamar, lantai: e.target.value })} />
          </Field>
          <ModalFooter
            onBatal={() => setTambahKamar(false)}
            onSimpan={() => catatKamar.mutate()}
            simpanDisabled={!formKamar.nomorKamar || catatKamar.isPending}
          />
        </Modal>
      )}
    </>
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
