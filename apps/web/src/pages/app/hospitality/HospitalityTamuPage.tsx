import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Plus, ShieldAlert } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

const JENIS_IDENTITAS = ['KTP', 'PASSPORT', 'SIM', 'KITAS', 'OTHER'];
const PAGE_SIZE = 25;

interface TamuRow extends Record<string, unknown> {
  id: string;
  code: string;
  full_name: string;
  identifier_type: string | null;
  identifier_number: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  nationality: string | null;
  preferences: string | null;
  marketing_consent: boolean;
  do_not_rent: boolean;
  do_not_rent_reason: string | null;
  created_at: string;
}

interface PermintaanPrivasiRow extends Record<string, unknown> {
  id: string;
  guest_id: string;
  request_type: string;
  status: string;
  notes: string | null;
  requested_at: string;
  completed_at: string | null;
}

const FORM_TAMU_KOSONG = {
  namaLengkap: '',
  jenisIdentitas: '',
  nomorIdentitas: '',
  email: '',
  telepon: '',
  alamat: '',
};

/**
 * Profil tamu (CRM), consent, do-not-rent, penggabungan, dan permintaan
 * privasi (MI-7). Pola sama dengan `HospitalityPropertiPage`.
 *
 * Companion/relationship dan tautan perusahaan/travel agent SENGAJA belum
 * ada -- lihat catatan migrasi, menyusul MI-18 begitu ada pemakainya.
 */
