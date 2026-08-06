/**
 * Kelola pemesanan mandiri (MI-9) -- lihat dan batalkan tanpa login staf,
 * diverifikasi lewat kode + kontak (bukan kode saja, lihat catatan
 * `lihatPemesanan` di `hospitality-booking-engine.service.ts`).
 */

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { api, formatDate } from '../../lib/api';

interface RoomStay {
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  rate_amount: string;
}

interface DetailReservasi {
  code: string;
  status: string;
  cancel_reason: string | null;
  room_stays: RoomStay[];
}

export function MitrainapKelolaPesananPage() {
  const { schemaName } = useParams<{ schemaName: string }>();
  const [form, setForm] = useState({ code: '', kontak: '' });
  const [alasanBatal, setAlasanBatal] = useState('');
  const [reservasi, setReservasi] = useState<DetailReservasi | null>(null);
  const [galat, setGalat] = useState<string | null>(null);

  const cari = useMutation({
    mutationFn: () =>
      api.get<DetailReservasi>(
        `/public/hospitality/${schemaName}/reservasi/${encodeURIComponent(form.code.trim())}?kontak=${encodeURIComponent(form.kontak.trim())}`,
      ),
    onSuccess: (data) => {
      setReservasi(data);
      setGalat(null);
    },
    onError: () => {
      setReservasi(null);
      setGalat('Pemesanan tidak ditemukan. Periksa kembali kode dan kontak Anda.');
    },
  });

  const batalkan = useMutation({
    mutationFn: () =>
      api.post<DetailReservasi>(`/public/hospitality/${schemaName}/reservasi/${reservasi!.code}/batalkan`, {
        kontak: form.kontak.trim(),
        alasan: alasanBatal,
      }),
    onSuccess: (data) => {
      setReservasi(data);
      setAlasanBatal('');
    },
    onError: () => setGalat('Gagal membatalkan pemesanan. Coba lagi.'),
  });

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kelola Pemesanan</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Masukkan kode pemesanan beserta email/telepon yang Anda daftarkan saat memesan.
      </p>

      <div className="card mt-6 space-y-3 p-4">
        <Field label="Kode Pemesanan">
          <input className="field-input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="RES-000001" />
        </Field>
        <Field label="Email atau Telepon">
          <input className="field-input" value={form.kontak} onChange={(e) => setForm({ ...form, kontak: e.target.value })} />
        </Field>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!form.code.trim() || !form.kontak.trim() || cari.isPending}
          onClick={() => cari.mutate()}
        >
          Cari Pemesanan
        </button>
      </div>

      {galat && <p className="mt-4 text-sm text-rose-600 dark:text-rose-400">{galat}</p>}

      {reservasi && (
        <div className="card mt-6 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{reservasi.code}</h2>
            <span className="badge">{reservasi.status}</span>
          </div>
          {reservasi.room_stays.map((rs, i) => (
            <p key={i} className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {formatDate(rs.checkin_date)} — {formatDate(rs.checkout_date)} · {rs.adults} dewasa, {rs.children} anak · Rp{Number(rs.rate_amount).toLocaleString('id-ID')}
            </p>
          ))}
          {reservasi.cancel_reason && (
            <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">Alasan batal: {reservasi.cancel_reason}</p>
          )}

          {(reservasi.status === 'HOLD' || reservasi.status === 'CONFIRMED') && (
            <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Field label="Alasan pembatalan">
                <input className="field-input" value={alasanBatal} onChange={(e) => setAlasanBatal(e.target.value)} />
              </Field>
              <button
                type="button"
                className="btn-outline mt-2"
                disabled={!alasanBatal.trim() || batalkan.isPending}
                onClick={() => batalkan.mutate()}
              >
                Batalkan Pemesanan
              </button>
            </div>
          )}
        </div>
      )}
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
