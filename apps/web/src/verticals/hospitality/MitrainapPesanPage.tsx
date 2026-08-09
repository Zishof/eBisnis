/**
 * Booking engine publik MitraInap (MI-9) -- cari, pesan, dan kelola
 * pemesanan TANPA login staf.
 *
 * Tenant/properti ditentukan oleh host di backend. Browser tidak pernah
 * menerima atau mengirim nama schema tenant.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarRange, CheckCircle2, Users } from 'lucide-react';
import { api, formatDate } from '../../lib/api';

interface KonteksSitus {
  propertyId: string;
  propertyName: string;
}

interface HasilTipeKamar {
  room_type_id: string;
  code: string;
  nama: string;
  deskripsi: string | null;
  okupansi_maks: number;
  rate_per_malam: string;
  malam: number;
  total: number;
  tersedia: number;
}

interface RoomStay {
  checkin_date: string;
  checkout_date: string;
  adults: number;
  children: number;
  rate_amount: string;
}

interface HasilReservasi {
  code: string;
  status: string;
  room_stays: RoomStay[];
}

function formatRupiah(nilai: number | string) {
  return `Rp${Number(nilai).toLocaleString('id-ID')}`;
}

export function MitrainapPesanPage() {
  return <MitrainapPropertiSitusPage />;
}

/**
 * Situs properti publik di `<slug>.mitrainap.id` (MI-3).
 *
 * Memanggil `/public/hospitality-site/context` -- tanpa sesi, tanpa hak
 * akses. Properti mana yang ditampilkan ditentukan HOST PERMINTAAN,
 * dicocokkan ke baris terdaftar di control plane (IR-005) -- pola sama
 * dengan `SitusPondokPage.tsx`.
 */
export function MitrainapPropertiSitusPage() {
  const konteks = useQuery({
    queryKey: ['mitrainap-situs-konteks'],
    queryFn: () => api.get<KonteksSitus>('/public/hospitality-site/context'),
  });

  if (konteks.isLoading) {
    return <p className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">Memuat...</p>;
  }
  if (konteks.isError || !konteks.data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Situs Belum Tersedia</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Properti ini belum menyiapkan situs pemesanannya. Silakan hubungi properti secara langsung.
        </p>
      </div>
    );
  }

  return <IsiPesan propertyId={konteks.data.propertyId} namaProperti={konteks.data.propertyName} />;
}