export function HospitalityTamuPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [halaman, setHalaman] = useState(1);
  const [cari, setCari] = useState('');
  const [tamuDipilih, setTamuDipilih] = useState<TamuRow | null>(null);
  const [tambahTamu, setTambahTamu] = useState(false);
  const [formTamu, setFormTamu] = useState(FORM_TAMU_KOSONG);
  const [gabungTarget, setGabungTarget] = useState('');
  const [formDoNotRent, setFormDoNotRent] = useState({ aktif: false, alasan: '' });

  const daftar = useQuery({
    queryKey: ['hospitality-tamu', halaman, cari],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(halaman), ukuranHalaman: String(PAGE_SIZE) });
      if (cari) params.set('cari', cari);
      return api.get<{ items: TamuRow[]; total: number }>(`/hospitality/tamu?${params.toString()}`);
    },
  });

  const kemiripan = useQuery({
    queryKey: ['hospitality-tamu-kemiripan', formTamu.namaLengkap, formTamu.telepon],
    queryFn: () => {
      const params = new URLSearchParams();
      if (formTamu.namaLengkap) params.set('namaLengkap', formTamu.namaLengkap);
      if (formTamu.telepon) params.set('telepon', formTamu.telepon);
      return api.get<TamuRow[]>(`/hospitality/tamu/cari-kemiripan?${params.toString()}`);
    },
    enabled: tambahTamu && (formTamu.namaLengkap.trim().length > 2 || formTamu.telepon.trim().length > 3),
  });

  const permintaanPrivasi = useQuery({
    queryKey: ['hospitality-tamu-privasi', tamuDipilih?.id],
    queryFn: () => api.get<PermintaanPrivasiRow[]>(`/hospitality/tamu/${tamuDipilih!.id}/permintaan-privasi`),
    enabled: !!tamuDipilih,
  });

  const catatTamu = useMutation({
    mutationFn: () =>
      api.post<TamuRow>('/hospitality/tamu', {
        namaLengkap: formTamu.namaLengkap,
        jenisIdentitas: formTamu.jenisIdentitas || undefined,
        nomorIdentitas: formTamu.nomorIdentitas || undefined,
        email: formTamu.email || undefined,
        telepon: formTamu.telepon || undefined,
        alamat: formTamu.alamat || undefined,
      }),
    onSuccess: () => {
      toast.push('Tamu berhasil dicatat.', 'success');
      setTambahTamu(false);
      setFormTamu(FORM_TAMU_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const aturConsent = useMutation({
    mutationFn: (marketingConsent: boolean) =>
      api.post<TamuRow>(`/hospitality/tamu/${tamuDipilih!.id}/consent`, { marketingConsent }),
    onSuccess: (data) => {
      toast.push('Consent pemasaran diperbarui.', 'success');
      setTamuDipilih(data);
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const aturDoNotRent = useMutation({
    mutationFn: () =>
      api.post<TamuRow>(`/hospitality/tamu/${tamuDipilih!.id}/do-not-rent`, {
        doNotRent: formDoNotRent.aktif,
        alasan: formDoNotRent.alasan || undefined,
      }),
    onSuccess: (data) => {
      toast.push('Status do-not-rent diperbarui.', 'success');
      setTamuDipilih(data);
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const gabungkan = useMutation({
    mutationFn: () => api.post(`/hospitality/tamu/${tamuDipilih!.id}/gabung`, { intoGuestId: gabungTarget }),
    onSuccess: () => {
      toast.push('Profil tamu berhasil digabungkan.', 'success');
      setTamuDipilih(null);
      setGabungTarget('');
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menggabungkan.'), 'error'),
  });

  const ajukanPrivasi = useMutation({
    mutationFn: (jenis: 'EXPORT' | 'ERASURE') =>
      api.post(`/hospitality/tamu/${tamuDipilih!.id}/permintaan-privasi`, { jenis }),
    onSuccess: () => {
      toast.push('Permintaan privasi dicatat.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu-privasi', tamuDipilih?.id] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat permintaan.'), 'error'),
  });

  const prosesPrivasi = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'COMPLETED' | 'REJECTED' }) =>
      api.post(`/hospitality/tamu/permintaan-privasi/${id}/proses`, { status }),
    onSuccess: () => {
      toast.push('Permintaan privasi diproses.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu-privasi', tamuDipilih?.id] });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-tamu'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memproses.'), 'error'),
  });

  const kolom: Array<GridColumn<TamuRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'full_name', header: 'Nama' },
    { key: 'phone', header: 'Telepon', render: (row) => row.phone ?? '—' },
    {
      key: 'do_not_rent',
      header: 'Status',
      render: (row) =>
        row.do_not_rent ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <ShieldAlert className="h-3 w-3" aria-hidden />
            Do-Not-Rent
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setTamuDipilih(row);
            setFormDoNotRent({ aktif: row.do_not_rent, alasan: row.do_not_rent_reason ?? '' });
          }}
        >
          Detail
        </button>
      ),
    },
  ];

  const total = daftar.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Tamu (CRM)"
        description="Profil tamu, consent, do-not-rent, dan permintaan privasi."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Hospitality' }, { label: 'Tamu' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="w-full max-w-xs">
          <label className="field-label">Cari (nama/telepon/nomor identitas)</label>
          <input
            className="field-input"
            value={cari}
            onChange={(e) => {
              setCari(e.target.value);
              setHalaman(1);
            }}
          />
        </div>
        <button type="button" className="btn-primary" onClick={() => setTambahTamu(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Tamu
        </button>
      </div>

      <DataGrid
        columns={kolom}
        rows={daftar.data?.items ?? []}
        loading={daftar.isLoading}
        error={daftar.isError ? toMessage(daftar.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void daftar.refetch()}
        emptyTitle="Belum ada tamu tercatat."
      />
      <Pagination page={halaman} totalPages={totalPages} total={total} onChange={setHalaman} />

      {tambahTamu && (
        <Modal judul="Tambah Tamu" onClose={() => setTambahTamu(false)}>
          <Field label="Nama Lengkap *">
            <input
              className="field-input"
              value={formTamu.namaLengkap}
              onChange={(e) => setFormTamu({ ...formTamu, namaLengkap: e.target.value })}
            />
          </Field>

          {kemiripan.data && kemiripan.data.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Mungkin sudah pernah terdaftar
              </div>
              <ul className="mt-2 space-y-1">
                {kemiripan.data.map((k) => (
                  <li key={k.id} className="text-amber-800 dark:text-amber-300">
                    {k.code} — {k.full_name} {k.phone ? `(${k.phone})` : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                Bila memang orang yang sama, batalkan dan gunakan profil yang sudah ada.
              </p>
            </div>
          )}

          <Field label="Jenis Identitas">
            <select
              className="field-input"
              value={formTamu.jenisIdentitas}
              onChange={(e) => setFormTamu({ ...formTamu, jenisIdentitas: e.target.value })}
            >
              <option value="">— Tidak diisi —</option>
              {JENIS_IDENTITAS.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nomor Identitas">
            <input
              className="field-input"
              value={formTamu.nomorIdentitas}
              onChange={(e) => setFormTamu({ ...formTamu, nomorIdentitas: e.target.value })}
            />
          </Field>
          <Field label="Email">
            <input
              className="field-input"
              value={formTamu.email}
              onChange={(e) => setFormTamu({ ...formTamu, email: e.target.value })}
            />
          </Field>
          <Field label="Telepon">
            <input
              className="field-input"
              value={formTamu.telepon}
              onChange={(e) => setFormTamu({ ...formTamu, telepon: e.target.value })}
            />
          </Field>
          <Field label="Alamat">
            <textarea
              className="field-input"
              rows={2}
              value={formTamu.alamat}
              onChange={(e) => setFormTamu({ ...formTamu, alamat: e.target.value })}
            />
          </Field>
          <ModalFooter
            onBatal={() => setTambahTamu(false)}
            onSimpan={() => catatTamu.mutate()}
            simpanDisabled={!formTamu.namaLengkap || catatTamu.isPending}
          />
        </Modal>
      )}

      {tamuDipilih && (
        <Modal judul={`Detail Tamu — ${tamuDipilih.full_name}`} onClose={() => setTamuDipilih(null)}>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Kode</span>
              <p>{tamuDipilih.code}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Identitas</span>
              <p>
                {tamuDipilih.identifier_type
                  ? `${tamuDipilih.identifier_type} — ${tamuDipilih.identifier_number}`
                  : '—'}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <p>{tamuDipilih.email ?? '—'}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Telepon</span>
              <p>{tamuDipilih.phone ?? '—'}</p>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={tamuDipilih.marketing_consent}
                onChange={(e) => aturConsent.mutate(e.target.checked)}
              />
              Setuju menerima komunikasi pemasaran
            </label>
          </div>

          <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={formDoNotRent.aktif}
                onChange={(e) => setFormDoNotRent({ ...formDoNotRent, aktif: e.target.checked })}
              />
              Do-Not-Rent (larangan menginap)
            </label>
            {formDoNotRent.aktif && (
              <Field label="Alasan *">
                <textarea
                  className="field-input"
                  rows={2}
                  value={formDoNotRent.alasan}
                  onChange={(e) => setFormDoNotRent({ ...formDoNotRent, alasan: e.target.value })}
                />
              </Field>
            )}
            <button
              type="button"
              className="btn-outline mt-2"
              disabled={(formDoNotRent.aktif && !formDoNotRent.alasan.trim()) || aturDoNotRent.isPending}
              onClick={() => aturDoNotRent.mutate()}
            >
              Simpan Status Do-Not-Rent
            </button>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Gabungkan ke Profil Lain</h3>
            <div className="mt-2 flex gap-2">
              <input
                className="field-input"
                placeholder="ID profil tujuan"
                value={gabungTarget}
                onChange={(e) => setGabungTarget(e.target.value)}
              />
              <button
                type="button"
                className="btn-outline shrink-0"
                disabled={!gabungTarget || gabungkan.isPending}
                onClick={() => gabungkan.mutate()}
              >
                Gabungkan
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Permintaan Privasi</h3>
              <div className="flex gap-2">
                <button type="button" className="btn-outline text-xs" onClick={() => ajukanPrivasi.mutate('EXPORT')}>
                  Ajukan Ekspor
                </button>
                <button type="button" className="btn-outline text-xs" onClick={() => ajukanPrivasi.mutate('ERASURE')}>
                  Ajukan Penghapusan
                </button>
              </div>
            </div>
            <ul className="mt-2 space-y-2">
              {(permintaanPrivasi.data ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
                  <span>
                    {p.request_type} — {p.status} — {formatDate(p.requested_at)}
                  </span>
                  {p.status === 'PENDING' && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => prosesPrivasi.mutate({ id: p.id, status: 'COMPLETED' })}
                      >
                        Selesaikan
                      </button>
                      <button
                        type="button"
                        className="btn-outline"
                        onClick={() => prosesPrivasi.mutate({ id: p.id, status: 'REJECTED' })}
                      >
                        Tolak
                      </button>
                    </div>
                  )}
                </li>
              ))}
              {(permintaanPrivasi.data ?? []).length === 0 && (
                <li className="text-xs text-slate-500 dark:text-slate-400">Belum ada permintaan privasi.</li>
              )}
            </ul>
          </div>
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
