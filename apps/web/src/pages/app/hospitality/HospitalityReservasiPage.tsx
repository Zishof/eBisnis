import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

const SUMBER_RESERVASI = ['DIRECT', 'WALK_IN', 'PHONE', 'OTA', 'WEBSITE', 'OTHER'];
const PAGE_SIZE = 25;

interface PropertiRow {
  id: string;
  code: string;
  nama: string;
}

interface TipeKamarRow {
  id: string;
  code: string;
  nama: string;
}

interface RoomStayRow {
  id: string;
  room_type_id: string;
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  rate_amount: string;
}

interface ReservasiRow extends Record<string, unknown> {
  id: string;
  code: string;
  property_id: string;
  guest_id: string;
  status: string;
  source: string;
  market_segment: string | null;
  special_requests: string | null;
  cancel_reason: string | null;
  version: number;
  created_at: string;
}

interface DetailReservasi extends ReservasiRow {
  room_stays: RoomStayRow[];
}

interface FormKamarBaris {
  roomTypeId: string;
  checkinDate: string;
  checkoutDate: string;
  adults: string;
  children: string;
  rateAmount: string;
}

const KAMAR_KOSONG = (): FormKamarBaris => ({
  roomTypeId: '',
  checkinDate: '',
  checkoutDate: '',
  adults: '1',
  children: '0',
  rateAmount: '',
});

/**
 * Reservasi dan siklus hidupnya (MI-8). Pola sama dengan
 * `HospitalityTamuPage`/`HospitalityPropertiPage`.
 *
 * Kunci optimistik ditampilkan apa adanya ke pengguna: tombol aksi status
 * mengirim `version` yang sedang dilihat layar, dan bila API menolak
 * (409, sudah diubah pihak lain) layar memuat ulang detail alih-alih
 * mencoba lagi diam-diam -- pengguna melihat data terbaru, bukan galat
 * teknis yang tidak dapat ditindaklanjuti.
 */