function IsiPesan({
  propertyId,
  namaProperti,
}: {
  propertyId: string;
  namaProperti?: string;
}) {
  const besok = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const lusa = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);

  const [pencarian, setPencarian] = useState({ checkin: besok, checkout: lusa, dewasa: '2', anak: '0' });
  const [dicari, setDicari] = useState(false);
  const [tipeDipilih, setTipeDipilih] = useState<HasilTipeKamar | null>(null);
  const [formTamu, setFormTamu] = useState({ namaLengkap: '', email: '', telepon: '', permintaanKhusus: '' });
  const [konfirmasi, setKonfirmasi] = useState<HasilReservasi | null>(null);
  const [galatPesan, setGalatPesan] = useState<string | null>(null);

  const hasil = useQuery({
    queryKey: ['mitrainap-cari', propertyId, pencarian.checkin, pencarian.checkout, pencarian.dewasa, pencarian.anak],
    queryFn: () => {
      const params = new URLSearchParams({
        checkin: pencarian.checkin,
        checkout: pencarian.checkout,
        dewasa: pencarian.dewasa,
        anak: pencarian.anak,
      });
      return api.get<HasilTipeKamar[]>(`/public/hospitality-booking/search?${params.toString()}`);
    },
    enabled: dicari && !!propertyId,
  });

  const pesan = useMutation({
    mutationFn: () =>
      api.post<HasilReservasi>(
        '/public/hospitality-booking/reservations',
        {
          roomTypeId: tipeDipilih!.room_type_id,
          checkin: pencarian.checkin,
          checkout: pencarian.checkout,
          dewasa: Number(pencarian.dewasa) || 1,
          anak: Number(pencarian.anak) || 0,
          namaLengkap: formTamu.namaLengkap,
          email: formTamu.email || undefined,
          telepon: formTamu.telepon || undefined,
          permintaanKhusus: formTamu.permintaanKhusus || undefined,
          metodePembayaran: 'PAY_AT_PROPERTY',
        },
        { headers: { 'Idempotency-Key': crypto.randomUUID() } },
      ),
    onSuccess: (data) => {
      setKonfirmasi(data);
      setTipeDipilih(null);
      setGalatPesan(null);
    },
    onError: (error: unknown) => {
      const pesan = error instanceof Error ? error.message : 'Gagal memproses pemesanan.';
      setGalatPesan(pesan);
    },
  });

  if (konfirmasi) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
        <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Pemesanan Berhasil</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          Kode pemesanan Anda: <strong className="text-lg">{konfirmasi.code}</strong>
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Simpan kode ini beserta email/telepon yang Anda daftarkan -- keduanya dipakai untuk mengelola pemesanan Anda kembali.
        </p>
        <div className="mt-6 rounded-xl border border-slate-200 p-4 text-start text-sm dark:border-slate-800">
          {konfirmasi.room_stays.map((rs, i) => (
            <p key={i}>
              {formatDate(rs.checkin_date)} — {formatDate(rs.checkout_date)} · {rs.adults} dewasa, {rs.children} anak · {formatRupiah(rs.rate_amount)}
            </p>
          ))}
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Pembayaran dilakukan langsung di properti saat check-in.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        {namaProperti ? `Cari dan Pesan Kamar — ${namaProperti}` : 'Cari dan Pesan Kamar'}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Harga yang tampil adalah total untuk seluruh malam menginap -- tidak ada biaya tersembunyi.
      </p>
      <a
        href="/mitrainap/properti/kelola-pesanan"
        className="mt-2 inline-block text-sm font-medium text-blue-700 hover:underline dark:text-blue-300"
      >
        Sudah memesan? Kelola pemesanan
      </a>

      <div className="card mt-6 grid gap-3 p-4 sm:grid-cols-5">
        <Field label="Check-in">
          <input
            type="date"
            className="field-input"
            value={pencarian.checkin}
            onChange={(e) => setPencarian({ ...pencarian, checkin: e.target.value })}
          />
        </Field>
        <Field label="Check-out">
          <input
            type="date"
            className="field-input"
            value={pencarian.checkout}
            onChange={(e) => setPencarian({ ...pencarian, checkout: e.target.value })}
          />
        </Field>
        <Field label="Dewasa">
          <input
            type="number"
            min="1"
            className="field-input"
            value={pencarian.dewasa}
            onChange={(e) => setPencarian({ ...pencarian, dewasa: e.target.value })}
          />
        </Field>
        <Field label="Anak">
          <input
            type="number"
            min="0"
            className="field-input"
            value={pencarian.anak}
            onChange={(e) => setPencarian({ ...pencarian, anak: e.target.value })}
          />
        </Field>
        <div className="flex items-end">
          <button type="button" className="btn-primary w-full" onClick={() => setDicari(true)}>
            Cari Kamar
          </button>
        </div>
      </div>

      {dicari && hasil.isLoading && <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">Mencari...</p>}
      {dicari && hasil.isError && (
        <p className="mt-6 text-sm text-rose-600 dark:text-rose-400">Gagal memuat ketersediaan. Coba lagi.</p>
      )}
      {dicari && hasil.data && hasil.data.length === 0 && (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Tidak ada kamar tersedia untuk tanggal dan jumlah tamu ini.
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {(hasil.data ?? []).map((r) => (
          <div key={r.room_type_id} className="card p-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">{r.nama}</h2>
            {r.deskripsi && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{r.deskripsi}</p>}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" aria-hidden />
                Maks {r.okupansi_maks} tamu
              </span>
              <span className="flex items-center gap-1">
                <CalendarRange className="h-3.5 w-3.5" aria-hidden />
                {r.malam} malam
              </span>
              <span>{r.tersedia} kamar tersisa</span>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{formatRupiah(r.total)}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{formatRupiah(r.rate_per_malam)}/malam</p>
              </div>
              <button type="button" className="btn-primary" onClick={() => setTipeDipilih(r)}>
                Pilih
              </button>
            </div>
          </div>
        ))}
      </div>

      {tipeDipilih && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setTipeDipilih(null);
          }}
        >
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Data Pemesan — {tipeDipilih.nama}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Total: <strong>{formatRupiah(tipeDipilih.total)}</strong> untuk {tipeDipilih.malam} malam. Dibayar langsung di properti.
            </p>

            {galatPesan && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {galatPesan}
              </div>
            )}

            <div className="mt-4 space-y-3">
              <Field label="Nama Lengkap *">
                <input
                  className="field-input"
                  value={formTamu.namaLengkap}
                  onChange={(e) => setFormTamu({ ...formTamu, namaLengkap: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
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
              <p className="text-xs text-slate-500 dark:text-slate-400">Isi email atau telepon (salah satu wajib).</p>
              <Field label="Permintaan Khusus">
                <textarea
                  className="field-input"
                  rows={2}
                  value={formTamu.permintaanKhusus}
                  onChange={(e) => setFormTamu({ ...formTamu, permintaanKhusus: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setTipeDipilih(null)}>
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!formTamu.namaLengkap || (!formTamu.email && !formTamu.telepon) || pesan.isPending}
                onClick={() => pesan.mutate()}
              >
                {pesan.isPending ? 'Memproses...' : 'Pesan Sekarang'}
              </button>
            </div>
          </div>
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
