import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

const STATUS_BLOKIR = ['BLOCKED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'];

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
  features: string[];
  created_at: string;
}

interface Ketersediaan {
  room_type_id: string;
  total_kamar: number;
  overbooking_limit: number;
  tersedia: number;
  per_malam: Array<{ tanggal: string; tersedia: number }>;
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
  const [formKamar, setFormKamar] = useState({ nomorKamar: '', lantai: '', features: '' });
  const [kamarDiblokir, setKamarDiblokir] = useState<KamarRow | null>(null);
  const [formBlokir, setFormBlokir] = useState({ checkin: '', checkout: '', status: 'OUT_OF_ORDER', alasan: '' });
  const [rentangKetersediaan, setRentangKetersediaan] = useState({ checkin: '', checkout: '' });

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

  const ketersediaan = useQuery({
    queryKey: ['hospitality-ketersediaan', tipeKamarDipilih?.id, rentangKetersediaan.checkin, rentangKetersediaan.checkout],
    queryFn: () =>
      api.get<Ketersediaan>(
        `/hospitality/properti/${propertiDipilih!.id}/tipe-kamar/${tipeKamarDipilih!.id}/ketersediaan` +
          `?checkin=${rentangKetersediaan.checkin}&checkout=${rentangKetersediaan.checkout}`,
      ),
    enabled: !!tipeKamarDipilih && !!rentangKetersediaan.checkin && !!rentangKetersediaan.checkout,
  });

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
        features: formKamar.features
          ? formKamar.features.split(',').map((f) => f.trim().toUpperCase()).filter(Boolean)
          : undefined,
      }),
    onSuccess: () => {
      toast.push('Kamar berhasil dicatat.', 'success');
      setTambahKamar(false);
      setFormKamar({ nomorKamar: '', lantai: '', features: '' });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-kamar', propertiDipilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const blokirMutasi = useMutation({
    mutationFn: () =>
      api.post(`/hospitality/properti/${propertiDipilih!.id}/kamar/${kamarDiblokir!.id}/blok`, {
        checkin: formBlokir.checkin,
        checkout: formBlokir.checkout,
        status: formBlokir.status,
        alasan: formBlokir.alasan || undefined,
      }),
    onSuccess: () => {
      toast.push('Kamar berhasil diblokir untuk rentang tanggal tersebut.', 'success');
      setKamarDiblokir(null);
      setFormBlokir({ checkin: '', checkout: '', status: 'OUT_OF_ORDER', alasan: '' });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-ketersediaan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memblokir kamar.'), 'error'),
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
    {
      key: 'features',
      header: 'Fitur',
      render: (row) => (row.features?.length ? row.features.join(', ') : '—'),
    },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn-outline inline-flex items-center gap-1"
          onClick={() => setKamarDiblokir(row)}
        >
          <Ban className="h-3.5 w-3.5" aria-hidden />
          Blokir
        </button>
      ),
    },
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

      {tipeKamarDipilih && (
        <div className="card mt-6 p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Ketersediaan — {tipeKamarDipilih.nama}
          </h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label="Check-in">
              <input
                type="date"
                className="field-input"
                value={rentangKetersediaan.checkin}
                onChange={(e) => setRentangKetersediaan({ ...rentangKetersediaan, checkin: e.target.value })}
              />
            </Field>
            <Field label="Check-out">
              <input
                type="date"
                className="field-input"
                value={rentangKetersediaan.checkout}
                onChange={(e) => setRentangKetersediaan({ ...rentangKetersediaan, checkout: e.target.value })}
              />
            </Field>
          </div>

          {ketersediaan.isLoading && rentangKetersediaan.checkin && (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Menghitung...</p>
          )}
          {ketersediaan.isError && (
            <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">
              {toMessage(ketersediaan.error, (_key, fallback) => fallback ?? 'Gagal menghitung ketersediaan.')}
            </p>
          )}
          {ketersediaan.data && (
            <div className="mt-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <span>
                  Total kamar: <strong>{ketersediaan.data.total_kamar}</strong>
                </span>
                <span>
                  Alotmen tambahan: <strong>{ketersediaan.data.overbooking_limit}</strong>
                </span>
                <span>
                  Tersedia untuk seluruh rentang: <strong>{ketersediaan.data.tersedia}</strong>
                </span>
              </div>
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-start text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="py-1 text-start">Tanggal</th>
                    <th className="py-1 text-start">Tersedia (malam itu)</th>
                  </tr>
                </thead>
                <tbody>
                  {ketersediaan.data.per_malam.map((m) => (
                    <tr key={m.tanggal} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1">{formatDate(m.tanggal)}</td>
                      <td className="py-1">{m.tersedia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
          <Field label="Fitur (pisahkan dengan koma)">
            <input
              className="field-input"
              placeholder="CITY_VIEW, NON_SMOKING, BALCONY"
              value={formKamar.features}
              onChange={(e) => setFormKamar({ ...formKamar, features: e.target.value })}
            />
          </Field>
          <ModalFooter
            onBatal={() => setTambahKamar(false)}
            onSimpan={() => catatKamar.mutate()}
            simpanDisabled={!formKamar.nomorKamar || catatKamar.isPending}
          />
        </Modal>
      )}

      {kamarDiblokir && (
        <Modal judul={`Blokir Kamar — ${kamarDiblokir.nomor_kamar}`} onClose={() => setKamarDiblokir(null)}>
          <Field label="Check-in *">
            <input
              type="date"
              className="field-input"
              value={formBlokir.checkin}
              onChange={(e) => setFormBlokir({ ...formBlokir, checkin: e.target.value })}
            />
          </Field>
          <Field label="Check-out *">
            <input
              type="date"
              className="field-input"
              value={formBlokir.checkout}
              onChange={(e) => setFormBlokir({ ...formBlokir, checkout: e.target.value })}
            />
          </Field>
          <Field label="Status *">
            <select
              className="field-input"
              value={formBlokir.status}
              onChange={(e) => setFormBlokir({ ...formBlokir, status: e.target.value })}
            >
              {STATUS_BLOKIR.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alasan">
            <textarea
              className="field-input"
              rows={2}
              value={formBlokir.alasan}
              onChange={(e) => setFormBlokir({ ...formBlokir, alasan: e.target.value })}
            />
          </Field>
          <ModalFooter
            onBatal={() => setKamarDiblokir(null)}
            onSimpan={() => blokirMutasi.mutate()}
            simpanDisabled={!formBlokir.checkin || !formBlokir.checkout || blokirMutasi.isPending}
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