export function HospitalityReservasiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [halaman, setHalaman] = useState(1);
  const [filterStatus, setFilterStatus] = useState('');
  const [reservasiDipilih, setReservasiDipilih] = useState<string | null>(null);
  const [tambahReservasi, setTambahReservasi] = useState(false);
  const [formReservasi, setFormReservasi] = useState({
    propertyId: '',
    guestId: '',
    source: 'DIRECT',
    marketSegment: '',
    specialRequests: '',
    statusAwal: 'HOLD',
  });
  const [formKamar, setFormKamar] = useState<FormKamarBaris[]>([KAMAR_KOSONG()]);
  const [batalkanAlasan, setBatalkanAlasan] = useState('');

  const daftarProperti = useQuery({
    queryKey: ['hospitality-properti-ringkas'],
    queryFn: () => api.get<PropertiRow[]>('/hospitality/properti'),
  });

  const daftarTipeKamar = useQuery({
    queryKey: ['hospitality-tipe-kamar-ringkas', formReservasi.propertyId],
    queryFn: () => api.get<TipeKamarRow[]>(`/hospitality/properti/${formReservasi.propertyId}/tipe-kamar`),
    enabled: !!formReservasi.propertyId && tambahReservasi,
  });

  const daftar = useQuery({
    queryKey: ['hospitality-reservasi', halaman, filterStatus],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(halaman), ukuranHalaman: String(PAGE_SIZE) });
      if (filterStatus) params.set('status', filterStatus);
      return api.get<{ items: ReservasiRow[]; total: number }>(`/hospitality/reservasi?${params.toString()}`);
    },
  });

  const detail = useQuery({
    queryKey: ['hospitality-reservasi-detail', reservasiDipilih],
    queryFn: () => api.get<DetailReservasi>(`/hospitality/reservasi/${reservasiDipilih}`),
    enabled: !!reservasiDipilih,
  });

  const catatReservasi = useMutation({
    mutationFn: () =>
      api.post<ReservasiRow>('/hospitality/reservasi', {
        propertyId: formReservasi.propertyId,
        guestId: formReservasi.guestId,
        source: formReservasi.source,
        marketSegment: formReservasi.marketSegment || undefined,
        specialRequests: formReservasi.specialRequests || undefined,
        statusAwal: formReservasi.statusAwal,
        roomStays: formKamar.map((k) => ({
          roomTypeId: k.roomTypeId,
          checkinDate: k.checkinDate,
          checkoutDate: k.checkoutDate,
          adults: Number(k.adults) || 1,
          children: Number(k.children) || 0,
          rateAmount: Number(k.rateAmount),
        })),
      }),
    onSuccess: () => {
      toast.push('Reservasi berhasil dicatat.', 'success');
      setTambahReservasi(false);
      setFormReservasi({ propertyId: '', guestId: '', source: 'DIRECT', marketSegment: '', specialRequests: '', statusAwal: 'HOLD' });
      setFormKamar([KAMAR_KOSONG()]);
      void queryClient.invalidateQueries({ queryKey: ['hospitality-reservasi'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat reservasi.'), 'error'),
  });

  const ubahStatus = useMutation({
    mutationFn: ({ aksi, body }: { aksi: string; body: Record<string, unknown> }) =>
      api.post(`/hospitality/reservasi/${reservasiDipilih}/${aksi}`, body),
    onSuccess: () => {
      toast.push('Status reservasi diperbarui.', 'success');
      setBatalkanAlasan('');
      void queryClient.invalidateQueries({ queryKey: ['hospitality-reservasi-detail', reservasiDipilih] });
      void queryClient.invalidateQueries({ queryKey: ['hospitality-reservasi'] });
    },
    onError: (error) => {
      // Kunci optimistik: 409 berarti orang lain sudah mengubahnya --
      // muat ulang detail supaya pengguna melihat versi terbaru, bukan
      // mencoba mengirim ulang version yang sudah basi.
      void queryClient.invalidateQueries({ queryKey: ['hospitality-reservasi-detail', reservasiDipilih] });
      toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mengubah status.'), 'error');
    },
  });

  const kolom: Array<GridColumn<ReservasiRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'source', header: 'Sumber' },
    { key: 'created_at', header: 'Dicatat', render: (row) => formatDate(row.created_at) },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button type="button" className="btn-outline" onClick={() => setReservasiDipilih(row.id)}>
          Detail
        </button>
      ),
    },
  ];

  const total = daftar.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const tambahBarisKamar = () => setFormKamar([...formKamar, KAMAR_KOSONG()]);
  const hapusBarisKamar = (i: number) => setFormKamar(formKamar.filter((_, idx) => idx !== i));
  const ubahBarisKamar = (i: number, patch: Partial<FormKamarBaris>) =>
    setFormKamar(formKamar.map((k, idx) => (idx === i ? { ...k, ...patch } : k)));

  const formValid =
    formReservasi.propertyId &&
    formReservasi.guestId &&
    formKamar.every((k) => k.roomTypeId && k.checkinDate && k.checkoutDate && k.rateAmount);

  return (
    <>
      <PageHeader
        title="Reservasi"
        description="Siklus hidup reservasi -- hold, konfirmasi, ubah, batal, no-show, pulihkan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Hospitality' }, { label: 'Reservasi' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end justify-between gap-3 p-4">
        <div className="w-full max-w-xs">
          <label className="field-label">Status</label>
          <select
            className="field-input"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setHalaman(1);
            }}
          >
            <option value="">Semua status</option>
            <option value="HOLD">HOLD</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
            <option value="NO_SHOW">NO_SHOW</option>
          </select>
        </div>
        <button type="button" className="btn-primary" onClick={() => setTambahReservasi(true)}>
          <Plus className="h-4 w-4" aria-hidden />
          Tambah Reservasi
        </button>
      </div>

      <DataGrid
        columns={kolom}
        rows={daftar.data?.items ?? []}
        loading={daftar.isLoading}
        error={daftar.isError ? toMessage(daftar.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void daftar.refetch()}
        emptyTitle="Belum ada reservasi."
      />
      <Pagination page={halaman} totalPages={totalPages} total={total} onChange={setHalaman} />

      {tambahReservasi && (
        <Modal judul="Tambah Reservasi" onClose={() => setTambahReservasi(false)}>
          <Field label="Properti *">
            <select
              className="field-input"
              value={formReservasi.propertyId}
              onChange={(e) => setFormReservasi({ ...formReservasi, propertyId: e.target.value })}
            >
              <option value="">— Pilih properti —</option>
              {(daftarProperti.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.nama}
                </option>
              ))}
            </select>
          </Field>
          <Field label="ID Tamu Utama *">
            <input
              className="field-input"
              placeholder="ID profil tamu (lihat halaman Tamu)"
              value={formReservasi.guestId}
              onChange={(e) => setFormReservasi({ ...formReservasi, guestId: e.target.value })}
            />
          </Field>
          <Field label="Sumber">
            <select
              className="field-input"
              value={formReservasi.source}
              onChange={(e) => setFormReservasi({ ...formReservasi, source: e.target.value })}
            >
              {SUMBER_RESERVASI.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status Awal">
            <select
              className="field-input"
              value={formReservasi.statusAwal}
              onChange={(e) => setFormReservasi({ ...formReservasi, statusAwal: e.target.value })}
            >
              <option value="HOLD">HOLD</option>
              <option value="CONFIRMED">CONFIRMED</option>
            </select>
          </Field>
          <Field label="Permintaan Khusus">
            <textarea
              className="field-input"
              rows={2}
              value={formReservasi.specialRequests}
              onChange={(e) => setFormReservasi({ ...formReservasi, specialRequests: e.target.value })}
            />
          </Field>

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Kamar</h3>
              <button type="button" className="btn-outline text-xs" onClick={tambahBarisKamar}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Tambah Kamar
              </button>
            </div>
            {formKamar.map((k, i) => (
              <div key={i} className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <Field label="Tipe Kamar *">
                  <select
                    className="field-input"
                    value={k.roomTypeId}
                    onChange={(e) => ubahBarisKamar(i, { roomTypeId: e.target.value })}
                    disabled={!formReservasi.propertyId}
                  >
                    <option value="">— Pilih tipe kamar —</option>
                    {(daftarTipeKamar.data ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.nama}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Check-in *">
                    <input type="date" className="field-input" value={k.checkinDate} onChange={(e) => ubahBarisKamar(i, { checkinDate: e.target.value })} />
                  </Field>
                  <Field label="Check-out *">
                    <input type="date" className="field-input" value={k.checkoutDate} onChange={(e) => ubahBarisKamar(i, { checkoutDate: e.target.value })} />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Dewasa">
                    <input type="number" min="1" className="field-input" value={k.adults} onChange={(e) => ubahBarisKamar(i, { adults: e.target.value })} />
                  </Field>
                  <Field label="Anak">
                    <input type="number" min="0" className="field-input" value={k.children} onChange={(e) => ubahBarisKamar(i, { children: e.target.value })} />
                  </Field>
                  <Field label="Tarif (Rp) *">
                    <input type="number" min="0" className="field-input" value={k.rateAmount} onChange={(e) => ubahBarisKamar(i, { rateAmount: e.target.value })} />
                  </Field>
                </div>
                {formKamar.length > 1 && (
                  <button type="button" className="text-xs text-rose-600" onClick={() => hapusBarisKamar(i)}>
                    Hapus kamar ini
                  </button>
                )}
              </div>
            ))}
          </div>

          <ModalFooter
            onBatal={() => setTambahReservasi(false)}
            onSimpan={() => catatReservasi.mutate()}
            simpanDisabled={!formValid || catatReservasi.isPending}
          />
        </Modal>
      )}

      {reservasiDipilih && detail.data && (
        <Modal judul={`Reservasi ${detail.data.code}`} onClose={() => setReservasiDipilih(null)}>
          <div className="flex items-center gap-2">
            <StatusBadge status={detail.data.status} />
            <span className="text-xs text-slate-500 dark:text-slate-400">v{detail.data.version}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Sumber</span>
              <p>{detail.data.source}</p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Segmen Pasar</span>
              <p>{detail.data.market_segment ?? '—'}</p>
            </div>
          </div>

          {detail.data.cancel_reason && (
            <p className="text-sm text-rose-600 dark:text-rose-400">Alasan batal: {detail.data.cancel_reason}</p>
          )}

          <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
            <h3 className="text-sm font-semibold">Kamar</h3>
            <ul className="mt-2 space-y-2">
              {detail.data.room_stays.map((rs) => (
                <li key={rs.id} className="rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-800">
                  {formatDate(rs.checkin_date)} — {formatDate(rs.checkout_date)} · {rs.adults} dewasa, {rs.children} anak · Rp{Number(rs.rate_amount).toLocaleString('id-ID')}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            {detail.data.status === 'HOLD' && (
              <button
                type="button"
                className="btn-primary"
                onClick={() => ubahStatus.mutate({ aksi: 'konfirmasi', body: { expectedVersion: detail.data!.version } })}
              >
                Konfirmasi
              </button>
            )}
            {(detail.data.status === 'HOLD' || detail.data.status === 'CONFIRMED') && (
              <>
                <input
                  className="field-input"
                  placeholder="Alasan pembatalan"
                  value={batalkanAlasan}
                  onChange={(e) => setBatalkanAlasan(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-outline"
                  disabled={!batalkanAlasan.trim()}
                  onClick={() =>
                    ubahStatus.mutate({
                      aksi: 'batalkan',
                      body: { expectedVersion: detail.data!.version, alasan: batalkanAlasan },
                    })
                  }
                >
                  Batalkan
                </button>
              </>
            )}
            {detail.data.status === 'CONFIRMED' && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => ubahStatus.mutate({ aksi: 'no-show', body: { expectedVersion: detail.data!.version } })}
              >
                Tandai No-Show
              </button>
            )}
            {(detail.data.status === 'CANCELLED' || detail.data.status === 'NO_SHOW') && (
              <button
                type="button"
                className="btn-outline"
                onClick={() => ubahStatus.mutate({ aksi: 'pulihkan', body: { expectedVersion: detail.data!.version } })}
              >
                Pulihkan
              </button>
            )}
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
